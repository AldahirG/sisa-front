<script setup>
import { computed, onMounted, ref } from 'vue';
import api from '@/api/axios';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const toast   = useToast();
const estado  = ref('loading'); // loading | sin-encuesta | respondida | activa | error
const encuesta = ref(null);
const enviando = ref(false);

// Flat map: { [id_pregunta]: null | number | string | string[] }
const respuestas = ref({});

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Solo preguntas que están activas (activa !== false) y tienen texto.
// Filtra cualquier pregunta con soft-delete que el backend pueda devolver.
const preguntas = computed(() =>
    (encuesta.value?.preguntas ?? []).filter(
        (p) => p.activa !== false && p.texto?.trim()
    )
);

// IDs de preguntas visibles — el payload solo envía estas
const preguntasIds = computed(() => new Set(preguntas.value.map((p) => p.id_pregunta)));

// INC-18: skip-logic para apoyo económico
// Si "¿Recibiste apoyo económico?" = "No", ocultar preguntas de seguimiento
const apoyoEconId = computed(() =>
    preguntas.value.find(
        (p) => p.texto?.toLowerCase().includes('recibiste apoyo económico')
    )?.id_pregunta ?? null
);

const idsOcultasPorSkip = computed(() => {
    if (!apoyoEconId.value) return new Set();
    if (respuestas.value[apoyoEconId.value] !== 'No') return new Set();
    return new Set(
        preguntas.value
            .filter(
                (p) =>
                    p.id_pregunta !== apoyoEconId.value &&
                    p.texto?.toLowerCase().includes('apoyo económico')
            )
            .map((p) => p.id_pregunta)
    );
});

const preguntasVisibles = computed(() =>
    preguntas.value.filter((p) => !idsOcultasPorSkip.value.has(p.id_pregunta))
);

const totalPreguntas = computed(() => preguntasVisibles.value.length);

// Normaliza las opciones de una pregunta.
// Acepta CUALQUIER forma en que el backend pueda devolverlas:
//   opciones_escala: [{ valor, etiqueta }]   ← forma admin (GET /encuestas/:id)
//   opcionesEscala:  [{ valor, etiqueta }]   ← camelCase posible
//   opciones:        ['Sí','No']             ← strings planos
//   opciones:        [{ valor, etiqueta }]   ← objetos planos
const getOpciones = (pregunta) => {
    // 1. Intentar todos los posibles nombres de campo
    const raw = pregunta.opciones_escala
        ?? pregunta.opcionesEscala
        ?? pregunta.opciones
        ?? pregunta.options
        ?? null;

    if (!raw || !Array.isArray(raw) || raw.length === 0) return [];

    // 2. Normalizar cada elemento a { valor, etiqueta }
    return raw.map((o, i) => {
        if (o === null || o === undefined) return null;
        if (typeof o === 'object') {
            return {
                valor:    o.valor   ?? o.value ?? o.id    ?? i,
                etiqueta: o.etiqueta ?? o.label ?? o.nombre ?? o.name ?? String(o.valor ?? i)
            };
        }
        // string / number plano
        return { valor: i, etiqueta: String(o) };
    }).filter(Boolean);
};

const isAnswered = (p) => {
    // Autocompletado siempre cuenta como respondida (el backend la pre-rellena)
    if (p.tipo === 'autocompletado') return true;
    const r = respuestas.value[p.id_pregunta];
    if (p.tipo === 'texto_corto' || p.tipo === 'texto_largo' || p.tipo === 'texto') {
        return typeof r === 'string' && r.trim().length > 0;
    }
    if (p.tipo === 'opcion_multiple') {
        return Array.isArray(r) && r.length > 0;
    }
    return r !== null && r !== undefined && r !== '';
};

const respondidas = computed(() => preguntasVisibles.value.filter(isAnswered).length);

const pctProgreso = computed(() =>
    totalPreguntas.value ? Math.round((respondidas.value / totalPreguntas.value) * 100) : 0
);

const todasRespondidas = computed(() =>
    respondidas.value === totalPreguntas.value && totalPreguntas.value > 0
);

