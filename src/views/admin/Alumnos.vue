<script setup>
import api from '@/api/axios';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import * as XLSX from 'xlsx';

// PrimeVue
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';

const toast = useToast();

// =====================
// STATE
// =====================
const alumnos = ref([]);
const loading = ref(false);

// Dialogs
const showDialog = ref(false);
const editMode = ref(false);
const showCsvDialog = ref(false);

// Importación
const csvPreview = ref([]);
const importing = ref(false);

// Form
const form = ref({
    id_alumno: null,
    nombre: '',
    correo: '',
    password: '',
    matricula: '',
    carrera: '',
    cuatrimestre: null,
    estado: 'activo'
});

// Filtros
const filtros = ref({
    search: '',
    carrera: '',
    estado: null
});

// =====================
// UTILIDADES
// =====================
const capitalizeWords = (text = '') =>
    text
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

const normalizarFila = (row) => {
    const errores = [];

    const nombre = toSafeString(row.nombre);
    const correo = toSafeString(row.correo).toLowerCase();
    const password = toSafeString(row.password);
    const matricula = toSafeString(row.matricula);
    const carrera = toSafeString(row.carrera);
    const cuatrimestre = Number(row.cuatrimestre);

    if (!nombre) errores.push('Nombre requerido');
    if (!correo || !correo.includes('@')) errores.push('Correo inválido');
    if (!password) errores.push('Password requerido');
    if (!matricula) errores.push('Matrícula requerida');
    if (!carrera) errores.push('Carrera requerida');
    if (!cuatrimestre || isNaN(cuatrimestre)) errores.push('Cuatrimestre inválido');

    return {
        nombre,
        correo,
        password,
        matricula,
        carrera,
        cuatrimestre,
        valido: errores.length === 0,
        errores
    };
};

// =====================
// LOAD
// =====================
const loadAlumnos = async () => {
    loading.value = true;
    try {
        const { data } = await api.get('/alumnos');
        alumnos.value = data ?? [];
    } finally {
        loading.value = false;
    }
};

onMounted(loadAlumnos);

// =====================
// COMPUTED
// =====================
const alumnosFiltrados = computed(() => {
    const search = filtros.value.search.toLowerCase().trim();

    return alumnos.value.filter((a) => {
        const matchSearch = !search || a.matricula?.toLowerCase().includes(search) || a.usuario?.nombre?.toLowerCase().includes(search) || a.usuario?.correo?.toLowerCase().includes(search);

        const matchCarrera = !filtros.value.carrera || a.carrera?.toLowerCase().includes(filtros.value.carrera.toLowerCase());

        const matchEstado = !filtros.value.estado || a.estado === filtros.value.estado;

        return matchSearch && matchCarrera && matchEstado;
    });
});

// =====================
// CRUD
// =====================
const nuevoAlumno = () => {
    editMode.value = false;
    form.value = {
        id_alumno: null,
        nombre: '',
        correo: '',
        password: '',
        matricula: '',
        carrera: '',
        cuatrimestre: null,
        estado: 'activo'
    };
    showDialog.value = true;
};

const editarAlumno = (row) => {
    editMode.value = true;
    form.value = {
        id_alumno: row.id_alumno,
        nombre: row.usuario?.nombre,
        correo: row.usuario?.correo,
        password: '',
        matricula: row.matricula,
        carrera: row.carrera,
        cuatrimestre: row.cuatrimestre,
        estado: row.estado
    };
    showDialog.value = true;
};

const guardarAlumno = async () => {
    try {
        if (editMode.value) {
            await api.patch(`/alumnos/${form.value.id_alumno}`, {
                carrera: form.value.carrera,
                cuatrimestre: form.value.cuatrimestre,
                estado: form.value.estado
            });
            toast.add({ severity: 'success', summary: 'Alumno actualizado', life: 6000 });
        } else {
            await api.post('/users/create-alumno', form.value);
            toast.add({ severity: 'success', summary: 'Alumno creado correctamente', life: 6000 });
        }

        showDialog.value = false;
        loadAlumnos();
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e.response?.data?.message || 'No se pudo guardar',
            life: 6000
        });
    }
};

const toggleEstado = async (row) => {
    await api.patch(`/alumnos/${row.id_alumno}`, {
        estado: row.estado === 'activo' ? 'baja' : 'activo'
    });
    loadAlumnos();
};

// =====================
// IMPORT CSV / EXCEL
// =====================
const onFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') parseCSV(file);
    else if (ext === 'xlsx') parseExcel(file);
    else {
        toast.add({
            severity: 'warn',
            summary: 'Archivo no válido',
            detail: 'Solo CSV o Excel (.xlsx)',
            life: 6000

        });
    }
};

