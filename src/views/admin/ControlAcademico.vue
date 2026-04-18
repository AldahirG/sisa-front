<script setup>
import api from '@/api/axios';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// ==========================
// STATE
// ==========================
const loading = ref(false);
const alumnos = ref([]);
const periodos = ref([]);
const toast = useToast();
const showCerrarDialog = ref(false);

// Avanzar prácticas
const loadingAvanzar = ref(false);
const showAvanzarDialog = ref(false);
const showResultadosDialog = ref(false);
const resultadosAvanzar = ref(null);

const filtros = ref({
    periodo: null,
    empresa: null,
    search: ''
});

// ==========================
// LOADERS
// ==========================
const loadAlumnos = async () => {
    loading.value = true;
    try {
        const { data } = await api.get('/control-academico');
        alumnos.value = data ?? [];
    } finally {
        loading.value = false;
    }
};

const loadPeriodos = async () => {
    const { data } = await api.get('/periodos');
    periodos.value = data ?? [];
};

onMounted(async () => {
    await Promise.all([loadAlumnos(), loadPeriodos()]);
});

// ==========================
// COMPUTED
// ==========================
const periodoActivo = computed(() => periodos.value.find((p) => p.estado === 'activo') ?? null);

const empresasOptions = computed(() => {
    const map = new Map();
    for (const a of alumnos.value) {
        const e = a?.empresa;
        if (e?.id_empresa && !map.has(e.id_empresa)) {
            map.set(e.id_empresa, e);
        }
    }
    return Array.from(map.values()).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
});

const alumnosFiltrados = computed(() => {
    const search = filtros.value.search.toLowerCase().trim();

    return alumnos.value.filter((a) => {
        const matchPeriodo = !filtros.value.periodo || a.periodo.id_periodo === filtros.value.periodo.id_periodo;
        const matchEmpresa = !filtros.value.empresa || a.empresa.id_empresa === filtros.value.empresa.id_empresa;
        const matchSearch =
            !search ||
            a.alumno.nombre.toLowerCase().includes(search) ||
            a.alumno.matricula.toLowerCase().includes(search) ||
            a.empresa.nombre.toLowerCase().includes(search) ||
            a.vacante.nombre.toLowerCase().includes(search);

        return matchPeriodo && matchEmpresa && matchSearch;
    });
});

// ==========================
// SUMMARY BADGES
// ==========================
const summaryStats = computed(() => {
    const total = alumnos.value.length;
    const asignados = alumnos.value.filter(
        (a) => a.asignacion_estado === 'ACEPTADO' || a.asignacion_estado === 'POSTULADO'
    ).length;
    const sinAsignar = alumnos.value.filter((a) => !a.asignacion_estado || a.asignacion_estado === 'SIN_ASIGNAR').length;
    const conBaja = alumnos.value.filter((a) => a.alumno?.estado === 'baja').length;
    return { total, asignados, sinAsignar, conBaja };
});

// ==========================
// ACTIONS
// ==========================
const verDetalle = (row) => {
    router.push({ name: 'admin-control-academico-detalle', params: { id: row.alumno.id_alumno } });
};

const confirmarCerrarPostulaciones = async () => {
    if (!periodoActivo.value) {
        toast.add({
            severity: 'warn',
            summary: 'Sin período activo',
            detail: 'No hay ningún período activo. Activa un período antes de cerrar postulaciones.',
            life: 5000
        });
        return;
    }

    loading.value = true;
    try {
        const { data } = await api.post('/control-academico/cerrar-postulaciones', {
            id_periodo: periodoActivo.value.id_periodo
        });

        toast.add({
            severity: 'success',
            summary: 'Postulaciones cerradas',
            detail: `Período: ${periodoActivo.value.nombre} · Aceptados: ${data.aceptados_por_postulacion} · Automáticos: ${data.asignados_automaticamente} · Sin cupo: ${data.alumnos_sin_cupo}`,
            life: 6000
        });

        showCerrarDialog.value = false;
        await loadAlumnos();
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: err.response?.data?.message || 'No se pudo cerrar postulaciones'
        });
    } finally {
        loading.value = false;
    }
};

