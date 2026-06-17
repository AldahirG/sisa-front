// Mock data — demo mode, no backend required

export const DEMO_TOKEN = 'demo-token-sisa-2025'

export const DEMO_USERS = {
    admin: { id_usuario: 1, nombre: 'Demo Admin', correo: 'admin@sisa.demo', rol: 'admin' },
    alumno: { id_usuario: 2, nombre: 'Demo Alumno', correo: 'alumno@sisa.demo', rol: 'alumno', id_alumno: 1 },
}

export const DEMO_CREDENTIALS = [
    { correo: 'admin@sisa.demo', password: 'demo1234', user: DEMO_USERS.admin, redirect: '/admin/dashboard' },
    { correo: 'alumno@sisa.demo', password: 'demo1234', user: DEMO_USERS.alumno, redirect: '/alumno/dashboard' },
]

// ─── PERIODOS ───────────────────────────────────────────────────────────────
export const mockPeriodos = [
    { id_periodo: 1, nombre: 'ENE-JUN 2025', fecha_inicio: '2025-01-13', fecha_fin: '2025-06-13', activo: true },
    { id_periodo: 2, nombre: 'AGO-DIC 2024', fecha_inicio: '2024-08-01', fecha_fin: '2024-12-15', activo: false },
    { id_periodo: 3, nombre: 'ENE-JUN 2024', fecha_inicio: '2024-01-15', fecha_fin: '2024-06-14', activo: false },
]

// ─── EMPRESAS ───────────────────────────────────────────────────────────────
export const mockEmpresas = [
    { id_empresa: 1, nombre: 'Tech Solutions SA', giro: 'Tecnología', contacto_nombre: 'Laura Sánchez', contacto_email: 'l.sanchez@techsol.demo', activo: true },
    { id_empresa: 2, nombre: 'Innovatech MX', giro: 'Software', contacto_nombre: 'Pedro Ruiz', contacto_email: 'pruiz@innovatech.demo', activo: true },
    { id_empresa: 3, nombre: 'Digital Factory', giro: 'Marketing Digital', contacto_nombre: 'María Castro', contacto_email: 'mcastro@digitalfactory.demo', activo: true },
    { id_empresa: 4, nombre: 'Logística Express', giro: 'Logística', contacto_nombre: 'Carlos Méndez', contacto_email: 'cmendez@logexpress.demo', activo: true },
    { id_empresa: 5, nombre: 'Finanzas Globales', giro: 'Finanzas', contacto_nombre: 'Ana Torres', contacto_email: 'atorres@finglobal.demo', activo: true },
]

// ─── ALUMNOS ─────────────────────────────────────────────────────────────────
// Shape: { id_alumno, matricula, carrera, cuatrimestre, estado, usuario: { nombre, correo } }
export const mockAlumnos = [
    { id_alumno: 1, matricula: 'A2021001', carrera: 'ISC', cuatrimestre: 9, estado: 'activo', usuario: { nombre: 'Demo Alumno', correo: 'alumno@sisa.demo' } },
    { id_alumno: 2, matricula: 'A2021002', carrera: 'LAE', cuatrimestre: 8, estado: 'activo', usuario: { nombre: 'Sofía Ramírez', correo: 'sramirez@demo.mx' } },
    { id_alumno: 3, matricula: 'A2020003', carrera: 'LCP', cuatrimestre: 9, estado: 'activo', usuario: { nombre: 'Luis García', correo: 'lgarcia@demo.mx' } },
    { id_alumno: 4, matricula: 'A2021004', carrera: 'LPS', cuatrimestre: 7, estado: 'activo', usuario: { nombre: 'Valeria Cruz', correo: 'vcruz@demo.mx' } },
    { id_alumno: 5, matricula: 'A2020005', carrera: 'ISC', cuatrimestre: 9, estado: 'baja', usuario: { nombre: 'Emilio Vargas', correo: 'evargas@demo.mx' } },
]

