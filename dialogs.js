const $ = id => document.getElementById(id);

let selectedType = "folder";
function updateSelectedType() {
  document.querySelectorAll("[data-type]").forEach(button => {
    button.classList.toggle("selected", button.dataset.type === selectedType);
  });
}
export function showAddDialog() {
  return new Promise(resolve => {
    const modal = $("addModal");
    const nameInput = $("addItemName");

    selectedType = "folder";
    updateSelectedType();
    nameInput.value = "";
    modal.classList.remove("hidden");
    nameInput.focus();

    document.querySelectorAll("[data-type]").forEach(button => {
  button.onclick = () => {
    selectedType = button.dataset.type;
    updateSelectedType();
    nameInput.focus();
  };
});

    $("cancelAddModal").onclick = () => {
      modal.classList.add("hidden");
      resolve(null);
    };

    $("createAddModal").onclick = () => {
      const title = nameInput.value.trim();
      if (!title) return;

      modal.classList.add("hidden");
      resolve({
        type: selectedType,
        title
      });
    };
  });
}