const confirmarAvanzarPracticas = async () => {
    if (!periodoActivo.value) {
        toast.add({
            severity: 'warn',
            summary: 'Sin período activo',
            detail: 'No hay ningún período activo para avanzar prácticas.',
            life: 5000
        });
        return;
    }

    loadingAvanzar.value = true;
    try {
        const { data } = await api.post(`/control-academico/avanzar-practicas/${periodoActivo.value.id_periodo}`);
        resultadosAvanzar.value = data;
        showAvanzarDialog.value = false;
        showResultadosDialog.value = true;
        await loadAlumnos();
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: err.response?.data?.message || 'No se pudo avanzar prácticas',
            life: 5000
        });
    } finally {
        loadingAvanzar.value = false;
    }
};

// ==========================
// UI HELPERS
// ==========================
const asignacionSeverity = (estado) => {
    if (estado === 'ACEPTADO') return 'success';
    if (estado === 'POSTULADO') return 'info';
    if (estado === 'RECHAZADO') return 'danger';
    return 'secondary';
};

const asignacionLabel = (estado) => {
    if (!estado || estado === 'SIN_ASIGNAR') return 'Sin asignar';
    return estado.charAt(0) + estado.slice(1).toLowerCase();
};

const entregablesProgress = (row) => {
    const entregables = row.entregables ?? [];
    const total = entregables.length;
    const entregados = entregables.filter((e) => e.calificacion !== null && e.calificacion !== undefined).length;
    return { total, entregados };
};

const progressPct = (row) => {
    const { total, entregados } = entregablesProgress(row);
    if (!total) return 0;
    return Math.round((entregados / total) * 100);
};
</script>

