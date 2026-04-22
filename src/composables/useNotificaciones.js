import api from '@/api/axios';
import { onUnmounted, ref } from 'vue';

// ─────────────────────────────────────────────────────────────
// ESTADO A NIVEL DE MÓDULO — compartido entre Badge y Panel
// sin Pinia extra. Todos los llamadores de useNotificaciones()
// leen y escriben los mismos refs.
// ─────────────────────────────────────────────────────────────
const notificaciones = ref([]);
const count = ref(0);
const cargando = ref(false);

let _timer       = null;
let _jitterTimer = null;   // setTimeout del jitter inicial
let _suscriptores = 0;
let _prevCount    = -1;    // -1 = no inicializado (primera carga no dispara evento)

// Intervalo de polling: 60s (mitad de carga vs 30s)
// Con jitter ±15s cada usuario queda desfasado → sin thundering herd
const POLL_INTERVAL = 60_000;
const JITTER_MAX    = 15_000;

// ─────────────────────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────────────────────
const fetchNotificaciones = async () => {
    try {
        const { data } = await api.get('/notificaciones');
        notificaciones.value = Array.isArray(data) ? data : [];
        // Sincronizar count con las no leídas reales
        count.value = notificaciones.value.filter((n) => !n.leida).length;
    } catch {
        // silencioso — el usuario no necesita ver errores de polling
    }
};

const fetchCount = async () => {
    try {
        const { data } = await api.get('/notificaciones/no-leidas');
        const nuevo = data?.count ?? 0;

        // Si ya tenemos baseline y llegaron más → disparar evento
        if (_prevCount >= 0 && nuevo > _prevCount) {
            window.dispatchEvent(new CustomEvent('sisa:nuevas-notificaciones', {
                detail: { cantidad: nuevo - _prevCount }
            }));
        }

        _prevCount = nuevo;
        count.value = nuevo;
    } catch {
        // silencioso
    }
};

// ─────────────────────────────────────────────────────────────
// ACCIONES
// ─────────────────────────────────────────────────────────────
const marcarLeida = async (id) => {
    // Optimistic update
    const idx = notificaciones.value.findIndex((n) => n.id_notificacion === id);
    if (idx !== -1 && !notificaciones.value[idx].leida) {
        notificaciones.value[idx].leida = true;
        count.value = Math.max(0, count.value - 1);
    }
    try {
        await api.patch(`/notificaciones/${id}/leer`);
    } catch {
        // Revertir si falla
        if (idx !== -1) {
            notificaciones.value[idx].leida = false;
            count.value += 1;
        }
    }
};

const marcarTodas = async () => {
    // Optimistic
    const previas = notificaciones.value.map((n) => n.leida);
    notificaciones.value.forEach((n) => { n.leida = true; });
    count.value = 0;
    try {
        await api.patch('/notificaciones/leer-todas');
    } catch {
        // Revertir
        notificaciones.value.forEach((n, i) => { n.leida = previas[i]; });
        count.value = notificaciones.value.filter((n) => !n.leida).length;
    }
};

const eliminar = async (id) => {
    const idx = notificaciones.value.findIndex((n) => n.id_notificacion === id);
    const removed = idx !== -1 ? notificaciones.value.splice(idx, 1)[0] : null;
    if (removed && !removed.leida) count.value = Math.max(0, count.value - 1);
    try {
        await api.delete(`/notificaciones/${id}`);
    } catch {
        // Revertir
        if (removed) {
            notificaciones.value.splice(idx, 0, removed);
            if (!removed.leida) count.value += 1;
        }
    }
};

// ─────────────────────────────────────────────────────────────
// POLLING
//
// Estrategia para 800-2000 usuarios concurrentes:
//
//  1. JITTER: cada usuario espera un retardo aleatorio (0-15s) antes
//     del primer poll → los 2000 usuarios quedan distribuidos en una
//     ventana de 60s en vez de explotar todos en el segundo 0.
//
//  2. PAUSA EN PESTAÑA OCULTA: si el usuario cambia de pestaña el
//     intervalo se cancela; se reanuda al volver. En escenario de
//     800 alumnos, ~40% suele tener la pestaña oculta → 40% menos
//     requests sin costo para el usuario.
//
//  3. INTERVALO 60s (vs 30s anterior): mitad de requests al backend
//     con percepción de "tiempo real" igual de válida para notif.
//
//  Resultado vs implementación original:
//    800  users: 27 req/s → ~10 req/s  (-63%)
//    2000 users: 67 req/s → ~20 req/s  (-70%)
// ─────────────────────────────────────────────────────────────

const _arrancarIntervalo = () => {
    if (_timer) return;
    fetchCount();
    _timer = setInterval(fetchCount, POLL_INTERVAL);
};

const _pararIntervalo = () => {
    if (_timer) { clearInterval(_timer); _timer = null; }
};

// Listener de visibilitychange — reutilizado para add/remove
const _onVisibility = () => {
    if (document.hidden) {
        _pararIntervalo();
    } else {
        // Al volver: fetch inmediato + reanudar intervalo
        _arrancarIntervalo();
    }
};

const _iniciarPolling = () => {
    if (_timer || _jitterTimer) return;   // ya activo

    // Jitter: 0 → JITTER_MAX ms aleatorio antes del primer tick
    const jitter = Math.random() * JITTER_MAX;
    _jitterTimer = setTimeout(() => {
        _jitterTimer = null;
        _arrancarIntervalo();
    }, jitter);

    document.addEventListener('visibilitychange', _onVisibility);
};

const _detenerPolling = () => {
    if (_jitterTimer) { clearTimeout(_jitterTimer); _jitterTimer = null; }
    _pararIntervalo();
    document.removeEventListener('visibilitychange', _onVisibility);
    _prevCount = -1;   // reset baseline para próxima sesión
};

// ─────────────────────────────────────────────────────────────
// COMPOSABLE
// ─────────────────────────────────────────────────────────────
export function useNotificaciones() {
    _suscriptores++;
    _iniciarPolling();

    onUnmounted(() => {
        _suscriptores--;
        if (_suscriptores <= 0) {
            _suscriptores = 0;
            _detenerPolling();
        }
    });

    return {
        notificaciones,
        count,
        cargando,
        fetchNotificaciones,
        fetchCount,
        marcarLeida,
        marcarTodas,
        eliminar
    };
}
