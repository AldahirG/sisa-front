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
                                <tr v-for="v in group.vacantes" :key="v.id_categoria" :class="cupoRowClass(v)">
                                    <td>
                                        <span class="empresa-name">{{ v.empresa?.nombre ?? '—' }}</span>
                                    </td>
                                    <td>
                                        <span class="vac-nombre">{{ v.nombre }}</span>
                                        <span v-if="v.descripcion" class="vac-desc">{{ v.descripcion }}</span>
                                        <div class="vac-meta">
                                            <span class="vac-badge" :class="`vac-badge--${v.modalidad ?? 'presencial'}`">
                                                <i :class="`pi ${v.modalidad === 'remoto' ? 'pi-home' : v.modalidad === 'hibrido' ? 'pi-sync' : 'pi-building'}`" />
                                                {{ v.modalidad === 'remoto' ? 'Remoto' : v.modalidad === 'hibrido' ? 'Híbrido' : 'Presencial' }}
                                            </span>
                                            <span v-if="v.tiene_remuneracion" class="vac-badge vac-badge--rem">
                                                <i class="pi pi-dollar" />
                                                {{ v.monto_remuneracion != null ? v.monto_remuneracion.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }) : 'Remunerada' }}
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="carreras-wrap">
                                            <span v-for="c in (v.carreras ?? []).slice(0, 3)" :key="c" class="carrera-chip">{{ c }}</span>
                                            <span v-if="(v.carreras ?? []).length > 3" class="carrera-more">+{{ (v.carreras ?? []).length - 3 }}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="cupo-cell">
                                            <span class="cupo-badge" :class="`cupo-badge--${cupoRowClass(v)}`">
                                                <i :class="(v.cupo_disponible ?? 0) === 0 ? 'pi pi-ban' : (v.cupo_disponible ?? 0) === 1 ? 'pi pi-exclamation-circle' : 'pi pi-users'" />
                                                {{ cupoLabel(v) }}
                                            </span>
                                            <span class="cupo-fraction">{{ v.cupo_disponible ?? 0 }} de {{ v.cupo_total }} lugares</span>
                                        </div>
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
                <div class="form-field">
                    <label>Modalidad</label>
                    <Select
                        v-model="form.modalidad"
                        :options="modalidadOpts"
                        option-label="label"
                        option-value="value"
                        class="w-full"
                    />
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
                <!-- Remuneración -->
                <div class="form-field form-field--full">
                    <div class="toggle-row">
                        <div class="toggle-row__info">
                            <span class="toggle-row__label">Remuneración económica</span>
                            <span class="toggle-row__hint">¿Esta vacante ofrece pago al alumno?</span>
                        </div>
                        <ToggleSwitch v-model="form.tiene_remuneracion" />
                    </div>
                </div>
                <div v-if="form.tiene_remuneracion" class="form-field">
                    <label>Monto mensual (MXN)</label>
                    <InputNumber
                        v-model="form.monto_remuneracion"
                        mode="currency"
                        currency="MXN"
                        locale="es-MX"
                        :min="0"
                        class="w-full"
                    />
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
                        :options="periodosParaDuplicar"
                        option-label="nombre"
                        option-value="id_periodo"
                        placeholder="Selecciona período"
                        class="w-full"
                    >
                        <template #option="{ option }">
                            <div class="dup-periodo-opt">
                                <span>{{ option.nombre }}</span>
                                <span v-if="option.estado === 'activo'" class="dup-periodo-badge">● Activo</span>
                            </div>
                        </template>
                    </Select>
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
                                <th>Matrícula</th>
                                <th>Nombre</th>
                                <th>Vacante</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="d in autoAsignResult.detalle.slice(0, 10)" :key="d.alumno_id">
                                <td class="mono">{{ d.matricula ?? d.alumno_id }}</td>
                                <td>{{ d.nombre ?? '—' }}</td>
                                <td class="td-empresa">
                                    <span v-if="d.vacante_nombre">{{ d.vacante_nombre }}</span>
                                    <span v-else-if="d.empresa" class="text-muted">{{ d.empresa }}</span>
                                    <span v-else-if="d.carrera" class="text-muted">{{ d.carrera }}</span>
                                    <span v-else>—</span>
                                </td>
                                <td>
                                    <Tag
                                        :value="accionLabel(d.accion)"
                                        :severity="accionSeverity(d.accion)"
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div v-if="autoAsignResult.detalle.length > 10" class="asign-more">
                        <span>y {{ autoAsignResult.detalle.length - 10 }} más...</span>
                        <RouterLink to="/admin/control-academico" class="asign-more-link" @click="closeAutoAsign">
                            Ver todos en Control Académico →
                        </RouterLink>
                    </div>
                    <div v-if="autoAsignResult.detalle.length <= 10 && autoAsignResult.detalle.length > 0" class="asign-more">
                        <RouterLink to="/admin/control-academico" class="asign-more-link" @click="closeAutoAsign">
                            Ver en Control Académico →
                        </RouterLink>
                    </div>
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
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from '@/composables/useAppToast'
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

