<script setup>
import api from '@/api/axios';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

// ==========================
// STATE
// ==========================
const loading = ref(false);
const savingReasignar = ref(false);
const savingBaja = ref(false);

const detalle = ref(null);       // fila del historial (empresa, vacante, entregables…)
const alumnoExtra = ref(null);   // datos extra: carrera, cuatrimestre, correo
const vacantes = ref([]);
const idHistorial = ref(null);

// ==========================
// MODALES
// ==========================
const reasignarDialog = ref(false);
const bajaDialog = ref(false);

// ==========================
// FORMS
// ==========================
const reasignarForm = ref({ id_nueva_categoria: null, motivo: '' });
const bajaMotivo = ref('');

// ==========================
// LOADERS
// ==========================
const idAlumno = computed(() => Number(route.params.id));

/**
 * En lugar de llamar al endpoint `/control-academico/alumno/:id` (que devuelve 500),
 * usamos `/control-academico` (que funciona) y filtramos la fila del alumno.
 * Adicionalmente llamamos a `/alumnos/:id` para obtener carrera, cuatrimestre y correo.
 */
const loadDetalle = async () => {
    loading.value = true;
    try {
        const { data: lista } = await api.get('/control-academico');
        const row = (lista ?? []).find((x) => Number(x?.alumno?.id_alumno) === idAlumno.value);

        if (!row) {
            toast.add({ severity: 'error', summary: 'No encontrado', detail: 'No se encontró historial del alumno', life: 5000 });
            router.push('/admin/control-academico');
            return;
        }

        detalle.value = row;
        idHistorial.value = row.id_historial ?? null;

        // Datos extra del alumno (carrera, cuatrimestre, correo)
        try {
            const { data: alumnoData } = await api.get(`/alumnos/${idAlumno.value}`);
            alumnoExtra.value = alumnoData ?? null;
        } catch {
            alumnoExtra.value = null;
        }
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo cargar el detalle', life: 5000 });
        router.push('/admin/control-academico');
    } finally {
        loading.value = false;
    }
};

const loadVacantes = async () => {
    try {
        const { data } = await api.get('/vacantes');
        vacantes.value = data ?? [];
    } catch {
        vacantes.value = [];
    }
};

onMounted(async () => {
    await Promise.all([loadDetalle(), loadVacantes()]);
});

watch(
    () => route.params.id,
    async () => {
        reasignarDialog.value = false;
        bajaDialog.value = false;
        reasignarForm.value = { id_nueva_categoria: null, motivo: '' };
        bajaMotivo.value = '';
        await Promise.all([loadDetalle(), loadVacantes()]);
    }
);

// ==========================
// COMPUTED
// ==========================
// Datos del alumno: merge historial + extra (/alumnos/:id)
const alumnoInfo = computed(() => {
    const base = detalle.value?.alumno ?? {};
    const extra = alumnoExtra.value ?? {};
    return {
        nombre:       base.nombre      ?? extra.usuario?.nombre ?? '-',
        matricula:    base.matricula   ?? extra.matricula        ?? '-',
        estado:       base.estado      ?? extra.estado           ?? '-',
        correo:       extra.usuario?.correo                      ?? '-',
        carrera:      extra.carrera                              ?? '-',
        cuatrimestre: extra.cuatrimestre != null ? extra.cuatrimestre : '-'
    };
});

const estadoSeverity = computed(() => {
    const e = (alumnoInfo.value.estado || '').toLowerCase();
    if (e === 'activo')   return 'success';
    if (e === 'baja')     return 'danger';
    if (e === 'graduado') return 'info';
    return 'secondary';
});

const asignacionSeverity = computed(() => {
    const e = detalle.value?.asignacion_estado;
    if (e === 'ACEPTADO')  return 'success';
    if (e === 'POSTULADO') return 'info';
    if (e === 'RECHAZADO') return 'danger';
    return 'secondary';
});

const asignacionLabel = computed(() => {
    const e = detalle.value?.asignacion_estado;
    if (!e || e === 'SIN_ASIGNAR') return 'Sin asignar';
    return e.charAt(0) + e.slice(1).toLowerCase();
});

const progresoEntregables = computed(() => {
    const arr = detalle.value?.entregables ?? [];
    const calificados = arr.filter((x) => x?.calificacion !== null && x?.calificacion !== undefined).length;
    return { total: arr.length, calificados, pendientes: arr.length - calificados };
});

