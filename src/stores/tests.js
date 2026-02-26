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
        selectedTest: null
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
                    questionIds: test ? test.questionIds : (st.questionIds || [])
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
            const test = this.studentTests.find(st => st.testId === testId && st.studentId === studentId);
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
                const r = await api.get('/student-exam-assignments', { params: { student_id: sid } });
                list = Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : []);
            } catch (_) {}
            for (const it of (list || [])) {
                const exCandidate = it.exam || it;
                const eid = Number(exCandidate.exam_id || exCandidate.test_id || exCandidate.id);
                if (!eid) continue;
                // Prefer using provided exam payload if available to avoid extra roundtrip
                let name = exCandidate.name || exCandidate.description || '';
                let description = exCandidate.description || '';
                let questionIds = [];
                const qidsRawInline = exCandidate.question_id || (exCandidate.exam_questions || []).map(eq => eq.question_id || eq.id);
                if (Array.isArray(qidsRawInline) && qidsRawInline.length > 0) {
                    questionIds = [...new Set(qidsRawInline.map(Number))];
                } else {
                    try {
                        const er = await api.get(`/exams/${eid}`);
                        const ex = er?.data?.data || er?.data || {};
                        name = name || ex.name || ex.description || `Exam ${eid}`;
                        description = description || ex.description || '';
                        const qidsRaw = ex.question_id || (ex.exam_questions || []).map(eq => eq.question_id || eq.id);
                        questionIds = Array.isArray(qidsRaw) ? [...new Set(qidsRaw.map(Number))] : [];
                    } catch (_) {
                        // fallback generic name
                        name = name || `Exam ${eid}`;
                    }
                }
                if (!this.pilotTests.find(t => Number(t.id) === eid)) {
                    this.addTest({ id: eid, name: name || `Exam ${eid}`, description, questionIds });
                }
                if (!this.studentTests.find(st => Number(st.testId) === eid && Number(st.studentId) === sid)) {
                    this.studentTests.push({
                        studentId: sid,
                        testId: eid,
                        name: name || `Exam ${eid}`,
                        description,
                        questionIds,
                        status: 'Not Started',
                        score: null,
                        answers: {}
                    });
                }
            }
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
                        const rA = await api.get(`/get-assigned-questions/${studentId}`);
                        list = Array.isArray(rA?.data?.data) ? rA.data.data : (Array.isArray(rA?.data) ? rA.data : []);
                        const match = (list || []).find(it => {
                            const exId = Number(it?.exam?.id || it?.exam_id || it?.examId || 0);
                            return exId === tid;
                        });
                        if (match && match.exam) {
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
                        }
                    } catch (_) {}
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
                        this.addTest({ id: tid, name, description, questionIds: qids });
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
                        const mc = d.multiple_choice_answers || d.options || d.choices || [];
                        const sorted = Array.isArray(mc) ? [...mc].sort((a, b) => (a.option_order || 0) - (b.option_order || 0)) : [];
                        options = sorted.map(a => ({ text: a.option_text || a.text || '' }));
                    } else if (typeLabel === 'Matching Type') {
                        const mp = d.pairs || d.matching_pairs || [];
                        pairs = Array.isArray(mp) ? mp.map(p => ({ prompt: p.prompt || p.left || '', answer: p.answer || p.right || '' })) : [];
                    }
                    const loRaw = d.learning_outcome || '';
                    const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';
                    const payload = {
                        id: d.id || qid,
                        text: d.text || '',
                        status: 'Approved',
                        program: existing?.program || '',
                        course: existing?.course || '',
                        type: typeLabel,
                        loTags: loNorm ? [loNorm] : (existing?.loTags || []),
                        cognitiveLevel: d.cognitive_level || existing?.cognitiveLevel || 'Remembering',
                        options,
                        pairs
                    };
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
                            const mc = d.multiple_choice_answers || d.options || d.choices || [];
                            const sorted = Array.isArray(mc) ? [...mc].sort((a, b) => (a.option_order || 0) - (b.option_order || 0)) : [];
                            options = sorted.map(a => ({ text: a.option_text || a.text || '' }));
                        } else if (typeLabel === 'Matching Type') {
                            const mp = d.pairs || d.matching_pairs || [];
                            pairs = Array.isArray(mp) ? mp.map(p => ({ prompt: p.prompt || p.left || '', answer: p.answer || p.right || '' })) : [];
                        }
                        const loRaw = d.learning_outcome || '';
                        const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';
                        const payload = {
                            id: Number(d.id || qid),
                            text: d.text || '',
                            status: 'Approved',
                            program: existing?.program || '',
                            course: existing?.course || '',
                            type: typeLabel,
                            loTags: loNorm ? [loNorm] : (existing?.loTags || []),
                            cognitiveLevel: d.cognitive_level || existing?.cognitiveLevel || 'Remembering',
                            options,
                            pairs
                        };
                        if (existing) questionStore.updateQuestion(payload);
                        else questionStore.addQuestion(payload);
                    } else {
                        // ignore loading failures per-question to avoid blocking the flow
                    }
                }
            }
            return this.pilotTests.find(t => Number(t.id) === tid) || test;
        },
        setActiveTest(test) {
            const questionStore = useQuestionStore();
            const questions = test.questionIds ? test.questionIds.map(qid => questionStore.questions.find(q => q.id === qid)).filter(q => q) : [];

            this.currentTest = {
                ...test,
                questions: questions,
                currentIndex: 0,
                remainingTime: (test.timeLimit || 60) * 60,
                answers: test.answers || {}
            };
            this.startTimer();
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
        submitTest(testId, studentId, answers, score) {
            this.stopTimer();
            const test = this.studentTests.find(st => st.testId === testId && st.studentId === studentId);
            if (test) {
                test.status = 'Completed';
                test.answers = answers;
                test.score = score;
            }
            this.currentTest = null; 
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
});
