<script>
import { mapState, mapActions } from 'pinia';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';
import { useTestStore } from '../stores/tests';
import { useUserStore } from '../stores/users';
import { useQuestionStore } from '../stores/questions';
import { useUIStore } from '../stores/ui';
import StudentResultReview from './StudentResultReview.vue';
import FacultyResultReview from './FacultyResultReview.vue';

export default {
    name: 'Reports',
    components: { StudentResultReview, FacultyResultReview },

    data: () => ({
        reportsViewTab: 'tests',
        reportTab: 'overall',
        returnView: 'reportDetail',
        cognitiveLevels: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'],
        loading: false,
        _cachedReport: null
    }),

    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useTestStore, ['pilotTests', 'studentTests', 'selectedReport', 'selectedStudentResult', 'studentPerformanceReport']),
        ...mapState(useUserStore, ['users']),
        ...mapState(useQuestionStore, ['questions']),

        currentView() { return this.$route.name; },

        completedStudentTests() {
            const results = [];
            const seen = new Set();

            if (Array.isArray(this.studentPerformanceReport) && this.studentPerformanceReport.length) {
                for (const st of this.studentPerformanceReport) {
                    const s = String(st.status ?? '').toLowerCase().trim();
                    if (!['completed', 'complete', 'done'].includes(s)) continue;

                    const aid = Number(st.assignment_id || st.assignmentId || 0);
                    if (aid && seen.has(aid)) continue;
                    if (aid) seen.add(aid);

                    let testId = Number(st.exam_id || st.testId || st.test_id || 0);
                    if (!testId && st.exam_name) {
                        const match = this.pilotTests.find(
                            t => (t.name || '').toLowerCase() === String(st.exam_name).toLowerCase()
                        );
                        if (match) testId = match.id;
                    }

                    let score = null;
                    const rawScoreStr = String(st.score ?? '').trim();
                    if (rawScoreStr.includes('%')) {
                        score = parseInt(rawScoreStr);
                    } else if (rawScoreStr.includes('/')) {
                        const [num, den] = rawScoreStr.split('/').map(Number);
                        score = den > 0 ? Math.round((num / den) * 100) : 0;
                    } else if (rawScoreStr !== '' && !isNaN(Number(rawScoreStr))) {
                        const n = Number(rawScoreStr);
                        score = n <= 100 ? Math.round(n) : null;
                    }

                    let durationSeconds = 0;
                    const ts = st.time_spent;
                    if (ts != null && ts !== '') {
                        if (typeof ts === 'number') {
                            durationSeconds = ts;
                        } else if (String(ts).includes(':')) {
                            const parts = String(ts).split(':').map(Number);
                            if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                            else if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];
                        } else {
                            durationSeconds = parseInt(ts) || 0;
                        }
                    }

                    const rawScoreVal = (() => {
                        const r = String(st.raw_score ?? '');
                        if (r.includes('/')) return parseInt(r.split('/')[0]);
                        const n = Number(st.raw_score ?? st.correct_count ?? '');
                        return !isNaN(n) && n >= 0 ? n : null;
                    })();

                    const totalQuestionsVal = (() => {
                        const r = String(st.raw_score ?? '');
                        if (r.includes('/')) return parseInt(r.split('/')[1]);
                        const n = Number(st.total_questions ?? st.total ?? st.exam_questions ?? '');
                        return !isNaN(n) && n > 0 ? n : null;
                    })();

                    results.push({
                        ...st,
                        testId,
                        assignmentId: aid || undefined,
                        studentId: Number(st.student_id || st.studentId || st.user_id || 0),
                        student_id: Number(st.student_id || st.studentId || st.user_id || 0),
                        score,
                        rawScore: rawScoreVal,
                        totalQuestions: totalQuestionsVal,
                        durationSeconds,
                        completedAt: st.completed_at || st.completedAt || null,
                    });
                }
            }

            for (const st of (this.studentTests || [])) {
                const s = String(st.status ?? '').toLowerCase().trim();
                if (!['completed', 'complete', 'done'].includes(s)) continue;

                const aid = Number(st.assignmentId || 0);
                if (aid && seen.has(aid)) continue;
                if (aid) seen.add(aid);

                results.push({
                    ...st,
                    score: st.score != null ? Math.round(Number(st.score)) : null,
                    durationSeconds: Number(st.durationSeconds || 0),
                    rawScore: st.rawScore ?? st.raw_score ?? null,
                    totalQuestions: st.totalQuestions ?? st.total_questions ?? null,
                    studentId: Number(st.studentId || st.student_id || st.user_id || 0),
                    student_id: Number(st.student_id || st.studentId || st.user_id || 0),
                });
            }

            return results;
        },

        completedTests() {
            const entries = this.completedStudentTests;
            if (!entries.length) return [];

            const groups = new Map();
            for (const st of entries) {
                const key = st.testId || st.exam_name || 'unknown';
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(st);
            }

            return Array.from(groups.entries()).map(([key, results]) => {
                const tid = typeof key === 'number' ? key : parseInt(key);
                const test = (!isNaN(tid) && tid > 0)
                    ? (this.pilotTests.find(t => Number(t.id) === tid) || {})
                    : (this.pilotTests.find(t => (t.name || '').toLowerCase() === String(key).toLowerCase()) || {});

                const n = results.length;
                const validScores = results.map(r => r.score).filter(s => s != null && !isNaN(s));
                const avgScore = validScores.length
                    ? Number((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1))
                    : null;

                const validDurations = results.map(r => r.durationSeconds).filter(d => d > 0);
                const avgDurationSeconds = validDurations.length
                    ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length
                    : 0;

                const completions = results.map(r => r.completedAt).filter(Boolean).sort();

                return {
                    ...test,
                    id: test.id || tid || key,
                    name: test.name || results[0]?.exam_name || `Exam ${key}`,
                    description: test.description || '',
                    participants: n,
                    avgScore,
                    avgDurationSeconds,
                    latestCompletion: completions.at(-1) || null,
                };
            });
        },

        selectedQuestionsForPreview() {
            const set = new Set();
            const answers = this.selectedStudentResult?.answers || {};

            if (Array.isArray(answers)) {
                answers.forEach(a => {
                    const qid = Number(a.question_id ?? a.questionId ?? a.id ?? 0);
                    if (qid > 0) set.add(qid);
                });
            } else {
                Object.keys(answers).forEach(id => {
                    const nid = Number(id);
                    if (!isNaN(nid) && nid > 0) set.add(nid);
                });
            }

            const reportIds = (this.selectedReport?.questionIds || []).map(Number);
            reportIds.forEach(id => { if (!isNaN(id) && id > 0) set.add(id); });

            const ids = Array.from(set);
            if (!ids.length) return [];

            return ids.map(id => {
                const realQ = this.questions.find(q => Number(q.id) === id);
                if (realQ) return realQ;

                let ans = null;
                if (Array.isArray(answers)) {
                    ans = answers.find(a => Number(a.question_id ?? a.questionId ?? a.id) === id);
                } else {
                    ans = answers[id] || answers[String(id)];
                }

                if (ans && (ans.question_text || ans.text)) {
                    return {
                        id,
                        text: ans.question_text || ans.text,
                        type: 'Identification',
                        virtual: true,
                        answer: ans.answer_value || ans.answer || ''
                    };
                }
                return null;
            }).filter(Boolean);
        },

        tableOfSpecs() {
            const { cognitiveLevels } = this;
            const reportQuestionIds = (this.selectedReport?.questionIds || []).map(Number);

            let questions = [];
            if (reportQuestionIds.length) {
                questions = reportQuestionIds.map(id => this.questions.find(q => Number(q.id) === id)).filter(Boolean);
            }
            if (!questions.length) {
                questions = this.selectedQuestionsForPreview.filter(q => !q.virtual);
            }

            const loSet = new Set(questions.map(q => this.normalizeLO(q.loTags)).filter(Boolean));
            const loTags = [...loSet].sort();
            const summary = Object.fromEntries(loTags.map(lo => [lo, Object.fromEntries(cognitiveLevels.map(l => [l, 0]))]));
            const rowTotals = Object.fromEntries(loTags.map(lo => [lo, 0]));
            const colTotals = Object.fromEntries(cognitiveLevels.map(l => [l, 0]));

            questions.forEach(q => {
                const lo = this.normalizeLO(q.loTags);
                const level = q.cognitiveLevel || q.cognitiveTag || '';
                if (lo && summary[lo]?.[level] !== undefined) {
                    summary[lo][level]++;
                    rowTotals[lo]++;
                    colTotals[level]++;
                }
            });
            return { summary, rowTotals, colTotals, loTags, cognitiveLevels };
        },

        itemAnalysis() {
            const results = this.selectedReport?.studentResults || [];
            if (!results.length) return [];
            const n = results.length;
            const cutoff = Math.max(1, Math.floor(n * 0.27));
            const sorted = [...results].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

            return this.selectedQuestionsForPreview.map(q => {
                const checkCorrect = st => {
                    const answers = st.answers || {};
                    const entry = answers[Number(q.id)] || answers[String(q.id)];
                    if (entry && typeof entry === 'object' && 'is_correct' in entry) {
                        const flag = entry.is_correct;
                        if (flag === true || flag === 1 || flag === '1' || flag === 'true') return true;
                        if (flag === false || flag === 0 || flag === '0' || flag === 'false') return false;
                    }
                    const score = parseInt(String(st.score || '').replace(/[^\d]/g, ''));
                    if (score === 100) return true;
                    return false;
                };

                const resultsWithData = results.filter(st => st.answers && Object.keys(st.answers).length > 0);
                const totalWithData = resultsWithData.length || n;

                const correctCount = results.filter(checkCorrect).length;
                const difficulty = correctCount / totalWithData;

                let discrimination = 0;
                if (n >= cutoff * 2) {
                    const upperGroup = sorted.slice(0, cutoff);
                    const lowerGroup = sorted.slice(-cutoff);
                    const upperCorrect = upperGroup.filter(checkCorrect).length;
                    const lowerCorrect = lowerGroup.filter(checkCorrect).length;
                    discrimination = (upperCorrect - lowerCorrect) / cutoff;
                }

                const rec =
                    difficulty < 0.2  ? { text: 'Result (Too Hard)', class: 'bg-warning text-dark' }
                    : difficulty > 0.9 ? { text: 'Result (Too Easy)', class: 'bg-success' }
                    : discrimination < 0.2 ? { text: 'Discard', class: 'bg-danger' }
                    : { text: 'Retain', class: 'bg-success' };

                return {
                    ...q,
                    difficulty,
                    discrimination,
                    recommendation: rec,
                    correctCount,
                    total: totalWithData
                };
            });
        },

        activeReport() {
            if (this._cachedReport?.studentResults?.length) {
                return {
                    ...this._cachedReport,
                    ...(this.selectedReport || {}),
                    studentResults: this._cachedReport.studentResults
                };
            }
            return this.selectedReport;
        }
    },

    methods: {
        ...mapActions(useTestStore, [
            'setSelectedReport', 'setSelectedStudentResult',
            'fetchCompletedResultsForAssignments', 'fetchReportsData',
            'ensureTestReady', 'fetchStudentPerformanceReport', 'ensureQuestionsLoadedByIds'
        ]),
        ...mapActions(useUserStore, ['fetchUsers']),
        ...mapActions(useUIStore, ['showToast']),

        setView(name) { this.$router.push({ name }); },

        async refreshReports() {
            this.loading = true;
            try {
                await Promise.allSettled([
                    this.fetchReportsData(),
                    this.fetchStudentPerformanceReport()
                ]);
            } finally {
                this.loading = false;
            }
        },

        normalizeLO(loTags) {
            if (!loTags) return null;
            const raw = Array.isArray(loTags) ? loTags[0] || '' : String(loTags);
            const m = raw.match(/^(?:CLO|LO)[- ]?\d+/i);
            return m ? m[0].toUpperCase().replace(/^CLO/, 'LO').replace(/\s+/, ' ') : raw || null;
        },

        formatDuration(seconds) {
            const s = Math.round(Number(seconds) || 0);
            if (s <= 0) return '—';
            const m = Math.floor(s / 60);
            const h = Math.floor(m / 60);
            if (h > 0) return `${h}h ${m % 60}m`;
            return m ? `${m}m ${s % 60}s` : `${s}s`;
        },

        _parseDuration(raw) {
            if (raw == null || raw === '') return 0;
            if (typeof raw === 'number') return Math.round(raw);
            const s = String(raw).trim();
            if (s.includes(':')) {
                const p = s.split(':').map(Number);
                if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
                if (p.length === 2) return p[0] * 60 + p[1];
            }
            return parseInt(s) || 0;
        },

        async _parseCheckResponse(result, testName, completedAt) {
            const rawScore = Number(result.raw_score ?? result.score ?? 0);
            const total    = Number(result.total ?? 0);

            let percent = Number(result.score ?? 0);
            if (total > 0 && percent <= total && percent === rawScore) {
                percent = Math.round((rawScore / total) * 100);
            } else {
                percent = Math.round(percent);
            }

            const durationSeconds = this._parseDuration(result.time_spent);
            const answersMap      = {};
            const questionTimes   = {};
            const list            = Array.isArray(result.answers) ? result.answers : [];

            for (const a of list) {
                const qid = Number(a.question_id ?? a.questionId ?? 0);
                if (!qid) continue;
                const entry = {
                    answer_value:  a.answer_value ?? a.answer ?? '',
                    is_correct:    a.is_correct === true  || a.is_correct === 1 ||
                                   a.is_correct === '1'   || a.is_correct === 'true' ||
                                   a.correct    === true  || a.correct    === 1,
                    question_text: a.question_text || ''
                };
                answersMap[qid]         = entry;
                answersMap[String(qid)] = entry;

                // Capture server-side time_spent per answer if the backend stores it
                if (a.time_spent !== undefined && a.time_spent !== null) {
                    questionTimes[qid] = Number(a.time_spent);
                }
            }

            // Fill in question_text from store for any missing entries
            for (const [key, entry] of Object.entries(answersMap)) {
                if (!entry.question_text && !isNaN(Number(key))) {
                    const q = this.questions.find(x => Number(x.id) === Number(key));
                    if (q) entry.question_text = q.text;
                }
            }

            return {
                name: testName,
                creatorName: result.created_by || 'N/A',
                durationSeconds,
                completedAt: result.completed_at || completedAt || null,
                score: percent,
                rawScore,
                totalQuestions: total,
                answers: answersMap,
                questionTimes,
                offlineOnly: false
            };
        },

        /**
         * Merge per-question times from testStore.studentTests into the parsed
         * questionTimes map. The store entry was written by TakeTest.vue using
         * start/end timestamps, so it reflects real time-on-question including
         * all revisits. Server values take precedence only when non-zero.
         */
        _mergeLocalQuestionTimes(questionTimes, assignmentId, testId, studentId) {
            const testStore = useTestStore();

            const st = testStore.studentTests.find(s =>
                (assignmentId && Number(s.assignmentId) === Number(assignmentId)) ||
                (Number(s.testId) === Number(testId) && Number(s.studentId) === Number(studentId))
            );

            if (!st?.questionTimes) return questionTimes;

            const merged = { ...questionTimes };
            for (const [qid, localSecs] of Object.entries(st.questionTimes)) {
                const key = Number(qid);
                // Use local value when server didn't return one or returned 0
                if (!merged[key] || merged[key] === 0) {
                    merged[key] = localSecs;
                }
            }
            return merged;
        },

        getStudentName(id, st = null) {
            const uid = Number(
                id ||
                st?.studentId || st?.student_id ||
                st?.user_id   || 0
            );

            const u = (this.users || []).find(u => Number(u.id) === uid);
            if (u) {
                const fullName = u.fullname || u.name || `${u.fname || ''} ${u.lname || ''}`.trim();
                if (fullName) return fullName;
            }

            if (st?.student?.fullname) return st.student.fullname;
            if (st?.fullname)          return st.fullname;
            if (st?.student?.fname)    return `${st.student.fname} ${st.student.lname || ''}`.trim();
            if (st?.fname)             return `${st.fname} ${st.lname || ''}`.trim();
            if (st?.creatorName && st.creatorName !== 'N/A') return st.creatorName;
            if (st?.name)              return st.name;
            if (st?.username)          return st.username;
            if (this.selectedStudentResult?.username) return this.selectedStudentResult.username;

            return uid ? `Student #${uid}` : 'Unknown Student';
        },

        getScoreBadgeClass(score) {
            const val = parseInt(String(score ?? '').replace(/[^\d]/g, '')) || 0;
            return val >= 80 ? 'bg-success' : val >= 60 ? 'bg-warning text-dark' : 'bg-danger';
        },

        async viewReport(test) {
            this.loading = true;
            try {
                const fullTest = await this.ensureTestReady(test.id || test.testId);

                const results = this.completedStudentTests.filter(st => {
                    const byId   = test.id && Number(st.testId) === Number(test.id);
                    const byName = test.name && st.exam_name &&
                        String(st.exam_name).toLowerCase() === String(test.name).toLowerCase();
                    return byId || byName;
                });

                const n = results.length;
                const validScores = results.map(r => r.score).filter(s => s != null && !isNaN(s));
                const avgScore = validScores.length
                    ? Number((validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1))
                    : null;
                const validDurations = results.map(r => r.durationSeconds).filter(d => d > 0);
                const avgDurationSeconds = validDurations.length
                    ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length
                    : 0;

                const report = {
                    ...(fullTest || test),
                    participants: n,
                    avgScore,
                    avgDurationSeconds,
                    studentResults: results
                };

                const needsAnswers = results.filter(r => !r.answers || !Object.keys(r.answers).length);
                if (needsAnswers.length > 0) {
                    Promise.allSettled(needsAnswers.map(async (r) => {
                        if (r.assignmentId) {
                            try {
                                const res = await api.get(`/student-answers/check/${r.assignmentId}`);
                                const d = res?.data || {};
                                if (d.completed || d.status === 'completed') {
                                    const testName = report.name || r.name || r.exam_name || `Exam ${report.id}`;
                                    const parsed = await this._parseCheckResponse(d, testName, r.completedAt);
                                    r.answers        = parsed.answers;
                                    r.questionTimes  = this._mergeLocalQuestionTimes(
                                        parsed.questionTimes,
                                        r.assignmentId,
                                        r.testId,
                                        r.studentId
                                    );
                                    r.rawScore       = parsed.rawScore;
                                    r.totalQuestions = parsed.totalQuestions;
                                    const stIdx = this.studentTests.findIndex(
                                        st => Number(st.assignmentId) === Number(r.assignmentId)
                                    );
                                    if (stIdx !== -1) {
                                        this.studentTests[stIdx].answers        = parsed.answers;
                                        this.studentTests[stIdx].questionTimes  = r.questionTimes;
                                        this.studentTests[stIdx].rawScore       = parsed.rawScore;
                                        this.studentTests[stIdx].totalQuestions = parsed.totalQuestions;
                                    }
                                }
                            } catch (e) {
                                console.warn(`Failed to fetch answers for assignment ${r.assignmentId}:`, e);
                            }
                        }
                    })).then(() => {
                        console.log('[Reports] Background answer fetch complete.');
                        if (this.selectedReport?.id === report.id) {
                            this.setSelectedReport({ ...report });
                        }
                    });
                }

                this._cachedReport = report;
                this.setSelectedReport(report);
                this.$router.push({ name: 'reportDetail' });
            } finally {
                this.loading = false;
            }
        },

        handleBack(targetView) {
            if (targetView === 'reportDetail' && this._cachedReport) {
                this.setSelectedReport({ ...this._cachedReport });
            }
            this.$router.push({ name: targetView });
        },

        async openStudentResult(result) {
            if (!result) {
                this.showToast('Error', 'No result data provided.', 'error');
                return;
            }

            this.loading = true;
            try {
                this.setSelectedStudentResult(result);

                const targetTestId = Number(result.testId || result.test_id || 0);
                let questionIds = [];

                if (targetTestId) {
                    try {
                        await this.ensureTestReady(targetTestId);
                        const test = this.pilotTests.find(t => Number(t.id) === targetTestId);
                        if (test?.questionIds?.length) {
                            questionIds = [...test.questionIds];
                            await this.ensureQuestionsLoadedByIds(questionIds);

                            const merged = {
                                ...(this._cachedReport || this.selectedReport || {}),
                                ...test,
                                studentResults: this._cachedReport?.studentResults || this.selectedReport?.studentResults || []
                            };
                            this.setSelectedReport(merged);
                        }
                    } catch (e) {
                        console.warn('[Reports] Failed to load full test/question data:', e);
                    }
                }

                if (result.assignmentId) {
                    try {
                        const res = await api.get(`/student-answers/check/${result.assignmentId}`);
                        const d = res?.data || {};

                        if (d.completed || d.status === 'completed') {
                            const testName = this.activeReport?.name || result.name || result.exam_name || `Exam ${targetTestId}`;
                            const parsed = await this._parseCheckResponse(d, testName, result.completedAt);

                            const resolvedIds = questionIds.length
                                ? questionIds
                                : Object.keys(parsed.answers).map(Number).filter(n => n > 0);

                            resolvedIds.forEach(qid => {
                                const qidNum = Number(qid);
                                if (qidNum && !parsed.answers[qidNum]) {
                                    const q     = this.questions.find(x => Number(x.id) === qidNum);
                                    const blank = { answer_value: '', is_correct: false, question_text: q?.text || '' };
                                    parsed.answers[qidNum]         = blank;
                                    parsed.answers[String(qidNum)] = blank;
                                }
                            });

                            // Merge locally-tracked question times (start/end timestamp approach)
                            // into the server response — this is the source of truth for the
                            // "Time Spent" badge shown per question in StudentResultReview
                            const mergedQuestionTimes = this._mergeLocalQuestionTimes(
                                parsed.questionTimes,
                                result.assignmentId,
                                targetTestId,
                                Number(result.studentId || result.student_id || result.user_id || 0)
                            );

                            const payload = {
                                studentId:       Number(result.studentId || result.student_id || result.user_id || 0),
                                student_id:      Number(result.student_id || result.studentId || result.user_id || 0),
                                username:        result.username || result.name,
                                testId:          targetTestId,
                                assignmentId:    result.assignmentId,
                                name:            parsed.name,
                                score:           parsed.score,
                                rawScore:        parsed.rawScore,
                                totalQuestions:  parsed.totalQuestions || resolvedIds.length,
                                durationSeconds: parsed.durationSeconds,
                                completedAt:     parsed.completedAt,
                                answers:         parsed.answers,
                                // questionTimes is what StudentResultReview.getQuestionTime() reads
                                questionTimes:   mergedQuestionTimes,
                            };

                            this.setSelectedStudentResult(payload);
                        }
                    } catch (err) {
                        console.warn('[Reports] Failed to fetch detailed student answers:', err);
                    }
                }

                this.$router.push({ name: 'studentResultDetail' });
            } catch (error) {
                console.error('[Reports] Failed to open student result:', error);
                this.showToast('Error', 'Failed to load student results. Please try again.', 'error');
            } finally {
                this.loading = false;
            }
        },

        async viewPerformanceDetail(st) {
            this.loading = true;
            try {
                let assignmentId = Number(st.assignment_id || st.assignmentId || st.id || 0);
                let testId       = Number(st.exam_id || st.testId || st.test_id || 0);
                const studentId  = Number(st.student_id || st.studentId || st.user_id || 0);

                if (!testId && st.exam_name) {
                    const test = this.pilotTests.find(
                        t => (t.name || '').toLowerCase() === String(st.exam_name).toLowerCase()
                    );
                    if (test) testId = test.id;
                }

                if (!assignmentId) {
                    this.showToast('Info', 'Detailed analysis for this student is not available.', 'info');
                    return;
                }

                let found = this.studentTests.find(item => Number(item.assignmentId) === assignmentId);

                if (!found) {
                    const parts = String(st.raw_score || '').split('/');
                    found = {
                        assignmentId,
                        testId,
                        studentId,
                        student_id: studentId,
                        username: st.username,
                        name: st.exam_name,
                        status: 'Completed',
                        score: (() => {
                            const raw = String(st.score ?? '').trim();
                            if (raw.includes('%')) return parseInt(raw);
                            if (!isNaN(Number(raw)) && Number(raw) <= 100) return Math.round(Number(raw));
                            return null;
                        })(),
                        rawScore: parseInt(parts[0]) || Number(st.student_answers) || null,
                        totalQuestions: parseInt(parts[1]) || Number(st.exam_questions) || null,
                        durationSeconds: (() => {
                            const ts = st.time_spent;
                            if (!ts) return 0;
                            if (typeof ts === 'number') return ts;
                            if (String(ts).includes(':')) {
                                const p = String(ts).split(':').map(Number);
                                return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
                            }
                            return parseInt(ts) || 0;
                        })(),
                        completedAt: st.completed_at || null
                    };
                }

                await this.openStudentResult(found);
            } finally {
                this.loading = false;
            }
        }
    },

    async mounted() {
        this.fetchUsers().catch(() => {});
        if (this.$route?.query?.back) this.returnView = String(this.$route.query.back);

        if (this.currentView === 'reportDetail' && this.selectedReport) {
            if (!this._cachedReport && this.selectedReport.studentResults?.length) {
                this._cachedReport = { ...this.selectedReport };
            }
        }

        this.loading = true;
        try {
            await Promise.allSettled([
                this.fetchReportsData(),
                this.fetchStudentPerformanceReport()
            ]);
        } catch (e) {
            console.error('Initial data fetch failed:', e);
            try { await this.fetchCompletedResultsForAssignments(); } catch (_) {}
        } finally {
            this.loading = false;
        }
    },

    watch: {
        $route(to) {
            if (to?.query?.back) this.returnView = String(to.query.back);
            if (to?.name === 'reportDetail' && this._cachedReport) {
                this.setSelectedReport({ ...this._cachedReport });
            }
        }
    }
};
</script>

