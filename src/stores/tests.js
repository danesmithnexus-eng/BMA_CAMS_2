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
        addTest(test) {
            if (!test.id) test.id = Date.now();
            const idx = this.pilotTests.findIndex(t => t.id === test.id);
            if (idx >= 0) {
                this.pilotTests[idx] = { ...this.pilotTests[idx], ...test };
            } else {
                this.pilotTests.push(test);
            }
        },
        assignTest(assignment) {
            this.studentTests.push(assignment);
        },
        updateStudentTestStatus(testId, studentId, status) {
            const test = this.studentTests.find(st => Number(st.testId) === Number(testId) && Number(st.studentId) === Number(studentId));
            if (test) test.status = status;
        },
        approveTest(testId) {
            const tid = Number(testId);
            const test = this.pilotTests.find(t => Number(t.id) === tid);
            if (test) test.status = 'Active';
        },
        async fetchStudentAssignments(studentId) {
            const sid = Number(studentId);
            if (!sid) return;
            let list = [];
            try {
                const r = await api.get('/student-exam-assignments', { params: { student_id: sid, studentId: sid, userId: sid } });
                list = Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : []);
            } catch (_) { }
            if (!Array.isArray(list) || list.length === 0) {
                try {
                    const r2 = await api.get(`/get-assigned-questions/${sid}`);
                    const raw = Array.isArray(r2?.data?.data) ? r2.data.data : (Array.isArray(r2?.data) ? r2.data : []);
                    const uniq = new Map();
                    for (const it of (raw || [])) {
                        const ex = it.exam || it;
                        const eid = Number(ex?.id || ex?.exam_id || 0);
                        if (!eid) continue;
                        const aid = Number(it.id || it.assignment_id || 0) || undefined;
                        const name = ex?.name || ex?.description || `Exam ${eid}`;
                        const description = ex?.description || '';
                        if (!this.pilotTests.find(t => Number(t.id) === eid)) {
                            const qids = Array.isArray(ex?.exam_questions) ? ex.exam_questions.map(eq => Number(eq.question_id || eq.id)).filter(Boolean) : [];
                            this.addTest({ id: eid, name, description, questionIds: qids });
                        }
                        if (!this.studentTests.find(st => Number(st.testId) === eid && Number(st.studentId) === sid)) {
                            this.studentTests.push({
                                studentId: sid,
                                testId: eid,
                                name,
                                description,
                                questionIds: [],
                                status: 'Not Started',
                                score: null,
                                answers: {},
                                assignmentId: aid
                            });
                        } else if (aid) {
                            const idx = this.studentTests.findIndex(st => Number(st.testId) === eid && Number(st.studentId) === sid);
                            if (idx >= 0) this.studentTests[idx].assignmentId = aid;
                        }
                        uniq.set(eid, true);
                    }
                    for (const eid of Array.from(uniq.keys())) {
                        try {
                            const rQ = await api.get(`/exam-questions/${eid}`);
                            const root = rQ?.data || null;
                            const exam = root?.examDetails || root?.exam || null;
                            const listQ = Array.isArray(root?.questionList) ? root.questionList : [];
                            const qids = listQ.map(it => Number((it?.question?.id) || it?.id || it?.question_id || 0)).filter(Boolean);
                            const name = exam?.name || exam?.description || `Exam ${eid}`;
                            const description = exam?.description || '';
                            let timeLimit = Number(exam?.time_limit ?? exam?.duration ?? 60);
                            if (!Number.isFinite(timeLimit) || timeLimit <= 0) timeLimit = 60;
                            const idxT = this.pilotTests.findIndex(t => Number(t.id) === Number(eid));
                            if (idxT >= 0) {
                                this.pilotTests[idxT] = { ...this.pilotTests[idxT], name, description, questionIds: qids, timeLimit };
                            } else {
                                this.addTest({ id: eid, name, description, questionIds: qids, timeLimit });
                            }
                        } catch (_) { }
                    }
                } catch (_) { }
            }
            for (const it of (list || [])) {
                const exCandidate = it.exam || it;
                const eid = Number(exCandidate.exam_id || exCandidate.test_id || exCandidate.id);
                if (!eid) continue;
                let name = exCandidate.name || exCandidate.description || '';
                let description = exCandidate.description || '';
                const assignmentId = Number(it.id || it.assignment_id || 0) || undefined;
                if (!this.pilotTests.find(t => Number(t.id) === eid)) {
                    this.addTest({ id: eid, name: name || `Exam ${eid}`, description, questionIds: [] });
                }
                if (!this.studentTests.find(st => Number(st.testId) === eid && Number(st.studentId) === sid)) {
                    const row = {
                        studentId: sid,
                        testId: eid,
                        name: name || `Exam ${eid}`,
                        description,
                        questionIds: [],
                        status: 'Not Started',
                        score: null,
                        answers: {},
                        assignmentId
                    };
                    this.studentTests.push(row);
                    if (assignmentId) {
                        this.refreshAssignmentStatus(assignmentId, sid, eid);
                    }
                } else if (assignmentId) {
                    const idx = this.studentTests.findIndex(
                        st => Number(st.testId) === eid && Number(st.studentId) === sid
                    );
                    if (idx >= 0) {
                        this.studentTests[idx].assignmentId = assignmentId;
                        this.refreshAssignmentStatus(assignmentId, sid, eid);
                    }
                }
            }
            try {
                const ids = this.studentTests.filter(st => Number(st.studentId) === sid).map(st => Number(st.testId));
                const uniqIds = Array.from(new Set(ids));
                for (const eid of uniqIds) {
                    const hasQ = this.pilotTests.find(t => Number(t.id) === eid && Array.isArray(t.questionIds) && t.questionIds.length > 0);
                    if (hasQ) continue;
                    try {
                        const rQ = await api.get(`/exam-questions/${eid}`);
                        const root = rQ?.data || null;
                        const exam = root?.examDetails || root?.exam || null;
                        const listQ = Array.isArray(root?.questionList) ? root.questionList : [];
                        const qids = listQ.map(it => Number((it?.question?.id) || it?.id || it?.question_id || 0)).filter(Boolean);
                        const name = exam?.name || exam?.description || `Exam ${eid}`;
                        const description = exam?.description || '';
                        let timeLimit = Number(exam?.time_limit ?? exam?.duration ?? 60);
                        if (!Number.isFinite(timeLimit) || timeLimit <= 0) timeLimit = 60;
                        const idxT = this.pilotTests.findIndex(t => Number(t.id) === Number(eid));
                        if (idxT >= 0) {
                            this.pilotTests[idxT] = { ...this.pilotTests[idxT], name, description, questionIds: qids, timeLimit };
                        } else {
                            this.addTest({ id: eid, name, description, questionIds: qids, timeLimit });
                        }
                    } catch (_) { }
                }
            } catch (_) { }
        },
        assignStudentsToTest(testId, studentIds, testDetails) {
            const existingStudentIds = this.studentTests.filter(st => st.testId === testId).map(st => st.studentId);
            const newStudentIds = studentIds.filter(id => !existingStudentIds.includes(id));
            newStudentIds.forEach(studentId => {
                this.studentTests.push({
                    studentId: studentId,
                    testId: testId,
                    name: testDetails.name,
                    status: 'Not Started',
                    score: null,
                    answers: {},
                    startedAt: null,
                    completedAt: null
                });
            });
        },
        unassignStudentsFromTest(testId) {
            this.studentTests = this.studentTests.filter(st => st.testId !== testId);
        },
        unassignStudentFromTest(testId, studentId) {
            this.studentTests = this.studentTests.filter(st => !(st.testId === testId && st.studentId === studentId));
        },

        // ─── Helper: resolve question type label from type id or string ──────────
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

        // ─── Helper: build examDetails lookup map from exam_questions array ──────
        _buildExamDetailsLookup(examObj) {
            const map = new Map();
            if (!examObj) return map;
            const eqs = examObj.exam_questions || examObj.examQuestions || [];
            for (const eq of eqs) {
                const q = eq.question || eq;
                const qid = Number(q?.id || eq?.question_id || 0);
                if (qid) map.set(qid, q);
            }
            return map;
        },

        // ─── Helper: build a question payload from raw data ──────────────────────
        _buildQuestionPayload(d, existingQuestion = null) {
            const typeLabel = this._resolveTypeLabel(d);
            let options = [];
            let pairs = [];

            if (typeLabel === 'Multiple Choice') {
                const mc = d.multiple_choice_answers || d.multipleChoiceAnswers || d.options || d.choices || d.answers || [];
                const sorted = Array.isArray(mc)
                    ? [...mc].sort((a, b) => (Number(a.option_order ?? a.order ?? a.index ?? 0) - Number(b.option_order ?? b.order ?? b.index ?? 0)))
                    : [];
                options = sorted.map(a => ({
                    text: a.option_text || a.text || a.answer_text || a.choice_text || a.label || String(a.value ?? '')
                })).filter(o => o.text !== undefined);
                if (options.length === 0 && Array.isArray(mc)) {
                    options = mc.map(v => (typeof v === 'string' ? { text: v } : { text: String(v) }));
                }
            } else if (typeLabel === 'Matching Type') {
                const mp = d.pairs || d.matching_pairs || [];
                pairs = Array.isArray(mp) ? mp.map(p => ({ prompt: p.prompt || p.left || '', answer: p.answer || p.right || '' })) : [];
            }

            const loRaw = d.learning_outcome || '';
            const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';

            const payload = {
                id: Number(d.id),
                text: d.text || d.question_text || '',
                status: 'Approved',
                program: existingQuestion?.program || '',
                course: existingQuestion?.course || '',
                type: typeLabel,
                loTags: loNorm ? [loNorm] : (existingQuestion?.loTags || []),
                cognitiveLevel: d.cognitive_level || existingQuestion?.cognitiveLevel || 'Remembering',
                options,
                pairs
            };

            if (typeLabel === 'Multiple Choice') {
                const mc = d.multiple_choice_answers || d.multipleChoiceAnswers || d.options || d.choices || d.answers || [];
                const sorted = Array.isArray(mc)
                    ? [...mc].sort((a, b) => (Number(a.option_order ?? a.order ?? a.index ?? 0) - Number(b.option_order ?? b.order ?? b.index ?? 0)))
                    : [];
                let correctIndex = sorted.findIndex(a => {
                    const v = a.is_correct ?? a.correct ?? a.isCorrect ?? a.is_right ?? a.isRight ?? a.answer_is_correct;
                    if (typeof v === 'boolean') return v;
                    if (typeof v === 'number') return v === 1;
                    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1' || v.toLowerCase() === 'yes';
                    return false;
                });
                if (correctIndex < 0) {
                    const ci = d.correct_option_index ?? d.correct_index ?? d.answer_index;
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
                    ?? (d.trueFalseAnswer && (d.trueFalseAnswer.is_true ?? d.trueFalseAnswer.answer));
                if (ca !== undefined && ca !== null) {
                    const val = typeof ca === 'boolean' ? ca : (String(ca).toLowerCase() === 'true' || ca === 1 || ca === '1');
                    payload.answer = val ? 'True' : 'False';
                }
            } else if (typeLabel === 'Identification') {
                const ca = d.correct_answer ?? d.answer ?? d.key;
                if (ca !== undefined && ca !== null) payload.answer = String(ca);
            }

            return payload;
        },

        async ensureTestReady(testOrId) {
            const questionStore = useQuestionStore();
            const authStore = useAuthStore();
            const tid = typeof testOrId === 'object' ? Number(testOrId.id) : Number(testOrId);
            if (!tid) return null;

            let test = this.pilotTests.find(t => Number(t.id) === tid) || null;
            let examDetailsMap = new Map();

            if (!test || !Array.isArray(test.questionIds) || test.questionIds.length === 0) {
                try {
                    const rEarly = await api.get(`/exam-questions/${tid}`);
                    const rootEarly = rEarly?.data || null;
                    const examEarly = rootEarly?.examDetails || rootEarly?.exam || null;
                    const listEarly = Array.isArray(rootEarly?.questionList) ? rootEarly.questionList : [];

                    // FIX: Build a lookup from examDetails.exam_questions so we can
                    // enrich questionList items whose text/type are null from the backend.
                    const examDetailsLookup = this._buildExamDetailsLookup(examEarly);

                    if (examEarly || listEarly.length > 0) {
                        const qidsE = [];
                        const detailsE = [];
                        for (const it of listEarly) {
                            const base = it?.question || it;
                            const qid = Number(base?.id || it?.question_id || it?.id || 0);
                            if (qid && !qidsE.includes(qid)) qidsE.push(qid);
                            if (qid) {
                                // FIX: Merge examDetails data (has text/type) over questionList
                                // data (which may have null text/type) so we always get full info.
                                const fromDetails = examDetailsLookup.get(qid);
                                const norm = fromDetails
                                    ? { ...base, ...fromDetails }
                                    : { ...base };

                                if (!norm.multiple_choice_answers && Array.isArray(base?.multipleChoiceAnswers)) {
                                    norm.multiple_choice_answers = base.multipleChoiceAnswers.map(a => ({
                                        option_text: a.option_text || a.text || a.answer_text || a.choice_text || a.label || String(a.value ?? ''),
                                        is_correct: a.is_correct ?? a.correct ?? a.isCorrect ?? a.is_right ?? a.isRight ?? a.answer_is_correct ?? a.isTrue ?? a.is_true
                                    }));
                                }
                                if (!norm.correct_answer && base?.trueFalseAnswer) {
                                    const v = base.trueFalseAnswer.is_true ?? base.trueFalseAnswer.answer ?? base.trueFalseAnswer.value;
                                    norm.correct_answer = v;
                                }
                                examDetailsMap.set(qid, norm);
                                detailsE.push(norm);
                            }
                        }
                        const nameE = examEarly?.name || examEarly?.description || `Exam ${tid}`;
                        const descriptionE = examEarly?.description || '';
                        let timeLimitE = Number(examEarly?.time_limit ?? examEarly?.duration ?? 60);
                        if (!Number.isFinite(timeLimitE) || timeLimitE <= 0) timeLimitE = 60;
                        if (!this.pilotTests.find(t => Number(t.id) === tid)) {
                            this.addTest({ id: tid, name: nameE, description: descriptionE, questionIds: qidsE, timeLimit: timeLimitE });
                        } else {
                            const idx = this.pilotTests.findIndex(t => Number(t.id) === tid);
                            if (idx >= 0) this.pilotTests[idx] = { ...this.pilotTests[idx], name: nameE, description: descriptionE, questionIds: qidsE, timeLimit: timeLimitE };
                        }
                        test = this.pilotTests.find(t => Number(t.id) === tid) || { id: tid, name: nameE, description: descriptionE, questionIds: qidsE, timeLimit: timeLimitE };
                        for (const d of detailsE) {
                            const payload = this._buildQuestionPayload(d);
                            const existing = questionStore.questions.find(q => Number(q.id) === Number(payload.id));
                            if (existing) questionStore.updateQuestion({ ...existing, ...payload });
                            else questionStore.addQuestion(payload);
                        }
                    }
                } catch (_) { }

                if (test && Array.isArray(test.questionIds) && test.questionIds.length > 0) {
                    // already populated
                } else {
                    const user = authStore.user;
                    const sid = user
                        ? Number(
                            (user.student && user.student.id) ? user.student.id :
                                (user.student_id != null ? user.student_id : user.id)
                        )
                        : null;
                    if (sid) {
                        try {
                            let list = [];
                            const rA = await api.get(`/get-assigned-questions/${sid}`);
                            list = Array.isArray(rA?.data?.data) ? rA.data.data : (Array.isArray(rA?.data) ? rA.data : []);
                            const match = (list || []).find(it => {
                                const exId = Number(it?.exam?.id || it?.exam_id || it?.examId || 0);
                                return exId === tid;
                            });
                            if (match && match.exam) {
                                const assignmentId = Number(match.id || match.assignment_id || 0) || undefined;
                                const ex = match.exam;
                                const eqs = ex.exam_questions || ex.examQuestions || [];
                                const details = [];
                                const qids = [];
                                (eqs || []).forEach(eq => {
                                    const qobj = eq.question || eq;
                                    const qid = Number(qobj?.id || eq?.question_id || eq?.id || 0);
                                    if (qid && !qids.includes(qid)) qids.push(qid);
                                    if (qid) {
                                        examDetailsMap.set(qid, qobj);
                                        details.push(qobj);
                                    }
                                });
                                const name = ex.name || ex.description || (test?.name || `Exam ${tid}`);
                                const description = ex.description || (test?.description || '');
                                if (!this.pilotTests.find(t => Number(t.id) === tid)) {
                                    this.addTest({ id: tid, name, description, questionIds: qids });
                                } else {
                                    const idx = this.pilotTests.findIndex(t => Number(t.id) === tid);
                                    if (idx >= 0) this.pilotTests[idx] = { ...this.pilotTests[idx], name, description, questionIds: qids };
                                }
                                test = this.pilotTests.find(t => Number(t.id) === tid) || { id: tid, name, description, questionIds: qids };
                                if (assignmentId) {
                                    const sidx = this.studentTests.findIndex(st => Number(st.studentId) === Number(sid) && Number(st.testId) === Number(tid));
                                    if (sidx >= 0) this.studentTests[sidx] = { ...this.studentTests[sidx], assignmentId };
                                }
                                for (const d of details) {
                                    const payload = this._buildQuestionPayload(d);
                                    const existing = questionStore.questions.find(q => Number(q.id) === Number(payload.id));
                                    if (existing) questionStore.updateQuestion({ ...existing, ...payload });
                                    else questionStore.addQuestion(payload);
                                }
                            }
                        } catch (_) { }
                    }
                }
            }

            if (!test || !Array.isArray(test.questionIds) || test.questionIds.length === 0) {
                try {
                    const r1 = await api.get(`/exams/${tid}`);
                    const ex = r1?.data?.data || r1?.data || null;
                    if (ex) {
                        const qidsRaw = ex.question_id || (ex.exam_questions || []).map(eq => eq.question_id || eq.id);
                        const qids = Array.isArray(qidsRaw) ? [...new Set(qidsRaw.map(Number))] : [];
                        const name = ex.name || ex.description || `Exam ${tid}`;
                        const description = ex.description || '';
                        let timeLimit = Number(ex.time_limit ?? ex.duration ?? ex.timeLimit ?? 60);
                        if (!Number.isFinite(timeLimit) || timeLimit <= 0) timeLimit = 60;
                        const creatorName =
                            ex.created_by ||
                            ex.creator_name ||
                            (ex.creator && [ex.creator.fname, ex.creator.lname].filter(Boolean).join(' ')) ||
                            (ex.user && [ex.user.fname, ex.user.lname].filter(Boolean).join(' ')) ||
                            (typeof ex.created_by === 'string' ? ex.created_by : null) ||
                            null;
                        this.addTest({ id: tid, name, description, questionIds: qids, timeLimit, creatorName });
                        test = this.pilotTests.find(t => Number(t.id) === tid) || { id: tid, name, description, questionIds: qids };
                        if (Array.isArray(ex.exam_questions)) {
                            ex.exam_questions.forEach(eq => {
                                const qid = Number(eq.question_id || eq.id);
                                const qobj = eq.question || eq;
                                if (qid) examDetailsMap.set(qid, qobj);
                            });
                        }
                    }
                } catch (_) { }
            }

            if (!test || !Array.isArray(test.questionIds) || test.questionIds.length === 0) {
                try {
                    const r2 = await api.get(`/exam-questions/${tid}`);
                    const root = r2?.data || null;
                    const exam = root?.examDetails || root?.exam || null;
                    const list = Array.isArray(root?.questionList) ? root.questionList : [];

                    // FIX: Build lookup from examDetails so null text/type in
                    // questionList gets filled in from the richer examDetails source.
                    const examDetailsLookup2 = this._buildExamDetailsLookup(exam);

                    if (exam || list.length > 0) {
                        const qids = [];
                        const details = [];
                        for (const it of list) {
                            const base = it?.question || it;
                            const qid = Number(base?.id || it?.question_id || it?.id || 0);
                            if (qid && !qids.includes(qid)) qids.push(qid);
                            if (qid) {
                                // FIX: Merge examDetails data over the (possibly null) questionList data.
                                const fromDetails = examDetailsLookup2.get(qid);
                                const norm = fromDetails
                                    ? { ...base, ...fromDetails }
                                    : { ...base };

                                if (!norm.multiple_choice_answers && Array.isArray(base?.multipleChoiceAnswers)) {
                                    norm.multiple_choice_answers = base.multipleChoiceAnswers.map(a => ({
                                        option_text: a.option_text || a.text || a.answer_text || a.choice_text || a.label || String(a.value ?? ''),
                                        is_correct: a.is_correct ?? a.correct ?? a.isCorrect ?? a.is_right ?? a.isRight ?? a.answer_is_correct ?? a.isTrue ?? a.is_true
                                    }));
                                }
                                if (!norm.correct_answer && base?.trueFalseAnswer) {
                                    const v = base.trueFalseAnswer.is_true ?? base.trueFalseAnswer.answer ?? base.trueFalseAnswer.value;
                                    norm.correct_answer = v;
                                }
                                examDetailsMap.set(qid, norm);
                                details.push(norm);
                            }
                        }
                        const name = exam?.name || exam?.description || `Exam ${tid}`;
                        const description = exam?.description || '';
                        let timeLimit = Number(exam?.time_limit ?? exam?.duration ?? 60);
                        if (!Number.isFinite(timeLimit) || timeLimit <= 0) timeLimit = 60;
                        if (!this.pilotTests.find(t => Number(t.id) === tid)) {
                            this.addTest({ id: tid, name, description, questionIds: qids, timeLimit });
                        } else {
                            const idx = this.pilotTests.findIndex(t => Number(t.id) === tid);
                            if (idx >= 0) this.pilotTests[idx] = { ...this.pilotTests[idx], name, description, questionIds: qids, timeLimit };
                        }
                        test = this.pilotTests.find(t => Number(t.id) === tid) || { id: tid, name, description, questionIds: qids, timeLimit };
                        for (const d of details) {
                            const payload = this._buildQuestionPayload(d);
                            const existing = questionStore.questions.find(q => Number(q.id) === Number(payload.id));
                            if (existing) questionStore.updateQuestion({ ...existing, ...payload });
                            else questionStore.addQuestion(payload);
                        }
                    }
                } catch (_) { }
            }

            if (!test || !Array.isArray(test.questionIds) || test.questionIds.length === 0) return test || null;

            for (const qid of test.questionIds) {
                const existing = questionStore.questions.find(q => Number(q.id) === Number(qid));
                const needsLoad = !existing || (
                    (existing.type === 'Multiple Choice' && (!Array.isArray(existing.options) || existing.options.length === 0)) ||
                    (existing.type === 'Matching Type' && (!Array.isArray(existing.pairs) || existing.pairs.length === 0))
                );
                if (!needsLoad) continue;
                try {
                    const res = await api.get(`/questions/${qid}`);
                    const d = res?.data?.data || res?.data || null;
                    if (!d) continue;
                    const payload = this._buildQuestionPayload(d, existing);
                    if (existing) questionStore.updateQuestion(payload);
                    else questionStore.addQuestion(payload);
                } catch (_) {
                    const fromExam = examDetailsMap.get(Number(qid));
                    if (fromExam) {
                        const payload = this._buildQuestionPayload(fromExam, existing);
                        if (existing) questionStore.updateQuestion(payload);
                        else questionStore.addQuestion(payload);
                    }
                }
            }

            const userForAid = authStore.user;
            const sidForAid = userForAid
                ? Number(
                    (userForAid.student && userForAid.student.id) ? userForAid.student.id :
                        (userForAid.student_id != null ? userForAid.student_id : userForAid.id)
                )
                : null;
            const aid = sidForAid ? this.getAssignmentId(tid, Number(sidForAid)) : null;
            if (aid) {
                try {
                    await this.loadExistingAnswers(Number(aid), Number(tid));
                } catch (_) { }
            }
            return this.pilotTests.find(t => Number(t.id) === tid) || test;
        },

        async refreshAssignmentStatus(assignmentId, studentId, testId) {
            if (!assignmentId || !studentId || !testId) return;
            try {
                const r = await api.get(`/student-exam-assignments/${assignmentId}/status`);
                let raw = r?.data?.status ?? r?.data?.data?.status ?? null;
                if (!raw) return;
                const s = String(raw).toLowerCase();
                let normalized = 'Not Started';
                if (s.includes('complete')) normalized = 'Completed';
                else if (s.includes('progress')) normalized = 'In Progress';
                else if (s.includes('start')) normalized = 'Not Started';
                else if (s.includes('expire')) normalized = 'Expired';
                const idx = this.studentTests.findIndex(st => Number(st.assignmentId) === Number(assignmentId));
                if (idx !== -1) {
                    this.studentTests[idx].status = normalized;
                }
            } catch (_) { }
        },

        getAssignmentId(testId, studentId) {
            const st = this.studentTests.find(s => Number(s.testId) === Number(testId) && Number(s.studentId) === Number(studentId));
            return st && st.assignmentId ? Number(st.assignmentId) : null;
        },

        async checkExamStatus(assignmentId) {
            if (!assignmentId) return null;
            try {
                const res = await api.get(`/student-exam-assignments/${Number(assignmentId)}/status`);
                return res?.data?.status ?? res?.data ?? null;
            } catch (error) {
                console.error('Failed to check exam status:', error);
                return null;
            }
        },

        async loadExistingAnswers(assignmentId, testId) {
            const questionStore = useQuestionStore();
            const authStore = useAuthStore();
            const sid = authStore.user
                ? Number(
                    (authStore.user.student && authStore.user.student.id)
                        ? authStore.user.student.id
                        : (authStore.user.student_id != null
                            ? authStore.user.student_id
                            : authStore.user.id)
                )
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
                const qid = Number(it.question_id || (it.question && it.question.id) || 0);
                if (!qid) continue;
                const raw = it.answer_value != null ? String(it.answer_value) : '';
                const q = questionStore.questions.find(qx => Number(qx.id) === qid);
                if (!q) continue;
                if (q.type === 'Multiple Choice') {
                    const idx = Array.isArray(q.options)
                        ? q.options.findIndex(o =>
                            o && o.text != null &&
                            String(o.text).trim().toLowerCase() === raw.trim().toLowerCase()
                        )
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
                    const prev = this.studentTests[idx].answers || {};
                    const merged = { ...prev, ...answers };
                    const status = this.studentTests[idx].status === 'Not Started' && Object.keys(merged).length > 0
                        ? 'In Progress'
                        : this.studentTests[idx].status;
                    this.studentTests[idx] = { ...this.studentTests[idx], answers: merged, status };
                }
            }
            return answers;
        },

        async persistAnswer(assignmentId, questionId, answer) {
            if (!assignmentId || !questionId) return;
            try {
                await api.post('/student-answers', {
                    assignment_id: Number(assignmentId),
                    question_id: Number(questionId),
                    answer_value: String(answer),
                });
            } catch (err) {
                console.warn(`persistAnswer failed (q${questionId}):`, err?.response?.data?.message || err.message);
            }
        },

        setActiveTest(test) {
            const questionStore = useQuestionStore();
            const authStore = useAuthStore();
            const sid = authStore.user
                ? Number(
                    authStore.user.student?.id ??
                    authStore.user.student_id ??
                    authStore.user.id
                )
                : null;
            const st = sid
                ? this.studentTests.find(
                    s =>
                        Number(s.testId) === Number(test.id) &&
                        Number(s.studentId) === Number(sid)
                )
                : null;
            if (st?.status === 'Completed' || st?.status === 'completed') {
                return false;
            }
            const questions =
                test.questionIds
                    ?.map(id => questionStore.questions.find(q => q.id === id))
                    .filter(Boolean) || [];
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
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        },

        async startExamAction(assignmentId) {
            try {
                await api.patch(`/student-exam-assignments/${assignmentId}/start`);
            } catch (error) {
                console.error('Error starting exam on server:', error);
            }
        },

        async completeExamAction(assignmentId, score) {
            try {
                await api.patch(`/student-exam-assignments/${assignmentId}/complete`, { score });
            } catch (error) {
                console.error('Error completing exam on server:', error);
            }
        },

        submitTest(testId, studentId, answers, score) {
            this.stopTimer();
            const test = this.studentTests.find(
                st => Number(st.testId) === Number(testId) && Number(st.studentId) === Number(studentId)
            );
            if (test) {
                test.status = 'Completed';
                test.answers = answers;
                test.score = score;
                const limitMin = (() => {
                    const t = this.pilotTests.find(pt => Number(pt.id) === Number(testId));
                    const lm = t && Number(t.timeLimit);
                    return Number.isFinite(lm) && lm > 0 ? lm : 60;
                })();
                const remaining = this.currentTest && Number.isFinite(this.currentTest.remainingTime)
                    ? Number(this.currentTest.remainingTime) : limitMin * 60;
                const spent = Math.max(0, (limitMin * 60) - remaining);
                test.durationSeconds = spent;
                test.completedAt = new Date().toISOString();
                if (test.assignmentId) {
                    this.completeExamAction(test.assignmentId, score);
                    setTimeout(async () => {
                        try {
                            const res = await api.get(`/student-answers/check/${test.assignmentId}`);
                            const d = res?.data ?? {};
                            if (d.completed) {
                                const rawScore = Number(d.score || 0);
                                const total = Number(d.total || 0);
                                const percent = total > 0 ? Math.round((rawScore / total) * 100) : 0;
                                const timeSpent = Number(d.time_spent || 0);
                                const idx = this.studentTests.findIndex(
                                    s => Number(s.testId) === Number(testId) && Number(s.studentId) === Number(studentId)
                                );
                                if (idx !== -1) {
                                    this.studentTests[idx] = {
                                        ...this.studentTests[idx],
                                        score: percent,
                                        rawScore,
                                        totalQuestions: total,
                                        durationSeconds: timeSpent || spent,
                                    };
                                }
                            }
                        } catch (_) { }
                    }, 2000);
                }
            }
            this.currentTest = null;
            this.reviewMode = false;
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

        async fetchAssignmentResult(assignmentId) {
            if (!assignmentId) return null;
            try {
                const res = await api.get(`/check-assignment/${Number(assignmentId)}`);
                return res?.data ?? null;
            } catch (_) {
                return null;
            }
        },

        async fetchCompletedResultsForAssignments() {
            const items = Array.isArray(this.studentTests) ? this.studentTests : [];
            for (const st of items) {
                const aid = Number(st.assignmentId || 0);
                const tid = Number(st.testId || 0);
                const sid = Number(st.studentId || 0);
                if (!aid || !tid || !sid) continue;
                const status = await this.checkExamStatus(aid);
                if (!status) continue;
                const s = String(status).toLowerCase();
                let normalized = 'Not Started';
                if (s.includes('complete')) normalized = 'Completed';
                else if (s.includes('progress')) normalized = 'In Progress';
                else if (s.includes('start')) normalized = 'Not Started';
                else if (s.includes('expire')) normalized = 'Expired';
                const idx = this.studentTests.findIndex(x => Number(x.assignmentId) === aid);
                if (idx !== -1) {
                    this.studentTests[idx].status = normalized;
                }
                if (normalized !== 'Completed') continue;
                const result = await this.fetchAssignmentResult(aid);
                if (!result) continue;
                const total = Number(result.total || 0);
                const rawScore = Number(result.score || 0);
                const percent = total ? Math.round((rawScore / total) * 100) : 0;
                const completedAt = result.completed_at || result.updated_at || null;
                const answers = result.answers || undefined;
                const prev = idx !== -1 ? (this.studentTests[idx].answers || {}) : {};
                const merged = answers ? answers : prev;
                if (idx !== -1) {
                    this.studentTests[idx] = {
                        ...this.studentTests[idx],
                        score: percent,
                        rawScore,
                        totalQuestions: total,
                        completedAt,
                        answers: merged
                    };
                }
            }
        },

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

        async fetchReportsData() {
            try {
                const { data } = await api.get('/exams');
                const exams = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
                exams.forEach(ex => {
                    const qidsRaw = ex.question_id || (ex.exam_questions || []).map(eq => eq.question_id || eq.id);
                    const qids = Array.isArray(qidsRaw) ? [...new Set(qidsRaw.map(Number))] : [];
                    const statusLabel = (() => {
                        const s = (ex.status || '').toString().toLowerCase();
                        if (s === 'active' || s === 'approved') return 'Active';
                        if (s === 'pending review' || s === 'pending') return 'Pending Review';
                        if (s === 'completed') return 'Completed';
                        return 'Pending Review';
                    })();
                    this.addTest({
                        id: Number(ex.id),
                        name: ex.name || ex.description || `Exam ${ex.id}`,
                        description: ex.description || '',
                        term: ex.terms || ex.term || 'Midterm',
                        timeLimit: Number(ex.time_limit || 60),
                        questionIds: qids,
                        status: statusLabel
                    });
                });
            } catch (_) {}

            let assignments = [];
            try {
                const r = await api.get('/student-exam-assignments');
                const raw = r?.data?.data ?? r?.data ?? [];
                assignments = Array.isArray(raw) ? raw : [];
            } catch (_) {
                assignments = [];
            }

            for (const a of assignments) {
                const aid = Number(a.id ?? 0);
                const sid = Number(a.student_id ?? a.studentId ?? a.student?.id ?? 0);
                const eid = Number(a.exam_id ?? a.examId ?? a.exam?.id ?? 0);
                if (!aid || !sid || !eid) continue;
                const status = this._normalizeStatus(a.status);
                const directScore    = a.score            ?? a.percentage        ?? null;
                const directRaw      = a.raw_score        ?? a.correct_count     ?? null;
                const directTotal    = a.total_questions  ?? a.total_items       ?? a.total ?? null;
                const directDuration = a.time_spent       ?? a.duration_seconds  ?? a.elapsed_seconds ?? null;
                const directAt       = a.completed_at     ?? null;
                const percent = directScore != null
                    ? Math.round(Number(directScore))
                    : (directRaw != null && directTotal
                        ? Math.round((Number(directRaw) / Number(directTotal)) * 100)
                        : null);
                const examName = a.exam?.name || a.exam?.description ||
                    this.pilotTests.find(t => Number(t.id) === eid)?.name ||
                    `Exam ${eid}`;
                const row = {
                    studentId: sid, testId: eid, assignmentId: aid, name: examName, status,
                    score:           status === 'Completed' ? percent                                              : null,
                    rawScore:        status === 'Completed' ? (directRaw      != null ? Number(directRaw)      : null) : null,
                    totalQuestions:  status === 'Completed' ? (directTotal    != null ? Number(directTotal)    : null) : null,
                    durationSeconds: status === 'Completed' ? (directDuration != null ? Number(directDuration) : null) : null,
                    completedAt:     status === 'Completed' ? directAt                                            : null,
                    answers: {}
                };
                const idx = this.studentTests.findIndex(st => Number(st.assignmentId) === aid);
                if (idx === -1) this.studentTests.push(row);
                else this.studentTests[idx] = { ...this.studentTests[idx], ...row };
            }

            const examIdsWithAssignments = [...new Set(
                [...this.pilotTests.map(t => Number(t.id)), ...this.studentTests.map(st => Number(st.testId))]
            )].filter(Boolean);

            await Promise.allSettled(examIdsWithAssignments.map(async eid => {
                try {
                    const r = await api.get('/get-student', { params: { exam_id: eid } });
                    const list = Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : []);
                    for (const item of list) {
                        const sid = Number(
                            item.student_id != null ? item.student_id :
                            item.assignment_id != null ? item.assignment_id :
                            item.student?.id != null ? item.student.id :
                            item.id != null ? item.id : 0
                        );
                        if (!sid) continue;
                        const isAssigned = item.is_assigned === true || item.is_assigned === 1
                            || item.is_assigned === '1'
                            || (typeof item.is_assigned === 'string' && item.is_assigned.toLowerCase() === 'true');
                        if (!isAssigned) continue;
                        const itemStatus = this._normalizeStatus(item.status ?? 'Not Started');
                        const rawScore   = Number(item.score ?? item.raw_score ?? item.correct ?? 0) || null;
                        const total      = Number(item.total ?? item.total_questions ?? item.total_items ?? 0) || null;
                        const percent    = rawScore && total ? Math.round((rawScore / total) * 100) : null;
                        const timeSpent  = Number(item.time_spent ?? item.duration ?? 0) || null;
                        const completedAt = item.completed_at ?? null;
                        const assignmentId = Number(item.assignment_id ?? item.id ?? 0) || null;
                        const examName = this.pilotTests.find(t => Number(t.id) === eid)?.name || `Exam ${eid}`;
                        const stIdx = this.studentTests.findIndex(st => Number(st.testId) === eid && Number(st.studentId) === sid);
                        const rowData = {
                            studentId: sid, testId: eid,
                            assignmentId: assignmentId ?? (stIdx >= 0 ? this.studentTests[stIdx].assignmentId : null),
                            name: examName, status: itemStatus,
                            score:           percent   ?? (stIdx >= 0 ? this.studentTests[stIdx].score : null),
                            rawScore:        rawScore  ?? (stIdx >= 0 ? this.studentTests[stIdx].rawScore : null),
                            totalQuestions:  total     ?? (stIdx >= 0 ? this.studentTests[stIdx].totalQuestions : null),
                            durationSeconds: timeSpent ?? (stIdx >= 0 ? this.studentTests[stIdx].durationSeconds : null),
                            completedAt:     completedAt ?? (stIdx >= 0 ? this.studentTests[stIdx].completedAt : null),
                            answers: stIdx >= 0 ? (this.studentTests[stIdx].answers ?? {}) : {}
                        };
                        if (stIdx === -1) this.studentTests.push(rowData);
                        else this.studentTests[stIdx] = { ...this.studentTests[stIdx], ...rowData };
                    }
                } catch (_) {}
            }));

            const needsScore = this.studentTests.filter(st => st.status === 'Completed' && st.assignmentId && st.score == null);
            await Promise.allSettled(needsScore.map(async st => {
                try {
                    const res = await api.get(`/student-answers/check/${st.assignmentId}`);
                    const d = res?.data ?? {};
                    const isCompleted = d.completed === true || d.completed === 1 || d.status === 'completed' || d.score != null;
                    if (!isCompleted) return;
                    const rawScore  = Number(d.score ?? d.raw_score ?? d.correct ?? 0);
                    const total     = Number(d.total ?? d.total_questions ?? d.total_items ?? 0);
                    const percent   = total > 0 ? Math.round((rawScore / total) * 100) : (rawScore <= 100 ? rawScore : 0);
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
                            totalQuestions:  total     || this.studentTests[idx].totalQuestions,
                            durationSeconds: timeSpent || this.studentTests[idx].durationSeconds,
                            completedAt:     d.completed_at ?? this.studentTests[idx].completedAt,
                            answers: Object.keys(answers).length ? answers : this.studentTests[idx].answers
                        };
                    }
                } catch (_) {}
            }));

            const completedExamIds = [...new Set(
                this.studentTests.filter(st => st.status === 'Completed').map(st => Number(st.testId))
            )];
            for (const eid of completedExamIds) {
                const t = this.pilotTests.find(p => Number(p.id) === eid);
                if (!t?.questionIds?.length) {
                    try { await this.ensureTestReady(eid); } catch (_) {}
                }
            }
        },

        async fetchStudentPerformanceReport() {
            try {
                const response = await api.get('/studentPerformance');
                const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
                this.studentPerformanceReport = data.map(item => ({
                    ...item,
                    username: item.username,
                    exam_name: item.exam_name,
                    exam_questions: item.exam_questions,
                    student_answers: item.student_answers,
                    status: item.status,
                    score: item.score,
                    raw_score: item.raw_score,
                    time_spent: item.time_spent,
                    completed_at: item.completed_at
                }));
            } catch (error) {
                console.error('Failed to fetch student performance report:', error);
            }
        },

        setSelectedReport(report) { this.selectedReport = report; },
        setSelectedStudentResult(result) { this.selectedStudentResult = result; },
        setSelectedTest(test) { this.selectedTest = test; }
    }
}, {
    persist: {
        paths: ['currentTest', 'studentTests', 'pilotTests']
    }
});