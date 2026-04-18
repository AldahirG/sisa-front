<script setup>
import { useAuthStore } from '@/store/auth';
import { useNotificaciones } from '@/composables/useNotificaciones';
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

// ─────────────────────────────────────────────────────────────
const emit = defineEmits(['close']);
const router = useRouter();
const auth   = useAuthStore();
const { notificaciones, count, cargando, fetchNotificaciones, marcarLeida, marcarTodas, eliminar } = useNotificaciones();

// ─────────────────────────────────────────────────────────────
// CARGA INICIAL del panel al abrirse
// ─────────────────────────────────────────────────────────────
onMounted(fetchNotificaciones);

// ─────────────────────────────────────────────────────────────
// ICONO Y COLOR POR TIPO
// ─────────────────────────────────────────────────────────────
const TIPO_CONFIG = {
    postulacion_aceptada:  { icon: 'pi-check-circle',       color: 'verde'   },
    postulacion_rechazada: { icon: 'pi-times-circle',        color: 'rojo'    },
    entregable_evaluado:   { icon: 'pi-file-edit',           color: 'azul'    },
    nuevo_entregable:      { icon: 'pi-upload',              color: 'azul'    },
    encuesta_disponible:   { icon: 'pi-clipboard',           color: 'azul'    },
    nuevas_vacantes:       { icon: 'pi-building',            color: 'azul'    },
    periodo_abierto:       { icon: 'pi-calendar',            color: 'azul'    },
    liberado:              { icon: 'pi-graduation-cap',      color: 'verde'   },
    baja_practicas:        { icon: 'pi-exclamation-triangle',color: 'naranja' }
};

const iconoTipo = (tipo) => TIPO_CONFIG[tipo]?.icon ?? 'pi-bell';
const colorTipo = (tipo) => TIPO_CONFIG[tipo]?.color ?? 'azul';

// ─────────────────────────────────────────────────────────────
// TIEMPO RELATIVO (sin dependencias extra)
// ─────────────────────────────────────────────────────────────
const tiempoRelativo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1)   return 'ahora mismo';
    if (mins < 60)  return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs  < 24)  return `hace ${hrs} h`;
    const days = Math.floor(hrs / 24);
    if (days < 7)   return `hace ${days} d`;
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
};

// ─────────────────────────────────────────────────────────────
// COMPUTED
// ─────────────────────────────────────────────────────────────
const hayNoLeidas = computed(() => notificaciones.value.some((n) => !n.leida));

// ─────────────────────────────────────────────────────────────
// RESOLVER RUTA
// El backend envía rutas genéricas (ej: /mis-entregables) que no
// coinciden con las rutas reales del router (/alumno/entregables).
// Si la ruta ya es válida (empieza con /alumno/ o /admin/) se usa
// tal cual; de lo contrario se mapea según el rol del usuario.
// ─────────────────────────────────────────────────────────────
const MAPA_ALUMNO = {
    // rutas genéricas del backend → rutas reales Vue
    '/mis-practicas':        '/alumno/vacantes',
    '/mis-postulaciones':    '/alumno/vacantes',
    '/vacantes':             '/alumno/vacantes',
    '/mis-entregables':      '/alumno/entregables',
    '/entregables':          '/alumno/entregables',
    '/historial':            '/alumno/historial',
    '/historial-academico':  '/alumno/historial',
    '/encuesta':             '/alumno/encuesta',
    '/encuestas':            '/alumno/encuesta',
    '/dashboard':            '/alumno/dashboard'
};

const MAPA_ADMIN = {
    '/entregables':          '/admin/entregables',
    '/postulaciones':        '/admin/postulaciones',
    '/periodos':             '/admin/periodos',
    '/control-academico':    '/admin/control-academico',
    '/alumnos':              '/admin/alumnos',
    '/encuestas':            '/admin/encuestas',
    '/vacantes':             '/admin/vacantes',
    '/empresas':             '/admin/empresas',
    '/dashboard':            '/admin/dashboard'
};

