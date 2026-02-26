<template>
    <nav class="sidebar" :class="{ active: isSidebarActive }">
        <div class="sidebar-header d-flex justify-content-between align-items-center">
            <h5><i class="fas fa-flask-vial"></i> BMA Pilot System</h5>
            <i class="fas fa-times d-lg-none" @click="setSidebarActive(false)" style="cursor: pointer;"></i>
        </div>
        <ul class="nav flex-column">
            <template v-if="currentUser.role === 'Student'">
                <li class="nav-item">
                    <a class="nav-link" :class="{ active: currentView === 'studentDashboard' }"
                        @click="setView('studentDashboard')">
                        <i class="fas fa-tasks fa-fw"></i> My Assigned Tests
                    </a>
                </li>
            </template>
            <template v-else>
                <li class="nav-item">
                    <a class="nav-link" :class="{ active: currentView === 'dashboard' }" @click="setView('dashboard')">
                        <i class="fas fa-tachometer-alt fa-fw"></i> Dashboard
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" :class="{ active: currentView === 'questionBank' }"
                        @click="setView('questionBank')">
                        <i class="fas fa-database fa-fw"></i> Question Bank
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" :class="{ active: currentView === 'courses' }"
                        @click="setView('courses')">
                        <i class="fas fa-book fa-fw"></i> Courses
                    </a>
                </li>
                <li class="nav-item" v-if="['Faculty', 'Admin', 'Assessor'].includes(currentUser.role)">
                    <a class="nav-link" :class="{ active: currentView === 'testBuilder' }"
                        @click="setView('testBuilder')">
                        <i class="fas fa-file-alt fa-fw"></i> Test Builder
                    </a>
                </li>
                <li class="nav-item" v-if="['Faculty', 'Admin', 'Assessor'].includes(currentUser.role)">
                    <a class="nav-link" :class="{ active: currentView === 'pilotAdmin' }"
                        @click="setView('pilotAdmin')">
                        <i class="fas fa-cogs fa-fw"></i> Pilot Administration
                    </a>
                </li>
                <li class="nav-item" v-if="['Faculty', 'Admin', 'Assessor'].includes(currentUser.role)">
                    <a class="nav-link" :class="{ active: currentView === 'reports' }" @click="setView('reports')">
                        <i class="fas fa-chart-pie fa-fw"></i> Reports & Analysis
                    </a>
                </li>
                <template v-if="currentUser.role === 'Admin'">
                    <hr class="mx-3 my-2 border-secondary">
                    <li class="nav-item">
                        <a class="nav-link" :class="{ active: currentView === 'userManagement' }"
                            @click="setView('userManagement')">
                            <i class="fas fa-users fa-fw"></i> User Management
                        </a>
                    </li>
                </template>
            </template>
        </ul>
    </nav>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useLayoutStore } from '../stores/layout';

export default {
    name: 'Sidebar',
    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useLayoutStore, ['isSidebarActive']),
        currentView() {
            return this.$route.name;
        }
    },
    methods: {
        ...mapActions(useLayoutStore, ['setSidebarActive']),
        setView(viewName) {
            this.$router.push({ name: viewName });
            if (window.innerWidth < 992) {
                this.setSidebarActive(false);
            }
        }
    }
}
</script>


