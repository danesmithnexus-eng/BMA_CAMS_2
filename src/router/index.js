import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

// Import components
import Login from '../components/Login.vue';
import Dashboard from '../components/Dashboard.vue';
import QuestionBank from '../components/QuestionBank.vue';
import Reports from '../components/Reports.vue';
import StudentDashboard from '../components/StudentDashboard.vue';
import TestBuilder from '../components/TestBuilder.vue';
import PilotAdmin from '../components/PilotAdmin.vue';
import TestTaking from '../components/TestTaking.vue';
import UserManagement from '../components/UserManagement.vue';
import Archives from '../components/Archives.vue';
import Courses from '../components/Courses.vue';

const routes = [
    {
        path: '/login',
        name: 'login',
        component: Login,
        meta: { layout: 'fullscreen' }
    },
    {
        path: '/',
        redirect: '/dashboard'
    },
    {
        path: '/dashboard',
        name: 'dashboard',
        component: Dashboard
    },
    {
        path: '/questions',
        name: 'questionBank',
        component: QuestionBank
    },
    {
        path: '/reports',
        name: 'reports',
        component: Reports
    },
    {
        path: '/student',
        name: 'studentDashboard',
        component: StudentDashboard
    },
    {
        path: '/test-builder',
        name: 'testBuilder',
        component: TestBuilder
    },
    {
        path: '/admin',
        name: 'pilotAdmin',
        component: PilotAdmin
    },
    {
        path: '/admin/manage',
        name: 'manageTest',
        component: PilotAdmin
    },
    {
        path: '/test-taking/:id?',
        name: 'testTaking',
        component: TestTaking
    },
    {
        path: '/test-review',
        name: 'testReview',
        component: TestTaking
    },
    {
        path: '/reports/detail',
        name: 'reportDetail',
        component: Reports
    },
    {
        path: '/reports/student-result',
        name: 'studentResultDetail',
        component: Reports
    },
    {
        path: '/users',
        name: 'userManagement',
        component: UserManagement
    },
    {
        path: '/archives',
        name: 'archives',
        component: Archives
    },
    {
        path: '/courses',
        name: 'courses',
        component: Courses
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();
    const publicPages = ['login'];
    const authRequired = !publicPages.includes(to.name);

    // If logged in and trying to access login page, redirect to dashboard
    if (to.name === 'login' && authStore.isAuthenticated) {
        return next('/dashboard');
    }

    // If auth required and not logged in, redirect to login
    if (authRequired && !authStore.isAuthenticated) {
        return next('/login');
    }

    next();
});

export default router;
