<script setup>
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

// =======================
// STORES & ROUTER
// =======================
const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

// =======================
// STATE
// =======================
const loadingPerfil = ref(false);
const isEdit = ref(false);
const savingProfile = ref(false);
const savingPassword = ref(false);
const showPassword = ref(false);

// =======================
// FORM STATE
// =======================
const form = ref({
    nombre: '',
    correo: '',
    rol: '',
    matricula: '',
    carrera: '',
    cuatrimestre: ''
});

// =======================
// PASSWORD FORM
// =======================
const passwordForm = ref({
    actual: '',
    nueva: '',
    confirmar: ''
});

// =======================
// NORMALIZAR usuario
// El back puede devolver estructura flat (admin) o nested usuario (alumno):
//   admin  → { nombre, correo, rol }
//   alumno → { matricula, carrera, cuatrimestre, estado, usuario: { nombre, correo } }
// =======================
const normalizar = (raw) => ({
    nombre:       raw?.usuario?.nombre  ?? raw?.nombre       ?? '',
    correo:       raw?.usuario?.correo  ?? raw?.correo       ?? '',
    rol:          raw?.rol              ?? raw?.usuario?.rol  ?? '',
    matricula:    raw?.matricula        ?? '',
    carrera:      raw?.carrera          ?? '',
    cuatrimestre: raw?.cuatrimestre     ?? ''
});

// =======================
// COMPUTED
// =======================
const esAdmin = computed(() => (form.value.rol || auth.user?.rol) === 'admin');

const rolLabel = computed(() => (esAdmin.value ? 'Administrador' : 'Alumno'));

const rolSeverity = computed(() => (esAdmin.value ? 'danger' : 'info'));

const userInitials = computed(() => {
    const nombre = form.value.nombre.trim();
    if (!nombre) return '?';
    const partes = nombre.split(/\s+/).filter(Boolean);
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return nombre.slice(0, 2).toUpperCase();
});

// =======================
// FETCH perfil fresco
// =======================
const cargarPerfil = async () => {
    loadingPerfil.value = true;
    try {
        const { data } = await api.get('/perfil');
        const norm = normalizar(data);

        // Si el back no devuelve rol, tomarlo del store (viene del JWT)
        if (!norm.rol) norm.rol = auth.user?.rol ?? '';

        form.value = norm;

        // Sincronizar store con datos frescos
        const userActualizado = { ...auth.user, ...norm };
        auth.login(auth.token, userActualizado);
    } catch {
        // Fallback: leer lo que haya en localStorage
        const norm = normalizar(auth.user);
        if (!norm.rol) norm.rol = auth.user?.rol ?? '';
        form.value = norm;
    } finally {
        loadingPerfil.value = false;
    }
};

onMounted(cargarPerfil);

// =======================
// PROFILE ACTIONS
// =======================
const activarEdicion = () => { isEdit.value = true; };

const cancelarEdicion = () => {
    isEdit.value = false;
    const norm = normalizar(auth.user);
    if (!norm.rol) norm.rol = auth.user?.rol ?? '';
    form.value = norm;
};

const guardarPerfil = async () => {
    if (!form.value.nombre.trim()) {
        toast.add({ severity: 'warn', summary: 'Nombre requerido', detail: 'El nombre no puede estar vacío.', life: 3000 });
        return;
    }

    savingProfile.value = true;
    try {
        const payload = {
            nombre: form.value.nombre.trim(),
            correo: form.value.correo.trim()
        };

        const { data } = await api.put('/perfil', payload);

        // Actualizar store con respuesta del back o con el merge local
        const rawActualizado = data?.user ?? data ?? auth.user;
        const norm = normalizar(rawActualizado);
        if (!norm.rol) norm.rol = auth.user?.rol ?? '';
        // Preservar campos de alumno que el PUT quizás no devuelva
        norm.matricula    = norm.matricula    || form.value.matricula;
        norm.carrera      = norm.carrera      || form.value.carrera;
        norm.cuatrimestre = norm.cuatrimestre || form.value.cuatrimestre;

        auth.login(auth.token, { ...auth.user, ...norm });
        form.value = norm;

        toast.add({ severity: 'success', summary: 'Perfil actualizado', detail: 'Datos guardados correctamente.', life: 3500 });
        isEdit.value = false;
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error al guardar',
            detail: err.response?.data?.message || 'No se pudo actualizar el perfil.',
            life: 4000
        });
    } finally {
        savingProfile.value = false;
    }
};

