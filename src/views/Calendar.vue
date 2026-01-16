<script setup>
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// PrimeVue
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

// =======================
// STATE
// =======================
const currentDate = ref(new Date());

const eventos = ref([]); // periodos + entregables (rangos)

const dayModalVisible = ref(false);
const eventModalVisible = ref(false);

const eventosDelDia = ref([]);
const selectedEvent = ref(null);

// =======================
// DATE HELPERS
// =======================
const normalizeDate = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date;
};

const mostrarFinEntregable = (e, day) => {
    return dateKey(e.fin) === dateKey(day);
};

const startOfMonth = computed(() => new Date(currentDate.value.getFullYear(), currentDate.value.getMonth(), 1));

const startCalendar = computed(() => {
    const d = new Date(startOfMonth.value);
    d.setDate(d.getDate() - d.getDay()); // domingo
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

const dateKey = (d) => normalizeDate(d).toISOString().split('T')[0];

const isToday = (d) => {
    const t = normalizeDate(new Date());
    const day = normalizeDate(d);
    return day.getTime() === t.getTime();
};

const isCurrentMonth = (d) => d.getMonth() === currentDate.value.getMonth();

// =======================
// LOAD EVENTOS (CENTRAL)
// =======================
const loadEventos = async () => {
    eventos.value = [];

    try {
        // 🔵 SOLO PERIODOS ACTIVOS
        const { data: periodos } = await api.get('/periodos/activos');

        for (const p of periodos) {
            // =======================
            // PERIODO (RANGO AZUL)
            // =======================
            let inicioPeriodo = normalizeDate(p.fecha_inicio);
            let finPeriodo = normalizeDate(p.fecha_fin);

            // 🔒 Protección cruce de año (Dic → Ene)
            if (finPeriodo < inicioPeriodo) {
                finPeriodo.setFullYear(finPeriodo.getFullYear() + 1);
            }

            eventos.value.push({
                tipo: 'periodo',
                id_periodo: p.id_periodo,
                nombre: p.nombre,
                inicio: inicioPeriodo,
                fin: finPeriodo
            });

            // =======================
            // ENTREGABLES (RANGO VERDE)
            // =======================
            const { data: entregables } = await api.get(`/entregables/periodo/${p.id_periodo}`);

            entregables.forEach((e) => {
                const inicioEntrega = e.fecha_inicio ? normalizeDate(e.fecha_inicio) : normalizeDate(e.fecha_limite); // fallback temporal

                const finEntrega = normalizeDate(e.fecha_limite);

                eventos.value.push({
                    tipo: 'entregable',
                    id_entregable: e.id_entregable,
                    numero: e.numero,
                    nombre: e.nombre,
                    descripcion: e.descripcion,
                    inicio: inicioEntrega,
                    fin: finEntrega,
                    fecha_limite: e.fecha_limite
                });
            });
        }
    } catch (err) {
        console.error('Error cargando eventos del calendario', err);
    }
};

// =======================
// FILTERS
// =======================

// 🟢 Entregables visibles dentro de su rango
const entregablesEnDia = (day) => {
    const d = normalizeDate(day);

    return eventos.value.filter((e) => {
        if (e.tipo !== 'entregable') return false;
        return d >= e.inicio && d <= e.fin;
    });
};

// 🔵 Periodos visibles dentro de su rango
const periodosEnDia = (day) => {
    const d = normalizeDate(day);

    return eventos.value.filter((e) => {
        if (e.tipo !== 'periodo') return false;
        return d >= e.inicio && d <= e.fin;
    });
};

// Mostrar nombre SOLO el día de inicio
const mostrarNombrePeriodo = (p, day) => dateKey(p.inicio) === dateKey(day);

const mostrarNombreEntregable = (e, day) => dateKey(e.inicio) === dateKey(day);

// =======================
// CLICK HANDLERS
// =======================
const openDay = (day) => {
    const periodos = periodosEnDia(day);
    const entregables = entregablesEnDia(day);

    eventosDelDia.value = [...periodos, ...entregables];

    if (eventosDelDia.value.length) {
        dayModalVisible.value = true;
    }
};

const openEvent = (e) => {
    selectedEvent.value = e;
    eventModalVisible.value = true;
};

const editarEntregable = (e) => {
    eventModalVisible.value = false;
    dayModalVisible.value = false;

    router.push({
        name: 'admin-entregables',
        query: {
            id: e.id_entregable,
            refresh: 1
        }
    });
};

const estadoEntregable = (e, day) => {
    const d = normalizeDate(day);

    if (d < e.inicio) return 'not-started';
    if (d > e.fin) return 'expired';
    if (dateKey(d) === dateKey(e.fin)) return 'due-today';
    return 'available';
};

const posicionEntregable = (e, day) => {
    if (dateKey(day) === dateKey(e.inicio)) return 'start';
    if (dateKey(day) === dateKey(e.fin)) return 'end';
    return 'middle';
};

// =======================
// NAV
// =======================
const prevMonth = () => {
    currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1);
};

const nextMonth = () => {
    currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1);
};

