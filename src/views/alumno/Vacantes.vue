<script setup>
import api from '@/api/axios';
import { computed, onMounted, ref } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import Card from 'primevue/card';
import ProgressSpinner from 'primevue/progressspinner';
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

// ==========================
// LOADERS
// ==========================
const loadData = async () => {
    loading.value = true;
    try {
        const [vacantesRes, postulacionesRes, historialRes] = await Promise.all([api.get('/vacantes/disponibles'), api.get('/postulaciones/me'), api.get('/historial/me')]);

        vacantes.value = vacantesRes.data ?? [];
        postulaciones.value = postulacionesRes.data ?? [];
        historial.value = historialRes.data ?? null;
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar la información de vacantes'
        });
    } finally {
        loading.value = false;
    }
};

onMounted(loadData);

// ==========================
// COMPUTED
// ==========================
const yaAsignado = computed(() => {
    return Array.isArray(historial.value) && historial.value.some((h) => h.empresa);
});

const postulacionActiva = computed(() => postulaciones.value.find((p) => p.estado === 'POSTULADO' || p.estado === 'ACEPTADO'));

const puedePostular = computed(() => !yaAsignado.value && !postulacionActiva.value);

// ==========================
// ACTIONS
// ==========================
const postularme = async (id_categoria) => {
    try {
        await api.post('/postulaciones', { id_categoria });

        toast.add({
            severity: 'success',
            summary: 'Postulación enviada',
            detail: 'Tu postulación fue registrada correctamente'
        });

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
</script>

<template>
    <Toast />

    <div class="grid">
        <div class="col-12">
            <h2 class="text-xl font-semibold mb-3">Vacantes disponibles</h2>
        </div>

        <!-- LOADING -->
        <div v-if="loading" class="col-12 flex justify-center">
            <ProgressSpinner />
        </div>

        <!-- YA ASIGNADO -->
        <div v-else-if="yaAsignado" class="col-12">
            <Card>
                <template #content>
                    <div class="flex align-items-center gap-3">
                        <i class="pi pi-check-circle text-green-500 text-3xl"></i>
                        <div>
                            <h3 class="m-0">Ya cuentas con empresa asignada</h3>
                            <p class="m-0 opacity-80">No es posible realizar nuevas postulaciones.</p>
                        </div>
                    </div>
                </template>
            </Card>
        </div>

        <!-- LISTADO -->
        <template v-else>
            <div v-for="v in vacantes" :key="v.id_categoria" class="col-12 md:col-6 xl:col-4">
                <Card>
                    <template #title>
                        {{ v.nombre }}
                    </template>

                    <template #subtitle>
                        {{ v.empresa?.nombre }}
                    </template>

                    <template #content>
                        <p class="mb-2">
                            {{ v.descripcion || 'Sin descripción' }}
                        </p>

                        <div class="flex justify-between align-items-center mb-2">
                            <Tag :value="`Cupo: ${v.cupo_disponible}`" severity="info" />
                            <Tag v-if="postulacionActiva?.categoria?.id_categoria === v.id_categoria" value="Postulado" severity="warning" />
                        </div>
                    </template>

                    <template #footer>
                        <Button label="Postularme" icon="pi pi-send" class="w-full" severity="primary" :disabled="!puedePostular || v.cupo_disponible <= 0" @click="postularme(v.id_categoria)" />
                    </template>
                </Card>
            </div>
        </template>
    </div>
</template>

<style scoped>
p {
    font-size: 0.95rem;
    opacity: 0.85;
}
</style>
