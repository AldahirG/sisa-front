<script setup>
import api from '@/api/axios';
import { useToast } from '@/composables/useAppToast';
import { computed, onMounted, ref, watch } from 'vue';

import Button from 'primevue/button';
import Column from 'primevue/column';
import ConfirmDialog from 'primevue/confirmdialog';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';
import { useConfirm } from 'primevue/useconfirm';

const toast = useToast();
const confirm = useConfirm();

// ══════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════
const postulaciones           = ref([]);
const loading                 = ref(false);
const periodos                = ref([]);
const periodoSeleccionado     = ref(null);
const tabEstado               = ref(null);   // null = Todos

const rechazoDialog           = ref(false);
const rechazoMotivo           = ref('');
const postulacionSeleccionada = ref(null);

const removerDialog           = ref(false);
const loadingRemover          = ref(false);
const postulacionARemover     = ref(null);

const showAceptarTodas    = ref(false);
const showRechazarTodas   = ref(false);
const loadingMasivo       = ref(false);
const showResultadoMasivo = ref(false);
const resultadoMasivo     = ref(null);

const MOTIVOS_PRESET = [
    'No aplicas para este perfil',
    'Cupos ocupados en la empresa',
    'Perfil no coincide con los requisitos',
    'Vacante cancelada por la empresa',
    'Periodo de selección concluido',
    'Personalizado…'
];
const motivoRechazarTodas = ref(MOTIVOS_PRESET[0]);
const motivoPersonalizado = ref('');

const filtros = ref({ empresa: null, search: '' });

// ══════════════════════════════════════════════════════════
// LOAD
// ══════════════════════════════════════════════════════════
const loadPeriodos = async () => {
    try {
        const { data } = await api.get('/periodos');
        periodos.value = data;
        periodoSeleccionado.value = data.find((p) => p.estado === 'activo') ?? null;
    } catch {
        // no blocker
    }
};

const loadPostulaciones = async () => {
    loading.value = true;
    try {
        const { data } = await api.get('/postulaciones');
        postulaciones.value = data;
    } finally {
        loading.value = false;
    }
};

onMounted(async () => {
    await Promise.all([loadPeriodos(), loadPostulaciones()]);
});

// Al cambiar periodo reseteamos tab y filtros secundarios
watch(periodoSeleccionado, () => {
    tabEstado.value     = null;
    filtros.value       = { empresa: null, search: '' };
});

// ══════════════════════════════════════════════════════════
// COMPUTED — filtrado progresivo
// ══════════════════════════════════════════════════════════

// 1. Filtrar por periodo seleccionado
const postulacionesPeriodo = computed(() => {
    if (!periodoSeleccionado.value) return postulaciones.value;
    return postulaciones.value.filter(
        (p) => p.categoria?.periodo?.id_periodo === periodoSeleccionado.value.id_periodo
    );
});

// 2. Empresas disponibles para el periodo
const empresasPeriodo = computed(() => {
    const map = new Map();
    postulacionesPeriodo.value.forEach((p) => {
        if (p.categoria?.empresa) map.set(p.categoria.empresa.id_empresa, p.categoria.empresa);
    });
    return [...map.values()];
});

// 3. Stats del periodo (independiente de tab)
const stats = computed(() => ({
    postuladas: postulacionesPeriodo.value.filter((p) => p.estado === 'POSTULADO').length,
    aceptadas:  postulacionesPeriodo.value.filter((p) => p.estado === 'ACEPTADO').length,
    rechazadas: postulacionesPeriodo.value.filter((p) => p.estado === 'RECHAZADO').length,
    canceladas: postulacionesPeriodo.value.filter((p) => p.estado === 'CANCELADO').length,
    total:      postulacionesPeriodo.value.length,
}));

// 4. Filtrado final: tab + empresa + búsqueda
const postulacionesFiltradas = computed(() => {
    return postulacionesPeriodo.value.filter((p) => {
        const matchEstado  = !tabEstado.value  || p.estado === tabEstado.value;
        const matchEmpresa = !filtros.value.empresa || p.categoria?.empresa?.id_empresa === filtros.value.empresa.id_empresa;
        const search = filtros.value.search?.trim().toLowerCase() || '';
        const matchSearch = !search ||
            p.alumno?.usuario?.nombre?.toLowerCase().includes(search) ||
            p.alumno?.matricula?.toLowerCase().includes(search) ||
            p.categoria?.nombre?.toLowerCase().includes(search);
        return matchEstado && matchEmpresa && matchSearch;
    });
});

