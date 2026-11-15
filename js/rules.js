// ============================================================
//  UNDAVAR — Motor de Reglas (fiel al manual y al sistema Foundry)
// ============================================================

// [UNDAVAR-PARTE-5] UUID compatible con el WebView de escritorio sin contexto seguro
function nuevoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, "0"));
  return `${h.slice(0,4).join("")}-${h.slice(4,6).join("")}-${h.slice(6,8).join("")}-${h.slice(8,10).join("")}-${h.slice(10,16).join("")}`;
}

const OFICIOS_UNDAVAR = [
  { id:"medico", nombre:"Médico", descripcion:"Se dedica a curar o prevenir las enfermedades.",
    facultades:["Crear los elixires curativos.","Encontrar cualquier recurso medicinal sin dificultad. +3 de aciertos al iniciar.","Curar +2 a otros jugadores o a sí mismo sin necesidad de elixires. Cura +2 por cada rango.","+5 PE al iniciar.","+2 PD.","+1 Salud."],
    bonos:{pe:5,pd:2,salud:1} },
  { id:"cazador", nombre:"Cazador", descripcion:"Se encarga de cazar animales, bestias o seres de forma profesional.",
    facultades:["Convertir cualquier arma común en arma especial. +1 Fuerza y +1 Velocidad al atacar.","Al obtener +3 de aciertos gana +1 PD y +1 PP.","+5 PP al iniciar.","+3 PD.","+1 Fuerza."],
    bonos:{pp:5,pd:3,fuerza:1} },
  { id:"domador", nombre:"Domador", descripcion:"Domar animales salvajes o exhibir y manejar animales domados.",
    facultades:["Cántico del domador: controla cualquier bestia que escuche su voz por un corto lapso.","Sello del domador: permite domar bestias de forma permanente.","+2 PD.","+5 PP al iniciar.","+2 S al iniciar."],
    bonos:{pp:5,pd:2,s:2} },
  { id:"alquimista", nombre:"Alquimista", descripcion:"Persona que se dedica a la alquimia.",
    facultades:["Crear cualquier tipo de elixires exceptuando curativos. +2 de aciertos al lanzar.","+5 PR al iniciar.","+3 PD.","+1 S al iniciar."],
    bonos:{pr:5,pd:3,s:1} },
  { id:"asesino", nombre:"Asesino", descripcion:"Se encargan de las personas o seres que no quieres ver respirar.",
    facultades:["Visión nocturna.","Convertir objetos filosos en especiales. +2 en velocidad, +2 en aciertos.","+3 PP al iniciar."],
    bonos:{pp:3} },
  { id:"cartografo", nombre:"Cartógrafo", descripcion:"Técnica de trazar los mapas.",
    facultades:["Saber dónde está cada lugar conocido en el mapa. Al conseguir +5 de aciertos obtiene +3 suerte.","Crear nuevos mapas.","+7 PC al iniciar.","+2 S."],
    bonos:{pc:7,s:2} },
  { id:"astronomo", nombre:"Astrónomo", descripcion:"Conoce y estudia todo sobre el cielo y el universo.",
    facultades:["Usar las estrellas como brújulas. Al conseguir +5 de aciertos obtiene +3 suerte cada 2 turnos.","Mantener una buena memoria. +1 PC al finalizar cada sección.","Invocar otras estrellas durante el día. +1 de aciertos asegurado.","+2 PE al iniciar.","+1 S al iniciar."],
    bonos:{pe:2,s:1} },
  { id:"maestro_constructor", nombre:"Maestro Constructor", descripcion:"Se encarga de construir y reparar casas y edificios.",
    facultades:["+5 en PR facilitando obtención de materiales. Cada 4 turnos.","Crear refugios en cualquier lugar (niveles 1 al 6).","+4 Fuerza.","+3 PD al iniciar."],
    bonos:{pr:5,pd:3,fuerza:4} },
  { id:"artesano_guerra", nombre:"Artesano de Guerra", descripcion:"Obtiene materiales minerales y de bestias, crea armas y armaduras únicas.",
    facultades:["Encontrar materiales en cualquier lugar. +2 de aciertos asegurado.","Crear armas y armaduras.","+2 Fuerza.","+1 S al iniciar.","+2 PD al iniciar."],
    bonos:{fuerza:2,s:1,pd:2} },
  { id:"herrero", nombre:"Herrero", descripcion:"Oficio de fabricar o trabajar objetos de hierro.",
    facultades:["Crear objetos de hierro con encanto especial.","Crear objetos de hierro resistentes a cualquier factor.","+5 Fuerza total.","+3 PC al iniciar o aprender."],
    bonos:{fuerza:5,pc:3} },
  { id:"ebanista", nombre:"Ebanista", descripcion:"Oficio de trabajar con maderas finas y construir muebles de calidad.",
    facultades:["Diseñar objetos de madera con cualquier tipo de encanto especial.","Encontrar maderas de calidad. +3 de aciertos asegurado.","+3 PD al iniciar.","+3 Fuerza."],
    bonos:{pd:3,fuerza:3} },
  { id:"peleteria", nombre:"Peletería", descripcion:"Confeccionamiento de prendas y objetos de piel de calidad.",
    facultades:["Crear prendas y objetos encantados.","Crear prendas resistentes a algún elemento.","Confeccionar objetos resistentes al tiempo, ataques de segundo nivel y fuego.","+5 PD al iniciar.","+3 S al iniciar."],
    bonos:{pd:5,s:3} },
  { id:"esclavista", nombre:"Esclavista", descripcion:"Comercia los esclavos de manera legal (prohibido comerciar humanos).",
    facultades:["Marca de control: obliga al esclavo a obedecer.","Azote de esclavista: controla cualquier ser y animal al tocarlo o azotarlo.","+5 Fuerza.","+3 PP al iniciar.","+1 S al iniciar."],
    bonos:{fuerza:5,pp:3,s:1} },
  { id:"sastre", nombre:"Sastre", descripcion:"Se encargan de diseñar y arreglar todo lo que tenga que ver con telas. (Oficio de logro)",
    facultades:["Diseñar y crear ropas casi tan resistentes como las armaduras.","+7 PD al iniciar o aprender.","+3 Velocidad."],
    bonos:{pd:7,velocidad:3}, logro:true },
  { id:"cocinero", nombre:"Cocinero", descripcion:"Los mejores platos ayudan a recuperar la vitalidad. (Oficio de logro)",
    facultades:["Conseguir cualquier tipo de recurso alimenticio.","Distinguir si un alimento es bueno o malo.","Resistencia al veneno.","+4 Fuerza.","+3 PC al iniciar o aprender.","+1 Salud."],
    bonos:{fuerza:4,pc:3,salud:1}, logro:true },
  { id:"pescador", nombre:"Pescador", descripcion:"Se encarga de la pesca. (Oficio de logro)",
    facultades:["Pesca rápida.","+2 de recuperación del hambre.","+5 S al iniciar o aprender."],
    bonos:{s:5}, logro:true },
  { id:"vendedor", nombre:"Vendedor", descripcion:"Se encarga de todo tipo de ventas: casas, objetos, elixires, ropas, armaduras. (Oficio de logro)",
    facultades:["Permiso de venta: comerciar en cualquier lugar sin ser arrestado.","Convencimiento: puede forzar un conflicto para que compren algo de su arsenal.","+6 S al iniciar o aprender."],
    bonos:{s:6}, logro:true },
  { id:"granjero", nombre:"Granjero", descripcion:"Se encargan de la producción de la comida del reino. (Oficio de logro)",
    facultades:["Conseguir cualquier tipo de recurso alimenticio.","Distinguir entre cualquier planta, fruta, vegetal o carne.","+2 en puntos de conveniencia en conflictos pasivos.","+5 de recuperación del hambre.","+2 S en conflictos pasivos.","+1 Salud."],
    bonos:{s:2,salud:1}, logro:true }
];

// [UNDAVAR-PARTE-4.1b] Geografía del manual: 7 Enwes con sus Eslavas y tipo de asentamiento
const GEOGRAFIA_UNDAVAR = [
  { enwes: "Derla", region: "Norte", eslavas: [
    { nombre: "Rehi", tipo: "Metrópolis" }, { nombre: "Kafel", tipo: "Pueblo" },
    { nombre: "Oqiura", tipo: "Villa" }, { nombre: "Yed", tipo: "Pueblo" }
  ]},
  { enwes: "Onder", region: "Norte", eslavas: [
    { nombre: "Tresmina", tipo: "Villa" }, { nombre: "Faria", tipo: "Metrópolis" },
    { nombre: "Zeiwel", tipo: "Aldea" }, { nombre: "Doruval", tipo: "Aldea" }
  ]},
  { enwes: "Ydmera", region: "Sur", eslavas: [
    { nombre: "Jasmin", tipo: "Pueblo" }, { nombre: "Rousar", tipo: "Villa" },
    { nombre: "Peestal", tipo: "Aldea" }, { nombre: "Heisralwed", tipo: "Pueblo" },
    { nombre: "Gaster", tipo: "Pueblo" }
  ]},
  { enwes: "Ertal", region: "Sur", eslavas: [
    { nombre: "Weismel", tipo: "Metrópolis" }, { nombre: "Ahdal", tipo: "Villa" },
    { nombre: "Toronomo", tipo: "Aldea" }
  ]},
  { enwes: "Gostmisid", region: "Este", eslavas: [
    { nombre: "Ahdel", tipo: "Ciudad" }, { nombre: "Mosfortil", tipo: "Pueblo" },
    { nombre: "Utgara", tipo: "Villa" }, { nombre: "Senal", tipo: "Aldea" }
  ]},
  { enwes: "Ohjima", region: "Este", eslavas: [
    { nombre: "Nimeriam", tipo: "Metrópolis" }, { nombre: "Qisterl", tipo: "Pueblo" },
    { nombre: "Westernel", tipo: "Villa" }
  ]},
  { enwes: "Attal", region: "Oeste", eslavas: [
    { nombre: "Tasla", tipo: "Metrópolis" }, { nombre: "Eisira", tipo: "Aldea" },
    { nombre: "Eslara", tipo: "Pueblo" }, { nombre: "Bosminal", tipo: "Pueblo" },
    { nombre: "Asnar", tipo: "Aldea" }
  ]}
];

// [UNDAVAR-PARTE-4.1b] Los 7 Sabios Regidores del manual
const SABIOS_REGIDORES_UNDAVAR = [
  { enwes: "Derla", nombre: "Lews Silvara", procedencia: "Derla, Ertal", edad: 59, rango: "Wonrizay, Beta", clase: "Gladiador", oficio: "Sabio Regidor, Cazador", maestro: "Nile Trai" },
  { enwes: "Onder", nombre: "Lara Kail", procedencia: "Gostmisid, Ahdel", edad: 38, rango: "Leyenda, Delta", clase: "Artista", oficio: "Sabio Regidor, Médico", maestro: "Leiz Metri" },
  { enwes: "Ydmera", nombre: "Ferwal Kiart", procedencia: "Ertal, Jasmin", edad: 28, rango: "Lait Betsu, Gamma", clase: "Gladiador", oficio: "Sabio Regidor, Herrero", maestro: "Lais Kiart" },
  { enwes: "Ertal", nombre: "Kleyh Dhowar", procedencia: "Ertal, Toronomo", edad: 150, rango: "Lairazul", clase: "Gladiador", oficio: "Sabio Regidor, Herrero", maestro: "Voxwel Yura" },
  { enwes: "Gostmisid", nombre: "Termi Laska", procedencia: "Gostmisid, Mosfortil", edad: 95, rango: "Lairazul", clase: "Artista", oficio: "Sabio Regidor, Domador", maestro: "Kai Kiart" },
  { enwes: "Ohjima", nombre: "Arsavi Inre", procedencia: "Attal, Asnar", edad: 260, rango: "Lairazul", clase: "Artista", oficio: "Artista Regidor, Sastre", maestro: "Gart Kaisera" },
  { enwes: "Attal", nombre: "Erack Kiosi", procedencia: "Attal, Tasla", edad: 48, rango: "Lairazul", clase: "Artista", oficio: "Sabio Eminente, Alquimista", maestro: "Atras Lesk" }
];

const RANGOS_UNDAVAR = [
  { nombre: "Sin rango", minPV: 0, costoPC: 0, costoS: 0 },

  // Astrei
  { nombre: "Astrei", minPV: 15, costoPC: 15, costoS: 3 },
  { nombre: "Astrei Alpha", minPV: 23, costoPC: 15, costoS: 3 },
  { nombre: "Astrei Beta", minPV: 33, costoPC: 15, costoS: 3 },
  { nombre: "Astrei Gamma", minPV: 45, costoPC: 15, costoS: 3 },
  { nombre: "Astrei Delta", minPV: 59, costoPC: 15, costoS: 3 },

  // Breintin
  { nombre: "Breintin", minPV: 74, costoPC: 20, costoS: 6 },
  { nombre: "Breintin Alpha", minPV: 84, costoPC: 20, costoS: 6 },
  { nombre: "Breintin Beta", minPV: 96, costoPC: 20, costoS: 6 },
  { nombre: "Breintin Gamma", minPV: 110, costoPC: 20, costoS: 6 },
  { nombre: "Breintin Delta", minPV: 126, costoPC: 20, costoS: 6 },

  // Sedrein
  { nombre: "Sedrein", minPV: 146, costoPC: 25, costoS: 9 },
  { nombre: "Sedrein Alpha", minPV: 158, costoPC: 25, costoS: 9 },
  { nombre: "Sedrein Beta", minPV: 172, costoPC: 25, costoS: 9 },
  { nombre: "Sedrein Gamma", minPV: 188, costoPC: 25, costoS: 9 },
  { nombre: "Sedrein Delta", minPV: 206, costoPC: 25, costoS: 9 },

  // Wonrixay
  { nombre: "Wonrixay", minPV: 231, costoPC: 30, costoS: 12 },
  { nombre: "Wonrixay Alpha", minPV: 245, costoPC: 30, costoS: 12 },
  { nombre: "Wonrixay Beta", minPV: 261, costoPC: 30, costoS: 12 },
  { nombre: "Wonrixay Gamma", minPV: 279, costoPC: 30, costoS: 12 },
  { nombre: "Wonrixay Delta", minPV: 299, costoPC: 30, costoS: 12 },

  // Lait Betsu
  { nombre: "Lait Betsu", minPV: 329, costoPC: 35, costoS: 15 },
  { nombre: "Lait Betsu Alpha", minPV: 345, costoPC: 35, costoS: 15 },
  { nombre: "Lait Betsu Beta", minPV: 363, costoPC: 35, costoS: 15 },
  { nombre: "Lait Betsu Gamma", minPV: 383, costoPC: 35, costoS: 15 },
  { nombre: "Lait Betsu Delta", minPV: 405, costoPC: 35, costoS: 15 },

  // Leyenda
  { nombre: "Leyenda", minPV: 440, costoPC: 40, costoS: 18 },
  { nombre: "Leyenda Alpha", minPV: 458, costoPC: 40, costoS: 18 },
  { nombre: "Leyenda Beta", minPV: 478, costoPC: 40, costoS: 18 },
  { nombre: "Leyenda Gamma", minPV: 500, costoPC: 40, costoS: 18 },
  { nombre: "Leyenda Delta", minPV: 524, costoPC: 40, costoS: 18 },

  // Lairazul
  { nombre: "Lairazul", minPV: 564, costoPC: 45, costoS: 21 }
];

// CATALOGO MAESTRO GENERAL COMPLETO DE UNDAVAR
// [UNDAVAR-PARTE-4.2h1b-SELLO] Definición única del Sello de Sedra y sus cinco sellos
const SELLO_DE_SEDRA = {
  name: "Sello de Sedra",
  type: "arma",
  system: {
    descripcion: "Espada larga de metal oscuro. Sus cinco sellos se liberan con un gasto masivo de energía.",
    armaComun: false,
    nivel: 0,
    enfriamientoTurnos: 0,
    precio_oro: 0,
    habilidades: [
      {
        id: "sedra-1",
        nombre: "Primer sello — Poder acumulativo",
        modoUso: "dano",
        descripcion: "Aumenta el poder de ataque de forma consecutiva: cada golpe se hace más fuerte que el anterior.",
        conjuro: "Primer sello",
        efectoMecanico: null,
        condiciones: [],
        bonos: [{ estadistica: "dano", valor: 1, modo: "fijo", turnos: 3, acumulativo: true }]
      },
      {
        id: "sedra-2",
        nombre: "Segundo sello — Sol o Luna",
        modoUso: "dano",
        descripcion: "Ataque a distancia. Con luz solar causa Insolación; con luz lunar, Quemadura fría.",
        conjuro: "Segundo sello",
        efectoMecanico: null,
        condiciones: [{ id: "insolacion", turnos: 2 }, { id: "quemaduraFria", turnos: 2 }],
        bonos: []
      },
      {
        id: "sedra-3",
        nombre: "Tercer sello — Velocidad",
        modoUso: "efecto",
        descripcion: "El portador gana velocidad de ataque y de movimiento.",
        conjuro: "Tercer sello",
        efectoMecanico: null,
        condiciones: [],
        bonos: [
          { estadistica: "velocidad", valor: 2, modo: "fijo", turnos: 2 },
          { estadistica: "agilidad", valor: 2, modo: "fijo", turnos: 2 }
        ]
      },
      {
        id: "sedra-4",
        nombre: "Cuarto sello — Ilusiones tangibles",
        modoUso: "descriptiva",
        descripcion: "Crea ilusiones tangibles para el ser que haya sido creada.",
        conjuro: "Cuarto sello",
        efectoMecanico: null,
        condiciones: [],
        bonos: []
      },
      {
        // [UNDAVAR-PARTE-4.2h6-SELLO] Absorción configurable: el manual no fija cantidad
        // [UNDAVAR-PARTE-4.2h4j-SELLO5] Empieza en 0: la cantidad se configura en la ficha del arma
        id: "sedra-5",
        nombre: "Quinto sello — Absorción",
        modoUso: "efecto",
        descripcion: "Absorbe los ataques que recibe. «Absorbe, no devuelve». Configura en los bonos cuánto daño reduce por turno; el manual no fija una cantidad.",
        conjuro: "Quinto sello",
        efectoMecanico: null,
        condiciones: [],
        bonos: [{ estadistica: "reduccion", valor: 0, modo: "fijo", turnos: 1 }]
      }
    ]
  }
};

