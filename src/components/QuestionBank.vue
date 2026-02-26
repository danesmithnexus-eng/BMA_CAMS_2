
<template>
    <div>
        <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap">
            <h2 class="mb-2 me-auto">Question Bank</h2>
            <div v-if="currentUser.role === 'Faculty' || currentUser.role === 'Admin'" class="d-flex flex-wrap">
                <button class="btn btn-outline-success me-2 mb-2" @click="openSubmitAllConfirmation"
                    :disabled="!hasDrafts">
                    <i class="fas fa-check-double me-2"></i>Submit All Drafts
                </button>
                <button class="btn btn-outline-danger me-2 mb-2" @click="openDeleteAllConfirmation"
                    :disabled="!hasDrafts">
                    <i class="fas fa-trash-alt me-2"></i>Delete All Drafts
                </button>
                <button class="btn btn-info me-2 mb-2" @click="openBulkUploadModal"><i
                        class="fas fa-upload me-2"></i>Bulk Upload</button>
                <button class="btn btn-primary mb-2" @click="openQuestionModal()"><i class="fas fa-plus me-2"></i>Add
                    Question</button>
            </div>
            <div v-if="(currentUser.role === 'Collecting Officer' || currentUser.role === 'Admin') && hasPendingValidation"
                class="d-flex flex-wrap">
                <button class="btn btn-outline-success me-2 mb-2" @click="openValidateAllConfirmation">
                    <i class="fas fa-check-double me-2"></i>Validate All
                </button>
                <button class="btn btn-outline-danger me-2 mb-2" @click="openRejectAllConfirmation">
                    <i class="fas fa-times-circle me-2"></i>Invalidate All
                </button>
            </div>
            <div v-if="(currentUser.role === 'Review Committee' || currentUser.role === 'Admin') && hasPendingApproval"
                class="d-flex flex-wrap">
                <button class="btn btn-outline-success me-2 mb-2" @click="openApproveAllConfirmation">
                    <i class="fas fa-check-double me-2"></i>Approve All
                </button>
                <button class="btn btn-outline-danger me-2 mb-2" @click="openRejectAllApprovalConfirmation">
                    <i class="fas fa-times-circle me-2"></i>Disapprove All
                </button>
            </div>
        </div>
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
        <div>
            <div v-if="!visibleCourseList || visibleCourseList.length === 0" class="card">
                <div class="card-body text-center text-muted p-5">
                    <span v-if="!courseList || courseList.length === 0">Your question bank is empty. Click "Add
                        Question"
                        or "Bulk
                        Upload" to begin.</span>
                    <span v-else>No questions match the current filters.</span>
                </div>
            </div>

            <div v-else>
                <!-- Outer loop: v-for over the grouped object -->
                <div v-for="course in visibleCourseList" :key="course.course_id" class="mb-5">

                    <!-- Course Header -->
                    <h4 class="mb-3 pb-2 border-bottom border-secondary text-dark cursor-pointer user-select-none d-flex align-items-center"
                        @click="toggleCourseGroup(course.course_id)">
                        <i class="fas fa-book me-2"></i>Course: {{ course.course_name }} ({{ course.questions.length }})
                        <i class="fas float-end mt-1"
                            :class="isCourseExpanded(course.course_id) ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
                    </h4>
                    <div v-if="isCourseExpanded(course.course_id)">
                        <!-- Inner loop: v-for over the questions in that group -->
                        <div v-for="question in course.questions" :key="question.id" class="card mb-3">
                            <div class="card-header d-flex justify-content-between">
                                <span>Question Preview</span>
                                <span :class="getStatusBadge(formatStatus(question.status))">{{ formatStatus(question.status) }}</span>
                            </div>
                            <div class="card-body">
                                    <p class="text-muted"><strong>Course:</strong> {{ course.course_name }} |
                                    <strong>Question Type:</strong>
                                    {{ formatQuestionType(question) }}</p>
                                <p class="text-muted small"><strong>LO:</strong> {{ question.learning_outcome ?? '' }} | <strong>Cognitive
                                        Level:</strong> {{ question.cognitive_level || '' }}</p>
                                <p class="lead"><strong>Questions:</strong> {{ question.text }}</p>
                                <p class="text-muted"><strong>Points:</strong> {{ question.points || 1 }}</p>

                                <!-- Show remarks if any -->
                                <div v-if="question.remarks && question.status === 'Draft'" class="alert alert-danger p-2 mt-3">
                                    <strong>Remarks for revision:</strong><br>
                                    <p class="mb-0 fst-italic">{{ question.remarks }}</p>
                                </div>

                                <hr>
                                <!-- Answer Details -->
                                <div v-if="isMultipleChoice(question)">
                                    <h6>Correct Answer:</h6>
                                    <p><strong>{{ getCorrectOptionText(question.options, question.correctAnswerIndex) }}</strong></p>
                                </div>
                                <div
                                    v-else-if="formatQuestionType(question) === 'True or False' || formatQuestionType(question) === 'Identification'">
                                    <h6>Correct Answer:</h6>
                                    <p><strong>{{ formatCorrectAnswer(question) }}</strong></p>
                                </div>
                                <div v-else-if="formatQuestionType(question) === 'Enumeration'">
                                    <h6>Possible Answers:</h6>
                                    <ul class="list-group">
                                        <li v-for="ans in (Array.isArray(question.answer) ? question.answer : [])" class="list-group-item">{{ ans }}</li>
                                    </ul>
                                </div>
                                <div v-else-if="formatQuestionType(question) === 'Matching Type'">
                                    <h6>Matching Pairs:</h6>
                                    <ul class="list-group">
                                        <li v-for="pair in question.pairs" class="list-group-item">{{ pair.prompt }} <i
                                                class="fas fa-long-arrow-alt-right"></i> {{ pair.answer }}</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="card-footer text-end">
                                <!-- Faculty Actions -->
                                <template
                                    v-if="(isFaculty() || isAdmin()) && formatStatus(question.status) === 'Draft'">
                                    <button class="btn btn-sm btn-success me-2"
                                        @click="handleUpdateStatus(question, 'Pending Validation')">Submit</button>
                                    <button class="btn btn-sm btn-outline-secondary me-2"
                                        @click="openQuestionModal(question, course)">Edit</button>
                                    <button class="btn btn-sm btn-outline-danger"
                                        @click="openDeleteConfirmation(question)">Delete</button>
                                </template>
                                <!-- Collecting Officer Actions -->
                                <template
                                    v-if="(isCollecting() || isAdmin()) && formatStatus(question.status) === 'Pending Validation'">
                                    <button class="btn btn-sm btn-outline-secondary me-2"
                                        @click="openQuestionModal(question, course)">Edit</button>
                                    <button class="btn btn-sm btn-danger me-2"
                                        @click="openInvalidModal(question)">Invalid</button>
                                    <button class="btn btn-sm btn-success"
                                        @click="handleUpdateStatus(question, 'Pending Approval')">Validate</button>
                                </template>
                                <!-- Review Committee Actions -->
                                <template
                                    v-if="(isReview() || isAdmin()) && formatStatus(question.status) === 'Pending Approval'">
                                    <button class="btn btn-sm btn-outline-secondary me-2"
                                        @click="openQuestionModal(question, course)">Edit</button>
                                    <button class="btn btn-sm btn-danger me-2"
                                        @click="handleUpdateStatus(question, 'Draft')">Disapprove</button>
                                    <button class="btn btn-sm btn-success"
                                        @click="handleUpdateStatus(question, 'Approved')">Approve</button>
                                </template>
                            </div>
                        </div> <!-- End of card -->
                    </div>
                    <!-- Collapsible content -->
                    <!-- End of collapsible content -->
                </div>
            </div>
        </div>

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
                            <!-- Question Type Selector -->
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Program</label>
                                    <select class="form-select" v-model.number="editingQuestion.program_id"
                                        :disabled="editingQuestion.id">
                                        <option value="">Select Program</option>
                                        <option v-for="p in programOptions" :key="p.value" :value="p.value">{{ p.label
                                        }}</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Course</label>
                                    <select class="form-select" v-model.number="editingQuestion.course_id"
                                        :disabled="editingQuestion.id">
                                        <option value="">Select Course</option>
                                        <option v-for="opt in courseIdOptions" :key="opt.value" :value="opt.value">
                                            {{ opt.label }}
                                        </option>
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Question Type</label>
                                <select class="form-select" v-model="editingQuestion.question_type_id"
                                    @change="onQuestionTypeChange">
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

                            <!-- Dynamic Answer Section -->
                            <div
                                v-if="editingQuestion.question_type_id && editingQuestion.question_type_id.toLowerCase().includes('multiple')">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6>Answer Options</h6>
                                </div>
                                <div v-for="(option, index) in editingQuestion.options" :key="index"
                                    class="input-group mb-2">
                                    <div class="input-group-text">
                                        <input class="form-check-input mt-0" type="radio" :value="index"
                                            v-model="editingQuestion.correctAnswerIndex">
                                    </div>
                                    <input type="text" class="form-control" v-model="option.text"
                                        placeholder="Option text">
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
                                    <div v-for="(ans, index) in editingQuestion.answers" :key="index"
                                        class="d-flex gap-2 mb-2">
                                        <input type="text" class="form-control"
                                            v-model="editingQuestion.answers[index]">
                                        <button class="btn btn-outline-danger"
                                            @click="editingQuestion.answers.splice(index, 1)"><i
                                                class="fas fa-trash"></i></button>
                                    </div>
                                    <button class="btn btn-sm btn-outline-primary"
                                        @click="editingQuestion.answers.push('')">+
                                        Add Answer</button>
                                </div>
                            </div>

                            <div v-if="editingQuestion.question_type_id === 'Matching Type'">
                                <div class="mb-3">
                                    <label class="form-label">Pairs</label>
                                    <div v-for="(pair, index) in editingQuestion.pairs" :key="index"
                                        class="row g-2 mb-2">
                                        <div class="col-md-5">
                                            <input type="text" class="form-control" v-model="pair.prompt"
                                                placeholder="Prompt">
                                        </div>
                                        <div class="col-md-5">
                                            <input type="text" class="form-control" v-model="pair.answer"
                                                placeholder="Match">
                                        </div>
                                        <div class="col-md-2">
                                            <button class="btn btn-outline-danger w-100"
                                                @click="editingQuestion.pairs.splice(index, 1)"><i
                                                    class="fas fa-trash"></i></button>
                                        </div>
                                    </div>
                                    <button class="btn btn-sm btn-outline-primary"
                                        @click="editingQuestion.pairs.push({ prompt: '', answer: '' })">+ Add
                                        Pair</button>
                                </div>
                            </div>

                            <hr>

                            <!-- Metadata -->
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Learning Outcome</label>
                                    <select class="form-select" v-model.number="editingQuestion.learning_outcome_id">
                                        <option value="">Select Learning Outcome</option>
                                        <option v-for="opt in learningOutcomeOptions" :key="opt.value"
                                            :value="opt.value">
                                            {{ opt.label }}
                                        </option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Cognitive Level</label>
                                    <select class="form-select" v-model="editingQuestion.cognitiveLevel">
                                        <option v-for="level in cognitiveLevels" :key="level" :value="level">{{ level }}
                                        </option>
                                    </select>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Remarks</label>
                                <textarea class="form-control" v-model="editingQuestion.remarks" rows="2"></textarea>
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
                        <div class="modal-body">
                            Are you sure you want to delete this question?
                        </div>
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
                                    CSV format: Program, Course, LO Tag, Question Type, Cognitive Level, Questions,
                                    Points, Option A, Option B, Option C, Option D, Correct Answer
                                </small>
                            </div>
                            <div v-if="uploadStatusMessage" class="mt-2 text-primary small">
                                {{ uploadStatusMessage }}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" @click="handleBulkUpload">Upload</button>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Confirmations -->
        <Teleport to="body">
            <div class="modal fade" id="submitAllConfirmationModal" tabindex="-1" ref="submitAllConfirmationModal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Submit All Drafts</h5><button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">Submit all draft questions for validation?</div>
                        <div class="modal-footer"><button type="button" class="btn btn-secondary"
                                data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-success"
                                @click="handleSubmitAll">Submit All</button></div>
                    </div>
                </div>
            </div>
        </Teleport>
        <Teleport to="body">
            <div class="modal fade" id="deleteAllConfirmationModal" tabindex="-1" ref="deleteAllConfirmationModal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Delete All Drafts</h5><button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">Are you sure you want to delete ALL draft questions?</div>
                        <div class="modal-footer"><button type="button" class="btn btn-secondary"
                                data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-danger"
                                @click="clearAll('Draft')">Delete All</button></div>
                    </div>
                </div>
            </div>
        </Teleport>
        <Teleport to="body">
            <div class="modal fade" id="validateAllConfirmationModal" tabindex="-1" ref="validateAllConfirmationModal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Validate All Pending</h5><button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">Move all pending validation questions to pending approval?</div>
                        <div class="modal-footer"><button type="button" class="btn btn-secondary"
                                data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-success"
                                @click="handleValidateAll">Validate All</button></div>
                    </div>
                </div>
            </div>
        </Teleport>
        <Teleport to="body">
            <div class="modal fade" id="rejectAllConfirmationModal" tabindex="-1" ref="rejectAllConfirmationModal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Invalidate All Pending</h5><button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">Return all pending validation questions to draft status?</div>
                        <div class="modal-footer"><button type="button" class="btn btn-secondary"
                                data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-danger"
                                @click="handleInvalidateAll">Invalidate All</button></div>
                    </div>
                </div>
            </div>
        </Teleport>
        <Teleport to="body">
            <div class="modal fade" id="approveAllConfirmationModal" tabindex="-1" ref="approveAllConfirmationModal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Approve All Pending</h5><button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">Approve all pending approval questions?</div>
                        <div class="modal-footer"><button type="button" class="btn btn-secondary"
                                data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-success"
                                @click="handleApproveAll">Approve All</button></div>
                    </div>
                </div>
            </div>
        </Teleport>
        <Teleport to="body">
            <div class="modal fade" id="rejectAllApprovalConfirmationModal" tabindex="-1"
                ref="rejectAllApprovalConfirmationModal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Disapprove All Pending</h5><button type="button" class="btn-close"
                                data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">Return all pending approval questions to draft status?</div>
                        <div class="modal-footer"><button type="button" class="btn btn-secondary"
                                data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-danger"
                                @click="handleDisapproveAll">Disapprove All</button></div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- Invalid Remark Modal -->
        <Teleport to="body">
            <div class="modal fade" id="invalidRemarkModal" tabindex="-1" ref="invalidRemarkModal">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Invalidate Question</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Remark/Reason for invalidation</label>
                                <textarea class="form-control" v-model="invalidRemark" rows="3"
                                    placeholder="Explain why this question is invalid..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" @click="confirmInvalidate">Invalidate
                                Question</button>
                        </div>
                    </div>
                </div>
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