// Fallbacks por tipo de notificación cuando url_accion es null o desconocida
const FALLBACK_ALUMNO = {
    postulacion_aceptada:  '/alumno/historial',
    postulacion_rechazada: '/alumno/historial',
    entregable_evaluado:   '/alumno/entregables',
    nuevo_entregable:      '/alumno/entregables',
    encuesta_disponible:   '/alumno/encuesta',
    nuevas_vacantes:       '/alumno/vacantes',
    periodo_abierto:       '/alumno/vacantes',
    liberado:              '/alumno/historial',
    baja_practicas:        '/alumno/historial'
};

const FALLBACK_ADMIN = {
    nuevo_entregable:      '/admin/entregables',
    periodo_abierto:       '/admin/periodos'
};

const resolverRuta = (url_accion, tipo) => {
    const rol = auth.user?.rol ?? 'alumno';

    // 1. Ya es ruta real del router → usar tal cual
    if (url_accion && (url_accion.startsWith('/alumno/') || url_accion.startsWith('/admin/'))) {
        return url_accion;
    }

    // 2. Mapear alias del backend según rol
    if (url_accion) {
        const mapa = rol === 'admin' ? MAPA_ADMIN : MAPA_ALUMNO;
        // Comparar ignorando query/hash
        const base = url_accion.split('?')[0].split('#')[0];
        if (mapa[base]) return mapa[base];
    }

    // 3. Fallback por tipo de notificación
    const fallbacks = rol === 'admin' ? FALLBACK_ADMIN : FALLBACK_ALUMNO;
    if (tipo && fallbacks[tipo]) return fallbacks[tipo];

    // 4. Último recurso: dashboard del rol
    return rol === 'admin' ? '/admin/dashboard' : '/alumno/dashboard';
};

// ─────────────────────────────────────────────────────────────
// ACCIONES
// ─────────────────────────────────────────────────────────────
const handleClick = async (notif) => {
    if (!notif.leida) await marcarLeida(notif.id_notificacion);
    emit('close');
    const ruta = resolverRuta(notif.url_accion, notif.tipo);
    router.push(ruta);
};

const handleMarcarTodas = async () => {
    await marcarTodas();
};

const handleEliminar = async (id, event) => {
    event.stopPropagation();
    await eliminar(id);
};
</script>

<template>
    <div class="notif-panel" role="dialog" aria-label="Notificaciones">

        <!-- ── HEADER ─────────────────────────────── -->
        <div class="notif-header">
            <div class="notif-header-left">
                <i class="pi pi-bell"></i>
                <span>Notificaciones</span>
                <span v-if="count > 0" class="notif-header-count">{{ count }}</span>
            </div>
            <div class="notif-header-actions">
                <button
                    v-if="hayNoLeidas"
                    class="notif-action-btn"
                    title="Marcar todas como leídas"
                    @click="handleMarcarTodas"
                >
                    <i class="pi pi-check-square"></i>
                    <span>Marcar todas</span>
                </button>
                <button class="notif-close-btn" title="Cerrar" @click="emit('close')">
                    <i class="pi pi-times"></i>
                </button>
            </div>
        </div>

        <!-- ── LISTA ──────────────────────────────── -->
        <div class="notif-list">
            <!-- Estado vacío -->
            <div v-if="notificaciones.length === 0 && !cargando" class="notif-empty">
                <i class="pi pi-bell-slash notif-empty-icon"></i>
                <p class="notif-empty-title">Sin notificaciones</p>
                <p class="notif-empty-sub">Aquí aparecerán tus avisos y actualizaciones</p>
            </div>

            <!-- Cargando -->
            <div v-else-if="cargando && notificaciones.length === 0" class="notif-loading">
                <i class="pi pi-spin pi-spinner"></i>
                <span>Cargando…</span>
            </div>

            <!-- Items -->
            <div
                v-for="notif in notificaciones"
                :key="notif.id_notificacion"
                class="notif-item"
                :class="{ 'notif-item--unread': !notif.leida, [`notif-item--${colorTipo(notif.tipo)}`]: true }"
                @click="handleClick(notif)"
                role="button"
                tabindex="0"
                @keydown.enter="handleClick(notif)"
            >
                <!-- Ícono tipo -->
                <div class="notif-item-icon" :class="`notif-icon--${colorTipo(notif.tipo)}`">
                    <i :class="`pi ${iconoTipo(notif.tipo)}`"></i>
                </div>

                <!-- Contenido -->
                <div class="notif-item-body">
                    <p class="notif-item-titulo">{{ notif.titulo }}</p>
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <p class="notif-item-msg" v-html="notif.mensaje"></p>
                    <span class="notif-item-time">{{ tiempoRelativo(notif.fecha_creacion) }}</span>
                </div>

                <!-- Indicador no leída + eliminar -->
                <div class="notif-item-meta">
                    <span v-if="!notif.leida" class="notif-dot" aria-label="No leída"></span>
                    <button
                        class="notif-delete-btn"
                        title="Eliminar notificación"
                        @click="handleEliminar(notif.id_notificacion, $event)"
                    >
                        <i class="pi pi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ─── PANEL WRAPPER ───────────────────────────────────────── */
