# Spec Delta

## MODIFIED Requirements

### Requirement: Entregar eventos sociales y cambios de pertenencia a rankings

El sistema SHALL crear notificaciones duraderas para regalos V2, agradecimientos y transiciones reales de entrada/salida del Top 10 global/semanal. El regalo SHALL identificar donante por username e importe directo confirmado de 50 o 5. El agradecimiento SHALL identificar al emisor y el importe directo vigente, sin anunciar el logro repetible V1 por recibir las gracias. Los nuevos hitos por agradecer SHALL concederse al emisor, no al donante receptor de las gracias. Una transicion SHALL generar un solo evento por usuario/ranking/transicion; leer rankings SHALL NOT emitir ni duplicar eventos. El semanal SHALL respetar su activacion V2.

#### Scenario: Recibir un regalo
- **WHEN** se confirma una donacion V2 global o semanal
- **THEN** el receptor recibe una notificacion no leida con username y el importe directo correcto
- **AND** el texto no confunde ese importe con los Bricks adicionales de un hito

#### Scenario: Entrar o salir de un Top 10
- **WHEN** una mutacion ordinaria V2 cambia pertenencia a un ranking disponible
- **THEN** se crea una sola notificacion de entrada con posicion o de salida sin posicion inventada
- **AND** consultar de nuevo no duplica el evento

#### Scenario: Agradecer un regalo una sola vez
- **WHEN** un receptor agradece un regalo V2 propio no agradecido
- **THEN** el donante recibe la notificacion y 5 Bricks directos, sin el logro repetible V1
- **AND** el emisor actualiza los hitos por su primera o decima accion, sin marcar la notificacion como leida
- **AND** un reintento no genera nuevos premios ni eventos

## ADDED Requirements

### Requirement: Empezar V2 con bandeja vacia y migracion silenciosa

La migracion unica SHALL eliminar todas las notificaciones existentes y su estado de lectura. SHALL establecer la pertenencia a ranking recalculada como base silenciosa y SHALL NOT emitir avisos de logros, subidas/bajadas de nivel, progreso diario ni entradas/salidas causadas exclusivamente por el reset. Los primeros accesos SHALL devolver bandeja vacia y unreadCount cero, salvo eventos ordinarios V2 realmente posteriores. Workers invalidados, reconexiones Realtime y caches de cliente SHALL NOT reintroducir notificaciones V1. Las acciones sociales conservadas SHALL seguir siendo gestionables desde Amigos aunque sus notificaciones antiguas se hayan borrado.

#### Scenario: Migracion de usuarios de prueba
- **WHEN** termina el reset y la reconstruccion V2
- **THEN** no quedan notificaciones V1 ni avisos sinteticos del recalcule y el indicador no leido se limpia

#### Scenario: Primer evento ordinario posterior
- **WHEN** llega un regalo nuevo V2 despues de la migracion
- **THEN** se genera la notificacion normal una vez y sucesivos reinicios no la borran