<template>
    <div class="page-container">
        <!-- ========================= -->
        <!-- PAGE HEADER               -->
        <!-- ========================= -->
        <div class="page-header">
            <div class="header-left">
                <div class="header-icon">
                    <i class="pi pi-graduation-cap"></i>
                </div>
                <div class="header-text">
                    <h1 class="page-title">Control Académico</h1>
                    <p class="page-subtitle">Seguimiento de prácticas profesionales por alumno</p>
                </div>
            </div>

            <div class="header-right">
                <div class="summary-badges">
                    <div class="badge badge-blue">
                        <span class="badge-num">{{ summaryStats.total }}</span>
                        <span class="badge-lbl">Total</span>
                    </div>
                    <div class="badge badge-green">
                        <span class="badge-num">{{ summaryStats.asignados }}</span>
                        <span class="badge-lbl">Asignados</span>
                    </div>
                    <div class="badge badge-amber">
                        <span class="badge-num">{{ summaryStats.sinAsignar }}</span>
                        <span class="badge-lbl">Sin asignar</span>
                    </div>
                    <div class="badge badge-red">
                        <span class="badge-num">{{ summaryStats.conBaja }}</span>
                        <span class="badge-lbl">Baja</span>
                    </div>
                </div>
                <Button
                    icon="pi pi-arrow-up-right"
                    label="Avanzar prácticas"
                    severity="warning"
                    class="cerrar-btn"
                    :disabled="!periodoActivo"
                    v-tooltip.left="periodoActivo ? `Avanzar número de práctica (período: ${periodoActivo.nombre})` : 'No hay ningún período activo'"
                    @click="showAvanzarDialog = true"
                />
                <Button
                    icon="pi pi-lock"
                    :label="periodoActivo ? `Cerrar postulaciones` : 'Sin período activo'"
                    severity="danger"
                    class="cerrar-btn"
                    :disabled="!periodoActivo"
                    v-tooltip.left="periodoActivo ? `Cerrará postulaciones del período: ${periodoActivo.nombre}` : 'No hay ningún período activo'"
                    @click="showCerrarDialog = true"
                />
            </div>
        </div>

        <!-- ========================= -->
        <!-- FILTERS BAR               -->
        <!-- ========================= -->
        <div class="filters-bar">
            <div class="search-wrap">
                <i class="pi pi-search search-icon"></i>
                <InputText
                    v-model="filtros.search"
                    placeholder="Buscar por nombre, matrícula o empresa..."
                    class="search-input"
                />
            </div>

            <Select
                v-model="filtros.periodo"
                :options="periodos"
                optionLabel="nombre"
                placeholder="Todos los períodos"
                showClear
                class="filter-select"
            />

            <Select
                v-model="filtros.empresa"
                :options="empresasOptions"
                optionLabel="nombre"
                placeholder="Todas las empresas"
                showClear
                class="filter-select"
            />

            <Button
                icon="pi pi-refresh"
                text
                rounded
                v-tooltip.top="'Recargar'"
                :loading="loading"
                @click="loadAlumnos"
                class="reload-btn"
            />
        </div>

        <!-- ========================= -->
        <!-- TABLA                     -->
        <!-- ========================= -->
        <div class="table-wrap">
            <DataTable
                :value="alumnosFiltrados"
                paginator
                :rows="10"
                :loading="loading"
                responsiveLayout="scroll"
                :rowHover="true"
                class="ca-table"
                :globalFilterFields="['alumno.nombre', 'alumno.matricula']"
            >
                <!-- ALUMNO -->
                <Column header="Alumno" style="min-width: 180px">
                    <template #body="{ data }">
                        <div class="cell-stack">
                            <span class="cell-primary">{{ data.alumno.nombre }}</span>
                            <span class="cell-secondary">
                                <i class="pi pi-id-card cell-icon"></i>
                                {{ data.alumno.matricula }}
                            </span>
                        </div>
                    </template>
                </Column>

                <!-- EMPRESA / VACANTE -->
                <Column header="Empresa / Vacante" style="min-width: 200px">
                    <template #body="{ data }">
                        <div class="cell-stack">
                            <span class="cell-primary">{{ data.empresa.nombre }}</span>
                            <span class="cell-secondary">
                                <i class="pi pi-briefcase cell-icon"></i>
                                {{ data.vacante.nombre }}
                            </span>
                            <Tag
                                v-if="data.asignacion_tipo === 'automatica'"
                                value="Asignación automática"
                                severity="warning"
                                class="auto-tag"
                            />
                        </div>
                    </template>
                </Column>

                <!-- PERÍODO -->
                <Column header="Período" style="min-width: 120px">
                    <template #body="{ data }">
                        <span class="periodo-chip">{{ data.periodo.nombre }}</span>
                    </template>
                </Column>

                <!-- ESTADO ASIGNACIÓN -->
                <Column header="Asignación" style="min-width: 130px">
                    <template #body="{ data }">
                        <Tag
                            :value="asignacionLabel(data.asignacion_estado)"
                            :severity="asignacionSeverity(data.asignacion_estado)"
                        />
                    </template>
                </Column>

                <!-- ENTREGABLES -->
                <Column header="Entregables" style="min-width: 150px">
                    <template #body="{ data }">
                        <div class="entregables-cell">
                            <div class="entregables-label">
                                <span>{{ entregablesProgress(data).entregados }}</span>
                                <span class="sep">/</span>
                                <span>{{ entregablesProgress(data).total }}</span>
                            </div>
                            <div class="progress-track">
                                <div
                                    class="progress-fill"
                                    :style="{ width: progressPct(data) + '%' }"
                                    :class="{
                                        'fill-complete': progressPct(data) === 100,
                                        'fill-partial': progressPct(data) > 0 && progressPct(data) < 100,
                                        'fill-empty': progressPct(data) === 0
                                    }"
                                ></div>
                            </div>
                        </div>
                    </template>
                </Column>

                <!-- ACCIONES -->
                <Column header="Acciones" style="width: 100px; text-align: center">
                    <template #body="{ data }">
                        <Button
                            icon="pi pi-eye"
                            label="Ver"
                            size="small"
                            text
                            severity="info"
                            v-tooltip.top="'Ver detalle del alumno'"
                            @click="verDetalle(data)"
                        />
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- ========================= -->
        <!-- DIALOG CONFIRMACIÓN       -->
        <!-- ========================= -->
        <Dialog
            v-model:visible="showCerrarDialog"
            modal
            header="Cerrar postulaciones"
            :style="{ width: '460px' }"
        >
            <div class="dialog-body">
                <div class="dialog-icon-wrap danger">
                    <i class="pi pi-exclamation-triangle"></i>
                </div>

                <!-- Período que se verá afectado -->
                <div class="dialog-periodo-box">
                    <span class="dialog-periodo-lbl">Período a cerrar</span>
                    <span class="dialog-periodo-name">{{ periodoActivo?.nombre ?? '—' }}</span>
                </div>

                <p class="dialog-message">
                    Se aceptarán todos los alumnos <strong>postulados</strong> en este período y se asignará
                    automáticamente una empresa a quienes no realizaron postulación.
                    Los demás períodos <strong>no serán afectados</strong>.
                </p>

                <div class="dialog-warning-box">
                    <i class="pi pi-info-circle"></i>
                    <span>Esta acción es <strong>irreversible</strong>.</span>
                </div>
            </div>

            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="showCerrarDialog = false" />
                <Button
                    label="Sí, cerrar postulaciones"
                    icon="pi pi-lock"
                    severity="danger"
                    :loading="loading"
                    @click="confirmarCerrarPostulaciones"
                />
            </template>
        </Dialog>

        <!-- ========================= -->
        <!-- DIALOG AVANZAR PRÁCTICAS  -->
        <!-- ========================= -->
        <Dialog
            v-model:visible="showAvanzarDialog"
            modal
            header="Avanzar número de práctica"
            :style="{ width: '480px' }"
        >
            <div class="dialog-body">
                <div class="dialog-icon-wrap warning">
                    <i class="pi pi-arrow-up-right"></i>
                </div>

                <div class="dialog-periodo-box">
                    <span class="dialog-periodo-lbl">Período a procesar</span>
                    <span class="dialog-periodo-name">{{ periodoActivo?.nombre ?? '—' }}</span>
                </div>

                <p class="dialog-message">
                    Avanzará el <strong>número de práctica</strong> (+1) a los alumnos que fueron
                    <strong>liberados</strong> en este período. El cuatrimestre <em>no</em> se modifica aquí.
                </p>

                <div class="avanzar-rules">
                    <div class="avanzar-rule rule-green">
                        <i class="pi pi-check-circle"></i>
                        <span><strong>Liberados</strong> → pasan a la siguiente práctica</span>
                    </div>
                    <div class="avanzar-rule rule-amber">
                        <i class="pi pi-refresh"></i>
                        <span><strong>No liberados</strong> → permanecen en la misma práctica</span>
                    </div>
                    <div class="avanzar-rule rule-secondary">
                        <i class="pi pi-ban"></i>
                        <span><strong>Dados de baja</strong> → congelados, sin cambios</span>
                    </div>
                </div>

                <div class="dialog-warning-box">
                    <i class="pi pi-info-circle"></i>
                    <span>Para avanzar el <strong>grado académico (cuatrimestre)</strong> de todos los alumnos, usa el botón en la sección de Alumnos.</span>
                </div>
            </div>

            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="showAvanzarDialog = false" />
                <Button
                    label="Sí, avanzar prácticas"
                    icon="pi pi-arrow-up-right"
                    severity="warning"
                    :loading="loadingAvanzar"
                    @click="confirmarAvanzarPracticas"
                />
            </template>
        </Dialog>

        <!-- ========================= -->
        <!-- DIALOG RESULTADOS         -->
        <!-- ========================= -->
        <Dialog
            v-model:visible="showResultadosDialog"
            modal
            header="Resultado: Avanzar prácticas"
            :style="{ width: '580px' }"
        >
            <div v-if="resultadosAvanzar" class="resultados-body">
                <!-- Período -->
                <div class="resultado-periodo">
                    <i class="pi pi-calendar-check"></i>
                    <span>Período procesado: <strong>{{ resultadosAvanzar.periodo }}</strong></span>
                </div>

                <!-- Resumen de conteos -->
                <div class="resultado-resumen">
                    <div class="resumen-chip chip-green">
                        <span class="chip-num">{{ resultadosAvanzar.practica_avanzada?.length ?? 0 }}</span>
                        <span class="chip-lbl">Avanzaron</span>
                    </div>
                    <div class="resumen-chip chip-amber">
                        <span class="chip-num">{{ resultadosAvanzar.omitidos_no_liberado?.length ?? 0 }}</span>
                        <span class="chip-lbl">Sin liberar</span>
                    </div>
                    <div class="resumen-chip chip-secondary">
                        <span class="chip-num">{{ resultadosAvanzar.omitidos_baja?.length ?? 0 }}</span>
                        <span class="chip-lbl">En baja</span>
                    </div>
                </div>

                <!-- Detalle por grupo -->
                <div class="resultado-grupos">
                    <!-- Práctica avanzada -->
                    <div class="resultado-grupo" v-if="resultadosAvanzar.practica_avanzada?.length">
                        <div class="grupo-header grupo-green">
                            <i class="pi pi-check-circle"></i>
                            <span>Avanzaron a la siguiente práctica</span>
                            <span class="grupo-count">{{ resultadosAvanzar.practica_avanzada.length }}</span>
                        </div>
                        <div class="grupo-list">
                            <div
                                v-for="a in resultadosAvanzar.practica_avanzada"
                                :key="a.id_alumno ?? a.matricula"
                                class="grupo-item"
                            >
                                <span class="gi-nombre">{{ a.matricula }}</span>
                                <span class="gi-badge gi-badge-green">Práctica {{ a.numero_practica }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- No liberados -->
                    <div class="resultado-grupo" v-if="resultadosAvanzar.omitidos_no_liberado?.length">
                        <div class="grupo-header grupo-amber">
                            <i class="pi pi-refresh"></i>
                            <span>Sin avanzar (no liberados)</span>
                            <span class="grupo-count">{{ resultadosAvanzar.omitidos_no_liberado.length }}</span>
                        </div>
                        <div class="grupo-list">
                            <div
                                v-for="a in resultadosAvanzar.omitidos_no_liberado"
                                :key="a.id_alumno ?? a.matricula"
                                class="grupo-item"
                            >
                                <span class="gi-nombre">{{ a.matricula }}</span>
                                <span class="gi-badge gi-badge-amber">Sin liberar</span>
                            </div>
                        </div>
                    </div>

                    <!-- Baja -->
                    <div class="resultado-grupo" v-if="resultadosAvanzar.omitidos_baja?.length">
                        <div class="grupo-header grupo-secondary">
                            <i class="pi pi-ban"></i>
                            <span>Congelados (baja de prácticas)</span>
                            <span class="grupo-count">{{ resultadosAvanzar.omitidos_baja.length }}</span>
                        </div>
                        <div class="grupo-list">
                            <div
                                v-for="a in resultadosAvanzar.omitidos_baja"
                                :key="a.id_alumno ?? a.matricula"
                                class="grupo-item"
                            >
                                <span class="gi-nombre">{{ a.matricula }}</span>
                                <span class="gi-badge gi-badge-secondary">Baja</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button label="Cerrar" icon="pi pi-times" @click="showResultadosDialog = false" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* ================================
   PAGE CONTAINER
================================ */
.page-container {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* ================================
   PAGE HEADER
================================ */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.header-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.12));
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
}

