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

/* ---- redimensionnement avant stockage/upload : les photos viennent souvent
   directement de l'appareil photo (plusieurs Mo), alors qu'elles ne sont
   jamais affichées au-delà d'une grande vignette — les réduire ici économise
   du stockage Supabase et du volume/temps de synchro. ---- */
const PHOTO_MAX_DIMENSION = 1200;
const PHOTO_JPEG_QUALITY = 0.82;

async function resizeImageForUpload(file, maxDim = PHOTO_MAX_DIMENSION, quality = PHOTO_JPEG_QUALITY){
  if (!file?.type?.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) { bitmap.close?.(); return file; }
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob || file;
  } catch {
    return file;
  }
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

// Clés confirmées absentes de Supabase Storage pour cette session : évite de
// refaire la requête réseau à chaque rendu tant qu'aucune photo n'a été
// uploadée entre-temps (voir confirmedMissing.delete dans savePhoto/saveStepPhoto).
const confirmedMissing = new Set();

async function fetchAndCacheFromStorage(key){
  const { data } = supabase.storage.from("recipe-photos").getPublicUrl(key);
  const res = await fetch(data.publicUrl);
  if (!res.ok) throw new Error("photo introuvable");
  const blob = await res.blob();
  await cachePhotoLocally(key, blob);
  return blob;
}

async function getPhotoWithFallback(key){
  const local = await getPhoto(key);
  if (local) return local;
  if (confirmedMissing.has(key)) return null;
  try {
    return await fetchAndCacheFromStorage(key);
  } catch {
    confirmedMissing.add(key);
    return null;
  }
}

export async function initPhotosSync(){
  const db = await openPhotoDB();
  const allKeys = await new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const req = tx.objectStore(PHOTO_STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  for (const key of allKeys) {
    if (isPhotoSynced(key)) continue;
    const blob = await getPhoto(key);
    if (!blob) continue;
    await photoWriteHandler({ op: "upload", key, blob }).catch(() => enqueue("photo", key, { op: "upload", key, blob }));
  }
}

/* ---- API publique ---- */
export async function savePhoto(recipeId, file){
  const blob = await resizeImageForUpload(file);
  await cachePhotoLocally(recipeId, blob);
  confirmedMissing.delete(recipeId);
  await photoWriteHandler({ op: "upload", key: recipeId, blob }).catch(() => enqueue("photo", recipeId, { op: "upload", key: recipeId, blob }));
}

export async function getMainPhoto(recipeId){
  return getPhotoWithFallback(recipeId);
}

export async function removePhoto(recipeId){
  await deletePhoto(recipeId);
  confirmedMissing.add(recipeId);
  await photoWriteHandler({ op: "delete", key: recipeId }).catch(() => enqueue("photo", recipeId, { op: "delete", key: recipeId }));
}

export async function saveStepPhoto(recipeId, index, file){
  const key = stepPhotoKey(recipeId, index);
  const blob = await resizeImageForUpload(file);
  await cachePhotoLocally(key, blob);
  confirmedMissing.delete(key);
  await photoWriteHandler({ op: "upload", key, blob }).catch(() => enqueue("photo", key, { op: "upload", key, blob }));
}

export async function removeStepPhoto(recipeId, index){
  const key = stepPhotoKey(recipeId, index);
  await deletePhoto(key);
  confirmedMissing.add(key);
  await photoWriteHandler({ op: "delete", key }).catch(() => enqueue("photo", key, { op: "delete", key }));
}

export async function getStepPhoto(recipeId, index){
  return getPhotoWithFallback(stepPhotoKey(recipeId, index));
}

async function collectPhotoKeysForRecipe(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const store = tx.objectStore(PHOTO_STORE);
    const keys = [];
    const mainReq = store.getKey(recipeId);
    mainReq.onsuccess = () => { if (mainReq.result !== undefined) keys.push(recipeId); };
    const cursorReq = store.openKeyCursor(IDBKeyRange.bound(recipeId + "::", recipeId + "::￿"));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) { keys.push(cursor.key); cursor.continue(); }
    };
    tx.oncomplete = () => resolve(keys);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAllPhotosForRecipe(recipeId){
  const keys = await collectPhotoKeysForRecipe(recipeId);
  const db = await openPhotoDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    const store = tx.objectStore(PHOTO_STORE);
    store.delete(recipeId);
    store.delete(IDBKeyRange.bound(recipeId + "::", recipeId + "::￿"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  for (const key of keys) {
    await photoWriteHandler({ op: "delete", key }).catch(() => enqueue("photo", key, { op: "delete", key }));
  }
}

export function applyCardPhoto(recipeId, iconEl){
  getPhotoWithFallback(recipeId).then(blob => {
    if (!blob || !iconEl) return;
    iconEl.classList.add("has-photo");
    iconEl.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
  }).catch(() => {});
}
export function applyDetailPhoto(recipeId, heroEl){
  getPhotoWithFallback(recipeId).then(blob => {
    if (!blob || !heroEl) return;
    heroEl.classList.add("has-photo");
    const img = document.createElement("img");
    img.src = URL.createObjectURL(blob);
    img.alt = "";
    heroEl.appendChild(img);
  }).catch(() => {});
}
