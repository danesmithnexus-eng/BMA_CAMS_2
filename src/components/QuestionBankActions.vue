<script>
import { mapState } from 'pinia';
import { useAuthStore } from '../stores/auth';

export default {
    name: 'QuestionBankActions',
    
    props: {
        hasDrafts: {
            type: Boolean,
            default: false
        },
        hasPendingValidation: {
            type: Boolean,
            default: false
        },
        hasPendingApproval: {
            type: Boolean,
            default: false
        }
    },

    emits: [
        'submit-all-drafts',
        'delete-all-drafts',
        'bulk-upload',
        'add-question',
        'validate-all',
        'invalidate-all',
        'approve-all',
        'disapprove-all'
    ],

    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' })
    },

    watch: {
        hasDrafts(newVal) {
            console.log('hasDrafts changed:', newVal);
        }
    },

    methods: {
        isAdmin() {
            return this.currentUser?.role === 'Admin';
        },
        isAssessor() {
            return this.currentUser?.role === 'Assessor';
        },
        isCollecting() {
            return this.currentUser?.role === 'Collecting Officer';
        },
        isReview() {
            return this.currentUser?.role === 'Review Committee';
        }
    }
};
</script>

<template>
    <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap">
        <h2 class="mb-2 me-auto">Question Bank</h2>
        
        <!-- Faculty/Admin/Assessor Actions -->
        <div v-if="currentUser.role === 'Faculty' || currentUser.role === 'Admin' || currentUser.role === 'Assessor'" 
             class="d-flex flex-wrap">
            <button class="btn btn-outline-success me-2 mb-2" 
                    @click="$emit('submit-all-drafts')"
                    :disabled="!hasDrafts"
                    type="button">
                <i class="fas fa-check-double me-2"></i>Submit All Drafts
            </button>
            <button class="btn btn-outline-danger me-2 mb-2" 
                    @click="$emit('delete-all-drafts')"
                    :disabled="!hasDrafts"
                    type="button">
                <i class="fas fa-trash-alt me-2"></i>Delete All Drafts
            </button>
            <button class="btn btn-info me-2 mb-2" @click="$emit('bulk-upload')" type="button">
                <i class="fas fa-upload me-2"></i>Bulk Upload
            </button>
            <button class="btn btn-primary mb-2" @click="$emit('add-question')" type="button">
                <i class="fas fa-plus me-2"></i>Add Question
            </button>
        </div>

        <!-- Collecting Officer/Admin/Assessor Actions -->
        <div v-if="(currentUser.role === 'Collecting Officer' || currentUser.role === 'Admin' || currentUser.role === 'Assessor') && hasPendingValidation"
             class="d-flex flex-wrap">
            <button class="btn btn-outline-success me-2 mb-2" @click="$emit('validate-all')" type="button">
                <i class="fas fa-check-double me-2"></i>Validate All
            </button>
            <button class="btn btn-outline-danger me-2 mb-2" @click="$emit('invalidate-all')" type="button">
                <i class="fas fa-times-circle me-2"></i>Invalidate All
            </button>
        </div>

        <!-- Review Committee/Admin/Assessor Actions -->
        <div v-if="(currentUser.role === 'Review Committee' || currentUser.role === 'Admin' || currentUser.role === 'Assessor') && hasPendingApproval"
             class="d-flex flex-wrap">
            <button class="btn btn-outline-success me-2 mb-2" @click="$emit('approve-all')" type="button">
                <i class="fas fa-check-double me-2"></i>Approve All
            </button>
            <button class="btn btn-outline-danger me-2 mb-2" @click="$emit('disapprove-all')" type="button">
                <i class="fas fa-times-circle me-2"></i>Disapprove All
            </button>
        </div>
    </div>
</template>

<style scoped>

</style>
