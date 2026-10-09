<script setup>
import api from '@/api/axios';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from '@/composables/useAppToast';
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
const encuestasData = ref([]);
const loadingEncuestas = ref(false);
const encuestaSeleccionada = ref(null); // null = vista cards (si hay >1)

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

const loadDetalle = async () => {
    loading.value = true;
    try {
        const { data } = await api.get(`/control-academico/alumno/${idAlumno.value}`);

        if (!data?.periodos?.length) {
            toast.add({ severity: 'error', summary: 'No encontrado', detail: 'No se encontró historial del alumno', life: 5000 });
            router.push('/admin/control-academico');
            return;
        }

        const h = data.periodos[0]; // período más reciente

        detalle.value = {
            id_historial:        h.id_historial,
            alumno:              data.alumno,
            empresa:             h.empresa,
            vacante:             h.vacante,
            periodo:             h.periodo,
            asignacion_estado:   data.alumno.estado === 'baja'
                ? 'BAJA'
                : h.liberado
                    ? 'LIBERADO'
                    : 'ASIGNADO',
            asignacion_tipo:     null,
            entregables:         h.entregables ?? [],
            encuesta_completada: h.encuesta_completada ?? false,
        };
        idHistorial.value = h.id_historial;

        // Cargar respuestas de encuestas del alumno en su periodo
        if (h.periodo?.id_periodo && data.alumno?.id_alumno) {
            loadingEncuestas.value = true;
            try {
                const { data: enc } = await api.get(
                    `/encuestas/alumno/${data.alumno.id_alumno}/respuestas-periodo/${h.periodo.id_periodo}`
                );
                encuestasData.value = enc ?? [];
            } catch {
                encuestasData.value = [];
            } finally {
                loadingEncuestas.value = false;
            }
        }

        alumnoExtra.value = {
            matricula:    data.alumno.matricula,
            carrera:      data.alumno.carrera,
            cuatrimestre: data.alumno.cuatrimestre,
            estado:       data.alumno.estado,
            usuario: {
                nombre: data.alumno.nombre,
                correo: data.alumno.correo,
            },
        };
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

const alumnoInitials = computed(() => {
    const parts = (alumnoInfo.value.nombre || '').trim().split(/\s+/);
    const a = (parts[0] || '')[0] ?? '';
    const b = (parts[1] || '')[0] ?? '';
    return (a + b).toUpperCase();
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
    if (e === 'ASIGNADO' || e === 'ACEPTADO') return 'success';
    if (e === 'LIBERADO' || e === 'POSTULADO') return 'info';
    if (e === 'BAJA' || e === 'RECHAZADO') return 'danger';
    return 'secondary';
});

const asignacionLabel = computed(() => {
    const e = detalle.value?.asignacion_estado;
    if (!e || e === 'SIN_ASIGNAR') return 'Sin asignar';
    const map = { ASIGNADO: 'Asignado', LIBERADO: 'Liberado', BAJA: 'Baja', ACEPTADO: 'Aceptado', POSTULADO: 'Postulado', RECHAZADO: 'Rechazado' };
    return map[e] ?? (e.charAt(0) + e.slice(1).toLowerCase());
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
    const currentPeriodoId = detalle.value?.periodo?.id_periodo ?? null;
    return (vacantes.value ?? [])
        .filter((v) =>
            v?.activa === true &&
            Number(v?.cupo_disponible ?? 0) > 0 &&
            v?.id_categoria !== currentId &&
            (!currentPeriodoId || v?.periodo?.id_periodo === currentPeriodoId)
        )
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
<div class="detalle-root">
    <!-- LOADING -->
    <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner loading-spinner"></i>
        <span>Cargando información del alumno…</span>
    </div>

    <div v-else-if="detalle" class="page-container">

        <!-- ========================= -->
        <!-- PROFILE HERO              -->
        <!-- ========================= -->
        <div class="profile-hero">
            <div class="hero-inner">
                <div class="hero-left">
                    <Button
                        icon="pi pi-arrow-left"
                        text rounded
                        @click="goBack"
                        class="back-btn"
                        v-tooltip.right="'Volver al listado'"
                    />
                    <div class="hero-avatar">{{ alumnoInitials }}</div>
                    <div class="hero-text">
                        <div class="hero-name-row">
                            <h1 class="hero-name">{{ alumnoInfo.nombre }}</h1>
                            <Tag :value="alumnoInfo.estado" :severity="estadoSeverity" class="hero-tag" />
                        </div>
                        <div class="hero-meta">
                            <span class="meta-item">
                                <i class="pi pi-id-card"></i>
                                {{ alumnoInfo.matricula }}
                            </span>
                            <span class="meta-sep">·</span>
                            <span class="meta-item">
                                <i class="pi pi-book"></i>
                                {{ alumnoInfo.carrera !== '-' ? alumnoInfo.carrera : 'Sin carrera' }}
                            </span>
                            <span class="meta-sep">·</span>
                            <span class="meta-item">
                                <i class="pi pi-calendar"></i>
                                {{ detalle.periodo?.nombre ?? 'Sin período' }}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="hero-actions" v-if="canAcciones">
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
        </div>

        <!-- ========================= -->
        <!-- INFO CARDS ROW            -->
        <!-- ========================= -->
        <div class="info-row">

            <!-- Datos del Alumno -->
            <div class="info-card card-blue">
                <div class="card-hdr">
                    <span class="card-icon blue"><i class="pi pi-graduation-cap"></i></span>
                    <span class="card-title">Datos del Alumno</span>
                </div>
                <div class="card-fields">
                    <div class="field-row">
                        <span class="fl">Nombre</span>
                        <span class="fv">{{ alumnoInfo.nombre }}</span>
                    </div>
                    <div class="field-row">
                        <span class="fl">Matrícula</span>
                        <span class="fv mono">{{ alumnoInfo.matricula }}</span>
                    </div>
                    <div class="field-row">
                        <span class="fl">Correo</span>
                        <span class="fv fv-email">{{ alumnoInfo.correo }}</span>
                    </div>
                    <div class="field-row">
                        <span class="fl">Carrera</span>
                        <span class="fv">{{ alumnoInfo.carrera }}</span>
                    </div>
                    <div class="field-row">
                        <span class="fl">Semestre</span>
                        <span class="fv">{{ alumnoInfo.cuatrimestre }}</span>
                    </div>
                    <div class="field-row field-row--last">
                        <span class="fl">Estado</span>
                        <Tag :value="alumnoInfo.estado" :severity="estadoSeverity" />
                    </div>
                </div>
            </div>

            <!-- Asignación de Prácticas -->
            <div class="info-card card-green">
                <div class="card-hdr">
                    <span class="card-icon green"><i class="pi pi-briefcase"></i></span>
                    <span class="card-title">Asignación de Prácticas</span>
                </div>
                <div class="card-fields">
                    <div class="field-row">
                        <span class="fl">Empresa</span>
                        <span class="fv fv-company">{{ detalle.empresa?.nombre ?? '-' }}</span>
                    </div>
                    <div class="field-row">
                        <span class="fl">Vacante</span>
                        <span class="fv">{{ detalle.vacante?.nombre ?? '-' }}</span>
                    </div>
                    <div class="field-row">
                        <span class="fl">Período</span>
                        <span class="fv">{{ detalle.periodo?.nombre ?? '-' }}</span>
                    </div>
                    <div class="field-row" :class="{ 'field-row--last': !detalle.asignacion_tipo }">
                        <span class="fl">Estado</span>
                        <Tag :value="asignacionLabel" :severity="asignacionSeverity" />
                    </div>
                    <div class="field-row field-row--last" v-if="detalle.asignacion_tipo">
                        <span class="fl">Tipo</span>
                        <Tag
                            :value="detalle.asignacion_tipo === 'automatica' ? 'Automática' : 'Por postulación'"
                            :severity="detalle.asignacion_tipo === 'automatica' ? 'warning' : 'info'"
                        />
                    </div>
                </div>
            </div>

            <!-- Progreso -->
            <div class="info-card card-amber">
                <div class="card-hdr">
                    <span class="card-icon amber"><i class="pi pi-chart-bar"></i></span>
                    <span class="card-title">Progreso de Entregables</span>
                </div>
                <div class="progress-body">
                    <div class="donut-wrap">
                        <svg class="donut-svg" viewBox="0 0 100 100" aria-hidden="true">
                            <circle cx="50" cy="50" r="38" fill="none" stroke="var(--p-surface-200, #e5e7eb)" stroke-width="10"/>
                            <circle
                                cx="50" cy="50" r="38"
                                fill="none"
                                :stroke="progressPct === 100 ? 'var(--sisa-icon-green, #16a34a)' : progressPct > 0 ? 'var(--sisa-icon-blue, #1565C0)' : 'transparent'"
                                stroke-width="10"
                                stroke-linecap="round"
                                stroke-dasharray="238.76"
                                :stroke-dashoffset="238.76 * (1 - progressPct / 100)"
                                transform="rotate(-90 50 50)"
                                class="donut-arc"
                            />
                        </svg>
                        <div class="donut-center">
                            <span class="donut-pct">{{ progressPct }}%</span>
                            <span class="donut-lbl">avance</span>
                        </div>
                    </div>

                    <div class="pstats">
                        <div class="pstat">
                            <span class="pstat-num color-green">{{ progresoEntregables.calificados }}</span>
                            <span class="pstat-lbl">Calificados</span>
                        </div>
                        <div class="pstat-div"></div>
                        <div class="pstat">
                            <span class="pstat-num color-amber">{{ progresoEntregables.pendientes }}</span>
                            <span class="pstat-lbl">Pendientes</span>
                        </div>
                        <div class="pstat-div"></div>
                        <div class="pstat">
                            <span class="pstat-num">{{ progresoEntregables.total }}</span>
                            <span class="pstat-lbl">Total</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ========================= -->
        <!-- ENTREGABLES               -->
        <!-- ========================= -->
        <div class="section-card">
            <div class="section-hdr">
                <span class="card-icon blue"><i class="pi pi-file-check"></i></span>
                <span class="section-title">Detalle de Entregables</span>
                <span class="section-count" v-if="detalle.entregables?.length">
                    {{ detalle.entregables.length }} entregable{{ detalle.entregables.length !== 1 ? 's' : '' }}
                </span>
            </div>

            <div v-if="detalle.entregables?.length">
                <div class="ent-table-head">
                    <span>#</span>
                    <span>Nombre</span>
                    <span>Fecha límite</span>
                    <span>Calificación</span>
                </div>
                <div
                    v-for="e in detalle.entregables"
                    :key="e.id_entregable ?? e.numero"
                    class="ent-row"
                    :class="e.calificacion !== null && e.calificacion !== undefined ? 'ent-graded' : 'ent-pending'"
                >
                    <div class="ent-num-col">
                        <span class="num-badge">{{ e.numero }}</span>
                    </div>
                    <div class="ent-name-col">
                        <span class="ent-nombre">{{ e.nombre }}</span>
                    </div>
                    <div class="ent-date-col">
                        <span v-if="e.fecha_limite" class="ent-fecha">
                            <i class="pi pi-calendar"></i>
                            {{ fechaMx(e.fecha_limite) }}
                        </span>
                        <span v-else class="text-muted">—</span>
                    </div>
                    <div class="ent-cal-col">
                        <Tag
                            :value="e.calificacion !== null && e.calificacion !== undefined ? String(e.calificacion) : 'Pendiente'"
                            :severity="calificacionSeverity(e.calificacion)"
                        />
                    </div>
                </div>
            </div>

            <div v-else class="empty-state">
                <i class="pi pi-inbox"></i>
                <span>No hay entregables registrados para este período</span>
            </div>
        </div>

        <!-- ========================= -->
        <!-- ENCUESTAS                 -->
        <!-- ========================= -->
        <div class="section-card">
            <div class="section-hdr">
                <span class="card-icon purple"><i class="pi pi-clipboard"></i></span>
                <span class="section-title">Encuestas de satisfacción</span>
                <div class="section-hdr-right">
                    <Tag
                        v-if="detalle.encuesta_completada"
                        value="Todas completadas"
                        severity="success"
                        icon="pi pi-check"
                    />
                    <Tag
                        v-else
                        value="Pendiente"
                        severity="warn"
                        icon="pi pi-clock"
                    />
                    <Button
                        v-if="encuestaSeleccionada && encuestasData.length > 1"
                        icon="pi pi-arrow-left"
                        label="Ver todas"
                        text
                        size="small"
                        @click="encuestaSeleccionada = null"
                        class="enc-back-btn"
                    />
                </div>
            </div>

            <!-- Loading -->
            <div v-if="loadingEncuestas" class="empty-state">
                <i class="pi pi-spin pi-spinner"></i>
                <span>Cargando respuestas…</span>
            </div>

            <!-- Sin encuestas -->
            <div v-else-if="encuestasData.length === 0" class="empty-state">
                <i class="pi pi-clipboard"></i>
                <span>No hay encuestas activas para este período</span>
            </div>

            <!-- CARDS — solo cuando hay más de 1 y no hay selección -->
            <div v-else-if="encuestasData.length > 1 && !encuestaSeleccionada" class="enc-cards">
                <div
                    v-for="enc in encuestasData"
                    :key="enc.id_encuesta"
                    class="enc-card"
                    :class="{ 'enc-card--done': enc.completada, 'enc-card--pending': !enc.completada }"
                    @click="encuestaSeleccionada = enc"
                >
                    <div class="enc-card-icon">
                        <i :class="enc.completada ? 'pi pi-check-circle' : 'pi pi-clock'"></i>
                    </div>
                    <div class="enc-card-body">
                        <span class="enc-card-nombre">{{ enc.nombre }}</span>
                        <Tag
                            :value="enc.completada ? 'Contestada' : 'Sin contestar'"
                            :severity="enc.completada ? 'success' : 'secondary'"
                            class="enc-card-tag"
                        />
                    </div>
                    <i class="pi pi-chevron-right enc-card-arrow"></i>
                </div>
            </div>

            <!-- RESPUESTAS — 1 sola encuesta o card seleccionada -->
            <template v-else>
                <div
                    v-for="enc in (encuestaSeleccionada ? [encuestaSeleccionada] : encuestasData)"
                    :key="enc.id_encuesta"
                    class="enc-block"
                >
                    <div class="enc-block-hdr">
                        <span class="enc-nombre">{{ enc.nombre }}</span>
                        <Tag
                            :value="enc.completada ? 'Contestada' : 'Sin contestar'"
                            :severity="enc.completada ? 'success' : 'secondary'"
                            :icon="enc.completada ? 'pi pi-check' : 'pi pi-minus'"
                        />
                    </div>

                    <div v-if="enc.completada && enc.preguntas.length" class="enc-respuestas">
                        <div
                            v-for="p in enc.preguntas"
                            :key="p.id_pregunta"
                            class="enc-resp-row"
                        >
                            <span class="enc-resp-q">{{ p.orden }}. {{ p.texto }}</span>
                            <span class="enc-resp-a" :class="{ 'resp-empty': p.respuesta === null }">
                                {{ p.respuesta !== null ? p.respuesta : '—' }}
                            </span>
                        </div>
                    </div>

                    <div v-else-if="!enc.completada" class="enc-pending-msg">
                        <i class="pi pi-clock"></i>
                        El alumno aún no ha contestado esta encuesta
                    </div>
                </div>
            </template>
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
</div>
</template>

<style scoped>
.detalle-root {
    display: contents;
}

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
   PROFILE HERO
================================ */
.profile-hero {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 14px;
    border-left: 4px solid var(--sisa-primary-l, #1565C0);
    padding: 1.25rem 1.5rem;
}

.hero-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}

.hero-left {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.back-btn {
    flex-shrink: 0;
}

.hero-avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.12));
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    font-weight: 700;
    flex-shrink: 0;
    letter-spacing: 0.02em;
    border: 2px solid var(--sisa-primary-l, #1565C0);
}

.hero-text {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

.hero-name-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
}

.hero-name {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0;
    line-height: 1.2;
}

.hero-tag {
    font-size: 0.72rem;
}

.hero-meta {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
}

.meta-item .pi {
    font-size: 0.72rem;
    opacity: 0.65;
}

.meta-sep {
    color: var(--p-text-muted-color);
    opacity: 0.4;
    font-size: 0.75rem;
}

.hero-actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
    flex-shrink: 0;
}

/* ================================
   INFO CARDS ROW
================================ */
.info-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
}

.info-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.card-blue  { border-top: 3px solid var(--sisa-primary-l, #1565C0); }
.card-green { border-top: 3px solid #16a34a; }
.card-amber { border-top: 3px solid #d97706; }

/* ================================
   CARD HEADER
================================ */
.card-hdr {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--p-content-border-color);
}

.card-icon {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    flex-shrink: 0;
}

.card-icon.blue {
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.12));
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
}

.card-icon.green {
    background: rgba(22, 163, 74, 0.1);
    color: #16a34a;
}

.card-icon.amber {
    background: rgba(217, 119, 6, 0.1);
    color: #d97706;
}

.card-icon.purple {
    background: rgba(124, 58, 237, 0.1);
    color: #7c3aed;
}

/* ================================
   ENCUESTAS SECTION
================================ */
.section-hdr-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
}

.enc-back-btn {
    font-size: 0.78rem;
}

.enc-cards {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
}

.enc-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 1rem;
    border: 1px solid var(--p-content-border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}
.enc-card:hover {
    background: var(--p-content-hover-background);
    border-color: var(--p-primary-color);
}
.enc-card--done .enc-card-icon { color: #16a34a; }
.enc-card--pending .enc-card-icon { color: #d97706; }
.enc-card-icon { font-size: 1.2rem; flex-shrink: 0; }
.enc-card-body {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}
.enc-card-nombre {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--p-text-color);
}
.enc-card-arrow {
    color: var(--p-text-muted-color, #9ca3af);
    font-size: 0.75rem;
}

.enc-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem 1rem 1rem;
}

.enc-block {
    border: 1px solid var(--p-content-border-color);
    border-radius: 8px;
    overflow: hidden;
}

.enc-block-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.9rem;
    background: var(--p-content-hover-background);
    border-bottom: 1px solid var(--p-content-border-color);
    gap: 0.5rem;
}

.enc-nombre {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.enc-respuestas {
    display: flex;
    flex-direction: column;
    gap: 0;
}

.enc-resp-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    padding: 0.45rem 0.9rem;
    border-bottom: 1px solid var(--p-content-border-color);
    align-items: baseline;
}
.enc-resp-row:last-child { border-bottom: none; }

.enc-resp-q {
    font-size: 0.8rem;
    color: var(--p-text-muted-color, #6b7280);
}

.enc-resp-a {
    font-size: 0.82rem;
    font-weight: 500;
    color: var(--p-text-color);
}

.enc-resp-a.resp-empty {
    color: var(--p-text-muted-color, #9ca3af);
    font-style: italic;
}

.enc-pending-msg {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.9rem;
    font-size: 0.82rem;
    color: var(--p-text-muted-color, #9ca3af);
    font-style: italic;
}

.card-title {
    font-size: 0.83rem;
    font-weight: 600;
    color: var(--p-text-color);
}

/* ================================
   CARD FIELDS
================================ */
.card-fields {
    padding: 0.5rem 1rem 0.75rem;
    display: flex;
    flex-direction: column;
}

.field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--p-content-border-color);
}

.field-row--last,
.field-row:last-child {
    border-bottom: none;
}

.fl {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--p-text-muted-color);
    flex-shrink: 0;
    min-width: 64px;
}

.fv {
    font-size: 0.85rem;
    color: var(--p-text-color);
    font-weight: 500;
    text-align: right;
    word-break: break-all;
    min-width: 0;
}

.fv.mono {
    font-family: monospace;
    font-size: 0.83rem;
    letter-spacing: 0.05em;
}

.fv.fv-email {
    font-size: 0.78rem;
}

.fv.fv-company {
    font-weight: 700;
}

/* ================================
   PROGRESS CARD (DONUT)
================================ */
.progress-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.25rem 1rem 1.5rem;
    gap: 1rem;
}

