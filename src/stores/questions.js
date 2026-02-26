import { defineStore } from 'pinia';

export const useQuestionStore = defineStore('questions', {
    state: () => ({
        questions: [],
        filters: {
            searchText: '',
            program: 'All',
            course_id: 'All',
            question_type_id: 'All',
            status: 'All'
        }
    }),
    getters: {
        filteredQuestions(state) {
            return state.questions.filter(q => {
                const matchesSearch = (q.text || '').toLowerCase().includes((state.filters.searchText || '').toLowerCase());
                const matchesProgram = state.filters.program === 'All' || q.program === state.filters.program;
                const matchesCourse = state.filters.course_id === 'All' || q.course_id === state.filters.course_id;
                const matchesType = state.filters.question_type_id === 'All' || q.question_type_id === state.filters.question_type_id;
                const matchesStatus = state.filters.status === 'All' || q.status === state.filters.status;
                return matchesSearch && matchesProgram && matchesCourse && matchesType && matchesStatus;
            });
        },
        groupedQuestions(state) {
            const groups = {};
            this.filteredQuestions.forEach(q => {
                const key = q.course_code || q.course_id || q.course || q.program || 'Unknown Course';
                if (!groups[key]) groups[key] = [];
                groups[key].push(q);
            });
            return groups;
        },
        hasDrafts: (state) => state.questions.some(q => q.status === 'Draft'),
        hasPendingValidation: (state) => state.questions.some(q => q.status === 'Pending Validation'),
        hasPendingApproval: (state) => state.questions.some(q => q.status === 'Pending Approval'),
        approvedQuestions: (state) => state.questions.filter(q => q.status === 'Approved')
    },
    actions: {
        addQuestion(question) {
            // Ensure ID
            if (!question.id) question.id = Date.now();
            this.questions.push(question);
        },
        updateQuestion(updatedQuestion) {
            const index = this.questions.findIndex(q => q.id === updatedQuestion.id);
            if (index !== -1) {
                this.questions[index] = updatedQuestion;
            }
        },
        deleteQuestion(id) {
            this.questions = this.questions.filter(q => q.id !== id);
        },
        updateStatus(id, status, remarks = '') {
            const q = this.questions.find(q => q.id === id);
            if (q) {
                q.status = status;
                if (remarks) q.remarks = remarks;
            }
        },
        setFilters(newFilters) {
            this.filters = { ...this.filters, ...newFilters };
        },
        resetFilters() {
            this.filters = {
                searchText: '',
                program: 'All',
                course_id: 'All',
                question_type_id: 'All',
                status: 'All'
            };
        },
        batchUpdateStatus(fromStatus, toStatus) {
            this.questions.forEach(q => {
                if (q.status === fromStatus) {
                    q.status = toStatus;
                }
            });
        },
        clearAll() {
            this.questions = [];
        }
    }
});
