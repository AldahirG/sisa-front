<script setup>
import api from '@/api/axios';
import { useDescargarReporte } from '@/composables/useDescargarReporte';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from '@/composables/useAppToast';
import { onMounted, reactive, ref } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import ConfirmDialog from 'primevue/confirmdialog';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';

const toast = useToast();
const confirm = useConfirm();
const { descargar } = useDescargarReporte();

// =======================
// STATE
// =======================
const periodos = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);

const SEMESTRES = Array.from({ length: 10 }, (_, i) => ({
    label: `${i + 1}° Semestre`,
    value: i + 1
}));

const periodoForm = ref({
    id_periodo: null,
    nombre: '',
    programa: '',
    fecha_inicio: null,
    fecha_fin: null,
    estado: 'cerrado',
    semestre: null
});

// =======================
// HELPERS
// =======================
const formatDateForApi = (date) => {
    if (!date) return null;
    return new Date(date).toISOString().split('T')[0];
};

const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

// =======================
// FETCH
// =======================
const loadPeriodos = async () => {
    try {
        loading.value = true;
        const { data } = await api.get('/periodos');
        periodos.value = data;
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar los periodos',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
};

// =======================
// MODAL
// =======================
const openNew = () => {
    isEdit.value = false;
    periodoForm.value = {
        id_periodo: null,
        nombre: '',
        programa: '',
        fecha_inicio: null,
        fecha_fin: null,
        estado: 'cerrado',
        semestre: null
    };
    dialogVisible.value = true;
};

const editPeriodo = (p) => {
    isEdit.value = true;
    periodoForm.value = {
        ...p,
        fecha_inicio: p.fecha_inicio ? new Date(p.fecha_inicio + 'T00:00:00') : null,
        fecha_fin: p.fecha_fin ? new Date(p.fecha_fin + 'T00:00:00') : null,
        semestre: p.semestre ?? null
    };
    dialogVisible.value = true;
};

// =======================
// SAVE
// =======================
const savePeriodo = async () => {
    if (!periodoForm.value.nombre || !periodoForm.value.programa) {
        toast.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Nombre y programa son obligatorios', life: 3000 });
        return;
    }
    try {
        const payload = {
            ...periodoForm.value,
            fecha_inicio: formatDateForApi(periodoForm.value.fecha_inicio),
            fecha_fin: formatDateForApi(periodoForm.value.fecha_fin)
        };

        if (isEdit.value) {
            await api.put(`/periodos/${payload.id_periodo}`, payload);
            toast.add({ severity: 'success', summary: 'Actualizado', detail: 'Periodo actualizado', life: 3000 });
        } else {
            await api.post('/periodos', payload);
            toast.add({ severity: 'success', summary: 'Creado', detail: 'Periodo creado', life: 3000 });
        }

        dialogVisible.value = false;
        loadPeriodos();
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo guardar el periodo',
            life: 4000
        });
    }
};

// =======================
// ELIMINAR
// =======================
const eliminarPeriodo = (p) => {
    confirm.require({
        message: `¿Estás seguro de que deseas eliminar el periodo "${p.nombre}"? Esta acción no se puede deshacer.`,
        header: 'Eliminar período',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await api.delete(`/periodos/${p.id_periodo}`);
                toast.add({ severity: 'success', summary: 'Eliminado', detail: 'Periodo eliminado correctamente', life: 3000 });
                loadPeriodos();
            } catch (e) {
                const detail = e?.response?.data?.message || 'No se pudo eliminar el periodo';
                toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 });
            }
        }
    });
};

// =======================
// ACTIVAR / CERRAR
// =======================
const toggleEstado = (periodo) => {
    const nuevoEstado = periodo.estado === 'activo' ? 'cerrado' : 'activo';
    const accion = nuevoEstado === 'activo' ? 'activar' : 'cerrar';

    confirm.require({
        message: `¿Deseas ${accion} el periodo "${periodo.nombre}"?`,
        header: 'Confirmar cambio de estado',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Confirmar',
        rejectLabel: 'Cancelar',
        acceptClass: nuevoEstado === 'activo' ? 'p-button-success' : 'p-button-warning',
        accept: async () => {
            try {
                await api.put(`/periodos/${periodo.id_periodo}`, {
                    ...periodo,
                    estado: nuevoEstado
                });
                toast.add({
                    severity: 'success',
                    summary: 'Actualizado',
                    detail: `Periodo ${accion === 'activar' ? 'activado' : 'cerrado'} correctamente`,
                    life: 3000
                });
                loadPeriodos();
            } catch {
                toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el estado', life: 4000 });
            }
        }
    });
};

