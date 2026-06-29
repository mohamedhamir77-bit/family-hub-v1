import { watchCollection, createItem, removeItem } from "./database.js";

const COLLECTION = "v1_members";

export function watchMembers(callback, onError) {
  return watchCollection(COLLECTION, callback, onError);
}

export function addMember(member) {
  const name = (member.name || "").trim();
  if (!name) throw new Error("Member name is required");

  return createItem(COLLECTION, {
    name,
    emoji: member.emoji || "👤",
    role: member.role || "member"
  });
}

export function deleteMember(id) {
  return removeItem(COLLECTION, id);
}
