<script setup>
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';

const auth   = useAuthStore();
const route  = useRoute();
const router = useRouter();
const isAlumno = computed(() => auth.user?.rol === 'alumno');

// ════════════════════════════════
// STATE
// ════════════════════════════════
const currentDate       = ref(new Date());
const eventos           = ref([]);
const loading           = ref(false);

const dayModalVisible   = ref(false);
const eventModalVisible = ref(false);
const eventosDelDia     = ref([]);
const selectedEvent     = ref(null);
const selectedDay       = ref(null);

// ════════════════════════════════
// DATE HELPERS
// ════════════════════════════════
const normalizeDate = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date;
};

const dateKey = (d) => normalizeDate(d).toISOString().split('T')[0];

const isToday        = (d) => dateKey(d) === dateKey(new Date());
const isCurrentMonth = (d) => d.getMonth() === currentDate.value.getMonth();

const startOfMonth = computed(() => new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1));

const startCalendar = computed(() => {
    const d = new Date(startOfMonth.value);
    d.setDate(d.getDate() - d.getDay());
    return d;
});

const calendarDays = computed(() => {
    const days = [];
    const d = new Date(startCalendar.value);
    for (let i = 0; i < 42; i++) {
        days.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }
    return days;
});

const formatDate = (fechaStr) => {
    if (!fechaStr) return '—';
    return new Date(fechaStr).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
};

// ════════════════════════════════
// ESTADO DE ENTREGABLE
// ════════════════════════════════

/**
 * Calcula el estado visual de un entregable
 * Para alumno usa el campo `estado` del API (submission status)
 * Para admin solo usa fechas
 */
const getEstado = (e) => {
    // Alumno: tiene estado de entrega
    if (e.estado === 'evaluado')   return 'graded';
    if (e.estado === 'entregado')  return 'submitted';

    const now = normalizeDate(new Date());
    const fin = normalizeDate(e.fin);

    if (now > fin) return 'expired';

    const msLeft = fin - now;
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    if (daysLeft === 0) return 'due-today';
    if (daysLeft <= 3)  return 'urgent';
    if (now < e.inicio) return 'not-started';
    return 'available';
};

// Configuración visual por estado
const ESTADO_CONFIG = {
    'graded':      { color: '#10b981', bg: 'rgba(16,185,129,.85)',  label: 'Evaluado',      severity: 'success',   icon: 'pi pi-star'                },
    'submitted':   { color: '#1565C0', bg: 'rgba(21,101,192,.85)',  label: 'Entregado',     severity: 'info',      icon: 'pi pi-hourglass'           },
    'available':   { color: '#16a34a', bg: 'rgba(22,163,74,.8)',    label: 'Disponible',    severity: 'success',   icon: 'pi pi-check-circle'        },
    'due-today':   { color: '#f59e0b', bg: 'rgba(245,158,11,.85)',  label: 'Vence hoy',     severity: 'warn',      icon: 'pi pi-exclamation-circle'  },
    'urgent':      { color: '#ef4444', bg: 'rgba(239,68,68,.85)',   label: 'Urgente',       severity: 'danger',    icon: 'pi pi-exclamation-triangle' },
    'expired':     { color: '#64748b', bg: 'rgba(100,116,139,.7)',  label: 'Expirado',      severity: 'secondary', icon: 'pi pi-ban'                 },
    'not-started': { color: '#94a3b8', bg: 'rgba(148,163,184,.65)', label: 'Próximamente',  severity: 'secondary', icon: 'pi pi-clock'               }
};

// Puede el alumno ir a subir este entregable?
const canUpload = (e) =>
    e.estado !== 'evaluado' &&
    e.estado !== 'entregado' &&
    getEstado(e) !== 'expired' &&
    getEstado(e) !== 'not-started';