// =======================
// PASSWORD ACTION
// =======================
const cambiarPassword = async () => {
    if (!passwordForm.value.actual || !passwordForm.value.nueva) {
        toast.add({ severity: 'warn', summary: 'Campos incompletos', detail: 'Ingresa la contraseña actual y la nueva.', life: 3000 });
        return;
    }
    if (passwordForm.value.nueva !== passwordForm.value.confirmar) {
        toast.add({ severity: 'warn', summary: 'Las contraseñas no coinciden', detail: 'Verifica que la nueva contraseña sea igual en ambos campos.', life: 3000 });
        return;
    }

    savingPassword.value = true;
    try {
        await api.post('/auth/change-password', {
            actual: passwordForm.value.actual,
            nueva: passwordForm.value.nueva
        });

        toast.add({ severity: 'success', summary: 'Contraseña actualizada', detail: 'Tu contraseña fue cambiada correctamente.', life: 3500 });
        passwordForm.value = { actual: '', nueva: '', confirmar: '' };
        showPassword.value = false;
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Error',
            detail: err.response?.data?.message || 'No se pudo cambiar la contraseña.',
            life: 4000
        });
    } finally {
        savingPassword.value = false;
    }
};

// =======================
// LOGOUT
// =======================
const logout = () => {
    auth.logout();
    router.push('/login');
};
</script>

