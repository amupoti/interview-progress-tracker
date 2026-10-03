/* ── State ── */
let practiceData = null;
let practiceLoaded = false;

let sdExercises = [];
let sdEditingId = null;
let sdLoaded = false;

let challengesData = [];
let challengesLoaded = false;

let rqPracticeData = null;
let rqLoaded = false;

let companies = [];
let coEditingId = null;
let coLoaded = false;
let coSortCol = null;
let coSortDir = 'asc';
let glassdoorCache = {};
let gdLoaded = false;

let jobs = [];
let jobsEditingId = null;
let jobsContactCount = 0;
let jobsLoaded = false;
let jobsSortCol = null;
let jobsSortDir = 'asc';
let searchConfig = null;

const JOB_STATUS_BADGE = {
  'Pending': 'badge-pending',
  'Interested': 'badge-interested',
  'Applied': 'badge-applied',
  'Interviewing': 'badge-interviewing',
  'Offer': 'badge-offer',
  'Rejected': 'badge-rejected',
  'Discarded': 'badge-discarded',
  'Closed': 'badge-closed',
};

const WORK_MODE_BADGE = {
  'Remote': 'badge-remote',
  'Hybrid': 'badge-hybrid',
  'Onsite': 'badge-onsite',
};

const JOB_LEVEL_BADGE = {
  'Senior': 'badge-senior',
  'Staff': 'badge-staff',
};

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  jobsLoaded = true;
  jobsFetchJobs();
  // Level options come from the search config, so apply URL filters once they exist.
  loadSearchConfig().finally(jobsApplyUrlFilters);

  document.getElementById('pipeline-include-untouched').addEventListener('change', pipelineRender);
  window.addEventListener('resize', () => {
    if (!document.getElementById('tab-pipeline').classList.contains('hidden')) pipelineRender();
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Recruiter reset
  document.getElementById('btn-rq-reset').addEventListener('click', rqReset);

  // System design
  document.getElementById('btn-add-sd').addEventListener('click', sdOpenAdd);
  document.getElementById('sd-btn-cancel').addEventListener('click', sdCloseModal);
  document.getElementById('sd-modal-close').addEventListener('click', sdCloseModal);
  document.getElementById('sd-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) sdCloseModal();
  });
  document.getElementById('sd-form').addEventListener('submit', sdHandleSubmit);

  // Companies of interest
  document.getElementById('btn-add-co').addEventListener('click', coOpenAdd);
  document.getElementById('co-btn-cancel').addEventListener('click', coCloseModal);
  document.getElementById('co-modal-close').addEventListener('click', coCloseModal);
  document.getElementById('co-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) coCloseModal();
  });
  document.getElementById('co-form').addEventListener('submit', coHandleSubmit);
  document.getElementById('co-search').addEventListener('input', coRender);
  document.querySelectorAll('#co-table th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (coSortCol === col) {
        coSortDir = coSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        coSortCol = col;
        coSortDir = 'desc';
      }
      coRender();
    });
  });

  // Jobs
  document.getElementById('btn-add-job').addEventListener('click', jobsOpenAdd);
  document.getElementById('jobs-btn-cancel').addEventListener('click', jobsCloseModal);
  document.getElementById('jobs-modal-close').addEventListener('click', jobsCloseModal);
  document.getElementById('jobs-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) jobsCloseModal();
  });
  document.getElementById('jobs-form').addEventListener('submit', jobsHandleSubmit);
  document.getElementById('jobs-btn-add-contact').addEventListener('click', () => jobsAddContactRow());
  document.getElementById('jobs-search').addEventListener('input', jobsRender);
  document.getElementById('jobs-work-mode-filter').addEventListener('change', jobsFilterChanged);
  document.getElementById('jobs-level-filter').addEventListener('change', jobsFilterChanged);
  document.getElementById('jobs-status-filter').addEventListener('change', jobsFilterChanged);
  document.querySelectorAll('#jobs-table th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (jobsSortCol === col) {
        jobsSortDir = jobsSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        jobsSortCol = col;
        jobsSortDir = 'asc';
      }
      jobsRender();
    });
  });
});

