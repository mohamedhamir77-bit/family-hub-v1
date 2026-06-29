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
    <div class="card member-card">
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

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.onclick = async () => {
      await deleteMember(button.dataset.delete);
    };
  });
}

$("memberForm").onsubmit = async event => {
  event.preventDefault();

  const name = $("memberName").value;
  const emoji = $("memberEmoji").value;
  const role = $("memberRole").value;

  await addMember({ name, emoji, role });

  $("memberForm").reset();
  $("memberEmoji").value = "👤";
};

watchMembers(newMembers => {
  members = newMembers;
  renderMembers();
  $("syncStatus").textContent = "Online • synced";
});