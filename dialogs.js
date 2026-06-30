export function showAddDialog() {
  const type = prompt(
    "What do you want to add?\n\nfolder = 📁 Folder\ntask = ✅ Task\nnote = 📝 Note\nchecklist = ☑ Checklist",
    "folder"
  );

  if (!type) return null;

  const cleanType = type.trim().toLowerCase();

  if (!["folder", "task", "note", "checklist"].includes(cleanType)) {
    alert("Please type folder, task, note, or checklist.");
    return null;
  }

  const title = prompt(`${cleanType} name`);

  if (!title || !title.trim()) return null;

  return {
    type: cleanType,
    title: title.trim()
  };
}