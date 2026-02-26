import axios from 'axios';
import { useAuthStore } from "../stores/auth"

const api = axios.create({
    baseURL: 'http://192.168.100.72:8000/api',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Add token to requests if available
api.interceptors.request.use(config => {
    const authStore = useAuthStore();
    if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    return config;
});

export default api;
