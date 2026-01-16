<script setup>
import api from '@/api/axios';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// PrimeVue
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import TabPanel from 'primevue/tabpanel';
import TabView from 'primevue/tabview';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

// ==========================
// STATE
// ==========================
const loadingDetalle = ref(false);
const loadingVacantes = ref(false);
const savingReasignar = ref(false);
const savingBaja = ref(false);

const detalle = ref(null); // respuesta de GET /control-academico/alumno/:id
const vacantes = ref([]); // dataset de vacantes (para reasignación)

// 👇 IMPORTANTE (fix): tus endpoints PUT usan :id_historial, no :id_alumno
// Como tu detalle por alumno NO trae id_historial, lo resolvemos con el listado general
const idHistorial = ref(null);

const activeTab = ref(0);

// ==========================
// MODALES
// ==========================
const reasignarDialog = ref(false);
const bajaDialog = ref(false);

// ==========================
// FORMS
// ==========================
const reasignarForm = ref({
    id_nueva_categoria: null,
    motivo: '' // opcional (tu DTO lo soporta)
});

const bajaMotivo = ref('');

// ==========================
// LOADERS
// ==========================
const idAlumno = computed(() => Number(route.params.id));

const loadDetalle = async () => {
    loadingDetalle.value = true;
    try {
        const { data } = await api.get(`/control-academico/alumno/${idAlumno.value}`);
        detalle.value = data ?? null;
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e.response?.data?.message || 'No se pudo cargar el detalle',
            life: 5000
        });
        // si no existe, regreso al listado
        router.push('/admin/control-academico');
    } finally {
        loadingDetalle.value = false;
    }
};

const loadVacantes = async () => {
    loadingVacantes.value = true;
    try {
        const { data } = await api.get('/vacantes');
        vacantes.value = data ?? [];
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e.response?.data?.message || 'No se pudieron cargar vacantes',
            life: 5000
        });
    } finally {
        loadingVacantes.value = false;
    }
};

// 🔥 FIX CLAVE: obtener id_historial (porque los PUT usan /control-academico/:id_historial/*)
const loadIdHistorial = async () => {
    try {
        const { data } = await api.get('/control-academico');
        const row = (data ?? []).find((x) => x?.alumno?.id_alumno === idAlumno.value);
        idHistorial.value = row?.id_historial ?? null;
    } catch (e) {
        // si falla, no truena UI; pero sí bloqueará acciones
        idHistorial.value = null;
    }
};

onMounted(async () => {
    await Promise.all([loadDetalle(), loadVacantes(), loadIdHistorial()]);
});

// Si cambia el :id en ruta, recarga todo
watch(
    () => route.params.id,
    async () => {
        activeTab.value = 0;
        reasignarDialog.value = false;
        bajaDialog.value = false;
        reasignarForm.value = { id_nueva_categoria: null, motivo: '' };
        bajaMotivo.value = '';
        await Promise.all([loadDetalle(), loadVacantes(), loadIdHistorial()]);
    }
);

// ==========================
// COMPUTED (UX)
// ==========================
const alumnoNombre = computed(() => detalle.value?.alumno?.nombre || '-');

const estadoAlumno = computed(() => detalle.value?.alumno?.estado || '-');

const estadoSeverity = computed(() => {
    const e = (detalle.value?.alumno?.estado || '').toLowerCase();
    if (e === 'activo') return 'success';
    if (e === 'baja') return 'danger';
    return 'secondary';
});

const periodoLabel = computed(() => detalle.value?.periodo?.nombre || '-');

const fechaMx = (iso) => {
    if (!iso) return '-';
    try {
        return new Date(iso).toLocaleDateString('es-MX');
    } catch {
        return '-';
    }
};

const progresoEntregables = computed(() => {
    const arr = detalle.value?.entregables ?? [];
    if (!arr.length) return { total: 0, calificados: 0, pendientes: 0 };
    const calificados = arr.filter((x) => x?.calificacion !== null && x?.calificacion !== undefined).length;
    return { total: arr.length, calificados, pendientes: arr.length - calificados };
});

// Vacantes válidas para reasignación:
// - activas
// - cupo_disponible > 0
// - mismo periodo del alumno (recomendado)
// - no la misma vacante actual
const vacantesDisponibles = computed(() => {
    const currentId = detalle.value?.vacante?.id_categoria ?? null;
    const periodoId = detalle.value?.periodo?.id_periodo ?? null;

    return (vacantes.value ?? [])
        .filter((v) => {
            const okActiva = v?.activa === true;
            const okCupo = Number(v?.cupo_disponible ?? 0) > 0;
            const okNoMisma = v?.id_categoria !== currentId;

            // si viene periodo en vacante, filtramos por mismo periodo
            const okPeriodo = periodoId ? v?.periodo?.id_periodo === periodoId : true;

            return okActiva && okCupo && okNoMisma && okPeriodo;
        })
        .sort((a, b) => (a?.empresa?.nombre || '').localeCompare(b?.empresa?.nombre || '') || (a?.nombre || '').localeCompare(b?.nombre || ''));
});

