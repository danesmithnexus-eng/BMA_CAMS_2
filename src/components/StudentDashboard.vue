<template>
    <div>
        <h2 class="mb-4">Welcome, {{ currentUser ? currentUser.fname : 'Student' }}!</h2>
        <div class="card bg-transparent border-0 shadow-none">
            <div class="card-header bg-transparent border-0 ps-0 fw-bold fs-5">Assigned Pilot Tests</div>
            <div class="card-body px-0">
                <div v-if="assignedTests.length === 0" class="text-center text-muted p-5 bg-white rounded border">You have no tests assigned.</div>
                
                <div v-else class="row g-4">
                    <div class="col-md-6 col-lg-4" v-for="test in assignedTests" :key="test.id">
                        <div class="card h-100 shadow-sm border-0 hover-lift">
                            <div class="card-body d-flex flex-column">
                                <h5 class="card-title fw-bold text-primary mb-3">{{ test.name }}</h5>
                                <div class="mb-4">
                                    <span v-if="test.status === 'Completed'" class="badge bg-success rounded-pill px-3 py-2">
                                        <i class="fas fa-check-circle me-1"></i> {{ test.status }} ({{ test.score }}%)
                                    </span>
                                    <span v-else class="badge bg-secondary rounded-pill px-3 py-2">
                                        <i class="fas fa-clock me-1"></i> {{ test.status }}
                                    </span>
                                </div>
                                <div class="mt-auto">
                                    <button v-if="test.status === 'Not Started'" class="btn btn-primary w-100 rounded-pill" @click="startTest(test)">
                                        Start Test <i class="fas fa-arrow-right ms-1"></i>
                                    </button>
                                    <button v-else-if="test.status === 'Completed'" class="btn btn-info text-white w-100 rounded-pill" @click="viewStudentTestResult(test)">
                                        View Results <i class="fas fa-chart-bar ms-1"></i>
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
                            <h5 class="modal-title">Test Result: {{ selectedStudentResult?.name }}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" v-if="selectedStudentResult">
                            <div class="text-center mb-4">
                                <h1>{{ selectedStudentResult.score }}%</h1>
                                <p class="text-muted">Your Score</p>
                            </div>
                            <p>Detailed breakdown is not available for this test type yet.</p>
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

export default {
    name: 'StudentDashboard',
    data() {
        return {
            selectedStudentResult: null,
            studentResultBsModal: null
        };
    },
    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useTestStore, ['getAssignedTestsForStudent']),
        assignedTests() {
             if (!this.currentUser) return [];
             const assignmentId =
                (this.currentUser.student && this.currentUser.student.id) ? this.currentUser.student.id :
                (this.currentUser.student_id != null ? this.currentUser.student_id : this.currentUser.id);
             return this.getAssignedTestsForStudent(Number(assignmentId));
        }
    },
    methods: {
        ...mapActions(useTestStore, ['setActiveTest', 'fetchStudentAssignments', 'ensureTestReady']),
        
        async startTest(test) {
            const ensured = await this.ensureTestReady(test.id);
            this.setActiveTest(ensured || test);
            this.$router.push({ name: 'testTaking' });
        },
        viewStudentTestResult(test) {
            this.selectedStudentResult = test;
            if (this.studentResultBsModal) this.studentResultBsModal.show();
        }
    },
    mounted() {
        const assignmentId =
            (this.currentUser?.student?.id != null) ? this.currentUser.student.id :
            (this.currentUser?.student_id != null ? this.currentUser.student_id : this.currentUser?.id);
        if (assignmentId) this.fetchStudentAssignments(Number(assignmentId));
        console.log('assignmentId:', assignmentId)
        if (this.$refs.studentResultModal) {
            this.studentResultBsModal = new bootstrap.Modal(this.$refs.studentResultModal);
        }
    },
    watch: {
        currentUser: {
            immediate: true,
            handler(newVal) {
                if (!newVal) return;
                const assignmentId =
                    (newVal.student && newVal.student.id != null) ? newVal.student.id :
                    (newVal.student_id != null ? newVal.student_id : newVal.id);
                if (assignmentId) {
                    this.fetchStudentAssignments(Number(assignmentId));
                }
            }
        }
    },
    beforeUnmount() {
        if (this.studentResultBsModal) this.studentResultBsModal.dispose();
    }
}
</script>

<style scoped>
.hover-lift {
    transition: transform 0.2s;
}
.hover-lift:hover {
    transform: translateY(-5px);
}
</style>
