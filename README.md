# UNDAVAR-CP
Una PWA para manejar las Fichas de personaje, tiendas y dados de Undavar. 
[UNDAVAR-CP](https://rodalvis-sys.github.io/UNDAVAR-CP/)

# 🏛️ UNDAVAR — Cuaderno de Campaña

Un cuaderno de campaña interactivo, liviano y completamente ejecutable en el navegador sin necesidad de conexión a internet (*PWA / Offline-First*). Diseñado específicamente para llevar el control de fichas, inventarios complejos, tiendas y resoluciones de dados en el sistema de rol **Undavar**.

---

## 🌟 Características Principales

### 📋 Fichas de Personaje (PJs)
* **Gestión de Recursos y Estado:** Control dinámico de Puntos de Vida (PV), Heridas, Salud, Puntos de Acción (PA) y Extensión de Estado (*Hambre, Sed, Cansancio, Fatiga*).
* **Atributos y Puntos de Conveniencia:** Subida progresiva de Fuerza, Velocidad, Agilidad e Inteligencia, con gestión de bolsas de PdC (PC, PE, PR, PD, PP, Suerte y Sin Asignar).
* **Artes, Armas y Oficios:** Pestañas dedicadas con cálculo automático de daños por nivel y catálogo integrado de oficios de Undavar.
* **Inventario Dinámico & Contenedores Custom:**
  * Soporte para mochilas, cofres, sacos y anillos espaciales.
  * Lógica de transferencia directa de objetos y contenedores entre fichas de personaje.
  * Agrupación automática de ítems por slots de espacio.

### 🐾 Fichas de PNJ / Bestiario
* Selección de razas predefinidas desde el bestiario oficial o creación personalizada.
* Modo **🐾 Sin PA (Bestia)** para criaturas que operan sin gasto de acciones.
* Ajuste dinámico de Rangos y cálculo automático de límites.

### ⚔️ Tiradas Enfrentadas Rápida
* **Modo Todos vs Todos:** Resolución multi-contendiente con ordenamiento dinámico por aciertos.
* **Modo Todos vs SR (Sin Rival):** Verificación de éxitos/fallos contra dificultades fijas (*Muy fácil: 1, Fácil: 2, Media: 3, Difícil: 4, Personalizada*).
* **Consumo Automático:** Descuento directo de PA y PdC al lanzar dados desde el panel de enfrentamiento.

### 🏪 Tiendas Interactivas
* Compra directa de objetos con conversión y transferencia automática de Erianas (*Oro, Rubí, Diamante*) a la caja de la tienda.
* Sistema de cambio dinámico en caja y posibilidad de inyectar fondos.
* Módulo para añadir ítems desde el catálogo global o crearlos manualmente.

### 🔮 Oráculos y Dados Libres
* **Oráculo Editable:** Tablas personalizadas de d6/d100 con historial de consultas.
* **Lanzador de Dados Libres:** Panel independiente para tiradas del sistema (*Estándar 4d6, Ataque, Rebote, Despertar, Erianas*) y tiradas personalizadas con historial persistente en `localStorage`.

### 🔲 Vista Dividida (Modo Embed)
* Permite trabajar con dos fichas en pantalla dividida usando `iframes` optimizados para la gestión ágil durante las sesiones de juego.

---

## 🛠️ Tecnologías Utilizadas

* **HTML5 / CSS3:** Interfaz oscura (*Dark Fantasy*) responsiva y optimizada para pantallas de escritorio y móviles.
* **JavaScript Vanilla (ES6+):** Arquitectura SPA (*Single Page Application*) asíncrona, limpia y sin librerías externas.
* **IndexedDB:** Base de datos nativa para persistencia de fichas, tiendas y oráculos en el dispositivo.
* **Service Worker (`sw.js`):** Soporte de caché local para funcionamiento 100% Offline.

---

## 🗺️ Mapa de Campaña y Galería

* **Mapa interactivo** con zoom, arrastre y pantalla completa, con pines libres y marcadores de las Eslavas.
* **Galería de imágenes** propia, integrada en la aplicación y guardada en el dispositivo.
* **Una imagen por pin**: se elige de la galería o se carga al momento; se muestra al pasar el ratón por el pin y en su detalle.
* **Visor con zoom**: botones, rueda, doble clic, arrastre y teclado.
* **Añadir pines** con clic derecho en el mapa o con doble clic.

---

## 🚀 Instalación y Ejecución

No requiere entorno de Node.js, compilación ni instalación de paquetes (`npm install`).

### En el navegador

Abre la versión publicada: **https://rodalvis-sys.github.io/UNDAVAR-CP/**

O sírvela en local:

```bash
git clone https://github.com/rodalvis-sys/UNDAVAR-CP.git
cd UNDAVAR-CP
python3 -m http.server 8765
```

Luego visita `http://localhost:8765/`.

### Aplicación de escritorio (Linux)

Descarga el paquete `.deb` desde la sección
[**Releases**](https://github.com/rodalvis-sys/UNDAVAR-CP/releases) e instálalo:

```bash
sudo dpkg -i UNDAVAR_0.5.3_amd64.deb
```

---

## 📌 Versión

**0.5.3** — la vista dividida comparte la base de datos con la ventana
principal (corregido en escritorio).

**0.5.2** — galería de imágenes, imagen por pin con vista previa, visor con
zoom y menú contextual del mapa.
