<script setup>
import api from '@/api/axios';
import { useToast } from '@/composables/useAppToast';
import { computed, onMounted, ref, watch } from 'vue';

import Button from 'primevue/button';
import ConfirmDialog from 'primevue/confirmdialog';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';
import { useConfirm } from 'primevue/useconfirm';

const toast = useToast();
const confirm = useConfirm();

// ══════════════════════════════════════════════════════════
// PERIODO
// ══════════════════════════════════════════════════════════
const periodos            = ref([]);
const periodoSeleccionado = ref(null);

const loadPeriodos = async () => {
    try {
        const { data } = await api.get('/periodos');
        periodos.value = data;
        periodoSeleccionado.value = data.find((p) => p.estado === 'activo') ?? null;
        if (periodoSeleccionado.value) await loadDashboard();
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los periodos', life: 4000 });
    }
};

watch(periodoSeleccionado, () => {
    entregableActivo.value = null;
    estudiantes.value = [];
    estudianteActivo.value = null;
    loadDashboard();
});

// ══════════════════════════════════════════════════════════
// DASHBOARD — cards de entregables
// ══════════════════════════════════════════════════════════
const entregables      = ref([]);
const loadingDashboard = ref(false);

const loadDashboard = async () => {
    if (!periodoSeleccionado.value) return;
    loadingDashboard.value = true;
    try {
        const { data } = await api.get(
            `/entregables/evaluaciones/periodo/${periodoSeleccionado.value.id_periodo}/dashboard`
        );
        entregables.value = data;
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el dashboard', life: 4000 });
    } finally {
        loadingDashboard.value = false;
    }
};

// Ciclo de acentos para las cards del dashboard
const CARD_ACCENTS = [
    { tint: 'var(--sisa-tint-blue)',   icon: 'var(--sisa-icon-blue)',   border: 'var(--sisa-icon-blue)'   },
    { tint: 'var(--sisa-tint-green)',  icon: 'var(--sisa-icon-green)',  border: 'var(--sisa-icon-green)'  },
    { tint: 'var(--sisa-tint-purple)', icon: 'var(--sisa-icon-purple)', border: 'var(--sisa-icon-purple)' },
    { tint: 'var(--sisa-tint-amber)',  icon: 'var(--sisa-icon-amber)',  border: 'var(--sisa-icon-amber)'  },
];
const cardAccent = (idx) => CARD_ACCENTS[idx % CARD_ACCENTS.length];

// ══════════════════════════════════════════════════════════
// CLASSROOM VIEW — entregable seleccionado
// ══════════════════════════════════════════════════════════
const entregableActivo = ref(null);
const estudiantes      = ref([]);
const loadingEst       = ref(false);
const tabActivo        = ref('entregados');
const searchEst        = ref('');
const estudianteActivo = ref(null);

const abrirEntregable = async (ent) => {
    entregableActivo.value = ent;
    estudianteActivo.value = null;
    tabActivo.value        = 'entregados';
    searchEst.value        = '';
    await loadEstudiantes(ent.id_entregable);
};

const volverDashboard = () => {
    entregableActivo.value = null;
    estudianteActivo.value = null;
    estudiantes.value      = [];
    mobilePanel.value      = 'list';
};

const loadEstudiantes = async (id_entregable) => {
    loadingEst.value = true;
    try {
        const { data } = await api.get(`/entregables/evaluaciones/entregable/${id_entregable}/alumnos`);
        estudiantes.value = data;
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la lista de alumnos', life: 4000 });
    } finally {
        loadingEst.value = false;
    }
};

const estudiantesEntregados  = computed(() => estudiantes.value.filter((e) => e.entrega));
const estudiantesSinEntregar = computed(() => estudiantes.value.filter((e) => !e.entrega));

const estudiantesActivos = computed(() => {
    const lista = tabActivo.value === 'entregados' ? estudiantesEntregados.value : estudiantesSinEntregar.value;
    if (!searchEst.value.trim()) return lista;
    const q = searchEst.value.toLowerCase();
    return lista.filter(
        (e) =>
            e.alumno.nombre.toLowerCase().includes(q) ||
            e.alumno.matricula.toLowerCase().includes(q)
    );
});

// 'list' | 'detail' — only matters on mobile (<960px)
const mobilePanel = ref('list');

const seleccionarEstudiante = async (est) => {
    estudianteActivo.value = est;
    mobilePanel.value = 'detail';
    formEval.value = {
        calificacion: est.entrega?.calificacion ?? null,
        observaciones: est.entrega?.observaciones ?? ''
    };
    comentarios.value = [];
    nuevoComentario.value = '';
    if (est.entrega?.id_entrega) {
        await loadComentarios(est.entrega.id_entrega);
    }
};

const volverALista = () => {
    mobilePanel.value = 'list';
    estudianteActivo.value = null;
};

// ══════════════════════════════════════════════════════════
// EVALUACIÓN
// ══════════════════════════════════════════════════════════
const formEval  = ref({ calificacion: null, observaciones: '' });
const guardando = ref(false);

