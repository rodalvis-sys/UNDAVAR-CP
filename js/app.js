// ============================================================
//  UNDAVAR — Aplicación principal
// ============================================================

const app = document.getElementById("app");

const state = {
  vista: "inicio",
  personajeId: null,
  npcId: null,
  tiendaId: null,
  // [UNDAVAR-PARTE-9.1-METAS] Filtros de la vista de metas
  metasFiltro: "todas",
  metasTipo: "todos",
  metasBusqueda: "",
  // [UNDAVAR-PARTE-4.3a] Vendedor seleccionado en la sección Vender
  ventaVendedorId: null,
  oraculoId: null,
  subtabFicha: "datos",
  // [UNDAVAR-PARTE-10.5C-MODO] Vista o edición de la pestaña Datos
  modoDatos: "vista",
  modoDatosClave: "",
  // [UNDAVAR-PARTE-3.9] Pestaña activa de la ficha de PNJ
  subtabNPC: "datos",
  historialDadosLibres: [],

  // Estado para la Vista Dividida
  panelIzq: { vista: "ficha", id: null },
  panelDer: { vista: "npc", id: null },

  // Tiradas enfrentadas
  enfrentamiento: { idA: "", idB: "", tipoA: "personajes", tipoB: "npcs" },
  // [UNDAVAR-PARTE-4.2a] Mesa de combate
  combate: {
    idA: "", storeA: "personajes", idB: "", storeB: "npcs",
    tipo: "normal", itemId: "", atr: "fuerza", distancia: "fuera",
    modA: 0, modD: 0, reduccionExtra: 0,
    ventaja: false, reaccion: "ninguna", ultimo: null, undo: null,
    // [UNDAVAR-PARTE-4.2c4] Recurso del contraataque y turno
    contraTipo: "normal", contraItemId: "", turno: 1,
    // [UNDAVAR-PARTE-4.2c6] Lista de participantes y turno actual
    lista: [], turnoIdx: 0,
    // [UNDAVAR-PARTE-4.2h4k-MEMORIA-COMBATE] Última selección de cada participante
    memoria: {}
  },
};

// ------------------------------------------------------------
// Helpers de render
// ------------------------------------------------------------
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function esc(s) { return (s ?? "").toString().replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

// [UNDAVAR-PARTE-8-MAPA] Los avisos y diálogos deben verse también a pantalla completa
function contenedorOverlays() {
  return document.fullscreenElement
    || document.querySelector(".mapa-vista.mapa-pantalla")
    || document.body;
}

function notificar(mensaje) {
  const toastViejo = document.querySelector(".toast-notificacion");
  if (toastViejo) toastViejo.remove();

  const toast = document.createElement("div");
  toast.className = "toast-notificacion";
  toast.textContent = mensaje;
  contenedorOverlays().appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// [UNDAVAR-PARTE-4.2h2-PAREJA] Un clon de duplicación no es una ficha administrable
function esClon(actor) { return !!actor?.system?.esClon; }

// [UNDAVAR-PARTE-7-AVATAR] Paleta estable por nombre para el avatar por defecto
function paletaAvatar(nombre) {
  const texto = String(nombre || "?");
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  return "av-" + (hash % 6);
}

// [UNDAVAR-PARTE-7-AVATAR] Avatar común: imagen si existe; si no, inicial
function avatarHTML(actor, { clase = "ed-avatar", tono = "", alt = "" } = {}) {
  const nombre = actor?.nombre || "?";
  const inicial = (nombre.trim().charAt(0).toUpperCase() || "?");
  const paleta = tono || paletaAvatar(nombre);
  const src = typeof actor?.img === "string" ? actor.img.trim() : "";
  const imagen = src
    ? `<img src="${esc(src)}" alt="${esc(alt || nombre)}" loading="lazy" onerror="this.remove()">`
    : "";
  return `<span class="avatar-marco ${clase} ${paleta}" data-inicial="${esc(inicial)}" aria-hidden="true">${imagen}</span>`;
}
function soloPersonajesReales(lista) { return (lista || []).filter(a => !esClon(a)); }

// [UNDAVAR-PARTE-4.2h2-PAREJA] Crea un ítem desde el catálogo con su system completo
function itemDesdeCatalogo(nombre, cantidad = 1) {
  const maestro = CATALOGO_ITEMS.find(i => i.name === nombre);
  const it = itemPorDefecto(maestro?.type || "arma", nombre);
  it.system = { ...JSON.parse(JSON.stringify(maestro?.system || {})), cantidad };
  return it;
}

// [UNDAVAR-PARTE-4.2h3-PAREJA] Bonos pasivos que corresponden al actor ahora mismo
function bonosPasivosEsperados(actor) {
  const esperados = [];
  // [UNDAVAR-PARTE-4.2h3-PAREJA] La misma habilidad no se acumula por estar en dos armas
  const vistos = new Set();
  (actor?.items || []).forEach(it => {
    if (it.type !== "arma" && it.type !== "arte") return;
    // [UNDAVAR-PARTE-10.4-ARMAS] El arma común no aporta pasivos de arte
    if (it.type === "arma" && esArmaComun(it)) return;
    habilidadesItem(it).forEach(h => {
      if (h.modoUso !== "pasivo") return;
      if (!requisitoArmasCumplido(actor, h)) return;
      (h.bonos || []).forEach(b => {
        const id = `pasivo-${h.id}-${b.estadistica}`;
        if (vistos.has(id)) return;
        vistos.add(id);
        esperados.push({
          id,
          itemId: it.id,
          nombre: `${it.name} — ${h.nombre || "Pasivo"}`,
          estadistica: b.estadistica,
          valor: Number(b.valor) || 0,
          modo: b.modo || "fijo",
          turnos: 999,
          pasivo: "habilidad"
        });
      });
    });
  });
  return esperados;
}

// [UNDAVAR-PARTE-4.2h3-PAREJA] Sincroniza los bonos pasivos de las habilidades
function sincronizarBonosPasivos(actor) {
  if (!actor?.system) return { cambio: false, activados: [] };
  if (!Array.isArray(actor.system.bonosActivos)) actor.system.bonosActivos = [];

  const actuales = actor.system.bonosActivos.filter(b => b.pasivo === "habilidad");
  const esperados = bonosPasivosEsperados(actor);
  const firma = lista => lista.map(b => `${b.id}:${b.estadistica}:${Number(b.valor) || 0}`).sort().join("|");
  if (firma(actuales) === firma(esperados)) return { cambio: false, activados: [] };

  actor.system.bonosActivos = actor.system.bonosActivos
    .filter(b => b.pasivo !== "habilidad")
    .concat(esperados);

  // Solo se registran los pasivos que acaban de activarse
  const idsAntes = new Set(actuales.map(b => b.id));
  const activados = esperados.filter(b => !idsAntes.has(b.id));
  return { cambio: true, activados };
}

// [UNDAVAR-PARTE-4.2h3-PAREJA] Texto del registro cuando un pasivo se activa
function resultadoPasivoHTML(actor, bonos) {
  const detalle = bonos.map(b => `${etiquetaEstadistica(b.estadistica)} +${Number(b.valor) || 0}`).join(" · ");
  const nombres = [...new Set(bonos.map(b => b.nombre))].join(", ");
  return `<h4>${esc(actor.nombre)} — Pasivo activo</h4>
    <p class="roll-nota"><b>Habilidad:</b> ${esc(nombres)}</p>
    <p class="roll-nota"><b>Bonos:</b> ${esc(detalle)}</p>
    <p class="roll-nota">Se mantiene mientras se cumpla el requisito.</p>`;
}

// [UNDAVAR-PARTE-4.2h3-PAREJA] Guarda los pasivos y deja constancia en el historial
async function guardarBonosPasivos(actor, store) {
  const sync = sincronizarBonosPasivos(actor);
  if (!sync.cambio) return false;
  if (sync.activados.length) await logTirada(actor, resultadoPasivoHTML(actor, sync.activados), store);
  else await dbPut(store, actor);
  return true;
}

// [UNDAVAR-PARTE-4.2h3-PAREJA] Requisito de una habilidad (armas por nombre)
function requisitoHabilidadCumplido(actor, hab) {
  return requisitoArmasCumplido(actor, hab);
}

function motivoRequisitoHabilidad(hab) {
  const armas = Array.isArray(hab?.requisito?.armas) ? hab.requisito.armas : [];
  return armas.length
    ? `Necesitas ${armas.join(" y ")} en el inventario.`
    : "No cumples el requisito de esta habilidad.";
}

// [UNDAVAR-PARTE-4.2b] Confirmación con el estilo de la app (sustituye a confirm())
function confirmarAccion(titulo, mensaje, textoOk = "Continuar") {
  return new Promise(resolve => {
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo";
    fondo.innerHTML = `
      <div class="modal-caja modal-confirmar">
        <div class="modal-header">
          <h3>${esc(titulo)}</h3>
          <button class="modal-cerrar" aria-label="Cerrar" title="Cerrar">✕</button>
        </div>
        <div class="modal-cuerpo">
          <p class="confirmar-texto">${esc(mensaje).replace(/\n/g, "<br>")}</p>
          <div class="modal-acciones">
            <button class="btn-secundario" data-conf="0">Cancelar</button>
            <button class="btn-primario" data-conf="1">${esc(textoOk)}</button>
          </div>
        </div>
      </div>`;
    // [UNDAVAR-PARTE-8-MAPA] Dentro de pantalla completa el diálogo va al mismo contenedor
    contenedorOverlays().appendChild(fondo);

    const fin = (valor) => { fondo.remove(); resolve(valor); };
    fondo.querySelector(".modal-cerrar").addEventListener("click", () => fin(false));
    fondo.querySelector('[data-conf="0"]').addEventListener("click", () => fin(false));
    fondo.querySelector('[data-conf="1"]').addEventListener("click", () => fin(true));
    fondo.addEventListener("click", (e) => { if (e.target === fondo) fin(false); });
  });
}

function dadosHTML(ds) {
  return `<div class="dados-resultado">${ds.map(d => `<span class="dado ${[1, 3, 5].includes(d) ? 'acierto' : 'perdida'}">${d}</span>`).join("")}</div>`;
}

// [UNDAVAR-PARTE-4.2e4e-CONDICIONES] Normaliza las condiciones de un ítem con su duración
function condicionesItem(item) {
  return normalizarCondicionesArte(item?.system?.condiciones);
}

// [UNDAVAR-PARTE-4.2h1-HABILIDADES] Aplica una lista de condiciones al objetivo
function aplicarListaCondiciones(actor, lista) {
  const norm = normalizarCondicionesArte(lista);
  if (!norm.length) return [];
  if (!Array.isArray(actor.system.condiciones)) actor.system.condiciones = [];
  const nuevas = [];
  norm.forEach(({ id, turnos }) => {
    const def = CONDICIONES_ARTE.find(c => c.id === id);
    if (!def) return;
    const existente = actor.system.condiciones.find(c => c.id === id);
    if (existente) existente.turnos = Math.max(Number(existente.turnos) || 0, turnos);
    else actor.system.condiciones.push({ id, nombre: def.nombre, turnos });
    nuevas.push(def.nombre);
  });
  return nuevas;
}

// [UNDAVAR-PARTE-4.2e5-ARTES] Aplica las condiciones de un arte al objetivo
function aplicarCondicionesArte(actor, item) {
  return aplicarListaCondiciones(actor, condicionesItem(item));
}

// [UNDAVAR-PARTE-4.2h1-HABILIDADES] Inicia el enfriamiento del arte/arma
function iniciarEnfriamientoArte(actor, item, turnosEf = 1) {
  const turnos = enfriamientoTurnosItem(item);
  if (turnos <= 0) return;
  if (!Array.isArray(actor.system.enfriamientos)) actor.system.enfriamientos = [];
  actor.system.enfriamientos.push({
    itemId: item.id,
    nombre: item.name,
    espera: Math.max(0, Number(turnosEf) - 1),
    turnos
  });
}

// [UNDAVAR-PARTE-4.2e5-ARTES] Resultado de un arte descriptiva (sin tirada de daño)
function resultadoArteDescriptivoHTML(it, nivel, costPA, paAntes, paDespues, hab = null) {
  const texto = hab?.descripcion || it.system?.descripcion || it.system?.efecto || "";
  const titulo = hab?.nombre ? `${it.name} — ${hab.nombre}` : it.name;
  const base = nivel === 0 ? "Sin nivel" : `Nv.${nivel}`;
  return `<h4>${esc(titulo)} <small>${base} · ${costPA} PA</small></h4>
    <p class="roll-nota"><b>Efecto:</b> ${esc(texto || "Sin descripción.")}</p>
    <p class="roll-nota">Arte descriptiva: no lanza daño. PA: ${paAntes} → ${paDespues}.</p>`;
}

// [UNDAVAR-PARTE-4.2h1d-REGISTRO] Registro de habilidades que aplican efecto
function resultadoEfectoHTML(it, hab, objetivo, partes, paRestantes, sinPA = false) {
  const texto = hab?.descripcion || it.system?.descripcion || it.system?.efecto || "";
  const titulo = hab?.nombre ? `${it.name} — ${hab.nombre}` : it.name;
  const detalle = partes?.length ? " · " + partes.join(". ") : "";
  return `<h4>${esc(titulo)} <small>Aplica efecto</small></h4>
    <p class="roll-nota"><b>Efecto:</b> ${esc(texto || "Sin descripción.")}</p>
    <p class="roll-nota"><b>Objetivo:</b> ${esc(objetivo?.nombre || "—")}${esc(detalle)}</p>
    <p class="roll-nota">PA restantes: ${sinPA ? "∞" : (Number(paRestantes) || 0)}.</p>`;
}

// [UNDAVAR-PARTE-4.2h1-HABILIDADES] Pregunta qué habilidad lanzar si hay varias
// [UNDAVAR-PARTE-4.2h3-PAREJA] Filtra pasivos y habilidades cuyo requisito no se cumple
// [UNDAVAR-PARTE-4.2h4j-EDITOR-TABS] Fusiona la habilidad con la variación de su nivel
// [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] La variación es propia de la habilidad elegida
function habilidadConVariacion(item, hab) {
  if (!hab || hab._variacionAplicada) return hab;
  const v = variacionNivelHabilidad(hab, Number(item?.system?.nivel) || 0);
  if (!v) return hab;
  const efVar = v.efectoMecanico?.definido ? normalizarEfecto(v.efectoMecanico) : null;
  const efVarTiene = !!efVar && CAMPOS_EFECTO.some(k => Number(efVar.campos?.[k]?.valor) > 0);
  return {
    ...hab,
    descripcion: v.descripcion || hab.descripcion,
    bonos: [...(hab.bonos || []), ...(Array.isArray(v.bonos) ? v.bonos : [])],
    // [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] El efecto del nivel sustituye al base si tiene campos
    efectoMecanico: efVarTiene ? efVar : hab.efectoMecanico,
    aplicaEfecto: !!hab.aplicaEfecto || !!v.aplicaEfecto,
    _variacionAplicada: true
  };
}

function elegirHabilidad(item, actor = null) {
  const habs = habilidadesItem(item);
  // [UNDAVAR-PARTE-4.2h3-PAREJA] Los pasivos no se lanzan: se aplican solos
  const lanzables = habs.filter(h => h.modoUso !== "pasivo");
  const disponibles = actor ? lanzables.filter(h => requisitoHabilidadCumplido(actor, h)) : lanzables;
  const bloqueadas = lanzables.filter(h => !disponibles.includes(h));

  if (!disponibles.length) {
    // Un arma sin habilidades lanzables funciona como espada común
    if (item.type === "arma") {
      // [UNDAVAR-PARTE-10.4-ARMAS] El arma común no avisa de requisito
      if (!esArmaComun(item)) notificar(`⚔️ ${item.name}: sin su requisito funciona como un arma común.`);
      return Promise.resolve({
        id: "basico",
        nombre: "Ataque común",
        modoUso: "dano",
        descripcion: "",
        conjuro: "",
        condiciones: [],
        bonos: [],
        requisito: {}
      });
    }
    notificar(`⚠️ ${item.name}: ${motivoRequisitoHabilidad(bloqueadas[0])}`);
    return Promise.resolve(null);
  }

  if (disponibles.length <= 1) return Promise.resolve(habilidadConVariacion(item, disponibles[0]));

  return new Promise(resolve => {
    let resuelto = false;
    const fin = (val) => { if (resuelto) return; resuelto = true; resolve(val); };
    const notaBloqueadas = bloqueadas.length
      ? `<p class="nota">Bloqueadas: ${bloqueadas.map(h => esc(h.nombre)).join(", ")}. ${esc(motivoRequisitoHabilidad(bloqueadas[0]))}</p>`
      : "";
    const modal = crearModal(`Habilidades de ${item.name}`, `
      <p class="nota">Elige qué habilidad lanzar.</p>
      <div class="campo-fila"><label>Habilidad</label>
        <select id="hab-select">
          ${disponibles.map((h, i) => `<option value="${i}">${esc(h.nombre)} — ${esc(etiquetaModoUso(h.modoUso))}</option>`).join("")}
        </select>
      </div>
      ${notaBloqueadas}
      <div class="modal-acciones"><button class="btn-primario" id="hab-ok">Lanzar</button></div>
    `, () => fin(null));

    qs("#hab-ok", modal).addEventListener("click", () => {
      const h = disponibles[Number(qs("#hab-select", modal)?.value) || 0] || null;
      fin(habilidadConVariacion(item, h));
      modal.remove();
    });
  });
}

// [UNDAVAR-PARTE-4.2h1b-SELLO] Aplica los bonos de una habilidad al lanzador
// [UNDAVAR-PARTE-4.2h1f-ACUMULATIVO] Respeta la casilla «Acum.» de cada bono
// [UNDAVAR-PARTE-4.2h4j-ACUMULATIVO] Un bono acumulativo sube en una sola entrada
// [UNDAVAR-PARTE-4.2h4k-ACUMULATIVO] Si el bono sigue activo no cambia; al expirar vuelve a empezar
function aplicarBonosHabilidad(actor, item, hab, nombreHab, turnosDefecto = 1) {
  const bonos = Array.isArray(hab?.bonos) ? hab.bonos : [];
  if (!bonos.length) return { aplicados: 0, renovados: [] };
  if (!Array.isArray(actor.system.bonosActivos)) actor.system.bonosActivos = [];
  const renovados = [];
  bonos.forEach(b => {
    const turnos = Math.max(1, Number(b.turnos) || turnosDefecto);
    if (b.acumulativo) {
      const existente = actor.system.bonosActivos.find(x =>
        x.itemId === item.id && x.estadistica === b.estadistica && x.nombre === nombreHab && x.acumulativo);
      // [UNDAVAR-PARTE-4.2h4l-ACUMULATIVO] Cada golpe suma su valor sin refrescar los turnos
      if (existente && Number(existente.turnos) > 0) {
        existente.valor = (Number(existente.valor) || 0) + (Number(b.valor) || 0);
        renovados.push({
          nombre: nombreHab,
          estadistica: b.estadistica,
          turnos: Number(existente.turnos),
          acumulado: Number(existente.valor) || 0
        });
        return;
      }
      // [UNDAVAR-PARTE-4.2h4l-ACUMULATIVO] Si expiró, el acumulativo vuelve a empezar
      if (existente) {
        existente.valor = Number(b.valor) || 0;
        existente.turnos = turnos;
        renovados.push({ nombre: nombreHab, estadistica: b.estadistica, turnos, reiniciado: true });
        return;
      }
    } else {
      // Sin «Acum.»: el uso refresca el bono anterior del mismo ítem y estadística
      actor.system.bonosActivos = actor.system.bonosActivos.filter(x =>
        !(x.itemId === item.id && x.estadistica === b.estadistica && x.nombre === nombreHab));
    }
    actor.system.bonosActivos.push({
      id: nuevoId(),
      itemId: item.id,
      nombre: nombreHab,
      estadistica: b.estadistica,
      valor: Number(b.valor) || 0,
      modo: b.modo || "fijo",
      turnos,
      acumulativo: !!b.acumulativo
    });
  });
  return { aplicados: bonos.length, renovados };
}

// [UNDAVAR-PARTE-4.2h4j-ACUMULATIVO] Aviso cuando un bono acumulativo ya estaba activo
// [UNDAVAR-PARTE-4.2h4l-ACUMULATIVO] Distingue «sube» de «se reinició»
function avisoBonoRenovado(r) {
  const n = r?.renovados?.[0];
  if (!n) return "";
  if (n.reiniciado) return ` El acumulativo volvió a empezar; ${n.turnos} turno${n.turnos === 1 ? "" : "s"}.`;
  if (n.acumulado !== undefined) return ` El bono sube a ${n.acumulado}; te quedan ${n.turnos} turno${n.turnos === 1 ? "" : "s"}.`;
  return "";
}

// [UNDAVAR-PARTE-4.2h1b-SELLO] Elige objetivo y condiciones de una habilidad de daño
// [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] También sirve para aplicar el efecto junto al daño
async function elegirObjetivoYCondiciones(actor, store, hab) {
  const condiciones = normalizarCondicionesArte(hab?.condiciones);
  const ef = hab?.efectoMecanico;
  const aplicaEfecto = !!hab?.aplicaEfecto;
  const objetivoTipo = ef?.objetivo || "ambos";

  // Sin condiciones ni efecto que aplicar, no hay nada que preguntar
  if (!condiciones.length && !aplicaEfecto) return null;

  // Efecto solo sobre el lanzador y sin condiciones: no hace falta modal
  if (!condiciones.length && objetivoTipo === "propio") {
    return { objetivo: actor, store, condiciones: [] };
  }

  let todos = [
    ...(await dbGetAll("personajes")).map(a => ({ actor: a, store: "personajes" })),
    ...(await dbGetAll("npcs")).map(a => ({ actor: a, store: "npcs" }))
  ];
  // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Respeta el objetivo del efecto mecánico
  if (objetivoTipo === "propio") todos = todos.filter(o => o.actor.id === actor.id && o.store === store);
  else if (objetivoTipo === "otro") todos = todos.filter(o => !(o.actor.id === actor.id && o.store === store));
  if (!todos.length) { notificar("⚠️ No hay objetivos para aplicar la condición."); return null; }

  const opciones = todos.map((o, i) => {
    const e = o.actor.system?.estado || {};
    const estado = e.muerto ? " ☠️" : e.inconsciente ? " 😵" : "";
    const marca = o.actor.id === actor.id && o.store === store ? " (tú)" : "";
    return `<option value="${i}" ${o.actor.id === actor.id && o.store === store ? "selected" : ""}>${esc(o.actor.nombre)}${marca}${estado} (${o.store === "npcs" ? "PNJ" : "PJ"})</option>`;
  }).join("");

  const condicionesHTML = condiciones.length
    ? `<div class="condiciones-lista">
        ${condiciones.map(c => `<div class="condicion-fila">
          <label class="campo-check"><input type="checkbox" class="cond-aplicar" value="${c.id}" checked> ${esc(etiquetaCondicion(c.id))}</label>
          <span class="nota">${c.turnos} turno${c.turnos === 1 ? "" : "s"}</span>
        </div>`).join("")}
      </div>`
    : "";

  return new Promise(resolve => {
    let resuelto = false;
    const fin = v => { if (resuelto) return; resuelto = true; resolve(v); };
    const modal = crearModal(`Objetivo de ${hab?.nombre || "la habilidad"}`, `
      <p class="nota">Elige el objetivo${condiciones.length ? " y desmarca las condiciones que no se apliquen" : ""}.</p>
      <div class="campo-fila"><label>Objetivo</label><select id="cond-objetivo">${opciones}</select></div>
      ${condicionesHTML}
      <div class="modal-acciones"><button class="btn-primario" id="cond-ok">Aplicar</button></div>
    `, () => fin(null));

    qs("#cond-ok", modal).addEventListener("click", () => {
      const obj = todos[Number(qs("#cond-objetivo", modal)?.value) || 0];
      const seleccionadas = qsa(".cond-aplicar", modal).filter(c => c.checked).map(c => ({
        id: c.value,
        turnos: condiciones.find(x => x.id === c.value)?.turnos || 1
      }));
      modal.remove();
      fin(obj ? { objetivo: obj.actor, store: obj.store, condiciones: seleccionadas } : null);
    });
  });
}

// [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Aplica el efecto mecánico y las condiciones a un objetivo
async function aplicarEfectoHabilidad(actor, store, item, hab, objetivo, storeObjetivo, nombreHab, condicionesSeleccionadas = null) {
  const ef = hab?.efectoMecanico;
  const condiciones = Array.isArray(condicionesSeleccionadas)
    ? condicionesSeleccionadas
    : normalizarCondicionesArte(hab?.condiciones);
  const partes = [];
  const turnosEf = Math.max(1, Number(ef?.turnos) || 1);

  if (ef) {
    // Campos que se repiten en los turnos siguientes
    const camposPorTurno = {};
    CAMPOS_EFECTO.forEach(k => {
      if (Number(ef?.campos?.[k]?.valor) > 0 && ef.campos[k].cuando === "turno") camposPorTurno[k] = ef.campos[k];
    });
    const r = aplicarCamposEfecto(objetivo, ef.campos);
    if (r) partes.push(resumenEfectoAplicado(r));
    if (Object.keys(camposPorTurno).length && turnosEf > 1) {
      if (!Array.isArray(objetivo.system.efectosPendientes)) objetivo.system.efectosPendientes = [];
      objetivo.system.efectosPendientes.push({
        id: nuevoId(),
        nombre: nombreHab,
        campos: camposPorTurno,
        turnos: turnosEf - 1
      });
    }
  }

  const aplicadas = aplicarListaCondiciones(objetivo, condiciones);
  if (aplicadas.length) partes.push(`Condiciones: ${aplicadas.join(", ")}`);
  sincronizarEstadoVital(objetivo);
  await dbPut(storeObjetivo, objetivo);
  return partes;
}

// [UNDAVAR-PARTE-4.2e5-ARTES] Elige objetivo y aplica el efecto de un arte
async function abrirModalUsarArte(actor, store, item, hab = null) {
  // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Usa la habilidad elegida, no el efecto suelto del ítem
  // [UNDAVAR-PARTE-4.2h4j-EDITOR-TABS] Añade la variación configurada para el nivel del arte/arma
  const h = habilidadConVariacion(item, hab || habilidadesItem(item)[0]);
  if (!h) { notificar("⚠️ Este arte no tiene habilidades definidas."); return; }
  const ef = h.efectoMecanico;
  const condiciones = normalizarCondicionesArte(h.condiciones);
  const bonos = Array.isArray(h.bonos) ? h.bonos : [];
  if (!ef && !condiciones.length && !bonos.length) {
    notificar("⚠️ Esta habilidad no tiene efecto mecánico definido.");
    return;
  }

  // [UNDAVAR-PARTE-4.2h1b-SELLO] Bonos puros: se aplican sin elegir objetivo
  if (!ef && !condiciones.length && bonos.length) {
    const nombreHab = h.nombre ? `${item.name} — ${h.nombre}` : item.name;
    const rBonos = aplicarBonosHabilidad(actor, item, h, nombreHab, 1);
    iniciarEnfriamientoArte(actor, item, 1);
    await dbPut(store, actor);
    // [UNDAVAR-PARTE-4.2h1d-REGISTRO] Registra la aplicación de bonos
    await logTirada(actor, resultadoEfectoHTML(item, h, actor, ["Bonos aplicados al lanzador"], actor.system.pa?.value, !!actor.system.datos?.sinRangoPA), store);
    notificar(`✨ ${nombreHab}: bonos aplicados al lanzador.${avisoBonoRenovado(rBonos)}`);
    render();
    return;
  }

  const objetivoTipo = ef?.objetivo || "ambos";
  const todos = [
    ...(await dbGetAll("personajes")).map(a => ({ actor: a, store: "personajes" })),
    ...(await dbGetAll("npcs")).map(a => ({ actor: a, store: "npcs" }))
  ];
  let objetivos = todos;
  if (objetivoTipo === "propio") objetivos = todos.filter(o => o.actor.id === actor.id && o.store === store);
  else if (objetivoTipo === "otro") objetivos = todos.filter(o => !(o.actor.id === actor.id && o.store === store));
  if (!objetivos.length) { notificar("⚠️ No hay un objetivo válido para este arte."); return; }

  const opciones = objetivos.map((o, i) => {
    const e = o.actor.system?.estado || {};
    const estado = e.muerto ? " ☠️" : e.inconsciente ? " 😵" : "";
    return `<option value="${i}" ${o.actor.id === actor.id && o.store === store ? "selected" : ""}>${esc(o.actor.nombre)}${estado} (${o.store === "npcs" ? "PNJ" : "PJ"})</option>`;
  }).join("");

  const nombreHab = h.nombre ? `${item.name} — ${h.nombre}` : item.name;
  const condicionesHTML = condiciones.length > 1
    ? `<div class="campo-fila"><label>Condiciones</label>
        <div class="condiciones-lista">
          ${condiciones.map(c => `<div class="condicion-fila">
            <label class="campo-check"><input type="checkbox" class="arte-condicion" value="${c.id}" checked> ${esc(etiquetaCondicion(c.id))}</label>
            <span class="nota">${c.turnos} turno${c.turnos === 1 ? "" : "s"}</span>
          </div>`).join("")}
        </div>
      </div>`
    : condiciones.length === 1
      ? `<p class="nota"><b>Condición:</b> ${esc(etiquetaCondicion(condiciones[0].id))} (${condiciones[0].turnos} turno${condiciones[0].turnos === 1 ? "" : "s"})</p>`
      : "";

  const modal = crearModal(`Usar ${item.name}`, `
    <p class="nota"><b>Habilidad:</b> ${esc(h.nombre)}</p>
    <p class="nota"><b>Efecto:</b> ${esc(describirEfectoMecanico(ef) || "Sin efecto mecánico.")}</p>
    ${condicionesHTML}
    <div class="campo-fila"><label>Objetivo</label><select id="arte-objetivo">${opciones}</select></div>
    <div class="modal-acciones"><button class="btn-primario" id="arte-ok">Aplicar</button></div>
  `);

  qs("#arte-ok", modal).addEventListener("click", async () => {
    const obj = objetivos[Number(qs("#arte-objetivo", modal)?.value) || 0];
    if (!obj) return;
    // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Solo se aplican las condiciones marcadas
    const seleccionadas = condiciones.length > 1
      ? qsa(".arte-condicion", modal).filter(c => c.checked).map(c => ({
          id: c.value,
          turnos: condiciones.find(x => x.id === c.value)?.turnos || 1
        }))
      : condiciones;
    modal.remove();

    const mismo = obj.actor.id === actor.id && obj.store === store;
    const objetivo = mismo ? actor : obj.actor;
    const turnosEf = Math.max(1, Number(ef?.turnos) || 1);

    // [UNDAVAR-PARTE-4.2e2-EFECTOS] Campos que se repiten en los turnos siguientes
    const camposPorTurno = {};
    CAMPOS_EFECTO.forEach(k => {
      if (Number(ef?.campos?.[k]?.valor) > 0 && ef.campos[k].cuando === "turno") camposPorTurno[k] = ef.campos[k];
    });

    const r = ef ? aplicarCamposEfecto(objetivo, ef.campos) : null;
    if (Object.keys(camposPorTurno).length && turnosEf > 1) {
      if (!Array.isArray(objetivo.system.efectosPendientes)) objetivo.system.efectosPendientes = [];
      objetivo.system.efectosPendientes.push({
        id: nuevoId(),
        nombre: nombreHab,
        campos: camposPorTurno,
        turnos: turnosEf - 1
      });
    }

    const aplicadas = aplicarListaCondiciones(objetivo, seleccionadas);
    sincronizarEstadoVital(objetivo);

    // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Los bonos de la habilidad van al lanzador
    // [UNDAVAR-PARTE-4.2h1b-SELLO] Reutiliza el helper de bonos
    aplicarBonosHabilidad(actor, item, h, nombreHab, turnosEf);

    iniciarEnfriamientoArte(actor, item, turnosEf);

    await dbPut(obj.store, objetivo);
    if (!mismo && (bonos.length || enfriamientoTurnosItem(item) > 0)) await dbPut(store, actor);

    const partes = [];
    if (r) partes.push(resumenEfectoAplicado(r));
    if (aplicadas.length) partes.push(`Condiciones: ${aplicadas.join(", ")}`);
    // [UNDAVAR-PARTE-4.2h1d-REGISTRO] Registra el efecto aplicado en el historial
    await logTirada(actor, resultadoEfectoHTML(item, h, objetivo, partes, actor.system.pa?.value, !!actor.system.datos?.sinRangoPA), store);
    notificar(`✨ ${nombreHab} en ${objetivo.nombre}: ${partes.length ? partes.join(". ") : "sin cambios"}.`);
    render();
  });
}

// [UNDAVAR-PARTE-4.2c] Resultado de usar un arte/arma con su nivel
// [UNDAVAR-PARTE-4.2c5] Añade la tirada de rebote si el atacante está herido (8/8)
function resultadoUsoArteHTML(it, nivel, costPA, paAntes, paDespues, r, rebote = null, actor = null, hab = null) {
  // [UNDAVAR-PARTE-4.2e4-BONOS] Suma bonos de aciertos y daño al resultado
  const rb = aplicarBonoDano(r, actor);
  const bono = bonusCombate(nivel) + bonoAciertos(actor);
  const base = nivel === 0 ? "Sin nivel" : `Nv.${nivel}`;
  // [UNDAVAR-PARTE-4.2d-EFECTOS] Muestra el efecto narrativo del arte o arma
  // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Usa la descripción de la habilidad elegida
  const textoEfecto = hab?.descripcion || it.system?.descripcion || it.system?.efecto || "";
  const efectoHTML = textoEfecto ? `<p class="roll-nota"><b>Efecto:</b> ${esc(textoEfecto)}</p>` : "";
  const reboteHTML = rebote ? `
    <h5>⚡ Rebote (herido 8/8)</h5>
    ${dadosHTML(rebote.ds)}
    <p class="roll-nota">Aciertos: <b>${rebote.aciertos}</b> → ${rebote.resultado}.</p>` : "";
  const titulo = hab?.nombre ? `${it.name} — ${hab.nombre}` : it.name;
  return `<h4>${esc(titulo)} <small>${base} · ${costPA} PA</small></h4>
    ${dadosHTML(rb.ds)}
    <table class="roll-tabla">
      <tr><td>Dados de daño</td><td>${rb.ds.length}d6</td></tr>
      <tr><td>Bono fijo</td><td>+${rb.bonoFijo}</td></tr>
      <tr><td>Daño total</td><td><b>${rb.danoTotal}</b></td></tr>
      <tr><td>Bono de aciertos</td><td>${bono ? `+${bono}` : "—"}</td></tr>
      <tr><td>PV ganados</td><td>${rb.pv}</td></tr>
      <tr><td>Suerte</td><td>${rb.buenaSuerte ? "✨ Buena" : "💀 Mala"}</td></tr>
    </table>
    ${efectoHTML}
    <p class="roll-nota">PA: ${paAntes} → ${paDespues}. El bono de aciertos se suma a la tirada de ataque, no al daño.</p>${reboteHTML}`;
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

// [UNDAVAR-PARTE-4.2c-VITAL] Estado vital persistente: inconsciente, muerto e intentos
function estadoVital(actor) {
  if (!actor.system) actor.system = {};
  if (!actor.system.estado) actor.system.estado = {};
  const e = actor.system.estado;
  if (typeof e.inconsciente !== "boolean") e.inconsciente = false;
  if (typeof e.muerto !== "boolean") e.muerto = false;
  if (typeof e.intentosDespertar !== "number") e.intentosDespertar = 0;
  return e;
}

// [UNDAVAR-PARTE-4.2c-VITAL] La salud a 0 marca inconsciencia; la muerte manda siempre
function sincronizarEstadoVital(actor) {
  const e = estadoVital(actor);
  if (e.muerto) {
    e.inconsciente = false;
    return e;
  }
  const salud = Number(actor.system.estado?.ptSalud?.value) || 0;
  if (salud <= 0) {
    e.inconsciente = true;
  } else {
    e.inconsciente = false;
    e.intentosDespertar = 0;
  }
  return e;
}

// [UNDAVAR-PARTE-4.2c-VITAL] Aviso de inconsciencia o muerte en la ficha (PJ y PNJ)
function bannerEstadoVital(actor) {
  const e = estadoVital(actor);
  if (e.muerto) {
    return `<div class="estado-vital estado-vital-muerto">
      <div class="estado-vital-texto"><strong>☠️ Muerto</strong><span>La muerte es permanente. Solo el SR puede reactivarlo.</span></div>
      <button class="btn-secundario chico" id="btn-reactivar-vital">Reactivar (SR)</button>
    </div>`;
  }
  if (!e.inconsciente) return "";
  const intentos = Math.min(5, Number(e.intentosDespertar) || 0);
  return `<div class="estado-vital estado-vital-inconsciente">
    <div class="estado-vital-texto"><strong>😵 Inconsciente</strong><span>Despierta con 4 aciertos en 4d6 · intento ${intentos}/5. Si falla los 5, muere.</span></div>
    <div class="estado-vital-acciones">
      <button class="btn-primario chico" id="btn-despertar-vital" ${intentos >= 5 ? "disabled" : ""}>Intentar despertar</button>
      <button class="btn-secundario chico" id="btn-elixir-vital">Administrar elixir</button>
    </div>
  </div>`;
}

// [UNDAVAR-PARTE-4.2c-VITAL] Cablea los botones del aviso vital
function wireEstadoVital(actor, store) {
  qs("#btn-despertar-vital")?.addEventListener("click", () => intentarDespertar(actor, store));
  qs("#btn-elixir-vital")?.addEventListener("click", () => administrarElixir(actor, store));
  qs("#btn-reactivar-vital")?.addEventListener("click", () => reactivarActor(actor, store));
}

// [UNDAVAR-PARTE-4.2c-VITAL] Tirada de despertar: 4 aciertos, 5 intentos y muerte al fallar
async function intentarDespertar(actor, store) {
  const e = estadoVital(actor);
  if (e.muerto) { notificar("☠️ Está muerto."); return; }
  if (!e.inconsciente) { notificar("No está inconsciente."); return; }
  if ((Number(e.intentosDespertar) || 0) >= 5) { notificar("☠️ Ya agotó los 5 intentos."); return; }

  const r = tiradaDespertar();
  const intento = (Number(e.intentosDespertar) || 0) + 1;
  e.intentosDespertar = intento;

  if (r.despierta) {
    e.inconsciente = false;
    e.intentosDespertar = 0;
    actor.system.estado.ptSalud.value = Math.max(1, Number(actor.system.estado.ptSalud.value) || 0);
    notificar(`✅ ${actor.nombre} despierta con 1 de salud.`);
  } else if (intento >= 5) {
    e.inconsciente = false;
    e.muerto = true;
    notificar(`☠️ ${actor.nombre} falló los 5 intentos y muere.`);
  } else {
    notificar(`❌ ${actor.nombre} no despierta (intento ${intento}/5).`);
  }

  await dbPut(store, actor);
  await logTirada(actor, `<h4>Despertar</h4>${dadosHTML(r.ds)}<p style="text-align:center">Aciertos: <b>${r.aciertos}</b>/4 — ${r.despierta ? "✅ ¡Despierta!" : intento >= 5 ? "☠️ Muere." : "❌ No despierta."}</p><table class="roll-tabla"><tr><td>Intento</td><td>${r.despierta ? "—" : `${intento}/5`}</td></tr><tr><td>PV ganados</td><td>${r.pv}</td></tr><tr><td>Suerte</td><td>${r.buenaSuerte ? "✨ Buena" : "💀 Mala"}</td></tr></table>`, store);
  render();
}

// [UNDAVAR-PARTE-4.2d-EFECTOS] Asegura los campos vitales antes de curar
function asegurarVitales(actor) {
  if (!actor.system) actor.system = {};
  if (!actor.system.estado) actor.system.estado = {};
  const e = actor.system.estado;
  if (!e.ptHerida) e.ptHerida = { value: 0 };
  if (!e.ptSalud) e.ptSalud = { value: 0, max: 8 };
  return e;
}

// [UNDAVAR-PARTE-4.2d-EFECTOS] Curar heridas no cura la Salud: al llegar a 0,
// la Salud sube como mucho a la mitad de la máxima (regla del manual)
function curarHeridas(actor, cantidad) {
  const e = asegurarVitales(actor);
  const antesHerida = Number(e.ptHerida.value) || 0;
  const despuesHerida = Math.max(0, antesHerida - Math.max(0, Number(cantidad) || 0));
  e.ptHerida.value = despuesHerida;

  let subidaSalud = 0;
  if (antesHerida > 0 && despuesHerida === 0) {
    const deriv = calcularDerivados(actor.system, actor.items);
    const max = Number(deriv.saludLimiteActual) || Number(e.ptSalud.max) || 8;
    const tope = Math.max(1, Math.ceil(max / 2));
    const antesSalud = Number(e.ptSalud.value) || 0;
    if (antesSalud < tope) {
      e.ptSalud.value = tope;
      subidaSalud = tope - antesSalud;
    }
  }
  return { heridas: antesHerida - despuesHerida, subidaSalud };
}

// [UNDAVAR-PARTE-4.2d-EFECTOS] Curación directa de Salud (elixires, objetos, artes)
function curarSalud(actor, cantidad) {
  const e = asegurarVitales(actor);
  const deriv = calcularDerivados(actor.system, actor.items);
  const max = Number(deriv.saludLimiteActual) || Number(e.ptSalud.max) || 8;
  const antes = Number(e.ptSalud.value) || 0;
  e.ptSalud.value = Math.min(max, antes + Math.max(0, Number(cantidad) || 0));
  return e.ptSalud.value - antes;
}

// [UNDAVAR-PARTE-4.2d-EFECTOS] Quita marcas de hambre, sed, cansancio o fatiga
function quitarMarcas(actor, clave, cantidad) {
  if (!actor.system.extensionEstado) actor.system.extensionEstado = {};
  if (!actor.system.extensionEstado[clave]) actor.system.extensionEstado[clave] = { value: 0 };
  const antes = Number(actor.system.extensionEstado[clave].value) || 0;
  const despues = Math.max(0, antes - Math.max(0, Number(cantidad) || 0));
  actor.system.extensionEstado[clave].value = despues;
  return antes - despues;
}

// [UNDAVAR-PARTE-4.2d-EFECTOS] Elixir de la vida: % de Salud y Herida por turno
function aplicarEfectoVital(actor, pct) {
  const e = asegurarVitales(actor);
  const deriv = calcularDerivados(actor.system, actor.items);
  const max = Number(deriv.saludLimiteActual) || Number(e.ptSalud.max) || 8;
  const curaSalud = Math.max(1, Math.round(max * (Number(pct) || 0) / 100));
  const curaHerida = Math.max(1, Math.round(8 * (Number(pct) || 0) / 100));
  const saludAntes = Number(e.ptSalud.value) || 0;
  const heridaAntes = Number(e.ptHerida.value) || 0;
  e.ptSalud.value = Math.min(max, saludAntes + curaSalud);
  e.ptHerida.value = Math.max(0, heridaAntes - curaHerida);
  return { salud: e.ptSalud.value - saludAntes, herida: heridaAntes - e.ptHerida.value };
}

// [UNDAVAR-PARTE-4.2e2-EFECTOS] Valor real de un campo según su modo (fijo o %)
function valorCampoEfecto(actor, clave, campo) {
  const v = Math.max(0, Number(campo?.valor) || 0);
  if (!v) return 0;
  if (campo.modo !== "pct") return v;
  let base = 9;
  if (clave === "salud") {
    const e = asegurarVitales(actor);
    const deriv = calcularDerivados(actor.system, actor.items);
    // [UNDAVAR-PARTE-4.2e2-EFECTOS] El % de Salud usa la Salud máxima real
    base = Number(deriv.saludMaxima) || Number(e.ptSalud.max) || 8;
  } else if (clave === "herida") {
    base = 8;
  }
  return Math.max(1, Math.round(base * v / 100));
}

// [UNDAVAR-PARTE-4.2e2-EFECTOS] Aplica un conjunto de campos; la Herida va primero
// [UNDAVAR-PARTE-4.2h4j-EFECTO-SIGNO] Las marcas pueden aplicarse (sumar) o quitarse (restar)
function aplicarCamposEfecto(actor, campos) {
  const res = { salud: 0, herida: 0, subidaTope: 0, marcas: {}, marcasAplicadas: {} };
  if (!campos) return res;
  if (campos.herida) {
    const valorHerida = valorCampoEfecto(actor, "herida", campos.herida);
    if (valorHerida > 0) {
      const h = curarHeridas(actor, valorHerida);
      res.herida += h.heridas;
      res.subidaTope += h.subidaSalud;
    }
  }
  if (campos.salud) {
    const valorSalud = valorCampoEfecto(actor, "salud", campos.salud);
    if (valorSalud > 0) res.salud += curarSalud(actor, valorSalud);
  }
  ["hambre", "sed", "cansancio", "fatiga"].forEach(k => {
    if (campos[k]) {
      const valorMarca = valorCampoEfecto(actor, k, campos[k]);
      if (valorMarca > 0) {
        // [UNDAVAR-PARTE-4.2h4j-EFECTO-SIGNO] «aplicar» suma marcas; «quitar» las cura
        if (campos[k].signo === "aplicar") {
          sumarEstado(actor, k, valorMarca);
          res.marcasAplicadas[k] = (res.marcasAplicadas[k] || 0) + valorMarca;
        } else {
          const n = quitarMarcas(actor, k, valorMarca);
          if (n) res.marcas[k] = (res.marcas[k] || 0) + n;
        }
      }
    }
  });
  sincronizarEstadoVital(actor);
  return res;
}

// [UNDAVAR-PARTE-4.2d-EFECTOS] Texto del resultado de usar un ítem
function resumenEfectoAplicado(res) {
  if (!res) return "sin efecto";
  const partes = [];
  if (res.salud) partes.push(`+${res.salud} Salud`);
  if (res.herida) partes.push(`−${res.herida} Herida`);
  if (res.subidaTope) partes.push(`+${res.subidaTope} Salud por curación completa de heridas`);
  Object.entries(res.marcas || {}).forEach(([k, n]) => partes.push(`−${n} ${k}`));
  // [UNDAVAR-PARTE-4.2h4j-EFECTO-SIGNO] Marcas que se suman al objetivo
  Object.entries(res.marcasAplicadas || {}).forEach(([k, n]) => partes.push(`+${n} ${k}`));
  return partes.length ? partes.join(", ") : "sin cambios (ya estaba al máximo)";
}

// [UNDAVAR-PARTE-4.2d-EFECTOS] Usa un ítem sobre un objetivo y descuenta unidades
async function aplicarUsoItem(owner, ownerStore, item, target, targetStore, unidades = 1) {
  // [UNDAVAR-PARTE-10.5-NIVELES] Aplica la configuración del nivel de la unidad usada
  const rInfo = rangoNivelesItem(item);
  const nivelUso = nivelUsoItem(item);
  const itemNivel = rInfo.tiene ? itemConNivel(item, nivelUso) : item;
  const ef = efectoMecanicoItem(itemNivel);
  // [UNDAVAR-PARTE-4.2e4b-USO-BONOS] También se pueden usar ítems que solo dan bonos
  const bonosItem = Array.isArray(itemNivel.system?.bonos) ? itemNivel.system.bonos : [];
  if (!ef && !bonosItem.length) { notificar("⚠️ Este ítem no tiene efecto mecánico ni bonos."); return; }
  if (ef && target.system?.estado?.muerto) { notificar("☠️ No se puede curar a un muerto."); return; }

  // [UNDAVAR-PARTE-4.2e3-TURNO] No se puede usar mientras el dueño lo tenga en enfriamiento
  const enfriamiento = (owner.system?.enfriamientos || []).find(e => e.itemId === item.id);
  if (enfriamiento) {
    notificar(`⏳ ${item.name} está en enfriamiento: ${describirEnfriamiento(enfriamiento)}.`);
    return;
  }

  // [UNDAVAR-PARTE-4.2d-EFECTOS] Si el objetivo es el dueño, usa el mismo objeto
  // para que la curación no se pierda al guardar una copia antigua
  const mismo = target.id === owner.id && targetStore === ownerStore;
  const objetivo = mismo ? owner : target;

  // [UNDAVAR-PARTE-4.2e3-TURNO] Un ítem no consumible no descuenta unidades
  const esConsumible = item.system?.consumible !== false;
  const stock = Math.max(1, Number(item.system?.cantidad) || 1);
  const n = esConsumible ? Math.max(1, Math.min(stock, Number(unidades) || 1)) : 1;
  let res = null;

  // [UNDAVAR-PARTE-4.2e2-EFECTOS] Campos que se repiten en los turnos siguientes
  const camposPorTurno = {};
  CAMPOS_EFECTO.forEach(k => {
    if (Number(ef?.campos?.[k]?.valor) > 0 && ef.campos[k].cuando === "turno") {
      camposPorTurno[k] = ef.campos[k];
    }
  });
  // [UNDAVAR-PARTE-4.2e4b-USO-BONOS] La espera del enfriamiento usa también los turnos del bono
  const turnos = Math.max(1, Number(ef?.turnos) || 0, ...bonosItem.map(b => Number(b.turnos) || 0));

  if (ef) for (let i = 0; i < n; i++) {
    const r = aplicarCamposEfecto(objetivo, ef.campos);
    if (!res) res = r;
    else {
      res.salud += r.salud;
      res.herida += r.herida;
      res.subidaTope += r.subidaTope;
      Object.entries(r.marcas).forEach(([k, v]) => { res.marcas[k] = (res.marcas[k] || 0) + v; });
      // [UNDAVAR-PARTE-4.2h4j-EFECTO-SIGNO] Acumula también las marcas que se aplican
      Object.entries(r.marcasAplicadas || {}).forEach(([k, v]) => { res.marcasAplicadas[k] = (res.marcasAplicadas[k] || 0) + v; });
    }
    // [UNDAVAR-PARTE-4.2e2-EFECTOS] Deja pendientes los turnos restantes de los campos «por turno»
    if (Object.keys(camposPorTurno).length && turnos > 1) {
      if (!Array.isArray(objetivo.system.efectosPendientes)) objetivo.system.efectosPendientes = [];
      objetivo.system.efectosPendientes.push({
        id: nuevoId(),
        nombre: item.name,
        campos: camposPorTurno,
        turnos: turnos - 1
      });
    }
  }

  // [UNDAVAR-PARTE-4.2e4-BONOS] Activa los bonos temporales del ítem
  // [UNDAVAR-PARTE-4.2h1f-ACUMULATIVO] Reutiliza el helper para respetar «Acum.»
  if (bonosItem.length) {
    aplicarBonosHabilidad(owner, item, { bonos: bonosItem }, item.name, turnos);
  }

  // [UNDAVAR-PARTE-4.2e3-TURNO] El enfriamiento empieza cuando termina el efecto
  const turnosEnfriamiento = enfriamientoTurnosItem(itemNivel);
  if (turnosEnfriamiento > 0) {
    if (!Array.isArray(owner.system.enfriamientos)) owner.system.enfriamientos = [];
    owner.system.enfriamientos.push({
      itemId: item.id,
      nombre: item.name,
      espera: Math.max(0, turnos - 1),
      turnos: turnosEnfriamiento
    });
  }

  // [UNDAVAR-PARTE-4.2e3-TURNO] Solo los consumibles se gastan
  if (esConsumible) {
    // [UNDAVAR-PARTE-10.5-NIVELES] Gasta también el nivel de cada unidad consumida
    if (Array.isArray(item.system.nivelesUnidad) && item.system.nivelesUnidad.length) {
      item.system.nivelesUnidad = item.system.nivelesUnidad.slice(n);
      if (item.system.nivelesUnidad.length) item.system.nivelActual = item.system.nivelesUnidad[0];
    }
    item.system.cantidad = stock - n;
    if (item.system.cantidad <= 0) owner.items = (owner.items || []).filter(x => x.id !== item.id);
  } else if (rInfo.tiene && rInfo.oculto) {
    // [UNDAVAR-PARTE-10.5-NIVELES] Un ítem no consumible deja visible su nivel tras usarlo
    item.system.nivelOculto = false;
    item.system.nivelActual = nivelUso;
  }

  await dbPut(ownerStore, owner);
  if (!mismo) await dbPut(targetStore, target);

  // [UNDAVAR-PARTE-4.2e4b-USO-BONOS] Aviso con curación y/o bonos aplicados
  const partes = [];
  if (res) partes.push(resumenEfectoAplicado(res));
  if (bonosItem.length) partes.push(`bonos: ${describirBonosItem(itemNivel)}`);
  const etiquetaNivelUso = rInfo.tiene ? ` (Nv. ${nivelUso})` : "";
  notificar(`🧪 ${item.name}${etiquetaNivelUso} en ${objetivo.nombre}: ${partes.join(" · ") || "sin cambios"}.`);
}

// [UNDAVAR-PARTE-4.2d-EFECTOS] Modal para usar un objeto, elixir o alimento
async function abrirModalUsarItem(owner, ownerStore, itemId, targetFijo = null, targetFijoStore = null) {
  const item = (owner.items || []).find(i => i.id === itemId);
  if (!item) { notificar("⚠️ El ítem ya no está en el inventario."); return; }
  // [UNDAVAR-PARTE-10.5-NIVELES] Usa la configuración del nivel de la próxima unidad
  const rInfo = rangoNivelesItem(item);
  const nivelUso = nivelUsoItem(item);
  const itemNivel = rInfo.tiene ? itemConNivel(item, nivelUso) : item;
  // Con nivel oculto no se muestra el efecto concreto antes de usar
  const nivelOcultoPreview = rInfo.tiene && rInfo.oculto;
  const fuentePreview = nivelOcultoPreview ? item : itemNivel;
  const ef = efectoMecanicoItem(fuentePreview);
  // [UNDAVAR-PARTE-4.2e4b-USO-BONOS] Acepta ítems que solo dan bonos
  const bonosItem = Array.isArray(fuentePreview.system?.bonos) ? fuentePreview.system.bonos : [];
  // [UNDAVAR-PARTE-10.5-NIVELES] Permite ítems cuyo efecto solo existe en los niveles
  const variacionesUso = Array.isArray(item.system?.variacionesNivel) ? item.system.variacionesNivel : [];
  const nivelTieneEfecto = variacionesUso.some(v =>
    v.efectoMecanico?.definido && CAMPOS_EFECTO.some(k => Number(v.efectoMecanico.campos?.[k]?.valor) > 0)
  );
  const nivelTieneBonos = variacionesUso.some(v => Array.isArray(v.bonos) && v.bonos.length);
  if (!ef && !bonosItem.length && !nivelTieneEfecto && !nivelTieneBonos) {
    notificar("⚠️ Este ítem no tiene efecto mecánico ni bonos.");
    return;
  }
  const soloBonos = !ef && !nivelTieneEfecto;
  const efUso = ef || { objetivo: "ambos" };

  // [UNDAVAR-PARTE-4.2e3-TURNO] Avisa si el dueño todavía lo tiene en enfriamiento
  const enfriamiento = (owner.system?.enfriamientos || []).find(e => e.itemId === item.id);
  if (enfriamiento) {
    notificar(`⏳ ${item.name} está en enfriamiento: ${describirEnfriamiento(enfriamiento)}.`);
    return;
  }

  // [UNDAVAR-PARTE-4.2e3-TURNO] Un ítem no consumible se puede usar sin gastarse
  const esConsumible = item.system?.consumible !== false;
  // [UNDAVAR-PARTE-10.5-NIVELES] Cada unidad con niveles se usa por separado
  const conNiveles = rInfo.tiene;
  // [UNDAVAR-PARTE-4.2e4b-USO-BONOS] Un ítem de bonos se usa de una en una
  const maxUnidades = (soloBonos || conNiveles) ? 1 : Math.max(1, Number(item.system?.cantidad) || 1);
  const todos = [
    ...(await dbGetAll("personajes")).map(a => ({ actor: a, store: "personajes" })),
    ...(await dbGetAll("npcs")).map(a => ({ actor: a, store: "npcs" }))
  ];

  let objetivos = todos;
  if (soloBonos) objetivos = todos.filter(o => o.actor.id === owner.id && o.store === ownerStore);
  else if (targetFijo) objetivos = [{ actor: targetFijo, store: targetFijoStore }];
  else if (efUso.objetivo === "propio") objetivos = todos.filter(o => o.actor.id === owner.id && o.store === ownerStore);
  else if (efUso.objetivo === "otro") objetivos = todos.filter(o => !(o.actor.id === owner.id && o.store === ownerStore));

  if (!objetivos.length) { notificar("⚠️ No hay un objetivo válido para este ítem."); return; }

  const opciones = objetivos.map((o, i) => {
    const e = o.actor.system?.estado || {};
    const estado = e.muerto ? " ☠️" : e.inconsciente ? " 😵" : "";
    return `<option value="${i}" ${(targetFijo ? o.actor.id === targetFijo.id : o.actor.id === owner.id && o.store === ownerStore) ? "selected" : ""}>${esc(o.actor.nombre)}${estado} (${o.store === "npcs" ? "PNJ" : "PJ"})</option>`;
  }).join("");

  // [UNDAVAR-PARTE-10.5-NIVELES] Con nivel oculto no se adelanta el efecto
  const descripcionUso = nivelOcultoPreview
    ? `<p class="nota"><b>Nivel oculto:</b> el efecto se revelará al usar el ítem.</p>`
    : soloBonos
      ? `<p class="nota"><b>Bono:</b> ${esc(describirBonosItem(itemNivel))}</p>`
      : `<p class="nota"><b>Efecto:</b> ${esc(describirEfectoMecanico(ef))}</p>`;
  const nivelVisibleTxt = (conNiveles && !nivelOcultoPreview)
    ? `<p class="nota"><b>Nivel:</b> Nv. ${nivelUso}</p>`
    : "";
  const selectorObjetivo = soloBonos
    ? `<p class="nota">Se aplica al portador: ${esc(owner.nombre)}.</p>`
    : `<div class="campo-fila"><label>Objetivo</label><select id="usar-objetivo">${opciones}</select></div>`;
  const unidadesUso = conNiveles
    ? `<p class="nota">${esConsumible ? "Se gastará 1 unidad; cada unidad tiene su propio nivel." : "Este ítem no es consumible: no se gasta al usarlo."}</p>`
    : soloBonos
      ? `<p class="nota">${esConsumible ? "Se gastará 1 unidad." : "Este ítem no es consumible: no se gasta al usarlo."}</p>`
      : esConsumible
        ? `<div class="campo-fila"><label>Unidades (máx. ${maxUnidades})</label><input type="number" id="usar-unidades" min="1" max="${maxUnidades}" value="1"></div>`
        : `<p class="nota">Este ítem no es consumible: no se gasta al usarlo.</p>`;

  const modal = crearModal(`Usar ${item.name}`, `
    ${descripcionUso}
    ${nivelVisibleTxt}
    ${selectorObjetivo}
    ${unidadesUso}
    <div class="modal-acciones"><button class="btn-primario" id="usar-ok">Usar</button></div>
  `);

  qs("#usar-ok", modal).addEventListener("click", async () => {
    const idx = soloBonos ? 0 : Number(qs("#usar-objetivo", modal)?.value) || 0;
    const obj = objetivos[idx];
    const unidades = (!esConsumible || conNiveles)
      ? 1
      : Math.max(1, Math.min(maxUnidades, parseInt(qs("#usar-unidades", modal)?.value, 10) || 1));
    modal.remove();
    await aplicarUsoItem(owner, ownerStore, item, obj.actor, obj.store, unidades);
    render();
  });
}

// [UNDAVAR-PARTE-4.2d-EFECTOS] Elegir un elixir de cualquier inventario para un inconsciente
async function abrirModalAdministrarElixir(target, targetStore) {
  const e = estadoVital(target);
  if (e.muerto) { notificar("☠️ El elixir no revive a un muerto."); return; }

  const actores = [
    ...(await dbGetAll("personajes")).map(a => ({ actor: a, store: "personajes" })),
    ...(await dbGetAll("npcs")).map(a => ({ actor: a, store: "npcs" }))
  ];
  const opciones = [];
  actores.forEach(o => (o.actor.items || []).forEach(it => {
    // [UNDAVAR-PARTE-10.5-NIVELES] Comprueba también el efecto del nivel de la unidad
    const conNivel = rangoNivelesItem(it).tiene;
    const ef = efectoMecanicoItem(conNivel ? itemConNivel(it, nivelUsoItem(it)) : it);
    // [UNDAVAR-PARTE-4.2e2-EFECTOS] Solo sirven los efectos que curan Salud o Herida
    const cura = ef && ["salud", "herida"].some(k => Number(ef.campos?.[k]?.valor) > 0);
    if (cura) {
      opciones.push({ owner: o.actor, store: o.store, item: it });
    }
  }));

  if (!opciones.length) { notificar("⚠️ No hay elixires ni objetos de sanación en los inventarios."); return; }

  const modal = crearModal("Administrar elixir", `
    <p class="nota">${esc(target.nombre)} está inconsciente. Elige un elixir u objeto de sanación.</p>
    <div class="campo-fila"><label>Ítem</label><select id="adm-item">
      ${opciones.map((o, i) => {
        const nv = etiquetaNivelItem(o.item);
        return `<option value="${i}">${esc(o.item.name)}${nv ? ` · ${esc(nv)}` : ""} — ${esc(o.owner.nombre)} (×${Number(o.item.system?.cantidad) || 1})</option>`;
      }).join("")}
    </select></div>
    <div class="modal-acciones"><button class="btn-primario" id="adm-ok">Administrar</button></div>
  `);

  qs("#adm-ok", modal).addEventListener("click", async () => {
    const o = opciones[Number(qs("#adm-item", modal)?.value) || 0];
    modal.remove();
    await aplicarUsoItem(o.owner, o.store, o.item, target, targetStore, 1);
    render();
  });
}

// [UNDAVAR-PARTE-4.2e2-EFECTOS] Efectos pendientes (turnos siguientes de los campos «por turno»)
async function aplicarEfectosPendientes(actor, store, silencioso = false) {
  const pend = Array.isArray(actor.system?.efectosPendientes) ? actor.system.efectosPendientes : [];
  if (!pend.length) return 0;

  let aplicados = 0;
  for (const ef of pend) {
    if (ef.campos) {
      const r = aplicarCamposEfecto(actor, ef.campos);
      if (r.salud || r.herida || Object.keys(r.marcas).length) aplicados++;
    } else if (ef.tipo === "vital") {
      // Compatibilidad con pendientes creados en 4.2d
      const r = aplicarEfectoVital(actor, Number(ef.valor) || 0);
      if (r.salud || r.herida) aplicados++;
    }
    ef.turnos = (Number(ef.turnos) || 0) - 1;
  }
  actor.system.efectosPendientes = pend.filter(x => (Number(x.turnos) || 0) > 0);
  sincronizarEstadoVital(actor);
  await dbPut(store, actor);
  if (aplicados && !silencioso) notificar(`⏳ Efecto pendiente aplicado a ${actor.nombre}.`);
  return aplicados;
}

// [UNDAVAR-PARTE-4.2e3-TURNO] Pasa un turno completo: efectos, enfriamientos y (luego) bonos
async function pasarTurnoActor(actor, store, silencioso = false) {
  let algo = false;

  // 1. Efectos pendientes
  const pend = Array.isArray(actor.system?.efectosPendientes) ? actor.system.efectosPendientes : [];
  if (pend.length) {
    algo = true;
    await aplicarEfectosPendientes(actor, store, silencioso);
  }

  // 2. Bonos activos: descuenta su duración
  const bonosActivos = Array.isArray(actor.system?.bonosActivos) ? actor.system.bonosActivos : [];
  if (bonosActivos.length) {
    algo = true;
    // [UNDAVAR-PARTE-4.2h2-PAREJA] Los bonos pasivos (viento) no caducan por turno
    bonosActivos.forEach(b => { if (!b.pasivo) b.turnos = (Number(b.turnos) || 0) - 1; });
    actor.system.bonosActivos = bonosActivos.filter(b => b.pasivo || (Number(b.turnos) || 0) > 0);
    await dbPut(store, actor);
  }

  // 3. Enfriamientos: primero esperan a que termine el efecto, después descuentan
  const enfriamientos = Array.isArray(actor.system?.enfriamientos) ? actor.system.enfriamientos : [];
  if (enfriamientos.length) {
    algo = true;
    let terminados = 0;
    enfriamientos.forEach(e => {
      if (Number(e.espera) > 0) e.espera = Number(e.espera) - 1;
      else if (Number(e.turnos) > 0) e.turnos = Number(e.turnos) - 1;
      if (Number(e.espera) <= 0 && Number(e.turnos) <= 0) terminados++;
    });
    actor.system.enfriamientos = enfriamientos.filter(e => Number(e.espera) > 0 || Number(e.turnos) > 0);
    await dbPut(store, actor);
    if (!silencioso && terminados) notificar(`✅ Enfriamiento terminado para ${actor.nombre}.`);
  }

  // 4. Condiciones activas de artes y armas
  const condiciones = Array.isArray(actor.system?.condiciones) ? actor.system.condiciones : [];
  if (condiciones.length) {
    algo = true;
    condiciones.forEach(c => c.turnos = (Number(c.turnos) || 0) - 1);
    actor.system.condiciones = condiciones.filter(c => (Number(c.turnos) || 0) > 0);
    await dbPut(store, actor);
  }

  if (!silencioso) {
    if (algo) notificar(`🔄 Turno pasado para ${actor.nombre}.`);
    else notificar(`No había nada pendiente para ${actor.nombre}.`);
  }
  return algo;
}

// [UNDAVAR-PARTE-4.2e5-ARTES] Restauración completa: salud, marcas, condiciones, bonos y PA
async function restaurarCompleto(actor, store) {
  const e = asegurarVitales(actor);
  const deriv = calcularDerivados(actor.system, actor.items);
  e.ptHerida.value = 0;
  e.ptSalud.value = deriv.saludMaxima;
  if (!actor.system.extensionEstado) actor.system.extensionEstado = {};
  ["hambre", "sed", "cansancio", "fatiga"].forEach(k => {
    if (!actor.system.extensionEstado[k]) actor.system.extensionEstado[k] = { value: 0 };
    actor.system.extensionEstado[k].value = 0;
  });
  actor.system.condiciones = [];
  actor.system.efectosPendientes = [];
  actor.system.bonosActivos = [];
  actor.system.enfriamientos = [];
  if (actor.system.pa) actor.system.pa.value = deriv.paMaximo;
  sincronizarEstadoVital(actor);
  await dbPut(store, actor);
  notificar(`✨ ${actor.nombre} restaurado por completo (Salud, marcas, condiciones, bonos y PA).`);
}

// [UNDAVAR-PARTE-4.2d-EFECTOS] Cablea el botón de turno de la ficha
function wireEfectosPendientes(actor, store) {
  qs("#btn-pasar-turno")?.addEventListener("click", async () => {
    await pasarTurnoActor(actor, store);
    render();
  });
  // [UNDAVAR-PARTE-4.2e5-ARTES] Restauración completa desde Estado
  qs("#btn-restaurar-completo")?.addEventListener("click", async () => {
    const ok = await confirmarAccion(
      "Restauración completa",
      `¿Restaurar por completo a ${actor.nombre}? Se quitarán condiciones, bonos y enfriamientos.`,
      "Restaurar"
    );
    if (!ok) return;
    await restaurarCompleto(actor, store);
    render();
  });
}

// [UNDAVAR-PARTE-4.2d-EFECTOS] El aviso de inconsciente usa un elixir real del inventario
async function administrarElixir(actor, store) {
  await abrirModalAdministrarElixir(actor, store);
}

// [UNDAVAR-PARTE-4.2c-VITAL] Reactivación manual del SR tras una muerte
async function reactivarActor(actor, store) {
  const ok = await confirmarAccion("Reactivar personaje", `¿Reactivar a ${actor.nombre}? Se borrará la muerte y quedará consciente con al menos 1 de salud.`, "Reactivar");
  if (!ok) return;
  const e = estadoVital(actor);
  e.muerto = false;
  e.inconsciente = false;
  e.intentosDespertar = 0;
  actor.system.estado.ptSalud.value = Math.max(1, Number(actor.system.estado.ptSalud.value) || 0);
  await dbPut(store, actor);
  notificar(`✨ ${actor.nombre} reactivado por el SR.`);
  render();
}

// [UNDAVAR-PARTE-3.1] Cabecera contextual: título y subtítulo por vista
const VISTA_META = {
  inicio: ["Inicio", "Cuaderno de campaña"],
  // [UNDAVAR-PARTE-9.1-METAS] Título de la vista de objetivos
  metas: ["Metas", "Objetivos personales y generales de la campaña"],
  ficha: ["Ficha de personaje", "Datos, artes, inventario y progresión"],
  npc: ["PNJ y bestias", "Fichas secundarias y criaturas"],
  tienda: ["Tienda", "Compras, catálogo y caja"],
  oraculo: ["Oráculo", "Tablas del Sabio Regidor"],
  dividida: ["Vista dividida", "Dos fichas en paralelo"],
  enfrentamiento: ["Tiradas enfrentadas", "Todos contra todos y contra el SR"],
  combate: ["Combate", "Ataque, defensa y daño"],
  dados: ["Dados", "Tiradas libres y del sistema"],
  // [UNDAVAR-PARTE-8-MAPA] Vista del mapa interactivo
  mapa: ["Mapa", "Lugares, pines y vínculos de campaña"],
  // [UNDAVAR-PARTE-10.11-GALERIA] Vista de la galería de imágenes
  galeria: ["Galería", "Imágenes y fotos de la campaña"],
};

function actualizarCabecera() {
  const [titulo, sub] = VISTA_META[state.vista] || VISTA_META.inicio;
  const h = document.getElementById("topbar-vista");
  const kicker = document.querySelector(".topbar-kicker");
  if (h) h.textContent = titulo;
  if (kicker) kicker.textContent = sub;
  document.title = `${titulo} — UNDAVAR`;
}

async function render() {
  // [UNDAVAR-PARTE-9.3B-MEMORIA] Refleja también los cambios de pestaña
  guardarEstadoNavegacion();
  // [UNDAVAR-PARTE-9.3C-ENFRENTAMIENTO] Refleja los cambios de la tirada enfrentada
  guardarEstadoEnfrentamiento();
  actualizarCabecera();

  // [UNDAVAR-PARTE-3.8] La mesa ocupa el alto de la ventana solo en esta vista
  document.body.classList.toggle("vista-dividida-activa", state.vista === "dividida");
  // [UNDAVAR-PARTE-8-MAPA] El mapa también ocupa el alto disponible
  document.body.classList.toggle("vista-mapa-activa", state.vista === "mapa");

  qsa(".navlink").forEach(a => {
    const activo = a.dataset.vista === state.vista;
    a.classList.toggle("activo", activo);
    if (a.dataset.etiqueta) a.setAttribute("aria-label", a.dataset.etiqueta);
    if (activo) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  switch (state.vista) {
    case "inicio": await renderInicio(); break;
    // [UNDAVAR-PARTE-9.1-METAS] Ruta de la vista de metas
    case "metas": await renderMetas(); break;
    case "ficha": await renderFichaPersonaje(); break;
    case "npc": await renderFichaNPC(); break;
    case "tienda": await renderTienda(); break;
    case "oraculo": await renderOraculo(); break;
    case "dados": await renderDados(); break;
    case "enfrentamiento": await renderEnfrentamiento(); break;
    case "combate": await renderCombate(); break;
    case "dividida": await renderVistaDividida(); break;
    // [UNDAVAR-PARTE-8-MAPA] Ruta del mapa
    case "mapa": await renderMapa(); break;
    // [UNDAVAR-PARTE-10.11-GALERIA] Ruta de la galería de imágenes
    case "galeria": await renderGaleria(); break;
    default: await renderInicio();
  }
  // [UNDAVAR-PARTE-3.2] Pinta los iconos de las plantillas recién insertadas
  if (typeof pintarIconos === "function") pintarIconos(app);
}

// [UNDAVAR-PARTE-3.4D] Conserva el foco de los campos numéricos al repintar la vista
const renderBase = render;
function selectorCampoNumerico(el) {
  if (!el || !el.matches || !el.matches('input[type="number"]')) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  const partes = [];
  let n = el;
  while (n && n.nodeType === 1 && n !== app) {
    let sel = n.tagName.toLowerCase();
    if (n.dataset) {
      Object.entries(n.dataset).forEach(([k, v]) => {
        const attr = k.replace(/[A-Z]/g, m => "-" + m.toLowerCase());
        sel += `[data-${attr}="${CSS.escape(String(v))}"]`;
      });
    }
    const parent = n.parentElement;
    if (parent) {
      const iguales = [...parent.children].filter(c => c.tagName === n.tagName);
      if (iguales.length > 1) sel += `:nth-of-type(${iguales.indexOf(n) + 1})`;
    }
    partes.unshift(sel);
    n = n.parentElement;
  }
  return partes.join(" > ");
}
render = async function renderConFoco() {
  const selector = selectorCampoNumerico(document.activeElement);
  await renderBase();
  if (!selector) return;
  const nuevo = document.querySelector(selector);
  if (nuevo && typeof nuevo.focus === "function") nuevo.focus({ preventScroll: true });
};

function ir(vista, extra = {}) {
  // [UNDAVAR-PARTE-10.5C-MODO] Abrir una ficha siempre empieza en modo vista
  if (vista === "ficha" || vista === "npc") {
    state.modoDatos = "vista";
    state.modoDatosClave = "";
  }
  state.vista = vista;
  Object.assign(state, extra);
  // [UNDAVAR-PARTE-9.3B-MEMORIA] Guarda la vista y el registro abierto
  guardarEstadoNavegacion();
  render();
}

// [UNDAVAR-PARTE-9.3B-MEMORIA] Estado mínimo para reabrir donde estaba
function guardarEstadoNavegacion() {
  if (window.self !== window.top) return;
  try {
    localStorage.setItem("undavar_ultimo_estado", JSON.stringify({
      vista: state.vista,
      personajeId: state.personajeId,
      npcId: state.npcId,
      tiendaId: state.tiendaId,
      oraculoId: state.oraculoId,
      subtabFicha: state.subtabFicha,
      subtabNPC: state.subtabNPC
    }));
    // [UNDAVAR-PARTE-9.1B-ULTIMA-VISTA] Se conserva la clave antigua
    localStorage.setItem("undavar_vista_actual", state.vista);
  } catch (e) { }
}

// [UNDAVAR-PARTE-9.3C-ENFRENTAMIENTO] Memoria de la tirada enfrentada rápida
const ENFRENTAMIENTO_CLAVE = "undavar_enfrentamiento_estado";

function leerEstadoEnfrentamiento() {
  try {
    const crudo = localStorage.getItem(ENFRENTAMIENTO_CLAVE);
    return crudo ? JSON.parse(crudo) : null;
  } catch (e) {
    return null;
  }
}

function guardarEstadoEnfrentamiento() {
  if (window.self !== window.top) return;
  try {
    const e = state.enfrentamiento || {};
    localStorage.setItem(ENFRENTAMIENTO_CLAVE, JSON.stringify({
      modo: e.modo || "todos_vs_todos",
      participantes: (e.participantes || []).map(p => ({ id: p.id, tipoStore: p.tipoStore })),
      valSR: e.valSR || 3,
      esCustomSR: !!e.esCustomSR
    }));
  } catch (e) { }
}

// ------------------------------------------------------------
// VISTA: INICIO
// ------------------------------------------------------------
async function renderInicio() {
  const [personajesRaw, npcsRaw, tiendasRaw, oraculosRaw] = await Promise.all([
    dbGetAll("personajes"), dbGetAll("npcs"), dbGetAll("tiendas"), dbGetAll("oraculos")
  ]);

  // Lo recién abierto o modificado va al principio
  const porReciente = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);
  // [UNDAVAR-PARTE-4.2h2-PAREJA] Las copias no se listan como personajes
  const personajes = soloPersonajesReales(personajesRaw).sort(porReciente);
  const npcs = soloPersonajesReales(npcsRaw).sort(porReciente);
  const tiendas = tiendasRaw.sort(porReciente);
  const oraculos = oraculosRaw.sort(porReciente);

  // [UNDAVAR-PARTE-3.4B] Última consulta del oráculo y última tirada libre
  let ultimaConsulta = null;
  oraculos.forEach(o => (o.historial || []).forEach(h => {
    if (!ultimaConsulta || (h.ts || 0) > (ultimaConsulta.ts || 0)) {
      ultimaConsulta = { ...h, oraculo: o };
    }
  }));
  let ultimaTirada = "";
  try {
    const guardado = JSON.parse(localStorage.getItem("undavar_historial_dados") || "[]");
    ultimaTirada = guardado[0] || "";
  } catch (e) { ultimaTirada = ""; }
  if (!ultimaTirada && state.historialDadosLibres?.length) ultimaTirada = state.historialDadosLibres[0];

  // [UNDAVAR-PARTE-7-AVATAR] Las filas usan el avatar común
  const accionesFila = (id, store, nombre) => `
    <div class="ed-fila-acciones">
      <button class="btn-secundario chico btn-icono btn-exportar-perfil" data-id="${id}" data-store="${store}" title="Exportar" aria-label="Exportar ${esc(nombre)}"><span data-icono="exportar"></span></button>
      <button class="btn-peligro chico btn-icono btn-borrar-perfil" data-id="${id}" data-store="${store}" title="Eliminar" aria-label="Eliminar ${esc(nombre)}"><span data-icono="borrar"></span></button>
    </div>`;

  // [UNDAVAR-PARTE-3.4B] Filas y líneas del Inicio editorial
  const filaPersonaje = (p, vista, store, sub) => `
    <div class="ed-fila" data-id="${p.id}" data-vista="${vista}" data-store="${store}" data-nombre="${esc(p.nombre || "")}" tabindex="0" role="link" aria-label="Abrir ${esc(p.nombre || "ficha")}">
      ${avatarHTML(p)}
      <div class="ed-fila-texto">
        <div class="ed-fila-nombre">${esc(p.nombre || "Sin nombre")}</div>
        <div class="ed-fila-sub">${esc(sub)}</div>
      </div>
      <div class="ed-fila-dato"><b>${p.system?.pv?.value ?? 0}</b><small>PV</small></div>
      ${accionesFila(p.id, store, p.nombre || "perfil")}
      <span class="ed-fila-flecha" data-icono="flecha"></span>
    </div>`;

  const filaTienda = (t) => `
    <div class="ed-tienda" data-id="${t.id}" data-vista="tienda" data-store="tiendas" data-nombre="${esc(t.nombre || "")}" tabindex="0" role="link" aria-label="Abrir ${esc(t.nombre || "tienda")}">
      <span class="ed-tienda-ico" data-icono="tienda"></span>
      <div class="ed-tienda-texto">
        <strong>${esc(t.nombre || "Sin nombre")}</strong>
        <span>${t.items?.length || 0} ítems</span>
      </div>
      ${accionesFila(t.id, "tiendas", t.nombre || "tienda")}
      <span class="ed-fila-flecha" data-icono="flecha"></span>
    </div>`;

  const filaOraculo = (o) => `
    <div class="ed-tienda" data-id="${o.id}" data-vista="oraculo" data-store="oraculos" data-nombre="${esc(o.nombre || "")}" tabindex="0" role="link" aria-label="Abrir ${esc(o.nombre || "oráculo")}">
      <span class="ed-tienda-ico" data-icono="oraculo"></span>
      <div class="ed-tienda-texto">
        <strong>${esc(o.nombre || "Sin nombre")}</strong>
        <span>${o.tabla?.length || 0} entradas</span>
      </div>
      ${accionesFila(o.id, "oraculos", o.nombre || "oráculo")}
      <span class="ed-fila-flecha" data-icono="flecha"></span>
    </div>`;

  const vacio = (icono, titulo, texto, idBoton, textoBoton, clase = "btn-secundario chico") => `
    <div class="ed-vacio">
      <span class="ed-vacio-icono" data-icono="${icono}"></span>
      <div class="ed-vacio-texto-bloque">
        <div class="ed-vacio-titulo">${titulo}</div>
        <p class="ed-vacio-texto">${texto}</p>
      </div>
      <button class="${clase}" id="${idBoton}"><span data-icono="mas"></span> ${textoBoton}</button>
    </div>`;

  const seccion = (titulo, sub, cuerpo, accion = "") => `
    <section class="ed-seccion">
      <div class="ed-seccion-head">
        <h2>${titulo}</h2>
        ${accion}
      </div>
      <p class="ed-seccion-sub">${sub}</p>
      <div class="ed-seccion-cuerpo">${cuerpo}</div>
    </section>`;

  const verTodos = (vista) => `<button class="ed-link ed-ver-todos" data-vista="${vista}">Ver todos</button>`;
  // [UNDAVAR-PARTE-4.3e] Botón de creación siempre visible en cada sección
  const botonCrear = (tipo, texto) => `<button class="btn-secundario chico btn-crear-seccion" data-crear="${tipo}"><span data-icono="mas"></span> ${texto}</button>`;

  app.innerHTML = `
  <section class="vista-inicio ed-inicio">
    <header class="ed-hero">
      <div class="ed-hero-texto">
        <div class="ed-eyebrow">República Aristócrata de Undavar</div>
        <h1>El libro de <em>campaña</em></h1>
        <p>Un cuaderno vivo para el Sabio Regidor: personajes, comercios, oráculo y dados. Sin ruido, sin conexión y siempre a mano.</p>
      </div>
      <div class="ed-hero-acciones">
        <label class="ed-buscador">
          <span data-icono="buscar"></span>
          <input type="search" id="buscador-inicio" placeholder="Buscar en la campaña" aria-label="Buscar en la campaña">
        </label>
        <button class="btn-primario" id="btn-nuevo-pj-hero"><span data-icono="mas"></span> Nuevo personaje</button>
      </div>
    </header>

    <div class="ed-metricas">
      <div><strong>${personajes.length}</strong><span>Undavaritas</span></div>
      <div><strong>${npcs.length}</strong><span>PNJ y bestias</span></div>
      <div><strong>${tiendas.length}</strong><span>Tiendas</span></div>
      <div><strong>${oraculos.length}</strong><span>Oráculos</span></div>
    </div>

    <div class="ed-inicio-grid">
      <div class="ed-col-principal">
        ${seccion("Undavaritas", "Personajes que sostienen la campaña.",
    personajes.length
      ? personajes.map(p => filaPersonaje(p, "ficha", "personajes", p.system?.datos?.clase || "Sin clase")).join("")
      : vacio("ficha", "Todavía no hay undavaritas", "Crea tu primer personaje para empezar la campaña.", "btn-nuevo-pj", "Crear personaje", "btn-primario chico"),
    personajes.length ? `${botonCrear("pj", "Nuevo personaje")}${verTodos("ficha")}` : "")}

        ${seccion("PNJ y bestias", "Fichas secundarias y criaturas.",
      npcs.length
        ? npcs.map(p => filaPersonaje(p, "npc", "npcs", nombreRazaManual(p.system?.datos?.raza) || "Sin raza")).join("")
        : vacio("npc", "Sin PNJ ni bestias", "Las fichas secundarias y criaturas aparecerán aquí.", "btn-nuevo-npc", "Crear PNJ"),
      npcs.length ? `${botonCrear("npc", "Nuevo PNJ")}${verTodos("npc")}` : "")}

        ${seccion("Tiendas", "Comercios disponibles para la party.",
        tiendas.length
          ? tiendas.map(filaTienda).join("")
          : vacio("tienda", "Ninguna tienda abierta", "Abre un comercio para comprar y llevar la caja.", "btn-nueva-tienda", "Crear tienda"),
        tiendas.length ? `${botonCrear("tienda", "Nueva tienda")}${verTodos("tienda")}` : "")}
      </div>

      <aside class="ed-col-lateral">
        ${seccion("La pregunta de hoy", ultimaConsulta ? `${esc(ultimaConsulta.oraculo?.nombre || "Oráculo")} · d${ultimaConsulta.oraculo?.dado || 6}` : "Oráculo de Incertidumbre",
          ultimaConsulta
            ? `<blockquote class="ed-oraculo-cita">
                 <div class="ed-oraculo-texto">“${esc(ultimaConsulta.resultado || "")}”</div>
                 <div class="ed-oraculo-pie">Consulta de ${esc(ultimaConsulta.oraculo?.nombre || "la campaña")}${ultimaConsulta.ts ? ` · ${new Date(ultimaConsulta.ts).toLocaleDateString()}` : ""}</div>
               </blockquote>
               <button class="btn-secundario chico ed-ver-todos" data-vista="oraculo" data-id="${ultimaConsulta.oraculo?.id || ""}"><span data-icono="oraculo"></span> Consultar oráculo</button>`
            : vacio("oraculo", "Sin consultas todavía", "El oráculo responderá cuando lo consultes.", "btn-ir-oraculo", "Ir al oráculo"))}

        ${seccion("Oráculos", "Tablas del Sabio Regidor.",
          oraculos.length
            ? oraculos.map(filaOraculo).join("")
            : vacio("oraculo", "Sin oráculos", "Crea una tabla para consultar el destino.", "btn-nuevo-oraculo", "Crear oráculo"),
          oraculos.length ? `${botonCrear("oraculo", "Nuevo oráculo")}${verTodos("oraculo")}` : "")}

        ${seccion("Última tirada", "El resultado más reciente de la mesa.",
            ultimaTirada
              ? `<div class="ed-ultima-tirada">${ultimaTirada}</div>
                 <button class="btn-secundario chico ed-ver-todos" data-vista="dados"><span data-icono="dados"></span> Ir a dados</button>`
              : vacio("dados", "Sin tiradas todavía", "Lanza los dados y aquí quedará el último resultado.", "btn-ir-dados", "Ir a dados"))}

        <section class="ed-seccion ed-respaldo">
          <div class="ed-seccion-head"><h2>Copias de seguridad</h2></div>
          <p class="ed-seccion-sub">Exporta la campaña o impórtala en otro dispositivo.</p>
          <div class="ed-respaldo-botones">
            <button class="btn-secundario chico" id="btn-exportar-todo"><span data-icono="exportar"></span> Exportar backup</button>
            ${ES_TAURI
              ? `<button class="btn-secundario chico" id="btn-importar-escritorio"><span data-icono="importar"></span> Importar .undavar</button>`
              : `<label class="btn-secundario chico" for="input-importar"><span data-icono="importar"></span> Importar .undavar</label>
                 <input type="file" id="input-importar" accept=".undavar,application/json" hidden>`}
          </div>
        </section>
      </aside>
    </div>
  </section>`;

  // [UNDAVAR-PARTE-3.4B] Abrir fichas, tiendas y oráculos desde las filas
  const abrir = async (vista, id) => {
    const storeMap = { ficha: "personajes", npc: "npcs", tienda: "tiendas", oraculo: "oraculos" };
    const key = { ficha: "personajeId", npc: "npcId", tienda: "tiendaId", oraculo: "oraculoId" }[vista];
    const item = await dbGet(storeMap[vista], id);
    if (item) { item.updatedAt = Date.now(); await dbPut(storeMap[vista], item); }
    ir(vista, { [key]: id });
  };
  qsa(".ed-fila, .ed-tienda").forEach(el => {
    el.addEventListener("click", (ev) => {
      if (ev.target.closest("button")) return;
      abrir(el.dataset.vista, el.dataset.id);
    });
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(el.dataset.vista, el.dataset.id); }
    });
  });

  // [UNDAVAR-PARTE-3.4B] Buscador local por nombre
  const buscador = qs("#buscador-inicio");
  buscador?.addEventListener("input", () => {
    const q = buscador.value.trim().toLowerCase();
    qsa(".ed-inicio [data-nombre]").forEach(el => {
      el.classList.toggle("oculto", !!q && !(el.dataset.nombre || "").toLowerCase().includes(q));
    });
    qsa(".ed-inicio .ed-seccion").forEach(sec => {
      const items = sec.querySelectorAll("[data-nombre]");
      if (!items.length) return;
      sec.classList.toggle("oculto", ![...items].some(i => !i.classList.contains("oculto")));
    });
  });

  // [UNDAVAR-PARTE-4.1] La creación pasa por el asistente guiado
  const crearPersonaje = () => abrirAsistenteCreacion();
  // [UNDAVAR-PARTE-4.3e] Creadores reutilizados por los botones de sección
  const crearNPC = async () => {
    const obj = actorNPCPorDefecto();
    await dbPut("npcs", obj);
    ir("npc", { npcId: obj.id });
  };
  const crearTienda = async () => {
    const obj = tiendaPorDefecto();
    await dbPut("tiendas", obj);
    ir("tienda", { tiendaId: obj.id });
  };
  const crearOraculo = async () => {
    const obj = oraculoPorDefecto();
    await dbPut("oraculos", obj);
    ir("oraculo", { oraculoId: obj.id });
  };
  qs("#btn-nuevo-pj-hero")?.addEventListener("click", crearPersonaje);
  qs("#btn-nuevo-pj")?.addEventListener("click", crearPersonaje);
  qs("#btn-nuevo-npc")?.addEventListener("click", crearNPC);
  qs("#btn-nueva-tienda")?.addEventListener("click", crearTienda);
  qs("#btn-nuevo-oraculo")?.addEventListener("click", crearOraculo);
  qsa(".btn-crear-seccion").forEach(b => b.addEventListener("click", () => {
    const tipo = b.dataset.crear;
    if (tipo === "pj") crearPersonaje();
    else if (tipo === "npc") crearNPC();
    else if (tipo === "tienda") crearTienda();
    else if (tipo === "oraculo") crearOraculo();
  }));
  qs("#btn-ir-oraculo")?.addEventListener("click", () => ir("oraculo"));
  qs("#btn-ir-dados")?.addEventListener("click", () => ir("dados"));

  // Ver todos limpia el registro abierto para mostrar el selector
  qsa(".ed-ver-todos").forEach(b => b.addEventListener("click", () => {
    const vista = b.dataset.vista;
    const key = { ficha: "personajeId", npc: "npcId", tienda: "tiendaId", oraculo: "oraculoId" }[vista];
    if (b.dataset.id) { ir(vista, key ? { [key]: b.dataset.id } : {}); return; }
    ir(vista, key ? { [key]: null } : {});
  }));
  qsa(".btn-exportar-perfil").forEach(b => b.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    try {
      const ok = await exportarPerfil(b.dataset.store, b.dataset.id);
      if (ok) notificar("🗄️ Perfil exportado.");
    } catch (e) { notificar("Error al exportar: " + e.message); }
  }));
  qsa(".btn-borrar-perfil").forEach(b => b.addEventListener("click", async (ev) => {
    ev.stopPropagation();
    const ok = await confirmarAccion("Eliminar", "¿Eliminar de forma permanente?", "Eliminar");
    if (ok) { await dbDelete(b.dataset.store, b.dataset.id); render(); }
  }));
  qs("#btn-exportar-todo")?.addEventListener("click", async () => {
    try {
      const ok = await exportarBackupCompleto();
      if (ok) notificar("🗄️ Backup exportado.");
    } catch (e) { notificar("Error al exportar: " + e.message); }
  });
  // [UNDAVAR-PARTE-6B-DIALOGO] En escritorio, el botón abre el diálogo nativo
  qs("#btn-importar-escritorio")?.addEventListener("click", async () => {
    try {
      const r = await importarDesdeDialogo();
      if (!r) return;
      notificar(r.tipo === "backup" ? `Backup importado: ${r.total} elementos.` : `Perfil importado: ${r.nombre}`);
      render();
    } catch (e) { notificar("Error al importar: " + (e.message || e)); }
  });
  qs("#input-importar")?.addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const r = await importarArchivo(file);
      notificar(r.tipo === "backup" ? `Backup importado: ${r.total} elementos.` : `Perfil importado: ${r.nombre}`);
      render();
    } catch (e) { notificar("Error al importar: " + e.message); }
    ev.target.value = "";
  });
}

// ------------------------------------------------------------
// HELPER: TRANSFERENCIA DE ÍTEMS ENTRE FICHAS (CORREGIDO)
// ------------------------------------------------------------
async function abrirModalTransferirItem(actorOrigen, itemTarget) {
  // [UNDAVAR-PARTE-3.9] El origen y el destino pueden ser PJ o PNJ
  const storeOrigen = (actorOrigen.tipo === "npc" || actorOrigen.system?.datos?.raza) ? "npcs" : "personajes";
  const todosPJs = soloPersonajesReales(await dbGetAll("personajes"));
  const todosNPCs = soloPersonajesReales(await dbGetAll("npcs"));

  const destinatarios = [
    ...todosPJs.map(p => ({ id: p.id, nombre: p.nombre, tipoStore: "personajes", etiqueta: "PJ" })),
    ...todosNPCs.map(n => ({ id: n.id, nombre: n.nombre, tipoStore: "npcs", etiqueta: "PNJ" }))
  ].filter(d => !(d.tipoStore === storeOrigen && d.id === actorOrigen.id));

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
          <button id="btn-confirmar-transfer" class="btn-primario">Enviar ítem</button>
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
        copiaItem.id = nuevoId();
        copiaItem.system.cantidad = cantAEnviar;
        copiaItem.system.ubicacionId = ""; // Va a los bolsillos del destinatario
        actorDestino.items.push(copiaItem);
      }
    }

    await dbPut(storeOrigen, actorOrigen);
    await dbPut(storeDestino, actorDestino);

    document.querySelector(".modal-backdrop").remove();
    notificar(`🎁 ¡"${itemTarget.name}" enviado a ${actorDestino.nombre} con éxito!`);
    render();
  });
}

// ------------------------------------------------------------
// [UNDAVAR-PARTE-3.1] Selector de registro para las vistas que necesitan
// un elemento abierto (ficha, PNJ o tienda). Evita que el menú rebote a Inicio.
// ------------------------------------------------------------
async function renderSelectorRegistro({ store, vista, idKey, titulo, descripcion, subtitulo, vacio }) {
  // [UNDAVAR-PARTE-4.2h2-PAREJA] Las copias no aparecen en los selectores
  const lista = soloPersonajesReales(await dbGetAll(store));
  // [UNDAVAR-PARTE-3.4] Avatar del registro y estado vacío con acción
  const icono = { personajes: "ficha", npcs: "npc", tiendas: "tienda", oraculos: "oraculo" }[store] || "ficha";
  // [UNDAVAR-PARTE-4.3e] Crear un registro desde el propio selector
  const crear = {
    personajes: { texto: "Nuevo personaje", fn: () => abrirAsistenteCreacion() },
    npcs: {
      texto: "Nuevo PNJ", fn: async () => {
        const obj = actorNPCPorDefecto();
        await dbPut("npcs", obj);
        ir("npc", { npcId: obj.id });
      }
    },
    tiendas: {
      texto: "Nueva tienda", fn: async () => {
        const obj = tiendaPorDefecto();
        await dbPut("tiendas", obj);
        ir("tienda", { tiendaId: obj.id });
      }
    },
    oraculos: {
      texto: "Nuevo oráculo", fn: async () => {
        const obj = oraculoPorDefecto();
        await dbPut("oraculos", obj);
        ir("oraculo", { oraculoId: obj.id });
      }
    }
  }[store];
  app.innerHTML = `
  <section class="vista-inicio">
    <div class="hero-undavar">
      <h1>${esc(titulo)}</h1>
      <p>${esc(descripcion)}</p>
      ${crear ? `<button class="btn-primario" id="btn-picker-crear"><span data-icono="mas"></span> ${esc(crear.texto)}</button>` : ""}
    </div>
    <div class="tarjetas-lista">
      ${lista.length
      ? lista.map((o) => `
        <div class="tarjeta tarjeta-clicable" data-id="${o.id}" role="button" tabindex="0" aria-label="Abrir ${esc(o.nombre || "registro")}">
          ${avatarHTML(o, { clase: "tarjeta-avatar" })}
          <div class="tarjeta-cuerpo">
            <div class="tarjeta-nombre">${esc(o.nombre || "Sin nombre")}</div>
            <div class="tarjeta-sub">${esc(subtitulo(o))}</div>
          </div>
          <div class="tarjeta-acciones">
            <button class="btn-secundario chico btn-picker" data-id="${o.id}">Abrir →</button>
          </div>
        </div>`).join("")
      : `<div class="estado-vacio">
           <span class="estado-vacio-icono" data-icono="${icono}"></span>
           <div class="estado-vacio-titulo">Sin registros todavía</div>
           <p class="estado-vacio-texto">${esc(vacio)}</p>
           <button class="btn-primario chico" id="btn-picker-inicio"><span data-icono="inicio"></span> Ir a Inicio</button>
         </div>`}
    </div>
    ${lista.length ? `<div class="respaldo-botones" style="margin-top:18px;">
      <button class="btn-secundario" id="btn-picker-inicio"><span data-icono="inicio"></span> Ir a Inicio</button>
    </div>` : ""}
  </section>`;

  qsa(".btn-picker").forEach((b) => b.addEventListener("click", () => ir(vista, { [idKey]: b.dataset.id })));
  // [UNDAVAR-PARTE-9.3B-TARJETAS] Toda la tarjeta abre el registro
  const abrirTarjeta = (id) => ir(vista, { [idKey]: id });
  qsa(".tarjeta-clicable").forEach((t) => {
    t.addEventListener("click", (e) => {
      if (e.target.closest(".btn-picker")) return;
      abrirTarjeta(t.dataset.id);
    });
    t.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        abrirTarjeta(t.dataset.id);
      }
    });
  });
  qs("#btn-picker-crear")?.addEventListener("click", crear?.fn || (() => {}));
  qs("#btn-picker-inicio")?.addEventListener("click", () => ir("inicio"));
}

// ------------------------------------------------------------
// VISTA: FICHA DE PERSONAJE
// ------------------------------------------------------------
async function renderFichaPersonaje() {
  // [UNDAVAR-PARTE-3.1] Sin personaje seleccionado se muestra el selector.
  if (!state.personajeId) {
    await renderSelectorRegistro({
      store: "personajes", vista: "ficha", idKey: "personajeId",
      titulo: "Undavaritas",
      descripcion: "Elige un personaje para abrir su ficha.",
      subtitulo: (o) => o.system?.datos?.clase || "Sin clase",
      vacio: "Aún no tienes personajes. Crea el primero desde Inicio.",
    });
    return;
  }
  const actor = await dbGet("personajes", state.personajeId);
  // [UNDAVAR-PARTE-9.3B-MEMORIA] Si la ficha guardada ya no existe, muestra la lista
  if (!actor) { state.personajeId = null; return renderFichaPersonaje(); }
  const sys = actor.system;
  // [UNDAVAR-PARTE-4.2c-VITAL] Sincroniza inconsciencia con la salud al abrir la ficha
  sincronizarEstadoVital(actor);
  // [UNDAVAR-PARTE-4.2h2-PAREJA] El viento se mantiene mientras se posean las dos armas
  if (await guardarBonosPasivos(actor, "personajes")) { /* ya guardado */ }
  const calc = calcularDerivados(sys, actor.items);
  const oficiosUsados = actor.items.filter(i => i.type === "oficio").map(i => i.system.oficioId);
  const catalogo = OFICIOS_UNDAVAR.filter(o => !oficiosUsados.includes(o.id));
  // [UNDAVAR-PARTE-9.3-SIERVOS] Carga los PNJ solo al abrir la pestaña de siervos
  const siervosVinculados = state.subtabFicha === "siervos" ? await dbGetAll("npcs") : [];
  // [UNDAVAR-PARTE-10.5C-MODO] La pestaña Datos abre en vista y conserva el modo
  const modoDatos = modoDatosFicha("personajes", actor.id);
  const datosSoloLectura = modoDatos === "vista" && state.subtabFicha === "datos";

  app.innerHTML = `
  <section class="vista-ficha ed-ficha" data-ficha-store="personajes" data-ficha-id="${actor.id}">
    ${cabeceraFicha(actor, calc, datosSoloLectura)}
    ${bannerEstadoVital(actor)}
    <div class="ed-ficha-grid">
      <div class="ed-ficha-principal">
        ${barraEstadoAtributos(actor, calc)}

        <nav class="subtabs" role="tablist" aria-label="Secciones de la ficha">
          ${["datos", "artes", "oficios", "siervos", "inventario", "estado", "referencia", "equipo"].map(t =>
    `<button class="subtab ${state.subtabFicha === t ? 'activo' : ''}" data-subtab="${t}" role="tab" aria-selected="${state.subtabFicha === t}">${etiquetaSubtab(t)}</button>`).join("")}
        </nav>

        <div class="subtab-contenido" role="tabpanel">
          ${state.subtabFicha === "datos" ? tabDatos(actor, modoDatos) : ""}
          ${state.subtabFicha === "artes" ? tabArtesArmas(actor, calc) : ""}
          ${state.subtabFicha === "oficios" ? tabOficios(actor, catalogo) : ""}
          ${state.subtabFicha === "siervos" ? tabSiervosPJ(actor, siervosVinculados) : ""}
          ${state.subtabFicha === "inventario" ? tabInventario(actor) : ""}
          ${state.subtabFicha === "estado" ? tabEstado(actor, true, "personajes") : ""}
          ${state.subtabFicha === "referencia" ? tabReferencia(calc) : ""}
          ${state.subtabFicha === "equipo" ? tabEquipo(actor) : ""}
        </div>

        <div class="log-tiradas">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h3 style="margin:0;">Registro de tiradas</h3>
            <button class="btn-secundario chico" id="btn-limpiar-log">🧹 Limpiar</button>
          </div>
          <div id="tirada-log" aria-live="polite">
            ${(sys?.historialTiradas || []).map(h => `<div class="tirada-item">${h}</div>`).join("") || `<p class="vacio">Sin tiradas en esta sesión.</p>`}
          </div>
        </div>
      </div>

      ${lateralFicha(actor, calc, "personajes")}
    </div>
  </section>`;

  wireFicha(actor, calc);
  // [UNDAVAR-PARTE-4.2c-VITAL] Botones de despertar, elixir y reactivación
  wireEstadoVital(actor, "personajes");
  // [UNDAVAR-PARTE-4.2c-VITAL] Gasto de PE en la pestaña Estado
  wirePE(actor);
  // [UNDAVAR-PARTE-4.2d-EFECTOS] Efectos pendientes en la pestaña Estado
  wireEfectosPendientes(actor, "personajes");
}

function etiquetaSubtab(t) {
  // [UNDAVAR-PARTE-3.4] Etiquetas sin emojis para una barra más limpia
  return { datos: "Datos", artes: "Artes y armas", oficios: "Oficios", siervos: "Siervos", inventario: "Inventario", estado: "Estado", referencia: "Referencia", equipo: "Equipo" }[t];
}

// [UNDAVAR-PARTE-3.4B] Cabecera editorial de la ficha
function cabeceraFicha(actor, calc, soloLectura = false) {
  const d = actor.system.datos || {};
  const clase = (d.clase || "").charAt(0).toUpperCase() + (d.clase || "").slice(1);
  const meta = [d.procedencia, d.edad ? `${d.edad} años` : "", d.gremio].filter(Boolean).join(" · ");
  return `
  <header class="ed-ficha-cabecera">
    <div class="ed-ficha-identidad">
      <div class="ed-volver-fila">
        <button class="ed-volver" id="btn-volver-lista">← Lista</button>
        <button class="ed-volver" id="btn-volver">← Inicio</button>
      </div>
      <div class="ed-eyebrow">Undavarita${clase ? ` · ${esc(clase)}` : ""}</div>
      ${soloLectura
        ? `<h1 class="ed-titulo-texto">${esc(actor.nombre)}</h1>`
        : `<input type="text" id="campo-nombre" class="ed-titulo-input" value="${esc(actor.nombre)}" placeholder="Nombre del personaje" aria-label="Nombre del personaje">`}
      ${meta ? `<p class="ed-ficha-meta">${esc(meta)}</p>` : ""}
      <div class="ed-badges">
        <span class="ed-badge oro">${esc(calc.rango)}</span>
        ${clase ? `<span class="ed-badge">${esc(clase)}</span>` : ""}
        ${d.sabioRegidor ? `<span class="ed-badge">Sabio: ${esc(d.sabioRegidor)}</span>` : ""}
      </div>
    </div>
    <div class="ed-ficha-acciones">
      <button class="btn-secundario chico btn-icono" id="btn-exportar-actor" title="Exportar .undavar" aria-label="Exportar personaje"><span data-icono="exportar"></span></button>
      <button class="btn-secundario chico" id="btn-revisar-ficha" title="Detectar y corregir datos de fichas antiguas">Revisar ficha</button>
      <button class="btn-secundario chico" id="btn-toggle-mod-estandar" title="Configurar modificadores"><span data-icono="ajustes"></span> Mod.</button>
      <button class="btn-primario chico" id="roll-estandar"><span data-icono="dados"></span> Tirada</button>
      <button class="btn-secundario chico" id="roll-ataque"><span data-icono="espadas"></span> Ataque</button>
      <button class="btn-secundario chico" id="roll-rebote"><span data-icono="rayo"></span> Rebote</button>
      <button class="btn-secundario chico" id="roll-despertar"><span data-icono="despertar"></span> Despertar</button>
      <button class="btn-secundario chico" id="btn-recargar-pa" title="Restaurar PA al máximo">Recargar PA (${calc.paMaximo})</button>
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
            <option value="fuerza">Fuerza (${Math.floor(atributoEfectivo(actor, "fuerza") / 2)})</option>
            <option value="velocidad">Velocidad (${Math.floor(atributoEfectivo(actor, "velocidad") / 2)})</option>
            <option value="agilidad">Agilidad (${Math.floor(atributoEfectivo(actor, "agilidad") / 2)})</option>
            <option value="inteligencia">Inteligencia (${Math.floor(atributoEfectivo(actor, "inteligencia") / 2)})</option>
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

// [UNDAVAR-PARTE-3.4B] Columna lateral de la ficha: retrato, vitales, monedas y aviso real
function lateralFicha(actor, calc, store = "personajes") {
  const s = actor.system;
  const d = s.datos || {};
  const e = s.erianas || { oro: 0, rubi: 0, diamante: 0 };
  const pv = Number(s.pv?.value) || 0;
  const pvMax = Number(calc.pvMaximo) || PV_MAXIMO;
  const pa = Number(s.pa?.value) || 0;
  const paMax = Number(calc.paMaximo) || 0;
  const pct = (v, max) => max > 0 ? Math.min(100, Math.round(v / max * 100)) : 0;
  const heridas = Number(s.estado?.ptHerida?.value) || 0;

  return `
  <aside class="ed-ficha-lateral">
    <div class="ed-retrato">
      <div class="ed-retrato-anillo">
        ${avatarHTML(actor, { clase: "ed-avatar ed-avatar-grande" })}
        ${esClon(actor) ? "" : `<button class="avatar-editar" type="button" data-store="${store}" data-id="${actor.id}" title="Cambiar retrato" aria-label="Cambiar retrato"><span data-icono="camara"></span></button>`}
      </div>
      <h2>${esc(actor.nombre || "Sin nombre")}</h2>
      <p>${esc(d.clase ? d.clase.charAt(0).toUpperCase() + d.clase.slice(1) : "Undavarita")}${d.gremio ? ` · ${esc(d.gremio)}` : ""}</p>
    </div>

    <div class="ed-vitales">
      <div class="ed-vital">
        <div class="ed-vital-top">
          <span>PV</span>
          <small>/ ${pvMax}</small>
        </div>
        <input type="number" id="campo-pv" class="ed-vital-numero" value="${pv}" min="0" max="${pvMax}" aria-label="Puntos de vida">
        <div class="ed-medidor"><i style="width:${pct(pv, pvMax)}%"></i></div>
      </div>
      <div class="ed-vital">
        <div class="ed-vital-top">
          <span>PA</span>
          <strong id="lat-pa-valor">${pa}</strong>
          <small id="lat-pa-max">/ ${paMax}</small>
        </div>
        <div class="ed-medidor oro"><i id="lat-pa-barra" style="width:${pct(pa, paMax)}%"></i></div>
      </div>
    </div>

    ${panelProgresoRangoHTML(pv, calc)}

    <div class="ed-monedas">
      <div class="ed-moneda"><i></i><span>Oro</span><strong data-eriana="oro">${Number(e.oro) || 0}</strong></div>
      <div class="ed-moneda rubi"><i></i><span>Rubí</span><strong data-eriana="rubi">${Number(e.rubi) || 0}</strong></div>
      <div class="ed-moneda diamante"><i></i><span>Diamante</span><strong data-eriana="diamante">${Number(e.diamante) || 0}</strong></div>
    </div>

    ${heridas > 0 ? `<div class="ed-nota">Herida ${heridas}/8: el límite de salud baja a ${calc.saludLimiteActual}. Aplica la penalización en las tiradas de resistencia.</div>` : ""}
  </aside>`;
}

function barraEstadoAtributos(actor, calc) {
  const s = actor.system;
  
  // [UNDAVAR-PARTE-4.2g] No se crea "sinAsignar" al pintar: su ausencia delata una ficha antigua

  return `
  <section class="estado-atributos-bar">
    <div class="bloque-estado">
      <div class="bloque-titulo">Estado</div>
      <p class="bloque-hint">Heridas, salud y puntos de acción.</p>
      <div class="estado-fila">
        <label>Pt. Herida</label>
        <input type="number" id="campo-herida" value="${s.estado.ptHerida.value}" min="0" max="8">
        <span class="estado-max">/8</span>
        ${calc.bonusHeridas ? `<span class="aviso-herida">(incluye ${calc.bonusHeridas} por estados)</span>` : ""}
      </div>
      <div class="estado-fila">
        <label>Pt. Salud</label>
        <input type="number" id="campo-salud" value="${s.estado.ptSalud.value}" min="0" max="${calc.saludLimiteActual}">
        <span class="estado-max">/${calc.saludLimiteActual}</span>
        ${calc.saludPorHeridas ? `<span class="aviso-herida">(base ${calc.saludMaxima} − ${calc.saludPorHeridas})</span>` : ""}
      </div>
      <div class="estado-fila">
        <label>PA</label>
        <input type="number" id="campo-pa" value="${s.pa.value}" min="0" max="${calc.paMaximo}">
        <span class="estado-max" id="campo-pa-max">/${calc.paMaximo}</span>
      </div>
    </div>

    <div class="bloque-atributos">
      <div class="bloque-titulo">Atributos</div>
      <p class="bloque-hint">Valores actuales y mejoras disponibles.</p>
      <div class="atributos-grid">
        ${["fuerza", "velocidad", "agilidad", "inteligencia"].map(atr => `
          <div class="atributo-item">
            <label>${atr[0].toUpperCase() + atr.slice(1)}</label>
            <div class="atributo-control">
              <input type="number" value="${s.atributos[atr]}" readonly>
              ${bonoAtributoActivo(actor, atr) ? `<span class="atributo-bono" title="Bono activo">+${bonoAtributoActivo(actor, atr)}</span>` : ""}
              <button class="btn-up-atr" data-atr="${atr}" data-pago="${["fuerza", "velocidad"].includes(atr) ? "pp" : "pd"}" title="Subir (4 ${["fuerza", "velocidad"].includes(atr) ? "PP" : "PD"} = +1, máx. 9)">+</button>
            </div>
          </div>`).join("")}
      </div>
    </div>

    <div class="bloque-pdc">
      <div class="bloque-titulo">Puntos de Conveniencia</div>
      <p class="bloque-hint">Puntos disponibles para mejoras y suerte.</p>
      
      <!-- Campo de PdC Sin Asignar (Acumulador) -->
      <div class="pdc-sin-asignar-row">
        <label>Sin asignar (bolsa)</label>
        <input type="number" class="campo-pdc" data-key="sinAsignar" value="${s.pdc.sinAsignar || 0}" min="0">
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

// [UNDAVAR-PARTE-4.3c] Guarda un movimiento de Erianas en la ficha del personaje
function registrarMovimientoErianas(actor, concepto, cambio) {
  if (!actor || !actor.system) return;
  if (!Array.isArray(actor.system.historialErianas)) actor.system.historialErianas = [];
  const limpio = {};
  for (const m of ["oro", "rubi", "diamante"]) {
    const v = Number(cambio?.[m]) || 0;
    if (v) limpio[m] = v;
  }
  if (!Object.keys(limpio).length) return;
  actor.system.historialErianas.unshift({
    fecha: new Date().toISOString(),
    concepto: String(concepto || "Movimiento"),
    cambio: limpio
  });
  // Solo conserva los últimos 100 movimientos
  if (actor.system.historialErianas.length > 100) actor.system.historialErianas.length = 100;
}

// [UNDAVAR-PARTE-10.6-ERIANAS-CAMBIO] Total de oro de una cartera
function totalErianasOro(bolsa) {
  return (Number(bolsa?.oro) || 0) +
    (Number(bolsa?.rubi) || 0) * 100 +
    (Number(bolsa?.diamante) || 0) * 10000;
}

// [UNDAVAR-PARTE-10.6-ERIANAS-CAMBIO] Reparte un total en la menor cantidad de monedas
function repartirErianas(total) {
  let resto = Math.max(0, Math.floor(Number(total) || 0));
  const diamante = Math.floor(resto / 10000); resto -= diamante * 10000;
  const rubi = Math.floor(resto / 100); resto -= rubi * 100;
  return { oro: resto, rubi, diamante };
}

// [UNDAVAR-PARTE-10.6-ERIANAS-CAMBIO] Descuenta un valor en oro y devuelve el cambio
function descontarErianas(bolsa, valor) {
  const reparto = repartirErianas(totalErianasOro(bolsa) - valor);
  bolsa.oro = reparto.oro;
  bolsa.rubi = reparto.rubi;
  bolsa.diamante = reparto.diamante;
}

// [UNDAVAR-PARTE-4.3c] Lista desplegable con el historial de Erianas del personaje
function historialErianasHTML(actor) {
  const hist = Array.isArray(actor.system?.historialErianas) ? actor.system.historialErianas : [];
  if (!hist.length) return `<p class="nota">Sin movimientos todavía.</p>`;
  const fmt = (iso) => {
    const f = new Date(iso);
    return isNaN(f.getTime()) ? "—" : f.toLocaleString("es-ES", {
      day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"
    });
  };
  const cambio = (c) => ["diamante", "rubi", "oro"]
    .filter(m => c?.[m])
    .map(m => `${c[m] > 0 ? "+" : "−"}${Math.abs(c[m])} ${etiquetaMoneda(m)}`)
    .join(", ");
  return `<div class="historial-erianas">${hist.map(h => `
    <div class="historial-fila">
      <span class="historial-fecha">${fmt(h.fecha)}</span>
      <span class="historial-concepto">${esc(h.concepto)}</span>
      <span class="historial-cambio">${cambio(h.cambio)}</span>
    </div>`).join("")}</div>`;
}

// [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Edición de la cartera, compartida por PJ y PNJ
function wireCarteraFicha(actor, guardarCampo) {
  qsa(".campo-eriana").forEach(inp => {
    const aplicar = async () => {
      const valorPrevio = Number(inp.dataset.valor) || 0;

      // [UNDAVAR-PARTE-3.7] Tras Enter, el change de la salida no vuelve a guardar lo mismo
      if (inp.value.trim() === String(valorPrevio)) return;

      const resultado = evaluarExpresionErianas(inp.value, valorPrevio);

      if (resultado === null) {
        inp.value = String(valorPrevio);
        notificar("⚠️ Expresión de Erianas no válida. Se mantiene el valor anterior.");
        return;
      }

      const valor = resultado;

      // [UNDAVAR-PARTE-3.7C] Si la resta deja el saldo negativo, no se aplica nada
      if (valor < 0) {
        inp.value = String(valorPrevio);
        notificar("⚠️ No tienes suficientes Erianas. Se mantiene el valor anterior.");
        return;
      }

      inp.value = String(valor);
      inp.dataset.valor = String(valor);

      // Refleja el cambio en el lateral sin repintar toda la ficha
      const espejo = qs(`.ed-monedas strong[data-eriana="${inp.dataset.key}"]`);
      if (espejo) espejo.textContent = valor;

      await guardarCampo(`system.erianas.${inp.dataset.key}`, valor);
    };

    inp.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        aplicar();
      }
    });
    inp.addEventListener("change", aplicar);
  });
}

// [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Campos editables de la cartera, para PJ y PNJ
function carteraCamposHTML(actor) {
  const e = actor.system.erianas || { oro: 0, rubi: 0, diamante: 0 };
  const campo = (key, nombre) => `
    <label class="eriana-campo">
      <span>${nombre}</span>
      <input type="text" inputmode="decimal" autocomplete="off" class="campo-eriana" data-key="${key}" data-valor="${Number(e[key]) || 0}" value="${Number(e[key]) || 0}" aria-label="Erianas de ${nombre.toLowerCase()}">
    </label>`;
  return `<div class="erianas-fila">
    ${campo("oro", "Oro")}
    ${campo("rubi", "Rubí")}
    ${campo("diamante", "Diamante")}
  </div>`;
}

// [UNDAVAR-PARTE-10.5C-MODO] Modo de la pestaña Datos para la ficha abierta
function modoDatosFicha(store, id) {
  const clave = `${store}:${id}`;
  if (state.modoDatosClave !== clave) {
    state.modoDatosClave = clave;
    state.modoDatos = "vista";
  }
  return state.modoDatos;
}

// [UNDAVAR-PARTE-10.5C-MODO] Barra con el cambio entre vista y edición
function barraModoDatosHTML(modo) {
  const vista = modo === "vista";
  return `
  <div class="datos-modo-barra">
    <span class="datos-modo-etiqueta">${vista ? "Ficha de lectura" : "Modo edición"}</span>
    <button type="button" class="btn-secundario chico datos-modo-btn" id="btn-modo-datos" data-modo="${vista ? "editar" : "vista"}" title="${vista ? "Editar los datos de la ficha" : "Ver la ficha en modo lectura"}">
      <span data-icono="${vista ? "editar" : "vista"}"></span> ${vista ? "Editar" : "Ver ficha"}
    </button>
  </div>`;
}

// [UNDAVAR-PARTE-10.5C-MODO] Fila de la ficha de lectura
function filaVistaHTML(etiqueta, valor) {
  const texto = String(valor ?? "").trim();
  return `<div class="datos-vista-fila"><dt>${esc(etiqueta)}</dt><dd${texto ? "" : ' class="sin-dato"'}>${texto ? esc(texto) : "—"}</dd></div>`;
}

// [UNDAVAR-PARTE-10.5C-MODO] Párrafo de la ficha de lectura
function textoVistaHTML(texto, vacio = "Sin registrar.") {
  const limpio = String(texto || "").trim();
  return limpio
    ? `<p class="datos-vista-parrafo">${esc(limpio)}</p>`
    : `<p class="datos-vista-parrafo sin-dato">${esc(vacio)}</p>`;
}

// [UNDAVAR-PARTE-10.5C-MODO] Erianas y su historial en modo lectura
function erianasVistaHTML(actor, store = "personajes") {
  const e = actor.system.erianas || {};
  const moneda = (clase, nombre, valor) => `
    <div class="datos-vista-moneda ${clase}">
      <span>${nombre}</span>
      <strong>${Number(valor) || 0}</strong>
    </div>`;
  return `
  <div class="datos-vista-erianas">
    ${moneda("oro", "Oro", e.oro)}
    ${moneda("rubi", "Rubí", e.rubi)}
    ${moneda("diamante", "Diamante", e.diamante)}
  </div>
  <!-- [UNDAVAR-PARTE-10.6-TRANSFERENCIAS] Transferencia directa desde la ficha -->
  <div class="erianas-botones">
    <button type="button" class="btn-secundario" id="btn-transferir-erianas" data-store="${esc(store)}">🔁 Transferir Erianas</button>
  </div>
  <details class="historial-erianas-detalle">
    <summary>Historial de Erianas</summary>
    ${historialErianasHTML(actor)}
  </details>`;
}

// [UNDAVAR-PARTE-10.5C-MODO] Datos del PJ en modo lectura
function datosVistaPJHTML(actor) {
  const d = actor.system.datos || {};
  return `
  <div class="datos-vista">
    <div class="datos-vista-grid">
      <section class="datos-vista-bloque">
        <h3>Identidad</h3>
        <dl class="datos-vista-lista">
          ${filaVistaHTML("Procedencia", d.procedencia)}
          ${filaVistaHTML("Edad", d.edad)}
          ${filaVistaHTML("Clase", d.clase ? d.clase.charAt(0).toUpperCase() + d.clase.slice(1) : "")}
          ${filaVistaHTML("Gremio", d.gremio)}
          ${filaVistaHTML("Maestro", d.maestro)}
          ${filaVistaHTML("Sabio Regidor", d.sabioRegidor)}
        </dl>
      </section>
      <section class="datos-vista-bloque">
        <h3>Erianas</h3>
        ${erianasVistaHTML(actor)}
      </section>
      <section class="datos-vista-bloque ancho">
        <h3>Apariencia y personalidad</h3>
        <h4>Apariencia / Descripción</h4>
        ${textoVistaHTML(d.descripcion)}
        <h4>Personalidad</h4>
        ${textoVistaHTML(d.personalidad)}
      </section>
      <section class="datos-vista-bloque ancho">
        <h3>Historia y trasfondo</h3>
        ${textoVistaHTML(d.historia)}
      </section>
    </div>
    ${bloqueMatrimonioHTML(actor, true)}
  </div>`;
}

function tabDatos(actor, modo = "vista") {
  const barra = barraModoDatosHTML(modo);
  if (modo === "vista") return `${barra}${datosVistaPJHTML(actor)}`;
  const d = actor.system.datos;
  return `${barra}
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
        ${carteraCamposHTML(actor)}
        <div class="erianas-botones">
          <button id="btn-roll-erianas" class="btn-secundario">🎲 Erianas iniciales (4d6×10)</button>
          <button id="btn-calculadora" class="btn-secundario">🧮 Conversor de Erianas</button>
          <!-- [UNDAVAR-PARTE-10.6-TRANSFERENCIAS] Transferencia directa desde la ficha -->
          <button type="button" class="btn-secundario" id="btn-transferir-erianas">🔁 Transferir Erianas</button>
        </div>
        <!-- [UNDAVAR-PARTE-4.3c] Historial de Erianas del personaje -->
        <details class="historial-erianas-detalle">
          <summary>Historial de Erianas</summary>
          ${historialErianasHTML(actor)}
        </details>
      </div>
    </div>
  </div>
  ${bloqueMatrimonioHTML(actor)}`;
}

// [UNDAVAR-PARTE-9.6-MATRIMONIO] Vínculo guardado en la ficha
function matrimonioDe(actor) {
  const m = actor?.system?.matrimonio;
  return m && m.conyugeId ? m : null;
}

// [UNDAVAR-PARTE-9.6-MATRIMONIO] ¿Hay al menos una unidad de ese objeto?
function inventarioTiene(actor, nombre, cantidad = 1) {
  const clave = String(nombre || "").trim().toLowerCase();
  const total = (actor?.items || [])
    .filter(i => String(i.name || "").trim().toLowerCase() === clave)
    .reduce((s, i) => s + Math.max(1, Number(i.system?.cantidad) || 1), 0);
  return total >= cantidad;
}

// [UNDAVAR-PARTE-9.6-MATRIMONIO] Bloque de estado civil de la pestaña Datos
// [UNDAVAR-PARTE-10.5C-MODO] En modo lectura no muestra botones de acción
function bloqueMatrimonioHTML(actor, soloLectura = false) {
  const m = matrimonioDe(actor);
  const tieneActa = inventarioTiene(actor, "Acta de matrimonio");
  const tieneDivorcio = inventarioTiene(actor, "Acta de divorcio");
  const fecha = m?.fecha ? new Date(m.fecha).toLocaleDateString("es-ES") : "";
  return `
  <div class="matrimonio-bloque">
    <div class="matrimonio-cab">
      <strong>💍 Matrimonio</strong>
      <span class="matrimonio-estado ${m ? "casado" : ""}">${m ? `Casado/a con ${esc(m.conyugeNombre)}` : "Soltero/a"}</span>
    </div>
    ${m
      ? `<p class="nota">Sabio validador: ${esc(m.sabioNombre || "—")}${m.sabioTipo ? ` (${esc(m.sabioTipo)})` : ""}${fecha ? ` · ${fecha}` : ""}. Toda ganancia de PV, PdC y Erianas se comparte automáticamente con la pareja.</p>
         ${soloLectura ? "" : `<div class="matrimonio-acciones">
           <button type="button" class="btn-peligro chico" id="btn-divorcio" ${tieneDivorcio ? "" : "disabled"} title="${tieneDivorcio ? "" : "Requiere un Acta de divorcio"}">💔 Divorciarse</button>
         </div>`}`
      : soloLectura
        ? `<p class="nota">Sin vínculo matrimonial.</p>`
        : `<p class="nota">Compra un Acta de matrimonio en el Santuario del Conocimiento y fírmala ante un sabio (PJ o PNJ).</p>
         <div class="matrimonio-acciones">
           <button type="button" class="btn-primario chico" id="btn-casarse" ${tieneActa ? "" : "disabled"} title="${tieneActa ? "" : "Requiere un Acta de matrimonio"}">🖋️ Firmar acta de matrimonio</button>
         </div>`}
  </div>`;
}

// [UNDAVAR-PARTE-9.6-MATRIMONIO] Ceremonia: cónyuge y sabio validador
async function abrirModalBoda(actor) {
  const personajes = soloPersonajesReales(await dbGetAll("personajes"));
  const npcs = await dbGetAll("npcs");
  const candidatos = personajes.filter(p => p.id !== actor.id && !matrimonioDe(p));
  const sabios = [
    ...personajes.map(p => ({ id: p.id, nombre: p.nombre, tipo: "PJ" })),
    ...npcs.map(n => ({ id: n.id, nombre: n.nombre, tipo: "PNJ" }))
  ];
  const fondo = crearModal("🖋️ Firmar acta de matrimonio", `
    <p class="nota">La pareja se une ante un sabio que valida el pacto. Se gastará 1 Acta de matrimonio del inventario.</p>
    <div class="campo-fila"><label>Cónyuge</label>
      <select id="boda-conyuge">
        ${candidatos.length
          ? candidatos.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")
          : `<option value="">No hay otros PJ solteros</option>`}
      </select>
    </div>
    <div class="campo-fila"><label>Sabio validador</label>
      <select id="boda-sabio">
        ${sabios.map(s => `<option value="${s.id}">${esc(s.nombre)} · ${s.tipo}</option>`).join("")}
      </select>
    </div>
    <p class="nota">El acta queda firmada y las dos fichas comparten el vínculo.</p>
    <div class="modal-acciones">
      <button type="button" class="btn-primario" id="boda-ok" ${candidatos.length && sabios.length ? "" : "disabled"}>Firmar acta</button>
    </div>
  `);

  qs("#boda-ok", fondo).addEventListener("click", async () => {
    const conyugeId = qs("#boda-conyuge", fondo)?.value || "";
    const sabioId = qs("#boda-sabio", fondo)?.value || "";
    const conyuge = candidatos.find(p => p.id === conyugeId);
    const sabio = sabios.find(s => s.id === sabioId);
    if (!conyuge || !sabio) { notificar("⚠️ Elige cónyuge y sabio."); return; }

    const yo = await dbGet("personajes", actor.id);
    const otro = await dbGet("personajes", conyuge.id);
    if (!yo || !otro) { notificar("⚠️ No se encontraron las dos fichas."); fondo.remove(); return; }
    if (!inventarioTiene(yo, "Acta de matrimonio")) { notificar("⚠️ Falta el Acta de matrimonio."); fondo.remove(); return; }
    if (matrimonioDe(otro)) { notificar(`⚠️ ${otro.nombre} ya está casado/a.`); fondo.remove(); return; }

    recetaConsumir(yo, [{ nombre: "Acta de matrimonio", cantidad: 1 }]);
    const fecha = new Date().toISOString();
    const vinculo = (pareja) => ({
      conyugeId: pareja.id,
      conyugeNombre: pareja.nombre,
      sabioId: sabio.id,
      sabioNombre: sabio.nombre,
      sabioTipo: sabio.tipo,
      fecha
    });
    yo.system.matrimonio = vinculo(otro);
    otro.system.matrimonio = vinculo(yo);
    await dbPut("personajes", yo);
    await dbPut("personajes", otro);
    const texto = `<h4>💍 Matrimonio</h4><p style="text-align:center">${esc(yo.nombre)} y ${esc(otro.nombre)}</p><p style="text-align:center;font-size:11px">Sabio validador: ${esc(sabio.nombre)} (${sabio.tipo})</p>`;
    await logTirada(yo, texto, "personajes");
    await logTirada(otro, texto, "personajes");
    fondo.remove();
    notificar(`💍 ${yo.nombre} y ${otro.nombre} ya están casados.`);
    render();
  });
}

// [UNDAVAR-PARTE-9.6-MATRIMONIO] Divorcio: consume el acta y rompe el vínculo
async function abrirModalDivorcio(actor) {
  const m = matrimonioDe(actor);
  if (!m) return;
  const fondo = crearModal("💔 Divorcio", `
    <p class="nota">Se gastará 1 Acta de divorcio y el vínculo se romperá en las dos fichas.</p>
    <p style="text-align:center"><b>${esc(actor.nombre)}</b> y <b>${esc(m.conyugeNombre)}</b></p>
    <div class="modal-acciones">
      <button type="button" class="btn-peligro" id="divorcio-ok">Confirmar divorcio</button>
    </div>
  `);
  qs("#divorcio-ok", fondo).addEventListener("click", async () => {
    const yo = await dbGet("personajes", actor.id);
    const otro = m.conyugeId ? await dbGet("personajes", m.conyugeId) : null;
    if (!yo) { fondo.remove(); return; }
    if (!inventarioTiene(yo, "Acta de divorcio")) { notificar("⚠️ Falta el Acta de divorcio."); fondo.remove(); return; }
    recetaConsumir(yo, [{ nombre: "Acta de divorcio", cantidad: 1 }]);
    delete yo.system.matrimonio;
    await dbPut("personajes", yo);
    if (otro) {
      delete otro.system.matrimonio;
      await dbPut("personajes", otro);
    }
    const texto = `<h4>💔 Divorcio</h4><p style="text-align:center">${esc(yo.nombre)} y ${esc(m.conyugeNombre)}</p>`;
    await logTirada(yo, texto, "personajes");
    if (otro) await logTirada(otro, texto, "personajes");
    fondo.remove();
    notificar("💔 El matrimonio se ha disuelto.");
    render();
  });
}

// [UNDAVAR-PARTE-4.2d] Entrenamiento para conseguir una nueva arte o arma
const ACIERTOS_ENTRENAMIENTO = 15;

function estadoEntrenamiento(actor, calc) {
  const s = actor.system.solicitud || null;
  const pv = Number(actor.system.pv?.value) || 0;
  const rangoActual = rangoPrincipal(calc.rango);
  const permitido = rangoMinimoAlcanzado(pv, "Wonrixay");
  const pendiente = !!s && !s.completada;
  const usadaEnRango = !!s && s.completada && rangoPrincipal(s.rango) === rangoActual;
  return { solicitud: s, pv, rangoActual, permitido, pendiente, usadaEnRango, disponible: permitido && !pendiente && !usadaEnRango };
}

// [UNDAVAR-PARTE-4.2d2] Arte/arma escrita de la solicitud (puede estar bloqueada hasta los 15 aciertos)
function itemDeSolicitud(actor) {
  const s = actor.system.solicitud;
  return s?.itemId ? (actor.items.find(i => i.id === s.itemId) || null) : null;
}

// [UNDAVAR-PARTE-4.2d2] Cierra el entrenamiento y desbloquea el arte/arma escrita
function completarSolicitud(actor) {
  const s = actor.system.solicitud;
  if (!s) return;
  s.completada = true;
  const it = itemDeSolicitud(actor);
  if (it) it.system.entrenando = false;
}

function bloqueEntrenamientoHTML(actor, calc) {
  const e = estadoEntrenamiento(actor, calc);
  if (e.pendiente) {
    const s = e.solicitud;
    const tipo = s.tipo === "arma" ? "arma" : "arte";
    const it = itemDeSolicitud(actor);
    const pct = Math.min(100, Math.round((s.aciertos / ACIERTOS_ENTRENAMIENTO) * 100));
    return `<div class="entrenamiento-bloque">
      <div class="entrenamiento-cabecera">
        <strong>Entrenamiento: nueva ${tipo}</strong>
        <span class="item-badge">${esc(s.rango)}</span>
      </div>
      <div class="entrenamiento-progreso"><i style="width:${pct}%"></i></div>
      <div class="entrenamiento-linea">Aciertos: <b>${s.aciertos}/${ACIERTOS_ENTRENAMIENTO}</b> · Faltan ${Math.max(0, ACIERTOS_ENTRENAMIENTO - s.aciertos)}</div>
      <div class="entrenamiento-linea">${it ? `Escrita: <b>${esc(it.name)}</b> (no se puede usar hasta completar el entrenamiento)` : `Aún no has escrito tu ${tipo}; puedes hacerlo ya, pero no se podrá usar hasta completar el entrenamiento.`}</div>
      <div class="entrenamiento-botones">
        <button class="btn-secundario chico" id="btn-abrir-entrenamiento">Gestionar entrenamiento</button>
      </div>
    </div>`;
  }
  if (!e.permitido) {
    return `<p class="nota entrenamiento-nota">Las artes y armas nuevas se solicitan al alcanzar el rango 4 <b>Wonrixay</b> (231 PV).</p>`;
  }
  if (e.usadaEnRango) {
    return `<p class="nota entrenamiento-nota">Ya solicitaste una nueva ${e.solicitud.tipo} en <b>${esc(e.solicitud.rango)}</b>. Podrás pedir otra al subir de rango principal.</p>`;
  }
  return "";
}

async function abrirModalEntrenamiento(actor, tipo, calc) {
  const e = estadoEntrenamiento(actor, calc);
  if (!e.pendiente && !e.permitido) { notificar("⚠️ Las artes y armas nuevas se solicitan desde Wonrixay (231 PV)."); return; }
  if (!e.pendiente && e.usadaEnRango) { notificar(`⚠️ Ya pediste una ${e.solicitud.tipo} en ${e.solicitud.rango}.`); return; }
  if (e.pendiente && e.solicitud.tipo !== tipo) {
    notificar(`⚠️ Ya tienes un entrenamiento de ${e.solicitud.tipo} en curso. Termínalo o descártalo.`);
    return;
  }

  // Crea la solicitud si no hay una pendiente
  if (!e.pendiente) {
    actor.system.solicitud = { rango: calc.rango, tipo, aciertos: 0, completada: false, itemId: "" };
    await dbPut("personajes", actor);
  }
  const s = actor.system.solicitud;
  const etiqueta = tipo === "arma" ? "arma" : "arte";
  const hayItem = () => !!itemDeSolicitud(actor);

  const modal = crearModal(`Entrenamiento: nueva ${etiqueta}`, `
    <div class="entrenamiento-modal">
      <p class="nota">Rango de la solicitud: <b>${esc(s.rango)}</b>. El SR pone desafíos y los aciertos se acumulan entre sesiones. Con ${ACIERTOS_ENTRENAMIENTO} aciertos completas el entrenamiento. Puedes escribir tu nueva ${etiqueta} desde ya, pero no podrás usarla hasta entonces.</p>
      <div class="entrenamiento-progreso"><i id="ent-barra" style="width:${Math.min(100, Math.round(s.aciertos / ACIERTOS_ENTRENAMIENTO * 100))}%"></i></div>
      <div class="entrenamiento-linea">Aciertos: <b><span id="ent-contador">${s.aciertos}</span>/${ACIERTOS_ENTRENAMIENTO}</b></div>
      <div class="campo-fila entrenamiento-sumar">
        <label>Aciertos de la sesión</label>
        <input type="number" id="ent-cantidad" min="1" value="1">
        <button class="btn-secundario" id="ent-sumar">Sumar</button>
      </div>
      <div class="modal-acciones">
        <button class="btn-secundario" id="ent-descartar">Descartar</button>
        <button class="btn-primario" id="ent-escribir">${hayItem() ? `Editar ${etiqueta}` : `Escribir ${etiqueta}`}</button>
      </div>
    </div>`);

  const pintar = () => {
    qs("#ent-contador", modal).textContent = s.aciertos;
    qs("#ent-barra", modal).style.width = `${Math.min(100, Math.round(s.aciertos / ACIERTOS_ENTRENAMIENTO * 100))}%`;
  };

  qs("#ent-sumar", modal).addEventListener("click", async () => {
    const n = Math.max(0, parseInt(qs("#ent-cantidad", modal)?.value) || 0);
    if (!n) return;
    s.aciertos = Math.min(ACIERTOS_ENTRENAMIENTO, s.aciertos + n);
    pintar();
    if (s.aciertos >= ACIERTOS_ENTRENAMIENTO && hayItem()) {
      completarSolicitud(actor);
      await dbPut("personajes", actor);
      modal.remove();
      notificar(`✨ Entrenamiento completado: "${itemDeSolicitud(actor).name}" ya se puede usar.`);
      render();
      return;
    }
    await dbPut("personajes", actor);
    render();
  });

  qs("#ent-descartar", modal).addEventListener("click", async () => {
    const it = itemDeSolicitud(actor);
    const aviso = it ? `Se perderán los ${s.aciertos} aciertos y se eliminará "${it.name}", que aún no se puede usar.` : `Se perderán los ${s.aciertos} aciertos acumulados.`;
    const ok = await confirmarAccion("Descartar entrenamiento", aviso, "Descartar");
    if (!ok) return;
    if (it) actor.items = actor.items.filter(i => i.id !== it.id);
    actor.system.solicitud = null;
    await dbPut("personajes", actor);
    modal.remove();
    render();
  });

  qs("#ent-escribir", modal).addEventListener("click", () => {
    modal.remove();
    const existente = itemDeSolicitud(actor);
    if (existente) { abrirEditorItem(actor, null, existente.id); return; }
    // Al guardar, el ítem queda bloqueado hasta completar el entrenamiento
    // [UNDAVAR-PARTE-10.4-ARMAS] El entrenamiento de arma crea un arma de gladiador
    abrirEditorItem(actor, tipo === "arma" ? "arma_gladiador" : tipo, null, "", async (nuevo) => {
      s.itemId = nuevo.id;
      nuevo.system.entrenando = true;
      if (s.aciertos >= ACIERTOS_ENTRENAMIENTO) completarSolicitud(actor);
      await dbPut("personajes", actor);
    });
  });
}

function conectarEntrenamiento(actor, calc) {
  const btn = qs("#btn-abrir-entrenamiento");
  if (btn) btn.addEventListener("click", () => {
    const s = actor.system.solicitud;
    if (s) abrirModalEntrenamiento(actor, s.tipo, calc);
  });
}

// [UNDAVAR-PARTE-4.2g] Detección y reparación opcional de fichas antiguas
function detectarProblemasFicha(actor) {
  const problemas = [];
  const pdc = actor.system.pdc || {};
  const oficios = actor.items.filter(i => i.type === "oficio");
  const bonosPd = oficios.reduce((a, o) => a + (Number(o.system?.bonos?.pd) || 0), 0);
  const esAntigua = pdc.sinAsignar === undefined;

  if (esAntigua && (Number(pdc.pd) || 0) > bonosPd) {
    problemas.push({
      id: "pd",
      texto: `PD heredados: ${pdc.pd} (solo ${bonosPd} vienen de oficios). Se dejarán en ${bonosPd}.`,
      aplicar: () => { actor.system.pdc.pd = bonosPd; actor.system.pdc.sinAsignar = 0; }
    });
  }

  oficios.forEach(o => {
    if (typeof o.system?.puntos !== "number") {
      problemas.push({
        id: `puntos-${o.id}`,
        texto: `El oficio "${o.name}" no tiene puntos de oficio. Se pondrán en 0.`,
        aplicar: () => { o.system.puntos = 0; if (o.system.maximo === undefined) o.system.maximo = 7; }
      });
    }
    if (o.system?.bonos && !o.system.bonosAplicados) {
      problemas.push({
        id: `bonos-${o.id}`,
        texto: `El oficio "${o.name}" tiene bonos sin aplicar (atributos y PdC).`,
        aplicar: () => { aplicarBonosOficio(actor, o.system.bonos, 1); o.system.bonosAplicados = true; }
      });
    }
  });

  // [UNDAVAR-PARTE-10.4-ARMAS] El arma común no necesita nivel ni mantra de arte
  actor.items.filter(i => i.type === "arte" || (i.type === "arma" && !esArmaComun(i))).forEach(it => {
    if (typeof it.system?.nivel !== "number") {
      problemas.push({
        id: `nivel-${it.id}`,
        texto: `"${it.name}" no tiene nivel. Se pondrá en Nv.0.`,
        aplicar: () => { it.system.nivel = 0; }
      });
    }
    if (typeof it.system?.conjuro !== "string") {
      problemas.push({
        id: `conjuro-${it.id}`,
        texto: `"${it.name}" no tiene campo de mantra. Se creará vacío.`,
        aplicar: () => { it.system.conjuro = ""; }
      });
    }
    if (typeof it.system?.descripcion !== "string") {
      problemas.push({
        id: `desc-${it.id}`,
        texto: `"${it.name}" no tiene campo de descripción. Se creará vacío.`,
        aplicar: () => { it.system.descripcion = ""; }
      });
    }
  });

  return problemas;
}

async function abrirRevisionFicha(actor) {
  const problemas = detectarProblemasFicha(actor);
  if (!problemas.length) { notificar("✅ La ficha no necesita reparaciones."); return; }

  const modal = crearModal("Revisar ficha", `
    <div class="revision-ficha">
      <p class="nota">Se han detectado datos de una ficha antigua. Nada se cambia hasta que confirmes. Revisa la lista:</p>
      <ul class="revision-lista">${problemas.map(p => `<li>${esc(p.texto)}</li>`).join("")}</ul>
      <div class="modal-acciones">
        <button class="btn-secundario" id="rev-cancelar">Cancelar</button>
        <button class="btn-primario" id="rev-aplicar">Corregir todo</button>
      </div>
    </div>`);

  qs("#rev-cancelar", modal).addEventListener("click", () => modal.remove());
  qs("#rev-aplicar", modal).addEventListener("click", async () => {
    problemas.forEach(p => p.aplicar());
    await dbPut("personajes", actor);
    modal.remove();
    notificar(`🛠️ Ficha corregida: ${problemas.length} ajuste(s).`);
    render();
  });
}

// [UNDAVAR-PARTE-4.2e] Panel de progreso de rango (lateral de la ficha)
function textoSiguienteRango(p) {
  return p.siguiente ? `${esc(p.siguiente.nombre)} · faltan <b>${p.faltan}</b> PV` : "Rango máximo alcanzado";
}
function panelProgresoRangoHTML(pv, calc) {
  const p = progresoRango(pv);
  return `
    <div class="ed-progreso-rango" id="panel-progreso-rango">
      <div class="ed-vital-top"><span>Rango</span><strong id="prog-rango">${esc(calc.rango)}</strong></div>
      <div class="ed-medidor"><i id="prog-barra" style="width:${p.pct}%"></i></div>
      <div class="ed-progreso-linea" id="prog-siguiente">${textoSiguienteRango(p)}</div>
      <div class="ed-progreso-costes" id="prog-costes">PC por acción: <b>${calc.costoPCAccion}</b> · Suerte: <b>${calc.costoSuerte}</b> PdC</div>
    </div>`;
}

// [UNDAVAR-PARTE-4.2f] Aplica (signo +1) o revierte (-1) los bonos de un oficio; la salud se deriva sola
function aplicarBonosOficio(actor, bonos, signo = 1) {
  for (const [k, v] of Object.entries(bonos || {})) {
    const n = (Number(v) || 0) * signo;
    if (["fuerza", "velocidad", "agilidad", "inteligencia"].includes(k)) {
      actor.system.atributos[k] = Math.max(0, Math.min(9, (Number(actor.system.atributos[k]) || 0) + n));
    } else if (["pc", "pe", "pr", "pd", "pp", "s"].includes(k)) {
      actor.system.pdc[k] = Math.max(0, (Number(actor.system.pdc[k]) || 0) + n);
    }
  }
}

// [UNDAVAR-PARTE-4.2e] Aviso flotante al subir o bajar de rango (los PV no se reinician)
function avisarCambioRango(antes, despues) {
  if (!antes || antes === despues) return;
  const orden = n => RANGOS_UNDAVAR.findIndex(r => r.nombre === n);
  notificar(orden(despues) > orden(antes) ? `🎖️ ¡Nuevo rango: ${despues}!` : `⬇️ Bajas a ${despues}. Tus PV no se reinician.`);
}

// [UNDAVAR-PARTE-4.2d2] Refresco único en vivo de PV, PA y rango (sin repintar la ficha)
function refrescarVitales(actor, calc) {
  const pv = Number(actor.system.pv?.value) || 0;
  const pa = Number(actor.system.pa?.value) || 0;
  const rangoAntes = calc.rango;
  calc.rango = calcularRango(pv);
  calc.paMaximo = calcularPAMax(pv);
  calc.costoSuerte = costoSuerte(pv);
  calc.costoPCAccion = costoPCAccion(pv);
  const max = calc.paMaximo;
  const pct = (v, m) => m > 0 ? Math.min(100, Math.round(v / m * 100)) : 0;
  const poner = (sel, txt) => { const el = qs(sel); if (el) el.textContent = txt; };

  poner(".ed-ficha-cabecera .ed-badge.oro", calc.rango);
  // [UNDAVAR-PARTE-4.2e] Progreso de rango, costes en vivo y aviso al cruzar un umbral
  const prog = progresoRango(pv);
  poner("#prog-rango", calc.rango);
  const barraRango = qs("#prog-barra");
  if (barraRango) barraRango.style.width = `${prog.pct}%`;
  const sig = qs("#prog-siguiente");
  if (sig) sig.innerHTML = textoSiguienteRango(prog);
  const costes = qs("#prog-costes");
  if (costes) costes.innerHTML = `PC por acción: <b>${calc.costoPCAccion}</b> · Suerte: <b>${calc.costoSuerte}</b> PdC`;
  const pcHint = qs('.pdc-item [data-key="pc"]')?.closest(".pdc-item")?.querySelector("small");
  if (pcHint) pcHint.textContent = `(${calc.costoPCAccion}/acc)`;
  const sHint = qs('.pdc-item [data-key="s"]')?.closest(".pdc-item")?.querySelector("small");
  if (sHint) sHint.textContent = `(costo ${calc.costoSuerte})`;
  avisarCambioRango(rangoAntes, calc.rango);
  poner("#btn-recargar-pa", `Recargar PA (${max})`);
  poner("#lat-pa-valor", pa);
  poner("#lat-pa-max", `/ ${max}`);
  poner("#campo-pa-max", `/${max}`);
  poner(".seccion-acciones .pa-disponible-badge:not(.pv-badge)", `⚡ PA: ${pa} / ${max}`);
  poner(".seccion-acciones .pv-badge", `# PV: ${pv}`);

  const barraPA = qs("#lat-pa-barra");
  if (barraPA) barraPA.style.width = `${pct(pa, max)}%`;
  const barraPV = qs("#campo-pv")?.closest(".ed-vital")?.querySelector(".ed-medidor i");
  if (barraPV) barraPV.style.width = `${pct(pv, Number(calc.pvMaximo) || PV_MAXIMO)}%`;

  const campoPA = qs("#campo-pa");
  if (campoPA) { campoPA.max = max; if (document.activeElement !== campoPA) campoPA.value = pa; }
  const campoPV = qs("#campo-pv");
  if (campoPV && document.activeElement !== campoPV) campoPV.value = pv;

  const tabla = qs(".rangos-tabla");
  if (tabla) qsa("tr", tabla).forEach(tr => tr.classList.toggle("rango-actual", tr.cells[0]?.textContent === calc.rango));

  refrescarEntrenamiento(actor, calc);
}

// [UNDAVAR-PARTE-4.2d] Refresca el bloque y los botones sin repintar la ficha
function refrescarEntrenamiento(actor, calc) {
  const e = estadoEntrenamiento(actor, calc);
  [["#btn-nueva-arte", "arte"], ["#btn-nueva-arma", "arma"]].forEach(([sel, tipo]) => {
    const b = qs(sel);
    if (!b) return;
    b.disabled = !e.disponible;
    b.title = e.disponible ? `Solicitar entrenamiento para una nueva ${tipo}` : "Solo desde Wonrixay, una por rango";
  });
  const zona = qs("#zona-entrenamiento");
  if (zona) {
    zona.innerHTML = bloqueEntrenamientoHTML(actor, calc);
    conectarEntrenamiento(actor, calc);
  }
}

function tabArtesArmas(actor, calc) {
  const artes = actor.items.filter(i => i.type === "arte");
  // [UNDAVAR-PARTE-10.4-ARMAS] Solo las armas de gladiador van a Artes
  const armas = actor.items.filter(i => i.type === "arma" && !esArmaComun(i));
  const entrenamiento = estadoEntrenamiento(actor, calc);
  // [UNDAVAR-PARTE-4.2a] Nivel editable con coste en PV por nivel destino
  const fila = (it) => {
    const nivel = Number(it.system.nivel) || 0;
    const coste = nivel < 4 ? costoPVNivel(nivel + 1) : 0;
    return `
    <div class="item-fila" data-item-id="${it.id}">
      <span class="item-nombre">${esc(it.name)}${it.system.entrenando ? ` <span class="item-badge entrenando-badge" title="Se desbloquea con 15 aciertos de entrenamiento">🔒 En entrenamiento</span>` : ""}</span>
      <span class="item-nivel">
        <button type="button" class="btn-nivel" data-id="${it.id}" data-delta="-1" ${nivel <= 0 ? "disabled" : ""} title="Bajar nivel (no devuelve PV)" aria-label="Bajar nivel">−</button>
        <b>Nv ${nivel}</b>
        <button type="button" class="btn-nivel" data-id="${it.id}" data-delta="1" ${nivel >= 4 ? "disabled" : ""} title="${nivel < 4 ? `Subir a Nv.${nivel + 1} cuesta ${coste} PV` : "Nivel máximo"}" aria-label="Subir nivel">+</button>
      </span>
      <span class="item-badge pa-badge" title="PA para usar">${costoPANivel(nivel)} PA</span>
      <span class="item-badge" title="Coste del siguiente nivel">${nivel < 4 ? `${coste} PV → Nv.${nivel + 1}` : "Nivel máximo"}</span>
      ${nivel >= 2 ? `<span class="item-badge" title="Bono de aciertos del nivel">+${bonusCombate(nivel)} aciertos</span>` : ""}
      <div class="item-botones">
        <button class="btn-secundario chico btn-icono btn-usar-arte" data-id="${it.id}" ${it.system.entrenando ? "disabled" : ""} title="${it.system.entrenando ? "En entrenamiento: no se puede usar todavía" : "Usar (lanza daño)"}" aria-label="Usar"><span data-icono="usar"></span></button>
        <button class="btn-secundario chico btn-icono btn-editar-item" data-id="${it.id}" title="Editar" aria-label="Editar"><span data-icono="editar"></span></button>
        <button class="btn-peligro chico btn-icono btn-borrar-item" data-id="${it.id}" title="Eliminar" aria-label="Eliminar"><span data-icono="borrar"></span></button>
      </div>
    </div>`;
  };
  return `
    <div class="seccion-acciones">
      <button class="btn-secundario" id="btn-nueva-arte" ${entrenamiento.disponible ? "" : "disabled"} title="${entrenamiento.disponible ? "Solicitar entrenamiento para una nueva arte" : "Solo desde Wonrixay, una por rango"}">+ Nueva Arte</button>
      <button class="btn-secundario" id="btn-nueva-arma" ${entrenamiento.disponible ? "" : "disabled"} title="${entrenamiento.disponible ? "Solicitar entrenamiento para una nueva arma" : "Solo desde Wonrixay, una por rango"}">+ Nueva Arma</button>
      <span class="pa-disponible-badge">⚡ PA: ${actor.system.pa.value} / ${calc.paMaximo}</span>
      <span class="pa-disponible-badge pv-badge" title="Puntos de Valentía actuales"># PV: ${Number(actor.system.pv?.value) || 0}</span>
    </div>
    <div id="zona-entrenamiento">${bloqueEntrenamientoHTML(actor, calc)}</div>
    <div class="items-lista">
      ${artes.map(fila).join("")}${armas.map(fila).join("")}
      ${(!artes.length && !armas.length) ? `<p class="vacio">Sin artes ni armas. Agrega con los botones de arriba.</p>` : ""}
    </div>`;
}

function tabOficios(actor, catalogo) {
  const oficios = actor.items.filter(i => i.type === "oficio");
  return `
    <p class="nota">Al crear la ficha puedes elegir hasta 2 oficios (recomendado). Reclamar uno cuesta 3 PD (los de logro son gratis) y cada punto extra cuesta 1 PD. Máximo 7 puntos de oficio. PD disponibles: <b>${Number(actor.system.pdc?.pd) || 0}</b>.</p>
    ${catalogo.length ? `
    <!-- [UNDAVAR-PARTE-10.8.4-BUSCADOR-OFICIO-FICHA] Buscador sobre el selector de oficios -->
    <div class="oficio-buscador">
      <input type="search" id="buscar-oficio" placeholder="🔍 Buscar oficio…" autocomplete="off" aria-label="Buscar oficio">
      <span class="filtro-sin-resultados" id="oficio-sin-resultados" hidden>Sin coincidencias entre los oficios disponibles (los que ya tienes no se listan).</span>
    </div>
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
          <button class="btn-peligro chico btn-icono btn-borrar-item" data-id="${it.id}" title="Eliminar" aria-label="Eliminar"><span data-icono="borrar"></span></button>
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

  const filaItem = (it) => {
    // [UNDAVAR-PARTE-4.2d-EFECTOS] Solo los ítems con efecto mecánico se pueden usar
    // [UNDAVAR-PARTE-4.2e4b-USO-BONOS] También los que dan bonos temporales
    const ef = efectoMecanicoItem(it);
    const tieneUso = itemTieneUso(it);
    // [UNDAVAR-PARTE-10.5-NIVELES] Insignia y aviso del nivel de la unidad
    const rango = rangoNivelesItem(it);
    const nivelEtiqueta = etiquetaNivelItem(it);
    const tituloNivel = !rango.tiene
      ? ""
      : rango.oculto
        ? "Nivel oculto hasta usar"
        : `Nivel ${rango.actual}${rango.max > rango.min ? ` (rango ${rango.min}-${rango.max})` : ""}`;
    const textoUso = rango.oculto
      ? "Nivel oculto hasta usar"
      : ef ? describirEfectoMecanico(ef) : describirBonosItem(it);
    // [UNDAVAR-PARTE-10.7-CIERRE] Los alimentos elaborados se distinguen en el inventario
    const esAlimento = it.system?.categoria === "alimento";
    return `
    <div class="item-fila" data-item-id="${it.id}">
      <span class="item-nombre">${esc(it.name)}${esAlimento ? ` <span class="item-badge">Alimento</span>` : ""}${nivelEtiqueta ? ` <span class="nivel-badge" title="${esc(tituloNivel)}">${esc(nivelEtiqueta)}</span>` : ""}</span>
      <span class="item-cant">×${it.system?.cantidad || 1}</span>
      <div class="item-botones" style="display:flex; gap:4px; align-items:center;">
        <select class="sel-mover-item" data-id="${it.id}" title="Mover a..." style="background:#1e1e24; color:#ccc; border:1px solid #444; border-radius:3px; font-size:0.75em; padding:2px;">
          ${listaOpcionesUbicacion.map(op => `
            <option value="${op.id}" ${(it.system?.ubicacionId || "") === op.id ? "selected" : ""}>
              ${op.nombre}
            </option>
          `).join("")}
        </select>
        ${tieneUso ? `<button class="btn-secundario chico btn-icono btn-usar-item" data-id="${it.id}" title="Usar: ${esc(textoUso)}" aria-label="Usar"><span data-icono="usar"></span></button>` : ""}
        <button class="btn-secundario chico btn-icono btn-transferir-item" data-id="${it.id}" title="Enviar a otra ficha" aria-label="Enviar a otra ficha">🎁</button>
        <button class="btn-secundario chico btn-icono btn-editar-item" data-id="${it.id}" title="Editar" aria-label="Editar"><span data-icono="editar"></span></button>
        <button class="btn-peligro chico btn-icono btn-borrar-item" data-id="${it.id}" title="Eliminar" aria-label="Eliminar"><span data-icono="borrar"></span></button>
      </div>
    </div>`;
  };

  const renderContenedor = (idContenedor, titulo, limite, esBolsillo = false, contObj = null) => {
    const itemsUbicacion = items.filter(i => {
      // [UNDAVAR-PARTE-3.9] El equipo desequipado vuelve al inventario como objeto
      // [UNDAVAR-PARTE-10.4-ARMAS] El arma común también vive en el inventario
      const esTipoValido = i.type === "objeto" || i.type === "elixir" || i.type === "equipo" || (i.type === "arma" && esArmaComun(i));
      const u = i.system?.ubicacionId || "";
      const estaAqui = (u === idContenedor);
      const noEquipado = !estaEquipado(i);
      return esTipoValido && estaAqui && noEquipado;
    });

    const objetos = itemsUbicacion.filter(i => i.type === "objeto" || i.type === "equipo" || (i.type === "arma" && esArmaComun(i)));
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

  // [UNDAVAR-PARTE-9.5-RECETAS] Acceso al taller de elaboración desde el inventario
  return `
    <div class="seccion-acciones" style="margin-bottom:15px; display:flex; gap:10px; flex-wrap:wrap;">
      <button class="btn-secundario btn-add-item-rapido" data-tipo="objeto" data-ubicacion="">+ Añadir objeto</button>
      <button class="btn-secundario btn-add-item-rapido" data-tipo="elixir" data-ubicacion="">+ Añadir elixir</button>
      <button class="btn-secundario" id="btn-crear-contenedor">+ Crear contenedor</button>
      <button class="btn-secundario" id="btn-abrir-taller">🛠️ Craftear</button>
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
            <button id="btn-guardar-contenedor" class="btn-primario">Guardar</button>
          </div>
        </div>
      </div>
    </div>`;
}

// [UNDAVAR-PARTE-9.5B-RECETAS-LIBRES] Recetas inventadas por los jugadores
const RECETAS_CUSTOM_KEY = "recetas_custom";

// [UNDAVAR-PARTE-10.7-RECETAS-TIPO] Tipos de receta y su etiqueta visible
const TIPOS_RECETA = {
  objeto: "Objeto",
  elixir: "Elixir",
  alimento: "Alimento",
  arma_comun: "Arma común",
  arma_gladiador: "Arma de gladiador",
  equipo: "Equipo"
};

// [UNDAVAR-PARTE-10.7-RECETAS-TIPO] Normaliza el tipo de las recetas antiguas
function tipoRecetaNormalizado(r) {
  const directo = String(r?.tipoReceta || "");
  if (TIPOS_RECETA[directo]) return directo;
  const viejo = String(r?.tipo || "");
  if (viejo === "arma") return "arma_comun";
  if (TIPOS_RECETA[viejo]) return viejo;
  return "objeto";
}

// [UNDAVAR-PARTE-10.7-RECETAS-TIPO] Tipo de ítem que produce cada tipo de receta
function tipoItemDeReceta(tipoReceta) {
  if (tipoReceta === "arma_comun" || tipoReceta === "arma_gladiador") return "arma";
  if (tipoReceta === "alimento") return "objeto";
  return tipoReceta;
}

async function cargarRecetasCustom() {
  const lista = await dbGetConfig(RECETAS_CUSTOM_KEY, []);
  if (!Array.isArray(lista)) return [];
  return lista.map(r => {
    const tipoReceta = tipoRecetaNormalizado(r);
    return {
      id: String(r.id || nuevoId()),
      custom: true,
      nombre: String(r.nombre || "").trim(),
      resultado: String(r.nombre || "").trim(),
      oficio: String(r.oficio || ""),
      tipoReceta,
      tipo: tipoItemDeReceta(tipoReceta),
      system: { descripcion: String(r.descripcion || ""), efecto: String(r.efecto || "") },
      efectoMecanico: r.efectoMecanico || null,
      bonos: Array.isArray(r.bonos) ? r.bonos : [],
      duracion: String(r.duracion || ""),
      enfriamientoTurnos: Math.max(0, Number(r.enfriamientoTurnos) || 0),
      niveles: r.niveles && typeof r.niveles === "object" ? r.niveles : null,
      // [UNDAVAR-PARTE-10.7-GLADIADOR] Nivel y habilidades del arma de gladiador
      nivelArma: Math.max(0, Math.min(4, Number(r.nivelArma) || 0)),
      habilidades: Array.isArray(r.habilidades) ? r.habilidades : [],
      // [UNDAVAR-PARTE-10.7-ARMA-EQUIPO] Ranura y reducción del equipo
      slot: String(r.slot || "superior"),
      reduccionDano: Math.max(0, Number(r.reduccionDano) || 0),
      consumible: r.consumible !== false,
      ingredientes: Array.isArray(r.ingredientes)
        ? r.ingredientes
            .filter(i => String(i?.nombre || "").trim())
            .map(i => ({ nombre: String(i.nombre).trim(), cantidad: Math.max(1, Number(i.cantidad) || 1) }))
        : [],
      encantos: true
    };
  // [UNDAVAR-PARTE-10.8-RECETA-SIN-OFICIO] Una receta puede no tener oficio
  }).filter(r => r.nombre);
}

async function guardarRecetasCustom(lista) {
  return dbSetConfig(RECETAS_CUSTOM_KEY, lista);
}

// [UNDAVAR-PARTE-9.5-RECETAS] Oficio reclamado y con puntos suficientes
function recetaOficio(actor, oficioId) {
  return (actor.items || []).find(i => i.type === "oficio" && i.system?.oficioId === oficioId) || null;
}

function recetaOficioUtilizable(actor, oficioId) {
  // [UNDAVAR-PARTE-10.8-RECETA-SIN-OFICIO] Las recetas sin oficio no piden oficio
  if (!oficioId) return true;
  const it = recetaOficio(actor, oficioId);
  const puntos = Number(it?.system?.puntos) || 0;
  if (!it) return false;
  // Los oficios de logro no cuestan PD
  return it.system?.logro ? true : puntos >= 3;
}

// [UNDAVAR-PARTE-9.5-RECETAS] Ingredientes disponibles en el inventario
function inventarioPorNombre(actor) {
  const mapa = new Map();
  for (const it of (actor.items || [])) {
    if (it.type === "oficio") continue;
    const clave = String(it.name || "").trim().toLowerCase();
    const cant = Math.max(1, Number(it.system?.cantidad) || 1);
    mapa.set(clave, (mapa.get(clave) || 0) + cant);
  }
  return mapa;
}

// [UNDAVAR-PARTE-9.5-RECETAS] Encantos que permite la receta y el oficio
function recetaEncantos(receta) {
  if (!receta.encantos) return [];
  const lista = receta.encantos === true
    ? ENCANTOS_UNDAVAR.filter(e => e.oficios.includes(receta.oficio))
    : ENCANTOS_UNDAVAR.filter(e => receta.encantos.includes(e.id));
  return lista;
}

function recetaFaltantes(actor, receta) {
  const disp = inventarioPorNombre(actor);
  return receta.ingredientes
    .map(i => ({ ...i, hay: disp.get(i.nombre.toLowerCase()) || 0 }))
    .filter(i => i.hay < i.cantidad);
}

// [UNDAVAR-PARTE-9.5-RECETAS] Descuenta los ingredientes del inventario
function recetaConsumir(actor, ingredientes) {
  const eliminar = new Set();
  for (const req of ingredientes) {
    let falta = req.cantidad;
    const candidatos = (actor.items || [])
      .filter(i => i.type !== "oficio" && String(i.name || "").trim().toLowerCase() === req.nombre.toLowerCase())
      .sort((a, b) => (Number(a.system?.cantidad) || 1) - (Number(b.system?.cantidad) || 1));
    for (const it of candidatos) {
      if (falta <= 0) break;
      const tiene = Math.max(1, Number(it.system?.cantidad) || 1);
      const usa = Math.min(tiene, falta);
      falta -= usa;
      const resto = tiene - usa;
      if (resto > 0) {
        it.system = it.system || {};
        it.system.cantidad = resto;
      } else {
        eliminar.add(it.id);
      }
    }
  }
  actor.items = (actor.items || []).filter(i => !eliminar.has(i.id));
}

// [UNDAVAR-PARTE-9.5-RECETAS] Crea el ítem resultante, con encanto si se eligió
function recetaCrearItem(receta, encanto) {
  const maestro = (typeof CATALOGO_ITEMS !== "undefined")
    ? CATALOGO_ITEMS.find(m => m.name === receta.resultado)
    : null;
  const base = maestro ? { ...(maestro.system || {}) } : { ...(receta.system || {}) };
  const nombre = encanto ? `${receta.resultado} (${encanto.nombre})` : receta.resultado;
  const extra = encanto ? ` Encanto de ${encanto.nombre.toLowerCase()}: ${encanto.efecto}` : "";
  // [UNDAVAR-PARTE-9.5C-RECETAS] Alimento se guarda como objeto para que aparezca en el inventario
  const tipoItem = receta.tipo === "alimento" ? "objeto" : receta.tipo;
  const sistema = {
    ...base,
    cantidad: 1,
    precio_oro: 0,
    precio_rubi: 0,
    precio_diamante: 0,
    descripcion: `${base.descripcion || ""}${extra}`.trim(),
    efecto: [receta.system?.efecto || base.efecto || "", encanto ? `Encanto: ${encanto.efecto}` : ""]
      .filter(Boolean).join(" · "),
    encanto: encanto ? { id: encanto.id, nombre: encanto.nombre, efecto: encanto.efecto } : null,
  };
  // [UNDAVAR-PARTE-10.4-ARMAS] El arma fabricada es un objeto salvo que el catálogo diga lo contrario
  if (tipoItem === "arma" && typeof sistema.armaComun !== "boolean") sistema.armaComun = true;
  // [UNDAVAR-PARTE-9.5C-RECETAS] Efecto mecánico y bonos de la receta propia
  if (receta.custom) {
    sistema.consumible = receta.consumible !== false;
    if (receta.duracion) sistema.duracion = receta.duracion;
    if (receta.efectoMecanico) sistema.efectoMecanico = receta.efectoMecanico;
    if (Array.isArray(receta.bonos) && receta.bonos.length) sistema.bonos = receta.bonos;
    if (receta.tipo === "arma" && receta.efectoMecanico) sistema.modoUso = "efecto";
    // [UNDAVAR-PARTE-10.7-RECETAS-TIPO] El alimento se marca como tal
    if (receta.tipoReceta === "alimento") sistema.categoria = "alimento";
    // [UNDAVAR-PARTE-10.7-RECETAS-TIPO] Enfriamiento y niveles del objeto fabricado
    const enfriamiento = Math.max(0, Number(receta.enfriamientoTurnos) || 0);
    if (enfriamiento > 0) {
      sistema.enfriamientoTurnos = enfriamiento;
      sistema.enfriamiento = `${enfriamiento} turno${enfriamiento === 1 ? "" : "s"}`;
    }
    // [UNDAVAR-PARTE-10.7-GLADIADOR] Arma de gladiador con su nivel y habilidades
    if (receta.tipoReceta === "arma_gladiador") {
      sistema.armaComun = false;
      sistema.consumible = false;
      sistema.nivel = Math.max(0, Math.min(4, Number(receta.nivelArma) || 0));
      sistema.habilidades = Array.isArray(receta.habilidades) ? receta.habilidades : [];
      sistema.modoUso = "dano";
      sistema.condiciones = [];
    }
    // [UNDAVAR-PARTE-10.7-ARMA-EQUIPO] Arma común y equipo fabricados
    if (receta.tipoReceta === "arma_comun") {
      sistema.armaComun = true;
      sistema.consumible = false;
    }
    if (receta.tipoReceta === "equipo") {
      sistema.consumible = false;
      sistema.slot = receta.slot || "superior";
      sistema.reduccion_dano = Math.max(0, Number(receta.reduccionDano) || 0);
    }
    // [UNDAVAR-PARTE-10.7-CIERRE] El arma de gladiador usa su nivel 0-4, no niveles de objeto
    const nv = receta.tipoReceta === "arma_gladiador" ? null : receta.niveles;
    if (nv?.activo) {
      const min = Math.max(1, Math.trunc(Number(nv.min)) || 1);
      const max = Math.max(min, Math.trunc(Number(nv.max)) || min);
      sistema.nivelMin = min;
      sistema.nivelMax = max;
      sistema.nivelVenta = Math.min(max, Math.max(min, Math.trunc(Number(nv.venta)) || min));
      sistema.nivelAleatorio = !!nv.aleatorio;
      sistema.nivelOculto = !!nv.aleatorio && !!nv.oculto;
      sistema.nivel = min === max ? String(min) : `${min}-${max}`;
      sistema.variacionesNivel = Array.isArray(nv.variaciones) ? nv.variaciones : [];
    }
  }
  return { id: nuevoId(), name: nombre, type: tipoItem, system: sistema };
}

// [UNDAVAR-PARTE-9.5-RECETAS] Elabora una receta y guarda el resultado
async function elaborarReceta(actor, receta, encantoId = "") {
  if (!receta) return false;

  if (!recetaOficioUtilizable(actor, receta.oficio)) {
    const oficio = OFICIOS_UNDAVAR.find(o => o.id === receta.oficio);
    notificar(`⚠️ Necesitas el oficio ${oficio ? oficio.nombre : receta.oficio} con 3 puntos o más.`);
    return false;
  }

  const faltan = recetaFaltantes(actor, receta);
  if (faltan.length) {
    notificar("⚠️ Faltan ingredientes: " + faltan.map(i => `${i.nombre} (${i.hay}/${i.cantidad})`).join(", "));
    return false;
  }

  const encantos = recetaEncantos(receta);
  const encanto = encantos.find(e => e.id === encantoId) || null;

  recetaConsumir(actor, receta.ingredientes);
  let nuevo = recetaCrearItem(receta, encanto);
  // [UNDAVAR-PARTE-10.5-NIVELES] El nivel del objeto fabricado se decide al elaborarlo
  const nivelNuevo = rangoNivelesItem(nuevo);
  if (nivelNuevo.tiene) nuevo = prepararNivelItem(nuevo, { usarVenta: false });

  // [UNDAVAR-PARTE-10.5-NIVELES] Un objeto con niveles no se apila
  // [UNDAVAR-PARTE-10.7-GLADIADOR] Tampoco se apilan armas ni equipos
  // [UNDAVAR-PARTE-10.7-CIERRE] Vale también para las armas del manual
  const apilable = !["arma", "equipo"].includes(nuevo.type);
  if (!encanto && !nivelNuevo.tiene && apilable) {
    const existente = (actor.items || []).find(i => i.name === nuevo.name && i.type === nuevo.type && !i.system?.encanto);
    if (existente) {
      existente.system.cantidad = (Number(existente.system?.cantidad) || 0) + 1;
    } else {
      actor.items.push(nuevo);
    }
  } else {
    actor.items.push(nuevo);
  }

  const ingredientesTxt = receta.ingredientes.map(i => `${i.cantidad}x ${i.nombre}`).join(", ");
  await logTirada(actor, `<h4>Elaboración</h4>
    <p style="text-align:center">${esc(nuevo.name)}${encanto ? ` · encanto de ${esc(encanto.nombre.toLowerCase())}` : ""}</p>
    <p style="text-align:center;font-size:11px">Ingredientes: ${esc(ingredientesTxt)}</p>`, "personajes");
  await dbPut("personajes", actor);
  notificar(`✨ ${nuevo.name} elaborado.`);
  return true;
}

// [UNDAVAR-PARTE-9.5C-RECETAS] Nombres sugeridos: solo materiales de crafteo
let tallerMaterialesCustom = [];
function tallerNombresMateriales(actor) {
  const set = new Set();
  // Materiales del catálogo marcados con system.material
  if (typeof CATALOGO_ITEMS !== "undefined") {
    for (const it of CATALOGO_ITEMS) if (it.system?.material) set.add(it.name);
  }
  // Ingredientes de las recetas del manual
  if (typeof RECETAS_UNDAVAR !== "undefined") {
    for (const r of RECETAS_UNDAVAR) {
      for (const i of (r.ingredientes || [])) if (i?.nombre) set.add(i.nombre);
    }
  }
  // Materiales de construcción del refugio
  if (typeof MATERIALES_REFUGIO !== "undefined") {
    for (const g of Object.values(MATERIALES_REFUGIO)) {
      for (const n of (g?.nombres || [])) set.add(n);
    }
  }
  // Ingredientes ya usados en recetas propias
  for (const n of tallerMaterialesCustom) set.add(n);
  // Lo que ya tiene la ficha, solo si es un material conocido
  for (const it of (actor.items || [])) {
    if (it.type === "oficio" || !it.name) continue;
    if (it.system?.material || set.has(it.name)) set.add(it.name);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// [UNDAVAR-PARTE-9.5C-RECETAS] Fila de material con sugerencias propias
function tallerIngredienteHTML(nombre = "", cantidad = 1) {
  return `<div class="taller-ing-fila">
      <div class="taller-sugerir">
        <input class="taller-ing-nombre" type="text" autocomplete="off" value="${esc(nombre)}" placeholder="Material del inventario">
        <div class="taller-sugerencias" hidden></div>
      </div>
      <input class="taller-ing-cant" type="number" min="1" step="1" value="${Math.max(1, Number(cantidad) || 1)}" aria-label="Cantidad">
      <button type="button" class="btn-icono btn-peligro" data-ing-quitar title="Quitar" aria-label="Quitar">✕</button>
    </div>`;
}

// [UNDAVAR-PARTE-9.5C-RECETAS] Panel de sugerencias flotante, sin recortes del modal
function tallerMostrarSugerencias(input, actor) {
  const caja = input.closest(".taller-sugerir");
  const panel = caja?.querySelector(".taller-sugerencias");
  if (!panel) return;
  const q = input.value.trim().toLowerCase();
  const lista = tallerNombresMateriales(actor)
    .filter(n => !q || n.toLowerCase().includes(q))
    .slice(0, 12);
  if (!lista.length) { panel.hidden = true; return; }
  panel.innerHTML = lista
    .map(n => `<button type="button" class="taller-sugerencia" data-sugerencia="${esc(n)}">${esc(n)}</button>`)
    .join("");
  panel.hidden = false;
  // Coloca la lista según el hueco real de la pantalla
  const r = input.getBoundingClientRect();
  const abajo = window.innerHeight - r.bottom - 12;
  const arriba = r.top - 12;
  panel.style.left = `${Math.round(r.left)}px`;
  panel.style.width = `${Math.round(r.width)}px`;
  if (abajo >= 110 || abajo >= arriba) {
    panel.style.top = `${Math.round(r.bottom + 3)}px`;
    panel.style.bottom = "auto";
    panel.style.maxHeight = `${Math.max(96, Math.min(168, abajo))}px`;
  } else {
    panel.style.top = "auto";
    panel.style.bottom = `${Math.round(window.innerHeight - r.top + 3)}px`;
    panel.style.maxHeight = `${Math.max(96, Math.min(168, arriba))}px`;
  }
}

// [UNDAVAR-PARTE-9.5-RECETAS] Tarjeta de una receta del taller
function tallerTarjetaHTML(actor, receta, disp, usable) {
  const faltan = recetaFaltantes(actor, receta);
  const encantos = recetaEncantos(receta);
  const puede = usable && !faltan.length;
  return `<div class="receta ${puede ? "" : "bloqueada"} ${receta.custom ? "receta-custom" : ""}">
      <div class="receta-cab">
        <strong>${esc(receta.nombre)} ${receta.custom ? `<span class="item-badge receta-badge">Inventada · ${esc(TIPOS_RECETA[receta.tipoReceta] || "Objeto")}</span>` : ""}</strong>
        <span class="receta-resultado">→ ${esc(receta.resultado)}</span>
      </div>
      ${receta.system?.descripcion ? `<p class="receta-desc">${esc(receta.system.descripcion)}</p>` : ""}
      <div class="receta-ingredientes">
        ${(receta.ingredientes || []).map(i => {
          const hay = disp.get(i.nombre.toLowerCase()) || 0;
          return `<span class="receta-ing ${hay >= i.cantidad ? "ok" : "falta"}">${esc(i.nombre)} <b>${hay}/${i.cantidad}</b></span>`;
        }).join("") || `<span class="receta-ing ok">Sin ingredientes</span>`}
      </div>
      ${encantos.length ? `<div class="receta-encanto">
          <label for="encanto-${receta.id}">Encanto</label>
          <select id="encanto-${receta.id}" data-encanto-receta="${receta.id}">
            <option value="">Sin encanto</option>
            ${encantos.map(e => `<option value="${e.id}">${esc(e.nombre)} · ${esc(e.efecto)}</option>`).join("")}
          </select>
        </div>` : ""}
      <div class="receta-pie">
        ${receta.custom ? `<button type="button" class="btn-peligro chico" data-receta-borrar="${receta.id}">Borrar</button>` : ""}
        <button type="button" class="btn-primario chico" data-receta-elaborar="${receta.id}" ${puede ? "" : "disabled"}>Elaborar</button>
      </div>
    </div>`;
}

// [UNDAVAR-PARTE-9.5C-RECETAS] Fila de efecto mecánico del formulario
function tallerFilaEfectoHTML(k, etiqueta) {
  const esMarca = ["hambre", "sed", "cansancio", "fatiga"].includes(k);
  return `<div class="efecto-fila">
      <span class="efecto-nombre">${etiqueta}</span>
      <div class="efecto-controles">
        <label class="efecto-control"><span>Valor</span><input type="number" class="tr-ef-${k}-valor" min="0" value="0"></label>
        <label class="efecto-control"><span>Modo</span><select class="tr-ef-${k}-modo">
          <option value="fijo">Fijo</option>
          <option value="pct">%</option>
        </select></label>
        <label class="efecto-control"><span>Cuándo</span><select class="tr-ef-${k}-cuando">
          <option value="inmediato">Inmediato</option>
          <option value="turno">Por turno</option>
        </select></label>
        ${esMarca ? `<label class="efecto-control"><span>Dirección</span><select class="tr-ef-${k}-signo">
          <option value="quitar">Quitar</option>
          <option value="aplicar">Aplicar</option>
        </select></label>` : ""}
      </div>
    </div>`;
}

// [UNDAVAR-PARTE-10.8.3-BUSCADOR-OFICIO] Filtra las opciones del selector de oficio
function tallerFiltrarOficios(select, consulta) {
  if (!select) return;
  const q = mapaNormalizarTexto(consulta).trim();
  const previo = select.value;
  const base = [
    ...OFICIOS_UNDAVAR.map(o => ({ id: o.id, nombre: `${o.nombre}${o.logro ? " (logro)" : ""}` })),
    { id: "", nombre: "Sin oficio (cualquiera puede fabricar)", buscar: "Sin oficio" }
  ];
  const coincide = base.filter(o => !q || mapaNormalizarTexto(o.buscar || o.nombre).includes(q));
  let lista = coincide;
  // Sin coincidencias se mantiene el oficio actual y se muestra el aviso
  if (!lista.length) {
    const elegido = base.find(o => o.id === previo);
    lista = [elegido || base[base.length - 1]];
  }
  select.innerHTML = lista
    .map(o => `<option value="${esc(o.id)}">${esc(o.nombre)}</option>`)
    .join("");
  select.value = lista.some(o => o.id === previo) ? previo : lista[0].id;
  const aviso = select.closest("label")?.querySelector("[data-tr-oficio-aviso]");
  if (aviso) aviso.hidden = !q || coincide.length > 0;
}

// [UNDAVAR-PARTE-9.5C-RECETAS] Formulario para crear una receta
// [UNDAVAR-PARTE-10.7-RECETAS-TIPO] El tipo se elige primero y filtra los campos
function tallerFormularioHTML(actor) {
  // [UNDAVAR-PARTE-10.8-RECETA-SIN-OFICIO] El oficio es opcional
  const oficios = [
    ...OFICIOS_UNDAVAR.map(o => `<option value="${o.id}">${esc(o.nombre)}${o.logro ? " (logro)" : ""}</option>`),
    `<option value="">Sin oficio (cualquiera puede fabricar)</option>`
  ].join("");
  // [UNDAVAR-PARTE-10.7-GLADIADOR] Habilidad vacía inicial del arma
  const habInicial = {
    id: nuevoId(), nombre: "Habilidad 1", modoUso: "dano", descripcion: "", conjuro: "",
    efectoMecanico: null, condiciones: [], bonos: [], aplicaEfecto: false,
    requisito: {}, variacionesNivel: []
  };
  return `<div class="taller-form" data-taller-form hidden>
      <h4>➕ Crear receta</h4>
      <p class="taller-form-nota">Elige primero el tipo de receta. Después aparecerán solo los campos que necesita. Si falta un material, la receta quedará bloqueada hasta conseguirlo.</p>

      <label class="taller-tipo-paso">Tipo de receta
        <select data-tr-tipo-receta>
          <option value="">— Elige el tipo —</option>
          <option value="objeto">Objeto</option>
          <option value="elixir">Elixir</option>
          <option value="alimento">Alimento</option>
          <option value="arma_gladiador">Arma de gladiador</option>
          <option value="arma_comun">Arma común</option>
          <option value="equipo">Equipo</option>
        </select>
      </label>

      <div data-tr-campos hidden>
        <div class="taller-form-grid">
          <label>Nombre del objeto<input type="text" data-tr-nombre maxlength="80" placeholder="Ej.: Bastón de musgo"></label>
          <!-- [UNDAVAR-PARTE-10.8.3-BUSCADOR-OFICIO] Buscador para filtrar la lista de oficios -->
          <label>Oficio<input type="search" data-tr-oficio-busca placeholder="Buscar oficio…" autocomplete="off" aria-label="Buscar oficio"><select data-tr-oficio>${oficios}</select><span class="taller-oficio-aviso" data-tr-oficio-aviso hidden>Sin coincidencias.</span></label>
        </div>
        <label>Descripción<input type="text" data-tr-desc maxlength="180" placeholder="Qué es y cómo se ve"></label>

        <!-- [UNDAVAR-PARTE-10.7-GLADIADOR] Pestañas como en el editor para cortar el scroll -->
        <div class="editor-tabs" data-tr-tabs></div>

        <div class="editor-panel activo" data-tr-panel="basico">
          <div class="taller-tipo-panel" data-tr-bloque="basico" hidden>
            <label class="campo-check"><input type="checkbox" data-tr-consumible checked> Se gasta al usar</label>
            <div class="taller-form-grid">
              <label>Duración<input type="text" data-tr-duracion maxlength="80" placeholder="Único, 2 turnos..."></label>
              <label>Enfriamiento (turnos)<input type="number" data-tr-enfriamiento min="0" value="0"></label>
            </div>
          </div>

          <!-- [UNDAVAR-PARTE-10.7-GLADIADOR] Nivel y enfriamiento del arma -->
          <div class="taller-tipo-panel" data-tr-bloque="gladiador" hidden>
            <div class="taller-form-grid">
              <label>Nivel del arma (0–4)<input type="number" data-tr-nivel-arma min="0" max="4" value="0"></label>
              <label>Enfriamiento (turnos)<input type="number" data-tr-enfriamiento-arma min="0" value="0"></label>
            </div>
            <p class="bloque-hint">El arma se guardará en Artes, no en el inventario común. Las habilidades se configuran en la pestaña «Habilidades».</p>
          </div>

          <!-- [UNDAVAR-PARTE-10.7-ARMA-EQUIPO] Campos del arma común -->
          <div class="taller-tipo-panel" data-tr-bloque="arma_comun" hidden>
            <div class="taller-form-grid">
              <label>Duración<input type="text" data-tr-duracion-comun maxlength="80" placeholder="Único, 2 turnos..."></label>
              <label>Enfriamiento (turnos)<input type="number" data-tr-enfriamiento-comun min="0" value="0"></label>
            </div>
            <p class="bloque-hint">El arma común va al inventario y se equipa como los objetos. Sus niveles y su efecto están en sus pestañas.</p>
          </div>

          <!-- [UNDAVAR-PARTE-10.7-ARMA-EQUIPO] Campos del equipo -->
          <div class="taller-tipo-panel" data-tr-bloque="equipo" hidden>
            <div class="taller-form-grid">
              <label>Ranura<select data-tr-slot>
                ${["cabeza", "superior", "collares", "accesorios", "inferior", "pies"].map(s => `<option value="${s}">${s}</option>`).join("")}
              </select></label>
              <label>Reducción de daño<input type="number" data-tr-reduccion min="0" value="0"></label>
              <label>Enfriamiento (turnos)<input type="number" data-tr-enfriamiento-equipo min="0" value="0"></label>
            </div>
            <p class="bloque-hint">El equipo va a la pestaña Equipo de la ficha y reduce el daño recibido.</p>
          </div>
        </div>

        <div class="editor-panel" data-tr-panel="niveles">
          <details class="efecto-mecanico niveles-objeto" data-tr-bloque="niveles" hidden>
            <summary>Niveles (opcional)</summary>
            <label class="campo-check"><input type="checkbox" data-tr-niveles-activo> Usar niveles en este objeto</label>
            <div data-tr-niveles-controles hidden>
              <div class="efecto-grid">
                <label>Nivel mínimo<input type="number" data-tr-nivel-min min="1" max="99" value="1"></label>
                <label>Nivel máximo<input type="number" data-tr-nivel-max min="1" max="99" value="1"></label>
                <label>Nivel de venta<input type="number" data-tr-nivel-venta min="1" max="99" value="1"></label>
              </div>
              <label class="campo-check"><input type="checkbox" data-tr-nivel-azar> Nivel al azar al fabricar</label>
              <label class="campo-check"><input type="checkbox" data-tr-nivel-oculto disabled> Ocultar el nivel hasta usar el objeto</label>
              <div data-tr-niveles-lista></div>
            </div>
          </details>
        </div>

        <div class="editor-panel" data-tr-panel="habilidades">
          <!-- [UNDAVAR-PARTE-10.7-GLADIADOR] Mismo patrón que el editor: selector y una tarjeta visible -->
          <div data-tr-bloque="habilidades" hidden>
            <p class="bloque-hint">Los PA salen del modo de uso de cada habilidad. Usa los botones para cambiar de habilidad.</p>
            <span class="taller-habs-titulo">Habilidades</span>
            <div class="hab-selector" id="tr-hab-selector">
              <button type="button" class="hab-selector-btn activo" data-hab-id="${esc(habInicial.id)}">${esc(habInicial.nombre)}</button>
            </div>
            <div class="habilidades-lista" data-tr-habilidades>
              ${habilidadCardHTML(habInicial, true)}
            </div>
            <button type="button" class="btn-secundario chico" data-tr-add-hab>+ Añadir habilidad</button>
          </div>
        </div>

        <div class="editor-panel" data-tr-panel="niveles-hab">
          <!-- [UNDAVAR-PARTE-10.7-CONSISTENCIA] Niveles por habilidad, como en el editor -->
          <div data-tr-bloque="niveles_hab" hidden>
            <p class="nota">Cada habilidad tiene sus propios niveles. Elige una habilidad y ajusta lo que cambia con el nivel.</p>
            <div class="hab-selector" id="tr-hab-nivel-selector">
              <button type="button" class="hab-selector-btn activo" data-hab-id="${esc(habInicial.id)}">${esc(habInicial.nombre)}</button>
            </div>
            <div data-tr-niveles-hab>
              ${grupoNivelesHabilidadHTML(habInicial, true)}
            </div>
          </div>
        </div>

        <div class="editor-panel" data-tr-panel="efecto">
          <details class="efecto-mecanico" data-tr-bloque="efecto" hidden>
          <summary>Efecto y bonos (opcional)</summary>
          <label>Texto del efecto<textarea data-tr-efecto rows="2" maxlength="240" placeholder="Qué hace, si aplica"></textarea></label>
          <!-- [UNDAVAR-PARTE-10.7-CONSISTENCIA] El equipo no usa efecto mecánico, solo texto y bonos -->
          <div data-tr-ef-grid>
          <div class="taller-efecto-tabla">
            ${tallerFilaEfectoHTML("salud", "Salud")}
            ${tallerFilaEfectoHTML("herida", "Herida")}
            ${tallerFilaEfectoHTML("hambre", "Hambre")}
            ${tallerFilaEfectoHTML("sed", "Sed")}
            ${tallerFilaEfectoHTML("cansancio", "Cansancio")}
            ${tallerFilaEfectoHTML("fatiga", "Fatiga")}
          </div>
          <div class="taller-efecto-grid">
            <label>Turnos del efecto<input type="number" data-tr-ef-turnos min="0" value="1"></label>
            <label>Objetivo<select data-tr-ef-objetivo>
              <option value="ambos">Propio y otros</option>
              <option value="propio">Solo propio</option>
              <option value="otro">Solo otros</option>
            </select></label>
          </div>
          </div>
          <div class="bono-tabla">
            <div class="bono-cabecera"><span>Bono</span><span>Valor</span><span>Modo</span><span>Turnos</span><span>Acum.</span><span></span></div>
            <div data-tr-bonos></div>
          </div>
          <button type="button" class="btn-secundario chico" data-tr-add-bono>+ Añadir bono</button>
          <p class="nota">Los campos «por turno» se repiten en los turnos siguientes. Los bonos se suman mientras estén activos.</p>
          </details>
        </div>

        <div class="taller-form-ing">
          <span>Materiales necesarios</span>
          <div data-tr-ingredientes>${tallerIngredienteHTML()}</div>
          <button type="button" class="btn-secundario chico" data-taller-add-ing>+ Material</button>
        </div>

        <div class="taller-form-pie">
          <button type="button" class="btn-secundario chico" data-taller-cancelar>Cancelar</button>
          <button type="button" class="btn-primario chico" data-taller-guardar>Guardar receta</button>
        </div>
      </div>
    </div>`;
}

// [UNDAVAR-PARTE-9.5-RECETAS] Taller: recetas, ingredientes y encantos
async function abrirTaller(actor) {
  document.querySelector(".modal-taller-fondo")?.remove();
  const disp = inventarioPorNombre(actor);
  // [UNDAVAR-PARTE-9.5B-RECETAS-LIBRES] Recetas propias junto a las del manual
  const custom = await cargarRecetasCustom();
  // [UNDAVAR-PARTE-9.5C-RECETAS] Sus materiales también se sugieren
  tallerMaterialesCustom = [...new Set(custom.flatMap(r => (r.ingredientes || []).map(i => i.nombre)))];
  const todas = [...RECETAS_UNDAVAR, ...custom];

  // [UNDAVAR-PARTE-9.5C-RECETAS] Las recetas propias caen en el grupo de su oficio
  const oficiosBase = [...new Set(RECETAS_UNDAVAR.map(r => r.oficio))];
  const oficiosExtra = [...new Set(custom.map(r => r.oficio))].filter(o => !oficiosBase.includes(o));
  // [UNDAVAR-PARTE-10.8-RECETA-SIN-OFICIO] El grupo sin oficio va al final
  const oficiosOrden = [...oficiosBase, ...oficiosExtra.filter(o => o)];
  if (custom.some(r => !r.oficio)) oficiosOrden.push("");
  const secciones = oficiosOrden.map(oficioId => {
    const sinOficio = !oficioId;
    const def = OFICIOS_UNDAVAR.find(o => o.id === oficioId);
    const item = recetaOficio(actor, oficioId);
    const puntos = Number(item?.system?.puntos) || 0;
    const usable = recetaOficioUtilizable(actor, oficioId);
    const recetas = [
      ...RECETAS_UNDAVAR.filter(r => r.oficio === oficioId),
      ...custom.filter(r => r.oficio === oficioId)
    ];
    // [UNDAVAR-PARTE-10.8-RECETA-SIN-OFICIO] Cabecera propia del grupo sin oficio
    const tituloOficio = sinOficio ? "Sin oficio" : (def ? def.nombre : oficioId);
    const estadoOficio = sinOficio
      ? "Cualquiera puede fabricar"
      : `${item ? `${puntos} pts` : "Sin oficio"}${usable ? "" : " · requiere 3 pts"}`;

    return `<section class="taller-oficio">
        <div class="taller-oficio-cab">
          <strong>${esc(tituloOficio)}</strong>
          <span class="taller-oficio-estado ${usable ? "ok" : "falta"}">${esc(estadoOficio)}</span>
        </div>
        ${recetas.map(r => tallerTarjetaHTML(actor, r, disp, usable)).join("")}
      </section>`;
  }).join("");

  const fondo = document.createElement("div");
  fondo.className = "modal-fondo modal-taller-fondo";
  fondo.innerHTML = `
    <div class="modal-caja modal-taller" role="dialog" aria-modal="true" aria-labelledby="taller-titulo">
      <div class="modal-header">
        <h3 id="taller-titulo">🛠️ Taller de elaboración</h3>
        <button class="modal-cerrar" type="button" aria-label="Cerrar" data-taller-cerrar>✕</button>
      </div>
      <div class="modal-cuerpo">
        <div class="taller-barra">
          <p class="taller-nota">Consume ingredientes del inventario. El oficio debe estar reclamado con 3 puntos o más. Los encantos se eligen antes de elaborar.</p>
          <button class="btn-secundario chico" type="button" data-taller-nueva>➕ Crear receta</button>
        </div>
        ${tallerFormularioHTML(actor)}
        ${secciones}
      </div>
    </div>`;
  contenedorOverlays().appendChild(fondo);

  const cerrar = () => fondo.remove();
  const scrollCaja = () => fondo.querySelector(".modal-caja")?.scrollTop || 0;
  const reabrir = async (scroll = 0) => {
    cerrar();
    const y = window.scrollY;
    await render();
    window.scrollTo(0, y);
    const fresco = await dbGet("personajes", actor.id);
    if (!fresco) return;
    await abrirTaller(fresco);
    const caja = document.querySelector(".modal-taller");
    if (caja) caja.scrollTop = scroll;
  };

  fondo.querySelector("[data-taller-cerrar]")?.addEventListener("click", cerrar);

  // [UNDAVAR-PARTE-10.7-RECETAS-TIPO] Campos visibles según el tipo elegido
  const formReceta = fondo.querySelector("[data-taller-form]");
  const selTipoReceta = formReceta?.querySelector("[data-tr-tipo-receta]");
  const BLOQUES_RECETA = {
    objeto: ["basico", "niveles", "efecto"],
    // [UNDAVAR-PARTE-10.7-CONSISTENCIA] Elixir y alimento usan la misma plantilla que objeto
    elixir: ["basico", "niveles", "efecto"],
    alimento: ["basico", "niveles", "efecto"],
    arma_gladiador: ["gladiador", "habilidades", "niveles_hab"],
    // [UNDAVAR-PARTE-10.7-ARMA-EQUIPO] Arma común y equipo
    arma_comun: ["arma_comun", "niveles", "efecto"],
    equipo: ["equipo", "efecto"]
  };
  // [UNDAVAR-PARTE-10.7-GLADIADOR] Pestañas por tipo, como en el editor de artes
  const PANELES_RECETA = {
    objeto: [["basico", "Básico"], ["niveles", "Niveles"], ["efecto", "Efecto"]],
    // [UNDAVAR-PARTE-10.7-CONSISTENCIA] Igual que el editor: elixir y alimento son objeto
    elixir: [["basico", "Básico"], ["niveles", "Niveles"], ["efecto", "Efecto"]],
    alimento: [["basico", "Básico"], ["niveles", "Niveles"], ["efecto", "Efecto"]],
    arma_gladiador: [["basico", "Básico"], ["habilidades", "Habilidades"], ["niveles-hab", "Niveles"]],
    // [UNDAVAR-PARTE-10.7-ARMA-EQUIPO] Arma común y equipo
    arma_comun: [["basico", "Básico"], ["niveles", "Niveles"], ["efecto", "Efecto"]],
    equipo: [["basico", "Básico"], ["efecto", "Efecto"]]
  };
  const activarPanelReceta = (id) => {
    formReceta?.querySelectorAll("[data-tr-tab]").forEach(b => b.classList.toggle("activo", b.dataset.trTab === id));
    formReceta?.querySelectorAll("[data-tr-panel]").forEach(p => p.classList.toggle("activo", p.dataset.trPanel === id));
  };
  const aplicarTipoReceta = () => {
    const tipo = selTipoReceta?.value || "";
    const campos = formReceta?.querySelector("[data-tr-campos]");
    if (campos) campos.hidden = !tipo;
    const bloques = BLOQUES_RECETA[tipo] || [];
    formReceta?.querySelectorAll("[data-tr-bloque]").forEach(b => {
      b.hidden = !bloques.includes(b.dataset.trBloque);
    });
    const paneles = PANELES_RECETA[tipo] || [];
    const tabs = formReceta?.querySelector("[data-tr-tabs]");
    if (tabs) {
      tabs.innerHTML = paneles
        .map(([id, nombre], i) => `<button type="button" class="editor-tab ${i === 0 ? "activo" : ""}" data-tr-tab="${id}">${nombre}</button>`)
        .join("");
    }
    if (paneles.length) activarPanelReceta(paneles[0][0]);
    // [UNDAVAR-PARTE-10.7-CONSISTENCIA] El equipo no tiene efecto mecánico en el editor
    const gridEf = formReceta?.querySelector("[data-tr-ef-grid]");
    if (gridEf) gridEf.hidden = tipo === "equipo";
  };
  selTipoReceta?.addEventListener("change", aplicarTipoReceta);

  // [UNDAVAR-PARTE-10.7-RECETAS-TIPO] Niveles del objeto dentro de la receta
  const contNivelesReceta = formReceta?.querySelector("[data-tr-niveles-controles]");
  if (contNivelesReceta) {
    const listaNiveles = formReceta.querySelector("[data-tr-niveles-lista]");
    const chkActivo = formReceta.querySelector("[data-tr-niveles-activo]");
    const inpMin = formReceta.querySelector("[data-tr-nivel-min]");
    const inpMax = formReceta.querySelector("[data-tr-nivel-max]");
    const inpVenta = formReceta.querySelector("[data-tr-nivel-venta]");
    const chkAzar = formReceta.querySelector("[data-tr-nivel-azar]");
    const chkOculto = formReceta.querySelector("[data-tr-nivel-oculto]");

    const refrescarNivelesReceta = () => {
      const min = Math.max(1, Math.min(99, parseInt(inpMin.value, 10) || 1));
      const max = Math.max(min, Math.min(99, parseInt(inpMax.value, 10) || min));
      inpMin.value = min;
      inpMax.value = max;
      const previas = new Map(qsa(".nivel-card", listaNiveles).map(c => [Number(c.dataset.nivel), leerNivelObjetoCard(c)]));
      let html = "";
      for (let n = min; n <= max; n++) html += nivelObjetoCardHTML(n, previas.get(n) || {});
      listaNiveles.innerHTML = html;
      if (inpVenta) {
        inpVenta.min = min;
        inpVenta.max = max;
        inpVenta.value = Math.max(min, Math.min(max, parseInt(inpVenta.value, 10) || min));
      }
    };

    chkActivo?.addEventListener("change", () => {
      contNivelesReceta.hidden = !chkActivo.checked;
      if (chkActivo.checked && !qsa(".nivel-card", listaNiveles).length) refrescarNivelesReceta();
    });
    inpMin?.addEventListener("change", refrescarNivelesReceta);
    inpMax?.addEventListener("change", refrescarNivelesReceta);
    chkAzar?.addEventListener("change", () => {
      if (!chkOculto) return;
      chkOculto.disabled = !chkAzar.checked;
      if (!chkAzar.checked) chkOculto.checked = false;
    });
  }

  // [UNDAVAR-PARTE-10.7-GLADIADOR] Habilidades del arma: selector y una tarjeta a la vista
  // [UNDAVAR-PARTE-10.7-CONSISTENCIA] Añade el selector y los niveles por habilidad
  const contHabsReceta = formReceta?.querySelector("[data-tr-habilidades]");
  const contNivHabsReceta = formReceta?.querySelector("[data-tr-niveles-hab]");
  const selHabsReceta = formReceta?.querySelector("#tr-hab-selector");
  const selNivHabsReceta = formReceta?.querySelector("#tr-hab-nivel-selector");
  const activarHabReceta = (habId) => {
    if (!habId || !contHabsReceta || !formReceta) return;
    qsa(".hab-selector-btn", formReceta).forEach(b => b.classList.toggle("activo", b.dataset.habId === habId));
    qsa(".habilidad-card", contHabsReceta).forEach(c => { c.style.display = c.dataset.habId === habId ? "" : "none"; });
    qsa(".niveles-hab", contNivHabsReceta || formReceta).forEach(g => { g.style.display = g.dataset.habId === habId ? "" : "none"; });
  };
  const refrescarSelectorHabsReceta = (activaId = "") => {
    if (!contHabsReceta) return;
    const lista = qsa(".habilidad-card", contHabsReceta).map(c => ({
      id: c.dataset.habId,
      nombre: qs(".hab-nombre", c)?.value.trim() || "Habilidad"
    }));
    const activaPrevia = formReceta?.querySelector(".hab-selector-btn.activo")?.dataset.habId || "";
    const activa = activaId || (lista.some(h => h.id === activaPrevia) ? activaPrevia : "") || lista[0]?.id || "";
    [selHabsReceta, selNivHabsReceta].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = lista
        .map(h => `<button type="button" class="hab-selector-btn ${h.id === activa ? "activo" : ""}" data-hab-id="${esc(h.id)}">${esc(h.nombre)}</button>`)
        .join("");
    });
    activarHabReceta(activa);
  };

  fondo.addEventListener("click", async e => {
    if (e.target === fondo) { cerrar(); return; }

    // [UNDAVAR-PARTE-9.5C-RECETAS] Elegir una sugerencia de material
    const sug = e.target.closest("[data-sugerencia]");
    if (sug) {
      const caja = sug.closest(".taller-sugerir");
      const input = caja?.querySelector(".taller-ing-nombre");
      if (input) { input.value = sug.dataset.sugerencia; input.focus(); }
      if (caja) caja.querySelector(".taller-sugerencias").hidden = true;
      return;
    }
    // [UNDAVAR-PARTE-9.5C-RECETAS] Reabre la lista al pulsar el propio campo
    if (e.target.classList.contains("taller-ing-nombre")) {
      tallerMostrarSugerencias(e.target, actor);
      return;
    }

    // [UNDAVAR-PARTE-9.5C-RECETAS] El clic dentro del buscador no cierra su propia lista
    if (!e.target.closest(".taller-sugerir")) {
      fondo.querySelectorAll(".taller-sugerencias").forEach(p => p.hidden = true);
    }

    // [UNDAVAR-PARTE-10.7-GLADIADOR] Pestañas del formulario de receta
    const tabReceta = e.target.closest("[data-tr-tab]");
    if (tabReceta) {
      activarPanelReceta(tabReceta.dataset.trTab);
      return;
    }

    // [UNDAVAR-PARTE-10.7-GLADIADOR] Cambia la habilidad visible del arma
    if (e.target.closest("#tr-hab-selector .hab-selector-btn") || e.target.closest("#tr-hab-nivel-selector .hab-selector-btn")) {
      activarHabReceta(e.target.closest(".hab-selector-btn").dataset.habId);
      return;
    }
    if (e.target.closest("[data-tr-add-hab]")) {
      const nueva = {
        id: nuevoId(),
        nombre: `Habilidad ${qsa(".habilidad-card", contHabsReceta).length + 1}`,
        modoUso: "dano", descripcion: "", conjuro: "",
        efectoMecanico: null, condiciones: [], bonos: [], aplicaEfecto: false,
        requisito: {}, variacionesNivel: []
      };
      contHabsReceta?.insertAdjacentHTML("beforeend", habilidadCardHTML(nueva, false));
      // [UNDAVAR-PARTE-10.7-CONSISTENCIA] Su grupo de niveles también se añade
      contNivHabsReceta?.insertAdjacentHTML("beforeend", grupoNivelesHabilidadHTML(nueva, false));
      refrescarSelectorHabsReceta(nueva.id);
      return;
    }
    if (e.target.closest("[data-tr-habilidades] .hab-duplicar")) {
      const card = e.target.closest(".habilidad-card");
      if (card) {
        const copia = leerHabilidadCard(card);
        copia.id = nuevoId();
        copia.nombre = `${copia.nombre || "Habilidad"} (copia)`;
        const grupo = contNivHabsReceta?.querySelector(`.niveles-hab[data-hab-id="${card.dataset.habId}"]`);
        copia.variacionesNivel = grupo ? qsa(".nivel-card", grupo).map(leerNivelCard) : [];
        contHabsReceta?.insertAdjacentHTML("beforeend", habilidadCardHTML(copia, false));
        contNivHabsReceta?.insertAdjacentHTML("beforeend", grupoNivelesHabilidadHTML(copia, false));
        refrescarSelectorHabsReceta(copia.id);
      }
      return;
    }
    if (e.target.closest("[data-tr-habilidades] .hab-eliminar")) {
      const card = e.target.closest(".habilidad-card");
      if (card) {
        if (qsa(".habilidad-card", contHabsReceta).length <= 1) {
          notificar("⚠️ El arma necesita al menos una habilidad.");
        } else {
          const idHab = card.dataset.habId;
          card.remove();
          contNivHabsReceta?.querySelector(`.niveles-hab[data-hab-id="${idHab}"]`)?.remove();
          refrescarSelectorHabsReceta();
        }
      }
      return;
    }
    if (e.target.closest("[data-tr-habilidades] .hab-add-bono")) {
      const card = e.target.closest(".habilidad-card");
      card?.querySelector(".hab-bonos-lista")?.insertAdjacentHTML("beforeend", filaBonoHTML({}));
      return;
    }
    if (e.target.closest("[data-tr-habilidades] .bono-quitar")) {
      e.target.closest(".bono-fila")?.remove();
      return;
    }

    // [UNDAVAR-PARTE-10.7-RECETAS-TIPO] Bonos dentro de un nivel del objeto
    if (e.target.closest(".nivel-add-bono")) {
      const card = e.target.closest(".nivel-card");
      card?.querySelector(".nivel-bonos-lista")?.insertAdjacentHTML("beforeend", filaBonoHTML({}));
      return;
    }
    if (e.target.closest(".nivel-card .bono-quitar")) {
      e.target.closest(".bono-fila")?.remove();
      return;
    }

    // [UNDAVAR-PARTE-9.5C-RECETAS] Añadir o quitar bonos del efecto
    if (e.target.closest("[data-tr-add-bono]")) {
      fondo.querySelector("[data-tr-bonos]")?.insertAdjacentHTML("beforeend", filaBonoHTML({}));
      return;
    }
    if (e.target.closest("[data-tr-bonos] .bono-quitar")) {
      e.target.closest(".bono-fila")?.remove();
      return;
    }

    // Mostrar u ocultar el formulario de receta inventada
    if (e.target.closest("[data-taller-nueva]")) {
      const form = fondo.querySelector("[data-taller-form]");
      if (form) {
        form.hidden = !form.hidden;
        if (!form.hidden) form.querySelector("[data-tr-nombre]")?.focus();
      }
      return;
    }

    // Añadir o quitar filas de materiales
    if (e.target.closest("[data-taller-add-ing]")) {
      fondo.querySelector("[data-tr-ingredientes]")?.insertAdjacentHTML("beforeend", tallerIngredienteHTML());
      return;
    }
    if (e.target.closest("[data-ing-quitar]")) {
      const filas = fondo.querySelectorAll(".taller-ing-fila");
      if (filas.length > 1) e.target.closest(".taller-ing-fila")?.remove();
      return;
    }

    if (e.target.closest("[data-taller-cancelar]")) {
      const form = fondo.querySelector("[data-taller-form]");
      if (form) form.hidden = true;
      return;
    }

    // Guardar receta propia
    if (e.target.closest("[data-taller-guardar]")) {
      const q = sel => fondo.querySelector(sel);
      const tipoReceta = q("[data-tr-tipo-receta]")?.value || "";
      if (!TIPOS_RECETA[tipoReceta]) {
        notificar("⚠️ Elige primero el tipo de receta.");
        return;
      }
      const nombre = q("[data-tr-nombre]")?.value.trim() || "";
      const oficio = q("[data-tr-oficio]")?.value || "";
      const descripcion = q("[data-tr-desc]")?.value.trim() || "";
      // [UNDAVAR-PARTE-10.7-CIERRE] El arma de gladiador no usa texto de efecto propio
      const efecto = tipoReceta === "arma_gladiador" ? "" : (q("[data-tr-efecto]")?.value.trim() || "");
      const duracion = tipoReceta === "arma_comun"
        ? (q("[data-tr-duracion-comun]")?.value.trim() || "")
        : ["objeto", "elixir", "alimento"].includes(tipoReceta)
          ? (q("[data-tr-duracion]")?.value.trim() || "")
          : "";
      // [UNDAVAR-PARTE-10.7-ARMA-EQUIPO] Cada tipo lee su propio enfriamiento
      const selEnfriamiento = tipoReceta === "arma_gladiador" ? "[data-tr-enfriamiento-arma]"
        : tipoReceta === "arma_comun" ? "[data-tr-enfriamiento-comun]"
        : tipoReceta === "equipo" ? "[data-tr-enfriamiento-equipo]"
        : "[data-tr-enfriamiento]";
      const enfriamientoTurnos = Math.max(0, parseInt(q(selEnfriamiento)?.value, 10) || 0);
      const consumible = ["objeto", "elixir", "alimento"].includes(tipoReceta)
        ? !!q("[data-tr-consumible]")?.checked
        : false;
      // [UNDAVAR-PARTE-10.7-ARMA-EQUIPO] Ranura y reducción del equipo
      const slotEquipo = tipoReceta === "equipo" ? (q("[data-tr-slot]")?.value || "superior") : "";
      const reduccionDano = tipoReceta === "equipo"
        ? Math.max(0, parseFloat(q("[data-tr-reduccion]")?.value) || 0)
        : 0;
      // [UNDAVAR-PARTE-10.8-RECETA-SIN-OFICIO] El oficio es opcional
      if (!nombre) {
        notificar("⚠️ La receta necesita un nombre.");
        return;
      }
      const mapa = new Map();
      for (const fila of fondo.querySelectorAll(".taller-ing-fila")) {
        const n = fila.querySelector(".taller-ing-nombre")?.value.trim() || "";
        const c = Math.max(1, Number(fila.querySelector(".taller-ing-cant")?.value) || 1);
        if (!n) continue;
        const clave = n.toLowerCase();
        mapa.set(clave, { nombre: n, cantidad: (mapa.get(clave)?.cantidad || 0) + c });
      }

      // [UNDAVAR-PARTE-9.5C-RECETAS] Efecto mecánico y bonos de la pestaña Efecto
      const campos = {};
      CAMPOS_EFECTO.forEach(k => {
        const campo = {
          valor: Number(q(`.tr-ef-${k}-valor`)?.value) || 0,
          modo: q(`.tr-ef-${k}-modo`)?.value === "pct" ? "pct" : "fijo",
          cuando: q(`.tr-ef-${k}-cuando`)?.value === "turno" ? "turno" : "inmediato"
        };
        if (["hambre", "sed", "cansancio", "fatiga"].includes(k)) {
          campo.signo = q(`.tr-ef-${k}-signo`)?.value === "aplicar" ? "aplicar" : "quitar";
        }
        campos[k] = campo;
      });
      // [UNDAVAR-PARTE-10.7-CONSISTENCIA] El equipo no guarda efecto mecánico (como el editor)
      // [UNDAVAR-PARTE-10.7-CIERRE] El arma de gladiador lleva su efecto en cada habilidad
      const tieneEf = !["equipo", "arma_gladiador"].includes(tipoReceta)
        && CAMPOS_EFECTO.some(k => Number(campos[k].valor) > 0);
      const efectoMecanico = tieneEf ? {
        definido: true,
        objetivo: q("[data-tr-ef-objetivo]")?.value || "ambos",
        turnos: Math.max(0, Number(q("[data-tr-ef-turnos]")?.value) || 0),
        campos
      } : null;
      const bonos = tipoReceta === "arma_gladiador" ? [] : [...fondo.querySelectorAll("[data-tr-bonos] .bono-fila")].map(f => ({
        estadistica: f.querySelector(".bono-estadistica")?.value || "aciertos",
        valor: Number(f.querySelector(".bono-valor")?.value) || 0,
        modo: f.querySelector(".bono-modo")?.value === "pct" ? "pct" : "fijo",
        turnos: Math.max(1, Number(f.querySelector(".bono-turnos")?.value) || 1),
        acumulativo: !!f.querySelector(".bono-acumulativo")?.checked
      })).filter(b => b.valor > 0);

      // [UNDAVAR-PARTE-10.7-RECETAS-TIPO] Niveles del objeto configurados
      // [UNDAVAR-PARTE-10.7-CIERRE] Solo las plantillas de objeto guardan niveles
      const nivelesActivo = ["objeto", "elixir", "alimento", "arma_comun"].includes(tipoReceta)
        && !!q("[data-tr-niveles-activo]")?.checked;
      let niveles = null;
      if (nivelesActivo) {
        const min = Math.max(1, Math.min(99, parseInt(q("[data-tr-nivel-min]")?.value, 10) || 1));
        const max = Math.max(min, Math.min(99, parseInt(q("[data-tr-nivel-max]")?.value, 10) || min));
        const venta = Math.max(min, Math.min(max, parseInt(q("[data-tr-nivel-venta]")?.value, 10) || min));
        const aleatorio = !!q("[data-tr-nivel-azar]")?.checked;
        niveles = {
          activo: true, min, max, venta, aleatorio,
          oculto: aleatorio && !!q("[data-tr-nivel-oculto]")?.checked,
          variaciones: qsa("[data-tr-niveles-lista] .nivel-card", fondo).map(leerNivelObjetoCard)
        };
      }

      // [UNDAVAR-PARTE-10.7-GLADIADOR] Nivel y habilidades del arma de gladiador
      let nivelArma = 0;
      let habilidades = [];
      if (tipoReceta === "arma_gladiador") {
        nivelArma = Math.max(0, Math.min(4, parseInt(q("[data-tr-nivel-arma]")?.value, 10) || 0));
        habilidades = qsa("[data-tr-habilidades] .habilidad-card", fondo).map((card, i) => {
          const h = leerHabilidadCard(card);
          // [UNDAVAR-PARTE-10.7-CONSISTENCIA] Niveles de cada habilidad, como en el editor
          const grupo = contNivHabsReceta?.querySelector(`.niveles-hab[data-hab-id="${card.dataset.habId}"]`);
          h.variacionesNivel = grupo ? qsa(".nivel-card", grupo).map(leerNivelCard) : [];
          if (!h.nombre) h.nombre = `${nombre} · Habilidad ${i + 1}`;
          return h;
        });
      }

      const recetas = await cargarRecetasCustom();
      recetas.push({
        id: `custom_${nuevoId()}`,
        nombre, oficio,
        tipoReceta,
        tipo: tipoItemDeReceta(tipoReceta),
        descripcion, efecto, duracion, enfriamientoTurnos, consumible,
        efectoMecanico, bonos, niveles, nivelArma, habilidades,
        slot: slotEquipo, reduccionDano,
        ingredientes: [...mapa.values()],
        custom: true
      });
      await guardarRecetasCustom(recetas);
      notificar(`📜 Receta «${nombre}» guardada.`);
      await reabrir(scrollCaja());
      return;
    }

    // Borrar receta inventada
    const borrar = e.target.closest("[data-receta-borrar]");
    if (borrar) {
      const receta = custom.find(r => r.id === borrar.dataset.recetaBorrar);
      if (!receta) return;
      const ok = await confirmarAccion("Borrar receta", `¿Borrar la receta «${receta.nombre}»?`, "Borrar");
      if (!ok) return;
      const recetas = (await cargarRecetasCustom()).filter(r => r.id !== receta.id);
      await guardarRecetasCustom(recetas);
      notificar(`🗑️ Receta «${receta.nombre}» borrada.`);
      await reabrir(scrollCaja());
      return;
    }

    // Elaborar
    const btn = e.target.closest("[data-receta-elaborar]");
    if (!btn) return;
    const recetaId = btn.dataset.recetaElaborar;
    const receta = todas.find(r => r.id === recetaId);
    if (!receta) return;
    const encantoId = fondo.querySelector(`[data-encanto-receta="${recetaId}"]`)?.value || "";
    btn.disabled = true;
    const scroll = scrollCaja();
    const ok = await elaborarReceta(actor, receta, encantoId);
    if (!ok) { btn.disabled = false; return; }
    await reabrir(scroll);
  });

  // [UNDAVAR-PARTE-9.5C-RECETAS] Sugerencias al escribir o enfocar el material
  fondo.addEventListener("input", e => {
    if (e.target.classList.contains("taller-ing-nombre")) tallerMostrarSugerencias(e.target, actor);
    // [UNDAVAR-PARTE-10.8.3-BUSCADOR-OFICIO] Filtra el selector de oficio mientras se escribe
    if (e.target.matches("[data-tr-oficio-busca]")) {
      tallerFiltrarOficios(e.target.closest("label")?.querySelector("[data-tr-oficio]"), e.target.value);
    }
    // [UNDAVAR-PARTE-10.7-GLADIADOR] El botón del selector sigue al nombre de la habilidad
    if (e.target.classList.contains("hab-nombre") && e.target.closest("[data-tr-habilidades]")) {
      refrescarSelectorHabsReceta();
    }
  });
  fondo.addEventListener("focusin", e => {
    if (e.target.classList.contains("taller-ing-nombre")) tallerMostrarSugerencias(e.target, actor);
  });
  // [UNDAVAR-PARTE-9.5C-RECETAS] La lista flotante se cierra al desplazar el modal
  const ocultarSugerencias = () => {
    fondo.querySelectorAll(".taller-sugerencias").forEach(p => p.hidden = true);
  };
  fondo.querySelector(".modal-caja")?.addEventListener("scroll", ocultarSugerencias, { passive: true });
}

function tabEstado(actor, esPJ = false, store = esPJ ? "personajes" : "npcs") {
  const ext = actor.system.extensionEstado || { hambre: { value: 0 }, sed: { value: 0 }, cansancio: { value: 0 }, fatiga: { value: 0 } };
  const pm = actor.system.puntosYMarcas || { po: { estado: "I", value: 0 }, pol: { estado: "I", value: 0 }, marcaControl: { estado: "I", value: 0 } };
  // [UNDAVAR-PARTE-4.2c-VITAL] PE disponibles para curar heridas o subir salud
  const pe = Number(actor.system.pdc?.pe) || 0;
  // [UNDAVAR-PARTE-4.2d-EFECTOS] Efectos que se resuelven en el turno siguiente
  const pendientes = Array.isArray(actor.system.efectosPendientes) ? actor.system.efectosPendientes : [];
  // [UNDAVAR-PARTE-4.2e3-TURNO] Enfriamientos activos del personaje
  const enfriamientos = Array.isArray(actor.system.enfriamientos) ? actor.system.enfriamientos : [];
  // [UNDAVAR-PARTE-4.2e4-BONOS] Bonos temporales activos
  const bonosActivos = Array.isArray(actor.system.bonosActivos) ? actor.system.bonosActivos : [];
  // [UNDAVAR-PARTE-4.2e5-ARTES] Condiciones automáticas activas
  const condiciones = Array.isArray(actor.system.condiciones) ? actor.system.condiciones : [];
  const hayTurno = pendientes.length > 0 || enfriamientos.length > 0 || bonosActivos.length > 0 || condiciones.length > 0;

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
      <li>Debe de saber que por cada dos puntos de hambre, sed, cansancio o fatiga se marcará uno de Pt. Herida (sube la herida). Curar el estado no quita las heridas ya marcadas.</li>
      <li>Las acciones de ataques de habilidad y/o arma 3 de nivel 4 empiezan el conflicto con un +2 de victoria, lo mismo para defensa.</li>
      <li>En puntos y marca en el primer cuadro deberá marcar <b>A (Activo)</b> cuando estos estén en conflicto e <b>I (Inactivo)</b> cuando no lo estén.</li>
    </ul>
  </div>

  ${esPJ ? `
  <div class="ref-bloque" style="margin-top: 15px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(212, 175, 55, 0.3); padding: 15px; border-radius: 6px;">
    <div class="bloque-titulo">Puntos de Esencia (PE)</div>
    <p class="bloque-hint">PE disponibles: <b>${pe}</b>. 9 PE = −1 Pt. Herida o +1 Pt. Salud. Reducir la última herida sube la Salud como mucho a la mitad; para pasar de ahí usa +1 Pt. Salud.</p>
    <div class="estado-vital-acciones">
      <button class="btn-secundario chico" id="btn-pe-herida" ${pe < 9 ? "disabled" : ""}>9 PE → −1 Pt. Herida</button>
      <button class="btn-secundario chico" id="btn-pe-salud" ${pe < 9 ? "disabled" : ""}>9 PE → +1 Pt. Salud</button>
    </div>
  </div>` : ""}

  <div class="ref-bloque" style="margin-top: 15px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(212, 175, 55, 0.3); padding: 15px; border-radius: 6px;">
    <div class="bloque-titulo">Restauración completa</div>
    <p class="bloque-hint">Cura toda la Salud, quita heridas, marcas, condiciones, bonos, enfriamientos y recarga PA.</p>
    <button class="btn-secundario chico" id="btn-restaurar-completo">Restaurar por completo</button>
  </div>

  <div class="ref-bloque" style="margin-top: 15px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(212, 175, 55, 0.3); padding: 15px; border-radius: 6px;">
    <div class="bloque-titulo">Bonos activos</div>
    ${bonosActivos.length
      ? bonosActivos.map(b => `<div class="campo-fila"><label>${esc(b.nombre)}</label><span>${esc(etiquetaEstadistica(b.estadistica))} ${Number(b.valor) || 0}${b.modo === "pct" ? "%" : ""} · ${b.pasivo ? "Pasivo" : `${Number(b.turnos) || 0} turno(s)`}</span></div>`).join("")
      : `<p class="bloque-hint">Sin bonos activos.</p>`}
  </div>

  ${hayTurno ? `
  <div class="ref-bloque" style="margin-top: 15px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(212, 175, 55, 0.3); padding: 15px; border-radius: 6px;">
    <div class="bloque-titulo">Turno pendiente</div>
    ${pendientes.length ? `
      <div class="turno-subtitulo">Efectos pendientes</div>
      ${pendientes.map(p => {
        // [UNDAVAR-PARTE-4.2e2-EFECTOS] Texto del pendiente nuevo o del antiguo
        const texto = p.campos
          ? describirEfectoMecanico({ campos: p.campos, turnos: p.turnos })
          : `${Number(p.valor) || 0}%`;
        return `<div class="campo-fila"><label>${esc(p.nombre)}</label><span>${esc(texto)} · ${Number(p.turnos) || 0} turno(s)</span></div>`;
      }).join("")}` : ""}
    ${condiciones.length ? `
      <div class="turno-subtitulo">Condiciones</div>
      ${condiciones.map(c => `<div class="campo-fila"><label>${esc(c.nombre)}</label><span>${Number(c.turnos) || 0} turno(s)</span></div>`).join("")}` : ""}
    ${enfriamientos.length ? `
      <div class="turno-subtitulo">Enfriamientos</div>
      ${enfriamientos.map(e => `<div class="campo-fila"><label>${esc(e.nombre)}</label><span>${esc(describirEnfriamiento(e))}</span></div>`).join("")}` : ""}
    <button class="btn-secundario chico" id="btn-pasar-turno">Pasar turno</button>
  </div>` : ""}`;
}

// [UNDAVAR-PARTE-4.2c-VITAL] Gasto de PE del PJ: 9 PE por herida o por salud
function wirePE(actor) {
  qs("#btn-pe-herida")?.addEventListener("click", async () => {
    if (!actor.system.pdc) actor.system.pdc = {};
    const pe = Number(actor.system.pdc.pe) || 0;
    const heridas = Math.min(8, Number(actor.system.estado?.ptHerida?.value) || 0);
    if (pe < 9) { notificar("⚠️ Necesitas 9 PE."); return; }
    if (heridas <= 0) { notificar("⚠️ No tiene heridas que reducir."); return; }

    actor.system.pdc.pe = pe - 9;
    // [UNDAVAR-PARTE-4.2d-EFECTOS] Si reduce la última herida, la Salud sube a la mitad
    const curacion = curarHeridas(actor, 1);
    sincronizarEstadoVital(actor);
    await dbPut("personajes", actor);
    notificar(`✨ 9 PE → ${actor.nombre} baja a ${heridas - 1} Pt. Herida.${curacion.subidaSalud ? ` La Salud sube a la mitad (+${curacion.subidaSalud}).` : ""}`);
    render();
  });

  qs("#btn-pe-salud")?.addEventListener("click", async () => {
    if (!actor.system.pdc) actor.system.pdc = {};
    const pe = Number(actor.system.pdc.pe) || 0;
    const limite = calcularDerivados(actor.system, actor.items).saludLimiteActual;
    const salud = Number(actor.system.estado?.ptSalud?.value) || 0;
    if (pe < 9) { notificar("⚠️ Necesitas 9 PE."); return; }
    if (salud >= limite) { notificar("⚠️ La salud ya está al máximo."); return; }

    actor.system.pdc.pe = pe - 9;
    actor.system.estado.ptSalud.value = Math.min(limite, salud + 1);
    sincronizarEstadoVital(actor);
    await dbPut("personajes", actor);
    notificar(`✨ 9 PE → ${actor.nombre} sube a ${actor.system.estado.ptSalud.value} de salud.`);
    render();
  });
}

// [UNDAVAR-PARTE-3.9] Criterio único de equipo para PJ y PNJ
function estaEquipado(it) {
  if (!it) return false;
  if (it.type === "equipo") return it.system?.equipado !== false;
  return !!it.system?.equipado;
}

function tabEquipo(actor) {
  // [UNDAVAR-PARTE-3.9] Incluye tipo "equipo" y objetos/armas con equipado
  // [UNDAVAR-PARTE-4.2e4c-USO-EQUIPO] Muestra Usar en objetos equipados con efecto o bonos
  const equipados = (actor.items || []).filter(estaEquipado);

  return `
    <div class="seccion-acciones">
      <button class="btn-secundario" id="btn-equipar-desde-inv">+ Equipar desde Inventario</button>
    </div>
    <div class="items-lista">
      ${equipados.map(it => {
        // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Artes y armas equipadas usan el flujo de arte
        // [UNDAVAR-PARTE-10.4-ARMAS] El arma común equipada usa el flujo de objeto
        const esArte = it.type === "arte" || (it.type === "arma" && !esArmaComun(it));
        const ef = efectoMecanicoItem(it);
        const puede = itemTieneUso(it);
        const tituloUso = esArte ? "Usar (elige habilidad)" : `Usar: ${esc(ef ? describirEfectoMecanico(ef) : describirBonosItem(it))}`;
        const botonUso = !puede ? "" : esArte
          ? `<button class="btn-secundario chico btn-icono btn-usar-arte" data-id="${it.id}" ${it.system.entrenando ? "disabled" : ""} title="${it.system.entrenando ? "En entrenamiento: no se puede usar todavía" : tituloUso}" aria-label="Usar"><span data-icono="usar"></span></button>`
          : `<button class="btn-secundario chico btn-icono btn-usar-item" data-id="${it.id}" title="${tituloUso}" aria-label="Usar"><span data-icono="usar"></span></button>`;
        return `
      <div class="item-fila" data-item-id="${it.id}">
        <span class="item-nombre">${esc(it.name)}</span>
        <span class="item-badge">${esc(it.system.slot || 'Equipado')}</span>
        ${it.system.reduccion_dano ? `<span class="item-badge">-${it.system.reduccion_dano} dmg</span>` : ""}
        <div class="item-botones">
          ${botonUso}
          <button class="btn-secundario chico btn-desequipar-item" data-id="${it.id}" title="Volver a la mochila">Quitar</button>
        </div>
      </div>`;
      }).join("") || `<p class="vacio">No tienes nada equipado.</p>`}
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

// [UNDAVAR-PARTE-3.9] Equipo reutilizable por PJ y PNJ
function wireEquipoFicha(actor, store) {
  const btnEquipar = qs("#btn-equipar-desde-inv");
  if (btnEquipar) {
    btnEquipar.addEventListener("click", () => {
      const disponibles = (actor.items || []).filter(
        i => (i.type === "objeto" || i.type === "arma" || i.type === "equipo") && !estaEquipado(i)
      );

      if (disponibles.length === 0) {
        notificar("⚠️ No hay objetos desequipados en el inventario.");
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
            <h3 style="margin-top:0;">🛡️ Equipar objetos</h3>
            <p style="font-size:0.9em; color:#aaa;">Selecciona todos los objetos que deseas equipar:</p>
            <div style="max-height: 250px; overflow-y: auto; margin: 15px 0; padding-right: 5px;">
              ${listaHtml}
            </div>
            <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:15px;">
              <button id="btn-cancelar-equipar" class="btn-secundario">Cancelar</button>
              <button id="btn-confirmar-equipar" class="btn-primario">Equipar seleccionados</button>
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

        await dbPut(store, actor);
        document.querySelector(".modal-backdrop").remove();
        notificar(`🛡️ Se equiparon ${equipadosContador} objeto(s) correctamente.`);
        render();
      });
    });
  }

  qsa(".btn-desequipar-item").forEach(btn => {
    btn.addEventListener("click", async e => {
      const id = e.target.closest(".btn-desequipar-item")?.dataset.id || e.target.dataset.id;
      const item = actor.items.find(i => i.id === id);
      if (item) {
        if (!item.system) item.system = {};
        item.system.equipado = false;
        await dbPut(store, actor);
        render();
      }
    });
  });
}

function wireFicha(actor, calc) {
  qs("#btn-volver").addEventListener("click", () => ir("inicio"));
  // [UNDAVAR-PARTE-9.3B-LISTA] Vuelve a la lista de personajes
  qs("#btn-volver-lista").addEventListener("click", () => ir("ficha", { personajeId: null }));
  qs("#btn-exportar-actor").addEventListener("click", () => exportarPerfil("personajes", actor.id).catch(e => notificar("Error al exportar: " + (e.message || e))));
  // [UNDAVAR-PARTE-10.5C-MODO] Cambia entre la ficha de lectura y la edición
  const btnModoDatos = qs("#btn-modo-datos");
  if (btnModoDatos) {
    btnModoDatos.addEventListener("click", () => {
      state.modoDatos = btnModoDatos.dataset.modo === "vista" ? "vista" : "edicion";
      render();
    });
  }
  // [UNDAVAR-PARTE-10.6-TRANSFERENCIAS] Transferencia de Erianas desde la ficha del PJ
  qs("#btn-transferir-erianas")?.addEventListener("click", () =>
    abrirModalTransferirErianasFicha("personajes", actor.id).catch(e => notificar("Error al transferir: " + (e.message || e))));
  // [UNDAVAR-PARTE-4.2g] Revisión opcional de fichas antiguas
  qs("#btn-revisar-ficha")?.addEventListener("click", () => abrirRevisionFicha(actor));
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

  qs("#campo-nombre")?.addEventListener("change", async e => { actor.nombre = e.target.value; await dbPut("personajes", actor); });

  // [UNDAVAR-PARTE-9.3-SIERVOS] Abrir, marcar en uso y pagar a los siervos
  qsa("[data-siervo-abrir]").forEach(b => b.addEventListener("click", () =>
    ir("npc", { npcId: b.dataset.siervoAbrir, subtabNPC: "siervo" })));

  qsa("[data-siervo-uso]").forEach(chk => chk.addEventListener("change", async () => {
    const n = await dbGet("npcs", chk.dataset.siervoUso);
    if (!n) return;
    const sv = siervoDe(n);
    sv.enUso = chk.checked;
    n.system.datos.siervo = sv;
    await dbPut("npcs", n);
    notificar(chk.checked
      ? `🐾 ${n.nombre || "Siervo"} en uso: ganas el doble de PV.`
      : `${n.nombre || "Siervo"} ya no está en uso.`);
    render();
  }));

  qsa("[data-siervo-pagar]").forEach(b => b.addEventListener("click", async () => {
    const n = await dbGet("npcs", b.dataset.siervoPagar);
    if (!n) return;
    const sv = siervoDe(n);
    if (!sv.salario) { notificar("⚠️ Ese sirviente no tiene salario. Tíralo en su ficha."); return; }
    // [UNDAVAR-PARTE-10.6-ERIANAS-CAMBIO] El salario se valora en Erianas totales
    const total = totalErianasOro(actor.system.erianas);

    if (total < sv.salario) {
      const ok = await confirmarAccion("No hay Erianas suficientes",
        `${n.nombre || "El sirviente"} cuesta ${sv.salario} Oro y tienes ${total} en Erianas. Si no lo pagas, se retirará.`,
        "Que se retire");
      if (!ok) return;
      sv.amoId = "";
      sv.enUso = false;
      n.system.datos.siervo = sv;
      await dbPut("npcs", n);
      notificar("El sirviente se ha retirado.");
      render();
      return;
    }

    actor.system.erianas = actor.system.erianas || { oro: 0, rubi: 0, diamante: 0 };
    descontarErianas(actor.system.erianas, sv.salario);
    // [UNDAVAR-PARTE-10.6-SALARIO] El salario entra en la cartera del PNJ
    n.system.erianas = n.system.erianas || { oro: 0, rubi: 0, diamante: 0 };
    n.system.erianas.oro = (Number(n.system.erianas.oro) || 0) + sv.salario;
    registrarMovimientoErianas(actor, `Salario de ${n.nombre || "su sirviente"}`, { oro: -sv.salario });
    registrarMovimientoErianas(n, `Salario pagado por ${actor.nombre || "su amo"}`, { oro: sv.salario });
    await dbPut("personajes", actor);
    sv.pagado = true;
    sv.ultimoPago = Date.now();
    n.system.datos.siervo = sv;
    await dbPut("npcs", n);
    await logTirada(actor, `<h4>Pago de sirviente</h4><p style="text-align:center">${esc(n.nombre || "Sirviente")}: <b>${sv.salario} Oro</b> pagados.</p>`, "personajes");
    notificar(`💰 Salario pagado a ${n.nombre || "el sirviente"}.`);
    render();
  }));
  // [UNDAVAR-PARTE-4.2d2] Refresco único de PV/PA/rango; todas las acciones lo llaman
  const actualizarRangoEnVivo = () => refrescarVitales(actor, calc);

  // [UNDAVAR-PARTE-3.4C] El PV se guarda sin repintar la ficha para no perder el foco al usar las flechas
  qs("#campo-pv").addEventListener("change", async e => {
    const valor = Number(e.target.value) || 0;
    await guardarCampo("system.pv.value", valor);
    const max = Number(e.target.max) || PV_MAXIMO;
    const medidor = e.target.closest(".ed-vital")?.querySelector(".ed-medidor i");
    if (medidor) medidor.style.width = `${Math.min(100, Math.round(valor / max * 100))}%`;
    actualizarRangoEnVivo(valor);
  });
  // [UNDAVAR-PARTE-3.6] La salud nunca supera el límite real por heridas y oficios
  qs("#campo-salud").addEventListener("change", async e => {
    const valor = Math.min(calc.saludLimiteActual, Math.max(0, Number(e.target.value) || 0));
    await guardarCampo("system.estado.ptSalud.value", valor);
    // [UNDAVAR-PARTE-4.2c-VITAL] Salud a 0 marca inconsciencia
    sincronizarEstadoVital(actor);
    await dbPut("personajes", actor);
    render();
  });
  // [UNDAVAR-PARTE-4.2d2] El PA se refleja al instante sin repintar la ficha
  qs("#campo-pa").addEventListener("change", async e => { await guardarCampo("system.pa.value", Number(e.target.value) || 0); refrescarVitales(actor, calc); });

  qsa(".campo-pdc").forEach(inp => inp.addEventListener("change", async e => {
    await guardarCampo(`system.pdc.${e.target.dataset.key}`, Number(e.target.value) || 0);
  }));
  // [UNDAVAR-PARTE-3.7] Campos de Erianas con expresiones: +20, -5, 100-10, 100 + 20 - 5
  // [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Cableado común de la cartera
  wireCarteraFicha(actor, guardarCampo);

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
        modAtributo = Math.floor(atributoEfectivo(actor, selAtr) / 2);
      }

      gastoPA = Math.max(0, parseInt(qs("#mod-input-pa")?.value) || 0);
      if (gastoPA > actor.system.pa.value) {
        notificar(`⚠️ No tienes suficientes PA. Disponibles: ${actor.system.pa.value}`);
        return;
      }
      modPA = gastoPA;

      tipoPdC = qs("#mod-select-pdc-tipo")?.value || "ninguno";
      gastoPdC = Math.max(0, parseInt(qs("#mod-input-pdc-cant")?.value) || 0);

      if (tipoPdC !== "ninguno" && gastoPdC > 0) {
        const saldoDisponible = Number(actor.system.pdc[tipoPdC]) || 0;
        if (gastoPdC > saldoDisponible) {
          notificar(`⚠️ No tienes suficientes ${tipoPdC.toUpperCase()}. Disponibles: ${saldoDisponible}`);
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
  // [UNDAVAR-PARTE-4.2c-VITAL] El botón Despertar aplica la regla de inconsciencia
  qs("#roll-despertar").addEventListener("click", () => intentarDespertar(actor, "personajes"));

  const btnRollErianas = qs("#btn-roll-erianas");
  if (btnRollErianas) btnRollErianas.addEventListener("click", async () => {
    const r = tiradaErianasIniciales();
    logTirada(`<h4>Erianas iniciales</h4>${dadosHTML(r.ds)}<p style="text-align:center">${r.suma} × 10 = <b>${r.total} Oro</b></p>`);
    await guardarCampo("system.erianas.oro", r.total);
    render();
  });
  const btnCalc = qs("#btn-calculadora");
  if (btnCalc) btnCalc.addEventListener("click", abrirCalculadoraErianas);

  // [UNDAVAR-PARTE-9.6-MATRIMONIO] Acciones del bloque de estado civil
  qs("#btn-casarse")?.addEventListener("click", () => abrirModalBoda(actor));
  qs("#btn-divorcio")?.addEventListener("click", () => abrirModalDivorcio(actor));

  // [UNDAVAR-PARTE-4.2d] Las artes/armas nuevas pasan por entrenamiento (Wonrixay)
  const btnNuevaArte = qs("#btn-nueva-arte");
  if (btnNuevaArte) btnNuevaArte.addEventListener("click", () => abrirModalEntrenamiento(actor, "arte", calc));
  const btnNuevaArma = qs("#btn-nueva-arma");
  if (btnNuevaArma) btnNuevaArma.addEventListener("click", () => abrirModalEntrenamiento(actor, "arma", calc));
  conectarEntrenamiento(actor, calc);
  const btnNuevoEquipo = qs("#btn-nuevo-equipo");
  if (btnNuevoEquipo) btnNuevoEquipo.addEventListener("click", () => abrirEditorItem(actor, "equipo"));

  qsa(".btn-editar-item").forEach(b => b.addEventListener("click", () => abrirEditorItem(actor, null, b.dataset.id)));
  // [UNDAVAR-PARTE-4.2d-EFECTOS] Usar objeto, elixir o alimento desde el inventario
  qsa(".btn-usar-item").forEach(b => b.addEventListener("click", () => abrirModalUsarItem(actor, "personajes", b.dataset.id)));
  qsa(".btn-borrar-item").forEach(b => b.addEventListener("click", async () => {
    const borrado = actor.items.find(i => i.id === b.dataset.id);
    // [UNDAVAR-PARTE-4.2f] Al eliminar un oficio se revierten sus bonos (los PD no se devuelven)
    if (borrado?.type === "oficio") {
      const revierte = !!borrado.system?.bonosAplicados;
      const ok = await confirmarAccion("Eliminar oficio", `Se eliminará "${borrado.name}"${revierte ? " y se quitarán sus bonos de atributos y PdC" : ""}. Los PD gastados no se devuelven.`, "Eliminar");
      if (!ok) return;
      if (revierte) aplicarBonosOficio(actor, borrado.system.bonos, -1);
    }
    actor.items = actor.items.filter(i => i.id !== b.dataset.id);
    await dbPut("personajes", actor);
    render();
  }));
  qsa(".btn-usar-arte").forEach(b => b.addEventListener("click", async () => {
    const it = actor.items.find(i => i.id === b.dataset.id);
    if (!it) return;
    // [UNDAVAR-PARTE-4.2d2] Un arte/arma en entrenamiento no se puede usar
    if (it.system.entrenando) { notificar(`🔒 "${it.name}" sigue en entrenamiento: reúne ${ACIERTOS_ENTRENAMIENTO} aciertos para usarla.`); return; }
    // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Enfriamiento del arte/arma
    const enfriamiento = (actor.system?.enfriamientos || []).find(e => e.itemId === it.id);
    if (enfriamiento) { notificar(`⏳ ${it.name} está en enfriamiento: ${describirEnfriamiento(enfriamiento)}.`); return; }

    // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Elige la habilidad antes de gastar PA
    const hab = await elegirHabilidad(it, actor);
    if (!hab) return;

    // [UNDAVAR-PARTE-4.2h2-PAREJA] La duplicación solo se lanza desde la mesa de combate
    if (hab.modoUso === "duplicar") {
      notificar("🧬 La duplicación solo se usa desde la mesa de combate.");
      return;
    }

    const nivel = Number(it.system.nivel) || 0;
    const costPA = costoPANivel(nivel);
    if (actor.system.pa.value < costPA) { notificar(`⚠️ PA insuficientes (necesitas ${costPA}, tienes ${actor.system.pa.value}).`); return; }

    // [UNDAVAR-PARTE-4.2h1b-SELLO] Las artes de daño con condiciones eligen objetivo
    // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] También cuando aplican efecto junto al daño
    const aplicaEfecto = hab.modoUso === "dano" && !!hab.aplicaEfecto;
    const necesitaObjetivo = hab.modoUso === "dano" &&
      (normalizarCondicionesArte(hab.condiciones).length > 0 || aplicaEfecto);
    const seleccionCond = necesitaObjetivo
      ? await elegirObjetivoYCondiciones(actor, "personajes", hab)
      : null;
    if (hab.modoUso === "dano" && normalizarCondicionesArte(hab.condiciones).length && !seleccionCond) return;
    if (aplicaEfecto && !seleccionCond) return;

    const atr = it.type === "arte" ? actor.system.atributos.inteligencia : actor.system.atributos.fuerza;
    const paAntes = actor.system.pa.value;

    actor.system.pa.value -= costPA;

    await dbPut("personajes", actor);

    // [UNDAVAR-PARTE-4.2e5-ARTES] Arte descriptiva o arte que aplica efecto
    if (hab.modoUso === "descriptiva") {
      iniciarEnfriamientoArte(actor, it, 1);
      logTirada(actor, resultadoArteDescriptivoHTML(it, nivel, costPA, paAntes, actor.system.pa.value, hab), "personajes");
      refrescarVitales(actor, calc);
      return;
    }
    if (hab.modoUso === "efecto") {
      await abrirModalUsarArte(actor, "personajes", it, hab);
      refrescarVitales(actor, calc);
      return;
    }

    // [UNDAVAR-PARTE-4.2h4m-ACUMULATIVO] Aplica el bono antes de tirar el daño
    let avisoAcumulado = "";
    if (Array.isArray(hab.bonos) && hab.bonos.length) {
      const nombreHab = hab.nombre ? `${it.name} — ${hab.nombre}` : it.name;
      const rBonos = aplicarBonosHabilidad(actor, it, hab, nombreHab, 1);
      await dbPut("personajes", actor);
      // [UNDAVAR-PARTE-4.2h1d-REGISTRO] Muestra el acumulado para que se vea en el registro
      if (hab.bonos.some(b => b.acumulativo)) {
        const total = (actor.system.bonosActivos || [])
          .filter(b => b.estadistica === "dano")
          .reduce((s, b) => s + (Number(b.valor) || 0), 0);
        avisoAcumulado = `<p class="roll-nota"><b>Acumulado:</b> +${total} daño en este golpe.</p>`;
        notificar(`⚔️ ${nombreHab}: +${total} daño acumulado.${avisoBonoRenovado(rBonos)}`);
      }
    }

    // [UNDAVAR-PARTE-4.2c] Desglose del daño y bono de aciertos del nivel
    const r = tiradaDanoNivel(nivel, atr, { rango: calc.rango });
    // [UNDAVAR-PARTE-4.2c5] Rebote del atacante herido (8/8) al usar arte/arma
    const rebote = aplicarReboteAtacanteHerido(actor);
    iniciarEnfriamientoArte(actor, it, 1);
    let htmlTirada = resultadoUsoArteHTML(it, nivel, costPA, paAntes, actor.system.pa.value, r, rebote, actor, hab);
    // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Aplica el efecto en la misma tirada de daño
    if (aplicaEfecto && seleccionCond) {
      const nombreHab = hab.nombre ? `${it.name} — ${hab.nombre}` : it.name;
      const esPropio = seleccionCond.store === "personajes" && seleccionCond.objetivo.id === actor.id;
      const objetivoEf = esPropio ? actor : seleccionCond.objetivo;
      const partesEf = await aplicarEfectoHabilidad(actor, "personajes", it, hab, objetivoEf, seleccionCond.store, nombreHab, seleccionCond.condiciones);
      if (partesEf.length) htmlTirada += `<p class="roll-nota"><b>Efecto aplicado:</b> ${esc(partesEf.join(" · "))}</p>`;
    }
    await logTirada(actor, htmlTirada + avisoAcumulado, "personajes");

    // [UNDAVAR-PARTE-4.2h1b-SELLO] Aplica al objetivo las condiciones marcadas
    // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Si el efecto combinado ya las aplicó, no se repiten
    if (seleccionCond && !aplicaEfecto) {
      const esPropio = seleccionCond.store === "personajes" && seleccionCond.objetivo.id === actor.id;
      const objetivoCond = esPropio ? actor : seleccionCond.objetivo;
      const aplicadas = aplicarListaCondiciones(objetivoCond, seleccionCond.condiciones);
      sincronizarEstadoVital(objetivoCond);
      await dbPut(seleccionCond.store, objetivoCond);
      if (aplicadas.length) notificar(`❄️ Condiciones en ${objetivoCond.nombre}: ${aplicadas.join(", ")}.`);
    }

    // [UNDAVAR-PARTE-4.2d2] Refresco en vivo de PA (panel lateral, campo, badge y barra)
    refrescarVitales(actor, calc);
  }));

  // [UNDAVAR-PARTE-4.2a] Subir/bajar nivel de un arte o arma
  qsa(".btn-nivel").forEach(b => b.addEventListener("click", async () => {
    const it = actor.items.find(i => i.id === b.dataset.id);
    if (!it) return;
    const nivel = Number(it.system.nivel) || 0;
    const nuevo = Math.max(0, Math.min(4, nivel + Number(b.dataset.delta)));
    if (nuevo === nivel) return;

    if (nuevo > nivel) {
      const coste = costoPVNivel(nuevo);
      const pv = Number(actor.system.pv?.value) || 0;
      if (pv < coste) {
        notificar(`⚠️ PV insuficientes: subir "${it.name}" a Nv.${nuevo} cuesta ${coste} PV y tienes ${pv}.`);
        return;
      }
      const ok = await confirmarAccion(
        "Subir nivel",
        `Subir "${it.name}" a Nv.${nuevo} cuesta ${coste} PV.\nTe quedarán ${pv - coste} PV y el rango puede bajar.`,
        "Subir"
      );
      if (!ok) return;
      actor.system.pv.value = pv - coste;
    } else {
      const ok = await confirmarAccion(
        "Bajar nivel",
        `Bajar "${it.name}" a Nv.${nuevo} no devuelve PV.`,
        "Bajar"
      );
      if (!ok) return;
    }

    // [UNDAVAR-PARTE-4.2e] Aviso si el gasto de PV cambia el rango
    const rangoAntesNivel = calc.rango;
    it.system.nivel = nuevo;
    await dbPut("personajes", actor);
    render();
    avisarCambioRango(rangoAntesNivel, calcularRango(Number(actor.system.pv?.value) || 0));
  }));

  // Oficios
  const oficioSelector = qs("#oficio-selector");
  const oficioPreview = qs("#oficio-preview");
  // [UNDAVAR-PARTE-10.8.4-BUSCADOR-OFICIO-FICHA] Filtra la lista de oficios disponibles
  const buscarOficio = qs("#buscar-oficio");
  // La ficha del oficio se muestra también al filtrar, no solo al cambiar a mano
  const mostrarPreviewOficio = (id) => {
    const d = OFICIOS_UNDAVAR.find(o => o.id === id);
    if (!d || !oficioPreview) { if (oficioPreview) oficioPreview.style.display = "none"; return; }
    oficioPreview.style.display = "";
    oficioPreview.innerHTML = `<div class="oficio-info-nombre">${d.nombre}</div><div class="oficio-info-desc">${d.descripcion}</div><ul>${d.facultades.map(f => `<li>${f}</li>`).join("")}</ul>`;
  };
  if (buscarOficio && oficioSelector) {
    const opcOficio = [...oficioSelector.options].map(o => ({ valor: o.value, texto: o.textContent }));
    const avisoOficio = qs("#oficio-sin-resultados");
    buscarOficio.addEventListener("input", () => {
      const q = mapaNormalizarTexto(buscarOficio.value).trim();
      const elegido = oficioSelector.value;
      // La opción vacía de «Selecciona un oficio» siempre está presente
      const lista = opcOficio.filter(o => !o.valor || !q || mapaNormalizarTexto(o.texto).includes(q));
      oficioSelector.innerHTML = lista
        .map(o => `<option value="${esc(o.valor)}">${esc(o.texto)}</option>`)
        .join("");
      // Se mantiene el elegido si sigue coincidiendo; si no, se muestra el primero
      const primero = lista.find(o => o.valor);
      if (!q) oficioSelector.value = "";
      else if (elegido && lista.some(o => o.valor === elegido)) oficioSelector.value = elegido;
      else oficioSelector.value = primero ? primero.valor : "";
      if (avisoOficio) avisoOficio.hidden = !q || lista.some(o => o.valor);
      mostrarPreviewOficio(oficioSelector.value);
    });
  }
  if (oficioSelector) oficioSelector.addEventListener("change", e => {
    const d = OFICIOS_UNDAVAR.find(o => o.id === e.target.value);
    if (!d || !oficioPreview) { if (oficioPreview) oficioPreview.style.display = "none"; return; }
    oficioPreview.style.display = "";
    oficioPreview.innerHTML = `<div class="oficio-info-nombre">${d.nombre}</div><div class="oficio-info-desc">${d.descripcion}</div><ul>${d.facultades.map(f => `<li>${f}</li>`).join("")}</ul>`;
  });
  const btnAgregarOficio = qs("#btn-agregar-oficio");
  if (btnAgregarOficio) btnAgregarOficio.addEventListener("click", async () => {
    const id = oficioSelector.value;
    if (!id) { notificar("⚠️ Selecciona un oficio primero."); return; }
    const d = OFICIOS_UNDAVAR.find(o => o.id === id);
    // [UNDAVAR-PARTE-4.2f] Reclamar un oficio cuesta 3 PD (los de logro son gratis) y aplica sus bonos
    const costo = d.logro ? 0 : COSTO_OFICIO_PD;
    const pd = Number(actor.system.pdc.pd) || 0;
    if (pd < costo) { notificar(`⚠️ Reclamar "${d.nombre}" cuesta ${costo} PD y tienes ${pd}.`); return; }
    const aviso = d.logro
      ? `"${d.nombre}" es un oficio de logro: no cuesta PD. Se aplicarán sus bonos.`
      : `"${d.nombre}" cuesta ${costo} PD (te quedarán ${pd - costo}) y se aplicarán sus bonos.\nSegún el manual, los oficios no elegidos al crear solo se consiguen por logros: confirma que el SR lo permite.`;
    const ok = await confirmarAccion("Reclamar oficio", aviso, "Reclamar");
    if (!ok) return;
    const it = itemPorDefecto("oficio", d.nombre);
    it.system = { oficioId: d.id, descripcion: d.descripcion, facultades: d.facultades.join(" "), puntos: costo, maximo: 7, logro: !!d.logro, bonos: d.bonos, bonosAplicados: true };
    actor.system.pdc.pd = pd - costo;
    aplicarBonosOficio(actor, d.bonos, 1);
    actor.items.push(it);
    await dbPut("personajes", actor);
    render();
  });
  qsa(".oficio-pts-input").forEach(inp => inp.addEventListener("change", async e => {
    const it = actor.items.find(i => i.id === e.target.dataset.id);
    if (!it) return;
    // [UNDAVAR-PARTE-4.2f] Cada punto de oficio extra se paga con 1 PD (bajar no devuelve PD)
    const previo = Number(it.system.puntos) || 0;
    const nuevo = Math.max(0, Math.min(7, parseInt(e.target.value) || 0));
    const extra = nuevo - previo;
    if (extra > 0) {
      const pd = Number(actor.system.pdc.pd) || 0;
      if (pd < extra) {
        notificar(`⚠️ Subir ${extra} punto(s) de oficio cuesta ${extra} PD y tienes ${pd}.`);
        e.target.value = previo;
        return;
      }
      actor.system.pdc.pd = pd - extra;
      notificar(`−${extra} PD gastado(s) en "${it.name}".`);
    }
    it.system.puntos = nuevo;
    await dbPut("personajes", actor);
    if (extra > 0) render();
  }));

  const btnRecargarPA = qs("#btn-recargar-pa");
  if (btnRecargarPA) {
    btnRecargarPA.addEventListener("click", async () => {
      actor.system.pa.value = calc.paMaximo;
      await dbPut("personajes", actor);
      refrescarVitales(actor, calc);
    });
  }

  qsa(".campo-ext-estado").forEach(inp => inp.addEventListener("change", async e => {
    const key = e.target.dataset.key;
    const valorNuevo = Math.max(0, Number(e.target.value) || 0);

    if (!actor.system.extensionEstado) actor.system.extensionEstado = {};
    actor.system.extensionEstado[key] = { value: valorNuevo };

    // [UNDAVAR-PARTE-3.6C] Cada 2 marcas suman +1 Pt. Herida, pero curar el estado no cura la herida
    const ext = actor.system.extensionEstado;
    const totalEstados = (Number(ext.hambre?.value) || 0) +
      (Number(ext.sed?.value) || 0) +
      (Number(ext.cansancio?.value) || 0) +
      (Number(ext.fatiga?.value) || 0);
    const nuevoBonus = Math.floor(totalEstados / 2);
    const bonusPrevio = Number(actor.system.estado.heridasCausadasPorEstado) || 0;

    // Solo se suman heridas nuevas; si el estado baja, las heridas ya ganadas se quedan
    if (nuevoBonus > bonusPrevio) {
      const delta = nuevoBonus - bonusPrevio;
      const heridaActual = Number(actor.system.estado.ptHerida?.value) || 0;
      actor.system.estado.ptHerida.value = Math.min(8, heridaActual + delta);
      actor.system.estado.heridasCausadasPorEstado = nuevoBonus;

      // [UNDAVAR-PARTE-3.6C] La salud se recorta cuando las heridas suben
      const derivados = calcularDerivados(actor.system, actor.items);
      const saludActual = Number(actor.system.estado.ptSalud?.value) || 0;
      if (saludActual > derivados.saludLimiteActual) {
        actor.system.estado.ptSalud.value = derivados.saludLimiteActual;
      }
    }

    // [UNDAVAR-PARTE-4.2c-VITAL] Revisa si el recorte dejó la salud en 0
    sincronizarEstadoVital(actor);
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
        // [UNDAVAR-PARTE-3.6B] El límite de salud usa el total real de heridas (incluye estados)
        const derivados = calcularDerivados(actor.system, actor.items);
        const saludActual = Number(actor.system.estado.ptSalud?.value) || 0;

        if (saludActual > derivados.saludLimiteActual) {
          actor.system.estado.ptSalud.value = derivados.saludLimiteActual;
        }
      }

      // [UNDAVAR-PARTE-4.2c-VITAL] Si el recorte deja la salud en 0, queda inconsciente
      sincronizarEstadoVital(actor);
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

  // [UNDAVAR-PARTE-3.9] Equipo compartido con la ficha de PNJ
  wireEquipoFicha(actor, "personajes");

  const btnLimpiarLog = qs("#btn-limpiar-log");
  if (btnLimpiarLog) {
    btnLimpiarLog.addEventListener("click", async () => {
      const ok = await confirmarAccion("Limpiar registro", "¿Limpiar todo el registro de tiradas de esta ficha?", "Limpiar");
      if (ok) {
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
  if (actual >= 9) { notificar("⚠️ Este atributo ya está al máximo (9)."); return; }
  const max = 9 - actual;
  // [UNDAVAR-PARTE-4.3f] Diálogo propio en vez de prompt()
  const modal = crearModal(`Mejorar ${atr.toUpperCase()}`, `
    <p class="nota">Cada punto cuesta 4 ${moneda.toUpperCase()}. Actual: ${actual}/9.</p>
    <div class="campo-fila"><label>Puntos a subir (máx. ${max})</label>
      <input type="number" id="mejora-cant" min="1" max="${max}" value="1">
    </div>
    <div class="modal-acciones"><button class="btn-primario" id="mejora-ok">Mejorar</button></div>
  `);
  qs("#mejora-ok", modal).addEventListener("click", async () => {
    const n = parseInt(qs("#mejora-cant", modal)?.value) || 0;
    if (!n || n <= 0) { notificar("⚠️ Indica al menos 1 punto."); return; }
    if (n > max) { notificar("⚠️ Superarías el máximo de 9."); return; }
    const costoTotal = n * 4;
    const saldo = Number(actor.system.pdc[moneda]) || 0;
    if (saldo < costoTotal) { notificar(`⚠️ No tienes suficientes ${moneda.toUpperCase()}. Necesitas ${costoTotal}, tienes ${saldo}.`); return; }
    actor.system.pdc[moneda] = saldo - costoTotal;
    actor.system.atributos[atr] = actual + n;
    modal.remove();
    await dbPut("personajes", actor);
    render();
  });
}

// [UNDAVAR-PARTE-3.7] Evalúa expresiones de Erianas sin eval.
// Acepta "100-10", "100 + 20 - 5", "+20" y "-5". Un signo inicial es relativo al valor actual.
function evaluarExpresionErianas(texto, valorActual = 0) {
  if (typeof texto !== "string") return null;

  const limpio = texto.trim().replace(/,/g, ".");
  if (!limpio) return null;

  // Número inicial opcionalmente con signo, seguido de sumas/restas con espacios opcionales
  if (!/^[+-]?\s*\d+(?:\.\d+)?(?:\s*[+-]\s*\d+(?:\.\d+)?)*$/.test(limpio)) return null;

  const partes = limpio.match(/[+-]?\s*\d+(?:\.\d+)?/g);
  if (!partes || partes.length === 0) return null;

  let total = 0;
  for (const parte of partes) {
    const n = Number(parte.replace(/\s+/g, ""));
    if (!Number.isFinite(n)) return null;
    total += n;
  }

  const esRelativa = /^[+-]/.test(limpio);
  const base = esRelativa ? (Number(valorActual) || 0) : 0;
  return Math.round(base + total);
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

function crearModal(titulo, contenidoHTML, onCerrar = null) {
  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `<div class="modal-caja"><div class="modal-header"><h3>${esc(titulo)}</h3><button class="modal-cerrar" aria-label="Cerrar" title="Cerrar">✕</button></div><div class="modal-cuerpo">${contenidoHTML}</div></div>`;
  document.body.appendChild(fondo);
  // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Permite avisar cuando se cierra sin elegir
  const cerrar = () => {
    fondo.remove();
    if (typeof onCerrar === "function") onCerrar();
  };
  fondo.querySelector(".modal-cerrar").addEventListener("click", cerrar);
  fondo.addEventListener("click", e => { if (e.target === fondo) cerrar(); });
  return fondo;
}

// ============================================================
// [UNDAVAR-PARTE-4.1] Asistente guiado de creación de personaje
// ============================================================

const PASOS_CREACION_PJ = ["identidad", "clase", "oficios", "atributos", "artes", "erianas", "resumen"];
const ETIQUETAS_PASO_CREACION = {
  identidad: "Identidad", clase: "Clase", oficios: "Oficios",
  atributos: "Atributos", artes: "Artes y armas", erianas: "Erianas", resumen: "Resumen"
};
const ATRIBUTOS_PJ = ["fuerza", "velocidad", "agilidad", "inteligencia"];
const ETIQUETAS_ATRIBUTO_PJ = {
  fuerza: "Fuerza", velocidad: "Velocidad", agilidad: "Agilidad", inteligencia: "Inteligencia"
};
// [UNDAVAR-PARTE-4.1b] Pozo único de creación y coste de oficios
const PUNTOS_CREACION_PJ = 8;
const COSTO_OFICIO_PD = 3;
const CAMPOS_PDC_PJ = ["pc", "pe", "pr", "pd", "pp", "s"];
const ETIQUETAS_PDC_PJ = { pc: "PC", pe: "PE", pr: "PR", pd: "PD", pp: "PP", s: "S" };

function estadoInicialCreacion() {
  return {
    paso: 0,
    identidad: { nombre: "", procedencia: "", edad: "", maestro: "", sabioRegidor: "", descripcion: "" },
    procedenciaEnwes: "",
    procedenciaLibre: false,
    panelAbierto: "",
    clase: "artista",
    oficios: [],
    puntos: { fuerza: 0, velocidad: 0, agilidad: 0, inteligencia: 0 },
    pdc: { pc: 0, pe: 0, pr: 0, pd: 0, pp: 0, s: 0 },
    // [UNDAVAR-PARTE-4.2b] Cada arte guarda nombre, conjuro/mantra y descripción
    artes: [
      { nombre: "Arte 1", conjuro: "", descripcion: "" },
      { nombre: "Arte 2", conjuro: "", descripcion: "" },
      { nombre: "Arte 3", conjuro: "", descripcion: "" }
    ],
    arma: { nombre: "Arma 1", conjuro: "", descripcion: "" },
    erianas: tiradaErianasIniciales()
  };
}

// [UNDAVAR-PARTE-4.1b] Puntos ya repartidos (atributos + campos PdC, sin "Sin asignar")
function puntosRepartidosCreacion(estado) {
  const atr = ATRIBUTOS_PJ.reduce((a, k) => a + (Number(estado.puntos[k]) || 0), 0);
  const pdc = CAMPOS_PDC_PJ.reduce((a, k) => a + (Number(estado.pdc[k]) || 0), 0);
  return atr + pdc;
}

// [UNDAVAR-PARTE-4.1b] Pozo disponible tras pagar 3 PD por oficio
function pdDisponiblesCreacion(estado) {
  return PUNTOS_CREACION_PJ - (estado.oficios.length * COSTO_OFICIO_PD);
}

function bonosOficioTexto(bonos) {
  const etiquetas = {
    pc: "PC", pe: "PE", pr: "PR", pd: "PD", pp: "PP", s: "S",
    salud: "Salud", fuerza: "Fuerza", velocidad: "Velocidad",
    agilidad: "Agilidad", inteligencia: "Inteligencia"
  };
  const partes = Object.entries(bonos || {})
    .filter(([, v]) => Number(v))
    .map(([k, v]) => `+${v} ${etiquetas[k] || k}`);
  return partes.length ? partes.join(" · ") : "Sin bonos";
}

function bonosOficiosAcumulados(ids) {
  const total = { pc: 0, pe: 0, pr: 0, pd: 0, pp: 0, s: 0, salud: 0, fuerza: 0, velocidad: 0, agilidad: 0, inteligencia: 0 };
  for (const id of ids || []) {
    const o = OFICIOS_UNDAVAR.find(x => x.id === id);
    if (!o) continue;
    for (const [k, v] of Object.entries(o.bonos || {})) total[k] = (total[k] || 0) + (Number(v) || 0);
  }
  return total;
}

function pasosCreacionHTML(estado) {
  return `<ol class="asistente-pasos" aria-label="Pasos de creación">${PASOS_CREACION_PJ.map((p, i) => `
    <li class="asistente-paso ${i === estado.paso ? "activo" : ""} ${i < estado.paso ? "hecho" : ""}">
      <span class="asistente-paso-num">${i + 1}</span>
      <span class="asistente-paso-label">${ETIQUETAS_PASO_CREACION[p]}</span>
    </li>`).join("")}</ol>`;
}

function pasoIdentidadHTML(estado) {
  const id = estado.identidad;
  return `
  <div class="asistente-titulo">
    <h3>Identidad del undavarita</h3>
    <p>El personaje es humano. El gremio y el rango se llenan más adelante.</p>
  </div>
  <div class="asistente-grid">
    <div class="campo-fila"><label>Nombre *</label><input type="text" id="cre-nombre" value="${esc(id.nombre)}" placeholder="Ej: Lyra de Derla" autocomplete="off"></div>
    <div class="campo-fila"><label>Edad</label><input type="text" id="cre-edad" value="${esc(id.edad)}"></div>
    <div class="campo-fila"><label>Maestro</label><input type="text" id="cre-maestro" value="${esc(id.maestro)}" placeholder="Opcional"></div>
    <div class="campo-fila">
      <label>Sabio regidor</label>
      <div class="asistente-trigger-wrap">
        <input type="text" id="cre-sabio" class="asistente-trigger-input" value="${esc(id.sabioRegidor)}" placeholder="Elige uno de los 7 Sabios" readonly data-panel="sabio">
        <span class="asistente-trigger-flecha">▾</span>
      </div>
    </div>
  </div>
  <div class="campo-fila asistente-procedencia-campo">
    <label>Procedencia</label>
    <div class="asistente-trigger-wrap">
      <input type="text" id="cre-procedencia" class="asistente-trigger-input" value="${esc(id.procedencia)}" placeholder="Elige un Enwes y una Eslava" ${estado.procedenciaLibre ? "" : "readonly"} ${estado.procedenciaLibre ? "" : 'data-panel="procedencia"'}>
      ${estado.procedenciaLibre ? "" : `<span class="asistente-trigger-flecha">▾</span>`}
    </div>
    ${estado.procedenciaLibre ? `<button type="button" class="btn-secundario chico asistente-otra-btn" id="cre-procedencia-lista">Volver a la lista</button>` : ""}
  </div>
  <div class="campo-fila"><label>Descripción / aspecto</label><textarea id="cre-descripcion" rows="3" placeholder="Opcional">${esc(id.descripcion)}</textarea></div>`;
}

// [UNDAVAR-PARTE-4.1c] Contenido de los paneles flotantes de Identidad
function popoverIdentidadHTML(estado) {
  if (estado.panelAbierto === "sabio") {
    return `
      <div class="asistente-popover-titulo">Sabio regidor</div>
      <div class="asistente-popover-grid">
        ${SABIOS_REGIDORES_UNDAVAR.map(s => `
          <button type="button" class="asistente-sabio-btn ${estado.identidad.sabioRegidor === s.nombre ? "activo" : ""}" data-sabio="${esc(s.nombre)}">
            <strong>${esc(s.nombre)}</strong>
            <small>${esc(s.enwes)} · ${esc(s.rango)}</small>
          </button>`).join("")}
      </div>
      <p class="asistente-popover-nota">Vuelve a pulsar el elegido para dejarlo vacío.</p>`;
  }
  if (estado.panelAbierto === "procedencia") {
    const grupo = GEOGRAFIA_UNDAVAR.find(g => g.enwes === estado.procedenciaEnwes);
    return `
      <div class="asistente-popover-titulo">Enwes</div>
      <div class="asistente-popover-enwes">
        ${GEOGRAFIA_UNDAVAR.map(g => `
          <button type="button" class="asistente-enwes-btn ${estado.procedenciaEnwes === g.enwes ? "activo" : ""}" data-enwes="${esc(g.enwes)}">
            <strong>${esc(g.enwes)}</strong>
            <small>${esc(g.region)} · ${g.eslavas.length} Eslavas</small>
          </button>`).join("")}
      </div>
      ${grupo ? `
        <div class="asistente-popover-titulo">Eslavas de ${esc(grupo.enwes)}</div>
        <div class="asistente-popover-eslavas">
          ${grupo.eslavas.map(e => `
            <button type="button" class="asistente-eslava-btn ${estado.identidad.procedencia === grupo.enwes + ", " + e.nombre ? "activo" : ""}" data-eslava="${esc(e.nombre)}">
              <span>${esc(e.nombre)}</span><small>${esc(e.tipo)}</small>
            </button>`).join("")}
        </div>` : ""}
      <button type="button" class="btn-secundario chico asistente-otra-btn" id="cre-procedencia-otra">Otra procedencia</button>`;
  }
  return "";
}

// [UNDAVAR-PARTE-4.1c] Coloca el panel flotante junto a su campo
// [UNDAVAR-PARTE-4.1g] Corregido el desfase: se limita al viewport y mide el alto real
function posicionarPopover(pop, trigger) {
  const margen = 8;
  const hueco = 6;

  // Ancho: nunca más grande que la ventana
  const ancho = Math.min(520, Math.max(280, window.innerWidth - margen * 2));
  pop.style.width = `${ancho}px`;
  pop.style.left = `${Math.max(margen, Math.min(trigger.getBoundingClientRect().left, window.innerWidth - ancho - margen))}px`;

  // Alto: se mide el contenido y se recorta al hueco disponible
  const altoNatural = pop.scrollHeight;
  const r = trigger.getBoundingClientRect();
  const abajo = window.innerHeight - r.bottom - hueco - margen;
  const arriba = r.top - hueco - margen;
  const abrirArriba = abajo < Math.min(altoNatural, 220) && arriba > abajo;
  const disponible = Math.max(140, abrirArriba ? arriba : abajo);
  const altoMax = Math.max(140, window.innerHeight - margen * 2);
  const alto = Math.min(altoNatural, disponible, 340, altoMax);
  pop.style.maxHeight = `${alto}px`;

  const topIdeal = abrirArriba ? r.top - alto - hueco : r.bottom + hueco;
  pop.style.top = `${Math.max(margen, Math.min(topIdeal, window.innerHeight - alto - margen))}px`;
  if (abrirArriba) pop.classList.add("arriba");
}


function pasoClaseHTML(estado) {
  return `
  <div class="asistente-titulo">
    <h3>Clase</h3>
    <p>La clase decide cuántas artes y armas iniciales recibe.</p>
  </div>
  <div class="asistente-clases">
    <button type="button" class="asistente-clase ${estado.clase === "artista" ? "activo" : ""}" data-clase="artista">
      <strong>Artista</strong>
      <span>3 artes iniciales</span>
      <small>Especialista en artes vocales. Puede usar armas de bajo nivel.</small>
    </button>
    <button type="button" class="asistente-clase ${estado.clase === "gladiador" ? "activo" : ""}" data-clase="gladiador">
      <strong>Gladiador</strong>
      <span>2 artes + 1 arma inicial</span>
      <small>Especialista en armas y combate. Acceso limitado a hechizos.</small>
    </button>
  </div>`;
}

function pasoOficiosHTML(estado) {
  const costo = estado.oficios.length * COSTO_OFICIO_PD;
  return `
  <div class="asistente-titulo">
    <h3>Oficios</h3>
    <p>Elige hasta 2 (recomendado, no obligatorio). Cada uno cuesta ${COSTO_OFICIO_PD} PD de los 8 PdC; sus bonos se suman encima.</p>
  </div>
  <div class="asistente-contador-oficios">Seleccionados: <b>${estado.oficios.length}/2</b> · Coste: <b>${costo} PD</b> · Quedan <b>${PUNTOS_CREACION_PJ - costo}</b> PdC para repartir</div>
  <div class="asistente-oficios">
    ${OFICIOS_UNDAVAR.map(o => `
      <button type="button" class="asistente-oficio ${estado.oficios.includes(o.id) ? "activo" : ""}" data-oficio="${o.id}">
        <span class="asistente-oficio-cabecera"><strong>${esc(o.nombre)}</strong>${o.logro ? `<span class="asistente-etiqueta">Logro</span>` : ""}</span>
        <small>${esc(o.descripcion)}</small>
        <span class="asistente-bonos">${bonosOficioTexto(o.bonos)}</span>
      </button>`).join("")}
  </div>`;
}

function pasoAtributosHTML(estado) {
  const bonos = bonosOficiosAcumulados(estado.oficios);
  const disponible = pdDisponiblesCreacion(estado);
  const repartidos = puntosRepartidosCreacion(estado);
  const restante = disponible - repartidos;
  const costoOficios = estado.oficios.length * COSTO_OFICIO_PD;
  return `
  <div class="asistente-titulo">
    <h3>Atributos y PdC</h3>
    <p>Los 8 PdC son un solo pozo. Los oficios gastan ${costoOficios} PD; reparte los ${disponible} restantes donde quieras. Los bonos de oficio se suman encima.</p>
  </div>
  <div class="asistente-pozo-info">
    <span>8 PdC</span> − <span>${costoOficios} en oficios</span> = <b>${disponible} disponibles</b>
  </div>
  <h4 class="asistente-subtitulo">Atributos <small>máximo final 9</small></h4>
  <div class="asistente-atributos">
    ${ATRIBUTOS_PJ.map(atr => {
    const bono = Number(bonos[atr]) || 0;
    const max = Math.max(0, 9 - bono);
    const puntos = Number(estado.puntos[atr]) || 0;
    return `
      <div class="asistente-atributo" data-atr="${atr}">
        <div class="asistente-atributo-nombre">${ETIQUETAS_ATRIBUTO_PJ[atr]}</div>
        <div class="asistente-atributo-control">
          <input type="number" id="cre-${atr}" data-atr="${atr}" data-bono="${bono}" min="0" max="${max}" value="${puntos}">
          <span class="asistente-atributo-bono">${bono ? `+${bono} oficio` : "sin bono"}</span>
        </div>
        <div class="asistente-atributo-final">Final: <b id="cre-final-${atr}">${Math.min(9, puntos + bono)}</b> / 9</div>
      </div>`;
  }).join("")}
  </div>
  <h4 class="asistente-subtitulo">Campos PdC</h4>
  <div class="asistente-pdc-grid">
    ${CAMPOS_PDC_PJ.map(k => {
    const bono = Number(bonos[k]) || 0;
    const puntos = Number(estado.pdc[k]) || 0;
    return `
      <div class="asistente-pdc-item" data-pdc="${k}">
        <label>${ETIQUETAS_PDC_PJ[k]}</label>
        <input type="number" id="cre-pdc-${k}" data-pdc="${k}" data-bono="${bono}" min="0" value="${puntos}">
        <span class="asistente-pdc-bono">${bono ? `+${bono}` : "—"}</span>
        <span class="asistente-pdc-total">Total: <b id="cre-pdc-final-${k}">${puntos + bono}</b></span>
      </div>`;
  }).join("")}
  </div>
  <div class="asistente-restantes">Puntos restantes: <b id="cre-restantes">${restante}</b> / ${disponible} · Se guardan en “Sin asignar”.</div>`;
}

function pasoArtesHTML(estado) {
  const esArtista = estado.clase === "artista";
  const artes = esArtista ? estado.artes.slice(0, 3) : estado.artes.slice(0, 2);
  return `
  <div class="asistente-titulo">
    <h3>Artes y armas</h3>
    <p>${esArtista ? "El Artista empieza con 3 artes." : "El Gladiador empieza con 2 artes y 1 arma."} Puedes editarlas después en la ficha.</p>
  </div>
  ${artes.map((a, i) => `
    <div class="asistente-arte-bloque">
      <h4 class="asistente-subtitulo">Arte ${i + 1}</h4>
      <div class="campo-fila"><label>Nombre *</label><input type="text" id="cre-arte-${i}" value="${esc(a.nombre)}" placeholder="Nombre del arte"></div>
      <div class="campo-fila"><label>Conjuro / mantra</label><textarea id="cre-arte-conjuro-${i}" rows="2" placeholder="Yo, [nombre], invoco y ordeno descifrar las leyes lógicas de...">${esc(a.conjuro)}</textarea></div>
      <div class="campo-fila"><label>Descripción del efecto</label><textarea id="cre-arte-desc-${i}" rows="2" placeholder="Qué hace el arte y cómo se manifiesta">${esc(a.descripcion)}</textarea></div>
    </div>`).join("")}
  ${!esArtista ? `
    <div class="asistente-arte-bloque">
      <h4 class="asistente-subtitulo">Arma inicial</h4>
      <div class="campo-fila"><label>Nombre *</label><input type="text" id="cre-arma" value="${esc(estado.arma.nombre)}" placeholder="Nombre del arma"></div>
      <div class="campo-fila"><label>Descripción / efecto</label><textarea id="cre-arma-desc" rows="2" placeholder="Qué hace el arma y cómo se activa">${esc(estado.arma.descripcion)}</textarea></div>
    </div>` : ""}
  <p class="asistente-nota">Se crean en Nv.0. Usar un arte o arma sin nivel cuesta <b>2 PA</b>; mejorarlo cuesta <b>15/30/45/75 PV</b> (Nv.1–4). Las nuevas se piden en el rango 4 “Wonrixay”, una por rango, con 15 aciertos de entrenamiento.</p>`;
}

function pasoErianasHTML(estado) {
  const r = estado.erianas;
  return `
  <div class="asistente-titulo">
    <h3>Erianas iniciales</h3>
    <p>El manual indica 4d6 × 10 de oro al crear el personaje.</p>
  </div>
  <div class="asistente-erianas">
    <div class="asistente-dados">${r.ds.map(d => `<span class="asistente-dado">${d}</span>`).join("")}</div>
    <div class="asistente-erianas-total">${r.suma} × 10 = <b>${r.total.toLocaleString()} de oro</b></div>
    <button type="button" class="btn-secundario chico" id="cre-reroll-erianas">↻ Volver a tirar</button>
  </div>`;
}

function pasoResumenHTML(estado) {
  const bonos = bonosOficiosAcumulados(estado.oficios);
  const oficios = estado.oficios.map(id => OFICIOS_UNDAVAR.find(o => o.id === id)).filter(Boolean);
  const artes = estado.clase === "artista" ? estado.artes.slice(0, 3) : estado.artes.slice(0, 2);
  const saludMax = 8 + (Number(bonos.salud) || 0);
  const costoOficios = estado.oficios.length * COSTO_OFICIO_PD;
  const disponible = pdDisponiblesCreacion(estado);
  const repartidos = puntosRepartidosCreacion(estado);
  const sinAsignar = disponible - repartidos;
  const puntosAtr = ATRIBUTOS_PJ.reduce((a, k) => a + (Number(estado.puntos[k]) || 0), 0);
  const puntosPdc = CAMPOS_PDC_PJ.reduce((a, k) => a + (Number(estado.pdc[k]) || 0), 0);
  return `
  <div class="asistente-titulo">
    <h3>Resumen</h3>
    <p>Revisa los datos antes de crear la ficha.</p>
  </div>
  <div class="asistente-resumen">
    <div class="asistente-resumen-bloque">
      <h4>Identidad</h4>
      <p><b>${esc(estado.identidad.nombre)}</b> · ${estado.clase === "artista" ? "Artista" : "Gladiador"}</p>
      <p class="asistente-resumen-meta">${[estado.identidad.procedencia, estado.identidad.edad ? estado.identidad.edad + " años" : "", estado.identidad.maestro ? "Maestro: " + estado.identidad.maestro : ""].filter(Boolean).map(esc).join(" · ") || "Sin datos adicionales"}</p>
    </div>
    <div class="asistente-resumen-bloque">
      <h4>Atributos</h4>
      <table class="asistente-tabla">
        <tr><th>Atributo</th><th>Puntos</th><th>Oficio</th><th>Final</th></tr>
        ${ATRIBUTOS_PJ.map(atr => {
    const b = Number(bonos[atr]) || 0;
    const p = Number(estado.puntos[atr]) || 0;
    return `<tr><td>${ETIQUETAS_ATRIBUTO_PJ[atr]}</td><td>${p}</td><td>${b ? "+" + b : "—"}</td><td><b>${Math.min(9, p + b)}</b></td></tr>`;
  }).join("")}
      </table>
    </div>
    <div class="asistente-resumen-bloque">
      <h4>Campos PdC</h4>
      <table class="asistente-tabla">
        <tr><th>Campo</th><th>Puntos</th><th>Oficio</th><th>Total</th></tr>
        ${CAMPOS_PDC_PJ.map(k => {
    const b = Number(bonos[k]) || 0;
    const p = Number(estado.pdc[k]) || 0;
    return `<tr><td>${ETIQUETAS_PDC_PJ[k]}</td><td>${p}</td><td>${b ? "+" + b : "—"}</td><td><b>${p + b}</b></td></tr>`;
  }).join("")}
      </table>
    </div>
    <div class="asistente-resumen-bloque">
      <h4>Reparto de los 8 PdC</h4>
      <p>8 PdC = <b>${costoOficios}</b> en oficios (${estado.oficios.length} × ${COSTO_OFICIO_PD} PD) + <b>${puntosAtr}</b> en atributos + <b>${puntosPdc}</b> en campos + <b>${sinAsignar}</b> sin asignar.</p>
    </div>
    <div class="asistente-resumen-bloque">
      <h4>Oficios</h4>
      ${oficios.map(o => `<p><b>${esc(o.nombre)}</b> · ${COSTO_OFICIO_PD} PD · <span class="asistente-bonos">${bonosOficioTexto(o.bonos)}</span></p>`).join("")}
    </div>
    <div class="asistente-resumen-bloque">
      <h4>Artes y armas</h4>
      <p>${artes.map((a, i) => `Arte ${i + 1}: ${esc(a.nombre || "Sin nombre")} (Nv.0 · 2 PA)${a.conjuro ? ` · Mantra: ${esc(a.conjuro)}` : ""}${a.descripcion ? ` · ${esc(a.descripcion)}` : ""}`).join(" · ")}${estado.clase === "gladiador" ? ` · Arma: ${esc(estado.arma.nombre || "Sin nombre")} (Nv.0 · 2 PA)${estado.arma.descripcion ? ` · ${esc(estado.arma.descripcion)}` : ""}` : ""}</p>
    </div>
    <div class="asistente-resumen-bloque">
      <h4>Estado inicial</h4>
      <p>Salud máxima: <b>${saludMax}</b> · PA: <b>2</b> · PV: <b>0</b> (Sin rango)</p>
      <p>Erianas: <b>${estado.erianas.total.toLocaleString()} de oro</b> (${estado.erianas.ds.join(" + ")} = ${estado.erianas.suma} × 10)</p>
    </div>
  </div>`;
}

function leerPasoCreacion(estado, modal) {
  const paso = PASOS_CREACION_PJ[estado.paso];
  if (paso === "identidad") {
    estado.identidad = {
      nombre: qs("#cre-nombre", modal)?.value.trim() || "",
      procedencia: qs("#cre-procedencia", modal)?.value.trim() || "",
      edad: qs("#cre-edad", modal)?.value.trim() || "",
      maestro: qs("#cre-maestro", modal)?.value.trim() || "",
      sabioRegidor: qs("#cre-sabio", modal)?.value.trim() || "",
      descripcion: qs("#cre-descripcion", modal)?.value.trim() || ""
    };
  } else if (paso === "atributos") {
    for (const atr of ATRIBUTOS_PJ) {
      const inp = qs(`#cre-${atr}`, modal);
      estado.puntos[atr] = Math.max(0, Number(inp?.value) || 0);
    }
    for (const k of CAMPOS_PDC_PJ) {
      const inp = qs(`#cre-pdc-${k}`, modal);
      estado.pdc[k] = Math.max(0, Number(inp?.value) || 0);
    }
  } else if (paso === "artes") {
    const cuantas = estado.clase === "artista" ? 3 : 2;
    for (let i = 0; i < cuantas; i++) {
      estado.artes[i] = {
        nombre: qs(`#cre-arte-${i}`, modal)?.value.trim() || "",
        conjuro: qs(`#cre-arte-conjuro-${i}`, modal)?.value.trim() || "",
        descripcion: qs(`#cre-arte-desc-${i}`, modal)?.value.trim() || ""
      };
    }
    if (estado.clase === "gladiador") {
      estado.arma = {
        nombre: qs("#cre-arma", modal)?.value.trim() || "",
        conjuro: "",
        descripcion: qs("#cre-arma-desc", modal)?.value.trim() || ""
      };
    }
  }
}

function validarPasoCreacion(estado, paso) {
  if (paso === "identidad") {
    if (!estado.identidad.nombre.trim()) return "Escribe el nombre del personaje.";
    return null;
  }
  if (paso === "oficios") {
    // [UNDAVAR-PARTE-4.2c] Los oficios son recomendables, no obligatorios
    if (estado.oficios.length > 2) return "Puedes elegir como máximo 2 oficios.";
    return null;
  }
  if (paso === "atributos") {
    const disponible = pdDisponiblesCreacion(estado);
    const total = puntosRepartidosCreacion(estado);
    if (total > disponible) return `Te has pasado: repartiste ${total} de ${disponible} PdC disponibles.`;
    const bonos = bonosOficiosAcumulados(estado.oficios);
    for (const atr of ATRIBUTOS_PJ) {
      if ((Number(estado.puntos[atr]) || 0) + (Number(bonos[atr]) || 0) > 9) {
        return `${ETIQUETAS_ATRIBUTO_PJ[atr]} supera el máximo 9.`;
      }
    }
    return null;
  }
  if (paso === "artes") {
    const cuantas = estado.clase === "artista" ? 3 : 2;
    for (let i = 0; i < cuantas; i++) {
      if (!(estado.artes[i]?.nombre || "").trim()) return `Escribe el nombre del arte ${i + 1}.`;
    }
    if (estado.clase === "gladiador" && !(estado.arma?.nombre || "").trim()) return "Escribe el nombre del arma inicial.";
    return null;
  }
  return null;
}

// [UNDAVAR-PARTE-4.1c] Re-render conservando el scroll del paso actual
function rerenderAsistente(modal, estado) {
  const cont = qs(".asistente-contenido", modal);
  const scroll = cont?.scrollTop || 0;
  renderAsistenteCreacion(modal, estado);
  const nuevo = qs(".asistente-contenido", modal);
  if (nuevo) nuevo.scrollTop = scroll;
}

function renderAsistenteCreacion(modal, estado) {
  const cuerpo = qs(".modal-cuerpo", modal);
  const paso = PASOS_CREACION_PJ[estado.paso];
  qs(".asistente-popover-flotante", modal)?.remove();
  const htmlPaso = {
    identidad: pasoIdentidadHTML,
    clase: pasoClaseHTML,
    oficios: pasoOficiosHTML,
    atributos: pasoAtributosHTML,
    artes: pasoArtesHTML,
    erianas: pasoErianasHTML,
    resumen: pasoResumenHTML
  }[paso](estado);

  cuerpo.innerHTML = `
    <div class="asistente">
      ${pasosCreacionHTML(estado)}
      <div class="asistente-contenido">${htmlPaso}</div>
      <div class="asistente-acciones">
        <button type="button" class="btn-secundario" id="cre-anterior" ${estado.paso === 0 ? "disabled" : ""}>← Anterior</button>
        <span class="asistente-paso-contador">Paso ${estado.paso + 1} de ${PASOS_CREACION_PJ.length}</span>
        ${estado.paso < PASOS_CREACION_PJ.length - 1
      ? `<button type="button" class="btn-primario" id="cre-siguiente">Siguiente →</button>`
      : `<button type="button" class="btn-primario" id="cre-crear">✓ Crear personaje</button>`}
      </div>
    </div>`;

  // [UNDAVAR-PARTE-4.1c] Montar y posicionar el popover si hay un panel abierto
  // [UNDAVAR-PARTE-4.1g] Vuelve a ser flotante y se recoloca al hacer scroll o cambiar el tamaño
  if (paso === "identidad" && estado.panelAbierto) {
    const trigger = qs(`[data-panel="${estado.panelAbierto}"]`, cuerpo);
    if (trigger) {
      const pop = document.createElement("div");
      pop.className = "asistente-popover-flotante";
      pop.innerHTML = popoverIdentidadHTML(estado);
      const caja = qs(".modal-caja", modal) || modal;
      caja.appendChild(pop);
      posicionarPopover(pop, trigger);
    }
  }

  if (["identidad", "artes"].includes(paso) && !estado.panelAbierto) {
    qs("input, textarea", cuerpo)?.focus();
  }

  wireAsistenteCreacion(modal, estado);
}

function wireAsistenteCreacion(modal, estado) {
  const paso = PASOS_CREACION_PJ[estado.paso];

  // [UNDAVAR-PARTE-4.1c] Triggers de popover (Sabio regidor y Procedencia)
  qsa("[data-panel]", modal).forEach(el => el.addEventListener("click", () => {
    leerPasoCreacion(estado, modal);
    const panel = el.dataset.panel;
    if (!panel) return;
    estado.panelAbierto = estado.panelAbierto === panel ? "" : panel;
    rerenderAsistente(modal, estado);
  }));

  // [UNDAVAR-PARTE-4.1c] Selección de Sabio Regidor dentro del popover
  qsa(".asistente-sabio-btn", modal).forEach(b => b.addEventListener("click", () => {
    leerPasoCreacion(estado, modal);
    const nombre = b.dataset.sabio;
    estado.identidad.sabioRegidor = estado.identidad.sabioRegidor === nombre ? "" : nombre;
    estado.panelAbierto = "";
    rerenderAsistente(modal, estado);
  }));

  // [UNDAVAR-PARTE-4.1c] Selección de Enwes y Eslavas dentro del popover
  qsa(".asistente-enwes-btn", modal).forEach(b => b.addEventListener("click", () => {
    leerPasoCreacion(estado, modal);
    const enwes = b.dataset.enwes;
    estado.procedenciaEnwes = estado.procedenciaEnwes === enwes ? "" : enwes;
    estado.procedenciaLibre = false;
    estado.panelAbierto = "procedencia";
    rerenderAsistente(modal, estado);
  }));

  qsa(".asistente-eslava-btn", modal).forEach(b => b.addEventListener("click", () => {
    leerPasoCreacion(estado, modal);
    estado.identidad.procedencia = `${estado.procedenciaEnwes}, ${b.dataset.eslava}`;
    estado.procedenciaLibre = false;
    estado.panelAbierto = "";
    rerenderAsistente(modal, estado);
  }));

  qs("#cre-procedencia-otra", modal)?.addEventListener("click", () => {
    leerPasoCreacion(estado, modal);
    estado.procedenciaLibre = true;
    estado.procedenciaEnwes = "";
    estado.identidad.procedencia = "";
    estado.panelAbierto = "";
    rerenderAsistente(modal, estado);
    qs("#cre-procedencia", modal)?.focus();
  });

  qs("#cre-procedencia-lista", modal)?.addEventListener("click", () => {
    leerPasoCreacion(estado, modal);
    estado.procedenciaLibre = false;
    estado.panelAbierto = "procedencia";
    rerenderAsistente(modal, estado);
  });

  // Clase
  qsa(".asistente-clase", modal).forEach(b => b.addEventListener("click", () => {
    estado.clase = b.dataset.clase;
    rerenderAsistente(modal, estado);
  }));

  // Oficios
  qsa(".asistente-oficio", modal).forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.oficio;
    const i = estado.oficios.indexOf(id);
    if (i >= 0) estado.oficios.splice(i, 1);
    else if (estado.oficios.length >= 2) { notificar("⚠️ Solo puedes elegir 2 oficios."); return; }
    else estado.oficios.push(id);
    rerenderAsistente(modal, estado);
  }));

  // Atributos y campos PdC: contador en vivo
  if (paso === "atributos") {
    const inputsAtr = qsa(".asistente-atributo input", modal);
    const inputsPdc = qsa(".asistente-pdc-item input", modal);
    const disponible = pdDisponiblesCreacion(estado);
    const actualizar = () => {
      let total = 0;
      inputsAtr.forEach(inp => {
        const max = Number(inp.max) || 0;
        const v = Math.max(0, Math.min(max, Number(inp.value) || 0));
        if (String(v) !== inp.value) inp.value = String(v);
        total += v;
        const final = qs(`#cre-final-${inp.dataset.atr}`, modal);
        if (final) final.textContent = String(Math.min(9, v + (Number(inp.dataset.bono) || 0)));
      });
      inputsPdc.forEach(inp => {
        const v = Math.max(0, Number(inp.value) || 0);
        total += v;
        const final = qs(`#cre-pdc-final-${inp.dataset.pdc}`, modal);
        if (final) final.textContent = String(v + (Number(inp.dataset.bono) || 0));
      });
      const restantes = qs("#cre-restantes", modal);
      if (restantes) {
        restantes.textContent = String(disponible - total);
        restantes.classList.toggle("negativo", total > disponible);
      }
    };
    [...inputsAtr, ...inputsPdc].forEach(inp => inp.addEventListener("input", actualizar));
    actualizar();
  }

  // Erianas: volver a tirar
  qs("#cre-reroll-erianas", modal)?.addEventListener("click", () => {
    estado.erianas = tiradaErianasIniciales();
    renderAsistenteCreacion(modal, estado);
  });

  // Navegación
  qs("#cre-anterior", modal)?.addEventListener("click", () => {
    leerPasoCreacion(estado, modal);
    estado.paso = Math.max(0, estado.paso - 1);
    renderAsistenteCreacion(modal, estado);
  });

  qs("#cre-siguiente", modal)?.addEventListener("click", () => {
    leerPasoCreacion(estado, modal);
    const error = validarPasoCreacion(estado, paso);
    if (error) { notificar("⚠️ " + error); return; }
    estado.paso = Math.min(PASOS_CREACION_PJ.length - 1, estado.paso + 1);
    renderAsistenteCreacion(modal, estado);
  });

  qs("#cre-crear", modal)?.addEventListener("click", async () => {
    leerPasoCreacion(estado, modal);
    for (const p of ["identidad", "oficios", "atributos", "artes"]) {
      const error = validarPasoCreacion(estado, p);
      if (error) {
        notificar("⚠️ " + error);
        estado.paso = PASOS_CREACION_PJ.indexOf(p);
        renderAsistenteCreacion(modal, estado);
        return;
      }
    }
    const btn = qs("#cre-crear", modal);
    if (btn) { btn.disabled = true; btn.textContent = "Creando…"; }
    await crearPersonajeDesdeAsistente(estado, modal);
  });
}

async function crearPersonajeDesdeAsistente(estado, modal) {
  const bonos = bonosOficiosAcumulados(estado.oficios);
  const actor = actorPersonajePorDefecto(estado.identidad.nombre || "Nuevo Undavarita");

  // Identidad
  const d = actor.system.datos;
  d.procedencia = estado.identidad.procedencia;
  d.edad = estado.identidad.edad;
  d.clase = estado.clase;
  d.gremio = "";
  d.maestro = estado.identidad.maestro;
  d.sabioRegidor = estado.identidad.sabioRegidor;
  d.descripcion = estado.identidad.descripcion;

  // Atributos = puntos de creación + bonos de oficio, con tope 9
  actor.system.atributos = {};
  for (const atr of ATRIBUTOS_PJ) {
    actor.system.atributos[atr] = Math.min(9, (Number(estado.puntos[atr]) || 0) + (Number(bonos[atr]) || 0));
  }

  // [UNDAVAR-PARTE-4.1b] PdC = puntos repartidos + bonos de oficio; el resto va a "Sin asignar"
  const sinAsignar = Math.max(0, pdDisponiblesCreacion(estado) - puntosRepartidosCreacion(estado));
  actor.system.pdc = {
    pc: (Number(estado.pdc.pc) || 0) + (Number(bonos.pc) || 0),
    pe: (Number(estado.pdc.pe) || 0) + (Number(bonos.pe) || 0),
    pr: (Number(estado.pdc.pr) || 0) + (Number(bonos.pr) || 0),
    pd: (Number(estado.pdc.pd) || 0) + (Number(bonos.pd) || 0),
    pp: (Number(estado.pdc.pp) || 0) + (Number(bonos.pp) || 0),
    s: (Number(estado.pdc.s) || 0) + (Number(bonos.s) || 0),
    sinAsignar
  };

  // Salud máxima = 8 + bonos de salud de los oficios
  const saludMax = 8 + (Number(bonos.salud) || 0);
  actor.system.estado.ptSalud = { value: saludMax, max: saludMax };

  // Erianas iniciales
  actor.system.erianas.oro = Number(estado.erianas.total) || 0;

  // Oficios elegidos
  for (const id of estado.oficios) {
    const o = OFICIOS_UNDAVAR.find(x => x.id === id);
    if (!o) continue;
    const it = itemPorDefecto("oficio", o.nombre);
    it.system = {
      oficioId: o.id,
      descripcion: o.descripcion,
      facultades: o.facultades.join(" "),
      puntos: COSTO_OFICIO_PD,
      maximo: 7,
      logro: !!o.logro,
      bonos: o.bonos,
      bonosAplicados: true
    };
    actor.items.push(it);
  }

  // Artes y armas iniciales
  const cuantasArtes = estado.clase === "artista" ? 3 : 2;
  for (let i = 0; i < cuantasArtes; i++) {
    const a = estado.artes[i] || {};
    const nombre = (a.nombre || "").trim() || `Arte ${i + 1}`;
    const it = itemPorDefecto("arte", nombre);
    it.system.conjuro = a.conjuro || "";
    it.system.descripcion = a.descripcion || "";
    actor.items.push(it);
  }
  if (estado.clase === "gladiador") {
    const a = estado.arma || {};
    const nombre = (a.nombre || "").trim() || "Arma 1";
    // [UNDAVAR-PARTE-10.4-ARMAS] El arma inicial del gladiador no es un objeto
    const it = itemPorDefecto("arma_gladiador", nombre);
    it.system.conjuro = a.conjuro || "";
    it.system.descripcion = a.descripcion || "";
    actor.items.push(it);
  }

  await dbPut("personajes", actor);
  modal.remove();
  notificar("✅ Personaje creado.");
  ir("ficha", { personajeId: actor.id, subtabFicha: "datos" });
}

function abrirAsistenteCreacion() {
  const estado = estadoInicialCreacion();
  const modal = crearModal("Crear personaje", "");
  qs(".modal-caja", modal)?.classList.add("modal-creacion");

  // [UNDAVAR-PARTE-4.1c] Clic fuera del popover o del trigger para cerrar el panel
  modal.addEventListener("click", (e) => {
    if (!estado.panelAbierto) return;
    if (e.target.closest(".asistente-popover-flotante")) return;
    if (e.target.closest("[data-panel]")) return;
    if (e.target.closest("#cre-procedencia-lista")) return;
    estado.panelAbierto = "";
    rerenderAsistente(modal, estado);
  });

  // [UNDAVAR-PARTE-4.1g] El panel sigue a su campo al hacer scroll o redimensionar
  const recolocarPopover = () => {
    const pop = qs(".asistente-popover-flotante", modal);
    const trigger = estado.panelAbierto ? qs(`[data-panel="${estado.panelAbierto}"]`, modal) : null;
    if (pop && trigger) posicionarPopover(pop, trigger);
  };
  modal.addEventListener("scroll", recolocarPopover, true);
  window.addEventListener("resize", recolocarPopover);

  renderAsistenteCreacion(modal, estado);
}

// [UNDAVAR-PARTE-4.2e4-BONOS] Fila editable de un bono temporal
function filaBonoHTML(b = {}) {
  return `
    <div class="bono-fila">
      <select class="bono-estadistica">
        ${ESTADISTICAS_BONO.map(e => `<option value="${e.id}" ${b.estadistica === e.id ? "selected" : ""}>${e.nombre}</option>`).join("")}
      </select>
      <input type="number" class="bono-valor" min="0" value="${Number(b.valor) || 0}">
      <select class="bono-modo">
        <option value="fijo" ${b.modo !== "pct" ? "selected" : ""}>Fijo</option>
        <option value="pct" ${b.modo === "pct" ? "selected" : ""}>%</option>
      </select>
      <input type="number" class="bono-turnos" min="1" value="${Math.max(1, Number(b.turnos) || 1)}">
      <label class="campo-check" title="Acumular: cada uso suma otro bono en vez de refrescarlo">
        <input type="checkbox" class="bono-acumulativo" ${b.acumulativo ? "checked" : ""}>
      </label>
      <button type="button" class="btn-secundario chico bono-quitar">✕</button>
    </div>`;
}

// [UNDAVAR-PARTE-4.2h1-HABILIDADES] Tarjeta editable de una habilidad
// [UNDAVAR-PARTE-4.2h4k-SELECTOR-HABILIDADES] Solo se muestra la habilidad activa
function habilidadCardHTML(h = {}, visible = true) {
  const ef = h.efectoMecanico ? normalizarEfecto(h.efectoMecanico) : null;
  const condiciones = normalizarCondicionesArte(h.condiciones);
  const bonos = Array.isArray(h.bonos) ? h.bonos : [];
  const campoActual = (k) => ef?.campos?.[k] || { valor: 0, modo: "fijo", cuando: "inmediato" };
  const filaEfecto = (k, etiqueta) => {
    const c = campoActual(k);
    const esMarca = ["hambre", "sed", "cansancio", "fatiga"].includes(k);
    return `
      <div class="efecto-fila">
        <span class="efecto-nombre">${etiqueta}</span>
        <div class="efecto-controles">
          <label class="efecto-control"><span>Valor</span><input type="number" class="hab-ef-${k}-valor" min="0" value="${Number(c.valor) || 0}"></label>
          <label class="efecto-control"><span>Modo</span><select class="hab-ef-${k}-modo">
            <option value="fijo" ${c.modo !== "pct" ? "selected" : ""}>Fijo</option>
            <option value="pct" ${c.modo === "pct" ? "selected" : ""}>%</option>
          </select></label>
          <label class="efecto-control"><span>Cuándo</span><select class="hab-ef-${k}-cuando">
            <option value="inmediato" ${c.cuando !== "turno" ? "selected" : ""}>Inmediato</option>
            <option value="turno" ${c.cuando === "turno" ? "selected" : ""}>Por turno</option>
          </select></label>
          ${esMarca ? `<label class="efecto-control"><span>Dirección</span><select class="hab-ef-${k}-signo">
            <option value="quitar" ${c.signo !== "aplicar" ? "selected" : ""}>Quitar</option>
            <option value="aplicar" ${c.signo === "aplicar" ? "selected" : ""}>Aplicar</option>
          </select></label>` : ""}
        </div>
      </div>`;
  };

  return `
    <div class="habilidad-card" data-hab-id="${esc(h.id || "")}" style="${visible ? "" : "display:none"}">
      <div class="habilidad-cabecera">
        <input type="text" class="hab-nombre" value="${esc(h.nombre || "")}" placeholder="Nombre de la habilidad">
        <span class="hab-modo-etiqueta">${esc(etiquetaModoUso(h.modoUso || "dano"))}</span>
        <button type="button" class="btn-secundario chico hab-duplicar" title="Duplicar esta habilidad">Duplicar habilidad</button>
        <button type="button" class="btn-peligro chico hab-eliminar">Eliminar</button>
      </div>
      <div class="habilidad-cuerpo">
        <div class="campo-fila"><label>Modo de uso</label><select class="hab-modo">
          ${MODOS_USO_ARTE.map(m => `<option value="${m.id}" ${(h.modoUso || "dano") === m.id ? "selected" : ""}>${m.nombre}</option>`).join("")}
        </select></div>
        <div class="campo-fila"><label>Requiere las armas</label>
          <input type="text" class="hab-requisito-armas" value="${esc((h.requisito?.armas || []).join(", "))}" placeholder="Ej. Tsuida (separadas por coma)">
        </div>
        <p class="nota">Si escribes armas, la habilidad solo aparece cuando el personaje las tenga todas en el inventario. Déjalo vacío si no requiere ninguna.</p>
        <div class="campo-fila"><label>Conjuro / activación</label><textarea class="hab-conjuro" rows="2">${esc(h.conjuro || "")}</textarea></div>
        <div class="campo-fila"><label>Descripción / efecto</label><textarea class="hab-descripcion" rows="3">${esc(h.descripcion || "")}</textarea></div>
        <!-- [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Permite dañar y aplicar efecto en la misma tirada -->
        <label class="campo-check"><input type="checkbox" class="hab-aplica-efecto" ${h.aplicaEfecto ? "checked" : ""}> Aplica también el efecto y las condiciones al hacer daño</label>
        <p class="nota">Márcalo para que la habilidad de daño aplique además su efecto mecánico y sus condiciones. Sin marcar, solo hace daño.</p>
        <details class="efecto-mecanico" ${ef?.definido ? "open" : ""}>
          <summary>Efecto mecánico (opcional)</summary>
          <div class="efecto-tabla">
            ${filaEfecto("salud", "Salud")}
            ${filaEfecto("herida", "Herida")}
            ${filaEfecto("hambre", "Hambre")}
            ${filaEfecto("sed", "Sed")}
            ${filaEfecto("cansancio", "Cansancio")}
            ${filaEfecto("fatiga", "Fatiga")}
          </div>
          <div class="efecto-grid">
            <label>Turnos (para «por turno»)<input type="number" class="hab-ef-turnos" min="1" value="${Math.max(1, Number(ef?.turnos) || 1)}"></label>
            <label>Objetivo<select class="hab-ef-objetivo">
              <option value="ambos" ${(ef?.objetivo || "ambos") === "ambos" ? "selected" : ""}>Propio y otros</option>
              <option value="propio" ${ef?.objetivo === "propio" ? "selected" : ""}>Solo propio</option>
              <option value="otro" ${ef?.objetivo === "otro" ? "selected" : ""}>Solo otros</option>
            </select></label>
          </div>
          <p class="nota">«Fijo» usa puntos o marcas. «%» usa el máximo real: Salud máxima, 8 heridas y 9 marcas. En marcas, «Aplicar» suma y «Quitar» cura; 99 fijo (o 100%) quita todas. Los campos «por turno» se aplican al usarlo y otra vez en cada turno siguiente.</p>
        </details>
        <details class="efecto-mecanico" ${condiciones.length ? "open" : ""}>
          <summary>Condiciones automáticas (opcional)</summary>
          <div class="condiciones-lista">
            ${CONDICIONES_ARTE.map(c => {
              const actual = condiciones.find(x => x.id === c.id);
              return `<div class="condicion-fila">
                <label class="campo-check"><input type="checkbox" class="hab-condicion" value="${c.id}" ${actual ? "checked" : ""}> ${c.nombre}</label>
                <input type="number" class="hab-condicion-turnos" data-id="${c.id}" min="1" value="${actual ? actual.turnos : c.turnos}" title="Turnos de duración">
              </div>`;
            }).join("")}
          </div>
          <p class="nota">Marca las condiciones y decide sus turnos. Al lanzar, si hay varias, podrás elegir cuáles aplicar.</p>
        </details>
        <details class="efecto-mecanico" ${bonos.length ? "open" : ""}>
          <summary>Bonos temporales (opcional)</summary>
          <div class="bono-tabla">
            <div class="bono-cabecera"><span>Estadística</span><span>Valor</span><span>Modo</span><span>Turnos</span><span>Acum.</span><span></span></div>
            <div class="hab-bonos-lista">${bonos.map(b => filaBonoHTML(b)).join("")}</div>
          </div>
          <button type="button" class="btn-secundario chico hab-add-bono">+ Añadir bono</button>
          <p class="nota">Los bonos se suman al lanzador mientras estén activos y bajan al pasar turno. «Acum.» hace que cada uso sume otro bono; sin marcar, el uso refresca el bono anterior.</p>
        </details>
      </div>
    </div>`;
}

// [UNDAVAR-PARTE-4.2h1-HABILIDADES] Lee una tarjeta de habilidad del editor
function leerHabilidadCard(card) {
  const campos = {};
  CAMPOS_EFECTO.forEach(k => {
    campos[k] = {
      valor: parseFloat(qs(`.hab-ef-${k}-valor`, card)?.value) || 0,
      modo: qs(`.hab-ef-${k}-modo`, card)?.value || "fijo",
      cuando: qs(`.hab-ef-${k}-cuando`, card)?.value || "inmediato",
      // [UNDAVAR-PARTE-4.2h4j-EFECTO-SIGNO] Aplicar suma marcas; quitar las cura
      signo: qs(`.hab-ef-${k}-signo`, card)?.value || "quitar"
    };
  });

  return {
    id: card.dataset.habId || nuevoId(),
    nombre: qs(".hab-nombre", card)?.value.trim() || "",
    modoUso: qs(".hab-modo", card)?.value || "dano",
    descripcion: qs(".hab-descripcion", card)?.value || "",
    conjuro: qs(".hab-conjuro", card)?.value || "",
    // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Daño y efecto en la misma tirada
    aplicaEfecto: !!qs(".hab-aplica-efecto", card)?.checked,
    efectoMecanico: {
      definido: true,
      objetivo: qs(".hab-ef-objetivo", card)?.value || "ambos",
      turnos: Math.max(1, parseInt(qs(".hab-ef-turnos", card)?.value, 10) || 1),
      campos
    },
    condiciones: qsa(".hab-condicion", card).filter(c => c.checked).map(c => ({
      id: c.value,
      turnos: Math.max(1, parseInt(qs(`.hab-condicion-turnos[data-id="${c.value}"]`, card)?.value, 10) || 1)
    })),
    bonos: qsa(".bono-fila", card).map(f => ({
      estadistica: qs(".bono-estadistica", f)?.value || "dano",
      valor: parseFloat(qs(".bono-valor", f)?.value) || 0,
      modo: qs(".bono-modo", f)?.value || "fijo",
      turnos: Math.max(1, parseInt(qs(".bono-turnos", f)?.value, 10) || 1),
      acumulativo: !!qs(".bono-acumulativo", f)?.checked
    })).filter(b => b.valor > 0),
    // [UNDAVAR-PARTE-4.2h3-PAREJA] Requisito configurable: nombres de armas separados por coma
    requisito: (() => {
      const armas = (qs(".hab-requisito-armas", card)?.value || "")
        .split(",").map(a => a.trim()).filter(Boolean);
      return armas.length ? { armas } : {};
    })()
  };
}

// [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] Lee una tarjeta de nivel de una habilidad
function leerNivelCard(card) {
  const n = Number(card.dataset.nivel) || 0;
  const camposN = {};
  CAMPOS_EFECTO.forEach(k => {
    camposN[k] = {
      valor: parseFloat(qs(`.nivel-ef-${k}-valor`, card)?.value) || 0,
      modo: qs(`.nivel-ef-${k}-modo`, card)?.value || "fijo",
      cuando: qs(`.nivel-ef-${k}-cuando`, card)?.value || "inmediato",
      signo: qs(`.nivel-ef-${k}-signo`, card)?.value || "quitar"
    };
  });
  return {
    nivel: n,
    descripcion: qs(".nivel-descripcion", card)?.value || "",
    aplicaEfecto: !!qs(".nivel-aplica-efecto", card)?.checked,
    bonos: qsa(".bono-fila", card).map(f => ({
      estadistica: qs(".bono-estadistica", f)?.value || "dano",
      valor: parseFloat(qs(".bono-valor", f)?.value) || 0,
      modo: qs(".bono-modo", f)?.value || "fijo",
      turnos: Math.max(1, parseInt(qs(".bono-turnos", f)?.value, 10) || 1),
      acumulativo: !!qs(".bono-acumulativo", f)?.checked
    })).filter(b => b.valor > 0),
    efectoMecanico: {
      definido: true,
      objetivo: qs(".nivel-ef-objetivo", card)?.value || "ambos",
      turnos: Math.max(1, parseInt(qs(".nivel-ef-turnos", card)?.value, 10) || 1),
      campos: camposN
    }
  };
}

// [UNDAVAR-PARTE-4.2h4k-SELECTOR-HABILIDADES] Activa una habilidad en el editor
function activarHabEditor(modal, habId) {
  if (!habId) return;
  modal.dataset.habActiva = habId;
  qsa(".hab-selector-btn", modal).forEach(b => b.classList.toggle("activo", b.dataset.habId === habId));
  qsa(".habilidad-card", modal).forEach(c => { c.style.display = c.dataset.habId === habId ? "" : "none"; });
  qsa(".niveles-hab", modal).forEach(g => { g.style.display = g.dataset.habId === habId ? "" : "none"; });
}

// [UNDAVAR-PARTE-4.2h4k-SELECTOR-HABILIDADES] Reconstruye los selectores tras añadir o eliminar
function refrescarSelectoresHabs(modal, activaId = "") {
  const lista = qsa(".habilidad-card", modal).map(c => ({
    id: c.dataset.habId,
    nombre: qs(".hab-nombre", c)?.value || "Habilidad"
  }));
  const activa = activaId || modal.dataset.habActiva || lista[0]?.id || "";
  ["ei-hab-selector", "ei-nivel-hab-selector"].forEach(id => {
    const cont = qs(`#${id}`, modal);
    if (!cont) return;
    cont.innerHTML = lista.map(h => `<button type="button" class="hab-selector-btn ${h.id === activa ? "activo" : ""}" data-hab-id="${esc(h.id)}">${esc(h.nombre)}</button>`).join("");
  });
  activarHabEditor(modal, activa);
}

// [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] Tarjeta editable de un nivel concreto
function nivelCardEditorHTML(v) {
  const n = Number(v.nivel) || 0;
  const danoNivelTxt = (x) => x === 0 ? "Daño por rango" : x === 1 ? "2d6+2" : x === 2 ? "2d6+3" : x === 3 ? "3d6+Atr/3" : "4d6+Atr/2";
  const efN = v.efectoMecanico ? normalizarEfecto(v.efectoMecanico) : null;
  const campoN = (k) => efN?.campos?.[k] || { valor: 0, modo: "fijo", cuando: "inmediato" };
  const filaN = (k, etiqueta) => {
    const c = campoN(k);
    const esMarca = ["hambre", "sed", "cansancio", "fatiga"].includes(k);
    return `
      <div class="efecto-fila">
        <span class="efecto-nombre">${etiqueta}</span>
        <div class="efecto-controles">
          <label class="efecto-control"><span>Valor</span><input type="number" class="nivel-ef-${k}-valor" min="0" value="${Number(c.valor) || 0}"></label>
          <label class="efecto-control"><span>Modo</span><select class="nivel-ef-${k}-modo">
            <option value="fijo" ${c.modo !== "pct" ? "selected" : ""}>Fijo</option>
            <option value="pct" ${c.modo === "pct" ? "selected" : ""}>%</option>
          </select></label>
          <label class="efecto-control"><span>Cuándo</span><select class="nivel-ef-${k}-cuando">
            <option value="inmediato" ${c.cuando !== "turno" ? "selected" : ""}>Inmediato</option>
            <option value="turno" ${c.cuando === "turno" ? "selected" : ""}>Por turno</option>
          </select></label>
          ${esMarca ? `<label class="efecto-control"><span>Dirección</span><select class="nivel-ef-${k}-signo">
            <option value="quitar" ${c.signo !== "aplicar" ? "selected" : ""}>Quitar</option>
            <option value="aplicar" ${c.signo === "aplicar" ? "selected" : ""}>Aplicar</option>
          </select></label>` : ""}
        </div>
      </div>`;
  };
  return `
    <details class="nivel-card" data-nivel="${n}">
      <summary>Nivel ${n} <span class="nota">· ${danoNivelTxt(n)} · ${n === 0 ? "2 PA" : `${costoPANivel(n)} PA`}${bonusCombate(n) ? ` · +${bonusCombate(n)} aciertos` : ""}</span></summary>
      <div class="campo-fila"><label>Descripción del nivel</label><textarea class="nivel-descripcion" rows="2">${esc(v.descripcion)}</textarea></div>
      <label class="campo-check"><input type="checkbox" class="nivel-aplica-efecto" ${v.aplicaEfecto ? "checked" : ""}> Aplica el efecto del nivel al hacer daño</label>
      <div class="bono-tabla">
        <div class="bono-cabecera"><span>Estadística</span><span>Valor</span><span>Modo</span><span>Turnos</span><span>Acum.</span><span></span></div>
        <div class="nivel-bonos-lista">${(Array.isArray(v.bonos) ? v.bonos : []).map(b => filaBonoHTML(b)).join("")}</div>
      </div>
      <button type="button" class="btn-secundario chico nivel-add-bono">+ Añadir bono</button>
      <details class="efecto-mecanico" ${efN?.definido ? "open" : ""}>
        <summary>Efecto mecánico del nivel</summary>
        <div class="efecto-tabla">
          ${filaN("salud", "Salud")}
          ${filaN("herida", "Herida")}
          ${filaN("hambre", "Hambre")}
          ${filaN("sed", "Sed")}
          ${filaN("cansancio", "Cansancio")}
          ${filaN("fatiga", "Fatiga")}
        </div>
        <div class="efecto-grid">
          <label>Turnos (para «por turno»)<input type="number" class="nivel-ef-turnos" min="1" value="${Math.max(1, Number(efN?.turnos) || 1)}"></label>
          <label>Objetivo<select class="nivel-ef-objetivo">
            <option value="ambos" ${(efN?.objetivo || "ambos") === "ambos" ? "selected" : ""}>Propio y otros</option>
            <option value="propio" ${efN?.objetivo === "propio" ? "selected" : ""}>Solo propio</option>
            <option value="otro" ${efN?.objetivo === "otro" ? "selected" : ""}>Solo otros</option>
          </select></label>
        </div>
        <p class="nota">Este efecto se suma al de la habilidad cuando el arte/arma está en este nivel.</p>
      </details>
    </details>`;
}

// [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] Grupo de niveles de una habilidad
function grupoNivelesHabilidadHTML(h, visible) {
  // [UNDAVAR-PARTE-9.2-NIVELES] Las variaciones del bestiario solo traen texto; se completan
  const vacio = (n) => ({ nivel: n, descripcion: "", bonos: [], aplicaEfecto: false, efectoMecanico: null });
  const vars = Array.from({ length: 5 }, (_, n) => {
    const v = variacionNivelHabilidad(h, n);
    if (!v) return vacio(n);
    return {
      nivel: n,
      descripcion: v.descripcion || "",
      bonos: Array.isArray(v.bonos) ? v.bonos : [],
      aplicaEfecto: !!v.aplicaEfecto,
      efectoMecanico: v.efectoMecanico || null
    };
  });
  return `<div class="niveles-hab" data-hab-id="${esc(h.id)}" style="${visible ? "" : "display:none"}">
    ${vars.map(nivelCardEditorHTML).join("")}
  </div>`;
}

// [UNDAVAR-PARTE-10.5-NIVELES] Tarjeta editable de un nivel de objeto
function nivelObjetoCardHTML(n, v = {}) {
  const efN = v.efectoMecanico ? normalizarEfecto(v.efectoMecanico) : null;
  const campoN = (k) => efN?.campos?.[k] || { valor: 0, modo: "fijo", cuando: "inmediato" };
  const filaN = (k, etiqueta) => {
    const c = campoN(k);
    const esMarca = ["hambre", "sed", "cansancio", "fatiga"].includes(k);
    return `
      <div class="efecto-fila">
        <span class="efecto-nombre">${etiqueta}</span>
        <div class="efecto-controles">
          <label class="efecto-control"><span>Valor</span><input type="number" class="nivel-ef-${k}-valor" min="0" value="${Number(c.valor) || 0}"></label>
          <label class="efecto-control"><span>Modo</span><select class="nivel-ef-${k}-modo">
            <option value="fijo" ${c.modo !== "pct" ? "selected" : ""}>Fijo</option>
            <option value="pct" ${c.modo === "pct" ? "selected" : ""}>%</option>
          </select></label>
          <label class="efecto-control"><span>Cuándo</span><select class="nivel-ef-${k}-cuando">
            <option value="inmediato" ${c.cuando !== "turno" ? "selected" : ""}>Inmediato</option>
            <option value="turno" ${c.cuando === "turno" ? "selected" : ""}>Por turno</option>
          </select></label>
          ${esMarca ? `<label class="efecto-control"><span>Dirección</span><select class="nivel-ef-${k}-signo">
            <option value="quitar" ${c.signo !== "aplicar" ? "selected" : ""}>Quitar</option>
            <option value="aplicar" ${c.signo === "aplicar" ? "selected" : ""}>Aplicar</option>
          </select></label>` : ""}
        </div>
      </div>`;
  };
  const bonos = Array.isArray(v.bonos) ? v.bonos : [];
  return `
    <details class="nivel-card" data-nivel="${n}">
      <summary>Nivel ${n} <span class="nota">· ${esc(v.duracion || "sin duración")} · ${bonos.length} bono${bonos.length === 1 ? "" : "s"}</span></summary>
      <div class="campo-fila"><label>Descripción del nivel</label><textarea class="nivel-descripcion" rows="2">${esc(v.descripcion || "")}</textarea></div>
      <div class="campo-fila"><label>Duración</label><input type="text" class="nivel-duracion" value="${esc(v.duracion || "")}" placeholder="1 turno, 2 usos..."></div>
      <div class="bono-tabla">
        <div class="bono-cabecera"><span>Estadística</span><span>Valor</span><span>Modo</span><span>Turnos</span><span>Acum.</span><span></span></div>
        <div class="nivel-bonos-lista">${bonos.map(b => filaBonoHTML(b)).join("")}</div>
      </div>
      <button type="button" class="btn-secundario chico nivel-add-bono">+ Añadir bono</button>
      <details class="efecto-mecanico" ${efN?.definido ? "open" : ""}>
        <summary>Efecto mecánico del nivel</summary>
        <div class="efecto-tabla">
          ${filaN("salud", "Salud")}
          ${filaN("herida", "Herida")}
          ${filaN("hambre", "Hambre")}
          ${filaN("sed", "Sed")}
          ${filaN("cansancio", "Cansancio")}
          ${filaN("fatiga", "Fatiga")}
        </div>
        <div class="efecto-grid">
          <label>Turnos (para «por turno»)<input type="number" class="nivel-ef-turnos" min="1" value="${Math.max(1, Number(efN?.turnos) || 1)}"></label>
          <label>Objetivo<select class="nivel-ef-objetivo">
            <option value="ambos" ${(efN?.objetivo || "ambos") === "ambos" ? "selected" : ""}>Propio y otros</option>
            <option value="propio" ${efN?.objetivo === "propio" ? "selected" : ""}>Solo propio</option>
            <option value="otro" ${efN?.objetivo === "otro" ? "selected" : ""}>Solo otros</option>
          </select></label>
        </div>
        <p class="nota">Este efecto se aplica al usar el ítem con este nivel.</p>
      </details>
    </details>`;
}

// [UNDAVAR-PARTE-10.5-NIVELES] Lee una tarjeta de nivel de objeto
function leerNivelObjetoCard(card) {
  const n = Number(card.dataset.nivel) || 0;
  const camposN = {};
  CAMPOS_EFECTO.forEach(k => {
    camposN[k] = {
      valor: parseFloat(qs(`.nivel-ef-${k}-valor`, card)?.value) || 0,
      modo: qs(`.nivel-ef-${k}-modo`, card)?.value || "fijo",
      cuando: qs(`.nivel-ef-${k}-cuando`, card)?.value || "inmediato",
      signo: qs(`.nivel-ef-${k}-signo`, card)?.value || "quitar"
    };
  });
  return {
    nivel: n,
    descripcion: qs(".nivel-descripcion", card)?.value || "",
    duracion: qs(".nivel-duracion", card)?.value || "",
    bonos: qsa(".nivel-bonos-lista .bono-fila", card).map(f => ({
      estadistica: qs(".bono-estadistica", f)?.value || "dano",
      valor: parseFloat(qs(".bono-valor", f)?.value) || 0,
      modo: qs(".bono-modo", f)?.value || "fijo",
      turnos: Math.max(1, parseInt(qs(".bono-turnos", f)?.value, 10) || 1),
      acumulativo: !!qs(".bono-acumulativo", f)?.checked
    })).filter(b => b.valor > 0),
    efectoMecanico: {
      definido: true,
      objetivo: qs(".nivel-ef-objetivo", card)?.value || "ambos",
      turnos: Math.max(1, parseInt(qs(".nivel-ef-turnos", card)?.value, 10) || 1),
      campos: camposN
    }
  };
}

// [UNDAVAR-PARTE-10.5-NIVELES] Bloque de niveles del editor de objetos
function nivelesObjetoEditorHTML(it) {
  const r = rangoNivelesItem(it);
  const activo = r.tiene;
  const min = activo ? r.min : 1;
  const max = activo ? r.max : min;
  const actual = activo ? r.actual : min;
  const venta = activo ? r.venta : min;
  const azar = activo ? r.aleatorio : false;
  const oculto = activo ? r.oculto : false;
  const tarjetas = [];
  for (let n = min; n <= max; n++) {
    tarjetas.push(nivelObjetoCardHTML(n, variacionNivelItem(it, n) || {}));
  }
  return `
    <details class="efecto-mecanico niveles-objeto" ${activo ? "open" : ""}>
      <summary>Niveles del objeto (opcional)</summary>
      <label class="campo-check"><input type="checkbox" id="ei-niveles-activo" ${activo ? "checked" : ""}> Usar niveles en este ítem</label>
      <div id="ei-niveles-controles" style="${activo ? "" : "display:none"}">
        <div class="efecto-grid">
          <label>Nivel mínimo<input type="number" id="ei-nivel-min" min="1" max="99" value="${min}"></label>
          <label>Nivel máximo<input type="number" id="ei-nivel-max" min="1" max="99" value="${max}"></label>
          <label>Nivel actual<input type="number" id="ei-nivel-actual" min="1" max="99" value="${actual}"></label>
          <label>Nivel de venta<input type="number" id="ei-nivel-venta" min="1" max="99" value="${venta}"></label>
        </div>
        <label class="campo-check"><input type="checkbox" id="ei-nivel-azar" ${azar ? "checked" : ""}> Nivel al azar al comprar o fabricar</label>
        <label class="campo-check"><input type="checkbox" id="ei-nivel-oculto" ${oculto ? "checked" : ""} ${azar ? "" : "disabled"}> Ocultar el nivel hasta usar el ítem</label>
        <p class="nota" id="ei-nivel-aviso">Sin azar el nivel es visible; por defecto Nv.1, o el nivel de venta si la tienda lo vende más alto. Con azar se sortea al comprar y se revela al usar.</p>
        <div id="ei-niveles-lista">${tarjetas.join("")}</div>
      </div>
    </details>`;
}

function abrirEditorItem(actor, tipo, id = null, ubicacionTarget = "", onGuardar = null) {
  // [UNDAVAR-PARTE-10.4-ARMAS] La plantilla de arma común se llama «arma»
  if (tipo === "arma_comun") tipo = "arma";
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

  // [UNDAVAR-PARTE-10.4-ARMAS] Elige plantilla de objeto o de gladiador
  const esGladiador = tipo === "arma" && !esArmaComun(it);
  const selectorTipoArma = tipo === "arma" ? `
    <div class="campo-fila">
      <label>Tipo de arma</label>
      <select id="ei-arma-comun">
        <option value="comun" ${!esGladiador ? "selected" : ""}>Arma común (objeto)</option>
        <option value="gladiador" ${esGladiador ? "selected" : ""}>Arma de gladiador (nivel y habilidades)</option>
      </select>
    </div>
    <p class="nota">Si cambias el tipo, guarda y vuelve a abrir para completar los campos de la otra plantilla.</p>` : "";

  const camposComunes = `<div class="campo-fila"><label>Nombre</label><input type="text" id="ei-nombre" value="${esc(it.name)}"></div>${selectorTipoArma}`;
  let camposEspecificos = "";

  // [UNDAVAR-PARTE-4.2e1-PRECIOS] Moneda visible en cada campo de precio
  const bloquePrecios = `
      <div class="campo-fila precios"><label>Precio</label>
        <div class="precio-campo"><span>Oro</span><input type="number" id="ei-precio-oro" min="0" step="0.01" placeholder="0" value="${it.system.precio_oro || 0}"></div>
        <div class="precio-campo"><span>Rubí</span><input type="number" id="ei-precio-rubi" min="0" step="0.01" placeholder="0" value="${it.system.precio_rubi || 0}"></div>
        <div class="precio-campo"><span>Diamante</span><input type="number" id="ei-precio-diamante" min="0" step="0.01" placeholder="0" value="${it.system.precio_diamante || 0}"></div>
      </div>`;

  // [UNDAVAR-PARTE-4.2e2-EFECTOS] Bloque de efecto por campo para objetos, elixires y alimentos
  const efActual = efectoMecanicoItem(it) || { campos: {}, turnos: 1, objetivo: "ambos" };
  const campoActual = (k) => efActual.campos?.[k] || { valor: 0, modo: "fijo", cuando: "inmediato" };
  const filaEfecto = (k, etiqueta) => {
    const c = campoActual(k);
    const esMarca = ["hambre", "sed", "cansancio", "fatiga"].includes(k);
    return `
      <div class="efecto-fila">
        <span class="efecto-nombre">${etiqueta}</span>
        <div class="efecto-controles">
          <label class="efecto-control"><span>Valor</span><input type="number" id="ei-ef-${k}-valor" min="0" value="${Number(c.valor) || 0}"></label>
          <label class="efecto-control"><span>Modo</span><select id="ei-ef-${k}-modo">
            <option value="fijo" ${c.modo !== "pct" ? "selected" : ""}>Fijo</option>
            <option value="pct" ${c.modo === "pct" ? "selected" : ""}>%</option>
          </select></label>
          <label class="efecto-control"><span>Cuándo</span><select id="ei-ef-${k}-cuando">
            <option value="inmediato" ${c.cuando !== "turno" ? "selected" : ""}>Inmediato</option>
            <option value="turno" ${c.cuando === "turno" ? "selected" : ""}>Por turno</option>
          </select></label>
          ${esMarca ? `<label class="efecto-control"><span>Dirección</span><select id="ei-ef-${k}-signo">
            <option value="quitar" ${c.signo !== "aplicar" ? "selected" : ""}>Quitar</option>
            <option value="aplicar" ${c.signo === "aplicar" ? "selected" : ""}>Aplicar</option>
          </select></label>` : ""}
        </div>
      </div>`;
  };
  const bloqueEfecto = `
    <details class="efecto-mecanico" ${efActual.definido ? "open" : ""}>
      <summary>Efecto mecánico (opcional)</summary>
      <div class="efecto-tabla">
        ${filaEfecto("salud", "Salud")}
        ${filaEfecto("herida", "Herida")}
        ${filaEfecto("hambre", "Hambre")}
        ${filaEfecto("sed", "Sed")}
        ${filaEfecto("cansancio", "Cansancio")}
        ${filaEfecto("fatiga", "Fatiga")}
      </div>
      <div class="efecto-grid">
        <label>Turnos (para «por turno»)<input type="number" id="ei-ef-turnos" min="1" value="${Math.max(1, Number(efActual.turnos) || 1)}"></label>
        <label>Objetivo<select id="ei-ef-objetivo">
          <option value="ambos" ${efActual.objetivo === "ambos" || !efActual.objetivo ? "selected" : ""}>Propio y otros</option>
          <option value="propio" ${efActual.objetivo === "propio" ? "selected" : ""}>Solo propio</option>
          <option value="otro" ${efActual.objetivo === "otro" ? "selected" : ""}>Solo otros</option>
        </select></label>
      </div>
      <p class="nota">«Fijo» usa puntos o marcas. «%» usa el máximo real: Salud máxima, 8 heridas y 9 marcas. En marcas, «Aplicar» suma y «Quitar» cura; 99 fijo (o 100%) quita todas. Los campos «por turno» se aplican al usarlo y otra vez en cada turno siguiente.</p>
    </details>`;

  // [UNDAVAR-PARTE-4.2e4-BONOS] Bloque de bonos temporales
  const bonosActuales = Array.isArray(it.system.bonos) ? it.system.bonos : [];
  const bloqueBonos = `
    <details class="efecto-mecanico" ${bonosActuales.length ? "open" : ""}>
      <summary>Bonos temporales (opcional)</summary>
      <div class="bono-tabla">
        <div class="bono-cabecera"><span>Estadística</span><span>Valor</span><span>Modo</span><span>Turnos</span><span>Acum.</span><span></span></div>
        <div id="ei-bonos-lista">
          ${bonosActuales.map(b => filaBonoHTML(b)).join("")}
        </div>
      </div>
      <button type="button" class="btn-secundario chico" id="ei-add-bono">+ Añadir bono</button>
      <p class="nota">Los bonos se suman mientras estén activos y bajan al pasar turno. «%» usa el máximo real en Salud, Herida y marcas; en el resto usa el valor base.</p>
    </details>`;

  const opcionGlobalTiendas = (esTienda && esNuevo) ? `
    <div class="campo-fila" style="margin-top: 10px; background: rgba(212,175,55,0.1); padding: 8px; border-radius: 4px; border: 1px solid rgba(212,175,55,0.3);">
      <label style="color:#d4af37; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="ei-global-tiendas" style="width:16px; height:16px; cursor:pointer;">
        🌐 Añadir a todas las tiendas registradas
      </label>
    </div>` : "";

  if (tipo === "arte" || (tipo === "arma" && esGladiador)) {
    // [UNDAVAR-PARTE-10.4-ARMAS] Las armas de gladiador usan la plantilla de arte
    // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Lista editable de habilidades
    const habs = habilidadesItem(it);
    const listaHabs = habs.length ? habs : [{
      id: nuevoId(),
      nombre: it.name || "Habilidad 1",
      modoUso: it.system.modoUso || "dano",
      descripcion: it.system.descripcion || "",
      conjuro: it.system.conjuro || "",
      efectoMecanico: it.system.efectoMecanico || null,
      condiciones: it.system.condiciones || [],
      bonos: []
    }];
    // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Nombre claro para la primera habilidad nueva
    if (esNuevo && listaHabs.length === 1) listaHabs[0].nombre = "Habilidad 1";

    // [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] Cada habilidad tiene sus propios niveles
    const habActivaId = listaHabs[0]?.id || "";
    // [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] Las tarjetas de nivel usan nivelCardEditorHTML()
    // [UNDAVAR-PARTE-4.2h4k-SELECTOR-HABILIDADES] Botones para cambiar de habilidad
    const selectorHabsHTML = (lista, activaId, id) => `
      <div class="hab-selector" id="${id}">
        ${lista.map(h => `<button type="button" class="hab-selector-btn ${h.id === activaId ? "activo" : ""}" data-hab-id="${esc(h.id)}">${esc(h.nombre || "Habilidad")}</button>`).join("")}
      </div>`;

    const tabsEditor = [
      { id: "basico", nombre: "Básico" },
      { id: "habilidades", nombre: "Habilidades" },
      { id: "niveles", nombre: "Niveles" }
    ];
    if (esTienda || tipo === "arma") tabsEditor.push({ id: "precios", nombre: "Precios" });

    camposEspecificos = `
      <!-- [UNDAVAR-PARTE-4.2h4j-EDITOR-TABS] Pestañas para cortar el scroll del editor -->
      <div class="editor-tabs" id="ei-tabs">
        ${tabsEditor.map((t, i) => `<button type="button" class="editor-tab ${i === 0 ? "activo" : ""}" data-tab="${t.id}">${t.nombre}</button>`).join("")}
      </div>
      <div class="editor-panel activo" data-panel="basico">
        <div class="campo-fila"><label>Nivel (0-4)</label><input type="number" id="ei-nivel" min="0" max="4" value="${it.system.nivel || 0}"></div>
        <div class="campo-fila"><label>Enfriamiento (turnos)</label><input type="number" id="ei-enfriamiento-turnos" min="0" value="${Number(it.system.enfriamientoTurnos) || 0}"></div>
        <p class="nota">El nivel y el enfriamiento son del arte/arma, no de cada habilidad.</p>
      </div>
      <div class="editor-panel" data-panel="habilidades">
        ${selectorHabsHTML(listaHabs, habActivaId, "ei-hab-selector")}
        <div class="habilidades-lista" id="ei-habilidades">
          ${listaHabs.map((h, i) => habilidadCardHTML(h, i === 0)).join("")}
        </div>
        <button type="button" class="btn-secundario chico" id="ei-add-habilidad">+ Añadir habilidad</button>
        <p class="nota">Elige una habilidad arriba para configurarla. Cada una tiene su modo, efecto, condiciones y bonos.</p>
      </div>
      <div class="editor-panel" data-panel="niveles">
        ${selectorHabsHTML(listaHabs, habActivaId, "ei-nivel-hab-selector")}
        <p class="nota">El daño, los PA y los aciertos son los del manual. Aquí configuras lo que cambia con el nivel para la habilidad elegida.</p>
        <div id="ei-niveles-lista">
          ${listaHabs.map((h, i) => grupoNivelesHabilidadHTML(h, i === 0)).join("")}
        </div>
      </div>
      ${(esTienda || tipo === "arma") ? `<div class="editor-panel" data-panel="precios">${bloquePrecios}</div>` : ""}`;
  } else if (tipo === "objeto" || tipo === "elixir" || (tipo === "arma" && !esGladiador)) {
    // [UNDAVAR-PARTE-10.4-ARMAS] El arma común usa exactamente la plantilla de objeto
    camposEspecificos = `
      <div class="campo-fila"><label>Cantidad</label><input type="number" id="ei-cantidad" min="0" value="${it.system.cantidad || 1}"></div>
      <div class="campo-fila"><label>Efecto / Descripción</label><textarea id="ei-efecto" rows="2">${esc(it.system.efecto || it.system.descripcion)}</textarea></div>
      <div class="campo-fila"><label>Duración</label><input type="text" id="ei-duracion" value="${esc(it.system.duracion)}"></div>
      <div class="campo-fila"><label>Enfriamiento (turnos)</label><input type="number" id="ei-enfriamiento-turnos" min="0" value="${Number(it.system.enfriamientoTurnos) || parseTurnos(it.system.enfriamiento)}"></div>
      <label class="campo-check"><input type="checkbox" id="ei-consumible" ${it.system.consumible !== false ? "checked" : ""}> Consumible (se gasta al usar)</label>
      ${bloquePrecios}${bloqueEfecto}${bloqueBonos}${nivelesObjetoEditorHTML(it)}`;
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
      ${bloquePrecios}${bloqueBonos}`;
  }

  // [UNDAVAR-PARTE-10.4-ARMAS] Título claro según la plantilla del arma
  const tipoVisible = tipo === "arma" ? (esGladiador ? "arma de gladiador" : "arma común") : tipo;
  const modal = crearModal(
    `${esNuevo ? "Nuevo" : "Editar"} ${tipoVisible}`,
    `${camposComunes}${camposEspecificos}${opcionGlobalTiendas}<div class="modal-acciones"><button class="btn-primario" id="ei-guardar">Guardar</button></div>`
  );

  // [UNDAVAR-PARTE-4.2e4-BONOS] Añadir y quitar filas de bonos
  qs("#ei-add-bono", modal)?.addEventListener("click", () => {
    qs("#ei-bonos-lista", modal)?.insertAdjacentHTML("beforeend", filaBonoHTML({}));
  });
  qs("#ei-bonos-lista", modal)?.addEventListener("click", (e) => {
    if (e.target.closest(".bono-quitar")) e.target.closest(".bono-fila")?.remove();
  });

  // [UNDAVAR-PARTE-10.5-NIVELES] Controles del rango de niveles del objeto
  const nivelesCont = qs("#ei-niveles-controles", modal);
  if (nivelesCont) {
    const listaNiveles = qs("#ei-niveles-lista", modal);
    const chkActivo = qs("#ei-niveles-activo", modal);
    const inpMin = qs("#ei-nivel-min", modal);
    const inpMax = qs("#ei-nivel-max", modal);
    const inpActual = qs("#ei-nivel-actual", modal);
    const inpVenta = qs("#ei-nivel-venta", modal);
    const chkAzar = qs("#ei-nivel-azar", modal);
    const chkOculto = qs("#ei-nivel-oculto", modal);

    // [UNDAVAR-PARTE-10.5-NIVELES] Rehace las tarjetas conservando lo ya escrito
    const refrescarNiveles = () => {
      const min = Math.max(1, Math.min(99, parseInt(inpMin.value, 10) || 1));
      const max = Math.max(min, Math.min(99, parseInt(inpMax.value, 10) || min));
      inpMin.value = min;
      inpMax.value = max;
      const previas = new Map(qsa(".nivel-card", listaNiveles).map(c => [Number(c.dataset.nivel), leerNivelObjetoCard(c)]));
      let html = "";
      for (let n = min; n <= max; n++) html += nivelObjetoCardHTML(n, previas.get(n) || {});
      listaNiveles.innerHTML = html;
      [inpActual, inpVenta].forEach(inp => {
        if (!inp) return;
        inp.min = min;
        inp.max = max;
        inp.value = Math.max(min, Math.min(max, parseInt(inp.value, 10) || min));
      });
    };

    chkActivo?.addEventListener("change", () => {
      nivelesCont.style.display = chkActivo.checked ? "" : "none";
      if (chkActivo.checked && !qsa(".nivel-card", listaNiveles).length) refrescarNiveles();
    });
    inpMin?.addEventListener("change", refrescarNiveles);
    inpMax?.addEventListener("change", refrescarNiveles);
    chkAzar?.addEventListener("change", () => {
      if (!chkOculto) return;
      chkOculto.disabled = !chkAzar.checked;
      if (!chkAzar.checked) chkOculto.checked = false;
    });
  }

  // [UNDAVAR-PARTE-4.2h4j-EDITOR-TABS] Pestañas del editor de artes y armas
  qs("#ei-tabs", modal)?.addEventListener("click", (e) => {
    const btn = e.target.closest(".editor-tab");
    if (!btn) return;
    qsa(".editor-tab", modal).forEach(b => b.classList.toggle("activo", b === btn));
    qsa(".editor-panel", modal).forEach(p => p.classList.toggle("activo", p.dataset.panel === btn.dataset.tab));
  });
  // [UNDAVAR-PARTE-4.2h4j-EDITOR-TABS] Bonos dentro de la variación de cada nivel
  modal.addEventListener("click", (e) => {
    if (e.target.closest(".nivel-add-bono")) {
      const card = e.target.closest(".nivel-card");
      qs(".nivel-bonos-lista", card)?.insertAdjacentHTML("beforeend", filaBonoHTML({}));
    }
    if (e.target.closest(".bono-quitar") && e.target.closest(".nivel-card")) {
      e.target.closest(".bono-fila")?.remove();
    }
  });

  // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Añadir, duplicar, eliminar y bonos por habilidad
  const contHabs = qs("#ei-habilidades", modal);
  const contNiveles = qs("#ei-niveles-lista", modal);
  if (contHabs) {
    // [UNDAVAR-PARTE-4.2h4k-SELECTOR-HABILIDADES] Cambia la habilidad visible
    modal.addEventListener("click", (e) => {
      const btn = e.target.closest(".hab-selector-btn");
      if (btn) activarHabEditor(modal, btn.dataset.habId);
    });

    contHabs.addEventListener("change", (e) => {
      if (e.target.classList.contains("hab-modo")) {
        const card = e.target.closest(".habilidad-card");
        const et = qs(".hab-modo-etiqueta", card);
        if (et) et.textContent = etiquetaModoUso(e.target.value);
      }
      // [UNDAVAR-PARTE-4.2h4k-SELECTOR-HABILIDADES] Renombra el botón al cambiar el nombre
      if (e.target.classList.contains("hab-nombre")) refrescarSelectoresHabs(modal);
    });

    contHabs.addEventListener("click", (e) => {
      const card = e.target.closest(".habilidad-card");
      if (!card) return;

      if (e.target.closest(".hab-eliminar")) {
        if (qsa(".habilidad-card", contHabs).length <= 1) {
          notificar("⚠️ Debe quedar al menos una habilidad.");
          return;
        }
        const id = card.dataset.habId;
        card.remove();
        qs(`.niveles-hab[data-hab-id="${id}"]`, modal)?.remove();
        refrescarSelectoresHabs(modal);
        return;
      }

      if (e.target.closest(".hab-duplicar")) {
        const copia = leerHabilidadCard(card);
        copia.id = nuevoId();
        copia.nombre = `${copia.nombre || "Habilidad"} (copia)`;
        // [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] Copia también los niveles de la habilidad
        const grupo = qs(`.niveles-hab[data-hab-id="${card.dataset.habId}"]`, modal);
        copia.variacionesNivel = grupo ? qsa(".nivel-card", grupo).map(leerNivelCard) : [];
        contHabs.insertAdjacentHTML("beforeend", habilidadCardHTML(copia, false));
        contNiveles?.insertAdjacentHTML("beforeend", grupoNivelesHabilidadHTML(copia, false));
        refrescarSelectoresHabs(modal, copia.id);
        return;
      }

      if (e.target.closest(".hab-add-bono")) {
        qs(".hab-bonos-lista", card)?.insertAdjacentHTML("beforeend", filaBonoHTML({}));
        return;
      }

      if (e.target.closest(".bono-quitar")) {
        e.target.closest(".bono-fila")?.remove();
      }
    });

    qs("#ei-add-habilidad", modal)?.addEventListener("click", () => {
      const nueva = {
        id: nuevoId(),
        nombre: `Habilidad ${qsa(".habilidad-card", contHabs).length + 1}`,
        modoUso: "dano"
      };
      contHabs.insertAdjacentHTML("beforeend", habilidadCardHTML(nueva, false));
      contNiveles?.insertAdjacentHTML("beforeend", grupoNivelesHabilidadHTML(nueva, false));
      refrescarSelectoresHabs(modal, nueva.id);
    });
  }

  qs("#ei-guardar", modal).addEventListener("click", async () => {
    // 1. EXTRAER PRIMERO LOS DATOS DE LOS INPUTS DEL MODAL
    it.name = qs("#ei-nombre", modal).value.trim() || ("Nuevo " + tipo);
    it.type = tipo;

    // [UNDAVAR-PARTE-10.4-ARMAS] El selector decide la plantilla que se guarda
    let esGladiadorGuardado = esGladiador;
    if (tipo === "arma") {
      const eleccion = qs("#ei-arma-comun", modal)?.value;
      if (eleccion === "gladiador") esGladiadorGuardado = true;
      else if (eleccion === "comun") esGladiadorGuardado = false;
    }

    if (tipo === "arte" || (tipo === "arma" && esGladiadorGuardado)) {
      // [UNDAVAR-PARTE-10.4-ARMAS] Conserva el nivel si se convierte desde un objeto
      const nivelInput = qs("#ei-nivel", modal);
      it.system.nivel = nivelInput
        ? Math.max(0, Math.min(4, parseInt(nivelInput.value) || 0))
        : (Number(it.system.nivel) || 0);
      const enfriamientoInput = qs("#ei-enfriamiento-turnos", modal);
      if (enfriamientoInput) it.system.enfriamientoTurnos = Math.max(0, parseInt(enfriamientoInput.value, 10) || 0);

      // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Guarda la lista y sincroniza la primera
      const habs = qsa(".habilidad-card", modal).map(leerHabilidadCard);
      if (habs.length) {
        it.system.habilidades = habs;
        const primera = habs[0];
        it.system.modoUso = primera?.modoUso || "dano";
        it.system.conjuro = primera?.conjuro || "";
        it.system.descripcion = primera?.descripcion || "";
        it.system.efectoMecanico = primera?.efectoMecanico || null;
        it.system.condiciones = primera?.condiciones || [];

        // [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] Asigna a cada habilidad sus propios niveles
        habs.forEach(h => {
          const grupo = qs(`.niveles-hab[data-hab-id="${h.id}"]`, modal);
          h.variacionesNivel = grupo ? qsa(".nivel-card", grupo).map(leerNivelCard) : [];
        });
        // La variación genérica antigua ya no se usa
        delete it.system.variacionesNivel;
      } else {
        // [UNDAVAR-PARTE-10.4-ARMAS] Conversión desde arma común: conserva lo que hubiera
        it.system.habilidades = Array.isArray(it.system.habilidades) ? it.system.habilidades : [];
        it.system.modoUso = it.system.modoUso || "dano";
      }

      const pOro = qs("#ei-precio-oro", modal);
      if (pOro) {
        it.system.precio_oro = parseFloat(pOro.value) || 0;
        it.system.precio_rubi = parseFloat(qs("#ei-precio-rubi", modal)?.value) || 0;
        it.system.precio_diamante = parseFloat(qs("#ei-precio-diamante", modal)?.value) || 0;
      }
      it.system.armaComun = false;
    } else if (tipo === "objeto" || tipo === "elixir" || (tipo === "arma" && !esGladiadorGuardado)) {
      // [UNDAVAR-PARTE-10.4-ARMAS] El arma común se guarda como objeto
      const cantInput = qs("#ei-cantidad", modal);
      it.system.cantidad = cantInput ? (parseInt(cantInput.value) || 1) : (Number(it.system.cantidad) || 1);
      const efectoInput = qs("#ei-efecto", modal);
      const textoEfecto = efectoInput ? efectoInput.value : (it.system.efecto || it.system.descripcion || "");
      it.system.efecto = textoEfecto;
      it.system.descripcion = textoEfecto; // Guarda en ambos campos por compatibilidad
      const duracionInput = qs("#ei-duracion", modal);
      if (duracionInput) it.system.duracion = duracionInput.value;
      // [UNDAVAR-PARTE-4.2e3-TURNO] Consumible y enfriamiento numérico
      const enfriamientoInput = qs("#ei-enfriamiento-turnos", modal);
      if (enfriamientoInput) {
        const enfriamientoNum = Math.max(0, parseInt(enfriamientoInput.value, 10) || 0);
        it.system.enfriamientoTurnos = enfriamientoNum;
        it.system.enfriamiento = enfriamientoNum > 0 ? `${enfriamientoNum} turno${enfriamientoNum === 1 ? "" : "s"}` : "";
      }
      const consumibleInput = qs("#ei-consumible", modal);
      if (consumibleInput) it.system.consumible = consumibleInput.checked;
      // [UNDAVAR-PARTE-4.2e4-BONOS] Guarda los bonos temporales del ítem
      if (qs("#ei-bonos-lista", modal)) {
        it.system.bonos = qsa(".bono-fila", modal).map(f => ({
          estadistica: qs(".bono-estadistica", f)?.value || "dano",
          valor: parseFloat(qs(".bono-valor", f)?.value) || 0,
          modo: qs(".bono-modo", f)?.value || "fijo",
          turnos: Math.max(1, parseInt(qs(".bono-turnos", f)?.value, 10) || 1),
          acumulativo: !!qs(".bono-acumulativo", f)?.checked
        })).filter(b => b.valor > 0);
      }
      // [UNDAVAR-PARTE-10.5-NIVELES] Guarda el rango y la configuración por nivel
      const nivelesActivo = !!qs("#ei-niveles-activo", modal)?.checked;
      if (nivelesActivo) {
        const min = Math.max(1, Math.min(99, parseInt(qs("#ei-nivel-min", modal)?.value, 10) || 1));
        const max = Math.max(min, Math.min(99, parseInt(qs("#ei-nivel-max", modal)?.value, 10) || min));
        const venta = Math.max(min, Math.min(max, parseInt(qs("#ei-nivel-venta", modal)?.value, 10) || min));
        const azar = !!qs("#ei-nivel-azar", modal)?.checked;
        it.system.nivelMin = min;
        it.system.nivelMax = max;
        it.system.nivelVenta = venta;
        it.system.nivelAleatorio = azar;
        it.system.nivelOculto = azar && !!qs("#ei-nivel-oculto", modal)?.checked;
        it.system.variacionesNivel = qsa("#ei-niveles-lista .nivel-card", modal).map(leerNivelObjetoCard);
        // [UNDAVAR-PARTE-10.5-NIVELES] El Sabio puede corregir el nivel actual desde el editor
        const actual = parseInt(qs("#ei-nivel-actual", modal)?.value, 10) || min;
        it.system.nivelActual = Math.max(min, Math.min(max, actual));
        it.system.nivel = min === max ? String(min) : `${min}-${max}`;
      } else {
        it.system.nivelMin = 0;
        it.system.nivelMax = 0;
        it.system.nivelVenta = 0;
        it.system.nivelAleatorio = false;
        it.system.nivelOculto = false;
        it.system.nivelActual = 0;
        it.system.variacionesNivel = [];
        it.system.nivel = "";
      }
      const pOro = qs("#ei-precio-oro", modal);
      if (pOro) {
        it.system.precio_oro = parseFloat(pOro.value) || 0;
        it.system.precio_rubi = parseFloat(qs("#ei-precio-rubi", modal)?.value) || 0;
        it.system.precio_diamante = parseFloat(qs("#ei-precio-diamante", modal)?.value) || 0;
      }
      // [UNDAVAR-PARTE-4.2e2-EFECTOS] Guarda el efecto por campo definido por el usuario
      if (qs("#ei-ef-salud-valor", modal)) {
        const camposEfecto = {};
        CAMPOS_EFECTO.forEach(k => {
          camposEfecto[k] = {
            valor: parseFloat(qs(`#ei-ef-${k}-valor`, modal)?.value) || 0,
            modo: qs(`#ei-ef-${k}-modo`, modal)?.value || "fijo",
            cuando: qs(`#ei-ef-${k}-cuando`, modal)?.value || "inmediato",
            // [UNDAVAR-PARTE-4.2h4j-EFECTO-SIGNO] Dirección configurable de cada marca
            signo: qs(`#ei-ef-${k}-signo`, modal)?.value || "quitar"
          };
        });
        it.system.efectoMecanico = {
          definido: true,
          objetivo: qs("#ei-ef-objetivo", modal)?.value || "ambos",
          turnos: Math.max(1, parseInt(qs("#ei-ef-turnos", modal)?.value, 10) || 1),
          campos: camposEfecto
        };
      }
      if (tipo === "arma") it.system.armaComun = true;
    } else if (tipo === "equipo") {
      it.system.cantidad = parseInt(qs("#ei-cantidad", modal)?.value) || 1;
      it.system.slot = qs("#ei-slot", modal)?.value || "superior";
      it.system.reduccion_dano = parseFloat(qs("#ei-reduccion", modal)?.value) || 0;
      const textoEfecto = qs("#ei-efecto", modal)?.value || "";
      it.system.efecto = textoEfecto;
      it.system.descripcion = textoEfecto;
      it.system.enfriamiento = qs("#ei-enfriamiento", modal)?.value || "";
      // [UNDAVAR-PARTE-4.2e4-BONOS] Guarda los bonos temporales del equipo
      it.system.bonos = qsa(".bono-fila", modal).map(f => ({
        estadistica: qs(".bono-estadistica", f)?.value || "dano",
        valor: parseFloat(qs(".bono-valor", f)?.value) || 0,
        modo: qs(".bono-modo", f)?.value || "fijo",
        turnos: Math.max(1, parseInt(qs(".bono-turnos", f)?.value, 10) || 1),
      acumulativo: !!qs(".bono-acumulativo", f)?.checked
      })).filter(b => b.valor > 0);
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
        copiaItem.id = nuevoId();

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

    // [UNDAVAR-PARTE-4.2d] Callback opcional tras guardar (entrenamiento completado)
    if (typeof onGuardar === "function") await onGuardar(it);

    modal.remove();
    render();
  });
}

// ------------------------------------------------------------
// LISTENERS GLOBALES DE INVENTARIO (Desplegable y Modal Custom)
// ------------------------------------------------------------
// [UNDAVAR-PARTE-3.9] Resuelve la ficha dueña de un elemento de inventario
async function fichaDesdeEvento(e) {
  const cont = e.target?.closest?.("[data-ficha-store]");
  if (!cont) return null;
  const store = cont.dataset.fichaStore;
  const id = cont.dataset.fichaId;
  if (!store || !id) return null;
  const actor = await dbGet(store, id);
  return actor ? { actor, store } : null;
}

document.addEventListener("change", async (e) => {
  if (e.target && e.target.classList.contains("sel-mover-item")) {
    const itemId = e.target.dataset.id;
    const nuevaUbicacion = e.target.value;

    const ficha = await fichaDesdeEvento(e);
    if (!ficha) return;
    const { actor: personActual, store } = ficha;

    const item = personActual.items.find(i => i.id === itemId);
    if (item) {
      if (!item.system) item.system = {};
      item.system.ubicacionId = nuevaUbicacion;

      await dbPut(store, personActual);
      if (typeof render === "function") render();
    }
  }
});

document.addEventListener("click", async (e) => {
  const ficha = await fichaDesdeEvento(e);
  if (!ficha) return;
  const { actor: personActual, store } = ficha;

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

  // [UNDAVAR-PARTE-9.5-RECETAS] Abre el taller de recetas del inventario
  if (e.target && e.target.id === "btn-abrir-taller") {
    await abrirTaller(personActual);
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
      if (modalTitulo) modalTitulo.textContent = "📦 Nuevo contenedor";
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

    if (modalTitulo) modalTitulo.textContent = "⚙️ Editar contenedor";
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

    await dbPut(store, personActual);
    if (modal) modal.style.display = "none";
    if (typeof render === "function") render();
  }

  if (e.target && e.target.id === "btn-eliminar-contenedor") {
    const idExistente = inputId ? inputId.value : "";
    if (!idExistente) return;

    // [UNDAVAR-PARTE-3.9] Diálogo propio, sin confirm nativo
    const ok = await confirmarAccion("Eliminar contenedor", "¿Seguro que deseas borrar este contenedor? Los objetos dentro volverán a 'Bolsillos / En mano'.", "Eliminar");
    if (ok) {
      personActual.items.forEach(i => {
        if (i.system?.ubicacionId === idExistente) {
          i.system.ubicacionId = "";
        }
      });

      personActual.items = personActual.items.filter(i => i.id !== idExistente);

      await dbPut(store, personActual);
      if (modal) modal.style.display = "none";
      if (typeof render === "function") render();
    }
  }
});

// ------------------------------------------------------------
// VISTA: FICHA DE PNJ / BESTIA
// ------------------------------------------------------------
// [UNDAVAR-PARTE-3.9] Etiquetas de las pestañas del PNJ
function etiquetaSubtabNPC(t) {
  return { datos: "Datos", siervo: "Siervo", artes: "Artes y armas", inventario: "Inventario", equipo: "Equipo", estado: "Estado", referencia: "Referencia" }[t];
}

// [UNDAVAR-PARTE-9.3-SIERVOS] Vínculo normalizado con el amo
function siervoDe(actor) {
  const sv = actor?.system?.datos?.siervo || {};
  const tipo = TIPOS_SIERVO[sv.tipo] ? sv.tipo : "";
  // [UNDAVAR-PARTE-9.3-SIERVOS] El P.O vive en Puntos y Marcas para no duplicar contadores
  const poEstado = actor?.system?.puntosYMarcas?.po?.value;
  return {
    tipo,
    amoId: sv.amoId || "",
    po: Math.max(0, Math.min(3, Number(poEstado ?? sv.po) || 0)),
    edad: Math.max(0, Math.min(7, Number(sv.edad) || 0)),
    salario: Math.max(0, Number(sv.salario) || 0),
    pagado: !!sv.pagado,
    ultimoPago: Number(sv.ultimoPago) || 0,
    enUso: !!sv.enUso
  };
}

function esSiervo(actor) {
  return !!siervoDe(actor).tipo;
}

// [UNDAVAR-PARTE-3.9a] PA máximo real del PNJ: null cuando «Sin PA» está marcado
function paMaximoNPC(actor, calc) {
  const s = actor?.system || {};
  if (s.datos?.sinRangoPA) return null;

  const nombreRango = s.datos?.rangoManual || calc?.rango || "Sin rango";
  const matchRango = typeof RANGOS_UNDAVAR !== "undefined"
    ? RANGOS_UNDAVAR.find(r => r.nombre === nombreRango)
    : null;

  if (matchRango && typeof calcularPAMax === "function") {
    // [UNDAVAR-PARTE-9.3-PA] Los siervos nunca pasan de 6 PA
    const base = calcularPAMax(matchRango.minPV);
    return esSiervo(actor) ? Math.min(SIERVO_PA_MAXIMO, base) : base;
  }
  const base = Math.max(1, Number(calc?.paMaximo) || Number(s.pa?.max) || 2);
  return esSiervo(actor) ? Math.min(SIERVO_PA_MAXIMO, base) : base;
}

// [UNDAVAR-PARTE-3.9] Cabecera editorial del PNJ
function cabeceraNPC(actor, calc, rangoActual, esModoBestia, soloLectura = false) {
  const s = actor.system;
  const d = s.datos || {};
  const meta = [d.raza, esModoBestia ? "Bestia / criatura" : rangoActual].filter(Boolean).join(" · ");
  const paMax = paMaximoNPC(actor, calc);
  const paVal = paMax === null ? null : Math.min(paMax, Math.max(0, Number(s.pa?.value) || 0));

  return `
  <header class="ed-ficha-cabecera">
    <div class="ed-ficha-identidad">
      <div class="ed-volver-fila">
        <button class="ed-volver" id="btn-volver-lista">← Lista</button>
        <button class="ed-volver" id="btn-volver">← Inicio</button>
      </div>
      <div class="ed-eyebrow">PNJ · Ficha del Sabio Regidor</div>
      ${soloLectura
        ? `<h1 class="ed-titulo-texto">${esc(actor.nombre)}</h1>`
        : `<input type="text" id="campo-nombre" class="ed-titulo-input" value="${esc(actor.nombre)}" placeholder="Nombre del PNJ" aria-label="Nombre del PNJ">`}
      ${meta ? `<p class="ed-ficha-meta">${esc(meta)}</p>` : ""}
      <div class="ed-badges">
        ${!esModoBestia && rangoActual ? `<span class="ed-badge oro">${esc(rangoActual)}</span>` : ""}
        ${d.raza ? `<span class="ed-badge">${esc(d.raza)}</span>` : ""}
        <span class="ed-badge" title="${esModoBestia ? "Sin PA: el PNJ no consume puntos de acción" : "Puntos de acción actuales y máximos"}">${esModoBestia ? "Sin PA" : `PA ${paVal}/${paMax}`}</span>
      </div>
    </div>

    <div class="ed-ficha-acciones">
      <button class="btn-secundario chico btn-icono" id="btn-exportar-actor" title="Exportar .undavar" aria-label="Exportar PNJ"><span data-icono="exportar"></span></button>
      <button class="btn-secundario chico" id="btn-toggle-mod-npc" title="Configurar modificadores"><span data-icono="ajustes"></span> Mod.</button>
      <button class="btn-primario chico" id="roll-estandar"><span data-icono="dados"></span> Tirada</button>
      <button class="btn-secundario chico" id="roll-ataque"><span data-icono="espadas"></span> Ataque</button>
    </div>

    <!-- Panel de modificadores del PNJ (sin PdC) -->
    <div id="panel-mod-npc" style="display:none; width:100%; margin-top:10px; background:rgba(0,0,0,0.4); border:1px solid rgba(212,175,55,0.3); border-radius:6px; padding:10px; box-sizing:border-box;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px;">
        <label style="color:#d4af37; font-weight:bold;">Modo de modificador:</label>
        <select id="mod-select-tipo-accion-npc" style="background:#121215; border:1px solid #d4af37; color:#fff; padding:4px 8px; border-radius:4px; font-weight:bold;">
          <option value="tirada">🎲 Tirada estándar</option>
          <option value="ataque">🗡️ Tirada de ataque</option>
        </select>
      </div>

      <div id="bloque-mod-tirada-npc" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; font-size:0.85em; color:#ccc;">
        <div style="display:flex; align-items:center; gap:6px;">
          <label style="color:#d4af37; font-weight:bold;">Atributo (Atr/2):</label>
          <select id="mod-select-atr-npc" style="background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px;">
            <option value="ninguno">Ninguno (+0)</option>
            <option value="fuerza">Fuerza (${Math.floor(atributoEfectivo(actor, "fuerza") / 2)})</option>
            <option value="velocidad">Velocidad (${Math.floor(atributoEfectivo(actor, "velocidad") / 2)})</option>
            <option value="agilidad">Agilidad (${Math.floor(atributoEfectivo(actor, "agilidad") / 2)})</option>
            <option value="inteligencia">Inteligencia (${Math.floor(atributoEfectivo(actor, "inteligencia") / 2)})</option>
          </select>
        </div>

        <div style="display:flex; align-items:center; gap:6px;">
          <label style="color:#d4af37; font-weight:bold;">Gastar PA:</label>
          <input type="number" id="mod-input-pa-npc" value="0" min="0" style="width:45px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;" title="${esModoBestia ? "El PNJ tiene PA infinito" : "PA que se gastan en la tirada"}">
        </div>

        <div style="display:flex; align-items:center; gap:6px;">
          <label style="color:#d4af37; font-weight:bold;">Mod. fijo:</label>
          <input type="number" id="mod-input-fijo-npc" value="0" style="width:45px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
        </div>
      </div>

      <div id="bloque-mod-ataque-npc" style="display:none; gap:12px; align-items:center; flex-wrap:wrap; font-size:0.85em; color:#ccc;">
        <div style="display:flex; align-items:center; gap:6px;">
          <label style="color:#d4af37; font-weight:bold;">Dados extra (d6):</label>
          <input type="number" id="mod-input-dados-ataque-npc" value="0" min="0" style="width:50px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <label style="color:#d4af37; font-weight:bold;">Mod. fijo al daño:</label>
          <input type="number" id="mod-input-fijo-ataque-npc" value="0" style="width:55px; background:#121215; border:1px solid #444; color:#fff; padding:4px; border-radius:4px; text-align:center;">
        </div>
      </div>
    </div>
  </header>`;
}

// [UNDAVAR-PARTE-3.9] Barra de estado y atributos del PNJ
function barraEstadoNPC(actor, calc) {
  const s = actor.system;
  const heridas = Number(s.estado?.ptHerida?.value) || 0;
  const salud = Number(s.estado?.ptSalud?.value) || 0;
  const saludMax = Number(calc.saludLimiteActual) || Number(s.estado?.ptSalud?.max) || 8;
  // [UNDAVAR-PARTE-3.9a] Con «Sin PA» el PNJ es infinito; sin marcar, usa PA normal
  const paMax = paMaximoNPC(actor, calc);
  const paVal = paMax === null ? null : Math.min(paMax, Math.max(0, Number(s.pa?.value) || 0));

  return `
  <section class="estado-atributos-bar">
    <div class="bloque-estado">
      <div class="bloque-titulo">Estado</div>
      <p class="bloque-hint">Heridas, salud y puntos de acción.</p>
      <div class="estado-fila">
        <label>Pt. Herida</label>
        <input type="number" id="campo-herida" value="${heridas}" min="0" max="8">
        <span class="estado-max">/8</span>
      </div>
      <div class="estado-fila">
        <label>Pt. Salud</label>
        <input type="number" id="campo-salud" value="${salud}" min="0" max="${saludMax}">
        <span class="estado-max">/${saludMax}</span>
      </div>
      <div class="estado-fila" style="flex-wrap:wrap;">
        <label>PA</label>
        ${paMax === null
      ? `<span class="estado-max" title="Sin PA: el PNJ no consume puntos de acción" style="font-size:1.15em; color:var(--oro-claro);">∞</span>`
      : `<input type="number" id="campo-pa" value="${paVal}" min="0" max="${paMax}">
             <span class="estado-max">/${paMax}</span>
             <button type="button" class="btn-secundario chico" id="btn-recargar-pa" title="Recargar PA al máximo">Recargar</button>`}
      </div>
    </div>

    <div class="bloque-atributos">
      <div class="bloque-titulo">Atributos</div>
      <p class="bloque-hint">Valores actuales del PNJ.</p>
      <div class="atributos-grid">
        ${["fuerza", "velocidad", "agilidad", "inteligencia"].map(atr => `
          <div class="atributo-item">
            <label>${atr[0].toUpperCase() + atr.slice(1)}</label>
            <div class="atributo-control">
              <input type="number" class="campo-atr-npc" data-atr="${atr}" value="${s.atributos[atr] || 0}" min="0" max="9">
              ${bonoAtributoActivo(actor, atr) ? `<span class="atributo-bono" title="Bono activo">+${bonoAtributoActivo(actor, atr)}</span>` : ""}
            </div>
          </div>`).join("")}
      </div>
    </div>
  </section>`;
}

// [UNDAVAR-PARTE-3.9] Columna lateral del PNJ
function lateralNPC(actor, calc, rangoActual, esModoBestia) {
  const s = actor.system;
  const d = s.datos || {};
  // [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Cartera del PNJ en el lateral
  const e = s.erianas || { oro: 0, rubi: 0, diamante: 0 };
  const heridas = Number(s.estado?.ptHerida?.value) || 0;
  const salud = Number(s.estado?.ptSalud?.value) || 0;
  const saludMax = Number(calc.saludLimiteActual) || Number(s.estado?.ptSalud?.max) || 8;
  const pct = (v, max) => max > 0 ? Math.min(100, Math.round(v / max * 100)) : 0;
  // [UNDAVAR-PARTE-3.9a] PA real del PNJ o infinito según «Sin PA»
  const paMax = paMaximoNPC(actor, calc);
  const paVal = paMax === null ? null : Math.min(paMax, Math.max(0, Number(s.pa?.value) || 0));

  return `
  <aside class="ed-ficha-lateral">
    <div class="ed-retrato">
      <div class="ed-retrato-anillo">
        ${avatarHTML(actor, { clase: "ed-avatar ed-avatar-grande" })}
        ${esClon(actor) ? "" : `<button class="avatar-editar" type="button" data-store="npcs" data-id="${actor.id}" title="Cambiar retrato" aria-label="Cambiar retrato"><span data-icono="camara"></span></button>`}
      </div>
      <h2>${esc(actor.nombre || "Sin nombre")}</h2>
      <p>${esc(d.raza || "PNJ")}${!esModoBestia && rangoActual ? ` · ${esc(rangoActual)}` : ""}</p>
    </div>

    <div class="ed-vitales">
      <div class="ed-vital">
        <div class="ed-vital-top"><span>Heridas</span><small>/ 8</small></div>
        <strong style="font-family:var(--font-display); font-size:23px; font-weight:500;">${heridas}</strong>
        <div class="ed-medidor"><i style="width:${pct(heridas, 8)}%"></i></div>
      </div>
      <div class="ed-vital">
        <div class="ed-vital-top"><span>Salud</span><small>/ ${saludMax}</small></div>
        <strong style="font-family:var(--font-display); font-size:23px; font-weight:500;">${salud}</strong>
        <div class="ed-medidor"><i style="width:${pct(salud, saludMax)}%"></i></div>
      </div>
    </div>

    <div class="ed-vital" style="padding:16px 0; border-bottom:1px solid var(--borde);">
      <div class="ed-vital-top">
        <span>PA</span>
        <strong style="font-family:var(--font-display); font-size:23px; font-weight:500;">${paMax === null ? "—" : `${paVal} / ${paMax}`}</strong>
        <small>${paMax === null ? "sin PA" : "puntos de acción"}</small>
      </div>
      <div class="ed-medidor oro"><i style="width:${paMax === null ? 0 : pct(paVal, paMax)}%"></i></div>
    </div>

    <div class="ed-monedas" style="border-bottom:1px solid var(--borde);">
      <div class="ed-moneda"><i></i><span>Rango</span><strong>${esc(esModoBestia ? "Bestia" : (rangoActual || "Sin Rango"))}</strong></div>
    </div>

    <!-- [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Cartera visible en el lateral -->
    <div class="ed-monedas" style="border-bottom:0;">
      <div class="ed-moneda"><i></i><span>Oro</span><strong data-eriana="oro">${Number(e.oro) || 0}</strong></div>
      <div class="ed-moneda rubi"><i></i><span>Rubí</span><strong data-eriana="rubi">${Number(e.rubi) || 0}</strong></div>
      <div class="ed-moneda diamante"><i></i><span>Diamante</span><strong data-eriana="diamante">${Number(e.diamante) || 0}</strong></div>
    </div>

    ${heridas > 0 ? `<div class="ed-nota">Herida ${heridas}/8: el límite de salud baja a ${calc.saludLimiteActual}. Aplica la penalización en las tiradas de resistencia.</div>` : ""}
  </aside>`;
}

// [UNDAVAR-PARTE-3.9] Pestaña Datos del PNJ
// [UNDAVAR-PARTE-10.5C-MODO] Vista de lectura o formulario según el modo
function tabDatosNPC(actor, rangoActual, esModoBestia, modo = "vista") {
  const d = actor.system.datos || {};
  const listaRazas = Object.keys(BESTIARIO_UNDAVAR);
  // [UNDAVAR-PARTE-9.2-BESTIARIO] Los nombres antiguos se muestran con el nombre del manual
  const razaActual = nombreRazaManual(d.raza);
  const esRazaOficial = listaRazas.includes(razaActual);
  const barra = barraModoDatosHTML(modo);

  // [UNDAVAR-PARTE-10.5C-MODO] Ficha de lectura del PNJ
  if (modo === "vista") {
    return `${barra}
    <div class="datos-vista">
      <div class="datos-vista-grid">
        <section class="datos-vista-bloque">
          <h3>Identidad</h3>
          <dl class="datos-vista-lista">
            ${filaVistaHTML("Raza / tipo", razaActual || "Otra raza")}
            ${filaVistaHTML("Rango", rangoActual || "Sin Rango")}
            ${filaVistaHTML("Puntos de acción", esModoBestia ? "Sin PA (bestia / criatura)" : "PA normal con gasto y bloqueo")}
          </dl>
        </section>
        <section class="datos-vista-bloque">
          <h3>Descripción y notas</h3>
          ${textoVistaHTML(d.descripcion)}
        </section>
        <!-- [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Cartera del PNJ en modo lectura -->
        <section class="datos-vista-bloque ancho">
          <h3>Erianas</h3>
          ${erianasVistaHTML(actor, "npcs")}
        </section>
      </div>
    </div>`;
  }

  // [UNDAVAR-PARTE-9.2-BESTIARIO] Selector agrupado por categorías del manual
  const opcionesRaza = Object.entries(BESTIARIO_CATEGORIAS).map(([cat, etiqueta]) => {
    const nombres = listaRazas.filter(r => BESTIARIO_UNDAVAR[r].categoria === cat);
    if (!nombres.length) return "";
    return `<optgroup label="${esc(etiqueta)}">
      ${nombres.map(r => `<option value="${esc(r)}" ${razaActual === r ? "selected" : ""}>${esc(r)}</option>`).join("")}
    </optgroup>`;
  }).join("");

  return `${barra}
  <div class="datos-grid">
    <div class="datos-columna">
      <div class="campo-fila">
        <label>Raza / tipo</label>
        <select id="select-raza-preset">
          <option value="Personalizado" ${!esRazaOficial ? "selected" : ""}>-- Personalizado / Otra raza --</option>
          ${opcionesRaza}
        </select>
      </div>
      <div class="campo-fila">
        <label>Nombre de la raza</label>
        <input type="text" id="campo-raza" value="${esc(razaActual || "")}">
      </div>
      <p class="bloque-hint" style="margin:-4px 0 2px;">La especie o raza de la criatura.</p>
      <div class="campo-fila">
        <button type="button" class="btn-secundario" id="btn-abrir-bestiario"><span data-icono="npc"></span> Consultar bestiario</button>
      </div>
      <div class="campo-fila">
        <label>Rango</label>
        <button type="button" class="btn-secundario" id="btn-cambiar-rango-npc" style="text-align:left;">${esc(rangoActual || "Sin Rango")} ✎</button>
      </div>
      <label class="check-inline" style="margin-top:6px;">
        <input type="checkbox" id="chk-modo-bestia" ${esModoBestia ? "checked" : ""}> Sin PA (bestia / criatura)
      </label>
      <p class="bloque-hint" style="margin:2px 0 0 24px;">Marcado: PA infinito. Desmarcado: PA normal con gasto y bloqueo.</p>
    </div>

    <div class="datos-columna">
      <div class="campo-fila">
        <label>Descripción / notas</label>
        <textarea id="campo-desc-npc" rows="6" placeholder="Apariencia, comportamiento, motivaciones...">${esc(d.descripcion || "")}</textarea>
      </div>
      <!-- [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Cartera editable del PNJ -->
      <div class="campo-fila" style="margin-top:10px;">
        <label>Erianas</label>
        ${carteraCamposHTML(actor)}
        <div class="erianas-botones">
          <button type="button" class="btn-secundario" id="btn-transferir-erianas">🔁 Transferir Erianas</button>
        </div>
        <details class="historial-erianas-detalle">
          <summary>Historial de Erianas</summary>
          ${historialErianasHTML(actor)}
        </details>
      </div>
    </div>
  </div>`;
}

// [UNDAVAR-PARTE-9.3-SIERVOS] Pestaña del vínculo del PNJ con un amo
function tabSiervoNPC(actor, personajes) {
  const sv = siervoDe(actor);
  const tipos = Object.entries(TIPOS_SIERVO).map(([id, etiqueta]) =>
    `<option value="${id}" ${sv.tipo === id ? "selected" : ""}>${esc(etiqueta)}</option>`).join("");
  const amos = personajes.map(p =>
    `<option value="${esc(p.id)}" ${sv.amoId === p.id ? "selected" : ""}>${esc(p.nombre || "Sin nombre")}</option>`).join("");

  const puntos = [0, 1, 2, 3].map(n =>
    `<span class="po-punto ${n < sv.po ? "activo" : ""}" aria-hidden="true">●</span>`).join("");
  const textoPO = sv.po >= 3
    ? "Amo confirmado: la mascota te reconoce."
    : sv.po === 2
      ? "Con 2 P.O, al llegar al final del conflicto se repite una vez más."
      : "Con 1 P.O o menos la mascota se pierde.";

  return `
  <div class="ref-bloque siervo-bloque">
    <div class="bloque-titulo">Vínculo de siervo</div>
    <p class="bloque-hint">Mascotas, esclavos y sirvientes son PNJ con amo. Solo pueden acumular hasta ${SIERVO_PA_MAXIMO} PA.</p>

    <div class="campo-fila">
      <label>Tipo de vínculo</label>
      <select id="siervo-tipo">${tipos}</select>
    </div>

    <div class="campo-fila">
      <label>Amo</label>
      <select id="siervo-amo" ${sv.tipo ? "" : "disabled"}>
        <option value="">-- Sin vínculo --</option>
        ${amos}
      </select>
    </div>
    ${!personajes.length ? `<p class="bloque-hint">Crea primero una ficha de personaje para poder asignar un amo.</p>` : ""}

    ${sv.tipo === "mascota" ? `
    <div class="siervo-detalle">
      <div class="campo-fila">
        <label>Puntos de obediencia (P.O)</label>
        <div class="po-contador">
          <button type="button" class="btn-secundario chico" data-po="-1" ${sv.po <= 0 ? "disabled" : ""}>−</button>
          <span class="po-puntos">${puntos}</span>
          <span class="po-valor">${sv.po} / 3</span>
          <button type="button" class="btn-secundario chico" data-po="1" ${sv.po >= 3 ? "disabled" : ""}>+</button>
        </div>
      </div>
      <p class="bloque-hint">${textoPO} Cada P.O se gana al inicio de una campaña con +4 aciertos.</p>
    </div>` : ""}

    ${sv.tipo === "esclavo" ? `
    <div class="siervo-detalle">
      <div class="campo-fila">
        <label>Edad de crianza (0–7 años)</label>
        <input type="number" id="siervo-edad" min="0" max="7" value="${sv.edad}">
      </div>
      <p class="bloque-hint">Se cría desde los primeros años para moldear su carácter. La marca de control se anota en Estado.</p>
    </div>` : ""}

    ${sv.tipo === "sirviente" ? `
    <div class="siervo-detalle">
      <div class="campo-fila">
        <label>Salario</label>
        <div class="siervo-salario">
          <strong>${sv.salario ? `${sv.salario} Oro` : "Sin asignar"}</strong>
          <button type="button" class="btn-secundario chico" id="btn-tirar-salario">🎲 1d6 × 100</button>
        </div>
      </div>
      <p class="bloque-hint">Se paga por adelantado. ${sv.salario ? (sv.pagado ? "Pagado." : "Pendiente de pago.") : "Tira el salario para fijarlo."} Si no hay oro, el sirviente se retira.</p>
    </div>` : ""}

    ${sv.tipo === "sirviente" ? `<p class="bloque-hint">En uso: el PJ gana el doble de PV. Se activa desde la ficha del amo, pestaña «Siervos».</p>` : ""}
  </div>`;
}

// [UNDAVAR-PARTE-9.3-SIERVOS] Pestaña de la ficha del PJ con sus siervos
function tabSiervosPJ(actor, npcs) {
  const mios = npcs.filter(n => {
    const sv = siervoDe(n);
    return sv.tipo && sv.amoId === actor.id;
  }).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));

  if (!mios.length) {
    return `<div class="ref-bloque">
      <div class="bloque-titulo">Siervos</div>
      <p class="vacio">No tienes mascotas, esclavos ni sirvientes vinculados.</p>
      <p class="bloque-hint">Abre un PNJ, entra en su pestaña «Siervo» y elige el tipo y el amo.</p>
    </div>`;
  }

  const tarjeta = (n) => {
    const sv = siervoDe(n);
    const raza = nombreRazaManual(n.system?.datos?.raza) || "Sin raza";
    const detalle = sv.tipo === "mascota"
      ? `<span class="po-puntos">${[0, 1, 2, 3].map(i => `<span class="po-punto ${i < sv.po ? "activo" : ""}">●</span>`).join("")}</span> <small>${sv.po}/3 P.O</small>`
      : sv.tipo === "esclavo"
        ? `<small>Crianza: ${sv.edad} años</small>`
        : `<small>Salario: ${sv.salario ? `${sv.salario} Oro` : "sin asignar"}${sv.pagado ? " · pagado" : ""}</small>`;

    return `
    <article class="siervo-card">
      <div class="siervo-card-cab">
        <button type="button" class="siervo-nombre" data-siervo-abrir="${esc(n.id)}">${esc(n.nombre || "Sin nombre")} →</button>
        <span class="meta-badge meta-tipo-personal">${esc(TIPOS_SIERVO[sv.tipo])}</span>
      </div>
      <p class="siervo-raza">${esc(raza)}</p>
      <div class="siervo-detalle">${detalle}</div>
      <div class="siervo-acciones">
        <label class="check-inline">
          <input type="checkbox" data-siervo-uso="${esc(n.id)}" ${sv.enUso ? "checked" : ""}> ${sv.tipo === "sirviente" ? "En uso (×2 PV)" : "En uso"}
        </label>
        ${sv.tipo === "sirviente"
          ? `<button type="button" class="btn-secundario chico" data-siervo-pagar="${esc(n.id)}">Pagar salario</button>`
          : ""}
      </div>
    </article>`;
  };

  return `
  <div class="ref-bloque">
    <div class="bloque-titulo">Siervos</div>
    <p class="bloque-hint">Mascotas, esclavos y sirvientes tienen un máximo de ${SIERVO_PA_MAXIMO} PA. Mientras un sirviente esté «en uso», ganas el doble de PV.</p>
    <div class="siervos-lista">${mios.map(tarjeta).join("")}</div>
  </div>`;
}

// [UNDAVAR-PARTE-9.2-CONSULTA] Bestiario de consulta con categorías y artes
function abrirBestiario() {
  const fondo = crearModal("Bestiario de Undavar", '<div id="bestiario-cuerpo"></div>');
  qs(".modal-caja", fondo)?.classList.add("modal-bestiario");
  const cuerpo = qs("#bestiario-cuerpo", fondo);
  let filtro = "todos";

  const ficha = (nombre, e) => {
    const artes = Array.isArray(e.artes) ? e.artes : [];
    return `
    <article class="bestiario-ficha">
      <header class="bestiario-cabecera">
        <h3>${esc(nombre)}</h3>
        <span class="meta-badge meta-tipo-personal">${esc(BESTIARIO_CATEGORIAS[e.categoria] || "Sin categoría")}</span>
      </header>
      <p class="bestiario-desc">${esc(e.descripcion || "")}</p>
      <div class="bestiario-atributos">
        ${["fuerza", "velocidad", "agilidad", "inteligencia"].map(k =>
          `<span><b>${k[0].toUpperCase()}${k.slice(1)}</b> ${e.atributos?.[k] ?? "—"}</span>`).join("")}
      </div>
      <div class="bestiario-artes">
        ${artes.map(a => {
          const variaciones = (Array.isArray(a.system?.variacionesNivel) ? a.system.variacionesNivel : [])
            .filter(v => String(v?.descripcion || "").trim());
          return `
          <div class="bestiario-arte">
            <strong>${esc(a.name)}</strong>
            <p>${esc(a.system?.descripcion || "")}</p>
            ${variaciones.length ? `<ul>${variaciones.map(v =>
              `<li><b>Nv ${v.nivel}:</b> ${esc(v.descripcion || "")}</li>`).join("")}</ul>` : ""}
          </div>`;
        }).join("") || `<p class="vacio">Sin artes registradas.</p>`}
      </div>
    </article>`;
  };

  const pintar = () => {
    const categorias = Object.keys(BESTIARIO_CATEGORIAS);
    const entradas = Object.entries(BESTIARIO_UNDAVAR)
      .filter(([, e]) => filtro === "todos" || e.categoria === filtro)
      .sort((a, b) => categorias.indexOf(a[1].categoria) - categorias.indexOf(b[1].categoria)
        || a[0].localeCompare(b[0], "es"));

    cuerpo.innerHTML = `
      <div class="bestiario-filtros" role="group" aria-label="Filtrar por categoría">
        <button class="meta-chip${filtro === "todos" ? " activo" : ""}" data-best-filtro="todos">Todos (${Object.keys(BESTIARIO_UNDAVAR).length})</button>
        ${categorias.map(id => {
          const total = Object.values(BESTIARIO_UNDAVAR).filter(e => e.categoria === id).length;
          return `<button class="meta-chip${filtro === id ? " activo" : ""}" data-best-filtro="${id}">${esc(BESTIARIO_CATEGORIAS[id])} (${total})</button>`;
        }).join("")}
      </div>
      <div class="bestiario-lista">
        ${entradas.map(([nombre, e]) => ficha(nombre, e)).join("")}
      </div>`;

    qsa("[data-best-filtro]", cuerpo).forEach(b => b.addEventListener("click", () => {
      filtro = b.dataset.bestFiltro;
      pintar();
    }));
  };

  pintar();
}

// [UNDAVAR-PARTE-3.9] Pestaña Artes y armas del PNJ (sin costes de PV ni entrenamiento)
function tabArtesArmasNPC(actor) {
  const artes = (actor.items || []).filter(i => i.type === "arte");
  // [UNDAVAR-PARTE-10.4-ARMAS] Solo las armas de gladiador van a Artes
  const armas = (actor.items || []).filter(i => i.type === "arma" && !esArmaComun(i));
  // [UNDAVAR-PARTE-3.9a] El coste solo es infinito si «Sin PA» está marcado
  const sinPA = !!actor.system.datos?.sinRangoPA;

  const fila = (it) => {
    const nivel = Number(it.system?.nivel) || 0;
    return `
    <div class="item-fila" data-item-id="${it.id}">
      <span class="item-nombre">${esc(it.name)}</span>
      <span class="item-badge">Nv ${nivel}</span>
      <span class="item-badge pa-badge" title="${sinPA ? "Sin PA: el PNJ no gasta puntos de acción" : "Coste de PA al usar"}">${costoPANivel(nivel)} PA${sinPA ? " · ∞" : ""}</span>
      <div class="item-botones">
        <button class="btn-secundario chico btn-icono btn-usar-arte" data-id="${it.id}" title="Usar" aria-label="Usar"><span data-icono="usar"></span></button>
        <button class="btn-secundario chico btn-icono btn-editar-item" data-id="${it.id}" title="Editar" aria-label="Editar"><span data-icono="editar"></span></button>
        <button class="btn-peligro chico btn-icono btn-borrar-item" data-id="${it.id}" title="Eliminar" aria-label="Eliminar"><span data-icono="borrar"></span></button>
      </div>
    </div>`;
  };

  return `
  <div class="seccion-acciones" style="margin-bottom:12px; display:flex; gap:10px; flex-wrap:wrap;">
    <button class="btn-secundario" id="btn-nueva-arte">+ Arte / habilidad</button>
    <button class="btn-secundario" id="btn-nueva-arma">+ Arma</button>
  </div>

  <div class="bloque-titulo">Artes y habilidades</div>
  <div class="items-lista">${artes.map(fila).join("") || `<p class="vacio">Sin artes ni habilidades.</p>`}</div>

  <div class="bloque-titulo" style="margin-top:18px;">Armas</div>
  <div class="items-lista">${armas.map(fila).join("") || `<p class="vacio">Sin armas.</p>`}</div>`;
}

// [UNDAVAR-PARTE-3.9] Ficha editorial del PNJ
async function renderFichaNPC() {
  // [UNDAVAR-PARTE-3.1] Sin PNJ seleccionado se muestra el selector.
  if (!state.npcId) {
    await renderSelectorRegistro({
      store: "npcs", vista: "npc", idKey: "npcId",
      titulo: "PNJ y bestias",
      descripcion: "Elige un PNJ o una bestia para abrir su ficha.",
      subtitulo: (o) => nombreRazaManual(o.system?.datos?.raza) || "Sin raza",
      vacio: "Sin PNJ ni bestias. Crea uno desde Inicio.",
    });
    return;
  }

  const actor = await dbGet("npcs", state.npcId);
  // [UNDAVAR-PARTE-9.3B-MEMORIA] Si el PNJ guardado ya no existe, muestra la lista
  if (!actor) { state.npcId = null; return renderFichaNPC(); }

  const s = actor.system;
  // [UNDAVAR-PARTE-4.2c-VITAL] Sincroniza inconsciencia con la salud al abrir la ficha
  sincronizarEstadoVital(actor);
  // [UNDAVAR-PARTE-4.2h2-PAREJA] El viento se mantiene mientras se posean las dos armas
  if (await guardarBonosPasivos(actor, "npcs")) { /* ya guardado */ }
  if (!s.datos) s.datos = { raza: "", descripcion: "" };
  // [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Cartera del PNJ aunque falte en datos viejos
  if (!s.erianas || typeof s.erianas !== "object") s.erianas = { oro: 0, rubi: 0, diamante: 0 };
  // [UNDAVAR-PARTE-9.2B-RAZA-NOMBRE] Limpia el marcador antiguo «Personalizado»
  if (s.datos.raza === "Personalizado") {
    s.datos.raza = "";
    await dbPut("npcs", actor);
  }
  if (!s.estado) s.estado = { ptHerida: { value: 0 }, ptSalud: { value: 8, max: 8 } };
  if (!s.atributos) s.atributos = { fuerza: 0, velocidad: 0, agilidad: 0, inteligencia: 0 };
  if (!s.pa) s.pa = { value: 6 };
  if (!Array.isArray(actor.items)) actor.items = [];
  if (!state.subtabNPC) state.subtabNPC = "datos";
  // [UNDAVAR-PARTE-9.3-SIERVOS] Carga los amos solo al abrir la pestaña del siervo
  const personajesAmo = state.subtabNPC === "siervo" ? soloPersonajesReales(await dbGetAll("personajes")) : [];
  // [UNDAVAR-PARTE-10.5C-MODO] La pestaña Datos abre en vista y conserva el modo
  const modoDatos = modoDatosFicha("npcs", actor.id);
  const datosSoloLectura = modoDatos === "vista" && state.subtabNPC === "datos";

  const calc = typeof calcularDerivados === "function" ? calcularDerivados(s, actor.items) : {};
  const rangoActual = s.datos?.rangoManual || calc.rango || "Sin Rango";
  const esModoBestia = !!s.datos?.sinRangoPA;

  // [UNDAVAR-PARTE-3.9a] Con PA normal, ajusta el valor al máximo del rango
  if (!esModoBestia) {
    const paMax = paMaximoNPC(actor, calc);
    const paVal = Number(s.pa?.value) || 0;
    if (Number(s.pa?.max) !== paMax || paVal > paMax) {
      s.pa = { value: Math.min(paMax, paVal), max: paMax };
      await dbPut("npcs", actor);
    }
  }

  app.innerHTML = `
  <section class="vista-ficha ed-ficha" data-ficha-store="npcs" data-ficha-id="${actor.id}">
    ${cabeceraNPC(actor, calc, rangoActual, esModoBestia, datosSoloLectura)}
    ${bannerEstadoVital(actor)}
    <div class="ed-ficha-grid">
      <div class="ed-ficha-principal">
        ${barraEstadoNPC(actor, calc)}

        <nav class="subtabs" role="tablist" aria-label="Secciones de la ficha de PNJ">
          ${["datos", "siervo", "artes", "inventario", "equipo", "estado", "referencia"].map(t =>
    `<button class="subtab ${state.subtabNPC === t ? 'activo' : ''}" data-subtab-npc="${t}" role="tab" aria-selected="${state.subtabNPC === t}">${etiquetaSubtabNPC(t)}</button>`).join("")}
        </nav>

        <div class="subtab-contenido" role="tabpanel">
          ${state.subtabNPC === "datos" ? tabDatosNPC(actor, rangoActual, esModoBestia, modoDatos) : ""}
          ${state.subtabNPC === "siervo" ? tabSiervoNPC(actor, personajesAmo) : ""}
          ${state.subtabNPC === "artes" ? tabArtesArmasNPC(actor) : ""}
          ${state.subtabNPC === "inventario" ? tabInventario(actor) : ""}
          ${state.subtabNPC === "equipo" ? tabEquipo(actor) : ""}
          ${state.subtabNPC === "estado" ? tabEstado(actor, false, "npcs") : ""}
          ${state.subtabNPC === "referencia" ? tabReferencia(calc) : ""}
        </div>

        <div class="log-tiradas">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h3 style="margin:0;">Registro de tiradas</h3>
            <button class="btn-secundario chico" id="btn-limpiar-log">🧹 Limpiar</button>
          </div>
          <div id="tirada-log" aria-live="polite">
            ${(s.historialTiradas || []).map(h => `<div class="tirada-item">${h}</div>`).join("") || `<p class="vacio">Sin tiradas en esta sesión.</p>`}
          </div>
        </div>
      </div>

      ${lateralNPC(actor, calc, rangoActual, esModoBestia)}
    </div>
  </section>`;

  wireFichaNPC(actor, calc);
  // [UNDAVAR-PARTE-4.2c-VITAL] Botones de despertar, elixir y reactivación
  wireEstadoVital(actor, "npcs");
  // [UNDAVAR-PARTE-4.2d-EFECTOS] Efectos pendientes en la pestaña Estado
  wireEfectosPendientes(actor, "npcs");
}

// [UNDAVAR-PARTE-3.9] Cableado de la ficha de PNJ
function wireFichaNPC(actor, calc) {
  const esModoBestia = !!actor.system.datos?.sinRangoPA;

  qs("#btn-volver")?.addEventListener("click", () => ir("inicio"));
  // [UNDAVAR-PARTE-9.3B-LISTA] Vuelve a la lista de PNJ y bestias
  qs("#btn-volver-lista")?.addEventListener("click", () => ir("npc", { npcId: null }));
  qs("#btn-exportar-actor")?.addEventListener("click", () => exportarPerfil("npcs", actor.id).catch(e => notificar("Error al exportar: " + (e.message || e))));
  // [UNDAVAR-PARTE-10.5C-MODO] Cambia entre la ficha de lectura y la edición
  const btnModoDatos = qs("#btn-modo-datos");
  if (btnModoDatos) {
    btnModoDatos.addEventListener("click", () => {
      state.modoDatos = btnModoDatos.dataset.modo === "vista" ? "vista" : "edicion";
      render();
    });
  }

  // [UNDAVAR-PARTE-10.6-TRANSFERENCIAS] Transferencia de Erianas desde la ficha del PNJ
  qs("#btn-transferir-erianas")?.addEventListener("click", () =>
    abrirModalTransferirErianasFicha("npcs", actor.id).catch(e => notificar("Error al transferir: " + (e.message || e))));

  // Pestañas
  qsa("[data-subtab-npc]").forEach(b => b.addEventListener("click", () => {
    state.subtabNPC = b.dataset.subtabNpc;
    render();
  }));

  // Datos básicos
  qs("#campo-nombre")?.addEventListener("change", async e => {
    actor.nombre = e.target.value;
    await dbPut("npcs", actor);
    render();
  });
  qs("#campo-desc-npc")?.addEventListener("change", async e => {
    actor.system.datos.descripcion = e.target.value;
    await dbPut("npcs", actor);
  });
  qs("#campo-raza")?.addEventListener("change", async e => {
    actor.system.datos.raza = e.target.value;
    await dbPut("npcs", actor);
    render();
  });

  // [UNDAVAR-PARTE-9.2-CONSULTA] Abre el bestiario de consulta
  qs("#btn-abrir-bestiario")?.addEventListener("click", abrirBestiario);

  // [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Edición de la cartera del PNJ
  const guardarCampoNPC = async (path, value) => {
    const partes = path.split(".");
    let obj = actor;
    for (let i = 0; i < partes.length - 1; i++) obj = obj[partes[i]];
    obj[partes[partes.length - 1]] = value;
    await dbPut("npcs", actor);
  };
  wireCarteraFicha(actor, guardarCampoNPC);

  // [UNDAVAR-PARTE-9.3-SIERVOS] Tipo de vínculo, amo, P.O, crianza y salario
  qs("#siervo-tipo")?.addEventListener("change", async e => {
    const sv = siervoDe(actor);
    sv.tipo = e.target.value;
    if (!sv.tipo) { sv.amoId = ""; sv.enUso = false; }
    actor.system.datos.siervo = sv;
    await dbPut("npcs", actor);
    render();
  });

  qs("#siervo-amo")?.addEventListener("change", async e => {
    const sv = siervoDe(actor);
    sv.amoId = e.target.value;
    actor.system.datos.siervo = sv;
    await dbPut("npcs", actor);
    render();
  });

  qs("#siervo-edad")?.addEventListener("change", async e => {
    const sv = siervoDe(actor);
    sv.edad = Math.max(0, Math.min(7, parseInt(e.target.value, 10) || 0));
    actor.system.datos.siervo = sv;
    await dbPut("npcs", actor);
    render();
  });

  qsa("[data-po]").forEach(b => b.addEventListener("click", async () => {
    const sv = siervoDe(actor);
    sv.po = Math.max(0, Math.min(3, sv.po + Number(b.dataset.po)));
    actor.system.datos.siervo = sv;
    // [UNDAVAR-PARTE-9.3-SIERVOS] Refleja el P.O en Puntos y Marcas
    if (!actor.system.puntosYMarcas) actor.system.puntosYMarcas = {};
    actor.system.puntosYMarcas.po = { estado: sv.po ? "A" : "I", value: sv.po };
    await dbPut("npcs", actor);
    render();
  }));

  qs("#btn-tirar-salario")?.addEventListener("click", async () => {
    const dado = Math.floor(Math.random() * 6) + 1;
    const total = dado * 100;
    const sv = siervoDe(actor);
    sv.salario = total;
    sv.pagado = false;
    sv.ultimoPago = 0;
    actor.system.datos.siervo = sv;
    await logTirada(actor, `<h4>Salario del sirviente</h4>
      <p style="text-align:center">1d6: <b>${dado}</b> × 100 = <b>${total} Oro</b></p>`, "npcs");
    render();
  });

  // Raza predefinida del bestiario
  qs("#select-raza-preset")?.addEventListener("change", async e => {
    const seleccion = e.target.value;

    if (seleccion === "Personalizado") {
      // [UNDAVAR-PARTE-9.2B-RAZA-NOMBRE] «Personalizado» no es una raza: solo vacía el preset
      const actual = nombreRazaManual(actor.system.datos.raza);
      if (BESTIARIO_UNDAVAR[actual]) actor.system.datos.raza = "";
    } else {
      actor.system.datos.raza = seleccion;

      const preset = presetBestiario(seleccion);
      if (preset) {
        actor.system.datos.descripcion = preset.descripcion || "";
        actor.system.atributos = { ...preset.atributos };

        preset.artes.forEach(arteBase => {
          const yaTiene = actor.items.some(i => i.name === arteBase.name);
          if (!yaTiene) {
            const copiaArte = JSON.parse(JSON.stringify(arteBase));
            copiaArte.id = nuevoId();
            actor.items.push(copiaArte);
          }
        });
      }
    }

    await dbPut("npcs", actor);
    render();
  });

  // Modo bestia / sin PA
  qs("#chk-modo-bestia")?.addEventListener("change", async e => {
    if (!actor.system.datos) actor.system.datos = {};
    actor.system.datos.sinRangoPA = e.target.checked;
    await dbPut("npcs", actor);
    render();
  });

  // Cambiar rango manual
  qs("#btn-cambiar-rango-npc")?.addEventListener("click", () => {
    const listaRangos = typeof RANGOS_UNDAVAR !== "undefined"
      ? RANGOS_UNDAVAR.map(r => r.nombre)
      : ["Novato", "Aspirante", "Iniciado", "Experto", "Maestro", "Gran Maestro", "Leyenda"];

    // [UNDAVAR-PARTE-3.9] Usa el rango calculado si aún no hay rango manual
    const rangoActualVal = actor.system.datos?.rangoManual || calc.rango || "Sin rango";

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
          <button class="btn-primario" id="btn-guardar-rango-npc">Guardar rango</button>
        </div>
      </div>`;

    const modal = crearModal("👑 Seleccionar rango del PNJ", modalHtml);
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

      // [UNDAVAR-PARTE-3.9a] PA nominal del rango, coherente con calcularPAMax
      const matchRango = typeof RANGOS_UNDAVAR !== "undefined" ? RANGOS_UNDAVAR.find(r => r.nombre === finalRango) : null;
      const nuevoPA = matchRango && typeof calcularPAMax === "function"
        ? calcularPAMax(matchRango.minPV)
        : Math.max(1, Number(actor.system.pa?.max) || 2);

      if (!actor.system.pa) actor.system.pa = { value: nuevoPA, max: nuevoPA };
      actor.system.pa.max = nuevoPA;
      actor.system.pa.value = nuevoPA;

      await dbPut("npcs", actor);
      modal.remove();
      render();
    });
  });

  // Estado físico
  qs("#campo-herida")?.addEventListener("change", async e => {
    const valorIngresado = Math.min(8, Math.max(0, Number(e.target.value) || 0));
    const valorAnterior = Number(actor.system.estado.ptHerida?.value) || 0;
    actor.system.estado.ptHerida.value = valorIngresado;

    if (valorIngresado > valorAnterior) {
      const derivados = calcularDerivados(actor.system, actor.items);
      const saludActual = Number(actor.system.estado.ptSalud?.value) || 0;
      if (saludActual > derivados.saludLimiteActual) {
        actor.system.estado.ptSalud.value = derivados.saludLimiteActual;
      }
    }

    // [UNDAVAR-PARTE-4.2c-VITAL] Si el recorte deja la salud en 0, queda inconsciente
    sincronizarEstadoVital(actor);
    await dbPut("npcs", actor);
    render();
  });

  qs("#campo-salud")?.addEventListener("change", async e => {
    const max = Number(calc.saludLimiteActual) || 8;
    actor.system.estado.ptSalud.value = Math.min(max, Math.max(0, Number(e.target.value) || 0));
    // [UNDAVAR-PARTE-4.2c-VITAL] Salud a 0 marca inconsciencia
    sincronizarEstadoVital(actor);
    await dbPut("npcs", actor);
    render();
  });

  // [UNDAVAR-PARTE-3.9a] PA normal: editar y recargar
  qs("#campo-pa")?.addEventListener("change", async e => {
    const max = paMaximoNPC(actor, calc) ?? 0;
    if (!actor.system.pa) actor.system.pa = { value: 0 };
    actor.system.pa.max = max;
    actor.system.pa.value = Math.min(max, Math.max(0, Number(e.target.value) || 0));
    await dbPut("npcs", actor);
    render();
  });

  qs("#btn-recargar-pa")?.addEventListener("click", async () => {
    const max = paMaximoNPC(actor, calc) ?? 0;
    if (!actor.system.pa) actor.system.pa = { value: 0 };
    actor.system.pa.max = max;
    actor.system.pa.value = max;
    await dbPut("npcs", actor);
    render();
  });

  // Atributos
  qsa(".campo-atr-npc").forEach(inp => inp.addEventListener("change", async e => {
    actor.system.atributos[e.target.dataset.atr] = Math.min(9, Math.max(0, Number(e.target.value) || 0));
    await dbPut("npcs", actor);
    render();
  }));

  // Extensión de estado (pestaña Estado)
  qsa(".campo-ext-estado").forEach(inp => inp.addEventListener("change", async e => {
    const key = e.target.dataset.key;
    const valorNuevo = Math.max(0, Number(e.target.value) || 0);

    if (!actor.system.extensionEstado) actor.system.extensionEstado = {};
    actor.system.extensionEstado[key] = { value: valorNuevo };

    // Misma regla que en la ficha de PJ: cada 2 marcas suman +1 Pt. Herida
    const ext = actor.system.extensionEstado;
    const totalEstados = (Number(ext.hambre?.value) || 0) +
      (Number(ext.sed?.value) || 0) +
      (Number(ext.cansancio?.value) || 0) +
      (Number(ext.fatiga?.value) || 0);
    const nuevoBonus = Math.floor(totalEstados / 2);
    const bonusPrevio = Number(actor.system.estado.heridasCausadasPorEstado) || 0;

    if (nuevoBonus > bonusPrevio) {
      const delta = nuevoBonus - bonusPrevio;
      const heridaActual = Number(actor.system.estado.ptHerida?.value) || 0;
      actor.system.estado.ptHerida.value = Math.min(8, heridaActual + delta);
      actor.system.estado.heridasCausadasPorEstado = nuevoBonus;

      const derivados = calcularDerivados(actor.system, actor.items);
      const saludActual = Number(actor.system.estado.ptSalud?.value) || 0;
      if (saludActual > derivados.saludLimiteActual) {
        actor.system.estado.ptSalud.value = derivados.saludLimiteActual;
      }
    }

    await dbPut("npcs", actor);
    render();
  }));

  // Puntos y marcas (pestaña Estado)
  qsa(".campo-pm-estado, .campo-pm-val").forEach(inp => inp.addEventListener("change", async e => {
    const key = inp.dataset.key;
    const prop = inp.dataset.prop;
    if (!actor.system.puntosYMarcas) actor.system.puntosYMarcas = {};
    if (!actor.system.puntosYMarcas[key]) actor.system.puntosYMarcas[key] = { estado: "I", value: 0 };

    actor.system.puntosYMarcas[key][prop] = prop === "value" ? Number(inp.value) || 0 : inp.value;
    await dbPut("npcs", actor);
  }));

  // Panel de modificadores
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

  // Tirada estándar
  qs("#roll-estandar")?.addEventListener("click", async () => {
    let modAtributo = 0;
    let modPA = 0;
    let modFijo = 0;
    let gastoPA = 0;

    if (panelModNPC && selectModTipoAccionNPC?.value === "tirada") {
      const selAtr = qs("#mod-select-atr-npc")?.value;
      if (selAtr && selAtr !== "ninguno") {
        modAtributo = Math.floor(atributoEfectivo(actor, selAtr) / 2);
      }

      // [UNDAVAR-PARTE-3.9a] Con PA normal se comprueba el gasto; con «Sin PA» es infinito
      gastoPA = Math.max(0, parseInt(qs("#mod-input-pa-npc")?.value) || 0);
      if (!actor.system.datos?.sinRangoPA) {
        const paMax = paMaximoNPC(actor, calc) ?? 0;
        const paDisponible = Math.min(paMax, Math.max(0, Number(actor.system.pa?.value) || 0));
        if (gastoPA > paDisponible) {
          notificar(`⚠️ PA insuficientes. Disponibles: ${paDisponible}`);
          return;
        }
      }
      modPA = gastoPA;
      modFijo = parseInt(qs("#mod-input-fijo-npc")?.value) || 0;
    }

    const r = tiradaEstandar();
    const aciertosBase = r.aciertos;
    const modTotal = modAtributo + modPA + modFijo;
    const aciertosTotales = aciertosBase + modTotal;

    // [UNDAVAR-PARTE-3.9a] Descuenta el PA solo en modo normal
    const sinPA = !!actor.system.datos?.sinRangoPA;
    let gastoAplicado = false;
    if (gastoPA > 0 && !sinPA) {
      actor.system.pa.value = Math.max(0, (Number(actor.system.pa?.value) || 0) - gastoPA);
      await dbPut("npcs", actor);
      gastoAplicado = true;
    }

    limpiarPanelModNPC();

    const modTexto = modTotal !== 0 ? ` (${aciertosBase} base ${modTotal > 0 ? '+' : ''}${modTotal} mod) = <b style="color:#55ff55;">${aciertosTotales}</b>` : `<b style="color:#55ff55;">${aciertosTotales}</b>`;

    await logTirada(actor, `<h4>Tirada estándar</h4>${dadosHTML(r.ds)}<table class="roll-tabla"><tr><td>Aciertos</td><td>${modTexto}</td></tr><tr><td>Suerte</td><td>${r.buenaSuerte ? "✨ Buena" : "💀 Mala"}</td></tr></table>`, "npcs");
    if (gastoAplicado) render();
  });

  // Tirada de ataque
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

  // Artes y armas
  qs("#btn-nueva-arte")?.addEventListener("click", () => abrirEditorItem(actor, "arte"));
  // [UNDAVAR-PARTE-10.4-ARMAS] El botón de arma del PNJ crea un arma de gladiador
  qs("#btn-nueva-arma")?.addEventListener("click", () => abrirEditorItem(actor, "arma_gladiador"));
  qsa(".btn-editar-item").forEach(b => b.addEventListener("click", () => abrirEditorItem(actor, null, b.dataset.id)));
  // [UNDAVAR-PARTE-4.2d-EFECTOS] Usar objeto, elixir o alimento desde el inventario del PNJ
  qsa(".btn-usar-item").forEach(b => b.addEventListener("click", () => abrirModalUsarItem(actor, "npcs", b.dataset.id)));
  qsa(".btn-borrar-item").forEach(b => b.addEventListener("click", async () => {
    actor.items = actor.items.filter(i => i.id !== b.dataset.id);
    await dbPut("npcs", actor);
    render();
  }));

  // Uso de arte o arma
  qsa(".btn-usar-arte").forEach(b => b.addEventListener("click", async () => {
    const it = actor.items.find(i => i.id === b.dataset.id);
    if (!it) return;

    // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Enfriamiento y elección de habilidad
    const enfriamiento = (actor.system?.enfriamientos || []).find(e => e.itemId === it.id);
    if (enfriamiento) { notificar(`⏳ ${it.name} está en enfriamiento: ${describirEnfriamiento(enfriamiento)}.`); return; }
    const hab = await elegirHabilidad(it, actor);
    if (!hab) return;

    // [UNDAVAR-PARTE-4.2h2-PAREJA] La duplicación solo se lanza desde la mesa de combate
    if (hab.modoUso === "duplicar") {
      notificar("🧬 La duplicación solo se usa desde la mesa de combate.");
      return;
    }

    const nivel = it.system?.nivel !== undefined ? Number(it.system.nivel) : 0;
    const costPA = typeof costoPANivel === "function" ? costoPANivel(nivel) : nivel;
    const sinPA = !!actor.system.datos?.sinRangoPA;
    const paAntes = Number(actor.system.pa?.value) || 0;

    // [UNDAVAR-PARTE-3.9a] Con PA normal se bloquea y se descuenta; con «Sin PA» es infinito
    let paDisponible = paAntes;
    if (!sinPA) {
      if (!actor.system.pa) actor.system.pa = { value: 0 };
      const paMax = paMaximoNPC(actor, calc) ?? 0;
      paDisponible = Math.min(paMax, paAntes);
      if (costPA > paDisponible) {
        notificar(`⚠️ PA insuficientes (necesitas ${costPA}, tienes ${paDisponible}).`);
        return;
      }
    }

    // [UNDAVAR-PARTE-4.2h1b-SELLO] Las artes de daño con condiciones eligen objetivo
    // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] También cuando aplican efecto junto al daño
    const aplicaEfecto = hab.modoUso === "dano" && !!hab.aplicaEfecto;
    const necesitaObjetivo = hab.modoUso === "dano" &&
      (normalizarCondicionesArte(hab.condiciones).length > 0 || aplicaEfecto);
    const seleccionCond = necesitaObjetivo
      ? await elegirObjetivoYCondiciones(actor, "npcs", hab)
      : null;
    if (hab.modoUso === "dano" && normalizarCondicionesArte(hab.condiciones).length && !seleccionCond) return;
    if (aplicaEfecto && !seleccionCond) return;

    if (!sinPA) {
      actor.system.pa.value = paDisponible - costPA;
      await dbPut("npcs", actor);
    }

    // [UNDAVAR-PARTE-4.2e5-ARTES] Arte descriptiva o arte que aplica efecto
    if (hab.modoUso === "descriptiva") {
      iniciarEnfriamientoArte(actor, it, 1);
      await logTirada(actor, resultadoArteDescriptivoHTML(it, nivel, costPA, sinPA ? "∞" : paAntes, sinPA ? "∞" : actor.system.pa.value, hab), "npcs");
      render();
      return;
    }
    if (hab.modoUso === "efecto") {
      await abrirModalUsarArte(actor, "npcs", it, hab);
      render();
      return;
    }

    const atr = it.type === "arte" ? (actor.system.atributos.inteligencia || 0) : (actor.system.atributos.fuerza || 0);
    const rangoActual = actor.system.datos?.rangoManual || "Sin Rango";

    // [UNDAVAR-PARTE-4.2h4m-ACUMULATIVO] Aplica el bono antes de tirar el daño
    let avisoAcumulado = "";
    if (Array.isArray(hab.bonos) && hab.bonos.length) {
      const nombreHab = hab.nombre ? `${it.name} — ${hab.nombre}` : it.name;
      const rBonos = aplicarBonosHabilidad(actor, it, hab, nombreHab, 1);
      await dbPut("npcs", actor);
      // [UNDAVAR-PARTE-4.2h1d-REGISTRO] Muestra el acumulado para que se vea en el registro
      if (hab.bonos.some(b => b.acumulativo)) {
        const total = (actor.system.bonosActivos || [])
          .filter(b => b.estadistica === "dano")
          .reduce((s, b) => s + (Number(b.valor) || 0), 0);
        avisoAcumulado = `<p class="roll-nota"><b>Acumulado:</b> +${total} daño en este golpe.</p>`;
        notificar(`⚔️ ${nombreHab}: +${total} daño acumulado.${avisoBonoRenovado(rBonos)}`);
      }
    }

    const r = tiradaDanoNivel(nivel, atr, { rango: rangoActual });

    // [UNDAVAR-PARTE-4.2c5] Rebote del atacante herido (8/8) al usar arte/arma
    const rebote = aplicarReboteAtacanteHerido(actor);
    iniciarEnfriamientoArte(actor, it, 1);

    let htmlTirada = resultadoUsoArteHTML(it, nivel, costPA, sinPA ? "∞" : paAntes, sinPA ? "∞" : actor.system.pa.value, r, rebote, actor, hab);
    // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Aplica el efecto en la misma tirada de daño
    if (aplicaEfecto && seleccionCond) {
      const nombreHab = hab.nombre ? `${it.name} — ${hab.nombre}` : it.name;
      const esPropio = seleccionCond.store === "npcs" && seleccionCond.objetivo.id === actor.id;
      const objetivoEf = esPropio ? actor : seleccionCond.objetivo;
      const partesEf = await aplicarEfectoHabilidad(actor, "npcs", it, hab, objetivoEf, seleccionCond.store, nombreHab, seleccionCond.condiciones);
      if (partesEf.length) htmlTirada += `<p class="roll-nota"><b>Efecto aplicado:</b> ${esc(partesEf.join(" · "))}</p>`;
    }
    await logTirada(actor, htmlTirada + avisoAcumulado, "npcs");

    // [UNDAVAR-PARTE-4.2h1b-SELLO] Aplica al objetivo las condiciones marcadas
    // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Si el efecto combinado ya las aplicó, no se repiten
    if (seleccionCond && !aplicaEfecto) {
      const esPropio = seleccionCond.store === "npcs" && seleccionCond.objetivo.id === actor.id;
      const objetivoCond = esPropio ? actor : seleccionCond.objetivo;
      const aplicadas = aplicarListaCondiciones(objetivoCond, seleccionCond.condiciones);
      sincronizarEstadoVital(objetivoCond);
      await dbPut(seleccionCond.store, objetivoCond);
      if (aplicadas.length) notificar(`❄️ Condiciones en ${objetivoCond.nombre}: ${aplicadas.join(", ")}.`);
    }
    render();
  }));

  // Equipo (mismo cableado que la ficha de PJ)
  wireEquipoFicha(actor, "npcs");

  // Limpiar registro de tiradas
  qs("#btn-limpiar-log")?.addEventListener("click", async () => {
    const ok = await confirmarAccion("Limpiar registro", "¿Limpiar todo el registro de tiradas de este PNJ?", "Limpiar");
    if (ok) {
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
// [UNDAVAR-PARTE-4.3a] Moneda del precio del ítem: Diamante > Rubí > Oro
function monedaPrecioItem(it) {
  if (Number(it.system?.precio_diamante) > 0) return "diamante";
  if (Number(it.system?.precio_rubi) > 0) return "rubi";
  return "oro";
}
function precioItemEnSuMoneda(it) {
  return Number(it.system?.[`precio_${monedaPrecioItem(it)}`]) || 0;
}
function etiquetaMoneda(m) {
  return m === "diamante" ? "Diamante" : m === "rubi" ? "Rubí" : "Oro";
}
function valorCajaOro(caja) {
  return (Number(caja?.oro) || 0) + (Number(caja?.rubi) || 0) * 100 + (Number(caja?.diamante) || 0) * 10000;
}
// [UNDAVAR-PARTE-4.3a] Paga desde la caja rompiendo monedas mayores si hace falta
function pagarCajaEnMoneda(caja, moneda, cantidad) {
  if (!caja) return false;
  const costeOro = cantidad * (moneda === "diamante" ? 10000 : moneda === "rubi" ? 100 : 1);
  if (valorCajaOro(caja) < costeOro) return false;

  if (moneda === "rubi") {
    while ((Number(caja.rubi) || 0) < cantidad && (Number(caja.diamante) || 0) > 0) {
      caja.diamante = (Number(caja.diamante) || 0) - 1;
      caja.rubi = (Number(caja.rubi) || 0) + 100;
    }
  } else if (moneda === "oro") {
    while ((Number(caja.oro) || 0) < cantidad && (Number(caja.rubi) || 0) > 0) {
      caja.rubi = (Number(caja.rubi) || 0) - 1;
      caja.oro = (Number(caja.oro) || 0) + 100;
    }
    while ((Number(caja.oro) || 0) < cantidad && (Number(caja.diamante) || 0) > 0) {
      caja.diamante = (Number(caja.diamante) || 0) - 1;
      caja.oro = (Number(caja.oro) || 0) + 10000;
    }
  }

  if ((Number(caja[moneda]) || 0) < cantidad) return false;
  caja[moneda] = (Number(caja[moneda]) || 0) - cantidad;
  return true;
}

// [UNDAVAR-PARTE-4.3a] Vende una unidad de un ítem del PJ a la tienda
async function ejecutarVentaTienda(tienda, vendedor, item, moneda, base) {
  const pago = Math.floor(base * 0.7);
  if (pago <= 0) { notificar("⚠️ El precio es demasiado bajo para venderlo."); return; }

  // Relee la tienda y el vendedor para no pisar cambios
  const t = await dbGet("tiendas", tienda.id);
  const v = await dbGet("personajes", vendedor.id);
  if (!t || !v) { notificar("⚠️ No se pudo cargar la tienda o el vendedor."); return; }
  if (!t.caja) t.caja = { oro: 0, rubi: 0, diamante: 0 };

  if (!pagarCajaEnMoneda(t.caja, moneda, pago)) {
    notificar(`⚠️ La caja no tiene ${pago} ${etiquetaMoneda(moneda)} para pagar.`);
    return;
  }

  const it = (v.items || []).find(i => i.id === item.id);
  if (!it) { notificar("⚠️ El ítem ya no está en el inventario."); return; }

  // Cobra el vendedor
  if (!v.system.erianas) v.system.erianas = { oro: 0, rubi: 0, diamante: 0 };
  v.system.erianas[moneda] = (Number(v.system.erianas[moneda]) || 0) + pago;
  // [UNDAVAR-PARTE-4.3c] Registra la venta en el historial del vendedor
  registrarMovimientoErianas(v, `Venta: ${it.name}`, { [moneda]: pago });

  // Quita una unidad del inventario
  const cant = Number(it.system?.cantidad) || 1;
  if (cant > 1) it.system.cantidad = cant - 1;
  else v.items = v.items.filter(i => i.id !== it.id);

  // Entra en el stock de la tienda (mismo nombre y tipo)
  const tipo = it.type === "alimento" ? "objeto" : it.type;
  const existente = (t.items || []).find(x =>
    x.name === it.name && (x.type === tipo || (x.type === "alimento" && tipo === "objeto"))
  );
  if (existente) {
    existente.system = existente.system || {};
    existente.system.cantidad = (Number(existente.system.cantidad) || 0) + 1;
  } else {
    const copia = JSON.parse(JSON.stringify(it));
    copia.id = nuevoId();
    copia.type = tipo;
    copia.system = copia.system || {};
    copia.system.cantidad = 1;
    if (!Array.isArray(t.items)) t.items = [];
    t.items.push(copia);
  }

  await dbPut("personajes", v);
  await dbPut("tiendas", t);
  notificar(`💰 ${v.nombre} vende "${it.name}" por ${pago} ${etiquetaMoneda(moneda)}.`);
  render();
}

// [UNDAVAR-PARTE-4.3a] Prepara la venta; si el ítem no tiene precio, lo pide a mano
async function venderItemTienda(tienda, vendedor, itemId) {
  if (!vendedor) return;
  const item = (vendedor.items || []).find(i => i.id === itemId);
  if (!item) { notificar("⚠️ El ítem ya no está en el inventario."); return; }

  const moneda = monedaPrecioItem(item);
  const base = precioItemEnSuMoneda(item);
  if (base > 0) { await ejecutarVentaTienda(tienda, vendedor, item, moneda, base); return; }

  const modal = crearModal("Precio de venta", `
    <p class="nota">"${esc(item.name)}" no tiene precio. Indica su precio base en Oro.</p>
    <div class="campo-fila"><label>Precio base (Oro)</label>
      <input type="number" id="vp-base" min="1" value="1">
    </div>
    <div class="modal-acciones"><button class="btn-primario" id="vp-confirmar">Vender al 70%</button></div>
  `);
  qs("#vp-confirmar", modal).addEventListener("click", async () => {
    const valor = Math.max(1, parseInt(qs("#vp-base", modal)?.value) || 0);
    modal.remove();
    await ejecutarVentaTienda(tienda, vendedor, item, "oro", valor);
  });
}

// [UNDAVAR-PARTE-4.3b] Transferencias de Erianas entre PJ y la caja de la tienda
function abrirModalTransferirErianas(tienda, personajes) {
  const opciones = (incluirCaja, cajaPrimero = false) => {
    const caja = `<option value="tienda::caja">🏪 Caja de ${esc(tienda.nombre)}</option>`;
    const pjs = personajes.map(p => `<option value="personajes::${p.id}">👤 ${esc(p.nombre)}</option>`);
    return (incluirCaja && cajaPrimero ? [caja, ...pjs] : [...pjs, ...(incluirCaja ? [caja] : [])]).join("");
  };

  const modal = crearModal("🔁 Transferir Erianas", `
    <p class="nota">Mueve la cantidad exacta de monedas, sin conversión automática.</p>
    <div class="campo-fila"><label>Origen</label>
      <select id="tr-origen">${opciones(true)}</select>
    </div>
    <div class="campo-fila"><label>Destino</label>
      <select id="tr-destino">${opciones(true, true)}</select>
    </div>
    <div class="campo-fila"><label>Oro</label><input type="number" id="tr-oro" min="0" value="0"></div>
    <div class="campo-fila"><label>Rubí</label><input type="number" id="tr-rubi" min="0" value="0"></div>
    <div class="campo-fila"><label>Diamante</label><input type="number" id="tr-diamante" min="0" value="0"></div>
    <div class="modal-acciones"><button class="btn-primario" id="tr-confirmar">Transferir</button></div>
  `);

  qs("#tr-confirmar", modal).addEventListener("click", async () => {
    const leerClave = (v) => {
      const corte = String(v || "").indexOf("::");
      return corte < 0 ? null : { store: v.slice(0, corte), id: v.slice(corte + 2) };
    };
    const o = leerClave(qs("#tr-origen", modal)?.value);
    const d = leerClave(qs("#tr-destino", modal)?.value);
    if (!o || !d) { notificar("⚠️ Elige origen y destino."); return; }
    if (o.store === d.store && o.id === d.id) { notificar("⚠️ El origen y el destino son el mismo."); return; }

    const cant = {
      oro: Math.max(0, parseInt(qs("#tr-oro", modal)?.value) || 0),
      rubi: Math.max(0, parseInt(qs("#tr-rubi", modal)?.value) || 0),
      diamante: Math.max(0, parseInt(qs("#tr-diamante", modal)?.value) || 0)
    };
    if (!cant.oro && !cant.rubi && !cant.diamante) { notificar("⚠️ Indica al menos una moneda."); return; }

    // Lee el origen y el destino de la base para no pisar cambios
    const cargar = async (clave) => {
      if (clave.store === "tienda") {
        const t = await dbGet("tiendas", tienda.id);
        if (!t) return null;
        if (!t.caja) t.caja = { oro: 0, rubi: 0, diamante: 0 };
        return { obj: t, store: "tiendas", bolsa: t.caja };
      }
      const p = await dbGet("personajes", clave.id);
      if (!p) return null;
      if (!p.system.erianas) p.system.erianas = { oro: 0, rubi: 0, diamante: 0 };
      return { obj: p, store: "personajes", bolsa: p.system.erianas };
    };
    const origen = await cargar(o);
    const destino = await cargar(d);
    if (!origen || !destino) { notificar("⚠️ No se pudo cargar el origen o el destino."); return; }

    // [UNDAVAR-PARTE-10.6-ERIANAS-CAMBIO] Todas las monedas son Erianas: se paga por valor total
    const valorPedido = totalErianasOro(cant);
    const valorOrigen = totalErianasOro(origen.bolsa);
    if (valorOrigen < valorPedido) {
      notificar(`⚠️ El origen tiene ${valorOrigen} en Erianas y la transferencia vale ${valorPedido}.`);
      return;
    }

    descontarErianas(origen.bolsa, valorPedido);
    for (const m of ["oro", "rubi", "diamante"]) {
      destino.bolsa[m] = (Number(destino.bolsa[m]) || 0) + cant[m];
    }

    // [UNDAVAR-PARTE-4.3c] Registra la transferencia en el historial de cada PJ
    const nombreOrigen = origen.store === "personajes" ? origen.obj.nombre : `Caja de ${origen.obj.nombre}`;
    const nombreDestino = destino.store === "personajes" ? destino.obj.nombre : `Caja de ${destino.obj.nombre}`;
    if (origen.store === "personajes") {
      registrarMovimientoErianas(origen.obj, `Transferencia a ${nombreDestino}`, {
        oro: -cant.oro, rubi: -cant.rubi, diamante: -cant.diamante
      });
    }
    if (destino.store === "personajes") {
      registrarMovimientoErianas(destino.obj, `Transferencia de ${nombreOrigen}`, {
        oro: cant.oro, rubi: cant.rubi, diamante: cant.diamante
      });
    }

    await dbPut(origen.store, origen.obj);
    await dbPut(destino.store, destino.obj);
    modal.remove();
    const resumen = ["oro", "rubi", "diamante"].filter(m => cant[m]).map(m => `${cant[m]} ${etiquetaMoneda(m)}`).join(", ");
    notificar(`🔁 Transferidos ${resumen}.`);
    render();
  });
}

// [UNDAVAR-PARTE-10.6-TRANSFERENCIAS] Transferencia directa desde la ficha, entre PJ y PNJ
async function abrirModalTransferirErianasFicha(origenStore, origenId) {
  const origen = await dbGet(origenStore, origenId);
  if (!origen) { notificar("⚠️ No se encontró la ficha de origen."); return; }
  origen.system = origen.system || {};
  if (!origen.system.erianas) origen.system.erianas = { oro: 0, rubi: 0, diamante: 0 };

  const pjs = soloPersonajesReales(await dbGetAll("personajes"))
    .filter(p => !(origenStore === "personajes" && p.id === origenId));
  const npcs = (await dbGetAll("npcs"))
    .filter(n => !(origenStore === "npcs" && n.id === origenId));

  const opciones = [
    pjs.length ? `<optgroup label="Personajes">${pjs.map(p =>
      `<option value="personajes::${p.id}">👤 ${esc(p.nombre)}</option>`).join("")}</optgroup>` : "",
    npcs.length ? `<optgroup label="PNJ">${npcs.map(n =>
      `<option value="npcs::${n.id}">🎭 ${esc(n.nombre)}</option>`).join("")}</optgroup>` : ""
  ].join("");

  if (!opciones) { notificar("No hay otra ficha a la que transferir."); return; }

  const e = origen.system.erianas;
  const modal = crearModal("🔁 Transferir Erianas", `
    <p class="nota">Mueve monedas exactas desde <b>${esc(origen.nombre)}</b>, sin conversión automática.</p>
    <div class="campo-fila"><label>Destino</label>
      <select id="trf-destino">${opciones}</select>
    </div>
    <div class="erianas-fila">
      <label class="eriana-campo"><span>Oro (${Number(e.oro) || 0})</span><input type="number" id="trf-oro" min="0" value="0"></label>
      <label class="eriana-campo"><span>Rubí (${Number(e.rubi) || 0})</span><input type="number" id="trf-rubi" min="0" value="0"></label>
      <label class="eriana-campo"><span>Diamante (${Number(e.diamante) || 0})</span><input type="number" id="trf-diamante" min="0" value="0"></label>
    </div>
    <div class="modal-acciones"><button class="btn-primario" id="trf-confirmar">Transferir</button></div>
  `);

  qs("#trf-confirmar", modal).addEventListener("click", async () => {
    const valorClave = String(qs("#trf-destino", modal)?.value || "");
    const corte = valorClave.indexOf("::");
    if (corte < 0) { notificar("⚠️ Elige un destino."); return; }
    const destStore = valorClave.slice(0, corte);
    const destId = valorClave.slice(corte + 2);

    const cant = {
      oro: Math.max(0, parseInt(qs("#trf-oro", modal)?.value) || 0),
      rubi: Math.max(0, parseInt(qs("#trf-rubi", modal)?.value) || 0),
      diamante: Math.max(0, parseInt(qs("#trf-diamante", modal)?.value) || 0)
    };
    if (!cant.oro && !cant.rubi && !cant.diamante) { notificar("⚠️ Indica al menos una moneda."); return; }

    // Lee ambas fichas de la base para no pisar cambios
    const o = await dbGet(origenStore, origenId);
    const d = await dbGet(destStore, destId);
    if (!o || !d) { notificar("⚠️ No se pudo cargar el origen o el destino."); return; }
    o.system = o.system || {};
    d.system = d.system || {};
    if (!o.system.erianas) o.system.erianas = { oro: 0, rubi: 0, diamante: 0 };
    if (!d.system.erianas) d.system.erianas = { oro: 0, rubi: 0, diamante: 0 };

    // [UNDAVAR-PARTE-10.6-ERIANAS-CAMBIO] Todas las monedas son Erianas: se paga por valor total
    const valorPedido = totalErianasOro(cant);
    const valorOrigen = totalErianasOro(o.system.erianas);
    if (valorOrigen < valorPedido) {
      notificar(`⚠️ ${o.nombre || "El origen"} tiene ${valorOrigen} en Erianas y la transferencia vale ${valorPedido}.`);
      return;
    }

    descontarErianas(o.system.erianas, valorPedido);
    for (const m of ["oro", "rubi", "diamante"]) {
      d.system.erianas[m] = (Number(d.system.erianas[m]) || 0) + cant[m];
    }

    // [UNDAVAR-PARTE-10.6-TRANSFERENCIAS] Historial en las dos fichas
    registrarMovimientoErianas(o, `Transferencia a ${d.nombre || "otra ficha"}`, {
      oro: -cant.oro, rubi: -cant.rubi, diamante: -cant.diamante
    });
    registrarMovimientoErianas(d, `Transferencia de ${o.nombre || "otra ficha"}`, {
      oro: cant.oro, rubi: cant.rubi, diamante: cant.diamante
    });

    await dbPut(origenStore, o);
    await dbPut(destStore, d);
    modal.remove();
    const resumen = ["oro", "rubi", "diamante"].filter(m => cant[m])
      .map(m => `${cant[m]} ${etiquetaMoneda(m)}`).join(", ");
    notificar(`🔁 Transferidos ${resumen} a ${d.nombre || "la otra ficha"}.`);
    render();
  });
}

// [UNDAVAR-PARTE-4.3d] Carga los 8 productos del Mercado del manual en el stock
// [UNDAVAR-PARTE-4.3f] Carga el catálogo por categorías o por ítems concretos
function abrirModalCargarCatalogo(tienda) {
  // [UNDAVAR-PARTE-9.5C-MATERIALES] «Materiales» deja de estar mezclado con los objetos
  const TIPOS = [["objeto", "Objetos"], ["material", "Materiales"], ["arma", "Armas"], ["elixir", "Elixires"], ["alimento", "Alimentos"]];
  const precio = (i) => {
    const s = i.system || {};
    if (Number(s.precio_diamante) > 0) return `${s.precio_diamante} Diamante`;
    if (Number(s.precio_rubi) > 0) return `${s.precio_rubi} Rubí`;
    return `${Number(s.precio_oro) || 0} Oro`;
  };

  const modal = crearModal("📦 Cargar catálogo", `
    <p class="nota">Elige categorías y marca los ítems que quieres meter en el stock.</p>
    <div class="catalogo-tipos">
      <label><input type="checkbox" id="cat-todos-tipos" checked> <b>Todos</b></label>
      ${TIPOS.map(([t, l]) => `<label><input type="checkbox" class="cat-tipo" value="${t}" checked> ${l}</label>`).join("")}
    </div>
    <div class="campo-fila"><label>Cantidad por ítem</label>
      <input type="number" id="cat-cant" min="1" value="10">
    </div>
    <div class="catalogo-lista" id="cat-lista"></div>
    <div class="modal-acciones">
      <button class="btn-secundario" id="cat-marcar">Marcar todo</button>
      <button class="btn-secundario" id="cat-desmarcar">Desmarcar todo</button>
      <button class="btn-primario" id="cat-cargar">Cargar seleccionados</button>
    </div>
  `);

  const lista = qs("#cat-lista", modal);
  const tiposActivos = () => qsa(".cat-tipo", modal).filter(c => c.checked).map(c => c.value);
  const itemsVisibles = () => {
    const tipos = tiposActivos();
    return CATALOGO_ITEMS.filter(i => {
      if (i.system?.material) return tipos.includes("material");
      return tipos.includes(i.type);
    });
  };
  const pintar = () => {
    const items = itemsVisibles();
    lista.innerHTML = items.length
      ? items.map((i, idx) => `
        <label class="catalogo-item">
          <input type="checkbox" class="cat-item" value="${idx}" checked>
          <span>${esc(i.name)}</span>
          <span class="catalogo-precio">${precio(i)}</span>
        </label>`).join("")
      : `<p class="vacio">No hay ítems en esas categorías.</p>`;
  };

  qsa(".cat-tipo", modal).forEach(c => c.addEventListener("change", () => {
    qs("#cat-todos-tipos", modal).checked = qsa(".cat-tipo", modal).every(x => x.checked);
    pintar();
  }));
  qs("#cat-todos-tipos", modal).addEventListener("change", e => {
    qsa(".cat-tipo", modal).forEach(c => c.checked = e.target.checked);
    pintar();
  });
  qs("#cat-marcar", modal).addEventListener("click", () => qsa(".cat-item", modal).forEach(c => c.checked = true));
  qs("#cat-desmarcar", modal).addEventListener("click", () => qsa(".cat-item", modal).forEach(c => c.checked = false));

  pintar();

  qs("#cat-cargar", modal).addEventListener("click", async () => {
    const items = itemsVisibles();
    const seleccionados = qsa(".cat-item", modal)
      .filter(c => c.checked)
      .map(c => items[Number(c.value)])
      .filter(Boolean);
    if (!seleccionados.length) { notificar("⚠️ Marca al menos un ítem."); return; }
    const cant = Math.max(1, parseInt(qs("#cat-cant", modal)?.value) || 1);

    const t = await dbGet("tiendas", tienda.id);
    if (!t) return;
    if (!Array.isArray(t.items)) t.items = [];
    for (const base of seleccionados) {
      const existente = t.items.find(x => x.name === base.name && x.type === base.type);
      if (existente) {
        existente.system = existente.system || {};
        existente.system.cantidad = (Number(existente.system.cantidad) || 0) + cant;
      } else {
        const nuevo = JSON.parse(JSON.stringify(base));
        nuevo.id = nuevoId();
        nuevo.system = nuevo.system || {};
        nuevo.system.cantidad = cant;
        t.items.push(nuevo);
      }
    }
    await dbPut("tiendas", t);
    modal.remove();
    notificar(`📦 ${seleccionados.length} ítems cargados (x${cant}).`);
    render();
  });
}

// [UNDAVAR-PARTE-4.3d] Mueve Erianas y/o un ítem del stock a otra tienda
async function abrirModalTransferirTienda(tienda, tiendas) {
  const otras = (tiendas || []).filter(t => t.id !== tienda.id);
  if (!otras.length) { notificar("⚠️ Crea otra tienda para poder transferir."); return; }
  const items = (tienda.items || []).filter(i => (Number(i.system?.cantidad) || 0) > 0);

  const modal = crearModal("🔀 Transferir entre tiendas", `
    <p class="nota">Mueve Erianas de la caja y/o un ítem del stock a otra tienda.</p>
    <div class="campo-fila"><label>Tienda destino</label>
      <select id="tt-destino">${otras.map(t => `<option value="${t.id}">${esc(t.nombre)}</option>`).join("")}</select>
    </div>
    <div class="campo-fila"><label>Oro</label><input type="number" id="tt-oro" min="0" value="0"></div>
    <div class="campo-fila"><label>Rubí</label><input type="number" id="tt-rubi" min="0" value="0"></div>
    <div class="campo-fila"><label>Diamante</label><input type="number" id="tt-diamante" min="0" value="0"></div>
    <div class="campo-fila"><label>Ítem</label>
      <select id="tt-item">
        <option value="">— Ninguno —</option>
        ${items.map(i => `<option value="${i.id}">${esc(i.name)} (x${Number(i.system?.cantidad) || 0})</option>`).join("")}
      </select>
    </div>
    <div class="campo-fila"><label>Cantidad de ítem</label><input type="number" id="tt-item-cant" min="1" value="1"></div>
    <div class="modal-acciones"><button class="btn-primario" id="tt-confirmar">Transferir</button></div>
  `);

  qs("#tt-confirmar", modal).addEventListener("click", async () => {
    const destinoId = qs("#tt-destino", modal)?.value || "";
    const cant = {
      oro: Math.max(0, parseInt(qs("#tt-oro", modal)?.value) || 0),
      rubi: Math.max(0, parseInt(qs("#tt-rubi", modal)?.value) || 0),
      diamante: Math.max(0, parseInt(qs("#tt-diamante", modal)?.value) || 0)
    };
    const itemId = qs("#tt-item", modal)?.value || "";
    const itemCant = Math.max(1, parseInt(qs("#tt-item-cant", modal)?.value) || 1);
    if (!cant.oro && !cant.rubi && !cant.diamante && !itemId) {
      notificar("⚠️ Indica dinero o un ítem para transferir.");
      return;
    }

    const o = await dbGet("tiendas", tienda.id);
    const d = destinoId ? await dbGet("tiendas", destinoId) : null;
    if (!o || !d) { notificar("⚠️ No se pudo cargar alguna tienda."); return; }
    if (!o.caja) o.caja = { oro: 0, rubi: 0, diamante: 0 };
    if (!d.caja) d.caja = { oro: 0, rubi: 0, diamante: 0 };

    const falta = ["oro", "rubi", "diamante"].find(m => (Number(o.caja[m]) || 0) < cant[m]);
    if (falta) {
      notificar(`⚠️ La caja no tiene ${cant[falta]} ${etiquetaMoneda(falta)}.`);
      return;
    }

    let it = null;
    if (itemId) {
      it = (o.items || []).find(i => i.id === itemId);
      if (!it) { notificar("⚠️ El ítem ya no está en el stock."); return; }
      const stock = stockItemTienda(it);
      if (stock < itemCant) { notificar(`⚠️ Solo hay ${stock} unidades de ${it.name}.`); return; }
    }

    for (const m of ["oro", "rubi", "diamante"]) {
      o.caja[m] = (Number(o.caja[m]) || 0) - cant[m];
      d.caja[m] = (Number(d.caja[m]) || 0) + cant[m];
    }

    if (it) {
      const stock = stockItemTienda(it);
      if (stock > itemCant) it.system.cantidad = stock - itemCant;
      else o.items = (o.items || []).filter(i => i.id !== it.id);

      const existente = (d.items || []).find(x => x.name === it.name && x.type === it.type);
      if (existente) {
        existente.system = existente.system || {};
        existente.system.cantidad = (Number(existente.system.cantidad) || 0) + itemCant;
      } else {
        const copia = JSON.parse(JSON.stringify(it));
        copia.id = nuevoId();
        copia.system = copia.system || {};
        copia.system.cantidad = itemCant;
        if (!Array.isArray(d.items)) d.items = [];
        d.items.push(copia);
      }
    }

    await dbPut("tiendas", o);
    await dbPut("tiendas", d);
    modal.remove();
    notificar(`🔀 Transferencia a ${d.nombre} completada.`);
    render();
  });
}

// [UNDAVAR-PARTE-4.3g-TIENDA-INFO] Mezcla el ítem de la tienda con su ficha del catálogo
function datosInfoItem(item) {
  const maestro = (typeof CATALOGO_ITEMS !== "undefined")
    ? CATALOGO_ITEMS.find(m => m.name === item.name)
    : null;
  const sys = { ...(maestro?.system || {}) };
  Object.entries(item.system || {}).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) sys[k] = v;
  });
  return sys;
}

// [UNDAVAR-PARTE-4.3g-TIENDA-INFO] Ficha de información antes de comprar
function abrirInfoItemTienda(item) {
  const sys = datosInfoItem(item);
  const tipos = { objeto: "Objeto", elixir: "Elixir", arma: "Arma", equipo: "Equipo", alimento: "Alimento" };
  const ef = efectoMecanicoItem({ name: item.name, system: sys });
  const descripcion = sys.efecto || sys.descripcion || "Sin descripción.";
  const precio = item.system?.precio_diamante
    ? `${item.system.precio_diamante} Diamante`
    : item.system?.precio_rubi
      ? `${item.system.precio_rubi} Rubí`
      : `${item.system?.precio_oro || 0} Oro`;
  // [UNDAVAR-PARTE-10.5-NIVELES] La información detalla rango, azar y nivel de venta
  const rangoInfo = rangoNivelesItem({ name: item.name, system: sys });
  const filasNivel = rangoInfo.tiene
    ? [
        ["Nivel", rangoInfo.min === rangoInfo.max ? `Nv. ${rangoInfo.min}` : `Nv. ${rangoInfo.min}-${rangoInfo.max}`],
        ["Nivel de venta", `Nv. ${rangoInfo.venta}`],
        ["Nivel al azar", rangoInfo.aleatorio ? "Sí (se sortea al comprar)" : "No"]
      ]
    : [["Nivel", "—"]];
  const filas = [
    ["Tipo", tipos[item.type] || item.type],
    ...filasNivel,
    ["Duración", sys.duracion || "—"],
    ["Enfriamiento", sys.enfriamiento || "—"],
    ["Reducción de daño", sys.reduccion_dano ? `−${sys.reduccion_dano}` : "—"],
    ["Efecto mecánico", describirEfectoMecanico(ef) || "—"],
    ["Precio", precio],
    ["Stock", `x${Number(item.system?.cantidad) || 0}`]
  ];
  crearModal(item.name, `
    <p class="info-descripcion">${esc(descripcion)}</p>
    <table class="info-tabla">
      ${filas.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(String(v))}</td></tr>`).join("")}
    </table>
  `);
}

// [UNDAVAR-PARTE-9.4B-CARRITO] Carrito de compra de la tienda abierta
const CARRITO_CLAVE = "undavar_carrito_estado";
const carrito = { tiendaId: "", compradorId: "", moneda: "oro", lineas: [], abierto: false, tienda: null };

function carritoLeer() {
  try {
    const crudo = localStorage.getItem(CARRITO_CLAVE);
    return crudo ? JSON.parse(crudo) : null;
  } catch (e) {
    return null;
  }
}

function carritoGuardar() {
  if (window.self !== window.top) return;
  try {
    localStorage.setItem(CARRITO_CLAVE, JSON.stringify({
      tiendaId: carrito.tiendaId,
      compradorId: carrito.compradorId,
      moneda: carrito.moneda,
      lineas: carrito.lineas,
      abierto: carrito.abierto,
    }));
  } catch (e) { }
}

// [UNDAVAR-PARTE-10.4-ARMAS] Stock de tienda: un arma de gladiador sin cantidad vale 1
function stockItemTienda(item) {
  const cant = item?.system?.cantidad;
  if (cant === undefined || cant === null || cant === "") return 1;
  return Math.max(0, Number(cant) || 0);
}

// [UNDAVAR-PARTE-9.4B-CARRITO] Recupera el carrito de esta tienda
function carritoIniciar(tienda, personajes) {
  const guardado = carritoLeer();
  const idsValidos = new Set(tienda.items.map(i => i.id));
  if (guardado && guardado.tiendaId === tienda.id) {
    carrito.lineas = (Array.isArray(guardado.lineas) ? guardado.lineas : [])
      .filter(l => l && idsValidos.has(l.itemId) && Number(l.cantidad) > 0)
      .map(l => {
        const item = tienda.items.find(i => i.id === l.itemId);
        const stock = stockItemTienda(item);
        return { itemId: l.itemId, cantidad: Math.min(Math.max(1, Number(l.cantidad) || 1), stock) };
      })
      .filter(l => l.cantidad > 0);
    carrito.compradorId = personajes.some(p => p.id === guardado.compradorId) ? guardado.compradorId : "";
    carrito.moneda = ["oro", "rubi", "diamante"].includes(guardado.moneda) ? guardado.moneda : "oro";
    carrito.abierto = !!guardado.abierto;
  } else {
    carrito.lineas = [];
    carrito.compradorId = personajes.some(p => p.id === carrito.compradorId) ? carrito.compradorId : "";
    carrito.moneda = "oro";
    carrito.abierto = false;
  }
  carrito.tiendaId = tienda.id;
  carrito.tienda = tienda;
}

function carritoPrecioOro(item) {
  const s = item?.system || {};
  if (Number(s.precio_diamante) > 0) return Number(s.precio_diamante) * 10000;
  if (Number(s.precio_rubi) > 0) return Number(s.precio_rubi) * 100;
  return Number(s.precio_oro) || 0;
}

function carritoLinea(itemId) {
  return carrito.lineas.find(l => l.itemId === itemId) || null;
}

// [UNDAVAR-PARTE-9.4B-CARRITO] Totales del carrito en oro y en la moneda elegida
function carritoResumen() {
  let totalOro = 0;
  let unidades = 0;
  for (const linea of carrito.lineas) {
    const item = carrito.tienda?.items.find(i => i.id === linea.itemId);
    if (!item) continue;
    totalOro += carritoPrecioOro(item) * linea.cantidad;
    unidades += linea.cantidad;
  }
  const tasa = carrito.moneda === "diamante" ? 10000 : carrito.moneda === "rubi" ? 100 : 1;
  const monedas = totalOro > 0 ? Math.ceil(totalOro / tasa) : 0;
  return { totalOro, unidades, monedas, cambio: monedas * tasa - totalOro };
}

function carritoTextoTotal(resumen) {
  if (!resumen.totalOro) return "0 Oro";
  if (carrito.moneda === "oro") return `${resumen.totalOro} Oro`;
  return `${resumen.monedas} ${etiquetaMoneda(carrito.moneda)} (${resumen.totalOro} Oro)`;
}

// [UNDAVAR-PARTE-9.4B-CARRITO] Añade una unidad respetando el stock
function carritoAgregar(item) {
  const stock = stockItemTienda(item);
  if (!item || stock <= 0) { notificar("⚠️ Sin stock disponible."); return; }
  const linea = carritoLinea(item.id);
  if (linea) {
    if (linea.cantidad >= stock) { notificar(`⚠️ No hay más stock de ${item.name}.`); return; }
    linea.cantidad += 1;
  } else {
    carrito.lineas.push({ itemId: item.id, cantidad: 1 });
  }
  carritoGuardar();
  carritoPintar();
}

function carritoCambiar(itemId, delta) {
  const linea = carritoLinea(itemId);
  if (!linea) return;
  const item = carrito.tienda?.items.find(i => i.id === itemId);
  const stock = stockItemTienda(item);
  const nueva = Math.max(0, Math.min(stock, linea.cantidad + delta));
  if (nueva <= 0) carrito.lineas = carrito.lineas.filter(l => l.itemId !== itemId);
  else linea.cantidad = nueva;
  carritoGuardar();
  carritoPintar();
}

function carritoQuitar(itemId) {
  carrito.lineas = carrito.lineas.filter(l => l.itemId !== itemId);
  carritoGuardar();
  carritoPintar();
}

// [UNDAVAR-PARTE-9.4B-CARRITO] Pinta el panel, la barra y las cantidades de cada fila
function carritoPintar() {
  const resumen = carritoResumen();
  const panel = document.getElementById("carrito-panel");
  if (panel) {
    panel.classList.toggle("abierto", carrito.abierto);
    panel.setAttribute("aria-hidden", carrito.abierto ? "false" : "true");
  }

  qsa("[data-carrito-badge]").forEach(b => {
    b.textContent = resumen.unidades ? String(resumen.unidades) : "";
    b.classList.toggle("visible", resumen.unidades > 0);
  });
  qsa("#carrito-total-barra, #carrito-total-panel").forEach(el => { el.textContent = carritoTextoTotal(resumen); });

  qsa("[data-carrito-fila]").forEach(el => {
    const linea = carritoLinea(el.dataset.carritoFila);
    el.textContent = linea ? `🛒 ${linea.cantidad}` : "";
    el.classList.toggle("visible", !!linea);
  });

  const cont = document.getElementById("carrito-lineas");
  if (cont) {
    if (!carrito.lineas.length) {
      cont.innerHTML = `<p class="carrito-vacio">El carrito está vacío. Usa «＋» en los artículos.</p>`;
    } else {
      cont.innerHTML = carrito.lineas.map(linea => {
        const item = carrito.tienda?.items.find(i => i.id === linea.itemId);
        if (!item) return "";
        const unitario = carritoPrecioOro(item);
        const stock = stockItemTienda(item);
        return `<div class="carrito-linea" data-carrito-linea="${esc(item.id)}">
            <div class="carrito-linea-nombre">${esc(item.name)}</div>
            <div class="carrito-linea-precio">${unitario} Oro c/u</div>
            <div class="carrito-linea-cantidad">
              <button type="button" class="btn-secundario chico btn-icono" data-carrito-menos="${esc(item.id)}" aria-label="Quitar uno de ${esc(item.name)}">−</button>
              <b>${linea.cantidad}</b>
              <button type="button" class="btn-secundario chico btn-icono" data-carrito-mas="${esc(item.id)}" ${linea.cantidad >= stock ? "disabled" : ""} aria-label="Añadir uno de ${esc(item.name)}">＋</button>
            </div>
            <div class="carrito-linea-sub">${unitario * linea.cantidad} Oro</div>
            <button type="button" class="btn-peligro chico btn-icono" data-carrito-quitar="${esc(item.id)}" title="Quitar del carrito" aria-label="Quitar ${esc(item.name)} del carrito">✕</button>
          </div>`;
      }).join("");
    }
  }

  const btnComprar = document.getElementById("btn-comprar-carrito");
  if (btnComprar) {
    btnComprar.disabled = !carrito.lineas.length || !carrito.compradorId;
    btnComprar.textContent = resumen.unidades
      ? `Comprar ${resumen.unidades} ítem${resumen.unidades === 1 ? "" : "s"}`
      : "Comprar todo";
  }
}

// [UNDAVAR-PARTE-9.4B-CARRITO] Compra una línea reutilizando las reglas de la tienda
async function aplicarCompraTienda(tienda, comprador, itemTienda, cantidadAComprar, monedaPago) {
  if (!itemTienda) return { ok: false, mensaje: "El artículo ya no está en la tienda." };
  const cantidad = Math.max(1, Number(cantidadAComprar) || 1);
  const stock = stockItemTienda(itemTienda);
  if (stock < cantidad) return { ok: false, mensaje: `No hay stock suficiente de ${itemTienda.name} (quedan ${stock}).` };
  if (!comprador?.system?.erianas) return { ok: false, mensaje: "El comprador no tiene cartera." };

  const precioUnitarioOro = carritoPrecioOro(itemTienda);
  const precioTotalOro = precioUnitarioOro * cantidad;
  const carteraPJ = comprador.system.erianas;
  const cajaTienda = tienda.caja;

  const valorMonedaOro = monedaPago === "diamante" ? 10000 : monedaPago === "rubi" ? 100 : 1;
  const monedasNecesarias = precioTotalOro > 0 ? Math.ceil(precioTotalOro / valorMonedaOro) : 0;
  const entregadoOro = monedasNecesarias * valorMonedaOro;
  const cambioRequeridoOro = entregadoOro - precioTotalOro;

  if (monedaPago === "oro") {
    if ((Number(carteraPJ.oro) || 0) < precioTotalOro) {
      return { ok: false, mensaje: `${comprador.nombre} no tiene suficientes Erianas.` };
    }
  } else if ((Number(carteraPJ[monedaPago]) || 0) < monedasNecesarias) {
    const nombreMoneda = monedaPago === "rubi" ? "Rubíes" : "Diamantes";
    return { ok: false, mensaje: `${comprador.nombre} no tiene suficientes ${nombreMoneda} (necesita ${monedasNecesarias}).` };
  }

  if (erianasATotalOro(cajaTienda) + entregadoOro < cambioRequeridoOro) {
    return { ok: false, mensaje: `Sin cambio en caja para devolver ${cambioRequeridoOro} Oro.` };
  }

  if (monedaPago === "oro") {
    carteraPJ.oro = (Number(carteraPJ.oro) || 0) - precioTotalOro;
    cajaTienda.oro = (Number(cajaTienda.oro) || 0) + precioTotalOro;
  } else if (monedasNecesarias > 0) {
    carteraPJ[monedaPago] = (Number(carteraPJ[monedaPago]) || 0) - monedasNecesarias;
    cajaTienda[monedaPago] = (Number(cajaTienda[monedaPago]) || 0) + monedasNecesarias;
    cajaTienda.oro = (Number(cajaTienda.oro) || 0) - cambioRequeridoOro;
    carteraPJ.oro = (Number(carteraPJ.oro) || 0) + cambioRequeridoOro;
  }

  // Rompe monedas de la caja si el cambio deja el oro en negativo
  while ((Number(cajaTienda.oro) || 0) < 0) {
    if ((Number(cajaTienda.rubi) || 0) > 0) { cajaTienda.rubi -= 1; cajaTienda.oro = (Number(cajaTienda.oro) || 0) + 100; }
    else if ((Number(cajaTienda.diamante) || 0) > 0) { cajaTienda.diamante -= 1; cajaTienda.oro = (Number(cajaTienda.oro) || 0) + 10000; }
    else break;
  }

  if (!comprador.items) comprador.items = [];
  const tipoFinal = (itemTienda.type === "alimento") ? "objeto" : itemTienda.type;

  // Los contenedores no se agrupan nunca
  const textoItem = `${itemTienda.name} ${itemTienda.system?.descripcion || ""} ${itemTienda.system?.efecto || ""}`.toLowerCase();
  const tieneEspaciosIndicados = /(\d+)\s*(espacios|espacio|slots|slot)/i.test(textoItem);
  const esContenedor = itemTienda.system?.esContenedor
    || tieneEspaciosIndicados
    || ["mochila", "bolso", "bulto", "saco", "cofre", "anillo espacial", "contenedor"].some(p => textoItem.includes(p));

  // [UNDAVAR-PARTE-10.5-NIVELES] Decide el nivel de cada unidad al comprar
  const sysCompra = datosInfoItem(itemTienda);
  const nivelCompra = rangoNivelesItem({ name: itemTienda.name, system: sysCompra });
  const nivelAlAzar = nivelCompra.tiene && nivelCompra.aleatorio;

  // [UNDAVAR-PARTE-10.5-NIVELES] Un objeto ocupa un solo espacio aunque tenga muchas unidades.
  // Al azar se guarda un nivel por unidad en `nivelesUnidad`, sin mostrarlo.
  // [UNDAVAR-PARTE-10.8-TIENDA-SEPARADOS] Armas y armaduras no se agrupan al comprar
  const esNoApilable = tipoFinal === "arma" || tipoFinal === "equipo";
  const existente = (!esContenedor && !esNoApilable)
    ? comprador.items.find(i => {
        if (i.name !== itemTienda.name || i.type !== tipoFinal) return false;
        if (nivelAlAzar) {
          return !!i.system?.nivelAleatorio
            && Number(i.system?.nivelMin) === nivelCompra.min
            && Number(i.system?.nivelMax) === nivelCompra.max;
        }
        if (!nivelCompra.tiene) return true;
        return Number(i.system?.nivelActual) === nivelCompra.venta && !i.system?.nivelOculto;
      })
    : null;

  if (existente && nivelAlAzar) {
    // [UNDAVAR-PARTE-10.5-NIVELES] Suma unidades y sortea un nivel para cada una
    const niveles = nivelesUnidadItem(existente);
    const baseNivel = { name: itemTienda.name, system: sysCompra };
    for (let r = 0; r < cantidad; r++) niveles.push(sortearNivelItem(baseNivel));
    existente.system.nivelesUnidad = niveles;
    existente.system.cantidad = (Number(existente.system.cantidad) || 0) + cantidad;
    existente.system.nivelActual = niveles[0];
    existente.system.nivelOculto = true;
  } else if (existente) {
    existente.system.cantidad = (Number(existente.system.cantidad) || 0) + cantidad;
  } else {
    // [UNDAVAR-PARTE-10.5-NIVELES] Una sola entrada para toda la compra
    // [UNDAVAR-PARTE-10.8-TIENDA-SEPARADOS] Armas y armaduras van una por entrada
    const separar = esContenedor || esNoApilable;
    const repeticiones = separar ? cantidad : 1;
    const unidadesPorEntrada = separar ? 1 : cantidad;
    for (let r = 0; r < repeticiones; r++) {
      const itemMaestro = (typeof CATALOGO_ITEMS !== "undefined")
        ? CATALOGO_ITEMS.find(m => m.name === itemTienda.name)
        : null;
      const sysMaestro = itemMaestro ? (itemMaestro.system || {}) : {};
      const textoEfecto = sysMaestro.efecto || sysMaestro.descripcion || itemTienda.system?.descripcion || itemTienda.system?.efecto || "";
      let nuevo = {
        id: nuevoId(),
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
          cantidad: unidadesPorEntrada,
          precio_oro: 0,
          precio_rubi: 0,
          precio_diamante: 0,
        },
      };
      if (nivelCompra.tiene) {
        nuevo = prepararUnidadesNivelItem(JSON.parse(JSON.stringify(nuevo)), unidadesPorEntrada, { usarVenta: true });
      }
      comprador.items.push(nuevo);
    }
  }

  // [UNDAVAR-PARTE-10.4-ARMAS] Normaliza el stock antes de descontar
  itemTienda.system.cantidad = stockItemTienda(itemTienda) - cantidad;

  if (monedaPago === "oro") {
    registrarMovimientoErianas(comprador, `Compra: ${cantidad}x ${itemTienda.name}`, { oro: -precioTotalOro });
  } else {
    registrarMovimientoErianas(comprador, `Compra: ${cantidad}x ${itemTienda.name}`, {
      [monedaPago]: -monedasNecesarias,
      oro: cambioRequeridoOro,
    });
  }

  await dbPut("personajes", comprador);
  await dbPut("tiendas", tienda);

  return { ok: true, totalOro: precioTotalOro, cambio: cambioRequeridoOro };
}

// [UNDAVAR-PARTE-9.4B-CARRITO] Cobra el carrito línea por línea
async function comprarCarrito(tienda) {
  if (!carrito.compradorId) { notificar("⚠️ Elige un comprador en la barra de la tienda."); return; }
  if (!carrito.lineas.length) { notificar("El carrito está vacío."); return; }

  const comprador = await dbGet("personajes", carrito.compradorId);
  if (!comprador) { notificar("⚠️ Personaje no encontrado."); return; }

  // [UNDAVAR-PARTE-9.4B-CARRITO] Comprueba stock y fondos de todo el carrito antes de cobrar
  const resumen = carritoResumen();
  for (const linea of carrito.lineas) {
    const item = tienda.items.find(i => i.id === linea.itemId);
    const stock = stockItemTienda(item);
    if (!item || stock < linea.cantidad) {
      notificar(`⚠️ Stock insuficiente de ${item ? item.name : "un artículo"} (quedan ${stock}).`);
      carritoGuardar();
      carritoPintar();
      return;
    }
  }
  const cartera = comprador.system?.erianas;
  if (!cartera) { notificar("⚠️ El comprador no tiene cartera."); return; }
  const tasa = carrito.moneda === "diamante" ? 10000 : carrito.moneda === "rubi" ? 100 : 1;
  const monedasTotales = resumen.totalOro > 0 ? Math.ceil(resumen.totalOro / tasa) : 0;
  if (carrito.moneda === "oro" && (Number(cartera.oro) || 0) < resumen.totalOro) {
    notificar(`❌ ${comprador.nombre} no tiene suficientes Erianas (necesita ${resumen.totalOro} Oro).`);
    return;
  }
  if (carrito.moneda !== "oro" && (Number(cartera[carrito.moneda]) || 0) < monedasTotales) {
    const nombreMoneda = carrito.moneda === "rubi" ? "Rubíes" : "Diamantes";
    notificar(`❌ ${comprador.nombre} no tiene suficientes ${nombreMoneda} (necesita ${monedasTotales}).`);
    return;
  }

  let compradas = 0;
  let unidades = 0;
  let totalOro = 0;
  let cambio = 0;
  let fallo = "";

  for (const linea of [...carrito.lineas]) {
    const item = tienda.items.find(i => i.id === linea.itemId);
    if (!item) { carritoQuitar(linea.itemId); continue; }
    const res = await aplicarCompraTienda(tienda, comprador, item, linea.cantidad, carrito.moneda);
    if (!res.ok) { fallo = res.mensaje; break; }
    carrito.lineas = carrito.lineas.filter(l => l.itemId !== linea.itemId);
    compradas += 1;
    unidades += linea.cantidad;
    totalOro += res.totalOro;
    cambio += res.cambio;
    carritoGuardar();
  }

  if (fallo) {
    notificar(`⚠️ ${fallo}${compradas ? ` Se compraron ${compradas} línea${compradas === 1 ? "" : "s"} antes del fallo.` : ""}`);
  } else {
    notificar(`✨ Compra de ${unidades} ítem${unidades === 1 ? "" : "s"} por ${totalOro} Oro completada.${cambio ? ` Cambio: ${cambio} Oro.` : ""}`);
  }

  if (compradas) {
    const y = window.scrollY;
    await render();
    window.scrollTo(0, y);
  } else {
    carritoPintar();
  }
}

async function renderTienda() {
  // [UNDAVAR-PARTE-3.1] Sin tienda seleccionada se muestra el selector.
  if (!state.tiendaId) {
    await renderSelectorRegistro({
      store: "tiendas", vista: "tienda", idKey: "tiendaId",
      titulo: "Tiendas",
      descripcion: "Elige una tienda para abrir su mostrador y su caja.",
      subtitulo: (o) => `${o.items?.length || 0} ítems`,
      vacio: "No hay tiendas todavía. Crea una desde Inicio.",
    });
    return;
  }

  const tienda = await dbGet("tiendas", state.tiendaId);
  // [UNDAVAR-PARTE-9.3B-MEMORIA] Si la tienda guardada ya no existe, muestra la lista
  if (!tienda) { state.tiendaId = null; return renderTienda(); }

  // [UNDAVAR-PARTE-4.2h2-PAREJA] Las copias no compran ni venden
  const personajes = soloPersonajesReales(await dbGetAll("personajes"));

  // [UNDAVAR-PARTE-4.3d] Resto de tiendas para transferir stock y caja
  const tiendas = await dbGetAll("tiendas");

  if (!tienda.caja) tienda.caja = { oro: 0, rubi: 0, diamante: 0 };

  // [UNDAVAR-PARTE-4.3a] Vendedor seleccionado y sus ítems vendibles
  const TIPOS_VENDIBLES = ["objeto", "elixir", "arma", "equipo", "alimento"];
  const vendedor = state.ventaVendedorId ? personajes.find(p => p.id === state.ventaVendedorId) : null;
  const vendibles = vendedor ? (vendedor.items || []).filter(i => TIPOS_VENDIBLES.includes(i.type)) : [];
  const filaVenta = (it) => {
    const moneda = monedaPrecioItem(it);
    const base = precioItemEnSuMoneda(it);
    const pago = Math.floor(base * 0.7);
    // [UNDAVAR-PARTE-10.5-NIVELES] El vendedor ve el nivel de su unidad
    const nivelTxt = etiquetaNivelItem(it);
    return `
    <div class="tienda-item" data-item-id="${it.id}">
      <span class="item-nombre">${esc(it.name)}${nivelTxt ? ` <span class="nivel-badge">${esc(nivelTxt)}</span>` : ""} <span class="stock">(x${Number(it.system?.cantidad) || 1})</span></span>
      <span class="precio">${base ? `${pago} ${etiquetaMoneda(moneda)} (70%)` : "Sin precio"}</span>
      <button class="btn-secundario chico btn-vender" data-id="${it.id}">Vender</button>
    </div>`;
  };

  // [UNDAVAR-PARTE-9.4B-CARRITO] Recupera el carrito guardado de esta tienda
  carritoIniciar(tienda, personajes);

  const filaItem = (item) => {
    const precio = item.system.precio_diamante ? `${item.system.precio_diamante} Diamante` : item.system.precio_rubi ? `${item.system.precio_rubi} Rubí` : `${item.system.precio_oro || 0} Oro`;
    // [UNDAVAR-PARTE-10.4-ARMAS] Las armas de gladiador sin cantidad tienen stock 1
    const stock = stockItemTienda(item);
    const sinStock = stock <= 0;
    // [UNDAVAR-PARTE-10.5-NIVELES] La tienda muestra el rango o el nivel fijo de venta
    const nivelTxt = rangoNivelTexto({ name: item.name, system: datosInfoItem(item) });
    return `
    <div class="tienda-item" data-item-id="${item.id}" data-nombre="${esc(mapaNormalizarTexto(item.name))}">
      <span class="item-nombre">${esc(item.name)}${nivelTxt ? ` <span class="nivel-badge">${esc(nivelTxt)}</span>` : ""} <span class="stock">(x${stock})</span></span>
      <span class="precio">${precio}</span>
      <span class="carrito-celda">
        <button class="btn-secundario chico btn-icono btn-agregar-carrito" data-id="${item.id}" title="Añadir al carrito" aria-label="Añadir ${esc(item.name)} al carrito" ${sinStock ? "disabled" : ""}>＋</button>
        <span class="carrito-fila-qty" data-carrito-fila="${esc(item.id)}"></span>
      </span>
      <button class="btn-secundario chico btn-comprar" data-id="${item.id}" title="Compra directa" aria-label="Compra directa de ${esc(item.name)}" ${sinStock ? "disabled" : ""}>💳</button>
      <button class="btn-secundario chico btn-icono btn-info-item" data-id="${item.id}" title="Información" aria-label="Información de ${esc(item.name)}"><span data-icono="info"></span></button>
      <button class="btn-secundario chico btn-icono btn-editar-item" data-id="${item.id}" title="Editar" aria-label="Editar ${esc(item.name)}"><span data-icono="editar"></span></button>
      <button class="btn-peligro chico btn-icono btn-borrar-item" data-id="${item.id}" title="Eliminar" aria-label="Eliminar ${esc(item.name)}"><span data-icono="borrar"></span></button>
    </div>`;
  };

  // [UNDAVAR-PARTE-10.4-ARMAS] Separa armas comunes de armas de gladiador
  const tipos = [
    { tipo: "objeto", etiqueta: "Objetos", incluye: i => i.type === "objeto" },
    { tipo: "arma_comun", etiqueta: "Armas comunes", incluye: i => i.type === "arma" && esArmaComun(i) },
    { tipo: "arma_gladiador", etiqueta: "Armas de gladiador", incluye: i => i.type === "arma" && !esArmaComun(i) },
    { tipo: "elixir", etiqueta: "Elixires", incluye: i => i.type === "elixir" },
    { tipo: "alimento", etiqueta: "Alimentos", incluye: i => i.type === "alimento" }
  ];

  app.innerHTML = `
  <section class="vista-ficha">
    <header class="sheet-header">
      <div class="ed-volver-fila">
        <button class="btn-volver" id="btn-volver-lista">← Lista</button>
        <button class="btn-volver" id="btn-volver">← Inicio</button>
      </div>
      <div class="header-izquierda">
        <input type="text" id="campo-nombre" value="${esc(tienda.nombre)}" placeholder="Nombre de la tienda">
      </div>
      <div class="caja-tienda">
        💰 Caja: <b>${tienda.caja.oro}</b> Oro | <b>${tienda.caja.rubi}</b> Rubí | <b>${tienda.caja.diamante}</b> Diamante
        <button id="btn-inyectar-caja" class="btn-secundario chico">+ Inyectar fondos</button>
        <button id="btn-transferir-erianas" class="btn-secundario chico">🔁 Transferir Erianas</button>
        <!-- [UNDAVAR-PARTE-4.3d] Atajo de Mercado y transferencias entre tiendas -->
        <button id="btn-cargar-catalogo" class="btn-secundario chico">📦 Cargar catálogo</button>
        <button id="btn-transferir-tienda" class="btn-secundario chico">🔀 Transferir entre tiendas</button>
        </div>
      <div class="header-tiradas">
        <button class="btn-secundario chico" id="btn-exportar-actor"><span data-icono="exportar"></span> Exportar</button>
      </div>
    </header>
    <p class="nota">Elige el comprador en la barra fija y añade artículos con «＋». El carrito guarda las cantidades y cobra todo junto.</p>

    <!-- [UNDAVAR-PARTE-9.4B-CARRITO] Barra fija con comprador y acceso al carrito -->
    <div class="tienda-barra">
      <!-- [UNDAVAR-PARTE-9.5D-BUSCADOR] Buscador local del stock -->
      <div class="tienda-barra-buscar">
        <input type="search" id="buscar-tienda" placeholder="🔍 Buscar artículo…" autocomplete="off" aria-label="Buscar artículo en la tienda">
      </div>
      <div class="tienda-barra-comprador">
        <label for="select-comprador-carrito">Comprador</label>
        <select id="select-comprador-carrito" class="combate-select">
          <option value="">Elige comprador…</option>
          ${personajes.map(p => `<option value="${p.id}" ${p.id === carrito.compradorId ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}
        </select>
      </div>
      <div class="tienda-barra-total">
        <span>Total</span>
        <b id="carrito-total-barra">0 Oro</b>
      </div>
      <button type="button" class="btn-primario chico" id="btn-abrir-carrito">
        🛒 Carrito <span class="carrito-badge" data-carrito-badge></span>
      </button>
    </div>

    <!-- [UNDAVAR-PARTE-4.3a] Vender a la tienda -->
    <div class="tienda-seccion">
      <div class="columna-header">
        <h2>Vender a la tienda</h2>
        <select id="select-vendedor" class="combate-select" style="max-width:260px;">
          <option value="">Vendedor…</option>
          ${personajes.map(p => `<option value="${p.id}" ${p.id === state.ventaVendedorId ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}
        </select>
      </div>
      <p class="nota">La tienda paga el <b>70%</b> del precio del ítem y necesita fondos en su caja.</p>
      <div class="tienda-lista">
        ${vendedor
          ? (vendibles.length
              ? vendibles.map(filaVenta).join("")
              : `<p class="vacio">Este personaje no tiene nada vendible.</p>`)
          : `<p class="vacio">Elige un vendedor para ver sus objetos.</p>`}
      </div>
    </div>

    ${tipos.map(({ tipo, etiqueta, incluye }) => `
      <div class="tienda-seccion">
        <div class="columna-header">
          <h2>${etiqueta}</h2>
          <button class="btn-secundario chico btn-add-catalogo" data-tipo="${tipo}">+ Añadir del catálogo</button>
          <button class="btn-secundario chico btn-add-manual" data-tipo="${tipo}">+ Crear nuevo</button>
        </div>
        <div class="tienda-cabecera" aria-hidden="true">
          <span>Artículo</span><span>Precio</span><span>Carrito</span><span style="grid-column:4 / -1">Acciones</span>
        </div>
        <div class="tienda-lista">
          ${tienda.items.filter(incluye).map(filaItem).join("") || `<p class="vacio">Sin ítems.</p>`}
        </div>
      </div>`).join("")}

    <!-- [UNDAVAR-PARTE-9.4B-CARRITO] Panel del carrito -->
    <aside class="carrito-panel" id="carrito-panel" aria-hidden="true" aria-label="Carrito de compra">
      <div class="carrito-cab">
        <strong>🛒 Carrito</strong>
        <button type="button" class="btn-secundario chico btn-icono" id="btn-cerrar-carrito" aria-label="Cerrar carrito">✕</button>
      </div>
      <div class="carrito-lineas" id="carrito-lineas"></div>
      <div class="carrito-pie">
        <div class="carrito-pago">
          <label for="carrito-moneda">Pago en</label>
          <select id="carrito-moneda">
            <option value="oro" ${carrito.moneda === "oro" ? "selected" : ""}>Oro</option>
            <option value="rubi" ${carrito.moneda === "rubi" ? "selected" : ""}>Rubí</option>
            <option value="diamante" ${carrito.moneda === "diamante" ? "selected" : ""}>Diamante</option>
          </select>
        </div>
        <div class="carrito-total">Total <b id="carrito-total-panel">0 Oro</b></div>
        <button type="button" class="btn-primario" id="btn-comprar-carrito">Comprar todo</button>
      </div>
    </aside>
  </section>`;

  qs("#btn-volver").addEventListener("click", () => ir("inicio"));
  // [UNDAVAR-PARTE-9.3B-LISTA] Vuelve a la lista de tiendas
  qs("#btn-volver-lista").addEventListener("click", () => ir("tienda", { tiendaId: null }));
  qs("#btn-exportar-actor").addEventListener("click", () => exportarPerfil("tiendas", tienda.id).catch(e => notificar("Error al exportar: " + (e.message || e))));
  qs("#campo-nombre").addEventListener("change", async e => { tienda.nombre = e.target.value; await dbPut("tiendas", tienda); });

  qsa(".btn-add-catalogo").forEach(b => b.addEventListener("click", () => abrirModalCatalogo(tienda, b.dataset.tipo)));
  qsa(".btn-add-manual").forEach(b => b.addEventListener("click", () => abrirEditorItem(tienda, b.dataset.tipo)));
  qsa(".btn-editar-item").forEach(b => b.addEventListener("click", () => abrirEditorItem(tienda, null, b.dataset.id)));
  // [UNDAVAR-PARTE-4.3g-TIENDA-INFO] Ficha del ítem antes de comprar
  qsa(".btn-info-item").forEach(b => b.addEventListener("click", () => {
    const item = tienda.items.find(i => i.id === b.dataset.id);
    if (item) abrirInfoItemTienda(item);
  }));
  qsa(".btn-borrar-item").forEach(b => b.addEventListener("click", async () => {
    tienda.items = tienda.items.filter(i => i.id !== b.dataset.id);
    await dbPut("tiendas", tienda);
    render();
  }));

  // [UNDAVAR-PARTE-9.4B-CARRITO] Barra fija, panel y botones «＋»
  qs("#select-comprador-carrito")?.addEventListener("change", e => {
    carrito.compradorId = e.target.value;
    carritoGuardar();
    carritoPintar();
  });
  qs("#btn-abrir-carrito")?.addEventListener("click", () => {
    carrito.abierto = !carrito.abierto;
    carritoGuardar();
    carritoPintar();
  });
  qs("#btn-cerrar-carrito")?.addEventListener("click", () => {
    carrito.abierto = false;
    carritoGuardar();
    carritoPintar();
  });
  qs("#carrito-moneda")?.addEventListener("change", e => {
    carrito.moneda = e.target.value;
    carritoGuardar();
    carritoPintar();
  });
  qsa(".btn-agregar-carrito").forEach(btn => btn.addEventListener("click", () => {
    const item = tienda.items.find(i => i.id === btn.dataset.id);
    if (item) carritoAgregar(item);
  }));
  qs("#carrito-panel")?.addEventListener("click", e => {
    const mas = e.target.closest("[data-carrito-mas]");
    if (mas) { carritoCambiar(mas.dataset.carritoMas, 1); return; }
    const menos = e.target.closest("[data-carrito-menos]");
    if (menos) { carritoCambiar(menos.dataset.carritoMenos, -1); return; }
    const quitar = e.target.closest("[data-carrito-quitar]");
    if (quitar) carritoQuitar(quitar.dataset.carritoQuitar);
  });
  qs("#btn-comprar-carrito")?.addEventListener("click", () => comprarCarrito(tienda));

  // [UNDAVAR-PARTE-9.4B-CARRITO] Compra directa de una fila con el comprador de la barra
  qsa(".btn-comprar").forEach(btn => btn.addEventListener("click", async () => {
    const compradorId = carrito.compradorId;
    if (!compradorId) { notificar("⚠️ Elige un comprador en la barra fija."); return; }

    const itemTienda = tienda.items.find(i => i.id === btn.dataset.id);
    if (!itemTienda || stockItemTienda(itemTienda) <= 0) { notificar("⚠️ Sin stock disponible."); return; }

    const comprador = await dbGet("personajes", compradorId);
    if (!comprador) { notificar("⚠️ Personaje no encontrado."); return; }

    const precioUnitarioOro = carritoPrecioOro(itemTienda);
    const maxStock = stockItemTienda(itemTienda);

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
            <button id="btn-confirmar-pago" class="btn-primario">Confirmar compra</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const inputCantidad = qs("#input-cantidad-compra");
    const lblPrecioTotal = qs("#lbl-precio-total");

    inputCantidad.addEventListener("input", () => {
      const cant = Math.max(1, Math.min(maxStock, Number(inputCantidad.value) || 1));
      inputCantidad.value = cant;
      lblPrecioTotal.textContent = `${precioUnitarioOro * cant} Oro`;
    });

    qs("#btn-cancelar-pago").addEventListener("click", () => document.querySelector(".modal-backdrop").remove());

    qs("#btn-confirmar-pago").addEventListener("click", async () => {
      const cantidadAComprar = Math.max(1, Math.min(maxStock, Number(inputCantidad.value) || 1));
      const monedaPago = qs("#select-moneda-pago").value;
      // [UNDAVAR-PARTE-9.4B-CARRITO] Reutiliza la misma lógica que el carrito
      const res = await aplicarCompraTienda(tienda, comprador, itemTienda, cantidadAComprar, monedaPago);
      if (!res.ok) { notificar(`❌ ${res.mensaje}`); return; }

      document.querySelector(".modal-backdrop").remove();
      notificar(`✨ Compra de ${cantidadAComprar}x ${itemTienda.name} completada. Cambio: ${res.cambio} Oro.`);
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
            <button id="btn-confirmar-inyect" class="btn-primario">Inyectar dinero</button>
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

  // [UNDAVAR-PARTE-4.3a] Vendedor y botones de venta
  qs("#select-vendedor")?.addEventListener("change", e => {
    state.ventaVendedorId = e.target.value || null;
    render();
  });
  qsa(".btn-vender", app).forEach(b => b.addEventListener("click", () => {
    venderItemTienda(tienda, vendedor, b.dataset.id);
  }));

  // [UNDAVAR-PARTE-4.3b] Transferir Erianas entre PJ y la caja de la tienda
  qs("#btn-transferir-erianas")?.addEventListener("click", () => {
    abrirModalTransferirErianas(tienda, personajes);
  });

  // [UNDAVAR-PARTE-4.3d] Cargar Mercado y transferir entre tiendas
  qs("#btn-cargar-catalogo")?.addEventListener("click", () => abrirModalCargarCatalogo(tienda));
  qs("#btn-transferir-tienda")?.addEventListener("click", () => {
    abrirModalTransferirTienda(tienda, tiendas);
  });

  // [UNDAVAR-PARTE-9.5D-BUSCADOR] Filtra el stock por nombre
  const buscador = qs("#buscar-tienda");
  const aplicarBusqueda = () => {
    const q = mapaNormalizarTexto(buscador?.value || "").trim();
    qsa(".tienda-seccion").forEach(sec => {
      const lista = sec.querySelector(".tienda-lista");
      if (!lista) return;
      const filas = [...lista.querySelectorAll(".tienda-item")];
      lista.querySelector(".tienda-sin-resultados")?.remove();
      let visibles = 0;
      filas.forEach(f => {
        const coincide = !q || String(f.dataset.nombre || "").includes(q);
        f.hidden = !coincide;
        if (coincide) visibles++;
      });
      if (filas.length && !visibles) {
        lista.insertAdjacentHTML("beforeend", `<p class="vacio tienda-sin-resultados">Sin resultados.</p>`);
      }
      sec.hidden = !!q && filas.length > 0 && visibles === 0;
    });
  };
  buscador?.addEventListener("input", aplicarBusqueda);

  // [UNDAVAR-PARTE-9.4B-CARRITO] Pinta el estado guardado del carrito
  carritoPintar();
}

function abrirModalCatalogo(tienda, tipo) {
  // [UNDAVAR-PARTE-9.5C-MATERIALES] Los materiales tienen categoría propia en el desplegable
  // [UNDAVAR-PARTE-10.4-ARMAS] El catálogo también separa las dos clases de arma
  const TIPOS_CATALOGO = [
    ["objeto", "Objetos"],
    ["material", "Materiales"],
    ["arma_comun", "Armas comunes"],
    ["arma_gladiador", "Armas de gladiador"],
    ["elixir", "Elixires"],
    ["alimento", "Alimentos"]
  ];
  const esMaterial = i => !!i.system?.material;
  const itemsDe = t => CATALOGO_ITEMS.filter(i => {
    if (t === "material") return esMaterial(i);
    if (t === "arma_comun") return i.type === "arma" && esArmaComun(i);
    if (t === "arma_gladiador") return i.type === "arma" && !esArmaComun(i);
    return i.type === t && !esMaterial(i);
  });
  const nombreTipo = t => (TIPOS_CATALOGO.find(([id]) => id === t) || [, t])[1];
  let disponibles = [];

  const html = `
    <div class="modal-backdrop">
      <div class="modal-contenido">
        <h3 id="modal-catalogo-titulo">Añadir desde Catálogo</h3>
        <label>Categoría:</label>
        <select id="select-tipo-catalogo">
          ${TIPOS_CATALOGO.map(([id, l]) => `<option value="${id}" ${id === tipo ? "selected" : ""}>${l}</option>`).join("")}
        </select>
        <select id="select-item-catalogo"></select>
        <label>Cantidad en Stock:</label>
        <input type="number" id="cant-item-catalogo" value="10" min="1">
        <button id="btn-confirmar-add">Añadir a Tienda</button>
        <button id="btn-cerrar-modal">Cancelar</button>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", html);

  const precioTxt = i => {
    const s = i.system || {};
    if (Number(s.precio_diamante) > 0) return `${s.precio_diamante} Diamante`;
    if (Number(s.precio_rubi) > 0) return `${s.precio_rubi} Rubí`;
    return `${Number(s.precio_oro) || 0} Oro`;
  };
  const pintarItems = () => {
    const t = qs("#select-tipo-catalogo").value;
    disponibles = itemsDe(t);
    qs("#modal-catalogo-titulo").textContent = `Añadir ${nombreTipo(t).toLowerCase()} desde catálogo`;
    qs("#select-item-catalogo").innerHTML = disponibles.length
      ? disponibles.map((i, idx) => `<option value="${idx}">${i.name} (${precioTxt(i)})</option>`).join("")
      : `<option value="">Sin ítems en esta categoría</option>`;
  };
  pintarItems();
  qs("#select-tipo-catalogo").addEventListener("change", pintarItems);

  qs("#btn-confirmar-add").addEventListener("click", async () => {
    const idx = qs("#select-item-catalogo").value;
    const cant = Number(qs("#cant-item-catalogo").value) || 1;
    const itemBase = disponibles[idx];
    if (!itemBase) return;

    const nuevo = JSON.parse(JSON.stringify(itemBase));
    nuevo.id = nuevoId();
    nuevo.system.cantidad = cant;

    tienda.items.push(nuevo);
    await dbPut("tiendas", tienda);
    document.querySelector(".modal-backdrop").remove();
    render();
  });

  qs("#btn-cerrar-modal").addEventListener("click", () => document.querySelector(".modal-backdrop").remove());
}

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
      <div class="header-tiradas"><button class="btn-secundario chico" id="btn-exportar-actor"><span data-icono="exportar"></span> Exportar</button></div>
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
            <button class="btn-peligro chico btn-icono btn-borrar-fila-oraculo" data-idx="${idx}" title="Eliminar fila" aria-label="Eliminar fila"><span data-icono="borrar"></span></button>
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
  qs("#btn-exportar-actor").addEventListener("click", () => exportarPerfil("oraculos", oraculo.id).catch(e => notificar("Error al exportar: " + (e.message || e))));
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
    const ok = await confirmarAccion("Borrar historial", "¿Borrar todo el historial?", "Borrar");
    if (!ok) return;
    oraculo.historial = [];
    await dbPut("oraculos", oraculo);
    render();
  });
}

// ------------------------------------------------------------
// VISTA: METAS  [UNDAVAR-PARTE-9.1-METAS]
// ------------------------------------------------------------
const META_TIPOS = { personal: "Personal", general: "General" };
const META_ESTADOS = { pendiente: "Pendiente", cumplida: "Cumplida", fallida: "Fallida" };
const META_ORDEN = { pendiente: 0, cumplida: 1, fallida: 2 };

// Formulario de creación y edición de una meta
function abrirFormularioMeta(meta, personajes) {
  const m = meta || { nombre: "", tipo: "general", personajeId: "", estado: "pendiente", publica: true, notas: "" };
  const fondo = crearModal(meta ? "Editar meta" : "Nueva meta", `
    <div class="campo-fila">
      <label for="meta-nombre">Título</label>
      <input id="meta-nombre" type="text" maxlength="120" value="${esc(m.nombre)}" placeholder="Ej.: Recuperar el Sello de Sedra">
    </div>
    <div class="campo-fila">
      <label for="meta-tipo">Tipo</label>
      <select id="meta-tipo">
        <option value="personal"${m.tipo === "personal" ? " selected" : ""}>Personal (del jugador)</option>
        <option value="general"${m.tipo === "general" ? " selected" : ""}>General (impuesta por el SR)</option>
      </select>
      <div class="campo-ayuda" id="meta-tipo-ayuda"></div>
    </div>
    <div class="campo-fila">
      <label for="meta-personaje">Personaje vinculado</label>
      <select id="meta-personaje">
        <option value="">Sin personaje</option>
        ${personajes.map(p => `<option value="${p.id}"${p.id === m.personajeId ? " selected" : ""}>${esc(p.nombre || "Sin nombre")}</option>`).join("")}
      </select>
    </div>
    <div class="campo-fila">
      <label for="meta-estado">Estado</label>
      <select id="meta-estado">
        <option value="pendiente"${m.estado === "pendiente" ? " selected" : ""}>Pendiente</option>
        <option value="cumplida"${m.estado === "cumplida" ? " selected" : ""}>Cumplida</option>
        <option value="fallida"${m.estado === "fallida" ? " selected" : ""}>Fallida</option>
      </select>
    </div>
    <label class="campo-check">
      <input type="checkbox" id="meta-publica"${m.publica ? " checked" : ""}>
      Pública: el grupo y el SR pueden verla
    </label>
    <div class="campo-fila" style="margin-top:12px;">
      <label for="meta-notas">Notas</label>
      <textarea id="meta-notas" rows="4" placeholder="Pistas, condiciones o recompensas">${esc(m.notas)}</textarea>
    </div>
    <div class="modal-acciones">
      <button class="btn-secundario" data-meta-cancelar>Cancelar</button>
      <button class="btn-primario" id="meta-guardar">Guardar</button>
    </div>
  `);

  qs("[data-meta-cancelar]", fondo).addEventListener("click", () => fondo.remove());

  // [UNDAVAR-PARTE-9.1B-METAS] Sin personaje la meta es general; con personaje se propone personal
  const selPersonaje = qs("#meta-personaje", fondo);
  const selTipo = qs("#meta-tipo", fondo);
  const ayudaTipo = qs("#meta-tipo-ayuda", fondo);
  const ajustarTipoMeta = () => {
    const sinPersonaje = !selPersonaje.value;
    if (sinPersonaje) selTipo.value = "general";
    else if (selTipo.disabled) selTipo.value = "personal";
    selTipo.disabled = sinPersonaje;
    ayudaTipo.textContent = sinPersonaje
      ? "Sin personaje, la meta se guarda como general."
      : "Personal es del personaje; general es un objetivo del grupo.";
  };
  selPersonaje.addEventListener("change", ajustarTipoMeta);
  ajustarTipoMeta();

  qs("#meta-guardar", fondo).addEventListener("click", async () => {
    const nombre = qs("#meta-nombre", fondo).value.trim();
    if (!nombre) {
      notificar("La meta necesita un título.");
      qs("#meta-nombre", fondo).focus();
      return;
    }
    const estado = qs("#meta-estado", fondo).value;
    const personajeId = qs("#meta-personaje", fondo).value || "";
    const datos = {
      ...m,
      id: m.id || nuevoId(),
      nombre,
      // [UNDAVAR-PARTE-9.1B-METAS] Se refuerza la regla al guardar
      tipo: personajeId ? qs("#meta-tipo", fondo).value : "general",
      personajeId,
      estado,
      publica: qs("#meta-publica", fondo).checked,
      notas: qs("#meta-notas", fondo).value.trim(),
      createdAt: m.createdAt || Date.now(),
    };
    if (estado === "cumplida") datos.cumplidaAt = m.cumplidaAt || Date.now();
    else delete datos.cumplidaAt;
    await dbPut("metas", datos);
    fondo.remove();
    render();
  });
  qs("#meta-nombre", fondo).focus();
}

async function renderMetas() {
  const [metasRaw, personajesRaw] = await Promise.all([dbGetAll("metas"), dbGetAll("personajes")]);
  const personajes = soloPersonajesReales(personajesRaw);
  const nombrePersonaje = (id) => personajes.find(p => p.id === id)?.nombre || "";

  const filtro = state.metasFiltro || "todas";
  const tipo = state.metasTipo || "todos";
  const busqueda = (state.metasBusqueda || "").trim().toLowerCase();

  const visibles = metasRaw.filter(m => {
    if (filtro !== "todas" && m.estado !== filtro) return false;
    if (tipo !== "todos" && m.tipo !== tipo) return false;
    if (busqueda) {
      const texto = `${m.nombre || ""} ${m.notas || ""} ${nombrePersonaje(m.personajeId)}`.toLowerCase();
      if (!texto.includes(busqueda)) return false;
    }
    return true;
  }).sort((a, b) => {
    const orden = (META_ORDEN[a.estado] ?? 0) - (META_ORDEN[b.estado] ?? 0);
    return orden || (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  const pendientes = metasRaw.filter(m => m.estado === "pendiente").length;
  const cumplidas = metasRaw.filter(m => m.estado === "cumplida").length;

  const tarjetaMeta = (m) => {
    const personaje = nombrePersonaje(m.personajeId);
    const cumplida = m.estado === "cumplida";
    const sub = personaje
      ? `Personaje: <b>${esc(personaje)}</b>`
      : (m.tipo === "general" ? "Objetivo del grupo" : "Sin personaje asignado");
    const fecha = m.estado === "cumplida" && m.cumplidaAt
      ? ` · Cumplida el ${new Date(m.cumplidaAt).toLocaleDateString()}`
      : "";
    return `
    <article class="meta-card meta-${m.estado}" data-id="${m.id}">
      <div class="meta-ico" aria-hidden="true"><span data-icono="${cumplida ? "check" : "metas"}"></span></div>
      <div class="meta-cuerpo">
        <div class="meta-titulo-fila">
          <h3>${esc(m.nombre || "Sin título")}</h3>
          <span class="meta-badge meta-tipo-${m.tipo || "personal"}">${META_TIPOS[m.tipo] || "Personal"}</span>
          <span class="meta-badge ${m.publica ? "meta-publica" : "meta-privada"}">${m.publica ? "Pública" : "Privada"}</span>
          <span class="meta-badge meta-estado-${m.estado || "pendiente"}">${META_ESTADOS[m.estado] || "Pendiente"}</span>
        </div>
        <div class="meta-sub">${sub}${fecha}</div>
        ${m.notas ? `<p class="meta-notas">${esc(m.notas).replace(/\n/g, "<br>")}</p>` : ""}
      </div>
      <div class="meta-acciones">
        <button class="btn-secundario chico btn-icono btn-meta-estado" data-id="${m.id}" title="${cumplida ? "Reabrir meta" : "Marcar cumplida"}" aria-label="${cumplida ? "Reabrir" : "Marcar cumplida"}: ${esc(m.nombre || "")}"><span data-icono="${cumplida ? "reabrir" : "check"}"></span></button>
        <button class="btn-secundario chico btn-icono btn-meta-editar" data-id="${m.id}" title="Editar" aria-label="Editar: ${esc(m.nombre || "")}"><span data-icono="editar"></span></button>
        <button class="btn-peligro chico btn-icono btn-meta-borrar" data-id="${m.id}" title="Eliminar" aria-label="Eliminar: ${esc(m.nombre || "")}"><span data-icono="borrar"></span></button>
      </div>
    </article>`;
  };

  const chip = (valor, actual, grupo, etiqueta, total) => `
    <button class="meta-chip${valor === actual ? " activo" : ""}" data-meta-${grupo}="${valor}" aria-pressed="${valor === actual}">${etiqueta}${total != null ? ` (${total})` : ""}</button>`;

  app.innerHTML = `
  <section class="vista-ficha metas-vista">
    <header class="sheet-header">
      <div class="header-izquierda">
        <h2>Metas de campaña</h2>
        <p class="nota">Las metas se comparten con el grupo para que el SR ajuste la dificultad. Puedes vincular una meta personal a un personaje.</p>
      </div>
      <div class="header-tiradas">
        <button class="btn-primario" id="btn-nueva-meta"><span data-icono="mas"></span> Nueva meta</button>
      </div>
    </header>

    <div class="metas-resumen" aria-label="Resumen de metas">
      <span><b>${pendientes}</b> pendientes</span>
      <span><b>${cumplidas}</b> cumplidas</span>
      <span><b>${metasRaw.length}</b> en total</span>
    </div>

    <div class="metas-barra">
      <div class="metas-filtros" role="group" aria-label="Filtrar por estado">
        ${chip("todas", filtro, "filtro", "Todas", metasRaw.length)}
        ${chip("pendiente", filtro, "filtro", "Pendientes", pendientes)}
        ${chip("cumplida", filtro, "filtro", "Cumplidas", cumplidas)}
        ${chip("fallida", filtro, "filtro", "Fallidas", metasRaw.filter(m => m.estado === "fallida").length)}
      </div>
      <div class="metas-filtros" role="group" aria-label="Filtrar por tipo">
        ${chip("todos", tipo, "tipo", "Todos los tipos")}
        ${chip("personal", tipo, "tipo", "Personales")}
        ${chip("general", tipo, "tipo", "Generales")}
      </div>
      <label class="metas-buscador">
        <span data-icono="buscar"></span>
        <input id="meta-buscar" type="search" placeholder="Buscar meta, nota o personaje" value="${esc(state.metasBusqueda || "")}" aria-label="Buscar metas">
      </label>
    </div>

    <div class="metas-lista">
      ${visibles.length
        ? visibles.map(tarjetaMeta).join("")
        : `<div class="estado-vacio">
             <span class="estado-vacio-icono" data-icono="metas"></span>
             <div class="estado-vacio-titulo">${metasRaw.length ? "Ninguna meta coincide" : "Todavía no hay metas"}</div>
             <p class="estado-vacio-texto">${metasRaw.length ? "Prueba con otro filtro o con otra búsqueda." : "Apunta los objetivos personales y los que impone el Sabio Regidor."}</p>
             ${metasRaw.length ? "" : '<button class="btn-primario" id="btn-primera-meta"><span data-icono="mas"></span> Crear la primera meta</button>'}
           </div>`}
    </div>
  </section>`;

  const abrirNueva = () => abrirFormularioMeta(null, personajes);
  qs("#btn-nueva-meta").addEventListener("click", abrirNueva);
  const btnPrimera = qs("#btn-primera-meta");
  if (btnPrimera) btnPrimera.addEventListener("click", abrirNueva);

  qsa("[data-meta-filtro]").forEach(b => b.addEventListener("click", () => {
    state.metasFiltro = b.dataset.metaFiltro;
    render();
  }));
  qsa("[data-meta-tipo]").forEach(b => b.addEventListener("click", () => {
    state.metasTipo = b.dataset.metaTipo;
    render();
  }));

  const buscador = qs("#meta-buscar");
  buscador.addEventListener("input", () => {
    state.metasBusqueda = buscador.value;
    render().then(() => {
      const nuevo = qs("#meta-buscar");
      if (!nuevo) return;
      nuevo.focus();
      nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
    });
  });

  qsa(".btn-meta-editar").forEach(b => b.addEventListener("click", () => {
    const meta = metasRaw.find(m => m.id === b.dataset.id);
    if (meta) abrirFormularioMeta(meta, personajes);
  }));

  qsa(".btn-meta-estado").forEach(b => b.addEventListener("click", async () => {
    const meta = metasRaw.find(m => m.id === b.dataset.id);
    if (!meta) return;
    meta.estado = meta.estado === "cumplida" ? "pendiente" : "cumplida";
    if (meta.estado === "cumplida") meta.cumplidaAt = Date.now();
    else delete meta.cumplidaAt;
    await dbPut("metas", meta);
    render();
  }));

  qsa(".btn-meta-borrar").forEach(b => b.addEventListener("click", async () => {
    const meta = metasRaw.find(m => m.id === b.dataset.id);
    if (!meta) return;
    const ok = await confirmarAccion("Eliminar meta", `¿Eliminar «${meta.nombre}»?`, "Eliminar");
    if (!ok) return;
    await dbDelete("metas", meta.id);
    render();
  }));
}

// ------------------------------------------------------------
// Navegación global + arranque
// ------------------------------------------------------------
qsa(".navlink").forEach(a => a.addEventListener("click", (e) => {
  e.preventDefault();
  ir(a.dataset.vista);
}));

// [UNDAVAR-PARTE-3.4C] Rail expandible con memoria en localStorage
(() => {
  const raiz = document.documentElement;
  const btn = document.getElementById("btn-rail-toggle");
  if (!btn) return;

  const aplicarRail = (expandido) => {
    raiz.classList.toggle("rail-expandido", expandido);
    btn.setAttribute("aria-expanded", String(expandido));
    const etiqueta = expandido ? "Contraer menú" : "Expandir menú";
    btn.setAttribute("aria-label", etiqueta);
    btn.title = etiqueta;
  };

  aplicarRail(raiz.classList.contains("rail-expandido"));

  btn.addEventListener("click", () => {
    const expandido = !raiz.classList.contains("rail-expandido");
    aplicarRail(expandido);
    try { localStorage.setItem("undavar_rail_expandido", expandido ? "1" : "0"); } catch (e) { }
  });
})();

// ------------------------------------------------------------
// VISTA: DADOS LIBRES
// ------------------------------------------------------------
// [UNDAVAR-PARTE-9.3B-DADOS] Memoria de los controles de tiradas rápidas
const DADOS_ESTADO_CLAVE = "undavar_dados_estado";

function leerEstadoDados() {
  try {
    const crudo = localStorage.getItem(DADOS_ESTADO_CLAVE);
    return crudo ? JSON.parse(crudo) : {};
  } catch (e) {
    return {};
  }
}

function guardarEstadoDados(cambios = {}) {
  if (window.self !== window.top) return;
  try {
    const actual = leerEstadoDados();
    localStorage.setItem(DADOS_ESTADO_CLAVE, JSON.stringify({ ...actual, ...cambios }));
  } catch (e) { }
}

async function renderDados() {
  // [UNDAVAR-PARTE-9.3B-DADOS] Recupera los controles y el último resultado
  const guardado = leerEstadoDados();
  const nivelGuardado = String(guardado.nivel ?? "0");
  const rangoGuardado = guardado.rango || "Astrei";
  const atrGuardado = guardado.atr ?? "3";
  const cantGuardada = guardado.dados ?? "2";
  const modGuardado = guardado.mod ?? "0";
  const ultimoHtml = guardado.ultimo || "";

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
    <div class="dados-grid-libre">
      
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
        ${[0, 1, 2, 3, 4].map(n => `<option value="${n}" ${nivelGuardado === String(n) ? "selected" : ""}>Nv. ${n}</option>`).join("")}
      </select>

      <label style="color:#ccc; font-size:0.85em;">Rango (Nv.0):</label>
      <select id="select-rango-dados-libres" style="flex:1; padding:6px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px;">
        <option value="Astrei" ${rangoGuardado === "Astrei" ? "selected" : ""}>Astrei / Breintin (2d6)</option>
        <option value="Sedrein" ${rangoGuardado === "Sedrein" ? "selected" : ""}>Sedrein / Wonrixay (3d6)</option>
        <option value="Lait Betsu" ${rangoGuardado === "Lait Betsu" ? "selected" : ""}>Lait Betsu+ (4d6)</option>
      </select>

      <label style="color:#ccc; font-size:0.85em;">Atr:</label>
      <input type="number" id="input-atr-arte" value="${esc(atrGuardado)}" min="0" max="9" style="width:45px; padding:6px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px; text-align:center;">
    </div>
    <button class="btn-secundario" id="btn-lanzar-arte" style="width:100%;">Lanzar daño</button>
  </div>

        <hr style="width:100%; border:0; border-top:1px solid #333; margin:0;">

        <!-- Tirada Libre d6 -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <span style="color:#d4af37; font-weight:bold; font-size:0.85em; text-transform:uppercase; letter-spacing:0.5px;">🎲 Tirada Libre</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <label style="color:#ccc; font-size:0.85em;">Dados:</label>
            <input type="number" id="input-cant-dados" value="${esc(cantGuardada)}" min="1" max="30" style="width:60px; padding:6px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px; text-align:center;">
            <span style="color:#ccc; font-weight:bold;">d6</span>
            <label style="color:#ccc; font-size:0.85em; margin-left: auto;">Mod:</label>
            <input type="number" id="input-mod-dado" value="${esc(modGuardado)}" style="width:55px; padding:6px; background:#121215; border:1px solid #444; color:#fff; border-radius:4px; text-align:center;">
          </div>
          <button class="btn-primario" id="btn-lanzar-custom" style="width:100%;">🎲 Tirar Dados</button>
        </div>

      </div>

      <!-- COLUMNA DERECHA: Pantalla Grande de Resultado -->
      <div id="dados-resultado-main" style="min-height: 380px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(212,175,55,0.2); padding: 30px; text-align: center;">
        ${ultimoHtml || `<p class="vacio" style="font-size: 1.1em; color: #888;">Selecciona una tirada del panel izquierdo para ver el resultado aquí.</p>`}
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

  // [UNDAVAR-PARTE-9.3B-DADOS] Guarda los controles al cambiarlos
  qs("#select-nivel-arte")?.addEventListener("change", e => guardarEstadoDados({ nivel: e.target.value }));
  qs("#select-rango-dados-libres")?.addEventListener("change", e => guardarEstadoDados({ rango: e.target.value }));
  qs("#input-atr-arte")?.addEventListener("change", e => guardarEstadoDados({ atr: e.target.value }));
  qs("#input-cant-dados")?.addEventListener("change", e => guardarEstadoDados({ dados: e.target.value }));
  qs("#input-mod-dado")?.addEventListener("change", e => guardarEstadoDados({ mod: e.target.value }));

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
    // [UNDAVAR-PARTE-9.3B-DADOS] Guarda el último resultado para la recarga
    guardarEstadoDados({ ultimo: resHtml });

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

  qs("#btn-limpiar-historial-dados").addEventListener("click", async () => {
    const ok = await confirmarAccion("Borrar historial", "¿Borrar todo el historial de tiradas libres?", "Borrar");
    if (ok) {
      state.historialDadosLibres = [];
      localStorage.removeItem("undavar_historial_dados");
      render();
    }
  });
}

// ============================================================
// ARRANQUE Y PRECARGA DE BASE DE DATOS
// ============================================================

// [UNDAVAR-PARTE-9.5B-MATERIALES] Quita de las tiendas los tipos genéricos de construcción
async function limpiarMaterialesGenericosTiendas() {
  const patron = /^Elementos de construcci[oó]n \(Tipo [1-5]\)$/i;
  const tiendas = await dbGetAll("tiendas");
  for (const t of tiendas) {
    if (!Array.isArray(t.items)) continue;
    const antes = t.items.length;
    t.items = t.items.filter(i => !patron.test(String(i.name || "").trim()));
    if (t.items.length !== antes) await dbPut("tiendas", t);
  }
}

async function precargarBaseDeDatos() {
  for (const t of TIENDAS_INICIALES) {
    const existe = await dbGet("tiendas", t.id);

    if (!existe) {
      t.items.forEach(i => {
        if (!i.id) i.id = nuevoId();
      });

      await dbPut("tiendas", t);
      console.log(`Tienda "${t.nombre}" precargada con éxito.`);
    }
  }
  // [UNDAVAR-PARTE-9.5B-MATERIALES] Limpia datos antiguos que traían los tipos como objetos
  await limpiarMaterialesGenericosTiendas();
  // [UNDAVAR-PARTE-4.2h4j-TIENDAS] El Sello de Sedra no se vende: se carga a mano en la ficha
  await quitarSelloDeSedraDeTiendas();
  // [UNDAVAR-PARTE-4.2h4k-RESTABLECEDOR] Pero el Restablecedor sí lo repone
  await asegurarSelloEnRestablecedor();
  // [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] Pasa la variación genérica a cada habilidad
  await migrarVariacionesNivelHabilidad();
  // [UNDAVAR-PARTE-4.2h1c-SELLO-NIVEL] Corrige una sola vez el nivel y el enfriamiento
  await migrarSelloNivelCero();
  // [UNDAVAR-PARTE-4.2h1d-REGISTRO] El primer sello pasa a modo daño
  await migrarSelloDanoAcumulativo();
  // [UNDAVAR-PARTE-4.2h1e-BONO] Garantiza el bono +1 del primer sello
  await asegurarBonoSello1();
  // [UNDAVAR-PARTE-4.2h1f-ACUMULATIVO] Marca el bono del Sello 1 como acumulativo
  await migrarSelloAcumulativo();
  // [UNDAVAR-PARTE-4.2h2-PAREJA] Separa el ítem viejo en Maydo y Tsuida
  await migrarMaydoTsuida();
  // [UNDAVAR-PARTE-4.2h3-PAREJA] Pasa las habilidades viejas al modelo configurable
  await migrarHermanasConfig();
  // [UNDAVAR-PARTE-10.4-ARMAS] Marca qué armas son objetos y cuáles de gladiador
  await migrarArmasComunGladiador();
  // [UNDAVAR-PARTE-10.5-NIVELES] Rango de niveles y niveles del Elixir de potenciación
  await migrarNivelesObjeto();
  // [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Cartera de Erianas en los PNJ existentes
  await migrarErianasPNJ();
}

// [UNDAVAR-PARTE-10.5-NIVELES] Normaliza los campos de nivel de un ítem de objeto
function normalizarNivelesObjetoItem(it) {
  if (!it || typeof it !== "object") return false;
  if (!["objeto", "elixir", "alimento", "arma", "equipo"].includes(it.type)) return false;
  // [UNDAVAR-PARTE-10.5-NIVELES] Las armas de gladiador no usan niveles de objeto
  if (it.type === "arma" && !esArmaComun(it)) return false;

  it.system = it.system || {};
  const s = it.system;
  let cambio = false;

  // [UNDAVAR-PARTE-10.5-NIVELES] Convierte el texto viejo «1-2» o «2» en rango
  if (s.nivelMin === undefined && s.nivelMax === undefined && s.nivel !== undefined) {
    const nums = (String(s.nivel).match(/\d+/g) || [])
      .map(n => parseInt(n, 10))
      .filter(n => Number.isFinite(n) && n > 0);
    if (nums.length) {
      const a = nums[0];
      const b = nums[nums.length - 1];
      s.nivelMin = Math.min(a, b);
      s.nivelMax = Math.max(a, b);
      cambio = true;
    }
  }

  // [UNDAVAR-PARTE-10.5-NIVELES] Siembra los dos niveles del Elixir de potenciación
  if (it.name === "Elixir de potenciación") {
    if (s.nivelMin === undefined) { s.nivelMin = 1; cambio = true; }
    if (s.nivelMax === undefined) { s.nivelMax = 2; cambio = true; }
    if (s.nivelAleatorio === undefined) { s.nivelAleatorio = true; cambio = true; }
    if (s.nivelVenta === undefined) { s.nivelVenta = 1; cambio = true; }
    if (!Array.isArray(s.variacionesNivel) || !s.variacionesNivel.length) {
      s.variacionesNivel = JSON.parse(JSON.stringify(NIVELES_POTENCIACION));
      cambio = true;
    }
  }

  // [UNDAVAR-PARTE-10.5-NIVELES] Valores por defecto de los ítems que ya tienen rango
  const tieneRango = (Number(s.nivelMin) || 0) > 0 || (Number(s.nivelMax) || 0) > 0;
  if (tieneRango) {
    if (s.nivelActual === undefined || !(Number(s.nivelActual) > 0)) {
      s.nivelActual = Number(s.nivelMin) || 1;
      cambio = true;
    }
    if (s.nivelVenta === undefined || !(Number(s.nivelVenta) > 0)) {
      s.nivelVenta = Number(s.nivelMin) || 1;
      cambio = true;
    }
    if (s.nivelAleatorio === undefined) { s.nivelAleatorio = false; cambio = true; }
    if (s.nivelOculto === undefined) { s.nivelOculto = false; cambio = true; }
  }

  if (s.variacionesNivel === undefined) { s.variacionesNivel = []; cambio = true; }
  return cambio;
}

// [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Migración única de la cartera de los PNJ
async function migrarErianasPNJ() {
  const CLAVE = "undavar_erianas_npc_v1";
  if (localStorage.getItem(CLAVE)) return;

  for (const n of await dbGetAll("npcs")) {
    n.system = n.system || {};
    if (!n.system.erianas || typeof n.system.erianas !== "object") {
      n.system.erianas = { oro: 0, rubi: 0, diamante: 0 };
      await dbPut("npcs", n);
    }
  }

  localStorage.setItem(CLAVE, "1");
}

// [UNDAVAR-PARTE-10.5-NIVELES] Migración única de niveles de objeto
async function migrarNivelesObjeto() {
  const CLAVE = "undavar_niveles_objeto_v1";
  if (localStorage.getItem(CLAVE)) return;

  for (const [store, lista] of [
    ["personajes", await dbGetAll("personajes")],
    ["npcs", await dbGetAll("npcs")],
    ["tiendas", await dbGetAll("tiendas")]
  ]) {
    for (const obj of lista) {
      let cambio = false;
      (obj.items || []).forEach(it => { if (normalizarNivelesObjetoItem(it)) cambio = true; });
      if (cambio) await dbPut(store, obj);
    }
  }

  localStorage.setItem(CLAVE, "1");
}

// [UNDAVAR-PARTE-10.4-ARMAS] Marca una sola vez el tipo de cada arma existente
async function migrarArmasComunGladiador() {
  const CLAVE = "undavar_armas_comun_v1";
  if (localStorage.getItem(CLAVE)) return;

  const marcar = (obj) => {
    let cambio = false;
    (obj.items || []).forEach(it => {
      if (it.type !== "arma") return;
      it.system = it.system || {};
      const comun = esArmaComun(it);
      if (it.system.armaComun !== comun) {
        it.system.armaComun = comun;
        cambio = true;
      }
    });
    return cambio;
  };

  for (const [store, lista] of [
    ["personajes", await dbGetAll("personajes")],
    ["npcs", await dbGetAll("npcs")],
    ["tiendas", await dbGetAll("tiendas")]
  ]) {
    for (const obj of lista) {
      if (marcar(obj)) await dbPut(store, obj);
    }
  }

  localStorage.setItem(CLAVE, "1");
}

// [UNDAVAR-PARTE-4.2h2-PAREJA] Convierte «Hermanas Maydo y Tsuida» en dos armas
async function migrarMaydoTsuida() {
  const CLAVE = "undavar_maydo_tsuida_v1";
  if (localStorage.getItem(CLAVE)) return;

  const convertir = (obj) => {
    const items = obj.items;
    if (!Array.isArray(items)) return false;
    const idx = items.findIndex(i => i.name === "Hermanas Maydo y Tsuida");
    if (idx < 0) return false;
    const viejo = items[idx];
    const cant = Math.max(1, Number(viejo.system?.cantidad) || 1);
    items.splice(idx, 1, itemDesdeCatalogo("Maydo", cant), itemDesdeCatalogo("Tsuida", cant));
    return true;
  };

  for (const [store, lista] of [
    ["personajes", await dbGetAll("personajes")],
    ["npcs", await dbGetAll("npcs")],
    ["tiendas", await dbGetAll("tiendas")]
  ]) {
    for (const obj of lista) {
      let cambio = convertir(obj);
      // El Restablecedor reparte todo gratis: las hermanas no deben estar ahí
      if (store === "tiendas" && obj.id === "restablecedor") {
        const antes = (obj.items || []).length;
        obj.items = (obj.items || []).filter(i => !["Maydo", "Tsuida", "Hermanas Maydo y Tsuida"].includes(i.name));
        if (obj.items.length !== antes) cambio = true;
      }
      if (cambio) await dbPut(store, obj);
    }
  }

  localStorage.setItem(CLAVE, "1");
}

// [UNDAVAR-PARTE-4.2h3-PAREJA] Reescribe las habilidades viejas de Maydo y Tsuida
async function migrarHermanasConfig() {
  const CLAVE = "undavar_hermanas_config_v1";
  if (localStorage.getItem(CLAVE)) return;

  const reescribir = (obj) => {
    let cambio = false;
    (obj.items || []).forEach(it => {
      if (it.name !== "Maydo" && it.name !== "Tsuida") return;
      const habs = Array.isArray(it.system?.habilidades) ? it.system.habilidades : [];
      // Solo toca las que aún usan el modelo viejo o no tienen el viento pasivo
      const viejo = habs.some(h => h.requisito?.pareja) || !habs.some(h => h.modoUso === "pasivo");
      if (!viejo) return;
      const companera = it.name === "Maydo" ? "Tsuida" : "Maydo";
      it.system = it.system || {};
      it.system.habilidades = habilidadesHermana(companera);
      delete it.system.grupoPareja;
      cambio = true;
    });
    return cambio;
  };

  for (const [store, lista] of [
    ["personajes", await dbGetAll("personajes")],
    ["npcs", await dbGetAll("npcs")],
    ["tiendas", await dbGetAll("tiendas")]
  ]) {
    for (const obj of lista) {
      if (reescribir(obj)) await dbPut(store, obj);
    }
  }

  localStorage.setItem(CLAVE, "1");
}

// [UNDAVAR-PARTE-4.2h1f-ACUMULATIVO] El bono del Sello 1 debe acumular en cada uso
async function migrarSelloAcumulativo() {
  const CLAVE = "undavar_sello1_acumulativo_v1";
  if (localStorage.getItem(CLAVE)) return;

  const ajustar = (obj) => {
    let cambio = false;
    (obj.items || []).forEach(it => {
      if (it.name !== "Sello de Sedra") return;
      const habs = it.system?.habilidades;
      if (!Array.isArray(habs)) return;
      const h1 = habs.find(h => h.id === "sedra-1") || habs[0];
      if (!h1 || !Array.isArray(h1.bonos)) return;
      h1.bonos.forEach(b => {
        if (!b.acumulativo) { b.acumulativo = true; cambio = true; }
      });
    });
    return cambio;
  };

  for (const [store, lista] of [
    ["personajes", await dbGetAll("personajes")],
    ["npcs", await dbGetAll("npcs")],
    ["tiendas", await dbGetAll("tiendas")]
  ]) {
    for (const obj of lista) {
      if (ajustar(obj)) await dbPut(store, obj);
    }
  }

  localStorage.setItem(CLAVE, "1");
}

// [UNDAVAR-PARTE-4.2h1e-BONO] Repara el bono +1 del primer sello si faltara
async function asegurarBonoSello1() {
  const CLAVE = "undavar_sello1_bono_v1";
  if (localStorage.getItem(CLAVE)) return;

  const ajustar = (obj) => {
    let cambio = false;
    (obj.items || []).forEach(it => {
      if (it.name !== "Sello de Sedra") return;
      const habs = it.system?.habilidades;
      if (!Array.isArray(habs)) return;
      const h1 = habs.find(h => h.id === "sedra-1") || habs[0];
      if (!h1) return;
      if (!Array.isArray(h1.bonos) || !h1.bonos.length) {
        h1.bonos = [{ estadistica: "dano", valor: 1, modo: "fijo", turnos: 3, acumulativo: true }];
        cambio = true;
      }
    });
    return cambio;
  };

  for (const [store, lista] of [
    ["personajes", await dbGetAll("personajes")],
    ["npcs", await dbGetAll("npcs")],
    ["tiendas", await dbGetAll("tiendas")]
  ]) {
    for (const obj of lista) {
      if (ajustar(obj)) await dbPut(store, obj);
    }
  }

  localStorage.setItem(CLAVE, "1");
}

// [UNDAVAR-PARTE-4.2h1d-REGISTRO] El Sello 1 es un ataque de daño acumulativo
async function migrarSelloDanoAcumulativo() {
  const CLAVE = "undavar_sello1_dano_v1";
  if (localStorage.getItem(CLAVE)) return;

  const ajustar = (obj) => {
    let cambio = false;
    (obj.items || []).forEach(it => {
      if (it.name !== "Sello de Sedra") return;
      const habs = it.system?.habilidades;
      if (!Array.isArray(habs)) return;
      const h1 = habs.find(h => h.id === "sedra-1") || habs[0];
      if (h1 && h1.modoUso !== "dano") { h1.modoUso = "dano"; cambio = true; }
    });
    return cambio;
  };

  for (const [store, lista] of [
    ["personajes", await dbGetAll("personajes")],
    ["npcs", await dbGetAll("npcs")],
    ["tiendas", await dbGetAll("tiendas")]
  ]) {
    for (const obj of lista) {
      if (ajustar(obj)) await dbPut(store, obj);
    }
  }

  localStorage.setItem(CLAVE, "1");
}

// [UNDAVAR-PARTE-4.2h1c-SELLO-NIVEL] El Sello inicia en nivel 0 y sin enfriamiento
async function migrarSelloNivelCero() {
  const CLAVE = "undavar_sello_nivel0_v1";
  if (localStorage.getItem(CLAVE)) return;

  const ajustar = (obj) => {
    let cambio = false;
    (obj.items || []).forEach(it => {
      if (it.name !== "Sello de Sedra") return;
      if (!it.system) it.system = {};
      if (it.system.nivel !== 0 || it.system.enfriamientoTurnos !== 0) {
        it.system.nivel = 0;
        it.system.enfriamientoTurnos = 0;
        cambio = true;
      }
    });
    return cambio;
  };

  for (const [store, lista] of [
    ["personajes", await dbGetAll("personajes")],
    ["npcs", await dbGetAll("npcs")],
    ["tiendas", await dbGetAll("tiendas")]
  ]) {
    for (const obj of lista) {
      if (ajustar(obj)) await dbPut(store, obj);
    }
  }

  localStorage.setItem(CLAVE, "1");
}

// [UNDAVAR-PARTE-4.2h4j-TIENDAS] Elimina el Sello de Sedra de cualquier tienda guardada
// [UNDAVAR-PARTE-4.2h4k-RESTABLECEDOR] El Restablecedor sí debe reponerlo
async function quitarSelloDeSedraDeTiendas() {
  const tiendas = await dbGetAll("tiendas");
  for (const t of tiendas) {
    if (t.id === "restablecedor") continue;
    if (!Array.isArray(t.items)) continue;
    const antes = t.items.length;
    t.items = t.items.filter(i => i.name !== SELLO_DE_SEDRA.name);
    if (t.items.length !== antes) await dbPut("tiendas", t);
  }
}

// [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] Migra la variación genérica del ítem a cada habilidad
async function migrarVariacionesNivelHabilidad() {
  if (localStorage.getItem("undavar-migracion-nivel-habilidad") === "1") return;
  for (const store of ["personajes", "npcs"]) {
    const actores = await dbGetAll(store);
    for (const a of actores) {
      let cambio = false;
      (a.items || []).forEach(it => {
        if (it.type !== "arte" && it.type !== "arma") return;
        // [UNDAVAR-PARTE-10.4-ARMAS] El arma común no tiene niveles de habilidad
        if (it.type === "arma" && esArmaComun(it)) return;
        const viejo = Array.isArray(it.system?.variacionesNivel) ? it.system.variacionesNivel : [];
        const habs = Array.isArray(it.system?.habilidades) ? it.system.habilidades : [];
        if (!viejo.length || !habs.length) return;
        habs.forEach(h => {
          if (!Array.isArray(h.variacionesNivel) || !h.variacionesNivel.length) {
            h.variacionesNivel = JSON.parse(JSON.stringify(viejo));
          }
        });
        delete it.system.variacionesNivel;
        cambio = true;
      });
      if (cambio) await dbPut(store, a);
    }
  }
  localStorage.setItem("undavar-migracion-nivel-habilidad", "1");
}

// [UNDAVAR-PARTE-4.2h4k-RESTABLECEDOR] Devuelve el Sello al Restablecedor si falta
async function asegurarSelloEnRestablecedor() {
  const t = await dbGet("tiendas", "restablecedor");
  if (!t) return;
  if (!Array.isArray(t.items)) t.items = [];
  if (t.items.some(i => i.name === SELLO_DE_SEDRA.name)) return;
  t.items.push({
    id: nuevoId(),
    name: SELLO_DE_SEDRA.name,
    type: "arma",
    system: { ...JSON.parse(JSON.stringify(SELLO_DE_SEDRA.system)), precio_oro: 0, cantidad: 999 }
  });
  await dbPut("tiendas", t);
}

// [UNDAVAR-PARTE-3.6C] Migración: pasa la aportación de estados a Pt. Herida real una sola vez
async function sincronizarHeridasPorEstado() {
  const personajes = await dbGetAll("personajes");

  for (const p of personajes) {
    const ext = p.system?.extensionEstado;
    if (!ext) continue;

    const totalEstados = (Number(ext.hambre?.value) || 0) +
      (Number(ext.sed?.value) || 0) +
      (Number(ext.cansancio?.value) || 0) +
      (Number(ext.fatiga?.value) || 0);
    const bonus = Math.floor(totalEstados / 2);
    const previo = Number(p.system.estado.heridasCausadasPorEstado) || 0;

    // Solo suma si el estado aporta más heridas que las ya cobradas; nunca resta
    if (bonus <= previo) continue;

    const delta = bonus - previo;
    const heridaActual = Number(p.system.estado.ptHerida?.value) || 0;
    p.system.estado.ptHerida.value = Math.min(8, heridaActual + delta);
    p.system.estado.heridasCausadasPorEstado = bonus;

    const derivados = calcularDerivados(p.system, p.items || []);
    const saludActual = Number(p.system.estado.ptSalud?.value) || 0;
    if (saludActual > derivados.saludLimiteActual) {
      p.system.estado.ptSalud.value = derivados.saludLimiteActual;
    }

    await dbPut("personajes", p);
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
  const embedSeccion = urlParams.get("seccion");

  // [UNDAVAR-PARTE-3.8] Modo panel limpio dentro de la vista dividida
  if (urlParams.get("panel") === "1") {
    document.body.classList.add("modo-panel");
  }

  if (embedVista) {
    state.vista = embedVista;
    if (embedVista === "ficha") state.personajeId = embedId;
    if (embedVista === "npc") state.npcId = embedId;
    if (embedVista === "tienda") state.tiendaId = embedId;
    if (embedVista === "oraculo") state.oraculoId = embedId;
  }

  // [UNDAVAR-PARTE-9.3B-MEMORIA] Al abrir, recupera sección, registro y pestaña
  if (!esEmbed && !embedVista) {
    try {
      const crudo = localStorage.getItem("undavar_ultimo_estado");
      const ultimo = crudo ? JSON.parse(crudo) : null;
      if (ultimo && Object.prototype.hasOwnProperty.call(VISTA_META, ultimo.vista)) {
        state.vista = ultimo.vista;
        if (ultimo.vista === "ficha") {
          state.personajeId = ultimo.personajeId || null;
          state.subtabFicha = ultimo.subtabFicha || "datos";
        }
        if (ultimo.vista === "npc") {
          state.npcId = ultimo.npcId || null;
          state.subtabNPC = ultimo.subtabNPC || "datos";
        }
        if (ultimo.vista === "tienda") state.tiendaId = ultimo.tiendaId || null;
        if (ultimo.vista === "oraculo") state.oraculoId = ultimo.oraculoId || null;
      } else {
        // [UNDAVAR-PARTE-9.1B-ULTIMA-VISTA] Compatibilidad con la clave antigua
        const ultima = localStorage.getItem("undavar_vista_actual");
        if (ultima && Object.prototype.hasOwnProperty.call(VISTA_META, ultima)) state.vista = ultima;
      }
    } catch (e) { }
  }

  // [UNDAVAR-PARTE-3.8] Sección inicial de la ficha pedida por el panel
  if (embedSeccion) state.subtabFicha = embedSeccion;

  // [UNDAVAR-PARTE-9.3C-ENFRENTAMIENTO] Recupera la tirada enfrentada rápida
  if (!esEmbed && !embedVista) {
    const guardadoEnf = leerEstadoEnfrentamiento();
    if (guardadoEnf) {
      state.enfrentamiento.modo = guardadoEnf.modo || "todos_vs_todos";
      state.enfrentamiento.valSR = guardadoEnf.valSR || 3;
      state.enfrentamiento.esCustomSR = !!guardadoEnf.esCustomSR;
      if (Array.isArray(guardadoEnf.participantes) && guardadoEnf.participantes.length) {
        state.enfrentamiento.participantes = guardadoEnf.participantes
          .filter(p => p && p.id && p.tipoStore)
          .map(p => ({ id: p.id, tipoStore: p.tipoStore }));
      }
    }
  }

  // Prevenir bucle infinito: un iframe no puede abrir Vista Dividida
  if (esEmbed && state.vista === "dividida") {
    state.vista = "inicio";
  }

  // [UNDAVAR-PARTE-6-MIGRACION] En escritorio, pasa IndexedDB a SQLite la primera vez
  if (ES_TAURI) {
    try {
      const migracion = await migrarIndexedDBaSQLite();
      if (migracion.migrado) notificar(`🗄️ Migrados ${migracion.total} registros a SQLite.`);
    } catch (e) {
      console.warn("Migración a SQLite omitida:", e);
    }
  }
  // [UNDAVAR-PARTE-10.12-DB-DIVIDIDA] Los paneles no precargan ni migran:
  // la ventana principal ya dejó la base lista antes de crearlos
  if (!esEmbed) await precargarBaseDeDatos();
  // [UNDAVAR-PARTE-4.2h2-PAREJA] Las copias son temporales: no sobreviven a recargar
  if (!esEmbed) await limpiarClonesHuerfanos();
  // [UNDAVAR-PARTE-3.6B] La migración de heridas solo corre en la ventana principal
  if (!esEmbed) await sincronizarHeridasPorEstado();
  // [UNDAVAR-PARTE-8-PERFIL] Carga el perfil del rail y conecta su mini ventana
  if (!esEmbed) {
    await cargarPerfilUsuario();
    document.getElementById("rail-perfil")?.addEventListener("click", abrirModalPerfil);
  }
  render();

  // [UNDAVAR-PARTE-3.6] Registrar el SW una sola vez y solo fuera de los iframes
  if (!esEmbed && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { });
  }

  // [UNDAVAR-PARTE-7-AVATAR] Un solo listener para todos los botones de retrato
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest?.(".avatar-editar");
    if (!btn) return;
    ev.preventDefault();
    abrirEditorAvatar(btn.dataset.store, btn.dataset.id);
  });
}

// ============================================================
// [UNDAVAR-PARTE-7-RECORTE] Editor de retrato: recorte cuadrado
// ============================================================
const AVATAR_LADO = 320;
const AVATAR_SALIDA = 256;
let _avatarEditor = null;

function asegurarModalAvatar() {
  if (document.getElementById("avatar-modal")) return;
  const div = document.createElement("div");
  div.id = "avatar-modal";
  div.className = "modal-overlay avatar-modal";
  div.style.display = "none";
  div.innerHTML = `
    <div class="modal-caja avatar-caja" role="dialog" aria-modal="true" aria-labelledby="avatar-titulo">
      <div class="modal-header">
        <h3 id="avatar-titulo">Retrato</h3>
        <button class="modal-cerrar" type="button" aria-label="Cerrar" data-avatar-cerrar>✕</button>
      </div>
      <div class="modal-cuerpo">
        <div class="avatar-lienzo">
          <canvas id="avatar-canvas" width="${AVATAR_LADO}" height="${AVATAR_LADO}"></canvas>
        </div>
        <p class="avatar-pista">Arrastra para encuadrar. Usa la rueda o el control para acercar.</p>
        <div class="avatar-controles">
          <span class="avatar-zoom-icono">−</span>
          <input type="range" id="avatar-zoom" min="1" max="4" step="0.01" value="1" aria-label="Zoom del retrato">
          <span class="avatar-zoom-icono">+</span>
        </div>
        <div class="modal-acciones avatar-acciones">
          <button class="btn-peligro" type="button" id="avatar-quitar">Quitar retrato</button>
          <span class="avatar-acciones-der">
            <button class="btn-secundario" type="button" id="avatar-cancelar">Cancelar</button>
            <button class="btn-primario" type="button" id="avatar-guardar">Guardar retrato</button>
          </span>
        </div>
      </div>
    </div>`;
  document.body.appendChild(div);

  div.querySelector("[data-avatar-cerrar]").addEventListener("click", cerrarEditorAvatar);
  div.querySelector("#avatar-cancelar").addEventListener("click", cerrarEditorAvatar);
  div.querySelector("#avatar-guardar").addEventListener("click", guardarAvatarEditor);
  div.querySelector("#avatar-quitar").addEventListener("click", quitarAvatarEditor);
  div.querySelector("#avatar-zoom").addEventListener("input", (e) => aplicarZoomAvatar(Number(e.target.value)));

  const canvas = div.querySelector("#avatar-canvas");
  canvas.addEventListener("pointerdown", (e) => {
    if (!_avatarEditor) return;
    _avatarEditor.arrastrando = true;
    _avatarEditor.px = e.clientX;
    _avatarEditor.py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!_avatarEditor?.arrastrando) return;
    const rect = canvas.getBoundingClientRect();
    const escala = AVATAR_LADO / Math.max(1, rect.width);
    _avatarEditor.x += (e.clientX - _avatarEditor.px) * escala;
    _avatarEditor.y += (e.clientY - _avatarEditor.py) * escala;
    _avatarEditor.px = e.clientX;
    _avatarEditor.py = e.clientY;
    dibujarAvatarEditor();
  });
  const soltar = (e) => {
    if (!_avatarEditor) return;
    _avatarEditor.arrastrando = false;
    canvas.style.cursor = "grab";
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { }
  };
  canvas.addEventListener("pointerup", soltar);
  canvas.addEventListener("pointercancel", soltar);
  canvas.addEventListener("wheel", (e) => {
    if (!_avatarEditor) return;
    e.preventDefault();
    aplicarZoomAvatar(_avatarEditor.zoom * (e.deltaY < 0 ? 1.08 : 0.92));
  }, { passive: false });

  div.addEventListener("click", (e) => { if (e.target === div) cerrarEditorAvatar(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && div.style.display !== "none") cerrarEditorAvatar();
  });
}

// [UNDAVAR-PARTE-7-RECORTE] Abre el selector de imagen de la ficha
function abrirEditorAvatar(store, id) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    if (!file.type.startsWith("image/")) { notificar("Elige un archivo de imagen."); return; }
    if (file.size > 12 * 1024 * 1024) { notificar("La imagen supera los 12 MB."); return; }
    // [UNDAVAR-PARTE-8-PERFIL] La foto de perfil reutiliza este editor sin tocar la base de fichas
    if (store === "perfil") {
      iniciarRecorteAvatar(file, { id: "perfil", nombre: perfilUsuario.nombre, img: perfilUsuario.img }, "perfil");
      return;
    }
    const actor = await dbGet(store, id);
    if (!actor) { notificar("No se encontró la ficha."); return; }
    iniciarRecorteAvatar(file, actor, store);
  });
  document.body.appendChild(input);
  input.click();
}

function iniciarRecorteAvatar(file, actor, store) {
  asegurarModalAvatar();
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const minZoom = Math.max(AVATAR_LADO / img.naturalWidth, AVATAR_LADO / img.naturalHeight);
    _avatarEditor = {
      actor, store, img,
      zoom: minZoom, minZoom,
      x: (AVATAR_LADO - img.naturalWidth * minZoom) / 2,
      y: (AVATAR_LADO - img.naturalHeight * minZoom) / 2,
      arrastrando: false, px: 0, py: 0
    };
    const modal = document.getElementById("avatar-modal");
    // [UNDAVAR-PARTE-8-PERFIL] Título propio para la foto del usuario
    modal.querySelector("#avatar-titulo").textContent = store === "perfil"
      ? "Foto de perfil"
      : `Retrato de ${actor.nombre || "la ficha"}`;
    const slider = modal.querySelector("#avatar-zoom");
    slider.min = minZoom.toFixed(3);
    slider.max = (minZoom * 4).toFixed(3);
    slider.value = minZoom;
    modal.querySelector("#avatar-quitar").style.display = actor.img ? "" : "none";
    modal.style.display = "flex";
    dibujarAvatarEditor();
  };
  img.onerror = () => { URL.revokeObjectURL(url); notificar("No se pudo leer la imagen."); };
  img.src = url;
}

function aplicarZoomAvatar(nuevo) {
  const E = _avatarEditor;
  if (!E) return;
  nuevo = Math.min(E.minZoom * 4, Math.max(E.minZoom, nuevo));
  const centro = AVATAR_LADO / 2;
  const factor = nuevo / E.zoom;
  E.x = centro - (centro - E.x) * factor;
  E.y = centro - (centro - E.y) * factor;
  E.zoom = nuevo;
  const slider = document.getElementById("avatar-zoom");
  if (slider) slider.value = nuevo;
  dibujarAvatarEditor();
}

function dibujarAvatarEditor() {
  const E = _avatarEditor;
  if (!E) return;
  const canvas = document.getElementById("avatar-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = E.img.naturalWidth * E.zoom;
  const h = E.img.naturalHeight * E.zoom;
  E.x = Math.min(0, Math.max(AVATAR_LADO - w, E.x));
  E.y = Math.min(0, Math.max(AVATAR_LADO - h, E.y));
  ctx.clearRect(0, 0, AVATAR_LADO, AVATAR_LADO);
  ctx.fillStyle = "#100d14";
  ctx.fillRect(0, 0, AVATAR_LADO, AVATAR_LADO);
  ctx.drawImage(E.img, E.x, E.y, w, h);
}

function recortarAvatar() {
  const E = _avatarEditor;
  const salida = document.createElement("canvas");
  salida.width = AVATAR_SALIDA;
  salida.height = AVATAR_SALIDA;
  const ctx = salida.getContext("2d");
  const s = AVATAR_SALIDA / AVATAR_LADO;
  ctx.fillStyle = "#100d14";
  ctx.fillRect(0, 0, AVATAR_SALIDA, AVATAR_SALIDA);
  ctx.drawImage(E.img, E.x * s, E.y * s, E.img.naturalWidth * E.zoom * s, E.img.naturalHeight * E.zoom * s);
  const webp = salida.toDataURL("image/webp", 0.86);
  return webp.startsWith("data:image/webp") ? webp : salida.toDataURL("image/jpeg", 0.88);
}

async function guardarAvatarEditor() {
  const E = _avatarEditor;
  if (!E) return;
  try {
    const dataUrl = recortarAvatar();
    // [UNDAVAR-PARTE-8-PERFIL] Guarda la foto en la configuración del perfil
    if (E.store === "perfil") {
      perfilUsuario.img = dataUrl;
      await dbSetConfig(PERFIL_KEY, { nombre: perfilUsuario.nombre, img: perfilUsuario.img });
      cerrarEditorAvatar();
      pintarPerfilRail();
      actualizarFotoPerfilModal();
      notificar("Foto de perfil actualizada.");
      return;
    }
    const actor = await dbGet(E.store, E.actor.id);
    if (!actor) throw new Error("La ficha ya no existe.");
    actor.img = dataUrl;
    await dbPut(E.store, actor);
    cerrarEditorAvatar();
    notificar("Retrato actualizado.");
    render();
  } catch (e) {
    notificar("No se pudo guardar el retrato: " + (e.message || e));
  }
}

async function quitarAvatarEditor() {
  const E = _avatarEditor;
  if (!E) return;
  try {
    // [UNDAVAR-PARTE-8-PERFIL] Quita la foto del perfil sin tocar fichas
    if (E.store === "perfil") {
      perfilUsuario.img = "";
      await dbSetConfig(PERFIL_KEY, { nombre: perfilUsuario.nombre, img: perfilUsuario.img });
      cerrarEditorAvatar();
      pintarPerfilRail();
      actualizarFotoPerfilModal();
      notificar("Foto de perfil eliminada.");
      return;
    }
    const actor = await dbGet(E.store, E.actor.id);
    if (!actor) throw new Error("La ficha ya no existe.");
    actor.img = "";
    await dbPut(E.store, actor);
    cerrarEditorAvatar();
    notificar("Retrato eliminado.");
    render();
  } catch (e) {
    notificar("No se pudo quitar el retrato: " + (e.message || e));
  }
}

function cerrarEditorAvatar() {
  _avatarEditor = null;
  const modal = document.getElementById("avatar-modal");
  if (modal) modal.style.display = "none";
}

// ============================================================
// [UNDAVAR-PARTE-8-PERFIL] Perfil del usuario del rail
// ============================================================
const PERFIL_KEY = "perfil-usuario";
let perfilUsuario = { nombre: "Usuario", img: "" };

function inicialPerfil() {
  return (perfilUsuario.nombre || "U").trim().charAt(0).toUpperCase() || "U";
}

async function cargarPerfilUsuario() {
  const cfg = await dbGetConfig(PERFIL_KEY, null);
  perfilUsuario = {
    nombre: typeof cfg?.nombre === "string" && cfg.nombre.trim()
      ? cfg.nombre.trim().slice(0, 40)
      : "Usuario",
    img: typeof cfg?.img === "string" ? cfg.img : "",
  };
  pintarPerfilRail();
}

// Pinta el avatar del rail con foto o inicial y actualiza el tooltip
function pintarPerfilRail() {
  const avatar = document.getElementById("rail-avatar");
  const boton = document.getElementById("rail-perfil");
  if (avatar) {
    avatar.innerHTML = perfilUsuario.img
      ? `<img src="${esc(perfilUsuario.img)}" alt="">`
      : esc(inicialPerfil());
    avatar.classList.toggle("con-foto", Boolean(perfilUsuario.img));
  }
  if (boton) {
    boton.title = `Perfil: ${perfilUsuario.nombre}`;
    boton.setAttribute("aria-label", `Perfil de ${perfilUsuario.nombre}`);
  }
}

// Refresca la foto dentro del modal si está abierto
function actualizarFotoPerfilModal() {
  const foto = document.getElementById("perfil-foto");
  if (!foto) return;
  foto.innerHTML = perfilUsuario.img
    ? `<img src="${esc(perfilUsuario.img)}" alt="">`
    : esc(inicialPerfil());
  const quitar = document.getElementById("perfil-quitar-foto");
  if (quitar) quitar.style.display = perfilUsuario.img ? "" : "none";
}

// Mini ventana de configuración: nombre y foto del usuario
function abrirModalPerfil() {
  const existente = document.getElementById("perfil-modal");
  if (existente) { existente.style.display = "flex"; actualizarFotoPerfilModal(); return; }

  const fondo = document.createElement("div");
  fondo.id = "perfil-modal";
  fondo.className = "modal-fondo modal-perfil-fondo";
  fondo.innerHTML = `
    <div class="modal-caja modal-perfil" role="dialog" aria-modal="true" aria-labelledby="perfil-titulo">
      <div class="modal-header">
        <h3 id="perfil-titulo">Perfil de usuario</h3>
        <button class="modal-cerrar" type="button" aria-label="Cerrar" data-perfil-cerrar>✕</button>
      </div>
      <div class="modal-cuerpo">
        <div class="perfil-foto-fila">
          <span class="perfil-foto" id="perfil-foto"></span>
          <div class="perfil-foto-acciones">
            <button class="btn-secundario chico" type="button" id="perfil-cambiar-foto"><span data-icono="camara"></span> Cambiar foto</button>
            <button class="btn-peligro chico" type="button" id="perfil-quitar-foto">Quitar foto</button>
            <p class="nota">La foto se recorta en círculo y se guarda en este dispositivo.</p>
          </div>
        </div>
        <div class="campo-fila">
          <label for="perfil-nombre">Nombre de usuario</label>
          <input type="text" id="perfil-nombre" maxlength="40" autocomplete="nickname" placeholder="Tu nombre en la mesa">
        </div>
        <div class="modal-acciones">
          <button class="btn-secundario" type="button" id="perfil-cancelar">Cancelar</button>
          <button class="btn-primario" type="button" id="perfil-guardar">Guardar perfil</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(fondo);
  pintarIconos(fondo);

  const input = fondo.querySelector("#perfil-nombre");
  input.value = perfilUsuario.nombre;
  actualizarFotoPerfilModal();

  const cerrar = () => fondo.remove();
  fondo.querySelector("[data-perfil-cerrar]").addEventListener("click", cerrar);
  fondo.querySelector("#perfil-cancelar").addEventListener("click", cerrar);
  fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(); });
  document.addEventListener("keydown", function escapePerfil(e) {
    if (e.key !== "Escape") return;
    if (document.getElementById("perfil-modal") === fondo) {
      document.removeEventListener("keydown", escapePerfil);
      cerrar();
    }
  });

  fondo.querySelector("#perfil-cambiar-foto").addEventListener("click", () => abrirEditorAvatar("perfil", "perfil"));
  fondo.querySelector("#perfil-quitar-foto").addEventListener("click", async () => {
    perfilUsuario.img = "";
    await dbSetConfig(PERFIL_KEY, { nombre: perfilUsuario.nombre, img: "" });
    pintarPerfilRail();
    actualizarFotoPerfilModal();
    notificar("Foto de perfil eliminada.");
  });

  fondo.querySelector("#perfil-guardar").addEventListener("click", async () => {
    const nombre = input.value.trim().slice(0, 40) || "Usuario";
    perfilUsuario.nombre = nombre;
    await dbSetConfig(PERFIL_KEY, { nombre: perfilUsuario.nombre, img: perfilUsuario.img });
    pintarPerfilRail();
    cerrar();
    notificar("Perfil actualizado.");
  });

  input.focus();
  input.select();
}

// ============================================================
// ============================================================
// [UNDAVAR-PARTE-10.11-GALERIA] Galería de imágenes de la campaña
// ============================================================
const GALERIA_MAX_LADO = 1600;
const GALERIA_MAX_BYTES = 12 * 1024 * 1024;

// [UNDAVAR-PARTE-10.11-GALERIA] Reduce la imagen a un dataURL manejable
function galeriaComprimirImagen(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const escala = Math.min(1, GALERIA_MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * escala));
        const h = Math.max(1, Math.round(img.naturalHeight * escala));
        const lienzo = document.createElement("canvas");
        lienzo.width = w;
        lienzo.height = h;
        const ctx = lienzo.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const webp = lienzo.toDataURL("image/webp", 0.86);
        resolve(webp.startsWith("data:image/webp") ? webp : lienzo.toDataURL("image/jpeg", 0.88));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); };
    img.src = url;
  });
}

// [UNDAVAR-PARTE-10.11-GALERIA] Peso aproximado de un dataURL base64
function galeriaPesoTexto(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// [UNDAVAR-PARTE-10.11-GALERIA] Abre el selector nativo y devuelve los archivos
function galeriaElegirArchivos({ multiple = true } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = multiple;
    input.style.display = "none";
    const terminar = (archivos) => { input.remove(); resolve(archivos); };
    input.addEventListener("change", () => terminar([...(input.files || [])]));
    input.addEventListener("cancel", () => terminar([]));
    document.body.appendChild(input);
    input.click();
  });
}

// [UNDAVAR-PARTE-10.11-GALERIA] Comprime y guarda los archivos en la galería
async function galeriaGuardarArchivos(archivos) {
  const creadas = [];
  for (const file of archivos) {
    if (!file.type.startsWith("image/")) { notificar(`⚠️ «${file.name}» no es una imagen.`); continue; }
    if (file.size > GALERIA_MAX_BYTES) { notificar(`⚠️ «${file.name}» supera los 12 MB.`); continue; }
    try {
      const data = await galeriaComprimirImagen(file);
      const nombre = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Imagen";
      const imagen = { id: nuevoId(), nombre, data, orden: Date.now() + creadas.length, updatedAt: Date.now() };
      await dbPut("galeria", imagen);
      creadas.push(imagen);
    } catch (e) {
      notificar(`⚠️ No se pudo añadir «${file.name}».`);
    }
  }
  return creadas;
}

// [UNDAVAR-PARTE-10.11-GALERIA] Selector de archivos para añadir imágenes
async function galeriaAnadirImagenes() {
  const archivos = await galeriaElegirArchivos({ multiple: true });
  if (!archivos.length) return;
  const creadas = await galeriaGuardarArchivos(archivos);
  if (!creadas.length) return;
  notificar(`✅ ${creadas.length} ${creadas.length === 1 ? "imagen añadida" : "imágenes añadidas"}.`);
  render();
}

// [UNDAVAR-PARTE-10.11.2-PIN-IMAGEN] Selector modal de una imagen de la galería
async function galeriaElegirImagen(idActual = "") {
  const imagenes = (await dbGetAll("galeria"))
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
  return new Promise((resolve) => {
    const fondo = document.createElement("div");
    fondo.className = "modal-fondo galeria-picker-fondo";
    fondo.innerHTML = `
      <div class="modal-caja galeria-picker" role="dialog" aria-modal="true" aria-labelledby="galeria-picker-titulo">
        <div class="modal-header">
          <h3 id="galeria-picker-titulo">Elegir imagen</h3>
          <button class="modal-cerrar" type="button" aria-label="Cerrar" title="Cerrar" data-picker-cerrar>✕</button>
        </div>
        <div class="modal-cuerpo">
          ${imagenes.length ? `
          <div class="galeria-picker-rejilla">
            ${imagenes.map(img => `
            <button type="button" class="galeria-picker-item${img.id === idActual ? " elegida" : ""}" data-picker-id="${esc(img.id)}" title="${esc(img.nombre)}">
              <img src="${esc(img.data)}" alt="${esc(img.nombre)}" loading="lazy">
              <span>${esc(img.nombre)}</span>
            </button>`).join("")}
          </div>` : `
          <div class="estado-vacio">
            <span class="estado-vacio-icono" data-icono="galeria"></span>
            <div class="estado-vacio-titulo">La galería está vacía</div>
            <p class="estado-vacio-texto">Cierra esta ventana y usa «Cargar imagen» en el editor del pin.</p>
          </div>`}
        </div>
      </div>`;
    contenedorOverlays().appendChild(fondo);
    pintarIconos(fondo);

    let cerrado = false;
    const cerrar = (valor) => {
      if (cerrado) return;
      cerrado = true;
      document.removeEventListener("keydown", teclas);
      fondo.remove();
      resolve(valor);
    };
    const teclas = (e) => {
      if (e.key === "Escape") cerrar(null);
    };
    document.addEventListener("keydown", teclas);
    fondo.addEventListener("click", (e) => {
      if (e.target === fondo || e.target.closest("[data-picker-cerrar]")) { cerrar(null); return; }
      const item = e.target.closest("[data-picker-id]");
      if (item) cerrar(item.dataset.pickerId);
    });
  });
}

// [UNDAVAR-PARTE-10.11-GALERIA] Visor de imágenes con zoom, arrastre y anterior/siguiente
function galeriaAbrirVisor(imagenes, id) {
  if (!imagenes.length) return;
  let indice = Math.max(0, imagenes.findIndex(i => i.id === id));
  let escala = 1, tx = 0, ty = 0, arrastre = null;

  const fondo = document.createElement("div");
  fondo.className = "modal-fondo galeria-visor-fondo";
  fondo.innerHTML = `
    <div class="galeria-visor" role="dialog" aria-modal="true" aria-label="Visor de imágenes">
      <div class="galeria-visor-cab">
        <strong id="galeria-visor-nombre"></strong>
        <span class="galeria-visor-cuenta"></span>
        <div class="galeria-visor-zoom" role="group" aria-label="Zoom">
          <button type="button" class="btn-secundario chico" data-visor-zoom-out title="Alejar (−)" aria-label="Alejar">−</button>
          <button type="button" class="btn-secundario chico galeria-visor-nivel" data-visor-zoom-reset title="Ajustar (0)" aria-label="Ajustar imagen">100%</button>
          <button type="button" class="btn-secundario chico" data-visor-zoom-in title="Acercar (+)" aria-label="Acercar">+</button>
        </div>
        <button class="modal-cerrar" type="button" data-visor-cerrar aria-label="Cerrar" title="Cerrar">✕</button>
      </div>
      <div class="galeria-visor-lienzo">
        <img class="galeria-visor-img" alt="">
      </div>
      ${imagenes.length > 1 ? `
      <div class="galeria-visor-pie">
        <button type="button" class="btn-secundario chico" data-visor-prev>← Anterior</button>
        <button type="button" class="btn-secundario chico" data-visor-next>Siguiente →</button>
      </div>` : ""}
    </div>`;

  const caja = fondo.querySelector(".galeria-visor");
  const nombre = fondo.querySelector("#galeria-visor-nombre");
  const cuenta = fondo.querySelector(".galeria-visor-cuenta");
  const lienzo = fondo.querySelector(".galeria-visor-lienzo");
  const imgEl = fondo.querySelector(".galeria-visor-img");
  const nivel = fondo.querySelector("[data-visor-zoom-reset]");

  // [UNDAVAR-PARTE-10.11.3B-ZOOM-VISOR] Mantiene la imagen dentro del lienzo
  const limitar = () => {
    const w = imgEl.clientWidth * escala;
    const h = imgEl.clientHeight * escala;
    const maxX = Math.max(0, (w - lienzo.clientWidth) / 2);
    const maxY = Math.max(0, (h - lienzo.clientHeight) / 2);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  };
  const aplicar = () => {
    limitar();
    imgEl.style.transform = `translate(${tx}px, ${ty}px) scale(${escala})`;
    nivel.textContent = `${Math.round(escala * 100)}%`;
    lienzo.classList.toggle("con-zoom", escala > 1.01);
  };
  const ajustar = () => { escala = 1; tx = 0; ty = 0; aplicar(); };
  // [UNDAVAR-PARTE-10.11.3B-ZOOM-VISOR] Zoom conservando el punto bajo el cursor
  const zoomEn = (factor, px, py) => {
    const nueva = Math.min(6, Math.max(1, escala * factor));
    if (Math.abs(nueva - escala) < 0.001) return;
    const rect = lienzo.getBoundingClientRect();
    const cx = (px ?? rect.width / 2) - rect.width / 2;
    const cy = (py ?? rect.height / 2) - rect.height / 2;
    tx = cx + (nueva / escala) * (tx - cx);
    ty = cy + (nueva / escala) * (ty - cy);
    escala = nueva;
    aplicar();
  };
  const pintar = () => {
    const img = imagenes[indice];
    imgEl.src = img.data;
    imgEl.alt = img.nombre;
    nombre.textContent = img.nombre;
    cuenta.textContent = `${indice + 1} / ${imagenes.length}`;
    caja.setAttribute("aria-label", img.nombre);
    ajustar();
  };
  const mover = (paso) => {
    indice = (indice + paso + imagenes.length) % imagenes.length;
    pintar();
  };
  const teclas = (e) => {
    if (e.key === "Escape") { cerrar(); return; }
    if (e.key === "ArrowLeft") { mover(-1); return; }
    if (e.key === "ArrowRight") { mover(1); return; }
    if (e.key === "+" || e.key === "=") { zoomEn(1.25); return; }
    if (e.key === "-") { zoomEn(1 / 1.25); return; }
    if (e.key === "0") ajustar();
  };
  const cerrar = () => {
    document.removeEventListener("keydown", teclas);
    fondo.remove();
  };

  fondo.addEventListener("click", (e) => {
    if (e.target.closest("[data-visor-cerrar]") || e.target === fondo) { cerrar(); return; }
    if (e.target.closest("[data-visor-prev]")) { mover(-1); return; }
    if (e.target.closest("[data-visor-next]")) { mover(1); return; }
    if (e.target.closest("[data-visor-zoom-in]")) { zoomEn(1.25); return; }
    if (e.target.closest("[data-visor-zoom-out]")) { zoomEn(1 / 1.25); return; }
    if (e.target.closest("[data-visor-zoom-reset]")) ajustar();
  });

  lienzo.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = lienzo.getBoundingClientRect();
    zoomEn(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });

  lienzo.addEventListener("dblclick", (e) => {
    const rect = lienzo.getBoundingClientRect();
    if (escala > 1.01) ajustar();
    else zoomEn(2.5, e.clientX - rect.left, e.clientY - rect.top);
  });

  // [UNDAVAR-PARTE-10.11.3B-ZOOM-VISOR] Arrastrar la imagen ampliada
  lienzo.addEventListener("pointerdown", (e) => {
    if (escala <= 1.01 || e.button !== 0) return;
    arrastre = { x: e.clientX, y: e.clientY, tx, ty, id: e.pointerId };
    try { lienzo.setPointerCapture(e.pointerId); } catch (err) { }
    lienzo.classList.add("arrastrando");
  });
  lienzo.addEventListener("pointermove", (e) => {
    if (!arrastre || arrastre.id !== e.pointerId) return;
    tx = arrastre.tx + (e.clientX - arrastre.x);
    ty = arrastre.ty + (e.clientY - arrastre.y);
    aplicar();
  });
  const soltar = () => {
    if (!arrastre) return;
    try { lienzo.releasePointerCapture(arrastre.id); } catch (err) { }
    arrastre = null;
    lienzo.classList.remove("arrastrando");
  };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);
  imgEl.addEventListener("load", aplicar);

  document.addEventListener("keydown", teclas);
  contenedorOverlays().appendChild(fondo);
  pintar();
}

// [UNDAVAR-PARTE-10.11-GALERIA] Vista de la galería
async function renderGaleria() {
  const imagenes = (await dbGetAll("galeria"))
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
  const bytes = imagenes.reduce((s, i) => s + Math.round((i.data?.length || 0) * 0.75), 0);

  app.innerHTML = `
  <section class="vista-galeria">
    <header class="galeria-cab">
      <div>
        <h2>Galería de la campaña</h2>
        <p class="galeria-resumen">${imagenes.length} ${imagenes.length === 1 ? "imagen" : "imágenes"}${imagenes.length ? ` · ${galeriaPesoTexto(bytes)}` : ""}</p>
      </div>
      <button class="btn-primario chico" id="galeria-anadir"><span data-icono="mas"></span> Añadir imágenes</button>
    </header>

    ${imagenes.length ? `
    <div class="galeria-rejilla">
      ${imagenes.map(img => `
      <figure class="galeria-item" data-id="${esc(img.id)}">
        <button type="button" class="galeria-foto" data-galeria-ver="${esc(img.id)}" title="${esc(img.nombre)}" aria-label="Ver ${esc(img.nombre)}">
          <img src="${esc(img.data)}" alt="${esc(img.nombre)}" loading="lazy">
        </button>
        <figcaption class="galeria-pie">
          <span class="galeria-nombre" title="${esc(img.nombre)}">${esc(img.nombre)}</span>
          <button type="button" class="btn-icono btn-peligro" data-galeria-borrar="${esc(img.id)}" title="Quitar" aria-label="Quitar ${esc(img.nombre)}"><span data-icono="borrar"></span></button>
        </figcaption>
      </figure>`).join("")}
    </div>` : `
    <div class="estado-vacio">
      <span class="estado-vacio-icono" data-icono="galeria"></span>
      <div class="estado-vacio-titulo">La galería está vacía</div>
      <p class="estado-vacio-texto">Añade imágenes de la campaña: lugares, retratos, mapas dibujados a mano o cualquier cosa que quieras tener a mano.</p>
      <button class="btn-primario" id="galeria-primera"><span data-icono="mas"></span> Añadir la primera</button>
    </div>`}
  </section>`;

  const abrir = () => galeriaAnadirImagenes();
  qs("#galeria-anadir")?.addEventListener("click", abrir);
  qs("#galeria-primera")?.addEventListener("click", abrir);

  // [UNDAVAR-PARTE-10.11-GALERIA] Abrir y borrar desde la rejilla
  qsa("[data-galeria-ver]").forEach(btn => btn.addEventListener("click", () => {
    galeriaAbrirVisor(imagenes, btn.dataset.galeriaVer);
  }));
  qsa("[data-galeria-borrar]").forEach(btn => btn.addEventListener("click", async () => {
    const img = imagenes.find(i => i.id === btn.dataset.galeriaBorrar);
    if (!img) return;
    const ok = await confirmarAccion("Quitar imagen", `Se quitará «${img.nombre}» de la galería.\nSi algún pin la usa, dejará de mostrarla.`, "Quitar");
    if (!ok) return;
    await dbDelete("galeria", img.id);
    await galeriaLiberarPin(img.id);
    render();
  }));
}

// [UNDAVAR-PARTE-10.11-GALERIA] Al borrar una imagen, se desvincula de su pin
async function galeriaLiberarPin(imagenId) {
  const cfg = await dbGetConfig(MAPA_CONFIG_KEY, null);
  if (!cfg || !Array.isArray(cfg.pines)) return;
  let tocado = false;
  for (const p of cfg.pines) {
    if (p?.imagenId === imagenId) { p.imagenId = ""; tocado = true; }
  }
  if (tocado) await dbSetConfig(MAPA_CONFIG_KEY, cfg);
}

// [UNDAVAR-PARTE-8-MAPA] Vista de mapa, pines y vínculos
// ============================================================
const MAPA_CONFIG_KEY = "mapa-pines";
const MAPA_IMAGEN_ANCHO = 8192;
const MAPA_IMAGEN_ALTO = 4368;
const MAPA_COLORES = ["#c9a227", "#8b2e2e", "#7a9a5c", "#4a6fa5", "#8a5cb0", "#c2703d"];
// [UNDAVAR-PARTE-8B-GEO] Posición normalizada de cada Eslava sobre la imagen del mapa
const MAPA_POSICIONES_ESLAVAS = {
  Rehi: [0.2450, 0.1395], Kafel: [0.2610, 0.2745], Oqiura: [0.3220, 0.0350], Yed: [0.1370, 0.2390],
  Tresmina: [0.5515, 0.4540], Faria: [0.4440, 0.3000], Zeiwel: [0.4170, 0.1010], Doruval: [0.6190, 0.2155],
  Jasmin: [0.6080, 0.6565], Rousar: [0.6440, 0.7840], Peestal: [0.7850, 0.8265], Heisralwed: [0.5530, 0.7755], Gaster: [0.6970, 0.6140],
  Weismel: [0.3690, 0.3430], Ahdal: [0.4410, 0.4660], Toronomo: [0.4550, 0.6150],
  Ahdel: [0.1250, 0.3900], Mosfortil: [0.2160, 0.6010], Utgara: [0.1490, 0.7500], Senal: [0.2240, 0.4160],
  Nimeriam: [0.3130, 0.4400], Qisterl: [0.2710, 0.5280], Westernel: [0.3990, 0.6150],
  Tasla: [0.7170, 0.1790], Eisira: [0.8125, 0.5105], Eslara: [0.7720, 0.0530], Bosminal: [0.6940, 0.3770], Asnar: [0.8670, 0.3210],
};
// [UNDAVAR-PARTE-8B-GEO] Las 28 Eslavas salen de GEOGRAFIA_UNDAVAR (rules.js)
const MAPA_ESLAVAS = (typeof GEOGRAFIA_UNDAVAR !== "undefined" ? GEOGRAFIA_UNDAVAR : []).flatMap(enwe =>
  (enwe.eslavas || []).map(e => ({
    nombre: e.nombre, tipo: e.tipo, enwes: enwe.enwes, region: enwe.region,
    x: MAPA_POSICIONES_ESLAVAS[e.nombre]?.[0] ?? 0.5,
    y: MAPA_POSICIONES_ESLAVAS[e.nombre]?.[1] ?? 0.5,
  }))
).filter(e => MAPA_POSICIONES_ESLAVAS[e.nombre]);
const MAPA_VISTAS = {
  personajes: { vista: "ficha", idKey: "personajeId", etiqueta: "PJ", abrir: "Abrir ficha" },
  npcs: { vista: "npc", idKey: "npcId", etiqueta: "PNJ", abrir: "Abrir ficha" },
  tiendas: { vista: "tienda", idKey: "tiendaId", etiqueta: "Tienda", abrir: "Abrir tienda" },
};

const mapa = {
  pines: [],
  // [UNDAVAR-PARTE-10.11.3-PIN-FOTO] Imágenes de la galería disponibles en el mapa
  galeria: [],
  vinculos: { personajes: [], npcs: [], tiendas: [] },
  personajes: [],
  vistaEl: null, escenario: null, lienzo: null,
  escW: 0, escH: 0, baseW: 0, baseH: 0,
  x: 0, y: 0, zoom: 1, minZoom: 1, maxZoom: 8,
  seleccionado: null, eslavaSel: null, tab: "pines", filtro: "", colocando: false,
  punteros: new Map(), arrastre: null, pinch: null, moverPin: null,
  ignorarClic: false, observador: null, pantallaFallback: false,
};

function mapaNormalizarTexto(t) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// [UNDAVAR-PARTE-8B-GEO] Eslava más cercana a un punto (para sugerir la zona del pin)
function mapaEslavaCercana(x, y) {
  let mejor = null;
  let distancia = Infinity;
  for (const e of MAPA_ESLAVAS) {
    const dx = (x - e.x) * MAPA_IMAGEN_ANCHO;
    const dy = (y - e.y) * MAPA_IMAGEN_ALTO;
    const d = dx * dx + dy * dy;
    if (d < distancia) { distancia = d; mejor = e; }
  }
  return mejor;
}

function mapaZonaValida(enwes, eslava) {
  return MAPA_ESLAVAS.some(e => e.enwes === enwes && e.nombre === eslava);
}

function mapaNormalizarPin(p, indice) {
  if (!p || typeof p !== "object") return null;
  const numero = (v, def) => Number.isFinite(Number(v)) ? Number(v) : def;
  const x = Math.min(1, Math.max(0, numero(p.x, 0.5)));
  const y = Math.min(1, Math.max(0, numero(p.y, 0.5)));
  const cercana = mapaEslavaCercana(x, y);
  const zonaOk = mapaZonaValida(p.enwes, p.eslava);
  // [UNDAVAR-PARTE-9.4-REFUGIOS] Nivel de refugio, daño y constructor
  const nivel = Math.max(0, Math.min(6, Number(p.refugio?.nivel) || 0));
  const refugio = nivel && REFUGIOS_UNDAVAR[nivel]
    ? {
      nivel,
      construido: !!p.refugio?.construido,
      dano: Math.min(REFUGIOS_UNDAVAR[nivel].danoMax, Math.max(0, Number(p.refugio?.dano) || 0)),
      constructor: typeof p.refugio?.constructor === "string" ? p.refugio.constructor : "",
      descansan: Array.isArray(p.refugio?.descansan) ? p.refugio.descansan.filter(x => typeof x === "string") : [],
    }
    : null;
  return {
    id: typeof p.id === "string" && p.id ? p.id : nuevoId(),
    nombre: String(p.nombre || "").trim().slice(0, 80) || "Lugar sin nombre",
    x, y,
    enwes: zonaOk ? p.enwes : (cercana?.enwes || ""),
    eslava: zonaOk ? p.eslava : (cercana?.nombre || ""),
    color: MAPA_COLORES.includes(p.color) ? p.color : MAPA_COLORES[indice % MAPA_COLORES.length],
    nota: String(p.nota || "").slice(0, 600),
    store: MAPA_VISTAS[p.store] ? p.store : "",
    refId: typeof p.refId === "string" ? p.refId : "",
    // [UNDAVAR-PARTE-10.11.2-PIN-IMAGEN] Un pin muestra como mucho una imagen de la galería
    imagenId: typeof p.imagenId === "string" ? p.imagenId : "",
    refugio,
  };
}

async function cargarMapa() {
  const [cfg, pjs, npcs, tiendas, galeria] = await Promise.all([
    dbGetConfig(MAPA_CONFIG_KEY, null),
    dbGetAll("personajes"),
    dbGetAll("npcs"),
    dbGetAll("tiendas"),
    // [UNDAVAR-PARTE-10.11.3-PIN-FOTO] Imágenes para mostrar la de cada pin
    dbGetAll("galeria"),
  ]);
  mapa.galeria = galeria;
  const crudos = Array.isArray(cfg?.pines) ? cfg.pines : [];
  mapa.pines = crudos.map(mapaNormalizarPin).filter(Boolean);
  const simple = (lista, soloReales = false) => (soloReales ? soloPersonajesReales(lista) : lista)
    .map(a => ({ id: a.id, nombre: a.nombre || "Sin nombre" }));
  mapa.vinculos = {
    personajes: simple(pjs, true),
    npcs: simple(npcs, true),
    tiendas: simple(tiendas),
  };
  // [UNDAVAR-PARTE-9.4-REFUGIOS] Inventarios completos para contar materiales
  mapa.personajes = soloPersonajesReales(pjs);
}

async function guardarPinesMapa() {
  await dbSetConfig(MAPA_CONFIG_KEY, { pines: mapa.pines });
}

function mapaMedirBase() {
  const esc = mapa.escenario;
  if (!esc) return;
  const rect = esc.getBoundingClientRect();
  mapa.escW = Math.max(1, rect.width);
  mapa.escH = Math.max(1, rect.height);
  const escala = Math.min(mapa.escW / MAPA_IMAGEN_ANCHO, mapa.escH / MAPA_IMAGEN_ALTO);
  mapa.baseW = MAPA_IMAGEN_ANCHO * escala;
  mapa.baseH = MAPA_IMAGEN_ALTO * escala;
}

function mapaLimitarVista() {
  mapa.zoom = Math.min(mapa.maxZoom, Math.max(mapa.minZoom, mapa.zoom));
  const ancho = mapa.baseW * mapa.zoom;
  const alto = mapa.baseH * mapa.zoom;
  mapa.x = ancho <= mapa.escW
    ? (mapa.escW - ancho) / 2
    : Math.min(0, Math.max(mapa.escW - ancho, mapa.x));
  mapa.y = alto <= mapa.escH
    ? (mapa.escH - alto) / 2
    : Math.min(0, Math.max(mapa.escH - alto, mapa.y));
}

function mapaAplicarVista() {
  if (!mapa.lienzo) return;
  mapaLimitarVista();
  mapa.lienzo.style.width = `${mapa.baseW}px`;
  mapa.lienzo.style.height = `${mapa.baseH}px`;
  mapa.lienzo.style.transform = `translate(${mapa.x}px, ${mapa.y}px) scale(${mapa.zoom})`;
  mapa.lienzo.style.setProperty("--mapa-zoom", String(mapa.zoom));
}

function mapaEncajar() {
  mapa.zoom = 1;
  mapa.x = (mapa.escW - mapa.baseW) / 2;
  mapa.y = (mapa.escH - mapa.baseH) / 2;
  mapaAplicarVista();
}

function mapaPuntoCentro() {
  if (!mapa.baseW || !mapa.baseH) return null;
  return {
    nx: (mapa.escW / 2 - mapa.x) / (mapa.baseW * mapa.zoom),
    ny: (mapa.escH / 2 - mapa.y) / (mapa.baseH * mapa.zoom),
  };
}

function mapaZoomEn(nuevoZoom, px, py) {
  const esc = mapa.escenario;
  if (!esc) return;
  const rect = esc.getBoundingClientRect();
  const x = Number.isFinite(px) ? px : rect.width / 2;
  const y = Number.isFinite(py) ? py : rect.height / 2;
  const z = Math.min(mapa.maxZoom, Math.max(mapa.minZoom, nuevoZoom));
  const wx = (x - mapa.x) / mapa.zoom;
  const wy = (y - mapa.y) / mapa.zoom;
  mapa.zoom = z;
  mapa.x = x - wx * z;
  mapa.y = y - wy * z;
  mapaAplicarVista();
}

function mapaCentrarEnPunto(x, y, zoomMin = 1.8) {
  if (!mapa.lienzo) return;
  const zoom = Math.max(mapa.zoom, zoomMin);
  mapa.zoom = zoom;
  mapa.x = mapa.escW / 2 - x * mapa.baseW * zoom;
  mapa.y = mapa.escH / 2 - y * mapa.baseH * zoom;
  mapaAplicarVista();
}

function mapaCentrarEn(pin) {
  if (!pin) return;
  mapaCentrarEnPunto(pin.x, pin.y);
}

function mapaResolverVinculo(pin) {
  if (!pin || !pin.store || !pin.refId) return null;
  const def = MAPA_VISTAS[pin.store];
  if (!def) return null;
  const entidad = (mapa.vinculos[pin.store] || []).find(e => e.id === pin.refId);
  if (!entidad) return null;
  return { ...def, nombre: entidad.nombre };
}

// [UNDAVAR-PARTE-10.11.3-PIN-FOTO] Imagen de la galería asociada a un pin
function mapaImagenPin(pin) {
  if (!pin?.imagenId) return null;
  return (mapa.galeria || []).find(g => g.id === pin.imagenId) || null;
}

// [UNDAVAR-PARTE-10.11.3B-AVANCE-PIN] Tarjeta flotante con la imagen del pin
function mapaOcultarAvancePin() {
  document.querySelector(".mapa-pin-avance")?.remove();
}

function mapaMostrarAvancePin(pin, el) {
  const foto = mapaImagenPin(pin);
  if (!foto) { mapaOcultarAvancePin(); return; }
  let caja = document.querySelector(".mapa-pin-avance");
  if (!caja) {
    caja = document.createElement("div");
    caja.className = "mapa-pin-avance visible";
    contenedorOverlays().appendChild(caja);
  }
  if (caja.dataset.pin !== pin.id) {
    caja.dataset.pin = pin.id;
    caja.innerHTML = `<img src="${esc(foto.data)}" alt="">
      <span>${esc(foto.nombre)}</span>`;
  }
  const rect = el.getBoundingClientRect();
  caja.style.left = `${rect.left + rect.width / 2}px`;
  caja.style.top = `${rect.top}px`;
  caja.style.transform = "translate(-50%, -100%) translateY(-10px)";
  // [UNDAVAR-PARTE-10.11.3B-AVANCE-PIN] Si no cabe arriba, se muestra debajo del pin
  if (rect.top - caja.offsetHeight - 14 < 8) {
    caja.style.top = `${rect.bottom}px`;
    caja.style.transform = "translate(-50%, 0) translateY(10px)";
  }
}

function mapaPinHTML(pin) {
  const activo = pin.id === mapa.seleccionado ? " activo" : "";
  // [UNDAVAR-PARTE-10.11.3B-AVANCE-PIN] La imagen se muestra al pasar el ratón, no en el pin
  const conFoto = mapaImagenPin(pin) ? " con-foto" : "";
  return `<button type="button" class="mapa-pin${activo}${conFoto}" data-pin="${esc(pin.id)}"
      style="left:${(pin.x * 100).toFixed(4)}%;top:${(pin.y * 100).toFixed(4)}%;--pin-color:${esc(pin.color)}"
      title="${esc(pin.nombre)}" aria-label="Pin: ${esc(pin.nombre)}">
      <span class="mapa-pin-globo"></span>
      <span class="mapa-pin-etiqueta">${esc(pin.nombre)}</span>
    </button>`;
}

function renderMapaPines() {
  // [UNDAVAR-PARTE-10.11.3B-AVANCE-PIN] La tarjeta flotante no debe quedar huérfana
  mapaOcultarAvancePin();
  const cont = document.getElementById("mapa-pines");
  if (cont) cont.innerHTML = mapa.pines.map(mapaPinHTML).join("");
}

// [UNDAVAR-PARTE-8B-GEO] Marcadores de Eslava con su etiqueta y número de pines
function mapaEslavaHTML(e) {
  const activo = e.nombre === mapa.eslavaSel ? " activo" : "";
  const num = mapa.pines.filter(p => p.eslava === e.nombre).length;
  return `<button type="button" class="mapa-eslava${activo}" data-eslava="${esc(e.nombre)}"
      style="left:${(e.x * 100).toFixed(4)}%;top:${(e.y * 100).toFixed(4)}%"
      title="${esc(e.nombre)} · ${esc(e.enwes)}" aria-label="Eslava: ${esc(e.nombre)} (${esc(e.enwes)})">
      <span class="mapa-eslava-punto"></span>
      <span class="mapa-eslava-etiqueta">${esc(e.nombre)}${num ? ` · ${num}` : ""}</span>
    </button>`;
}

function renderMapaEslavas() {
  const cont = document.getElementById("mapa-eslavas");
  if (cont) cont.innerHTML = MAPA_ESLAVAS.map(mapaEslavaHTML).join("");
}

function mapaMarcarSeleccion() {
  qsa(".mapa-pin").forEach(el => {
    el.classList.toggle("activo", el.dataset.pin === mapa.seleccionado);
  });
  qsa(".mapa-eslava").forEach(el => {
    el.classList.toggle("activo", el.dataset.eslava === mapa.eslavaSel);
  });
}

// [UNDAVAR-PARTE-9.4-REFUGIOS] Materiales de construcción por tipo en una ficha
function mapaMaterialesPJ(pj) {
  const disp = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const it of (pj?.items || [])) {
    const nombre = String(it.name || "").trim();
    for (const [tipo, def] of Object.entries(MATERIALES_REFUGIO)) {
      if (nombre === def.generico || def.nombres.includes(nombre)) {
        disp[tipo] += Math.max(1, Number(it.system?.cantidad) || 1);
      }
    }
  }
  return disp;
}

// [UNDAVAR-PARTE-9.4-REFUGIOS] Descuenta los materiales del inventario del constructor
function mapaConsumirMateriales(pj, requeridos) {
  if (!Array.isArray(pj.items)) return;
  for (const [tipo, cantidad] of Object.entries(requeridos)) {
    const def = MATERIALES_REFUGIO[tipo];
    let falta = Number(cantidad) || 0;
    // Primero los elementos genéricos del tipo, después las maderas y metales
    const candidatos = pj.items
      .map((it, indice) => ({ it, indice }))
      .filter(({ it }) => {
        const nombre = String(it.name || "").trim();
        return nombre === def.generico || def.nombres.includes(nombre);
      })
      .sort((a, b) => {
        const ga = a.it.name === def.generico ? 0 : 1;
        const gb = b.it.name === def.generico ? 0 : 1;
        return ga - gb;
      });
    for (const { it } of candidatos) {
      if (falta <= 0) break;
      const tiene = Math.max(1, Number(it.system?.cantidad) || 1);
      const usa = Math.min(tiene, falta);
      const resto = tiene - usa;
      falta -= usa;
      if (resto > 0) {
        it.system = it.system || {};
        it.system.cantidad = resto;
      } else {
        it.system = it.system || {};
        it.system.cantidad = 0;
      }
    }
  }
  // [UNDAVAR-PARTE-9.5B-MATERIALES] Quita del inventario las pilas que quedaron a cero
  pj.items = pj.items.filter(it => it.system?.cantidad === undefined || Number(it.system.cantidad) > 0);
}

// [UNDAVAR-PARTE-9.4-REFUGIOS] Panel del refugio dentro del detalle del pin
function mapaRefugioHTML(pin) {
  const r = pin.refugio;
  if (!r) return "";
  const def = REFUGIOS_UNDAVAR[r.nivel];
  if (!def) return "";
  const pjs = mapa.personajes || [];
  const constructor = pjs.find(p => p.id === r.constructor) || pjs[0] || null;
  const disp = mapaMaterialesPJ(constructor);
  const faltan = Object.entries(def.materiales).filter(([t, n]) => (disp[t] || 0) < n);
  const puedeConstruir = !!constructor && !faltan.length;

  const selector = pjs.length
    ? `<div class="campo-fila refugio-constructor-fila">
        <label>Constructor</label>
        <select data-refugio-constructor>
          ${pjs.map(p => `<option value="${esc(p.id)}" ${p.id === constructor?.id ? "selected" : ""}>${esc(p.nombre || "Sin nombre")}</option>`).join("")}
        </select>
      </div>`
    : `<p class="refugio-aviso">Crea una ficha de personaje para construir o reparar.</p>`;

  const materiales = Object.entries(def.materiales).map(([tipo, n]) => {
    const hay = disp[tipo] || 0;
    return `<div class="refugio-mat ${hay >= n ? "ok" : "falta"}"><span>Tipo ${tipo}</span><b>${hay} / ${n}</b></div>`;
  }).join("");

  const efectos = `Soporta ${def.danoMax} pts de daño. Reparación: ${def.reparar.puntos} pts con +${def.reparar.aciertos} acierto${def.reparar.aciertos === 1 ? "" : "s"}. Construcción: ${def.tiempo}.`;
  const estados = def.estados
    ? `Cura ${def.estados} pt${def.estados === 1 ? "" : "s"} de estados negativos por turno (hambre, sed, cansancio, fatiga).`
    : "No cura estados negativos.";

  const construir = `
    <div class="refugio-materiales">${materiales}</div>
    <button type="button" class="btn-primario chico" data-accion="refugio-construir" ${puedeConstruir ? "" : "disabled"}>🏠 Construir refugio</button>
    <p class="refugio-hint">${faltan.length ? "Faltan materiales del constructor elegido." : "Se descontarán del inventario del constructor."}</p>`;

  const construido = `
    <div class="refugio-dano-fila">
      <label>Daño</label>
      <input type="number" data-refugio-dano-input min="0" max="${def.danoMax}" value="${r.dano}">
      <button type="button" class="btn-secundario chico" data-accion="refugio-dano">Registrar</button>
      <span class="refugio-dano-texto">${r.dano} / ${def.danoMax}</span>
    </div>
    <button type="button" class="btn-secundario chico" data-accion="refugio-reparar">🔨 Reparar (4d6, +${def.reparar.aciertos} aciertos)</button>
    <div class="refugio-descanso">
      <span class="refugio-sub">Descansan aquí</span>
      ${pjs.length
        ? pjs.map(p => `<label class="check-inline"><input type="checkbox" data-refugio-descansa="${esc(p.id)}" ${r.descansan.includes(p.id) ? "checked" : ""}> ${esc(p.nombre || "Sin nombre")}</label>`).join("")
        : `<p class="refugio-hint">Sin personajes.</p>`}
      <button type="button" class="btn-secundario chico" data-accion="refugio-turno" ${def.estados ? "" : "disabled"}>🌙 Pasar turno</button>
    </div>`;

  return `<div class="refugio-panel">
      <div class="refugio-cab">
        <strong>Refugio de nivel ${r.nivel}</strong>
        <span class="refugio-estado ${r.construido ? "ok" : ""}">${r.construido ? "En pie" : "Sin construir"}</span>
      </div>
      <p class="refugio-efecto">${efectos}</p>
      ${selector}
      ${r.construido ? construido : construir}
      <p class="refugio-hint">${estados}${def.extra ? ` ${def.extra}` : ""}</p>
    </div>`;
}

function mapaDetalleHTML(pin) {
  const vinculo = mapaResolverVinculo(pin);
  // [UNDAVAR-PARTE-10.11.3-PIN-FOTO] Imagen del pin, si la tiene
  const foto = mapaImagenPin(pin);
  return `<div class="mapa-detalle">
      <div class="mapa-detalle-cabecera">
        <span class="mapa-fila-punto" style="--pin-color:${esc(pin.color)}"></span>
        <strong>${esc(pin.nombre)}</strong>
      </div>
      <div class="mapa-detalle-zona">${esc(pin.enwes || "Sin Enwes")} · ${esc(pin.eslava || "Sin Eslava")}</div>
      <div class="mapa-detalle-vinculo">${vinculo
        ? `${esc(vinculo.etiqueta)} · ${esc(vinculo.nombre)}`
        : "Sin vínculo"}</div>
      ${foto ? `<button type="button" class="mapa-detalle-foto" data-accion="ver-imagen" title="Ver ${esc(foto.nombre)}">
        <img src="${esc(foto.data)}" alt="${esc(foto.nombre)}" loading="lazy">
        <span class="mapa-detalle-foto-pie">${esc(foto.nombre)}</span>
      </button>` : ""}
      ${pin.refugio ? mapaRefugioHTML(pin) : ""}
      ${pin.nota ? `<p class="mapa-detalle-nota">${esc(pin.nota)}</p>` : ""}
      <div class="mapa-detalle-acciones">
        ${vinculo ? `<button type="button" class="btn-primario chico" data-accion="abrir">${esc(vinculo.abrir)}</button>` : ""}
        <button type="button" class="btn-secundario chico" data-accion="centrar">Centrar</button>
        <button type="button" class="btn-secundario chico" data-accion="editar">Editar</button>
        <button type="button" class="btn-peligro chico" data-accion="borrar">Borrar</button>
      </div>
    </div>`;
}

// [UNDAVAR-PARTE-8B-GEO] Detalle de la Eslava y lista de sus pines
function mapaDetalleEslavaHTML(e) {
  const pines = mapa.pines.filter(p => p.eslava === e.nombre);
  return `<div class="mapa-detalle">
      <div class="mapa-detalle-cabecera">
        <span class="mapa-eslava-marca"></span>
        <strong>${esc(e.nombre)}</strong>
      </div>
      <div class="mapa-detalle-zona">${esc(e.enwes)} · ${esc(e.region)}</div>
      <div class="mapa-detalle-vinculo">${esc(e.tipo)} · ${pines.length} pin${pines.length === 1 ? "" : "es"}</div>
      <div class="mapa-detalle-acciones">
        <button type="button" class="btn-primario chico" data-eslava-accion="anadir">Añadir pin aquí</button>
        <button type="button" class="btn-secundario chico" data-eslava-accion="centrar">Centrar</button>
      </div>
      ${pines.length ? `<div class="mapa-lista">${pines.map(pin => `
        <button type="button" class="mapa-fila" data-pin="${esc(pin.id)}">
          <span class="mapa-fila-punto" style="--pin-color:${esc(pin.color)}"></span>
          <span class="mapa-fila-texto"><strong>${esc(pin.nombre)}</strong><small>${esc(pin.nota || "Sin nota")}</small></span>
        </button>`).join("")}</div>` : ""}
    </div>`;
}

function renderMapaPestanas() {
  const pines = document.getElementById("mapa-tab-pines");
  const eslavas = document.getElementById("mapa-tab-eslavas");
  if (pines) {
    pines.textContent = `Pines (${mapa.pines.length})`;
    pines.classList.toggle("activa", mapa.tab === "pines");
    pines.setAttribute("aria-selected", String(mapa.tab === "pines"));
  }
  if (eslavas) {
    eslavas.textContent = `Eslavas (${MAPA_ESLAVAS.length})`;
    eslavas.classList.toggle("activa", mapa.tab === "eslavas");
    eslavas.setAttribute("aria-selected", String(mapa.tab === "eslavas"));
  }
}

// [UNDAVAR-PARTE-8B-GEO] Lista de Eslavas agrupada por Enwes
function mapaListaEslavasHTML() {
  const filtro = mapaNormalizarTexto(mapa.filtro);
  let total = 0;
  const grupos = (typeof GEOGRAFIA_UNDAVAR !== "undefined" ? GEOGRAFIA_UNDAVAR : []).map(enwe => {
    const eslavas = MAPA_ESLAVAS
      .filter(e => e.enwes === enwe.enwes)
      .filter(e => !filtro || mapaNormalizarTexto(`${e.nombre} ${e.enwes} ${e.region} ${e.tipo}`).includes(filtro));
    total += eslavas.length;
    if (!eslavas.length) return "";
    return `<div class="mapa-grupo">
        <div class="mapa-grupo-titulo"><span>${esc(enwe.enwes)}</span><small>${esc(enwe.region)}</small></div>
        ${eslavas.map(e => {
          const num = mapa.pines.filter(p => p.eslava === e.nombre).length;
          return `<button type="button" class="mapa-fila${e.nombre === mapa.eslavaSel ? " activo" : ""}" data-eslava="${esc(e.nombre)}">
              <span class="mapa-eslava-marca"></span>
              <span class="mapa-fila-texto"><strong>${esc(e.nombre)}</strong><small>${esc(e.tipo)} · ${num} pin${num === 1 ? "" : "es"}</small></span>
            </button>`;
        }).join("")}
      </div>`;
  }).join("");

  return `${mapa.eslavaSel ? mapaDetalleEslavaHTML(MAPA_ESLAVAS.find(e => e.nombre === mapa.eslavaSel)) : ""}
    <div class="mapa-panel-titulo"><span>Eslavas (${total})</span></div>
    ${grupos || `<div class="mapa-vacio">Ninguna Eslava coincide con la búsqueda.</div>`}`;
}

function renderMapaPanel() {
  const cuerpo = document.getElementById("mapa-panel-cuerpo");
  if (!cuerpo) return;
  renderMapaPestanas();
  if (mapa.tab === "eslavas") {
    cuerpo.innerHTML = mapaListaEslavasHTML();
    return;
  }
  const seleccionado = mapa.pines.find(p => p.id === mapa.seleccionado) || null;
  const filtro = mapaNormalizarTexto(mapa.filtro);
  const lista = mapa.pines
    .filter(p => !filtro || mapaNormalizarTexto(`${p.nombre} ${p.nota} ${p.enwes} ${p.eslava}`).includes(filtro))
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  cuerpo.innerHTML = `
    ${seleccionado ? mapaDetalleHTML(seleccionado) : ""}
    <div class="mapa-panel-titulo"><span>Pines (${lista.length})</span></div>
    <div class="mapa-lista">
      ${lista.length ? lista.map(pin => {
        const vinculo = mapaResolverVinculo(pin);
        const zona = `${pin.enwes || "Sin Enwes"} · ${pin.eslava || "Sin Eslava"}`;
        const refugioTxt = pin.refugio ? `Refugio nv. ${pin.refugio.nivel}${pin.refugio.construido ? "" : " (sin construir)"} · ` : "";
        const sub = refugioTxt + (vinculo ? `${zona} · ${vinculo.etiqueta}` : (pin.nota || zona));
        return `<button type="button" class="mapa-fila${pin.id === mapa.seleccionado ? " activo" : ""}" data-pin="${esc(pin.id)}">
            <span class="mapa-fila-punto" style="--pin-color:${esc(pin.color)}"></span>
            <span class="mapa-fila-texto"><strong>${esc(pin.nombre)}</strong><small>${esc(sub)}</small></span>
          </button>`;
      }).join("") : `<div class="mapa-vacio">${mapa.pines.length
        ? "Ningún pin coincide con la búsqueda."
        : "Todavía no hay pines. Pulsa «Añadir pin» y toca el mapa para colocar el primero."}</div>`}
    </div>`;
}

function mapaSeleccionar(id, { centrar = false } = {}) {
  mapa.seleccionado = id;
  mapa.eslavaSel = null;
  mapa.tab = "pines";
  // [UNDAVAR-PARTE-8B-GEO] Seleccionar algo cancela el modo de colocación
  if (mapa.colocando) { mapa.colocando = false; actualizarModoColocacion(); }
  mapaMarcarSeleccion();
  renderMapaPanel();
  if (centrar) {
    const pin = mapa.pines.find(p => p.id === id);
    if (pin) mapaCentrarEn(pin);
  }
}

// [UNDAVAR-PARTE-8B-GEO] Selección de una Eslava desde el marcador o la lista
function mapaSeleccionarEslava(nombre, { centrar = false } = {}) {
  const e = MAPA_ESLAVAS.find(x => x.nombre === nombre);
  if (!e) return;
  mapa.eslavaSel = nombre;
  mapa.seleccionado = null;
  mapa.tab = "eslavas";
  if (mapa.colocando) { mapa.colocando = false; actualizarModoColocacion(); }
  mapaMarcarSeleccion();
  renderMapaPanel();
  if (centrar) mapaCentrarEnPunto(e.x, e.y, 2.4);
}

function actualizarModoColocacion() {
  const esc = mapa.escenario;
  if (esc) esc.classList.toggle("colocando", mapa.colocando);
  const btn = document.getElementById("mapa-btn-anadir");
  const texto = document.getElementById("mapa-btn-anadir-texto");
  const ayuda = document.getElementById("mapa-ayuda");
  if (btn) btn.classList.toggle("activo", mapa.colocando);
  if (texto) texto.textContent = mapa.colocando ? "Colocando…" : "Añadir pin";
  if (ayuda) ayuda.textContent = mapa.colocando
    ? "Toca el mapa para colocar el nuevo pin."
    : "Arrastra para mover · Rueda o pellizco para acercar · Clic derecho o doble clic para añadir un pin";
}

function mapaAlternarColocacion() {
  mapa.colocando = !mapa.colocando;
  actualizarModoColocacion();
}

function mapaOpcionesVinculo(store, refId = "") {
  const def = MAPA_VISTAS[store];
  if (!def) return `<option value="">—</option>`;
  const lista = (mapa.vinculos[store] || []).slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  if (!lista.length) return `<option value="">Sin registros</option>`;
  return `<option value="">Sin vincular</option>` + lista.map(e =>
    `<option value="${esc(e.id)}"${e.id === refId ? " selected" : ""}>${esc(e.nombre)}</option>`
  ).join("");
}

// Editor de un pin: nuevo (con coordenadas) o existente
function abrirEditorPin(pin = null, coords = null) {
  const esNuevo = !pin;
  const zona = pin ? null : mapaEslavaCercana(coords?.x ?? 0.5, coords?.y ?? 0.5);
  const base = pin
    ? { ...pin }
    : {
      id: nuevoId(),
      nombre: "",
      x: coords?.x ?? 0.5,
      y: coords?.y ?? 0.5,
      enwes: zona?.enwes || "",
      eslava: zona?.nombre || "",
      color: MAPA_COLORES[mapa.pines.length % MAPA_COLORES.length],
      nota: "",
      store: "",
      refId: "",
      // [UNDAVAR-PARTE-10.11.2-PIN-IMAGEN] Imagen de la galería asociada al pin
      imagenId: "",
    };

  const fondo = document.createElement("div");
  fondo.className = "modal-fondo modal-pin-fondo";
  fondo.innerHTML = `
    <div class="modal-caja modal-pin" role="dialog" aria-modal="true" aria-labelledby="pin-titulo">
      <div class="modal-header">
        <h3 id="pin-titulo">${esNuevo ? "Nuevo pin" : "Editar pin"}</h3>
        <button class="modal-cerrar" type="button" aria-label="Cerrar" data-pin-cerrar>✕</button>
      </div>
      <div class="modal-cuerpo">
        <div class="campo-fila">
          <label for="pin-nombre">Nombre del lugar</label>
          <input type="text" id="pin-nombre" maxlength="80" value="${esc(base.nombre)}" placeholder="Ej.: Puerto de las Nieblas">
        </div>
        <!-- [UNDAVAR-PARTE-8B-GEO] Enwes y Eslava del punto marcado -->
        <div class="campo-fila">
          <label>Zona del mapa</label>
          <div class="pin-zona-grid">
            <select id="pin-enwes" aria-label="Enwes"></select>
            <select id="pin-eslava" aria-label="Eslava"></select>
          </div>
          <div class="campo-ayuda">Se sugiere la Eslava más cercana; puedes cambiarla. El nombre propio del sitio va arriba.</div>
        </div>
        <div class="campo-fila">
          <label>Color del pin</label>
          <div class="pin-colores">
            ${MAPA_COLORES.map(c => `
              <label class="pin-color-opcion" title="${esc(c)}">
                <input type="radio" name="pin-color" value="${esc(c)}"${c === base.color ? " checked" : ""}>
                <span style="--pin-color:${esc(c)}"></span>
              </label>`).join("")}
          </div>
        </div>
        <div class="campo-fila">
          <label for="pin-nota">Nota</label>
          <textarea id="pin-nota" maxlength="600" placeholder="Qué hay aquí, quién vive, qué se puede comprar…">${esc(base.nota)}</textarea>
        </div>
        <!-- [UNDAVAR-PARTE-10.11.2-PIN-IMAGEN] Imagen única del pin, desde la galería o cargada aquí -->
        <div class="campo-fila">
          <label>Imagen del pin</label>
          <div class="pin-imagen-caja">
            <div class="pin-imagen-vista" id="pin-imagen-vista"></div>
            <div class="pin-imagen-acciones">
              <button type="button" class="btn-secundario chico" id="pin-imagen-elegir"><span data-icono="galeria"></span> Elegir de la galería</button>
              <button type="button" class="btn-secundario chico" id="pin-imagen-subir"><span data-icono="mas"></span> Cargar imagen</button>
              <button type="button" class="btn-secundario chico" id="pin-imagen-quitar"><span data-icono="borrar"></span> Quitar</button>
            </div>
          </div>
          <div class="campo-ayuda">Una sola imagen por pin. Si cargas una nueva, también queda guardada en la galería.</div>
        </div>
        <!-- [UNDAVAR-PARTE-9.4-REFUGIOS] Nivel de refugio del pin -->
        <div class="campo-fila">
          <label for="pin-refugio">Refugio (opcional)</label>
          <select id="pin-refugio">
            <option value="0">No es un refugio</option>
            ${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}"${(base.refugio?.nivel || 0) === n ? " selected" : ""}>Nivel ${n} · ${REFUGIOS_UNDAVAR[n].danoMax} pts de daño</option>`).join("")}
          </select>
          <div class="campo-ayuda">Si es un refugio, podrás construir, dañar y reparar desde su detalle en el mapa.</div>
        </div>
        <div class="campo-fila">
          <label>Vínculo (opcional)</label>
          <div class="pin-vinculo-grid">
            <select id="pin-store" aria-label="Tipo de vínculo">
              <option value="">Sin vínculo</option>
              <option value="personajes"${base.store === "personajes" ? " selected" : ""}>Personaje (PJ)</option>
              <option value="npcs"${base.store === "npcs" ? " selected" : ""}>PNJ o bestia</option>
              <option value="tiendas"${base.store === "tiendas" ? " selected" : ""}>Tienda</option>
            </select>
            <select id="pin-ref" aria-label="Registro vinculado"></select>
          </div>
          <div class="campo-ayuda">Si vinculas el pin, podrás abrir la ficha desde el mapa.</div>
        </div>
        <div class="modal-acciones pin-modal-acciones">
          ${esNuevo ? "" : `<button type="button" class="btn-peligro" id="pin-borrar">Borrar pin</button>`}
          <span class="pin-modal-der">
            <button type="button" class="btn-secundario" id="pin-cancelar">Cancelar</button>
            <button type="button" class="btn-primario" id="pin-guardar">Guardar pin</button>
          </span>
        </div>
      </div>
    </div>`;
  contenedorOverlays().appendChild(fondo);
  pintarIconos(fondo);

  const nombreInput = fondo.querySelector("#pin-nombre");
  const notaInput = fondo.querySelector("#pin-nota");
  const storeSel = fondo.querySelector("#pin-store");
  const refSel = fondo.querySelector("#pin-ref");
  const enwesSel = fondo.querySelector("#pin-enwes");
  const eslavaSel = fondo.querySelector("#pin-eslava");

  // [UNDAVAR-PARTE-10.11.2-PIN-IMAGEN] Imagen del pin: se confirma al guardar
  let pinImagenId = base.imagenId || "";
  const vistaImagen = fondo.querySelector("#pin-imagen-vista");
  const quitarImagen = fondo.querySelector("#pin-imagen-quitar");

  const pintarImagenPin = async () => {
    let imagen = pinImagenId ? await dbGet("galeria", pinImagenId) : null;
    // Si la imagen ya no existe, el pin se queda sin imagen
    if (pinImagenId && !imagen) pinImagenId = "";
    if (!imagen) {
      vistaImagen.innerHTML = `<span class="pin-imagen-vacia">Sin imagen</span>`;
      quitarImagen.disabled = true;
      return;
    }
    vistaImagen.innerHTML = `<img src="${esc(imagen.data)}" alt="${esc(imagen.nombre)}" title="${esc(imagen.nombre)}">`;
    quitarImagen.disabled = false;
  };
  pintarImagenPin();

  fondo.querySelector("#pin-imagen-elegir").addEventListener("click", async () => {
    const eleccion = await galeriaElegirImagen(pinImagenId);
    if (!eleccion) return;
    pinImagenId = eleccion;
    pintarImagenPin();
  });

  fondo.querySelector("#pin-imagen-subir").addEventListener("click", async () => {
    const archivos = await galeriaElegirArchivos({ multiple: false });
    if (!archivos.length) return;
    const creadas = await galeriaGuardarArchivos(archivos);
    if (!creadas.length) return;
    pinImagenId = creadas[0].id;
    pintarImagenPin();
    notificar("Imagen añadida a la galería. Guarda el pin para vincularla.");
  });

  quitarImagen.addEventListener("click", () => {
    pinImagenId = "";
    pintarImagenPin();
  });

  // [UNDAVAR-PARTE-8B-GEO] Enwes y Eslava enlazados en el editor
  const rellenarEslavas = () => {
    const enwes = enwesSel.value;
    const lista = MAPA_ESLAVAS.filter(e => e.enwes === enwes);
    eslavaSel.innerHTML = lista.map(e =>
      `<option value="${esc(e.nombre)}"${e.nombre === base.eslava ? " selected" : ""}>${esc(e.nombre)} · ${esc(e.tipo)}</option>`
    ).join("");
  };
  enwesSel.innerHTML = [...new Set(MAPA_ESLAVAS.map(e => e.enwes))].map(enwes =>
    `<option value="${esc(enwes)}"${enwes === base.enwes ? " selected" : ""}>${esc(enwes)}</option>`
  ).join("");
  if (!base.enwes && enwesSel.options.length) enwesSel.selectedIndex = 0;
  rellenarEslavas();
  if (base.eslava && MAPA_ESLAVAS.some(e => e.enwes === enwesSel.value && e.nombre === base.eslava)) {
    eslavaSel.value = base.eslava;
  }
  enwesSel.addEventListener("change", rellenarEslavas);

  const actualizarRefs = () => {
    const store = storeSel.value;
    refSel.disabled = !store;
    refSel.innerHTML = store ? mapaOpcionesVinculo(store, base.refId) : `<option value="">—</option>`;
  };
  actualizarRefs();

  const cerrar = () => fondo.remove();
  fondo.querySelector("[data-pin-cerrar]").addEventListener("click", cerrar);
  fondo.querySelector("#pin-cancelar").addEventListener("click", cerrar);
  fondo.addEventListener("click", (e) => { if (e.target === fondo) cerrar(); });
  document.addEventListener("keydown", function escapePin(e) {
    if (e.key !== "Escape") return;
    // [UNDAVAR-PARTE-10.11.2-PIN-IMAGEN] Si hay un selector o visor encima, lo cierra él
    if (document.querySelector(".galeria-picker-fondo, .galeria-visor-fondo")) return;
    if (document.body.contains(fondo) || (document.fullscreenElement && document.fullscreenElement.contains(fondo))) {
      document.removeEventListener("keydown", escapePin);
      cerrar();
    }
  });
  storeSel.addEventListener("change", actualizarRefs);

  fondo.querySelector("#pin-guardar").addEventListener("click", async () => {
    let store = storeSel.value;
    let refId = refSel.value;
    if (!MAPA_VISTAS[store] || !refId) { store = ""; refId = ""; }
    const color = fondo.querySelector('input[name="pin-color"]:checked')?.value || base.color;
    const zonaCercana = mapaEslavaCercana(base.x, base.y);
    // [UNDAVAR-PARTE-9.4-REFUGIOS] Conserva el estado si el nivel no cambia
    const nivelRefugio = Math.max(0, Math.min(6, parseInt(fondo.querySelector("#pin-refugio")?.value, 10) || 0));
    const refugioPrevio = base.refugio || null;
    const refugio = nivelRefugio
      ? (refugioPrevio && refugioPrevio.nivel === nivelRefugio
        ? { ...refugioPrevio, nivel: nivelRefugio }
        : { nivel: nivelRefugio, construido: false, dano: 0, constructor: "", descansan: [] })
      : null;
    const datos = {
      ...base,
      nombre: nombreInput.value.trim().slice(0, 80) || "Lugar sin nombre",
      enwes: enwesSel.value || zonaCercana?.enwes || "",
      eslava: eslavaSel.value || zonaCercana?.nombre || "",
      color,
      nota: notaInput.value.trim().slice(0, 600),
      store,
      refId,
      // [UNDAVAR-PARTE-10.11.2-PIN-IMAGEN] Imagen elegida o cargada en el editor
      imagenId: pinImagenId,
      refugio,
    };
    const indice = mapa.pines.findIndex(p => p.id === datos.id);
    if (indice >= 0) mapa.pines[indice] = datos;
    else mapa.pines.push(datos);
    try {
      await guardarPinesMapa();
      // [UNDAVAR-PARTE-10.11.3-PIN-FOTO] Refresca la galería si se cargó una imagen nueva
      mapa.galeria = await dbGetAll("galeria");
      mapa.seleccionado = datos.id;
      cerrar();
      renderMapaPines();
      renderMapaEslavas();
      renderMapaPanel();
      notificar(esNuevo ? "Pin añadido al mapa." : "Pin actualizado.");
    } catch (e) {
      notificar("No se pudo guardar el pin: " + (e.message || e));
    }
  });

  fondo.querySelector("#pin-borrar")?.addEventListener("click", async () => {
    cerrar();
    await mapaBorrarPin(base);
  });

  nombreInput.focus();
  nombreInput.select();
}

async function mapaBorrarPin(pin) {
  const ok = await confirmarAccion("Borrar pin", `¿Borrar «${pin.nombre}» del mapa?`, "Borrar");
  if (!ok) return;
  mapa.pines = mapa.pines.filter(p => p.id !== pin.id);
  if (mapa.seleccionado === pin.id) mapa.seleccionado = null;
  try {
    await guardarPinesMapa();
    renderMapaPines();
    renderMapaEslavas();
    renderMapaPanel();
    notificar("Pin borrado.");
  } catch (e) {
    notificar("No se pudo borrar el pin: " + (e.message || e));
  }
}

// [UNDAVAR-PARTE-9.4-REFUGIOS] Constructor elegido para el refugio del pin
function mapaConstructorRefugio(pin) {
  const pjs = mapa.personajes || [];
  return pjs.find(p => p.id === pin.refugio?.constructor) || pjs[0] || null;
}

// [UNDAVAR-PARTE-9.4-REFUGIOS] Construir: comprueba y descuenta materiales
async function mapaConstruirRefugio(pin) {
  const r = pin.refugio;
  const def = r && REFUGIOS_UNDAVAR[r.nivel];
  if (!def) return;
  const pj = mapaConstructorRefugio(pin);
  if (!pj) { notificar("⚠️ Necesitas una ficha de personaje para construir."); return; }

  const disp = mapaMaterialesPJ(pj);
  const faltan = Object.entries(def.materiales).filter(([t, n]) => (disp[t] || 0) < n);
  if (faltan.length) {
    notificar("⚠️ Faltan materiales: " + faltan.map(([t, n]) => `tipo ${t} (${disp[t] || 0}/${n})`).join(", "));
    return;
  }

  mapaConsumirMateriales(pj, def.materiales);
  await dbPut("personajes", pj);
  r.construido = true;
  r.dano = 0;
  r.constructor = pj.id;
  pin.refugio = r;
  await guardarPinesMapa();
  await logTirada(pj, `<h4>Refugio construido</h4><p style="text-align:center">${esc(pin.nombre)} · nivel ${r.nivel}</p>`, "personajes");
  notificar(`🏠 ${pin.nombre}: refugio de nivel ${r.nivel} construido.`);
  renderMapaPanel();
  renderMapaPines();
}

// [UNDAVAR-PARTE-9.4-REFUGIOS] Registrar daño estructural
async function mapaDanoRefugio(pin, valor) {
  const r = pin.refugio;
  const def = r && REFUGIOS_UNDAVAR[r.nivel];
  if (!def) return;
  const dano = Math.max(0, Math.min(def.danoMax, Number(valor) || 0));
  r.dano = dano;
  if (dano >= def.danoMax) {
    r.construido = false;
    r.dano = 0;
    pin.refugio = r;
    await guardarPinesMapa();
    notificar(`💥 ${pin.nombre}: el refugio cedió. Hay que reconstruirlo.`);
  } else {
    pin.refugio = r;
    await guardarPinesMapa();
    notificar(`Daño registrado en ${pin.nombre}: ${dano}/${def.danoMax}.`);
  }
  renderMapaPanel();
}

// [UNDAVAR-PARTE-9.4-REFUGIOS] Reparación con tirada de 4d6
async function mapaRepararRefugio(pin) {
  const r = pin.refugio;
  const def = r && REFUGIOS_UNDAVAR[r.nivel];
  if (!def) return;
  if (r.dano <= 0) { notificar("El refugio no tiene daño que reparar."); return; }
  const pj = mapaConstructorRefugio(pin);
  if (!pj) { notificar("⚠️ Elige un constructor con ficha."); return; }

  const ds = [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1);
  const aciertos = ds.filter(d => [1, 3, 5].includes(d)).length;
  const exito = aciertos >= def.reparar.aciertos;
  if (exito) r.dano = Math.max(0, r.dano - def.reparar.puntos);
  pin.refugio = r;
  await guardarPinesMapa();
  await logTirada(pj, `<h4>Reparación de refugio</h4>${typeof dadosHTML === "function" ? dadosHTML(ds) : ""}
    <p style="text-align:center">Aciertos: <b>${aciertos}</b>/${def.reparar.aciertos} — ${exito ? `repara ${def.reparar.puntos} pts` : "sin éxito"}. Daño: ${r.dano}/${def.danoMax}</p>`, "personajes");
  notificar(exito
    ? `🔨 ${pin.nombre}: reparados ${def.reparar.puntos} pts.`
    : `La reparación falló (${aciertos}/${def.reparar.aciertos} aciertos).`);
  renderMapaPanel();
}

// [UNDAVAR-PARTE-9.4-REFUGIOS] Turno de descanso: cura estados de los PJ marcados
async function mapaTurnoRefugio(pin) {
  const r = pin.refugio;
  const def = r && REFUGIOS_UNDAVAR[r.nivel];
  if (!def) return;
  if (!def.estados) { notificar("Este refugio no cura estados negativos."); return; }
  const ids = r.descansan || [];
  if (!ids.length) { notificar("Marca quién descansa en el refugio."); return; }

  let tocados = 0;
  for (const id of ids) {
    const pj = await dbGet("personajes", id);
    if (!pj) continue;
    if (!pj.system) pj.system = {};
    if (!pj.system.extensionEstado) {
      pj.system.extensionEstado = { hambre: { value: 0 }, sed: { value: 0 }, cansancio: { value: 0 }, fatiga: { value: 0 } };
    }
    let resta = def.estados;
    for (const clave of ["hambre", "sed", "cansancio", "fatiga"]) {
      if (resta <= 0) break;
      if (!pj.system.extensionEstado[clave]) pj.system.extensionEstado[clave] = { value: 0 };
      const actual = Math.max(0, Number(pj.system.extensionEstado[clave].value) || 0);
      const quitar = Math.min(actual, resta);
      pj.system.extensionEstado[clave].value = actual - quitar;
      resta -= quitar;
    }
    await dbPut("personajes", pj);
    tocados++;
  }
  notificar(`🌙 Turno de descanso: ${tocados} personaje${tocados === 1 ? "" : "s"} recuperan estados.`);
  renderMapaPanel();
}

function mapaAbrirVinculo(pin) {
  const vinculo = mapaResolverVinculo(pin);
  if (!vinculo) { notificar("Este pin no tiene una ficha vinculada."); return; }
  ir(vinculo.vista, { [vinculo.idKey]: pin.refId });
}

function mapaPuntoLocal(clientX, clientY) {
  const esc = mapa.escenario;
  if (!esc || !mapa.baseW) return null;
  const rect = esc.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (clientX - rect.left - mapa.x) / (mapa.baseW * mapa.zoom))),
    y: Math.min(1, Math.max(0, (clientY - rect.top - mapa.y) / (mapa.baseH * mapa.zoom))),
  };
}

function mapaPointerDown(e) {
  // [UNDAVAR-PARTE-10.11.4-MENU-MAPA] Solo el botón izquierdo arrastra el mapa
  if (e.button !== 0) return;
  if (e.target.closest(".mapa-pin") || e.target.closest(".mapa-eslava") || e.target.closest(".mapa-controles") || e.target.closest(".mapa-salir")) return;
  const esc = mapa.escenario;
  if (!esc) return;
  try { esc.setPointerCapture(e.pointerId); } catch (err) { }
  mapa.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (mapa.punteros.size === 1) {
    mapa.arrastre = {
      id: e.pointerId, x: e.clientX, y: e.clientY,
      mx: mapa.x, my: mapa.y, movido: false,
    };
    esc.classList.add("arrastrando");
  } else if (mapa.punteros.size === 2) {
    const puntos = [...mapa.punteros.values()];
    const rect = esc.getBoundingClientRect();
    const centro = {
      x: (puntos[0].x + puntos[1].x) / 2 - rect.left,
      y: (puntos[0].y + puntos[1].y) / 2 - rect.top,
    };
    mapa.pinch = {
      dist: Math.hypot(puntos[0].x - puntos[1].x, puntos[0].y - puntos[1].y) || 1,
      zoom: mapa.zoom,
      wx: (centro.x - mapa.x) / mapa.zoom,
      wy: (centro.y - mapa.y) / mapa.zoom,
    };
    mapa.arrastre = null;
  }
}

function mapaPointerMove(e) {
  // [UNDAVAR-PARTE-8-PINES] Arrastre de un pin concreto
  if (mapa.moverPin && mapa.moverPin.id === e.pointerId) {
    const M = mapa.moverPin;
    if (Math.abs(e.clientX - M.x) + Math.abs(e.clientY - M.y) > 4) M.movido = true;
    const punto = mapaPuntoLocal(e.clientX, e.clientY);
    if (!punto) return;
    M.pin.x = punto.x;
    M.pin.y = punto.y;
    if (M.el) {
      M.el.style.left = `${(punto.x * 100).toFixed(4)}%`;
      M.el.style.top = `${(punto.y * 100).toFixed(4)}%`;
    }
    return;
  }

  if (!mapa.punteros.has(e.pointerId)) return;
  const esc = mapa.escenario;
  if (!esc) return;
  mapa.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (mapa.pinch && mapa.punteros.size >= 2) {
    const puntos = [...mapa.punteros.values()];
    const rect = esc.getBoundingClientRect();
    const distancia = Math.hypot(puntos[0].x - puntos[1].x, puntos[0].y - puntos[1].y) || 1;
    const centro = {
      x: (puntos[0].x + puntos[1].x) / 2 - rect.left,
      y: (puntos[0].y + puntos[1].y) / 2 - rect.top,
    };
    const zoom = Math.min(mapa.maxZoom, Math.max(mapa.minZoom, mapa.pinch.zoom * (distancia / mapa.pinch.dist)));
    mapa.zoom = zoom;
    mapa.x = centro.x - mapa.pinch.wx * zoom;
    mapa.y = centro.y - mapa.pinch.wy * zoom;
    mapaAplicarVista();
    return;
  }

  if (!mapa.arrastre || mapa.arrastre.id !== e.pointerId) return;
  const dx = e.clientX - mapa.arrastre.x;
  const dy = e.clientY - mapa.arrastre.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) mapa.arrastre.movido = true;
  mapa.x = mapa.arrastre.mx + dx;
  mapa.y = mapa.arrastre.my + dy;
  mapaAplicarVista();
}

function mapaPointerUp(e) {
  const esc = mapa.escenario;

  // [UNDAVAR-PARTE-8-PINES] Fin del arrastre de un pin
  if (mapa.moverPin && mapa.moverPin.id === e.pointerId) {
    const M = mapa.moverPin;
    mapa.moverPin = null;
    try { esc?.releasePointerCapture(e.pointerId); } catch (err) { }
    if (M.movido) {
      mapa.ignorarClic = true;
      // [UNDAVAR-PARTE-8B-GEO] Al mover el pin, su zona pasa a la Eslava más cercana
      const zona = mapaEslavaCercana(M.pin.x, M.pin.y);
      if (zona) { M.pin.enwes = zona.enwes; M.pin.eslava = zona.nombre; }
      guardarPinesMapa().catch(err => notificar("No se pudo mover el pin: " + (err.message || err)));
      renderMapaEslavas();
      renderMapaPanel();
    } else {
      // [UNDAVAR-PARTE-9.4B-PIN] Evita que el clic de fondo quite la selección al soltar
      mapa.ignorarClic = true;
      mapaSeleccionar(M.pin.id, { centrar: true });
    }
    return;
  }

  mapa.punteros.delete(e.pointerId);
  try { esc?.releasePointerCapture(e.pointerId); } catch (err) { }

  if (mapa.punteros.size < 2) mapa.pinch = null;
  if (mapa.punteros.size === 0) {
    mapa.ignorarClic = Boolean(mapa.arrastre?.movido);
    mapa.arrastre = null;
    esc?.classList.remove("arrastrando");
  } else if (mapa.punteros.size === 1) {
    const [id, p] = [...mapa.punteros.entries()][0];
    mapa.arrastre = { id, x: p.x, y: p.y, mx: mapa.x, my: mapa.y, movido: true };
  }
}

function mapaRueda(e) {
  e.preventDefault();
  const rect = mapa.escenario.getBoundingClientRect();
  const factor = Math.exp(-e.deltaY * 0.0015);
  mapaZoomEn(mapa.zoom * factor, e.clientX - rect.left, e.clientY - rect.top);
}

function mapaDobleClic(e) {
  if (e.target.closest(".mapa-pin") || e.target.closest(".mapa-eslava") || e.target.closest(".mapa-controles") || e.target.closest(".mapa-salir")) return;
  // [UNDAVAR-PARTE-10.11.4-MENU-MAPA] Doble clic: añadir un pin en ese punto
  e.preventDefault();
  const punto = mapaPuntoLocal(e.clientX, e.clientY);
  if (!punto) return;
  mapa.colocando = false;
  actualizarModoColocacion();
  abrirEditorPin(null, punto);
}

function mapaClicFondo(e) {
  if (mapa.ignorarClic) { mapa.ignorarClic = false; return; }
  if (e.target.closest(".mapa-pin") || e.target.closest(".mapa-eslava") || e.target.closest(".mapa-controles") || e.target.closest(".mapa-salir")) return;
  if (!mapa.colocando) {
    // [UNDAVAR-PARTE-8D-SELECCION] Clic en el fondo: quitar la marca de la Eslava o del pin
    if (mapa.eslavaSel || mapa.seleccionado) {
      mapa.eslavaSel = null;
      mapa.seleccionado = null;
      mapaMarcarSeleccion();
      renderMapaPanel();
    }
    return;
  }
  const punto = mapaPuntoLocal(e.clientX, e.clientY);
  if (!punto) return;
  mapa.colocando = false;
  actualizarModoColocacion();
  abrirEditorPin(null, punto);
}

// [UNDAVAR-PARTE-10.11.4-MENU-MAPA] Menú contextual del mapa para añadir pines
function mapaCerrarMenu() {
  document.querySelector(".mapa-menu")?.remove();
  document.removeEventListener("pointerdown", mapaMenuFuera, true);
  document.removeEventListener("keydown", mapaMenuTeclas, true);
}

function mapaMenuFuera(e) {
  if (!e.target.closest?.(".mapa-menu")) mapaCerrarMenu();
}

function mapaMenuTeclas(e) {
  if (e.key !== "Escape") return;
  e.stopPropagation();
  mapaCerrarMenu();
}

function mapaAbrirMenu(e) {
  e.preventDefault();
  e.stopPropagation();
  mapaCerrarMenu();
  const punto = mapaPuntoLocal(e.clientX, e.clientY);
  if (!punto) return;

  const menu = document.createElement("div");
  menu.className = "mapa-menu";
  menu.innerHTML = `
    <button type="button" data-mapa-menu="aqui"><span data-icono="pin"></span> Añadir pin aquí</button>
    <button type="button" data-mapa-menu="colocar"><span data-icono="pin"></span> Colocar pin en el mapa</button>`;
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  contenedorOverlays().appendChild(menu);
  pintarIconos(menu);

  // Ajusta el menú para que no se salga de la pantalla
  const ancho = menu.offsetWidth;
  const alto = menu.offsetHeight;
  menu.style.left = `${Math.max(8, Math.min(e.clientX, innerWidth - ancho - 8))}px`;
  menu.style.top = `${Math.max(8, Math.min(e.clientY, innerHeight - alto - 8))}px`;

  menu.addEventListener("click", (ev) => {
    const accion = ev.target.closest("[data-mapa-menu]")?.dataset.mapaMenu;
    if (!accion) return;
    mapaCerrarMenu();
    if (accion === "aqui") {
      mapa.colocando = false;
      actualizarModoColocacion();
      abrirEditorPin(null, punto);
      return;
    }
    if (accion === "colocar") {
      mapa.colocando = true;
      actualizarModoColocacion();
      notificar("Toca el mapa para colocar el pin.");
    }
  });

  document.addEventListener("pointerdown", mapaMenuFuera, true);
  document.addEventListener("keydown", mapaMenuTeclas, true);
}

function mapaPinPointerDown(e) {
  // [UNDAVAR-PARTE-10.11.4-MENU-MAPA] El botón derecho abre el menú, no mueve el pin
  if (e.button !== 0) return;
  const btn = e.target.closest(".mapa-pin");
  if (!btn) return;
  const pin = mapa.pines.find(p => p.id === btn.dataset.pin);
  if (!pin) return;
  e.preventDefault();
  e.stopPropagation();
  mapaSeleccionar(pin.id);
  mapa.moverPin = {
    id: e.pointerId, pin, el: btn,
    x: e.clientX, y: e.clientY, movido: false,
  };
  try { mapa.escenario.setPointerCapture(e.pointerId); } catch (err) { }
}

function mapaConectarEventos() {
  const esc = mapa.escenario;
  if (!esc) return;
  esc.addEventListener("pointerdown", mapaPointerDown);
  esc.addEventListener("pointermove", mapaPointerMove);
  esc.addEventListener("pointerup", mapaPointerUp);
  esc.addEventListener("pointercancel", mapaPointerUp);
  esc.addEventListener("wheel", mapaRueda, { passive: false });
  esc.addEventListener("dblclick", mapaDobleClic);
  esc.addEventListener("click", mapaClicFondo);
  // [UNDAVAR-PARTE-10.11.4-MENU-MAPA] Botón derecho y cierre del menú al mover o acercar
  esc.addEventListener("contextmenu", mapaAbrirMenu);
  esc.addEventListener("wheel", () => { mapaOcultarAvancePin(); mapaCerrarMenu(); }, { passive: true });
  document.getElementById("mapa-pines").addEventListener("pointerdown", mapaPinPointerDown);
  // [UNDAVAR-PARTE-8-PINES] Selección con teclado o clic sin arrastre
  document.getElementById("mapa-pines").addEventListener("click", (e) => {
    if (mapa.ignorarClic) { mapa.ignorarClic = false; return; }
    const btn = e.target.closest(".mapa-pin");
    if (!btn) return;
    e.stopPropagation();
    mapaSeleccionar(btn.dataset.pin, { centrar: true });
  });

  // [UNDAVAR-PARTE-10.11.3B-AVANCE-PIN] Imagen del pin al pasar el ratón
  const pinesCont = document.getElementById("mapa-pines");
  pinesCont.addEventListener("mouseover", (e) => {
    const btn = e.target.closest(".mapa-pin");
    if (!btn) return;
    if (btn.dataset.pin === document.querySelector(".mapa-pin-avance")?.dataset.pin) return;
    const pin = mapa.pines.find(p => p.id === btn.dataset.pin);
    if (pin) mapaMostrarAvancePin(pin, btn);
  });
  pinesCont.addEventListener("mouseout", (e) => {
    const btn = e.target.closest(".mapa-pin");
    if (btn && !btn.contains(e.relatedTarget)) mapaOcultarAvancePin();
  });
  // [UNDAVAR-PARTE-10.11.3B-AVANCE-PIN] Al mover o acercar el mapa, se oculta
  esc.addEventListener("pointerdown", mapaOcultarAvancePin);
  // [UNDAVAR-PARTE-8B-GEO] Clic en un marcador de Eslava
  document.getElementById("mapa-eslavas").addEventListener("click", (e) => {
    if (mapa.ignorarClic) { mapa.ignorarClic = false; return; }
    const btn = e.target.closest(".mapa-eslava");
    if (!btn) return;
    e.stopPropagation();
    mapaSeleccionarEslava(btn.dataset.eslava, { centrar: true });
  });

  document.getElementById("mapa-panel-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (!btn) return;
    mapa.tab = btn.dataset.tab;
    renderMapaPanel();
  });

  document.getElementById("mapa-panel-cuerpo").addEventListener("click", (e) => {
    const eslavaAccion = e.target.closest("[data-eslava-accion]")?.dataset.eslavaAccion;
    if (eslavaAccion) {
      const eSel = MAPA_ESLAVAS.find(x => x.nombre === mapa.eslavaSel);
      if (!eSel) return;
      if (eslavaAccion === "centrar") mapaCentrarEnPunto(eSel.x, eSel.y, 2.4);
      else if (eslavaAccion === "anadir") abrirEditorPin(null, { x: eSel.x, y: eSel.y });
      return;
    }
    const fila = e.target.closest(".mapa-fila");
    if (fila) {
      if (fila.dataset.eslava) mapaSeleccionarEslava(fila.dataset.eslava, { centrar: true });
      else mapaSeleccionar(fila.dataset.pin, { centrar: true });
      return;
    }
    const accion = e.target.closest("[data-accion]")?.dataset.accion;
    if (!accion) return;
    const pin = mapa.pines.find(p => p.id === mapa.seleccionado);
    if (!pin) return;
    if (accion === "abrir") mapaAbrirVinculo(pin);
    else if (accion === "centrar") mapaCentrarEn(pin);
    else if (accion === "editar") abrirEditorPin(pin);
    else if (accion === "borrar") mapaBorrarPin(pin);
    // [UNDAVAR-PARTE-10.11.3-PIN-FOTO] Abre la imagen del pin en el visor
    else if (accion === "ver-imagen") {
      const foto = mapaImagenPin(pin);
      if (foto) galeriaAbrirVisor([foto], foto.id);
    }
    // [UNDAVAR-PARTE-9.4-REFUGIOS] Acciones del refugio
    else if (accion === "refugio-construir") mapaConstruirRefugio(pin);
    else if (accion === "refugio-dano") mapaDanoRefugio(pin, document.querySelector("[data-refugio-dano-input]")?.value);
    else if (accion === "refugio-reparar") mapaRepararRefugio(pin);
    else if (accion === "refugio-turno") mapaTurnoRefugio(pin);
  });

  // [UNDAVAR-PARTE-9.4-REFUGIOS] Constructor y descanso elegidos en el refugio
  document.getElementById("mapa-panel-cuerpo").addEventListener("change", async (e) => {
    const pin = mapa.pines.find(p => p.id === mapa.seleccionado);
    if (!pin?.refugio) return;

    const sel = e.target.closest("[data-refugio-constructor]");
    if (sel) {
      pin.refugio.constructor = sel.value;
      await guardarPinesMapa();
      renderMapaPanel();
      return;
    }

    const chk = e.target.closest("[data-refugio-descansa]");
    if (chk) {
      const id = chk.dataset.refugioDescansa;
      const lista = new Set(pin.refugio.descansan || []);
      if (chk.checked) lista.add(id); else lista.delete(id);
      pin.refugio.descansan = [...lista];
      await guardarPinesMapa();
    }
  });

  document.getElementById("mapa-buscar").addEventListener("input", (e) => {
    mapa.filtro = e.target.value;
    renderMapaPanel();
  });

  document.getElementById("mapa-btn-anadir").addEventListener("click", mapaAlternarColocacion);
  document.getElementById("mapa-zoom-in").addEventListener("click", () => mapaZoomEn(mapa.zoom * 1.35));
  document.getElementById("mapa-zoom-out").addEventListener("click", () => mapaZoomEn(mapa.zoom / 1.35));
  document.getElementById("mapa-zoom-reset").addEventListener("click", () => mapaEncajar());
  document.getElementById("mapa-btn-pantalla").addEventListener("click", alternarPantallaMapa);
  // [UNDAVAR-PARTE-8D-PANTALLA] Salir desde el botón flotante
  document.getElementById("mapa-salir-pantalla").addEventListener("click", alternarPantallaMapa);

  // [UNDAVAR-PARTE-8-MAPA] Si el motor no trae ResizeObserver, el mapa sigue con el tamaño inicial
  if (typeof ResizeObserver === "function") {
    mapa.observador = new ResizeObserver(() => {
      const escActual = mapa.escenario;
      if (!escActual || !document.body.contains(escActual)) return;
      const centro = mapaPuntoCentro();
      const zoom = mapa.zoom;
      mapaMedirBase();
      if (centro) {
        mapa.zoom = zoom;
        mapa.x = mapa.escW / 2 - centro.nx * mapa.baseW * zoom;
        mapa.y = mapa.escH / 2 - centro.ny * mapa.baseH * zoom;
      } else {
        mapaEncajar();
        return;
      }
      mapaAplicarVista();
    });
    mapa.observador.observe(esc);
  }
}

function mapaAplicarEstadoPantalla() {
  const activo = Boolean(document.fullscreenElement) || Boolean(mapa.vistaEl?.classList.contains("mapa-pantalla"));
  const btn = document.getElementById("mapa-btn-pantalla");
  if (btn) {
    btn.classList.toggle("activo", activo);
    btn.title = activo ? "Salir de pantalla completa" : "Pantalla completa";
    btn.setAttribute("aria-label", btn.title);
  }
}

async function alternarPantallaMapa() {
  const el = mapa.vistaEl;
  if (!el) return;
  if (document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch (err) { }
    return;
  }
  // [UNDAVAR-PARTE-8-MAPA] Si ya está el respaldo interno, se retira
  if (mapa.pantallaFallback) {
    mapa.pantallaFallback = false;
    el.classList.remove("mapa-pantalla");
    mapaAplicarEstadoPantalla();
    return;
  }
  if (el.requestFullscreen) {
    try {
      // [UNDAVAR-PARTE-8-MAPA] Algunos navegadores dejan la promesa pendiente:
      // si no hay pantalla completa en 800 ms, se usa el respaldo interno.
      const nativo = await Promise.race([
        el.requestFullscreen().then(() => true, () => false),
        new Promise(resolve => setTimeout(() => resolve(false), 800)),
      ]);
      if (nativo || document.fullscreenElement) return;
    } catch (err) { }
  }
  // Respaldo cuando el navegador no permite pantalla completa nativa
  mapa.pantallaFallback = true;
  el.classList.add("mapa-pantalla");
  mapaAplicarEstadoPantalla();
}

document.addEventListener("fullscreenchange", () => {
  // Si la pantalla completa nativa llega tarde, se retira el respaldo
  if (document.fullscreenElement && mapa.vistaEl?.classList.contains("mapa-pantalla")) {
    mapa.pantallaFallback = false;
    mapa.vistaEl.classList.remove("mapa-pantalla");
  }
  if (mapa.vistaEl) mapaAplicarEstadoPantalla();
});

// [UNDAVAR-PARTE-8-MAPA] Escape sale del respaldo de pantalla completa
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !mapa.pantallaFallback) return;
  if (document.querySelector(".modal-pin")) return;
  mapa.pantallaFallback = false;
  mapa.vistaEl?.classList.remove("mapa-pantalla");
  mapaAplicarEstadoPantalla();
});

// [UNDAVAR-PARTE-9.5D-BUSCADOR] Ctrl+F busca en la tienda, no en el navegador
document.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "f") return;
  const input = document.getElementById("buscar-tienda");
  if (!input) return;
  e.preventDefault();
  input.focus();
  input.select();
});

async function renderMapa() {
  // [UNDAVAR-PARTE-10.11.4-MENU-MAPA] Al repintar la vista, fuera menú
  mapaCerrarMenu();
  if (mapa.observador) { mapa.observador.disconnect(); mapa.observador = null; }
  mapa.vistaEl = null;
  mapa.escenario = null;
  mapa.lienzo = null;
  mapa.punteros.clear();
  mapa.arrastre = null;
  mapa.pinch = null;
  mapa.moverPin = null;
  mapa.colocando = false;
  mapa.pantallaFallback = false;
  mapa.eslavaSel = null;
  mapa.tab = "pines";

  await cargarMapa();
  if (mapa.seleccionado && !mapa.pines.some(p => p.id === mapa.seleccionado)) {
    mapa.seleccionado = null;
  }

  app.innerHTML = `
  <section class="mapa-vista" id="mapa-vista">
    <header class="mapa-cabecera">
      <div>
        <div class="ed-eyebrow">MUNDO CONOCIDO</div>
        <h2>Mapa de Undavar</h2>
        <p>Arrastra, acerca y marca los lugares de tu campaña. Abre «Eslavas» o pasa el ratón por un nombre para ver su Enwes. Clic derecho en el mapa, o doble clic, para añadir un pin.</p>
      </div>
      <div class="mapa-acciones">
        <button type="button" class="btn-primario chico" id="mapa-btn-anadir"><span data-icono="pin"></span> <span id="mapa-btn-anadir-texto">Añadir pin</span></button>
        <button type="button" class="btn-secundario chico" id="mapa-btn-pantalla" title="Pantalla completa"><span data-icono="pantalla"></span> Pantalla completa</button>
      </div>
    </header>

    <div class="mapa-grid">
      <aside class="mapa-panel" aria-label="Pines del mapa">
        <div class="mapa-panel-cabecera">
          <label class="ed-buscador">
            <span data-icono="buscar"></span>
            <input type="search" id="mapa-buscar" placeholder="Buscar lugar o Eslava…" aria-label="Buscar lugar o Eslava" value="${esc(mapa.filtro)}">
          </label>
          <!-- [UNDAVAR-PARTE-8B-GEO] Pestañas de pines y Eslavas -->
          <div class="mapa-pestanas" id="mapa-panel-tabs" role="tablist" aria-label="Contenido del panel">
            <button type="button" class="mapa-pestana activa" id="mapa-tab-pines" data-tab="pines" role="tab" aria-selected="true">Pines</button>
            <button type="button" class="mapa-pestana" id="mapa-tab-eslavas" data-tab="eslavas" role="tab" aria-selected="false">Eslavas</button>
          </div>
        </div>
        <div class="mapa-panel-cuerpo" id="mapa-panel-cuerpo"></div>
      </aside>

      <div class="mapa-escenario" id="mapa-escenario" aria-label="Mapa interactivo">
        <div class="mapa-lienzo" id="mapa-lienzo">
          <img class="mapa-img mapa-img-preview" id="mapa-img-preview" src="assets/mapa/mapa-preview.webp" alt="" draggable="false">
          <img class="mapa-img mapa-img-full" id="mapa-img-full" src="assets/mapa/mapa-8192.webp" alt="Mapa de Undavar" draggable="false" decoding="async">
          <!-- [UNDAVAR-PARTE-8B-GEO] Capa de Eslavas debajo de los pines -->
          <div class="mapa-eslavas" id="mapa-eslavas"></div>
          <div class="mapa-pines" id="mapa-pines"></div>
        </div>
        <div class="mapa-cargando" id="mapa-cargando">Cargando detalle…</div>
        <div class="mapa-ayuda" id="mapa-ayuda">Arrastra para mover · Rueda o pellizco para acercar · Clic derecho o doble clic para añadir un pin</div>
        <!-- [UNDAVAR-PARTE-8D-PANTALLA] Salir de la pantalla completa del mapa -->
        <button type="button" class="mapa-salir" id="mapa-salir-pantalla" title="Salir de pantalla completa" aria-label="Salir de pantalla completa"><span data-icono="pantalla"></span></button>
        <div class="mapa-controles" aria-label="Controles del mapa">
          <button type="button" id="mapa-zoom-in" title="Acercar" aria-label="Acercar">+</button>
          <button type="button" id="mapa-zoom-out" title="Alejar" aria-label="Alejar">−</button>
          <span class="mapa-controles-sep"></span>
          <button type="button" id="mapa-zoom-reset" title="Ver el mapa completo" aria-label="Ver el mapa completo"><span data-icono="centrar"></span></button>
        </div>
      </div>
    </div>
  </section>`;

  mapa.vistaEl = document.getElementById("mapa-vista");
  mapa.escenario = document.getElementById("mapa-escenario");
  mapa.lienzo = document.getElementById("mapa-lienzo");

  renderMapaPines();
  renderMapaEslavas();
  renderMapaPanel();
  mapaConectarEventos();
  actualizarModoColocacion();
  mapaAplicarEstadoPantalla();

  const preview = document.getElementById("mapa-img-preview");
  const full = document.getElementById("mapa-img-full");
  const cargando = document.getElementById("mapa-cargando");
  const marcarCompleto = () => {
    if (full?.naturalWidth) {
      full.classList.add("lista");
      cargando?.classList.add("oculto");
    }
  };
  full?.addEventListener("load", marcarCompleto);
  full?.addEventListener("error", () => cargando?.classList.add("oculto"));
  if (full?.complete) marcarCompleto();

  let encajado = false;
  const encajarInicial = () => {
    if (encajado || !mapa.escenario || !document.body.contains(mapa.escenario)) return;
    encajado = true;
    mapaMedirBase();
    mapaEncajar();
  };
  if (preview?.complete) encajarInicial();
  else preview?.addEventListener("load", encajarInicial, { once: true });
  // Espera al primer layout para medir con el tamaño real
  requestAnimationFrame(encajarInicial);
}

window.addEventListener("DOMContentLoaded", initApp);

// ============================================================
// VISTA: DIVIDIDA — MESA DE DOS PANELES [UNDAVAR-PARTE-3.8]
// ============================================================

const SECCIONES_FICHA_DIVIDIDA = ["datos", "artes", "oficios", "inventario", "estado", "referencia", "equipo"];
const ETIQUETAS_SECCION_DIVIDIDA = {
  datos: "Datos", artes: "Artes", oficios: "Oficios", inventario: "Inventario",
  estado: "Estado", referencia: "Referencia", equipo: "Equipo"
};

let ladoPaletaDividida = "izq";
let mesaEscapeWireado = false;

function leerPanelDividido(lado) {
  try {
    const raw = localStorage.getItem(`undavar-panel-${lado}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function guardarPanelDividido(lado, panel) {
  try { localStorage.setItem(`undavar-panel-${lado}`, JSON.stringify(panel)); } catch { }
}

// [UNDAVAR-PARTE-3.8] Describe un panel y devuelve sus datos visibles o null si ya no existe
async function describirPanelDividido(panel) {
  if (!panel || !panel.vista) return null;

  if (panel.vista === "ficha") {
    const a = panel.id ? await dbGet("personajes", panel.id) : null;
    if (!a) return null;
    const clase = a.system?.datos?.clase || "Undavarí";
    return {
      ...panel,
      nombre: a.nombre || "Sin nombre",
      tipo: `Personaje · ${clase}`,
      inicial: (a.nombre || "?").trim().charAt(0).toUpperCase() || "?",
      img: a.img || "",
      claseAvatar: ""
    };
  }

  if (panel.vista === "npc") {
    const a = panel.id ? await dbGet("npcs", panel.id) : null;
    if (!a) return null;
    // [UNDAVAR-PARTE-9.2-BESTIARIO] Las fichas antiguas muestran el nombre del manual
    const raza = nombreRazaManual(a.system?.datos?.raza) || "PNJ";
    return {
      ...panel,
      nombre: a.nombre || "Sin nombre",
      tipo: `PNJ · ${raza}`,
      inicial: (a.nombre || "?").trim().charAt(0).toUpperCase() || "?",
      img: a.img || "",
      claseAvatar: "pnj"
    };
  }

  if (panel.vista === "dados") {
    return { ...panel, nombre: "Dados", tipo: "Consulta · Tiradas", inicial: "🎲", icono: "🎲", claseAvatar: "vista" };
  }

  // [UNDAVAR-PARTE-4.2h4j-DIVIDIDA] Tiradas enfrentadas y combate en la mesa de dos paneles
  if (panel.vista === "enfrentamiento") {
    return { ...panel, nombre: "Tiradas enfrentadas", tipo: "Consulta · Enfrentamientos", inicial: "⚔", icono: "⚔", claseAvatar: "vista" };
  }

  if (panel.vista === "combate") {
    return { ...panel, nombre: "Combate", tipo: "Mesa · Combate", inicial: "🗡", icono: "🗡", claseAvatar: "vista" };
  }

  if (panel.vista === "oraculo") {
    // [UNDAVAR-PARTE-4.2h4j-DIVIDIDA] Si no hay oráculo creado, la tarjeta lo crea al abrirse
    if (!panel.id) return { ...panel, nombre: "Oráculo", tipo: "Consulta · Tablas", inicial: "🔮", icono: "🔮", claseAvatar: "vista" };
    const o = await dbGet("oraculos", panel.id);
    if (!o) return null;
    return { ...panel, nombre: o.nombre || "Oráculo", tipo: "Consulta · Tablas", inicial: "🔮", icono: "🔮", claseAvatar: "vista" };
  }

  if (panel.vista === "tienda") {
    const t = panel.id ? await dbGet("tiendas", panel.id) : null;
    if (!t) return null;
    return { ...panel, nombre: t.nombre || "Tienda", tipo: "Consulta · Compras", inicial: "🏪", icono: "🏪", claseAvatar: "vista" };
  }

  return null;
}

// [UNDAVAR-PARTE-3.8] URL del iframe según el panel
function urlPanelDividido(panel) {
  const params = new URLSearchParams();
  params.set("vista", panel.vista);
  if (panel.id) params.set("id", panel.id);
  if (panel.vista === "ficha" && panel.seccion) params.set("seccion", panel.seccion);
  params.set("panel", "1");
  return `${window.location.pathname}?${params.toString()}`;
}

// [UNDAVAR-PARTE-7-AVATAR] Lomo con retrato real, sin escapar el HTML
function lomoPanelHTML(desc, lado) {
  const conRetrato = desc.vista === "ficha" || desc.vista === "npc";
  const avatar = conRetrato
    ? avatarHTML({ nombre: desc.nombre, img: desc.img }, { clase: "mesa-avatar" })
    : `<span class="mesa-avatar ${desc.claseAvatar || ""}">${esc(desc.icono || desc.inicial || "?")}</span>`;
  return `
  <div class="mesa-lomo">
    ${avatar}
    <div class="mesa-id">
      <strong>${esc(desc.nombre)}</strong>
      <span>${esc(desc.tipo)}</span>
    </div>
    <button class="mesa-btn-cuadros" data-paleta="${lado}" title="Cambiar contenido" aria-label="Cambiar contenido del panel ${lado === "izq" ? "izquierdo" : "derecho"}">⊞</button>
  </div>`;
}

function chipsPanelHTML(desc, lado) {
  if (desc.vista !== "ficha") return "";
  return `
  <nav class="mesa-chips" data-chips="${lado}" aria-label="Secciones del panel ${lado === "izq" ? "izquierdo" : "derecho"}">
    ${SECCIONES_FICHA_DIVIDIDA.map(s =>
    `<button class="mesa-chip ${desc.seccion === s ? "activo" : ""}" data-seccion="${s}">${ETIQUETAS_SECCION_DIVIDIDA[s]}</button>`).join("")}
  </nav>`;
}

function panelDivididoHTML(desc, lado) {
  return `
  <article class="mesa-panel" data-lado="${lado}">
    ${lomoPanelHTML(desc, lado)}
    ${chipsPanelHTML(desc, lado)}
    <iframe class="mesa-iframe" data-iframe="${lado}" src="${urlPanelDividido(desc)}" title="Panel ${lado === "izq" ? "izquierdo" : "derecho"}"></iframe>
  </article>`;
}

function panelPorDefectoDividido(lado, personajes, npcs) {
  if (lado === "izq") {
    if (personajes[0]) return { vista: "ficha", id: personajes[0].id, seccion: "datos" };
    if (npcs[0]) return { vista: "npc", id: npcs[0].id };
  }
  if (npcs[0]) return { vista: "npc", id: npcs[0].id };
  if (personajes[0]) return { vista: "ficha", id: personajes[0].id, seccion: "datos" };
  return null;
}

function tarjetaPaletaHTML(datos) {
  const icono = datos.icono || (datos.nombre || "?").trim().charAt(0).toUpperCase() || "?";
  return `
  <button class="mesa-tarjeta" data-vista="${datos.vista}" data-id="${datos.id || ""}" data-seccion="${datos.seccion || ""}" data-nombre="${esc(datos.nombre)}" data-tipo="${esc(datos.tipo)}">
    <span class="mesa-tarjeta-icono ${datos.clase || ""}">${esc(icono)}</span>
    <strong>${esc(datos.nombre)}</strong>
    <small>${esc(datos.tipo)}</small>
  </button>`;
}

function paletaDivididaHTML(personajes, npcs, tiendas, oraculos) {
  const primerPj = personajes[0];

  const grupoPersonajes = personajes.length ? `
    <div class="mesa-grupo">
      <h3>Personajes</h3>
      <div class="mesa-tarjetas">
        ${personajes.map(p => tarjetaPaletaHTML({
    vista: "ficha", id: p.id, nombre: p.nombre || "Sin nombre",
    tipo: `Personaje · ${p.system?.datos?.clase || "Undavarí"}`,
    icono: (p.nombre || "?").trim().charAt(0).toUpperCase() || "?",
    clase: ""
  })).join("")}
      </div>
    </div>` : "";

  const grupoNpcs = npcs.length ? `
    <div class="mesa-grupo">
      <h3>PNJ y bestias</h3>
      <div class="mesa-tarjetas">
        ${npcs.map(n => tarjetaPaletaHTML({
    vista: "npc", id: n.id, nombre: n.nombre || "Sin nombre",
    tipo: `PNJ · ${nombreRazaManual(n.system?.datos?.raza) || "Sin raza"}`,
    icono: (n.nombre || "?").trim().charAt(0).toUpperCase() || "?",
    clase: "pnj"
  })).join("")}
      </div>
    </div>` : "";

  const consulta = [
    tarjetaPaletaHTML({ vista: "dados", nombre: "Dados", tipo: "Consulta · Tiradas", icono: "🎲", clase: "vista" })
  ];
  if (primerPj) {
    consulta.push(tarjetaPaletaHTML({
      vista: "ficha", id: primerPj.id, seccion: "referencia",
      nombre: "Referencia", tipo: "Consulta · Tablas", icono: "📖", clase: "vista"
    }));
  }
  oraculos.forEach(o => consulta.push(tarjetaPaletaHTML({
    vista: "oraculo", id: o.id, nombre: o.nombre || "Oráculo", tipo: "Consulta · Tablas", icono: "🔮", clase: "vista"
  })));
  // [UNDAVAR-PARTE-4.2h4j-DIVIDIDA] Oráculo, tiradas enfrentadas y combate siempre disponibles
  if (!oraculos.length) consulta.push(tarjetaPaletaHTML({
    vista: "oraculo", nombre: "Oráculo", tipo: "Consulta · Tablas", icono: "🔮", clase: "vista"
  }));
  consulta.push(tarjetaPaletaHTML({
    vista: "enfrentamiento", nombre: "Tiradas enfrentadas", tipo: "Consulta · Enfrentamientos", icono: "⚔", clase: "vista"
  }));
  consulta.push(tarjetaPaletaHTML({
    vista: "combate", nombre: "Combate", tipo: "Mesa · Combate", icono: "🗡", clase: "vista"
  }));
  tiendas.forEach(t => consulta.push(tarjetaPaletaHTML({
    vista: "tienda", id: t.id, nombre: t.nombre || "Tienda", tipo: "Consulta · Compras", icono: "🏪", clase: "vista"
  })));

  return `
  <div class="mesa-paleta-fondo" id="mesa-paleta-fondo">
    <div class="mesa-paleta" role="dialog" aria-modal="true" aria-labelledby="mesa-paleta-titulo">
      <div class="mesa-paleta-cabecera">
        <div>
          <h2 id="mesa-paleta-titulo">Elige el contenido</h2>
          <p>Panel <b id="mesa-paleta-lado">izquierdo</b> · toca una tarjeta para colocarla.</p>
        </div>
        <button class="mesa-cerrar" id="mesa-cerrar-paleta" aria-label="Cerrar">✕</button>
      </div>
      ${grupoPersonajes}
      ${grupoNpcs}
      <div class="mesa-grupo">
        <h3>Consulta</h3>
        <div class="mesa-tarjetas">${consulta.join("")}</div>
      </div>
    </div>
  </div>`;
}

function abrirPaletaDividida(lado) {
  ladoPaletaDividida = lado;
  const fondo = qs("#mesa-paleta-fondo");
  const etiqueta = qs("#mesa-paleta-lado");
  if (etiqueta) etiqueta.textContent = lado === "izq" ? "izquierdo" : "derecho";
  fondo?.classList.add("abierta");
}

function wirePanelDividido(lado) {
  const articulo = qs(`.mesa-panel[data-lado="${lado}"]`);
  if (!articulo) return;

  articulo.querySelector("[data-paleta]")?.addEventListener("click", () => abrirPaletaDividida(lado));

  articulo.querySelectorAll(".mesa-chip").forEach(chip => {
    chip.addEventListener("click", async () => {
      const panel = lado === "izq" ? state.panelIzq : state.panelDer;
      if (!panel) return;
      panel.seccion = chip.dataset.seccion;
      await actualizarPanelDividido(lado, panel);
    });
  });
}

// [UNDAVAR-PARTE-3.8] Cambia un solo panel sin recargar el otro
async function actualizarPanelDividido(lado, panel) {
  const desc = await describirPanelDividido(panel);
  if (!desc) {
    notificar("⚠️ Ese contenido ya no está disponible.");
    return;
  }

  if (lado === "izq") state.panelIzq = panel;
  else state.panelDer = panel;
  guardarPanelDividido(lado, panel);

  const articulo = qs(`.mesa-panel[data-lado="${lado}"]`);
  if (!articulo) return;

  const lomo = articulo.querySelector(".mesa-lomo");
  if (lomo) lomo.outerHTML = lomoPanelHTML(desc, lado);

  const chips = articulo.querySelector(".mesa-chips");
  if (desc.vista === "ficha") {
    if (chips) chips.outerHTML = chipsPanelHTML(desc, lado);
    else {
      const iframe = articulo.querySelector("iframe");
      iframe?.insertAdjacentHTML("beforebegin", chipsPanelHTML(desc, lado));
    }
  } else if (chips) {
    chips.remove();
  }

  const iframe = articulo.querySelector("iframe");
  if (iframe) iframe.src = urlPanelDividido(panel);

  wirePanelDividido(lado);
}

function wireVistaDividida() {
  qs("#btn-volver-div")?.addEventListener("click", () => ir("inicio"));

  const fondo = qs("#mesa-paleta-fondo");
  qs("#mesa-cerrar-paleta")?.addEventListener("click", () => fondo?.classList.remove("abierta"));
  fondo?.addEventListener("click", (e) => { if (e.target === fondo) fondo.classList.remove("abierta"); });

  // [UNDAVAR-PARTE-3.8] Un solo listener de Escape aunque se entre y salga de la vista
  if (!mesaEscapeWireado) {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") qs("#mesa-paleta-fondo")?.classList.remove("abierta");
    });
    mesaEscapeWireado = true;
  }

  qsa(".mesa-tarjeta").forEach(t => {
    t.addEventListener("click", async () => {
      const panel = {
        vista: t.dataset.vista,
        id: t.dataset.id || null,
        seccion: t.dataset.seccion || (t.dataset.vista === "ficha" ? "datos" : undefined)
      };
      await actualizarPanelDividido(ladoPaletaDividida, panel);
      fondo?.classList.remove("abierta");
    });
  });

  wirePanelDividido("izq");
  wirePanelDividido("der");
}

async function renderVistaDividida() {
  const [personajesRaw, npcsRaw, tiendas, oraculos] = await Promise.all([
    dbGetAll("personajes"), dbGetAll("npcs"), dbGetAll("tiendas"), dbGetAll("oraculos")
  ]);
  // [UNDAVAR-PARTE-4.2h2-PAREJA] Las copias no aparecen en la paleta
  const personajes = soloPersonajesReales(personajesRaw);
  const npcs = soloPersonajesReales(npcsRaw);

  if (!personajes.length && !npcs.length) {
    app.innerHTML = `
    <section class="vista-ficha mesa-vacia">
      <div class="mesa-vacia-caja">
        <h2>Mesa de dos paneles</h2>
        <p>Necesitas al menos un personaje o un PNJ para abrir la vista dividida.</p>
        <button class="btn-primario" id="btn-vacio-inicio">← Ir a Inicio</button>
      </div>
    </section>`;
    qs("#btn-vacio-inicio")?.addEventListener("click", () => ir("inicio"));
    return;
  }

  const guardadoIzq = leerPanelDividido("izq");
  const guardadoDer = leerPanelDividido("der");

  const panelIzq = (guardadoIzq && await describirPanelDividido(guardadoIzq))
    ? guardadoIzq
    : panelPorDefectoDividido("izq", personajes, npcs);
  const panelDer = (guardadoDer && await describirPanelDividido(guardadoDer))
    ? guardadoDer
    : panelPorDefectoDividido("der", personajes, npcs);

  state.panelIzq = panelIzq;
  state.panelDer = panelDer;
  guardarPanelDividido("izq", panelIzq);
  guardarPanelDividido("der", panelDer);

  const descIzq = await describirPanelDividido(panelIzq);
  const descDer = await describirPanelDividido(panelDer);

  app.innerHTML = `
  <section class="mesa-dividida">
    <header class="mesa-cabecera">
      <div>
        <h2>Mesa de dos paneles</h2>
        <p>Dos fichas o vistas de consulta en paralelo, sin barras internas.</p>
      </div>
      <button class="btn-volver" id="btn-volver-div">← Inicio</button>
    </header>
    <div class="mesa-grid">
      ${panelDivididoHTML(descIzq, "izq")}
      ${panelDivididoHTML(descDer, "der")}
    </div>
  </section>
  ${paletaDivididaHTML(personajes, npcs, tiendas, oraculos)}`;

  wireVistaDividida();
}


// ============================================================
// VISTA: MESA DE COMBATE (PARTE 4.2a)
// ============================================================
// [UNDAVAR-PARTE-4.2a] Suma la reducción de las piezas de equipo del defensor
function reduccionArmadura(actor) {
  // [UNDAVAR-PARTE-3.9] Cuenta equipo y objetos equipados con reducción
  const equipo = (actor.items || [])
    .filter(estaEquipado)
    .reduce((a, i) => a + (Number(i.system?.reduccion_dano) || 0), 0);
  // [UNDAVAR-PARTE-4.2h6-SELLO] La absorción del Quinto Sello y otros bonos suman reducción
  return equipo + Math.max(0, bonoActivoSuma(actor.system, "reduccion", 0));
}

// [UNDAVAR-PARTE-4.2a] Coste de PA: normal 1; arte/arma según nivel
function costeAtaqueCombate(tipo, nivel) {
  return tipo === "normal" ? 1 : costoPANivel(nivel);
}

// [UNDAVAR-PARTE-4.2c4] Bloqueo 1 PA, esquive 2 PA y contraataque según el recurso
// [UNDAVAR-PARTE-4.2i-ESTADOS] La defensa de ingenio no gasta PA
function costeReaccionCombate(reaccion, costeContra = 1) {
  if (reaccion === "bloqueo") return 1;
  if (reaccion === "esquive") return 2;
  if (reaccion === "contraataque") return Math.max(1, Number(costeContra) || 1);
  if (reaccion === "ingenio") return 0;
  return 0;
}

// [UNDAVAR-PARTE-4.2a] Datos visibles de cada contendiente en la mesa
function estadoActorCombate(actor) {
  const d = calcularDerivados(actor.system, actor.items);
  // [UNDAVAR-PARTE-3.9a] El PA infinito depende de «Sin PA», no de ser PNJ
  const esPNJ = actor.tipo === "npc" || actor.system?.datos?.raza !== undefined;
  const paMax = esPNJ ? paMaximoNPC(actor, d) : d.paMaximo;
  const paRaw = Number(actor.system.pa?.value) || 0;
  // [UNDAVAR-PARTE-4.2c-VITAL] Estado vital visible en la mesa
  const vital = estadoVital(actor);
  return {
    pa: paMax === null ? paRaw : Math.min(paRaw, paMax),
    paMax: paMax === null ? paRaw : paMax,
    sinPA: paMax === null,
    heridas: d.heridasTotales,
    salud: Number(actor.system.estado?.ptSalud?.value) || 0,
    saludMax: d.saludLimiteActual,
    armadura: reduccionArmadura(actor),
    // [UNDAVAR-PARTE-4.2h4j-ESTADOS-COMBATE] Penalización visible solo en la mesa
    penalizacion: d.penalizacionCansancioFatiga,
    inconsciente: !!vital.inconsciente,
    muerto: !!vital.muerto,
    intentos: Number(vital.intentosDespertar) || 0
  };
}

// [UNDAVAR-PARTE-4.2a] Tirada de ataque con ventaja/desventaja (se queda la mejor/peor)
function tirarAtaqueConVentaja(mod, ventaja, desventaja) {
  const t1 = tiradaEstandar();
  const total1 = t1.aciertos + mod;
  if (!ventaja && !desventaja) return { tirada: t1, total: total1, extra: null, modo: "" };

  const t2 = tiradaEstandar();
  const total2 = t2.aciertos + mod;
  if (desventaja && total2 < total1) return { tirada: t2, total: total2, extra: t1, modo: "desventaja" };
  if (ventaja && total2 > total1) return { tirada: t2, total: total2, extra: t1, modo: "ventaja" };
  return { tirada: t1, total: total1, extra: t2, modo: ventaja ? "ventaja" : "desventaja" };
}

function opcionesContendientesCombate(todos, id, store) {
  // [UNDAVAR-PARTE-4.2a] Clave única store::id: evita confundir un PNJ copiado de un PJ
  return todos.map(c => `<option value="${c.store}::${c.id}" ${c.id === id && c.store === store ? "selected" : ""}>[${c.etiqueta}] ${esc(c.nombre)}</option>`).join("");
}

function statsContendienteHTML(e, id, sinPA = false) {
  // [UNDAVAR-PARTE-3.9a] Solo es infinito si el PNJ tiene «Sin PA» marcado
  const pa = sinPA ? "∞" : `${e.pa}/${e.paMax}`;
  // [UNDAVAR-PARTE-4.2h4j-ESTADOS-COMBATE] Muestra la penalización de Cansancio/Fatiga en combate
  const penal = e.penalizacion ? ` · ⚖️ Cansancio/Fatiga <b>−${e.penalizacion}</b>` : "";
  return `<div class="combate-stats" id="${id}">⚡ PA <b>${pa}</b> · 🩸 Heridas <b>${e.heridas}/8</b> · ❤️ Salud <b>${e.salud}/${e.saludMax}</b>${penal}</div>`;
}

async function renderCombate() {
  const [personajes, npcs] = await Promise.all([dbGetAll("personajes"), dbGetAll("npcs")]);
  const todos = [
    ...personajes.map(p => ({ id: p.id, nombre: p.nombre, store: "personajes", etiqueta: esClon(p) ? "COPIA" : "PJ" })),
    ...npcs.map(n => ({ id: n.id, nombre: n.nombre, store: "npcs", etiqueta: esClon(n) ? "COPIA" : "PNJ" }))
  ];

  if (!todos.length) {
    app.innerHTML = `<section class="vista-ficha"><p class="vacio">Crea al menos un personaje o PNJ para abrir la mesa de combate.</p></section>`;
    return;
  }

  const c = state.combate;
  const existe = (id, store) => todos.some(x => x.id === id && x.store === store);

  // [UNDAVAR-PARTE-4.2c6] Lista de participantes y turno actual
  if (!Array.isArray(c.lista)) c.lista = [];
  // Arranca con los dos contendientes actuales
  if (!c.lista.length) {
    if (existe(c.idA, c.storeA)) c.lista.push({ store: c.storeA, id: c.idA });
    if (existe(c.idB, c.storeB) && !(c.idB === c.idA && c.storeB === c.storeA)) {
      c.lista.push({ store: c.storeB, id: c.idB });
    }
    if (!c.lista.length) c.lista.push({ store: todos[0].store, id: todos[0].id });
  }
  // Quita participantes que ya no existen
  c.lista = c.lista.filter(p => existe(p.id, p.store));
  if (!c.lista.length) c.lista.push({ store: todos[0].store, id: todos[0].id });
  // El turno nunca se sale de la lista
  c.turnoIdx = Math.max(0, Math.min(c.lista.length - 1, Number(c.turnoIdx) || 0));
  // [UNDAVAR-PARTE-4.2c6] El atacante es siempre el participante del turno
  c.idA = c.lista[c.turnoIdx].id;
  c.storeA = c.lista[c.turnoIdx].store;

  // [UNDAVAR-PARTE-4.2c6] El objetivo se elige entre los demás participantes
  const candidatosB = c.lista
    .filter(p => !(p.id === c.idA && p.store === c.storeA))
    .map(p => todos.find(x => x.id === p.id && x.store === p.store))
    .filter(Boolean);
  if (!candidatosB.some(x => x.id === c.idB && x.store === c.storeB)) {
    const otro = candidatosB[0] || todos.find(x => !(x.id === c.idA && x.store === c.storeA)) || todos[0];
    c.idB = otro.id; c.storeB = otro.store;
  }

  const atacante = await dbGet(c.storeA, c.idA);
  const defensor = await dbGet(c.storeB, c.idB);
  if (!atacante || !defensor) {
    app.innerHTML = `<section class="vista-ficha"><p class="vacio">No se pudieron cargar los contendientes.</p></section>`;
    return;
  }
  // [UNDAVAR-PARTE-4.2c-VITAL] Refleja la inconsciencia antes de pintar la mesa
  sincronizarEstadoVital(atacante);
  sincronizarEstadoVital(defensor);
  // [UNDAVAR-PARTE-4.2h2-PAREJA] Aplica el viento de las hermanas en la mesa
  await guardarBonosPasivos(atacante, c.storeA);
  await guardarBonosPasivos(defensor, c.storeB);

  // [UNDAVAR-PARTE-10.4-ARMAS] Las armas comunes no se eligen como arte o arma
  const arts = (atacante.items || []).filter(i => i.type === "arte" || (i.type === "arma" && !esArmaComun(i)));
  if (c.tipo !== "normal" && !arts.some(i => i.id === c.itemId)) c.itemId = arts[0]?.id || "";
  if (c.tipo !== "normal" && !c.itemId) c.tipo = "normal";
  const item = arts.find(i => i.id === c.itemId) || null;
  const nivel = item ? Number(item.system?.nivel) || 0 : 0;
  const costeA = costeAtaqueCombate(c.tipo, nivel);
  const ea = estadoActorCombate(atacante);
  const ed = estadoActorCombate(defensor);
  // [UNDAVAR-PARTE-4.2h2-PAREJA] Duplicación disponible en la mesa de combate
  // [UNDAVAR-PARTE-4.2h3-PAREJA] Duplicación según la habilidad configurada
  const puedeDuplicar = !!armaDuplicacion(atacante) && !esClon(atacante);
  const clonActivo = [...personajes, ...npcs].some(p => esClon(p) && p.system?.clonDe?.raizId === atacante.id);

  // [UNDAVAR-PARTE-4.2c4] Recurso del contraataque del defensor
  const contrasD = (defensor.items || []).filter(i => i.type === "arte" || (i.type === "arma" && !esArmaComun(i)));
  if (c.contraTipo !== "normal" && !contrasD.some(i => i.id === c.contraItemId)) c.contraItemId = contrasD[0]?.id || "";
  if (c.contraTipo !== "normal" && !c.contraItemId) c.contraTipo = "normal";
  const contraItemD = contrasD.find(i => i.id === c.contraItemId) || null;
  const contraNivelD = contraItemD ? Number(contraItemD.system?.nivel) || 0 : 0;
  const costeContraD = costeAtaqueCombate(c.contraTipo, contraNivelD);

  // [UNDAVAR-PARTE-4.2c4] Inconsciente solo esquive; sin PA no hay defensa
  const soloEsquiveD = !ed.muerto && ed.inconsciente;
  const reaccionEfectiva = ed.muerto
    ? "ninguna"
    : soloEsquiveD
      ? (ed.sinPA || ed.pa >= 2 ? "esquive" : "ninguna")
      : (c.reaccion || "ninguna");
  const costeD = ed.muerto ? 0 : costeReaccionCombate(reaccionEfectiva, costeContraD);
  const puedeReaccionarD = ed.sinPA || ed.pa >= costeD;
  const sinPAReaccion = reaccionEfectiva !== "ninguna" && !puedeReaccionarD;
  // [UNDAVAR-PARTE-4.2h4j-ARMADURA] La reducción sale solo de los objetos equipados

  // [UNDAVAR-PARTE-4.2c6] Panel de participantes y filas de la lista de turno
  const filaParticipante = (p, idx) => {
    const info = todos.find(x => x.id === p.id && x.store === p.store);
    const activo = idx === c.turnoIdx;
    return `<div class="combate-participante${activo ? " activo" : ""}">
      <span class="combate-part-orden">${idx + 1}</span>
      ${avatarHTML(info || p, { clase: "avatar-mini" })}
      <span class="combate-part-nombre">${esc(info?.nombre || p.nombre || "—")} <small>[${info?.etiqueta || p.etiqueta || "?"}]</small>${p.clonDe ? " 🧬" : ""}</span>
      <span class="combate-part-ini">${p.iniciativa !== undefined ? `Ini ${p.iniciativa}` : "—"}</span>
      <span class="combate-part-botones">
        <button class="btn-secundario chico" data-accion="subir" data-idx="${idx}" ${idx === 0 ? "disabled" : ""} title="Subir" aria-label="Subir">↑</button>
        <button class="btn-secundario chico" data-accion="bajar" data-idx="${idx}" ${idx === c.lista.length - 1 ? "disabled" : ""} title="Bajar" aria-label="Bajar">↓</button>
        <button class="btn-peligro chico" data-accion="quitar" data-idx="${idx}" title="Quitar" aria-label="Quitar">✕</button>
      </span>
    </div>`;
  };
  const fueraDeLista = todos.filter(x => !c.lista.some(p => p.id === x.id && p.store === x.store));
  const panelParticipantes = `
    <div class="combate-participantes">
      <div class="combate-part-cab">
        <h3>Participantes y turno</h3>
        <div class="combate-part-acciones">
          <select id="participante-select" class="combate-select">
            <option value="">— Añadir participante —</option>
            ${fueraDeLista.map(x => `<option value="${x.store}::${x.id}">[${x.etiqueta}] ${esc(x.nombre)}</option>`).join("")}
          </select>
          <button class="btn-secundario" id="btn-add-participante">+ Añadir</button>
          <button class="btn-secundario" id="btn-iniciativa">🎲 Iniciativa (4d6)</button>
          ${c.lista.some(p => p.clonDe) ? `<button class="btn-secundario" id="btn-quitar-clon">↩️ Deshacer duplicación</button>` : ""}
        </div>
      </div>
      <div class="combate-part-lista">${c.lista.map(filaParticipante).join("")}</div>
      <p class="combate-nota">Turno ${c.turnoIdx + 1} de ${c.lista.length}: ataca <b>${esc(atacante.nombre)}</b>. «Cambiar turno» pasa al siguiente.</p>
    </div>`;

  app.innerHTML = `
  <section class="vista-ficha combate-mesa">
    <header class="sheet-header">
      <button class="btn-volver" id="btn-volver">← Inicio</button>
      <div class="header-izquierda">
        <h2 style="margin:0; color:var(--texto-dorado, #d4af37);">⚔️ Mesa de combate</h2>
        <p class="combate-sub">Ataque 4d6 contra 4d6 · en alcance se acierta sin tirada · daño en tirada aparte.</p>
      </div>
    </header>

    ${panelParticipantes}

    <div class="combate-grid">
      <div class="combate-col">
        <h3>Atacante · turno ${c.turnoIdx + 1}/${c.lista.length}</h3>
        <div class="combate-turno-actual">${avatarHTML(atacante, { clase: "avatar-medio" })}<span>⚔️ ${esc(atacante.nombre)} <small>[${esClon(atacante) ? "COPIA" : (c.storeA === "personajes" ? "PJ" : "PNJ")}]</small></span></div>
        ${statsContendienteHTML(ea, "combate-stats-a", ea.sinPA)}
        ${ea.heridas >= 8 ? `<p class="combate-alerta">Herido (8/8): ataca con desventaja (tira dos veces y se queda el peor resultado).</p>` : ""}
        ${ea.muerto ? `<p class="combate-alerta">☠️ Muerto: no puede atacar.</p>` : ea.inconsciente ? `<p class="combate-alerta">😵 Inconsciente: no puede atacar.</p>` : ""}

        ${puedeDuplicar ? `
          <div class="combate-duplicacion">
            ${clonActivo
              ? `<button class="btn-secundario" id="btn-deshacer-duplicacion">↩️ Deshacer duplicación</button>`
              : `<button class="btn-secundario" id="btn-duplicar-existencia">🧬 Duplicar existencia</button>`}
            <p class="combate-nota">La copia entra como una ranura más, con su propia iniciativa.</p>
          </div>` : ""}

        <div class="campo-fila">
          <label>Tipo de ataque</label>
          <select id="combate-tipo" class="combate-select">
            <option value="normal" ${c.tipo === "normal" ? "selected" : ""}>Normal (1 PA)</option>
            <option value="arte" ${c.tipo === "arte" ? "selected" : ""}>Arte</option>
            <option value="arma" ${c.tipo === "arma" ? "selected" : ""}>Arma</option>
          </select>
        </div>

        ${c.tipo === "normal" ? `<p class="combate-nota">Ataque normal: usa el daño por rango (2d6/3d6/4d6) y gana 1d6 PdC si supera la tirada.</p>` : `
        <div class="campo-fila">
          <label>Arte o arma</label>
          <select id="combate-item" class="combate-select">
            ${arts.length ? arts.map(i => `<option value="${i.id}" ${i.id === c.itemId ? "selected" : ""}>${esc(i.name)} · Nv.${Number(i.system?.nivel) || 0} · ${costoPANivel(Number(i.system?.nivel) || 0)} PA</option>`).join("") : `<option value="">Sin artes ni armas</option>`}
          </select>
        </div>`}

        <div class="campo-fila">
          <label>Atributo de daño</label>
          <select id="combate-atr" class="combate-select">
            ${["fuerza", "velocidad", "agilidad", "inteligencia"].map(a => `<option value="${a}" ${c.atr === a ? "selected" : ""}>${a[0].toUpperCase() + a.slice(1)} (${atributoEfectivo(atacante, a, true)})</option>`).join("")}
          </select>
        </div>

        <div class="campo-fila">
          <label>Mod. de ataque</label>
          <input type="number" id="combate-mod-a" value="${Number(c.modA) || 0}">
        </div>

        <label class="combate-check"><input type="checkbox" id="combate-ventaja" ${c.ventaja ? "checked" : ""}> Ventaja (repetir y quedarse el mejor)</label>
        <p class="combate-coste">Coste del ataque: <b>${ea.sinPA ? "∞" : `${costeA} PA`}</b>${c.tipo !== "normal" && nivel ? ` (Nv.${nivel})` : ""}${bonusCombate(nivel) ? ` · bono de aciertos +${bonusCombate(nivel)}` : ""}</p>
      </div>

      <div class="combate-centro">
        <div class="campo-fila">
          <label>Distancia</label>
          <select id="combate-distancia" class="combate-select">
            <option value="fuera" ${c.distancia === "fuera" ? "selected" : ""}>Fuera de alcance (4d6 vs 4d6)</option>
            <option value="alcance" ${c.distancia === "alcance" ? "selected" : ""}>En alcance (acierto automático)</option>
          </select>
        </div>
        <button class="btn-primario" id="btn-resolver-combate" ${(ea.muerto || ea.inconsciente || sinPAReaccion) ? "disabled" : ""}>🎲 Resolver golpe</button>
        ${ea.muerto || ea.inconsciente ? `<p class="combate-nota">El atacante no puede atacar.</p>` : ""}
        ${sinPAReaccion ? `<p class="combate-nota">El defensor no tiene PA para esa reacción. Cambia la reacción o cambia el turno.</p>` : ""}
        <button class="btn-secundario" id="btn-cambiar-turno">🔄 Cambiar turno</button>
        <button class="btn-secundario" id="btn-regalar-pa">🤝 Regalar PA</button>
        <p class="combate-nota">Turno ${c.turno || 1}. Reacción del defensor: <b>${ed.sinPA ? "∞" : `${costeD} PA`}</b>${reaccionEfectiva === "ninguna" ? " (recibe el golpe)" : reaccionEfectiva === "ingenio" ? " (defensa de ingenio)" : reaccionEfectiva === "bloqueo" ? " (bloqueo)" : reaccionEfectiva === "esquive" ? " (esquive)" : " (contraataque)"}.</p>
      </div>

      <div class="combate-col">
        <h3>Objetivo</h3>
        <select id="combate-defensor" class="combate-select">${opcionesContendientesCombate(candidatosB.length ? candidatosB : todos.filter(x => !(x.id === c.idA && x.store === c.storeA)), c.idB, c.storeB)}</select>
        <div class="combate-turno-actual">${avatarHTML(defensor, { clase: "avatar-medio" })}<span>🛡️ ${esc(defensor.nombre)} <small>[${esClon(defensor) ? "COPIA" : (c.storeB === "personajes" ? "PJ" : "PNJ")}]</small></span></div>
        ${statsContendienteHTML(ed, "combate-stats-d", ed.sinPA)}
        ${ed.heridas >= 8 ? `<p class="combate-alerta">Herido (8/8): al atacarlo hay ventaja, el daño se tira dos veces y se queda el mayor. Bloquear exige tirada de rebote.</p>` : ""}
        ${ed.muerto ? `<p class="combate-alerta">☠️ Muerto: no puede defenderse ni reaccionar.</p>` : ed.inconsciente ? `<p class="combate-alerta">😵 Inconsciente: solo puede esquivar gastando 2 PA. Sin PA, recibe el golpe.</p>` : ""}
        ${sinPAReaccion ? `<p class="combate-alerta">Sin PA para esa reacción: cambia la reacción o recibe el golpe.</p>` : ""}

        <div class="campo-fila">
          <label>Reducción por equipo</label>
          <span class="combate-nota">−${ed.armadura} (solo objetos equipados)</span>
        </div>

        <div class="campo-fila">
          <label>Reducción extra</label>
          <input type="number" id="combate-reduccion" value="${Number(c.reduccionExtra) || 0}" min="0">
        </div>

        <div class="campo-fila">
          <label>Mod. de defensa</label>
          <input type="number" id="combate-mod-d" value="${Number(c.modD) || 0}">
        </div>

        <div class="campo-fila">
          <label>Reacción</label>
          <select id="combate-reaccion" class="combate-select" ${ed.muerto || soloEsquiveD ? "disabled" : ""}>
            ${soloEsquiveD
              ? (ed.sinPA || ed.pa >= 2
                  ? `<option value="esquive" selected>Esquive (2 PA) · única reacción posible</option>`
                  : `<option value="ninguna" selected>Sin PA suficiente · recibe el golpe</option>`)
              : `<option value="ninguna" ${c.reaccion === "ninguna" ? "selected" : ""}>Sin reacción (recibe el golpe)</option>
                 <option value="ingenio" ${c.reaccion === "ingenio" ? "selected" : ""}>Defensa de ingenio (0 PA) · usa el entorno</option>
                 <option value="bloqueo" ${c.reaccion === "bloqueo" ? "selected" : ""} ${!ed.sinPA && ed.pa < 1 ? "disabled" : ""}>Bloqueo (1 PA) · mitad de daño</option>
                 <option value="esquive" ${c.reaccion === "esquive" ? "selected" : ""} ${!ed.sinPA && ed.pa < 2 ? "disabled" : ""}>Esquive (2 PA) · evita el daño</option>
                 <option value="contraataque" ${c.reaccion === "contraataque" ? "selected" : ""} ${!ed.sinPA && ed.pa < costeContraD ? "disabled" : ""}>Contraataque (${costeContraD} PA) · devuelve daño</option>`}
          </select>
        </div>

        ${reaccionEfectiva === "contraataque" ? `
          <div class="campo-fila">
            <label>Recurso del contraataque</label>
            <select id="combate-contra-tipo" class="combate-select">
              <option value="normal" ${c.contraTipo === "normal" ? "selected" : ""}>Normal (1 PA)</option>
              <option value="arte" ${c.contraTipo === "arte" ? "selected" : ""}>Arte</option>
              <option value="arma" ${c.contraTipo === "arma" ? "selected" : ""}>Arma</option>
            </select>
          </div>
          ${c.contraTipo !== "normal" ? `
            <div class="campo-fila">
              <label>Arte o arma</label>
              <select id="combate-contra-item" class="combate-select">
                ${contrasD.length ? contrasD.map(i => `<option value="${i.id}" ${i.id === c.contraItemId ? "selected" : ""}>${esc(i.name)} · Nv.${Number(i.system?.nivel) || 0} · ${costoPANivel(Number(i.system?.nivel) || 0)} PA</option>`).join("") : `<option value="">Sin artes ni armas</option>`}
              </select>
            </div>` : ""}
        ` : ""}

        <p class="combate-nota">${sinPAReaccion ? "Sin PA suficiente para esa reacción: elige «Sin reacción» o cambia el turno." : reaccionEfectiva === "ninguna" ? "Sin reacción: el defensor recibe el golpe." : reaccionEfectiva === "ingenio" ? "Defensa de ingenio: 0 PA; gana o empata → 0 daño; si supera el ataque gana 1d6 PdC." : reaccionEfectiva === "bloqueo" ? "Bloqueo: tirada enfrentada; gana → mitad de daño, 4 aciertos → anula." : reaccionEfectiva === "esquive" ? "Esquive: gana o empata → 0 daño; fuera de alcance el atacante necesita dos tiradas." : `Contraataque: paga ${costeContraD} PA; gana → devuelve daño, empata → mitad para ambos.`}</p>
      </div>
    </div>

    <div id="resultado-combate" class="combate-resultado"></div>
  </section>`;

  qs("#btn-volver")?.addEventListener("click", () => ir("inicio"));

  // [UNDAVAR-PARTE-4.2a] Cambios de contendiente: recargar la mesa
  // [UNDAVAR-PARTE-4.2a] Lee la clave compuesta store::id del selector
  const leerContendiente = (valor) => {
    const corte = String(valor || "").indexOf("::");
    if (corte < 0) return null;
    return { store: valor.slice(0, corte), id: valor.slice(corte + 2) };
  };
  // [UNDAVAR-PARTE-4.2c6] Lista de participantes: añadir, reordenar y quitar
  qs("#btn-add-participante")?.addEventListener("click", () => {
    const elegido = leerContendiente(qs("#participante-select")?.value);
    if (!elegido) { notificar("⚠️ Elige un participante para añadir."); return; }
    agregarParticipanteCombate(elegido.store, elegido.id);
  });
  qsa("[data-accion]", app).forEach(b => b.addEventListener("click", () => {
    const idx = Number(b.dataset.idx) || 0;
    if (b.dataset.accion === "subir") moverParticipanteCombate(idx, -1);
    else if (b.dataset.accion === "bajar") moverParticipanteCombate(idx, 1);
    else if (b.dataset.accion === "quitar") quitarParticipanteCombate(idx);
  }));
  qs("#btn-iniciativa")?.addEventListener("click", () => tirarIniciativaCombate());
  qs("#btn-quitar-clon")?.addEventListener("click", () => deshacerDuplicacionCombate());
  qs("#combate-defensor")?.addEventListener("change", e => {
    const elegido = leerContendiente(e.target.value);
    if (!elegido) return;
    c.idB = elegido.id; c.storeB = elegido.store;
    // [UNDAVAR-PARTE-4.2c4] Cambiar contendiente reinicia el turno
    c.turno = 1; c.ultimo = null; c.undo = null;
    render();
  });
  qs("#combate-tipo")?.addEventListener("change", e => {
    c.tipo = e.target.value;
    c.atr = c.tipo === "arte" ? "inteligencia" : "fuerza";
    render();
  });
  qs("#combate-item")?.addEventListener("change", e => { c.itemId = e.target.value; render(); });
  qs("#combate-atr")?.addEventListener("change", e => { c.atr = e.target.value; });
  qs("#combate-distancia")?.addEventListener("change", e => { c.distancia = e.target.value; });
  qs("#combate-mod-a")?.addEventListener("input", e => { c.modA = parseInt(e.target.value) || 0; });
  qs("#combate-mod-d")?.addEventListener("input", e => { c.modD = parseInt(e.target.value) || 0; });
  qs("#combate-reduccion")?.addEventListener("input", e => { c.reduccionExtra = parseInt(e.target.value) || 0; });
  qs("#combate-ventaja")?.addEventListener("change", e => { c.ventaja = e.target.checked; });
  qs("#combate-reaccion")?.addEventListener("change", e => { c.reaccion = e.target.value; render(); });
  // [UNDAVAR-PARTE-4.2c4] Recurso del contraataque y cambio de turno
  qs("#combate-contra-tipo")?.addEventListener("change", e => { c.contraTipo = e.target.value; c.contraItemId = ""; render(); });
  qs("#combate-contra-item")?.addEventListener("change", e => { c.contraItemId = e.target.value; render(); });
  qs("#btn-cambiar-turno")?.addEventListener("click", () => cambiarTurnoCombate());
  // [UNDAVAR-PARTE-4.2c7] Regalar PA a un participante sin PA
  qs("#btn-regalar-pa")?.addEventListener("click", () => abrirModalRegalarPA());
  qs("#btn-resolver-combate")?.addEventListener("click", () => resolverCombate());
  // [UNDAVAR-PARTE-4.2h2-PAREJA] Crear o quitar la copia de las hermanas
  qs("#btn-duplicar-existencia")?.addEventListener("click", () => duplicarExistenciaCombate(atacante, c.storeA));
  qs("#btn-deshacer-duplicacion")?.addEventListener("click", () => deshacerDuplicacionCombate(atacante));

  pintarResultadoCombate();
}

// [UNDAVAR-PARTE-4.2c4] Suma una marca de estado y aplica las heridas que correspondan
function sumarEstado(actor, key, cantidad = 1) {
  if (!actor.system.extensionEstado) actor.system.extensionEstado = {};
  if (!actor.system.estado) actor.system.estado = {};
  const actual = Number(actor.system.extensionEstado[key]?.value) || 0;
  actor.system.extensionEstado[key] = { value: actual + cantidad };

  const ext = actor.system.extensionEstado;
  const total = (Number(ext.hambre?.value) || 0) + (Number(ext.sed?.value) || 0) +
    (Number(ext.cansancio?.value) || 0) + (Number(ext.fatiga?.value) || 0);
  const nuevoBonus = Math.floor(total / 2);
  const previo = Number(actor.system.estado?.heridasCausadasPorEstado) || 0;
  if (nuevoBonus > previo) {
    const delta = nuevoBonus - previo;
    if (!actor.system.estado) actor.system.estado = {};
    actor.system.estado.ptHerida = actor.system.estado.ptHerida || { value: 0, max: 8 };
    actor.system.estado.ptHerida.value = Math.min(8, (Number(actor.system.estado.ptHerida.value) || 0) + delta);
    actor.system.estado.heridasCausadasPorEstado = nuevoBonus;
    const derivados = calcularDerivados(actor.system, actor.items);
    if (Number(actor.system.estado.ptSalud?.value) > derivados.saludLimiteActual) {
      actor.system.estado.ptSalud.value = derivados.saludLimiteActual;
    }
  }
  sincronizarEstadoVital(actor);
}

// [UNDAVAR-PARTE-4.2c5] Rebote al usar arte/arma estando herido (8/8 Pt. Herida)
function aplicarReboteAtacanteHerido(actor) {
  const d = calcularDerivados(actor.system, actor.items);
  if (d.heridasTotales < 8) return null;
  const r = tiradaRebote();
  if (r.resultado !== "Sin rebote") {
    sumarEstado(actor, r.resultado.includes("Fatiga") ? "fatiga" : "cansancio");
  }
  return r;
}

// [UNDAVAR-PARTE-4.2c6] Añade un participante a la lista de la mesa
function agregarParticipanteCombate(store, id) {
  const c = state.combate;
  if (!Array.isArray(c.lista)) c.lista = [];
  if (c.lista.some(p => p.id === id && p.store === store)) return;
  c.lista.push({ store, id });
  c.ultimo = null;
  c.undo = null;
  render();
}

// [UNDAVAR-PARTE-4.2c6] Reordena a mano y mantiene el turno en el mismo participante
function moverParticipanteCombate(idx, delta) {
  const c = state.combate;
  const destino = idx + delta;
  if (!c.lista || destino < 0 || destino >= c.lista.length) return;
  const actual = c.lista[c.turnoIdx];
  [c.lista[idx], c.lista[destino]] = [c.lista[destino], c.lista[idx]];
  c.turnoIdx = Math.max(0, c.lista.indexOf(actual));
  c.ultimo = null;
  c.undo = null;
  render();
}

// [UNDAVAR-PARTE-4.2c6] Quita un participante y ajusta el turno
function quitarParticipanteCombate(idx) {
  const c = state.combate;
  if (!c.lista || c.lista.length <= 1) {
    notificar("⚠️ La mesa necesita al menos un participante.");
    return;
  }
  c.lista.splice(idx, 1);
  if (idx < c.turnoIdx) c.turnoIdx--;
  else if (idx === c.turnoIdx) c.turnoIdx = Math.min(c.turnoIdx, c.lista.length - 1);
  c.ultimo = null;
  c.undo = null;
  render();
}

// [UNDAVAR-PARTE-4.2c6] Iniciativa: cada participante tira 4d6 y se ordena por suma
function tirarIniciativaCombate() {
  const c = state.combate;
  if (!c.lista || !c.lista.length) return;
  c.lista = c.lista.map(p => {
    const t = tiradaEstandar();
    return { ...p, iniciativa: t.suma, iniciativaDs: t.ds };
  });
  c.lista.sort((a, b) => (b.iniciativa || 0) - (a.iniciativa || 0));
  c.turnoIdx = 0;
  c.ultimo = null;
  c.undo = null;
  notificar(`🎲 Iniciativa: ${c.lista.map(p => p.iniciativa).join(" · ")}. Empieza el primero de la lista.`);
  render();
}

// [UNDAVAR-PARTE-4.2c6] Cambia al siguiente participante de la lista y recarga su PA
// [UNDAVAR-PARTE-4.2h4k-MEMORIA-COMBATE] Guarda la selección del atacante actual
function guardarSeleccionCombate(c) {
  if (!c?.idA) return;
  if (!c.memoria) c.memoria = {};
  c.memoria[`${c.storeA}::${c.idA}`] = {
    tipo: c.tipo, itemId: c.itemId, atr: c.atr, distancia: c.distancia,
    modA: c.modA, modD: c.modD, reduccionExtra: c.reduccionExtra,
    ventaja: c.ventaja, reaccion: c.reaccion,
    contraTipo: c.contraTipo, contraItemId: c.contraItemId,
    idB: c.idB, storeB: c.storeB
  };
}

// [UNDAVAR-PARTE-4.2h4k-MEMORIA-COMBATE] Restaura la selección del atacante nuevo
function cargarSeleccionCombate(c) {
  const m = c?.memoria?.[`${c.storeA}::${c.idA}`];
  if (!m) return;
  Object.assign(c, m);
}

async function cambiarTurnoCombate() {
  const c = state.combate;
  const lista = c.lista || [];
  if (lista.length < 2) { notificar("⚠️ Añade al menos dos participantes para cambiar de turno."); return; }

  // Busca el siguiente que pueda actuar (ni muerto ni inconsciente)
  let elegido = null;
  for (let paso = 1; paso < lista.length; paso++) {
    const i = ((Number(c.turnoIdx) || 0) + paso) % lista.length;
    const p = lista[i];
    const actor = await dbGet(p.store, p.id);
    if (!actor) continue;
    const vital = sincronizarEstadoVital(actor);
    if (!vital.muerto && !vital.inconsciente) { elegido = { i, p, actor }; break; }
  }
  if (!elegido) { notificar("⚠️ No hay ningún participante que pueda actuar."); return; }

  // El nuevo atacante recarga su PA
  const deriv = calcularDerivados(elegido.actor.system, elegido.actor.items);
  const esPNJ = elegido.p.store === "npcs" || elegido.actor.tipo === "npc";
  const paMax = esPNJ ? paMaximoNPC(elegido.actor, deriv) : deriv.paMaximo;
  if (paMax !== null) elegido.actor.system.pa.value = paMax;
  await dbPut(elegido.p.store, elegido.actor);

  // [UNDAVAR-PARTE-4.2h4k-MEMORIA-COMBATE] Guarda la selección del atacante saliente
  guardarSeleccionCombate(c);
  // Cambia el turno y evita que el objetivo sea el nuevo atacante
  c.turnoIdx = elegido.i;
  c.idA = elegido.p.id;
  c.storeA = elegido.p.store;
  // [UNDAVAR-PARTE-4.2h4k-MEMORIA-COMBATE] Restaura la selección del atacante entrante
  cargarSeleccionCombate(c);
  if (c.idB === c.idA && c.storeB === c.storeA) {
    const otro = lista.find(x => !(x.id === c.idA && x.store === c.storeA));
    if (otro) { c.idB = otro.id; c.storeB = otro.store; }
  }
  c.ultimo = null;
  c.undo = null;
  c.turno = (Number(c.turno) || 1) + 1;

  // [UNDAVAR-PARTE-4.2e3-TURNO] Resuelve efectos, enfriamientos y bonos al empezar el turno
  // [UNDAVAR-PARTE-4.2e4d-TURNO-COMBATE] Solo avanza el turno del participante que empieza,
  // no el de todos: así un efecto de 3 turnos dura 3 de sus turnos
  await pasarTurnoActor(elegido.actor, elegido.p.store, true);

  notificar(`🔄 Turno ${c.turno}: ataca ${elegido.actor.nombre} (PA recargado).`);
  render();
}

// [UNDAVAR-PARTE-4.2h3-PAREJA] Arma con una habilidad de duplicación cuyo requisito se cumple
function armaDuplicacion(actor) {
  return (actor?.items || []).find(i => i.type === "arma" && !esArmaComun(i) &&
    habilidadesItem(i).some(h => h.modoUso === "duplicar" && requisitoHabilidadCumplido(actor, h)));
}

// [UNDAVAR-PARTE-4.2h2-PAREJA] Registro de la duplicación
function resultadoDuplicacionHTML(actor, clon, arma, costPA, sinPA, t) {
  return `<h4>${esc(actor.nombre)} — Duplicar la existencia</h4>
    <p class="roll-nota"><b>Arma:</b> ${esc(arma.name)}</p>
    <p class="roll-nota"><b>Copia:</b> ${esc(clon.nombre)} · iniciativa ${t.suma} (${t.ds})</p>
    <p class="roll-nota">La copia tiene la misma Salud, PA, artes y armas del momento. Actúa en su propia ranura.</p>
    <p class="roll-nota">PA restantes: ${sinPA ? "∞" : (Number(actor.system.pa?.value) || 0)}.</p>`;
}

// [UNDAVAR-PARTE-4.2h2-PAREJA] Crea una copia real y oculta y la suma a la mesa
async function duplicarExistenciaCombate(actor, store) {
  const c = state.combate;
  if (state.vista !== "combate") { notificar("🧬 La duplicación solo se usa desde la mesa de combate."); return; }
  if (esClon(actor)) { notificar("🧬 La copia no puede volver a duplicarse."); return; }

  // [UNDAVAR-PARTE-4.2h3-PAREJA] Solo con una habilidad de duplicación que cumpla su requisito
  const arma = armaDuplicacion(actor);
  if (!arma) { notificar("⚠️ Necesitas las armas que exige la duplicación."); return; }

  const raiz = actor.system?.clonDe?.raizId || actor.id;
  const existente = (await dbGetAll(store)).find(a => esClon(a) && a.system?.clonDe?.raizId === raiz);
  if (existente) { notificar("🧬 Ya hay una copia activa. Deshaz la duplicación antes de crear otra."); return; }

  const e = estadoActorCombate(actor);
  const costPA = costoPANivel(Number(arma.system?.nivel) || 0);
  if (!e.sinPA && e.pa < costPA) { notificar(`⚠️ PA insuficientes (necesitas ${costPA}, tienes ${e.pa}).`); return; }
  if (!e.sinPA) actor.system.pa.value = e.pa - costPA;

  // [UNDAVAR-PARTE-4.2h2-PAREJA] Foto del momento: Salud, PA, artes y armas
  const clon = JSON.parse(JSON.stringify(actor));
  clon.id = nuevoId();
  clon.nombre = `${actor.nombre} (copia)`;
  clon.updatedAt = Date.now();
  clon.system.esClon = true;
  clon.system.clonDe = { id: actor.id, store, raizId: raiz };
  clon.system.historialTiradas = [];
  clon.system.bonosActivos = (clon.system.bonosActivos || []).filter(b => b.pasivo !== "habilidad");
  sincronizarBonosPasivos(clon);
  await dbPut(store, clon);

  // Ranura extra con su propia iniciativa, justo después del original
  const t = tiradaEstandar();
  const entrada = { store, id: clon.id, iniciativa: t.suma, iniciativaDs: t.ds, clonDe: raiz };
  const idx = c.lista.findIndex(p => p.id === actor.id && p.store === store);
  if (idx >= 0) {
    c.lista.splice(idx + 1, 0, entrada);
    if (idx < c.turnoIdx) c.turnoIdx++;
  } else c.lista.push(entrada);

  iniciarEnfriamientoArte(actor, arma, 1);
  await dbPut(store, actor);
  await logTirada(actor, resultadoDuplicacionHTML(actor, clon, arma, costPA, e.sinPA, t), store);
  c.ultimo = null;
  c.undo = null;
  notificar(`🧬 ${actor.nombre} duplica su existencia: ${clon.nombre} entra con iniciativa ${t.suma}.`);
  render();
}

// [UNDAVAR-PARTE-4.2h2-PAREJA] Quita la copia y su ranura de la mesa
async function deshacerDuplicacionCombate(original = null) {
  const c = state.combate;
  const raiz = original ? (original.system?.clonDe?.raizId || original.id) : null;
  const idxs = [];
  c.lista.forEach((p, i) => { if (p.clonDe && (!raiz || p.clonDe === raiz)) idxs.push(i); });
  if (!idxs.length) { notificar("🧬 No hay ninguna copia activa."); return; }

  for (const i of [...idxs].reverse()) {
    const p = c.lista[i];
    const clon = await dbGet(p.store, p.id);
    if (clon?.system?.esClon) await dbDelete(p.store, p.id);
    c.lista.splice(i, 1);
    if (i < c.turnoIdx) c.turnoIdx--;
    else if (i === c.turnoIdx) c.turnoIdx = Math.min(c.turnoIdx, c.lista.length - 1);
  }
  c.turnoIdx = Math.max(0, Math.min(c.lista.length - 1, c.turnoIdx));
  c.ultimo = null;
  c.undo = null;
  notificar("↩️ Duplicación deshecha.");
  render();
}

// [UNDAVAR-PARTE-4.2h2-PAREJA] Las copias no sobreviven a recargar la página
async function limpiarClonesHuerfanos() {
  for (const store of ["personajes", "npcs"]) {
    const lista = await dbGetAll(store);
    for (const a of lista) {
      if (esClon(a)) await dbDelete(store, a.id);
    }
  }
}

// [UNDAVAR-PARTE-4.2c7] Regalar PA: solo a un participante sin PA y nunca al objetivo actual
async function abrirModalRegalarPA() {
  const c = state.combate;
  const lista = c.lista || [];
  if (lista.length < 2) { notificar("⚠️ Añade participantes a la mesa."); return; }

  const filas = [];
  for (const p of lista) {
    const actor = await dbGet(p.store, p.id);
    if (!actor) continue;
    filas.push({ p, actor, e: estadoActorCombate(actor) });
  }

  const donantes = filas.filter(f => !f.e.sinPA && f.e.pa > 0);
  const esObjetivo = (f) => f.p.id === c.idB && f.p.store === c.storeB;
  const receptores = filas.filter(f => !f.e.sinPA && f.e.pa === 0 && !esObjetivo(f));

  if (!donantes.length) { notificar("⚠️ Ningún participante tiene PA para regalar."); return; }
  if (!receptores.length) { notificar("⚠️ No hay ningún participante sin PA al que regalar (el objetivo no cuenta)."); return; }

  const opciones = (listaFilas) => listaFilas.map(f =>
    `<option value="${f.p.store}::${f.p.id}">${esc(f.actor.nombre)} (${f.e.pa}/${f.e.paMax} PA)</option>`
  ).join("");

  const modal = crearModal("🤝 Regalar PA", `
    <p class="nota">Solo se puede regalar a un participante que esté sin PA y que no sea el objetivo actual.</p>
    <div class="campo-fila"><label>Quién regala</label>
      <select id="rp-origen">${opciones(donantes)}</select>
    </div>
    <div class="campo-fila"><label>Cantidad</label>
      <input type="number" id="rp-cantidad" min="1" value="1">
    </div>
    <div class="campo-fila"><label>Quién recibe (sin PA)</label>
      <select id="rp-destino">${opciones(receptores)}</select>
    </div>
    <div class="modal-acciones"><button class="btn-primario" id="rp-confirmar">Regalar</button></div>
  `);

  qs("#rp-confirmar", modal).addEventListener("click", async () => {
    const claveOrigen = qs("#rp-origen", modal)?.value || "";
    const claveDestino = qs("#rp-destino", modal)?.value || "";
    const cant = parseInt(qs("#rp-cantidad", modal)?.value) || 0;
    if (cant < 1) { notificar("⚠️ La cantidad debe ser al menos 1."); return; }

    const leerClave = (v) => {
      const corte = v.indexOf("::");
      return corte < 0 ? null : { store: v.slice(0, corte), id: v.slice(corte + 2) };
    };
    const o = leerClave(claveOrigen);
    const d = leerClave(claveDestino);
    if (!o || !d || (o.id === d.id && o.store === d.store)) {
      notificar("⚠️ Elige quién regala y quién recibe.");
      return;
    }

    // Relee de la base para no regalar PA ya gastado
    const origen = await dbGet(o.store, o.id);
    const destino = await dbGet(d.store, d.id);
    if (!origen || !destino) { notificar("⚠️ No se pudieron cargar los participantes."); return; }
    const eo = estadoActorCombate(origen);
    const edst = estadoActorCombate(destino);

    if (eo.sinPA) { notificar("⚠️ Ese participante tiene «Sin PA»: no puede regalar."); return; }
    if (eo.pa < cant) { notificar(`⚠️ ${origen.nombre} solo tiene ${eo.pa} PA.`); return; }
    if (edst.sinPA) { notificar(`⚠️ ${destino.nombre} tiene «Sin PA»: no necesita PA.`); return; }
    if (edst.pa > 0) {
      notificar(`⚠️ ${destino.nombre} ya tiene ${edst.pa} PA: solo se regala a quien está sin PA.`);
      return;
    }
    if (destino.id === c.idB && d.store === c.storeB) {
      notificar("⚠️ No se puede regalar PA al objetivo actual del golpe.");
      return;
    }
    if (edst.pa + cant > edst.paMax) {
      notificar(`⚠️ ${destino.nombre} no puede guardar más de ${edst.paMax} PA.`);
      return;
    }

    origen.system.pa.value = eo.pa - cant;
    destino.system.pa.value = edst.pa + cant;
    await dbPut(o.store, origen);
    await dbPut(d.store, destino);
    modal.remove();
    notificar(`🤝 ${origen.nombre} regala ${cant} PA a ${destino.nombre}.`);
    render();
  });
}

// [UNDAVAR-PARTE-4.2a] Resuelve el golpe y gasta PA; el daño se aplica después
// [UNDAVAR-PARTE-4.2i-ESTADOS] Suma PdC a la bolsa sin asignar
function sumarPdC(actor, cantidad) {
  if (!actor?.system) return 0;
  if (!actor.system.pdc) actor.system.pdc = {};
  actor.system.pdc.sinAsignar = (Number(actor.system.pdc.sinAsignar) || 0) + (Number(cantidad) || 0);
  return actor.system.pdc.sinAsignar;
}

// [UNDAVAR-PARTE-4.2h5-MESA] Resumen del golpe para el historial de cada actor
function resultadoCombateHistorialHTML(r, lado) {
  const esAtaque = lado === "atacante";
  const titulo = esAtaque
    ? `${r.atacante.nombre} → ${r.defensor.nombre}`
    : `${r.defensor.nombre} recibe de ${r.atacante.nombre}`;
  const tipo = r.tipo === "normal" ? "Ataque normal" : `${r.item}${r.nivel ? ` · Nv.${r.nivel}` : ""}`;
  const habTxt = r.habNombre ? ` — ${r.habNombre}` : "";
  const dano = esAtaque
    ? `<p class="roll-nota"><b>Daño:</b> ${r.acierta && r.final > 0 ? `${r.final} (${r.totalDano} − ${r.reduccion} reducción)` : "0"}.</p>`
    : `<p class="roll-nota"><b>Daño recibido:</b> ${r.acierta && r.final > 0 ? r.final : "0"}.</p>`;
  const efAplica = r.efectoCombate && (esAtaque ? r.efectoCombate.alAtacante : !r.efectoCombate.alAtacante);
  const partesEf = efAplica ? (r.efectoCombate.partes || []).filter(p => p && p !== "sin efecto") : [];
  const ef = partesEf.length
    ? `<p class="roll-nota"><b>Efecto:</b> ${esc(partesEf.join(" · "))}.</p>` : "";
  const pdc = esAtaque && r.pdcA
    ? `<p class="roll-nota"><b>+${r.pdcA} PdC</b> (1d6 → ${r.pdcDadoA}) por ataque normal superado.</p>`
    : !esAtaque && r.pdcD
      ? `<p class="roll-nota"><b>+${r.pdcD} PdC</b> (1d6 → ${r.pdcDadoD}) por defensa de ingenio superada.</p>` : "";
  return `<h4>${esc(titulo)}</h4>
    <p class="roll-nota">${esc(tipo)}${esc(habTxt)}.</p>
    ${dano}${ef}${pdc}`;
}

async function resolverCombate() {
  const c = state.combate;
  const atacante = await dbGet(c.storeA, c.idA);
  const defensor = await dbGet(c.storeB, c.idB);
  if (!atacante || !defensor) { notificar("⚠️ Faltan contendientes."); return; }

  // [UNDAVAR-PARTE-4.2c-VITAL] Un muerto o inconsciente no puede atacar
  const vitalA = sincronizarEstadoVital(atacante);
  const vitalD = sincronizarEstadoVital(defensor);
  if (vitalA.muerto) { notificar(`☠️ ${atacante.nombre} está muerto y no puede atacar.`); return; }
  if (vitalA.inconsciente) { notificar(`😵 ${atacante.nombre} está inconsciente y no puede atacar.`); return; }

  // [UNDAVAR-PARTE-10.4-ARMAS] Las armas comunes no se eligen como arte o arma
  const arts = (atacante.items || []).filter(i => i.type === "arte" || (i.type === "arma" && !esArmaComun(i)));
  const item = c.tipo === "normal" ? null : arts.find(i => i.id === c.itemId) || null;
  if (c.tipo !== "normal" && !item) { notificar("⚠️ Elige un arte o arma."); return; }

  // [UNDAVAR-PARTE-4.2h5-MESA] Elige qué habilidad del arte/arma se lanza
  let hab = null;
  if (item) {
    hab = await elegirHabilidad(item, atacante);
    if (!hab) return;
  }

  const nivel = item ? Number(item.system?.nivel) || 0 : 0;
  const costeA = costeAtaqueCombate(c.tipo, nivel);

  const derivA = calcularDerivados(atacante.system, atacante.items);
  const derivD = calcularDerivados(defensor.system, defensor.items);

  // [UNDAVAR-PARTE-4.2c2-HERIDO] «Herido» es tener los 8 Pt. Herida, no cualquier herida
  const heridoA = derivA.heridasTotales >= 8;
  const heridoD = derivD.heridasTotales >= 8;

  // [UNDAVAR-PARTE-3.9a] PA infinito solo si el PNJ tiene «Sin PA» marcado
  const esPNJA = c.storeA === "npcs" || atacante.tipo === "npc";
  const esPNJD = c.storeB === "npcs" || defensor.tipo === "npc";
  const paMaxA = esPNJA ? paMaximoNPC(atacante, derivA) : derivA.paMaximo;
  const paMaxD = esPNJD ? paMaximoNPC(defensor, derivD) : derivD.paMaximo;
  const infA = paMaxA === null;
  const infD = paMaxD === null;
  const paA = infA ? (Number(atacante.system.pa?.value) || 0) : Math.min(Number(atacante.system.pa?.value) || 0, paMaxA);
  const paD = infD ? (Number(defensor.system.pa?.value) || 0) : Math.min(Number(defensor.system.pa?.value) || 0, paMaxD);

  // [UNDAVAR-PARTE-4.2c4] Reacciones: inconsciente solo esquive; sin PA no hay defensa
  const contrasD = (defensor.items || []).filter(i => i.type === "arte" || (i.type === "arma" && !esArmaComun(i)));
  const contraItemD = contrasD.find(i => i.id === c.contraItemId) || null;
  const contraNivelD = contraItemD ? Number(contraItemD.system?.nivel) || 0 : 0;
  // [UNDAVAR-PARTE-4.2c4] Sin arte/arma, el contraataque cae a ataque normal
  const contraTipoRes = (c.contraTipo !== "normal" && !contraItemD) ? "normal" : (c.contraTipo || "normal");
  const costeContraD = costeAtaqueCombate(contraTipoRes, contraNivelD);

  const soloEsquiveD = !vitalD.muerto && vitalD.inconsciente;
  let reaccion = vitalD.muerto ? "ninguna" : soloEsquiveD ? "esquive" : (c.reaccion || "ninguna");
  let costeD = vitalD.muerto ? 0 : costeReaccionCombate(reaccion, costeContraD);
  // Sin PA no hay reacción: el defensor recibe el golpe
  if (!infD && reaccion !== "ninguna" && costeD > paD) {
    reaccion = "ninguna";
    costeD = 0;
  }

  if (!infA && paA < costeA) { notificar(`⚠️ ${atacante.nombre} no tiene PA suficientes (${paA}/${costeA}).`); return; }

  const bonoNivel = bonusCombate(nivel);
  // [UNDAVAR-PARTE-4.2e4-BONOS] Suma los bonos de aciertos al ataque y a la defensa
  const modA = (Number(c.modA) || 0) + bonoNivel + bonoAciertos(atacante);
  const modD = (Number(c.modD) || 0) + bonoAciertos(defensor);
  const enAlcance = c.distancia === "alcance";

  let ataque = null, ataque2 = null, defensa = null, defensaExtra = null;
  let acierta = false, empate = false, mitad = false, anulado = false;
  let contraGana = false, contraEmpata = false;
  let nota = "";

  const pjA = c.storeA === "personajes";
  const pjD = c.storeB === "personajes";
  const sinDefensa = vitalD.muerto || reaccion === "ninguna";

  if (sinDefensa) {
    acierta = true;
    nota = vitalD.muerto
      ? "El defensor está muerto: no se defiende."
      : "Sin reacción: el defensor no gasta PA y recibe el golpe.";
  } else {
    // [UNDAVAR-PARTE-4.2c4] Toda reacción es una tirada enfrentada 4d6 vs 4d6
    const desventaja = heridoA && !c.ventaja;
    const ventaja = c.ventaja && !heridoA;
    ataque = tirarAtaqueConVentaja(modA, ventaja, desventaja);

    if (reaccion === "esquive" && !enAlcance) {
      // [UNDAVAR-PARTE-4.2c4] Fuera de alcance: el atacante necesita dos tiradas consecutivas
      ataque2 = tirarAtaqueConVentaja(modA, ventaja, desventaja);
      defensa = tiradaEstandar();
      defensaExtra = tiradaEstandar();
      const totalD1 = defensa.aciertos + modD;
      const totalD2 = defensaExtra.aciertos + modD;
      const gana1 = ataque.total > totalD1;
      const gana2 = ataque2.total > totalD2;
      acierta = gana1 && gana2;
      empate = !acierta && (ataque.total === totalD1 || ataque2.total === totalD2);
      nota = acierta
        ? "Esquive fuera de alcance: el atacante ganó las dos tiradas consecutivas."
        : "Esquive fuera de alcance: el atacante falló o empató una de las dos tiradas; no hay daño.";
    } else {
      defensa = tiradaEstandar();
      const totalD = defensa.aciertos + modD;

      if (reaccion === "esquive") {
        // [UNDAVAR-PARTE-4.2c4] En alcance: gana o empata → 0 daño
        acierta = ataque.total > totalD;
        empate = ataque.total === totalD;
        nota = acierta
          ? "Esquive superado: el ataque entra."
          : empate
            ? "Empate en el esquive: el defensor evita el daño."
            : "El esquive supera el ataque: no hay daño.";
      } else if (reaccion === "ingenio") {
        // [UNDAVAR-PARTE-4.2i-ESTADOS] Defensa normal con el entorno: gana o empata → 0 daño
        acierta = ataque.total > totalD;
        empate = ataque.total === totalD;
        nota = acierta
          ? "La defensa de ingenio no supera el ataque: daño completo."
          : empate
            ? "Empate: la defensa de ingenio mantiene el ataque a raya."
            : "La defensa de ingenio supera el ataque: no hay daño y gana 1d6 PdC.";
      } else if (reaccion === "bloqueo") {
        if (ataque.total > totalD) {
          acierta = true;
          nota = "El bloqueo no supera el ataque: daño completo.";
        } else if (ataque.total < totalD) {
          acierta = true;
          mitad = true;
          if (defensa.aciertos >= 4) { anulado = true; mitad = false; }
          nota = anulado
            ? "Bloqueo con 4 aciertos: el daño queda anulado por completo."
            : "Bloqueo superado: el daño se reduce a la mitad.";
        } else {
          empate = true;
          // [UNDAVAR-PARTE-4.2c4] Empates según el manual
          if (pjA && pjD) {
            acierta = true; mitad = true;
            nota = "Empate PJ vs PJ: el defensor recibe la mitad del daño y el atacante sufre rebote.";
          } else if (pjD) {
            acierta = true; mitad = true;
            nota = "Empate PNJ vs PJ: el jugador defiende; daño a la mitad.";
          } else if (pjA) {
            acierta = true;
            nota = "Empate PJ vs PNJ: el atacante acierta con daño completo.";
          } else {
            acierta = false;
            nota = "Empate PNJ vs PNJ: se mantiene el bloqueo.";
          }
        }
      } else if (reaccion === "contraataque") {
        contraGana = ataque.total < totalD;
        contraEmpata = ataque.total === totalD;
        if (ataque.total > totalD) {
          acierta = true;
          nota = "El contraataque falla: daño completo y la acción queda cancelada.";
        } else if (contraEmpata) {
          acierta = true;
          empate = true;
          mitad = true;
          nota = "Empate en el contraataque: ambos reciben la mitad del daño.";
        } else {
          nota = "Contraataque superado: el defensor desvía el ataque y devuelve daño.";
        }
      }
    }
  }

  // [UNDAVAR-PARTE-4.2h4m-ACUMULATIVO] Aplica el bono antes de tirar el daño:
  // el primer golpe ya cuenta con su valor base y la secuencia es 1, 2, 3…
  if (hab && Array.isArray(hab.bonos) && hab.bonos.length && c.tipo !== "normal") {
    const nombreHab = hab.nombre ? `${item.name} — ${hab.nombre}` : item.name;
    const rBonos = aplicarBonosHabilidad(atacante, item, hab, nombreHab, 1);
    if (rBonos.renovados.length) notificar(`⚔️ ${nombreHab}:${avisoBonoRenovado(rBonos)}`);
  }

  let dano = null, danoAlt = null, totalDano = 0, reduccion = 0, final = 0;
  if (acierta && !anulado) {
    const atr = atributoEfectivo(atacante, c.atr, true);
    dano = aplicarBonoDano(tiradaDanoNivel(nivel, atr, { rango: derivA.rango }), atacante);
    totalDano = dano.danoTotal;
    if (heridoD) {
      danoAlt = aplicarBonoDano(tiradaDanoNivel(nivel, atr, { rango: derivA.rango }), atacante);
      totalDano = Math.max(totalDano, danoAlt.danoTotal);
    }
    if (mitad) totalDano = Math.ceil(totalDano / 2);
    // [UNDAVAR-PARTE-4.2h4j-ARMADURA] Solo cuenta la reducción de los objetos equipados
    reduccion = reduccionArmadura(defensor) + (Number(c.reduccionExtra) || 0);
    final = Math.max(0, totalDano - reduccion);
  }

  // [UNDAVAR-PARTE-4.2c4] Contraataque: gana → daño completo; empata → mitad
  let contraataque = null;
  if (reaccion === "contraataque" && !sinDefensa && (contraGana || contraEmpata)) {
    // [UNDAVAR-PARTE-4.2c4] El recurso del contraataque decide el atributo: arte → inteligencia
    const atrContra = contraTipoRes === "arte" ? "inteligencia" : "fuerza";
    const atrD = atributoEfectivo(defensor, atrContra, true);
    const danoContra = aplicarBonoDano(tiradaDanoNivel(contraNivelD, atrD, { rango: derivD.rango }), defensor);
    let totalContra = danoContra.danoTotal;
    if (contraEmpata) totalContra = Math.ceil(totalContra / 2);
    const reduccionContra = reduccionArmadura(atacante);
    const finalContra = Math.max(0, totalContra - reduccionContra);
    contraataque = {
      dano: danoContra, totalDano: totalContra, reduccion: reduccionContra, final: finalContra,
      empata: contraEmpata, tipo: contraTipoRes, item: contraItemD?.name || "Ataque normal", nivel: contraNivelD
    };
  }

  // [UNDAVAR-PARTE-4.2c4] Rebote del defensor herido 8/8 al bloquear o contraatacar
  let reboteD = null;
  if (heridoD && (reaccion === "bloqueo" || (reaccion === "contraataque" && contraTipoRes !== "normal"))) {
    reboteD = tiradaRebote();
  }
  // [UNDAVAR-PARTE-4.2c5] Rebote del atacante herido 8/8 al usar arte/arma
  let reboteA = null;
  if (heridoA && c.tipo !== "normal") reboteA = tiradaRebote();

  // [UNDAVAR-PARTE-3.9a] Consume PA salvo en PNJ con «Sin PA» marcado
  if (!infA) atacante.system.pa.value = Math.max(0, paA - costeA);
  if (!infD) defensor.system.pa.value = Math.max(0, paD - costeD);

  // [UNDAVAR-PARTE-4.2b-REACCIONES] Instantánea previa al daño para poder deshacer
  const heridasAAntes = Math.min(8, Number(atacante.system.estado?.ptHerida?.value) || 0);
  const saludAAntes = Number(atacante.system.estado?.ptSalud?.value) || 0;
  const heridasDAntes = Math.min(8, Number(defensor.system.estado?.ptHerida?.value) || 0);
  const saludDAntes = Number(defensor.system.estado?.ptSalud?.value) || 0;
  // [UNDAVAR-PARTE-4.2c-VITAL] También se guarda el estado vital para deshacer
  const vitalAAntes = { inconsciente: !!vitalA.inconsciente, muerto: !!vitalA.muerto, intentos: Number(vitalA.intentosDespertar) || 0 };
  const vitalDAntes = { inconsciente: !!vitalD.inconsciente, muerto: !!vitalD.muerto, intentos: Number(vitalD.intentosDespertar) || 0 };
  // [UNDAVAR-PARTE-4.2c4] Estados previos al rebote para poder deshacer
  const estadosAAntes = JSON.parse(JSON.stringify(atacante.system.extensionEstado || {}));
  const estadosDAntes = JSON.parse(JSON.stringify(defensor.system.extensionEstado || {}));
  const heridasEstadoAAntes = Number(atacante.system.estado?.heridasCausadasPorEstado) || 0;
  const heridasEstadoDAntes = Number(defensor.system.estado?.heridasCausadasPorEstado) || 0;

  // [UNDAVAR-PARTE-4.2c4] El rebote se aplica al resolver la reacción
  if (reboteD && reboteD.resultado !== "Sin rebote") {
    sumarEstado(defensor, reboteD.resultado.includes("Fatiga") ? "fatiga" : "cansancio");
  }
  // [UNDAVAR-PARTE-4.2c5] El rebote del atacante se aplica al usar el arte/arma
  if (reboteA && reboteA.resultado !== "Sin rebote") {
    sumarEstado(atacante, reboteA.resultado.includes("Fatiga") ? "fatiga" : "cansancio");
  }

  // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Efecto de la habilidad en el mismo golpe
  let efectoCombate = null;
  if (hab && hab.aplicaEfecto && c.tipo !== "normal") {
    const objetivoTipo = hab.efectoMecanico?.objetivo || "ambos";
    const alAtacante = objetivoTipo === "propio";
    // Si falla el ataque, el efecto solo se aplica al lanzador
    if (acierta || alAtacante) {
      const objetivoEf = alAtacante ? atacante : defensor;
      const storeEf = alAtacante ? c.storeA : c.storeB;
      const nombreHab = hab.nombre ? `${item.name} — ${hab.nombre}` : item.name;
      const partes = await aplicarEfectoHabilidad(atacante, c.storeA, item, hab, objetivoEf, storeEf, nombreHab);
      efectoCombate = { objetivo: objetivoEf.nombre, partes, alAtacante };
    }
  }

  // [UNDAVAR-PARTE-4.2i-ESTADOS] PdC por ataque normal o defensa de ingenio superada
  // [UNDAVAR-PARTE-4.2h4j-PDC-DADO] La cantidad sale de 1d6, no de un +3 fijo
  let pdcA = 0, pdcD = 0, pdcDadoA = 0, pdcDadoD = 0;
  if (c.tipo === "normal" && acierta) {
    pdcDadoA = lanzarDados(1)[0];
    pdcA = pdcDadoA;
    sumarPdC(atacante, pdcA);
  }
  if (reaccion === "ingenio" && !acierta && !empate) {
    pdcDadoD = lanzarDados(1)[0];
    pdcD = pdcDadoD;
    sumarPdC(defensor, pdcD);
  }

  await dbPut(c.storeA, atacante);
  await dbPut(c.storeB, defensor);

  c.ultimo = {
    aplicado: false,
    contraAplicado: false,
    res: {
      tipo: c.tipo, item: item?.name || "Ataque normal", nivel,
      habNombre: hab?.nombre || "",
      enAlcance, ataque, ataque2, defensa, defensaExtra, modA, modD, bonoNivel,
      acierta, empate, mitad, anulado, nota,
      dano, danoAlt, totalDano, reduccion, final,
      contraataque, reaccion, reboteD, reboteA,
      efectoCombate, pdcA, pdcD, pdcDadoA, pdcDadoD,
      contraTipo: contraTipoRes, contraItem: contraItemD?.name || "Ataque normal", contraNivel: contraNivelD, costeContraD,
      heridoA, heridoD, costeA, costeD, infA, infD,
      paAAntes: paA, paDAntes: paD,
      heridasAAntes, saludAAntes, heridasDAntes, saludDAntes,
      vitalAAntes, vitalDAntes,
      atacante: { nombre: atacante.nombre, id: c.idA, store: c.storeA },
      defensor: { nombre: defensor.nombre, id: c.idB, store: c.storeB }
    }
  };
  // [UNDAVAR-PARTE-4.2b-REACCIONES] La instantánea permite deshacer daño y PA juntos
  c.undo = {
    defensor: { store: c.storeB, id: c.idB, heridas: heridasDAntes, salud: saludDAntes, pa: paD, estados: estadosDAntes, heridasEstado: heridasEstadoDAntes, ...vitalDAntes },
    atacante: { store: c.storeA, id: c.idA, heridas: heridasAAntes, salud: saludAAntes, pa: paA, estados: estadosAAntes, heridasEstado: heridasEstadoAAntes, ...vitalAAntes }
  };

  // [UNDAVAR-PARTE-4.2h5-MESA] Cada golpe queda en el historial de los implicados
  const resFinal = c.ultimo.res;
  await logTirada(atacante, resultadoCombateHistorialHTML(resFinal, "atacante"), c.storeA);
  const huboEfectoDefensor = resFinal.efectoCombate && !resFinal.efectoCombate.alAtacante;
  if ((resFinal.acierta && resFinal.final > 0) || huboEfectoDefensor || resFinal.pdcD) {
    await logTirada(defensor, resultadoCombateHistorialHTML(resFinal, "defensor"), c.storeB);
  }
  render();
}

function htmlResultadoCombate() {
  const u = state.combate.ultimo;
  if (!u) return `<p class="vacio">Configura el golpe y presiona «Resolver golpe».</p>`;
  const r = u.res;
  const tipoTxt = r.tipo === "normal" ? "Ataque normal" : `${r.item} · Nv.${r.nivel}${r.habNombre ? ` — ${r.habNombre}` : ""}`;
  // [UNDAVAR-PARTE-4.2c4] Tiradas de la reacción: ataque, segunda tirada y defensa(s)
  const etiquetaReaccion = r.reaccion === "bloqueo" ? "Bloqueo" : r.reaccion === "esquive" ? "Esquive" : r.reaccion === "contraataque" ? "Contraataque" : r.reaccion === "ingenio" ? "Defensa de ingenio" : "";
  const tiradas = !r.ataque ? "" : `
    <div class="combate-tiradas">
      <div class="combate-tirada">
        <div class="combate-tirada-cab"><span>Atacante: ${esc(r.atacante.nombre)}${r.ataque2 ? " · tirada 1" : ""}</span><b>${r.ataque.total}</b></div>
        ${dadosHTML(r.ataque.tirada.ds)}
        <div class="combate-nota">${r.ataque.tirada.aciertos} + ${r.modA} modificadores${r.bonoNivel ? ` (incluye +${r.bonoNivel} por nivel)` : ""}${r.ataque.extra ? ` · ${r.ataque.modo}: segunda tirada ${r.ataque.extra.aciertos}` : ""}</div>
      </div>
      ${r.ataque2 ? `
      <div class="combate-tirada">
        <div class="combate-tirada-cab"><span>Atacante: ${esc(r.atacante.nombre)} · tirada 2</span><b>${r.ataque2.total}</b></div>
        ${dadosHTML(r.ataque2.tirada.ds)}
        <div class="combate-nota">${r.ataque2.tirada.aciertos} + ${r.modA} modificadores${r.ataque2.extra ? ` · ${r.ataque2.modo}: segunda tirada ${r.ataque2.extra.aciertos}` : ""}</div>
      </div>` : ""}
      <div class="combate-tirada">
        <div class="combate-tirada-cab"><span>Defensor: ${esc(r.defensor.nombre)}${etiquetaReaccion ? ` · ${etiquetaReaccion}` : ""}${r.defensaExtra ? " · tirada 1" : ""}</span><b>${r.defensa.aciertos + r.modD}</b></div>
        ${dadosHTML(r.defensa.ds)}
        <div class="combate-nota">${r.defensa.aciertos} + ${r.modD} modificadores</div>
      </div>
      ${r.defensaExtra ? `
      <div class="combate-tirada">
        <div class="combate-tirada-cab"><span>Defensor: ${esc(r.defensor.nombre)} · tirada 2</span><b>${r.defensaExtra.aciertos + r.modD}</b></div>
        ${dadosHTML(r.defensaExtra.ds)}
        <div class="combate-nota">${r.defensaExtra.aciertos} + ${r.modD} modificadores</div>
      </div>` : ""}
    </div>`;

  const veredicto = r.anulado
    ? "🛡️ Bloqueo perfecto: daño anulado"
    : (r.contraataque && !r.acierta)
      ? "🛡️ Contraataque: devuelve daño"
      : r.acierta
        ? (r.empate ? "🤝 Empate: el golpe entra" : "✅ Acierta")
        : (r.empate ? "🤝 Empate: se mantiene la defensa" : "❌ La defensa supera el ataque");

  const danoHTML = (!r.acierta || !r.dano) ? "" : `
    <div class="combate-dano">
      <div class="combate-tirada-cab"><span>Daño (${r.dano.ds.length}d6 + ${r.dano.bonoFijo})</span><b>${r.totalDano}</b></div>
      ${dadosHTML(r.dano.ds)}
      ${r.danoAlt ? `<div class="combate-nota">Defensor herido: segunda tirada ${r.danoAlt.danoTotal}; se queda la mayor.</div>` : ""}
      ${r.mitad ? `<div class="combate-nota">Daño reducido a la mitad (bloqueo o empate).</div>` : ""}
      <div class="combate-nota">Reducción por armadura y extras: −${r.reduccion} → <b>${r.final}</b> de daño.</div>
      ${r.final === 0 ? `<p class="combate-nota">La armadura absorbe todo el daño.</p>` : ""}
    </div>`;

  // [UNDAVAR-PARTE-4.2a3] Aviso explícito cuando la tirada enfrentada no concede daño
  // [UNDAVAR-PARTE-4.2c4] El bloqueo anulado también se avisa
  const sinDanoHTML = r.anulado
    ? `<p class="combate-sin-dano">🛡️ Bloqueo perfecto: el daño queda anulado por completo.</p>`
    : (!r.acierta && !r.contraataque)
      ? `<p class="combate-sin-dano">${r.empate ? "Empate a favor de la defensa: no se lanza daño." : "La defensa superó el ataque: no se lanza daño."}</p>`
      : "";

  // [UNDAVAR-PARTE-4.2c4] Daño devuelto por el contraataque (completo o a la mitad)
  const contraHTML = r.contraataque ? `
    <div class="combate-dano combate-contraataque">
      <div class="combate-tirada-cab"><span>Contraataque de ${esc(r.defensor.nombre)} · ${esc(r.contraataque.item)}${r.contraataque.nivel ? ` Nv.${r.contraataque.nivel}` : ""} (${r.contraataque.dano.ds.length}d6)</span><b>${r.contraataque.totalDano}</b></div>
      ${dadosHTML(r.contraataque.dano.ds)}
      ${r.contraataque.empata ? `<div class="combate-nota">Empate: el contraataque también se reduce a la mitad.</div>` : ""}
      <div class="combate-nota">Reducción por armadura del atacante: −${r.contraataque.reduccion} → <b>${r.contraataque.final}</b> de daño.</div>
      ${r.contraataque.final === 0 ? `<p class="combate-nota">La armadura absorbe todo el contraataque.</p>` : ""}
    </div>` : "";

  // [UNDAVAR-PARTE-4.2c4] Rebote del defensor herido al bloquear o contraatacar
  const reboteHTML = r.reboteD ? `
    <div class="combate-dano">
      <div class="combate-tirada-cab"><span>Rebote de ${esc(r.defensor.nombre)} (4d6)</span><b>${r.reboteD.aciertos} aciertos</b></div>
      ${dadosHTML(r.reboteD.ds)}
      <div class="combate-nota">${r.reboteD.resultado === "Sin rebote" ? "Sin rebote." : `Rebote: ${r.reboteD.resultado}.`}</div>
    </div>` : "";

  // [UNDAVAR-PARTE-4.2c5] Rebote del atacante herido al usar arte/arma
  const reboteAHTML = r.reboteA ? `
    <div class="combate-dano">
      <div class="combate-tirada-cab"><span>Rebote de ${esc(r.atacante.nombre)} (4d6)</span><b>${r.reboteA.aciertos} aciertos</b></div>
      ${dadosHTML(r.reboteA.ds)}
      <div class="combate-nota">${r.reboteA.resultado === "Sin rebote" ? "Sin rebote." : `Rebote: ${r.reboteA.resultado}.`}</div>
    </div>` : "";

  const hayBotonDano = r.acierta && r.final > 0;
  const hayBotonContra = r.contraataque && r.contraataque.final > 0;
  const hayBotonDeshacer = !!state.combate.undo;
  const botones = (hayBotonDano || hayBotonContra || hayBotonDeshacer) ? `
    <div class="modal-acciones combate-acciones">
      ${hayBotonDano ? `<button class="btn-primario" id="btn-aplicar-dano" ${u.aplicado ? "disabled" : ""}>Aplicar daño</button>` : ""}
      ${hayBotonContra ? `<button class="btn-primario" id="btn-aplicar-contraataque" ${u.contraAplicado ? "disabled" : ""}>Aplicar contraataque</button>` : ""}
      ${hayBotonDeshacer ? `<button class="btn-secundario" id="btn-deshacer-dano">Deshacer último golpe</button>` : ""}
    </div>` : "";

  const aplicado = u.aplicado && u.resultado
    ? `<p class="combate-aplicado">Aplicado a ${esc(r.defensor.nombre)}: ${u.resultado.heridas}/8 heridas · ${u.resultado.salud} de salud${u.resultado.exceso ? ` · ${u.resultado.exceso} de daño pasaron directos a salud` : ""}.</p>`
    : "";

  const contraAplicado = u.contraAplicado && u.resultadoContra
    ? `<p class="combate-aplicado">Contraataque aplicado a ${esc(r.atacante.nombre)}: ${u.resultadoContra.heridas}/8 heridas · ${u.resultadoContra.salud} de salud${u.resultadoContra.exceso ? ` · ${u.resultadoContra.exceso} de daño pasaron directos a salud` : ""}.</p>`
    : "";

  // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Efecto aplicado junto al golpe
  const efectoCombateHTML = r.efectoCombate
    ? `<div class="combate-dano">
        <div class="combate-tirada-cab"><span>Efecto de la habilidad en ${esc(r.efectoCombate.objetivo)}</span></div>
        <div class="combate-nota">${esc((r.efectoCombate.partes || []).join(" · ") || "Sin cambios.")}</div>
      </div>` : "";

  // [UNDAVAR-PARTE-4.2i-ESTADOS] PdC ganados por ataque normal o defensa de ingenio
  const pdcHTML = (r.pdcA || r.pdcD)
    ? `<p class="combate-nota">Puntos de Conveniencia: ${r.pdcA ? `${esc(r.atacante.nombre)} +${r.pdcA} (1d6 → ${r.pdcDadoA})` : ""}${r.pdcA && r.pdcD ? " · " : ""}${r.pdcD ? `${esc(r.defensor.nombre)} +${r.pdcD} (1d6 → ${r.pdcDadoD})` : ""}.</p>`
    : "";

  return `
    <div class="combate-resultado-cab">
      <div><span class="combate-tipo">${esc(tipoTxt)}</span> · ${esc(r.atacante.nombre)} contra ${esc(r.defensor.nombre)}</div>
      <div class="combate-veredicto ${(r.acierta || r.anulado || (r.contraataque && !r.acierta)) ? "ok" : "no"}">${veredicto}</div>
    </div>
    ${tiradas}
    ${r.nota ? `<p class="combate-nota">${esc(r.nota)}</p>` : ""}
    ${danoHTML}
    ${contraHTML}
    ${efectoCombateHTML}
    ${reboteHTML}
    ${reboteAHTML}
    ${sinDanoHTML}
    ${aplicado}
    ${contraAplicado}
    ${pdcHTML}
    ${botones}
    <p class="combate-nota">Coste: ${esc(r.atacante.nombre)} ${r.infA ? "PNJ sin PA (∞)" : `${r.costeA} PA`} · ${esc(r.defensor.nombre)} ${r.infD ? "PNJ sin PA (∞)" : `${r.costeD} PA`}.</p>`;
}

function pintarResultadoCombate() {
  const cont = qs("#resultado-combate");
  if (!cont) return;
  cont.innerHTML = htmlResultadoCombate();
  qs("#btn-aplicar-dano", cont)?.addEventListener("click", aplicarDanoCombate);
  qs("#btn-aplicar-contraataque", cont)?.addEventListener("click", aplicarContraataqueCombate);
  qs("#btn-deshacer-dano", cont)?.addEventListener("click", deshacerDanoCombate);
}

// [UNDAVAR-PARTE-4.2b-REACCIONES] Aplica daño a un actor y devuelve el estado resultante
async function aplicarDanoAActor(store, id, cantidad) {
  const actor = await dbGet(store, id);
  if (!actor) return null;

  const heridasAntes = Math.min(8, Number(actor.system.estado?.ptHerida?.value) || 0);
  const saludAntes = Number(actor.system.estado?.ptSalud?.value) || 0;
  const total = heridasAntes + cantidad;
  const nuevas = Math.min(8, total);
  const exceso = Math.max(0, total - 8);
  const penalAntes = Math.floor(heridasAntes / 4);
  const penalNuevas = Math.floor(nuevas / 4);

  if (!actor.system.estado) actor.system.estado = {};
  actor.system.estado.ptHerida = actor.system.estado.ptHerida || { value: 0, max: 8 };
  actor.system.estado.ptSalud = actor.system.estado.ptSalud || { value: 0, max: 8 };
  actor.system.estado.ptHerida.value = nuevas;

  const limite = calcularDerivados(actor.system, actor.items).saludLimiteActual;
  let salud = saludAntes - (penalNuevas - penalAntes) - exceso;
  salud = Math.max(0, Math.min(salud, limite));
  actor.system.estado.ptSalud.value = salud;
  // [UNDAVAR-PARTE-4.2c-VITAL] Salud a 0 deja inconsciente
  sincronizarEstadoVital(actor);
  await dbPut(store, actor);

  return {
    heridas: nuevas, salud, exceso,
    inconsciente: !!actor.system.estado.inconsciente,
    muerto: !!actor.system.estado.muerto
  };
}

// [UNDAVAR-PARTE-4.2a] Reparte heridas y salud; cada 4 heridas baja 1 la salud
async function aplicarDanoCombate() {
  const u = state.combate.ultimo;
  if (!u || u.aplicado) return;
  const r = u.res;
  if (!r.acierta || r.final <= 0) { notificar("No hay daño que aplicar."); return; }

  const res = await aplicarDanoAActor(r.defensor.store, r.defensor.id, r.final);
  if (!res) return;
  u.aplicado = true;
  u.resultado = res;
  notificar(`🩸 ${r.defensor.nombre}: ${r.final} de daño → ${res.heridas}/8 heridas y ${res.salud} de salud${res.inconsciente ? " · queda inconsciente" : ""}.`);
  render();
}

// [UNDAVAR-PARTE-4.2b-REACCIONES] Aplica el daño del contraataque al atacante
async function aplicarContraataqueCombate() {
  const u = state.combate.ultimo;
  if (!u || u.contraAplicado) return;
  const r = u.res;
  if (!r.contraataque || r.contraataque.final <= 0) { notificar("No hay contraataque que aplicar."); return; }

  const res = await aplicarDanoAActor(r.atacante.store, r.atacante.id, r.contraataque.final);
  if (!res) return;
  u.contraAplicado = true;
  u.resultadoContra = res;
  notificar(`⚔️ Contraataque a ${r.atacante.nombre}: ${r.contraataque.final} de daño → ${res.heridas}/8 heridas y ${res.salud} de salud${res.inconsciente ? " · queda inconsciente" : ""}.`);
  render();
}

async function deshacerDanoCombate() {
  const u = state.combate.undo;
  if (!u) return;

  const def = await dbGet(u.defensor.store, u.defensor.id);
  if (def) {
    if (!def.system.estado) def.system.estado = {};
    def.system.estado.ptHerida = def.system.estado.ptHerida || { value: 0, max: 8 };
    def.system.estado.ptSalud = def.system.estado.ptSalud || { value: 0, max: 8 };
    def.system.estado.ptHerida.value = u.defensor.heridas;
    def.system.estado.ptSalud.value = u.defensor.salud;
    // [UNDAVAR-PARTE-4.2c-VITAL] Restaura inconsciencia, muerte e intentos
    if (typeof u.defensor.inconsciente === "boolean") def.system.estado.inconsciente = u.defensor.inconsciente;
    if (typeof u.defensor.muerto === "boolean") def.system.estado.muerto = u.defensor.muerto;
    if (typeof u.defensor.intentos === "number") def.system.estado.intentosDespertar = u.defensor.intentos;
    // [UNDAVAR-PARTE-4.2c4] Restaura estados y heridas por estado (rebote)
    if (u.defensor.estados) def.system.extensionEstado = JSON.parse(JSON.stringify(u.defensor.estados));
    if (typeof u.defensor.heridasEstado === "number") def.system.estado.heridasCausadasPorEstado = u.defensor.heridasEstado;
    def.system.pa.value = u.defensor.pa;
    await dbPut(u.defensor.store, def);
  }
  const atac = await dbGet(u.atacante.store, u.atacante.id);
  if (atac) {
    if (!atac.system.estado) atac.system.estado = {};
    atac.system.estado.ptHerida = atac.system.estado.ptHerida || { value: 0, max: 8 };
    atac.system.estado.ptSalud = atac.system.estado.ptSalud || { value: 0, max: 8 };
    atac.system.estado.ptHerida.value = u.atacante.heridas;
    atac.system.estado.ptSalud.value = u.atacante.salud;
    // [UNDAVAR-PARTE-4.2c-VITAL] Restaura inconsciencia, muerte e intentos
    if (typeof u.atacante.inconsciente === "boolean") atac.system.estado.inconsciente = u.atacante.inconsciente;
    if (typeof u.atacante.muerto === "boolean") atac.system.estado.muerto = u.atacante.muerto;
    if (typeof u.atacante.intentos === "number") atac.system.estado.intentosDespertar = u.atacante.intentos;
    // [UNDAVAR-PARTE-4.2c4] Restaura estados y heridas por estado (rebote)
    if (u.atacante.estados) atac.system.extensionEstado = JSON.parse(JSON.stringify(u.atacante.estados));
    if (typeof u.atacante.heridasEstado === "number") atac.system.estado.heridasCausadasPorEstado = u.atacante.heridasEstado;
    atac.system.pa.value = u.atacante.pa;
    await dbPut(u.atacante.store, atac);
  }

  state.combate.undo = null;
  if (state.combate.ultimo) {
    state.combate.ultimo.aplicado = false;
    state.combate.ultimo.contraAplicado = false;
    state.combate.ultimo.resultado = null;
    state.combate.ultimo.resultadoContra = null;
  }
  notificar("↩️ Último golpe deshecho (daño, PA y rebote).");
  render();
}


// ============================================================
// VISTA: ENFRENTAMIENTOS RÁPIDOS (TIRADAS ENFRENTADAS)
// ============================================================
async function renderEnfrentamiento() {
  // [UNDAVAR-PARTE-4.2h2-PAREJA] Las copias no participan en enfrentamientos rápidos
  const [personajesRaw, npcsRaw] = await Promise.all([dbGetAll("personajes"), dbGetAll("npcs")]);
  const personajes = soloPersonajesReales(personajesRaw);
  const npcs = soloPersonajesReales(npcsRaw);

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
    // [UNDAVAR-PARTE-9.3C-ENFRENTAMIENTO] Guarda la pareja inicial
    guardarEstadoEnfrentamiento();
  }

  // Cargar todos los actores de la lista de participantes
  const actoresCargados = await Promise.all(
    state.enfrentamiento.participantes.map(p => dbGet(p.tipoStore, p.id))
  );

  // [UNDAVAR-PARTE-4.2c-VITAL] Muertos e inconscientes no participan en tiradas enfrentadas
  const hayBloqueado = actoresCargados.some(a => {
    if (!a) return false;
    const v = sincronizarEstadoVital(a);
    return v.muerto || v.inconsciente;
  });

  const renderPanelActor = (actor, lado, tipoStore, index) => {
    if (!actor) return `<div class="ref-bloque"><p class="vacio">Sin personaje seleccionado</p></div>`;
    const s = actor.system || {};
    const esPJ = tipoStore === "personajes";
    // [UNDAVAR-PARTE-3.9a] El PA infinito depende de «Sin PA», no de ser PNJ
    const sinPA = !esPJ && !!s.datos?.sinRangoPA;
    const paMostrado = sinPA ? "∞" : (s.pa?.value || 0);
    // [UNDAVAR-PARTE-4.2c-VITAL] Estado vital visible en el panel
    const vital = sincronizarEstadoVital(actor);

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
          <span>⚡ PA: <b>${paMostrado}</b></span>
          ${esPJ ? `<span>💎 PP: <b>${s.pdc?.pp || 0}</b> | PD: <b>${s.pdc?.pd || 0}</b></span>` : `<span style="color:#aaa;">PNJ</span>`}
        </div>
        ${vital.muerto ? `<p class="combate-alerta">☠️ Muerto: no puede participar.</p>` : vital.inconsciente ? `<p class="combate-alerta">😵 Inconsciente: no puede participar.</p>` : ""}

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
              <option value="fuerza">Fuerza (${Math.floor(atributoEfectivo(actor, "fuerza")/2)})</option>
              <option value="velocidad">Velocidad (${Math.floor(atributoEfectivo(actor, "velocidad")/2)})</option>
              <option value="agilidad">Agilidad (${Math.floor(atributoEfectivo(actor, "agilidad")/2)})</option>
              <option value="inteligencia">Inteligencia (${Math.floor(atributoEfectivo(actor, "inteligencia")/2)})</option>
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
      <button class="btn-primario" id="btn-resolver-enfrentamiento" style="font-size:1.2em; padding:12px 28px;" ${hayBloqueado ? "disabled" : ""}>
        🎲 Resolver enfrentamiento
      </button>
      ${hayBloqueado ? `<p class="combate-nota">Hay un participante muerto o inconsciente. Cámbialo o reactívalo para continuar.</p>` : ""}
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
    // [UNDAVAR-PARTE-9.3C-ENFRENTAMIENTO] Guarda la dificultad elegida
    guardarEstadoEnfrentamiento();
  });

  qs("#val-sr-fijo")?.addEventListener("input", (e) => {
    state.enfrentamiento.valSR = Math.max(1, parseInt(e.target.value) || 1);
    // [UNDAVAR-PARTE-9.3C-ENFRENTAMIENTO] Guarda la dificultad personalizada
    guardarEstadoEnfrentamiento();
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

      // [UNDAVAR-PARTE-4.2c-VITAL] Muertos e inconscientes no pueden tirar
      const vital = sincronizarEstadoVital(actor);
      if (vital.muerto) { notificar(`☠️ ${actor.nombre} está muerto y no puede participar.`); return; }
      if (vital.inconsciente) { notificar(`😵 ${actor.nombre} está inconsciente y no puede participar.`); return; }

      let modAtr = 0, modPA = 0, modPdC = 0, modFijo = 0;
      let gastoPA = 0, gastoPdC = 0, tipoPdC = "ninguno";

      const selAtr = qs(`#mod-atr-${lado}`)?.value;
      if (selAtr && selAtr !== "ninguno") {
        modAtr = Math.floor(atributoEfectivo(actor, selAtr) / 2);
      }

      gastoPA = Math.max(0, parseInt(qs(`#mod-pa-${lado}`)?.value) || 0);
      // [UNDAVAR-PARTE-3.9a] PA infinito solo si el PNJ tiene «Sin PA» marcado
      const sinPA = p.tipoStore === "npcs" && !!actor.system?.datos?.sinRangoPA;
      if (!sinPA && gastoPA > (actor.system?.pa?.value || 0)) {
        notificar(`⚠️ PA insuficientes en ${actor.nombre}.`);
        return;
      }
      modPA = gastoPA;

      if (p.tipoStore === "personajes") {
        tipoPdC = qs(`#mod-pdc-tipo-${lado}`)?.value || "ninguno";
        gastoPdC = Math.max(0, parseInt(qs(`#mod-pdc-cant-${lado}`)?.value) || 0);
        if (tipoPdC !== "ninguno" && gastoPdC > 0) {
          const disponible = Number(actor.system?.pdc?.[tipoPdC]) || 0;
          if (gastoPdC > disponible) {
            notificar(`⚠️ PdC insuficientes en ${actor.nombre}.`);
            return;
          }
          modPdC = Math.floor(gastoPdC / 2);
        }
      }

      modFijo = parseInt(qs(`#mod-fijo-${lado}`)?.value) || 0;
      const modTotal = modAtr + modPA + modPdC + modFijo;

      // [UNDAVAR-PARTE-3.9a] Descuenta PA salvo en PNJ con «Sin PA» marcado
      if (gastoPA > 0 && !sinPA) actor.system.pa.value -= gastoPA;
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