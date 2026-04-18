<script setup>
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import { computed, onActivated, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const router = useRouter();
const auth   = useAuthStore();
const toast  = useToast();

// ════════════════════════════════
// STATE
// ════════════════════════════════
const loading  = ref(true);
const error    = ref(false);
const dash     = ref(null); // respuesta de /dashboard/alumno

// ════════════════════════════════
// LOAD
// ════════════════════════════════
const loadDashboard = async () => {
    loading.value = true;
    error.value   = false;
    try {
        const { data } = await api.get('/dashboard/alumno');
        dash.value = data;
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

// Carga inicial
onMounted(loadDashboard);

// Si el componente está dentro de <keep-alive>, se reactiva al volver
onActivated(loadDashboard);

// Recarga cuando el usuario vuelve a la pestaña del navegador
const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') loadDashboard();
};
onMounted(()    => document.addEventListener('visibilitychange', onVisibilityChange));
onUnmounted(() => document.removeEventListener('visibilitychange', onVisibilityChange));

// ════════════════════════════════
// COMPUTED — derivados del payload
// ════════════════════════════════

/** Nombre de pila del alumno */
const firstName = computed(() => {
    const nombre = dash.value?.alumno?.nombre || auth.user?.nombre || '';
    return nombre.split(' ')[0];
});

/** Datos de entregables con defaults seguros */
const ent = computed(() => dash.value?.entregables ?? {
    total: 0, entregados: 0, evaluados: 0, pendientes: 0, promedio_actual: null
});

/** Porcentaje de avance basado en entregables completados (entregados + evaluados) */
const avancePct = computed(() => {
    const total = ent.value.total;
    if (!total) return 0;
    const completados = (ent.value.entregados ?? 0) + (ent.value.evaluados ?? 0);
    return Math.round((completados / total) * 100);
});

/** Estado de postulación / empresa — viene en asignacion.empresa */
const asignacion = computed(() => dash.value?.asignacion ?? null);
const empresa    = computed(() => asignacion.value ?? null);

/** Estado legible de la empresa */
const empresaLabel   = computed(() => asignacion.value?.empresa ?? 'Pendiente');
const empresaPending = computed(() => !asignacion.value);

/** Encuesta — el back devuelve un boolean plano */
const encuestaCompletada = computed(() => dash.value?.encuesta_completada ?? false);

/** Liberado */
const liberado = computed(() => dash.value?.liberado ?? false);
const promedioFinal = computed(() => dash.value?.promedio_final ?? null);

// ════════════════════════════════
// JOURNEY — 5 etapas dinámicas
// ════════════════════════════════
const journeySteps = computed(() => {
    const entTotal      = ent.value.total ?? 0;
    const entCompletos  = (ent.value.entregados ?? 0) + (ent.value.evaluados ?? 0);
    const tieneEmpresa  = !!asignacion.value;
    const isLiberated   = liberado.value;

    return [
        {
            label: 'Registro',
            icon:  'pi pi-user-plus',
            done:  true,          // siempre done si está logueado
            active: false
        },
        {
            label: 'Postulación',
            icon:  'pi pi-send',
            done:  tieneEmpresa,
            active: !tieneEmpresa
        },
        {
            label: 'Aceptación',
            icon:  'pi pi-check-circle',
            done:  asignacion.value?.estado_postulacion === 'ACEPTADO',
            active: tieneEmpresa && asignacion.value?.estado_postulacion !== 'ACEPTADO'
        },
        {
            label: 'Entregables',
            icon:  'pi pi-file',
            done:  entCompletos > 0 && entCompletos === entTotal && entTotal > 0,
            active: tieneEmpresa && entTotal > 0 && entCompletos < entTotal
        },
        {
            label: 'Liberación',
            icon:  'pi pi-graduation-cap',
            done:  isLiberated,
            active: !isLiberated && entTotal > 0 && entCompletos === entTotal
        }
    ];
});

// ════════════════════════════════
// ITEMS del estado actual
// ════════════════════════════════
const statusItems = computed(() => {
    const items = [];

    // Empresa / Asignación
    if (asignacion.value) {
        items.push({
            dot: 'dot-green',
            title: `Empresa: ${asignacion.value.empresa}`,
            sub: asignacion.value.categoria ? `Área: ${asignacion.value.categoria}` : 'Asignación confirmada'
        });
    } else {
        items.push({
            dot: 'dot-amber',
            title: 'Empresa pendiente de confirmación',
            sub: 'En revisión por el coordinador'
        });
    }

    // Entregables
    const pendientes = ent.value.pendientes ?? 0;
    if (pendientes > 0) {
        items.push({
            dot: 'dot-blue',
            title: `${pendientes} entregable${pendientes > 1 ? 's' : ''} pendiente${pendientes > 1 ? 's' : ''}`,
            sub: 'Revisa tus fechas límite'
        });
    } else if (ent.value.total > 0) {
        items.push({
            dot: 'dot-green',
            title: 'Todos los entregables completados',
            sub: `Promedio actual: ${ent.value.promedio_actual ?? '—'}`
        });
    }

    // Encuesta
    if (encuestaCompletada.value) {
        items.push({ dot: 'dot-green', title: 'Encuesta respondida', sub: 'Gracias por tu retroalimentación' });
    } else {
        items.push({ dot: 'dot-amber', title: 'Encuesta pendiente', sub: 'Responde la encuesta de satisfacción del periodo' });
    }

    // Liberado
    if (liberado.value) {
        items.push({
            dot: 'dot-green',
            title: `¡Alumno liberado! Promedio final: ${promedioFinal.value ?? '—'}`,
            sub: 'Has completado exitosamente el periodo de prácticas'
        });
    }

    return items;
});
</script>

<template>
    <div class="dashboard">
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
        <div v-else-if="error" class="dash-error">
            <div class="status-banner banner-danger">
                <div class="banner-icon-wrap icon-danger"><i class="pi pi-exclamation-triangle"></i></div>
                <div>
                    <p class="banner-title">No se pudo cargar el dashboard</p>
                    <p class="banner-desc">Revisa tu conexión o intenta de nuevo.</p>
                </div>
                <Button label="Reintentar" icon="pi pi-refresh" size="small" severity="secondary" @click="loadDashboard" />
            </div>
        </div>

        <!-- ════════════════════════════════
             CONTENIDO REAL
        ════════════════════════════════ -->
        <template v-else>

            <!-- Header -->
            <div class="dash-header">
                <div>
                    <h1 class="dash-title">¡Bienvenido, {{ firstName }}! 👋</h1>
                    <p class="dash-subtitle">Aquí tienes un resumen de tu situación en prácticas profesionales.</p>
                </div>
                <Tag
                    v-if="liberado"
                    value="Liberado ✓"
                    severity="success"
                    class="period-tag"
                />
                <Tag
                    v-else
                    value="Periodo activo"
                    severity="info"
                    class="period-tag"
                />
            </div>

            <!-- KPI CARDS -->
            <div class="kpi-row">
                <!-- Empresa -->
                <div class="kpi-card" :class="empresaPending ? '' : 'kpi-accent'">
                    <div class="kpi-inner">
                        <span class="kpi-label">Empresa asignada</span>
                        <div class="kpi-icon-wrap" :class="empresaPending ? 'kpi-icon-amber' : 'kpi-icon-blue'">
                            <i class="pi pi-building"></i>
                        </div>
                    </div>
                    <div class="kpi-value" :class="{ 'kpi-value--pending': empresaPending }">
                        {{ empresaLabel }}
                    </div>
                    <span class="kpi-hint">{{ empresaPending ? 'Asignación en proceso' : 'Empresa confirmada' }}</span>
                </div>

                <!-- Entregables -->
                <div class="kpi-card">
                    <div class="kpi-inner">
                        <span class="kpi-label">Entregables</span>
                        <div class="kpi-icon-wrap kpi-icon-green">
                            <i class="pi pi-file-check"></i>
                        </div>
                    </div>
                    <div class="kpi-value">
                        {{ (ent.entregados ?? 0) + (ent.evaluados ?? 0) }}
                        <span class="kpi-total">/ {{ ent.total ?? 0 }}</span>
                    </div>
                    <span class="kpi-hint">Completados este periodo</span>
                </div>

                <!-- Promedio -->
                <div class="kpi-card">
                    <div class="kpi-inner">
                        <span class="kpi-label">Promedio actual</span>
                        <div class="kpi-icon-wrap kpi-icon-purple">
                            <i class="pi pi-star"></i>
                        </div>
                    </div>
                    <div class="kpi-value">
                        <template v-if="promedioFinal !== null">
                            {{ promedioFinal }}
                            <span class="kpi-total">final</span>
                        </template>
                        <template v-else-if="ent.promedio_actual !== null && ent.promedio_actual !== undefined">
                            {{ ent.promedio_actual }}
                        </template>
                        <template v-else>
                            <span class="kpi-value--pending">—</span>
                        </template>
                    </div>
                    <span class="kpi-hint">{{ promedioFinal !== null ? 'Promedio final calculado' : 'Basado en entregables evaluados' }}</span>
                </div>

                <!-- Avance general -->
                <div class="kpi-card">
                    <div class="kpi-inner">
                        <span class="kpi-label">Avance general</span>
                        <div class="kpi-icon-wrap kpi-icon-blue">
                            <i class="pi pi-chart-line"></i>
                        </div>
                    </div>
                    <div class="kpi-value">
                        {{ avancePct }}<span class="kpi-percent">%</span>
                    </div>
                    <ProgressBar :value="avancePct" class="kpi-progress" :showValue="false" />
                </div>
            </div>

            <!-- JOURNEY -->
            <div class="section-card journey-card">
                <div class="section-card-header">
                    <i class="pi pi-map section-icon"></i>
                    <span class="section-title">Tu progreso en prácticas</span>
                </div>
                <div class="journey-steps">
                    <template v-for="(step, i) in journeySteps" :key="step.label">
                        <div class="journey-step" :class="{ 'step-done': step.done, 'step-active': step.active }">
                            <div class="step-circle">
                                <i :class="step.done ? 'pi pi-check' : step.icon"></i>
                            </div>
                            <span class="step-label">{{ step.label }}</span>
                        </div>
                        <div
                            v-if="i < journeySteps.length - 1"
                            class="journey-connector"
                            :class="{ 'connector-done': journeySteps[i + 1].done || journeySteps[i + 1].active }"
                        ></div>
                    </template>
                </div>
            </div>

            <!-- FILA INFERIOR -->
            <div class="bottom-row">
                <!-- Situación actual -->
                <div class="section-card flex-2">
                    <div class="section-card-header">
                        <i class="pi pi-info-circle section-icon"></i>
                        <span class="section-title">Mi situación actual</span>
                    </div>

                    <p class="situation-text">
                        <template v-if="liberado">
                            ¡Felicidades! Has completado exitosamente tu periodo de prácticas profesionales.
                            Tu promedio final es <strong>{{ promedioFinal }}</strong>.
                        </template>
                        <template v-else>
                            Te encuentras registrado en el periodo actual de prácticas profesionales.
                            Asegúrate de completar tus entregables en tiempo y forma.
                        </template>
                    </p>

                    <ul v-if="statusItems.length" class="status-list">
                        <li v-for="(item, i) in statusItems" :key="i" class="status-item">
                            <div class="status-dot" :class="item.dot"></div>
                            <div>
                                <span class="status-item-title">{{ item.title }}</span>
                                <span class="status-item-sub">{{ item.sub }}</span>
                            </div>
                        </li>
                    </ul>
                </div>

                <!-- Acciones rápidas -->
                <div class="section-card flex-1">
                    <div class="section-card-header">
                        <i class="pi pi-bolt section-icon"></i>
                        <span class="section-title">Acciones rápidas</span>
                    </div>
                    <div class="quick-actions">
                        <Button
                            label="Ver vacantes"
                            icon="pi pi-briefcase"
                            class="quick-btn"
                            severity="secondary"
                            outlined
                            @click="router.push('/alumno/vacantes')"
                        />
                        <Button
                            label="Subir entregable"
                            icon="pi pi-upload"
                            class="quick-btn"
                            severity="secondary"
                            outlined
                            @click="router.push('/alumno/entregables')"
                        />
                        <Button
                            label="Historial académico"
                            icon="pi pi-history"
                            class="quick-btn"
                            severity="secondary"
                            outlined
                            @click="router.push('/alumno/historial')"
                        />
                        <Button
                            :label="encuestaCompletada ? 'Encuesta respondida' : 'Responder encuesta'"
                            :icon="encuestaCompletada ? 'pi pi-check-circle' : 'pi pi-comment'"
                            class="quick-btn"
                            severity="secondary"
                            outlined
                            :disabled="encuestaCompletada"
                            @click="router.push('/alumno/encuesta')"
                        />
                    </div>
                </div>
            </div>

        </template>
    </div>
</template>

<style scoped>
/* ════════════════════════════════════════
   LAYOUT
════════════════════════════════════════ */
.dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-bottom: 1rem;
}

/* ════════════════════════════════════════
   LOADING / ERROR
════════════════════════════════════════ */
.dash-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 5rem 0;
    color: var(--text-color-secondary);
    font-size: 0.875rem;
}

