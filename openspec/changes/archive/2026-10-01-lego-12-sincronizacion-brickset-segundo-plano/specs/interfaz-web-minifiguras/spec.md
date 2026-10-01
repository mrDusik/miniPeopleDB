# Spec Delta

## MODIFIED Requirements

### Requirement: Gestionar datos de compra y precio Brickset

La interfaz SHALL incluir `precioCompra` y `fechaCompra` editables cuando el modo lo permita, y `categoria`, `subcategoria`, `anio` y `precio` como campos provenientes de Brickset con estilo `.input-readonly`. SHALL sincronizar individualmente de forma automática al cargar correctamente la imagen de un ID introducido y SHALL ofrecer sincronización masiva en segundo plano; la sincronización individual SHALL aplicar el año actual como fallback cuando Brickset devuelva `0` o no lo devuelva.

#### Scenario: Consulta individual
- **WHEN** se carga correctamente la imagen del ID válido introducido en el modal de alta o edición
- **THEN** solicita los datos individuales a la API
- **AND** rellena categoría, subcategoría cuando aplica, año y precio

#### Scenario: Actualización masiva
- **WHEN** el usuario activa `Actualizar precios desde Brickset`
- **THEN** inicia la actualización masiva de `precio` únicamente
- **AND** al terminar refresca tabla y resumen
- **AND** no modifica `categoria`, `subcategoria` ni `anio` de ninguna minifigura

#### Scenario: Error al iniciar la actualización masiva
- **WHEN** la API rechaza el inicio de la actualización masiva o no responde
- **THEN** la interfaz muestra un Toast de error
- **AND** el botón `🔄` vuelve a estar habilitado

#### Scenario: Fallback de año visible
- **WHEN** la consulta individual a Brickset devuelve año `0` o ausente
- **THEN** el campo Año muestra el año actual
- **AND** el botón Guardar puede habilitarse si se cumplen los demás obligatorios

## ADDED Requirements

### Requirement: Mostrar el progreso de la actualización masiva

Mientras la actualización masiva del usuario esté en curso, la interfaz SHALL mantener deshabilitado el botón `🔄`, SHALL mostrar en el panel desplegable del resumen una barra de progreso con el avance `procesados / total` y SHALL consultar periódicamente el estado de la tarea. El resto de la interfaz SHALL permanecer usable. Al completarse, la interfaz SHALL ocultar la barra, habilitar el botón, refrescar tabla y resumen, y mostrar un Toast blanco (estilo de éxito) indicando que la actualización ha terminado con el número de figuras actualizadas y fallidas. Si la tarea termina en la respuesta de inicio, no SHALL mostrarse la barra y solo SHALL mostrarse el Toast final.

#### Scenario: Tarea en curso
- **WHEN** la respuesta de inicio indica `estado: "en_curso"`
- **THEN** el botón `🔄` queda deshabilitado
- **AND** el panel desplegable muestra la barra de progreso con `procesados` de `total`
- **AND** los filtros, la tabla y las acciones de fila siguen habilitados

#### Scenario: Avance de la tarea
- **WHEN** una consulta periódica devuelve un `procesados` mayor
- **THEN** la barra de progreso refleja el nuevo avance

#### Scenario: Fin de la tarea
- **WHEN** una consulta periódica devuelve `estado: "completada"`
- **THEN** la barra de progreso se oculta
- **AND** el botón `🔄` se habilita
- **AND** se muestra un Toast blanco con el texto `Actualización de precios terminada: X actualizadas, Y fallidas.`
- **AND** la tabla y el resumen se refrescan

#### Scenario: Tarea instantánea
- **WHEN** la respuesta de inicio ya indica `estado: "completada"`
- **THEN** no se muestra la barra de progreso
- **AND** se muestra el Toast blanco de fin

#### Scenario: Retomar al cargar la página
- **WHEN** el usuario inicia sesión o recarga la página con una tarea en curso
- **THEN** la interfaz muestra la barra de progreso y deshabilita el botón `🔄` sin iniciar otra tarea

#### Scenario: Cierre de sesión
- **WHEN** el usuario cierra sesión con una tarea en curso
- **THEN** la interfaz deja de consultar el estado y oculta la barra de progreso
