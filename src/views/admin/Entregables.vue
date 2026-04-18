<script setup>
import api from '@/api/axios';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import Column from 'primevue/column';
import ConfirmDialog from 'primevue/confirmdialog';
import DataTable from 'primevue/datatable';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
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
    fecha_inicio: null,
    fecha_limite: null
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
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isVencido = (fechaLimite) => {
    if (!fechaLimite) return false;
    const limite = new Date(fechaLimite + 'T23:59:59');
    return limite < new Date();
};

// =======================
// LOAD PERIODOS
// =======================
const loadPeriodos = async () => {
    try {
        const { data } = await api.get('/periodos');
        periodos.value = data;
        // AUTO-SELECT: active period first, fallback to first
        periodoSeleccionado.value = data.find((p) => p.estado === 'activo') ?? data[0] ?? null;
        if (periodoSeleccionado.value) {
            await loadEntregables();
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

watch(periodoSeleccionado, loadEntregables);

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
        fecha_inicio: null,
        fecha_limite: null
    };
    dialogVisible.value = true;
};

const editEntregable = (row) => {
    isEdit.value = true;
    entregableForm.value = {
        ...row,
        id_periodo: periodoSeleccionado.value?.id_periodo ?? row.id_periodo,
        fecha_inicio: row.fecha_inicio ? new Date(row.fecha_inicio + 'T00:00:00') : null,
        fecha_limite: row.fecha_limite ? new Date(row.fecha_limite + 'T00:00:00') : null
    };
    dialogVisible.value = true;
};

// =======================
// SAVE
// =======================
const saveEntregable = async () => {
    try {
        const { fecha_inicio, fecha_limite } = entregableForm.value;

        if (fecha_inicio && fecha_limite && fecha_inicio > fecha_limite) {
            toast.add({
                severity: 'warn',
                summary: 'Fechas inválidas',
                detail: 'La fecha de inicio no puede ser mayor a la fecha límite',
                life: 4000
            });
            return;
        }

        const payload = {
            ...entregableForm.value,
            fecha_inicio: fecha_inicio ? fecha_inicio.toISOString().split('T')[0] : null,
            fecha_limite: fecha_limite ? fecha_limite.toISOString().split('T')[0] : null
        };

        if (isEdit.value) {
            await api.put(`/entregables/${payload.id_entregable}`, payload);
            toast.add({ severity: 'success', summary: 'Actualizado', detail: 'Entregable actualizado', life: 3000 });
        } else {
            await api.post('/entregables', payload);
            toast.add({ severity: 'success', summary: 'Creado', detail: 'Entregable creado', life: 3000 });
        }

        dialogVisible.value = false;
        loadEntregables();
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo guardar el entregable',
            life: 4000
        });
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
                    :disabled="!periodoSeleccionado"
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
                                {{ formatDateDisplay(data.fecha_inicio) }}
                            </span>
                            <i class="pi pi-arrow-right date-arrow" />
                            <span class="date-chip end" :class="{ vencido: isVencido(data.fecha_limite) }">
                                {{ formatDateDisplay(data.fecha_limite) }}
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

                <!-- Fechas -->
                <div class="field">
                    <label class="field-label">
                        <i class="pi pi-calendar-plus" />
                        Fecha inicio
                    </label>
                    <DatePicker
                        v-model="entregableForm.fecha_inicio"
                        showIcon
                        dateFormat="dd/mm/yy"
                        :maxDate="entregableForm.fecha_limite"
                        class="w-full"
                    />
                </div>

                <div class="field">
                    <label class="field-label">
                        <i class="pi pi-calendar-times" />
                        Fecha límite
                    </label>
                    <DatePicker
                        v-model="entregableForm.fecha_limite"
                        showIcon
                        dateFormat="dd/mm/yy"
                        :minDate="entregableForm.fecha_inicio"
                        class="w-full"
                    />
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

.number-field { grid-column: 1 / 2; }
.name-field   { grid-column: 2 / 3; }
.full-field   { grid-column: 1 / 3; }

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: .75rem;
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