// [UNDAVAR-PARTE-4.2h3-PAREJA] Habilidades de una hermana: exigen la otra arma por nombre
function habilidadesHermana(companera) {
  return [
    {
      id: "hermanas-teleport",
      nombre: "Moverse hasta una hermana",
      modoUso: "descriptiva",
      descripcion: "El portador se mueve de forma instantánea hasta donde esté la otra espada hermana.",
      conjuro: "",
      condiciones: [],
      bonos: [],
      requisito: { armas: [companera] }
    },
    {
      id: "hermanas-duplicar",
      nombre: "Duplicar la existencia",
      modoUso: "duplicar",
      descripcion: "Crea una copia igual en poder, inteligencia y decisión. La copia entra en la mesa de combate con su propia iniciativa y actúa como otro tú.",
      conjuro: "",
      condiciones: [],
      bonos: [],
      requisito: { armas: [companera] }
    },
    {
      // [UNDAVAR-PARTE-4.2h3-PAREJA] El viento es una habilidad pasiva configurable
      id: "hermanas-viento",
      nombre: "Moverse con el viento",
      modoUso: "pasivo",
      descripcion: "Mientras se posean las dos espadas, el portador gana +2 Agilidad y +2 Velocidad.",
      conjuro: "",
      condiciones: [],
      bonos: [
        { estadistica: "agilidad", valor: 2, modo: "fijo", turnos: 1 },
        { estadistica: "velocidad", valor: 2, modo: "fijo", turnos: 1 }
      ],
      requisito: { armas: [companera] }
    }
  ];
}

// [UNDAVAR-PARTE-4.2h3-PAREJA] Las dos armas se cargan por separado; no están a la venta
const MAYDO = {
  name: "Maydo",
  type: "arma",
  system: {
    descripcion: "Espada hermana. Con Tsuida libera su poder: teletransporte hasta la otra espada, duplicación de la existencia y movimiento con el viento. Por sí sola funciona como una espada común.",
    armaComun: false,
    nivel: 0,
    modoUso: "dano",
    condiciones: [],
    precio_oro: 0,
    noVenta: true,
    habilidades: habilidadesHermana("Tsuida")
  }
};

const TSUIDA = {
  name: "Tsuida",
  type: "arma",
  system: {
    descripcion: "Espada hermana. Con Maydo libera su poder: teletransporte hasta la otra espada, duplicación de la existencia y movimiento con el viento. Por sí sola funciona como una espada común.",
    armaComun: false,
    nivel: 0,
    modoUso: "dano",
    condiciones: [],
    precio_oro: 0,
    noVenta: true,
    habilidades: habilidadesHermana("Maydo")
  }
};

// [UNDAVAR-PARTE-10.5-NIVELES] Configuración de los niveles del Elixir de potenciación
const NIVELES_POTENCIACION = [
  {
    nivel: 1,
    descripcion: "Potencia todas las habilidades del portador (+2 aciertos).",
    duracion: "1 turno",
    bonos: [{ estadistica: "aciertos", valor: 2, modo: "fijo", turnos: 1 }]
  },
  {
    nivel: 2,
    descripcion: "Potencia todas las habilidades del portador (+3 aciertos).",
    duracion: "2 turnos",
    bonos: [{ estadistica: "aciertos", valor: 3, modo: "fijo", turnos: 2 }]
  }
];

const CATALOGO_ITEMS = [
  // --- ELIXIRES ---
  // [UNDAVAR-PARTE-10.5-NIVELES] Niveles 1 y 2 con azar al comprar y revelado al usar
  { name: "Elixir de potenciación", type: "elixir", system: { descripcion: "Potencia todas las habilidades del portador. El nivel se sortea al comprar y se revela al usar.", duracion: "1-2 turno", nivel: "1-2", nivelMin: 1, nivelMax: 2, nivelAleatorio: true, nivelOculto: false, nivelActual: 1, nivelVenta: 1, precio_rubi: 5, variacionesNivel: NIVELES_POTENCIACION, bonos: [{ estadistica: "aciertos", valor: 2, modo: "fijo", turnos: 1 }] } },
  { name: "Elixir de aumento físico", type: "elixir", system: { descripcion: "Aumenta las capacidades físicas del usuario.", duracion: "3 turno", nivel: "/", precio_rubi: 10, bonos: [{ estadistica: "fuerza", valor: 2, modo: "fijo", turnos: 3 }, { estadistica: "velocidad", valor: 2, modo: "fijo", turnos: 3 }, { estadistica: "agilidad", valor: 2, modo: "fijo", turnos: 3 }] } },
  { name: "Elixir de la vida", type: "elixir", system: { descripcion: "Regeneración rápida: cierra heridas en minutos y revitaliza 30% (pt. Salud * 0.3, pt. Herida * 0.3).", duracion: "2 turnos", nivel: "/", precio_diamante: 15 } },
  { name: "Elixir de armamento", type: "elixir", system: { descripcion: "Se riega para forjar un arma temporal. Vuelve a su estado de elixir tras consumirse.+4 de daño permanente mientras esté en uso.", duracion: "3 usos", nivel: "/", precio_diamante: 15, consumible: false, bonos: [{ estadistica: "dano", valor: 4, modo: "fijo", turnos: 3 }] } },
  { name: "Elixir de rejuvenecimiento", type: "elixir", system: { descripcion: "Restaura la vitalidad. Elimina 6 marcas de cansancio.", duracion: "Único", nivel: "/", precio_diamante: 4 } },

  // --- ARMAS Y EQUIPO ---
  { name: "Daga común", type: "arma", system: { armaComun: true, descripcion: "Arma básica. No necesita magia ni se puede combinar con ella.", precio_oro: 25 } },
  // [UNDAVAR-PARTE-4.2e6-CATALOGO] Armas mágicas de gladiadores (narrativas y condiciones)
  // [UNDAVAR-PARTE-4.2h2-PAREJA] Dos armas separadas; no se venden, se cargan a mano
  MAYDO,
  TSUIDA,
  { name: "Voltex Oscuro", type: "arma", system: { descripcion: "Arma de los demonios de las sombras. El portador puede deshacerse en partículas de sombra, rearmarse y moverse a voluntad. Sus cortes generan heridas difíciles de regenerar.", armaComun: false, nivel: 0, modoUso: "dano", condiciones: ["sangrado"], precio_oro: 0 } },
  { name: "Guante de Terak", type: "arma", system: { descripcion: "Absorbe energía eléctrica, rayos y truenos para descargarlos. Potencia los golpes y puede dejar campos eléctricos activos que afectan a quien se acerque.", armaComun: false, nivel: 0, modoUso: "dano", condiciones: ["aturdido"], precio_oro: 0 } },
  { name: "Núcleo", type: "arma", system: { descripcion: "Reembolso rápido de energía. Mientras se use, el portador casi no se agota y puede lanzar energía materializada en forma de cortes.", armaComun: false, nivel: 0, modoUso: "descriptiva", condiciones: [], precio_oro: 0 } },
  { name: "Kusarigama Sombras", type: "arma", system: { descripcion: "Arma de sigilo, velocidad y silencio. Esconde los ataques en las sombras y permite crear clones de sombra que solo se mueven entre ellas.", armaComun: false, nivel: 0, modoUso: "dano", condiciones: ["invisible"], precio_oro: 0 } },
  { name: "Espada friolenta", type: "arma", system: { descripcion: "Permite crear y manipular hielo. Congela todo lo que toca y puede formar una capa de hielo sobre el cuerpo alcanzado.", armaComun: false, nivel: 0, modoUso: "dano", condiciones: ["congelado"], precio_oro: 0 } },
  { name: "Elemento Tóxico", type: "arma", system: { descripcion: "Espada de veneno que envenena a quien hiere y puede crear una densa niebla tóxica de control en área.", armaComun: false, nivel: 0, modoUso: "dano", condiciones: ["envenenado"], precio_oro: 0 } },
  { name: "Electro Chakram", type: "arma", system: { descripcion: "Chakram que emite energía eléctrica por todo el cuerpo salvo el mango. Al lanzarlo, gira y acumula energía que descarga al hacer contacto.", armaComun: false, nivel: 0, modoUso: "dano", condiciones: ["aturdido"], precio_oro: 0 } },
  // [UNDAVAR-PARTE-4.2h1b-SELLO] Sello de Sedra con sus cinco habilidades
  SELLO_DE_SEDRA,

  // --- OBJETOS Y ARMADURAS ---
  { name: "Collar de Astra", type: "objeto", system: { descripcion: "Aumenta tu poder mágico (+1 de daño mágico).", duracion: "3 turno", enfriamiento: "2 turnos", precio_oro: 50, consumible: false, bonos: [{ estadistica: "dano", valor: 1, modo: "fijo", turnos: 3 }] } },
  { name: "Pulsera Arc", type: "objeto", system: { descripcion: "Se transforma en cuchillas al cerrar los puños. Suma un dado de daño.", duracion: "3 turno", enfriamiento: "2 turnos", precio_oro: 45, consumible: false, bonos: [{ estadistica: "danoDados", valor: 1, modo: "fijo", turnos: 3 }] } },
  { name: "Anillo espacial", type: "objeto", system: { descripcion: "Permite guardar objetos en su interior (55 espacios).", precio_rubi: 3 } },
  { name: "Anillo espacial tamaño normal", type: "objeto", system: { descripcion: "Permite guardar objetos en su interior (20 espacios).", precio_oro: 99 } },
  { name: "Anillo espacial Ampliado", type: "objeto", system: { descripcion: "Permite guardar objetos en su interior (100 espacios).", precio_diamante: 3 } },
  { name: "Pluma y tinta", type: "objeto", system: { descripcion: "Herramienta de escritura (Sin pluma no escribes).", duracion: "20 escritura", precio_oro: 10 } },
  { name: "Mapa de Undavar", type: "objeto", system: { descripcion: "Permite ver ubicaciones geográficas.", precio_oro: 15 } },
  { name: "Contrato de domador", type: "objeto", system: { descripcion: "Documento legal/mágico de vinculación.", duracion: "Uso único", precio_diamante: 50 } },
  { name: "Acta de matrimonio", type: "objeto", system: { descripcion: "Une a dos personas en matrimonio; comparten experiencias.", duracion: "Uso único", precio_rubi: 10 } },
  { name: "Acta de divorcio", type: "objeto", system: { descripcion: "Separa a dos personas unidas en matrimonio.", duracion: "Uso único", precio_rubi: 100 } },
  { name: "Libro en blanco", type: "objeto", system: { descripcion: "Cuaderno para notas personales.", duracion: "150 páginas", precio_oro: 15 } },
  { name: "Carta del Santuario del Conocimiento", type: "objeto", system: { descripcion: "Documento oficial de acreditación o acceso.", duracion: "Uso único", precio_diamante: 70 } },
  { name: "Armadura de cuero", type: "objeto", system: { descripcion: "Protección ligera (-1 de daño recibido).", precio_rubi: 10 } },
  { name: "Ropa encantada", type: "objeto", system: { descripcion: "Atuendo imbuido (-2 de daño recibido).", precio_rubi: 15 } },
  { name: "Armadura de hierro", type: "objeto", system: { descripcion: "Protección pesada (-3 de daño recibido).", precio_rubi: 80 } },
  { name: "Armadura de hierro encantado", type: "objeto", system: { descripcion: "Protección reforzada (-4 de daño recibido).", precio_diamante: 2.5 } },
  { name: "Armadura de Oro", type: "objeto", system: { descripcion: "Protección legendaria (-6 de daño recibido).", precio_diamante: 80 } },

  // [UNDAVAR-PARTE-9.5B-MATERIALES] Los tipos de construcción son categorías, no objetos.
  // Los materiales concretos (Roble de Weir, Hierro Fim, etc.) están en sus propias secciones.

  // --- ALIMENTOS COMESTIBLES ---
  { name: "Manzana dorada", type: "alimento", system: { descripcion: "Manzana bañada en miel de oro. Elimina 1 marca de hambre.", duracion: "Único", precio_oro: 5 } },
  { name: "Filete de lobo asado", type: "alimento", system: { descripcion: "Filete asado sobre brasas. Elimina 2 marcas de hambre.", duracion: "Único", precio_oro: 15 } },
  { name: "Sopa de verduras", type: "alimento", system: { descripcion: "Sopa de verduras frescas. Elimina 3 marcas de hambre.", duracion: "Único", precio_oro: 12 } },
  { name: "Estofado de carne", type: "alimento", system: { descripcion: "Estofado caliente con carne tierno. Elimina 4 marcas de hambre.", duracion: "Único", precio_oro: 20 } },
  { name: "Bollo de miel", type: "alimento", system: { descripcion: "Bollo horneado con miel dorada. Elimina 2 marcas de hambre.", duracion: "Único", precio_oro: 7 } },
  { name: "Chuleta de dragón a la parrilla", type: "alimento", system: { descripcion: "Exquisitez asada a la parrilla. Elimina 5 marcas de hambre.", duracion: "Único", precio_rubi: 2 } },
  { name: "Pastel de oro celestial", type: "alimento", system: { descripcion: "Pastel exótico con oro comestible. Elimina 6 marcas de hambre.", duracion: "Único", precio_rubi: 5 } },
  { name: "Sopa de néctar de hadas", type: "alimento", system: { descripcion: "Sopa revitalizante de néctar y hierbas. Elimina 8 marcas de hambre.", duracion: "Único", precio_diamante: 8 } },
  { name: "Banquete de los dioses", type: "alimento", system: { descripcion: "Manjar de ingredientes raros. Elimina todas las marcas de hambre y sed.", duracion: "Único", precio_rubi: 10 } },

  // --- ALIMENTOS BEBIDAS ---
  { name: "Agua de manantial", type: "alimento", system: { descripcion: "Agua pura y fresca. Elimina 1 marca de sed.", duracion: "Único", precio_oro: 3 } },
  { name: "Jarabe de bayas del bosque", type: "alimento", system: { descripcion: "Jarabe dulce de bayas silvestres. Elimina 1 marca de sed.", duracion: "Único", precio_oro: 8 } },
  { name: "Agua de coco", type: "alimento", system: { descripcion: "Hidratante natural. Elimina 2 marcas de sed.", duracion: "Único", precio_oro: 6 } },
  { name: "Té de hierbas", type: "alimento", system: { descripcion: "Infusión aromática. Elimina 1 marca de sed.", duracion: "Único", precio_oro: 4 } },
  { name: "Vino de frutas exóticas", type: "alimento", system: { descripcion: "Vino elegante. Elimina 3 marcas de sed.", duracion: "Único", precio_oro: 25 } },
  { name: "Agua de manantial cristalino", type: "alimento", system: { descripcion: "Agua de manantial sagrado. Elimina 5 marcas de sed.", duracion: "Único", precio_diamante: 1.5 } },
  { name: "Vino de la cosecha celestial", type: "alimento", system: { descripcion: "Vino fino de la mítica viña celestial. Elimina 7 marcas de sed.", duracion: "Único", precio_diamante: 5 } },
  { name: "Té de la eternidad", type: "alimento", system: { descripcion: "Té místico rejuvenecedor. Elimina 8 marcas de cansancio.", duracion: "Único", precio_diamante: 6 } },
  { name: "Néctar de la Diosa Lunar", type: "alimento", system: { descripcion: "Bebida divina. Elimina todas las marcas de hambre, sed y cansancio.", duracion: "Único", precio_diamante: 10 } },
  { name: "Licor de fuego de dragón", type: "alimento", system: { descripcion: "Licor potente con esencia de dragón. Elimina 4 marcas de sed.", duracion: "Único", precio_rubi: 3 } },

  // --- COMIDA PARA MASCOTAS ---
  { name: "Comida para mascota común (4 raciones)", type: "alimento", system: { descripcion: "Ración estándar para animales domésticos.", precio_oro: 5 } },
  { name: "Comida para mascota común (15 raciones)", type: "alimento", system: { descripcion: "Ración estándar para animales domésticos.", precio_oro: 18 } },
  { name: "Comida para mascota común (25 raciones)", type: "alimento", system: { descripcion: "Ración estándar para animales domésticos.", precio_oro: 30 } },
  { name: "Comida para Planzul (Bolsa pequeña - 4 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Planzul.", precio_rubi: 3 } },
  { name: "Comida para Planzul (Bolsa regular - 25 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Planzul.", precio_rubi: 20 } },
  { name: "Comida para Planzul (Bolsa grande - 50 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Planzul.", precio_rubi: 40 } },
  { name: "Comida para Terl (Bolsa pequeña - 3 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Terl.", precio_rubi: 3.2 } },
  { name: "Comida para Terl (Bolsa regular - 15 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Terl.", precio_rubi: 20 } },
  { name: "Comida para Terl (Bolsa grande - 30 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Terl.", precio_rubi: 45 } },
  { name: "Comida para Dragcoin (Bolsa pequeña - 10 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Dragcoin.", precio_rubi: 30 } },
  { name: "Comida para Dragcoin (Bolsa regular - 40 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Dragcoin.", precio_rubi: 50 } },
  { name: "Comida para Dragcoin (Bolsa grande - 60 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Dragcoin.", precio_diamante: 10 } },
  { name: "Comida para Loraiz (Bolsa pequeña - 2 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Loraiz.", precio_rubi: 4 } },
  { name: "Comida para Loraiz (Bolsa regular - 20 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Loraiz.", precio_rubi: 25 } },
  { name: "Comida para Loraiz (Bolsa grande - 45 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Loraiz.", precio_rubi: 48 } },
  { name: "Comida para Cathexin (Bolsa pequeña - 3 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Cathexin.", precio_rubi: 5 } },
  { name: "Comida para Cathexin (Bolsa regular - 20 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Cathexin.", precio_rubi: 40 } },
  { name: "Comida para Cathexin (Bolsa grande - 55 raciones)", type: "alimento", system: { descripcion: "Alimento especializado para Cathexin.", precio_rubi: 50 } },
  { name: "Comida para Salvajes (Bolsa pequeña - 50 raciones)", type: "alimento", system: { descripcion: "Alimento para criaturas salvajes.", precio_diamante: 5 } },
  { name: "Comida para Salvajes (Bolsa regular - 80 raciones)", type: "alimento", system: { descripcion: "Alimento para criaturas salvajes.", precio_diamante: 10 } },
  { name: "Comida para Salvajes (Bolsa grande - 100 raciones)", type: "alimento", system: { descripcion: "Alimento para criaturas salvajes.", precio_diamante: 15 } },

  // --- MERCADO DE INGREDIENTES ABUSTO ---
  { name: "Hortalizas (Individual)", type: "alimento", system: { descripcion: "Ingrediente de cocina fresco.", precio_oro: 10 } },
  { name: "Hortalizas (Caja 25 unidades)", type: "alimento", system: { descripcion: "Caja de mercado con 25 hortalizas.", precio_oro: 200 } },
  { name: "Fruta (Individual)", type: "alimento", system: { descripcion: "Fruta fresca.", precio_oro: 25 } },
  { name: "Fruta (Caja 25 unidades)", type: "alimento", system: { descripcion: "Caja de mercado con 25 frutas.", precio_rubi: 1 } },
  { name: "Especias (Individual)", type: "alimento", system: { descripcion: "Condimento para alimentos.", precio_oro: 5 } },
  { name: "Especias (Caja 25 unidades)", type: "alimento", system: { descripcion: "Caja de mercado con 25 frascos de especias.", precio_oro: 75 } },
  { name: "Aceites (8 oz / 8 usos)", type: "alimento", system: { descripcion: "Aceite de cocina/alquimia.", precio_oro: 20 } },
  { name: "Aceites (16 oz / 16 usos)", type: "alimento", system: { descripcion: "Frasco grande de aceite.", precio_oro: 40 } },

  // --- INGREDIENTES GENERALES DE ELIXIRES ---
  // [UNDAVAR-PARTE-9.5C-MATERIALES] Desde aquí hasta las maderas, system.material marca qué sirve de material de crafteo
  { name: "Plumas de Planzúl", type: "objeto", system: { material: true,  descripcion: "Plumas doradas mágicas. Otorga resistencia al viento y buff de velocidad.", precio_oro: 15 } },
  { name: "Pétalos de Mairis Púrpura", type: "objeto", system: { material: true,  descripcion: "Pétalos del árbol Mairis. Posee efecto relajante.", precio_oro: 10 } },
  { name: "Raíz de Mairis Púrpura", type: "objeto", system: { material: true,  descripcion: "Raíz medicinal de Mairis. Concentra efectos relajantes y curativos.", precio_oro: 20 } },
  { name: "Pétalos de Mairis Amarilla", type: "objeto", system: { material: true,  descripcion: "Pétalos dulces. Efecto relajante superior para platillos.", precio_oro: 15 } },
  { name: "Raíz de Mairis Amarilla", type: "objeto", system: { material: true,  descripcion: "Raíz aromática medicinal de fuerte efecto relajante.", precio_oro: 25 } },
  { name: "Semillas de Mairis Púrpura", type: "objeto", system: { material: true,  descripcion: "Ingrediente menor de alquimia sin madurar.", precio_oro: 8 } },
  { name: "Semillas de Laila Radiante", type: "objeto", system: { material: true,  descripcion: "Ingrediente menor para infusiones o brebajes.", precio_oro: 8 } },
  { name: "Semillas de Cilantro", type: "objeto", system: { material: true,  descripcion: "Resalta sabores, da aroma y sirve como catalizador alquímico.", precio_oro: 6 } },
  { name: "Tallo de Laila Radiante", type: "objeto", system: { material: true,  descripcion: "Mantiene propiedades mágicas temporales tras cortarse.", precio_oro: 12 } },
  { name: "Fruto de Yoyi Cálida", type: "objeto", system: { material: true,  descripcion: "Merienda dulce con efecto concentrado.", precio_oro: 10 } },
  { name: "Hojas de Nauzu", type: "objeto", system: { material: true,  descripcion: "Aroma suave. Utilizado para equilibrar mezclas alquímicas.", precio_oro: 7 } },
  { name: "Raíz de Nauzu", type: "objeto", system: { material: true,  descripcion: "Concentrado natural de la flor Nauzu.", precio_oro: 18 } },
  { name: "Frutos del Rocío Blanco", type: "objeto", system: { material: true,  descripcion: "Frutos grises de fuerte efecto relajante, usados para fabricar alcohol.", precio_oro: 20 } },
  { name: "Tallo del Yang Azul", type: "objeto", system: { material: true,  descripcion: "Propiedades menores derivadas del fruto Yang Azul.", precio_oro: 14 } },
  { name: "Hoja del Yang Azul", type: "objeto", system: { material: true,  descripcion: "Conserva propiedades del Yang Azul si se mantiene fresca.", precio_oro: 12 } },
  { name: "Semillas del Yang Azul", type: "objeto", system: { material: true,  descripcion: "Ingrediente alquímico de menor calidad.", precio_oro: 9 } },
  { name: "Hojas de Laila Radiante", type: "objeto", system: { material: true,  descripcion: "Hojas aromáticas mágicas.", precio_oro: 10 } },

  // --- METALES Y MATERIALES ---
  { name: "Metal de Kio", type: "objeto", system: { material: true,  descripcion: "Aleación pesada de jo y holio, resistente y fácil de moldear.", precio_rubi: 5 } },
  { name: "Metal Jo", type: "objeto", system: { material: true,  descripcion: "Metal ligero de resistencia media, ideal para armas pequeñas.", precio_oro: 35 } },
  { name: "Metal Holio", type: "objeto", system: { material: true,  descripcion: "Metal pesado y muy resistente, requiere altas temperaturas.", precio_rubi: 8 } },
  { name: "Metal Weir", type: "objeto", system: { material: true,  descripcion: "Metal legendario casi irrompible, liviano y fácil de moldear.", precio_diamante: 25 } },
  { name: "Metal Dial", type: "objeto", system: { material: true,  descripcion: "El metal mágico. Extremadamente resistente, liviano y fácil de moldear.", precio_diamante: 10 } },
  { name: "Cobre Maido", type: "objeto", system: { material: true,  descripcion: "Cobre puro. Excelente conductor pero de baja resistencia.", precio_oro: 15 } },
  { name: "Cobre Riowu", type: "objeto", system: { material: true,  descripcion: "Cobre impuro. Mayor resistencia pero baja conductividad.", precio_oro: 10 } },
  { name: "Cobre Gatsu", type: "objeto", system: { material: true,  descripcion: "Cobre balanceado en conductividad y resistencia.", precio_oro: 18 } },
  { name: "Cobre Fal io", type: "objeto", system: { material: true,  descripcion: "Variante de cobre con mayor conductividad que el Gatsu.", precio_oro: 22 } },
  { name: "Hierro Rawer", type: "objeto", system: { material: true,  descripcion: "Mineral ultra resistente y pesado.", precio_rubi: 12 } },
  { name: "Hierro Qi Ang Xu", type: "objeto", system: { material: true,  descripcion: "Aleación de fim y rawer. Metal poderoso que compite con el Dial.", precio_diamante: 8 } },
  { name: "Hierro Fim", type: "objeto", system: { material: true,  descripcion: "Metal liviano y maleable.", precio_oro: 45 } },
  { name: "Acero Tiang Lon", type: "objeto", system: { material: true,  descripcion: "El metal perfecto: fusión de Dial y Qi Ang Xu. Liviano e indestructible.", precio_diamante: 40 } },

  // --- MADERAS PARA ENCANTOS ---
  { name: "Roble de Weir", type: "objeto", system: { material: true,  descripcion: "Madera común de alta resistencia utilizada para encantos.", precio_oro: 15 } },
  { name: "Roble del Ángel", type: "objeto", system: { material: true,  descripcion: "Madera especial de bosques específicos.", precio_oro: 30 } },
  { name: "Abeto de Fim", type: "objeto", system: { material: true,  descripcion: "Madera decorativa y excelente catalizador mágico.", precio_oro: 25 } },
  { name: "Acebol del Rocío", type: "objeto", system: { material: true,  descripcion: "Madera con buena resistencia y conductividad mágica.", precio_oro: 40 } },
  { name: "Cerezo de Miel", type: "objeto", system: { material: true,  descripcion: "Madera resonante ideal para instrumentos musicales.", precio_oro: 50 } },
  { name: "Ciprés Solitario", type: "objeto", system: { material: true,  descripcion: "Madera inmune a plagas u hongos. Rara y costosa.", precio_rubi: 15 } },
  { name: "Secoya Gigante", type: "objeto", system: { material: true,  descripcion: "Madera masiva de árboles milenarios.", precio_rubi: 10 } },
  { name: "Glicinias Rosas", type: "objeto", system: { material: true,  descripcion: "Madera fina usada tradicionalmente para utensilios pulidos.", precio_oro: 35 } },
  { name: "Eucaliptos de Fal io", type: "objeto", system: { material: true,  descripcion: "Madera monopolizada para la creación de objetos mágicos.", precio_rubi: 25 } },
  { name: "Buloke Lino", type: "objeto", system: { material: true,  descripcion: "La madera más dura y resistente de todas.", precio_diamante: 2 } }
];

