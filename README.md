# 🧩 LEGO Minifigures Management API & Dashboard (`lego-mini-api`)

Una solución web completa para la gestión y catalogación de colecciones de minifiguras LEGO. Combina un servidor **API REST** desarrollado en Node.js/Express con una **interfaz gráfica interactiva (Dashboard)** servida en la raíz.

Desarrollado siguiendo la metodología **Spec-Driven Development (SDD)** asistida por IA.

---

## 🚀 Características Principales

* **Dashboard Interactivo Web (UI):**
  * **Visualización Dinámica:** Tabla interactiva con información de ID, Nombre, Descripción, Temática, Año y Estado.
  * **Filtros Avanzados:** Búsqueda en tiempo real por `tema`, `año` y `estado de colección`.
  * **Modales CRUD:** Interfaz mediante diálogos reutilizables para el alta (`POST`) y edición (`PUT`) de registros.
  * **Acciones por Fila:** Botones de edición rápida y borrado seguro con confirmación previa (`DELETE`).
  * **UX RICA:** Badges estilizados por estado de colección (`coleccion`, `deseada`, `vendida`) y sistema de notificaciones emergentes (*Toast*).
* **API REST Backend:**
  * Endpoints HTTP estructurados con respuestas JSON.
  * Manejo estandarizado de errores HTTP y códigos de negocio (`ID_DUPLICADO`, `ID_INVALIDO`, `MINIFIGURA_NO_ENCONTRADA`, `MINIFIGURA_INVALIDA`).
* **Persistencia Local:** Almacenamiento seguro mediante archivo JSON local (`minifiguras.json`).

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
│   ├── app.js                # Lógica del cliente, filtros, modales y toasts
│   ├── index.html            # Estructura del dashboard
│   └── styles.css            # Estilos visuales, badges y animaciones
├── reviews/                  # Informes de revisión de cada iteración del proyecto
│   ├── lego-1-review.md
│   ├── lego-2-review.md
│   ├── lego-3-review.md
│   ├── lego-4-review.md
│   └── lego-5-review.md
├── src/                      # Código fuente del backend
│   ├── minifiguras-repository.js
│   └── server.js
├── test/                     # Pruebas automatizadas
│   ├── minifiguras.test.js
│   └── web.test.js
├── AGENTS.md                 # Guía del flujo del proyecto
├── EFICIENCIA.md             # Informe de productividad y metodología SDD + IA
├── package.json              # Configuración del proyecto y scripts
├── README.md                 # Documentación general
└── .gitignore                # Archivos ignorados por Git
```