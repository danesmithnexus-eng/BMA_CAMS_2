<template>
  <div class="card shadow-lg">
    <div class="card-body p-4">

      <!-- Badge row -->
      <div class="d-flex justify-content-between mb-3">
        <span class="badge bg-secondary">Question {{ index + 1 }} of {{ total }}</span>
        <span class="badge bg-info text-dark">{{ question.type }}</span>
      </div>

      <!-- Question text -->
      <h5 class="mb-4">{{ question.text }}</h5>

      <!-- Multiple Choice -->
      <div v-if="question.type === 'Multiple Choice'">
        <div
          v-for="(opt, i) in question.options"
          :key="i"
          class="p-3 mb-2 border rounded cursor-pointer"
          :class="modelValue === i ? 'border-primary bg-primary-subtle' : 'border-secondary'"
          @click="$emit('update:modelValue', i)"
        >
          <div class="d-flex align-items-center gap-2">
            <input
              type="radio"
              :name="'q_' + question.id"
              :value="i"
              :checked="modelValue === i"
              class="form-check-input mt-0 flex-shrink-0"
              readonly
            />
            <span>{{ opt.text }}</span>
          </div>
        </div>
      </div>

      <!-- True / False -->
      <div v-else-if="question.type === 'True or False'">
        <div
          v-for="val in ['True', 'False']"
          :key="val"
          class="p-3 mb-2 border rounded cursor-pointer"
          :class="modelValue === val ? 'border-primary bg-primary-subtle' : 'border-secondary'"
          @click="$emit('update:modelValue', val)"
        >
          <div class="d-flex align-items-center gap-2">
            <input
              type="radio"
              :name="'q_' + question.id"
              :value="val"
              :checked="modelValue === val"
              class="form-check-input mt-0 flex-shrink-0"
              readonly
            />
            <span>{{ val }}</span>
          </div>
        </div>
      </div>

      <!-- Identification -->
      <div v-else-if="question.type === 'Identification'">
        <input
          type="text"
          class="form-control form-control-lg"
          placeholder="Type your answer here..."
          :value="modelValue ?? ''"
          @input="$emit('update:modelValue', $event.target.value)"
          @blur="$emit('blur')"
        />
      </div>

      <!-- Enumeration -->
      <div v-else-if="question.type === 'Enumeration'">
        <textarea
          class="form-control"
          rows="4"
          placeholder="Type your answers here, one per line..."
          :value="modelValue ?? ''"
          @input="$emit('update:modelValue', $event.target.value)"
          @blur="$emit('blur')"
        />
      </div>

      <!-- Fallback for unknown types -->
      <div v-else>
        <input
          type="text"
          class="form-control form-control-lg"
          placeholder="Type your answer here..."
          :value="modelValue ?? ''"
          @input="$emit('update:modelValue', $event.target.value)"
          @blur="$emit('blur')"
        />
      </div>

    </div>

    <!-- Navigation footer -->
    <div class="card-footer d-flex justify-content-between align-items-center">
      <button
        class="btn btn-secondary"
        :disabled="index === 0"
        @click="$emit('prev')"
      >
        <i class="fas fa-arrow-left me-1"></i> Previous
      </button>

      <button
        v-if="index < total - 1"
        class="btn btn-primary"
        @click="$emit('next')"
      >
        Next <i class="fas fa-arrow-right ms-1"></i>
      </button>
      <button
        v-else
        class="btn btn-warning"
        @click="$emit('review')"
      >
        <i class="fas fa-list-check me-1"></i> Review Answers
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  question:   { type: Object,  required: true },
  index:      { type: Number,  required: true },
  total:      { type: Number,  required: true },
  modelValue: { default: null }
});

defineEmits(['update:modelValue', 'prev', 'next', 'review', 'blur']);
</script>

<style scoped>
.cursor-pointer { cursor: pointer; }
</style>