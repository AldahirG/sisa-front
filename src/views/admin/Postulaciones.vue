<script setup>
import api from '@/api/axios';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

// PrimeVue
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';

const toast = useToast();

// ==========================
// STATE
// ==========================
const postulaciones = ref([]);
const loading = ref(false);

const rechazoDialog = ref(false);
const rechazoMotivo = ref('');
const postulacionSeleccionada = ref(null);

// ==========================
// ACCIONES MASIVAS
// ==========================
const showAceptarTodas  = ref(false);
const showRechazarTodas = ref(false);
const loadingMasivo     = ref(false);

const MOTIVOS_PRESET = [
    'No aplicas para este perfil',
    'Cupos ocupados en la empresa',
    'Perfil no coincide con los requisitos',
    'Vacante cancelada por la empresa',
    'Periodo de selección concluido',
    'Personalizado…'
];

const motivoRechazarTodas    = ref(MOTIVOS_PRESET[0]);
const motivoPersonalizado    = ref('');
const resultadoMasivo        = ref(null);   // { aceptadas?, rechazadas?, omitidas? }
const showResultadoMasivo    = ref(false);

// ==========================
// FILTROS
// ==========================
const filtros = ref({
    estado: null,
    empresa: null,
    periodo: null,
    search: ''
});

const estadosOpciones = [
    { label: 'Postulado', value: 'POSTULADO' },
    { label: 'Aceptado',  value: 'ACEPTADO' },
    { label: 'Rechazado', value: 'RECHAZADO' },
    { label: 'Cancelado', value: 'CANCELADO' }
];

// ==========================
// LOAD
// ==========================
const loadPostulaciones = async () => {
    loading.value = true;
    try {
        const { data } = await api.get('/postulaciones');
        postulaciones.value = data;
    } finally {
        loading.value = false;
    }
};

onMounted(loadPostulaciones);

// ==========================
// COMPUTED
// ==========================
const empresas = computed(() => {
    const map = new Map();
    postulaciones.value.forEach((p) => {
        if (p.categoria?.empresa) {
            map.set(p.categoria.empresa.id_empresa, p.categoria.empresa);
        }
    });
    return [...map.values()];
});

const periodos = computed(() => {
    const map = new Map();
    postulaciones.value.forEach((p) => {
        if (p.categoria?.periodo) {
            map.set(p.categoria.periodo.id_periodo, p.categoria.periodo);
        }
    });
    return [...map.values()];
});

const postulacionesFiltradas = computed(() => {
    return postulaciones.value.filter((p) => {
        const matchEstado  = !filtros.value.estado  || p.estado === filtros.value.estado;
        const matchEmpresa = !filtros.value.empresa || p.categoria?.empresa?.id_empresa === filtros.value.empresa.id_empresa;
        const matchPeriodo = !filtros.value.periodo || p.categoria?.periodo?.id_periodo === filtros.value.periodo.id_periodo;
        const search = filtros.value.search?.toLowerCase() || '';
        const matchSearch = !search ||
            p.alumno?.usuario?.nombre?.toLowerCase().includes(search) ||
            p.alumno?.matricula?.toLowerCase().includes(search) ||
            p.alumno?.usuario?.correo?.toLowerCase().includes(search) ||
            p.categoria?.nombre?.toLowerCase().includes(search);
        return matchEstado && matchEmpresa && matchPeriodo && matchSearch;
    });
});

// Stats computed
const countByEstado = (estado) => postulaciones.value.filter(p => p.estado === estado).length;
const totalPostuladas  = computed(() => countByEstado('POSTULADO'));
const totalAceptadas   = computed(() => countByEstado('ACEPTADO'));
const totalRechazadas  = computed(() => countByEstado('RECHAZADO'));
const totalCanceladas  = computed(() => countByEstado('CANCELADO'));

// Date formatter
const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ==========================
// ACTIONS
// ==========================
const aceptar = async (row) => {
    try {
        await api.put(`/postulaciones/${row.id_postulacion}/aceptar`);
        toast.add({ severity: 'success', summary: 'Postulación aceptada', life: 3000 });
        loadPostulaciones();
    } catch {
        toast.add({ severity: 'error', summary: 'Error al aceptar', life: 3000 });
    }
};

const abrirRechazo = (row) => {
    postulacionSeleccionada.value = row;
    rechazoMotivo.value = '';
    rechazoDialog.value = true;
};