// Detectar filas del mismo alumno para agrupación visual
const rowsWithGroup = computed(() => {
    return postulacionesFiltradas.value.map((p, i) => {
        const prev = postulacionesFiltradas.value[i - 1];
        const sameAsAbove = prev && prev.alumno?.id_alumno === p.alumno?.id_alumno;
        return { ...p, _sameAsAbove: sameAsAbove };
    });
});

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════
const formatDate = (s) => {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

const estadoSeverity = (estado) => {
    if (estado === 'ACEPTADO')  return 'success';
    if (estado === 'RECHAZADO') return 'danger';
    if (estado === 'POSTULADO') return 'info';
    return 'secondary';
};

const setTab = (estado) => {
    tabEstado.value = tabEstado.value === estado ? null : estado;
};

// ══════════════════════════════════════════════════════════
// ACTIONS
// ══════════════════════════════════════════════════════════
const aceptar = (row) => {
    confirm.require({
        message: `¿Aceptar la postulación de ${row.alumno?.nombre ?? 'este alumno'} para "${row.vacante?.nombre ?? 'esta vacante'}"?`,
        header: 'Confirmar aceptación',
        icon: 'pi pi-check-circle',
        acceptLabel: 'Sí, aceptar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-success',
        accept: async () => {
            try {
                await api.put(`/postulaciones/${row.id_postulacion}/aceptar`);
                toast.add({ severity: 'success', summary: 'Postulación aceptada', life: 3000 });
                loadPostulaciones();
            } catch {
                toast.add({ severity: 'error', summary: 'Error al aceptar', life: 3000 });
            }
        }
    });
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

const abrirRemover = (row) => {
    postulacionARemover.value = row;
    removerDialog.value = true;
};

const confirmarRemover = async () => {
    loadingRemover.value = true;
    try {
        await api.delete(`/postulaciones/${postulacionARemover.value.id_postulacion}/remover`);
        removerDialog.value = false;
        toast.add({ severity: 'warn', summary: 'Alumno removido de empresa', life: 3500 });
        loadPostulaciones();
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error al remover',
            detail: err.response?.data?.message ?? 'Error inesperado',
            life: 4000
        });
    } finally {
        loadingRemover.value = false;
    }
};

// ══════════════════════════════════════════════════════════
// ACCIONES MASIVAS
// ══════════════════════════════════════════════════════════
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
</script>

