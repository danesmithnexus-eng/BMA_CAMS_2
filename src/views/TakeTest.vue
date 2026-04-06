<template>
    <!-- Taking exam -->
    <div v-if="session.isActive && !reviewMode && session.questions.length">
        <ExamHeader :title="session.examName" :remaining-time="session.remainingTime" :is-offline="isOffline" />
        <ExamQuestion v-if="session.currentQuestion" :question="session.currentQuestion" :index="session.currentIndex"
            :total="session.totalQuestions" :model-value="session.answers[session.currentQuestion.id]"
            @update:model-value="onAnswer" @prev="onPrev" @next="onNext" @review="enterReviewMode" @blur="onBlur" />
    </div>

    <!-- Review mode -->
    <div v-else-if="session.isActive && reviewMode">
        <ExamHeader :title="session.examName" subtitle="Reviewing Answers" :remaining-time="session.remainingTime"
            :is-offline="isOffline" />
        <ExamReview :summary="examSummary" :submitting="submitting" :is-offline="isOffline" @goto="goToQuestion"
            @back="reviewMode = false" @submit="handleSubmitTest" />
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="text-center p-5">
        <i class="fas fa-spinner fa-spin fa-2x text-muted"></i>
        <p class="mt-3 text-muted">Loading exam questions...</p>
    </div>

    <!-- Fallback -->
    <div v-else class="card text-center p-5">
        <h5 class="text-muted">No questions found for this exam.</h5>
        <button class="btn btn-secondary mt-3" @click="goBack">Go Back</button>
    </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Network } from '@capacitor/network';
import { useTestStore } from '../stores/tests';
import { useAuthStore } from '../stores/auth';
import { useExamSessionStore } from '../stores/examSession';
import { recordAndMaybeFlush, flushAllPending, preloadAnswerIds } from '../services/examAnswerQueue';
import { saveOfflineAnswer, updateCachedAssignmentStatus } from '../services/db';
import ExamHeader from '../components/exam/ExamHeader.vue';
import ExamQuestion from '../components/exam/ExamQuestion.vue';
import ExamReview from '../components/exam/ExamReview.vue';
import api from '../services/api';

const testStore = useTestStore();
const authStore = useAuthStore();
const session = useExamSessionStore();
const router = useRouter();
const route = useRoute();

const submitting = ref(false);
const isOffline = ref(false);
const loading = ref(true);
const reviewMode = ref(false);
const questionAnswers = ref([]); // Temporary storage for question answers


const isRestoredSession = ref(false);

let timerInterval = null;


const questionStartTime = ref(null);   // ms timestamp when current question was entered
const questionTimeMap = ref({});       // { [questionId]: { startTime, endTime, totalSeconds } } local accumulator


const stopQuestionClock = () => {

    if (reviewMode.value) return;

    const q = session.currentQuestion;
    if (!q || !questionStartTime.value) return;

    const endTime = Date.now();
    const elapsed = Math.round((endTime - questionStartTime.value) / 1000);
    const qid = q.id;

    // Accumulate — revisits add on top of previous total
    const prevData = questionTimeMap.value[qid] || { totalSeconds: 0 };
    const newData = {
        startTime: questionStartTime.value,
        endTime: endTime,
        totalSeconds: (prevData.totalSeconds || 0) + elapsed
    };

    questionTimeMap.value[qid] = newData;


    session.questionTimes[qid] = newData;


    try {
        const key = `qt_${session.assignmentId}`;
        localStorage.setItem(key, JSON.stringify(questionTimeMap.value));
    } catch (_) {}

    questionStartTime.value = null;
};


const startQuestionClock = () => {
    const q = session.currentQuestion;
    if (!q) return;
    questionStartTime.value = Date.now();
};


