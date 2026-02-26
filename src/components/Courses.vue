<template>
  <div class="courses-container">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2>Courses</h2>
      <button class="btn btn-primary" @click="openAddModal">
        <i class="fas fa-plus me-2"></i>Add Course Specification
      </button>
    </div>

    <!-- Search and Filter -->
    <div class="card mb-4">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-lg-4">
            <div class="input-group">
              <span class="input-group-text"><i class="fas fa-search"></i></span>
              <input 
                type="text" 
                class="form-control" 
                placeholder="Search courses..."
                v-model="searchQuery"
              >
            </div>
          </div>
          <div class="col-lg-3">
            <select class="form-select" v-model="sortOption">
              <option value="az">A-Z</option>
              <option value="za">Z-A</option>
              <option value="newest">Newest to Oldest</option>
              <option value="oldest">Oldest to Newest</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Program Filter -->
    <div class="card mb-3">
      <div class="card-body">
        <div class="row g-3">
          <div class="col-lg-3">
            <select class="form-select" v-model="programFilter">
              <option value="All">All Programs</option>
              <option value="BSMT">BSMT</option>
              <option value="BSMarE">BSMarE</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Grouped by Program -->
    <div class="card mb-3" v-if="programFilter === 'All' || programFilter === 'BSMT'">
      <div class="card-header fw-bold">BSMT</div>
      <div class="card-body">
        <div class="table-responsive" v-if="bsmtCourses.length > 0">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course</th>
                <th>Description</th>
                <th>LO</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="course in bsmtCourses" :key="course.id">
                <td>{{ course.course_code }}</td>
                <td>{{ course.course_name }}</td>
                <td>{{ truncateDescription(course.course_description) }}</td>
                <td>{{ summarizeLO(course) }}</td>
                <td>
                  <button class="btn btn-sm btn-outline-primary me-2" @click="viewCourse(course)">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-secondary me-2" @click="editCourse(course)">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" @click="deleteCourse(course)">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-muted text-center py-3">No BSMT courses found.</div>
      </div>
    </div>

    <div class="card" v-if="programFilter === 'All' || programFilter === 'BSMarE'">
      <div class="card-header fw-bold">BSMarE</div>
      <div class="card-body">
        <div class="table-responsive" v-if="bsmareCourses.length > 0">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course</th>
                <th>Description</th>
                <th>LO</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="course in bsmareCourses" :key="course.id">
                <td>{{ course.course_code }}</td>
                <td>{{ course.course_name }}</td>
                <td>{{ truncateDescription(course.course_description) }}</td>
                <td>{{ summarizeLO(course) }}</td>
                <td>
                  <button class="btn btn-sm btn-outline-primary me-2" @click="viewCourse(course)">
                    <i class="fas fa-eye"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-secondary me-2" @click="editCourse(course)">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" @click="deleteCourse(course)">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-muted text-center py-3">No BSMarE courses found.</div>
      </div>
    </div>

    <!-- Add/Edit Course Modal -->
    <Teleport to="body">
      <div class="modal fade" id="courseModal" tabindex="-1" ref="courseModal">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ isEditing ? 'Edit' : 'Add' }} Course Specification</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <!-- Basic Info -->
              <div class="row mb-3">
                <div class="col-md-6">
                  <label class="form-label">Program</label>
                  <select class="form-select" v-model="courseForm.program" :disabled="isEditing">
                    <option value="">Select Program</option>
                    <option value="BSMT">BSMT</option>
                    <option value="BSMarE">BSMarE</option>
                  </select>.
                </div>
                <div class="col-md-6">
                  <label class="form-label">Course Code</label>
                  <input type="text" class="form-control" v-model="courseForm.course_code" :disabled="isEditing">
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Course Name</label>
                <input type="text" class="form-control" v-model="courseForm.course_name" :disabled="isEditing">
              </div>
              <div class="mb-3">
                <label class="form-label">Course Description</label>
                <textarea class="form-control" rows="3" v-model="courseForm.course_description" :disabled="isEditing"></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">Conducted Hours</label>
                <input type="text" class="form-control" v-model="courseForm.conducted_hours" placeholder="e.g., 45 hours">
              </div>

              <hr class="my-4">

              <!-- Course Outcomes -->
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h6 class="mb-0">Course Outcomes</h6>
                <button class="btn btn-sm btn-outline-primary" @click="addCourseOutcome">
                  <i class="fas fa-plus me-1"></i>Add Course Outcome
                </button>
              </div>

              <div v-for="(outcome, outcomeIndex) in courseForm.course_outcomes" :key="outcomeIndex" class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                  <span>Course Outcome {{ outcomeIndex + 1 }}</span>
                  <button class="btn btn-sm btn-outline-danger" @click="removeCourseOutcome(outcomeIndex)">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
                <div class="card-body">
                  <div class="mb-3">
                    <label class="form-label">Course Outcome Description</label>
                    <textarea class="form-control" rows="2" v-model="outcome.description"></textarea>
                  </div>
                  
                  <!-- Learning Outcomes -->
                  <div class="ms-4">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <label class="form-label mb-0">Learning Outcomes</label>
                      <button class="btn btn-sm btn-outline-success" @click="addLearningOutcome(outcomeIndex)">
                        <i class="fas fa-plus me-1"></i>Add Learning Outcome
                      </button>
                    </div>
                    <div v-for="(lo, loIndex) in outcome.learning_outcomes" :key="loIndex" class="row g-2 mb-2">
                      <div class="col-md-3">
                        <input type="text" class="form-control" v-model="lo.code" placeholder="Enter LO code (LO 1.1, LO 1.2, etc.) ">
                      </div>
                      <div class="col-md-8">
                        <textarea class="form-control" v-model="lo.description" placeholder="Enter learning outcome description" rows="2"></textarea>
                      </div>
                      <div class="col-md-1">
                        <button class="btn btn-outline-danger w-100" @click="removeLearningOutcome(outcomeIndex, loIndex)">
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                    </div>
                    <div v-if="outcome.learning_outcomes.length === 0" class="text-muted small">
                      No learning outcomes added yet.
                    </div>
                  </div>
                </div>
              </div>

              <div v-if="courseForm.course_outcomes.length === 0" class="text-center text-muted py-3">
                No course outcomes added yet. Click "Add Course Outcome" to begin.
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" @click="saveCourse">{{ isEditing ? 'Edit Course' : 'Save Course' }}</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- View Course Modal -->
    <Teleport to="body">
      <div class="modal fade" id="viewCourseModal" tabindex="-1" ref="viewCourseModal">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Course Details</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" v-if="selectedCourse">
              <div class="mb-3">
                <strong>Program:</strong> {{ selectedCourse.program }}
              </div>
              <div class="mb-3">
                <strong>Course Code:</strong> {{ selectedCourse.course_code }}
              </div>
              <div class="mb-3">
                <strong>Course Name:</strong> {{ selectedCourse.course_name }}
              </div>
              <div class="mb-3">
                <strong>Description:</strong> {{ selectedCourse.course_description }}
              </div>
              
              <hr>
              
              <h6>Course Outcomes</h6>
              <div v-for="(outcome, index) in selectedCourse.course_outcomes" :key="index" class="mb-3">
                <div class="card">
                  <div class="card-body">
                    <strong>CO {{ index + 1 }}:</strong> {{ outcome.description }}
                    <div v-if="outcome.learning_outcomes.length > 0" class="mt-2 ms-3">
                      <strong>Learning Outcomes:</strong>
                      <ul class="mb-0">
                        <li v-for="(lo, loIndex) in outcome.learning_outcomes" :key="loIndex">
                          <strong>{{ lo.code }}:</strong> {{ lo.description }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div class="modal fade" id="courseNotificationModal" tabindex="-1" ref="courseNotificationModal">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header" :class="notificationType === 'success' ? 'bg-success text-white' : 'bg-danger text-white'">
              <h5 class="modal-title">{{ notificationTitle }}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="mb-0">{{ notificationMessage }}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import * as bootstrap from 'bootstrap';
import api from '../services/api';

export default {
  name: 'Courses',
  setup() {
    // Data
    const courses = ref([]);
    const searchQuery = ref('');
    const sortOption = ref('az');
    const programFilter = ref('All');
    const isEditing = ref(false);
    const selectedCourse = ref(null);
    const courseModal = ref(null);
    const viewCourseModal = ref(null);
    const courseNotificationModal = ref(null);
    let courseBsModal = null;
    let viewBsModal = null;
    let notificationBsModal = null;
    const notificationTitle = ref('');
    const notificationMessage = ref('');
    const notificationType = ref('success');

    // Form
    const courseForm = ref({
      id: null,
      program: '',
      course_code: '',
      course_name: '',
      course_description: '',
      conducted_hours: '',
      course_outcomes: []
    });

    // Computed
    const filteredAndSortedCourses = computed(() => {
      let result = [...courses.value];

      // Search filter
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(course => 
          course.program.toLowerCase().includes(query) ||
          course.course_code.toLowerCase().includes(query) ||
          course.course_name.toLowerCase().includes(query) ||
          course.course_description.toLowerCase().includes(query)
        );
      }

      // Program filter
      if (programFilter.value !== 'All') {
        result = result.filter(course => (course.program || '').toLowerCase() === programFilter.value.toLowerCase());
      }

      // Sort
      switch (sortOption.value) {
        case 'az':
          result.sort((a, b) => a.course_name.localeCompare(b.course_name));
          break;
        case 'za':
          result.sort((a, b) => b.course_name.localeCompare(a.course_name));
          break;
        case 'newest':
          result.sort((a, b) => b.id - a.id);
          break;
        case 'oldest':
          result.sort((a, b) => a.id - b.id);
          break;
      }

      return result;
    });

    const bsmtCourses = computed(() => filteredAndSortedCourses.value.filter(c => (c.program || '').toLowerCase() === 'bsmt'));
    const bsmareCourses = computed(() => filteredAndSortedCourses.value.filter(c => (c.program || '').toLowerCase() === 'bsmare'));

    // Methods
    const openAddModal = () => {
      isEditing.value = false;
      resetForm();
      if (courseBsModal) courseBsModal.show();
    };

    const editCourse = (course) => {
      isEditing.value = true;
      courseForm.value = JSON.parse(JSON.stringify(course));
      if (courseBsModal) courseBsModal.show();
    };

    const viewCourse = (course) => {
      selectedCourse.value = course;
      if (viewBsModal) viewBsModal.show();
    };

    const deleteCourse = (course) => {
      if (confirm(`Are you sure you want to delete ${course.course_name}?`)) {
        courses.value = courses.value.filter(c => c.id !== course.id);
      }
    };

    const saveCourse = async () => {
  if (!courseForm.value.course_name || !courseForm.value.course_code) {
    notificationTitle.value = 'Missing Fields';
    notificationMessage.value = 'Course name and code are required';
    notificationType.value = 'error';
    if (notificationBsModal) notificationBsModal.show();
    return;
  }

  const totalHours = parseInt(courseForm.value.conducted_hours);
  const normalizedTotalHours = Number.isNaN(totalHours) ? 0 : totalHours;
  const payload = {
    name: courseForm.value.course_name,
    program_id: getProgramId(courseForm.value.program),

    // IMPORTANT: use backend column names
    course_code: courseForm.value.course_code,
    code: courseForm.value.course_code,
    course_description: courseForm.value.course_description,
    description: courseForm.value.course_description,
    conducted_hours: normalizedTotalHours,

    // nested payload stays the same
    courseOutcomes: (courseForm.value.course_outcomes || []).map((co, idx) => {
      return {
        code: co.code || `CO-${idx + 1}`,
        description: co.description || '',
        learningOutcomes: (co.learning_outcomes || []).map((lo, loIdx) => ({
          code: lo.code || '',
          description: lo.description || '',
          conducted_hours: idx === 0 && loIdx === 0 ? normalizedTotalHours : 0
        }))
      };
    })
  };

  try {
    let response;

    if (isEditing.value && courseForm.value.id) {
      response = await api.patch(
        `/course/${courseForm.value.id}`,
        payload
      );
    } else {
      response = await api.post('/course', payload);
    }

    await fetchCourses();

    if (courseBsModal) courseBsModal.hide();

    notificationTitle.value = 'Course Saved';
    notificationMessage.value = 'Course specification has been saved successfully.';
    notificationType.value = 'success';
    if (notificationBsModal) notificationBsModal.show();

    resetForm();

  } catch (err) {
    console.error('Failed to save course', err);

    notificationTitle.value = 'Save Failed';
    notificationMessage.value = 'Failed to save course. Please try again.';
    notificationType.value = 'error';
    if (notificationBsModal) notificationBsModal.show();
  }
};

    const resetForm = () => {
      courseForm.value = {
        id: null,
        program: '',
        course_code: '',
        course_name: '',
        course_description: '',
        conducted_hours: '',
        course_outcomes: []
      };
    };

    const addCourseOutcome = () => {
      const nextIndex = courseForm.value.course_outcomes.length + 1;
      courseForm.value.course_outcomes.push({
        code: `CO-${nextIndex}`,
        description: '',
        learning_outcomes: []
      });
    };

    const removeCourseOutcome = (index) => {
      courseForm.value.course_outcomes.splice(index, 1);
    };

    const addLearningOutcome = (outcomeIndex) => {
      courseForm.value.course_outcomes[outcomeIndex].learning_outcomes.push({
        code: '',
        description: '',
        conducted_hours: ''
      });
    };

    const removeLearningOutcome = (outcomeIndex, loIndex) => {
      courseForm.value.course_outcomes[outcomeIndex].learning_outcomes.splice(loIndex, 1);
    };

    const truncateDescription = (desc) => {
      if (!desc) return '';
      return desc.length > 50 ? desc.substring(0, 50) + '...' : desc;
    };
    const summarizeLO = (course) => {
      const outcomes = course?.course_outcomes || [];
      const codes = [];
      outcomes.forEach(co => {
        (co.learning_outcomes || []).forEach(lo => {
          const code = (lo.code || '').trim();
          if (code && !codes.includes(code)) codes.push(code);
        });
      });
      return codes.length ? codes.join(', ') : '-';
    };

    const getProgramId = (program) => {
      if (!program) return null;
      const map = { 'BSMarE': 5, 'BSMT': 6 };
      return map[program] ?? null;
    };
    const getProgramName = (program_id) => {
      const map = { 5: 'BSMarE', 6: 'BSMT', '5': 'BSMarE', '6': 'BSMT' };
      return map[program_id] ?? '';
    };
    const sumLoHours = (c) => {
      const outcomes = c.course_outcomes ?? c.courseOutcomes ?? [];
      let sum = 0;
      outcomes.forEach(co => {
        (co.learning_outcomes ?? co.learningOutcomes ?? []).forEach(lo => {
          const h = parseInt(lo.conducted_hours ?? lo.conductedHours ?? 0);
          if (!Number.isNaN(h)) sum += h;
        });
      });
      return sum;
    };
    const normalizeCourseFromDb = (c) => {
  const programName = typeof c.program === 'string'
    ? c.program
    : (c.program?.name ?? getProgramName(c.program_id));

  return {
    id: c.id,
    program: programName ?? getProgramName(c.program_id),

    // ✅ accept both old and new backend formats
    course_code: c.course_code ?? c.code ?? c.courseCode ?? '',
    course_name: c.name ?? c.course_name ?? c.courseName ?? '',
    course_description: c.course_description ?? c.description ?? c.courseDescription ?? '',
    conducted_hours: (c.conducted_hours ?? c.conductedHours ?? undefined) ?? sumLoHours(c),

    course_outcomes: (c.course_outcomes ?? c.courseOutcomes ?? []).map(co => ({
      code: co.code ?? '',
      description: co.description ?? '',
      learning_outcomes: (co.learning_outcomes ?? co.learningOutcomes ?? []).map(lo => ({
        code: lo.code ?? lo.loCode ?? '',
        description: lo.description ?? lo.loDescription ?? '',
        conducted_hours: lo.conducted_hours ?? lo.conductedHours ?? 0
      }))
    }))
  };
};

    const fetchCourses = async () => {
      try {
        const { data } = await api.get('/course', { params: { per_page: 50 } });
        const paginated = data?.data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(paginated)
            ? paginated
            : Array.isArray(paginated?.data)
              ? paginated.data
              : (data?.courses ?? []);
        const prevCourses = [...courses.value];
        const normalized = list.map(normalizeCourseFromDb);
        courses.value = normalized.map(n => {
          const prev = prevCourses.find(c => c.id === n.id);
          return {
            ...n,
            course_code: n.course_code || (prev ? prev.course_code : ''),
            course_description: n.course_description || (prev ? prev.course_description : ''),
            conducted_hours: n.conducted_hours ?? (prev ? prev.conducted_hours : sumLoHours(n))
          };
        });
      } catch (err) {
        console.error('Failed to fetch courses', err);
        notificationTitle.value = 'Fetch Failed';
        notificationMessage.value = 'Unable to load courses from the database.';
        notificationType.value = 'error';
        if (notificationBsModal) notificationBsModal.show();
      }
    };

    // Lifecycle
    onMounted(() => {
      if (courseModal.value) {
        courseBsModal = new bootstrap.Modal(courseModal.value);
      }
      if (viewCourseModal.value) {
        viewBsModal = new bootstrap.Modal(viewCourseModal.value);
      }
      if (courseNotificationModal.value) {
        notificationBsModal = new bootstrap.Modal(courseNotificationModal.value);
      }
      fetchCourses();
    });

    return {
      courses,
      searchQuery,
      sortOption,
      programFilter,
      isEditing,
      selectedCourse,
      courseForm,
      courseModal,
      viewCourseModal,
      courseNotificationModal,
      filteredAndSortedCourses,
      bsmtCourses,
      bsmareCourses,
      openAddModal,
      editCourse,
      viewCourse,
      deleteCourse,
      saveCourse,
      addCourseOutcome,
      removeCourseOutcome,
      addLearningOutcome,
      removeLearningOutcome,
      truncateDescription,
      summarizeLO,
      notificationTitle,
      notificationMessage,
      notificationType,
      fetchCourses
    };
  }
};
</script>

<style scoped>
.courses-container {
  padding: 1rem;
}
</style>