const ejecutarGuardarEvaluacion = async () => {
    guardando.value = true;
    try {
        await api.post(
            `/entregables/evaluar/${estudianteActivo.value.entrega.id_entrega}`,
            formEval.value
        );
        estudianteActivo.value.entrega.calificacion  = formEval.value.calificacion;
        estudianteActivo.value.entrega.observaciones = formEval.value.observaciones;
        await loadDashboard();
        await loadEstudiantes(entregableActivo.value.id_entregable);
        const updated = estudiantes.value.find(
            (e) => e.alumno.id_alumno === estudianteActivo.value.alumno.id_alumno
        );
        if (updated) estudianteActivo.value = updated;
        toast.add({ severity: 'success', summary: 'Evaluación guardada', life: 2500 });
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la evaluación', life: 4000 });
    } finally {
        guardando.value = false;
    }
};

const guardarEvaluacion = () => {
    if (formEval.value.calificacion === null || formEval.value.calificacion === undefined) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'Ingresa una calificación', life: 3000 });
        return;
    }
    const yaCalificado = estudianteActivo.value.entrega?.calificacion !== null &&
                         estudianteActivo.value.entrega?.calificacion !== undefined;
    if (yaCalificado) {
        confirm.require({
            message: `Este alumno ya tiene calificación ${estudianteActivo.value.entrega.calificacion}. ¿Sobrescribir con ${formEval.value.calificacion}?`,
            header: 'Reemplazar calificación',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sí, reemplazar',
            rejectLabel: 'Cancelar',
            acceptClass: 'p-button-warning',
            accept: ejecutarGuardarEvaluacion,
        });
    } else {
        ejecutarGuardarEvaluacion();
    }
};

// ══════════════════════════════════════════════════════════
// COMENTARIOS
// ══════════════════════════════════════════════════════════
const comentarios          = ref([]);
const loadingComentarios   = ref(false);
const nuevoComentario      = ref('');
const submittingComentario = ref(false);

const loadComentarios = async (id_entrega) => {
    loadingComentarios.value = true;
    try {
        const { data } = await api.get(`/entregables/entregas/${id_entrega}/comentarios`);
        comentarios.value = data;
    } catch {
        comentarios.value = [];
    } finally {
        loadingComentarios.value = false;
    }
};

const enviarComentario = async () => {
    if (!nuevoComentario.value.trim()) return;
    submittingComentario.value = true;
    try {
        await api.post(
            `/entregables/entregas/${estudianteActivo.value.entrega.id_entrega}/comentarios`,
            { contenido: nuevoComentario.value.trim() }
        );
        nuevoComentario.value = '';
        await loadComentarios(estudianteActivo.value.entrega.id_entrega);
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo enviar el comentario', life: 3000 });
    } finally {
        submittingComentario.value = false;
    }
};

const eliminarComentario = (id_comentario) => {
    confirm.require({
        message: '¿Eliminar este comentario? Esta acción no se puede deshacer.',
        header: 'Confirmar eliminación',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',
        accept: async () => {
            try {
                await api.delete(`/entregables/comentarios/${id_comentario}`);
                await loadComentarios(estudianteActivo.value.entrega.id_entrega);
            } catch {
                toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el comentario', life: 3000 });
            }
        }
    });
};

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════
const formatDate = (s) => {
    if (!s) return '—';
    const d = s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00');
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (s) => {
    if (!s) return '—';
    return new Date(s).toLocaleString('es-MX', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit'
    });
};

const isVencido    = (s) => s && new Date(s) < new Date();
const entregadoPct = (ent) => ent.stats.total_alumnos
    ? Math.round((ent.stats.entregados / ent.stats.total_alumnos) * 100)
    : 0;

const calColor = (cal) => {
    if (cal === null || cal === undefined) return '';
    if (cal >= 9)  return 'cal-a';
    if (cal >= 7)  return 'cal-b';
    if (cal >= 6)  return 'cal-c';
    return 'cal-f';
};

onMounted(loadPeriodos);
</script>

