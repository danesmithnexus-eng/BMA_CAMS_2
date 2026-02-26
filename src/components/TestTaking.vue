<script>
import { mapState, mapActions } from 'pinia';
import { useTestStore } from '../stores/tests';
import { useAuthStore } from '../stores/auth';
import { useUIStore } from '../stores/ui';

export default {
    name: 'TestTaking',
    data() {
        return {
            localViewMode: 'taking' // 'taking' or 'review'
        };
    },
    computed: {
        ...mapState(useTestStore, ['currentTest']),
        ...mapState(useAuthStore, { currentUser: 'user' }),
        
        isTakingView() {
            return this.localViewMode === 'taking';
        },
        isReviewView() {
            return this.localViewMode === 'review';
        },
        
        examSummary() {
            if (!this.currentTest || !this.currentTest.questions) return { total: 0, answered: 0, missed: 0, questions: [] };
            
            try {
                const questions = this.currentTest.questions.map(q => {
                    if (!q) return null;
                    
                    const answers = this.currentTest.answers || {};
                    const answer = answers[q.id];
                    
                    let displayAnswer = answer;
                    if (q.type === 'Multiple Choice' && answer !== undefined && answer !== null) {
                         if (q.options && q.options[answer]) {
                             displayAnswer = q.options[answer].text;
                         } else {
                             displayAnswer = 'Option ' + (Number(answer) + 1);
                         }
                    }
                    return {
                        id: q.id,
                        text: q.text,
                        isAnswered: answer !== undefined && answer !== null && answer !== '',
                        answer: displayAnswer
                    };
                }).filter(q => q !== null);

                const total = questions.length;
                const answered = questions.filter(q => q.isAnswered).length;
                const missed = total - answered;

                return { total, answered, missed, questions };
            } catch (error) {
                console.error("Error calculating exam summary:", error);
                return { total: 0, answered: 0, missed: 0, questions: [] };
            }
        }
    },
    methods: {
        ...mapActions(useTestStore, ['nextQuestion', 'prevQuestion', 'jumpToQuestion', 'submitTest', 'stopTimer']),
        ...mapActions(useUIStore, ['showToast']),
        
        handleSubmitTest(isFinal = false) {
            if (isFinal) {
                this.finalizeTestSubmission();
            } else {
                this.localViewMode = 'review';
            }
        },
        
        finalizeTestSubmission() {
            // Calculate Score
            let score = 0;
            const answers = this.currentTest.answers || {};
            
            this.currentTest.questions.forEach(q => {
                const studentAnswer = answers[q.id];
                if (studentAnswer === undefined || studentAnswer === null) return;

                if (q.type === 'Multiple Choice') {
                    if (Number(studentAnswer) === Number(q.answerIndex)) score++;
                } else if (q.type === 'True or False') {
                    if (String(studentAnswer) === String(q.answer)) score++;
                } else if (q.type === 'Identification') {
                    if (String(studentAnswer).toLowerCase() === String(q.answer).toLowerCase()) score++;
                }
                // Add other types if needed
            });

            // Calculate percentage or raw score? Let's do raw for now as per schema
            // Dispatch to store
            this.submitTest(this.currentTest.id, this.currentUser.id, answers, score);
            this.showToast('Success', 'Test submitted successfully.', 'success');
            
            // Navigate away
            const target = this.currentUser.role === 'Student' ? 'studentDashboard' : 'dashboard';
            this.$router.push({ name: target });
        },
        
        goToQuestion(index) {
            this.jumpToQuestion(index);
            this.localViewMode = 'taking';
        }
    }
}
</script>

