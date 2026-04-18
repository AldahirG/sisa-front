<script setup>
import api from '@/api/axios';
import { computed, onActivated, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const toast  = useToast();

// ════════════════════════════════
// STATE
// ════════════════════════════════
const loading = ref(true);
const error   = ref(false);
const dash    = ref(null);

const encuestasKpis    = ref(null);
const loadingEncKpis   = ref(false);

const loadEncuestasKpis = async (periodoId) => {
    if (!periodoId) return;
    loadingEncKpis.value = true;
    try {
        const { data } = await api.get(`/dashboard/kpis/encuestas?periodoId=${periodoId}`);
        encuestasKpis.value = data;
    } catch {
        // sección oculta si falla
    } finally {
        loadingEncKpis.value = false;
    }
};

// ════════════════════════════════
// LOAD
// ════════════════════════════════
const loadDashboard = async () => {
    loading.value = true;
    error.value   = false;
    try {
        const { data } = await api.get('/dashboard/admin');
        dash.value = data;
        const pid = data?.periodo_activo?.id_periodo;
        if (pid) loadEncuestasKpis(pid);
    } catch {
        error.value = true;
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar la información del dashboard.',
            life: 5000
        });
    } finally {
        loading.value = false;
    }
};

onMounted(loadDashboard);
onActivated(loadDashboard);

const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') loadDashboard();
};
onMounted(()    => document.addEventListener('visibilitychange', onVisibilityChange));
onUnmounted(() => document.removeEventListener('visibilitychange', onVisibilityChange));

// ════════════════════════════════
// COMPUTED — derivados seguros
// ════════════════════════════════
const periodo     = computed(() => dash.value?.periodo_activo ?? null);
const alumnos     = computed(() => dash.value?.alumnos     ?? { total: 0, asignados: 0, sin_asignar: 0, liberados: 0 });
const empresas    = computed(() => dash.value?.empresas    ?? { total: 0 });
const vacantes    = computed(() => dash.value?.vacantes    ?? { total: 0, cupo_total: 0, cupo_disponible: 0 });
const postulaciones = computed(() => dash.value?.postulaciones ?? { total: 0, postuladas: 0, aceptadas: 0, rechazadas: 0, canceladas: 0 });
const entregables = computed(() => dash.value?.entregables ?? { total_definidos: 0, total_enviados: 0, evaluados: 0, pendientes_evaluacion: 0 });
const encuestas   = computed(() => dash.value?.encuestas   ?? { completadas: 0, pendientes: 0 });

/** Total de alumnos activos = asignados en el periodo */
const alumnosActivos = computed(() => alumnos.value.asignados ?? 0);

/** Pct de encuestas respondidas */
const encuestasTotal = computed(() => (encuestas.value.completadas ?? 0) + (encuestas.value.pendientes ?? 0));
const encuestaPct = computed(() => {
    if (!encuestasTotal.value) return 0;
    return Math.round((encuestas.value.completadas / encuestasTotal.value) * 100);
});

/** Total de postulaciones para calcular pcts */
const totalPostulaciones = computed(() =>
    (postulaciones.value.postuladas ?? 0) +
    (postulaciones.value.aceptadas  ?? 0) +
    (postulaciones.value.rechazadas ?? 0) +
    (postulaciones.value.canceladas ?? 0)
);

/** Pct aceptados sobre total */
const aceptadoPct = computed(() => {
    if (!totalPostulaciones.value) return 0;
    return Math.round((postulaciones.value.aceptadas / totalPostulaciones.value) * 100);
});

/** Total entregables para la barra */
const totalEntregables = computed(() =>
    (entregables.value.evaluados ?? 0) + (entregables.value.pendientes_evaluacion ?? 0)
);

const entregablesPct = computed(() => {
    if (!totalEntregables.value) return 0;
    return Math.round((entregables.value.evaluados / totalEntregables.value) * 100);
});

// ════════════════════════════════
// COMPUTED — encuestas KPIs
// ════════════════════════════════
const ekParticipacion = computed(() => encuestasKpis.value?.participacion ?? null);
const ekCalificacion  = computed(() => encuestasKpis.value?.calificacion_empresas ?? null);
const ekExperiencia   = computed(() => encuestasKpis.value?.experiencia ?? null);
const ekApoyo         = computed(() => encuestasKpis.value?.apoyo_economico ?? null);
const ekServicio      = computed(() => encuestasKpis.value?.servicio_enlace_profesional ?? null);
const ekDificultades  = computed(() => encuestasKpis.value?.dificultades_vinculacion ?? null);
const ekPendientes    = computed(() => encuestasKpis.value?.pendientes_de_responder ?? []);
const ekProyectos     = computed(() => encuestasKpis.value?.proyectos ?? null);