/* ── Helpers ── */
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function stars(level) {
  if (!level) return '—';
  const n = Math.min(5, Math.max(1, Number(level)));
  return `<span class="stars">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
}

function toNum(val) {
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function clearInvalid() {
  for (const el of document.querySelectorAll('.invalid')) el.classList.remove('invalid');
}

/* ────────────────────────────────────────────
   TAB SWITCHING
──────────────────────────────────────────── */
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  ['practice', 'recruiter', 'challenges', 'system-design', 'companies', 'jobs', 'pipeline', 'progress'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('hidden', tabName !== t);
  });

  if (tabName === 'practice' && !practiceLoaded) {
    practiceLoaded = true;
    loadPracticeToday();
  }
  if (tabName === 'recruiter' && !rqLoaded) {
    rqLoaded = true;
    loadRQToday();
  }
  if (tabName === 'challenges' && !challengesLoaded) {
    challengesLoaded = true;
    chLoad();
  }
  if (tabName === 'system-design' && !sdLoaded) {
    sdLoaded = true;
    sdFetchExercises();
  }
  if (tabName === 'companies') {
    if (!coLoaded) {
      coLoaded = true;
      coFetchCompanies();
    } else if (!gdLoaded) {
      fetchGlassdoorCache().then(coRender);
    }
  }
  if (tabName === 'jobs' && !jobsLoaded) {
    jobsLoaded = true;
    jobsFetchJobs();
  }
  if (tabName === 'progress') {
    loadProgress();
  }
  if (tabName === 'pipeline') {
    pipelineLoad();
  }
}

/* ────────────────────────────────────────────
   PRACTICE – TODAY
──────────────────────────────────────────── */
async function loadPracticeToday() {
  const res = await fetch('/api/practice/today');
  practiceData = await res.json();
  setStreak(practiceData.streak);
  renderQuestions();
}

function setStreak(n) {
  document.getElementById('streak-count').textContent = n;
}

function renderQuestions() {
  const { questions, completed } = practiceData;
  const container = document.getElementById('questions-container');
  const allDone = questions.length > 0 && questions.every(q => completed.includes(q.id));

  container.innerHTML = `
    <div class="questions-list">
      ${questions.map((q, i) => questionCardHTML(q, i, completed)).join('')}
    </div>
    ${
      allDone
        ? `
      <div class="all-done-msg">
        <span class="all-done-emoji">🎉</span>
        <h3>All done for today!</h3>
        <p>Great work. Come back tomorrow for 3 new questions and keep the streak going.</p>
      </div>`
        : ''
    }
  `;
}

function questionCardHTML(q, idx, completed) {
  const isDone = completed.includes(q.id);
  return `
    <div class="q-card ${isDone ? 'q-card-done' : ''}" id="qcard-${q.id}">
      <div class="q-card-header">
        <span class="q-num">Question ${idx + 1} of 3</span>
        ${isDone ? '<span class="q-badge-done">✓ Done</span>' : ''}
      </div>
      <p class="q-text">${esc(q.question)}</p>
      <div class="q-actions">
        <button class="btn btn-secondary" id="qreveal-btn-${q.id}" onclick="toggleReveal(${q.id})">
          💡 Reveal tips &amp; example
        </button>
        ${!isDone ? `<button class="btn btn-primary" onclick="markDone(${q.id})">✓ Mark as done</button>` : ''}
      </div>
      <div class="q-reveal hidden" id="qreveal-${q.id}">
        <div class="q-tips">
          <h4>💡 Tips</h4>
          <ul>${q.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>
        <div class="q-example">
          <h4>📝 Example Answer</h4>
          <p>${esc(q.example_answer)}</p>
        </div>
      </div>
    </div>
  `;
}

function toggleReveal(id) {
  const reveal = document.getElementById(`qreveal-${id}`);
  const btn = document.getElementById(`qreveal-btn-${id}`);
  const nowHidden = reveal.classList.toggle('hidden');
  btn.textContent = nowHidden ? '💡 Reveal tips & example' : '🙈 Hide tips & example';
}

async function markDone(questionId) {
  const res = await fetch('/api/practice/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId }),
  });
  const data = await res.json();
  practiceData.completed.push(questionId);
  setStreak(data.streak);
  renderQuestions();
}

/* ────────────────────────────────────────────
   PROGRESS TAB
──────────────────────────────────────────── */
async function loadProgress() {
  const res = await fetch('/api/progress');
  const data = await res.json();
  document.getElementById('prog-streak').textContent = data.streak;
  document.getElementById('prog-total-q').textContent = data.total_questions;
  document.getElementById('prog-total-sd').textContent = data.total_sd;
  document.getElementById('prog-sd-week').textContent = data.sd_this_week;
  document.getElementById('prog-challenges').textContent = `${data.challenges_done}/${data.challenges_total}`;
  document.getElementById('prog-rq-streak').textContent = data.rq_streak;
  document.getElementById('prog-total-rq').textContent = data.total_rq;
  renderCombinedCalendar(data.calendar);
}

/* ────────────────────────────────────────────
   SYSTEM DESIGN
──────────────────────────────────────────── */
async function sdFetchExercises() {
  const res = await fetch('/api/system-design');
  sdExercises = await res.json();
  sdRender();
}

function sdRender() {
  const tbody = document.getElementById('sd-tbody');
  const sorted = [...sdExercises].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  document.getElementById('sd-stat-total').textContent = sdExercises.length;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekCount = sdExercises.filter(e => e.date && new Date(e.date) >= weekAgo).length;
  document.getElementById('sd-stat-week').textContent = weekCount;

  if (sorted.length === 0) {
    tbody.innerHTML = `<tr id="sd-empty-row"><td colspan="6" class="empty-msg">No exercises yet. Click "+ Log Exercise" to record your first session.</td></tr>`;
    return;
  }

  const DIFF_BADGE = { Easy: 'badge-offer', Medium: 'badge-technical', Hard: 'badge-rejected' };

  tbody.innerHTML = sorted
    .map(
      e => `
    <tr>
      <td>
        <strong>${esc(e.problem)}</strong>
        ${e.url ? `<br/><a href="${esc(e.url)}" target="_blank" style="font-size:12px;color:#4f46e5;">↗ open</a>` : ''}
      </td>
      <td>${formatDate(e.date)}</td>
      <td>${e.difficulty ? `<span class="badge ${DIFF_BADGE[e.difficulty] || ''}">${esc(e.difficulty)}</span>` : '—'}</td>
      <td>${stars(e.score)}</td>
      <td style="max-width:260px;white-space:pre-wrap;">${esc(e.notes || '—')}</td>
      <td>
        <div class="actions">
          <button class="btn-icon" title="Edit" onclick="sdOpenEdit('${e.id}')">✏️</button>
          <button class="btn-icon danger" title="Delete" onclick="sdConfirmDelete('${e.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join('');
}

function sdOpenAdd() {
  sdEditingId = null;
  document.getElementById('sd-modal-title').textContent = 'Log Exercise';
  document.getElementById('sd-form').reset();
  document.getElementById('sd-f-id').value = '';
  document.getElementById('sd-f-date').value = todayISO();
  document.getElementById('sd-modal-overlay').classList.remove('hidden');
}

function sdOpenEdit(id) {
  const e = sdExercises.find(x => x.id === id);
  if (!e) return;
  sdEditingId = id;
  document.getElementById('sd-modal-title').textContent = 'Edit Exercise';
  document.getElementById('sd-f-id').value = id;
  document.getElementById('sd-f-problem').value = e.problem || '';
  document.getElementById('sd-f-date').value = e.date || '';
  document.getElementById('sd-f-difficulty').value = e.difficulty || '';
  document.getElementById('sd-f-score').value = e.score || '';
  document.getElementById('sd-f-url').value = e.url || '';
  document.getElementById('sd-f-notes').value = e.notes || '';
  document.getElementById('sd-modal-overlay').classList.remove('hidden');
}

function sdCloseModal() {
  document.getElementById('sd-modal-overlay').classList.add('hidden');
  sdEditingId = null;
}

async function sdHandleSubmit(evt) {
  evt.preventDefault();
  const problemEl = document.getElementById('sd-f-problem');
  if (!problemEl.value.trim()) {
    problemEl.classList.add('invalid');
    problemEl.focus();
    return;
  }
  problemEl.classList.remove('invalid');

  const entry = {
    problem: problemEl.value.trim(),
    date: document.getElementById('sd-f-date').value,
    difficulty: document.getElementById('sd-f-difficulty').value,
    score: toNum(document.getElementById('sd-f-score').value),
    url: document.getElementById('sd-f-url').value.trim(),
    notes: document.getElementById('sd-f-notes').value.trim(),
  };

  if (sdEditingId) {
    const res = await fetch(`/api/system-design/${sdEditingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const saved = await res.json();
    sdExercises = sdExercises.map(x => (x.id === sdEditingId ? saved : x));
  } else {
    const res = await fetch('/api/system-design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const saved = await res.json();
    sdExercises.push(saved);
  }

  sdCloseModal();
  sdRender();
}

async function sdConfirmDelete(id) {
  const e = sdExercises.find(x => x.id === id);
  if (!e) return;
  if (!confirm(`Delete exercise "${e.problem}"?`)) return;
  await fetch(`/api/system-design/${id}`, { method: 'DELETE' });
  sdExercises = sdExercises.filter(x => x.id !== id);
  sdRender();
}

function renderCombinedCalendar(calendar) {
  const today = todayISO();
  const grid = document.getElementById('combined-cal-grid');
  grid.innerHTML = calendar
    .map(day => {
      const d = new Date(`${day.date}T12:00:00`);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      const isToday = day.date === today;
      const qLevel = Math.min(day.questions_completed, 3);
      const sdLevel = Math.min(day.sd_count, 3);
      const chLevel = Math.min(day.ch_count, 3);
      const rqLevel = Math.min(day.rq_count, 3);
      return `
      <div class="cal-day ${isToday ? 'cal-today' : ''}">
        <span class="cal-day-name">${dayName}</span>
        <span class="cal-day-num">${dayNum}</span>
        <span class="cal-month-lbl">${month}</span>
        <div class="cal-dot cal-dot-${qLevel}">${day.questions_completed > 0 ? `🧠 ${day.questions_completed}/${day.questions_total}` : '—'}</div>
        <div class="cal-sd-dot cal-sd-dot-${sdLevel}">${day.sd_count > 0 ? `🏗 ${day.sd_count}` : '—'}</div>
        <div class="cal-ch-dot cal-ch-dot-${chLevel}">${day.ch_count > 0 ? `💻 ${day.ch_count}` : '—'}</div>
        <div class="cal-rq-dot cal-rq-dot-${rqLevel}">${day.rq_count > 0 ? `🎤 ${day.rq_count}` : '—'}</div>
      </div>
    `;
    })
    .join('');
}

/* ────────────────────────────────────────────
   CODE CHALLENGES
──────────────────────────────────────────── */
async function chLoad() {
  const res = await fetch('/api/challenges');
  challengesData = await res.json();
  chPopulateTopics();
  chRender();

  document.getElementById('ch-search').addEventListener('input', chRender);
  document.getElementById('ch-filter-week').addEventListener('change', chRender);
  document.getElementById('ch-filter-diff').addEventListener('change', chRender);
  document.getElementById('ch-filter-topic').addEventListener('change', chRender);
  document.getElementById('ch-filter-status').addEventListener('change', chRender);
}

function chPopulateTopics() {
  const topics = [...new Set(challengesData.map(c => c.topic))].sort();
  const sel = document.getElementById('ch-filter-topic');
  topics.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
}

function chRender() {
  const search = document.getElementById('ch-search').value.toLowerCase();
  const week = document.getElementById('ch-filter-week').value;
  const diff = document.getElementById('ch-filter-diff').value;
  const topic = document.getElementById('ch-filter-topic').value;
  const status = document.getElementById('ch-filter-status').value;

  const filtered = challengesData.filter(c => {
    if (search && !c.title.toLowerCase().includes(search)) return false;
    if (week && String(c.week) !== week) return false;
    if (diff && c.difficulty !== diff) return false;
    if (topic && c.topic !== topic) return false;
    if (status === 'done' && !c.done) return false;
    if (status === 'todo' && c.done) return false;
    return true;
  });

  const total = challengesData.length;
  const done = challengesData.filter(c => c.done).length;
  const easyTotal = challengesData.filter(c => c.difficulty === 'Easy').length;
  const easyDone = challengesData.filter(c => c.difficulty === 'Easy' && c.done).length;
  const medTotal = challengesData.filter(c => c.difficulty === 'Medium').length;
  const medDone = challengesData.filter(c => c.difficulty === 'Medium' && c.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('ch-done').textContent = done;
  document.getElementById('ch-total').textContent = total;
  document.getElementById('ch-pct').textContent = `${pct}%`;
  document.getElementById('ch-bar').style.width = `${pct}%`;
  document.getElementById('ch-easy-done').textContent = easyDone;
  document.getElementById('ch-easy-total').textContent = easyTotal;
  document.getElementById('ch-med-done').textContent = medDone;
  document.getElementById('ch-med-total').textContent = medTotal;

  const tbody = document.getElementById('ch-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No problems match your filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map(
      c => `
    <tr class="${c.done ? 'ch-row-done' : ''}">
      <td>
        <button class="ch-toggle ${c.done ? 'ch-toggle-done' : ''}"
                onclick="chToggle(${c.id})" title="${c.done ? 'Mark as todo' : 'Mark as done'}">
          ${c.done ? '✓' : ''}
        </button>
      </td>
      <td>
        <a href="${esc(c.url)}" target="_blank" class="ch-link">${esc(c.title)}</a>
      </td>
      <td><span class="badge ${c.difficulty === 'Easy' ? 'badge-easy' : 'badge-medium'}">${esc(c.difficulty)}</span></td>
      <td>${esc(c.topic)}</td>
      <td style="color:var(--text-muted)">Week ${c.week}</td>
    </tr>
  `,
    )
    .join('');
}

async function chToggle(id) {
  const res = await fetch('/api/challenges/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  const { done } = await res.json();
  const ch = challengesData.find(c => c.id === id);
  if (ch) ch.done = done;
  chRender();
}

/* ────────────────────────────────────────────
   RECRUITER / HIRING MANAGER QUESTIONS
──────────────────────────────────────────── */
async function loadRQToday() {
  const res = await fetch('/api/recruiter/today');
  rqPracticeData = await res.json();
  rqSetStreak(rqPracticeData.streak);
  rqRenderQuestions();
}

function rqSetStreak(n) {
  document.getElementById('rq-streak-count').textContent = n;
}

function rqRenderQuestions() {
  const { questions, completed } = rqPracticeData;
  const container = document.getElementById('rq-questions-container');
  const allDone = questions.length > 0 && questions.every(q => completed.includes(q.id));

  container.innerHTML = `
    <div class="questions-list">
      ${questions.map((q, i) => rqCardHTML(q, i, completed)).join('')}
    </div>
    ${
      allDone
        ? `
      <div class="all-done-msg">
        <span class="all-done-emoji">🎉</span>
        <h3>All done for today!</h3>
        <p>Great work. Come back tomorrow for 5 new questions and keep the streak going.</p>
      </div>`
        : ''
    }
  `;
}

function rqCardHTML(q, idx, completed) {
  const isDone = completed.includes(q.id);
  return `
    <div class="q-card ${isDone ? 'q-card-done' : ''}" id="rqcard-${q.id}">
      <div class="q-card-header">
        <span class="q-num">Question ${idx + 1} of 5</span>
        ${isDone ? '<span class="q-badge-done">✓ Done</span>' : ''}
      </div>
      <p class="q-text">${esc(q.question)}</p>
      <div class="q-actions">
        <button class="btn btn-secondary" id="rqreveal-btn-${q.id}" onclick="rqToggleReveal(${q.id})">
          💡 Reveal tips &amp; example
        </button>
        ${!isDone ? `<button class="btn btn-primary" onclick="rqMarkDone(${q.id})">✓ Mark as done</button>` : ''}
      </div>
      <div class="q-reveal hidden" id="rqreveal-${q.id}">
        <div class="q-tips">
          <h4>💡 Tips</h4>
          <ul>${q.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>
        <div class="q-example">
          <h4>📝 Example Answer</h4>
          <p>${esc(q.example_answer)}</p>
        </div>
      </div>
    </div>
  `;
}

function rqToggleReveal(id) {
  const reveal = document.getElementById(`rqreveal-${id}`);
  const btn = document.getElementById(`rqreveal-btn-${id}`);
  const nowHidden = reveal.classList.toggle('hidden');
  btn.textContent = nowHidden ? '💡 Reveal tips & example' : '🙈 Hide tips & example';
}

async function rqMarkDone(questionId) {
  const res = await fetch('/api/recruiter/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_id: questionId }),
  });
  const data = await res.json();
  if (!rqPracticeData.completed.includes(questionId)) rqPracticeData.completed.push(questionId);
  rqSetStreak(data.streak);
  rqRenderQuestions();
}

async function rqReset() {
  if (!confirm("Reset today's recruiter practice? This clears your completed answers for today.")) return;
  const res = await fetch('/api/recruiter/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  rqPracticeData.completed = [];
  rqSetStreak(data.streak);
  rqRenderQuestions();
}

/* ────────────────────────────────────────────
   COMPANIES OF INTEREST
──────────────────────────────────────────── */
async function fetchGlassdoorCache() {
  if (gdLoaded) return;
  gdLoaded = true;
  const res = await fetch('/api/glassdoor-cache');
  glassdoorCache = await res.json();
}

async function coFetchCompanies() {
  const [coRes] = await Promise.all([fetch('/api/companies'), fetchGlassdoorCache()]);
  companies = await coRes.json();
  coRender();
}

function coGlassdoor(companyName) {
  if (!companyName) return null;
  return glassdoorCache[companyName.trim().toLowerCase()] || null;
}

function coColValue(c, col) {
  switch (col) {
    case 'glassdoor': {
      const gd = coGlassdoor(c.company_name);
      return gd && gd.glassdoor_rating != null && gd.glassdoor_rating !== '' ? Number(gd.glassdoor_rating) : -1;
    }
    default:
      return '';
  }
}

function coRender() {
  const search = document.getElementById('co-search').value.toLowerCase();

  const rows = companies.filter(c => {
    if (!search) return true;
    const haystack =
      `${c.company_name || ''} ${c.industry || ''} ${c.location || ''} ${c.benefits || ''}`.toLowerCase();
    return haystack.includes(search);
  });

  if (coSortCol) {
    rows.sort((a, b) => {
      const va = coColValue(a, coSortCol);
      const vb = coColValue(b, coSortCol);
      if (va < vb) return coSortDir === 'asc' ? -1 : 1;
      if (va > vb) return coSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  document.querySelectorAll('#co-table th[data-col]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === coSortCol) {
      th.classList.add(coSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  const tbody = document.getElementById('co-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr id="co-empty-row"><td colspan="5" class="empty-msg">${companies.length === 0 ? 'No companies yet. Click "+ Add Company" to get started.' : 'No companies match your search.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(c => {
      const gd = coGlassdoor(c.company_name);
      return `
    <tr${c.excluded ? ' class="row-excluded"' : ''}>
      <td>
        <strong>${esc(c.company_name)}</strong>
        ${c.excluded ? ' <span class="badge badge-excluded">🚫 Excluded</span>' : ''}
        ${c.url ? `<br/><a href="${esc(c.url)}" target="_blank" style="font-size:12px;color:#4f46e5;">↗ site</a>` : ''}
        ${c.industry ? `<br/><span style="font-size:12px;color:#64748b;">${esc(c.industry)}</span>` : ''}
        ${c.location ? `<br/><span style="font-size:12px;color:#64748b;">📍 ${esc(c.location)}</span>` : ''}
      </td>
      <td style="max-width:240px;white-space:pre-wrap;">${esc(c.benefits || '—')}</td>
      <td>
        ${gd ? `${stars(Math.round(gd.glassdoor_rating))} <span style="font-size:12px;color:#64748b;">${gd.glassdoor_rating}</span>` : '—'}
        ${gd?.glassdoor_notes ? `<br/><span style="font-size:12px;color:#64748b;white-space:pre-wrap;">${esc(gd.glassdoor_notes)}</span>` : ''}
      </td>
      <td>${stars(c.interest_level)}</td>
      <td>
        <div class="actions">
          <button class="btn-icon" title="Edit" onclick="coOpenEdit('${c.id}')">✏️</button>
          ${
            c.excluded
              ? `<button class="btn-icon" title="Stop excluding this company" onclick="coToggleExcluded('${c.id}')">↩️</button>`
              : `<button class="btn-icon danger" title="Exclude company — discard its jobs" onclick="coToggleExcluded('${c.id}')">🚫</button>`
          }
          <button class="btn-icon danger" title="Delete" onclick="coConfirmDelete('${c.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `;
    })
    .join('');
}

function coOpenAdd() {
  coEditingId = null;
  document.getElementById('co-modal-title').textContent = 'Add Company';
  document.getElementById('co-form').reset();
  document.getElementById('co-f-id').value = '';
  clearInvalid();
  document.getElementById('co-modal-overlay').classList.remove('hidden');
}

function coOpenEdit(id) {
  const c = companies.find(x => x.id === id);
  if (!c) return;
  coEditingId = id;
  document.getElementById('co-modal-title').textContent = 'Edit Company';
  document.getElementById('co-f-id').value = id;
  document.getElementById('co-f-company_name').value = c.company_name || '';
  document.getElementById('co-f-url').value = c.url || '';
  document.getElementById('co-f-industry').value = c.industry || '';
  document.getElementById('co-f-location').value = c.location || '';
  document.getElementById('co-f-interest_level').value = c.interest_level || '';
  document.getElementById('co-f-benefits').value = c.benefits || '';
  document.getElementById('co-f-notes').value = c.notes || '';

  clearInvalid();
  document.getElementById('co-modal-overlay').classList.remove('hidden');
}

function coCloseModal() {
  document.getElementById('co-modal-overlay').classList.add('hidden');
  coEditingId = null;
}

async function coHandleSubmit(evt) {
  evt.preventDefault();
  const nameEl = document.getElementById('co-f-company_name');
  if (!nameEl.value.trim()) {
    nameEl.classList.add('invalid');
    nameEl.focus();
    return;
  }
  nameEl.classList.remove('invalid');

  const entry = {
    company_name: nameEl.value.trim(),
    url: document.getElementById('co-f-url').value.trim(),
    industry: document.getElementById('co-f-industry').value.trim(),
    location: document.getElementById('co-f-location').value.trim(),
    interest_level: toNum(document.getElementById('co-f-interest_level').value),
    benefits: document.getElementById('co-f-benefits').value.trim(),
    notes: document.getElementById('co-f-notes').value.trim(),
  };
  const existing = companies.find(x => x.id === coEditingId);
  if (existing?.excluded) entry.excluded = true;

  if (coEditingId) {
    const res = await fetch(`/api/companies/${coEditingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const saved = await res.json();
    companies = companies.map(x => (x.id === coEditingId ? saved : x));
  } else {
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const saved = await res.json();
    companies.push(saved);
  }

  coCloseModal();
  coRender();
}

async function coConfirmDelete(id) {
  const c = companies.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`Delete "${c.company_name}" from your companies list?`)) return;
  await fetch(`/api/companies/${id}`, { method: 'DELETE' });
  companies = companies.filter(x => x.id !== id);
  coRender();
}

function coToggleExcluded(id) {
  const c = companies.find(x => x.id === id);
  if (c) setCompanyExcluded(c.company_name, !c.excluded);
}

async function setCompanyExcluded(name, excluded) {
  const msg = excluded
    ? `Exclude "${name}"? Its Pending/Interested jobs will be marked Discarded, and future listings from it will be discarded automatically.`
    : `Stop excluding "${name}"? Already-discarded jobs stay discarded.`;
  if (!confirm(msg)) return;
  const res = await fetch('/api/companies/exclude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company: name, excluded }),
  });
  if (!res.ok) {
    alert('Could not update company.');
    return;
  }
  const [coRes, jobsRes] = await Promise.all([fetch('/api/companies'), fetch('/api/jobs')]);
  companies = await coRes.json();
  jobs = await jobsRes.json();
  coRender();
  jobsRender();
}

/* ────────────────────────────────────────────
   JOBS
──────────────────────────────────────────── */
async function jobsFetchJobs() {
  const fetches = [fetch('/api/jobs')];
  if (!coLoaded) {
    coLoaded = true;
    fetches.push(fetch('/api/companies'));
  }
  const results = await Promise.all(fetches);
  jobs = await results[0].json();
  if (results[1]) {
    companies = await results[1].json();
    coRender();
  }
  jobsRender();
}

function jobsRenderUpcoming() {
  const today = todayISO();
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const until = in7.toISOString().split('T')[0];

  const upcoming = jobs
    .filter(
      j =>
        j.next_interview_date &&
        j.next_interview_date >= today &&
        j.next_interview_date <= until &&
        !JOB_SUNK_STATUSES.includes(j.status),
    )
    .sort((a, b) => a.next_interview_date.localeCompare(b.next_interview_date));

  const section = document.getElementById('upcoming-section');
  section.classList.toggle('hidden', upcoming.length === 0);
  document.getElementById('upcoming-list').innerHTML = upcoming
    .map(
      j => `
    <li>
      <strong>${esc(j.company)}</strong>
      ${esc(j.title || '')}
      <span style="color:#92400e">${formatDate(j.next_interview_date)}${j.next_interview_type ? ` · ${esc(j.next_interview_type)}` : ''}</span>
    </li>
  `,
    )
    .join('');
}

/* Levels come from job-search.json (see README). */
async function loadSearchConfig() {
  const res = await fetch('/api/search-config');
  searchConfig = await res.json();
  for (const id of ['jobs-level-filter', 'jobs-f-level']) {
    const select = document.getElementById(id);
    const other = select.querySelector('option[value="Other"]');
    for (const level of searchConfig.levels || []) {
      select.insertBefore(new Option(level, level), other);
    }
  }
}

function ensureLevelOption(select, level) {
  if (level && !Array.from(select.options).some(o => o.value === level)) {
    select.add(new Option(level, level));
  }
}

/* Work mode, level and status filters live in the query string so filtered views can be bookmarked. */
const JOBS_URL_FILTERS = {
  work_mode: 'jobs-work-mode-filter',
  level: 'jobs-level-filter',
  status: 'jobs-status-filter',
};

function jobsApplyUrlFilters() {
  const params = new URLSearchParams(location.search);
  for (const [param, id] of Object.entries(JOBS_URL_FILTERS)) {
    const select = document.getElementById(id);
    const value = params.get(param) || '';
    if (param === 'level') ensureLevelOption(select, value);
    if (Array.from(select.options).some(o => o.value === value)) select.value = value;
  }
  jobsRender();
}

function jobsFilterChanged() {
  const params = new URLSearchParams(location.search);
  for (const [param, id] of Object.entries(JOBS_URL_FILTERS)) {
    const value = document.getElementById(id).value;
    if (value) params.set(param, value);
    else params.delete(param);
  }
  const query = params.toString();
  history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
  jobsRender();
}

function jobContacts(j) {
  return (j.contacts || []).filter(p => p.name?.trim());
}

function jobsColValue(j, col) {
  switch (col) {
    case 'company':
      return (j.company || '').toLowerCase();
    case 'level':
      return (j.level || '').toLowerCase();
    case 'location':
      return (j.location || '').toLowerCase();
    case 'glassdoor_rating':
      return j.glassdoor_rating != null && j.glassdoor_rating !== '' ? Number(j.glassdoor_rating) : -1;
    case 'match_score':
      return j.match_score != null && j.match_score !== '' ? Number(j.match_score) : -1;
    case 'status':
      return jobStatusRank(j);
    case 'date_added':
      return j.date_added || '';
    default:
      return '';
  }
}

// Furthest along the process first, then closed-out jobs.
const JOB_STATUS_ORDER = [
  'Offer',
  'Interviewing',
  'Applied',
  'Interested',
  'Pending',
  'Rejected',
  'Discarded',
  'Closed',
];
function jobStatusRank(j) {
  const i = JOB_STATUS_ORDER.indexOf(j.status || 'Pending');
  return i === -1 ? JOB_STATUS_ORDER.length : i;
}

// CV match score (0–100), filled in by Claude when a job is added.
function matchBadge(score) {
  const n = Number(score);
  if (n >= 75) return 'badge-match-high';
  if (n >= 50) return 'badge-match-mid';
  return 'badge-match-low';
}

const JOB_SUNK_STATUSES = ['Rejected', 'Discarded'];
function jobSinksToBottom(j) {
  return JOB_SUNK_STATUSES.includes(j.status) ? 1 : 0;
}

function jobsRender() {
  jobsRenderUpcoming();
  const search = document.getElementById('jobs-search').value.toLowerCase();
  const workModeFilter = document.getElementById('jobs-work-mode-filter').value;
  const levelFilter = document.getElementById('jobs-level-filter').value;
  const statusFilter = document.getElementById('jobs-status-filter').value;

  const rows = jobs.filter(j => {
    if (workModeFilter && j.work_mode !== workModeFilter) return false;
    if (levelFilter && j.level !== levelFilter) return false;
    if (statusFilter && (j.status || 'Pending') !== statusFilter) return false;
    if (!search) return true;
    const contactText = jobContacts(j)
      .map(p => p.name)
      .join(' ');
    const haystack =
      `${j.company || ''} ${j.title || ''} ${j.location || ''} ${j.level || ''} ${j.notes || ''} ${j.glassdoor_notes || ''} ${contactText}`.toLowerCase();
    return haystack.includes(search);
  });

  if (jobsSortCol) {
    rows.sort((a, b) => {
      const aSunk = jobSinksToBottom(a);
      const bSunk = jobSinksToBottom(b);
      if (aSunk !== bSunk) return aSunk - bSunk;
      const va = jobsColValue(a, jobsSortCol);
      const vb = jobsColValue(b, jobsSortCol);
      if (va < vb) return jobsSortDir === 'asc' ? -1 : 1;
      if (va > vb) return jobsSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  } else {
    rows.sort((a, b) => {
      const byStatus = jobStatusRank(a) - jobStatusRank(b);
      if (byStatus) return byStatus;
      const aHas = jobContacts(a).length > 0 ? 1 : 0;
      const bHas = jobContacts(b).length > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      const aRating = a.glassdoor_rating != null && a.glassdoor_rating !== '' ? Number(a.glassdoor_rating) : -1;
      const bRating = b.glassdoor_rating != null && b.glassdoor_rating !== '' ? Number(b.glassdoor_rating) : -1;
      return bRating - aRating;
    });
  }

  document.querySelectorAll('#jobs-table th[data-col]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === jobsSortCol) {
      th.classList.add(jobsSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  const countEl = document.getElementById('jobs-count');
  if (countEl) {
    countEl.textContent =
      rows.length === jobs.length
        ? `${jobs.length} opening${jobs.length === 1 ? '' : 's'}`
        : `${rows.length} of ${jobs.length} opening${jobs.length === 1 ? '' : 's'}`;
  }

  const tbody = document.getElementById('jobs-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr id="jobs-empty-row"><td colspan="8" class="empty-msg">${jobs.length === 0 ? 'No jobs yet. Click "+ Add Job" to get started.' : 'No jobs match your search.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(j => {
      const contacts = jobContacts(j);
      const title = j.title ? esc(j.title) : '';
      return `
    <tr>
      <td>
        ${title ? (j.link ? `<a href="${esc(j.link)}" target="_blank" style="color:inherit;text-decoration:none;"><strong>${title} ↗</strong></a>` : `<strong>${title}</strong>`) : `<strong>${esc(j.company)}</strong>`}
        <br/><span style="font-size:13px;color:#64748b;">${esc(j.company)}</span>
        ${contacts.length ? `<br/><span class="badge badge-referral">🤝 ${esc(contacts.map(p => p.name).join(', '))}</span>` : ''}
      </td>
      <td>${j.level ? `<span class="badge ${JOB_LEVEL_BADGE[j.level] || 'badge-level'}">${esc(j.level)}</span>` : '—'}</td>
      <td>
        ${j.location ? esc(j.location) : '—'}
        ${j.work_mode ? `<br/><span class="badge ${WORK_MODE_BADGE[j.work_mode] || ''}">${esc(j.work_mode)}</span>` : ''}
      </td>
      <td>
        ${j.glassdoor_rating != null && j.glassdoor_rating !== '' ? `${stars(Math.round(j.glassdoor_rating))} <span style="font-size:12px;color:#64748b;">${j.glassdoor_rating}</span>` : '—'}
        ${j.glassdoor_notes ? `<br/><span style="font-size:12px;color:#64748b;white-space:pre-wrap;">${esc(j.glassdoor_notes)}</span>` : ''}
      </td>
      <td>
        ${j.match_score != null && j.match_score !== '' ? `<span class="badge ${matchBadge(j.match_score)}">${j.match_score}</span>` : '—'}
        ${j.match_notes ? `<br/><span style="font-size:12px;color:#64748b;white-space:pre-wrap;">${esc(j.match_notes)}</span>` : ''}
      </td>
      <td>
        <select class="badge status-select ${JOB_STATUS_BADGE[j.status] || ''}" title="Change status"
                onchange="jobsSetStatus('${j.id}', this.value)">
          ${Object.keys(JOB_STATUS_BADGE)
            .map(s => `<option value="${s}"${(j.status || 'Pending') === s ? ' selected' : ''}>${s}</option>`)
            .join('')}
        </select>
        ${j.next_interview_date ? `<br/><span style="font-size:12px;color:#64748b;">📅 ${formatDate(j.next_interview_date)}${j.next_interview_type ? ` · ${esc(j.next_interview_type)}` : ''}</span>` : ''}
      </td>
      <td>${formatDate(j.date_added)}</td>
      <td>
        <div class="actions">
          <button class="btn-icon" title="Edit" onclick="jobsOpenEdit('${j.id}')">✏️</button>
          <button class="btn-icon danger" title="Exclude ${esc(j.company)} — discard all its jobs" onclick="jobsExcludeCompany('${j.id}')">🚫</button>
          <button class="btn-icon danger" title="Delete" onclick="jobsConfirmDelete('${j.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `;
    })
    .join('');
}

function jobsOpenAdd() {
  jobsEditingId = null;
  document.getElementById('jobs-modal-title').textContent = 'Add Job';
  document.getElementById('jobs-form').reset();
  document.getElementById('jobs-f-id').value = '';
  document.getElementById('jobs-f-status').value = 'Pending';
  document.getElementById('jobs-f-date_added').value = todayISO();
  jobsSetContactRows([]);
  clearInvalid();
  document.getElementById('jobs-modal-overlay').classList.remove('hidden');
}

function jobsOpenEdit(id) {
  const j = jobs.find(x => x.id === id);
  if (!j) return;
  jobsEditingId = id;
  document.getElementById('jobs-modal-title').textContent = 'Edit Job';
  document.getElementById('jobs-f-id').value = id;
  document.getElementById('jobs-f-company').value = j.company || '';
  document.getElementById('jobs-f-title').value = j.title || '';
  document.getElementById('jobs-f-location').value = j.location || '';
  document.getElementById('jobs-f-work_mode').value = j.work_mode || '';
  ensureLevelOption(document.getElementById('jobs-f-level'), j.level);
  document.getElementById('jobs-f-level').value = j.level || '';
  document.getElementById('jobs-f-link').value = j.link || '';
  document.getElementById('jobs-f-glassdoor_rating').value = j.glassdoor_rating != null ? j.glassdoor_rating : '';
  document.getElementById('jobs-f-status').value = j.status || 'Pending';
  document.getElementById('jobs-f-date_added').value = j.date_added || todayISO();
  document.getElementById('jobs-f-next_interview_date').value = j.next_interview_date || '';
  document.getElementById('jobs-f-next_interview_type').value = j.next_interview_type || '';
  document.getElementById('jobs-f-glassdoor_notes').value = j.glassdoor_notes || '';
  document.getElementById('jobs-f-notes').value = j.notes || '';
  jobsSetContactRows(j.contacts);

  clearInvalid();
  document.getElementById('jobs-modal-overlay').classList.remove('hidden');
}

function jobsCloseModal() {
  document.getElementById('jobs-modal-overlay').classList.add('hidden');
  jobsEditingId = null;
}

function jobsSetContactRows(contacts) {
  document.getElementById('jobs-contacts-list').innerHTML = '';
  jobsContactCount = 0;
  for (const p of contacts?.length ? contacts : [{}]) jobsAddContactRow(p);
}

function jobsAddContactRow(contact = {}) {
  const rowId = jobsContactCount++;
  const row = document.createElement('div');
  row.className = 'contact-row';
  row.dataset.rowId = rowId;
  row.innerHTML = `
    <input type="text" class="contact-name" placeholder="Name" value="${esc(contact.name || '')}" />
    <input type="text" class="contact-title" placeholder="Title / Role" value="${esc(contact.title || '')}" />
    <input type="email" class="contact-email" placeholder="Email" value="${esc(contact.email || '')}" />
    <button type="button" class="btn-icon danger" title="Remove contact" onclick="jobsRemoveContactRow(${rowId})">🗑</button>
  `;
  document.getElementById('jobs-contacts-list').appendChild(row);
}

function jobsRemoveContactRow(rowId) {
  const row = document.querySelector(`.contact-row[data-row-id="${rowId}"]`);
  if (row) row.remove();
}

function jobsCollectContacts() {
  return [...document.querySelectorAll('.contact-row')]
    .map(row => ({
      name: row.querySelector('.contact-name').value.trim(),
      title: row.querySelector('.contact-title').value.trim(),
      email: row.querySelector('.contact-email').value.trim(),
    }))
    .filter(p => p.name || p.title || p.email);
}

async function jobsHandleSubmit(evt) {
  evt.preventDefault();
  const companyEl = document.getElementById('jobs-f-company');
  const titleEl = document.getElementById('jobs-f-title');
  let valid = true;
  if (!companyEl.value.trim()) {
    companyEl.classList.add('invalid');
    valid = false;
  } else {
    companyEl.classList.remove('invalid');
  }
  if (!titleEl.value.trim()) {
    titleEl.classList.add('invalid');
    valid = false;
  } else {
    titleEl.classList.remove('invalid');
  }
  if (!valid) {
    (companyEl.value.trim() ? titleEl : companyEl).focus();
    return;
  }

  const entry = {
    company: companyEl.value.trim(),
    title: titleEl.value.trim(),
    location: document.getElementById('jobs-f-location').value.trim(),
    work_mode: document.getElementById('jobs-f-work_mode').value,
    level: document.getElementById('jobs-f-level').value,
    link: document.getElementById('jobs-f-link').value.trim(),
    glassdoor_rating: toNum(document.getElementById('jobs-f-glassdoor_rating').value),
    status: document.getElementById('jobs-f-status').value,
    date_added: document.getElementById('jobs-f-date_added').value || todayISO(),
    next_interview_date: document.getElementById('jobs-f-next_interview_date').value,
    next_interview_type: document.getElementById('jobs-f-next_interview_type').value.trim(),
    glassdoor_notes: document.getElementById('jobs-f-glassdoor_notes').value.trim(),
    notes: document.getElementById('jobs-f-notes').value.trim(),
    contacts: jobsCollectContacts(),
  };

  if (jobsEditingId) {
    const res = await fetch(`/api/jobs/${jobsEditingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // PUT replaces the record, so keep fields the form doesn't show (match score, description…).
      body: JSON.stringify({ ...jobs.find(x => x.id === jobsEditingId), ...entry }),
    });
    const saved = await res.json();
    jobs = jobs.map(x => (x.id === jobsEditingId ? saved : x));
  } else {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const saved = await res.json();
    jobs.push(saved);
  }

  jobsCloseModal();
  jobsRender();
}

// Inline status change from the table. PUT replaces the whole record, so send the full job.
function jobsExcludeCompany(id) {
  const j = jobs.find(x => x.id === id);
  if (j?.company) setCompanyExcluded(j.company, true);
}

async function jobsSetStatus(id, status) {
  const j = jobs.find(x => x.id === id);
  if (!j || j.status === status) return;
  const res = await fetch(`/api/jobs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...j, status }),
  });
  if (!res.ok) {
    alert('Could not update status.');
    jobsRender();
    return;
  }
  const saved = await res.json();
  jobs = jobs.map(x => (x.id === id ? saved : x));
  jobsRender();
}

