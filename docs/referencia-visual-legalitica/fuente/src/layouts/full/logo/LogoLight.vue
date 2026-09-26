<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import logoFull from '@/assets/images/logos/logo_fondo_blanco.png';
import logoIcon from '@/assets/images/logos/territorium_icono_fondo_blanco.png';
import { useCustomizerStore } from '@/stores/customizer';

const customizer = useCustomizerStore();
</script>

<template>
    <div class="logo-wrapper" :class="{ 'is-mini': customizer.mini_sidebar }">
        <RouterLink to="/" class="d-flex align-center">
            <!-- Icono exclusivo en alta resolución cuando la barra está colapsada (sin texto) -->
            <img
                v-if="customizer.mini_sidebar"
                :src="logoIcon"
                alt="Territorium"
                height="50"
                class="logo-icon-img"
            />
            <!-- Logo completo original cuando la barra está expandida -->
            <img
                v-else
                :src="logoFull"
                alt="Territorium"
                height="50"
                class="logo-full-img"
            />
        </RouterLink>
    </div>
</template>

<style scoped>
.logo-wrapper {
    display: flex;
    align-items: center;
    min-height: 42px;
}

.logo-wrapper.is-mini {
    width: 44px;
    justify-content: center;
}

.logo-full-img {
    height: 42px;
    width: auto;
    display: block;
    max-width: none;
}

.logo-icon-img {
    height: 42px;
    width: auto;
    display: block;
    object-fit: contain;
    image-rendering: -webkit-optimize-contrast;
}
</style>

