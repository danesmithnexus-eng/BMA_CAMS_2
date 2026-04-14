import { defineStore } from 'pinia';

/**
 * Persisted exam session store.
 * Survives page refreshes. Cleared on submit or explicit reset.
 */
export const useExamSessionStore = defineStore('examSession', {
    state: () => ({
        // Persisted exam snapshot
        examId: null,
        examName: '',
        timeLimit: 60,
        remainingTime: 0,
        questions: [],        // full question objects
        answers: {},          // { [questionId]: value }
        currentIndex: 0,
        assignmentId: null,
        studentId: null,
        // Question time tracking
        questionTimes: {},    // { [questionId]: seconds }
        // Answer queue tracking
        pendingQueue: {},     // { [questionId]: answerValue } — not yet sent
        sentAnswers: {},      // { [questionId]: answerValue } — already sent to API
        queuedCount: 0,       // how many unsent answers are pending
    }),

    getters: {
        currentQuestion: (state) => state.questions[state.currentIndex] ?? null,
        totalQuestions: (state) => state.questions.length,
        answeredCount: (state) => Object.keys(state.answers).filter(k => {
            const v = state.answers[k];
            return v !== undefined && v !== null && v !== '';
        }).length,
        pendingCount: (state) => Object.keys(state.pendingQueue).length,
        isActive: (state) => !!state.examId && state.questions.length > 0,
    },

    actions: {

        initSession({ examId, examName, timeLimit, remainingTime, questions, assignmentId, studentId, existingAnswers = {}, existingQuestionTimes = {} }) {
            // If same exam is already loaded (refresh scenario), just restore — don't overwrite
            if (this.examId === examId && this.questions.length > 0) {
                console.log('[examSession] Restoring existing session for exam', examId);
                return;
            }

            console.log('[examSession] Initializing new session for exam', examId);
            this.examId = examId;
            this.examName = examName;
            this.timeLimit = timeLimit;
            this.remainingTime = remainingTime ?? timeLimit * 60;
            this.questions = questions;
            this.answers = { ...existingAnswers };
            this.questionTimes = { ...existingQuestionTimes };
            this.currentIndex = 0;
            this.assignmentId = assignmentId;
            this.studentId = studentId;
            this.pendingQueue = {};
            this.sentAnswers = {};
            this.queuedCount = 0;
        },

        /**
         * Record an answer. Adds to pending queue.
         * Returns true if batch threshold (10) is reached.
         */
        recordAnswer(questionId, value) {
            const qid = Number(questionId);
            // Allow empty strings for answers (e.g., clearing identification)
            const sanitizedValue = (value === undefined || value === null) ? '' : value;

            const prev = this.answers[qid];
            this.answers[qid] = sanitizedValue;

            // Only count as new pending if answer changed or not yet sent
            const alreadySent = this.sentAnswers[qid] !== undefined &&
                String(this.sentAnswers[qid]) === String(sanitizedValue);

            if (!alreadySent) {
                const wasAlreadyPending = this.pendingQueue[qid] !== undefined;
                this.pendingQueue[qid] = sanitizedValue;
                if (!wasAlreadyPending) {
                    this.queuedCount++;
                }
            }

            return this.queuedCount >= 10;
        },

        /**
         * Drain the pending queue and return it for sending.
         * Call this after a successful API batch send.
         */
        flushQueue() {
            const toSend = { ...this.pendingQueue };
            // Mark all as sent
            Object.entries(toSend).forEach(([qid, val]) => {
                this.sentAnswers[Number(qid)] = val;
            });
            this.pendingQueue = {};
            this.queuedCount = 0;
            return toSend;
        },

        /**
         * Get all unsent answers (pendingQueue) for final submit flush.
         */
        getPendingAnswers() {
            return { ...this.pendingQueue };
        },

        tickTimer() {
            if (this.remainingTime > 0) {
                this.remainingTime--;
            }
        },

        navigate(index) {
            if (index >= 0 && index < this.questions.length) {
                this.currentIndex = index;
            }
        },

        next() {
            this.navigate(this.currentIndex + 1);
        },

        prev() {
            this.navigate(this.currentIndex - 1);
        },

        /**
         * Clear session completely (after submit or cancel).
         */
        clearSession() {
            this.examId = null;
            this.examName = '';
            this.timeLimit = 60;
            this.remainingTime = 0;
            this.questions = [];
            this.answers = {};
            this.questionTimes = {};
            this.currentIndex = 0;
            this.assignmentId = null;
            this.studentId = null;
            this.pendingQueue = {};
            this.sentAnswers = {};
            this.queuedCount = 0;
        },
    },
}, {
    // Persist everything so refresh restores the full session
    persist: {
        key: 'exam-session',
        paths: [
            'examId', 'examName', 'timeLimit', 'remainingTime',
            'questions', 'answers', 'questionTimes', 'currentIndex',
            'assignmentId', 'studentId',
            'pendingQueue', 'sentAnswers', 'queuedCount'
        ],
    },
});