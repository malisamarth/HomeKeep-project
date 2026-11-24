
/* ==========================================
   HOMEKEEP 2.0
   Frontend Application Logic
   Firebase backend remains unchanged
========================================== */

const ICONS = {
  HVAC: "🌬️",
  Plumbing: "🚿",
  Electrical: "⚡",
  Safety: "🔥",
  Exterior: "🌿",
  Appliances: "🍽️",
  Structural: "🏠",
  Other: "🔧"
};

const FREQ_LABELS = {
  30: "Monthly",
  90: "Every 3 months",
  180: "Every 6 months",
  365: "Annually"
};

let tasks = [];
let currentFilter = "all";
let isLoading = false;
let toastTimeout = null;

// ==========================================
// DATE UTILITIES
// ==========================================

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  if (!value) return "—";

  const date = parseLocalDate(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDueDate(last, freq) {
  const due = parseLocalDate(last);
  due.setDate(due.getDate() + Number(freq));

  return toDateInputValue(due);
}

function getDaysUntilDue(last, freq) {
  const due = parseLocalDate(getDueDate(last, freq));
  const today = new Date();

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return Math.round((due - today) / 86400000);
}

function getStatus(days) {
  if (days < 0) return "overdue";
  if (days <= 7) return "upcoming";
  return "good";
}

function getStatusDetails(status, days) {
  const details = {
    overdue: {
      label: `${Math.abs(days)}d overdue`,
      pill: "pill-red",
      iconBg: "bg-red"
    },
    upcoming: {
      label: days === 0 ? "Due today" : `Due in ${days}d`,
      pill: "pill-yellow",
      iconBg: "bg-yellow"
    },
    good: {
      label: "Up to date",
      pill: "pill-green",
      iconBg: "bg-green"
    }
  };

  return details[status];
}

// ==========================================
// SAFE HTML RENDERING
// ==========================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// ==========================================
// DASHBOARD STATISTICS
// ==========================================

function animateCounter(element, target) {
  if (!element) return;

  const duration = 700;
  const startTime = performance.now();

  function update(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    element.textContent = Math.round(target * eased);

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function updateDashboard() {
  const total = tasks.length;

  let overdue = 0;
  let upcoming = 0;
  let good = 0;

  tasks.forEach(task => {
    const days = getDaysUntilDue(task.last, task.freq);
    const status = getStatus(days);

    if (status === "overdue") overdue++;
    if (status === "upcoming") upcoming++;
    if (status === "good") good++;
  });

  animateCounter(
    document.getElementById("totalTasks"),
    total
  );

  animateCounter(
    document.getElementById("overdueTasks"),
    overdue
  );

  animateCounter(
    document.getElementById("upcomingTasks"),
    upcoming
  );

  animateCounter(
    document.getElementById("goodTasks"),
    good
  );
}

// ==========================================
// TASK FILTERING
// ==========================================

function getFilteredTasks() {
  const searchValue =
    document.getElementById("searchInput")?.value
      .trim()
      .toLowerCase() || "";

  const categoryValue =
    document.getElementById("categoryFilter")?.value || "all";

  const statusValue =
    document.getElementById("statusFilter")?.value || "all";

  return tasks.filter(task => {
    const days = getDaysUntilDue(task.last, task.freq);
    const status = getStatus(days);

    const matchesSearch =
      task.name.toLowerCase().includes(searchValue) ||
      task.cat.toLowerCase().includes(searchValue) ||
      (task.notes || "").toLowerCase().includes(searchValue);

    const matchesCategory =
      categoryValue === "all" ||
      task.cat === categoryValue;

    const matchesStatus =
      statusValue === "all" ||
      status === statusValue;

    return matchesSearch && matchesCategory && matchesStatus;
  });
}

// ==========================================
// TASK RENDERING
// ==========================================

function renderTasks() {
  const grid = document.getElementById("taskGrid");
  const filtered = getFilteredTasks();

  grid.innerHTML = "";

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div>🏡</div>
        <h3>No tasks found</h3>
        <p>Try changing your filters or add a new maintenance task.</p>
      </div>
    `;

    return;
  }

  filtered.forEach((task, index) => {
    const days = getDaysUntilDue(task.last, task.freq);
    const status = getStatus(days);
    const config = getStatusDetails(status, days);

    const card = document.createElement("article");
    card.className = `task-card ${status}`;
    card.style.animationDelay = `${Math.min(index * 0.06, 0.4)}s`;

    const taskName = escapeHTML(task.name);
    const category = escapeHTML(task.cat);
    const notes = escapeHTML(task.notes || "");
    const id = escapeHTML(task.id);
    const dueDate = formatDate(getDueDate(task.last, task.freq));
    const lastDate = formatDate(task.last);

    const icon = ICONS[task.cat] || ICONS.Other;
    const frequency = FREQ_LABELS[task.freq] || "Custom";

    card.innerHTML = `
      <div class="task-icon ${config.iconBg}">
        ${icon}
      </div>

      <div class="task-name">${taskName}</div>

      <div class="task-desc">
        ${category} · ${frequency}
      </div>

      ${notes ? `<p class="task-desc">${notes}</p>` : ""}

      <div class="task-meta">
        <div>
          <span>Next due</span>
          <strong>${dueDate}</strong>
        </div>

        <span class="status-pill ${config.pill}">
          ${config.label}
        </span>
      </div>

      <div class="task-actions">
        <button
          onclick="markDone('${id}')"
          ${status === "good" ? "disabled" : ""}
        >
          ✓ Mark Done
        </button>

        <button onclick="deleteTask('${id}')">
          Delete
        </button>
      </div>
    `;

    grid.appendChild(card);
  });
}

// ==========================================
// ACTIVITY LOG
// ==========================================

function renderLog() {
  const body = document.getElementById("logBody");

  body.innerHTML = "";

  if (tasks.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;color:var(--muted);padding:35px">
          No maintenance activity yet.
        </td>
      </tr>
    `;

    return;
  }

  const sortedTasks = [...tasks].sort(
    (a, b) => b.last.localeCompare(a.last)
  );

  sortedTasks.forEach(task => {
    const days = getDaysUntilDue(task.last, task.freq);
    const status = getStatus(days);
    const config = getStatusDetails(status, days);

    const row = document.createElement("tr");

    row.innerHTML = `
      <td><strong>${escapeHTML(task.name)}</strong></td>
      <td>${escapeHTML(task.cat)}</td>
      <td>${formatDate(task.last)}</td>
      <td>${formatDate(getDueDate(task.last, task.freq))}</td>
      <td>${escapeHTML(task.notes || "—")}</td>
      <td>
        <span class="status-pill ${config.pill}">
          ${config.label}
        </span>
      </td>
    `;

    body.appendChild(row);
  });
}


// ==========================================
// HOME MAINTENANCE ANALYTICS
// ==========================================

function renderAnalytics() {
  const total = tasks.length;
  let overdue = 0;
  let upcoming = 0;
  let good = 0;
  const categoryTotals = {};

  tasks.forEach(task => {
    const status = getStatus(getDaysUntilDue(task.last, task.freq));
    if (status === "overdue") overdue++;
    else if (status === "upcoming") upcoming++;
    else good++;

    const category = task.cat || "Other";
    categoryTotals[category] = (categoryTotals[category] || 0) + 1;
  });

  const health = total ? Math.round((good / total) * 100) : 0;
  const attention = overdue + upcoming;
  const categoryEntries = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1]);

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  setText("healthScore", `${health}%`);
  setText("healthyCount", good);
  setText("healthyPercent", `${total ? Math.round(good / total * 100) : 0}% of all tasks`);
  setText("attentionCount", attention);
  setText("categoryCount", categoryEntries.length);
  setText("donutTotal", total);
  setText("legendGood", good);
  setText("legendUpcoming", upcoming);
  setText("legendOverdue", overdue);
  setText("healthRingValue", `${health}%`);

  const donut = document.getElementById("statusDonut");
  if (donut) {
    const goodEnd = total ? good / total * 100 : 0;
    const upcomingEnd = total ? (good + upcoming) / total * 100 : 0;
    donut.style.background = total
      ? `conic-gradient(#52c99a 0% ${goodEnd}%, #e9bd68 ${goodEnd}% ${upcomingEnd}%, #f07878 ${upcomingEnd}% 100%)`
      : "conic-gradient(#303847 0% 100%)";
  }

  const ring = document.getElementById("healthRing");
  if (ring) {
    ring.style.background = `conic-gradient(#52c99a 0% ${health}%, #303847 ${health}% 100%)`;
  }

  if (!total) {
    setText("healthLabel", "No tasks yet");
    setText("healthMessage", "Your home health score starts here");
    setText("healthDescription", "Add your first maintenance task and HomeKeep will start analyzing its due date and category.");
  } else if (health >= 80) {
    setText("healthLabel", "Excellent maintenance");
    setText("healthMessage", "Your home is in great shape");
    setText("healthDescription", "Most of your tracked tasks are up to date. Keep following your maintenance schedule.");
  } else if (health >= 50) {
    setText("healthLabel", "Some attention needed");
    setText("healthMessage", "A few tasks need attention");
    setText("healthDescription", "Review upcoming and overdue tasks to keep your home maintenance on track.");
  } else {
    setText("healthLabel", "Needs attention");
    setText("healthMessage", "Prioritize overdue maintenance");
    setText("healthDescription", "A large share of your tasks are not currently up to date. Start with overdue items.");
  }

  const categoryChart = document.getElementById("categoryChart");
  if (categoryChart) {
    if (!categoryEntries.length) {
      categoryChart.innerHTML = '<div class="analytics-empty">Add maintenance tasks to see category insights.</div>';
    } else {
      const max = Math.max(...categoryEntries.map(([, count]) => count));
      categoryChart.innerHTML = categoryEntries.map(([category, count]) => {
        const percentage = Math.round((count / total) * 100);
        const width = Math.max(percentage, 3);
        const safeCategory = escapeHTML(category);
        return `
          <div class="category-row">
            <div class="category-row-top">
              <span><span class="category-emoji">${ICONS[category] || ICONS.Other}</span>${safeCategory}</span>
              <strong>${count} <small>(${percentage}%)</small></strong>
            </div>
            <div class="category-track"><span style="width:${width}%"></span></div>
          </div>
        `;
      }).join("");
    }
  }

  const insights = document.getElementById("analyticsInsights");
  if (insights) {
    if (!total) {
      insights.innerHTML = '<div class="analytics-empty">Insights will appear once you add maintenance tasks.</div>';
    } else {
      const mostTracked = categoryEntries[0];
      const overdueTasks = tasks.filter(task =>
        getStatus(getDaysUntilDue(task.last, task.freq)) === "overdue"
      );
      const insightCards = [];

      if (overdue > 0) {
        insightCards.push({
          icon: "⚠️",
          tone: "insight-danger",
          title: `${overdue} overdue ${overdue === 1 ? "task" : "tasks"}`,
          body: "These tasks have passed their next due date. Review them first."
        });
      } else {
        insightCards.push({
          icon: "✓",
          tone: "insight-positive",
          title: "No overdue tasks",
          body: "Great work — none of your tracked tasks are past their due date."
        });
      }

      if (upcoming > 0) {
        insightCards.push({
          icon: "◷",
          tone: "insight-warning",
          title: `${upcoming} coming up soon`,
          body: "Plan these maintenance activities before their due dates arrive."
        });
      }

      if (mostTracked) {
        insightCards.push({
          icon: ICONS[mostTracked[0]] || ICONS.Other,
          tone: "insight-neutral",
          title: `${mostTracked[0]} is your largest category`,
          body: `${mostTracked[1]} ${mostTracked[1] === 1 ? "task is" : "tasks are"} recorded in this category.`
        });
      }

      if (overdueTasks.length) {
        const nextPriority = overdueTasks
          .map(task => ({ name: task.name, days: getDaysUntilDue(task.last, task.freq) }))
          .sort((a, b) => a.days - b.days)[0];
        insightCards.push({
          icon: "↗",
          tone: "insight-danger",
          title: "Highest priority",
          body: `${nextPriority.name} is ${Math.abs(nextPriority.days)} day(s) overdue.`
        });
      } else if (health === 100) {
        insightCards.push({
          icon: "✦",
          tone: "insight-positive",
          title: "All tasks are up to date",
          body: "Your current task list has no overdue or upcoming maintenance."
        });
      }

      insights.innerHTML = insightCards.map(item => `
        <div class="insight-card ${item.tone}">
          <span class="insight-icon">${item.icon}</span>
          <div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.body)}</p></div>
        </div>
      `).join("");
    }
  }
}