const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const lines = e.target.result.split('\n').filter((l) => l.trim());
        const headers = lines[0].split(',').map((h) => h.trim());

        const data = lines.slice(1).map((line) => {
            const values = line.split(',').map((v) => v.trim());
            const obj = {};
            headers.forEach((h, i) => (obj[h] = values[i] ?? ''));
            return obj;
        });

        csvPreview.value = data.map(normalizarFila);
    };
    reader.readAsText(file);
};

const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        csvPreview.value = data.map(normalizarFila);
    };
    reader.readAsArrayBuffer(file);
};

const toSafeString = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
};

const importCsv = async () => {
    importing.value = true;

    let success = 0;
    let erroresDetalle = [];

    for (const row of csvPreview.value) {
        if (!row.valido) {
            erroresDetalle.push({
                matricula: row.matricula,
                error: row.errores.join(', ')
            });
            continue;
        }

        try {
            await api.post('/users/create-alumno', {
                nombre: row.nombre,
                correo: row.correo,
                password: row.password,
                matricula: row.matricula,
                carrera: row.carrera,
                cuatrimestre: row.cuatrimestre
            });
            success++;
        } catch (e) {
            erroresDetalle.push({
                matricula: row.matricula,
                error: e.response?.data?.message || 'Error desconocido'
            });
        }
    }

    importing.value = false;
    showCsvDialog.value = false;
    loadAlumnos();

    // 🔔 Resumen
    toast.add({
        severity: erroresDetalle.length ? 'warn' : 'success',
        summary: 'Importación finalizada',
        detail: `${success} creados, ${erroresDetalle.length} con error`,
        life: 6000
    });

    // 📋 Log opcional
    // if (erroresDetalle.length) {
    //     console.table(erroresDetalle);
    // }

    csvPreview.value = [];
};

