<script setup>
import api from '@/api/axios';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref, watch } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import Calendar from 'primevue/calendar';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';

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
// LOAD PERIODOS (SOLO ACTIVOS)
// =======================
const loadPeriodos = async () => {
    const { data } = await api.get('/periodos');
    periodos.value = data.filter((p) => p.estado === 'activo');
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
        id_periodo: periodoSeleccionado.value.id_periodo,
        numero: null,
        nombre: '',
        descripcion: '',
        fecha_limite: null
    };
    dialogVisible.value = true;
};

const editEntregable = (row) => {
    isEdit.value = true;
    entregableForm.value = {
        ...row,
        id_periodo: periodoSeleccionado.value.id_periodo,
        fecha_inicio: row.fecha_inicio ? new Date(row.fecha_inicio) : null,
        fecha_limite: new Date(row.fecha_limite)
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
            fecha_limite: fecha_limite.toISOString().split('T')[0]
        };

        if (isEdit.value) {
            await api.put(`/entregables/${payload.id_entregable}`, payload);
            toast.add({
                severity: 'success',
                summary: 'Actualizado',
                detail: 'Entregable actualizado',
                life: 3000
            });
        } else {
            await api.post('/entregables', payload);
            toast.add({
                severity: 'success',
                summary: 'Creado',
                detail: 'Entregable creado',
                life: 3000
            });
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
const confirmDelete = (event, row) => {
    confirm.require({
        target: event.currentTarget,
        message: '¿Eliminar este entregable?',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        accept: async () => {
            await api.delete(`/entregables/${row.id_entregable}`);
            toast.add({
                severity: 'success',
                summary: 'Eliminado',
                detail: 'Entregable eliminado',
                life: 3000
            });
            loadEntregables();
        }
    });
};

onMounted(loadPeriodos);
</script>

<template>
    <div class="card">
        <!-- ===================== -->
        <!-- HEADER -->
        <!-- ===================== -->
        <div class="flex justify-between items-center mb-4">
            <h5 class="m-0">Entregables</h5>
            <Button label="Nuevo entregable" icon="pi pi-plus" :disabled="!periodoSeleccionado" @click="openNew" />
        </div>

        <!-- ===================== -->
        <!-- SELECT PERIODO -->
        <!-- ===================== -->
        <div class="mb-4">
            <Dropdown v-model="periodoSeleccionado" :options="periodos" optionLabel="nombre" placeholder="Selecciona periodo activo" class="w-full md:w-25rem" />
        </div>

        <!-- ===================== -->
        <!-- TABLA -->
        <!-- ===================== -->
        <DataTable :value="entregables" :loading="loading" paginator :rows="10" responsiveLayout="scroll">
            <Column field="numero" header="#" style="width: 80px" />

            <Column field="nombre" header="Entregable" />

            <Column field="descripcion" header="Descripción" />

            <!-- RANGO DE FECHAS -->
            <Column header="Disponibilidad">
                <template #body="{ data }">
                    <span v-if="data.fecha_inicio"> {{ data.fecha_inicio }} → {{ data.fecha_limite }} </span>
                    <span v-else> — → {{ data.fecha_limite }} </span>
                </template>
            </Column>

            <!-- ACCIONES -->
            <Column header="Acciones" style="width: 140px">
                <template #body="{ data }">
                    <Button icon="pi pi-pencil" text @click="editEntregable(data)" />
                    <Button icon="pi pi-trash" text severity="danger" @click="confirmDelete($event, data)" />
                </template>
            </Column>
        </DataTable>

        <!-- ===================== -->
        <!-- MODAL -->
        <!-- ===================== -->
        <Dialog v-model:visible="dialogVisible" modal :header="isEdit ? '📦 Editar entregable' : '📦 Nuevo entregable'" :style="{ width: '640px' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }" :pt="{ content: { class: 'w-full' } }">
            <div class="entregable-form">
                <!-- ===================== -->
                <!-- FILA 1 -->
                <!-- ===================== -->
                <div class="field number">
                    <label>
                        <i class="pi pi-sort-numeric-up" />
                        Número
                    </label>
                    <InputText v-model="entregableForm.numero" />
                </div>

                <div class="field name">
                    <label>
                        <i class="pi pi-box" />
                        Nombre
                    </label>
                    <InputText v-model="entregableForm.nombre" />
                </div>

                <!-- ===================== -->
                <!-- FILA 2 -->
                <!-- ===================== -->
                <div class="field description">
                    <label>
                        <i class="pi pi-align-left" />
                        Descripción
                    </label>
                    <Textarea v-model="entregableForm.descripcion" rows="4" autoResize />
                </div>

                <!-- ===================== -->
                <!-- FILA 3 – RANGO DE FECHAS -->
                <!-- ===================== -->
                <div class="field date-range">
                    <div class="date-field">
                        <label>
                            <i class="pi pi-calendar-plus" />
                            Fecha inicio
                        </label>
                        <Calendar v-model="entregableForm.fecha_inicio" showIcon dateFormat="dd-mm-yy" :maxDate="entregableForm.fecha_limite" />
                    </div>

                    <!-- <span class="date-separator">a</span> -->
                    <div class="date-field">
                        <label>
                            <i class="pi pi-calendar-times" />
                            Fecha fin
                        </label>
                        <Calendar v-model="entregableForm.fecha_limite" showIcon dateFormat="dd-mm-yy" :minDate="entregableForm.fecha_inicio" />
                    </div>
                </div>
            </div>

            <!-- ===================== -->
            <!-- FOOTER -->
            <!-- ===================== -->
            <template #footer>
                <div class="flex justify-end gap-2 w-full">
                    <Button label="Cancelar" icon="pi pi-times" text @click="dialogVisible = false" />
                    <Button label="Guardar" icon="pi pi-check" severity="success" @click="saveEntregable" />
                </div>
            </template>
        </Dialog>
    </div>
</template>
<style scoped>
/* =======================
   FORM LAYOUT
======================= */
.entregable-form {
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 1.25rem;
    width: 100%;
}

/* =======================
   CAMPOS BASE
======================= */
.entregable-form .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.entregable-form label {
    font-weight: 500;
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

/* =======================
   PROPORCIONES UX
======================= */
.entregable-form .number {
    grid-column: 1 / 2;
}

.entregable-form .name {
    grid-column: 2 / 3;
}

.entregable-form .description {
    grid-column: 1 / 3;
}

/* =======================
   RANGO DE FECHAS
======================= */
.entregable-form .date-range {
    grid-column: 1 / 3;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: end;
    gap: 1rem;
    margin-top: 0.5rem;
}

.entregable-form .date-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.entregable-form .date-field label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-color-secondary);
}

.entregable-form .date-separator {
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-color-secondary);
    padding-bottom: 0.55rem;
}

