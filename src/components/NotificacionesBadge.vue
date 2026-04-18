<script setup>
import { useNotificaciones } from '@/composables/useNotificaciones';
import { onMounted, onUnmounted, ref } from 'vue';
import NotificacionesPanel from './NotificacionesPanel.vue';

// ─────────────────────────────────────────────────────────────
const { count } = useNotificaciones();

const open    = ref(false);
const shaking = ref(false);     // activa CSS shake en campana
const wrapperRef = ref(null);

// ─────────────────────────────────────────────────────────────
// SONIDO — Web Audio API, sin archivos externos
// Dos tonos suaves tipo "ding-dong"
// ─────────────────────────────────────────────────────────────
const playDing = () => {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        const notas = [
            { freq: 1046.5, delay: 0,    dur: 0.45 },   // C6
            { freq:  880.0, delay: 0.18, dur: 0.55 }    // A5
        ];

        notas.forEach(({ freq, delay, dur }) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            osc.frequency.value = freq;

            const t0 = ctx.currentTime + delay;
            gain.gain.setValueAtTime(0, t0);
            gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);   // attack rápido
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur); // decay suave

            osc.start(t0);
            osc.stop(t0 + dur);
        });

        // Cerrar contexto cuando termina para no dejar recursos abiertos
        setTimeout(() => ctx.close(), 1200);
    } catch {
        // Silencioso: algunos navegadores bloquean AudioContext sin interacción
    }
};

// ─────────────────────────────────────────────────────────────
// HANDLER: nuevas notificaciones
// ─────────────────────────────────────────────────────────────
const onNuevas = () => {
    playDing();

    // Shake: agita la campana y auto-reset tras la animación
    shaking.value = true;
    setTimeout(() => { shaking.value = false; }, 820);
};

// ─────────────────────────────────────────────────────────────
// CLICK OUTSIDE
// ─────────────────────────────────────────────────────────────
const onClickOutside = (e) => {
    if (open.value && wrapperRef.value && !wrapperRef.value.contains(e.target)) {
        open.value = false;
    }
};

onMounted(() => {
    document.addEventListener('mousedown', onClickOutside, true);
    window.addEventListener('sisa:nuevas-notificaciones', onNuevas);
});

onUnmounted(() => {
    document.removeEventListener('mousedown', onClickOutside, true);
    window.removeEventListener('sisa:nuevas-notificaciones', onNuevas);
});

// ─────────────────────────────────────────────────────────────
const badgeLabel = (n) => (n > 99 ? '99+' : String(n));
</script>

<template>
    <div ref="wrapperRef" class="notif-badge-wrapper">
        <!-- Bell button -->
        <button
            type="button"
            class="layout-topbar-action notif-bell-btn"
            :class="{
                'notif-bell-btn--active': open,
                'notif-bell--shake': shaking
            }"
            :aria-label="`Notificaciones${count > 0 ? `, ${count} sin leer` : ''}`"
            :title="`Notificaciones${count > 0 ? ` (${count} sin leer)` : ''}`"
            @click="open = !open"
        >
            <i class="pi pi-bell"></i>

            <!-- Badge rojo con pulse cuando hay novedades -->
            <span
                v-if="count > 0"
                class="notif-badge"
                :class="{ 'notif-badge--pulse': shaking }"
                aria-hidden="true"
            >
                {{ badgeLabel(count) }}
            </span>
        </button>

        <!-- Panel desplegable -->
        <Transition name="notif-drop">
            <div v-if="open" class="notif-panel-anchor">
                <NotificacionesPanel @close="open = false" />
            </div>
        </Transition>
    </div>
</template>

<style scoped>
/* ─── WRAPPER ─────────────────────────────────────────────── */
.notif-badge-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
}

/* ─── BELL BUTTON ─────────────────────────────────────────── */
.notif-bell-btn {
    position: relative;
}

.notif-bell-btn--active {
    background: var(--sisa-tint-blue, rgba(21, 101, 192, 0.12)) !important;
    color: var(--sisa-primary-l, #1565C0) !important;
}

/* ─── SHAKE KEYFRAME ─────────────────────────────────────── */
@keyframes bell-shake {
    0%   { transform: rotate(0deg);   }
    10%  { transform: rotate(18deg);  }
    20%  { transform: rotate(-16deg); }
    30%  { transform: rotate(14deg);  }
    40%  { transform: rotate(-10deg); }
    50%  { transform: rotate(7deg);   }
    60%  { transform: rotate(-4deg);  }
    70%  { transform: rotate(2deg);   }
    80%  { transform: rotate(-1deg);  }
    90%  { transform: rotate(0.5deg); }
    100% { transform: rotate(0deg);   }
}

.notif-bell--shake .pi-bell {
    display: inline-block;
    transform-origin: top center;
    animation: bell-shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

/* ─── BADGE ───────────────────────────────────────────────── */
.notif-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    border-radius: 9px;
    background: #e53935;
    color: #fff;
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 17px;
    text-align: center;
    pointer-events: none;
    /* Borde blanco/dark para destacar sobre el topbar */
    border: 2px solid var(--p-content-background, #fff);
    box-sizing: content-box;
    transition: transform 0.2s;
}

/* Pulse del badge cuando llegan nuevas */
@keyframes badge-pop {
    0%   { transform: scale(1);   }
    30%  { transform: scale(1.5); }
    55%  { transform: scale(0.88);}
    75%  { transform: scale(1.18);}
    90%  { transform: scale(0.96);}
    100% { transform: scale(1);   }
}

.notif-badge--pulse {
    animation: badge-pop 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

/* Anillo pulsante permanente cuando count > 0 (sutil) */
@keyframes ring-ping {
    0%   { box-shadow: 0 0 0 0   rgba(229, 57, 53, 0.55); }
    70%  { box-shadow: 0 0 0 7px rgba(229, 57, 53, 0);    }
    100% { box-shadow: 0 0 0 0   rgba(229, 57, 53, 0);    }
}

.notif-badge {
    animation: ring-ping 2.2s ease-out infinite;
}

/* Cuando llega nueva: sobreescribe ring con pop */
.notif-badge--pulse {
    animation: badge-pop 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

/* ─── PANEL ANCHOR ────────────────────────────────────────── */
.notif-panel-anchor {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    z-index: 9999;
    max-width: calc(100vw - 1rem);
}

/* ─── ANIMACIÓN PANEL ─────────────────────────────────────── */
.notif-drop-enter-active,
.notif-drop-leave-active {
    transition: opacity 0.18s ease, transform 0.18s ease;
    transform-origin: top right;
}

.notif-drop-enter-from,
.notif-drop-leave-to {
    opacity: 0;
    transform: scale(0.95) translateY(-6px);
}
</style>
