import { db } from "./firebase.js";
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const memberId = params.get("member");

const titleEl = document.getElementById("memberFeedTitle");
const subtitleEl = document.getElementById("memberFeedSubtitle");

const overdueFeed = document.getElementById("overdueFeed");
const todayFeed = document.getElementById("todayFeed");
const upcomingFeed = document.getElementById("upcomingFeed");

let members = [];
let nodes = [];

if (!memberId) {
  titleEl.textContent = "Member not selected";
  subtitleEl.textContent = "Add ?member=MEMBER_ID to the URL.";
}

function startFeed() {
  onSnapshot(collection(db, "v1_members"), snapshot => {
    members = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    renderFeed();
  });

  onSnapshot(collection(db, "v1_nodes"), snapshot => {
    nodes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    renderFeed();
  });
}

function renderFeed() {
  if (!memberId || members.length === 0) return;

  const member = members.find(m => m.id === memberId);

  if (!member) {
    titleEl.textContent = "Member not found";
    subtitleEl.textContent = "Check the member link.";
    return;
  }

  titleEl.textContent = `${member.emoji || "👤"} ${member.name}'s Tasks`;
  subtitleEl.textContent = "Here is what needs doing.";

  const tasks = nodes.filter(node => {
    if (node.type !== "task") return false;
    if (node.completed) return false;

    return (
      node.assignedTo === memberId ||
      node.assignedMemberId === memberId ||
      node.memberId === memberId ||
      node.assigneeId === memberId ||
      Array.isArray(node.assignedMembers) && node.assignedMembers.includes(memberId)
    );
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const overdue = [];
  const dueToday = [];
  const upcoming = [];

  tasks.forEach(task => {
    const dueDate = getDueDate(task);

    if (!dueDate) {
      upcoming.push(task);
      return;
    }

    const cleanDueDate = new Date(dueDate);
    cleanDueDate.setHours(0, 0, 0, 0);

    if (cleanDueDate < today) {
      overdue.push(task);
    } else if (cleanDueDate.getTime() === today.getTime()) {
      dueToday.push(task);
    } else {
      upcoming.push(task);
    }
  });

  renderList(overdueFeed, overdue, "Nothing overdue 🎉");
  renderList(todayFeed, dueToday, "Nothing due today");
  renderList(upcomingFeed, upcoming, "Nothing upcoming");
}

function renderList(container, tasks, emptyMessage) {
  container.innerHTML = "";

  if (tasks.length === 0) {
    container.innerHTML = `<p class="feed-empty">${emptyMessage}</p>`;
    return;
  }

  tasks.forEach(task => {
    const card = document.createElement("article");
    card.className = "feed-task-card";

    const dueText = getDueText(task);

    card.innerHTML = `
      <h3>${escapeHtml(task.title || "Untitled task")}</h3>
      <p>${dueText}</p>
      ${task.priority ? `<span class="feed-priority">${escapeHtml(task.priority)}</span>` : ""}
    `;

    container.appendChild(card);
  });
}

function getDueDate(task) {
  if (!task.dueDate) return null;

  if (typeof task.dueDate === "string") {
    return new Date(task.dueDate);
  }

  if (task.dueDate.toDate) {
    return task.dueDate.toDate();
  }

  return null;
}

function getDueText(task) {
  const dueDate = getDueDate(task);

  if (!dueDate) return "No due date";

  return `Due ${dueDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  })}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

startFeed();