onMounted(loadPeriodos);

// =======================
// REPORTES
// =======================

// Rastrear descarga activa por clave "tipo_id" — permite estado independiente por card
const descargando = reactive({});

// Dialog de confirmación institucional
const showDownloadDialog = ref(false);
const pendingDownload = ref(null); // { tipo, periodo }

const HOJAS = {
    periodo: [
        { icono: 'pi pi-chart-bar', nombre: 'Resumen por Carrera', desc: 'Tabla agrupada: Liberados / No Liberados / Baja / Total' },
        { icono: 'pi pi-users',     nombre: 'Detalle Alumnos',      desc: 'Fila por alumno con datos completos y calificaciones' },
        { icono: 'pi pi-building',  nombre: 'Empresas',             desc: 'Lista de empresas con alumnos asignados' }
    ],
    encuestas: [
        { icono: 'pi pi-list',       nombre: 'Respuestas',           desc: 'Fila por alumno, columna por pregunta' },
        { icono: 'pi pi-book',       nombre: 'Catálogo Preguntas',   desc: 'Índice de preguntas con tipo y opciones' },
        { icono: 'pi pi-chart-line', nombre: 'Resumen Escala',       desc: 'Promedio por alumno en preguntas de escala numérica' }
    ]
};

const abrirConfirmDescarga = (tipo, periodo) => {
    pendingDownload.value = { tipo, periodo };
    showDownloadDialog.value = true;
};

const ejecutarDescarga = async () => {
    if (!pendingDownload.value) return;
    const { tipo, periodo } = pendingDownload.value;
    const key = `${tipo}_${periodo.id_periodo}`;
    showDownloadDialog.value = false;

    descargando[key] = true;
    try {
        await descargar(tipo, periodo.id_periodo, periodo.nombre);
        toast.add({
            severity: 'success',
            summary: 'Descarga iniciada',
            detail: `Reporte de ${tipo === 'encuestas' ? 'encuestas' : 'período'} generado correctamente`,
            life: 3500
        });
    } catch (e) {
        const msg = e?.message || e?.response?.data?.message || 'No se pudo generar el reporte';
        const esVacio = e?.response?.status === 404 || msg.toLowerCase().includes('sin datos') || msg.toLowerCase().includes('no hay');
        toast.add({
            severity: esVacio ? 'warn' : 'error',
            summary: esVacio ? 'Sin datos' : 'Error al descargar',
            detail: esVacio ? `No hay datos para generar el reporte de "${periodo.nombre}"` : msg,
            life: 5000
        });
    } finally {
        descargando[key] = false;
    }
};
</script>

