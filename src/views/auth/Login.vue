<template>
    <div class="login-wrapper">
        <Toast position="top-right" />

        <!-- ════════════════════════════════
             PANEL IZQUIERDO — Marca
        ════════════════════════════════ -->
        <div class="brand-panel" aria-hidden="true">
            <div class="brand-content">
                <!-- Logo -->
                <div class="brand-logo">
                    <svg viewBox="0 0 54 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="brand-svg">
                        <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M17.1637 19.2467C17.1566 19.4033 17.1529 19.561 17.1529 19.7194C17.1529 25.3503 21.7203 29.915 27.3546 29.915C32.9887 29.915 37.5561 25.3503 37.5561 19.7194C37.5561 19.5572 37.5524 19.3959 37.5449 19.2355C38.5617 19.0801 39.5759 18.9013 40.5867 18.6994L40.6926 18.6782C40.7191 19.0218 40.7326 19.369 40.7326 19.7194C40.7326 27.1036 34.743 33.0896 27.3546 33.0896C19.966 33.0896 13.9765 27.1036 13.9765 19.7194C13.9765 19.374 13.9896 19.0316 14.0154 18.6927L14.0486 18.6994C15.0837 18.9062 16.1223 19.0886 17.1637 19.2467ZM33.3284 11.4538C31.6493 10.2396 29.5855 9.52381 27.3546 9.52381C25.1195 9.52381 23.0524 10.2421 21.3717 11.4603C20.0078 11.3232 18.6475 11.1387 17.2933 10.907C19.7453 8.11308 23.3438 6.34921 27.3546 6.34921C31.36 6.34921 34.9543 8.10844 37.4061 10.896C36.0521 11.1292 34.692 11.3152 33.3284 11.4538ZM43.826 18.0518C43.881 18.6003 43.9091 19.1566 43.9091 19.7194C43.9091 28.8568 36.4973 36.2642 27.3546 36.2642C18.2117 36.2642 10.8 28.8568 10.8 19.7194C10.8 19.1615 10.8276 18.61 10.8816 18.0663L7.75383 17.4411C7.66775 18.1886 7.62354 18.9488 7.62354 19.7194C7.62354 30.6102 16.4574 39.4388 27.3546 39.4388C38.2517 39.4388 47.0855 30.6102 47.0855 19.7194C47.0855 18.9439 47.0407 18.1789 46.9536 17.4267L43.826 18.0518ZM44.2613 9.54743L40.9084 10.2176C37.9134 5.95821 32.9593 3.1746 27.3546 3.1746C21.7442 3.1746 16.7856 5.96385 13.7915 10.2305L10.4399 9.56057C13.892 3.83178 20.1756 0 27.3546 0C34.5281 0 40.8075 3.82591 44.2613 9.54743Z"
                            fill="rgba(255,255,255,0.95)"
                        />
                    </svg>
                    <span class="brand-name">SISA</span>
                </div>

                <!-- Tagline -->
                <h1 class="brand-title">Sistema de Gestión de Prácticas Profesionales</h1>
                <p class="brand-subtitle">Conectamos estudiantes con oportunidades reales de crecimiento académico y profesional.</p>

                <!-- Features -->
                <ul class="features-list">
                    <li>
                        <i class="pi pi-briefcase feature-icon"></i>
                        <span>Explora vacantes en empresas verificadas</span>
                    </li>
                    <li>
                        <i class="pi pi-upload feature-icon"></i>
                        <span>Entrega y da seguimiento a tus documentos</span>
                    </li>
                    <li>
                        <i class="pi pi-chart-line feature-icon"></i>
                        <span>Monitorea tu avance académico en tiempo real</span>
                    </li>
                    <li>
                        <i class="pi pi-graduation-cap feature-icon"></i>
                        <span>Gestión completa del periodo de prácticas</span>
                    </li>
                </ul>
            </div>

            <!-- Decoración de fondo -->
            <div class="brand-decoration brand-circle-1"></div>
            <div class="brand-decoration brand-circle-2"></div>
        </div>

        <!-- ════════════════════════════════
             PANEL DERECHO — Formulario
        ════════════════════════════════ -->
        <div class="form-panel">
            <div class="form-container">
                <!-- Logo para móvil (oculto en desktop) -->
                <div class="mobile-logo">
                    <svg viewBox="0 0 54 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="mobile-svg">
                        <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M17.1637 19.2467C17.1566 19.4033 17.1529 19.561 17.1529 19.7194C17.1529 25.3503 21.7203 29.915 27.3546 29.915C32.9887 29.915 37.5561 25.3503 37.5561 19.7194C37.5561 19.5572 37.5524 19.3959 37.5449 19.2355C38.5617 19.0801 39.5759 18.9013 40.5867 18.6994L40.6926 18.6782C40.7191 19.0218 40.7326 19.369 40.7326 19.7194C40.7326 27.1036 34.743 33.0896 27.3546 33.0896C19.966 33.0896 13.9765 27.1036 13.9765 19.7194C13.9765 19.374 13.9896 19.0316 14.0154 18.6927L14.0486 18.6994C15.0837 18.9062 16.1223 19.0886 17.1637 19.2467ZM33.3284 11.4538C31.6493 10.2396 29.5855 9.52381 27.3546 9.52381C25.1195 9.52381 23.0524 10.2421 21.3717 11.4603C20.0078 11.3232 18.6475 11.1387 17.2933 10.907C19.7453 8.11308 23.3438 6.34921 27.3546 6.34921C31.36 6.34921 34.9543 8.10844 37.4061 10.896C36.0521 11.1292 34.692 11.3152 33.3284 11.4538ZM43.826 18.0518C43.881 18.6003 43.9091 19.1566 43.9091 19.7194C43.9091 28.8568 36.4973 36.2642 27.3546 36.2642C18.2117 36.2642 10.8 28.8568 10.8 19.7194C10.8 19.1615 10.8276 18.61 10.8816 18.0663L7.75383 17.4411C7.66775 18.1886 7.62354 18.9488 7.62354 19.7194C7.62354 30.6102 16.4574 39.4388 27.3546 39.4388C38.2517 39.4388 47.0855 30.6102 47.0855 19.7194C47.0855 18.9439 47.0407 18.1789 46.9536 17.4267L43.826 18.0518ZM44.2613 9.54743L40.9084 10.2176C37.9134 5.95821 32.9593 3.1746 27.3546 3.1746C21.7442 3.1746 16.7856 5.96385 13.7915 10.2305L10.4399 9.56057C13.892 3.83178 20.1756 0 27.3546 0C34.5281 0 40.8075 3.82591 44.2613 9.54743Z"
                            fill="#0F3C61"
                        />
                    </svg>
                    <span class="mobile-brand-name">SISA</span>
                </div>

                <!-- Encabezado del formulario -->
                <div class="form-header">
                    <h2 class="form-title">Bienvenido de vuelta</h2>
                    <p class="form-subtitle">Ingresa con tus credenciales institucionales</p>
                </div>

                <!-- Campos -->
                <div class="form-fields">
                    <div class="field-group">
                        <label for="correo" class="field-label">Correo institucional</label>
                        <IconField>
                            <InputIcon class="pi pi-envelope" />
                            <InputText
                                id="correo"
                                v-model="correo"
                                type="email"
                                placeholder="usuario@institucion.edu.mx"
                                class="w-full field-input"
                                autocomplete="email"
                                @keyup.enter="login"
                            />
                        </IconField>
                    </div>

                    <div class="field-group">
                        <label for="password" class="field-label">Contraseña</label>
                        <Password
                            id="password"
                            v-model="password"
                            toggleMask
                            :feedback="false"
                            class="w-full"
                            inputClass="w-full field-input"
                            placeholder="••••••••"
                            autocomplete="current-password"
                            @keyup.enter="login"
                        />
                    </div>
                </div>

                <!-- Botón -->
                <Button
                    label="Ingresar al sistema"
                    icon="pi pi-sign-in"
                    iconPos="right"
                    class="w-full login-btn"
                    :loading="loading"
                    @click="login"
                />

                <!-- Footer del formulario -->
                <div class="form-footer">
                    <i class="pi pi-info-circle footer-icon"></i>
                    <span>¿Problemas para acceder? Contacta a tu coordinador académico.</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

