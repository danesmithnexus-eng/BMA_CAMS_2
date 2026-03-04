<template>
  <div v-if="currentTest && currentTest.questions && !reviewMode && currentTest.questions.length">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4 sticky-top bg-light p-3 shadow-sm rounded">
      <h2 class="mb-0">{{ currentTest.name }}</h2>
      <div class="text-center">
        <h4 class="mb-0" :class="{ 'text-danger': currentTest.remainingTime < 300 }">
          <i class="fas fa-clock me-2"></i>
          {{ Math.floor(currentTest.remainingTime / 60).toString().padStart(2, '0') }}:
          {{ (currentTest.remainingTime % 60).toString().padStart(2, '0') }}
        </h4>
        <small class="text-muted">Time Remaining</small>
      </div>
    </div>

    <!-- Question Card -->
    <div class="card shadow-lg">
      <div class="card-body p-4">
        <div class="d-flex justify-content-between mb-3">
          <span class="badge bg-secondary">
            Question {{ currentTest.currentIndex + 1 }} of {{ currentTest.questions.length }}
          </span>
          <span class="badge bg-info text-dark">
            {{ currentTest.questions[currentTest.currentIndex].type }}
          </span>
        </div>

        <h4 class="mb-4">
          {{ currentTest.questions[currentTest.currentIndex].text }}
        </h4>

        <!-- Multiple Choice -->
        <div v-if="currentQuestion.type === 'Multiple Choice'">
          <div v-for="(opt, i) in currentQuestion.options" :key="i"
            class="form-check mb-3 p-3 border rounded hover-bg-light cursor-pointer" @click="selectOption(i)">
            <input class="form-check-input" type="radio" :name="'q' + currentQuestion.id" :value="i"
              v-model="currentTest.answers[currentQuestion.id]">
            <label class="form-check-label w-100 cursor-pointer">
              {{ opt.text }}
            </label>
          </div>
        </div>

        <!-- True/False -->
        <div v-else-if="currentQuestion.type === 'True or False'">
          <div class="form-check mb-3 p-3 border rounded hover-bg-light cursor-pointer"
            @click="selectTrueFalse('True')">
            <input type="radio" class="form-check-input" :name="'q' + currentQuestion.id" value="True"
              v-model="currentTest.answers[currentQuestion.id]">
            <label class="form-check-label w-100 cursor-pointer">True</label>
          </div>

          <div class="form-check mb-3 p-3 border rounded hover-bg-light cursor-pointer"
            @click="selectTrueFalse('False')">
            <input type="radio" class="form-check-input" :name="'q' + currentQuestion.id" value="False"
              v-model="currentTest.answers[currentQuestion.id]">
            <label class="form-check-label w-100 cursor-pointer">False</label>
          </div>
        </div>

        <!-- Identification -->
        <div v-else-if="currentQuestion.type === 'Identification'">
          <input type="text" class="form-control form-control-lg" placeholder="Type your answer here..."
            v-model="currentTest.answers[currentQuestion.id]" @change="persistIdentification">
        </div>
      </div>

      <!-- Navigation -->
      <div class="card-footer d-flex justify-content-between">
        <button class="btn btn-secondary" @click="prevQuestion" :disabled="currentTest.currentIndex === 0">
          Previous
        </button>

        <button v-if="currentTest.currentIndex < currentTest.questions.length - 1" class="btn btn-primary"
          @click="nextQuestion">
          Next
        </button>

        <button v-else class="btn btn-primary" @click="handleSubmitTest(false)">
          Review Answers
        </button>
      </div>
    </div>
  </div>

  <!-- Review View -->
  <div v-else-if="currentTest && reviewMode">
    <div class="d-flex justify-content-between align-items-center mb-4 sticky-top bg-light p-3 shadow-sm rounded">
      <div>
        <h2 class="mb-0">Review: {{ currentTest.name }}</h2>
        <span class="badge bg-secondary fs-6">Reviewing Answers</span>
      </div>
      <div class="text-center">
        <h4 class="mb-0" :class="{ 'text-danger': currentTest.remainingTime < 300 }">
          <i class="fas fa-clock me-2"></i>
          {{ Math.floor(currentTest.remainingTime / 60).toString().padStart(2, '0') }}:
          {{ (currentTest.remainingTime % 60).toString().padStart(2, '0') }}
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
          <h4 class="fw-bold">{{ examSummary.answered }}</h4>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card bg-danger-subtle p-3">
          <h6 class="mb-0">Missed</h6>
          <h4 class="fw-bold">{{ examSummary.missed }}</h4>
        </div>
      </div>
    </div>

    <div class="card mb-4">
      <div class="card-header">Question Summary</div>
      <div class="card-body">
        <div v-for="(q, index) in examSummary.questions" :key="q.id" class="card mb-2 cursor-pointer"
          @click="goToQuestion(index)">
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-center">
              <h6 class="mb-0">Q{{ index + 1 }}. {{ q.text }}</h6>
              <span :class="{ 'badge bg-success': q.isAnswered, 'badge bg-danger': !q.isAnswered }">
                {{ q.isAnswered ? 'Answered' : 'Missed' }}
              </span>
            </div>

            <p v-if="q.isAnswered" class="mb-0 mt-2">
              <small>
                <strong>Your Answer:</strong> {{ q.answer }}
              </small>
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="d-flex justify-content-between mb-5">
      <button class="btn btn-secondary" @click="backToExam">
        Back to Exam
      </button>
      <button class="btn btn-success btn-lg" @click="handleSubmitTest(true)">
        Submit Test
      </button>
    </div>
  </div>

  <div v-else class="card text-center p-5">
    <h5>No questions found for this test.</h5>
    <button class="btn btn-secondary" @click="goBack">Go Back</button>
  </div>