const rechazar = async () => {
    try {
        await api.put(`/postulaciones/${postulacionSeleccionada.value.id_postulacion}/rechazar`, {
            motivo: rechazoMotivo.value
        });
        rechazoDialog.value = false;
        toast.add({ severity: 'warn', summary: 'Postulación rechazada', life: 3000 });
        loadPostulaciones();
    } catch {
        toast.add({ severity: 'error', summary: 'Error al rechazar', life: 3000 });
    }
};

// ==========================
// ACCIONES MASIVAS
// ==========================
const confirmarAceptarTodas = async () => {
    loadingMasivo.value = true;
    try {
        const { data } = await api.post('/postulaciones/aceptar-todas');
        resultadoMasivo.value = data;
        showAceptarTodas.value  = false;
        showResultadoMasivo.value = true;
        await loadPostulaciones();
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error al aceptar todas',
            detail: err.response?.data?.message ?? 'Error inesperado',
            life: 4000
        });
    } finally {
        loadingMasivo.value = false;
    }
};

const confirmarRechazarTodas = async () => {
    const motivo = motivoRechazarTodas.value === 'Personalizado…'
        ? motivoPersonalizado.value.trim()
        : motivoRechazarTodas.value;

    loadingMasivo.value = true;
    try {
        const payload = motivo ? { motivo } : {};
        const { data } = await api.post('/postulaciones/rechazar-todas', payload);
        resultadoMasivo.value = data;
        showRechazarTodas.value   = false;
        showResultadoMasivo.value = true;
        motivoPersonalizado.value = '';
        motivoRechazarTodas.value = MOTIVOS_PRESET[0];
        await loadPostulaciones();
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error al rechazar todas',
            detail: err.response?.data?.message ?? 'Error inesperado',
            life: 4000
        });
    } finally {
        loadingMasivo.value = false;
    }
};

// ==========================
// UTILS
// ==========================
const estadoSeverity = (estado) => {
    if (estado === 'ACEPTADO')  return 'success';
    if (estado === 'RECHAZADO') return 'danger';
    if (estado === 'POSTULADO') return 'info';
    return 'secondary';
};
</script>