// =======================
// 🔄 REFRESH AUTOMÁTICO
// =======================
watch(
    () => route.query.refresh,
    (val) => {
        if (val) {
            loadEventos();
            router.replace({ query: {} });
        }
    }
);

// =======================
// INIT
// =======================
onMounted(loadEventos);
</script>
<template>
    <div class="calendar-wrapper">
        <!-- ===================== -->
        <!-- HEADER -->
        <!-- ===================== -->
        <div class="calendar-header">
            <Button icon="pi pi-angle-left" text @click="prevMonth" />

            <h3 class="month-title">
                {{ currentDate.toLocaleString('es-MX', { month: 'long', year: 'numeric' }) }}
            </h3>

            <Button icon="pi pi-angle-right" text @click="nextMonth" />
        </div>

        <!-- ===================== -->
        <!-- GRID -->
        <!-- ===================== -->
        <div class="calendar-grid">
            <!-- DÍAS DE LA SEMANA -->
            <div v-for="d in ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']" :key="d" class="day-name">
                {{ d }}
            </div>

            <!-- DÍAS -->
            <div
                v-for="day in calendarDays"
                :key="day.toISOString()"
                class="day-cell"
                :class="{
                    today: isToday(day),
                    'other-month': !isCurrentMonth(day)
                }"
                @click="openDay(day)"
            >
                <!-- NÚMERO DEL DÍA -->
                <span class="day-number">
                    {{ day.getDate() }}
                    <small v-if="!isCurrentMonth(day)">
                        {{ day.toLocaleString('es-MX', { month: 'short' }) }}
                    </small>
                </span>

                <!-- ===================== -->
                <!-- PERIODOS ACTIVOS (AZUL) -->
                <!-- ===================== -->
                <div v-for="p in periodosEnDia(day)" :key="`periodo-${p.id_periodo}`" class="period-bg">
                    <!-- Nombre solo el día de inicio -->
                    <span v-if="mostrarNombrePeriodo(p, day)" class="period-label">
                        {{ p.nombre }}
                    </span>
                </div>

                <!-- ===================== -->
                <!-- ENTREGABLES (RANGO + INICIO / FIN) -->
                <!-- ===================== -->
                <div v-for="e in entregablesEnDia(day)" :key="`entregable-${e.id_entregable}-${dateKey(day)}`" class="entregable-layer">
                    <!-- BARRA / FONDO DEL RANGO -->
                    <div class="entregable-bg" :class="estadoEntregable(e, day)" @click.stop="openEvent(e)" />

                    <!-- ETIQUETA DE INICIO -->
                    <div v-if="dateKey(day) === dateKey(e.inicio)" class="entregable-title start" @click.stop="openEvent(e)">🚀 Inicio · {{ e.nombre }}</div>

                    <!-- ETIQUETA DE FIN -->
                    <div v-if="dateKey(day) === dateKey(e.fin)" class="entregable-title end" @click.stop="openEvent(e)">🎯 Fin · {{ e.nombre }}</div>
                </div>
            </div>
        </div>

        <!-- ===================== -->
        <!-- MODAL DÍA -->
        <!-- ===================== -->
        <Dialog v-model:visible="dayModalVisible" modal header="Eventos del día" :style="{ width: '420px' }">
            <div v-for="e in eventosDelDia" :key="`${e.tipo}-${e.id_entregable || e.id_periodo}`" class="event-row" @click="e.tipo === 'entregable' && openEvent(e)">
                <div class="event-info">
                    <strong>{{ e.nombre }}</strong>

                    <div class="event-meta">
                        <Tag :value="e.tipo === 'periodo' ? 'Periodo' : 'Entregable'" :severity="e.tipo === 'periodo' ? 'info' : 'success'" />

                        <span class="event-range">
                            {{ e.inicio.toISOString().split('T')[0] }}
                            →
                            {{ e.fin.toISOString().split('T')[0] }}
                        </span>
                    </div>
                </div>

                <i v-if="e.tipo === 'entregable'" class="pi pi-chevron-right" />
            </div>
        </Dialog>

        <!-- ===================== -->
        <!-- MODAL ENTREGABLE -->
        <!-- ===================== -->
        <Dialog v-model:visible="eventModalVisible" modal header="Detalle del entregable" :style="{ width: '460px' }">
            <template v-if="selectedEvent">
                <p class="mb-1">
                    <strong>#{{ selectedEvent.numero }}</strong>
                </p>

                <h4 class="mb-2">
                    {{ selectedEvent.nombre }}
                </h4>

                <p class="mb-3 text-sm">
                    {{ selectedEvent.descripcion }}
                </p>

                <!-- ESTADO -->
                <Tag
                    class="mb-3"
                    :value="estadoEntregable(selectedEvent, new Date())"
                    :severity="
                        {
                            'not-started': 'warning',
                            available: 'success',
                            'due-today': 'danger',
                            expired: 'secondary'
                        }[estadoEntregable(selectedEvent, new Date())]
                    "
                />

                <p class="mb-2">
                    <i class="pi pi-calendar mr-1" />
                    Disponible desde:
                    <strong>
                        {{ selectedEvent.inicio.toISOString().split('T')[0] }}
                    </strong>
                </p>

                <p class="mb-4">
                    <i class="pi pi-calendar mr-1" />
                    Fecha límite:
                    <strong>
                        {{ selectedEvent.fin.toISOString().split('T')[0] }}
                    </strong>
                </p>

                <div class="flex justify-end gap-2">
                    <Button v-if="auth.user?.rol === 'admin'" label="Editar" icon="pi pi-pencil" @click="editarEntregable(selectedEvent)" />

                    <Button v-if="auth.user?.rol === 'alumno'" label="Ir a entregable" icon="pi pi-upload" severity="success" :disabled="estadoEntregable(selectedEvent, new Date()) !== 'available'" />
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* =======================
   CONTENEDOR GENERAL
