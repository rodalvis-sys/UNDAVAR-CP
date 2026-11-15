// ============================================================
//  UNDAVAR — Persistencia (SQLite en Tauri / IndexedDB en web)
//  Import/Export .undavar
// ============================================================

const DB_NAME = "undavar-db";
// [UNDAVAR-PARTE-9.1-METAS] v2 añade el almacén de metas; el resto no cambia
// [UNDAVAR-PARTE-10.11-GALERIA] v3 añade el almacén de imágenes de la galería
const DB_VERSION = 3;
const STORES = ["personajes", "npcs", "tiendas", "oraculos", "config", "metas", "galeria"];

// [UNDAVAR-PARTE-6-HIBRIDO] Detecta si la app corre dentro de Tauri
const ES_TAURI = typeof window !== "undefined" && !!window.__TAURI__;

// [UNDAVAR-PARTE-6-HIBRIDO] Invoca un comando Rust de la app de escritorio
function invocarTauri(cmd, args = {}) {
  const t = window.__TAURI__;
  if (t?.core?.invoke) return t.core.invoke(cmd, args);
  if (t?.invoke) return t.invoke(cmd, args);
  return Promise.reject(new Error("Tauri no está disponible."));
}

// ------------------------------------------------------------
// IndexedDB (versión web)
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// API común: misma interfaz para SQLite y para IndexedDB
// ------------------------------------------------------------

// [UNDAVAR-PARTE-9.6-MATRIMONIO] Las ganancias de un cónyuge también van al otro
let _compartiendoMatrimonio = false;
async function compartirGananciasMatrimonio(obj) {
  if (_compartiendoMatrimonio) return;
  const vinculo = obj?.system?.matrimonio;
  if (!vinculo?.conyugeId) return;
  // Se lee antes de escribir: dbPut llama aquí antes de guardar
  const anterior = await dbGet("personajes", obj.id);
  if (!anterior) return;

  const cambios = {};
  const pvAntes = Number(anterior.system?.pv?.value) || 0;
  const pvAhora = Number(obj.system?.pv?.value) || 0;
  if (pvAhora > pvAntes) cambios.pv = pvAhora - pvAntes;

  const pdc = {};
  for (const k of ["pc", "pe", "pr", "pd", "pp", "s"]) {
    const a = Number(anterior.system?.pdc?.[k]) || 0;
    const b = Number(obj.system?.pdc?.[k]) || 0;
    if (b > a) pdc[k] = b - a;
  }
  if (Object.keys(pdc).length) cambios.pdc = pdc;

  const erianas = {};
  for (const k of ["oro", "rubi", "diamante"]) {
    const a = Number(anterior.system?.erianas?.[k]) || 0;
    const b = Number(obj.system?.erianas?.[k]) || 0;
    if (b > a) erianas[k] = b - a;
  }
  if (Object.keys(erianas).length) cambios.erianas = erianas;

  if (!Object.keys(cambios).length) return;

  const conyuge = await dbGet("personajes", vinculo.conyugeId);
  if (!conyuge?.system) return;

  _compartiendoMatrimonio = true;
  try {
    if (cambios.pv) {
      conyuge.system.pv = conyuge.system.pv || { value: 0 };
      conyuge.system.pv.value = (Number(conyuge.system.pv.value) || 0) + cambios.pv;
    }
    if (cambios.pdc) {
      conyuge.system.pdc = conyuge.system.pdc || {};
      for (const [k, v] of Object.entries(cambios.pdc)) {
        conyuge.system.pdc[k] = (Number(conyuge.system.pdc[k]) || 0) + v;
      }
    }
    if (cambios.erianas) {
      conyuge.system.erianas = conyuge.system.erianas || { oro: 0, rubi: 0, diamante: 0 };
      for (const [k, v] of Object.entries(cambios.erianas)) {
        conyuge.system.erianas[k] = (Number(conyuge.system.erianas[k]) || 0) + v;
      }
      const detalle = Object.entries(cambios.erianas).map(([k, v]) => `+${v} ${k}`).join(", ");
      if (typeof registrarMovimientoErianas === "function") {
        registrarMovimientoErianas(conyuge, `Ganancia compartida por matrimonio (${detalle})`, cambios.erianas);
      }
    }
    await dbPut("personajes", conyuge);
  } finally {
    _compartiendoMatrimonio = false;
  }
}

