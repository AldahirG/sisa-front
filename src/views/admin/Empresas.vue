<script setup>
import api from '@/api/axios';
import { useToast } from '@/composables/useAppToast';
import { computed, onMounted, ref } from 'vue';
import * as XLSX from 'xlsx';

// PrimeVue
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import ToggleSwitch from 'primevue/toggleswitch';

const toast = useToast();

// =======================
// CATALOGS
// =======================
const sectores = [
    { label: 'Pública', value: 'PUBLICA' },
    { label: 'Privada', value: 'PRIVADA' },
    { label: 'Social',  value: 'SOCIAL' }
];

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

// Global search
const searchQuery = ref('');

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
    contacto_nombre: '',
    contacto_cargo: '',
    contacto_telefono: '',
    contacto_correo: ''
});

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
// COMPUTED
// =======================
const empresasFiltradas = computed(() => {
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) return empresas.value;
    return empresas.value.filter(e =>
        e.nombre?.toLowerCase().includes(q) ||
        e.giro?.toLowerCase().includes(q) ||
        e.sector?.toLowerCase().includes(q) ||
        e.rfc?.toLowerCase().includes(q)
    );
});

const totalActivas = computed(() => empresas.value.filter(e => e.activa).length);

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
        contacto_nombre:   contacto.nombre_contacto ?? '',
        contacto_cargo:    contacto.cargo ?? '',
        contacto_telefono: contacto.telefono ?? '',
        contacto_correo:   contacto.correo ?? ''
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

        await api.post(`/empresas/${empresaId}/contactos`, {
            nombre_contacto: empresaForm.value.contacto_nombre,
            cargo:           empresaForm.value.contacto_cargo,
            telefono:        empresaForm.value.contacto_telefono,
            correo:          empresaForm.value.contacto_correo,
            principal: true,
            activo:    true
        });

        toast.add({ severity: 'success', summary: 'Guardado', detail: 'Empresa registrada correctamente', life: 4000 });
        dialogVisible.value = false;
        loadEmpresas();
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la empresa', life: 4000 });
    }
};

