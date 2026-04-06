<template>
    <div>
        <h2 class="mb-4">Welcome, {{ currentUser ? currentUser.fname : 'Faculty' }}!</h2>

        <div v-if="isOffline" class="alert alert-warning py-2 small mb-3">
            <i class="fas fa-wifi me-1"></i> You are offline. Showing cached tests.
            <span v-if="hasPendingAnswers" class="ms-2 fw-semibold">
                <i class="fas fa-clock me-1"></i> You have unsynced answers that will be submitted when you reconnect.
            </span>
        </div>

        <div class="card bg-transparent border-0 shadow-none">
            <div class="card-header bg-transparent border-0 ps-0 fw-bold fs-5">
                Faculty Assigned Pilot Tests
            </div>

            <div class="card-body px-0">
                <div v-if="loading" class="text-center text-muted p-5">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p class="mt-2">Loading tests...</p>
                </div>

                <div v-else-if="assignedTests.length === 0" class="text-center text-muted p-5 bg-white rounded border">
                    You have no tests assigned.
                </div>

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
                                            @click="viewFacultyTestResult(test)">
                                            <i class="fas fa-chart-bar me-1"></i>View Results
                                        </button>
                                        <button class="btn btn-outline-success w-100 rounded-pill"
                                            :disabled="reviewLoading === test.id" @click="reviewAnswers(test)">
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

        <Teleport to="body">
            <div class="modal fade" id="facultyResultModal" tabindex="-1" ref="facultyResultModal">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                Test Result: {{ selectedFacultyResult && selectedFacultyResult.name }}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" v-if="selectedFacultyResult">
                            <div v-if="selectedFacultyResult.offlineOnly" class="alert alert-warning small mb-3">
                                <i class="fas fa-info-circle me-1"></i>
                                Detailed results will be available when you reconnect to the internet.
                            </div>
                            <div class="text-center mb-4">
                                <div class="display-4 fw-bold"
                                    :class="selectedFacultyResult.score >= 80 ? 'text-success'
                                        : selectedFacultyResult.score >= 60 ? 'text-warning'
                                        : 'text-danger'">
                                    {{ selectedFacultyResult.score !== null
                                        ? selectedFacultyResult.score + '%'
                                        : '\u2014' }}
                                </div>
                                <p class="text-muted mb-0">Your Score</p>
                                <small class="text-muted">
                                    {{ selectedFacultyResult.rawScore != null ? selectedFacultyResult.rawScore : '?' }} /
                                    {{ selectedFacultyResult.totalQuestions != null ? selectedFacultyResult.totalQuestions : '?' }}
                                    correct
                                </small>
                            </div>
                            <div class="row text-center mb-3 g-3">
                                <div class="col-md-4">
                                    <div class="card bg-light border-0">
                                        <div class="card-body py-3">
                                            <div class="fw-semibold text-muted small mb-1">
                                                <i class="fas fa-user me-1"></i>Created By
                                            </div>
                                            <div class="fw-bold">{{ selectedFacultyResult.creatorName || 'N/A' }}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card bg-light border-0">
                                        <div class="card-body py-3">
                                            <div class="fw-semibold text-muted small mb-1">
                                                <i class="fas fa-stopwatch me-1"></i>Time Spent
                                            </div>
                                            <div class="fw-bold">
                                                {{ formatDuration(selectedFacultyResult.durationSeconds) }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="card bg-light border-0">
                                        <div class="card-body py-3">
                                            <div class="fw-semibold text-muted small mb-1">
                                                <i class="fas fa-calendar-check me-1"></i>Completed At
                                            </div>
                                            <div class="fw-bold">
                                                {{ formatDateTime(selectedFacultyResult.completedAt) }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="text-center mt-3">
                                <button class="btn btn-outline-success rounded-pill px-4"
                                    :disabled="reviewLoading === (currentReviewTest && currentReviewTest.id)"
                                    @click="reviewAnswersFromModal()">
                                    <i class="fas me-1"
                                        :class="reviewLoading === (currentReviewTest && currentReviewTest.id)
                                            ? 'fa-spinner fa-spin' : 'fa-search'"></i>
                                    {{ reviewLoading === (currentReviewTest && currentReviewTest.id)
                                        ? 'Loading...' : 'Review Answers' }}
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
    name: 'FacultyDashboard',
    data() {
        return {
            selectedFacultyResult: null,
            facultyResultBsModal: null,
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
        ...mapActions(useTestStore, [
            'setActiveTestById',
            'setSelectedReport', 'setSelectedStudentResult'
        ]),

        isCompleted(test) {
            const s = String(test.status ?? '').toLowerCase().trim();
            return s === 'completed' || s === 'complete' || s === 'done' || s === '3' || s.includes('complet');
        },

        isTestAvailable(test) {
            if (!test.start_date) return true;
            return new Date() >= new Date(test.start_date);
        },

        getFacultyId() {
            const authStore = useAuthStore();
            const u = authStore.user;
            return Number(u?.id ?? 0);
        },

        mergeStatusFromStore(tests) {
            const testStore = useTestStore();
            const fid = this.getFacultyId();
            return tests.map(test => {
                const examId = Number(test.exam_id || test.exam?.id);
                const assignmentId = Number(test.id);
                const stByAid  = testStore.studentTests.find(s => Number(s.assignmentId) === assignmentId);
                const stByExam = testStore.studentTests.find(
                    s => Number(s.testId) === examId && Number(s.studentId) === fid
                );
                const st = stByAid || stByExam;
                const rawStatus = test.status ?? st?.status ?? '';
                const s = String(rawStatus).toLowerCase().trim();
                let normalizedStatus = test.status;
                if (s === '3' || s === 'completed' || s === 'complete' || s === 'done' || s === 'finished') {
                    normalizedStatus = 'Completed';
                } else if (s === '2' || s === 'in_progress' || s === 'in progress' || s === 'started' || s === 'ongoing') {
                    normalizedStatus = 'In Progress';
                } else if (!s || s === '1' || s === 'pending' || s === 'not_started' || s === 'not started') {
                    normalizedStatus = 'Not Started';
                }
                if (st && this._storeStatusIsCompleted(st.status)) normalizedStatus = 'Completed';
                return { ...test, status: normalizedStatus };
            });
        },

        _storeStatusIsCompleted(status) {
            const s = String(status ?? '').toLowerCase().trim();
            return s === 'completed' || s === 'complete' || s === 'done' || s === '3' || s.includes('complet');
        },

        async safeGetCachedAssignments(fid) {
            if (!this.dbReady) return [];
            return getCachedAssignments(fid).catch(() => []);
        },
        async safeCacheAssignments(fid, tests) {
            if (!this.dbReady) return;
            return cacheAssignments(fid, tests).catch(() => {});
        },
        async safeGetCachedExamQuestions(examId) {
            if (!this.dbReady) return [];
            return getCachedExamQuestions(examId).catch(() => []);
        },
        async safeCacheExamQuestions(examId, qs) {
            if (!this.dbReady) return;
            return cacheExamQuestions(examId, qs).catch(() => {});
        },
        async safeGetOfflineAnswers(assignmentId) {
            if (!this.dbReady) return [];
            return getOfflineAnswers(assignmentId).catch(() => []);
        },
        async safeGetPendingAnswerAssignmentIds() {
            if (!this.dbReady) return [];
            return getPendingAnswerAssignmentIds().catch(() => []);
        },

        async loadAssignedTests() {
            this.loading = true;
            const facultyId = this.getFacultyId();

            if (this.isOffline) {
                const cached = await this.safeGetCachedAssignments(facultyId);
                this.assignedTests = this.mergeStatusFromStore(cached);
                this.loading = false;
                return;
            }

            const cachedEarly = await this.safeGetCachedAssignments(facultyId);
            if (cachedEarly.length) {
                this.assignedTests = this.mergeStatusFromStore(cachedEarly);
                this.loading = false;
            }

            let resolved = false;
            const apiPromise = api.get('/student-exam-assignments').then(res => {
                const raw = res.data;
                const list = raw?.questionList ?? raw?.data ?? raw ?? [];
                return Array.isArray(list) ? list : [];
            });
            const timeoutPromise = new Promise(resolve =>
                setTimeout(() => { if (!resolved) resolve(null); }, ASSIGNMENTS_TIMEOUT_MS)
            );

            let freshTests = null;
            try {
                freshTests = await Promise.race([apiPromise, timeoutPromise]);
                resolved = true;
            } catch (e) {
                resolved = true;
                console.error('[Dashboard] Assignments API error:', e);
            }

            if (freshTests && freshTests.length) {
                const testStore = useTestStore();
                try {
                    await testStore.fetchStudentAssignments(facultyId);
                } catch (e) {
                    console.warn('[Dashboard] fetchStudentAssignments error:', e);
                }
                this.assignedTests = this.mergeStatusFromStore(freshTests);
                this.loading = false;
                this.safeCacheAssignments(facultyId, freshTests)
                    .then(() => this.prefetchAndCacheQuestions())
                    .catch(e => console.warn('[Dashboard] Background cache error:', e));
            } else if (!cachedEarly.length) {
                this.assignedTests = [];
                this.loading = false;
            }
        },

        async prefetchAndCacheQuestions() {
            const examIds = [...new Set(
                this.assignedTests.map(t => Number(t.exam_id || t.exam?.id)).filter(Boolean)
            )];
            for (const examId of examIds) {
                try {
                    const existing = await this.safeGetCachedExamQuestions(examId);
                    if (existing.length > 0) continue;
                    const rQ = await api.get('/exam-questions/' + examId);
                    const root = rQ?.data || null;
                    const listQ = Array.isArray(root?.questionList) ? root.questionList : [];
                    if (!listQ.length) continue;
                    const questions = listQ.map(it => {
                        const base = it?.question || it;
                        const qid = Number(base?.id || it?.question_id || 0);
                        if (!qid) return null;
                        const id = base.question_type_id;
                        const str = String(base.question_type || '').toLowerCase();
                        const typeLabel =
                            id === 1 ? 'True or False' : id === 2 ? 'Multiple Choice' :
                            id === 3 ? 'Matching Type' : id === 4 ? 'Identification' :
                            id === 5 ? 'Enumeration' :
                            str.includes('true') ? 'True or False' :
                            str.includes('multiple') ? 'Multiple Choice' :
                            str.includes('matching') ? 'Matching Type' :
                            str.includes('identification') ? 'Identification' : 'Multiple Choice';
                        let options = [], pairs = [], answerIndex, answer;
                        if (typeLabel === 'Multiple Choice') {
                            const mc = base.multiple_choice_answers || base.multipleChoiceAnswers || base.options || [];
                            const sorted = Array.isArray(mc)
                                ? [...mc].sort((a, b) => Number(a.option_order || 0) - Number(b.option_order || 0)) : [];
                            options = sorted.map(a => ({ text: a.option_text || a.text || String(a.value || '') })).filter(o => o.text);
                            const ci = sorted.findIndex(a => { const v = a.is_correct ?? a.correct; return typeof v === 'boolean' ? v : Number(v) === 1; });
                            if (ci >= 0) answerIndex = ci;
                        } else if (typeLabel === 'Matching Type') {
                            const mp = base.pairs || base.matching_pairs || [];
                            pairs = Array.isArray(mp) ? mp.map(p => ({ prompt: p.prompt || p.left || '', answer: p.answer || p.right || '' })) : [];
                        } else if (typeLabel === 'True or False') {
                            const ca = base.correct_answer ?? base.answer ?? base.trueFalseAnswer?.is_true ?? null;
                            if (ca != null) answer = (typeof ca === 'boolean' ? ca : String(ca).toLowerCase() === 'true') ? 'True' : 'False';
                        } else if (typeLabel === 'Identification') {
                            const ca = base.correct_answer ?? base.answer ?? base.key;
                            if (ca != null) answer = String(ca);
                        }
                        const loRaw = base.learning_outcome || '';
                        const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';
                        return { id: qid, text: base.text || base.question_text || '', type: typeLabel, options, pairs, answerIndex, answer, cognitiveLevel: base.cognitive_level || 'Remembering', loTags: loNorm ? [loNorm] : [], status: 'Approved', program: '', course: '' };
                    }).filter(Boolean);
                    if (questions.length) await this.safeCacheExamQuestions(examId, questions);
                } catch (e) {
                    console.warn('[Dashboard] Could not cache exam ' + examId + ':', e);
                }
            }
        },

        _loadQuestionsIntoStore(cachedQs, examId, test, testStore, questionStore) {
            for (const q of cachedQs) {
                const existing = questionStore.questions.find(x => Number(x.id) === Number(q.id));
                if (existing) questionStore.updateQuestion(q);
                else questionStore.addQuestion(q);
            }
            if (!testStore.pilotTests.find(t => Number(t.id) === examId)) {
                testStore.addTest({ id: examId, name: test.exam?.name || ('Exam ' + examId), description: test.exam?.description || '', questionIds: cachedQs.map(q => q.id), timeLimit: Number(test.exam?.time_limit || test.time_limit || 60) });
            } else {
                const idx = testStore.pilotTests.findIndex(t => Number(t.id) === examId);
                if (idx >= 0 && !testStore.pilotTests[idx].questionIds?.length) {
                    testStore.pilotTests[idx].questionIds = cachedQs.map(q => q.id);
                }
            }
        },

        async startTest(test) {
            const testStore = useTestStore();
            const questionStore = useQuestionStore();
            const examId = Number(test.exam_id || test.exam?.id);
            const aid = Number(test.id);
            const fid = this.getFacultyId();

            if (this.isOffline) {
                const cachedQs = await this.safeGetCachedExamQuestions(examId);
                if (!cachedQs.length) { alert('This exam is not available offline.'); return; }
                this._loadQuestionsIntoStore(cachedQs, examId, test, testStore, questionStore);
                if (!testStore.studentTests.find(st => Number(st.testId) === examId && Number(st.studentId) === fid)) {
                    testStore.studentTests.push({ studentId: fid, testId: examId, name: test.exam?.name || ('Exam ' + examId), status: 'Not Started', score: null, answers: {}, assignmentId: aid });
                }
                const pilotTest = testStore.pilotTests.find(t => Number(t.id) === examId);
                if (!testStore.setActiveTest(pilotTest)) { test.status = 'Completed'; return; }
                this.$router.push({ name: 'testTaking', params: { id: examId, aid: aid } });
                return;
            }

            const cachedQs = await this.safeGetCachedExamQuestions(examId);
            if (cachedQs.length) {
                this._loadQuestionsIntoStore(cachedQs, examId, test, testStore, questionStore);
                const pilotTest = testStore.pilotTests.find(t => Number(t.id) === examId);
                if (!testStore.setActiveTest(pilotTest || test)) { test.status = 'Completed'; return; }
                this.$router.push({ name: 'testTaking', params: { id: examId, aid: aid } });
                return;
            }

            const ensured = await testStore.ensureTestReady(examId);
            if (!testStore.setActiveTest(ensured || test)) { test.status = 'Completed'; return; }
            this.$router.push({ name: 'testTaking', params: { id: examId, aid: aid } });
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
            const questionStore = useQuestionStore();
            const rawScore = Number(result.raw_score ?? result.score ?? 0);
            const total    = Number(result.total ?? 0);

            let percent = Number(result.score ?? 0);
            if (total > 0 && percent <= total && percent === rawScore) {
                percent = Math.round((rawScore / total) * 100);
            } else {
                percent = Math.round(percent);
            }

            const durationSeconds = this._parseDuration(result.time_spent);

            const answersMap    = {};
            const questionTimes = {};
            const qidsToEnrich  = [];
            const list = Array.isArray(result.answers) ? result.answers : [];

            for (const a of list) {
                const qid = Number(a.question_id ?? a.questionId ?? 0);
                if (!qid) continue;
                qidsToEnrich.push(qid);

                const entry = {
                    answer_value:  a.answer_value ?? a.answer ?? '',
                    is_correct:    a.is_correct === true  || a.is_correct === 1  ||
                                   a.is_correct === '1'   || a.is_correct === 'true' ||
                                   a.correct    === true  || a.correct    === 1,
                    question_text: a.question_text || ''
                };
                answersMap[qid]         = entry;
                answersMap[String(qid)] = entry;

                // Prefer time_spent from server response; fall back to local store
                if (a.time_spent !== undefined && a.time_spent !== null) {
                    questionTimes[qid] = Number(a.time_spent);
                }
            }

            // Fill in question_text from store for any missing entries
            if (qidsToEnrich.length) {
                await this.ensureQuestionsLoadedByIds(qidsToEnrich);
                for (const qid of qidsToEnrich) {
                    if (!answersMap[qid]?.question_text) {
                        const q = questionStore.questions.find(x => Number(x.id) === qid);
                        if (q) {
                            answersMap[qid].question_text         = q.text;
                            answersMap[String(qid)].question_text = q.text;
                        }
                    }
                }
            }

            return {
                name:           testName,
                creatorName:    result.created_by || 'N/A',
                durationSeconds,
                completedAt:    result.completed_at || completedAt || null,
                score:          percent,
                rawScore,
                totalQuestions: total,
                answers:        answersMap,
                questionTimes,
                offlineOnly:    false
            };
        },

        /**
         * Merge question times from the local store into the parsed result.
         * The local store holds times computed from start/end timestamps (TakeTest.vue).
         * Server times (time_spent per answer row) take precedence if present and non-zero;
         * otherwise fall back to the locally accumulated value.
         */
        _mergeLocalQuestionTimes(questionTimes, assignmentId, testId, studentId) {
            const testStore = useTestStore();
            const fid = studentId ?? this.getFacultyId();

            // Find the matching student test record that TakeTest.vue wrote to
            const st = testStore.studentTests.find(s =>
                (assignmentId && Number(s.assignmentId) === Number(assignmentId)) ||
                (Number(s.testId) === Number(testId) && Number(s.studentId) === fid)
            );

            if (!st?.questionTimes) return questionTimes;

            const merged = { ...questionTimes };
            for (const [qid, localSecs] of Object.entries(st.questionTimes)) {
                const key = Number(qid);
                // Only use local value if server didn't return one (or returned 0)
                if (!merged[key] || merged[key] === 0) {
                    merged[key] = localSecs;
                }
            }
            return merged;
        },

        async viewFacultyTestResult(test) {
            const testName = test.exam?.name || test.exam_name || 'Untitled Test';

            if (this.isOffline) {
                const assignmentId  = Number(test.id);
                const cachedAnswers = await this.safeGetOfflineAnswers(assignmentId);
                const testStore     = useTestStore();
                const fid           = this.getFacultyId();
                const examId        = Number(test.exam_id || test.exam?.id);
                const st            = testStore.studentTests.find(s => Number(s.testId) === examId && Number(s.studentId) === fid);
                this.selectedFacultyResult = {
                    name: testName, creatorName: 'N/A',
                    durationSeconds: st?.durationSeconds || 0, completedAt: st?.completedAt || null,
                    score: st?.score ?? null, rawScore: st?.rawScore ?? null,
                    totalQuestions: st?.totalQuestions ?? cachedAnswers.length,
                    answers: {}, questionTimes: st?.questionTimes || {}, offlineOnly: true
                };
                this.currentReviewTest = test;
                this._ensureModal();
                this.facultyResultBsModal.show();
                return;
            }

            try {
                let response = await api.get('/student-answers/check/' + test.id);
                let result   = response.data;
                if (!result.completed) {
                    console.warn('[FacultyDashboard] Server says test not completed. Refreshing assignments...');
                    await useTestStore().fetchStudentAssignments(this.getFacultyId());
                    const updatedTest = this.studentTests.find(st => Number(st.assignmentId) === Number(test.id));
                    if (updatedTest?.status !== 'Completed') {
                        alert('This test has not been completed yet.');
                        return;
                    }
                    response = await api.get('/student-answers/check/' + test.id);
                    result = response.data;
                    if (!result.completed) {
                        alert('This test has not been completed yet.');
                        return;
                    }
                }
                const parsed = await this._parseCheckResponse(result, testName, test.completed_at);
                // Merge locally-tracked question times
                parsed.questionTimes = this._mergeLocalQuestionTimes(
                    parsed.questionTimes, Number(test.id),
                    Number(test.exam_id || test.exam?.id), this.getFacultyId()
                );
                this.selectedFacultyResult = parsed;
                this.currentReviewTest = test;
                this._ensureModal();
                this.facultyResultBsModal.show();
            } catch (error) {
                console.error('Failed to fetch test result:', error);
                alert('Could not load test results. Please try again later.');
            }
        },

        async reviewAnswers(test) {
            const examId       = Number(test.exam_id || test.exam?.id);
            const assignmentId = Number(test.id);

            if (!examId || !assignmentId) {
                alert('Missing exam or assignment information.');
                return;
            }

            this.reviewLoading = test.id;
            try {
                const testStore     = useTestStore();
                const questionStore = useQuestionStore();
                const fid           = this.getFacultyId();
                const testName      = test.exam?.name || test.exam_name || ('Exam ' + examId);

                const cachedQs = await this.safeGetCachedExamQuestions(examId);
                if (cachedQs.length) {
                    this._loadQuestionsIntoStore(cachedQs, examId, test, testStore, questionStore);
                }

                await testStore.ensureTestReady(examId);

                const pilotTest   = testStore.pilotTests.find(t => Number(t.id) === examId);
                const questionIds = pilotTest?.questionIds?.length ? [...pilotTest.questionIds] : [];

                if (this.isOffline) {
                    const offlineRows = await this.safeGetOfflineAnswers(assignmentId);
                    const answersMap  = {};
                    for (const row of offlineRows) {
                        answersMap[Number(row.question_id)] = { answer_value: row.answer_value, is_correct: null };
                        answersMap[String(row.question_id)] = { answer_value: row.answer_value, is_correct: null };
                    }
                    const st = testStore.studentTests.find(s => Number(s.testId) === examId && Number(s.studentId) === fid);
                    const payload = {
                        studentId:       fid,
                        testId:          examId,
                        assignmentId,
                        name:            testName,
                        score:           st?.score ?? 0,
                        rawScore:        st?.rawScore ?? 0,
                        totalQuestions:  questionIds.length || st?.totalQuestions || 0,
                        durationSeconds: st?.durationSeconds ?? 0,
                        completedAt:     st?.completedAt ?? null,
                        answers:         answersMap,
                        // Use locally stored question times for offline review
                        questionTimes:   st?.questionTimes || {}
                    };
                    testStore.setSelectedReport({ id: examId, name: testName, description: test.exam?.description || '', questionIds, participants: 1, avgScore: payload.score, studentResults: [payload] });
                    testStore.setSelectedStudentResult(payload);
                    this.$router.push({ name: 'studentResultDetail', query: { back: 'facultyDashboard' } });
                    return;
                }

                let response = await api.get('/student-answers/check/' + assignmentId);
                let result   = response.data;

                if (!result.completed) {
                    console.warn('[FacultyDashboard] Server says test not completed. Refreshing assignments...');
                    await useTestStore().fetchStudentAssignments(fid);
                    const updatedTest = this.studentTests.find(st => Number(st.assignmentId) === assignmentId);
                    if (updatedTest?.status !== 'Completed') {
                        alert('This test has not been completed yet.');
                        return;
                    }
                    response = await api.get('/student-answers/check/' + assignmentId);
                    result = response.data;
                    if (!result.completed) {
                        alert('This test has not been completed yet.');
                        return;
                    }
                }

                const parsed = await this._parseCheckResponse(result, testName, test.completed_at);

                if (questionIds.length) {
                    await this.ensureQuestionsLoadedByIds(questionIds);
                }

                const resolvedQuestionIds = questionIds.length
                    ? questionIds
                    : Object.keys(parsed.answers).map(Number).filter(n => n > 0);

                for (const qid of resolvedQuestionIds) {
                    if (!parsed.answers[qid]) {
                        const q = questionStore.questions.find(x => Number(x.id) === qid);
                        const blank = { answer_value: '', is_correct: false, question_text: q?.text || '' };
                        parsed.answers[qid]         = blank;
                        parsed.answers[String(qid)] = blank;
                    }
                }

                // Merge locally-tracked question times (start/end timestamp approach)
                // so the Review Answers page shows the accurate per-question time
                const mergedQuestionTimes = this._mergeLocalQuestionTimes(
                    parsed.questionTimes, assignmentId, examId, fid
                );

                const payload = {
                    studentId:       fid,
                    testId:          examId,
                    assignmentId,
                    name:            parsed.name,
                    score:           parsed.score,
                    rawScore:        parsed.rawScore,
                    totalQuestions:  parsed.totalQuestions || resolvedQuestionIds.length,
                    durationSeconds: parsed.durationSeconds,
                    completedAt:     parsed.completedAt,
                    answers:         parsed.answers,
                    // This is what StudentResultReview.getQuestionTime() reads
                    questionTimes:   mergedQuestionTimes
                };

                testStore.setSelectedReport({
                    id:             examId,
                    name:           testName,
                    description:    test.exam?.description || '',
                    questionIds:    resolvedQuestionIds,
                    participants:   1,
                    avgScore:       parsed.score,
                    studentResults: [payload]
                });
                testStore.setSelectedStudentResult(payload);
                this.$router.push({ name: 'studentResultDetail', query: { back: 'facultyDashboard' } });

            } catch (error) {
                console.error('[ReviewAnswers] Failed:', error);
                alert('Could not load answer review. Please try again.');
            } finally {
                this.reviewLoading = null;
            }
        },

        reviewAnswersFromModal() {
            const modalEl = this.$refs.facultyResultModal;
            const test    = this.currentReviewTest;
            if (!test) return;
            if (this.facultyResultBsModal && modalEl) {
                if (document.activeElement && modalEl.contains(document.activeElement)) document.activeElement.blur();
                modalEl.addEventListener('hidden.bs.modal', () => { this.reviewAnswers(test); }, { once: true });
                this.facultyResultBsModal.hide();
            } else {
                this.reviewAnswers(test);
            }
        },

        _ensureModal() {
            if (!this.facultyResultBsModal && this.$refs.facultyResultModal) {
                this.facultyResultBsModal = new bootstrap.Modal(this.$refs.facultyResultModal);
            }
        },

        formatDuration(seconds) {
            const s = Math.round(Number(seconds));
            if (!Number.isFinite(s) || s <= 0) return '\u2014';
            const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
            if (h > 0) return `${h}h ${m}m ${sec}s`;
            if (m > 0) return `${m}m ${sec}s`;
            return `${sec}s`;
        },

        formatDateTime(iso) {
            if (!iso) return '\u2014';
            const d = new Date(iso);
            return isNaN(d.getTime()) ? '\u2014' : d.toLocaleString();
        }
    },

    async mounted() {
        try { await initDB(); this.dbReady = true; }
        catch (e) { console.warn('[Dashboard] SQLite unavailable:', e.message); this.dbReady = false; }

        try {
            const status = await Network.getStatus();
            this.isOffline = !status.connected;
        } catch (_) { this.isOffline = false; }

        Network.addListener('networkStatusChange', async (s) => {
            this.isOffline = !s.connected;
            if (!this.isOffline) await this.loadAssignedTests();
        });

        await this.loadAssignedTests();

        const pending = await this.safeGetPendingAnswerAssignmentIds();
        this.hasPendingAnswers = pending.length > 0;
        this._ensureModal();
    },

    beforeUnmount() {
        if (this.facultyResultBsModal) {
            this.facultyResultBsModal.dispose();
            this.facultyResultBsModal = null;
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