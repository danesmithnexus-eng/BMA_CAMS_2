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

                <div v-else-if="assignedTests.length === 0" class="text-center text-muted p-5 bg-white rounded border">
                    You have no tests assigned.
                </div>

                <!-- KEY FIX: switched from Bootstrap grid (row/col) to flex-wrap
                     with a fixed-width wrapper so cards always have enough room
                     for button text regardless of sidebar/container constraints -->
                <div v-else class="d-flex flex-wrap gap-3">
                    <div v-for="test in assignedTests" :key="test.id" class="test-card-wrapper">
                        <div class="card h-100 shadow-sm border-0 hover-lift">
                            <div class="card-body d-flex flex-column p-3">
                                <h5 class="card-title fw-bold text-primary mb-3 card-title-clamp">
                                    {{ test.exam && test.exam.name ? test.exam.name : (test.exam_name || ('Exam ' + test.exam_id)) }}
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
                                    <button v-if="!isCompleted(test)" class="btn btn-primary w-100 rounded-pill"
                                        :disabled="!isTestAvailable(test)" @click="startTest(test)">
                                        <span v-if="isTestAvailable(test)">Start Test <i class="fas fa-arrow-right ms-1"></i></span>
                                        <span v-else>Not Yet Available</span>
                                    </button>

                                    <template v-else>
                                        <button class="btn btn-info text-white w-100 rounded-pill"
                                            @click="viewStudentTestResult(test)">
                                            <i class="fas fa-chart-bar me-1"></i>View Results
                                        </button>
                                        <button class="btn btn-outline-success w-100 rounded-pill"
                                            :disabled="reviewLoading === test.id" @click="reviewAnswers(test)">
                                            <i class="fas me-1" :class="reviewLoading === test.id ? 'fa-spinner fa-spin' : 'fa-search'"></i>
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

        <Teleport to="body">
            <div class="modal fade" id="studentResultModal" tabindex="-1" ref="studentResultModal">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Test Result: {{ selectedStudentResult && selectedStudentResult.name }}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" v-if="selectedStudentResult">
                            <div v-if="selectedStudentResult.offlineOnly" class="alert alert-warning small mb-3">
                                <i class="fas fa-info-circle me-1"></i>
                                Detailed results will be available when you reconnect to the internet.
                            </div>
                            <div class="text-center mb-4">
                                <div class="display-4 fw-bold"
                                    :class="selectedStudentResult.score >= 80 ? 'text-success' : selectedStudentResult.score >= 60 ? 'text-warning' : 'text-danger'">
                                    {{ selectedStudentResult.score !== null ? selectedStudentResult.score + '%' : '\u2014' }}
                                </div>
                                <p class="text-muted mb-0">Your Score</p>
                                <small class="text-muted">
                                    {{ selectedStudentResult.rawScore != null ? selectedStudentResult.rawScore : '?' }} /
                                    {{ selectedStudentResult.totalQuestions != null ? selectedStudentResult.totalQuestions : '?' }} correct
                                </small>
                            </div>
                            <div class="row text-center mb-3 g-3">
                                <div class="col-md-4">
                                    <div class="card bg-light border-0">
                                        <div class="card-body py-3">
                                            <div class="fw-semibold text-muted small mb-1"><i class="fas fa-user me-1"></i>Created By</div>
                                            <div class="fw-bold">{{ selectedStudentResult.creatorName || 'N/A' }}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card bg-light border-0">
                                        <div class="card-body py-3">
                                            <div class="fw-semibold text-muted small mb-1"><i class="fas fa-stopwatch me-1"></i>Time Spent</div>
                                            <div class="fw-bold">{{ formatDuration(selectedStudentResult.durationSeconds) }}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card bg-light border-0">
                                        <div class="card-body py-3">
                                            <div class="fw-semibold text-muted small mb-1"><i class="fas fa-calendar-check me-1"></i>Completed At</div>
                                            <div class="fw-bold">{{ formatDateTime(selectedStudentResult.completedAt) }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="text-center mt-3">
                                <button class="btn btn-outline-success rounded-pill px-4"
                                    :disabled="reviewLoading === (currentReviewTest && currentReviewTest.id)"
                                    @click="reviewAnswersFromModal()">
                                    <i class="fas me-1" :class="reviewLoading === (currentReviewTest && currentReviewTest.id) ? 'fa-spinner fa-spin' : 'fa-search'"></i>
                                    {{ reviewLoading === (currentReviewTest && currentReviewTest.id) ? 'Loading...' : 'Review Answers' }}
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
            studentResultBsModal: null,
            assignedTests: [],
            currentReviewTest: null,
            reviewLoading: null,
            isOffline: false,
            hasPendingAnswers: false,
            loading: true,
            dbReady: false
        };
    },
    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useTestStore, ['pilotTests', 'studentTests']),
    },
    methods: {
        ...mapActions(useTestStore, ['setActiveTest', 'ensureTestReady', 'setSelectedReport', 'setSelectedStudentResult']),
        isCompleted(test) { return String(test.status || '').toLowerCase().includes('complet'); },
        isTestAvailable(test) { if (!test.start_date) return true; return new Date() >= new Date(test.start_date); },
        getStudentId() {
            const authStore = useAuthStore();
            return Number(authStore.user && authStore.user.student && authStore.user.student.id
                ? authStore.user.student.id
                : authStore.user && authStore.user.student_id != null
                    ? authStore.user.student_id
                    : authStore.user ? authStore.user.id : 0);
        },
        mergeStatusFromStore(tests) {
            const testStore = useTestStore();
            const sid = this.getStudentId();
            return tests.map(test => {
                const examId = Number(test.exam_id || (test.exam && test.exam.id));
                const assignmentId = Number(test.id);
                const stByAid = testStore.studentTests.find(s => Number(s.assignmentId) === assignmentId);
                const stByExam = testStore.studentTests.find(s => Number(s.testId) === examId && Number(s.studentId) === sid);
                const st = stByAid || stByExam;
                if (st && String(st.status || '').toLowerCase().includes('complet')) return { ...test, status: 'Completed' };
                return test;
            });
        },
        async safeGetCachedAssignments(sid) { if (!this.dbReady) return []; return getCachedAssignments(sid).catch(() => []); },
        async safeCacheAssignments(sid, tests) { if (!this.dbReady) return; return cacheAssignments(sid, tests).catch(() => {}); },
        async safeGetCachedExamQuestions(examId) { if (!this.dbReady) return []; return getCachedExamQuestions(examId).catch(() => []); },
        async safeCacheExamQuestions(examId, qs) { if (!this.dbReady) return; return cacheExamQuestions(examId, qs).catch(() => {}); },
        async safeGetOfflineAnswers(assignmentId) { if (!this.dbReady) return []; return getOfflineAnswers(assignmentId).catch(() => []); },
        async safeGetPendingAnswerAssignmentIds() { if (!this.dbReady) return []; return getPendingAnswerAssignmentIds().catch(() => []); },
        async loadAssignedTests() {
            this.loading = true;
            const studentId = this.getStudentId();
            if (this.isOffline) {
                const cached = await this.safeGetCachedAssignments(studentId);
                this.assignedTests = this.mergeStatusFromStore(cached);
                this.loading = false;
                return;
            }
            const cachedEarly = await this.safeGetCachedAssignments(studentId);
            if (cachedEarly.length) { this.assignedTests = this.mergeStatusFromStore(cachedEarly); this.loading = false; }
            let resolved = false;
            const apiPromise = api.get('/student-exam-assignments').then(res => {
                const list = res.data && res.data.questionList ? res.data.questionList : (res.data && res.data.data ? res.data.data : (res.data || []));
                return Array.isArray(list) ? list : [];
            });
            const timeoutPromise = new Promise(resolve => setTimeout(() => { if (!resolved) resolve(null); }, ASSIGNMENTS_TIMEOUT_MS));
            let freshTests = null;
            try { freshTests = await Promise.race([apiPromise, timeoutPromise]); resolved = true; }
            catch (e) { resolved = true; console.error('[Dashboard] Assignments API error:', e); }
            if (freshTests && freshTests.length) {
                this.assignedTests = freshTests;
                this.loading = false;
                this.safeCacheAssignments(studentId, freshTests).then(() => this.prefetchAndCacheQuestions()).catch(e => console.warn('[Dashboard] Background cache error:', e));
            } else if (!cachedEarly.length) { this.assignedTests = []; this.loading = false; }
        },
        async prefetchAndCacheQuestions() {
            const examIds = [...new Set(this.assignedTests.map(t => Number(t.exam_id || (t.exam && t.exam.id))).filter(Boolean))];
            for (const examId of examIds) {
                try {
                    const existing = await this.safeGetCachedExamQuestions(examId);
                    if (existing.length > 0) continue;
                    const rQ = await api.get('/exam-questions/' + examId);
                    const root = rQ && rQ.data ? rQ.data : null;
                    const listQ = Array.isArray(root && root.questionList ? root.questionList : []) ? root.questionList : [];
                    if (!listQ.length) continue;
                    const questions = listQ.map(it => {
                        const base = it && it.question ? it.question : it;
                        const qid = Number(base && base.id ? base.id : (it && it.question_id ? it.question_id : 0));
                        if (!qid) return null;
                        const id = base.question_type_id;
                        const str = String(base.question_type || '').toLowerCase();
                        const typeLabel = id === 1 ? 'True or False' : id === 2 ? 'Multiple Choice' : id === 3 ? 'Matching Type' : id === 4 ? 'Identification' : id === 5 ? 'Enumeration' : str.includes('true') ? 'True or False' : str.includes('multiple') ? 'Multiple Choice' : str.includes('matching') ? 'Matching Type' : str.includes('identification') ? 'Identification' : 'Multiple Choice';
                        let options = [], pairs = [], answerIndex, answer;
                        if (typeLabel === 'Multiple Choice') {
                            const mc = base.multiple_choice_answers || base.multipleChoiceAnswers || base.options || [];
                            const sorted = Array.isArray(mc) ? [...mc].sort((a, b) => Number(a.option_order || 0) - Number(b.option_order || 0)) : [];
                            options = sorted.map(a => ({ text: a.option_text || a.text || String(a.value || '') })).filter(o => o.text);
                            const ci = sorted.findIndex(a => { const v = a.is_correct != null ? a.is_correct : a.correct; return typeof v === 'boolean' ? v : Number(v) === 1; });
                            if (ci >= 0) answerIndex = ci;
                        } else if (typeLabel === 'Matching Type') {
                            const mp = base.pairs || base.matching_pairs || [];
                            pairs = Array.isArray(mp) ? mp.map(p => ({ prompt: p.prompt || p.left || '', answer: p.answer || p.right || '' })) : [];
                        } else if (typeLabel === 'True or False') {
                            const ca = base.correct_answer != null ? base.correct_answer : (base.answer != null ? base.answer : (base.trueFalseAnswer && base.trueFalseAnswer.is_true != null ? base.trueFalseAnswer.is_true : null));
                            if (ca != null) answer = (typeof ca === 'boolean' ? ca : String(ca).toLowerCase() === 'true') ? 'True' : 'False';
                        } else if (typeLabel === 'Identification') {
                            const ca = base.correct_answer != null ? base.correct_answer : (base.answer != null ? base.answer : base.key);
                            if (ca != null) answer = String(ca);
                        }
                        const loRaw = base.learning_outcome || '';
                        const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';
                        return { id: qid, text: base.text || base.question_text || '', type: typeLabel, options, pairs, answerIndex, answer, cognitiveLevel: base.cognitive_level || 'Remembering', loTags: loNorm ? [loNorm] : [], status: 'Approved', program: '', course: '' };
                    }).filter(Boolean);
                    if (questions.length) await this.safeCacheExamQuestions(examId, questions);
                } catch (e) { console.warn('[Dashboard] Could not cache exam ' + examId + ':', e); }
            }
        },
        _loadQuestionsIntoStore(cachedQs, examId, test, testStore, questionStore) {
            for (const q of cachedQs) { const existing = questionStore.questions.find(x => Number(x.id) === Number(q.id)); if (existing) questionStore.updateQuestion(q); else questionStore.addQuestion(q); }
            if (!testStore.pilotTests.find(t => Number(t.id) === examId)) {
                testStore.addTest({ id: examId, name: (test.exam && test.exam.name) || ('Exam ' + examId), description: (test.exam && test.exam.description) || '', questionIds: cachedQs.map(q => q.id), timeLimit: Number((test.exam && test.exam.time_limit) || test.time_limit || 60) });
            } else {
                const idx = testStore.pilotTests.findIndex(t => Number(t.id) === examId);
                if (idx >= 0 && !(testStore.pilotTests[idx].questionIds && testStore.pilotTests[idx].questionIds.length)) testStore.pilotTests[idx].questionIds = cachedQs.map(q => q.id);
            }
        },
        async startTest(test) {
            const testStore = useTestStore(); const questionStore = useQuestionStore();
            const examId = Number(test.exam_id || (test.exam && test.exam.id)); const sid = this.getStudentId();
            if (this.isOffline) {
                const cachedQs = await this.safeGetCachedExamQuestions(examId);
                if (!cachedQs.length) { alert('This exam is not available offline. Please connect to the internet first.'); return; }
                this._loadQuestionsIntoStore(cachedQs, examId, test, testStore, questionStore);
                if (!testStore.studentTests.find(st => Number(st.testId) === examId && Number(st.studentId) === sid)) { testStore.studentTests.push({ studentId: sid, testId: examId, name: (test.exam && test.exam.name) || ('Exam ' + examId), status: 'Not Started', score: null, answers: {}, assignmentId: Number(test.id) }); }
                const pilotTest = testStore.pilotTests.find(t => Number(t.id) === examId);
                if (!testStore.setActiveTest(pilotTest)) { test.status = 'completed'; return; }
                this.$router.push({ name: 'testTaking', params: { id: examId } }); return;
            }
            const cachedQs = await this.safeGetCachedExamQuestions(examId);
            if (cachedQs.length) {
                this._loadQuestionsIntoStore(cachedQs, examId, test, testStore, questionStore);
                const pilotTest = testStore.pilotTests.find(t => Number(t.id) === examId);
                if (!testStore.setActiveTest(pilotTest || test)) { test.status = 'completed'; return; }
                this.$router.push({ name: 'testTaking', params: { id: examId } }); return;
            }
            const ensured = await testStore.ensureTestReady(examId);
            if (!testStore.setActiveTest(ensured || test)) { test.status = 'completed'; return; }
            this.$router.push({ name: 'testTaking', params: { id: examId } });
        },
        buildAnswersMap(rawAnswers) {
            const answersMap = {};
            (Array.isArray(rawAnswers) ? rawAnswers : []).forEach(a => {
                if (a.question_id == null) return;
                const rc = a.is_correct;
                const entry = { answer_value: a.answer_value != null ? a.answer_value : '', is_correct: rc === true || rc === 1 || rc === '1' || String(rc).toLowerCase() === 'true' };
                answersMap[Number(a.question_id)] = entry; answersMap[String(a.question_id)] = entry;
            });
            return answersMap;
        },
        async viewStudentTestResult(test) {
            if (this.isOffline) {
                const assignmentId = Number(test.id);
                const cachedAnswers = await this.safeGetOfflineAnswers(assignmentId);
                const testStore = useTestStore(); const sid = this.getStudentId(); const examId = Number(test.exam_id || (test.exam && test.exam.id));
                const st = testStore.studentTests.find(s => Number(s.testId) === examId && Number(s.studentId) === sid);
                this.selectedStudentResult = { name: (test.exam && test.exam.name) || test.exam_name || 'Untitled Test', creatorName: 'N/A', durationSeconds: (st && st.durationSeconds) || 0, completedAt: (st && st.completedAt) || null, score: st ? st.score : null, rawScore: st ? st.rawScore : null, totalQuestions: st ? st.totalQuestions : cachedAnswers.length, answers: {}, offlineOnly: true };
                this.currentReviewTest = test;
                if (!this.studentResultBsModal) this.studentResultBsModal = new bootstrap.Modal(this.$refs.studentResultModal);
                this.studentResultBsModal.show(); return;
            }
            try {
                const response = await api.get('/student-answers/check/' + test.id); const result = response.data;
                if (!result.completed) { alert('This test has not been completed yet.'); return; }
                this.selectedStudentResult = { name: (test.exam && test.exam.name) || test.exam_name || 'Untitled Test', creatorName: result.created_by || 'N/A', durationSeconds: Number(result.time_spent) || 0, completedAt: test.completed_at || null, score: Number(result.total) > 0 ? Math.round((Number(result.score) / Number(result.total)) * 100) : 0, rawScore: result.score, totalQuestions: result.total, answers: this.buildAnswersMap(result.answers), offlineOnly: false };
                this.currentReviewTest = test;
                if (!this.studentResultBsModal) this.studentResultBsModal = new bootstrap.Modal(this.$refs.studentResultModal);
                this.studentResultBsModal.show();
            } catch (error) { console.error('Failed to fetch test result:', error); alert('Could not load test results. Please try again later.'); }
        },
        async reviewAnswers(test) {
            const examId = Number(test.exam_id || (test.exam && test.exam.id)); const assignmentId = test.id;
            if (!examId || !assignmentId) { alert('Missing exam or assignment information.'); return; }
            this.reviewLoading = test.id;
            try {
                const testStore = useTestStore(); const questionStore = useQuestionStore(); const sid = this.getStudentId();
                if (this.isOffline) {
                    const cachedQs = await this.safeGetCachedExamQuestions(examId);
                    if (cachedQs.length) this._loadQuestionsIntoStore(cachedQs, examId, test, testStore, questionStore);
                    const offlineRows = await this.safeGetOfflineAnswers(assignmentId); const answersMap = {};
                    offlineRows.forEach(row => { answersMap[Number(row.question_id)] = { answer_value: row.answer_value, is_correct: null }; answersMap[String(row.question_id)] = { answer_value: row.answer_value, is_correct: null }; });
                    const pilotTest = testStore.pilotTests.find(t => Number(t.id) === examId); const st = testStore.studentTests.find(s => Number(s.testId) === examId && Number(s.studentId) === sid);
                    const payload = { studentId: this.currentUser && this.currentUser.id, testId: examId, assignmentId, score: (st && st.score) || 0, rawScore: (st && st.rawScore) || 0, totalQuestions: (pilotTest && pilotTest.questionIds && pilotTest.questionIds.length) || 0, durationSeconds: (st && st.durationSeconds) || 0, completedAt: (st && st.completedAt) || null, answers: answersMap };
                    testStore.setSelectedReport({ id: examId, name: (test.exam && test.exam.name) || test.exam_name || ('Exam ' + examId), description: (test.exam && test.exam.description) || '', questionIds: (pilotTest && pilotTest.questionIds) || [], participants: 1, avgScore: (st && st.score) || 0, studentResults: [payload] });
                    testStore.setSelectedStudentResult(payload);
                    this.$router.push({ name: 'studentResultDetail', query: { back: 'studentDashboard' } }); return;
                }
                const cachedQs = await this.safeGetCachedExamQuestions(examId);
                if (cachedQs.length) this._loadQuestionsIntoStore(cachedQs, examId, test, testStore, questionStore);
                else await testStore.ensureTestReady(examId);
                const response = await api.get('/student-answers/check/' + assignmentId); const result = response.data;
                const answersMap = this.buildAnswersMap(result.answers); const pilotTest = testStore.pilotTests.find(t => Number(t.id) === examId);
                const rawScore = Number(result.score) || 0; const total = Number(result.total) || 0; const percent = total > 0 ? Math.round((rawScore / total) * 100) : 0;
                const payload = { studentId: this.currentUser && this.currentUser.id, testId: examId, assignmentId, score: percent, rawScore, totalQuestions: total, durationSeconds: Number(result.time_spent) || 0, completedAt: test.completed_at || null, answers: answersMap };
                testStore.setSelectedReport({ id: examId, name: (test.exam && test.exam.name) || test.exam_name || ('Exam ' + examId), description: (test.exam && test.exam.description) || '', questionIds: (pilotTest && pilotTest.questionIds) || [], participants: 1, avgScore: percent, studentResults: [payload] });
                testStore.setSelectedStudentResult(payload);
                this.$router.push({ name: 'studentResultDetail', query: { back: 'studentDashboard' } });
            } catch (error) { console.error('Failed to load review:', error); alert('Could not load answer review. Please try again.'); }
            finally { this.reviewLoading = null; }
        },
        reviewAnswersFromModal() {
            const modalEl = this.$refs.studentResultModal; const test = this.currentReviewTest; if (!test) return;
            if (this.studentResultBsModal && modalEl) {
                if (document.activeElement && modalEl.contains(document.activeElement)) document.activeElement.blur();
                modalEl.addEventListener('hidden.bs.modal', () => { this.reviewAnswers(test); }, { once: true });
                this.studentResultBsModal.hide();
            } else { this.reviewAnswers(test); }
        },
        formatDuration(seconds) {
            const s = Math.round(Number(seconds)); if (!Number.isFinite(s) || s <= 0) return '\u2014';
            const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
            if (h > 0) return h + 'h ' + m + 'm ' + sec + 's'; if (m > 0) return m + 'm ' + sec + 's'; return sec + 's';
        },
        formatDateTime(iso) { if (!iso) return '\u2014'; const d = new Date(iso); return isNaN(d.getTime()) ? '\u2014' : d.toLocaleString(); }
    },
    async mounted() {
        try { await initDB(); this.dbReady = true; } catch (e) { console.warn('[Dashboard] SQLite unavailable:', e.message); this.dbReady = false; }
        try { const status = await Network.getStatus(); this.isOffline = !status.connected; } catch (_) { this.isOffline = false; }
        Network.addListener('networkStatusChange', async (s) => { this.isOffline = !s.connected; if (!this.isOffline) await this.loadAssignedTests(); });
        await this.loadAssignedTests();
        const pending = await this.safeGetPendingAnswerAssignmentIds(); this.hasPendingAnswers = pending.length > 0;
        if (this.$refs.studentResultModal) this.studentResultBsModal = new bootstrap.Modal(this.$refs.studentResultModal);
    },
    beforeUnmount() { if (this.studentResultBsModal) { this.studentResultBsModal.dispose(); this.studentResultBsModal = null; } }
};
</script>

<style scoped>
.hover-lift { transition: transform 0.2s; }
.hover-lift:hover { transform: translateY(-5px); }

/*
 * KEY FIX: Give every card a fixed minimum width of 220px so that
 * button text ("View Results", "Review Answers") always fits on one
 * line no matter how narrow the parent container or sidebar makes things.
 * flex-shrink:0 prevents the card from being squeezed below this width.
 */
.test-card-wrapper {
    width: 220px;
    min-width: 220px;
    flex-shrink: 0;
}

/* Clamp exam title to 2 lines so tall titles don't break card height */
.card-title-clamp {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 3rem;
}
</style>