<template>
    <div class="page-container">
        <!-- ══════════════════════════════════
             HEADER
        ══════════════════════════════════ -->
        <div class="page-header">
            <div class="page-title-group">
                <span class="page-icon">
                    <i class="pi pi-calendar" />
                </span>
                <div>
                    <h4 class="page-title">Períodos Académicos</h4>
                    <p class="page-subtitle">Gestiona los periodos del programa de prácticas</p>
                </div>
            </div>
            <Button label="Nuevo período" icon="pi pi-plus" @click="openNew" />
        </div>

        <!-- ══════════════════════════════════
             LOADING SKELETON
        ══════════════════════════════════ -->
        <div v-if="loading" class="cards-grid">
            <div v-for="n in 4" :key="n" class="periodo-card skeleton-card" />
        </div>

        <!-- ══════════════════════════════════
             EMPTY STATE
        ══════════════════════════════════ -->
        <div v-else-if="!periodos.length" class="empty-state">
            <i class="pi pi-calendar-times empty-icon" />
            <p class="empty-text">No hay períodos registrados</p>
            <Button label="Crear primer período" icon="pi pi-plus" @click="openNew" />
        </div>

        <!-- ══════════════════════════════════
             CARDS GRID
        ══════════════════════════════════ -->
        <div v-else class="cards-grid">
            <div
                v-for="p in periodos"
                :key="p.id_periodo"
                class="periodo-card"
                :class="{
                    'is-active': p.estado === 'activo',
                    'is-closed': p.estado !== 'activo'
                }"
            >
                <!-- Status indicator bar -->
                <div class="card-accent-bar" />

                <!-- Card body -->
                <div class="card-body">
                    <!-- Top row: name + badge -->
                    <div class="card-top">
                        <h5 class="card-name">{{ p.nombre }}</h5>
                        <Tag
                            :value="p.estado === 'activo' ? 'Activo' : 'Cerrado'"
                            :severity="p.estado === 'activo' ? 'success' : 'secondary'"
                        />
                    </div>

                    <!-- Program -->
                    <div class="card-meta">
                        <i class="pi pi-book meta-icon" />
                        <span>{{ p.programa }}</span>
                    </div>

                    <!-- Semestre -->
                    <div class="card-meta">
                        <i class="pi pi-users meta-icon" />
                        <span v-if="p.semestre" class="nivel-chip">{{ p.semestre }}° Semestre</span>
                        <span v-else class="nivel-chip nivel-chip--none">Todos los semestres</span>
                    </div>

                    <!-- Dates -->
                    <div class="card-dates">
                        <div class="date-item">
                            <span class="date-label">INICIO</span>
                            <span class="date-value">{{ formatDateDisplay(p.fecha_inicio) }}</span>
                        </div>
                        <div class="date-divider" />
                        <div class="date-item">
                            <span class="date-label">FIN</span>
                            <span class="date-value">{{ formatDateDisplay(p.fecha_fin) }}</span>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="card-actions">
                        <Button
                            icon="pi pi-pencil"
                            label="Editar"
                            size="small"
                            text
                            @click="editPeriodo(p)"
                        />
                        <Button
                            :icon="p.estado === 'activo' ? 'pi pi-lock' : 'pi pi-unlock'"
                            :label="p.estado === 'activo' ? 'Cerrar' : 'Activar'"
                            size="small"
                            :severity="p.estado === 'activo' ? 'warning' : 'success'"
                            text
                            @click="toggleEstado(p)"
                        />
                        <Button
                            icon="pi pi-trash"
                            label="Eliminar"
                            size="small"
                            severity="danger"
                            text
                            @click="eliminarPeriodo(p)"
                        />
                    </div>

                    <!-- Reportes -->
                    <div class="card-reports">
                        <span class="reports-label">
                            <i class="pi pi-file-excel"></i>
                            Reportes Excel
                        </span>
                        <div class="reports-buttons">
                            <Button
                                icon="pi pi-download"
                                label="Período"
                                size="small"
                                outlined
                                severity="secondary"
                                class="report-btn"
                                :loading="!!descargando[`periodo_${p.id_periodo}`]"
                                v-tooltip.bottom="'Resumen por carrera · Detalle alumnos · Empresas'"
                                @click="abrirConfirmDescarga('periodo', p)"
                            />
                            <Button
                                icon="pi pi-download"
                                label="Encuestas"
                                size="small"
                                outlined
                                severity="secondary"
                                class="report-btn"
                                :loading="!!descargando[`encuestas_${p.id_periodo}`]"
                                v-tooltip.bottom="'Respuestas · Catálogo preguntas · Resumen escala'"
                                @click="abrirConfirmDescarga('encuestas', p)"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ══════════════════════════════════
             FORM DIALOG
        ══════════════════════════════════ -->
        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="isEdit ? 'Editar período' : 'Nuevo período'"
            :style="{ width: '600px' }"
            :breakpoints="{ '960px': '90vw', '640px': '95vw' }"
        >
            <div class="periodo-form">
                <div class="field">
                    <label class="field-label">
                        <i class="pi pi-calendar" />
                        Nombre del período
                    </label>
                    <InputText v-model="periodoForm.nombre" placeholder="Ej. Enero–Junio 2025" class="w-full" />
                </div>

                <div class="field">
                    <label class="field-label">
                        <i class="pi pi-book" />
                        Programa
                    </label>
                    <InputText v-model="periodoForm.programa" placeholder="Ej. Ingeniería en Sistemas" class="w-full" />
                </div>

                <div class="field">
                    <label class="field-label">
                        <i class="pi pi-calendar-plus" />
                        Fecha inicio
                    </label>
                    <DatePicker
                        v-model="periodoForm.fecha_inicio"
                        showIcon
                        dateFormat="dd/mm/yy"
                        :maxDate="periodoForm.fecha_fin"
                        class="w-full"
                    />
                </div>

                <div class="field">
                    <label class="field-label">
                        <i class="pi pi-calendar-minus" />
                        Fecha fin
                    </label>
                    <DatePicker
                        v-model="periodoForm.fecha_fin"
                        showIcon
                        dateFormat="dd/mm/yy"
                        :minDate="periodoForm.fecha_inicio"
                        class="w-full"
                    />
                </div>

                <div class="field field--full">
                    <label class="field-label">
                        <i class="pi pi-users" />
                        Semestre
                    </label>
                    <Select
                        v-model="periodoForm.semestre"
                        :options="SEMESTRES"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Todos los semestres"
                        showClear
                        class="w-full"
                    />
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <Button label="Cancelar" icon="pi pi-times" text @click="dialogVisible = false" />
                    <Button label="Guardar" icon="pi pi-check" severity="success" @click="savePeriodo" />
                </div>
            </template>
        </Dialog>

        <ConfirmDialog />
        <Toast />
    </div>

    <!-- ══════════════════════════════════
         DIALOG CONFIRMACIÓN DESCARGA
    ══════════════════════════════════ -->
    <Dialog
        v-model:visible="showDownloadDialog"
        modal
        :style="{ width: '480px' }"
        :closable="true"
        :draggable="false"
    >
        <!-- Header personalizado -->
        <template #header>
            <div class="dl-dialog-header">
                <div class="dl-header-icon">
                    <i class="pi pi-file-excel"></i>
                </div>
                <div>
                    <div class="dl-header-title">Generar reporte Excel</div>
                    <div class="dl-header-sub">
                        {{ pendingDownload?.tipo === 'encuestas' ? 'Reporte de encuestas' : 'Reporte de período' }}
                    </div>
                </div>
            </div>
        </template>

        <div v-if="pendingDownload" class="dl-body">

            <!-- Documento preview -->
            <div class="dl-doc-preview">
                <div class="dl-doc-icon-wrap">
                    <i class="pi pi-file-excel dl-doc-icon"></i>
                </div>
                <div class="dl-doc-info">
                    <span class="dl-doc-name">
                        reporte_{{ pendingDownload.tipo === 'encuestas' ? 'encuestas' : 'periodo' }}_{{ (pendingDownload.periodo.nombre || '').replace(/\s+/g,'_') }}.xlsx
                    </span>
                    <div class="dl-doc-meta">
                        <span class="dl-meta-chip">
                            <i class="pi pi-calendar"></i>
                            {{ pendingDownload.periodo.nombre }}
                        </span>
                        <span class="dl-meta-chip">
                            <i class="pi pi-table"></i>
                            Microsoft Excel (.xlsx)
                        </span>
                    </div>
                </div>
            </div>

            <!-- Contenido del documento -->
            <div class="dl-content-section">
                <div class="dl-section-title">
                    <i class="pi pi-list-check"></i>
                    Contenido del documento
                </div>
                <div class="dl-sheets">
                    <div
                        v-for="(hoja, idx) in HOJAS[pendingDownload.tipo]"
                        :key="hoja.nombre"
                        class="dl-sheet-row"
                    >
                        <div class="dl-sheet-num">{{ idx + 1 }}</div>
                        <div class="dl-sheet-icon">
                            <i :class="hoja.icono"></i>
                        </div>
                        <div class="dl-sheet-text">
                            <span class="dl-sheet-name">{{ hoja.nombre }}</span>
                            <span class="dl-sheet-desc">{{ hoja.desc }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Nota -->
            <div class="dl-note">
                <i class="pi pi-info-circle"></i>
                <span>El reporte refleja el estado actual del sistema en el momento de la descarga.</span>
            </div>
        </div>

        <template #footer>
            <div class="dl-footer">
                <Button
                    label="Cancelar"
                    icon="pi pi-times"
                    text
                    severity="secondary"
                    @click="showDownloadDialog = false"
                />
                <Button
                    label="Descargar reporte"
                    icon="pi pi-download"
                    @click="ejecutarDescarga"
                />
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
/* ══════════════════════════════════
   PAGE LAYOUT
══════════════════════════════════ */
.page-container {
    padding: 1.5rem;
}

.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.75rem;
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
    background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue);
    font-size: 1.25rem;
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

