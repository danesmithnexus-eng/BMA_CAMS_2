<script>
import { mapState, mapActions } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useQuestionStore } from '../stores/questions';

export default {
    name: 'QuestionList',
    
    props: {
        courseList: {
            type: Array,
            default: () => []
        },
        expandedCourses: {
            type: Object,
            default: () => ({})
        }
    },

    emits: [
        'toggle-course',
        'edit-question',
        'delete-question',
        'update-status',
        'validate-question',
        'invalidate-question',
        'approve-question',
        'disapprove-question'
    ],

    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' })
    },

    methods: {
        ...mapActions(useQuestionStore, []),

        // Role checks
        normalizeRole() {
            try {
                return (this.currentUser?.role || '').toString().toLowerCase();
            } catch (e) {
                return '';
            }
        },
        isAdmin() {
            return this.normalizeRole().includes('admin');
        },
        isFaculty() {
            return this.normalizeRole().includes('faculty');
        },
        isAssessor() {
            return this.normalizeRole().includes('assessor');
        },
        isCollecting() {
            return this.normalizeRole().includes('collecting');
        },
        isReview() {
            return this.normalizeRole().includes('review');
        },

        // UI Helpers
        isCourseExpanded(courseId) {
            return !!this.expandedCourses[courseId];
        },

        toggleCourseGroup(courseId) {
            this.$emit('toggle-course', courseId);
        },

        formatStatus(s) {
            try {
                const val = (s || '').toString().toLowerCase();
                const map = {
                    'draft': 'Draft',
                    'active': 'Approved',
                    'approved': 'Approved',
                    'pending_validation': 'Pending Validation',
                    'pending validation': 'Pending Validation',
                    'pending_approval': 'Pending Approval',
                    'pending approval': 'Pending Approval',
                    'validated': 'Pending Approval',
                    'archived': 'Rejected',
                    'rejected': 'Rejected',
                    'invalid': 'Rejected'
                };
                if (val === 'inactive') return this.isCollecting() ? 'Pending Validation' : 'Pending Approval';
                return map[val] || (s || 'Draft');
            } catch (e) {
                return 'Draft';
            }
        },

        getStatusBadge(status) {
            try {
                const badges = {
                    'Draft': 'badge bg-secondary',
                    'Pending Validation': 'badge bg-info text-dark',
                    'Pending Approval': 'badge bg-primary',
                    'Approved': 'badge bg-success',
                    'Rejected': 'badge bg-danger'
                };
                return badges[status] || 'badge bg-light text-dark';
            } catch (e) {
                return 'badge bg-light text-dark';
            }
        },

        formatQuestionType(item) {
            try {
                const id = item?.question_type_id;
                const str = (item?.question_type || '').toLowerCase();
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
                return typeof id === 'string' ? id : 'Multiple Choice';
            } catch (e) {
                return 'Multiple Choice';
            }
        },

        isMultipleChoice(item) {
            return this.formatQuestionType(item) === 'Multiple Choice';
        },

        getCorrectOptionText(options, index) {
            if (!options || !Array.isArray(options)) return 'N/A';
            
            // Use let because we reassign it below
            let idx = typeof index === 'number' ? index : -1;
            if (idx < 0) {
                const found = options.findIndex(o => !!o.is_correct);
                if (found >= 0) {
                    idx = found;
                } else {
                    idx = 0;
                }
            }
            
            const opt = options[idx];
            if (!opt) return 'N/A';
            return opt.text || opt.option_text || 'N/A';
        },

        formatCorrectAnswer(item) {
            const t = this.formatQuestionType(item);
            if (t === 'True or False') {
                const v = item.correctAnswer !== undefined ? item.correctAnswer : item.answer;
                if (typeof v === 'boolean') return v ? 'True' : 'False';
                const s = (v || '').toString().toLowerCase();
                if (s === 'true' || s === '1') return 'True';
                if (s === 'false' || s === '0') return 'False';
                return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
            }
            if (t === 'Identification') {
                return item.correctAnswer !== undefined ? item.correctAnswer : item.answer || '';
            }
            return '';
        },

        // Action handlers
        handleEdit(question, courseGroup) {
            this.$emit('edit-question', question, courseGroup);
        },

        handleDelete(question) {
            this.$emit('delete-question', question);
        },

        handleSubmit(question) {
            this.$emit('update-status', question, 'Pending Validation');
        },

        handleValidate(question) {
            this.$emit('update-status', question, 'Pending Approval');
        },

        handleInvalidate(question) {
            this.$emit('invalidate-question', question);
        },

        handleApprove(question) {
            this.$emit('update-status', question, 'Approved');
        },

        handleDisapprove(question) {
            this.$emit('disapprove-question', question);
        }
    },

    errorCaptured(err, vm, info) {
        console.error('Error captured in QuestionList:', err);
        return false; // Don't propagate error
    },

    mounted() {
        try {
            console.log('QuestionList mounted with', this.courseList?.length || 0, 'courses');
        } catch (e) {
            console.error('Error in QuestionList mounted:', e);
        }
    }
};
</script>

