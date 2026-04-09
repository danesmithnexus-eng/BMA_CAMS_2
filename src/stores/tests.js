import { defineStore } from 'pinia';
import api from '../services/api';
import { useQuestionStore } from './questions';
import { useAuthStore } from './auth';

export const useTestStore = defineStore('tests', {
    state: () => ({
        pilotTests: [],
        studentTests: [],
        currentTest: null,
        timerInterval: null,
        selectedReport: null,
        selectedStudentResult: null,
        selectedTest: null,
        reviewMode: false,
        studentPerformanceReport: []
    }),

    getters: {
        getTestById: (state) => (id) => state.pilotTests.find(t => t.id === id),
        getStudentTests: (state) => (studentId) => state.studentTests.filter(st => Number(st.studentId) === Number(studentId)),
        getAssignedTestsForStudent: (state) => (studentId) => {
            return state.studentTests.filter(st => Number(st.studentId) === Number(studentId)).map(st => {
                const test = state.pilotTests.find(t => Number(t.id) === Number(st.testId));
                return {
                    ...st,
                    id: st.testId,
                    name: (test && test.name) ? test.name : (st.name || `Exam ${st.testId}`),
                    description: (test && test.description) ? test.description : (st.description || ''),
                    timeLimit: test ? test.timeLimit : (st.timeLimit || 0),
                    questionIds: test ? test.questionIds : (st.questionIds || []),
                    creatorName: test ? test.creatorName : (st.creatorName || null),
                    durationSeconds: st.durationSeconds || null,
                    completedAt: st.completedAt || null
                };
            });
        }
    },

    actions: {

        // ─── Core store mutations ──────────────────────────────────────────────

        addTest(test) {
            if (!test.id) test.id = Date.now();
            const idx = this.pilotTests.findIndex(t => t.id === test.id);
            if (idx >= 0) this.pilotTests[idx] = { ...this.pilotTests[idx], ...test };
            else this.pilotTests.push(test);
        },

        assignTest(assignment) { this.studentTests.push(assignment); },

        updateStudentTestStatus(testId, studentId, status) {
            const test = this.studentTests.find(
                st => Number(st.testId) === Number(testId) && Number(st.studentId) === Number(studentId)
            );
            if (test) test.status = status;
        },

        approveTest(testId) {
            const test = this.pilotTests.find(t => Number(t.id) === Number(testId));
            if (test) test.status = 'Active';
        },

        setSelectedReport(report) { this.selectedReport = report; },
        setSelectedStudentResult(result) { this.selectedStudentResult = result; },
        setSelectedTest(test) { this.selectedTest = test; },


        _resolveTypeLabel(d) {
            const id = d.question_type_id;
            const str = (d.question_type || '').toString().toLowerCase();
            if (typeof id === 'number') {
                if (id === 1) return 'True or False';
                if (id === 2) return 'Multiple Choice';
                if (id === 3) return 'Matching Type';
                if (id === 4) return 'Identification';
                if (id === 5) return 'Enumeration';
            }
            if (str.includes('true')) return 'True or False';
            if (str.includes('multiple')) return 'Multiple Choice';
            if (str.includes('matching')) return 'Matching Type';
            if (str.includes('identification')) return 'Identification';
            if (str.includes('enumeration')) return 'Enumeration';
            return 'Multiple Choice';
        },

        // ── FIX: expanded field lookups for loTags and cognitiveLevel ──────────
        _buildQuestionPayload(d, existingQuestion = null) {
            const typeLabel = this._resolveTypeLabel(d);
            let options = [];
            let pairs = [];

            if (typeLabel === 'Multiple Choice') {
                const mc = d.multiple_choice_answers || d.multipleChoiceAnswers
                    || d.options || d.choices || d.answers
                    || d.mc_answers || d.mcAnswers || d.answer_choices || [];
                const sorted = Array.isArray(mc)
                    ? [...mc].sort((a, b) => Number(a.option_order ?? a.order ?? a.index ?? a.sort_order ?? 0) - Number(b.option_order ?? b.order ?? b.index ?? b.sort_order ?? 0))
                    : [];
                options = sorted.map(a => ({
                    text: a.option_text || a.text || a.answer_text || a.choice_text
                        || a.label || a.value || String(a.value ?? '')
                })).filter(o => o.text !== undefined && o.text !== '');
                if (!options.length && Array.isArray(mc)) {
                    options = mc.map(v => (typeof v === 'string' ? { text: v } : { text: String(v) }));
                }
            } else if (typeLabel === 'Matching Type') {
                const mp = d.pairs || d.matching_pairs || d.matchingPairs || [];
                pairs = Array.isArray(mp) ? mp.map(p => ({
                    prompt: p.prompt || p.left || p.term || '',
                    answer: p.answer || p.right || p.definition || ''
                })) : [];
            }

            // ── FIX: cast a wide net for learning outcome field names ──────────
            const loRaw =
                d.learning_outcome   ||
                d.lo                 ||
                d.learning_outcomes  ||
                d.lo_tag             ||
                d.lo_code            ||
                d.lo_tags            ||
                d.outcome            ||
                d.clo                ||
                d.clo_tag            ||
                (Array.isArray(d.loTags) ? d.loTags[0] : d.loTags) ||
                existingQuestion?.loTags?.[0] ||
                '';

            const loNorm = loRaw
                ? String(loRaw).trim().replace(/^(LO|CLO)(\d)/i, '$1 $2').toUpperCase()
                : '';
            const cognitiveLevel =
                d.cognitive_level    ||
                d.cognitiveLevel     ||
                d.cognitive_tag      ||
                d.cognitiveTag       ||
                d.bloom_level        ||
                d.bloom              ||
                d.bloom_taxonomy     ||
                d.taxonomy_level     ||
                d.taxonomy           ||
                d.level              ||
                existingQuestion?.cognitiveLevel ||
                existingQuestion?.cognitiveTag   ||
                '';

            const payload = {
                id: Number(d.id),
                text: d.question_text || d.text || d.title || d.content
                    || d.body || d.question || d.stem || '',
                status: 'Approved',
                program: existingQuestion?.program || d.program || '',
                course: existingQuestion?.course || d.course || '',
                type: typeLabel,
                loTags: loNorm ? [loNorm] : (existingQuestion?.loTags || []),
                cognitiveLevel,
                options,
                pairs
            };

            if (typeLabel === 'Multiple Choice') {
                const mc = d.multiple_choice_answers || d.multipleChoiceAnswers
                    || d.options || d.choices || d.answers
                    || d.mc_answers || d.mcAnswers || d.answer_choices || [];
                const sorted = Array.isArray(mc)
                    ? [...mc].sort((a, b) => Number(a.option_order ?? a.order ?? a.index ?? a.sort_order ?? 0) - Number(b.option_order ?? b.order ?? b.index ?? b.sort_order ?? 0))
                    : [];
                let correctIndex = sorted.findIndex(a => {
                    const v = a.is_correct ?? a.correct ?? a.isCorrect ?? a.is_right
                        ?? a.isRight ?? a.answer_is_correct ?? a.isAnswer ?? a.is_answer;
                    if (typeof v === 'boolean') return v;
                    if (typeof v === 'number') return v === 1;
                    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1' || v.toLowerCase() === 'yes';
                    return false;
                });
                if (correctIndex < 0) {
                    const ci = d.correct_option_index ?? d.correct_index ?? d.answer_index ?? d.answerIndex;
                    if (ci != null && !Number.isNaN(Number(ci))) {
                        const n = Number(ci);
                        correctIndex = (n > 0 && n <= options.length) ? n - 1 : (n >= 0 && n < options.length ? n : correctIndex);
                    } else {
                        const cl = d.correct_option_label || d.correct_option || d.correct_answer || d.answer;
                        if (typeof cl === 'string') {
                            const letter = cl.trim().toUpperCase();
                            if (/^[A-Z]$/.test(letter)) {
                                const idx = letter.charCodeAt(0) - 65;
                                if (idx >= 0 && idx < options.length) correctIndex = idx;
                            } else {
                                const idx2 = options.findIndex(o => o.text && o.text.toString().trim() === cl.toString().trim());
                                if (idx2 >= 0) correctIndex = idx2;
                            }
                        }
                    }
                }
                if (correctIndex >= 0) payload.answerIndex = correctIndex;

            } else if (typeLabel === 'True or False') {
                const ca = d.correct_answer ?? d.answer ?? d.is_true ?? d.isCorrect
                    ?? (d.true_false_answer && (d.true_false_answer.correct_answer ?? d.true_false_answer.is_true ?? d.true_false_answer.answer))
                    ?? (d.trueFalseAnswer && (d.trueFalseAnswer.is_true ?? d.trueFalseAnswer.answer ?? d.trueFalseAnswer.correct_answer));
                if (ca !== undefined && ca !== null) {
                    const val = typeof ca === 'boolean' ? ca : (String(ca).toLowerCase() === 'true' || ca === 1 || ca === '1');
                    payload.answer = val ? 'True' : 'False';
                }
            } else if (typeLabel === 'Identification') {
                const ca = d.correct_answer ?? d.answer ?? d.key ?? d.identification_answer ?? d.keyword;
                if (ca !== undefined && ca !== null) payload.answer = String(ca);
            }

            return payload;
        },

        async ensureTestReady(examId) {
            const eid = Number(examId);
            if (!eid) return null;

            const questionStore = useQuestionStore();

            try {
                const r = await api.get(`/exam-questions/${eid}`);
                const raw = r?.data;

                const examMeta = raw?.examDetails || raw?.exam || raw?.data?.exam || null;

                const list = Array.isArray(raw?.examDetails?.exam_questions)
                    ? raw.examDetails.exam_questions
                    : Array.isArray(raw?.data) ? raw.data
                        : Array.isArray(raw?.questions) ? raw.questions
                            : Array.isArray(raw?.exam_questions) ? raw.exam_questions
                                : Array.isArray(raw?.questionList) ? raw.questionList
                                    : Array.isArray(raw) ? raw : [];

                if (!list.length) {
                    console.warn('[ensureTestReady] empty list for exam', eid);
                    return this.pilotTests.find(t => Number(t.id) === eid) ?? null;
                }

                const questions = [];

                for (const item of list) {
                    const q = (item?.question && typeof item.question === 'object') ? item.question : item;
                    const id = Number(q?.id || item?.question_id || 0);
                    if (!id) continue;

                    const text =
                        q.text || q.question_text || q.title || q.content ||
                        item.text || item.question_text || '';

                    const question_type_id = q.question_type_id ?? item.question_type_id ?? null;
                    const question_type = q.question_type || item.question_type || '';

                    const multiple_choice_answers =
                        q.multiple_choice_answers ||
                        q.multiple_choice ||
                        item.multiple_choice_answers ||
                        item.multiple_choice ||
                        q.options || item.options ||
                        q.choices || item.choices || [];

                    const true_false_answer =
                        q.true_false_answer || q.true_false ||
                        item.true_false_answer || item.true_false || null;

                    const correct_answer = q.correct_answer ?? item.correct_answer ?? null;
                    const answer = q.answer ?? item.answer ?? null;
                    const matching_pairs =
                        q.matching_pairs || q.pairs ||
                        item.matching_pairs || item.pairs || [];

                    const normalized = {
                        id,
                        text,
                        question_type_id,
                        question_type,
                        multiple_choice_answers,
                        true_false_answer,
                        trueFalseAnswer: true_false_answer,
                        correct_answer,
                        answer,
                        matching_pairs,
                        pairs: matching_pairs,

                        // cognitive level — try every known field name
                        cognitive_level:
                            q.cognitive_level   || item.cognitive_level   ||
                            q.cognitiveLevel    || item.cognitiveLevel    ||
                            q.cognitive_tag     || item.cognitive_tag     ||
                            q.cognitiveTag      || item.cognitiveTag      ||
                            q.bloom_level       || item.bloom_level       ||
                            q.bloom             || item.bloom             ||
                            q.bloom_taxonomy    || item.bloom_taxonomy    ||
                            q.taxonomy_level    || item.taxonomy_level    ||
                            q.taxonomy          || item.taxonomy          ||
                            q.level             || item.level             ||
                            '',

                        // learning outcome — try every known field name
                        learning_outcome:
                            q.learning_outcome  || item.learning_outcome  ||
                            q.lo                || item.lo                ||
                            q.learning_outcomes || item.learning_outcomes ||
                            q.lo_tag            || item.lo_tag            ||
                            q.lo_code           || item.lo_code           ||
                            q.lo_tags           || item.lo_tags           ||
                            q.outcome           || item.outcome           ||
                            q.clo               || item.clo               ||
                            q.clo_tag           || item.clo_tag           ||
                            '',

                        correct_option_index: q.correct_option_index ?? item.correct_option_index ?? null,
                        answer_index: q.answer_index ?? item.answer_index ?? null,
                        answerIndex: q.answerIndex ?? item.answerIndex ?? null,
                    };

                    const payload = this._buildQuestionPayload(normalized);
                    if (payload.id) questions.push(payload);
                }

                if (!questions.length) {
                    console.warn('[ensureTestReady] no valid questions built for exam', eid);
                    return this.pilotTests.find(t => Number(t.id) === eid) ?? null;
                }

                // ── FIX: diagnostic log — remove after confirming TOS works ────
                console.log('[ensureTestReady] sample questions for TOS debug:', questions.slice(0, 5).map(q => ({
                    id: q.id,
                    loTags: q.loTags,
                    cognitiveLevel: q.cognitiveLevel
                })));

                questions.forEach(q => {
                    const idx = questionStore.questions.findIndex(x => Number(x.id) === Number(q.id));
                    if (idx >= 0) questionStore.questions[idx] = { ...questionStore.questions[idx], ...q };
                    else questionStore.questions.push(q);
                });

                const cached = this.pilotTests.find(t => Number(t.id) === eid);
                const qids = questions.map(q => q.id);

                const examName =
                    examMeta?.name ||
                    examMeta?.title ||
                    examMeta?.exam_name ||
                    examMeta?.description ||
                    cached?.name ||
                    `Exam ${eid}`;

                this.addTest({
                    id: eid,
                    name: examName,
                    description: examMeta?.description || cached?.description || '',
                    term: examMeta?.terms || examMeta?.term || examMeta?.semester || cached?.term || 'Midterm',
                    timeLimit: Number(examMeta?.time_limit || examMeta?.timeLimit || cached?.timeLimit || 60),
                    questionIds: qids,
                    status: 'Active'
                });

                return this.pilotTests.find(t => Number(t.id) === eid) ?? null;

            } catch (e) {
                console.error('[ensureTestReady] error for exam', eid, e);
                return this.pilotTests.find(t => Number(t.id) === eid) ?? null;
            }
        },

        // ─── Assignments ───────────────────────────────────────────────────────

        async fetchStudentAssignments(studentId) {
            const sid = Number(studentId);
            if (!sid) return;
            try {
                const params = { 
                    student_id: sid, 
                    studentId: sid, 
                    userId: sid,
                    faculty_id: sid // Include faculty_id so assigned faculty can fetch their tests
                };
                const r = await api.get('/student-exam-assignments', { params });
                const list = Array.isArray(r?.data?.data) ? r.data.data
                    : (Array.isArray(r?.data) ? r.data : []);

                for (const a of list) {
                    const aid = Number(a.id ?? 0);
                    const eid = Number(a.exam_id ?? a.examId ?? a.exam?.id ?? 0);
                    if (!aid || !eid) continue;
                    const status = this._normalizeStatus(a.status);
                    const examName = a.exam?.name || a.exam?.title || a.exam?.exam_name
                        || a.exam?.test_name || a.exam?.description || a.name || `Exam ${eid}`;
                    const idx = this.studentTests.findIndex(st => Number(st.assignmentId) === aid);
                    const row = {
                        studentId: sid, testId: eid, assignmentId: aid,
                        name: examName, status,
                        score: status === 'Completed' ? (a.score ?? null) : null,
                        rawScore: status === 'Completed' ? (a.raw_score ?? null) : null,
                        totalQuestions: status === 'Completed' ? (a.total_questions ?? null) : null,
                        durationSeconds: status === 'Completed' ? (a.time_spent ?? null) : null,
                        completedAt: status === 'Completed' ? (a.completed_at ?? null) : null,
                        answers: (idx !== -1 && this.studentTests[idx].answers) ? this.studentTests[idx].answers : {}
                    };
                    if (idx === -1) this.studentTests.push(row);
                    else this.studentTests[idx] = { ...this.studentTests[idx], ...row };
                }
            } catch (_) { }
        },

        async fetchTestAssignments(testId) {
            const tid = Number(testId);
            if (!tid) return;
            try {
                const r = await api.get('/student-exam-assignments', { params: { exam_id: tid } });
                const list = Array.isArray(r?.data?.data) ? r.data.data
                    : (Array.isArray(r?.data) ? r.data : []);

                for (const a of list) {
                    const aid = Number(a.id ?? 0);
                    const sid = Number(a.student_id ?? a.studentId ?? a.student?.id ?? 0);
                    if (!aid || !sid) continue;

                    const status = this._normalizeStatus(a.status);
                    const examName = a.exam?.name || a.exam?.title || a.exam?.exam_name
                        || a.exam?.test_name || a.exam?.description || a.name || `Exam ${tid}`;

                    const idx = this.studentTests.findIndex(st => Number(st.assignmentId) === aid);
                    const row = {
                        studentId: sid,
                        testId: tid,
                        assignmentId: aid,
                        name: examName,
                        status,
                        score: status === 'Completed' ? (a.score ?? null) : null,
                        rawScore: status === 'Completed' ? (a.raw_score ?? null) : null,
                        totalQuestions: status === 'Completed' ? (a.total_questions ?? null) : null,
                        durationSeconds: status === 'Completed' ? (a.time_spent ?? null) : null,
                        completedAt: status === 'Completed' ? (a.completed_at ?? null) : null,
                        answers: (idx !== -1 && this.studentTests[idx].answers) ? this.studentTests[idx].answers : {}
                    };

                    if (idx === -1) this.studentTests.push(row);
                    else this.studentTests[idx] = { ...this.studentTests[idx], ...row };
                }
            } catch (err) {
                console.warn('[testStore] fetchTestAssignments failed:', err?.response?.data?.message || err.message);
            }
        },

        assignStudentsToTest(testId, studentIds, testDetails) {
            const existingIds = this.studentTests.filter(st => st.testId === testId).map(st => st.studentId);
            studentIds.filter(id => !existingIds.includes(id)).forEach(studentId => {
                this.studentTests.push({
                    studentId, testId, name: testDetails.name,
                    status: 'Not Started', score: null, answers: {},
                    startedAt: null, completedAt: null
                });
            });
        },

        unassignStudentsFromTest(testId) {
            this.studentTests = this.studentTests.filter(st => st.testId !== testId);
        },

        unassignStudentFromTest(testId, studentId) {
            this.studentTests = this.studentTests.filter(
                st => !(st.testId === testId && st.studentId === studentId)
            );
        },

        getAssignmentId(testId, studentId) {
            const st = this.studentTests.find(
                s => Number(s.testId) === Number(testId) && Number(s.studentId) === Number(studentId)
            );
            return st?.assignmentId ? Number(st.assignmentId) : null;
        },

        // ─── Status helpers ────────────────────────────────────────────────────

        _normalizeStatus(raw) {
            const s = String(raw ?? '').toLowerCase().trim();
            if (!s) return 'Not Started';
            if (s === 'completed' || s === 'complete' || s === 'done' || s === 'finished' || s === '3') return 'Completed';
            if (s === 'in_progress' || s === 'in progress' || s === 'started' || s === 'ongoing' || s === '2') return 'In Progress';
            if (s === 'expired' || s === 'expire' || s === '4') return 'Expired';
            if (s.includes('complete')) return 'Completed';
            if (s.includes('progress') || s.includes('start')) return 'In Progress';
            if (s.includes('expire')) return 'Expired';
            return 'Not Started';
        },

        async refreshAssignmentStatus(assignmentId, studentId, testId) {
            if (!assignmentId || !studentId || !testId) return;
            try {
                const r = await api.get(`/student-exam-assignments/${assignmentId}/status`);
                const raw = r?.data?.status ?? r?.data?.data?.status ?? null;
                if (!raw) return;
                const idx = this.studentTests.findIndex(st => Number(st.assignmentId) === Number(assignmentId));
                if (idx !== -1) this.studentTests[idx].status = this._normalizeStatus(raw);
            } catch (_) { }
        },

        async checkExamStatus(assignmentId) {
            if (!assignmentId) return null;
            try {
                const res = await api.get(`/student-exam-assignments/${Number(assignmentId)}/status`);
                return res?.data?.status ?? res?.data ?? null;
            } catch (e) {
                console.error('Failed to check exam status:', e);
                return null;
            }
        },

        // ─── Answers ──────────────────────────────────────────────────────────

        async persistAnswer(assignmentId, questionId, answer) {
            if (!assignmentId || !questionId) return;
            try {
                await api.post('/student-answers', {
                    assignment_id: Number(assignmentId),
                    question_id: Number(questionId),
                    answer_value: String(answer)
                });
            } catch (err) {
                console.warn(`persistAnswer failed (q${questionId}):`, err?.response?.data?.message || err.message);
            }
        },

        async loadExistingAnswers(assignmentId, testId) {
            const questionStore = useQuestionStore();
            const authStore = useAuthStore();
            const sid = authStore.user
                ? Number(authStore.user.student?.id ?? authStore.user.student_id ?? authStore.user.id)
                : null;
            let list = [];
            try {
                const r = await api.get(`/student-answers/check/${Number(assignmentId)}`);
                list = Array.isArray(r?.data?.answers) ? r.data.answers
                    : Array.isArray(r?.data?.data) ? r.data.data
                        : Array.isArray(r?.data) ? r.data
                            : [];
            } catch (_) { }

            const answers = {};
            for (const it of list) {
                const qid = Number(it.question_id || it.question?.id || 0);
                if (!qid) continue;
                const raw = it.answer_value != null ? String(it.answer_value) : '';
                const q = questionStore.questions.find(qx => Number(qx.id) === qid);
                if (!q) continue;
                if (q.type === 'Multiple Choice') {
                    const idx = Array.isArray(q.options)
                        ? q.options.findIndex(o => o?.text != null && String(o.text).trim().toLowerCase() === raw.trim().toLowerCase())
                        : -1;
                    if (idx >= 0) answers[qid] = idx;
                    else if (!Number.isNaN(Number(raw))) answers[qid] = Number(raw);
                } else if (q.type === 'True or False') {
                    const val = raw.trim().toLowerCase();
                    answers[qid] = (val === 'true' || val === '1') ? 'True' : 'False';
                } else {
                    answers[qid] = raw;
                }
            }

            if (sid) {
                const idx = this.studentTests.findIndex(
                    s => Number(s.testId) === Number(testId) && Number(s.studentId) === Number(sid)
                );
                if (idx >= 0) {
                    const merged = { ...this.studentTests[idx].answers, ...answers };
                    const status = this.studentTests[idx].status === 'Not Started' && Object.keys(merged).length > 0
                        ? 'In Progress' : this.studentTests[idx].status;
                    this.studentTests[idx] = { ...this.studentTests[idx], answers: merged, status };
                }
            }
            return answers;
        },

        // ─── Active test / timer ───────────────────────────────────────────────

        setActiveTest(test) {
            const questionStore = useQuestionStore();
            const authStore = useAuthStore();

            const sid = authStore.user
                ? Number(authStore.user.student?.id ?? authStore.user.student_id ?? authStore.user.id)
                : null;

            const st = sid
                ? this.studentTests.find(
                    s => Number(s.testId) === Number(test.id) && Number(s.studentId) === sid
                )
                : null;

            if (st?.status === 'Completed') return false;

            const questions = (test.questionIds ?? [])
                .map(id => questionStore.questions.find(q => Number(q.id) === Number(id)))
                .filter(Boolean);

            console.log('[setActiveTest] mapped questions:', questions.length, questions.map(q => ({ id: q.id, text: q.text, type: q.type, optionsCount: q.options?.length })));

            this.currentTest = {
                ...test,
                questions,
                currentIndex: 0,
                remainingTime: (test.timeLimit || 60) * 60,
                answers: { ...(st?.answers || {}) }
            };
            this.reviewMode = false;
            this.startTimer();
            return true;
        },

        async setActiveTestById(examId) {
            const questionStore = useQuestionStore();
            const pilotTest = this.pilotTests.find(t => Number(t.id) === Number(examId));

            if (!pilotTest) return false;

            if (!pilotTest.questionIds?.length) {
                try {
                    const { data } = await api.get(`/exam-questions/${examId}`);
                    const questionsData = data?.questionList || data?.questions || data?.data || [];

                    if (questionsData && questionsData.length) {
                        const questionIds = [];

                        for (const item of questionsData) {
                            const base = item?.question || item;
                            const qid = Number(base?.id || item?.question_id || 0);
                            if (!qid) continue;

                            questionIds.push(qid);

                            const question = this._buildQuestionPayload(base, null);

                            const existing = questionStore.questions.find(x => Number(x.id) === qid);
                            if (existing) {
                                questionStore.updateQuestion(question);
                            } else {
                                questionStore.addQuestion(question);
                            }
                        }

                        pilotTest.questionIds = questionIds;
                    }
                } catch (e) {
                    console.error('Failed to fetch exam questions from API:', e);
                    return false;
                }
            }

            return this.setActiveTest(pilotTest);
        },

        startTimer() {
            if (this.timerInterval) clearInterval(this.timerInterval);
            this.timerInterval = setInterval(() => {
                if (this.currentTest && this.currentTest.remainingTime > 0) {
                    this.currentTest.remainingTime--;
                } else {
                    this.stopTimer();
                }
            }, 1000);
        },

        stopTimer() {
            if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
        },

        nextQuestion() {
            if (this.currentTest && this.currentTest.currentIndex < this.currentTest.questions.length - 1) {
                this.currentTest.currentIndex++;
            }
        },
        prevQuestion() {
            if (this.currentTest && this.currentTest.currentIndex > 0) {
                this.currentTest.currentIndex--;
            }
        },
        jumpToQuestion(index) {
            if (this.currentTest && index >= 0 && index < this.currentTest.questions.length) {
                this.currentTest.currentIndex = index;
            }
        },

        // ─── Exam lifecycle ────────────────────────────────────────────────────

        async startExamAction(assignmentId) {
            try {
                await api.patch(`/student-exam-assignments/${assignmentId}/start`);
            } catch (e) {
                console.error('Error starting exam on server:', e);
            }
        },

        async completeExamAction(assignmentId, score, questionTimes = {}, durationSeconds = 0) {
            try {
                await api.patch(`/student-exam-assignments/${assignmentId}/complete`, {
                    score,
                    question_times:   questionTimes,
                    duration_seconds: durationSeconds,
                });
            } catch (e) {
                console.error('Error completing exam on server:', e);
            }
        },

        submitTest(testId, studentId, answers, score, questionTimes = {}) {
            this.stopTimer();
            const test = this.studentTests.find(
                st => Number(st.testId) === Number(testId) && Number(st.studentId) === Number(studentId)
            );
            if (test) {
                const limitMin = Number(this.pilotTests.find(pt => Number(pt.id) === Number(testId))?.timeLimit) || 60;
                const remaining = Number.isFinite(this.currentTest?.remainingTime) ? this.currentTest.remainingTime : limitMin * 60;
                const spent = Math.max(0, (limitMin * 60) - remaining);
                Object.assign(test, {
                    status: 'Completed', answers, score,
                    durationSeconds: spent,
                    questionTimes,
                    completedAt: new Date().toISOString()
                });
                if (test.assignmentId) {
                    this.completeExamAction(test.assignmentId, score, questionTimes, spent);
                    setTimeout(async () => {
                        try {
                            const res = await api.get(`/student-answers/check/${test.assignmentId}`);
                            const d = res?.data ?? {};
                            if (!d.completed) return;
                            let rawScore = Number(d.score || d.raw_score || d.correct || 0);
                            const total = Number(d.total || d.total_questions || 0);
                            if (total > 0 && rawScore > total) rawScore = Math.round((rawScore / 100) * total);
                            const percent = total > 0 ? Math.round((rawScore / total) * 100) : 0;
                            const timeSpent = Number(d.time_spent || 0);
                            const idx = this.studentTests.findIndex(
                                s => Number(s.testId) === Number(testId) && Number(s.studentId) === Number(studentId)
                            );
                            if (idx !== -1) {
                                this.studentTests[idx] = {
                                    ...this.studentTests[idx],
                                    score: percent, rawScore,
                                    totalQuestions: total,
                                    durationSeconds: timeSpent || spent
                                };
                            }
                        } catch (_) { }
                    }, 2000);
                }
            }
            this.currentTest = null;
            this.reviewMode = false;
        },

        async fetchReportsData() {
            try {
                const { data } = await api.get('/exams');
                const exams = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
                exams.forEach(ex => {
                    const qidsRaw = ex.question_id || (ex.exam_questions || []).map(eq => eq.question_id || eq.id);
                    const qids = Array.isArray(qidsRaw) ? [...new Set(qidsRaw.map(Number))] : [];
                    const s = (ex.status || '').toString().toLowerCase();
                    const statusLabel = s === 'active' || s === 'approved' ? 'Active'
                        : s === 'pending review' || s === 'pending' ? 'Pending Review'
                            : s === 'completed' ? 'Completed' : 'Pending Review';
                    this.addTest({
                        id: Number(ex.id),
                        name: ex.name || ex.title || ex.exam_name || ex.test_name || ex.description || `Exam ${ex.id}`,
                        description: ex.description || '',
                        term: ex.terms || ex.term || 'Midterm',
                        timeLimit: Number(ex.time_limit || 60),
                        questionIds: qids,
                        status: statusLabel
                    });
                });
            } catch (_) { }

            let assignments = [];
            try {
                const r = await api.get('/student-exam-assignments');
                const raw = r?.data?.data ?? r?.data ?? [];
                assignments = Array.isArray(raw) ? raw : [];
            } catch (_) { assignments = []; }

            for (const a of assignments) {
                const aid = Number(a.id ?? 0);
                const sid = Number(a.student_id ?? a.studentId ?? a.student?.id ?? 0);
                const eid = Number(a.exam_id ?? a.examId ?? a.exam?.id ?? 0);
                if (!aid || !sid || !eid) continue;
                const status = this._normalizeStatus(a.status);
                const directScore = a.score ?? a.percentage ?? null;
                const directRaw = a.raw_score ?? a.correct_count ?? null;
                const directTotal = a.total_questions ?? a.total_items ?? a.total ?? null;
                const directDur = a.time_spent ?? a.duration_seconds ?? a.elapsed_seconds ?? null;
                const percent = directScore != null ? Math.round(Number(directScore))
                    : (directRaw != null && directTotal ? Math.round((Number(directRaw) / Number(directTotal)) * 100) : null);
                const examName = a.exam?.name || a.exam?.title || a.exam?.description
                    || this.pilotTests.find(t => Number(t.id) === eid)?.name || `Exam ${eid}`;
                const row = {
                    studentId: sid, testId: eid, assignmentId: aid, name: examName, status,
                    score: status === 'Completed' ? percent : null,
                    rawScore: status === 'Completed' ? (directRaw != null ? Number(directRaw) : null) : null,
                    totalQuestions: status === 'Completed' ? (directTotal != null ? Number(directTotal) : null) : null,
                    durationSeconds: status === 'Completed' ? (directDur != null ? Number(directDur) : null) : null,
                    completedAt: status === 'Completed' ? (a.completed_at ?? null) : null,
                    answers: {}
                };
                const idx = this.studentTests.findIndex(st => Number(st.assignmentId) === aid);
                if (idx === -1) this.studentTests.push(row);
                else this.studentTests[idx] = { ...this.studentTests[idx], ...row };
            }

            const examIds = [...new Set([
                ...this.pilotTests.map(t => Number(t.id)),
                ...this.studentTests.map(st => Number(st.testId))
            ])].filter(Boolean);

            await Promise.allSettled(examIds.map(async eid => {
                try {
                    const r = await api.get('/get-student', { params: { exam_id: eid } });
                    const list = Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : []);
                    for (const item of list) {
                        const sid = Number(item.student_id ?? item.student?.id ?? item.id ?? 0);
                        if (!sid) continue;
                        const isAssigned = item.is_assigned === true || item.is_assigned === 1
                            || item.is_assigned === '1'
                            || String(item.is_assigned).toLowerCase() === 'true';
                        if (!isAssigned) continue;
                        const itemStatus = this._normalizeStatus(item.status ?? 'Not Started');
                        const rawScore = Number(item.score ?? item.raw_score ?? item.correct ?? 0) || null;
                        const total = Number(item.total ?? item.total_questions ?? item.total_items ?? 0) || null;
                        const percent = rawScore && total ? Math.round((rawScore / total) * 100) : null;
                        const timeSpent = Number(item.time_spent ?? item.duration ?? 0) || null;
                        const completedAt = item.completed_at ?? null;
                        const assignmentId = Number(item.assignment_id ?? item.id ?? 0) || null;
                        const examName = this.pilotTests.find(t => Number(t.id) === eid)?.name || `Exam ${eid}`;
                        const stIdx = this.studentTests.findIndex(st => Number(st.testId) === eid && Number(st.studentId) === sid);
                        const prev = stIdx >= 0 ? this.studentTests[stIdx] : {};
                        const rowData = {
                            studentId: sid, testId: eid,
                            assignmentId: assignmentId ?? prev.assignmentId ?? null,
                            name: examName, status: itemStatus,
                            score: percent ?? prev.score ?? null,
                            rawScore: rawScore ?? prev.rawScore ?? null,
                            totalQuestions: total ?? prev.totalQuestions ?? null,
                            durationSeconds: timeSpent ?? prev.durationSeconds ?? null,
                            completedAt: completedAt ?? prev.completedAt ?? null,
                            answers: prev.answers ?? {}
                        };
                        if (stIdx === -1) this.studentTests.push(rowData);
                        else this.studentTests[stIdx] = { ...this.studentTests[stIdx], ...rowData };
                    }
                } catch (_) { }
            }));

            const needsScore = this.studentTests.filter(st => st.status === 'Completed' && st.assignmentId && st.score == null);
            await Promise.allSettled(needsScore.map(async st => {
                try {
                    const res = await api.get(`/student-answers/check/${st.assignmentId}`);
                    const d = res?.data ?? {};
                    const isCompleted = d.completed === true || d.completed === 1 || d.status === 'completed' || d.score != null;
                    if (!isCompleted) return;
                    const rawScore = Number(d.score ?? d.raw_score ?? d.correct ?? 0);
                    const total = Number(d.total ?? d.total_questions ?? d.total_items ?? 0);
                    const percent = total > 0 ? Math.round((rawScore / total) * 100) : (rawScore <= 100 ? rawScore : 0);
                    const timeSpent = Number(d.time_spent ?? d.duration ?? d.elapsed ?? 0);
                    const answers = {};
                    const answerList = Array.isArray(d.answers) ? d.answers : (Array.isArray(d.data) ? d.data : []);
                    answerList.forEach(a => {
                        if (a.question_id == null) return;
                        const entry = {
                            answer_value: a.answer_value ?? '',
                            is_correct: a.is_correct === true || a.is_correct === 1 || a.is_correct === '1' || a.is_correct === 'true'
                        };
                        answers[Number(a.question_id)] = entry;
                        answers[String(a.question_id)] = entry;
                    });
                    const idx = this.studentTests.findIndex(x => Number(x.assignmentId) === Number(st.assignmentId));
                    if (idx !== -1) {
                        this.studentTests[idx] = {
                            ...this.studentTests[idx],
                            status: 'Completed', score: percent, rawScore,
                            totalQuestions: total || this.studentTests[idx].totalQuestions,
                            durationSeconds: timeSpent || this.studentTests[idx].durationSeconds,
                            completedAt: d.completed_at ?? this.studentTests[idx].completedAt,
                            answers: Object.keys(answers).length ? answers : this.studentTests[idx].answers
                        };
                    }
                } catch (_) { }
            }));

            const completedExamIds = [...new Set(
                this.studentTests.filter(st => st.status === 'Completed').map(st => Number(st.testId))
            )];
            for (const eid of completedExamIds) {
                const t = this.pilotTests.find(p => Number(p.id) === eid);
                if (!t?.questionIds?.length) {
                    try { await this.ensureTestReady(eid); } catch (_) { }
                }
            }
        },

        async fetchStudentPerformanceReport() {
            try {
                const response = await api.get('/studentPerformance');
                const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
                this.studentPerformanceReport = data.map(item => {
                    let normalizedTimeSpent = 0;
                    const ts = item.time_spent;
                    if (ts != null && ts !== '') {
                        if (typeof ts === 'number') { normalizedTimeSpent = ts; }
                        else if (String(ts).includes(':')) {
                            const parts = String(ts).split(':').map(Number);
                            if (parts.length === 3) normalizedTimeSpent = parts[0] * 3600 + parts[1] * 60 + parts[2];
                            else if (parts.length === 2) normalizedTimeSpent = parts[0] * 60 + parts[1];
                        } else { normalizedTimeSpent = parseInt(ts) || 0; }
                    }
                    let rawScore = Number(item.raw_score ?? item.score ?? item.correct ?? 0);
                    const total = Number(item.total ?? item.total_questions ?? item.exam_questions ?? 0);
                    let percent = Number(item.score ?? 0);
                    if (total > 0 && rawScore > total) {
                        rawScore = Math.round((rawScore / 100) * total);
                        percent = Math.round(rawScore / total * 100);
                    } else if (total > 0 && percent <= total && percent === rawScore) {
                        percent = Math.round((rawScore / total) * 100);
                    } else if (percent > 0 && percent <= 100) {
                        percent = Math.round(percent);
                    }
                    return {
                        ...item,
                        score: percent,
                        rawScore: rawScore,
                        raw_score: rawScore,
                        totalQuestions: total,
                        total: total,
                        time_spent: normalizedTimeSpent
                    };
                });
            } catch (e) {
                console.error('Failed to fetch student performance report:', e);
            }
        },

        async ensureQuestionsLoadedByIds(questionIds = []) {
            if (!questionIds?.length) return;
            const questionStore = useQuestionStore();
            const missingIds = questionIds.filter(id => !questionStore.questions.find(q => Number(q.id) === Number(id)));
            if (!missingIds.length) return;

            console.log(`[ensureQuestionsLoadedByIds] ${missingIds.length} questions missing from store.`);

            await Promise.allSettled(missingIds.map(async id => {
                try {
                    const r = await api.get(`/questions/${id}`);
                    const q = r?.data?.data || r?.data;
                    if (q) {
                        const payload = this._buildQuestionPayload(q);
                        questionStore.addQuestion(payload);
                    }
                } catch (e) {
                    console.warn(`Failed to fetch question ${id}:`, e);
                }
            }));
        },

        async fetchAssignmentResult(assignmentId) {
            if (!assignmentId) return null;
            try {
                const res = await api.get(`/check-assignment/${Number(assignmentId)}`);
                return res?.data ?? null;
            } catch (_) { return null; }
        },

        async fetchCompletedResultsForAssignments() {
            for (const st of this.studentTests) {
                const aid = Number(st.assignmentId || 0);
                if (!aid) continue;
                const status = await this.checkExamStatus(aid);
                if (!status) continue;
                const normalized = this._normalizeStatus(status);
                const idx = this.studentTests.findIndex(x => Number(x.assignmentId) === aid);
                if (idx !== -1) this.studentTests[idx].status = normalized;
                if (normalized !== 'Completed') continue;
                const result = await this.fetchAssignmentResult(aid);
                if (!result) continue;
                let rawScore = Number(result.score || result.raw_score || result.correct || 0);
                const total = Number(result.total || result.total_questions || 0);
                if (total > 0 && rawScore > total) rawScore = Math.round((rawScore / 100) * total);
                const percent = total ? Math.round((rawScore / total) * 100) : 0;
                const completedAt = result.completed_at || result.updated_at || null;
                const answers = result.answers || (idx !== -1 ? this.studentTests[idx].answers : {});
                if (idx !== -1) {
                    this.studentTests[idx] = {
                        ...this.studentTests[idx],
                        score: percent, rawScore, totalQuestions: total, completedAt, answers
                    };
                }
            }
        }
    }
}, {
    persist: { paths: ['currentTest', 'studentTests', 'pilotTests'] }
});