/* ══════════════════════════════════
   CARDS GRID
══════════════════════════════════ */
.cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
}

/* ══════════════════════════════════
   PERIODO CARD
══════════════════════════════════ */
.periodo-card {
    border-radius: .75rem;
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: box-shadow 0.2s, transform 0.2s;
}

.periodo-card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
}

/* Accent bar at top */
.card-accent-bar {
    height: 4px;
    background: var(--p-content-border-color);
    transition: background 0.2s;
}

.periodo-card.is-active .card-accent-bar {
    background: var(--sisa-icon-green);
}

.periodo-card.is-closed .card-accent-bar {
    background: var(--p-content-border-color);
}

/* Left border highlight for active */
.periodo-card.is-active {
    border-left: 3px solid var(--sisa-icon-green);
}

.periodo-card.is-closed {
    opacity: 0.82;
}

.card-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: .75rem;
    flex: 1;
}

.card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: .5rem;
}

.card-name {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--p-text-color);
    line-height: 1.3;
}

.card-meta {
    display: flex;
    align-items: center;
    gap: .5rem;
    font-size: .85rem;
    color: var(--p-text-muted-color);
}

.meta-icon {
    font-size: .8rem;
    color: var(--sisa-icon-blue);
}

/* ── Dates ─────────────────────── */
.card-dates {
    display: flex;
    align-items: center;
    gap: .75rem;
    padding: .75rem;
    border-radius: .5rem;
    background: var(--sisa-surface, var(--p-content-background));
    border: 1px solid var(--p-content-border-color);
}

