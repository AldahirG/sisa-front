<script setup>
import api from '@/api/axios';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import ConfirmDialog from 'primevue/confirmdialog';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import Toast from 'primevue/toast';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from '@/composables/useAppToast';

const toast   = useToast();
const confirm = useConfirm();
const route   = useRoute();
const router  = useRouter();

// periodoId desde la ruta — null cuando se accede sin param (modo hub)
const periodoId = computed(() =>
    route.params?.periodoId ? +route.params.periodoId : null
);

// ════════════════════════════════
// CONSTANTS
// ════════════════════════════════
const TIPO_CONFIG = {
    'texto_corto':     { label: 'Texto corto',       icon: 'pi pi-minus',        badgeClass: 'tipo-texto'        },
    'texto_largo':     { label: 'Texto largo',        icon: 'pi pi-align-left',   badgeClass: 'tipo-texto'        },
    'texto':           { label: 'Texto',              icon: 'pi pi-align-left',   badgeClass: 'tipo-texto'        },
    'opcion_unica':    { label: 'Opción única',       icon: 'pi pi-list',         badgeClass: 'tipo-opcion'       },
    'opcion_multiple': { label: 'Opción múltiple',    icon: 'pi pi-check-square', badgeClass: 'tipo-opcion'       },
    'escala':          { label: 'Escala',             icon: 'pi pi-chart-bar',    badgeClass: 'tipo-escala'       },
    'autocompletado':  { label: 'Autocompletado',     icon: 'pi pi-user',         badgeClass: 'tipo-auto'         },
};

const PLANTILLA_PREGUNTAS = [
    { texto: 'Matrícula', tipo: 'texto_corto' },
    { texto: 'Carrera', tipo: 'texto_largo' },
    { texto: 'Semestre', tipo: 'texto_largo' },
    { texto: 'Nombre de la empresa', tipo: 'texto_largo' },
    { texto: 'Nombre de tu jefe directo', tipo: 'texto_largo' },
    { texto: '¿Tuviste un proyecto asignado?', tipo: 'opcion_unica', opciones: ['Sí', 'No'] },
    { texto: 'Nombre de tu proyecto', tipo: 'texto_largo' },
    { texto: '¿Tu proyecto fue empleado o se empleará en un futuro en la empresa?', tipo: 'opcion_unica', opciones: ['Sí', 'No'] },
    { texto: '¿Te sentiste cómodo en la empresa?', tipo: 'opcion_unica', opciones: ['Sí', 'No'] },
    { texto: '1 siendo bajo y 5 siendo alto, ¿cómo calificarías a la empresa en general?', tipo: 'opcion_unica', opciones: ['1', '2', '3', '4', '5'] },
    { texto: '¿Te gustaría regresar a la empresa?', tipo: 'opcion_unica', opciones: ['Sí', 'No'] },
    { texto: '¿Recomendarías que se mandaran más vinculados a realizar sus prácticas a la empresa?', tipo: 'opcion_unica', opciones: ['Sí', 'No'] },
    { texto: '¿Tus actividades estuvieron relacionadas a tu carrera?', tipo: 'opcion_unica', opciones: ['Sí', 'No'] },
    { texto: '¿Recibiste apoyo económico?', tipo: 'opcion_unica', opciones: ['Sí', 'No'] },
    { texto: '¿Por qué? (apoyo económico)', tipo: 'texto_largo' },
    { texto: '¿Cuánto? (semanal)', tipo: 'opcion_unica', opciones: ['$500', '$1,000', '$1,500', 'Más'] },
    { texto: 'Comentarios', tipo: 'texto_largo' },
    { texto: '¿Qué conferencia te ha gustado más?', tipo: 'texto_largo' },
    { texto: '¿Qué tema te gustaría ver en las conferencias?', tipo: 'texto_largo' },
    { texto: '¿Qué te pareció el servicio brindado por el Dpto de Enlace Profesional?', tipo: 'opcion_unica', opciones: ['Excelente', 'Bueno', 'Regular'] },
    { texto: '¿Por qué? (servicio DEP)', tipo: 'texto_largo' },
    { texto: '¿A lo largo del semestre tuviste dificultades para completar exitosamente la materia de Vinculación?', tipo: 'opcion_unica', opciones: ['Sí', 'No'] },
    { texto: '¿Por qué? (dificultades)', tipo: 'texto_largo' },
    { texto: '¿Consideras que la materia de vinculación ayuda a tu crecimiento laboral y personal?', tipo: 'texto_corto' },
];

// ════════════════════════════════
// STATE
// ════════════════════════════════
const loading          = ref(true);
const loadingPlantilla = ref(false);
const encuestas        = ref([]);
const selected         = ref(null);
const periodos         = ref([]);
const filtroPeriodoList = ref(null);  // null = mostrar todas

// Dialogs
const showCreateDialog      = ref(false);
const showEditEncDialog     = ref(false);
const showAddPregDialog     = ref(false);
const showEditPregDialog    = ref(false);
const showDuplicateDialog   = ref(false);
const showDeleteDialog      = ref(false);
const showPlantillaDialog   = ref(false);

// Edit encuesta form
const editEncForm = ref({ nombre: '', descripcion: '', tiene_calificacion: false, id_periodo: null });

// Forms
const newEncuesta  = ref({ nombre: '', descripcion: '', id_periodo: null, tiene_calificacion: false });
const newPregunta  = ref({ texto: '', tipo: 'texto_corto', campo_auto: '', requerida: true, condicion_pregunta_id: null, condicion_respuesta: '' });
const newOpciones  = ref(['']);
const editPregunta = ref({ id_pregunta: null, texto: '', orden: 0, peso: 1, requerida: true, condicion_pregunta_id: null, condicion_respuesta: '' });
const dupForm      = ref({ nombre: '', id_periodo_destino: null });

const saving = ref(false);

// ════════════════════════════════
// RESPUESTAS
// ════════════════════════════════
const activeTab         = ref('preguntas'); // 'preguntas' | 'respuestas'
const loadingRespuestas = ref(false);
const respRespondieron  = ref([]);
const respPendientes    = ref([]);
const respTotales       = ref({ total_asignados: 0, total_respondieron: 0, total_pendientes: 0 });
const expandedResp      = ref(null);
const respFilter        = ref('todos');  // 'todos' | 'respondieron' | 'pendientes'
const respSearch        = ref('');
const filterEmpresaId   = ref(null);    // filtro por empresa (select)

// ── Paginación local ──────────────────────────────────────────────────────────
const PAGE_SIZE       = 20;
const respPageResp    = ref(1);   // página actual para "respondieron"
const respPagePend    = ref(1);   // página actual para "pendientes"

// ── Detalle individual alumno ─────────────────────────────────────────────────
const showAlumnoDialog    = ref(false);
const loadingAlumnoDetalle = ref(false);
const alumnoDetalle        = ref(null);  // respuesta completa del alumno seleccionado

const verDetalleAlumno = async (r) => {
    const alumnoId = r.alumno?.id_usuario ?? r.alumno?.id ?? r.id_usuario ?? r.id_alumno;
    if (!alumnoId || !selected.value) return;
    loadingAlumnoDetalle.value = true;
    showAlumnoDialog.value     = true;
    alumnoDetalle.value        = null;
    try {
        const { data } = await api.get(`/encuestas/${selected.value.id_encuesta}/respuestas-alumno/${alumnoId}`);
        alumnoDetalle.value = data;
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el detalle del alumno.', life: 4000 });
        showAlumnoDialog.value = false;
    } finally {
        loadingAlumnoDetalle.value = false;
    }
};

// ── Carga principal ───────────────────────────────────────────────────────────
const loadRespuestas = async (id, params = {}) => {
    loadingRespuestas.value = true;
    respRespondieron.value  = [];
    respPendientes.value    = [];
    expandedResp.value      = null;

    // Construir query string con los filtros activos
    const query = new URLSearchParams();
    if (params.alumnoId)  query.set('alumnoId',  params.alumnoId);
    if (params.empresaId) query.set('empresaId', params.empresaId);
    const qs = query.toString() ? `?${query}` : '';

    try {
        const { data } = await api.get(`/encuestas/${id}/respuestas-detalle${qs}`);

        // ── Helper: busca un array por múltiples nombres de campo ──────────
        const pickArr = (obj, ...keys) => {
            for (const k of keys) {
                if (Array.isArray(obj[k])) return obj[k];
            }
            // Último recurso: primer array del objeto que tenga objetos con info de alumno
            const fallback = Object.values(obj).find(
                (v) => Array.isArray(v) && v.length > 0 && v[0] && typeof v[0] === 'object'
                     && (v[0].alumno != null || v[0].nombre != null || v[0].matricula != null || v[0].id_usuario != null)
            );
            return fallback ?? [];
        };

        if (Array.isArray(data)) {
            respRespondieron.value = data;
            respTotales.value = {
                total_asignados:    data.length,
                total_respondieron: data.length,
                total_pendientes:   0
            };
        } else if (data && typeof data === 'object') {
            // Intenta todos los nombres de campo posibles para el array de respondieron
            // 'detalle' es el nombre confirmado por el backend actual
            respRespondieron.value = pickArr(data,
                'detalle', 'respondieron', 'respuestas', 'alumnos_respondieron',
                'encuestados', 'completados', 'alumnos', 'data', 'items', 'results'
            );
            // Para pendientes: nombres de campo más comunes
            respPendientes.value = pickArr(data,
                'pendientes', 'sin_responder', 'alumnos_pendientes',
                'no_respondieron', 'faltantes', 'sin_contestar'
            );
            // Si pendientes vino en el mismo array de respondieron por error, limpiar
            if (respPendientes.value === respRespondieron.value) {
                respPendientes.value = [];
            }
            respTotales.value = {
                total_asignados:    data.total_asignados    ?? respRespondieron.value.length + respPendientes.value.length,
                total_respondieron: data.total_respondieron ?? respRespondieron.value.length,
                total_pendientes:   data.total_pendientes   ?? respPendientes.value.length
            };

        }
    } catch (e) {
        toast.add({
            severity: 'error', summary: 'Error',
            detail: e.response?.data?.message || 'No se pudieron cargar las respuestas.',
            life: 4000
        });
    } finally {
        loadingRespuestas.value = false;
    }
};

// Recarga aplicando los filtros activos
const reloadConFiltros = () => {
    if (!selected.value) return;
    loadRespuestas(selected.value.id_encuesta, {
        empresaId: filterEmpresaId.value ?? undefined
    });
};

const switchTab = async (tab) => {
    activeTab.value    = tab;
    respFilter.value   = 'todos';
    respSearch.value   = '';
    filterEmpresaId.value = null;
    expandedResp.value = null;
    if (tab === 'respuestas' && selected.value) {
        await loadRespuestas(selected.value.id_encuesta);
    }
};

// ── Métricas — usa los totales que devuelve el API cuando están disponibles ───
const totalRespondieron = computed(() => respTotales.value.total_respondieron);
const totalPendientes   = computed(() => respTotales.value.total_pendientes);
const totalAlumnos      = computed(() => respTotales.value.total_asignados || (totalRespondieron.value + totalPendientes.value));
const pctRespuestas     = computed(() =>
    totalAlumnos.value ? Math.round((totalRespondieron.value / totalAlumnos.value) * 100) : 0
);

// ── Lista de empresas presentes en los datos (para el selector) ───────────────
const empresasEnRespuestas = computed(() => {
    const map = new Map();
    [...respRespondieron.value, ...respPendientes.value].forEach((r) => {
        const id  = r.empresa?.id_empresa ?? r.id_empresa ?? null;
        const nom = r.empresa?.nombre ?? (typeof r.empresa === 'string' ? r.empresa : null) ?? r.empresa_nombre ?? null;
        if (id && nom && !map.has(id)) map.set(id, { id_empresa: id, nombre: nom });
    });
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
});

// ── Promedio calificación empresa ─────────────────────────────────────────────
const promedioCalif = computed(() => {
    const vals = respRespondieron.value.flatMap((r) =>
        rRespuestas(r)
            .filter((a) => /califi|empresa en general/i.test(ansPregunta(a)))
            .map((a) => parseFloat(a.valor ?? a.valor_escala ?? a.texto))
            .filter((v) => !isNaN(v) && v >= 1 && v <= 5)
    );
    if (!vals.length) return null;
    return (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1);
});

// ── Filtrado local (texto + estado) ──────────────────────────────────────────
const matchSearch = (nombre, matricula, empresa) => {
    const q = respSearch.value.trim().toLowerCase();
    if (!q) return true;
    return (nombre ?? '').toLowerCase().includes(q)
        || (matricula ?? '').toLowerCase().includes(q)
        || (empresa   ?? '').toLowerCase().includes(q);
};

// Lista completa filtrada por búsqueda (sin paginar) — usada para conteos
const filteredRespondieron = computed(() =>
    respRespondieron.value.filter((r) =>
        matchSearch(rNombre(r), rMatricula(r), rEmpresa(r))
    )
);

const filteredPendientes = computed(() =>
    respPendientes.value.filter((p) =>
        matchSearch(
            p.alumno?.nombre    ?? p.nombre,
            p.alumno?.matricula ?? p.matricula,
            p.empresa?.nombre   ?? p.empresa
        )
    )
);

