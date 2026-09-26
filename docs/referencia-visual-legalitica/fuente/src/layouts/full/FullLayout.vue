<script setup lang="ts">
import { RouterView } from 'vue-router';
import VerticalSidebarVue from './vertical-sidebar/VerticalSidebar.vue';
import VerticalHeaderVue from './vertical-header/VerticalHeader.vue';
import HorizontalHeader from './horizontal-header/HorizontalHeader.vue';
import HorizontalSidebar from './horizontal-sidebar/HorizontalSidebar.vue';
import Customizer from './customizer/Customizer.vue';
import { useCustomizerStore } from '../../stores/customizer';
import { pl, zhHans } from 'vuetify/locale'
import { onMounted, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRoute } from 'vue-router';

const route = useRoute();

const isEditableRoute = computed(() => route.path === '/editable');
const customizer = useCustomizerStore();
const authStore = useAuthStore();

onMounted(async () => {
    await authStore.updateUserInfo().catch((error) => {
        console.error(error);  
    });
})

</script>

<template>
    <v-locale-provider >
        <v-app
            :theme="customizer.actTheme"
            :class="[
                customizer.actTheme,
                isEditableRoute ? 'editable-layout' : '',
                customizer.mini_sidebar ? 'mini-sidebar' : '',
                customizer.setHorizontalLayout ? 'horizontalLayout' : 'verticalLayout',
                customizer.setBorderCard ? 'cardBordered' : '',
                customizer.inputBg ? 'inputWithbg' : ''
            ]"
        >
            <Customizer />
            <VerticalHeaderVue v-if="!customizer.setHorizontalLayout" />
            <VerticalSidebarVue v-if="!customizer.setHorizontalLayout" />
            <HorizontalHeader v-if="customizer.setHorizontalLayout" />
            <HorizontalSidebar v-if="customizer.setHorizontalLayout" />

            <v-main :class="[isEditableRoute ? 'editable-main' : '']">
                <v-container fluid :class="[isEditableRoute ? 'editable-container' : 'page-wrapper pb-sm-15 pb-10']">
                    <RouterView v-slot="{ Component }">
                        <keep-alive include="Profile">
                            <component :is="Component" />
                        </keep-alive>
                    </RouterView>
                    <!-- <v-btn
                            class="customizer-btn"
                            size="large"
                            icon
                            variant="flat"
                            color="primary"
                            @click.stop="customizer.SET_CUSTOMIZER_DRAWER(!customizer.Customizer_drawer)"
                        >
                            <SettingsIcon />
                        </v-btn> -->
                </v-container>
            </v-main>
        </v-app>
    </v-locale-provider>
</template>
<style scoped>
/* Estilo global para la ruta /editable */
.editable-layout {
    height: 100%;
    width: 100%;
    display: flex;
}

.editable-main {
    display: flex;
    height: 100%;
    width: 100%;
}

.editable-container {
    flex: 1;
    padding: 0;
}

.router-component {
    flex: 1;
    display: flex;
    height: 100%;
    width: 100%;
}
</style>
