<script setup lang="ts">
import { computed } from 'vue';
import { MailIcon, LogoutIcon, UserCircleIcon } from 'vue-tabler-icons';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const user = authStore.user;

const userInitials = computed(() => {
    if (!user) return '?';
    return `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase();
});

const userFullName = computed(() =>
    user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim().slice(0, 30) : ''
);
const userEmail = computed(() => user?.email ?? '');
const userType = computed(() => user?.tipo ?? '');
</script>

<template>
    <v-menu :close-on-content-click="true" min-width="300">
        <template v-slot:activator="{ props }">
            <v-btn class="profile-avatar-btn" variant="text" v-bind="props" icon>
                <div class="topbar-avatar-initials">
                    {{ userInitials }}
                </div>
            </v-btn>
        </template>

        <v-sheet width="300" elevation="8" class="profile-dropdown-sheet">
            <!-- Header del perfil -->
            <div v-if="user" class="profile-header px-5 pt-5 pb-4">
                <div class="d-flex align-center gap-3">
                    <div class="profile-avatar-lg">{{ userInitials }}</div>
                    <div class="overflow-hidden">
                        <h6 class="text-body-1 font-weight-bold text-truncate">{{ userFullName }}</h6>
                        <v-chip
                            size="x-small"
                            color="primary"
                            variant="tonal"
                            class="mt-1 font-weight-medium"
                            rounded="sm"
                        >{{ userType }}</v-chip>
                    </div>
                </div>
                <div class="d-flex align-center mt-3 gap-2">
                    <MailIcon size="14" stroke-width="1.5" class="text-medium-emphasis" />
                    <span class="text-caption text-medium-emphasis text-truncate">{{ userEmail }}</span>
                </div>
            </div>

            <v-divider />

            <!-- Acciones -->
            <div class="pa-3">
                <router-link to="/perfil" class="text-decoration-none">
                    <v-btn
                        v-if="user"
                        color="primary"
                        variant="tonal"
                        block
                        class="mb-2 justify-start"
                        rounded="md"
                    >
                        <template #prepend><UserCircleIcon size="18" stroke-width="1.5" class="mr-1" /></template>
                        Mi Perfil
                    </v-btn>
                </router-link>

                <v-btn
                    v-if="user"
                    color="error"
                    variant="tonal"
                    block
                    class="justify-start"
                    rounded="md"
                    @click="authStore.logout()"
                >
                    <template #prepend><LogoutIcon size="18" stroke-width="1.5" class="mr-1" /></template>
                    Cerrar Sesión
                </v-btn>

                <router-link v-if="!user" to="/auth/login" class="text-decoration-none">
                    <v-btn color="primary" variant="outlined" block rounded="md">
                        Ingresar
                    </v-btn>
                </router-link>
            </div>
        </v-sheet>
    </v-menu>
</template>

<style scoped>
.topbar-avatar-initials {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #316842, #E97025);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Poppins', sans-serif;
    font-weight: 700;
    font-size: 0.75rem;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.profile-avatar-btn:hover .topbar-avatar-initials {
    transform: scale(1.08);
    box-shadow: 0 4px 12px rgba(49, 104, 66, 0.35);
}
.profile-avatar-lg {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #316842, #E97025);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Poppins', sans-serif;
    font-weight: 700;
    font-size: 1rem;
    color: #fff;
    text-transform: uppercase;
    flex-shrink: 0;
}
.profile-dropdown-sheet {
    border: 1px solid rgba(0,0,0,0.06);
    border-radius: 12px !important;
    overflow: hidden;
}
.profile-header {
    background: linear-gradient(135deg, rgba(49,104,66,0.04), rgba(233,112,37,0.04));
}
</style>
