import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const sqlite = new SQLiteConnection(CapacitorSQLite);
let db = null;

export async function initDB() {
    try {
        const retCC = await sqlite.checkConnectionsConsistency();
        const isConn = await sqlite.isConnection('bma_cams', false);

        if (retCC.result && isConn.result) {
            db = await sqlite.retrieveConnection('bma_cams', false);
        } else {
            db = await sqlite.createConnection('bma_cams', false, 'no-encryption', 1, false);
        }

        await db.open();

        await db.execute(`
            CREATE TABLE IF NOT EXISTS cached_users (
                id INTEGER PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                user_data TEXT NOT NULL,
                token TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS pending_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                method TEXT NOT NULL,
                url TEXT NOT NULL,
                body TEXT,
                headers TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                retries INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending'
            );
        `);

        // Stores each assignment row from /student-exam-assignments
        await db.execute(`
            CREATE TABLE IF NOT EXISTS cached_assignments (
                id INTEGER PRIMARY KEY,
                student_id INTEGER NOT NULL,
                exam_id INTEGER NOT NULL,
                exam_name TEXT,
                status TEXT DEFAULT 'Not Started',
                time_limit INTEGER DEFAULT 60,
                data TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            );
        `);

        // Stores normalised question objects keyed by question id + exam id
        await db.execute(`
            CREATE TABLE IF NOT EXISTS cached_questions (
                id INTEGER PRIMARY KEY,
                exam_id INTEGER NOT NULL,
                data TEXT NOT NULL,
                updated_at TEXT DEFAULT (datetime('now'))
            );
        `);

        // Answers saved while offline; pushed to server when back online
        await db.execute(`
            CREATE TABLE IF NOT EXISTS offline_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assignment_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                answer_value TEXT,
                synced INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(assignment_id, question_id)
            );
        `);

        console.log('[DB] SQLite initialized');
        return db;
    } catch (error) {
        console.error('[DB] init error:', error);
        throw error;
    }
}

