<script setup>
import api from '@/api/axios';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from '@/composables/useAppToast';
import { computed, onMounted, ref, watch } from 'vue';
import DatePicker from 'primevue/datepicker';

// PrimeVue
import Button from 'primevue/button';
import Column from 'primevue/column';
import ConfirmDialog from 'primevue/confirmdialog';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';

const toast = useToast();
const confirm = useConfirm();

// =======================
// STATE
// =======================
const periodos = ref([]);
const periodoSeleccionado = ref(null);
const entregables = ref([]);
const loading = ref(false);

const dialogVisible = ref(false);
const isEdit = ref(false);

const entregableForm = ref({
    id_entregable: null,
    id_periodo: null,
    numero: null,
    nombre: '',
    descripcion: '',
    id_grupo: null,
});

const fechaInicio = ref(null);
const fechaLimite = ref(null);


// ── Grupos state ──────────────────────────────────
const grupos              = ref([]);
const gruposLoading       = ref(false);
const gruposDialogVisible = ref(false);
const grupoForm           = ref({ id_grupo: null, nombre: '', porcentaje: null, orden: 0 });
const isGrupoEdit         = ref(false);
const savingGrupo         = ref(false);

const sumaPorcentajes = computed(() =>
    grupos.value.reduce((acc, g) => acc + Number(g.porcentaje ?? 0), 0)
);

// Mapa id_entregable → id_grupo derivado de los grupos (más confiable que data.id_grupo)
const entregableGrupoMap = computed(() => {
    const map = {};
    for (const g of grupos.value) {
        for (const e of (g.entregables ?? [])) {
            map[e.id_entregable] = g.id_grupo;
        }
    }
    return map;
});

const sumaStatus = computed(() => {
    const s = sumaPorcentajes.value;
    if (s === 100) return 'complete';
    if (s > 100)  return 'over';
    return 'partial';
});

// Peso efectivo de cada entregable en la calificación final (%)
// Fórmula: grupo.porcentaje / cantidad_entregables_en_grupo (todos valen igual)
const pesoEfectivoMap = computed(() => {
    const countByGroup = {};
    for (const e of entregables.value) {
        const gid = e.grupo?.id_grupo;
        if (gid != null) countByGroup[gid] = (countByGroup[gid] ?? 0) + 1;
    }
    const pctByGroup = {};
    for (const g of grupos.value) pctByGroup[g.id_grupo] = g.porcentaje;

    const map = {};
    for (const e of entregables.value) {
        const gid = e.grupo?.id_grupo;
        if (gid != null && pctByGroup[gid] != null) {
            map[e.id_entregable] = pctByGroup[gid] / (countByGroup[gid] || 1);
        } else {
            map[e.id_entregable] = null;
        }
    }
    return map;
});

// =======================
// COMPUTED – period info badge
// =======================
const periodoBadgeInfo = computed(() => {
    const p = periodoSeleccionado.value;
    if (!p) return null;
    return {
        rango: `${formatDateDisplay(p.fecha_inicio)} → ${formatDateDisplay(p.fecha_fin)}`,
        estado: p.estado
    };
});

// =======================
// HELPERS
// =======================
// Periodos usan DATE (sin hora) → forzar T00:00:00 local para no desfasar
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Entregables usan DATETIME (ISO completo) → mostrar fecha + hora
const formatDateTimeDisplay = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const isVencido = (fechaLimite) => {
    if (!fechaLimite) return false;
    return new Date(fechaLimite) < new Date();
};

// =======================
// LOAD PERIODOS
// =======================
const loadPeriodos = async () => {
    try {
        const { data } = await api.get('/periodos');
        periodos.value = data;
        // AUTO-SELECT: active period first, fallback to first
        periodoSeleccionado.value = data.find((p) => p.estado === 'activo') ?? null;
        if (periodoSeleccionado.value) {
            await loadEntregables();
            await loadGrupos();
        }
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar los periodos',
            life: 4000
        });
    }
};

