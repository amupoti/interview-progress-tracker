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

  document.querySelectorAll('th[data-col]').forEach(th => {
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

  // System design
  document.getElementById('btn-add-sd').addEventListener('click', sdOpenAdd);
  document.getElementById('sd-btn-cancel').addEventListener('click', sdCloseModal);
  document.getElementById('sd-modal-close').addEventListener('click', sdCloseModal);
  document.getElementById('sd-modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) sdCloseModal();
  });
  document.getElementById('sd-form').addEventListener('submit', sdHandleSubmit);
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
  document.querySelectorAll('th[data-col]').forEach(th => {
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
  ['tracker', 'practice', 'system-design', 'progress'].forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('hidden', tabName !== t);
  });
  document.getElementById('btn-add').classList.toggle('hidden', tabName !== 'tracker');

  if (tabName === 'practice' && !practiceLoaded) {
    practiceLoaded = true;
    loadPracticeToday();
  }
  if (tabName === 'system-design' && !sdLoaded) {
    sdLoaded = true;
    sdFetchExercises();
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
    const qLevel = Math.min(day.questions_completed, 3);
    const sdLevel = Math.min(day.sd_count, 3);
    return `
      <div class="cal-day ${isToday ? 'cal-today' : ''}">
        <span class="cal-day-name">${dayName}</span>
        <span class="cal-day-num">${dayNum}</span>
        <span class="cal-month-lbl">${month}</span>
        <div class="cal-dot cal-dot-${qLevel}">${day.questions_completed}/${day.questions_total}</div>
        <div class="cal-sd-dot cal-sd-dot-${sdLevel}">${day.sd_count > 0 ? '🏗 ' + day.sd_count : '—'}</div>
      </div>
    `;
  }).join('');
}
