import { watchCollection, createItem, removeItem, updateItem } from "./database.js";

const COLLECTION = "v1_nodes";

export function watchNodes(callback, onError) {
  return watchCollection(COLLECTION, callback, onError);
}

export function addNode(node) {
  const title = (node.title || "").trim();
  if (!title) throw new Error("Title is required");
  if (!node.memberId) throw new Error("Member is required");

  return createItem(COLLECTION, {
    title,
    type: node.type || "folder",
    memberId: node.memberId,
    parentId: node.parentId || null,
    status: node.status || "active",
    dueDate: node.dueDate || ""
  });
}

export function deleteNode(id) {
  return removeItem(COLLECTION, id);
}
export async function updateNode(id, data) {
  return updateItem(COLLECTION, id, data);
}
