<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">User Management</h2>
      <button class="btn btn-primary" @click="openAddUserModal">
        <i class="fas fa-plus me-2"></i>Add User
      </button>
    </div>

    <!-- Filters -->
    <div class="card mb-3">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-3">
            <label class="form-label">Search</label>
            <input
              type="text"
              class="form-control"
              v-model="userFilters.search"
              placeholder="Search by name, email..."
            />
          </div>
          <div class="col-md-3">
            <label class="form-label">Role</label>
            <select class="form-select" v-model="userFilters.role">
              <option value="All">All Roles</option>
              <option>Admin</option>
              <option>Faculty</option>
              <option>Assessor</option>
              <option>Collecting Officer</option>
              <option>Review Committee</option>
              <option>Student</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Class</label>
            <input
              type="text"
              class="form-control"
              v-model="userFilters.class"
              placeholder="Filter by class (e.g. 4-Alpha)"
            />
          </div>
          <div class="col-md-3">
            <label class="form-label">Sort</label>
            <select class="form-select" v-model="userFilters.sort">
              <option value="0-9">ID (0-9)</option>
              <option value="A-Z">Name (A-Z)</option>
              <option value="Z-A">Name (Z-A)</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Users Table -->
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
              <tr v-for="user in filteredUsers" :key="user.id">
                <td>{{ user.id }}</td>
                <td>
                  {{ user.fullname || user.name || user.user || `${user.fname || ''} ${user.mname || ''} ${user.lname || ''}`.trim() }}
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
                  <!-- Debug: {{ user.program }} / {{ user.program_id }} / {{ user.student?.program_id }} -->
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
                  <button class="btn btn-sm btn-outline-primary me-1" @click="openEditUserModal(user)">
                    Edit
                  </button>
                  <button class="btn btn-sm btn-outline-danger" @click="openArchiveUserConfirmation(user)">
                    <i class="fas fa-trash me-1"></i>Remove
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="filteredUsers.length === 0" class="text-center py-4 text-muted">
          No users found matching your filters.
        </div>
      </div>
    </div>

    <!-- User Editor Modal -->
    <Teleport to="body">
      <div class="modal fade" id="userEditorModal" tabindex="-1" ref="userEditorModal">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ editingUser.id ? 'Edit User' : 'Add New User' }}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <!-- Names -->
              <div class="mb-3">
                <label class="form-label">First Name</label>
                <input type="text" class="form-control" v-model="editingUser.fname" placeholder="First Name" />
              </div>
              <div class="mb-3">
                <label class="form-label">Middle Name <span class="text-muted small">(Optional)</span></label>
                <input type="text" class="form-control" v-model="editingUser.mname" placeholder="Middle Name" />
              </div>
              <div class="mb-3">
                <label class="form-label">Last Name</label>
                <input type="text" class="form-control" v-model="editingUser.lname" placeholder="Last Name" />
              </div>

              <!-- Email & Username -->
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" v-model="editingUser.email" placeholder="Email Address" />
              </div>
              <div class="mb-3">
                <label class="form-label">Username</label>
                <input type="text" class="form-control" v-model="editingUser.username" placeholder="Username" />
              </div>

              <!-- Role -->
              <div class="mb-3">
                <label class="form-label">Role</label>
                <select class="form-select" v-model="editingUser.role">
                  <option>Admin</option>
                  <option>Faculty</option>
                  <option>Assessor</option>
                  <option>Collecting Officer</option>
                  <option>Review Committee</option>
                  <option>Student</option>
                </select>
              </div>

              <!-- Student fields -->
              <div v-if="editingUser.role === 'Student'">
                <div class="row g-3">
                  <div class="col-md-4">
                    <label class="form-label">Year</label>
                    <input type="text" class="form-control" v-model="editingUser.year_level" placeholder="e.g. 4" />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Class</label>
                    <input type="text" class="form-control" v-model="editingUser.class_name" placeholder="e.g. Alpha" />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Program</label>
                    <select class="form-select" v-model="editingUser.program_id">
                      <option value="">Select Program</option>
                      <option value="6">BSMT</option>
                      <option value="5">BSMarE</option>
                    </select>
                  </div>
                </div>
                <div class="mt-3">
                  <label class="form-label">Student Number</label>
                  <input type="text" class="form-control" v-model="editingUser.student_number" placeholder="Student number" />
                </div>
              </div>

              <!-- Password -->
              <hr>
              <div class="mb-3">
                <div class="form-check mb-2">
                  <input class="form-check-input" type="checkbox" id="changePasswordCheck" v-model="showUserPassword" />
                  <label class="form-check-label" for="changePasswordCheck">
                    {{ editingUser.id ? 'Change Password' : 'Set Password' }}
                  </label>
                </div>
                <div v-if="showUserPassword">
                  <input type="password" class="form-control mb-2" v-model="editingUser.password" placeholder="New Password" />
                </div>
                <div v-if="editingUser.id && !showUserPassword" class="d-flex align-items-center">
                  <small class="text-muted me-2">Password hidden.</small>
                  <button class="btn btn-sm btn-link p-0" @click="revealPassword(editingUser.id)">Reveal current</button>
                  <span v-if="isPasswordRevealed" class="ms-2 fw-bold">{{ revealedPassword }}</span>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-primary" @click="handleUserAction('save')">{{ editingUser.id ? 'Update User' : 'Save User' }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Archive User Confirmation Modal -->
    <Teleport to="body">
      <div class="modal fade" id="archiveUserConfirmationModal" tabindex="-1" ref="archiveUserConfirmationModal">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Confirm Archive User</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              Are you sure you want to archive user <strong>{{ editingUser.fname }} {{ editingUser.lname }}</strong>?<br>
              <small class="text-muted">Archived users can be restored from the Archives page.</small>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-warning" @click="handleUserAction('archive')">
                <i class="fas fa-archive me-1"></i>Archive
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div class="modal fade" id="userNotificationModal" tabindex="-1" ref="userNotificationModal">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header" :class="notificationType === 'success' ? 'bg-success text-white' : 'bg-danger text-white'">
              <h5 class="modal-title">{{ notificationTitle }}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="mb-0">{{ notificationMessage }}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { useUserStore } from '../stores/users';