</template>

<script>
import { useTestStore } from '../stores/tests';
import { useAuthStore } from '../stores/auth';
import { computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

export default {
  setup() {
    const testStore = useTestStore();
    const authStore = useAuthStore();
    const router = useRouter();
    const route = useRoute();

    const currentTest = computed(() => testStore.currentTest);
    const reviewMode = computed(() => testStore.reviewMode);

    const currentQuestion = computed(() =>
      currentTest.value?.questions?.[currentTest.value.currentIndex]
    );

    const examSummary = computed(() => {
      if (!currentTest.value || !currentTest.value.questions)
        return { total: 0, answered: 0, missed: 0, questions: [] };

      try {
        const questions = currentTest.value.questions
          .map(q => {
            if (!q) return null;

            const answers = currentTest.value.answers || {};
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
          })
          .filter(Boolean);

        const total = questions.length;
        const answered = questions.filter(q => q.isAnswered).length;
        const missed = total - answered;

        return { total, answered, missed, questions };
      } catch (e) {
        console.error(e);
        return { total: 0, answered: 0, missed: 0, questions: [] };
      }
    });

    onMounted(async () => {
      const paramId = route.params?.id ? Number(route.params.id) : null;

      if (!authStore.user) {
        router.push({ name: 'login' });
        return;
      }

      await testStore.fetchStudentAssignments(authStore.user.id);

      if (paramId && (!testStore.currentTest || Number(testStore.currentTest.id) !== paramId)) {
        const ensured = await testStore.ensureTestReady(paramId);
        const ok = ensured ? testStore.setActiveTest(ensured) : false;

        if (ok && testStore.currentTest) {
          const sid = authStore.user?.student?.id ?? authStore.user?.student_id ?? authStore.user?.id;
          const aid = testStore.getAssignmentId(testStore.currentTest.id, sid);
          if (aid) {
            await testStore.startExamAction(aid);
          }
        } else if (!ok && !testStore.currentTest) {
          const target = authStore.user?.role === 'Student' ? 'studentDashboard' : 'dashboard';
          router.push({ name: target });
          return;
        }
      }

      if (testStore.currentTest && testStore.currentTest.remainingTime > 0) {
        testStore.startTimer();
      }
    });

    const getAssignmentId = () => {
      const sid =
        authStore.user?.student?.id ??
        authStore.user?.student_id ??
        authStore.user?.id;

      return testStore.getAssignmentId(currentTest.value.id, sid);
    };

    const sendCurrentAnswerToDB = () => {
      if (!currentTest.value || !currentQuestion.value) return;

      const q = currentQuestion.value;
      const qid = q.id;
      const answer = currentTest.value.answers[qid];

      if (answer === undefined || answer === null || answer === '') return;

      const aid = getAssignmentId();
      if (!aid) return;

      let valueToSend = answer;

      if (q.type === 'Multiple Choice') {
        valueToSend = q.options?.[answer]?.text ?? String(answer);
      }

      testStore.persistAnswer(aid, qid, String(valueToSend));
    };

    const sendAllAnswersToDB = () => {
      if (!currentTest.value) return;

      const aid = getAssignmentId();
      if (!aid) return;

      currentTest.value.questions.forEach(q => {
        const ans = currentTest.value.answers[q.id];
        if (ans === undefined || ans === null || ans === '') return;

        let val = ans;

        if (q.type === 'Multiple Choice') {
          val = q.options?.[ans]?.text ?? String(ans);
        }

        testStore.persistAnswer(aid, q.id, String(val));
      });
    };

    const nextQuestion = () => {
      sendCurrentAnswerToDB();
      testStore.nextQuestion();
    };

    const prevQuestion = () => {
      testStore.prevQuestion();
    };

    const goToQuestion = index => {
      testStore.jumpToQuestion(index);
      testStore.reviewMode = false;
    };

    const selectOption = index => {
      if (!currentTest.value || !currentQuestion.value) return;
      currentTest.value.answers[currentQuestion.value.id] = index;
    };

    const selectTrueFalse = val => {
      if (!currentTest.value || !currentQuestion.value) return;
      currentTest.value.answers[currentQuestion.value.id] = val;
    };

    const persistIdentification = () => {
      // intentionally local only
      if (!currentTest.value || !currentQuestion.value) return;
    };

    const handleSubmitTest = isFinal => {
      if (!currentTest.value) return;

      if (!isFinal) {
        testStore.reviewMode = true;
        return;
      }

      sendAllAnswersToDB();

      let score = 0;
      const answers = currentTest.value.answers || {};

      currentTest.value.questions.forEach(q => {
        const studentAnswer = answers[q.id];
        if (studentAnswer === undefined || studentAnswer === null) return;

        if (q.type === 'Multiple Choice') {
          if (Number(studentAnswer) === Number(q.answerIndex)) score++;
        } else if (q.type === 'True or False') {
          if (String(studentAnswer) === String(q.answer)) score++;
        } else if (q.type === 'Identification') {
          if (
            String(studentAnswer).toLowerCase() ===
            String(q.answer).toLowerCase()
          ) {
            score++;
          }
        }
      });

      const total = currentTest.value.questions.length || 0;
      const percent = total ? Math.round((score / total) * 100) : 0;

      const sid =
        authStore.user?.student?.id ??
        authStore.user?.student_id ??
        authStore.user?.id;

      testStore.submitTest(
        currentTest.value.id,
        Number(sid),
        answers,
        percent
      );

      const target =
        authStore.user.role === 'Student'
          ? 'studentDashboard'
          : 'dashboard';

      router.push({ name: target });
    };

    const backToExam = () => {
      testStore.reviewMode = false;
    };

    const goBack = () => {
      const target =
        authStore.user.role === 'Student'
          ? 'studentDashboard'
          : 'dashboard';

      router.push({ name: target });
    };

    return {
      testStore,
      currentTest,
      reviewMode,
      currentQuestion,
      examSummary,
      nextQuestion,
      prevQuestion,
      goToQuestion,
      selectOption,
      selectTrueFalse,
      persistIdentification,
      handleSubmitTest,
      backToExam,
      goBack
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