// El payload excluye las preguntas ocultas por skip-logic
const preguntasParaEnviar = computed(() =>
    preguntasVisibles.value.filter((p) => preguntasIds.value.has(p.id_pregunta))
);

// ─── Carga ────────────────────────────────────────────────────────────────────
async function cargarEncuesta() {
    estado.value = 'loading';
    try {
        const { data } = await api.get('/encuestas/mi-encuesta');
        encuesta.value = data;

        if (data.ya_respondida) {
            estado.value = 'respondida';
        } else {
            // encuesta.value ya está asignado arriba, el computed `preguntas`
            // filtra automáticamente las inactivas. Iteramos sobre ese computed.
            const init = {};
            // Accedemos directamente al array raw para inicializar antes de que
            // el computed reactive se actualice en el mismo tick.
            const activas = (data.preguntas ?? []).filter(
                (p) => p.activa !== false && p.texto?.trim()
            );
            activas.forEach((p) => {
                if (p.tipo === 'autocompletado') {
                    // El backend pre-rellena desde el perfil del alumno
                    init[p.id_pregunta] = p.valor_auto ?? p.respuesta_previa ?? p.valor ?? p.valor_defecto ?? '';
                } else if (p.tipo === 'escala' || p.tipo === 'opcion_unica') {
                    init[p.id_pregunta] = null;
                } else if (p.tipo === 'opcion_multiple') {
                    init[p.id_pregunta] = [];
                } else {
                    init[p.id_pregunta] = '';
                }
            });
            respuestas.value = init;
            estado.value = 'activa';
        }
    } catch (err) {
        if (err.response?.status === 404) {
            estado.value = 'sin-encuesta';
        } else {
            estado.value = 'error';
        }
    }
}

// ─── Enviar ───────────────────────────────────────────────────────────────────
async function enviarRespuestas() {
    if (!todasRespondidas.value) {
        toast.add({
            severity: 'warn',
            summary: 'Incompleto',
            detail: 'Por favor responde todas las preguntas antes de enviar.',
            life: 4000
        });
        return;
    }
    enviando.value = true;
    try {
        // Solo enviar las preguntas visibles (activas). Excluye cualquier ID
        // que el backend haya soft-deleted y que no esté en la vista actual.
        const payload = {
            respuestas: preguntasParaEnviar.value
                .map((p) => {
                    const val = respuestas.value[p.id_pregunta];
                    if (p.tipo === 'escala') {
                        return { id_pregunta: p.id_pregunta, valor_escala: val };
                    }
                    if (p.tipo === 'opcion_multiple') {
                        return { id_pregunta: p.id_pregunta, texto: Array.isArray(val) ? val.join(', ') : String(val ?? '') };
                    }
                    // texto_corto, texto_largo, texto, opcion_unica, autocompletado
                    return { id_pregunta: p.id_pregunta, texto: String(val ?? '') };
                })
        };
        await api.post('/encuestas/responder', payload);
        toast.add({
            severity: 'success',
            summary: '¡Enviada!',
            detail: 'Tu encuesta fue registrada correctamente.',
            life: 4000
        });
        estado.value = 'respondida';
    } catch (err) {
        const msg = err.response?.data?.message ?? 'No se pudo enviar la encuesta. Intenta de nuevo.';
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 });
    } finally {
        enviando.value = false;
    }
}

// ─── Selección de opcion_unica: guarda etiqueta como texto ────────────────────
function seleccionarOpcion(id_pregunta, etiqueta) {
    respuestas.value[id_pregunta] = etiqueta;
}

// ─── Selección de escala: guarda valor numérico ───────────────────────────────
function seleccionarEscala(id_pregunta, valor) {
    respuestas.value[id_pregunta] = valor;
}

// ─── Toggle de opcion_multiple: agrega / quita etiqueta del array ─────────────
function toggleMultiple(id_pregunta, etiqueta) {
    const arr = respuestas.value[id_pregunta];
    if (!Array.isArray(arr)) { respuestas.value[id_pregunta] = [etiqueta]; return; }
    const idx = arr.indexOf(etiqueta);
    if (idx === -1) arr.push(etiqueta);
    else arr.splice(idx, 1);
}

