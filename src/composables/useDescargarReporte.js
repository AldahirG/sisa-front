import api from '@/api/axios';
import { ref } from 'vue';

/**
 * Composable para descarga de reportes Excel con JWT.
 *
 * Uso:
 *   const { descargar, cargando } = useDescargarReporte()
 *   await descargar('periodo', 5, 'Ene-Jun 2025')
 *   await descargar('encuestas', 5, 'Ene-Jun 2025')
 *
 * Lanza error si el servidor responde con error (404 = sin datos, 500, etc.)
 * para que el caller maneje el toast correspondiente.
 */
export function useDescargarReporte() {
    const cargando = ref(false);

    const descargar = async (tipo, id_periodo, nombrePeriodo = '') => {
        cargando.value = true;
        try {
            const ruta =
                tipo === 'encuestas'
                    ? `/reportes/encuestas/${id_periodo}`
                    : `/reportes/periodo/${id_periodo}`;

            const nombreBase = (nombrePeriodo || String(id_periodo))
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9_\-]/g, '');

            const nombreArchivo =
                tipo === 'encuestas'
                    ? `reporte_encuestas_${nombreBase}.xlsx`
                    : `reporte_periodo_${nombreBase}.xlsx`;

            const response = await api.get(ruta, { responseType: 'blob' });

            // Verificar que el blob no sea un JSON de error disfrazado
            const contentType = response.headers['content-type'] ?? '';
            if (contentType.includes('application/json')) {
                const text = await response.data.text();
                const parsed = JSON.parse(text);
                throw new Error(parsed?.message ?? 'Error al generar el reporte');
            }

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', nombreArchivo);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            return nombreArchivo;
        } finally {
            cargando.value = false;
        }
    };

    return { descargar, cargando };
}