// [UNDAVAR-PARTE-4.2e2-EFECTOS] Campos del efecto mecánico (reemplaza el modelo plano de 4.2d)
const CAMPOS_EFECTO = ["salud", "herida", "hambre", "sed", "cansancio", "fatiga"];

// [UNDAVAR-PARTE-4.2e2-EFECTOS] Efectos que no se deducen del texto
const EFECTOS_ESPECIALES = {
  "Elixir de la vida": {
    definido: true,
    objetivo: "ambos",
    turnos: 2,
    campos: {
      salud: { valor: 30, modo: "pct", cuando: "turno" },
      herida: { valor: 30, modo: "pct", cuando: "turno" }
    }
  }
};

// [UNDAVAR-PARTE-4.2e2-EFECTOS] Migra el efecto plano de 4.2d al modelo por campo
function normalizarEfecto(ef) {
  if (!ef) return null;
  if (ef.campos) {
    return {
      definido: true,
      objetivo: ef.objetivo || "ambos",
      turnos: Number(ef.turnos) || 0,
      campos: ef.campos
    };
  }
  const campos = {};
  CAMPOS_EFECTO.forEach(k => {
    campos[k] = { valor: Number(ef[k]) || 0, modo: "fijo", cuando: "inmediato" };
  });
  const vital = Number(ef.vitalPct) || 0;
  let turnos = Number(ef.turnos) || 0;
  if (vital > 0) {
    campos.salud = { valor: vital, modo: "pct", cuando: "turno" };
    campos.herida = { valor: vital, modo: "pct", cuando: "turno" };
    if (!turnos) turnos = 2;
  }
  return { definido: true, objetivo: ef.objetivo || "ambos", turnos, campos };
}

// [UNDAVAR-PARTE-4.2e2-EFECTOS] Devuelve el efecto guardado o lo deduce del texto
function efectoMecanicoItem(item) {
  const s = item?.system || {};
  if (s.efectoMecanico?.definido) {
    const ef = normalizarEfecto(s.efectoMecanico);
    const tiene = CAMPOS_EFECTO.some(k => Number(ef.campos?.[k]?.valor) > 0);
    return tiene ? ef : null;
  }

  const especial = EFECTOS_ESPECIALES[item?.name];
  if (especial) return normalizarEfecto(especial);

  const texto = `${s.efecto || ""} ${s.descripcion || ""}`.toLowerCase();
  const num = (re) => {
    const m = texto.match(re);
    return m ? parseInt(m[1], 10) : 0;
  };
  const campos = {};
  CAMPOS_EFECTO.forEach(k => {
    campos[k] = { valor: 0, modo: "fijo", cuando: "inmediato" };
  });
  campos.hambre.valor = num(/elimina\s+(\d+)\s+marcas?\s+de\s+hambre/);
  campos.sed.valor = num(/elimina\s+(\d+)\s+marcas?\s+de\s+sed/);
  campos.cansancio.valor = num(/elimina\s+(\d+)\s+marcas?\s+de\s+cansancio/);
  campos.fatiga.valor = num(/elimina\s+(\d+)\s+marcas?\s+de\s+fatiga/);
  if (/elimina\s+todas\s+las\s+marcas/.test(texto)) {
    if (texto.includes("hambre")) campos.hambre.valor = 99;
    if (texto.includes("sed")) campos.sed.valor = 99;
    if (texto.includes("cansancio")) campos.cansancio.valor = 99;
    if (texto.includes("fatiga")) campos.fatiga.valor = 99;
  }
  const tieneAlgo = CAMPOS_EFECTO.some(k => campos[k].valor > 0);
  return tieneAlgo ? { definido: true, objetivo: "ambos", turnos: 1, campos } : null;
}

// [UNDAVAR-PARTE-4.2e2-EFECTOS] Texto corto del efecto para modales y avisos
function describirEfectoMecanico(ef) {
  const e = normalizarEfecto(ef);
  if (!e?.campos) return "";
  const partes = [];
  CAMPOS_EFECTO.forEach(k => {
    const c = e.campos[k];
    const v = Number(c?.valor) || 0;
    if (!v) return;
    const esPct = c.modo === "pct";
    const turno = c.cuando === "turno" ? " por turno" : "";
    if (k === "salud") partes.push(`+${v}${esPct ? "%" : " Pt."} Salud${turno}`);
    else if (k === "herida") partes.push(`−${v}${esPct ? "%" : " Pt."} Herida${turno}`);
    else {
      const todas = (v >= 99 && !esPct) || (esPct && v >= 100);
      const signo = c.signo === "aplicar" ? "+" : "−";
      // [UNDAVAR-PARTE-4.2h4j-EFECTO-SIGNO] Distingue marcas que se aplican de las que se curan
      const cantidad = todas ? "todas las" : `${signo}${v}${esPct ? "%" : ""}`;
      const marca = v === 1 && !esPct ? "marca" : "marcas";
      partes.push(`${cantidad} ${marca} de ${k}${turno}`);
    }
  });
  return partes.join(" · ");
}

const LISTA_REFUGIOS_BASE = [
  { name: "Refugio de nivel 1", type: "objeto" },
  { name: "Refugio de nivel 2", type: "objeto" },
  { name: "Refugio de nivel 3", type: "objeto" },
  { name: "Refugio de nivel 4", type: "objeto" },
  { name: "Refugio de nivel 5", type: "objeto" },
  { name: "Refugio de nivel 6", type: "objeto" }
];

const TIENDA_RESTABLECEDOR = {
  id: "restablecedor",
  nombre: "Restablecedor",
  caja: { oro: 0, rubi: 0, diamante: 0 },
  items: [
    ...CATALOGO_ITEMS.filter(item => !item.system?.noVenta).map(item => {
      // [UNDAVAR-PARTE-4.2h1b-SELLO] Conserva descripción, habilidades y bonos al reponer
      const { precio_oro, precio_rubi, precio_diamante, ...resto } = item.system || {};
      return {
        name: item.name,
        type: item.type,
        system: { ...resto, precio_oro: 0, cantidad: 999 }
      };
    }),
    ...LISTA_REFUGIOS_BASE.map(refugio => ({
      name: refugio.name,
      type: refugio.type,
      system: {
        precio_oro: 0,
        cantidad: 999
      }
    }))
  ]
};