function isMultipleChecked(id_pregunta, etiqueta) {
    const arr = respuestas.value[id_pregunta];
    return Array.isArray(arr) && arr.includes(etiqueta);
}

onMounted(cargarEncuesta);
</script>

<template>
    <Toast />

    <!-- ───── LOADING ───── -->
    <div v-if="estado === 'loading'" class="enc-center">
        <i class="pi pi-spin pi-spinner enc-spinner"></i>
        <p class="enc-hint">Cargando encuesta…</p>
    </div>

    <!-- ───── ERROR ───── -->
    <div v-else-if="estado === 'error'" class="enc-center">
        <div class="enc-empty-icon enc-icon-red"><i class="pi pi-exclamation-triangle"></i></div>
        <h3 class="enc-empty-title">Ocurrió un error</h3>
        <p class="enc-hint">No se pudo cargar la encuesta. Verifica tu conexión.</p>
        <Button label="Reintentar" icon="pi pi-refresh" @click="cargarEncuesta" outlined />
    </div>

    <!-- ───── SIN ENCUESTA ACTIVA ───── -->
    <div v-else-if="estado === 'sin-encuesta'" class="enc-center">
        <div class="enc-empty-icon enc-icon-blue"><i class="pi pi-clipboard"></i></div>
        <h3 class="enc-empty-title">No hay encuesta disponible</h3>
        <p class="enc-hint">En este momento no hay ninguna encuesta activa.<br>Vuelve más tarde.</p>
    </div>

    <!-- ───── YA RESPONDIDA ───── -->
    <div v-else-if="estado === 'respondida'" class="enc-center">
        <div class="enc-empty-icon enc-icon-green"><i class="pi pi-check-circle"></i></div>
        <h3 class="enc-empty-title">¡Gracias por participar!</h3>
        <p class="enc-hint">
            Ya enviaste tus respuestas para <strong>{{ encuesta?.nombre }}</strong>.<br>
            <span v-if="encuesta?.fecha_respondida" style="font-size:0.8rem">
                Respondida el {{ new Date(encuesta.fecha_respondida).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) }}
            </span>
        </p>
    </div>

    <!-- ───── FORMULARIO ACTIVO ───── -->
    <div v-else-if="estado === 'activa'" class="enc-wrap">

        <!-- Barra de progreso sticky -->
        <div class="enc-progress-sticky">
            <div class="enc-progress-inner">
                <div class="enc-progress-text">
                    <span class="enc-progress-count">{{ respondidas }}/{{ totalPreguntas }}</span>
                    <span class="enc-progress-label">preguntas respondidas</span>
                </div>
                <div class="enc-progress-bar-bg">
                    <div
                        class="enc-progress-bar-fill"
                        :style="{ width: pctProgreso + '%' }"
                        :class="{ 'enc-progress-done': todasRespondidas }"
                    ></div>
                </div>
                <span class="enc-progress-pct" :class="{ 'enc-pct-done': todasRespondidas }">
                    {{ pctProgreso }}%
                </span>
            </div>
        </div>

        <!-- Cabecera de la encuesta -->
        <div class="enc-header-card">
            <span class="enc-header-badge">
                <i class="pi pi-clipboard"></i>
                Encuesta activa · {{ encuesta.periodo?.nombre }}
            </span>
            <h1 class="enc-header-title">{{ encuesta.nombre }}</h1>
            <p v-if="encuesta.descripcion" class="enc-header-desc">{{ encuesta.descripcion }}</p>
            <p v-else class="enc-header-desc">Responde todas las preguntas para completar la encuesta.</p>
        </div>

        <!-- Lista de preguntas — una tarjeta por pregunta -->
        <div class="enc-questions">
            <div
                v-for="(pregunta, idx) in preguntasVisibles"
                :key="pregunta.id_pregunta"
                class="enc-question-card"
                :class="{ 'enc-card-answered': isAnswered(pregunta) }"
            >
                <!-- Cabecera de la pregunta -->
                <div class="enc-q-header">
                    <span class="enc-q-num">{{ idx + 1 }}</span>
                    <p class="enc-q-text">
                        {{ pregunta.texto }}
                        <span class="enc-q-required" title="Requerida">*</span>
                    </p>
                    <span v-if="isAnswered(pregunta)" class="enc-q-check">
                        <i class="pi pi-check-circle"></i>
                    </span>
                </div>

                <!-- ── Texto corto ── -->
                <div v-if="pregunta.tipo === 'texto_corto'" class="enc-q-body">
                    <InputText
                        v-model="respuestas[pregunta.id_pregunta]"
                        placeholder="Tu respuesta…"
                        class="enc-input-text"
                    />
                </div>

                <!-- ── Texto largo / texto (legacy) ── -->
                <div v-else-if="pregunta.tipo === 'texto_largo' || pregunta.tipo === 'texto'" class="enc-q-body">
                    <Textarea
                        v-model="respuestas[pregunta.id_pregunta]"
                        placeholder="Tu respuesta…"
                        rows="3"
                        autoResize
                        class="enc-textarea"
                    />
                </div>

                <!-- ── Opción única (radio vertical) ── -->
                <div v-else-if="pregunta.tipo === 'opcion_unica'" class="enc-q-body">
                    <div v-if="getOpciones(pregunta).length" class="enc-radio-group enc-radio-vertical">
                        <label
                            v-for="op in getOpciones(pregunta)"
                            :key="op.valor"
                            class="enc-radio-option"
                            :class="{ 'enc-radio-selected': respuestas[pregunta.id_pregunta] === op.etiqueta }"
                            @click="seleccionarOpcion(pregunta.id_pregunta, op.etiqueta)"
                        >
                            <span class="enc-radio-circle-wrap">
                                <input
                                    type="radio"
                                    :name="`p${pregunta.id_pregunta}`"
                                    :value="op.etiqueta"
                                    v-model="respuestas[pregunta.id_pregunta]"
                                    class="enc-radio-input"
                                />
                                <span class="enc-radio-circle"></span>
                            </span>
                            <span class="enc-radio-label-text">{{ op.etiqueta }}</span>
                        </label>
                    </div>
                    <p v-else class="enc-no-opciones">Esta pregunta no tiene opciones configuradas.</p>
                </div>

                <!-- ── Opción múltiple (checkboxes verticales) ── -->
                <div v-else-if="pregunta.tipo === 'opcion_multiple'" class="enc-q-body">
                    <div v-if="getOpciones(pregunta).length" class="enc-check-group">
                        <label
                            v-for="op in getOpciones(pregunta)"
                            :key="op.valor"
                            class="enc-check-option"
                            :class="{ 'enc-check-selected': isMultipleChecked(pregunta.id_pregunta, op.etiqueta) }"
                            @click.prevent="toggleMultiple(pregunta.id_pregunta, op.etiqueta)"
                        >
                            <span class="enc-check-box-wrap">
                                <input
                                    type="checkbox"
                                    :value="op.etiqueta"
                                    :checked="isMultipleChecked(pregunta.id_pregunta, op.etiqueta)"
                                    class="enc-check-input"
                                    @change.prevent
                                />
                                <span class="enc-check-box">
                                    <i v-if="isMultipleChecked(pregunta.id_pregunta, op.etiqueta)" class="pi pi-check enc-check-mark"></i>
                                </span>
                            </span>
                            <span class="enc-check-label-text">{{ op.etiqueta }}</span>
                        </label>
                    </div>
                    <p v-else class="enc-no-opciones">Esta pregunta no tiene opciones configuradas.</p>
                </div>

                <!-- ── Autocompletado (prefilled, solo lectura) ── -->
                <div v-else-if="pregunta.tipo === 'autocompletado'" class="enc-q-body">
                    <InputText
                        :value="respuestas[pregunta.id_pregunta]"
                        class="enc-input-text enc-input-readonly"
                        readonly
                        placeholder="Se completa automáticamente con tu perfil"
                    />
                </div>

                <!-- ── Escala (radio horizontal con opciones_escala o default) ── -->
                <div v-else-if="pregunta.tipo === 'escala'" class="enc-q-body">
                    <div class="enc-radio-group enc-radio-horizontal">
                        <label
                            v-for="op in (pregunta.opciones_escala ?? [{ valor: 1, etiqueta: 'Malo' }, { valor: 2, etiqueta: 'Regular' }, { valor: 3, etiqueta: 'Bueno' }, { valor: 4, etiqueta: 'Excelente' }])"
                            :key="op.valor"
                            class="enc-radio-option enc-radio-col"
                            :class="{ 'enc-radio-selected': respuestas[pregunta.id_pregunta] === op.valor }"
                            @click="seleccionarEscala(pregunta.id_pregunta, op.valor)"
                        >
                            <span class="enc-radio-circle-wrap">
                                <input
                                    type="radio"
                                    :name="`p${pregunta.id_pregunta}`"
                                    :value="op.valor"
                                    v-model="respuestas[pregunta.id_pregunta]"
                                    class="enc-radio-input"
                                />
                                <span class="enc-radio-circle"></span>
                            </span>
                            <span class="enc-radio-label-text enc-scale-label" :class="'enc-scale-' + op.etiqueta.toLowerCase()">{{ op.etiqueta }}</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer con botón de envío -->
        <div class="enc-footer">
            <div class="enc-footer-info">
                <template v-if="todasRespondidas">
                    <i class="pi pi-check-circle enc-footer-icon-ok"></i>
                    <span class="enc-footer-done">¡Todas las preguntas respondidas! Ya puedes enviar.</span>
                </template>
                <template v-else>
                    <i class="pi pi-info-circle enc-footer-icon-info"></i>
                    <span>Faltan {{ totalPreguntas - respondidas }} pregunta{{ totalPreguntas - respondidas !== 1 ? 's' : '' }} por responder.</span>
                </template>
            </div>
            <Button
                label="Enviar encuesta"
                icon="pi pi-send"
                :loading="enviando"
                :disabled="!todasRespondidas || enviando"
                @click="enviarRespuestas"
                class="enc-submit-btn"
            />
        </div>

    </div>