async function jobsConfirmDelete(id) {
  const j = jobs.find(x => x.id === id);
  if (!j) return;
  if (!confirm(`Delete "${j.company} – ${j.title}" from your jobs list?`)) return;
  await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
  jobs = jobs.filter(x => x.id !== id);
  jobsRender();
}

/* ────────────────────────────────────────────
   PIPELINE (Sankey of job status changes)
──────────────────────────────────────────── */
// Column each status is drawn in; statuses sharing a column are alternative outcomes.
const PIPELINE_STAGE = {
  'Pending': 0,
  'Interested': 1,
  'Applied': 2,
  'Interviewing': 3,
  'Offer': 4,
  'Rejected': 5,
  'Discarded': 5,
  'Closed': 6,
};
const PIPELINE_COLOR = {
  'Pending': '#94a3b8',
  'Interested': '#2a78d6',
  'Applied': '#4a3aa7',
  'Interviewing': '#eda100',
  'Offer': '#008300',
  'Rejected': '#e34948',
  'Discarded': '#475569',
  'Closed': '#a8a29e',
};

let pipelineJobs = [];

async function pipelineLoad() {
  const res = await fetch('/api/jobs');
  pipelineJobs = await res.json();
  pipelineRender();
}

// Collapse a job's history into a forward-only path. Moving back to an earlier
// (or same-column) status is treated as undoing the later steps, so the chart
// stays acyclic and every job ends in the node matching its current status.
function pipelinePath(history) {
  const path = [];
  history.forEach(({ status }) => {
    const stage = PIPELINE_STAGE[status];
    if (stage === undefined) return;
    while (path.length && PIPELINE_STAGE[path[path.length - 1]] >= stage) path.pop();
    path.push(status);
  });
  return path;
}

