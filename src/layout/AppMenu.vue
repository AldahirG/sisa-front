<script setup>
import { useAuthStore } from '@/store/auth';
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import PanelMenu from 'primevue/panelmenu';

const router = useRouter();
const auth = useAuthStore();

/**
 * =========================
 * MENÚ ADMIN
 * =========================
 */
const adminMenu = [
    {
        label: 'Dashboard',
        icon: 'pi pi-home',
        command: () => router.push('/admin/dashboard')
    },
    {
        label: 'Gestión Académica',
        icon: 'pi pi-briefcase',
        items: [
            {
                label: 'Periodos',
                icon: 'pi pi-calendar',
                command: () => router.push('/admin/periodos')
            },
            {
                label: 'Entregables',
                icon: 'pi pi-file',
                command: () => router.push('/admin/entregables')
            },
            {
                label: 'Evaluaciones',
                icon: 'pi pi-star',
                command: () => router.push('/admin/evaluaciones')
            },
            {
                label: 'Control Académico',
                icon: 'pi pi-graduation-cap',
                command: () => router.push('/admin/control-academico')
            }
        ]
    },
    {
        label: 'Alumnos',
        icon: 'pi pi-users',
        command: () => router.push('/admin/alumnos')
    },
    {
        label: 'Empresas',
        icon: 'pi pi-building',
        items: [
            {
                label: 'Empresas',
                icon: 'pi pi-building',
                command: () => router.push('/admin/empresas')
            },
            {
                label: 'Vacantes',
                icon: 'pi pi-briefcase',
                command: () => router.push('/admin/vacantes')
            }
        ]
    },
    {
        label: 'Postulaciones',
        icon: 'pi pi-users',
        command: () => router.push('/admin/postulaciones')
    },
    {
        label: 'Historial',
        icon: 'pi pi-history',
        command: () => router.push('/admin/historial')
    }
];

/**
 * =========================
 * MENÚ ALUMNO
 * =========================
 */
const alumnoMenu = [
    {
        label: 'Dashboard',
        icon: 'pi pi-home',
        command: () => router.push('/alumno/dashboard')
    },
    {
        label: 'Vacantes',
        icon: 'pi pi-briefcase',
        command: () => router.push('/alumno/vacantes')
    },
    {
        label: 'Entregables',
        icon: 'pi pi-upload',
        command: () => router.push('/alumno/entregables')
    },
    {
        label: 'Historial Académico',
        icon: 'pi pi-history',
        command: () => router.push('/alumno/historial')
    },
    {
        label: 'Encuesta',
        icon: 'pi pi-star',
        command: () => router.push('/alumno/encuesta')
    }
];

/**
 * =========================
 * MENÚ DINÁMICO POR ROL
 * =========================
 */
const menuModel = computed(() => {
    if (auth.user?.rol === 'admin') return adminMenu;
    if (auth.user?.rol === 'alumno') return alumnoMenu;
    return [];
});
</script>

<template>
    <PanelMenu :model="menuModel" class="w-full" :multiple="true" />
</template>
