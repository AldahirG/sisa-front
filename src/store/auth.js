import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
    state: () => ({
        token: localStorage.getItem('token') || null,
        user: (() => { try { const u = localStorage.getItem('user'); return u && u !== 'undefined' ? JSON.parse(u) : null; } catch { return null; } })()
    }),

    getters: {
        isAuthenticated: (state) => !!state.token,
        role: (state) => state.user?.rol || null
    },

    actions: {
        login(token, user) {
            this.token = token;
            this.user = user;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
        },

        logout() {
            this.token = null;
            this.user = null;

            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }
});