.date-item {
    display: flex;
    flex-direction: column;
    gap: .15rem;
    flex: 1;
}

.date-label {
    font-size: .65rem;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--p-text-muted-color);
}

.date-value {
    font-size: .82rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.date-divider {
    width: 1px;
    height: 2rem;
    background: var(--p-content-border-color);
    flex-shrink: 0;
}

/* ── Actions ───────────────────── */
.card-actions {
    display: flex;
    gap: .25rem;
    margin-top: auto;
    padding-top: .5rem;
    border-top: 1px solid var(--p-content-border-color);
}

/* ══════════════════════════════════
   SKELETON
══════════════════════════════════ */
.skeleton-card {
    height: 210px;
    animation: skeleton-pulse 1.4s ease-in-out infinite;
    background: var(--p-content-border-color);
}

@keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: .45; }
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
    opacity: .35;
}

.empty-text {
    margin: 0;
    font-size: .95rem;
}

/* ══════════════════════════════════
   FORM
══════════════════════════════════ */
.periodo-form {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
    padding: .25rem 0;
}

.field {
    display: flex;
    flex-direction: column;
    gap: .45rem;
}

.field-label {
    font-size: .78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--p-text-muted-color);
    display: flex;
    align-items: center;
    gap: .4rem;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: .75rem;
}

.field--full {
    grid-column: 1 / -1;
}