.page-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0;
    line-height: 1.2;
}

.page-subtitle {
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
    margin: 0.15rem 0 0 0;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

/* ================================
   SUMMARY BADGES
================================ */
.summary-badges {
    display: flex;
    gap: 0.5rem;
}

.badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.4rem 0.75rem;
    border-radius: 10px;
    min-width: 58px;
}

.badge-blue {
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.1));
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
}

.badge-green {
    background: var(--sisa-tint-green, rgba(22, 163, 74, 0.1));
    color: var(--sisa-icon-green, #16a34a);
}

.badge-amber {
    background: var(--sisa-tint-amber, rgba(217, 119, 6, 0.1));
    color: var(--sisa-icon-amber, #d97706);
}

.badge-red {
    background: var(--sisa-tint-red, rgba(220, 38, 38, 0.1));
    color: var(--sisa-icon-red, #dc2626);
}

.badge-num {
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1;
}

.badge-lbl {
    font-size: 0.7rem;
    font-weight: 500;
    opacity: 0.85;
    white-space: nowrap;
}

/* ================================
   FILTERS BAR
================================ */
.filters-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.875rem 1rem;
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 12px;
}

.search-wrap {
    position: relative;
    flex: 1;
    min-width: 200px;
}

.search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--p-text-muted-color);
    font-size: 0.85rem;
    pointer-events: none;
}

