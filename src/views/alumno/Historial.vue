<template>
    <div class="historial-view">
        <!-- Header -->
        <div class="hist-header">
            <div class="hist-header__icon">
                <i class="pi pi-history"></i>
            </div>
            <div>
                <h2 class="hist-header__title">Mi Historial de Prácticas</h2>
                <p class="hist-header__sub">Registro detallado de tus períodos de práctica profesional</p>
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="hist-loading">
            <i class="pi pi-spin pi-spinner"></i>
            <span>Cargando historial...</span>
        </div>

        <!-- Empty -->
        <div v-else-if="!loading && historial.length === 0" class="hist-empty">
            <i class="pi pi-inbox hist-empty__icon"></i>
            <p class="hist-empty__title">Sin registros</p>
            <p class="hist-empty__sub">Aún no tienes períodos de práctica en tu historial.</p>
        </div>

        <!-- Timeline -->
        <div v-else class="hist-timeline">
            <div
                v-for="(item, idx) in historial"
                :key="item.id_historial ?? idx"
                class="timeline-item"
                :class="{ 'timeline-item--liberado': item.liberado, 'timeline-item--curso': !item.liberado }"
            >
                <!-- Connector -->
                <div class="timeline-connector">
                    <div class="timeline-dot">
                        <i :class="item.liberado ? 'pi pi-check' : 'pi pi-hourglass'"></i>
                    </div>
                    <div v-if="idx < historial.length - 1" class="timeline-line"></div>
                </div>

                <!-- Card -->
                <div class="timeline-card">
                    <!-- Card header (clickable to expand) -->
                    <div class="timeline-card__header" @click="toggleExpand(idx)">
                        <div class="timeline-card__period">
                            <span class="period-name">{{ item.periodo?.nombre ?? 'Período sin nombre' }}</span>
                            <span class="period-dates">
                                {{ formatDate(item.periodo?.fecha_inicio) }} — {{ formatDate(item.periodo?.fecha_fin) }}
                            </span>
                        </div>
                        <div class="header-right">
                            <Tag
                                :value="item.liberado ? 'Liberado' : 'En curso'"
                                :severity="item.liberado ? 'success' : 'info'"
                                :icon="item.liberado ? 'pi pi-check-circle' : 'pi pi-hourglass'"
                            />
                            <i
                                class="pi expand-icon"
                                :class="expanded[idx] ? 'pi-chevron-up' : 'pi-chevron-down'"
                            ></i>
                        </div>
                    </div>

                    <!-- Card body -->
                    <div class="timeline-card__body">
                        <!-- Info grid -->
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label"><i class="pi pi-building"></i> Empresa</span>
                                <span class="info-value">{{ item.empresa?.nombre ?? 'No asignada' }}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label"><i class="pi pi-tag"></i> Categoría</span>
                                <span class="info-value">{{ item.empresa?.categoria ?? '—' }}</span>
                            </div>
                            <div v-if="item.cuatrimestre" class="info-item">
                                <span class="info-label"><i class="pi pi-graduation-cap"></i> Semestre</span>
                                <span class="info-value">{{ item.cuatrimestre }}°</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label"><i class="pi pi-chart-bar"></i> Encuesta</span>
                                <span class="info-value">
                                    <span class="req-chip" :class="item.encuesta_completada ? 'req-chip--ok' : 'req-chip--no'">
                                        <i :class="item.encuesta_completada ? 'pi pi-check' : 'pi pi-times'"></i>
                                        {{ item.encuesta_completada ? 'Completada' : 'Pendiente' }}
                                    </span>
                                </span>
                            </div>
                            <div v-if="item.resumen" class="info-item">
                                <span class="info-label"><i class="pi pi-star"></i> Promedio final</span>
                                <span class="info-value" :class="item.encuesta_completada ? 'info-value--score' : ''">
                                    <!-- Bloqueado hasta contestar encuestas -->
                                    <template v-if="!item.encuesta_completada">
                                        <span class="score-locked">
                                            <i class="pi pi-lock"></i> Pendiente de encuesta
                                        </span>
                                    </template>
                                    <!-- Reprobado -->
                                    <template v-else-if="item.resumen.promedio_final != null && Number(item.resumen.promedio_final) < 7 && !item.liberado">
                                        <span class="score-reprobado">
                                            {{ Number(item.resumen.promedio_final).toFixed(2) }}
                                            <i class="pi pi-times-circle"></i>
                                        </span>
                                    </template>
                                    <!-- Normal -->
                                    <template v-else>
                                        {{ item.resumen.promedio_final != null
                                            ? Number(item.resumen.promedio_final).toFixed(2)
                                            : item.resumen.promedio_calculado != null
                                                ? Number(item.resumen.promedio_calculado).toFixed(2)
                                                : '—' }}
                                    </template>
                                </span>
                            </div>
                            <div v-if="item.liberado && item.fecha_liberacion" class="info-item">
                                <span class="info-label"><i class="pi pi-calendar-check"></i> Liberado el</span>
                                <span class="info-value">{{ formatDate(item.fecha_liberacion) }}</span>
                            </div>
                        </div>

                        <!-- Resumen bar -->
                        <div v-if="item.resumen" class="resumen-bar">
                            <div class="resumen-stat">
                                <span class="resumen-num">{{ item.resumen.total_entregables ?? 0 }}</span>
                                <span class="resumen-lbl">Total</span>
                            </div>
                            <div class="resumen-divider"></div>
                            <div class="resumen-stat">
                                <span class="resumen-num resumen-num--ok">{{ item.resumen.entregados ?? 0 }}</span>
                                <span class="resumen-lbl">Entregados</span>
                            </div>
                            <div class="resumen-divider"></div>
                            <div class="resumen-stat">
                                <span class="resumen-num resumen-num--eval">{{ item.resumen.evaluados ?? 0 }}</span>
                                <span class="resumen-lbl">Evaluados</span>
                            </div>
                            <div class="resumen-divider"></div>
                            <div class="resumen-stat">
                                <span class="resumen-num resumen-num--pend">{{ item.resumen.pendientes ?? 0 }}</span>
                                <span class="resumen-lbl">Pendientes</span>
                            </div>
                        </div>

                        <!-- Calificaciones expandible -->
                        <Transition name="expand">
                            <div v-if="expanded[idx] && item.calificaciones?.length" class="calificaciones-section">
                                <div class="cal-section-title">
                                    <i class="pi pi-list-check"></i> Calificaciones por entregable
                                </div>
                                <div class="cal-table-wrap">
                                    <table class="cal-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Entregable</th>
                                                <th>Fecha límite</th>
                                                <th>Entregado</th>
                                                <th>Calificación</th>
                                                <th>Observaciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr
                                                v-for="cal in item.calificaciones"
                                                :key="cal.numero"
                                                :class="{ 'cal-row--eval': cal.calificacion != null, 'cal-row--pend': cal.calificacion == null }"
                                            >
                                                <td class="cal-num">{{ cal.numero }}</td>
                                                <td class="cal-nombre">{{ cal.nombre }}</td>
                                                <td class="cal-fecha">{{ formatDate(cal.fecha_limite) }}</td>
                                                <td class="cal-entregado">
                                                    <span v-if="cal.entregado" class="badge-ok">
                                                        <i class="pi pi-check"></i>
                                                        {{ formatDate(cal.fecha_envio) }}
                                                    </span>
                                                    <span v-else class="badge-no">
                                                        <i class="pi pi-times"></i> No entregado
                                                    </span>
                                                </td>
                                                <td class="cal-score">
                                                    <span v-if="cal.calificacion != null" class="score-pill">
                                                        {{ Number(cal.calificacion).toFixed(1) }}
                                                    </span>
                                                    <span v-else class="score-none">—</span>
                                                </td>
                                                <td class="cal-obs">{{ cal.observaciones ?? '—' }}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </Transition>

                        <!-- Toggle button -->
                        <button
                            v-if="item.calificaciones?.length"
                            class="expand-btn"
                            @click="toggleExpand(idx)"
                        >
                            <i class="pi" :class="expanded[idx] ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                            {{ expanded[idx] ? 'Ocultar calificaciones' : `Ver calificaciones (${item.calificaciones.length})` }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <Toast />
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Tag from 'primevue/tag'
import Toast from 'primevue/toast'
import { useToast } from '@/composables/useAppToast'
import api from '@/api/axios'

