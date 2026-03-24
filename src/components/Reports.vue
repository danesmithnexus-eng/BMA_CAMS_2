<script>
import { mapState, mapActions } from 'pinia';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';
import { useTestStore } from '../stores/tests';
import { useUserStore } from '../stores/users';
import { useQuestionStore } from '../stores/questions';
import { useUIStore } from '../stores/ui';

export default {
    name: 'Reports',

    data: () => ({
        reportsViewTab: 'tests',
        reportTab: 'overall',
        returnView: 'reportDetail',
        cognitiveLevels: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'],
        loading: false
    }),

    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useTestStore, ['pilotTests', 'studentTests', 'selectedReport', 'selectedStudentResult', 'studentPerformanceReport']),
        ...mapState(useUserStore, ['users']),
        ...mapState(useQuestionStore, ['questions']),

        currentView() { return this.$route.name; },

        completedStudentTests() {
            // Source from the new performance report if available
            if (this.studentPerformanceReport?.length) {
                return this.studentPerformanceReport.filter(st => {
                    const s = String(st.status ?? '').toLowerCase();
                    return s === 'completed' || s === 'complete' || s === 'done';
                }).map(st => {
                    const scoreVal = parseInt(String(st.score).replace(/[^\d]/g, ''));
                    const durationVal = parseInt(st.time_spent);
                    
                    // Crucial: Resolve the correct testId by matching exam_name if ID is missing or ambiguous
                    let resolvedTestId = st.exam_id || st.testId || st.test_id;
                    if (!resolvedTestId && st.exam_name) {
                        const match = this.pilotTests.find(t => (t.name || '').toLowerCase() === st.exam_name.toLowerCase());
                        if (match) resolvedTestId = match.id;
                    }
                    // If still missing, fallback to st.id (which might be an assignment ID)
                    if (!resolvedTestId) resolvedTestId = st.id;

                    return {
                        ...st,
                        testId: resolvedTestId,
                        score: isNaN(scoreVal) ? 0 : scoreVal,
                        durationSeconds: isNaN(durationVal) ? 0 : durationVal,
                        completedAt: st.completed_at
                    };
                });
            }

            // Fallback to legacy studentTests
            return (this.studentTests || []).filter(st => {
                const s = String(st.status ?? '').toLowerCase();
                return s === 'completed' || s === 'complete' || s === 'done';
            });
        },

        completedTests() {
            // Group by testId or exam_name
            const entries = this.completedStudentTests;
            if (!entries.length) return [];

            const groups = entries.reduce((acc, st) => {
                // Prefer testId if it's a real ID from pilotTests, otherwise group by name
                const key = st.testId || st.exam_name;
                if (!acc[key]) acc[key] = [];
                acc[key].push(st);
                return acc;
            }, {});

            return Object.entries(groups).map(([key, results]) => {
                const tid = parseInt(key);
                // Try to find the test object in pilotTests
                const test = (isNaN(tid) ? 
                    this.pilotTests.find(t => (t.name || '').toLowerCase() === String(key).toLowerCase()) :
                    this.pilotTests.find(t => Number(t.id) === tid)) || {};
                
                const n = results.length;
                const avg = arr => n ? arr.reduce((s, x) => s + (Number(x) || 0), 0) / n : 0;
                
                return {
                    ...test,
                    id: test.id || results[0].testId || key,
                    name: test.name || results[0].exam_name || `Exam ${key}`,
                    participants: n,
                    avgScore: Number(avg(results.map(r => r.score)).toFixed(1)),
                    avgDurationSeconds: avg(results.map(r => r.durationSeconds)),
                    latestCompletion: results.map(r => r.completedAt).filter(Boolean).sort().at(-1)
                };
            });
        },

        selectedQuestionsForPreview() {
            if (!this.selectedReport) return [];
            const ids = (this.selectedReport.questionIds || []).map(Number);
            if (!ids.length) return [];
            // Filter questions that match the IDs
            return this.questions.filter(q => ids.includes(Number(q.id)));
        },

        tableOfSpecs() {
            const { cognitiveLevels } = this;
            const loSet = new Set(
                this.selectedQuestionsForPreview.map(q => this.normalizeLO(q.loTags)).filter(Boolean)
            );
            const loTags = [...loSet].sort();
            const summary = Object.fromEntries(loTags.map(lo => [lo, Object.fromEntries(cognitiveLevels.map(l => [l, 0]))]));
            const rowTotals = Object.fromEntries(loTags.map(lo => [lo, 0]));
            const colTotals = Object.fromEntries(cognitiveLevels.map(l => [l, 0]));

            this.selectedQuestionsForPreview.forEach(q => {
                const lo = this.normalizeLO(q.loTags);
                const level = q.cognitiveLevel || q.cognitiveTag || '';
                if (lo && summary[lo]?.[level] !== undefined) {
                    summary[lo][level]++; rowTotals[lo]++; colTotals[level]++;
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
                const correct = st => this.isCorrect(q, st);
                const correctCount = results.filter(correct).length;
                const difficulty = correctCount / n;
                const discrimination = (sorted.slice(0, cutoff).filter(correct).length - sorted.slice(-cutoff).filter(correct).length) / cutoff;
                const rec = difficulty < 0.2 ? { text: 'Revise (Too Hard)', class: 'bg-warning text-dark' }
                    : difficulty > 0.9 ? { text: 'Revise (Too Easy)', class: 'bg-warning text-dark' }
                    : discrimination < 0.2 ? { text: 'Discard', class: 'bg-danger' }
                    : { text: 'Retain', class: 'bg-success' };
                return { ...q, difficulty, discrimination, recommendation: rec, correctCount, total: n };
            });
        }
    },

    methods: {
        ...mapActions(useTestStore, ['setSelectedReport', 'setSelectedStudentResult', 'fetchCompletedResultsForAssignments', 'fetchReportsData', 'ensureTestReady', 'fetchStudentPerformanceReport']),
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

        // ── Answer helpers ──────────────────────────────────────────────────────

        resolveIsCorrect(v) {
            if (v === null || v === undefined) return null;
            if (typeof v === 'boolean') return v;
            if (typeof v === 'number') return v === 1;
            if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
            return Boolean(v);
        },

        getAnswerEntry(question, sr) {
            const answers = sr?.answers || {};
            
            // 1. Direct ID match (most common)
            let entry = answers[Number(question.id)] ?? answers[String(question.id)];
            if (entry) return entry;

            // 2. Legacy array support
            if (Array.isArray(answers)) {
                entry = answers.find(a => Number(a.question_id) === Number(question.id));
                if (entry) return { answer_value: entry.answer_value, is_correct: this.resolveIsCorrect(entry.is_correct) };
            }

            // 3. Super Robust Fuzzy matching (ID mismatch fallback)
            // Strips whitespace and non-alphanumeric chars for a "loose" text comparison
            const clean = str => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const targetText = clean(question.text);
            
            if (targetText) {
                const values = Object.values(answers);
                const textMatch = values.find(v => clean(v.question_text || v.text) === targetText);
                if (textMatch) return textMatch;
            }

            return undefined;
        },

        getStudentAnswerValue(question, sr) {
            const entry = this.getAnswerEntry(question, sr ?? this.selectedStudentResult);
            if (entry == null) return '';
            const val = String(typeof entry === 'object' ? (entry.answer_value ?? '') : entry).trim();
            
            // Normalize for True/False questions
            if (question.type === 'True or False') {
                const s = val.toLowerCase();
                if (s === 'true' || s === '1' || s === 'yes' || s === 't') return 'True';
                if (s === 'false' || s === '0' || s === 'no' || s === 'f') return 'False';
            }
            
            // Multiple Choice: handle letter-to-text conversion
            if (question.type === 'Multiple Choice' && /^[A-Z]$/i.test(val)) {
                const idx = val.toUpperCase().charCodeAt(0) - 65;
                if (question.options?.[idx]) return question.options[idx].text;
            }
            return val;
        },

        isCorrect(question, sr) {
            const score = parseInt(String(sr?.score).replace(/[^\d]/g, ''));
            
            // 1. HIGH-TRUST SCORE FALLBACK: If the overall score is 100%, everything MUST be correct
            if (score === 100) return true;

            const entry = this.getAnswerEntry(question, sr);
            if (entry == null) return false;

            // 2. Trust DB flag if present
            if (typeof entry === 'object' && 'is_correct' in entry) {
                const flag = this.resolveIsCorrect(entry.is_correct);
                if (flag !== null) return flag;
            }

            // 3. Fallback: manual value comparison
            const given = this.getStudentAnswerValue(question, sr).toLowerCase();
            const correct = (question.type === 'True or False') 
                ? this.getCorrectTf(question).toLowerCase()
                : (question.type === 'Multiple Choice')
                    ? (() => {
                        const ci = this.getMcCorrectIndex(question);
                        return ci >= 0 ? String(question.options?.[ci]?.text || '').trim().toLowerCase() : null;
                    })()
                    : String(question.answer || question.correctAnswer || question.correct_answer || '').trim().toLowerCase();

            if (!given || !correct) return false;
            return given === correct;
        },

        // ── Multiple Choice helpers ─────────────────────────────────────────────

        getMcCorrectIndex(question) {
            // Check common property names for the correct index
            for (const key of ['answerIndex', 'correctAnswerIndex', 'answer_index', 'correct_answer_index', 'correct_option_index']) {
                const v = question[key];
                if (v !== undefined && v !== null && v !== '' && !isNaN(Number(v))) return Number(v);
            }
            
            // Check if correct answer is stored as text
            const correctText = (question.answer ?? question.correctAnswer ?? question.correct_answer ?? '').toString().trim().toLowerCase();
            if (correctText && question.options?.length) {
                // If it's a letter A-Z
                if (/^[A-Z]$/i.test(correctText)) {
                    const idx = correctText.toUpperCase().charCodeAt(0) - 65;
                    if (idx >= 0 && idx < question.options.length) return idx;
                }
                // Match by text
                const idx = question.options.findIndex(o => (o.text || '').toString().trim().toLowerCase() === correctText);
                if (idx >= 0) return idx;
            }

            // Check options array for is_correct flag
            const mc = question.options || question.multiple_choice_answers || question.answers || [];
            if (mc.length) {
                const j = mc.findIndex(o => {
                    const v = o.is_correct ?? o.correct ?? o.isCorrect ?? o.is_right ?? o.answer_is_correct;
                    return this.resolveIsCorrect(v);
                });
                if (j >= 0) return j;
            }
            return -1;
        },

        isMcCorrect(question, idx, sr) {
            const ci = this.getMcCorrectIndex(question);
            return ci >= 0 && Number(idx) === ci;
        },

        isMcStudentAnswer(question, idx, sr) {
            const entry = this.getAnswerEntry(question, sr);
            const val = this.getStudentAnswerValue(question, sr);
            
            // If we found an actual answer value, use it
            if (val) {
                // Match by letter (A, B, C...)
                if (/^[A-Z]$/i.test(val)) return (val.toUpperCase().charCodeAt(0) - 65) === idx;
                // Match by text
                const opt = question.options?.[idx];
                if (opt && String(opt.text || '').trim().toLowerCase() === val.toLowerCase()) return true;
                // Match by index (0, 1, 2...)
                const asNum = parseInt(val, 10);
                if (!isNaN(asNum) && String(asNum) === val) return asNum === idx;
            }

            // HIGH-TRUST FALLBACK: If score is 100%, assume correct option is the student's answer
            const score = parseInt(String(sr?.score).replace(/[^\d]/g, ''));
            if (score === 100) return this.isMcCorrect(question, idx, sr);

            return false;
        },

        mcOptionClass(question, idx, sr) {
            const c = this.isMcCorrect(question, idx, sr), s = this.isMcStudentAnswer(question, idx, sr);
            if (c) return 'bg-success-subtle border-success text-success-emphasis fw-semibold shadow-sm';
            if (s) return 'bg-danger-subtle border-danger text-danger-emphasis fw-semibold shadow-sm';
            return 'bg-light text-muted opacity-75';
        },

        // ── True/False helpers ──────────────────────────────────────────────────

        getCorrectTf(question) {
            const raw = question.answer ?? question.correctAnswer ?? question.correct_answer ?? '';
            if (typeof raw === 'boolean') return raw ? 'True' : 'False';
            const s = String(raw).trim().toLowerCase();
            if (s === 'true' || s === '1' || s === 'yes' || s === 't') return 'True';
            if (s === 'false' || s === '0' || s === 'no' || s === 'f') return 'False';
            return String(raw).trim() || 'True'; // Default to True if empty but exists
        },

        tfOptionClass(question, option, sr) {
            const opt = String(option).trim();
            const correct = this.getCorrectTf(question);
            const student = this.getStudentAnswerValue(question, sr);
            if (opt === correct) return 'bg-success-subtle border-success text-success-emphasis fw-semibold shadow-sm';
            if (this.isTfStudentAnswer(question, opt, sr)) return 'bg-danger-subtle border-danger text-danger-emphasis fw-semibold shadow-sm';
            return 'bg-light text-muted opacity-75';
        },

        isTfStudentAnswer(question, option, sr) {
            const val = this.getStudentAnswerValue(question, sr);
            if (val) return String(option).trim().toLowerCase() === val.toLowerCase();
            
            // HIGH-TRUST FALLBACK: If score is 100%, assume correct option is the student's answer
            const score = parseInt(String(sr?.score).replace(/[^\d]/g, ''));
            if (score === 100) return option === this.getCorrectTf(question);
            
            return false;
        },

        // ── Misc helpers ────────────────────────────────────────────────────────

        getCorrectId: q => String(q.answer ?? q.correctAnswer ?? q.correct_answer ?? '').trim(),

        getEnumAnswers: q => Array.isArray(q.answer) ? q.answer : Array.isArray(q.answers) ? q.answers : [],

        formatDuration(seconds) {
            const s = Math.round(Number(seconds) || 0), m = Math.floor(s / 60);
            return m ? `${m}m ${s % 60}s` : `${s % 60}s`;
        },

        getStudentName(id, st = null) {
            const u = (this.users || []).find(u => Number(u.id) === Number(id));
            if (u) return `${u.fname || ''} ${u.lname || ''}`.trim();
            if (st?.username) return st.username;
            if (this.selectedStudentResult?.username && (!id || id === this.selectedStudentResult.studentId)) 
                return this.selectedStudentResult.username;
            return id ? `Student #${id}` : 'Unknown Student';
        },

        getScoreBadgeClass(score) {
            const val = parseInt(String(score).replace(/[^\d]/g, '')) || 0;
            return val >= 80 ? 'bg-success' : val >= 60 ? 'bg-warning text-dark' : 'bg-danger';
        },

        // ── Actions ─────────────────────────────────────────────────────────────

        async viewReport(test) {
            this.loading = true;
            try {
                // Ensure exam questions are loaded first and get the enriched test object
                const fullTest = await this.ensureTestReady(test.id);

                // Use the robust source that includes data from the performance report
                const results = this.completedStudentTests.filter(
                    st => Number(st.testId) === Number(test.id) || 
                          (st.exam_name && (st.exam_name === test.name))
                );

                const n = results.length;
                const avg = key => {
                    const valid = results.map(r => Number(r[key])).filter(x => !isNaN(x));
                    return valid.length ? valid.reduce((s, r) => s + r, 0) / valid.length : 0;
                };

                this.setSelectedReport({
                    ...(fullTest || test),
                    participants: n,
                    avgScore: Number(avg('score').toFixed(1)),
                    avgDurationSeconds: avg('durationSeconds'),
                    studentResults: results
                });

                this.$router.push({ name: 'reportDetail' });
            } finally {
                this.loading = false;
            }
        },

        async openStudentResult(result) {
            let enriched = { ...result };
            if (enriched.assignmentId) {
                try {
                    const res = await api.get(`/student-answers/check/${enriched.assignmentId}`);
                    const d = res?.data || {};
                    if (d.time_spent > 0) enriched.durationSeconds = Number(d.time_spent);
                    if (!enriched.durationSeconds && enriched.startedAt && enriched.completedAt) {
                        enriched.durationSeconds = Math.round((new Date(enriched.completedAt) - new Date(enriched.startedAt)) / 1000);
                    }
                    
                    // ── Super Robust Answer Extraction ──────────────────────────
                    // Try all possible backend paths for answer lists
                    const list = Array.isArray(d.answers) ? d.answers
                        : Array.isArray(d.data?.answers) ? d.data.answers
                        : Array.isArray(d.data) ? d.data
                        : Array.isArray(d.exam_questions) ? d.exam_questions
                        : (d.exam?.exam_questions && Array.isArray(d.exam.exam_questions) ? d.exam.exam_questions : []);

                    if (list.length) {
                        const map = {};
                        list.forEach(a => {
                            // 1. Extract Question ID from various possible nested fields
                            const qid = a.question_id ?? a.questionId ?? a.question?.id ?? a.id;
                            if (qid == null) return;
                            
                            // 2. Extract Answer Value
                            // In some cases, the answer is inside a nested object or a differently named field
                            const val = a.answer_value ?? a.answer ?? a.student_answer ?? a.studentAnswer ?? '';
                            
                            // 3. Extract Correctness Flag
                            const correct = a.is_correct ?? a.correct ?? a.isCorrect ?? a.is_right ?? a.isRight;
                            
                            const entry = {
                                answer_value: val,
                                is_correct: this.resolveIsCorrect(correct),
                                // 4. Store text to facilitate fuzzy matching later if IDs mismatch
                                question_text: a.question?.text ?? a.question_text ?? a.text ?? ''
                            };

                            // Store under both key types
                            map[Number(qid)] = entry;
                            map[String(qid)] = entry;
                        });
                        enriched.answers = map;
                    }
                } catch (err) {
                    console.warn('Failed to fetch detailed student answers:', err);
                }
            }

            // Ensure the exam questions are loaded before viewing
            if (this.selectedReport?.id !== enriched.testId) {
                const test = this.pilotTests.find(t => Number(t.id) === Number(enriched.testId));
                if (test) {
                    this.setSelectedReport({
                        ...test,
                        participants: 1,
                        studentResults: [enriched]
                    });
                } else if (enriched.testId) {
                    await this.ensureTestReady(enriched.testId);
                    const fresh = this.pilotTests.find(t => Number(t.id) === Number(enriched.testId));
                    if (fresh) {
                        this.setSelectedReport({
                            ...fresh,
                            participants: 1,
                            studentResults: [enriched]
                        });
                    }
                }
            }

            this.setSelectedStudentResult(enriched);
            this.returnView = 'reportDetail';
            this.$router.push({ name: 'studentResultDetail' });
        },

        async viewPerformanceDetail(st) {
            this.loading = true;
            try {
                // Try to find a matching result in the existing studentTests that has more metadata
                let found = this.studentTests.find(item => {
                    const nameMatch = this.getStudentName(item.studentId).toLowerCase() === st.username.toLowerCase();
                    const examMatch = (item.name || '').toLowerCase() === st.exam_name.toLowerCase();
                    return nameMatch && examMatch;
                });

                // If not found in studentTests, but we have assignment IDs in the payload, use them
                let assignmentId = st.assignment_id || st.assignmentId || st.id;
                let testId = st.exam_id || st.testId || st.test_id;
                const studentId = st.student_id || st.studentId || st.user_id;

                // Fallback: try to find testId by name if missing
                if (!testId && st.exam_name) {
                    const test = this.pilotTests.find(t => (t.name || '').toLowerCase() === st.exam_name.toLowerCase());
                    if (test) testId = test.id;
                }

                if (!found && assignmentId) {
                    const parts = String(st.raw_score || '').split('/');
                    found = {
                        assignmentId,
                        testId,
                        studentId,
                        username: st.username,
                        name: st.exam_name,
                        status: st.status,
                        score: parseInt(String(st.score).replace(/[^\d]/g, '')) || 0,
                        rawScore: parseInt(parts[0]) || st.student_answers || 0,
                        totalQuestions: parseInt(parts[1]) || st.exam_questions || 0,
                        durationSeconds: parseInt(st.time_spent) || 0,
                        completedAt: st.completed_at
                    };
                }

                if (found && found.assignmentId) {
                    await this.openStudentResult(found);
                } else {
                    this.showToast({ message: 'Detailed analysis for this student is not available.', type: 'info' });
                }
            } finally {
                this.loading = false;
            }
        }
    },

    async mounted() {
        if (this.$route?.query?.back) this.returnView = String(this.$route.query.back);
        this.loading = true;
        try {
            await Promise.allSettled([
                this.fetchReportsData(),
                this.fetchStudentPerformanceReport()
            ]);
        } catch (e) {
            console.error('Initial data fetch failed:', e);
            try { await this.fetchCompletedResultsForAssignments(); } catch (_) {}
        }
        this.loading = false;
    },

    watch: {
        $route(to) { if (to?.query?.back) this.returnView = String(to.query.back); }
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
                        <a class="nav-link active py-3 px-4 border-0 border-bottom border-3 border-primary rounded-0 fw-bold" href="#" @click.prevent="reportsViewTab = 'tests'">
                            <i class="fas fa-file-alt me-2"></i> Completed Pilot Tests
                        </a>
                    </li>
                </ul>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                        <thead class="table-light">
                            <tr class="text-uppercase small tracking-wider">
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
                                    <i class="fas fa-folder-open fa-3x mb-3 opacity-25"></i>
                                    <p class="mb-0">No tests have been completed yet.</p>
                                </td>
                            </tr>
                            <tr v-else v-for="test in completedTests" :key="test.id">
                                <td class="p-3">
                                    <div class="fw-bold text-dark">{{ test.name || `Exam ${test.id}` }}</div>
                                    <div class="small text-muted" v-if="test.description">{{ test.description }}</div>
                                </td>
                                <td class="text-center">
                                    <span class="badge bg-light text-dark border px-3 rounded-pill">{{ test.participants }}</span>
                                </td>
                                <td class="text-center">
                                    <span class="badge fs-6 px-3 rounded-pill" :class="getScoreBadgeClass(test.avgScore)">{{ test.avgScore }}%</span>
                                </td>
                                <td class="text-center text-muted fw-medium">{{ formatDuration(test.avgDurationSeconds) }}</td>
                                <td class="text-center text-muted small">{{ test.latestCompletion ? new Date(test.latestCompletion).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—' }}</td>
                                <td class="text-center">
                                    <button class="btn btn-primary btn-sm rounded-pill px-4 shadow-sm" @click="viewReport(test)" :disabled="loading">
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
                <h2 class="mb-0 fw-bold">{{ selectedReport?.name || 'Report' }}</h2>
                <small class="text-muted">{{ selectedReport?.description || 'Comprehensive exam analysis and results' }}</small>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="row g-4 mb-5">
            <div class="col-sm-6 col-lg-3" v-for="card in [
                { label: 'Participants', value: selectedReport?.participants || 0, icon: 'users', cls: 'bg-primary' },
                { label: 'Average Score', value: (selectedReport?.avgScore?.toFixed(1) || 0) + '%', icon: 'chart-line', cls: getScoreBadgeClass(selectedReport?.avgScore) },
                { label: 'Average Time', value: formatDuration(selectedReport?.avgDurationSeconds), icon: 'clock', cls: 'bg-info' },
                { label: 'Total Questions', value: selectedQuestionsForPreview.length, icon: 'list-ol', cls: 'bg-secondary' }
            ]" :key="card.label">
                <div class="card border-0 shadow-sm overflow-hidden h-100">
                    <div class="card-body d-flex align-items-center p-4">
                        <div class="flex-shrink-0 rounded-3 p-3 me-3" :class="card.cls + ' bg-opacity-10'">
                            <i :class="`fas fa-${card.icon} fa-2x ${card.cls.replace('bg-', 'text-')}`"></i>
                        </div>
                        <div>
                            <div class="fs-3 fw-bold mb-0 lh-1">{{ card.value }}</div>
                            <div class="text-muted small fw-semibold text-uppercase tracking-wider">{{ card.label }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card shadow-sm border-0 rounded-4 overflow-hidden">
            <div class="card-header bg-white p-0">
                <ul class="nav nav-tabs card-header-tabs m-0 border-0">
                    <li class="nav-item flex-fill text-center" v-for="tab in [{ key:'overall', icon:'chart-bar', label:'Overall Analysis' }, { key:'student', icon:'users', label:'Student Performance' }]" :key="tab.key">
                        <a class="nav-link py-3 border-0 border-bottom border-3 rounded-0 cursor-pointer fw-semibold" :class="reportTab === tab.key ? 'active text-primary border-primary bg-light' : 'text-muted'" @click="reportTab = tab.key">
                            <i :class="`fas fa-${tab.icon} me-2`"></i> {{ tab.label }}
                        </a>
                    </li>
                </ul>
            </div>
            <div class="card-body p-4">

                <!-- Overall Analysis -->
                <div v-if="reportTab === 'overall'">
                    <div class="d-flex align-items-center mb-4">
                        <div class="bg-primary bg-opacity-10 p-2 rounded-2 me-3">
                            <i class="fas fa-th-list text-primary"></i>
                        </div>
                        <h5 class="fw-bold mb-0">Table of Specifications (LO × Cognitive Level)</h5>
                    </div>
                    <div v-if="!tableOfSpecs.loTags.length" class="text-muted small mb-4 p-5 text-center border rounded-3 bg-light">No LO/cognitive level data available for this exam.</div>
                    <div v-else class="table-responsive mb-5">
                        <table class="table table-bordered align-middle text-center mb-0">
                            <thead class="table-light">
                                <tr class="text-uppercase small tracking-wider">
                                    <th class="text-start p-3">Learning Outcome</th>
                                    <th v-for="l in tableOfSpecs.cognitiveLevels" :key="l">{{ l }}</th>
                                    <th class="bg-primary bg-opacity-10">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="lo in tableOfSpecs.loTags" :key="lo">
                                    <td class="text-start fw-semibold p-3">{{ lo }}</td>
                                    <td v-for="l in tableOfSpecs.cognitiveLevels" :key="l">
                                        <span v-if="tableOfSpecs.summary[lo][l]" class="badge rounded-pill bg-primary bg-opacity-10 text-primary px-3">{{ tableOfSpecs.summary[lo][l] }}</span>
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
                        <div class="bg-success bg-opacity-10 p-2 rounded-2 me-3">
                            <i class="fas fa-microscope text-success"></i>
                        </div>
                        <h5 class="fw-bold mb-0">Item Analysis</h5>
                    </div>
                    <div v-if="!itemAnalysis.length" class="text-muted small p-5 text-center border rounded-3 bg-light">Not enough data for detailed item analysis.</div>
                    <div v-else class="table-responsive">
                        <table class="table table-hover align-middle">
                            <thead class="table-light">
                                <tr class="text-uppercase small tracking-wider">
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
                                        <div class="fw-semibold mb-1" style="max-width:400px; white-space: normal;">{{ item.text }}</div>
                                        <div class="d-flex gap-2">
                                            <span class="badge bg-light text-dark border">{{ item.type }}</span>
                                            <span class="badge bg-light text-dark border">{{ item.cognitiveLevel }}</span>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <div class="fw-bold text-primary">{{ item.correctCount }} / {{ item.total }}</div>
                                        <div class="progress mt-1" style="height: 4px;">
                                            <div class="progress-bar bg-primary" :style="{ width: (item.difficulty * 100) + '%' }"></div>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <span class="badge rounded-pill px-3" :class="item.difficulty < 0.2 ? 'bg-danger' : item.difficulty > 0.9 ? 'bg-warning text-dark' : 'bg-success'">
                                            {{ (item.difficulty * 100).toFixed(0) }}%
                                        </span>
                                    </td>
                                    <td class="text-center">
                                        <span class="badge rounded-pill px-3" :class="item.discrimination < 0.2 ? 'bg-danger' : item.discrimination >= 0.4 ? 'bg-success' : 'bg-warning text-dark'">
                                            {{ item.discrimination.toFixed(2) }}
                                        </span>
                                    </td>
                                    <td class="text-center">
                                        <span class="badge rounded-pill px-3 py-2" :class="item.recommendation.class">{{ item.recommendation.text }}</span>
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
                                <tr class="text-uppercase small tracking-wider">
                                    <th class="p-3">Student</th>
                                    <th class="text-center">Score</th>
                                    <th class="text-center">Raw Score</th>
                                    <th class="text-center">Time Spent</th>
                                    <th class="text-center">Completed At</th>
                                    <th class="text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="!selectedReport?.studentResults?.length">
                                    <td colspan="6" class="text-center text-muted p-5">No student results found for this exam.</td>
                                </tr>
                                <tr v-else v-for="st in selectedReport.studentResults" :key="st.studentId || st.username">
                                    <td class="p-3">
                                        <div class="d-flex align-items-center">
                                            <div class="bg-light rounded-circle p-2 me-3">
                                                <i class="fas fa-user text-muted"></i>
                                            </div>
                                            <div class="fw-bold text-dark">{{ getStudentName(st.studentId, st) }}</div>
                                        </div>
                                    </td>
                                    <td class="text-center">
                                        <span class="badge fs-6 px-3 rounded-pill" :class="getScoreBadgeClass(st.score)">{{ st.score ?? '—' }}%</span>
                                    </td>
                                    <td class="text-center">
                                        <div class="fw-semibold text-dark">{{ st.rawScore ?? '?' }} / {{ st.totalQuestions ?? '?' }}</div>
                                        <div class="small text-muted">Correct</div>
                                    </td>
                                    <td class="text-center text-muted fw-medium">{{ st.durationSeconds ? formatDuration(st.durationSeconds) : '—' }}</td>
                                    <td class="text-center text-muted small">{{ st.completedAt ? new Date(st.completedAt).toLocaleString() : '—' }}</td>
                                    <td class="text-center">
                                        <button class="btn btn-primary btn-sm rounded-pill px-4 shadow-sm" @click="openStudentResult(st)">
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

    <!-- ── Student Result Detail ────────────────────────────────────────────── -->
    <div v-if="currentView === 'studentResultDetail'" class="container-fluid p-3">
        <div class="card border-0 shadow-sm rounded-4">
            <div class="card-header bg-white border-bottom p-4 d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                    <h5 class="mb-1 fw-bold">{{ selectedReport?.name || selectedStudentResult?.name || 'Test Paper' }}</h5>
                    <p class="text-muted mb-2"><i class="fas fa-user me-1"></i>{{ getStudentName(selectedStudentResult?.studentId, selectedStudentResult) }}</p>
                    <div class="d-flex flex-wrap gap-3">
                        <span>
                            <i class="fas fa-star me-1 text-warning"></i>Score:
                            <strong class="badge fs-6" :class="getScoreBadgeClass(selectedStudentResult?.score)">{{ selectedStudentResult?.score ?? '—' }}%</strong>
                        </span>
                        <span class="text-muted small"><i class="fas fa-check me-1 text-success"></i>{{ selectedStudentResult?.rawScore ?? '?' }} / {{ selectedStudentResult?.totalQuestions ?? '?' }} correct</span>
                        <span class="text-muted small"><i class="fas fa-clock me-1"></i>{{ selectedStudentResult?.durationSeconds ? formatDuration(selectedStudentResult.durationSeconds) : '—' }}</span>
                        <span class="text-muted small"><i class="fas fa-calendar me-1"></i>{{ selectedStudentResult?.completedAt ? new Date(selectedStudentResult.completedAt).toLocaleString() : '—' }}</span>
                    </div>
                </div>
                <button class="btn btn-outline-secondary" @click="$router.push({ name: returnView || 'reportDetail' })">
                    <i class="fas fa-arrow-left me-1"></i> Back
                </button>
            </div>

            <div class="card-body p-4" style="max-height:75vh; overflow-y:auto">
                <div v-if="!selectedQuestionsForPreview.length" class="text-center text-muted p-5">No questions found for this exam.</div>

                <div v-for="(q, i) in selectedQuestionsForPreview" :key="q.id" class="card mb-3 border-0 shadow-sm">
                    <div class="card-body">
                        <!-- Question header -->
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <h6 class="fw-bold mb-0">Q{{ i + 1 }}. {{ q.text }}</h6>
                            <span class="badge ms-2 flex-shrink-0" :class="isCorrect(q, selectedStudentResult) ? 'bg-success' : 'bg-danger'">
                                {{ isCorrect(q, selectedStudentResult) ? '✓ Correct' : '✗ Wrong' }}
                            </span>
                        </div>
                        <small class="text-muted d-block mb-3">
                            {{ q.type }}
                            <span v-if="q.cognitiveLevel"> · {{ q.cognitiveLevel }}</span>
                            <span v-if="normalizeLO(q.loTags)"> · {{ normalizeLO(q.loTags) }}</span>
                        </small>

                        <!-- Multiple Choice -->
                        <div v-if="q.type === 'Multiple Choice'">
                            <div v-for="(opt, idx) in q.options" :key="idx" class="p-2 mb-2 rounded border position-relative" :class="mcOptionClass(q, idx, selectedStudentResult)">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="d-flex align-items-center">
                                        <span class="me-2 fw-bold">{{ String.fromCharCode(65 + idx) }}.</span>
                                        <span>{{ opt.text }}</span>
                                    </div>
                                    <div class="d-flex gap-2">
                                        <span v-if="isMcCorrect(q, idx, selectedStudentResult)" class="badge bg-success shadow-sm">
                                            <i class="fas fa-check-circle me-1"></i>Correct Answer
                                        </span>
                                        <span v-if="isMcStudentAnswer(q, idx, selectedStudentResult)" class="badge shadow-sm" :class="isMcCorrect(q, idx, selectedStudentResult) ? 'bg-primary' : 'bg-danger'">
                                            <i class="fas me-1" :class="isMcCorrect(q, idx, selectedStudentResult) ? 'fa-user-check' : 'fa-user-times'"></i>Your Answer
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- True or False -->
                        <div v-else-if="q.type === 'True or False'">
                            <div v-for="opt in ['True', 'False']" :key="opt" class="p-2 mb-2 rounded border position-relative" :class="tfOptionClass(q, opt, selectedStudentResult)">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>{{ opt }}</span>
                                    <div class="d-flex gap-2">
                                        <span v-if="opt === getCorrectTf(q)" class="badge bg-success shadow-sm">
                                            <i class="fas fa-check-circle me-1"></i>Correct Answer
                                        </span>
                                        <span v-if="isTfStudentAnswer(q, opt, selectedStudentResult)" class="badge shadow-sm" :class="opt === getCorrectTf(q) ? 'bg-primary' : 'bg-danger'">
                                            <i class="fas me-1" :class="opt === getCorrectTf(q) ? 'fa-user-check' : 'fa-user-times'"></i>Your Answer
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Identification -->
                        <div v-else-if="q.type === 'Identification'" class="row g-3">
                            <div class="col-md-6">
                                <div class="p-3 rounded border bg-success-subtle border-success">
                                    <small class="d-block mb-1 fw-semibold text-success"><i class="fas fa-check-circle me-1"></i>Correct Answer</small>
                                    <span class="fw-bold fs-6 text-success">{{ getCorrectId(q) || '—' }}</span>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 rounded border" :class="isCorrect(q, selectedStudentResult) ? 'bg-success-subtle border-success' : 'bg-danger-subtle border-danger'">
                                    <small class="d-block mb-1 fw-semibold" :class="isCorrect(q, selectedStudentResult) ? 'text-success' : 'text-danger'">
                                        <i class="fas me-1" :class="isCorrect(q, selectedStudentResult) ? 'fa-check-circle' : 'fa-times-circle'"></i>Your Answer
                                    </small>
                                    <span class="fw-bold fs-6" :class="isCorrect(q, selectedStudentResult) ? 'text-success' : 'text-danger'">
                                        {{ getStudentAnswerValue(q, selectedStudentResult) || 'No Answer' }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Enumeration -->
                        <div v-else-if="q.type === 'Enumeration'" class="row g-3">
                            <div class="col-md-6">
                                <div class="p-3 rounded border bg-success-subtle border-success">
                                    <small class="d-block mb-1 fw-semibold text-success"><i class="fas fa-check-circle me-1"></i>Expected Answers</small>
                                    <ul class="mb-0 ps-3">
                                        <li v-for="ans in getEnumAnswers(q)" :key="ans">{{ ans }}</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 rounded border bg-light">
                                    <small class="d-block mb-1 fw-semibold text-muted"><i class="fas fa-user me-1"></i>Your Answer</small>
                                    <span class="fw-bold">{{ getStudentAnswerValue(q, selectedStudentResult) || 'No Answer' }}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.cursor-pointer { cursor: pointer; }
</style>