======================= */
.calendar-wrapper {
    background: var(--surface-card);
    border-radius: 12px;
    padding: 1rem;
    box-shadow: var(--card-shadow);
    color: var(--text-color);
}

/* =======================
   HEADER
======================= */
.calendar-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
}

.month-title {
    font-weight: 600;
    text-transform: capitalize;
}

/* =======================
   GRID GENERAL
======================= */
.calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-top: 1rem;
    border: 1px solid var(--surface-border);
    border-radius: 10px;
    overflow: hidden;
}

/* =======================
   NOMBRE DE DÍAS
======================= */
.day-name {
    text-align: center;
    font-weight: 600;
    padding: 0.6rem 0;
    background: var(--surface-ground);
    color: var(--text-color-secondary);
    border-bottom: 1px solid var(--surface-border);
}

/* =======================
   CELDA DE DÍA
======================= */
.day-cell {
    min-height: 120px;
    border: 1px solid var(--surface-border);
    padding: 6px;
    position: relative;
    cursor: pointer;
    background: var(--surface-card);
    transition: background 0.2s ease;
}

.day-cell:hover {
    background: var(--surface-hover);
}

/* =======================
   HOY
======================= */
.day-cell.today {
    outline: 2px solid var(--primary-color);
    outline-offset: -2px;
    background: color-mix(in srgb, var(--primary-color) 6%, transparent);
}

