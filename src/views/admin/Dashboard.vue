<script setup>
// PrimeVue Components
import Card from 'primevue/card';
import ProgressBar from 'primevue/progressbar';
</script>

<template>
    <div class="grid">
        <!-- ===================== -->
        <!-- KPIs SUPERIORES -->
        <!-- ===================== -->
        <div class="col-12 md:col-6 xl:col-3">
            <div class="card">
                <div class="flex justify-between mb-3">
                    <div>
                        <span class="block text-muted-color font-medium mb-1">Periodos activos</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">1</div>
                    </div>
                    <div class="flex items-center justify-center bg-blue-100 dark:bg-blue-900 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-calendar text-blue-500 text-xl"></i>
                    </div>
                </div>
                <span class="text-green-500 font-medium">Activo</span>
            </div>
        </div>

        <div class="col-12 md:col-6 xl:col-3">
            <div class="card">
                <div class="flex justify-between mb-3">
                    <div>
                        <span class="block text-muted-color font-medium mb-1">Empresas registradas</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">24</div>
                    </div>
                    <div class="flex items-center justify-center bg-orange-100 dark:bg-orange-900 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-building text-orange-500 text-xl"></i>
                    </div>
                </div>
                <span class="text-muted-color">Convenios activos</span>
            </div>
        </div>

        <div class="col-12 md:col-6 xl:col-3">
            <div class="card">
                <div class="flex justify-between mb-3">
                    <div>
                        <span class="block text-muted-color font-medium mb-1">Alumnos activos</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">128</div>
                    </div>
                    <div class="flex items-center justify-center bg-green-100 dark:bg-green-900 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-users text-green-500 text-xl"></i>
                    </div>
                </div>
                <span class="text-muted-color">En prácticas</span>
            </div>
        </div>

        <div class="col-12 md:col-6 xl:col-3">
            <div class="card">
                <div class="flex justify-between mb-3">
                    <div>
                        <span class="block text-muted-color font-medium mb-1">Encuestas respondidas</span>
                        <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">86%</div>
                    </div>
                    <div class="flex items-center justify-center bg-purple-100 dark:bg-purple-900 rounded-border" style="width: 2.5rem; height: 2.5rem">
                        <i class="pi pi-star text-purple-500 text-xl"></i>
                    </div>
                </div>
                <ProgressBar :value="86" />
            </div>
        </div>

        <!-- ===================== -->
        <!-- BLOQUES INFORMATIVOS -->
        <!-- ===================== -->
        <div class="col-12 xl:col-6">
            <Card>
                <template #title> Estado general del periodo </template>
                <template #content>
                    <p class="mb-3">El periodo actual se encuentra <strong>activo</strong>. Aún hay alumnos con entregables pendientes.</p>

                    <ul class="list-none p-0 m-0">
                        <li class="flex align-items-center mb-2">
                            <i class="pi pi-check-circle text-green-500 mr-2"></i>
                            78 alumnos con entregables completos
                        </li>
                        <li class="flex align-items-center mb-2">
                            <i class="pi pi-exclamation-circle text-orange-500 mr-2"></i>
                            34 alumnos con entregables pendientes
                        </li>
                        <li class="flex align-items-center">
                            <i class="pi pi-times-circle text-red-500 mr-2"></i>
                            16 alumnos sin encuesta respondida
                        </li>
                    </ul>
                </template>
            </Card>
        </div>

        <div class="col-12 xl:col-6">
            <Card>
                <template #title> Acciones rápidas </template>
                <template #content>
                    <div class="flex flex-column gap-3">
                        <div class="flex align-items-center">
                            <i class="pi pi-plus-circle text-primary mr-3 text-xl"></i>
                            Crear nuevo periodo académico
                        </div>
                        <div class="flex align-items-center">
                            <i class="pi pi-file text-primary mr-3 text-xl"></i>
                            Configurar entregables del periodo
                        </div>
                        <div class="flex align-items-center">
                            <i class="pi pi-building text-primary mr-3 text-xl"></i>
                            Registrar nueva empresa
                        </div>
                        <div class="flex align-items-center">
                            <i class="pi pi-chart-line text-primary mr-3 text-xl"></i>
                            Ver evaluaciones finales
                        </div>
                    </div>
                </template>
            </Card>
        </div>
    </div>
</template>
