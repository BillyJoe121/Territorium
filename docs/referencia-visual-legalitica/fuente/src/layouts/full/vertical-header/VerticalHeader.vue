<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useCustomizerStore } from '../../../stores/customizer';
import { Menu2Icon } from 'vue-tabler-icons';
import ProfileDD from './ProfileDD.vue';
import Logo from '../logo/Logo.vue';
import LogoIcon from '../logo/LogoIcon.vue';
import { useAuthStore } from '@/stores/auth';
import { useRoute } from 'vue-router';

const customizer = useCustomizerStore();
const userStore = useAuthStore();
const user = useAuthStore().user;
const route = useRoute();

const priority = ref(customizer.setHorizontalLayout ? 0 : 0);

// Título de la página actual basado en la ruta
const pageTitle = computed(() => {
    const name = route.name as string ?? '';
    const titles: Record<string, string> = {
        'EstudioJuridico': 'Servicios',
        'Listado': 'Mis Consultas',
        'EstudioJuridicoDetalle': 'Estudio Jurídico',
        'Perfil': 'Mi Perfil',
        'Ordenes': 'Ventas',
    };
    return titles[name];
});

watch(priority, (newPriority) => {
    priority.value = newPriority;
});
</script>

<template>
    <v-app-bar
        elevation="0"
        :priority="priority"
        height="64"
        color="surface"
        class="legalitica-topbar"
        border="b"
        id="top"
    >
        <!-- ── Logo ── -->
        <div class="d-sm-flex d-none align-center mr-3">
            <Logo />
        </div>
        <div class="d-sm-none d-flex align-center mr-2">
            <LogoIcon />
        </div>

        <!-- Toggle sidebar (desktop) -->
        <v-btn
            class="hidden-md-and-down"
            icon
            color="textPrimary"
            variant="text"
            @click.stop="customizer.SET_MINI_SIDEBAR(!customizer.mini_sidebar)"
        >
            <Menu2Icon size="22" stroke-width="1.5" />
        </v-btn>

        <!-- Toggle sidebar (mobile) -->
        <v-btn
            v-if="user"
            class="hidden-lg-and-up"
            icon
            variant="text"
            color="textPrimary"
            @click.stop="customizer.SET_SIDEBAR_DRAWER"
            size="small"
        >
            <Menu2Icon size="22" stroke-width="1.5" />
        </v-btn>

        <!-- Título de la sección -->
        <span class="topbar-page-title text-h6 font-weight-semibold ml-2 hidden-sm-and-down">
            {{ pageTitle }}
        </span>

        <v-spacer />

        <!-- Perfil de usuario -->
        <div class="ml-2 mr-1">
            <ProfileDD />
        </div>
    </v-app-bar>

    <!-- Right Sidebar (si se necesita en el futuro) -->
    <!-- <v-navigation-drawer v-model="appsdrawer" location="right" temporary>
        <RightMobileSidebar />
    </v-navigation-drawer> -->
</template>
