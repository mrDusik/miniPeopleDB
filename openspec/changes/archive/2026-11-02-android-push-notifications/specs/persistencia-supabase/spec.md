# Spec Delta

## MODIFIED Requirements

### Requirement: Limitar el acceso privilegiado al recálculo automático de categorías

Las operaciones ordinarias SHALL seguir usando JWT y RLS; ranking, regalos, amistades, agradecimientos e historico propio SHALL NOT usar service_role. El proceso backend de recalcule tras un cambio valido de categorias, anios de serie o definiciones completas V2 SHALL usar exclusivamente las RPC administrativas allowlisted existentes para obtener fuentes minimas y aplicar el lote de estados y su fingerprint. Solo service_role SHALL poder invocarlas; lote y fingerprint SHALL persistirse atomicamente y las claves SHALL permanecer fuera de HTTP y navegador. La huella SHALL incluir categorias, metadatos de series, catalogo y pesos V2. Las fuentes SHALL incluir relaciones y ledger V2 necesarios para recalcular todos los usuarios afectados, incluso cuentas solo sociales, sin otorgar lectura global directa a tablas.

El worker diario SHALL conservar su acceso global limitado a RPC allowlisted, trabajo reclamado, fuentes minimas y escrituras protegidas por lease y version vigente. La entrega FCM SHALL ser la unica excepcion nueva: un despachador de backend SHALL invocar exclusivamente RPC allowlisted y especificas para reclamar eventos de notificacion persistidos, obtener los tokens activos del destinatario de cada evento y registrar el resultado de envio. Esas RPC SHALL estar disponibles solo a service_role; no SHALL concederse acceso directo de service_role a tablas de tokens, bandeja o outbox, ni crearse RPC genericas, lecturas globales, escrituras para identidades elegidas por el cliente o rutas privilegiadas ordinarias. El registro y revocacion de tokens SHALL derivarse de JWT/RLS. Los secretos FCM y service_role SHALL permanecer fuera de HTTP y del cliente.

La migracion puntual V2 SHALL ejecutarse por el operador propietario de la base de datos, fuera de las rutas web y del arranque habitual. La excepcion FCM SHALL NOT ampliar las demas excepciones ni permitir una ruta ordinaria de reset.

#### Scenario: Intento de llamar al recálculo administrativo con sesión de usuario
- **WHEN** anon o authenticated invocan una RPC administrativa
- **THEN** se rechaza sin obtener fuentes globales ni modificar filas

#### Scenario: Recalcular después de cambiar categorías
- **WHEN** el backend aplica una huella valida nueva
- **THEN** el lote usa inventarios, relaciones y ledger V2 vigentes y la siguiente lectura refleja el estado confirmado

#### Scenario: Recalcular usuarios actuales al desplegar nuevos logros
- **WHEN** arranca el backend con una huella V2 nueva tras completar la migracion
- **THEN** recalcula usuarios con fuentes vigentes sin nuevas altas, preserva regalos V2 y no repite una huella aplicada ni el reset

#### Scenario: Intento de llamar al cron administrativo con JWT ordinario
- **WHEN** anon o authenticated intentan gestionar un trabajo o capturar snapshots
- **THEN** se rechaza sin leer fuentes globales ni escribir filas

#### Scenario: Cron autorizado sin ampliar rutas ordinarias
- **WHEN** un trigger valido inicia el worker V2
- **THEN** solo sus RPC allowlisted usan service_role y las lecturas personales conservan JWT y RLS

#### Scenario: Despacho FCM con acceso privilegiado acotado
- **WHEN** el despachador autorizado procesa una notificacion persistida
- **THEN** solo usa las RPC FCM allowlisted para esa notificacion y los tokens activos de su destinatario
- **AND** service_role no obtiene acceso directo general a tablas ni puede seleccionar otra identidad por parametros de cliente
- **AND** el alta y revocacion de tokens ordinarios siguen derivandose del JWT y RLS
