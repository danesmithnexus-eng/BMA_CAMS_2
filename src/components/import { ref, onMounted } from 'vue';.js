import { ref, onMounted } from 'vue';
import * as bootstrap from 'bootstrap';

export function useToast() {
    const toastRef = ref(null);
    const toastTitle = ref('');
    const toastMessage = ref('');
    const toastClass = ref('');
    let toastInstance = null;

    onMounted(() => {
        if (toastRef.value) {
            toastInstance = bootstrap.Toast.getOrCreateInstance(toastRef.value);
        }
    });

    const showToast = (title, message, type = 'info') => {
        toastTitle.value = title;
        toastMessage.value = message;
        if (type === 'success') toastClass.value = 'bg-success';
        else if (type === 'error') toastClass.value = 'bg-danger';
        else toastClass.value = '';
        if (toastInstance) toastInstance.show();
    };

    return {
        toastRef,
        toastTitle,
        toastMessage,
        toastClass,
        showToast
    };
}