// ─── VACANTES ────────────────────────────────────────────────────────────────
// Shape: { id_categoria, nombre, descripcion, cupo_total, activa, carreras[], empresa: {...}, periodo: {...} }
export const mockVacantes = [
    { id_categoria: 1, nombre: 'Desarrollador Frontend', descripcion: 'Desarrollo de interfaces web con Vue.js y React', cupo_total: 2, activa: true, carreras: ['ISC', 'IISCA'], empresa: { id_empresa: 1, nombre: 'Tech Solutions SA' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
    { id_categoria: 2, nombre: 'Analista de Datos', descripcion: 'Análisis de datos con Python y SQL', cupo_total: 1, activa: true, carreras: ['ISC', 'LCP'], empresa: { id_empresa: 2, nombre: 'Innovatech MX' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
    { id_categoria: 3, nombre: 'Diseñador UX/UI', descripcion: 'Diseño de experiencias digitales', cupo_total: 1, activa: true, carreras: ['LDG', 'LADD'], empresa: { id_empresa: 3, nombre: 'Digital Factory' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
    { id_categoria: 4, nombre: 'Coordinador Logístico', descripcion: 'Gestión y coordinación de envíos nacionales', cupo_total: 2, activa: true, carreras: ['LAE', 'LRI'], empresa: { id_empresa: 4, nombre: 'Logística Express' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
    { id_categoria: 5, nombre: 'Analista Financiero', descripcion: 'Elaboración de reportes financieros y presupuestos', cupo_total: 1, activa: false, carreras: ['LCP', 'LAE'], empresa: { id_empresa: 5, nombre: 'Finanzas Globales' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
]

// ─── POSTULACIONES ───────────────────────────────────────────────────────────
// Shape: { id_postulacion, estado, alumno: { usuario: { nombre, correo } }, categoria: { nombre, empresa, periodo } }
export const mockPostulaciones = [
    {
        id_postulacion: 1,
        estado: 'POSTULADO',
        alumno: { id_alumno: 1, usuario: { nombre: 'Demo Alumno', correo: 'alumno@sisa.demo' } },
        categoria: { id_categoria: 1, nombre: 'Desarrollador Frontend', empresa: { id_empresa: 1, nombre: 'Tech Solutions SA' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
    },
    {
        id_postulacion: 2,
        estado: 'ACEPTADO',
        alumno: { id_alumno: 2, usuario: { nombre: 'Sofía Ramírez', correo: 'sramirez@demo.mx' } },
        categoria: { id_categoria: 4, nombre: 'Coordinador Logístico', empresa: { id_empresa: 4, nombre: 'Logística Express' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
    },
    {
        id_postulacion: 3,
        estado: 'RECHAZADO',
        alumno: { id_alumno: 3, usuario: { nombre: 'Luis García', correo: 'lgarcia@demo.mx' } },
        categoria: { id_categoria: 5, nombre: 'Analista Financiero', empresa: { id_empresa: 5, nombre: 'Finanzas Globales' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
    },
    {
        id_postulacion: 4,
        estado: 'POSTULADO',
        alumno: { id_alumno: 4, usuario: { nombre: 'Valeria Cruz', correo: 'vcruz@demo.mx' } },
        categoria: { id_categoria: 3, nombre: 'Diseñador UX/UI', empresa: { id_empresa: 3, nombre: 'Digital Factory' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
    },
]

// ─── CONTROL ACADÉMICO ───────────────────────────────────────────────────────
// Shape: { alumno: { id_alumno, nombre, matricula, carrera, cuatrimestre, estado }, empresa, vacante: { nombre }, periodo }
export const mockControlAcademico = [
    { id_historial: 1, asignacion_tipo: 'manual', alumno: { id_alumno: 1, nombre: 'Demo Alumno', matricula: 'A2021001', carrera: 'ISC', cuatrimestre: 9, estado: 'activo' }, empresa: { id_empresa: 1, nombre: 'Tech Solutions SA' }, vacante: { id_categoria: 1, nombre: 'Desarrollador Frontend' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
    { id_historial: 2, asignacion_tipo: 'manual', alumno: { id_alumno: 2, nombre: 'Sofía Ramírez', matricula: 'A2021002', carrera: 'LAE', cuatrimestre: 8, estado: 'activo' }, empresa: { id_empresa: 4, nombre: 'Logística Express' }, vacante: { id_categoria: 4, nombre: 'Coordinador Logístico' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
    { id_historial: 3, asignacion_tipo: 'automatica', alumno: { id_alumno: 3, nombre: 'Luis García', matricula: 'A2020003', carrera: 'LCP', cuatrimestre: 9, estado: 'activo' }, empresa: { id_empresa: 5, nombre: 'Finanzas Globales' }, vacante: { id_categoria: 5, nombre: 'Analista Financiero' }, periodo: { id_periodo: 2, nombre: 'AGO-DIC 2024' } },
    { id_historial: 4, asignacion_tipo: 'manual', alumno: { id_alumno: 4, nombre: 'Valeria Cruz', matricula: 'A2021004', carrera: 'LPS', cuatrimestre: 7, estado: 'activo' }, empresa: { id_empresa: 3, nombre: 'Digital Factory' }, vacante: { id_categoria: 3, nombre: 'Diseñador UX/UI' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' } },
]

// ─── CONTROL ACADÉMICO DETALLE (alumno individual) ───────────────────────────
export const mockControlAcademicoDetalle = {
    id_historial: 1,
    alumno: { id_alumno: 1, nombre: 'Demo Alumno', matricula: 'A2021001', carrera: 'ISC', cuatrimestre: 9, estado: 'activo', usuario: { correo: 'alumno@sisa.demo' } },
    empresa: { id_empresa: 1, nombre: 'Tech Solutions SA', giro: 'Tecnología' },
    vacante: { id_categoria: 1, nombre: 'Desarrollador Frontend' },
    periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025', fecha_inicio: '2025-01-13', fecha_fin: '2025-06-13' },
    estado: 'activo',
    entregables: [
        { id_entregable: 1, nombre: 'Carta de presentación', fecha_limite: '2025-02-28', estado: 'entregado', calificacion: null },
        { id_entregable: 2, nombre: 'Reporte primer mes', fecha_limite: '2025-03-15', estado: 'entregado', calificacion: 90 },
        { id_entregable: 3, nombre: 'Evaluación intermedia', fecha_limite: '2025-04-01', estado: 'pendiente', calificacion: null },
    ],
}

// ─── ENTREGABLES ─────────────────────────────────────────────────────────────
export const mockEntregablesPorPeriodo = [
    { id_entregable: 1, nombre: 'Carta de presentación', descripcion: 'Carta emitida por la empresa', fecha_limite: '2025-02-28', tipo: 'documento', id_periodo: 1, estado: 'activo' },
    { id_entregable: 2, nombre: 'Reporte primer mes', descripcion: 'Reporte detallado del primer mes de prácticas', fecha_limite: '2025-03-15', tipo: 'reporte', id_periodo: 1, estado: 'activo' },
    { id_entregable: 3, nombre: 'Evaluación intermedia', descripcion: 'Evaluación del supervisor en empresa', fecha_limite: '2025-04-01', tipo: 'evaluacion', id_periodo: 1, estado: 'activo' },
    { id_entregable: 4, nombre: 'Reporte final', descripcion: 'Reporte final de actividades realizadas', fecha_limite: '2025-05-31', tipo: 'reporte', id_periodo: 1, estado: 'activo' },
    { id_entregable: 5, nombre: 'Encuesta de satisfacción', descripcion: 'Encuesta sobre la experiencia de prácticas', fecha_limite: '2025-06-10', tipo: 'encuesta', id_periodo: 1, estado: 'activo' },
]

// ─── ENTREGABLES ALUMNO ──────────────────────────────────────────────────────
export const mockEntregablesAlumno = [
    { id_entrega: 1, id_entregable: 1, nombre: 'Carta de presentación', tipo: 'documento', fecha_limite: '2025-02-28', estado: 'entregado', archivo_url: 'demo-carta.pdf', fecha_entrega: '2025-02-20', calificacion: null },
    { id_entrega: 2, id_entregable: 2, nombre: 'Reporte primer mes', tipo: 'reporte', fecha_limite: '2025-03-15', estado: 'entregado', archivo_url: 'demo-reporte1.pdf', fecha_entrega: '2025-03-10', calificacion: 90 },
    { id_entrega: 3, id_entregable: 3, nombre: 'Evaluación intermedia', tipo: 'evaluacion', fecha_limite: '2025-04-01', estado: 'pendiente', archivo_url: null, fecha_entrega: null, calificacion: null },
    { id_entrega: 4, id_entregable: 4, nombre: 'Reporte final', tipo: 'reporte', fecha_limite: '2025-05-31', estado: 'pendiente', archivo_url: null, fecha_entrega: null, calificacion: null },
    { id_entrega: 5, id_entregable: 5, nombre: 'Encuesta de satisfacción', tipo: 'encuesta', fecha_limite: '2025-06-10', estado: 'pendiente', archivo_url: null, fecha_entrega: null, calificacion: null },
]

// ─── EVALUACIONES ────────────────────────────────────────────────────────────
export const mockEvaluaciones = [
    { id_evaluacion: 1, alumno: { id_alumno: 1, usuario: { nombre: 'Demo Alumno' } }, entregable: 'Reporte primer mes', estado: 'entregado', archivo_url: 'reporte1.pdf', calificacion: 90, id_entrega: 2 },
    { id_evaluacion: 2, alumno: { id_alumno: 2, usuario: { nombre: 'Sofía Ramírez' } }, entregable: 'Reporte primer mes', estado: 'entregado', archivo_url: 'reporte2.pdf', calificacion: null, id_entrega: 6 },
    { id_evaluacion: 3, alumno: { id_alumno: 3, usuario: { nombre: 'Luis García' } }, entregable: 'Reporte primer mes', estado: 'entregado', archivo_url: 'reporte3.pdf', calificacion: 85, id_entrega: 7 },
]

// ─── HISTORIAL ALUMNO ────────────────────────────────────────────────────────
export const mockHistorialAlumno = [
    { id_historial: 1, empresa: { id_empresa: 1, nombre: 'Tech Solutions SA' }, vacante: { nombre: 'Desarrollador Frontend' }, periodo: { id_periodo: 1, nombre: 'ENE-JUN 2025' }, estado: 'activo', fecha_inicio: '2025-01-13' },
]

// ─── VACANTES ALUMNO (disponibles / mis-vacantes) ────────────────────────────
export const mockVacantesDisponibles = mockVacantes.filter(v => v.activa)

// ─── ROUTES MAP ──────────────────────────────────────────────────────────────
export const MOCK_ROUTES = {
    '/periodos/activos':                    { data: mockPeriodos.filter(p => p.activo) },
    '/periodos':                            { data: mockPeriodos },
    '/empresas':                            { data: mockEmpresas },
    '/alumnos':                             { data: mockAlumnos },
    '/vacantes/disponibles':                { data: mockVacantesDisponibles },
    '/vacantes/mis-vacantes':               { data: mockVacantes.slice(0, 1) },
    '/vacantes':                            { data: mockVacantes },
    '/postulaciones/me':                    { data: mockPostulaciones.slice(0, 1) },
    '/postulaciones':                       { data: mockPostulaciones },
    '/historial/me':                        { data: mockHistorialAlumno },
    '/control-academico/alumno/':           { data: mockControlAcademicoDetalle },
    '/control-academico':                   { data: mockControlAcademico },
    '/entregables/evaluaciones/periodo/':   { data: mockEvaluaciones },
    '/entregables/periodo/':                { data: mockEntregablesPorPeriodo },
    '/entregables/me':                      { data: mockEntregablesAlumno },
    '/documentos/carta-presentacion':       { data: null },
}
