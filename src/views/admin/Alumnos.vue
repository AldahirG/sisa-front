<script setup>
import api from '@/api/axios';
import { useCarreras } from '@/composables/useCarreras';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import * as XLSX from 'xlsx';

// PrimeVue
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import ToggleSwitch from 'primevue/toggleswitch';

const toast = useToast();

// =====================
// CATALOGS
// =====================
const { carreras: carrerasCatalogo } = useCarreras();

const estadosOpciones = [
    { label: 'Activo', value: 'activo' },
    { label: 'Baja', value: 'baja' },
    { label: 'Graduado', value: 'graduado' }
];

// =====================
// STATE
// =====================
const alumnos = ref([]);
const loading = ref(false);

// Dialogs CRUD / Importación
const showDialog = ref(false);
const editMode = ref(false);
const showCsvDialog = ref(false);

// Importación
const csvPreview = ref([]);
const importing = ref(false);

// Avanzar cuatrimestre
const showAvanzarCuatriDialog = ref(false);
const showResultadosCuatriDialog = ref(false);
const loadingAvanzarCuatri = ref(false);
const incrementoCuatri = ref(1);
const resultadosCuatri = ref(null);

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
    carrera: null,
    estado: null
});

// =====================
// UTILIDADES
// =====================
const toSafeString = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
};

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

    return { nombre, correo, password, matricula, carrera, cuatrimestre, valido: errores.length === 0, errores };
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
        const matchSearch = !search ||
            a.matricula?.toLowerCase().includes(search) ||
            a.usuario?.nombre?.toLowerCase().includes(search) ||
            a.usuario?.correo?.toLowerCase().includes(search);
        const matchCarrera = !filtros.value.carrera ||
            a.carrera === filtros.value.carrera;
        const matchEstado = !filtros.value.estado ||
            a.estado === filtros.value.estado;
        return matchSearch && matchCarrera && matchEstado;
    });
});

const totalActivos = computed(() => alumnos.value.filter(a => a.estado === 'activo').length);
const totalBaja = computed(() => alumnos.value.filter(a => a.estado === 'baja').length);

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
        toast.add({ severity: 'warn', summary: 'Archivo no válido', detail: 'Solo CSV o Excel (.xlsx)', life: 6000 });
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

const importCsv = async () => {
    importing.value = true;
    let success = 0;
    let erroresDetalle = [];

    for (const row of csvPreview.value) {
        if (!row.valido) {
            erroresDetalle.push({ matricula: row.matricula, error: row.errores.join(', ') });
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
            erroresDetalle.push({ matricula: row.matricula, error: e.response?.data?.message || 'Error desconocido' });
        }
    }

    importing.value = false;
    showCsvDialog.value = false;
    loadAlumnos();

    toast.add({
        severity: erroresDetalle.length ? 'warn' : 'success',
        summary: 'Importación finalizada',
        detail: `${success} creados, ${erroresDetalle.length} con error`,
        life: 6000
    });

    csvPreview.value = [];
};

const descargarPlantillaExcel = () => {
    const data = [{
        nombre: 'Juan Pérez',
        correo: 'juan@alumnouninter.mx',
        password: '123456',
        matricula: 'A2023001',
        carrera: 'ISC',
        cuatrimestre: 6
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alumnos');
    XLSX.writeFile(wb, 'plantilla_alumnos_sisa.xlsx');
};

// =====================
// AVANZAR CUATRIMESTRE
// =====================
const confirmarAvanzarCuatrimestre = async () => {
    if (!incrementoCuatri.value || incrementoCuatri.value < 1) {
        toast.add({ severity: 'warn', summary: 'Incremento inválido', detail: 'El incremento debe ser al menos 1', life: 3000 });
        return;
    }

    loadingAvanzarCuatri.value = true;
    try {
        const { data } = await api.post('/alumnos/avanzar-cuatrimestre', {
            incremento: incrementoCuatri.value
        });
        resultadosCuatri.value = data;
        showAvanzarCuatriDialog.value = false;
        showResultadosCuatriDialog.value = true;
        await loadAlumnos();
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e.response?.data?.message || 'No se pudo avanzar el cuatrimestre',
            life: 5000
        });
    } finally {
        loadingAvanzarCuatri.value = false;
    }
};

// =====================
// UI
// =====================
const estadoSeverity = (estado) => {
    if (estado === 'activo') return 'success';
    if (estado === 'graduado') return 'secondary';
    return 'danger';
};
</script>

