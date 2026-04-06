<template>
  <div class="d-flex justify-content-between align-items-center mb-4 sticky-top bg-light p-3 shadow-sm rounded">
    <div>
      <h2 class="mb-0">{{ title }}</h2>
      <span v-if="subtitle" class="badge bg-secondary fs-6">{{ subtitle }}</span>
      <span v-if="isOffline" class="badge bg-warning text-dark ms-2">
        <i class="fas fa-wifi me-1"></i> Offline
      </span>
    </div>
    <div class="text-center">
      <h4 class="mb-0" :class="{ 'text-danger': remainingTime < 300 }">
        <i class="fas fa-clock me-2"></i>{{ timeDisplay }}
      </h4>
      <small class="text-muted">Time Remaining</small>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title:         { type: String,  default: '' },
  subtitle:      { type: String,  default: '' },
  remainingTime: { type: Number,  default: 0 },
  isOffline:     { type: Boolean, default: false }
});

const timeDisplay = computed(() => {
  const m = Math.floor(props.remainingTime / 60).toString().padStart(2, '0');
  const s = (props.remainingTime % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
});
</script>