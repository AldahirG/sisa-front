<script setup>
import { ref } from 'vue'
const dismissed = ref(false)
</script>

<template>
    <Transition name="slide-up">
        <div v-if="!dismissed" class="demo-banner">
            <div class="demo-banner__content">
                <span>⚠️</span>
                <span><strong>Modo Demo</strong> — Diseño no definitivo. Información simulada. No representa datos reales.</span>
            </div>
            <button class="demo-banner__close" @click="dismissed = true" title="Cerrar">✕</button>
        </div>
    </Transition>
</template>

<style scoped>
.demo-banner {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    background: #1e3a5f;
    color: #e2eaf5;
    border-radius: 9999px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
    font-size: 0.8rem;
    white-space: nowrap;
    max-width: calc(100vw - 2rem);
    overflow: hidden;
}

.demo-banner__content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
    text-overflow: ellipsis;
}

.demo-banner__close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: #93b4d4;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0 0.25rem;
    line-height: 1;
}

.demo-banner__close:hover {
    color: #fff;
}

.slide-up-enter-active,
.slide-up-leave-active {
    transition: opacity 0.3s, transform 0.3s;
}

.slide-up-enter-from,
.slide-up-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(1rem);
}
</style>