const toast = useToast()

const historial = ref([])
const loading   = ref(false)
const expanded  = ref({})

function toggleExpand(idx) {
    expanded.value[idx] = !expanded.value[idx]
}

async function loadHistorial() {
    loading.value = true
    try {
        const { data } = await api.get('/historial/me/detalle')
        historial.value = Array.isArray(data) ? data : (data.historial ?? [])
    } catch (err) {
        const msg = err.response?.data?.message ?? 'Error al cargar el historial'
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    } finally {
        loading.value = false
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (isNaN(d)) return dateStr
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(loadHistorial)
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────── */
.historial-view {
    padding: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
}

/* ── Header ─────────────────────────────────────────── */
.hist-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
}
.hist-header__icon {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: var(--sisa-primary, #1565C0);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 1.25rem;
    flex-shrink: 0;
}
.hist-header__title {
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
    color: var(--p-text-color, #1e293b);
}
.hist-header__sub {
    margin: .2rem 0 0;
    color: var(--p-text-muted-color, #64748b);
    font-size: .875rem;
}

/* ── Loading / Empty ─────────────────────────────────── */
.hist-loading {
    display: flex;
    align-items: center;
    gap: .75rem;
    color: var(--p-text-muted-color, #64748b);
    padding: 3rem;
    justify-content: center;
    font-size: 1rem;
}
.hist-empty {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--p-text-muted-color, #94a3b8);
}
.hist-empty__icon { font-size: 3rem; margin-bottom: 1rem; display: block; }
.hist-empty__title { font-size: 1.1rem; font-weight: 600; margin: 0 0 .5rem; color: var(--p-text-color, #475569); }
.hist-empty__sub { margin: 0; font-size: .875rem; }

/* ── Timeline ────────────────────────────────────────── */
.hist-timeline { display: flex; flex-direction: column; }
.timeline-item { display: flex; gap: 1.25rem; align-items: stretch; }

.timeline-connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 2.5rem;
}
.timeline-dot {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: .85rem;
    color: #fff;
    flex-shrink: 0;
    z-index: 1;
    box-shadow: 0 2px 8px rgba(0,0,0,.15);
}
.timeline-item--liberado .timeline-dot { background: var(--sisa-icon-green); }
.timeline-item--curso    .timeline-dot { background: var(--sisa-primary-l); }

.timeline-line {
    width: 2px;
    flex: 1;
    background: var(--p-content-border-color, #e2e8f0);
    margin: 4px 0;
    min-height: 1.5rem;
}

/* ── Card ────────────────────────────────────────────── */
.timeline-card {
    flex: 1;
    background: var(--p-content-background, #fff);
    border: 1px solid var(--p-content-border-color, #e2e8f0);
    border-radius: .75rem;
    overflow: hidden;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 4px rgba(0,0,0,.06);
    transition: box-shadow .2s;
}
.timeline-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.1); }
.timeline-item--liberado .timeline-card { border-left: 3px solid var(--sisa-icon-green); }
.timeline-item--curso    .timeline-card { border-left: 3px solid var(--sisa-primary-l); }

.timeline-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: .875rem 1.25rem;
    background: var(--p-surface-50, #f8fafc);
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
    gap: .75rem;
    flex-wrap: wrap;
    cursor: pointer;
    user-select: none;
}
.header-right {
    display: flex;
    align-items: center;
    gap: .75rem;
}
.expand-icon {
    color: var(--p-text-muted-color, #94a3b8);
    font-size: .85rem;
    transition: transform .2s;
}

.timeline-card__period { display: flex; flex-direction: column; gap: .15rem; }
.period-name { font-weight: 700; font-size: 1rem; color: var(--p-text-color, #1e293b); }
.period-dates { font-size: .8rem; color: var(--p-text-muted-color, #64748b); }

.timeline-card__body { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }

/* ── Info grid ───────────────────────────────────────── */
.info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: .75rem 1.5rem;
}
.info-item { display: flex; flex-direction: column; gap: .25rem; }
.info-label {
    font-size: .75rem;
    font-weight: 600;
    color: var(--p-text-muted-color, #64748b);
    text-transform: uppercase;
    letter-spacing: .04em;
    display: flex;
    align-items: center;
    gap: .35rem;
}
.info-label .pi { font-size: .75rem; }
.info-value { font-size: .95rem; color: var(--p-text-color, #1e293b); font-weight: 500; }
.info-value--score { font-size: 1.2rem; font-weight: 700; color: var(--sisa-icon-green); }
.score-locked {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    font-style: italic;
}
.score-reprobado {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--sisa-icon-red);
}

/* Req chip inline */
.req-chip {
    display: inline-flex;
    align-items: center;
    gap: .3rem;
    font-size: .75rem;
    font-weight: 600;
    padding: .2rem .55rem;
    border-radius: 999px;
}
.req-chip--ok { background: var(--sisa-tint-green); color: var(--sisa-icon-green); }
.req-chip--no { background: var(--sisa-tint-red);   color: var(--sisa-icon-red);   }
.req-chip .pi { font-size: .7rem; }

/* ── Resumen bar ─────────────────────────────────────── */
.resumen-bar {
    display: flex;
    align-items: center;
    gap: 0;
    background: var(--p-surface-100, #f1f5f9);
    border-radius: .5rem;
    overflow: hidden;
    border: 1px solid var(--p-content-border-color, #e2e8f0);
}
.resumen-stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: .6rem .5rem;
    gap: .15rem;
}
.resumen-divider {
    width: 1px;
    align-self: stretch;
    background: var(--p-content-border-color, #e2e8f0);
}
.resumen-num {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--p-text-color, #1e293b);
}
.resumen-num--ok   { color: var(--sisa-primary-l);  }
.resumen-num--eval { color: var(--sisa-icon-green); }
.resumen-num--pend { color: var(--sisa-icon-amber); }
.resumen-lbl {
    font-size: .72rem;
    font-weight: 600;
    color: var(--p-text-muted-color, #64748b);
    text-transform: uppercase;
    letter-spacing: .03em;
}

/* ── Calificaciones ──────────────────────────────────── */
.calificaciones-section {
    border: 1px solid var(--p-content-border-color, #e2e8f0);
    border-radius: .5rem;
    overflow: hidden;
}
.cal-section-title {
    padding: .6rem 1rem;
    font-size: .8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--p-text-muted-color, #64748b);
    background: var(--p-surface-100, #f1f5f9);
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
    display: flex;
    align-items: center;
    gap: .5rem;
}
.cal-table-wrap { overflow-x: auto; }
.cal-table {
    width: 100%;
    border-collapse: collapse;
    font-size: .82rem;
}
.cal-table th {
    padding: .55rem .875rem;
    text-align: left;
    font-weight: 600;
    font-size: .75rem;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: var(--p-text-muted-color, #64748b);
    background: var(--p-surface-50, #f8fafc);
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
    white-space: nowrap;
}
.cal-table td {
    padding: .65rem .875rem;
    border-bottom: 1px solid var(--p-content-border-color, #f1f5f9);
    color: var(--p-text-color, #1e293b);
    vertical-align: middle;
}
.cal-table tbody tr:last-child td { border-bottom: none; }
.cal-row--eval td { background: rgba(16, 185, 129, .03); }

.cal-num { font-weight: 700; color: var(--p-text-muted-color, #94a3b8); width: 2rem; }
.cal-nombre { font-weight: 500; }
.cal-fecha { white-space: nowrap; color: var(--p-text-muted-color, #64748b); }
.cal-obs { color: var(--p-text-muted-color, #64748b); font-style: italic; max-width: 200px; }

.badge-ok {
    display: inline-flex;
    align-items: center;
    gap: .3rem;
    color: var(--sisa-icon-green);
    font-size: .78rem;
    font-weight: 600;
    background: var(--sisa-tint-green);
    padding: .15rem .5rem;
    border-radius: .375rem;
    white-space: nowrap;
}
.badge-no {
    display: inline-flex;
    align-items: center;
    gap: .3rem;
    color: var(--sisa-icon-red);
    font-size: .78rem;
    font-weight: 600;
    background: var(--sisa-tint-red);
    padding: .15rem .5rem;
    border-radius: .375rem;
}
.score-pill {
    display: inline-block;
    background: var(--sisa-tint-green);
    color: var(--sisa-icon-green);
    font-weight: 700;
    font-size: .85rem;
    padding: .2rem .55rem;
    border-radius: .375rem;
}
.score-none { color: var(--p-text-muted-color, #94a3b8); }

/* ── Expand button ───────────────────────────────────── */
.expand-btn {
    align-self: center;
    background: none;
    border: 1px solid var(--p-content-border-color, #e2e8f0);
    border-radius: .5rem;
    padding: .4rem 1rem;
    font-size: .8rem;
    font-weight: 600;
    color: var(--p-text-muted-color, #64748b);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: .4rem;
    transition: background .15s, color .15s;
}
.expand-btn:hover {
    background: var(--p-surface-100, #f1f5f9);
    color: var(--p-text-color, #1e293b);
}

/* ── Expand transition ───────────────────────────────── */
.expand-enter-active, .expand-leave-active {
    transition: opacity .2s, max-height .25s ease;
    max-height: 800px;
    overflow: hidden;
}
.expand-enter-from, .expand-leave-to {
    opacity: 0;
    max-height: 0;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 600px) {
    .historial-view { padding: 1rem; }
    .timeline-card__header { flex-direction: column; align-items: flex-start; }
    .info-grid { grid-template-columns: 1fr 1fr; }
    .resumen-bar { flex-wrap: wrap; }
}
</style>
