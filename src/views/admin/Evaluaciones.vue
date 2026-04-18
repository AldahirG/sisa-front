<script setup>
import api from '@/api/axios';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';

// =======================
// STATE
// =======================
const toast = useToast();

const periodos = ref([]);
const periodoSeleccionado = ref(null);
const evaluaciones = ref([]);
const loading = ref(false);

const dialogVisible = ref(false);
const evaluacionSeleccionada = ref(null);

const form = ref({
    calificacion: null,
    observaciones: ''
});

// =======================
// FILTERS (computed-based)
// =======================
const searchGlobal = ref('');
const filterEntregable = ref(null);
const filterEstado = ref(null);

const estadoOptions = [
    { label: 'Evaluado', value: true },
    { label: 'Pendiente', value: false }
];

const entregableOptions = computed(() => {
    const set = new Set();
    evaluaciones.value.forEach((e) => {
        if (e.entregable?.nombre) set.add(e.entregable.nombre);
    });
    return Array.from(set).sort();
});

const filteredEvaluaciones = computed(() => {
    let result = evaluaciones.value;

    if (searchGlobal.value?.trim()) {
        const q = searchGlobal.value.trim().toLowerCase();
        result = result.filter(
            (e) =>
                e.alumno?.nombre?.toLowerCase().includes(q) ||
                e.alumno?.matricula?.toLowerCase().includes(q) ||
                e.alumno?.carrera?.toLowerCase().includes(q) ||
                e.entregable?.nombre?.toLowerCase().includes(q)
        );
    }

    if (filterEntregable.value) {
        result = result.filter((e) => e.entregable?.nombre === filterEntregable.value);
    }

    if (filterEstado.value !== null && filterEstado.value !== undefined) {
        result = result.filter((e) => e.evaluado === filterEstado.value);
    }

    return result;
});

// =======================
// FORMATOS
// =======================
const formatFechaHora = (fecha) => {
    if (!fecha) return '—';
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    return d.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const normalizeDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

// =======================
// Ver archivo
// =======================
const verArchivo = (url) => {
    if (!url) {
        toast.add({
            severity: 'warn',
            summary: 'Archivo no disponible',
            detail: 'No se encontró el enlace del entregable',
            life: 3000
        });
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
};

// =======================
// LOAD PERIODOS
// =======================
const loadPeriodos = async () => {
    try {
        const { data } = await api.get('/periodos');
        periodos.value = data;
        // AUTO-SELECT: active period first, fallback to first
        periodoSeleccionado.value = data.find((p) => p.estado === 'activo') ?? data[0] ?? null;
        if (periodoSeleccionado.value) {
            await loadEvaluaciones();
        }
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar los periodos',
            life: 4000
        });
    }
};

// =======================
// LOAD EVALUACIONES
// =======================
const loadEvaluaciones = async () => {
    if (!periodoSeleccionado.value) return;

    try {
        loading.value = true;
        // Reset filters on period change
        searchGlobal.value = '';
        filterEntregable.value = null;
        filterEstado.value = null;

        const { data } = await api.get(`/entregables/evaluaciones/periodo/${periodoSeleccionado.value.id_periodo}`);

        evaluaciones.value = data.map((e) => ({
            ...e,
            fecha_envio: e.fecha_envio ? normalizeDate(e.fecha_envio) : null
        }));
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar las evaluaciones',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
};

watch(periodoSeleccionado, loadEvaluaciones);

// =======================
// MODAL
// =======================
const abrirEvaluacion = (row) => {
    evaluacionSeleccionada.value = row;
    form.value = {
        calificacion: row.calificacion,
        observaciones: row.observaciones ?? ''
    };
    dialogVisible.value = true;
};

const guardarEvaluacion = async () => {
    try {
        await api.post(`/entregables/evaluar/${evaluacionSeleccionada.value.id_entrega}`, form.value);
        toast.add({ severity: 'success', summary: 'Evaluación guardada', life: 3000 });
        dialogVisible.value = false;
        loadEvaluaciones();
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo guardar la evaluación',
            life: 4000
        });
    }
};

// =======================
// STATS computed
// =======================
const stats = computed(() => {
    const total = evaluaciones.value.length;
    const evaluados = evaluaciones.value.filter((e) => e.evaluado).length;
    const pendientes = total - evaluados;
    return { total, evaluados, pendientes };
});

onMounted(loadPeriodos);
</script>

