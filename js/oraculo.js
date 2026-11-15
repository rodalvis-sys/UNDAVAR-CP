// ============================================================
//  UNDAVAR — Oráculo del Sabio Regidor (modo solitario)
// ============================================================

function tablaOraculoPorDefecto() {
  return [
    { min:1, max:2, texto:"NO" },
    { min:3, max:4, texto:"NO, PERO…" },
    { min:5, max:6, texto:"SÍ, Y ADEMÁS…" }
  ];
}

function oraculoPorDefecto(nombre="Oráculo de Incertidumbre") {
  return {
    id: nuevoId(),
    tipo: "oraculo",
    nombre,
    dado: 6,
    tabla: tablaOraculoPorDefecto(),
    historial: [],
    updatedAt: Date.now()
  };
}

function consultarOraculo(oraculo) {
  const cara = 1 + Math.floor(Math.random() * (oraculo.dado || 6));
  const fila = (oraculo.tabla || []).find(f => cara >= f.min && cara <= f.max);
  const resultado = fila ? fila.texto : "(sin definir)";
  return { cara, resultado, ts: Date.now() };
}