// ════════════════════════════════
// CARGA DE EVENTOS
// ════════════════════════════════
const loadEventos = async () => {
    loading.value = true;
    eventos.value = [];
    try {
        const { data: periodos } = await api.get('/periodos/activos');

        for (const p of periodos) {
            let inicio = normalizeDate(p.fecha_inicio);
            let fin    = normalizeDate(p.fecha_fin);
            if (fin < inicio) fin.setFullYear(fin.getFullYear() + 1);

            eventos.value.push({
                tipo: 'periodo',
                id_periodo: p.id_periodo,
                nombre: p.nombre,
                inicio, fin
            });
        }

        if (isAlumno.value) {
            // Alumno: carga sus propios entregables con estado de entrega
            const { data: ents } = await api.get('/entregables/me');
            ents.forEach((e) => {
                eventos.value.push({
                    tipo:          'entregable',
                    id_entregable: e.id_entregable,
                    nombre:        e.nombre,
                    descripcion:   e.descripcion,
                    fecha_limite:  e.fecha_limite,
                    archivo_url:   e.archivo_url,
                    calificacion:  e.calificacion,
                    observaciones: e.observaciones,
                    estado:        e.estado,
                    inicio: e.fecha_inicio ? normalizeDate(e.fecha_inicio) : normalizeDate(e.fecha_limite),
                    fin:    normalizeDate(e.fecha_limite)
                });
            });
        } else {
            // Admin: carga entregables de cada periodo (sin estado por alumno)
            for (const p of periodos) {
                const { data: ents } = await api.get(`/entregables/periodo/${p.id_periodo}`);
                ents.forEach((e) => {
                    eventos.value.push({
                        tipo:          'entregable',
                        id_entregable: e.id_entregable,
                        nombre:        e.nombre,
                        descripcion:   e.descripcion,
                        fecha_limite:  e.fecha_limite,
                        estado:        null,   // admin ve todos, sin estado individual
                        inicio: e.fecha_inicio ? normalizeDate(e.fecha_inicio) : normalizeDate(e.fecha_limite),
                        fin:    normalizeDate(e.fecha_limite)
                    });
                });
            }
        }
    } catch (err) {
        console.error('Error cargando calendario', err);
    } finally {
        loading.value = false;
    }
};

// ════════════════════════════════
// FILTROS POR DÍA
// ════════════════════════════════
const entregablesEnDia = (day) => {
    const d = normalizeDate(day);
    return eventos.value.filter(e => e.tipo === 'entregable' && d >= e.inicio && d <= e.fin);
};

const periodosEnDia = (day) => {
    const d = normalizeDate(day);
    return eventos.value.filter(e => e.tipo === 'periodo' && d >= e.inicio && d <= e.fin);
};

const mostrarNombrePeriodo    = (p, day) => dateKey(p.inicio) === dateKey(day);
const mostrarNombreEntregable = (e, day) => dateKey(e.inicio) === dateKey(day);

// Posición del pill en el rango
const posicionPill = (e, day) => {
    const start = dateKey(day) === dateKey(e.inicio);
    const end   = dateKey(day) === dateKey(e.fin);
    if (start && end) return 'pill-single';
    if (start)        return 'pill-start';
    if (end)          return 'pill-end';
    return 'pill-middle';
};

// Entregables del mes en curso para la agenda
const entregablesMes = computed(() => {
    const year  = currentDate.value.getFullYear();
    const month = currentDate.value.getMonth();
    return eventos.value
        .filter(e => e.tipo === 'entregable')
        .filter(e => {
            const f = normalizeDate(e.fin);
            return f.getFullYear() === year && f.getMonth() === month;
        })
        .sort((a, b) => a.fin - b.fin);
});

// ════════════════════════════════
// CLICK HANDLERS
// ════════════════════════════════
const openDay = (day) => {
    const all = [...periodosEnDia(day), ...entregablesEnDia(day)];
    if (!all.length) return;
    selectedDay.value   = day;
    eventosDelDia.value = all;
    dayModalVisible.value = true;
};

const openEvent = (e) => {
    if (e.tipo === 'periodo') return;
    selectedEvent.value    = e;
    eventModalVisible.value = true;
    dayModalVisible.value  = false;
};

// Navegar al entregable
const irAEntregable = (e) => {
    eventModalVisible.value = false;
    dayModalVisible.value   = false;
    if (isAlumno.value) {
        router.push({ name: 'alumno-entregables', query: { highlight: e.id_entregable } });
    } else {
        router.push({ name: 'admin-entregables', query: { id: e.id_entregable, refresh: 1 } });
    }
};

