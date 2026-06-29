import { watchMembers, addMember, deleteMember } from "./members.js";

const $ = id => document.getElementById(id);

let members = [];

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

      const member = members.find(m => m.id === card.dataset.memberId);

      $("workspaceTitle").textContent = `${member.emoji || "👤"} ${member.name}`;
      $("workspacePanel").classList.remove("hidden");
      $("workspacePanel").scrollIntoView({ behavior: "smooth" });
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

$("backToMembers").onclick = () => {
  $("workspacePanel").classList.add("hidden");
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