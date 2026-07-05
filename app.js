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

let newMemberId = selectedNode.memberId;
let newRotationIndex = selectedNode.rotationIndex || 0;

if (
  $("detailsRepeat").value &&
  $("detailsRepeat").value !== "none" &&
  selectedNode.done !== true &&
  newDone === true
) {
  const nextDate = getNextRepeatDate(newDueDate, $("detailsRepeat").value);

  if (nextDate && (!$("detailsRepeatUntil").value || nextDate <= $("detailsRepeatUntil").value)) {
  newDueDate = nextDate;
  newDone = false;

  if (
    $("detailsRotationEnabled").checked &&
    rotationMembers.length > 1
  ) {
    const currentIndex = rotationMembers.indexOf(selectedNode.memberId);
    newRotationIndex =
      currentIndex >= 0
        ? (currentIndex + 1) % rotationMembers.length
        : 0;

    newMemberId = rotationMembers[newRotationIndex];
  }
}

}
const wasJustCompleted =
  $("detailsDone").checked === true &&
  selectedNode.done !== true;

let completedAt = selectedNode.completedAt || "";

if (wasJustCompleted) {
  console.log("Writing activity", $("detailsTitle").value.trim());

  completedAt = new Date().toISOString();

  await addActivity({
    title: $("detailsTitle").value.trim(),
    memberId: selectedNode.memberId,
    completedAt: completedAt,
    originalType: selectedNode.type,
    recurring: $("detailsRepeat").value !== "none",
    repeat: $("detailsRepeat").value,
    dueDate: $("detailsDueDate").value
  });
}

if (newDone === false) {
  completedAt = "";
}
await updateNode(selectedNode.id, {
  title: $("detailsTitle").value.trim(),
  memberId: newMemberId,
  done: newDone,
  completedAt: completedAt,
  dueDate: newDueDate,
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
    $("detailsType").value = item.type || "";
    $("detailsDone").checked = item.done === true;
    $("detailsDueDate").value = item.dueDate || "";
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
function getNextRepeatDate(dateString, repeat) {
  if (!dateString || !repeat || repeat === "none") return null;

  const date = new Date(dateString + "T00:00:00");

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

  return date.toISOString().split("T")[0];
}
function occursOnDate(item, dateString) {
  if (!item.dueDate) return false;

  return item.dueDate === dateString;
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
  <div class="calendar-task ${task.done ? "done" : task.priority || ""}">
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
    ${task.title}
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

  const memberGroups = members
    .map(member => ({
      member,
      items: itemsForDay.filter(item => item.memberId === member.id)
    }))
    .filter(group => group.items.length > 0);

  taskList.innerHTML = memberGroups.map(group => `
    <div class="calendar-member-group">
      <button class="calendar-member-summary" type="button" data-calendar-member-id="${group.member.id}">
        ▶ ${group.member.emoji || "👤"} ${group.member.name} (${group.items.length})
      </button>

      <div class="calendar-member-items hidden" id="calendar-member-${group.member.id}">
        ${group.items.map(item => `
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
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  document.querySelectorAll("[data-calendar-member-id]").forEach(button => {
    button.onclick = () => {
      const memberId = button.dataset.calendarMemberId;
      const itemBox = document.getElementById(`calendar-member-${memberId}`);

      itemBox.classList.toggle("hidden");

      button.classList.toggle("expanded", !itemBox.classList.contains("hidden"));

      button.textContent = itemBox.classList.contains("hidden")
        ? button.textContent.replace("▼", "▶")
        : button.textContent.replace("▶", "▼");
    };
  });

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
      $("detailsType").value = item.type || "";
      $("detailsDone").checked = item.done === true;
      $("detailsDueDate").value = item.dueDate || "";
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
    $("detailsType").value = item.type || "";
    $("detailsDone").checked = item.done === true;
    $("detailsDueDate").value = item.dueDate || "";
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