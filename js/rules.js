// ============================================================
//  UNDAVAR — Motor de Reglas (fiel al manual y al sistema Foundry)
// ============================================================

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
const CATALOGO_ITEMS = [
  // --- ELIXIRES ---
  { name: "Elixir de potenciación", type: "elixir", system: { descripcion: "Potencia todas las habilidades del portador (+2 lvl1, +3 lvl2). Duración al azar al usarse.", duracion: "1-2 turno", nivel: "1-2", precio_rubi: 5 } },
  { name: "Elixir de aumento físico", type: "elixir", system: { descripcion: "Aumenta las capacidades físicas del usuario.", duracion: "3 turno", nivel: "/", precio_rubi: 10 } },
  { name: "Elixir de la vida", type: "elixir", system: { descripcion: "Regeneración rápida: cierra heridas en minutos y revitaliza 30% (pt. Salud * 0.3, pt. Herida * 0.3).", duracion: "2 turnos", nivel: "/", precio_diamante: 15 } },
  { name: "Elixir de armamento", type: "elixir", system: { descripcion: "Se riega para forjar un arma temporal. Vuelve a su estado de elixir tras consumirse.+4 de daño permanente mientras esté en uso.", duracion: "3 usos", nivel: "/", precio_diamante: 15 } },
  { name: "Elixir de rejuvenecimiento", type: "elixir", system: { descripcion: "Restaura la vitalidad. Elimina 6 marcas de cansancio.", duracion: "Único", nivel: "/", precio_diamante: 4 } },

  // --- ARMAS Y EQUIPO ---
  { name: "Daga común", type: "arma", system: { descripcion: "Arma básica. No necesita magia ni se puede combinar con ella.", precio_oro: 25 } },

  // --- OBJETOS Y ARMADURAS ---
  { name: "Collar de Astra", type: "objeto", system: { descripcion: "Aumenta tu poder mágico (+1 de daño mágico).", duracion: "3 turno", enfriamiento: "2 turnos", precio_oro: 50 } },
  { name: "Pulsera Arc", type: "objeto", system: { descripcion: "Se transforma en cuchillas al cerrar los puños. Suma un dado de daño.", precio_oro: 45 } },
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

  // --- ELEMENTOS DE CONSTRUCCIÓN (REFUGIOS) ---
  { name: "Elementos de construcción (Tipo 1)", type: "objeto", system: { descripcion: "Roble de weir, Roble de ángel, Cobre Riowu.", precio_rubi: 2 } },
  { name: "Elementos de construcción (Tipo 2)", type: "objeto", system: { descripcion: "Cobre Gatsu, Acebol del rocío.", precio_rubi: 4.5 } },
  { name: "Elementos de construcción (Tipo 3)", type: "objeto", system: { descripcion: "Hierro qi ang xu, Hierro fim.", precio_rubi: 60 } },
  { name: "Elementos de construcción (Tipo 4)", type: "objeto", system: { descripcion: "Eucaliptos de Fal io.", precio_diamante: 1 } },
  { name: "Elementos de construcción (Tipo 5)", type: "objeto", system: { descripcion: "Buloke Lino, Metal jo.", precio_diamante: 30 } },

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
  { name: "Plumas de Planzúl", type: "objeto", system: { descripcion: "Plumas doradas mágicas. Otorga resistencia al viento y buff de velocidad.", precio_oro: 15 } },
  { name: "Pétalos de Mairis Púrpura", type: "objeto", system: { descripcion: "Pétalos del árbol Mairis. Posee efecto relajante.", precio_oro: 10 } },
  { name: "Raíz de Mairis Púrpura", type: "objeto", system: { descripcion: "Raíz medicinal de Mairis. Concentra efectos relajantes y curativos.", precio_oro: 20 } },
  { name: "Pétalos de Mairis Amarilla", type: "objeto", system: { descripcion: "Pétalos dulces. Efecto relajante superior para platillos.", precio_oro: 15 } },
  { name: "Raíz de Mairis Amarilla", type: "objeto", system: { descripcion: "Raíz aromática medicinal de fuerte efecto relajante.", precio_oro: 25 } },
  { name: "Semillas de Mairis Púrpura", type: "objeto", system: { descripcion: "Ingrediente menor de alquimia sin madurar.", precio_oro: 8 } },
  { name: "Semillas de Laila Radiante", type: "objeto", system: { descripcion: "Ingrediente menor para infusiones o brebajes.", precio_oro: 8 } },
  { name: "Semillas de Cilantro", type: "objeto", system: { descripcion: "Resalta sabores, da aroma y sirve como catalizador alquímico.", precio_oro: 6 } },
  { name: "Tallo de Laila Radiante", type: "objeto", system: { descripcion: "Mantiene propiedades mágicas temporales tras cortarse.", precio_oro: 12 } },
  { name: "Fruto de Yoyi Cálida", type: "objeto", system: { descripcion: "Merienda dulce con efecto concentrado.", precio_oro: 10 } },
  { name: "Hojas de Nauzu", type: "objeto", system: { descripcion: "Aroma suave. Utilizado para equilibrar mezclas alquímicas.", precio_oro: 7 } },
  { name: "Raíz de Nauzu", type: "objeto", system: { descripcion: "Concentrado natural de la flor Nauzu.", precio_oro: 18 } },
  { name: "Frutos del Rocío Blanco", type: "objeto", system: { descripcion: "Frutos grises de fuerte efecto relajante, usados para fabricar alcohol.", precio_oro: 20 } },
  { name: "Tallo del Yang Azul", type: "objeto", system: { descripcion: "Propiedades menores derivadas del fruto Yang Azul.", precio_oro: 14 } },
  { name: "Hoja del Yang Azul", type: "objeto", system: { descripcion: "Conserva propiedades del Yang Azul si se mantiene fresca.", precio_oro: 12 } },
  { name: "Semillas del Yang Azul", type: "objeto", system: { descripcion: "Ingrediente alquímico de menor calidad.", precio_oro: 9 } },
  { name: "Hojas de Laila Radiante", type: "objeto", system: { descripcion: "Hojas aromáticas mágicas.", precio_oro: 10 } },

  // --- METALES Y MATERIALES ---
  { name: "Metal de Kio", type: "objeto", system: { descripcion: "Aleación pesada de jo y holio, resistente y fácil de moldear.", precio_rubi: 5 } },
  { name: "Metal Jo", type: "objeto", system: { descripcion: "Metal ligero de resistencia media, ideal para armas pequeñas.", precio_oro: 35 } },
  { name: "Metal Holio", type: "objeto", system: { descripcion: "Metal pesado y muy resistente, requiere altas temperaturas.", precio_rubi: 8 } },
  { name: "Metal Weir", type: "objeto", system: { descripcion: "Metal legendario casi irrompible, liviano y fácil de moldear.", precio_diamante: 25 } },
  { name: "Metal Dial", type: "objeto", system: { descripcion: "El metal mágico. Extremadamente resistente, liviano y fácil de moldear.", precio_diamante: 10 } },
  { name: "Cobre Maido", type: "objeto", system: { descripcion: "Cobre puro. Excelente conductor pero de baja resistencia.", precio_oro: 15 } },
  { name: "Cobre Riowu", type: "objeto", system: { descripcion: "Cobre impuro. Mayor resistencia pero baja conductividad.", precio_oro: 10 } },
  { name: "Cobre Gatsu", type: "objeto", system: { descripcion: "Cobre balanceado en conductividad y resistencia.", precio_oro: 18 } },
  { name: "Cobre Fal io", type: "objeto", system: { descripcion: "Variante de cobre con mayor conductividad que el Gatsu.", precio_oro: 22 } },
  { name: "Hierro Rawer", type: "objeto", system: { descripcion: "Mineral ultra resistente y pesado.", precio_rubi: 12 } },
  { name: "Hierro Qi Ang Xu", type: "objeto", system: { descripcion: "Aleación de fim y rawer. Metal poderoso que compite con el Dial.", precio_diamante: 8 } },
  { name: "Hierro Fim", type: "objeto", system: { descripcion: "Metal liviano y maleable.", precio_oro: 45 } },
  { name: "Acero Tiang Lon", type: "objeto", system: { descripcion: "El metal perfecto: fusión de Dial y Qi Ang Xu. Liviano e indestructible.", precio_diamante: 40 } },

  // --- MADERAS PARA ENCANTOS ---
  { name: "Roble de Weir", type: "objeto", system: { descripcion: "Madera común de alta resistencia utilizada para encantos.", precio_oro: 15 } },
  { name: "Roble del Ángel", type: "objeto", system: { descripcion: "Madera especial de bosques específicos.", precio_oro: 30 } },
  { name: "Abeto de Fim", type: "objeto", system: { descripcion: "Madera decorativa y excelente catalizador mágico.", precio_oro: 25 } },
  { name: "Acebol del Rocío", type: "objeto", system: { descripcion: "Madera con buena resistencia y conductividad mágica.", precio_oro: 40 } },
  { name: "Cerezo de Miel", type: "objeto", system: { descripcion: "Madera resonante ideal para instrumentos musicales.", precio_oro: 50 } },
  { name: "Ciprés Solitario", type: "objeto", system: { descripcion: "Madera inmune a plagas u hongos. Rara y costosa.", precio_rubi: 15 } },
  { name: "Secoya Gigante", type: "objeto", system: { descripcion: "Madera masiva de árboles milenarios.", precio_rubi: 10 } },
  { name: "Glicinias Rosas", type: "objeto", system: { descripcion: "Madera fina usada tradicionalmente para utensilios pulidos.", precio_oro: 35 } },
  { name: "Eucaliptos de Fal io", type: "objeto", system: { descripcion: "Madera monopolizada para la creación de objetos mágicos.", precio_rubi: 25 } },
  { name: "Buloke Lino", type: "objeto", system: { descripcion: "La madera más dura y resistente de todas.", precio_diamante: 2 } }
];

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
    ...CATALOGO_ITEMS.map(item => ({
      name: item.name,
      type: item.type,
      system: {
        precio_oro: 0,
        cantidad: 999
      }
    })),
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
  id: "restablecedor",
  tipo: "tienda",
  nombre: "Restablecedor",
  caja: { oro: 0, rubi: 0, diamante: 0 },
  items: CATALOGO_ITEMS.map(item => ({
    name: item.name,
    type: item.type,
    system: {
      precio_oro: 0,
      cantidad: 999
    }
  }))
},
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
      { name: "Daga común", type: "arma", system: { precio_oro: 25, cantidad: 25 } },
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
      { name: "Daga común", type: "arma", system: { precio_oro: 25, cantidad: 15 } },
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
      { name: "Daga común", type: "arma", system: { precio_oro: 25, cantidad: 20 } },
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
      { name: "Ventisca tormentosa", type: "arte", system: { nivel: 1, descripcion: "Vuela 2m y agita alas derribando a todos los enemigos." } },
      { name: "Chillido Bandada", type: "arte", system: { nivel: 1, descripcion: "Provoca confusión o sordera temporal/permanente." } },
      { name: "Vuelo", type: "arte", system: { nivel: 1, descripcion: "Se eleva 3 metros sobre el suelo por 4 turnos." } }
    ]
  },
  "Lethur": {
    descripcion: "Raza que conquistó Undavar gracias a su magistral control de la magia elemental. Su apariencia física está intrínsecamente ligada a su elemento primario.",
    atributos: { fuerza: 1, velocidad: 4, agilidad: 6, inteligencia: 5 },
    artes: [
      { name: "Explosión de magma", type: "arte", system: { nivel: 1, descripcion: "Derrite el terreno subiendo el calor del área." } },
      { name: "Impacto oceánico", type: "arte", system: { nivel: 1, descripcion: "Impacta una gran masa de agua sobre objetivo/estructura." } },
      { name: "Destello solar", type: "arte", system: { nivel: 1, descripcion: "Bola de fuego que ilumina 5m de radio y causa daño en área." } }
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
      { name: "Vuelo", type: "arte", system: { nivel: 1, descripcion: "Vuelo de 3m de altura por 4 turnos." } }
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
  "Cancerbero Invisible": {
    descripcion: "Bestia imponente que se vuelve invisible al descansar. Posee una fuerza descomunal y la capacidad de tomar la forma de otros seres.",
    atributos: { fuerza: 8, velocidad: 8, agilidad: 4, inteligencia: 8 },
    artes: [
      { name: "Cambia forma", type: "arte", system: { nivel: 1, descripcion: "Adopta cualquier forma viva." } },
      { name: "Invisibilidad", type: "arte", system: { nivel: 1, descripcion: "Se vuelve invisible hasta recibir daño o romper condición." } },
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
      { name: "Vuelo", type: "arte", system: { nivel: 1, descripcion: "Vuelo a 3m de altura por 4 turnos." } }
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
  "Chwelt (Guerra)": {
    descripcion: "Demonios robustos de 3m con piel oscura, orejas puntiagudas y fuerza descomunal.",
    atributos: { fuerza: 8, velocidad: 7, agilidad: 6, inteligencia: 6 },
    artes: [
      { name: "Cuerpo Inamovible", type: "arte", system: { nivel: 1, descripcion: "Ignora el primer efecto negativo que intente reducir Fuerza, Velocidad o impedir acciones físicas." } },
      { name: "Golpe de Dominio", type: "arte", system: { nivel: 1, descripcion: "Si el ataque supera la dificultad por 2 o más aciertos, el objetivo queda derribado o incapacitado un turno." } }
    ]
  },
  "Chwelt (Sombra)": {
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

function calcularRango(pv) {
  pv = Number(pv) || 0;
  let actual = RANGOS_UNDAVAR[0];
  for (const r of RANGOS_UNDAVAR) if (pv >= r.minPV) actual = r;
  return actual.nombre;
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
function bonusCombate(n) { return ({0:0,1:0,2:1,3:2,4:3})[Number(n)] ?? 0; }

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

  let heridasBase = Math.min(8, Number(sys.estado?.ptHerida?.value)||0);
  let heridasTotales = Math.min(8, heridasBase + bonusHeridas);

  let bonoSalud = 0;
  for (const it of (items||[])) if (it.type === "oficio") bonoSalud += Number(it.system?.bonos?.salud)||0;

  const penalizacionSalud = Math.floor(heridasTotales/4);
  const limiteReal = (8+bonoSalud) - penalizacionSalud;
  const pv = Number(sys.pv?.value)||0;

  return {
    rango: calcularRango(pv),
    paMaximo: calcularPAMax(pv),
    costoSuerte: costoSuerte(pv),
    costoPCAccion: costoPCAccion(pv),
    bonusHeridas, heridasTotales, saludPorHeridas: penalizacionSalud,
    saludMaxima: 8+bonoSalud, saludLimiteActual: Math.max(0,limiteReal),
    heridasBase
  };
}

function actorPersonajePorDefecto(nombre="Nuevo Undavarita") {
  return {
    id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
    tipo: "npc",
    nombre,
    img: "",
    system: {
      datos: { raza:"", descripcion:"" },
      estado: { ptHerida:{value:0}, ptSalud:{value:8,max:8} },
      pa: { value:6 },
      atributos: { fuerza:0, velocidad:0, agilidad:0, inteligencia:0 }
    },
    items: [],
    updatedAt: Date.now()
  };
}

function tiendaPorDefecto(nombre="Nueva Tienda") {
  return {
    id: crypto.randomUUID(),
    tipo: "tienda",
    nombre,
    items: [],
    updatedAt: Date.now()
  };
}

function itemPorDefecto(tipo, nombre) {
  const base = { id: crypto.randomUUID(), type: tipo, name: nombre || ("Nuevo "+tipo), img:"", system:{} };
  switch(tipo) {
    case "arte":
    case "arma":
      base.system = { nivel:0, descripcion:"", conjuro:"", danoExtra:0 };
      break;
    case "oficio":
      base.system = { oficioId:"", descripcion:"", facultades:"", puntos:0, maximo:7, logro:false, bonos:{} };
      break;
    case "objeto":
    case "elixir":
      base.system = { cantidad:1, efecto:"", duracion:"", nivel:"", enfriamiento:"", precio_oro:0, precio_rubi:0, precio_diamante:0, dato:"" };
      break;
    case "equipo":
      base.system = { cantidad:1, slot:"superior", reduccion_dano:0, efecto:"", precio_oro:0, precio_rubi:0, precio_diamante:0 };
      break;
  }
  return base;
}
