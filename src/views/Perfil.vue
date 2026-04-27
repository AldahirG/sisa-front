<script setup>
import api from '@/api/axios';
import { useAuthStore } from '@/store/auth';
import Tag from 'primevue/tag';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';

const auth   = useAuthStore();
const router = useRouter();

// =======================
// STATE
// =======================
const loadingPerfil = ref(true);

const perfil = ref({
    nombre:       '',
    correo:       '',
    rol:          '',
    matricula:    '',
    carrera:      '',
    cuatrimestre: '',
    estado:       ''
});

// =======================
// NORMALIZAR
// Cubre todas las variantes posibles del backend.
// Patrones conocidos:
//   A) admin flat:  { nombre, correo, rol }
//   B) alumno flat: { nombre, correo, rol, matricula, carrera, cuatrimestre, estado }
//   C) alumno nested usuario:
//      { matricula, carrera, cuatrimestre, estado, usuario: { nombre, correo, rol } }
//   D) con wrapper alumno:
//      { correo, rol, alumno: { matricula, carrera, cuatrimestre, estado,
//                               usuario: { nombre } } }
//   E) cualquier variante con user/data en lugar de usuario
// =======================
const normalizar = (raw) => {
    if (!raw) return { ...perfil.value };

    // --- Extraer sub-objetos posibles ---
    const u  = raw?.usuario ?? raw?.user ?? raw?.data ?? {};     // nodo usuario
    const al = raw?.alumno  ?? {};                                // nodo alumno (patrón D)
    const au = al?.usuario  ?? al?.user  ?? {};                   // usuario dentro de alumno

    // nombre: buscar en todos los niveles posibles
    const nombre =
        raw?.nombre  ??
        u?.nombre    ??
        au?.nombre   ??
        al?.nombre   ??
        '';

    // correo
    const correo =
        raw?.correo  ??
        u?.correo    ??
        au?.correo   ??
        '';

    // rol
    const rol =
        raw?.rol     ??
        u?.rol       ??
        au?.rol      ??
        auth.user?.rol ??
        '';

    // datos de alumno: pueden estar en raíz o dentro de raw.alumno
    const matricula =
        raw?.matricula    ??
        al?.matricula     ??
        u?.matricula      ??
        '';

    const carrera =
        raw?.carrera      ??
        al?.carrera       ??
        u?.carrera        ??
        '';

    const cuatrimestre =
        raw?.cuatrimestre != null ? raw.cuatrimestre :
        al?.cuatrimestre  != null ? al.cuatrimestre  :
        u?.cuatrimestre   != null ? u.cuatrimestre   :
        '';

    const estado =
        raw?.estado       ??
        al?.estado        ??
        u?.estado         ??
        '';

    return { nombre, correo, rol, matricula, carrera, cuatrimestre, estado };
};

// =======================
// FETCH
// =======================
const cargarPerfil = async () => {
    loadingPerfil.value = true;
    try {
        const { data } = await api.get('/perfil');
        // DEBUG — quitar después de confirmar estructura
        console.log('[Perfil] raw response:', JSON.stringify(data, null, 2));
        const norm = normalizar(data);
        // Rol siempre del store si el back no lo manda
        if (!norm.rol) norm.rol = auth.user?.rol ?? '';
        perfil.value = norm;
        // Sincronizar store
        auth.login(auth.token, { ...auth.user, ...norm });
    } catch {
        // Fallback: usar lo que haya en localStorage
        const norm = normalizar(auth.user);
        if (!norm.rol) norm.rol = auth.user?.rol ?? '';
        perfil.value = norm;
    } finally {
        loadingPerfil.value = false;
    }
};

onMounted(cargarPerfil);

// =======================
// COMPUTED
// =======================
const esAdmin = computed(() => perfil.value.rol === 'admin');

const rolLabel    = computed(() => esAdmin.value ? 'Administrador' : 'Alumno');
const rolSeverity = computed(() => esAdmin.value ? 'danger' : 'info');

