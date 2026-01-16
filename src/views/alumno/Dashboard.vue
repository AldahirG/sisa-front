<script setup>
// PrimeVue
import Card from 'primevue/card';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
</script>

<template>
    <div class="grid">
        <!-- ===================== -->
        <!-- KPIs -->
        <!-- ===================== -->
        <div class="col-12 md:col-6 xl:col-3">
            <div class="card kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Estado</span>
                    <i class="pi pi-briefcase kpi-icon"></i>
                </div>
                <div class="kpi-value">En prácticas</div>
                <Tag value="Activo" severity="success" />
            </div>
        </div>

        <div class="col-12 md:col-6 xl:col-3">
            <div class="card kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Empresa</span>
                    <i class="pi pi-building kpi-icon"></i>
                </div>
                <div class="kpi-value">Pendiente</div>
                <span class="kpi-sub">Asignación en proceso</span>
            </div>
        </div>

        <div class="col-12 md:col-6 xl:col-3">
            <div class="card kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Entregables</span>
                    <i class="pi pi-file kpi-icon"></i>
                </div>
                <div class="kpi-value">2 / 5</div>
                <span class="kpi-sub">Completados</span>
            </div>
        </div>

        <div class="col-12 md:col-6 xl:col-3">
            <div class="card kpi-card">
                <div class="kpi-header">
                    <span class="kpi-label">Avance general</span>
                    <i class="pi pi-chart-line kpi-icon"></i>
                </div>
                <ProgressBar :value="40" />
            </div>
        </div>

        <!-- ===================== -->
        <!-- BLOQUE INFORMATIVO -->
        <!-- ===================== -->
        <div class="col-12 xl:col-6">
            <Card>
                <template #title> Mi situación actual </template>
                <template #content>
                    <p class="mb-3">Te encuentras registrado en el periodo actual de prácticas profesionales. Asegúrate de completar tus entregables en tiempo y forma.</p>

                    <ul class="info-list">
                        <li>
                            <i class="pi pi-check-circle text-green-500"></i>
                            Postulación registrada
                        </li>
                        <li>
                            <i class="pi pi-exclamation-circle text-orange-500"></i>
                            Empresa pendiente de confirmación
                        </li>
                        <li>
                            <i class="pi pi-clock text-blue-500"></i>
                            Próximo entregable en 7 días
                        </li>
                    </ul>
                </template>
            </Card>
        </div>

        <!-- ===================== -->
        <!-- ACCIONES RÁPIDAS -->
        <!-- ===================== -->
        <div class="col-12 xl:col-6">
            <Card>
                <template #title> Acciones rápidas </template>
                <template #content>
                    <div class="quick-actions">
                        <div class="action-item">
                            <i class="pi pi-briefcase"></i>
                            Ver vacantes disponibles
                        </div>
                        <div class="action-item">
                            <i class="pi pi-upload"></i>
                            Subir entregable
                        </div>
                        <div class="action-item">
                            <i class="pi pi-history"></i>
                            Consultar historial académico
                        </div>
                        <div class="action-item">
                            <i class="pi pi-star"></i>
                            Responder encuesta
                        </div>
                    </div>
                </template>
            </Card>
        </div>
    </div>
</template>

<style scoped>
.kpi-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.kpi-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.kpi-label {
    font-size: 0.85rem;
    opacity: 0.7;
}

.kpi-icon {
    font-size: 1.5rem;
    opacity: 0.6;
}

.kpi-value {
    font-size: 1.4rem;
    font-weight: 600;
}

.kpi-sub {
    font-size: 0.9rem;
    opacity: 0.7;
}

.info-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.info-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.quick-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.action-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
}

.action-item:hover {
    background: var(--surface-hover);
}
</style>
