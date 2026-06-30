export function testWorkspaceModule() {
  console.log("workspace module loaded");
}

export function nodeIcon(type) {
  if (type === "task") return "✅";
  if (type === "note") return "📝";
  if (type === "checklist") return "☑️";
  return "📁";
}