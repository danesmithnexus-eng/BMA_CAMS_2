import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null)
    const token = ref(null)

    const login = (userData, authToken) => {
        user.value = userData
        token.value = authToken
    }

    const logout = () => {
        user.value = null
        token.value = null
    }

    const isAuthenticated = computed(() => !!token.value)

    return { user, token, login, logout, isAuthenticated }
}, {
    persist: true
})