// =====================
// PLANTILLA EXCEL
// =====================
const descargarPlantillaExcel = () => {
    const data = [
        {
            nombre: 'Juan Pérez',
            correo: 'juan@alumnouninter.mx',
            password: '123456',
            matricula: 'A2023001',
            carrera: 'Ingeniería en Sistemas',
            cuatrimestre: 6
        }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');

    XLSX.writeFile(wb, 'plantilla_alumnos_sisa.xlsx');
};

// =====================
// UI
// =====================
const estadoSeverity = (estado) => (estado === 'activo' ? 'success' : 'danger');
</script>
<template>
    <div class="card">
        <!-- HEADER -->
        <div class="flex justify-between items-center mb-3">
            <h2 class="text-xl font-semibold">Alumnos</h2>

            <div class="flex gap-2">
                <Button icon="pi pi-upload" label="Importar alumnos" outlined @click="showCsvDialog = true" />
                <Button icon="pi pi-plus" label="Nuevo alumno" @click="nuevoAlumno" />
            </div>
        </div>

        <!-- FILTROS -->
        <div class="filters-grid mb-3">
            <InputText v-model="filtros.search" placeholder="Buscar nombre, correo o matrícula" />
            <InputText v-model="filtros.carrera" placeholder="Carrera" />
            <Dropdown v-model="filtros.estado" :options="['activo', 'baja']" placeholder="Estado" showClear />
        </div>

        <!-- TABLA -->
        <DataTable :value="alumnosFiltrados" paginator :rows="10" :loading="loading" responsiveLayout="scroll">
            <Column field="matricula" header="Matrícula" />

            <Column header="Nombre">
                <template #body="{ data }">
                    {{ data.usuario?.nombre }}
                </template>
            </Column>

            <Column header="Correo">
                <template #body="{ data }">
                    {{ data.usuario?.correo }}
                </template>
            </Column>

            <Column field="carrera" header="Carrera" />
            <Column field="cuatrimestre" header="Cuatrimestre" />

            <Column header="Estado">
                <template #body="{ data }">
                    <Tag :value="data.estado" :severity="estadoSeverity(data.estado)" />
                </template>
            </Column>

            <Column header="Acciones" style="width: 160px">
                <template #body="{ data }">
                    <Button icon="pi pi-pencil" text @click="editarAlumno(data)" />
                    <Button icon="pi pi-power-off" text severity="danger" @click="toggleEstado(data)" />
                </template>
            </Column>
        </DataTable>
    </div>

    <!-- ========================= -->
    <!-- DIALOG NUEVO / EDITAR -->
    <!-- ========================= -->
    <Dialog v-model:visible="showDialog" :header="editMode ? 'Editar alumno' : 'Nuevo alumno'" modal style="width: 420px">
        <div class="flex flex-column gap-3">
            <InputText v-model="form.nombre" placeholder="Nombre completo" />
            <InputText v-model="form.correo" placeholder="Correo institucional" />
            <InputText v-if="!editMode" v-model="form.password" type="password" placeholder="Contraseña" />
            <InputText v-model="form.matricula" placeholder="Matrícula" />
            <InputText v-model="form.carrera" placeholder="Carrera" />
            <InputNumber v-model="form.cuatrimestre" placeholder="Cuatrimestre" />
        </div>

        <template #footer>
            <div class="flex justify-end gap-2">
                <Button label="Cancelar" text @click="showDialog = false" />
                <Button label="Guardar" @click="guardarAlumno" />
            </div>
        </template>
    </Dialog>

    <!-- ========================= -->
    <!-- DIALOG IMPORTACIÓN -->
    <!-- ========================= -->
    <Dialog v-model:visible="showCsvDialog" header="Importar alumnos" modal style="width: 820px">
        <!-- HEADER IMPORT -->
        <div class="flex justify-between align-items-center mb-3">
            <div class="flex flex-column">
                <span class="font-medium">Plantilla oficial de carga</span>
                <small class="opacity-70">Se aceptan archivos .csv y .xlsx</small>
            </div>

            <Button icon="pi pi-download" label="Descargar plantilla Excel" text severity="primary" @click="descargarPlantillaExcel" />
        </div>

        <!-- UPLOADER (VISTOSO) -->
        <div class="csv-uploader">
            <input ref="fileInput" type="file" accept=".csv,.xlsx" class="hidden-input" @change="onFileUpload" />

            <div
                class="upload-box"
                @dragover.prevent
                @drop.prevent="
                    (e) => {
                        const file = e.dataTransfer?.files?.[0];
                        if (!file) return;
                        // Simula el change del input
                        onFileUpload({ target: { files: [file] } });
                    }
                "
            >
                <i class="pi pi-file-excel upload-icon"></i>

                <p class="upload-title">Importar alumnos desde CSV o Excel</p>
                <p class="upload-sub">Arrastra el archivo aquí o selecciónalo manualmente</p>

                <div class="upload-actions">
                    <Button icon="pi pi-plus" label="Elegir archivo" severity="success" @click="$refs.fileInput.click()" />
                    <Button icon="pi pi-times" label="Cancelar" text severity="secondary" @click="showCsvDialog = false" />
                </div>
            </div>
        </div>

        <!-- RESUMEN VALIDACIÓN -->
        <div v-if="csvPreview.length" class="import-summary mt-3">
            <div class="summary-pill success">
                <i class="pi pi-check mr-2"></i>
                Válidos: {{ csvPreview.filter((r) => r.valido).length }}
            </div>
            <div class="summary-pill danger">
                <i class="pi pi-exclamation-triangle mr-2"></i>
                Con error: {{ csvPreview.filter((r) => !r.valido).length }}
            </div>
        </div>

        <!-- PREVIEW -->
        <DataTable v-if="csvPreview.length" :value="csvPreview" paginator :rows="5" class="mt-3" responsiveLayout="scroll">
            <Column header="Estado" style="width: 120px">
                <template #body="{ data }">
                    <Tag :value="data.valido ? 'Válido' : 'Error'" :severity="data.valido ? 'success' : 'danger'" />
                </template>
            </Column>

            <Column field="nombre" header="Nombre" />
            <Column field="correo" header="Correo" />
            <Column field="matricula" header="Matrícula" />
            <Column field="carrera" header="Carrera" />
            <Column field="cuatrimestre" header="Cuatrimestre" />

            <Column header="Errores" style="min-width: 260px">
                <template #body="{ data }">
                    <div v-if="data.errores?.length" class="errors-wrap">
                        <Tag v-for="(err, idx) in data.errores" :key="idx" :value="err" severity="danger" class="mr-1 mb-1" />
                    </div>
                    <span v-else class="opacity-70">—</span>
                </template>
            </Column>
        </DataTable>

        <template #footer>
            <div class="flex justify-between w-full">
                <span v-if="csvPreview.length" class="opacity-80"> {{ csvPreview.length }} registros detectados — {{ csvPreview.filter((r) => r.valido).length }} válidos </span>

                <div class="flex gap-2">
                    <Button label="Cancelar" text @click="showCsvDialog = false" />
                    <Button label="Importar alumnos" icon="pi pi-upload" :loading="importing" :disabled="!csvPreview.length || csvPreview.filter((r) => r.valido).length === 0" @click="importCsv" />
                </div>
            </div>
        </template>
    </Dialog>
</template>

<style scoped>
.filters-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
}

.csv-uploader {
    margin-top: 1rem;
}

.hidden-input {
    display: none;
}

.upload-box {
    border: 2px dashed var(--primary-color);
    border-radius: 12px;
    padding: 2.5rem 1rem;
    text-align: center;
    background: var(--surface-card);
    transition: all 0.25s ease;
}

.upload-box:hover {
    background: var(--surface-hover);
    border-color: var(--primary-color);
}

.upload-icon {
    font-size: 3rem;
    color: var(--primary-color);
    margin-bottom: 1rem;
}

.upload-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
}

.upload-sub {
    font-size: 0.9rem;
    opacity: 0.7;
    margin-bottom: 1.5rem;
}

.upload-actions {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
}

@media (max-width: 900px) {
    .filters-grid {
        grid-template-columns: 1fr;
    }
}
</style>