/* Semestre chip on card */
.nivel-chip {
    font-size: .78rem;
    font-weight: 600;
    color: var(--sisa-icon-blue, #1565C0);
    background: var(--sisa-tint-blue, rgba(21,101,192,.08));
    padding: .15rem .5rem;
    border-radius: 20px;
}

.nivel-chip--none {
    color: var(--p-text-muted-color);
    background: var(--p-surface-100);
    font-weight: 400;
}

/* ══════════════════════════════════
   CARD — REPORTES ROW
══════════════════════════════════ */
.card-reports {
    display: flex;
    flex-direction: column;
    gap: .45rem;
    padding-top: .6rem;
    border-top: 1px dashed var(--p-content-border-color);
}

.reports-label {
    display: flex;
    align-items: center;
    gap: .35rem;
    font-size: .68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: var(--sisa-icon-green, #16a34a);
}

.reports-buttons {
    display: flex;
    gap: .4rem;
}

.report-btn {
    flex: 1;
    font-size: .78rem !important;
    white-space: nowrap;
}

/* ══════════════════════════════════
   DOWNLOAD DIALOG
══════════════════════════════════ */
.dl-dialog-header {
    display: flex;
    align-items: center;
    gap: .75rem;
}

.dl-header-icon {
    width: 38px;
    height: 38px;
    border-radius: 9px;
    background: rgba(22, 163, 74, 0.12);
    color: var(--sisa-icon-green, #16a34a);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    flex-shrink: 0;
}

.dl-header-title {
    font-size: .95rem;
    font-weight: 700;
    color: var(--p-text-color);
    line-height: 1.2;
}

.dl-header-sub {
    font-size: .78rem;
    color: var(--p-text-muted-color);
    margin-top: .1rem;
}

/* Body */
.dl-body {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    padding: .25rem 0 .25rem;
}

/* Document preview strip */
.dl-doc-preview {
    display: flex;
    align-items: center;
    gap: .875rem;
    padding: .875rem 1rem;
    border-radius: 10px;
    background: var(--p-surface-50, #fafafa);
    border: 1px solid var(--p-content-border-color);
}

.dl-doc-icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: rgba(22, 163, 74, 0.1);
    color: var(--sisa-icon-green, #16a34a);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    flex-shrink: 0;
}

.dl-doc-icon { font-size: 1.5rem; }

.dl-doc-info {
    display: flex;
    flex-direction: column;
    gap: .4rem;
    min-width: 0;
}

.dl-doc-name {
    font-size: .82rem;
    font-weight: 700;
    color: var(--p-text-color);
    font-family: monospace;
    word-break: break-all;
}

.dl-doc-meta {
    display: flex;
    flex-wrap: wrap;
    gap: .35rem;
}

.dl-meta-chip {
    display: inline-flex;
    align-items: center;
    gap: .25rem;
    font-size: .72rem;
    font-weight: 600;
    padding: .15rem .5rem;
    border-radius: 20px;
    background: var(--p-surface-100);
    color: var(--p-text-muted-color);
    border: 1px solid var(--p-content-border-color);
}

.dl-meta-chip .pi { font-size: .7rem; }

/* Sheets list */
.dl-content-section {
    display: flex;
    flex-direction: column;
    gap: .6rem;
}

.dl-section-title {
    display: flex;
    align-items: center;
    gap: .4rem;
    font-size: .75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--p-text-muted-color);
}

.dl-sheets {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--p-content-border-color);
    border-radius: 9px;
    overflow: hidden;
}

.dl-sheet-row {
    display: flex;
    align-items: center;
    gap: .75rem;
    padding: .65rem .875rem;
    border-bottom: 1px solid var(--p-content-border-color);
    background: var(--p-content-background);
    transition: background .15s;
}

.dl-sheet-row:last-child { border-bottom: none; }
.dl-sheet-row:hover { background: var(--p-surface-50); }

.dl-sheet-num {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--sisa-tint-blue, rgba(21,101,192,.1));
    color: var(--sisa-icon-blue, #1565C0);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: .7rem;
    font-weight: 800;
    flex-shrink: 0;
}

.dl-sheet-icon {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: var(--p-surface-100);
    color: var(--sisa-icon-blue, #1565C0);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: .85rem;
    flex-shrink: 0;
}

.dl-sheet-text {
    display: flex;
    flex-direction: column;
    gap: .1rem;
    flex: 1;
    min-width: 0;
}

.dl-sheet-name {
    font-size: .84rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.dl-sheet-desc {
    font-size: .74rem;
    color: var(--p-text-muted-color);
}

/* Note */
.dl-note {
    display: flex;
    align-items: flex-start;
    gap: .5rem;
    padding: .55rem .75rem;
    border-radius: 8px;
    background: var(--sisa-tint-blue, rgba(21,101,192,.06));
    color: var(--p-text-muted-color);
    font-size: .8rem;
    line-height: 1.45;
}

.dl-note .pi {
    color: var(--sisa-icon-blue, #1565C0);
    flex-shrink: 0;
    margin-top: .1rem;
}

/* Footer */
.dl-footer {
    display: flex;
    justify-content: flex-end;
    gap: .625rem;
    width: 100%;
}

/* ══════════════════════════════════
   RESPONSIVE
══════════════════════════════════ */
@media (max-width: 640px) {
    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .periodo-form {
        grid-template-columns: 1fr;
    }

    .reports-buttons {
        flex-direction: column;
    }
}
</style>