<template>
    <div class="page-container">
        <!-- PAGE HEADER -->
        <div class="page-header">
            <div class="header-left">
                <div class="header-icon">
                    <i class="pi pi-users"></i>
                </div>
                <div>
                    <h1 class="header-title">Alumnos</h1>
                    <p class="header-sub">Gestión de alumnos registrados en el sistema</p>
                </div>
            </div>
            <div class="header-actions">
                <Button
                    icon="pi pi-arrow-up"
                    label="Avanzar cuatrimestre"
                    severity="warning"
                    outlined
                    v-tooltip.bottom="'Avanza el grado académico de todos los alumnos activos'"
                    @click="showAvanzarCuatriDialog = true"
                />
                <Button icon="pi pi-upload" label="Importar CSV" outlined @click="showCsvDialog = true" />
                <Button icon="pi pi-plus" label="Nuevo alumno" @click="nuevoAlumno" />
            </div>
        </div>

        <!-- STATS BAR -->
        <div class="stats-bar">
            <div class="stat-chip stat-total">
                <i class="pi pi-users"></i>
                <span>{{ alumnos.length }} total</span>
            </div>
            <div class="stat-chip stat-success">
                <i class="pi pi-check-circle"></i>
                <span>{{ totalActivos }} activos</span>
            </div>
            <div class="stat-chip stat-danger">
                <i class="pi pi-times-circle"></i>
                <span>{{ totalBaja }} de baja</span>
            </div>
        </div>

        <!-- FILTROS -->
        <div class="filter-card">
            <div class="filters-grid">
                <span class="p-input-icon-left search-wrap">
                    <i class="pi pi-search"></i>
                    <InputText v-model="filtros.search" placeholder="Buscar nombre, correo o matrícula" class="w-full" />
                </span>
                <Select
                    v-model="filtros.carrera"
                    :options="carrerasCatalogo"
                    optionLabel="nombre_completo"
                    optionValue="nombre"
                    placeholder="Carrera"
                    filter
                    showClear
                />
                <Select
                    v-model="filtros.estado"
                    :options="estadosOpciones"
                    optionLabel="label"
                    optionValue="value"
                    placeholder="Estado"
                    showClear
                />
            </div>
        </div>

        <!-- TABLA -->
        <div class="table-card">
            <DataTable
                :value="alumnosFiltrados"
                paginator
                :rows="10"
                :loading="loading"
                responsiveLayout="scroll"
                :rowsPerPageOptions="[10, 25, 50]"
                stripedRows
            >
                <Column header="Nombre" style="min-width: 200px">
                    <template #body="{ data }">
                        <div class="cell-stack">
                            <span class="cell-main">{{ data.usuario?.nombre }}</span>
                            <span class="cell-sub">{{ data.usuario?.correo }}</span>
                        </div>
                    </template>
                </Column>

                <Column field="matricula" header="Matrícula" style="width: 130px" />

                <Column field="carrera" header="Carrera" style="width: 100px">
                    <template #body="{ data }">
                        <span class="carrera-badge">{{ data.carrera }}</span>
                    </template>
                </Column>

                <Column header="Cuatrimestre / Práctica" style="width: 170px">
                    <template #body="{ data }">
                        <div class="cuatri-practica-cell">
                            <div class="cuatri-row">
                                <i class="pi pi-book cp-icon"></i>
                                <span class="cuatri-num">{{ data.cuatrimestre }}°</span>
                                <span class="cp-lbl">cuatrimestre</span>
                            </div>
                            <div class="practica-row" v-if="data.numero_practica != null">
                                <i class="pi pi-star cp-icon cp-icon-amber"></i>
                                <span class="practica-num">Práctica {{ data.numero_practica }}</span>
                            </div>
                        </div>
                    </template>
                </Column>

                <Column header="Estado" style="width: 110px">
                    <template #body="{ data }">
                        <Tag :value="data.estado" :severity="estadoSeverity(data.estado)" />
                    </template>
                </Column>

                <Column header="Acciones" style="width: 100px">
                    <template #body="{ data }">
                        <div class="row-actions">
                            <Button
                                icon="pi pi-pencil"
                                text
                                size="small"
                                v-tooltip.top="'Editar'"
                                @click="editarAlumno(data)"
                            />
                            <Button
                                :icon="data.estado === 'activo' ? 'pi pi-ban' : 'pi pi-check'"
                                text
                                size="small"
                                :severity="data.estado === 'activo' ? 'danger' : 'success'"
                                :v-tooltip.top="data.estado === 'activo' ? 'Dar de baja' : 'Activar'"
                                @click="toggleEstado(data)"
                            />
                        </div>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>

    <!-- ========================= -->
    <!-- DIALOG NUEVO / EDITAR     -->
    <!-- ========================= -->
    <Dialog v-model:visible="showDialog" :header="editMode ? 'Editar alumno' : 'Nuevo alumno'" modal style="width: 480px">
        <div class="dialog-form">
            <div class="form-field">
                <label>Nombre completo</label>
                <InputText v-model="form.nombre" placeholder="Juan Pérez García" :disabled="editMode" />
            </div>
            <div class="form-field">
                <label>Correo institucional</label>
                <InputText v-model="form.correo" placeholder="alumno@uninter.mx" :disabled="editMode" />
            </div>
            <div v-if="!editMode" class="form-field">
                <label>Contraseña</label>
                <InputText v-model="form.password" type="password" placeholder="Contraseña inicial" />
            </div>
            <div class="form-field">
                <label>Matrícula</label>
                <InputText v-model="form.matricula" placeholder="A2024001" :disabled="editMode" />
            </div>
            <div class="form-field">
                <label>Carrera</label>
                <Select
                    v-model="form.carrera"
                    :options="carrerasCatalogo"
                    optionLabel="nombre_completo"
                    optionValue="nombre"
                    placeholder="Selecciona carrera"
                    filter
                    class="w-full"
                />
            </div>
            <div class="form-row">
                <div class="form-field">
                    <label>Cuatrimestre</label>
                    <InputNumber v-model="form.cuatrimestre" :min="1" :max="12" placeholder="1-12" />
                </div>
                <div class="form-field">
                    <label>Estado</label>
                    <Select
                        v-model="form.estado"
                        :options="estadosOpciones"
                        optionLabel="label"
                        optionValue="value"
                        class="w-full"
                    />
                </div>
            </div>
        </div>

        <template #footer>
            <div class="dialog-footer">
                <Button label="Cancelar" text @click="showDialog = false" />
                <Button label="Guardar" icon="pi pi-check" @click="guardarAlumno" />
            </div>
        </template>
    </Dialog>

    <!-- ========================= -->
    <!-- DIALOG IMPORTACIÓN        -->
    <!-- ========================= -->
    <Dialog v-model:visible="showCsvDialog" header="Importar alumnos" modal style="width: 860px">
        <div class="import-header">
            <div>
                <p class="import-title">Plantilla oficial de carga</p>
                <p class="import-sub">Se aceptan archivos .csv y .xlsx con las columnas: nombre, correo, password, matricula, carrera, cuatrimestre</p>
            </div>
            <Button icon="pi pi-download" label="Descargar plantilla" text severity="secondary" @click="descargarPlantillaExcel" />
        </div>

        <input ref="fileInput" type="file" accept=".csv,.xlsx" class="hidden-input" @change="onFileUpload" />

        <div
            class="upload-box"
            @dragover.prevent
            @drop.prevent="(e) => { const file = e.dataTransfer?.files?.[0]; if (file) onFileUpload({ target: { files: [file] } }); }"
        >
            <i class="pi pi-file-excel upload-icon"></i>
            <p class="upload-title">Arrastra el archivo aquí</p>
            <p class="upload-sub">o selecciónalo manualmente</p>
            <div class="upload-actions">
                <Button icon="pi pi-folder-open" label="Elegir archivo" @click="$refs.fileInput.click()" />
                <Button icon="pi pi-times" label="Cancelar" text severity="secondary" @click="showCsvDialog = false" />
            </div>
        </div>

        <div v-if="csvPreview.length" class="import-summary">
            <div class="summary-pill summary-success">
                <i class="pi pi-check"></i>
                Válidos: {{ csvPreview.filter((r) => r.valido).length }}
            </div>
            <div class="summary-pill summary-danger">
                <i class="pi pi-exclamation-triangle"></i>
                Con error: {{ csvPreview.filter((r) => !r.valido).length }}
            </div>
        </div>

        <DataTable v-if="csvPreview.length" :value="csvPreview" paginator :rows="5" class="import-preview" responsiveLayout="scroll">
            <Column header="Estado" style="width: 100px">
                <template #body="{ data }">
                    <Tag :value="data.valido ? 'OK' : 'Error'" :severity="data.valido ? 'success' : 'danger'" />
                </template>
            </Column>
            <Column field="nombre" header="Nombre" />
            <Column field="correo" header="Correo" />
            <Column field="matricula" header="Matrícula" />
            <Column field="carrera" header="Carrera" />
            <Column field="cuatrimestre" header="Cuatrimestre" />
            <Column header="Errores" style="min-width: 200px">
                <template #body="{ data }">
                    <span v-if="data.errores?.length" class="error-list">{{ data.errores.join(' · ') }}</span>
                    <span v-else class="muted-dash">—</span>
                </template>
            </Column>
        </DataTable>

        <template #footer>
            <div class="import-footer">
                <span v-if="csvPreview.length" class="import-count">
                    {{ csvPreview.length }} registros · {{ csvPreview.filter((r) => r.valido).length }} válidos
                </span>
                <div class="flex gap-2">
                    <Button label="Cancelar" text @click="showCsvDialog = false" />
                    <Button
                        label="Importar alumnos"
                        icon="pi pi-upload"
                        :loading="importing"
                        :disabled="!csvPreview.length || csvPreview.filter((r) => r.valido).length === 0"
                        @click="importCsv"
                    />
                </div>
            </div>
        </template>
    </Dialog>

    <!-- ========================= -->
    <!-- DIALOG AVANZAR CUATRI     -->
    <!-- ========================= -->
    <Dialog
        v-model:visible="showAvanzarCuatriDialog"
        modal
        header="Avanzar cuatrimestre"
        :style="{ width: '460px' }"
    >
        <div class="avanzar-cuatri-body">
            <div class="ac-icon-wrap">
                <i class="pi pi-arrow-up"></i>
            </div>

            <p class="ac-description">
                Esta acción avanzará el <strong>grado académico (cuatrimestre)</strong> de
                <strong>todos los alumnos activos y reincorporados</strong> en el sistema.
                Los alumnos en estado <em>baja</em> no serán afectados.
            </p>

            <div class="ac-field">
                <label class="ac-label">Incremento de cuatrimestres</label>
                <InputNumber
                    v-model="incrementoCuatri"
                    :min="1"
                    :max="3"
                    showButtons
                    class="ac-input"
                    suffix=" cuatrimestre(s)"
                />
                <small class="ac-hint">Máximo 3 cuatrimestres por operación</small>
            </div>

            <div class="ac-warning">
                <i class="pi pi-exclamation-triangle"></i>
                <span>Esta acción <strong>no se puede deshacer</strong>. Úsala solo al inicio de un nuevo semestre escolar.</span>
            </div>
        </div>

        <template #footer>
            <Button label="Cancelar" icon="pi pi-times" text @click="showAvanzarCuatriDialog = false" />
            <Button
                label="Sí, avanzar cuatrimestre"
                icon="pi pi-arrow-up"
                severity="warning"
                :loading="loadingAvanzarCuatri"
                @click="confirmarAvanzarCuatrimestre"
            />
        </template>
    </Dialog>

    <!-- ========================= -->
    <!-- DIALOG RESULTADO CUATRI   -->
    <!-- ========================= -->
    <Dialog
        v-model:visible="showResultadosCuatriDialog"
        modal
        header="Resultado: Avanzar cuatrimestre"
        :style="{ width: '440px' }"
    >
        <div v-if="resultadosCuatri" class="ac-resultado-body">
            <div class="ac-resultado-check">
                <i class="pi pi-check-circle"></i>
            </div>

            <div class="ac-resultado-stat">
                <span class="ac-resultado-num">{{ resultadosCuatri.total_actualizados }}</span>
                <span class="ac-resultado-lbl">alumnos actualizados</span>
            </div>

            <div class="ac-resultado-incremento">
                <i class="pi pi-arrow-up"></i>
                <span>Incremento aplicado: <strong>+{{ resultadosCuatri.incremento }} cuatrimestre(s)</strong></span>
            </div>

            <p class="ac-resultado-mensaje">{{ resultadosCuatri.mensaje }}</p>

            <div class="ac-resultado-omitidos" v-if="resultadosCuatri.omitidos">
                <i class="pi pi-info-circle"></i>
                <span>{{ resultadosCuatri.omitidos }}</span>
            </div>
        </div>

        <template #footer>
            <Button label="Cerrar" icon="pi pi-times" @click="showResultadosCuatriDialog = false" />
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