.search-input {
    width: 100%;
    padding-left: 2.25rem !important;
}

.filter-select {
    min-width: 180px;
}

.reload-btn {
    flex-shrink: 0;
}

/* ================================
   TABLE
================================ */
.table-wrap {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 12px;
    overflow: hidden;
}

.ca-table :deep(.p-datatable-thead > tr > th) {
    background: var(--p-surface-50);
    color: var(--p-text-muted-color);
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--p-content-border-color);
}

.ca-table :deep(.p-datatable-tbody > tr > td) {
    border-bottom: 1px solid var(--p-content-border-color);
    padding: 0.75rem 1rem;
    vertical-align: top;
}

.ca-table :deep(.p-datatable-tbody > tr:last-child > td) {
    border-bottom: none;
}

/* ================================
   CELL STYLES
================================ */
.cell-stack {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.cell-primary {
    font-weight: 600;
    color: var(--p-text-color);
    font-size: 0.9rem;
}

.cell-secondary {
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
    display: flex;
    align-items: center;
    gap: 0.3rem;
}

.cell-icon {
    font-size: 0.75rem;
}

.auto-tag {
    margin-top: 0.3rem;
    width: fit-content;
    font-size: 0.7rem;
}

.periodo-chip {
    display: inline-block;
    padding: 0.25rem 0.65rem;
    border-radius: 20px;
    background: var(--p-surface-100);
    color: var(--p-text-color);
    font-size: 0.8rem;
    font-weight: 500;
    border: 1px solid var(--p-content-border-color);
}

/* ================================
   ENTREGABLES PROGRESS
================================ */
.entregables-cell {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.entregables-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--p-text-color);
    display: flex;
    align-items: center;
    gap: 0.2rem;
}

