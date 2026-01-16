<script setup>
import api from '@/api/axios';
import Dialog from 'primevue/dialog';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

// PrimeVue
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';

const router = useRouter();

// ==========================
// STATE
// ==========================
const loading = ref(false);
const alumnos = ref([]);
const periodos = ref([]);
const confirm = useConfirm();
const toast = useToast();
const showCerrarDialog = ref(false);
// ==========================

const filtros = ref({
    periodo: null,
    empresa: null,
    search: ''
});

// ==========================
// LOADERS
// ==========================
const loadAlumnos = async () => {
    loading.value = true;
    try {
        const { data } = await api.get('/control-academico');
        alumnos.value = data ?? [];
    } finally {
        loading.value = false;
    }
};

const loadPeriodos = async () => {
    const { data } = await api.get('/periodos');
    periodos.value = data ?? [];
};

onMounted(async () => {
    await Promise.all([loadAlumnos(), loadPeriodos()]);
});

// ==========================
// COMPUTED
// ==========================
const empresasOptions = computed(() => {
    const map = new Map();
    for (const a of alumnos.value) {
        const e = a?.empresa;
        if (e?.id_empresa && !map.has(e.id_empresa)) {
            map.set(e.id_empresa, e);
        }
    }
    return Array.from(map.values()).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
});

const alumnosFiltrados = computed(() => {
    const search = filtros.value.search.toLowerCase().trim();

    return alumnos.value.filter((a) => {
        const matchPeriodo = !filtros.value.periodo || a.periodo.id_periodo === filtros.value.periodo.id_periodo;

        const matchEmpresa = !filtros.value.empresa || a.empresa.id_empresa === filtros.value.empresa.id_empresa;

        const matchSearch = !search || a.alumno.nombre.toLowerCase().includes(search) || a.alumno.matricula.toLowerCase().includes(search) || a.empresa.nombre.toLowerCase().includes(search) || a.vacante.nombre.toLowerCase().includes(search);

        return matchPeriodo && matchEmpresa && matchSearch;
    });
});

// ==========================
// ACTIONS
// ==========================
const verDetalle = (row) => {
    router.push(`/admin/control-academico/${row.alumno.id_alumno}`);
};

const confirmarCerrarPostulaciones = async () => {
    loading.value = true;
    try {
        const { data } = await api.post('/control-academico/cerrar-postulaciones');

        toast.add({
            severity: 'success',
            summary: 'Postulaciones cerradas',
            detail: `
Aceptados por postulación: ${data.aceptados_por_postulacion}
Asignados automáticamente: ${data.asignados_automaticamente}
Alumnos sin cupo: ${data.alumnos_sin_cupo}
            `,
            life: 6000
        });

        showCerrarDialog.value = false;
        await loadAlumnos();
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: err.response?.data?.message || 'No se pudo cerrar postulaciones'
        });
    } finally {
        loading.value = false;
    }
};

// ==========================
// UI
// ==========================
const estadoSeverity = (estado) => {
    if (estado === 'activo') return 'success';
    if (estado === 'baja') return 'danger';
    return 'secondary';
};

const cerrarPostulaciones = () => {
    confirm.require({
        header: 'Cerrar postulaciones',
        message: 'Se aceptarán todos los alumnos postulados y se asignarán automáticamente los alumnos sin postulación. ¿Deseas continuar?',
        acceptLabel: 'Sí, cerrar',
        rejectLabel: 'Cancelar',
        icon: 'pi pi-exclamation-triangle',
        accept: async () => {
            loading.value = true;
            try {
                const { data } = await api.post('/control-academico/cerrar-postulaciones');

                toast.add({
                    severity: 'success',
                    summary: 'Postulaciones cerradas',
                    detail: `
Periodo: ${data.periodo}
Aceptados por postulación: ${data.aceptados_por_postulacion}
Asignados automáticamente: ${data.asignados_automaticamente}
Alumnos sin cupo: ${data.alumnos_sin_cupo}
                    `,
                    life: 6000
                });

                await loadAlumnos();
            } catch (error) {
                toast.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: error.response?.data?.message || 'No se pudo cerrar postulaciones'
                });
            } finally {
                loading.value = false;
            }
        }
    });
};
</script>