<template>
    <div class="ev-page">
        <Toast />
        <ConfirmDialog />

        <!-- ══════════════════════════════════════════
             PAGE HEADER
        ══════════════════════════════════════════ -->
        <div class="ev-header">
            <div class="ev-header-left">
                <template v-if="entregableActivo">
                    <button class="back-pill" @click="volverDashboard">
                        <i class="pi pi-arrow-left"></i>
                        Entregables
                    </button>
                    <div class="ev-header-title">
                        <div class="ev-num-badge">#{{ entregableActivo.numero }}</div>
                        <div>
                            <h4 class="ev-title">{{ entregableActivo.nombre }}</h4>
                            <p class="ev-subtitle">
                                <span class="stat-pill stat-pill--green">
                                    <i class="pi pi-check"></i> {{ entregableActivo.stats.entregados }}/{{ entregableActivo.stats.total_alumnos }}
                                </span>
                                <span class="stat-pill stat-pill--blue">
                                    <i class="pi pi-star"></i> {{ entregableActivo.stats.evaluados }} eval.
                                </span>
                                <span v-if="entregableActivo.stats.pendientes_eval > 0" class="stat-pill stat-pill--amber">
                                    <i class="pi pi-clock"></i> {{ entregableActivo.stats.pendientes_eval }} pendientes
                                </span>
                            </p>
                        </div>
                    </div>
                </template>

                <template v-else>
                    <div class="ev-page-icon">
                        <i class="pi pi-star-fill"></i>
                    </div>
                    <div>
                        <h4 class="ev-title">Evaluaciones</h4>
                        <p class="ev-subtitle-plain">Revisa y califica los entregables por actividad</p>
                    </div>
                </template>
            </div>

            <Select
                v-model="periodoSeleccionado"
                :options="periodos"
                optionLabel="nombre"
                placeholder="Seleccionar período"
                class="ev-periodo-select"
            />
        </div>

        <!-- ══════════════════════════════════════════
             VISTA 1 — DASHBOARD
        ══════════════════════════════════════════ -->
        <template v-if="!entregableActivo">
            <div v-if="loadingDashboard" class="ev-loading">
                <div class="ev-spinner"></div>
                <span>Cargando entregables…</span>
            </div>

            <div v-else-if="!periodoSeleccionado" class="ev-empty">
                <i class="pi pi-star ev-empty-icon"></i>
                <p>Selecciona un período para comenzar</p>
            </div>

            <div v-else-if="entregables.length === 0" class="ev-empty">
                <i class="pi pi-inbox ev-empty-icon"></i>
                <p>Sin entregables en este período</p>
            </div>

            <div v-else class="ev-cards-grid">
                <div
                    v-for="(ent, i) in entregables"
                    :key="ent.id_entregable"
                    class="ev-card"
                    :style="`--card-accent: ${cardAccent(i).border}; --card-tint: ${cardAccent(i).tint}; --card-icon: ${cardAccent(i).icon}`"
                    @click="abrirEntregable(ent)"
                >
                    <!-- Número + nombre -->
                    <div class="ev-card-head">
                        <div class="ev-card-num">{{ ent.numero }}</div>
                        <div class="ev-card-head-text">
                            <h3 class="ev-card-nombre">{{ ent.nombre }}</h3>
                            <p v-if="ent.descripcion" class="ev-card-desc">{{ ent.descripcion }}</p>
                        </div>
                    </div>

                    <!-- Fecha -->
                    <div class="ev-card-fecha">
                        <i class="pi pi-calendar"></i>
                        {{ formatDate(ent.fecha_inicio) }} → {{ formatDate(ent.fecha_limite) }}
                        <span v-if="isVencido(ent.fecha_limite)" class="vencido-pill">Vencido</span>
                    </div>

                    <!-- Stats 2×2 -->
                    <div class="ev-stats-grid">
                        <div class="ev-stat">
                            <span class="ev-stat-num">{{ ent.stats.entregados }}<em>/{{ ent.stats.total_alumnos }}</em></span>
                            <span class="ev-stat-lbl">Entregados</span>
                        </div>
                        <div class="ev-stat ev-stat--blue">
                            <span class="ev-stat-num">{{ ent.stats.evaluados }}</span>
                            <span class="ev-stat-lbl">Evaluados</span>
                        </div>
                        <div v-if="ent.stats.pendientes_eval > 0" class="ev-stat ev-stat--amber">
                            <span class="ev-stat-num">{{ ent.stats.pendientes_eval }}</span>
                            <span class="ev-stat-lbl">Por evaluar</span>
                        </div>
                        <div v-if="ent.stats.sin_entregar > 0" class="ev-stat ev-stat--red">
                            <span class="ev-stat-num">{{ ent.stats.sin_entregar }}</span>
                            <span class="ev-stat-lbl">Sin entregar</span>
                        </div>
                    </div>

                    <!-- Mini progress track -->
                    <div class="ev-track-wrap">
                        <div class="ev-track">
                            <div class="ev-track-fill" :style="`width: ${entregadoPct(ent)}%`"></div>
                        </div>
                        <span class="ev-track-pct">{{ entregadoPct(ent) }}%</span>
                    </div>

                    <!-- CTA -->
                    <div class="ev-card-cta">
                        Revisar entregas <i class="pi pi-arrow-right"></i>
                    </div>
                </div>
            </div>
        </template>

        <!-- ══════════════════════════════════════════
             VISTA 2 — CLASSROOM
        ══════════════════════════════════════════ -->
        <div v-else class="ev-classroom">
            <!-- ── Panel izquierdo ── -->
            <div class="ev-students" :class="{ 'ev-panel--hidden-mobile': mobilePanel === 'detail' }">
                <div class="ev-students-head">
                    <div class="ev-search-wrap">
                        <i class="pi pi-search ev-search-icon"></i>
                        <input
                            v-model="searchEst"
                            type="text"
                            placeholder="Buscar por nombre o matrícula…"
                            class="ev-search-input"
                        />
                        <button v-if="searchEst" class="ev-search-clear" @click="searchEst = ''">
                            <i class="pi pi-times"></i>
                        </button>
                    </div>
                    <div class="ev-tabs">
                        <button
                            class="ev-tab"
                            :class="{ 'ev-tab--active': tabActivo === 'entregados' }"
                            @click="tabActivo = 'entregados'"
                        >
                            <i class="pi pi-check-circle"></i>
                            Entregados
                            <span class="ev-tab-count ev-tab-count--green">{{ estudiantesEntregados.length }}</span>
                        </button>
                        <button
                            class="ev-tab"
                            :class="{ 'ev-tab--active': tabActivo === 'sin_entregar' }"
                            @click="tabActivo = 'sin_entregar'"
                        >
                            <i class="pi pi-times-circle"></i>
                            Sin entregar
                            <span class="ev-tab-count ev-tab-count--red">{{ estudiantesSinEntregar.length }}</span>
                        </button>
                    </div>
                </div>

                <div class="ev-student-list">
                    <div v-if="loadingEst" class="ev-list-state">
                        <div class="ev-spinner ev-spinner--sm"></div> Cargando…
                    </div>
                    <div v-else-if="estudiantesActivos.length === 0" class="ev-list-state">
                        <i class="pi pi-inbox"></i> Sin resultados
                    </div>
                    <button
                        v-else
                        v-for="est in estudiantesActivos"
                        :key="est.alumno.id_alumno"
                        class="ev-student-row"
                        :class="{ 'ev-student-row--active': estudianteActivo?.alumno.id_alumno === est.alumno.id_alumno }"
                        @click="seleccionarEstudiante(est)"
                    >
                        <div class="ev-av">{{ (est.alumno.nombre || '?')[0].toUpperCase() }}</div>
                        <div class="ev-student-info">
                            <p class="ev-student-name">{{ est.alumno.nombre }}</p>
                            <p class="ev-student-meta">{{ est.alumno.matricula }}</p>
                        </div>
                        <div class="ev-student-right">
                            <span
                                v-if="est.entrega?.calificacion !== null && est.entrega?.calificacion !== undefined"
                                class="ev-cal-badge"
                                :class="calColor(est.entrega.calificacion)"
                            >
                                {{ est.entrega.calificacion }}
                            </span>
                            <span v-else-if="est.entrega" class="ev-pending-dot">
                                <i class="pi pi-hourglass"></i>
                            </span>
                        </div>
                    </button>
                </div>
            </div>

            <!-- ── Panel derecho ── -->
            <div class="ev-submission" :class="{ 'ev-panel--hidden-mobile': mobilePanel === 'list' }">
                <!-- Botón back — solo mobile -->
                <button v-if="estudianteActivo" class="ev-back-btn" @click="volverALista">
                    <i class="pi pi-arrow-left"></i> Volver a lista
                </button>
                <!-- Vacío -->
                <div v-if="!estudianteActivo" class="ev-sub-empty">
                    <div class="ev-sub-empty-icon"><i class="pi pi-user"></i></div>
                    <p>Selecciona un alumno para ver su entrega</p>
                </div>

                <!-- Sin entrega -->
                <template v-else-if="!estudianteActivo.entrega">
                    <div class="ev-sub-header">
                        <div class="ev-sub-av">{{ (estudianteActivo.alumno.nombre || '?')[0].toUpperCase() }}</div>
                        <div>
                            <p class="ev-sub-nombre">{{ estudianteActivo.alumno.nombre }}</p>
                            <p class="ev-sub-meta">{{ estudianteActivo.alumno.matricula }} · {{ estudianteActivo.alumno.carrera }}</p>
                        </div>
                    </div>
                    <div class="ev-no-entry">
                        <i class="pi pi-inbox"></i>
                        <p>Este alumno aún no ha entregado</p>
                    </div>
                </template>

                <!-- Con entrega -->
                <template v-else>
                    <div class="ev-sub-header">
                        <div class="ev-sub-av">{{ (estudianteActivo.alumno.nombre || '?')[0].toUpperCase() }}</div>
                        <div class="ev-sub-header-text">
                            <p class="ev-sub-nombre">{{ estudianteActivo.alumno.nombre }}</p>
                            <p class="ev-sub-meta">{{ estudianteActivo.alumno.matricula }} · {{ estudianteActivo.alumno.carrera }}</p>
                        </div>
                        <div class="ev-sub-envio">
                            <i class="pi pi-send"></i>
                            {{ formatDateTime(estudianteActivo.entrega.fecha_envio) }}
                        </div>
                    </div>

                    <div class="ev-sub-body">
                        <!-- Archivo -->
                        <div class="ev-sub-section">
                            <span class="ev-sub-label"><i class="pi pi-paperclip"></i> Archivo entregado</span>
                            <a
                                v-if="estudianteActivo.entrega.archivo_url"
                                :href="estudianteActivo.entrega.archivo_url"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="ev-file-link"
                            >
                                <i class="pi pi-external-link"></i> Ver archivo
                            </a>
                            <span v-else class="ev-no-file">Sin archivo adjunto</span>
                        </div>

                        <!-- Calificación -->
                        <div class="ev-sub-section">
                            <span class="ev-sub-label"><i class="pi pi-star"></i> Calificación (0–10)</span>
                            <div class="ev-grade-input-wrap">
                                <InputNumber
                                    v-model="formEval.calificacion"
                                    :min="0" :max="10" :step="0.5"
                                    showButtons
                                    class="ev-grade-input"
                                />
                                <Button
                                    label="Guardar"
                                    icon="pi pi-check"
                                    severity="success"
                                    :loading="guardando"
                                    class="ev-save-btn"
                                    @click="guardarEvaluacion"
                                />
                            </div>
                        </div>

                        <!-- Observaciones -->
                        <div class="ev-sub-section">
                            <span class="ev-sub-label"><i class="pi pi-comment"></i> Retroalimentación para el alumno</span>
                            <Textarea
                                v-model="formEval.observaciones"
                                rows="3"
                                autoResize
                                class="w-full ev-obs-area"
                                placeholder="Escribe retroalimentación…"
                            />
                        </div>

                        <!-- Comentarios -->
                        <div class="ev-comments">
                            <div class="ev-comments-head">
                                <span class="ev-sub-label">
                                    <i class="pi pi-comments"></i> Hilo de comentarios
                                </span>
                                <span v-if="comentarios.length" class="ev-comments-count">{{ comentarios.length }}</span>
                            </div>

                            <div v-if="loadingComentarios" class="ev-comments-state">
                                <div class="ev-spinner ev-spinner--sm"></div> Cargando…
                            </div>
                            <div v-else-if="comentarios.length === 0" class="ev-comments-state">
                                Sin comentarios en esta entrega.
                            </div>
                            <div v-else class="ev-comments-list">
                                <div
                                    v-for="c in comentarios"
                                    :key="c.id_comentario"
                                    class="ev-comment"
                                    :class="c.autor.rol === 'admin' ? 'ev-comment--admin' : 'ev-comment--alumno'"
                                >
                                    <div class="ev-comment-head">
                                        <span class="ev-comment-autor">
                                            <span class="ev-comment-role-dot" :class="c.autor.rol === 'admin' ? 'dot-admin' : 'dot-alumno'"></span>
                                            {{ c.autor.nombre }}
                                            <span class="ev-comment-rol" :class="c.autor.rol === 'admin' ? 'rol-admin' : 'rol-alumno'">
                                                {{ c.autor.rol === 'admin' ? 'Coordinador' : 'Alumno' }}
                                            </span>
                                        </span>
                                        <div class="ev-comment-actions">
                                            <span class="ev-comment-fecha">{{ formatDateTime(c.fecha) }}</span>
                                            <button
                                                v-if="c.autor.rol === 'admin'"
                                                class="ev-comment-del"
                                                @click="eliminarComentario(c.id_comentario)"
                                            >
                                                <i class="pi pi-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <p class="ev-comment-text">{{ c.contenido }}</p>
                                </div>
                            </div>

                            <div class="ev-comment-new">
                                <Textarea
                                    v-model="nuevoComentario"
                                    placeholder="Escribe un comentario… (Ctrl+Enter para enviar)"
                                    rows="2" autoResize
                                    class="w-full ev-comment-ta"
                                    @keydown.ctrl.enter="enviarComentario"
                                />
                                <Button
                                    label="Enviar"
                                    icon="pi pi-send"
                                    size="small"
                                    :loading="submittingComentario"
                                    :disabled="!nuevoComentario.trim()"
                                    class="ev-send-btn"
                                    @click="enviarComentario"
                                />
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ═══════════════════════════════════════
   BASE