<template>
    <div class="ps-page">
        <Toast />
        <ConfirmDialog />

        <!-- ══════════════════════════════════════════
             HEADER
        ══════════════════════════════════════════ -->
        <div class="ps-header">
            <div class="ps-header-left">
                <div class="ps-page-icon">
                    <i class="pi pi-send"></i>
                </div>
                <div>
                    <h1 class="ps-title">
                        Postulaciones
                        <span class="ps-total-pill">{{ stats.total }}</span>
                    </h1>
                    <p class="ps-subtitle">Solicitudes de prácticas del período seleccionado</p>
                </div>
            </div>

            <div class="ps-header-right">
                <!-- Acciones masivas -->
                <div class="ps-bulk-actions" v-if="stats.postuladas > 0">
                    <Button
                        label="Aceptar todas"
                        icon="pi pi-check-circle"
                        severity="success"
                        outlined size="small"
                        v-tooltip.bottom="`Aceptar ${stats.postuladas} pendientes`"
                        @click="showAceptarTodas = true"
                    />
                    <Button
                        label="Rechazar todas"
                        icon="pi pi-times-circle"
                        severity="danger"
                        outlined size="small"
                        v-tooltip.bottom="`Rechazar ${stats.postuladas} pendientes`"
                        @click="showRechazarTodas = true"
                    />
                </div>

                <!-- Selector de periodo -->
                <Select
                    v-model="periodoSeleccionado"
                    :options="periodos"
                    optionLabel="nombre"
                    placeholder="Período"
                    class="ps-periodo-select"
                />
            </div>
        </div>

        <!-- ══════════════════════════════════════════
             STATS CARDS — filtran al hacer click
        ══════════════════════════════════════════ -->
        <div class="ps-stats-row">
            <button
                class="ps-stat-card ps-stat-card--blue"
                :class="{ 'ps-stat-card--active': tabEstado === 'POSTULADO' }"
                @click="setTab('POSTULADO')"
            >
                <div class="ps-stat-icon"><i class="pi pi-inbox"></i></div>
                <div class="ps-stat-body">
                    <span class="ps-stat-num">{{ stats.postuladas }}</span>
                    <span class="ps-stat-lbl">Pendientes</span>
                </div>
            </button>

            <button
                class="ps-stat-card ps-stat-card--green"
                :class="{ 'ps-stat-card--active': tabEstado === 'ACEPTADO' }"
                @click="setTab('ACEPTADO')"
            >
                <div class="ps-stat-icon"><i class="pi pi-check-circle"></i></div>
                <div class="ps-stat-body">
                    <span class="ps-stat-num">{{ stats.aceptadas }}</span>
                    <span class="ps-stat-lbl">Aceptadas</span>
                </div>
            </button>

            <button
                class="ps-stat-card ps-stat-card--red"
                :class="{ 'ps-stat-card--active': tabEstado === 'RECHAZADO' }"
                @click="setTab('RECHAZADO')"
            >
                <div class="ps-stat-icon"><i class="pi pi-times-circle"></i></div>
                <div class="ps-stat-body">
                    <span class="ps-stat-num">{{ stats.rechazadas }}</span>
                    <span class="ps-stat-lbl">Rechazadas</span>
                </div>
            </button>

            <button
                class="ps-stat-card ps-stat-card--muted"
                :class="{ 'ps-stat-card--active': tabEstado === null }"
                @click="setTab(null)"
            >
                <div class="ps-stat-icon"><i class="pi pi-list"></i></div>
                <div class="ps-stat-body">
                    <span class="ps-stat-num">{{ stats.total }}</span>
                    <span class="ps-stat-lbl">Todas</span>
                </div>
            </button>
        </div>

        <!-- ══════════════════════════════════════════
             TAB ACTIVO INDICATOR + FILTROS SECUNDARIOS
        ══════════════════════════════════════════ -->
        <div class="ps-filters-bar">
            <!-- Indicador del filtro activo -->
            <div class="ps-active-filter">
                <span v-if="tabEstado === 'POSTULADO'" class="ps-filter-pill ps-filter-pill--blue">
                    <i class="pi pi-inbox"></i> Mostrando: Pendientes
                    <button class="ps-filter-clear" @click="tabEstado = null"><i class="pi pi-times"></i></button>
                </span>
                <span v-else-if="tabEstado === 'ACEPTADO'" class="ps-filter-pill ps-filter-pill--green">
                    <i class="pi pi-check-circle"></i> Mostrando: Aceptadas
                    <button class="ps-filter-clear" @click="tabEstado = null"><i class="pi pi-times"></i></button>
                </span>
                <span v-else-if="tabEstado === 'RECHAZADO'" class="ps-filter-pill ps-filter-pill--red">
                    <i class="pi pi-times-circle"></i> Mostrando: Rechazadas
                    <button class="ps-filter-clear" @click="tabEstado = null"><i class="pi pi-times"></i></button>
                </span>
                <span v-else class="ps-filter-pill ps-filter-pill--muted">
                    <i class="pi pi-list"></i> Mostrando: Todas
                </span>
                <span class="ps-filter-count">{{ postulacionesFiltradas.length }} registros</span>
            </div>

            <!-- Búsqueda + empresa -->
            <div class="ps-filters-right">
                <div class="ps-search-wrap">
                    <i class="pi pi-search ps-search-icon"></i>
                    <input
                        v-model="filtros.search"
                        type="text"
                        placeholder="Buscar alumno, matrícula o vacante…"
                        class="ps-search-input"
                    />
                    <button v-if="filtros.search" class="ps-search-clear" @click="filtros.search = ''">
                        <i class="pi pi-times"></i>
                    </button>
                </div>
                <Select
                    v-model="filtros.empresa"
                    :options="empresasPeriodo"
                    optionLabel="nombre"
                    placeholder="Empresa"
                    showClear
                    class="ps-empresa-select"
                />
            </div>
        </div>

        <!-- ══════════════════════════════════════════
             TABLA
        ══════════════════════════════════════════ -->
        <div class="ps-table-card">
            <!-- Sin periodo -->
            <div v-if="!periodoSeleccionado && !loading" class="ps-empty">
                <i class="pi pi-calendar ps-empty-icon"></i>
                <p>Selecciona un período para ver las postulaciones</p>
            </div>

            <!-- Sin resultados -->
            <div v-else-if="!loading && postulacionesFiltradas.length === 0" class="ps-empty">
                <i class="pi pi-inbox ps-empty-icon"></i>
                <p v-if="tabEstado === 'POSTULADO'">No hay postulaciones pendientes en este período</p>
                <p v-else-if="tabEstado === 'ACEPTADO'">No hay postulaciones aceptadas en este período</p>
                <p v-else-if="tabEstado === 'RECHAZADO'">No hay postulaciones rechazadas en este período</p>
                <p v-else>No hay postulaciones en este período</p>
            </div>

            <DataTable
                v-else
                :value="rowsWithGroup"
                paginator
                :rows="15"
                :loading="loading"
                responsiveLayout="scroll"
                :rowsPerPageOptions="[15, 30, 50]"
                :rowClass="(row) => row._sameAsAbove ? 'row-grouped' : ''"
            >
                <!-- Alumno -->
                <Column header="Alumno" style="min-width: 200px">
                    <template #body="{ data }">
                        <div v-if="!data._sameAsAbove" class="cell-student">
                            <div class="cell-avatar">
                                {{ (data.alumno?.usuario?.nombre || '?')[0].toUpperCase() }}
                            </div>
                            <div>
                                <p class="cell-name">{{ data.alumno?.usuario?.nombre }}</p>
                                <p class="cell-meta">{{ data.alumno?.matricula }}</p>
                            </div>
                        </div>
                        <div v-else class="cell-student-repeat">
                            <span class="cell-repeat-dot"></span>
                            <p class="cell-meta">{{ data.alumno?.matricula }}</p>
                        </div>
                    </template>
                </Column>

                <!-- Empresa -->
                <Column header="Empresa" style="min-width: 150px">
                    <template #body="{ data }">
                        <span class="cell-empresa">{{ data.categoria?.empresa?.nombre ?? '—' }}</span>
                    </template>
                </Column>

                <!-- Vacante -->
                <Column header="Vacante" style="min-width: 160px">
                    <template #body="{ data }">
                        <span class="cell-name" style="font-size:.875rem">{{ data.categoria?.nombre ?? '—' }}</span>
                    </template>
                </Column>

                <!-- Estado -->
                <Column header="Estado" style="width: 130px">
                    <template #body="{ data }">
                        <Tag :value="data.estado" :severity="estadoSeverity(data.estado)" />
                    </template>
                </Column>

                <!-- Fecha -->
                <Column header="Fecha" style="width: 120px">
                    <template #body="{ data }">
                        <span class="cell-meta">{{ formatDate(data.fecha_envio) }}</span>
                    </template>
                </Column>

                <!-- Acciones -->
                <Column header="Acciones" style="width: 130px">
                    <template #body="{ data }">
                        <div class="row-actions" v-if="data.estado === 'POSTULADO'">
                            <button
                                class="action-btn action-btn--accept"
                                v-tooltip.top="'Aceptar'"
                                @click="aceptar(data)"
                            >
                                <i class="pi pi-check"></i>
                            </button>
                            <button
                                class="action-btn action-btn--reject"
                                v-tooltip.top="'Rechazar'"
                                @click="abrirRechazo(data)"
                            >
                                <i class="pi pi-times"></i>
                            </button>
                        </div>
                        <div class="row-actions" v-else-if="data.estado === 'ACEPTADO'">
                            <button
                                class="action-btn action-btn--remove"
                                v-tooltip.top="'Remover de empresa'"
                                @click="abrirRemover(data)"
                            >
                                <i class="pi pi-user-minus"></i>
                            </button>
                        </div>
                        <span v-else class="cell-meta">—</span>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>

    <!-- ══════════════════════════════════════════
         MODAL RECHAZO INDIVIDUAL
    ══════════════════════════════════════════ -->
    <Dialog v-model:visible="rechazoDialog" modal header="Rechazar postulación" style="width: 500px; max-width: 95vw">
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
            <label class="field-label-sm">Motivo del rechazo</label>
            <Textarea v-model="rechazoMotivo" rows="4" placeholder="Describe el motivo del rechazo..." class="w-full" />
        </div>

        <template #footer>
            <div class="dialog-footer">
                <Button label="Cancelar" text @click="rechazoDialog = false" />
                <Button label="Confirmar rechazo" severity="danger" icon="pi pi-times" @click="rechazar" />
            </div>
        </template>
    </Dialog>

    <!-- ══════════════════════════════════════════
         MODAL ACEPTAR TODAS
    ══════════════════════════════════════════ -->
    <Dialog v-model:visible="showAceptarTodas" modal style="width: 480px; max-width: 95vw">
        <template #header>
            <div class="bulk-header bulk-header--green">
                <div class="bulk-header-icon">
                    <i class="pi pi-check-circle"></i>
                </div>
                <div>
                    <div class="bulk-header-title">Aceptar todas las postulaciones</div>
                    <div class="bulk-header-sub">Período activo · {{ stats.postuladas }} pendientes</div>
                </div>
            </div>
        </template>

        <div class="bulk-body">
            <div class="bulk-count-box bulk-count-box--green">
                <span class="bulk-count-num">{{ stats.postuladas }}</span>
                <span class="bulk-count-label">postulaciones en estado <strong>POSTULADO</strong> serán aceptadas</span>
            </div>

            <div class="bulk-effects">
                <div class="bulk-effect-item"><i class="pi pi-check"></i><span>Se crea <strong>HistorialAcadémico</strong> por cada alumno</span></div>
                <div class="bulk-effect-item"><i class="pi pi-check"></i><span>Se descuenta el cupo de cada vacante</span></div>
                <div class="bulk-effect-item"><i class="pi pi-check"></i><span>Cada alumno recibe notificación de aceptación</span></div>
            </div>

            <div class="bulk-warning">
                <i class="pi pi-exclamation-triangle"></i>
                <span>Esta acción no se puede deshacer. Las demás postulaciones del mismo alumno quedan canceladas automáticamente.</span>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <Button label="Cancelar" text @click="showAceptarTodas = false" :disabled="loadingMasivo" />
                <Button label="Confirmar — Aceptar todas" icon="pi pi-check-circle" severity="success" :loading="loadingMasivo" @click="confirmarAceptarTodas" />
            </div>
        </template>
    </Dialog>

    <!-- ══════════════════════════════════════════
         MODAL RECHAZAR TODAS
    ══════════════════════════════════════════ -->
    <Dialog v-model:visible="showRechazarTodas" modal style="width: 520px; max-width: 95vw">
        <template #header>
            <div class="bulk-header bulk-header--red">
                <div class="bulk-header-icon">
                    <i class="pi pi-times-circle"></i>
                </div>
                <div>
                    <div class="bulk-header-title">Rechazar todas las postulaciones</div>
                    <div class="bulk-header-sub">Período activo · {{ stats.postuladas }} pendientes</div>
                </div>
            </div>
        </template>

        <div class="bulk-body">
            <div class="bulk-count-box bulk-count-box--red">
                <span class="bulk-count-num">{{ stats.postuladas }}</span>
                <span class="bulk-count-label">postulaciones en estado <strong>POSTULADO</strong> serán rechazadas</span>
            </div>

            <div class="form-field" style="margin-top:.875rem">
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
                <Textarea
                    v-if="motivoRechazarTodas === 'Personalizado…'"
                    v-model="motivoPersonalizado"
                    rows="3"
                    placeholder="Escribe el motivo específico…"
                    class="w-full"
                    style="margin-top:.75rem"
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
                <Button label="Confirmar — Rechazar todas" icon="pi pi-times-circle" severity="danger" :loading="loadingMasivo" @click="confirmarRechazarTodas" />
            </div>
        </template>
    </Dialog>

    <!-- ══════════════════════════════════════════
         MODAL REMOVER DE EMPRESA
    ══════════════════════════════════════════ -->
    <Dialog v-model:visible="removerDialog" modal style="width: 500px; max-width: 95vw">
        <template #header>
            <div class="bulk-header bulk-header--orange">
                <div class="bulk-header-icon">
                    <i class="pi pi-user-minus"></i>
                </div>
                <div>
                    <div class="bulk-header-title">Remover de empresa</div>
                    <div class="bulk-header-sub">Esta acción no se puede deshacer</div>
                </div>
            </div>
        </template>

        <div class="bulk-body" v-if="postulacionARemover">
            <div class="reject-info" style="background: rgba(230,81,0,.07); border-color: rgba(230,81,0,.25)">
                <div class="reject-row">
                    <span class="reject-label">Alumno</span>
                    <span class="reject-value">{{ postulacionARemover.alumno?.usuario?.nombre }}</span>
                </div>
                <div class="reject-row">
                    <span class="reject-label">Matrícula</span>
                    <span class="reject-value">{{ postulacionARemover.alumno?.matricula }}</span>
                </div>
                <div class="reject-row">
                    <span class="reject-label">Empresa</span>
                    <span class="reject-value">{{ postulacionARemover.categoria?.empresa?.nombre }}</span>
                </div>
                <div class="reject-row">
                    <span class="reject-label">Vacante</span>
                    <span class="reject-value">{{ postulacionARemover.categoria?.nombre }}</span>
                </div>
            </div>

            <div class="bulk-effects">
                <div class="bulk-effect-item"><i class="pi pi-trash" style="color:#e65100"></i><span>Se elimina el <strong>Historial Académico</strong> del alumno en este periodo</span></div>
                <div class="bulk-effect-item"><i class="pi pi-plus-circle" style="color:#1565c0"></i><span>El cupo de la vacante se <strong>restaura</strong> para otro postulante</span></div>
                <div class="bulk-effect-item"><i class="pi pi-bell" style="color:#6d4c41"></i><span>El alumno recibe <strong>notificación</strong> de la cancelación</span></div>
            </div>

            <div class="bulk-warning">
                <i class="pi pi-exclamation-triangle"></i>
                <span>El alumno quedará sin empresa asignada. Usa esta opción solo en casos de baja o error de asignación.</span>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <Button label="Cancelar" text @click="removerDialog = false" :disabled="loadingRemover" />
                <Button label="Confirmar — Remover" icon="pi pi-user-minus" severity="warning" :loading="loadingRemover" @click="confirmarRemover" />
            </div>
        </template>
    </Dialog>

    <!-- ══════════════════════════════════════════
         MODAL RESULTADO MASIVO
    ══════════════════════════════════════════ -->
    <Dialog v-model:visible="showResultadoMasivo" modal header="Resultado de la operación" style="width: 420px; max-width: 95vw">
        <div v-if="resultadoMasivo" class="resultado-body">
            <div v-if="resultadoMasivo.aceptadas != null" class="resultado-stat resultado-stat--green">
                <span class="resultado-num">{{ resultadoMasivo.aceptadas }}</span>
                <span class="resultado-label">postulaciones aceptadas</span>
            </div>
            <div v-if="resultadoMasivo.rechazadas != null" class="resultado-stat resultado-stat--red">
                <span class="resultado-num">{{ resultadoMasivo.rechazadas }}</span>
                <span class="resultado-label">postulaciones rechazadas</span>
            </div>
            <div v-if="resultadoMasivo.omitidas != null && resultadoMasivo.omitidas > 0" class="resultado-stat resultado-stat--muted">
                <span class="resultado-num">{{ resultadoMasivo.omitidas }}</span>
                <span class="resultado-label">omitidas (ya procesadas)</span>
            </div>
            <p v-if="resultadoMasivo.mensaje" class="resultado-msg">{{ resultadoMasivo.mensaje }}</p>
        </div>
        <template #footer>
            <Button label="Cerrar" @click="showResultadoMasivo = false" />
        </template>
    </Dialog>