import { useUIStore } from '../stores/ui';
import * as bootstrap from 'bootstrap';
import api from '../services/api';

export default {
  name: 'UserManagement',
  data() {
    return {
      userFilters: { search: '', role: 'All', class: '', sort: '0-9' },
      editingUser: {},
      showUserPassword: false,
      isPasswordRevealed: false,
      revealedPassword: '',
      userEditorBsModal: null,
      archiveUserConfirmationBsModal: null,
      userNotificationBsModal: null,
      notificationTitle: '',
      notificationMessage: '',
      notificationType: 'error'
    };
  },
  computed: {
    ...mapState(useUserStore, ['users']),
    filteredUsers() {
      if (!this.users) return [];
      return this.users
        .filter(u => {
          const fname = u.fname || (u.fullname ? u.fullname.split(' ')[0] : (u.name ? u.name.split(' ')[0] : ''));
          const lname = u.lname || (u.fullname ? u.fullname.split(' ').slice(1).join(' ') : (u.name ? u.name.split(' ').slice(1).join(' ') : ''));
          const fullName = (u.fullname || u.name || `${fname} ${u.mname || ''} ${lname}`).toLowerCase();

          const matchesSearch = fullName.includes(this.userFilters.search.toLowerCase()) ||
            (u.email && u.email.toLowerCase().includes(this.userFilters.search.toLowerCase()));

          const currentRole = u.role || u.roles || '';
          const matchesRole = this.userFilters.role === 'All' || currentRole === this.userFilters.role;

          const year_level = `${u.year_level || ''} ${u.class_name || ''}`.toLowerCase();
          const matchesClass = !this.userFilters.class || year_level.includes(this.userFilters.class.toLowerCase());

          return matchesSearch && matchesRole && matchesClass;
        })
        .sort((a, b) => {
          const nameA = a.fullname || a.name || `${a.fname} ${a.lname}`;
          const nameB = b.fullname || b.name || `${b.fname} ${b.lname}`;
          if (this.userFilters.sort === 'A-Z') return nameA.localeCompare(nameB);
          if (this.userFilters.sort === 'Z-A') return nameB.localeCompare(nameA);
          return a.id - b.id;
        });
    }
  },
  methods: {
    ...mapActions(useUserStore, ['fetchUsers', 'saveUser', 'deleteUser', 'getRoleId']),
    ...mapActions(useUIStore, ['showToast']),
    showNotification(title, message, type = 'error') {
      this.notificationTitle = title;
      this.notificationMessage = message;
      this.notificationType = type;
      if (this.userNotificationBsModal) this.userNotificationBsModal.show();
    },

    openAddUserModal() {
      this.editingUser = {
        role: 'Student',
        year_level: '',
        class_name: '',
        program_id: '',
        student_number: '',
        username: ''
      };
      this.showUserPassword = false;
      if (this.userEditorBsModal) this.userEditorBsModal.show();
    },

    async openEditUserModal(user) {
      this.editingUser = { ...user };

      // Normalize role to string
      const roleMap = { 1:'Admin', 2:'Faculty', 3:'Assessor', 4:'Collecting Officer', 5:'Review Committee', 6:'Student' };
      if (typeof this.editingUser.role === 'number') {
        this.editingUser.role = roleMap[this.editingUser.role] || 'Student';
      } else if (this.editingUser.userRole) {
        this.editingUser.role = roleMap[this.editingUser.userRole] || 'Student';
      } else if (this.editingUser.roles) {
        this.editingUser.role = this.editingUser.roles;
      }

      // Split fullname into fname/mname/lname if missing
      if (!this.editingUser.fname || !this.editingUser.lname) {
        const fullNameStr = (this.editingUser.fullname || this.editingUser.name || '').trim();
        if (fullNameStr) {
          const parts = fullNameStr.split(/\s+/);
          this.editingUser.fname = parts[0] || '';
          this.editingUser.mname = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
          this.editingUser.lname = parts.length > 1 ? parts[parts.length - 1] : '';
        }
      }

      // Pre-fill Student fields - check both flat fields and nested student object
      if (this.editingUser.role === 'Student') {
        // Try nested student object first, then fall back to flat fields
        const studentData = user.student || {};
        this.editingUser.year_level = studentData.year_level || user.year_level || '';
        this.editingUser.class_name = studentData.class_name || user.class_name || '';
        // Ensure program_id is a string for the select element
        this.editingUser.program_id = user.program_id ? String(user.program_id) : '';
        this.editingUser.student_number = studentData.student_number || user.student_number || '';
      } else {
        this.editingUser.year_level = '';
        this.editingUser.class_name = '';
        this.editingUser.program_id = '';
        this.editingUser.student_number = '';
      }

      this.editingUser.username = this.editingUser.username || '';
      this.editingUser.password = '';
      this.showUserPassword = false;
      this.isPasswordRevealed = false;
      this.revealedPassword = '';

      if (this.userEditorBsModal) this.userEditorBsModal.show();
    },

    openArchiveUserConfirmation(user) {
      this.editingUser = user;
      if (this.archiveUserConfirmationBsModal) this.archiveUserConfirmationBsModal.show();
    },

    async revealPassword(id) {
      try {
        const response = await api.get(`/users/${id}`);
        this.revealedPassword = response.data.password || '******';
        this.isPasswordRevealed = true;
      } catch (error) {
        this.showToast('Error', 'Failed to retrieve password.', 'error');
      }
    },

    async handleUserAction(actionType) {
      if (actionType === 'save') {
        if (!this.editingUser.fname || !this.editingUser.lname || !this.editingUser.email || !this.editingUser.role || !this.editingUser.username) {
          this.showToast('Error', 'Please fill in all required fields.', 'error');
          return;
        }
        await this.handleSave();
      } else if (actionType === 'archive') {
        await this.handleArchive();
      }
    },

    async handleSave() {
      try {
        // Prepare user data for saving
        const userData = { ...this.editingUser };
        const changedPassword = Boolean(userData.id && userData.password && String(userData.password).length > 0);
        
        // Remove any backend-computed fields that shouldn't be sent
        delete userData.yearAndClass;
        delete userData.fullname;
        delete userData.role_id;
        delete userData.student;
        
        // Ensure student fields are empty strings if not set (for non-students)
        if (userData.role !== 'Student') {
          userData.year_level = '';
          userData.class_name = '';
          userData.program_id = '';
          userData.student_number = '';
        }
        
        console.log('Sending user data to update:', userData);
        await this.saveUser(userData);
        if (changedPassword) {
          this.showNotification('Success', 'Password changed successfully.', 'success');
        } else {
          this.showToast('Success', userData.id ? 'User updated successfully.' : 'User added successfully.', 'success');
        }
        if (this.userEditorBsModal) this.userEditorBsModal.hide();
      } catch (error) {
        console.error('Error saving user:', error);
        console.error('Error response:', error.response?.data);
        const errorMsg = error.response?.data?.message || error.response?.data?.errors ? JSON.stringify(error.response?.data?.errors) : 'Failed to save user.';
        this.showToast('Error', errorMsg, 'error');
      }
    },

    async handleArchive() {
      try {
        await this.deleteUser(this.editingUser.id);
        this.showToast('Success', 'User archived successfully.', 'success');
        if (this.archiveUserConfirmationBsModal) this.archiveUserConfirmationBsModal.hide();
      } catch (error) {
        console.error('Error archiving user:', error);
        this.showToast('Error', 'Failed to archive user.', 'error');
      }
    }
  },

  mounted() {
    if (this.$refs.userNotificationModal) {
      this.userNotificationBsModal = new bootstrap.Modal(this.$refs.userNotificationModal);
    }
    this.fetchUsers().catch(() => {
      this.showNotification('Fetch Failed', 'Unable to load users from the database.', 'error');
    });
    if (this.$refs.userEditorModal) {
      this.userEditorBsModal = new bootstrap.Modal(this.$refs.userEditorModal);
    }
    if (this.$refs.archiveUserConfirmationModal) {
      this.archiveUserConfirmationBsModal = new bootstrap.Modal(this.$refs.archiveUserConfirmationModal);
    }
  },

  beforeUnmount() {
    if (this.userEditorBsModal) this.userEditorBsModal.dispose();
    if (this.archiveUserConfirmationBsModal) this.archiveUserConfirmationBsModal.dispose();
  }
};
</script>
