<template>
    <div>
        <h2 class="mb-4">Welcome, {{ currentUser ? currentUser.fname : 'Student' }}!</h2>

        <div v-if="isOffline" class="alert alert-warning py-2 small mb-3">
            <i class="fas fa-wifi me-1"></i> You are offline. Showing cached tests.
            <span v-if="hasPendingAnswers" class="ms-2 fw-semibold">
                <i class="fas fa-clock me-1"></i> You have unsynced answers that will be submitted when you reconnect.
            </span>
        </div>

        <div class="card bg-transparent border-0 shadow-none">
            <div class="card-header bg-transparent border-0 ps-0 fw-bold fs-5">
                Assigned Pilot Tests
            </div>

            <div class="card-body px-0">
                <div v-if="loading" class="text-center text-muted p-5">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p class="mt-2">Loading tests...</p>
                </div>

                <div v-else-if="assignedTests.length === 0"
                    class="text-center text-muted p-5 bg-white rounded border">
                    You have no tests assigned.
                </div>

                <div v-else class="d-flex flex-wrap gap-3">
                    <div v-for="test in assignedTests" :key="test.id" class="test-card-wrapper">
                        <div class="card h-100 shadow-sm border-0 hover-lift">
                            <div class="card-body d-flex flex-column p-3">
                                <h5 class="card-title fw-bold text-primary mb-3 card-title-clamp">
                                    {{ test.exam?.name || test.exam_name || ('Exam ' + test.exam_id) }}
                                </h5>

                                <div class="mb-3">
                                    <span v-if="isCompleted(test)" class="badge bg-success rounded-pill px-3 py-2">
                                        <i class="fas fa-check-circle me-1"></i>Completed
                                    </span>
                                    <span v-else-if="isOffline" class="badge bg-warning text-dark rounded-pill px-3 py-2">
                                        <i class="fas fa-wifi me-1"></i>Offline
                                    </span>
                                    <span v-else class="badge bg-secondary rounded-pill px-3 py-2">
                                        <i class="fas fa-clock me-1"></i>{{ test.status }}
                                    </span>
                                </div>

                                <div class="mt-auto d-flex flex-column gap-2">
                                    <button
                                        v-if="!isCompleted(test)"
                                        class="btn btn-primary w-100 rounded-pill"
                                        :disabled="!isTestAvailable(test)"
                                        @click="startTest(test)">
                                        <span v-if="isTestAvailable(test)">
                                            Start Test <i class="fas fa-arrow-right ms-1"></i>
                                        </span>
                                        <span v-else>Not Yet Available</span>
                                    </button>

                                    <template v-else>
                                        <button class="btn btn-info text-white w-100 rounded-pill"
                                            @click="viewStudentTestResult(test)">
                                            <i class="fas fa-chart-bar me-1"></i>View Results
                                        </button>
                                        <button class="btn btn-outline-success w-100 rounded-pill"
                                            :disabled="reviewLoading === test.id"
                                            @click="reviewAnswers(test)">
                                            <i class="fas me-1"
                                                :class="reviewLoading === test.id ? 'fa-spinner fa-spin' : 'fa-search'"></i>
                                            {{ reviewLoading === test.id ? 'Loading...' : 'Review Answers' }}
                                        </button>
                                    </template>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Result Modal -->
        <Teleport to="body">
            <div class="modal fade" id="studentResultModal" tabindex="-1" ref="studentResultModal">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                Test Result: {{ selectedStudentResult?.name }}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" v-if="selectedStudentResult">
                            <div v-if="selectedStudentResult.offlineOnly" class="alert alert-warning small mb-3">
                                <i class="fas fa-info-circle me-1"></i>
                                Detailed results will be available when you reconnect.
                            </div>
                            <div class="text-center mb-4">
                                <div class="display-4 fw-bold"
                                    :class="selectedStudentResult.score >= 80 ? 'text-success'
                                          : selectedStudentResult.score >= 60 ? 'text-warning'
                                          : 'text-danger'">
                                    {{ selectedStudentResult.score !== null ? selectedStudentResult.score + '%' : '—' }}
                                </div>
                                <p class="text-muted mb-0">Your Score</p>
                                <small class="text-muted">
                                    {{ selectedStudentResult.rawScore ?? '?' }} /
                                    {{ selectedStudentResult.totalQuestions ?? '?' }} correct
                                </small>
                            </div>
                            <div class="row text-center mb-3 g-3">
                                <div class="col-md-4">
                                    <div class="card bg-light border-0">
                                        <div class="card-body py-3">
                                            <div class="fw-semibold text-muted small mb-1">
                                                <i class="fas fa-user me-1"></i>Created By
                                            </div>
                                            <div class="fw-bold">{{ selectedStudentResult.creatorName || 'N/A' }}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card bg-light border-0">
                                        <div class="card-body py-3">
                                            <div class="fw-semibold text-muted small mb-1">
                                                <i class="fas fa-stopwatch me-1"></i>Time Spent
                                            </div>
                                            <div class="fw-bold">{{ formatDuration(selectedStudentResult.durationSeconds) }}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card bg-light border-0">
                                        <div class="card-body py-3">
                                            <div class="fw-semibold text-muted small mb-1">
                                                <i class="fas fa-calendar-check me-1"></i>Completed At
                                            </div>
                                            <div class="fw-bold">{{ formatDateTime(selectedStudentResult.completedAt) }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="text-center mt-3">
                                <button class="btn btn-outline-success rounded-pill px-4"
                                    :disabled="reviewLoading === currentReviewTest?.id"
                                    @click="reviewAnswersFromModal">
                                    <i class="fas me-1"
                                        :class="reviewLoading === currentReviewTest?.id ? 'fa-spinner fa-spin' : 'fa-search'"></i>
                                    {{ reviewLoading === currentReviewTest?.id ? 'Loading...' : 'Review Answers' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useTestStore } from '../stores/tests';
import { useQuestionStore } from '../stores/questions';
import * as bootstrap from 'bootstrap';
import api from '../services/api';
import { Network } from '@capacitor/network';
import {
    initDB, cacheAssignments, getCachedAssignments,
    cacheExamQuestions, getCachedExamQuestions,
    getPendingAnswerAssignmentIds, getOfflineAnswers
} from '../services/db';

const ASSIGNMENTS_TIMEOUT_MS = 5000;

export default {
    name: 'StudentDashboard',

    data() {
        return {
            selectedStudentResult: null,
            studentResultBsModal:  null,
            assignedTests:         [],
            currentReviewTest:     null,
            reviewLoading:         null,
            isOffline:             false,
            hasPendingAnswers:     false,
            loading:               true,
            dbReady:               false
        };
    },

    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useTestStore, ['pilotTests', 'studentTests'])
    },

    methods: {
        ...mapActions(useTestStore, ['setSelectedReport', 'setSelectedStudentResult']),

        // ── Status helpers ──────────────────────────────────────────────────────

        isCompleted(test) {
            const s = String(test.status ?? '').toLowerCase().trim();
            return s === 'completed' || s === 'complete' || s === 'done' || s === '3' || s.includes('complet');
        },

        isTestAvailable(test) {
            if (!test.start_date) return true;
            return new Date() >= new Date(test.start_date);
        },

        getStudentId() {
            const u = useAuthStore().user;
            return Number(u?.student?.id ?? u?.student_id ?? u?.id ?? 0);
        },

        _normalizeTestStatus(raw) {
            const s = String(raw ?? '').toLowerCase().trim();
            if (s === '3' || s === 'completed' || s === 'complete' || s === 'done' || s === 'finished') return 'Completed';
            if (s === '2' || s === 'in_progress' || s === 'in progress' || s === 'started' || s === 'ongoing') return 'In Progress';
            return 'Not Started';
        },

        mergeStatusFromStore(tests) {
            const testStore = useTestStore();
            const sid = this.getStudentId();
            return tests.map(test => {
                const examId       = Number(test.exam_id || test.exam?.id);
                const assignmentId = Number(test.id);
                const stByAid  = testStore.studentTests.find(s => Number(s.assignmentId) === assignmentId);
                const stByExam = testStore.studentTests.find(s => Number(s.testId) === examId && Number(s.studentId) === sid);
                const st = stByAid || stByExam;
                let status = this._normalizeTestStatus(test.status ?? st?.status ?? '');
                if (st && this.isCompleted({ status: st.status })) status = 'Completed';
                return { ...test, status };
            });
        },

        // ── DB safe wrappers ────────────────────────────────────────────────────

        async safeGetCachedAssignments(sid)        { return this.dbReady ? getCachedAssignments(sid).catch(() => [])          : []; },
        async safeCacheAssignments(sid, tests)      { if (this.dbReady) cacheAssignments(sid, tests).catch(() => {}); },
        async safeGetCachedExamQuestions(examId)   { return this.dbReady ? getCachedExamQuestions(examId).catch(() => [])     : []; },
        async safeCacheExamQuestions(examId, qs)   { if (this.dbReady) cacheExamQuestions(examId, qs).catch(() => {}); },
        async safeGetOfflineAnswers(assignmentId)  { return this.dbReady ? getOfflineAnswers(assignmentId).catch(() => [])   : []; },
        async safeGetPendingIds()                  { return this.dbReady ? getPendingAnswerAssignmentIds().catch(() => [])    : []; },

        // ── Load assignments ────────────────────────────────────────────────────

        async loadAssignedTests() {
            this.loading = true;
            const sid = this.getStudentId();

            // Offline: serve from cache immediately
            if (this.isOffline) {
                this.assignedTests = this.mergeStatusFromStore(await this.safeGetCachedAssignments(sid));
                this.loading = false;
                return;
            }

            // Show cache while fetching
            const cached = await this.safeGetCachedAssignments(sid);
            if (cached.length) {
                this.assignedTests = this.mergeStatusFromStore(cached);
                this.loading = false;
            }

            // Race API vs timeout
            let freshTests = null;
            try {
                const apiPromise = api.get('/student-exam-assignments').then(res => {
                    const raw  = res.data;
                    const list = raw?.questionList ?? raw?.data ?? raw ?? [];
                    return Array.isArray(list) ? list : [];
                });
                const timeout = new Promise(r => setTimeout(() => r(null), ASSIGNMENTS_TIMEOUT_MS));
                freshTests = await Promise.race([apiPromise, timeout]);
            } catch (e) {
                console.error('[Dashboard] Assignments API error:', e);
            }

            if (freshTests?.length) {
                try { await useTestStore().fetchStudentAssignments(sid); } catch (_) {}
                this.assignedTests = this.mergeStatusFromStore(freshTests);
                this.loading = false;
                // Cache in background
                this.safeCacheAssignments(sid, freshTests).catch(() => {});
            } else if (!cached.length) {
                this.assignedTests = [];
                this.loading = false;
            }
        },

        startTest(test) {
            const examId = Number(test.exam_id || test.exam?.id);
            const aid = Number(test.id); // assignmentId
            if (!examId) { alert('Could not determine exam ID.'); return; }
            this.$router.push({ name: 'testTaking', params: { id: examId, aid: aid } });
        },

        // ── Duration / date formatters ──────────────────────────────────────────

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

        formatDuration(seconds) {
            const s = Math.round(Number(seconds));
            if (!Number.isFinite(s) || s <= 0) return '—';
            const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
            if (h > 0) return `${h}h ${m}m ${sec}s`;
            if (m > 0) return `${m}m ${sec}s`;
            return `${sec}s`;
        },

        formatDateTime(iso) {
            if (!iso) return '—';
            const d = new Date(iso);
            return isNaN(d.getTime()) ? '—' : d.toLocaleString();
        },

        // ── Build result from /student-answers/check response ───────────────────

        async _parseCheckResponse(result, testName, completedAt) {
            const questionStore   = useQuestionStore();
            const rawScore        = Number(result.raw_score ?? result.score ?? 0);
            const total           = Number(result.total ?? 0);
            let percent           = Number(result.score ?? 0);
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
                
                if (a.time_spent !== undefined) {
                    questionTimes[qid] = Number(a.time_spent);
                }
            }

            // Fill in question_text from store for any missing entries
            for (const [key, entry] of Object.entries(answersMap)) {
                if (!entry.question_text && !isNaN(Number(key))) {
                    const q = questionStore.questions.find(x => Number(x.id) === Number(key));
                    if (q) entry.question_text = q.text;
                }
            }

            return {
                name: testName, creatorName: result.created_by || 'N/A',
                durationSeconds, completedAt: result.completed_at || completedAt || null,
                score: percent, rawScore, totalQuestions: total,
                answers: answersMap, questionTimes, offlineOnly: false
            };
        },

        // ── View result modal ───────────────────────────────────────────────────

        async viewStudentTestResult(test) {
            const testName = test.exam?.name || test.exam_name || 'Untitled Test';

            if (this.isOffline) {
                const testStore = useTestStore();
                const sid       = this.getStudentId();
                const examId    = Number(test.exam_id || test.exam?.id);
                const st        = testStore.studentTests.find(
                    s => Number(s.testId) === examId && Number(s.studentId) === sid
                );
                this.selectedStudentResult = {
                    name: testName, creatorName: 'N/A',
                    durationSeconds: st?.durationSeconds || 0,
                    completedAt:     st?.completedAt || null,
                    score:           st?.score ?? null,
                    rawScore:        st?.rawScore ?? null,
                    totalQuestions:  st?.totalQuestions ?? 0,
                    answers: {}, offlineOnly: true
                };
                this.currentReviewTest = test;
                this._ensureModal();
                this.studentResultBsModal.show();
                return;
            }

            try {
                const res = await api.get('/student-answers/check/' + test.id);
                if (!res.data.completed) {
                    // Try refreshing assignments once if server says not completed
                    console.warn('[Dashboard] Server says test not completed. Refreshing assignments...');
                    await useTestStore().fetchStudentAssignments(this.getStudentId());
                    const updatedTest = this.studentTests.find(st => Number(st.assignmentId) === Number(test.id));
                    if (updatedTest?.status !== 'Completed') {
                        alert('This test has not been completed yet.');
                        return;
                    }
                    // If refresh showed it IS completed, try the check API again
                    const retryRes = await api.get('/student-answers/check/' + test.id);
                    if (!retryRes.data.completed) {
                        alert('This test has not been completed yet.');
                        return;
                    }
                    this.selectedStudentResult = await this._parseCheckResponse(retryRes.data, testName, test.completed_at);
                } else {
                    this.selectedStudentResult = await this._parseCheckResponse(res.data, testName, test.completed_at);
                }
                this.currentReviewTest = test;
                this._ensureModal();
                this.studentResultBsModal.show();
            } catch (e) {
                console.error('Failed to fetch test result:', e);
                alert('Could not load test results. Please try again later.');
            }
        },

        // ── Review answers ──────────────────────────────────────────────────────

        async reviewAnswers(test) {
            const examId       = Number(test.exam_id || test.exam?.id);
            const assignmentId = Number(test.id);
            if (!examId || !assignmentId) { alert('Missing exam or assignment information.'); return; }

            this.reviewLoading = test.id;
            try {
                const testStore     = useTestStore();
                const questionStore = useQuestionStore();
                const sid           = this.getStudentId();
                const testName      = test.exam?.name || test.exam_name || `Exam ${examId}`;

                // Load questions via ensureTestReady — single GET /exam-questions/{examId}
                await testStore.ensureTestReady(examId);

                const pilotTest   = testStore.pilotTests.find(t => Number(t.id) === examId);
                const questionIds = pilotTest?.questionIds?.length ? [...pilotTest.questionIds] : [];

                if (this.isOffline) {
                    const offlineRows = await this.safeGetOfflineAnswers(assignmentId);
                    const answersMap  = {};
                    offlineRows.forEach(row => {
                        answersMap[Number(row.question_id)] = { answer_value: row.answer_value, is_correct: null };
                        answersMap[String(row.question_id)] = { answer_value: row.answer_value, is_correct: null };
                    });
                    const st = testStore.studentTests.find(
                        s => Number(s.testId) === examId && Number(s.studentId) === sid
                    );
                    const payload = {
                        studentId: sid, testId: examId, assignmentId, name: testName,
                        score: st?.score ?? 0, rawScore: st?.rawScore ?? 0,
                        totalQuestions: questionIds.length || st?.totalQuestions || 0,
                        durationSeconds: st?.durationSeconds ?? 0,
                        completedAt: st?.completedAt ?? null, answers: answersMap
                    };
                    testStore.setSelectedReport({
                        id: examId, name: testName, description: test.exam?.description || '',
                        questionIds, participants: 1, avgScore: payload.score, studentResults: [payload]
                    });
                    testStore.setSelectedStudentResult(payload);
                    this.$router.push({ name: 'studentResultDetail', query: { back: 'studentDashboard' } });
                    return;
                }

                let res = await api.get('/student-answers/check/' + assignmentId);
                if (!res.data.completed) {
                    // Try refreshing assignments once if server says not completed
                    console.warn('[Dashboard] Server says test not completed. Refreshing assignments...');
                    await useTestStore().fetchStudentAssignments(sid);
                    const updatedTest = this.studentTests.find(st => Number(st.assignmentId) === assignmentId);
                    if (updatedTest?.status !== 'Completed') {
                        alert('This test has not been completed yet.');
                        return;
                    }
                    // If refresh showed it IS completed, try the check API again
                    res = await api.get('/student-answers/check/' + assignmentId);
                    if (!res.data.completed) {
                        alert('This test has not been completed yet.');
                        return;
                    }
                }

                const parsed = await this._parseCheckResponse(res.data, testName, test.completed_at);

                // Fill blanks for any question without a recorded answer
                const resolvedIds = questionIds.length
                    ? questionIds
                    : Object.keys(parsed.answers).map(Number).filter(n => n > 0);

                resolvedIds.forEach(qid => {
                    if (!parsed.answers[qid]) {
                        const q     = questionStore.questions.find(x => Number(x.id) === qid);
                        const blank = { answer_value: '', is_correct: false, question_text: q?.text || '' };
                        parsed.answers[qid]         = blank;
                        parsed.answers[String(qid)] = blank;
                    }
                });

                const payload = {
                    studentId: sid, testId: examId, assignmentId,
                    name: parsed.name, score: parsed.score, rawScore: parsed.rawScore,
                    totalQuestions: parsed.totalQuestions || resolvedIds.length,
                    durationSeconds: parsed.durationSeconds, completedAt: parsed.completedAt,
                    answers: parsed.answers
                };

                testStore.setSelectedReport({
                    id: examId, name: testName, description: test.exam?.description || '',
                    questionIds: resolvedIds, participants: 1,
                    avgScore: parsed.score, studentResults: [payload]
                });
                testStore.setSelectedStudentResult(payload);
                this.$router.push({ name: 'studentResultDetail', query: { back: 'studentDashboard' } });

            } catch (e) {
                console.error('[ReviewAnswers] Failed:', e);
                alert('Could not load answer review. Please try again.');
            } finally {
                this.reviewLoading = null;
            }
        },

        reviewAnswersFromModal() {
            const modalEl = this.$refs.studentResultModal;
            const test    = this.currentReviewTest;
            if (!test) return;
            if (this.studentResultBsModal && modalEl) {
                if (document.activeElement && modalEl.contains(document.activeElement)) {
                    document.activeElement.blur();
                }
                modalEl.addEventListener('hidden.bs.modal', () => { this.reviewAnswers(test); }, { once: true });
                this.studentResultBsModal.hide();
            } else {
                this.reviewAnswers(test);
            }
        },

        _ensureModal() {
            if (!this.studentResultBsModal && this.$refs.studentResultModal) {
                this.studentResultBsModal = new bootstrap.Modal(this.$refs.studentResultModal);
            }
        }
    },

    async mounted() {
        try { await initDB(); this.dbReady = true; }
        catch (e) { console.warn('[Dashboard] SQLite unavailable:', e.message); }

        try {
            const status    = await Network.getStatus();
            this.isOffline  = !status.connected;
        } catch (_) { this.isOffline = false; }

        Network.addListener('networkStatusChange', async s => {
            this.isOffline = !s.connected;
            if (!this.isOffline) await this.loadAssignedTests();
        });

        await this.loadAssignedTests();

        const pending         = await this.safeGetPendingIds();
        this.hasPendingAnswers = pending.length > 0;
        this._ensureModal();
    },

    beforeUnmount() {
        if (this.studentResultBsModal) {
            this.studentResultBsModal.dispose();
            this.studentResultBsModal = null;
        }
    }
};
</script>

<style scoped>
.hover-lift { transition: transform 0.2s; }
.hover-lift:hover { transform: translateY(-5px); }
.test-card-wrapper { width: 220px; min-width: 220px; flex-shrink: 0; }
.card-title-clamp {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 3rem;
}
</style>
