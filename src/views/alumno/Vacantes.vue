<script setup>
import api from '@/api/axios';
import { computed, onMounted, ref, watch } from 'vue';

// PrimeVue
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';
import SelectButton from 'primevue/selectbutton';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useToast } from '@/composables/useAppToast';

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
const postulacionesCerradas = ref(false);
const periodoActivo = ref(null);

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
    try {
        const { data } = await api.get(endpoint);
        const lista = Array.isArray(data) ? data : (data?.vacantes ?? []);
        vacantes.value = lista;
        // Si hay período activo pero no retorna vacantes → postulaciones cerradas
        postulacionesCerradas.value = hayPeriodoActivo.value && lista.length === 0;
        if (lista.length > 0) periodoActivo.value = lista[0]?.periodo ?? null;
    } catch {
        vacantes.value = [];
        postulacionesCerradas.value = true;
    }
};

const loadData = async () => {
    loading.value = true;

    try {
        const [postulacionesRes, historialRes] = await Promise.all([api.get('/postulaciones/me'), api.get('/historial/me/detalle')]);

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

const cupoCupoClass = (v) => {
    const d = v.cupo_disponible ?? 0;
    if (d === 0) return 'vac-full';
    if (d === 1) return 'vac-last';
    if (d <= 2)  return 'vac-few';
    return 'vac-ok';
};

const cupoLabelAlumno = (v) => {
    const d = v.cupo_disponible ?? 0;
    if (d === 0) return 'Sin lugares';
    if (d === 1) return 'Último lugar';
    if (d <= 2)  return `${d} lugares — quedan pocos`;
    return `${d} lugares disponibles`;
};

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
    <div class="vacantes-page">
        <Toast />

        <!-- ════════════════════════════════
             HEADER
        ════════════════════════════════ -->
        <div class="vac-header">
            <h2 class="vac-title">Vacantes disponibles</h2>
            <p class="vac-subtitle">Postúlate a una vacante para realizar tus prácticas profesionales.</p>
        </div>

        <!-- ════════════════════════════════
             LOADING
        ════════════════════════════════ -->
        <div v-if="loading" class="loading-wrap">
            <ProgressSpinner style="width: 48px; height: 48px" />
            <span class="loading-text">Cargando vacantes…</span>
        </div>

        <!-- ════════════════════════════════
             CONTENIDO PRINCIPAL
        ════════════════════════════════ -->
        <template v-else>

            <!-- ── BANNERS DE ESTADO (lógica intacta) ───── -->

            <div v-if="estadoActual === 'INACTIVO'" class="status-banner banner-danger">
                <div class="banner-icon-wrap icon-danger"><i class="pi pi-ban"></i></div>
                <div>
                    <p class="banner-title">Alumno inactivo</p>
                    <p class="banner-desc">No puedes visualizar ni postularte a vacantes. Contacta a tu coordinador.</p>
                </div>
            </div>

            <div v-else-if="estadoActual === 'SIN_PERIODO'" class="status-banner banner-info">
                <div class="banner-icon-wrap icon-info"><i class="pi pi-calendar-times"></i></div>
                <div>
                    <p class="banner-title">Sin periodo activo</p>
                    <p class="banner-desc">No hay un periodo de prácticas abierto. Estarás disponible cuando se abra el siguiente.</p>
                </div>
            </div>

            <div v-else-if="estadoActual === 'ACEPTADO'" class="status-banner banner-success">
                <div class="banner-icon-wrap icon-success"><i class="pi pi-check-circle"></i></div>
                <div class="banner-body">
                    <p class="banner-title">¡Postulación aceptada!</p>
                    <p class="banner-desc">Has sido aceptado en una vacante. Aquí están los datos de tu empresa.</p>
                    <div class="accepted-grid">
                        <div class="accepted-field">
                            <span class="accepted-label">Vacante</span>
                            <span class="accepted-value">{{ postulacionVigente?.categoria?.nombre }}</span>
                        </div>
                        <div class="accepted-field">
                            <span class="accepted-label">Empresa</span>
                            <span class="accepted-value">{{ postulacionVigente?.categoria?.empresa?.nombre }}</span>
                        </div>
                        <div class="accepted-field">
                            <span class="accepted-label">Correo de contacto</span>
                            <span class="accepted-value">{{ contactoPrincipal?.correo || 'No disponible' }}</span>
                        </div>
                        <div class="accepted-field">
                            <span class="accepted-label">Teléfono</span>
                            <span class="accepted-value">{{ contactoPrincipal?.telefono || 'No disponible' }}</span>
                        </div>
                    </div>
                    <Button label="Descargar carta de presentación" icon="pi pi-download" severity="success" @click="descargarCarta" />
                </div>
            </div>

            <div v-else-if="estadoActual === 'POSTULADO'" class="status-banner banner-warning">
                <div class="banner-icon-wrap icon-warning"><i class="pi pi-clock"></i></div>
                <div>
                    <p class="banner-title">Postulación en revisión</p>
                    <p class="banner-desc">Tu postulación está siendo evaluada. No podrás aplicar a otras vacantes hasta que se resuelva.</p>
                </div>
            </div>

            <div v-else-if="estadoActual === 'RECHAZADO'" class="status-banner banner-danger">
                <div class="banner-icon-wrap icon-danger"><i class="pi pi-times-circle"></i></div>
                <div>
                    <p class="banner-title">Postulación rechazada</p>
                    <p class="banner-desc">
                        Motivo: <strong>{{ postulacionVigente?.motivo || 'No especificado' }}</strong>.
                        Puedes postularte a otra vacante.
                    </p>
                </div>
            </div>

            <!-- ── POSTULACIONES CERRADAS ─────────────── -->
            <div v-if="puedeVerVacantes && postulacionesCerradas" class="status-banner banner-warning">
                <div class="banner-icon-wrap icon-warning"><i class="pi pi-lock"></i></div>
                <div>
                    <p class="banner-title">Período de postulaciones cerrado</p>
                    <p class="banner-desc">El período de postulaciones ha concluido. Ya no es posible aplicar a vacantes en este momento.</p>
                </div>
            </div>

            <!-- ── WORKSPACE DE VACANTES ─────────────── -->
            <div v-if="puedeVerVacantes && !postulacionesCerradas" class="vac-workspace">

                <!-- Período activo label -->
                <div v-if="periodoActivo" class="periodo-label">
                    <i class="pi pi-calendar"></i>
                    Período: <strong>{{ periodoActivo.nombre }}</strong>
                </div>

                <!-- Barra de búsqueda + filtro — sticky bajo el topbar -->
                <div class="vac-toolbar">
                    <IconField class="search-field">
                        <InputIcon class="pi pi-search" />
                        <InputText
                            v-model="busqueda"
                            placeholder="Buscar por puesto o empresa…"
                            class="w-full"
                        />
                    </IconField>

                    <div class="filter-pills">
                        <button
                            v-for="op in opcionesModo"
                            :key="op.value"
                            :class="['pill-btn', { 'pill-active': modoFiltro === op.value }]"
                            @click="modoFiltro = op.value"
                        >
                            {{ op.label }}
                        </button>
                    </div>
                </div>

                <!-- Contador de resultados -->
                <p class="results-count">
                    <template v-if="vacantesFiltradas.length > 0">
                        <strong>{{ vacantesFiltradas.length }}</strong> vacante{{ vacantesFiltradas.length !== 1 ? 's' : '' }} encontrada{{ vacantesFiltradas.length !== 1 ? 's' : '' }}
                    </template>
                </p>

                <!-- Sin resultados -->
                <div v-if="vacantesFiltradas.length === 0" class="empty-state">
                    <i class="pi pi-inbox empty-icon"></i>
                    <p class="empty-title">Sin vacantes disponibles</p>
                    <p class="empty-desc">
                        {{ busqueda ? 'No encontramos coincidencias. Intenta con otro término.' : 'No hay vacantes en este momento. Vuelve pronto.' }}
                    </p>
                    <Button v-if="busqueda" label="Limpiar búsqueda" icon="pi pi-times" text @click="busqueda = ''" />
                </div>

                <!-- ── CUERPO: lista + detalle ─────── -->
                <div v-else class="vac-body">

                    <!-- PANEL IZQUIERDO — lista scrolleable -->
                    <div class="vac-left">
                        <div
                            v-for="v in vacantesFiltradas"
                            :key="v.id_categoria"
                            class="vac-card"
                            :class="[
                                { 'vac-card-active': vacanteSeleccionada?.id_categoria === v.id_categoria },
                                cupoCupoClass(v)
                            ]"
                            @click="v.cupo_disponible > 0 && (vacanteSeleccionada = v)"
                            role="button"
                            :tabindex="v.cupo_disponible > 0 ? 0 : -1"
                            @keyup.enter="v.cupo_disponible > 0 && (vacanteSeleccionada = v)"
                        >
                            <!-- Cabecera de card: logo + badge -->
                            <div class="vac-card-top">
                                <div class="vac-card-logo">
                                    <i class="pi pi-briefcase"></i>
                                </div>
                                <span class="cupo-pill" :class="`cupo-pill--${cupoCupoClass(v)}`">
                                    <i :class="(v.cupo_disponible ?? 0) === 0 ? 'pi pi-ban' : (v.cupo_disponible ?? 0) === 1 ? 'pi pi-exclamation-circle' : 'pi pi-users'" />
                                    {{ cupoLabelAlumno(v) }}
                                </span>
                            </div>

                            <!-- Título y empresa -->
                            <h3 class="vac-card-title">{{ v.nombre }}</h3>
                            <p class="vac-card-company">
                                <i class="pi pi-building"></i>
                                {{ v.empresa?.nombre }}
                            </p>

                            <!-- Descripción — truncada en desktop, completa en móvil -->
                            <p class="vac-card-desc">{{ v.descripcion || 'Sin descripción disponible.' }}</p>

                            <!-- Modalidad + remuneración -->
                            <div class="vac-meta-badges">
                                <span class="vac-meta-badge" :class="`vac-meta-badge--${v.modalidad ?? 'presencial'}`">
                                    <i :class="`pi ${v.modalidad === 'remoto' ? 'pi-home' : v.modalidad === 'hibrido' ? 'pi-sync' : 'pi-building'}`" />
                                    {{ v.modalidad === 'remoto' ? 'Remoto' : v.modalidad === 'hibrido' ? 'Híbrido' : 'Presencial' }}
                                </span>
                                <span v-if="v.tiene_remuneracion" class="vac-meta-badge vac-meta-badge--rem">
                                    <i class="pi pi-dollar" />
                                    {{ v.monto_remuneracion != null
                                        ? v.monto_remuneracion.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
                                        : 'Remunerada' }}
                                </span>
                            </div>

                            <!-- Botón de postulación — solo visible en móvil -->
                            <div class="vac-card-mobile-footer">
                                <div class="mobile-footer-divider"></div>
                                <Button
                                    :label="v.cupo_disponible > 0 ? 'Postularme' : 'Sin cupos'"
                                    icon="pi pi-send"
                                    iconPos="right"
                                    class="mobile-apply-btn"
                                    :disabled="v.cupo_disponible <= 0"
                                    @click.stop="confirmarPostulacion(v)"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- PANEL DERECHO — detalle (solo desktop) -->
                    <div class="vac-right">
                        <!-- Placeholder cuando ninguna vacante está seleccionada -->
                        <div v-if="!vacanteSeleccionada" class="detail-placeholder">
                            <div class="placeholder-icon-wrap">
                                <i class="pi pi-file-check"></i>
                            </div>
                            <p class="placeholder-title">Selecciona una vacante</p>
                            <p class="placeholder-desc">Haz clic en cualquier oferta de la lista para ver los detalles completos y postularte.</p>
                        </div>

                        <!-- Detalle de la vacante seleccionada -->
                        <div v-else class="detail-panel">
                            <!-- Logo empresa -->
                            <div class="detail-logo-wrap">
                                <div class="detail-logo">
                                    <i class="pi pi-briefcase"></i>
                                </div>
                            </div>

                            <!-- Título + badge -->
                            <div class="detail-title-row">
                                <h2 class="detail-title">{{ vacanteSeleccionada.nombre }}</h2>
                                <span class="cupo-pill" :class="`cupo-pill--${cupoCupoClass(vacanteSeleccionada)}`">
                                    <i :class="(vacanteSeleccionada.cupo_disponible ?? 0) === 0 ? 'pi pi-ban' : (vacanteSeleccionada.cupo_disponible ?? 0) === 1 ? 'pi pi-exclamation-circle' : 'pi pi-users'" />
                                    {{ cupoLabelAlumno(vacanteSeleccionada) }}
                                    <span class="cupo-detail-fraction">({{ vacanteSeleccionada.cupo_disponible ?? 0 }}/{{ vacanteSeleccionada.cupo_total }})</span>
                                </span>
                            </div>

                            <!-- Empresa -->
                            <p class="detail-company">
                                <i class="pi pi-building"></i>
                                {{ vacanteSeleccionada.empresa?.nombre }}
                            </p>

                            <!-- Botón de postulación -->
                            <Button
                                :label="vacanteSeleccionada.cupo_disponible > 0 ? 'Postularme a esta vacante' : 'Sin cupos disponibles'"
                                icon="pi pi-send"
                                iconPos="right"
                                class="apply-btn"
                                :disabled="vacanteSeleccionada.cupo_disponible <= 0"
                                @click="confirmarPostulacion(vacanteSeleccionada)"
                            />

                            <div class="detail-divider"></div>

                            <!-- Descripción -->
                            <p class="detail-section-label">Descripción del puesto</p>
                            <p class="detail-desc">{{ vacanteSeleccionada.descripcion || 'Sin descripción disponible.' }}</p>
                        </div>
                    </div>

                </div>
            </div>

        </template>

        <!-- ════════════════════════════════
             DIALOG DE CONFIRMACIÓN
        ════════════════════════════════ -->
        <Dialog v-model:visible="mostrarConfirmacion" modal header="Confirmar postulación" :style="{ width: '420px' }">
            <div class="confirm-body">
                <i class="pi pi-exclamation-triangle confirm-icon"></i>
                <p>Al enviar tu postulación <strong>no podrás aplicar a otras vacantes</strong> hasta que se resuelva esta solicitud. ¿Deseas continuar?</p>
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="mostrarConfirmacion = false" />
                <Button label="Sí, postularme" severity="primary" icon="pi pi-check" @click="postularme" />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* ════════════════════════════════════════
   CONSTANTES DE LAYOUT
   Topbar fijo = 4rem  |  Toolbar = ~3.25rem
════════════════════════════════════════ */
.vacantes-page {
    --topbar-h:  4rem;
    --toolbar-h: 3.25rem;
    --panel-top: calc(var(--topbar-h) + var(--toolbar-h) + 0.75rem);
    --panel-max: calc(100vh - var(--panel-top) - 1rem);

    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* ════════════════════════════════════════
   HEADER
════════════════════════════════════════ */
.vac-header { margin-bottom: 0.25rem; }

.vac-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 0.25rem;
}

.vac-subtitle {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
    margin: 0;
}

/* ════════════════════════════════════════
   LOADING
════════════════════════════════════════ */
.loading-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 4rem 0;
}