/* =======================
   ESTÉTICA INPUTS
======================= */
.p-calendar {
    width: 100%;
}

.p-inputtext,
.p-calendar .p-inputtext {
    border-radius: 8px;
}
/* Contenedor vertical para múltiples entregables */
.entregables-stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 18px;
}

/* Base */
.entregable-row {
    height: 18px;
    border-radius: 4px;
    font-size: 0.65rem;
    display: flex;
    align-items: center;
    padding: 0 6px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* INICIO */
.entregable-row.is-start {
    background: var(--green-500);
    color: var(--primary-color-text);
    font-weight: 600;
    border-top-left-radius: 6px;
    border-bottom-left-radius: 6px;
}

/* CONTINUIDAD */
.entregable-row.is-middle {
    background: color-mix(in srgb, var(--green-500) 35%, transparent);
}

/* FIN */
.entregable-row.is-end {
    background: var(--green-700);
    color: var(--primary-color-text);
    font-weight: 600;
    border-top-right-radius: 6px;
    border-bottom-right-radius: 6px;
}

/* Hover */
.entregable-row:hover {
    filter: brightness(1.1);
}

/* =======================
   RESPONSIVE
======================= */
@media (max-width: 640px) {
    .entregable-form {
        grid-template-columns: 1fr;
    }

    .entregable-form .number,
    .entregable-form .name,
    .entregable-form .description,
    .entregable-form .date-range {
        grid-column: auto;
    }

    .entregable-form .date-range {
        grid-template-columns: 1fr;
    }

    .entregable-form .date-separator {
        display: none;
    }
}
</style>