/* ── Stats Bar ───────────────────────────── */
.stats-bar {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}
.stat-chip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 600;
    border: 1px solid var(--p-content-border-color);
    color: var(--p-text-muted-color);
    background: var(--p-content-background);
}
.stat-success { color: var(--sisa-icon-green); background: var(--sisa-tint-green); border-color: transparent; }
.stat-danger  { color: var(--sisa-icon-red);   background: var(--sisa-tint-red);   border-color: transparent; }
.stat-total   { color: var(--sisa-icon-blue);  background: var(--sisa-tint-blue);  border-color: transparent; }

/* ── Filter Card ─────────────────────────── */
.filter-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
}
.filters-grid {
    display: grid;
    grid-template-columns: 1fr 200px 180px;
    gap: 0.75rem;
    align-items: center;
}
.search-wrap {
    position: relative;
    display: flex;
    align-items: center;
}
.search-wrap .pi {
    position: absolute;
    left: 0.75rem;
    color: var(--p-text-muted-color);
    pointer-events: none;
    z-index: 1;
}
.search-wrap :deep(input) {
    padding-left: 2.25rem;
    width: 100%;
}

/* ── Table Card ──────────────────────────── */
.table-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 0.75rem;
    overflow: hidden;
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
.carrera-badge {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--sisa-icon-blue);
    background: var(--sisa-tint-blue);
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
}
.cuatri-num {
    font-weight: 700;
    color: var(--p-text-color);
}
.row-actions {
    display: flex;
    gap: 0.25rem;
}

