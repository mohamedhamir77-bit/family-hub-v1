import { db, collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "./firebase.js";

const membersRef = collection(db, "v1_members");

export function watchMembers(callback) {
  return onSnapshot(membersRef, snapshot => {
    const members = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(members);
  });
}

export async function addMember(member) {
  if (!member.name.trim()) {
    throw new Error("Member name is required");
  }

  await addDoc(membersRef, {
    name: member.name.trim(),
    emoji: member.emoji || "👤",
    role: member.role || "member",
    createdAt: serverTimestamp()
  });
}

export async function deleteMember(id) {
  await deleteDoc(doc(db, "v1_members", id));
}