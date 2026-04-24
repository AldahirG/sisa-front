<template>
    <div class="vacantes-admin">
        <Toast />
        <ConfirmDialog />

        <!-- ── Header ───────────────────────────────────────── -->
        <div class="page-header">
            <div class="page-header__left">
                <div class="page-header__icon"><i class="pi pi-briefcase"></i></div>
                <div>
                    <h2 class="page-header__title">Vacantes</h2>
                    <p class="page-header__sub">Gestión de vacantes por período</p>
                </div>
            </div>
            <div class="page-header__actions">
                <Button icon="pi pi-upload" label="Importar" severity="secondary" outlined @click="importDialog = true" />
                <Button icon="pi pi-bolt" label="Asignación automática" severity="warn" outlined @click="autoAsignDialog = true" />
                <Button icon="pi pi-plus" label="Nueva vacante" @click="openCreate" />
            </div>
        </div>

        <!-- ── Filters ───────────────────────────────────────── -->
        <div class="filters-bar">
            <div class="filter-group">
                <label class="filter-label">Período</label>
                <Select
                    v-model="filtroPeriodo"
                    :options="periodos"
                    option-label="nombre"
                    option-value="id_periodo"
                    placeholder="Todos los períodos"
                    show-clear
                    class="filter-select"
                    @change="loadVacantes"
                />
            </div>
            <div class="filter-group">
                <label class="filter-label">Empresa</label>
                <Select
                    v-model="filtroEmpresa"
                    :options="empresas"
                    option-label="nombre"
                    option-value="id_empresa"
                    placeholder="Todas las empresas"
                    show-clear
                    class="filter-select"
                    @change="loadVacantes"
                />
            </div>
            <div class="filter-group">
                <label class="filter-label">Estado</label>
                <Select
                    v-model="filtroActiva"
                    :options="[{ label: 'Activas', value: true }, { label: 'Inactivas', value: false }]"
                    option-label="label"
                    option-value="value"
                    placeholder="Todos"
                    show-clear
                    class="filter-select"
                />
            </div>
            <div class="filter-group filter-group--search">
                <label class="filter-label">Buscar</label>
                <InputText v-model="filtroSearch" placeholder="Vacante o empresa…" class="filter-input" />
            </div>
        </div>

        <!-- ── Loading ───────────────────────────────────────── -->
        <div v-if="loading" class="state-box">
            <i class="pi pi-spin pi-spinner state-box__icon"></i>
            <span>Cargando vacantes…</span>
        </div>

        <!-- ── Empty ─────────────────────────────────────────── -->
        <div v-else-if="groups.length === 0" class="state-box">
            <i class="pi pi-inbox state-box__icon"></i>
            <p class="state-box__title">Sin vacantes</p>
            <p class="state-box__sub">No hay vacantes que coincidan con los filtros actuales.</p>
        </div>

        <!-- ── Grouped sections ───────────────────────────────── -->
        <div v-else class="groups-wrap">
            <div v-for="group in groups" :key="group.periodoId" class="period-group">
                <!-- Group header -->
                <div class="period-group__header" @click="toggleGroup(group.periodoId)">
                    <div class="period-group__info">
                        <span class="period-group__name">{{ group.periodoNombre }}</span>
                        <span class="period-group__dates">{{ group.periodoDates }}</span>
                    </div>
                    <div class="period-group__right">
                        <Tag :value="`${group.vacantes.length} vacante${group.vacantes.length !== 1 ? 's' : ''}`" severity="secondary" />
                        <Button
                            icon="pi pi-plus"
                            size="small"
                            text
                            v-tooltip.top="'Agregar vacante en este período'"
                            @click.stop="openCreateForPeriod(group.periodoId)"
                        />
                        <i class="pi expand-icon" :class="expandedGroups[group.periodoId] ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                    </div>
                </div>

                <!-- Group table -->
                <Transition name="expand">
                    <div v-if="expandedGroups[group.periodoId]" class="period-group__body">
                        <table class="vac-table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Vacante</th>
                                    <th>Carreras</th>
                                    <th>Cupo</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="v in group.vacantes" :key="v.id_categoria">
                                    <td>
                                        <span class="empresa-name">{{ v.empresa?.nombre ?? '—' }}</span>
                                    </td>
                                    <td>
                                        <span class="vac-nombre">{{ v.nombre }}</span>
                                        <span v-if="v.descripcion" class="vac-desc">{{ v.descripcion }}</span>
                                    </td>
                                    <td>
                                        <div class="carreras-wrap">
                                            <span v-for="c in (v.carreras ?? []).slice(0, 3)" :key="c" class="carrera-chip">{{ c }}</span>
                                            <span v-if="(v.carreras ?? []).length > 3" class="carrera-more">+{{ (v.carreras ?? []).length - 3 }}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <Tag
                                            :value="`${v.cupo_disponible ?? '?'} / ${v.cupo_total}`"
                                            :severity="cupoSeverity(v)"
                                        />
                                    </td>
                                    <td>
                                        <Tag
                                            :value="v.activa ? 'Activa' : 'Inactiva'"
                                            :severity="v.activa ? 'success' : 'danger'"
                                        />
                                    </td>
                                    <td class="td-actions">
                                        <Button icon="pi pi-pencil" text size="small" v-tooltip.top="'Editar'" @click="openEdit(v)" />
                                        <Button icon="pi pi-copy" text size="small" v-tooltip.top="'Duplicar a otro período'" @click="openDuplicate(v)" />
                                        <Button
                                            v-if="v.activa"
                                            icon="pi pi-ban"
                                            text
                                            size="small"
                                            severity="warning"
                                            v-tooltip.top="'Desactivar'"
                                            @click="toggleActiva(v, false)"
                                        />
                                        <Button
                                            v-else
                                            icon="pi pi-check-circle"
                                            text
                                            size="small"
                                            severity="success"
                                            v-tooltip.top="'Activar'"
                                            @click="toggleActiva(v, true)"
                                        />
                                        <Button
                                            icon="pi pi-trash"
                                            text
                                            size="small"
                                            severity="danger"
                                            v-tooltip.top="'Eliminar'"
                                            @click="eliminar(v)"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Transition>
            </div>
        </div>

        <!-- ── Create / Edit Dialog ───────────────────────────── -->
        <Dialog
            v-model:visible="formDialog"
            modal
            :header="isEdit ? 'Editar vacante' : 'Nueva vacante'"
            :style="{ width: '680px', maxWidth: '98vw' }"
        >
            <div class="form-grid">
                <div class="form-field">
                    <label>Empresa</label>
                    <Select v-model="form.id_empresa" :options="empresas" option-label="nombre" option-value="id_empresa" placeholder="Selecciona empresa" class="w-full" />
                </div>
                <div class="form-field">
                    <label>Período</label>
                    <Select v-model="form.id_periodo" :options="periodos" option-label="nombre" option-value="id_periodo" placeholder="Selecciona período" :disabled="isEdit" class="w-full" />
                </div>
                <div class="form-field">
                    <label>Nombre de la vacante</label>
                    <InputText v-model="form.nombre" class="w-full" />
                </div>
                <div class="form-field">
                    <label>Cupo total</label>
                    <InputNumber v-model="form.cupo_total" :min="1" show-buttons class="w-full" />
                </div>
                <div class="form-field form-field--full">
                    <label>Carreras permitidas</label>
                    <MultiSelect
                        v-model="form.carreras"
                        :options="carrerasCatalogo"
                        option-label="nombre_completo"
                        option-value="nombre"
                        placeholder="Selecciona carreras"
                        display="chip"
                        filter
                        class="w-full"
                    />
                </div>
                <div class="form-field form-field--full">
                    <label>Descripción</label>
                    <Textarea v-model="form.descripcion" rows="3" class="w-full" />
                </div>
                <div class="form-field form-field--full">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="form.activa" class="form-checkbox" />
                        Vacante activa
                    </label>
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text @click="formDialog = false" />
                <Button label="Guardar" icon="pi pi-check" :loading="saving" @click="saveVacante" />
            </template>
        </Dialog>

        <!-- ── Duplicate Dialog ───────────────────────────────── -->
        <Dialog
            v-model:visible="dupDialog"
            modal
            header="Duplicar vacante"
            :style="{ width: '460px', maxWidth: '98vw' }"
        >
            <div v-if="dupTarget" class="dup-info">
                <span class="dup-nombre">{{ dupTarget.nombre }}</span>
                <span class="dup-empresa">{{ dupTarget.empresa?.nombre }}</span>
            </div>
            <div class="form-grid">
                <div class="form-field form-field--full">
                    <label>Período destino</label>
                    <Select
                        v-model="dupForm.id_periodo_destino"
                        :options="periodos"
                        option-label="nombre"
                        option-value="id_periodo"
                        placeholder="Selecciona período"
                        class="w-full"
                    />
                </div>
                <div class="form-field">
                    <label>Cupo (opcional)</label>
                    <InputNumber v-model="dupForm.cupo_total" :min="1" placeholder="Mismo que original" show-buttons class="w-full" />
                </div>
                <div class="form-field form-field--full">
                    <label class="checkbox-label">
                        <input type="checkbox" v-model="dupForm.activa" class="form-checkbox" />
                        Activar al duplicar
                    </label>
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text @click="dupDialog = false" />
                <Button label="Duplicar" icon="pi pi-copy" :loading="saving" @click="duplicar" />
            </template>
        </Dialog>

        <!-- ── Import Dialog ──────────────────────────────────── -->
        <Dialog
            v-model:visible="importDialog"
            modal
            header="Importar vacantes"
            :style="{ width: '500px', maxWidth: '98vw' }"
        >
            <div class="import-body">
                <p class="import-hint">
                    Sube un archivo <strong>CSV o XLSX</strong>. Columnas requeridas:<br>
                    <code>id_empresa, nombre, descripcion, cupo_total, carreras, id_periodo</code><br>
                    La columna <code>carreras</code> usa separador <code>;</code>, <code>,</code> o <code>|</code>.
                </p>
                <div class="form-field form-field--full">
                    <label>Período (fallback si el archivo no lo incluye)</label>
                    <Select
                        v-model="importForm.id_periodo"
                        :options="periodos"
                        option-label="nombre"
                        option-value="id_periodo"
                        placeholder="Selecciona período"
                        class="w-full"
                    />
                </div>
                <div class="form-field form-field--full">
                    <label>Archivo CSV / XLSX</label>
                    <input type="file" accept=".csv,.xlsx" class="file-input" @change="onFileChange" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text @click="importDialog = false" />
                <Button label="Importar" icon="pi pi-upload" :loading="saving" :disabled="!importForm.archivo" @click="importarVacantes" />
            </template>
        </Dialog>

        <!-- ── Auto-assign Dialog ─────────────────────────────── -->
        <Dialog
            v-model:visible="autoAsignDialog"
            modal
            header="Asignación automática"
            :style="{ width: '600px', maxWidth: '98vw' }"
        >
            <div v-if="!autoAsignResult" class="autoasign-confirm">
                <div class="autoasign-icon"><i class="pi pi-bolt"></i></div>
                <p class="autoasign-desc">
                    Esta acción cerrará las postulaciones y ejecutará la asignación automática:<br>
                    · Acepta alumnos <strong>POSTULADO</strong> con cupo disponible.<br>
                    · Asigna empresa por carrera a alumnos sin postulación.<br>
                    ¿Continuar?
                </p>
            </div>
            <div v-else class="autoasign-result">
                <div class="autoasign-stats">
                    <div class="astat">
                        <span class="astat-num astat--ok">{{ autoAsignResult.aceptados }}</span>
                        <span class="astat-lbl">Aceptados</span>
                    </div>
                    <div class="astat">
                        <span class="astat-num astat--asig">{{ autoAsignResult.asignados }}</span>
                        <span class="astat-lbl">Asignados auto</span>
                    </div>
                    <div class="astat">
                        <span class="astat-num astat--none">{{ autoAsignResult.sin_empresa }}</span>
                        <span class="astat-lbl">Sin empresa</span>
                    </div>
                </div>
                <div class="asign-detail-wrap">
                    <table class="asign-table">
                        <thead>
                            <tr>
                                <th>Alumno</th>
                                <th>Acción</th>
                                <th>Empresa / Carrera</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="d in autoAsignResult.detalle" :key="d.alumno_id">
                                <td>{{ d.alumno_id }}</td>
                                <td>
                                    <Tag
                                        :value="accionLabel(d.accion)"
                                        :severity="accionSeverity(d.accion)"
                                    />
                                </td>
                                <td>{{ d.empresa ?? d.carrera ?? '—' }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <template #footer>
                <Button label="Cerrar" text @click="closeAutoAsign" />
                <Button
                    v-if="!autoAsignResult"
                    label="Ejecutar asignación"
                    icon="pi pi-bolt"
                    severity="warn"
                    :loading="saving"
                    @click="ejecutarAutoAsign"
                />
            </template>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api/axios'
import { useCarreras } from '@/composables/useCarreras'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import MultiSelect from 'primevue/multiselect'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

const toast   = useToast()
const confirm = useConfirm()

// ── State ─────────────────────────────────────────────
const vacantes      = ref([])
const periodos      = ref([])
const empresas      = ref([])
const loading       = ref(false)
const saving        = ref(false)

// Filters
const filtroPeriodo = ref(null)
const filtroEmpresa = ref(null)
const filtroActiva  = ref(null)
const filtroSearch  = ref('')

// Expand/collapse groups
const expandedGroups = ref({})

// Dialogs
const formDialog      = ref(false)
const dupDialog       = ref(false)
const importDialog    = ref(false)
const autoAsignDialog = ref(false)
const isEdit          = ref(false)
const dupTarget       = ref(null)
const autoAsignResult = ref(null)

// Forms
const form = ref(resetForm())
const dupForm = ref({ id_periodo_destino: null, cupo_total: null, activa: true })
const importForm = ref({ id_periodo: null, archivo: null })

// ── Carreras (desde API /carreras, cacheado) ──────────
const { carreras: carrerasCatalogo } = useCarreras()

// ── Computed ──────────────────────────────────────────
const vacantesFiltered = computed(() => {
    let list = vacantes.value
    if (filtroActiva.value !== null) list = list.filter(v => v.activa === filtroActiva.value)
    const q = filtroSearch.value.trim().toLowerCase()
    if (q) list = list.filter(v =>
        (v.nombre ?? '').toLowerCase().includes(q) ||
        (v.empresa?.nombre ?? '').toLowerCase().includes(q)
    )
    return list
})

const groups = computed(() => {
    const map = new Map()
    for (const v of vacantesFiltered.value) {
        const pid = v.periodo?.id_periodo ?? 'sin-periodo'
        if (!map.has(pid)) {
            const p = v.periodo
            map.set(pid, {
                periodoId: pid,
                periodoNombre: p?.nombre ?? 'Sin período',
                periodoDates: p
                    ? `${formatDate(p.fecha_inicio)} — ${formatDate(p.fecha_fin)}`
                    : '',
                periodoEstado: p?.estado ?? '',
                vacantes: []
            })
        }
        map.get(pid).vacantes.push(v)
    }
    // Sort: active first, then by nombre desc
    return [...map.values()].sort((a, b) => {
        if (a.periodoEstado === 'activo' && b.periodoEstado !== 'activo') return -1
        if (b.periodoEstado === 'activo' && a.periodoEstado !== 'activo') return 1
        return b.periodoNombre.localeCompare(a.periodoNombre)
    })
})

// ── Helpers ───────────────────────────────────────────
function resetForm() {
    return {
        id_categoria: null,
        id_empresa: null,
        id_periodo: null,
        nombre: '',
        descripcion: '',
        cupo_total: 1,
        activa: true,
        carreras: []
    }
}

function formatDate(d) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function cupoSeverity(v) {
    const disp = v.cupo_disponible ?? v.cupo_total
    if (disp === 0)  return 'danger'
    if (disp <= 2)   return 'warn'
    return 'success'
}

function toggleGroup(pid) {
    expandedGroups.value[pid] = !expandedGroups.value[pid]
}

function accionLabel(accion) {
    const map = { aceptado_automatico: 'Aceptado', asignado_automatico: 'Asignado', sin_empresa_disponible: 'Sin empresa' }
    return map[accion] ?? accion
}

function accionSeverity(accion) {
    if (accion === 'aceptado_automatico') return 'success'
    if (accion === 'asignado_automatico') return 'info'
    return 'danger'
}

// ── API ───────────────────────────────────────────────
async function loadVacantes() {
    loading.value = true
    try {
        const params = {}
        if (filtroPeriodo.value) params.periodoId = filtroPeriodo.value
        if (filtroEmpresa.value) params.empresaId = filtroEmpresa.value
        const { data } = await api.get('/vacantes', { params })
        vacantes.value = Array.isArray(data) ? data : (data.vacantes ?? [])
        // Auto-expand first group
        if (groups.value.length > 0 && Object.keys(expandedGroups.value).length === 0) {
            expandedGroups.value[groups.value[0].periodoId] = true
        }
    } catch (err) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las vacantes', life: 3000 })
    } finally {
        loading.value = false
    }
}

