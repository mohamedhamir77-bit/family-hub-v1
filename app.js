import { watchMembers, addMember, deleteMember } from "./members.js";
import { watchNodes, addNode, deleteNode, updateNode } from "./nodes.js";
import { addActivity, watchActivity, deleteActivity } from "./activity.js";
import { testWorkspaceModule, nodeIcon } from "./workspace.js";
import { showAddDialog } from "./dialogs.js";
import { renderBreadcrumbs } from "./breadcrumbs.js";
testWorkspaceModule();

const $ = id => document.getElementById(id);

let members = [];
let nodes = [];
let selectedMemberId = null;
let currentParentId = null;
let selectedNode = null;
let selectedDashboardFilter = null;
let calendarDate = new Date();
let parentMode = false;
let activities = [];
const parentPin = "1234";

function updateDashboard() {
  const today = new Date().toISOString().split("T")[0];

  const overdue = nodes.filter(n =>
    n.type === "task" &&
    !n.done &&
    n.dueDate &&
    n.dueDate < today
  ).length;

  const dueToday = nodes.filter(n =>
    n.type === "task" &&
    !n.done &&
    n.dueDate === today
  ).length;

  const upcoming = nodes.filter(n =>
    n.type === "task" &&
    !n.done &&
    n.dueDate &&
    n.dueDate > today
  ).length;

  const completed = nodes.filter(n =>
    n.type === "task" &&
    n.done
  ).length;

  $("overdueCount").textContent = overdue;
  $("todayCount").textContent = dueToday;
  $("upcomingCount").textContent = upcoming;
  $("completedCount").textContent = completed;
}

function currentMember() {
  return members.find(member => member.id === selectedMemberId);
}
function visibleNodes() {
  return nodes.filter(node =>
    node.memberId === selectedMemberId &&
    (node.parentId || null) === (currentParentId || null)
  );
}

function renderMembers() {
  const list = $("membersList");

  if (!members.length) {
    list.innerHTML = `<p class="empty">No members yet.</p>`;
    return;
  }

  list.innerHTML = members.map(member => `
    <div class="card member-card" data-member-id="${member.id}">
      <div class="member-info">
        <span class="avatar">${member.emoji || "👤"}</span>
        <div>
          <strong>${member.name}</strong>
          <small>${member.role || "member"}</small>
        </div>
      </div>
      <button class="danger" data-delete="${member.id}">Delete</button>
    </div>
  `).join("");

  document.querySelectorAll(".member-card").forEach(card => {
    card.onclick = event => {
      if (event.target.tagName === "BUTTON") return;
      selectedMemberId = card.dataset.memberId;
      currentParentId = null;
      renderWorkspace();
    };
  });

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.onclick = async event => {
  event.stopPropagation();

  if (!parentMode) {
    alert("Only a parent can delete members.");
    return;
  }

  const memberItems = nodes.filter(
    node => node.memberId === button.dataset.delete
  );

  if (memberItems.length > 0) {
    alert(
      "This member still has tasks, folders, notes or events. Delete or move them first."
    );
    return;
  }

  if (confirm("Delete this member?")) {
    await deleteMember(button.dataset.delete);
  }
};
  });
}