</template>

<style scoped>
/* ═══════════════════════════════════════
   BASE
═══════════════════════════════════════ */
.ps-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* ═══════════════════════════════════════
   HEADER
═══════════════════════════════════════ */
.ps-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}

.ps-header-left {
    display: flex;
    align-items: center;
    gap: .875rem;
}

.ps-page-icon {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: .75rem;
    background: linear-gradient(135deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(15, 60, 97, .3);
}

.ps-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0;
    display: flex;
    align-items: center;
    gap: .5rem;
}

.ps-total-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.6rem;
    height: 1.6rem;
    padding: 0 .4rem;
    border-radius: 99px;
    background: var(--sisa-primary);
    color: #fff;
    font-size: .75rem;
    font-weight: 700;
}

.ps-subtitle {
    font-size: .82rem;
    color: var(--p-text-muted-color);
    margin: .15rem 0 0;
}

.ps-header-right {
    display: flex;
    align-items: center;
    gap: .625rem;
    flex-wrap: wrap;
}

.ps-bulk-actions { display: flex; gap: .4rem; }

.ps-periodo-select { min-width: 200px; }

/* ═══════════════════════════════════════
   STATS CARDS — clickables
═══════════════════════════════════════ */
.ps-stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: .875rem;
}

.ps-stat-card {
    display: flex;
    align-items: center;
    gap: .875rem;
    padding: 1rem 1.125rem;
    border: 2px solid var(--p-content-border-color);
    border-radius: .875rem;
    background: var(--p-content-background);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: all .18s;
    position: relative;
    overflow: hidden;
}

