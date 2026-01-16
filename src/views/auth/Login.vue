<template>
    <div class="flex align-items-center justify-content-center min-h-screen">
        <div class="surface-card p-4 shadow-2 border-round w-full lg:w-4">
            <h2 class="text-center mb-4">SISA · Iniciar sesión</h2>

            <div class="field mb-3">
                <label for="correo">Correo</label>
                <InputText id="correo" v-model="correo" type="email" class="w-full" />
            </div>

            <div class="field mb-4">
                <label for="password">Contraseña</label>
                <Password id="password" v-model="password" toggleMask class="w-full" />
            </div>

            <Button label="Ingresar" class="w-full" :loading="loading" @click="login" />
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
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';

const correo = ref('');
const password = ref('');
const loading = ref(false);

const router = useRouter();
const auth = useAuthStore();

const login = async () => {
    try {
        loading.value = true;

        const { data } = await api.post('/auth/login', {
            correo: correo.value,
            password: password.value
        });

        // Guardar sesión
        auth.login(data.access_token, data.user);

        // Redirigir según rol
        if (data.user.rol === 'admin') {
            router.push('/admin/dashboard');
        } else {
            router.push('/alumno/dashboard');
        }
    } catch (error) {
        alert('Credenciales incorrectas');
    } finally {
        loading.value = false;
    }
};
</script>