const canAcciones = computed(() => {
    // Bloquea acciones si no pudimos resolver id_historial
    return !!idHistorial.value && estadoAlumno.value !== 'baja';
});

const calificacionSeverity = (c) => {
    if (c === null || c === undefined) return 'secondary';
    const n = Number(c);
    if (Number.isNaN(n)) return 'secondary';
    if (n >= 8) return 'success';
    if (n >= 6) return 'warning';
    return 'danger';
};

const vacanteOptionLabel = (v) => {
    // label tipo: "Empresa — Vacante (cupo_disponible/cupo_total)"
    const emp = v?.empresa?.nombre || 'Empresa';
    const nom = v?.nombre || 'Vacante';
    const cupo = `${v?.cupo_disponible ?? 0}/${v?.cupo_total ?? 0}`;
    return `${emp} — ${nom} (${cupo})`;
};

// ==========================
// ACTIONS (UX)
// ==========================
const goBack = () => router.push('/admin/control-academico');

const openReasignar = () => {
    if (!canAcciones.value) {
        toast.add({
            severity: 'warn',
            summary: 'Acción no disponible',
            detail: 'No se pudo resolver el historial del alumno o el alumno ya está dado de baja.',
            life: 4000
        });
        return;
    }
    reasignarForm.value = { id_nueva_categoria: null, motivo: '' };
    reasignarDialog.value = true;
};

const openBaja = () => {
    if (!canAcciones.value) {
        toast.add({
            severity: 'warn',
            summary: 'Acción no disponible',
            detail: 'No se pudo resolver el historial del alumno o el alumno ya está dado de baja.',
            life: 4000
        });
        return;
    }
    bajaMotivo.value = '';
    bajaDialog.value = true;
};

// ==========================
// API ACTIONS
// ==========================
const reasignarAlumno = async () => {
    if (!idHistorial.value) return;

    if (!reasignarForm.value.id_nueva_categoria) {
        toast.add({
            severity: 'warn',
            summary: 'Campos incompletos',
            detail: 'Selecciona una nueva vacante',
            life: 3000
        });
        return;
    }

    savingReasignar.value = true;
    try {
        await api.put(`/control-academico/${idHistorial.value}/reasignar`, {
            id_nueva_categoria: reasignarForm.value.id_nueva_categoria,
            motivo: reasignarForm.value.motivo || undefined
        });

        toast.add({
            severity: 'success',
            summary: 'Alumno reasignado',
            detail: 'Se actualizó empresa/vacante correctamente.',
            life: 3000
        });

        reasignarDialog.value = false;
        await Promise.all([loadDetalle(), loadVacantes(), loadIdHistorial()]);
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e.response?.data?.message || 'No se pudo reasignar',
            life: 5000
        });
    } finally {
        savingReasignar.value = false;
    }
};

const bajaPracticas = () => {
    if (!idHistorial.value) return;

    confirm.require({
        header: 'Confirmación',
        icon: 'pi pi-exclamation-triangle',
        message: `¿Dar de baja al alumno "${alumnoNombre.value}" de prácticas?`,
        acceptLabel: 'Sí, dar de baja',
        rejectLabel: 'Cancelar',
        accept: async () => {
            savingBaja.value = true;
            try {
                await api.put(`/control-academico/${idHistorial.value}/baja`, {
                    motivo: bajaMotivo.value || undefined
                });

                toast.add({
                    severity: 'success',
                    summary: 'Baja realizada',
                    detail: 'El alumno fue dado de baja de prácticas.',
                    life: 3500
                });

                bajaDialog.value = false;
                // Regresamos al listado para evitar acciones sobre un alumno ya en baja
                router.push('/admin/control-academico');
            } catch (e) {
                toast.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: e.response?.data?.message || 'No se pudo dar de baja',
                    life: 5000
                });
            } finally {
                savingBaja.value = false;
            }
        }
    });
};

// ==========================
// RELOAD
// ==========================
const refreshAll = async () => {
    await Promise.all([loadDetalle(), loadVacantes(), loadIdHistorial()]);
};
</script>

