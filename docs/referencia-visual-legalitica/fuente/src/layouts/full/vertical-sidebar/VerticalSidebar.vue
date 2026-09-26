<script setup lang="ts">
import { ref, shallowRef, computed } from 'vue';
import { useCustomizerStore } from '@/stores/customizer';
import sidebarItems from './sidebarItem';

import NavGroup from './NavGroup/index.vue';
import NavItem from './NavItem/index.vue';
import NavCollapse from './NavCollapse/NavCollapse.vue';
import { useAuthStore } from '@/stores/auth';

const customizer = useCustomizerStore();
const authStore = useAuthStore();

const sidebarMenu = computed(() => {
    return sidebarItems.filter((item) => {
        return item?.permission ? authStore.hasPermission(item.permission) : true;
    });
});
</script>

<template>
    <v-navigation-drawer
        left
        v-model="customizer.Sidebar_drawer"
        elevation="0"
        rail-width="75"
        mobile-breakpoint="960"
        app
        class="leftSidebar"
        :rail="customizer.mini_sidebar"
        expand-on-hover
        width="256"
    >
        <!-- ── Navegación ── -->
        <perfect-scrollbar class="scrollnavbar">
            <v-list class="py-4 px-3">
                <template v-for="(item, i) in sidebarMenu">
                    <NavGroup :item="item" v-if="item.header" :key="item.title" />
                    <NavCollapse class="leftPadding" :item="item" :level="0" v-else-if="item.children" />
                    <NavItem :item="item" v-else class="leftPadding" />
                </template>
            </v-list>
        </perfect-scrollbar>
    </v-navigation-drawer>
</template>