function renderWorkspace() {
  const member = currentMember();

  if (!member) {
  $("workspaceTitle").textContent = "";
  $("folderList").innerHTML = "";
  $("workspacePanel").classList.add("hidden");
  return;
}

  $("workspacePanel").dataset.memberId = member.id;
  $("workspaceTitle").textContent = `${member.emoji || "👤"} ${member.name}`;
  $("workspacePanel").classList.remove("hidden");
  renderBreadcrumbs({
  nodes,
  currentParentId,
  goHome: () => {
    currentParentId = null;
    renderWorkspace();
  },
  goToNode: nodeId => {
    currentParentId = nodeId;
    renderWorkspace();
  }
});
  $("workspacePanel").scrollIntoView({ behavior: "smooth" });

  const list = $("folderList");
  const items = visibleNodes();

  if (!items.length) {
    list.innerHTML = `<p class="empty">Nothing here yet.</p>`;
    return;
  }

  list.innerHTML = items.map(node => `
    <div class="card member-card" data-node-id="${node.id}">
      <div class="member-info">
        <span class="avatar">
  ${
    node.type === "folder"
      ? "📁"
      : node.type === "event"
      ? "📅"
      : node.type === "note"
      ? "📝"
      : node.type === "checklist"
      ? "☑"
      : "✅"
  }
</span>
        <div>
          <strong>${node.title}</strong>

${
  node.notes
    ? `<p class="task-notes">${node.notes}</p>`
    : ""
}

<div class="meta-row">
  <span class="badge">${node.type}</span>
  ${node.done ? `<span class="badge done">✅ Done</span>` : ""}
  ${node.dueDate ? `<span class="badge date">📅 ${node.dueDate}</span>` : ""}
  ${node.priority ? `<span class="badge priority-${node.priority}">${node.priority}</span>` : ""}
</div>
        </div>
      </div>
      <div class="workspace-buttons">
  <label class="complete-checkbox">
  <input
    type="checkbox"
    data-complete-node="${node.id}"
    ${node.done ? "checked disabled" : ""}>
  <span>Complete</span>
  </label>

  <button
    class="danger"
    data-delete-node="${node.id}">
    Delete
  </button>
</div>
    </div>
  `).join("");

document.querySelectorAll("[data-node-id]").forEach(card => {
  card.onclick = event => {
    if (event.target.tagName === "BUTTON") return;

    selectedNode = nodes.find(node => node.id === card.dataset.nodeId);

    $("detailsTitle").value = selectedNode.title || "";
    $("detailsNotes").value = selectedNode.notes || "";
    $("detailsType").value = selectedNode.type || "";
    $("detailsDone").checked = selectedNode.done === true;
    $("detailsDueDate").value = selectedNode.dueDate || "";
    $("detailsEndDate").value = selectedNode.endDate || "";
    $("detailsPriority").value = selectedNode.priority || "";
    $("detailsRepeat").value = selectedNode.repeat || "none";
    $("detailsRepeatUntil").value = selectedNode.repeatUntil || "";

$("detailsRotationEnabled").checked =
  selectedNode.rotationEnabled === true;

renderRotationMembers(selectedNode.rotationMembers || []);
    $("detailsPanel").classList.remove("hidden");
    $("detailsPanel").scrollIntoView({ behavior: "smooth" });
    if (selectedNode.type === "folder") {
      currentParentId = selectedNode.id;
      renderWorkspace();
    }
  };
});
document.querySelectorAll("[data-complete-node]").forEach(checkbox => {
  checkbox.onchange = async event => {
    event.stopPropagation();

    const node = nodes.find(n => n.id === checkbox.dataset.completeNode);
    if (!node) return;

    await completeNodeFromList(node);
  };
});
  document.querySelectorAll("[data-delete-node]").forEach(button => {
    button.onclick = async event => {
  event.stopPropagation();

  if (!parentMode) {
    alert("Only a parent can delete items.");
    return;
  }

  if (confirm("Delete this item?")) {
    await deleteNode(button.dataset.deleteNode);
  }
};
  });
}

$("backToMembers").onclick = () => {
  if (currentParentId) {
    const current = nodes.find(node => node.id === currentParentId);
    currentParentId = current?.parentId || null;
    renderWorkspace();
    return;
  }

  $("workspacePanel").classList.add("hidden");
};

$("addItemBtn").onclick = async () => {

  if (!parentMode) {
    alert("Only a parent can add items.");
    return;
  }

  if (!selectedMemberId) {
    alert("Select a member first");
    return;
  }

  const result = await showAddDialog();
  if (!result) return;

  await addNode({
  title: result.title,
  type: result.type,
  notes: "",
  endDate: "",
  memberId: selectedMemberId,
  parentId: currentParentId,

  repeat: "none",
  repeatUntil: "",
  rotationEnabled: false,
  rotationMembers: [],
  rotationIndex: 0
});
}; 