// =======================
// LOAD ENTREGABLES
// =======================
const loadEntregables = async () => {
    if (!periodoSeleccionado.value) return;

    try {
        loading.value = true;
        const { data } = await api.get(`/entregables/periodo/${periodoSeleccionado.value.id_periodo}`);
        entregables.value = data;
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar los entregables',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
};

watch(periodoSeleccionado, async () => {
    await loadEntregables();
    await loadGrupos();
});

// =======================
// LOAD GRUPOS
// =======================
const loadGrupos = async () => {
    if (!periodoSeleccionado.value) return;
    gruposLoading.value = true;
    try {
        const { data } = await api.get(`/entregables/grupos/periodo/${periodoSeleccionado.value.id_periodo}`);
        // API returns { grupos: [], sin_grupo: [], suma_porcentajes: 0, completo: false }
        grupos.value = Array.isArray(data) ? data : (data.grupos ?? []);
    } catch {
        grupos.value = [];
    } finally {
        gruposLoading.value = false;
    }
};

// =======================
// GRUPOS CRUD
// =======================
const openNewGrupo = () => {
    isGrupoEdit.value = false;
    grupoForm.value = {
        id_grupo: null,
        nombre: '',
        porcentaje: null,
        orden: grupos.value.length + 1
    };
    gruposDialogVisible.value = true;
};

const editGrupo = (g) => {
    isGrupoEdit.value = true;
    grupoForm.value = { ...g, entregables: g.entregables ?? [] };
    gruposDialogVisible.value = true;
};

const saveGrupo = async () => {
    if (!grupoForm.value.nombre?.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'El nombre del grupo es obligatorio', life: 3000 });
        return;
    }
    if (!grupoForm.value.porcentaje || grupoForm.value.porcentaje <= 0) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'El porcentaje debe ser mayor a 0', life: 3000 });
        return;
    }
    savingGrupo.value = true;
    try {
        if (isGrupoEdit.value) {
            await api.put(`/entregables/grupos/${grupoForm.value.id_grupo}`, {
                nombre: grupoForm.value.nombre,
                porcentaje: grupoForm.value.porcentaje,
                orden: grupoForm.value.orden
            });
            toast.add({ severity: 'success', summary: 'Grupo actualizado', life: 3000 });
        } else {
            await api.post('/entregables/grupos', {
                id_periodo: periodoSeleccionado.value.id_periodo,
                nombre: grupoForm.value.nombre,
                porcentaje: grupoForm.value.porcentaje,
                orden: grupoForm.value.orden
            });
            toast.add({ severity: 'success', summary: 'Grupo creado', life: 3000 });
        }
        gruposDialogVisible.value = false;
        await loadGrupos();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message ?? 'No se pudo guardar el grupo', life: 4000 });
    } finally {
        savingGrupo.value = false;
    }
};

const confirmDeleteGrupo = (g) => {
    confirm.require({
        message: `¿Eliminar el grupo "${g.nombre}"? Los entregables quedarán sin grupo.`,
        header: 'Confirmar eliminación',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await api.delete(`/entregables/grupos/${g.id_grupo}`);
                toast.add({ severity: 'success', summary: 'Grupo eliminado', life: 3000 });
                await loadGrupos();
                await loadEntregables();
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message ?? 'No se pudo eliminar', life: 4000 });
            }
        }
    });
};

// =======================
// ASSIGN ENTREGABLE → GRUPO
// =======================
const assignGrupo = async (entregable, idGrupo) => {
    try {
        if (idGrupo) {
            await api.put(`/entregables/${entregable.id_entregable}/grupo/${idGrupo}`);
        } else {
            await api.delete(`/entregables/${entregable.id_entregable}/grupo`);
        }
        await loadEntregables();
        await loadGrupos();
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo asignar el grupo', life: 3000 });
    }
};

// =======================
// MODAL
// =======================
const openNew = () => {
    isEdit.value = false;
    entregableForm.value = {
        id_entregable: null,
        id_periodo: periodoSeleccionado.value?.id_periodo ?? null,
        numero: null,
        nombre: '',
        descripcion: '',
        id_grupo: null,
    };
    fechaInicio.value = null;
    fechaLimite.value = null;
    dialogVisible.value = true;
};

const editEntregable = (row) => {
    isEdit.value = true;
    entregableForm.value = {
        ...row,
        id_periodo: periodoSeleccionado.value?.id_periodo ?? row.id_periodo,
        fecha_inicio: row.fecha_inicio ? new Date(row.fecha_inicio) : null,
        fecha_limite: row.fecha_limite ? new Date(row.fecha_limite) : null,
        id_grupo: row.grupo?.id_grupo ?? row.id_grupo ?? null,
    };
    fechaInicio.value = row.fecha_inicio ? new Date(row.fecha_inicio) : null;
    fechaLimite.value = row.fecha_limite ? new Date(row.fecha_limite) : null;
    dialogVisible.value = true;
};