const progressPct = computed(() => {
    const { total, calificados } = progresoEntregables.value;
    if (!total) return 0;
    return Math.round((calificados / total) * 100);
});

const vacantesDisponiblesLabeled = computed(() => {
    const currentId = detalle.value?.vacante?.id_categoria ?? null;
    return (vacantes.value ?? [])
        .filter((v) => v?.activa === true && Number(v?.cupo_disponible ?? 0) > 0 && v?.id_categoria !== currentId)
        .sort((a, b) => (a?.empresa?.nombre || '').localeCompare(b?.empresa?.nombre || ''))
        .map((v) => ({
            ...v,
            _label: `${v?.empresa?.nombre || 'Empresa'} — ${v?.nombre || 'Vacante'} (${v?.cupo_disponible ?? 0}/${v?.cupo_total ?? 0})`
        }));
});

const canAcciones = computed(() => !!idHistorial.value && (alumnoInfo.value.estado || '').toLowerCase() !== 'baja');

const calificacionSeverity = (c) => {
    if (c === null || c === undefined) return 'secondary';
    const n = Number(c);
    if (Number.isNaN(n)) return 'secondary';
    if (n >= 8) return 'success';
    if (n >= 6) return 'warning';
    return 'danger';
};

const fechaMx = (iso) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleDateString('es-MX'); } catch { return '-'; }
};

// ==========================
// ACCIONES
// ==========================
const goBack = () => router.push('/admin/control-academico');

const reasignarAlumno = async () => {
    if (!idHistorial.value || !reasignarForm.value.id_nueva_categoria) {
        toast.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Selecciona una nueva vacante', life: 3000 });
        return;
    }
    savingReasignar.value = true;
    try {
        await api.put(`/control-academico/${idHistorial.value}/reasignar`, {
            id_nueva_categoria: reasignarForm.value.id_nueva_categoria,
            motivo: reasignarForm.value.motivo || undefined
        });
        toast.add({ severity: 'success', summary: 'Alumno reasignado', detail: 'Se actualizó empresa/vacante correctamente.', life: 3000 });
        reasignarDialog.value = false;
        await Promise.all([loadDetalle(), loadVacantes()]);
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo reasignar', life: 5000 });
    } finally {
        savingReasignar.value = false;
    }
};

const bajaPracticas = () => {
    if (!idHistorial.value) return;
    confirm.require({
        header: 'Confirmación de baja',
        icon: 'pi pi-exclamation-triangle',
        message: `¿Dar de baja a "${alumnoInfo.value.nombre}" de prácticas profesionales? Esta acción no se puede deshacer.`,
        acceptLabel: 'Sí, dar de baja',
        rejectLabel: 'Cancelar',
        accept: async () => {
            savingBaja.value = true;
            try {
                await api.put(`/control-academico/${idHistorial.value}/baja`, {
                    motivo: bajaMotivo.value || undefined
                });
                toast.add({ severity: 'success', summary: 'Baja realizada', detail: 'El alumno fue dado de baja de prácticas.', life: 3500 });
                bajaDialog.value = false;
                router.push('/admin/control-academico');
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo dar de baja', life: 5000 });
            } finally {
                savingBaja.value = false;
            }
        }
    });
};
</script>

