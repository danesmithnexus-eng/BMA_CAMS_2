<template>
    <div>
        <!-- Question Bank Action Buttons -->
        <QuestionBankActions
            :has-drafts="hasDrafts"
            :has-pending-validation="hasPendingValidation"
            :has-pending-approval="hasPendingApproval"
            @submit-all-drafts="openSubmitAllConfirmation"
            @delete-all-drafts="openDeleteAllConfirmation"
            @bulk-upload="openBulkUploadModal"
            @add-question="openQuestionModal()"
            @validate-all="openValidateAllConfirmation"
            @invalidate-all="openRejectAllConfirmation"
            @approve-all="openApproveAllConfirmation"
            @disapprove-all="openRejectAllApprovalConfirmation"
        />
        <!-- Filter Section -->
        <div class="card mb-4">
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-lg-3"><input type="text" class="form-control" placeholder="Search questions..."
                            v-model="filters.searchText"></div>
                    <div class="col-lg-2 col-md-6"><select class="form-select" v-model="filters.program">
                            <option value="All">All Programs</option>
                            <option v-for="program in allPrograms" :key="program">{{ program }}</option>
                        </select></div>
                    <div class="col-lg-2 col-md-6"><select class="form-select" v-model="filters.course_id">
                            <option value="All">All Courses</option>
                            <option v-for="course in allCourses" :key="course">{{ course }}</option>
                        </select></div>
                    <div class="col-lg-2 col-md-6"><select class="form-select" v-model="filters.question_type_id">
                            <option value="All">All Types</option>
                            <option v-for="type in allTypes" :key="type">{{ type }}</option>
                        </select></div>
                    <div class="col-lg-2 col-md-6"><select class="form-select" v-model="filters.status">
                            <option value="All">All Statuses</option>
                            <option v-for="status in allStatuses" :key="status">{{ status }}</option>
                        </select></div>
                    <div class="col-lg-1"><button class="btn btn-sm btn-outline-secondary w-100"
                            @click="resetFilters">Reset</button></div>
                </div>
            </div>
        </div>

        <!-- Unified Preview View -->
        <QuestionList
            :course-list="courseList"
            :expanded-courses="expandedCourses"
            @toggle-course="toggleCourseGroup"
            @edit-question="openQuestionModal"
            @delete-question="openDeleteConfirmation"
            @update-status="handleUpdateStatus"
            @invalidate-question="openInvalidModal"
            @disapprove-question="openDisapproveModal"
        />

        <!-- MODALS -->
        <!-- Question Editor Modal -->
        <Teleport to="body">
            <div class="modal fade" id="questionEditorModal" tabindex="-1" ref="questionModal">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">{{ editingQuestion.id ? 'Edit' : 'Add' }} Question</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Program</label>
                                    <select class="form-select" v-model.number="editingQuestion.program_id"
                                        :disabled="editingQuestion.id">
                                        <option value="">Select Program</option>
                                        <option v-for="p in programOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Course</label>
                                    <select class="form-select" v-model.number="editingQuestion.course_id"
                                        :disabled="editingQuestion.id">
                                        <option value="">Select Course</option>
                                        <option v-for="opt in courseIdOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Question Type</label>
                                <select class="form-select" v-model="editingQuestion.question_type_id" @change="onQuestionTypeChange">
                                    <option>Multiple Choice</option>
                                    <option>True or False</option>
                                    <option>Matching Type</option>
                                    <option>Identification</option>
                                    <option>Enumeration</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Question Text</label>
                                <textarea class="form-control" v-model="editingQuestion.text" rows="3"></textarea>
                            </div>

                            <hr>

                            <!-- Loading spinner shown while choices are being fetched -->
                            <div v-if="loadingChoices" class="text-center text-muted small mb-3">
                                <span class="spinner-border spinner-border-sm me-1"></span> Loading choices...
                            </div>

                            <!-- Multiple Choice options -->
                            <div v-if="editingQuestion.question_type_id && editingQuestion.question_type_id.toLowerCase().includes('multiple')">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6>Answer Options</h6>
                                </div>
                                <div v-for="(option, index) in editingQuestion.options" :key="index" class="input-group mb-2">
                                    <div class="input-group-text">
                                        <input class="form-check-input mt-0" type="radio" :value="index"
                                            v-model="editingQuestion.correctAnswerIndex">
                                    </div>
                                    <input type="text" class="form-control" v-model="option.text" placeholder="Option text">
                                </div>
                            </div>

                            <div v-if="editingQuestion.question_type_id === 'True or False'">
                                <div class="mb-3">
                                    <label class="form-label">Correct Answer</label>
                                    <select class="form-select" v-model="editingQuestion.answer">
                                        <option>True</option>
                                        <option>False</option>
                                    </select>
                                </div>
                            </div>

                            <div v-if="editingQuestion.question_type_id === 'Identification'">
                                <div class="mb-3">
                                    <label class="form-label">Correct Answer</label>
                                    <input type="text" class="form-control" v-model="editingQuestion.answer">
                                </div>
                            </div>

                            <div v-if="editingQuestion.question_type_id === 'Enumeration'">
                                <div class="mb-3">
                                    <label class="form-label">Correct Answers (One per line)</label>
                                    <div v-for="(ans, index) in editingQuestion.answers" :key="index" class="d-flex gap-2 mb-2">
                                        <input type="text" class="form-control" v-model="editingQuestion.answers[index]">
                                        <button class="btn btn-outline-danger" @click="editingQuestion.answers.splice(index, 1)">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                    <button class="btn btn-sm btn-outline-primary" @click="editingQuestion.answers.push('')">+ Add Answer</button>
                                </div>
                            </div>

                            <div v-if="editingQuestion.question_type_id === 'Matching Type'">
                                <div class="mb-3">
                                    <label class="form-label">Pairs</label>
                                    <div v-for="(pair, index) in editingQuestion.pairs" :key="index" class="row g-2 mb-2">
                                        <div class="col-md-5">
                                            <input type="text" class="form-control" v-model="pair.prompt" placeholder="Prompt">
                                        </div>
                                        <div class="col-md-5">
                                            <input type="text" class="form-control" v-model="pair.answer" placeholder="Match">
                                        </div>
                                        <div class="col-md-2">
                                            <button class="btn btn-outline-danger w-100" @click="editingQuestion.pairs.splice(index, 1)">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <button class="btn btn-sm btn-outline-primary"
                                        @click="editingQuestion.pairs.push({ prompt: '', answer: '' })">+ Add Pair</button>
                                </div>
                            </div>

                            <hr>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Learning Outcome</label>
                                    <select class="form-select" v-model.number="editingQuestion.learning_outcome_id">
                                        <option value="">Select Learning Outcome</option>
                                        <option v-for="opt in learningOutcomeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Cognitive Level</label>
                                    <select class="form-select" v-model="editingQuestion.cognitiveLevel">
                                        <option v-for="level in cognitiveLevels" :key="level" :value="level">{{ level }}</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">
                                    Remarks
                                    <span v-if="isFaculty() && !isAdmin() && !isAssessor()" class="text-muted small ms-1">(read-only)</span>
                                </label>
                                <textarea class="form-control" v-model="editingQuestion.remarks" rows="2"
                                    :disabled="isFaculty() && !isAdmin() && !isAssessor()"
                                    :class="{ 'bg-light text-muted': isFaculty() && !isAdmin() && !isAssessor() }"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" @click="saveQuestion">Save Question</button>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Delete Confirmation Modal -->
        <Teleport to="body">
            <div class="modal fade" id="deleteConfirmationModal" tabindex="-1" ref="deleteConfirmationModal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Confirm Delete</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">Are you sure you want to delete this question?</div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" @click="confirmDeleteQuestion">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Bulk Upload Modal -->
        <Teleport to="body">
            <div class="modal fade" id="bulkUploadModal" tabindex="-1" ref="bulkUploadModal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Bulk Upload Questions</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Select CSV File</label>
                                <input type="file" class="form-control" ref="csvFileInput" accept=".csv">
                            </div>
                            <div class="alert alert-info">
                                <small>
                                    <i class="fas fa-info-circle me-2"></i>
                                    CSV format: Program, Course, Type, LO Tag, Question Text, Option A, Option B, Option C, Option D, Correct Answer, Points, CO Level
                                </small>
                            </div>
                            <div v-if="uploadStatusMessage" class="mt-2 text-primary small">{{ uploadStatusMessage }}</div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" @click="handleBulkUpload">Upload</button>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Submit All Confirmation -->
        <Teleport to="body">
            <div class="modal fade" id="submitAllConfirmationModal" tabindex="-1" ref="submitAllConfirmationModal">
                <div class="modal-dialog"><div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Submit All Drafts</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">Submit all draft questions for validation?</div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-success" @click="handleSubmitAll">Submit All</button></div>
                </div></div>
            </div>
        </Teleport>

        <!-- Delete All Confirmation -->
        <Teleport to="body">
            <div class="modal fade" id="deleteAllConfirmationModal" tabindex="-1" ref="deleteAllConfirmationModal">
                <div class="modal-dialog"><div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Delete All Drafts</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">Are you sure you want to delete ALL draft questions?</div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-danger" @click="handleDeleteAll">Delete All</button></div>
                </div></div>
            </div>
        </Teleport>

        <!-- Validate All Confirmation -->
        <Teleport to="body">
            <div class="modal fade" id="validateAllConfirmationModal" tabindex="-1" ref="validateAllConfirmationModal">
                <div class="modal-dialog"><div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Validate All Pending</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">Move all pending validation questions to pending approval?</div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-success" @click="handleValidateAll">Validate All</button></div>
                </div></div>
            </div>
        </Teleport>

        <!-- Invalidate All Confirmation -->
        <Teleport to="body">
            <div class="modal fade" id="rejectAllConfirmationModal" tabindex="-1" ref="rejectAllConfirmationModal">
                <div class="modal-dialog"><div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Invalidate All Pending</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">Return all pending validation questions to draft status?</div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-danger" @click="handleInvalidateAll">Invalidate All</button></div>
                </div></div>
            </div>
        </Teleport>

        <!-- Approve All Confirmation -->
        <Teleport to="body">
            <div class="modal fade" id="approveAllConfirmationModal" tabindex="-1" ref="approveAllConfirmationModal">
                <div class="modal-dialog"><div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Approve All Pending</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">Approve all pending approval questions?</div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-success" @click="handleApproveAll">Approve All</button></div>
                </div></div>
            </div>
        </Teleport>

        <!-- Disapprove All Confirmation -->
        <Teleport to="body">
            <div class="modal fade" id="rejectAllApprovalConfirmationModal" tabindex="-1" ref="rejectAllApprovalConfirmationModal">
                <div class="modal-dialog"><div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Disapprove All Pending</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">Return all pending approval questions to draft status?</div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-danger" @click="handleDisapproveAll">Disapprove All</button></div>
                </div></div>
            </div>
        </Teleport>

        <!-- Invalidate Remark Modal -->
        <Teleport to="body">
            <div class="modal fade" id="invalidRemarkModal" tabindex="-1" ref="invalidRemarkModal">
                <div class="modal-dialog"><div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Invalidate Question</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Remark/Reason for invalidation</label>
                            <textarea class="form-control" v-model="invalidRemark" rows="3" placeholder="Explain why this question is invalid..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-danger" @click="confirmInvalidate">Invalidate Question</button></div>
                </div></div>
            </div>
        </Teleport>

        <!-- Disapprove Remark Modal -->
        <Teleport to="body">
            <div class="modal fade" id="disapproveRemarkModal" tabindex="-1" ref="disapproveRemarkModal">
                <div class="modal-dialog"><div class="modal-content">
                    <div class="modal-header"><h5 class="modal-title">Disapprove Question</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Remark/Reason for disapproval</label>
                            <textarea class="form-control" v-model="disapproveRemark" rows="3" placeholder="Explain why this question is disapproved..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-danger" @click="confirmDisapprove">Disapprove Question</button></div>
                </div></div>
            </div>
        </Teleport>
    </div>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { useQuestionStore } from '../stores/questions';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';
