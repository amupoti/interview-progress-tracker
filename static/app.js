/* ── State ── */
let interviews = [];
let sortCol = 'application_date';
let sortDir = 'desc';
let editingId = null;

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
let coContactCount = 0;
let coSortCol = null;
let coSortDir = 'asc';
let glassdoorCache = {};
let gdLoaded = false;

let jobs = [];
let jobsEditingId = null;
let jobsLoaded = false;
let jobsSortCol = null;
let jobsSortDir = 'asc';

const STATUS_BADGE = {
  'Applied':      'badge-applied',
  'Phone Screen': 'badge-phone-screen',
  'Technical':    'badge-technical',
  'On-site':      'badge-on-site',
  'Offer':        'badge-offer',
  'Accepted':     'badge-accepted',
  'Rejected':     'badge-rejected',
  'Declined':     'badge-declined',
};

const JOB_STATUS_BADGE = {
  'Pending':      'badge-pending',
  'Interested':   'badge-interested',
  'Applied':      'badge-applied',
  'Interviewing': 'badge-interviewing',
  'Offer':        'badge-offer',
  'Rejected':     'badge-rejected',
  'Discarded':    'badge-discarded',
  'Removed':      'badge-removed',
};

const WORK_MODE_BADGE = {
  'Remote': 'badge-remote',
  'Hybrid': 'badge-hybrid',
  'Onsite': 'badge-onsite',
};

const JOB_LEVEL_BADGE = {
  'Senior': 'badge-senior',
  'Staff':  'badge-staff',
};

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  fetchInterviews();

  document.getElementById('btn-add').addEventListener('click', openAddModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('entry-form').addEventListener('submit', handleSubmit);
  document.getElementById('search-input').addEventListener('input', renderTable);
  document.getElementById('status-filter').addEventListener('change', renderTable);

  document.querySelectorAll('#interviews-table th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }
      renderTable();
    });
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
  document.getElementById('co-btn-add-contact').addEventListener('click', () => coAddContactRow());
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
  document.getElementById('btn-reload-jobs').addEventListener('click', jobsReload);
  document.getElementById('btn-search-linkedin').addEventListener('click', jobsSearchLinkedIn);
  document.getElementById('jobs-btn-cancel').addEventListener('click', jobsCloseModal);
  document.getElementById('jobs-modal-close').addEventListener('click', jobsCloseModal);
  document.getElementById('jobs-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) jobsCloseModal();
  });
  document.getElementById('jobs-form').addEventListener('submit', jobsHandleSubmit);
  document.getElementById('jobs-search').addEventListener('input', jobsRender);
  document.getElementById('jobs-work-mode-filter').addEventListener('change', jobsRender);
  document.getElementById('jobs-level-filter').addEventListener('change', jobsRender);
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

/* ── API ── */
async function fetchInterviews() {
  const res = await fetch('/api/interviews');
  interviews = await res.json();
  renderTable();
  renderUpcoming();
}

