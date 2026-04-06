<script>
export default {
    name: 'QuestionBankFilters',
    
    props: {
        filters: {
            type: Object,
            required: true
        },
        allPrograms: {
            type: Array,
            default: () => []
        },
        allCourses: {
            type: Array,
            default: () => []
        },
        allTypes: {
            type: Array,
            default: () => []
        },
        allStatuses: {
            type: Array,
            default: () => []
        }
    },

    emits: ['update-filters', 'reset-filters'],

    methods: {
        updateFilter(key, value) {
            this.$emit('update-filters', { ...this.filters, [key]: value });
        },
        
        reset() {
            this.$emit('reset-filters');
        }
    }
};
</script>

<template>
    <div class="card mb-4">
        <div class="card-body">
            <div class="row g-3">
                <!-- Search Text -->
                <div class="col-lg-3">
                    <label class="form-label d-none">Search</label>
                    <input type="text" 
                           class="form-control" 
                           placeholder="Search questions..."
                           :value="filters.searchText"
                           @input="updateFilter('searchText', $event.target.value)">
                </div>
                
                <!-- Program Filter -->
                <div class="col-lg-2 col-md-6">
                    <label class="form-label d-none">Program</label>
                    <select class="form-select" 
                            :value="filters.program"
                            @change="updateFilter('program', $event.target.value)">
                        <option value="All">All Programs</option>
                        <option v-for="program in allPrograms" :key="program">{{ program }}</option>
                    </select>
                </div>
                
                <!-- Course Filter -->
                <div class="col-lg-2 col-md-6">
                    <label class="form-label d-none">Course</label>
                    <select class="form-select" 
                            :value="filters.course_id"
                            @change="updateFilter('course_id', $event.target.value)">
                        <option value="All">All Courses</option>
                        <option v-for="course in allCourses" :key="course">{{ course }}</option>
                    </select>
                </div>
                
                <!-- Question Type Filter -->
                <div class="col-lg-2 col-md-6">
                    <label class="form-label d-none">Type</label>
                    <select class="form-select" 
                            :value="filters.question_type_id"
                            @change="updateFilter('question_type_id', $event.target.value)">
                        <option value="All">All Types</option>
                        <option v-for="type in allTypes" :key="type">{{ type }}</option>
                    </select>
                </div>
                
                <!-- Status Filter -->
                <div class="col-lg-2 col-md-6">
                    <label class="form-label d-none">Status</label>
                    <select class="form-select" 
                            :value="filters.status"
                            @change="updateFilter('status', $event.target.value)">
                        <option value="All">All Statuses</option>
                        <option v-for="status in allStatuses" :key="status">{{ status }}</option>
                    </select>
                </div>
                
                <!-- Reset Button -->
                <div class="col-lg-1">
                    <label class="form-label d-none">Actions</label>
                    <button class="btn btn-sm btn-outline-secondary w-100" @click="reset">
                        Reset
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* No additional styles needed - using Bootstrap classes */
</style>
