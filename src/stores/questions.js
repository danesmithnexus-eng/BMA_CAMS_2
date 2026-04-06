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
        hasDrafts: (state) => state.questions.some(q => {
            const s = (q.status || '').toString().toLowerCase();
            return s === 'draft';
        }),
        hasPendingValidation: (state) => state.questions.some(q => {
            const s = (q.status || '').toString().toLowerCase();
            return s === 'pending_validation' || s === 'pending validation' || s === 'inactive';
        }),
        hasPendingApproval: (state) => state.questions.some(q => {
            const s = (q.status || '').toString().toLowerCase();
            return s === 'pending_approval' || s === 'pending approval' || s === 'validated';
        }),
        approvedQuestions: (state) => state.questions.filter(q => {
            const s = (q.status || '').toString().toLowerCase();
            return s === 'active' || s === 'approved';
        })
    },
    actions: {
        addQuestion(question) {
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
                // Always update remarks — clears old remarks when resubmitting
                q.remarks = remarks;
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
            const canonical = (s) => {
                const val = (s || '').toString().toLowerCase();
                if (val === 'draft') return 'Draft';
                if (val === 'pending_validation' || val === 'pending validation' || val === 'inactive') return 'Pending Validation';
                if (val === 'pending_approval' || val === 'pending approval' || val === 'validated') return 'Pending Approval';
                if (val === 'active' || val === 'approved') return 'Approved';
                return 'Draft';
            };
            
            const target = canonical(fromStatus);
            this.questions.forEach(q => {
                if (canonical(q.status) === target) {
                    q.status = toStatus;
                }
            });
        },
        // FIX: only clears questions matching the given status, not everything
        clearAll(status) {
            if (status) {
                const target = status.toString().toLowerCase();
                this.questions = this.questions.filter(q => {
                    const s = (q.status || '').toString().toLowerCase();
                    // Keep the question if its status DOES NOT match the target status to be cleared
                    return s !== target;
                });
            } else {
                this.questions = [];
            }
        }
    }
});