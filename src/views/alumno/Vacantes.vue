<script setup>
import api from '@/api/axios';
import { computed, onMounted, ref, watch } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';
import SelectButton from 'primevue/selectbutton';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const toast = useToast();

// ==========================
// STATE
// ==========================

const loading = ref(false);
const vacantes = ref([]);
const postulaciones = ref([]);
const historial = ref(null);

const busqueda = ref('');
const vacanteSeleccionada = ref(null);
const mostrarConfirmacion = ref(false);

const modoFiltro = ref('mias');
const hayPeriodoActivo = ref(true);
const alumnoInactivo = ref(false);

const opcionesModo = [
    { label: 'Mi carrera', value: 'mias' },
    { label: 'Todas', value: 'todas' }
];

// ==========================
// POSTULACIÓN VIGENTE (CLAVE)
// ==========================

const postulacionVigente = computed(() => {
    if (!postulaciones.value?.length) return null;

    // Prioridad lógica
    const aceptada = postulaciones.value.find((p) => p.estado === 'ACEPTADO');
    if (aceptada) return aceptada;

    const postulada = postulaciones.value.find((p) => p.estado === 'POSTULADO');
    if (postulada) return postulada;

    const rechazada = postulaciones.value.find((p) => p.estado === 'RECHAZADO');
    if (rechazada) return rechazada;

    return null;
});

// ==========================
// ESTADO CENTRALIZADO
// ==========================

const estadoActual = computed(() => {
    if (alumnoInactivo.value) return 'INACTIVO';
    if (!hayPeriodoActivo.value) return 'SIN_PERIODO';
    if (!postulacionVigente.value) return 'DISPONIBLE';
    return postulacionVigente.value.estado;
});

// ==========================
// COMPUTED LIMPIOS
// ==========================

const puedeVerVacantes = computed(() => {
    return ['DISPONIBLE', 'RECHAZADO'].includes(estadoActual.value);
});

const contactoPrincipal = computed(() => {
    if (estadoActual.value !== 'ACEPTADO') return null;

    const contactos = postulacionVigente.value?.categoria?.empresa?.contactos || [];

    return contactos.find((c) => c.principal) || contactos[0] || null;
});

const vacantesFiltradas = computed(() => {
    if (!busqueda.value) return vacantes.value;

    const term = busqueda.value.toLowerCase();

    return vacantes.value.filter((v) => v.nombre.toLowerCase().includes(term) || v.empresa?.nombre?.toLowerCase().includes(term));
});

// ==========================
// LOAD DATA
// ==========================

const loadVacantes = async () => {
    const endpoint = modoFiltro.value === 'mias' ? '/vacantes/disponibles/mias' : '/vacantes/disponibles';

    const { data } = await api.get(endpoint);
    vacantes.value = data ?? [];
};

const loadData = async () => {
    loading.value = true;

    try {
        const [postulacionesRes, historialRes] = await Promise.all([api.get('/postulaciones/me'), api.get('/historial/me')]);

        postulaciones.value = postulacionesRes.data ?? [];
        historial.value = historialRes.data ?? null;

        hayPeriodoActivo.value = true;

        await loadVacantes();
    } catch (err) {
        if (err.response?.status === 404) {
            alumnoInactivo.value = true;
            vacantes.value = [];
            postulaciones.value = [];
            historial.value = null;
            return;
        }

        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar la información',
            life: 4000
        });
    } finally {
        loading.value = false;
    }
};

onMounted(loadData);

watch(modoFiltro, async () => {
    await loadVacantes();
});

// ==========================
// ACTIONS
// ==========================

const confirmarPostulacion = (vacante) => {
    vacanteSeleccionada.value = vacante;
    mostrarConfirmacion.value = true;
};

const postularme = async () => {
    try {
        await api.post('/postulaciones', {
            id_categoria: vacanteSeleccionada.value.id_categoria
        });

        toast.add({
            severity: 'success',
            summary: 'Postulación enviada',
            detail: 'Tu postulación fue registrada correctamente',
            life: 4000
        });

        mostrarConfirmacion.value = false;
        await loadData();
    } catch (err) {
        toast.add({
            severity: 'warn',
            summary: 'No se pudo postular',
            detail: err.response?.data?.message || 'No es posible realizar la postulación',
            life: 4000
        });
    }
};