.ps-stat-card::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity .18s;
}

.ps-stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.1); }

/* Blue */
.ps-stat-card--blue .ps-stat-icon { background: var(--sisa-tint-blue);  color: var(--sisa-icon-blue);  }
.ps-stat-card--blue .ps-stat-num  { color: var(--sisa-icon-blue);  }
.ps-stat-card--blue.ps-stat-card--active { border-color: var(--sisa-icon-blue);  background: var(--sisa-tint-blue); }

/* Green */
.ps-stat-card--green .ps-stat-icon { background: var(--sisa-tint-green); color: var(--sisa-icon-green); }
.ps-stat-card--green .ps-stat-num  { color: var(--sisa-icon-green); }
.ps-stat-card--green.ps-stat-card--active { border-color: var(--sisa-icon-green); background: var(--sisa-tint-green); }

/* Red */
.ps-stat-card--red .ps-stat-icon { background: var(--sisa-tint-red);   color: var(--sisa-icon-red);   }
.ps-stat-card--red .ps-stat-num  { color: var(--sisa-icon-red);   }
.ps-stat-card--red.ps-stat-card--active { border-color: var(--sisa-icon-red);   background: var(--sisa-tint-red); }

/* Muted (Todos) */
.ps-stat-card--muted .ps-stat-icon { background: var(--p-content-border-color); color: var(--p-text-muted-color); }
.ps-stat-card--muted .ps-stat-num  { color: var(--p-text-color); }
.ps-stat-card--muted.ps-stat-card--active { border-color: var(--sisa-primary-l); background: var(--sisa-tint-blue); }