/* ── Dialog Form ─────────────────────────── */
.dialog-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 0.5rem;
}
.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}
.form-field label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}
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
    font-size: 0.82rem;
    color: var(--p-text-muted-color);
    margin: 0;
}
.hidden-input { display: none; }
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
    color: var(--sisa-icon-blue);
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
.summary-success { background: var(--sisa-tint-green); color: var(--sisa-icon-green); }
.summary-danger  { background: var(--sisa-tint-red);   color: var(--sisa-icon-red); }
.import-preview { margin-top: 1rem; }
.error-list { font-size: 0.78rem; color: var(--sisa-icon-red); }
.muted-dash { color: var(--p-text-muted-color); }
.import-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 1rem;
    flex-wrap: wrap;
}
.import-count { font-size: 0.85rem; color: var(--p-text-muted-color); }

/* ── Cuatrimestre + Práctica cell ────────── */
.cuatri-practica-cell {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
}
.cuatri-row,
.practica-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.82rem;
}
.cp-icon {
    font-size: 0.75rem;
    color: var(--sisa-icon-blue);
    flex-shrink: 0;
}
.cp-icon-amber { color: var(--sisa-icon-amber, #d97706); }
.cuatri-num {
    font-weight: 700;
    color: var(--p-text-color);
}
.cp-lbl {
    color: var(--p-text-muted-color);
    font-size: 0.75rem;
}
.practica-num {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--sisa-icon-amber, #d97706);
}

/* ── Avanzar Cuatrimestre Dialog ─────────── */
.avanzar-cuatri-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.1rem;
    padding: 0.25rem 0 0.5rem;
    text-align: center;
}
.ac-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--sisa-tint-amber, rgba(217, 119, 6, 0.1));
    color: var(--sisa-icon-amber, #d97706);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
}
.ac-description {
    font-size: 0.9rem;
    line-height: 1.55;
    color: var(--p-text-color);
    max-width: 360px;
    margin: 0;
}
.ac-field {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
}
.ac-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.ac-input {
    width: 100%;
    max-width: 280px;
}
.ac-hint {
    font-size: 0.75rem;
    color: var(--p-text-muted-color);
}
.ac-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.65rem 0.875rem;
    border-radius: 8px;
    background: var(--sisa-tint-red, rgba(220, 38, 38, 0.08));
    color: var(--sisa-icon-red, #dc2626);
    font-size: 0.83rem;
    line-height: 1.45;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
}
.ac-warning .pi { flex-shrink: 0; margin-top: 0.1rem; }