// PrimeVue
import Button from 'primevue/button';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

const correo = ref('');
const password = ref('');
const loading = ref(false);

const router = useRouter();
const auth = useAuthStore();
const toast = useToast();

const login = async () => {
    if (!correo.value || !password.value) {
        toast.add({
            severity: 'warn',
            summary: 'Campos requeridos',
            detail: 'Por favor ingresa tu correo y contraseña.',
            life: 3500
        });
        return;
    }

    try {
        loading.value = true;

        const { data } = await api.post('/auth/login', {
            correo: correo.value,
            password: password.value
        });

        auth.login(data.access_token, data.user);

        if (data.user.rol === 'admin') {
            router.push('/admin/dashboard');
        } else {
            router.push('/alumno/dashboard');
        }
    } catch (error) {
        const status = error.response?.status;
        const isUnauthorized = status === 401 || status === 403;

        toast.add({
            severity: 'error',
            summary: isUnauthorized ? 'Credenciales incorrectas' : 'Error de conexión',
            detail: isUnauthorized
                ? 'El correo o la contraseña no son válidos. Verifica e intenta de nuevo.'
                : 'No se pudo conectar con el servidor. Intenta más tarde.',
            life: 5000
        });
    } finally {
        loading.value = false;
    }
};
</script>

<style scoped>
/* ════════════════════════════════════════
   VARIABLES INSTITUCIONALES
════════════════════════════════════════ */
.login-wrapper {
    --sisa-primary:   #0F3C61;
    --sisa-primary-l: #1565C0;
    --sisa-border:    #e2e8f0;
    --sisa-text:      #1e293b;
    --sisa-muted:     #64748b;
}