// ════════════════════════════════
// NAV
// ════════════════════════════════
const prevMonth = () => {
    currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1);
};
const nextMonth = () => {
    currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1);
};
const goToday = () => {
    currentDate.value = new Date();
};

// ════════════════════════════════
// REFRESH AUTOMÁTICO
// ════════════════════════════════
watch(() => route.query.refresh, (val) => {
    if (val) {
        loadEventos();
        router.replace({ query: {} });
    }
});

onMounted(loadEventos);
</script>

<template>
    <div class="cal-page">

        <!-- ════════ HEADER ════════ -->
        <div class="cal-topbar">
            <div class="cal-nav">
                <Button icon="pi pi-angle-left" text rounded @click="prevMonth" aria-label="Mes anterior" />
                <h2 class="cal-month-title">
                    {{ currentDate.toLocaleString('es-MX', { month: 'long', year: 'numeric' }) }}
                </h2>
                <Button icon="pi pi-angle-right" text rounded @click="nextMonth" aria-label="Mes siguiente" />
            </div>
            <Button label="Hoy" size="small" outlined @click="goToday" class="cal-today-btn" />
        </div>

        <!-- LOADING -->
        <div v-if="loading" class="cal-loading">
            <i class="pi pi-spin pi-spinner"></i>
            <span>Cargando calendario…</span>
        </div>

        <template v-else>
            <!-- ════════ GRID ════════ -->
            <div class="cal-card">
                <!-- Días de la semana -->
                <div class="cal-grid cal-weekdays">
                    <div v-for="d in ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']" :key="d" class="cal-weekday">
                        {{ d }}
                    </div>
                </div>

                <!-- Días -->
                <div class="cal-grid cal-days-grid">
                    <div
                        v-for="day in calendarDays"
                        :key="day.toISOString()"
                        class="cal-day"
                        :class="{
                            'cal-day--today':       isToday(day),
                            'cal-day--other-month': !isCurrentMonth(day),
                            'cal-day--has-events':  entregablesEnDia(day).length > 0
                        }"
                        @click="openDay(day)"
                        role="button"
                        :aria-label="`${day.getDate()} de ${day.toLocaleString('es-MX', { month: 'long' })}`"
                    >
                        <!-- Número del día -->
                        <span class="cal-day-num">
                            {{ day.getDate() }}
                            <small v-if="!isCurrentMonth(day)" class="cal-day-month">
                                {{ day.toLocaleString('es-MX', { month: 'short' }) }}
                            </small>
                        </span>

                        <!-- Periodo (fondo azul tint) -->
                        <div
                            v-for="p in periodosEnDia(day)"
                            :key="`per-${p.id_periodo}`"
                            class="cal-period-bg"
                        >
                            <span v-if="mostrarNombrePeriodo(p, day)" class="cal-period-label">
                                {{ p.nombre }}
                            </span>
                        </div>

                        <!-- Pills de entregables -->
                        <div class="cal-pills">
                            <div
                                v-for="(e, idx) in entregablesEnDia(day).slice(0, 3)"
                                :key="`pill-${e.id_entregable}-${dateKey(day)}`"
                                class="cal-pill"
                                :class="[posicionPill(e, day)]"
                                :style="{ background: ESTADO_CONFIG[getEstado(e)]?.bg ?? '#16a34a' }"
                                @click.stop="openEvent(e)"
                                :title="e.nombre"
                            >
                                <span v-if="mostrarNombreEntregable(e, day)" class="cal-pill-name">
                                    {{ e.nombre }}
                                </span>
                                <!-- Indicador de fin de plazo -->
                                <span v-if="dateKey(day) === dateKey(e.fin) && !mostrarNombreEntregable(e, day)" class="cal-pill-end-dot"></span>
                            </div>

                            <!-- +N más -->
                            <button
                                v-if="entregablesEnDia(day).length > 3"
                                class="cal-pill-more"
                                @click.stop="openDay(day)"
                            >
                                +{{ entregablesEnDia(day).length - 3 }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ════════ LEYENDA ════════ -->
            <div class="cal-legend">
                <div class="legend-item">
                    <span class="legend-swatch" style="background: rgba(21,101,192,.25); border: 1px solid rgba(21,101,192,.4)"></span>
                    <span>Periodo activo</span>
                </div>
                <template v-if="isAlumno">
                    <div v-for="(cfg, key) in ESTADO_CONFIG" :key="key" class="legend-item">
                        <span class="legend-swatch" :style="{ background: cfg.bg }"></span>
                        <span>{{ cfg.label }}</span>
                    </div>
                </template>
                <template v-else>
                    <div class="legend-item">
                        <span class="legend-swatch" style="background: rgba(22,163,74,.8)"></span>
                        <span>Entregable disponible</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-swatch" style="background: rgba(239,68,68,.85)"></span>
                        <span>Fecha límite próxima</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-swatch" style="background: rgba(100,116,139,.7)"></span>
                        <span>Expirado</span>
                    </div>
                </template>
            </div>

            <!-- ════════ AGENDA DEL MES ════════ -->
            <div v-if="entregablesMes.length" class="cal-agenda">
                <div class="agenda-header">
                    <i class="pi pi-list-check agenda-icon"></i>
                    <span class="agenda-title">Entregables de {{ currentDate.toLocaleString('es-MX', { month: 'long' }) }}</span>
                </div>
                <div class="agenda-list">
                    <div
                        v-for="e in entregablesMes"
                        :key="`agenda-${e.id_entregable}`"
                        class="agenda-item"
                        :class="{ 'agenda-item--clickable': true }"
                        @click="openEvent(e)"
                    >
                        <div
                            class="agenda-estado-bar"
                            :style="{ background: ESTADO_CONFIG[getEstado(e)]?.color ?? '#16a34a' }"
                        ></div>
                        <div class="agenda-body">
                            <div class="agenda-name">{{ e.nombre }}</div>
                            <div class="agenda-meta">
                                <span>
                                    <i class="pi pi-calendar"></i>
                                    Límite: <strong>{{ formatDate(e.fecha_limite) }}</strong>
                                </span>
                                <Tag
                                    :value="ESTADO_CONFIG[getEstado(e)]?.label ?? getEstado(e)"
                                    :severity="ESTADO_CONFIG[getEstado(e)]?.severity ?? 'secondary'"
                                    class="agenda-tag"
                                />
                            </div>
                        </div>
                        <i class="pi pi-chevron-right agenda-arrow"></i>
                    </div>
                </div>
            </div>
        </template>

        <!-- ════════ MODAL: EVENTOS DEL DÍA ════════ -->
        <Dialog
            v-model:visible="dayModalVisible"
            modal
            :style="{ width: '420px', maxWidth: '95vw' }"
        >
            <template #header>
                <div class="modal-day-header">
                    <span class="modal-day-num">{{ selectedDay?.getDate() }}</span>
                    <div>
                        <p class="modal-day-title">
                            {{ selectedDay?.toLocaleString('es-MX', { weekday: 'long' }) }}
                        </p>
                        <p class="modal-day-sub">
                            {{ selectedDay?.toLocaleString('es-MX', { month: 'long', year: 'numeric' }) }}
                        </p>
                    </div>
                </div>
            </template>

            <div class="modal-events-list">
                <div
                    v-for="e in eventosDelDia"
                    :key="`mev-${e.tipo}-${e.id_entregable ?? e.id_periodo}`"
                    class="modal-event-row"
                    :class="{ 'modal-event-row--clickable': e.tipo === 'entregable' }"
                    @click="e.tipo === 'entregable' && openEvent(e)"
                >
                    <!-- Tipo: Periodo -->
                    <template v-if="e.tipo === 'periodo'">
                        <div class="mev-dot" style="background: var(--sisa-primary-l)"></div>
                        <div class="mev-body">
                            <p class="mev-name">{{ e.nombre }}</p>
                            <p class="mev-meta">Periodo activo</p>
                        </div>
                        <Tag value="Periodo" severity="info" />
                    </template>

                    <!-- Tipo: Entregable -->
                    <template v-else>
                        <div
                            class="mev-dot"
                            :style="{ background: ESTADO_CONFIG[getEstado(e)]?.color ?? '#16a34a' }"
                        ></div>
                        <div class="mev-body">
                            <p class="mev-name">{{ e.nombre }}</p>
                            <p class="mev-meta">
                                Límite: {{ formatDate(e.fecha_limite) }}
                            </p>
                        </div>
                        <div class="mev-right">
                            <Tag
                                :value="ESTADO_CONFIG[getEstado(e)]?.label"
                                :severity="ESTADO_CONFIG[getEstado(e)]?.severity"
                            />
                            <i class="pi pi-chevron-right mev-arrow"></i>
                        </div>
                    </template>
                </div>
            </div>
        </Dialog>

        <!-- ════════ MODAL: DETALLE ENTREGABLE ════════ -->
        <Dialog
            v-model:visible="eventModalVisible"
            modal
            :style="{ width: '480px', maxWidth: '95vw' }"
        >
            <template #header>
                <div class="modal-ent-header">
                    <div
                        class="modal-ent-icon"
                        :style="{ background: ESTADO_CONFIG[getEstado(selectedEvent ?? {})]?.color ?? '#16a34a' }"
                    >
                        <i :class="ESTADO_CONFIG[getEstado(selectedEvent ?? {})]?.icon ?? 'pi pi-file'"></i>
                    </div>
                    <div>
                        <p class="modal-ent-title">{{ selectedEvent?.nombre }}</p>
                        <Tag
                            :value="ESTADO_CONFIG[getEstado(selectedEvent ?? {})]?.label"
                            :severity="ESTADO_CONFIG[getEstado(selectedEvent ?? {})]?.severity"
                        />
                    </div>
                </div>
            </template>

            <template v-if="selectedEvent">
                <!-- Descripción -->
                <p v-if="selectedEvent.descripcion" class="ent-modal-desc">
                    {{ selectedEvent.descripcion }}
                </p>

                <!-- Fechas -->
                <div class="ent-modal-dates">
                    <div class="ent-modal-date-item">
                        <i class="pi pi-play-circle"></i>
                        <div>
                            <span class="emd-label">Disponible desde</span>
                            <span class="emd-value">{{ formatDate(selectedEvent.inicio) }}</span>
                        </div>
                    </div>
                    <div class="ent-modal-date-item" :class="{ 'emd-urgent': ['due-today','urgent'].includes(getEstado(selectedEvent)) }">
                        <i class="pi pi-flag"></i>
                        <div>
                            <span class="emd-label">Fecha límite</span>
                            <span class="emd-value">{{ formatDate(selectedEvent.fecha_limite) }}</span>
                        </div>
                    </div>
                </div>

                <!-- Estado de entrega (alumno) -->
                <template v-if="isAlumno">
                    <!-- Bloqueado: evaluado -->
                    <div v-if="selectedEvent.estado === 'evaluado'" class="ent-modal-lock ent-lock-graded">
                        <i class="pi pi-lock"></i>
                        <div>
                            <p class="lock-title">Entregable evaluado</p>
                            <p class="lock-sub">
                                Calificación:
                                <strong>{{ selectedEvent.calificacion ?? '—' }} / 10</strong>
                            </p>
                            <p v-if="selectedEvent.observaciones" class="lock-obs">
                                {{ selectedEvent.observaciones }}
                            </p>
                        </div>
                    </div>

                    <!-- Bloqueado: entregado (en revisión) -->
                    <div v-else-if="selectedEvent.estado === 'entregado'" class="ent-modal-lock ent-lock-submitted">
                        <i class="pi pi-hourglass"></i>
                        <div>
                            <p class="lock-title">Entrega recibida — en revisión</p>
                            <p class="lock-sub">Tu coordinador evaluará el entregable próximamente.</p>
                            <a v-if="selectedEvent.archivo_url" :href="selectedEvent.archivo_url" target="_blank" class="lock-file-link">
                                <i class="pi pi-external-link"></i> Ver archivo entregado
                            </a>
                        </div>
                    </div>

                    <!-- Expirado sin entregar -->
                    <div v-else-if="getEstado(selectedEvent) === 'expired'" class="ent-modal-lock ent-lock-expired">
                        <i class="pi pi-ban"></i>
                        <div>
                            <p class="lock-title">Plazo expirado</p>
                            <p class="lock-sub">La fecha límite ya pasó. Contacta a tu coordinador.</p>
                        </div>
                    </div>
                </template>

                <!-- Acciones -->
                <div class="ent-modal-actions">
                    <Button
                        label="Cerrar"
                        text
                        severity="secondary"
                        @click="eventModalVisible = false"
                    />

                    <!-- Alumno: Ir a subir (solo si disponible) -->
                    <template v-if="isAlumno">
                        <Button
                            v-if="canUpload(selectedEvent)"
                            :label="getEstado(selectedEvent) === 'due-today' ? '¡Entregar ahora!' : 'Ir a entregar'"
                            :icon="getEstado(selectedEvent) === 'due-today' ? 'pi pi-exclamation-circle' : 'pi pi-upload'"
                            :severity="getEstado(selectedEvent) === 'due-today' ? 'danger' : 'success'"
                            @click="irAEntregable(selectedEvent)"
                        />
                        <Button
                            v-else-if="selectedEvent.estado === 'evaluado' || selectedEvent.estado === 'entregado'"
                            label="Ver en entregables"
                            icon="pi pi-eye"
                            severity="secondary"
                            outlined
                            @click="irAEntregable(selectedEvent)"
                        />
                    </template>

                    <!-- Admin: Editar entregable -->
                    <Button
                        v-if="!isAlumno"
                        label="Editar entregable"
                        icon="pi pi-pencil"
                        @click="irAEntregable(selectedEvent)"
                    />
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* ════════════════════════════════════════
   PÁGINA
════════════════════════════════════════ */
.cal-page {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding-bottom: 1rem;
}

/* ════════════════════════════════════════
   TOPBAR
════════════════════════════════════════ */
.cal-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}