const modalidadOpts = [
    { label: 'Presencial', value: 'presencial', icon: 'pi-building' },
    { label: 'Remoto',     value: 'remoto',     icon: 'pi-home'     },
    { label: 'Híbrido',    value: 'hibrido',    icon: 'pi-sync'     }
]

// Periodos disponibles para duplicar: excluye el origen, activo primero
const periodosParaDuplicar = computed(() => {
    const origenId = dupTarget.value?.periodo?.id_periodo ?? null
    return [...periodos.value]
        .filter(p => p.id_periodo !== origenId)
        .sort((a, b) => {
            if (a.estado === 'activo' && b.estado !== 'activo') return -1
            if (b.estado === 'activo' && a.estado !== 'activo') return 1
            return 0
        })
})

// ── Computed ──────────────────────────────────────────
const vacantesFiltered = computed(() => {
    let list = vacantes.value
    if (filtroPeriodo.value) list = list.filter(v => v.periodo?.id_periodo === filtroPeriodo.value)
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
        carreras: [],
        modalidad: 'presencial',
        tiene_remuneracion: false,
        monto_remuneracion: null
    }
}

function formatDate(d) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function cupoSeverity(v) {
    const disp = v.cupo_disponible ?? v.cupo_total
    if (disp === 0)  return 'danger'
    if (disp === 1)  return 'danger'
    if (disp <= 2)   return 'warn'
    return 'success'
}

function cupoLabel(v) {
    const disp = v.cupo_disponible ?? 0
    if (disp === 0) return 'Completo'
    if (disp === 1) return 'Último lugar'
    if (disp <= 2)  return 'Quedan pocos'
    return `${disp} disponibles`
}