<template>
    <div class="page-container">
        <!-- ========================= -->
        <!-- PAGE HEADER               -->
        <!-- ========================= -->
        <div class="page-header">
            <div class="header-icon">
                <i class="pi pi-user"></i>
            </div>
            <div>
                <h1 class="page-title">Mi Perfil</h1>
                <p class="page-subtitle">Administra tu información personal y seguridad</p>
            </div>
        </div>

        <!-- ========================= -->
        <!-- LOADING SKELETON          -->
        <!-- ========================= -->
        <div v-if="loadingPerfil" class="profile-grid">
            <div class="left-col">
                <div class="profile-card avatar-card skeleton-card" style="height:200px" />
                <div class="profile-card skeleton-card" style="height:160px" />
            </div>
            <div class="right-col">
                <div class="profile-card skeleton-card" style="height:320px" />
            </div>
        </div>

        <!-- ========================= -->
        <!-- TWO-COLUMN LAYOUT         -->
        <!-- ========================= -->
        <div v-else class="profile-grid">
            <!-- ===================== -->
            <!-- LEFT — AVATAR CARD    -->
            <!-- ===================== -->
            <div class="left-col">
                <!-- Avatar card -->
                <div class="profile-card avatar-card">
                    <div class="avatar-circle">
                        {{ userInitials }}
                    </div>

                    <div class="avatar-info">
                        <h3 class="avatar-name">{{ form.nombre || '—' }}</h3>
                        <p class="avatar-email">{{ form.correo || '—' }}</p>
                        <Tag :value="rolLabel" :severity="rolSeverity" class="role-tag" />

                        <!-- Alumno quick-info chips -->
                        <div v-if="!esAdmin && form.matricula" class="avatar-chips">
                            <span class="info-chip">
                                <i class="pi pi-id-card"></i>
                                {{ form.matricula }}
                            </span>
                            <span class="info-chip" v-if="form.carrera">
                                <i class="pi pi-book"></i>
                                {{ form.carrera }}
                            </span>
                            <span class="info-chip" v-if="form.cuatrimestre">
                                <i class="pi pi-calendar"></i>
                                {{ form.cuatrimestre }}° cuatrimestre
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Security card -->
                <div class="profile-card security-card">
                    <div class="card-section-title">
                        <i class="pi pi-shield"></i>
                        <span>Seguridad</span>
                    </div>

                    <!-- Toggle password section -->
                    <button
                        class="security-toggle"
                        :class="{ active: showPassword }"
                        @click="showPassword = !showPassword"
                    >
                        <span class="toggle-left">
                            <i class="pi pi-lock"></i>
                            Cambiar contraseña
                        </span>
                        <i class="pi" :class="showPassword ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                    </button>

                    <!-- Password fields (collapsible) -->
                    <div v-if="showPassword" class="password-section">
                        <div class="field">
                            <label class="field-label">Contraseña actual</label>
                            <InputText v-model="passwordForm.actual" type="password" placeholder="••••••••" class="w-full" />
                        </div>
                        <div class="field">
                            <label class="field-label">Nueva contraseña</label>
                            <InputText v-model="passwordForm.nueva" type="password" placeholder="••••••••" class="w-full" />
                        </div>
                        <div class="field">
                            <label class="field-label">Confirmar nueva contraseña</label>
                            <InputText v-model="passwordForm.confirmar" type="password" placeholder="••••••••" class="w-full" />
                        </div>
                        <Button label="Guardar contraseña" icon="pi pi-check" size="small" class="w-full" :loading="savingPassword" @click="cambiarPassword" />
                    </div>

                    <div class="security-divider"></div>

                    <Button label="Cerrar sesión" icon="pi pi-sign-out" severity="danger" outlined class="w-full logout-btn" @click="logout" />
                </div>
            </div>

            <!-- ===================== -->
            <!-- RIGHT — FORM CARD     -->
            <!-- ===================== -->
            <div class="right-col">
                <div class="profile-card form-card">
                    <div class="card-header-row">
                        <div class="card-section-title">
                            <i class="pi pi-id-card"></i>
                            <span>Información del perfil</span>
                        </div>

                        <div class="card-actions">
                            <template v-if="!isEdit">
                                <Button label="Editar perfil" icon="pi pi-pencil" size="small" outlined @click="activarEdicion" />
                            </template>
                            <template v-else>
                                <Button label="Cancelar" icon="pi pi-times" size="small" text @click="cancelarEdicion" />
                                <Button label="Guardar cambios" icon="pi pi-check" size="small" :loading="savingProfile" @click="guardarPerfil" />
                            </template>
                        </div>
                    </div>

                    <div v-if="isEdit" class="edit-banner">
                        <i class="pi pi-info-circle"></i>
                        <span>Modo edición activo. Solo nombre y correo son editables.</span>
                    </div>

                    <!-- Form grid -->
                    <div class="form-grid">
                        <!-- Nombre completo (campo único, no apellido separado) -->
                        <div class="field field-full">
                            <label class="field-label">Nombre completo</label>
                            <InputText
                                v-model="form.nombre"
                                :disabled="!isEdit"
                                :class="{ 'input-readonly': !isEdit }"
                                placeholder="Nombre completo"
                                class="w-full"
                            />
                        </div>

                        <div class="field">
                            <label class="field-label">Correo electrónico</label>
                            <InputText
                                v-model="form.correo"
                                :disabled="!isEdit"
                                :class="{ 'input-readonly': !isEdit }"
                                class="w-full"
                            />
                        </div>

                        <div class="field">
                            <label class="field-label">Rol</label>
                            <InputText :value="rolLabel" disabled class="w-full input-readonly" />
                        </div>

                        <!-- Alumno-only fields -->
                        <template v-if="!esAdmin">
                            <div class="field">
                                <label class="field-label">Matrícula</label>
                                <InputText v-model="form.matricula" disabled class="w-full input-readonly" />
                            </div>

                            <div class="field">
                                <label class="field-label">Carrera</label>
                                <InputText v-model="form.carrera" disabled class="w-full input-readonly" />
                            </div>

                            <div class="field">
                                <label class="field-label">Cuatrimestre</label>
                                <InputText :value="form.cuatrimestre ? `${form.cuatrimestre}°` : '—'" disabled class="w-full input-readonly" />
                            </div>
                        </template>
                    </div>

                    <!-- Footer note -->
                    <p class="form-note">
                        <i class="pi pi-lock"></i>
                        Matrícula, carrera y rol no son editables. Contacta a administración si hay un error.
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ================================
   PAGE
