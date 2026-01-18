<script setup>
import api from '@/api/axios';
import { computed, onMounted, ref } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
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

const busqueda = ref('');
const vacanteSeleccionada = ref(null);
const mostrarConfirmacion = ref(false);

// ==========================
// LOAD DATA
// ==========================
const loadData = async () => {
  loading.value = true;
  try {
    const [vacantesRes, postulacionesRes, historialRes] = await Promise.all([
      api.get('/vacantes/disponibles'),
      api.get('/postulaciones/me'),
      api.get('/historial/me')
    ]);

    vacantes.value = vacantesRes.data ?? [];
    postulaciones.value = postulacionesRes.data ?? [];
    historial.value = historialRes.data ?? null;
  } catch (err) {
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

// ==========================
// COMPUTED
// ==========================

// Empresa ya asignada
const asignacion = computed(() => {
  if (!Array.isArray(historial.value)) return null;
  return historial.value.find(h => h.empresa);
});

const yaAsignado = computed(() => !!asignacion.value);

// Postulación activa
const postulacionActiva = computed(() =>
  postulaciones.value.find(p =>
    p.estado === 'POSTULADO' || p.estado === 'ACEPTADO'
  )
);

// Postulación rechazada
const postulacionRechazada = computed(() =>
  postulaciones.value.find(p => p.estado === 'RECHAZADO')
);

// Puede postular
const puedePostular = computed(() =>
  !yaAsignado.value && !postulacionActiva.value
);

// Vacantes filtradas
const vacantesFiltradas = computed(() => {
  if (!busqueda.value) return vacantes.value;

  const term = busqueda.value.toLowerCase();
  return vacantes.value.filter(v =>
    v.nombre.toLowerCase().includes(term) ||
    v.empresa?.nombre?.toLowerCase().includes(term)
  );
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

// Descargar carta
const descargarCarta = async () => {
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

    // 🔐 forma segura de obtener matrícula
    const matricula =
      asignacion.value?.alumno?.matricula ||
      asignacion.value?.matricula ||
      'ALUMNO';

    const link = document.createElement('a');
    link.href = url;
    link.download = `Carta_Presentacion_${matricula}.docx`;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
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

  <!-- ========================= -->
  <!-- HEADER -->
  <!-- ========================= -->
  <div class="mb-4">
    <h2 class="text-2xl font-semibold mb-2">Vacantes disponibles</h2>
    <p class="opacity-70">
      Postúlate a una vacante disponible para realizar tus prácticas profesionales.
    </p>
  </div>

  <!-- ========================= -->
  <!-- LOADING -->
  <!-- ========================= -->
  <div v-if="loading" class="flex justify-center mt-6">
    <ProgressSpinner />
  </div>

  <!-- ========================= -->
  <!-- EMPRESA ASIGNADA (ACEPTADO) -->
  <!-- ========================= -->
  <div v-else-if="yaAsignado">
    <Card class="mb-4">
      <template #content>
        <div class="flex gap-3 align-items-start">
          <i class="pi pi-check-circle text-green-500 text-3xl"></i>
          <div class="flex-1">
            <h3 class="m-0 mb-1">Postulación aceptada</h3>
            <p class="opacity-80 mb-3">
              Has sido aceptado para realizar tus prácticas profesionales.
            </p>

            <div class="grid">
              <div class="col-12 md:col-6">
                <strong>Vacante</strong>
                <p class="m-0">{{ asignacion.categoria.nombre }}</p>
              </div>

              <div class="col-12 md:col-6">
                <strong>Empresa</strong>
                <p class="m-0">{{ asignacion.empresa.nombre }}</p>
              </div>

              <div class="col-12 md:col-6">
                <strong>Correo</strong>
                <p class="m-0">{{ asignacion.empresa.correo }}</p>
              </div>

              <div class="col-12 md:col-6">
                <strong>Teléfono</strong>
                <p class="m-0">{{ asignacion.empresa.telefono }}</p>
              </div>
            </div>

            <Button
              label="Descargar carta de presentación"
              icon="pi pi-download"
              class="mt-4"
              severity="success"
              @click="descargarCarta"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>

  <!-- ========================= -->
  <!-- POSTULACIÓN EN ESPERA -->
  <!-- ========================= -->
  <div v-else-if="postulacionActiva && postulacionActiva.estado === 'POSTULADO'">
    <Card class="mb-4 border-yellow-400">
      <template #content>
        <div class="flex gap-3">
          <i class="pi pi-clock text-yellow-500 text-3xl"></i>
          <div>
            <h3 class="m-0">Postulación en espera de aprobación</h3>
            <p class="opacity-80">
              Tu solicitud está siendo revisada. No podrás postularte a otras
              vacantes hasta que se resuelva.
            </p>
          </div>
        </div>
      </template>
    </Card>
  </div>

  <!-- ========================= -->
  <!-- POSTULACIÓN RECHAZADA -->
  <!-- ========================= -->
  <div v-else-if="postulacionRechazada">
    <Card class="mb-4 border-red-400">
      <template #content>
        <div class="flex gap-3">
          <i class="pi pi-times-circle text-red-500 text-3xl"></i>
          <div>
            <h3 class="m-0">Postulación rechazada</h3>
            <p class="opacity-80">
              Motivo:
              <strong>{{ postulacionRechazada.motivo || 'No especificado' }}</strong>
            </p>
            <p class="opacity-70">
              Puedes postularte nuevamente a otra vacante disponible.
            </p>
          </div>
        </div>
      </template>
    </Card>
  </div>

  <!-- ========================= -->
  <!-- BUSCADOR (solo si puede postular) -->
  <!-- ========================= -->
<div v-if="puedePostular" class="mb-4">
  <div class="search-wrapper">
    <i class="pi pi-search search-icon" />
    <InputText
      v-model="busqueda"
      placeholder="Buscar vacante o empresa..."
      class="search-input"
    />
  </div>
</div>


  <!-- ========================= -->
  <!-- LISTADO + DETALLE -->
  <!-- ========================= -->
  <div v-if="puedePostular" class="grid">
    <!-- LISTADO -->
    <div class="col-12 md:col-5 xl:col-4">
      <div
        v-for="v in vacantesFiltradas"
        :key="v.id_categoria"
        class="mb-3"
      >
        <Card
          class="cursor-pointer"
          :class="{ 'border-primary': vacanteSeleccionada?.id_categoria === v.id_categoria }"
          @click="vacanteSeleccionada = v"
        >
          <template #title>
            {{ v.nombre }}
          </template>

          <template #subtitle>
            {{ v.empresa?.nombre }}
          </template>

          <template #content>
            <Tag
              :value="`Cupo: ${v.cupo_disponible}`"
              :severity="v.cupo_disponible > 0 ? 'success' : 'danger'"
            />
          </template>
        </Card>
      </div>
    </div>

    <!-- DETALLE -->
    <div class="col-12 md:col-7 xl:col-8">
      <Card v-if="vacanteSeleccionada">
        <template #title>
          {{ vacanteSeleccionada.nombre }}
        </template>

        <template #subtitle>
          {{ vacanteSeleccionada.empresa?.nombre }}
        </template>

        <template #content>
          <p class="mb-3">
            {{ vacanteSeleccionada.descripcion || 'Sin descripción disponible' }}
          </p>

          <Tag
            :value="`Cupo disponible: ${vacanteSeleccionada.cupo_disponible}`"
            severity="info"
            class="mb-3"
          />

          <Button
            label="Postularme"
            icon="pi pi-send"
            severity="primary"
            :disabled="vacanteSeleccionada.cupo_disponible <= 0"
            @click="confirmarPostulacion(vacanteSeleccionada)"
          />
        </template>
      </Card>

      <Card v-else class="opacity-70">
        <template #content>
          <p>Selecciona una vacante para ver los detalles.</p>
        </template>
      </Card>
    </div>
  </div>

  <!-- ========================= -->
  <!-- CONFIRM DIALOG -->
  <!-- ========================= -->
  <Dialog
    v-model:visible="mostrarConfirmacion"
    modal
    header="Confirmar postulación"
    :style="{ width: '420px' }"
  >
    <p>
      Al postularte a esta vacante ya no podrás postularte a otras hasta que se
      resuelva tu solicitud.
    </p>

    <template #footer>
      <Button
        label="Cancelar"
        text
        @click="mostrarConfirmacion = false"
      />
      <Button
        label="Confirmar postulación"
        severity="primary"
        icon="pi pi-check"
        @click="postularme"
      />
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
