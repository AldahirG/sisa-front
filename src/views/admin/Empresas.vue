<script setup>
import api from '@/api/axios';
import { useToast } from 'primevue/usetoast';
import { onMounted, ref } from 'vue';
import * as XLSX from 'xlsx';

// PrimeVue
import Button from 'primevue/button';
import Column from 'primevue/column';
import ConfirmPopup from 'primevue/confirmpopup';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import { useConfirm } from 'primevue/useconfirm';

const toast = useToast();
const confirm = useConfirm();

// =======================
// STATE
// =======================
const empresas = ref([]);
const loading = ref(false);

// CRUD dialog
const dialogVisible = ref(false);
const isEdit = ref(false);

// Import dialog
const showImportDialog = ref(false);
const excelPreview = ref([]);
const importing = ref(false);

// Form empresa + contacto
const empresaForm = ref({
    id_empresa: null,
    nombre: '',
    giro: '',
    sector: 'PRIVADA',
    rfc: '',
    direccion: '',
    sitio_web: '',
    activa: true,

    // contacto
    contacto_nombre: '',
    contacto_cargo: '',
    contacto_telefono: '',
    contacto_correo: ''
});

// Filtros
const filters = ref({
    global: { value: null, matchMode: 'contains' }
});

const sectores = [
    { label: 'Pública', value: 'PUBLICA' },
    { label: 'Privada', value: 'PRIVADA' },
    { label: 'Social', value: 'SOCIAL' }
];

// =======================
// FETCH
// =======================
const loadEmpresas = async () => {
    try {
        loading.value = true;
        const { data } = await api.get('/empresas');
        empresas.value = data ?? [];
    } finally {
        loading.value = false;
    }
};

onMounted(loadEmpresas);

// =======================
// CRUD
// =======================
const openNew = () => {
    isEdit.value = false;
    empresaForm.value = {
        id_empresa: null,
        nombre: '',
        giro: '',
        sector: 'PRIVADA',
        rfc: '',
        direccion: '',
        sitio_web: '',
        activa: true,
        contacto_nombre: '',
        contacto_cargo: '',
        contacto_telefono: '',
        contacto_correo: ''
    };
    dialogVisible.value = true;
};

const editEmpresa = (empresa) => {
    const contacto = empresa.contactos?.find((c) => c.principal) || {};
    isEdit.value = true;
    empresaForm.value = {
        ...empresa,
        contacto_nombre: contacto.nombre_contacto ?? '',
        contacto_cargo: contacto.cargo ?? '',
        contacto_telefono: contacto.telefono ?? '',
        contacto_correo: contacto.correo ?? ''
    };
    dialogVisible.value = true;
};

const saveEmpresa = async () => {
    try {
        let empresaId = empresaForm.value.id_empresa;

        if (isEdit.value) {
            await api.put(`/empresas/${empresaId}`, empresaForm.value);
        } else {
            const { data } = await api.post('/empresas', empresaForm.value);
            empresaId = data.id_empresa;
        }

        // Crear / actualizar contacto principal
        await api.post(`/empresas/${empresaId}/contactos`, {
            nombre_contacto: empresaForm.value.contacto_nombre,
            cargo: empresaForm.value.contacto_cargo,
            telefono: empresaForm.value.contacto_telefono,
            correo: empresaForm.value.contacto_correo,
            principal: true,
            activo: true
        });

        toast.add({ severity: 'success', summary: 'Guardado', detail: 'Empresa registrada correctamente' });
        dialogVisible.value = false;
        loadEmpresas();
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la empresa' });
    }
};

const confirmDelete = (event, empresa) => {
    confirm.require({
        target: event.currentTarget,
        message: '¿Eliminar esta empresa?',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        accept: async () => {
            await api.delete(`/empresas/${empresa.id_empresa}`);
            loadEmpresas();
        }
    });
};

// =======================
// IMPORT EXCEL
// =======================
const descargarPlantillaEmpresas = () => {
    const data = [
        {
            nombre: 'Empresa Ejemplo',
            giro: 'Tecnología',
            sector: 'PRIVADA',
            rfc: 'ABC123456789',
            direccion: 'Av. Universidad 100',
            sitio_web: 'https://empresa.com',
            contacto_nombre: 'Juan Pérez',
            contacto_cargo: 'Recursos Humanos',
            contacto_telefono: '7771234567',
            contacto_correo: 'contacto@empresa.com'
        }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Empresas');
    XLSX.writeFile(wb, 'plantilla_empresas_sisa.xlsx');
};

const onExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        excelPreview.value = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    };
    reader.readAsArrayBuffer(file);
};