// TIENDAS OFICIALES INICIALES
const TIENDAS_INICIALES = [
  TIENDA_RESTABLECEDOR,
  {
    id: "hogar-comercio",
    tipo: "tienda",
    nombre: "Hogar del Comercio",
    caja: { oro: 500000, rubi: 0, diamante: 0 },
    items: [
      { name: "Collar de Astra", type: "objeto", system: { precio_oro: 50, cantidad: 20 } },
      { name: "Pulsera Arc", type: "objeto", system: { precio_oro: 45, cantidad: 15 } },
      { name: "Anillo espacial", type: "objeto", system: { precio_rubi: 3, cantidad: 10 } },
      { name: "Anillo espacial tamaño normal", type: "objeto", system: { precio_oro: 99, cantidad: 10 } },
      { name: "Anillo espacial Ampliado", type: "objeto", system: { precio_diamante: 3, cantidad: 5 } },
      { name: "Libro en blanco", type: "objeto", system: { precio_oro: 15, cantidad: 30 } },
      { name: "Pluma y tinta", type: "objeto", system: { precio_oro: 10, cantidad: 50 } },
      { name: "Daga común", type: "arma", system: { armaComun: true, precio_oro: 25, cantidad: 25 } },
      { name: "Mapa de Undavar", type: "objeto", system: { precio_oro: 15, cantidad: 20 } },
      { name: "Carta del Santuario del Conocimiento", type: "objeto", system: { precio_diamante: 70, cantidad: 5 } },
      { name: "Contrato de domador", type: "objeto", system: { precio_diamante: 50, cantidad: 3 } },
      { name: "Acta de matrimonio", type: "objeto", system: { precio_rubi: 10, cantidad: 10 } },
      { name: "Acta de divorcio", type: "objeto", system: { precio_rubi: 100, cantidad: 5 } },
      { name: "Armadura de cuero", type: "objeto", system: { precio_rubi: 10, cantidad: 20 } },
      { name: "Ropa encantada", type: "objeto", system: { precio_rubi: 15, cantidad: 15 } },
      { name: "Armadura de hierro", type: "objeto", system: { precio_rubi: 80, cantidad: 10 } },
      { name: "Armadura de hierro encantado", type: "objeto", system: { precio_diamante: 2.5, cantidad: 5 } },
      { name: "Armadura de Oro", type: "objeto", system: { precio_diamante: 80, cantidad: 3 } },
      { name: "Elixir de potenciación", type: "elixir", system: { precio_rubi: 5, cantidad: 50 } },
      { name: "Elixir de aumento físico", type: "elixir", system: { precio_rubi: 10, cantidad: 40 } },
      { name: "Elixir de la vida", type: "elixir", system: { precio_diamante: 15, cantidad: 30 } },
      { name: "Elixir de armamento", type: "elixir", system: { precio_diamante: 15, cantidad: 25 } },
      { name: "Manzana dorada", type: "alimento", system: { precio_oro: 5, cantidad: 100 } },
      { name: "Filete de lobo asado", type: "alimento", system: { precio_oro: 15, cantidad: 80 } },
      { name: "Sopa de verduras", type: "alimento", system: { precio_oro: 12, cantidad: 70 } },
      { name: "Estofado de carne", type: "alimento", system: { precio_oro: 20, cantidad: 50 } },
      { name: "Bollo de miel", type: "alimento", system: { precio_oro: 7, cantidad: 60 } },
      { name: "Chuleta de dragón a la parrilla", type: "alimento", system: { precio_rubi: 2, cantidad: 40 } },
      { name: "Pastel de oro celestial", type: "alimento", system: { precio_rubi: 5, cantidad: 20 } },
      { name: "Sopa de néctar de hadas", type: "alimento", system: { precio_diamante: 8, cantidad: 10 } },
      { name: "Elixir de rejuvenecimiento", type: "elixir", system: { precio_diamante: 4, cantidad: 15 } },
      { name: "Banquete de los dioses", type: "alimento", system: { precio_rubi: 10, cantidad: 5 } },
      { name: "Agua de manantial", type: "alimento", system: { precio_oro: 3, cantidad: 200 } },
      { name: "Jarabe de bayas del bosque", type: "alimento", system: { precio_oro: 8, cantidad: 150 } },
      { name: "Agua de coco", type: "alimento", system: { precio_oro: 6, cantidad: 100 } },
      { name: "Té de hierbas", type: "alimento", system: { precio_oro: 4, cantidad: 120 } },
      { name: "Vino de frutas exóticas", type: "alimento", system: { precio_oro: 25, cantidad: 80 } },
      { name: "Agua de manantial cristalino", type: "alimento", system: { precio_diamante: 1.5, cantidad: 50 } },
      { name: "Vino de la cosecha celestial", type: "alimento", system: { precio_diamante: 5, cantidad: 30 } },
      { name: "Té de la eternidad", type: "alimento", system: { precio_diamante: 6, cantidad: 20 } },
      { name: "Néctar de la Diosa Lunar", type: "alimento", system: { precio_diamante: 10, cantidad: 10 } },
      { name: "Licor de fuego de dragón", type: "alimento", system: { precio_rubi: 3, cantidad: 5 } }
    ]
  },
  {
    id: "tienda-mark",
    tipo: "tienda",
    nombre: "Tienda Mark",
    caja: { oro: 150000, rubi: 0, diamante: 0 },
    items: [
      { name: "Collar de Astra", type: "objeto", system: { precio_oro: 50, cantidad: 10 } },
      { name: "Pulsera Arc", type: "objeto", system: { precio_oro: 45, cantidad: 8 } },
      { name: "Anillo espacial", type: "objeto", system: { precio_rubi: 3, cantidad: 5 } },
      { name: "Anillo espacial tamaño normal", type: "objeto", system: { precio_oro: 99, cantidad: 5 } },
      { name: "Anillo espacial Ampliado", type: "objeto", system: { precio_diamante: 3, cantidad: 3 } },
      { name: "Libro en blanco", type: "objeto", system: { precio_oro: 15, cantidad: 15 } },
      { name: "Pluma y tinta", type: "objeto", system: { precio_oro: 10, cantidad: 25 } },
      { name: "Daga común", type: "arma", system: { armaComun: true, precio_oro: 25, cantidad: 15 } },
      { name: "Mapa de Undavar", type: "objeto", system: { precio_oro: 15, cantidad: 10 } },
      { name: "Carta del Santuario del Conocimiento", type: "objeto", system: { precio_diamante: 70, cantidad: 3 } },
      { name: "Contrato de domador", type: "objeto", system: { precio_diamante: 50, cantidad: 2 } },
      { name: "Acta de matrimonio", type: "objeto", system: { precio_rubi: 10, cantidad: 5 } },
      { name: "Acta de divorcio", type: "objeto", system: { precio_rubi: 100, cantidad: 3 } },
      { name: "Armadura de cuero", type: "objeto", system: { precio_rubi: 10, cantidad: 10 } },
      { name: "Ropa encantada", type: "objeto", system: { precio_rubi: 15, cantidad: 8 } },
      { name: "Armadura de hierro", type: "objeto", system: { precio_rubi: 80, cantidad: 5 } },
      { name: "Armadura de hierro encantado", type: "objeto", system: { precio_diamante: 2.5, cantidad: 3 } },
      { name: "Armadura de Oro", type: "objeto", system: { precio_diamante: 80, cantidad: 2 } },
      { name: "Elixir de potenciación", type: "elixir", system: { precio_rubi: 5, cantidad: 25 } },
      { name: "Elixir de aumento físico", type: "elixir", system: { precio_rubi: 10, cantidad: 20 } },
      { name: "Elixir de la vida", type: "elixir", system: { precio_diamante: 15, cantidad: 15 } },
      { name: "Elixir de armamento", type: "elixir", system: { precio_diamante: 15, cantidad: 10 } },
      { name: "Manzana dorada", type: "alimento", system: { precio_oro: 5, cantidad: 50 } },
      { name: "Filete de lobo asado", type: "alimento", system: { precio_oro: 15, cantidad: 40 } },
      { name: "Sopa de verduras", type: "alimento", system: { precio_oro: 12, cantidad: 35 } },
      { name: "Estofado de carne", type: "alimento", system: { precio_oro: 20, cantidad: 25 } },
      { name: "Bollo de miel", type: "alimento", system: { precio_oro: 7, cantidad: 30 } },
      { name: "Chuleta de dragón a la parrilla", type: "alimento", system: { precio_rubi: 2, cantidad: 20 } },
      { name: "Pastel de oro celestial", type: "alimento", system: { precio_rubi: 5, cantidad: 10 } },
      { name: "Sopa de néctar de hadas", type: "alimento", system: { precio_diamante: 8, cantidad: 5 } },
      { name: "Elixir de rejuvenecimiento", type: "elixir", system: { precio_diamante: 4, cantidad: 10 } },
      { name: "Banquete de los dioses", type: "alimento", system: { precio_rubi: 10, cantidad: 2 } },
      { name: "Agua de manantial", type: "alimento", system: { precio_oro: 3, cantidad: 100 } },
      { name: "Jarabe de bayas del bosque", type: "alimento", system: { precio_oro: 8, cantidad: 75 } },
      { name: "Agua de coco", type: "alimento", system: { precio_oro: 6, cantidad: 50 } },
      { name: "Té de hierbas", type: "alimento", system: { precio_oro: 4, cantidad: 60 } },
      { name: "Vino de frutas exóticas", type: "alimento", system: { precio_oro: 25, cantidad: 40 } },
      { name: "Agua de manantial cristalino", type: "alimento", system: { precio_diamante: 1.5, cantidad: 25 } },
      { name: "Vino de la cosecha celestial", type: "alimento", system: { precio_diamante: 5, cantidad: 15 } },
      { name: "Té de la eternidad", type: "alimento", system: { precio_diamante: 6, cantidad: 10 } },
      { name: "Néctar de la Diosa Lunar", type: "alimento", system: { precio_diamante: 10, cantidad: 5 } },
      { name: "Licor de fuego de dragón", type: "alimento", system: { precio_rubi: 3, cantidad: 2 } }
    ]
  },
  {
    id: "comercio-luctin",
    tipo: "tienda",
    nombre: "Comercio Luctin",
    caja: { oro: 50000, rubi: 0, diamante: 0 },
    items: [
      { name: "Collar de Astra", type: "objeto", system: { precio_oro: 50, cantidad: 15 } },
      { name: "Pulsera Arc", type: "objeto", system: { precio_oro: 45, cantidad: 12 } },
      { name: "Anillo espacial", type: "objeto", system: { precio_rubi: 3, cantidad: 8 } },
      { name: "Anillo espacial tamaño normal", type: "objeto", system: { precio_oro: 99, cantidad: 8 } },
      { name: "Libro en blanco", type: "objeto", system: { precio_oro: 15, cantidad: 20 } },
      { name: "Pluma y tinta", type: "objeto", system: { precio_oro: 10, cantidad: 30 } },
      { name: "Daga común", type: "arma", system: { armaComun: true, precio_oro: 25, cantidad: 20 } },
      { name: "Mapa de Undavar", type: "objeto", system: { precio_oro: 15, cantidad: 15 } },
      { name: "Acta de matrimonio", type: "objeto", system: { precio_rubi: 10, cantidad: 8 } },
      { name: "Acta de divorcio", type: "objeto", system: { precio_rubi: 100, cantidad: 5 } },
      { name: "Armadura de cuero", type: "objeto", system: { precio_rubi: 10, cantidad: 15 } },
      { name: "Ropa encantada", type: "objeto", system: { precio_rubi: 15, cantidad: 10 } },
      { name: "Armadura de hierro", type: "objeto", system: { precio_rubi: 80, cantidad: 8 } },
      { name: "Armadura de hierro encantado", type: "objeto", system: { precio_diamante: 2.5, cantidad: 5 } },
      { name: "Elixir de potenciación", type: "elixir", system: { precio_rubi: 5, cantidad: 20 } },
      { name: "Elixir de aumento físico", type: "elixir", system: { precio_rubi: 10, cantidad: 15 } },
      { name: "Elixir de la vida", type: "elixir", system: { precio_diamante: 15, cantidad: 10 } },
      { name: "Elixir de armamento", type: "elixir", system: { precio_diamante: 15, cantidad: 8 } },
      { name: "Manzana dorada", type: "alimento", system: { precio_oro: 5, cantidad: 30 } },
      { name: "Filete de lobo asado", type: "alimento", system: { precio_oro: 15, cantidad: 25 } },
      { name: "Sopa de verduras", type: "alimento", system: { precio_oro: 12, cantidad: 20 } },
      { name: "Estofado de carne", type: "alimento", system: { precio_oro: 20, cantidad: 15 } },
      { name: "Bollo de miel", type: "alimento", system: { precio_oro: 7, cantidad: 18 } },
      { name: "Chuleta de dragón a la parrilla", type: "alimento", system: { precio_rubi: 2, cantidad: 10 } },
      { name: "Pastel de oro celestial", type: "alimento", system: { precio_rubi: 5, cantidad: 5 } },
      { name: "Sopa de néctar de hadas", type: "alimento", system: { precio_diamante: 8, cantidad: 3 } },
      { name: "Elixir de rejuvenecimiento", type: "elixir", system: { precio_diamante: 4, cantidad: 8 } },
      { name: "Banquete de los dioses", type: "alimento", system: { precio_rubi: 10, cantidad: 1 } },
      { name: "Agua de manantial", type: "alimento", system: { precio_oro: 3, cantidad: 50 } },
      { name: "Jarabe de bayas del bosque", type: "alimento", system: { precio_oro: 8, cantidad: 40 } },
      { name: "Agua de coco", type: "alimento", system: { precio_oro: 6, cantidad: 25 } },
      { name: "Té de hierbas", type: "alimento", system: { precio_oro: 4, cantidad: 30 } },
      { name: "Vino de frutas exóticas", type: "alimento", system: { precio_oro: 25, cantidad: 20 } },
      { name: "Agua de manantial cristalino", type: "alimento", system: { precio_diamante: 1.5, cantidad: 15 } },
      { name: "Vino de la cosecha celestial", type: "alimento", system: { precio_diamante: 5, cantidad: 8 } },
      { name: "Té de la eternidad", type: "alimento", system: { precio_diamante: 6, cantidad: 5 } },
      { name: "Néctar de la Diosa Lunar", type: "alimento", system: { precio_diamante: 10, cantidad: 3 } },
      { name: "Licor de fuego de dragón", type: "alimento", system: { precio_rubi: 3, cantidad: 1 } }
    ]
  },
  {
    id: "alimentos-cadena",
    tipo: "tienda",
    nombre: 'Tienda de Alimentos "Cadena"',
    caja: { oro: 30000, rubi: 0, diamante: 0 },
    items: [
      { name: "Manzana dorada", type: "alimento", system: { precio_oro: 5, cantidad: 25 } },
      { name: "Filete de lobo asado", type: "alimento", system: { precio_oro: 15, cantidad: 20 } },
      { name: "Sopa de verduras", type: "alimento", system: { precio_oro: 12, cantidad: 15 } },
      { name: "Estofado de carne", type: "alimento", system: { precio_oro: 20, cantidad: 10 } },
      { name: "Bollo de miel", type: "alimento", system: { precio_oro: 7, cantidad: 20 } },
      { name: "Chuleta de dragón a la parrilla", type: "alimento", system: { precio_rubi: 2, cantidad: 5 } },
      { name: "Pastel de oro celestial", type: "alimento", system: { precio_rubi: 5, cantidad: 2 } },
      { name: "Sopa de néctar de hadas", type: "alimento", system: { precio_diamante: 8, cantidad: 1 } },
      { name: "Elixir de rejuvenecimiento", type: "elixir", system: { precio_diamante: 4, cantidad: 5 } },
      { name: "Banquete de los dioses", type: "alimento", system: { precio_rubi: 10, cantidad: 1 } },
      { name: "Agua de manantial", type: "alimento", system: { precio_oro: 3, cantidad: 40 } },
      { name: "Jarabe de bayas del bosque", type: "alimento", system: { precio_oro: 8, cantidad: 30 } },
      { name: "Agua de coco", type: "alimento", system: { precio_oro: 6, cantidad: 20 } },
      { name: "Té de hierbas", type: "alimento", system: { precio_oro: 4, cantidad: 25 } },
      { name: "Vino de frutas exóticas", type: "alimento", system: { precio_oro: 25, cantidad: 15 } },
      { name: "Agua de manantial cristalino", type: "alimento", system: { precio_diamante: 1.5, cantidad: 10 } },
      { name: "Vino de la cosecha celestial", type: "alimento", system: { precio_diamante: 5, cantidad: 5 } },
      { name: "Té de la eternidad", type: "alimento", system: { precio_diamante: 6, cantidad: 3 } },
      { name: "Néctar de la Diosa Lunar", type: "alimento", system: { precio_diamante: 10, cantidad: 2 } },
      { name: "Licor de fuego de dragón", type: "alimento", system: { precio_rubi: 3, cantidad: 1 } }
    ]
  },
  {
    id: "me-lo-compras-ya",
    tipo: "tienda",
    nombre: 'Tienda de Alimentos "Me lo Compras Ya"',
    caja: { oro: 30000, rubi: 0, diamante: 0 },
    items: [
      { name: "Manzana dorada", type: "alimento", system: { precio_oro: 5, cantidad: 25 } },
      { name: "Filete de lobo asado", type: "alimento", system: { precio_oro: 15, cantidad: 20 } },
      { name: "Sopa de verduras", type: "alimento", system: { precio_oro: 12, cantidad: 15 } },
      { name: "Estofado de carne", type: "alimento", system: { precio_oro: 20, cantidad: 10 } },
      { name: "Bollo de miel", type: "alimento", system: { precio_oro: 7, cantidad: 20 } },
      { name: "Chuleta de dragón a la parrilla", type: "alimento", system: { precio_rubi: 2, cantidad: 5 } },
      { name: "Pastel de oro celestial", type: "alimento", system: { precio_rubi: 5, cantidad: 2 } },
      { name: "Sopa de néctar de hadas", type: "alimento", system: { precio_diamante: 8, cantidad: 1 } },
      { name: "Elixir de rejuvenecimiento", type: "elixir", system: { precio_diamante: 4, cantidad: 5 } },
      { name: "Banquete de los dioses", type: "alimento", system: { precio_rubi: 10, cantidad: 1 } },
      { name: "Agua de manantial", type: "alimento", system: { precio_oro: 3, cantidad: 40 } },
      { name: "Jarabe de bayas del bosque", type: "alimento", system: { precio_oro: 8, cantidad: 30 } },
      { name: "Agua de coco", type: "alimento", system: { precio_oro: 6, cantidad: 20 } },
      { name: "Té de hierbas", type: "alimento", system: { precio_oro: 4, cantidad: 25 } },
      { name: "Vino de frutas exóticas", type: "alimento", system: { precio_oro: 25, cantidad: 15 } },
      { name: "Agua de manantial cristalino", type: "alimento", system: { precio_diamante: 1.5, cantidad: 10 } },
      { name: "Vino de la cosecha celestial", type: "alimento", system: { precio_diamante: 5, cantidad: 5 } },
      { name: "Té de la eternidad", type: "alimento", system: { precio_diamante: 6, cantidad: 3 } },
      { name: "Néctar de la Diosa Lunar", type: "alimento", system: { precio_diamante: 10, cantidad: 2 } },
      { name: "Licor de fuego de dragón", type: "alimento", system: { precio_rubi: 3, cantidad: 1 } }
    ]
  },
  // [UNDAVAR-PARTE-9.6-MATRIMONIO] Tienda del manual para el acta
  {
    id: "santuario-conocimiento",
    tipo: "tienda",
    nombre: "Santuario del Conocimiento",
    caja: { oro: 20000, rubi: 500, diamante: 20 },
    items: [
      { name: "Acta de matrimonio", type: "objeto", system: { precio_rubi: 10, cantidad: 20 } },
      { name: "Acta de divorcio", type: "objeto", system: { precio_rubi: 100, cantidad: 5 } },
      { name: "Carta del Santuario del Conocimiento", type: "objeto", system: { precio_diamante: 70, cantidad: 3 } },
      { name: "Libro en blanco", type: "objeto", system: { precio_oro: 15, cantidad: 20 } },
      { name: "Pluma y tinta", type: "objeto", system: { precio_oro: 10, cantidad: 30 } }
    ]
  }
];

