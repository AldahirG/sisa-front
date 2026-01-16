<script setup>
import { useAuthStore } from '@/store/auth';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

// PrimeVue
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Tag from 'primevue/tag';

// =======================
// STORES & ROUTER
// =======================
const auth = useAuthStore();
const router = useRouter();

// =======================
// STATE
// =======================
const isEdit = ref(false);

// =======================
// FORM STATE
// =======================
const form = ref({
    nombre: '',
    apellido: '',
    correo: '',
    rol: '',
    matricula: '',
    programa: ''
});

// =======================
// PASSWORD FORM
// =======================
const passwordForm = ref({
    actual: '',
    nueva: ''
});

// =======================
// COMPUTED
// =======================
const esAdmin = computed(() => auth.user?.rol === 'admin');

const rolLabel = computed(() => (esAdmin.value ? 'Administrador' : 'Alumno'));

// =======================
// INIT DATA
// =======================
onMounted(() => {
    if (!auth.user) return;

    form.value = {
        nombre: auth.user.nombre || '',
        apellido: auth.user.apellido || '',
        correo: auth.user.correo || '',
        rol: auth.user.rol || '',
        matricula: auth.user.matricula || '',
        programa: auth.user.programa || ''
    };
});

// =======================
// ACTIONS
// =======================
const activarEdicion = () => {
    isEdit.value = true;
};

const cancelarEdicion = () => {
    isEdit.value = false;

    // Restaurar valores originales
    if (!auth.user) return;
    form.value = {
        nombre: auth.user.nombre || '',
        apellido: auth.user.apellido || '',
        correo: auth.user.correo || '',
        rol: auth.user.rol || '',
        matricula: auth.user.matricula || '',
        programa: auth.user.programa || ''
    };
};

const guardarPerfil = async () => {
    // 🔜 Aquí va el PUT /users/me
    // await api.put('/users/me', form.value)

    isEdit.value = false;
};

const cambiarPassword = async () => {
    // 🔜 POST /users/change-password
    passwordForm.value.actual = '';
    passwordForm.value.nueva = '';
};

const logout = () => {
    auth.logout();
    router.push('/login');
};
</script>

<template>
    <div class="profile-page">
        <div class="profile-container">
            <!-- HEADER -->
            <div class="profile-header">
                <h2>Perfil de usuario</h2>
                <Tag :value="rolLabel" severity="info" />
            </div>

            <div class="profile-grid">
                <!-- LEFT -->
                <div class="profile-left">
                    <div class="card avatar-card">
                        <div class="avatar">
                            {{ auth.user?.nombre?.charAt(0) }}
                        </div>

                        <h4>{{ auth.user?.nombre }} {{ auth.user?.apellido }}</h4>
                        <small>{{ auth.user?.correo }}</small>

                        <Button label="Subir foto" icon="pi pi-upload" text class="mt-3" />
                    </div>

                    <div class="card mt-3">
                        <h4>Seguridad</h4>

                        <Button label="Cambiar contraseña" icon="pi pi-lock" outlined class="w-full mt-2" />

                        <Button label="Cerrar sesión" icon="pi pi-sign-out" severity="danger" outlined class="w-full mt-3" @click="logout" />
                    </div>
                </div>

                <!-- RIGHT -->
                <div class="profile-right">
                    <div class="card">
                        <h4>Información del perfil</h4>

                        <div class="form-grid">
                            <div class="field">
                                <label>Nombre</label>
                                <InputText v-model="form.nombre" />
                            </div>

                            <div class="field">
                                <label>Apellido</label>
                                <InputText v-model="form.apellido" />
                            </div>

                            <div class="field">
                                <label>Correo</label>
                                <InputText v-model="form.correo" disabled />
                            </div>

                            <div class="field">
                                <label>Rol</label>
                                <InputText :value="rolLabel" disabled />
                            </div>

                            <!-- SOLO ALUMNO -->
                            <div v-if="!esAdmin" class="field">
                                <label>Matrícula</label>
                                <InputText v-model="form.matricula" disabled />
                            </div>

                            <div v-if="!esAdmin" class="field">
                                <label>Programa</label>
                                <InputText v-model="form.programa" disabled />
                            </div>
                        </div>

                        <div class="actions">
                            <Button label="Guardar cambios" icon="pi pi-check" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.profile-page {
    padding: 2rem;
    padding-top: 1.25rem;
    background: var(--surface-ground);
}

.profile-grid {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 1.25rem;
    align-items: start; /* CLAVE */
}

.profile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.profile-grid {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 1.5rem;
}

.card {
    background: var(--surface-card);
    border-radius: 12px;
    padding: 1.25rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.avatar-card {
    text-align: center;
}

.avatar {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    font-size: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: auto;
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-top: 1rem;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 1.5rem;
}

@media (max-width: 900px) {
    .profile-grid {
        grid-template-columns: 1fr;
    }

    .form-grid {
        grid-template-columns: 1fr;
    }
}
</style>
