import { watchMembers, addMember, deleteMember } from "./members.js";
import { watchNodes, addNode, deleteNode } from "./nodes.js";

const $ = id => document.getElementById(id);

let members = [];
let nodes = [];
let selectedMemberId = null;
let currentParentId = null;

function setStatus(text) {
  $("syncStatus").textContent = text;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));
}

function renderMembers() {
  const list = $("membersList");

  if (!members.length) {
    list.innerHTML = `<p class="empty">No members yet.</p>`;
    return;
  }

  list.innerHTML = members.map(member => `
    <div class="card member-card">
      <button class="member-open" type="button" data-open-member="${member.id}">
        <span class="avatar">${escapeHtml(member.emoji || "👤")}</span>
        <span>
          <strong>${escapeHtml(member.name)}</strong>
          <small>${escapeHtml(member.role || "member")}</small>
        </span>
      </button>
      <button class="danger" type="button" data-delete-member="${member.id}">Delete</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-open-member]").forEach(button => {
    button.onclick = () => openWorkspace(button.dataset.openMember);
  });

  document.querySelectorAll("[data-delete-member]").forEach(button => {
    button.onclick = async () => {
      if (confirm("Delete this member?")) {
        await deleteMember(button.dataset.deleteMember);
        if (selectedMemberId === button.dataset.deleteMember) closeWorkspace();
      }
    };
  });
}

function memberNodes() {
  return nodes.filter(node =>
    node.memberId === selectedMemberId &&
    (node.parentId || null) === (currentParentId || null)
  );
}

function renderWorkspace() {
  if (!selectedMemberId) return;

  const member = members.find(item => item.id === selectedMemberId);
  if (!member) return;

  $("workspaceTitle").textContent = `${member.emoji || "👤"} ${member.name}`;

  const children = memberNodes();
  const folderList = $("folderList");

  if (!children.length) {
    folderList.innerHTML = `<p class="empty">Nothing here yet.</p>`;
    return;
  }

  folderList.innerHTML = children.map(node => `
    <div class="card node-card">
      <button class="node-open" type="button" data-open-node="${node.id}">
        <span class="avatar">${node.type === "task" ? "✅" : node.type === "note" ? "📝" : "📁"}</span>
        <span>
          <strong>${escapeHtml(node.title)}</strong>
          <small>${escapeHtml(node.type || "folder")}</small>
        </span>
      </button>
      <button class="danger" type="button" data-delete-node="${node.id}">Delete</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-open-node]").forEach(button => {
    button.onclick = () => {
      currentParentId = button.dataset.openNode;
      renderWorkspace();
    };
  });

  document.querySelectorAll("[data-delete-node]").forEach(button => {
    button.onclick = async () => {
      if (confirm("Delete this folder?")) {
        await deleteNode(button.dataset.deleteNode);
      }
    };
  });
}

function openWorkspace(memberId) {
  selectedMemberId = memberId;
  currentParentId = null;
  $("workspacePanel").classList.remove("hidden");
  renderWorkspace();
  $("workspacePanel").scrollIntoView({ behavior: "smooth" });
}

function closeWorkspace() {
  selectedMemberId = null;
  currentParentId = null;
  $("workspacePanel").classList.add("hidden");
}

$("backToMembers").onclick = closeWorkspace;

$("memberForm").onsubmit = async event => {
  event.preventDefault();
  try {
    await addMember({
      name: $("memberName").value,
      emoji: $("memberEmoji").value,
      role: $("memberRole").value
    });
    $("memberForm").reset();
    $("memberEmoji").value = "👤";
  } catch (error) {
    alert(error.message);
  }
};

$("addFolderBtn").onclick = async () => {
  if (!selectedMemberId) {
    alert("Select a member first.");
    return;
  }

  const title = prompt("Folder name");
  if (!title) return;

  try {
    await addNode({
      title,
      type: "folder",
      memberId: selectedMemberId,
      parentId: currentParentId
    });
  } catch (error) {
    alert(error.message);
  }
};

watchMembers(
  newMembers => {
    members = newMembers;
    renderMembers();
    renderWorkspace();
    setStatus("Online • synced");
  },
  error => setStatus(`Firebase error: ${error.message}`)
);

watchNodes(
  newNodes => {
    nodes = newNodes;
    renderWorkspace();
    setStatus("Online • synced");
  },
  error => setStatus(`Firebase error: ${error.message}`)
);