.loading-text {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
}

/* ════════════════════════════════════════
   BANNERS DE ESTADO
════════════════════════════════════════ */
.status-banner {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.125rem 1.25rem;
    border-radius: 12px;
    border: 1px solid;
}

.banner-danger  { background: var(--sisa-banner-danger-bg);  border-color: var(--sisa-banner-danger-bd);  }
.banner-info    { background: var(--sisa-banner-info-bg);    border-color: var(--sisa-banner-info-bd);    }
.banner-success { background: var(--sisa-banner-success-bg); border-color: var(--sisa-banner-success-bd); }
.banner-warning { background: var(--sisa-banner-warn-bg);    border-color: var(--sisa-banner-warn-bd);    }

.banner-icon-wrap {
    flex-shrink: 0;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
}

.icon-danger  { background: var(--sisa-tint-red);   color: var(--sisa-icon-red);   }
.icon-info    { background: var(--sisa-tint-blue);  color: var(--sisa-icon-blue);  }
.icon-success { background: var(--sisa-tint-green); color: var(--sisa-icon-green); }
.icon-warning { background: var(--sisa-tint-amber); color: var(--sisa-icon-amber); }

.banner-body { flex: 1; }

.banner-title {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--text-color);
    margin: 0 0 0.25rem;
}

.banner-desc {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
    margin: 0;
    line-height: 1.5;
}