/* ── Resultado Cuatrimestre Dialog ───────── */
.ac-resultado-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
    padding: 0.5rem 0 0.5rem;
    text-align: center;
}
.ac-resultado-check {
    font-size: 2.5rem;
    color: var(--sisa-icon-green, #16a34a);
}
.ac-resultado-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
}
.ac-resultado-num {
    font-size: 3rem;
    font-weight: 800;
    color: var(--sisa-icon-green, #16a34a);
    line-height: 1;
}
.ac-resultado-lbl {
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
}
.ac-resultado-incremento {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.875rem;
    border-radius: 20px;
    background: var(--sisa-tint-amber, rgba(217, 119, 6, 0.1));
    color: var(--sisa-icon-amber, #d97706);
    font-size: 0.85rem;
}
.ac-resultado-mensaje {
    font-size: 0.88rem;
    color: var(--p-text-color);
    margin: 0;
    line-height: 1.5;
}
.ac-resultado-omitidos {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
    background: var(--p-surface-50);
    border: 1px solid var(--p-content-border-color);
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
}
.ac-resultado-omitidos .pi { flex-shrink: 0; margin-top: 0.1rem; }

/* ── Responsive ──────────────────────────── */
@media (max-width: 900px) {
    .filters-grid { grid-template-columns: 1fr; }
    .form-row { grid-template-columns: 1fr; }
    .page-header { flex-direction: column; align-items: flex-start; }
}
</style>
