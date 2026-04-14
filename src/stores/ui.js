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
            
        },
        hideToast() {
            this.toast.visible = false;
        }
    }
});
