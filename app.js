import { watchMembers, addMember, deleteMember } from "./members.js";
import { watchNodes, addNode, deleteNode } from "./nodes.js";
import { testWorkspaceModule } from "./workspace.js";

testWorkspaceModule();

const $ = id => document.getElementById(id);

let members = [];
let nodes = [];
let selectedMemberId = null;
let currentParentId = null;

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
          <small>${node.type}</small>
        </div>
      </div>
      <button class="danger" data-delete-node="${node.id}">Delete</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-node-id]").forEach(card => {
    card.onclick = event => {
      if (event.target.tagName === "BUTTON") return;
      currentParentId = card.dataset.nodeId;
      renderWorkspace();
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

$("addFolderBtn").onclick = async () => {
  if (!selectedMemberId) {
    alert("Select a member first");
    return;
  }

  const title = prompt("Folder name");
  if (!title) return;

  await addNode({
    title,
    type: "folder",
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

watchMembers(newMembers => {
  members = newMembers;
  renderMembers();
  $("syncStatus").textContent = "Online • synced";
});

watchNodes(newNodes => {
  nodes = newNodes;
  if (selectedMemberId) renderWorkspace();
  $("syncStatus").textContent = "Online • synced";
});