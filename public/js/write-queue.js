import { openSyncDB, QUEUE_STORE } from "./sync.js";

const listeners = new Set();
const failureListeners = new Set();
const handlers = {};

function notifyListeners(size){
  listeners.forEach(cb => cb(size));
}

function notifyFailure(message){
  failureListeners.forEach(cb => cb(message));
}

export function onQueueChange(callback){
  listeners.add(callback);
}

export function onPermanentFailure(callback){
  failureListeners.add(callback);
}

export function registerHandler(type, handler){
  handlers[type] = handler;
}

export async function getQueueSize(){
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(QUEUE_STORE, "readonly").objectStore(QUEUE_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(type, key, payload){
  const db = await openSyncDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).put({ key: `${type}:${key}`, type, payload });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notifyListeners(await getQueueSize());
}

async function dequeue(queueKey){
  const db = await openSyncDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).delete(queueKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllEntries(){
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(QUEUE_STORE, "readonly").objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function wait(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* Une reconnexion tout juste rétablie (DNS, TLS, rafraîchissement du jeton
   Supabase) peut faire échouer les premières tentatives alors que le réseau
   est en fait de retour — on retente à quelques reprises, avec un délai
   croissant, avant d'abandonner définitivement. */
const RETRY_DELAYS_MS = [2000, 5000];

async function attemptEntry(handler, payload){
  for (let attempt = 0; ; attempt++) {
    try {
      await handler(payload);
      return true;
    } catch {
      if (attempt >= RETRY_DELAYS_MS.length) return false;
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
}

export async function flush(){
  if (!navigator.onLine) return;
  const entries = await getAllEntries();
  for (const entry of entries) {
    if (!navigator.onLine) break;
    const handler = handlers[entry.type];
    if (!handler) { await dequeue(entry.key); continue; }
    const succeeded = await attemptEntry(handler, entry.payload);
    await dequeue(entry.key);
    if (!succeeded) notifyFailure("Échec de synchronisation d'une modification récente");
  }
  notifyListeners(await getQueueSize());
}