<template>
    <div class="card" v-if="detalle">
        <!-- ===================== -->
        <!-- HEADER -->
        <!-- ===================== -->
        <div class="flex justify-between items-center mb-4">
            <div>
                <h2 class="text-xl font-semibold">Control académico – {{ detalle.alumno.nombre }}</h2>
                <p class="text-sm opacity-70">
                    Matrícula {{ detalle.alumno.matricula }} ·
                    {{ detalle.periodo.nombre }}
                </p>
            </div>

            <Button icon="pi pi-arrow-left" label="Volver" text @click="volver" />
        </div>

        <!-- ===================== -->
        <!-- TABS -->
        <!-- ===================== -->
        <TabView>
            <!-- ===================== -->
            <!-- INFO -->
            <!-- ===================== -->
            <TabPanel header="📘 Información">
                <div class="info-grid">
                    <div class="info-item">
                        <span>Alumno</span>
                        <strong>{{ detalle.alumno.nombre }}</strong>
                    </div>

                    <div class="info-item">
                        <span>Matrícula</span>
                        <strong>{{ detalle.alumno.matricula }}</strong>
                    </div>

                    <div class="info-item">
                        <span>Carrera</span>
                        <strong>{{ detalle.alumno.carrera }}</strong>
                    </div>

                    <div class="info-item">
                        <span>Cuatrimestre</span>
                        <strong>{{ detalle.alumno.cuatrimestre }}</strong>
                    </div>

                    <div class="info-item">
                        <span>Empresa</span>
                        <strong>{{ detalle.empresa.nombre }}</strong>
                    </div>

                    <div class="info-item">
                        <span>Vacante</span>
                        <strong>{{ detalle.vacante.nombre }}</strong>
                    </div>

                    <div class="info-item">
                        <span>Estado académico</span>
                        <Tag :value="detalle.alumno.estado" :severity="detalle.alumno.estado === 'activo' ? 'success' : 'danger'" />
                    </div>
                </div>
            </TabPanel>

            <!-- ===================== -->
            <!-- ENTREGABLES -->
            <!-- ===================== -->
            <TabPanel header="📂 Entregables">
                <div v-if="detalle.entregables.length" class="entregables-list">
                    <div v-for="e in detalle.entregables" :key="e.id_entregable" class="entregable-item">
                        <div class="entregable-info">
                            <strong>{{ e.numero }}. {{ e.nombre }}</strong>
                            <small v-if="e.fecha_limite"> Límite: {{ new Date(e.fecha_limite).toLocaleDateString('es-MX') }} </small>
                        </div>

                        <Tag :value="e.calificacion ?? 'Pendiente'" :severity="calificacionSeverity(e.calificacion)" />
                    </div>
                </div>

                <div v-else class="empty-state">No hay entregables registrados para este periodo.</div>
            </TabPanel>

            <!-- ===================== -->
            <!-- ACCIONES -->
            <!-- ===================== -->
            <TabPanel header="⚙️ Acciones">
                <div class="actions">
                    <Button icon="pi pi-refresh" label="Reasignar empresa" severity="warning" @click="reasignarDialog = true" />

                    <Button icon="pi pi-ban" label="Dar de baja de prácticas" severity="danger" outlined @click="bajaDialog = true" />
                </div>
            </TabPanel>
        </TabView>

        <!-- ===================== -->
        <!-- MODAL REASIGNAR -->
        <!-- ===================== -->
        <Dialog v-model:visible="reasignarDialog" modal header="🔄 Reasignar alumno" :style="{ width: '600px' }" :pt="{ content: { class: 'dialog-content-full' } }">
            <div class="form-field">
                <label>Nueva vacante</label>
                <Dropdown v-model="reasignarForm.id_nueva_categoria" :options="vacantes" optionLabel="nombre" optionValue="id_categoria" placeholder="Selecciona nueva vacante" />
            </div>

            <template #footer>
                <Button text label="Cancelar" @click="reasignarDialog = false" />
                <Button label="Reasignar" severity="success" :disabled="!reasignarForm.id_nueva_categoria" @click="reasignarAlumno" />
            </template>
        </Dialog>

        <!-- ===================== -->
        <!-- MODAL BAJA -->
        <!-- ===================== -->
        <Dialog v-model:visible="bajaDialog" modal header="🚫 Baja de prácticas" :style="{ width: '600px' }" :pt="{ content: { class: 'dialog-content-full' } }">
            <div class="form-field">
                <label>Motivo de baja (opcional)</label>
                <Textarea v-model="bajaMotivo" rows="4" placeholder="Describe el motivo de la baja" />
            </div>

            <template #footer>
                <Button text label="Cancelar" @click="bajaDialog = false" />
                <Button label="Confirmar baja" severity="danger" @click="bajaPracticas" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* =========================
   GRID DE INFORMACIÓN
========================= */
.info-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
}

.info-item {
    background: var(--surface-100);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-size: 0.95rem;
}

.info-item b {
    display: block;
    font-weight: 600;
    margin-bottom: 0.15rem;
    color: var(--text-color);
}

/* =========================
   ENTREGABLES
========================= */
.entregables-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.entregable-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    background: var(--surface-50);
    border: 1px solid var(--surface-border);
}

.entregable-item span {
    font-weight: 500;
}

/* =========================
   ACCIONES
========================= */
.actions {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.actions :deep(.p-button) {
    min-width: 200px;
}

/* =========================
   DIALOGS
========================= */
:deep(.dialog-content-full) {
    padding: 1.5rem;
}

.dialog-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* =========================
   HEADERS / TITLES
========================= */
.page-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 1rem;
}

/* =========================
   RESPONSIVE
========================= */
@media (max-width: 768px) {
    .info-grid {
        grid-template-columns: 1fr;
    }

    .actions {
        flex-direction: column;
    }

    .actions :deep(.p-button) {
        width: 100%;
    }
}
</style>