// ==========================================
// RENDER ALL
// ==========================================

function renderApp() {
  updateDashboard();
  renderTasks();
  renderLog();
  renderAnalytics();
}

// ==========================================
// FIREBASE: LOAD TASKS
// ==========================================

async function loadTasksFromFirebase() {
  if (isLoading) return;

  if (!window.db || !window.firebaseFns) {
    console.error("Firebase is not initialized.");
    return;
  }

  isLoading = true;

  try {
    const snapshot = await window.firebaseFns.getDocs(
      window.firebaseFns.collection(window.db, "tasks")
    );

    tasks = [];

    snapshot.forEach(document => {
      const data = document.data();

      if (
        data.name &&
        data.cat &&
        data.last &&
        Number.isFinite(Number(data.freq))
      ) {
        tasks.push({
          id: document.id,
          ...data,
          freq: Number(data.freq)
        });
      }
    });

    renderApp();

  } catch (error) {
    console.error("Error loading tasks:", error);
    showToast("Unable to load tasks. Check Firebase permissions.");
  } finally {
    isLoading = false;
  }
}

// ==========================================
// FIREBASE: ADD TASK
// ==========================================

async function addTask() {
  const name = document.getElementById("taskName").value.trim();

  const cat = document.getElementById("taskCat").value;

  const last =
    document.getElementById("taskLast").value ||
    toDateInputValue(new Date());

  const freq = Number(
    document.getElementById("taskFreq").value
  );

  const notes =
    document.getElementById("taskNotes").value.trim();

  if (!name) {
    alert("Please enter a task name.");
    return;
  }

  if (!parseLocalDate(last) || !Number.isFinite(freq)) {
    alert("Please enter valid task details.");
    return;
  }

  const saveButton = document.querySelector(".modal-footer .primary-btn");

  if (saveButton) saveButton.disabled = true;

  try {
    await window.firebaseFns.addDoc(
      window.firebaseFns.collection(window.db, "tasks"),
      {
        name,
        cat,
        last,
        freq,
        notes
      }
    );

    closeModal();

    document.getElementById("taskName").value = "";
    document.getElementById("taskNotes").value = "";

    await loadTasksFromFirebase();

    showToast("Maintenance task added successfully!");

  } catch (error) {
    console.error("Error adding task:", error);
    showToast("Unable to add task. Please try again.");
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}

// ==========================================
// FIREBASE: MARK DONE
// ==========================================

async function markDone(id) {
  try {
    await window.firebaseFns.updateDoc(
      window.firebaseFns.doc(window.db, "tasks", id),
      {
        last: toDateInputValue(new Date())
      }
    );

    await loadTasksFromFirebase();

    showToast("Task marked as completed!");

  } catch (error) {
    console.error("Error updating task:", error);
    showToast("Unable to update task.");
  }
}

// ==========================================
// FIREBASE: DELETE TASK
// ==========================================

async function deleteTask(id) {
  const confirmed = confirm(
    "Are you sure you want to delete this maintenance task?"
  );

  if (!confirmed) return;

  try {
    await window.firebaseFns.deleteDoc(
      window.firebaseFns.doc(window.db, "tasks", id)
    );

    await loadTasksFromFirebase();

    showToast("Task deleted successfully!");

  } catch (error) {
    console.error("Error deleting task:", error);
    showToast("Unable to delete task.");
  }
}

// ==========================================
// MODAL
// ==========================================

function openModal() {
  document.getElementById("modalOverlay").classList.add("open");

  document.getElementById("taskLast").value =
    toDateInputValue(new Date());

  document.getElementById("taskName").focus();
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
}

function closeModalOutside(event) {
  if (event.target.id === "modalOverlay") {
    closeModal();
  }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

function showToast(message) {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toastMsg");

  toastMessage.textContent = message;

  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function initializeApp() {
  const searchInput = document.getElementById("searchInput");
  const categoryFilter = document.getElementById("categoryFilter");
  const statusFilter = document.getElementById("statusFilter");

  searchInput.addEventListener("input", renderTasks);
  categoryFilter.addEventListener("change", renderTasks);
  statusFilter.addEventListener("change", renderTasks);

  // Keyboard shortcut: Escape closes modal
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeModal();
    }
  });

  // Load Firebase data
  loadTasksFromFirebase();
}

// Firebase module dispatches this event after initialization.
window.addEventListener("firebaseReady", initializeApp);

// Fallback if Firebase is already ready.
if (window.db && window.firebaseFns) {
  initializeApp();
}