═══════════════════════════════════════ */
.ev-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* ═══════════════════════════════════════
   HEADER
═══════════════════════════════════════ */
.ev-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}

.ev-header-left {
    display: flex;
    align-items: center;
    gap: .875rem;
    flex: 1;
    min-width: 0;
}

.back-pill {
    display: inline-flex;
    align-items: center;
    gap: .4rem;
    padding: .4rem .875rem;
    border-radius: 99px;
    border: 1px solid var(--p-content-border-color);
    background: var(--p-content-background);
    font-size: .78rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
    cursor: pointer;
    transition: all .18s;
    flex-shrink: 0;
    font-family: inherit;
}
.back-pill:hover {
    background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue);
    border-color: var(--sisa-icon-blue);
}

.ev-page-icon {
    width: 2.75rem;
    height: 2.75rem;
    border-radius: .75rem;
    background: linear-gradient(135deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(15, 60, 97, .3);
}

.ev-header-title {
    display: flex;
    align-items: center;
    gap: .625rem;
    min-width: 0;
}

.ev-num-badge {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: .5rem;
    background: linear-gradient(135deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    color: #fff;
    font-size: .875rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.ev-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--p-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ev-subtitle {
    display: flex;
    align-items: center;
    gap: .375rem;
    flex-wrap: wrap;
    margin: .25rem 0 0;
}

.ev-subtitle-plain {
    margin: .15rem 0 0;
    font-size: .82rem;
    color: var(--p-text-muted-color);
}

.stat-pill {
    display: inline-flex;
    align-items: center;
    gap: .3rem;
    padding: .15rem .55rem;
    border-radius: 99px;
    font-size: .72rem;
    font-weight: 700;
}
.stat-pill--green { background: var(--sisa-tint-green); color: var(--sisa-icon-green); }
.stat-pill--blue  { background: var(--sisa-tint-blue);  color: var(--sisa-icon-blue);  }
.stat-pill--amber { background: var(--sisa-tint-amber); color: var(--sisa-icon-amber); }

.ev-periodo-select { min-width: 210px; }

/* ═══════════════════════════════════════
   LOADING / EMPTY
═══════════════════════════════════════ */
.ev-loading,
.ev-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .875rem;
    padding: 5rem 2rem;
    font-size: .9rem;
    color: var(--p-text-muted-color);
}
.ev-empty-icon { font-size: 2.5rem; opacity: .2; }

.ev-spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid var(--p-content-border-color);
    border-top-color: var(--sisa-primary-l);
    border-radius: 50%;
    animation: ev-spin .7s linear infinite;
}
.ev-spinner--sm { width: 1.1rem; height: 1.1rem; border-width: 2px; }

@keyframes ev-spin { to { transform: rotate(360deg); } }

/* ═══════════════════════════════════════
   DASHBOARD GRID
═══════════════════════════════════════ */
.ev-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
    gap: 1rem;
}