import * as bootstrap from 'bootstrap';
import api from '../services/api';
import QuestionBankActions from './QuestionBankActions.vue';
import QuestionBankFilters from './QuestionBankFilters.vue';
import QuestionList from './QuestionList.vue';

export default {
    name: 'QuestionBank',
    components: { QuestionBankActions, QuestionBankFilters, QuestionList },
    data() {
        return {
            expandedCourses: {},
            editingQuestion: {},
            _editingQuestionId: null,
            loadingChoices: false,
            questionToDelete: {},
            questionToInvalidate: null,
            invalidRemark: '',
            questionToDisapprove: null,
            disapproveRemark: '',
            uploadStatusMessage: '',

            questionBsModal: null, deleteBsModal: null, bulkUploadBsModal: null,
            submitAllBsModal: null, deleteAllBsModal: null, validateAllBsModal: null,
            rejectAllBsModal: null, approveAllBsModal: null, rejectAllApprovalBsModal: null,
            invalidRemarkBsModal: null, disapproveRemarkBsModal: null,

            cognitiveLevels: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'],
            courseIdOptions: [],
            coursesById: {},
            learningOutcomeOptions: [],
            programOptions: [{ value: 5, label: 'BSMT' }, { value: 6, label: 'BSMarE' }],
            courseList: [],
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            connectionLost: false
        };
    },
    computed: {
        ...mapState(useQuestionStore, ['questions', 'filters', 'filteredQuestions', 'groupedQuestions', 'hasDrafts', 'hasPendingValidation', 'hasPendingApproval']),
        ...mapState(useAuthStore, { currentUser: 'user' }),
        filteredQuestionBank() { return this.filteredQuestions; },
        groupedQuestionBank() { return this.groupedQuestions; },
        allPrograms() { return ['Deck Operations', 'Navigation', 'Safety', 'ICT', 'MARLAW']; },
        allCourses() { return ['Seamanship I', 'COLREGs', 'Ship Construction', 'Firefighting', 'ICT', 'MARLAW']; },
        allTypes() { return ['Multiple Choice', 'True or False', 'Identification', 'Matching Type', 'Enumeration']; },
        allStatuses() { return ['Draft', 'Pending Validation', 'Pending Approval', 'Approved', 'Rejected']; }
    },
    methods: {
        ...mapActions(useQuestionStore, ['addQuestion', 'updateQuestion', 'deleteQuestion', 'updateStatus', 'setFilters', 'resetFilters', 'batchUpdateStatus', 'clearAll']),
        ...mapActions(useUIStore, ['showToast']),

        toggleCourseGroup(courseId) {
            const updated = { ...this.expandedCourses };
            updated[courseId] = !updated[courseId];
            this.expandedCourses = updated;
        },

        formatStatus(s) {
            try {
                const val = (s || '').toString().toLowerCase();
                const map = {
                    'draft': 'Draft', 'active': 'Approved', 'approved': 'Approved',
                    'pending_validation': 'Pending Validation', 'pending validation': 'Pending Validation',
                    'pending_approval': 'Pending Approval', 'pending approval': 'Pending Approval',
                    'validated': 'Pending Approval', 'archived': 'Rejected', 'rejected': 'Rejected', 'invalid': 'Rejected'
                };
                if (val === 'inactive') return this.isCollecting() ? 'Pending Validation' : 'Pending Approval';
                return map[val] || (s || 'Draft');
            } catch (e) { return 'Draft'; }
        },

        canonicalStatus(s) {
            const val = (s || '').toString().toLowerCase();
            if (val === 'active' || val === 'approved') return 'Approved';
            if (val === 'pending_validation' || val === 'pending validation') return 'Pending Validation';
            if (val === 'pending_approval' || val === 'pending approval' || val === 'validated') return 'Pending Approval';
            if (val === 'archived' || val === 'rejected' || val === 'invalid') return 'Rejected';
            return 'Draft';
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
                if (typeof id === 'string') {
                    const idl = id.toLowerCase();
                    if (idl.includes('true')) return 'True or False';
                    if (idl.includes('multiple')) return 'Multiple Choice';
                    if (idl.includes('matching')) return 'Matching Type';
                    if (idl.includes('identification')) return 'Identification';
                    if (idl.includes('enumeration')) return 'Enumeration';
                    return id;
                }
                return 'Multiple Choice';
            } catch (e) { return 'Multiple Choice'; }
        },

        isMultipleChoice(item) { return this.formatQuestionType(item) === 'Multiple Choice'; },

        getDbStatusCandidates(uiStatus) {
            if (uiStatus === 'Draft') return ['draft'];
            if (uiStatus === 'Pending Validation') return ['pending_validation', 'inactive'];
            if (uiStatus === 'Pending Approval') return ['pending_approval', 'validated', 'inactive'];
            if (uiStatus === 'Approved') return ['active', 'approved'];
            if (uiStatus === 'Rejected') return ['archived', 'rejected', 'invalid'];
            return ['draft'];
        },

        handleValidate(question) { this.handleUpdateStatus(question, 'Pending Approval'); },
        handleApprove(question) { this.handleUpdateStatus(question, 'Approved'); },

        normalizeRole() { return (this.currentUser?.role || '').toString().toLowerCase(); },
        isAdmin() { return this.normalizeRole().includes('admin'); },
        isFaculty() { return this.normalizeRole().includes('faculty'); },
        isAssessor() { return this.normalizeRole().includes('assessor'); },
        isCollecting() { return this.normalizeRole().includes('collecting'); },
        isReview() { return this.normalizeRole().includes('review'); },
        isCourseExpanded(course) { return !!this.expandedCourses[course]; },

        getNewQuestionTemplate(type = 'Multiple Choice') {
            const base = { text: '', question_type_id: type, program_id: '', course_id: '', loTag: '', learning_outcome_id: null, cognitiveLevel: 'Remembering', status: 'Draft', remarks: '' };
            switch (type) {
                case 'Multiple Choice': return { ...base, options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }], correctAnswerIndex: 0 };
                case 'True or False': return { ...base, answer: 'True' };
                case 'Identification': return { ...base, answer: '' };
                case 'Enumeration': return { ...base, answers: [''] };
                case 'Matching Type': return { ...base, pairs: [{ prompt: '', answer: '' }] };
                default: return base;
            }
        },

        onQuestionTypeChange() {
            const currentType = this.editingQuestion.question_type_id;
            const template = this.getNewQuestionTemplate(currentType);
            this.editingQuestion = { ...template, id: this.editingQuestion.id, text: this.editingQuestion.text, program_id: this.editingQuestion.program_id, course_id: this.editingQuestion.course_id, loTag: this.editingQuestion.loTag, cognitiveLevel: this.editingQuestion.cognitiveLevel, status: this.editingQuestion.status, remarks: this.editingQuestion.remarks };
        },

        async fetchCourseIdOptions() {
            try {
                const { data } = await api.get('/course', { params: { per_page: 100 } });
                const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.data?.data) ? data.data.data : [];
                const options = [], byId = {};
                const programMap = new Map();
                list.forEach(c => {
                    if (!c.code) return;
                    options.push({ value: c.id, label: c.code });
                    byId[c.id] = c;
                    const pidRaw = (c.program && typeof c.program === 'object') ? c.program.id : (c.program_id || null);
                    const pid = pidRaw != null ? Number(pidRaw) : null;
                    const pname = (c.program && typeof c.program === 'object') ? c.program.name : (typeof c.program === 'string' ? c.program : '');
                    if (pid && pname && !programMap.has(pid)) programMap.set(pid, pname);
                });
                this.courseIdOptions = options;
                this.coursesById = byId;
                this.programOptions = [{ value: 5, label: programMap.get(5) || 'BSMT' }, { value: 6, label: programMap.get(6) || 'BSMarE' }];
                if (!options.length) this.showToast('Warning', 'No courses retrieved from the database.', 'warning');
                else if (this.connectionLost) { this.showToast('Success', 'Reconnected to the database.', 'success'); this.connectionLost = false; }
            } catch (err) {
                const offline = (typeof navigator !== 'undefined' && !navigator.onLine) || !err?.response;
                this.connectionLost = this.connectionLost || offline;
                this.showToast('Error', offline ? 'No connection. Cannot reach the database.' : 'Failed to fetch courses.', 'error');
            }
        },

        updateLearningOutcomeOptions() {
            const course = this.coursesById[this.editingQuestion?.course_id];
            const los = [];
            if (course) {
                (course.courseOutcomes || course.course_outcomes || []).forEach(co => {
                    (co.learningOutcomes || co.learning_outcomes || []).forEach(lo => {
                        if (lo.id && lo.code && !los.find(x => x.value === lo.id)) los.push({ value: lo.id, label: lo.code });
                    });
                });
            }
            this.learningOutcomeOptions = los;
            if (los.length && !los.find(x => x.value === this.editingQuestion.learning_outcome_id))
                this.editingQuestion.learning_outcome_id = los[0].value;
        },

        // ─── Helper: scan every possible API key for MC options ───────────────
        _extractOptions(d) {
            const raw = d.options || d.choices || d.multiple_choice_answers
                     || d.answers || d.question_options || d.answer_options
                     || d.mc_options || [];
            if (!Array.isArray(raw) || !raw.length) return null;
            const opts = raw.map(o =>
                typeof o === 'string'
                    ? { text: o, is_correct: false }
                    : { text: o.option_text || o.text || o.label || '', is_correct: !!o.is_correct }
            );
            // Only return if at least one option has real text
            return opts.some(o => (o.text || '').trim()) ? opts : null;
        },

        // ─── openQuestionModal ────────────────────────────────────────────────
        openQuestionModal(question = null, courseGroup = null) {
            this.loadingChoices = false;

            if (question) {
                const resolvedType = this.formatQuestionType(question);

                // Build initial options from list-API data (may be empty after page refresh)
                let initialOptions = [];
                if (Array.isArray(question.options) && question.options.length) {
                    initialOptions = question.options.map(o => ({ text: o.option_text || o.text || '' }));
                }
                // Always ensure 4 blank slots for MC so the modal is never empty while loading
                if (resolvedType === 'Multiple Choice') {
                    while (initialOptions.length < 4) initialOptions.push({ text: '' });
                }

                let initialCorrectIdx = 0;
                if (Array.isArray(question.options)) {
                    const ci = question.options.findIndex(o => !!o.is_correct);
                    if (ci >= 0) initialCorrectIdx = ci;
                    else if (typeof question.correctAnswerIndex === 'number') initialCorrectIdx = question.correctAnswerIndex;
                }

                const resolveAnswer = (a) => {
                    if (typeof a === 'boolean') return a ? 'True' : 'False';
                    if (typeof a === 'string') {
                        if (a.toLowerCase() === 'true') return 'True';
                        if (a.toLowerCase() === 'false') return 'False';
                        return a;
                    }
                    return '';
                };

                this.editingQuestion = {
                    id: question.id,
                    text: question.text || '',
                    question_type_id: resolvedType,
                    program_id: question.program_id || '',
                    course_id: question.course_id ?? (courseGroup?.course_id ?? ''),
                    learning_outcome_id: question.learning_outcome_id != null
                        ? Number(question.learning_outcome_id)
                        : (question.learning_outcome != null ? Number(question.learning_outcome) : null),
                    loTag: '',
                    cognitiveLevel: question.cognitive_level || question.cognitiveLevel || 'Remembering',
                    status: this.formatStatus(question.status),
                    remarks: question.remarks || '',
                    points: question.points || 1,
                    options: initialOptions,
                    correctAnswerIndex: initialCorrectIdx,
                    answer: resolveAnswer(question.answer),
                    correctAnswer: resolveAnswer(question.answer),
                    answers: question.answers ? [...question.answers] : [],
                    pairs: question.pairs ? question.pairs.map(p => ({ ...p })) : []
                };

                if (this.editingQuestion.question_type_id === 'Matching Type' && !this.editingQuestion.pairs.length)
                    this.editingQuestion.pairs = [{ prompt: '', answer: '' }];

                // Resolve course_id from string code → numeric ID
                if (typeof this.editingQuestion.course_id === 'string' && this.courseIdOptions.length) {
                    const match = this.courseIdOptions.find(opt => opt.label.toLowerCase() === this.editingQuestion.course_id.toLowerCase());
                    if (match) this.editingQuestion.course_id = match.value;
                }

                // Derive program_id from course if absent
                if (!this.editingQuestion.program_id && this.coursesById[this.editingQuestion.course_id]) {
                    const prog = this.coursesById[this.editingQuestion.course_id].program;
                    const pid = (prog && typeof prog === 'object') ? prog.id : (this.coursesById[this.editingQuestion.course_id].program_id || null);
                    this.editingQuestion.program_id = pid || '';
                }

                this.updateLearningOutcomeOptions();

                // Show modal immediately, then fetch full choices in background
                if (this.questionBsModal) this.questionBsModal.show();
                this._editingQuestionId = question.id;
                this.fetchQuestionDetails(question.id, courseGroup);

            } else {
                this._editingQuestionId = null;
                this.editingQuestion = this.getNewQuestionTemplate();
                this.updateLearningOutcomeOptions();
                if (this.questionBsModal) this.questionBsModal.show();
            }
        },

        // ─── fetchQuestionDetails: robust, never clears existing choices ──────
        async fetchQuestionDetails(questionId, courseGroup = null) {
            this.loadingChoices = true;
            try {
                const res = await api.get(`/questions/${questionId}`);

                // Discard result if the user has already opened a different question
                if (this._editingQuestionId !== questionId) return;

                const d = res?.data?.data || res?.data || {};

                // Resolve type — prefer detail API, fall back to already-resolved string
                const type = (d.question_type || d.question_type_id)
                    ? this.formatQuestionType(d)
                    : this.editingQuestion.question_type_id;

                // ── Multiple Choice ─────────────────────────────────────────
                if (type === 'Multiple Choice') {
                    const opts = this._extractOptions(d);
                    if (opts && opts.length) {
                        // Determine correct index
                        let correctIdx = opts.findIndex(o => o.is_correct);
                        if (correctIdx < 0 && typeof d.correct_index === 'number') correctIdx = d.correct_index;
                        if (correctIdx < 0) {
                            const correctText = (d.correct_answer || d.answer || '').toString().trim().toLowerCase();
                            if (correctText) correctIdx = opts.findIndex(o => (o.text || '').toLowerCase() === correctText);
                        }
                        if (correctIdx < 0) correctIdx = this.editingQuestion.correctAnswerIndex ?? 0;

                        // Replace options — full array replacement triggers Vue reactivity
                        this.editingQuestion.options = opts.map(o => ({ text: o.text }));
                        this.editingQuestion.correctAnswerIndex = correctIdx;

                        // Sync preview in courseList as well
                        if (courseGroup && Array.isArray(courseGroup.questions)) {
                            const i = courseGroup.questions.findIndex(q => q.id === questionId);
                            if (i >= 0) {
                                courseGroup.questions.splice(i, 1, {
                                    ...courseGroup.questions[i],
                                    options: this.editingQuestion.options,
                                    correctAnswerIndex: correctIdx
                                });
                            }
                        }
                    }
                    // If API returned nothing useful, keep the placeholder blank slots already shown
                }

                // ── True or False ───────────────────────────────────────────
                if (type === 'True or False') {
                    const tf = d.correct_answer !== undefined ? d.correct_answer : d.answer;
                    if (tf !== undefined && tf !== null && tf !== '') {
                        this.editingQuestion.answer = (tf === true || tf === 1 || tf === 'true' || tf === '1') ? 'True' : 'False';
                    }
                }

                // ── Identification ──────────────────────────────────────────
                if (type === 'Identification') {
                    const ans = d.correct_answer || d.answer || '';
                    if (ans) this.editingQuestion.answer = ans;
                }

                // ── Enumeration ─────────────────────────────────────────────
                if (type === 'Enumeration') {
                    const arr = d.answers || d.answer || [];
                    if (Array.isArray(arr) && arr.length) this.editingQuestion.answers = arr;
                }

                // ── Matching Type ───────────────────────────────────────────
                if (type === 'Matching Type') {
                    const pairs = d.pairs || d.matching_pairs || [];
                    if (Array.isArray(pairs) && pairs.length) {
                        this.editingQuestion.pairs = pairs.map(p => ({ prompt: p.prompt || p.left || '', answer: p.answer || p.right || '' }));
                    }
                }

                // ── Learning Outcome ────────────────────────────────────────
                if (d.learning_outcome_id != null) {
                    this.editingQuestion.learning_outcome_id = Number(d.learning_outcome_id);
                }

            } catch (e) {
                if (this._editingQuestionId === questionId) {
                    this.showToast('Error', 'Failed to fetch question answers.', 'error');
                }
            } finally {
                if (this._editingQuestionId === questionId) this.loadingChoices = false;
            }
        },

        async saveQuestion() {
            if (!this.editingQuestion.text) { this.showToast('Error', 'Question text is required.', 'error'); return; }
            const typeName = this.editingQuestion.question_type_id;
            const questionTypeMap = { 'True or False': 1, 'Multiple Choice': 2, 'Matching Type': 3, 'Identification': 4, 'Enumeration': 5 };
            const cognitiveMap = { 'Remembering': 1, 'Understanding': 2, 'Applying': 3, 'Analyzing': 4, 'Evaluating': 5, 'Creating': 6 };
            const statusMap = { 'Draft': 'draft', 'Pending Validation': 'pending_validation', 'Pending Approval': 'pending_approval', 'Approved': 'active', 'Rejected': 'archived' };
            const payload = {
                text: this.editingQuestion.text,
                status: statusMap[this.editingQuestion.status] || 'draft',
                remarks: this.editingQuestion.remarks || '',
                question_type_id: questionTypeMap[typeName] || 2,
                course_id: Number(this.editingQuestion.course_id) || null,
                learning_outcome_id: Number(this.editingQuestion.learning_outcome_id) || null,
                cognitive_level_id: cognitiveMap[this.editingQuestion.cognitiveLevel] || 1
            };
            if (payload.question_type_id === 1) {
                const val = (this.editingQuestion.correctAnswer || this.editingQuestion.answer || '').toString().toLowerCase();
                payload.correct_answer = val === 'true' || val === '1';
            }
            if (payload.question_type_id === 2) {
                const options = Array.isArray(this.editingQuestion.options) ? this.editingQuestion.options : [];
                const selectedIdx = Number(this.editingQuestion.correctAnswerIndex);
                const trimmed = options.map((opt, i) => ({ option_text: (opt?.text || '').trim(), option_order: i + 1, is_correct: i === (isNaN(selectedIdx) ? 0 : selectedIdx) })).filter(o => o.option_text.length > 0);
                if (trimmed.length < 2) { this.showToast('Error', 'Provide at least two non-empty options.', 'error'); return; }
                if (trimmed.filter(o => o.is_correct).length !== 1) { this.showToast('Error', 'Select exactly one correct option.', 'error'); return; }
                payload.answers = trimmed;
            }
            try {
                const isEdit = !!(this.editingQuestion.id);
                const res = isEdit
                    ? await api.put(`/questions/${this.editingQuestion.id}`, payload)
                    : await api.post('/questions', payload);
                const returned = res?.data?.question || res?.data?.data || {};
                const courseObj = this.coursesById[this.editingQuestion.course_id] || {};
                let optionsUi = Array.isArray(this.editingQuestion.options) ? this.editingQuestion.options : [];
                let correctIdxUi = typeof this.editingQuestion.correctAnswerIndex === 'number' ? this.editingQuestion.correctAnswerIndex : 0;
                const mcAnswers = returned.multiple_choice_answers || [];
                if (Array.isArray(mcAnswers) && mcAnswers.length) {
                    const sorted = [...mcAnswers].sort((a, b) => (a.option_order || 0) - (b.option_order || 0));
                    optionsUi = sorted.map(a => ({ text: a.option_text || '' }));
                    const ci = sorted.findIndex(a => !!a.is_correct);
                    correctIdxUi = ci >= 0 ? ci : 0;
                }
                const uiItem = {
                    id: returned.id ?? this.editingQuestion.id ?? Date.now(),
                    text: payload.text, question_type_id: typeName,
                    program: this.programOptions.find(p => p.value === this.editingQuestion.program_id)?.label || '',
                    course_id: this.editingQuestion.course_id,
                    course_name: courseObj.name || courseObj.course_name || '',
                    course_code: courseObj.code || '',
                    loTag: this.learningOutcomeOptions.find(o => o.value === payload.learning_outcome_id)?.label || '',
                    cognitiveLevel: this.editingQuestion.cognitiveLevel,
                    status: this.editingQuestion.status, remarks: this.editingQuestion.remarks,
                    options: optionsUi, correctAnswerIndex: correctIdxUi,
                    answer: this.editingQuestion.correctAnswer || this.editingQuestion.answer,
                    answers: this.editingQuestion.answers, pairs: this.editingQuestion.pairs
                };
                if (isEdit) { this.updateQuestion(uiItem); this.showToast('Success', 'Question updated in database.', 'success'); }
                else { this.addQuestion(uiItem); this.showToast('Success', 'Question added to database.', 'success'); }
                const groupIdx = this.courseList.findIndex(g => Number(g.course_id) === Number(this.editingQuestion.course_id));
                const ugq = { ...uiItem, question_type: typeName, course: courseObj.name || '', learning_outcome: uiItem.loTag, cognitive_level: this.editingQuestion.cognitiveLevel, creator: this.currentUser?.fullname || null };
                if (isEdit) {
                    if (groupIdx >= 0) {
                        const qIdx = this.courseList[groupIdx].questions.findIndex(q => Number(q.id) === Number(uiItem.id));
                        if (qIdx >= 0) this.courseList[groupIdx].questions.splice(qIdx, 1, ugq);
                        else this.courseList[groupIdx].questions.push(ugq);
                    }
                } else {
                    if (groupIdx >= 0) this.courseList[groupIdx].questions.push(ugq);
                    else this.courseList.push({ course_id: this.editingQuestion.course_id, course_name: courseObj.name || courseObj.code || String(this.editingQuestion.course_id), questions: [ugq] });
                }
                if (this.questionBsModal) this.questionBsModal.hide();
            } catch (err) {
                this.showToast('Error', err?.response?.data?.message || err?.message || 'Failed to save question.', 'error');
            }
        },

        openDeleteConfirmation(q) { this.questionToDelete = q; if (this.deleteBsModal) this.deleteBsModal.show(); },

        async confirmDeleteQuestion() {
            const q = this.questionToDelete;
            if (!q) { this.deleteBsModal?.hide(); return; }
            let ok = true;
            try { await api.delete(`/questions/${q.id}`); } catch (e) { ok = false; }
            this.deleteQuestion(q.id);
            for (let i = 0; i < this.courseList.length; i++) {
                const idx = this.courseList[i].questions?.findIndex(x => x.id === q.id) ?? -1;
                if (idx >= 0) { this.courseList[i].questions.splice(idx, 1); if (!this.courseList[i].questions.length) this.courseList.splice(i, 1); break; }
            }
            this.deleteBsModal?.hide();
            this.showToast(ok ? 'Success' : 'Warning', ok ? 'Question deleted.' : 'Deleted locally. Failed to delete in database.', ok ? 'success' : 'warning');
        },

        async handleUpdateStatus(question, status) {
            const candidates = this.getDbStatusCandidates(status);
            let ok = false, lastErr = null;
            for (const s of candidates) { try { await api.put(`/questions/${question.id}`, { status: s }); ok = true; break; } catch (e) { lastErr = e; } }
            this.updateStatus(question.id, status);
            for (let i = 0; i < this.courseList.length; i++) {
                const idx = this.courseList[i].questions?.findIndex(x => x.id === question.id) ?? -1;
                if (idx >= 0) { this.courseList[i].questions.splice(idx, 1, { ...this.courseList[i].questions[idx], status }); break; }
            }
            if (ok) this.showToast('Success', `Question status updated to ${status}.`, 'success');
            else this.showToast('Warning', `Updated locally. ${lastErr?.response?.data?.message || lastErr?.message || 'Failed to update status in database.'}`, 'warning');
        },

        openSubmitAllConfirmation() { if (this.submitAllBsModal) this.submitAllBsModal.show(); },

        getQuestionIdsByStatus(uiStatus) {
            const ids = [];
            (this.courseList || []).forEach(group => (group.questions || []).forEach(q => { if (this.formatStatus(q.status) === uiStatus) ids.push(q.id); }));
            return ids;
        },

        async bulkApiUpdate(ids, dbStatus) {
            const results = await Promise.allSettled(ids.map(id => api.put(`/questions/${id}`, { status: dbStatus })));
            return { total: ids.length, failed: results.filter(r => r.status === 'rejected').length };
        },

        async handleSubmitAll() {
            if (this.submitAllBsModal) this.submitAllBsModal.hide();
            const ids = this.getQuestionIdsByStatus('Draft'); if (!ids.length) return;
            const { failed } = await this.bulkApiUpdate(ids, 'pending_validation');
            this.batchUpdateStatus('Draft', 'Pending Validation');
            this.courseList.forEach(g => g.questions.forEach(q => { if (this.canonicalStatus(q.status) === 'Draft') q.status = 'pending_validation'; }));
            this.showToast(failed === 0 ? 'Success' : 'Warning', failed === 0 ? `${ids.length} draft(s) submitted for validation.` : `${ids.length - failed} submitted. ${failed} failed.`, failed === 0 ? 'success' : 'warning');
        },

        async handleValidateAll() {
            if (this.validateAllBsModal) this.validateAllBsModal.hide();
            const ids = this.getQuestionIdsByStatus('Pending Validation'); if (!ids.length) return;
            const { failed } = await this.bulkApiUpdate(ids, 'pending_approval');
            this.batchUpdateStatus('Pending Validation', 'Pending Approval');
            this.courseList.forEach(g => g.questions.forEach(q => { if (this.canonicalStatus(q.status) === 'Pending Validation') q.status = 'pending_approval'; }));
            this.showToast(failed === 0 ? 'Success' : 'Warning', failed === 0 ? `${ids.length} question(s) validated.` : `${ids.length - failed} validated. ${failed} failed.`, failed === 0 ? 'success' : 'warning');
        },

        async handleInvalidateAll() {
            if (this.rejectAllBsModal) this.rejectAllBsModal.hide();
            const ids = this.getQuestionIdsByStatus('Pending Validation'); if (!ids.length) return;
            const { failed } = await this.bulkApiUpdate(ids, 'draft');
            this.batchUpdateStatus('Pending Validation', 'Draft');
            this.courseList.forEach(g => g.questions.forEach(q => { if (this.canonicalStatus(q.status) === 'Pending Validation') q.status = 'draft'; }));
            this.showToast(failed === 0 ? 'Success' : 'Warning', failed === 0 ? `${ids.length} question(s) returned to draft.` : `${ids.length - failed} updated. ${failed} failed.`, failed === 0 ? 'success' : 'warning');
        },

        async handleApproveAll() {
            if (this.approveAllBsModal) this.approveAllBsModal.hide();
            const ids = this.getQuestionIdsByStatus('Pending Approval'); if (!ids.length) return;
            const { failed } = await this.bulkApiUpdate(ids, 'active');
            this.batchUpdateStatus('Pending Approval', 'Approved');
            this.courseList.forEach(g => g.questions.forEach(q => { if (this.canonicalStatus(q.status) === 'Pending Approval') q.status = 'active'; }));
            this.showToast(failed === 0 ? 'Success' : 'Warning', failed === 0 ? `${ids.length} question(s) approved.` : `${ids.length - failed} approved. ${failed} failed.`, failed === 0 ? 'success' : 'warning');
        },

        async handleDisapproveAll() {
            if (this.rejectAllApprovalBsModal) this.rejectAllApprovalBsModal.hide();
            const ids = this.getQuestionIdsByStatus('Pending Approval'); if (!ids.length) return;
            const { failed } = await this.bulkApiUpdate(ids, 'draft');
            this.batchUpdateStatus('Pending Approval', 'Draft');
            this.courseList.forEach(g => g.questions.forEach(q => { if (this.canonicalStatus(q.status) === 'Pending Approval') q.status = 'draft'; }));
            this.showToast(failed === 0 ? 'Success' : 'Warning', failed === 0 ? `${ids.length} question(s) returned to draft.` : `${ids.length - failed} updated. ${failed} failed.`, failed === 0 ? 'success' : 'warning');
        },

        openDeleteAllConfirmation() { if (this.deleteAllBsModal) this.deleteAllBsModal.show(); },

        async handleDeleteAll() {
            if (this.deleteAllBsModal) this.deleteAllBsModal.hide();
            const ids = this.getQuestionIdsByStatus('Draft'); if (!ids.length) return;
            const results = await Promise.allSettled(ids.map(id => api.delete(`/questions/${id}`)));
            const failed = results.filter(r => r.status === 'rejected').length;
            this.courseList.forEach(g => { g.questions = Array.isArray(g.questions) ? g.questions.filter(q => this.canonicalStatus(q.status) !== 'Draft') : []; });
            this.courseList = this.courseList.filter(g => g.questions.length > 0);
            this.clearAll('Draft');
            this.showToast(failed === 0 ? 'Success' : 'Warning', failed === 0 ? `${ids.length} draft question(s) deleted.` : `${ids.length - failed} deleted. ${failed} failed.`, failed === 0 ? 'success' : 'warning');
        },

        openBulkUploadModal() {
            this.uploadStatusMessage = '';
            if (this.bulkUploadBsModal) { this.bulkUploadBsModal.show(); this.$nextTick(() => { if (this.$refs.csvFileInput) this.$refs.csvFileInput.value = ''; }); }
        },

        handleBulkUpload() {
            const fileInput = this.$refs.csvFileInput;
            if (!fileInput) { this.showToast('Error', 'File input not found.', 'error'); return; }
            const file = fileInput.files[0];
            if (!file) { this.showToast('Error', 'Please select a CSV file.', 'error'); return; }
            if (!file.name.endsWith('.csv') && file.type !== 'text/csv') { this.showToast('Error', 'Please select a valid CSV file.', 'error'); return; }
            this.uploadStatusMessage = 'Reading file...';
            const reader = new FileReader();
            reader.onload = async (e) => { await this.parseCSV(e.target.result); };
            reader.onerror = () => { this.showToast('Error', 'Failed to read CSV file.', 'error'); this.uploadStatusMessage = ''; };
            reader.onabort = () => { this.uploadStatusMessage = ''; };
            try { reader.readAsText(file); } catch (err) { this.showToast('Error', 'Could not read file: ' + err.message, 'error'); this.uploadStatusMessage = ''; }
        },

        async fetchQuestions() {
            try {
                const { data } = await api.get('/questions');
                const groups = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
                this.courseList = groups || [];
                this.clearAll();
                (this.courseList || []).forEach(group => {
                    const cid = Number(group.course_id);
                    const courseObj = this.coursesById[cid] || {};
                    const courseCode = courseObj.code || group.course_name || '';
                    const progIdRaw = (courseObj.program && typeof courseObj.program === 'object') ? courseObj.program.id : (courseObj.program_id || null);
                    const progId = progIdRaw != null ? Number(progIdRaw) : null;
                    const progLabel = progId ? (this.programOptions.find(p => p.value === progId)?.label || '') : '';
                    (group.questions || []).forEach(q => {
                        const uiStatus = this.canonicalStatus(q.status);
                        const loRaw = q.learning_outcome || '';
                        const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';
                        this.addQuestion({ id: q.id, text: q.text || '', status: uiStatus, program: progLabel, course: courseCode, type: this.formatQuestionType(q), loTags: loNorm ? [loNorm] : [], cognitiveLevel: q.cognitive_level || 'Remembering' });
                    });
                });
                if (!this.courseList || !this.courseList.length) {
                    this.showToast('Warning', 'No questions retrieved from the database.', 'warning');
                } else {
                    this.showToast('Success', 'Questions fetched successfully.', 'success');
                    if (this.connectionLost || !this.isOnline) { this.showToast('Success', 'Reconnected to the database.', 'success'); this.connectionLost = false; }
                }
            } catch (err) {
                const offline = (typeof navigator !== 'undefined' && !navigator.onLine) || !err?.response;
                this.connectionLost = this.connectionLost || offline;
                this.showToast('Error', offline ? 'No connection. Cannot reach the database.' : 'Failed to fetch questions.', 'error');
            }
        },

        async parseCSV(text) {
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) { this.showToast('Error', 'CSV file is empty or has no data rows.', 'error'); this.uploadStatusMessage = ''; return; }

            const headerCells = this.parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim().toLowerCase());
            const idxOf = (names) => { const arr = Array.isArray(names) ? names : [names]; for (const n of arr) { const i = headerCells.indexOf(n.toLowerCase()); if (i >= 0) return i; } return -1; };

            const idxProgram = idxOf(['program']), idxCourse = idxOf(['course']), idxType = idxOf(['type', 'question type']);
            const idxLoTag = idxOf(['lo tag', 'learning outcome']), idxText = idxOf(['question text', 'text']), idxPoints = idxOf(['points']);
            const idxOptA = idxOf(['option a']), idxOptB = idxOf(['option b']), idxOptC = idxOf(['option c']), idxOptD = idxOf(['option d']);
            const idxAnswer = idxOf(['correct answer', 'answer']), idxCognitive = idxOf(['cognitive level', 'co level']);

            const questionTypeMap = { 'true or false': 1, 'multiple choice': 2, 'matching type': 3, 'identification': 4, 'enumeration': 5 };
            const cognitiveMap = { 'remembering': 1, 'understanding': 2, 'applying': 3, 'analyzing': 4, 'evaluating': 5, 'creating': 6 };
            const cognitiveLabelMap = { 'remembering': 'Remembering', 'understanding': 'Understanding', 'applying': 'Applying', 'analyzing': 'Analyzing', 'evaluating': 'Evaluating', 'creating': 'Creating' };

            // Normalize LO codes by stripping spaces for comparison: "LO2" == "LO 2"
            const normLO   = (s) => (s || '').toString().trim().replace(/^(?:CLO|LO)[\s-]?/i, 'LO').toUpperCase();
            const normCode = (s) => (s || '').toString().replace(/\s+/g, '').toUpperCase();

            const dataRows = lines.slice(1);
            let importedCount = 0, failedCount = 0, skippedCount = 0;
            this.uploadStatusMessage = `Uploading 0 of ${dataRows.length}...`;

            for (let index = 0; index < dataRows.length; index++) {
                const columns = this.parseCSVLine(dataRows[index]);
                const get = (idx) => (idx >= 0 && idx < columns.length) ? (columns[idx] || '').trim() : '';

                const programLabel = get(idxProgram), courseCode = get(idxCourse), typeRaw = get(idxType);
                const loTagRaw = get(idxLoTag), questionText = get(idxText), pointsRaw = get(idxPoints);
                const optionA = get(idxOptA), optionB = get(idxOptB), optionC = get(idxOptC), optionD = get(idxOptD);
                const correctRaw = get(idxAnswer), cogLevelRaw = get(idxCognitive);

                if (!questionText) { skippedCount++; continue; }

                const typeNorm = typeRaw.toLowerCase();
                let typeStr = 'multiple choice';
                if (typeNorm.includes('true') || typeNorm.includes('false')) typeStr = 'true or false';
                else if (typeNorm.includes('identification')) typeStr = 'identification';
                else if (typeNorm.includes('matching')) typeStr = 'matching type';
                else if (typeNorm.includes('enumeration')) typeStr = 'enumeration';
                else if (typeNorm.includes('multiple')) typeStr = 'multiple choice';

                const courseMatches = this.courseIdOptions.filter(opt => opt.label.toLowerCase() === courseCode.toLowerCase());
                let courseId = courseMatches[0]?.value || null;
                if (courseMatches.length > 1 && programLabel) {
                    const found = courseMatches.find(opt => { const c = this.coursesById[opt.value]; const pname = (c?.program && typeof c.program === 'object') ? c.program.name : (typeof c?.program === 'string' ? c.program : ''); return pname && pname.toLowerCase().includes(programLabel.toLowerCase()); });
                    if (found) courseId = found.value;
                }
                if (!courseId) { skippedCount++; continue; }

                const loTag = normLO(loTagRaw);
                const courseObj = this.coursesById[courseId] || {};
                const allLOs = [];
                (courseObj.courseOutcomes || courseObj.course_outcomes || []).forEach(co => { (co.learningOutcomes || co.learning_outcomes || []).forEach(lo => { allLOs.push({ id: lo.id, code: lo.code || '' }); }); });
                const loMatch = allLOs.find(lo => normCode(lo.code) === normCode(loTag));
                const learningOutcomeId = loMatch?.id || allLOs[0]?.id || null;
                if (!learningOutcomeId) { skippedCount++; continue; }

                const cogNorm = (cogLevelRaw || 'Remembering').toLowerCase();
                const cogLevelLabel = cognitiveLabelMap[cogNorm] || 'Remembering';
                const payload = { text: questionText, status: 'draft', question_type_id: questionTypeMap[typeStr] || 2, course_id: courseId, learning_outcome_id: learningOutcomeId, cognitive_level_id: cognitiveMap[cogNorm] || 1, points: Number.parseInt(pointsRaw) || 1 };

                if (payload.question_type_id === 2) {
                    const options = [optionA, optionB, optionC, optionD].filter(Boolean);
                    if (options.length < 2) { skippedCount++; continue; }
                    const upper = correctRaw.toUpperCase();
                    let ci = 0;
                    if (upper === 'B' || upper === '1') ci = 1;
                    else if (upper === 'C' || upper === '2') ci = 2;
                    else if (upper === 'D' || upper === '3') ci = 3;
                    else { const m = options.findIndex(o => o.toLowerCase() === correctRaw.toLowerCase()); if (m >= 0) ci = m; }
                    payload.answers = options.map((text, i) => ({ option_text: text, option_order: i + 1, is_correct: i === ci }));
                }
                if (payload.question_type_id === 1) { const ans = (correctRaw || '').toLowerCase(); payload.correct_answer = ans === 'true' || ans === '1'; }
                if (payload.question_type_id === 4) { payload.correct_answer = correctRaw || ''; }

                try {
                    this.uploadStatusMessage = `Uploading ${index + 1} of ${dataRows.length}...`;
                    const res = await api.post('/questions', payload);
                    const returned = res?.data?.question || res?.data?.data || {};
                    const courseCodeLabel = this.courseIdOptions.find(o => Number(o.value) === Number(courseId))?.label || courseCode;
                    const uiItem = {
                        id: returned.id || Date.now() + index, text: payload.text, question_type_id: typeStr,
                        course_id: courseId, status: 'Draft', remarks: '',
                        options: Array.isArray(payload.answers) ? payload.answers.map(a => ({ text: a.option_text })) : [],
                        correctAnswerIndex: Array.isArray(payload.answers) ? payload.answers.findIndex(a => a.is_correct) : 0,
                        learning_outcome: loMatch?.code || loTag,
                        cognitive_level: cogLevelLabel
                    };
                    this.addQuestion(uiItem);
                    const groupIdx = this.courseList.findIndex(g => Number(g.course_id) === Number(courseId));
                    if (groupIdx >= 0) this.courseList[groupIdx].questions.push(uiItem);
                    else this.courseList.push({ course_id: courseId, course_name: courseCodeLabel, questions: [uiItem] });
                    importedCount++;
                } catch (e) { failedCount++; }
            }

            this.uploadStatusMessage = '';
            if (importedCount > 0) {
                let msg = `${importedCount} question(s) imported successfully.`;
                if (failedCount > 0) msg += ` ${failedCount} failed.`;
                if (skippedCount > 0) msg += ` ${skippedCount} skipped (unrecognized course/LO).`;
                this.showToast(failedCount > 0 ? 'Warning' : 'Success', msg, failedCount > 0 ? 'warning' : 'success');
                if (this.bulkUploadBsModal) this.bulkUploadBsModal.hide();
                if (this.$refs.csvFileInput) this.$refs.csvFileInput.value = '';
            } else {
                this.showToast('Error', `No questions imported. ${skippedCount} skipped, ${failedCount} failed.`, 'error');
            }
        },

        parseCSVLine(line) {
            const result = []; let current = '', inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; } }
                else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
                else { current += char; }
            }
            result.push(current.trim());
            return result;
        },

        openInvalidModal(question) { this.questionToInvalidate = question; this.invalidRemark = ''; if (this.invalidRemarkBsModal) this.invalidRemarkBsModal.show(); },

        confirmInvalidate() {
            if (!this.questionToInvalidate) { if (this.invalidRemarkBsModal) this.invalidRemarkBsModal.hide(); return; }
            const q = this.questionToInvalidate; let ok = true;
            (async () => {
                try { await api.put(`/questions/${q.id}`, { status: 'draft', remarks: this.invalidRemark || '' }); } catch (e) { ok = false; }
                this.updateStatus(q.id, 'Draft', this.invalidRemark || '');
                for (let i = 0; i < this.courseList.length; i++) { const idx = Array.isArray(this.courseList[i].questions) ? this.courseList[i].questions.findIndex(x => x.id === q.id) : -1; if (idx >= 0) { this.courseList[i].questions.splice(idx, 1, { ...this.courseList[i].questions[idx], status: 'Draft', remarks: this.invalidRemark || '' }); break; } }
                this.showToast(ok ? 'Success' : 'Warning', ok ? 'Question returned to draft with remarks.' : 'Updated locally. Failed to update in database.', ok ? 'success' : 'warning');
                if (this.invalidRemarkBsModal) this.invalidRemarkBsModal.hide();
            })();
        },

        openDisapproveModal(question) { this.questionToDisapprove = question; this.disapproveRemark = ''; if (this.disapproveRemarkBsModal) this.disapproveRemarkBsModal.show(); },

        confirmDisapprove() {
            if (!this.questionToDisapprove) { if (this.disapproveRemarkBsModal) this.disapproveRemarkBsModal.hide(); return; }
            const q = this.questionToDisapprove; let ok = true;
            (async () => {
                try { await api.put(`/questions/${q.id}`, { status: 'draft', remarks: this.disapproveRemark || '' }); } catch (e) { ok = false; }
                this.updateStatus(q.id, 'Draft', this.disapproveRemark || '');
                for (let i = 0; i < this.courseList.length; i++) { const idx = Array.isArray(this.courseList[i].questions) ? this.courseList[i].questions.findIndex(x => x.id === q.id) : -1; if (idx >= 0) { this.courseList[i].questions.splice(idx, 1, { ...this.courseList[i].questions[idx], status: 'Draft', remarks: this.disapproveRemark || '' }); break; } }
                this.showToast(ok ? 'Success' : 'Warning', ok ? 'Question returned to draft with remarks.' : 'Updated locally. Failed to update in database.', ok ? 'success' : 'warning');
                if (this.disapproveRemarkBsModal) this.disapproveRemarkBsModal.hide();
            })();
        },

        openValidateAllConfirmation() { if (this.validateAllBsModal) this.validateAllBsModal.show(); },
        openRejectAllConfirmation() { if (this.rejectAllBsModal) this.rejectAllBsModal.show(); },
        openApproveAllConfirmation() { if (this.approveAllBsModal) this.approveAllBsModal.show(); },
        openRejectAllApprovalConfirmation() { if (this.rejectAllApprovalBsModal) this.rejectAllApprovalBsModal.show(); }
    },

    mounted() {
        if (this.$refs.questionModal) this.questionBsModal = new bootstrap.Modal(this.$refs.questionModal);
        if (this.$refs.deleteConfirmationModal) this.deleteBsModal = new bootstrap.Modal(this.$refs.deleteConfirmationModal);
        if (this.$refs.bulkUploadModal) this.bulkUploadBsModal = new bootstrap.Modal(this.$refs.bulkUploadModal);
        if (this.$refs.submitAllConfirmationModal) this.submitAllBsModal = new bootstrap.Modal(this.$refs.submitAllConfirmationModal);
        if (this.$refs.deleteAllConfirmationModal) this.deleteAllBsModal = new bootstrap.Modal(this.$refs.deleteAllConfirmationModal);
        if (this.$refs.validateAllConfirmationModal) this.validateAllBsModal = new bootstrap.Modal(this.$refs.validateAllConfirmationModal);
        if (this.$refs.rejectAllConfirmationModal) this.rejectAllBsModal = new bootstrap.Modal(this.$refs.rejectAllConfirmationModal);
        if (this.$refs.approveAllConfirmationModal) this.approveAllBsModal = new bootstrap.Modal(this.$refs.approveAllConfirmationModal);
        if (this.$refs.rejectAllApprovalConfirmationModal) this.rejectAllApprovalBsModal = new bootstrap.Modal(this.$refs.rejectAllApprovalConfirmationModal);
        if (this.$refs.invalidRemarkModal) this.invalidRemarkBsModal = new bootstrap.Modal(this.$refs.invalidRemarkModal);
        if (this.$refs.disapproveRemarkModal) this.disapproveRemarkBsModal = new bootstrap.Modal(this.$refs.disapproveRemarkModal);
        if (typeof window !== 'undefined') { window.addEventListener('offline', this.handleOffline); window.addEventListener('online', this.handleOnline); }
        this.fetchCourseIdOptions();
        this.fetchQuestions();
    },

    watch: {
        'editingQuestion.course_id'(newVal) { this.updateLearningOutcomeOptions(); }
    },

    beforeUnmount() {
        [this.questionBsModal, this.deleteBsModal, this.bulkUploadBsModal, this.submitAllBsModal, this.deleteAllBsModal, this.validateAllBsModal, this.rejectAllBsModal, this.approveAllBsModal, this.rejectAllApprovalBsModal, this.invalidRemarkBsModal, this.disapproveRemarkBsModal].forEach(m => m?.dispose());
        if (typeof window !== 'undefined') { window.removeEventListener('offline', this.handleOffline); window.removeEventListener('online', this.handleOnline); }
    }
}
</script>

<style scoped>
.cursor-pointer { cursor: pointer; }
</style>