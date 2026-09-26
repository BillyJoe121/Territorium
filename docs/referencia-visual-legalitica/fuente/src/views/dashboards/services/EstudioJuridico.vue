<script setup lang="ts">
import { ref, computed } from "vue";
import BaseBreadcrumb from "@/components/shared/BaseBreadcrumb.vue";
import Services from "@/components/dashboards/analytical/Services.vue";
import { useAuthStore } from "@/stores/auth";

import logoIcon from '@/assets/images/logos/territorium_icono_fondo_transparente.png';

const authStore = useAuthStore();
const page = ref({ title: "Servicios" });
const breadcrumbs = ref([
  { text: "Servicios", disabled: false, href: "#" },
]);

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
});

const userName = computed(() => authStore.user?.first_name ?? "");

const today = computed(() => {
  return new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});
</script>

<template>
  <!-- Hero Banner de bienvenida -->
  <div class="welcome-banner rise-in mb-6">
    <div class="welcome-content">
      <p class="welcome-date text-caption text-medium-emphasis mb-1">{{ today }}</p>
      <h1 class="welcome-title">
        {{ greeting }}<span v-if="userName">, {{ userName }}</span>
      </h1>
      <p class="welcome-subtitle text-body-2 text-medium-emphasis">
        Accede a tus servicios jurídicos desde aquí
      </p>
    </div>
    <div class="welcome-badge hidden-sm-and-down">
      <div class="welcome-logo-icon"><img :src="logoIcon" alt="logoIcon" width="100" /></div>
    </div>
  </div>

  <!-- Servicios -->
  <v-row>
    <v-col cols="12" md="12">
      <Services />
    </v-col>
  </v-row>
</template>

<style scoped>
.welcome-banner {
  background: linear-gradient(135deg, #316842 0%, #243F30 100%);
  border-radius: 20px;
  padding: 28px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: hidden;
  position: relative;
  box-shadow: 0 8px 32px -8px rgba(49, 104, 66, 0.4);
}
.welcome-banner::before {
  content: '';
  position: absolute;
  top: -40px;
  right: 160px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
}
.welcome-banner::after {
  content: '';
  position: absolute;
  bottom: -60px;
  right: 80px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: rgba(233, 112, 37, 0.08);
}
.welcome-content { position: relative; z-index: 1; }
.welcome-date {
  color: rgba(255, 255, 255, 0.55) !important;
  font-size: 0.75rem;
  text-transform: capitalize;
}
.welcome-title {
  font-family: 'Poppins', sans-serif;
  font-size: 1.6rem;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.3;
  margin-bottom: 4px;
}
.welcome-subtitle {
  color: rgba(255, 255, 255, 0.65) !important;
}
.welcome-badge {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}
.welcome-logo-icon {
  font-size: 3.5rem;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.2));
  animation: float 3s ease-in-out infinite alternate;
}
@keyframes float {
  from { transform: translateY(0px); }
  to   { transform: translateY(-8px); }
}
</style>
