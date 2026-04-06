import api from './api';
import { useExamSessionStore } from '../stores/examSession';

// ─────────────────────────────────────────────────────────────────────────────
// Server-side answer ID cache
//
// Laravel API resource only supports:
//   POST   /student-answers        → create  (fails if answer already exists)
//   PUT    /student-answers/{id}   → update  (requires the server record's ID)
//
// This cache maps  "assignmentId_questionId"  →  server record ID
// so we know whether to POST (first time) or PUT/{id} (update).
// ─────────────────────────────────────────────────────────────────────────────

const answerIdCache = {};   // { "aid_qid": serverAnswerId }

const cacheKey = (aid, qid) => `${aid}_${qid}`;

function storeId(aid, qid, id) {
    if (aid && qid && id) answerIdCache[cacheKey(aid, qid)] = Number(id);
}

function getStoredId(aid, qid) {
    return answerIdCache[cacheKey(aid, qid)] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveAnswerValue(questionId, rawValue, questions) {
    const q = questions.find(q => Number(q.id) === Number(questionId));
    if (!q) return String(rawValue ?? '');
    if (q.type === 'Multiple Choice') {
        if (rawValue === null || rawValue === undefined || rawValue === '') return '';
        return q.options?.[rawValue]?.text ?? String(rawValue);
    }
    return String(rawValue ?? '');
}



export async function preloadAnswerIds(assignmentId) {
    if (!assignmentId) return;
    try {
        const res = await api.get(`/student-answers/check/${Number(assignmentId)}`);
        const list = Array.isArray(res?.data?.answers) ? res.data.answers
            : Array.isArray(res?.data?.data) ? res.data.data
                : Array.isArray(res?.data) ? res.data
                    : [];

        list.forEach(a => {
            const qid = Number(a.question_id ?? a.question?.id ?? 0);
            const id = Number(a.id ?? 0);
            if (qid && id) storeId(assignmentId, qid, id);
        });

        console.log('[AQ] preloadAnswerIds — cached', list.length, 'existing server answer IDs');
    } catch (_) {
        // Non-fatal — cache is empty; we'll POST and cache IDs on the fly
        console.warn('[AQ] preloadAnswerIds failed — will POST first and cache IDs as they arrive');
    }
}



async function sendSingleAnswer(assignmentId, questionId, answerValue) {
    const aid = Number(assignmentId);
    const qid = Number(questionId);
    const val = String(answerValue);

    const existingId = getStoredId(aid, qid);

    // ── UPDATE path (we already know the server record's ID) ──
    if (existingId) {
        try {
            await api.put(`/student-answers/${existingId}`, {
                assignment_id: aid,
                question_id: qid,
                answer_value: val,
            });
            console.log('[AQ] ✓ PUT /student-answers/' + existingId + ' (q' + qid + ')');
            return true;
        } catch (err) {
            console.error('[AQ] ✗ PUT failed for answer', existingId,
                '| HTTP', err?.response?.status,
                err?.response?.data?.message ?? err.message);
            return false;
        }
    }

    // ── CREATE path (first time seeing this question) ──
    try {
        const res = await api.post('/student-answers', {
            assignment_id: aid,
            question_id: qid,
            answer_value: val,
        });

        const body = res?.data?.data ?? res?.data ?? {};
        const skipped = body?.skipped === true || body?.skipped === 1 || body?.skipped === '1';
        const newId = Number(body?.id ?? 0);

        if (skipped) {
            // Server accepted the call but answer already existed (200 + skipped flag)
            // Try to grab the existing record's ID from the response
            const existingRecordId = Number(body?.existing_id ?? body?.answer_id ?? body?.data?.id ?? 0);
            if (existingRecordId) {
                storeId(aid, qid, existingRecordId);
                // Immediately update with the correct value
                return sendSingleAnswer(aid, qid, val);
            }
            // No ID available — treat as "on server, value may be stale"
            console.warn('[AQ] POST skipped for q' + qid + ' — no existing ID in response; submit will retry');
            return true;
        }

        if (newId) storeId(aid, qid, newId);
        console.log('[AQ] ✓ POST /student-answers → id', newId, '(q' + qid + ')');
        return true;

    } catch (err) {
        const status = err?.response?.status;
        const body = err?.response?.data ?? {};
        const msg = body?.message ?? err.message ?? '';

        // 422 / 409 / "already answered" → answer exists but we don't have its ID
        const isAlreadyExists =
            status === 422 || status === 409 ||
            body?.skipped === true || body?.skipped === 1 ||
            (typeof msg === 'string' && msg.toLowerCase().includes('already'));

        if (isAlreadyExists) {
            // Try to get the existing record's ID from the error body
            const existingRecordId = Number(
                body?.data?.id ?? body?.id ?? body?.existing_id ?? body?.answer_id ?? 0
            );

            if (existingRecordId) {
                console.log('[AQ] POST 422 for q' + qid + ' — found existing ID', existingRecordId, ', retrying as PUT');
                storeId(aid, qid, existingRecordId);
                return sendSingleAnswer(aid, qid, val);
            }

            console.warn('[AQ] POST 422 for q' + qid + ' — no ID in error body; stored locally, retry on submit');
            return true;
        }

        console.error('[AQ] ✗ POST failed for q' + qid + ' | HTTP', status, msg);
        return false;
    }
}



async function sendAnswerBatch(assignmentId, answers, questionTimes = {}) {
    if (!assignmentId || !answers.length) {
        console.warn('[AQ] sendAnswerBatch blocked — aid:', assignmentId, 'count:', answers.length);
        return false;
    }

    try {
        const res = await api.post('/student-answers', {
            assignment_id: Number(assignmentId),
            answers: answers.map(({ questionId, answerValue }) => {
                const timeData = questionTimes[questionId] ?? questionTimes[String(questionId)] ?? 0;
                return {
                    question_id:  Number(questionId),
                    answer_value: String(answerValue),
                    time_spent:   typeof timeData === 'object' ? (timeData.totalSeconds || 0) : timeData,
                };
            }),
        });


        const returned = res?.data?.data ?? [];
        if (Array.isArray(returned)) {
            returned.forEach(({ question_id, id }) => {
                if (question_id && id) storeId(assignmentId, question_id, id);
            });
        }

        console.log('[AQ] ✓ bulk POST /student-answers — ' + answers.length + ' answers');
        return true;

    } catch (err) {
        console.error('[AQ] ✗ bulk POST failed | HTTP',
            err?.response?.status,
            err?.response?.data?.message ?? err.message
        );
        return false;
    }
}


export function recordAndMaybeFlush(
    questionId,
    value,
    { assignmentId, questions, isOffline = false } = {}
) {
    const session = useExamSessionStore();
    session.recordAnswer(questionId, value);

    console.log('[AQ] Stored locally — q' + questionId + ' =', value,
        '| answers:', Object.keys(session.answers).length,
        '| pending:', Object.keys(session.getPendingAnswers()).length);
}



export async function flushBatchOnNext(
    { assignmentId, questions, isOffline = false, questionTimes = {} } = {}
) {
    const session = useExamSessionStore();
    const effectiveId = assignmentId ?? session.assignmentId ?? null;

    if (isOffline) {
        console.log('[AQ] flushBatchOnNext — offline, answers stay local until submit');
        return;
    }
    if (!effectiveId) {
        console.warn('[AQ] flushBatchOnNext — no assignmentId, answers buffered');
        return;
    }

    const qs = questions ?? session.questions ?? [];
    const times = { ...questionTimes, ...session.questionTimes };
    const pending = session.getPendingAnswers();
    const entries = Object.entries(pending)
        .filter(([, v]) => v !== null && v !== undefined && v !== '');

    if (!entries.length) {
        console.log('[AQ] flushBatchOnNext — nothing pending');
        return;
    }

    const batch = entries.map(([qid, raw]) => ({
        questionId: Number(qid),
        answerValue: resolveAnswerValue(qid, raw, qs),
    })).filter(({ answerValue }) => answerValue !== '');

    console.log('[AQ] flushBatchOnNext — flushing', batch.length, 'answers');

    const ok = await sendAnswerBatch(effectiveId, batch, times);
    if (ok) {
        session.flushQueue();
        console.log('[AQ] flushBatchOnNext — pending queue cleared');
    } else {
        console.warn('[AQ] flushBatchOnNext — partial failure; retaining failed answers in queue');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// flushAllPending  (exported)
//
// Called ONLY by Submit Test.
// Sends ALL answers in session.answers (not just pendingQueue) so re-answered
// questions always have their latest value written to the server.
// ─────────────────────────────────────────────────────────────────────────────

export async function flushAllPending(
    { assignmentId, questions, isOffline = false, questionTimes = {} } = {}
) {
    const session = useExamSessionStore();
    const effectiveId = assignmentId ?? session.assignmentId ?? null;

    console.log('[AQ] flushAllPending — aid:', effectiveId,
        '| pending:', Object.keys(session.getPendingAnswers()).length,
        '| total:', Object.keys(session.answers).length);

    if (isOffline || !effectiveId) {
        console.warn('[AQ] flushAllPending skipped —', isOffline ? 'offline' : 'no assignmentId');
        return;
    }

    const qs = questions ?? session.questions ?? [];
    const times = { ...questionTimes, ...session.questionTimes };
    const allEntries = Object.entries(session.answers ?? {})
        .filter(([, v]) => v !== null && v !== undefined && v !== '');

    if (!allEntries.length) {
        console.warn('[AQ] flushAllPending — session.answers is empty, nothing to send');
        return;
    }

    const answers = allEntries.map(([qid, raw]) => ({
        questionId: Number(qid),
        answerValue: resolveAnswerValue(qid, raw, qs),
    })).filter(({ answerValue }) => answerValue !== '');

    console.log('[AQ] Sending final batch of', answers.length, 'answers with question times');

    const ok = await sendAnswerBatch(effectiveId, answers, times);
    if (ok) {
        session.flushQueue();
        console.log('[AQ] flushAllPending — done');
    } else {
        console.warn('[AQ] flushAllPending — some answers failed to save');
    }
}