.dash-spinner { font-size: 2rem; color: var(--sisa-primary-l); }

.dash-error { display: flex; flex-direction: column; gap: 1rem; }

/* ════════════════════════════════════════
   BANNER (reutilizado del sistema)
════════════════════════════════════════ */
.status-banner {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-radius: 12px;
    border: 1px solid;
}
.banner-danger { background: var(--sisa-banner-danger-bg); border-color: var(--sisa-banner-danger-bd); }
.banner-icon-wrap {
    flex-shrink: 0; width: 2.25rem; height: 2.25rem;
    border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem;
}
.icon-danger { background: var(--sisa-tint-red); color: var(--sisa-icon-red); }
.banner-title { font-weight: 700; font-size: 0.9rem; color: var(--text-color); margin: 0 0 0.2rem; }
.banner-desc  { font-size: 0.825rem; color: var(--text-color-secondary); margin: 0; }

/* ════════════════════════════════════════
   HEADER
════════════════════════════════════════ */
.dash-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}
.dash-title {
    font-size: 1.5rem; font-weight: 700;
    color: var(--text-color); margin: 0 0 0.25rem;
}
.dash-subtitle { font-size: 0.9rem; color: var(--text-color-secondary); margin: 0; }
.period-tag { flex-shrink: 0; margin-top: 4px; }

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
    border-radius: 12px;
    padding: 1.25rem 1.375rem;
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
.kpi-value--pending { color: var(--text-color-secondary); font-style: italic; font-size: 1.1rem; }
.kpi-total   { font-size: 1rem;  color: var(--text-color-secondary); font-weight: 400; }
.kpi-percent { font-size: 1rem;  color: var(--text-color-secondary); font-weight: 500; }
.kpi-hint    { font-size: 0.78rem; color: var(--text-color-secondary); }

