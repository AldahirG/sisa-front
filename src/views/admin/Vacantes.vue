<script setup>
import api from '@/api/axios';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';

const toast = useToast();
const confirm = useConfirm();

// ==========================
// STATE
// ==========================
const vacantes = ref([]);
const empresas = ref([]);
const periodos = ref([]);

const loadingTable = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);

// FORM ÚNICO
const vacanteForm = ref(resetForm());

// ==========================
// FILTROS
// ==========================
const filtros = ref({
    empresa: null,
    periodo: null,
    activa: null,
    search: ''
});

// ==========================
// HELPERS
// ==========================
function resetForm() {
    return {
        id_categoria: null,
        id_empresa: null,
        id_periodo: null,
        nombre: '',
        descripcion: '',
        cupo_total: 1,
        activa: true
    };
}

// ==========================
// LOADERS
// ==========================
const loadVacantes = async () => {
    loadingTable.value = true;
    try {
        const { data } = await api.get('/vacantes');
        vacantes.value = data;
    } finally {
        loadingTable.value = false;
    }
};

const loadEmpresas = async () => {
    const { data } = await api.get('/empresas');
    empresas.value = data;
};

const loadPeriodos = async () => {
    const { data } = await api.get('/periodos/activos');
    periodos.value = data;
};

onMounted(async () => {
    await Promise.all([loadVacantes(), loadEmpresas(), loadPeriodos()]);
});

// ==========================
// COMPUTED
// ==========================
const vacantesFiltradas = computed(() => {
    return vacantes.value.filter((v) => {
        const matchEmpresa = !filtros.value.empresa || v.empresa?.id_empresa === filtros.value.empresa.id_empresa;

        const matchPeriodo = !filtros.value.periodo || v.periodo?.id_periodo === filtros.value.periodo.id_periodo;

        const matchActiva = filtros.value.activa === null || v.activa === filtros.value.activa;

        const search = filtros.value.search?.toLowerCase() || '';
        const matchSearch = !search || v.nombre.toLowerCase().includes(search) || v.empresa?.nombre.toLowerCase().includes(search);

        return matchEmpresa && matchPeriodo && matchActiva && matchSearch;
    });
});

// ==========================
// CRUD
// ==========================
const openCreate = () => {
    isEdit.value = false;
    vacanteForm.value = {
        ...resetForm(),
        id_periodo: periodos.value[0]?.id_periodo ?? null
    };
    dialogVisible.value = true;
};

const openEdit = (row) => {
    if (!row) return;

    isEdit.value = true;
    vacanteForm.value = {
        id_categoria: row.id_categoria,
        id_empresa: row.empresa?.id_empresa ?? null,
        id_periodo: row.periodo?.id_periodo ?? null,
        nombre: row.nombre ?? '',
        descripcion: row.descripcion ?? '',
        cupo_total: row.cupo_total ?? 1,
        activa: row.activa ?? true
    };

    dialogVisible.value = true;
};

const saveVacante = async () => {
    if (!vacanteForm.value.id_empresa || !vacanteForm.value.id_periodo) {
        toast.add({
            severity: 'warn',
            summary: 'Campos incompletos',
            detail: 'Selecciona empresa y periodo',
            life: 3000
        });
        return;
    }

    saving.value = true;
    try {
        if (isEdit.value) {
            await api.put(`/vacantes/${vacanteForm.value.id_categoria}`, vacanteForm.value);
            toast.add({ severity: 'success', summary: 'Vacante actualizada', life: 3000 });
        } else {
            await api.post('/vacantes', vacanteForm.value);
            toast.add({ severity: 'success', summary: 'Vacante creada', life: 3000 });
        }

        dialogVisible.value = false;
        await loadVacantes();
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e.response?.data?.message || 'Error al guardar',
            life: 5000
        });
    } finally {
        saving.value = false;
    }
};

const desactivar = (row) => {
    confirm.require({
        message: '¿Desactivar esta vacante?',
        header: 'Confirmación',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, desactivar',
        rejectLabel: 'Cancelar',
        accept: async () => {
            try {
                await api.put(`/vacantes/${row.id_categoria}/desactivar`);
                toast.add({ severity: 'success', summary: 'Vacante desactivada', life: 3000 });
                await loadVacantes();
            } catch (e) {
                toast.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: e.response?.data?.message || 'No se pudo desactivar',
                    life: 5000
                });
            }
        }
    });
};

const activar = (row) => {
    confirm.require({
        message: '¿Activar esta vacante?',
        header: 'Confirmación',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, activar',
        rejectLabel: 'Cancelar',
        accept: async () => {
            try {
                await api.put(`/vacantes/${row.id_categoria}/activar`);
                toast.add({ severity: 'success', summary: 'Vacante activada', life: 3000 });
                await loadVacantes();
            } catch (e) {
                toast.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: e.response?.data?.message || 'No se pudo activar',
                    life: 5000
                });
            }
        }
    });
};

// ==========================
// UTILS
// ==========================
const cupoSeverity = (row) => {
    if (row.cupo_disponible === 0) return 'danger';
    if (row.cupo_disponible <= 2) return 'warning';
    return 'success';
};
</script>