async function dbPut(store, obj) {
  // [UNDAVAR-PARTE-9.6-MATRIMONIO] Reparte las ganancias antes de guardar
  if (store === "personajes") {
    try { await compartirGananciasMatrimonio(obj); }
    catch (err) { console.warn("No se pudieron compartir las ganancias del matrimonio:", err); }
  }
  obj.updatedAt = Date.now();
  // [UNDAVAR-PARTE-6-SQLITE] En escritorio guarda en SQLite
  if (ES_TAURI) return invocarTauri("db_put", { store, data: obj });
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(obj);
    tx.oncomplete = () => resolve(obj);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(store, id) {
  // [UNDAVAR-PARTE-6-SQLITE] En escritorio borra en SQLite
  if (ES_TAURI) return invocarTauri("db_delete", { store, id });
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAll(store) {
  // [UNDAVAR-PARTE-6-SQLITE] En escritorio lee de SQLite
  if (ES_TAURI) return invocarTauri("db_get_all", { store });
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result.sort((a,b)=>(a.updatedAt||0)-(b.updatedAt||0)));
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(store, id) {
  // [UNDAVAR-PARTE-6-SQLITE] En escritorio lee de SQLite
  if (ES_TAURI) return invocarTauri("db_get", { store, id });
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

// [UNDAVAR-PARTE-6-SQLITE] Información del motor y de la ruta de la base
async function dbInfo() {
  if (ES_TAURI) return invocarTauri("db_info");
  let total = 0;
  for (const store of STORES) total += (await dbGetAll(store)).length;
  return { motor: "indexeddb", ruta: DB_NAME, total };
}

// [UNDAVAR-PARTE-6-BACKUP] Copia manual de la base SQLite
async function dbBackup() {
  if (ES_TAURI) return invocarTauri("db_backup");
  return null;
}

// [UNDAVAR-PARTE-6-MIGRACION] Lee directamente de IndexedDB (aunque estemos en Tauri)
function leerIndexedDB(store) {
  return abrirDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

// [UNDAVAR-PARTE-6-MIGRACION] Primera vez en escritorio: copia IndexedDB a SQLite
async function migrarIndexedDBaSQLite() {
  if (!ES_TAURI) return { migrado: false, total: 0 };
  if (localStorage.getItem("undavar-migrado-sqlite") === "1") return { migrado: false, total: 0 };
  const info = await invocarTauri("db_info");
  if (Number(info.total) > 0) {
    localStorage.setItem("undavar-migrado-sqlite", "1");
    return { migrado: false, total: 0 };
  }
  let total = 0;
  for (const store of STORES) {
    const filas = await leerIndexedDB(store);
    for (const obj of filas) {
      await invocarTauri("db_put", { store, data: obj });
      total++;
    }
  }
  localStorage.setItem("undavar-migrado-sqlite", "1");
  return { migrado: total > 0, total };
}

// ------------------------------------------------------------
// Import / Export .undavar (JSON con extensión personalizada)
// ------------------------------------------------------------

// [UNDAVAR-PARTE-6B-DIALOGO] API de diálogos nativos (solo escritorio)
function dialogoTauri() {
  return ES_TAURI ? window.__TAURI__?.dialog || null : null;
}

async function descargarArchivo(nombre, contenidoObj) {
  const archivo = nombre.endsWith(".undavar") ? nombre : nombre + ".undavar";
  const json = JSON.stringify(contenidoObj, null, 2);

  // [UNDAVAR-PARTE-6B-DIALOGO] Escritorio: elegir ruta y escribir con Rust
  if (ES_TAURI) {
    const dialog = dialogoTauri();
    if (!dialog?.save) throw new Error("No se pudo abrir el diálogo de guardado.");
    const ruta = await dialog.save({
      title: "Guardar backup UNDAVAR",
      defaultPath: archivo,
      filters: [{ name: "Backup UNDAVAR", extensions: ["undavar"] }],
    });
    if (!ruta) return false;
    await invocarTauri("guardar_texto", { ruta, contenido: json });
    return true;
  }

  // Navegador: descarga normal
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

async function exportarPerfil(store, id) {
  const obj = await dbGet(store, id);
  if (!obj) throw new Error("No encontrado");
  return descargarArchivo(`${obj.nombre || "undavar"}`, { _undavar: true, _tipo: "perfil", _store: store, data: obj });
}

async function exportarBackupCompleto() {
  const data = {};
  for (const store of STORES) data[store] = await dbGetAll(store);
  return descargarArchivo(`undavar-backup-${new Date().toISOString().slice(0,10)}`, { _undavar: true, _tipo: "backup", data });
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

// [UNDAVAR-PARTE-6B-DIALOGO] Aplica el contenido ya leído (web y escritorio)
async function importarContenido(contenido) {
  if (!contenido || !contenido._undavar) throw new Error("Este no es un archivo .undavar válido.");

  if (contenido._tipo === "perfil") {
    const obj = contenido.data;
    obj.id = obj.id || nuevoId();
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

async function importarArchivo(file) {
  return importarContenido(await leerArchivo(file));
}

// [UNDAVAR-PARTE-6B-DIALOGO] Escritorio: elegir el .undavar y leerlo con Rust
async function importarDesdeDialogo() {
  const dialog = dialogoTauri();
  if (!dialog?.open) throw new Error("No se pudo abrir el diálogo de archivos.");
  const ruta = await dialog.open({
    title: "Abrir backup UNDAVAR",
    multiple: false,
    directory: false,
    filters: [{ name: "Backup UNDAVAR", extensions: ["undavar", "json"] }],
  });
  if (!ruta) return null;
  const texto = await invocarTauri("leer_texto", { ruta });
  let contenido;
  try { contenido = JSON.parse(texto); }
  catch (e) { throw new Error("Archivo .undavar inválido o corrupto."); }
  return importarContenido(contenido);
}