.cal-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.cal-month-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-color);
    text-transform: capitalize;
    min-width: 200px;
    text-align: center;
    margin: 0;
}

.cal-today-btn {
    border-color: var(--sisa-border) !important;
    color: var(--text-color) !important;
}

/* ════════════════════════════════════════
   LOADING
════════════════════════════════════════ */
.cal-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 4rem 0;
    color: var(--text-color-secondary);
    font-size: 0.875rem;
}
.cal-loading i { font-size: 1.75rem; color: var(--sisa-primary-l); }

/* ════════════════════════════════════════
   CARD DEL CALENDARIO
════════════════════════════════════════ */
.cal-card {
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 12px;
    overflow: hidden;
}

/* ════════════════════════════════════════
   GRID
════════════════════════════════════════ */
.cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
}

/* Encabezados de día */
.cal-weekdays {
    background: var(--surface-ground);
    border-bottom: 1px solid var(--sisa-border);
}

.cal-weekday {
    text-align: center;
    padding: 0.625rem 0;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-color-secondary);
}

/* Celda de día */
.cal-day {
    min-height: 110px;
    border-right: 1px solid var(--sisa-border);
    border-bottom: 1px solid var(--sisa-border);
    padding: 5px;
    position: relative;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: background 0.12s;
}

.cal-day:nth-child(7n) { border-right: none; }
.cal-days-grid > .cal-day:nth-last-child(-n+7) { border-bottom: none; }

