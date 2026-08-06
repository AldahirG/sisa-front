<script setup>
import api from '@/api/axios';
import Button from 'primevue/button';
import ConfirmDialog from 'primevue/confirmdialog';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from '@/composables/useAppToast';
import { computed, onMounted, ref } from 'vue';

const toast = useToast();
const confirm = useConfirm();

// ==========================
// CATÁLOGOS
// ==========================
const carrerasCatalogo = [
    'LCP','LCO','CORP','LED','LID','LPE','LPS','LRI','RICP','RIEC',
    'LAE','LAET','LANI','LAM','LCE','LEF','LEMP','ARQ','LADD','LDG',
    'LDI','LDM','IAM','ICI','IISCA','IME','IMI','ISC'
].map((c) => ({ label: c, value: c }));

// ==========================
// STATE
// ==========================
const loading = ref(false);
const saving = ref(false);
const niveles = ref([]);

const showDialog = ref(false);
const editMode = ref(false);

const filtroCarrera = ref(null);

const form = ref({
    id: null,
    carrera: '',
    numero_practica: null,
    cuatrimestre: null
});

// ==========================
// LOADERS
// ==========================
const loadNiveles = async () => {
    loading.value = true;
    try {
        const params = filtroCarrera.value ? { carrera: filtroCarrera.value } : {};
        const { data } = await api.get('/niveles-practica', { params });
        niveles.value = data ?? [];
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudieron cargar los niveles', life: 4000 });
    } finally {
        loading.value = false;
    }
};

onMounted(loadNiveles);

// ==========================
// COMPUTED
// ==========================
const nivelesOrdenados = computed(() =>
    [...niveles.value].sort((a, b) =>
        (a.carrera || '').localeCompare(b.carrera || '') ||
        (a.numero_practica ?? 0) - (b.numero_practica ?? 0)
    )
);

// Resumen agrupado por carrera para los badges del header
const resumenCarreras = computed(() => {
    const map = new Map();
    for (const n of niveles.value) {
        const c = n.carrera;
        if (!map.has(c)) map.set(c, 0);
        map.set(c, map.get(c) + 1);
    }
    return map.size;
});

// ==========================
// CRUD MODAL
// ==========================
const abrirNuevo = () => {
    editMode.value = false;
    form.value = { id: null, carrera: '', numero_practica: null, cuatrimestre: null };
    showDialog.value = true;
};

const abrirEditar = (row) => {
    editMode.value = true;
    form.value = { id: row.id, carrera: row.carrera, numero_practica: row.numero_practica, cuatrimestre: row.cuatrimestre };
    showDialog.value = true;
};

const guardar = async () => {
    if (!form.value.carrera || !form.value.numero_practica || !form.value.cuatrimestre) {
        toast.add({ severity: 'warn', summary: 'Campos requeridos', detail: 'Completa todos los campos', life: 3000 });
        return;
    }

    saving.value = true;
    try {
        if (editMode.value) {
            await api.put(`/niveles-practica/${form.value.id}`, {
                carrera: form.value.carrera,
                numero_practica: form.value.numero_practica,
                cuatrimestre: form.value.cuatrimestre
            });
            toast.add({ severity: 'success', summary: 'Actualizado', detail: 'Nivel de práctica actualizado', life: 3000 });
        } else {
            await api.post('/niveles-practica', {
                carrera: form.value.carrera,
                numero_practica: form.value.numero_practica,
                cuatrimestre: form.value.cuatrimestre
            });
            toast.add({ severity: 'success', summary: 'Creado', detail: 'Nivel de práctica registrado', life: 3000 });
        }
        showDialog.value = false;
        await loadNiveles();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo guardar', life: 4000 });
    } finally {
        saving.value = false;
    }
};

const eliminar = (row) => {
    confirm.require({
        message: `¿Eliminar el nivel de práctica ${row.numero_practica} para ${row.carrera} (semestre ${row.cuatrimestre})?`,
        header: 'Confirmar eliminación',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await api.delete(`/niveles-practica/${row.id}`);
                toast.add({ severity: 'success', summary: 'Eliminado', detail: `Nivel ${row.numero_practica} de ${row.carrera} eliminado`, life: 3000 });
                await loadNiveles();
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo eliminar', life: 4000 });
            }
        }
    });
};

// ==========================
// FILTRO
// ==========================
const onFiltroChange = () => loadNiveles();
</script>