export async function getDB() {
    if (!db) await initDB();
    return db;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export async function cacheUserLogin(email, passwordHash, userData, token) {
    try {
        const d = await getDB();
        const userDataStr = JSON.stringify(userData);
        const existing = await d.query('SELECT id FROM cached_users WHERE email = ?', [email]);
        if (existing.values?.length > 0) {
            await d.run(
                `UPDATE cached_users SET password_hash=?, user_data=?, token=?, synced=1 WHERE email=?`,
                [passwordHash, userDataStr, token, email]
            );
        } else {
            await d.run(
                `INSERT INTO cached_users (email, password_hash, user_data, token, synced) VALUES (?,?,?,?,1)`,
                [email, passwordHash, userDataStr, token]
            );
        }
    } catch (e) {
        console.error('[DB] cacheUserLogin:', e);
    }
}

export async function verifyOfflineLogin(email, passwordHash) {
    try {
        const d = await getDB();
        const result = await d.query(
            'SELECT * FROM cached_users WHERE email=? AND password_hash=?',
            [email, passwordHash]
        );
        if (result.values?.length > 0) {
            const row = result.values[0];
            return { user: JSON.parse(row.user_data), token: row.token };
        }
        return null;
    } catch (e) {
        console.error('[DB] verifyOfflineLogin:', e);
        return null;
    }
}

export async function hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

/**
 * Cache the raw assignment array from /student-exam-assignments.
 */
export async function cacheAssignments(studentId, assignments) {
    try {
        const d = await getDB();
        for (const a of assignments) {
            const examId = Number(a.exam_id || a.exam?.id || 0);
            if (!examId) continue;
            await d.run(
                `INSERT INTO cached_assignments (id, student_id, exam_id, exam_name, status, time_limit, data, updated_at)
                 VALUES (?,?,?,?,?,?,?,datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET
                   exam_name=excluded.exam_name,
                   status=excluded.status,
                   time_limit=excluded.time_limit,
                   data=excluded.data,
                   updated_at=excluded.updated_at`,
                [
                    Number(a.id),
                    Number(studentId),
                    examId,
                    a.exam?.name || `Exam ${examId}`,
                    a.status || 'Not Started',
                    Number(a.exam?.time_limit || a.exam?.duration || 60),
                    JSON.stringify(a)
                ]
            );
        }
        console.log(`[DB] Cached ${assignments.length} assignments for student ${studentId}`);
    } catch (e) {
        console.error('[DB] cacheAssignments:', e);
    }
}

export async function getCachedAssignments(studentId) {
    try {
        const d = await getDB();
        const result = await d.query(
            'SELECT data FROM cached_assignments WHERE student_id=? ORDER BY id',
            [Number(studentId)]
        );
        return (result.values || []).map(row => JSON.parse(row.data));
    } catch (e) {
        console.error('[DB] getCachedAssignments:', e);
        return [];
    }
}

export async function updateCachedAssignmentStatus(assignmentId, status) {
    try {
        const d = await getDB();

        // Update the status column
        await d.run(
            `UPDATE cached_assignments SET status=?, updated_at=datetime('now') WHERE id=?`,
            [status, Number(assignmentId)]
        );

        // Also patch the status inside the data JSON blob so getCachedAssignments
        // returns the correct status when the dashboard reloads offline
        const row = await d.query(
            'SELECT data FROM cached_assignments WHERE id=?',
            [Number(assignmentId)]
        );
        if (row.values?.length > 0) {
            try {
                const parsed = JSON.parse(row.values[0].data);
                parsed.status = status;
                await d.run(
                    `UPDATE cached_assignments SET data=? WHERE id=?`,
                    [JSON.stringify(parsed), Number(assignmentId)]
                );
            } catch (_) { }
        }
    } catch (e) {
        console.error('[DB] updateCachedAssignmentStatus:', e);
    }
}

// ─── QUESTIONS ────────────────────────────────────────────────────────────────

/**
 * Pass in the already-normalised question objects (same shape the store uses).
 */
export async function cacheExamQuestions(examId, questions) {
    try {
        const d = await getDB();
        for (const q of questions) {
            await d.run(
                `INSERT INTO cached_questions (id, exam_id, data, updated_at)
                 VALUES (?,?,?,datetime('now'))
                 ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
                [Number(q.id), Number(examId), JSON.stringify(q)]
            );
        }
        console.log(`[DB] Cached ${questions.length} questions for exam ${examId}`);
    } catch (e) {
        console.error('[DB] cacheExamQuestions:', e);
    }
}

export async function getCachedExamQuestions(examId) {
    try {
        const d = await getDB();
        const result = await d.query(
            'SELECT data FROM cached_questions WHERE exam_id=?',
            [Number(examId)]
        );
        return (result.values || []).map(row => JSON.parse(row.data));
    } catch (e) {
        console.error('[DB] getCachedExamQuestions:', e);
        return [];
    }
}

// ─── OFFLINE ANSWERS ──────────────────────────────────────────────────────────

export async function saveOfflineAnswer(assignmentId, questionId, answerValue) {
    try {
        const d = await getDB();
        await d.run(
            `INSERT INTO offline_answers (assignment_id, question_id, answer_value, synced)
             VALUES (?,?,?,0)
             ON CONFLICT(assignment_id, question_id) DO UPDATE SET answer_value=excluded.answer_value, synced=0`,
            [Number(assignmentId), Number(questionId), String(answerValue)]
        );
    } catch (e) {
        console.error('[DB] saveOfflineAnswer:', e);
    }
}

export async function getOfflineAnswers(assignmentId) {
    try {
        const d = await getDB();
        const result = await d.query(
            'SELECT * FROM offline_answers WHERE assignment_id=? AND synced=0',
            [Number(assignmentId)]
        );
        return result.values || [];
    } catch (e) {
        console.error('[DB] getOfflineAnswers:', e);
        return [];
    }
}

export async function markAnswersSynced(assignmentId) {
    try {
        const d = await getDB();
        await d.run(
            `UPDATE offline_answers SET synced=1 WHERE assignment_id=?`,
            [Number(assignmentId)]
        );
    } catch (e) {
        console.error('[DB] markAnswersSynced:', e);
    }
}

export async function getPendingAnswerAssignmentIds() {
    try {
        const d = await getDB();
        const result = await d.query(
            'SELECT DISTINCT assignment_id FROM offline_answers WHERE synced=0'
        );
        return (result.values || []).map(r => r.assignment_id);
    } catch (e) {
        console.error('[DB] getPendingAnswerAssignmentIds:', e);
        return [];
    }
}

// ─── GENERIC QUEUE ────────────────────────────────────────────────────────────

export async function enqueueRequest(method, url, body = null, headers = null) {
    const d = await getDB();
    await d.run(
        `INSERT INTO pending_requests (method, url, body, headers) VALUES (?,?,?,?)`,
        [method.toUpperCase(), url, body ? JSON.stringify(body) : null, headers ? JSON.stringify(headers) : null]
    );
}

export async function getPendingRequests(limit = 20) {
    const d = await getDB();
    const res = await d.query(
        `SELECT * FROM pending_requests WHERE status='pending' ORDER BY id ASC LIMIT ?`,
        [limit]
    );
    return res.values || [];
}

export async function markRequestDone(id) {
    const d = await getDB();
    await d.run(`UPDATE pending_requests SET status='done' WHERE id=?`, [id]);
}

export async function incrementRequestRetry(id) {
    const d = await getDB();
    await d.run(`UPDATE pending_requests SET retries=retries+1 WHERE id=?`, [id]);
}

export async function removeProcessedRequests() {
    const d = await getDB();
    await d.run(`DELETE FROM pending_requests WHERE status='done'`);
}

export async function closeDB() {
    if (db) {
        await sqlite.closeConnection('bma_cams', false);
        db = null;
    }
}