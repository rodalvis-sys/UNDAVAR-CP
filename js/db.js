// ============================================================
//  UNDAVAR — Persistencia (IndexedDB) + Import/Export .undavar
// ============================================================

const DB_NAME = "undavar-db";
const DB_VERSION = 1;
const STORES = ["personajes", "npcs", "tiendas", "oraculos", "config"];

let _dbPromise = null;
function abrirDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function dbPut(store, obj) {
  const db = await abrirDB();
  obj.updatedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(obj);
    tx.oncomplete = () => resolve(obj);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(store, id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAll(store) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result.sort((a,b)=>(a.updatedAt||0)-(b.updatedAt||0)));
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(store, id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function dbSetConfig(key, value) {
  return dbPut("config", { id:key, value });
}
async function dbGetConfig(key, fallback=null) {
  const r = await dbGet("config", key);
  return r ? r.value : fallback;
}

// ------------------------------------------------------------
// Import / Export .undavar (JSON con extensión personalizada)
// ------------------------------------------------------------
function descargarArchivo(nombre, contenidoObj) {
  const blob = new Blob([JSON.stringify(contenidoObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre.endsWith(".undavar") ? nombre : nombre + ".undavar";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportarPerfil(store, id) {
  const obj = await dbGet(store, id);
  if (!obj) throw new Error("No encontrado");
  descargarArchivo(`${obj.nombre || "undavar"}`, { _undavar: true, _tipo: "perfil", _store: store, data: obj });
}

async function exportarBackupCompleto() {
  const data = {};
  for (const store of STORES) data[store] = await dbGetAll(store);
  descargarArchivo(`undavar-backup-${new Date().toISOString().slice(0,10)}`, { _undavar: true, _tipo: "backup", data });
}

function leerArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch (e) { reject(new Error("Archivo .undavar inválido o corrupto.")); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function importarArchivo(file) {
  const contenido = await leerArchivo(file);
  if (!contenido || !contenido._undavar) throw new Error("Este no es un archivo .undavar válido.");

  if (contenido._tipo === "perfil") {
    const obj = contenido.data;
    obj.id = obj.id || crypto.randomUUID();
    await dbPut(contenido._store, obj);
    return { tipo:"perfil", store: contenido._store, nombre: obj.nombre };
  }
  if (contenido._tipo === "backup") {
    let total = 0;
    for (const store of STORES) {
      for (const obj of (contenido.data[store] || [])) {
        await dbPut(store, obj);
        total++;
      }
    }
    return { tipo:"backup", total };
  }
  throw new Error("Tipo de archivo .undavar no reconocido.");
}
