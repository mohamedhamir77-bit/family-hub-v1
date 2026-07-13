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

    notes: node.notes || "",
    dueDate: node.dueDate || "",
    endDate: node.endDate || "",
    priority: node.priority || "",

    repeat: node.repeat || "none",
    repeatUntil: node.repeatUntil || "",

    rotationEnabled: node.rotationEnabled === true,
    rotationMembers: node.rotationMembers || [],
    rotationIndex: node.rotationIndex || 0,
    participantsPerOccurrence:
      Number(node.participantsPerOccurrence) || 1,

    sharedEnabled: node.sharedEnabled === true,
    participantIds: node.participantIds || [],
    temporarySwaps: node.temporarySwaps || {},
    completedBy: node.completedBy || {},

    done: node.done === true,
    completedAt: node.completedAt || ""
  });
}

export function deleteNode(id) {
  return removeItem(COLLECTION, id);
}
export async function updateNode(id, data) {
  return updateItem(COLLECTION, id, data);
}
