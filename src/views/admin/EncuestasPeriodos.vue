<script setup>
import api from '@/api/axios';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import { useToast } from '@/composables/useAppToast';

const toast   = useToast();
const router  = useRouter();

const loading   = ref(true);
const periodos  = ref([]);
const encuestas = ref([]);

onMounted(async () => {
    try {
        const [pRes, eRes] = await Promise.all([api.get('/periodos'), api.get('/encuestas')]);
        periodos.value  = pRes.data  ?? [];
        encuestas.value = eRes.data  ?? [];
    } catch {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los periodos.', life: 4000 });
    } finally {
        loading.value = false;
    }
});

// Sólo muestra periodos que tienen al menos una encuesta
const periodosConEncuesta = computed(() => {
    const idsConEnc = new Set(encuestas.value.map(e => e.periodo?.id_periodo).filter(Boolean));
    return periodos.value
        .filter(p => idsConEnc.has(p.id_periodo))
        .sort((a, b) => {
            if (a.estado === 'activo' && b.estado !== 'activo') return -1;
            if (b.estado === 'activo' && a.estado !== 'activo') return 1;
            return (b.id_periodo - a.id_periodo);
        });
});

const encuestasDePeriodo = (periodoId) =>
    encuestas.value.filter(e => e.periodo?.id_periodo === periodoId);

const participacionDePeriodo = (periodoId) => {
    // Promedio de respondidos vs asignados a través de las encuestas del periodo
    // (si la API no los trae, mostramos null y ocultamos la barra)
    return null;
};

const irADetalle = (periodo) => {
    router.push({ name: 'admin-encuestas-detalle', params: { periodoId: periodo.id_periodo } });
};

const formatRange = (p) => {
    const fmt = (d) => d ? new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    const ini = fmt(p.fecha_inicio);
    const fin = fmt(p.fecha_fin);
    if (ini && fin) return `${ini} – ${fin}`;
    return ini ?? fin ?? '—';
};
</script>

