<script>
import { mapState, mapActions } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useTestStore } from '../stores/tests';
import { useUserStore } from '../stores/users';
import { useQuestionStore } from '../stores/questions';
import { useUIStore } from '../stores/ui';

export default {
    name: 'Reports',
    data() {
        return {
            reportsViewTab: 'tests',
            reportTab: 'overall',
            returnView: 'reportDetail',
            learning_outcomes_id: ['All', 'LO-1', 'LO-2', 'LO-3'],
            cognitiveLevels: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating']
        };
    },
    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useTestStore, ['pilotTests', 'studentTests', 'selectedReport', 'selectedStudentResult']),
        ...mapState(useUserStore, ['users']),
        ...mapState(useQuestionStore, ['questions']),

        currentView() {
            return this.$route.name;
        },

        completedTests() {
            if (!this.studentTests || !this.pilotTests) return [];
            // Unique tests that have at least one completion
            const completedTestIds = [...new Set(this.studentTests.filter(st => st.status === 'Completed').map(st => st.testId))];
            return this.pilotTests.filter(t => completedTestIds.includes(t.id)).map(t => ({
                ...t,
                participants: this.studentTests.filter(st => st.testId === t.id && st.status === 'Completed').length
            }));
        },

        selectedQuestionsForPreview() {
            if (this.selectedReport) {
                return this.questions.filter(q => (this.selectedReport.questionIds || []).includes(q.id));
            }
            return [];
        },

        ad09SummaryData() {
            const summary = {};
            const rowTotals = {};
            const colTotals = {};
            
            this.loTags.forEach(lo => {
                if(lo === 'All') return;
                summary[lo] = {};
                rowTotals[lo] = 0;
                this.cognitiveLevels.forEach(level => {
                    summary[lo][level] = 0;
                    if(!colTotals[level]) colTotals[level] = 0;
                });
            });
            
            this.selectedQuestionsForPreview.forEach(q => {
                const raw = q.loTag || '';
                const match = raw.match(/^(?:CLO|LO)-\d+/i);
                const lo = match ? match[0].toUpperCase().replace(/^CLO/, 'LO') : null;
                if (lo && summary[lo] && summary[lo][q.cognitiveTag] !== undefined) {
                    summary[lo][q.cognitiveTag]++;
                    rowTotals[lo]++;
                    colTotals[q.cognitiveTag]++;
                }
            });
            
            return { summary, rowTotals, colTotals, cognitiveLevels: this.cognitiveLevels };
        }
    },
    methods: {
        ...mapActions(useTestStore, ['setSelectedReport', 'setSelectedStudentResult', 'fetchCompletedResultsForAssignments']),
        ...mapActions(useUIStore, ['showToast']),
        
        setView(viewName) {
            this.$router.push({ name: viewName });
        },

        viewReport(test) {
            const stResults = this.studentTests.filter(st => st.testId === test.id && st.status === 'Completed');
            const totalStudents = stResults.length;
            const avgScore = totalStudents > 0 ? stResults.reduce((sum, st) => sum + st.score, 0) / totalStudents : 0;

            // Calculate Average Time
            const avgTimeSeconds = totalStudents > 0 ? stResults.reduce((sum, st) => sum + (st.timeTaken || 0), 0) / totalStudents : 0;
            const avgTimeMinutes = (avgTimeSeconds / 60).toFixed(1);
            
            // Calculate Item Analysis
            const testQuestions = this.questions.filter(q => (test.questionIds || []).includes(q.id));
            const itemAnalysis = testQuestions.map(q => {
                const correctCount = stResults.filter(st => {
                    if (q.type === 'Multiple Choice') return st.answers[q.id] === q.answerIndex;
                    return (st.answers[q.id] || '').toLowerCase() === q.answer.toLowerCase();
                }).length;
                
                const difficulty = correctCount / totalStudents || 0;
                
                // Mock discrimination for now
                const discrimination = Math.random() * 0.8 + 0.1;
                
                let rec = { text: 'Retain', class: 'bg-success' };
                if (difficulty < 0.2) rec = { text: 'Revise (Too Hard)', class: 'bg-warning' };
                if (difficulty > 0.9) rec = { text: 'Revise (Too Easy)', class: 'bg-warning' };
                if (discrimination < 0.2) rec = { text: 'Discard', class: 'bg-danger' };

                return { ...q, difficulty, discrimination, recommendation: rec };
            });

            this.setSelectedReport({
                ...test,
                participants: totalStudents,
                avgScore,
                avgTime: avgTimeMinutes,
                studentResults: stResults,
                itemAnalysis
            });
            
            this.setView('reportDetail');
        },

        openStudentResult(result) {
            this.setSelectedStudentResult(result);
            this.returnView = 'reportDetail';
            this.setView('studentResultDetail');
        }
    },
    mounted() {
        this.fetchCompletedResultsForAssignments();
    }
};
</script>