<template>
    <div class="page-container">
        <!-- ══════════════════════════════════
             HEADER BAR
        ══════════════════════════════════ -->
        <div class="page-header">
            <div class="page-title-group">
                <span class="page-icon">
                    <i class="pi pi-star" />
                </span>
                <div>
                    <h4 class="page-title">Evaluaciones</h4>
                    <p class="page-subtitle">Revisa y califica los entregables de alumnos</p>
                </div>
            </div>

            <Select
                v-model="periodoSeleccionado"
                :options="periodos"
                optionLabel="nombre"
                placeholder="Seleccionar período"
                class="periodo-select"
            />
        </div>

        <!-- ══════════════════════════════════
             STATS STRIP (when data loaded)
        ══════════════════════════════════ -->
        <div v-if="evaluaciones.length" class="stats-strip">
            <div class="stat-item">
                <span class="stat-icon blue"><i class="pi pi-users" /></span>
                <div>
                    <p class="stat-label">TOTAL</p>
                    <p class="stat-value">{{ stats.total }}</p>
                </div>
            </div>
            <div class="stat-item">
                <span class="stat-icon green"><i class="pi pi-check-circle" /></span>
                <div>
                    <p class="stat-label">EVALUADOS</p>
                    <p class="stat-value">{{ stats.evaluados }}</p>
                </div>
            </div>
            <div class="stat-item">
                <span class="stat-icon amber"><i class="pi pi-clock" /></span>
                <div>
                    <p class="stat-label">PENDIENTES</p>
                    <p class="stat-value">{{ stats.pendientes }}</p>
                </div>
            </div>
        </div>

        <!-- ══════════════════════════════════
             FILTER BAR
        ══════════════════════════════════ -->
        <div class="filter-bar">
            <!-- Global search -->
            <IconField class="search-field">
                <InputIcon class="pi pi-search" />
                <InputText v-model="searchGlobal" placeholder="Buscar alumno, matrícula, carrera…" />
            </IconField>

            <!-- Entregable filter -->
            <Select
                v-model="filterEntregable"
                :options="entregableOptions"
                placeholder="Entregable"
                showClear
                class="filter-select"
            />

            <!-- Estado filter -->
            <Select
                v-model="filterEstado"
                :options="estadoOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Estado"
                showClear
                class="filter-select"
            />

            <!-- Clear all -->
            <Button
                v-if="searchGlobal || filterEntregable !== null || filterEstado !== null"
                icon="pi pi-filter-slash"
                text
                severity="secondary"
                v-tooltip="'Limpiar filtros'"
                @click="searchGlobal = ''; filterEntregable = null; filterEstado = null"
            />
        </div>

        <!-- ══════════════════════════════════
             EMPTY SELECTION
        ══════════════════════════════════ -->
        <div v-if="!periodoSeleccionado && !loading" class="empty-state">
            <i class="pi pi-star empty-icon" />
            <p class="empty-text">Selecciona un período para ver las evaluaciones</p>
        </div>

        <!-- ══════════════════════════════════
             TABLE
        ══════════════════════════════════ -->
        <div v-else class="table-panel">
            <DataTable
                :value="filteredEvaluaciones"
                :loading="loading"
                paginator
                :rows="10"
                responsiveLayout="scroll"
                stripedRows
                :rowHover="true"
                class="evaluaciones-table"
            >
                <!-- Alumno -->
                <Column field="alumno.nombre" header="Alumno">
                    <template #body="{ data }">
                        <div class="alumno-cell">
                            <span class="alumno-avatar">
                                {{ (data.alumno?.nombre ?? '?')[0].toUpperCase() }}
                            </span>
                            <div>
                                <p class="alumno-nombre">{{ data.alumno?.nombre ?? '—' }}</p>
                                <p class="alumno-carrera">{{ data.alumno?.carrera ?? '—' }}</p>
                            </div>
                        </div>
                    </template>
                </Column>

                <!-- Matrícula -->
                <Column field="alumno.matricula" header="Matrícula">
                    <template #body="{ data }">
                        <span class="matricula-chip">{{ data.alumno?.matricula ?? '—' }}</span>
                    </template>
                </Column>

                <!-- Entregable -->
                <Column field="entregable.nombre" header="Entregable">
                    <template #body="{ data }">
                        <span class="entregable-name">{{ data.entregable?.nombre ?? '—' }}</span>
                    </template>
                </Column>

                <!-- Fecha entrega -->
                <Column field="fecha_envio" header="Fecha entrega">
                    <template #body="{ data }">
                        <span class="fecha-text">{{ formatFechaHora(data.fecha_envio) }}</span>
                    </template>
                </Column>

                <!-- Estado -->
                <Column field="evaluado" header="Estado" style="width: 120px">
                    <template #body="{ data }">
                        <Tag
                            :value="data.evaluado ? 'Evaluado' : 'Pendiente'"
                            :severity="data.evaluado ? 'success' : 'warning'"
                        />
                    </template>
                </Column>

                <!-- Calificación -->
                <Column field="calificacion" header="Calificación" style="width: 110px">
                    <template #body="{ data }">
                        <span v-if="data.calificacion !== null && data.calificacion !== undefined" class="calificacion-badge" :class="data.calificacion >= 6 ? 'cal-pass' : 'cal-fail'">
                            {{ data.calificacion }}
                        </span>
                        <span v-else class="calificacion-empty">—</span>
                    </template>
                </Column>

                <!-- Acciones -->
                <Column header="Acciones" style="width: 80px">
                    <template #body="{ data }">
                        <Button
                            icon="pi pi-eye"
                            text
                            size="small"
                            v-tooltip="'Ver / Evaluar'"
                            @click="abrirEvaluacion(data)"
                        />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- ══════════════════════════════════
             EVALUATION DIALOG
        ══════════════════════════════════ -->
        <Dialog
            v-model:visible="dialogVisible"
            modal
            header="Evaluar entregable"
            :style="{ width: '580px' }"
            :breakpoints="{ '960px': '90vw', '640px': '95vw' }"
        >
            <div class="eval-form" v-if="evaluacionSeleccionada">
                <!-- Info header -->
                <div class="eval-info-header">
                    <div class="eval-avatar">
                        {{ (evaluacionSeleccionada.alumno?.nombre ?? '?')[0].toUpperCase() }}
                    </div>
                    <div>
                        <p class="eval-alumno-name">{{ evaluacionSeleccionada.alumno?.nombre }}</p>
                        <p class="eval-alumno-meta">
                            {{ evaluacionSeleccionada.alumno?.matricula }} ·
                            {{ evaluacionSeleccionada.alumno?.carrera }}
                        </p>
                    </div>
                </div>

                <div class="eval-grid">
                    <!-- Entregable -->
                    <div class="field full-field">
                        <label class="field-label">
                            <i class="pi pi-box" />
                            Entregable
                        </label>
                        <InputText :value="evaluacionSeleccionada.entregable?.nombre" disabled class="w-full" />
                    </div>

                    <!-- Archivo -->
                    <div class="field">
                        <label class="field-label">
                            <i class="pi pi-file" />
                            Archivo entregado
                        </label>
                        <Button
                            icon="pi pi-external-link"
                            label="Ver archivo"
                            severity="info"
                            outlined
                            @click="verArchivo(evaluacionSeleccionada.archivo_url)"
                        />
                    </div>

                    <!-- Calificación -->
                    <div class="field">
                        <label class="field-label">
                            <i class="pi pi-star" />
                            Calificación (0 – 10)
                        </label>
                        <InputNumber
                            v-model="form.calificacion"
                            :min="0"
                            :max="10"
                            :step="0.5"
                            showButtons
                            class="w-full"
                        />
                    </div>

                    <!-- Observaciones -->
                    <div class="field full-field">
                        <label class="field-label">
                            <i class="pi pi-comment" />
                            Observaciones
                        </label>
                        <Textarea v-model="form.observaciones" rows="4" autoResize class="w-full" placeholder="Comentarios opcionales para el alumno…" />
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <Button label="Cancelar" text @click="dialogVisible = false" />
                    <Button label="Guardar evaluación" icon="pi pi-check" severity="success" @click="guardarEvaluacion" />
                </div>
            </template>
        </Dialog>

        <Toast />
    </div>
