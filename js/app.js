// ============================================================
//  UNDAVAR — Aplicación principal
// ============================================================

const app = document.getElementById("app");

const state = {
  vista: "inicio",
  personajeId: null,
  npcId: null,
  tiendaId: null,
  oraculoId: null,
  subtabFicha: "datos",
  historialDadosLibres: [],

  // Estado para la Vista Dividida
  panelIzq: { vista: "ficha", id: null },
  panelDer: { vista: "npc", id: null },

  // Tiradas enfrentadas
  enfrentamiento: { idA: "", idB: "", tipoA: "personajes", tipoB: "npcs" },
};

// ------------------------------------------------------------
// Helpers de render
// ------------------------------------------------------------
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }
function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function notificar(mensaje) {
  const toastViejo = document.querySelector(".toast-notificacion");
  if (toastViejo) toastViejo.remove();

  const toast = document.createElement("div");
  toast.className = "toast-notificacion";
  toast.textContent = mensaje;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

function dadosHTML(ds) {
  return `<div class="dados-resultado">${ds.map(d => `<span class="dado ${[1, 3, 5].includes(d) ? 'acierto' : 'perdida'}">${d}</span>`).join("")}</div>`;
}

async function logTirada(actorObj, html, storeName = "personajes") {
  if (!actorObj) return;
  if (!actorObj.system) actorObj.system = {};
  if (!actorObj.system.historialTiradas) actorObj.system.historialTiradas = [];

  actorObj.system.historialTiradas.unshift(html);
  if (actorObj.system.historialTiradas.length > 40) {
    actorObj.system.historialTiradas.pop();
  }

  await dbPut(storeName, actorObj);

  const log = qs("#tirada-log");
  if (log) {
    log.innerHTML = actorObj.system.historialTiradas
      .map(h => `<div class="tirada-item">${h}</div>`)
      .join("");
  }
}

async function render() {
  qsa(".navlink").forEach(a => a.classList.toggle("activo", a.dataset.vista === state.vista));
  switch (state.vista) {
    case "inicio": await renderInicio(); break;
    case "ficha": await renderFichaPersonaje(); break;
    case "npc": await renderFichaNPC(); break;
    case "tienda": await renderTienda(); break;
    case "oraculo": await renderOraculo(); break;
    case "dados": await renderDados(); break;
    case "enfrentamiento": await renderEnfrentamiento(); break;
    case "dividida": await renderVistaDividida(); break;
    default: await renderInicio();
  }
}

function ir(vista, extra = {}) {
  state.vista = vista;
  Object.assign(state, extra);
  render();
}

// ------------------------------------------------------------
// VISTA: INICIO
// ------------------------------------------------------------
async function renderInicio() {
  const [personajesRaw, npcsRaw, tiendasRaw, oraculosRaw] = await Promise.all([
    dbGetAll("personajes"), dbGetAll("npcs"), dbGetAll("tiendas"), dbGetAll("oraculos")
  ]);

  // Función para ordenar: lo recién abierto/modificado va al principio
  const porReciente = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);

  const personajes = personajesRaw.sort(porReciente);
  const npcs = npcsRaw.sort(porReciente);
  const tiendas = tiendasRaw.sort(porReciente);
  const oraculos = oraculosRaw.sort(porReciente);

  const tarjeta = (obj, vista, store, subt = "") => `
    <div class="tarjeta" data-id="${obj.id}" data-vista="${vista}" data-store="${store}">
      <div class="tarjeta-nombre">${esc(obj.nombre || "Sin nombre")}</div>
      <div class="tarjeta-sub">${subt}</div>
      <div class="tarjeta-acciones">
        <button class="btn-abrir" data-id="${obj.id}" data-vista="${vista}">Abrir</button>
        <button class="btn-exportar-perfil" data-id="${obj.id}" data-store="${store}" title="Exportar .undavar">⇩</button>
        <button class="btn-borrar-perfil" data-id="${obj.id}" data-store="${store}" title="Eliminar">✕</button>
      </div>
    </div>`;

  app.innerHTML = `
    <section class="vista-inicio">
      <div class="hero-undavar">
        <h1>República Aristócrata de <span>Undavar</span></h1>
        <p>Cuaderno de campaña — fichas, tienda y oráculo del Sabio Regidor, todo en tu navegador y sin conexión.</p>
      </div>

      <div class="inicio-grid">
        <div class="inicio-columna">
          <div class="columna-header">
            <h2>Undavaritas</h2>
            <button class="btn-primario" id="btn-nuevo-pj">+ Nuevo Personaje</button>
          </div>
          <div class="tarjetas-lista">
            ${personajes.length ? personajes.map(p => tarjeta(p, "ficha", "personajes", p.system?.datos?.clase || "")).join("") : `<p class="vacio">Aún no tienes personajes. Crea el primero.</p>`}
          </div>
        </div>

        <div class="inicio-columna">
          <div class="columna-header">
            <h2>PNJ / Bestias</h2>
            <button class="btn-primario" id="btn-nuevo-npc">+ Nuevo PNJ</button>
          </div>
          <div class="tarjetas-lista">
            ${npcs.length ? npcs.map(p => tarjeta(p, "npc", "npcs", p.system?.datos?.raza || "")).join("") : `<p class="vacio">Sin PNJ o bestias creadas.</p>`}
          </div>
        </div>

        <div class="inicio-columna">
          <div class="columna-header">
            <h2>Tiendas</h2>
            <button class="btn-primario" id="btn-nueva-tienda">+ Nueva Tienda</button>
          </div>
          <div class="tarjetas-lista">
            ${tiendas.length ? tiendas.map(t => tarjeta(t, "tienda", "tiendas", `${t.items?.length || 0} ítems`)).join("") : `<p class="vacio">Ninguna tienda todavía.</p>`}
          </div>
        </div>

        <div class="inicio-columna">
          <div class="columna-header">
            <h2>Oráculos</h2>
            <button class="btn-primario" id="btn-nuevo-oraculo">+ Nuevo Oráculo</button>
          </div>
          <div class="tarjetas-lista">
            ${oraculos.length ? oraculos.map(o => tarjeta(o, "oraculo", "oraculos", `${o.tabla?.length || 0} entradas`)).join("") : `<p class="vacio">Sin oráculos. Se crea uno por defecto.</p>`}
          </div>
        </div>
      </div>

      <div class="respaldo-bloque">
        <h2>Copias de seguridad</h2>
        <p>Exporta todo lo que tienes guardado a un archivo <code>.undavar</code>, o impórtalo en otro dispositivo.</p>
        <div class="respaldo-botones">
          <button class="btn-secundario" id="btn-exportar-todo">⇩ Exportar backup completo</button>
          <label class="btn-secundario" for="input-importar">⇧ Importar archivo .undavar</label>
          <input type="file" id="input-importar" accept=".undavar,application/json" hidden>
        </div>
      </div>
    </section>`;

  qs("#btn-nuevo-pj").addEventListener("click", async () => {
    const obj = actorPersonajePorDefecto();
    await dbPut("personajes", obj);
    ir("ficha", { personajeId: obj.id, subtabFicha: "datos" });
  });
  qs("#btn-nuevo-npc").addEventListener("click", async () => {
    const obj = actorNPCPorDefecto();
    await dbPut("npcs", obj);
    ir("npc", { npcId: obj.id });
  });
  qs("#btn-nueva-tienda").addEventListener("click", async () => {
    const obj = tiendaPorDefecto();
    await dbPut("tiendas", obj);
    ir("tienda", { tiendaId: obj.id });
  });
  qs("#btn-nuevo-oraculo").addEventListener("click", async () => {
    const obj = oraculoPorDefecto();
    await dbPut("oraculos", obj);
    ir("oraculo", { oraculoId: obj.id });
  });

  qsa(".btn-abrir").forEach(b => b.addEventListener("click", async () => {
    const { id, vista } = b.dataset;
    const storeMap = { ficha: "personajes", npc: "npcs", tienda: "tiendas", oraculo: "oraculos" };
    const key = { ficha: "personajeId", npc: "npcId", tienda: "tiendaId", oraculo: "oraculoId" }[vista];

    // Guardamos la fecha actual para que pase al principio de la lista
    const item = await dbGet(storeMap[vista], id);
    if (item) {
      item.updatedAt = Date.now();
      await dbPut(storeMap[vista], item);
    }

    ir(vista, { [key]: id });
  }));
  qsa(".btn-exportar-perfil").forEach(b => b.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    await exportarPerfil(b.dataset.store, b.dataset.id);
  }));
  qsa(".btn-borrar-perfil").forEach(b => b.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    if (confirm("¿Eliminar de forma permanente?")) { await dbDelete(b.dataset.store, b.dataset.id); render(); }
  }));
  qs("#btn-exportar-todo").addEventListener("click", () => exportarBackupCompleto());
  qs("#input-importar").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const r = await importarArchivo(file);
      alert(r.tipo === "backup" ? `Backup importado: ${r.total} elementos.` : `Perfil importado: ${r.nombre}`);
      render();
    } catch (e) { alert("Error al importar: " + e.message); }
    ev.target.value = "";
  });
}