/* ═══════════════════════════════════════
   CARD ENTREGABLE
═══════════════════════════════════════ */
.ev-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-left: 4px solid var(--card-accent);
    border-radius: .875rem;
    padding: 1.25rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: .875rem;
    transition: transform .18s, box-shadow .18s;
    position: relative;
    overflow: hidden;
}

.ev-card::before {
    content: '';
    position: absolute;
    top: 0; right: 0;
    width: 80px; height: 80px;
    background: var(--card-tint);
    border-radius: 0 .875rem 0 80px;
    opacity: .5;
    pointer-events: none;
}

.ev-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 28px rgba(0,0,0,.11);
    border-color: var(--card-accent);
}

.ev-card-head {
    display: flex;
    align-items: flex-start;
    gap: .75rem;
}

.ev-card-num {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: .5rem;
    background: var(--card-tint);
    color: var(--card-icon);
    font-size: .95rem;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.ev-card-head-text { flex: 1; min-width: 0; }

.ev-card-nombre {
    margin: 0;
    font-size: .975rem;
    font-weight: 700;
    color: var(--p-text-color);
    line-height: 1.3;
    text-wrap: balance;
}

.ev-card-desc {
    margin: .25rem 0 0;
    font-size: .78rem;
    color: var(--p-text-muted-color);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.45;
}

.ev-card-fecha {
    display: flex;
    align-items: center;
    gap: .4rem;
    font-size: .78rem;
    color: var(--p-text-muted-color);
    flex-wrap: wrap;
}

.vencido-pill {
    background: var(--sisa-tint-red);
    color: var(--sisa-icon-red);
    border-radius: 99px;
    padding: .1rem .45rem;
    font-size: .65rem;
    font-weight: 700;
}

/* Stats 2×2 */
.ev-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: .5rem;
}