.accepted-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin: 1rem 0;
    padding: 1rem;
    background: var(--surface-card);
    border-radius: 8px;
    border: 1px solid var(--sisa-banner-success-bd);
}

.accepted-field { display: flex; flex-direction: column; gap: 2px; }

.accepted-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-color-secondary);
}

.accepted-value {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-color);
}

/* ════════════════════════════════════════
   WORKSPACE
════════════════════════════════════════ */
.vac-workspace {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

/* ── Período label ───────────────── */
.periodo-label {
    display: flex;
    align-items: center;
    gap: .5rem;
    font-size: .8rem;
    color: var(--text-color-secondary);
    padding: .4rem .75rem;
    background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue);
    border-radius: .5rem;
    font-weight: 500;
    width: fit-content;
}
.periodo-label .pi { font-size: .8rem; }

/* ── Toolbar sticky ──────────────── */
.vac-toolbar {
    position: sticky;
    top: var(--topbar-h);
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0;
    background: var(--surface-ground);
    border-bottom: 1px solid var(--sisa-border);
}

.search-field {
    flex: 1;
}

:deep(.vac-toolbar .p-inputtext) {
    height: 2.5rem;
    border-radius: 8px;
    font-size: 0.9rem;
}

/* Filter pills */
.filter-pills {
    display: flex;
    gap: 0.375rem;
    flex-shrink: 0;
}