// =======================
// SAVE
// =======================
const saveEntregable = async () => {
    // INC-07: validar campos obligatorios
    if (!entregableForm.value.nombre?.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'El nombre del entregable es obligatorio', life: 3000 });
        return;
    }
    if (!fechaInicio.value) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'Selecciona la fecha de inicio', life: 3000 });
        return;
    }
    if (!fechaLimite.value) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'Selecciona la fecha límite', life: 3000 });
        return;
    }
    if (fechaLimite.value <= fechaInicio.value) {
        toast.add({ severity: 'warn', summary: 'Fecha inválida', detail: 'La fecha límite debe ser posterior a la de inicio', life: 3000 });
        return;
    }
    if (grupos.value.length > 0 && !entregableForm.value.id_grupo) {
        toast.add({ severity: 'warn', summary: 'Grupo requerido', detail: `Este período tiene ${grupos.value.length} grupo(s) definidos. Debes asignar el entregable a un grupo.`, life: 4000 });
        return;
    }

    try {
        const base = {
            id_periodo:   entregableForm.value.id_periodo,
            numero:       entregableForm.value.numero != null ? Number(entregableForm.value.numero) : null,
            nombre:       entregableForm.value.nombre,
            descripcion:  entregableForm.value.descripcion || null,
            fecha_inicio: fechaInicio.value ? new Date(fechaInicio.value).toISOString() : null,
            fecha_limite: fechaLimite.value ? new Date(fechaLimite.value).toISOString() : null,
            ...(entregableForm.value.id_grupo ? { id_grupo: entregableForm.value.id_grupo } : {})
        };

        if (isEdit.value) {
            await api.put(`/entregables/${entregableForm.value.id_entregable}`, base);
            toast.add({ severity: 'success', summary: 'Actualizado', detail: 'Entregable actualizado', life: 3000 });
        } else {
            await api.post('/entregables', base);
            toast.add({ severity: 'success', summary: 'Creado', detail: 'Entregable creado', life: 3000 });
        }

        dialogVisible.value = false;
        loadEntregables();
    } catch (e) {
        const raw = e.response?.data?.message;
        const msg = Array.isArray(raw) ? raw[0] : (raw || 'No se pudo guardar el entregable');
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 });
    }
};

// =======================
// DELETE
// =======================
const confirmDelete = (row) => {
    confirm.require({
        message: `¿Eliminar el entregable "${row.nombre}"?`,
        header: 'Confirmar eliminación',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await api.delete(`/entregables/${row.id_entregable}`);
                toast.add({ severity: 'success', summary: 'Eliminado', detail: 'Entregable eliminado', life: 3000 });
                loadEntregables();
            } catch {
                toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el entregable', life: 4000 });
            }
        }
    });
};

onMounted(loadPeriodos);
</script>