<template>
    <div class="page-container">
        <!-- PAGE HEADER -->
        <div class="page-header">
            <div class="header-left">
                <div class="header-icon">
                    <i class="pi pi-send"></i>
                </div>
                <div>
                    <h1 class="header-title">
                        Postulaciones
                        <span class="total-badge">{{ postulaciones.length }}</span>
                    </h1>
                    <p class="header-sub">Seguimiento de solicitudes de prácticas profesionales</p>
                </div>
            </div>

            <!-- Acciones masivas (solo si hay postulados pendientes) -->
            <div class="header-bulk-actions" v-if="totalPostuladas > 0">
                <Button
                    label="Aceptar todas"
                    icon="pi pi-check-circle"
                    severity="success"
                    outlined
                    size="small"
                    v-tooltip.bottom="`Aceptar ${totalPostuladas} postulaciones pendientes del período activo`"
                    @click="showAceptarTodas = true"
                />
                <Button
                    label="Rechazar todas"
                    icon="pi pi-times-circle"
                    severity="danger"
                    outlined
                    size="small"
                    v-tooltip.bottom="`Rechazar ${totalPostuladas} postulaciones pendientes del período activo`"
                    @click="showRechazarTodas = true"
                />
            </div>
        </div>

        <!-- STATS BAR -->
        <div class="stats-bar">
            <div class="stat-chip stat-blue">
                <i class="pi pi-inbox"></i>
                <span>{{ totalPostuladas }} postuladas</span>
            </div>
            <div class="stat-chip stat-green">
                <i class="pi pi-check-circle"></i>
                <span>{{ totalAceptadas }} aceptadas</span>
            </div>
            <div class="stat-chip stat-red">
                <i class="pi pi-times-circle"></i>
                <span>{{ totalRechazadas }} rechazadas</span>
            </div>
            <div class="stat-chip stat-muted">
                <i class="pi pi-ban"></i>
                <span>{{ totalCanceladas }} canceladas</span>
            </div>
        </div>

        <!-- FILTROS -->
        <div class="filter-card">
            <div class="filters-grid">
                <span class="search-wrap">
                    <i class="pi pi-search search-icon"></i>
                    <InputText v-model="filtros.search" placeholder="Buscar alumno, matrícula o vacante" class="w-full" />
                </span>

                <Select
                    v-model="filtros.estado"
                    :options="estadosOpciones"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Estado"
                    showClear
                />

                <Select
                    v-model="filtros.empresa"
                    :options="empresas"
                    optionLabel="nombre"
                    placeholder="Empresa"
                    showClear
                />

                <Select
                    v-model="filtros.periodo"
                    :options="periodos"
                    optionLabel="nombre"
                    placeholder="Período"
                    showClear
                />
            </div>
        </div>

        <!-- TABLA -->
        <div class="table-card">
            <DataTable
                :value="postulacionesFiltradas"
                paginator
                :rows="10"
                :loading="loading"
                responsiveLayout="scroll"
                :rowsPerPageOptions="[10, 25, 50]"
                stripedRows
            >
                <Column header="Alumno" style="min-width: 200px">
                    <template #body="{ data }">
                        <div class="cell-stack">
                            <span class="cell-main">{{ data.alumno?.usuario?.nombre }}</span>
                            <span class="cell-sub">{{ data.alumno?.matricula }}</span>
                        </div>
                    </template>
                </Column>

                <Column header="Empresa" style="min-width: 160px">
                    <template #body="{ data }">
                        <span class="cell-main">{{ data.categoria?.empresa?.nombre ?? '—' }}</span>
                    </template>
                </Column>

                <Column header="Vacante" style="min-width: 160px">
                    <template #body="{ data }">
                        <span class="cell-main">{{ data.categoria?.nombre ?? '—' }}</span>
                    </template>
                </Column>

                <Column header="Período" style="min-width: 120px">
                    <template #body="{ data }">
                        <span class="periodo-label">{{ data.categoria?.periodo?.nombre ?? '—' }}</span>
                    </template>
                </Column>

                <Column header="Estado" style="width: 130px">
                    <template #body="{ data }">
                        <Tag :value="data.estado" :severity="estadoSeverity(data.estado)" />
                    </template>
                </Column>

                <Column header="Fecha" style="width: 130px">
                    <template #body="{ data }">
                        <span class="cell-sub">{{ formatDate(data.createdAt ?? data.fecha) }}</span>
                    </template>
                </Column>

                <Column header="Acciones" style="width: 100px">
                    <template #body="{ data }">
                        <div class="row-actions" v-if="data.estado === 'POSTULADO'">
                            <Button
                                icon="pi pi-check"
                                text
                                size="small"
                                severity="success"
                                v-tooltip.top="'Aceptar postulación'"
                                @click="aceptar(data)"
                            />
                            <Button
                                icon="pi pi-times"
                                text
                                size="small"
                                severity="danger"
                                v-tooltip.top="'Rechazar postulación'"
                                @click="abrirRechazo(data)"
                            />
                        </div>
                        <span v-else class="muted-dash">—</span>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>

    <!-- ═══════════════════════════════════════════════════ -->
    <!-- MODAL ACEPTAR TODAS                               -->
    <!-- ═══════════════════════════════════════════════════ -->
    <Dialog v-model:visible="showAceptarTodas" modal style="width: 480px">
        <template #header>
            <div class="bulk-dialog-header bulk-header-green">
                <div class="bulk-header-icon bulk-icon-green">
                    <i class="pi pi-check-circle"></i>
                </div>
                <div>
                    <div class="bulk-header-title">Aceptar todas las postulaciones</div>
                    <div class="bulk-header-sub">Período activo</div>
                </div>
            </div>
        </template>

        <div class="bulk-body">
            <div class="bulk-count-box bulk-count-green">
                <span class="bulk-count-num">{{ totalPostuladas }}</span>
                <span class="bulk-count-label">postulaciones en estado <strong>POSTULADO</strong> serán aceptadas</span>
            </div>

            <div class="bulk-effects">
                <div class="bulk-effect-item">
                    <i class="pi pi-check"></i>
                    <span>Se crea <strong>HistorialAcadémico</strong> por cada alumno</span>
                </div>
                <div class="bulk-effect-item">
                    <i class="pi pi-check"></i>
                    <span>Se descuenta el cupo de cada vacante</span>
                </div>
                <div class="bulk-effect-item">
                    <i class="pi pi-check"></i>
                    <span>Cada alumno recibe notificación de aceptación</span>
                </div>
            </div>

            <div class="bulk-warning">
                <i class="pi pi-exclamation-triangle"></i>
                <span>Esta acción no se puede deshacer. Las demás postulaciones del mismo alumno quedan canceladas automáticamente.</span>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <Button label="Cancelar" text @click="showAceptarTodas = false" :disabled="loadingMasivo" />
                <Button
                    label="Confirmar — Aceptar todas"
                    icon="pi pi-check-circle"
                    severity="success"
                    :loading="loadingMasivo"
                    @click="confirmarAceptarTodas"
                />
            </div>
        </template>
    </Dialog>

    <!-- ═══════════════════════════════════════════════════ -->
    <!-- MODAL RECHAZAR TODAS                               -->
    <!-- ═══════════════════════════════════════════════════ -->
    <Dialog v-model:visible="showRechazarTodas" modal style="width: 520px">
        <template #header>
            <div class="bulk-dialog-header bulk-header-red">
                <div class="bulk-header-icon bulk-icon-red">
                    <i class="pi pi-times-circle"></i>
                </div>
                <div>
                    <div class="bulk-header-title">Rechazar todas las postulaciones</div>
                    <div class="bulk-header-sub">Período activo</div>
                </div>
            </div>
        </template>

        <div class="bulk-body">
            <div class="bulk-count-box bulk-count-red">
                <span class="bulk-count-num">{{ totalPostuladas }}</span>
                <span class="bulk-count-label">postulaciones en estado <strong>POSTULADO</strong> serán rechazadas</span>
            </div>

            <div class="form-field" style="margin-top:1rem">
                <label class="field-label-sm">Motivo del rechazo</label>
                <div class="motivo-chips">
                    <button
                        v-for="m in MOTIVOS_PRESET"
                        :key="m"
                        class="motivo-chip"
                        :class="{ 'motivo-chip--active': motivoRechazarTodas === m }"
                        @click="motivoRechazarTodas = m"
                    >{{ m }}</button>
                </div>

                <!-- Campo personalizado -->
                <Textarea
                    v-if="motivoRechazarTodas === 'Personalizado…'"
                    v-model="motivoPersonalizado"
                    rows="3"
                    placeholder="Escribe el motivo específico…"
                    class="w-full"
                    style="margin-top:0.75rem"
                />

                <div class="motivo-preview" v-else>
                    <i class="pi pi-comment"></i>
                    <span>Se enviará: <em>"{{ motivoRechazarTodas }}"</em></span>
                </div>
            </div>

            <div class="bulk-warning" style="margin-top:1rem">
                <i class="pi pi-exclamation-triangle"></i>
                <span>Cada alumno recibirá notificación con el motivo indicado. Esta acción no se puede deshacer.</span>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <Button label="Cancelar" text @click="showRechazarTodas = false" :disabled="loadingMasivo" />
                <Button
                    label="Confirmar — Rechazar todas"
                    icon="pi pi-times-circle"
                    severity="danger"
                    :loading="loadingMasivo"
                    @click="confirmarRechazarTodas"
                />
            </div>
        </template>
    </Dialog>

    <!-- ═══════════════════════════════════════════════════ -->
    <!-- MODAL RESULTADO MASIVO                             -->
    <!-- ═══════════════════════════════════════════════════ -->
    <Dialog v-model:visible="showResultadoMasivo" modal header="Resultado de la operación" style="width: 420px">
        <div v-if="resultadoMasivo" class="resultado-body">
            <!-- Aceptadas -->
            <div v-if="resultadoMasivo.aceptadas != null" class="resultado-stat resultado-green">
                <span class="resultado-num">{{ resultadoMasivo.aceptadas }}</span>
                <span class="resultado-label">postulaciones aceptadas</span>
            </div>
            <!-- Rechazadas -->
            <div v-if="resultadoMasivo.rechazadas != null" class="resultado-stat resultado-red">
                <span class="resultado-num">{{ resultadoMasivo.rechazadas }}</span>
                <span class="resultado-label">postulaciones rechazadas</span>
            </div>
            <!-- Omitidas -->
            <div v-if="resultadoMasivo.omitidas != null && resultadoMasivo.omitidas > 0" class="resultado-stat resultado-muted">
                <span class="resultado-num">{{ resultadoMasivo.omitidas }}</span>
                <span class="resultado-label">omitidas (ya procesadas)</span>
            </div>

            <p v-if="resultadoMasivo.mensaje" class="resultado-msg">{{ resultadoMasivo.mensaje }}</p>
        </div>
        <template #footer>
            <Button label="Cerrar" @click="showResultadoMasivo = false" />
        </template>
    </Dialog>

    <!-- MODAL RECHAZO -->
    <Dialog v-model:visible="rechazoDialog" modal header="Rechazar postulación" style="width: 500px">
        <div class="reject-info" v-if="postulacionSeleccionada">
            <div class="reject-row">
                <span class="reject-label">Alumno</span>
                <span class="reject-value">{{ postulacionSeleccionada.alumno?.usuario?.nombre }}</span>
            </div>
            <div class="reject-row">
                <span class="reject-label">Vacante</span>
                <span class="reject-value">{{ postulacionSeleccionada.categoria?.nombre }}</span>
            </div>
            <div class="reject-row">
                <span class="reject-label">Empresa</span>
                <span class="reject-value">{{ postulacionSeleccionada.categoria?.empresa?.nombre }}</span>
            </div>
        </div>

        <div class="form-field">
            <label>Motivo del rechazo</label>
            <Textarea v-model="rechazoMotivo" rows="4" placeholder="Describe el motivo del rechazo..." class="w-full" />
        </div>

        <template #footer>
            <div class="dialog-footer">
                <Button label="Cancelar" text @click="rechazoDialog = false" />
                <Button label="Confirmar rechazo" severity="danger" icon="pi pi-times" @click="rechazar" />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