<template>
    <div>
        <!-- Empty State -->
        <div v-if="!courseList || courseList.length === 0" class="card">
            <div class="card-body text-center text-muted p-5">
                <i class="fas fa-inbox fa-3x mb-3 text-muted"></i>
                <h5>Your question bank is empty</h5>
                <p class="text-muted">Click "Add Question" or "Bulk Upload" to begin.</p>
            </div>
        </div>

        <!-- Course Groups -->
        <div v-else>
            <div v-for="course in courseList" :key="course.course_id" class="mb-5">
                <!-- Course Header -->
                <h4 class="mb-3 pb-2 border-bottom border-secondary text-dark cursor-pointer user-select-none d-flex align-items-center"
                    @click="toggleCourseGroup(course.course_id)">
                    <i class="fas fa-book me-2"></i>
                    Course: {{ course.course_name }} ({{ course.questions.length }})
                    <i class="fas float-end mt-1"
                        :class="isCourseExpanded(course.course_id) ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                </h4>

                <!-- Questions (when expanded) -->
                <div v-if="isCourseExpanded(course.course_id)">
                    <div v-for="question in course.questions" :key="question.id" class="card mb-3">
                        <div class="card-header d-flex justify-content-between">
                            <span>Question Preview</span>
                            <span :class="getStatusBadge(formatStatus(question.status))">
                                {{ formatStatus(question.status) }}
                            </span>
                        </div>
                        <div class="card-body">
                            <p class="text-muted">
                                <strong>Course:</strong> {{ course.course_name }} |
                                <strong>Question Type:</strong> {{ formatQuestionType(question) }}
                            </p>
                            <p class="text-muted small">
                                <strong>LO:</strong> {{ question.learning_outcome ?? '' }} |
                                <strong>Cognitive Level:</strong> {{ question.cognitive_level || '' }}
                            </p>
                            <p class="lead"><strong>Question:</strong> {{ question.text }}</p>
                            <p class="text-muted"><strong>Points:</strong> {{ question.points || 1 }}</p>

                            <!-- Show remarks if any -->
                            <div v-if="question.remarks && formatStatus(question.status) === 'Draft'"
                                 class="alert alert-danger p-2 mt-3">
                                <strong>Remarks for revision:</strong><br>
                                <p class="mb-0 fst-italic">{{ question.remarks }}</p>
                            </div>

                            <hr>

                            <!-- Answer Details -->
                            <div v-if="isMultipleChoice(question)">
                                <h6>Correct Answer:</h6>
                                <p><strong>{{ getCorrectOptionText(question.options, question.correctAnswerIndex) }}</strong></p>
                            </div>
                            <div v-else-if="formatQuestionType(question) === 'True or False' || formatQuestionType(question) === 'Identification'">
                                <h6>Correct Answer:</h6>
                                <p><strong>{{ formatCorrectAnswer(question) }}</strong></p>
                            </div>
                            <div v-else-if="formatQuestionType(question) === 'Enumeration'">
                                <h6>Possible Answers:</h6>
                                <ul class="list-group">
                                    <li v-for="ans in (Array.isArray(question.answer) ? question.answer : [])" 
                                        :key="ans" 
                                        class="list-group-item">{{ ans }}</li>
                                </ul>
                            </div>
                            <div v-else-if="formatQuestionType(question) === 'Matching Type'">
                                <h6>Matching Pairs:</h6>
                                <ul class="list-group">
                                    <li v-for="(pair, index) in question.pairs" :key="index" class="list-group-item">
                                        {{ pair.prompt }} <i class="fas fa-long-arrow-alt-right"></i> {{ pair.answer }}
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div class="card-footer text-end">
                            <!-- Faculty Actions -->
                            <template v-if="(isFaculty() || isAdmin() || isAssessor()) && formatStatus(question.status) === 'Draft'">
                                <button class="btn btn-sm btn-success me-2" @click="handleSubmit(question)">
                                    Submit
                                </button>
                                <button class="btn btn-sm btn-outline-secondary me-2" @click="handleEdit(question, course)">
                                    Edit
                                </button>
                                <button class="btn btn-sm btn-outline-danger" @click="handleDelete(question)">
                                    Delete
                                </button>
                            </template>

                            <!-- Collecting Officer Actions -->
                            <template v-if="(isCollecting() || isAdmin() || isAssessor()) && formatStatus(question.status) === 'Pending Validation'">
                                <button class="btn btn-sm btn-outline-secondary me-2" @click="handleEdit(question, course)">
                                    Edit
                                </button>
                                <button class="btn btn-sm btn-danger me-2" @click="handleInvalidate(question)">
                                    Invalid
                                </button>
                                <button class="btn btn-sm btn-success" @click="handleValidate(question)">
                                    Validate
                                </button>
                            </template>

                            <!-- Review Committee Actions -->
                            <template v-if="(isReview() || isAdmin() || isAssessor()) && formatStatus(question.status) === 'Pending Approval'">
                                <button class="btn btn-sm btn-outline-secondary me-2" @click="handleEdit(question, course)">
                                    Edit
                                </button>
                                <button class="btn btn-sm btn-danger me-2" @click="handleDisapprove(question)">
                                    Disapprove
                                </button>
                                <button class="btn btn-sm btn-success" @click="handleApprove(question)">
                                    Approve
                                </button>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.cursor-pointer {
    cursor: pointer;
}

.user-select-none {
    user-select: none;
}
</style>
