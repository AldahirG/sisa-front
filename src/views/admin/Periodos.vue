<script setup>
import api from '@/api/axios';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import Calendar from 'primevue/calendar';
import Column from 'primevue/column';
import ConfirmPopup from 'primevue/confirmpopup';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';

const toast = useToast();
const confirm = useConfirm();

// =======================
// STATE
// =======================
const periodos = ref([]);
const loading = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);

const periodoForm = ref({
    id_periodo: null,
    nombre: '',
    programa: '',
    fecha_inicio: null,
    fecha_fin: null,
    estado: 'cerrado'
});

// =======================
// HELPERS
// =======================
const formatDateForApi = (date) => {
    if (!date) return null;
    return new Date(date).toISOString().split('T')[0]; // YYYY-MM-DD
};

// =======================
// FETCH
// =======================
const loadPeriodos = async () => {
    try {
        loading.value = true;
        const { data } = await api.get('/periodos');
        periodos.value = data;
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar los periodos',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
};

// =======================
// MODAL
// =======================
const openNew = () => {
    isEdit.value = false;
    periodoForm.value = {
        id_periodo: null,
        nombre: '',
        programa: '',
        fecha_inicio: null,
        fecha_fin: null,
        estado: 'cerrado'
    };
    dialogVisible.value = true;
};

const editPeriodo = (p) => {
    isEdit.value = true;
    periodoForm.value = {
        ...p,
        fecha_inicio: p.fecha_inicio ? new Date(p.fecha_inicio) : null,
        fecha_fin: p.fecha_fin ? new Date(p.fecha_fin) : null
    };
    dialogVisible.value = true;
};

// =======================
// SAVE
// =======================
const savePeriodo = async () => {
    try {
        const payload = {
            ...periodoForm.value,
            fecha_inicio: formatDateForApi(periodoForm.value.fecha_inicio),
            fecha_fin: formatDateForApi(periodoForm.value.fecha_fin)
        };

        if (isEdit.value) {
            await api.put(`/periodos/${payload.id_periodo}`, payload);
            toast.add({ severity: 'success', summary: 'Actualizado', detail: 'Periodo actualizado', life: 3000 });
        } else {
            await api.post('/periodos', payload);
            toast.add({ severity: 'success', summary: 'Creado', detail: 'Periodo creado', life: 3000 });
        }

        dialogVisible.value = false;
        loadPeriodos();
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo guardar el periodo',
            life: 4000
        });
    }
};

// =======================
// ACTIVAR / CERRAR
// =======================
const toggleEstado = (event, periodo) => {
    confirm.require({
        target: event.currentTarget,
        message: `¿Deseas ${periodo.estado === 'activo' ? 'cerrar' : 'activar'} este periodo?`,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Confirmar',
        rejectLabel: 'Cancelar',
        accept: async () => {
            await api.put(`/periodos/${periodo.id_periodo}`, {
                ...periodo,
                estado: periodo.estado === 'activo' ? 'cerrado' : 'activo'
            });
            toast.add({
                severity: 'success',
                summary: 'Actualizado',
                detail: 'Estado del periodo actualizado',
                life: 3000
            });
            loadPeriodos();
        }
    });
};

onMounted(loadPeriodos);
</script>
<template>
    <div class="card">
        <!-- HEADER -->
        <div class="flex justify-between items-center mb-4">
            <h5 class="m-0">Periodos académicos</h5>
            <Button label="Nuevo periodo" icon="pi pi-calendar-plus" @click="openNew" />
        </div>

        <!-- TABLA -->
        <DataTable :value="periodos" :loading="loading" paginator :rows="10" responsiveLayout="scroll">
            <Column field="nombre" header="Periodo" />
            <Column field="programa" header="Programa" />
            <Column field="fecha_inicio" header="Inicio" />
            <Column field="fecha_fin" header="Fin" />
            <Column header="Estado">
                <template #body="{ data }">
                    <Tag :value="data.estado" :severity="data.estado === 'activo' ? 'success' : 'secondary'" />
                </template>
            </Column>
            <Column header="Acciones" style="width: 140px">
                <template #body="{ data }">
                    <Button icon="pi pi-pencil" text @click="editPeriodo(data)" />
                    <Button icon="pi pi-refresh" text severity="warning" @click="toggleEstado($event, data)" />
                </template>
            </Column>
        </DataTable>

        <!-- MODAL -->
        <Dialog v-model:visible="dialogVisible" modal header="📅 Nuevo periodo" :style="{ width: '640px' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }" :pt="{ content: { class: 'w-full' } }">
            <div class="periodo-form">
                <div class="field">
                    <label>
                        <i class="pi pi-calendar" />
                        Nombre del periodo
                    </label>
                    <InputText v-model="periodoForm.nombre" />
                </div>

                <div class="field">
                    <label>
                        <i class="pi pi-book" />
                        Programa
                    </label>
                    <InputText v-model="periodoForm.programa" />
                </div>

                <div class="field">
                    <label>
                        <i class="pi pi-calendar-plus" />
                        Fecha inicio
                    </label>
                    <Calendar v-model="periodoForm.fecha_inicio" showIcon />
                </div>

                <div class="field">
                    <label>
                        <i class="pi pi-calendar-minus" />
                        Fecha fin
                    </label>
                    <Calendar v-model="periodoForm.fecha_fin" showIcon />
                </div>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2 w-full">
                    <Button label="Cancelar" icon="pi pi-times" text @click="dialogVisible = false" />
                    <Button label="Guardar" icon="pi pi-check" severity="success" @click="savePeriodo" />
                </div>
            </template>
        </Dialog>

        <ConfirmPopup />
        <Toast />
    </div>
</template>

<style scoped>
.periodo-form {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    width: 100%;
}

.periodo-form .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.periodo-form label {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
}

/* Responsive */
@media (max-width: 640px) {
    .periodo-form {
        grid-template-columns: 1fr;
    }
}
</style>