// ------------------------------------------------------------
// HELPER: TRANSFERENCIA DE ÍTEMS ENTRE FICHAS (CORREGIDO)
// ------------------------------------------------------------
async function abrirModalTransferirItem(actorOrigen, itemTarget) {
  const todosPJs = await dbGetAll("personajes");
  
  // SOLO mostramos Personajes (PJ), eliminamos PNJ porque no usan inventario
  const destinatarios = todosPJs
    .map(p => ({ id: p.id, nombre: p.nombre, tipoStore: "personajes", etiqueta: "PJ" }))
    .filter(d => d.id !== actorOrigen.id);

  if (destinatarios.length === 0) {
    notificar("⚠️ No hay otros personajes registrados para recibir el objeto.");
    return;
  }

  const esContenedor = itemTarget.system?.esContenedor || itemTarget.name.includes("Anillo espacial");
  const cantidadMax = itemTarget.system?.cantidad || 1;

  const modalHtml = `
    <div class="modal-backdrop">
      <div class="modal-contenido" style="max-width:420px; width:90%;">
        <h3 style="margin-top:0; color:#d4af37;">🎁 Enviar a otro personaje</h3>
        <p style="font-size:0.9em; color:#aaa; margin-bottom:12px;">
          Ítem: <b>${esc(itemTarget.name)}</b> ${esContenedor ? '📦 (Contenedor)' : ''}
        </p>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:0.85em; color:#ccc; margin-bottom:4px;">Selecciona Destinatario:</label>
          <select id="select-destinatario-transfer" style="width:100%; padding:8px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px;">
            ${destinatarios.map(d => `<option value="${d.id}" data-store="${d.tipoStore}">[${d.etiqueta}] ${esc(d.nombre)}</option>`).join("")}
          </select>
        </div>

        ${!esContenedor && cantidadMax > 1 ? `
          <div style="margin-bottom:15px;">
            <label style="display:block; font-size:0.85em; color:#ccc; margin-bottom:4px;">Cantidad a enviar (Máx: ${cantidadMax}):</label>
            <input type="number" id="input-cant-transfer" value="1" min="1" max="${cantidadMax}" style="width:100%; padding:8px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px; box-sizing:border-box;">
          </div>
        ` : ''}

        ${esContenedor ? `
          <p style="font-size:0.8em; color:#d4af37; background:rgba(212,175,55,0.1); padding:8px; border-radius:4px; border:1px solid rgba(212,175,55,0.2);">
            ℹ️ Se enviará el contenedor junto con <b>todos sus objetos vinculados</b>.
          </p>
        ` : ''}

        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:15px;">
          <button id="btn-cancelar-transfer" class="btn-secundario">Cancelar</button>
          <button id="btn-confirmar-transfer" class="btn-primario">Enviar Ítem</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  qs("#btn-cancelar-transfer").addEventListener("click", () => document.querySelector(".modal-backdrop").remove());

  qs("#btn-confirmar-transfer").addEventListener("click", async () => {
    const sel = qs("#select-destinatario-transfer");
    const idDestino = sel.value;
    const storeDestino = sel.options[sel.selectedIndex].dataset.store;
    
    const actorDestino = await dbGet(storeDestino, idDestino);
    if (!actorDestino) { notificar("❌ Error al encontrar la ficha destino."); return; }

    if (!actorDestino.items) actorDestino.items = [];

    if (esContenedor) {
      // 1. Obtener los ítems que están dentro de este contenedor en el origen
      const itemsDentro = actorOrigen.items.filter(i => i.system?.ubicacionId === itemTarget.id);

      // 2. Crear una copia del contenedor conservando SU MISMO ID para mantener los enlaces
      const copiaContenedor = JSON.parse(JSON.stringify(itemTarget));
      if (!copiaContenedor.system) copiaContenedor.system = {};
      
      // Aseguramos que conserve la propiedad de contenedor
      copiaContenedor.system.esContenedor = true;
      actorDestino.items.push(copiaContenedor);

      // 3. Copiar los objetos internos al destino intactos
      itemsDentro.forEach(i => {
        actorDestino.items.push(JSON.parse(JSON.stringify(i)));
      });

      // 4. Limpiar del origen el contenedor y todo lo que tenía dentro
      actorOrigen.items = actorOrigen.items.filter(i => i.id !== itemTarget.id && i.system?.ubicacionId !== itemTarget.id);

    } else {
      // Transferencia individual de ítems normales
      const inputCant = qs("#input-cant-transfer");
      const cantAEnviar = inputCant ? Math.max(1, Math.min(cantidadMax, parseInt(inputCant.value) || 1)) : 1;

      if (itemTarget.system.cantidad > cantAEnviar) {
        itemTarget.system.cantidad -= cantAEnviar;
      } else {
        actorOrigen.items = actorOrigen.items.filter(i => i.id !== itemTarget.id);
      }

      const existenteEnDestino = actorDestino.items.find(i => i.name === itemTarget.name && i.type === itemTarget.type && !i.system?.ubicacionId);
      
      if (existenteEnDestino) {
        existenteEnDestino.system.cantidad = (Number(existenteEnDestino.system.cantidad) || 0) + cantAEnviar;
      } else {
        const copiaItem = JSON.parse(JSON.stringify(itemTarget));
        copiaItem.id = crypto.randomUUID();
        copiaItem.system.cantidad = cantAEnviar;
        copiaItem.system.ubicacionId = ""; // Va a los bolsillos del destinatario
        actorDestino.items.push(copiaItem);
      }
    }

    const storeOrigen = (actorOrigen.tipo === "npc" || actorOrigen.system?.datos?.raza) ? "npcs" : "personajes";

    await dbPut(storeOrigen, actorOrigen);
    await dbPut(storeDestino, actorDestino);

    document.querySelector(".modal-backdrop").remove();
    notificar(`🎁 ¡"${itemTarget.name}" enviado a ${actorDestino.nombre} con éxito!`);
    render();
  });
}

// ------------------------------------------------------------
// VISTA: FICHA DE PERSONAJE
// ------------------------------------------------------------
async function renderFichaPersonaje() {
  const actor = await dbGet("personajes", state.personajeId);
  if (!actor) { ir("inicio"); return; }
  const sys = actor.system;
  const calc = calcularDerivados(sys, actor.items);
  const oficiosUsados = actor.items.filter(i => i.type === "oficio").map(i => i.system.oficioId);
  const catalogo = OFICIOS_UNDAVAR.filter(o => !oficiosUsados.includes(o.id));

  app.innerHTML = `
  <section class="vista-ficha">
    ${cabeceraFicha(actor, calc)}
    ${barraEstadoAtributos(actor, calc)}

    <nav class="subtabs">
      ${["datos", "artes", "oficios", "inventario", "estado", "referencia", "equipo"].map(t =>
    `<button class="subtab ${state.subtabFicha === t ? 'activo' : ''}" data-subtab="${t}">${etiquetaSubtab(t)}</button>`).join("")}
    </nav>

    <div class="subtab-contenido">
      ${state.subtabFicha === "datos" ? tabDatos(actor) : ""}
      ${state.subtabFicha === "artes" ? tabArtesArmas(actor, calc) : ""}
      ${state.subtabFicha === "oficios" ? tabOficios(actor, catalogo) : ""}
      ${state.subtabFicha === "inventario" ? tabInventario(actor) : ""}
      ${state.subtabFicha === "estado" ? tabEstado(actor) : ""}
      ${state.subtabFicha === "referencia" ? tabReferencia(calc) : ""}
      ${state.subtabFicha === "equipo" ? tabEquipo(actor) : ""}
    </div>

    <div class="log-tiradas">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="margin:0;">Registro de tiradas</h3>
        <button class="btn-secundario chico" id="btn-limpiar-log">🧹 Limpiar</button>
      </div>
      <div id="tirada-log">
        ${(sys?.historialTiradas || []).map(h => `<div class="tirada-item">${h}</div>`).join("") || `<p class="vacio">Sin tiradas en esta sesión.</p>`}
      </div>
    </div>
  </section>`;

  wireFicha(actor, calc);
}

function etiquetaSubtab(t) {
  return { datos: "📋 Datos", artes: "⚔️ Artes y Armas", oficios: "🛠️ Oficios", inventario: "🎒 Inventario", estado: "🩺 Estado", referencia: "📖 Referencia", equipo: "🧥 Equipo" }[t];
}

function cabeceraFicha(actor, calc) {
  return `
  <header class="sheet-header">
    <button class="btn-volver" id="btn-volver">← Inicio</button>
    <div class="header-izquierda">
      <div class="nombre-bloque">
        <input type="text" id="campo-nombre" value="${esc(actor.nombre)}" placeholder="Nombre del personaje">
        <div class="rango-display">${calc.rango}</div>
        <div class="pv-bloque">
          <label>PV (#)</label>
          <input type="number" id="campo-pv" value="${actor.system.pv.value}" min="0" max="700">
          <span class="pv-max">/ 564</span>
        </div>
      </div>
    </div>
    <div class="header-tiradas" style="display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
      <button class="roll-btn" id="btn-recargar-pa" title="Restaurar PA al máximo">⚡ Recargar PA (${calc.paMaximo})</button>
      <button class="roll-btn" id="roll-estandar">🎲 Tirada</button>
      <button class="roll-btn" id="btn-toggle-mod-estandar" style="background:#2a2a35; border:1px solid #d4af37; color:#d4af37;" title="Configurar modificadores">⚙️ Mod.</button>
      <button class="roll-btn" id="roll-ataque">🗡️ Ataque</button>
      <button class="roll-btn" id="roll-rebote">⚡ Rebote</button>
      <button class="roll-btn" id="roll-despertar">☀️ Despertar</button>
      <button class="roll-btn" id="btn-exportar-actor" title="Exportar .undavar">⇩</button>
    </div>

    <!-- Panel de Modificadores adaptable -->
    <div id="panel-mod-estandar" style="display:none; width:100%; margin-top:10px; background:rgba(0,0,0,0.4); border:1px solid rgba(212,175,55,0.3); border-radius:6px; padding:10px; box-sizing:border-box;">
      
      <!-- Selector de Modo (Tirada / Ataque) -->
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px;">
        <label style="color:#d4af37; font-weight:bold;">Modo de Modificador:</label>
        <select id="mod-select-tipo-accion" style="background:#121215; border:1px solid #d4af37; color:#fff; padding:4px 8px; border-radius:4px; font-weight:bold;">
          <option value="tirada">🎲 Tirada Estándar</option>
          <option value="ataque">🗡️ Tirada de Ataque</option>
        </select>
      </div>

      <!-- BLOQUE 1: CAMPOS PARA TIRADA ESTÁNDAR -->
      <div id="bloque-mod-tirada" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; font-size:0.85em; color:#ccc;">
        
        <div style="display:flex; align-items:center; gap:6px;">
          <label style="color:#d4af37; font-weight:bold;">Atributo (Atr/2):</label>
          <select id="mod-select-atr" style="background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px;">
            <option value="ninguno">Ninguno (+0)</option>
            <option value="fuerza">Fuerza (${Math.floor((actor.system.atributos.fuerza || 0) / 2)})</option>
            <option value="velocidad">Velocidad (${Math.floor((actor.system.atributos.velocidad || 0) / 2)})</option>
            <option value="agilidad">Agilidad (${Math.floor((actor.system.atributos.agilidad || 0) / 2)})</option>
            <option value="inteligencia">Inteligencia (${Math.floor((actor.system.atributos.inteligencia || 0) / 2)})</option>
          </select>
        </div>

        <div style="display:flex; align-items:center; gap:6px;">
          <label style="color:#d4af37; font-weight:bold;">Gastar PA:</label>
          <input type="number" id="mod-input-pa" value="0" min="0" max="${actor.system.pa.value}" style="width:45px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
        </div>

        <div style="display:flex; align-items:center; gap:6px;">
          <label style="color:#d4af37; font-weight:bold;">Gastar PdC (2 pts = +1 mod):</label>
          <select id="mod-select-pdc-tipo" style="background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px;">
            <option value="ninguno">Sin PdC</option>
            <option value="pp">PP (Fuerza/Velocidad - Tienes: ${actor.system.pdc.pp || 0})</option>
            <option value="pd">PD (Agilidad/Inteligencia - Tienes: ${actor.system.pdc.pd || 0})</option>
          </select>
          <input type="number" id="mod-input-pdc-cant" value="0" min="0" step="2" placeholder="Cant. pts" style="width:55px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
        </div>

        <div style="display:flex; align-items:center; gap:6px;">
          <label style="color:#d4af37; font-weight:bold;">Mod. Fijo:</label>
          <input type="number" id="mod-input-fijo" value="0" style="width:45px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
        </div>

      </div>

      <!-- BLOQUE 2: CAMPOS PARA ATAQUE -->
      <div id="bloque-mod-ataque" style="display:none; gap:12px; align-items:center; flex-wrap:wrap; font-size:0.85em; color:#ccc;">
        
        <div style="display:flex; align-items:center; gap:6px;">
          <label style="color:#d4af37; font-weight:bold;">Dados Extra (d6):</label>
          <input type="number" id="mod-input-dados-ataque" value="0" min="0" style="width:50px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
        </div>

        <div style="display:flex; align-items:center; gap:6px;">
          <label style="color:#d4af37; font-weight:bold;">Mod. Fijo a Daño:</label>
          <input type="number" id="mod-input-fijo-ataque" value="0" style="width:55px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
        </div>

      </div>

    </div>
  </header>`;
}

function barraEstadoAtributos(actor, calc) {
  const s = actor.system;
  
  // Garantizar que la propiedad sinAsignar exista en el objeto
  if (s.pdc && s.pdc.sinAsignar === undefined) {
    s.pdc.sinAsignar = 0;
  }

  return `
  <section class="estado-atributos-bar">
    <div class="bloque-estado">
      <div class="bloque-titulo">Estado</div>
      <div class="estado-fila">
        <label>Pt. Herida</label>
        <input type="number" id="campo-herida" value="${s.estado.ptHerida.value}" min="0" max="8">
        <span class="estado-max">/8</span>
        ${calc.bonusHeridas ? `<span class="aviso-herida">(+${calc.bonusHeridas} por estado = ${calc.heridasTotales} total)</span>` : ""}
      </div>
      <div class="estado-fila">
        <label>Pt. Salud</label>
        <input type="number" id="campo-salud" value="${s.estado.ptSalud.value}" min="0" max="${calc.saludLimiteActual}">
        <span class="estado-max">/${calc.saludMaxima}</span>
        ${calc.saludPorHeridas ? `<span class="aviso-herida">(-${calc.saludPorHeridas} por heridas)</span>` : ""}
      </div>
      <div class="estado-fila">
        <label>PA</label>
        <input type="number" id="campo-pa" value="${s.pa.value}" min="0" max="${calc.paMaximo}">
        <span class="estado-max">/${calc.paMaximo}</span>
      </div>
    </div>

    <div class="bloque-atributos">
      <div class="bloque-titulo">Atributos</div>
      <div class="atributos-grid">
        ${["fuerza", "velocidad", "agilidad", "inteligencia"].map(atr => `
          <div class="atributo-item">
            <label>${atr[0].toUpperCase() + atr.slice(1)}</label>
            <div class="atributo-control">
              <input type="number" value="${s.atributos[atr]}" readonly>
              <button class="btn-up-atr" data-atr="${atr}" data-pago="${["fuerza", "velocidad"].includes(atr) ? "pp" : "pd"}" title="Subir (4 ${["fuerza", "velocidad"].includes(atr) ? "PP" : "PD"} = +1, máx. 9)">+</button>
            </div>
          </div>`).join("")}
      </div>
    </div>

    <div class="bloque-pdc">
      <div class="bloque-titulo">Puntos de Conveniencia</div>
      
      <!-- Campo de PdC Sin Asignar (Acumulador) -->
      <div class="pdc-sin-asignar-row" style="margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(212,175,55,0.2); display: flex; justify-content: space-between; align-items: center;">
        <label style="color:#d4af37; font-weight:bold; font-size:0.9em;">Sin Asignar (Bolsa):</label>
        <input type="number" class="campo-pdc" data-key="sinAsignar" value="${s.pdc.sinAsignar || 0}" min="0" style="width: 65px; text-align: center; font-weight: bold; background: #121215; border: 1px solid #d4af37; color: #55ff55; border-radius: 4px; padding: 4px;">
      </div>

      <div class="pdc-grid">
        ${[["pc", `(${calc.costoPCAccion}/acc)`], ["pe", ""], ["pr", ""], ["pd", ""], ["pp", ""], ["s", `(costo ${calc.costoSuerte})`]].map(([k, hint]) => `
          <div class="pdc-item">
            <label>${k.toUpperCase()} <small>${hint}</small></label>
            <input type="number" class="campo-pdc" data-key="${k}" value="${s.pdc[k] || 0}" min="0">
          </div>`).join("")}
      </div>
    </div>
  </section>`;
}

function tabDatos(actor) {
  const d = actor.system.datos;
  const e = actor.system.erianas;
  return `
  <div class="datos-grid">
    <div class="datos-columna">
      <div class="campo-fila"><label>Procedencia</label><input type="text" data-campo="datos.procedencia" value="${esc(d.procedencia)}" placeholder="Ej: Derla, Rehi"></div>
      <div class="campo-fila"><label>Edad</label><input type="text" data-campo="datos.edad" value="${esc(d.edad)}"></div>
      <div class="campo-fila"><label>Clase</label>
        <select data-campo="datos.clase">
          <option value="artista" ${d.clase === "artista" ? "selected" : ""}>Artista</option>
          <option value="gladiador" ${d.clase === "gladiador" ? "selected" : ""}>Gladiador</option>
        </select>
      </div>
      <div class="campo-fila"><label>Gremio</label><input type="text" data-campo="datos.gremio" value="${esc(d.gremio)}"></div>
      <div class="campo-fila"><label>Maestro</label><input type="text" data-campo="datos.maestro" value="${esc(d.maestro)}"></div>
      <div class="campo-fila"><label>Sabio Regidor</label><input type="text" data-campo="datos.sabioRegidor" value="${esc(d.sabioRegidor)}"></div>
    </div>
    
    <div class="datos-columna">
      <div class="campo-fila"><label>Apariencia / Descripción</label><textarea rows="3" data-campo="datos.descripcion" placeholder="Apariencia física, vestimenta...">${esc(d.descripcion)}</textarea></div>
      <div class="campo-fila"><label>Personalidad</label><textarea rows="3" data-campo="datos.personalidad" placeholder="Rasgos, temperamento, ideales...">${esc(d.personalidad)}</textarea></div>
      <div class="campo-fila"><label>Historia / Trasfondo</label><textarea rows="4" data-campo="datos.historia" placeholder="Origen, eventos pasados, motivaciones...">${esc(d.historia)}</textarea></div>
      
      <div class="campo-fila" style="margin-top:10px;">
        <label>Erianas</label>
        <div class="erianas-fila">
          <span>Oro</span><input type="number" class="campo-eriana" data-key="oro" value="${e.oro}" min="0">
          <span>Rubí</span><input type="number" class="campo-eriana" data-key="rubi" value="${e.rubi}" min="0">
          <span>Diamante</span><input type="number" class="campo-eriana" data-key="diamante" value="${e.diamante}" min="0">
        </div>
        <div class="erianas-botones">
          <button id="btn-roll-erianas" class="btn-secundario">🎲 Erianas iniciales (4d6×10)</button>
          <button id="btn-calculadora" class="btn-secundario">🧮 Conversor de Erianas</button>
        </div>
      </div>
    </div>
  </div>`;
}

function tabArtesArmas(actor, calc) {
  const artes = actor.items.filter(i => i.type === "arte");
  const armas = actor.items.filter(i => i.type === "arma");
  const fila = (it) => `
    <div class="item-fila" data-item-id="${it.id}">
      <span class="item-nombre">${esc(it.name)}</span>
      <span class="item-badge">Nv ${it.system.nivel}</span>
      <span class="item-badge pa-badge" title="PA para usar">${costoPANivel(it.system.nivel)} PA</span>
      <span class="item-badge" title="PV para mejorar nivel">${costoPVNivel(it.system.nivel)} PV/nv</span>
      <div class="item-botones">
        <button class="btn-usar-arte" data-id="${it.id}" title="Usar (lanza daño)">▶</button>
        <button class="btn-editar-item" data-id="${it.id}">✎</button>
        <button class="btn-borrar-item" data-id="${it.id}">✕</button>
      </div>
    </div>`;
  return `
    <div class="seccion-acciones">
      <button class="btn-secundario" id="btn-nueva-arte">+ Nueva Arte</button>
      <button class="btn-secundario" id="btn-nueva-arma">+ Nueva Arma</button>
      <span class="pa-disponible-badge">⚡ PA: ${actor.system.pa.value} / ${calc.paMaximo}</span>
    </div>
    <div class="items-lista">
      ${artes.map(fila).join("")}${armas.map(fila).join("")}
      ${(!artes.length && !armas.length) ? `<p class="vacio">Sin artes ni armas. Agrega con los botones de arriba.</p>` : ""}
    </div>`;
}

function tabOficios(actor, catalogo) {
  const oficios = actor.items.filter(i => i.type === "oficio");
  return `
    <p class="nota">Selecciona 2 oficios al crear la ficha. Gasta 3 PD para reclamar uno. Máximo 7 puntos de oficio.</p>
    ${catalogo.length ? `
    <div class="oficio-selector-row">
      <select id="oficio-selector">
        <option value="">— Selecciona un oficio para agregar —</option>
        ${catalogo.map(o => `<option value="${o.id}">${o.nombre}${o.logro ? " (logro)" : ""}</option>`).join("")}
      </select>
      <button class="btn-secundario" id="btn-agregar-oficio">+ Agregar</button>
    </div>
    <div id="oficio-preview" class="oficio-info-bloque" style="display:none;"></div>` :
      `<p class="nota" style="border-left-color:#8b2e2e;">Ya tienes todos los oficios disponibles.</p>`}
    <div class="items-lista" style="margin-top:10px;">
      ${oficios.map(it => `
      <div class="item-fila oficio-fila" data-item-id="${it.id}">
        <div class="oficio-fila-contenido">
          <div class="oficio-fila-header">
            <span class="item-nombre">${esc(it.name)}</span>
            ${it.system.logro ? `<span class="item-badge logro-badge">Logro</span>` : ""}
          </div>
          <div class="oficio-fila-desc">${esc(it.system.descripcion)}</div>
          <div class="oficio-pts-row">
            <span>Puntos de oficio:</span>
            <input type="number" class="oficio-pts-input" data-id="${it.id}" value="${it.system.puntos}" min="0" max="7">
            <span>/ ${it.system.maximo}</span>
          </div>
        </div>
        <div class="item-botones">
          <button class="btn-borrar-item" data-id="${it.id}">✕</button>
        </div>
      </div>`).join("") || `<p class="vacio">Sin oficios asignados.</p>`}
    </div>`;
}

function tabInventario(actor) {
  if (!actor) return `<p class="vacio">Cargando personaje...</p>`;
  const items = actor.items || [];

  // Helper para capacidad automática por descripción o casos clave
  const getCapacidad = (item) => {
    if (item.system?.capacidad !== undefined && item.system?.capacidad !== "") return Number(item.system.capacidad);

    const texto = `${item.system?.descripcion || ''} ${item.system?.efecto || ''}`.toLowerCase();
    const match = texto.match(/(\d+)\s*(espacios|espacio|slots|slot)/i);
    if (match) return parseInt(match[1], 10);

    if (item.name.includes("tamaño normal")) return 20;
    if (item.name.includes("Ampliado")) return 100;
    if (item.name.includes("Anillo espacial")) return 55;

    return 10;
  };

  // Un contenedor solo se despliega en la interfaz SI ESTÁ EQUIPADO
  const contenedores = items.filter(i => {
    // 1. Si no está equipado, se queda en el bolsillo como objeto común
    if (!i.system?.equipado) return false;

    // 2. Si está equipado, verificamos si es un contenedor por flag, patrón o palabra clave
    const texto = `${i.name} ${i.system?.descripcion || ''} ${i.system?.efecto || ''}`.toLowerCase();
    const tieneEspacios = /(\d+)\s*(espacios|espacio|slots|slot)/i.test(texto);
    const esPalabraClave = ["anillo espacial", "mochila", "bolso", "bulto", "saco", "cofre", "contenedor"].some(p => texto.includes(p));

    return i.system?.esContenedor || tieneEspacios || esPalabraClave;
  });

  const listaOpcionesUbicacion = [
    { id: "", nombre: "🧥 Bolsillos / En mano" },
    ...contenedores.map(c => ({ id: c.id, nombre: `📦 ${c.name}` }))
  ];

  const filaItem = (it) => `
    <div class="item-fila" data-item-id="${it.id}">
      <span class="item-nombre">${esc(it.name)}</span>
      <span class="item-cant">×${it.system?.cantidad || 1}</span>
      <div class="item-botones" style="display:flex; gap:4px; align-items:center;">
        <select class="sel-mover-item" data-id="${it.id}" title="Mover a..." style="background:#1e1e24; color:#ccc; border:1px solid #444; border-radius:3px; font-size:0.75em; padding:2px;">
          ${listaOpcionesUbicacion.map(op => `
            <option value="${op.id}" ${(it.system?.ubicacionId || "") === op.id ? "selected" : ""}>
              ${op.nombre}
            </option>
          `).join("")}
        </select>
        <button class="btn-transferir-item" data-id="${it.id}" title="Enviar a otra ficha">🎁</button>
        <button class="btn-editar-item" data-id="${it.id}">✎</button>
        <button class="btn-borrar-item" data-id="${it.id}">✕</button>
      </div>
    </div>`;

  const renderContenedor = (idContenedor, titulo, limite, esBolsillo = false, contObj = null) => {
    const itemsUbicacion = items.filter(i => {
      const esTipoValido = i.type === "objeto" || i.type === "elixir";
      const u = i.system?.ubicacionId || "";
      const estaAqui = (u === idContenedor);
      const noEquipado = !i.system?.equipado;
      return esTipoValido && estaAqui && noEquipado;
    });

    const objetos = itemsUbicacion.filter(i => i.type === "objeto");
    const elixires = itemsUbicacion.filter(i => i.type === "elixir");

    // Agrupamos por nombre para que los objetos iguales ocupen SOLO 1 slot de espacio
    const nombresUnicos = new Set(itemsUbicacion.map(i => i.name.trim().toLowerCase()));
    const totalEspaciosOcupados = nombresUnicos.size;
    const supera = limite > 0 && totalEspaciosOcupados > limite;

    return `
      <details open class="inv-contenedor-details" style="border:1px solid ${supera ? '#ff5555' : '#333'}; border-radius:6px; margin-bottom:12px; background:rgba(0,0,0,0.2);">
        <summary style="padding:10px; cursor:pointer; background:rgba(255,255,255,0.03); user-select:none;">
          <span style="color:#d4af37; font-weight:bold;">${titulo}</span>
          <span style="float:right; font-size:0.85em; color:${supera ? '#ff5555' : '#aaa'};">
            ${totalEspaciosOcupados} / ${limite === 0 ? '∞' : limite} espacios ${supera ? '⚠️ (Lleno)' : ''}
          </span>
        </summary>
        <div style="padding:10px;">
          ${!esBolsillo && contObj ? `
            <div style="text-align:right; margin-bottom:8px; display:flex; justify-content:flex-end; gap:6px;">
              <button class="btn-secundario chico btn-transferir-contenedor" data-id="${contObj.id}">🎁 Enviar Contenedor</button>
              <button class="btn-secundario chico btn-config-capacidad" data-id="${contObj.id}">⚙️ Editar</button>
            </div>
          ` : ''}
          <div class="inventario-columnas">
            <div class="inv-col">
              <div class="inv-titulo">
                Objetos 
                <button class="btn-secundario chico btn-add-item-rapido" data-tipo="objeto" data-ubicacion="${idContenedor}">+</button>
              </div>
              ${objetos.map(filaItem).join("") || `<p class="vacio">Vacío</p>`}
            </div>
            <div class="inv-col">
              <div class="inv-titulo">
                Elixires 
                <button class="btn-secundario chico btn-add-item-rapido" data-tipo="elixir" data-ubicacion="${idContenedor}">+</button>
              </div>
              ${elixires.map(filaItem).join("") || `<p class="vacio">Vacío</p>`}
            </div>
          </div>
        </div>
      </details>`;
  };

  let html = renderContenedor("", "Coat Bolsillos / En mano", 10, true);

  contenedores.forEach(c => {
    html += renderContenedor(c.id, `📦 ${esc(c.name)}`, getCapacidad(c), false, c);
  });

  return `
    <div class="seccion-acciones" style="margin-bottom:15px; display:flex; gap:10px;">
      <button class="btn-secundario btn-add-item-rapido" data-tipo="objeto" data-ubicacion="">+ Añadir Objeto</button>
      <button class="btn-secundario btn-add-item-rapido" data-tipo="elixir" data-ubicacion="">+ Añadir Elixir</button>
      <button class="btn-secundario" id="btn-crear-contenedor">📦 + Crear Contenedor Custom</button>
    </div>

    <div class="inventario-contenedores-lista">
      ${html}
    </div>

    <div id="modal-contenedor" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:1000; align-items:center; justify-content:center;">
      <div style="background:#1e1e24; border:1px solid #d4af37; border-radius:8px; width:360px; padding:20px; box-shadow:0 4px 20px rgba(0,0,0,0.8); color:#ccc;">
        <h3 id="modal-contenedor-titulo" style="margin-top:0; color:#d4af37; font-size:1.1em; text-align:center;">📦 Contenedor Custom</h3>
        <input type="hidden" id="input-id-contenedor" value="">
        
        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:0.85em; margin-bottom:4px; color:#aaa;">Nombre del contenedor:</label>
          <input type="text" id="input-nombre-contenedor" placeholder="ej. Mochila de viaje, Cofre" style="width:100%; background:#121215; border:1px solid #444; color:#fff; padding:8px; border-radius:4px; box-sizing:border-box;">
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:0.85em; margin-bottom:4px; color:#aaa;">Capacidad máxima (espacios):</label>
          <input type="number" id="input-capacidad-contenedor" value="15" min="1" style="width:100%; background:#121215; border:1px solid #444; color:#fff; padding:8px; border-radius:4px; box-sizing:border-box;">
        </div>

        <div style="display:flex; gap:10px; justify-content:space-between; align-items:center;">
          <button id="btn-eliminar-contenedor" class="btn-secundario" style="color:#ff5555; border-color:#ff5555; display:none;">✕ Eliminar</button>
          <div style="display:flex; gap:8px; margin-left:auto;">
            <button id="btn-cancelar-contenedor" class="btn-secundario">Cancelar</button>
            <button id="btn-guardar-contenedor" class="btn-primario" style="background:#d4af37; color:#121215; border:none; padding:8px 16px; border-radius:4px; font-weight:bold; cursor:pointer;">Guardar</button>
          </div>
        </div>
      </div>
    </div>`;
}

function tabEstado(actor) {
  const ext = actor.system.extensionEstado || { hambre: { value: 0 }, sed: { value: 0 }, cansancio: { value: 0 }, fatiga: { value: 0 } };
  const pm = actor.system.puntosYMarcas || { po: { estado: "I", value: 0 }, pol: { estado: "I", value: 0 }, marcaControl: { estado: "I", value: 0 } };

  return `
  <div class="referencia-grid">
    <div class="ref-bloque">
      <div class="bloque-titulo">Extensión de Estado</div>
      ${["hambre", "sed", "cansancio", "fatiga"].map(k => `
        <div class="campo-fila" style="margin-bottom: 8px;">
          <label>${k[0].toUpperCase() + k.slice(1)}</label>
          <input type="number" class="campo-ext-estado" data-key="${k}" value="${ext[k]?.value || 0}" min="0" max="9">
        </div>
      `).join("")}
    </div>

    <div class="ref-bloque">
      <div class="bloque-titulo">Puntos y Marcas</div>
      ${[
      ["po", "P.O", 3],
      ["pol", "P.OL", 99],
      ["marcaControl", "Marca de Control", 6]
    ].map(([key, label, max]) => `
        <div class="campo-fila" style="margin-bottom: 8px;">
          <label>${label}</label>
          <select class="campo-pm-estado" data-key="${key}" data-prop="estado" style="width:70px; margin-right:5px;">
            <option value="I" ${pm[key]?.estado === "I" ? "selected" : ""}>I</option>
            <option value="A" ${pm[key]?.estado === "A" ? "selected" : ""}>A</option>
          </select>
          <input type="number" class="campo-pm-val" data-key="${key}" data-prop="value" value="${pm[key]?.value || 0}" min="0" ${max < 99 ? `max="${max}"` : ''}>
        </div>
      `).join("")}
    </div>
  </div>

  <div class="ref-bloque" style="margin-top: 15px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(212, 175, 55, 0.3); padding: 15px; border-radius: 6px;">
    <div class="bloque-titulo">Notas de Extensión y Marcas</div>
    <ul style="margin: 0; padding-left: 20px; font-size: 0.9em; line-height: 1.6; color: #d0d0d0;">
      <li>Debe de saber que por cada dos puntos de hambre, sed, cansancio o fatiga se marcará uno de salud (baja salud).</li>
      <li>Las acciones de ataques de habilidad y/o arma 3 de nivel 4 empiezan el conflicto con un +2 de victoria, lo mismo para defensa.</li>
      <li>En puntos y marca en el primer cuadro deberá marcar <b>A (Activo)</b> cuando estos estén en conflicto e <b>I (Inactivo)</b> cuando no lo estén.</li>
    </ul>
  </div>`;
}

function tabEquipo(actor) {
  const equipados = (actor.items || []).filter(i => i.type === "objeto" && i.system?.equipado);

  return `
    <div class="seccion-acciones">
      <button class="btn-secundario" id="btn-equipar-desde-inv">+ Equipar desde Inventario</button>
    </div>
    <div class="items-lista">
      ${equipados.map(it => `
      <div class="item-fila" data-item-id="${it.id}">
        <span class="item-nombre">${esc(it.name)}</span>
        <span class="item-badge">${esc(it.system.slot || 'Equipado')}</span>
        ${it.system.reduccion_dano ? `<span class="item-badge">-${it.system.reduccion_dano} dmg</span>` : ""}
        <div class="item-botones">
          <button class="btn-desequipar-item" data-id="${it.id}" title="Volver a la mochila">Quitar</button>
        </div>
      </div>`).join("") || `<p class="vacio">No tienes nada equipado.</p>`}
    </div>`;
}

function tabReferencia(calc) {
  return `
  <div class="referencia-grid">
    <div class="ref-bloque">
      <div class="bloque-titulo">Reglas Rápidas</div>
      <ul class="reglas-lista">
        <li>1, 3, 5 = aciertos | 2, 4, 6 = pérdidas</li>
        <li>Cada 2 marcas de estado = +1 Pt. Herida</li>
        <li>Cada 4 Pt. Herida = −1 Pt. Salud</li>
        <li>9 PE = −1 Pt. Herida | 9 PE = +1 Pt. Salud</li>
        <li>Usar Arte/Arma = +1 Cansancio</li>
        <li>Rebote: usar arte/arma estando con 8 de herida</li>
        <li>Suma de dados &gt; 12 = Buena suerte</li>
        <li>Suerte: usable 1 vez cada 4 turnos</li>
        <li>Arte/Arma Nv. 4 = +2 aciertos al inicio del conflicto</li>
        <li>+2 PdC al resolver un conflicto interno</li>
        <li>Daño por nivel — Nv1: 2d6+2 · Nv2: 2d6+3 · Nv3: 3d6+Atr/3 · Nv4: 4d6+Atr/2</li>
      </ul>
    </div>
    <div class="ref-bloque">
      <div class="bloque-titulo">Tabla de Rangos</div>
      <table class="rangos-tabla">
        <tr><th>Rango</th><th>PV mín.</th><th>PC/acc</th><th>Costo S</th></tr>
        ${RANGOS_UNDAVAR.slice(1).map(r => `<tr class="${calc.rango === r.nombre ? 'rango-actual' : ''}"><td>${r.nombre}</td><td>${r.minPV}</td><td>${r.costoPC}</td><td>${r.costoS}</td></tr>`).join("")}
      </table>
    </div>
  </div>`;
}

function wireFicha(actor, calc) {
  qs("#btn-volver").addEventListener("click", () => ir("inicio"));
  qs("#btn-exportar-actor").addEventListener("click", () => exportarPerfil("personajes", actor.id));

  const guardarCampo = async (path, value) => {
    const partes = path.split(".");
    let obj = actor;
    for (let i = 0; i < partes.length - 1; i++) obj = obj[partes[i]];
    obj[partes[partes.length - 1]] = value;
    await dbPut("personajes", actor);
  };

  // Toggle del panel de modificadores
  const btnToggleMod = qs("#btn-toggle-mod-estandar");
  const panelMod = qs("#panel-mod-estandar");
  if (btnToggleMod && panelMod) {
    btnToggleMod.addEventListener("click", () => {
      panelMod.style.display = panelMod.style.display === "none" ? "block" : "none";
    });
  }

  // Alternar visibilidad según el selector (Tirada vs Ataque)
  const selectModTipoAccion = qs("#mod-select-tipo-accion");
  const bloqueModTirada = qs("#bloque-mod-tirada");
  const bloqueModAtaque = qs("#bloque-mod-ataque");

  if (selectModTipoAccion) {
    selectModTipoAccion.addEventListener("change", (e) => {
      if (e.target.value === "ataque") {
        if (bloqueModTirada) bloqueModTirada.style.display = "none";
        if (bloqueModAtaque) bloqueModAtaque.style.display = "flex";
      } else {
        if (bloqueModTirada) bloqueModTirada.style.display = "flex";
        if (bloqueModAtaque) bloqueModAtaque.style.display = "none";
      }
    });
  }

  // Función helper para limpiar el panel
  const limpiarPanelMod = () => {
    if (qs("#mod-select-tipo-accion")) qs("#mod-select-tipo-accion").value = "tirada";
    if (qs("#mod-select-atr")) qs("#mod-select-atr").value = "ninguno";
    if (qs("#mod-input-pa")) qs("#mod-input-pa").value = "0";
    if (qs("#mod-select-pdc-tipo")) qs("#mod-select-pdc-tipo").value = "ninguno";
    if (qs("#mod-input-pdc-cant")) qs("#mod-input-pdc-cant").value = "0";
    if (qs("#mod-input-fijo")) qs("#mod-input-fijo").value = "0";
    if (qs("#mod-input-dados-ataque")) qs("#mod-input-dados-ataque").value = "0";
    if (qs("#mod-input-fijo-ataque")) qs("#mod-input-fijo-ataque").value = "0";
    
    if (bloqueModTirada) bloqueModTirada.style.display = "flex";
    if (bloqueModAtaque) bloqueModAtaque.style.display = "none";
    if (panelMod) panelMod.style.display = "none";
  };

  qs("#campo-nombre").addEventListener("change", async e => { actor.nombre = e.target.value; await dbPut("personajes", actor); });
  qs("#campo-pv").addEventListener("change", async e => { await guardarCampo("system.pv.value", Number(e.target.value) || 0); render(); });
  qs("#campo-herida").addEventListener("change", async e => { await guardarCampo("system.estado.ptHerida.value", Math.min(8, Number(e.target.value) || 0)); render(); });
  qs("#campo-salud").addEventListener("change", async e => { await guardarCampo("system.estado.ptSalud.value", Number(e.target.value) || 0); render(); });
  qs("#campo-pa").addEventListener("change", async e => { await guardarCampo("system.pa.value", Number(e.target.value) || 0); render(); });

  qsa(".campo-pdc").forEach(inp => inp.addEventListener("change", async e => {
    await guardarCampo(`system.pdc.${e.target.dataset.key}`, Number(e.target.value) || 0);
  }));
  qsa(".campo-eriana").forEach(inp => inp.addEventListener("change", async e => {
    await guardarCampo(`system.erianas.${e.target.dataset.key}`, Number(e.target.value) || 0);
  }));

  qsa("[data-campo]").forEach(inp => inp.addEventListener("change", async e => {
    await guardarCampo("system." + e.target.dataset.campo, e.target.value);
  }));

  // Subtabs
  qsa(".subtab").forEach(b => b.addEventListener("click", () => { state.subtabFicha = b.dataset.subtab; render(); }));

  // Atributos
  qsa(".btn-up-atr").forEach(b => b.addEventListener("click", () => abrirMejoraAtributo(actor, b.dataset.atr, b.dataset.pago)));

  // --- 1. TIRADA ESTÁNDAR ---
  qs("#roll-estandar").addEventListener("click", async () => {
    let modAtributo = 0;
    let modPA = 0;
    let modPdC = 0;
    let modFijo = 0;

    let gastoPA = 0;
    let gastoPdC = 0;
    let tipoPdC = "ninguno";

    if (panelMod && selectModTipoAccion?.value === "tirada") {
      const selAtr = qs("#mod-select-atr")?.value;
      if (selAtr && selAtr !== "ninguno") {
        modAtributo = Math.floor((Number(actor.system.atributos[selAtr]) || 0) / 2);
      }

      gastoPA = Math.max(0, parseInt(qs("#mod-input-pa")?.value) || 0);
      if (gastoPA > actor.system.pa.value) {
        alert(`No tienes suficientes PA. Disponibles: ${actor.system.pa.value}`);
        return;
      }
      modPA = gastoPA;

      tipoPdC = qs("#mod-select-pdc-tipo")?.value || "ninguno";
      gastoPdC = Math.max(0, parseInt(qs("#mod-input-pdc-cant")?.value) || 0);

      if (tipoPdC !== "ninguno" && gastoPdC > 0) {
        const saldoDisponible = Number(actor.system.pdc[tipoPdC]) || 0;
        if (gastoPdC > saldoDisponible) {
          alert(`No tienes suficientes ${tipoPdC.toUpperCase()}. Disponibles: ${saldoDisponible}`);
          return;
        }
        modPdC = Math.floor(gastoPdC / 2);
      }

      modFijo = parseInt(qs("#mod-input-fijo")?.value) || 0;
    }

    const r = tiradaEstandar();
    const aciertosBase = r.aciertos;
    const modTotal = modAtributo + modPA + modPdC + modFijo;
    const aciertosTotales = aciertosBase + modTotal;

    let huboCambios = false;
    if (gastoPA > 0) {
      actor.system.pa.value -= gastoPA;
      huboCambios = true;
    }
    if (tipoPdC !== "ninguno" && gastoPdC > 0) {
      actor.system.pdc[tipoPdC] -= gastoPdC;
      huboCambios = true;
    }

    limpiarPanelMod();

    if (huboCambios) {
      await dbPut("personajes", actor);
      render();
    }

    const modTexto = modTotal !== 0 ? ` (${aciertosBase} base ${modTotal > 0 ? '+' : ''}${modTotal} mod) = <b style="color:#55ff55;">${aciertosTotales}</b>` : `<b style="color:#55ff55;">${aciertosTotales}</b>`;

    logTirada(
      actor, 
      `<h4>Tirada estándar</h4>${dadosHTML(r.ds)}
      <table class="roll-tabla">
        <tr><td>Aciertos</td><td>${modTexto}</td></tr>
        <tr><td>Pérdidas</td><td>${r.perdidas}</td></tr>
        <tr><td>PV ganados</td><td>+${r.pv}</td></tr>
        <tr><td>Suerte</td><td>${r.buenaSuerte ? "✨ Buena" : "💀 Mala"}</td></tr>
      </table>`, 
      "personajes"
    );
  });

// --- 2. TIRADA DE ATAQUE CON MODIFICADORES ---
  qs("#roll-ataque").addEventListener("click", async () => {
    let dadosExtra = 0;
    let modFijoAtaque = 0;

    if (panelMod && selectModTipoAccion?.value === "ataque") {
      dadosExtra = Math.max(0, parseInt(qs("#mod-input-dados-ataque")?.value) || 0);
      modFijoAtaque = parseInt(qs("#mod-input-fijo-ataque")?.value) || 0;
    }

    // Ataque estándar base es de 2d6 (+ dados extra si se configuraron)
    const cantDadosTotal = 2 + dadosExtra;
    const ds = [];
    let danoBase = 0;
    let pv = 0;

    for (let i = 0; i < cantDadosTotal; i++) {
      const val = Math.floor(Math.random() * 6) + 1;
      ds.push(val);
      
      // REGLA UNDAVAR: Los pares (2, 4, 6) son pérdidas/rojos y generan DAÑO
      if ([2, 4, 6].includes(val)) {
        danoBase++;
      } else {
        // Los impares (1, 3, 5) son aciertos/verdes y otorgan PV ganados
        pv += val;
      }
    }

    const sumaTotal = ds.reduce((a, b) => a + b, 0);
    const buenaSuerte = sumaTotal > 12;
    const danoFinal = Math.max(0, danoBase + modFijoAtaque);

    limpiarPanelMod();

    const detalleDano = modFijoAtaque !== 0 
      ? `${danoBase} base ${modFijoAtaque > 0 ? '+' : ''}${modFijoAtaque} mod = <b style="color:#ff5555;">${danoFinal}</b>` 
      : `<b style="color:#ff5555;">${danoFinal}</b>`;

    logTirada(
      actor, 
      `<h4>Ataque (${cantDadosTotal}d6)</h4>${dadosHTML(ds)}
      <table class="roll-tabla">
        <tr><td>Daño total</td><td>${detalleDano}</td></tr>
        <tr><td>PV ganados</td><td>+${pv}</td></tr>
        <tr><td>Suerte</td><td>${buenaSuerte ? "✨ Buena" : "💀 Mala"}</td></tr>
      </table>`, 
      "personajes"
    );
  });

  qs("#roll-rebote").addEventListener("click", () => {
    const r = tiradaRebote();
    logTirada(actor, `<h4>Rebote</h4>${dadosHTML(r.ds)}<p style="text-align:center">Aciertos: <b>${r.aciertos}</b> → ${r.resultado}</p><table class="roll-tabla"><tr><td>PV ganados</td><td>${r.pv}</td></tr><tr><td>Suerte</td><td>${r.buenaSuerte ? "✨ Buena" : "💀 Mala"}</td></tr></table>`, "personajes");
  });
  qs("#roll-despertar").addEventListener("click", () => {
    const r = tiradaDespertar();
    logTirada(actor, `<h4>Despertar</h4>${dadosHTML(r.ds)}<p style="text-align:center">Aciertos: <b>${r.aciertos}</b>/4 — ${r.despierta ? "✅ ¡Despierta!" : "❌ No despierta."}</p><table class="roll-tabla"><tr><td>PV ganados</td><td>${r.pv}</td></tr><tr><td>Suerte</td><td>${r.buenaSuerte ? "✨ Buena" : "💀 Mala"}</td></tr></table>`, "personajes");
  });

  const btnRollErianas = qs("#btn-roll-erianas");
  if (btnRollErianas) btnRollErianas.addEventListener("click", async () => {
    const r = tiradaErianasIniciales();
    logTirada(`<h4>Erianas iniciales</h4>${dadosHTML(r.ds)}<p style="text-align:center">${r.suma} × 10 = <b>${r.total} Oro</b></p>`);
    await guardarCampo("system.erianas.oro", r.total);
    render();
  });
  const btnCalc = qs("#btn-calculadora");
  if (btnCalc) btnCalc.addEventListener("click", abrirCalculadoraErianas);

  // Artes/armas
  const btnNuevaArte = qs("#btn-nueva-arte");
  if (btnNuevaArte) btnNuevaArte.addEventListener("click", () => abrirEditorItem(actor, "arte"));
  const btnNuevaArma = qs("#btn-nueva-arma");
  if (btnNuevaArma) btnNuevaArma.addEventListener("click", () => abrirEditorItem(actor, "arma"));
  const btnNuevoEquipo = qs("#btn-nuevo-equipo");
  if (btnNuevoEquipo) btnNuevoEquipo.addEventListener("click", () => abrirEditorItem(actor, "equipo"));

  qsa(".btn-editar-item").forEach(b => b.addEventListener("click", () => abrirEditorItem(actor, null, b.dataset.id)));
  qsa(".btn-borrar-item").forEach(b => b.addEventListener("click", async () => {
    actor.items = actor.items.filter(i => i.id !== b.dataset.id);
    await dbPut("personajes", actor);
    render();
  }));
  qsa(".btn-usar-arte").forEach(b => b.addEventListener("click", async () => {
    const it = actor.items.find(i => i.id === b.dataset.id);
    if (!it) return;
    const nivel = Number(it.system.nivel) || 0;
    const costPA = costoPANivel(nivel);
    if (actor.system.pa.value < costPA) { alert(`PA insuficientes (necesitas ${costPA}, tienes ${actor.system.pa.value}).`); return; }

    const atr = it.type === "arte" ? actor.system.atributos.inteligencia : actor.system.atributos.fuerza;

    actor.system.pa.value -= costPA;

    await dbPut("personajes", actor);

    const r = tiradaDanoNivel(nivel, atr, { rango: calc.rango });
    logTirada(actor, `<h4>${esc(it.name)} (Nv.${nivel})</h4>${dadosHTML(r.ds)}<table class="roll-tabla"><tr><td>Daño total</td><td><b>${r.danoTotal}</b></td></tr><tr><td>PV ganados</td><td>${r.pv}</td></tr><tr><td>Suerte</td><td>${r.buenaSuerte ? "✨ Buena" : "💀 Mala"}</td></tr></table>`, "personajes");

    const elPA = qs("#pa-actual");
    if (elPA) elPA.value = actor.system.pa.value;
  }));

  // Oficios
  const oficioSelector = qs("#oficio-selector");
  const oficioPreview = qs("#oficio-preview");
  if (oficioSelector) oficioSelector.addEventListener("change", e => {
    const d = OFICIOS_UNDAVAR.find(o => o.id === e.target.value);
    if (!d || !oficioPreview) { if (oficioPreview) oficioPreview.style.display = "none"; return; }
    oficioPreview.style.display = "";
    oficioPreview.innerHTML = `<div class="oficio-info-nombre">${d.nombre}</div><div class="oficio-info-desc">${d.descripcion}</div><ul>${d.facultades.map(f => `<li>${f}</li>`).join("")}</ul>`;
  });
  const btnAgregarOficio = qs("#btn-agregar-oficio");
  if (btnAgregarOficio) btnAgregarOficio.addEventListener("click", async () => {
    const id = oficioSelector.value;
    if (!id) { alert("Selecciona un oficio primero."); return; }
    const d = OFICIOS_UNDAVAR.find(o => o.id === id);
    const it = itemPorDefecto("oficio", d.nombre);
    it.system = { oficioId: d.id, descripcion: d.descripcion, facultades: d.facultades.join(" "), puntos: 0, maximo: 7, logro: !!d.logro, bonos: d.bonos };
    actor.items.push(it);
    await dbPut("personajes", actor);
    render();
  });
  qsa(".oficio-pts-input").forEach(inp => inp.addEventListener("change", async e => {
    const it = actor.items.find(i => i.id === e.target.dataset.id);
    if (!it) return;
    it.system.puntos = Math.max(0, Math.min(7, parseInt(e.target.value) || 0));
    await dbPut("personajes", actor);
  }));

  const btnRecargarPA = qs("#btn-recargar-pa");
  if (btnRecargarPA) {
    btnRecargarPA.addEventListener("click", async () => {
      actor.system.pa.value = calc.paMaximo;
      await dbPut("personajes", actor);
      render();
    });
  }

  qsa(".campo-ext-estado").forEach(inp => inp.addEventListener("change", async e => {
    const key = e.target.dataset.key;
    const valorNuevo = Math.max(0, Number(e.target.value) || 0);

    if (!actor.system.extensionEstado) actor.system.extensionEstado = {};
    actor.system.extensionEstado[key] = { value: valorNuevo };

    const ext = actor.system.extensionEstado;
    const totalEstados = (Number(ext.hambre?.value) || 0) +
      (Number(ext.sed?.value) || 0) +
      (Number(ext.cansancio?.value) || 0) +
      (Number(ext.fatiga?.value) || 0);

    const heridasQueDeberianExistir = Math.floor(totalEstados / 2);

    if (!actor.system.estado.heridasCausadasPorEstado) {
      actor.system.estado.heridasCausadasPorEstado = 0;
    }

    const heridasPreviasPorEstado = actor.system.estado.heridasCausadasPorEstado;

    if (heridasQueDeberianExistir > heridasPreviasPorEstado) {
      const diferenciaASumar = heridasQueDeberianExistir - heridasPreviasPorEstado;
      const heridaActual = Number(actor.system.estado.ptHerida?.value) || 0;

      const nuevaHerida = Math.min(8, heridaActual + diferenciaASumar);
      actor.system.estado.ptHerida.value = nuevaHerida;

      actor.system.estado.heridasCausadasPorEstado = heridasQueDeberianExistir;

      const penalizacionSalud = Math.floor(nuevaHerida / 4);
      const saludTeoricaMax = Math.max(0, 8 - penalizacionSalud);
      const saludActual = Number(actor.system.estado.ptSalud?.value) || 0;

      if (saludActual > saludTeoricaMax) {
        actor.system.estado.ptSalud.value = saludTeoricaMax;
      }
    } else {
      actor.system.estado.heridasCausadasPorEstado = heridasQueDeberianExistir;
    }

    await dbPut("personajes", actor);
    render();
  }));

  const campoHerida = qs("#campo-herida");
  if (campoHerida) {
    campoHerida.addEventListener("change", async e => {
      const valorIngresado = Math.min(8, Math.max(0, Number(e.target.value) || 0));
      const valorAnterior = Number(actor.system.estado.ptHerida?.value) || 0;

      actor.system.estado.ptHerida.value = valorIngresado;

      if (valorIngresado > valorAnterior) {
        const penalizacionSalud = Math.floor(valorIngresado / 4);
        const saludTeoricaMax = Math.max(0, 8 - penalizacionSalud);
        const saludActual = Number(actor.system.estado.ptSalud?.value) || 0;

        if (saludActual > saludTeoricaMax) {
          actor.system.estado.ptSalud.value = saludTeoricaMax;
        }
      }

      await dbPut("personajes", actor);
      render();
    });
  }

  qsa(".campo-pm-estado, .campo-pm-val").forEach(inp => inp.addEventListener("change", async e => {
    const key = inp.dataset.key;
    const prop = inp.dataset.prop;
    if (!actor.system.puntosYMarcas) actor.system.puntosYMarcas = {};
    if (!actor.system.puntosYMarcas[key]) actor.system.puntosYMarcas[key] = { estado: "I", value: 0 };

    actor.system.puntosYMarcas[key][prop] = prop === "value" ? Number(inp.value) || 0 : inp.value;
    await dbPut("personajes", actor);
  }));

  const btnEquipar = qs("#btn-equipar-desde-inv");
  if (btnEquipar) {
    btnEquipar.addEventListener("click", () => {
      const disponibles = (actor.items || []).filter(
        i => (i.type === "objeto" || i.type === "arma") && !i.system?.equipado
      );

      if (disponibles.length === 0) {
        notificar("⚠️ No tienes objetos desequipados en tu inventario.");
        return;
      }

      const listaHtml = disponibles.map(it => `
        <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; cursor:pointer; padding:8px; background:rgba(255,255,255,0.05); border-radius:4px;">
          <input type="checkbox" class="chk-item-equipar" value="${it.id}" style="width:18px; height:18px; cursor:pointer;">
          <div style="flex:1;">
            <strong style="color:var(--texto-principal, #e0e0e0); display:block;">${esc(it.name)}</strong>
            <small style="color:var(--texto-secundario, #aaa);">${esc(it.system?.descripcion || it.type)}</small>
          </div>
        </label>
      `).join("");

      const modalHtml = `
        <div class="modal-backdrop">
          <div class="modal-contenido" style="max-width: 450px; width: 90%;">
            <h3 style="margin-top:0;">🛡️ Equipar Objetos</h3>
            <p style="font-size:0.9em; color:#aaa;">Selecciona todos los objetos que deseas equipar:</p>
            
            <div style="max-height: 250px; overflow-y: auto; margin: 15px 0; padding-right: 5px;">
              ${listaHtml}
            </div>

            <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:15px;">
              <button id="btn-cancelar-equipar" class="btn-secundario">Cancelar</button>
              <button id="btn-confirmar-equipar" class="btn-primario">Equipar Seleccionados</button>
            </div>
          </div>
        </div>`;

      document.body.insertAdjacentHTML("beforeend", modalHtml);

      qs("#btn-cancelar-equipar").addEventListener("click", () => {
        document.querySelector(".modal-backdrop").remove();
      });

      qs("#btn-confirmar-equipar").addEventListener("click", async () => {
        const seleccionados = qsa(".chk-item-equipar:checked").map(cb => cb.value);

        if (seleccionados.length === 0) {
          notificar("⚠️ No seleccionaste ningún objeto.");
          return;
        }

        let equipadosContador = 0;
        actor.items.forEach(it => {
          if (seleccionados.includes(it.id)) {
            if (!it.system) it.system = {};
            it.system.equipado = true;
            equipadosContador++;
          }
        });

        await dbPut("personajes", actor);
        document.querySelector(".modal-backdrop").remove();
        notificar(`🛡️ Se equiparon ${equipadosContador} objeto(s) correctamente.`);
        render();
      });
    });
  }

  qsa(".btn-desequipar-item").forEach(btn => {
    btn.addEventListener("click", async e => {
      const id = e.target.dataset.id;
      const item = actor.items.find(i => i.id === id);
      if (item) {
        if (!item.system) item.system = {};
        item.system.equipado = false;
        await dbPut("personajes", actor);
        render();
      }
    });
  });

  const btnLimpiarLog = qs("#btn-limpiar-log");
  if (btnLimpiarLog) {
    btnLimpiarLog.addEventListener("click", async () => {
      if (confirm("¿Limpiar todo el registro de tiradas de esta ficha?")) {
        if (!actor.system) actor.system = {};
        actor.system.historialTiradas = [];
        await dbPut("personajes", actor);
        render();
      }
    });
  }
}

function abrirMejoraAtributo(actor, atr, moneda) {
  const actual = Number(actor.system.atributos[atr]) || 0;
  if (actual >= 9) { alert("Este atributo ya está al máximo (9)."); return; }
  const max = 9 - actual;
  const cantidad = prompt(`Mejorar ${atr.toUpperCase()} (actual: ${actual}/9)\nCada punto cuesta 4 ${moneda.toUpperCase()}.\n¿Cuántos puntos quieres subir? (máx. ${max})`, "1");
  const n = parseInt(cantidad);
  if (!n || n <= 0) return;
  if (n > max) { alert("Superarías el máximo de 9."); return; }
  const costoTotal = n * 4;
  const saldo = Number(actor.system.pdc[moneda]) || 0;
  if (saldo < costoTotal) { alert(`No tienes suficientes ${moneda.toUpperCase()}. Necesitas ${costoTotal}, tienes ${saldo}.`); return; }
  actor.system.pdc[moneda] = saldo - costoTotal;
  actor.system.atributos[atr] = actual + n;
  dbPut("personajes", actor).then(render);
}

function abrirCalculadoraErianas() {
  const modal = crearModal("Conversor de Erianas", `
    <div class="calc-conversor">
      <input type="number" id="calc-monto" placeholder="Cantidad...">
      <div class="calc-selects">
        <select id="calc-desde"><option value="oro">Oro</option><option value="rubi">Rubí</option><option value="diamante">Diamante</option></select>
        <span>→</span>
        <select id="calc-hacia"><option value="rubi">Rubí</option><option value="oro">Oro</option><option value="diamante">Diamante</option></select>
      </div>
      <div id="calc-resultado" class="calc-resultado">0</div>
      <p class="nota">1 Rubí = 100 Oro · 1 Diamante = 100 Rubíes</p>
    </div>`);
  const actualizar = () => {
    const v = parseFloat(qs("#calc-monto", modal).value) || 0;
    const desde = qs("#calc-desde", modal).value, hacia = qs("#calc-hacia", modal).value;
    const r = calcularCambioErianas(v, desde, hacia);
    qs("#calc-resultado", modal).textContent = `${r.toLocaleString()} ${hacia.toUpperCase()}`;
  };
  qs("#calc-monto", modal).addEventListener("input", actualizar);
  qs("#calc-desde", modal).addEventListener("change", actualizar);
  qs("#calc-hacia", modal).addEventListener("change", actualizar);
}

function crearModal(titulo, contenidoHTML) {
  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `<div class="modal-caja"><div class="modal-header"><h3>${esc(titulo)}</h3><button class="modal-cerrar">✕</button></div><div class="modal-cuerpo">${contenidoHTML}</div></div>`;
  document.body.appendChild(fondo);
  fondo.querySelector(".modal-cerrar").addEventListener("click", () => fondo.remove());
  fondo.addEventListener("click", e => { if (e.target === fondo) fondo.remove(); });
  return fondo;
}

function abrirEditorItem(actor, tipo, id = null, ubicacionTarget = "") {
  let it = id ? actor.items.find(i => i.id === id) : itemPorDefecto(tipo, "");
  const esNuevo = !id;

  // Normalizar tipo alimento a objeto
  if (tipo === "alimento") tipo = "objeto";
  if (it.type === "alimento") it.type = "objeto";

  tipo = it.type;

  if (!it.system) it.system = {};

  if (esNuevo && ubicacionTarget !== undefined) {
    it.system.ubicacionId = ubicacionTarget;
  }

  const esTienda = actor.tipo === "tienda" || actor.caja !== undefined;

  const camposComunes = `<div class="campo-fila"><label>Nombre</label><input type="text" id="ei-nombre" value="${esc(it.name)}"></div>`;
  let camposEspecificos = "";

  const opcionGlobalTiendas = (esTienda && esNuevo) ? `
    <div class="campo-fila" style="margin-top: 10px; background: rgba(212,175,55,0.1); padding: 8px; border-radius: 4px; border: 1px solid rgba(212,175,55,0.3);">
      <label style="color:#d4af37; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="ei-global-tiendas" style="width:16px; height:16px; cursor:pointer;">
        🌐 Añadir a todas las tiendas registradas
      </label>
    </div>` : "";

  if (tipo === "arte" || tipo === "arma") {
    camposEspecificos = `
      <div class="campo-fila"><label>Nivel (0-4)</label><input type="number" id="ei-nivel" min="0" max="4" value="${it.system.nivel || 0}"></div>
      <div class="campo-fila"><label>Conjuro / activación</label><textarea id="ei-conjuro" rows="2">${esc(it.system.conjuro)}</textarea></div>
      <div class="campo-fila"><label>Descripción / efecto</label><textarea id="ei-descripcion" rows="3">${esc(it.system.descripcion)}</textarea></div>`;

    if (esTienda || tipo === "arma") {
      camposEspecificos += `
        <div class="campo-fila precios"><label>Precio</label>
          <input type="number" id="ei-precio-oro" placeholder="Oro" value="${it.system.precio_oro || 0}">
          <input type="number" id="ei-precio-rubi" placeholder="Rubí" value="${it.system.precio_rubi || 0}">
          <input type="number" id="ei-precio-diamante" placeholder="Diamante" value="${it.system.precio_diamante || 0}">
        </div>`;
    }
  } else if (tipo === "objeto" || tipo === "elixir") {
    camposEspecificos = `
      <div class="campo-fila"><label>Cantidad</label><input type="number" id="ei-cantidad" min="0" value="${it.system.cantidad || 1}"></div>
      <div class="campo-fila"><label>Efecto / Descripción</label><textarea id="ei-efecto" rows="2">${esc(it.system.efecto || it.system.descripcion)}</textarea></div>
      <div class="campo-fila"><label>Duración</label><input type="text" id="ei-duracion" value="${esc(it.system.duracion)}"></div>
      <div class="campo-fila"><label>Enfriamiento</label><input type="text" id="ei-enfriamiento" value="${esc(it.system.enfriamiento)}"></div>
      <div class="campo-fila"><label>Nivel</label><input type="text" id="ei-nivelitem" value="${esc(it.system.nivel)}"></div>
      <div class="campo-fila precios"><label>Precio</label>
        <input type="number" id="ei-precio-oro" placeholder="Oro" value="${it.system.precio_oro || 0}">
        <input type="number" id="ei-precio-rubi" placeholder="Rubí" value="${it.system.precio_rubi || 0}">
        <input type="number" id="ei-precio-diamante" placeholder="Diamante" value="${it.system.precio_diamante || 0}">
      </div>`;
  } else if (tipo === "equipo") {
    camposEspecificos = `
      <div class="campo-fila"><label>Cantidad</label><input type="number" id="ei-cantidad" min="0" value="${it.system.cantidad || 1}"></div>
      <div class="campo-fila"><label>Ranura</label>
        <select id="ei-slot">
          ${["cabeza", "superior", "collares", "accesorios", "inferior", "pies"].map(s => `<option value="${s}" ${it.system.slot === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="campo-fila"><label>Reducción de daño</label><input type="number" id="ei-reduccion" value="${it.system.reduccion_dano || 0}"></div>
      <div class="campo-fila"><label>Efecto / Descripción</label><textarea id="ei-efecto" rows="2">${esc(it.system.efecto || it.system.descripcion)}</textarea></div>
      <div class="campo-fila"><label>Enfriamiento</label><input type="text" id="ei-enfriamiento" value="${esc(it.system.enfriamiento)}"></div>
      <div class="campo-fila precios"><label>Precio</label>
        <input type="number" id="ei-precio-oro" placeholder="Oro" value="${it.system.precio_oro || 0}">
        <input type="number" id="ei-precio-rubi" placeholder="Rubí" value="${it.system.precio_rubi || 0}">
        <input type="number" id="ei-precio-diamante" placeholder="Diamante" value="${it.system.precio_diamante || 0}">
      </div>`;
  }

  const modal = crearModal(
    `${esNuevo ? "Nuevo" : "Editar"} ${tipo}`,
    `${camposComunes}${camposEspecificos}${opcionGlobalTiendas}<div class="modal-acciones"><button class="btn-primario" id="ei-guardar">Guardar</button></div>`
  );

  qs("#ei-guardar", modal).addEventListener("click", async () => {
    // 1. EXTRAER PRIMERO LOS DATOS DE LOS INPUTS DEL MODAL
    it.name = qs("#ei-nombre", modal).value.trim() || ("Nuevo " + tipo);
    it.type = tipo;

    if (tipo === "arte" || tipo === "arma") {
      it.system.nivel = Math.max(0, Math.min(4, parseInt(qs("#ei-nivel", modal).value) || 0));
      it.system.conjuro = qs("#ei-conjuro", modal)?.value || "";
      it.system.descripcion = qs("#ei-descripcion", modal)?.value || "";

      const pOro = qs("#ei-precio-oro", modal);
      if (pOro) {
        it.system.precio_oro = parseFloat(pOro.value) || 0;
        it.system.precio_rubi = parseFloat(qs("#ei-precio-rubi", modal)?.value) || 0;
        it.system.precio_diamante = parseFloat(qs("#ei-precio-diamante", modal)?.value) || 0;
      }
    } else if (tipo === "objeto" || tipo === "elixir") {
      it.system.cantidad = parseInt(qs("#ei-cantidad", modal)?.value) || 1;
      const textoEfecto = qs("#ei-efecto", modal)?.value || "";
      it.system.efecto = textoEfecto;
      it.system.descripcion = textoEfecto; // Guarda en ambos campos por compatibilidad
      it.system.duracion = qs("#ei-duracion", modal)?.value || "";
      it.system.enfriamiento = qs("#ei-enfriamiento", modal)?.value || "";
      it.system.nivel = qs("#ei-nivelitem", modal)?.value || "";
      it.system.precio_oro = parseFloat(qs("#ei-precio-oro", modal)?.value) || 0;
      it.system.precio_rubi = parseFloat(qs("#ei-precio-rubi", modal)?.value) || 0;
      it.system.precio_diamante = parseFloat(qs("#ei-precio-diamante", modal)?.value) || 0;
    } else if (tipo === "equipo") {
      it.system.cantidad = parseInt(qs("#ei-cantidad", modal)?.value) || 1;
      it.system.slot = qs("#ei-slot", modal)?.value || "superior";
      it.system.reduccion_dano = parseFloat(qs("#ei-reduccion", modal)?.value) || 0;
      const textoEfecto = qs("#ei-efecto", modal)?.value || "";
      it.system.efecto = textoEfecto;
      it.system.descripcion = textoEfecto;
      it.system.enfriamiento = qs("#ei-enfriamiento", modal)?.value || "";
      it.system.precio_oro = parseFloat(qs("#ei-precio-oro", modal)?.value) || 0;
      it.system.precio_rubi = parseFloat(qs("#ei-precio-rubi", modal)?.value) || 0;
      it.system.precio_diamante = parseFloat(qs("#ei-precio-diamante", modal)?.value) || 0;
    }

    const esGlobal = qs("#ei-global-tiendas", modal)?.checked;

    // 2. PROCESAR GUARDADO TRAS HABER ACTUALIZADO 'it'
    if (esGlobal && esTienda) {
      const todasLasTiendas = await dbGetAll("tiendas");

      for (const t of todasLasTiendas) {
        const copiaItem = JSON.parse(JSON.stringify(it));
        copiaItem.id = crypto.randomUUID();

        if (!t.items) t.items = [];
        t.items.push(copiaItem);

        await dbPut("tiendas", t);
      }

      if (typeof notificar === "function") {
        notificar(`✨ ¡"${it.name}" añadido a las ${todasLasTiendas.length} tiendas con éxito!`);
      }
    } else {
      if (esNuevo) actor.items.push(it);

      let store = "personajes";
      if (actor.tipo === "npc" || (actor.system && actor.system.datos && actor.system.datos.raza)) {
        store = "npcs";
      } else if (esTienda) {
        store = "tiendas";
      }

      await dbPut(store, actor);
    }

    modal.remove();
    render();
  });
}

// ------------------------------------------------------------
// LISTENERS GLOBALES DE INVENTARIO (Desplegable y Modal Custom)
// ------------------------------------------------------------
document.addEventListener("change", async (e) => {
  if (e.target && e.target.classList.contains("sel-mover-item")) {
    const itemId = e.target.dataset.id;
    const nuevaUbicacion = e.target.value;

    const personActual = typeof actor !== "undefined" ? actor : (typeof state !== "undefined" && state.personajeId ? await dbGet("personajes", state.personajeId) : null);
    if (!personActual) return;

    const item = personActual.items.find(i => i.id === itemId);
    if (item) {
      if (!item.system) item.system = {};
      item.system.ubicacionId = nuevaUbicacion;

      await dbPut("personajes", personActual);
      if (typeof render === "function") render();
    }
  }
});

document.addEventListener("click", async (e) => {
  const personActual = typeof actor !== "undefined" ? actor : (typeof state !== "undefined" && state.personajeId ? await dbGet("personajes", state.personajeId) : null);
  if (!personActual) return;

  // Botón enviar ítem suelto
  if (e.target && e.target.classList.contains("btn-transferir-item")) {
    const itemId = e.target.dataset.id;
    const itemTarget = personActual.items.find(i => i.id === itemId);
    if (itemTarget) abrirModalTransferirItem(personActual, itemTarget);
    return;
  }

  // Botón enviar contenedor completo
  if (e.target && e.target.classList.contains("btn-transferir-contenedor")) {
    const contId = e.target.dataset.id;
    const contTarget = personActual.items.find(i => i.id === contId);
    if (contTarget) abrirModalTransferirItem(personActual, contTarget);
    return;
  }

  // A) Botón "+" rápido dentro de un contenedor específico
  if (e.target && e.target.classList.contains("btn-add-item-rapido")) {
    const tipo = e.target.dataset.tipo;
    const ubicacionId = e.target.dataset.ubicacion || "";
    abrirEditorItem(personActual, tipo, null, ubicacionId);
    return;
  }

  // B) Gestión del modal de Contenedor Custom
  const modal = document.getElementById("modal-contenedor");
  const inputId = document.getElementById("input-id-contenedor");
  const inputNombre = document.getElementById("input-nombre-contenedor");
  const inputCapacidad = document.getElementById("input-capacidad-contenedor");
  const btnEliminar = document.getElementById("btn-eliminar-contenedor");
  const modalTitulo = document.getElementById("modal-contenedor-titulo");

  if (e.target && e.target.id === "btn-crear-contenedor") {
    if (modal) {
      if (modalTitulo) modalTitulo.textContent = "📦 Nuevo Contenedor";
      if (inputId) inputId.value = "";
      if (inputNombre) inputNombre.value = "";
      if (inputCapacidad) inputCapacidad.value = "15";
      if (btnEliminar) btnEliminar.style.display = "none";
      modal.style.display = "flex";
      if (inputNombre) inputNombre.focus();
    }
  }

  if (e.target && e.target.classList.contains("btn-config-capacidad")) {
    const contId = e.target.dataset.id;
    const cont = personActual.items.find(i => i.id === contId);
    if (!cont || !modal) return;

    if (modalTitulo) modalTitulo.textContent = "⚙️ Editar Contenedor";
    if (inputId) inputId.value = cont.id;
    if (inputNombre) inputNombre.value = cont.name;
    if (inputCapacidad) inputCapacidad.value = cont.system?.capacidad ?? 10;
    if (btnEliminar) btnEliminar.style.display = "block";
    modal.style.display = "flex";
    if (inputNombre) inputNombre.focus();
  }

  if (e.target && e.target.id === "btn-cancelar-contenedor") {
    if (modal) modal.style.display = "none";
  }

  if (e.target && e.target.id === "btn-guardar-contenedor") {
    const idExistente = inputId ? inputId.value : "";
    const nombre = inputNombre ? inputNombre.value.trim() : "";
    const capacidad = parseInt(inputCapacidad?.value, 10) || 10;

    if (!nombre) return;

    if (idExistente) {
      const cont = personActual.items.find(i => i.id === idExistente);
      if (cont) {
        cont.name = nombre;
        if (!cont.system) cont.system = {};
        cont.system.capacidad = capacidad;
      }
    } else {
      const nuevoContenedor = {
        id: "cont_" + Date.now(),
        name: nombre,
        type: "objeto",
        system: {
          cantidad: 1,
          equipado: true,
          esContenedor: true,
          capacidad: capacidad,
          descripcion: "Contenedor de inventario personalizado."
        }
      };
      personActual.items.push(nuevoContenedor);
    }

    await dbPut("personajes", personActual);
    if (modal) modal.style.display = "none";
    if (typeof render === "function") render();
  }

  if (e.target && e.target.id === "btn-eliminar-contenedor") {
    const idExistente = inputId ? inputId.value : "";
    if (!idExistente) return;

    if (confirm("¿Seguro que deseas borrar este contenedor? Los objetos dentro volverán a 'Bolsillos / En mano'.")) {
      personActual.items.forEach(i => {
        if (i.system?.ubicacionId === idExistente) {
          i.system.ubicacionId = "";
        }
      });

      personActual.items = personActual.items.filter(i => i.id !== idExistente);

      await dbPut("personajes", personActual);
      if (modal) modal.style.display = "none";
      if (typeof render === "function") render();
    }
  }
});

// ------------------------------------------------------------
// VISTA: FICHA DE PNJ / BESTIA
// ------------------------------------------------------------
async function renderFichaNPC() {
  const actor = await dbGet("npcs", state.npcId);
  if (!actor) { ir("inicio"); return; }
  const s = actor.system;

  // Calculamos derivados dinámicamente como en la ficha del jugador
  const calc = typeof calcularDerivados === "function" ? calcularDerivados(s, actor.items) : {};

  const listaRazas = Object.keys(BESTIARIO_UNDAVAR);
  const esRazaOficial = listaRazas.includes(s.datos.raza);

  const rangoActual = s.datos?.rangoManual || calc.rango || "Sin Rango";
  const esModoBestia = !!s.datos?.sinRangoPA;

  // Buscar el rango actual para obtener su PA correspondiente
  const listaRangosRef = typeof RANGOS_UNDAVAR !== "undefined" ? RANGOS_UNDAVAR.map(r => r.nombre) : [];
  const idxRango = listaRangosRef.indexOf(rangoActual);
  const rangoObj = typeof RANGOS_UNDAVAR !== "undefined" ? RANGOS_UNDAVAR.find(r => r.nombre === rangoActual) : null;

  // Priorizamos el PA definido por el rango manual o el objeto de rango
  const paMaximo = s.pa?.max 
    ?? rangoObj?.pa 
    ?? rangoObj?.paMaximo 
    ?? (idxRango >= 0 ? idxRango + 2 : null) 
    ?? 2;

  app.innerHTML = `
  <section class="vista-ficha">
    <header class="sheet-header">
      <button class="btn-volver" id="btn-volver">← Inicio</button>
      <div class="header-izquierda">
        <div class="nombre-bloque">
          <input type="text" id="campo-nombre" value="${esc(actor.nombre)}" placeholder="Nombre del PNJ">
          
          <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
            <label style="font-size:0.8em; color:#aaa; cursor:pointer; display:flex; align-items:center; gap:4px; background:rgba(0,0,0,0.3); padding:3px 6px; border-radius:4px; border:1px solid #444;">
              <input type="checkbox" id="chk-modo-bestia" ${esModoBestia ? "checked" : ""}> 🐾 Sin PA
            </label>
          </div>

          <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
            ${!esModoBestia ? `<div class="rango-display" id="btn-cambiar-rango-npc" style="cursor:pointer;" title="Clic para cambiar rango">${esc(rangoActual)} ✎</div>` : ""}
            <select id="select-raza-preset" style="flex:1;">
              <option value="Personalizado" ${!esRazaOficial ? "selected" : ""}>-- Personalizado / Otra Raza --</option>
              ${listaRazas.map(r => `<option value="${r}" ${s.datos.raza === r ? "selected" : ""}>${r}</option>`).join("")}
            </select>
          </div>

          <input type="text" id="campo-raza" value="${esc(s.datos.raza)}" placeholder="Nombre de la Raza" style="${esRazaOficial ? 'display:none;' : 'margin-top:4px;'}">
        </div>
      </div>
<div class="header-tiradas">
        ${!esModoBestia ? `<button class="roll-btn" id="btn-recargar-pa-npc" title="Restaurar PA al máximo">⚡ Recargar PA (${paMaximo})</button>` : ""}
        <button class="roll-btn" id="roll-estandar">🎲 Tirada</button>
        <button class="roll-btn" id="btn-toggle-mod-npc" style="background:#2a2a35; border:1px solid #d4af37; color:#d4af37;" title="Configurar modificadores">⚙️ Mod.</button>
        <button class="roll-btn" id="roll-ataque">🗡️ Ataque</button>
        <button class="roll-btn" id="btn-exportar-actor" title="Exportar .undavar">⇩</button>
      </div>

      <!-- Panel de Modificadores para PNJ (sin PdC) -->
      <div id="panel-mod-npc" style="display:none; width:100%; margin-top:10px; background:rgba(0,0,0,0.4); border:1px solid rgba(212,175,55,0.3); border-radius:6px; padding:10px; box-sizing:border-box;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px;">
          <label style="color:#d4af37; font-weight:bold;">Modo de Modificador:</label>
          <select id="mod-select-tipo-accion-npc" style="background:#121215; border:1px solid #d4af37; color:#fff; padding:4px 8px; border-radius:4px; font-weight:bold;">
            <option value="tirada">🎲 Tirada Estándar</option>
            <option value="ataque">🗡️ Tirada de Ataque</option>
          </select>
        </div>

        <!-- BLOQUE 1: TIRADA ESTÁNDAR PNJ -->
        <div id="bloque-mod-tirada-npc" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; font-size:0.85em; color:#ccc;">
          <div style="display:flex; align-items:center; gap:6px;">
            <label style="color:#d4af37; font-weight:bold;">Atributo (Atr/2):</label>
            <select id="mod-select-atr-npc" style="background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px;">
              <option value="ninguno">Ninguno (+0)</option>
              <option value="fuerza">Fuerza (${Math.floor((s.atributos.fuerza || 0) / 2)})</option>
              <option value="velocidad">Velocidad (${Math.floor((s.atributos.velocidad || 0) / 2)})</option>
              <option value="agilidad">Agilidad (${Math.floor((s.atributos.agilidad || 0) / 2)})</option>
              <option value="inteligencia">Inteligencia (${Math.floor((s.atributos.inteligencia || 0) / 2)})</option>
            </select>
          </div>

          ${!esModoBestia ? `
          <div style="display:flex; align-items:center; gap:6px;">
            <label style="color:#d4af37; font-weight:bold;">Gastar PA:</label>
            <input type="number" id="mod-input-pa-npc" value="0" min="0" max="${s.pa?.value || 0}" style="width:45px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
          </div>` : ""}

          <div style="display:flex; align-items:center; gap:6px;">
            <label style="color:#d4af37; font-weight:bold;">Mod. Fijo:</label>
            <input type="number" id="mod-input-fijo-npc" value="0" style="width:45px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
          </div>
        </div>

        <!-- BLOQUE 2: ATAQUE PNJ -->
        <div id="bloque-mod-ataque-npc" style="display:none; gap:12px; align-items:center; flex-wrap:wrap; font-size:0.85em; color:#ccc;">
          <div style="display:flex; align-items:center; gap:6px;">
            <label style="color:#d4af37; font-weight:bold;">Dados Extra (d6):</label>
            <input type="number" id="mod-input-dados-ataque-npc" value="0" min="0" style="width:50px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
          </div>

          <div style="display:flex; align-items:center; gap:6px;">
            <label style="color:#d4af37; font-weight:bold;">Mod. Fijo a Daño:</label>
            <input type="number" id="mod-input-fijo-ataque-npc" value="0" style="width:55px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
          </div>
        </div>
      </div>
    </header>

    <section class="estado-atributos-bar">
      <div class="bloque-estado">
        <div class="bloque-titulo">Estado</div>
        <div class="estado-fila"><label>Pt. Herida</label><input type="number" id="campo-herida" value="${s.estado.ptHerida.value}" min="0" max="8"><span>/8</span></div>
        <div class="estado-fila"><label>Pt. Salud</label><input type="number" id="campo-salud" value="${s.estado.ptSalud.value}" min="0" max="8"><span>/8</span></div>
        ${!esModoBestia ? `<div class="estado-fila"><label>PA</label><input type="number" id="campo-pa" value="${s.pa.value}" min="0" max="${paMaximo}"><span>/${paMaximo}</span></div>` : ""}
      </div>
      <div class="bloque-atributos">
        <div class="bloque-titulo">Atributos</div>
        <div class="atributos-grid">
          ${["fuerza", "velocidad", "agilidad", "inteligencia"].map(atr => `
          <div class="atributo-item"><label>${atr[0].toUpperCase() + atr.slice(1)}</label>
          <input type="number" class="campo-atr-npc" data-atr="${atr}" value="${s.atributos[atr] || 0}" min="0" max="9"></div>`).join("")}
        </div>
      </div>
    </section>

    <div class="campo-fila" style="margin:14px 0;"><label>Descripción / notas</label><textarea id="campo-desc-npc" rows="4">${esc(s.datos.descripcion || "")}</textarea></div>

    <div class="seccion-acciones">
      <button class="btn-secundario" id="btn-nueva-arte">+ Arte / Habilidad</button>
      <button class="btn-secundario" id="btn-nueva-arma">+ Arma</button>
    </div>
    <div class="items-lista">
      ${actor.items.map(it => `
      <div class="item-fila" data-item-id="${it.id}">
        <span class="item-nombre">${esc(it.name)}</span>
        <span class="item-badge">Nv ${it.system?.nivel ?? 0}</span>
        <div class="item-botones">
          <button class="btn-usar-arte" data-id="${it.id}">▶</button>
          <button class="btn-editar-item" data-id="${it.id}">✎</button>
          <button class="btn-borrar-item" data-id="${it.id}">✕</button>
        </div>
      </div>`).join("") || `<p class="vacio">Sin habilidades.</p>`}
    </div>

    <div class="log-tiradas">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <h3 style="margin:0;">Registro de tiradas</h3>
        <button class="btn-secundario chico" id="btn-limpiar-log">🧹 Limpiar</button>
      </div>
      <div id="tirada-log">
        ${(s.historialTiradas || []).map(h => `<div class="tirada-item">${h}</div>`).join("") || `<p class="vacio">Sin tiradas en esta sesión.</p>`}
      </div>
    </div>
  </section>`;

  qs("#btn-volver")?.addEventListener("click", () => ir("inicio"));
  qs("#btn-exportar-actor")?.addEventListener("click", () => exportarPerfil("npcs", actor.id));
  qs("#campo-nombre")?.addEventListener("change", async e => { actor.nombre = e.target.value; await dbPut("npcs", actor); });
  qs("#campo-raza")?.addEventListener("change", async e => { actor.system.datos.raza = e.target.value; await dbPut("npcs", actor); });

  // Cambiar Rango Manual en PNJ
  qs("#btn-cambiar-rango-npc")?.addEventListener("click", () => {
    const listaRangos = typeof RANGOS_UNDAVAR !== "undefined" 
      ? RANGOS_UNDAVAR.map(r => r.nombre) 
      : ["Novato", "Aspirante", "Iniciado", "Experto", "Maestro", "Gran Maestro", "Leyenda"];
    
    const rangoActualVal = actor.system.datos?.rangoManual || "Sin Rango";

    const modalHtml = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <label style="font-size:0.9em; color:#aaa;">Selecciona un rango de la lista:</label>
        <select id="modal-select-rango" style="width:100%; padding:8px; background:#121215; color:#fff; border:1px solid #444; border-radius:4px;">
          ${listaRangos.map(r => `<option value="${r}" ${r === rangoActualVal ? "selected" : ""}>${r}</option>`).join("")}
          <option value="custom" ${!listaRangos.includes(rangoActualVal) ? "selected" : ""}>-- Personalizado / Otro --</option>
        </select>

        <div id="bloque-rango-custom" style="display:${!listaRangos.includes(rangoActualVal) ? "block" : "none"};">
          <label style="font-size:0.85em; color:#aaa; display:block; margin-bottom:4px;">Nombre del rango personalizado:</label>
          <input type="text" id="input-rango-custom" value="${esc(rangoActualVal)}" placeholder="Escribe el rango..." style="width:100%; padding:8px; background:#121215; color:#fff; border:1px solid #444; border-radius:4px; box-sizing:border-box;">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
          <button class="btn-primario" id="btn-guardar-rango-npc">Guardar Rango</button>
        </div>
      </div>
    `;

    const modal = crearModal("👑 Seleccionar Rango del PNJ", modalHtml);

    const selectRango = qs("#modal-select-rango", modal);
    const bloqueCustom = qs("#bloque-rango-custom", modal);
    const inputCustom = qs("#input-rango-custom", modal);

    selectRango?.addEventListener("change", (e) => {
      if (bloqueCustom) bloqueCustom.style.display = e.target.value === "custom" ? "block" : "none";
    });

    qs("#btn-guardar-rango-npc", modal)?.addEventListener("click", async () => {
      let finalRango = selectRango ? selectRango.value : "Sin Rango";
      if (finalRango === "custom" && inputCustom) {
        finalRango = inputCustom.value.trim() || "Sin Rango";
      }

      if (!actor.system.datos) actor.system.datos = {};
      actor.system.datos.rangoManual = finalRango;

      // Calcular y asignar el nuevo PA según el rango seleccionado
      const listaRangosRef = typeof RANGOS_UNDAVAR !== "undefined" ? RANGOS_UNDAVAR.map(r => r.nombre) : [];
      const idxRangoNuev = listaRangosRef.indexOf(finalRango);
      const matchRango = typeof RANGOS_UNDAVAR !== "undefined" ? RANGOS_UNDAVAR.find(r => r.nombre === finalRango) : null;

      const nuevoPA = matchRango?.pa 
        ?? matchRango?.paMaximo 
        ?? (idxRangoNuev >= 0 ? idxRangoNuev + 2 : 6);

      if (!actor.system.pa) actor.system.pa = { value: nuevoPA, max: nuevoPA };
      actor.system.pa.max = nuevoPA;
      actor.system.pa.value = nuevoPA;

      await dbPut("npcs", actor);
      modal.remove();
      render();
    });
  });

  // Recargar PA en PNJ
  qs("#btn-recargar-pa-npc")?.addEventListener("click", async () => {
    actor.system.pa.value = paMaximo;
    await dbPut("npcs", actor);
    render();
  });

  qs("#select-raza-preset")?.addEventListener("change", async e => {
    const seleccion = e.target.value;

    if (seleccion === "Personalizado") {
      actor.system.datos.raza = "Personalizado";
    } else {
      actor.system.datos.raza = seleccion;

      const preset = BESTIARIO_UNDAVAR[seleccion];
      if (preset) {
        actor.system.datos.descripcion = preset.descripcion || "";
        actor.system.atributos = { ...preset.atributos };

        preset.artes.forEach(arteBase => {
          const yaTiene = actor.items.some(i => i.name === arteBase.name);
          if (!yaTiene) {
            const copiaArte = JSON.parse(JSON.stringify(arteBase));
            copiaArte.id = crypto.randomUUID();
            actor.items.push(copiaArte);
          }
        });
      }
    }

    await dbPut("npcs", actor);
    render();
  });

  qs("#campo-desc-npc")?.addEventListener("change", async e => { actor.system.datos.descripcion = e.target.value; await dbPut("npcs", actor); });
  qs("#campo-herida")?.addEventListener("change", async e => { actor.system.estado.ptHerida.value = Math.min(8, Number(e.target.value) || 0); await dbPut("npcs", actor); render(); });
  qs("#campo-salud")?.addEventListener("change", async e => { actor.system.estado.ptSalud.value = Number(e.target.value) || 0; await dbPut("npcs", actor); render(); });
  qs("#campo-pa")?.addEventListener("change", async e => { actor.system.pa.value = Number(e.target.value) || 0; await dbPut("npcs", actor); render(); });

  qsa(".campo-atr-npc").forEach(inp => inp.addEventListener("change", async e => {
    actor.system.atributos[e.target.dataset.atr] = Math.min(9, Number(e.target.value) || 0);
    await dbPut("npcs", actor); render();
  }));

  // Toggle panel modificadores PNJ
  const btnToggleModNPC = qs("#btn-toggle-mod-npc");
  const panelModNPC = qs("#panel-mod-npc");
  if (btnToggleModNPC && panelModNPC) {
    btnToggleModNPC.addEventListener("click", () => {
      panelModNPC.style.display = panelModNPC.style.display === "none" ? "block" : "none";
    });
  }

  const selectModTipoAccionNPC = qs("#mod-select-tipo-accion-npc");
  const bloqueModTiradaNPC = qs("#bloque-mod-tirada-npc");
  const bloqueModAtaqueNPC = qs("#bloque-mod-ataque-npc");

  if (selectModTipoAccionNPC) {
    selectModTipoAccionNPC.addEventListener("change", (e) => {
      if (e.target.value === "ataque") {
        if (bloqueModTiradaNPC) bloqueModTiradaNPC.style.display = "none";
        if (bloqueModAtaqueNPC) bloqueModAtaqueNPC.style.display = "flex";
      } else {
        if (bloqueModTiradaNPC) bloqueModTiradaNPC.style.display = "flex";
        if (bloqueModAtaqueNPC) bloqueModAtaqueNPC.style.display = "none";
      }
    });
  }

  const limpiarPanelModNPC = () => {
    if (qs("#mod-select-tipo-accion-npc")) qs("#mod-select-tipo-accion-npc").value = "tirada";
    if (qs("#mod-select-atr-npc")) qs("#mod-select-atr-npc").value = "ninguno";
    if (qs("#mod-input-pa-npc")) qs("#mod-input-pa-npc").value = "0";
    if (qs("#mod-input-fijo-npc")) qs("#mod-input-fijo-npc").value = "0";
    if (qs("#mod-input-dados-ataque-npc")) qs("#mod-input-dados-ataque-npc").value = "0";
    if (qs("#mod-input-fijo-ataque-npc")) qs("#mod-input-fijo-ataque-npc").value = "0";
    if (bloqueModTiradaNPC) bloqueModTiradaNPC.style.display = "flex";
    if (bloqueModAtaqueNPC) bloqueModAtaqueNPC.style.display = "none";
    if (panelModNPC) panelModNPC.style.display = "none";
  };

  qs("#roll-estandar")?.addEventListener("click", async () => {
    let modAtributo = 0;
    let modPA = 0;
    let modFijo = 0;
    let gastoPA = 0;

    if (panelModNPC && selectModTipoAccionNPC?.value === "tirada") {
      const selAtr = qs("#mod-select-atr-npc")?.value;
      if (selAtr && selAtr !== "ninguno") {
        modAtributo = Math.floor((Number(actor.system.atributos[selAtr]) || 0) / 2);
      }

      gastoPA = Math.max(0, parseInt(qs("#mod-input-pa-npc")?.value) || 0);
      if (gastoPA > (actor.system.pa?.value || 0)) {
        alert(`PA insuficientes en PNJ. Disponibles: ${actor.system.pa?.value || 0}`);
        return;
      }
      modPA = gastoPA;
      modFijo = parseInt(qs("#mod-input-fijo-npc")?.value) || 0;
    }

    const r = tiradaEstandar();
    const aciertosBase = r.aciertos;
    const modTotal = modAtributo + modPA + modFijo;
    const aciertosTotales = aciertosBase + modTotal;

    if (gastoPA > 0) {
      actor.system.pa.value -= gastoPA;
      await dbPut("npcs", actor);
      render();
    }

    limpiarPanelModNPC();

    const modTexto = modTotal !== 0 ? ` (${aciertosBase} base ${modTotal > 0 ? '+' : ''}${modTotal} mod) = <b style="color:#55ff55;">${aciertosTotales}</b>` : `<b style="color:#55ff55;">${aciertosTotales}</b>`;

    logTirada(actor, `<h4>Tirada estándar</h4>${dadosHTML(r.ds)}<table class="roll-tabla"><tr><td>Aciertos</td><td>${modTexto}</td></tr><tr><td>Suerte</td><td>${r.buenaSuerte ? "✨ Buena" : "💀 Mala"}</td></tr></table>`, "npcs");
  });

  qs("#roll-ataque")?.addEventListener("click", () => {
    let dadosExtra = 0;
    let modFijoAtaque = 0;

    if (panelModNPC && selectModTipoAccionNPC?.value === "ataque") {
      dadosExtra = Math.max(0, parseInt(qs("#mod-input-dados-ataque-npc")?.value) || 0);
      modFijoAtaque = parseInt(qs("#mod-input-fijo-ataque-npc")?.value) || 0;
    }

    const cantDadosTotal = 2 + dadosExtra;
    const ds = [];
    let danoBase = 0;
    let pv = 0;

    for (let i = 0; i < cantDadosTotal; i++) {
      const val = Math.floor(Math.random() * 6) + 1;
      ds.push(val);
      if ([2, 4, 6].includes(val)) danoBase++;
      else pv += val;
    }

    const sumaTotal = ds.reduce((a, b) => a + b, 0);
    const buenaSuerte = sumaTotal > 12;
    const danoFinal = Math.max(0, danoBase + modFijoAtaque);

    limpiarPanelModNPC();

    const detalleDano = modFijoAtaque !== 0 
      ? `${danoBase} base ${modFijoAtaque > 0 ? '+' : ''}${modFijoAtaque} mod = <b style="color:#ff5555;">${danoFinal}</b>` 
      : `<b style="color:#ff5555;">${danoFinal}</b>`;

    logTirada(actor, `<h4>Ataque (${cantDadosTotal}d6)</h4>${dadosHTML(ds)}<table class="roll-tabla"><tr><td>Daño</td><td>${detalleDano}</td></tr><tr><td>Suerte</td><td>${buenaSuerte ? "✨ Buena" : "💀 Mala"}</td></tr></table>`, "npcs");
  });
  qs("#btn-nueva-arte")?.addEventListener("click", () => abrirEditorItem(actor, "arte"));
  qs("#btn-nueva-arma")?.addEventListener("click", () => abrirEditorItem(actor, "arma"));
  qsa(".btn-editar-item").forEach(b => b.addEventListener("click", () => abrirEditorItem(actor, null, b.dataset.id)));
  qsa(".btn-borrar-item").forEach(b => b.addEventListener("click", async () => { actor.items = actor.items.filter(i => i.id !== b.dataset.id); await dbPut("npcs", actor); render(); }));

  // Listener del checkbox "Modo Bestia"
  qs("#chk-modo-bestia")?.addEventListener("change", async e => {
    if (!actor.system.datos) actor.system.datos = {};
    actor.system.datos.sinRangoPA = e.target.checked;
    await dbPut("npcs", actor);
    render();
  });

  // Uso de habilidad/arte
  qsa(".btn-usar-arte").forEach(b => b.addEventListener("click", async () => {
    const it = actor.items.find(i => i.id === b.dataset.id);
    if (!it) return;
    
    const nivel = it.system?.nivel !== undefined ? Number(it.system.nivel) : 0;
    const esModoBestia = !!actor.system.datos?.sinRangoPA;

    if (!esModoBestia) {
      const costPA = typeof costoPANivel === "function" ? costoPANivel(nivel) : nivel;
      if ((actor.system.pa?.value || 0) < costPA) {
        alert(`PA insuficientes (necesitas ${costPA}, el PNJ tiene ${actor.system.pa?.value || 0}).`);
        return;
      }
      actor.system.pa.value -= costPA;
      await dbPut("npcs", actor);
    }

    const atr = it.type === "arte" ? (actor.system.atributos.inteligencia || 0) : (actor.system.atributos.fuerza || 0);
    const rangoActual = actor.system.datos?.rangoManual || "Sin Rango";
    
    // Enviar el rango manual del PNJ
    const r = tiradaDanoNivel(nivel, atr, { rango: rangoActual });
    
    await logTirada(actor, `<h4>${esc(it.name)} (Nv.${nivel})</h4>${dadosHTML(r.ds)}<table class="roll-tabla"><tr><td>Daño total</td><td><b>${r.danoTotal}</b></td></tr></table>`, "npcs");
    if (!esModoBestia) render();
  }));

  // Limpiar registro de tiradas
  qs("#btn-limpiar-log")?.addEventListener("click", async () => {
    if (confirm("¿Limpiar todo el registro de tiradas de este PNJ?")) {
      if (!actor.system) actor.system = {};
      actor.system.historialTiradas = [];
      await dbPut("npcs", actor);
      render();
    }
  });
}

// ------------------------------------------------------------
// VISTA: TIENDA
// ------------------------------------------------------------
async function renderTienda() {
  if (!state.tiendaId) { ir("inicio"); return; }

  const tienda = await dbGet("tiendas", state.tiendaId);
  if (!tienda) { ir("inicio"); return; }

  const personajes = await dbGetAll("personajes");

  if (!tienda.caja) tienda.caja = { oro: 0, rubi: 0, diamante: 0 };

  const filaItem = (item) => {
    const precio = item.system.precio_diamante ? `${item.system.precio_diamante} Diamante` : item.system.precio_rubi ? `${item.system.precio_rubi} Rubí` : `${item.system.precio_oro || 0} Oro`;
    return `
    <div class="tienda-item" data-item-id="${item.id}">
      <span class="item-nombre">${esc(item.name)} <span class="stock">(x${item.system.cantidad})</span></span>
      <span class="precio">${precio}</span>
      <select class="select-comprador">
        <option value="">Comprador…</option>
        ${personajes.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}
      </select>
      <button class="btn-primario chico btn-comprar" data-id="${item.id}">Comprar</button>
      <button class="btn-editar-item" data-id="${item.id}">✎</button>
      <button class="btn-borrar-item" data-id="${item.id}">✕</button>
    </div>`;
  };

  const tipos = [
    ["objeto", "Objetos"],
    ["arma", "Armas"],
    ["elixir", "Elixires"],
    ["alimento", "Alimentos"]
  ];

  app.innerHTML = `
  <section class="vista-ficha">
    <header class="sheet-header">
      <button class="btn-volver" id="btn-volver">← Inicio</button>
      <div class="header-izquierda">
        <input type="text" id="campo-nombre" value="${esc(tienda.nombre)}" placeholder="Nombre de la tienda">
      </div>
      <div class="caja-tienda">
        💰 Caja: <b>${tienda.caja.oro}</b> Oro | <b>${tienda.caja.rubi}</b> Rubí | <b>${tienda.caja.diamante}</b> Diamante
        <button id="btn-inyectar-caja" class="btn-secundario-sm">+ Inyectar Fondos</button>      
        </div>
      <div class="header-tiradas"><button class="roll-btn" id="btn-exportar-actor">⇩ Exportar</button></div>
    </header>
    <p class="nota">Selecciona el comprador en cada fila y pulsa Comprar: las Erianas se transfieren a la caja de la tienda y el artículo pasa al inventario del comprador.</p>
    
    ${tipos.map(([tipo, label]) => `
      <div class="tienda-seccion">
        <div class="columna-header">
          <h2>${label}</h2>
          <button class="btn-secundario chico btn-add-catalogo" data-tipo="${tipo}">+ Añadir del Catálogo</button>
          <button class="btn-secundario chico btn-add-manual" data-tipo="${tipo}">+ Crear Nuevo</button>
        </div>
        <div class="tienda-lista">
          ${tienda.items.filter(i => i.type === tipo).map(filaItem).join("") || `<p class="vacio">Sin ítems.</p>`}
        </div>
      </div>`).join("")}
  </section>`;

  qs("#btn-volver").addEventListener("click", () => ir("inicio"));
  qs("#btn-exportar-actor").addEventListener("click", () => exportarPerfil("tiendas", tienda.id));
  qs("#campo-nombre").addEventListener("change", async e => { tienda.nombre = e.target.value; await dbPut("tiendas", tienda); });

  qsa(".btn-add-catalogo").forEach(b => b.addEventListener("click", () => abrirModalCatalogo(tienda, b.dataset.tipo)));
  qsa(".btn-add-manual").forEach(b => b.addEventListener("click", () => abrirEditorItem(tienda, b.dataset.tipo)));
  qsa(".btn-editar-item").forEach(b => b.addEventListener("click", () => abrirEditorItem(tienda, null, b.dataset.id)));
  qsa(".btn-borrar-item").forEach(b => b.addEventListener("click", async () => {
    tienda.items = tienda.items.filter(i => i.id !== b.dataset.id);
    await dbPut("tiendas", tienda);
    render();
  }));

  qsa(".btn-comprar").forEach(btn => btn.addEventListener("click", async () => {
    const fila = btn.closest(".tienda-item");
    const compradorId = qs(".select-comprador", fila).value;
    if (!compradorId) { notificar("⚠️ Selecciona un comprador."); return; }

    const itemTienda = tienda.items.find(i => i.id === btn.dataset.id);
    if (!itemTienda || itemTienda.system.cantidad <= 0) { notificar("⚠️ Sin stock disponible."); return; }

    const comprador = await dbGet("personajes", compradorId);
    if (!comprador) { notificar("⚠️ Personaje no encontrado."); return; }

    let precioUnitarioOro = 0;
    if (itemTienda.system.precio_diamante > 0) precioUnitarioOro = itemTienda.system.precio_diamante * 10000;
    else if (itemTienda.system.precio_rubi > 0) precioUnitarioOro = itemTienda.system.precio_rubi * 100;
    else precioUnitarioOro = itemTienda.system.precio_oro || 0;

    const maxStock = itemTienda.system.cantidad;

    const modalHtml = `
      <div class="modal-backdrop">
        <div class="modal-contenido">
          <h3>Comprar ${esc(itemTienda.name)}</h3>
          
          <div style="margin: 10px 0;">
            <label>Cantidad a comprar (Stock: ${maxStock}):</label>
            <input type="number" id="input-cantidad-compra" value="1" min="1" max="${maxStock}" style="width: 100%; padding: 5px; margin-top: 5px;" />
          </div>

          <p>Precio Total: <b id="lbl-precio-total">${precioUnitarioOro} Oro</b> (o equivalente)</p>

          <label>¿Con qué moneda paga ${esc(comprador.nombre)}?</label>
          <select id="select-moneda-pago" style="width: 100%; padding: 5px; margin-top: 5px;">
            <option value="oro">Oro (Tienes: ${comprador.system.erianas.oro || 0})</option>
            <option value="rubi">Rubí (Tienes: ${comprador.system.erianas.rubi || 0})</option>
            <option value="diamante">Diamante (Tienes: ${comprador.system.erianas.diamante || 0})</option>
          </select>

          <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:15px;">
            <button id="btn-cancelar-pago" class="btn-secundario">Cancelar</button>
            <button id="btn-confirmar-pago" class="btn-primario">Confirmar Compra</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const inputCantidad = qs("#input-cantidad-compra");
    const lblPrecioTotal = qs("#lbl-precio-total");

    inputCantidad.addEventListener("input", () => {
      let cant = Math.max(1, Math.min(maxStock, Number(inputCantidad.value) || 1));
      inputCantidad.value = cant;
      lblPrecioTotal.textContent = `${precioUnitarioOro * cant} Oro`;
    });

    qs("#btn-cancelar-pago").addEventListener("click", () => document.querySelector(".modal-backdrop").remove());

    qs("#btn-confirmar-pago").addEventListener("click", async () => {
      const cantidadAComprar = Math.max(1, Math.min(maxStock, Number(inputCantidad.value) || 1));
      const precioTotalOro = precioUnitarioOro * cantidadAComprar;

      const monedaPago = qs("#select-moneda-pago").value;
      const carteraPJ = comprador.system.erianas;
      const cajaTienda = tienda.caja;

      let valorMonedaOro = 1;
      if (monedaPago === "rubi") valorMonedaOro = 100;
      if (monedaPago === "diamante") valorMonedaOro = 10000;

      if ((carteraPJ[monedaPago] || 0) < 1 && valorMonedaOro > precioTotalOro) {
        notificar(`❌ ${comprador.nombre} no tiene ${monedaPago.toUpperCase()} para pagar.`);
        return;
      }

      const totalPJOro = erianasATotalOro(carteraPJ);
      if (totalPJOro < precioTotalOro) {
        notificar(`❌ ${comprador.nombre} no tiene suficientes Erianas.`);
        return;
      }

      let entregadoOro = (monedaPago === "oro") ? precioTotalOro : valorMonedaOro;
      const cambioRequeridoOro = entregadoOro - precioTotalOro;

      const totalCajaOro = erianasATotalOro(cajaTienda);
      if (totalCajaOro < cambioRequeridoOro) {
        notificar(`❌ Sin cambio en caja para devolver ${cambioRequeridoOro} Oro.`);
        return;
      }

      if (monedaPago === "oro") {
        carteraPJ.oro -= precioTotalOro;
        cajaTienda.oro += precioTotalOro;
      } else {
        carteraPJ[monedaPago] -= 1;
        cajaTienda[monedaPago] += 1;
        cajaTienda.oro -= cambioRequeridoOro;
        carteraPJ.oro += cambioRequeridoOro;
      }

      while (cajaTienda.oro < 0) {
        if (cajaTienda.rubi > 0) { cajaTienda.rubi -= 1; cajaTienda.oro += 100; }
        else if (cajaTienda.diamante > 0) { cajaTienda.diamante -= 1; cajaTienda.oro += 10000; }
        else break;
      }

      if (!comprador.items) comprador.items = [];
      const tipoFinal = (itemTienda.type === "alimento") ? "objeto" : itemTienda.type;
      
      // Detectar automáticamente si es un contenedor
      const textoItem = `${itemTienda.name} ${itemTienda.system?.descripcion || ''} ${itemTienda.system?.efecto || ''}`.toLowerCase();
      const tieneEspaciosIndicados = /(\d+)\s*(espacios|espacio|slots|slot)/i.test(textoItem);

      const esContenedor = itemTienda.system?.esContenedor || 
                           tieneEspaciosIndicados ||
                           ["mochila", "bolso", "bulto", "saco", "cofre", "anillo espacial", "contenedor"].some(p => textoItem.includes(p));

      // Buscar si existe, pero NUNCA agrupar si es un contenedor
      const existente = !esContenedor ? comprador.items.find(i => i.name === itemTienda.name && i.type === tipoFinal) : null;

      if (existente) {
        existente.system.cantidad = (Number(existente.system.cantidad) || 0) + cantidadAComprar;
      } else {
        // Si se compran varios contenedores juntos, creamos cada uno de forma independiente
        const repeticiones = esContenedor ? cantidadAComprar : 1;

        for (let r = 0; r < repeticiones; r++) {
          const itemMaestro = (typeof CATALOGO_ITEMS !== "undefined")
            ? CATALOGO_ITEMS.find(m => m.name === itemTienda.name)
            : null;

          const sysMaestro = itemMaestro ? (itemMaestro.system || {}) : {};
          const textoEfecto = sysMaestro.efecto || sysMaestro.descripcion || itemTienda.system?.descripcion || itemTienda.system?.efecto || "";

          const nuevo = {
            id: crypto.randomUUID(),
            name: itemTienda.name,
            type: tipoFinal,
            system: {
              ...sysMaestro,
              ...itemTienda.system,
              esContenedor: esContenedor,
              efecto: textoEfecto,
              descripcion: textoEfecto,
              duracion: sysMaestro.duracion || "",
              nivel: sysMaestro.nivel || "",
              cantidad: esContenedor ? 1 : cantidadAComprar, // Contenedores siempre tienen cantidad 1
              precio_oro: 0,
              precio_rubi: 0,
              precio_diamante: 0
            }
          };

          comprador.items.push(nuevo);
        }
      }

      itemTienda.system.cantidad -= cantidadAComprar;

      await dbPut("personajes", comprador);
      await dbPut("tiendas", tienda);

      document.querySelector(".modal-backdrop").remove();
      notificar(`✨ Compra de ${cantidadAComprar}x ${itemTienda.name} completada. Cambio: ${cambioRequeridoOro} Oro.`);
      render();
    });
  }));

  qs("#btn-inyectar-caja")?.addEventListener("click", () => {
    const modalInyectar = `
      <div class="modal-backdrop">
        <div class="modal-contenido">
          <h3>💰 Inyectar Fondos a ${esc(tienda.nombre)}</h3>
          <p style="font-size: 0.9em; color: #aaa;">Ingresa las monedas que quieres SUMAR a la caja actual.</p>
          
          <label>Sumar Oro (EO):</label>
          <input type="number" id="add-caja-oro" value="0" min="0">
          
          <label>Sumar Rubí (ER):</label>
          <input type="number" id="add-caja-rubi" value="0" min="0">
          
          <label>Sumar Diamante (ED):</label>
          <input type="number" id="add-caja-diamante" value="0" min="0">
          
          <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:15px;">
            <button id="btn-cancelar-inyect" class="btn-secundario">Cancelar</button>
            <button id="btn-confirmar-inyect" class="btn-primario">Inyectar Dinero</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML("beforeend", modalInyectar);

    qs("#btn-cancelar-inyect").addEventListener("click", () => document.querySelector(".modal-backdrop").remove());

    qs("#btn-confirmar-inyect").addEventListener("click", async () => {
      const oroSumar = Number(qs("#add-caja-oro").value) || 0;
      const rubiSumar = Number(qs("#add-caja-rubi").value) || 0;
      const diamanteSumar = Number(qs("#add-caja-diamante").value) || 0;

      if (!tienda.caja) tienda.caja = { oro: 0, rubi: 0, diamante: 0 };

      tienda.caja.oro = (tienda.caja.oro || 0) + oroSumar;
      tienda.caja.rubi = (tienda.caja.rubi || 0) + rubiSumar;
      tienda.caja.diamante = (tienda.caja.diamante || 0) + diamanteSumar;

      await dbPut("tiendas", tienda);
      document.querySelector(".modal-backdrop").remove();
      notificar("✨ Fondos inyectados con éxito a la caja.");
      render();
    });
  });
}

function abrirModalCatalogo(tienda, tipo) {
  const disponibles = CATALOGO_ITEMS.filter(i => i.type === tipo);
  const opciones = disponibles.map((i, idx) => {
    const precioStr = i.system.precio_diamante ? `${i.system.precio_diamante} Diamante` : i.system.precio_rubi ? `${i.system.precio_rubi} Rubí` : `${i.system.precio_oro} Oro`;
    return `<option value="${idx}">${i.name} (${precioStr})</option>`;
  }).join("");

  const html = `
    <div class="modal-backdrop">
      <div class="modal-contenido">
        <h3>Añadir ${tipo.toUpperCase()} desde Catálogo</h3>
        <select id="select-item-catalogo">${opciones}</select>
        <label>Cantidad en Stock:</label>
        <input type="number" id="cant-item-catalogo" value="10" min="1">
        <button id="btn-confirmar-add">Añadir a Tienda</button>
        <button id="btn-cerrar-modal">Cancelar</button>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", html);

  qs("#btn-confirmar-add").addEventListener("click", async () => {
    const idx = qs("#select-item-catalogo").value;
    const cant = Number(qs("#cant-item-catalogo").value) || 1;
    const itemBase = disponibles[idx];

    const nuevo = JSON.parse(JSON.stringify(itemBase));
    nuevo.id = crypto.randomUUID();
    nuevo.system.cantidad = cant;

    tienda.items.push(nuevo);
    await dbPut("tiendas", tienda);
    document.querySelector(".modal-backdrop").remove();
    render();
  });

  qs("#btn-cerrar-modal").addEventListener("click", () => document.querySelector(".modal-backdrop").remove());
}

// ============================================================
// ARRANQUE Y PRECARGA DE BASE DE DATOS
// ============================================================

async function precargarBaseDeDatos() {
  for (const t of TIENDAS_INICIALES) {
    const existe = await dbGet("tiendas", t.id);

    if (!existe) {
      t.items.forEach(i => {
        if (!i.id) i.id = crypto.randomUUID();
      });

      await dbPut("tiendas", t);
      console.log(`Tienda "${t.nombre}" precargada con éxito.`);
    }
  }
}

async function initApp() {
  // Detectar si la ventana viene invocada con parámetros en la URL (modo embed para vista dividida)
  const urlParams = new URLSearchParams(window.location.search);
  const embedVista = urlParams.get("vista");
  const embedId = urlParams.get("id");

  if (embedVista) {
    state.vista = embedVista;
    if (embedVista === "ficha") state.personajeId = embedId;
    if (embedVista === "npc") state.npcId = embedId;
    if (embedVista === "tienda") state.tiendaId = embedId;
    if (embedVista === "oraculo") state.oraculoId = embedId;
  }

  await precargarBaseDeDatos();
  render();
}

window.addEventListener("DOMContentLoaded", initApp);

// ------------------------------------------------------------
// VISTA: ORÁCULO
// ------------------------------------------------------------
async function renderOraculo() {
  let oraculo = state.oraculoId ? await dbGet("oraculos", state.oraculoId) : null;
  if (!oraculo) {
    const todos = await dbGetAll("oraculos");
    if (todos.length) { oraculo = todos[todos.length - 1]; state.oraculoId = oraculo.id; }
    else { oraculo = oraculoPorDefecto(); await dbPut("oraculos", oraculo); state.oraculoId = oraculo.id; }
  }

  app.innerHTML = `
  <section class="vista-ficha">
    <header class="sheet-header">
      <button class="btn-volver" id="btn-volver">← Inicio</button>
      <div class="header-izquierda"><input type="text" id="campo-nombre" value="${esc(oraculo.nombre)}" placeholder="Nombre del oráculo"></div>
      <div class="header-tiradas"><button class="roll-btn" id="btn-exportar-actor">⇩ Exportar</button></div>
    </header>

    <div class="oraculo-panel">
      <div class="oraculo-consulta">
        <button class="btn-primario btn-consultar" id="btn-consultar">🎲 Consultar oráculo (d${oraculo.dado})</button>
        <div id="oraculo-resultado" class="oraculo-resultado"></div>
      </div>

      <div class="oraculo-editor">
        <div class="columna-header"><h2>Tabla (editable)</h2><button class="btn-secundario chico" id="btn-fila-oraculo">+ Fila</button></div>
        <div id="tabla-oraculo">
          ${oraculo.tabla.map((f, idx) => `
          <div class="oraculo-fila" data-idx="${idx}">
            <input type="number" class="of-min" value="${f.min}" min="1" max="${oraculo.dado}">
            <span>–</span>
            <input type="number" class="of-max" value="${f.max}" min="1" max="${oraculo.dado}">
            <input type="text" class="of-texto" value="${esc(f.texto)}">
            <button class="btn-borrar-fila-oraculo" data-idx="${idx}">✕</button>
          </div>`).join("")}
        </div>
      </div>
    </div>

    <div class="oraculo-historial">
      <div class="columna-header"><h2>Historial</h2><button class="btn-secundario chico" id="btn-limpiar-historial">Limpiar</button></div>
      <div class="historial-lista">
        ${oraculo.historial.slice().reverse().map(h => `<div class="historial-item"><b>d${oraculo.dado}: ${h.cara}</b> → ${esc(h.resultado)} <span class="historial-fecha">${new Date(h.ts).toLocaleString()}</span></div>`).join("") || `<p class="vacio">Sin consultas todavía.</p>`}
      </div>
    </div>
  </section>`;

  qs("#btn-volver").addEventListener("click", () => ir("inicio"));
  qs("#btn-exportar-actor").addEventListener("click", () => exportarPerfil("oraculos", oraculo.id));
  qs("#campo-nombre").addEventListener("change", async e => { oraculo.nombre = e.target.value; await dbPut("oraculos", oraculo); });

  qs("#btn-consultar").addEventListener("click", async () => {
    const r = consultarOraculo(oraculo);
    oraculo.historial.push(r);
    await dbPut("oraculos", oraculo);
    qs("#oraculo-resultado").innerHTML = `<div class="resultado-cara">${r.cara}</div><div class="resultado-texto">${esc(r.resultado)}</div>`;
  });

  qs("#btn-fila-oraculo").addEventListener("click", async () => {
    oraculo.tabla.push({ min: 1, max: oraculo.dado, texto: "" });
    await dbPut("oraculos", oraculo);
    render();
  });
  qsa(".btn-borrar-fila-oraculo").forEach(b => b.addEventListener("click", async () => {
    oraculo.tabla.splice(Number(b.dataset.idx), 1);
    await dbPut("oraculos", oraculo);
    render();
  }));
  qsa(".oraculo-fila").forEach(fila => {
    const idx = Number(fila.dataset.idx);
    qs(".of-min", fila).addEventListener("change", async e => { oraculo.tabla[idx].min = Number(e.target.value) || 1; await dbPut("oraculos", oraculo); });
    qs(".of-max", fila).addEventListener("change", async e => { oraculo.tabla[idx].max = Number(e.target.value) || 1; await dbPut("oraculos", oraculo); });
    qs(".of-texto", fila).addEventListener("change", async e => { oraculo.tabla[idx].texto = e.target.value; await dbPut("oraculos", oraculo); });
  });
  qs("#btn-limpiar-historial").addEventListener("click", async () => {
    if (!confirm("¿Borrar todo el historial?")) return;
    oraculo.historial = [];
    await dbPut("oraculos", oraculo);
    render();
  });
}

// ------------------------------------------------------------
// Navegación global + arranque
// ------------------------------------------------------------
qsa(".navlink").forEach(a => a.addEventListener("click", (e) => {
  e.preventDefault();
  ir(a.dataset.vista);
}));

window.addEventListener("DOMContentLoaded", () => {
  render();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { });
  }
});

// ------------------------------------------------------------
// VISTA: DADOS LIBRES
// ------------------------------------------------------------
async function renderDados() {
  // Cargar historial persistente si aún no está cargado en el estado
  if (!state.historialDadosLibres || !state.historialDadosLibres.length) {
    try {
      const guardado = localStorage.getItem("undavar_historial_dados");
      if (guardado) state.historialDadosLibres = JSON.parse(guardado);
    } catch (e) {
      state.historialDadosLibres = [];
    }
  }

  app.innerHTML = `
  <section class="vista-ficha" style="max-width: 1200px; margin: 0 auto;">
    <header class="sheet-header">
      <button class="btn-volver" id="btn-volver">← Inicio</button>
      <div class="header-izquierda">
        <h2 style="margin:0; color:var(--texto-dorado, #d4af37);">🎲 Lanzador de Dados Libres</h2>
      </div>
    </header>

    <!-- Disposición en 2 columnas -->
    <div style="display: grid; grid-template-columns: 360px 1fr; gap: 20px; margin-top: 20px; align-items: start;">
      
      <!-- COLUMNA IZQUIERDA: Controles de tirada -->
      <div style="display: flex; flex-direction: column; gap: 15px; background: rgba(0,0,0,0.25); padding: 18px; border-radius: 8px; border: 1px solid rgba(212,175,55,0.2);">
        
        <!-- Tiradas del Manual -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <span style="color:#d4af37; font-weight:bold; font-size:0.85em; text-transform:uppercase; letter-spacing:0.5px;">Tiradas del Sistema</span>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            <button class="btn-secundario btn-lanzar-preset" data-tipo="estandar" style="flex:1 1 45%;">🎲 Estándar (4d6)</button>
            <button class="btn-secundario btn-lanzar-preset" data-tipo="ataque" style="flex:1 1 45%;">🗡️ Ataque</button>
            <button class="btn-secundario btn-lanzar-preset" data-tipo="rebote" style="flex:1 1 45%;">⚡ Rebote</button>
            <button class="btn-secundario btn-lanzar-preset" data-tipo="despertar" style="flex:1 1 45%;">☀️ Despertar</button>
            <button class="btn-secundario btn-lanzar-preset" data-tipo="erianas" style="width:100%;">💰 Erianas (4d6×10)</button>
          </div>
        </div>

        <hr style="width:100%; border:0; border-top:1px solid #333; margin:0;">

        <!-- Artes y Armas por Nivel en Dados Libres -->
  <div style="display: flex; flex-direction: column; gap: 8px;">
    <span style="color:#d4af37; font-weight:bold; font-size:0.85em; text-transform:uppercase; letter-spacing:0.5px;">⚔️ Arte / Arma</span>
    <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
      <label style="color:#ccc; font-size:0.85em;">Nv:</label>
      <select id="select-nivel-arte" style="flex:1; padding:6px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px;">
        <option value="0">Nv. 0</option>
        <option value="1">Nv. 1</option>
        <option value="2">Nv. 2</option>
        <option value="3">Nv. 3</option>
        <option value="4">Nv. 4</option>
      </select>

      <label style="color:#ccc; font-size:0.85em;">Rango (Nv.0):</label>
      <select id="select-rango-dados-libres" style="flex:1; padding:6px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px;">
        <option value="Astrei">Astrei / Breintin (2d6)</option>
        <option value="Sedrein">Sedrein / Wonrixay (3d6)</option>
        <option value="Lait Betsu">Lait Betsu+ (4d6)</option>
      </select>

      <label style="color:#ccc; font-size:0.85em;">Atr:</label>
      <input type="number" id="input-atr-arte" value="3" min="0" max="9" style="width:45px; padding:6px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px; text-align:center;">
    </div>
    <button class="btn-primario" id="btn-lanzar-arte" style="width:100%;">Lanzar Daño</button>
  </div>

        <hr style="width:100%; border:0; border-top:1px solid #333; margin:0;">

        <!-- Tirada Libre d6 -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <span style="color:#d4af37; font-weight:bold; font-size:0.85em; text-transform:uppercase; letter-spacing:0.5px;">🎲 Tirada Libre</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <label style="color:#ccc; font-size:0.85em;">Dados:</label>
            <input type="number" id="input-cant-dados" value="2" min="1" max="30" style="width:60px; padding:6px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px; text-align:center;">
            <span style="color:#ccc; font-weight:bold;">d6</span>
            <label style="color:#ccc; font-size:0.85em; margin-left: auto;">Mod:</label>
            <input type="number" id="input-mod-dado" value="0" style="width:55px; padding:6px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px; text-align:center;">
          </div>
          <button class="btn-primario" id="btn-lanzar-custom" style="width:100%;">🎲 Tirar Dados</button>
        </div>

      </div>

      <!-- COLUMNA DERECHA: Pantalla Grande de Resultado -->
      <div id="dados-resultado-main" style="min-height: 380px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(212,175,55,0.2); padding: 30px; text-align: center;">
        <p class="vacio" style="font-size: 1.1em; color: #888;">Selecciona una tirada del panel izquierdo para ver el resultado aquí.</p>
      </div>

    </div>

    <!-- Historial de Tiradas -->
    <div class="oraculo-historial" style="margin-top: 25px;">
      <div class="columna-header">
        <h2>Historial de Tiradas</h2>
        <button class="btn-secundario chico" id="btn-limpiar-historial-dados">Limpiar</button>
      </div>
      <div class="historial-lista" id="lista-historial-dados">
        ${state.historialDadosLibres.length 
          ? state.historialDadosLibres.map(h => `<div class="historial-item" style="display:flex; flex-direction:column; gap:4px;">${h}</div>`).join("") 
          : `<p class="vacio">Sin tiradas en esta sesión.</p>`}
      </div>
    </div>
  </section>`;

  qs("#btn-volver").addEventListener("click", () => ir("inicio"));

  const contenedorResultado = qs("#dados-resultado-main");

  const registrarYMostrar = (titulo, ds, extraHtml = "") => {
    // Generación con inline-flex y control estricto de tamaño/line-height para que no se salga la cifra
    const htmlDados = ds.map(d => `
      <span class="dado ${[1, 3, 5].includes(d) ? 'acierto' : 'perdida'}" 
            style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; font-size: 1.8em; font-weight: bold; line-height: 1; padding: 0; margin: 6px; border-radius: 8px; box-sizing: border-box;">
        ${d}
      </span>
    `).join("");

    const resHtml = `
      <div style="font-size:1.6em; color:#d4af37; font-weight:bold; margin-bottom:15px; text-shadow:0 2px 4px rgba(0,0,0,0.5);">${titulo}</div>
      <div class="dados-resultado" style="margin:15px 0; display:flex; flex-wrap:wrap; justify-content:center; gap:8px;">${htmlDados}</div>
      <div style="margin-top:15px; font-size:1.3em; color:#e0e0e0; background:rgba(255,255,255,0.03); padding:10px 20px; border-radius:6px; border:1px solid #333;">${extraHtml}</div>
    `;

    contenedorResultado.innerHTML = resHtml;

    const htmlDadosHistorial = typeof dadosHTML === "function" ? dadosHTML(ds) : `<div class="dados-resultado">${ds.join(", ")}</div>`;
    const entradaHistorial = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="color:#d4af37;">${titulo}</strong>
        <span class="historial-fecha">${new Date().toLocaleTimeString()}</span>
      </div>
      ${htmlDadosHistorial}
      <div style="font-size:0.85em; color:#ccc;">${extraHtml}</div>
    `;

    state.historialDadosLibres.unshift(entradaHistorial);
    if (state.historialDadosLibres.length > 30) state.historialDadosLibres.pop();

    // Guardar permanentemente en localStorage
    try {
      localStorage.setItem("undavar_historial_dados", JSON.stringify(state.historialDadosLibres));
    } catch (e) {
      console.error("Error al guardar historial de dados:", e);
    }

    const listaH = qs("#lista-historial-dados");
    if (listaH) {
      listaH.innerHTML = state.historialDadosLibres
        .map(h => `<div class="historial-item" style="display:flex; flex-direction:column; gap:4px;">${h}</div>`)
        .join("");
    }
  };

  qsa(".btn-lanzar-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      const tipo = btn.dataset.tipo;
      if (tipo === "estandar") {
        const ds = [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1);
        const aciertos = ds.filter(d => [1, 3, 5].includes(d)).length;
        const perdidas = ds.length - aciertos;
        const suma = ds.reduce((a, b) => a + b, 0);
        registrarYMostrar("Tirada Estándar (4d6)", ds, `Aciertos: <b style="color:#55ff55;">${aciertos}</b> | Pérdidas: <b style="color:#ff5555;">${perdidas}</b> | Suma: <b>${suma}</b>`);
      } else if (tipo === "ataque" && typeof tiradaAtaque === "function") {
        const r = tiradaAtaque();
        registrarYMostrar("Tirada de Ataque", r.ds, `Daño: <b style="color:#ff5555;">${r.dano}</b> | PV: <b>+${r.pv}</b> | ${r.buenaSuerte ? "✨ Buena suerte" : "💀 Mala suerte"}`);
      } else if (tipo === "rebote" && typeof tiradaRebote === "function") {
        const r = tiradaRebote();
        registrarYMostrar("Tirada de Rebote", r.ds, `Aciertos: <b>${r.aciertos}</b> → ${r.resultado} | PV: <b>+${r.pv}</b>`);
      } else if (tipo === "despertar" && typeof tiradaDespertar === "function") {
        const r = tiradaDespertar();
        registrarYMostrar("Tirada de Despertar", r.ds, `Aciertos: <b>${r.aciertos}/4</b> — ${r.despierta ? "✅ ¡Despierta!" : "❌ No despierta"}`);
      } else if (tipo === "erianas" && typeof tiradaErianasIniciales === "function") {
        const r = tiradaErianasIniciales();
        registrarYMostrar("Erianas Iniciales (4d6×10)", r.ds, `Suma: ${r.suma} × 10 = <b style="color:#d4af37;">${r.total} Oro</b>`);
      }
    });
  });

  qs("#btn-lanzar-arte").addEventListener("click", () => {
    const nivel = parseInt(qs("#select-nivel-arte").value) || 0;
    const atr = parseInt(qs("#input-atr-arte").value) || 0;
    const rangoElegido = qs("#select-rango-dados-libres")?.value || "Astrei";

    if (typeof tiradaDanoNivel === "function") {
      const r = tiradaDanoNivel(nivel, atr, { rango: rangoElegido });
      registrarYMostrar(`Arte/Arma Nv.${nivel} (Atr: ${atr})`, r.ds, `Daño total: <b style="color:#ff5555;">${r.danoTotal}</b> | PV: <b>+${r.pv}</b> | ${r.buenaSuerte ? "✨ Buena suerte" : "💀 Mala suerte"}`);
    }
  });

  qs("#btn-lanzar-custom").addEventListener("click", () => {
    const cant = Math.max(1, Math.min(30, parseInt(qs("#input-cant-dados").value) || 1));
    const mod = parseInt(qs("#input-mod-dado").value) || 0;

    const ds = [];
    let suma = 0;
    let pv = 0;
    let aciertosBase = 0;

    for (let i = 0; i < cant; i++) {
      const val = Math.floor(Math.random() * 6) + 1;
      ds.push(val);
      suma += val;

      // Reglas de Undavar: 1, 3, 5 son aciertos y otorgan PV
      if ([1, 3, 5].includes(val)) {
        aciertosBase++;
        pv += val;
      }
    }

    const perdidas = cant - aciertosBase;
    const aciertosTotales = aciertosBase + mod;
    const buenaSuerte = suma > 12;

    const textoSuerte = buenaSuerte ? "✨ Buena suerte" : "💀 Mala suerte";
    const tituloTirada = `${cant}d6 ${mod !== 0 ? (mod > 0 ? '+' + mod : mod) : ''}`;

    const detalleHtml = `
      Aciertos: <b style="color:#55ff55;">${aciertosTotales}</b> | 
      Pérdidas: <b style="color:#ff5555;">${perdidas}</b> | 
      PV: <b style="color:#d4af37;">+${pv}</b> | ${textoSuerte}
    `;

    registrarYMostrar(tituloTirada, ds, detalleHtml);
  });

  qs("#btn-limpiar-historial-dados").addEventListener("click", () => {
    if (confirm("¿Borrar todo el historial de tiradas libres?")) {
      state.historialDadosLibres = [];
      localStorage.removeItem("undavar_historial_dados");
      render();
    }
  });
}

// ============================================================
// ARRANQUE Y PRECARGA DE BASE DE DATOS
// ============================================================

async function precargarBaseDeDatos() {
  for (const t of TIENDAS_INICIALES) {
    const existe = await dbGet("tiendas", t.id);

    if (!existe) {
      t.items.forEach(i => {
        if (!i.id) i.id = crypto.randomUUID();
      });

      await dbPut("tiendas", t);
      console.log(`Tienda "${t.nombre}" precargada con éxito.`);
    }
  }
}

async function initApp() {
  // Detectar si la ventana se ejecuta dentro de un iframe (Vista Dividida)
  const esEmbed = window.self !== window.top;
  if (esEmbed) {
    document.body.classList.add("modo-embed");
  }

  const urlParams = new URLSearchParams(window.location.search);
  const embedVista = urlParams.get("vista");
  const embedId = urlParams.get("id");

  if (embedVista) {
    state.vista = embedVista;
    if (embedVista === "ficha") state.personajeId = embedId;
    if (embedVista === "npc") state.npcId = embedId;
    if (embedVista === "tienda") state.tiendaId = embedId;
    if (embedVista === "oraculo") state.oraculoId = embedId;
  }

  // Prevenir bucle infinito: un iframe no puede abrir Vista Dividida
  if (esEmbed && state.vista === "dividida") {
    state.vista = "inicio";
  }

  await precargarBaseDeDatos();
  render();
}

window.addEventListener("DOMContentLoaded", initApp);

// ============================================================
// VISTA: DIVIDIDA
// ============================================================

// ============================================================
// VISTA: DIVIDIDA (CORREGIDA)
// ============================================================

async function renderVistaDividida() {
  // 1. Obtener los IDs de los elementos actualmente activos o los primeros de la base de datos
  let pjId = state.personajeId;
  let npcId = state.npcId;

  if (!pjId) {
    const personajes = await dbGetAll("personajes");
    if (personajes.length > 0) pjId = personajes[0].id;
  }

  if (!npcId) {
    const npcs = await dbGetAll("npcs");
    if (npcs.length > 0) npcId = npcs[0].id;
  }

  // 2. Construir las URLs explícitas con Vista e ID incluidos para evitar rebotar a Inicio
  const urlIzq = `${window.location.pathname}?vista=ficha${pjId ? `&id=${pjId}` : ''}`;
  const urlDer = `${window.location.pathname}?vista=${npcId ? 'npc' : 'ficha'}${npcId ? `&id=${npcId}` : (pjId ? `&id=${pjId}` : '')}`;

  app.innerHTML = `
  <section class="vista-ficha" style="max-width: 100%; padding: 10px; height: calc(100vh - 20px); display: flex; flex-direction: column; box-sizing: border-box;">
    <header class="sheet-header" style="margin-bottom: 10px; flex-shrink: 0;">
      <button class="btn-volver" id="btn-volver-div">← Inicio</button>
      <h2 style="margin:0; color:var(--texto-dorado, #d4af37);">⚔️ Vista Dividida</h2>
    </header>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; flex: 1; min-height: 0;">
      
      <!-- PANEL IZQUIERDO (Ficha de Personaje con scroll garantizado) -->
      <div style="display: flex; flex-direction: column; background: rgba(0,0,0,0.3); border: 1px solid rgba(212,175,55,0.2); border-radius: 8px; padding: 5px; height: 100%; box-sizing: border-box; overflow: hidden;">
        <iframe id="iframe-izq" src="${urlIzq}" style="width: 100%; height: 100%; border: none; border-radius: 6px; background: #121215; overflow-y: auto;"></iframe>
      </div>

      <!-- PANEL DERECHO (Ficha de PNJ/Bestia o Ficha 2 con scroll garantizado) -->
      <div style="display: flex; flex-direction: column; background: rgba(0,0,0,0.3); border: 1px solid rgba(212,175,55,0.2); border-radius: 8px; padding: 5px; height: 100%; box-sizing: border-box; overflow: hidden;">
        <iframe id="iframe-der" src="${urlDer}" style="width: 100%; height: 100%; border: none; border-radius: 6px; background: #121215; overflow-y: auto;"></iframe>
      </div>

    </div>
  </section>`;

  qs("#btn-volver-div").addEventListener("click", () => ir("inicio"));
}

// ============================================================
// VISTA: ENFRENTAMIENTOS RÁPIDOS (TIRADAS ENFRENTADAS)
// ============================================================
async function renderEnfrentamiento() {
  const [personajes, npcs] = await Promise.all([dbGetAll("personajes"), dbGetAll("npcs")]);

  // Lista unificada para seleccionar PJ o PNJ de cualquier lado
  const todosContendientes = [
    ...personajes.map(p => ({ id: p.id, nombre: p.nombre, store: "personajes", etiqueta: "PJ" })),
    ...npcs.map(n => ({ id: n.id, nombre: n.nombre, store: "npcs", etiqueta: "PNJ" }))
  ];

  if (!todosContendientes.length) {
    app.innerHTML = `<section class="vista-ficha"><p class="vacio">Crea al menos un personaje o PNJ para realizar enfrentamientos.</p></section>`;
    return;
  }

  // Inicializar participantes garantizando objetos válidos
  if (!state.enfrentamiento.participantes || state.enfrentamiento.participantes.length < 1) {
    const pA = todosContendientes.find(c => c.id === state.enfrentamiento.idA) || todosContendientes[0];
    const pB = todosContendientes.find(c => c.id === state.enfrentamiento.idB) || todosContendientes[1] || todosContendientes[0];

    state.enfrentamiento.participantes = [
      { id: pA.id, tipoStore: pA.store },
      { id: pB.id, tipoStore: pB.store }
    ];
  }

  // Cargar todos los actores de la lista de participantes
  const actoresCargados = await Promise.all(
    state.enfrentamiento.participantes.map(p => dbGet(p.tipoStore, p.id))
  );

  const renderPanelActor = (actor, lado, tipoStore, index) => {
    if (!actor) return `<div class="ref-bloque"><p class="vacio">Sin personaje seleccionado</p></div>`;
    const s = actor.system || {};
    const esPJ = tipoStore === "personajes";

    return `
      <div class="ref-bloque" style="padding:15px; border:1px solid rgba(212,175,55,0.3); background:rgba(0,0,0,0.25); border-radius:8px;">
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          <label style="color:#d4af37; font-weight:bold;">Contendiente ${lado}:</label>
          <select class="sel-contendiente" data-index="${index}" style="width:100%; padding:6px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px;">
            ${todosContendientes.map(c => `
              <option value="${c.id}" data-store="${c.store}" ${c.id === actor.id ? "selected" : ""}>
                [${c.etiqueta}] ${esc(c.nombre)}
              </option>
            `).join("")}
          </select>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:8px; border-radius:4px; margin-bottom:10px;">
          <span>⚡ PA: <b>${s.pa?.value || 0}</b></span>
          ${esPJ ? `<span>💎 PP: <b>${s.pdc?.pp || 0}</b> | PD: <b>${s.pdc?.pd || 0}</b></span>` : `<span style="color:#aaa;">PNJ</span>`}
        </div>

        <!-- Botón Toggle Modificadores -->
        <button class="btn-secundario chico btn-toggle-mod-enfrentamiento" data-lado="${lado}" style="width:100%; margin-bottom:8px;">
          ⚙️ Modificadores ${lado}
        </button>

        <!-- Panel Modificador por Lado -->
        <div id="panel-mod-enf-${lado}" style="display:none; background:rgba(0,0,0,0.4); border:1px solid #444; border-radius:6px; padding:8px; font-size:0.85em;">
          <div style="margin-bottom:6px;">
            <label style="color:#ccc;">Atributo (Atr/2):</label>
            <select id="mod-atr-${lado}" style="width:100%; background:#121215; color:#fff; border:1px solid #444; padding:4px; border-radius:3px;">
              <option value="ninguno">Ninguno (+0)</option>
              <option value="fuerza">Fuerza (${Math.floor((s.atributos?.fuerza || 0)/2)})</option>
              <option value="velocidad">Velocidad (${Math.floor((s.atributos?.velocidad || 0)/2)})</option>
              <option value="agilidad">Agilidad (${Math.floor((s.atributos?.agilidad || 0)/2)})</option>
              <option value="inteligencia">Inteligencia (${Math.floor((s.atributos?.inteligencia || 0)/2)})</option>
            </select>
          </div>

          <div style="margin-bottom:6px;">
            <label style="color:#ccc;">Gastar PA:</label>
            <input type="number" id="mod-pa-${lado}" value="0" min="0" max="${s.pa?.value || 0}" style="width:100%; background:#121215; color:#fff; border:1px solid #444; padding:4px; border-radius:3px; box-sizing:border-box;">
          </div>

          ${esPJ ? `
          <div style="margin-bottom:6px;">
            <label style="color:#ccc;">Gastar PdC (2 pts = +1):</label>
            <div style="display:flex; gap:4px;">
              <select id="mod-pdc-tipo-${lado}" style="flex:1; background:#121215; color:#fff; border:1px solid #444; padding:4px; border-radius:3px;">
                <option value="ninguno">Sin PdC</option>
                <option value="pp">PP (${s.pdc?.pp || 0})</option>
                <option value="pd">PD (${s.pdc?.pd || 0})</option>
              </select>
              <input type="number" id="mod-pdc-cant-${lado}" value="0" min="0" step="2" placeholder="Pts" style="width:50px; background:#121215; color:#fff; border:1px solid #444; padding:4px; border-radius:3px; text-align:center;">
            </div>
          </div>` : ""}

          <div>
            <label style="color:#ccc;">Mod. Fijo:</label>
            <input type="number" id="mod-fijo-${lado}" value="0" style="width:100%; background:#121215; color:#fff; border:1px solid #444; padding:4px; border-radius:3px; box-sizing:border-box;">
          </div>
        </div>
      </div>`;
  };

  const esModoSR = state.enfrentamiento.modo === "todos_vs_sr";
  const valSR = state.enfrentamiento.valSR || 3;
  const esCustom = state.enfrentamiento.esCustomSR || false;

  app.innerHTML = `
  <section class="vista-ficha" style="max-width: 1000px; margin: 0 auto;">
    <header class="sheet-header">
      <button class="btn-volver" id="btn-volver">← Inicio</button>
      <div class="header-izquierda">
        <h2 style="margin:0; color:var(--texto-dorado, #d4af37);">⚔️ Tirada Enfrentada Rápida</h2>
      </div>
    </header>

    <!-- Barra de Configuración de Enfrentamiento -->
    <div style="margin-top: 15px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 15px; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; border: 1px solid rgba(212,175,55,0.2);">
      <div style="display:flex; align-items:center; gap:8px;">
        <label style="color:#d4af37; font-weight:bold;">Modo:</label>
        <select id="modo-enfrentamiento" style="background:#121215; color:#fff; border:1px solid #444; padding:6px; border-radius:4px;">
          <option value="todos_vs_todos" ${!esModoSR ? "selected" : ""}>⚔️ Todos vs Todos</option>
          <option value="todos_vs_sr" ${esModoSR ? "selected" : ""}>🎯 Todos vs SR</option>
        </select>
      </div>

      <div style="display:flex; align-items:center; gap:8px;">
        <label style="color:#d4af37; font-weight:bold;">Participantes:</label>
        <input type="number" id="num-participantes" min="1" max="10" value="${state.enfrentamiento.participantes.length}" style="width:50px; background:#121215; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; text-align:center; font-weight:bold;">
      </div>

      ${esModoSR ? `
        <div style="display:flex; align-items:center; gap:8px; background:rgba(212,175,55,0.1); padding:4px 10px; border-radius:4px; border:1px solid #d4af37;">
          <label style="color:#d4af37; font-weight:bold;">Dificultad SR:</label>
          <select id="sel-preset-sr" style="background:#121215; color:#fff; border:1px solid #d4af37; padding:4px; border-radius:4px;">
            <option value="1" ${!esCustom && valSR === 1 ? "selected" : ""}>Muy fácil (1 acierto)</option>
            <option value="2" ${!esCustom && valSR === 2 ? "selected" : ""}>Fácil (2 aciertos)</option>
            <option value="3" ${!esCustom && valSR === 3 ? "selected" : ""}>Media (3 aciertos)</option>
            <option value="4" ${!esCustom && valSR === 4 ? "selected" : ""}>Difícil (4 aciertos)</option>
            <option value="custom" ${esCustom ? "selected" : ""}>Personalizada</option>
          </select>

          <input type="number" id="val-sr-fijo" value="${valSR}" min="1" style="width:55px; background:#121215; color:#fff; border:1px solid #d4af37; padding:4px; border-radius:4px; text-align:center; font-weight:bold; ${esCustom ? '' : 'display:none;'}">
        </div>
      ` : ""}
    </div>

    <!-- Grid Dinámico de Contendientes -->
    <div id="grid-contendientes" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin-top: 15px;">
      ${state.enfrentamiento.participantes.map((p, idx) => {
        const actor = actoresCargados[idx];
        const lado = String.fromCharCode(65 + idx);
        return renderPanelActor(actor, lado, p.tipoStore, idx);
      }).join('')}
    </div>

    <div style="margin-top:20px; text-align:center;">
      <button class="btn-primario" id="btn-resolver-enfrentamiento" style="font-size:1.2em; padding:12px 28px;">
        🎲 Resolver Enfrentamiento
      </button>
    </div>

    <div id="resultado-enfrentamiento" style="margin-top:20px; padding:15px; background:rgba(0,0,0,0.3); border:1px solid rgba(212,175,55,0.2); border-radius:8px; text-align:center;">
      <p class="vacio">Configura los modificadores y presiona Resolver Enfrentamiento.</p>
    </div>
  </section>`;

  qs("#btn-volver")?.addEventListener("click", () => ir("inicio"));

  // Cambio de contendientes por selector
  qsa(".sel-contendiente").forEach(sel => {
    sel.addEventListener("change", e => {
      const idx = parseInt(e.target.dataset.index, 10);
      const opt = e.target.options[e.target.selectedIndex];
      const id = e.target.value;
      const store = opt.dataset.store;

      if (state.enfrentamiento.participantes[idx]) {
        state.enfrentamiento.participantes[idx] = { id, tipoStore: store };
      }
      render();
    });
  });

  // Toggle de Paneles Modificadores
  qsa(".btn-toggle-mod-enfrentamiento").forEach(btn => {
    btn.addEventListener("click", () => {
      const lado = btn.dataset.lado;
      const p = qs(`#panel-mod-enf-${lado}`);
      if (p) p.style.display = p.style.display === "none" ? "block" : "none";
    });
  });

  // Manejo de cambio de modo
  qs("#modo-enfrentamiento")?.addEventListener("change", (e) => {
    state.enfrentamiento.modo = e.target.value;
    if (!state.enfrentamiento.valSR) state.enfrentamiento.valSR = 3;
    render();
  });

  // Manejador dinámico del selector de Dificultad SR
  qs("#sel-preset-sr")?.addEventListener("change", (e) => {
    const v = e.target.value;
    const inpCustom = qs("#val-sr-fijo");
    if (v === "custom") {
      state.enfrentamiento.esCustomSR = true;
      if (inpCustom) {
        inpCustom.style.display = "inline-block";
        inpCustom.focus();
      }
    } else {
      state.enfrentamiento.esCustomSR = false;
      state.enfrentamiento.valSR = parseInt(v, 10);
      if (inpCustom) inpCustom.style.display = "none";
    }
  });

  qs("#val-sr-fijo")?.addEventListener("input", (e) => {
    state.enfrentamiento.valSR = Math.max(1, parseInt(e.target.value) || 1);
  });

  // Cambio en la cantidad de participantes
  qs("#num-participantes")?.addEventListener("change", (e) => {
    const minCant = state.enfrentamiento.modo === "todos_vs_sr" ? 1 : 2;
    const cant = Math.max(minCant, parseInt(e.target.value) || minCant);

    while (state.enfrentamiento.participantes.length < cant) {
      const pDef = todosContendientes[state.enfrentamiento.participantes.length % todosContendientes.length];
      state.enfrentamiento.participantes.push({ id: pDef.id, tipoStore: pDef.store });
    }
    if (state.enfrentamiento.participantes.length > cant) {
      state.enfrentamiento.participantes = state.enfrentamiento.participantes.slice(0, cant);
    }

    render();
  });

  // Lógica principal ÚNICA de Tirada
  qs("#btn-resolver-enfrentamiento")?.addEventListener("click", async () => {
    const participantes = state.enfrentamiento.participantes;
    const esSR = state.enfrentamiento.modo === "todos_vs_sr";
    
    let valorSR = 3;
    if (esSR) {
      const selPreset = qs("#sel-preset-sr")?.value;
      if (selPreset === "custom") {
        valorSR = parseInt(qs("#val-sr-fijo")?.value) || 1;
      } else {
        valorSR = parseInt(selPreset) || 3;
      }
      state.enfrentamiento.valSR = valorSR;
    }

    const resultados = [];

    for (let i = 0; i < participantes.length; i++) {
      const lado = String.fromCharCode(65 + i);
      const p = participantes[i];
      const actor = await dbGet(p.tipoStore, p.id);
      if (!actor) continue;

      let modAtr = 0, modPA = 0, modPdC = 0, modFijo = 0;
      let gastoPA = 0, gastoPdC = 0, tipoPdC = "ninguno";

      const selAtr = qs(`#mod-atr-${lado}`)?.value;
      if (selAtr && selAtr !== "ninguno") {
        modAtr = Math.floor((Number(actor.system?.atributos?.[selAtr]) || 0) / 2);
      }

      gastoPA = Math.max(0, parseInt(qs(`#mod-pa-${lado}`)?.value) || 0);
      if (gastoPA > (actor.system?.pa?.value || 0)) {
        alert(`PA insuficientes en ${actor.nombre}.`);
        return;
      }
      modPA = gastoPA;

      if (p.tipoStore === "personajes") {
        tipoPdC = qs(`#mod-pdc-tipo-${lado}`)?.value || "ninguno";
        gastoPdC = Math.max(0, parseInt(qs(`#mod-pdc-cant-${lado}`)?.value) || 0);
        if (tipoPdC !== "ninguno" && gastoPdC > 0) {
          const disponible = Number(actor.system?.pdc?.[tipoPdC]) || 0;
          if (gastoPdC > disponible) {
            alert(`PdC insuficientes en ${actor.nombre}.`);
            return;
          }
          modPdC = Math.floor(gastoPdC / 2);
        }
      }

      modFijo = parseInt(qs(`#mod-fijo-${lado}`)?.value) || 0;
      const modTotal = modAtr + modPA + modPdC + modFijo;

      // Descontar recursos
      if (gastoPA > 0) actor.system.pa.value -= gastoPA;
      if (tipoPdC !== "ninguno" && gastoPdC > 0) actor.system.pdc[tipoPdC] -= gastoPdC;
      await dbPut(p.tipoStore, actor);

      // Tirada 4d6
      const tir = tiradaEstandar();
      const aciertosTotales = tir.aciertos + modTotal;

      resultados.push({
        lado,
        actor,
        nombre: actor.nombre,
        ds: tir.ds,
        aciertosBase: tir.aciertos,
        modTotal,
        aciertosTotales,
        superoSR: esSR ? aciertosTotales >= valorSR : false
      });
    }

    let veredictoText = "";
    if (esSR) {
      const superaron = resultados.filter(r => r.superoSR);
      if (superaron.length === 0) {
        veredictoText = `🎯 Dificultad SR: <b>${valorSR} aciertos</b> | ❌ <b>Nadie superó la prueba</b>`;
      } else {
        veredictoText = `🎯 Dificultad SR: <b>${valorSR} aciertos</b> | ✅ <b>${superaron.length} superó/aron la prueba</b>`;
      }
    } else {
      resultados.sort((a, b) => b.aciertosTotales - a.aciertosTotales);
      const ganador = resultados[0];
      veredictoText = `🏆 Mayor Acierto: <b>${esc(ganador.nombre)}</b> (${ganador.aciertosTotales} aciertos)`;
    }

    // Registrar en historial global
    if (!state.enfrentamiento.historial) state.enfrentamiento.historial = [];
    state.enfrentamiento.historial.unshift({
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modo: esSR ? `vs SR (${valorSR})` : "Todos vs Todos",
      totalParticipantes: resultados.length,
      resumen: esSR 
        ? `${resultados.filter(r => r.superoSR).length}/${resultados.length} superaron SR` 
        : `Ganador: ${resultados[0].nombre} (${resultados[0].aciertosTotales} aciertos)`
    });

    // Renderizar resultados en pantalla
    const contenedorRes = qs("#resultado-enfrentamiento");
    if (contenedorRes) {
      contenedorRes.innerHTML = `
        <div style="font-size:1.3em; margin-bottom:12px; color:#d4af37;">${veredictoText}</div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:10px; font-size:0.9em; margin-bottom:15px; text-align:left;">
          ${resultados.map((r, rank) => {
            const esExito = r.superoSR;
            const bordeColor = esSR 
              ? (esExito ? '#4caf50' : '#f44336')
              : (rank === 0 ? '#d4af37' : '#444');
            
            const tag = esSR 
              ? (esExito ? '<span style="color:#4caf50;">✅ Éxito</span>' : '<span style="color:#f44336;">❌ Fallo</span>')
              : `#${rank + 1}`;

            return `
              <div style="background:rgba(0,0,0,0.4); border:1px solid ${bordeColor}; padding:10px; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:4px;">
                  <span>${esc(r.nombre)} (${r.lado})</span>
                  <span>${tag}</span>
                </div>
                <div style="margin:4px 0;">${dadosHTML(r.ds)}</div>
                <div>Aciertos: <b>${r.aciertosTotales}</b> <span style="font-size:0.8em; color:#aaa;">(${r.aciertosBase} + ${r.modTotal} mod)</span></div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="border-top:1px solid rgba(212,175,55,0.2); padding-top:10px; text-align:left;">
          <h4 style="margin:0 0 8px 0; color:#d4af37; font-size:1em;">📜 Historial de Tiradas</h4>
          <div style="max-height:150px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
            ${state.enfrentamiento.historial.map(h => `
              <div style="background:rgba(255,255,255,0.03); border:1px solid #333; padding:6px 10px; border-radius:4px; font-size:0.85em; display:flex; justify-content:space-between;">
                <span style="color:#aaa;">[${h.hora}]</span>
                <span style="color:#d4af37;"><b>${h.modo}</b></span>
                <span>Participantes: <b>${h.totalParticipantes || 2}</b></span>
                <span>${h.resumen}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  });
}