<template>
    <!-- ── Reports List ─────────────────────────────────────────────────────── -->
    <div v-if="currentView === 'reports'" class="container-fluid py-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <div>
                <h2 class="mb-0 fw-bold text-dark">Reports &amp; Analysis</h2>
                <p class="text-muted small mb-0">Monitor student progress and analyze exam performance</p>
            </div>
            <button class="btn btn-outline-primary shadow-sm" @click="refreshReports" :disabled="loading">
                <i class="fas fa-sync me-2" :class="{ 'fa-spin': loading }"></i> Refresh Data
            </button>
        </div>

        <div class="card shadow-sm border-0 rounded-4 overflow-hidden mb-4">
            <div class="card-header bg-white p-0">
                <ul class="nav nav-tabs card-header-tabs m-0 border-0">
                    <li class="nav-item">
                        <a class="nav-link active py-3 px-4 border-0 border-bottom border-3 border-primary rounded-0 fw-bold"
                            href="#" @click.prevent>
                            <i class="fas fa-file-alt me-2"></i> Completed Pilot Tests
                        </a>
                    </li>
                </ul>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr class="text-uppercase small">
                                <th class="p-3">Test Name</th>
                                <th class="text-center">Participants</th>
                                <th class="text-center">Avg Score</th>
                                <th class="text-center">Avg Time</th>
                                <th class="text-center">Last Completed</th>
                                <th class="text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="loading">
                                <td colspan="6" class="text-center text-muted p-5">
                                    <div class="spinner-border text-primary mb-2" role="status"></div>
                                    <div class="small">Fetching results...</div>
                                </td>
                            </tr>
                            <tr v-else-if="!completedTests.length">
                                <td colspan="6" class="text-center text-muted p-5">
                                    <i class="fas fa-folder-open fa-3x mb-3 opacity-25 d-block"></i>
                                    No completed tests found yet.
                                </td>
                            </tr>
                            <tr v-else v-for="test in completedTests" :key="test.id">
                                <td class="p-3">
                                    <div class="fw-bold text-dark">{{ test.name }}</div>
                                    <div class="small text-muted" v-if="test.description">{{ test.description }}</div>
                                </td>
                                <td class="text-center">
                                    <span class="badge bg-light text-dark border px-3 rounded-pill">{{ test.participants }}</span>
                                </td>
                                <td class="text-center">
                                    <span v-if="test.avgScore != null" class="badge fs-6 px-3 rounded-pill" :class="getScoreBadgeClass(test.avgScore)">
                                        {{ test.avgScore }}%
                                    </span>
                                    <span v-else class="text-muted">—</span>
                                </td>
                                <td class="text-center text-muted fw-medium">{{ formatDuration(test.avgDurationSeconds) }}</td>
                                <td class="text-center text-muted small">
                                    {{ test.latestCompletion
                                        ? new Date(test.latestCompletion).toLocaleDateString(undefined, { dateStyle: 'medium' })
                                        : '—' }}
                                </td>
                                <td class="text-center">
                                    <button class="btn btn-primary btn-sm rounded-pill px-4 shadow-sm"
                                        @click="viewReport(test)" :disabled="loading">
                                        <i class="fas fa-chart-bar me-1"></i> View Report
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- ── Report Detail ────────────────────────────────────────────────────── -->
    <div v-if="currentView === 'reportDetail'" class="container-fluid py-4">
        <div class="d-flex align-items-center mb-4">
            <button class="btn btn-outline-secondary me-3" @click="$router.push({ name: 'reports' })">
                <i class="fas fa-arrow-left me-1"></i> Back
            </button>
            <div>
                <h2 class="mb-0 fw-bold">{{ activeReport?.name || 'Report' }}</h2>
                <small class="text-muted">{{ activeReport?.description || 'Comprehensive exam analysis and results' }}</small>
            </div>
        </div>

        <div class="row g-4 mb-5">
            <div class="col-sm-6 col-lg-3" v-for="card in [
                { label: 'Participants',    value: activeReport?.participants ?? 0,             icon: 'users',   cls: 'bg-primary' },
                { label: 'Average Score',   value: activeReport?.avgScore != null ? activeReport.avgScore + '%' : '—', icon: 'chart-line', cls: getScoreBadgeClass(activeReport?.avgScore) },
                { label: 'Average Time',    value: formatDuration(activeReport?.avgDurationSeconds), icon: 'clock',   cls: 'bg-info' },
                { label: 'Total Questions', value: selectedQuestionsForPreview.length,             icon: 'list-ol', cls: 'bg-secondary' }
            ]" :key="card.label">
                <div class="card border-0 shadow-sm overflow-hidden h-100">
                    <div class="card-body d-flex align-items-center p-4">
                        <div class="flex-shrink-0 rounded-3 p-3 me-3" :class="card.cls + ' bg-opacity-10'">
                            <i :class="`fas fa-${card.icon} fa-2x ${card.cls.replace('bg-', 'text-')}`"></i>
                        </div>
                        <div>
                            <div class="fs-3 fw-bold mb-0 lh-1">{{ card.value }}</div>
                            <div class="text-muted small fw-semibold text-uppercase">{{ card.label }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card shadow-sm border-0 rounded-4 overflow-hidden">
            <div class="card-header bg-white p-0">
                <ul class="nav nav-tabs card-header-tabs m-0 border-0">
                    <li class="nav-item flex-fill text-center"
                        v-for="tab in [
                            { key: 'overall', icon: 'chart-bar', label: 'Overall Analysis' },
                            { key: 'student', icon: 'users',     label: 'Student Performance' }
                        ]" :key="tab.key">
                        <a class="nav-link py-3 border-0 border-bottom border-3 rounded-0 cursor-pointer fw-semibold"
                            :class="reportTab === tab.key
                                ? 'active text-primary border-primary bg-light'
                                : 'text-muted border-transparent'"
                            @click="reportTab = tab.key">
                            <i :class="`fas fa-${tab.icon} me-2`"></i>{{ tab.label }}
                        </a>
                    </li>
                </ul>
            </div>

            <div class="card-body p-4">
                <!-- Overall Analysis -->
                <div v-if="reportTab === 'overall'">
                    <div class="d-flex align-items-center mb-4">
                        <div class="bg-primary bg-opacity-10 p-2 rounded-2 me-3"><i class="fas fa-th-list text-primary"></i></div>
                        <h5 class="fw-bold mb-0">Table of Specifications (LO × Cognitive Level)</h5>
                    </div>
                    <div v-if="!tableOfSpecs.loTags.length" class="text-muted small mb-4 p-5 text-center border rounded-3 bg-light">
                        No LO/cognitive level data available for this exam.
                    </div>
                    <div v-else class="table-responsive mb-5">
                        <table class="table table-bordered align-middle text-center mb-0">
                            <thead class="table-light">
                                <tr class="text-uppercase small">
                                    <th class="text-start p-3">Learning Outcome</th>
                                    <th v-for="l in tableOfSpecs.cognitiveLevels" :key="l">{{ l }}</th>
                                    <th class="bg-primary bg-opacity-10">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="lo in tableOfSpecs.loTags" :key="lo">
                                    <td class="text-start fw-semibold p-3">{{ lo }}</td>
                                    <td v-for="l in tableOfSpecs.cognitiveLevels" :key="l">
                                        <span v-if="tableOfSpecs.summary[lo][l]" class="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3">
                                            {{ tableOfSpecs.summary[lo][l] }}
                                        </span>
                                        <span v-else class="text-muted opacity-25">—</span>
                                    </td>
                                    <td class="fw-bold bg-light">{{ tableOfSpecs.rowTotals[lo] || 0 }}</td>
                                </tr>
                            </tbody>
                            <tfoot class="table-light">
                                <tr class="fw-bold">
                                    <td class="text-start p-3">GRAND TOTAL</td>
                                    <td v-for="l in tableOfSpecs.cognitiveLevels" :key="l">{{ tableOfSpecs.colTotals[l] || 0 }}</td>
                                    <td class="bg-primary text-white">{{ selectedQuestionsForPreview.length }}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div class="d-flex align-items-center mb-4">
                        <div class="bg-success bg-opacity-10 p-2 rounded-2 me-3"><i class="fas fa-microscope text-success"></i></div>
                        <h5 class="fw-bold mb-0">Item Analysis</h5>
                    </div>
                    <div v-if="!itemAnalysis.length" class="text-muted small p-5 text-center border rounded-3 bg-light">
                        Not enough data for detailed item analysis.
                    </div>
                    <div v-else class="table-responsive">
                        <table class="table table-hover align-middle">
                            <thead class="table-light">
                                <tr class="text-uppercase small">
                                    <th class="p-3">#</th>
                                    <th>Question</th>
                                    <th class="text-center">Correct Rate</th>
                                    <th class="text-center">Difficulty</th>
                                    <th class="text-center">Discrimination</th>
                                    <th class="text-center">Recommendation</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(item, i) in itemAnalysis" :key="item.id">
                                    <td class="text-muted p-3 fw-bold">{{ i + 1 }}</td>
                                    <td>
                                        <div class="fw-semibold mb-1" style="max-width:400px;white-space:normal">{{ item.text }}</div>
                                        <div class="d-flex gap-2">
                                            <span class="badge bg-light text-dark border">{{ item.type }}</span>
                                            <span class="badge bg-light text-dark border">{{ item.cognitiveLevel }}</span>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <div class="fw-bold text-primary">{{ item.correctCount }} / {{ item.total }}</div>
                                        <div class="progress mt-1" style="height:4px">
                                            <div class="progress-bar bg-primary" :style="{ width: (item.difficulty * 100) + '%' }"></div>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <span class="badge rounded-pill px-3"
                                            :class="item.difficulty < 0.2 ? 'bg-danger' : item.difficulty > 0.9 ? 'bg-warning text-dark' : 'bg-success'">
                                            {{ (item.difficulty * 100).toFixed(0) }}%
                                        </span>
                                    </td>
                                    <td class="text-center">
                                        <span class="badge rounded-pill px-3"
                                            :class="item.discrimination < 0.2 ? 'bg-danger' : 'bg-info'">
                                            {{ item.discrimination.toFixed(2) }}
                                        </span>
                                    </td>
                                    <td class="text-center">
                                        <span class="badge rounded-pill px-3 py-2" :class="item.recommendation.class">
                                            {{ item.recommendation.text }}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Student Performance Tab -->
                <div v-if="reportTab === 'student'">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle">
                            <thead class="table-light">
                                <tr class="text-uppercase small">
                                    <th class="p-3">Student</th>
                                    <th class="text-center">Score</th>
                                    <th class="text-center">Raw Score</th>
                                    <th class="text-center">Time Spent</th>
                                    <th class="text-center">Completed At</th>
                                    <th class="text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="!activeReport?.studentResults?.length">
                                    <td colspan="6" class="text-center text-muted p-5">
                                        No student results found for this exam.
                                    </td>
                                </tr>
                                <tr v-else v-for="st in activeReport.studentResults" :key="st.username">
                                    <td class="p-3">
                                        <div class="d-flex align-items-center">
                                            <div class="bg-light rounded-circle p-2 me-3">
                                                <i class="fas fa-user text-muted"></i>
                                            </div>
                                            <div class="fw-bold text-dark">
                                                {{ getStudentName(st.studentId || st.student_id || st.user_id, st) }}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <span v-if="st.score != null" class="badge fs-6 px-3 rounded-pill" :class="getScoreBadgeClass(st.score)">
                                            {{ st.score }}%
                                        </span>
                                        <span v-else class="text-muted">—</span>
                                    </td>
                                    <td class="text-center">
                                        <div class="fw-semibold">
                                            {{ st.rawScore ?? st.raw_score ?? '?' }} / {{ st.totalQuestions ?? st.total_questions ?? '?' }}
                                        </div>
                                        <div class="small text-muted">Correct</div>
                                    </td>
                                    <td class="text-center text-muted fw-medium">
                                        {{ (st.durationSeconds > 0 || st.time_spent) ? formatDuration(st.durationSeconds || st.time_spent) : '—' }}
                                    </td>
                                    <td class="text-center text-muted small">
                                        {{ st.completedAt ? new Date(st.completedAt).toLocaleString() : '—' }}
                                    </td>
                                    <td class="text-center">
                                        <button class="btn btn-primary btn-sm rounded-pill px-4 shadow-sm"
                                            @click="openStudentResult(st)">
                                            <i class="fas fa-file-alt me-1"></i> Review
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- ── Student/Faculty Result Detail ──────────────────────────────────── -->
    <StudentResultReview
        v-if="currentView === 'studentResultDetail' && currentUser.role !== 'Faculty'"
        :student-result="selectedStudentResult"
        :report="selectedReport"
        :return-view="returnView"
        @back="handleBack($event)"
        @retry="openStudentResult($event)"
    />
    <FacultyResultReview
        v-if="currentView === 'studentResultDetail' && currentUser.role === 'Faculty'"
        :student-result="selectedStudentResult"
        :report="selectedReport"
        :return-view="returnView"
        @back="handleBack($event)"
        @retry="openStudentResult($event)"
    />
</template>

<style scoped>
.cursor-pointer { cursor: pointer; }
.border-transparent { border-color: transparent !important; }
</style>