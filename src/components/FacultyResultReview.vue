<script>
import { mapState, mapActions } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useTestStore } from '../stores/tests';
import { useUserStore } from '../stores/users';
import { useQuestionStore } from '../stores/questions';
import { useUIStore } from '../stores/ui';

export default {
    name: 'FacultyResultReview',

    props: {
        studentResult: {
            type: Object,
            required: true
        },
        report: {
            type: Object,
            default: null
        },
        returnView: {
            type: String,
            default: 'reportDetail'
        }
    },

    emits: ['back', 'retry'],

    data: () => ({
        cognitiveLevels: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating']
    }),

    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useTestStore, ['pilotTests', 'selectedReport', 'selectedStudentResult']),
        ...mapState(useUserStore, ['users']),
        ...mapState(useQuestionStore, ['questions']),

        resolvedDuration() {
            const sr = this.studentResult;
            if (!sr) return 0;
            const raw = sr.durationSeconds ?? sr.duration_seconds ?? sr.time_spent ?? sr.timeSpent ?? 0;
            if (!raw || raw === '') return 0;
            if (typeof raw === 'number') return Math.round(raw);
            if (String(raw).includes(':')) {
                const p = String(raw).split(':').map(Number);
                if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
                if (p.length === 2) return p[0] * 60 + p[1];
            }
            return parseInt(raw) || 0;
        },

        selectedQuestionsForPreview() {
            const set = new Set();
            const answers = this.studentResult?.answers || {};

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

            const reportIds = (this.report?.questionIds || []).map(Number);
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
                // if (ans && (ans.question_text || ans.text)) {
                //     return {
                //         id,
                //         text: ans.question_text || ans.text,
                //         type: 'Identification',
                //         virtual: true,
                //         answer: ans.answer_value || ans.answer || ''
                //     };
                // }
                // return { id, text: `Question #${id}`, type: 'Identification', virtual: true, answer: '' };
            }).filter(Boolean);
        },
    },

    methods: {
        ...mapActions(useUIStore, ['showToast']),
        ...mapActions(useUserStore, ['fetchUsers']),

        normalizeLO(loTags) {
            if (!loTags) return null;
            const raw = Array.isArray(loTags) ? loTags[0] || '' : String(loTags);
            const m = raw.match(/^(?:CLO|LO)[- ]?\d+/i);
            return m ? m[0].toUpperCase().replace(/^CLO/, 'LO').replace(/\s+/, ' ') : raw || null;
        },

        resolveIsCorrect(v) {
            if (v === null || v === undefined) return null;
            if (typeof v === 'boolean') return v;
            if (typeof v === 'number') return v === 1;
            if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
            return Boolean(v);
        },

        getAnswerEntry(question, sr) {
            const answers = sr?.answers || {};
            let entry = answers[Number(question.id)] ?? answers[String(question.id)];
            if (entry !== undefined) return entry;
            if (Array.isArray(answers)) {
                const found = answers.find(a => Number(a.question_id) === Number(question.id));
                if (found) return {
                    answer_value: found.answer_value,
                    is_correct: this.resolveIsCorrect(found.is_correct)
                };
            }
            const clean = str => String(str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
            const targetText = clean(question.text);
            if (targetText) {
                const vals = Object.values(answers);
                const match = vals.find(v => v && clean(v.question_text || v.text) === targetText);
                if (match) return match;
            }
            return undefined;
        },

        getStudentAnswerValue(question, sr) {
            const entry = this.getAnswerEntry(question, sr);
            if (entry == null) return '';
            const val = String(typeof entry === 'object' ? (entry.answer_value ?? '') : entry).trim();
            if (question.type === 'True or False') {
                const s = val.toLowerCase();
                if (s === 'true' || s === '1' || s === 'yes' || s === 't') return 'True';
                if (s === 'false' || s === '0' || s === 'no' || s === 'f') return 'False';
            }
            if (question.type === 'Multiple Choice' && /^[A-Z]$/i.test(val)) {
                const idx = val.toUpperCase().charCodeAt(0) - 65;
                if (question.options?.[idx]) return question.options[idx].text;
            }
            return val;
        },

        normalize(str) {
            return String(str ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
        },

        isCorrect(question, sr) {
            const entry = this.getAnswerEntry(question, sr);
            if (entry != null && typeof entry === 'object' && 'is_correct' in entry) {
                const flag = this.resolveIsCorrect(entry.is_correct);
                if (flag !== null) return flag;
            }
            const score = parseInt(String(sr?.score ?? '').replace(/\D/g, ''));
            if (score === 100) return true;
            if (entry == null) return false;
            const given = this.normalize(this.getStudentAnswerValue(question, sr));
            if (!given) return false;
            if (question.type === 'True or False') {
                return given === this.normalize(this.getCorrectTf(question));
            }
            if (question.type === 'Multiple Choice') {
                const ci = this.getMcCorrectIndex(question);
                if (ci < 0) return false;
                return given === this.normalize(question.options?.[ci]?.text || '');
            }
            const correctRaw = this.normalize(
                question.answer ?? question.correctAnswer ?? question.correct_answer ?? ''
            );
            if (!correctRaw) return false;
            return given === correctRaw;
        },

        getMcCorrectIndex(question) {
            for (const key of ['answerIndex', 'correctAnswerIndex', 'answer_index', 'correct_answer_index', 'correct_option_index']) {
                const v = question[key];
                if (v !== undefined && v !== null && v !== '' && !isNaN(Number(v))) return Number(v);
            }
            const correctText = this.normalize(
                question.answer ?? question.correctAnswer ?? question.correct_answer ?? ''
            );
            if (correctText && question.options?.length) {
                if (/^[a-z]$/i.test(correctText)) {
                    const idx = correctText.toUpperCase().charCodeAt(0) - 65;
                    if (idx >= 0 && idx < question.options.length) return idx;
                }
                const idx = question.options.findIndex(
                    o => this.normalize(o.text) === correctText
                );
                if (idx >= 0) return idx;
            }
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

        getQuestionTime(qid) {
            const qt = this.studentResult?.questionTimes || {};
            return qt[Number(qid)] ?? qt[String(qid)] ?? 0;
        },

        isMcCorrect(question, idx) {
            return this.getMcCorrectIndex(question) === Number(idx);
        },

        isMcStudentAnswer(question, idx, sr) {
            const val = this.getStudentAnswerValue(question, sr);
            if (!val) {
                const score = parseInt(String(sr?.score ?? '').replace(/[^\d]/g, ''));
                if (score === 100) return this.isMcCorrect(question, idx);
                return false;
            }
            if (/^[A-Z]$/i.test(val)) return (val.toUpperCase().charCodeAt(0) - 65) === idx;
            const opt = question.options?.[idx];
            if (opt && this.normalize(opt.text) === this.normalize(val)) return true;
            const asNum = parseInt(val, 10);
            if (!isNaN(asNum) && String(asNum) === val) return asNum === idx;
            return false;
        },

        mcOptionClass(question, idx, sr) {
            const c = this.isMcCorrect(question, idx);
            const s = this.isMcStudentAnswer(question, idx, sr);
            if (c && s) return 'bg-success-subtle border-success text-success-emphasis fw-semibold';
            if (c)      return 'bg-success-subtle border-success text-success-emphasis fw-semibold';
            if (s)      return 'bg-danger-subtle border-danger text-danger-emphasis fw-semibold';
            return 'bg-light'; // Changed from 'bg-light text-muted opacity-75'
        },

        getCorrectTf(question) {
            const raw = question.answer ?? question.correctAnswer ?? question.correct_answer ?? '';
            if (typeof raw === 'boolean') return raw ? 'True' : 'False';
            const s = String(raw).trim().toLowerCase();
            if (s === 'true' || s === '1' || s === 'yes' || s === 't') return 'True';
            if (s === 'false' || s === '0' || s === 'no' || s === 'f') return 'False';
            return String(raw).trim() || 'True';
        },

        isTfStudentAnswer(question, option, sr) {
            const val = this.getStudentAnswerValue(question, sr);
            if (val) return this.normalize(option) === this.normalize(val);
            const score = parseInt(String(sr?.score ?? '').replace(/[^\d]/g, ''));
            if (score === 100) return option === this.getCorrectTf(question);
            return false;
        },

        tfOptionClass(question, option, sr) {
            const opt = String(option).trim();
            const correct = this.getCorrectTf(question);
            const isStudentAnswer = this.isTfStudentAnswer(question, opt, sr);
            if (opt === correct && isStudentAnswer) return 'bg-success-subtle border-success text-success-emphasis fw-semibold';
            if (opt === correct) return 'bg-success-subtle border-success text-success-emphasis fw-semibold';
            if (isStudentAnswer) return 'bg-danger-subtle border-danger text-danger-emphasis fw-semibold';
            return 'bg-light text-muted opacity-75';
        },

        getCorrectId: q => String(q.answer ?? q.correctAnswer ?? q.correct_answer ?? '').trim(),
        getEnumAnswers: q => Array.isArray(q.answer) ? q.answer : Array.isArray(q.answers) ? q.answers : [],

        formatDuration(seconds) {
            const s = Math.round(Number(seconds) || 0);
            if (s <= 0) return '—';
            const m = Math.floor(s / 60);
            const h = Math.floor(m / 60);
            if (h > 0) return `${h}h ${m % 60}m`;
            return m ? `${m}m ${s % 60}s` : `${s}s`;
        },

        getStudentName(id, st = null) {
            const uid = Number(id || st?.studentId || st?.student_id || st?.user_id || 0);
            
            // 1. Prioritize finding the user in the global store by ID to get their FULLNAME
            const u = (this.users || []).find(u => Number(u.id) === uid);
            if (u) {
                const fullName = u.fullname || u.name || `${u.fname || ''} ${u.lname || ''}`.trim();
                if (fullName) return fullName;
            }

            // 2. Fallbacks if user not in store
            if (st?.student?.fullname) return st.student.fullname;
            if (st?.fullname)          return st.fullname;
            if (st?.student?.fname)    return `${st.student.fname} ${st.student.lname || ''}`.trim();
            if (st?.fname)             return `${st.fname} ${st.lname || ''}`.trim();
            if (st?.creatorName && st.creatorName !== 'N/A') return st.creatorName;
            if (st?.name)              return st.name;
            if (st?.username)          return st.username;
            if (this.studentResult?.username) return this.studentResult.username;
            
            return uid ? `Faculty #${uid}` : 'Unknown User';
        },

        getScoreBadgeClass(score) {
            const val = parseInt(String(score ?? '').replace(/[^\d]/g, '')) || 0;
            return val >= 80 ? 'bg-success' : val >= 60 ? 'bg-warning text-dark' : 'bg-danger';
        },

        handleBack() {
            this.$emit('back', this.returnView);
        }
    },

    mounted() {
        this.fetchUsers().catch(() => {});
    }
};
</script>

<template>
    <div class="container-fluid p-3">
        <div v-if="!selectedQuestionsForPreview.length && studentResult"
             class="alert alert-warning small mb-3 p-2 d-flex justify-content-between align-items-center">
            <span>
                <strong>No questions loaded.</strong>
                Answer IDs: {{ Object.keys(studentResult.answers || {}).filter(k => !isNaN(Number(k)) && Number(k) > 0).join(', ') || 'none' }}
            </span>
            <button class="btn btn-sm btn-outline-warning" @click="$emit('retry', studentResult)">
                <i class="fas fa-sync-alt"></i> Retry
            </button>
        </div>

        <div class="card border-0 shadow-sm rounded-4">
            <div class="card-header bg-white border-bottom p-4">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <h5 class="fw-bold mb-0">{{ report?.name || studentResult?.name || 'Test Paper' }}</h5>
                    <button class="btn btn-outline-secondary btn-sm" @click="handleBack">
                        <i class="fas fa-arrow-left me-1"></i> Back
                    </button>
                </div>
                
                <p class="text-muted mb-2">
                    <i class="fas fa-user me-1"></i>
                    {{ getStudentName(studentResult?.studentId, studentResult) }}
                </p>

                <div class="d-flex flex-wrap gap-3 align-items-center">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-star me-2 text-warning"></i>
                        <span class="me-2 text-muted small">Score:</span>
                        <strong class="badge fs-6" :class="getScoreBadgeClass(studentResult?.score)">
                            {{ studentResult?.score ?? '—' }}%
                        </strong>
                    </div>
                    
                    <span class="text-muted small">
                        <i class="fas fa-check me-1 text-success"></i>
                        {{ studentResult?.rawScore ?? studentResult?.raw_score ?? '?' }} / {{ studentResult?.totalQuestions ?? studentResult?.total_questions ?? '?' }} correct
                    </span>
                    
                    <span class="text-muted small">
                        <i class="fas fa-clock me-1 text-muted"></i>
                        Total: {{ resolvedDuration > 0 ? formatDuration(resolvedDuration) : '—' }}
                    </span>
                    
                    <span v-if="selectedQuestionsForPreview.length > 0" class="text-muted small">
                        <i class="fas fa-chart-line me-1 text-muted"></i>
                        Avg/Q: {{ formatDuration(resolvedDuration / selectedQuestionsForPreview.length) }}
                    </span>
                    
                    <span class="text-muted small">
                        <i class="fas fa-calendar me-1 text-muted"></i>
                        {{ studentResult?.completedAt ? new Date(studentResult.completedAt).toLocaleString() : '—' }}
                    </span>
                </div>
            </div>

            <div class="card-body p-4" style="max-height:75vh;overflow-y:auto">
                <div v-if="!selectedQuestionsForPreview.length" class="text-center text-muted p-5">
                    <i class="fas fa-question-circle fa-3x mb-3 opacity-25 d-block"></i>
                    No questions found for this exam.
                    <div class="mt-3">
                        <button class="btn btn-sm btn-outline-primary" @click="$emit('retry', studentResult)">
                            <i class="fas fa-sync-alt me-1"></i> Retry Loading Questions
                        </button>
                    </div>
                </div>

                <div v-for="(q, i) in selectedQuestionsForPreview" :key="q.id" class="card mb-3 border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <h6 class="fw-bold mb-0">Q{{ i + 1 }}. {{ q.text }}</h6>
                            <span class="badge ms-2 flex-shrink-0"
                                :class="isCorrect(q, studentResult) ? 'bg-success' : 'bg-danger'">
                                {{ isCorrect(q, studentResult) ? '✓ Correct' : '✗ Wrong' }}
                            </span>
                        </div>
                        <small class="text-muted d-block mb-3">
                            {{ q.type }}
                            <span v-if="q.cognitiveLevel"> · {{ q.cognitiveLevel }}</span>
                            <span v-if="normalizeLO(q.loTags)"> · {{ normalizeLO(q.loTags) }}</span>
                            <span class="ms-2 badge bg-light text-dark border fw-normal">
                                <i class="fas fa-clock me-1 text-muted"></i>
                                Time Spent: {{ formatDuration(getQuestionTime(q.id)) }}
                            </span>
                        </small>

                        <!-- Multiple Choice -->
                        <div v-if="q.type === 'Multiple Choice'">
                            <div v-for="(opt, idx) in q.options" :key="idx"
                                class="p-2 mb-2 rounded border position-relative"
                                :class="mcOptionClass(q, idx, studentResult)">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="d-flex align-items-center">
                                        <span class="me-2 fw-bold">{{ String.fromCharCode(65 + idx) }}.</span>
                                        <span>{{ opt.text }}</span>
                                    </div>
                                    <div class="d-flex gap-2">
                                        <span v-if="isMcCorrect(q, idx)" class="badge bg-success shadow-sm">
                                            <i class="fas fa-check-circle me-1"></i>Correct Answer
                                        </span>
                                        <span v-if="isMcStudentAnswer(q, idx, studentResult)"
                                            class="badge shadow-sm"
                                            :class="isMcCorrect(q, idx) ? 'bg-primary' : 'bg-danger'">
                                            <i class="fas me-1"
                                                :class="isMcCorrect(q, idx) ? 'fa-user-check' : 'fa-user-times'"></i>
                                            Your Answer
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- True or False -->
                        <div v-else-if="q.type === 'True or False'">
                            <div v-for="opt in ['True', 'False']" :key="opt"
                                class="p-2 mb-2 rounded border"
                                :class="tfOptionClass(q, opt, studentResult)">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>{{ opt }}</span>
                                    <div class="d-flex gap-2">
                                        <span v-if="opt === getCorrectTf(q)" class="badge bg-success shadow-sm">
                                            <i class="fas fa-check-circle me-1"></i>Correct Answer
                                        </span>
                                        <span v-if="isTfStudentAnswer(q, opt, studentResult)"
                                            class="badge shadow-sm"
                                            :class="opt === getCorrectTf(q) ? 'bg-primary' : 'bg-danger'">
                                            <i class="fas me-1"
                                                :class="opt === getCorrectTf(q) ? 'fa-user-check' : 'fa-user-times'"></i>
                                            Your Answer
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Identification -->
                        <div v-else-if="q.type === 'Identification'">
                            <div class="p-2 mb-2 rounded border bg-success-subtle border-success">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="d-flex align-items-center">
                                        <i class="fas fa-check-circle me-2 text-success"></i>
                                        <span>{{ getCorrectId(q) || '—' }}</span>
                                    </div>
                                    <span class="badge bg-success shadow-sm">
                                        <i class="fas fa-check-circle me-1"></i>Correct Answer
                                    </span>
                                </div>
                            </div>
                            <div class="p-2 mb-2 rounded border"
                                :class="isCorrect(q, studentResult) ? 'bg-primary-subtle border-primary' : 'bg-danger-subtle border-danger'">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="d-flex align-items-center">
                                        <i class="fas me-2"
                                            :class="isCorrect(q, studentResult) ? 'fa-user-check text-primary' : 'fa-user-times text-danger'"></i>
                                        <span>{{ getStudentAnswerValue(q, studentResult) || 'No Answer' }}</span>
                                    </div>
                                    <span class="badge shadow-sm"
                                        :class="isCorrect(q, studentResult) ? 'bg-primary' : 'bg-danger'">
                                        <i class="fas me-1"
                                            :class="isCorrect(q, studentResult) ? 'fa-user-check' : 'fa-user-times'"></i>
                                        Your Answer
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Enumeration -->
                        <div v-else-if="q.type === 'Enumeration'" class="row g-3">
                            <div class="col-md-6">
                                <div class="p-3 rounded border bg-success-subtle border-success">
                                    <small class="d-block mb-1 fw-semibold text-success">
                                        <i class="fas fa-check-circle me-1"></i>Expected Answers
                                    </small>
                                    <ul class="mb-0 ps-3">
                                        <li v-for="ans in getEnumAnswers(q)" :key="ans">{{ ans }}</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 rounded border bg-light">
                                    <small class="d-block mb-1 fw-semibold text-muted">
                                        <i class="fas fa-user me-1"></i>Your Answer
                                    </small>
                                    <span class="fw-bold">
                                        {{ getStudentAnswerValue(q, studentResult) || 'No Answer' }}
                                    </span>
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
.border-transparent { border-color: transparent !important; }
</style>