// ── Slices paginados — solo estos se renderizan en el DOM ─────────────────────
const pagedRespondieron = computed(() =>
    filteredRespondieron.value.slice(0, respPageResp.value * PAGE_SIZE)
);
const pagedPendientes = computed(() =>
    filteredPendientes.value.slice(0, respPagePend.value * PAGE_SIZE)
);

const hasMoreResp = computed(() => pagedRespondieron.value.length < filteredRespondieron.value.length);
const hasMorePend = computed(() => pagedPendientes.value.length  < filteredPendientes.value.length);

// Reset página cuando cambia la búsqueda o el filtro de empresa
watch([respSearch, filterEmpresaId, respFilter], () => {
    respPageResp.value = 1;
    respPagePend.value = 1;
    expandedResp.value = null;
});



// ── Helpers para normalizar los campos de una respuesta de alumno ────────────
// El backend puede devolver la estructura anidada (alumno.nombre) o plana (nombre)
const respKey      = (r) => r.id_respuesta_encuesta ?? r.alumno?.matricula ?? r.alumno?.id_usuario ?? r.matricula ?? r.id ?? Math.random();
const rNombre      = (r) => r.alumno?.nombre    ?? r.nombre    ?? r.alumno_nombre    ?? '—';
const rMatricula   = (r) => r.alumno?.matricula ?? r.matricula ?? '—';
const rCarrera     = (r) => r.alumno?.carrera   ?? r.carrera   ?? null;
const rEmpresa     = (r) => r.empresa?.nombre   ?? (typeof r.empresa === 'string' ? r.empresa : null) ?? r.empresa_nombre ?? null;
const rFecha       = (r) => r.fecha_respuesta   ?? r.fecha     ?? r.created_at ?? null;
const rRespuestas  = (r) => r.respuestas ?? r.answers ?? r.detalles ?? r.preguntas_respondidas ?? [];

// Para cada respuesta individual (ans)
const ansPregunta  = (ans) => ans.texto_pregunta ?? ans.pregunta ?? ans.pregunta_texto ?? ans.question ?? '';
const ansValor     = (ans) => {
    const v = ans.valor ?? ans.texto ?? ans.respuesta ?? ans.valor_escala ?? ans.value ?? null;
    return v !== null && v !== undefined ? String(v) : '—';
};

// ════════════════════════════════
// HELPERS
// ════════════════════════════════
const formatDate = (str) => {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
};

const tipoConfig = (tipo) => TIPO_CONFIG[tipo] ?? { label: tipo, icon: 'pi pi-question', badgeClass: 'tipo-texto' };

// ════════════════════════════════
// LOAD
// ════════════════════════════════
const loadPeriodos = async () => {
    try {
        const { data } = await api.get('/periodos');
        periodos.value = data ?? [];
    } catch {
        // non-critical, silently fail
    }
};

const loadEncuestas = async () => {
    loading.value = true;
    try {
        const { data } = await api.get('/encuestas');
        encuestas.value = data ?? [];

        // Init period filter to active period on first load
        const encPeriodoActivo = encuestas.value.find((e) => e.periodo?.estado === 'activo');
        if (filtroPeriodoList.value === null && encPeriodoActivo) {
            filtroPeriodoList.value = encPeriodoActivo.periodo.id_periodo;
        }

        if (!selected.value) {
            const autoSelect = encPeriodoActivo ?? encuestas.value.find((e) => e.activa) ?? encuestas.value[0] ?? null;
            if (autoSelect) {
                await selectEncuesta(autoSelect);
            }
        } else {
            const refreshed = encuestas.value.find((e) => e.id_encuesta === selected.value.id_encuesta);
            if (refreshed) {
                await loadEncuestaDetalle(refreshed.id_encuesta);
            } else {
                selected.value = encuestas.value[0] ?? null;
                if (selected.value) await loadEncuestaDetalle(selected.value.id_encuesta);
            }
        }
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las encuestas.', life: 4000 });
    } finally {
        loading.value = false;
    }
};

const loadEncuestaDetalle = async (id) => {
    try {
        const { data } = await api.get(`/encuestas/${id}`);
        // Merge detail into selected and update in list
        selected.value = data;
        const idx = encuestas.value.findIndex((e) => e.id_encuesta === id);
        if (idx !== -1) {
            encuestas.value[idx] = { ...encuestas.value[idx], ...data };
        }
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el detalle de la encuesta.', life: 4000 });
    }
};

const selectEncuesta = async (enc) => {
    selected.value         = enc;
    activeTab.value        = 'preguntas';
    respRespondieron.value = [];
    respPendientes.value   = [];
    respTotales.value      = { total_asignados: 0, total_respondieron: 0, total_pendientes: 0 };
    expandedResp.value     = null;
    respFilter.value       = 'todos';
    respSearch.value       = '';
    await loadEncuestaDetalle(enc.id_encuesta);
};

onMounted(async () => {
    await Promise.all([loadPeriodos(), loadEncuestas()]);
    if (periodoId.value) {
        filtroPeriodoList.value = periodoId.value;
        // selecciona la primera encuesta del periodo si no hay ninguna seleccionada
        if (!selected.value) {
            const enc = encuestas.value.find(e => e.periodo?.id_periodo === periodoId.value);
            if (enc) await selectEncuesta(enc);
        }
    }
});

// ════════════════════════════════
// COMPUTED
// ════════════════════════════════
// Warning si ninguna encuesta está visible para alumnos (activa=true)
const encuestaActiva = computed(() =>
    encuestas.value.find((e) => e.activa) ?? null
);

// Períodos que ya tienen encuesta asignada (para el filtro de lista)
const periodosConEncuesta = computed(() => {
    // Coerce to Number to prevent string/number type mismatch from JSON deserialization
    const ids = new Set(encuestas.value.map((e) => Number(e.periodo?.id_periodo)).filter(Boolean));
    return periodos.value
        .filter((p) => ids.has(Number(p.id_periodo)))
        .sort((a, b) => {
            if (a.estado === 'activo' && b.estado !== 'activo') return -1;
            if (b.estado === 'activo' && a.estado !== 'activo') return 1;
            return 0;
        });
});

// Todos los periodos son seleccionables (múltiples encuestas por periodo permitidas)
const periodosDisponibles = computed(() => periodos.value);

// Lista filtrada por período seleccionado
const encuestasFiltradas = computed(() => {
    if (!filtroPeriodoList.value) return encuestas.value;
    return encuestas.value.filter((e) => e.periodo?.id_periodo === filtroPeriodoList.value);
});

// Encuestas del periodo actualmente visible (para sub-tabs)
const encuestasPeriodoActual = computed(() => encuestasFiltradas.value);

// ════════════════════════════════
// ENCUESTA — CRUD
// ════════════════════════════════
const openCreateDialog = () => {
    const activoPeriodo = periodos.value.find((p) => p.estado === 'activo');
    newEncuesta.value = {
        nombre: '',
        descripcion: '',
        id_periodo: activoPeriodo?.id_periodo ?? periodos.value[0]?.id_periodo ?? null,
        tiene_calificacion: false,
    };
    showCreateDialog.value = true;
};

const crearEncuesta = async () => {
    if (!newEncuesta.value.nombre.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'Escribe un nombre para la encuesta.', life: 3000 });
        return;
    }
    if (!newEncuesta.value.id_periodo) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'Selecciona el periodo.', life: 3000 });
        return;
    }
    saving.value = true;
    const periodoId = newEncuesta.value.id_periodo;
    try {
        const { data: creada } = await api.post('/encuestas', {
            id_periodo:         periodoId,
            nombre:             newEncuesta.value.nombre.trim(),
            descripcion:        newEncuesta.value.descripcion?.trim() || undefined,
            activa:             false,
            tiene_calificacion: newEncuesta.value.tiene_calificacion ?? false,
        });
        toast.add({ severity: 'success', summary: 'Encuesta creada', life: 3000 });
        showCreateDialog.value = false;
        newEncuesta.value = { nombre: '', descripcion: '', id_periodo: null, tiene_calificacion: false };
        // Fijar el filtro al periodo de la nueva encuesta ANTES de recargar
        filtroPeriodoList.value = periodoId;
        await loadEncuestas();
        // Seleccionar la encuesta recién creada
        const recienCreada = encuestas.value.find((e) => e.id_encuesta === creada?.id_encuesta);
        if (recienCreada) await selectEncuesta(recienCreada);
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo crear la encuesta.', life: 4000 });
    } finally {
        saving.value = false;
    }
};

// ════════════════════════════════
// EDITAR ENCUESTA
// ════════════════════════════════
const abrirEditarEncuesta = (enc) => {
    editEncForm.value = {
        nombre:             enc.nombre ?? '',
        descripcion:        enc.descripcion ?? '',
        tiene_calificacion: enc.tiene_calificacion ?? false,
        id_periodo:         enc.periodo?.id_periodo ?? null,
    };
    showEditEncDialog.value = true;
};

const guardarEditarEncuesta = async () => {
    if (!editEncForm.value.nombre.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'El nombre no puede estar vacío.', life: 3000 });
        return;
    }
    if (!editEncForm.value.id_periodo) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'Selecciona el periodo.', life: 3000 });
        return;
    }
    saving.value = true;
    const periodoId = editEncForm.value.id_periodo;
    try {
        await api.patch(`/encuestas/${selected.value.id_encuesta}`, {
            nombre:             editEncForm.value.nombre.trim(),
            descripcion:        editEncForm.value.descripcion?.trim() || undefined,
            tiene_calificacion: editEncForm.value.tiene_calificacion,
            id_periodo:         periodoId,
        });
        toast.add({ severity: 'success', summary: 'Encuesta actualizada', life: 3000 });
        showEditEncDialog.value = false;
        filtroPeriodoList.value = periodoId;
        await loadEncuestas();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo actualizar.', life: 4000 });
    } finally {
        saving.value = false;
    }
};

const toggleActiva = async (enc) => {
    saving.value = true;
    try {
        const endpoint = enc.activa
            ? `/encuestas/${enc.id_encuesta}/desactivar`
            : `/encuestas/${enc.id_encuesta}/activar`;
        await api.put(endpoint);
        toast.add({
            severity: enc.activa ? 'info' : 'success',
            summary:  enc.activa ? 'Encuesta desactivada' : 'Encuesta activada',
            life: 3000
        });
        await loadEncuestas();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo cambiar el estado.', life: 4000 });
    } finally {
        saving.value = false;
    }
};

const eliminarEncuesta = async () => {
    if (!selected.value) return;
    saving.value = true;
    try {
        await api.delete(`/encuestas/${selected.value.id_encuesta}`);
        toast.add({ severity: 'success', summary: 'Encuesta eliminada', life: 3000 });
        showDeleteDialog.value = false;
        selected.value = null;
        await loadEncuestas();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo eliminar. Puede tener respuestas registradas.', life: 5000 });
    } finally {
        saving.value = false;
    }
};

// ════════════════════════════════
// PREGUNTAS — CRUD
// ════════════════════════════════
const agregarPregunta = async () => {
    if (!newPregunta.value.texto.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'Escribe el texto de la pregunta.', life: 3000 });
        return;
    }
    saving.value = true;
    try {
        const orden = (selected.value.preguntas?.length ?? 0);
        const body = {
            texto: newPregunta.value.texto.trim(),
            tipo:  newPregunta.value.tipo,
            orden,
            peso: 1,
            requerida: newPregunta.value.requerida ?? true,
        };
        if (newPregunta.value.tipo === 'opcion_unica' || newPregunta.value.tipo === 'opcion_multiple') {
            const filtradas = newOpciones.value.filter((o) => o.trim());
            if (filtradas.length > 0) body.opciones = filtradas;
        }
        if (newPregunta.value.tipo === 'autocompletado' && newPregunta.value.campo_auto) {
            body.campo_auto = newPregunta.value.campo_auto;
        }
        if (newPregunta.value.condicion_pregunta_id) {
            body.condicion_pregunta_id = newPregunta.value.condicion_pregunta_id;
            body.condicion_respuesta   = newPregunta.value.condicion_respuesta || null;
        }
        await api.post(`/encuestas/${selected.value.id_encuesta}/preguntas`, body);
        toast.add({ severity: 'success', summary: 'Pregunta agregada', life: 3000 });
        showAddPregDialog.value = false;
        newPregunta.value = { texto: '', tipo: 'texto_corto', campo_auto: '', requerida: true, condicion_pregunta_id: null, condicion_respuesta: '' };
        newOpciones.value = [''];
        await loadEncuestaDetalle(selected.value.id_encuesta);
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo agregar la pregunta.', life: 4000 });
    } finally {
        saving.value = false;
    }
};

const abrirEditarPregunta = (preg) => {
    editPregunta.value = {
        id_pregunta:           preg.id_pregunta,
        texto:                 preg.texto,
        orden:                 preg.orden ?? 0,
        peso:                  preg.peso  ?? 1,
        requerida:             preg.requerida ?? true,
        condicion_pregunta_id: preg.condicion_pregunta_id ?? null,
        condicion_respuesta:   preg.condicion_respuesta ?? '',
    };
    showEditPregDialog.value = true;
};