async function loadCatalogos() {
    const [pRes, eRes] = await Promise.all([api.get('/periodos'), api.get('/empresas')])
    periodos.value = Array.isArray(pRes.data) ? pRes.data : (pRes.data.periodos ?? [])
    empresas.value = Array.isArray(eRes.data) ? eRes.data : (eRes.data.empresas ?? [])
}

// ── CRUD ──────────────────────────────────────────────
function openCreate() {
    isEdit.value = false
    form.value = resetForm()
    formDialog.value = true
}

function openCreateForPeriod(periodoId) {
    isEdit.value = false
    form.value = { ...resetForm(), id_periodo: periodoId }
    formDialog.value = true
}

function openEdit(v) {
    isEdit.value = true
    form.value = {
        id_categoria: v.id_categoria,
        id_empresa:   v.empresa?.id_empresa ?? null,
        id_periodo:   v.periodo?.id_periodo ?? null,
        nombre:       v.nombre ?? '',
        descripcion:  v.descripcion ?? '',
        cupo_total:   v.cupo_total ?? 1,
        activa:       v.activa ?? true,
        carreras:     v.carreras ?? []
    }
    formDialog.value = true
}

async function saveVacante() {
    if (!form.value.id_empresa || !form.value.id_periodo || !form.value.nombre) {
        toast.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Empresa, período y nombre son obligatorios', life: 3000 })
        return
    }
    saving.value = true
    try {
        if (isEdit.value) {
            await api.put(`/vacantes/${form.value.id_categoria}`, form.value)
            toast.add({ severity: 'success', summary: 'Vacante actualizada', life: 3000 })
        } else {
            await api.post('/vacantes', form.value)
            toast.add({ severity: 'success', summary: 'Vacante creada', life: 3000 })
        }
        formDialog.value = false
        await loadVacantes()
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message ?? 'Error al guardar', life: 5000 })
    } finally {
        saving.value = false
    }
}