</template>

<style scoped>
/* ── Layout principal ────────────────────────────────── */
.enc-wrap {
    max-width: 720px;
    margin: 0 auto;
    padding: 0 1rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* ── Estado vacío / centro ───────────────────────────── */
.enc-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 0.75rem;
    text-align: center;
    padding: 2rem;
}
.enc-spinner { font-size: 2.5rem; color: var(--sisa-primary-l); }
.enc-empty-icon {
    width: 72px; height: 72px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 2rem; margin-bottom: 0.5rem;
}
.enc-icon-blue  { background: var(--sisa-tint-blue);  color: var(--sisa-icon-blue);  }
.enc-icon-green { background: var(--sisa-tint-green); color: var(--sisa-icon-green); }
.enc-icon-red   { background: var(--sisa-tint-red);   color: var(--sisa-icon-red);   }
.enc-empty-title { font-size: 1.25rem; font-weight: 700; color: var(--text-color); margin: 0; }
.enc-hint { color: var(--text-color-secondary); font-size: 0.9rem; margin: 0; line-height: 1.6; }

/* ── Barra de progreso sticky ────────────────────────── */
.enc-progress-sticky {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--surface-card);
    border-bottom: 1px solid var(--sisa-border);
    padding: 0.625rem 1rem;
    margin: 0 -1rem;
}
.enc-progress-inner {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 0.875rem;
}
.enc-progress-text { display: flex; align-items: baseline; gap: 0.35rem; flex-shrink: 0; }
.enc-progress-count { font-size: 1rem; font-weight: 700; color: var(--sisa-primary-l); }
.enc-progress-label { font-size: 0.72rem; color: var(--text-color-secondary); }
.enc-progress-bar-bg {
    flex: 1;
    height: 6px;
    background: var(--surface-border);
    border-radius: 3px;
    overflow: hidden;
}
.enc-progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--sisa-primary-l), #42a5f5);
    border-radius: 3px;
    transition: width 0.35s ease;
}
.enc-progress-bar-fill.enc-progress-done {
    background: linear-gradient(90deg, var(--sisa-icon-green), #22c55e);
}
.enc-progress-pct { font-size: 0.8rem; font-weight: 600; color: var(--sisa-primary-l); flex-shrink: 0; }
.enc-pct-done { color: var(--sisa-icon-green); }

/* ── Cabecera ────────────────────────────────────────── */
.enc-header-card {
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 12px;
    padding: 1.5rem;
    margin-top: 1rem;
    border-top: 4px solid var(--sisa-primary-l);
}
.enc-header-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--sisa-icon-blue);
    background: var(--sisa-tint-blue);
    padding: 0.25rem 0.65rem;
    border-radius: 99px;
    margin-bottom: 0.75rem;
}
.enc-header-title { font-size: 1.35rem; font-weight: 700; color: var(--text-color); margin: 0 0 0.4rem; }
.enc-header-desc { font-size: 0.875rem; color: var(--text-color-secondary); margin: 0; line-height: 1.6; }