<template>
    <div class="page-container">
        <!-- ========================= -->
        <!-- HEADER                    -->
        <!-- ========================= -->
        <div class="page-header">
            <div class="header-left">
                <div class="header-icon">
                    <i class="pi pi-list-check"></i>
                </div>
                <div class="header-text">
                    <h1 class="page-title">Niveles de Práctica</h1>
                    <p class="page-subtitle">Plan de estudios: carrera → práctica → semestre</p>
                </div>
            </div>

            <div class="header-right">
                <div class="badge badge-blue">
                    <span class="badge-num">{{ niveles.length }}</span>
                    <span class="badge-lbl">Niveles</span>
                </div>
                <div class="badge badge-green">
                    <span class="badge-num">{{ resumenCarreras }}</span>
                    <span class="badge-lbl">Carreras</span>
                </div>
                <Button icon="pi pi-plus" label="Agregar nivel" @click="abrirNuevo" />
            </div>
        </div>

        <!-- ========================= -->
        <!-- FILTRO                    -->
        <!-- ========================= -->
        <div class="filters-bar">
            <div class="filter-label">
                <i class="pi pi-filter"></i>
                <span>Filtrar por carrera</span>
            </div>
            <Select
                v-model="filtroCarrera"
                :options="carrerasCatalogo"
                optionLabel="label"
                optionValue="value"
                placeholder="Todas las carreras"
                showClear
                class="filter-select"
                @change="onFiltroChange"
            />
            <Button
                icon="pi pi-refresh"
                text
                rounded
                v-tooltip.top="'Recargar'"
                :loading="loading"
                @click="loadNiveles"
            />
        </div>

        <!-- ========================= -->
        <!-- TABLA                     -->
        <!-- ========================= -->
        <div class="table-wrap">
            <DataTable
                :value="nivelesOrdenados"
                :loading="loading"
                paginator
                :rows="15"
                responsiveLayout="scroll"
                :rowHover="true"
                class="np-table"
            >
                <!-- CARRERA -->
                <Column header="Carrera" style="min-width: 120px">
                    <template #body="{ data }">
                        <Tag :value="data.carrera" severity="info" class="carrera-tag" />
                    </template>
                </Column>

                <!-- N° PRÁCTICA -->
                <Column header="N° Práctica" style="min-width: 130px">
                    <template #body="{ data }">
                        <div class="practica-cell">
                            <div class="practica-num">{{ data.numero_practica }}</div>
                            <span class="practica-lbl">práctica</span>
                        </div>
                    </template>
                </Column>

                <!-- CUATRIMESTRE -->
                <Column header="Semestre" style="min-width: 150px">
                    <template #body="{ data }">
                        <div class="cuatrimestre-cell">
                            <i class="pi pi-book cuatri-icon"></i>
                            <span class="cuatri-num">{{ data.cuatrimestre }}°</span>
                            <span class="cuatri-lbl">semestre</span>
                        </div>
                    </template>
                </Column>

                <!-- ACCIONES -->
                <Column header="Acciones" style="width: 120px">
                    <template #body="{ data }">
                        <div class="actions-cell">
                            <Button
                                icon="pi pi-pencil"
                                text
                                rounded
                                severity="info"
                                size="small"
                                v-tooltip.top="'Editar'"
                                @click="abrirEditar(data)"
                            />
                            <Button
                                icon="pi pi-trash"
                                text
                                rounded
                                severity="danger"
                                size="small"
                                v-tooltip.top="'Eliminar'"
                                @click="eliminar(data)"
                            />
                        </div>
                    </template>
                </Column>

                <!-- EMPTY -->
                <template #empty>
                    <div class="empty-state">
                        <i class="pi pi-inbox"></i>
                        <span>No hay niveles de práctica configurados{{ filtroCarrera ? ` para ${filtroCarrera}` : '' }}</span>
                        <Button label="Agregar el primero" icon="pi pi-plus" text size="small" @click="abrirNuevo" />
                    </div>
                </template>
            </DataTable>
        </div>

        <!-- INFO BOX -->
        <div class="info-box">
            <i class="pi pi-info-circle"></i>
            <div class="info-text">
                <strong>¿Para qué sirve esta configuración?</strong>
                Al avanzar semestres al final de un período, el sistema consulta esta tabla para saber
                a qué semestre debe pasar cada alumno según su carrera y número de práctica actual.
                Los alumnos sin nivel configurado o dados de baja no se verán afectados.
            </div>
        </div>
    </div>

    <ConfirmDialog />

    <!-- ========================= -->
    <!-- DIALOG CREAR / EDITAR     -->
    <!-- ========================= -->
    <Dialog
        v-model:visible="showDialog"
        modal
        :header="editMode ? 'Editar nivel de práctica' : 'Nuevo nivel de práctica'"
        :style="{ width: '420px' }"
    >
        <div class="dialog-form">
            <div class="form-field">
                <label class="form-label">Carrera <span class="required">*</span></label>
                <Select
                    v-model="form.carrera"
                    :options="carrerasCatalogo"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Selecciona una carrera"
                    class="w-full"
                    filter
                />
            </div>

            <div class="form-row">
                <div class="form-field">
                    <label class="form-label">N° de Práctica <span class="required">*</span></label>
                    <InputNumber
                        v-model="form.numero_practica"
                        :min="1"
                        :max="10"
                        placeholder="Ej: 1"
                        class="w-full"
                        showButtons
                    />
                    <small class="form-hint">¿Cuál práctica es? (1ª, 2ª…)</small>
                </div>
                <div class="form-field">
                    <label class="form-label">Semestre <span class="required">*</span></label>
                    <InputNumber
                        v-model="form.cuatrimestre"
                        :min="1"
                        :max="15"
                        placeholder="Ej: 8"
                        class="w-full"
                        showButtons
                    />
                    <small class="form-hint">Cuatrimestre en que está</small>
                </div>
            </div>

            <!-- Preview -->
            <div class="preview-box" v-if="form.carrera && form.numero_practica && form.cuatrimestre">
                <i class="pi pi-eye"></i>
                <span>
                    Alumno de <strong>{{ form.carrera }}</strong> en su
                    <strong>práctica {{ form.numero_practica }}</strong> →
                    debe estar en <strong>{{ form.cuatrimestre }}° semestre</strong>
                </span>
            </div>
        </div>

        <template #footer>
            <Button text label="Cancelar" @click="showDialog = false" />
            <Button
                :label="editMode ? 'Guardar cambios' : 'Agregar nivel'"
                icon="pi pi-check"
                :loading="saving"
                @click="guardar"
            />
        </template>
    </Dialog>