.ps-stat-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: .625rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    flex-shrink: 0;
}

.ps-stat-body {
    display: flex;
    flex-direction: column;
    gap: .1rem;
}

.ps-stat-num {
    font-size: 1.75rem;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

.ps-stat-lbl {
    font-size: .72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: var(--p-text-muted-color);
}

/* ═══════════════════════════════════════
   FILTERS BAR
═══════════════════════════════════════ */
.ps-filters-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: .75rem;
    padding: .75rem 1rem;
}

.ps-active-filter {
    display: flex;
    align-items: center;
    gap: .625rem;
    flex-wrap: wrap;
}

.ps-filter-pill {
    display: inline-flex;
    align-items: center;
    gap: .35rem;
    padding: .25rem .7rem;
    border-radius: 99px;
    font-size: .78rem;
    font-weight: 700;
}

.ps-filter-pill--blue   { background: var(--sisa-tint-blue);   color: var(--sisa-icon-blue);   }
.ps-filter-pill--green  { background: var(--sisa-tint-green);  color: var(--sisa-icon-green);  }
.ps-filter-pill--red    { background: var(--sisa-tint-red);    color: var(--sisa-icon-red);    }
.ps-filter-pill--muted  { background: var(--p-content-border-color); color: var(--p-text-muted-color); }

.ps-filter-clear {
    border: none;
    background: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    padding: 0;
    font-size: .65rem;
    color: inherit;
    opacity: .7;
    transition: opacity .15s;
    font-family: inherit;
}
.ps-filter-clear:hover { opacity: 1; }

.ps-filter-count {
    font-size: .78rem;
    color: var(--p-text-muted-color);
    font-variant-numeric: tabular-nums;
}

.ps-filters-right {
    display: flex;
    align-items: center;
    gap: .625rem;
    flex-wrap: wrap;
}