.sep {
    color: var(--p-text-muted-color);
    font-weight: 400;
}

.progress-track {
    height: 5px;
    border-radius: 3px;
    background: var(--p-surface-100);
    overflow: hidden;
    width: 80px;
}

.progress-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
}

.fill-complete {
    background: var(--sisa-icon-green, #16a34a);
}

.fill-partial {
    background: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
}

.fill-empty {
    background: transparent;
}

/* ================================
   DIALOG
================================ */
.dialog-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    padding: 0.5rem 0 1rem;
    text-align: center;
}

.dialog-icon-wrap {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
}

.dialog-icon-wrap.danger {
    background: var(--sisa-tint-red, rgba(220, 38, 38, 0.1));
    color: var(--sisa-icon-red, #dc2626);
}

.dialog-icon-wrap.warning {
    background: var(--sisa-tint-amber, rgba(217, 119, 6, 0.1));
    color: var(--sisa-icon-amber, #d97706);
}

.dialog-periodo-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.65rem 1.25rem;
    border-radius: 10px;
    background: var(--p-surface-50);
    border: 1px solid var(--p-content-border-color);
    width: 100%;
    box-sizing: border-box;
}

.dialog-periodo-lbl {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--p-text-muted-color);
}

.dialog-periodo-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--p-text-color);
}

.dialog-message {
    font-size: 0.92rem;
    line-height: 1.55;
    color: var(--p-text-color);
    max-width: 360px;
    margin: 0;
}

.dialog-warning-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    border-radius: 8px;
    background: var(--sisa-tint-amber, rgba(217, 119, 6, 0.1));
    color: var(--sisa-icon-amber, #d97706);
    font-size: 0.85rem;
    width: 100%;
    box-sizing: border-box;
}

