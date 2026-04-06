<script>
export default {
    name: 'QuestionCard',
    
    props: {
        question: {
            type: Object,
            required: true
        },
        courseName: {
            type: String,
            default: ''
        },
        userRole: {
            type: String,
            default: ''
        }
    },

    emits: ['update-status', 'edit-question', 'delete-question', 'validate', 'invalidate', 'approve', 'disapprove'],

    computed: {
        statusBadge() {
            const status = this.formatStatus(this.question.status);
            if (status === 'Approved') return 'bg-success';
            if (status === 'Draft') return 'bg-secondary';
            if (status === 'Pending Validation') return 'bg-warning text-dark';
            if (status === 'Pending Approval') return 'bg-info';
            if (status === 'Invalid') return 'bg-danger';
            return 'bg-light text-dark';
        }
    },

    methods: {
        formatStatus(status) {
            if (!status) return 'Draft';
            return status.toString().trim();
        },

        getCorrectOptionText(options, correctIndex) {
            if (!options || !Array.isArray(options)) return 'N/A';
            const idx = typeof correctIndex === 'string' ? parseInt(correctIndex) : Number(correctIndex);
            if (isNaN(idx) || idx < 0 || idx >= options.length) return 'N/A';
            return options[idx]?.text || 'N/A';
        },

        isMultipleChoice(q) {
            const type = this.getQuestionTypeText(q);
            return type === 'Multiple Choice';
        },

        getQuestionTypeText(q) {
            if (q.type_name) return q.type_name;
            if (q.question_type_id === '1') return 'Multiple Choice';
            if (q.question_type_id === '2') return 'True or False';
            if (q.question_type_id === '3') return 'Identification';
            if (q.question_type_id === '4') return 'Enumeration';
            if (q.question_type_id === '5') return 'Matching Type';
            return 'Unknown';
        },

        formatCorrectAnswer(q) {
            if (q.correct_answer) return q.correct_answer;
            if (q.answer) return q.answer;
            return 'N/A';
        },

        canEdit() {
            return ['Faculty', 'Admin', 'Assessor', 'Collecting Officer', 'Review Committee'].includes(this.userRole);
        },

        canSubmit() {
            return ['Faculty', 'Admin', 'Assessor'].includes(this.userRole);
        },

        canValidate() {
            return ['Collecting Officer', 'Admin', 'Assessor'].includes(this.userRole);
        },

        canApprove() {
            return ['Review Committee', 'Admin', 'Assessor'].includes(this.userRole);
        }
    }
};
</script>

<template>
    <div class="card mb-3">
        <div class="card-header d-flex justify-content-between">
            <span>Question Preview</span>
            <span :class="statusBadge">{{ formatStatus(question.status) }}</span>
        </div>
        <div class="card-body">
            <p class="text-muted">
                <strong>Course:</strong> {{ courseName }} |
                <strong>Question Type:</strong> {{ getQuestionTypeText(question) }}
            </p>
            <p class="text-muted small">
                <strong>LO:</strong> {{ question.learning_outcome ?? '' }} |
                <strong>Cognitive Level:</strong> {{ question.cognitive_level || '' }}
            </p>
            <p class="lead"><strong>Questions:</strong> {{ question.text }}</p>
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
            <div v-else-if="getQuestionTypeText(question) === 'True or False' || getQuestionTypeText(question) === 'Identification'">
                <h6>Correct Answer:</h6>
                <p><strong>{{ formatCorrectAnswer(question) }}</strong></p>
            </div>
            <div v-else-if="getQuestionTypeText(question) === 'Enumeration'">
                <h6>Possible Answers:</h6>
                <ul class="list-group">
                    <li v-for="ans in (Array.isArray(question.answer) ? question.answer : [])" 
                        :key="ans" 
                        class="list-group-item">{{ ans }}</li>
                </ul>
            </div>
            <div v-else-if="getQuestionTypeText(question) === 'Matching Type'">
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
            <template v-if="canSubmit() && formatStatus(question.status) === 'Draft'">
                <button class="btn btn-sm btn-success me-2" 
                        @click="$emit('update-status', question, 'Pending Validation')">
                    Submit
                </button>
                <button class="btn btn-sm btn-outline-secondary me-2" 
                        @click="$emit('edit-question', question)">
                    Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" 
                        @click="$emit('delete-question', question)">
                    Delete
                </button>
            </template>
            
            <!-- Collecting Officer Actions -->
            <template v-if="canValidate() && formatStatus(question.status) === 'Pending Validation'">
                <button class="btn btn-sm btn-outline-secondary me-2" 
                        @click="$emit('edit-question', question)">
                    Edit
                </button>
                <button class="btn btn-sm btn-danger me-2" 
                        @click="$emit('invalidate', question)">
                    Invalid
                </button>
                <button class="btn btn-sm btn-success" 
                        @click="$emit('update-status', question, 'Pending Approval')">
                    Validate
                </button>
            </template>
            
            <!-- Review Committee Actions -->
            <template v-if="canApprove() && formatStatus(question.status) === 'Pending Approval'">
                <button class="btn btn-sm btn-outline-secondary me-2" 
                        @click="$emit('edit-question', question)">
                    Edit
                </button>
                <button class="btn btn-sm btn-danger me-2" 
                        @click="$emit('disapprove', question)">
                    Disapprove
                </button>
                <button class="btn btn-sm btn-success" 
                        @click="$emit('update-status', question, 'Approved')">
                    Approve
                </button>
            </template>
        </div>
    </div>
</template>

<style scoped>
</style>