.kpi-progress { height: 6px; border-radius: 99px; }
:deep(.kpi-progress .p-progressbar-value) {
    background: linear-gradient(90deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    border-radius: 99px;
}

/* ════════════════════════════════════════
   SECTION CARDS
════════════════════════════════════════ */
.section-card {
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 12px;
    padding: 1.375rem;
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

/* ════════════════════════════════════════
   JOURNEY
════════════════════════════════════════ */
.journey-steps {
    display: flex; align-items: center;
    overflow-x: auto; padding: 0.5rem 0;
}
.journey-step { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.step-circle {
    width: 2.25rem; height: 2.25rem; border-radius: 50%;
    border: 2px solid var(--sisa-border); background: var(--surface-card);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.875rem; color: var(--text-color-secondary); transition: all 0.25s;
}
.step-done .step-circle   { background: var(--sisa-primary);   border-color: var(--sisa-primary);   color: #fff; }
.step-active .step-circle { background: var(--surface-card);   border-color: var(--sisa-primary-l); color: var(--sisa-primary-l); box-shadow: 0 0 0 4px rgba(21,101,192,.15); }
.step-label { font-size: 0.75rem; font-weight: 500; color: var(--text-color-secondary); white-space: nowrap; }
.step-done .step-label, .step-active .step-label { color: var(--text-color); }

.journey-connector {
    flex: 1; height: 2px; background: var(--sisa-border);
    min-width: 3rem; margin-bottom: 1.375rem; transition: background 0.25s;
}
.connector-done { background: var(--sisa-primary); }

/* ════════════════════════════════════════
   FILA INFERIOR
════════════════════════════════════════ */
.bottom-row { display: flex; gap: 1rem; }
.flex-1 { flex: 1; }
.flex-2 { flex: 2; }

.situation-text { font-size: 0.875rem; color: var(--text-color-secondary); line-height: 1.6; margin: 0 0 1.25rem; }

.status-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.875rem; }
.status-item {
    display: flex; align-items: flex-start; gap: 0.875rem;
    padding: 0.75rem; border-radius: 8px;
    background: var(--surface-ground); border: 1px solid var(--sisa-border);
}
.status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
.dot-green { background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.18); }
.dot-amber { background: #f59e0b; box-shadow: 0 0 0 3px rgba(245,158,11,.18); }
.dot-blue  { background: #1565C0; box-shadow: 0 0 0 3px rgba(21,101,192,.18); }
.status-item-title { display: block; font-size: 0.875rem; font-weight: 600; color: var(--text-color); margin-bottom: 2px; }
.status-item-sub   { display: block; font-size: 0.78rem;  color: var(--text-color-secondary); }

.quick-actions { display: flex; flex-direction: column; gap: 0.625rem; }
.quick-btn {
    justify-content: flex-start; border-radius: 8px; font-size: 0.875rem;
    border-color: var(--sisa-border); color: var(--text-color);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.quick-btn:not(:disabled):hover {
    border-color: var(--sisa-primary-l) !important;
    color: var(--sisa-primary-l) !important;
    background: var(--sisa-active-bg) !important;
}

/* ════════════════════════════════════════
   RESPONSIVE
════════════════════════════════════════ */
@media (max-width: 1024px) {
    .kpi-row   { grid-template-columns: repeat(2, 1fr); }
    .bottom-row { flex-direction: column; }
}
@media (max-width: 600px) {
    .kpi-row   { grid-template-columns: 1fr; }
    .dash-header { flex-direction: column; }
}
</style>