.notif-panel {
    width: 380px;
    max-height: 520px;
    display: flex;
    flex-direction: column;
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 14px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
    overflow: hidden;
}

/* ─── HEADER ─────────────────────────────────────────────── */
.notif-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--p-content-border-color);
    flex-shrink: 0;
}

.notif-header-left {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--p-text-color);
}

.notif-header-left .pi {
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
    font-size: 1rem;
}

.notif-header-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 10px;
    background: #e53935;
    color: #fff;
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
}

.notif-header-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.notif-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    border: 1px solid var(--p-content-border-color);
    background: transparent;
    color: var(--sisa-icon-blue, #1565C0);
    font-size: 0.76rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
}

.notif-action-btn:hover {
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.08));
}

.notif-close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--p-text-muted-color);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}

.notif-close-btn:hover {
    background: var(--p-surface-100, rgba(0,0,0,0.06));
    color: var(--p-text-color);
}

/* ─── LISTA ──────────────────────────────────────────────── */
.notif-list {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
}

/* ─── EMPTY STATE ────────────────────────────────────────── */
.notif-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 3rem 1.5rem;
    text-align: center;
}

.notif-empty-icon {
    font-size: 2.5rem;
    color: var(--p-text-muted-color);
    opacity: 0.5;
}

.notif-empty-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.notif-empty-sub {
    margin: 0;
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
}

/* ─── LOADING ────────────────────────────────────────────── */
.notif-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--p-text-muted-color);
    font-size: 0.85rem;
}

/* ─── ITEM ───────────────────────────────────────────────── */
.notif-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--p-content-border-color);
    cursor: pointer;
    transition: background 0.15s;
    position: relative;
}

.notif-item:last-child {
    border-bottom: none;
}

.notif-item:hover {
    background: var(--p-surface-50, rgba(0, 0, 0, 0.025));
}

.notif-item--unread {
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.05));
}

.notif-item--unread:hover {
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.09));
}

/* ─── ITEM ICON ──────────────────────────────────────────── */
.notif-item-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    flex-shrink: 0;
    margin-top: 1px;
}

.notif-icon--verde {
    background: rgba(46, 125, 50, 0.12);
    color: #2e7d32;
}

.notif-icon--rojo {
    background: rgba(198, 40, 40, 0.12);
    color: #c62828;
}

.notif-icon--naranja {
    background: rgba(230, 81, 0, 0.12);
    color: #e65100;
}

.notif-icon--azul {
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.12));
    color: var(--sisa-icon-blue, #1565C0);
}

/* ─── ITEM BODY ──────────────────────────────────────────── */
.notif-item-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.notif-item-titulo {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--p-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.notif-item-msg {
    margin: 0;
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
    line-height: 1.4;
    /* Permitir hasta 2 líneas */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* Texto bold del backend */
.notif-item-msg :deep(strong) {
    color: var(--p-text-color);
    font-weight: 600;
}

.notif-item-time {
    font-size: 0.73rem;
    color: var(--p-text-muted-color);
    margin-top: 0.1rem;
}

/* ─── ITEM META ──────────────────────────────────────────── */
.notif-item-meta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    padding-top: 2px;
}

.notif-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e53935;
    flex-shrink: 0;
}

.notif-delete-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--p-text-muted-color);
    cursor: pointer;
    font-size: 0.75rem;
    opacity: 0;
    transition: opacity 0.15s, background 0.15s, color 0.15s;
}

.notif-item:hover .notif-delete-btn {
    opacity: 1;
}

.notif-delete-btn:hover {
    background: rgba(198, 40, 40, 0.1);
    color: #c62828;
}
</style>