function pipelineRender() {
  const includeUntouched = document.getElementById('pipeline-include-untouched').checked;
  const paths = pipelineJobs
    .map(j => pipelinePath(j.status_history || [{ status: j.status || 'Pending' }]))
    .filter(p => p.length && (includeUntouched || p.length > 1));

  const reached = {};
  const current = {};
  const linkCounts = {};
  paths.forEach(p => {
    p.forEach(s => {
      reached[s] = (reached[s] || 0) + 1;
    });
    const last = p[p.length - 1];
    current[last] = (current[last] || 0) + 1;
    for (let i = 1; i < p.length; i++) {
      const key = `${p[i - 1]}→${p[i]}`;
      linkCounts[key] = (linkCounts[key] || 0) + 1;
    }
  });

  const summary = document.getElementById('pipeline-summary');
  summary.textContent = `${paths.length} of ${pipelineJobs.length} jobs shown`;

  const links = Object.entries(linkCounts)
    .map(([key, value]) => {
      const [source, target] = key.split('→');
      return { source, target, value };
    })
    .sort((a, b) => PIPELINE_STAGE[a.source] - PIPELINE_STAGE[b.source] || b.value - a.value);

  document.getElementById('pipeline-tbody').innerHTML = links.length
    ? links.map(l => `<tr><td>${esc(l.source)}</td><td>${esc(l.target)}</td><td>${l.value}</td></tr>`).join('')
    : '<tr><td colspan="3" class="empty-msg">No status changes yet.</td></tr>';

  const chart = document.getElementById('pipeline-chart');
  chart.innerHTML = '';
  if (!paths.length) {
    chart.innerHTML = '<p class="empty-msg">No status changes yet. Move a job out of Pending to see it flow here.</p>';
    return;
  }
  pipelineDraw(chart, reached, current, links);
}

