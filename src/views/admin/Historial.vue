<template>
    <div class="historial-admin">
        <!-- Header -->
        <div class="page-header">
            <div class="page-header__left">
                <div class="page-header__icon"><i class="pi pi-history"></i></div>
                <div>
                    <h2 class="page-header__title">Historial de Prácticas</h2>
                    <p class="page-header__sub">Gestión y liberación de alumnos por período</p>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="filters-bar">
            <div class="filter-group">
                <label class="filter-label">Período</label>
                <Select
                    v-model="periodoSel"
                    :options="periodos"
                    option-label="nombre"
                    option-value="id_periodo"
                    placeholder="Selecciona un período"
                    class="filter-select"
                    @change="loadHistorial"
                />
            </div>
            <div class="filter-group">
                <label class="filter-label">Buscar alumno</label>
                <InputText
                    v-model="searchTerm"
                    placeholder="Nombre o empresa..."
                    class="filter-input"
                />
            </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="state-box">
            <i class="pi pi-spin pi-spinner state-box__icon"></i>
            <span>Cargando historial...</span>
        </div>

        <!-- No period selected -->
        <div v-else-if="!periodoSel" class="state-box">
            <i class="pi pi-filter state-box__icon"></i>
            <p class="state-box__title">Selecciona un período</p>
            <p class="state-box__sub">Elige un período para ver el historial de prácticas.</p>
        </div>

        <!-- Empty -->
        <div v-else-if="filtered.length === 0" class="state-box">
            <i class="pi pi-inbox state-box__icon"></i>
            <p class="state-box__title">Sin registros</p>
            <p class="state-box__sub">No hay alumnos en el historial para este período.</p>
        </div>

        <!-- Table -->
        <div v-else class="table-wrapper">
            <div class="table-meta">
                <span>{{ filtered.length }} alumno{{ filtered.length !== 1 ? 's' : '' }}</span>
                <span class="table-meta__badges">
                    <Tag :value="`${liberadosCount} liberados`" severity="success" />
                    <Tag :value="`${pendientesCount} pendientes`" severity="warn" />
                </span>
            </div>

            <div class="hist-table-scroll">
                <table class="hist-table">
                    <thead>
                        <tr>
                            <th>Alumno</th>
                            <th>Empresa</th>
                            <th>Categoría</th>
                            <th>Semestre</th>
                            <th>Promedio</th>
                            <th>Estado</th>
                            <th>Requisitos</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in filtered" :key="item.id_historial">
                            <td class="td-alumno">
                                <div class="alumno-name">{{ item.alumno?.nombre ?? '—' }}</div>
                                <div class="alumno-id">{{ item.alumno?.matricula ?? item.alumno?.numero_control ?? item.alumno?.email ?? '' }}</div>
                            </td>
                            <td>{{ item.empresa?.nombre ?? '—' }}</td>
                            <td>{{ item.empresa?.categoria ?? '—' }}</td>
                            <td class="td-center">
                                <span v-if="item.cuatrimestre">{{ item.cuatrimestre }}°</span>
                                <span v-else class="text-muted">—</span>
                            </td>
                            <td class="td-score">
                                <span v-if="promedioItem(item) != null" class="score-badge">
                                    {{ Number(promedioItem(item)).toFixed(2) }}
                                </span>
                                <span v-else class="score-none">—</span>
                            </td>
                            <td>
                                <Tag
                                    :value="item.liberado ? 'Liberado' : 'Pendiente'"
                                    :severity="item.liberado ? 'success' : 'warn'"
                                    :icon="item.liberado ? 'pi pi-check-circle' : 'pi pi-clock'"
                                />
                            </td>
                            <td class="td-req">
                                <div class="req-list">
                                    <span class="req-chip" :class="item.encuesta_completada ? 'req-chip--ok' : 'req-chip--no'">
                                        <i :class="item.encuesta_completada ? 'pi pi-check' : 'pi pi-times'"></i>
                                        Encuesta
                                    </span>
                                    <span class="req-chip" :class="entregablesCompletos(item) ? 'req-chip--ok' : 'req-chip--no'">
                                        <i :class="entregablesCompletos(item) ? 'pi pi-check' : 'pi pi-times'"></i>
                                        Entregables
                                    </span>
                                </div>
                            </td>
                            <td class="td-actions">
                                <!-- Detail button -->
                                <Button
                                    icon="pi pi-eye"
                                    size="small"
                                    severity="secondary"
                                    text
                                    v-tooltip.top="'Ver detalle'"
                                    @click="verDetalle(item)"
                                />
                                <!-- Liberar button -->
                                <Button
                                    v-if="!item.liberado"
                                    label="Liberar"
                                    icon="pi pi-unlock"
                                    size="small"
                                    :disabled="!canLiberar(item) || liberando === item.id_historial"
                                    :loading="liberando === item.id_historial"
                                    v-tooltip.top="liberarTooltip(item)"
                                    @click="liberar(item)"
                                />
                                <span v-else class="liberado-date">
                                    <i class="pi pi-calendar-check"></i>
                                    {{ formatDate(item.fecha_liberacion) }}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- ── Detalle Dialog ───────────────────────────────── -->
        <Dialog
            v-model:visible="detalleVisible"
            :header="detalleAlumno ? `Detalle — ${detalleAlumno.alumno?.nombre ?? 'Alumno'}` : 'Detalle'"
            modal
            :style="{ width: '860px', maxWidth: '98vw' }"
            :closable="true"
        >
            <div v-if="loadingDetalle" class="det-loading">
                <i class="pi pi-spin pi-spinner"></i> Cargando detalle...
            </div>

            <div v-else-if="detalle.length === 0" class="det-empty">
                Sin datos de historial para este alumno.
            </div>

            <div v-else class="det-content">
                <div v-for="(period, pi) in detalle" :key="pi" class="det-period">
                    <!-- Period header -->
                    <div class="det-period__header" :class="period.liberado ? 'det-period--lib' : 'det-period--cur'">
                        <div class="det-period__info">
                            <span class="det-period__name">{{ period.periodo?.nombre ?? '—' }}</span>
                            <span class="det-period__dates">
                                {{ formatDate(period.periodo?.fecha_inicio) }} — {{ formatDate(period.periodo?.fecha_fin) }}
                            </span>
                        </div>
                        <div class="det-period__right">
                            <div class="det-meta-row">
                                <span class="det-meta-item"><i class="pi pi-building"></i> {{ period.empresa?.nombre ?? '—' }}</span>
                                <span class="det-meta-item"><i class="pi pi-tag"></i> {{ period.empresa?.categoria ?? '—' }}</span>
                                <span v-if="period.cuatrimestre" class="det-meta-item">
                                    <i class="pi pi-graduation-cap"></i> {{ period.cuatrimestre }}° semestre
                                </span>
                            </div>
                            <Tag
                                :value="period.liberado ? 'Liberado' : 'En curso'"
                                :severity="period.liberado ? 'success' : 'info'"
                                style="margin-top:.4rem;"
                            />
                        </div>
                    </div>

                    <!-- Resumen mini bar -->
                    <div v-if="period.resumen" class="det-resumen">
                        <div class="det-res-item">
                            <span class="det-res-num">{{ period.resumen.total_entregables ?? 0 }}</span>
                            <span class="det-res-lbl">Total</span>
                        </div>
                        <div class="det-res-div"></div>
                        <div class="det-res-item">
                            <span class="det-res-num det-res-num--ok">{{ period.resumen.entregados ?? 0 }}</span>
                            <span class="det-res-lbl">Entregados</span>
                        </div>
                        <div class="det-res-div"></div>
                        <div class="det-res-item">
                            <span class="det-res-num det-res-num--eval">{{ period.resumen.evaluados ?? 0 }}</span>
                            <span class="det-res-lbl">Evaluados</span>
                        </div>
                        <div class="det-res-div"></div>
                        <div class="det-res-item">
                            <span class="det-res-num det-res-num--pend">{{ period.resumen.pendientes ?? 0 }}</span>
                            <span class="det-res-lbl">Pendientes</span>
                        </div>
                        <div class="det-res-div"></div>
                        <div class="det-res-item">
                            <span class="det-res-num det-res-num--score">
                                {{ period.resumen.promedio_final != null
                                    ? Number(period.resumen.promedio_final).toFixed(2)
                                    : period.resumen.promedio_calculado != null
                                        ? Number(period.resumen.promedio_calculado).toFixed(2)
                                        : '—' }}
                            </span>
                            <span class="det-res-lbl">Promedio</span>
                        </div>
                        <div class="det-res-div"></div>
                        <div class="det-res-item">
                            <span class="det-res-num" :class="period.encuesta_completada ? 'det-res-num--eval' : 'det-res-num--pend'">
                                <i :class="period.encuesta_completada ? 'pi pi-check' : 'pi pi-times'"></i>
                            </span>
                            <span class="det-res-lbl">Encuesta</span>
                        </div>
                    </div>

                    <!-- Calificaciones table -->
                    <div v-if="period.calificaciones?.length" class="det-cal-wrap">
                        <table class="det-cal-table">
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
                                    v-for="cal in period.calificaciones"
                                    :key="cal.numero"
                                    :class="{ 'row-eval': cal.calificacion != null }"
                                >
                                    <td class="cal-num">{{ cal.numero }}</td>
                                    <td>{{ cal.nombre }}</td>
                                    <td class="cal-fecha">{{ formatDate(cal.fecha_limite) }}</td>
                                    <td>
                                        <span v-if="cal.entregado" class="badge-ok">
                                            <i class="pi pi-check"></i> {{ formatDate(cal.fecha_envio) }}
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
                    <div v-else class="det-no-cal">Sin calificaciones registradas para este período.</div>
                </div>
            </div>
        </Dialog>

        <Toast />
        <ConfirmDialog />
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import api from '@/api/axios'