</template>

<style scoped>
/* ══════════════════════════════════
   PAGE LAYOUT
══════════════════════════════════ */
.page-container {
    padding: 1.5rem;
}

/* ══════════════════════════════════
   HEADER
══════════════════════════════════ */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
}

.page-title-group {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.page-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: .75rem;
    background: var(--sisa-tint-amber);
    color: var(--sisa-icon-amber);
    font-size: 1.2rem;
    flex-shrink: 0;
}

.page-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--p-text-color);
    line-height: 1.2;
}

.page-subtitle {
    margin: .15rem 0 0;
    font-size: .82rem;
    color: var(--p-text-muted-color);
}

.periodo-select {
    min-width: 220px;
}

/* ══════════════════════════════════
   STATS STRIP
══════════════════════════════════ */
.stats-strip {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
}

.stat-item {
    display: flex;
    align-items: center;
    gap: .75rem;
    padding: .75rem 1.25rem;
    border-radius: .75rem;
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    flex: 1;
    min-width: 120px;
}

.stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: .5rem;
    font-size: 1rem;
    flex-shrink: 0;
}

.stat-icon.blue   { background: var(--sisa-tint-blue);  color: var(--sisa-icon-blue);  }
.stat-icon.green  { background: var(--sisa-tint-green); color: var(--sisa-icon-green); }
.stat-icon.amber  { background: var(--sisa-tint-amber); color: var(--sisa-icon-amber); }