.cal-day:hover { background: var(--surface-hover); }

/* Hoy */
.cal-day--today {
    background: var(--sisa-active-bg);
}
.cal-day--today .cal-day-num {
    background: var(--sisa-primary-l);
    color: #fff;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
}

/* Otros meses */
.cal-day--other-month { opacity: 0.45; }

/* Número del día */
.cal-day-num {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-color-secondary);
    flex-shrink: 0;
    line-height: 1;
    display: flex;
    align-items: center;
    gap: 3px;
}

.cal-day-month {
    font-size: 0.6rem;
    font-weight: 500;
    opacity: 0.8;
}

/* ════════════════════════════════════════
   PERIODO (FONDO AZUL)
════════════════════════════════════════ */
.cal-period-bg {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--sisa-primary-l) 10%, transparent);
    border-left: 2px solid rgba(21, 101, 192, 0.25);
    pointer-events: none;
    z-index: 0;
}

.cal-period-label {
    position: absolute;
    top: 22px;
    left: 5px;
    right: 5px;
    font-size: 0.6rem;
    font-weight: 700;
    color: var(--sisa-primary-l);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    z-index: 1;
}

/* ════════════════════════════════════════
   PILLS DE ENTREGABLES
════════════════════════════════════════ */
.cal-pills {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 20px;  /* deja espacio al número del día + label periodo */
    position: relative;
    z-index: 2;
}