/* ════════════════════════════════════════
   LAYOUT RAÍZ
════════════════════════════════════════ */
.login-wrapper {
    display: flex;
    min-height: 100vh;
    background-color: #f8fafc;
}

/* ════════════════════════════════════════
   PANEL IZQUIERDO — MARCA
════════════════════════════════════════ */
.brand-panel {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 45%;
    min-height: 100vh;
    background: linear-gradient(145deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    overflow: hidden;
    padding: 3rem;
    box-sizing: border-box;
}

.brand-content {
    position: relative;
    z-index: 2;
    color: #fff;
    max-width: 380px;
}

/* Logo */
.brand-logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 2.5rem;
}

.brand-svg {
    width: 3rem;
    height: auto;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.25));
}

.brand-name {
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #fff;
}

/* Textos de marca */
.brand-title {
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.3;
    margin: 0 0 1rem;
    color: #fff;
}

.brand-subtitle {
    font-size: 0.95rem;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.78);
    margin: 0 0 2.5rem;
}

/* Features list */
.features-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.features-list li {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.88);
}

.feature-icon {
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.95);
    padding: 0.5rem;
    box-sizing: border-box;
}

/* Decoraciones circulares */
.brand-decoration {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    z-index: 1;
}

.brand-circle-1 {
    width: 380px;
    height: 380px;
    bottom: -100px;
    right: -80px;
}

.brand-circle-2 {
    width: 220px;
    height: 220px;
    top: -60px;
    left: -60px;
    background: rgba(255, 255, 255, 0.07);
}

/* ════════════════════════════════════════
   PANEL DERECHO — FORMULARIO
════════════════════════════════════════ */
.form-panel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: #fff;
}

.form-container {
    width: 100%;
    max-width: 420px;
}

/* Logo móvil */
.mobile-logo {
    display: none;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    margin-bottom: 2rem;
}

.mobile-svg {
    width: 2.25rem;
    height: auto;
}

.mobile-brand-name {
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--sisa-primary);
}

/* Encabezado */
.form-header {
    margin-bottom: 2rem;
}

.form-title {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--sisa-text);
    margin: 0 0 0.375rem;
}

.form-subtitle {
    font-size: 0.9rem;
    color: var(--sisa-muted);
    margin: 0;
}

/* Campos */
.form-fields {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-bottom: 1.75rem;
}

.field-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.field-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sisa-text);
}

:deep(.field-input) {
    height: 2.75rem;
    border-radius: 8px;
    border-color: var(--sisa-border);
    font-size: 0.925rem;
    transition: border-color 0.2s, box-shadow 0.2s;
}

:deep(.field-input:focus) {
    border-color: var(--sisa-primary-l);
    box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.12);
}

/* Password wrappers */
:deep(.p-password) {
    width: 100%;
}

:deep(.p-password-input) {
    height: 2.75rem;
    border-radius: 8px;
    border-color: var(--sisa-border);
    font-size: 0.925rem;
    transition: border-color 0.2s, box-shadow 0.2s;
}

:deep(.p-password-input:focus) {
    border-color: var(--sisa-primary-l);
    box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.12);
}

/* Botón principal */
.login-btn {
    height: 2.875rem;
    font-size: 0.95rem;
    font-weight: 600;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--sisa-primary) 0%, var(--sisa-primary-l) 100%);
    border-color: transparent;
    letter-spacing: 0.02em;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 4px 14px rgba(15, 60, 97, 0.35);
}

.login-btn:hover:not(:disabled) {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(15, 60, 97, 0.45);
}

.login-btn:active:not(:disabled) {
    transform: translateY(0);
}

/* Footer */
.form-footer {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding: 0.875rem 1rem;
    background: #f8fafc;
    border: 1px solid var(--sisa-border);
    border-radius: 8px;
    font-size: 0.8rem;
    color: var(--sisa-muted);
    line-height: 1.5;
}

.footer-icon {
    flex-shrink: 0;
    margin-top: 1px;
    color: var(--sisa-primary-l);
    font-size: 0.85rem;
}

/* ════════════════════════════════════════
   RESPONSIVE — Tablet y Móvil
════════════════════════════════════════ */
@media (max-width: 900px) {
    .brand-panel {
        display: none;
    }

    .form-panel {
        background: linear-gradient(160deg, #f0f7ff 0%, #fff 60%);
    }

    .mobile-logo {
        display: flex;
    }
}

@media (max-width: 480px) {
    .form-panel {
        padding: 1.5rem 1.25rem;
        align-items: flex-start;
        padding-top: 3rem;
    }

    .form-container {
        max-width: 100%;
    }
}
</style>
