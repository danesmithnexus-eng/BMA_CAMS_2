import { defineStore } from 'pinia';
import api from '../services/api';

export const useUserStore = defineStore('users', {
    state: () => ({
        users: []
    }),
    actions: {
        // Fetch all users from backend
        async fetchUsers() {
            try {
                const response = await api.get('/users');

                this.users = response.data?.data || response.data || [];
            } catch (error) {
                console.error('Error fetching users:', error);
                throw error;
            }
        },

        // Save or update a user
        async saveUser(user) {
            const userData = { ...user };

            // Convert role name to role ID if needed
            if (userData.role && isNaN(userData.role)) {
                userData.role = this.getRoleId(userData.role);
            }

            console.log('Saving user data:', userData); // Debug log

            try {
                if (user.id) {
                    // Update existing user
                    if (!userData.password) delete userData.password;
                    const response = await api.put(`/users/${user.id}`, userData);
                    console.log('Update response:', response.data); // Debug log
                } else {
                    // Create new user
                    const response = await api.post('/users', userData);
                    console.log('Create response:', response.data); // Debug log
                }

                // ✅ Refresh the users list after save
                await this.fetchUsers();

            } catch (error) {
                console.error('Error saving user:', error);
                throw error;
            }
        },

        // Delete a user by ID
        async deleteUser(id) {
            try {
                await api.delete(`/users/${id}`);
                // Refresh users list
                await this.fetchUsers();
            } catch (error) {
                console.error('Error deleting user:', error);
                throw error;
            }
        },

        // Map role name to numeric role ID
        getRoleId(roleName) {
            const map = {
                'Admin': 1,
                'Faculty': 2,
                'Assessor': 3,
                'Collecting Officer': 4,
                'Review Committee': 5,
                'Student': 6
            };
            return map[roleName] || 3;
        }
    }
});