</template>

<style scoped>
/* ================================
   PAGE CONTAINER
================================ */
.page-container {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* ================================
   HEADER
================================ */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.header-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.12));
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
}

.page-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0;
    line-height: 1.2;
}

.page-subtitle {
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
    margin: 0.15rem 0 0 0;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

/* ================================
   BADGES
================================ */
.badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.4rem 0.75rem;
    border-radius: 10px;
    min-width: 58px;
}

.badge-blue {
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.1));
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
}

.badge-green {
    background: var(--sisa-tint-green, rgba(22, 163, 74, 0.1));
    color: var(--sisa-icon-green, #16a34a);
}

.badge-num {
    font-size: 1.15rem;
    font-weight: 700;
    line-height: 1;
}

.badge-lbl {
    font-size: 0.7rem;
    font-weight: 500;
    opacity: 0.85;
    white-space: nowrap;
}

/* ================================
   FILTERS BAR
================================ */
.filters-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.875rem 1rem;
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 12px;
}

.filter-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
    white-space: nowrap;
}

.filter-select {
    min-width: 200px;
}

/* ================================
   TABLE
================================ */
.table-wrap {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 12px;
    overflow: hidden;
}

.np-table :deep(.p-datatable-thead > tr > th) {
    background: var(--p-surface-50);
    color: var(--p-text-muted-color);
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--p-content-border-color);
}

.np-table :deep(.p-datatable-tbody > tr > td) {
    border-bottom: 1px solid var(--p-content-border-color);
    padding: 0.75rem 1rem;
    vertical-align: middle;
}

.np-table :deep(.p-datatable-tbody > tr:last-child > td) {
    border-bottom: none;
}

/* ================================
   CELL STYLES
================================ */
.carrera-tag {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
}

.practica-cell {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
}

.practica-num {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
    line-height: 1;
}

.practica-lbl {
    font-size: 0.78rem;
    color: var(--p-text-muted-color);
}

.cuatrimestre-cell {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.cuatri-icon {
    font-size: 0.85rem;
    color: var(--sisa-icon-green, #16a34a);
}

.cuatri-num {
    font-size: 1rem;
    font-weight: 700;
    color: var(--p-text-color);
}

.cuatri-lbl {
    font-size: 0.78rem;
    color: var(--p-text-muted-color);
}

.actions-cell {
    display: flex;
    gap: 0.25rem;
    align-items: center;
}

/* ================================
   EMPTY STATE
================================ */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 2.5rem;
    color: var(--p-text-muted-color);
    font-size: 0.88rem;
}

.empty-state .pi-inbox {
    font-size: 2rem;
    opacity: 0.4;
}

/* ================================
   INFO BOX
================================ */
.info-box {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 10px;
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.06));
    border: 1px solid rgba(21, 101, 192, 0.15);
    color: var(--p-text-color);
    font-size: 0.85rem;
    line-height: 1.55;
}

.info-box > .pi {
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
    font-size: 1rem;
    flex-shrink: 0;
    margin-top: 0.1rem;
}

.info-text {
    flex: 1;
}

/* ================================
   DIALOG FORM
================================ */
.dialog-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 0.25rem 0 0.25rem;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.form-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.required {
    color: var(--sisa-icon-red, #dc2626);
    margin-left: 0.1rem;
}

.form-hint {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
}

.preview-box {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.65rem 0.875rem;
    border-radius: 8px;
    background: var(--sisa-tint-green, rgba(22, 163, 74, 0.08));
    color: var(--sisa-icon-green, #16a34a);
    font-size: 0.85rem;
    line-height: 1.45;
}

.preview-box > .pi {
    flex-shrink: 0;
    margin-top: 0.1rem;
}

/* ================================
   RESPONSIVE
================================ */
@media (max-width: 768px) {
    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .header-right {
        width: 100%;
    }

    .form-row {
        grid-template-columns: 1fr;
    }
}
</style>