export default {
    name: 'QuestionBank',
    data() {
        return {
            expandedCourses: {},
            editingQuestion: {},
            questionToDelete: {},
            questionToInvalidate: null,
            invalidRemark: '',
            uploadStatusMessage: '',

            // Modal Instances
            questionBsModal: null,
            deleteBsModal: null,
            bulkUploadBsModal: null,
            submitAllBsModal: null,
            deleteAllBsModal: null,
            validateAllBsModal: null,
            rejectAllBsModal: null,
            approveAllBsModal: null,
            rejectAllApprovalBsModal: null,
            invalidRemarkBsModal: null,

            // Constants
            loTags: ['LO 1.0', 'LO 1.1', 'LO 1.2', 'LO 1.3', 'LO 1.4', 'LO 1.5', 'LO 1.6', 'LO 1.7', 'LO 1.8', 'LO 1.9', 'LO 1.10', 'LO 1.11', 'LO 1.12', 'LO 1.13', 'LO 1.14', 'LO 1.15', 'LO 1.16', 'LO 1.17', 'LO 1.18', 'LO 1.19', 'LO 2.0', 'LO 2.1', 'LO 2.2', 'LO 2.3', 'LO 2.4', 'LO 2.5', 'LO 2.6', 'LO 2.7', 'LO 2.8', 'LO 2.9', 'LO 2.10', 'LO 2.11', 'LO 2.12', 'LO 2.13', 'LO 2.14', 'LO 2.15', 'LO 2.16', 'LO 2.17', 'LO 2.18', 'LO 2.19', 'LO 3.0', 'LO 3.1', 'LO 3.2', 'LO 3.3', 'LO 3.4', 'LO 3.5'],
            cognitiveLevels: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'],
            courseIdOptions: [],
            coursesById: {},
            learningOutcomeOptions: [],
            programOptions: [
                { value: 5, label: 'BSMT' },
                { value: 6, label: 'BSMarE' }
            ],
            courseList: [],
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            connectionLost: false,
            lastEmptyFetch: false
        };
    },
    computed: {
        ...mapState(useQuestionStore, ['questions', 'filters', 'filteredQuestions', 'groupedQuestions', 'hasDrafts', 'hasPendingValidation', 'hasPendingApproval']),
        ...mapState(useAuthStore, { currentUser: 'user' }),

        filteredQuestionBank() {
            return this.filteredQuestions;
        },
        groupedQuestionBank() {
            return this.groupedQuestions;
        },
        visibleCourseList() {
            const groups = Array.isArray(this.courseList) ? this.courseList : [];
            const isAdmin = this.isAdmin();
            const isCollecting = this.isCollecting();
            const isReview = this.isReview();
            const isFaculty = this.isFaculty();
            const isAssessor = this.isAssessor();
            const filterFn = (q) => {
                const s = this.formatStatus(q.status);
                if (isAdmin) return true;
                if (isCollecting) return s === 'Pending Validation';
                if (isReview) return s === 'Pending Approval';
                if (isFaculty || isAssessor) return s === 'Draft' || s === 'Approved';
                return true;
            };
            return groups.map(g => ({
                ...g,
                questions: Array.isArray(g.questions) ? g.questions.filter(filterFn) : []
            })).filter(g => g.questions.length > 0);
        },
        allPrograms() { return ['Deck Operations', 'Navigation', 'Safety', 'ICT', 'MARLAW']; },
        allCourses() { return ['Seamanship I', 'COLREGs', 'Ship Construction', 'Firefighting', 'ICT', 'MARLAW']; },
        allTypes() { return ['Multiple Choice', 'True or False', 'Identification', 'Matching Type', 'Enumeration']; },
        allStatuses() { return ['Draft', 'Pending Validation', 'Pending Approval', 'Approved', 'Rejected']; }
    },
    methods: {
        ...mapActions(useQuestionStore, ['addQuestion', 'updateQuestion', 'deleteQuestion', 'updateStatus', 'setFilters', 'resetFilters', 'batchUpdateStatus', 'clearAll']),
        ...mapActions(useUIStore, ['showToast']),

        toggleCourseGroup(course) {
            this.expandedCourses[course] = !this.expandedCourses[course];
        },
        normalizeRole() {
            return (this.currentUser?.role || '').toString().toLowerCase();
        },
        isAdmin() { const r = this.normalizeRole(); return r.includes('admin'); },
        isFaculty() { const r = this.normalizeRole(); return r.includes('faculty'); },
        isAssessor() { const r = this.normalizeRole(); return r.includes('assessor'); },
        isCollecting() { const r = this.normalizeRole(); return r.includes('collecting'); },
        isReview() { const r = this.normalizeRole(); return r.includes('review'); },
        getDbStatusCandidates(uiStatus) {
            switch (uiStatus) {
                case 'Draft': return ['draft'];
                case 'Pending Validation': return ['inactive', 'pending_validation'];
                case 'Pending Approval': return ['inactive', 'pending_approval', 'validated'];
                case 'Approved': return ['active', 'approved'];
                case 'Rejected': return ['archived', 'rejected', 'invalid'];
                default: return ['draft'];
            }
        },
        handleOffline() {
            this.isOnline = false;
            this.connectionLost = true;
            this.showToast('Error', 'No connection. Cannot reach the database.', 'error');
        },
        handleOnline() {
            this.isOnline = true;
            this.showToast('Success', 'Reconnected to the database.', 'success');
            this.connectionLost = false;
        },
        isCourseExpanded(course) {
            return !!this.expandedCourses[course];
        },
        getStatusBadge(status) {
            switch (status) {
                case 'Draft': return 'badge bg-secondary';
                case 'Pending Validation': return 'badge bg-info text-dark';
                case 'Pending Approval': return 'badge bg-primary';
                case 'Approved': return 'badge bg-success';
                case 'Rejected': return 'badge bg-danger';
                default: return 'badge bg-light text-dark';
            }
        },
        formatStatus(s) {
            const val = (s || '').toString().toLowerCase();
            if (val === 'draft') return 'Draft';
            if (val === 'active') return 'Approved';
            if (val === 'inactive') return this.isCollecting() ? 'Pending Validation' : 'Pending Approval';
            if (val === 'pending validation') return 'Pending Validation';
            if (val === 'pending approval') return 'Pending Approval';
            if (val === 'archived') return 'Rejected';
            return s || 'Draft';
        },
        canonicalStatus(s) {
            const val = (s || '').toString().toLowerCase();
            if (val === 'draft') return 'Draft';
            if (val === 'active') return 'Approved';
            if (val === 'inactive') return 'Pending Validation';
            if (val === 'pending validation') return 'Pending Validation';
            if (val === 'pending approval' || val === 'validated') return 'Pending Approval';
            if (val === 'archived' || val === 'rejected' || val === 'invalid') return 'Rejected';
            return 'Draft';
        },
        formatQuestionType(item) {
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
        },
        isMultipleChoice(item) {
            return this.formatQuestionType(item) === 'Multiple Choice';
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
        getCorrectOptionText(item, index) {
            if (Array.isArray(item)) {
                const opts = item;
                let idx = typeof index === 'number' ? index : -1;
                if (idx < 0) {
                    const found = opts.findIndex(o => !!o.is_correct);
                    idx = found >= 0 ? found : 0;
                }
                const opt = opts[idx];
                if (!opt) return '';
                return opt.option_text || opt.text || '';
            }
            const t = this.formatQuestionType(item);
            if (t !== 'Multiple Choice') return '';
            if (Array.isArray(item.options)) {
                let idx = typeof item.correctAnswerIndex === 'number' ? item.correctAnswerIndex : -1;
                if (idx < 0) {
                    const found = item.options.findIndex(o => !!o.is_correct);
                    idx = found >= 0 ? found : 0;
                }
                const o = item.options[idx];
                return o ? (o.option_text || o.text || '') : '';
            }
            const answers = item.multiple_choice_answers;
            if (Array.isArray(answers) && answers.length) {
                const sorted = [...answers].sort((a, b) => (a.option_order || 0) - (b.option_order || 0));
                const correct = sorted.find(a => !!a.is_correct);
                return correct && correct.option_text ? correct.option_text : '';
            }
            if (typeof item.correct_answer === 'string') return item.correct_answer;
            return '';
        },
        getNewQuestionTemplate(type = 'Multiple Choice') {
            const base = {
                text: '',
                question_type_id: type,
                program_id: '',
                course_id: '',
                loTag: '',
                learning_outcome_id: null,
                cognitiveLevel: 'Remembering',
                status: 'Draft',
                remarks: ''
            };
            switch (type) {
                case 'Multiple Choice':
                    return { ...base, options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }], correctAnswerIndex: 0 };
                case 'True or False':
                    return { ...base, answer: 'True' };
                case 'Identification':
                    return { ...base, answer: '' };
                case 'Enumeration':
                    return { ...base, answers: [''] };
                case 'Matching Type':
                    return { ...base, pairs: [{ prompt: '', answer: '' }] };
                default:
                    return base;
            }
        },
        onQuestionTypeChange() {
            const currentType = this.editingQuestion.question_type_id;
            const template = this.getNewQuestionTemplate(currentType);
            this.editingQuestion = {
                ...template,
                id: this.editingQuestion.id,
                text: this.editingQuestion.text,
                program_id: this.editingQuestion.program_id,
                course_id: this.editingQuestion.course_id,
                loTag: this.editingQuestion.loTag,
                cognitiveLevel: this.editingQuestion.cognitiveLevel,
                status: this.editingQuestion.status,
                remarks: this.editingQuestion.remarks
            };
        },
        async fetchCourseIdOptions() {
            try {
                const { data } = await api.get('/course', { params: { per_page: 100 } });
                const list = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.data)
                        ? data.data
                        : Array.isArray(data?.data?.data)
                            ? data.data.data
                            : [];
                const options = [];
                const byId = {};
                const programMap = new Map();
                list.forEach(c => {
                    const id = c.id;
                    const name = c.name || '';
                    const code = c.code || '';
                    const program = typeof c.program === 'string' ? c.program : (c.program?.name || '');
                    if (!code) return;
                    options.push({ value: id, label: code });
                    byId[id] = c;
                    const pidRaw = (c.program && typeof c.program === 'object') ? c.program.id : (c.program_id || null);
                    const pid = pidRaw != null ? Number(pidRaw) : null;
                    const pname = (c.program && typeof c.program === 'object') ? c.program.name : (typeof c.program === 'string' ? c.program : '');
                    if (pid && pname && !programMap.has(pid)) programMap.set(pid, pname);
                });
                this.courseIdOptions = options;
                this.coursesById = byId;
                const bsmtLabel = programMap.get(5) || 'BSMT';
                const bsmareLabel = programMap.get(6) || 'BSMarE';
                this.programOptions = [
                    { value: 5, label: bsmtLabel },
                    { value: 6, label: bsmareLabel }
                ];
                if (!options.length) {
                    this.showToast('Warning', 'No courses retrieved from the database.', 'warning');
                } else if (this.connectionLost) {
                    this.showToast('Success', 'Reconnected to the database.', 'success');
                    this.connectionLost = false;
                }
            } catch (err) {
                const offline = (typeof navigator !== 'undefined' && !navigator.onLine) || !err?.response;
                this.connectionLost = this.connectionLost || offline;
                if (offline) {
                    this.showToast('Error', 'No connection. Cannot reach the database.', 'error');
                } else {
                    this.showToast('Error', 'Failed to fetch courses.', 'error');
                }
            }
        },
        updateLearningOutcomeOptions() {
            const cid = this.editingQuestion?.course_id;
            const course = this.coursesById[cid];
            const los = [];
            if (course) {
                const outcomes = course.courseOutcomes || course.course_outcomes || [];
                outcomes.forEach(co => {
                    (co.learningOutcomes || co.learning_outcomes || []).forEach(lo => {
                        const id = lo.id;
                        const code = lo.code || '';
                        if (id && code && !los.find(x => x.value === id)) {
                            los.push({ value: id, label: code });
                        }
                    });
                });
            }
            this.learningOutcomeOptions = los;
            if (los.length && !los.find(x => x.value === this.editingQuestion.learning_outcome_id)) {
                this.editingQuestion.learning_outcome_id = los[0].value;
            }
        },
        openQuestionModal(question = null, courseGroup = null) {
            if (question) {
                // Create a deep copy of the question object without using JSON methods to preserve reactivity
                this.editingQuestion = {
                    id: question.id,
                    text: question.text || '',
                    question_type_id: this.formatQuestionType(question),
                    program_id: question.program_id || '',
                    course_id: (typeof question.course_id !== 'undefined' ? question.course_id : (courseGroup && courseGroup.course_id)) || '',
                    learning_outcome_id: typeof question.learning_outcome !== 'undefined' ? Number(question.learning_outcome) : null,
                    loTag: '',
                    cognitiveLevel: question.cognitive_level || question.cognitiveLevel || 'Remembering',
                    status: this.formatStatus(question.status),
                    remarks: question.remarks || '',
                    points: question.points || 1,
                    options: Array.isArray(question.options)
                        ? question.options.map(o => ({ text: o.option_text || o.text || '' }))
                        : [],
                    correctAnswerIndex: (() => {
                        if (Array.isArray(question.options)) {
                            const idx = question.options.findIndex(o => !!o.is_correct);
                            if (idx >= 0) return idx;
                        }
                        return typeof question.correctAnswerIndex === 'number' ? question.correctAnswerIndex : 0;
                    })(),
                    correctAnswer: (typeof question.answer === 'boolean'
                        ? (question.answer ? 'True' : 'False')
                        : (typeof question.answer === 'string'
                            ? (question.answer.toLowerCase() === 'true' ? 'True'
                                : (question.answer.toLowerCase() === 'false' ? 'False' : question.answer))
                            : '')),
                    answer: (typeof question.answer === 'boolean'
                        ? (question.answer ? 'True' : 'False')
                        : (typeof question.answer === 'string'
                            ? (question.answer.toLowerCase() === 'true' ? 'True'
                                : (question.answer.toLowerCase() === 'false' ? 'False' : question.answer))
                            : '')),
                    answers: question.answers ? [...question.answers] : [],
                    pairs: question.pairs ? [...question.pairs.map(pair => ({ ...pair }))] : []
                };

                // Ensure options exist for Multiple Choice questions
                if (this.isMultipleChoice(this.editingQuestion)) {
                    if (!this.editingQuestion.options || this.editingQuestion.options.length === 0) {
                        this.editingQuestion.options = [{ text: '' }, { text: '' }, { text: '' }, { text: '' }];
                    }
                    // Ensure we have at least 5 options
                    while (this.editingQuestion.options.length < 4) {
                        this.editingQuestion.options.push({ text: '' });
                    }
                    // Ensure answerIndex exists
                    if (this.editingQuestion.correctAnswerIndex === undefined) {
                        this.editingQuestion.correctAnswerIndex = 0;
                    }
                }
                if (this.editingQuestion.question_type_id === 'Matching Type' && !this.editingQuestion.pairs) {
                    this.editingQuestion.pairs = [{ prompt: '', answer: '' }];
                }
                this.fetchQuestionDetails(question.id, courseGroup);
            } else {
                this.editingQuestion = this.getNewQuestionTemplate();
            }
            // Map legacy course name to id if needed, then refresh LO options
            if (typeof this.editingQuestion.course_id === 'string' && this.courseIdOptions.length) {
                const match = this.courseIdOptions.find(opt => opt.label.includes(this.editingQuestion.course_id));
                if (match) this.editingQuestion.course_id = match.value;
            }
            // Derive program_id from selected course if missing
            if (!this.editingQuestion.program_id && this.coursesById[this.editingQuestion.course_id]) {
                const prog = this.coursesById[this.editingQuestion.course_id].program;
                const pid = (prog && typeof prog === 'object') ? prog.id : (this.coursesById[this.editingQuestion.course_id].program_id || null);
                this.editingQuestion.program_id = pid || '';
            }
            this.updateLearningOutcomeOptions();

            if (this.questionBsModal) this.questionBsModal.show();
        },
        async fetchQuestionDetails(questionId, courseGroup = null) {
            try {
                const res = await api.get(`/questions/${questionId}`);
                const d = res?.data?.data || res?.data || {};
                const type = this.formatQuestionType(d.question_type ? d : this.editingQuestion);
                const normalized = {};
                if (type === 'True or False') {
                    const tf = typeof d.correct_answer !== 'undefined' ? d.correct_answer : d.answer;
                    const val = (tf === true || tf === 1 || tf === 'true' || tf === '1') ? 'True' : 'False';
                    normalized.answer = val;
                } else if (type === 'Multiple Choice') {
                    const optsRaw = d.options || d.choices || d.multiple_choice_answers || [];
                    const opts = Array.isArray(optsRaw) ? optsRaw : [];
                    const options = opts.map(o => typeof o === 'string' ? { text: o } : { text: o.option_text || o.text || '' });
                    let idx = (() => {
                        const found = opts.findIndex(o => !!o.is_correct);
                        if (found >= 0) return found;
                        if (typeof d.correct_index === 'number') return d.correct_index;
                        const correct = d.correct_answer || d.answer;
                        const m = options.findIndex(o => (o.text || '').toString().trim().toLowerCase() === (correct || '').toString().trim().toLowerCase());
                        return m >= 0 ? m : 0;
                    })();
                    normalized.options = options.length ? options : [{ text: '' }, { text: '' }, { text: '' }, { text: '' }];
                    normalized.correctAnswerIndex = idx;
                } else if (type === 'Identification') {
                    const ans = d.correct_answer || d.answer || '';
                    normalized.answer = ans;
                } else if (type === 'Enumeration') {
                    const arr = d.answers || d.answer || [];
                    normalized.answer = Array.isArray(arr) ? arr : [];
                } else if (type === 'Matching Type') {
                    const pairs = d.pairs || d.matching_pairs || [];
                    normalized.pairs = Array.isArray(pairs) ? pairs.map(p => ({ prompt: p.prompt || p.left || '', answer: p.answer || p.right || '' })) : [];
                }
                if (typeof d.learning_outcome_id !== 'undefined') this.editingQuestion.learning_outcome_id = Number(d.learning_outcome_id);
                if (normalized.answer !== undefined) this.editingQuestion.answer = normalized.answer;
                if (normalized.options !== undefined) this.editingQuestion.options = normalized.options;
                if (normalized.correctAnswerIndex !== undefined) this.editingQuestion.correctAnswerIndex = normalized.correctAnswerIndex;
                if (normalized.pairs !== undefined) this.editingQuestion.pairs = normalized.pairs;
                if (courseGroup && Array.isArray(courseGroup.questions)) {
                    const i = courseGroup.questions.findIndex(q => q.id === questionId);
                    if (i >= 0) {
                        const u = { ...courseGroup.questions[i] };
                        if (normalized.answer !== undefined) u.answer = normalized.answer;
                        if (normalized.pairs !== undefined) u.pairs = normalized.pairs;
                        if (normalized.options !== undefined) u.options = normalized.options;
                        if (normalized.correctAnswerIndex !== undefined) u.correctAnswerIndex = normalized.correctAnswerIndex;
                        courseGroup.questions.splice(i, 1, u);
                    }
                }
            } catch (e) {
                this.showToast('Error', 'Failed to fetch question answers.', 'error');
            }
        },
        async saveQuestion() {
            if (!this.editingQuestion.text) {
                this.showToast('Error', 'Question text is required.', 'error');
                return;
            }
            const typeName = this.editingQuestion.question_type_id;
            const questionTypeMap = {
                'True or False': 1,
                'Multiple Choice': 2,
                'Matching Type': 3,
                'Identification': 4,
                'Enumeration': 5
            };
            const cognitiveMap = {
                'Remembering': 1,
                'Understanding': 2,
                'Applying': 3,
                'Analyzing': 4,
                'Evaluating': 5,
                'Creating': 6
            };
            const statusMap = {
                'Draft': 'draft',
                'Pending Validation': 'inactive',
                'Pending Approval': 'inactive',
                'Approved': 'active',
                'Rejected': 'inactive'
            };
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
                const trimmed = options
                    .map((opt, i) => ({
                        option_text: (opt?.text || '').trim(),
                        option_order: i + 1,
                        is_correct: i === (isNaN(selectedIdx) ? 0 : selectedIdx)
                    }))
                    .filter(o => o.option_text.length > 0);
                if (trimmed.length < 2) {
                    this.showToast('Error', 'Provide at least two non-empty options.', 'error');
                    return;
                }
                const correctCount = trimmed.filter(o => o.is_correct).length;
                if (correctCount !== 1) {
                    this.showToast('Error', 'Select exactly one correct option.', 'error');
                    return;
                }
                payload.answers = trimmed;
            }
            try {
                const isEdit = !!(this.editingQuestion.id && this.questions.find(question => question.id === this.editingQuestion.id));
                let res;
                if (isEdit) {
                    res = await api.put(`/questions/${this.editingQuestion.id}`, payload);
                } else {
                    res = await api.post('/questions', payload);
                }
                const returned = res?.data?.question || {};
                const courseObj = this.coursesById[this.editingQuestion.course_id] || {};
                const courseName = courseObj.name || courseObj.course_name || '';
                const courseCode = courseObj.code || '';
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
                    text: payload.text,
                    question_type_id: typeName,
                    program: this.programOptions.find(p => p.value === this.editingQuestion.program_id)?.label || '',
                    course_id: this.editingQuestion.course_id,
                    course_name: courseName,
                    course_code: courseCode,
                    loTag: this.learningOutcomeOptions.find(o => o.value === payload.learning_outcome_id)?.label || '',
                    cognitiveLevel: this.editingQuestion.cognitiveLevel,
                    status: this.editingQuestion.status,
                    remarks: this.editingQuestion.remarks,
                    options: optionsUi,
                    correctAnswerIndex: correctIdxUi,
                    answer: this.editingQuestion.correctAnswer || this.editingQuestion.answer,
                    answers: this.editingQuestion.answers,
                    pairs: this.editingQuestion.pairs
                };
                if (isEdit) {
                    this.updateQuestion(uiItem);
                    this.showToast('Success', 'Question updated in database.', 'success');
                } else {
                    this.addQuestion(uiItem);
                    this.showToast('Success', 'Question added to database.', 'success');
                }
                // Update grouped preview list to reflect options/correct answer
                const groupIdx = this.courseList.findIndex(g => Number(g.course_id) === Number(this.editingQuestion.course_id));
                const newGroupQuestion = {
                    id: uiItem.id,
                    text: uiItem.text,
                    status: this.editingQuestion.status,
                    remarks: this.editingQuestion.remarks || null,
                    question_type_id: 2,
                    cognitive_level_id: cognitiveMap[this.editingQuestion.cognitiveLevel] || 1,
                    question_type: 'multiple',
                    course: courseName,
                    learning_outcome: this.learningOutcomeOptions.find(o => o.value === payload.learning_outcome_id)?.label || '',
                    cognitive_level: this.editingQuestion.cognitiveLevel,
                    creator: this.currentUser?.fullname || null,
                    options: optionsUi,
                    correctAnswerIndex: correctIdxUi
                };
                if (groupIdx >= 0) {
                    this.courseList[groupIdx].questions.push(newGroupQuestion);
                } else {
                    this.courseList.push({
                        course_id: this.editingQuestion.course_id,
                        course_name: courseName || courseCode || String(this.editingQuestion.course_id),
                        questions: [newGroupQuestion]
                    });
                }
                if (this.questionBsModal) this.questionBsModal.hide();
            } catch (err) {
                const msg = err?.response?.data?.message || (err?.message || 'Failed to save question.');
                this.showToast('Error', msg, 'error');
            }
        },
        openDeleteConfirmation(q) {
            this.questionToDelete = q;
            if (this.deleteBsModal) this.deleteBsModal.show();
        },
        async confirmDeleteQuestion() {
            const q = this.questionToDelete;
            if (!q) {
                if (this.deleteBsModal) this.deleteBsModal.hide();
                return;
            }
            let ok = true;
            try {
                await api.delete(`/questions/${q.id}`);
            } catch (e) {
                ok = false;
            }
            this.deleteQuestion(q.id);
            for (let i = 0; i < this.courseList.length; i++) {
                const group = this.courseList[i];
                const idx = Array.isArray(group.questions) ? group.questions.findIndex(x => x.id === q.id) : -1;
                if (idx >= 0) {
                    group.questions.splice(idx, 1);
                    if (!group.questions.length) this.courseList.splice(i, 1);
                    break;
                }
            }
            if (this.deleteBsModal) this.deleteBsModal.hide();
            this.showToast(ok ? 'Success' : 'Warning', ok ? 'Question deleted.' : 'Deleted locally. Failed to delete in database.', ok ? 'success' : 'warning');
        },
        async handleUpdateStatus(question, status) {
            const candidates = this.getDbStatusCandidates(status);
            let ok = false;
            let lastErr = null;
            for (const s of candidates) {
                try {
                    await api.put(`/questions/${question.id}`, { status: s });
                    ok = true;
                    break;
                } catch (e) {
                    lastErr = e;
                }
            }
            this.updateStatus(question.id, status);
            for (let i = 0; i < this.courseList.length; i++) {
                const group = this.courseList[i];
                const idx = Array.isArray(group.questions) ? group.questions.findIndex(x => x.id === question.id) : -1;
                if (idx >= 0) {
                    const q = group.questions[idx];
                    group.questions.splice(idx, 1, { ...q, status });
                    break;
                }
            }
            if (ok) {
                this.showToast('Success', `Question status updated to ${status}.`, 'success');
            } else {
                const msg = lastErr?.response?.data?.message || lastErr?.message || 'Failed to update status in database.';
                this.showToast('Warning', `Updated locally. ${msg}`, 'warning');
            }
        },
        openSubmitAllConfirmation() { if (this.submitAllBsModal) this.submitAllBsModal.show(); },
        handleSubmitAll() {
            this.batchUpdateStatus('Draft', 'Pending Validation');
            if (this.submitAllBsModal) this.submitAllBsModal.hide();
            this.showToast('Success', 'All drafts submitted for validation.', 'success');
        },
        handleValidateAll() {
            this.batchUpdateStatus('Pending Validation', 'Pending Approval');
            if (this.validateAllBsModal) this.validateAllBsModal.hide();
            this.showToast('Success', 'All pending questions validated.', 'success');
        },
        handleInvalidateAll() {
            this.batchUpdateStatus('Pending Validation', 'Draft');
            if (this.rejectAllBsModal) this.rejectAllBsModal.hide();
            this.showToast('Success', 'All pending questions returned to draft.', 'success');
        },
        handleApproveAll() {
            this.batchUpdateStatus('Pending Approval', 'Approved');
            if (this.approveAllBsModal) this.approveAllBsModal.hide();
            this.showToast('Success', 'All pending questions approved.', 'success');
        },
        handleDisapproveAll() {
            this.batchUpdateStatus('Pending Approval', 'Draft');
            if (this.rejectAllApprovalBsModal) this.rejectAllApprovalBsModal.hide();
            this.showToast('Success', 'All pending questions returned to draft.', 'success');
        },
        openDeleteAllConfirmation() { if (this.deleteAllBsModal) this.deleteAllBsModal.show(); },
        openBulkUploadModal() {
            this.uploadStatusMessage = '';
            if (this.bulkUploadBsModal) {
                this.bulkUploadBsModal.show();
                // Clear file input after modal is shown (ensure DOM is ready)
                this.$nextTick(() => {
                    if (this.$refs.csvFileInput) this.$refs.csvFileInput.value = '';
                });
            }
        },
        handleBulkUpload() {
            const fileInput = this.$refs.csvFileInput;
            console.log('File input ref:', fileInput);

            if (!fileInput) {
                this.showToast('Error', 'File input not found.', 'error');
                return;
            }

            const file = fileInput.files[0];
            console.log('Selected file:', file);
            console.log('Files in input:', fileInput.files);

            if (!file) {
                this.showToast('Error', 'Please select a CSV file.', 'error');
                return;
            }

            // Check file type
            if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
                this.showToast('Error', 'Please select a valid CSV file.', 'error');
                return;
            }

            this.uploadStatusMessage = 'Reading file...';
            const reader = new FileReader();

            reader.onload = (e) => {
                const text = e.target.result;
                console.log('File read successfully, length:', text.length);
                console.log('First 200 chars:', text.substring(0, 200));
                this.parseCSV(text);
            };

            reader.onerror = (e) => {
                console.error('File read error:', e);
                this.showToast('Error', 'Failed to read CSV file.', 'error');
                this.uploadStatusMessage = '';
            };

            reader.onabort = () => {
                console.log('File read aborted');
                this.uploadStatusMessage = '';
            };

            try {
                reader.readAsText(file);
            } catch (err) {
                console.error('Error starting file read:', err);
                this.showToast('Error', 'Could not read file: ' + err.message, 'error');
                this.uploadStatusMessage = '';
            }
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
                        const typeLabel = this.formatQuestionType(q);
                        const loRaw = q.learning_outcome || '';
                        const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';
                        this.addQuestion({
                            id: q.id,
                            text: q.text || '',
                            status: uiStatus,
                            program: progLabel,
                            course: courseCode,
                            type: typeLabel,
                            loTags: loNorm ? [loNorm] : [],
                            cognitiveLevel: q.cognitive_level || 'Remembering'
                        });
                    });
                });
                if (!this.courseList || this.courseList.length === 0) {
                    this.lastEmptyFetch = true;
                    this.showToast('Warning', 'No questions retrieved from the database.', 'warning');
                } else {
                    const wasDisconnected = this.connectionLost || !this.isOnline;
                    this.lastEmptyFetch = false;
                    this.showToast('Success', 'Questions fetched successfully.', 'success');
                    if (wasDisconnected) {
                        this.showToast('Success', 'Reconnected to the database.', 'success');
                        this.connectionLost = false;
                    }
                }
            } catch (err) {
                const offline = (typeof navigator !== 'undefined' && !navigator.onLine) || !err?.response;
                this.connectionLost = this.connectionLost || offline;
                if (offline) {
                    this.showToast('Error', 'No connection. Cannot reach the database.', 'error');
                } else {
                    this.showToast('Error', 'Failed to fetch questions.', 'error');
                }
            }
        },
        parseCSV(text) {
            console.log('Parsing CSV, length:', text.length);
            const lines = text.split('\n').filter(line => line.trim());
            console.log('Total lines:', lines.length);
            console.log('First line (header):', lines[0]);

            if (lines.length < 2) {
                this.showToast('Error', 'CSV file is empty or has no data rows.', 'error');
                this.uploadStatusMessage = '';
                return;
            }

            // Skip header row and parse data
            const dataRows = lines.slice(1);
            let importedCount = 0;

            dataRows.forEach((line, index) => {
                console.log(`Parsing line ${index + 1}:`, line);
                // Parse CSV line handling quoted values
                const columns = this.parseCSVLine(line);
                console.log(`Line ${index + 1} columns:`, columns);

                if (columns.length >= 6) { // Need at least Program, Course, LO Tag, Type, Cognitive Level, Questions
                    // New CSV format: Program, Course, LO Tag, Question Type, Cognitive Level, Questions, Points, Option A, Option B, Option C, Option D, Correct Answer
                    const program = columns[0]?.trim() || '';
                    const course = columns[1]?.trim() || '';
                    // Normalize LO Tag format (e.g., "LO1.2" -> "LO 1.2")
                    let loTag = columns[2]?.trim() || '';
                    if (loTag) {
                        // Add space after "LO" if missing (e.g., LO1.0 -> LO 1.0)
                        loTag = loTag.replace(/^(LO)(\d)/i, '$1 $2');
                    }
                    const typeRaw = columns[3]?.trim() || 'Multiple Choice';
                    // Normalize type to proper format
                    let type = 'Multiple Choice';
                    if (typeRaw.toLowerCase().includes('multiple')) type = 'Multiple Choice';
                    else if (typeRaw.toLowerCase().includes('true') || typeRaw.toLowerCase().includes('false')) type = 'True or False';
                    else if (typeRaw.toLowerCase().includes('identification')) type = 'Identification';
                    else if (typeRaw.toLowerCase().includes('matching')) type = 'Matching Type';
                    else if (typeRaw.toLowerCase().includes('enumeration')) type = 'Enumeration';
                    const cognitiveLevel = columns[4]?.trim() || '';
                    const questionText = columns[5]?.trim() || '';
                    const points = parseInt(columns[6]) || 1;

                    if (!questionText) {
                        console.log(`Line ${index + 1} skipped: empty question text`);
                        return;
                    }

                    // Parse correct answer (can be A, B, C, D, E or 0, 1, 2, 3, 4)
                    let correctAnswerIndex = 0;
                    const correctRaw = columns[11]?.trim().toUpperCase();
                    if (correctRaw === 'A' || correctRaw === '0') correctAnswerIndex = 0;
                    else if (correctRaw === 'B' || correctRaw === '1') correctAnswerIndex = 1;
                    else if (correctRaw === 'C' || correctRaw === '2') correctAnswerIndex = 2;
                    else if (correctRaw === 'D' || correctRaw === '3') correctAnswerIndex = 3;
                    else if (correctRaw === 'E' || correctRaw === '4') correctAnswerIndex = 4;

                    const question = {
                        id: Date.now() + index,
                        program: program,
                        course_id: course,
                        loTag: loTag,
                        question_type_id: type,
                        cognitiveLevel: cognitiveLevel,
                        text: questionText,
                        points: points,
                        options: [
                            { text: columns[7]?.trim() || '' },
                            { text: columns[8]?.trim() || '' },
                            { text: columns[9]?.trim() || '' },
                            { text: columns[10]?.trim() || '' },
                        ],
                        correctAnswerIndex: correctAnswerIndex,
                        correctAnswer: correctRaw,
                        status: 'Draft',
                        author: this.currentUser?.fullname || 'Unknown',
                        createdAt: new Date().toISOString()
                    };

                    console.log(`Adding question ${index + 1}:`, question);
                    this.addQuestion(question);
                    importedCount++;
                    console.log(`Question ${index + 1} added. Total imported: ${importedCount}`);
                } else {
                    console.log(`Line ${index + 1} skipped: only ${columns.length} columns found, need at least 6`);
                }
            });

            if (importedCount > 0) {
                this.showToast('Success', `${importedCount} questions imported successfully.`, 'success');
                this.uploadStatusMessage = '';
                if (this.bulkUploadBsModal) this.bulkUploadBsModal.hide();
                // Clear file input
                if (this.$refs.csvFileInput) this.$refs.csvFileInput.value = '';
            } else {
                this.showToast('Error', 'No valid questions found in CSV file.', 'error');
                this.uploadStatusMessage = '';
            }
        },
        parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];

                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        },
        openInvalidModal(question) {
            this.questionToInvalidate = question;  
            this.invalidRemark = '';
            if (this.invalidRemarkBsModal) this.invalidRemarkBsModal.show();
        },
        confirmInvalidate() {
            if (!this.questionToInvalidate) {
                if (this.invalidRemarkBsModal) this.invalidRemarkBsModal.hide();
                return;
            }
            const q = this.questionToInvalidate;
            let ok = true;
            (async () => {
                try {
                    await api.put(`/questions/${q.id}`, { status: 'draft', remarks: this.invalidRemark || '' });
                } catch (e) {
                    ok = false;
                }
                this.updateStatus(q.id, 'Draft', this.invalidRemark || '');
                for (let i = 0; i < this.courseList.length; i++) {
                    const group = this.courseList[i];
                    const idx = Array.isArray(group.questions) ? group.questions.findIndex(x => x.id === q.id) : -1;
                    if (idx >= 0) {
                        const item = group.questions[idx];
                        group.questions.splice(idx, 1, { ...item, status: 'Draft', remarks: this.invalidRemark || '' });
                        break;
                    }
                }
                this.showToast(ok ? 'Success' : 'Warning', ok ? 'Question returned to draft with remarks.' : 'Updated locally. Failed to update in database.', ok ? 'success' : 'warning');
                if (this.invalidRemarkBsModal) this.invalidRemarkBsModal.hide();
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
        if (typeof window !== 'undefined') {
            window.addEventListener('offline', this.handleOffline);
            window.addEventListener('online', this.handleOnline);
        }
        this.fetchCourseIdOptions();
        this.fetchQuestions();
    },
    watch: {
        'editingQuestion.course_id'(newVal) {
            this.updateLearningOutcomeOptions();
        }
    },
    beforeUnmount() {
        if (this.questionBsModal) this.questionBsModal.dispose();
        if (this.deleteBsModal) this.deleteBsModal.dispose();
        if (this.bulkUploadBsModal) this.bulkUploadBsModal.dispose();
        if (this.submitAllBsModal) this.submitAllBsModal.dispose();
        if (this.deleteAllBsModal) this.deleteAllBsModal.dispose();
        if (this.validateAllBsModal) this.validateAllBsModal.dispose();
        if (this.rejectAllBsModal) this.rejectAllBsModal.dispose();
        if (this.approveAllBsModal) this.approveAllBsModal.dispose();
        if (this.rejectAllApprovalBsModal) this.rejectAllApprovalBsModal.dispose();
        if (this.invalidRemarkBsModal) this.invalidRemarkBsModal.dispose();
        if (typeof window !== 'undefined') {
            window.removeEventListener('offline', this.handleOffline);
            window.removeEventListener('online', this.handleOnline);
        }
    }
}
</script>

<style scoped>
.cursor-pointer {
    cursor: pointer;
}
</style>
