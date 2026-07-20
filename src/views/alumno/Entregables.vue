<script setup>
import api from '@/api/axios';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// PrimeVue
import Button from 'primevue/button';
import ConfirmDialog from 'primevue/confirmdialog';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
import Toast from 'primevue/toast';
import { useConfirm } from 'primevue/useconfirm';

const toast   = useToast();
const confirm = useConfirm();
const route   = useRoute();
const router  = useRouter();

// =====================
// STATE
// =====================
const entregables       = ref([]);
const loading           = ref(false);
const highlightId       = ref(null); // id del entregable resaltado desde calendar

const showDialog         = ref(false);
const selectedEntregable = ref(null);
const archivoUrl         = ref('');
const submitting         = ref(false);

// =====================
// LOAD (sin cambios)
// =====================
const loadEntregables = async () => {
    loading.value = true;
    try {
        const { data } = await api.get('/entregables/me');
        entregables.value = data ?? [];
    } catch {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar los entregables'
        });
    } finally {
        loading.value = false;
    }
};

onMounted(async () => {
    await loadEntregables();

    // Soporte para ?highlight=id (redirigido desde el calendario)
    const hid = route.query.highlight ? Number(route.query.highlight) : null;
    if (hid) {
        highlightId.value = hid;
        const target = entregables.value.find(e => e.id_entregable === hid);
        if (target) {
            if (canUpload(target)) {
                // Abrir diálogo de entrega automáticamente
                await nextTick();
                abrirDialogo(target);
            }
            // Scroll a la card resaltada
            await nextTick();
            const el = document.getElementById(`ent-card-${hid}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        // Limpiar la query sin recargar
        router.replace({ query: {} });
        // Quitar el highlight después de 3s
        setTimeout(() => { highlightId.value = null; }, 3000);
    }
});

// =====================
// HELPERS
// =====================
const isExpired = (fecha) => {
    if (!fecha) return false;
    return new Date(fecha) < new Date();
};

// INC-09: bloquear entrega antes de fecha_inicio
const isNotStarted = (row) => {
    if (!row.fecha_inicio) return false;
    return new Date(row.fecha_inicio) > new Date();
};

// INC-10: validar URL
const isValidUrl = (url) => {
    try {
        const u = new URL(url.trim());
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

const canUpload = (row) => {
    if (row.estado === 'evaluado') return false;
    if (isExpired(row.fecha_limite)) return false;
    if (isNotStarted(row)) return false;
    return true; // INC-11: permite re-entrega si 'entregado' pero plazo vigente
};

const estadoLabel = (row) => {
    if (isNotStarted(row)) return 'Próximo';
    if (isExpired(row.fecha_limite)) return 'Expirado';
    return row.estado;
};

const estadoSeverity = (row) => {
    if (isExpired(row.fecha_limite)) return 'danger';
    if (row.estado === 'evaluado') return 'success';
    if (row.estado === 'entregado') return 'info';
    return 'warning';
};

// =====================
// ACTIONS (sin cambios)
// =====================
const abrirDialogo = (row) => {
    selectedEntregable.value = row;
    archivoUrl.value = row.archivo_url ?? '';
    showDialog.value = true;
};

const confirmarEnvio = () => {
    if (!archivoUrl.value?.trim()) {
        toast.add({ severity: 'warn', summary: 'Validación', detail: 'Debes ingresar un enlace', life: 3000 });
        return;
    }
    // INC-10: validar formato URL
    if (!isValidUrl(archivoUrl.value)) {
        toast.add({ severity: 'warn', summary: 'URL inválida', detail: 'El enlace debe comenzar con https:// o http://', life: 4000 });
        return;
    }

    // INC-11: mensaje diferente si es modificación
    const esEdicion = selectedEntregable.value?.estado === 'entregado';
    confirm.require({
        message: esEdicion
            ? '¿Deseas reemplazar tu entrega anterior con este nuevo enlace?'
            : '¿Estás seguro de enviar este enlace?',
        header: esEdicion ? 'Modificar entrega' : 'Confirmar entrega',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: esEdicion ? 'Sí, reemplazar' : 'Sí, enviar',
        rejectLabel: 'Cancelar',
        accept: enviarEntrega
    });
};

const enviarEntrega = async () => {
    submitting.value = true;
    try {
        await api.post(`/entregables/entregar/${selectedEntregable.value.id_entregable}`, { archivo_url: archivoUrl.value });

        toast.add({
            severity: 'success',
            summary: 'Entrega enviada correctamente'
        });

        showDialog.value = false;
        loadEntregables();
    } catch (e) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: e.response?.data?.message || 'No se pudo enviar la entrega'
        });
    } finally {
        submitting.value = false;
    }
};

// =====================
// HELPERS DE DISPLAY
// (solo visualización, no afectan lógica)
// =====================

/** Formatea fecha ISO a "22 de abril, 2026" */
const formatDate = (fechaStr) => {
    if (!fechaStr) return '—';
    return new Date(fechaStr).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};

/** Días restantes hasta la fecha límite */
const daysLeft = (fechaStr) => {
    if (!fechaStr) return null;
    const diff = new Date(fechaStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

/** Clase de urgencia según días restantes */
const urgencyClass = (row) => {
    if (isNotStarted(row)) return 'urgency-upcoming';
    if (isExpired(row.fecha_limite)) return 'urgency-expired';
    if (row.estado === 'evaluado') return '';
    const days = daysLeft(row.fecha_limite);
    if (days <= 3) return 'urgency-critical';
    if (days <= 7) return 'urgency-warning';
    return '';
};

/** Texto de urgencia según días restantes */
const urgencyText = (row) => {
    if (isNotStarted(row)) {
        const d = Math.ceil((new Date(row.fecha_inicio) - new Date()) / (1000 * 60 * 60 * 24));
        if (d <= 0) return 'Disponible hoy';
        if (d === 1) return 'Disponible mañana';
        return `Disponible en ${d} días`;
    }
    if (isExpired(row.fecha_limite)) return 'Expirado';
    if (row.estado === 'evaluado') return null;
    const days = daysLeft(row.fecha_limite);
    if (days === 0) return '¡Vence hoy!';
    if (days === 1) return 'Vence mañana';
    if (days <= 7) return `${days} días restantes`;
    return null;
};

/** Resumen de progreso */
const progreso = computed(() => {
    const total = entregables.value.length;
    const completados = entregables.value.filter(
        (e) => e.estado === 'evaluado' || e.estado === 'entregado'
    ).length;
    const evaluados = entregables.value.filter((e) => e.estado === 'evaluado').length;
    const pct = total ? Math.round((completados / total) * 100) : 0;
    return { total, completados, evaluados, pct };
});
</script>

<template>
    <div class="entregables-page">
        <Toast />
        <ConfirmDialog />

        <!-- ════════════════════════════════
             HEADER
        ════════════════════════════════ -->
        <div class="ent-header">
            <div>
                <h2 class="ent-title">Mis Entregables</h2>
                <p class="ent-subtitle">Sube tus documentos antes de la fecha límite para completar tu evaluación.</p>
            </div>
        </div>

        <!-- ════════════════════════════════
             LOADING
        ════════════════════════════════ -->
        <div v-if="loading" class="loading-wrap">
            <i class="pi pi-spin pi-spinner loading-icon"></i>
            <span class="loading-text">Cargando entregables…</span>
        </div>

        <template v-else>
            <!-- ════════════════════════════════
                 BARRA DE PROGRESO GENERAL
            ════════════════════════════════ -->
            <div v-if="progreso.total > 0" class="progress-card">
                <div class="progress-info">
                    <div class="progress-main">
                        <span class="progress-fraction">
                            <strong>{{ progreso.completados }}</strong> de {{ progreso.total }}
                        </span>
                        <span class="progress-label">entregables completados</span>
                    </div>
                    <div class="progress-chips">
                        <span class="chip chip-green">
                            <i class="pi pi-check-circle"></i> {{ progreso.evaluados }} evaluados
                        </span>
                        <span class="chip chip-blue">
                            <i class="pi pi-send"></i> {{ progreso.completados - progreso.evaluados }} enviados
                        </span>
                        <span class="chip chip-gray">
                            <i class="pi pi-clock"></i> {{ progreso.total - progreso.completados }} pendientes
                        </span>
                    </div>
                </div>
                <ProgressBar
                    :value="progreso.pct"
                    class="ent-progress-bar"
                    :showValue="false"
                />
                <span class="progress-pct">{{ progreso.pct }}% completado</span>
            </div>

            <!-- ════════════════════════════════
                 SIN ENTREGABLES
            ════════════════════════════════ -->
            <div v-if="entregables.length === 0" class="empty-state">
                <div class="empty-icon-wrap">
                    <i class="pi pi-inbox"></i>
                </div>
                <p class="empty-title">Sin entregables asignados</p>
                <p class="empty-desc">No tienes entregables registrados para este periodo. Contacta a tu coordinador si crees que esto es un error.</p>
            </div>

            <!-- ════════════════════════════════
                 GRID DE ENTREGABLES
            ════════════════════════════════ -->
            <div v-else class="ent-grid">
                <div
                    v-for="ent in entregables"
                    :key="ent.id_entregable"
                    :id="`ent-card-${ent.id_entregable}`"
                    class="ent-card"
                    :class="[urgencyClass(ent), { 'ent-card--highlight': highlightId === ent.id_entregable }]"
                >
                    <!-- Cabecera: estado + urgencia -->
                    <div class="ent-card-top">
                        <Tag
                            :value="estadoLabel(ent)"
                            :severity="estadoSeverity(ent)"
                            class="estado-tag"
                        />
                        <span
                            v-if="urgencyText(ent)"
                            class="urgency-badge"
                            :class="urgencyClass(ent)"
                        >
                            <i class="pi pi-clock"></i>
                            {{ urgencyText(ent) }}
                        </span>
                    </div>

                    <!-- Nombre -->
                    <h3 class="ent-card-name">{{ ent.nombre }}</h3>

                    <!-- INC-06/08: Descripción del entregable -->
                    <p v-if="ent.descripcion" class="ent-card-desc">{{ ent.descripcion }}</p>

                    <!-- Fechas -->
                    <div class="ent-meta">
                        <span v-if="ent.fecha_inicio" class="meta-item">
                            <i class="pi pi-calendar-plus meta-icon"></i>
                            <span>Inicio: <strong>{{ formatDate(ent.fecha_inicio) }}</strong></span>
                        </span>
                        <span class="meta-item">
                            <i class="pi pi-calendar meta-icon"></i>
                            <span>Fecha límite: <strong>{{ formatDate(ent.fecha_limite) }}</strong></span>
                        </span>
                    </div>

                    <!-- Calificación y observaciones (si evaluado) -->
                    <div v-if="ent.calificacion !== null && ent.calificacion !== undefined" class="ent-grade">
                        <div class="grade-score">
                            <span class="grade-num">{{ ent.calificacion }}</span>
                            <span class="grade-label">/ 10</span>
                        </div>
                        <p v-if="ent.observaciones" class="grade-obs">
                            <i class="pi pi-comment obs-icon"></i>
                            {{ ent.observaciones }}
                        </p>
                    </div>

                    <!-- Archivo entregado (si existe) -->
                    <a
                        v-if="ent.archivo_url"
                        :href="ent.archivo_url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="file-link"
                    >
                        <i class="pi pi-external-link"></i>
                        Ver archivo entregado
                    </a>

                    <!-- Acciones -->
                    <div class="ent-card-footer">
                        <!-- INC-11: puede subir o MODIFICAR si plazo vigente -->
                        <Button
                            v-if="canUpload(ent) && ent.estado === 'entregado'"
                            label="Modificar entrega"
                            icon="pi pi-pencil"
                            severity="info"
                            class="upload-btn"
                            @click="abrirDialogo(ent)"
                        />
                        <Button
                            v-else-if="canUpload(ent)"
                            label="Subir entregable"
                            icon="pi pi-upload"
                            class="upload-btn"
                            @click="abrirDialogo(ent)"
                        />
                        <Button
                            v-else-if="ent.estado === 'evaluado'"
                            label="Evaluado"
                            icon="pi pi-check-circle"
                            severity="success"
                            outlined
                            disabled
                            class="upload-btn"
                        />
                        <!-- INC-09: no disponible aún -->
                        <Button
                            v-else-if="isNotStarted(ent)"
                            :label="`Disponible el ${formatDate(ent.fecha_inicio)}`"
                            icon="pi pi-clock"
                            severity="secondary"
                            outlined
                            disabled
                            class="upload-btn"
                        />
                        <Button
                            v-else-if="ent.estado === 'entregado'"
                            label="En revisión"
                            icon="pi pi-hourglass"
                            severity="info"
                            outlined
                            disabled
                            class="upload-btn"
                        />
                        <Button
                            v-else
                            label="Expirado"
                            icon="pi pi-ban"
                            severity="danger"
                            outlined
                            disabled
                            class="upload-btn"
                        />
                    </div>
                </div>
            </div>
        </template>

        <!-- ════════════════════════════════
             DIALOG — SUBIR ENTREGABLE
        ════════════════════════════════ -->
        <Dialog
            v-model:visible="showDialog"
            header="Subir entregable"
            modal
            :style="{ width: '480px' }"
        >
            <div class="dialog-body">
                <!-- Info del entregable -->
                <div class="dialog-info">
                    <div class="dialog-info-icon">
                        <i class="pi pi-file"></i>
                    </div>
                    <div>
                        <p class="dialog-ent-name">{{ selectedEntregable?.nombre }}</p>
                        <p class="dialog-ent-date">
                            <i class="pi pi-calendar"></i>
                            Fecha límite: {{ formatDate(selectedEntregable?.fecha_limite) }}
                        </p>
                        <!-- INC-08: descripción visible al subir -->
                        <p v-if="selectedEntregable?.descripcion" class="dialog-ent-desc">
                            {{ selectedEntregable.descripcion }}
                        </p>
                    </div>
                </div>

                <!-- Instrucciones -->
                <div class="dialog-hint">
                    <i class="pi pi-info-circle hint-icon"></i>
                    <span>Comparte el enlace de tu archivo desde Google Drive, OneDrive o cualquier servicio de almacenamiento. Asegúrate de que el enlace sea público o accesible con el enlace.</span>
                </div>

                <!-- Input URL -->
                <div class="dialog-field">
                    <label class="dialog-label">Enlace del archivo</label>
                    <InputText
                        v-model="archivoUrl"
                        placeholder="https://drive.google.com/..."
                        class="w-full"
                        @keyup.enter="confirmarEnvio"
                    />
                </div>
            </div>

            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="showDialog = false" />
                <Button
                    label="Enviar entrega"
                    icon="pi pi-check"
                    :loading="submitting"
                    @click="confirmarEnvio"
                />
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* ════════════════════════════════════════
   LAYOUT — variables de _common.scss
════════════════════════════════════════ */
.entregables-page {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* ════════════════════════════════════════
   HEADER
════════════════════════════════════════ */
.ent-header { margin-bottom: 0; }

.ent-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 0.25rem;
}

.ent-subtitle {
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
    gap: 0.75rem;
    padding: 4rem 0;
}

.loading-icon {
    font-size: 2rem;
    color: var(--sisa-primary-l);
}

.loading-text {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
}

/* ════════════════════════════════════════
   BARRA DE PROGRESO
════════════════════════════════════════ */
.progress-card {
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 12px;
    padding: 1.25rem 1.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
}

.progress-info {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}

.progress-main {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
}

.progress-fraction {
    font-size: 1.4rem;
    color: var(--text-color);
}

.progress-fraction strong {
    font-size: 2rem;
    font-weight: 800;
    color: var(--sisa-primary-l);
    line-height: 1;
}

.progress-label {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
}

.progress-chips {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.75rem;
    border-radius: 99px;
    font-size: 0.75rem;
    font-weight: 600;
    border: 1px solid;
}

.chip-green { background: var(--sisa-tint-green);  color: var(--sisa-icon-green);  border-color: var(--sisa-tint-green); }
.chip-blue  { background: var(--sisa-tint-blue);   color: var(--sisa-icon-blue);   border-color: var(--sisa-tint-blue);  }
.chip-gray  { background: var(--surface-ground);   color: var(--text-color-secondary); border-color: var(--sisa-border); }

.ent-progress-bar {
    height: 8px;
    border-radius: 99px;
}

:deep(.ent-progress-bar .p-progressbar-value) {
    background: linear-gradient(90deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    border-radius: 99px;
}

:deep(.ent-progress-bar .p-progressbar) {
    background: var(--surface-ground);
}

.progress-pct {
    font-size: 0.78rem;
    color: var(--text-color-secondary);
    text-align: right;
}

/* ════════════════════════════════════════
   EMPTY STATE
════════════════════════════════════════ */
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

.empty-icon-wrap {
    width: 3.5rem;
    height: 3.5rem;
    background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    margin-bottom: 1rem;
    opacity: 0.6;
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
    margin: 0;
    max-width: 340px;
    line-height: 1.5;
}

/* ════════════════════════════════════════
   GRID DE CARDS
════════════════════════════════════════ */
.ent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
}

/* ════════════════════════════════════════
   CARD DE ENTREGABLE
════════════════════════════════════════ */
.ent-card {
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-top: 3px solid var(--sisa-border);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: box-shadow 0.2s;
}

.ent-card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* Acento de color según urgencia */
.urgency-critical { border-top-color: var(--sisa-icon-red); }
.urgency-warning  { border-top-color: var(--sisa-icon-amber); }
.urgency-upcoming { border-top-color: var(--sisa-icon-blue); opacity: 0.8; }

/* Cabecera */
.ent-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.estado-tag { font-size: 0.75rem; }

/* Badge de urgencia */
.urgency-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.6rem;
    border-radius: 99px;
    font-size: 0.72rem;
    font-weight: 700;
}

.urgency-badge.urgency-critical {
    background: var(--sisa-tint-red);
    color: var(--sisa-icon-red);
}

.urgency-badge.urgency-warning {
    background: var(--sisa-tint-amber);
    color: var(--sisa-icon-amber);
}

/* Nombre */
.ent-card-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0;
    line-height: 1.3;
}

/* INC-06/08: descripción */
.ent-card-desc {
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    margin: 0;
    line-height: 1.45;
}

/* Meta info */
.ent-meta {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.825rem;
    color: var(--text-color-secondary);
}

.meta-icon {
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    flex-shrink: 0;
}

/* Calificación */
.ent-grade {
    background: var(--sisa-tint-green);
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.grade-score {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
}

.grade-num {
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--sisa-icon-green);
    line-height: 1;
}

.grade-label {
    font-size: 0.85rem;
    color: var(--sisa-icon-green);
    font-weight: 600;
    opacity: 0.8;
}

.grade-obs {
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    margin: 0;
    line-height: 1.4;
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
}

.obs-icon {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--sisa-icon-green);
    opacity: 0.7;
}

/* Link de archivo */
.file-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.825rem;
    font-weight: 600;
    color: var(--sisa-primary-l);
    text-decoration: none;
    padding: 0.375rem 0;
    transition: opacity 0.15s;
}

.file-link:hover {
    opacity: 0.75;
    text-decoration: underline;
}

/* Footer con botón */
.ent-card-footer {
    margin-top: auto;
    padding-top: 0.375rem;
    border-top: 1px solid var(--sisa-border);
}

.upload-btn {
    width: 100%;
    justify-content: center;
    border-radius: 8px;
    font-weight: 600;
}

/* Upload activo: degradado institucional */
.upload-btn:not(:disabled):not([disabled]) {
    background: linear-gradient(135deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    border-color: transparent;
    box-shadow: 0 3px 10px rgba(15, 60, 97, 0.28);
    color: #fff;
    transition: opacity 0.2s, transform 0.15s;
}

.upload-btn:not(:disabled):not([disabled]):hover {
    opacity: 0.88;
    transform: translateY(-1px);
}

/* ════════════════════════════════════════
   DIALOG — SUBIR
════════════════════════════════════════ */
.dialog-body {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
    padding: 0.25rem 0;
}

/* Info del entregable seleccionado */
.dialog-info {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 0.875rem;
    background: var(--surface-ground);
    border: 1px solid var(--sisa-border);
    border-radius: 8px;
}

.dialog-info-icon {
    width: 2.25rem;
    height: 2.25rem;
    background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    flex-shrink: 0;
}

.dialog-ent-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 0.25rem;
}

.dialog-ent-date {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    margin: 0;
}

.dialog-ent-desc {
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    margin: 0.35rem 0 0;
    line-height: 1.45;
}

/* Hint */
.dialog-hint {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 0.875rem;
    background: var(--sisa-banner-info-bg);
    border: 1px solid var(--sisa-banner-info-bd);
    border-radius: 8px;
    font-size: 0.8rem;
    color: var(--text-color-secondary);
    line-height: 1.5;
}

.hint-icon {
    color: var(--sisa-icon-blue);
    font-size: 0.875rem;
    flex-shrink: 0;
    margin-top: 1px;
}

/* Campo de URL */
.dialog-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.dialog-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-color);
}

:deep(.dialog-field .p-inputtext) {
    border-radius: 8px;
    font-size: 0.9rem;
    height: 2.625rem;
}

/* Card resaltada desde el calendario */
@keyframes highlight-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(21, 101, 192, 0.5); }
    50%  { box-shadow: 0 0 0 8px rgba(21, 101, 192, 0); }
    100% { box-shadow: 0 0 0 0 rgba(21, 101, 192, 0); }
}

.ent-card--highlight {
    border-color: var(--sisa-primary-l) !important;
    animation: highlight-pulse 1s ease 2;
}

/* ════════════════════════════════════════
   RESPONSIVE
════════════════════════════════════════ */
@media (max-width: 600px) {
    .ent-grid {
        grid-template-columns: 1fr;
    }

    .progress-info {
        flex-direction: column;
        gap: 0.75rem;
    }

    .progress-main {
        flex-wrap: wrap;
    }
}
</style>