const toast   = useToast()
const confirm = useConfirm()

const periodos   = ref([])
const periodoSel = ref(null)
const historial  = ref([])
const loading    = ref(false)
const liberando  = ref(null)
const searchTerm = ref('')

// Detail dialog
const detalleVisible  = ref(false)
const detalleAlumno   = ref(null)
const detalle         = ref([])
const loadingDetalle  = ref(false)

// ── Computed ──────────────────────────────────────────
const filtered = computed(() => {
    const q = searchTerm.value.trim().toLowerCase()
    if (!q) return historial.value
    return historial.value.filter(item => {
        const nombre  = (item.alumno?.nombre ?? '').toLowerCase()
        const empresa = (item.empresa?.nombre ?? '').toLowerCase()
        return nombre.includes(q) || empresa.includes(q)
    })
})

const liberadosCount  = computed(() => historial.value.filter(i => i.liberado).length)
const pendientesCount = computed(() => historial.value.filter(i => !i.liberado).length)

// ── Helpers ──────────────────────────────────────────
function promedioItem(item) {
    return item.resumen?.promedio_final ?? item.resumen?.promedio_calculado ?? item.promedio_final ?? null
}

function entregablesCompletos(item) {
    if (item.entregables_completos != null) return item.entregables_completos
    if (!item.resumen) return false
    return item.resumen.pendientes === 0 && item.resumen.evaluados > 0
}