const participacionPct = computed(() => {
    const p = ekParticipacion.value;
    if (!p?.total_asignados) return 0;
    return Math.round((p.respondieron / p.total_asignados) * 100);
});

const formatYesNo = (obj) => {
    if (!obj) return { si: 0, no: 0, pct: 0 };
    const si  = obj['Sí'] ?? obj['si'] ?? 0;
    const no  = obj['No'] ?? obj['no'] ?? 0;
    const tot = si + no;
    return { si, no, pct: tot ? Math.round((si / tot) * 100) : 0 };
};

/** Formatear fecha */
const formatDate = (fechaStr) => {
    if (!fechaStr) return '—';
    return new Date(fechaStr).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
};
</script>

<template>
    <div class="admin-dashboard">
        <Toast />

        <!-- ════════════════════════════════
             LOADING
        ════════════════════════════════ -->
        <div v-if="loading" class="dash-loading">
            <i class="pi pi-spin pi-spinner dash-spinner"></i>
            <span>Cargando dashboard…</span>
        </div>

        <!-- ════════════════════════════════
             ERROR
        ════════════════════════════════ -->
        <div v-else-if="error" class="status-banner banner-danger">
            <div class="banner-icon-wrap icon-danger"><i class="pi pi-exclamation-triangle"></i></div>
            <div>
                <p class="banner-title">No se pudo cargar el dashboard</p>
                <p class="banner-desc">Revisa tu conexión o intenta de nuevo.</p>
            </div>
            <Button label="Reintentar" icon="pi pi-refresh" size="small" severity="secondary" @click="loadDashboard" />
        </div>

        <template v-else>

            <!-- ════════════════════════════════
                 HEADER + PERIODO
            ════════════════════════════════ -->
            <div class="dash-header">
                <div>
                    <h1 class="dash-title">Panel de administración</h1>
                    <p class="dash-subtitle">Resumen general del periodo de prácticas profesionales.</p>
                </div>

                <!-- Badge de periodo -->
                <div v-if="periodo" class="periodo-badge">
                    <div class="periodo-dot"></div>
                    <div>
                        <p class="periodo-name">{{ periodo.nombre }}</p>
                        <p class="periodo-dates">
                            {{ formatDate(periodo.fecha_inicio) }} — {{ formatDate(periodo.fecha_fin) }}
                        </p>
                    </div>
                </div>
                <div v-else class="periodo-badge periodo-inactive">
                    <i class="pi pi-exclamation-circle" style="color: var(--sisa-icon-amber)"></i>
                    <p class="periodo-name" style="color: var(--text-color-secondary)">Sin periodo activo</p>
                </div>
            </div>

            <!-- ════════════════════════════════
                 KPI ROW — 4 métricas principales
            ════════════════════════════════ -->
            <div class="kpi-row">
                <!-- Alumnos -->
                <div class="kpi-card kpi-accent">
                    <div class="kpi-inner">
                        <span class="kpi-label">Alumnos activos</span>
                        <div class="kpi-icon-wrap kpi-icon-blue">
                            <i class="pi pi-users"></i>
                        </div>
                    </div>
                    <div class="kpi-value">{{ alumnosActivos }}</div>
                    <span class="kpi-hint">{{ alumnos.liberados ?? 0 }} liberados · {{ alumnos.sin_asignar ?? 0 }} sin asignar</span>
                </div>

                <!-- Empresas -->
                <div class="kpi-card">
                    <div class="kpi-inner">
                        <span class="kpi-label">Empresas registradas</span>
                        <div class="kpi-icon-wrap kpi-icon-amber">
                            <i class="pi pi-building"></i>
                        </div>
                    </div>
                    <div class="kpi-value">{{ empresas.total }}</div>
                    <span class="kpi-hint">
                        {{ vacantes.cupo_disponible }} lugar{{ vacantes.cupo_disponible !== 1 ? 'es' : '' }} disponible{{ vacantes.cupo_disponible !== 1 ? 's' : '' }}
                    </span>
                </div>

                <!-- Postulaciones aceptadas -->
                <div class="kpi-card">
                    <div class="kpi-inner">
                        <span class="kpi-label">Postulaciones aceptadas</span>
                        <div class="kpi-icon-wrap kpi-icon-green">
                            <i class="pi pi-check-circle"></i>
                        </div>
                    </div>
                    <div class="kpi-value">
                        {{ postulaciones.aceptadas }}
                        <span class="kpi-total">/ {{ totalPostulaciones }}</span>
                    </div>
                    <ProgressBar :value="aceptadoPct" class="kpi-progress" :showValue="false" />
                </div>

                <!-- Encuestas -->
                <div class="kpi-card">
                    <div class="kpi-inner">
                        <span class="kpi-label">Encuestas respondidas</span>
                        <div class="kpi-icon-wrap kpi-icon-purple">
                            <i class="pi pi-comment"></i>
                        </div>
                    </div>
                    <div class="kpi-value">
                        {{ encuestaPct }}<span class="kpi-percent">%</span>
                    </div>
                    <span class="kpi-hint">{{ encuestas.completadas }} de {{ encuestasTotal }} alumnos</span>
                </div>
            </div>

            <!-- ════════════════════════════════
                 FILA SECUNDARIA
            ════════════════════════════════ -->
            <div class="mid-row">

                <!-- Estado general -->
                <div class="section-card flex-2">
                    <div class="section-card-header">
                        <i class="pi pi-chart-bar section-icon"></i>
                        <span class="section-title">Estado general del periodo</span>
                    </div>

                    <!-- Postulaciones breakdown -->
                    <p class="subsection-label">Postulaciones</p>
                    <div class="stat-row-list">
                        <div class="stat-row">
                            <span class="stat-label"><span class="stat-dot dot-blue"></span>En revisión</span>
                            <span class="stat-val">{{ postulaciones.postuladas }}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label"><span class="stat-dot dot-green"></span>Aceptadas</span>
                            <span class="stat-val">{{ postulaciones.aceptadas }}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label"><span class="stat-dot dot-red"></span>Rechazadas</span>
                            <span class="stat-val">{{ postulaciones.rechazadas }}</span>
                        </div>
                    </div>

                    <div class="section-divider"></div>

                    <!-- Entregables breakdown -->
                    <p class="subsection-label">Entregables</p>
                    <div class="stat-row-list">
                        <div class="stat-row">
                            <span class="stat-label"><span class="stat-dot dot-green"></span>Evaluados</span>
                            <span class="stat-val">{{ entregables.evaluados }}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label"><span class="stat-dot dot-amber"></span>Pendientes de evaluación</span>
                            <span class="stat-val">{{ entregables.pendientes_evaluacion }}</span>
                        </div>
                    </div>
                    <ProgressBar :value="entregablesPct" class="section-progress mt-2" :showValue="false" />
                    <p class="progress-hint">{{ entregablesPct }}% de entregables evaluados</p>
                </div>

                <!-- Acciones rápidas -->
                <div class="section-card flex-1">
                    <div class="section-card-header">
                        <i class="pi pi-bolt section-icon"></i>
                        <span class="section-title">Acciones rápidas</span>
                    </div>
                    <div class="quick-actions">
                        <button class="action-item" @click="router.push('/admin/periodos')">
                            <div class="action-icon-wrap action-blue">
                                <i class="pi pi-calendar-plus"></i>
                            </div>
                            <div>
                                <p class="action-label">Gestionar periodos</p>
                                <p class="action-sub">Crear o editar periodos académicos</p>
                            </div>
                            <i class="pi pi-chevron-right action-arrow"></i>
                        </button>

                        <button class="action-item" @click="router.push('/admin/postulaciones')">
                            <div class="action-icon-wrap action-green">
                                <i class="pi pi-send"></i>
                            </div>
                            <div>
                                <p class="action-label">Revisar postulaciones</p>
                                <p class="action-sub">{{ postulaciones.postuladas }} en espera de revisión</p>
                            </div>
                            <i class="pi pi-chevron-right action-arrow"></i>
                        </button>

                        <button class="action-item" @click="router.push('/admin/entregables')">
                            <div class="action-icon-wrap action-amber">
                                <i class="pi pi-file-check"></i>
                            </div>
                            <div>
                                <p class="action-label">Evaluar entregables</p>
                                <p class="action-sub">{{ entregables.pendientes_evaluacion }} pendientes de evaluación</p>
                            </div>
                            <i class="pi pi-chevron-right action-arrow"></i>
                        </button>

                        <button class="action-item" @click="router.push('/admin/historial')">
                            <div class="action-icon-wrap action-purple">
                                <i class="pi pi-graduation-cap"></i>
                            </div>
                            <div>
                                <p class="action-label">Liberar alumnos</p>
                                <p class="action-sub">Gestionar liberaciones del periodo</p>
                            </div>
                            <i class="pi pi-chevron-right action-arrow"></i>
                        </button>

                        <button class="action-item" @click="router.push('/admin/empresas')">
                            <div class="action-icon-wrap action-blue">
                                <i class="pi pi-building"></i>
                            </div>
                            <div>
                                <p class="action-label">Gestionar empresas</p>
                                <p class="action-sub">Registrar nuevas empresas y vacantes</p>
                            </div>
                            <i class="pi pi-chevron-right action-arrow"></i>
                        </button>

                        <button class="action-item" @click="router.push('/admin/encuestas')">
                            <div class="action-icon-wrap action-purple">
                                <i class="pi pi-comment"></i>
                            </div>
                            <div>
                                <p class="action-label">Ver encuestas</p>
                                <p class="action-sub">Gestionar encuestas y ver respuestas</p>
                            </div>
                            <i class="pi pi-chevron-right action-arrow"></i>
                        </button>
                    </div>
                </div>

            </div>

            <!-- ════════════════════════════════
                 ENCUESTAS KPIs
            ════════════════════════════════ -->
            <div class="section-card enc-kpis-section" v-if="encuestasKpis || loadingEncKpis">
                <div class="section-card-header">
                    <i class="pi pi-chart-pie section-icon"></i>
                    <span class="section-title">Satisfacción de alumnos — encuesta del periodo</span>
                    <Button
                        label="Ver encuestas completas"
                        icon="pi pi-external-link"
                        size="small"
                        text
                        severity="secondary"
                        class="ml-auto"
                        @click="router.push('/admin/encuestas')"
                    />
                </div>

                <div v-if="loadingEncKpis" class="enc-kpis-loading">
                    <i class="pi pi-spin pi-spinner"></i>
                    <span>Cargando KPIs de satisfacción…</span>
                </div>

                <template v-else-if="encuestasKpis">
                    <!-- Fila 1: Participación + Calificación empresa + Proyectos -->
                    <div class="enc-kpi-grid">
                        <!-- Participación -->
                        <div class="enc-kpi-card" v-if="ekParticipacion">
                            <div class="enc-kpi-header">
                                <div class="enc-kpi-icon-wrap enc-kpi-blue"><i class="pi pi-users"></i></div>
                                <span class="enc-kpi-label">Participación</span>
                            </div>
                            <div class="enc-kpi-value">{{ ekParticipacion.respondieron }}<span class="enc-kpi-of"> / {{ ekParticipacion.total_asignados }}</span></div>
                            <ProgressBar :value="participacionPct" class="enc-kpi-bar" :showValue="false" />
                            <span class="enc-kpi-hint">{{ participacionPct }}% completado · {{ ekParticipacion.pendientes }} pendiente(s)</span>
                        </div>

                        <!-- Calificación promedio -->
                        <div class="enc-kpi-card" v-if="ekCalificacion">
                            <div class="enc-kpi-header">
                                <div class="enc-kpi-icon-wrap enc-kpi-amber"><i class="pi pi-star"></i></div>
                                <span class="enc-kpi-label">Calificación empresas</span>
                            </div>
                            <div class="enc-kpi-value">{{ ekCalificacion.promedio_general?.toFixed(1) ?? '—' }}<span class="enc-kpi-of"> / 5</span></div>
                            <div class="enc-kpi-sub-rows">
                                <span class="enc-kpi-hint enc-kpi-green">
                                    <i class="pi pi-arrow-up"></i> {{ ekCalificacion.mejor_evaluada?.nombre }} ({{ ekCalificacion.mejor_evaluada?.promedio_calificacion?.toFixed(1) }})
                                </span>
                                <span class="enc-kpi-hint enc-kpi-red">
                                    <i class="pi pi-arrow-down"></i> {{ ekCalificacion.peor_evaluada?.nombre }} ({{ ekCalificacion.peor_evaluada?.promedio_calificacion?.toFixed(1) }})
                                </span>
                            </div>
                        </div>

                        <!-- Apoyo económico -->
                        <div class="enc-kpi-card" v-if="ekApoyo">
                            <div class="enc-kpi-header">
                                <div class="enc-kpi-icon-wrap enc-kpi-green"><i class="pi pi-wallet"></i></div>
                                <span class="enc-kpi-label">Apoyo económico</span>
                            </div>
                            <div class="enc-kpi-value">{{ ekApoyo.total_con_apoyo }}<span class="enc-kpi-of"> alumnos</span></div>
                            <span class="enc-kpi-hint">{{ ekApoyo.total_sin_apoyo }} sin apoyo · {{ ekApoyo.total_empresas_con_apoyo }} empresa(s)</span>
                            <div class="enc-kpi-chips" v-if="ekApoyo.distribucion_montos">
                                <span
                                    v-for="(qty, monto) in ekApoyo.distribucion_montos"
                                    :key="monto"
                                    class="enc-chip enc-chip-green"
                                >{{ monto }}: {{ qty }}</span>
                            </div>
                        </div>

                        <!-- Proyectos -->
                        <div class="enc-kpi-card" v-if="ekProyectos">
                            <div class="enc-kpi-header">
                                <div class="enc-kpi-icon-wrap enc-kpi-purple"><i class="pi pi-code"></i></div>
                                <span class="enc-kpi-label">Proyectos asignados</span>
                            </div>
                            <div class="enc-kpi-value">{{ ekProyectos.alumnos_con_proyecto }}<span class="enc-kpi-of"> alumnos</span></div>
                            <span class="enc-kpi-hint">{{ ekProyectos.proyectos_empleados_en_empresa }} empleados en empresa · {{ ekProyectos.alumnos_sin_proyecto }} sin proyecto</span>
                        </div>
                    </div>

                    <!-- Fila 2: Experiencia + Servicio + Dificultades -->
                    <div class="enc-exp-row">

                        <!-- Experiencia -->
                        <div class="enc-exp-card flex-2" v-if="ekExperiencia">
                            <p class="subsection-label">Experiencia del alumno</p>
                            <div class="stat-row-list">
                                <div class="stat-row" v-for="(cfg, key) in [
                                    { label: 'Se sintió cómodo',       data: formatYesNo(ekExperiencia.se_sintio_comodo) },
                                    { label: 'Le gustaría regresar',   data: formatYesNo(ekExperiencia.le_gustaria_regresar) },
                                    { label: 'Recomendaría empresa',   data: formatYesNo(ekExperiencia.recomendaria_empresa) },
                                ]" :key="key">
                                    <span class="stat-label">{{ cfg.label }}</span>
                                    <div class="stat-yesno">
                                        <span class="yesno-si">Sí {{ cfg.data.si }}</span>
                                        <span class="yesno-bar">
                                            <span class="yesno-fill" :style="{ width: cfg.data.pct + '%' }"></span>
                                        </span>
                                        <span class="yesno-no">No {{ cfg.data.no }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Servicio DEP + Dificultades -->
                        <div class="enc-exp-card flex-1">
                            <template v-if="ekServicio">
                                <p class="subsection-label">Servicio Enlace Profesional</p>
                                <div class="enc-kpi-chips" style="margin-bottom: 1rem;">
                                    <span v-for="(qty, nivel) in ekServicio" :key="nivel"
                                        class="enc-chip"
                                        :class="nivel === 'Excelente' ? 'enc-chip-green' : nivel === 'Bueno' ? 'enc-chip-blue' : 'enc-chip-amber'"
                                    >{{ nivel }}: {{ qty }}</span>
                                </div>
                            </template>
                            <template v-if="ekDificultades">
                                <p class="subsection-label">Dificultades de vinculación</p>
                                <div class="stat-row">
                                    <span class="stat-label">
                                        <span class="stat-dot dot-red"></span>Con dificultades
                                    </span>
                                    <span class="stat-val">{{ ekDificultades.si ?? ekDificultades['Sí'] ?? 0 }}</span>
                                </div>
                                <div class="stat-row" style="margin-top: 0.375rem;">
                                    <span class="stat-label">
                                        <span class="stat-dot dot-green"></span>Sin dificultades
                                    </span>
                                    <span class="stat-val">{{ ekDificultades.no ?? ekDificultades['No'] ?? 0 }}</span>
                                </div>
                            </template>
                        </div>

                        <!-- Pendientes de responder -->
                        <div class="enc-exp-card flex-1" v-if="ekPendientes.length">
                            <p class="subsection-label">Pendientes de responder ({{ ekPendientes.length }})</p>
                            <div class="pendientes-list">
                                <div v-for="p in ekPendientes.slice(0, 5)" :key="p.matricula" class="pendiente-row">
                                    <div class="pendiente-avatar">{{ p.nombre?.charAt(0) ?? '?' }}</div>
                                    <div>
                                        <p class="pendiente-name">{{ p.nombre }}</p>
                                        <p class="pendiente-meta">{{ p.matricula }} · {{ p.empresa }}</p>
                                    </div>
                                </div>
                                <p v-if="ekPendientes.length > 5" class="pendiente-more">
                                    +{{ ekPendientes.length - 5 }} más
                                </p>
                            </div>
                        </div>
                    </div>

                </template>
            </div>

        </template>
    </div>
</template>

<style scoped>
/* ════════════════════════════════════════
   LAYOUT
════════════════════════════════════════ */
.admin-dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-bottom: 1rem;
}