<template>
    <div class="page-container">
        <!-- ══════════════════════════════════
             HEADER BAR
        ══════════════════════════════════ -->
        <div class="page-header">
            <!-- Title group -->
            <div class="page-title-group">
                <span class="page-icon">
                    <i class="pi pi-box" />
                </span>
                <div>
                    <h4 class="page-title">Entregables</h4>
                    <p class="page-subtitle">Gestiona los entregables por período</p>
                </div>
            </div>

            <!-- Controls -->
            <div class="header-controls">
                <Select
                    v-model="periodoSeleccionado"
                    :options="periodos"
                    optionLabel="nombre"
                    placeholder="Seleccionar período"
                    class="periodo-select"
                />
                <Button
                    label="Nuevo entregable"
                    icon="pi pi-plus"
                    :disabled="!periodoSeleccionado || grupos.length === 0"
                    v-tooltip.bottom="periodoSeleccionado && grupos.length === 0 ? 'Primero crea grupos de evaluación' : null"
                    @click="openNew"
                />
            </div>
        </div>

        <!-- ══════════════════════════════════
             PERIOD INFO BADGE
        ══════════════════════════════════ -->
        <div v-if="periodoBadgeInfo" class="period-info-bar">
            <div class="period-info-dates">
                <i class="pi pi-calendar-range info-icon" />
                <span>{{ periodoBadgeInfo.rango }}</span>
            </div>
            <Tag
                :value="periodoBadgeInfo.estado === 'activo' ? 'Activo' : 'Cerrado'"
                :severity="periodoBadgeInfo.estado === 'activo' ? 'success' : 'secondary'"
            />
        </div>

        <!-- ══════════════════════════════════
             EMPTY SELECTION STATE
        ══════════════════════════════════ -->
        <div v-if="!periodoSeleccionado && !loading" class="empty-state">
            <i class="pi pi-inbox empty-icon" />
            <p class="empty-text">Selecciona un período para ver sus entregables</p>
        </div>

        <!-- ══════════════════════════════════
             NO-GRUPOS STATE
        ══════════════════════════════════ -->
        <div v-else-if="grupos.length === 0 && !gruposLoading" class="no-grupos-state">
            <div class="no-grupos-icon-wrap">
                <i class="pi pi-th-large" />
            </div>
            <h5 class="no-grupos-title">Configura los grupos de evaluación primero</h5>
            <p class="no-grupos-hint">
                Define los parciales, etapas o criterios (ej. Parcial 1, Proyecto Final) con su porcentaje antes de agregar entregables.<br />
                Los grupos permiten calcular automáticamente la calificación final.
            </p>
            <Button label="Crear primer grupo" icon="pi pi-plus" @click="openNewGrupo" />
        </div>

        <!-- ══════════════════════════════════
             TABLE
        ══════════════════════════════════ -->
        <div v-else class="table-panel">
            <DataTable
                :value="entregables"
                :loading="loading"
                paginator
                :rows="10"
                responsiveLayout="scroll"
                stripedRows
                :rowHover="true"
                class="entregables-table"
            >
                <!-- # -->
                <Column field="numero" header="#" style="width: 60px; text-align: center" />

                <!-- Peso efectivo -->
                <Column header="Peso" style="width: 90px; text-align: center">
                    <template #body="{ data }">
                        <span
                            v-if="pesoEfectivoMap[data.id_entregable] != null"
                            class="peso-badge"
                            v-tooltip.top="`Vale el ${pesoEfectivoMap[data.id_entregable].toFixed(1)}% de la calificación final`"
                        >
                            {{ pesoEfectivoMap[data.id_entregable].toFixed(1) }}%
                        </span>
                        <span v-else class="peso-badge peso-badge--none" v-tooltip.top="'Sin grupo asignado'">
                            —
                        </span>
                    </template>
                </Column>

                <!-- Grupo -->
                <Column header="Grupo" style="width: 170px">
                    <template #body="{ data }">
                        <Select
                            :modelValue="entregableGrupoMap[data.id_entregable] ?? null"
                            :options="[{ label: 'Sin grupo', value: null }, ...grupos.map(g => ({ label: g.nombre, value: g.id_grupo }))]"
                            option-label="label"
                            option-value="value"
                            placeholder="Sin grupo"
                            class="grupo-select"
                            @update:modelValue="(val) => assignGrupo(data, val)"
                        />
                    </template>
                </Column>

                <!-- Nombre -->
                <Column field="nombre" header="Entregable">
                    <template #body="{ data }">
                        <span class="entregable-name">{{ data.nombre }}</span>
                    </template>
                </Column>

                <!-- Descripcion -->
                <Column field="descripcion" header="Descripción">
                    <template #body="{ data }">
                        <span class="desc-text">{{ data.descripcion || '—' }}</span>
                    </template>
                </Column>

                <!-- Disponibilidad -->
                <Column header="Disponibilidad">
                    <template #body="{ data }">
                        <div class="date-range-cell">
                            <span v-if="data.fecha_inicio" class="date-chip start">
                                {{ formatDateTimeDisplay(data.fecha_inicio) }}
                            </span>
                            <i class="pi pi-arrow-right date-arrow" />
                            <span class="date-chip end" :class="{ vencido: isVencido(data.fecha_limite) }">
                                {{ formatDateTimeDisplay(data.fecha_limite) }}
                            </span>
                        </div>
                    </template>
                </Column>

                <!-- Estado plazo -->
                <Column header="Plazo" style="width: 120px">
                    <template #body="{ data }">
                        <span
                            class="plazo-chip"
                            :class="isVencido(data.fecha_limite) ? 'plazo-vencido' : 'plazo-vigente'"
                        >
                            <i :class="isVencido(data.fecha_limite) ? 'pi pi-clock' : 'pi pi-check-circle'" />
                            {{ isVencido(data.fecha_limite) ? 'Vencido' : 'Vigente' }}
                        </span>
                    </template>
                </Column>

                <!-- Acciones -->
                <Column header="Acciones" style="width: 100px">
                    <template #body="{ data }">
                        <div class="action-btns">
                            <Button icon="pi pi-pencil" text size="small" v-tooltip="'Editar'" @click="editEntregable(data)" />
                            <Button icon="pi pi-trash" text size="small" severity="danger" v-tooltip="'Eliminar'" @click="confirmDelete(data)" />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>

        <!-- ══════════════════════════════════
             GRUPOS DE EVALUACIÓN
        ══════════════════════════════════ -->
        <div v-if="periodoSeleccionado" class="grupos-panel">
            <!-- Panel header -->
            <div class="grupos-header">
                <div class="grupos-header__left">
                    <span class="grupos-icon"><i class="pi pi-chart-pie" /></span>
                    <div>
                        <h5 class="grupos-title">Grupos de evaluación</h5>
                        <p class="grupos-subtitle">Distribuye el % por parcial/etapa</p>
                    </div>
                </div>
                <div class="grupos-header__right">
                    <!-- Percentage pill -->
                    <div class="pct-pill" :class="`pct-pill--${sumaStatus}`">
                        <span class="pct-pill__num">{{ sumaPorcentajes }}%</span>
                        <span class="pct-pill__label">
                            {{ sumaStatus === 'complete' ? 'Completo ✓' : sumaStatus === 'over' ? 'Excede 100%' : `Faltan ${100 - sumaPorcentajes}%` }}
                        </span>
                    </div>
                    <Button icon="pi pi-plus" label="Nuevo grupo" size="small" @click="openNewGrupo" />
                </div>
            </div>

            <!-- Grupos empty -->
            <div v-if="grupos.length === 0" class="grupos-empty">
                <i class="pi pi-th-large grupos-empty__icon" />
                <p>Sin grupos creados. Agrega grupos para distribuir el porcentaje de evaluación.</p>
            </div>

            <!-- Grupos list -->
            <div v-else class="grupos-list">
                <div v-for="g in grupos" :key="g.id_grupo" class="grupo-row">
                    <div class="grupo-row__orden">{{ g.orden }}</div>
                    <div class="grupo-row__info">
                        <span class="grupo-row__nombre">{{ g.nombre }}</span>
                        <span class="grupo-row__count">
                            {{ (g.entregables ?? []).length }} entregable{{ (g.entregables ?? []).length !== 1 ? 's' : '' }}
                        </span>
                    </div>
                    <div class="grupo-row__pct">
                        <div class="pct-bar-wrap">
                            <div class="pct-bar" :style="{ width: `${Math.min(g.porcentaje, 100)}%` }" />
                        </div>
                        <span class="pct-num">{{ g.porcentaje }}%</span>
                    </div>
                    <div class="grupo-row__actions">
                        <Button icon="pi pi-pencil" text size="small" v-tooltip.top="'Editar'" @click="editGrupo(g)" />
                        <Button icon="pi pi-trash" text size="small" severity="danger" v-tooltip.top="'Eliminar'" @click="confirmDeleteGrupo(g)" />
                    </div>
                </div>
            </div>
        </div>

        <!-- ══════════════════════════════════
             GRUPO FORM DIALOG
        ══════════════════════════════════ -->
        <Dialog
            v-model:visible="gruposDialogVisible"
            modal
            :header="isGrupoEdit ? 'Editar grupo' : 'Nuevo grupo de evaluación'"
            :style="{ width: '480px' }"
            :breakpoints="{ '640px': '95vw' }"
        >
            <div class="grupo-form">
                <div class="field">
                    <label class="field-label"><i class="pi pi-tag" /> Nombre</label>
                    <InputText v-model="grupoForm.nombre" placeholder="ej. Parcial 1, Final, Proyecto…" class="w-full" />
                </div>
                <div class="field">
                    <label class="field-label"><i class="pi pi-percentage" /> Porcentaje (%)</label>
                    <InputNumber v-model="grupoForm.porcentaje" :min="1" :max="100" suffix="%" show-buttons class="w-full" />
                    <span v-if="!isGrupoEdit && sumaPorcentajes + (grupoForm.porcentaje ?? 0) > 100" class="field-warn">
                        <i class="pi pi-exclamation-triangle" /> La suma superaría el 100%
                    </span>
                </div>
                <div class="field">
                    <label class="field-label"><i class="pi pi-sort-numeric-up" /> Orden</label>
                    <InputNumber v-model="grupoForm.orden" :min="1" show-buttons class="w-full" />
                </div>

                <!-- Entregables del grupo (solo en edición) -->
                <div v-if="isGrupoEdit" class="field">
                    <label class="field-label"><i class="pi pi-list" /> Entregables en este grupo</label>
                    <div v-if="grupoForm.entregables?.length > 0" class="grupo-ents-list">
                        <div v-for="e in grupoForm.entregables" :key="e.id_entregable" class="grupo-ent-item">
                            <span class="grupo-ent-num">#{{ e.numero }}</span>
                            <span class="grupo-ent-nombre">{{ e.nombre }}</span>
                        </div>
                    </div>
                    <div v-else class="grupo-ents-empty">
                        <i class="pi pi-inbox" /> Sin entregables asignados a este grupo
                    </div>
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text @click="gruposDialogVisible = false" />
                <Button label="Guardar" icon="pi pi-check" severity="success" :loading="savingGrupo" @click="saveGrupo" />
            </template>
        </Dialog>

        <!-- ══════════════════════════════════
             FORM DIALOG
        ══════════════════════════════════ -->
        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="isEdit ? 'Editar entregable' : 'Nuevo entregable'"
            :style="{ width: '640px' }"
            :breakpoints="{ '960px': '90vw', '640px': '95vw' }"
        >
            <div class="entregable-form">
                <!-- Número -->
                <div class="field number-field">
                    <label class="field-label">
                        <i class="pi pi-sort-numeric-up" />
                        Número
                    </label>
                    <InputText v-model="entregableForm.numero" class="w-full" type="number" />
                </div>

                <!-- Nombre -->
                <div class="field name-field">
                    <label class="field-label">
                        <i class="pi pi-box" />
                        Nombre
                    </label>
                    <InputText v-model="entregableForm.nombre" placeholder="Nombre del entregable" class="w-full" />
                </div>

                <!-- Descripción -->
                <div class="field full-field">
                    <label class="field-label">
                        <i class="pi pi-align-left" />
                        Descripción
                    </label>
                    <Textarea v-model="entregableForm.descripcion" rows="3" autoResize class="w-full" />
                </div>

                <!-- Grupo -->
                <div v-if="grupos.length > 0" class="field full-field">
                    <label class="field-label">
                        <i class="pi pi-th-large" />
                        Grupo de evaluación <span class="required-star">*</span>
                    </label>
                    <Select
                        v-model="entregableForm.id_grupo"
                        :options="[{ label: 'Sin grupo', value: null }, ...grupos.map(g => ({ label: `${g.nombre} (${g.porcentaje}%)`, value: g.id_grupo }))]"
                        option-label="label"
                        option-value="value"
                        placeholder="Sin grupo"
                        class="w-full"
                    />
                </div>

                <!-- Fecha inicio -->
                <div class="field full-field">
                    <label class="field-label">
                        <i class="pi pi-calendar" />
                        Fecha de inicio <span class="field-required">*</span>
                    </label>
                    <DatePicker
                        v-model="fechaInicio"
                        showIcon
                        showTime
                        hourFormat="24"
                        dateFormat="dd/mm/yy"
                        placeholder="dd/mm/aaaa hh:mm"
                        :manualInput="true"
                        class="w-full"
                    />
                    <small class="field-hint-inline">Puedes escribir la hora directamente: <code>23:59</code></small>
                </div>

                <!-- Fecha límite -->
                <div class="field full-field">
                    <label class="field-label">
                        <i class="pi pi-calendar-times" />
                        Fecha límite <span class="field-required">*</span>
                    </label>
                    <DatePicker
                        v-model="fechaLimite"
                        showIcon
                        showTime
                        hourFormat="24"
                        dateFormat="dd/mm/yy"
                        placeholder="dd/mm/aaaa hh:mm"
                        :manualInput="true"
                        :minDate="fechaInicio ?? undefined"
                        class="w-full"
                    />
                    <small class="field-hint-inline">Puedes escribir la hora directamente: <code>23:59</code></small>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <Button label="Cancelar" icon="pi pi-times" text @click="dialogVisible = false" />
                    <Button label="Guardar" icon="pi pi-check" severity="success" @click="saveEntregable" />
                </div>
            </template>
        </Dialog>

        <ConfirmDialog />
        <Toast />
    </div>
