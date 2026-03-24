import axios from 'axios';
import { useAuthStore } from "../stores/auth"
import { Network } from '@capacitor/network'
import { enqueueRequest } from './db'

const api = axios.create({
    baseURL: 'http://192.168.100.72:8000/api',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Add token to requests if available
api.interceptors.request.use(async config => {
    const authStore = useAuthStore();
    if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    const status = await Network.getStatus()
    const method = (config.method || 'get').toLowerCase()
    if (!status.connected && method !== 'get') {
        const url = (config.baseURL || '') + (config.url || '')
        const headers = config.headers || {}
        const body = config.data || null
        await enqueueRequest(method, url, body, headers)
        return Promise.reject({ isOfflineQueued: true, config })
    }
    return config;
});

api.interceptors.response.use(
    r => r,
    error => {
        if (error && error.isOfflineQueued) {
            return Promise.resolve({
                data: { offline: true, queued: true },
                status: 202,
                statusText: 'Accepted',
                headers: {},
                config: error.config,
                request: null
            })
        }
        return Promise.reject(error)
    }
)

export default api;