.pill-btn {
    padding: 0.375rem 1rem;
    border-radius: 99px;
    border: 1px solid var(--sisa-border);
    background: var(--surface-card);
    color: var(--text-color-secondary);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
}

.pill-btn:hover {
    border-color: var(--sisa-primary-l);
    color: var(--sisa-primary-l);
}

.pill-active {
    background: var(--sisa-primary-l);
    border-color: var(--sisa-primary-l);
    color: #fff;
    font-weight: 600;
}

/* Contador */
.results-count {
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    margin: 0;
}

/* ── Empty state ──────────────────── */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 4rem 1rem;
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 12px;
}

.empty-icon {
    font-size: 3rem;
    color: var(--sisa-border);
    margin-bottom: 1rem;
}

.empty-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 0.375rem;
}

.empty-desc {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
    margin: 0 0 1.25rem;
    max-width: 320px;
    line-height: 1.5;
}

/* ════════════════════════════════════════
   CUERPO: LISTA + DETALLE (desktop)
════════════════════════════════════════ */
.vac-body {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 1.25rem;
    align-items: start;
}

/* ── Panel izquierdo ─────────────── */
.vac-left {
    position: sticky;
    top: var(--panel-top);
    max-height: var(--panel-max);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    /* scrollbar sutil */
    scrollbar-width: thin;
    scrollbar-color: var(--sisa-border) transparent;
}