</template>

<style scoped>
/* ══════════════════════════════════
   PAGE LAYOUT
══════════════════════════════════ */
.page-container {
    padding: 1.5rem;
}

/* ══════════════════════════════════
   HEADER
══════════════════════════════════ */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
}

.page-title-group {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-shrink: 0;
}

.page-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: .75rem;
    background: var(--sisa-tint-purple);
    color: var(--sisa-icon-purple);
    font-size: 1.2rem;
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

.header-controls {
    display: flex;
    align-items: center;
    gap: .75rem;
    flex-wrap: wrap;
}

.periodo-select {
    min-width: 220px;
}

/* ══════════════════════════════════
   PERIOD INFO BAR
══════════════════════════════════ */
.period-info-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: .65rem 1rem;
    border-radius: .5rem;
    background: var(--sisa-tint-blue);
    border: 1px solid var(--p-content-border-color);
    margin-bottom: 1.25rem;
}

.period-info-dates {
    display: flex;
    align-items: center;
    gap: .5rem;
    font-size: .85rem;
    color: var(--p-text-color);
    font-weight: 500;
}

.info-icon {
    color: var(--sisa-icon-blue);
    font-size: .9rem;
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

/* ══════════════════════════════════
   NO-GRUPOS STATE
══════════════════════════════════ */
.no-grupos-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .75rem;
    padding: 3rem 2rem;
    border-radius: .75rem;
    border: 2px dashed var(--p-content-border-color);
    background: var(--p-content-background);
    text-align: center;
    margin-bottom: 1.25rem;
}