const estadoSeverity = computed(() => {
    const e = perfil.value.estado;
    if (e === 'activo')       return 'success';
    if (e === 'baja')         return 'danger';
    if (e === 'reincorporado')return 'warn';
    return 'secondary';
});

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

        <!-- HEADER -->
        <div class="page-header">
            <div class="header-icon"><i class="pi pi-user"></i></div>
            <div>
                <h1 class="page-title">Mi Perfil</h1>
                <p class="page-subtitle">Información de tu cuenta institucional</p>
            </div>
        </div>

        <!-- LOADING -->
        <div v-if="loadingPerfil" class="profile-grid">
            <div class="left-col">
                <div class="profile-card skeleton-card" style="height:240px" />
            </div>
            <div class="right-col">
                <div class="profile-card skeleton-card" style="height:300px" />
            </div>
        </div>

        <!-- CONTENT -->
        <div v-else class="profile-grid">

            <!-- ── LEFT ── -->
            <div class="left-col">
                <div class="profile-card avatar-card">

                    <!-- Ícono genérico -->
                    <div class="avatar-icon-wrap">
                        <i class="pi pi-user avatar-icon"></i>
                    </div>

                    <div class="avatar-info">
                        <h3 class="avatar-name">{{ perfil.nombre || '—' }}</h3>
                        <p class="avatar-email">{{ perfil.correo || '—' }}</p>

                        <div class="avatar-tags">
                            <Tag :value="rolLabel" :severity="rolSeverity" />
                            <Tag
                                v-if="!esAdmin && perfil.estado"
                                :value="perfil.estado"
                                :severity="estadoSeverity"
                            />
                        </div>

                        <!-- Alumno chips -->
                        <div v-if="!esAdmin" class="avatar-chips">
                            <span v-if="perfil.matricula" class="info-chip">
                                <i class="pi pi-id-card"></i>{{ perfil.matricula }}
                            </span>
                            <span v-if="perfil.carrera" class="info-chip">
                                <i class="pi pi-book"></i>{{ perfil.carrera }}
                            </span>
                            <span v-if="perfil.cuatrimestre !== ''" class="info-chip">
                                <i class="pi pi-calendar"></i>{{ perfil.cuatrimestre }}° cuatrimestre
                            </span>
                        </div>
                    </div>

                    <Button
                        label="Cerrar sesión"
                        icon="pi pi-sign-out"
                        severity="danger"
                        outlined
                        class="w-full logout-btn"
                        @click="logout"
                    />
                </div>
            </div>

            <!-- ── RIGHT ── -->
            <div class="right-col">
                <div class="profile-card info-card">

                    <div class="card-section-title">
                        <i class="pi pi-id-card"></i>
                        <span>Información del perfil</span>
                    </div>

                    <div class="info-grid">

                        <!-- Nombre -->
                        <div class="info-field info-field--full">
                            <span class="info-label">Nombre completo</span>
                            <span class="info-value">{{ perfil.nombre || '—' }}</span>
                        </div>

                        <!-- Correo -->
                        <div class="info-field">
                            <span class="info-label">Correo electrónico</span>
                            <span class="info-value">{{ perfil.correo || '—' }}</span>
                        </div>

                        <!-- Rol -->
                        <div class="info-field">
                            <span class="info-label">Rol</span>
                            <span class="info-value">{{ rolLabel }}</span>
                        </div>

                        <!-- Campos exclusivos alumno -->
                        <template v-if="!esAdmin">
                            <div class="info-field">
                                <span class="info-label">Matrícula</span>
                                <span class="info-value">{{ perfil.matricula || '—' }}</span>
                            </div>

                            <div class="info-field">
                                <span class="info-label">Carrera</span>
                                <span class="info-value">{{ perfil.carrera || '—' }}</span>
                            </div>

                            <div class="info-field">
                                <span class="info-label">Cuatrimestre</span>
                                <span class="info-value">
                                    {{ perfil.cuatrimestre !== '' ? `${perfil.cuatrimestre}°` : '—' }}
                                </span>
                            </div>

                            <div class="info-field">
                                <span class="info-label">Estado</span>
                                <Tag
                                    :value="perfil.estado || '—'"
                                    :severity="estadoSeverity"
                                    style="width: fit-content"
                                />
                            </div>
                        </template>
                    </div>

                    <p class="info-note">
                        <i class="pi pi-lock"></i>
                        Para modificar datos contacta a administración.
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* ── PAGE ─────────────────────────────────── */
.page-container {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.header-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--sisa-tint-blue, rgba(21,101,192,.12));
    color: var(--sisa-icon-blue, #1565C0);
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
}

.page-subtitle {
    font-size: 0.85rem;
    color: var(--p-text-muted-color);
    margin: 0.15rem 0 0;
}

/* ── GRID ─────────────────────────────────── */
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

/* ── CARD BASE ────────────────────────────── */
.profile-card {
    background: var(--p-content-background);
    border: 1px solid var(--p-content-border-color);
    border-radius: 14px;
    padding: 1.5rem;
}

.skeleton-card {
    animation: skeleton-pulse 1.4s ease-in-out infinite;
}
@keyframes skeleton-pulse {
    0%,100% { opacity: 1; }
    50%      { opacity: .5; }
}

/* ── AVATAR CARD ──────────────────────────── */
.avatar-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
}

.avatar-icon-wrap {
    width: 92px;
    height: 92px;
    border-radius: 50%;
    background: var(--sisa-primary, #0F3C61);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 18px rgba(15,60,97,.28);
    flex-shrink: 0;
}

.avatar-icon {
    font-size: 2.6rem;
    color: #fff;
}

.avatar-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
}

.avatar-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--p-text-color);
    margin: 0;
    word-break: break-word;
}

.avatar-email {
    font-size: 0.8rem;
    color: var(--p-text-muted-color);
    margin: 0;
    word-break: break-all;
}

.avatar-tags {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 0.1rem;
}

/* ── CHIPS ────────────────────────────────── */
.avatar-chips {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.25rem;
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
    background: var(--sisa-tint-blue, rgba(21,101,192,.08));
    color: var(--sisa-icon-blue, #1565C0);
    border: 1px solid rgba(21,101,192,.18);
    white-space: nowrap;
}

.info-chip .pi { font-size: 0.72rem; }

.logout-btn {
    justify-content: center;
    margin-top: 0.5rem;
}

/* ── INFO CARD ────────────────────────────── */
.info-card {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.card-section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--p-text-color);
}

.card-section-title .pi {
    color: var(--sisa-icon-blue, #1565C0);
}

/* ── INFO GRID ────────────────────────────── */
.info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.1rem;
}

.info-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    background: var(--p-surface-50, rgba(0,0,0,.02));
    border: 1px solid var(--p-content-border-color);
    border-radius: 10px;
}

.info-field--full {
    grid-column: 1 / -1;
}

.info-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--p-text-muted-color);
}

.info-value {
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--p-text-color);
    word-break: break-word;
}

.info-note {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--p-text-muted-color);
    margin: 0;
    padding-top: 0.5rem;
    border-top: 1px solid var(--p-content-border-color);
}

.info-note .pi { font-size: 0.75rem; }

/* ── UTILITY ──────────────────────────────── */
.w-full { width: 100%; }

/* ── RESPONSIVE ───────────────────────────── */
@media (max-width: 860px) {
    .profile-grid { grid-template-columns: 1fr; }
    .info-grid    { grid-template-columns: 1fr; }
}
</style>