/* ── Layout ─────────────────────────────── */
.page-container {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* ── Page Header ─────────────────────────── */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
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
    border-radius: 50%;
    background: var(--sisa-primary, #0F3C61);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.header-icon .pi {
    color: #fff;
    font-size: 1.25rem;
}
.header-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0;
    line-height: 1.2;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}
.total-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 26px;
    padding: 0 0.5rem;
    border-radius: 999px;
    background: var(--sisa-primary, #0F3C61);
    color: #fff;
    font-size: 0.78rem;
    font-weight: 700;
}
.header-sub {
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
    margin: 0;
}

/* ── Stats Bar ───────────────────────────── */
.stats-bar {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}
.stat-chip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 600;
}
.stat-blue  { color: var(--sisa-icon-blue);  background: var(--sisa-tint-blue); }
.stat-green { color: var(--sisa-icon-green); background: var(--sisa-tint-green); }
.stat-red   { color: var(--sisa-icon-red);   background: var(--sisa-tint-red); }
.stat-amber { color: var(--sisa-icon-amber); background: var(--sisa-tint-amber); }
.stat-muted {
    color: var(--p-text-muted-color);
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
}

/* ── Filter Card ─────────────────────────── */
.filter-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
}
.filters-grid {
    display: grid;
    grid-template-columns: 1fr 160px 200px 180px;
    gap: 0.75rem;
    align-items: center;
}
.search-wrap {
    position: relative;
    display: flex;
    align-items: center;
}
.search-icon {
    position: absolute;
    left: 0.75rem;
    color: var(--p-text-muted-color);
    pointer-events: none;
    z-index: 1;
}
.search-wrap :deep(input) {
    padding-left: 2.25rem;
    width: 100%;
}