async function saveEntry(entry) {
  if (editingId) {
    const res = await fetch(`/api/interviews/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return res.json();
  } else {
    const res = await fetch('/api/interviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return res.json();
  }
}

async function deleteEntry(id) {
  await fetch(`/api/interviews/${id}`, { method: 'DELETE' });
}

/* ── Render table ── */
function renderTable() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const statusFilter = document.getElementById('status-filter').value;

  let rows = interviews.filter(e => {
    const matchText =
      (e.company_name || '').toLowerCase().includes(search) ||
      (e.job_title || '').toLowerCase().includes(search);
    const matchStatus = !statusFilter || e.status === statusFilter;
    return matchText && matchStatus;
  });

  // Sort
  rows.sort((a, b) => {
    let va = a[sortCol] ?? '';
    let vb = b[sortCol] ?? '';
    if (typeof va === 'number' || !isNaN(Number(va))) {
      va = Number(va) || 0;
      vb = Number(vb) || 0;
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Update sort indicators
  document.querySelectorAll('#interviews-table th[data-col]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === sortCol) {
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });

  const tbody = document.getElementById('interviews-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr id="empty-row"><td colspan="11" class="empty-msg">No applications match your filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(e => `
    <tr data-id="${e.id}">
      <td>
        <strong>${esc(e.company_name)}</strong>
        ${e.job_url ? `<br/><a href="${esc(e.job_url)}" target="_blank" style="font-size:12px;color:#4f46e5;">↗ posting</a>` : ''}
        ${e.location ? `<br/><span style="font-size:12px;color:#64748b;">📍 ${esc(e.location)}</span>` : ''}
      </td>
      <td>
        ${esc(e.job_title || '—')}
        ${e.tech_stack ? `<br/><span style="font-size:12px;color:#64748b;">${esc(e.tech_stack)}</span>` : ''}
      </td>
      <td><span class="badge ${STATUS_BADGE[e.status] || ''}">${esc(e.status || '—')}</span></td>
      <td>${formatDate(e.application_date)}</td>
      <td>${formatDate(e.next_interview_date)}</td>
      <td>${esc(e.next_interview_type || '—')}</td>
      <td style="text-align:center">${e.interviews_completed ?? 0}</td>
      <td>${salaryRange(e)}</td>
      <td style="text-align:center">${e.remote_days != null ? e.remote_days + '/5' : '—'}</td>
      <td>${stars(e.interest_level)}</td>
      <td>
        <div class="actions">
          <button class="btn-icon" title="Edit" onclick="openEditModal('${e.id}')">✏️</button>
          <button class="btn-icon danger" title="Delete" onclick="confirmDelete('${e.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

/* ── Render upcoming ── */
function renderUpcoming() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);

  const upcoming = interviews.filter(e => {
    if (!e.next_interview_date) return false;
    const d = new Date(e.next_interview_date);
    return d >= today && d <= in7;
  }).sort((a, b) => a.next_interview_date.localeCompare(b.next_interview_date));

  const section = document.getElementById('upcoming-section');
  const list = document.getElementById('upcoming-list');

  if (upcoming.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  list.innerHTML = upcoming.map(e => `
    <li>
      <strong>${esc(e.company_name)}</strong>
      ${esc(e.job_title ? '· ' + e.job_title : '')}
      <span style="color:#92400e">${formatDate(e.next_interview_date)}</span>
    </li>
  `).join('');
}

/* ── Modal ── */
function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Application';
  document.getElementById('entry-form').reset();
  document.getElementById('f-id').value = '';
  document.getElementById('f-status').value = 'Applied';
  document.getElementById('f-application_date').value = todayISO();
  document.getElementById('f-interviews_completed').value = '0';
  clearInvalid();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openEditModal(id) {
  const e = interviews.find(x => x.id === id);
  if (!e) return;
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Application';

  const fields = [
    'company_name', 'job_title', 'status', 'application_date', 'next_interview_date',
    'next_interview_type', 'interviews_completed', 'salary_range_min', 'salary_range_max',
    'remote_days', 'location', 'tech_stack', 'interest_level', 'offer_deadline',
    'contact_name', 'contact_email', 'job_url', 'notes',
  ];
  fields.forEach(f => {
    const el = document.getElementById('f-' + f);
    if (el) el.value = e[f] ?? '';
  });
  clearInvalid();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
}

/* ── Form submit ── */
async function handleSubmit(evt) {
  evt.preventDefault();
  const nameEl = document.getElementById('f-company_name');
  if (!nameEl.value.trim()) {
    nameEl.classList.add('invalid');
    nameEl.focus();
    return;
  }
  nameEl.classList.remove('invalid');

  const entry = {
    company_name:        document.getElementById('f-company_name').value.trim(),
    job_title:           document.getElementById('f-job_title').value.trim(),
    status:              document.getElementById('f-status').value,
    application_date:    document.getElementById('f-application_date').value,
    next_interview_date: document.getElementById('f-next_interview_date').value,
    next_interview_type: document.getElementById('f-next_interview_type').value.trim(),
    interviews_completed: parseInt(document.getElementById('f-interviews_completed').value) || 0,
    salary_range_min:    toNum(document.getElementById('f-salary_range_min').value),
    salary_range_max:    toNum(document.getElementById('f-salary_range_max').value),
    remote_days:         toNum(document.getElementById('f-remote_days').value),
    location:            document.getElementById('f-location').value.trim(),
    tech_stack:          document.getElementById('f-tech_stack').value.trim(),
    interest_level:      toNum(document.getElementById('f-interest_level').value),
    offer_deadline:      document.getElementById('f-offer_deadline').value,
    contact_name:        document.getElementById('f-contact_name').value.trim(),
    contact_email:       document.getElementById('f-contact_email').value.trim(),
    job_url:             document.getElementById('f-job_url').value.trim(),
    notes:               document.getElementById('f-notes').value.trim(),
  };

  const saved = await saveEntry(entry);

  if (editingId) {
    interviews = interviews.map(x => x.id === editingId ? saved : x);
  } else {
    interviews.push(saved);
  }

  closeModal();
  renderTable();
  renderUpcoming();
}

/* ── Delete ── */
async function confirmDelete(id) {
  const e = interviews.find(x => x.id === id);
  if (!e) return;
  if (!confirm(`Delete application for "${e.company_name}"?`)) return;
  await deleteEntry(id);
  interviews = interviews.filter(x => x.id !== id);
  renderTable();
  renderUpcoming();
}

/* ── Helpers ── */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function salaryRange(e) {
  const min = e.salary_range_min;
  const max = e.salary_range_max;
  if (!min && !max) return '—';
  if (min && max) return `${fmtNum(min)} – ${fmtNum(max)}`;
  return fmtNum(min || max);
}

function fmtNum(n) {
  return Number(n).toLocaleString();
}

function stars(level) {
  if (!level) return '—';
  const n = Math.min(5, Math.max(1, Number(level)));
  return `<span class="stars">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
}

function toNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function clearInvalid() {
  document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

/* ────────────────────────────────────────────
   TAB SWITCHING
──────────────────────────────────────────── */
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  ['tracker', 'practice', 'recruiter', 'challenges', 'system-design', 'companies', 'jobs', 'progress'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('hidden', tabName !== t);
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
    ${allDone ? `
      <div class="all-done-msg">
        <span class="all-done-emoji">🎉</span>
        <h3>All done for today!</h3>
        <p>Great work. Come back tomorrow for 3 new questions and keep the streak going.</p>
      </div>` : ''}
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
  const reveal = document.getElementById('qreveal-' + id);
  const btn = document.getElementById('qreveal-btn-' + id);
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
  document.getElementById('prog-challenges').textContent =
    `${data.challenges_done}/${data.challenges_total}`;
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
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekCount = sdExercises.filter(e => e.date && new Date(e.date) >= weekAgo).length;
  document.getElementById('sd-stat-week').textContent = weekCount;

  if (sorted.length === 0) {
    tbody.innerHTML = `<tr id="sd-empty-row"><td colspan="6" class="empty-msg">No exercises yet. Click "+ Log Exercise" to record your first session.</td></tr>`;
    return;
  }

  const DIFF_BADGE = { Easy: 'badge-offer', Medium: 'badge-technical', Hard: 'badge-rejected' };

  tbody.innerHTML = sorted.map(e => `
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
  `).join('');
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
    problem:    problemEl.value.trim(),
    date:       document.getElementById('sd-f-date').value,
    difficulty: document.getElementById('sd-f-difficulty').value,
    score:      toNum(document.getElementById('sd-f-score').value),
    url:        document.getElementById('sd-f-url').value.trim(),
    notes:      document.getElementById('sd-f-notes').value.trim(),
  };

  if (sdEditingId) {
    const res = await fetch(`/api/system-design/${sdEditingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const saved = await res.json();
    sdExercises = sdExercises.map(x => x.id === sdEditingId ? saved : x);
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
  grid.innerHTML = calendar.map(day => {
    const d = new Date(day.date + 'T12:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const isToday = day.date === today;
    const qLevel  = Math.min(day.questions_completed, 3);
    const sdLevel = Math.min(day.sd_count, 3);
    const chLevel = Math.min(day.ch_count, 3);
    const rqLevel = Math.min(day.rq_count, 3);
    return `
      <div class="cal-day ${isToday ? 'cal-today' : ''}">
        <span class="cal-day-name">${dayName}</span>
        <span class="cal-day-num">${dayNum}</span>
        <span class="cal-month-lbl">${month}</span>
        <div class="cal-dot cal-dot-${qLevel}">${day.questions_completed > 0 ? '🧠 ' + day.questions_completed + '/' + day.questions_total : '—'}</div>
        <div class="cal-sd-dot cal-sd-dot-${sdLevel}">${day.sd_count > 0 ? '🏗 ' + day.sd_count : '—'}</div>
        <div class="cal-ch-dot cal-ch-dot-${chLevel}">${day.ch_count > 0 ? '💻 ' + day.ch_count : '—'}</div>
        <div class="cal-rq-dot cal-rq-dot-${rqLevel}">${day.rq_count > 0 ? '🎤 ' + day.rq_count : '—'}</div>
      </div>
    `;
  }).join('');
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
  const week   = document.getElementById('ch-filter-week').value;
  const diff   = document.getElementById('ch-filter-diff').value;
  const topic  = document.getElementById('ch-filter-topic').value;
  const status = document.getElementById('ch-filter-status').value;

  const filtered = challengesData.filter(c => {
    if (search && !c.title.toLowerCase().includes(search)) return false;
    if (week   && String(c.week) !== week) return false;
    if (diff   && c.difficulty !== diff) return false;
    if (topic  && c.topic !== topic) return false;
    if (status === 'done' && !c.done) return false;
    if (status === 'todo' && c.done) return false;
    return true;
  });

  const total  = challengesData.length;
  const done   = challengesData.filter(c => c.done).length;
  const easyTotal  = challengesData.filter(c => c.difficulty === 'Easy').length;
  const easyDone   = challengesData.filter(c => c.difficulty === 'Easy' && c.done).length;
  const medTotal   = challengesData.filter(c => c.difficulty === 'Medium').length;
  const medDone    = challengesData.filter(c => c.difficulty === 'Medium' && c.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;

  document.getElementById('ch-done').textContent  = done;
  document.getElementById('ch-total').textContent = total;
  document.getElementById('ch-pct').textContent   = pct + '%';
  document.getElementById('ch-bar').style.width   = pct + '%';
  document.getElementById('ch-easy-done').textContent  = easyDone;
  document.getElementById('ch-easy-total').textContent = easyTotal;
  document.getElementById('ch-med-done').textContent   = medDone;
  document.getElementById('ch-med-total').textContent  = medTotal;

  const tbody = document.getElementById('ch-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No problems match your filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
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
  `).join('');
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
    ${allDone ? `
      <div class="all-done-msg">
        <span class="all-done-emoji">🎉</span>
        <h3>All done for today!</h3>
        <p>Great work. Come back tomorrow for 5 new questions and keep the streak going.</p>
      </div>` : ''}
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
  const reveal = document.getElementById('rqreveal-' + id);
  const btn    = document.getElementById('rqreveal-btn-' + id);
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
  rqPracticeData.completed.push(questionId);
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
    default: return '';
  }
}

function coRender() {
  const search = document.getElementById('co-search').value.toLowerCase();

  const rows = companies.filter(c => {
    if (!search) return true;
    const contactText = (c.contacts || []).map(p => `${p.name || ''} ${p.title || ''} ${p.email || ''}`).join(' ');
    const haystack = `${c.company_name || ''} ${c.industry || ''} ${c.location || ''} ${c.benefits || ''} ${contactText}`.toLowerCase();
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
    tbody.innerHTML = `<tr id="co-empty-row"><td colspan="6" class="empty-msg">${companies.length === 0 ? 'No companies yet. Click "+ Add Company" to get started.' : 'No companies match your search.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(c => {
    const gd = coGlassdoor(c.company_name);
    return `
    <tr>
      <td>
        <strong>${esc(c.company_name)}</strong>
        ${c.url ? `<br/><a href="${esc(c.url)}" target="_blank" style="font-size:12px;color:#4f46e5;">↗ site</a>` : ''}
        ${c.industry ? `<br/><span style="font-size:12px;color:#64748b;">${esc(c.industry)}</span>` : ''}
        ${c.location ? `<br/><span style="font-size:12px;color:#64748b;">📍 ${esc(c.location)}</span>` : ''}
      </td>
      <td>${coContactsCellHTML(c.contacts)}</td>
      <td style="max-width:240px;white-space:pre-wrap;">${esc(c.benefits || '—')}</td>
      <td>
        ${gd ? `${stars(Math.round(gd.glassdoor_rating))} <span style="font-size:12px;color:#64748b;">${gd.glassdoor_rating}</span>` : '—'}
        ${gd && gd.glassdoor_notes ? `<br/><span style="font-size:12px;color:#64748b;white-space:pre-wrap;">${esc(gd.glassdoor_notes)}</span>` : ''}
      </td>
      <td>${stars(c.interest_level)}</td>
      <td>
        <div class="actions">
          <button class="btn-icon" title="Edit" onclick="coOpenEdit('${c.id}')">✏️</button>
          <button class="btn-icon danger" title="Delete" onclick="coConfirmDelete('${c.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

function coContactsCellHTML(contacts) {
  if (!contacts || contacts.length === 0) return '—';
  return `<div class="co-contacts-cell">${contacts.map(p => `
    <div class="co-contact-chip">
      <strong>${esc(p.name || '—')}</strong>${p.title ? ' · ' + esc(p.title) : ''}
      ${p.email ? `<br/>${esc(p.email)}` : ''}
    </div>
  `).join('')}</div>`;
}

function coOpenAdd() {
  coEditingId = null;
  document.getElementById('co-modal-title').textContent = 'Add Company';
  document.getElementById('co-form').reset();
  document.getElementById('co-f-id').value = '';
  document.getElementById('co-contacts-list').innerHTML = '';
  coContactCount = 0;
  coAddContactRow();
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

  document.getElementById('co-contacts-list').innerHTML = '';
  coContactCount = 0;
  const contacts = c.contacts && c.contacts.length ? c.contacts : [{}];
  contacts.forEach(p => coAddContactRow(p));

  clearInvalid();
  document.getElementById('co-modal-overlay').classList.remove('hidden');
}

function coCloseModal() {
  document.getElementById('co-modal-overlay').classList.add('hidden');
  coEditingId = null;
}

function coAddContactRow(contact = {}) {
  const rowId = coContactCount++;
  const row = document.createElement('div');
  row.className = 'co-contact-row';
  row.dataset.rowId = rowId;
  row.innerHTML = `
    <input type="text" class="co-contact-name" placeholder="Name" value="${esc(contact.name || '')}" />
    <input type="text" class="co-contact-title" placeholder="Title / Role" value="${esc(contact.title || '')}" />
    <input type="email" class="co-contact-email" placeholder="Email" value="${esc(contact.email || '')}" />
    <button type="button" class="btn-icon danger" title="Remove contact" onclick="coRemoveContactRow(${rowId})">🗑</button>
  `;
  document.getElementById('co-contacts-list').appendChild(row);
}

function coRemoveContactRow(rowId) {
  const row = document.querySelector(`.co-contact-row[data-row-id="${rowId}"]`);
  if (row) row.remove();
}

function coCollectContacts() {
  return [...document.querySelectorAll('.co-contact-row')]
    .map(row => ({
      name:  row.querySelector('.co-contact-name').value.trim(),
      title: row.querySelector('.co-contact-title').value.trim(),
      email: row.querySelector('.co-contact-email').value.trim(),
    }))
    .filter(p => p.name || p.title || p.email);
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
    company_name:   nameEl.value.trim(),
    url:            document.getElementById('co-f-url').value.trim(),
    industry:       document.getElementById('co-f-industry').value.trim(),
    location:       document.getElementById('co-f-location').value.trim(),
    interest_level: toNum(document.getElementById('co-f-interest_level').value),
    benefits:       document.getElementById('co-f-benefits').value.trim(),
    notes:          document.getElementById('co-f-notes').value.trim(),
    contacts:       coCollectContacts(),
  };

  if (coEditingId) {
    const res = await fetch(`/api/companies/${coEditingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const saved = await res.json();
    companies = companies.map(x => x.id === coEditingId ? saved : x);
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

function jobsSearchLinkedIn() {
  const keywords = '"Senior Software Engineer" OR "Staff Software Engineer"';
  const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent('Spain')}&sortBy=DD`;
  window.open(url, '_blank', 'noopener');
}

async function jobsReload() {
  const btn = document.getElementById('btn-reload-jobs');
  const statusEl = document.getElementById('jobs-reload-status');
  btn.disabled = true;
  statusEl.textContent = 'Checking listings…';
  try {
    const res = await fetch('/api/jobs/refresh', { method: 'POST' });
    const result = await res.json();
    await jobsFetchJobs();
    statusEl.textContent = `Checked ${result.checked}, marked ${result.removed} as removed.`;
  } catch (err) {
    statusEl.textContent = 'Reload failed — check the server log.';
  } finally {
    btn.disabled = false;
  }
}

function jobContacts(companyName) {
  if (!companyName) return [];
  const needle = companyName.trim().toLowerCase();
  const co = companies.find(c => (c.company_name || '').trim().toLowerCase() === needle);
  if (!co || !co.contacts) return [];
  return co.contacts.filter(p => p.name && p.name.trim());
}

function jobsColValue(j, col) {
  switch (col) {
    case 'company':          return (j.company || '').toLowerCase();
    case 'level':            return (j.level || '').toLowerCase();
    case 'location':         return (j.location || '').toLowerCase();
    case 'glassdoor_rating': return j.glassdoor_rating != null && j.glassdoor_rating !== '' ? Number(j.glassdoor_rating) : -1;
    case 'status':           return (j.status || '').toLowerCase();
    case 'date_added':       return j.date_added || '';
    default:                 return '';
  }
}

const JOB_SUNK_STATUSES = ['Rejected', 'Discarded'];
function jobSinksToBottom(j) {
  return JOB_SUNK_STATUSES.includes(j.status) ? 1 : 0;
}

function jobsRender() {
  const search = document.getElementById('jobs-search').value.toLowerCase();
  const workModeFilter = document.getElementById('jobs-work-mode-filter').value;
  const levelFilter = document.getElementById('jobs-level-filter').value;

  const rows = jobs.filter(j => {
    if (workModeFilter && j.work_mode !== workModeFilter) return false;
    if (levelFilter && j.level !== levelFilter) return false;
    if (!search) return true;
    const haystack = `${j.company || ''} ${j.title || ''} ${j.location || ''} ${j.level || ''} ${j.notes || ''} ${j.glassdoor_notes || ''}`.toLowerCase();
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
      const aSunk = jobSinksToBottom(a);
      const bSunk = jobSinksToBottom(b);
      if (aSunk !== bSunk) return aSunk - bSunk;
      const aHas = jobContacts(a.company).length > 0 ? 1 : 0;
      const bHas = jobContacts(b.company).length > 0 ? 1 : 0;
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
    countEl.textContent = rows.length === jobs.length
      ? `${jobs.length} opening${jobs.length === 1 ? '' : 's'}`
      : `${rows.length} of ${jobs.length} opening${jobs.length === 1 ? '' : 's'}`;
  }

  const tbody = document.getElementById('jobs-tbody');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr id="jobs-empty-row"><td colspan="7" class="empty-msg">${jobs.length === 0 ? 'No jobs yet. Click "+ Add Job" to get started.' : 'No jobs match your search.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(j => {
    const contacts = jobContacts(j.company);
    const title = j.title ? esc(j.title) : '';
    return `
    <tr>
      <td>
        ${title ? (j.link ? `<a href="${esc(j.link)}" target="_blank" style="color:inherit;"><strong>${title}</strong></a>` : `<strong>${title}</strong>`) : `<strong>${esc(j.company)}</strong>`}
        <br/><span style="font-size:13px;color:#64748b;">${esc(j.company)}</span>
        ${contacts.length ? `<br/><span class="badge badge-referral">🤝 ${esc(contacts.map(p => p.name).join(', '))}</span>` : ''}
      </td>
      <td>${j.level ? `<span class="badge ${JOB_LEVEL_BADGE[j.level] || ''}">${esc(j.level)}</span>` : '—'}</td>
      <td>
        ${j.location ? esc(j.location) : '—'}
        ${j.work_mode ? `<br/><span class="badge ${WORK_MODE_BADGE[j.work_mode] || ''}">${esc(j.work_mode)}</span>` : ''}
      </td>
      <td>
        ${j.glassdoor_rating != null && j.glassdoor_rating !== '' ? `${stars(Math.round(j.glassdoor_rating))} <span style="font-size:12px;color:#64748b;">${j.glassdoor_rating}</span>` : '—'}
        ${j.glassdoor_notes ? `<br/><span style="font-size:12px;color:#64748b;white-space:pre-wrap;">${esc(j.glassdoor_notes)}</span>` : ''}
      </td>
      <td><span class="badge ${JOB_STATUS_BADGE[j.status] || ''}">${esc(j.status || '—')}</span></td>
      <td>${formatDate(j.date_added)}</td>
      <td>
        <div class="actions">
          <button class="btn-icon" title="Edit" onclick="jobsOpenEdit('${j.id}')">✏️</button>
          <button class="btn-icon danger" title="Delete" onclick="jobsConfirmDelete('${j.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

function jobsOpenAdd() {
  jobsEditingId = null;
  document.getElementById('jobs-modal-title').textContent = 'Add Job';
  document.getElementById('jobs-form').reset();
  document.getElementById('jobs-f-id').value = '';
  document.getElementById('jobs-f-status').value = 'Pending';
  document.getElementById('jobs-f-date_added').value = todayISO();
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
  document.getElementById('jobs-f-level').value = j.level || '';
  document.getElementById('jobs-f-link').value = j.link || '';
  document.getElementById('jobs-f-glassdoor_rating').value = j.glassdoor_rating != null ? j.glassdoor_rating : '';
  document.getElementById('jobs-f-status').value = j.status || 'Pending';
  document.getElementById('jobs-f-date_added').value = j.date_added || todayISO();
  document.getElementById('jobs-f-glassdoor_notes').value = j.glassdoor_notes || '';
  document.getElementById('jobs-f-notes').value = j.notes || '';

  clearInvalid();
  document.getElementById('jobs-modal-overlay').classList.remove('hidden');
}

function jobsCloseModal() {
  document.getElementById('jobs-modal-overlay').classList.add('hidden');
  jobsEditingId = null;
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
    company:          companyEl.value.trim(),
    title:            titleEl.value.trim(),
    location:         document.getElementById('jobs-f-location').value.trim(),
    work_mode:        document.getElementById('jobs-f-work_mode').value,
    level:            document.getElementById('jobs-f-level').value,
    link:             document.getElementById('jobs-f-link').value.trim(),
    glassdoor_rating: toNum(document.getElementById('jobs-f-glassdoor_rating').value),
    status:           document.getElementById('jobs-f-status').value,
    date_added:       document.getElementById('jobs-f-date_added').value || todayISO(),
    glassdoor_notes:  document.getElementById('jobs-f-glassdoor_notes').value.trim(),
    notes:            document.getElementById('jobs-f-notes').value.trim(),
  };

  if (jobsEditingId) {
    const res = await fetch(`/api/jobs/${jobsEditingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const saved = await res.json();
    jobs = jobs.map(x => x.id === jobsEditingId ? saved : x);
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

async function jobsConfirmDelete(id) {
  const j = jobs.find(x => x.id === id);
  if (!j) return;
  if (!confirm(`Delete "${j.company} – ${j.title}" from your jobs list?`)) return;
  await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
  jobs = jobs.filter(x => x.id !== id);
  jobsRender();
}
