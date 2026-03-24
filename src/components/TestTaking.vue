<template>
  <div v-if="currentTest && currentTest.questions && !reviewMode && currentTest.questions.length">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4 sticky-top bg-light p-3 shadow-sm rounded">
      <div>
        <h2 class="mb-0">{{ currentTest.name }}</h2>
        <span v-if="isOffline" class="badge bg-warning text-dark small mt-1">
          <i class="fas fa-wifi me-1"></i> Offline — answers saved locally
        </span>
      </div>
      <div class="text-center">
        <h4 class="mb-0" :class="{ 'text-danger': currentTest.remainingTime < 300 }">
          <i class="fas fa-clock me-2"></i>
          {{ Math.floor(currentTest.remainingTime / 60).toString().padStart(2, '0') }}:{{ (currentTest.remainingTime %
            60).toString().padStart(2, '0') }}
        </h4>
        <small class="text-muted">Time Remaining</small>
      </div>
    </div>

    <!-- Question Card -->
    <div class="card shadow-lg">
      <div class="card-body p-4">
        <div class="d-flex justify-content-between mb-3">
          <span class="badge bg-secondary">Question {{ currentTest.currentIndex + 1 }} of {{
            currentTest.questions.length }}</span>
          <span class="badge bg-info text-dark">{{ currentTest.questions[currentTest.currentIndex].type }}</span>
        </div>

        <h4 class="mb-4">{{ currentTest.questions[currentTest.currentIndex].text }}</h4>

        <!-- Multiple Choice -->
        <div v-if="currentQuestion.type === 'Multiple Choice'">
          <div v-for="(opt, i) in currentQuestion.options" :key="i"
            class="form-check mb-3 p-3 border rounded hover-bg-light cursor-pointer"
            :class="{ 'border-primary bg-primary-subtle': currentTest.answers[currentQuestion.id] === i }"
            @click="selectOption(i)">
            <input class="form-check-input" type="radio" :name="'q' + currentQuestion.id" :value="i"
              v-model="currentTest.answers[currentQuestion.id]">
            <label class="form-check-label w-100 cursor-pointer">{{ opt.text }}</label>
          </div>
        </div>

        <!-- True/False -->
        <div v-else-if="currentQuestion.type === 'True or False'">
          <div v-for="val in ['True', 'False']" :key="val"
            class="form-check mb-3 p-3 border rounded hover-bg-light cursor-pointer"
            :class="{ 'border-primary bg-primary-subtle': currentTest.answers[currentQuestion.id] === val }"
            @click="selectTrueFalse(val)">
            <input type="radio" class="form-check-input" :name="'q' + currentQuestion.id" :value="val"
              v-model="currentTest.answers[currentQuestion.id]">
            <label class="form-check-label w-100 cursor-pointer">{{ val }}</label>
          </div>
        </div>

        <!-- Identification -->
        <div v-else-if="currentQuestion.type === 'Identification'">
          <input type="text" class="form-control form-control-lg" placeholder="Type your answer here..."
            v-model="currentTest.answers[currentQuestion.id]" @blur="persistCurrentAnswer">
        </div>
      </div>

      <!-- Navigation -->
      <div class="card-footer d-flex justify-content-between">
        <button class="btn btn-secondary" @click="prevQuestion"
          :disabled="currentTest.currentIndex === 0">Previous</button>
        <button v-if="currentTest.currentIndex < currentTest.questions.length - 1" class="btn btn-primary"
          @click="nextQuestion">Next</button>
        <button v-else class="btn btn-warning" @click="handleSubmitTest(false)">Review Answers</button>
      </div>
    </div>
  </div>

  <!-- Review View -->
  <div v-else-if="currentTest && reviewMode">
    <div class="d-flex justify-content-between align-items-center mb-4 sticky-top bg-light p-3 shadow-sm rounded">
      <div>
        <h2 class="mb-0">Review: {{ currentTest.name }}</h2>
        <span class="badge bg-secondary fs-6">Reviewing Answers</span>
        <span v-if="isOffline" class="badge bg-warning text-dark ms-2"><i class="fas fa-wifi me-1"></i> Offline</span>
      </div>
      <div class="text-center">
        <h4 class="mb-0" :class="{ 'text-danger': currentTest.remainingTime < 300 }">
          <i class="fas fa-clock me-2"></i>
          {{ Math.floor(currentTest.remainingTime / 60).toString().padStart(2, '00') }}:{{ (currentTest.remainingTime %
            60).toString().padStart(2, '00') }}
        </h4>
        <small class="text-muted">Time Remaining</small>
      </div>
    </div>

    <div class="row mb-3">
      <div class="col-md-4">
        <div class="card bg-light p-3">
          <h6 class="mb-0">Total Questions</h6>
          <h4 class="fw-bold">{{ examSummary.total }}</h4>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card bg-success-subtle p-3">
          <h6 class="mb-0">Answered</h6>
          <h4 class="fw-bold text-success">{{ examSummary.answered }}</h4>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card bg-danger-subtle p-3">
          <h6 class="mb-0">Missed</h6>
          <h4 class="fw-bold text-danger">{{ examSummary.missed }}</h4>
        </div>
      </div>
    </div>

    <div v-if="isOffline" class="alert alert-info small mb-3">
      <i class="fas fa-info-circle me-1"></i>
      You are offline. Your answers will be saved locally and automatically submitted to the server once you reconnect.
    </div>

    <div class="card mb-4">
      <div class="card-header fw-semibold">Question Summary</div>
      <div class="card-body">
        <div v-for="(q, index) in examSummary.questions" :key="q.id" class="card mb-2 cursor-pointer border-0 shadow-sm"
          @click="goToQuestion(index)">
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-center">
              <h6 class="mb-0 text-truncate me-3" style="max-width: 80%">Q{{ index + 1 }}. {{ q.text }}</h6>
              <span :class="q.isAnswered ? 'badge bg-success' : 'badge bg-danger'">
                {{ q.isAnswered ? 'Answered' : 'Missed' }}
              </span>
            </div>
            <p v-if="q.isAnswered" class="mb-0 mt-2 text-muted small">
              <strong>Your Answer:</strong> {{ q.answer }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="d-flex justify-content-between mb-5">
      <button class="btn btn-secondary" @click="backToExam">Back to Exam</button>
      <button class="btn btn-success btn-lg" :disabled="submitting" @click="handleSubmitTest(true)">
        <span v-if="submitting"><i class="fas fa-spinner fa-spin me-2"></i>Submitting...</span>
        <span v-else-if="isOffline"><i class="fas fa-save me-2"></i>Save Offline</span>
        <span v-else>Submit Test</span>
      </button>
    </div>
  </div>

  <div v-else class="card text-center p-5">
    <h5>No questions found for this test.</h5>
    <button class="btn btn-secondary mt-3" @click="goBack">Go Back</button>
  </div>
</template>

<script>
import { useTestStore } from '../stores/tests';
import { useAuthStore } from '../stores/auth';
import { computed, onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Network } from '@capacitor/network';
import { saveOfflineAnswer, updateCachedAssignmentStatus } from '../services/db';

export default {
  setup() {
    const testStore = useTestStore();
    const authStore = useAuthStore();
    const router = useRouter();
    const route = useRoute();
    const submitting = ref(false);
    const isOffline = ref(false);

    const currentTest = computed(() => testStore.currentTest);
    const reviewMode = computed(() => testStore.reviewMode);
    const currentQuestion = computed(() =>
      currentTest.value?.questions?.[currentTest.value.currentIndex]
    );

    const examSummary = computed(() => {
      if (!currentTest.value?.questions) return { total: 0, answered: 0, missed: 0, questions: [] };
      try {
        const questions = currentTest.value.questions.map(q => {
          if (!q) return null;
          const answer = currentTest.value.answers?.[q.id];
          let displayAnswer = answer;
          if (q.type === 'Multiple Choice' && answer !== undefined && answer !== null) {
            displayAnswer = q.options?.[answer]?.text ?? `Option ${Number(answer) + 1}`;
          }
          return { id: q.id, text: q.text, isAnswered: answer !== undefined && answer !== null && answer !== '', answer: displayAnswer };
        }).filter(Boolean);
        const answered = questions.filter(q => q.isAnswered).length;
        return { total: questions.length, answered, missed: questions.length - answered, questions };
      } catch (e) {
        return { total: 0, answered: 0, missed: 0, questions: [] };
      }
    });

    onMounted(async () => {
      const status = await Network.getStatus();
      isOffline.value = !status.connected;
      Network.addListener('networkStatusChange', (s) => { isOffline.value = !s.connected; });

      const paramId = route.params?.id ? Number(route.params.id) : null;
      if (!authStore.user) { router.push({ name: 'login' }); return; }

      await testStore.fetchStudentAssignments(authStore.user.id);

      if (paramId && (!testStore.currentTest || Number(testStore.currentTest.id) !== paramId)) {
        const ensured = await testStore.ensureTestReady(paramId);
        const ok = ensured ? testStore.setActiveTest(ensured) : false;
        if (ok && testStore.currentTest) {
          const sid = authStore.user?.student?.id ?? authStore.user?.student_id ?? authStore.user?.id;
          const aid = testStore.getAssignmentId(testStore.currentTest.id, sid);
          if (aid && !isOffline.value) await testStore.startExamAction(aid);
        } else if (!ok && !testStore.currentTest) {
          router.push({ name: authStore.user?.role === 'Student' ? 'studentDashboard' : 'dashboard' });
          return;
        }
      }

      if (testStore.currentTest?.remainingTime > 0) testStore.startTimer();
    });

    const getAssignmentId = () => {
      const sid = authStore.user?.student?.id ?? authStore.user?.student_id ?? authStore.user?.id;
      return testStore.getAssignmentId(currentTest.value?.id, sid);
    };

    const persistAnswer = async (q, answer) => {
      if (answer === undefined || answer === null || answer === '') return;
      const aid = getAssignmentId();
      if (!aid) return;
      let valueToSend = answer;
      if (q.type === 'Multiple Choice') valueToSend = q.options?.[answer]?.text ?? String(answer);
      if (isOffline.value) {
        await saveOfflineAnswer(aid, q.id, String(valueToSend));
      } else {
        testStore.persistAnswer(aid, q.id, String(valueToSend));
      }
    };

    const persistCurrentAnswer = () => {
      if (!currentTest.value || !currentQuestion.value) return;
      const answer = currentTest.value.answers[currentQuestion.value.id];
      persistAnswer(currentQuestion.value, answer);
    };

    const saveAllAnswers = async () => {
      if (!currentTest.value) return;
      const aid = getAssignmentId();
      if (!aid) return;
      const promises = currentTest.value.questions.map(async (q) => {
        const ans = currentTest.value.answers[q.id];
        if (ans === undefined || ans === null || ans === '') return;
        let val = ans;
        if (q.type === 'Multiple Choice') val = q.options?.[ans]?.text ?? String(ans);
        if (isOffline.value) {
          await saveOfflineAnswer(aid, q.id, String(val));
        } else {
          return testStore.persistAnswer(aid, q.id, String(val));
        }
      });
      await Promise.allSettled(promises);
    };

    const nextQuestion = () => { persistCurrentAnswer(); testStore.nextQuestion(); };
    const prevQuestion = () => testStore.prevQuestion();
    const goToQuestion = index => { testStore.jumpToQuestion(index); testStore.reviewMode = false; };
    const selectOption = index => {
      if (!currentTest.value || !currentQuestion.value) return;
      currentTest.value.answers[currentQuestion.value.id] = index;
    };
    const selectTrueFalse = val => {
      if (!currentTest.value || !currentQuestion.value) return;
      currentTest.value.answers[currentQuestion.value.id] = val;
    };

    const handleSubmitTest = async (isFinal) => {
      if (!currentTest.value) return;
      if (!isFinal) { testStore.reviewMode = true; return; }

      submitting.value = true;

      await saveAllAnswers();

      const testId = Number(currentTest.value.id);
      const answers = { ...currentTest.value.answers };
      const aid = getAssignmentId();
      const sid = Number(authStore.user?.student?.id ?? authStore.user?.student_id ?? authStore.user?.id);

      if (isOffline.value) {
        testStore.stopTimer();

        const stIdx = testStore.studentTests.findIndex(
          st => Number(st.testId) === testId && Number(st.studentId) === sid
        );
        const completedAt = new Date().toISOString();
        if (stIdx >= 0) {
          testStore.studentTests[stIdx] = {
            ...testStore.studentTests[stIdx],
            status: 'Completed',
            answers,
            completedAt
          };
        }

        if (aid) {
          await updateCachedAssignmentStatus(aid, 'Completed');
        }

        testStore.currentTest = null;
        testStore.reviewMode = false;

        submitting.value = false;
        alert('Your answers have been saved locally and will be automatically submitted when you reconnect.');
        router.push({ name: authStore.user?.role === 'Student' ? 'studentDashboard' : 'dashboard' });
        return;
      }

      let localScore = 0;
      currentTest.value.questions.forEach(q => {
        const given = answers[q.id];
        if (given === undefined || given === null || given === '') return;
        if (q.type === 'Multiple Choice') { if (Number(given) === Number(q.answerIndex)) localScore++; }
        else if (q.type === 'True or False') { if (String(given).toLowerCase() === String(q.answer).toLowerCase()) localScore++; }
        else if (q.type === 'Identification') { if (String(given).trim().toLowerCase() === String(q.answer ?? '').trim().toLowerCase()) localScore++; }
      });

      const total = currentTest.value.questions.length || 0;
      const percent = total ? Math.round((localScore / total) * 100) : 0;

      testStore.submitTest(testId, sid, answers, percent);
      submitting.value = false;
      router.push({ name: authStore.user?.role === 'Student' ? 'studentDashboard' : 'dashboard' });
    };

    const backToExam = () => { testStore.reviewMode = false; };
    const goBack = () => { router.push({ name: authStore.user?.role === 'Student' ? 'studentDashboard' : 'dashboard' }); };

    return {
      testStore, currentTest, reviewMode, currentQuestion, examSummary, submitting, isOffline,
      nextQuestion, prevQuestion, goToQuestion, selectOption, selectTrueFalse,
      persistCurrentAnswer, handleSubmitTest, backToExam, goBack
    };
  }
};
</script>

<style scoped>
.hover-bg-light:hover {
  background-color: #f8f9fa;
}

.cursor-pointer {
  cursor: pointer;
}
</style>