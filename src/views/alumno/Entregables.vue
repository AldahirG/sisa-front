<script setup>
import api from '@/api/axios';
import { useToast } from '@/composables/useAppToast';
import { computed, onMounted, ref, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// PrimeVue
import Button from 'primevue/button';
import ConfirmDialog from 'primevue/confirmdialog';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
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
const sinAsignacion     = ref(false);
const sinPeriodo        = ref(false);
const loading           = ref(false);
const highlightId       = ref(null); // id del entregable resaltado desde calendar

const showDialog         = ref(false);
const selectedEntregable = ref(null);
const archivoUrl         = ref('');
const submitting         = ref(false);

// Modal de detalle + comentarios
const showDetailModal       = ref(false);
const detailEntregable      = ref(null);
const detailComentarios     = ref([]);
const loadingComentarios    = ref(false);
const nuevoComentario       = ref('');
const submittingComentario  = ref(false);

const openDetailModal = async (ent) => {
    detailEntregable.value = ent;
    showDetailModal.value  = true;
    nuevoComentario.value  = '';
    detailComentarios.value = [];
    if (ent.id_entrega) await loadComentarios(ent.id_entrega);
};

const loadComentarios = async (id_entrega) => {
    loadingComentarios.value = true;
    try {
        const { data } = await api.get(`/entregables/entregas/${id_entrega}/comentarios`);
        detailComentarios.value = data;
    } catch {
        detailComentarios.value = [];
    } finally {
        loadingComentarios.value = false;
    }
};

const enviarComentario = async () => {
    if (!nuevoComentario.value.trim()) return;
    submittingComentario.value = true;
    try {
        await api.post(`/entregables/entregas/${detailEntregable.value.id_entrega}/comentarios`, {
            contenido: nuevoComentario.value.trim()
        });
        nuevoComentario.value = '';
        await loadComentarios(detailEntregable.value.id_entrega);
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo enviar el comentario', life: 3000 });
    } finally {
        submittingComentario.value = false;
    }
};

const eliminarComentario = async (id_comentario) => {
    try {
        await api.delete(`/entregables/comentarios/${id_comentario}`);
        await loadComentarios(detailEntregable.value.id_entrega);
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el comentario', life: 3000 });
    }
};

// =====================
// LOAD (sin cambios)
// =====================
const loadEntregables = async () => {
    loading.value = true;
    try {
        const { data } = await api.get('/entregables/me');
        sinAsignacion.value = data?.sin_asignacion ?? false;
        sinPeriodo.value    = data?.sin_periodo   ?? false;
        entregables.value   = data?.entregables   ?? [];
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
        toast.add({ severity: 'success', summary: 'Entrega enviada correctamente' });
        showDialog.value = false;
        loadEntregables();
    } catch (e) {
        const raw    = e.response?.data?.message;
        const msg    = Array.isArray(raw) ? raw[0] : (raw || 'No se pudo enviar la entrega');
        const status = e.response?.status;
        // 409 = fecha no llegó (warn), 403 = sin empresa (warn), resto = error
        const isWarn = status === 409 || status === 403;
        toast.add({
            severity: isWarn ? 'warn' : 'error',
            summary:  status === 409 ? 'No disponible aún' : status === 403 ? 'Sin empresa asignada' : 'Error',
            detail:   msg,
            life:     isWarn ? 6000 : 4000
        });
    } finally {
        submitting.value = false;
    }
};

// =====================
// HELPERS DE DISPLAY
// (solo visualización, no afectan lógica)
// =====================

/** Formatea datetime ISO con hora: "22 de abril de 2026, 11:59 p. m." */
const formatDate = (fechaStr) => {
    if (!fechaStr) return '—';
    return new Date(fechaStr).toLocaleString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
                 SIN PERIODO ACTIVO
            ════════════════════════════════ -->
            <div v-if="sinPeriodo" class="empty-state">
                <div class="empty-icon-wrap" style="background: var(--sisa-tint-blue); color: var(--sisa-icon-blue);">
                    <i class="pi pi-calendar"></i>
                </div>
                <p class="empty-title">Sin período activo</p>
                <p class="empty-desc">No hay un período de prácticas activo en este momento. Estate atento al inicio del siguiente período.</p>
            </div>

            <!-- ════════════════════════════════
                 SIN EMPRESA ASIGNADA
            ════════════════════════════════ -->
            <div v-else-if="sinAsignacion" class="empty-state">
                <div class="empty-icon-wrap" style="background: var(--sisa-tint-amber); color: var(--sisa-icon-amber);">
                    <i class="pi pi-building"></i>
                </div>
                <p class="empty-title">Aún no tienes empresa asignada</p>
                <p class="empty-desc">Los entregables estarán disponibles una vez que el coordinador te asigne a una empresa en el periodo activo.</p>
            </div>

            <!-- ════════════════════════════════
                 SIN ENTREGABLES
            ════════════════════════════════ -->
            <div v-else-if="entregables.length === 0" class="empty-state">
                <div class="empty-icon-wrap">
                    <i class="pi pi-inbox"></i>
                </div>
                <p class="empty-title">Sin entregables disponibles</p>
                <p class="empty-desc">No hay entregables publicados para este periodo todavía. Vuelve más tarde.</p>
            </div>

            <!-- ════════════════════════════════
                 GRID DE ENTREGABLES
            ════════════════════════════════ -->
            <div v-else-if="entregables.length > 0" class="ent-grid">
                <div
                    v-for="ent in entregables"
                    :key="ent.id_entregable"
                    :id="`ent-card-${ent.id_entregable}`"
                    class="ent-card"
                    :class="[urgencyClass(ent), { 'ent-card--highlight': highlightId === ent.id_entregable }]"
                >
                    <!-- Cabecera: número + estado + urgencia -->
                    <div class="ent-card-top">
                        <div class="ent-card-top-left">
                            <span class="ent-num-chip">#{{ ent.numero }}</span>
                            <Tag
                                :value="estadoLabel(ent)"
                                :severity="estadoSeverity(ent)"
                                class="estado-tag"
                            />
                        </div>
                        <div class="ent-card-top-right">
                            <span
                                v-if="urgencyText(ent)"
                                class="urgency-badge"
                                :class="urgencyClass(ent)"
                            >
                                <i class="pi pi-clock"></i>
                                {{ urgencyText(ent) }}
                            </span>
                        </div>
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

                    <!-- Calificación (si evaluado) -->
                    <div v-if="ent.calificacion !== null && ent.calificacion !== undefined" class="ent-grade">
                        <div class="grade-score">
                            <span class="grade-num">{{ ent.calificacion }}</span>
                            <span class="grade-label">/ 10</span>
                        </div>
                    </div>

                    <!-- Retroalimentación del coordinador (si existe, independiente de la calif) -->
                    <div v-if="ent.observaciones" class="ent-feedback">
                        <p class="feedback-label">
                            <i class="pi pi-megaphone"></i>
                            Retroalimentación del coordinador
                        </p>
                        <p class="feedback-texto">{{ ent.observaciones }}</p>
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
                        <!-- Ver detalles (siempre visible) -->
                        <Button
                            label="Ver detalles"
                            icon="pi pi-file-check"
                            outlined
                            size="small"
                            severity="secondary"
                            class="upload-btn detail-btn-footer"
                            @click="openDetailModal(ent)"
                        />

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
             DIALOG — DETALLE ENTREGABLE
        ════════════════════════════════ -->
        <Dialog
            v-model:visible="showDetailModal"
            :header="`${detailEntregable?.numero ? '#' + detailEntregable.numero + ' — ' : ''}${detailEntregable?.nombre ?? ''}`"
            modal
            :style="{ width: '540px', maxWidth: '95vw' }"
            :breakpoints="{ '640px': '98vw', '960px': '85vw' }"
        >
            <div class="detail-body" v-if="detailEntregable">
                <!-- Estado + urgencia -->
                <div class="detail-status-row">
                    <Tag :value="estadoLabel(detailEntregable)" :severity="estadoSeverity(detailEntregable)" />
                    <span v-if="urgencyText(detailEntregable)" class="urgency-badge" :class="urgencyClass(detailEntregable)">
                        <i class="pi pi-clock"></i> {{ urgencyText(detailEntregable) }}
                    </span>
                </div>

                <!-- Descripción -->
                <div v-if="detailEntregable.descripcion" class="detail-section">
                    <p class="detail-label"><i class="pi pi-align-left"></i> Descripción</p>
                    <p class="detail-desc">{{ detailEntregable.descripcion }}</p>
                </div>

                <!-- Fechas con hora exacta -->
                <div class="detail-section detail-dates-grid">
                    <div v-if="detailEntregable.fecha_inicio" class="detail-date-box">
                        <i class="pi pi-calendar-plus detail-date-icon"></i>
                        <div>
                            <p class="detail-label">Disponible desde</p>
                            <p class="detail-date-val">{{ formatDate(detailEntregable.fecha_inicio) }}</p>
                        </div>
                    </div>
                    <div class="detail-date-box" :class="{ 'detail-date-expired': isExpired(detailEntregable.fecha_limite) }">
                        <i class="pi pi-calendar-times detail-date-icon"></i>
                        <div>
                            <p class="detail-label">Fecha límite</p>
                            <p class="detail-date-val">{{ formatDate(detailEntregable.fecha_limite) }}</p>
                        </div>
                    </div>
                </div>

                <!-- Calificación -->
                <div v-if="detailEntregable.calificacion !== null && detailEntregable.calificacion !== undefined" class="detail-section detail-grade-box">
                    <div class="detail-grade-score">
                        <span class="grade-num">{{ detailEntregable.calificacion }}</span>
                        <span class="grade-label">/ 10</span>
                    </div>
                </div>

                <!-- Retroalimentación (independiente de si hay calificación) -->
                <div v-if="detailEntregable.observaciones" class="detail-section detail-feedback-box">
                    <p class="detail-label">
                        <i class="pi pi-megaphone"></i>
                        Retroalimentación del coordinador
                    </p>
                    <p class="detail-feedback-texto">{{ detailEntregable.observaciones }}</p>
                </div>

                <!-- Archivo entregado -->
                <div v-if="detailEntregable.archivo_url" class="detail-section">
                    <p class="detail-label"><i class="pi pi-paperclip"></i> Archivo entregado</p>
                    <a :href="detailEntregable.archivo_url" target="_blank" rel="noopener noreferrer" class="file-link">
                        <i class="pi pi-external-link"></i> Ver archivo
                    </a>
                </div>

                <!-- Comentarios (solo si hay entrega) -->
                <div v-if="detailEntregable.id_entrega" class="detail-section detail-comments">
                    <p class="detail-label"><i class="pi pi-comments"></i> Comentarios</p>

                    <!-- Lista -->
                    <div v-if="loadingComentarios" class="comments-loading">
                        <i class="pi pi-spin pi-spinner"></i> Cargando…
                    </div>
                    <div v-else-if="detailComentarios.length === 0" class="comments-empty">
                        Sin comentarios aún.
                    </div>
                    <div v-else class="comments-list">
                        <div
                            v-for="c in detailComentarios"
                            :key="c.id_comentario"
                            class="comment-item"
                            :class="{ 'comment-mine': c.autor.rol === 'alumno', 'comment-admin': c.autor.rol === 'admin' }"
                        >
                            <div class="comment-header">
                                <span class="comment-autor">
                                    <i class="pi" :class="c.autor.rol === 'admin' ? 'pi-shield' : 'pi-user'"></i>
                                    {{ c.autor.nombre }}
                                </span>
                                <div class="comment-header-right">
                                    <span class="comment-fecha">
                                        {{ new Date(c.fecha).toLocaleString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) }}
                                    </span>
                                    <Button
                                        v-if="c.autor.rol === 'alumno'"
                                        icon="pi pi-trash"
                                        text
                                        rounded
                                        size="small"
                                        severity="danger"
                                        class="comment-delete-btn"
                                        @click="eliminarComentario(c.id_comentario)"
                                    />
                                </div>
                            </div>
                            <p class="comment-texto">{{ c.contenido }}</p>
                        </div>
                    </div>

                    <!-- Nuevo comentario -->
                    <div class="comment-new">
                        <Textarea
                            v-model="nuevoComentario"
                            placeholder="Escribe un comentario…"
                            rows="2"
                            autoResize
                            class="w-full comment-textarea"
                            @keydown.ctrl.enter="enviarComentario"
                        />
                        <Button
                            label="Enviar"
                            icon="pi pi-send"
                            size="small"
                            :loading="submittingComentario"
                            :disabled="!nuevoComentario.trim()"
                            @click="enviarComentario"
                        />
                    </div>
                </div>
            </div>

            <template #footer>
                <Button label="Cerrar" text severity="secondary" @click="showDetailModal = false" />
                <Button
                    v-if="canUpload(detailEntregable)"
                    :label="detailEntregable?.estado === 'entregado' ? 'Modificar entrega' : 'Subir entregable'"
                    :icon="detailEntregable?.estado === 'entregado' ? 'pi pi-pencil' : 'pi pi-upload'"
                    @click="showDetailModal = false; abrirDialogo(detailEntregable)"
                />
            </template>
        </Dialog>

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
    border-left: 4px solid var(--sisa-primary-l);
    border-radius: 12px;
    padding: 1.25rem 1.375rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    box-shadow: 0 2px 12px rgba(15, 60, 97, 0.06);
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

.ent-card-top-left {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
}

/* Número del entregable */
.ent-num-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-ground);
    border: 1px solid var(--sisa-border);
    color: var(--text-color-secondary);
    font-size: 0.68rem;
    font-weight: 800;
    padding: 0.1rem 0.45rem;
    border-radius: 0.35rem;
    letter-spacing: 0.02em;
    flex-shrink: 0;
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
    padding: 0.625rem 0.75rem;
    display: flex;
    align-items: center;
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