.ev-stat {
    background: var(--p-content-hover-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: .5rem;
    padding: .5rem .625rem;
    display: flex;
    flex-direction: column;
    gap: .15rem;
}

.ev-stat--blue  { background: var(--sisa-tint-blue);  border-color: transparent; }
.ev-stat--amber { background: var(--sisa-tint-amber); border-color: transparent; }
.ev-stat--red   { background: var(--sisa-tint-red);   border-color: transparent; }

.ev-stat-num {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--p-text-color);
    line-height: 1;
    font-variant-numeric: tabular-nums;
}
.ev-stat-num em { font-size: .75rem; font-style: normal; color: var(--p-text-muted-color); font-weight: 500; }

.ev-stat--blue  .ev-stat-num { color: var(--sisa-icon-blue);  }
.ev-stat--amber .ev-stat-num { color: var(--sisa-icon-amber); }
.ev-stat--red   .ev-stat-num { color: var(--sisa-icon-red);   }

.ev-stat-lbl {
    font-size: .68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: var(--p-text-muted-color);
}

/* Progress track */
.ev-track-wrap {
    display: flex;
    align-items: center;
    gap: .625rem;
}

.ev-track {
    flex: 1;
    height: 5px;
    background: var(--p-content-border-color);
    border-radius: 99px;
    overflow: hidden;
}

.ev-track-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    border-radius: 99px;
    transition: width .4s ease;
}

.ev-track-pct {
    font-size: .72rem;
    font-weight: 700;
    color: var(--p-text-muted-color);
    font-variant-numeric: tabular-nums;
    min-width: 2.5rem;
    text-align: right;
}

.ev-card-cta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: .35rem;
    font-size: .78rem;
    font-weight: 700;
    color: var(--sisa-primary-l);
    opacity: 0;
    transition: opacity .2s;
}
.ev-card:hover .ev-card-cta { opacity: 1; }

/* ═══════════════════════════════════════
   CLASSROOM LAYOUT
═══════════════════════════════════════ */
.ev-classroom {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 1rem;
    height: calc(100vh - 185px);
    min-height: 520px;
}

/* ── Left panel ── */
.ev-students {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--p-content-border-color);
    border-radius: .875rem;
    background: var(--p-content-background);
    overflow: hidden;
}

.ev-students-head {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--p-content-background);
    border-bottom: 1px solid var(--p-content-border-color);
}

.ev-search-wrap {
    display: flex;
    align-items: center;
    gap: .5rem;
    padding: .75rem .875rem;
    border-bottom: 1px solid var(--p-content-border-color);
}

.ev-search-icon { font-size: .8rem; color: var(--p-text-muted-color); flex-shrink: 0; }

.ev-search-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: .85rem;
    color: var(--p-text-color);
    font-family: inherit;
}

.ev-search-clear {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--p-text-muted-color);
    padding: 0;
    font-size: .75rem;
    line-height: 1;
    transition: color .15s;
    font-family: inherit;
}
.ev-search-clear:hover { color: var(--sisa-icon-red); }

.ev-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
}

.ev-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .35rem;
    padding: .65rem .5rem;
    font-size: .75rem;
    font-weight: 600;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--p-text-muted-color);
    border-bottom: 2.5px solid transparent;
    transition: all .15s;
    font-family: inherit;
}

