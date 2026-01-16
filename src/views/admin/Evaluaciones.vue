<script setup>
import api from '@/api/axios';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';

// PrimeVue
import AutoComplete from 'primevue/autocomplete';
import Button from 'primevue/button';
import Calendar from 'primevue/calendar';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';

// =======================
// STATE
// =======================
const toast = useToast();

const periodos = ref([]);
const periodoSeleccionado = ref(null);
const evaluaciones = ref([]);
const loading = ref(false);

const dialogVisible = ref(false);
const evaluacionSeleccionada = ref(null);

const form = ref({
    calificacion: null,
    observaciones: ''
});

// =======================
// FILTERS
// =======================
const filters = ref({
    global: { value: null, matchMode: 'contains' },
    'alumno.nombre': { value: null, matchMode: 'contains' },
    'alumno.matricula': { value: null, matchMode: 'contains' },
    'alumno.carrera': { value: null, matchMode: 'equals' },
    'alumno.semestre': { value: null, matchMode: 'equals' },
    fecha_envio: { value: null, matchMode: 'equals' },
    evaluado: { value: null, matchMode: 'equals' },
    calificacion: { value: null, matchMode: 'equals' }
});

// =======================
// FORMATOS
// =======================
const formatFechaHora = (fecha) => {
    if (!fecha) return '-';
    return fecha.toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const normalizeDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

// =======================
// Abrir entreghable
// =======================
const verArchivo = (url) => {
    if (!url) {
        toast.add({
            severity: 'warn',
            summary: 'Archivo no disponible',
            detail: 'No se encontró el enlace del entregable',
            life: 3000
        });
        return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
};

// =======================
// OPTIONS / AUTOCOMPLETE
// =======================
const carrerasOptions = computed(() => {
    const set = new Set();
    evaluaciones.value.forEach((e) => {
        if (e.alumno?.carrera) set.add(e.alumno.carrera);
    });
    return Array.from(set);
});

const semestresOptions = computed(() => {
    const set = new Set();
    evaluaciones.value.forEach((e) => {
        if (e.alumno?.semestre != null) set.add(e.alumno.semestre);
    });
    return Array.from(set).sort((a, b) => a - b);
});

const carreraSuggestions = ref([]);
const semestreSuggestions = ref([]);

const searchCarrera = (event) => {
    const query = event.query.toLowerCase();
    carreraSuggestions.value = carrerasOptions.value.filter((c) => c.toLowerCase().includes(query));
};

const searchSemestre = (event) => {
    const query = event.query;
    semestreSuggestions.value = semestresOptions.value.filter((s) => String(s).includes(query));
};

// =======================
// LOAD PERIODOS
// =======================
const loadPeriodos = async () => {
    const { data } = await api.get('/periodos');
    periodos.value = data.filter((p) => p.estado === 'activo');
};

// =======================
// LOAD EVALUACIONES
// =======================
const loadEvaluaciones = async () => {
    if (!periodoSeleccionado.value) return;

    try {
        loading.value = true;
        const { data } = await api.get(`/entregables/evaluaciones/periodo/${periodoSeleccionado.value.id_periodo}`);

        evaluaciones.value = data.map((e) => ({
            ...e,
            fecha_envio: e.fecha_envio ? normalizeDate(e.fecha_envio) : null
        }));
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar las evaluaciones',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
};

watch(periodoSeleccionado, loadEvaluaciones);

// =======================
// MODAL
// =======================
const abrirEvaluacion = (row) => {
    evaluacionSeleccionada.value = row;
    form.value = {
        calificacion: row.calificacion,
        observaciones: row.observaciones ?? ''
    };
    dialogVisible.value = true;
};

const guardarEvaluacion = async () => {
    try {
        await api.post(`/entregables/evaluar/${evaluacionSeleccionada.value.id_entrega}`, form.value);

        toast.add({
            severity: 'success',
            summary: 'Evaluación guardada',
            life: 3000
        });

        dialogVisible.value = false;
        loadEvaluaciones();
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo guardar la evaluación',
            life: 4000
        });
    }
};

onMounted(loadPeriodos);
</script>

<template>
    <div class="card">
        <!-- HEADER -->
        <div class="flex justify-between items-center mb-4">
            <h5 class="m-0">Evaluaciones</h5>

            <Dropdown v-model="periodoSeleccionado" :options="periodos" optionLabel="nombre" placeholder="Selecciona periodo activo" class="w-20rem" />
        </div>

        <!-- BUSQUEDA GLOBAL -->
        <div class="mb-3">
            <span class="p-input-icon-left">
                <i class="pi pi-search" />
                <InputText v-model="filters.global.value" placeholder="Buscar en evaluaciones..." class="w-20rem" />
            </span>
        </div>

        <!-- TABLA -->
        <DataTable :value="evaluaciones" :loading="loading" paginator :rows="10" responsiveLayout="scroll" showGridlines filterDisplay="menu" v-model:filters="filters" :globalFilterFields="['alumno.nombre', 'alumno.matricula']">
            <Column field="alumno.nombre" header="Alumno" filter />
            <Column field="alumno.matricula" header="Matrícula" filter />

            <!-- CARRERA -->
            <Column field="alumno.carrera" header="Carrera" filter :showFilterMatchModes="false">
                <template #filter="{ filterModel }">
                    <AutoComplete v-model="filterModel.value" :suggestions="carreraSuggestions" @complete="searchCarrera" placeholder="Buscar carrera" dropdown forceSelection class="w-full" />
                </template>
            </Column>

            <!-- SEMESTRE -->
            <Column field="alumno.semestre" header="Semestre" filter :showFilterMatchModes="false">
                <template #filter="{ filterModel }">
                    <AutoComplete v-model="filterModel.value" :suggestions="semestreSuggestions" @complete="searchSemestre" placeholder="Buscar semestre" dropdown forceSelection class="w-full" />
                </template>
            </Column>

            <Column field="entregable.nombre" header="Entregable" filter />

            <!-- FECHA -->
            <Column field="fecha_envio" header="Fecha entrega" filter :showFilterMatchModes="false">
                <template #body="{ data }">
                    {{ formatFechaHora(data.fecha_envio) }}
                </template>

                <template #filter="{ filterModel }">
                    <Calendar v-model="filterModel.value" placeholder="Selecciona fecha" dateFormat="dd/mm/yy" showIcon showButtonBar class="w-full" />
                </template>
            </Column>

            <!-- ESTADO -->
            <Column field="evaluado" header="Estado" filter :showFilterMatchModes="false">
                <template #filter="{ filterModel }">
                    <Dropdown
                        v-model="filterModel.value"
                        :options="[
                            { label: 'Evaluado', value: true },
                            { label: 'Pendiente', value: false }
                        ]"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Selecciona estado"
                        showClear
                        class="w-full"
                    />
                </template>

                <template #body="{ data }">
                    <Tag :value="data.evaluado ? 'Evaluado' : 'Pendiente'" :severity="data.evaluado ? 'success' : 'warning'" />
                </template>
            </Column>

            <!-- CALIFICACION -->
            <Column field="calificacion" header="Calificación" filter :showFilterMatchModes="false">
                <template #filter="{ filterModel }">
                    <Dropdown v-model="filterModel.value" :options="[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]" placeholder="Selecciona calificación" showClear class="w-full" />
                </template>
            </Column>

            <!-- ACCIONES -->
            <Column header="Acciones" style="width: 120px">
                <template #body="{ data }">
                    <Button icon="pi pi-eye" text @click="abrirEvaluacion(data)" v-tooltip="'Ver / Evaluar'" />
                </template>
            </Column>
        </DataTable>

        <!-- MODAL -->
        <!-- MODAL EVALUACIÓN -->
        <Dialog v-model:visible="dialogVisible" modal header="📝 Evaluar entregable" :style="{ width: '640px' }" :breakpoints="{ '960px': '90vw', '640px': '95vw' }" :pt="{ content: { class: 'dialog-content-full' } }">
            <div class="dialog-form">
                <div class="form-grid">
                    <div class="form-field">
                        <label>Alumno</label>
                        <InputText :value="evaluacionSeleccionada?.alumno.nombre" disabled />
                    </div>

                    <div class="form-field">
                        <label>Entregable</label>
                        <InputText :value="evaluacionSeleccionada?.entregable.nombre" disabled />
                    </div>

                    <div class="form-field">
                        <label>Archivo</label>
                        <Button icon="pi pi-download" label="Ver archivo" severity="info" @click="verArchivo(evaluacionSeleccionada.archivo_url)" />
                    </div>

                    <div class="form-field">
                        <label>Calificación</label>
                        <InputNumber v-model="form.calificacion" :min="0" :max="10" />
                    </div>

                    <div class="form-field full">
                        <label>Observaciones</label>
                        <Textarea v-model="form.observaciones" rows="4" />
                    </div>
                </div>
            </div>

            <template #footer>
                <div class="dialog-footer">
                    <Button label="Cancelar" text @click="dialogVisible = false" />
                    <Button label="Guardar" icon="pi pi-check" severity="success" @click="guardarEvaluacion" />
                </div>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
}

.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.form-field.full {
    grid-column: span 2;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
}

@media (max-width: 640px) {
    .form-grid {
        grid-template-columns: 1fr;
    }

    .form-field.full {
        grid-column: span 1;
    }
}
</style>
