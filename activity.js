import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { db } from "./firebase.js";

const activityRef = collection(db, "activity");

export async function addActivity(activity) {
  return await addDoc(activityRef, {
    ...activity,
    createdAt: new Date().toISOString()
  });
}

export function watchActivity(callback) {
  const q = query(
    activityRef,
    orderBy("createdAt", "desc"),
    limit(20)
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