/* Retroalimentación del coordinador — sección propia, destaca */
.ent-feedback {
    background: var(--sisa-tint-blue);
    border: 1px solid var(--sisa-icon-blue, #1c6aac);
    border-left: 4px solid var(--sisa-icon-blue, #1c6aac);
    border-radius: 8px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.feedback-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sisa-icon-blue, #1c6aac);
    margin: 0;
}

.feedback-texto {
    font-size: 0.83rem;
    color: var(--text-color);
    margin: 0;
    line-height: 1.5;
    white-space: pre-wrap;
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

/* ════════════════════════════════════════
   CARD TOP
════════════════════════════════════════ */
.ent-card-top-right {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

/* Botón "Ver detalles" en footer */
.detail-btn-footer {
    background: transparent !important;
    border-color: var(--sisa-border) !important;
    color: var(--text-color-secondary) !important;
    box-shadow: none !important;
    font-size: 0.8rem !important;
    transform: none !important;
    opacity: 0.85;
}
.detail-btn-footer:hover {
    opacity: 1;
    background: var(--surface-ground) !important;
    transform: none !important;
}

/* ════════════════════════════════════════
   DIALOG — DETALLE ENTREGABLE
════════════════════════════════════════ */
.detail-body {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
    padding: 0.25rem 0;
}

.detail-status-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
}

.detail-section {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.detail-label {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-color-secondary);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.375rem;
}

.detail-desc {
    font-size: 0.875rem;
    color: var(--text-color);
    margin: 0;
    line-height: 1.5;
    background: var(--surface-ground);
    padding: 0.625rem 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--sisa-border);
}

.detail-dates-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
}

.detail-date-box {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem;
    background: var(--surface-ground);
    border: 1px solid var(--sisa-border);
    border-radius: 8px;
}

.detail-date-box.detail-date-expired {
    background: var(--sisa-tint-red);
    border-color: var(--sisa-icon-red);
}

.detail-date-icon {
    font-size: 1rem;
    color: var(--text-color-secondary);
    margin-top: 2px;
    flex-shrink: 0;
}

.detail-date-expired .detail-date-icon {
    color: var(--sisa-icon-red);
}

.detail-date-val {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0;
    line-height: 1.35;
}

.detail-date-expired .detail-date-val {
    color: var(--sisa-icon-red);
}

.detail-grade-box {
    background: var(--sisa-tint-green);
    border-radius: 8px;
    padding: 0.75rem 0.875rem;
    gap: 0.5rem;
    flex-direction: row;
    align-items: center;
}

.detail-grade-score {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
}

/* Feedback box en el modal */
.detail-feedback-box {
    background: var(--sisa-tint-blue);
    border: 1px solid var(--sisa-icon-blue, #1c6aac);
    border-left: 4px solid var(--sisa-icon-blue, #1c6aac);
    border-radius: 8px;
    padding: 0.875rem;
    gap: 0.5rem;
}

.detail-feedback-texto {
    font-size: 0.875rem;
    color: var(--text-color);
    margin: 0;
    line-height: 1.5;
    white-space: pre-wrap;
}

/* ════════════════════════════════════════
   COMENTARIOS EN MODAL
════════════════════════════════════════ */
.detail-comments {
    background: var(--surface-ground);
    border: 1px solid var(--sisa-border);
    border-radius: 10px;
    padding: 1rem;
    gap: 0.75rem;
}

.comments-loading,
.comments-empty {
    font-size: 0.82rem;
    color: var(--text-color-secondary);
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.25rem 0;
}

.comments-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 240px;
    overflow-y: auto;
}

.comment-item {
    padding: 0.625rem 0.75rem;
    border-radius: 8px;
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
}

.comment-item.comment-admin {
    border-left: 3px solid var(--sisa-primary);
    background: var(--sisa-tint-blue);
}

.comment-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
}

.comment-header-right {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.comment-autor {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-color);
}

.comment-fecha {
    font-size: 0.7rem;
    color: var(--text-color-secondary);
}

.comment-delete-btn {
    opacity: 0;
    transition: opacity 0.15s;
    width: 1.5rem !important;
    height: 1.5rem !important;
}
.comment-item:hover .comment-delete-btn {
    opacity: 0.7;
}
.comment-delete-btn:hover {
    opacity: 1 !important;
}

.comment-texto {
    font-size: 0.82rem;
    color: var(--text-color);
    margin: 0;
    line-height: 1.45;
    white-space: pre-wrap;
}

.comment-new {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid var(--sisa-border);
    padding-top: 0.75rem;
    margin-top: 0.25rem;
}

.comment-textarea {
    font-size: 0.85rem;
    border-radius: 8px;
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
   RESPONSIVE — TABLET
════════════════════════════════════════ */
@media (max-width: 768px) {
    .ent-grid {
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    }

    .detail-dates-grid {
        grid-template-columns: 1fr;
    }
}

/* ════════════════════════════════════════
   RESPONSIVE — MOBILE
════════════════════════════════════════ */
@media (max-width: 576px) {
    .entregables-page {
        gap: 1rem;
    }

    .ent-grid {
        grid-template-columns: 1fr;
    }

    .progress-info {
        flex-direction: column;
        gap: 0.75rem;
    }

    .progress-chips {
        flex-wrap: wrap;
    }

    .progress-fraction strong {
        font-size: 1.6rem;
    }

    .ent-card-footer {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .upload-btn {
        width: 100%;
    }

    .detail-dates-grid {
        grid-template-columns: 1fr;
    }

    .detail-body {
        gap: 0.875rem;
    }
}
</style>