/* ── Tarjetas de preguntas ───────────────────────────── */
.enc-questions { display: flex; flex-direction: column; gap: 0.875rem; }

.enc-question-card {
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    transition: border-color 0.2s, box-shadow 0.2s;
}
.enc-question-card:focus-within {
    border-color: var(--sisa-primary-l);
    box-shadow: 0 0 0 3px var(--sisa-active-bg);
}
.enc-card-answered {
    border-color: var(--sisa-icon-green);
    background: var(--sisa-accent-surface);
}
.enc-card-answered:focus-within {
    border-color: var(--sisa-icon-green);
    box-shadow: 0 0 0 3px var(--sisa-tint-green);
}

/* Cabecera de cada pregunta */
.enc-q-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
}
.enc-q-num {
    flex-shrink: 0;
    width: 26px; height: 26px;
    border-radius: 50%;
    background: var(--sisa-tint-blue);
    color: var(--sisa-icon-blue);
    font-size: 0.75rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    margin-top: 0.1rem;
}
.enc-q-text {
    flex: 1;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-color);
    line-height: 1.5;
    margin: 0;
}
.enc-q-required {
    color: #ef4444;
    font-weight: 700;
    margin-left: 0.2rem;
}
.enc-q-check {
    flex-shrink: 0;
    font-size: 1.1rem;
    color: var(--sisa-icon-green);
    margin-top: 0.05rem;
}

