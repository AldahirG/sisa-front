import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';

// Stores
import { useAuthStore } from '@/store/auth';

// ================================
// AUTH
// ================================
import Login from '@/views/pages/auth/Login.vue';

// ================================
// VISTAS COMPARTIDAS
// ================================
const CalendarView = () => import('@/views/Calendar.vue');
const PerfilView = () => import('@/views/Perfil.vue');

// ================================
// VISTAS ALUMNO
// ================================
const AlumnoDashboard = () => import('@/views/alumno/Dashboard.vue');
const AlumnoVacantes = () => import('@/views/alumno/Vacantes.vue');
const AlumnoEntregables = () => import('@/views/alumno/Entregables.vue');
const AlumnoEncuesta = () => import('@/views/alumno/Encuesta.vue');
const AlumnoHistorial = () => import('@/views/alumno/Historial.vue');

// ================================
// VISTAS ADMIN
// ================================
const AdminDashboard = () => import('@/views/admin/Dashboard.vue');
const AdminPeriodos = () => import('@/views/admin/Periodos.vue');
const AdminEntregables = () => import('@/views/admin/Entregables.vue');
const AdminEmpresas = () => import('@/views/admin/Empresas.vue');
const AdminEvaluaciones = () => import('@/views/admin/Evaluaciones.vue');
const AdminHistorial = () => import('@/views/admin/Historial.vue');
const AdminVacantes = () => import('@/views/admin/Vacantes.vue');
const AdminPostulaciones = () => import('@/views/admin/Postulaciones.vue');
const AdminControlAcademico = () => import('@/views/admin/ControlAcademico.vue');
const AdminControlAcademicoDetalle = () => import('@/views/admin/ControlAcademicoDetalle.vue');
const AdminControlUsuarios = () => import('@/views/admin/Alumnos.vue');

// ================================
// ROUTES
// ================================
const routes = [
    // ------------------------
    // AUTH
    // ------------------------
    {
        path: '/login',
        name: 'login',
        component: Login
    },

    // ------------------------
    // RUTAS COMPARTIDAS (AUTH)
    // ------------------------
    {
        path: '/',
        component: AppLayout,
        meta: { requiresAuth: true },
        children: [
            {
                path: 'calendar',
                name: 'calendar',
                component: CalendarView
            },
            {
                path: 'perfil',
                name: 'perfil',
                component: PerfilView
            }
        ]
    },

    // ------------------------
    // ALUMNO
    // ------------------------
    {
        path: '/alumno',
        component: AppLayout,
        meta: { requiresAuth: true, role: 'alumno' },
        children: [
            {
                path: '',
                redirect: '/alumno/dashboard'
            },
            {
                path: 'dashboard',
                name: 'alumno-dashboard',
                component: AlumnoDashboard
            },
            {
                path: 'vacantes',
                name: 'alumno-vacantes',
                component: AlumnoVacantes
            },
            {
                path: 'entregables',
                name: 'alumno-entregables',
                component: AlumnoEntregables
            },
            {
                path: 'historial',
                name: 'alumno-historial',
                component: AlumnoHistorial
            },
            {
                path: 'encuesta',
                name: 'alumno-encuesta',
                component: AlumnoEncuesta
            }
        ]
    },

    // ------------------------
    // ADMIN
    // ------------------------
    {
        path: '/admin',
        component: AppLayout,
        meta: { requiresAuth: true, role: 'admin' },
        children: [
            {
                path: '',
                redirect: '/admin/dashboard'
            },
            {
                path: 'dashboard',
                name: 'admin-dashboard',
                component: AdminDashboard
            },
            {
                path: 'periodos',
                name: 'admin-periodos',
                component: AdminPeriodos
            },
            {
                path: 'entregables',
                name: 'admin-entregables',
                component: AdminEntregables
            },
            {
                path: 'empresas',
                name: 'admin-empresas',
                component: AdminEmpresas
            },

            {
                path: 'vacantes',
                name: 'admin-vacantes',
                component: AdminVacantes
            },

            {
                path: 'evaluaciones',
                name: 'admin-evaluaciones',
                component: AdminEvaluaciones
            },
            {
                path: 'historial',
                name: 'admin-historial',
                component: AdminHistorial
            },
            {
                path: 'postulaciones',
                name: 'admin-postulaciones',
                component: AdminPostulaciones
            },
            {
                path: 'control-academico',
                name: 'admin-control-academico',
                component: AdminControlAcademico
            },
            {
                path: 'control-academico/:id',
                name: 'admin-control-academico-detalle',
                component: AdminControlAcademicoDetalle,
                props: true
            },
            {
                path: 'alumnos',
                name: 'admin-control-alumnos',
                component: AdminControlUsuarios
            }
        ]
    },

    // ------------------------
    // FALLBACK
    // ------------------------
    {
        path: '/:pathMatch(.*)*',
        redirect: '/login'
    }
];

// ================================
// ROUTER
// ================================
const router = createRouter({
    history: createWebHistory(),
    routes
});

// ================================
// GUARD GLOBAL
// ================================
router.beforeEach((to) => {
    const auth = useAuthStore();

    // Ruta protegida sin login
    if (to.meta.requiresAuth && !auth.token) {
        return '/login';
    }

    // Validación de rol (si aplica)
    if (to.meta.role && auth.user?.rol !== to.meta.role) {
        return '/login';
    }

    return true;
});

export default router;