async function toggleActiva(v, activa) {
    const endpoint = activa ? `/vacantes/${v.id_categoria}/activar` : `/vacantes/${v.id_categoria}/desactivar`
    try {
        await api.put(endpoint)
        toast.add({ severity: 'success', summary: activa ? 'Activada' : 'Desactivada', life: 2500 })
        await loadVacantes()
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message ?? 'No se pudo actualizar', life: 4000 })
    }
}

async function eliminar(v) {
    confirm.require({
        message: `¿Eliminar la vacante "${v.nombre}"? Solo es posible si no tiene alumnos asignados.`,
        header: 'Confirmar eliminación',
        icon: 'pi pi-trash',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await api.delete(`/vacantes/${v.id_categoria}`)
                toast.add({ severity: 'success', summary: 'Vacante eliminada', life: 3000 })
                await loadVacantes()
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message ?? 'No se pudo eliminar', life: 5000 })
            }
        }
    })
}

// ── Duplicate ─────────────────────────────────────────
function openDuplicate(v) {
    dupTarget.value = v
    dupForm.value = { id_periodo_destino: null, cupo_total: null, activa: true }
    dupDialog.value = true
}

async function duplicar() {
    if (!dupForm.value.id_periodo_destino) {
        toast.add({ severity: 'warn', summary: 'Selecciona un período destino', life: 3000 })
        return
    }
    saving.value = true
    const body = { id_periodo_destino: dupForm.value.id_periodo_destino, activa: dupForm.value.activa }
    if (dupForm.value.cupo_total) body.cupo_total = dupForm.value.cupo_total
    try {
        await api.post(`/vacantes/${dupTarget.value.id_categoria}/duplicar`, body)
        toast.add({ severity: 'success', summary: 'Vacante duplicada', life: 3000 })
        dupDialog.value = false
        await loadVacantes()
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message ?? 'Error al duplicar', life: 5000 })
    } finally {
        saving.value = false
    }
}