/* Cuerpo de la pregunta */
.enc-q-body { padding-left: 2.25rem; }

/* Input texto corto */
.enc-input-text { width: 100%; font-size: 0.9rem; }

/* Textarea */
.enc-textarea { width: 100%; font-size: 0.9rem; }

/* ── Radio groups ───────────────────────────────────── */
.enc-radio-group { display: flex; }

/* Vertical (opcion_unica) */
.enc-radio-vertical { flex-direction: column; gap: 0.5rem; }

/* Horizontal (escala) */
.enc-radio-horizontal {
    flex-direction: row;
    gap: 0.625rem;
    flex-wrap: wrap;
}

.enc-radio-option {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    cursor: pointer;
    border-radius: 8px;
    border: 1px solid var(--sisa-border);
    padding: 0.5rem 0.875rem;
    background: var(--surface-card);
    transition: border-color 0.15s, background 0.15s;
    user-select: none;
}
.enc-radio-option:hover {
    border-color: var(--sisa-primary-l);
    background: var(--sisa-active-bg);
}
.enc-radio-selected {
    border-color: var(--sisa-primary-l);
    background: var(--sisa-active-bg);
}

/* Columna para escala horizontal */
.enc-radio-col {
    flex: 1;
    min-width: 80px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.75rem 0.5rem;
    text-align: center;
}

/* Radio personalizado */
.enc-radio-circle-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.enc-radio-input { position: absolute; opacity: 0; width: 0; height: 0; }
.enc-radio-circle {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid var(--surface-border);
    background: var(--surface-card);
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s, background 0.15s;
    position: relative;
}
.enc-radio-circle::after {
    content: '';
    width: 9px; height: 9px; border-radius: 50%;
    background: var(--sisa-primary-l);
    opacity: 0; transform: scale(0.4);
    transition: opacity 0.15s, transform 0.15s;
}
.enc-radio-input:checked ~ .enc-radio-circle {
    border-color: var(--sisa-primary-l);
    background: var(--sisa-active-bg);
}
.enc-radio-input:checked ~ .enc-radio-circle::after { opacity: 1; transform: scale(1); }
.enc-radio-option:hover .enc-radio-circle { border-color: var(--sisa-primary-l); }