.donut-wrap {
    position: relative;
    width: 120px;
    height: 120px;
    flex-shrink: 0;
}

.donut-svg {
    width: 100%;
    height: 100%;
}

.donut-arc {
    transition: stroke-dashoffset 0.5s ease;
}

.donut-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
}

.donut-pct {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--p-text-color);
    line-height: 1;
}

.donut-lbl {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--p-text-muted-color);
}

.pstats {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    justify-content: center;
}

.pstat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
}

.pstat-num {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--p-text-color);
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

.pstat-num.color-green { color: #16a34a; }
.pstat-num.color-amber { color: #d97706; }

.pstat-lbl {
    font-size: 0.67rem;
    color: var(--p-text-muted-color);
    font-weight: 500;
    white-space: nowrap;
}

.pstat-div {
    width: 1px;
    height: 36px;
    background: var(--p-content-border-color);
    flex-shrink: 0;
}

/* ================================
   SECTION CARD (ENTREGABLES)
================================ */
.section-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 12px;
    overflow: hidden;
}

.section-hdr {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--p-content-border-color);
}

.section-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--p-text-color);
    flex: 1;
}

.section-count {
    font-size: 0.73rem;
    color: var(--p-text-muted-color);
    background: var(--p-content-hover-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 20px;
    padding: 0.15rem 0.65rem;
    font-weight: 500;
}

/* ================================
   ENTREGABLES TABLE
================================ */
.ent-table-head {
    display: grid;
    grid-template-columns: 52px 1fr 150px 130px;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: var(--p-content-hover-background);
    border-bottom: 1px solid var(--p-content-border-color);
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--p-text-muted-color);
}

