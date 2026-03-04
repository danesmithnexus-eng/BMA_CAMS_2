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
        reviewMode: false
    }),
    getters: {
        getTestById: (state) => (id) => state.pilotTests.find(t => t.id === id),
        getStudentTests: (state) => (studentId) => state.studentTests.filter(st => Number(st.studentId) === Number(studentId)),
        getAssignedTestsForStudent: (state) => (studentId) => {
            return state.studentTests.filter(st => Number(st.studentId) === Number(studentId)).map(st => {
                const test = state.pilotTests.find(t => Number(t.id) === Number(st.testId));
                return {
                    ...st,
                    id: st.testId, // Ensure ID is available
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
            // Remove existing assignments for this test if needed, or just append unique ones
            // Strategy: Filter out existing, add new
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
                    if (examEarly || listEarly.length > 0) {
                        const qidsE = [];
                        const detailsE = [];
                        for (const it of listEarly) {
                            const base = it?.question || it;
                            const qid = Number(base?.id || it?.question_id || it?.id || 0);
                            if (qid && !qidsE.includes(qid)) qidsE.push(qid);
                            if (qid) {
                                const norm = { ...base };
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
                            const typeLabel = (() => {
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
                            })();
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
                                program: '',
                                course: '',
                                type: typeLabel,
                                loTags: loNorm ? [loNorm] : [],
                                cognitiveLevel: d.cognitive_level || 'Remembering',
                                options,
                                pairs
                            };
                            const existing = questionStore.questions.find(q => Number(q.id) === Number(payload.id));
                            if (existing) questionStore.updateQuestion({ ...existing, ...payload });
                            else questionStore.addQuestion(payload);
                        }
                    }
                } catch (_) { }
                if (test && Array.isArray(test.questionIds) && test.questionIds.length > 0) {
                    // already populated from /exam-questions/:id, skip to per-question ensures below
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
                                const typeLabel = (() => {
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
                                })();
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
                                    text: d.text || '',
                                    status: 'Approved',
                                    program: '',
                                    course: '',
                                    type: typeLabel,
                                    loTags: loNorm ? [loNorm] : [],
                                    cognitiveLevel: d.cognitive_level || 'Remembering',
                                    options,
                                    pairs
                                };
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
                } catch (_) {
                    // silent fail; will fallback to whatever is in store
                }
            }
            if (!test || !Array.isArray(test.questionIds) || test.questionIds.length === 0) {
                try {
                    const r2 = await api.get(`/exam-questions/${tid}`);
                    const root = r2?.data || null;
                    const exam = root?.examDetails || root?.exam || null;
                    const list = Array.isArray(root?.questionList) ? root.questionList : [];
                    if (exam || list.length > 0) {
                        const qids = [];
                        const details = [];
                        for (const it of list) {
                            const base = it?.question || it;
                            const qid = Number(base?.id || it?.question_id || it?.id || 0);
                            if (qid && !qids.includes(qid)) qids.push(qid);
                            if (qid) {
                                const norm = { ...base };
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
                            const typeLabel = (() => {
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
                            })();
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
                                program: '',
                                course: '',
                                type: typeLabel,
                                loTags: loNorm ? [loNorm] : [],
                                cognitiveLevel: d.cognitive_level || 'Remembering',
                                options,
                                pairs
                            };
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
                    const typeLabel = (() => {
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
                    })();
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
                        if (correctIndex >= 0) {
                            payload = payload || {};
                        }
                    } else if (typeLabel === 'Matching Type') {
                        const mp = d.pairs || d.matching_pairs || [];
                        pairs = Array.isArray(mp) ? mp.map(p => ({ prompt: p.prompt || p.left || '', answer: p.answer || p.right || '' })) : [];
                    }
                    const loRaw = d.learning_outcome || '';
                    const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';
                    let payload = {
                        id: d.id || qid,
                        text: d.text || d.question_text || '',
                        status: 'Approved',
                        program: existing?.program || '',
                        course: existing?.course || '',
                        type: typeLabel,
                        loTags: loNorm ? [loNorm] : (existing?.loTags || []),
                        cognitiveLevel: d.cognitive_level || existing?.cognitiveLevel || 'Remembering',
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
                        const ca = d.correct_answer ?? d.answer ?? d.is_true ?? d.isCorrect ?? (d.trueFalseAnswer && (d.trueFalseAnswer.is_true ?? d.trueFalseAnswer.answer));
                        if (ca !== undefined && ca !== null) {
                            const val = typeof ca === 'boolean' ? ca : (String(ca).toLowerCase() === 'true' || ca === 1 || ca === '1');
                            payload.answer = val ? 'True' : 'False';
                        }
                    } else if (typeLabel === 'Identification') {
                        const ca = d.correct_answer ?? d.answer ?? d.key;
                        if (ca !== undefined && ca !== null) payload.answer = String(ca);
                    }
                    if (existing) questionStore.updateQuestion(payload);
                    else questionStore.addQuestion(payload);
                } catch (_) {
                    const fromExam = examDetailsMap.get(Number(qid));
                    if (fromExam) {
                        const d = fromExam;
                        const typeLabel = (() => {
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
                        })();
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
                            if (correctIndex >= 0) {
                                // will attach below
                            }
                        } else if (typeLabel === 'Matching Type') {
                            const mp = d.pairs || d.matching_pairs || [];
                            pairs = Array.isArray(mp) ? mp.map(p => ({ prompt: p.prompt || p.left || '', answer: p.answer || p.right || '' })) : [];
                        }
                        const loRaw = d.learning_outcome || '';
                        const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';
                        const payload = {
                            id: Number(d.id || qid),
                            text: d.text || d.question_text || '',
                            status: 'Approved',
                            program: existing?.program || '',
                            course: existing?.course || '',
                            type: typeLabel,
                            loTags: loNorm ? [loNorm] : (existing?.loTags || []),
                            cognitiveLevel: d.cognitive_level || existing?.cognitiveLevel || 'Remembering',
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
                            const ca = d.correct_answer ?? d.answer ?? d.is_true ?? d.isCorrect ?? (d.trueFalseAnswer && (d.trueFalseAnswer.is_true ?? d.trueFalseAnswer.answer));
                            if (ca !== undefined && ca !== null) {
                                const val = typeof ca === 'boolean' ? ca : (String(ca).toLowerCase() === 'true' || ca === 1 || ca === '1');
                                payload.answer = val ? 'True' : 'False';
                            }
                        } else if (typeLabel === 'Identification') {
                            const ca = d.correct_answer ?? d.answer ?? d.key;
                            if (ca !== undefined && ca !== null) payload.answer = String(ca);
                        }
                        if (existing) questionStore.updateQuestion(payload);
                        else questionStore.addQuestion(payload);
                    } else {
                        // ignore loading failures per-question to avoid blocking the flow
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
        }, async refreshAssignmentStatus(assignmentId, studentId, testId) {

            if (!assignmentId || !studentId || !testId) return;

            try {
                const r = await api.get(
                    `/student-exam-assignments/${assignmentId}/status`
                );

                let raw =
                    r?.data?.status ??
                    r?.data?.data?.status ??
                    null;

                if (!raw) return;

                // ✅ normalize backend value
                const s = String(raw).toLowerCase();

                let normalized = 'Not Started';

                if (s.includes('complete')) normalized = 'Completed';
                else if (s.includes('progress')) normalized = 'In Progress';
                else if (s.includes('start')) normalized = 'Not Started';
                else if (s.includes('expire')) normalized = 'Expired';

                const idx = this.studentTests.findIndex(st =>
                    Number(st.assignmentId) === Number(assignmentId)
                );

                if (idx !== -1) {
                    this.studentTests[idx].status = normalized;
                }

            } catch (_) {
                // silent
            }
        },
        getAssignmentId(testId, studentId) {
            const st = this.studentTests.find(s => Number(s.testId) === Number(testId) && Number(s.studentId) === Number(studentId));
            return st && st.assignmentId ? Number(st.assignmentId) : null;
        }, async checkExamStatus(assignmentId) {
            if (!assignmentId) return null;

            try {
                const res = await api.get(
                    `/student-exam-assignments/${Number(assignmentId)}/status`
                );

                // expected example:
                // { status: "Not Started" | "In Progress" | "Completed" | "Expired" ... }

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
                    (authStore.user.student && authStore.user.student.id) ? authStore.user.student.id :
                        (authStore.user.student_id != null ? authStore.user.student_id : authStore.user.id)
                )
                : null;
            let list = [];
            try {
                const r = await api.get(`/student-answers/check/${Number(assignmentId)}`);
                list = Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : []);
            } catch (_) { }
            const answers = {};
            for (const it of (list || [])) {
                const qid = Number(it.question_id || (it.question && it.question.id) || it.qid || 0);
                if (!qid) continue;
                const raw = it.answer_value != null ? String(it.answer_value) : '';
                const q = questionStore.questions.find(qx => Number(qx.id) === qid);
                if (!q) continue;
                if (q.type === 'Multiple Choice') {
                    const idx = Array.isArray(q.options)
                        ? q.options.findIndex(o => (o && o.text != null) && String(o.text).trim().toLowerCase() === raw.trim().toLowerCase())
                        : -1;
                    if (idx >= 0) answers[qid] = idx;
                    else if (!Number.isNaN(Number(raw))) answers[qid] = Number(raw);
                } else if (q.type === 'True or False') {
                    const val = raw.trim().toLowerCase();
                    if (val === 'true' || val === '1') answers[qid] = 'True';
                    else if (val === 'false' || val === '0') answers[qid] = 'False';
                    else answers[qid] = raw;
                } else {
                    answers[qid] = raw;
                }
            }
            if (sid) {
                const idx = this.studentTests.findIndex(s => Number(s.testId) === Number(testId) && Number(s.studentId) === Number(sid));
                if (idx >= 0) {
                    const prev = this.studentTests[idx].answers || {};
                    const merged = { ...prev, ...answers };
                    const status = this.studentTests[idx].status === 'Not Started' && Object.keys(merged).length > 0 ? 'In Progress' : this.studentTests[idx].status;
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
                    answer_value: String(answer)
                });
            } catch (_) { }
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

            // ✅ already completed → do not open
            if (st?.status === 'Completed') {
                return false;
            }

            const questions =
                test.questionIds
                    ?.map(id =>
                        questionStore.questions.find(q => q.id === id)
                    )
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
                    // Optionally auto-submit or notify
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
            const test = this.studentTests.find(st => Number(st.testId) === Number(testId) && Number(st.studentId) === Number(studentId));
            if (test) {
                test.status = 'Completed';
                test.answers = answers;
                test.score = score;
                const limitMin = (() => {
                    const t = this.pilotTests.find(pt => Number(pt.id) === Number(testId));
                    const lm = t && Number(t.timeLimit);
                    return Number.isFinite(lm) && lm > 0 ? lm : 60;
                })();
                const remaining = this.currentTest && Number.isFinite(this.currentTest.remainingTime) ? Number(this.currentTest.remainingTime) : limitMin * 60;
                const spent = Math.max(0, (limitMin * 60) - remaining);
                test.durationSeconds = spent;
                test.completedAt = new Date().toISOString();

                if (test.assignmentId) {
                    this.completeExamAction(test.assignmentId, score);
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
        setSelectedReport(report) {
            this.selectedReport = report;
        },
        setSelectedStudentResult(result) {
            this.selectedStudentResult = result;
        },
        setSelectedTest(test) {
            this.selectedTest = test;
        }
    }
}, {
    persist: {
        paths: ['currentTest', 'studentTests', 'pilotTests']
    }
});
