<template>
    <div>
        <h2 class="mb-4 fw-bold">Dashboard</h2>
        <div class="row">
            <div class="col-md-4 mb-4">
                <div class="card stat-card h-100 cursor-pointer" @click="setView('questionBank')">
                    <div class="card-body">
                        <div class="stat-icon bg-secondary-accent text-white"><i class="fas fa-question-circle"></i></div>
                        <div>
                            <h5 class="card-title fw-bold mb-0">{{ questionBank?.length || 0 }}</h5>
                            <p class="card-text text-muted small">Total Questions</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-4">
                <div class="card stat-card h-100 cursor-pointer" @click="setView('questionBank', 'Pending Validation')">
                    <div class="card-body">
                        <div class="stat-icon bg-info text-white"><i class="fas fa-clipboard-list"></i></div>
                        <div>
                            <h5 class="card-title fw-bold mb-0">{{ questionBank?.filter(q => q.status === 'Pending Validation').length || 0 }}</h5>
                            <p class="card-text text-muted small">Questions Pending for Validation</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-4">
                <div class="card stat-card h-100 cursor-pointer" @click="setView('questionBank', 'Pending Approval')">
                    <div class="card-body">
                        <div class="stat-icon bg-dark-accent text-warning"><i class="fas fa-clock"></i></div>
                        <div>
                            <h5 class="card-title fw-bold mb-0">{{ questionBank?.filter(q => q.status === 'Pending Approval').length || 0 }}</h5>
                            <p class="card-text text-muted small">Questions Pending for Approval</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-4"
                v-if="!['Collecting Officer', 'Review Committee', 'Assessor'].includes(currentUser.role)">
                <div class="card stat-card h-100 cursor-pointer" @click="setView('pilotAdmin')">
                    <div class="card-body">
                        <div class="stat-icon bg-warning text-white"><i class="fas fa-clipboard-check"></i></div>
                        <div>
                            <h5 class="card-title fw-bold mb-0">{{ pilotTests?.filter(t => t.status === 'Pending Review').length || 0 }}</h5>
                            <p class="card-text text-muted small">Pending Test</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-4"
                v-if="!['Collecting Officer', 'Review Committee', 'Assessor'].includes(currentUser.role)">
                <div class="card stat-card h-100 cursor-pointer" @click="setView('pilotAdmin')">
                    <div class="card-body">
                        <div class="stat-icon bg-primary-accent text-white"><i class="fas fa-check-circle"></i></div>
                        <div>
                            <h5 class="card-title fw-bold mb-0">{{ pilotTests?.filter(t => t.status === 'Active').length || 0 }}</h5>
                            <p class="card-text text-muted small">Active Pilot Tests</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="card" v-if="recentActivities && recentActivities.length > 0">
            <div class="card-header">Recent Activity</div>
            <div class="card-body">
                <ul class="list-group list-group-flush">
                    <li v-for="activity in recentActivities" :key="activity.id"
                        class="list-group-item d-flex align-items-center">
                        <i class="fas me-3" :class="[activity.icon, activity.color]"></i>
                        <span>{{ activity.message }}</span>
                    </li>
                </ul>
            </div>
        </div>

        <!-- Assigned Tests for Admin -->
        <div class="card mt-4" v-if="currentUser.role === 'Admin' && assignedTestsForStudent?.length > 0">
            <div class="card-header bg-primary text-white">My Assigned Pilot Tests</div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover mb-0">
                        <thead>
                            <tr>
                                <th>Test Name</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="test in assignedTestsForStudent" :key="test.id">
                                <td>{{ test.name }}</td>
                                <td>
                                    <span v-if="test.status === 'Completed'" class="status-badge status-completed">{{
                                        test.status }} ({{ test.score }})</span>
                                    <span v-else class="status-badge status-not-started">{{ test.status }}</span>
                                </td>
                                <td>
                                    <button v-if="test.status === 'Not Started'" class="btn btn-sm btn-primary"
                                        @click="startTest(test)">Start Test</button>
                                    <button v-else-if="test.status === 'Completed'" class="btn btn-sm btn-info text-white"
                                        @click="viewStudentTestResult(test)">View Results</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useQuestionStore } from '../stores/questions';
