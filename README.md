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

mi-proyecto/
├── openspec/            # Especificaciones SDD (specs activas y archivo histórico)
├── public/              # Aplicación Web Frontend Estática
│   ├── app.js           # Lógica cliente, manipulación DOM, modales y toasts
│   ├── index.html       # Estructura del dashboard y componentes modal
│   └── styles.css       # Estilos visuales, badges y animaciones
├── reviews/             # Informes de auditoría de código de cada tarea (LEGO-1 a 5)
├── src/                 # Código fuente Backend
│   ├── minifiguras-repository.js # Capa de persistencia JSON
│   └── server.js        # Servidor Express y definición de endpoints
├── test/                # Suites de pruebas automatizadas
│   ├── minifiguras.test.js # Unit tests de API Backend
│   └── web.test.js      # Pruebas de integración del frontend estático
├── EFICIENCIA.md        # Informe de productividad y metodología SDD + IA
├── package.json         # Configuración del proyecto y scripts
└── README.md            # Documentación general