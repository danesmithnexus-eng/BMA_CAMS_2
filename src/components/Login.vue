<template>
  <div class="login-container position-relative">
    <div class="card login-card text-center p-4">
      <div class="card-body">
        <div v-if="isLoading" class="d-flex justify-content-center align-items-center py-5">
           <div class="loader"> 
             <div></div> 
             <div></div> 
             <div></div> 
             <div></div> 
           </div> 
        </div>
        <div v-else>
          <i class="fas fa-shield-alt fa-3x text-accent mb-3"></i>
          <h3 class="card-title mb-4 fw-bold">BMA Pilot System</h3>

          <div class="mb-3 text-start">
            <label for="email" class="form-label text-muted small text-uppercase fw-bold">Email</label>
            <input type="email" id="email" class="form-control" v-model="loginForm.email"
              placeholder="name@example.com" @keyup.enter="handleLogin">
          </div>
          <div class="mb-3 text-start">
            <label for="password" class="form-label text-muted small text-uppercase fw-bold">Password</label>
            <div class="input-group">
                <input :type="showPassword ? 'text' : 'password'" id="password" class="form-control" v-model="loginForm.password"
                placeholder="password" @keyup.enter="handleLogin">
                <button class="btn btn-outline-secondary" type="button" @click="showPassword = !showPassword">
                    <i class="fas" :class="showPassword ? 'fa-eye-slash' : 'fa-eye'"></i>
                </button>
            </div>
          </div>
          <div v-if="loginError" class="alert alert-danger p-2 small">{{ loginError }}</div>
          <button @click="handleLogin" class="btn btn-primary w-100 mt-3 py-2">Login</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

export default {
    name: 'Login',
    data() {
        return {
            loginForm: { email: '', password: '' },
            loginError: '',
            isLoading: false,
            showPassword: false
        };
    },
    methods: {
        async handleLogin() {
            this.loginError = '';
            this.isLoading = true;
            
            try {
                const response = await api.post('/login', {
                    email: this.loginForm.email,
                    password: this.loginForm.password
                });
                
                if (response.data.token) {
                    const user = response.data.user;
                    // Map backend roles array to user.role property
                    if (response.data.roles && Array.isArray(response.data.roles) && response.data.roles.length > 0) {
                        user.role = response.data.roles[0];
                    }

                    const authStore = useAuthStore();
                    authStore.login(user, response.data.token);
                    const target = user.role === 'Student' ? 'studentDashboard' : 'dashboard';
                    this.$router.push({ name: target });
                } else {
                     this.loginError = 'Login failed: No token received.';
                }
            } catch (error) {
                console.error('Login error:', error);
                this.loginError = error.response?.data?.message || 'Invalid email or password.';
            } finally {
                this.isLoading = false;
            }
        }
    }
}
</script>

<style scoped>
.loader { 
  display: inline-block; 
  position: relative; 
  width: 80px; 
  height: 80px; 
} 

.loader div { 
  position: absolute; 
  top: 33px; 
  width: 13px; 
  height: 13px; 
  border-radius: 50%; 
  background: #176534; 
  animation-timing-function: cubic-bezier(0, 1, 1, 0); 
} 

.loader div:nth-child(1) { 
  left: 8px; 
  animation: flip1 0.6s infinite; 
} 

.loader div:nth-child(2) { 
  left: 8px; 
  animation: flip2 0.6s infinite; 
} 

.loader div:nth-child(3) { 
  left: 32px; 
  animation: flip2 0.6s infinite; 
} 

.loader div:nth-child(4) { 
  left: 56px; 
  animation: flip3 0.6s infinite; 
} 

@keyframes flip1 { 
  0% { 
    transform: scale(0); 
  } 

  100% { 
    transform: scale(1); 
  } 
} 

@keyframes flip3 { 
  0% { 
    transform: scale(1); 
  } 

  100% { 
    transform: scale(0); 
  } 
} 

@keyframes flip2 { 
  0% { 
    transform: translate(0, 0); 
  } 

  100% { 
    transform: translate(24px, 0); 
  } 
} 

.login-container {
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #176534;
}

.login-card {
    width: 100%;
    max-width: 420px;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3);
}

.text-accent {
    color: #176534 !important;
}
</style>