/* ════════════════════════════════════════
   LOADING / ERROR
════════════════════════════════════════ */
.dash-loading {
    display: flex; flex-direction: column; align-items: center;
    gap: 0.75rem; padding: 5rem 0;
    color: var(--text-color-secondary); font-size: 0.875rem;
}
.dash-spinner { font-size: 2rem; color: var(--sisa-primary-l); }

.status-banner {
    display: flex; align-items: center; gap: 1rem;
    padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid;
}
.banner-danger  { background: var(--sisa-banner-danger-bg); border-color: var(--sisa-banner-danger-bd); }
.banner-icon-wrap {
    flex-shrink: 0; width: 2.25rem; height: 2.25rem; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; font-size: 1rem;
}
.icon-danger { background: var(--sisa-tint-red); color: var(--sisa-icon-red); }
.banner-title { font-weight: 700; font-size: 0.9rem; color: var(--text-color); margin: 0 0 0.2rem; }
.banner-desc  { font-size: 0.825rem; color: var(--text-color-secondary); margin: 0; }

/* ════════════════════════════════════════
   HEADER
════════════════════════════════════════ */
.dash-header {
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 1rem; flex-wrap: wrap;
}
.dash-title {
    font-size: 1.4rem; font-weight: 700;
    color: var(--text-color); margin: 0 0 0.25rem;
}
.dash-subtitle { font-size: 0.875rem; color: var(--text-color-secondary); margin: 0; }

