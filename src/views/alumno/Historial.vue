<template>
    <div class="historial-view">
        <header class="student-card">
            <div>
                <h2>{{ student.name }}</h2>
                <p><strong>ID:</strong> {{ student.id }} · <strong>Program:</strong> {{ student.program }}</p>
            </div>
            <div class="summary">
                <p><strong>Semesters:</strong> {{ semesters.length }}</p>
                <p><strong>Cumulative GPA:</strong> {{ cumulativeGPA }}</p>
                <p><strong>Total Credits:</strong> {{ totalCredits }}</p>
            </div>
        </header>

        <section class="semesters">
            <article v-for="(sem, idx) in semesters" :key="sem.term" class="semester-card">
                <div class="semester-header">
                    <h3>{{ sem.term }} <small>({{ sem.yearLabel }})</small></h3>
                    <div class="semester-meta">
                        <span>Credits: {{ semesterCredits(sem) }}</span>
                        <span>GPA: {{ semesterGPA(sem) }}</span>
                        <button @click="sem.show = !sem.show">{{ sem.show ? 'Hide' : 'Show' }}</button>
                    </div>
                </div>

                <table v-if="sem.show" class="subjects-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Subject</th>
                            <th>Credits</th>
                            <th>Grade</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="sub in sem.courses" :key="sub.code">
                            <td>{{ sub.code }}</td>
                            <td>{{ sub.name }}</td>
                            <td>{{ sub.credits }}</td>
                            <td>{{ sub.grade }}</td>
                            <td :class="statusClass(sub)">{{ sub.status }}</td>
                        </tr>
                    </tbody>
                </table>
            </article>
        </section>
    </div>
</template>

<script setup>
import { reactive, computed } from 'vue'

const student = reactive({
    name: 'Juan Pérez',
    id: '2021001',
    program: 'Ingeniería de Sistemas'
})

// Simulated semesters and courses (temporary data)
const semesters = reactive([
    {
        term: '2021-I',
        yearLabel: 'First Year - I',
        show: true,
        courses: [
            { code: 'MAT101', name: 'Matemáticas I', credits: 4, grade: 16.5, status: 'Aprobado' },
            { code: 'PROG101', name: 'Programación I', credits: 4, grade: 17.0, status: 'Aprobado' },
            { code: 'ALG101', name: 'Álgebra', credits: 3, grade: 14.0, status: 'Aprobado' },
            { code: 'ING101', name: 'Inglés I', credits: 2, grade: 12.5, status: 'Aprobado' }
        ]
    },
    {
        term: '2021-II',
        yearLabel: 'First Year - II',
        show: false,
        courses: [
            { code: 'MAT102', name: 'Matemáticas II', credits: 4, grade: 15.0, status: 'Aprobado' },
            { code: 'PROG102', name: 'Programación II', credits: 4, grade: 13.5, status: 'Aprobado' },
            { code: 'FIS101', name: 'Física I', credits: 3, grade: 11.0, status: 'Reprobado' },
            { code: 'COM101', name: 'Comunicación', credits: 2, grade: 14.0, status: 'Aprobado' }
        ]
    },
    {
        term: '2022-I',
        yearLabel: 'Second Year - I',
        show: false,
        courses: [
            { code: 'EST101', name: 'Estadística', credits: 3, grade: 18.0, status: 'Aprobado' },
            { code: 'BD101', name: 'Bases de Datos', credits: 4, grade: 16.0, status: 'Aprobado' },
            { code: 'RED101', name: 'Redes I', credits: 3, grade: 15.5, status: 'Aprobado' },
            { code: 'ETI101', name: 'Ética Profesional', credits: 2, grade: 17.0, status: 'Aprobado' }
        ]
    }
])

function semesterCredits(sem) {
    return sem.courses.reduce((s, c) => s + c.credits, 0)
}

function semesterGPA(sem) {
    const totCred = semesterCredits(sem)
    if (!totCred) return '0.00'
    const weighted = sem.courses.reduce((s, c) => s + c.grade * c.credits, 0)
    return (weighted / totCred).toFixed(2)
}

const totalCredits = computed(() =>
    semesters.reduce((s, sem) => s + semesterCredits(sem), 0)
)

const cumulativeGPA = computed(() => {
    const totalWeighted = semesters.reduce(
        (s, sem) => s + sem.courses.reduce((ss, c) => ss + c.grade * c.credits, 0),
        0
    )
    const totCred = totalCredits.value
    return totCred ? (totalWeighted / totCred).toFixed(2) : '0.00'
})

function statusClass(course) {
    return {
        aprobado: course.status.toLowerCase().includes('aprob'),
        reprobado: course.status.toLowerCase().includes('reprob')
    }
}
</script>

<style scoped>
.historial-view {
    font-family: Arial, sans-serif;
    padding: 16px;
    max-width: 900px;
    margin: 0 auto;
}
.student-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f6f8fa;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 16px;
}
.semester-card {
    border: 1px solid #e1e4e8;
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 12px;
    background: #fff;
}
.semester-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.semester-meta {
    display: flex;
    gap: 12px;
    align-items: center;
}
.subjects-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
}
.subjects-table th,
.subjects-table td {
    border: 1px solid #e1e4e8;
    padding: 8px;
    text-align: left;
}
.aprobado {
    color: #0366d6;
    font-weight: 600;
}
.reprobado {
    color: #d73a49;
    font-weight: 600;
}
button {
    background: #0366d6;
    color: white;
    border: none;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
}
button:hover { opacity: 0.9; }
</style>