<template>
    <!-- Reports & Analysis -->
    <div v-if="currentView === 'reports'">
        <h2 class="mb-4">Reports & Analysis</h2>
        
        <ul class="nav nav-tabs mb-3">
            <li class="nav-item">
                <a class="nav-link" :class="{ active: reportsViewTab === 'tests' }" href="#" @click.prevent="reportsViewTab = 'tests'">Completed Pilot Tests</a>
            </li>
            <li class="nav-item">
                <a class="nav-link" :class="{ active: reportsViewTab === 'studentPerformance' }" href="#" @click.prevent="reportsViewTab = 'studentPerformance'">View Student Performance</a>
            </li>
        </ul>

        <div v-if="reportsViewTab === 'tests'" class="card">
            <div class="card-header">Completed Pilot Tests</div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead><tr><th>Test Name</th><th>Participants</th><th>Completion Date</th><th>Action</th></tr></thead>
                        <tbody>
                            <tr v-if="!completedTests || completedTests.length === 0"><td colspan="4" class="text-center text-muted p-5">No tests have been completed yet.</td></tr>
                            <tr v-for="test in completedTests" :key="test.id">
                                <td>{{ test.name }}</td>
                                <td>{{ test.participants }}</td>
                                <td>{{ new Date().toLocaleDateString() }}</td>
                                <td><button class="btn btn-sm btn-primary" @click="viewReport(test)">View Report</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div v-if="reportsViewTab === 'studentPerformance'" class="card">
            <div class="card-header">Student Performance List</div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead><tr><th>Student Name</th><th>Test Name</th><th>Status</th><th>Score</th><th>Action</th></tr></thead>
                        <tbody>
                            <tr v-if="!studentTests || studentTests.length === 0"><td colspan="5" class="text-center text-muted p-5">No student performance data available.</td></tr>
                            <tr v-for="st in studentTests" :key="st.studentId + '-' + st.testId">
                                <td>{{ (() => { const u = users.find(user => user.id === st.studentId); return u ? `${u.fname} ${u.lname}` : 'Unknown'; })() }}</td>
                                <td>{{ st.name }}</td>
                                <td>
                                    <span v-if="st.status === 'Completed'" class="badge bg-success">Completed</span>
                                    <span v-else class="badge bg-secondary">{{ st.status }}</span>
                                </td>
                                <td>{{ st.score || 'N/A' }}</td>
                                <td>
                                    <button v-if="st.status === 'Completed'" class="btn btn-sm btn-info text-white" @click="openStudentResult(st)">View Paper</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- Report Detail View -->
    <div v-if="currentView === 'reportDetail'">
        <div class="d-flex align-items-center mb-4">
            <button class="btn btn-outline-secondary me-3" @click="setView('reports')"><i class="fas fa-arrow-left"></i> Back</button>
            <h2 class="mb-0">Analysis for: {{ selectedReport?.name }}</h2>
        </div>

        <!-- Tab Card Container -->
        <div class="card shadow-sm">
            <div class="card-header">
                <ul class="nav nav-tabs card-header-tabs">
                    <li class="nav-item">
                        <a class="nav-link cursor-pointer" :class="{ active: reportTab === 'overall' }" @click="reportTab = 'overall'">Overall Analysis</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link cursor-pointer" :class="{ active: reportTab === 'student' }" @click="reportTab = 'student'">Student Performance</a>
                    </li>
                </ul>
            </div>
            <div class="card-body">
                <!-- Overall Analysis Tab -->
                <div v-if="reportTab === 'overall'">
                    <h5 class="card-title mb-3">Overall Statistics</h5>
                    <div class="row text-center mb-4">
                        <div class="col"><h4>{{ selectedReport?.participants || 0 }}</h4><p class="text-muted">Participants</p></div>
                        <div class="col"><h4>{{ selectedReport?.avgScore?.toFixed(1) || 0 }}%</h4><p class="text-muted">Average Score</p></div>
                        <div class="col"><h4>{{ selectedReport?.avgTime || 0 }} min</h4><p class="text-muted">Average Time</p></div>
                        <div class="col"><h4>{{ selectedReport?.semester || 'N/A' }}</h4><p class="text-muted">Semester</p></div>
                        <div class="col"><h4>{{ selectedReport?.academicYear || 'N/A' }}</h4><p class="text-muted">Academic Year</p></div>
                    </div>
                    <hr>
                    
                    <h5 class="card-title mb-3">Table of Specifications (Alignment Matrix)</h5>
                    <div class="table-responsive mb-4">
                        <table class="table table-bordered table-sm text-center">
                            <thead><tr><th class="align-middle">LO</th><th v-for="level in ad09SummaryData?.cognitiveLevels" :key="level">{{ level }}</th><th class="align-middle">Total</th></tr></thead>
                            <tbody><tr v-for="(counts, lo) in ad09SummaryData?.summary" :key="lo"><td>{{ lo }}</td><td v-for="level in ad09SummaryData?.cognitiveLevels" :key="level">{{ counts[level] || 0 }}</td><td><strong>{{ ad09SummaryData?.rowTotals?.[lo] || 0 }}</strong></td></tr></tbody>
                            <tfoot><tr><th>Total</th><th v-for="level in ad09SummaryData?.cognitiveLevels" :key="level"><strong>{{ ad09SummaryData?.colTotals?.[level] || 0 }}</strong></th><th><strong>{{ selectedQuestionsForPreview?.length || 0 }}</strong></th></tr></tfoot>
                        </table>
                    </div>
                    <hr>

                    <h5 class="card-title mb-3">Item Analysis</h5>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead><tr><th>Question</th><th>Difficulty Index</th><th>Discrimination Index</th><th>Recommendation</th></tr></thead>
                            <tbody>
                                <tr v-for="item in selectedReport?.itemAnalysis" :key="item.id">
                                    <td><div class="text-truncate" style="max-width: 300px;" :title="item.text">{{ item.text }}</div></td>
                                    <td>{{ item.difficulty.toFixed(2) }}</td>
                                    <td>{{ item.discrimination.toFixed(2) }}</td>
                                    <td><span class="badge" :class="item.recommendation.class">{{ item.recommendation.text }}</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Student Performance Tab -->
                <div v-if="reportTab === 'student'">
                    <table class="table table-hover">
                        <thead><tr><th>Student Name</th><th>Score</th><th>Date Completed</th><th>Action</th></tr></thead>
                        <tbody>
                            <tr v-for="st in selectedReport?.studentResults" :key="st.studentId">
                                <td>{{ (() => { const u = users.find(user => user.id === st.studentId); return u ? `${u.fname} ${u.lname}` : 'Unknown'; })() }}</td>
                                <td>{{ st.score }}%</td>
                                <td>{{ st.completedAt ? new Date(st.completedAt).toLocaleDateString() : 'N/A' }}</td>
                                <td><button class="btn btn-sm btn-info text-white" @click="openStudentResult(st)">View Paper</button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Student Result Detail View -->
    <div v-if="currentView === 'studentResultDetail'" class="container-fluid p-4">
        <div class="card border-0 shadow-sm rounded-4">
            <div class="card-header bg-white border-bottom p-4 d-flex justify-content-between align-items-center">
                    <div>
                        <h4 class="mb-1 text-primary-dark fw-bold">{{ selectedReport?.name }} - {{ (() => { const u = users.find(user => user.id === selectedStudentResult?.studentId); return u ? `${u.fname} ${u.lname}` : 'Unknown'; })() }}</h4>
                        <p class="text-muted mb-0">Score: <span class="badge bg-success">{{ selectedStudentResult?.score }}</span></p>
                    </div>
                    <button class="btn btn-outline-secondary" @click="setView(returnView || 'reportDetail')">
                        <i class="fas fa-arrow-left me-1"></i> Back
                    </button>
            </div>
            <div class="card-body p-4 scrollable-y-80">
                    <div v-for="(question, index) in questions.filter(q => (selectedReport?.questionIds || []).some(id => id == q.id)) || []" :key="question.id" class="card mb-3 border-0 shadow-sm">
                        <div class="card-body">
                            <h6 class="fw-bold mb-3">Q{{ index + 1 }}. {{ question.text }}</h6>
                            
                            <!-- Multiple Choice -->
                            <div v-if="question.type === 'Multiple Choice'">
                                <div v-for="(option, idx) in question.options" :key="idx" 
                                    class="p-2 mb-2 rounded border"
                                    :class="{
                                        'bg-success-subtle border-success text-success-emphasis': idx == question.answerIndex,
                                        'bg-danger-subtle border-danger text-danger-emphasis': idx == selectedStudentResult?.answers[question.id] && idx != question.answerIndex,
                                        'bg-light': idx != question.answerIndex && idx != selectedStudentResult?.answers[question.id]
                                    }">
                                    <div class="d-flex justify-content-between">
                                        <span>{{ option.text }}</span>
                                        <span v-if="idx == question.answerIndex"><i class="fas fa-check-circle"></i> Correct Answer</span>
                                        <span v-if="idx == selectedStudentResult?.answers[question.id] && idx != question.answerIndex"><i class="fas fa-times-circle"></i> Student Answer</span>
                                        <span v-if="idx == selectedStudentResult?.answers[question.id] && idx == question.answerIndex"><i class="fas fa-check-circle"></i> Student Answer</span>
                                    </div>
                                </div>
                            </div>

                            <!-- True/False -->
                            <div v-else-if="question.type === 'True or False'">
                                <div v-for="option in ['True', 'False']" :key="option"
                                    class="p-2 mb-2 rounded border"
                                    :class="{
                                        'bg-success-subtle border-success text-success-emphasis': option === question.answer,
                                        'bg-danger-subtle border-danger text-danger-emphasis': option === selectedStudentResult?.answers[question.id] && option !== question.answer,
                                        'bg-light': option !== question.answer && option !== selectedStudentResult?.answers[question.id]
                                    }">
                                    <div class="d-flex justify-content-between">
                                        <span>{{ option }}</span>
                                        <span v-if="option === question.answer"><i class="fas fa-check-circle"></i> Correct Answer</span>
                                        <span v-if="option === selectedStudentResult?.answers[question.id] && option !== question.answer"><i class="fas fa-times-circle"></i> Student Answer</span>
                                        <span v-if="option === selectedStudentResult?.answers[question.id] && option === question.answer"><i class="fas fa-check-circle"></i> Student Answer</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Identification -->
                            <div v-else-if="question.type === 'Identification'">
                                <p class="mb-1"><strong>Correct Answer:</strong> <span class="text-success">{{ question.answer }}</span></p>
                                <p class="mb-0"><strong>Student Answer:</strong> 
                                    <span :class="{'text-success': question.answer.toLowerCase() === (selectedStudentResult?.answers[question.id] || '').toLowerCase(), 'text-danger': question.answer.toLowerCase() !== (selectedStudentResult?.answers[question.id] || '').toLowerCase()}">
                                        {{ selectedStudentResult?.answers[question.id] || 'No Answer' }}
                                    </span>
                                </p>
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
.scrollable-y-40 {
    max-height: 40vh;
    overflow-y: auto;
}
</style>