.ent-row {
    display: grid;
    grid-template-columns: 52px 1fr 150px 130px;
    gap: 0.75rem;
    align-items: center;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid var(--p-content-border-color);
    border-left: 3px solid transparent;
    transition: background 0.12s;
}

.ent-row:last-child {
    border-bottom: none;
}

.ent-row:hover {
    background: var(--p-content-hover-background);
}

.ent-graded {
    border-left-color: #16a34a;
}

.ent-pending {
    border-left-color: #d97706;
}

.ent-num-col {
    display: flex;
    align-items: center;
    justify-content: center;
}

.num-badge {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--p-content-hover-background);
    border: 1px solid var(--p-content-border-color);
    color: var(--p-text-muted-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 700;
}

.ent-name-col {
    min-width: 0;
}

.ent-nombre {
    font-size: 0.87rem;
    font-weight: 600;
    color: var(--p-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
}

.ent-date-col {
    font-size: 0.78rem;
    color: var(--p-text-muted-color);
}

.ent-fecha {
    display: flex;
    align-items: center;
    gap: 0.3rem;
}

.ent-fecha .pi {
    font-size: 0.7rem;
    opacity: 0.65;
}

.text-muted {
    color: var(--p-text-muted-color);
    opacity: 0.4;
}

.ent-cal-col {
    display: flex;
    align-items: center;
}

/* ================================
   EMPTY STATE
================================ */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 3rem 1rem;
    color: var(--p-text-muted-color);
    font-size: 0.88rem;
}

.empty-state .pi {
    font-size: 2.2rem;
    opacity: 0.3;
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
    color: #d97706;
}

.dialog-warning-box {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    background: rgba(220, 38, 38, 0.08);
    color: #dc2626;
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
    .info-row {
        grid-template-columns: repeat(2, 1fr);
    }

    .ent-table-head,
    .ent-row {
        grid-template-columns: 44px 1fr 130px 110px;
    }
}

@media (max-width: 640px) {
    .hero-inner {
        flex-direction: column;
        align-items: flex-start;
    }

    .hero-actions {
        width: 100%;
    }

    .info-row {
        grid-template-columns: 1fr;
    }

    .ent-table-head {
        display: none;
    }

    .ent-row {
        grid-template-columns: 40px 1fr auto;
        grid-template-rows: auto auto;
    }

    .ent-date-col {
        grid-column: 2;
        font-size: 0.72rem;
    }

    .ent-cal-col {
        grid-column: 3;
        grid-row: 1;
    }
}
</style>
