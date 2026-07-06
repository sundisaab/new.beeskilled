// ==================================================
// CONFIG
// ==================================================

const QUESTIONS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwNNRTAbUBz0V7s7rTspawDZY8qJQpJsieTKOFti3hy866Nnm2W7mXT_nWStDtYKeWi/exec";

const RESULTS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxb75CRREkwndXJQumQNdTfLcqDHqfJbxm93Uzb0nq_2F9yeC2NaxToHOfe-iJM9r29sA/exec";

const MAX_ATTEMPTS = 3;
const PASS_MARKS = 15;
const QUIZ_TIME = 1800;

// ==================================================
// COURSES
// ==================================================

const courses = [
  { id: "aws", title: "Cloud Computing with AWS", sheet: "aws", image: "assets/courses/aws.png" },
  { id: "C_programming", title: "C Programming", sheet: "C_programming", image: "assets/courses/c.png" },
  { id: "cpp", title: "C++", sheet: "cpp", image: "assets/courses/cpp.png" },
  { id: "python", title: "Python", sheet: "python", image: "assets/courses/python.png" },
  { id: "webdev", title: "Web Development (HTML/CSS/JS)", sheet: "webdev", image: "assets/courses/web.png" },
  { id: "datascience", title: "Data Science", sheet: "datascience", image: "assets/courses/data science.png" },
  { id: "mlai", title: "Machine Learning & AI", sheet: "mlai", image: "assets/courses/ml.png" },
  { id: "mern", title: "MERN Stack", sheet: "mern", image: "assets/courses/mern.png" },
  { id: "java", title: "Java", sheet: "java", image: "assets/courses/java.png" },
  { id: "DSA", title: "DSA", sheet: "DSA", image: "assets/courses/dsa.png" },
  { id: "Flutter", title: "Flutter", sheet: "Flutter", image: "assets/courses/flutter.png" },
  { id: "data analyst", title: "Data Analyst", sheet: "data analyst", image: "assets/courses/data analyst.png" },
  { id: "powerbi", title: "Power BI", sheet: "powerbi", image: "assets/courses/BI.png" }
];

// ==================================================
// STATE
// ==================================================

let student = { name: "", email: "" };
let selectedCourse = null;
let questions = [];
let timer = null;
let timeLeft = QUIZ_TIME;

const questionCache = {};
let activeFetchId = 0;

// ==================================================
// INIT
// ==================================================