// ============================================================
// BESTIARIO / RAZAS MAESTRAS DE UNDAVAR (Con descripciones)
// ============================================================
const BESTIARIO_UNDAVAR = {
  "Enoji": {
    descripcion: "Raza oculta entre las sombras, de complexión imponente y piel oscura. Centrados en combate cuerpo a cuerpo y conocidos por su habilidad 'Destello feroz'.",
    atributos: { fuerza: 6, velocidad: 4, agilidad: 3, inteligencia: 6 },
    artes: [
      { name: "Destello Feroz", type: "arte", system: { nivel: 1, descripcion: "Aumenta atributos en +1 temporalmente y otorga resistencia física." } }
    ]
  },
  "Krintal": {
    descripcion: "Seres de 2.2 metros que fusionan aspecto de ave y hombre. Pacíficos pero solitarios, emiten chillidos ensordecedores y crean vendavales con sus alas.",
    atributos: { fuerza: 2, velocidad: 6, agilidad: 3, inteligencia: 6 },
    artes: [
      // [UNDAVAR-PARTE-9.2-NIVELES] La altura de la ventisca y los turnos de vuelo escalan
      { name: "Ventisca tormentosa", type: "arte", system: { nivel: 1, descripcion: "Vuela 2 m y agita las alas derribando a todos los enemigos. Se mantiene 1 turno en el aire.", variacionesNivel: [
        { nivel: 2, descripcion: "Vuela 3 m y agita las alas derribando a todos los enemigos. Se mantiene 1 turno en el aire." },
        { nivel: 3, descripcion: "Vuela 4 m y agita las alas derribando a todos los enemigos. Se mantiene 1 turno en el aire." },
        { nivel: 4, descripcion: "Vuela 5 m y agita las alas derribando a todos los enemigos. Se mantiene 1 turno en el aire." }
      ] } },
      { name: "Chillido Bandada", type: "arte", system: { nivel: 1, descripcion: "Provoca confusión o sordera temporal/permanente." } },
      { name: "Vuelo", type: "arte", system: { nivel: 1, descripcion: "Se eleva 3 m sobre el suelo durante 4 turnos.", variacionesNivel: [
        { nivel: 2, descripcion: "Se eleva 3 m sobre el suelo durante 5 turnos." },
        { nivel: 3, descripcion: "Se eleva 3 m sobre el suelo durante 6 turnos." },
        { nivel: 4, descripcion: "Se eleva 3 m sobre el suelo durante 7 turnos." }
      ] } }
    ]
  },
  "Lethur": {
    descripcion: "Raza que conquistó Undavar gracias a su magistral control de la magia elemental. Su apariencia física está intrínsecamente ligada a su elemento primario.",
    atributos: { fuerza: 1, velocidad: 4, agilidad: 6, inteligencia: 5 },
    artes: [
      { name: "Explosión de magma", type: "arte", system: { nivel: 1, descripcion: "Derrite el terreno subiendo el calor del área." } },
      { name: "Impacto oceánico", type: "arte", system: { nivel: 1, descripcion: "Impacta una gran masa de agua sobre objetivo/estructura." } },
      { name: "Destello solar", type: "arte", system: { nivel: 1, descripcion: "Bola de fuego que ilumina un radio de 5 m y causa daño en área.", variacionesNivel: [
        { nivel: 2, descripcion: "Bola de fuego que ilumina un radio de 6 m y causa daño en área." },
        { nivel: 3, descripcion: "Bola de fuego que ilumina un radio de 7 m y causa daño en área." },
        { nivel: 4, descripcion: "Bola de fuego que ilumina un radio de 8 m y causa daño en área." }
      ] } }
    ]
  },
  "Larius": {
    descripcion: "Seres humanoides capaces de metamorfosear su cuerpo en energía eléctrica. Se distancian de los humanos y son inmunes al control externo en forma pura.",
    atributos: { fuerza: 6, velocidad: 8, agilidad: 2, inteligencia: 5 },
    artes: [
      { name: "Electro metamorfosis", type: "arte", system: { nivel: 1, descripcion: "Convierte su cuerpo en cargas eléctricas impermeables al tacto." } },
      { name: "Carga eléctrica", type: "arte", system: { nivel: 1, descripcion: "Proyectiles eléctricos para lanzar." } },
      { name: "Destello", type: "arte", system: { nivel: 1, descripcion: "Movimiento a altísima velocidad." } }
    ]
  },
  "Vhrazars": {
    descripcion: "Seres de las sombras con tono de piel negro noche. Asesinos consumados que usan la distorsión mental y la manipulación de recuerdos.",
    atributos: { fuerza: 1, velocidad: 4, agilidad: 4, inteligencia: 5 },
    artes: [
      { name: "Distorsión", type: "arte", system: { nivel: 1, descripcion: "Altera la percepción visual de otros (camuflaje humano)." } },
      { name: "Sombra", type: "arte", system: { nivel: 1, descripcion: "Vuelve su cuerpo humo y se desvanece en el aire." } }
    ]
  },
  "Elck": {
    descripcion: "Diminuto y esponjoso compañero de pelaje blanco. Pacíficos y parlanchines, su habilidad única es alterar el peso de los objetos.",
    atributos: { fuerza: 1, velocidad: 6, agilidad: 4, inteligencia: 5 },
    artes: [
      { name: "Peso cero", type: "arte", system: { nivel: 1, descripcion: "Reduce el peso de cualquier cosa o de sí mismo al tocarlo." } },
      { name: "Peso máximo", type: "arte", system: { nivel: 1, descripcion: "Vuelve los objetos extremadamente pesados." } }
    ]
  },
  "Calci": {
    descripcion: "Ser similar a un oso polar humanoide de 3m. Inherentemente cobardes pero con imponente fuerza e inteligencia, capaces de endurecer o ablandar materia.",
    atributos: { fuerza: 8, velocidad: 4, agilidad: 3, inteligencia: 4 },
    artes: [
      { name: "Ablandar", type: "arte", system: { nivel: 1, descripcion: "Ablanda cuerpos u objetos al contacto." } },
      { name: "Endurecer", type: "arte", system: { nivel: 1, descripcion: "Otorga dureza extrema e impenetrable." } }
    ]
  },
  "Elfaris": {
    descripcion: "Seres diminutos con alas de mariposa y orejas puntiagudas. Destacan por su gracia, velocidad extrema y habilidad para cambiar de forma.",
    atributos: { fuerza: 1, velocidad: 7, agilidad: 6, inteligencia: 8 },
    artes: [
      { name: "Cambia forma", type: "arte", system: { nivel: 1, descripcion: "Imita formas manteniendo su tamaño original." } },
      { name: "Factor veloz", type: "arte", system: { nivel: 1, descripcion: "Duplica velocidad con uso de alas." } },
      { name: "Vuelo", type: "arte", system: { nivel: 1, descripcion: "Vuela 3 m de altura durante 4 turnos.", variacionesNivel: [
        { nivel: 2, descripcion: "Vuela 3 m de altura durante 5 turnos." },
        { nivel: 3, descripcion: "Vuela 3 m de altura durante 6 turnos." },
        { nivel: 4, descripcion: "Vuela 3 m de altura durante 7 turnos." }
      ] } }
    ]
  },
  "Tómers": {
    descripcion: "Constructores excepcionales de 2.3m con piel gruesa. Poseen un dominio absoluto sobre la tierra y pueden alterar su elemento a voluntad.",
    atributos: { fuerza: 4, velocidad: 3, agilidad: 6, inteligencia: 6 },
    artes: [
      { name: "Control de tierra", type: "arte", system: { nivel: 1, descripcion: "Manipula la tierra en un radio de 10m." } },
      { name: "Cambio elemental", type: "arte", system: { nivel: 1, descripcion: "Transforma la tierra en otro elemento brevemente." } }
    ]
  },
  "Mairux": {
    descripcion: "Humanoides de 3.2m con piel azul claro y marcas faciales. Maestros de la creación melódica capaces de aturdir o dormir con sus cuerdas vocales.",
    atributos: { fuerza: 1, velocidad: 2, agilidad: 6, inteligencia: 5 },
    artes: [
      { name: "Cántico fragmentado", type: "arte", system: { nivel: 1, descripcion: "Aturde a quienes escuchen su canto." } },
      { name: "Nota Nocturn.", type: "arte", system: { nivel: 1, descripcion: "Induce sueño profundo a oyentes." } }
    ]
  },
  "?? (Ente sin nombre)": {
    descripcion: "Bestia imponente que se vuelve invisible al descansar. Posee una fuerza descomunal y la capacidad de tomar la forma de otros seres.",
    atributos: { fuerza: 8, velocidad: 8, agilidad: 4, inteligencia: 8 },
    artes: [
      // [UNDAVAR-PARTE-9.2-NIVELES] Transformaciones e invisibilidad escalan con el nivel
      { name: "Cambia forma", type: "arte", system: { nivel: 1, descripcion: "Adopta la forma de cualquier ser vivo. En nivel 1 mantiene 2 transformaciones.", variacionesNivel: [
        { nivel: 0, descripcion: "Adopta la forma de cualquier ser vivo. En nivel 0 mantiene 1 transformación." },
        { nivel: 2, descripcion: "Adopta la forma de cualquier ser vivo. En nivel 2 mantiene 3 transformaciones." },
        { nivel: 3, descripcion: "Adopta la forma de cualquier ser vivo. En nivel 3 mantiene 4 transformaciones." },
        { nivel: 4, descripcion: "Adopta la forma de cualquier ser vivo. En nivel 4 mantiene 5 transformaciones." }
      ] } },
      { name: "Invisibilidad", type: "arte", system: { nivel: 1, descripcion: "Se vuelve invisible hasta recibir daño. En nivel 1 reaparece al superar 2d6 + 2 de daño.", variacionesNivel: [
        { nivel: 0, descripcion: "Se vuelve invisible hasta recibir un golpe, sin importar el daño." },
        { nivel: 2, descripcion: "Se vuelve invisible hasta recibir daño. En nivel 2 reaparece al superar 2d6 + 3 de daño." },
        { nivel: 3, descripcion: "Se vuelve invisible hasta recibir daño. En nivel 3 reaparece al superar 3d6 + inteligencia/3 de daño." },
        { nivel: 4, descripcion: "Se vuelve invisible hasta recibir daño. En nivel 4 reaparece al superar 4d6 + inteligencia/2 de daño." }
      ] } },
      { name: "Zarpa", type: "arte", system: { nivel: 1, descripcion: "Ataque cortante de garras pesadas." } }
    ]
  },
  "Cent-wai": {
    descripcion: "Bestia bella con pelaje esplendoroso de 1.2m. Camufla su anatomía como humano o animal doméstico, pero ataca agresivamente a mujeres hermosas.",
    atributos: { fuerza: 4, velocidad: 1, agilidad: 8, inteligencia: 4 },
    artes: [
      { name: "Control melódico", type: "arte", system: { nivel: 1, descripcion: "Controla la mente de seres vivos mediante cuerdas vocales." } },
      { name: "Grito destructor", type: "arte", system: { nivel: 1, descripcion: "Onda sonora devastadora." } }
    ]
  },
  "Chlasgot": {
    descripcion: "Cánidos de 3.7m con cola de zorro y ojos penetrantes. Capaces de viajar entre dimensiones y exhalar un aliento de fuego abrasador.",
    atributos: { fuerza: 4, velocidad: 3, agilidad: 2, inteligencia: 5 },
    artes: [
      { name: "Aliento de fuego", type: "arte", system: { nivel: 1, descripcion: "Llama masiva capaz de abrasar áreas completas." } },
      { name: "Dimenrutas", type: "arte", system: { nivel: 1, descripcion: "Teletransportación a través de viajes interdimensionales." } }
    ]
  },
  "Naigy": {
    descripcion: "Felinos de 50cm con pelaje blanco y alas azules. Sin razonamiento, defienden ferozmente su territorio creando densas neblinas.",
    atributos: { fuerza: 3, velocidad: 5, agilidad: 3, inteligencia: 3 },
    artes: [
      { name: "Umbranébula", type: "arte", system: { nivel: 1, descripcion: "Genera neblina densa que reduce visibilidad." } },
      { name: "Vuelo", type: "arte", system: { nivel: 1, descripcion: "Vuela 3 m de altura durante 4 turnos.", variacionesNivel: [
        { nivel: 2, descripcion: "Vuela 3 m de altura durante 5 turnos." },
        { nivel: 3, descripcion: "Vuela 3 m de altura durante 6 turnos." },
        { nivel: 4, descripcion: "Vuela 3 m de altura durante 7 turnos." }
      ] } }
    ]
  },
  "Sonelat": {
    descripcion: "Félidos depredadores de 70cm y 310kg de tono gris. Tienen la habilidad de distorsionar y manipular los sonidos a su alrededor.",
    atributos: { fuerza: 1, velocidad: 3, agilidad: 3, inteligencia: 3 },
    artes: [
      { name: "Anomalía acústica", type: "arte", system: { nivel: 1, descripcion: "Control absoluto de sonidos en un área." } },
      { name: "Garra resonante", type: "arte", system: { nivel: 1, descripcion: "Vibraciones que causan aturdimiento e incrementan daño." } },
      { name: "Zarpazo sónico", type: "arte", system: { nivel: 1, descripcion: "Ataque a distancia que daña órganos internos." } },
      { name: "Aullido extremo", type: "arte", system: { nivel: 1, descripcion: "Onda de presión sonora frontal." } }
    ]
  },
  "Planzúl": {
    descripcion: "Ave majestuosa de plumaje dorado/bronceado. Se desplaza a velocidades impresionantes y posee ataques acústicos avanzados.",
    atributos: { fuerza: 5, velocidad: 9, agilidad: 7, inteligencia: 4 },
    artes: [
      { name: "Anomalía acústica", type: "arte", system: { nivel: 1, descripcion: "Manipulación de área acústica." } },
      { name: "Garra resonante", type: "arte", system: { nivel: 1, descripcion: "Vibración sónica en garras." } },
      { name: "Zarpazo sónico", type: "arte", system: { nivel: 1, descripcion: "Pulso sonoro liberado al aire." } },
      { name: "Aullido extremo", type: "arte", system: { nivel: 1, descripcion: "Rugido en línea recta." } }
    ]
  },
  "Terl": {
    descripcion: "Pequeña criatura alargada de 25cm con pelaje negro. Carece de capacidades ofensivas pero inspira respeto por su poder de curación y resurrección.",
    atributos: { fuerza: 2, velocidad: 3, agilidad: 1, inteligencia: 6 },
    artes: [
      { name: "Resurrección", type: "arte", system: { nivel: 1, descripcion: "Restaura la vida consumiendo energía propia." } },
      { name: "Curación", type: "arte", system: { nivel: 1, descripcion: "Sana cualquier condición física o mental." } }
    ]
  },
  "Dragcoin": {
    descripcion: "Reptil de 65cm con escamas grises. Capaz de ejercer un control total sobre la naturaleza y otros animales en un rango de 100m.",
    atributos: { fuerza: 4, velocidad: 8, agilidad: 8, inteligencia: 5 },
    artes: [
      { name: "Control Totalus", type: "arte", system: { nivel: 1, descripcion: "Controla plantas, animales o elementos a 100m." } }
    ]
  },
  "Loraiz": {
    descripcion: "Ave rapaz de 167cm de envergadura con cuerpo blanco y pico amarillo. Controla el clima a voluntad.",
    atributos: { fuerza: 8, velocidad: 5, agilidad: 6, inteligencia: 7 },
    artes: [
      { name: "Control Totalus", type: "arte", system: { nivel: 1, descripcion: "Control climático y animal a 100m." } }
    ]
  },
  "Cathexin": {
    descripcion: "Criatura colosal de 3m con pelaje marrón, orejas redondas y ojos saltones. Pese a su ternura, controla y materializa el aire a su favor.",
    atributos: { fuerza: 8, velocidad: 7, agilidad: 8, inteligencia: 1 },
    artes: [
      { name: "Vórtice Aéreo", type: "arte", system: { nivel: 1, descripcion: "Desvía ataques y manipula objetos en aire." } },
      { name: "Esfera de Viento", type: "arte", system: { nivel: 1, descripcion: "Proyectil o barrera de aire denso." } }
    ]
  },
  "Dradchra": {
    descripcion: "Oscuros de 2.5m con piel escamosa rojo intenso y ojos color miel. Destilan ira y ambición destructiva.",
    atributos: { fuerza: 7, velocidad: 6, agilidad: 8, inteligencia: 7 },
    artes: [
      { name: "Ira Ancestral", type: "arte", system: { nivel: 1, descripcion: "Cuando el Dradchra recibe daño, obtiene +1 Acierto adicional en su siguiente acción ofensiva. Este efecto puede acumularse hasta +2 Aciertos." } },
      { name: "Devastación Carmesí", type: "arte", system: { nivel: 1, descripcion: "Una acción de ataque puede afectar a más de un objetivo cercano o causar daño estructural (muros, refugios, construcciones). No puede usarse en turnos consecutivos." } }
    ]
  },
  "Chwelt (Coloso Territorial)": {
    descripcion: "Demonios robustos de 3m con piel oscura, orejas puntiagudas y fuerza descomunal.",
    atributos: { fuerza: 8, velocidad: 7, agilidad: 6, inteligencia: 6 },
    artes: [
      { name: "Cuerpo Inamovible", type: "arte", system: { nivel: 1, descripcion: "Ignora el primer efecto negativo que intente reducir Fuerza, Velocidad o impedir acciones físicas." } },
      { name: "Golpe de Dominio", type: "arte", system: { nivel: 1, descripcion: "Si el ataque supera la dificultad por 2 o más aciertos, el objetivo queda derribado o incapacitado un turno." } }
    ]
  },
  "Chwelt (Elegante Destructor)": {
    descripcion: "Elegantes demonios de piel negro opaco con destellos violetas, ojos amatista y tatuajes tribales.",
    atributos: { fuerza: 7, velocidad: 8, agilidad: 8, inteligencia: 7 },
    artes: [
      { name: "Belleza Maligna", type: "arte", system: { nivel: 1, descripcion: "Las criaturas conscientes que interactúan con este Chwelt tienen +1 dificultad en acciones de ataque o resistencia mental contra él." } },
      { name: "Aniquilación Silenciosa", type: "arte", system: { nivel: 1, descripcion: "Una vez por combate, puede convertir un ataque exitoso en un efecto devastador: el daño ignora defensas pasivas y deja al objetivo debilitado." } }
    ]
  },
  "Gertas": {
    descripcion: "Seres pequeños de piel cian translúcida. Destacan por su poder mental, ilusión y fuerza colosal.",
    atributos: { fuerza: 7, velocidad: 6, agilidad: 6, inteligencia: 8 },
    artes: [
      { name: "Dominio Psíquico", type: "arte", system: { nivel: 1, descripcion: "Puede imponer una orden simple a un objetivo consciente si obtiene más aciertos que él. No funciona en objetivos sin mente o completamente bestiales." } },
      { name: "Ilusión Perfecta", type: "arte", system: { nivel: 1, descripcion: "Crea una ilusión compleja capaz de engañar múltiples sentidos. Romperla requiere superar una dificultad fijada por el SR." } }
    ]
  },
  "Ghirley": {
    descripcion: "Maestros de los sismos de piel pétrea similar al mármol. Musculosos y capaces de provocar terremotos.",
    atributos: { fuerza: 6, velocidad: 6, agilidad: 7, inteligencia: 7 },
    artes: [
      { name: "Pulso Telúrico", type: "arte", system: { nivel: 1, descripcion: "Puede alterar el terreno cercano: grietas, desequilibrio, derrumbes menores. Los enemigos en la zona tienen +1 dificultad a acciones físicas ese turno." } },
      { name: "Ira de la Tierra", type: "arte", system: { nivel: 1, descripcion: "Puede provocar un impacto sísmico que afecta a todos los objetivos en un área. No distingue aliados de enemigos." } }
    ]
  }
};

