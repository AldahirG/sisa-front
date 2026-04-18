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

let _timer = null;
let _suscriptores = 0;   // cuántos componentes están montados
let _prevCount = -1;     // -1 = no inicializado aún (primera carga no dispara evento)

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
// POLLING — arranca en primer suscriptor, se limpia en el último
// ─────────────────────────────────────────────────────────────
const _iniciarPolling = () => {
    if (_timer) return;
    fetchCount();            // hit inmediato
    _timer = setInterval(fetchCount, 30_000);
};

const _detenerPolling = () => {
    if (_timer) {
        clearInterval(_timer);
        _timer = null;
    }
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