document.addEventListener("DOMContentLoaded", () => {
  renderCourseGrid();
  document.getElementById("year").innerText = new Date().getFullYear();

  document.getElementById("entry-form").addEventListener("submit", handleEntrySubmit);
  document.getElementById("quiz-form").addEventListener("submit", submitQuiz);
  document.getElementById("cancel-quiz-btn").addEventListener("click", cancelQuiz);
  document.getElementById("back-to-dashboard-btn").addEventListener("click", () => {
    showView("dashboard-section");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.getElementById("change-student-btn").addEventListener("click", resetStudent);
});

// ==================================================
// ENTRY + PRELOAD
// ==================================================

function handleEntrySubmit(e) {
  e.preventDefault();

  student.name = document.getElementById("student-name").value.trim();
  student.email = document.getElementById("student-email").value.trim();

  if (!student.name || !student.email) {
    alert("Please enter name and email");
    return;
  }

  document.getElementById("user-name-label").innerText = student.name;
  renderCourseGrid();
  showView("dashboard-section");

  preloadAllCourses();
}

// ==================================================
// PRELOAD ALL QUESTIONS (BACKGROUND)
// ==================================================

function preloadAllCourses() {
  courses.forEach(course => {
    if (questionCache[course.sheet]) return;

    fetch(`${QUESTIONS_SCRIPT_URL}?action=getQuestions&sheet=${course.sheet}`)
      .then(r => r.json())
      .then(data => {
        questionCache[course.sheet] = data || [];
      })
      .catch(() => {});
  });
}

// ==================================================
// ATTEMPTS
// ==================================================

function attemptKey(courseId) {
  return `attempt_${student.email}_${courseId}`;
}

function getAttempts(courseId) {
  return parseInt(localStorage.getItem(attemptKey(courseId)) || "0", 10);
}

function increaseAttempt(courseId) {
  const n = getAttempts(courseId) + 1;
  localStorage.setItem(attemptKey(courseId), n);
  return n;
}

// ==================================================
// COURSE GRID
// ==================================================

function renderCourseGrid() {
  const grid = document.getElementById("course-grid");
  grid.innerHTML = "";

  courses.forEach(course => {
    const used = student.email ? getAttempts(course.id) : 0;
    const disabled = used >= MAX_ATTEMPTS;

    const card = document.createElement("article");
    card.className = "course-card" + (disabled ? " disabled" : "");

    card.innerHTML = `
      <div class="course-card-inner">
        <div class="course-image-wrapper">
          <img class="course-image" src="${course.image}">
        </div>
        <div class="course-content">
          <h3 class="course-title">${course.title}</h3>
          <p class="course-meta">30 MCQ • 30 Marks • 30 Min</p>
          <p class="attempt-info">Attempts: ${used}/${MAX_ATTEMPTS}</p>
        </div>
        <div class="course-footer">
          <span class="badge">Auto-graded</span>
          <button class="btn primary-btn start-btn" ${disabled ? "disabled" : ""}>
            ${disabled ? "Max Attempts Used" : "Start Test"}
          </button>
        </div>
      </div>
    `;

    if (!disabled) {
      card.querySelector(".start-btn").addEventListener("click", () => startTest(course));
    }

    grid.appendChild(card);
  });
}

// ==================================================
// START QUIZ
// ==================================================

function startTest(course) {
  selectedCourse = course;
  questions = [];
  document.getElementById("questions-container").innerHTML = spinnerHTML();
  document.getElementById("quiz-course-title").innerText = course.title;
  document.getElementById("quiz-student-label").innerText =
    `${student.name} • ${student.email}`;

  showView("quiz-section");
  window.scrollTo({ top: 0, behavior: "smooth" });

  loadQuestions(course.sheet);
}

// ==================================================
// LOAD QUESTIONS (CACHE + RACE SAFE)
// ==================================================

function loadQuestions(sheet) {
  const fetchId = ++activeFetchId;

  if (questionCache[sheet]) {
    questions = questionCache[sheet];
    renderQuestions();
    startTimer();
    return;
  }

  document.getElementById("questions-container").innerHTML = spinnerHTML();

  fetch(`${QUESTIONS_SCRIPT_URL}?action=getQuestions&sheet=${sheet}`)
    .then(r => r.json())
    .then(data => {
      if (fetchId !== activeFetchId) return;
      questions = data || [];
      questionCache[sheet] = questions;
      renderQuestions();
      startTimer();
    })
    .catch(() => {
      if (fetchId !== activeFetchId) return;
      alert("Failed to load questions");
      showView("dashboard-section");
    });
}

// ==================================================
// RENDER QUESTIONS
// ==================================================

function renderQuestions() {
  const box = document.getElementById("questions-container");
  box.innerHTML = "";

  questions.forEach((q, i) => {
    const div = document.createElement("div");
    div.className = "question-block";

    div.innerHTML = `
      <p class="question-text">${i + 1}. ${q.question}</p>
      ${q.options.map((opt, idx) => `
        <label class="option-label">
          <input type="radio" name="q${i}" value="${idx}">
          <span>${opt}</span>
        </label>
      `).join("")}
    `;

    box.appendChild(div);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==================================================
// TIMER
// ==================================================

function startTimer() {
  clearInterval(timer);
  timeLeft = QUIZ_TIME;

  timer = setInterval(() => {
    timeLeft--;
    const m = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const s = String(timeLeft % 60).padStart(2, "0");
    document.getElementById("timer-display").innerText = `${m}:${s}`;

    if (timeLeft <= 0) {
      clearInterval(timer);
      submitQuiz(new Event("submit"));
    }
  }, 1000);
}

// ==================================================
// CANCEL QUIZ
// ==================================================

function cancelQuiz() {
  clearInterval(timer);
  showView("dashboard-section");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==================================================
// SUBMIT QUIZ
// ==================================================

function submitQuiz(e) {
  e.preventDefault();
  clearInterval(timer);

  let score = 0;
  questions.forEach((q, i) => {
    const sel = document.querySelector(`input[name="q${i}"]:checked`);
    if (sel && Number(sel.value) === Number(q.correct)) score++;
  });

  increaseAttempt(selectedCourse.id);

  document.getElementById("result-name").innerText = `Student: ${student.name}`;
  document.getElementById("result-course").innerText = `Course: ${selectedCourse.title}`;
  document.getElementById("result-score").innerText = `Score: ${score} / ${questions.length}`;
  document.getElementById("result-message").innerText =
    score >= PASS_MARKS ? "Status: PASS" : "Status: FAIL";

  sendResult(score);
  renderCourseGrid();
  showView("result-section");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==================================================
// SEND RESULT
// ==================================================

function sendResult(score) {
  fetch(RESULTS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: student.name,
      email: student.email,
      course: selectedCourse.title,
      score,
      total: questions.length,
      timestamp: new Date().toISOString()
    })
  });
}

// ==================================================
// UI HELPERS
// ==================================================

function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function resetStudent() {
  student = { name: "", email: "" };
  document.getElementById("entry-form").reset();
  document.getElementById("user-name-label").innerText = "Guest";
  renderCourseGrid();
  showView("entry-section");
}

// ==================================================
// SPINNER
// ==================================================

function spinnerHTML() {
  return `
    <div class="loading-wrapper">
      <div class="spinner"></div>
      <div class="loading-text">Loading questions...</div>
    </div>
  `;
}