.enc-radio-label-text {
    font-size: 0.875rem;
    color: var(--text-color);
    font-weight: 500;
}

/* Sin opciones configuradas */
.enc-no-opciones {
    font-size: 0.8rem; color: var(--text-color-secondary);
    font-style: italic; margin: 0;
    padding: 0.5rem 0;
}

/* Input readonly (autocompletado) */
.enc-input-readonly {
    background: var(--surface-ground) !important;
    color: var(--text-color-secondary) !important;
    cursor: default !important;
}

/* ── Checkboxes (opcion_multiple) ───────────────────────── */
.enc-check-group { display: flex; flex-direction: column; gap: 0.5rem; }

.enc-check-option {
    display: flex; align-items: center; gap: 0.625rem;
    cursor: pointer; border-radius: 8px;
    border: 1px solid var(--sisa-border);
    padding: 0.5rem 0.875rem;
    background: var(--surface-card);
    transition: border-color 0.15s, background 0.15s;
    user-select: none;
}
.enc-check-option:hover {
    border-color: var(--sisa-primary-l);
    background: var(--sisa-active-bg);
}
.enc-check-selected {
    border-color: var(--sisa-primary-l);
    background: var(--sisa-active-bg);
}

.enc-check-box-wrap {
    position: relative; display: inline-flex;
    align-items: center; justify-content: center; flex-shrink: 0;
}
.enc-check-input { position: absolute; opacity: 0; width: 0; height: 0; }
.enc-check-box {
    width: 20px; height: 20px; border-radius: 5px;
    border: 2px solid var(--surface-border);
    background: var(--surface-card);
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s, background 0.15s;
}
.enc-check-selected .enc-check-box {
    border-color: var(--sisa-primary-l);
    background: var(--sisa-primary-l);
}
.enc-check-mark {
    font-size: 0.65rem; color: #fff; font-weight: 900;
}
.enc-check-label-text {
    font-size: 0.875rem; color: var(--text-color); font-weight: 500;
}

/* Colores de etiqueta de escala */
.enc-scale-label { font-size: 0.75rem; font-weight: 600; }
.enc-scale-malo      { color: var(--sisa-icon-red);   }
.enc-scale-regular   { color: var(--sisa-icon-amber); }
.enc-scale-bueno     { color: var(--sisa-icon-blue);  }
.enc-scale-excelente { color: var(--sisa-icon-green); }

/* ── Footer ──────────────────────────────────────────── */
.enc-footer {
    position: sticky;
    bottom: 0;
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.06);
    z-index: 5;
}
.enc-footer-info {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.875rem; color: var(--text-color-secondary);
}
.enc-footer-icon-ok   { color: var(--sisa-icon-green); font-size: 1rem; }
.enc-footer-icon-info { color: var(--sisa-icon-blue);  font-size: 1rem; }
.enc-footer-done { color: var(--sisa-icon-green); font-weight: 600; }
.enc-submit-btn {
    background: var(--sisa-primary) !important;
    border-color: var(--sisa-primary) !important;
    color: #fff !important;
    font-weight: 600;
    padding: 0.6rem 1.5rem;
}
.enc-submit-btn:not(:disabled):hover {
    background: var(--sisa-primary-l) !important;
    border-color: var(--sisa-primary-l) !important;
}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 600px) {
    .enc-wrap { padding: 0 0.5rem 5rem; }
    .enc-header-card { padding: 1.25rem 1rem; }
    .enc-question-card { padding: 1rem; }
    .enc-q-body { padding-left: 0; }
    .enc-radio-horizontal { gap: 0.4rem; }
    .enc-radio-col { min-width: 60px; padding: 0.625rem 0.25rem; }
    .enc-footer { flex-direction: column; align-items: stretch; border-radius: 0; position: fixed; bottom: 0; left: 0; right: 0; margin: 0; }
    .enc-submit-btn { width: 100%; justify-content: center; }
    .enc-progress-sticky { margin: 0; }
}
</style>