const restoreSessionData = () => {
    if (!session.assignmentId) return;

    try {

        const qtKey = `qt_${session.assignmentId}`;
        const savedQt = localStorage.getItem(qtKey);
        if (savedQt) {
            const parsed = JSON.parse(savedQt);

            questionTimeMap.value = { ...parsed };
    
            Object.assign(session.questionTimes, parsed);
            console.log('[TakeTest] Restored questionTimes from localStorage:', parsed);
        }

        // ── 2. Restore answer history & auto-fill session.answers ─────────────
        const qaKey = `qa_${session.assignmentId}`;
        const savedQa = localStorage.getItem(qaKey);
        if (savedQa) {
            const history = JSON.parse(savedQa);
            questionAnswers.value = history;

            if (history.length > 0) {
                const last = history[history.length - 1];
                // answer_id stores the full answers snapshot: { [questionId]: value }
                const restoredAnswers = last.answer_id || last.answers || {};

 
                Object.entries(restoredAnswers).forEach(([qid, val]) => {
                    if (val !== undefined && val !== null) {
                        session.answers[Number(qid)] = val;
                    }
                });

                console.log('[TakeTest] Auto-filled answers from localStorage (no re-flush):', restoredAnswers);
            }
        }
    } catch (e) {
        console.warn('[TakeTest] restoreSessionData error:', e);
    }

    // Mark session as restored so onAnswer knows not to re-record existing answers
    isRestoredSession.value = true;
};

/**
 * Remove the localStorage backup entries after a successful submit.
 */
