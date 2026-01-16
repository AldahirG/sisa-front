<script setup>
import api from '@/api/axios';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import Column from 'primevue/column';
import ConfirmDialog from 'primevue/confirmdialog';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';

const toast = useToast();
const confirm = useConfirm();

// ==========================
// STATE
// ==========================
const postulaciones = ref([]);
const loading = ref(false);

const rechazoDialog = ref(false);
const rechazoMotivo = ref('');
const postulacionSeleccionada = ref(null);

// ==========================
// FILTROS
// ==========================
const filtros = ref({
    estado: null,
    empresa: null,
    periodo: null,
    search: ''
});

// ==========================
// LOAD
// ==========================
const loadPostulaciones = async () => {
    loading.value = true;
    try {
        const { data } = await api.get('/postulaciones');
        postulaciones.value = data;
    } finally {
        loading.value = false;
    }
};

onMounted(loadPostulaciones);

// ==========================
// COMPUTED
// ==========================
const empresas = computed(() => {
    const map = new Map();
    postulaciones.value.forEach((p) => {
        if (p.categoria?.empresa) {
            map.set(p.categoria.empresa.id_empresa, p.categoria.empresa);
        }
    });
    return [...map.values()];
});

const periodos = computed(() => {
    const map = new Map();
    postulaciones.value.forEach((p) => {
        if (p.categoria?.periodo) {
            map.set(p.categoria.periodo.id_periodo, p.categoria.periodo);
        }
    });
    return [...map.values()];
});

const postulacionesFiltradas = computed(() => {
    return postulaciones.value.filter((p) => {
        const matchEstado = !filtros.value.estado || p.estado === filtros.value.estado;

        const matchEmpresa = !filtros.value.empresa || p.categoria?.empresa?.id_empresa === filtros.value.empresa.id_empresa;

        const matchPeriodo = !filtros.value.periodo || p.categoria?.periodo?.id_periodo === filtros.value.periodo.id_periodo;

        const search = filtros.value.search?.toLowerCase() || '';
        const matchSearch = !search || p.alumno?.usuario?.nombre?.toLowerCase().includes(search) || p.alumno?.usuario?.correo?.toLowerCase().includes(search) || p.categoria?.nombre?.toLowerCase().includes(search);

        return matchEstado && matchEmpresa && matchPeriodo && matchSearch;
    });
});

// ==========================
// ACTIONS
// ==========================
const aceptar = (row) => {
    confirm.require({
        message: '¿Aceptar esta postulación?',
        acceptLabel: 'Aceptar',
        rejectLabel: 'Cancelar',
        accept: async () => {
            await api.put(`/postulaciones/${row.id_postulacion}/aceptar`);
            toast.add({
                severity: 'success',
                summary: 'Postulación aceptada',
                life: 3000
            });
            loadPostulaciones();
        }
    });
};

const abrirRechazo = (row) => {
    postulacionSeleccionada.value = row;
    rechazoMotivo.value = '';
    rechazoDialog.value = true;
};

const rechazar = async () => {
    await api.put(`/postulaciones/${postulacionSeleccionada.value.id_postulacion}/rechazar`, { motivo: rechazoMotivo.value });

    rechazoDialog.value = false;

    toast.add({
        severity: 'warn',
        summary: 'Postulación rechazada',
        life: 3000
    });

    loadPostulaciones();
};

// ==========================
// UTILS
// ==========================
const estadoSeverity = (estado) => {
    if (estado === 'ACEPTADO') return 'success';
    if (estado === 'RECHAZADO') return 'danger';
    return 'warning';
};
</script>

<template>
    <div class="card">
        <ConfirmDialog />

        <!-- HEADER -->
        <div class="flex justify-between items-center mb-3">
            <h2 class="text-xl font-semibold">Postulaciones</h2>
        </div>

        <!-- FILTROS -->
        <div class="filters-grid">
            <Dropdown
                v-model="filtros.estado"
                :options="[
                    { label: 'Postulado', value: 'POSTULADO' },
                    { label: 'Aceptado', value: 'ACEPTADO' },
                    { label: 'Rechazado', value: 'RECHAZADO' }
                ]"
                optionLabel="label"
                optionValue="value"
                placeholder="Estado"
                showClear
            />

            <Dropdown v-model="filtros.empresa" :options="empresas" optionLabel="nombre" placeholder="Empresa" showClear />

            <Dropdown v-model="filtros.periodo" :options="periodos" optionLabel="nombre" placeholder="Periodo" showClear />

            <InputText v-model="filtros.search" placeholder="Buscar alumno o vacante" />
        </div>

        <!-- TABLA -->
        <DataTable :value="postulacionesFiltradas" paginator :rows="10" :loading="loading" responsiveLayout="scroll">
            <Column field="alumno.usuario.nombre" header="Alumno" />
            <Column field="alumno.usuario.correo" header="Correo" />
            <Column field="categoria.empresa.nombre" header="Empresa" />
            <Column field="categoria.nombre" header="Vacante" />
            <Column field="categoria.periodo.nombre" header="Periodo" />

            <Column header="Estado">
                <template #body="{ data }">
                    <Tag :value="data.estado" :severity="estadoSeverity(data.estado)" />
                </template>
            </Column>

            <Column header="Acciones">
                <template #body="{ data }">
                    <Button v-if="data.estado === 'POSTULADO'" icon="pi pi-check" text severity="success" @click="aceptar(data)" />
                    <Button v-if="data.estado === 'POSTULADO'" icon="pi pi-times" text severity="danger" @click="abrirRechazo(data)" />
                </template>
            </Column>
        </DataTable>

        <!-- MODAL RECHAZO -->
        <Dialog v-model:visible="rechazoDialog" modal header="Rechazar postulación" :style="{ width: '480px' }" :pt="{ content: { class: 'dialog-content-full' } }">
            <div class="form-field">
                <label>Motivo del rechazo</label>
                <Textarea v-model="rechazoMotivo" rows="3" />
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <Button label="Cancelar" text @click="rechazoDialog = false" />
                    <Button label="Rechazar" severity="danger" @click="rechazar" />
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.filters-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    margin-bottom: 1.25rem;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
}

@media (max-width: 640px) {
    .filters-grid {
        grid-template-columns: 1fr;
    }
}
</style>
