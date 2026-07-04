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
let parentMode = false;
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
    parentId: currentParentId
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
updateGreeting();
updateTodaySummary();
runGlobalSearch();

if (selectedMemberId) renderWorkspace();
  $("syncStatus").textContent = "Online • synced";
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

    $("detailsPanel").classList.remove("hidden");
    $("detailsPanel").scrollIntoView({ behavior: "smooth" });
  };
});

  
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
  node.dueDate === dateString
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
    node.dueDate === dateString
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

    $("detailsPanel").classList.remove("hidden");
    $("detailsPanel").scrollIntoView({ behavior: "smooth" });
  };
});
}
const searchInput = $("globalSearchInput");

if (searchInput) {
  searchInput.oninput = runGlobalSearch;
}
$("parentModeBtn").onclick = () => {
  if (parentMode) {
    parentMode = false;
    $("parentModeBtn").textContent = "🔒 Parent mode";
    return;
  }

  const enteredPin = prompt("Enter parent PIN");

  if (enteredPin === parentPin) {
    parentMode = true;
    $("parentModeBtn").textContent = "🔓 Parent mode on";
  } else {
    alert("Incorrect PIN");
  }
};