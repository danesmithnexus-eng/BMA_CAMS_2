<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Archives</h2>
      <button class="btn btn-secondary" @click="goToUserManagement">
        <i class="fas fa-arrow-left me-2"></i>Back to User Management
      </button>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="table-responsive">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fullname</th>
                <th>Email</th>
                <th>Role</th>
                <th>Year</th>
                <th>Class</th>
                <th>Program</th>
                <th>Student Number</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in archivedUsers" :key="user.id">
                <td>{{ user.id }}</td>
                <td>
                  {{ user.fullname || user.name || `${user.fname || ''} ${user.mname || ''} ${user.lname || ''}`.trim() }}
                </td>
                <td>{{ user.email }}</td>
                <td>{{ user.role || user.roles }}</td>
                <td>
                  <span v-if="user.year_level || (user.student && user.student.year_level)">
                    {{ user.year_level || (user.student && user.student.year_level) }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <span v-if="user.class_name || (user.student && user.student.class_name)">
                    {{ user.class_name || (user.student && user.student.class_name) }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <span v-if="user.program">{{ user.program }}</span>
                  <span v-else-if="user.program_id === '6' || user.program_id === 6">BSMT</span>
                  <span v-else-if="user.program_id === '5' || user.program_id === 5">BSMarE</span>
                  <span v-else-if="user.student && user.student.program_id">
                    {{ user.student.program_id === '6' || user.student.program_id === 6 ? 'BSMT' : 'BSMarE' }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <span v-if="user.student_number || (user.student && user.student.student_number)">
                    {{ user.student_number || (user.student && user.student.student_number) }}
                  </span>
                  <span v-else class="text-muted">-</span>
                </td>
                <td>
                  <button class="btn btn-sm btn-outline-success" @click="restoreUser(user)">
                    <i class="fas fa-undo me-1"></i>Restore
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="archivedUsers.length === 0" class="text-center py-4 text-muted">
          No archived users found.
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapActions } from 'pinia';
import { useUIStore } from '../stores/ui';
import api from '../services/api';

export default {
  name: 'Archives',
  data() {
    return {
      archivedUsers: []
    };
  },
  methods: {
    ...mapActions(useUIStore, ['showToast']),

    async fetchArchivedUsers() {
      try {
        console.log('Fetching archived users from:', '/users/archived/list');
        const response = await api.get('/users/archived/list');
        console.log('Archived users response:', response.data);
        this.archivedUsers = response.data;
      } catch (error) {
        console.error('Error fetching archived users:', error);
        console.error('Error response:', error.response);
        this.showToast('Error', 'Failed to fetch archived users.', 'error');
      }
    },

    async restoreUser(user) {
      try {
        await api.post(`/users/${user.id}/restore`);
        this.showToast('Success', 'User restored successfully.', 'success');
        // Remove from list
        this.archivedUsers = this.archivedUsers.filter(u => u.id !== user.id);
      } catch (error) {
        console.error('Error restoring user:', error);
        this.showToast('Error', 'Failed to restore user.', 'error');
      }
    },

    goToUserManagement() {
      this.$router.push({ name: 'userManagement' });
    }
  },
  mounted() {
    this.fetchArchivedUsers();
  }
};
</script>