/* Periodo badge */
.periodo-badge {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.625rem 1rem; background: var(--sisa-accent-surface);
    border: 1px solid rgba(21,101,192,.25); border-radius: 10px;
    flex-shrink: 0;
}
.periodo-inactive {
    background: var(--sisa-banner-warn-bg);
    border-color: var(--sisa-banner-warn-bd);
}
.periodo-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 0 3px rgba(16,185,129,.25);
    flex-shrink: 0;
}
.periodo-name  { font-size: 0.875rem; font-weight: 700; color: var(--text-color); margin: 0; }
.periodo-dates { font-size: 0.75rem;  color: var(--text-color-secondary); margin: 2px 0 0; }

/* ════════════════════════════════════════
   KPI ROW
════════════════════════════════════════ */
.kpi-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
}
.kpi-card {
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 12px; padding: 1.25rem 1.375rem;
    display: flex; flex-direction: column; gap: 0.625rem;
    box-shadow: 0 1px 3px rgba(0,0,0,.05);
    transition: box-shadow 0.2s;
}
.kpi-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.08); }
.kpi-card.kpi-accent {
    border-color: rgba(21,101,192,.25);
    background: var(--sisa-accent-surface);
}
.kpi-inner { display: flex; align-items: center; justify-content: space-between; }
.kpi-label { font-size: 0.78rem; font-weight: 600; color: var(--text-color-secondary); text-transform: uppercase; letter-spacing: .04em; }
.kpi-icon-wrap {
    width: 2rem; height: 2rem; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; font-size: 0.9rem;
}
.kpi-icon-blue   { background: var(--sisa-tint-blue);   color: var(--sisa-icon-blue);   }
.kpi-icon-amber  { background: var(--sisa-tint-amber);  color: var(--sisa-icon-amber);  }
.kpi-icon-green  { background: var(--sisa-tint-green);  color: var(--sisa-icon-green);  }
.kpi-icon-purple { background: var(--sisa-tint-purple); color: var(--sisa-icon-purple); }
.kpi-value { font-size: 1.5rem; font-weight: 700; color: var(--text-color); line-height: 1; }
.kpi-total   { font-size: 1rem;  color: var(--text-color-secondary); font-weight: 400; }
.kpi-percent { font-size: 1rem;  color: var(--text-color-secondary); font-weight: 500; }
.kpi-hint    { font-size: 0.78rem; color: var(--text-color-secondary); }
.kpi-progress { height: 6px; border-radius: 99px; }
:deep(.kpi-progress .p-progressbar-value) {
    background: linear-gradient(90deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    border-radius: 99px;
}

/* ════════════════════════════════════════
   FILA SECUNDARIA
════════════════════════════════════════ */
.mid-row { display: flex; gap: 1rem; }
.flex-1  { flex: 1; }
.flex-2  { flex: 2; }

/* Section card base */
.section-card {
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 12px; padding: 1.375rem;
    box-shadow: 0 1px 3px rgba(0,0,0,.05);
}
.section-card-header {
    display: flex; align-items: center; gap: 0.625rem;
    margin-bottom: 1.125rem; padding-bottom: 0.875rem;
    border-bottom: 1px solid var(--sisa-border);
}
.section-icon {
    width: 1.75rem; height: 1.75rem; background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue); border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.85rem; padding: 0.375rem; box-sizing: border-box;
}
.section-title { font-size: 0.95rem; font-weight: 600; color: var(--text-color); }

