import { db, collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "./firebase.js";

export function watchCollection(collectionName, callback, onError) {
  return onSnapshot(
    collection(db, collectionName),
    snapshot => {
      const items = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      callback(items);
    },
    error => {
      console.error(error);
      if (onError) onError(error);
    }
  );
}

export function createItem(collectionName, data) {
  return addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp()
  });
}

export function removeItem(collectionName, id) {
  return deleteDoc(doc(db, collectionName, id));
}