<template>
    <!-- Test Taking View -->
    <div v-if="currentTest && isTakingView && currentTest.questions && currentTest.questions.length > 0">
        <div class="d-flex justify-content-between align-items-center mb-4 sticky-top bg-light p-3 shadow-sm rounded">
            <div>
                <h2 class="mb-0">{{ currentTest.name }}</h2>
            </div>
            <div class="text-center">
                <h4 class="mb-0" :class="{'text-danger': currentTest.remainingTime < 300}">
                    <i class="fas fa-clock me-2"></i>
                    {{ Math.floor(currentTest.remainingTime / 60).toString().padStart(2, '0') }}:{{ (currentTest.remainingTime % 60).toString().padStart(2, '0') }}
                </h4>
                <small class="text-muted">Time Remaining</small>
            </div>
        </div>
        
        <div class="card shadow-lg">
            <div class="card-body p-4">
                <div class="d-flex justify-content-between mb-3">
                    <span class="badge bg-secondary">Question {{ currentTest.currentIndex + 1 }} of {{ currentTest.questions.length }}</span>
                    <span class="badge bg-info text-dark">{{ currentTest.questions[currentTest.currentIndex].type }}</span>
                </div>
                
                <h4 class="mb-4">{{ currentTest.questions[currentTest.currentIndex].text }}</h4>
                
                <!-- Multiple Choice -->
                <div v-if="currentTest.questions[currentTest.currentIndex].type === 'Multiple Choice'">
                    <div v-for="(option, index) in currentTest.questions[currentTest.currentIndex].options" :key="index" class="form-check mb-3 p-3 border rounded hover-bg-light cursor-pointer" @click="currentTest.answers[currentTest.questions[currentTest.currentIndex].id] = index">
                        <input class="form-check-input" type="radio" :name="'q'+currentTest.questions[currentTest.currentIndex].id" :value="index" v-model="currentTest.answers[currentTest.questions[currentTest.currentIndex].id]">
                        <label class="form-check-label w-100 cursor-pointer">{{ option.text }}</label>
                    </div>
                </div>
                
                <!-- True or False -->
                <div v-else-if="currentTest.questions[currentTest.currentIndex].type === 'True or False'">
                    <div class="form-check mb-3 p-3 border rounded hover-bg-light cursor-pointer" @click="currentTest.answers[currentTest.questions[currentTest.currentIndex].id] = 'True'">
                        <input class="form-check-input" type="radio" :name="'q'+currentTest.questions[currentTest.currentIndex].id" value="True" v-model="currentTest.answers[currentTest.questions[currentTest.currentIndex].id]">
                        <label class="form-check-label w-100 cursor-pointer">True</label>
                    </div>
                    <div class="form-check mb-3 p-3 border rounded hover-bg-light cursor-pointer" @click="currentTest.answers[currentTest.questions[currentTest.currentIndex].id] = 'False'">
                        <input class="form-check-input" type="radio" :name="'q'+currentTest.questions[currentTest.currentIndex].id" value="False" v-model="currentTest.answers[currentTest.questions[currentTest.currentIndex].id]">
                        <label class="form-check-label w-100 cursor-pointer">False</label>
                    </div>
                </div>
                
                <!-- Identification -->
                <div v-else-if="currentTest.questions[currentTest.currentIndex].type === 'Identification'">
                    <input type="text" class="form-control form-control-lg" placeholder="Type your answer here..." v-model="currentTest.answers[currentTest.questions[currentTest.currentIndex].id]">
                </div>

            </div>
            <div class="card-footer d-flex justify-content-between">
                <button class="btn btn-secondary" @click="prevQuestion" :disabled="currentTest.currentIndex === 0">Previous</button>
                <button v-if="currentTest.currentIndex < currentTest.questions.length - 1" class="btn btn-primary" @click="nextQuestion">Next</button>
                <button v-else class="btn btn-primary" @click="handleSubmitTest(false)">Review Answers</button>
            </div>
        </div>
    </div>
    
    <div v-else-if="currentTest && isTakingView && (!currentTest.questions || currentTest.questions.length === 0)" class="card">
        <div class="card-body text-center p-5">
            <h5 class="mb-2">No questions found for this test.</h5>
            <p class="text-muted mb-4">Please contact your instructor or try again later.</p>
            <button class="btn btn-secondary" @click="$router.push({ name: currentUser.role === 'Student' ? 'studentDashboard' : 'dashboard' })">Go Back</button>
        </div>
    </div>

    <!-- Test Review View -->
    <div v-if="currentTest && isReviewView">
        <div class="d-flex justify-content-between align-items-center mb-4 sticky-top bg-light p-3 shadow-sm rounded">
            <div>
                <h2 class="mb-0">Review: {{ currentTest.name }}</h2>
                <span class="badge bg-secondary fs-6">Reviewing Answers</span>
            </div>
            <div class="text-center">
                <h4 class="mb-0" :class="{'text-danger': currentTest.remainingTime < 300}">
                    <i class="fas fa-clock me-2"></i>
                    {{ Math.floor(currentTest.remainingTime / 60).toString().padStart(2, '0') }}:{{ (currentTest.remainingTime % 60).toString().padStart(2, '0') }}
                </h4>
                <small class="text-muted">Time Remaining</small>
            </div>
        </div>
        
        <div class="row mb-3">
            <div class="col-md-4"><div class="card bg-light p-3"><h6 class="mb-0">Total Questions</h6><h4 class="fw-bold">{{ examSummary.total }}</h4></div></div>
            <div class="col-md-4"><div class="card bg-success-subtle p-3"><h6 class="mb-0">Answered</h6><h4 class="fw-bold">{{ examSummary.answered }}</h4></div></div>
            <div class="col-md-4"><div class="card bg-danger-subtle p-3"><h6 class="mb-0">Missed</h6><h4 class="fw-bold">{{ examSummary.missed }}</h4></div></div>
        </div>

        <div class="card mb-4">
            <div class="card-header">Question Summary</div>
            <div class="card-body">
                <div v-for="(q, index) in examSummary.questions" :key="q.id" class="card mb-2 cursor-pointer" @click="goToQuestion(index)">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">Q{{ index + 1 }}. {{ q.text }}</h6>
                            <span :class="{'badge bg-success': q.isAnswered, 'badge bg-danger': !q.isAnswered}">{{ q.isAnswered ? 'Answered' : 'Missed' }}</span>
                        </div>
                        <p v-if="q.isAnswered" class="mb-0 mt-2"><small><strong>Your Answer:</strong> {{ q.answer }}</small></p>
                    </div>
                </div>
            </div>
        </div>

        <div class="d-flex justify-content-between mb-5">
            <button class="btn btn-secondary" @click="localViewMode = 'taking'">Back to Exam</button>
            <button class="btn btn-success btn-lg" @click="finalizeTestSubmission">Submit Test</button>
        </div>
    </div>
</template>

<style scoped>
.hover-bg-light:hover {
    background-color: #f8f9fa;
}
.cursor-pointer {
    cursor: pointer;
}
</style>
