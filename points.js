import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  where,
  deleteDoc,
doc,
updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase.js";

const pointsRef = collection(db, "points");

export async function addPointsTransaction(transaction) {
  return await addDoc(pointsRef, {
    ...transaction,
    createdAt: new Date().toISOString()
  });
}

export function watchPoints(callback) {
  const q = query(
    pointsRef,
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, snapshot => {
    callback(
      snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    );
  });
}

export function watchMemberPoints(memberId, callback) {
  const q = query(
    pointsRef,
    where("memberId", "==", memberId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, snapshot => {
    callback(
      snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    );
  });
}

export async function deletePointsTransaction(id) {
  return deleteDoc(doc(db, "points", id));
}
export async function hidePointsTransaction(id) {
  return updateDoc(
    doc(db, "points", id),
    {
      displayOnMemberCard: false
    }
  );
}