function pipelineDraw(chart, reached, current, links) {
  const statuses = Object.keys(reached).sort((a, b) => PIPELINE_STAGE[a] - PIPELINE_STAGE[b]);
  const columns = [...new Set(statuses.map(s => PIPELINE_STAGE[s]))];
  const width = chart.clientWidth;
  const height = 440;
  const pad = { x: 110, y: 12 };
  const nodeWidth = 12;
  const nodeGap = 28;

  // Links spanning several columns get a pass-through lane in every column in
  // between, so their ribbons run through reserved space instead of over the
  // nodes there. Lanes sit below a column's nodes, nearest targets first and,
  // for a shared target, nearest sources first (they arrive from above).
  const colOf = s => columns.indexOf(PIPELINE_STAGE[s]);
  const items = columns.map(c =>
    statuses.filter(s => PIPELINE_STAGE[s] === c).map(name => ({ name, value: reached[name] })),
  );
  const flows = links.map(l => ({ ...l, lanes: [] }));
  [...flows]
    .sort((a, b) => colOf(a.target) - colOf(b.target) || colOf(b.source) - colOf(a.source))
    .forEach(f => {
      for (let ci = colOf(f.source) + 1; ci < colOf(f.target); ci++) {
        const lane = { value: f.value };
        items[ci].push(lane);
        f.lanes.push(lane);
      }
    });

  // Stack each column top to bottom; one scale for all columns so heights are
  // comparable. A node's height counts every job that reached it, so jobs that
  // stopped there show as height beyond the outgoing flows. Adjacent lanes
  // touch, like ribbons leaving the same node.
  const gapBefore = (list, i) => (i === 0 || (!list[i].name && !list[i - 1].name) ? 0 : nodeGap);
  const gapsOf = list => list.reduce((t, _, i) => t + gapBefore(list, i), 0);
  const scale = Math.min(
    ...items.map(list => (height - 2 * pad.y - gapsOf(list)) / list.reduce((t, it) => t + it.value, 0)),
  );
  const colStep = columns.length > 1 ? (width - 2 * pad.x - nodeWidth) / (columns.length - 1) : 0;
  const nodes = {};
  items.forEach((list, ci) => {
    const colHeight = list.reduce((t, it) => t + it.value * scale, 0) + gapsOf(list);
    let y = (height - colHeight) / 2;
    list.forEach((it, i) => {
      y += gapBefore(list, i);
      it.x0 = pad.x + ci * colStep;
      it.y0 = y;
      it.h = it.value * scale;
      if (it.name) nodes[it.name] = { ...it, col: ci, outY: y, inY: y };
      y += it.h;
    });
  });

  // Each flow leaves from the top of its source's remaining space and enters
  // at the top of its target's, ordered by where the ribbon heads next (or
  // came from) so ribbons don't cross needlessly.
  flows.forEach(f => {
    f.w = f.value * scale;
  });
  const midY = it => it.y0 + it.h / 2;
  const nextY = f => midY(f.lanes.length ? f.lanes[0] : nodes[f.target]);
  const prevY = f => midY(f.lanes.length ? f.lanes[f.lanes.length - 1] : nodes[f.source]);
  [...flows]
    .sort((a, b) => nextY(a) - nextY(b))
    .forEach(f => {
      f.sy = nodes[f.source].outY + f.w / 2;
      nodes[f.source].outY += f.w;
    });
  [...flows]
    .sort((a, b) => prevY(a) - prevY(b))
    .forEach(f => {
      f.ty = nodes[f.target].inY + f.w / 2;
      nodes[f.target].inY += f.w;
    });

  const jobsLabel = n => `${n} job${n === 1 ? '' : 's'}`;
  const lastCol = columns.length - 1;
  const flowSvg = flows
    .map((f, i) => {
      // Curve between columns, run straight across each lane.
      const points = [
        [nodes[f.source].x0 + nodeWidth, f.sy],
        ...f.lanes.flatMap(l => [
          [l.x0, midY(l)],
          [l.x0 + nodeWidth, midY(l)],
        ]),
        [nodes[f.target].x0, f.ty],
      ];
      const d = points
        .slice(1)
        .map(([x, y], k) => {
          const [px, py] = points[k];
          const mx = (px + x) / 2;
          return k % 2 ? `L${x},${y}` : `C${mx},${py} ${mx},${y} ${x},${y}`;
        })
        .join('');
      return `<path class="pipeline-link" data-flow="${i}" fill="none" stroke="${PIPELINE_COLOR[f.target]}"
      stroke-width="${Math.max(2, f.w)}" d="M${points[0][0]},${points[0][1]}${d}"/>`;
    })
    .join('');
  const nodeSvg = Object.values(nodes)
    .map(n => {
      const right = n.col === lastCol && lastCol > 0;
      const lx = right ? n.x0 + nodeWidth + 8 : n.x0 - 8;
      return `<g data-node="${esc(n.name)}">
      <rect x="${n.x0}" y="${n.y0}" width="${nodeWidth}" height="${Math.max(2, n.h)}" rx="2" fill="${PIPELINE_COLOR[n.name]}"/>
      <text class="pipeline-label" x="${lx}" y="${n.y0 + n.h / 2}" dy="0.35em" text-anchor="${right ? 'start' : 'end'}">
        ${esc(n.name)}<tspan class="pipeline-label-value" dx="6">${reached[n.name]}</tspan>
      </text>
    </g>`;
    })
    .join('');
  chart.innerHTML = `<svg width="${width}" height="${height}" role="img"
    aria-label="Flow of jobs between statuses">${flowSvg}${nodeSvg}</svg>`;

  const tooltip = document.getElementById('pipeline-tooltip');
  chart.onmousemove = event => {
    const flowEl = event.target.closest('[data-flow]');
    const nodeEl = event.target.closest('[data-node]');
    let html = null;
    if (flowEl) {
      const f = flows[flowEl.dataset.flow];
      html = `<strong>${esc(f.source)} → ${esc(f.target)}</strong><br>${jobsLabel(f.value)}`;
    } else if (nodeEl) {
      const name = nodeEl.dataset.node;
      html =
        `<strong>${esc(name)}</strong><br>${jobsLabel(reached[name])} reached` +
        `<br>${jobsLabel(current[name] || 0)} currently here`;
    }
    if (!html) {
      tooltip.classList.add('hidden');
      return;
    }
    tooltip.innerHTML = html;
    tooltip.classList.remove('hidden');
    const box = chart.parentElement.getBoundingClientRect();
    tooltip.style.left = `${event.clientX - box.left + 14}px`;
    tooltip.style.top = `${event.clientY - box.top + 14}px`;
  };
  chart.onmouseleave = () => tooltip.classList.add('hidden');
}
