import api from '@/api/axios';
import { ref } from 'vue';

// ─────────────────────────────────────────────────────────────
// Cache a nivel de módulo — se comparte entre todos los
// componentes que llamen useCarreras(). Solo un fetch por sesión.
// ─────────────────────────────────────────────────────────────
const carreras  = ref([]);   // [{ id, nombre, nombre_completo }]
const loading   = ref(false);
const error     = ref(null);
let   _cargado  = false;

const fetchCarreras = async () => {
    if (_cargado) return;          // ya en caché, no refetch
    loading.value = true;
    error.value   = null;
    try {
        const { data } = await api.get('/carreras');
        carreras.value = Array.isArray(data) ? data : [];
        _cargado = true;
    } catch (err) {
        error.value = err?.response?.data?.message ?? 'Error al cargar carreras';
    } finally {
        loading.value = false;
    }
};

export function useCarreras() {
    // Dispara fetch si aún no hay datos
    if (!_cargado && !loading.value) fetchCarreras();

    return { carreras, loading, error, fetchCarreras };
}