// ── Import ────────────────────────────────────────────
function onFileChange(e) {
    importForm.value.archivo = e.target.files[0] ?? null
}

async function importarVacantes() {
    if (!importForm.value.archivo) return
    saving.value = true
    try {
        const fd = new FormData()
        fd.append('archivo', importForm.value.archivo)
        const params = importForm.value.id_periodo ? { periodoId: importForm.value.id_periodo } : {}
        const { data } = await api.post('/vacantes/importar', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
            params
        })
        const count = data?.importadas ?? data?.count ?? '?'
        toast.add({ severity: 'success', summary: 'Importación exitosa', detail: `${count} vacantes importadas`, life: 4000 })
        importDialog.value = false
        importForm.value = { id_periodo: null, archivo: null }
        await loadVacantes()
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error al importar', detail: e.response?.data?.message ?? 'Verifica el formato del archivo', life: 6000 })
    } finally {
        saving.value = false
    }
}

// ── Auto-assign ───────────────────────────────────────
async function ejecutarAutoAsign() {
    saving.value = true
    try {
        const { data } = await api.post('/postulaciones/asignacion-automatica')
        autoAsignResult.value = data
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message ?? 'Error en asignación automática', life: 5000 })
    } finally {
        saving.value = false
    }
}

function closeAutoAsign() {
    autoAsignDialog.value = false
    autoAsignResult.value = null
    if (autoAsignResult.value) loadVacantes()
}