<template>
    <div class="ep-page">
        <Toast />

        <!-- ── Header ── -->
        <div class="page-header">
            <div class="page-title-group">
                <span class="page-icon"><i class="pi pi-clipboard" /></span>
                <div>
                    <h4 class="page-title">Encuestas</h4>
                    <p class="page-subtitle">Selecciona un periodo para gestionar sus encuestas</p>
                </div>
            </div>
        </div>

        <!-- ── Loading ── -->
        <div v-if="loading" class="ep-loading">
            <i class="pi pi-spin pi-spinner ep-loading-icon"></i>
            <span>Cargando periodos…</span>
        </div>

        <!-- ── Empty global ── -->
        <div v-else-if="periodosConEncuesta.length === 0" class="ep-empty">
            <div class="ep-empty-icon"><i class="pi pi-clipboard"></i></div>
            <p class="ep-empty-title">Sin encuestas registradas</p>
            <p class="ep-empty-desc">Selecciona un periodo desde el menú de periodos y crea la primera encuesta.</p>
        </div>

        <!-- ── Grid de tarjetas ── -->
        <div v-else class="ep-grid">
            <div
                v-for="p in periodosConEncuesta"
                :key="p.id_periodo"
                class="ep-card"
                :class="p.estado === 'activo' ? 'ep-card--activo' : 'ep-card--cerrado'"
                @click="irADetalle(p)"
                tabindex="0"
                role="button"
                :aria-label="`Abrir encuestas del periodo ${p.nombre}`"
                @keydown.enter.space.prevent="irADetalle(p)"
            >
                <div class="ep-card-inner">
                    <!-- Top row -->
                    <div class="ep-card-top">
                        <span class="ep-card-name">{{ p.nombre }}</span>
                        <span class="ep-chip" :class="p.estado === 'activo' ? 'ep-chip--ok' : 'ep-chip--grey'">
                            {{ p.estado === 'activo' ? 'Activo' : 'Cerrado' }}
                        </span>
                    </div>

                    <!-- Meta -->
                    <div class="ep-card-meta">
                        <span class="ep-meta-row">
                            <i class="pi pi-calendar ep-meta-icon"></i>
                            {{ formatRange(p) }}
                        </span>
                    </div>

                    <!-- Encuestas list -->
                    <div class="ep-enc-list">
                        <div
                            v-for="e in encuestasDePeriodo(p.id_periodo)"
                            :key="e.id_encuesta"
                            class="ep-enc-row"
                        >
                            <span class="ep-enc-dot" :class="e.activa ? 'ep-dot--green' : 'ep-dot--grey'"></span>
                            <span class="ep-enc-nombre">{{ e.nombre }}</span>
                            <span class="ep-enc-q">{{ e.total_preguntas ?? e.preguntas?.length ?? 0 }} preg.</span>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="ep-card-footer">
                    <span class="ep-enc-count">
                        <i class="pi pi-list-check"></i>
                        <strong>{{ encuestasDePeriodo(p.id_periodo).length }}</strong>
                        {{ encuestasDePeriodo(p.id_periodo).length === 1 ? 'encuesta' : 'encuestas' }}
                    </span>
                    <span class="ep-ver-link">
                        Ver encuestas
                        <i class="pi pi-chevron-right"></i>
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ep-page {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

/* ── Header (reutiliza clases globales de PrimeVue layout) ── */
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}
.page-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
}
.page-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--p-primary-100, #dbeafe);
    color: var(--p-primary-600, #2563eb);
    font-size: 16px;
}
.page-title  { margin: 0; font-size: 1.1rem; font-weight: 700; }
.page-subtitle { margin: 2px 0 0; font-size: 0.82rem; color: var(--p-text-muted-color, #64748b); }

/* ── Loading ── */
.ep-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 48px 0;
    justify-content: center;
    color: var(--p-text-muted-color, #64748b);
}
.ep-loading-icon { font-size: 1.4rem; }

/* ── Empty ── */
.ep-empty {
    text-align: center;
    padding: 64px 24px;
}
.ep-empty-icon {
    width: 56px; height: 56px; border-radius: 50%;
    background: var(--surface-ground);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem;
    color: var(--p-text-muted-color, #94a3b8);
    margin: 0 auto 16px;
}
.ep-empty-title { font-size: 1rem; font-weight: 600; margin: 0 0 6px; }
.ep-empty-desc  { font-size: 0.85rem; color: var(--p-text-muted-color, #64748b); margin: 0; }

/* ── Grid ── */
.ep-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 16px;
}

/* ── Card ── */
.ep-card {
    background: var(--surface-card);
    border: 1px solid var(--sisa-border);
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition: box-shadow 0.2s, transform 0.15s;
    outline-offset: 2px;
}
.ep-card:hover {
    box-shadow: 0 4px 20px rgba(37, 99, 235, 0.12);
    transform: translateY(-2px);
}
.ep-card:focus-visible { outline: 2px solid var(--p-primary-500, #3b82f6); }

.ep-card-inner {
    padding: 18px 18px 14px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-left: 3px solid transparent;
}
.ep-card--activo  .ep-card-inner { border-color: var(--p-primary-500, #3b82f6); }
.ep-card--cerrado .ep-card-inner { border-color: var(--p-surface-400, #94a3b8); }

.ep-card-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
}
.ep-card-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--p-text-color, #0f172a);
    line-height: 1.3;
}

/* Chip */
.ep-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 9px;
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
}
.ep-chip--ok   { background: var(--p-green-100, #dcfce7); color: var(--p-green-700, #15803d); }
.ep-chip--grey { background: var(--surface-ground); color: var(--p-text-muted-color, #64748b); }

/* Meta */
.ep-card-meta { display: flex; flex-direction: column; gap: 4px; }
.ep-meta-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: var(--p-text-muted-color, #64748b);
}
.ep-meta-icon { font-size: 0.75rem; flex-shrink: 0; }

/* Encuestas list */
.ep-enc-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.ep-enc-row {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 0.8rem;
}
.ep-enc-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
}
.ep-dot--green { background: var(--p-green-500, #22c55e); }
.ep-dot--grey  { background: var(--p-surface-400, #94a3b8); }
.ep-enc-nombre {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--p-text-color, #0f172a);
}
.ep-enc-q {
    font-size: 0.72rem;
    color: var(--p-text-muted-color, #94a3b8);
    white-space: nowrap;
    flex-shrink: 0;
}

/* Card footer */
.ep-card-footer {
    border-top: 1px solid var(--sisa-border);
    padding: 10px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--surface-ground);
}
.ep-enc-count {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.78rem;
    color: var(--p-text-muted-color, #64748b);
}
.ep-enc-count strong { color: var(--p-text-color, #0f172a); }
.ep-enc-count .pi { font-size: 0.75rem; }
.ep-ver-link {
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--p-primary-600, #2563eb);
    display: flex;
    align-items: center;
    gap: 4px;
}
.ep-ver-link .pi { font-size: 0.72rem; }
</style>