/* Subsecciones de stats */
.subsection-label {
    font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: .07em; color: var(--text-color-secondary);
    margin: 0 0 0.625rem;
}
.stat-row-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.25rem; }
.stat-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.5rem 0.75rem; background: var(--surface-ground);
    border-radius: 8px; font-size: 0.875rem;
}
.stat-label {
    display: flex; align-items: center; gap: 0.625rem;
    color: var(--text-color);
}
.stat-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.dot-green { background: #10b981; }
.dot-blue  { background: #1565C0; }
.dot-amber { background: #f59e0b; }
.dot-red   { background: #ef4444; }
.stat-val { font-weight: 700; color: var(--text-color); }

.section-divider { height: 1px; background: var(--sisa-border); margin: 1rem 0; }
.section-progress { height: 6px; border-radius: 99px; }
:deep(.section-progress .p-progressbar-value) {
    background: linear-gradient(90deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    border-radius: 99px;
}
.mt-2 { margin-top: 0.625rem; }
.progress-hint {
    font-size: 0.75rem; color: var(--text-color-secondary);
    text-align: right; margin: 0.375rem 0 0;
}

/* ── Acciones rápidas ─────────── */
.quick-actions { display: flex; flex-direction: column; gap: 0.375rem; }

.action-item {
    display: flex; align-items: center; gap: 0.875rem;
    padding: 0.75rem 0.875rem; border-radius: 10px;
    border: 1px solid var(--sisa-border); background: var(--surface-card);
    cursor: pointer; width: 100%; text-align: left;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.action-item:hover {
    border-color: var(--sisa-primary-l);
    background: var(--sisa-accent-surface);
    box-shadow: 0 2px 8px rgba(21,101,192,.08);
}

.action-icon-wrap {
    width: 2.25rem; height: 2.25rem; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.9rem; flex-shrink: 0;
}
.action-blue   { background: var(--sisa-tint-blue);   color: var(--sisa-icon-blue);   }
.action-green  { background: var(--sisa-tint-green);  color: var(--sisa-icon-green);  }
.action-amber  { background: var(--sisa-tint-amber);  color: var(--sisa-icon-amber);  }
.action-purple { background: var(--sisa-tint-purple); color: var(--sisa-icon-purple); }

.action-label {
    font-size: 0.875rem; font-weight: 600;
    color: var(--text-color); margin: 0 0 2px;
}
.action-sub {
    font-size: 0.775rem; color: var(--text-color-secondary); margin: 0;
}
.action-arrow {
    margin-left: auto; font-size: 0.75rem;
    color: var(--text-color-secondary); flex-shrink: 0;
}

/* ════════════════════════════════════════
   ENCUESTAS KPIs
════════════════════════════════════════ */
.enc-kpis-section { display: flex; flex-direction: column; gap: 1.25rem; }
.enc-kpis-loading {
    display: flex; align-items: center; gap: 0.625rem;
    padding: 1.5rem; font-size: 0.875rem; color: var(--text-color-secondary);
}

.ml-auto { margin-left: auto; }

/* Grid de tarjetas KPI de encuesta */
.enc-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }

.enc-kpi-card {
    background: var(--surface-ground);
    border: 1px solid var(--sisa-border);
    border-radius: 10px; padding: 1rem 1.125rem;
    display: flex; flex-direction: column; gap: 0.5rem;
}
.enc-kpi-header { display: flex; align-items: center; gap: 0.5rem; }
.enc-kpi-icon-wrap {
    width: 1.75rem; height: 1.75rem; border-radius: 6px;
    display: flex; align-items: center; justify-content: center; font-size: 0.8rem; flex-shrink: 0;
}
.enc-kpi-blue   { background: var(--sisa-tint-blue);   color: var(--sisa-icon-blue);   }
.enc-kpi-amber  { background: var(--sisa-tint-amber);  color: var(--sisa-icon-amber);  }
.enc-kpi-green  { background: var(--sisa-tint-green);  color: var(--sisa-icon-green);  }
.enc-kpi-purple { background: var(--sisa-tint-purple); color: var(--sisa-icon-purple); }

.enc-kpi-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-color-secondary); }
.enc-kpi-value { font-size: 1.375rem; font-weight: 700; color: var(--text-color); line-height: 1; }
.enc-kpi-of    { font-size: 0.875rem; font-weight: 400; color: var(--text-color-secondary); }
.enc-kpi-hint  { font-size: 0.75rem; color: var(--text-color-secondary); }
.enc-kpi-bar   { height: 5px; border-radius: 99px; }
:deep(.enc-kpi-bar .p-progressbar-value) {
    background: linear-gradient(90deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    border-radius: 99px;
}
.enc-kpi-sub-rows { display: flex; flex-direction: column; gap: 0.2rem; }
.enc-kpi-green { color: #10b981; }
.enc-kpi-red   { color: #ef4444; }

.enc-kpi-chips { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.enc-chip { padding: 0.15rem 0.55rem; border-radius: 99px; font-size: 0.72rem; font-weight: 600; }
.enc-chip-green { background: var(--sisa-tint-green); color: var(--sisa-icon-green); }
.enc-chip-blue  { background: var(--sisa-tint-blue);  color: var(--sisa-icon-blue);  }
.enc-chip-amber { background: var(--sisa-tint-amber); color: var(--sisa-icon-amber); }

/* Fila de experiencia */
.enc-exp-row { display: flex; gap: 1rem; flex-wrap: wrap; }
.enc-exp-card {
    background: var(--surface-ground);
    border: 1px solid var(--sisa-border);
    border-radius: 10px; padding: 1rem 1.125rem;
    display: flex; flex-direction: column; gap: 0.625rem;
    min-width: 200px;
}

/* Yes/No inline bar */
.stat-yesno { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.yesno-si  { font-size: 0.75rem; font-weight: 700; color: #10b981; white-space: nowrap; }
.yesno-no  { font-size: 0.75rem; font-weight: 700; color: #ef4444; white-space: nowrap; }
.yesno-bar { width: 80px; height: 6px; background: var(--sisa-tint-red); border-radius: 99px; overflow: hidden; flex-shrink: 0; }
.yesno-fill { display: block; height: 100%; background: #10b981; border-radius: 99px; transition: width 0.3s; }

/* Pendientes */
.pendientes-list { display: flex; flex-direction: column; gap: 0.5rem; }
.pendiente-row { display: flex; align-items: center; gap: 0.625rem; }
.pendiente-avatar {
    width: 1.875rem; height: 1.875rem; border-radius: 50%;
    background: var(--sisa-tint-purple); color: var(--sisa-icon-purple);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
}
.pendiente-name { font-size: 0.8rem; font-weight: 600; color: var(--text-color); margin: 0; }
.pendiente-meta { font-size: 0.72rem; color: var(--text-color-secondary); margin: 0; }
.pendiente-more { font-size: 0.75rem; color: var(--text-color-secondary); font-style: italic; margin: 0; }

/* ════════════════════════════════════════
   RESPONSIVE
════════════════════════════════════════ */
@media (max-width: 1100px) {
    .kpi-row { grid-template-columns: repeat(2, 1fr); }
    .enc-kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 900px) {
    .mid-row { flex-direction: column; }
    .enc-exp-row { flex-direction: column; }
}
@media (max-width: 600px) {
    .kpi-row { grid-template-columns: 1fr; }
    .enc-kpi-grid { grid-template-columns: 1fr; }
    .dash-header { flex-direction: column; }
    .periodo-badge { width: 100%; }
}
</style>