onMounted(async () => {
    await loadCatalogos()
    await loadVacantes()
})
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────── */
.vacantes-admin {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* ── Header ─────────────────────────────────────────── */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
}
.page-header__left {
    display: flex;
    align-items: center;
    gap: 1rem;
}
.page-header__icon {
    width: 3rem; height: 3rem; border-radius: 50%;
    background: var(--sisa-primary, #0F3C61);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 1.25rem; flex-shrink: 0;
}
.page-header__title { font-size: 1.4rem; font-weight: 700; margin: 0; color: var(--p-text-color); }
.page-header__sub { margin: .2rem 0 0; color: var(--p-text-muted-color); font-size: .875rem; }
.page-header__actions { display: flex; gap: .75rem; flex-wrap: wrap; }

/* ── Filters ─────────────────────────────────────────── */
.filters-bar {
    display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end;
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: .75rem; padding: 1rem 1.25rem;
}
.filter-group { display: flex; flex-direction: column; gap: .4rem; flex: 1; min-width: 180px; }
.filter-group--search { min-width: 220px; }
.filter-label {
    font-size: .78rem; font-weight: 600;
    color: var(--p-text-muted-color);
    text-transform: uppercase; letter-spacing: .04em;
}
.filter-select, .filter-input { width: 100%; }

/* ── State boxes ─────────────────────────────────────── */
.state-box {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 4rem 2rem; text-align: center;
    color: var(--p-text-muted-color); gap: .5rem;
}
.state-box__icon { font-size: 2.5rem; margin-bottom: .5rem; }
.state-box__title { font-size: 1.1rem; font-weight: 600; color: var(--p-text-color); margin: 0; }
.state-box__sub { font-size: .875rem; margin: 0; }

/* ── Groups ──────────────────────────────────────────── */
.groups-wrap { display: flex; flex-direction: column; gap: 1rem; }

.period-group {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: .75rem;
    overflow: hidden;
}
.period-group__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: .875rem 1.25rem;
    background: var(--p-surface-50, #f8fafc);
    border-bottom: 1px solid var(--p-content-border-color);
    cursor: pointer;
    user-select: none;
    gap: .75rem;
    flex-wrap: wrap;
}
.period-group__info { display: flex; flex-direction: column; gap: .15rem; }
.period-group__name { font-weight: 700; font-size: 1rem; color: var(--p-text-color); }
.period-group__dates { font-size: .8rem; color: var(--p-text-muted-color); }
.period-group__right { display: flex; align-items: center; gap: .5rem; }
.expand-icon { color: var(--p-text-muted-color); font-size: .85rem; transition: transform .2s; }

/* ── Table ───────────────────────────────────────────── */
.period-group__body { overflow-x: auto; }
.vac-table { width: 100%; border-collapse: collapse; font-size: .875rem; }
.vac-table th {
    padding: .6rem 1rem; text-align: left; font-weight: 600;
    font-size: .75rem; text-transform: uppercase; letter-spacing: .04em;
    color: var(--p-text-muted-color);
    background: var(--p-surface-100, #f1f5f9);
    border-bottom: 1px solid var(--p-content-border-color);
    white-space: nowrap;
}
.vac-table td {
    padding: .8rem 1rem;
    border-bottom: 1px solid var(--p-content-border-color);
    color: var(--p-text-color); vertical-align: middle;
}
.vac-table tbody tr:last-child td { border-bottom: none; }
.vac-table tbody tr:hover td { background: var(--p-surface-50, #f8fafc); }

.empresa-name { font-weight: 600; }
.vac-nombre { font-weight: 500; display: block; }
.vac-desc {
    display: block; font-size: .78rem; color: var(--p-text-muted-color);
    margin-top: .15rem; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; max-width: 200px;
}

/* Carreras */
.carreras-wrap { display: flex; flex-wrap: wrap; gap: .25rem; }
.carrera-chip {
    display: inline-block; font-size: .7rem; font-weight: 600;
    padding: .15rem .45rem; border-radius: 999px;
    background: var(--sisa-tint-blue); color: var(--sisa-icon-blue);
}
.carrera-more {
    display: inline-block; font-size: .7rem; font-weight: 600;
    padding: .15rem .45rem; border-radius: 999px;
    background: var(--p-surface-100, #f1f5f9); color: var(--p-text-muted-color);
}

.td-actions { display: flex; align-items: center; gap: .15rem; }

/* ── Expand transition ───────────────────────────────── */
.expand-enter-active, .expand-leave-active {
    transition: opacity .2s, max-height .25s ease;
    max-height: 2000px; overflow: hidden;
}
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }

/* ── Form ────────────────────────────────────────────── */
.form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    padding-top: .5rem;
}
.form-field { display: flex; flex-direction: column; gap: .4rem; }
.form-field--full { grid-column: 1 / -1; }
.form-field label {
    font-size: .8rem; font-weight: 600;
    color: var(--p-text-muted-color);
    text-transform: uppercase; letter-spacing: .04em;
}
.checkbox-label {
    display: flex; align-items: center; gap: .5rem;
    font-size: .875rem; font-weight: 500; color: var(--p-text-color);
    cursor: pointer;
}
.form-checkbox { width: 1rem; height: 1rem; cursor: pointer; }
.w-full { width: 100%; }

/* File input */
.file-input {
    border: 1px solid var(--p-content-border-color);
    border-radius: .375rem; padding: .4rem .6rem;
    font-size: .875rem; color: var(--p-text-color);
    background: var(--p-content-background);
    width: 100%;
}

/* ── Duplicate ───────────────────────────────────────── */
.dup-info {
    display: flex; flex-direction: column; gap: .2rem;
    padding: .75rem 1rem; margin-bottom: 1rem;
    background: var(--p-surface-50, #f8fafc);
    border: 1px solid var(--p-content-border-color);
    border-radius: .5rem;
}
.dup-nombre { font-weight: 700; font-size: 1rem; color: var(--p-text-color); }
.dup-empresa { font-size: .875rem; color: var(--p-text-muted-color); }

/* ── Import hint ─────────────────────────────────────── */
.import-body { display: flex; flex-direction: column; gap: 1.25rem; }
.import-hint {
    font-size: .875rem; color: var(--p-text-muted-color); line-height: 1.6;
    padding: .75rem 1rem;
    background: var(--p-surface-50, #f8fafc);
    border: 1px solid var(--p-content-border-color);
    border-radius: .5rem;
}
.import-hint code {
    background: var(--p-surface-100, #f1f5f9);
    padding: .1rem .35rem; border-radius: .25rem;
    font-family: monospace; font-size: .82rem;
}

/* ── Auto-assign ─────────────────────────────────────── */
.autoasign-confirm { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 1rem 0; text-align: center; }
.autoasign-icon {
    width: 4rem; height: 4rem; border-radius: 50%;
    background: var(--sisa-tint-amber); color: var(--sisa-icon-amber);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.75rem;
}
.autoasign-desc { font-size: .9rem; color: var(--p-text-muted-color); line-height: 1.7; }

.autoasign-result { display: flex; flex-direction: column; gap: 1rem; }
.autoasign-stats { display: flex; gap: 1rem; }
.astat { flex: 1; display: flex; flex-direction: column; align-items: center; gap: .25rem;
    padding: 1rem; background: var(--p-surface-50, #f8fafc);
    border: 1px solid var(--p-content-border-color); border-radius: .5rem; }
.astat-num { font-size: 1.75rem; font-weight: 700; }
.astat-lbl { font-size: .75rem; font-weight: 600; color: var(--p-text-muted-color); text-transform: uppercase; }
.astat--ok   { color: var(--sisa-icon-green); }
.astat--asig { color: var(--sisa-primary-l);  }
.astat--none { color: var(--sisa-icon-red);   }

.asign-detail-wrap { overflow-x: auto; max-height: 300px; overflow-y: auto; border: 1px solid var(--p-content-border-color); border-radius: .5rem; }
.asign-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.asign-table th {
    padding: .5rem .75rem; text-align: left; font-weight: 600;
    font-size: .75rem; text-transform: uppercase; letter-spacing: .04em;
    color: var(--p-text-muted-color);
    background: var(--p-surface-50, #f8fafc);
    border-bottom: 1px solid var(--p-content-border-color);
    position: sticky; top: 0;
}
.asign-table td { padding: .6rem .75rem; border-bottom: 1px solid var(--p-content-border-color); color: var(--p-text-color); }
.asign-table tbody tr:last-child td { border-bottom: none; }

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 640px) {
    .vacantes-admin { padding: 1rem; }
    .page-header { flex-direction: column; align-items: flex-start; }
    .page-header__actions { width: 100%; justify-content: flex-start; }
    .filters-bar { padding: .875rem 1rem; }
    .filter-group { min-width: 100%; }
    .form-grid { grid-template-columns: 1fr; }
    .autoasign-stats { flex-direction: column; }
}
</style>