const guardarPregunta = async () => {
    if (!editPregunta.value.texto.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'El texto no puede estar vacío.', life: 3000 });
        return;
    }
    saving.value = true;
    try {
        const editBody = {
            texto:    editPregunta.value.texto.trim(),
            orden:    editPregunta.value.orden,
            peso:     editPregunta.value.peso,
            requerida: editPregunta.value.requerida ?? true,
            condicion_pregunta_id: editPregunta.value.condicion_pregunta_id || null,
            condicion_respuesta:   editPregunta.value.condicion_pregunta_id
                                     ? (editPregunta.value.condicion_respuesta || null)
                                     : null,
        };
        await api.put(`/encuestas/preguntas/${editPregunta.value.id_pregunta}`, editBody);
        toast.add({ severity: 'success', summary: 'Pregunta actualizada', life: 3000 });
        showEditPregDialog.value = false;
        await loadEncuestaDetalle(selected.value.id_encuesta);
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo editar la pregunta.', life: 4000 });
    } finally {
        saving.value = false;
    }
};

const eliminarPregunta = (preg) => {
    confirm.require({
        message: `¿Eliminar la pregunta "${preg.texto?.slice(0, 60) ?? 'esta pregunta'}"? Esta acción no se puede deshacer.`,
        header: 'Confirmar eliminación',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
        acceptClass: 'p-button-danger',
        accept: async () => {
            saving.value = true;
            try {
                await api.delete(`/encuestas/preguntas/${preg.id_pregunta}`);
                toast.add({ severity: 'success', summary: 'Pregunta eliminada', life: 3000 });
                await loadEncuestaDetalle(selected.value.id_encuesta);
            } catch (e) {
                toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo eliminar la pregunta.', life: 4000 });
            } finally {
                saving.value = false;
            }
        }
    });
};

// ════════════════════════════════
// DUPLICAR
// ════════════════════════════════
const duplicarEncuesta = async () => {
    if (!dupForm.value.nombre.trim()) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'Escribe el nombre para la nueva encuesta.', life: 3000 });
        return;
    }
    if (!dupForm.value.id_periodo_destino) {
        toast.add({ severity: 'warn', summary: 'Campo requerido', detail: 'Selecciona el periodo destino.', life: 3000 });
        return;
    }
    saving.value = true;
    try {
        await api.post(`/encuestas/${selected.value.id_encuesta}/duplicar`, {
            id_periodo_destino: dupForm.value.id_periodo_destino,
            nombre:             dupForm.value.nombre.trim()
        });
        const total = selected.value.preguntas?.length ?? 0;
        toast.add({ severity: 'success', summary: 'Encuesta duplicada', detail: `Se creó "${dupForm.value.nombre.trim()}" con ${total} pregunta(s).`, life: 4000 });
        showDuplicateDialog.value = false;
        dupForm.value = { nombre: '', id_periodo_destino: null };
        await loadEncuestas();
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: e.response?.data?.message || 'No se pudo duplicar la encuesta.', life: 4000 });
    } finally {
        saving.value = false;
    }
};

// ════════════════════════════════
// PLANTILLA / SEED
// ════════════════════════════════
const cargarPlantilla = async () => {
    if (!selected.value) return;
    showPlantillaDialog.value = false;
    loadingPlantilla.value = true;
    try {
        const { data } = await api.post(`/encuestas/${selected.value.id_encuesta}/seed-preguntas`);
        const count = data?.total ?? data?.insertadas ?? PLANTILLA_PREGUNTAS.length;
        toast.add({ severity: 'success', summary: 'Plantilla cargada', detail: `Se agregaron ${count} preguntas base.`, life: 4000 });
        await loadEncuestaDetalle(selected.value.id_encuesta);
    } catch (e) {
        // Fallback: insert individually if seed endpoint not available
        if (e.response?.status === 404) {
            const baseOrden = selected.value.preguntas?.length ?? 0;
            try {
                for (let i = 0; i < PLANTILLA_PREGUNTAS.length; i++) {
                    const p = PLANTILLA_PREGUNTAS[i];
                    const body = { texto: p.texto, tipo: p.tipo, orden: baseOrden + i, peso: 1 };
                    if ((p.tipo === 'opcion_unica' || p.tipo === 'opcion_multiple') && p.opciones?.length) {
                        body.opciones = p.opciones;
                    }
                    await api.post(`/encuestas/${selected.value.id_encuesta}/preguntas`, body);
                }
                toast.add({ severity: 'success', summary: 'Plantilla cargada', detail: `Se agregaron ${PLANTILLA_PREGUNTAS.length} preguntas.`, life: 4000 });
                await loadEncuestaDetalle(selected.value.id_encuesta);
            } catch (err2) {
                toast.add({ severity: 'error', summary: 'Error', detail: err2.response?.data?.message || 'Algunas preguntas no se pudieron agregar.', life: 5000 });
                await loadEncuestaDetalle(selected.value.id_encuesta);
            }
        } else {
            toast.add({ severity: 'error', summary: 'Error al cargar plantilla', detail: e.response?.data?.message || 'No se pudo cargar la plantilla.', life: 5000 });
        }
    } finally {
        loadingPlantilla.value = false;
    }
};

// Seleccionar período en tabs (auto-selects its encuesta)
const selectPeriodo = async (periodoId) => {
    filtroPeriodoList.value = periodoId;
    const enc = encuestas.value.find((e) => e.periodo?.id_periodo === periodoId);
    if (enc) await selectEncuesta(enc);
};