// =======================
// IMPORT EXCEL
// =======================
const descargarPlantillaEmpresas = () => {
    const data = [{
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
    }];
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
    let ok = 0, err = 0;

    for (const row of excelPreview.value) {
        try {
            const { data } = await api.post('/empresas', {
                nombre:    row.nombre,
                giro:      row.giro,
                sector:    row.sector,
                rfc:       row.rfc,
                direccion: row.direccion,
                sitio_web: row.sitio_web,
                activa: true
            });
            await api.post(`/empresas/${data.id_empresa}/contactos`, {
                nombre_contacto: row.contacto_nombre,
                cargo:           row.contacto_cargo,
                telefono:        row.contacto_telefono,
                correo:          row.contacto_correo,
                principal: true,
                activo:    true
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
        detail: `${ok} creadas, ${err} errores`,
        life: 5000
    });
};

// =======================
// UTILS
// =======================
const sectorSeverity = (sector) => {
    if (sector === 'PUBLICA')  return 'info';
    if (sector === 'PRIVADA')  return 'success';
    if (sector === 'SOCIAL')   return 'warn';
    return 'secondary';
};

const sectorLabel = (sector) => {
    if (sector === 'PUBLICA')  return 'Pública';
    if (sector === 'PRIVADA')  return 'Privada';
    if (sector === 'SOCIAL')   return 'Social';
    return sector;
};

const getContactoPrincipal = (empresa) =>
    empresa.contactos?.find((c) => c.principal) ?? null;
</script>

<template>
    <div class="page-container">
        <!-- PAGE HEADER -->
        <div class="page-header">
            <div class="header-left">
                <div class="header-icon">
                    <i class="pi pi-building"></i>
                </div>
                <div>
                    <h1 class="header-title">Empresas</h1>
                    <p class="header-sub">{{ totalActivas }} activas de {{ empresas.length }} registradas</p>
                </div>
            </div>
            <div class="header-actions">
                <Button icon="pi pi-upload" label="Importar XLSX" outlined @click="showImportDialog = true" />
                <Button icon="pi pi-plus" label="Nueva empresa" @click="openNew" />
            </div>
        </div>

        <!-- FILTROS -->
        <div class="filter-card">
            <span class="search-wrap">
                <i class="pi pi-search search-icon"></i>
                <InputText v-model="searchQuery" placeholder="Buscar empresa, giro, sector o RFC..." class="search-input" />
            </span>
        </div>

        <!-- TABLA -->
        <div class="table-card">
            <DataTable
                :value="empresasFiltradas"
                paginator
                :rows="10"
                :loading="loading"
                responsiveLayout="scroll"
                :rowsPerPageOptions="[10, 25, 50]"
                stripedRows
            >
                <Column header="Empresa" style="min-width: 220px">
                    <template #body="{ data }">
                        <div class="cell-stack">
                            <span class="cell-main">{{ data.nombre }}</span>
                            <span class="cell-sub">{{ data.giro }}</span>
                        </div>
                    </template>
                </Column>

                <Column header="Sector" style="width: 110px">
                    <template #body="{ data }">
                        <Tag :value="sectorLabel(data.sector)" :severity="sectorSeverity(data.sector)" />
                    </template>
                </Column>

                <Column field="rfc" header="RFC" style="width: 140px">
                    <template #body="{ data }">
                        <span class="rfc-label">{{ data.rfc || '—' }}</span>
                    </template>
                </Column>

                <Column header="Contacto" style="min-width: 190px">
                    <template #body="{ data }">
                        <div class="cell-stack" v-if="getContactoPrincipal(data)">
                            <span class="cell-main">{{ getContactoPrincipal(data).nombre_contacto }}</span>
                            <span class="cell-sub">{{ getContactoPrincipal(data).correo }}</span>
                        </div>
                        <span v-else class="muted-dash">Sin contacto</span>
                    </template>
                </Column>

                <Column header="Estado" style="width: 100px">
                    <template #body="{ data }">
                        <Tag
                            :value="data.activa ? 'Activa' : 'Inactiva'"
                            :severity="data.activa ? 'success' : 'secondary'"
                        />
                    </template>
                </Column>

                <Column header="Acciones" style="width: 100px">
                    <template #body="{ data }">
                        <div class="row-actions">
                            <Button
                                icon="pi pi-pencil"
                                text
                                size="small"
                                v-tooltip.top="'Editar empresa'"
                                @click="editEmpresa(data)"
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>

    <!-- ========================= -->
    <!-- DIALOG CREAR / EDITAR     -->
    <!-- ========================= -->
    <Dialog v-model:visible="dialogVisible" modal :header="isEdit ? 'Editar empresa' : 'Nueva empresa'" style="width: 740px">
        <div class="dialog-body">
            <!-- Datos empresa -->
            <div class="form-section">
                <div class="section-header">
                    <i class="pi pi-building section-icon"></i>
                    <span>Datos de la empresa</span>
                </div>
                <div class="form-grid">
                    <div class="form-field col-span-2">
                        <label>Nombre de la empresa</label>
                        <InputText v-model="empresaForm.nombre" placeholder="Nombre completo" class="w-full" />
                    </div>
                    <div class="form-field">
                        <label>Giro</label>
                        <InputText v-model="empresaForm.giro" placeholder="Tecnología, Manufactura..." class="w-full" />
                    </div>
                    <div class="form-field">
                        <label>Sector</label>
                        <Select
                            v-model="empresaForm.sector"
                            :options="sectores"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                        />
                    </div>
                    <div class="form-field">
                        <label>RFC</label>
                        <InputText v-model="empresaForm.rfc" placeholder="RFC de la empresa" class="w-full" />
                    </div>
                    <div class="form-field">
                        <label>Sitio web</label>
                        <InputText v-model="empresaForm.sitio_web" placeholder="https://empresa.com" class="w-full" />
                    </div>
                    <div class="form-field col-span-2">
                        <label>Dirección</label>
                        <InputText v-model="empresaForm.direccion" placeholder="Calle, colonia, ciudad" class="w-full" />
                    </div>
                    <div class="form-field toggle-field">
                        <label>Empresa activa</label>
                        <ToggleSwitch v-model="empresaForm.activa" />
                    </div>
                </div>
            </div>

            <!-- Contacto principal -->
            <div class="form-section">
                <div class="section-header">
                    <i class="pi pi-user section-icon"></i>
                    <span>Contacto principal</span>
                </div>
                <div class="form-grid">
                    <div class="form-field">
                        <label>Nombre</label>
                        <InputText v-model="empresaForm.contacto_nombre" placeholder="Nombre del contacto" class="w-full" />
                    </div>
                    <div class="form-field">
                        <label>Cargo</label>
                        <InputText v-model="empresaForm.contacto_cargo" placeholder="Recursos Humanos..." class="w-full" />
                    </div>
                    <div class="form-field">
                        <label>Teléfono</label>
                        <InputText v-model="empresaForm.contacto_telefono" placeholder="7771234567" class="w-full" />
                    </div>
                    <div class="form-field">
                        <label>Correo electrónico</label>
                        <InputText v-model="empresaForm.contacto_correo" placeholder="contacto@empresa.com" class="w-full" />
                    </div>
                </div>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <Button label="Cancelar" text @click="dialogVisible = false" />
                <Button label="Guardar empresa" icon="pi pi-check" @click="saveEmpresa" />
            </div>
        </template>
    </Dialog>

    <!-- ========================= -->
    <!-- DIALOG IMPORTAR EXCEL     -->
    <!-- ========================= -->
    <Dialog v-model:visible="showImportDialog" header="Importar empresas desde Excel" modal style="width: 760px">
        <div class="import-header">
            <div>
                <p class="import-title">Carga masiva de empresas</p>
                <p class="import-sub">El archivo debe ser .xlsx con las columnas: nombre, giro, sector, rfc, direccion, sitio_web, contacto_nombre, contacto_cargo, contacto_telefono, contacto_correo</p>
            </div>
            <Button icon="pi pi-download" label="Descargar plantilla" text severity="secondary" @click="descargarPlantillaEmpresas" />
        </div>

        <input type="file" accept=".xlsx" hidden ref="excelInput" @change="onExcelUpload" />

        <div
            class="upload-box"
            @dragover.prevent
            @drop.prevent="(e) => { const f = e.dataTransfer?.files?.[0]; if(f) onExcelUpload({ target: { files: [f] } }); }"
        >
            <i class="pi pi-file-excel upload-icon"></i>
            <p class="upload-title">Arrastra el archivo Excel aquí</p>
            <p class="upload-sub">o selecciónalo desde tu equipo</p>
            <div class="upload-actions">
                <Button icon="pi pi-folder-open" label="Elegir archivo .xlsx" @click="$refs.excelInput.click()" />
            </div>
        </div>

        <div v-if="excelPreview.length" class="import-summary">
            <div class="summary-pill summary-blue">
                <i class="pi pi-list"></i>
                {{ excelPreview.length }} empresas detectadas
            </div>
        </div>

        <DataTable v-if="excelPreview.length" :value="excelPreview" paginator :rows="5" class="import-preview" responsiveLayout="scroll">
            <Column field="nombre" header="Empresa" />
            <Column field="giro" header="Giro" />
            <Column field="sector" header="Sector" />
            <Column header="Contacto">
                <template #body="{ data }">
                    <div class="cell-stack">
                        <span class="cell-main">{{ data.contacto_nombre }}</span>
                        <span class="cell-sub">{{ data.contacto_correo }}</span>
                    </div>
                </template>
            </Column>
        </DataTable>

        <template #footer>
            <div class="import-footer">
                <span v-if="excelPreview.length" class="import-count">{{ excelPreview.length }} registros listos para importar</span>
                <div class="flex gap-2">
                    <Button label="Cancelar" text @click="showImportDialog = false" />
                    <Button
                        label="Importar empresas"
                        icon="pi pi-upload"
                        :loading="importing"
                        :disabled="!excelPreview.length"
                        @click="importEmpresas"
                    />
                </div>
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
/* ── Layout ─────────────────────────────── */
.page-container {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* ── Page Header ─────────────────────────── */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
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
    border-radius: 50%;
    background: var(--sisa-primary, #0F3C61);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.header-icon .pi {
    color: #fff;
    font-size: 1.25rem;
}
.header-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0;
    line-height: 1.2;
}
.header-sub {
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
    margin: 0;
}
.header-actions {
    display: flex;
    gap: 0.625rem;
    flex-wrap: wrap;
}

/* ── Filter Card ─────────────────────────── */
.filter-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
}
.search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    max-width: 480px;
}
.search-icon {
    position: absolute;
    left: 0.75rem;
    color: var(--p-text-muted-color);
    pointer-events: none;
    z-index: 1;
}
.search-input { width: 100%; }
.search-wrap :deep(input) { padding-left: 2.25rem; width: 100%; }

