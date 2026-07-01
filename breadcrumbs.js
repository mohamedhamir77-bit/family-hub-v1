const $ = id => document.getElementById(id);

export function buildBreadcrumbs(nodes, currentParentId) {
  const crumbs = [];
  let current = nodes.find(node => node.id === currentParentId);

  while (current) {
    crumbs.unshift(current);
    current = nodes.find(node => node.id === current.parentId);
  }

  return crumbs;
}

export function renderBreadcrumbs({ nodes, currentParentId, goHome, goToNode }) {
  const crumbs = buildBreadcrumbs(nodes, currentParentId);

  $("breadcrumb").innerHTML = `
    <button class="ghost" data-home>🏠 Home</button>
    ${crumbs.map(crumb => `
      <span>›</span>
      <button class="ghost" data-crumb="${crumb.id}">${crumb.title}</button>
    `).join("")}
  `;

  document.querySelector("[data-home]").onclick = goHome;

  document.querySelectorAll("[data-crumb]").forEach(button => {
    button.onclick = () => goToNode(button.dataset.crumb);
  });
}