.ps-search-wrap {
    display: flex;
    align-items: center;
    gap: .4rem;
    border: 1px solid var(--p-content-border-color);
    border-radius: .5rem;
    padding: .35rem .75rem;
    background: var(--p-content-hover-background);
    transition: border-color .15s;
}
.ps-search-wrap:focus-within {
    border-color: var(--sisa-primary-l);
}

.ps-search-icon { font-size: .8rem; color: var(--p-text-muted-color); flex-shrink: 0; }

.ps-search-input {
    border: none;
    outline: none;
    background: transparent;
    font-size: .85rem;
    color: var(--p-text-color);
    width: 220px;
    font-family: inherit;
}

.ps-search-clear {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--p-text-muted-color);
    padding: 0;
    font-size: .72rem;
    line-height: 1;
    font-family: inherit;
}
.ps-search-clear:hover { color: var(--sisa-icon-red); }

.ps-empresa-select { min-width: 170px; }

/* ═══════════════════════════════════════
   TABLE CARD
═══════════════════════════════════════ */
.ps-table-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: .875rem;
    overflow: clip;
}

.ps-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .875rem;
    padding: 4rem 2rem;
    font-size: .9rem;
    color: var(--p-text-muted-color);
}
.ps-empty-icon { font-size: 2.25rem; opacity: .2; }

/* Fila agrupada — mismo alumno que la de arriba */
:deep(.row-grouped td:first-child) {
    border-top: none !important;
}
:deep(.row-grouped) {
    background: color-mix(in srgb, var(--p-content-background) 95%, var(--sisa-tint-blue)) !important;
}

/* Cells */
.cell-student {
    display: flex;
    align-items: center;
    gap: .625rem;
}

.cell-student-repeat {
    display: flex;
    align-items: center;
    gap: .5rem;
    padding-left: .25rem;
}

.cell-repeat-dot {
    width: .35rem;
    height: .35rem;
    border-radius: 50%;
    background: var(--p-content-border-color);
    flex-shrink: 0;
}

.cell-avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    color: #fff;
    font-size: .75rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.cell-name {
    margin: 0;
    font-size: .875rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.cell-meta {
    margin: .1rem 0 0;
    font-size: .75rem;
    color: var(--p-text-muted-color);
}

.cell-empresa {
    font-size: .84rem;
    font-weight: 600;
    color: var(--p-text-color);
}

/* Action buttons */
.row-actions { display: flex; gap: .3rem; }

.action-btn {
    width: 2rem;
    height: 2rem;
    border-radius: .45rem;
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: .8rem;
    transition: all .15s;
    font-family: inherit;
}

.action-btn--accept {
    background: var(--sisa-tint-green);
    color: var(--sisa-icon-green);
    border-color: var(--sisa-tint-green);
}
.action-btn--accept:hover {
    background: var(--sisa-icon-green);
    color: #fff;
    border-color: var(--sisa-icon-green);
}

.action-btn--reject {
    background: var(--sisa-tint-red);
    color: var(--sisa-icon-red);
    border-color: var(--sisa-tint-red);
}
.action-btn--reject:hover {
    background: var(--sisa-icon-red);
    color: #fff;
    border-color: var(--sisa-icon-red);
}

.action-btn--remove {
    background: rgba(230,81,0,.1);
    color: #e65100;
    border-color: rgba(230,81,0,.2);
}
.action-btn--remove:hover {
    background: #e65100;
    color: #fff;
    border-color: #e65100;
}

/* ═══════════════════════════════════════
   REJECT DIALOG
═══════════════════════════════════════ */
.reject-info {
    background: var(--sisa-tint-red);
    border: 1px solid var(--p-content-border-color);
    border-radius: .5rem;
    padding: .75rem 1rem;
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: .4rem;
}

.reject-row { display: flex; gap: .5rem; align-items: baseline; }

.reject-label {
    font-size: .72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--p-text-muted-color);
    min-width: 60px;
}

.reject-value {
    font-size: .875rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.form-field { display: flex; flex-direction: column; gap: .4rem; padding-top: .25rem; }

.field-label-sm {
    font-size: .72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--p-text-muted-color);
    display: block;
    margin-bottom: .25rem;
}

.dialog-footer { display: flex; justify-content: flex-end; gap: .625rem; }

/* ═══════════════════════════════════════
   BULK DIALOGS
═══════════════════════════════════════ */
.bulk-header {
    display: flex;
    align-items: center;
    gap: .75rem;
}

.bulk-header-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
}