// ════════════════════════════════
// EXPORT XLSX
// ════════════════════════════════
const exportandoXlsx = ref(false);
const exportarXlsx = async (enc) => {
    exportandoXlsx.value = true;
    try {
        const resp = await api.get(`/encuestas/${enc.id_encuesta}/exportar-xlsx`, {
            responseType: 'blob'
        });
        const url = URL.createObjectURL(resp.data);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `respuestas-${(enc.nombre ?? 'encuesta').replace(/\s+/g, '-')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo exportar el archivo.', life: 4000 });
    } finally {
        exportandoXlsx.value = false;
    }
};

// ════════════════════════════════
// OPCIONES DINÁMICAS
// ════════════════════════════════
const addOpcion = () => { newOpciones.value.push(''); };
const removeOpcion = (i) => { newOpciones.value.splice(i, 1); };

// Preguntas que pueden ser padre de una condición (tienen opciones fijas)
const preguntasConOpciones = computed(() =>
    (selected.value?.preguntas ?? []).filter(
        (p) => (p.tipo === 'opcion_unica' || p.tipo === 'opcion_multiple') && p.opciones?.length > 0
    )
);

// Opciones de la pregunta padre seleccionada como condición
const opcionesCondicionNew = computed(() => {
    if (!newPregunta.value.condicion_pregunta_id) return [];
    const padre = (selected.value?.preguntas ?? []).find(
        (p) => p.id_pregunta === newPregunta.value.condicion_pregunta_id
    );
    return padre?.opciones ?? [];
});

const opcionesCondicionEdit = computed(() => {
    if (!editPregunta.value.condicion_pregunta_id) return [];
    const padre = (selected.value?.preguntas ?? []).find(
        (p) => p.id_pregunta === editPregunta.value.condicion_pregunta_id
    );
    return padre?.opciones ?? [];
});

// Fallback chips escala
const defaultEscala = [
    { valor: 1, etiqueta: 'Malo' },
    { valor: 2, etiqueta: 'Regular' },
    { valor: 3, etiqueta: 'Bueno' },
    { valor: 4, etiqueta: 'Excelente' }
];
</script>

<template>
    <div class="enc-admin-page">
        <Toast />
        <ConfirmDialog />

        <!-- ════ BREADCRUMB (sólo en vista detalle /encuestas/:periodoId) ════ -->
        <div v-if="periodoId" class="enc-breadcrumb">
            <button class="enc-bc-back" @click="router.push({ name: 'admin-encuestas' })">
                <i class="pi pi-arrow-left"></i> Encuestas
            </button>
            <span class="enc-bc-sep">/</span>
            <span class="enc-bc-current">
                {{ periodos.find(p => p.id_periodo === periodoId)?.nombre ?? 'Periodo' }}
            </span>
        </div>

        <!-- ════════════════════════════════
             HEADER
        ════════════════════════════════ -->
        <div class="page-header">
            <div class="page-title-group">
                <span class="page-icon"><i class="pi pi-clipboard" /></span>
                <div>
                    <h4 class="page-title">Encuestas</h4>
                    <p class="page-subtitle">Gestiona encuestas y evaluaciones por periodo</p>
                </div>
            </div>
            <Button label="Nueva encuesta" icon="pi pi-plus" @click="openCreateDialog" />
        </div>

        <!-- LOADING -->
        <div v-if="loading" class="loading-wrap">
            <i class="pi pi-spin pi-spinner loading-icon"></i>
            <span>Cargando encuestas…</span>
        </div>

        <template v-else>
            <!-- ════ PERIOD TABS (oculto en vista detalle) ════ -->
            <div v-if="!periodoId && periodosConEncuesta.length > 0" class="period-tabs-bar">
                <button
                    v-for="p in periodosConEncuesta"
                    :key="p.id_periodo"
                    class="period-tab"
                    :class="{ 'period-tab-active': filtroPeriodoList === p.id_periodo }"
                    @click="selectPeriodo(p.id_periodo)"
                >
                    <span class="ptab-dot" :class="p.estado === 'activo' ? 'ptab-green' : 'ptab-grey'"></span>
                    <span class="ptab-name">{{ p.nombre }}</span>
                    <span v-if="p.estado === 'activo'" class="ptab-pill">Activo</span>
                </button>
            </div>

            <!-- ════ SIN ENCUESTA EN PERIODO ACTIVO ════ -->
            <div v-if="!encuestaActiva" class="status-banner banner-warning">
                <div class="banner-icon-wrap icon-warning"><i class="pi pi-exclamation-triangle"></i></div>
                <div>
                    <p class="banner-title">Sin encuesta visible para alumnos</p>
                    <p class="banner-desc">Ninguna encuesta está activa. Usa el botón "Activar" en una tarjeta para que los alumnos puedan responderla.</p>
                </div>
            </div>

            <!-- ════ EMPTY STATE GLOBAL ════ -->
            <div v-if="encuestas.length === 0" class="empty-state">
                <div class="empty-icon-wrap"><i class="pi pi-clipboard"></i></div>
                <p class="empty-title">Sin encuestas registradas</p>
                <p class="empty-desc">Crea la primera encuesta para empezar.</p>
                <Button label="Crear encuesta" icon="pi pi-plus" @click="openCreateDialog" />
            </div>

            <!-- ════ EMPTY: periodo seleccionado sin encuestas ════ -->
            <div v-else-if="encuestasFiltradas.length === 0" class="empty-state">
                <div class="empty-icon-wrap"><i class="pi pi-plus-circle"></i></div>
                <p class="empty-title">Este periodo no tiene encuestas</p>
                <p class="empty-desc">Agrega una encuesta para este periodo.</p>
                <Button label="Crear encuesta" icon="pi pi-plus" @click="openCreateDialog" />
            </div>

            <!-- ════ CARDS GRID ════ -->
            <template v-else>
            <div class="enc-cards-grid">
                <div
                    v-for="enc in encuestasFiltradas"
                    :key="enc.id_encuesta"
                    class="enc-card"
                    :class="{
                        'enc-card--activa':   enc.activa,
                        'enc-card--selected': selected?.id_encuesta === enc.id_encuesta,
                    }"
                    @click="selectEncuesta(enc)"
                >
                    <!-- Header -->
                    <div class="enc-card-hdr">
                        <div class="enc-card-hdr-left">
                            <span class="ecard-dot" :class="enc.activa ? 'ecard-dot--green' : 'ecard-dot--grey'"></span>
                            <span class="ecard-status" :class="enc.activa ? 'ecard-status--green' : 'ecard-status--grey'">
                                {{ enc.activa ? 'Visible' : 'Oculta' }}
                            </span>
                        </div>
                        <span v-if="enc.tiene_calificacion" class="ecard-cal-badge">
                            <i class="pi pi-star"></i> Con calificación
                        </span>
                    </div>

                    <!-- Body -->
                    <div class="enc-card-body">
                        <h5 class="enc-card-name">{{ enc.nombre ?? '—' }}</h5>
                        <p v-if="enc.descripcion" class="enc-card-desc">{{ enc.descripcion }}</p>
                        <div class="enc-card-meta">
                            <span class="ecard-meta-chip">
                                <i class="pi pi-list-check"></i>
                                {{ enc.total_preguntas ?? enc.preguntas?.length ?? 0 }} preguntas
                            </span>
                            <span v-if="enc.fecha_creacion" class="ecard-meta-chip">
                                <i class="pi pi-calendar"></i>
                                {{ formatDate(enc.fecha_creacion) }}
                            </span>
                        </div>
                    </div>

                    <!-- Footer: acciones -->
                    <div class="enc-card-footer" @click.stop>
                        <Button
                            :icon="enc.activa ? 'pi pi-eye-slash' : 'pi pi-eye'"
                            :label="enc.activa ? 'Desactivar' : 'Activar'"
                            :severity="enc.activa ? 'secondary' : 'success'"
                            size="small"
                            outlined
                            :loading="saving"
                            @click="toggleActiva(enc)"
                        />
                        <Button
                            icon="pi pi-pencil"
                            label="Editar"
                            severity="secondary"
                            size="small"
                            outlined
                            @click="abrirEditarEncuesta(enc)"
                        />
                        <Button
                            icon="pi pi-copy"
                            severity="secondary"
                            size="small"
                            outlined
                            v-tooltip.top="'Duplicar'"
                            @click="selected = enc; dupForm.nombre = enc.nombre + ' (copia)'; dupForm.id_periodo_destino = null; showDuplicateDialog = true;"
                        />
                        <Button
                            icon="pi pi-trash"
                            severity="danger"
                            size="small"
                            outlined
                            v-tooltip.top="'Eliminar'"
                            @click="selected = enc; showDeleteDialog = true;"
                        />
                        <Button
                            icon="pi pi-file-excel"
                            severity="success"
                            size="small"
                            outlined
                            v-tooltip.top="'Exportar respuestas XLSX'"
                            :loading="exportandoXlsx"
                            @click="exportarXlsx(enc)"
                        />
                    </div>
                </div>
            </div>

            <!-- ════ DETAIL PANEL (encuesta seleccionada) ════ -->
            <div v-if="selected" class="enc-detail-panel">

                <!-- Panel header con info de la encuesta seleccionada -->
                <div class="detail-panel-header">
                    <div class="dph-title-row">
                        <i class="pi pi-clipboard dph-icon"></i>
                        <div>
                            <p class="dph-name">{{ selected.nombre }}</p>
                            <p v-if="selected.descripcion" class="dph-desc">{{ selected.descripcion }}</p>
                        </div>
                        <div class="dph-badges">
                            <Tag
                                :value="selected.activa ? 'Visible para alumnos' : 'Oculta'"
                                :severity="selected.activa ? 'success' : 'secondary'"
                            />
                            <Tag v-if="selected.tiene_calificacion" value="Con calificación" severity="info" icon="pi pi-star" />
                        </div>
                    </div>
                    <div v-if="totalAlumnos > 0" class="dph-progress-row">
                        <span class="dph-prog-label">
                            <i class="pi pi-chart-bar"></i>
                            {{ totalRespondieron }}/{{ totalAlumnos }} respondieron ({{ pctRespuestas }}%)
                        </span>
                        <ProgressBar :value="pctRespuestas" :showValue="false" class="dph-prog-bar" />
                    </div>
                </div>

                <!-- ── Tabs ── -->
                <div class="detail-tabs">
                    <button
                        class="detail-tab"
                        :class="{ 'detail-tab-active': activeTab === 'preguntas' }"
                        @click="switchTab('preguntas')"
                    >
                        <i class="pi pi-list-check"></i> Preguntas ({{ selected.preguntas?.length ?? 0 }})
                    </button>
                    <button
                        class="detail-tab"
                        :class="{ 'detail-tab-active': activeTab === 'respuestas' }"
                        @click="switchTab('respuestas')"
                    >
                        <i class="pi pi-inbox"></i> Respuestas
                    </button>
                </div>

                    <!-- Sección preguntas -->
                    <div class="questions-section" v-if="activeTab === 'preguntas'">
                        <div class="questions-header">
                            <p class="questions-title">
                                <i class="pi pi-list-check"></i>
                                Preguntas ({{ selected.preguntas?.length ?? 0 }})
                            </p>
                            <div class="questions-header-actions">
                                <Button
                                    label="Cargar plantilla"
                                    icon="pi pi-download"
                                    size="small"
                                    severity="secondary"
                                    outlined
                                    :loading="loadingPlantilla"
                                    @click="showPlantillaDialog = true"
                                />
                                <Button
                                    label="Agregar pregunta"
                                    icon="pi pi-plus"
                                    size="small"
                                    @click="showAddPregDialog = true"
                                />
                            </div>
                        </div>

                        <!-- Sin preguntas -->
                        <div v-if="!selected.preguntas?.length" class="questions-empty">
                            <i class="pi pi-inbox"></i>
                            <span>Esta encuesta no tiene preguntas. Agrega la primera o usa "Cargar plantilla".</span>
                        </div>

                        <!-- Lista de preguntas -->
                        <div v-else class="questions-list">
                            <div
                                v-for="(preg, idx) in selected.preguntas"
                                :key="preg.id_pregunta"
                                class="question-item"
                            >
                                <span class="question-num">{{ idx + 1 }}</span>
                                <div class="question-body">
                                    <p class="question-text">{{ preg.texto }}</p>
                                    <div class="question-footer">
                                        <!-- Tipo badge -->
                                        <span class="tipo-badge" :class="tipoConfig(preg.tipo).badgeClass">
                                            <i :class="tipoConfig(preg.tipo).icon"></i>
                                            {{ tipoConfig(preg.tipo).label }}
                                        </span>
                                        <!-- Requerida / Opcional -->
                                        <span class="tipo-badge" :class="preg.requerida !== false ? 'badge-req' : 'badge-opt'">
                                            <i :class="preg.requerida !== false ? 'pi pi-asterisk' : 'pi pi-minus-circle'"></i>
                                            {{ preg.requerida !== false ? 'Obligatoria' : 'Opcional' }}
                                        </span>
                                        <!-- Condición -->
                                        <span v-if="preg.condicion_pregunta_id" class="tipo-badge badge-cond" :title="`Depende de la pregunta #${preg.condicion_pregunta_id} = '${preg.condicion_respuesta}'`">
                                            <i class="pi pi-filter"></i>
                                            Condicional
                                        </span>
                                        <!-- Chips opciones -->
                                        <div v-if="(preg.tipo === 'opcion_unica' || preg.tipo === 'opcion_multiple') && preg.opciones?.length" class="question-scale">
                                            <span v-for="op in preg.opciones" :key="op" class="scale-chip scale-opcion">{{ op }}</span>
                                        </div>
                                        <div v-else-if="(preg.tipo === 'opcion_unica' || preg.tipo === 'opcion_multiple') && preg.opciones_escala?.length" class="question-scale">
                                            <span v-for="op in preg.opciones_escala" :key="op.valor" class="scale-chip scale-opcion">{{ op.etiqueta }}</span>
                                        </div>
                                        <!-- Chips para escala -->
                                        <div v-else-if="preg.tipo === 'escala'" class="question-scale">
                                            <span
                                                v-for="op in (preg.opciones_escala ?? defaultEscala)"
                                                :key="op.valor"
                                                class="scale-chip"
                                                :class="'scale-' + op.etiqueta.toLowerCase()"
                                            >{{ op.etiqueta }}</span>
                                        </div>
                                    </div>
                                </div>
                                <!-- Acciones por pregunta -->
                                <div class="question-actions">
                                    <button class="q-btn" @click="abrirEditarPregunta(preg)" title="Editar">
                                        <i class="pi pi-pencil"></i>
                                    </button>
                                    <button class="q-btn q-btn-danger" @click="eliminarPregunta(preg)" title="Eliminar">
                                        <i class="pi pi-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Info tipos -->
                        <div class="scale-info">
                            <i class="pi pi-info-circle"></i>
                            <span>
                                <strong>Texto corto/largo</strong>: respuesta abierta. &nbsp;
                                <strong>Opción única</strong>: radio con opciones personalizadas. &nbsp;
                                <strong>Escala</strong>: tabla Malo / Regular / Bueno / Excelente.
                            </span>
                        </div>
                    </div><!-- /questions-section -->

                    <!-- ════ RESPUESTAS TAB ════ -->
                    <div class="resp-section" v-if="activeTab === 'respuestas'">

                        <!-- Loading -->
                        <div v-if="loadingRespuestas" class="resp-loading">
                            <i class="pi pi-spin pi-spinner"></i>
                            <span>Cargando respuestas…</span>
                        </div>

                        <template v-else>

                            <!-- ── Métricas rápidas ── -->
                            <div class="resp-metrics">
                                <div class="rmc-card rmc-green">
                                    <div class="rmc-icon-wrap"><i class="pi pi-check-circle"></i></div>
                                    <div class="rmc-body">
                                        <span class="rmc-val">{{ totalRespondieron }}</span>
                                        <span class="rmc-label">Respondieron</span>
                                    </div>
                                </div>
                                <div class="rmc-card rmc-amber">
                                    <div class="rmc-icon-wrap"><i class="pi pi-clock"></i></div>
                                    <div class="rmc-body">
                                        <span class="rmc-val">{{ totalPendientes }}</span>
                                        <span class="rmc-label">Pendientes</span>
                                    </div>
                                </div>
                                <div class="rmc-card rmc-blue rmc-wide">
                                    <div class="rmc-icon-wrap"><i class="pi pi-chart-bar"></i></div>
                                    <div class="rmc-body">
                                        <span class="rmc-val">{{ pctRespuestas }}<span class="rmc-unit">%</span></span>
                                        <span class="rmc-label">Completado ({{ totalRespondieron }}/{{ totalAlumnos }})</span>
                                    </div>
                                    <ProgressBar :value="pctRespuestas" :showValue="false" class="rmc-bar" />
                                </div>
                                <div class="rmc-card rmc-purple">
                                    <div class="rmc-icon-wrap"><i class="pi pi-star"></i></div>
                                    <div class="rmc-body">
                                        <span class="rmc-val">
                                            <template v-if="promedioCalif">{{ promedioCalif }}<span class="rmc-unit">/5</span></template>
                                            <template v-else>—</template>
                                        </span>
                                        <span class="rmc-label">Calif. empresa prom.</span>
                                    </div>
                                </div>
                            </div>

                            <!-- ── Buscador + filtros ── -->
                            <div class="resp-toolbar">
                                <!-- Búsqueda local -->
                                <div class="resp-search-wrap">
                                    <i class="pi pi-search resp-search-icon"></i>
                                    <input
                                        v-model="respSearch"
                                        class="resp-search"
                                        placeholder="Buscar por nombre, matrícula o empresa…"
                                        type="text"
                                    />
                                    <button v-if="respSearch" class="resp-search-clear" @click="respSearch = ''" title="Limpiar">
                                        <i class="pi pi-times"></i>
                                    </button>
                                </div>

                                <!-- Filtro por empresa (llama al API con ?empresaId=Y) -->
                                <Select
                                    v-if="empresasEnRespuestas.length"
                                    v-model="filterEmpresaId"
                                    :options="[{ id_empresa: null, nombre: 'Todas las empresas' }, ...empresasEnRespuestas]"
                                    optionLabel="nombre"
                                    optionValue="id_empresa"
                                    placeholder="Todas las empresas"
                                    class="resp-empresa-select"
                                    @change="reloadConFiltros"
                                />

                                <!-- Filtro estado -->
                                <div class="resp-ftabs">
                                    <button class="resp-ftab" :class="{ 'resp-ftab-active': respFilter === 'todos' }" @click="respFilter = 'todos'">
                                        Todos ({{ totalAlumnos }})
                                    </button>
                                    <button class="resp-ftab resp-ftab-green" :class="{ 'resp-ftab-active': respFilter === 'respondieron' }" @click="respFilter = 'respondieron'">
                                        <i class="pi pi-check"></i> Respondieron ({{ totalRespondieron }})
                                    </button>
                                    <button class="resp-ftab resp-ftab-amber" :class="{ 'resp-ftab-active': respFilter === 'pendientes' }" @click="respFilter = 'pendientes'">
                                        <i class="pi pi-clock"></i> Pendientes ({{ totalPendientes }})
                                    </button>
                                </div>
                            </div>

                            <!-- Empty global -->
                            <div v-if="!totalRespondieron && !totalPendientes" class="questions-empty">
                                <i class="pi pi-inbox"></i>
                                <span>Ningún alumno ha respondido esta encuesta todavía.</span>
                            </div>

                            <!-- ── Lista: Respondieron ── -->
                            <template v-if="respFilter !== 'pendientes'">
                                <p v-if="filteredRespondieron.length" class="resp-group-label resp-label-green">
                                    <span class="rgl-dot rgl-green"></span>
                                    Respondieron — {{ filteredRespondieron.length }}
                                </p>
                                <div v-if="filteredRespondieron.length" class="resp-list">
                                    <div
                                        v-for="r in pagedRespondieron"
                                        :key="respKey(r)"
                                        class="resp-item resp-item-done"
                                    >
                                        <!-- Header -->
                                        <div class="resp-item-header" @click="expandedResp = expandedResp === respKey(r) ? null : respKey(r)">
                                            <div class="resp-avatar resp-av-green">{{ rNombre(r).charAt(0).toUpperCase() }}</div>
                                            <div class="resp-info">
                                                <p class="resp-name">{{ rNombre(r) }}</p>
                                                <div class="resp-chips">
                                                    <span class="meta-chip mc-blue">{{ rMatricula(r) }}</span>
                                                    <span v-if="rCarrera(r)"  class="meta-chip mc-purple">{{ rCarrera(r) }}</span>
                                                    <span v-if="rEmpresa(r)"  class="meta-chip mc-amber">{{ rEmpresa(r) }}</span>
                                                </div>
                                            </div>
                                            <div class="resp-right">
                                                <span v-if="rFecha(r)" class="resp-date">{{ formatDate(rFecha(r)) }}</span>
                                                <span class="resp-badge resp-badge-green"><i class="pi pi-check"></i> Respondió</span>
                                                <span class="resp-answers-count" v-if="rRespuestas(r).length">
                                                    {{ rRespuestas(r).length }} resp.
                                                </span>
                                                <button
                                                    class="resp-ver-btn"
                                                    title="Ver respuestas completas"
                                                    @click.stop="verDetalleAlumno(r)"
                                                >
                                                    <i class="pi pi-external-link"></i>
                                                </button>
                                                <i class="pi resp-chevron" :class="expandedResp === respKey(r) ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                                            </div>
                                        </div>

                                        <!-- Detalle expandido -->
                                        <div v-if="expandedResp === respKey(r)" class="resp-detail">
                                            <div class="resp-detail-grid">
                                                <div
                                                    v-for="(ans, idx) in rRespuestas(r)"
                                                    :key="ans.id_pregunta ?? ans.id ?? idx"
                                                    class="resp-ans-card"
                                                    :class="{ 'ans-card-long': ansValor(ans).length > 40 }"
                                                >
                                                    <div class="rac-num">{{ idx + 1 }}</div>
                                                    <div class="rac-body">
                                                        <p class="rac-question">{{ ansPregunta(ans) || `Pregunta ${idx + 1}` }}</p>
                                                        <span
                                                            class="rac-value"
                                                            :class="{
                                                                'rac-positive': ['Sí','Si','Excelente','Bueno','4','5'].includes(ansValor(ans)),
                                                                'rac-negative': ['No','Malo','1','2'].includes(ansValor(ans)),
                                                                'rac-neutral':  ['Regular','3'].includes(ansValor(ans)),
                                                                'rac-text':     ansValor(ans).length > 20
                                                            }"
                                                        >{{ ansValor(ans) }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <p v-if="!rRespuestas(r).length" class="resp-ans-empty">Sin detalle de respuestas disponible.</p>
                                        </div>
                                    </div>
                                    <!-- Cargar más respondieron -->
                                    <div v-if="hasMoreResp" class="resp-load-more">
                                        <button class="resp-loadmore-btn" @click="respPageResp++">
                                            <i class="pi pi-chevron-down"></i>
                                            Cargar más ({{ filteredRespondieron.length - pagedRespondieron.length }} restantes)
                                        </button>
                                    </div>
                                </div>
                                <div v-else-if="respSearch.trim()" class="questions-empty">
                                    <i class="pi pi-search"></i>
                                    <span>No hay coincidencias para "<strong>{{ respSearch }}</strong>".</span>
                                </div>
                                <div v-else-if="totalRespondieron > 0" class="questions-empty">
                                    <i class="pi pi-exclamation-circle" style="color: var(--p-amber-500)"></i>
                                    <span>Hay {{ totalRespondieron }} respuesta(s) registrada(s) pero el servidor no devolvió la lista de alumnos. Abre la consola del navegador para ver los campos que regresó el endpoint.</span>
                                </div>
                            </template>

                            <!-- ── Lista: Pendientes ── -->
                            <template v-if="respFilter !== 'respondieron'">
                                <template v-if="filteredPendientes.length">
                                    <p class="resp-group-label resp-label-amber">
                                        <span class="rgl-dot rgl-amber"></span>
                                        Pendientes de responder — {{ filteredPendientes.length }}
                                    </p>
                                    <div class="resp-list">
                                        <div
                                            v-for="p in pagedPendientes"
                                            :key="p.matricula ?? p.id_usuario ?? p.nombre"
                                            class="resp-item resp-item-pending"
                                        >
                                            <div class="resp-item-header resp-header-nd">
                                                <div class="resp-avatar resp-av-amber">
                                                    {{ (p.alumno?.nombre ?? p.nombre ?? '?').charAt(0).toUpperCase() }}
                                                </div>
                                                <div class="resp-info">
                                                    <p class="resp-name">{{ p.alumno?.nombre ?? p.nombre ?? '—' }}</p>
                                                    <div class="resp-chips">
                                                        <span class="meta-chip mc-blue">{{ p.alumno?.matricula ?? p.matricula ?? '—' }}</span>
                                                        <span v-if="p.empresa?.nombre ?? p.empresa" class="meta-chip mc-amber">
                                                            {{ p.empresa?.nombre ?? p.empresa }}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div class="resp-right">
                                                    <span class="resp-badge resp-badge-amber"><i class="pi pi-clock"></i> Pendiente</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <!-- Cargar más pendientes -->
                                    <div v-if="hasMorePend" class="resp-load-more">
                                        <button class="resp-loadmore-btn" @click="respPagePend++">
                                            <i class="pi pi-chevron-down"></i>
                                            Cargar más ({{ filteredPendientes.length - pagedPendientes.length }} restantes)
                                        </button>
                                    </div>
                                </template>
                                <div v-else-if="respFilter === 'pendientes'" class="questions-empty">
                                    <i class="pi pi-check-circle" style="color:#10b981"></i>
                                    <span>¡Todos los alumnos ya respondieron la encuesta!</span>
                                </div>
                            </template>

                        </template>
                    </div><!-- /resp-section -->
            </div><!-- /enc-detail-panel -->
            </template><!-- /cards + detail -->
        </template><!-- /v-else loading -->

        <!-- ════════════════════════════════
             DIALOG — Crear encuesta
        ════════════════════════════════ -->
        <Dialog v-model:visible="showCreateDialog" modal header="Nueva encuesta" :style="{ width: '460px' }">
            <div class="dialog-body">
                <div class="dialog-hint">
                    <i class="pi pi-info-circle hint-icon"></i>
                    <span>La nueva encuesta se creará como <strong>inactiva</strong>. Un periodo puede tener varias encuestas — actívalas individualmente cuando quieras que los alumnos las vean.</span>
                </div>
                <div class="dialog-field">
                    <label class="dialog-label">Periodo <span class="field-required">*</span></label>
                    <Select
                        v-model="newEncuesta.id_periodo"
                        :options="periodosDisponibles"
                        optionLabel="nombre"
                        optionValue="id_periodo"
                        placeholder="Selecciona un periodo"
                        class="w-full"
                    >
                        <template #option="{ option }">
                            <div class="enc-period-opt">
                                <span>{{ option.nombre }}</span>
                                <span v-if="option.estado === 'activo'" class="enc-period-badge">● Activo</span>
                            </div>
                        </template>
                    </Select>
                    <small v-if="periodosDisponibles.length === 0" class="enc-no-periodos">
                        Todos los períodos ya tienen encuesta asignada.
                    </small>
                </div>
                <div class="dialog-field">
                    <label class="dialog-label">Nombre de la encuesta <span class="field-required">*</span></label>
                    <InputText v-model="newEncuesta.nombre" placeholder="Encuesta de satisfacción Ene–Abr 2026" class="w-full" />
                </div>
                <div class="dialog-field">
                    <label class="dialog-label">Descripción <span class="field-optional">(opcional)</span></label>
                    <Textarea v-model="newEncuesta.descripcion" placeholder="Evaluación del periodo de prácticas…" rows="2" autoResize class="w-full" />
                </div>
                <div class="dialog-field dialog-field--check">
                    <Checkbox v-model="newEncuesta.tiene_calificacion" :binary="true" inputId="chk_tiene_cal" />
                    <label for="chk_tiene_cal" class="dialog-label--inline">
                        Lleva calificación
                        <span class="field-hint">Actívalo si esta encuesta es un examen o evaluación que se asienta como nota en el historial del alumno.</span>
                    </label>
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="showCreateDialog = false" />
                <Button label="Crear encuesta" icon="pi pi-check" :loading="saving" @click="crearEncuesta" />
            </template>
        </Dialog>

        <!-- ════════════════════════════════
             DIALOG — Editar encuesta
        ════════════════════════════════ -->
        <Dialog v-model:visible="showEditEncDialog" modal header="Editar encuesta" :style="{ width: '480px' }">
            <div class="dialog-body">
                <div class="dialog-field">
                    <label class="dialog-label">Nombre <span class="field-required">*</span></label>
                    <InputText v-model="editEncForm.nombre" placeholder="Nombre de la encuesta" class="w-full" />
                </div>
                <div class="dialog-field">
                    <label class="dialog-label">Periodo <span class="field-required">*</span></label>
                    <Select
                        v-model="editEncForm.id_periodo"
                        :options="periodos"
                        optionLabel="nombre"
                        optionValue="id_periodo"
                        placeholder="Selecciona un periodo"
                        class="w-full"
                    >
                        <template #option="{ option }">
                            <div class="enc-period-opt">
                                <span>{{ option.nombre }}</span>
                                <span v-if="option.estado === 'activo'" class="enc-period-badge">● Activo</span>
                            </div>
                        </template>
                    </Select>
                </div>
                <div class="dialog-field">
                    <label class="dialog-label">Descripción <span class="field-optional">(opcional)</span></label>
                    <Textarea v-model="editEncForm.descripcion" placeholder="Descripción…" rows="2" autoResize class="w-full" />
                </div>
                <div class="dialog-field dialog-field--check">
                    <Checkbox v-model="editEncForm.tiene_calificacion" :binary="true" inputId="chk_edit_cal" />
                    <label for="chk_edit_cal" class="dialog-label--inline">
                        Lleva calificación
                        <span class="field-hint">Actívalo si esta encuesta es un examen o evaluación que se asienta como nota en el historial del alumno.</span>
                    </label>
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="showEditEncDialog = false" />
                <Button label="Guardar cambios" icon="pi pi-check" :loading="saving" @click="guardarEditarEncuesta" />
            </template>
        </Dialog>

        <!-- ════════════════════════════════
             DIALOG — Agregar pregunta
        ════════════════════════════════ -->
        <Dialog v-model:visible="showAddPregDialog" modal header="Agregar pregunta" :style="{ width: '520px' }">
            <div class="dialog-body">
                <div class="dialog-hint">
                    <i class="pi pi-info-circle hint-icon"></i>
                    <span>Agrega a <strong>{{ selected?.nombre }}</strong>.</span>
                </div>
                <div class="dialog-field">
                    <label class="dialog-label">Tipo de pregunta</label>
                    <div class="tipo-selector">
                        <button
                            v-for="(cfg, key) in TIPO_CONFIG"
                            :key="key"
                            class="tipo-btn"
                            :class="{ 'tipo-btn-active': newPregunta.tipo === key }"
                            @click="newPregunta.tipo = key; newOpciones = ['']"
                        >
                            <i :class="cfg.icon"></i> {{ cfg.label }}
                        </button>
                    </div>
                </div>
                <div class="dialog-field">
                    <label class="dialog-label">Texto de la pregunta <span class="field-required">*</span></label>
                    <Textarea v-model="newPregunta.texto" placeholder="¿Cómo calificarías...?" class="w-full" rows="3" autoResize />
                </div>
                <!-- Opciones dinámicas para opcion_unica / opcion_multiple -->
                <div v-if="newPregunta.tipo === 'opcion_unica' || newPregunta.tipo === 'opcion_multiple'" class="dialog-field">
                    <label class="dialog-label">Opciones <span class="field-optional">(al menos una)</span></label>
                    <div class="opciones-list">
                        <div v-for="(opcion, i) in newOpciones" :key="i" class="opcion-row">
                            <InputText
                                v-model="newOpciones[i]"
                                :placeholder="`Opción ${i + 1}`"
                                class="opcion-input"
                            />
                            <button
                                class="q-btn q-btn-danger"
                                :disabled="newOpciones.length <= 1"
                                @click="removeOpcion(i)"
                                title="Eliminar opción"
                            >
                                <i class="pi pi-times"></i>
                            </button>
                        </div>
                    </div>
                    <Button
                        label="+ Agregar opción"
                        text
                        size="small"
                        icon="pi pi-plus"
                        @click="addOpcion"
                        class="add-opcion-btn"
                    />
                </div>
                <!-- Campo autocompletado -->
                <div v-if="newPregunta.tipo === 'autocompletado'" class="dialog-field">
                    <label class="dialog-label">Campo del alumno <span class="field-optional">(pre-rellena desde perfil)</span></label>
                    <Select
                        v-model="newPregunta.campo_auto"
                        :options="[
                            { label: 'Matrícula', value: 'matricula' },
                            { label: 'Nombre', value: 'nombre' },
                            { label: 'Carrera', value: 'carrera' },
                            { label: 'Semestre', value: 'cuatrimestre' },
                            { label: 'Correo', value: 'correo' },
                        ]"
                        option-label="label"
                        option-value="value"
                        placeholder="Selecciona campo"
                        class="w-full"
                    />
                </div>

                <!-- Separador de lógica avanzada -->
                <div class="dialog-section-sep">Comportamiento</div>

                <!-- Requerida -->
                <div class="dialog-field dialog-field--check">
                    <Checkbox v-model="newPregunta.requerida" :binary="true" inputId="chk_new_req" />
                    <label for="chk_new_req" class="dialog-label--inline">
                        Obligatoria
                        <span class="field-hint">Si está desactivado, el alumno puede dejarla en blanco.</span>
                    </label>
                </div>

                <!-- Condición (solo si hay preguntas con opciones previas) -->
                <div v-if="preguntasConOpciones.length > 0" class="dialog-field">
                    <label class="dialog-label">
                        Mostrar solo si… <span class="field-optional">(condicional)</span>
                    </label>
                    <Select
                        v-model="newPregunta.condicion_pregunta_id"
                        :options="[{ id_pregunta: null, texto: 'Sin condición (siempre visible)' }, ...preguntasConOpciones]"
                        optionLabel="texto"
                        optionValue="id_pregunta"
                        placeholder="Sin condición"
                        class="w-full"
                        @change="newPregunta.condicion_respuesta = ''"
                    />
                </div>
                <div v-if="newPregunta.condicion_pregunta_id && opcionesCondicionNew.length" class="dialog-field">
                    <label class="dialog-label">…la respuesta sea</label>
                    <Select
                        v-model="newPregunta.condicion_respuesta"
                        :options="opcionesCondicionNew"
                        placeholder="Selecciona el valor"
                        class="w-full"
                    />
                    <small class="field-hint" style="margin-top:4px;display:block">
                        Esta pregunta solo se mostrará si la pregunta padre tiene exactamente esa respuesta.
                    </small>
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="showAddPregDialog = false; newPregunta.value = { texto: '', tipo: 'texto_corto', campo_auto: '', requerida: true, condicion_pregunta_id: null, condicion_respuesta: '' }; newOpciones.value = [''];" />
                <Button label="Agregar" icon="pi pi-plus" :loading="saving" @click="agregarPregunta" />
            </template>
        </Dialog>

        <!-- ════════════════════════════════
             DIALOG — Editar pregunta
        ════════════════════════════════ -->
        <Dialog v-model:visible="showEditPregDialog" modal header="Editar pregunta" :style="{ width: '520px' }">
            <div class="dialog-body">
                <div class="dialog-field">
                    <label class="dialog-label">Texto de la pregunta</label>
                    <Textarea v-model="editPregunta.texto" rows="3" autoResize class="w-full" />
                </div>
                <div class="dialog-row">
                    <div class="dialog-field">
                        <label class="dialog-label">Orden</label>
                        <InputNumber v-model="editPregunta.orden" :min="0" :useGrouping="false" class="w-full" />
                    </div>
                    <div class="dialog-field">
                        <label class="dialog-label">Peso</label>
                        <InputNumber v-model="editPregunta.peso" :min="1" :useGrouping="false" class="w-full" />
                    </div>
                </div>

                <div class="dialog-section-sep">Comportamiento</div>

                <!-- Requerida -->
                <div class="dialog-field dialog-field--check">
                    <Checkbox v-model="editPregunta.requerida" :binary="true" inputId="chk_edit_req" />
                    <label for="chk_edit_req" class="dialog-label--inline">
                        Obligatoria
                        <span class="field-hint">Si está desactivado, el alumno puede dejarla en blanco.</span>
                    </label>
                </div>

                <!-- Condición -->
                <div v-if="preguntasConOpciones.length > 0" class="dialog-field">
                    <label class="dialog-label">
                        Mostrar solo si… <span class="field-optional">(condicional)</span>
                    </label>
                    <Select
                        v-model="editPregunta.condicion_pregunta_id"
                        :options="[{ id_pregunta: null, texto: 'Sin condición (siempre visible)' }, ...preguntasConOpciones.filter(p => p.id_pregunta !== editPregunta.id_pregunta)]"
                        optionLabel="texto"
                        optionValue="id_pregunta"
                        placeholder="Sin condición"
                        class="w-full"
                        @change="editPregunta.condicion_respuesta = ''"
                    />
                </div>
                <div v-if="editPregunta.condicion_pregunta_id && opcionesCondicionEdit.length" class="dialog-field">
                    <label class="dialog-label">…la respuesta sea</label>
                    <Select
                        v-model="editPregunta.condicion_respuesta"
                        :options="opcionesCondicionEdit"
                        placeholder="Selecciona el valor"
                        class="w-full"
                    />
                    <small class="field-hint" style="margin-top:4px;display:block">
                        Esta pregunta solo aparecerá cuando la pregunta padre tenga esa respuesta exacta.
                    </small>
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="showEditPregDialog = false" />
                <Button label="Guardar cambios" icon="pi pi-check" :loading="saving" @click="guardarPregunta" />
            </template>
        </Dialog>

        <!-- ════════════════════════════════
             DIALOG — Duplicar encuesta
        ════════════════════════════════ -->
        <Dialog v-model:visible="showDuplicateDialog" modal header="Duplicar encuesta" :style="{ width: '460px' }">
            <div class="dialog-body">
                <div class="dialog-hint">
                    <i class="pi pi-info-circle hint-icon"></i>
                    <span>Se clonará <strong>{{ selected?.nombre }}</strong> con sus {{ selected?.preguntas?.length ?? 0 }} preguntas al periodo destino. La copia iniciará inactiva.</span>
                </div>
                <div class="dialog-field">
                    <label class="dialog-label">Periodo destino <span class="field-required">*</span></label>
                    <Select
                        v-model="dupForm.id_periodo_destino"
                        :options="periodos"
                        optionLabel="nombre"
                        optionValue="id_periodo"
                        placeholder="Selecciona un periodo"
                        class="w-full"
                    />
                </div>
                <div class="dialog-field">
                    <label class="dialog-label">Nombre de la nueva encuesta <span class="field-required">*</span></label>
                    <InputText v-model="dupForm.nombre" class="w-full" @keyup.enter="duplicarEncuesta" />
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="showDuplicateDialog = false" />
                <Button label="Duplicar" icon="pi pi-copy" :loading="saving" @click="duplicarEncuesta" />
            </template>
        </Dialog>

        <!-- ════════════════════════════════
             DIALOG — Confirmar eliminar
        ════════════════════════════════ -->
        <Dialog v-model:visible="showDeleteDialog" modal header="Eliminar encuesta" :style="{ width: '420px' }">
            <div class="dialog-body">
                <div class="dialog-hint dialog-hint-danger">
                    <i class="pi pi-exclamation-triangle hint-icon hint-icon-danger"></i>
                    <span>¿Eliminar <strong>{{ selected?.nombre }}</strong>? Esta acción solo es posible si <strong>no tiene respuestas</strong> de alumnos y no se puede deshacer.</span>
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="showDeleteDialog = false" />
                <Button label="Eliminar" icon="pi pi-trash" severity="danger" :loading="saving" @click="eliminarEncuesta" />
            </template>
        </Dialog>

        <!-- ════════════════════════════════
             DIALOG — Confirmar cargar plantilla
        ════════════════════════════════ -->
        <Dialog v-model:visible="showPlantillaDialog" modal header="Cargar plantilla estándar" :style="{ width: '460px' }">
            <div class="dialog-body">
                <div class="dialog-hint">
                    <i class="pi pi-info-circle hint-icon"></i>
                    <span>
                        Se agregarán <strong>{{ PLANTILLA_PREGUNTAS.length }} preguntas estándar</strong> a
                        <strong>{{ selected?.nombre }}</strong>. Las preguntas se añadirán al final de las existentes.
                    </span>
                </div>
                <div class="plantilla-preview">
                    <p class="plantilla-preview-title">Preguntas que se agregarán:</p>
                    <ol class="plantilla-list">
                        <li v-for="(p, i) in PLANTILLA_PREGUNTAS" :key="i" class="plantilla-list-item">
                            <span class="tipo-badge" :class="tipoConfig(p.tipo).badgeClass" style="margin-right: 0.4rem;">
                                <i :class="tipoConfig(p.tipo).icon"></i>
                            </span>
                            {{ p.texto }}
                        </li>
                    </ol>
                </div>
            </div>
            <template #footer>
                <Button label="Cancelar" text severity="secondary" @click="showPlantillaDialog = false" />
                <Button label="Cargar plantilla" icon="pi pi-download" @click="cargarPlantilla" />
            </template>
        </Dialog>

        <!-- ════════════════════════════════
             DIALOG — Detalle individual alumno
             GET /encuestas/:id/respuestas-alumno/:alumnoId
        ════════════════════════════════ -->
        <Dialog
            v-model:visible="showAlumnoDialog"
            modal
            :header="alumnoDetalle ? `Respuestas de ${alumnoDetalle.alumno?.nombre ?? alumnoDetalle.nombre ?? 'Alumno'}` : 'Cargando…'"
            :style="{ width: '680px', maxWidth: '95vw' }"
            :closable="!loadingAlumnoDetalle"
        >
            <!-- Loading -->
            <div v-if="loadingAlumnoDetalle" class="dlg-loading">
                <i class="pi pi-spin pi-spinner"></i>
                <span>Cargando respuestas…</span>
            </div>

            <template v-else-if="alumnoDetalle">
                <!-- Info del alumno -->
                <div class="dlg-alumno-meta">
                    <div class="dlg-av">{{ (alumnoDetalle.alumno?.nombre ?? alumnoDetalle.nombre ?? '?').charAt(0).toUpperCase() }}</div>
                    <div>
                        <p class="dlg-alumno-nombre">{{ alumnoDetalle.alumno?.nombre ?? alumnoDetalle.nombre ?? '—' }}</p>
                        <div class="dlg-meta-chips">
                            <span class="meta-chip mc-blue">{{ alumnoDetalle.alumno?.matricula ?? alumnoDetalle.matricula ?? '—' }}</span>
                            <span v-if="alumnoDetalle.alumno?.carrera ?? alumnoDetalle.carrera" class="meta-chip mc-purple">
                                {{ alumnoDetalle.alumno?.carrera ?? alumnoDetalle.carrera }}
                            </span>
                            <span v-if="alumnoDetalle.empresa?.nombre ?? alumnoDetalle.empresa" class="meta-chip mc-amber">
                                {{ alumnoDetalle.empresa?.nombre ?? alumnoDetalle.empresa }}
                            </span>
                            <span v-if="alumnoDetalle.fecha_respuesta ?? alumnoDetalle.fecha" class="meta-chip mc-grey">
                                <i class="pi pi-calendar"></i>
                                {{ formatDate(alumnoDetalle.fecha_respuesta ?? alumnoDetalle.fecha) }}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="dlg-divider"></div>

                <!-- Lista de respuestas -->
                <div class="dlg-resp-list">
                    <div
                        v-for="(ans, idx) in rRespuestas(alumnoDetalle)"
                        :key="ans.id_pregunta ?? ans.id ?? idx"
                        class="dlg-ans-row"
                        :class="{ 'dlg-ans-long': ansValor(ans).length > 60 }"
                    >
                        <span class="dlg-ans-num">{{ idx + 1 }}</span>
                        <div class="dlg-ans-body">
                            <p class="dlg-ans-pregunta">{{ ansPregunta(ans) || `Pregunta ${idx + 1}` }}</p>
                            <span
                                class="dlg-ans-valor"
                                :class="{
                                    'dlg-positive': ['Sí','Si','Excelente','Bueno','4','5'].includes(ansValor(ans)),
                                    'dlg-negative': ['No','Malo','1','2'].includes(ansValor(ans)),
                                    'dlg-neutral':  ['Regular','3'].includes(ansValor(ans)),
                                    'dlg-text':     ansValor(ans).length > 20
                                }"
                            >{{ ansValor(ans) }}</span>
                        </div>
                    </div>
                    <p v-if="!rRespuestas(alumnoDetalle).length" class="resp-ans-empty">
                        Sin respuestas disponibles para este alumno.
                    </p>
                </div>
            </template>

            <template #footer>
                <Button label="Cerrar" icon="pi pi-times" severity="secondary" text @click="showAlumnoDialog = false" />
            </template>
        </Dialog>

    </div>
