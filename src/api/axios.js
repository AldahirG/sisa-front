import { useAuthStore } from '@/store/auth';
import axios from 'axios';
import { MOCK_ROUTES } from '@/data/mock';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000'
});

api.interceptors.request.use((config) => {
    const auth = useAuthStore();
    if (auth.token) {
        config.headers.Authorization = `Bearer ${auth.token}`;
    }
    return config;
});

// Mock interceptor — returns static data when backend unavailable
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const url = error.config?.url?.split('?')[0];

        // Sort routes by length desc so most specific matches first
        const sortedRoutes = Object.keys(MOCK_ROUTES).sort((a, b) => b.length - a.length);

        const match = sortedRoutes.find(route =>
            url === route || url?.startsWith(route.endsWith('/') ? route : route + '/')
        );

        if (match) {
            return Promise.resolve({
                data: MOCK_ROUTES[match].data,
                status: 200,
                config: error.config,
            });
        }

        const method = error.config?.method?.toLowerCase();
        if (['post', 'put', 'patch', 'delete'].includes(method)) {
            return Promise.resolve({
                data: { message: 'Demo mode — operación simulada' },
                status: 200,
                config: error.config,
            });
        }

        return Promise.reject(error);
    }
);

export default api;