const clearSessionStorage = () => {
    if (!session.assignmentId) return;
    try {
        localStorage.removeItem(`qt_${session.assignmentId}`);
        localStorage.removeItem(`qa_${session.assignmentId}`);
    } catch (_) {}
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getStudentId = () =>
    Number(authStore.user?.student?.id ?? authStore.user?.student_id ?? authStore.user?.id ?? 0);

const goBack = () =>
    router.push({ name: authStore.user?.role === 'Student' ? 'studentDashboard' : 'dashboard' });

// ── Timer ─────────────────────────────────────────────────────────────────────

const startTimer = () => {
    stopTimer();
    timerInterval = setInterval(() => {
        session.tickTimer();
        if (session.remainingTime <= 0) {
            stopTimer();
            handleSubmitTest();
        }
    }, 1000);
};

const stopTimer = () => {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
};

// ── Exam summary (for review screen) ─────────────────────────────────────────

const examSummary = computed(() => {
    const empty = { total: 0, answered: 0, missed: 0, questions: [] };
    if (!session.questions.length) return empty;

    const questions = session.questions.map(q => {
        if (!q) return null;
        const answer = session.answers[q.id];
        // Fetch from session.questionTimes which is kept in sync by stopQuestionClock()
        const timeData = session.questionTimes[q.id];
        const timeSpent = typeof timeData === 'object' ? (timeData.totalSeconds || 0) : (timeData || 0);
        const isAnswered = answer !== undefined && answer !== null && answer !== '';
        let displayAnswer = answer;
        if (q.type === 'Multiple Choice' && answer != null && Array.isArray(q.options)) {
            displayAnswer = q.options[answer]?.text ?? `Option ${Number(answer) + 1}`;
        }
        return { id: q.id, text: q.text, isAnswered, answer: displayAnswer, timeSpent };
    }).filter(Boolean);

    const answered = questions.filter(q => q.isAnswered).length;
    return { total: questions.length, answered, missed: questions.length - answered, questions };
});

// ── Answer handling ───────────────────────────────────────────────────────────

const onAnswer = (val) => {
    const q = session.currentQuestion;
    if (!q) return;

    if (isRestoredSession.value) {
 
        isRestoredSession.value = false;
    }

    recordAndMaybeFlush(q.id, val, {
        assignmentId: session.assignmentId,
        questions:    session.questions,
        isOffline:    isOffline.value,
    });
};

const onBlur = async () => {
    const q = session.currentQuestion;
    if (!q) return;
    const val = session.answers[q.id];
    if (val === undefined || val === null || val === '') return;
    // Offline: persist to local DB for later sync
    if (isOffline.value && session.assignmentId) {
        const answerText = q.type === 'Multiple Choice'
            ? (q.options?.[val]?.text ?? String(val))
            : String(val);
        await saveOfflineAnswer(session.assignmentId, q.id, answerText).catch(() => {});
    }
};
// ── Navigation ────────────────────────────────────────────────────────────────
const onPrev = () => {

    stopQuestionClock();
    session.prev();
    startQuestionClock();
};

const onNext = async () => {

    stopQuestionClock();

    questionAnswers.value.push({
        question_id: session.assignmentId,
        answer_id: { ...session.answers }, // full answers map for restoration
        questions: session.questions,
        questionTimes: { ...session.questionTimes },
    });

    try {
        localStorage.setItem(`qa_${session.assignmentId}`, JSON.stringify(questionAnswers.value));
    } catch (e) {
        console.error('[TakeTest] Failed to save questionAnswers to localStorage:', e);
    }

    session.next();
    startQuestionClock();
};

const enterReviewMode = () => {

    stopQuestionClock();

    questionStartTime.value = null;
    reviewMode.value = true;
};

const goToQuestion = (index) => {

    reviewMode.value = false;
    session.navigate(index);
    startQuestionClock();
};

// ── Submit ────────────────────────────────────────────────────────────────────

const handleSubmitTest = async () => {
    if (!session.isActive) return;
    submitting.value = true;
    stopTimer();

    stopQuestionClock();

    const aid    = session.assignmentId;
    const sid    = session.studentId;
    const testId = session.examId;

    // Snapshot AFTER stopQuestionClock() has written the final elapsed time
    const questionTimes = {};
    Object.entries(session.questionTimes).forEach(([qid, data]) => {
        questionTimes[qid] = typeof data === 'object' ? (data.totalSeconds || 0) : (data || 0);
    });

    // 1. Flush ALL locally-stored answers + question times to the server
    try {
        await flushAllPending({
            assignmentId:  aid,
            questions:     session.questions,
            isOffline:     isOffline.value,
            questionTimes,
        });
    } catch (e) {
        console.error('[TakeTest] Error flushing answers on submit:', e);
    }

    // 2. Offline mode — mark locally and exit
    if (isOffline.value) {
        const stIdx = testStore.studentTests.findIndex(
            st => Number(st.testId) === testId && Number(st.studentId) === sid
        );
        if (stIdx >= 0) {
            testStore.studentTests[stIdx] = {
                ...testStore.studentTests[stIdx],
                status:      'Completed',
                answers:     { ...session.answers },
                questionTimes,
                completedAt: new Date().toISOString(),
            };
        }
        if (aid) await updateCachedAssignmentStatus(aid, 'Completed').catch(() => {});
        clearSessionStorage();
        session.clearSession();
        submitting.value = false;
        alert('Answers saved locally. Will auto-submit when reconnected.');
        return goBack();
    }

    // 3. Score locally
    let score = 0;
    session.questions.forEach(q => {
        if (!q) return;
        const given = session.answers[q.id];
        if (given === undefined || given === null || given === '') return;
        if (q.type === 'Multiple Choice') {
            if (Number(given) === Number(q.answerIndex)) score++;
        } else if (q.type === 'True or False') {
            if (String(given).toLowerCase() === String(q.answer ?? '').toLowerCase()) score++;
        } else if (q.type === 'Identification') {
            if (String(given).trim().toLowerCase() === String(q.answer ?? '').trim().toLowerCase()) score++;
        }
    });

    const total   = session.questions.length;
    const percent = total ? Math.round((score / total) * 100) : 0;

    // 4. Total time spent (derived from countdown timer)
    const limitSec  = (session.timeLimit || 60) * 60;
    const remaining = session.remainingTime ?? 0;
    const spent     = Math.max(0, limitSec - remaining);

    // 5. Update local store with questionTimes included
    const stIdx = testStore.studentTests.findIndex(
        st => Number(st.testId) === testId && Number(st.studentId) === sid
    );
    if (stIdx >= 0) {
        testStore.studentTests[stIdx] = {
            ...testStore.studentTests[stIdx],
            status:          'Completed',
            score:           percent,
            answers:         { ...session.answers },
            questionTimes,
            durationSeconds: spent,
            completedAt:     new Date().toISOString(),
        };
    }

    if (aid) {
        try {
            await testStore.completeExamAction(aid, percent, questionTimes, spent);
            console.log('[TakeTest] Exam completion sent to server');
        } catch (e) {
            console.error('[TakeTest] Failed to send completion to server:', e);
            alert('Server error while finishing exam. Your progress is saved locally.');
        }
    } else {
        console.warn('[TakeTest] Cannot send completion — no assignmentId');
        alert('Warning: No assignment ID found. Answers are saved locally but might not be synced to the server.');
    }

    clearSessionStorage();
    session.clearSession();
    submitting.value = false;
    goBack();
};

// ── Mount ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
    loading.value = true;

    try {
        const netStatus = await Network.getStatus();
        isOffline.value = !netStatus.connected;
        Network.addListener('networkStatusChange', s => { isOffline.value = !s.connected; });

        if (!authStore.user) { router.push({ name: 'login' }); return; }

        const examId = route.params?.id  ? Number(route.params.id)  : null;
        const urlAid = route.params?.aid ? Number(route.params.aid) : null;
        if (!examId) { goBack(); return; }

        const sid = getStudentId();

        // ── Refresh scenario: session already active for this exam ──
        if (session.examId === examId && session.questions.length > 0) {
            console.log('[TakeTest] Restoring session from store (refresh)');

            if (urlAid && !session.assignmentId) session.assignmentId = urlAid;

            testStore.fetchStudentAssignments(authStore.user.id).then(async () => {
                const st = testStore.studentTests.find(
                    s => Number(s.testId) === examId && Number(s.studentId) === sid
                );
                if (st?.assignmentId && !session.assignmentId) {
                    console.log('[TakeTest] Background refresh found missing assignmentId:', st.assignmentId);
                    session.assignmentId = st.assignmentId;
                }
            });

            // Re-warm the answer ID cache in case the page was hard-refreshed
            const restoreAid = session.assignmentId ?? urlAid ?? null;
            if (restoreAid && !isOffline.value) preloadAnswerIds(restoreAid).catch(() => {});

            restoreSessionData();

            startTimer();

            startQuestionClock();
            loading.value = false;
            return;
        }

        // ── Fresh load ──
        console.log('[TakeTest] Fetching student assignments...');
        await testStore.fetchStudentAssignments(authStore.user.id);

        const ensured = await testStore.ensureTestReady(examId);
        if (!ensured || !ensured.questionIds?.length) {
            console.error('[TakeTest] ensureTestReady returned no questions');
            goBack();
            return;
        }

        let st = testStore.studentTests.find(
            s => Number(s.testId) === examId && Number(s.studentId) === sid
        );

        if (!st) {
            st = {
                studentId:    sid,
                testId:       examId,
                assignmentId: urlAid || null,
                name:         ensured.name,
                status:       'In Progress',
                score:        null,
                answers:      {},
                startedAt:    new Date().toISOString(),
                completedAt:  null,
            };
            testStore.studentTests.push(st);
        }

        if (st?.status === 'Completed') {
            goBack();
            return;
        }

        // Resolve question objects
        const { useQuestionStore } = await import('../stores/questions');
        const questionStore = useQuestionStore();
        const questions = (ensured.questionIds ?? [])
            .map(id => questionStore.questions.find(q => Number(q.id) === Number(id)))
            .filter(Boolean);

        if (!questions.length) {
            console.error('[TakeTest] No question objects resolved');
            goBack();
            return;
        }

        // Resolve assignmentId
        let aid = urlAid || st.assignmentId || null;

        if (!aid && !isOffline.value) {
            console.log('[TakeTest] assignmentId missing — querying server...');
            try {
                const r = await api.get('/student-exam-assignments', {
                    params: { student_id: sid, exam_id: examId }
                });
                const list = Array.isArray(r?.data?.data) ? r.data.data
                    : (Array.isArray(r?.data) ? r.data : []);
                const match = list.find(a =>
                    Number(a.exam_id ?? a.examId ?? a.exam?.id) === examId
                );
                if (match?.id) {
                    aid = Number(match.id);
                    const stIdx = testStore.studentTests.findIndex(
                        s => Number(s.testId) === examId && Number(s.studentId) === sid
                    );
                    if (stIdx >= 0) testStore.studentTests[stIdx].assignmentId = aid;
                }
            } catch (e) {
                console.error('[TakeTest] Failed to resolve assignmentId:', e);
            }
        }

        if (!aid && !isOffline.value) {
            console.error('[TakeTest] No assignmentId found — student is not properly assigned');
            alert('You have not been assigned to this exam yet. Please contact your administrator.');
            goBack();
            return;
        }

        session.initSession({
            examId,
            examName:        ensured.name,
            timeLimit:       ensured.timeLimit || 60,
            remainingTime:   (ensured.timeLimit || 60) * 60,
            questions,
            assignmentId:    aid,
            studentId:       sid,
            existingAnswers: st?.answers ?? {},
        });

        if (aid && !isOffline.value) {
            try {
                await testStore.startExamAction(aid);
                console.log('[TakeTest] Exam started on server');
            } catch (e) {
                console.error('[TakeTest] Failed to start exam:', e);
            }

            preloadAnswerIds(aid).catch(() => {});
        }

        restoreSessionData();

        startTimer();
        // Begin timing question #0 immediately
        startQuestionClock();

    } catch (e) {
        console.error('[TakeTest] mount error:', e);
        goBack();
    } finally {
        loading.value = false;
    }
});

onUnmounted(() => {
    stopTimer();
    stopQuestionClock();
});
</script>