import { useTestStore } from '../stores/tests';
import { useUserStore } from '../stores/users';

export default {
    name: 'Dashboard',
    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useQuestionStore, ['questions']),
        ...mapState(useTestStore, ['pilotTests', 'studentTests']),
        ...mapState(useUserStore, ['users']),
        
        questionBank() {
            return this.questions;
        },

        recentActivities() {
            const activities = [];
            if (this.studentTests && this.users) {
                this.studentTests.forEach(st => {
                     const student = this.users.find(u => {
                         if (u?.student?.id != null) return Number(u.student.id) === Number(st.studentId);
                         return Number(u.id) === Number(st.studentId);
                     });
                     if (st.status === 'In Progress') {
                         const test = this.pilotTests.find(t => t.id === st.testId);
                         if (student && test) {
                             activities.push({
                                 id: `progress-${st.testId}-${st.studentId}`,
                                 icon: 'fas fa-user-clock',
                                 color: 'text-primary',
                                 message: `${(student.fname || '')} ${(student.lname || '')}`.trim() + ` is taking ${test.name}`
                             });
                         }
                     } else if (st.status === 'Completed') {
                         const test = this.pilotTests.find(t => t.id === st.testId);
                         if (student && test) {
                             activities.push({
                                 id: `completed-${st.testId}-${st.studentId}`,
                                 icon: 'fas fa-check-circle',
                                 color: 'text-success',
                                 message: `${(student.fname || '')} ${(student.lname || '')}`.trim() + ` completed ${test.name} (Score: ${st.score})`
                             });
                         }
                     }
                });
            }
            return activities.slice(0, 5);
        },
        
        assignedTestsForStudent() {
             if (!this.currentUser) return [];
             const assignmentId =
                (this.currentUser.student && this.currentUser.student.id) ? this.currentUser.student.id :
                (this.currentUser.student_id != null ? this.currentUser.student_id : this.currentUser.id);
             return this.studentTests.filter(st => st.studentId === assignmentId).map(st => {
                const test = this.pilotTests.find(t => Number(t.id) === Number(st.testId));
                return {
                    ...st,
                    id: st.testId,
                    name: (test && test.name) ? test.name : (st.name || `Exam ${st.testId}`),
                    description: (test && test.description) ? test.description : (st.description || ''),
                    timeLimit: test ? test.timeLimit : (st.timeLimit || 0),
                    questionIds: test ? test.questionIds : (st.questionIds || [])
                };
             });
        }
    },
    methods: {
        ...mapActions(useTestStore, ['setActiveTest', 'setSelectedReport', 'setSelectedStudentResult', 'ensureTestReady']),
        
        setView(viewName, filterStatus = null) {
            if (viewName === 'questionBank' && filterStatus) {
                 const questionStore = useQuestionStore();
                 questionStore.filters.status = filterStatus;
            }
            this.$router.push({ name: viewName });
        },
        
        async startTest(test) {
             const ensured = await this.ensureTestReady(test.id);
             this.setActiveTest(ensured || test);
             this.$router.push({ name: 'testTaking' });
        },
        
        viewStudentTestResult(test) {
            const assignmentId =
                (this.currentUser?.student?.id != null) ? this.currentUser.student.id :
                (this.currentUser?.student_id != null ? this.currentUser.student_id : this.currentUser.id);
            const st = this.studentTests.find(s => s.testId === test.id && Number(s.studentId) === Number(assignmentId));
            if (st) {
                const reportTest = this.pilotTests.find(t => t.id === test.id);
                this.setSelectedReport(reportTest);
                this.setSelectedStudentResult(st);
                this.$router.push({ name: 'studentResultDetail' });
            }
        }
    }
}
</script>

<style scoped>
.stat-card {
    border: 1px solid var(--border-color);
    transition: transform 0.2s;
}
.stat-card:hover {
    transform: translateY(-2px);
}
.stat-card .stat-icon {
    font-size: 2rem;
    width: 64px;
    height: 64px;
    margin-right: 1.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