/* ── Table Card ──────────────────────────── */
.table-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 0.75rem;
    overflow: hidden;
}

/* ── Cell stacks ─────────────────────────── */
.cell-stack {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}
.cell-main {
    font-weight: 600;
    color: var(--p-text-color);
    font-size: 0.9rem;
}
.cell-sub {
    font-size: 0.78rem;
    color: var(--p-text-muted-color);
}
.periodo-label {
    font-size: 0.82rem;
    color: var(--sisa-icon-amber);
    background: var(--sisa-tint-amber);
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-weight: 600;
}
.row-actions { display: flex; gap: 0.25rem; }
.muted-dash { color: var(--p-text-muted-color); }

/* ── Reject Dialog ───────────────────────── */
.reject-info {
    background: color-mix(in srgb, var(--sisa-tint-red) 50%, transparent);
    border: 1px solid var(--p-content-border-color);
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}
.reject-row {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
}
.reject-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--p-text-muted-color);
    min-width: 60px;
}
.reject-value {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--p-text-color);
}
.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-top: 0.25rem;
}
.form-field label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
}

/* ── Header bulk actions ─────────────────── */
.header-bulk-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

/* ── Bulk Dialog ─────────────────────────── */
.bulk-dialog-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}
.bulk-header-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;
}
.bulk-icon-green { background: rgba(46,125,50,.12); color: #2e7d32; }
.bulk-icon-red   { background: rgba(198,40,40,.12); color: #c62828; }

.bulk-header-title { font-size: 1rem; font-weight: 700; color: var(--p-text-color); }
.bulk-header-sub   { font-size: 0.78rem; color: var(--p-text-muted-color); }

.bulk-body { display: flex; flex-direction: column; gap: 0.85rem; padding-top: 0.25rem; }

.bulk-count-box {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    font-size: 0.88rem;
}
.bulk-count-green { background: rgba(46,125,50,.1); border: 1px solid rgba(46,125,50,.25); }
.bulk-count-red   { background: rgba(198,40,40,.1); border: 1px solid rgba(198,40,40,.25); }

.bulk-count-num {
    font-size: 2rem;
    font-weight: 800;
    line-height: 1;
    flex-shrink: 0;
}
.bulk-count-green .bulk-count-num { color: #2e7d32; }
.bulk-count-red   .bulk-count-num { color: #c62828; }

.bulk-count-label { color: var(--p-text-color); line-height: 1.4; }

.bulk-effects {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem 1rem;
    background: var(--p-surface-50, rgba(0,0,0,.025));
    border-radius: 8px;
    border: 1px solid var(--p-content-border-color);
}
.bulk-effect-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--p-text-color);
}
.bulk-effect-item .pi {
    color: #2e7d32;
    font-size: 0.8rem;
    margin-top: 2px;
    flex-shrink: 0;
}

.bulk-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.65rem 0.85rem;
    border-radius: 8px;
    background: rgba(230,81,0,.08);
    border: 1px solid rgba(230,81,0,.25);
    font-size: 0.82rem;
    color: #bf360c;
    line-height: 1.45;
}
.bulk-warning .pi { flex-shrink: 0; margin-top: 1px; }

/* Motivo chips */
.field-label-sm {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--p-text-muted-color);
    margin-bottom: 0.5rem;
    display: block;
}
.motivo-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}
.motivo-chip {
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    border: 1px solid var(--p-content-border-color);
    background: var(--p-content-background);
    color: var(--p-text-color);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s;
}
.motivo-chip:hover {
    border-color: var(--sisa-primary-l, #1565C0);
    color: var(--sisa-primary-l, #1565C0);
}
.motivo-chip--active {
    background: rgba(198,40,40,.1);
    border-color: #c62828;
    color: #c62828;
    font-weight: 600;
}
.motivo-preview {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.6rem;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    background: var(--p-surface-50, rgba(0,0,0,.025));
    border: 1px solid var(--p-content-border-color);
    font-size: 0.82rem;
    color: var(--p-text-muted-color);
}
.motivo-preview em { font-style: normal; color: var(--p-text-color); font-weight: 500; }
.motivo-preview .pi { flex-shrink: 0; }

/* ── Resultado masivo ────────────────────── */
.resultado-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.5rem 0;
}
.resultado-stat {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 10px;
}
.resultado-green { background: rgba(46,125,50,.1); border: 1px solid rgba(46,125,50,.25); }
.resultado-red   { background: rgba(198,40,40,.1); border: 1px solid rgba(198,40,40,.25); }
.resultado-muted { background: var(--p-surface-50); border: 1px solid var(--p-content-border-color); }

.resultado-num {
    font-size: 2.2rem;
    font-weight: 800;
    line-height: 1;
}
.resultado-green .resultado-num { color: #2e7d32; }
.resultado-red   .resultado-num { color: #c62828; }
.resultado-muted .resultado-num { color: var(--p-text-muted-color); }

.resultado-label { font-size: 0.9rem; color: var(--p-text-color); }
.resultado-msg   { font-size: 0.85rem; color: var(--p-text-muted-color); margin: 0; }

/* ── Responsive ──────────────────────────── */
@media (max-width: 1024px) {
    .filters-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 640px) {
    .filters-grid { grid-template-columns: 1fr; }
    .page-header  { flex-direction: column; align-items: flex-start; }
}
</style>