.cal-pill {
    height: 16px;
    border-radius: 3px;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 0 4px;
    transition: filter 0.12s, transform 0.1s;
    position: relative;
}

.cal-pill:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
}

/* Bordes según posición */
.pill-start  { border-radius: 4px 0 0 4px; }
.pill-middle { border-radius: 0; margin-left: -5px; margin-right: -5px; padding: 0; }
.pill-end    { border-radius: 0 4px 4px 0; }
.pill-single { border-radius: 4px; }

/* Nombre del entregable (solo en día de inicio) */
.cal-pill-name {
    font-size: 0.6rem;
    font-weight: 700;
    color: rgba(255,255,255,0.95);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1;
}

/* Punto indicador en día final */
.cal-pill-end-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: rgba(255,255,255,0.9);
    margin-left: auto;
    margin-right: 2px;
    flex-shrink: 0;
}

/* +N más */
.cal-pill-more {
    font-size: 0.58rem;
    font-weight: 700;
    color: var(--text-color-secondary);
    background: var(--surface-ground);
    border: 1px solid var(--sisa-border);
    border-radius: 3px;
    padding: 1px 4px;
    text-align: center;
    cursor: pointer;
    transition: background 0.12s;
    width: fit-content;
}
.cal-pill-more:hover { background: var(--surface-hover); color: var(--sisa-primary-l); }

