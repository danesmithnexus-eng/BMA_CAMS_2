import { defineStore } from 'pinia';

export const useUIStore = defineStore('ui', {
    state: () => ({
        toast: {
            visible: false,
            title: '',
            message: '',
            type: 'info', // info, success, error
            class: ''
        }
    }),
    actions: {
        showToast(title, message, type = 'info') {
            this.toast.title = title;
            this.toast.message = message;
            this.toast.type = type;
            
            if (type === 'success') this.toast.class = 'bg-success text-white';
            else if (type === 'warning') this.toast.class = 'bg-danger text-white';
            else if (type === 'error') this.toast.class = 'bg-danger text-white';
            else this.toast.class = 'bg-primary text-white';
            
            this.toast.visible = true;
            
            // Auto-hide handled by component or we can use setTimeout here if we manage visibility manually
            // But Bootstrap Toast usually handles auto-hide if configured, or we trigger .show()
            // We will let the component watch the state or use a subscription
        },
        hideToast() {
            this.toast.visible = false;
        }
    }
});
