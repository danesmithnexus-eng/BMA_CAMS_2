<template>
  <div>
    <!-- Stats -->
    <div class="row mb-3 g-3">
      <div class="col-4">
        <div class="card bg-light border-0 text-center p-3 h-100">
          <div class="small text-muted mb-1">Answered</div>
          <div class="fw-bold fs-5 text-success">{{ summary.answered }} / {{ summary.total }}</div>
        </div>
      </div>
      <div class="col-4">
        <div class="card bg-danger-subtle border-0 text-center p-3 h-100">
          <div class="small text-muted mb-1">Missed</div>
          <div class="fw-bold fs-5 text-danger">{{ summary.missed }}</div>
        </div>
      </div>
      <div class="col-4">
        <div class="card bg-info-subtle border-0 text-center p-3 h-100">
          <div class="small text-muted mb-1">Time Spent</div>
          <div class="fw-bold fs-5 text-info">{{ formatDuration(summary.totalTimeSpent) }}</div>
        </div>
      </div>
    </div>

    <!-- Offline notice -->
    <div v-if="isOffline" class="alert alert-info small mb-3">
      <i class="fas fa-info-circle me-1"></i>
      Offline — answers saved locally and submitted when reconnected.
    </div>

    <!-- Question list -->
    <div class="card mb-4">
      <div class="card-header fw-semibold">Question Summary</div>
      <div class="card-body p-2" style="max-height: 55vh; overflow-y: auto;">
        <div
          v-for="(q, i) in summary.questions"
          :key="q.id"
          class="card mb-2 border-0 shadow-sm cursor-pointer"
          @click="$emit('goto', i)"
        >
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <span class="text-truncate" style="max-width: 78%">
                <strong>Q{{ i + 1 }}.</strong> {{ q.text }}
              </span>
              <span :class="q.isAnswered ? 'badge bg-success' : 'badge bg-danger'">
                {{ q.isAnswered ? 'Answered' : 'Missed' }}
              </span>
            </div>
            <p v-if="q.isAnswered" class="mb-0 mt-1 text-muted small">
              <strong>Your Answer:</strong> {{ q.answer }}
            </p>
            <p class="mb-0 mt-1 text-muted extra-small">
              <i class="fas fa-clock me-1"></i>Time Spent: {{ formatDuration(q.timeSpent) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Average Time -->
    <div v-if="summary.total > 0" class="alert alert-light border-0 small mb-4 py-2">
      <i class="fas fa-chart-line me-1"></i>
      Average time per question: {{ formatDuration(averageTime) }}
    </div>

    <!-- Actions -->
    <div class="d-flex justify-content-between mb-5">
      <button class="btn btn-secondary" @click="$emit('back')">
        <i class="fas fa-arrow-left me-1"></i> Back to Exam
      </button>
      <button class="btn btn-success btn-lg" :disabled="submitting" @click="$emit('submit')">
        <span v-if="submitting">
          <i class="fas fa-spinner fa-spin me-2"></i>Submitting...
        </span>
        <span v-else-if="isOffline">
          <i class="fas fa-save me-2"></i>Save Offline
        </span>
        <span v-else>
          <i class="fas fa-paper-plane me-1"></i>Submit Test
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  summary:    { type: Object,  required: true },
  submitting: { type: Boolean, default: false },
  isOffline:  { type: Boolean, default: false }
});

defineEmits(['goto', 'back', 'submit']);

const averageTime = computed(() => {
    if (!props.summary.total || props.summary.total === 0) return 0;
    return Math.round((props.summary.totalTimeSpent || 0) / props.summary.total);
});

const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
};
</script>

<style scoped>
.cursor-pointer { cursor: pointer; }
.extra-small { font-size: 0.75rem; }
</style>