/* ════════════════════════════════════════
   LEYENDA
════════════════════════════════════════ */
.cal-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem 1.25rem;
    padding: 0.75rem 1rem;
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 10px;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: var(--text-color-secondary);
}

.legend-swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex-shrink: 0;
}

/* ════════════════════════════════════════
   AGENDA DEL MES
════════════════════════════════════════ */
.cal-agenda {
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 12px;
    overflow: hidden;
}

.agenda-header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 1rem 1.25rem 0.875rem;
    border-bottom: 1px solid var(--sisa-border);
    background: var(--surface-ground);
}

.agenda-icon {
    color: var(--sisa-icon-blue);
    font-size: 0.9rem;
}

.agenda-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--text-color);
    text-transform: capitalize;
}

.agenda-list {
    display: flex;
    flex-direction: column;
}

.agenda-item {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--sisa-border);
    cursor: pointer;
    transition: background 0.12s;
}

.agenda-item:last-child { border-bottom: none; }
.agenda-item:hover { background: var(--surface-hover); }

.agenda-estado-bar {
    width: 4px;
    height: 36px;
    border-radius: 2px;
    flex-shrink: 0;
}

.agenda-body { flex: 1; min-width: 0; }

.agenda-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.agenda-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.775rem;
    color: var(--text-color-secondary);
    flex-wrap: wrap;
}

.agenda-meta i { font-size: 0.72rem; }
.agenda-tag { flex-shrink: 0; }

.agenda-arrow {
    color: var(--text-color-secondary);
    font-size: 0.75rem;
    flex-shrink: 0;
}

/* ════════════════════════════════════════
   MODAL: DÍA
════════════════════════════════════════ */
.modal-day-header {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.modal-day-num {
    font-size: 2rem;
    font-weight: 800;
    color: var(--sisa-primary-l);
    line-height: 1;
    min-width: 2ch;
}

.modal-day-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0;
    text-transform: capitalize;
}

.modal-day-sub {
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    margin: 0;
    text-transform: capitalize;
}

.modal-events-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.modal-event-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--sisa-border);
    background: var(--surface-ground);
    transition: background 0.12s;
}

.modal-event-row--clickable { cursor: pointer; }
.modal-event-row--clickable:hover { background: var(--surface-hover); }