.ev-tab--active {
    color: var(--sisa-primary-l);
    border-bottom-color: var(--sisa-primary-l);
    background: var(--sisa-tint-blue);
}

.ev-tab-count {
    border-radius: 99px;
    padding: .05rem .4rem;
    font-size: .68rem;
    font-weight: 800;
    line-height: 1.6;
}
.ev-tab-count--green { background: var(--sisa-tint-green); color: var(--sisa-icon-green); }
.ev-tab-count--red   { background: var(--sisa-tint-red);   color: var(--sisa-icon-red);   }

.ev-student-list {
    flex: 1;
    overflow-y: auto;
}

.ev-student-list::-webkit-scrollbar { width: 4px; }
.ev-student-list::-webkit-scrollbar-thumb {
    background: var(--p-content-border-color);
    border-radius: 99px;
}

.ev-list-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: .5rem;
    padding: 2.5rem 1rem;
    font-size: .85rem;
    color: var(--p-text-muted-color);
}

.ev-student-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: .75rem;
    padding: .7rem .875rem;
    border: none;
    border-bottom: 1px solid var(--p-content-border-color);
    background: transparent;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background .12s;
}
.ev-student-row:hover    { background: var(--p-content-hover-background); }
.ev-student-row--active  {
    background: var(--sisa-accent-surface, #f0f7ff) !important;
    border-left: 3px solid var(--sisa-primary-l);
    padding-left: calc(.875rem - 3px);
}

.ev-av {
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    color: #fff;
    font-size: .8rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.ev-student-info { flex: 1; min-width: 0; }

.ev-student-name {
    margin: 0;
    font-size: .84rem;
    font-weight: 600;
    color: var(--p-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ev-student-meta {
    margin: .1rem 0 0;
    font-size: .72rem;
    color: var(--p-text-muted-color);
}

.ev-student-right { flex-shrink: 0; }

.ev-cal-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    font-size: .8rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
}
.cal-a { background: var(--sisa-tint-green); color: var(--sisa-icon-green); }
.cal-b { background: var(--sisa-tint-blue);  color: var(--sisa-icon-blue);  }
.cal-c { background: var(--sisa-tint-amber); color: var(--sisa-icon-amber); }
.cal-f { background: var(--sisa-tint-red);   color: var(--sisa-icon-red);   }

.ev-pending-dot { font-size: .8rem; color: var(--sisa-icon-amber); }

/* ── Right panel ── */
.ev-submission {
    border: 1px solid var(--p-content-border-color);
    border-radius: .875rem;
    background: var(--p-content-background);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.ev-submission::-webkit-scrollbar { width: 4px; }
.ev-submission::-webkit-scrollbar-thumb {
    background: var(--p-content-border-color);
    border-radius: 99px;
}

.ev-sub-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    flex: 1;
    padding: 3rem;
    color: var(--p-text-muted-color);
    font-size: .9rem;
}

.ev-sub-empty-icon {
    width: 4rem;
    height: 4rem;
    border-radius: 50%;
    border: 2px dashed var(--p-content-border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    opacity: .3;
}

.ev-sub-header {
    display: flex;
    align-items: center;
    gap: .875rem;
    padding: 1rem 1.25rem;
    background: linear-gradient(135deg, var(--sisa-tint-blue) 0%, var(--p-content-background) 80%);
    border-bottom: 1px solid var(--p-content-border-color);
    flex-shrink: 0;
}

.ev-sub-av {
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    color: #fff;
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(15,60,97,.25);
}

.ev-sub-header-text { flex: 1; min-width: 0; }

.ev-sub-nombre {
    margin: 0;
    font-size: .95rem;
    font-weight: 700;
    color: var(--p-text-color);
}

.ev-sub-meta {
    margin: .15rem 0 0;
    font-size: .78rem;
    color: var(--p-text-muted-color);
}

.ev-sub-envio {
    display: flex;
    align-items: center;
    gap: .375rem;
    font-size: .73rem;
    color: var(--p-text-muted-color);
    flex-shrink: 0;
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 99px;
    padding: .3rem .7rem;
    white-space: nowrap;
}

.ev-no-entry {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .625rem;
    padding: 3rem;
    font-size: .875rem;
    color: var(--p-text-muted-color);
}
.ev-no-entry i { font-size: 2rem; opacity: .2; }

.ev-sub-body {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
    padding: 1.25rem;
    flex: 1;
}

.ev-sub-section { display: flex; flex-direction: column; gap: .5rem; }

.ev-sub-label {
    display: flex;
    align-items: center;
    gap: .35rem;
    font-size: .72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--p-text-muted-color);
}

.ev-file-link {
    display: inline-flex;
    align-items: center;
    gap: .4rem;
    font-size: .875rem;
    font-weight: 600;
    color: var(--sisa-primary-l);
    text-decoration: none;
    padding: .625rem 1rem;
    border: 1px solid var(--p-content-border-color);
    border-radius: .5rem;
    width: fit-content;
    transition: all .15s;
}
.ev-file-link:hover {
    background: var(--sisa-tint-blue);
    border-color: var(--sisa-icon-blue);
    transform: translateY(-1px);
}

.ev-no-file { font-size: .85rem; color: var(--p-text-muted-color); }

.ev-grade-input-wrap {
    display: flex;
    gap: .625rem;
    align-items: flex-start;
}

.ev-grade-input { flex: 1; }

.ev-save-btn { flex-shrink: 0; align-self: stretch; }

.ev-obs-area { font-size: .85rem; border-radius: .5rem; }

/* Comments */
.ev-comments {
    background: var(--p-content-hover-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: .75rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: .75rem;
}

.ev-comments-head {
    display: flex;
    align-items: center;
    gap: .5rem;
}

.ev-comments-count {
    background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue);
    border-radius: 99px;
    padding: .05rem .45rem;
    font-size: .68rem;
    font-weight: 800;
    line-height: 1.6;
}

.ev-comments-state {
    display: flex;
    align-items: center;
    gap: .4rem;
    font-size: .82rem;
    color: var(--p-text-muted-color);
}

.ev-comments-list {
    display: flex;
    flex-direction: column;
    gap: .4rem;
    max-height: 200px;
    overflow-y: auto;
    padding-right: .25rem;
}

.ev-comments-list::-webkit-scrollbar { width: 3px; }
.ev-comments-list::-webkit-scrollbar-thumb {
    background: var(--p-content-border-color);
    border-radius: 99px;
}

.ev-comment {
    padding: .625rem .75rem;
    border-radius: .5rem;
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-left: 3px solid transparent;
}
.ev-comment--admin  { border-left-color: var(--sisa-primary-l); }
.ev-comment--alumno { border-left-color: var(--sisa-icon-green); }

.ev-comment-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .5rem;
    margin-bottom: .25rem;
}

.ev-comment-autor {
    display: flex;
    align-items: center;
    gap: .35rem;
    font-size: .75rem;
    font-weight: 700;
    color: var(--p-text-color);
}

.ev-comment-role-dot {
    width: .45rem;
    height: .45rem;
    border-radius: 50%;
    flex-shrink: 0;
}
.dot-admin  { background: var(--sisa-primary-l); }
.dot-alumno { background: var(--sisa-icon-green); }

.ev-comment-rol {
    padding: .1rem .4rem;
    border-radius: 99px;
    font-size: .65rem;
    font-weight: 600;
}
.rol-admin  { background: var(--sisa-tint-purple); color: var(--sisa-icon-purple); }
.rol-alumno { background: var(--sisa-tint-blue);   color: var(--sisa-icon-blue);   }

.ev-comment-actions {
    display: flex;
    align-items: center;
    gap: .25rem;
}

.ev-comment-fecha { font-size: .68rem; color: var(--p-text-muted-color); }

.ev-comment-del {
    border: none;
    background: none;
    cursor: pointer;
    color: var(--sisa-icon-red);
    padding: .1rem .25rem;
    border-radius: .25rem;
    font-size: .72rem;
    opacity: 0;
    transition: opacity .15s;
    font-family: inherit;
}
.ev-comment:hover .ev-comment-del { opacity: .7; }
.ev-comment-del:hover { opacity: 1 !important; }

.ev-comment-text {
    font-size: .82rem;
    color: var(--p-text-color);
    margin: 0;
    line-height: 1.45;
    white-space: pre-wrap;
}

.ev-comment-new {
    display: flex;
    flex-direction: column;
    gap: .5rem;
    border-top: 1px solid var(--p-content-border-color);
    padding-top: .75rem;
}

.ev-comment-ta { font-size: .82rem; border-radius: .5rem; }
.ev-send-btn   { align-self: flex-end; }

/* ═══════════════════════════════════════
   RESPONSIVE — TABLET
═══════════════════════════════════════ */
/* Botón back — oculto en desktop, visible en mobile */
.ev-back-btn {
    display: none;
    align-items: center;
    gap: .4rem;
    background: none;
    border: none;
    color: var(--sisa-primary-l);
    font-size: .875rem;
    font-weight: 600;
    cursor: pointer;
    padding: .75rem 1rem .25rem;
    transition: opacity .15s;
}
.ev-back-btn:hover { opacity: .7; }

@media (max-width: 960px) {
    .ev-classroom {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr;   /* solo un panel visible a la vez */
        height: calc(100dvh - 160px);
        min-height: unset;
    }

    /* Master-detail: ocultar el panel inactivo en mobile */
    .ev-panel--hidden-mobile {
        display: none !important;
    }

    /* El panel visible ocupa toda la altura */
    .ev-students,
    .ev-submission {
        max-height: none;
        min-height: none;
        height: 100%;
    }

    .ev-back-btn { display: flex; }
}

/* ═══════════════════════════════════════
   RESPONSIVE — MOBILE
═══════════════════════════════════════ */
@media (max-width: 640px) {
    .ev-page      { padding: 1rem; gap: 1rem; }
    .ev-header    { flex-direction: column; align-items: flex-start; }
    .ev-periodo-select { width: 100%; }
    .ev-cards-grid { grid-template-columns: 1fr; }

    .ev-header-title { flex-wrap: wrap; }

    .ev-students { max-height: none; }
    .ev-sub-header { flex-wrap: wrap; }
    .ev-sub-envio  { order: 3; flex-basis: 100%; justify-content: flex-start; }

    .ev-grade-input-wrap { flex-direction: column; }
    .ev-save-btn { width: 100%; }

    .ev-students { max-height: 320px; }
}
</style>