<template>
    <div class="card">
        <!-- ========================= -->
        <!-- HEADER -->
        <!-- ========================= -->
        <div class="header-row">
            <h2 class="text-xl font-semibold">Control Académico</h2>
            <Button icon="pi pi-refresh" label="Recargar" text :loading="loading" @click="loadAlumnos" />
        </div>

        <!-- ========================= -->
        <!-- FILTROS + ACCIÓN -->
        <!-- ========================= -->
        <div class="filters-actions">
            <div class="filters-grid">
                <Dropdown v-model="filtros.periodo" :options="periodos" optionLabel="nombre" placeholder="Periodo" showClear />

                <Dropdown v-model="filtros.empresa" :options="empresasOptions" optionLabel="nombre" placeholder="Empresa" showClear />

                <InputText v-model="filtros.search" placeholder="Buscar alumno / matrícula / empresa / vacante" />
            </div>

            <Button label="Cerrar postulaciones" icon="pi pi-lock" severity="danger" class="cerrar-btn" @click="showCerrarDialog = true" />
        </div>

        <!-- ========================= -->
        <!-- TABLA -->
        <!-- ========================= -->
        <DataTable :value="alumnosFiltrados" paginator :rows="10" :loading="loading" responsiveLayout="scroll">
            <Column header="Alumno">
                <template #body="{ data }">
                    <div class="cell-stack">
                        <div class="cell-title">{{ data.alumno.nombre }}</div>
                        <div class="cell-sub">{{ data.alumno.matricula }}</div>
                    </div>
                </template>
            </Column>

            <Column header="Carrera / Cuatri">
                <template #body="{ data }">
                    <div class="cell-stack">
                        <div class="cell-title">{{ data.alumno.carrera }}</div>
                        <div class="cell-sub">Cuatrimestre {{ data.alumno.cuatrimestre }}</div>
                    </div>
                </template>
            </Column>

            <Column header="Empresa / Vacante">
                <template #body="{ data }">
                    <div class="cell-stack">
                        <div class="cell-title">{{ data.empresa.nombre }}</div>
                        <div class="cell-sub">{{ data.vacante.nombre }}</div>

                        <!-- BADGE ASIGNACIÓN AUTOMÁTICA -->
                        <Tag v-if="data.asignacion_tipo === 'automatica'" value="Asignado automáticamente" severity="warning" class="auto-badge" />
                    </div>
                </template>
            </Column>

            <Column header="Periodo">
                <template #body="{ data }">
                    {{ data.periodo.nombre }}
                </template>
            </Column>

            <Column header="Estado">
                <template #body="{ data }">
                    <Tag :value="data.alumno.estado" :severity="estadoSeverity(data.alumno.estado)" />
                </template>
            </Column>

            <Column header="Acciones" style="width: 160px">
                <template #body="{ data }">
                    <Button icon="pi pi-eye" text severity="info" v-tooltip.top="'Ver detalle'" @click="verDetalle(data)" />
                </template>
            </Column>
        </DataTable>

        <!-- ========================= -->
        <!-- DIALOG CONFIRMACIÓN -->
        <!-- ========================= -->
        <Dialog v-model:visible="showCerrarDialog" modal header="Cerrar postulaciones" :style="{ width: '420px' }">
            <div class="confirm-content">
                <i class="pi pi-exclamation-triangle warning-icon"></i>

                <p class="confirm-text">Esta acción aceptará a todos los alumnos postulados y asignará automáticamente una empresa a los alumnos que no realizaron postulación.</p>

                <p class="confirm-warning">⚠️ <strong>Esta acción es irreversible.</strong></p>
            </div>

            <template #footer>
                <Button label="Cancelar" icon="pi pi-times" text @click="showCerrarDialog = false" />
                <Button label="Sí, cerrar postulaciones" icon="pi pi-lock" severity="danger" :loading="loading" @click="confirmarCerrarPostulaciones" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
.header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.filters-actions {
    display: flex;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 1.25rem;
}

.filters-grid {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
}

.cerrar-btn {
    white-space: nowrap;
}

.confirm-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
    padding: 1rem 0;
}

.warning-icon {
    font-size: 2.5rem;
    color: var(--red-500);
}

.confirm-text {
    font-size: 0.95rem;
    line-height: 1.4;
}

.confirm-warning {
    color: var(--red-600);
    font-size: 0.9rem;
}

.cell-stack {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.cell-title {
    font-weight: 600;
}

.cell-sub {
    font-size: 0.9rem;
    opacity: 0.75;
}

.auto-badge {
    margin-top: 0.25rem;
    width: fit-content;
    font-size: 0.75rem;
}

@media (max-width: 900px) {
    .filters-actions {
        flex-direction: column;
        align-items: stretch;
    }

    .filters-grid {
        grid-template-columns: 1fr;
    }

    .cerrar-btn {
        width: 100%;
    }
}
</style>
