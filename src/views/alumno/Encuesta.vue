<script>
import api from '@/api/axios';
import { onMounted, ref } from 'vue';
// PrimeVue
import Button from 'primevue/button';
import RadioButton from 'primevue/radiobutton';
import { useRouter } from 'vue-router';
const router = useRouter();
// ==========================
// STATE
const loading = ref(false);
const encuesta = ref(null);
// ==========================
// LOAD
const loadEncuesta = async () => {
    loading.value = true;
    try {
        const { data } = await api.get('/alumno/encuesta');
        encuesta.value = data;
    } finally {
        loading.value = false;
    }
};
onMounted(loadEncuesta);
</script>

<template>
    <div class="card" v-if="encuesta">
        <h2 class="text-xl font-semibold mb-3">Encuesta de Satisfacción</h2>

        <div class="mb-4">
            <span class="block font-medium mb-2">¿Cómo calificarías tu experiencia general con el programa?</span>
            <div class="flex flex-wrap gap-3">
                <div v-for="option in ['Excelente', 'Bueno', 'Regular', 'Malo']" :key="option" class="flex align-items-center">
                    <RadioButton :inputId="option" :value="option" v-model="encuesta.experiencia_general" />
                    <label :for="option" class="ml-2">{{ option }}</label>
                </div>
            </div>
        </div>

        <div class="mb-4">
            <span class="block font-medium mb-2">¿Recomendarías el programa a otros estudiantes?</span>
            <div class="flex flex-wrap gap-3">
                <div v-for="option in ['Definitivamente sí', 'Probablemente sí', 'No estoy seguro', 'Probablemente no', 'Definitivamente no']" :key="option" class="flex align-items-center">
                    <RadioButton :inputId="option" :value="option" v-model="encuesta.recomendacion" />
                    <label :for="option" class="ml-2">{{ option }}</label>
                </div>
            </div>
        </div>
        <div class="mb-4">
            <span class="block font -medium mb-2">¿Qué aspectos del programa consideras que podrían mejorarse?</span>
            <div class="flex flex-wrap gap-3">
                <div v-for="option in ['Comunicación', 'Soporte técnico', 'Contenido del programa', 'Interacción con mentores', 'Otro']" :key="option" class="flex align-items-center">
                    <RadioButton :inputId="option" :value="option" v-model="encuesta.aspectos_mejorar" />
                    <label :for="option" class="ml-2">{{ option }}</label>
                </div>
            </div>
        </div>
        <Button label="Guardar respuestas" icon="pi pi-save" class="p-button-success" />
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
