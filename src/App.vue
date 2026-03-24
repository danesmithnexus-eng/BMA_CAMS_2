<script>
import { mapState, mapActions } from 'pinia';
import { useAuthStore } from './stores/auth';
import { useLayoutStore } from './stores/layout';
import { useUIStore } from './stores/ui';
import * as bootstrap from 'bootstrap';

import Login from './components/Login.vue';
import Sidebar from './components/Sidebar.vue';

export default {
    name: 'App',
    components: {
        Login,
        Sidebar
    },
    data() {
        return {
            isProfileDropdownOpen: false,
            logoutConfirmationBsModal: null,
            appToastInstance: null
        };
    },
    computed: {
        ...mapState(useAuthStore, { currentUser: 'user' }),
        ...mapState(useLayoutStore, ['isSidebarActive']),
        ...mapState(useUIStore, { uiToast: 'toast' }),
        isPilotAdmin() { return ['pilotAdmin', 'manageTest'].includes(this.$route.name); }
    },
    methods: {
        ...mapActions(useAuthStore, ['logout']),
        ...mapActions(useLayoutStore, ['setSidebarActive', 'toggleSidebar']),
        ...mapActions(useUIStore, ['hideToast']),
        
        toggleProfileDropdown() { this.isProfileDropdownOpen = !this.isProfileDropdownOpen; },
        closeProfileDropdown(event) {
            if (this.isProfileDropdownOpen && !event.target.closest('.dropdown')) {
                this.isProfileDropdownOpen = false;
            }
        },
        handleResize() { this.setSidebarActive(window.innerWidth >= 992); },
        handleLogout() { 
            this.isProfileDropdownOpen = false;
            this.logoutConfirmationBsModal?.show();
        },
        confirmLogout() {
            this.logout();
            this.logoutConfirmationBsModal?.hide();
        }
    },
    mounted() {
        this.logoutConfirmationBsModal = bootstrap.Modal.getOrCreateInstance(this.$refs.logoutConfirmationModal);
        window.addEventListener('click', this.closeProfileDropdown);
        window.addEventListener('resize', this.handleResize);
        if (this.$refs.appToast) {
            this.appToastInstance = bootstrap.Toast.getOrCreateInstance(this.$refs.appToast);
            this.$refs.appToast.addEventListener('hidden.bs.toast', () => this.hideToast());
        }
        this.handleResize();
    },
    beforeUnmount() {
        window.removeEventListener('click', this.closeProfileDropdown);
        window.removeEventListener('resize', this.handleResize);
        this.logoutConfirmationBsModal?.dispose();
        this.appToastInstance?.dispose();
    },
    watch: {
        'uiToast': {
            handler() { if (this.uiToast.visible && this.appToastInstance) this.appToastInstance.show(); },
            deep: true
        }
    }
};
</script>

<template>
    <Login v-if="!currentUser" />

    <div v-else id="wrapper" :class="{ 'toggled': !isSidebarActive }">
        <Sidebar />
        <!-- Overlay for mobile sidebar -->
        <div class="overlay d-lg-none" v-if="isSidebarActive" @click="toggleSidebar"></div>
        
        <!-- Page Content -->
        <div id="page-content-wrapper">
            <!-- Top Navbar with Floating Pill Design -->
            <nav class="navbar navbar-expand-lg navbar-light sticky-top px-4 py-3" style="background-color: var(--bg-dark); z-index: 1020;">
                <div class="container-fluid bg-white rounded-pill shadow-sm px-4 py-2 d-flex justify-content-between align-items-center">
                    
                    <!-- Left Side: Toggle & Title (Hidden/Modified to match clean look if needed, keeping toggle for mobile) -->
                    <div class="d-flex align-items-center">
                         <i class="fas fa-bars text-secondary fs-5 me-3 cursor-pointer" id="menu-toggle" @click="toggleSidebar"></i>
                    </div>

                    <!-- Right Side: User Profile -->
                    <div class="d-flex align-items-center gap-3">
                         <div class="dropdown">
                            <a class="nav-link dropdown-toggle d-flex align-items-center gap-2 px-3 py-2 rounded-pill bg-white shadow-sm border" href="#" id="navbarDropdown"
                                role="button" @click.prevent="toggleProfileDropdown" :aria-expanded="isProfileDropdownOpen" style="color: var(--text-primary);">
                                <i class="fas fa-user-circle fs-5"></i>
                                <span class="fw-medium">{{ currentUser.fname }} {{ currentUser.lname }} ({{ currentUser.role }})</span>
                            </a>
                            <ul class="dropdown-menu dropdown-menu-end border-0 shadow-lg mt-2" :class="{ 'show': isProfileDropdownOpen }" aria-labelledby="navbarDropdown" style="border-radius: 12px;">
                                <li><a class="dropdown-item py-2" href="#" @click.prevent="handleLogout"><i class="fas fa-sign-out-alt me-2 text-danger"></i>Logout</a></li>
                            </ul>
                        </div>
                    </div>

                </div>
            </nav>

            <div class="container-fluid px-4">
                <router-view></router-view>
            </div>
        </div>
    </div>

    <!-- MODALS -->
    <Teleport to="body">
        <!-- Logout Confirmation Modal -->
        <div class="modal fade" id="logoutConfirmationModal" tabindex="-1" ref="logoutConfirmationModal">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Confirm Logout</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        Are you sure you want to logout?
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-danger" @click="confirmLogout">Logout</button>
                    </div>
                </div>
            </div>
        </div>

        <div :class="['toast-container position-fixed p-3', isPilotAdmin ? 'top-0 start-50 translate-middle-x' : 'bottom-0 end-0']" style="z-index: 1100;">
            <div
                ref="appToast"
                class="toast align-items-center border-0"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                data-bs-autohide="true"
                data-bs-delay="3000"
                :class="uiToast.class"
            >
                <div class="d-flex">
                    <div class="toast-body">
                        <strong class="me-2">{{ uiToast.title }}</strong>{{ uiToast.message }}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