// [UNDAVAR-PARTE-9.2-BESTIARIO] Categorías del manual y alias de nombres antiguos
const BESTIARIO_CATEGORIAS = {
  "ser-salvaje": "Seres salvajes",
  "ser-domestico": "Seres domésticos",
  "bestia-salvaje": "Bestias salvajes",
  "bestia-domestica": "Bestias domésticas",
  "oscuro": "Oscuros"
};

const BESTIARIO_POR_CATEGORIA = {
  "ser-salvaje": ["Enoji", "Krintal", "Lethur", "Larius", "Vhrazars"],
  "ser-domestico": ["Elck", "Calci", "Elfaris", "Tómers", "Mairux"],
  "bestia-salvaje": ["?? (Ente sin nombre)", "Cent-wai", "Chlasgot", "Naigy", "Sonelat"],
  "bestia-domestica": ["Planzúl", "Terl", "Dragcoin", "Loraiz", "Cathexin"],
  "oscuro": ["Dradchra", "Chwelt (Coloso Territorial)", "Chwelt (Elegante Destructor)", "Gertas", "Ghirley"]
};

Object.entries(BESTIARIO_POR_CATEGORIA).forEach(([categoria, nombres]) => {
  nombres.forEach(nombre => {
    if (BESTIARIO_UNDAVAR[nombre]) BESTIARIO_UNDAVAR[nombre].categoria = categoria;
  });
});

const BESTIARIO_ALIAS = {
  "Cancerbero Invisible": "?? (Ente sin nombre)",
  "Chwelt (Guerra)": "Chwelt (Coloso Territorial)",
  "Chwelt (Sombra)": "Chwelt (Elegante Destructor)"
};

function nombreRazaManual(raza) {
  return BESTIARIO_ALIAS[raza] || raza;
}

function presetBestiario(raza) {
  return BESTIARIO_UNDAVAR[nombreRazaManual(raza)] || null;
}

// [UNDAVAR-PARTE-9.3-SIERVOS] Tipos de siervo del manual
const TIPOS_SIERVO = {
  "": "Sin vínculo",
  mascota: "Mascota",
  esclavo: "Esclavo",
  sirviente: "Sirviente"
};
const SIERVO_PA_MAXIMO = 6;

// [UNDAVAR-PARTE-9.4-REFUGIOS] Refugios del manual: materiales, daño y reparación
const REFUGIOS_UNDAVAR = {
  1: { materiales: { 1: 5, 2: 3 }, danoMax: 8, reparar: { puntos: 1, aciertos: 3 }, estados: 0, tiempo: "2 turnos", extra: "" },
  2: { materiales: { 1: 7, 2: 4, 3: 4 }, danoMax: 10, reparar: { puntos: 2, aciertos: 3 }, estados: 0, tiempo: "3 turnos", extra: "" },
  3: { materiales: { 1: 13, 2: 9, 3: 18 }, danoMax: 12, reparar: { puntos: 2, aciertos: 2 }, estados: 1, tiempo: "3 turnos, -1 S", extra: "" },
  4: { materiales: { 1: 20, 2: 10, 3: 15, 4: 6 }, danoMax: 14, reparar: { puntos: 3, aciertos: 3 }, estados: 2, tiempo: "4 turnos", extra: "" },
  5: { materiales: { 1: 25, 3: 20, 4: 15, 5: 10 }, danoMax: 16, reparar: { puntos: 3, aciertos: 2 }, estados: 2, tiempo: "3 turnos, +3 aciertos", extra: "" },
  6: { materiales: { 3: 25, 4: 20, 5: 30 }, danoMax: 20, reparar: { puntos: 4, aciertos: 2 }, estados: 4, tiempo: "4 turnos, +4 aciertos", extra: "Cura 1 pt de vida cada 2 turnos y 1 pt de herida cada turno." }
};

// [UNDAVAR-PARTE-9.4-REFUGIOS] Materiales por tipo de construcción
const MATERIALES_REFUGIO = {
  1: { generico: "Elementos de construcción (Tipo 1)", nombres: ["Roble de Weir", "Roble del Ángel", "Cobre Riowu"] },
  2: { generico: "Elementos de construcción (Tipo 2)", nombres: ["Cobre Gatsu", "Acebol del Rocío"] },
  3: { generico: "Elementos de construcción (Tipo 3)", nombres: ["Hierro Qi Ang Xu", "Hierro Fim"] },
  4: { generico: "Elementos de construcción (Tipo 4)", nombres: ["Eucaliptos de Fal io"] },
  5: { generico: "Elementos de construcción (Tipo 5)", nombres: ["Buloke Lino", "Metal Jo"] }
};

// [UNDAVAR-PARTE-9.5-RECETAS] Encantos especiales del manual
const ENCANTOS_UNDAVAR = [
  { id: "resistencia", nombre: "Resistencia", efecto: "Aumenta la resistencia del objeto y protege a quien lo porta.", oficios: ["herrero", "ebanista", "peleteria", "artesano_guerra"] },
  { id: "ocultacion", nombre: "Ocultación", efecto: "Permite ocultar la presencia de quien lo porta.", oficios: ["herrero", "ebanista", "peleteria", "sastre"] },
  { id: "energia", nombre: "Energía", efecto: "Incrementa la energía de quien lo porta.", oficios: ["herrero", "ebanista", "artesano_guerra"] },
  { id: "levitacion", nombre: "Levitación", efecto: "Permite levitar a quien lo porta.", oficios: ["ebanista", "sastre"] }
];

// [UNDAVAR-PARTE-9.5-RECETAS] Recetas del taller y su oficio
const RECETAS_UNDAVAR = [
  {
    id: "potenciacion", nombre: "Elixir de potenciación", oficio: "alquimista", tipo: "elixir", resultado: "Elixir de potenciación",
    ingredientes: [{ nombre: "Plumas de Planzúl", cantidad: 1 }, { nombre: "Hojas de Nauzu", cantidad: 1 }, { nombre: "Semillas de Cilantro", cantidad: 1 }]
  },
  {
    id: "armamento", nombre: "Elixir de armamento", oficio: "alquimista", tipo: "elixir", resultado: "Elixir de armamento",
    ingredientes: [{ nombre: "Metal Jo", cantidad: 1 }, { nombre: "Fruto de Yoyi Cálida", cantidad: 1 }, { nombre: "Plumas de Planzúl", cantidad: 2 }]
  },
  {
    id: "vida", nombre: "Elixir de la vida", oficio: "medico", tipo: "elixir", resultado: "Elixir de la vida",
    ingredientes: [{ nombre: "Raíz de Mairis Púrpura", cantidad: 2 }, { nombre: "Raíz de Mairis Amarilla", cantidad: 1 }, { nombre: "Frutos del Rocío Blanco", cantidad: 1 }]
  },
  {
    id: "rejuvenecimiento", nombre: "Elixir de rejuvenecimiento", oficio: "medico", tipo: "elixir", resultado: "Elixir de rejuvenecimiento",
    ingredientes: [{ nombre: "Pétalos de Mairis Púrpura", cantidad: 2 }, { nombre: "Pétalos de Mairis Amarilla", cantidad: 1 }, { nombre: "Semillas de Laila Radiante", cantidad: 1 }]
  },
  {
    id: "arma_hierro", nombre: "Arma de hierro", oficio: "herrero", tipo: "arma", resultado: "Arma de hierro", encantos: true,
    system: { descripcion: "Arma forjada a mano con hierro y cobre.", duracion: "Única" },
    ingredientes: [{ nombre: "Hierro Fim", cantidad: 1 }, { nombre: "Cobre Gatsu", cantidad: 1 }, { nombre: "Roble de Weir", cantidad: 1 }]
  },
  {
    id: "objeto_madera", nombre: "Objeto de madera", oficio: "ebanista", tipo: "objeto", resultado: "Objeto de madera", encantos: true,
    system: { descripcion: "Objeto de madera fina tallado por un ebanista.", duracion: "Única" },
    ingredientes: [{ nombre: "Roble de Weir", cantidad: 2 }, { nombre: "Acebol del Rocío", cantidad: 1 }]
  },
  {
    id: "arma_guerra", nombre: "Arma de guerra", oficio: "artesano_guerra", tipo: "arma", resultado: "Arma de guerra", encantos: ["resistencia", "energia"],
    system: { descripcion: "Arma única creada por un artesano de guerra.", duracion: "Única" },
    ingredientes: [{ nombre: "Hierro Qi Ang Xu", cantidad: 1 }, { nombre: "Cobre Riowu", cantidad: 1 }, { nombre: "Roble de Weir", cantidad: 1 }]
  }
];

// [UNDAVAR-PARTE-3.6] PV máximo único del sistema
const PV_MAXIMO = 564;

function calcularRango(pv) {
  pv = Number(pv) || 0;
  let actual = RANGOS_UNDAVAR[0];
  for (const r of RANGOS_UNDAVAR) if (pv >= r.minPV) actual = r;
  return actual.nombre;
}
// [UNDAVAR-PARTE-4.2d] Rango principal (sin subrango) y umbral mínimo
function rangoPrincipal(nombre) {
  return String(nombre || "").split(" ")[0];
}
function rangoMinimoAlcanzado(pv, nombreRango) {
  const objetivo = RANGOS_UNDAVAR.find(r => r.nombre === nombreRango);
  return !!objetivo && (Number(pv) || 0) >= objetivo.minPV;
}

// [UNDAVAR-PARTE-4.2e] Progreso hacia el siguiente rango (incluye subrangos)
function progresoRango(pv) {
  pv = Number(pv) || 0;
  const nombre = calcularRango(pv);
  const idx = RANGOS_UNDAVAR.findIndex(r => r.nombre === nombre);
  const actual = RANGOS_UNDAVAR[idx];
  const siguiente = RANGOS_UNDAVAR[idx + 1] || null;
  if (!siguiente) return { actual, siguiente: null, faltan: 0, pct: 100 };
  const tramo = siguiente.minPV - actual.minPV;
  return { actual, siguiente, faltan: Math.max(0, siguiente.minPV - pv), pct: Math.max(0, Math.min(100, Math.round((pv - actual.minPV) / tramo * 100))) };
}

function calcularPAMax(pv) {
  pv = Number(pv) || 0;

  // Umbrales mínimos de los Rangos Principales
  if (pv >= 564) return 16; // Lairazul
  if (pv >= 440) return 14; // Leyenda
  if (pv >= 329) return 12; // Lait Betsu
  if (pv >= 231) return 10; // Wonrixay
  if (pv >= 146) return 8;  // Sedrein
  if (pv >= 74)  return 6;  // Breintin
  if (pv >= 15)  return 4;  // Astrei
  
  return 2; // Sin Rango
}
function costoSuerte(pv) {
  const r = RANGOS_UNDAVAR.find(r => r.nombre === calcularRango(pv));
  return r ? (r.costoS || 3) : 3;
}
function costoPCAccion(pv) {
  const r = RANGOS_UNDAVAR.find(r => r.nombre === calcularRango(pv));
  return r ? (r.costoPC || 15) : 15;
}
function costoPANivel(n) { return ({0:2,1:4,2:6,3:8,4:10})[Number(n)] ?? 0; }
function costoPVNivel(n) { return ({0:0,1:15,2:30,3:45,4:75})[Number(n)] ?? 15; }
// [UNDAVAR-PARTE-4.2c4] Nivel 4 da +2 aciertos, igual que el nivel 3
function bonusCombate(n) { return ({0:0,1:0,2:1,3:2,4:2})[Number(n)] ?? 0; }

// --- Erianas ---
const TASAS_ERIANAS = { oro:1, rubi:100, diamante:10000 };
function calcularCambioErianas(cantidad, desde, hacia) {
  const totalEnOro = cantidad * TASAS_ERIANAS[desde];
  return totalEnOro / TASAS_ERIANAS[hacia];
}
function erianasATotalOro(erianas) {
  return (Number(erianas.oro)||0) + (Number(erianas.rubi)||0)*100 + (Number(erianas.diamante)||0)*10000;
}
function oroATresMonedas(totalOro) {
  const diamante = Math.floor(totalOro / 10000);
  const rubi = Math.floor((totalOro % 10000) / 100);
  const oro = totalOro % 100;
  return { oro, rubi, diamante };
}