const descargarCarta = async () => {
    if (estadoActual.value !== 'ACEPTADO') return;

    try {
        const response = await api.get('/documentos/carta-presentacion', {
            responseType: 'blob',
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            }
        });

        const blob = new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        const url = window.URL.createObjectURL(blob);

        const matricula = postulacionVigente.value?.alumno?.matricula || postulacionVigente.value?.matricula || 'ALUMNO';

        const link = document.createElement('a');
        link.href = url;
        link.download = `Carta_Presentacion_${matricula}.docx`;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo descargar la carta de presentación',
            life: 4000
        });
    }
};
</script>

<template>
    <Toast />

    <!-- HEADER -->
    <div class="flex justify-between items-center mb-4">
        <div>
            <h2 class="text-2xl font-semibold mb-2">Vacantes disponibles</h2>
            <p class="opacity-70">Postúlate a una vacante disponible para realizar tus prácticas profesionales.</p>
        </div>

        <SelectButton v-if="estadoActual !== 'INACTIVO' && estadoActual !== 'SIN_PERIODO'" v-model="modoFiltro" :options="opcionesModo" optionLabel="label" optionValue="value" />
    </div>

    <!-- LOADING -->
    <div v-if="loading" class="flex justify-center mt-6">
        <ProgressSpinner />
    </div>

    <!-- CONTENIDO PRINCIPAL -->
    <template v-else>
        <!-- INACTIVO -->
        <Card v-if="estadoActual === 'INACTIVO'" class="mb-4 border-red-300">
            <template #content>
                <div class="flex gap-3">
                    <i class="pi pi-ban text-red-500 text-3xl"></i>
                    <div>
                        <h3>Alumno inactivo</h3>
                        <p>No puedes visualizar ni postularte a vacantes.</p>
                    </div>
                </div>
            </template>
        </Card>

        <!-- SIN PERIODO -->
        <Card v-else-if="estadoActual === 'SIN_PERIODO'" class="mb-4 border-blue-400">
            <template #content>
                <div class="flex gap-3">
                    <i class="pi pi-info-circle text-blue-500 text-3xl"></i>
                    <div>
                        <h3>No hay periodo activo</h3>
                        <p>Actualmente no hay un periodo disponible.</p>
                    </div>
                </div>
            </template>
        </Card>

        <!-- ACEPTADO -->
        <Card v-else-if="estadoActual === 'ACEPTADO'" class="mb-4 border-green-300">
            <template #content>
                <div class="flex gap-3">
                    <i class="pi pi-check-circle text-green-500 text-3xl"></i>
                    <div class="flex-1">
                        <h3>Postulación aceptada</h3>

                        <div class="grid mt-3">
                            <div class="col-12 md:col-6">
                                <strong>Vacante</strong>
                                <p>{{ postulacionVigente?.categoria?.nombre }}</p>
                            </div>

                            <div class="col-12 md:col-6">
                                <strong>Empresa</strong>
                                <p>{{ postulacionVigente?.categoria?.empresa?.nombre }}</p>
                            </div>

                            <div class="col-12 md:col-6">
                                <strong>Correo</strong>
                                <p>{{ contactoPrincipal?.correo || 'No disponible' }}</p>
                            </div>

                            <div class="col-12 md:col-6">
                                <strong>Teléfono</strong>
                                <p>{{ contactoPrincipal?.telefono || 'No disponible' }}</p>
                            </div>
                        </div>

                        <Button label="Descargar carta de presentación" icon="pi pi-download" class="mt-3" severity="success" @click="descargarCarta" />
                    </div>
                </div>
            </template>
        </Card>

        <!-- POSTULADO -->
        <Card v-else-if="estadoActual === 'POSTULADO'" class="mb-4 border-yellow-400">
            <template #content>
                <div class="flex gap-3">
                    <i class="pi pi-clock text-yellow-500 text-3xl"></i>
                    <div>
                        <h3>Postulación en revisión</h3>
                        <p>No podrás postularte a otras vacantes hasta que se resuelva.</p>
                    </div>
                </div>
            </template>
        </Card>

        <!-- RECHAZADO -->
        <Card v-else-if="estadoActual === 'RECHAZADO'" class="mb-4 border-red-400">
            <template #content>
                <div class="flex gap-3">
                    <i class="pi pi-times-circle text-red-500 text-3xl"></i>
                    <div>
                        <h3>Postulación rechazada</h3>
                        <p>
                            Motivo:
                            <strong>{{ postulacionVigente?.motivo || 'No especificado' }}</strong>
                        </p>
                        <p>Puedes postularte nuevamente.</p>
                    </div>
                </div>
            </template>
        </Card>

        <!-- LISTADO VACANTES -->
        <div v-if="puedeVerVacantes">
            <!-- Buscador -->
            <div class="mb-4">
                <InputText v-model="busqueda" placeholder="Buscar vacante o empresa..." class="w-full" />
            </div>

            <!-- Sin vacantes -->
            <Card v-if="vacantesFiltradas.length === 0">
                <template #content>
                    <p>No hay vacantes disponibles.</p>
                </template>
            </Card>

            <!-- Grid -->
            <div v-else class="grid">
                <div class="col-12 md:col-5 xl:col-4">
                    <div v-for="v in vacantesFiltradas" :key="v.id_categoria" class="mb-3">
                        <Card class="cursor-pointer" :class="{ 'border-primary': vacanteSeleccionada?.id_categoria === v.id_categoria }" @click="vacanteSeleccionada = v">
                            <template #title>
                                {{ v.nombre }}
                            </template>

                            <template #subtitle>
                                {{ v.empresa?.nombre }}
                            </template>

                            <template #content>
                                <Tag :value="`Cupo: ${v.cupo_disponible}`" :severity="v.cupo_disponible > 0 ? 'success' : 'danger'" />
                            </template>
                        </Card>
                    </div>
                </div>

                <div class="col-12 md:col-7 xl:col-8">
                    <Card v-if="vacanteSeleccionada">
                        <template #title>
                            {{ vacanteSeleccionada.nombre }}
                        </template>

                        <template #subtitle>
                            {{ vacanteSeleccionada.empresa?.nombre }}
                        </template>

                        <template #content>
                            <p>{{ vacanteSeleccionada.descripcion }}</p>

                            <Button label="Postularme" icon="pi pi-send" severity="primary" :disabled="vacanteSeleccionada.cupo_disponible <= 0" @click="confirmarPostulacion(vacanteSeleccionada)" />
                        </template>
                    </Card>
                </div>
            </div>
        </div>
    </template>

    <!-- DIALOG -->
    <Dialog v-model:visible="mostrarConfirmacion" modal header="Confirmar postulación">
        <p>Al postularte ya no podrás postularte a otras vacantes hasta que se resuelva.</p>

        <template #footer>
            <Button label="Cancelar" text @click="mostrarConfirmacion = false" />
            <Button label="Confirmar" severity="primary" icon="pi pi-check" @click="postularme" />
        </template>
    </Dialog>
</template>

<style scoped>
.border-primary {
    border: 2px solid var(--primary-color);
}

/* ========================= */
/* BUSCADOR */
/* ========================= */
.search-wrapper {
    position: relative;
    max-width: 32rem;
}

.search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-color-secondary);
    font-size: 1rem;
    pointer-events: none;
}

.search-input {
    width: 100%;
    padding-left: 2.75rem;
    height: 3rem;
    font-size: 1rem;
    border-radius: 0.75rem;
}

/* ========================= */
/* TAGS */
/* ========================= */
.p-tag {
    margin-bottom: 0.5rem;
}

/* Evita choques con botones */
.p-card-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

/* Borde seleccionado */
.border-primary {
    border: 2px solid var(--primary-color);
}
</style>
