<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import EstudioJuridico from "./EstudioJuridico.vue";
import EstudiosTitulos from "./EstudiosTitulos.vue";
import DebidasDiligencias from "./DebidasDiligencias.vue";
import ViabilidadCredito from "./ViabilidadCredito.vue";
import { useAuthStore } from "@/stores/auth";
import { useRoute, useRouter } from "vue-router";
import {
  FileSearchIcon,
  CertificateIcon,
  UserCheckIcon,
  BuildingBankIcon,
} from "vue-tabler-icons";

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

// Configuración de servicios disponibles
const services = [
  {
    value: "estudio-juridico",
    label: "Estudios Jurídicos",
    icon: FileSearchIcon,
    permission: "Puede cargar folios",
  },
  {
    value: "estudio-titulos",
    label: "Estudios de Títulos",
    icon: CertificateIcon,
    permission: "Puede realizar estudios de títulos",
  },
  {
    value: "debida-diligencia",
    label: "Debida Diligencia",
    icon: UserCheckIcon,
    permission: "Puede realizar estudios de títulos",
  },
  {
    value: "viabilidad-crediticia",
    label: "Validación Jurídica Anticipada",
    icon: BuildingBankIcon,
    permission: "Puede realizar estudios de títulos",
  },
];

const resolveTab = () => {
  if (route.hash) {
    return route.hash.replace("#", "");
  }
  if (route.query?.tab) {
    return route.query.tab as string;
  }
  return "estudio-juridico";
};

const tab = ref<string>(resolveTab());

onMounted(() => {
  const currentTab = resolveTab();
  tab.value = currentTab;
  if (!route.hash || route.hash !== `#${currentTab}`) {
    router.replace({ hash: `#${currentTab}` });
  }
});

watch(
  () => [route.hash, route.query?.tab],
  () => {
    const currentTab = resolveTab();
    if (currentTab && tab.value !== currentTab) {
      tab.value = currentTab;
    }
  }
);

watch(tab, (newTab) => {
  if (newTab && route.hash !== `#${newTab}`) {
    router.replace({ hash: `#${newTab}` });
  }
});
</script>

<template>
  <div class="services-container">
    <VCard elevation="10" class="rounded-xl overflow-hidden border">
      <!-- Barra de navegación de pestañas -->
      <v-tabs
        v-model="tab"
        color="primary"
        grow
        show-arrows
        class="services-tabs border-b"
      >
        <v-tab
          v-for="service in services"
          :key="service.value"
          :value="service.value"
          :disabled="!authStore.hasPermission(service.permission)"
          class="font-weight-semibold text-subtitle-2 py-4 text-none"
        >
          <component :is="service.icon" size="18" stroke-width="1.8" class="mr-2" />
          {{ service.label }}
        </v-tab>
      </v-tabs>

      <!-- Contenido dinámico del servicio -->
      <v-card-text class="pa-6">
        <v-window v-model="tab">
          <v-window-item value="estudio-juridico">
            <EstudioJuridico />
          </v-window-item>
          <v-window-item value="estudio-titulos">
            <EstudiosTitulos />
          </v-window-item>
          <v-window-item value="debida-diligencia">
            <DebidasDiligencias />
          </v-window-item>
          <v-window-item value="viabilidad-crediticia">
            <ViabilidadCredito />
          </v-window-item>
        </v-window>
      </v-card-text>
    </VCard>
  </div>
</template>

<style scoped>
.services-tabs {
  background: rgba(var(--v-theme-surface), 0.85);
  backdrop-filter: blur(8px);
}

:deep(.v-tab--selected) {
  font-weight: 700 !important;
}
</style>