// --- Dados (d6, 1/3/5 acierto, 2/4/6 pérdida) ---
function lanzarDados(n) {
  const ds = [];
  for (let i=0;i<n;i++) ds.push(1 + Math.floor(Math.random()*6));
  return ds;
}
function resumenDados(ds) {
  const aciertos = ds.filter(d=>[1,3,5].includes(d)).length;
  const perdidas = ds.filter(d=>[2,4,6].includes(d)).length;
  const pv = ds.filter(d=>[1,3,5].includes(d)).reduce((a,b)=>a+b,0);
  const suma = ds.reduce((a,b)=>a+b,0);
  return { ds, aciertos, perdidas, pv, suma, buenaSuerte: suma>12 };
}
function tiradaEstandar() { return resumenDados(lanzarDados(4)); }
function tiradaAtaque() {
  const ds = lanzarDados(2);
  const base = resumenDados(ds);
  const dano = ds.filter(d=>[2,4,6].includes(d)).length;
  return { ...base, dano };
}
function tiradaDanoNivel(nivel, atr = 0, rangoOpciones = {}) {
  nivel = Number(nivel) || 0;
  atr = Number(atr) || 0;

  let numDados = 2, bonoFijo = 0;

  if (nivel === 0) {
    let rangoNombre = "";
    
    if (typeof rangoOpciones === "string") {
      rangoNombre = rangoOpciones;
    } else if (typeof rangoOpciones === "object" && rangoOpciones !== null) {
      rangoNombre = rangoOpciones.rango || (rangoOpciones.pv !== undefined ? calcularRango(rangoOpciones.pv) : "");
    }

    const rLower = rangoNombre.toLowerCase();

    // Determinación de dados según el Rango
    if (rLower.includes("lait betsu") || rLower.includes("leyenda") || rLower.includes("lairazul")) {
      numDados = 4;
    } else if (rLower.includes("sedrein") || rLower.includes("wonrixay")) {
      numDados = 3;
    } else {
      // Astrei, Breintin, Sin Rango o por defecto en Dados Libres
      numDados = 2;
    }
    bonoFijo = 0;
  } 
  else if (nivel === 1) { numDados = 2; bonoFijo = 2; }
  else if (nivel === 2) { numDados = 2; bonoFijo = 3; }
  else if (nivel === 3) { numDados = 3; bonoFijo = Math.floor(atr / 3); }
  else { numDados = 4; bonoFijo = Math.floor(atr / 2); }

  const ds = lanzarDados(numDados);
  const danoPorDados = ds.filter(d => [2, 4, 6].includes(d)).length;
  const pv = ds.filter(d => [1, 3, 5].includes(d)).reduce((a, b) => a + b, 0);
  const suma = ds.reduce((a, b) => a + b, 0);

  return { 
    ds, 
    danoPorDados, 
    bonoFijo, 
    danoTotal: danoPorDados + bonoFijo, 
    pv, 
    suma, 
    buenaSuerte: suma > 12 
  };
}
function tiradaRebote() {
  const ds = lanzarDados(4);
  const aciertos = ds.filter(d=>[1,3,5].includes(d)).length;
  const pv = ds.filter(d=>[1,3,5].includes(d)).reduce((a,b)=>a+b,0);
  const suma = ds.reduce((a,b)=>a+b,0);
  let resultado = "Sin rebote";
  if (aciertos === 3) resultado = "+1 Cansancio";
  else if (aciertos > 3) resultado = "+1 Fatiga";
  return { ds, aciertos, pv, suma, resultado, buenaSuerte: suma>12 };
}
function tiradaDespertar() {
  const ds = lanzarDados(4);
  const aciertos = ds.filter(d=>[1,3,5].includes(d)).length;
  const pv = ds.filter(d=>[1,3,5].includes(d)).reduce((a,b)=>a+b,0);
  const suma = ds.reduce((a,b)=>a+b,0);
  return { ds, aciertos, pv, suma, despierta: aciertos>=4, buenaSuerte: suma>12 };
}
function tiradaErianasIniciales() {
  const ds = lanzarDados(4);
  const suma = ds.reduce((a,b)=>a+b,0);
  return { ds, suma, total: suma*10 };
}

// --- Datos derivados de un personaje (heridas, salud, atributos) ---
function calcularDerivados(sys, items) {
  const hambre = Number(sys.extensionEstado?.hambre?.value)||0;
  const sed = Number(sys.extensionEstado?.sed?.value)||0;
  const cansancio = Number(sys.extensionEstado?.cansancio?.value)||0;
  const fatiga = Number(sys.extensionEstado?.fatiga?.value)||0;
  const totalEstados = hambre+sed+cansancio+fatiga;
  const bonusHeridas = Math.floor(totalEstados/2);

  // [UNDAVAR-PARTE-3.6B] ptHerida ya incluye la aportación de los estados; no se suma otra vez
  let heridasTotales = Math.min(8, Number(sys.estado?.ptHerida?.value)||0);
  let heridasBase = heridasTotales;

  let bonoSalud = 0;
  for (const it of (items||[])) if (it.type === "oficio") bonoSalud += Number(it.system?.bonos?.salud)||0;

  // [UNDAVAR-PARTE-4.2e4-BONOS] Bonos temporales de Salud y PA
  const saludBase = 8 + bonoSalud;
  const bonoSaludActivo = bonoActivoSuma(sys, "salud", saludBase);
  const paBase = calcularPAMax(Number(sys.pv?.value) || 0);
  const bonoPAActivo = bonoActivoSuma(sys, "pa", paBase);

  const penalizacionSalud = Math.floor(heridasTotales/4);
  const limiteReal = (saludBase + bonoSaludActivo) - penalizacionSalud;
  const pv = Number(sys.pv?.value)||0;

  // [UNDAVAR-PARTE-4.2i-ESTADOS] Cada 2 marcas de Cansancio/Fatiga: −1 Velocidad o Agilidad
  const marcasCansancioFatiga = cansancio + fatiga;
  const penalizacionCF = Math.floor(marcasCansancioFatiga / 2);
  const penalizacionVelocidad = Math.ceil(penalizacionCF / 2);
  const penalizacionAgilidad = penalizacionCF - penalizacionVelocidad;

  return {
    rango: calcularRango(pv),
    pvMaximo: PV_MAXIMO,
    paMaximo: paBase + bonoPAActivo,
    costoSuerte: costoSuerte(pv),
    costoPCAccion: costoPCAccion(pv),
    bonusHeridas, heridasTotales, saludPorHeridas: penalizacionSalud,
    saludMaxima: saludBase + bonoSaludActivo,
    saludLimiteActual: Math.max(0,limiteReal),
    heridasBase,
    marcasCansancioFatiga, penalizacionCansancioFatiga: penalizacionCF,
    penalizacionVelocidad, penalizacionAgilidad
  };
}

function actorPersonajePorDefecto(nombre="Nuevo Undavarita") {
  return {
    id: nuevoId(),
    tipo: "personaje",
    nombre,
    img: "",
    system: {
      datos: {
  procedencia: "",
  edad: "",
  clase: "artista",
  gremio: "",
  maestro: "",
  sabioRegidor: "",
  descripcion: "",
  personalidad: "",
  historia: ""
},
      pv: { value:0 },
      estado: { ptHerida:{value:0}, ptSalud:{value:8,max:8} },
      pa: { value:2 },
      atributos: { fuerza:0, velocidad:0, agilidad:0, inteligencia:0 },
      pdc: { pc:0, pe:0, pr:0, pd:8, pp:0, s:0 },
      erianas: { oro:0, rubi:0, diamante:0 },
      extensionEstado: { hambre:{value:0}, sed:{value:0}, cansancio:{value:0}, fatiga:{value:0} },
      puntosYMarcas: {
        po:{estado:"I",value:0}, pol:{estado:"I",value:0}, marcaControl:{estado:"I",value:0}
      }
    },
    items: [],
    updatedAt: Date.now()
  };
}

function actorNPCPorDefecto(nombre="Nuevo PNJ") {
  return {
    id: nuevoId(),
    tipo: "npc",
    nombre,
    img: "",
    system: {
      datos: { raza:"", descripcion:"" },
      estado: { ptHerida:{value:0}, ptSalud:{value:8,max:8} },
      pa: { value:6 },
      atributos: { fuerza:0, velocidad:0, agilidad:0, inteligencia:0 },
      // [UNDAVAR-PARTE-10.6-ERIANAS-PNJ] Cartera propia del PNJ
      erianas: { oro:0, rubi:0, diamante:0 }
    },
    items: [],
    updatedAt: Date.now()
  };
}

function tiendaPorDefecto(nombre="Nueva Tienda") {
  return {
    id: nuevoId(),
    tipo: "tienda",
    nombre,
    items: [],
    updatedAt: Date.now()
  };
}

// [UNDAVAR-PARTE-4.2e3-TURNO] Convierte "2 turnos" o "1-2 turno" a número (usa el mayor)
function parseTurnos(valor) {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return Math.max(0, Math.floor(valor));
  const texto = String(valor).toLowerCase().trim();
  if (!texto || texto === "/" || texto === "—" || texto === "-") return 0;
  const numeros = texto.match(/\d+/g);
  if (!numeros) return 0;
  return Math.max(...numeros.map(n => parseInt(n, 10)));
}

// [UNDAVAR-PARTE-4.2e3-TURNO] Turnos que dura el efecto de un ítem
function duracionTurnosItem(item) {
  const s = item?.system || {};
  const ef = s.efectoMecanico;
  const porTurno = ef?.campos && CAMPOS_EFECTO.some(k =>
    Number(ef.campos[k]?.valor) > 0 && ef.campos[k].cuando === "turno"
  );
  if (porTurno) return Math.max(1, Number(ef.turnos) || 1);
  return parseTurnos(s.duracion);
}

// [UNDAVAR-PARTE-4.2e3-TURNO] Turnos de enfriamiento de un ítem
function enfriamientoTurnosItem(item) {
  const s = item?.system || {};
  if (Number(s.enfriamientoTurnos) > 0) return Math.floor(Number(s.enfriamientoTurnos));
  return parseTurnos(s.enfriamiento);
}

// [UNDAVAR-PARTE-4.2e3-TURNO] Texto corto del enfriamiento de un personaje
function describirEnfriamiento(e) {
  if (!e) return "";
  const espera = Number(e.espera) || 0;
  const turnos = Number(e.turnos) || 0;
  if (espera > 0) return `efecto activo, ${espera} turno${espera === 1 ? "" : "s"} para el enfriamiento`;
  return `${turnos} turno${turnos === 1 ? "" : "s"} de enfriamiento`;
}

// [UNDAVAR-PARTE-4.2e4-BONOS] Estadísticas que aceptan bonos temporales
const ESTADISTICAS_BONO = [
  { id: "salud", nombre: "Salud" },
  { id: "herida", nombre: "Herida" },
  { id: "hambre", nombre: "Hambre" },
  { id: "sed", nombre: "Sed" },
  { id: "cansancio", nombre: "Cansancio" },
  { id: "fatiga", nombre: "Fatiga" },
  { id: "pa", nombre: "PA" },
  { id: "pv", nombre: "PV" },
  { id: "fuerza", nombre: "Fuerza" },
  { id: "velocidad", nombre: "Velocidad" },
  { id: "agilidad", nombre: "Agilidad" },
  { id: "inteligencia", nombre: "Inteligencia" },
  { id: "aciertos", nombre: "Aciertos" },
  { id: "dano", nombre: "Daño fijo" },
  { id: "danoDados", nombre: "Dados de daño" },
  { id: "reduccion", nombre: "Reducción de daño" }
];

// [UNDAVAR-PARTE-4.2e4-BONOS] Nombre visible de una estadística de bono
function etiquetaEstadistica(id) {
  return ESTADISTICAS_BONO.find(e => e.id === id)?.nombre || id;
}

// [UNDAVAR-PARTE-4.2e4-BONOS] Suma los bonos activos de una estadística
function bonoActivoSuma(sys, clave, base = 1) {
  const bonos = Array.isArray(sys?.bonosActivos) ? sys.bonosActivos : [];
  return bonos.reduce((total, b) => {
    if (b.estadistica !== clave) return total;
    const valor = Number(b.valor) || 0;
    if (b.modo === "pct") return total + Math.max(1, Math.round((Number(base) || 1) * valor / 100));
    return total + valor;
  }, 0);
}

// [UNDAVAR-PARTE-4.2e4b-USO-BONOS] Texto corto de los bonos de un ítem
function describirBonosItem(item) {
  const bonos = Array.isArray(item?.system?.bonos) ? item.system.bonos : [];
  return bonos.map(b => {
    const etiqueta = etiquetaEstadistica(b.estadistica);
    const valor = Number(b.valor) || 0;
    return `${valor}${b.modo === "pct" ? "%" : ""} ${etiqueta} · ${Math.max(1, Number(b.turnos) || 1)} turno(s)`;
  }).join(" · ");
}

// [UNDAVAR-PARTE-10.4-ARMAS] Distingue un arma-objeto de un arma de gladiador
function esArmaComun(item) {
  if (!item || item.type !== "arma") return false;
  const s = item.system || {};
  // El campo explícito manda sobre cualquier deducción
  if (typeof s.armaComun === "boolean") return s.armaComun;

  // Compatibilidad con armas creadas antes de la parte 10.4
  const habs = Array.isArray(s.habilidades) ? s.habilidades : [];
  const habilidadReal = habs.some(h => {
    if (!h) return false;
    const nombre = String(h.nombre || "").trim();
    // Un efecto definido pero con todos los valores a cero no es una habilidad real
    const ef = h.efectoMecanico;
    const efReal = !!ef && (ef.definido === true
      ? Object.values(ef.campos || {}).some(c => Number(c?.valor) > 0)
      : true);
    return (nombre && !/^Habilidad\s*\d+$/i.test(nombre)) ||
      !!String(h.conjuro || "").trim() ||
      !!String(h.descripcion || "").trim() ||
      (Array.isArray(h.bonos) && h.bonos.length > 0) ||
      (Array.isArray(h.condiciones) && h.condiciones.length > 0) ||
      efReal;
  });
  if (habilidadReal) return false;
  if (Number(s.nivel) > 0) return false;
  if (Array.isArray(s.condiciones) && s.condiciones.length > 0) return false;
  if (s.modoUso && s.modoUso !== "dano") return false;
  return true;
}

// [UNDAVAR-PARTE-4.2e4b-USO-BONOS] Un ítem se puede usar si cura o si da bonos
// [UNDAVAR-PARTE-4.2h1-HABILIDADES] Artes y armas se usan si tienen alguna habilidad
// [UNDAVAR-PARTE-10.4-ARMAS] El arma común se usa como objeto, no como arte
function itemTieneUso(item) {
  if (item?.type === "arte" || (item?.type === "arma" && !esArmaComun(item))) return habilidadesItem(item).length > 0;
  if (efectoMecanicoItem(item) || (Array.isArray(item?.system?.bonos) && item.system.bonos.length > 0)) return true;
  // [UNDAVAR-PARTE-10.5-NIVELES] También se puede usar si el efecto o los bonos están en un nivel
  const variaciones = Array.isArray(item?.system?.variacionesNivel) ? item.system.variacionesNivel : [];
  return variaciones.some(v =>
    (Array.isArray(v.bonos) && v.bonos.length > 0) ||
    (v.efectoMecanico?.definido && CAMPOS_EFECTO.some(k => Number(v.efectoMecanico.campos?.[k]?.valor) > 0))
  );
}

// [UNDAVAR-PARTE-4.2e4-BONOS] Bono de daño fijo y dados extra de daño
function bonoDano(actor) { return bonoActivoSuma(actor?.system, "dano", 1); }
function bonoDadosDano(actor) { return Math.max(0, Math.floor(bonoActivoSuma(actor?.system, "danoDados", 1))); }
function bonoAciertos(actor) { return bonoActivoSuma(actor?.system, "aciertos", 1); }

// [UNDAVAR-PARTE-4.2h2-PAREJA] Atributo con sus bonos activos (el viento de las hermanas)
function bonoAtributoActivo(actor, atr) {
  return bonoActivoSuma(actor?.system, atr, 0);
}

// [UNDAVAR-PARTE-4.2i-ESTADOS] Penalización temporal por Cansancio/Fatiga
function penalizacionEstadoAtributo(actor, atr) {
  if (atr !== "velocidad" && atr !== "agilidad") return 0;
  const ext = actor?.system?.extensionEstado || {};
  const marcas = (Number(ext.cansancio?.value) || 0) + (Number(ext.fatiga?.value) || 0);
  const total = Math.floor(marcas / 2);
  if (!total) return 0;
  // Primero Velocidad, luego Agilidad
  const vel = Math.ceil(total / 2);
  return atr === "velocidad" ? vel : total - vel;
}

// [UNDAVAR-PARTE-4.2i-ESTADOS] Atributo efectivo con bonos y penalización de estados
// [UNDAVAR-PARTE-4.2h4j-ESTADOS-COMBATE] La penalización de Cansancio/Fatiga solo cuenta en combate
function atributoEfectivo(actor, atr, enCombate = false) {
  const base = (Number(actor?.system?.atributos?.[atr]) || 0) + bonoAtributoActivo(actor, atr);
  const penalizacion = enCombate ? penalizacionEstadoAtributo(actor, atr) : 0;
  return Math.max(0, base - penalizacion);
}