================================ */
.page-container {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* ================================
   PAGE HEADER
================================ */
.page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.header-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.12));
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
}

.page-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0;
    line-height: 1.2;
}

.page-subtitle {
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
    margin: 0.15rem 0 0 0;
}

/* ================================
   GRID LAYOUT
================================ */
.profile-grid {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1.25rem;
    align-items: start;
}

.left-col,
.right-col {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

/* ================================
   CARD BASE
================================ */
.profile-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 14px;
    padding: 1.5rem;
}

/* ================================
   AVATAR CARD
================================ */
.avatar-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
}

.avatar-circle {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    background: var(--sisa-primary, #0F3C61);
    color: #fff;
    font-size: 2rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    letter-spacing: -0.5px;
    box-shadow: 0 4px 16px rgba(15, 60, 97, 0.25);
    user-select: none;
}

.avatar-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
}

.avatar-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0;
}

.avatar-email {
    font-size: 0.82rem;
    color: var(--p-text-muted-color);
    margin: 0;
    word-break: break-all;
}

.role-tag {
    margin-top: 0.15rem;
}

/* ================================
   SECURITY CARD
================================ */
.security-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.card-section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin-bottom: 0.25rem;
}

.card-section-title .pi {
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
}

.security-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.65rem 0.85rem;
    border-radius: 8px;
    border: 1px solid var(--p-content-border-color);
    background: var(--p-surface-50);
    color: var(--p-text-color);
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.18s, border-color 0.18s;
    text-align: left;
}

.security-toggle:hover,
.security-toggle.active {
    border-color: var(--sisa-primary-l, #1565C0);
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.06));
}

.toggle-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.password-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 8px;
    background: var(--p-surface-50);
    border: 1px solid var(--p-content-border-color);
}

.security-divider {
    height: 1px;
    background: var(--p-content-border-color);
    margin: 0.25rem 0;
}

.logout-btn {
    justify-content: center;
}

/* ================================
   FORM CARD
================================ */
.form-card {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.card-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
}

.card-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.edit-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    border-radius: 8px;
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.08));
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
    font-size: 0.85rem;
    border: 1px solid var(--sisa-primary-l, #1565C0);
    border-opacity: 0.25;
}

/* ================================
   FORM FIELDS
================================ */
.form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.field-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--p-text-muted-color);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.field-full {
    grid-column: 1 / -1;
}

.input-readonly {
    opacity: 0.75;
}

/* ================================
   AVATAR CHIPS (alumno quick-info)
================================ */
.avatar-chips {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.35rem;
    width: 100%;
}

.info-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.78rem;
    font-weight: 500;
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.08));
    color: var(--sisa-icon-blue, var(--sisa-primary-l, #1565C0));
    border: 1px solid rgba(21, 101, 192, 0.18);
    white-space: nowrap;
}

.info-chip .pi {
    font-size: 0.72rem;
}

.form-note {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--p-text-muted-color);
    margin: 0;
    padding-top: 0.25rem;
    border-top: 1px solid var(--p-content-border-color);
}

.form-note .pi {
    font-size: 0.75rem;
}

/* ================================
   UTILITY
================================ */
.w-full {
    width: 100%;
}

/* ================================
   RESPONSIVE
================================ */
@media (max-width: 860px) {
    .profile-grid {
        grid-template-columns: 1fr;
    }

    .form-grid {
        grid-template-columns: 1fr;
    }

    .avatar-circle {
        width: 72px;
        height: 72px;
        font-size: 1.6rem;
    }
}
</style>
