<script setup>
import { useAuthStore } from '@/store/auth';
import { computed, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route  = useRoute();
const auth   = useAuthStore();

// ──────────────────────────────────────
// Definición del menú (igual que antes)
// ──────────────────────────────────────
const adminMenu = [
    {
        label: 'Principal',
        items: [
            { label: 'Dashboard',         icon: 'pi pi-home',            to: '/admin/dashboard'        }
        ]
    },
    {
        label: 'Gestión Académica',
        items: [
            { label: 'Periodos',           icon: 'pi pi-calendar',        to: '/admin/periodos'         },
            { label: 'Entregables',        icon: 'pi pi-file',            to: '/admin/entregables'      },
            { label: 'Evaluaciones',       icon: 'pi pi-star',            to: '/admin/evaluaciones'     },
            { label: 'Control Académico',  icon: 'pi pi-graduation-cap',  to: '/admin/control-academico'},
        ]
    },
    {
        label: 'Usuarios',
        items: [
            { label: 'Alumnos',            icon: 'pi pi-users',           to: '/admin/alumnos'          }
        ]
    },
    {
        label: 'Empresas',
        items: [
            { label: 'Empresas',           icon: 'pi pi-building',        to: '/admin/empresas'         },
            { label: 'Vacantes',           icon: 'pi pi-briefcase',       to: '/admin/vacantes'         }
        ]
    },
    {
        label: 'Seguimiento',
        items: [
            { label: 'Postulaciones',      icon: 'pi pi-send',            to: '/admin/postulaciones'    },
            { label: 'Historial',          icon: 'pi pi-history',         to: '/admin/historial'        },
            { label: 'Encuestas',          icon: 'pi pi-chart-bar',       to: '/admin/encuestas'        }
        ]
    }
];

const alumnoMenu = [
    {
        label: 'Principal',
        items: [
            { label: 'Dashboard',          icon: 'pi pi-home',            to: '/alumno/dashboard'       }
        ]
    },
    {
        label: 'Prácticas',
        items: [
            { label: 'Vacantes',           icon: 'pi pi-briefcase',       to: '/alumno/vacantes'        },
            { label: 'Entregables',        icon: 'pi pi-upload',          to: '/alumno/entregables'     },
            { label: 'Historial Académico',icon: 'pi pi-history',         to: '/alumno/historial'       },
            { label: 'Encuesta',           icon: 'pi pi-comment',         to: '/alumno/encuesta'        }
        ]
    }
];

const menuGroups = computed(() =>
    auth.user?.rol === 'admin' ? adminMenu : alumnoMenu
);

// ──────────────────────────────────────
// Active route helper
// ──────────────────────────────────────
const isActive = (to) => route.path === to || route.path.startsWith(to + '/');

const navigate = (to) => router.push(to);
</script>

<template>
    <nav class="layout-menu-nav" aria-label="Menú principal">
        <ul class="layout-menu">
            <template v-for="group in menuGroups" :key="group.label">

                <!-- Cabecera de grupo -->
                <li class="layout-root-menuitem">
                    <div class="layout-menuitem-root-text">{{ group.label }}</div>

                    <ul>
                        <li v-for="item in group.items" :key="item.to">
                            <a
                                :class="{ 'active-route': isActive(item.to) }"
                                @click.prevent="navigate(item.to)"
                                :href="item.to"
                                role="menuitem"
                            >
                                <i :class="[item.icon, 'layout-menuitem-icon']"></i>
                                <span class="layout-menuitem-text">{{ item.label }}</span>

                                <!-- Indicador de ruta activa -->
                                <span v-if="isActive(item.to)" class="active-indicator" aria-hidden="true"></span>
                            </a>
                        </li>
                    </ul>
                </li>

            </template>

            <!-- Separador + Calendario (compartido) -->
            <li class="layout-root-menuitem">
                <div class="layout-menuitem-root-text">Herramientas</div>
                <ul>
                    <li>
                        <a
                            :class="{ 'active-route': isActive('/calendar') }"
                            @click.prevent="navigate('/calendar')"
                            href="/calendar"
                            role="menuitem"
                        >
                            <i class="pi pi-calendar layout-menuitem-icon"></i>
                            <span class="layout-menuitem-text">Calendario</span>
                            <span v-if="isActive('/calendar')" class="active-indicator" aria-hidden="true"></span>
                        </a>
                    </li>
                    <li>
                        <a
                            :class="{ 'active-route': isActive('/perfil') }"
                            @click.prevent="navigate('/perfil')"
                            href="/perfil"
                            role="menuitem"
                        >
                            <i class="pi pi-user layout-menuitem-icon"></i>
                            <span class="layout-menuitem-text">Mi perfil</span>
                            <span v-if="isActive('/perfil')" class="active-indicator" aria-hidden="true"></span>
                        </a>
                    </li>
                </ul>
            </li>

        </ul>
    </nav>
</template>

<style scoped>
/* ────────────────────────────────────────
   Keyframes
──────────────────────────────────────── */
@keyframes menuItemIn {
    from { opacity: 0; transform: translateX(-10px); }
    to   { opacity: 1; transform: translateX(0); }
}

/* ────────────────────────────────────────
   Estructura de lista
──────────────────────────────────────── */
.layout-menu {
    list-style: none;
    margin: 0;
    padding: 0;
}

.layout-root-menuitem {
    margin-bottom: 0.25rem;
}

/* Stagger entry — grupos */
.layout-root-menuitem {
    animation: menuItemIn var(--sisa-dur-slow, 320ms) var(--sisa-ease-out, cubic-bezier(0.16,1,0.3,1)) both;
}
.layout-root-menuitem:nth-child(1)  { animation-delay: 0.04s; }
.layout-root-menuitem:nth-child(2)  { animation-delay: 0.09s; }
.layout-root-menuitem:nth-child(3)  { animation-delay: 0.13s; }
.layout-root-menuitem:nth-child(4)  { animation-delay: 0.17s; }
.layout-root-menuitem:nth-child(5)  { animation-delay: 0.21s; }
.layout-root-menuitem:nth-child(6)  { animation-delay: 0.25s; }

/* Cabeceras de grupo */
.layout-menuitem-root-text {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: var(--text-color-secondary);
    padding: 1rem 0.75rem 0.375rem;
    margin-top: 0.25rem;
}

/* ────────────────────────────────────────
   Items de menú
──────────────────────────────────────── */
.layout-menu ul {
    list-style: none;
    margin: 0;
    padding: 0;
}

.layout-menu a {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    color: var(--text-color);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    position: relative;
    outline: none;
    transition:
        background  var(--sisa-dur-fast, 120ms) ease,
        color       var(--sisa-dur-fast, 120ms) ease,
        transform   var(--sisa-dur-fast, 120ms) var(--sisa-ease-spring, cubic-bezier(0.34,1.56,0.64,1)),
        padding-left var(--sisa-dur-base, 200ms) ease;
}

.layout-menu a:hover {
    background: var(--surface-hover);
    padding-left: 1rem;
}

.layout-menu a:hover .layout-menuitem-icon {
    color: var(--sisa-primary-l);
    transform: scale(1.15);
}

.layout-menu a:active {
    transform: scale(0.97);
}

.layout-menu a:focus-visible {
    box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.25);
}

