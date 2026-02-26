import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';
import * as bootstrap from 'bootstrap';

export function useAppLogic() {
    const authStore = useAuthStore();
    // STATE MANAGEMENT
    const currentView = ref('dashboard');
    const currentUser = computed(() => authStore.user);
    const loginForm = ref({ email: '', password: '' });
    const loginError = ref('');
    const isLoading = ref(false); // Added missing ref if needed, or check if it was there
    const isSidebarActive = ref(false);

    // DARK MODE
    const isDarkMode = ref(false);
    const toggleDarkMode = () => {
        isDarkMode.value = !isDarkMode.value;
        document.body.classList.toggle('dark-mode', isDarkMode.value);
    };
    // Initialize dark mode class
    if (isDarkMode.value) {
        document.body.classList.add('dark-mode');
    }

    // MODAL REFS
    const toastRef = ref(null);
    const toastTitle = ref('');
    const toastMessage = ref('');
    const toastClass = ref('');
    let toastInstance = null;
    
    const questionModal = ref(null);
    const assignStudentModal = ref(null);
    const deleteConfirmationModal = ref(null);
    const bulkUploadModal = ref(null);
    const csvFileInput = ref(null);
    const uploadConfirmationModal = ref(null);
    const submitAllConfirmationModal = ref(null);
    const deleteAllConfirmationModal = ref(null);
    const validateAllConfirmationModal = ref(null);
    const rejectAllConfirmationModal = ref(null);
    const approveAllConfirmationModal = ref(null);
    const rejectAllApprovalConfirmationModal = ref(null);
    const ad10PreviewModal = ref(null);
    const ad09SummaryModal = ref(null);
    const invalidRemarkModal = ref(null);
    const studentResultModal = ref(null);
    const viewingStudentResult = ref(null);
    const logoutConfirmationModal = ref(null);

    
    // MODAL INSTANCES
    let questionBsModal, assignStudentBsModal, deleteBsModal, bulkUploadBsModal, uploadConfirmationBsModal, submitAllBsModal, deleteAllBsModal, validateAllBsModal, rejectAllBsModal, approveAllBsModal, rejectAllApprovalBsModal, ad10BsModal, ad09BsModal, invalidRemarkBsModal, studentResultBsModal, userEditorBsModal, logoutConfirmationBsModal;

    // DATA REFS
    const editingQuestion = ref({});
    const questionToDelete = ref({});
    const selectedTest = ref({});
    const newTestForm = ref({ name: '', description: '', questionIds: [], timeLimit: 1, program: 'BSMT', course: 'Seamanship I' });
    const currentTest = ref({ questions: [], answers: [], currentIndex: 0, remainingTime: 0 });
    let timerInterval = null;
    const studentsToAssign = ref([]);
    const uploadStatusMessage = ref('');
    const lastUploadedQuestions = ref([]);
    const bulkUploadTags = ref({ course: 'ICT' });
    const selectedReport = ref(null);
    const selectedStudentResult = ref(null);
    const returnView = ref('reportDetail');
    const reportTab = ref('overall');
    const examSummary = ref({ total: 0, answered: 0, missed: 0, questions: [] });
    const examSummaryModal = ref(null);
    let examSummaryBsModal = null;
    const reportsViewTab = ref('tests');
    const questionToInvalidate = ref(null);
    const invalidRemark = ref('');
    
    // User Management Refs
    const userEditorModal = ref(null);
    const editingUser = ref({});
    const isPasswordRevealed = ref(false);
    const revealedPassword = ref('');
    const userFilters = ref({
        search: '',
        role: 'All',
        class: '',
        sort: '0-9'
    });
    
    const getNewQuestionTemplate = (type = 'Multiple Choice') => {
        const base = {
            text: '',
            type: type,
            course: 'Seamanship I',
        program: 'Deck Operations',
            loTag: 'LO-1: Navigation Principles',
            cognitiveTag: 'Remembering',
            status: 'Draft', // Default status for new questions
            remarks: ''
        };
        switch (type) {
            case 'Multiple Choice':
                return { ...base, options: [{text: ''}, {text: ''}, {text: ''}], answerIndex: 0 };
            case 'True or False':
                return { ...base, answer: 'True' };
            case 'Identification':
                return { ...base, answer: '' };
            case 'Enumeration':
                return { ...base, answers: [''] };
            case 'Matching Type':
                return { ...base, pairs: [{ prompt: '', answer: '' }] };
            default:
                return base;
        }
    };

    // MOCK DATA
    const users = ref([]);
    
    const courses = ref(['Seamanship I', 'COLREGs', 'Ship Construction', 'Firefighting', 'ICT', 'MARLAW']);
    const programs = ref(['BSMT', 'BSMarE']);
    const loTags = ref(['LO 1.0', 'LO 1.1', 'LO 1.2', 'LO 1.3', 'LO 1.4', 'LO 1.5', 'LO 1.6', 'LO 1.7', 'LO 1.8', 'LO 1.9', 'LO 1.10', 'LO 1.11', 'LO 1.12', 'LO 1.13', 'LO 1.14', 'LO 1.15', 'LO 1.16', 'LO 1.17', 'LO 1.18', 'LO 1.19', 'LO 2.0', 'LO 2.1', 'LO 2.2', 'LO 2.3', 'LO 2.4', 'LO 2.5', 'LO 2.6', 'LO 2.7', 'LO 2.8', 'LO 2.9', 'LO 2.10', 'LO 2.11', 'LO 2.12', 'LO 2.13', 'LO 2.14', 'LO 2.15', 'LO 2.16', 'LO 2.17', 'LO 2.18', 'LO 2.19', 'LO 3.0', 'LO 3.1', 'LO 3.2', 'LO 3.3', 'LO 3.4', 'LO 3.5']);
    const cognitiveLevels = ref(['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating']);

    const questionBank = ref([
        // All mock questions removed to allow for user-uploaded data.
    ]);
    
    const pilotTests = ref([
            // Example tests removed as question data is now dynamic.
    ]);

    const studentTests = ref([
        // Example student tests removed as question data is now dynamic.
    ]);
    
        // FILTERING STATE
    const initialFilters = { searchText: '', program: 'All', course: 'All', type: 'All', status: 'All' };
    const filters = ref({ ...initialFilters });
    const initialTestBuilderFilters = { searchText: '', program: 'All', course: 'All', type: 'All', lo: 'All', cognitiveLevel: 'All' };
    const testBuilderFilters = ref({ ...initialTestBuilderFilters });

    // METHODS
    onMounted(() => {
        fetchUsers();
        if (toastRef.value) toastInstance = bootstrap.Toast.getOrCreateInstance(toastRef.value);
        if (questionModal.value) questionBsModal = bootstrap.Modal.getOrCreateInstance(questionModal.value);
        if (assignStudentModal.value) assignStudentBsModal = bootstrap.Modal.getOrCreateInstance(assignStudentModal.value);
        if (deleteConfirmationModal.value) deleteBsModal = bootstrap.Modal.getOrCreateInstance(deleteConfirmationModal.value);
        if (userEditorModal.value) userEditorBsModal = bootstrap.Modal.getOrCreateInstance(userEditorModal.value);
        if (bulkUploadModal.value) bulkUploadBsModal = bootstrap.Modal.getOrCreateInstance(bulkUploadModal.value);
        if (uploadConfirmationModal.value) uploadConfirmationBsModal = bootstrap.Modal.getOrCreateInstance(uploadConfirmationModal.value);
        if (submitAllConfirmationModal.value) submitAllBsModal = bootstrap.Modal.getOrCreateInstance(submitAllConfirmationModal.value);
        if (deleteAllConfirmationModal.value) deleteAllBsModal = bootstrap.Modal.getOrCreateInstance(deleteAllConfirmationModal.value);
        if (validateAllConfirmationModal.value) validateAllBsModal = bootstrap.Modal.getOrCreateInstance(validateAllConfirmationModal.value);
        if (rejectAllConfirmationModal.value) rejectAllBsModal = bootstrap.Modal.getOrCreateInstance(rejectAllConfirmationModal.value);
        if (approveAllConfirmationModal.value) approveAllBsModal = bootstrap.Modal.getOrCreateInstance(approveAllConfirmationModal.value);
        if (rejectAllApprovalConfirmationModal.value) rejectAllApprovalBsModal = bootstrap.Modal.getOrCreateInstance(rejectAllApprovalConfirmationModal.value);
        if (ad10PreviewModal.value) ad10BsModal = bootstrap.Modal.getOrCreateInstance(ad10PreviewModal.value);
        if (ad09SummaryModal.value) ad09BsModal = bootstrap.Modal.getOrCreateInstance(ad09SummaryModal.value);
        if (invalidRemarkModal.value) invalidRemarkBsModal = bootstrap.Modal.getOrCreateInstance(invalidRemarkModal.value);
        if (studentResultModal.value) studentResultBsModal = bootstrap.Modal.getOrCreateInstance(studentResultModal.value);
        if (examSummaryModal.value) examSummaryBsModal = bootstrap.Modal.getOrCreateInstance(examSummaryModal.value);
        if (logoutConfirmationModal.value) logoutConfirmationBsModal = bootstrap.Modal.getOrCreateInstance(logoutConfirmationModal.value);
        ensureUniqueIds(); // Ensure IDs are unique on mount
    });
    
    const showToast = (title, message, type = 'info') => {
        toastTitle.value = title;
        toastMessage.value = message;
        if (type === 'success') toastClass.value = 'bg-success';
        else if (type === 'error') toastClass.value = 'bg-danger';
        else toastClass.value = '';
        if (toastInstance) toastInstance.show();
    };
    
    watch(() => editingQuestion.value.type, (newType, oldType) => {
        const questionData = { ...editingQuestion.value };
        if (newType !== oldType) {
            const newTemplate = getNewQuestionTemplate(newType);
            editingQuestion.value = { 
                ...newTemplate, 
                text: questionData.text,
                course: questionData.course,
                subject: questionData.subject,
                loTag: questionData.loTag,
                cognitiveTag: questionData.cognitiveTag,
                status: questionData.status || 'Draft'
            };
        }
    });
    
    const ensureUniqueIds = () => {
        const seenIds = new Set();
        const seenObjects = new Set();
        let maxId = 0;
        
        // First pass: find real max ID
        questionBank.value.forEach(q => {
            const id = Number(q.id);
            if (!isNaN(id) && id > maxId) maxId = id;
        });

        // Second pass: fix duplicates, invalids, and shared references
        for (let i = 0; i < questionBank.value.length; i++) {
            let q = questionBank.value[i];
            
            // Check for shared reference (same object used multiple times)
            if (seenObjects.has(q)) {
                    // Clone the object to break reference
                    const clone = JSON.parse(JSON.stringify(q));
                    questionBank.value[i] = clone;
                    q = questionBank.value[i]; // Update local reference to the new reactive object
            }
            seenObjects.add(q);

            let id = Number(q.id);
            // Check if ID is invalid (NaN, 0) or duplicate
            if (isNaN(id) || id <= 0 || seenIds.has(id)) {
                maxId++;
                id = maxId;
                q.id = id;
            } else {
                // Ensure q.id is stored as a number
                q.id = id;
            }
            seenIds.add(id);
        }
    };

    const toggleSidebar = () => isSidebarActive.value = !isSidebarActive.value;
    const setView = (view, filterStatus = null) => {
        // Ensure data integrity when switching views
        if (view === 'testBuilder' || view === 'questionBank') {
            ensureUniqueIds();
        }

        const leavingTimerContext = (currentView.value === 'testTaking' || currentView.value === 'testReview');
        const enteringTimerContext = (view === 'testTaking' || view === 'testReview');
        if (leavingTimerContext && !enteringTimerContext) {
            if (timerInterval) clearInterval(timerInterval);
        }

        currentView.value = view;
        if(window.innerWidth < 992) isSidebarActive.value = false;

        // When navigating to the question bank, set default filters based on role
        if (view === 'questionBank' && currentUser.value) {
            resetFilters(); // Start with clean filters
            if (filterStatus) {
                filters.value.status = filterStatus;
            } else {
                switch(currentUser.value.role) {
                    case 'Faculty':
                        filters.value.status = 'Draft';
                        break;
                    case 'Collecting Officer':
                        filters.value.status = 'Pending Validation';
                        break;
                    case 'Review Committee':
                        filters.value.status = 'Pending Approval';
                        break;
                    default:
                        filters.value.status = 'All'; // Admin or other roles see all by default
                }
            }
        }
    };

    const handleLogin = async () => {
        loginError.value = '';
        isLoading.value = true;
        
        try {
            const response = await api.post('/login', {
                email: loginForm.value.email,
                password: loginForm.value.password
            });
            
            if (response.data.token) {
                const user = response.data.user;
                // Map backend roles array to user.role property
                if (response.data.roles && Array.isArray(response.data.roles) && response.data.roles.length > 0) {
                    user.role = response.data.roles[0];
                }

                authStore.login(user, response.data.token);
                setView(user.role === 'Student' ? 'studentDashboard' : 'dashboard');
            } else {
                 loginError.value = 'Login failed: No token received.';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.value = error.response?.data?.message || 'Invalid email or password.';
        } finally {
            isLoading.value = false;
        }
    };
    
    const handleLogout = () => { 
        if (logoutConfirmationBsModal) logoutConfirmationBsModal.show();
    };

    const confirmLogout = () => {
        authStore.logout();
        loginForm.value = { email: '', password: '' };
        if (logoutConfirmationBsModal) logoutConfirmationBsModal.hide();
    };

    // User Management Methods
    const openAddUserModal = () => {
        editingUser.value = { role: 'Student', yearAndClass: '' };
        if (userEditorBsModal) userEditorBsModal.show();
    };

    const openEditUserModal = (user) => {
        editingUser.value = JSON.parse(JSON.stringify(user));
        editingUser.value.password = ''; // Clear password field for editing
        isPasswordRevealed.value = false;
        revealedPassword.value = '';
        if (userEditorBsModal) userEditorBsModal.show();
    };

    const handleUserAction = (actionType) => {
        // Validate fields before acting
        if (actionType === 'save') {
            if (!editingUser.value.fname || !editingUser.value.lname || !editingUser.value.email || !editingUser.value.role) {
                showToast('Error', 'Please fill in all required fields (First Name, Last Name, Email, Role).', 'error');
                return;
            }
            if (!editingUser.value.id && !editingUser.value.password) {
                showToast('Error', 'Password is required for new users.', 'error');
                return;
            }
            if (editingUser.value.role === 'Student' && !editingUser.value.yearAndClass) {
                showToast('Error', 'Year and Class is required for students.', 'error');
                return;
            }

            // Directly save without admin auth
            saveUser();
        } else if (actionType === 'delete') {
            // Simple confirmation before delete
            if (confirm('Are you sure you want to delete this user?')) {
                deleteUser();
            }
        } else if (actionType === 'revealPassword') {
             showToast('Info', 'Password cannot be revealed for security reasons.', 'info');
        }
    };

    const openDeleteUserConfirmation = (user) => {
        editingUser.value = user; // Track who we are deleting
        handleUserAction('delete');
    };

    const fetchUsers = async () => {
        try {
            const response = await api.get('/users');
            users.value = response.data;
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    const getRoleId = (roleName) => {
        const map = {
            'Admin': 1,
            'Faculty': 2,
            'Student': 3,
            'Assessor': 4,
            'Collecting Officer': 5,
            'Review Committee': 6
        };
        return map[roleName] || 3; // Default to Student if unknown
    };

    const saveUser = async () => {
        try {
            const userData = {
                ...editingUser.value,
                role: getRoleId(editingUser.value.role)
            };
            
            if (editingUser.value.id) {
                await api.put(`/users/${editingUser.value.id}`, userData);
                showToast('Success', 'User updated successfully.', 'success');
            } else {
                await api.post('/users', userData);
                showToast('Success', 'User added successfully.', 'success');
            }
            await fetchUsers();
            if (userEditorBsModal) userEditorBsModal.hide();
        } catch (error) {
            console.error(error);
            showToast('Error', 'Failed to save user.', 'error');
        }
    };

    const deleteUser = async () => {
        try {
            await api.delete(`/users/${editingUser.value.id}`);
            showToast('Success', 'User deleted successfully.', 'success');
            await fetchUsers();
        } catch (error) {
            console.error(error);
            showToast('Error', 'Failed to delete user.', 'error');
        }
    };

    // Question Bank Methods
    const openQuestionModal = (question = null) => {
        editingQuestion.value = question ? JSON.parse(JSON.stringify(question)) : getNewQuestionTemplate();
        if (questionBsModal) questionBsModal.show();
    };
    
    const openBulkUploadModal = () => {
        if (csvFileInput.value) {
            csvFileInput.value.value = ''; // Reset file input
        }
        lastUploadedQuestions.value = []; // Clear previous upload list
        if (bulkUploadBsModal) bulkUploadBsModal.show();
    };
    
    const handleBulkUpload = () => {
        lastUploadedQuestions.value = []; // Clear previous upload list
        const file = csvFileInput.value.files[0];
        if (!file) {
            uploadStatusMessage.value = 'Please select a CSV file to upload.';
            if (uploadConfirmationBsModal) uploadConfirmationBsModal.show();
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                uploadStatusMessage.value = 'CSV file is empty or has no data rows.';
                if (uploadConfirmationBsModal) uploadConfirmationBsModal.show();
                return;
            }

            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const headerMap = {
                type: headers.indexOf('Type'),
                text: headers.indexOf('Question Text'),
                optionA: headers.indexOf('Option A'),
                optionB: headers.indexOf('Option B'),
                optionC: headers.indexOf('Option C'),
                optionD: headers.indexOf('Option D'),
                answer: headers.indexOf('Correct Answer'),
                loTag: headers.indexOf('LO Tag'),
                cognitiveTag: headers.indexOf('Cognitive Level')
            };

            if (headerMap.type === -1 || headerMap.text === -1 || headerMap.answer === -1) {
                uploadStatusMessage.value = 'Upload failed. CSV file is missing required headers: Type, Question Text, Correct Answer.';
                if (uploadConfirmationBsModal) uploadConfirmationBsModal.show();
                return;
            }

            const newQuestions = [];
            for (let i = 1; i < lines.length; i++) {
                const data = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(d => d.trim().replace(/"/g, ''));

                const type = (data[headerMap.type] || '').toLowerCase();
                let baseQuestion = {
                    id: 0,
                    type: '', 
                    text: data[headerMap.text],
                    course: bulkUploadTags.value.subject, // Assign selected subject as course
                    subject: bulkUploadTags.value.subject,
                    loTag: data[headerMap.loTag],
                    cognitiveTag: data[headerMap.cognitiveTag] || 'Remembering',
                    status: 'Draft',
                    remarks: ''
                };

                if (!type || !baseQuestion.text) {
                    console.warn(`Skipping row ${i+1} due to missing type or text.`);
                    continue;
                }

                try {
                    if (type.includes('multiple-choice')) {
                        baseQuestion.type = 'Multiple Choice';
                        const options = [];
                        if(data[headerMap.optionA]) options.push({ text: data[headerMap.optionA] });
                        if(data[headerMap.optionB]) options.push({ text: data[headerMap.optionB] });
                        if(data[headerMap.optionC]) options.push({ text: data[headerMap.optionC] });
                        if(data[headerMap.optionD]) options.push({ text: data[headerMap.optionD] });
                        baseQuestion.options = options;
                        
                        const correctLetter = (data[headerMap.answer] || '').toUpperCase();
                        const letterMap = {'A': 0, 'B': 1, 'C': 2, 'D': 3};
                        baseQuestion.answerIndex = letterMap[correctLetter] !== undefined ? letterMap[correctLetter] : 0;

                    } else if (type.includes('short-answer')) {
                        baseQuestion.type = 'Identification';
                        baseQuestion.answer = data[headerMap.answer];

                    } else if (type.includes('true-false') || type.includes('true/false')) {
                            baseQuestion.type = 'True or False';
                            baseQuestion.answer = data[headerMap.answer];
                    } else {
                            console.warn(`Skipping unknown question type from CSV: ${type}`);
                            continue;
                    }
                    newQuestions.push(baseQuestion);
                } catch (e) {
                        console.error(`Error parsing row ${i+1}:`, e, lines[i]);
                }
            }

            if (newQuestions.length > 0) {
                let maxId = questionBank.value.reduce((max, q) => Math.max(max, Number(q.id) || 0), 0);
                newQuestions.forEach(q => {
                    q.id = ++maxId;
                    questionBank.value.push(q);
                });
                lastUploadedQuestions.value = newQuestions; // Store for review
            }
            
            uploadStatusMessage.value = `${newQuestions.length} questions were successfully uploaded and tagged with Course: "${bulkUploadTags.value.course}".`;
            ensureUniqueIds(); // Ensure IDs are unique after upload
            if (uploadConfirmationBsModal) uploadConfirmationBsModal.show();
            if (bulkUploadBsModal) bulkUploadBsModal.hide();
        };

        reader.onerror = () => {
            uploadStatusMessage.value = 'Failed to read the file.';
            if (uploadConfirmationBsModal) uploadConfirmationBsModal.show();
        };
        reader.readAsText(file);
    };

    const saveQuestion = () => {
        if (editingQuestion.value.id) {
            const index = questionBank.value.findIndex(q => q.id === editingQuestion.value.id);
            if (index !== -1) questionBank.value[index] = editingQuestion.value;
        } else {
            const maxId = questionBank.value.reduce((max, q) => Math.max(max, Number(q.id) || 0), 0);
            editingQuestion.value.id = maxId + 1;
            questionBank.value.push(editingQuestion.value);
        }
        questionBsModal.hide();
    };
    
    const editUploadedQuestion = (question) => {
        uploadConfirmationBsModal.hide();
        // The 'question' object is the actual reactive object from the questionBank
        openQuestionModal(question);
    };
    
    const openDeleteConfirmation = (question) => {
        questionToDelete.value = question;
        deleteBsModal.show();
    };

    const deleteQuestion = () => {
        questionBank.value = questionBank.value.filter(q => q.id !== questionToDelete.value.id);
        deleteBsModal.hide();
    };

    const openSubmitAllConfirmation = () => submitAllBsModal.show();
    const openDeleteAllConfirmation = () => deleteAllBsModal.show();
    const openValidateAllConfirmation = () => validateAllBsModal.show();
    const openRejectAllConfirmation = () => rejectAllBsModal.show();
    const openApproveAllConfirmation = () => approveAllBsModal.show();
    const openRejectAllApprovalConfirmation = () => rejectAllApprovalBsModal.show();

    const submitAllDrafts = () => {
        questionBank.value.forEach(q => {
            if (q.status === 'Draft') {
                q.status = 'Pending Validation';
            }
        });
        submitAllBsModal.hide();
    };

    const deleteAllDrafts = () => {
        questionBank.value = questionBank.value.filter(q => q.status !== 'Draft');
        deleteAllBsModal.hide();
    };
    
    const openInvalidModal = (question) => {
        questionToInvalidate.value = question;
        invalidRemark.value = ''; // Clear previous remarks
        invalidRemarkBsModal.show();
    };

    const submitInvalidRemark = () => {
        if (!questionToInvalidate.value || !invalidRemark.value.trim()) return;

        const question = questionBank.value.find(q => q.id === questionToInvalidate.value.id);
        if (question) {
            question.status = 'Draft';
            question.remarks = invalidRemark.value;
        }
        invalidRemarkBsModal.hide();
        questionToInvalidate.value = null;
        invalidRemark.value = '';
    };
    
    const validateAllPending = () => {
        questionBank.value.forEach(q => {
            if (q.status === 'Pending Validation') {
                q.status = 'Pending Approval';
            }
        });
        validateAllBsModal.hide();
    };

    const rejectAllPending = () => {
        questionBank.value.forEach(q => {
            if (q.status === 'Pending Validation') {
                q.status = 'Draft';
            }
        });
        rejectAllBsModal.hide();
    };
    
    const approveAllPending = () => {
        questionBank.value.forEach(q => {
            if (q.status === 'Pending Approval') {
                q.status = 'Approved';
            }
        });
        approveAllBsModal.hide();
    };
    
    const rejectAllApproval = () => {
            questionBank.value.forEach(q => {
            if (q.status === 'Pending Approval') {
                q.status = 'Draft';
            }
        });
        rejectAllApprovalBsModal.hide();
    };
    
    const updateQuestionStatus = (question, newStatus) => {
        const q = questionBank.value.find(item => item.id === question.id);
        if (q) {
            q.status = newStatus;
        }
    };
    
        const downloadTemplate = () => {
        const csvContent = `Type,Question Text,Points,Option A,Option B,Option C,Option D,Correct Answer,LO Tag,Cognitive Level
"multiple-choice","What is the primary function of a CPU in a computer?",1,"Storing data","Displaying data","Processing data","Transmitting data","C","LO-1: Knowledge","Remembering"
"short-answer","What is the capital of France?",1,,,,,"Paris","LO-1: Knowledge","Remembering"
"true-false","The Earth is flat.",1,,,,,"False","LO-1: Knowledge","Remembering"
`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'question_upload_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    // Test Builder Methods
    const openAd10Preview = () => {
        ad10BsModal.show();
    };

    const openAd09Summary = () => {
        ad09BsModal.show();
    };
    
    const printPreview = (elementId) => {
        const sourceEl = document.getElementById(elementId);
        const printContainer = document.getElementById('print-container');
        if (!sourceEl || !printContainer) {
            showToast('Error', 'Printable content not found.', 'error');
            return;
        }
        printContainer.innerHTML = sourceEl.innerHTML;
        const cleanup = () => {
            printContainer.innerHTML = '';
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        window.print();
    };

    const createTest = () => {
        if (!newTestForm.value.name || newTestForm.value.questionIds.length === 0) {
            showToast('Validation Error', 'Please provide a test name and select at least one question.', 'error');
            return;
        }
        const newTest = {
            id: Math.max(0, ...pilotTests.value.map(t => t.id)) + 1,
            name: newTestForm.value.name,
            description: newTestForm.value.description,
            term: newTestForm.value.term,
            timeLimit: newTestForm.value.timeLimit || 1,
            questionIds: [...newTestForm.value.questionIds],
            status: 'Pending Review',
            participants: 0,
            progress: 0
        };
        pilotTests.value.push(newTest);
        // Reset form completely
        newTestForm.value = { name: '', description: '', term: 'Midterm', questionIds: [], timeLimit: 1 };
        manageTest(newTest);
    };
    
    const toggleSelectAll = () => {
        const filteredIds = filteredAvailableForTestBuilder.value.map(q => q.id);
        const currentIds = Array.isArray(newTestForm.value.questionIds) ? newTestForm.value.questionIds : [];

        if (areAllFilteredSelected.value) {
            newTestForm.value.questionIds = currentIds.filter(id => !filteredIds.includes(id));
        } else {
            const uniqueIds = new Set([...currentIds, ...filteredIds]);
            newTestForm.value.questionIds = [...uniqueIds];
        }
    };

    const toggleQuestion = (id) => {
        const numericId = Number(id);
        const currentIds = Array.isArray(newTestForm.value.questionIds) ? [...newTestForm.value.questionIds] : [];
        if (currentIds.includes(numericId)) {
            newTestForm.value.questionIds = currentIds.filter(existingId => existingId !== numericId);
        } else {
            newTestForm.value.questionIds = [...currentIds, numericId];
        }
    };
    
    // Pilot Admin Methods
    const openAssignStudentModal = (test) => {
        selectedTest.value = test;
        studentsToAssign.value = []; // Clear previous selections
        assignStudentBsModal.show();
    };

    const assignStudents = () => {
        studentsToAssign.value.forEach(studentId => {
            const isAlreadyAssigned = studentTests.value.some(
                st => st.studentId === studentId && st.testId === selectedTest.value.id
            );

            if (!isAlreadyAssigned) {
                const newAssignment = {
                    studentId: studentId,
                    testId: selectedTest.value.id,
                    name: selectedTest.value.name,
                    status: 'Not Started',
                    questionIds: selectedTest.value.questionIds,
                    answers: {},
                    score: null
                };
                studentTests.value.push(newAssignment);
            }
        });
        
        const testToUpdate = pilotTests.value.find(pt => pt.id === selectedTest.value.id);
        if (testToUpdate) {
            const assignedCount = studentTests.value.filter(st => st.testId === selectedTest.value.id).length;
            testToUpdate.participants = assignedCount;
        }

        assignStudentBsModal.hide();
    };
    
    const manageTest = (test) => {
        selectedTest.value = test;
        setView('manageTest');
    };

    const approveTest = (test) => {
        const t = pilotTests.value.find(pt => pt.id === test.id);
        if (t) {
            t.status = 'Active';
            showToast('Success', `Test "${t.name}" has been approved and is now Active.`, 'success');
        }
    };

    const getAssignedStudentsForTest = (test) => {
        if (!test || !test.id) return [];
        const studentIds = studentTests.value.filter(st => st.testId === test.id).map(st => st.studentId);
        return users.value.filter(u => studentIds.includes(u.id));
    };
    
    const getStudentTestStatus = (student, test) => {
        const submission = studentTests.value.find(st => st.studentId === student.id && st.testId === test.id);
        return submission ? submission.status : 'Not Assigned';
    };
    
        const getStudentTestStatusClass = (student, test) => {
        const submission = studentTests.value.find(st => st.studentId === student.id && st.testId === test.id);
        if (!submission) return 'status-draft';
        return submission.status === 'Completed' ? 'status-completed' : 'status-not-started';
    };

    const getStudentTestScore = (student, test) => {
        const submission = studentTests.value.find(st => st.studentId === student.id && st.testId === test.id);
        return submission ? submission.score : null;
    };

    // Student Methods
    const startTest = (test) => {
        // Update status to In Progress
        const submission = studentTests.value.find(st => st.studentId === currentUser.value.id && st.testId === test.id);
        if (submission) {
            submission.status = 'In Progress';
        }

        const testQuestionIds = Array.isArray(test.questionIds) ? test.questionIds : [];
        currentTest.value = {
            ...test,
            questions: questionBank.value.filter(q => testQuestionIds.includes(q.id)),
            answers: {},
            currentIndex: 0,
            remainingTime: (test.timeLimit || 1) * 60 // Convert minutes to seconds
        };
        
        // Start Timer
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (currentTest.value.remainingTime > 0) {
                currentTest.value.remainingTime--;
            } else {
                clearInterval(timerInterval);
                submitTest(true); // Auto-submit when time runs out
            }
        }, 1000);
        
        setView('testTaking');
    };
    const nextQuestion = () => { if (currentTest.value.currentIndex < currentTest.value.questions.length - 1) currentTest.value.currentIndex++; };
    const prevQuestion = () => { if (currentTest.value.currentIndex > 0) currentTest.value.currentIndex--; };
    
    const getExamSummary = () => {
        const summary = {
            total: currentTest.value.questions.length,
            answered: 0,
            missed: 0,
            questions: []
        };
        const answers = currentTest.value.answers || {};
        currentTest.value.questions.forEach((q, index) => {
            const ans = answers[q.id];
            const isAnswered = ans !== undefined && ans !== null && ans !== '';
            if (isAnswered) summary.answered++;
            else summary.missed++;
            
            let answerText = '';
            if (isAnswered) {
                if (q.type === 'Multiple Choice') {
                        if(q.options && q.options[ans]) answerText = q.options[ans].text;
                } else {
                    answerText = ans;
                }
            }

            summary.questions.push({
                id: q.id,
                text: q.text,
                type: q.type,
                index: index + 1,
                isAnswered: isAnswered,
                answer: answerText
            });
        });
        return summary;
    };

    const finalizeTestSubmission = (isAutoSubmit = false) => {
            if (timerInterval) clearInterval(timerInterval);
            
            if (examSummaryBsModal) examSummaryBsModal.hide();

        let score = 0;
        const answers = currentTest.value.answers || {};
        
        currentTest.value.questions.forEach((q) => {
            const studentAnswer = answers[q.id];
            if (q.type === 'Multiple Choice' && studentAnswer === q.answerIndex) {
                score++;
            } else if (q.type === 'True or False' && studentAnswer === q.answer) {
                score++;
            } else if (q.type === 'Identification' && studentAnswer && q.answer.toLowerCase() === studentAnswer.toLowerCase()) {
                    score++;
            }
        });
        
        let percentage = 0;
        if (currentTest.value.questions.length > 0) {
            percentage = Math.round((score / currentTest.value.questions.length) * 100);
        }
        
        const testInStudentList = studentTests.value.find(t => t.testId === currentTest.value.testId && t.studentId === currentUser.value.id);
        if(testInStudentList) {
            testInStudentList.status = 'Completed';
            testInStudentList.score = `${percentage}%`;
            testInStudentList.answers = answers;
        }

        const mainTest = pilotTests.value.find(pt => pt.id === currentTest.value.testId);
        if(mainTest) {
            const completedCount = studentTests.value.filter(st => st.testId === mainTest.id && st.status === 'Completed').length;
            mainTest.progress = Math.round((completedCount / mainTest.participants) * 100);
            if(mainTest.progress === 100) mainTest.status = 'Completed';
        }

        if (isAutoSubmit) {
            showToast('Time Up', `Test automatically submitted! Your score: ${percentage}%`, 'info');
        } else {
            showToast('Success', `Test submitted! Your score: ${percentage}%`, 'success');
        }
        setView('studentDashboard');
    };

    const submitTest = (isAutoSubmit = false) => {
        if (isAutoSubmit === true) {
            finalizeTestSubmission(true);
        } else {
            // Show summary in Review View
            const summary = getExamSummary();
            examSummary.value = summary;
            setView('testReview');
        }
    };
    
    const goToQuestion = (index) => {
        currentTest.value.currentIndex = index;
        setView('testTaking');
    };
    

    // Reports & Analysis Methods
    const viewReport = (test) => {
        reportTab.value = 'overall';
        const testSubmissions = studentTests.value.filter(st => st.testId === test.id && st.status === 'Completed');
        if (testSubmissions.length === 0) {
            showToast('Info', 'No completed submissions for this test to generate a report.', 'info');
            return;
        }

        const testQuestionIds = Array.isArray(test.questionIds) ? test.questionIds : [];
        const questions = questionBank.value.filter(q => testQuestionIds.includes(q.id));
        const participants = testSubmissions.length;
        
        const itemAnalysis = questions.map(q => {
            let correctCount = 0;
            testSubmissions.forEach(sub => {
                const studentAnswer = sub.answers[q.id];
                if (q.type === 'Multiple Choice' && studentAnswer === q.answerIndex) {
                    correctCount++;
                } else if (q.type === 'True or False' && studentAnswer === q.answer) {
                    correctCount++;
                } else if (q.type === 'Identification' && studentAnswer && q.answer.toLowerCase() === studentAnswer.toLowerCase()) {
                    correctCount++;
                }
            });
            
            const difficulty = correctCount / participants;
            
            const sortedSubmissions = [...testSubmissions].sort((a,b) => parseFloat(b.score) - parseFloat(a.score));
            const highGroupCount = Math.ceil(participants / 2);
            const lowGroupCount = participants - highGroupCount;
            const highGroup = sortedSubmissions.slice(0, highGroupCount);
            const lowGroup = sortedSubmissions.slice(highGroupCount);

            let highCorrect = 0;
            highGroup.forEach(sub => {
                const studentAnswer = sub.answers[q.id];
                if (q.type === 'Multiple Choice' && studentAnswer === q.answerIndex) highCorrect++;
                else if (q.type === 'True or False' && studentAnswer === q.answer) highCorrect++;
                else if (q.type === 'Identification' && studentAnswer && q.answer.toLowerCase() === studentAnswer.toLowerCase()) highCorrect++;
            });

            let lowCorrect = 0;
            if(lowGroup.length > 0){
                lowGroup.forEach(sub => {
                        const studentAnswer = sub.answers[q.id];
                        if (q.type === 'Multiple Choice' && studentAnswer === q.answerIndex) lowCorrect++;
                        else if (q.type === 'True or False' && studentAnswer === q.answer) lowCorrect++;
                        else if (q.type === 'Identification' && studentAnswer && q.answer.toLowerCase() === studentAnswer.toLowerCase()) lowCorrect++;
                });
            }
            
            const discrimination = lowGroupCount > 0 ? (highCorrect / highGroupCount) - (lowCorrect / lowGroupCount) : (highCorrect/highGroupCount);

            let recommendation = { text: 'Good Item', class: 'status-badge status-approved' };
            if (discrimination < 0.15) recommendation = { text: 'Poor Discrimination', class: 'status-badge status-rejected'};
            if (difficulty > 0.9) recommendation = { text: 'Review - Too Easy', class: 'status-badge status-pending-validation'};
            if (difficulty < 0.2) recommendation = { text: 'Review - Too Hard', class: 'status-badge status-pending-validation'};

            return { id: q.id, text: q.text, difficulty, discrimination, recommendation };
        });

        const totalScore = testSubmissions.reduce((acc, sub) => acc + parseFloat(sub.score), 0);
        
        const studentResults = testSubmissions.map(sub => {
            const student = users.value.find(u => u.id === sub.studentId);
            return {
                studentId: sub.studentId,
                name: student ? `${student.fname || ''} ${student.mname || ''} ${student.lname || ''}`.trim() : 'Unknown Student',
                score: sub.score,
                answers: sub.answers
            };
        });

        selectedReport.value = {
            id: test.id,
            name: test.name,
            description: test.description,
            participants: participants,
            avgScore: totalScore / participants,
            avgTime: 35, // Mock data
            itemAnalysis: itemAnalysis,
            questionIds: testQuestionIds,
            studentResults: studentResults
        };
        
        setView('reportDetail');
    };

    const openStudentResult = (result) => {
        selectedStudentResult.value = result;
        if (currentView.value === 'reports') {
            reportsViewTab.value = 'tests';
            returnView.value = 'reports';
        } else {
            returnView.value = 'reportDetail';
        }
        setView('studentResultDetail');
    };

    const viewStudentTestResult = (test) => {
        selectedReport.value = {
            name: test.name,
            questionIds: Array.isArray(test.questionIds) ? test.questionIds : []
        };
        const u = currentUser.value;
        selectedStudentResult.value = {
            name: u ? `${u.fname || ''} ${u.mname || ''} ${u.lname || ''}`.trim() : 'Unknown',
            score: test.score,
            answers: test.answers || {}
        };
        returnView.value = 'studentDashboard';
        setView('studentResultDetail');
    };

    const isAnswerCorrect = (question, answer) => {
        if (question.type === 'Multiple Choice') {
            return answer === question.answerIndex;
        } else if (question.type === 'True or False') {
            return answer === question.answer;
        } else if (question.type === 'Identification') {
            return answer && question.answer.toLowerCase() === answer.toLowerCase();
        }
        return false;
    };

    const formatAnswer = (question, answer) => {
        if (answer === undefined || answer === null) return 'No Answer';
        
        if (question.type === 'Multiple Choice') {
            const option = question.options[answer];
            return option ? option.text : 'Invalid Option';
        }
        return answer;
    };
    
    const getanswer = (question) => {
        if (question.type === 'Multiple Choice') {
            return question.answerIndex;
        }
        return question.answer;
    };

    const getStatusBadge = (status) => {
        switch(status) {
            case 'Draft': return 'status-badge status-draft';
            case 'Pending Validation': return 'status-badge status-pending-validation';
            case 'Pending Approval': return 'status-badge status-pending-approval';
            case 'Approved': return 'status-badge status-approved';
            case 'Rejected': return 'status-badge status-rejected';
            default: return 'status-badge';
        }
    };
    
    // COMPUTED PROPERTIES
    const allPrograms = computed(() => [...new Set(programs.value.concat(questionBank.value.map(q => q.program)))]);
    const allCourses = computed(() => [...new Set(courses.value.concat(questionBank.value.map(q => q.course)))]);
    const allTypes = computed(() => [...new Set(questionBank.value.map(q => q.type))]);
    const allStatuses = computed(() => [...new Set(['Draft', 'Pending Validation', 'Pending Approval', 'Approved', 'Rejected'])]);
    const hasDrafts = computed(() => questionBank.value.some(q => q.status === 'Draft'));
    const hasPendingValidation = computed(() => questionBank.value.some(q => q.status === 'Pending Validation'));
    const hasPendingApproval = computed(() => questionBank.value.some(q => q.status === 'Pending Approval'));
    
    const filteredQuestionBank = computed(() => {
        return questionBank.value.filter(q => {
            const text = q.text || '';
            const searchText = filters.value.searchText || '';
            const searchTextMatch = text.toLowerCase().includes(searchText.toLowerCase());
            const programMatch = filters.value.program === 'All' || q.program === filters.value.program;
            const courseMatch = filters.value.course === 'All' || q.course === filters.value.course;
            const typeMatch = filters.value.type === 'All' || q.type === filters.value.type;
            const statusMatch = filters.value.status === 'All' || q.status === filters.value.status;
            return searchTextMatch && programMatch && courseMatch && typeMatch && statusMatch;
        });
    });
    
    const groupedQuestionBank = computed(() => {
        return filteredQuestionBank.value.reduce((groups, question) => {
            const course = question.course || 'Uncategorized'; // Handle missing course
            if (!groups[course]) {
                groups[course] = [];
            }
            groups[course].push(question);
            return groups;
        }, {}); // Start with an empty object
    });
    
    // State for collapsible course groups
    const expandedCourses = ref(new Set());

    // Watch to automatically expand groups when filters change
    watch(groupedQuestionBank, (newGroups) => {
        expandedCourses.value = new Set(Object.keys(newGroups));
    }, { immediate: true }); // immediate: true to run on initial load

    const toggleCourseGroup = (course) => {
        // We need to create a new Set for reactivity to trigger
        const newSet = new Set(expandedCourses.value);
        if (newSet.has(course)) {
            newSet.delete(course);
        } else {
            newSet.add(course);
        }
        expandedCourses.value = newSet;
    };

    const isCourseExpanded = (course) => {
        return expandedCourses.value.has(course);
    };
    
    const availableForTestBuilder = computed(() => {
        return questionBank.value.filter(q => q.status === 'Approved');
    });
    
        const filteredAvailableForTestBuilder = computed(() => {
        return availableForTestBuilder.value.filter(q => {
            const text = q.text || '';
            const searchText = testBuilderFilters.value.searchText || '';
            const searchTextMatch = text.toLowerCase().includes(searchText.toLowerCase());
            const programMatch = testBuilderFilters.value.program === 'All' || q.program === testBuilderFilters.value.program;
            const courseMatch = testBuilderFilters.value.course === 'All' || q.course === testBuilderFilters.value.course;
            const typeMatch = testBuilderFilters.value.type === 'All' || q.type === testBuilderFilters.value.type;
            const loValue = testBuilderFilters.value.lo;
            const loMatch = loValue === 'All' || (q.loTag && q.loTag.startsWith(loValue));
            const cognitiveValue = testBuilderFilters.value.cognitiveLevel;
            const cognitiveMatch = cognitiveValue === 'All' || q.cognitiveTag === cognitiveValue;
            return searchTextMatch && programMatch && courseMatch && typeMatch && loMatch && cognitiveMatch;
        });
    });

    const areAllFilteredSelected = computed(() => {
        const filteredIds = filteredAvailableForTestBuilder.value.map(q => q.id);
        if (filteredIds.length === 0) return false;
        const currentIds = newTestForm.value.questionIds || [];
        if (!Array.isArray(currentIds)) return false;
        return filteredIds.every(id => currentIds.includes(id));
    });
    
    const assignedTestsForStudent = computed(() => {
        if (!currentUser.value) return [];
        return studentTests.value.filter(st => st.studentId === currentUser.value.id);
    });
    
    const currentContextName = computed(() => {
        if (currentView.value === 'reportDetail' && selectedReport.value) return selectedReport.value.name;
        if (currentView.value === 'testBuilder') return newTestForm.value.name;
        if (currentView.value === 'manageTest' && selectedTest.value) return selectedTest.value.name;
        return 'Preview';
    });
    
        const currentContextDescription = computed(() => {
        if (currentView.value === 'reportDetail' && selectedReport.value) return selectedReport.value.description;
        if (currentView.value === 'testBuilder') return newTestForm.value.description;
        if (currentView.value === 'manageTest' && selectedTest.value) return selectedTest.value.description;
        return 'Description';
    });

    const selectedQuestionsForPreview = computed(() => {
        let ids = [];
        if (currentView.value === 'reportDetail' && selectedReport.value) {
            ids = selectedReport.value.questionIds;
        } else if (currentView.value === 'testBuilder') {
            ids = newTestForm.value.questionIds;
        } else if (currentView.value === 'manageTest' && selectedTest.value) {
            ids = selectedTest.value.questionIds;
        }
        if (!ids || !Array.isArray(ids)) return [];
        return questionBank.value.filter(q => ids.includes(q.id));
    });
    
    const filteredUsers = computed(() => {
        let result = users.value.filter(u => {
            // Search Filter
            const search = userFilters.value.search.toLowerCase();
            const fullName = `${u.fname || ''} ${u.mname || ''} ${u.lname || ''}`.trim().toLowerCase();
            const nameMatch = fullName.includes(search);
            const emailMatch = u.email && u.email.toLowerCase().includes(search);
            const classMatch = u.yearAndClass && u.yearAndClass.toLowerCase().includes(search);
            const searchMatch = !search || nameMatch || emailMatch || classMatch;
            
            // Role Filter
            const roleMatch = userFilters.value.role === 'All' || u.role === userFilters.value.role;
            
            // Class Filter (Strict)
            const filterClass = userFilters.value.class.toLowerCase();
            const strictClassMatch = !userFilters.value.class || (u.yearAndClass && u.yearAndClass.toLowerCase().includes(filterClass));
            
            return searchMatch && roleMatch && strictClassMatch;
        });
        
        // Sort
        result.sort((a, b) => {
            const nameA = `${a.fname || ''} ${a.mname || ''} ${a.lname || ''}`.trim();
            const nameB = `${b.fname || ''} ${b.mname || ''} ${b.lname || ''}`.trim();
            
            if (userFilters.value.sort === 'A-Z') {
                return nameA.localeCompare(nameB);
            } else if (userFilters.value.sort === 'Z-A') {
                return nameB.localeCompare(nameA);
            } else if (userFilters.value.sort === '0-9') {
                return a.id - b.id;
            }
            return 0;
        });
        
        return result;
    });

    const ad09SummaryData = computed(() => {
        const cognitiveLevels = ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'];
        const summary = {};
        const colTotals = Object.fromEntries(cognitiveLevels.map(level => [level, 0]));
        const rowTotals = {};

        if (selectedQuestionsForPreview.value) {
            selectedQuestionsForPreview.value.forEach(q => {
                if (!q) return;
                const raw = q.loTag || 'Unspecified';
                const match = raw.match(/^(?:CLO|LO)-\d+/i);
                const lo = match ? match[0].toUpperCase().replace(/^CLO/, 'LO') : 'Unspecified';
                const cognitive = q.cognitiveTag || 'Remembering';
                
                if (!summary[lo]) {
                    summary[lo] = Object.fromEntries(cognitiveLevels.map(level => [level, 0]));
                    rowTotals[lo] = 0;
                }
                
                if (summary[lo][cognitive] !== undefined) {
                    summary[lo][cognitive]++;
                }
                if (colTotals[cognitive] !== undefined) {
                    colTotals[cognitive]++;
                }
                rowTotals[lo]++;
            });
        }

        return { summary, cognitiveLevels, colTotals, rowTotals };
    });
    
    const completedTests = computed(() => {
        return pilotTests.value.filter(t => t.status === 'Completed');
    });

    const resetFilters = () => {
        filters.value = { ...initialFilters };
    };
    
    const resetTestBuilderFilters = () => {
        testBuilderFilters.value = { ...initialTestBuilderFilters };
    };

    const recentActivities = computed(() => {
        const activities = [];
        // Students taking tests
        studentTests.value.forEach(st => {
            if (st.status === 'In Progress') {
                const student = users.value.find(u => u.id === st.studentId);
                const studentName = student ? `${student.fname || ''} ${student.mname || ''} ${student.lname || ''}`.trim() : 'Unknown Student';
                activities.push({
                    id: `student-${st.studentId}-${st.testId}`,
                    icon: 'fa-user-clock',
                    color: 'text-primary',
                    message: `${studentName} is taking "${st.name}".`
                });
            }
        });
        return activities;
    });

    return {
        recentActivities,
        currentView, currentUser, loginForm, loginError, users, questionBank, pilotTests, studentTests, selectedReport, selectedStudentResult,
        editingQuestion, questionModal, assignStudentModal, deleteConfirmationModal, questionToDelete, bulkUploadModal, csvFileInput,
        isSidebarActive, isDarkMode, toggleDarkMode, selectedTest, newTestForm, currentTest, filters, studentsToAssign, testBuilderFilters,
        uploadConfirmationModal, uploadStatusMessage, bulkUploadTags, isPasswordRevealed, revealedPassword, userFilters, filteredUsers,
        submitAllConfirmationModal, deleteAllConfirmationModal, validateAllConfirmationModal, rejectAllConfirmationModal,
        approveAllConfirmationModal, rejectAllApprovalConfirmationModal, 
        ad10PreviewModal, ad09SummaryModal, openAd10Preview, openAd09Summary, printPreview,
        invalidRemarkModal, invalidRemark, openInvalidModal, submitInvalidRemark, reportsViewTab,
        examSummary, examSummaryModal, getExamSummary, finalizeTestSubmission, goToQuestion,
        handleLogin, handleLogout, confirmLogout, logoutConfirmationModal, saveQuestion, openQuestionModal, deleteQuestion, openDeleteConfirmation,
        toggleSidebar, setView, createTest, openAssignStudentModal, assignStudents, updateQuestionStatus,
        startTest, nextQuestion, prevQuestion, submitTest, openBulkUploadModal, handleBulkUpload, downloadTemplate,
        openSubmitAllConfirmation, openDeleteAllConfirmation, submitAllDrafts, deleteAllDrafts,
        openValidateAllConfirmation, openRejectAllConfirmation, validateAllPending, rejectAllPending,
        openApproveAllConfirmation, openRejectAllApprovalConfirmation, approveAllPending, rejectAllApproval,
        manageTest, approveTest, getAssignedStudentsForTest, getStudentTestStatus, getStudentTestStatusClass, getStudentTestScore,
        viewReport, openStudentResult, viewStudentTestResult, returnView,
        filteredQuestionBank, allPrograms, allCourses, allTypes, allStatuses, loTags, cognitiveLevels, resetFilters, getStatusBadge, hasDrafts, hasPendingValidation, hasPendingApproval,
        availableForTestBuilder, assignedTestsForStudent, filteredAvailableForTestBuilder, areAllFilteredSelected, completedTests,
        resetTestBuilderFilters, toggleQuestion, toggleSelectAll,
        selectedQuestionsForPreview, ad09SummaryData, reportTab,
        groupedQuestionBank,
        toggleCourseGroup, isCourseExpanded,
        lastUploadedQuestions, editUploadedQuestion,
        toastRef, toastTitle, toastMessage, toastClass,
        userEditorModal, editingUser,
        openAddUserModal, openEditUserModal, handleUserAction, openDeleteUserConfirmation, fetchUsers,
        currentContextName, currentContextDescription, isAnswerCorrect, formatAnswer, getanswer
    };
}