/* ── CARD DE VACANTE ─────────────── */
.vac-card {
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-left: 3px solid transparent;
    border-radius: 10px;
    padding: 1rem 1.125rem;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    outline: none;
}

.vac-card:hover {
    border-left-color: var(--sisa-primary-l);
    box-shadow: 0 2px 10px rgba(21, 101, 192, 0.1);
}

.vac-card:focus-visible {
    box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.25);
}

/* Availability color coding */
.vac-card.vac-ok   { border-left-color: #16a34a; }
.vac-card.vac-few  { border-left-color: #d97706; }
.vac-card.vac-last { border-left-color: #dc2626; }
.vac-card.vac-full {
    border-left-color: #9ca3af;
    opacity: 0.55;
    cursor: not-allowed;
    pointer-events: none;
}

.vac-card-active {
    border-left-color: var(--sisa-primary-l);
    background: var(--sisa-accent-surface);
    box-shadow: 0 2px 10px rgba(21, 101, 192, 0.12);
}

/* Cupo pill */
.cupo-pill {
    display: inline-flex; align-items: center; gap: .3rem;
    font-size: .72rem; font-weight: 600; padding: .2rem .55rem;
    border-radius: 999px;
}
.cupo-pill--vac-ok   { background: rgba(22,163,74,.12);  color: #16a34a; }
.cupo-pill--vac-few  { background: rgba(217,119,6,.12);  color: #d97706; }
.cupo-pill--vac-last { background: rgba(220,38,38,.12);  color: #dc2626; }
.cupo-pill--vac-full { background: rgba(156,163,175,.15); color: #6b7280; }

/* Cabecera de la card */
.vac-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.625rem;
}

.vac-card-logo {
    width: 2.25rem;
    height: 2.25rem;
    background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
}

.vac-card-active .vac-card-logo {
    background: var(--sisa-primary-l);
    color: #fff;
}

.cupos-tag { font-size: 0.72rem; }
.cupo-detail-fraction { font-weight: 400; opacity: 0.75; margin-left: .1rem; }

/* Título */
.vac-card-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 0.25rem;
    line-height: 1.3;
}

/* Empresa */
.vac-card-company {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    margin: 0 0 0.625rem;
}

/* Descripción — truncada en desktop */
.vac-card-desc {
    font-size: 0.825rem;
    color: var(--text-color-secondary);
    line-height: 1.5;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* Modalidad + remuneración badges */
.vac-meta-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-top: 0.5rem;
}

.vac-meta-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
}

.vac-meta-badge--presencial {
    background: var(--sisa-tint-blue, #e8f1fb);
    color: var(--sisa-icon-blue, #1c6aac);
}

.vac-meta-badge--remoto {
    background: var(--sisa-tint-purple, #f0eafa);
    color: var(--sisa-icon-purple, #7c3aed);
}

.vac-meta-badge--hibrido {
    background: var(--sisa-tint-amber, #fff8e1);
    color: var(--sisa-icon-amber, #b45309);
}

.vac-meta-badge--rem {
    background: var(--sisa-tint-green, #e6f4ea);
    color: var(--sisa-icon-green, #15803d);
}

/* Botón móvil — oculto en desktop */
.vac-card-mobile-footer {
    display: none;
}

.mobile-footer-divider {
    height: 1px;
    background: var(--sisa-border);
    margin: 0.875rem 0 0.875rem;
}

.mobile-apply-btn {
    width: 100%;
    justify-content: center;
    border-radius: 8px;
    font-weight: 600;
    background: linear-gradient(135deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    border-color: transparent;
}

/* ── Panel derecho — detalle ─────── */
.vac-right {
    position: sticky;
    top: var(--panel-top);
    max-height: var(--panel-max);
    overflow-y: auto;
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--sisa-border) transparent;
}

/* Placeholder */
.detail-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3rem 2rem;
    min-height: 260px;
}

.placeholder-icon-wrap {
    width: 3.5rem;
    height: 3.5rem;
    background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    margin-bottom: 1rem;
    opacity: 0.6;
}

.placeholder-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 0.375rem;
    opacity: 0.7;
}

.placeholder-desc {
    font-size: 0.825rem;
    color: var(--text-color-secondary);
    margin: 0;
    max-width: 240px;
    line-height: 1.5;
}

/* Contenido del detalle */
.detail-panel {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
}

.detail-logo-wrap { display: flex; }

.detail-logo {
    width: 3rem;
    height: 3rem;
    background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
}

.detail-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
}

.detail-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0;
    line-height: 1.3;
}

.detail-company {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: var(--text-color-secondary);
    margin: 0;
}

.apply-btn {
    border-radius: 8px;
    font-weight: 600;
    background: linear-gradient(135deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    border-color: transparent;
    box-shadow: 0 3px 12px rgba(15, 60, 97, 0.3);
    justify-content: center;
    transition: opacity 0.2s, transform 0.15s;
}

.apply-btn:hover:not(:disabled) {
    opacity: 0.88;
    transform: translateY(-1px);
}

.detail-divider {
    height: 1px;
    background: var(--sisa-border);
    margin: 0.25rem 0;
}

.detail-section-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-color-secondary);
    margin: 0;
}

.detail-desc {
    font-size: 0.9rem;
    color: var(--text-color);
    line-height: 1.65;
    margin: 0;
}

/* ════════════════════════════════════════
   DIALOG
════════════════════════════════════════ */
.confirm-body {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 0.5rem 0;
}

.confirm-icon {
    font-size: 1.5rem;
    color: var(--sisa-icon-amber);
    flex-shrink: 0;
    margin-top: 2px;
}

/* ════════════════════════════════════════
   RESPONSIVE — TABLET (< 900px)
   Desaparece el panel de detalle, las cards
   muestran descripción completa + botón
════════════════════════════════════════ */
@media (max-width: 900px) {
    .vac-body {
        grid-template-columns: 1fr;
    }

    /* Panel derecho oculto */
    .vac-right {
        display: none;
    }

    /* Izquierdo: deja de ser sticky, scroll libre */
    .vac-left {
        position: static;
        max-height: none;
        overflow-y: visible;
    }

    /* Cards: descripción completa */
    .vac-card-desc {
        -webkit-line-clamp: unset;
        display: block;
        overflow: visible;
    }

    /* Botón de postulación visible */
    .vac-card-mobile-footer {
        display: block;
    }

    /* Click en card no selecciona en detalle (ya no hay panel), solo el botón aplica */
    .vac-card {
        cursor: default;
        border-left-color: transparent !important;
        box-shadow: none !important;
        background: var(--surface-card) !important;
    }

    .vac-card:hover {
        border-color: var(--sisa-primary-l);
        border-left-color: var(--sisa-primary-l) !important;
        box-shadow: 0 2px 8px rgba(21, 101, 192, 0.08) !important;
    }
}

@media (max-width: 600px) {
    .vac-toolbar {
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .search-field {
        flex: 1 1 100%;
    }

    .filter-pills {
        width: 100%;
    }

    .pill-btn {
        flex: 1;
        text-align: center;
    }

    .accepted-grid {
        grid-template-columns: 1fr;
    }
}
</style>
