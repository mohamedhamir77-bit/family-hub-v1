import { watchMembers, addMember, deleteMember } from "./members.js";
import { watchNodes, addNode, deleteNode, updateNode } from "./nodes.js";
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
      if (confirm("Delete this member?")) {
        await deleteMember(button.dataset.delete);
      }
    };
  });
}

function renderWorkspace() {
  const member = currentMember();

  if (!member) return;

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
        <span class="avatar">${node.type === "folder" ? "📁" : "✅"}</span>
        <div>
          <strong>${node.title}</strong>
<div class="meta-row">
  <span class="badge">${node.type}</span>
  ${node.done ? `<span class="badge done">✅ Done</span>` : ""}
  ${node.dueDate ? `<span class="badge date">📅 ${node.dueDate}</span>` : ""}
  ${node.priority ? `<span class="badge priority-${node.priority}">${node.priority}</span>` : ""}
</div>
        </div>
      </div>
      <button class="danger" data-delete-node="${node.id}">Delete</button>
    </div>
  `).join("");

document.querySelectorAll("[data-node-id]").forEach(card => {
  card.onclick = event => {
    if (event.target.tagName === "BUTTON") return;

    selectedNode = nodes.find(node => node.id === card.dataset.nodeId);

    $("detailsTitle").value = selectedNode.title || "";
    $("detailsType").value = selectedNode.type || "";
    $("detailsDone").checked = selectedNode.done === true;
    $("detailsDueDate").value = selectedNode.dueDate || "";
    $("detailsPriority").value = selectedNode.priority || "";
    $("detailsPanel").classList.remove("hidden");
    $("detailsPanel").scrollIntoView({ behavior: "smooth" });
    if (selectedNode.type === "folder") {
      currentParentId = selectedNode.id;
      renderWorkspace();
    }
  };
});

  document.querySelectorAll("[data-delete-node]").forEach(button => {
    button.onclick = async event => {
      event.stopPropagation();
      if (confirm("Delete this folder?")) {
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
  if (!selectedMemberId) {
    alert("Select a member first");
    return;
  }

  const result = await showAddDialog();
  if (!result) return;

  await addNode({
    title: result.title,
    type: result.type,
    memberId: selectedMemberId,
    parentId: currentParentId
  });
};

$("memberForm").onsubmit = async event => {
  event.preventDefault();

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

  await updateNode(selectedNode.id, {
  title: $("detailsTitle").value.trim(),
  done: $("detailsDone").checked,
  dueDate: $("detailsDueDate").value,
  priority: $("detailsPriority").value
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
  $("syncStatus").textContent = "Online • synced";
});

watchNodes(newNodes => {
  nodes = newNodes;

  updateDashboard();
renderCalendar();

if (selectedMemberId) renderWorkspace();
  $("syncStatus").textContent = "Online • synced";
});
function dashboardItems(filter) {
  const today = new Date().toISOString().split("T")[0];

  return nodes.filter(n => {
    if (n.type !== "task") return false;

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
      node.type === "task" &&
      node.dueDate === dateString
    );

    days.push(`
      <div class="calendar-day ${isToday ? "today" : ""}">
        <strong>${day}</strong>

        ${tasksForDay.map(task => `
  <div class="calendar-task ${task.done ? "done" : task.priority || ""}">
    ${
      task.done
        ? "✅"
        : task.priority === "high"
        ? "🔴"
        : task.priority === "medium"
        ? "🟡"
        : task.priority === "low"
        ? "🟢"
        : "📌"
    }
    ${task.title}
  </div>
`).join("")}
      </div>
    `);
  }
while (days.length < 49) {
  days.push(`<div class="calendar-day empty"></div>`);
}
  $("calendarGrid").innerHTML = days.join("");
}

$("prevMonthBtn").onclick = () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
};

$("nextMonthBtn").onclick = () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
};