$("memberForm").onsubmit = async event => {
  event.preventDefault();

  if (!parentMode) {
    alert("Only a parent can add members.");
    return;
  }

  await addMember({
    name: $("memberName").value,
    emoji: $("memberEmoji").value,
    role: $("memberRole").value
  });

  $("memberForm").reset();
  $("memberEmoji").value = "👤";
};
$("saveDetailsBtn").onclick = async () => {
  if (!selectedNode) return;
  if (!parentMode) {
  alert("Only a parent can edit items.");
  return;
}

  let newDueDate = $("detailsDueDate").value;
let newDone = $("detailsDone").checked;
const rotationMembers = Array.from(
  document.querySelectorAll("#rotationMembersList input:checked")
).map(input => input.value);
const wasJustCompleted =
  $("detailsDone").checked === true &&
  selectedNode.done !== true;

if (wasJustCompleted) {
  const updatedNode = {
    ...selectedNode,
    title: $("detailsTitle").value.trim(),
    dueDate: $("detailsDueDate").value,
    endDate: $("detailsEndDate").value,
    notes: $("detailsNotes").value.trim(),
    priority: $("detailsPriority").value,
    repeat: $("detailsRepeat").value,
    repeatUntil: $("detailsRepeatUntil").value,
    rotationEnabled: $("detailsRotationEnabled").checked,
    rotationMembers: rotationMembers
  };

  await completeTask(updatedNode, {
    source: "details"
  });

  selectedNode = null;
  $("detailsPanel").classList.add("hidden");
  return;
}
let newMemberId = selectedNode.memberId;
let newRotationIndex = selectedNode.rotationIndex || 0;

await updateNode(selectedNode.id, {
  title: $("detailsTitle").value.trim(),
  notes: $("detailsNotes").value.trim(),
  memberId: newMemberId,
  done: newDone,
  completedAt: $("detailsDone").checked
  ? selectedNode.completedAt || new Date().toISOString()
  : "",
  dueDate: newDueDate,
  endDate: $("detailsEndDate").value,
  priority: $("detailsPriority").value,
  repeat: $("detailsRepeat").value,
  repeatUntil: $("detailsRepeatUntil").value,
  rotationEnabled: $("detailsRotationEnabled").checked,
  rotationMembers: rotationMembers,
  rotationIndex: newRotationIndex
});

  selectedNode = null;
  $("detailsPanel").classList.add("hidden");
};
document.querySelectorAll("[data-dashboard-filter]").forEach(card => {
  card.onclick = () => {
    const filter = card.dataset.dashboardFilter;
    const results = $("dashboardResults");

    // Clicking the selected card closes it
    if (selectedDashboardFilter === filter) {
      selectedDashboardFilter = null;

      card.classList.remove("selected");
      results.classList.add("hidden");
      results.innerHTML = "";

      return;
    }

    selectedDashboardFilter = filter;

    document.querySelectorAll("[data-dashboard-filter]").forEach(otherCard => {
      otherCard.classList.remove("selected");
    });

    card.classList.add("selected");

    showDashboardResults(filter);
  };
});
watchMembers(newMembers => {
  members = newMembers;
  renderMembers();
  renderPendingMemberDropdown();
  $("syncStatus").textContent = "Online • synced";
});