.no-grupos-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    background: var(--sisa-tint-purple);
    color: var(--sisa-icon-purple);
    font-size: 1.5rem;
}

.no-grupos-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--p-text-color);
}

.no-grupos-hint {
    margin: 0;
    font-size: .85rem;
    color: var(--p-text-muted-color);
    max-width: 480px;
    line-height: 1.5;
}

.empty-icon {
    font-size: 3rem;
    opacity: .3;
}

.empty-text {
    margin: 0;
    font-size: .95rem;
}

/* ══════════════════════════════════
   TABLE PANEL
══════════════════════════════════ */
.table-panel {
    border-radius: .75rem;
    border: 1px solid var(--p-content-border-color);
    overflow: hidden;
    background: var(--p-content-background);
}

.entregable-name {
    font-weight: 600;
    color: var(--p-text-color);
}

.desc-text {
    font-size: .83rem;
    color: var(--p-text-muted-color);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* ── Date range cell ──────────── */
.date-range-cell {
    display: flex;
    align-items: center;
    gap: .4rem;
    flex-wrap: wrap;
}

.date-chip {
    font-size: .78rem;
    font-weight: 500;
    padding: .2rem .5rem;
    border-radius: .35rem;
    background: var(--p-content-border-color);
    color: var(--p-text-color);
}

.date-chip.vencido {
    background: var(--sisa-tint-red);
    color: var(--sisa-icon-red);
}

.date-arrow {
    font-size: .65rem;
    color: var(--p-text-muted-color);
}

/* ── Plazo chip ───────────────── */
.plazo-chip {
    display: inline-flex;
    align-items: center;
    gap: .3rem;
    font-size: .75rem;
    font-weight: 600;
    padding: .25rem .6rem;
    border-radius: .5rem;
}

.plazo-vigente {
    background: var(--sisa-tint-green);
    color: var(--sisa-icon-green);
}

.plazo-vencido {
    background: var(--sisa-tint-red);
    color: var(--sisa-icon-red);
}

.action-btns {
    display: flex;
    gap: .15rem;
}

.peso-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: .2rem .5rem;
    border-radius: .35rem;
    background: var(--sisa-tint-purple, #f0eafa);
    color: var(--sisa-icon-purple, #7c3aed);
    font-size: .75rem;
    font-weight: 700;
    min-width: 2.5rem;
}
.peso-badge--none {
    background: var(--surface-100, #f4f4f5);
    color: var(--text-color-secondary, #9ca3af);
}

.field-hint {
    font-size: .72rem;
    color: var(--p-text-muted-color);
    line-height: 1.4;
}

.field-hint-inline {
    font-size: .72rem;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: var(--p-text-muted-color);
}


/* ══════════════════════════════════
   FORM DIALOG
══════════════════════════════════ */
.entregable-form {
    display: grid;
    grid-template-columns: 110px 1fr;
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
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--p-text-muted-color);
    display: flex;
    align-items: center;
    gap: .4rem;
}

.required-star { color: var(--sisa-icon-red, #c0392b); font-size: .85rem; }

.number-field { grid-column: 1 / 2; }
.name-field   { grid-column: 2 / 3; }
.full-field   { grid-column: 1 / 3; }

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: .75rem;
}

/* ══════════════════════════════════
   GRUPO SELECT (en tabla)
══════════════════════════════════ */
.grupo-select {
    width: 100%;
    font-size: .8rem;
}

/* ══════════════════════════════════
   GRUPOS PANEL
══════════════════════════════════ */
.grupos-panel {
    margin-top: 1.5rem;
    border: 1px solid var(--p-content-border-color);
    border-radius: .75rem;
    background: var(--p-content-background);
    overflow: hidden;
}

.grupos-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    padding: .875rem 1.25rem;
    background: var(--p-surface-50, #f8fafc);
    border-bottom: 1px solid var(--p-content-border-color);
}

.grupos-header__left {
    display: flex;
    align-items: center;
    gap: .75rem;
}

.grupos-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: .6rem;
    background: var(--sisa-tint-amber, #fff8e1);
    color: var(--sisa-icon-amber, #b45309);
    font-size: 1.1rem;
    flex-shrink: 0;
}

.grupos-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--p-text-color);
    line-height: 1.2;
}

.grupos-subtitle {
    margin: .1rem 0 0;
    font-size: .78rem;
    color: var(--p-text-muted-color);
}

.grupos-header__right {
    display: flex;
    align-items: center;
    gap: .75rem;
    flex-wrap: wrap;
}

/* Percentage pill */
.pct-pill {
    display: flex;
    align-items: center;
    gap: .5rem;
    padding: .35rem .75rem;
    border-radius: 999px;
    font-size: .8rem;
    font-weight: 600;
}
.pct-pill--partial {
    background: var(--sisa-tint-blue, #e8f1fb);
    color: var(--sisa-icon-blue, #1c6aac);
}
.pct-pill--complete {
    background: var(--sisa-tint-green, #e6f4ea);
    color: var(--sisa-icon-green, #15803d);
}
.pct-pill--over {
    background: var(--sisa-tint-red, #fce8e8);
    color: var(--sisa-icon-red, #c0392b);
}
.pct-pill__num {
    font-size: 1rem;
    font-weight: 700;
}
.pct-pill__label {
    font-weight: 500;
}

/* Empty */
.grupos-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .5rem;
    padding: 2.5rem 1rem;
    text-align: center;
    color: var(--p-text-muted-color);
    font-size: .875rem;
}
.grupos-empty__icon {
    font-size: 2rem;
    opacity: .3;
}

/* Grupos list */
.grupos-list {
    display: flex;
    flex-direction: column;
}

.grupo-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: .75rem 1.25rem;
    border-bottom: 1px solid var(--p-content-border-color);
}
.grupo-row:last-child { border-bottom: none; }
.grupo-row:hover { background: var(--p-surface-50, #f8fafc); }

.grupo-row__orden {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    background: var(--sisa-tint-purple, #f0eafa);
    color: var(--sisa-icon-purple, #7c3aed);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: .75rem;
    font-weight: 700;
    flex-shrink: 0;
}

.grupo-row__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: .1rem;
    min-width: 0;
}

.grupo-row__nombre {
    font-weight: 600;
    font-size: .9rem;
    color: var(--p-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.grupo-row__count {
    font-size: .75rem;
    color: var(--p-text-muted-color);
}

.grupo-row__pct {
    display: flex;
    align-items: center;
    gap: .6rem;
    min-width: 140px;
}

.pct-bar-wrap {
    flex: 1;
    height: 6px;
    background: var(--p-content-border-color);
    border-radius: 999px;
    overflow: hidden;
}

.pct-bar {
    height: 100%;
    background: var(--sisa-primary, #0F3C61);
    border-radius: 999px;
    transition: width .3s ease;
}

.pct-num {
    font-size: .85rem;
    font-weight: 700;
    color: var(--p-text-color);
    min-width: 2.5rem;
    text-align: right;
}

.grupo-row__actions {
    display: flex;
    gap: .15rem;
    flex-shrink: 0;
}

/* Grupo form dialog */
.grupo-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding-top: .25rem;
}

/* Lista de entregables en el grupo */
.grupo-ents-list {
    display: flex;
    flex-direction: column;
    gap: .3rem;
    border: 1px solid var(--p-content-border-color);
    border-radius: .5rem;
    overflow: hidden;
}

.grupo-ent-item {
    display: flex;
    align-items: center;
    gap: .6rem;
    padding: .5rem .75rem;
    font-size: .85rem;
    border-bottom: 1px solid var(--p-content-border-color);
    background: var(--p-content-background);
}
.grupo-ent-item:last-child { border-bottom: none; }

.grupo-ent-num {
    font-size: .72rem;
    font-weight: 700;
    color: var(--p-text-muted-color);
    min-width: 1.5rem;
}

.grupo-ent-nombre {
    font-weight: 500;
    color: var(--p-text-color);
}

.grupo-ents-empty {
    display: flex;
    align-items: center;
    gap: .5rem;
    font-size: .82rem;
    color: var(--p-text-muted-color);
    padding: .6rem .75rem;
    background: var(--p-surface-50, #f8fafc);
    border: 1px solid var(--p-content-border-color);
    border-radius: .5rem;
}

.field-warn {
    display: flex;
    align-items: center;
    gap: .35rem;
    font-size: .78rem;
    color: var(--sisa-icon-amber, #b45309);
    margin-top: .25rem;
}

/* ══════════════════════════════════
   RESPONSIVE
══════════════════════════════════ */
@media (max-width: 640px) {
    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .header-controls {
        width: 100%;
    }

    .periodo-select {
        width: 100%;
    }

    .entregable-form {
        grid-template-columns: 1fr;
    }

    .number-field,
    .name-field,
    .full-field {
        grid-column: auto;
    }
}
</style>
