<template>
    <div class="flex align-items-center justify-content-center min-h-screen bg-surface-ground">
        <div class="surface-card p-5 shadow-2 border-round w-full" style="max-width: 420px">
            <div class="text-center mb-4">
                <div class="text-3xl font-black text-primary mb-1">SISA</div>
                <div class="text-muted-color text-sm">Sistema Integral de Seguimiento Académico</div>
            </div>

            <!-- Demo credentials hint -->
            <div class="border-round p-3 mb-4" style="background: var(--blue-50, #eff6ff); border: 1px solid var(--blue-200, #bfdbfe)">
                <p class="text-xs font-bold text-center mb-2" style="color: var(--blue-700, #1d4ed8); text-transform: uppercase; letter-spacing: 0.05em">Acceso Demo</p>
                <div class="flex flex-column gap-1 text-sm" style="color: var(--blue-800, #1e40af)">
                    <div><span class="font-semibold">Admin:</span> <span class="font-mono">admin@sisa.demo</span> / <span class="font-mono font-bold">demo1234</span></div>
                    <div><span class="font-semibold">Alumno:</span> <span class="font-mono">alumno@sisa.demo</span> / <span class="font-mono font-bold">demo1234</span></div>
                </div>
            </div>

            <div class="field mb-3">
                <label for="correo" class="block mb-1 font-medium">Correo — <span class="font-mono text-sm">admin@sisa.demo</span></label>
                <InputText id="correo" v-model="correo" type="email" class="w-full" placeholder="admin@sisa.demo" />
            </div>

            <div class="field mb-4">
                <label for="password" class="block mb-1 font-medium">Contraseña — <span class="font-mono text-sm">demo1234</span></label>
                <Password id="password" v-model="password" toggleMask class="w-full" inputClass="w-full" placeholder="demo1234" :feedback="false" />
            </div>

            <Message v-if="errorMsg" severity="error" class="mb-3">{{ errorMsg }}</Message>

            <Button label="Ingresar" class="w-full" :loading="loading" @click="login" />
        </div>
    </div>
</template>

<script setup>
import { useAuthStore } from '@/store/auth';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { DEMO_CREDENTIALS, DEMO_TOKEN } from '@/data/mock';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';

const correo = ref('');
const password = ref('');
const loading = ref(false);
const errorMsg = ref('');

const router = useRouter();
const auth = useAuthStore();

const login = async () => {
    loading.value = true;
    errorMsg.value = '';

    const match = DEMO_CREDENTIALS.find(
        c => c.correo === correo.value && c.password === password.value
    );

    if (!match) {
        errorMsg.value = 'Credenciales incorrectas. Usa las credenciales demo mostradas arriba.';
        loading.value = false;
        return;
    }

    auth.login(DEMO_TOKEN, match.user);
    router.push(match.redirect);
    loading.value = false;
};
</script>