watchNodes(newNodes => {
  nodes = newNodes;

updateDashboard();
renderCalendar();
updateGreeting();
updateTodaySummary();
updateParentDashboard();
updateParentActivity();
renderPendingMemberDropdown();
renderPendingTasksForSelectedMember();
runGlobalSearch();

if (selectedMemberId) renderWorkspace();
  $("syncStatus").textContent = "Online • synced";
});
watchActivity(newActivities => {
  activities = newActivities;
  updateParentActivity();
});
function dashboardItems(filter) {
  const today = new Date().toISOString().split("T")[0];

  return nodes.filter(n => {
    if (n.type !== "task" && n.type !== "event") return false;

    if (filter === "overdue") return !n.done && n.dueDate && n.dueDate < today;
    if (filter === "today") return !n.done && n.dueDate === today;
    if (filter === "upcoming") return !n.done && n.dueDate && n.dueDate > today;
    if (filter === "completed") return n.done;

    return false;
  });
}
function showDashboardResults(filter) {
  const items = dashboardItems(filter);
  const results = $("dashboardResults");

  if (items.length === 0) {
    results.innerHTML = `
      <h3>${filter.toUpperCase()}</h3>
      <p>No matching tasks.</p>
    `;
    results.classList.remove("hidden");
    return;
  }

  results.innerHTML = `
    <h3>${filter.toUpperCase()}</h3>

    ${items.map(item => `
      <div class="card dashboard-result-card" data-dashboard-node-id="${item.id}">

        <div class="dashboard-result-title">
          ✅ ${item.title}
        </div>

        <div class="meta-row">

  ${
    members.find(member => member.id === item.memberId)
      ? `<span class="badge">
          ${members.find(member => member.id === item.memberId).emoji || "👤"}
          ${members.find(member => member.id === item.memberId).name}
        </span>`
      : ""
  }

  ${
    item.dueDate
      ? `<span class="badge date">📅 ${item.dueDate}</span>`
      : `<span class="badge">No due date</span>`
  }

  ${
    item.priority
      ? `<span class="badge priority-${item.priority}">
          ${
            item.priority === "high"
              ? "🔴"
              : item.priority === "medium"
              ? "🟡"
              : "🟢"
          }
          ${item.priority}
        </span>`
      : ""
  }

  ${item.done ? `<span class="badge done">✅ Done</span>` : ""}

</div>

      </div>
    `).join("")}
  `;

  results.classList.remove("hidden");
  document.querySelectorAll("[data-dashboard-node-id]").forEach(card => {
  card.onclick = () => {
    const item = nodes.find(node => node.id === card.dataset.dashboardNodeId);
    if (!item) return;

    selectedMemberId = item.memberId;
    selectedNode = item;
    currentParentId = item.parentId || null;

    renderMembers();
    renderWorkspace();

    $("detailsTitle").value = item.title || "";
    $("detailsNotes").value = item.notes || "";
    $("detailsType").value = item.type || "";
    $("detailsDone").checked = item.done === true;
    $("detailsDueDate").value = item.dueDate || "";
    $("detailsEndDate").value = item.endDate || "";
    $("detailsPriority").value = item.priority || "";
    $("detailsRepeat").value = item.repeat || "none";
    $("detailsRepeatUntil").value = item.repeatUntil || "";
    $("detailsRotationEnabled").checked =
  item.rotationEnabled === true;

renderRotationMembers(item.rotationMembers || []);

    $("detailsPanel").classList.remove("hidden");
    $("detailsPanel").scrollIntoView({ behavior: "smooth" });
  };
});
}
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getNextRepeatDate(dateString, repeat) {
  if (!dateString || !repeat || repeat === "none") return null;

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (repeat === "daily") {
    date.setDate(date.getDate() + 1);
  } else if (repeat === "weekly") {
    date.setDate(date.getDate() + 7);
  } else if (repeat === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else if (repeat === "yearly") {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    return null;
  }

  return formatDateLocal(date);
}
async function completeTask(node, options = {}) {
  if (!node) return;

  const completedAt = new Date().toISOString();

  await addActivity({
    title: node.title,
    memberId: node.memberId,
    completedAt,
    originalType: node.type,
    recurring: node.repeat ? node.repeat !== "none" : false,
    repeat: node.repeat || "none",
    dueDate: node.dueDate || ""
  });

  let newDueDate = node.dueDate || "";
  let newDone = true;
  let newMemberId = node.memberId;
  let newRotationIndex = node.rotationIndex || 0;

  if (node.repeat && node.repeat !== "none") {
    const nextDate = getNextRepeatDate(newDueDate, node.repeat);

    if (nextDate && (!node.repeatUntil || nextDate <= node.repeatUntil)) {
      newDueDate = nextDate;
      newDone = false;

      if (
        node.rotationEnabled &&
        node.rotationMembers &&
        node.rotationMembers.length > 1
      ) {
        const currentIndex = node.rotationMembers.indexOf(node.memberId);

        newRotationIndex =
          currentIndex >= 0
            ? (currentIndex + 1) % node.rotationMembers.length
            : 0;

        newMemberId = node.rotationMembers[newRotationIndex];
      }
    }
  }

  await updateNode(node.id, {
  done: newDone,
  completedAt: newDone ? completedAt : "",
  dueDate: newDueDate,
  memberId: newMemberId,
  rotationIndex: newRotationIndex
});
selectedNode = null;
$("detailsPanel").classList.add("hidden");
}

async function completeNodeFromList(node) {
  await completeTask(node, {
    source: "workspace"
  });
}
function occursOnDate(item, dateString) {
  if (!item.dueDate) return false;

  if (item.type === "event" && item.endDate) {
    return dateString >= item.dueDate && dateString <= item.endDate;
  }

  return item.dueDate === dateString;
}
function eventBandClass(item, dateString) {
  if (item.type !== "event" || !item.endDate) return "";

  if (dateString === item.dueDate) return "event-band-start";
  if (dateString === item.endDate) return "event-band-end";

  return "event-band-middle";
}
function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  const monthName = calendarDate.toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  $("calendarTitle").textContent = monthName;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();

  const days = [
  `<div class="calendar-weekday">Sun</div>`,
  `<div class="calendar-weekday">Mon</div>`,
  `<div class="calendar-weekday">Tue</div>`,
  `<div class="calendar-weekday">Wed</div>`,
  `<div class="calendar-weekday">Thu</div>`,
  `<div class="calendar-weekday">Fri</div>`,
  `<div class="calendar-weekday">Sat</div>`
];

  for (let i = 0; i < startPadding; i++) {
    days.push(`<div class="calendar-day empty"></div>`);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const todayString = new Date().toISOString().split("T")[0];
const isToday = dateString === todayString;

    const tasksForDay = nodes.filter(node =>
  (node.type === "task" || node.type === "event") &&
  occursOnDate(node, dateString)
);

    days.push(`
      <div class="calendar-day ${isToday ? "today" : ""}" data-calendar-date="${dateString}">
        <strong>${day}</strong>

        ${tasksForDay.slice(0, 2).map(task => `
  <div class="calendar-task ${task.done ? "done" : task.priority || ""} ${eventBandClass(task, dateString)}">
    ${
      task.type === "event"
        ? "📅"
        : task.done
        ? "✅"
        : task.priority === "high"
        ? "🔴"
        : task.priority === "medium"
        ? "🟡"
        : task.priority === "low"
        ? "🟢"
        : "📌"
    }
    ${
  task.type === "event" && task.endDate && dateString !== task.dueDate
    ? ""
    : task.title
}
  </div>
`).join("")}

${
  tasksForDay.length > 2
    ? `<div class="calendar-more" data-calendar-date="${dateString}">
         +${tasksForDay.length - 2} more...
       </div>`
    : ""
}
      </div>
    `);
  }
while (days.length < 49) {
  days.push(`<div class="calendar-day empty"></div>`);
}
  $("calendarGrid").innerHTML = days.join("");
  document.querySelectorAll("[data-calendar-date]").forEach(dayCell => {
  dayCell.onclick = () => {
    showCalendarDay(dayCell.dataset.calendarDate);
  };
});
document.querySelectorAll(".calendar-more").forEach(link => {
  link.onclick = event => {
    event.stopPropagation();
    showCalendarDay(link.dataset.calendarDate);
  };
});
}

