const ICONS = {
  HVAC:'🌬️', Plumbing:'🚿', Electrical:'⚡', Safety:'🔥',
  Exterior:'🌿', Appliances:'🍽️', Structural:'🏠', Other:'🔧'
};

const FREQ_LABELS = {
  30:'Monthly',
  90:'Every 3 months',
  180:'Every 6 months',
  365:'Annually'
};

let tasks = [];
let currentFilter = 'all';

function getDaysUntilDue(last, freq) {
  const due = new Date(last);
  due.setDate(due.getDate() + parseInt(freq));
  return Math.round((due - new Date()) / 86400000);
}

function getStatus(days) {
  if (days < 0) return 'overdue';
  if (days <= 7) return 'upcoming';  // 🔥 tighter range
  return 'good';
}

function getDueDate(last, freq) {
  const d = new Date(last);
  d.setDate(d.getDate() + parseInt(freq));
  return d.toISOString().split('T')[0];
}

function formatDate(str) {
  return new Date(str).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

// ✅ FIXED markDone
async function markDone(id) {
  const today = new Date();

  // 🔥 subtract 1 day so it becomes "good"
  const adjustedDate = new Date(today);
  adjustedDate.setDate(adjustedDate.getDate() - 1);

  const formatted = adjustedDate.toISOString().split('T')[0];

  await window.firebaseFns.updateDoc(
    window.firebaseFns.doc(window.db, "tasks", id),
    { last: formatted }
  );

  await loadTasksFromFirebase();
  showToast('Task marked as done!');
}

// ✅ DELETE
async function deleteTask(id) {
  if (!confirm("Delete this task?")) return;

  await window.firebaseFns.deleteDoc(
    window.firebaseFns.doc(window.db, "tasks", id)
  );

  await loadTasksFromFirebase();
  showToast("Task deleted!");
}

// ✅ RENDER
function renderTasks(filter) {
  const grid = document.getElementById('taskGrid');
  grid.innerHTML = '';

  const filtered = tasks.filter(t =>
    filter === 'all' || getStatus(getDaysUntilDue(t.last, t.freq)) === filter
  );

  if (!filtered.length) {
    grid.innerHTML = '<p style="color:var(--muted);padding:48px;text-align:center">No tasks 🎉</p>';
    return;
  }

  filtered.forEach(t => {
    const days = getDaysUntilDue(t.last, t.freq);
    const status = getStatus(days);

    const cfg = {
      overdue:  { pill:'pill-red', iconBg:'bg-red', label:`${Math.abs(days)}d overdue`, btnColor:'#e87e7e' },
      upcoming: { pill:'pill-yellow', iconBg:'bg-yellow', label:`Due in ${days}d`, btnColor:'#e8c97e' },
      good:     { pill:'pill-green', iconBg:'bg-green', label:'Up to date', btnColor:'#7ec99a' },
    }[status];

    const card = document.createElement('div');
    card.className = `task-card ${status}`;

    card.innerHTML = `
      <div class="task-icon ${cfg.iconBg}">${ICONS[t.cat]}</div>
      <div class="task-name">${t.name}</div>
      <div class="task-desc">${t.cat} · ${FREQ_LABELS[t.freq]}</div>

      <div class="task-meta">
        <div>
          <span>Due date</span>
          <strong>${formatDate(getDueDate(t.last, t.freq))}</strong>
        </div>
        <span class="status-pill ${cfg.pill}">${cfg.label}</span>
      </div>

      <div style="display:flex; gap:8px; margin-top:14px;">
        ${status !== 'good'
          ? `<button onclick="markDone('${t.id}')">Done ✓</button>`
          : ''
        }
        <button onclick="deleteTask('${t.id}')">Delete 🗑️</button>
      </div>
    `;

    grid.appendChild(card);
  });
}

// ✅ LOG
function renderLog() {
  const body = document.getElementById('logBody');
  body.innerHTML = '';

  tasks.forEach(t => {
    body.innerHTML += `
      <tr>
        <td>${t.name}</td>
        <td>${t.cat}</td>
        <td>${formatDate(t.last)}</td>
        <td>${formatDate(getDueDate(t.last, t.freq))}</td>
        <td>${t.notes || '-'}</td>
      </tr>`;
  });
}

// ✅ ADD TASK
async function addTask() {
  const name = document.getElementById('taskName').value.trim();
  if (!name) return alert("Enter task name");

  const newTask = {
    name,
    cat: document.getElementById('taskCat').value,
    last: document.getElementById('taskLast').value || new Date().toISOString().split('T')[0],
    freq: parseInt(document.getElementById('taskFreq').value),
    notes: document.getElementById('taskNotes').value
  };

  await window.firebaseFns.addDoc(
    window.firebaseFns.collection(window.db, "tasks"),
    newTask
  );

  await loadTasksFromFirebase();
  closeModal();
  showToast("Task added!");
}

// ✅ LOAD FROM FIREBASE
async function loadTasksFromFirebase() {
  const snapshot = await window.firebaseFns.getDocs(
    window.firebaseFns.collection(window.db, "tasks")
  );

  tasks = [];

  snapshot.forEach(docItem => {
    tasks.push({
      id: docItem.id,
      ...docItem.data()
    });
  });

  renderTasks('all');
  renderLog();
}

// ✅ TOAST
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ✅ WAIT FOR FIREBASE
window.addEventListener("firebaseReady", () => {
  loadTasksFromFirebase();
});

function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('taskLast').value =
    new Date().toISOString().split('T')[0];
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('modalOverlay')) {
    closeModal();
  }
}