<template>
    <!-- LOADING -->
    <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner loading-spinner"></i>
        <span>Cargando información del alumno…</span>
    </div>

    <div v-else-if="detalle" class="page-container">
        <!-- ========================= -->
        <!-- PAGE HEADER               -->
        <!-- ========================= -->
        <div class="page-header">
            <div class="header-left">
                <Button
                    icon="pi pi-arrow-left"
                    text
                    rounded
                    @click="goBack"
                    class="back-btn"
                    v-tooltip.right="'Volver al listado'"
                />
                <div class="header-avatar">
                    <i class="pi pi-user"></i>
                </div>
                <div class="header-text">
                    <div class="header-name-row">
                        <h1 class="page-title">{{ alumnoInfo.nombre }}</h1>
                        <Tag :value="alumnoInfo.estado" :severity="estadoSeverity" class="estado-tag" />
                    </div>
                    <p class="page-subtitle">
                        <i class="pi pi-id-card"></i>
                        {{ alumnoInfo.matricula }} &nbsp;·&nbsp; {{ detalle.periodo?.nombre ?? '-' }}
                    </p>
                </div>
            </div>

            <div class="header-actions" v-if="canAcciones">
                <Button
                    icon="pi pi-sync"
                    label="Reasignar empresa"
                    severity="warning"
                    outlined
                    size="small"
                    @click="reasignarDialog = true"
                />
                <Button
                    icon="pi pi-ban"
                    label="Dar de baja"
                    severity="danger"
                    outlined
                    size="small"
                    @click="bajaDialog = true"
                />
            </div>
        </div>

        <!-- ========================= -->
        <!-- CARDS ROW                 -->
        <!-- ========================= -->
        <div class="cards-row">
            <!-- Datos del Alumno -->
            <div class="info-card">
                <div class="card-header-section">
                    <div class="card-icon-wrap blue">
                        <i class="pi pi-graduation-cap"></i>
                    </div>
                    <span class="card-title">Datos del Alumno</span>
                </div>
                <div class="card-body">
                    <div class="field-item">
                        <span class="field-label">Nombre completo</span>
                        <span class="field-value">{{ alumnoInfo.nombre }}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Matrícula</span>
                        <span class="field-value mono">{{ alumnoInfo.matricula }}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Correo electrónico</span>
                        <span class="field-value">{{ alumnoInfo.correo }}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Carrera</span>
                        <span class="field-value">{{ alumnoInfo.carrera }}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Cuatrimestre</span>
                        <span class="field-value">{{ alumnoInfo.cuatrimestre }}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Estado</span>
                        <Tag :value="alumnoInfo.estado" :severity="estadoSeverity" />
                    </div>
                </div>
            </div>

            <!-- Asignación de Prácticas -->
            <div class="info-card">
                <div class="card-header-section">
                    <div class="card-icon-wrap green">
                        <i class="pi pi-briefcase"></i>
                    </div>
                    <span class="card-title">Asignación de Prácticas</span>
                </div>
                <div class="card-body">
                    <div class="field-item">
                        <span class="field-label">Empresa</span>
                        <span class="field-value">{{ detalle.empresa?.nombre ?? '-' }}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Vacante</span>
                        <span class="field-value">{{ detalle.vacante?.nombre ?? '-' }}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Período</span>
                        <span class="field-value">{{ detalle.periodo?.nombre ?? '-' }}</span>
                    </div>
                    <div class="field-item">
                        <span class="field-label">Estado de asignación</span>
                        <Tag :value="asignacionLabel" :severity="asignacionSeverity" />
                    </div>
                    <div class="field-item" v-if="detalle.asignacion_tipo">
                        <span class="field-label">Tipo de asignación</span>
                        <Tag
                            :value="detalle.asignacion_tipo === 'automatica' ? 'Automática' : 'Por postulación'"
                            :severity="detalle.asignacion_tipo === 'automatica' ? 'warning' : 'info'"
                        />
                    </div>
                </div>
            </div>

            <!-- Progreso Entregables -->
            <div class="info-card progress-card">
                <div class="card-header-section">
                    <div class="card-icon-wrap amber">
                        <i class="pi pi-chart-bar"></i>
                    </div>
                    <span class="card-title">Progreso Entregables</span>
                </div>
                <div class="card-body progress-body">
                    <div class="progress-big">
                        <span class="progress-num">{{ progresoEntregables.calificados }}</span>
                        <span class="progress-sep">/</span>
                        <span class="progress-total">{{ progresoEntregables.total }}</span>
                    </div>
                    <div class="progress-sublabel">calificados</div>
                    <div class="progress-bar-wrap">
                        <div class="progress-bar-track">
                            <div
                                class="progress-bar-fill"
                                :style="{ width: progressPct + '%' }"
                                :class="{
                                    'fill-complete': progressPct === 100,
                                    'fill-partial': progressPct > 0 && progressPct < 100,
                                    'fill-empty': progressPct === 0
                                }"
                            ></div>
                        </div>
                        <span class="progress-pct">{{ progressPct }}%</span>
                    </div>
                    <div class="progress-stats">
                        <span class="stat-item stat-ok">
                            <i class="pi pi-check-circle"></i>
                            {{ progresoEntregables.calificados }} calificados
                        </span>
                        <span class="stat-item stat-pending">
                            <i class="pi pi-clock"></i>
                            {{ progresoEntregables.pendientes }} pendientes
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- ========================= -->
        <!-- ENTREGABLES               -->
        <!-- ========================= -->
        <div class="section-card">
            <div class="section-header">
                <div class="card-icon-wrap blue">
                    <i class="pi pi-file"></i>
                </div>
                <span class="section-title">Detalle de Entregables</span>
            </div>

            <div v-if="detalle.entregables?.length" class="entregables-list">
                <div
                    v-for="e in detalle.entregables"
                    :key="e.id_entregable ?? e.numero"
                    class="entregable-row"
                >
                    <div class="entregable-num-badge">{{ e.numero }}</div>
                    <div class="entregable-info">
                        <span class="entregable-nombre">{{ e.nombre }}</span>
                        <span class="entregable-fecha" v-if="e.fecha_limite">
                            <i class="pi pi-calendar"></i>
                            Límite: {{ fechaMx(e.fecha_limite) }}
                        </span>
                    </div>
                    <Tag
                        :value="e.calificacion !== null && e.calificacion !== undefined ? String(e.calificacion) : 'Pendiente'"
                        :severity="calificacionSeverity(e.calificacion)"
                        class="calificacion-tag"
                    />
                </div>
            </div>

            <div v-else class="empty-state">
                <i class="pi pi-inbox"></i>
                <span>No hay entregables registrados para este período</span>
            </div>
        </div>
    </div>

    <!-- ========================= -->
    <!-- MODAL REASIGNAR           -->
    <!-- ========================= -->
    <Dialog
        v-model:visible="reasignarDialog"
        modal
        header="Reasignar Empresa / Vacante"
        :style="{ width: '520px' }"
    >
        <div class="dialog-form">
            <div class="form-field">
                <label class="form-label">Nueva Vacante</label>
                <Select
                    v-model="reasignarForm.id_nueva_categoria"
                    :options="vacantesDisponiblesLabeled"
                    optionLabel="_label"
                    optionValue="id_categoria"
                    placeholder="Selecciona una vacante disponible"
                    class="w-full"
                    showClear
                    filter
                />
                <small class="form-hint" v-if="!vacantesDisponiblesLabeled.length">
                    No hay vacantes con cupo disponible en este período.
                </small>
            </div>
            <div class="form-field">
                <label class="form-label">Motivo (opcional)</label>
                <Textarea
                    v-model="reasignarForm.motivo"
                    rows="3"
                    placeholder="Indica el motivo de la reasignación…"
                    class="w-full"
                />
            </div>
        </div>
        <template #footer>
            <Button text label="Cancelar" @click="reasignarDialog = false" />
            <Button
                label="Reasignar"
                icon="pi pi-check"
                severity="success"
                :disabled="!reasignarForm.id_nueva_categoria"
                :loading="savingReasignar"
                @click="reasignarAlumno"
            />
        </template>
    </Dialog>

    <!-- ========================= -->
    <!-- MODAL BAJA                -->
    <!-- ========================= -->
    <Dialog
        v-model:visible="bajaDialog"
        modal
        header="Dar de Baja de Prácticas"
        :style="{ width: '460px' }"
    >
        <div class="dialog-form">
            <div class="dialog-warning-box">
                <i class="pi pi-exclamation-triangle"></i>
                <span>
                    Se dará de baja a <strong>{{ alumnoInfo.nombre }}</strong> de sus prácticas profesionales.
                    Esta acción <strong>no se puede deshacer</strong>.
                </span>
            </div>
            <div class="form-field">
                <label class="form-label">Motivo de baja (opcional)</label>
                <Textarea
                    v-model="bajaMotivo"
                    rows="4"
                    placeholder="Describe el motivo de la baja…"
                    class="w-full"
                />
            </div>
        </div>
        <template #footer>
            <Button text label="Cancelar" @click="bajaDialog = false" />
            <Button
                label="Confirmar baja"
                icon="pi pi-ban"
                severity="danger"
                :loading="savingBaja"
                @click="bajaPracticas"
            />
        </template>
    </Dialog>