/* =======================
   DÍAS FUERA DEL MES
======================= */
.day-cell.other-month {
    opacity: 0.45;
}

/* =======================
   NÚMERO DEL DÍA
======================= */
.day-number {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-color-secondary);
}

/* =======================
   PERIODOS ACTIVOS (AZUL)
======================= */
.period-bg {
    position: absolute;
    inset: 4px;
    background: color-mix(in srgb, var(--primary-color) 18%, transparent);
    border-radius: 6px;
    z-index: 0;
    pointer-events: none;
}

/* Refuerzo modo oscuro */
:root.dark .period-bg,
.p-dark .period-bg {
    background: color-mix(in srgb, var(--primary-color) 28%, transparent);
}

/* Texto del periodo */
.period-label {
    position: relative;
    z-index: 1;
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--primary-color);
    display: block;
    margin-top: 2px;
}

/* =======================
   ENTREGABLES – RANGO
======================= */
.entregable-bg {
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: 6px;
    height: 18px;
    border-radius: 4px;
    z-index: 2;
    display: flex;
    align-items: center;
    padding-left: 6px;
    font-size: 0.65rem;
    font-weight: 500;
    color: var(--primary-color-text);
    cursor: pointer;
    transition:
        filter 0.15s ease,
        transform 0.15s ease;
}

/* Hover */
.entregable-bg:hover {
    filter: brightness(1.05);
    transform: translateY(-1px);
}

/* =======================
   TÍTULO DEL ENTREGABLE
======================= */
.entregable-title {
    font-weight: 700;
    font-size: 0.7rem;
    color: #ffffff;
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.25);
    border-left: 3px solid #ffffff;
    line-height: 1.2;
}

.entregable-bg.entregable-start::before {
    content: '📌';
    margin-right: 4px;
}

/* Texto SOLO el día de inicio */
.entregable-bg span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* =======================
   ESTADOS DE ENTREGABLE
======================= */

/* 🟡 AÚN NO DISPONIBLE */
.entregable-bg.not-started {
    background: color-mix(in srgb, var(--yellow-500) 75%, transparent);
    color: var(--text-color);
}

/* 🟢 DISPONIBLE */
.entregable-bg.available {
    background: color-mix(in srgb, var(--green-500) 75%, transparent);
}

/* 🔴 VENCIDO */
.entregable-bg.expired {
    background: color-mix(in srgb, var(--red-500) 80%, transparent);
    color: var(--primary-color-text);
    opacity: 0.85;
}

/* 🔴 VENCE HOY */
.entregable-bg.due-today {
    background: color-mix(in srgb, var(--red-500) 90%, transparent);
    font-weight: 600;
}

/* Día de inicio (refuerzo visual) */
.entregable-start {
    box-shadow: inset 4px 0 0 var(--surface-0);
}

/* =======================
   MODALES
======================= */
.p-dialog {
    background: var(--surface-card);
    color: var(--text-color);
    z-index: 2000;
}

.p-dialog-header {
    border-bottom: 1px solid var(--surface-border);
}

.p-dialog-content {
    color: var(--text-color);
}
o .event-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0;
    border-bottom: 1px solid var(--surface-border);
    cursor: pointer;
}

.event-row:last-child {
    border-bottom: none;
}

.event-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.event-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-color-secondary);
}

.event-range {
    opacity: 0.8;
}

/* =======================
   RESPONSIVE
======================= */
@media (max-width: 768px) {
    .calendar-grid {
        font-size: 0.75rem;
    }

    .day-cell {
        min-height: 90px;
    }

    .entregable-bg {
        height: 16px;
        font-size: 0.6rem;
    }
}
</style>
