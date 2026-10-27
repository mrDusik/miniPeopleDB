# Spec Delta

## MODIFIED Requirements

### Requirement: Mostrar solo el caracter DNA principal en ranking

La consulta autenticada del ranking SHALL calcular el caracter principal desde cantidades y ponderaciones privadas V2 vigentes. SHALL usar Newbie con contribucion cero, incluidos usuarios con solo logros de coleccion o sociales de pesos cero, y Explorer > Collector > Fan > Rarity Hunter para empates exactos antes del redondeo. Ningun logro de pesos cero ni pago directo SHALL diluir el denominador. La lectura SHALL NOT escribir porcentajes ni recalcular gamificacion ajena.

La proyeccion de rasgos SHALL respetar el contrato vigente de `ranking-global`: principal y como maximo dos rasgos agregados en Nivel/Coleccion, o solo el rasgo seleccionado al ordenar por DNA. Este requisito SHALL NOT restaurar la restriccion antigua de ocultar todos los porcentajes, ya superada por ese contrato. El texto DNA SHALL seguir sin accion para abrir un modal DNA ajeno; expansion, logros, regalos, miembros Top 10 y destacados SHALL conservar su comportamiento. Las respuestas publicas de logros SHALL NOT incluir pesos ni distribucion completa.

#### Scenario: Caracter principal de usuarios clasificados
- **WHEN** se carga el ranking tras la migracion V2
- **THEN** cada fila usa el DNA vigente y solo los rasgos publicos permitidos por el criterio seleccionado

#### Scenario: Usuario clasificado solo por regalos
- **WHEN** una cuenta tiene Bricks de regalos y solo logros de pesos cero
- **THEN** muestra Newbie, conservando Bricks, nivel y posicion derivados V2

#### Scenario: Empates consistentes con el panel propio
- **WHEN** hay empate exacto en el DNA del usuario activo clasificado
- **THEN** panel y ranking usan el mismo caracter principal segun la prioridad vigente

#### Scenario: Texto sin accion DNA
- **WHEN** se interactua con el texto DNA de una fila
- **THEN** no abre el modal DNA ajeno ni concede acceso a sus pesos, y siguen disponibles las acciones existentes