function cupoRowClass(v) {
    const disp = v.cupo_disponible ?? 0
    if (disp === 0) return 'row-full'
    if (disp === 1) return 'row-last'
    if (disp <= 2)  return 'row-few'
    return 'row-ok'
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
        id_categoria:       v.id_categoria,
        id_empresa:         v.empresa?.id_empresa ?? null,
        id_periodo:         v.periodo?.id_periodo ?? null,
        nombre:             v.nombre ?? '',
        descripcion:        v.descripcion ?? '',
        cupo_total:         v.cupo_total ?? 1,
        activa:             v.activa ?? true,
        carreras:           v.carreras ?? [],
        modalidad:          v.modalidad ?? 'presencial',
        tiene_remuneracion: !!v.tiene_remuneracion,
        monto_remuneracion: v.monto_remuneracion != null ? parseFloat(v.monto_remuneracion) : null
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
        const payload = { ...form.value }
        if (!payload.tiene_remuneracion || payload.monto_remuneracion == null) delete payload.monto_remuneracion

        if (isEdit.value) {
            await api.put(`/vacantes/${payload.id_categoria}`, payload)
            toast.add({ severity: 'success', summary: 'Vacante actualizada', life: 3000 })
        } else {
            await api.post('/vacantes', payload)
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
async function openDuplicate(v) {
    dupTarget.value = v
    await loadCatalogos()   // refresca periodos para evitar nombre desactualizado
    const activo = periodos.value.find(p => p.estado === 'activo' && p.id_periodo !== v.periodo?.id_periodo)
    dupForm.value = { id_periodo_destino: activo?.id_periodo ?? null, cupo_total: null, activa: true }
    dupDialog.value = true
}

async function duplicar() {
    if (!dupForm.value.id_periodo_destino) {
        toast.add({ severity: 'warn', summary: 'Selecciona un período destino', life: 3000 })
        return
    }
    saving.value = true
    const destPeriodoId = dupForm.value.id_periodo_destino
    const body = { id_periodo_destino: destPeriodoId, activa: dupForm.value.activa }
    if (dupForm.value.cupo_total) body.cupo_total = dupForm.value.cupo_total
    try {
        await api.post(`/vacantes/${dupTarget.value.id_categoria}/duplicar`, body)
        const periodoNombre = periodos.value.find(p => p.id_periodo === destPeriodoId)?.nombre ?? 'el período destino'
        toast.add({
            severity: 'success',
            summary: 'Vacante duplicada',
            detail: dupForm.value.activa
                ? `Activa en "${periodoNombre}". Viendo todas las vacantes de ese período.`
                : `Creada como inactiva en "${periodoNombre}". Actívala cuando quieras publicarla.`,
            life: 5000
        })
        dupDialog.value = false
        // Filtrar al periodo destino → el admin ve TODAS sus vacantes (no solo la recién duplicada)
        filtroPeriodo.value = destPeriodoId
        await loadVacantes()
        // Expandir el grupo destino (puede ser nuevo, no estaba en expandedGroups)
        expandedGroups.value[destPeriodoId] = true
    } catch (e) {
        const raw = e.response?.data?.message
        const msg = Array.isArray(raw) ? raw[0] : (raw ?? 'Error al duplicar')
        toast.add({ severity: 'error', summary: 'Error al duplicar', detail: msg, life: 6000 })
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
    const activo = periodos.value.find(p => p.estado === 'activo')
    if (activo) filtroPeriodo.value = activo.id_periodo
    await loadVacantes()
})
</script>

<style scoped>
/* ── Duplicate dialog ────────────────────────────────── */
.dup-periodo-opt { display: flex; align-items: center; gap: .5rem; justify-content: space-between; }
.dup-periodo-badge { font-size: .72rem; font-weight: 600; color: var(--sisa-primary); background: var(--sisa-tint-1, #e8f5e9); padding: .1rem .45rem; border-radius: 99px; }

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
    overflow: clip;
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
/* Row color coding by availability */
.vac-table tbody tr { border-left: 3px solid transparent; }
.vac-table tbody tr.row-ok   { border-left-color: #16a34a; }
.vac-table tbody tr.row-few  { border-left-color: #d97706; }
.vac-table tbody tr.row-last { border-left-color: #dc2626; }
.vac-table tbody tr.row-full {
    border-left-color: #9ca3af;
    opacity: 0.6;
}
.vac-table tbody tr.row-full td { color: var(--p-text-muted-color); }

.vac-table tbody tr:last-child td { border-bottom: none; }
.vac-table tbody tr:not(.row-full):hover td { background: var(--p-surface-50, #f8fafc); }

/* Cupo cell */
.cupo-cell { display: flex; flex-direction: column; gap: .15rem; }
.cupo-badge {
    display: inline-flex; align-items: center; gap: .3rem;
    font-size: .75rem; font-weight: 600; padding: .2rem .55rem;
    border-radius: 999px; width: fit-content;
}
.cupo-badge--row-ok   { background: rgba(22,163,74,.12);  color: #16a34a; }
.cupo-badge--row-few  { background: rgba(217,119,6,.12);  color: #d97706; }
.cupo-badge--row-last { background: rgba(220,38,38,.12);  color: #dc2626; }
.cupo-badge--row-full { background: rgba(156,163,175,.15); color: #6b7280; }
.cupo-fraction {
    font-size: .72rem; color: var(--p-text-muted-color);
    padding-left: .1rem;
}

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
.asign-table .mono { font-family: monospace; font-size: .8rem; }
.asign-table .td-empresa { max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.asign-table .text-muted { color: var(--p-text-muted-color); }
.asign-more { display: flex; align-items: center; justify-content: space-between; padding: .5rem .75rem; font-size: .82rem; color: var(--p-text-muted-color); border-top: 1px solid var(--p-content-border-color); }
.asign-more-link { color: var(--sisa-primary-l); text-decoration: none; font-weight: 500; }
.asign-more-link:hover { text-decoration: underline; }

/* ── Vacante meta badges ─────────────────────────────── */
.vac-meta {
    display: flex; gap: .35rem; margin-top: .35rem; flex-wrap: wrap;
}
.vac-badge {
    display: inline-flex; align-items: center; gap: .3rem;
    font-size: .7rem; font-weight: 600; padding: .15rem .45rem;
    border-radius: 999px;
}
.vac-badge--presencial {
    background: var(--sisa-tint-blue, #e8f1fb); color: var(--sisa-icon-blue, #1c6aac);
}
.vac-badge--remoto {
    background: var(--sisa-tint-purple, #f0eafa); color: var(--sisa-icon-purple, #7c3aed);
}
.vac-badge--hibrido {
    background: var(--sisa-tint-amber, #fff8e1); color: var(--sisa-icon-amber, #b45309);
}
.vac-badge--rem {
    background: var(--sisa-tint-green, #e6f4ea); color: var(--sisa-icon-green, #15803d);
}

/* ── Toggle row ──────────────────────────────────────── */
.toggle-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 1rem; padding: .75rem 1rem;
    background: var(--p-surface-50, #f8fafc);
    border: 1px solid var(--p-content-border-color);
    border-radius: .5rem;
}
.toggle-row__info { display: flex; flex-direction: column; gap: .15rem; }
.toggle-row__label { font-size: .875rem; font-weight: 600; color: var(--p-text-color); }
.toggle-row__hint { font-size: .78rem; color: var(--p-text-muted-color); }

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