/* Ícono */
.layout-menuitem-icon {
    width: 1.125rem;
    text-align: center;
    flex-shrink: 0;
    font-size: 0.9rem;
    color: var(--text-color-secondary);
    transition: color var(--sisa-dur-fast, 120ms) ease, transform var(--sisa-dur-fast, 120ms) var(--sisa-ease-spring, cubic-bezier(0.34,1.56,0.64,1));
}

/* ────────────────────────────────────────
   ACTIVE ROUTE
──────────────────────────────────────── */
.layout-menu a.active-route {
    background: var(--sisa-active-bg);
    color: var(--sisa-primary-l);
    font-weight: 600;
    padding-left: 1rem;
}

.layout-menu a.active-route .layout-menuitem-icon {
    color: var(--sisa-primary-l);
}

/* Línea lateral izquierda animada */
.layout-menu a.active-route::before {
    content: '';
    position: absolute;
    left: 0;
    top: 20%;
    height: 60%;
    width: 3px;
    background: var(--sisa-primary-l);
    border-radius: 0 3px 3px 0;
    animation: menuItemIn 0.25s var(--sisa-ease-spring, cubic-bezier(0.34,1.56,0.64,1)) both;
}

.active-indicator {
    display: none;
}

/* ────────────────────────────────────────
   Accesibilidad
──────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
    .layout-root-menuitem,
    .layout-menu a,
    .layout-menu a::before,
    .layout-menuitem-icon {
        animation: none !important;
        transition: none !important;
    }
    .layout-menu a:hover { padding-left: 0.75rem; }
}
</style>
