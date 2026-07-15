import { supabase } from "./supabase-client.js";
import { enqueue, registerHandler } from "./write-queue.js";

/* ---- photos de recettes (Supabase Storage, avec cache IndexedDB pour l'usage hors-ligne) ---- */
const PHOTO_DB_NAME = "carnet-photos";
const PHOTO_STORE = "photos";
const SYNCED_KEY = "carnet-photos-synced";

function openPhotoDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(PHOTO_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cachePhotoLocally(key, blob){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPhoto(key){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const req = tx.objectStore(PHOTO_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deletePhoto(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).delete(recipeId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function stepPhotoKey(recipeId, index){
  return `${recipeId}::step::${index}`;
}

/* ---- synchro Supabase Storage ---- */
function markPhotoSynced(key){
  const synced = new Set(JSON.parse(localStorage.getItem(SYNCED_KEY) || "[]"));
  synced.add(key);
  localStorage.setItem(SYNCED_KEY, JSON.stringify([...synced]));
}

function isPhotoSynced(key){
  const synced = new Set(JSON.parse(localStorage.getItem(SYNCED_KEY) || "[]"));
  return synced.has(key);
}

async function photoWriteHandler(payload){
  if (payload.op === "delete") {
    const { error } = await supabase.storage.from("recipe-photos").remove([payload.key]);
    if (error) throw error;
  } else {
    const { error } = await supabase.storage.from("recipe-photos").upload(payload.key, payload.blob, {
      upsert: true,
      contentType: payload.blob.type || "application/octet-stream"
    });
    if (error) throw error;
    markPhotoSynced(payload.key);
  }
}
registerHandler("photo", photoWriteHandler);

/* ---- API publique ---- */
export async function savePhoto(recipeId, file){
  await cachePhotoLocally(recipeId, file);
  await photoWriteHandler({ op: "upload", key: recipeId, blob: file }).catch(() => enqueue("photo", recipeId, { op: "upload", key: recipeId, blob: file }));
}

export async function saveStepPhoto(recipeId, index, file){
  const key = stepPhotoKey(recipeId, index);
  await cachePhotoLocally(key, file);
  await photoWriteHandler({ op: "upload", key, blob: file }).catch(() => enqueue("photo", key, { op: "upload", key, blob: file }));
}

export async function getStepPhoto(recipeId, index){
  return getPhoto(stepPhotoKey(recipeId, index));
}

export async function deleteAllPhotosForRecipe(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    const store = tx.objectStore(PHOTO_STORE);
    store.delete(recipeId);
    store.delete(IDBKeyRange.bound(recipeId + "::", recipeId + "::￿"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function applyCardPhoto(recipeId, iconEl){
  getPhoto(recipeId).then(blob => {
    if (!blob || !iconEl) return;
    iconEl.classList.add("has-photo");
    iconEl.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
  }).catch(() => {});
}
export function applyDetailPhoto(recipeId, heroEl){
  getPhoto(recipeId).then(blob => {
    if (!blob || !heroEl) return;
    heroEl.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
  }).catch(() => {});
}