// [UNDAVAR-PARTE-4.2e4-BONOS] Añade los bonos de daño a una tirada ya resuelta
function aplicarBonoDano(r, actor) {
  if (!r) return r;
  const dadosExtra = bonoDadosDano(actor);
  const fijoExtra = bonoDano(actor);
  if (!dadosExtra && !fijoExtra) return r;
  const ds = [...r.ds];
  for (let i = 0; i < dadosExtra; i++) ds.push(...lanzarDados(1));
  const danoPorDados = ds.filter(d => [2, 4, 6].includes(d)).length;
  return {
    ...r,
    ds,
    danoPorDados,
    bonoFijo: Number(r.bonoFijo) + fijoExtra,
    danoTotal: danoPorDados + Number(r.bonoFijo) + fijoExtra
  };
}

// [UNDAVAR-PARTE-4.2e5-ARTES] Condiciones automáticas de artes y armas
const CONDICIONES_ARTE = [
  { id: "quemado", nombre: "Quemado", turnos: 2 },
  { id: "congelado", nombre: "Congelado", turnos: 2 },
  { id: "aturdido", nombre: "Aturdido", turnos: 1 },
  { id: "envenenado", nombre: "Envenenado", turnos: 3 },
  { id: "paralizado", nombre: "Paralizado", turnos: 2 },
  { id: "sangrado", nombre: "Sangrado", turnos: 2 },
  { id: "invisible", nombre: "Invisible", turnos: 2 },
  { id: "debilitado", nombre: "Debilitado", turnos: 2 },
  { id: "insolacion", nombre: "Insolación", turnos: 2 },
  { id: "quemaduraFria", nombre: "Quemadura fría", turnos: 2 }
];

// [UNDAVAR-PARTE-4.2e5-ARTES] Nombre visible de una condición
function etiquetaCondicion(id) {
  return CONDICIONES_ARTE.find(c => c.id === id)?.nombre || id;
}

// [UNDAVAR-PARTE-4.2e5-ARTES] Modos de uso de un arte o arma
const MODOS_USO_ARTE = [
  { id: "dano", nombre: "Lanza daño" },
  { id: "descriptiva", nombre: "Descriptiva (solo narración)" },
  { id: "efecto", nombre: "Aplica efecto y cura" },
  // [UNDAVAR-PARTE-4.2h2-PAREJA] Duplicación: solo se lanza desde la mesa de combate
  { id: "duplicar", nombre: "Duplicar la existencia (mesa de combate)" },
  // [UNDAVAR-PARTE-4.2h3-PAREJA] Pasivo: se aplica solo mientras se cumpla el requisito
  { id: "pasivo", nombre: "Pasivo (mientras se cumpla el requisito)" }
];

// [UNDAVAR-PARTE-4.2h1-HABILIDADES] Nombre visible de un modo de uso
function etiquetaModoUso(id) {
  return MODOS_USO_ARTE.find(m => m.id === id)?.nombre || id;
}

// [UNDAVAR-PARTE-4.2h1-HABILIDADES] Normaliza condiciones con su duración
function normalizarCondicionesArte(raw) {
  return (Array.isArray(raw) ? raw : []).map(c => {
    const id = typeof c === "string" ? c : c?.id;
    if (!id) return null;
    const def = CONDICIONES_ARTE.find(x => x.id === id);
    const turnos = typeof c === "string"
      ? (def ? def.turnos : 1)
      : Math.max(1, Number(c.turnos) || (def ? def.turnos : 1));
    return { id, turnos };
  }).filter(Boolean);
}

// [UNDAVAR-PARTE-4.2h1-HABILIDADES] Lista de habilidades de un arte/arma.
// Si el ítem es antiguo, devuelve una sola habilidad deducida de sus campos.
// [UNDAVAR-PARTE-4.2h3-PAREJA] Normaliza el requisito de una habilidad a una lista de armas
function normalizarRequisito(r) {
  if (!r || typeof r !== "object") return {};
  if (Array.isArray(r.armas)) {
    const armas = r.armas.map(a => String(a || "").trim()).filter(Boolean);
    return armas.length ? { armas } : {};
  }
  // Compatibilidad con 4.2h2: el grupo «hermanas» exigía las dos espadas
  if (r.pareja === "hermanas") return { armas: ["Maydo", "Tsuida"] };
  return {};
}

// [UNDAVAR-PARTE-4.2h3-PAREJA] El actor cumple el requisito si tiene todas las armas
function requisitoArmasCumplido(actor, hab) {
  const armas = Array.isArray(hab?.requisito?.armas) ? hab.requisito.armas : [];
  if (!armas.length) return true;
  // [UNDAVAR-PARTE-10.4-ARMAS] Un arma común no cuenta como arma de gladiador
  const nombres = new Set((actor?.items || []).filter(i => i.type === "arma" && !esArmaComun(i)).map(i => i.name));
  return armas.every(nombre => nombres.has(nombre));
}

// [UNDAVAR-PARTE-4.2h4j-EDITOR-TABS] Variación configurada para un nivel concreto
function variacionNivelItem(item, nivel) {
  const lista = Array.isArray(item?.system?.variacionesNivel) ? item.system.variacionesNivel : [];
  return lista.find(v => Number(v.nivel) === Number(nivel)) || null;
}

// [UNDAVAR-PARTE-10.5-NIVELES] Rango, nivel actual y estado de ocultación de un ítem
function rangoNivelesItem(item) {
  const s = item?.system || {};
  const lista = Array.isArray(s.variacionesNivel) ? s.variacionesNivel : [];
  const nivelesLista = lista.map(v => Number(v.nivel)).filter(n => Number.isFinite(n) && n > 0);
  let min = Math.trunc(Number(s.nivelMin)) || 0;
  let max = Math.trunc(Number(s.nivelMax)) || 0;
  if (!min && nivelesLista.length) min = Math.min(...nivelesLista);
  if (!max && nivelesLista.length) max = Math.max(...nivelesLista);
  if (min && !max) max = min;
  if (max && !min) min = max;
  const tiene = max > 0;
  const actual = tiene ? Math.min(max, Math.max(min, Math.trunc(Number(s.nivelActual)) || min)) : 0;
  const venta = tiene ? Math.min(max, Math.max(min, Math.trunc(Number(s.nivelVenta)) || min)) : 0;
  return {
    tiene,
    min,
    max,
    actual,
    venta,
    aleatorio: !!s.nivelAleatorio,
    oculto: tiene && !!s.nivelOculto
  };
}

// [UNDAVAR-PARTE-10.5-NIVELES] Copia del ítem con la descripción, duración, efecto y bonos de su nivel
function itemConNivel(item, nivel = null) {
  const r = rangoNivelesItem(item);
  if (!r.tiene) return item;
  const v = variacionNivelItem(item, Number(nivel) || r.actual);
  if (!v) return item;
  const sys = { ...(item.system || {}) };
  if (v.descripcion) sys.descripcion = v.descripcion;
  if (v.duracion) sys.duracion = v.duracion;
  // [UNDAVAR-PARTE-10.5-NIVELES] Solo pisa el efecto base si el nivel define valores reales
  const efVar = v.efectoMecanico;
  const tieneEfVar = efVar?.definido && CAMPOS_EFECTO.some(k => Number(efVar.campos?.[k]?.valor) > 0);
  if (tieneEfVar) sys.efectoMecanico = normalizarEfecto(efVar);
  // [UNDAVAR-PARTE-10.5-NIVELES] Un nivel sin bonos hereda los bonos base
  if (Array.isArray(v.bonos) && v.bonos.length) sys.bonos = v.bonos;
  // [UNDAVAR-PARTE-10.5-NIVELES] La duración del nivel manda sobre los turnos de los bonos
  const turnosNivel = parseTurnos(v.duracion);
  if (turnosNivel > 0 && Array.isArray(sys.bonos)) {
    sys.bonos = sys.bonos.map(b => ({ ...b, turnos: turnosNivel }));
  }
  return { ...item, system: sys };
}

// [UNDAVAR-PARTE-10.5-NIVELES] Sortea un nivel dentro del rango configurado
function sortearNivelItem(item) {
  const r = rangoNivelesItem(item);
  if (!r.tiene) return 0;
  return r.min + Math.floor(Math.random() * (r.max - r.min + 1));
}

// [UNDAVAR-PARTE-10.5-NIVELES] Prepara una unidad al comprarla o fabricarla
function prepararNivelItem(item, { usarVenta = false } = {}) {
  const r = rangoNivelesItem(item);
  const copia = { ...item, system: { ...(item.system || {}) } };
  if (!r.tiene) return copia;
  copia.system.nivelActual = r.aleatorio ? sortearNivelItem(item) : (usarVenta ? r.venta : r.min);
  copia.system.nivelOculto = r.aleatorio;
  return copia;
}

// [UNDAVAR-PARTE-10.5-NIVELES] Prepara una pila de unidades con un nivel por unidad
function prepararUnidadesNivelItem(item, cantidad = 1, { usarVenta = false } = {}) {
  const r = rangoNivelesItem(item);
  const n = Math.max(1, Math.trunc(Number(cantidad)) || 1);
  const copia = { ...item, system: { ...(item.system || {}) } };
  copia.system.cantidad = n;
  if (!r.tiene) return copia;
  if (r.aleatorio) {
    const niveles = Array.from({ length: n }, () => sortearNivelItem(item));
    copia.system.nivelesUnidad = niveles;
    copia.system.nivelActual = niveles[0];
    copia.system.nivelOculto = true;
  } else {
    copia.system.nivelesUnidad = [];
    copia.system.nivelActual = usarVenta ? r.venta : r.min;
    copia.system.nivelOculto = false;
  }
  return copia;
}

// [UNDAVAR-PARTE-10.5-NIVELES] Niveles de cada unidad de una pila
function nivelesUnidadItem(item) {
  const r = rangoNivelesItem(item);
  const n = Math.max(0, Math.trunc(Number(item?.system?.cantidad)) || 0);
  let lista = Array.isArray(item?.system?.nivelesUnidad)
    ? item.system.nivelesUnidad.map(v => Math.trunc(Number(v))).filter(v => Number.isFinite(v) && v > 0)
    : [];
  if (lista.length > n) lista = lista.slice(0, n);
  if (lista.length < n) {
    const relleno = r.actual || r.min || 1;
    lista = lista.concat(Array(n - lista.length).fill(relleno));
  }
  return lista;
}

// [UNDAVAR-PARTE-10.5-NIVELES] Nivel de la próxima unidad que se va a usar
function nivelUsoItem(item) {
  const r = rangoNivelesItem(item);
  if (!r.tiene) return 0;
  return nivelesUnidadItem(item)[0] || r.actual || r.min;
}

// [UNDAVAR-PARTE-10.5-NIVELES] Etiqueta corta del nivel de una unidad
function etiquetaNivelItem(item) {
  const r = rangoNivelesItem(item);
  if (!r.tiene) return "";
  return r.oculto ? "Nv. ?" : `Nv. ${r.actual}`;
}

// [UNDAVAR-PARTE-10.5-NIVELES] Texto del nivel para la tienda o la información del ítem
function rangoNivelTexto(item) {
  const r = rangoNivelesItem(item);
  if (!r.tiene) return "";
  if (r.aleatorio) {
    return r.min === r.max ? `Nv. ${r.min} · al azar` : `Nv. ${r.min}-${r.max} · al azar`;
  }
  return `Nv. ${r.venta}`;
}

// [UNDAVAR-PARTE-10.5-NIVELES] Revela el nivel oculto al usar el ítem
function revelarNivelItem(item) {
  if (!item?.system?.nivelOculto) return false;
  item.system.nivelOculto = false;
  return true;
}

// [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] Variación propia de una habilidad
function variacionNivelHabilidad(hab, nivel) {
  const lista = Array.isArray(hab?.variacionesNivel) ? hab.variacionesNivel : [];
  return lista.find(v => Number(v.nivel) === Number(nivel)) || null;
}

function habilidadesItem(item) {
  // [UNDAVAR-PARTE-10.4-ARMAS] Un arma común no tiene habilidades de arte
  if (item?.type === "arma" && esArmaComun(item)) return [];
  const s = item?.system || {};
  const raw = Array.isArray(s.habilidades) ? s.habilidades : [];

  if (raw.length) {
    return raw.map((h, i) => {
      const ef = h?.efectoMecanico ? normalizarEfecto(h.efectoMecanico) : null;
      const tieneEf = !!ef && CAMPOS_EFECTO.some(k => Number(ef.campos?.[k]?.valor) > 0);
      return {
        id: h?.id || `hab-${i}`,
        nombre: h?.nombre || `Habilidad ${i + 1}`,
        modoUso: h?.modoUso || "dano",
        descripcion: h?.descripcion || "",
        conjuro: h?.conjuro || "",
        efectoMecanico: tieneEf ? ef : null,
        condiciones: normalizarCondicionesArte(h?.condiciones),
        bonos: Array.isArray(h?.bonos) ? h.bonos : [],
        // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Daño y efecto en el mismo lanzamiento
        aplicaEfecto: !!h?.aplicaEfecto,
        // [UNDAVAR-PARTE-4.2h3-PAREJA] Requisito normalizado (armas por nombre)
        requisito: normalizarRequisito(h?.requisito),
        // [UNDAVAR-PARTE-4.2h4k-NIVEL-HABILIDAD] Cambios propios de esta habilidad por nivel
        variacionesNivel: Array.isArray(h?.variacionesNivel) ? h.variacionesNivel : []
      };
    });
  }

  // Compatibilidad: artes y armas antiguas sin lista de habilidades
  if (item?.type !== "arte" && item?.type !== "arma") return [];
  return [{
    id: "legacy",
    nombre: item?.name || "Habilidad",
    modoUso: s.modoUso || "dano",
    descripcion: s.descripcion || s.efecto || "",
    conjuro: s.conjuro || "",
    efectoMecanico: efectoMecanicoItem(item),
    condiciones: normalizarCondicionesArte(s.condiciones),
    bonos: Array.isArray(s.bonos) ? s.bonos : [],
    // [UNDAVAR-PARTE-4.2h4-DANO-EFECTO] Las fichas antiguas conservan su comportamiento
    aplicaEfecto: false,
    requisito: {},
    // [UNDAVAR-PARTE-9.2-NIVELES] Las artes del bestiario sí traen variaciones por nivel
    variacionesNivel: Array.isArray(s.variacionesNivel) ? s.variacionesNivel : []
  }];
}

// [UNDAVAR-PARTE-10.5-NIVELES] Campos de nivel vacíos para los ítems con plantilla de objeto
function nivelesItemVacios() {
  return { nivelMin: 0, nivelMax: 0, nivelAleatorio: false, nivelOculto: false, nivelActual: 0, nivelVenta: 0, variacionesNivel: [] };
}

function itemPorDefecto(tipo, nombre) {
  const base = { id: nuevoId(), type: tipo, name: nombre || ("Nuevo "+tipo), img:"", system:{} };
  switch(tipo) {
    case "arte":
      // [UNDAVAR-PARTE-4.2e5-ARTES] Modo de uso, efecto mecánico y condiciones
      // [UNDAVAR-PARTE-4.2h1-HABILIDADES] Lista de habilidades y enfriamiento del arte/arma
      base.system = { nivel:0, descripcion:"", conjuro:"", danoExtra:0, modoUso:"dano", efectoMecanico:null, condiciones:[], habilidades:[], enfriamientoTurnos:0 };
      break;
    case "arma":
      // [UNDAVAR-PARTE-10.4-ARMAS] Arma común: misma plantilla que un objeto
      // [UNDAVAR-PARTE-10.5-NIVELES] Arma común con rango de niveles opcional
      base.system = { cantidad:1, consumible:false, efecto:"", descripcion:"", duracion:"", nivel:"", enfriamiento:"", enfriamientoTurnos:0, precio_oro:0, precio_rubi:0, precio_diamante:0, dato:"", armaComun:true, ...nivelesItemVacios() };
      break;
    case "arma_gladiador":
      // [UNDAVAR-PARTE-10.4-ARMAS] Arma de gladiador: nivel, habilidades y PA
      base.type = "arma";
      base.system = { armaComun:false, nivel:0, descripcion:"", conjuro:"", danoExtra:0, modoUso:"dano", efectoMecanico:null, condiciones:[], habilidades:[], enfriamientoTurnos:0, precio_oro:0, precio_rubi:0, precio_diamante:0 };
      break;
    case "oficio":
      base.system = { oficioId:"", descripcion:"", facultades:"", puntos:0, maximo:7, logro:false, bonos:{} };
      break;
    case "objeto":
    case "elixir":
    case "alimento":
      // [UNDAVAR-PARTE-4.2e3-TURNO] Consumible por defecto y enfriamiento numérico
      // [UNDAVAR-PARTE-10.5-NIVELES] Objetos, elixires y alimentos aceptan niveles
      base.system = { cantidad:1, consumible:true, efecto:"", duracion:"", nivel:"", enfriamiento:"", enfriamientoTurnos:0, precio_oro:0, precio_rubi:0, precio_diamante:0, dato:"", ...nivelesItemVacios() };
      break;
    case "equipo":
      base.system = { cantidad:1, slot:"superior", reduccion_dano:0, efecto:"", precio_oro:0, precio_rubi:0, precio_diamante:0 };
      break;
  }
  return base;
}