<template>
    <div class="card">
        <!-- ===================== -->
        <!-- HEADER -->
        <!-- ===================== -->
        <div class="flex justify-between items-center mb-3">
            <h2 class="text-xl font-semibold">Vacantes</h2>
            <Button label="Nueva vacante" icon="pi pi-plus" @click="openCreate" />
        </div>

        <!-- ===================== -->
        <!-- FILTROS -->
        <!-- ===================== -->
        <div class="filters-grid">
            <Dropdown v-model="filtros.empresa" :options="empresas" optionLabel="nombre" placeholder="Empresa" showClear />

            <Dropdown v-model="filtros.periodo" :options="periodos" optionLabel="nombre" placeholder="Periodo" showClear />

            <Dropdown
                v-model="filtros.activa"
                :options="[
                    { label: 'Activas', value: true },
                    { label: 'Inactivas', value: false }
                ]"
                optionLabel="label"
                optionValue="value"
                placeholder="Estado"
                showClear
            />

            <InputText v-model="filtros.search" placeholder="Buscar vacante o empresa" />
        </div>

        <!-- ===================== -->
        <!-- TABLA -->
        <!-- ===================== -->
        <DataTable :value="vacantesFiltradas" paginator :rows="10" :loading="loadingTable" responsiveLayout="scroll">
            <Column field="empresa.nombre" header="Empresa" />
            <Column field="nombre" header="Vacante" />

            <Column header="Cupos">
                <template #body="{ data }">
                    <Tag :value="`${data.cupo_disponible} / ${data.cupo_total}`" :severity="cupoSeverity(data)" />
                </template>
            </Column>

            <Column field="periodo.nombre" header="Periodo" />

            <Column header="Estado">
                <template #body="{ data }">
                    <Tag :value="data.activa ? 'Activa' : 'Inactiva'" :severity="data.activa ? 'success' : 'danger'" />
                </template>
            </Column>

            <Column header="Acciones">
                <template #body="{ data }">
                    <Button icon="pi pi-pencil" text @click="openEdit(data)" />

                    <!-- DESACTIVAR -->
                    <Button v-if="data.activa" icon="pi pi-ban" text severity="danger" @click="desactivar(data)" />

                    <!-- ACTIVAR -->
                    <Button v-else icon="pi pi-check" text severity="success" @click="activar(data)" />
                </template>
            </Column>
        </DataTable>

        <!-- ===================== -->
        <!-- MODAL CREAR / EDITAR -->
        <!-- ===================== -->
        <Dialog v-model:visible="dialogVisible" modal :header="isEdit ? '✏️ Editar vacante' : '🧩 Nueva vacante'" :style="{ width: '640px' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }" :pt="{ content: { class: 'dialog-content-full' } }">
            <div class="dialog-form">
                <div class="form-grid">
                    <!-- Empresa -->
                    <div class="form-field">
                        <label>
                            <i class="pi pi-building" />
                            Empresa
                        </label>
                        <Dropdown v-model="vacanteForm.id_empresa" :options="empresas" optionLabel="nombre" optionValue="id_empresa" placeholder="Selecciona empresa" />
                    </div>

                    <!-- Periodo -->
                    <div class="form-field">
                        <label>
                            <i class="pi pi-calendar" />
                            Periodo
                        </label>
                        <Dropdown v-model="vacanteForm.id_periodo" :options="periodos" optionLabel="nombre" optionValue="id_periodo" :disabled="isEdit" placeholder="Selecciona periodo" />
                    </div>

                    <!-- Nombre -->
                    <div class="form-field">
                        <label>
                            <i class="pi pi-briefcase" />
                            Nombre de la vacante
                        </label>
                        <InputText v-model="vacanteForm.nombre" />
                    </div>

                    <!-- Cupo -->
                    <div class="form-field">
                        <label>
                            <i class="pi pi-users" />
                            Cupo total
                        </label>
                        <InputNumber v-model="vacanteForm.cupo_total" :min="1" showButtons />
                    </div>

                    <!-- Descripción -->
                    <div class="form-field" style="grid-column: span 2">
                        <label>
                            <i class="pi pi-align-left" />
                            Descripción
                        </label>
                        <Textarea v-model="vacanteForm.descripcion" rows="3" />
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <Button label="Cancelar" icon="pi pi-times" text @click="dialogVisible = false" />
                    <Button label="Guardar" icon="pi pi-check" severity="success" :loading="saving" @click="saveVacante" />
                </div>
            </template>
        </Dialog>

        <template>
            <ConfirmDialog />
            <RouterView />
        </template>
    </div>
</template>

<style scoped>
/* =========================
   CONTENEDOR GENERAL
========================= */
.card {
    width: 100%;
}

/* =========================
   FILTROS
========================= */
.filters-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    margin-bottom: 1.25rem;
}

@media (max-width: 900px) {
    .filters-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 640px) {
    .filters-grid {
        grid-template-columns: 1fr;
    }
}

/* =========================
   CELDA CUPOS
========================= */
.cupo-cell {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

/* =========================
   DIALOG FIX PRIMEVUE
========================= */
/* Fuerza ancho real del contenido */
:deep(.dialog-content-full) {
    width: 100%;
    display: block;
    padding: 1.5rem;
}

/* =========================
   FORMULARIO MODAL
========================= */
.dialog-form {
    width: 100%;
}

/* Grid principal del formulario */
.form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.25rem;
}

/* Campo individual */
.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

/* Labels */
.form-field label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
    line-height: 1.2;
}

/* Inputs full width */
.form-field :deep(input),
.form-field :deep(.p-dropdown),
.form-field :deep(.p-inputnumber),
.form-field :deep(.p-textarea) {
    width: 100%;
}

/* =========================
   FOOTER MODAL
========================= */
.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    width: 100%;
}

/* =========================
   RESPONSIVE MODAL
========================= */
@media (max-width: 640px) {
    .form-grid {
        grid-template-columns: 1fr;
    }
}
</style>