function canLiberar(item) {
    return item.encuesta_completada && entregablesCompletos(item)
}

function liberarTooltip(item) {
    const faltas = []
    if (!item.encuesta_completada)      faltas.push('encuesta pendiente')
    if (!entregablesCompletos(item))    faltas.push('entregables incompletos')
    return faltas.length ? `No se puede liberar: ${faltas.join(', ')}` : 'Liberar alumno'
}

function formatDate(dateStr) {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (isNaN(d)) return dateStr
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── API ───────────────────────────────────────────────
async function loadPeriodos() {
    try {
        const { data } = await api.get('/periodos')
        periodos.value = Array.isArray(data) ? data : (data.periodos ?? [])
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los períodos', life: 3000 })
    }
}

async function loadHistorial() {
    if (!periodoSel.value) return
    loading.value = true
    historial.value = []
    try {
        const { data } = await api.get('/historial', { params: { periodoId: periodoSel.value } })
        historial.value = Array.isArray(data) ? data : (data.historial ?? [])
    } catch (err) {
        const msg = err.response?.data?.message ?? 'Error al cargar el historial'
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    } finally {
        loading.value = false
    }
}

async function verDetalle(item) {
    detalleAlumno.value = item
    detalleVisible.value = true
    detalle.value = []
    loadingDetalle.value = true
    const alumnoId = item.alumno?.id_usuario ?? item.alumno?.id_alumno ?? item.id_alumno
    try {
        const { data } = await api.get(`/historial/alumno/${alumnoId}/detalle`)
        detalle.value = Array.isArray(data) ? data : (data.historial ?? [])
    } catch (err) {
        const msg = err.response?.data?.message ?? 'Error al cargar el detalle'
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
    } finally {
        loadingDetalle.value = false
    }
}

async function liberar(item) {
    confirm.require({
        message: `¿Liberar a ${item.alumno?.nombre ?? 'este alumno'}? Esta acción es irreversible.`,
        header: 'Confirmar liberación',
        icon: 'pi pi-unlock',
        acceptLabel: 'Sí, liberar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-success',
        accept: async () => {
            liberando.value = item.id_historial
            try {
                await api.put(`/historial/${item.id_historial}/liberar`)
                toast.add({ severity: 'success', summary: 'Liberado', detail: `${item.alumno?.nombre ?? 'Alumno'} liberado correctamente`, life: 3000 })
                await loadHistorial()
            } catch (err) {
                const msg = err.response?.data?.message ?? 'No se pudo liberar al alumno'
                toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
            } finally {
                liberando.value = null
            }
        }
    })
}

onMounted(loadPeriodos)
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────── */
.historial-admin {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* ── Page header ─────────────────────────────────────── */
.page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
.page-header__left { display: flex; align-items: center; gap: 1rem; }
.page-header__icon {
    width: 3rem; height: 3rem; border-radius: 50%;
    background: var(--sisa-primary, #1565C0);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 1.25rem; flex-shrink: 0;
}
.page-header__title { font-size: 1.4rem; font-weight: 700; margin: 0; color: var(--p-text-color, #1e293b); }
.page-header__sub { margin: .2rem 0 0; color: var(--p-text-muted-color, #64748b); font-size: .875rem; }

/* ── Filters ─────────────────────────────────────────── */
.filters-bar {
    display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;
    background: var(--p-content-background, #fff);
    border: 1px solid var(--p-content-border-color, #e2e8f0);
    border-radius: .75rem; padding: 1rem 1.25rem;
}
.filter-group { display: flex; flex-direction: column; gap: .4rem; flex: 1; min-width: 220px; }
.filter-label {
    font-size: .8rem; font-weight: 600;
    color: var(--p-text-muted-color, #64748b);
    text-transform: uppercase; letter-spacing: .04em;
}
.filter-select, .filter-input { width: 100%; }

/* ── State boxes ─────────────────────────────────────── */
.state-box {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 4rem 2rem; text-align: center;
    color: var(--p-text-muted-color, #94a3b8); gap: .5rem;
}
.state-box__icon { font-size: 2.5rem; margin-bottom: .5rem; }
.state-box__title { font-size: 1.1rem; font-weight: 600; color: var(--p-text-color, #475569); margin: 0; }
.state-box__sub { font-size: .875rem; margin: 0; }

/* ── Table ───────────────────────────────────────────── */
.table-wrapper {
    background: var(--p-content-background, #fff);
    border: 1px solid var(--p-content-border-color, #e2e8f0);
    border-radius: .75rem; overflow: hidden;
}
.table-meta {
    display: flex; align-items: center; justify-content: space-between;
    padding: .875rem 1.25rem;
    background: var(--p-surface-50, #f8fafc);
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
    font-size: .875rem; color: var(--p-text-muted-color, #64748b); font-weight: 500;
}
.table-meta__badges { display: flex; gap: .5rem; }

.hist-table-scroll { overflow-x: auto; }
.hist-table { width: 100%; border-collapse: collapse; font-size: .875rem; }
.hist-table thead tr { background: var(--p-surface-100, #f1f5f9); }
.hist-table th {
    padding: .75rem 1rem; text-align: left; font-weight: 600;
    font-size: .78rem; text-transform: uppercase; letter-spacing: .04em;
    color: var(--p-text-muted-color, #64748b); white-space: nowrap;
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
}
.hist-table td {
    padding: .875rem 1rem;
    border-bottom: 1px solid var(--p-content-border-color, #f1f5f9);
    vertical-align: middle; color: var(--p-text-color, #1e293b);
}
.hist-table tbody tr:last-child td { border-bottom: none; }
.hist-table tbody tr:hover td { background: var(--p-surface-50, #f8fafc); }

.td-alumno { min-width: 160px; }
.alumno-name { font-weight: 600; }
.alumno-id { font-size: .78rem; color: var(--p-text-muted-color, #64748b); margin-top: .15rem; }

.td-center { text-align: center; }
.text-muted { color: var(--p-text-muted-color, #94a3b8); }

.td-score { text-align: center; }
.score-badge {
    display: inline-block; background: var(--sisa-tint-green); color: var(--sisa-icon-green);
    font-weight: 700; font-size: .9rem; padding: .2rem .6rem; border-radius: .375rem;
}
.score-none { color: var(--p-text-muted-color, #94a3b8); }

.td-req { min-width: 160px; }
.req-list { display: flex; gap: .4rem; flex-wrap: wrap; }
.req-chip {
    display: inline-flex; align-items: center; gap: .3rem;
    font-size: .75rem; font-weight: 600; padding: .2rem .55rem; border-radius: 999px;
}
.req-chip--ok { background: var(--sisa-tint-green); color: var(--sisa-icon-green); }
.req-chip--no { background: var(--sisa-tint-red);   color: var(--sisa-icon-red);   }
.req-chip .pi { font-size: .7rem; }

.td-actions { display: flex; align-items: center; gap: .4rem; white-space: nowrap; }

.liberado-date {
    display: inline-flex; align-items: center; gap: .4rem;
    color: var(--sisa-icon-green); font-weight: 600; font-size: .82rem;
}

/* ── Detail Dialog ───────────────────────────────────── */
.det-loading {
    display: flex; align-items: center; gap: .75rem;
    padding: 2.5rem; justify-content: center;
    color: var(--p-text-muted-color, #64748b);
}
.det-empty {
    text-align: center; padding: 2rem;
    color: var(--p-text-muted-color, #94a3b8); font-size: .9rem;
}
.det-content { display: flex; flex-direction: column; gap: 1.5rem; }

.det-period {
    border: 1px solid var(--p-content-border-color, #e2e8f0);
    border-radius: .75rem; overflow: hidden;
}
.det-period__header {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 1rem; padding: .875rem 1.25rem; flex-wrap: wrap;
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
}
.det-period--lib { background: var(--sisa-tint-green); border-left: 3px solid var(--sisa-icon-green); }
.det-period--cur { background: var(--sisa-tint-blue);  border-left: 3px solid var(--sisa-primary-l);  }

.det-period__info { display: flex; flex-direction: column; gap: .2rem; }
.det-period__name { font-weight: 700; font-size: 1rem; color: var(--p-text-color, #1e293b); }
.det-period__dates { font-size: .8rem; color: var(--p-text-muted-color, #64748b); }
.det-period__right { display: flex; flex-direction: column; align-items: flex-end; }

.det-meta-row { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: flex-end; }
.det-meta-item {
    font-size: .8rem; color: var(--p-text-muted-color, #64748b);
    display: flex; align-items: center; gap: .35rem;
}

/* Resumen mini bar */
.det-resumen {
    display: flex; align-items: center;
    background: var(--p-surface-50, #f8fafc);
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
}
.det-res-item {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; padding: .5rem .35rem; gap: .1rem;
}
.det-res-div {
    width: 1px; align-self: stretch;
    background: var(--p-content-border-color, #e2e8f0);
}
.det-res-num { font-size: 1rem; font-weight: 700; color: var(--p-text-color, #1e293b); }
.det-res-num--ok    { color: var(--sisa-primary-l);  }
.det-res-num--eval  { color: var(--sisa-icon-green); }
.det-res-num--pend  { color: var(--sisa-icon-amber); }
.det-res-num--score { color: var(--sisa-icon-green); }
.det-res-lbl {
    font-size: .68rem; font-weight: 600;
    color: var(--p-text-muted-color, #64748b);
    text-transform: uppercase; letter-spacing: .03em;
}

/* Calificaciones table inside dialog */
.det-cal-wrap { overflow-x: auto; }
.det-cal-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.det-cal-table th {
    padding: .55rem .875rem; text-align: left; font-weight: 600;
    font-size: .75rem; text-transform: uppercase; letter-spacing: .04em;
    color: var(--p-text-muted-color, #64748b);
    background: var(--p-surface-50, #f8fafc);
    border-bottom: 1px solid var(--p-content-border-color, #e2e8f0);
    white-space: nowrap;
}
.det-cal-table td {
    padding: .65rem .875rem;
    border-bottom: 1px solid var(--p-content-border-color, #f1f5f9);
    color: var(--p-text-color, #1e293b); vertical-align: middle;
}
.det-cal-table tbody tr:last-child td { border-bottom: none; }
.row-eval td { background: var(--sisa-accent-surface); }

.cal-num { font-weight: 700; color: var(--p-text-muted-color, #94a3b8); width: 2rem; }
.cal-fecha { white-space: nowrap; color: var(--p-text-muted-color, #64748b); }
.cal-obs { color: var(--p-text-muted-color, #64748b); font-style: italic; max-width: 200px; }
.cal-score { text-align: center; }

.badge-ok {
    display: inline-flex; align-items: center; gap: .3rem;
    color: var(--sisa-icon-green); font-size: .78rem; font-weight: 600;
    background: var(--sisa-tint-green); padding: .15rem .5rem; border-radius: .375rem; white-space: nowrap;
}
.badge-no {
    display: inline-flex; align-items: center; gap: .3rem;
    color: var(--sisa-icon-red); font-size: .78rem; font-weight: 600;
    background: var(--sisa-tint-red); padding: .15rem .5rem; border-radius: .375rem;
}
.score-pill {
    display: inline-block; background: var(--sisa-tint-green); color: var(--sisa-icon-green);
    font-weight: 700; font-size: .85rem; padding: .2rem .55rem; border-radius: .375rem;
}
.score-none { color: var(--p-text-muted-color, #94a3b8); }

.det-no-cal {
    padding: 1.25rem; text-align: center;
    font-size: .875rem; color: var(--p-text-muted-color, #94a3b8);
    font-style: italic;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 640px) {
    .historial-admin { padding: 1rem; }
    .filters-bar { padding: .875rem 1rem; }
    .filter-group { min-width: 100%; }
    .hist-table th, .hist-table td { padding: .6rem .75rem; }
    .td-actions { flex-direction: column; align-items: flex-start; gap: .3rem; }
    .det-resumen { flex-wrap: wrap; }
}
</style>
