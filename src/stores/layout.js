import { defineStore } from 'pinia';

export const useLayoutStore = defineStore('layout', {
    state: () => ({
        isSidebarActive: window.innerWidth >= 992
    }),
    actions: {
        toggleSidebar() {
            this.isSidebarActive = !this.isSidebarActive;
        },
        setSidebarActive(active) {
            this.isSidebarActive = active;
        },
        handleResize() {
            if (window.innerWidth >= 992) {
                this.isSidebarActive = true;
            } else {
                this.isSidebarActive = false;
            }
        }
    }
});
