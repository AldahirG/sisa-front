<script setup>
import api from '@/api/axios';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import Column from 'primevue/column';
import ConfirmDialog from 'primevue/confirmdialog';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import { useConfirm } from 'primevue/useconfirm';

const toast = useToast();
const confirm = useConfirm();

// =====================
// STATE
// =====================
const entregables = ref([]);
const loading = ref(false);

const showDialog = ref(false);
const selectedEntregable = ref(null);
const archivoUrl = ref('');
const submitting = ref(false);

// =====================
// LOAD
// =====================
const loadEntregables = async () => {
    loading.value = true;
    try {
        const { data } = await api.get('/entregables/me');
        entregables.value = data ?? [];
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar los entregables'
        });
    } finally {
        loading.value = false;
    }
};

onMounted(loadEntregables);

// =====================
// HELPERS
// =====================
const isExpired = (fecha) => {
    if (!fecha) return false;
    return new Date(fecha) < new Date();
};

const canUpload = (row) => {
    if (isExpired(row.fecha_limite)) return false;
    if (row.estado === 'evaluado') return false;
    return true;
};

const estadoLabel = (row) => {
    if (isExpired(row.fecha_limite)) return 'Expirado';
    return row.estado;
};

const estadoSeverity = (row) => {
    if (isExpired(row.fecha_limite)) return 'danger';
    if (row.estado === 'evaluado') return 'success';
    if (row.estado === 'entregado') return 'info';
    return 'warning';
};

// =====================
// ACTIONS
// =====================
const abrirDialogo = (row) => {
    selectedEntregable.value = row;
    archivoUrl.value = row.archivo_url ?? '';
    showDialog.value = true;
};

const confirmarEnvio = () => {
    if (!archivoUrl.value) {
        toast.add({
            severity: 'warn',
            summary: 'Validación',
            detail: 'Debes ingresar un enlace válido'
        });
        return;
    }

    confirm.require({
        message: '¿Estás seguro de enviar este enlace? No podrás modificarlo después.',
        header: 'Confirmar entrega',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, enviar',
        rejectLabel: 'Cancelar',
        accept: enviarEntrega
    });
};

const enviarEntrega = async () => {
    submitting.value = true;
    try {
        await api.post(`/entregables/entregar/${selectedEntregable.value.id_entregable}`, { archivo_url: archivoUrl.value });

        toast.add({
            severity: 'success',
            summary: 'Entrega enviada correctamente'
        });

        showDialog.value = false;
        loadEntregables();
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e.response?.data?.message || 'No se pudo enviar la entrega'
        });
    } finally {
        submitting.value = false;
    }
};
</script>

<template>
    <div class="card">
        <h2 class="text-xl font-semibold mb-3">Mis Entregables</h2>

        <DataTable :value="entregables" :loading="loading" paginator :rows="10" responsiveLayout="scroll">
            <Column field="nombre" header="Entregable" />
            <Column field="fecha_limite" header="Fecha límite" />

            <Column header="Estado">
                <template #body="{ data }">
                    <Tag :value="estadoLabel(data)" :severity="estadoSeverity(data)" />
                </template>
            </Column>

            <Column header="Archivo">
                <template #body="{ data }">
                    <a v-if="data.archivo_url" :href="data.archivo_url" target="_blank"> Ver archivo </a>
                    <span v-else>-</span>
                </template>
            </Column>

            <Column header="Calificación">
                <template #body="{ data }">
                    <div v-if="data.calificacion !== null">
                        <strong>{{ data.calificacion }}</strong>
                        <div class="text-sm text-muted">
                            {{ data.observaciones }}
                        </div>
                    </div>
                    <span v-else>-</span>
                </template>
            </Column>

            <Column header="Acciones" style="width: 160px">
                <template #body="{ data }">
                    <Button icon="pi pi-upload" label="Subir" size="small" :disabled="!canUpload(data)" @click="abrirDialogo(data)" />
                </template>
            </Column>
        </DataTable>
    </div>

    <!-- DIALOG SUBIR -->
    <Dialog v-model:visible="showDialog" header="Subir entregable" modal style="width: 450px">
        <div class="flex flex-column gap-2 mb-3">
            <strong>{{ selectedEntregable?.nombre }}</strong>
            <small class="text-muted"> Fecha límite: {{ selectedEntregable?.fecha_limite }} </small>
        </div>

        <InputText v-model="archivoUrl" placeholder="Enlace del archivo (Drive, OneDrive, etc.)" />

        <template #footer>
            <div class="flex justify-end gap-2">
                <Button label="Cancelar" text @click="showDialog = false" />
                <Button label="Enviar" icon="pi pi-check" :loading="submitting" @click="confirmarEnvio" />
            </div>
        </template>
    </Dialog>

    <ConfirmDialog />
</template>