</template>

<style scoped>
/* ================================
   LOADING
================================ */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 4rem;
    color: var(--p-text-muted-color);
    font-size: 0.95rem;
}

.loading-spinner {
    font-size: 2rem;
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
}

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
    gap: 1rem;
    flex-wrap: wrap;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.back-btn {
    flex-shrink: 0;
}

.header-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.12));
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    flex-shrink: 0;
}

.header-text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}

.header-name-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
}

.page-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0;
    line-height: 1.2;
}

.estado-tag {
    font-size: 0.75rem;
}

.page-subtitle {
    font-size: 0.82rem;
    color: var(--p-text-muted-color);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.header-actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
}

/* ================================
   CARDS ROW
================================ */
.cards-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
}

.info-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 12px;
    overflow: hidden;
}

/* ================================
   CARD HEADER SECTION
================================ */
.card-header-section {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.875rem 1rem 0.75rem;
    border-bottom: 1px solid var(--p-content-border-color);
}

.card-icon-wrap {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    flex-shrink: 0;
}

.card-icon-wrap.blue {
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.12));
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
}

.card-icon-wrap.green {
    background: var(--sisa-tint-green, rgba(22, 163, 74, 0.1));
    color: var(--sisa-icon-green, #16a34a);
}

.card-icon-wrap.amber {
    background: var(--sisa-tint-amber, rgba(217, 119, 6, 0.1));
    color: var(--sisa-icon-amber, #d97706);
}

.card-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--p-text-color);
}