.mev-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}

.mev-body { flex: 1; min-width: 0; }

.mev-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mev-meta {
    font-size: 0.75rem;
    color: var(--text-color-secondary);
    margin: 0;
}

.mev-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
}

.mev-arrow {
    font-size: 0.7rem;
    color: var(--text-color-secondary);
}

/* ════════════════════════════════════════
   MODAL: DETALLE ENTREGABLE
════════════════════════════════════════ */
.modal-ent-header {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
}

.modal-ent-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    color: #fff;
    flex-shrink: 0;
}

.modal-ent-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 0.375rem;
    line-height: 1.3;
}

.ent-modal-desc {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
    line-height: 1.5;
    margin: 0 0 1rem;
    padding: 0.75rem;
    background: var(--surface-ground);
    border-radius: 8px;
    border: 1px solid var(--sisa-border);
}

.ent-modal-dates {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.625rem;
    margin-bottom: 1rem;
}

.ent-modal-date-item {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem;
    background: var(--surface-ground);
    border: 1px solid var(--sisa-border);
    border-radius: 8px;
    font-size: 0.8rem;
}

.ent-modal-date-item i {
    color: var(--sisa-icon-blue);
    flex-shrink: 0;
    margin-top: 2px;
}

.emd-urgent { border-color: rgba(239,68,68,.4); background: rgba(239,68,68,.06); }
.emd-urgent i { color: #ef4444; }

.emd-label {
    display: block;
    font-size: 0.7rem;
    color: var(--text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
}

.emd-value {
    display: block;
    font-size: 0.825rem;
    font-weight: 600;
    color: var(--text-color);
}

/* Estado de entrega (lock box) */
.ent-modal-lock {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
    border-radius: 10px;
    border: 1px solid;
    margin-bottom: 1rem;
    font-size: 0.875rem;
}

.ent-modal-lock > i {
    font-size: 1.125rem;
    flex-shrink: 0;
    margin-top: 2px;
}

.ent-lock-graded {
    background: var(--sisa-tint-green);
    border-color: rgba(16,185,129,.3);
    color: var(--sisa-icon-green);
}
.ent-lock-submitted {
    background: var(--sisa-tint-blue);
    border-color: rgba(21,101,192,.3);
    color: var(--sisa-icon-blue);
}
.ent-lock-expired {
    background: var(--surface-ground);
    border-color: var(--sisa-border);
    color: var(--text-color-secondary);
}

.lock-title { font-weight: 700; margin: 0 0 0.25rem; }
.lock-sub   { font-size: 0.8rem; margin: 0; opacity: 0.85; }
.lock-obs   { font-size: 0.8rem; margin: 0.375rem 0 0; font-style: italic; opacity: 0.8; }
.lock-file-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 600;
    margin-top: 0.375rem;
    text-decoration: none;
    color: inherit;
    opacity: 0.9;
}
.lock-file-link:hover { opacity: 1; text-decoration: underline; }

/* Acciones del modal */
.ent-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
}

/* ════════════════════════════════════════
   RESPONSIVE
════════════════════════════════════════ */
@media (max-width: 768px) {
    .cal-month-title { font-size: 1rem; min-width: 160px; }

    .cal-weekday { font-size: 0.65rem; padding: 0.4rem 0; }

    .cal-day {
        min-height: 72px;
        padding: 3px;
        gap: 1px;
    }

    .cal-day--today .cal-day-num {
        width: 18px;
        height: 18px;
        font-size: 0.65rem;
    }

    .cal-day-num { font-size: 0.65rem; }

    .cal-period-label { display: none; }

    .cal-pill {
        height: 12px;
    }

    .cal-pill-name { display: none; }

    .cal-pills { margin-top: 16px; }

    .ent-modal-dates { grid-template-columns: 1fr; }

    .cal-legend {
        gap: 0.5rem 0.875rem;
        font-size: 0.72rem;
    }
}

@media (max-width: 480px) {
    .cal-day { min-height: 56px; }
    .cal-pill { height: 10px; }
    .cal-pill-more { font-size: 0.52rem; padding: 1px 2px; }
}
</style>
