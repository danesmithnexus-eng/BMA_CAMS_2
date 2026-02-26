<template>
    <!-- Pilot Administration -->
    <div v-if="currentView === 'pilotAdmin'">
        <h2 class="mb-4">Pilot Administration</h2>
        <div class="card">
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Test Name</th>
                                <th>Status</th>
                                <th>Participants</th>
                                <th>Progress</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="!pilotTests || pilotTests.length === 0">
                                <td colspan="5" class="text-center text-muted p-5">No pilot tests created yet.</td>
                            </tr>
                            <tr v-for="test in pilotTests" :key="test.id">
                                <td>{{ test.name }}</td>
                                <td>
                                    <span class="badge" :class="{
                                        'bg-success': test.status === 'Active',
                                        'bg-warning text-dark': test.status === 'Pending Review',
                                        'bg-secondary': test.status === 'Completed'
                                    }">{{ test.status }}</span>
                                </td>
                                <td>{{ getParticipantsCount(test) }}</td>
                                <td>
                                    <div class="progress">
                                        <div class="progress-bar" :style="{ width: getProgress(test) + '%' }">{{
                                            getProgress(test) }}%</div>
                                    </div>
                                </td>
                                <td>
                                    <button
                                        v-if="test.status === 'Pending Review' && (currentUser.role === 'Admin' || currentUser.role === 'Review Committee')"
                                        class="btn btn-sm btn-success me-2"
                                        @click="handleApproveTest(test)">Approve</button>
                                    <button class="btn btn-sm btn-primary me-2" @click="handleManageTest(test)">Manage</button>
                                    <button class="btn btn-sm btn-info" @click="openAssignStudentModal(test)">Assign
                                        Users</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Manage Test View -->
    <div v-if="currentView === 'manageTest'">
        <div class="d-flex align-items-center mb-4">
            <button class="btn btn-outline-secondary me-3" @click="setView('pilotAdmin')"><i
                    class="fas fa-arrow-left"></i> Back</button>
            <h2 class="mb-0">Manage Test: {{ selectedTest?.name }}</h2>
        </div>
        <div class="card mb-4">
            <div class="card-header">Test Actions</div>
            <div class="card-body d-flex gap-2">
                <button class="btn btn-outline-primary" @click="openAd10Preview"
                    :disabled="!selectedTest?.questionIds || selectedTest.questionIds.length === 0">
                    <i class="fas fa-eye me-2"></i>Preview Exam
                </button>
                <button class="btn btn-outline-info" @click="openAd09Summary"
                    :disabled="!selectedTest?.questionIds || selectedTest.questionIds.length === 0">
                    <i class="fas fa-table me-2"></i>Preview Summary
                </button>
                <button class="btn btn-outline-secondary" @click="openAssignStudentModal(selectedTest)">
                    <i class="fas fa-users me-2"></i>Assign Users
                </button>
            </div>
        </div>
        <div class="card">
            <div class="card-header">Assigned Students</div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Student Name</th>
                                <th>Status</th>
                                <th>Score</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="assignedStudents.length === 0">
                                <td colspan="3" class="text-center text-muted p-4">No students assigned yet.</td>
                            </tr>
                            <tr v-for="student in assignedStudents" :key="student.assignmentId">
                                <td>{{ student.displayName }}</td>
                                <td>
                                    <span class="status-badge" :class="getStudentTestStatusClass(student)">
                                        {{ getStudentTestStatus(student) }}
                                    </span>
                                </td>
                                <td>{{ getStudentTestScore(student) || 'N/A' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Modals -->
    <!-- Assign Student Modal -->
    <Teleport to="body">
        <div class="modal fade" id="assignStudentModal" tabindex="-1" ref="assignStudentModal">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Assign Users to "{{ selectedTest?.name }}"</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3 border-bottom pb-3">
                            <h6 class="mb-2">Select by Role</h6>
                            <div class="d-flex gap-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" id="role-select-student"
                                        value="Student" v-model="selectedRoles"
                                        @change="toggleRoleSelection('Student')">
                                    <label class="form-check-label" for="role-select-student">All Students</label>
                                </div>
                            </div>
                        </div>

                        <h6>Available Users</h6>
                        <div class="user-selection-list" style="max-height: 300px; overflow-y: auto;">
                            <div v-if="assignableLoading" class="text-center text-muted py-3">
                                Loading students...
                            </div>
                            <div v-else-if="assignableStudents && assignableStudents.length > 0">
                                <div v-for="student in assignableStudents" :key="student.assignmentId" class="form-check">
                                    <input class="form-check-input" type="checkbox" :value="student.assignmentId"
                                        :id="'student-check-' + student.assignmentId" v-model="studentsToAssign">
                                    <label class="form-check-label" :for="'student-check-' + student.assignmentId">
                                        {{ student.displayName }} ({{ student.role || 'Student' }})
                                    </label>
                                </div>
                            </div>
                            <div v-else class="text-center text-muted py-3">
                                No available users found.
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" @click="assignStudents">Assign</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>

    <!-- Report Preview Modals -->
    <Teleport to="body">
        <div class="modal fade" id="ad10PreviewModal" tabindex="-1" ref="ad10PreviewModal">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Exam Preview</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body printable-area" id="ad10-printable">
                        <div class="text-center mb-4">
                            <h5>BALIWAG MARITIME ACADEMY, INC.</h5>
                            <p class="mb-1">Cagayan Valley Road, Sampaloc, San Rafael, Bulacan</p>
                            <h4 class="mt-3 text-uppercase fw-bold">{{ selectedTest?.name }}</h4>
                            <p class="text-muted">{{ selectedTest?.description }}</p>
                        </div>

                        <div v-for="(q, index) in selectedQuestionsForPreview" :key="q.id" class="mb-4">
                            <div class="d-flex">
                                <span class="fw-bold me-2">{{ index + 1 }}.</span>
                                <div>
                                    <p class="mb-2 fw-medium">{{ q.text }}</p>

                                    <div v-if="q.type === 'Multiple Choice'" class="ps-3">
                                        <div v-for="(opt, i) in q.options" :key="i" class="mb-1">
                                            <span class="fw-bold me-2">{{ String.fromCharCode(65 + i) }}.</span> {{
                                                opt.text }}
                                        </div>
                                    </div>

                                    <div v-else-if="q.type === 'True or False'" class="ps-3">
                                        <p>___ True ___ False</p>
                                    </div>

                                    <div v-else-if="q.type === 'Matching Type'" class="ps-3">
                                        <div class="row">
                                            <div class="col-6">
                                                <div v-for="(pair, i) in q.pairs" :key="i" class="mb-1">
                                                    {{ i + 1 }}. {{ pair.prompt }}
                                                </div>
                                            </div>
                                            <div class="col-6">
                                                <div v-for="(pair, i) in q.pairs" :key="i" class="mb-1">
                                                    {{ String.fromCharCode(65 + i) }}. {{ pair.answer }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" @click="printPreview('ad10-printable')"><i
                                class="fas fa-print me-2"></i>Print</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>

    <Teleport to="body">
        <div class="modal fade" id="ad09SummaryModal" tabindex="-1" ref="ad09SummaryModal">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Table of Specifications</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body printable-area" id="ad09-printable">
                        <div class="text-center mb-4">
                            <h5>BALIWAG MARITIME ACADEMY, INC.</h5>
                            <h4 class="mt-3 text-uppercase fw-bold">TABLE OF SPECIFICATIONS</h4>
                            <p class="text-muted">{{ selectedTest?.name }}</p>
                        </div>

                        <div class="table-responsive">
                            <table class="table table-bordered text-center align-middle">
                                <thead class="table-light">
                                    <tr>
                                        <th rowspan="2" class="align-middle">Topic / Learning Outcome</th>
                                        <th :colspan="ad09SummaryData.cognitiveLevels.length">Cognitive Level</th>
                                        <th rowspan="2" class="align-middle">Total</th>
                                        <th rowspan="2" class="align-middle">%</th>
                                    </tr>
                                    <tr>
                                        <th v-for="level in ad09SummaryData.cognitiveLevels" :key="level" class="small">
                                            {{ level }}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(data, lo) in ad09SummaryData.summary" :key="lo">
                                        <td class="text-start fw-medium">{{ lo }}</td>
                                        <td v-for="level in ad09SummaryData.cognitiveLevels" :key="level">
                                            {{ data[level] || '-' }}
                                        </td>
                                        <td class="fw-bold">{{ ad09SummaryData.rowTotals[lo] }}</td>
                                        <td>{{ ((ad09SummaryData.rowTotals[lo] / selectedQuestionsForPreview.length) *
                                            100).toFixed(1) }}%</td>
                                    </tr>
                                    <tr class="table-secondary fw-bold">
                                        <td class="text-start">TOTAL</td>
                                        <td v-for="level in ad09SummaryData.cognitiveLevels" :key="level">
                                            {{ ad09SummaryData.colTotals[level] }}
                                        </td>
                                        <td>{{ selectedQuestionsForPreview.length }}</td>
                                        <td>100%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" @click="printPreview('ad09-printable')"><i
                                class="fas fa-print me-2"></i>Print</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>

</template>

<script>
import { mapState, mapActions } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useTestStore } from '../stores/tests';
import { useQuestionStore } from '../stores/questions';
import { useUserStore } from '../stores/users'; // Assuming this exists or using AuthStore for users
import { useUIStore } from '../stores/ui';
import * as bootstrap from 'bootstrap';
import api from '../services/api';

export default {
    name: 'PilotAdmin',
    data() {
        return {
            currentView: 'pilotAdmin',
            selectedTest: null,
            studentsToAssign: [],
            assignableStudents: [],
            assignableLoading: false,
            participantsCounts: {},
            selectedRoles: [],
            // Modals
            assignStudentBsModal: null,
            ad10BsModal: null,
            ad09BsModal: null,
            // Constants
            cognitiveLevels: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'],
            loTags: ['LO 1.0', 'LO 1.1', 'LO 1.2', 'LO 1.3', 'LO 1.4', 'LO 1.5', 'LO 1.6', 'LO 1.7', 'LO 1.8', 'LO 1.9', 'LO 1.10', 'LO 1.11', 'LO 1.12', 'LO 1.13', 'LO 1.14', 'LO 1.15', 'LO 1.16', 'LO 1.17', 'LO 1.18', 'LO 1.19', 'LO 2.0', 'LO 2.1', 'LO 2.2', 'LO 2.3', 'LO 2.4', 'LO 2.5', 'LO 2.6', 'LO 2.7', 'LO 2.8', 'LO 2.9', 'LO 2.10', 'LO 2.11', 'LO 2.12', 'LO 2.13', 'LO 2.14', 'LO 2.15', 'LO 2.16', 'LO 2.17', 'LO 2.18', 'LO 2.19', 'LO 3.0', 'LO 3.1', 'LO 3.2', 'LO 3.3', 'LO 3.4', 'LO 3.5']
        };
    },
    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useTestStore, ['pilotTests', 'studentTests']),
        ...mapState(useQuestionStore, ['questions']),
        ...mapState(useUserStore, { users: 'users' }),

        availableStudents() {
            if (!this.users) return [];
            // Filter strictly for users with the 'Student' role
            return this.users
                .filter(u => {
                    const userRole = (u.role || u.roles || '').toString().toLowerCase();
                    return userRole.includes('student');
                })
                .map(u => {
                    // Find the actual student ID - check u.student.id or u.student_id
                    // NEVER fallback to u.id as it's the user_id and will cause database errors
                    const studentRecord = u.student || {};
                    const studentId = Number(studentRecord.id || u.student_id || 0);

                    return {
                        ...u,
                        assignmentId: studentId,
                        displayName: u.fullname || u.name || `${u.fname || ''} ${u.lname || ''}`.trim()
                    };
                })
                .filter(u => u.assignmentId > 0) // Ensure we only show students with valid IDs
                .sort((a, b) => a.displayName.localeCompare(b.displayName));
        },
        aassignedStudents() {
            if (!this.selectedTest) return [];

            return this.studentTests
                .filter(st => Number(st.testId) === Number(this.selectedTest.id))
                .map(st => {

                    const user = this.users?.find(u => {
                        if (!u.student || !u.student.id) return false;
                        return Number(u.student.id) === Number(st.studentId);
                    });

                    if (!user) {
                        return {
                            assignmentId: Number(st.studentId),
                            displayName: 'Unknown Student #' + st.studentId,
                            ...st
                        };
                    }

                    return {
                        ...user,
                        assignmentId: Number(user.student.id),
                        displayName:
                            user.fullname ||
                            user.name ||
                            `${user.fname || ''} ${user.lname || ''}`.trim()
                    };
                });
        },
        assignedStudents() {
            return this.aassignedStudents;
        },
        selectedQuestionsForPreview() {
            if (!this.selectedTest || !this.selectedTest.questionIds) return [];
            const ids = this.selectedTest.questionIds.map(id => Number(id));
            return this.questions.filter(q => ids.includes(Number(q.id)));
        },
        ad09SummaryData() {
            const summary = {};
            const rowTotals = {};
            const colTotals = {};

            this.loTags.forEach(lo => {
                summary[lo] = {};
                rowTotals[lo] = 0;
                this.cognitiveLevels.forEach(level => {
                    summary[lo][level] = 0;
                    if (!colTotals[level]) colTotals[level] = 0;
                });
            });

            this.selectedQuestionsForPreview.forEach(q => {
                const lo = q.loTag || q.learning_outcomes_tag || '';
                const cognitiveLevel = q.cognitiveLevel || q.cognitiveTag || '';
                if (lo && summary[lo] && summary[lo][cognitiveLevel] !== undefined) {
                    summary[lo][cognitiveLevel]++;
                    rowTotals[lo]++;
                    colTotals[cognitiveLevel]++;
                }
            });

            return { summary, rowTotals, colTotals, cognitiveLevels: this.cognitiveLevels };
        }
    },
    methods: {
        ...mapActions(useTestStore, ['approveTest', 'assignStudentsToTest', 'unassignStudentsFromTest', 'unassignStudentFromTest', 'addTest']),
        ...mapActions(useQuestionStore, ['addQuestion', 'updateQuestion']),
        ...mapActions(useUserStore, ['fetchUsers']),
        ...mapActions(useUIStore, ['showToast']),

        async fetchExams() {
            try {
                const { data } = await api.get('/exams');
                const exams = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
                exams.forEach(ex => {
                    // Confirmed by backend: 'question_id' is the primary field
                    const qidsRaw = ex.question_id || (ex.exam_questions || []).map(eq => eq.question_id || eq.id);
                    const qids = Array.isArray(qidsRaw) ? [...new Set(qidsRaw.map(Number))] : [];

                    const statusLabel = (() => {
                        const s = (ex.status || '').toString().toLowerCase();
                        if (s === 'active' || s === 'approved') return 'Active';
                        if (s === 'pending review' || s === 'pending') return 'Pending Review';
                        if (s === 'completed') return 'Completed';
                        return 'Pending Review';
                    })();

                    const test = {
                        id: ex.id,
                        name: ex.name || ex.description || `Exam ${ex.id}`,
                        description: ex.description || '',
                        // Confirmed by backend: 'terms' is the field name
                        term: ex.terms || ex.term || 'Midterm',
                        timeLimit: Number(ex.time_limit || 60),
                        questionIds: qids,
                        status: statusLabel
                    };
                    this.addTest(test);

                    // Confirmed by backend: assignments use 'student_id' as an array or via relation
                    const studentIdsRaw =
                        ex.student_id ||
                        ex.student_ids ||
                        ex.student_exam_assignments ||
                        ex.assignments ||
                        [];

                    const studentIds = Array.isArray(studentIdsRaw)
                        ? studentIdsRaw
                            .map(s => {
                                if (typeof s === 'number' || typeof s === 'string') {
                                    return Number(s);
                                }

                                if (s && typeof s === 'object') {
                                    // prefer loaded student relation
                                    if (s.student && s.student.id) {
                                        return Number(s.student.id);
                                    }

                                    // fallback only to explicit student_id fields
                                    if (s.student_id != null) {
                                        return Number(s.student_id);
                                    }

                                    if (s.studentId != null) {
                                        return Number(s.studentId);
                                    }
                                }

                                return null;
                            })
                            .filter(n => Number.isInteger(n) && n > 0)
                        : [];

                    if (studentIds.length) {
                        this.assignStudentsToTest(test.id, studentIds, test);
                    }
                });
                if (!exams || exams.length === 0) {
                    this.showToast('Warning', 'No exams found in the database.', 'warning');
                }
            } catch (err) {
                const msg = err?.response?.data?.message || err?.message || 'Failed to fetch exams.';
                this.showToast('Error', msg, 'error');
            }
        },
        async refreshParticipantsCountFor(testId) {
            try {
                const res = await api.get('/get-student', { params: { exam_id: testId } });
                const list = Array.isArray(res?.data?.data) ? res.data.data : (Array.isArray(res?.data) ? res.data : []);
                const count = (list || []).reduce((acc, it) => {
                    const assignedRaw = it?.is_assigned;
                    const assigned = assignedRaw === true || assignedRaw === 1 || assignedRaw === '1' || (typeof assignedRaw === 'string' && assignedRaw.toLowerCase() === 'true');
                    return acc + (assigned ? 1 : 0);
                }, 0);
                this.participantsCounts = { ...this.participantsCounts, [testId]: count };
            } catch (_) {
                // ignore; fallback to store-based count
            }
        },
        async refreshAllParticipantsCounts() {
            for (const t of this.pilotTests) {
                await this.refreshParticipantsCountFor(t.id);
            }
        },

        async ensureSelectedTestQuestionsLoaded() {
            try {
                if (!this.selectedTest) return;
                let examDetailsMap = new Map();
                if (!Array.isArray(this.selectedTest.questionIds) || this.selectedTest.questionIds.length === 0) {
                    let ex = null;
                    try {
                        const r1 = await api.get(`/exams/${this.selectedTest.id}`);
                        ex = r1?.data?.data || r1?.data || null;
                    } catch (_) {
                        try {
                            const r2 = await api.get(`/exam/${this.selectedTest.id}`);
                            ex = r2?.data?.data || r2?.data || null;
                        } catch (_) {}
                    }
                    if (!ex) {
                        try {
                            const resAll = await api.get('/exams');
                            const exams = Array.isArray(resAll?.data?.data) ? resAll.data.data : (Array.isArray(resAll?.data) ? resAll.data : []);
                            const match = (exams || []).find(e => {
                                const n = (e.name || e.description || '').toString().trim();
                                const m = (this.selectedTest.name || this.selectedTest.description || '').toString().trim();
                                return n && m && n === m;
                            }) || null;
                            ex = match || null;
                        } catch (_) {}
                    }
                    if (ex) {
                        const qidsRaw = ex.question_id || (ex.exam_questions || []).map(eq => eq.question_id || eq.id);
                        const qids = Array.isArray(qidsRaw) ? [...new Set(qidsRaw.map(Number))] : [];
                        const newId = Number(ex.id || this.selectedTest.id);
                        if (qids.length > 0) {
                            this.selectedTest = {
                                ...this.selectedTest,
                                id: newId,
                                name: ex.name || this.selectedTest.name || (ex.description || `Exam ${newId}`),
                                description: ex.description || this.selectedTest.description || '',
                                questionIds: qids
                            };
                            this.addTest({ id: newId, name: this.selectedTest.name, description: this.selectedTest.description, questionIds: qids });
                        }
                        if (Array.isArray(ex.exam_questions)) {
                            ex.exam_questions.forEach(eq => {
                                const qid = Number(eq.question_id || eq.id);
                                const qobj = eq.question || eq;
                                examDetailsMap.set(qid, qobj);
                            });
                        }
                    }
                }
                if (!Array.isArray(this.selectedTest.questionIds) || this.selectedTest.questionIds.length === 0) return;
                for (const qid of this.selectedTest.questionIds) {
                    const existing = this.questions.find(q => q.id === qid);
                    const needsLoad = !existing || (
                        (existing.type === 'Multiple Choice' && (!Array.isArray(existing.options) || existing.options.length === 0)) ||
                        (existing.type === 'Matching Type' && (!Array.isArray(existing.pairs) || existing.pairs.length === 0))
                    );
                    if (!needsLoad) continue;
                    try {
                        let d = null;
                        let lastErr = null;
                        const endpoints = [
                            `/questions/${qid}`,
                            `/question/${qid}`,
                            `/questions?id=${qid}`
                        ];
                        for (const ep of endpoints) {
                            try {
                                const res = await api.get(ep);
                                d = res?.data?.data || res?.data || null;
                                if (d) break;
                            } catch (e) {
                                lastErr = e;
                            }
                        }
                        if (!d) throw lastErr || new Error('No question data');
                        const typeLabel = (() => {
                            const id = d.question_type_id;
                            const str = (d.question_type || '').toString().toLowerCase();
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
                            return 'Multiple Choice';
                        })();
                        let options = [];
                        let pairs = [];
                        if (typeLabel === 'Multiple Choice') {
                            const mc = d.multiple_choice_answers || d.options || d.choices || [];
                            const sorted = Array.isArray(mc) ? [...mc].sort((a, b) => (a.option_order || 0) - (b.option_order || 0)) : [];
                            options = sorted.map(a => ({ text: a.option_text || a.text || '' }));
                        } else if (typeLabel === 'Matching Type') {
                            const mp = d.pairs || d.matching_pairs || [];
                            pairs = Array.isArray(mp) ? mp.map(p => ({ prompt: p.prompt || p.left || '', answer: p.answer || p.right || '' })) : [];
                        }
                        const loRaw = d.learning_outcome || '';
                        const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';
                        const payload = {
                            id: d.id || qid,
                            text: d.text || '',
                            status: 'Approved',
                            program: existing?.program || '',
                            course: existing?.course || '',
                            type: typeLabel,
                            loTags: loNorm ? [loNorm] : (existing?.loTags || []),
                            cognitiveLevel: d.cognitive_level || existing?.cognitiveLevel || 'Remembering',
                            options,
                            pairs
                        };
                        if (existing) this.updateQuestion(payload);
                        else this.addQuestion(payload);
                    } catch (e) {
                        const fromExam = examDetailsMap.get(Number(qid));
                        if (fromExam) {
                            const d = fromExam;
                            const typeLabel = (() => {
                                const id = d.question_type_id;
                                const str = (d.question_type || '').toString().toLowerCase();
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
                                return 'Multiple Choice';
                            })();
                            let options = [];
                            let pairs = [];
                            if (typeLabel === 'Multiple Choice') {
                                const mc = d.multiple_choice_answers || d.options || d.choices || [];
                                const sorted = Array.isArray(mc) ? [...mc].sort((a, b) => (a.option_order || 0) - (b.option_order || 0)) : [];
                                options = sorted.map(a => ({ text: a.option_text || a.text || '' }));
                            } else if (typeLabel === 'Matching Type') {
                                const mp = d.pairs || d.matching_pairs || [];
                                pairs = Array.isArray(mp) ? mp.map(p => ({ prompt: p.prompt || p.left || '', answer: p.answer || p.right || '' })) : [];
                            }
                            const loRaw = d.learning_outcome || '';
                            const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';
                            const payload = {
                                id: Number(d.id || qid),
                                text: d.text || '',
                                status: 'Approved',
                                program: existing?.program || '',
                                course: existing?.course || '',
                                type: typeLabel,
                                loTags: loNorm ? [loNorm] : (existing?.loTags || []),
                                cognitiveLevel: d.cognitive_level || existing?.cognitiveLevel || 'Remembering',
                                options,
                                pairs
                            };
                            if (existing) this.updateQuestion(payload);
                            else this.addQuestion(payload);
                        } else {
                            this.showToast('Warning', `Failed to load question #${qid} for preview.`, 'warning');
                        }
                    }
                }
            } catch (err) {
                this.showToast('Error', 'Failed to prepare questions for preview.', 'error');
            }
        },

        setView(view) {
            this.currentView = view;
            if (view === 'pilotAdmin') {
                this.selectedTest = null;
            }
        },
        toggleRoleSelection(role) {
            const usersInRole = this.assignableStudents;
            const assignmentIdsInRole = usersInRole.map(u => Number(u.assignmentId));

            if (this.selectedRoles.includes(role)) {
                assignmentIdsInRole.forEach(id => {
                    if (!this.studentsToAssign.includes(id)) {
                        this.studentsToAssign.push(id);
                    }
                });
            } else {
                this.studentsToAssign = this.studentsToAssign.filter(id => !assignmentIdsInRole.includes(id));
            }
        },
        handleApproveTest(test) {
            (async () => {
                let ok = false;
                let lastErr = null;
                const endpoints = [
                    `/exams/${test.id}`,
                    `/exam/${test.id}`,
                    `/exams/${test.id}/approve`,
                    `/exam/${test.id}/approve`
                ];
                const statuses = ['Active', 'active', 'Approved', 'approved'];
                for (const ep of endpoints) {
                    if (ep.endsWith('/approve')) {
                        try {
                            await api.post(ep);
                            ok = true;
                            break;
                        } catch (e) {
                            lastErr = e;
                        }
                    } else {
                        for (const st of statuses) {
                            try {
                                await api.put(ep, { status: st });
                                ok = true;
                                break;
                            } catch (e) {
                                lastErr = e;
                            }
                        }
                    }
                    if (ok) break;
                }
                this.approveTest(test.id);
                if (ok) {
                    this.showToast('Success', 'Test approved and is now active.', 'success');
                } else {
                    const msg = lastErr?.response?.data?.message || lastErr?.message || 'Failed to update test status in database.';
                    this.showToast('Warning', `Approved locally. ${msg}`, 'warning');
                }
            })();
        },
        async handleManageTest(test) {
            this.selectedTest = test;
            this.setView('manageTest');
            await this.ensureSelectedTestQuestionsLoaded();
            await this.openAd10Preview();
        },
        async viewSelectedQuestions(test) {
            this.selectedTest = test;
            await this.ensureSelectedTestQuestionsLoaded();
            await this.openAd10Preview();
        },
        async openAssignStudentModal(test) {
            this.selectedTest = test;
            this.selectedRoles = [];
            this.assignableLoading = true;
            try {
                await this.fetchUsers();
                let list = [];
                try {
                    const r1 = await api.get('/get-student', { params: { exam_id: test.id } });
                    list = Array.isArray(r1?.data?.data) ? r1.data.data : (Array.isArray(r1?.data) ? r1.data : []);
                } catch (_) {}
                if (!Array.isArray(list) || list.length === 0) {
                    try {
                        const r2 = await api.get(`/get-student/${test.id}`);
                        list = Array.isArray(r2?.data?.data) ? r2.data.data : (Array.isArray(r2?.data) ? r2.data : []);
                    } catch (_) {}
                }
                const mapped = (list || []).map(it => {
                    const sid = Number(
                        it.student_id != null ? it.student_id :
                        it.assignment_id != null ? it.assignment_id :
                        it.id != null ? it.id :
                        it.student && it.student.id ? it.student.id : 0
                    );
                    const name = it.fullname || it.name || `${it.fname || ''} ${it.lname || ''}`.trim();
                    const assignedRaw = it.is_assigned;
                    const assigned = assignedRaw === true || assignedRaw === 1 || assignedRaw === '1' || (typeof assignedRaw === 'string' && assignedRaw.toLowerCase() === 'true');
                    return {
                        assignmentId: sid,
                        displayName: name || `Student #${sid}`,
                        role: it.role || 'Student',
                        is_assigned: assigned
                    };
                }).filter(s => Number.isInteger(s.assignmentId) && s.assignmentId > 0)
                  .sort((a, b) => a.displayName.localeCompare(b.displayName));
                if (mapped.length === 0 && Array.isArray(this.users) && this.users.length > 0) {
                    const fallback = this.users
                        .filter(u => ((u.role || u.roles || '').toString().toLowerCase().includes('student')))
                        .map(u => {
                            const sid = Number(u?.student?.id || u?.student_id || 0);
                            const name = u.fullname || u.name || `${u.fname || ''} ${u.lname || ''}`.trim();
                            const assigned = this.studentTests.some(st => Number(st.testId) === Number(test.id) && Number(st.studentId) === sid);
                            return { assignmentId: sid, displayName: name || `Student #${sid}`, role: 'Student', is_assigned: assigned };
                        })
                        .filter(s => Number.isInteger(s.assignmentId) && s.assignmentId > 0)
                        .sort((a, b) => a.displayName.localeCompare(b.displayName));
                    this.assignableStudents = fallback;
                    this.studentsToAssign = fallback.filter(s => s.is_assigned).map(s => Number(s.assignmentId));
                } else {
                    this.assignableStudents = mapped;
                    this.studentsToAssign = mapped.filter(s => s.is_assigned).map(s => Number(s.assignmentId));
                }
                this.participantsCounts[test.id] = mapped.filter(s => s.is_assigned).length;
            } catch (e) {
                this.assignableStudents = [];
                this.studentsToAssign = [];
                const msg = e?.response?.data?.message || e?.message || 'Failed to load students.';
                this.showToast('Error', msg, 'error');
            } finally {
                this.assignableLoading = false;
            }

            await this.ensureSelectedTestQuestionsLoaded();
            if (this.ad10BsModal) this.ad10BsModal.hide();
            if (this.assignStudentBsModal) this.assignStudentBsModal.show();
        },
        assignStudents() {
            if (!this.selectedTest) {
                this.showToast('Error', 'No test selected.', 'error');
                return;
            }
            const ids = Array.isArray(this.studentsToAssign) ? [...new Set(this.studentsToAssign.map(Number))] : [];
            const prevIds = Array.isArray(this.assignableStudents)
                ? this.assignableStudents.filter(s => s.is_assigned).map(s => Number(s.assignmentId))
                : [];
            const toAssign = ids.filter(id => !prevIds.includes(id));
            const toUnassign = prevIds.filter(id => !ids.includes(id));
            if (toAssign.length === 0 && toUnassign.length === 0) {
                if (this.assignStudentBsModal) this.assignStudentBsModal.hide();
                this.showToast('Info', 'No changes to assignments.', 'info');
                return;
            }
            const body = {
                exam_id: Number(this.selectedTest.id),
                student_id: ids
            };
            // Use backend sync endpoint to update assignment statuses
            const endpoint = '/student-exam-assignments/sync';
            let ok = false;
            let lastErr = null;
            (async () => {
                try {
                    await api.put(endpoint, body);
                    ok = true;
                } catch (e) {
                    lastErr = e;
                }

                if (ok) {
                    toUnassign.forEach(id => this.unassignStudentFromTest(this.selectedTest.id, id));
                    if (toAssign.length > 0) this.assignStudentsToTest(this.selectedTest.id, toAssign, this.selectedTest);
                    if (this.assignStudentBsModal) this.assignStudentBsModal.hide();
                    this.showToast('Success', 'Assignments synced successfully.', 'success');
                    await this.refreshParticipantsCountFor(this.selectedTest.id);
                } else {
                    const msg = lastErr?.response?.data?.message || lastErr?.message || 'Failed to sync assignments.';
                    this.showToast('Error', msg, 'error');
                }
            })();
        },
        async openAd10Preview() {
            await this.ensureSelectedTestQuestionsLoaded();
            if (this.ad10BsModal) this.ad10BsModal.show();
        },
        async openAd09Summary() {
            await this.ensureSelectedTestQuestionsLoaded();
            if (!this.selectedQuestionsForPreview.length) {
                this.showToast('Error', 'No questions available to summarize for this exam.', 'error');
                return;
            }
            if (this.ad09BsModal) this.ad09BsModal.show();
        },
        printPreview(elementId) {
            // Basic print functionality
            window.print();
        },
        getParticipantsCount(test) {
            const fromApi = this.participantsCounts?.[test.id];
            if (Number.isFinite(fromApi)) return fromApi;
            return this.studentTests.filter(st => st.testId === test.id).length;
        },
        getProgress(test) {
            const assignedCount = this.getParticipantsCount(test);
            if (!assignedCount) return 0;
            const completed = this.studentTests.filter(st => st.testId === test.id && st.status === 'Completed').length;
            return Math.round((completed / assignedCount) * 100);
        },
        getStudentTestStatus(student) {
            const st = this.studentTests.find(s => s.studentId === student.assignmentId && s.testId === this.selectedTest.id);
            return st ? st.status : 'Not Assigned';
        },
        getStudentTestStatusClass(student) {
            const st = this.studentTests.find(s => s.studentId === student.assignmentId && s.testId === this.selectedTest.id);
            return st && st.status === 'Completed' ? 'badge bg-success' : 'badge bg-secondary';
        },
        getStudentTestScore(student) {
            const st = this.studentTests.find(s => s.studentId === student.assignmentId && s.testId === this.selectedTest.id);
            return st ? st.score : null;
        }
    },
    mounted() {
        this.fetchUsers();
        if (this.$refs.assignStudentModal) this.assignStudentBsModal = new bootstrap.Modal(this.$refs.assignStudentModal);
        const ad10El = this.$refs.ad10PreviewModal || document.getElementById('ad10PreviewModal');
        const ad09El = this.$refs.ad09SummaryModal || document.getElementById('ad09SummaryModal');
        if (ad10El) this.ad10BsModal = new bootstrap.Modal(ad10El);
        if (ad09El) this.ad09BsModal = new bootstrap.Modal(ad09El);
        this.fetchExams().then(() => this.refreshAllParticipantsCounts());
    },
    watch: {
        '$route.name': {
            immediate: true,
            handler(name) {
                if (name === 'pilotAdmin') {
                    this.setView('pilotAdmin');
                    this.fetchExams().then(() => this.refreshAllParticipantsCounts());
                } else if (name === 'manageTest') {
                    this.setView('manageTest');
                    if (this.selectedTest) {
                        this.ensureSelectedTestQuestionsLoaded();
                    }
                }
            }
        }
    },
    beforeUnmount() {
        if (this.assignStudentBsModal) this.assignStudentBsModal.dispose();
        if (this.ad10BsModal) this.ad10BsModal.dispose();
        if (this.ad09BsModal) this.ad09BsModal.dispose();
    }
};
</script>

<style scoped>
.status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875em;
}

/* Printable Area Styles */
@media print {
    body * {
        visibility: hidden;
    }

    .printable-area,
    .printable-area * {
        visibility: visible;
    }

    .printable-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
    }

    .modal-footer,
    .btn-close {
        display: none !important;
    }
}
</style>