/* ================================
   CARD BODY / FIELDS
================================ */
.card-body {
    padding: 0.875rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
}

.field-item {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.field-label {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-text-muted-color);
}

.field-value {
    font-size: 0.9rem;
    color: var(--p-text-color);
    font-weight: 500;
}

.field-value.mono {
    font-family: monospace;
    font-size: 0.88rem;
    letter-spacing: 0.05em;
}

/* ================================
   PROGRESS CARD
================================ */
.progress-card .progress-body {
    align-items: center;
    text-align: center;
    padding: 1.25rem 1rem;
}

.progress-big {
    display: flex;
    align-items: baseline;
    gap: 0.2rem;
    line-height: 1;
}

.progress-num {
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
}

.progress-sep {
    font-size: 1.5rem;
    color: var(--p-text-muted-color);
    font-weight: 300;
}

.progress-total {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
}

.progress-sublabel {
    font-size: 0.78rem;
    color: var(--p-text-muted-color);
    margin-top: 0.1rem;
}

.progress-bar-wrap {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    margin-top: 0.75rem;
}

.progress-bar-track {
    flex: 1;
    height: 6px;
    border-radius: 4px;
    background: var(--p-surface-100);
    overflow: hidden;
}

.progress-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.4s ease;
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

.progress-pct {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--p-text-muted-color);
    min-width: 36px;
    text-align: right;
}

.progress-stats {
    display: flex;
    gap: 1rem;
    margin-top: 0.75rem;
}

.stat-item {
    font-size: 0.78rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
}

.stat-ok {
    color: var(--sisa-icon-green, #16a34a);
}

.stat-pending {
    color: var(--sisa-icon-amber, #d97706);
}

/* ================================
   SECTION CARD (Entregables)
================================ */
.section-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 12px;
    overflow: hidden;
}

.section-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.875rem 1rem 0.75rem;
    border-bottom: 1px solid var(--p-content-border-color);
}

.section-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--p-text-color);
}

/* ================================
   ENTREGABLES LIST
================================ */
.entregables-list {
    display: flex;
    flex-direction: column;
}

.entregable-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--p-content-border-color);
}

.entregable-row:last-child {
    border-bottom: none;
}

.entregable-num-badge {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--p-surface-100);
    border: 1px solid var(--p-content-border-color);
    color: var(--p-text-muted-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
}

.entregable-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.entregable-nombre {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.entregable-fecha {
    font-size: 0.76rem;
    color: var(--p-text-muted-color);
    display: flex;
    align-items: center;
    gap: 0.3rem;
}

.calificacion-tag {
    flex-shrink: 0;
}

/* ================================
   EMPTY STATE
================================ */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 2.5rem 1rem;
    color: var(--p-text-muted-color);
    font-size: 0.88rem;
}

.empty-state .pi {
    font-size: 2rem;
    opacity: 0.4;
}

/* ================================
   DIALOG FORM
================================ */
.dialog-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.25rem 0 0.5rem;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.form-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.form-hint {
    font-size: 0.76rem;
    color: var(--sisa-icon-amber, #d97706);
}

.dialog-warning-box {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    background: var(--sisa-tint-red, rgba(220, 38, 38, 0.08));
    color: var(--sisa-icon-red, #dc2626);
    font-size: 0.85rem;
    line-height: 1.5;
}

.dialog-warning-box .pi {
    font-size: 1rem;
    flex-shrink: 0;
    margin-top: 0.1rem;
}

/* ================================
   RESPONSIVE
================================ */
@media (max-width: 1024px) {
    .cards-row {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 640px) {
    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .header-actions {
        width: 100%;
    }

    .cards-row {
        grid-template-columns: 1fr;
    }
}
</style>
