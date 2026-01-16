import api from './axios';

export const getMisEntregables = () => {
    return api.get('/entregables/me');
};

export const entregarArchivo = (idEntregable, archivoUrl) => {
    return api.post(`/entregables/entregar/${idEntregable}`, {
        archivo_url: archivoUrl
    });
};
