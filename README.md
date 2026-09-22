# 🧩 LEGO Minifigures Management API & Dashboard (`lego-mini-api`)

Una solución web completa para la gestión, catalogación y valoración de colecciones de minifiguras LEGO. Combina un servidor **API REST** desarrollado en Node.js/Express con una **interfaz gráfica interactiva (Dashboard)** servida en la raíz.

Desarrollado siguiendo la metodología **Spec-Driven Development (SDD)** asistida por IA.

---

## 🚀 Características Principales

* **Dashboard Interactivo Web (UI):**
  * **Visualización Dinámica:** Tabla interactiva con información de ID, Nombre, Descripción, Temática, Año, Estado, Precio y Diferencia entre precio y precio de compra.
  * **Filtros Avanzados:** Búsqueda en tiempo real por `tema`, `año` y `estado de colección`.
  * **Ordenación:** Las columnas `Año` y `Precio` se pueden ordenar ascendente y descendentemente.
  * **Modales CRUD:** Interfaz mediante diálogos reutilizables para el alta (`POST`) y edición (`PUT`) de registros.
  * **Acciones por Fila:** Botones de edición rápida y borrado seguro con confirmación previa (`DELETE`).
  * **Valoración en Euros:** Formulario con `precioCompra`, `fechaCompra` y `precio` de Brickset, incluyendo consulta individual.
  * **Resumen de colección:** Valor total, contadores de figuras en `COLECCIÓN` y `BUSCADA`, y rankings dinámicos.
  * **Top 5:** Ranking de figuras en colección por precio y ranking de las más antiguas.
  * **Sincronización resiliente:** Actualización masiva desde Brickset con estados de carga, resultados parciales y errores mediante *Toasts*.
  * **Estados controlados:** Solo se permiten `COLECCIÓN` y `BUSCADA`; las nuevas figuras usan `COLECCIÓN` por defecto.
* **API REST Backend:**
  * Endpoints HTTP estructurados con respuestas JSON.
  * Consulta individual de precios mediante scraping de la URL pública de Brickset, sin credenciales ni API Key.
  * Actualización masiva aislada por minifigura, con timeout, reintentos y concurrencia limitada.
  * Manejo estandarizado de errores HTTP y códigos de negocio (`ID_DUPLICADO`, `ID_INVALIDO`, `MINIFIGURA_NO_ENCONTRADA`, `MINIFIGURA_INVALIDA`).
* **Persistencia Local:** Almacenamiento seguro mediante archivo JSON local (`minifiguras.json`).
  * Escrituras atómicas para evitar archivos parciales ante fallos de persistencia.

### Valoración y moneda

Todos los importes se expresan exclusivamente en Euros (€). Cada minifigura puede incluir en su raíz:

* `precioCompra`: precio pagado, opcional y no negativo.
* `fechaCompra`: fecha opcional con formato `YYYY-MM-DD`.
* `precio`: valor actual obtenido de Brickset, opcional y no negativo.

El valor total solo incluye figuras `COLECCIÓN`. Para cada una se prioriza `precio` y se usa `precioCompra` como alternativa cuando no hay precio de Brickset. Las figuras `BUSCADA` se contabilizan, pero no contribuyen al total ni a los rankings.

La consulta usa scraping/fetch directo de `https://brickset.com/minifigs/<ID>` y extrae `Current Value - New`. Si una consulta falla, se conserva el precio anterior.

---

## 🛠️ Tecnologías Utilizadas

* **Backend:** Node.js, Express.
* **Frontend:** HTML5 (semántico y `<dialog>`), CSS3 (Flexbox/Grid y variables CSS), JavaScript ES6+ (`fetch`, manipulación reactiva del DOM).
* **Testing:** Módulo nativo `node:test` y `node:assert`.
* **Metodología:** Spec-Driven Development (OpenSpec / SDD).

---

## 📦 Estructura del Proyecto

```text
mi-proyecto/
├── .github/                  # Configuración y prompts del flujo OpenSpec/IA
│   ├── prompts/
│   └── skills/
├── data/                     # Datos persistentes del proyecto
│   └── minifiguras.json      # Base local de minifiguras
├── openspec/                 # Especificaciones OpenSpec y cambios activos/archivados
│   ├── changes/
│   ├── config.yaml
│   └── specs/
├── public/                   # Aplicación web frontend estática
│   ├── app.js                # Filtros, CRUD, valoración, rankings y toasts
│   ├── index.html            # Estructura del dashboard y formularios
│   └── styles.css            # Estilos visuales, estados y diferencias
├── reviews/                  # Informes de revisión de cada iteración del proyecto
│   ├── lego-1-review.md
│   ├── lego-2-review.md
│   ├── lego-3-review.md
│   ├── lego-4-review.md
│   └── lego-5-review.md
├── src/                      # Código fuente del backend
│   ├── brickset-scraper.js    # Scraping público y parseo de precios Brickset
│   ├── minifiguras-repository.js
│   └── server.js
├── test/                     # Pruebas automatizadas
│   ├── brickset-scraper.test.js
│   ├── minifiguras.test.js
│   └── web.test.js
├── AGENTS.md                 # Guía del flujo del proyecto
├── EFICIENCIA.md             # Informe de productividad y metodología SDD + IA
├── package.json              # Configuración del proyecto y scripts
├── README.md                 # Documentación general
└── .gitignore                # Archivos ignorados por Git
```

## ▶️ Ejecución

```bash
npm install
npm test
npm start
```

La aplicación queda disponible en `http://localhost:3000`.

La concurrencia de la sincronización masiva puede ajustarse con `BRICKSET_CONCURRENCY`; por defecto es `4`.