.bulk-header--green  .bulk-header-icon { background: rgba(46,125,50,.12);  color: #2e7d32; }
.bulk-header--red    .bulk-header-icon { background: rgba(198,40,40,.12);  color: #c62828; }
.bulk-header--orange .bulk-header-icon { background: rgba(230,81,0,.12);   color: #e65100; }

.bulk-header-title { font-size: 1rem; font-weight: 700; color: var(--p-text-color); }
.bulk-header-sub   { font-size: .78rem; color: var(--p-text-muted-color); }

.bulk-body { display: flex; flex-direction: column; gap: .85rem; padding-top: .25rem; }

.bulk-count-box {
    display: flex;
    align-items: center;
    gap: .75rem;
    padding: .75rem 1rem;
    border-radius: .625rem;
    font-size: .875rem;
}
.bulk-count-box--green { background: rgba(46,125,50,.08); border: 1px solid rgba(46,125,50,.25); }
.bulk-count-box--red   { background: rgba(198,40,40,.08); border: 1px solid rgba(198,40,40,.25); }

.bulk-count-num {
    font-size: 2rem;
    font-weight: 800;
    line-height: 1;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
}
.bulk-count-box--green .bulk-count-num { color: #2e7d32; }
.bulk-count-box--red   .bulk-count-num { color: #c62828; }

.bulk-count-label { color: var(--p-text-color); line-height: 1.4; }

.bulk-effects {
    display: flex;
    flex-direction: column;
    gap: .375rem;
    padding: .75rem 1rem;
    background: var(--p-content-hover-background);
    border-radius: .5rem;
    border: 1px solid var(--p-content-border-color);
}

.bulk-effect-item { display: flex; align-items: flex-start; gap: .5rem; font-size: .85rem; color: var(--p-text-color); }
.bulk-effect-item .pi { color: #2e7d32; font-size: .8rem; margin-top: 2px; flex-shrink: 0; }

.bulk-warning {
    display: flex;
    align-items: flex-start;
    gap: .5rem;
    padding: .65rem .875rem;
    border-radius: .5rem;
    background: rgba(230,81,0,.08);
    border: 1px solid rgba(230,81,0,.25);
    font-size: .82rem;
    color: #bf360c;
    line-height: 1.45;
}
.bulk-warning .pi { flex-shrink: 0; margin-top: 1px; }

.motivo-chips { display: flex; flex-wrap: wrap; gap: .375rem; }

.motivo-chip {
    padding: .3rem .7rem;
    border-radius: 99px;
    border: 1px solid var(--p-content-border-color);
    background: var(--p-content-background);
    color: var(--p-text-color);
    font-size: .78rem;
    cursor: pointer;
    transition: all .15s;
    font-family: inherit;
}
.motivo-chip:hover { border-color: var(--sisa-primary-l); color: var(--sisa-primary-l); }
.motivo-chip--active { background: rgba(198,40,40,.08); border-color: #c62828; color: #c62828; font-weight: 600; }

.motivo-preview {
    display: flex;
    align-items: center;
    gap: .5rem;
    margin-top: .625rem;
    padding: .5rem .75rem;
    border-radius: .5rem;
    background: var(--p-content-hover-background);
    border: 1px solid var(--p-content-border-color);
    font-size: .82rem;
    color: var(--p-text-muted-color);
}
.motivo-preview em  { font-style: normal; color: var(--p-text-color); font-weight: 500; }
.motivo-preview .pi { flex-shrink: 0; }

/* ═══════════════════════════════════════
   RESULTADO MASIVO
═══════════════════════════════════════ */
.resultado-body { display: flex; flex-direction: column; gap: .75rem; padding: .5rem 0; }

.resultado-stat {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: .75rem 1rem;
    border-radius: .625rem;
}
.resultado-stat--green { background: rgba(46,125,50,.08); border: 1px solid rgba(46,125,50,.25); }
.resultado-stat--red   { background: rgba(198,40,40,.08); border: 1px solid rgba(198,40,40,.25); }
.resultado-stat--muted { background: var(--p-content-hover-background); border: 1px solid var(--p-content-border-color); }

.resultado-num { font-size: 2.2rem; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.resultado-stat--green .resultado-num { color: #2e7d32; }
.resultado-stat--red   .resultado-num { color: #c62828; }
.resultado-stat--muted .resultado-num { color: var(--p-text-muted-color); }

.resultado-label { font-size: .9rem; color: var(--p-text-color); }
.resultado-msg   { font-size: .85rem; color: var(--p-text-muted-color); margin: 0; }

/* ═══════════════════════════════════════
   RESPONSIVE
═══════════════════════════════════════ */
@media (max-width: 960px) {
    .ps-stats-row { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
    .ps-filters-bar { flex-direction: column; align-items: flex-start; }
    .ps-filters-right { width: 100%; }
    .ps-search-input { width: 100%; }
    .ps-search-wrap { flex: 1; }
    .ps-empresa-select { flex: 1; }
}

@media (max-width: 640px) {
    .ps-page { padding: 1rem; gap: 1rem; }
    .ps-header { flex-direction: column; align-items: flex-start; }
    .ps-header-right { width: 100%; }
    .ps-periodo-select { flex: 1; }
    .ps-stats-row { grid-template-columns: repeat(2, 1fr); }
    .ps-bulk-actions { width: 100%; }
    .ps-bulk-actions .p-button { flex: 1; justify-content: center; }
}

@media (max-width: 400px) {
    .ps-stats-row { grid-template-columns: 1fr 1fr; }
    .ps-stat-num  { font-size: 1.4rem; }
}
</style>
