/* ---- photos de recettes (IndexedDB — trop lourd pour localStorage) ---- */
const PHOTO_DB_NAME = "carnet-photos";
const PHOTO_STORE = "photos";

function openPhotoDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(PHOTO_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function savePhoto(recipeId, file){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).put(file, recipeId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function getPhoto(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const req = tx.objectStore(PHOTO_STORE).get(recipeId);
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
export async function saveStepPhoto(recipeId, index, file){
  return savePhoto(stepPhotoKey(recipeId, index), file);
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