.stat-label {
    margin: 0;
    font-size: .65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: var(--p-text-muted-color);
}

.stat-value {
    margin: .1rem 0 0;
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--p-text-color);
    line-height: 1;
}

/* ══════════════════════════════════
   FILTER BAR
══════════════════════════════════ */
.filter-bar {
    display: flex;
    align-items: center;
    gap: .75rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
}

.search-field {
    flex: 1;
    min-width: 200px;
}

.search-field :deep(.p-inputtext) {
    width: 100%;
}

.filter-select {
    min-width: 160px;
}

/* ══════════════════════════════════
   EMPTY STATE
══════════════════════════════════ */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 4rem 2rem;
    color: var(--p-text-muted-color);
}

.empty-icon {
    font-size: 3rem;
    opacity: .3;
}

.empty-text {
    margin: 0;
    font-size: .95rem;
}

/* ══════════════════════════════════
   TABLE PANEL
══════════════════════════════════ */
.table-panel {
    border-radius: .75rem;
    border: 1px solid var(--p-content-border-color);
    overflow: hidden;
    background: var(--p-content-background);
}

/* ── Alumno cell ──────────────── */
.alumno-cell {
    display: flex;
    align-items: center;
    gap: .65rem;
}

.alumno-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue);
    font-size: .8rem;
    font-weight: 700;
    flex-shrink: 0;
}

.alumno-nombre {
    margin: 0;
    font-size: .88rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.alumno-carrera {
    margin: .1rem 0 0;
    font-size: .75rem;
    color: var(--p-text-muted-color);
}

/* ── Matricula chip ───────────── */
.matricula-chip {
    font-size: .8rem;
    font-weight: 600;
    padding: .2rem .55rem;
    border-radius: .35rem;
    background: var(--p-content-border-color);
    color: var(--p-text-color);
    font-family: monospace;
}

/* ── Entregable name ──────────── */
.entregable-name {
    font-weight: 500;
    font-size: .88rem;
    color: var(--p-text-color);
}

/* ── Fecha ────────────────────── */
.fecha-text {
    font-size: .82rem;
    color: var(--p-text-muted-color);
}

/* ── Calificación badge ─────── */
.calificacion-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    font-weight: 700;
    font-size: .88rem;
}

.cal-pass {
    background: var(--sisa-tint-green);
    color: var(--sisa-icon-green);
}

.cal-fail {
    background: var(--sisa-tint-red);
    color: var(--sisa-icon-red);
}

.calificacion-empty {
    color: var(--p-text-muted-color);
    font-size: .9rem;
}

/* ══════════════════════════════════
   EVALUATION DIALOG
══════════════════════════════════ */
.eval-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* Info header */
.eval-info-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border-radius: .75rem;
    background: var(--sisa-tint-blue);
    border: 1px solid var(--p-content-border-color);
}

.eval-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: var(--sisa-icon-blue);
    color: #fff;
    font-size: 1.15rem;
    font-weight: 700;
    flex-shrink: 0;
}

.eval-alumno-name {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--p-text-color);
}

.eval-alumno-meta {
    margin: .2rem 0 0;
    font-size: .8rem;
    color: var(--p-text-muted-color);
}

/* Form grid */
.eval-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
}

.field {
    display: flex;
    flex-direction: column;
    gap: .45rem;
}

.field-label {
    font-size: .78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--p-text-muted-color);
    display: flex;
    align-items: center;
    gap: .4rem;
}

.full-field {
    grid-column: 1 / 3;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: .75rem;
}

/* ══════════════════════════════════
   RESPONSIVE
══════════════════════════════════ */
@media (max-width: 768px) {
    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .periodo-select {
        width: 100%;
    }

    .filter-bar {
        flex-direction: column;
        align-items: stretch;
    }

    .search-field,
    .filter-select {
        width: 100%;
        min-width: unset;
    }

    .stats-strip {
        flex-direction: column;
    }

    .eval-grid {
        grid-template-columns: 1fr;
    }

    .full-field {
        grid-column: auto;
    }
}
</style>