const importEmpresas = async () => {
    importing.value = true;
    let ok = 0,
        err = 0;

    for (const row of excelPreview.value) {
        try {
            const { data } = await api.post('/empresas', {
                nombre: row.nombre,
                giro: row.giro,
                sector: row.sector,
                rfc: row.rfc,
                direccion: row.direccion,
                sitio_web: row.sitio_web,
                activa: true
            });

            await api.post(`/empresas/${data.id_empresa}/contactos`, {
                nombre_contacto: row.contacto_nombre,
                cargo: row.contacto_cargo,
                telefono: row.contacto_telefono,
                correo: row.contacto_correo,
                principal: true,
                activo: true
            });

            ok++;
        } catch {
            err++;
        }
    }

    importing.value = false;
    showImportDialog.value = false;
    excelPreview.value = [];
    loadEmpresas();

    toast.add({
        severity: err ? 'warn' : 'success',
        summary: 'Importación finalizada',
        detail: `${ok} creadas, ${err} errores`
    });
};
</script>

<template>
    <div class="card">
        <!-- HEADER -->
        <div class="flex justify-between items-center mb-4">
            <h5 class="m-0">Empresas</h5>
            <div class="flex gap-2">
                <Button icon="pi pi-upload" label="Importar empresas" outlined @click="showImportDialog = true" />
                <Button label="Nueva empresa" icon="pi pi-plus" @click="openNew" />
            </div>
        </div>

        <!-- BUSCADOR -->
        <span class="p-input-icon-left mb-3">
            <i class="pi pi-search" />
            <InputText v-model="filters.global.value" placeholder="Buscar empresa..." />
        </span>

        <!-- TABLA -->
        <DataTable :value="empresas" paginator :rows="10" :loading="loading" v-model:filters="filters" :globalFilterFields="['nombre', 'giro', 'sector']">
            <Column field="nombre" header="Empresa" />
            <Column field="giro" header="Giro" />
            <Column field="sector" header="Sector" />
            <Column header="Contacto">
                <template #body="{ data }">
                    {{ data.contactos?.find((c) => c.principal)?.nombre_contacto || '-' }}
                </template>
            </Column>
            <Column header="Correo">
                <template #body="{ data }">
                    {{ data.contactos?.find((c) => c.principal)?.correo || '-' }}
                </template>
            </Column>

            <Column header="Acciones" style="width: 120px">
                <template #body="{ data }">
                    <Button icon="pi pi-pencil" text @click="editEmpresa(data)" />
                    <Button icon="pi pi-trash" text severity="danger" @click="confirmDelete($event, data)" />
                </template>
            </Column>
        </DataTable>

        <!-- DIALOG EMPRESA -->
        <Dialog v-model:visible="dialogVisible" modal header="Empresa" style="width: 720px">
            <h6 class="section-title">Datos de la empresa</h6>
            <div class="form-grid">
                <InputText v-model="empresaForm.nombre" placeholder="Nombre" />
                <InputText v-model="empresaForm.giro" placeholder="Giro" />
                <Dropdown v-model="empresaForm.sector" :options="sectores" optionLabel="label" optionValue="value" />
                <InputText v-model="empresaForm.rfc" placeholder="RFC" />
                <InputText v-model="empresaForm.sitio_web" placeholder="Sitio web" />
                <InputText v-model="empresaForm.direccion" placeholder="Dirección" />
            </div>

            <h6 class="section-title mt-3">Contacto principal</h6>
            <div class="form-grid">
                <InputText v-model="empresaForm.contacto_nombre" placeholder="Nombre" />
                <InputText v-model="empresaForm.contacto_cargo" placeholder="Cargo" />
                <InputText v-model="empresaForm.contacto_telefono" placeholder="Teléfono" />
                <InputText v-model="empresaForm.contacto_correo" placeholder="Correo" />
            </div>

            <template #footer>
                <Button label="Cancelar" text @click="dialogVisible = false" />
                <Button label="Guardar" @click="saveEmpresa" />
            </template>
        </Dialog>

        <!-- DIALOG IMPORT -->
        <Dialog v-model:visible="showImportDialog" header="Importar empresas" modal style="width: 720px">
            <Button icon="pi pi-download" label="Descargar plantilla Excel" text @click="descargarPlantillaEmpresas" />

            <div class="upload-box mt-3">
                <input type="file" accept=".xlsx" hidden ref="excelInput" @change="onExcelUpload" />
                <Button icon="pi pi-file-excel" label="Elegir archivo" @click="$refs.excelInput.click()" />
            </div>

            <DataTable v-if="excelPreview.length" :value="excelPreview" paginator :rows="5" class="mt-3">
                <Column field="nombre" header="Empresa" />
                <Column field="contacto_nombre" header="Contacto" />
                <Column field="contacto_correo" header="Correo" />
            </DataTable>

            <template #footer>
                <Button label="Cancelar" text @click="showImportDialog = false" />
                <Button label="Importar" icon="pi pi-upload" :loading="importing" :disabled="!excelPreview.length" @click="importEmpresas" />
            </template>
        </Dialog>

        <ConfirmPopup />
    </div>
</template>

<style scoped>
.form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
}

.section-title {
    font-weight: 600;
    margin-bottom: 0.75rem;
}

.upload-box {
    border: 2px dashed #cbd5e1;
    padding: 1.5rem;
    text-align: center;
    border-radius: 8px;
}
@media (max-width: 640px) {
    .form-grid {
        grid-template-columns: 1fr;
    }
}
</style>
