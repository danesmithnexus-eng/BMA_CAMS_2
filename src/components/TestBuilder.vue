<template>
    <div>
        <h2 class="mb-4">Test Builder</h2>
        <div class="row">
            <div class="col-lg-8 mb-4 mb-lg-0">
                <div class="card">
                    <div class="card-header">Select Questions (Only 'Approved' questions are shown)</div>
                    <!-- Filters for Test Builder -->
                    <div class="card-body border-bottom">
                        <div class="row g-2 align-items-center">
                            <div class="col-lg-3"><input type="text" class="form-control form-control-sm" placeholder="Search questions..." v-model="testBuilderFilters.searchText"></div>
                            <div class="col-lg-2 col-md-4"><select class="form-select form-select-sm" v-model="testBuilderFilters.program"><option value="All">All Programs</option><option v-for="program in allPrograms" :key="program">{{ program }}</option></select></div>
                            <div class="col-lg-2 col-md-4"><select class="form-select form-select-sm" v-model="testBuilderFilters.course"><option value="All">All Courses</option><option v-for="course in allCourses" :key="course">{{ course }}</option></select></div>
                            <div class="col-lg-2 col-md-4"><select class="form-select form-select-sm" v-model="testBuilderFilters.type"><option value="All">All Types</option><option v-for="type in allTypes" :key="type">{{ type }}</option></select></div>
                            <div class="col-lg-2 col-md-4"><select class="form-select form-select-sm" v-model="testBuilderFilters.lo"><option v-for="lo in loTags" :key="lo" :value="lo">{{ lo === 'All' ? 'All LOs' : lo }}</option></select></div>
                            <div class="col-lg-2 col-md-4"><select class="form-select form-select-sm" v-model="testBuilderFilters.cognitiveLevel"><option value="All">All Cognitive Levels</option><option v-for="level in cognitiveLevels" :key="level" :value="level">{{ level }}</option></select></div>
                            <div class="col-lg-1"><button class="btn btn-sm btn-outline-secondary w-100" @click="resetTestBuilderFilters">Reset</button></div>
                        </div>
                    </div>
                    <div class="card-body border-bottom py-2">
                        <button class="btn btn-sm btn-link text-decoration-none" @click="toggleSelectAll">
                            <i :class="areAllFilteredSelected ? 'fas fa-check-square' : 'fas fa-square'" class="me-2"></i>
                            {{ areAllFilteredSelected ? 'Unselect All' : 'Select All' }} ({{ filteredAvailableForTestBuilder.length }} showing)
                        </button>
                    </div>
                    <div class="card-body scrollable-y-50">
                        <div v-if="availableForTestBuilder.length === 0" class="text-center text-muted p-5">No approved questions available.</div>
                        <div v-else-if="filteredAvailableForTestBuilder.length === 0" class="text-center text-muted p-5">No questions match your filters.</div>
                        <div v-for="(q, index) in filteredAvailableForTestBuilder" :key="q.id + '-' + index" class="form-check mb-2">
                            <input class="form-check-input" type="checkbox" :value="q.id" :id="'q-check-'+q.id+'-'+index" :checked="newTestForm.questionIds.includes(q.id)" @change="toggleQuestion(q.id)">
                            <label class="form-check-label" :for="'q-check-'+q.id+'-'+index"><strong>[{{q.type}}] <span class="text-muted" style="font-size: 0.8em;">#{{q.id}}</span></strong> {{ q.text }}</label>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-lg-4">
                <div class="card">
                    <div class="card-header">Test Details</div>
                    <div class="card-body">
                        <h6 class="mb-3">Selected Questions: {{ newTestForm.questionIds.length }}</h6>
                        <div class="mb-3">
                            <label class="form-label">Program</label>
                            <select class="form-select" v-model.number="newTestForm.programId">
                                <option :value="null">Select Program</option>
                                <option v-for="p in programOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Course</label>
                            <select class="form-select" v-model.number="newTestForm.courseId">
                                <option :value="null">Select Course</option>
                                <option v-for="c in courseOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Test Name</label>
                            <input type="text" class="form-control" placeholder="e.g., Midterm Pilot Test" v-model="newTestForm.name">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Description</label>
                            <textarea class="form-control" rows="3" v-model="newTestForm.description"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Term</label>
                            <select class="form-select" v-model="newTestForm.term">
                                <option value="Midterm">Midterm</option>
                                <option value="Finals">Finals</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Semester</label>
                            <select class="form-select" v-model="newTestForm.semester">
                                <option value="1st Semester">1st Semester</option>
                                <option value="2nd Semester">2nd Semester</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Academic Year:</label>
                            <div class="d-flex align-items-center gap-2">
                                <input type="text" class="form-control" :value="newTestForm.academicYearStart" @input="(e) => updateAcademicYear(e, 'start')" placeholder="e.g. 2023">
                                <span>-</span>
                                <input type="text" class="form-control" :value="newTestForm.academicYearEnd" @input="(e) => updateAcademicYear(e, 'end')" placeholder="e.g. 2024">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Time Limit (minutes)</label>
                            <input type="number" class="form-control" v-model.number="newTestForm.timeLimit" min="1">
                        </div>                                                                                                                                                                                                                                                                                                                                                 
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary" @click="createTest">Create Test</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { useQuestionStore } from '../stores/questions';
import { useTestStore } from '../stores/tests';
import { useUIStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

export default {
    name: 'TestBuilder',
    data() {
        return {
            testBuilderFilters: {
                searchText: '',
                program: 'All',
                course: 'All',
                type: 'All',
                lo: 'All',
                cognitiveLevel: 'All'
            },
            newTestForm: {
                name: '',
                description: '',
                program: 'Deck Operations',
                course: 'Seamanship I',
                term: 'Midterm',
                semester: '1st Semester',
                academicYearStart: '',
                academicYearEnd: '',
                timeLimit: 60,
                questionIds: [],
                programId: null,
                courseId: null,
                studentIds: []
            },
            loTags: ['LO 1.0', 'LO 1.1', 'LO 1.2', 'LO 1.3', 'LO 1.4', 'LO 1.5', 'LO 1.6', 'LO 1.7', 'LO 1.8', 'LO 1.9', 'LO 1.10', 'LO 1.11', 'LO 1.12', 'LO 1.13', 'LO 1.14', 'LO 1.15', 'LO 1.16', 'LO 1.17', 'LO 1.18', 'LO 1.19', 'LO 2.0', 'LO 2.1', 'LO 2.2', 'LO 2.3', 'LO 2.4', 'LO 2.5', 'LO 2.6', 'LO 2.7', 'LO 2.8', 'LO 2.9', 'LO 2.10', 'LO 2.11', 'LO 2.12', 'LO 2.13', 'LO 2.14', 'LO 2.15', 'LO 2.16', 'LO 2.17', 'LO 2.18', 'LO 2.19', 'LO 3.0', 'LO 3.1', 'LO 3.2', 'LO 3.3', 'LO 3.4', 'LO 3.5'],
            cognitiveLevels: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'],
            programOptions: [],
            courseOptions: [],
            courseById: {}
        };
    },
    computed: {
        ...mapState(useQuestionStore, ['questions']),
        ...mapState(useAuthStore, { currentUser: 'user' }),
        allPrograms() { return this.programOptions.map(o => o.label); },
        allCourses() { return this.courseOptions.map(o => o.label); },
        allTypes() { return ['Multiple Choice', 'True or False', 'Identification', 'Matching Type', 'Enumeration']; },
        
        availableForTestBuilder() {
            return this.questions.filter(q => q.status === 'Approved');
        },
        filteredAvailableForTestBuilder() {
             return this.availableForTestBuilder.filter(q => {
                const matchesSearch = (q.text || '').toLowerCase().includes(this.testBuilderFilters.searchText.toLowerCase());
                const matchesProgram = this.testBuilderFilters.program === 'All' || q.program === this.testBuilderFilters.program;
                const matchesCourse = this.testBuilderFilters.course === 'All' || q.course === this.testBuilderFilters.course;
                const matchesType = this.testBuilderFilters.type === 'All' || q.type === this.testBuilderFilters.type;
                const matchesLo = this.testBuilderFilters.lo === 'All' || (q.loTags && q.loTags.includes(this.testBuilderFilters.lo));
                const matchesCog = this.testBuilderFilters.cognitiveLevel === 'All' || q.cognitiveLevel === this.testBuilderFilters.cognitiveLevel;
                return matchesSearch && matchesProgram && matchesCourse && matchesType && matchesLo && matchesCog;
             });
        },
        areAllFilteredSelected() {
             return this.filteredAvailableForTestBuilder.length > 0 && 
                    this.filteredAvailableForTestBuilder.every(q => this.newTestForm.questionIds.includes(q.id));
        }
    },
    methods: {
        ...mapActions(useTestStore, ['addTest']),
        ...mapActions(useUIStore, ['showToast']),
        ...mapActions(useQuestionStore, ['addQuestion']),
        async fetchTestDetailsOptions() {
            try {
                const { data } = await api.get('/course', { params: { per_page: 200 } });
                const list = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.data)
                        ? data.data
                        : Array.isArray(data?.data?.data)
                            ? data.data.data
                            : [];
                const programs = new Map();
                const courseOpts = [];
                const byId = {};
                list.forEach(c => {
                    const id = Number(c.id);
                    const code = c.code || '';
                    const prog = c.program && typeof c.program === 'object' ? c.program : null;
                    const pid = prog ? Number(prog.id) : Number(c.program_id || 0);
                    const pname = prog ? (prog.name || '') : (typeof c.program === 'string' ? c.program : '');
                    if (pid) {
                        if (!programs.has(pid)) programs.set(pid, pname || '');
                    }
                    if (id && code) {
                        courseOpts.push({ value: id, label: code });
                        byId[id] = c;
                    }
                });
                // Restrict to 5 and 6 with labels from database or fallback
                const bsmtLabel = programs.get(5) || 'BSMT';
                const bsmareLabel = programs.get(6) || 'BSMarE';
                this.programOptions = [
                    { value: 5, label: bsmtLabel },
                    { value: 6, label: bsmareLabel }
                ];
                // Deduplicate and sort course codes
                const seen = new Set();
                this.courseOptions = courseOpts.filter(o => {
                    if (seen.has(o.label)) return false;
                    seen.add(o.label);
                    return true;
                }).sort((a, b) => a.label.localeCompare(b.label));
                this.courseById = byId;
            } catch (err) {
                this.showToast('Error', 'Failed to fetch programs/courses for Test Builder.', 'error');
            }
        },
        async fetchApprovedQuestions() {
            try {
                if (Array.isArray(this.questions) && this.questions.length > 0) return;
                const { data } = await api.get('/questions');
                const groups = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
                (groups || []).forEach(group => {
                    const cid = Number(group.course_id);
                    const courseObj = this.courseById[cid] || {};
                    const courseCode = courseObj.code || group.course_name || '';
                    const pidRaw = (courseObj.program && typeof courseObj.program === 'object') ? courseObj.program.id : (courseObj.program_id || null);
                    const pid = pidRaw != null ? Number(pidRaw) : null;
                    const progLabel = pid ? (this.programOptions.find(p => p.value === pid)?.label || '') : '';
                    (group.questions || []).forEach(q => {
                        const s = (q.status || '').toString().toLowerCase();
                        const isApproved = s === 'active' || s === 'approved';
                        if (!isApproved) return;
                        const typeLabel = (() => {
                            const id = q.question_type_id;
                            const str = (q.question_type || '').toLowerCase();
                            if (typeof id === 'number') {
                                if (id === 1) return 'True or False';
                                if (id === 2) return 'Multiple Choice';
                                if (id === 3) return 'Matching Type';
                                if (id === 4) return 'Identification';
                                if (id === 5) return 'Enumeration';
                            }
                            if (str.includes('true')) return 'True or False';
                            if (str.includes('multiple')) return 'Multiple Choice';
                            if (str.includes('matching')) return 'Matching Type';
                            if (str.includes('identification')) return 'Identification';
                            if (str.includes('enumeration')) return 'Enumeration';
                            return 'Multiple Choice';
                        })();
                        const loRaw = q.learning_outcome || '';
                        const loNorm = loRaw ? loRaw.replace(/^(LO)(\d)/i, '$1 $2') : '';
                        // Avoid duplicates
                        if (!this.questions.find(existing => existing.id === q.id)) {
                            this.addQuestion({
                                id: q.id,
                                text: q.text || '',
                                status: 'Approved',
                                program: progLabel,
                                course: courseCode,
                                type: typeLabel,
                                loTags: loNorm ? [loNorm] : [],
                                cognitiveLevel: q.cognitive_level || 'Remembering'
                            });
                        }
                    });
                });
            } catch (err) {
                this.showToast('Error', 'Failed to load approved questions.', 'error');
            }
        },
        
        toggleQuestion(id) {
            const index = this.newTestForm.questionIds.indexOf(id);
            if (index === -1) this.newTestForm.questionIds.push(id);
            else this.newTestForm.questionIds.splice(index, 1);
        },
        toggleSelectAll() {
            if (this.areAllFilteredSelected) {
                const visibleIds = this.filteredAvailableForTestBuilder.map(q => q.id);
                this.newTestForm.questionIds = this.newTestForm.questionIds.filter(id => !visibleIds.includes(id));
            } else {
                const visibleIds = this.filteredAvailableForTestBuilder.map(q => q.id);
                visibleIds.forEach(id => {
                    if (!this.newTestForm.questionIds.includes(id)) {
                        this.newTestForm.questionIds.push(id);
                    }
                });
            }
        },
        resetTestBuilderFilters() {
            this.testBuilderFilters = {
                searchText: '',
                program: 'All',
                course: 'All',
                type: 'All',
                lo: 'All',
                cognitiveLevel: 'All'
            };
        },
        updateAcademicYear(event, type) {
            const value = event.target.value;
            const sanitized = value.replace(/[^0-9]/g, '');
            event.target.value = sanitized;
            
            if (type === 'start') {
                this.newTestForm.academicYearStart = sanitized;
            } else {
                this.newTestForm.academicYearEnd = sanitized;
            }
        },
        async createTest() {
            if (!this.newTestForm.name || !this.newTestForm.programId || !this.newTestForm.courseId) {
                this.showToast('Error', 'Please fill in required fields.', 'error');
                return;
            }
            if (this.newTestForm.questionIds.length === 0) {
                 this.showToast('Error', 'Please select at least one question.', 'error');
                 return;
            }
            const programItem = this.programOptions.find(p => p.value === this.newTestForm.programId);
            const courseItem = this.courseOptions.find(c => c.value === this.newTestForm.courseId);
            const payload = {
                ...this.newTestForm,
                program: programItem ? programItem.label : '',
                course: courseItem ? courseItem.label : '',
                programId: this.newTestForm.programId,
                courseId: this.newTestForm.courseId
            };
            try {
                const year = Number(this.newTestForm.academicYearStart) || new Date().getFullYear();
                const questionIds = Array.isArray(this.newTestForm.questionIds)
                    ? [...new Set(this.newTestForm.questionIds.map(id => Number(id)))]
                    : [];
                const body = {
                    name: this.newTestForm.name,
                    course_id: Number(this.newTestForm.courseId),
                    semester: this.newTestForm.semester,
                    terms: this.newTestForm.term,
                    year: year,
                    description: this.newTestForm.description || payload.name || 'Exam',
                    status: 'Pending Review',
                    created_by: this.currentUser?.id || null,
                    question_id: questionIds
                };
                const resp = await api.post('/exams', body);
                const createdExam = Array.isArray(resp?.data) && resp.data.length > 0
                    ? resp.data[0]
                    : (Array.isArray(resp?.data?.data) && resp.data.data.length > 0
                        ? resp.data.data[0]
                        : (resp?.data?.data || resp?.data || {}));
                const createdId = Number(createdExam?.id);
                const testPayload = {
                    id: createdId || Date.now(),
                    name: this.newTestForm.name || (this.newTestForm.description || 'Exam'),
                    description: this.newTestForm.description || '',
                    term: this.newTestForm.term,
                    timeLimit: Number(this.newTestForm.timeLimit) || 60,
                    questionIds: questionIds,
                    status: 'Pending Review'
                };
                this.addTest(testPayload);
                this.showToast('Success', `Test "${testPayload.name}" created successfully.`, 'success');
            } catch (err) {
                const msg = err?.response?.data?.message || err?.message || 'Failed to create exam.';
                this.showToast('Error', msg, 'error');
                return;
            }
            
            this.newTestForm = {
                name: '',
                description: '',
                programId: null,
                courseId: null,
                term: 'Midterm',
                semester: '1st Semester',
                academicYearStart: '',
                academicYearEnd: '',
                timeLimit: 60,
                questionIds: [],
                studentIds: []
            };
        }
    },
    mounted() {
        this.fetchTestDetailsOptions();
        this.fetchApprovedQuestions();
    }
}
</script>

<style scoped>
.scrollable-y-50 {
    max-height: 50vh;
    overflow-y: auto;
}
</style>
