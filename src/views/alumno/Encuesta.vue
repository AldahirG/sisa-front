<script>
import { ref, onMounted } from 'vue';
// PrimeVue
import Button from 'primevue/button';
import RadioButton from 'primevue/radiobutton';

export default {
    name: 'EncuestaSimulada',
    components: { Button, RadioButton },
    setup() {
        const loading = ref(false);
        const encuesta = ref(null);

        const loadEncuestaSimulada = () => {
            loading.value = true;
            // Simula carga desde API
            setTimeout(() => {
                encuesta.value = {
                    experiencia_general: null,
                    recomendacion: null,
                    aspectos_mejorar: null,
                };
                loading.value = false;
            }, 600);
        };

        const saveEncuestaSimulada = () => {
            loading.value = true;
            // Simula guardado
            setTimeout(() => {
                // console.log('Encuesta guardada (simulada):', JSON.parse(JSON.stringify(encuesta.value)));
                loading.value = false;
            }, 500);
        };

        onMounted(loadEncuestaSimulada);

        return {
            loading,
            encuesta,
            saveEncuestaSimulada,
        };
    },
};
</script>
<template>
    <div>
        <div v-if="loading" class="card">
             Cargando encuesta simulada...
        </div>

        <div class="card" v-else-if="encuesta">
            <h2 class="text-xl font-semibold mb-3">Proximamente Encuesta de Satisfacción</h2>

            <div class="mb-4">
                <span class="block font-medium mb-2">¿Cómo calificarías tu experiencia general con el programa?</span>
                <div class="flex flex-wrap gap-3">
                    <div v-for="option in ['Excelente', 'Bueno', 'Regular', 'Malo']" :key="option" class="flex align-items-center">
                        <RadioButton :inputId="'exp-'+option" :value="option" v-model="encuesta.experiencia_general" />
                        <label :for="'exp-'+option" class="ml-2">{{ option }}</label>
                    </div>
                </div>
            </div>

            <div class="mb-4">
                <span class="block font-medium mb-2">¿Recomendarías el programa a otros estudiantes?</span>
                <div class="flex flex-wrap gap-3">
                    <div v-for="option in ['Definitivamente sí', 'Probablemente sí', 'No estoy seguro', 'Probablemente no', 'Definitivamente no']" :key="option" class="flex align-items-center">
                        <RadioButton :inputId="'rec-'+option" :value="option" v-model="encuesta.recomendacion" />
                        <label :for="'rec-'+option" class="ml-2">{{ option }}</label>
                    </div>
                </div>
            </div>

            <div class="mb-4">
                <span class="block font-medium mb-2">¿Qué aspectos del programa consideras que podrían mejorarse?</span>
                <div class="flex flex-wrap gap-3">
                    <div v-for="option in ['Comunicación', 'Soporte técnico', 'Contenido del programa', 'Interacción con mentores', 'Otro']" :key="option" class="flex align-items-center">
                        <RadioButton :inputId="'asp-'+option" :value="option" v-model="encuesta.aspectos_mejorar" />
                        <label :for="'asp-'+option" class="ml-2">{{ option }}</label>
                    </div>
                </div>
            </div>

            <div class="flex gap-3">
                <Button label="Cargar datos simulados" icon="pi pi-refresh" class="p-button-warning"
                    @click="encuesta = { experiencia_general: 'Bueno', recomendacion: 'Probablemente sí', aspectos_mejorar: 'Contenido del programa' }"
                    :disabled="loading" />
                <Button label="Guardar respuestas" icon="pi pi-save" class="p-button-success" @click="saveEncuestaSimulada" :disabled="loading" />
            </div>

            <!-- <div class="mt-4">
                <h3 class="text-lg font-medium mb-2">Vista previa (simulada):</h3>
                <pre>{{ JSON.stringify(encuesta, null, 2) }}</pre>
            </div> -->
        </div>

        <div v-else class="card">
            No hay encuesta disponible.
        </div>
    </div>
</template>
<style scoped>
.mb-4 {
    margin-bottom: 1rem;
}

.flex-wrap {
    flex-wrap: wrap;
}

.align-items-center {
    align-items: center;
}
.gap-3 {
    gap: 0.75rem;
}
</style>