</template>

<style scoped>
/* ════════════════════════════════════════
   LAYOUT
════════════════════════════════════════ */
.enc-admin-page { display: flex; flex-direction: column; gap: 1.25rem; }

/* ── Breadcrumb ── */
.enc-breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    color: var(--p-text-muted-color, #64748b);
}
.enc-bc-back {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.82rem;
    color: var(--p-primary-600, #2563eb);
    cursor: pointer;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-weight: 500;
}
.enc-bc-back:hover { text-decoration: underline; }
.enc-bc-sep { color: var(--p-text-muted-color, #94a3b8); }
.enc-bc-current { color: var(--p-text-color, #0f172a); font-weight: 500; }

/* ════════════════════════════════════════
   HEADER
════════════════════════════════════════ */
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.page-title  { font-size: 1.15rem; font-weight: 700; color: var(--text-color); margin: 0 0 0.1rem; }
.page-subtitle { font-size: 0.8rem; color: var(--text-color-secondary); margin: 0; }

/* ════════════════════════════════════════
   LOADING / EMPTY
════════════════════════════════════════ */
.loading-wrap {
    display: flex; flex-direction: column; align-items: center;
    gap: 0.75rem; padding: 4rem 0;
    color: var(--text-color-secondary); font-size: 0.875rem;
}
.loading-icon { font-size: 2rem; color: var(--sisa-primary-l); }

.empty-state {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    padding: 4rem 1rem;
    background: var(--surface-card); border: 1px solid var(--sisa-border); border-radius: 12px;
    gap: 0.75rem;
}
.empty-icon-wrap {
    width: 3.5rem; height: 3.5rem;
    background: var(--sisa-tint-blue); color: var(--sisa-icon-blue);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem; opacity: 0.65;
}
.empty-title { font-size: 1rem; font-weight: 600; color: var(--text-color); margin: 0; }
.empty-desc  { font-size: 0.875rem; color: var(--text-color-secondary); margin: 0; max-width: 300px; }

/* ════════════════════════════════════════
   BANNER
════════════════════════════════════════ */
.status-banner { display: flex; align-items: flex-start; gap: 1rem; padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid; }
.banner-warning { background: var(--sisa-banner-warn-bg); border-color: var(--sisa-banner-warn-bd); }
.banner-icon-wrap { flex-shrink: 0; width: 2.25rem; height: 2.25rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
.icon-warning { background: var(--sisa-tint-amber); color: var(--sisa-icon-amber); }
.banner-title { font-weight: 700; font-size: 0.9rem; color: var(--text-color); margin: 0 0 0.2rem; }
.banner-desc  { font-size: 0.825rem; color: var(--text-color-secondary); margin: 0; }

/* ════════════════════════════════════════
   PERIOD TABS
════════════════════════════════════════ */
.period-tabs-bar {
    display: flex; flex-wrap: wrap; gap: 0.5rem;
    padding: 0.25rem 0;
}
.period-tab {
    display: inline-flex; align-items: center; gap: 0.45rem;
    padding: 0.45rem 1rem; border-radius: 99px;
    font-size: 0.825rem; font-weight: 600;
    border: 1.5px solid var(--sisa-border);
    background: var(--surface-card); color: var(--text-color-secondary);
    cursor: pointer; transition: all 0.15s;
}
.period-tab:hover { border-color: var(--sisa-primary-l); color: var(--sisa-primary-l); }
.period-tab-active { border-color: var(--sisa-primary-l); background: var(--sisa-accent-surface); color: var(--sisa-primary-l); }
.ptab-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ptab-green { background: #22c55e; }
.ptab-grey  { background: var(--text-color-secondary); opacity: 0.4; }
.ptab-name  { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ptab-pill  {
    font-size: 0.62rem; font-weight: 800; letter-spacing: 0.04em;
    background: #dcfce7; color: #15803d; padding: 0.1rem 0.45rem; border-radius: 99px;
}
@media (prefers-color-scheme: dark) {
    .ptab-pill { background: rgba(34,197,94,0.15); color: #4ade80; }
}

/* ════════════════════════════════════════
   HEADER ICON + TITLE GROUP
════════════════════════════════════════ */
.page-title-group { display: flex; align-items: center; gap: 0.875rem; }
.page-icon {
    width: 2.5rem; height: 2.5rem; border-radius: 10px;
    background: var(--sisa-tint-blue); color: var(--sisa-icon-blue);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.15rem; flex-shrink: 0;
}

/* ════════════════════════════════════════
   ENCUESTA CARDS GRID
════════════════════════════════════════ */
.enc-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
}

.enc-card {
    display: flex; flex-direction: column;
    background: var(--surface-card);
    border: 2px solid var(--sisa-border);
    border-radius: 14px; overflow: hidden;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.enc-card:hover { border-color: var(--sisa-primary-l); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
.enc-card--selected { border-color: var(--sisa-primary-l); box-shadow: 0 0 0 3px var(--sisa-accent-surface); }
.enc-card--activa   { border-top: 3px solid #22c55e; }

/* Card header */
.enc-card-hdr {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.625rem 1rem 0;
}
.enc-card-hdr-left { display: flex; align-items: center; gap: 0.4rem; }
.ecard-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.ecard-dot--green { background: #22c55e; }
.ecard-dot--grey  { background: var(--text-color-secondary); opacity: 0.35; }
.ecard-status { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.ecard-status--green { color: #16a34a; }
.ecard-status--grey  { color: var(--text-color-secondary); }
.ecard-cal-badge {
    display: inline-flex; align-items: center; gap: 0.25rem;
    font-size: 0.68rem; font-weight: 700;
    background: var(--sisa-tint-blue); color: var(--sisa-icon-blue);
    padding: 0.15rem 0.5rem; border-radius: 99px;
}

/* Card body */
.enc-card-body { flex: 1; padding: 0.625rem 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.35rem; }
.enc-card-name { font-size: 1rem; font-weight: 700; color: var(--text-color); margin: 0; line-height: 1.3; }
.enc-card-desc {
    font-size: 0.82rem; color: var(--text-color-secondary);
    margin: 0; line-height: 1.4;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.enc-card-meta { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.4rem; }
.ecard-meta-chip {
    display: inline-flex; align-items: center; gap: 0.3rem;
    font-size: 0.73rem; color: var(--text-color-secondary);
    background: var(--surface-ground); padding: 0.2rem 0.55rem;
    border-radius: 6px; border: 1px solid var(--sisa-border);
}
.ecard-meta-chip i { font-size: 0.65rem; }

/* Card footer */
.enc-card-footer {
    display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
    padding: 0.625rem 0.75rem;
    border-top: 1px solid var(--sisa-border);
    background: var(--surface-ground);
}

/* ════════════════════════════════════════
   DETAIL PANEL HEADER
════════════════════════════════════════ */
.detail-panel-header {
    background: var(--surface-ground);
    border: 1px solid var(--sisa-border);
    border-radius: 12px; padding: 1rem 1.25rem;
    display: flex; flex-direction: column; gap: 0.625rem;
}
.dph-title-row { display: flex; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap; }
.dph-icon { font-size: 1.1rem; color: var(--sisa-primary-l); flex-shrink: 0; margin-top: 2px; }
.dph-name { font-size: 1.05rem; font-weight: 700; color: var(--text-color); margin: 0; }
.dph-desc { font-size: 0.82rem; color: var(--text-color-secondary); margin: 0.1rem 0 0; }
.dph-badges { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-left: auto; }
.dph-progress-row { display: flex; align-items: center; gap: 0.75rem; }
.dph-prog-label { font-size: 0.78rem; color: var(--text-color-secondary); white-space: nowrap; display: flex; align-items: center; gap: 0.35rem; }
.dph-prog-bar { flex: 1; height: 5px !important; border-radius: 99px; }

/* ════════════════════════════════════════
   DETAIL PANEL (full-width, no sidebar)
════════════════════════════════════════ */
.enc-detail-panel {
    background: var(--surface-card); border: 1px solid var(--sisa-border);
    border-radius: 14px; padding: 1.25rem 1.5rem;
    display: flex; flex-direction: column; gap: 1.25rem;
}

.esc-progress-bar { height: 6px !important; border-radius: 99px; }

/* Keep old classes for compat */
.enc-period-opt { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; width: 100%; }
.enc-period-badge { font-size: 0.7rem; font-weight: 700; color: #22c55e; white-space: nowrap; }
.enc-no-periodos { color: var(--text-color-secondary); font-size: 0.75rem; margin-top: 0.25rem; }
.detail-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

/* ── Preguntas ─────────────────── */
.questions-section { display: flex; flex-direction: column; gap: 1rem; }
.questions-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }
.questions-title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; font-weight: 600; color: var(--text-color); margin: 0; }
.questions-header-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.questions-empty { display: flex; align-items: center; gap: 0.75rem; padding: 1.25rem; background: var(--surface-ground); border: 1px dashed var(--sisa-border); border-radius: 8px; font-size: 0.875rem; color: var(--text-color-secondary); }
.questions-list { display: flex; flex-direction: column; gap: 0.625rem; }

.question-item { display: flex; align-items: flex-start; gap: 1rem; padding: 0.875rem 1rem; background: var(--surface-ground); border: 1px solid var(--sisa-border); border-radius: 10px; }
.question-num { flex-shrink: 0; width: 1.625rem; height: 1.625rem; background: var(--sisa-tint-blue); color: var(--sisa-icon-blue); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; }
.question-body { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
.question-text { font-size: 0.9rem; color: var(--text-color); line-height: 1.4; margin: 0; }
.question-footer { display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap; }

/* Tipo badge */
.tipo-badge { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 99px; flex-shrink: 0; }
.tipo-escala  { background: var(--sisa-tint-blue);   color: var(--sisa-icon-blue);   }
.tipo-texto   { background: var(--sisa-tint-purple); color: var(--sisa-icon-purple); }
.tipo-opcion  { background: var(--sisa-tint-amber);  color: var(--sisa-icon-amber);  }
.tipo-auto    { background: var(--sisa-tint-green);  color: var(--sisa-icon-green);  }
.badge-req    { background: #fee2e2; color: #dc2626; }
.badge-opt    { background: var(--surface-border); color: var(--text-color-secondary); }
.badge-cond   { background: #ede9fe; color: #7c3aed; cursor: help; }

/* Chips de escala / opcion */
.question-scale { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.scale-chip { padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.68rem; font-weight: 600; }
.scale-malo      { background: var(--sisa-tint-red);    color: var(--sisa-icon-red);    }
.scale-regular   { background: var(--sisa-tint-amber);  color: var(--sisa-icon-amber);  }
.scale-bueno     { background: var(--sisa-tint-blue);   color: var(--sisa-icon-blue);   }
.scale-excelente { background: var(--sisa-tint-green);  color: var(--sisa-icon-green);  }
.scale-opcion    { background: var(--sisa-tint-purple); color: var(--sisa-icon-purple); }

/* Botones de acción de pregunta */
.question-actions { display: flex; flex-direction: column; gap: 0.375rem; flex-shrink: 0; }
.q-btn {
    width: 28px; height: 28px; border-radius: 6px;
    border: 1px solid var(--sisa-border);
    background: var(--surface-card);
    color: var(--text-color-secondary);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 0.75rem;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.q-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.q-btn:not(:disabled):hover { background: var(--surface-hover); color: var(--text-color); border-color: var(--sisa-primary-l); }
.q-btn-danger:not(:disabled):hover { background: var(--sisa-tint-red); color: var(--sisa-icon-red); border-color: var(--sisa-icon-red); }

/* ── Scale info ────────────────── */
.scale-info { display: flex; align-items: flex-start; gap: 0.625rem; padding: 0.75rem 1rem; background: var(--sisa-banner-info-bg); border: 1px solid var(--sisa-banner-info-bd); border-radius: 8px; font-size: 0.8rem; color: var(--text-color-secondary); line-height: 1.5; }
.scale-info i { color: var(--sisa-icon-blue); flex-shrink: 0; margin-top: 1px; }

/* ════════════════════════════════════════
   DIALOGS
════════════════════════════════════════ */
.dialog-body { display: flex; flex-direction: column; gap: 1rem; padding: 0.25rem 0; }
.dialog-row  { display: flex; gap: 1rem; }
.dialog-row .dialog-field { flex: 1; }

.dialog-hint { display: flex; align-items: flex-start; gap: 0.625rem; padding: 0.75rem 0.875rem; background: var(--sisa-banner-info-bg); border: 1px solid var(--sisa-banner-info-bd); border-radius: 8px; font-size: 0.8rem; color: var(--text-color-secondary); line-height: 1.5; }
.dialog-hint-danger { background: var(--sisa-banner-danger-bg); border-color: var(--sisa-banner-danger-bd); }

.hint-icon        { color: var(--sisa-icon-blue); flex-shrink: 0; margin-top: 1px; }
.hint-icon-danger { color: var(--sisa-icon-red);  flex-shrink: 0; margin-top: 1px; }

.dialog-field { display: flex; flex-direction: column; gap: 0.5rem; }
.dialog-field--check { flex-direction: row; align-items: flex-start; gap: 0.6rem; }
.dialog-label { font-size: 0.875rem; font-weight: 600; color: var(--text-color); }
.dialog-label--inline { font-size: 0.875rem; font-weight: 600; color: var(--text-color); display: flex; flex-direction: column; gap: 0.2rem; cursor: pointer; }
.field-hint { font-size: 0.75rem; font-weight: 400; color: var(--text-color-secondary); line-height: 1.4; }
.field-required { color: var(--sisa-icon-red); font-size: 0.8rem; }
.field-optional { font-size: 0.75rem; color: var(--text-color-secondary); font-weight: 400; }
.dialog-section-sep {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-color-secondary);
    border-top: 1px solid var(--sisa-border);
    padding-top: 0.75rem;
    margin-top: 0.25rem;
}

/* Selector de tipo de pregunta */
.tipo-selector { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.tipo-btn {
    flex: 1; min-width: 90px; display: flex; align-items: center; justify-content: center;
    gap: 0.4rem; padding: 0.5rem 0.625rem; border-radius: 8px;
    border: 1px solid var(--sisa-border); background: var(--surface-card);
    color: var(--text-color-secondary); font-size: 0.8rem; font-weight: 500;
    cursor: pointer; transition: all 0.15s;
}
.tipo-btn:hover { border-color: var(--sisa-primary-l); color: var(--sisa-primary-l); background: var(--sisa-active-bg); }
.tipo-btn-active { border-color: var(--sisa-primary-l); color: var(--sisa-primary-l); background: var(--sisa-active-bg); font-weight: 600; }

/* Opciones dinámicas */
.opciones-list { display: flex; flex-direction: column; gap: 0.5rem; }
.opcion-row { display: flex; align-items: center; gap: 0.5rem; }
.opcion-input { flex: 1; }
.add-opcion-btn { align-self: flex-start; margin-top: 0.25rem; }

/* ── Tabs ─────────────────────── */
.detail-tabs {
    display: flex; gap: 0.375rem;
    border-bottom: 1px solid var(--sisa-border);
    padding-bottom: 0.875rem;
}
.detail-tab {
    display: flex; align-items: center; gap: 0.4rem;
    padding: 0.45rem 1rem; border-radius: 8px;
    border: 1px solid var(--sisa-border);
    background: var(--surface-card);
    color: var(--text-color-secondary);
    font-size: 0.83rem; font-weight: 500;
    cursor: pointer; transition: all 0.15s;
}
.detail-tab:hover { border-color: var(--sisa-primary-l); color: var(--sisa-primary-l); background: var(--sisa-active-bg); }
.detail-tab-active { border-color: var(--sisa-primary-l); color: var(--sisa-primary-l); background: var(--sisa-active-bg); font-weight: 600; }

/* ═══════════════════════════════════════════
   RESPUESTAS — vista completa
═══════════════════════════════════════════ */
.resp-section  { display: flex; flex-direction: column; gap: 1.125rem; }
.resp-loading  { display: flex; align-items: center; gap: 0.625rem; padding: 2.5rem; font-size: 0.875rem; color: var(--text-color-secondary); }

/* — Métricas rápidas — */
.resp-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr 2fr 1fr;
    gap: 0.75rem;
}
.rmc-card {
    border-radius: 10px; border: 1px solid;
    padding: 0.875rem 1rem;
    display: flex; flex-direction: column; gap: 0.375rem;
    position: relative; overflow: hidden;
}
.rmc-card.rmc-wide { grid-column: span 1; }
.rmc-green  { background: rgba(16,185,129,.06);  border-color: rgba(16,185,129,.25); }
.rmc-amber  { background: rgba(245,158,11,.06);  border-color: rgba(245,158,11,.25); }
.rmc-blue   { background: var(--sisa-accent-surface); border-color: rgba(21,101,192,.2); }
.rmc-purple { background: rgba(139,92,246,.06); border-color: rgba(139,92,246,.25); }

.rmc-icon-wrap {
    font-size: 1rem; margin-bottom: 0.125rem;
}
.rmc-green  .rmc-icon-wrap { color: #10b981; }
.rmc-amber  .rmc-icon-wrap { color: #f59e0b; }
.rmc-blue   .rmc-icon-wrap { color: var(--sisa-icon-blue); }
.rmc-purple .rmc-icon-wrap { color: #8b5cf6; }

.rmc-body   { display: flex; flex-direction: column; gap: 2px; }
.rmc-val    { font-size: 1.5rem; font-weight: 700; color: var(--text-color); line-height: 1; }
.rmc-unit   { font-size: 0.9rem; font-weight: 400; color: var(--text-color-secondary); }
.rmc-label  { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--text-color-secondary); }
.rmc-bar    { height: 4px; border-radius: 99px; margin-top: 0.375rem; }
:deep(.rmc-bar .p-progressbar-value) {
    background: linear-gradient(90deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    border-radius: 99px;
}

/* — Toolbar: buscar + filtros — */
.resp-toolbar {
    display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
}
.resp-search-wrap {
    flex: 1; min-width: 220px;
    position: relative; display: flex; align-items: center;
}
.resp-search-icon { position: absolute; left: 0.75rem; font-size: 0.8rem; color: var(--text-color-secondary); pointer-events: none; }
.resp-search {
    width: 100%; padding: 0.5rem 2.25rem 0.5rem 2.25rem;
    border: 1px solid var(--sisa-border); border-radius: 8px;
    background: var(--surface-card); color: var(--text-color);
    font-size: 0.875rem; outline: none;
    transition: border-color 0.15s;
}
.resp-search:focus { border-color: var(--sisa-primary-l); }
.resp-search-clear {
    position: absolute; right: 0.625rem;
    background: none; border: none; cursor: pointer;
    color: var(--text-color-secondary); font-size: 0.75rem; padding: 0.25rem;
    display: flex; align-items: center;
}
.resp-search-clear:hover { color: var(--text-color); }

.resp-ftabs { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.resp-ftab {
    padding: 0.4rem 0.875rem; border-radius: 8px;
    border: 1px solid var(--sisa-border);
    background: var(--surface-card);
    color: var(--text-color-secondary);
    font-size: 0.8rem; font-weight: 500;
    cursor: pointer; transition: all 0.15s;
    display: flex; align-items: center; gap: 0.35rem;
}
.resp-ftab:hover { border-color: var(--sisa-primary-l); color: var(--sisa-primary-l); background: var(--sisa-active-bg); }
.resp-ftab-active                              { border-color: var(--sisa-primary-l); color: var(--sisa-primary-l); background: var(--sisa-active-bg); font-weight: 600; }
.resp-ftab.resp-ftab-green.resp-ftab-active   { border-color: #10b981; color: #10b981; background: rgba(16,185,129,.08); }
.resp-ftab.resp-ftab-amber.resp-ftab-active   { border-color: #f59e0b; color: #f59e0b; background: rgba(245,158,11,.08); }

/* — Etiqueta de grupo — */
.resp-group-label {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: .06em; color: var(--text-color-secondary);
    margin: 0.25rem 0 0;
}
.rgl-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.rgl-green { background: #10b981; }
.rgl-amber { background: #f59e0b; }

/* — Lista de alumnos — */
.resp-list { display: flex; flex-direction: column; gap: 0.5rem; }

.resp-item { border: 1px solid var(--sisa-border); border-radius: 10px; overflow: hidden; transition: box-shadow 0.15s; }
.resp-item-done    { border-color: rgba(16,185,129,.3); }
.resp-item-pending { border-color: rgba(245,158,11,.25); opacity: 0.9; }

.resp-item-header {
    display: flex; align-items: center; gap: 0.875rem;
    padding: 0.875rem 1rem;
    background: var(--surface-ground);
    cursor: pointer; transition: background 0.15s;
}
.resp-item-done .resp-item-header    { background: rgba(16,185,129,.04); }
.resp-item-pending .resp-item-header { background: rgba(245,158,11,.04); }
.resp-item-header:hover              { background: var(--surface-hover); }
.resp-header-nd { cursor: default; }
.resp-header-nd:hover { background: rgba(245,158,11,.04); }

.resp-avatar {
    width: 2.25rem; height: 2.25rem; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.875rem; font-weight: 700; flex-shrink: 0;
}
.resp-av-green { background: rgba(16,185,129,.15); color: #059669; }
.resp-av-amber { background: rgba(245,158,11,.15); color: #d97706; }

.resp-info  { flex: 1; min-width: 0; }
.resp-name  { font-size: 0.875rem; font-weight: 600; color: var(--text-color); margin: 0 0 4px; }
.resp-chips { display: flex; gap: 0.35rem; flex-wrap: wrap; }

.meta-chip  { padding: 0.1rem 0.5rem; border-radius: 99px; font-size: 0.7rem; font-weight: 600; }
.mc-blue    { background: var(--sisa-tint-blue);   color: var(--sisa-icon-blue);   }
.mc-purple  { background: var(--sisa-tint-purple); color: var(--sisa-icon-purple); }
.mc-amber   { background: var(--sisa-tint-amber);  color: var(--sisa-icon-amber);  }

.resp-right {
    display: flex; align-items: center; gap: 0.5rem;
    flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end;
}
.resp-date { font-size: 0.72rem; color: var(--text-color-secondary); }
.resp-answers-count { font-size: 0.72rem; color: var(--text-color-secondary); background: var(--surface-card); border: 1px solid var(--sisa-border); padding: 0.1rem 0.45rem; border-radius: 99px; }

.resp-badge {
    display: inline-flex; align-items: center; gap: 0.3rem;
    padding: 0.2rem 0.6rem; border-radius: 99px;
    font-size: 0.72rem; font-weight: 700;
}
.resp-badge-green { background: rgba(16,185,129,.12); color: #059669; }
.resp-badge-amber { background: rgba(245,158,11,.12); color: #d97706; }

.resp-chevron { font-size: 0.72rem; color: var(--text-color-secondary); }

/* — Detalle expandido — */
.resp-detail {
    padding: 1rem 1rem 1rem 1rem;
    border-top: 1px solid var(--sisa-border);
    background: var(--surface-card);
}
.resp-detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.5rem;
}
.resp-ans-card {
    display: flex; align-items: flex-start; gap: 0.625rem;
    padding: 0.625rem 0.75rem;
    background: var(--surface-ground);
    border: 1px solid var(--sisa-border);
    border-radius: 8px;
}
.resp-ans-card.ans-card-long { grid-column: span 2; }

.rac-num {
    flex-shrink: 0; width: 1.375rem; height: 1.375rem;
    background: var(--sisa-tint-blue); color: var(--sisa-icon-blue);
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 0.65rem; font-weight: 700;
}
.rac-body     { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.rac-question { font-size: 0.75rem; color: var(--text-color-secondary); margin: 0; line-height: 1.35; }
.rac-value    { font-size: 0.82rem; font-weight: 700; color: var(--text-color); word-break: break-word; }
.rac-value.rac-text { font-weight: 400; font-size: 0.8rem; }

/* Colores semánticos de la respuesta */
.rac-positive { color: #059669; }
.rac-negative { color: #dc2626; }
.rac-neutral  { color: #d97706; }

.resp-ans-empty { font-size: 0.82rem; color: var(--text-color-secondary); font-style: italic; margin: 0.5rem 0 0; }

/* Plantilla preview */
.plantilla-preview { background: var(--surface-ground); border: 1px solid var(--sisa-border); border-radius: 8px; padding: 0.75rem 1rem; max-height: 280px; overflow-y: auto; }
.plantilla-preview-title { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-color-secondary); margin: 0 0 0.625rem; }
.plantilla-list { margin: 0; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.375rem; }
.plantilla-list-item { font-size: 0.82rem; color: var(--text-color); line-height: 1.4; display: flex; align-items: center; }

/* ── Selector empresa en toolbar ─────── */
.resp-empresa-select { min-width: 180px; font-size: 0.83rem; }

/* ── Botón ver detalle individual ─────── */
.resp-ver-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 6px;
    border: 1px solid var(--sisa-border);
    background: var(--surface-card);
    color: var(--text-color-secondary);
    cursor: pointer; font-size: 0.72rem;
    transition: all 0.15s; flex-shrink: 0;
}
.resp-ver-btn:hover {
    border-color: var(--sisa-primary-l);
    background: var(--sisa-active-bg);
    color: var(--sisa-primary-l);
}

/* ── Dialog detalle alumno ───────────── */
.dlg-loading {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 2rem; font-size: 0.875rem; color: var(--text-color-secondary);
}
.dlg-alumno-meta {
    display: flex; align-items: flex-start; gap: 1rem;
    padding: 0 0 0.25rem;
}
.dlg-av {
    width: 2.75rem; height: 2.75rem; border-radius: 50%; flex-shrink: 0;
    background: var(--sisa-tint-blue); color: var(--sisa-icon-blue);
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; font-weight: 700;
}
.dlg-alumno-nombre {
    font-size: 1rem; font-weight: 700; color: var(--text-color);
    margin: 0 0 0.4rem;
}
.dlg-meta-chips { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.mc-grey { background: var(--surface-ground); color: var(--text-color-secondary); border: 1px solid var(--sisa-border); }
.mc-grey i { font-size: 0.65rem; }

.dlg-divider { height: 1px; background: var(--sisa-border); margin: 1rem 0; }

.dlg-resp-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 55vh; overflow-y: auto; padding-right: 0.25rem; }

.dlg-ans-row {
    display: flex; align-items: flex-start; gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    background: var(--surface-ground); border: 1px solid var(--sisa-border); border-radius: 8px;
}
.dlg-ans-row.dlg-ans-long { flex-direction: column; gap: 0.375rem; }
.dlg-ans-long .dlg-ans-num { align-self: flex-start; }

.dlg-ans-num {
    flex-shrink: 0; width: 1.5rem; height: 1.5rem; border-radius: 50%;
    background: var(--sisa-tint-blue); color: var(--sisa-icon-blue);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.68rem; font-weight: 700;
}
.dlg-ans-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.dlg-ans-pregunta { font-size: 0.78rem; color: var(--text-color-secondary); margin: 0; line-height: 1.4; }
.dlg-ans-valor {
    font-size: 0.875rem; font-weight: 700; color: var(--text-color);
    word-break: break-word;
}
.dlg-ans-valor.dlg-text { font-weight: 400; font-size: 0.82rem; }
.dlg-positive { color: #059669; }
.dlg-negative { color: #dc2626; }
.dlg-neutral  { color: #d97706; }

/* ════════════════════════════════════════
   RESPONSIVE
════════════════════════════════════════ */
@media (max-width: 800px) {
    .enc-layout { grid-template-columns: 1fr; }
    .question-scale { display: none; }
    .detail-actions { width: 100%; }
    .resp-metrics { grid-template-columns: 1fr 1fr; }
    .resp-detail-grid { grid-template-columns: 1fr; }
    .resp-ans-card.ans-card-long { grid-column: span 1; }
}
@media (max-width: 600px) {
    .page-header { flex-direction: column; }
    .question-item { flex-wrap: wrap; }
    .dialog-row { flex-direction: column; }
    .resp-metrics { grid-template-columns: 1fr; }
    .resp-toolbar { flex-direction: column; }
    .resp-search-wrap { width: 100%; }
    .tipo-selector { gap: 0.35rem; }
}

/* ── Cargar más ────────────────────────────────────────── */
.resp-load-more {
    display: flex;
    justify-content: center;
    padding: 0.75rem 0 0.25rem;
}
.resp-loadmore-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 1.25rem;
    border: 1px solid var(--sisa-border);
    border-radius: 99px;
    background: var(--surface-card);
    color: var(--text-color-secondary);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.resp-loadmore-btn:hover {
    border-color: var(--sisa-primary-l);
    color: var(--sisa-primary-l);
    background: var(--sisa-active-bg);
}
</style>