$("prevMonthBtn").onclick = () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
};

$("nextMonthBtn").onclick = () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
};
function showCalendarDay(dateString) {
  const panel = $("calendarDayPanel");
  const title = $("calendarDayTitle");
  const taskList = $("calendarDayTasks");

  const selectedDate = new Date(dateString + "T00:00:00");

  title.textContent = selectedDate.toLocaleDateString("default", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const itemsForDay = nodes.filter(node =>
    (node.type === "task" || node.type === "event") &&
    occursOnDate(node, dateString)
  );

  if (!itemsForDay.length) {
    taskList.innerHTML = `<p>No tasks or events due on this day.</p>`;
    panel.classList.remove("hidden");
    panel.scrollIntoView({ behavior: "smooth" });
    return;
  }

  taskList.innerHTML = itemsForDay.map(item => {
    const member = members.find(m => m.id === item.memberId);

    return `
      <div class="calendar-day-task" data-calendar-task-id="${item.id}">
        <strong>
          ${
            item.type === "event"
              ? "📅"
              : item.done
              ? "✅"
              : item.priority === "high"
              ? "🔴"
              : item.priority === "medium"
              ? "🟡"
              : item.priority === "low"
              ? "🟢"
              : "📌"
          }
          ${item.title}
        </strong>

        <div class="meta-row">
          <span class="badge">
            ${member ? `${member.emoji || "👤"} ${member.name}` : "Unknown"}
          </span>

          ${
            item.repeat && item.repeat !== "none"
              ? `<span class="badge">🔁 ${item.repeat}</span>`
              : ""
          }

          ${
            item.rotationEnabled
              ? `<span class="badge">🔄 Rotating</span>`
              : ""
          }
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll("[data-calendar-task-id]").forEach(card => {
    card.onclick = () => {
      const item = nodes.find(node => node.id === card.dataset.calendarTaskId);
      if (!item) return;

      selectedMemberId = item.memberId;
      selectedNode = item;
      currentParentId = item.parentId || null;

      renderMembers();
      renderWorkspace();

      $("detailsTitle").value = item.title || "";
      $("detailsNotes").value = item.notes || "";
      $("detailsType").value = item.type || "";
      $("detailsDone").checked = item.done === true;
      $("detailsDueDate").value = item.dueDate || "";
      $("detailsEndDate").value = item.endDate || "";
      $("detailsPriority").value = item.priority || "";
      $("detailsRepeat").value = item.repeat || "none";
      $("detailsRepeatUntil").value = item.repeatUntil || "";
      $("detailsRotationEnabled").checked = item.rotationEnabled === true;

      renderRotationMembers(item.rotationMembers || []);

      $("detailsPanel").classList.remove("hidden");
      $("detailsPanel").scrollIntoView({ behavior: "smooth" });
    };
  });

  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth" });
}
function updateGreeting() {
  const hour = new Date().getHours();

  let greeting = "Good evening";

  if (hour < 12) {
    greeting = "Good morning";
  } else if (hour < 18) {
    greeting = "Good afternoon";
  }

  $("homeGreeting").textContent = `${greeting} 👋`;
}
function updateTodaySummary() {
  const today = new Date();
  const todayString = today.toISOString().split("T")[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowString = tomorrow.toISOString().split("T")[0];

  const relevantItems = nodes.filter(node =>
    node.type === "task" || node.type === "event"
  );

  $("todayOverdue").textContent = relevantItems.filter(item =>
    !item.done &&
    item.dueDate &&
    item.dueDate < todayString
  ).length;

  $("todayDue").textContent = relevantItems.filter(item =>
    !item.done &&
    item.dueDate === todayString
  ).length;

  $("tomorrowDue").textContent = relevantItems.filter(item =>
    !item.done &&
    item.dueDate === tomorrowString
  ).length;

  const todayItems = relevantItems.filter(item =>
    !item.done &&
    item.dueDate === todayString
  );

  const list = $("todayItemsList");

  if (!todayItems.length) {
    list.innerHTML = `
      <p>🎉 Nothing due today. Enjoy your day!</p>
    `;
    return;
  }

  list.innerHTML = todayItems.map(item => {
    const member = members.find(m => m.id === item.memberId);

    return `
      <div class="today-item">
        <div>
          <div class="today-item-title">
            ${item.type === "event" ? "📅" : "📌"} ${item.title}
          </div>

          <div class="today-item-owner">
            ${member ? `${member.emoji || "👤"} ${member.name}` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function runGlobalSearch() {
  const input = $("globalSearchInput");
  const results = $("searchResults");

  const query = input.value.trim().toLowerCase();

  if (!query) {
    results.classList.add("hidden");
    results.innerHTML = "";
    return;
  }

  const matches = nodes.filter(node => {
  const member = members.find(m => m.id === node.memberId);
  const parent = nodes.find(n => n.id === node.parentId);

  const searchableText = [
    node.title,
    node.type,
    node.priority,
    node.dueDate,
    member?.name,
    member?.emoji,
    parent?.title
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
});

  if (!matches.length) {
    results.innerHTML = `
      <div class="search-result">
        No results found.
      </div>
    `;
    results.classList.remove("hidden");
    return;
  }

  results.innerHTML = matches.map(item => {
  const member = members.find(m => m.id === item.memberId);

  const parent =
    nodes.find(n => n.id === item.parentId);

  return `
    <div class="search-result" data-search-id="${item.id}">

      <div class="search-title">
        ${
          item.type === "folder"
            ? "📁"
            : item.type === "task"
            ? "📌"
            : item.type === "event"
            ? "📅"
            : item.type === "note"
            ? "📝"
            : "☑"
        }

        ${item.title}
      </div>

      <div class="search-meta">

        ${
          member
            ? `${member.emoji || "👤"} ${member.name}`
            : ""
        }

        ${
          parent
            ? ` • 📁 ${parent.title}`
            : ""
        }

        • ${item.type}

      </div>

    </div>
  `;
}).join("");

  results.classList.remove("hidden");
  document.querySelectorAll("[data-search-id]").forEach(card => {
  card.onclick = () => {
    const item = nodes.find(node => node.id === card.dataset.searchId);
    if (!item) return;

    selectedMemberId = item.memberId;
    selectedNode = item;
    currentParentId = item.parentId || null;

    renderMembers();
    renderWorkspace();

    $("detailsTitle").value = item.title || "";
    $("detailsNotes").value = item.notes || "";
    $("detailsType").value = item.type || "";
    $("detailsDone").checked = item.done === true;
    $("detailsDueDate").value = item.dueDate || "";
    $("detailsEndDate").value = item.endDate || "";
    $("detailsPriority").value = item.priority || "";
    $("detailsRepeat").value = item.repeat || "none";
    $("detailsRepeatUntil").value = item.repeatUntil || "";
    $("detailsRotationEnabled").checked =
  item.rotationEnabled === true;

renderRotationMembers(item.rotationMembers || []);

    $("detailsPanel").classList.remove("hidden");
    $("detailsPanel").scrollIntoView({ behavior: "smooth" });
  };
});
}
const searchInput = $("globalSearchInput");

if (searchInput) {
  searchInput.oninput = runGlobalSearch;
}
function updateParentModeButton() {
  $("parentModeBtn").textContent = parentMode
    ? "🔓 Parent mode on"
    : "🔒 Child mode on";

  $("parentDashboardPanel").classList.toggle(
    "hidden",
    !parentMode
  );
}

$("parentModeBtn").onclick = () => {
  if (parentMode) {
    parentMode = false;
    updateParentModeButton();
    return;
  }
  


  const enteredPin = prompt("Enter parent PIN");

  if (enteredPin === parentPin) {
    parentMode = true;
    updateParentModeButton();
  } else {
    alert("Incorrect PIN");
  }
};

updateParentModeButton();
function renderRotationMembers(selectedIds = []) {
  const list = $("rotationMembersList");

  list.innerHTML = members.map(member => `
    <label class="rotation-member">
      <input
        type="checkbox"
        value="${member.id}"
        ${selectedIds.includes(member.id) ? "checked" : ""}
      >
      ${member.emoji || "👤"} ${member.name}
    </label>
  `).join("");
}
function updateParentDashboard() {
  if (!$("parentIncompleteCount")) return;
  const today = new Date().toISOString().split("T")[0];

  const items = nodes.filter(node =>
    node.type === "task" || node.type === "event"
  );

  $("parentIncompleteCount").textContent =
    items.filter(item => !item.done).length;

  $("parentCompletedCount").textContent =
    items.filter(item => item.done).length;

  $("parentOverdueCount").textContent =
    items.filter(item =>
      !item.done &&
      item.dueDate &&
      item.dueDate < today
    ).length;

  $("parentRecurringCount").textContent =
    items.filter(item =>
      item.repeat &&
      item.repeat !== "none"
    ).length;

  $("parentRotatingCount").textContent =
    items.filter(item =>
      item.rotationEnabled
    ).length;
}
$("parentCompletedCard").onclick = () => {
  const list = $("parentCompletedList");

  const completedItems = nodes.filter(node =>
    (node.type === "task" || node.type === "event") &&
    node.done
  );

  if (!completedItems.length) {
    list.innerHTML = "<p>No completed tasks.</p>";
  } else {
    list.innerHTML = `
      <h3>Completed Tasks</h3>

      ${completedItems.map(item => {
        const member = members.find(m => m.id === item.memberId);

        return `
          <div class="card dashboard-result-card">
            <strong>✅ ${item.title}</strong>

            <div class="meta-row">
              <span class="badge">
                ${member ? `${member.emoji || "👤"} ${member.name}` : "Unknown"}
              </span>

              ${item.dueDate ? `<span class="badge date">📅 ${item.dueDate}</span>` : ""}

              ${
                item.completedAt
                  ? `<span class="badge">✅ Completed ${new Date(item.completedAt).toLocaleDateString()}</span>`
                  : ""
              }

              <span class="badge">${item.type}</span>
            </div>
          </div>
        `;
      }).join("")}
    `;
  }

  list.classList.toggle("hidden");
};
function updateParentActivity() {
  const activityList = $("parentActivityList");
  if (!activityList) return;

  const recentActivities = activities.slice(0, 10);

  if (!recentActivities.length) {
    activityList.innerHTML = `
      <h3>📜 Recent Activity</h3>
      <p>No activity yet.</p>
    `;
    return;
  }

  activityList.innerHTML = `
    <h3>📜 Recent Activity</h3>

    ${recentActivities.map(item => {
      const member = members.find(m => m.id === item.memberId);

      return `
        <div class="card dashboard-result-card">
          <strong>✅ ${item.title}</strong>

          <div class="meta-row">
            <span class="badge">
              ${member ? `${member.emoji || "👤"} ${member.name}` : "Unknown"}
            </span>

            <span class="badge">
              ${item.recurring ? "🔁 Recurring" : "📌 One-off"}
            </span>

            ${
              item.completedAt
                ? `<span class="badge">🕒 ${new Date(item.completedAt).toLocaleString()}</span>`
                : ""
            }
          </div>

          <button
            class="danger"
            data-delete-activity="${item.id}"
            type="button">
            🗑 Delete
          </button>
        </div>
      `;
    }).join("")}
  `;

  document.querySelectorAll("[data-delete-activity]").forEach(button => {
    button.onclick = async () => {
      if (!confirm("Delete this activity item?")) return;

      await deleteActivity(button.dataset.deleteActivity);
    };
  });
}

function showParentCentreResults(title, items) {
  const results = $("parentCentreResults");

  if (!items.length) {
    results.innerHTML = `<h3>${title}</h3><p>No matching items.</p>`;
    results.classList.remove("hidden");
    return;
  }

  results.innerHTML = `
    <h3>${title}</h3>
    ${items.map(item => {
      const member = members.find(m => m.id === item.memberId);

      return `
        <div class="card dashboard-result-card">
          <strong>${item.title}</strong>
          <div class="meta-row">
            <span class="badge">${member ? `${member.emoji || "👤"} ${member.name}` : "Unknown"}</span>
            ${item.dueDate ? `<span class="badge date">📅 ${item.dueDate}</span>` : ""}
            ${item.priority ? `<span class="badge priority-${item.priority}">${item.priority}</span>` : ""}
            ${item.repeat && item.repeat !== "none" ? `<span class="badge">🔁 ${item.repeat}</span>` : ""}
            ${item.rotationEnabled ? `<span class="badge">🔄 Rotating</span>` : ""}
          </div>
        </div>
      `;
    }).join("")}
  `;

  results.classList.remove("hidden");
}

$("parentIncompleteCard").onclick = () => {
  showParentCentreResults(
    "📌 Incomplete Items",
    nodes.filter(item =>
      (item.type === "task" || item.type === "event") &&
      !item.done
    )
  );
};

$("parentOverdueCard").onclick = () => {
  const today = new Date().toISOString().split("T")[0];

  showParentCentreResults(
    "🔴 Overdue Items",
    nodes.filter(item =>
      (item.type === "task" || item.type === "event") &&
      !item.done &&
      item.dueDate &&
      item.dueDate < today
    )
  );
};

$("parentRecurringCard").onclick = () => {
  showParentCentreResults(
    "🔁 Recurring Items",
    nodes.filter(item =>
      (item.type === "task" || item.type === "event") &&
      item.repeat &&
      item.repeat !== "none"
    )
  );
};

$("parentRotatingCard").onclick = () => {
  showParentCentreResults(
    "🔄 Rotating Items",
    nodes.filter(item =>
      (item.type === "task" || item.type === "event") &&
      item.rotationEnabled
    )
  );
};
function renderPendingMemberDropdown() {
  const select = $("pendingMemberSelect");
  if (!select) return;

  if (!members.length) {
    select.innerHTML = `<option value="">Members loading...</option>`;
    return;
  }

  const currentValue = select.value;

  select.innerHTML = `
    <option value="">Select member</option>
    ${members.map(member => `
      <option value="${member.id}">
        ${member.emoji || "👤"} ${member.name}
      </option>
    `).join("")}
  `;

  if (currentValue) {
    select.value = currentValue;
  }

  select.onchange = () => {
    renderPendingTasksForSelectedMember();
  };
}
function renderPendingTasksForSelectedMember() {
  const select = $("pendingMemberSelect");
  const list = $("pendingTasksList");

  if (!select || !list) return;

  const memberId = select.value;
  const today = new Date().toISOString().split("T")[0];

  if (!memberId) {
    list.innerHTML = "<p>Select a member to view pending tasks.</p>";
    return;
  }

  const allTasks = nodes
    .filter(node =>
      node.memberId === memberId &&
      node.type === "task" &&
      !node.done
    )
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  const overdueTasks = allTasks.filter(task =>
    task.dueDate && task.dueDate < today
  );

  const pendingTasks = allTasks.filter(task =>
    !task.dueDate || task.dueDate >= today
  );

  if (!allTasks.length) {
    list.innerHTML = "<p>🎉 No pending or overdue tasks.</p>";
    return;
  }

  function taskCard(task) {
    return `
      <div class="card dashboard-result-card">
        <strong>
${
  task.priority === "high"
    ? "🔴"
    : task.priority === "medium"
    ? "🟡"
    : task.priority === "low"
    ? "🟢"
    : "⚫"
}
${task.title}
</strong>
${
  task.notes
    ? `<p class="task-notes">${task.notes}</p>`
    : ""
}
        <div class="meta-row">
          ${task.dueDate ? `<span class="badge date">📅 ${task.dueDate}</span>` : `<span class="badge">No date</span>`}
          ${task.priority ? `<span class="badge priority-${task.priority}">${task.priority}</span>` : ""}
          ${task.repeat && task.repeat !== "none" ? `<span class="badge">🔁 ${task.repeat}</span>` : ""}
          ${task.rotationEnabled ? `<span class="badge">🔄 Rotating</span>` : ""}
        </div>
      </div>
    `;
  }

  list.innerHTML = `
    ${overdueTasks.length ? `<h3>🔴 Overdue</h3>${overdueTasks.map(taskCard).join("")}` : ""}
    ${pendingTasks.length ? `<h3>📌 Pending</h3>${pendingTasks.map(taskCard).join("")}` : ""}
  `;
}