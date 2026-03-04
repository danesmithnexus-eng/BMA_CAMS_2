<template>
    <div>
        <h2 class="mb-4">Welcome, {{ currentUser ? currentUser.fname : 'Student' }}!</h2>

        <div class="card bg-transparent border-0 shadow-none">
            <div class="card-header bg-transparent border-0 ps-0 fw-bold fs-5">
                Assigned Pilot Tests
            </div>

            <div class="card-body px-0">
                <div v-if="assignedTests.length === 0" class="text-center text-muted p-5 bg-white rounded border">
                    You have no tests assigned.
                </div>

                <div v-else class="row g-4">
                    <div class="col-md-6 col-lg-4" v-for="test in assignedTests" :key="test.id">
                        <div class="card h-100 shadow-sm border-0 hover-lift">
                            <div class="card-body d-flex flex-column">
                                <h5 class="card-title fw-bold text-primary mb-3">
                                    {{ test.exam.name }}
                                </h5>

                                <div class="mb-4">
                                    <span v-if="test.status === 'completed'"
                                        class="badge bg-success rounded-pill px-3 py-2">
                                        <i class="fas fa-check-circle me-1"></i>
                                        {{ test.status }}
                                    </span>

                                    <span v-else class="badge bg-secondary rounded-pill px-3 py-2">
                                        <i class="fas fa-clock me-1"></i>
                                        {{ test.status }}
                                    </span>
                                </div>

                                <div class="mt-auto">
                                    <button v-if="test.status !== 'completed'"
                                        class="btn btn-primary w-100 rounded-pill" @click="startTest(test)">
                                        Start Test
                                        <i class="fas fa-arrow-right ms-1"></i>
                                    </button>

                                    <button v-else-if="test.status === 'completed'"
                                        class="btn btn-info text-white w-100 rounded-pill"
                                        @click="viewStudentTestResult(test)">
                                        View Results
                                        <i class="fas fa-chart-bar ms-1"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Student Result Modal -->
        <Teleport to="body">
            <div class="modal fade" id="studentResultModal" tabindex="-1" ref="studentResultModal">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                Test Result: {{ selectedStudentResult?.name }}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>

                        <div class="modal-body" v-if="selectedStudentResult">
                            <div class="text-center mb-4">
                                <h1>{{ selectedStudentResult.score }}%</h1>
                                <p class="text-muted">Your Score</p>
                            </div>

                            <div class="row text-center mb-3">
                                <div class="col-md-4 mb-3 mb-md-0">
                                    <div class="card bg-light">
                                        <div class="card-body">
                                            <div class="fw-semibold text-muted">
                                                Created By
                                            </div>
                                            <div>
                                                {{ selectedStudentResult.creatorName || 'N/A' }}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="col-md-4 mb-3 mb-md-0">
                                    <div class="card bg-light">
                                        <div class="card-body">
                                            <div class="fw-semibold text-muted">
                                                Time Spent
                                            </div>
                                            <div>
                                                {{ formatDuration(selectedStudentResult.durationSeconds) }}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="col-md-4">
                                    <div class="card bg-light">
                                        <div class="card-body">
                                            <div class="fw-semibold text-muted">
                                                Completed At
                                            </div>
                                            <div>
                                                {{ formatDateTime(selectedStudentResult.completedAt) }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p class="text-muted">
                                Detailed breakdown is not available for this test type yet.
                            </p>
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
import * as bootstrap from 'bootstrap';
import api from '../services/api';

export default {
    name: 'StudentDashboard',

    data() {
        return {
            selectedStudentResult: null,
            studentResultBsModal: null,
            assignedTests: []
        };
    },

    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useTestStore, ['getAssignedTestsForStudent']),

        /*   assignedTests() {
              if (!this.currentUser) return [];
  
              const studentId =
                  this.currentUser.student?.id ??
                  this.currentUser.student_id ??
                  this.currentUser.id;
  
              return this.getAssignedTestsForStudent(Number(studentId));
          } */
    },

    methods: {
        ...mapActions(useTestStore, [
            'setActiveTest',
            'fetchStudentAssignments',
            'ensureTestReady'
        ]),
        async startTest(test) {

            const testStore = useTestStore();

            const ensured = await testStore.ensureTestReady(test.exam_id);

            const ok = testStore.setActiveTest(ensured || test);

            if (!ok) {
                test.status = 'completed';
                return;
            }

            this.$router.push({ name: 'testTaking', params: { id: test.exam_id } });
        },

        async viewStudentTestResult(test) {
            try {
                // Determine assignment ID – adjust field name if needed (e.g., test.assignment_id)
                const assignmentId = test.id; // or test.assignment_id
                if (!assignmentId) {
                    console.error('No assignment ID found');
                    return;
                }

                // Call the backend API
                const response = await api.get(`/check-assignment/${assignmentId}`);
                const result = response.data;

                if (!result.completed) {
                    // Test not completed – maybe show a message
                    alert('This test is not yet completed.');
                    return;
                }

                // Build the object to display in the modal
                this.selectedStudentResult = {
                    // Fields from the test object (already in the component)
                    name: response.created_by || 'Untitled Test',
                    creatorName: response.data.created_by || 'N/A',
                    // The backend stores remaining_time in the time_spent column.
                    // Calculate spent time = Total Limit - Remaining Time.
                    durationSeconds: response.data.time_spent || 0,
  
                    completedAt: test.completedAt || test.completed_at || test.updated_at,

                    // Score from API (convert to percentage)
                    score: result.total > 0 ? Math.round((result.score / result.total) * 100) : 0,
                    rawScore: result.score,
                    totalQuestions: result.total,

                    // Include answers if you want to show a detailed breakdown later
                    answers: result.answers || [],
                };

                // Show the modal
                if (this.studentResultBsModal) {
                    this.studentResultBsModal.show();
                } else {
                    // Fallback if modal not initialised (should not happen)
                    this.studentResultBsModal = new bootstrap.Modal(this.$refs.studentResultModal);
                    this.studentResultBsModal.show();
                }
            } catch (error) {
                console.error('Failed to fetch test result:', error);
                alert('Could not load test results. Please try again later.');
            }
        },

        formatDuration(seconds) {
            const s = Number(seconds);
            if (!Number.isFinite(s) || s <= 0) return '—';

            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;

            if (h > 0) return `${h}h ${m}m ${sec}s`;
            if (m > 0) return `${m}m ${sec}s`;
            return `${sec}s`;
        },

        formatDateTime(iso) {
            if (!iso) return '—';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            return d.toLocaleString();
        }
    },

    async mounted() {
        const assignedTests = await api.get('/student-exam-assignments');
        this.assignedTests = assignedTests.data.questionList
        console.log(this.assignedTests);
        if (this.$refs.studentResultModal) {
            this.studentResultBsModal = new bootstrap.Modal(this.$refs.studentResultModal);
        }
    },

    /*   watch: {
          currentUser: {
              immediate: true,
              async handler(newVal) {
                  if (!newVal) return;
                  const studentId = newVal.student?.id ?? newVal.student_id ?? newVal.id;
                  if (studentId) {
                      await this.fetchStudentAssignments(Number(studentId));
                  }
              }
          }
      }, */

    beforeUnmount() {
        if (this.studentResultBsModal) {
            this.studentResultBsModal.dispose();
        }
    }
};
</script>

<style scoped>
.hover-lift {
    transition: transform 0.2s;
}

.hover-lift:hover {
    transform: translateY(-5px);
}
</style>