/* ── Table Card ──────────────────────────── */
.table-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 0.75rem;
    overflow: clip; /* clip preserves border-radius visual but allows child overflow-x: auto to work */
}

/* ── Cell stacks ─────────────────────────── */
.cell-stack {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}
.cell-main {
    font-weight: 600;
    color: var(--p-text-color);
    font-size: 0.9rem;
}
.cell-sub {
    font-size: 0.78rem;
    color: var(--p-text-muted-color);
}
.rfc-label {
    font-family: monospace;
    font-size: 0.82rem;
    color: var(--p-text-muted-color);
    letter-spacing: 0.04em;
}
.muted-dash { color: var(--p-text-muted-color); font-size: 0.85rem; }
.row-actions { display: flex; gap: 0.25rem; }

/* ── Dialog Body ─────────────────────────── */
.dialog-body {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding-top: 0.5rem;
}
.form-section {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
}
.section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 0.88rem;
    color: var(--sisa-primary, #0F3C61);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--sisa-tint-blue);
}
.section-icon { font-size: 1rem; }
.form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}
.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}
.form-field label {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.col-span-2 { grid-column: span 2; }
.toggle-field {
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
    padding-top: 0.5rem;
}
.toggle-field label { margin: 0; }
.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.625rem;
}

/* ── Import Dialog ───────────────────────── */
.import-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
}
.import-title {
    font-weight: 600;
    color: var(--p-text-color);
    margin: 0 0 0.2rem;
}
.import-sub {
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
    margin: 0;
    max-width: 480px;
    line-height: 1.5;
}
.upload-box {
    border: 2px dashed var(--sisa-primary-l, #1565C0);
    border-radius: 0.75rem;
    padding: 2.5rem 1rem;
    text-align: center;
    background: var(--p-content-background);
    transition: background 0.2s;
}
.upload-box:hover { background: color-mix(in srgb, var(--sisa-tint-blue) 60%, transparent); }
.upload-icon {
    font-size: 3rem;
    color: var(--sisa-icon-green);
    display: block;
    margin-bottom: 0.75rem;
}
.upload-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--p-text-color);
    margin: 0 0 0.25rem;
}
.upload-sub {
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
    margin: 0 0 1.25rem;
}
.upload-actions { display: flex; justify-content: center; gap: 0.75rem; }
.import-summary {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}
.summary-pill {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.8rem;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 600;
}
.summary-blue { background: var(--sisa-tint-blue); color: var(--sisa-icon-blue); }
.import-preview { margin-top: 1rem; }
.import-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 1rem;
    flex-wrap: wrap;
}
.import-count { font-size: 0.85rem; color: var(--p-text-muted-color); }

/* ── Responsive ──────────────────────────── */
@media (max-width: 640px) {
    .form-grid { grid-template-columns: 1fr; }
    .col-span-2 { grid-column: span 1; }
    .page-header { flex-direction: column; align-items: flex-start; }
    .search-wrap { max-width: 100%; }
}
</style>