/* ================================
   AVANZAR SEMESTRES – reglas en dialog
================================ */
.avanzar-rules {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    width: 100%;
}

.avanzar-rule {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    font-size: 0.84rem;
}

.rule-green    { background: rgba(22, 163, 74, 0.08);  color: var(--sisa-icon-green, #16a34a); }
.rule-amber    { background: rgba(217, 119, 6, 0.08);  color: var(--sisa-icon-amber, #d97706); }
.rule-secondary{ background: var(--p-surface-100);     color: var(--p-text-muted-color); }
.rule-blue     { background: rgba(21, 101, 192, 0.08); color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0)); }

/* ================================
   RESULTADOS DIALOG
================================ */
.resultados-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 70vh;
    overflow-y: auto;
    padding-right: 0.25rem;
}

.resultado-periodo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.88rem;
    color: var(--p-text-muted-color);
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--p-content-border-color);
}

.resultado-resumen {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
}

.resumen-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.6rem 0.5rem;
    border-radius: 10px;
    text-align: center;
}

.chip-num {
    font-size: 1.6rem;
    font-weight: 800;
    line-height: 1;
}

.chip-lbl {
    font-size: 0.7rem;
    font-weight: 500;
    opacity: 0.85;
    margin-top: 0.15rem;
}

.chip-green    { background: rgba(22, 163, 74, 0.1);   color: var(--sisa-icon-green, #16a34a); }
.chip-amber    { background: rgba(217, 119, 6, 0.1);   color: var(--sisa-icon-amber, #d97706); }
.chip-secondary{ background: var(--p-surface-100);     color: var(--p-text-muted-color); }
.chip-blue     { background: rgba(21, 101, 192, 0.1);  color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0)); }

/* Grupos de resultado */
.resultado-grupos {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.resultado-grupo {
    border: 1px solid var(--p-content-border-color);
    border-radius: 10px;
    overflow: hidden;
}

.grupo-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 0.875rem;
    font-size: 0.82rem;
    font-weight: 600;
}

.grupo-header .grupo-count {
    margin-left: auto;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.1rem 0.45rem;
    border-radius: 20px;
    background: rgba(0,0,0,0.08);
}

.grupo-green    { background: rgba(22, 163, 74, 0.1);   color: var(--sisa-icon-green, #16a34a); }
.grupo-amber    { background: rgba(217, 119, 6, 0.1);   color: var(--sisa-icon-amber, #d97706); }
.grupo-secondary{ background: var(--p-surface-100);     color: var(--p-text-muted-color); }
.grupo-blue     { background: rgba(21, 101, 192, 0.1);  color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0)); }

.grupo-list {
    display: flex;
    flex-direction: column;
}

.grupo-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.875rem;
    border-top: 1px solid var(--p-content-border-color);
    font-size: 0.83rem;
}

.gi-nombre {
    font-weight: 600;
    color: var(--p-text-color);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.gi-meta {
    font-size: 0.76rem;
    color: var(--p-text-muted-color);
    font-family: monospace;
    flex-shrink: 0;
}

.gi-badge {
    flex-shrink: 0;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.15rem 0.5rem;
    border-radius: 20px;
}

.gi-badge-green    { background: rgba(22, 163, 74, 0.12);   color: var(--sisa-icon-green, #16a34a); }
.gi-badge-amber    { background: rgba(217, 119, 6, 0.12);   color: var(--sisa-icon-amber, #d97706); }
.gi-badge-secondary{ background: var(--p-surface-100);      color: var(--p-text-muted-color); }
.gi-badge-blue     { background: rgba(21, 101, 192, 0.12);  color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0)); }

/* ================================
   RESPONSIVE
================================ */
@media (max-width: 900px) {
    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .header-right {
        width: 100%;
        flex-direction: column;
        align-items: flex-start;
    }

    .filters-bar {
        flex-direction: column;
        align-items: stretch;
    }

    .filter-select {
        min-width: unset;
        width: 100%;
    }

    .cerrar-btn {
        width: 100%;
        justify-content: center;
    }

    .summary-badges {
        width: 100%;
        justify-content: space-between;
    }
}
</style>
