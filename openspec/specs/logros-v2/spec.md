# logros-v2 Specification

## Purpose

Definir el catalogo completo de logros V2 y sus condiciones verificables para reconstruir la progresion de todos los usuarios desde su coleccion y relaciones sociales vigentes, sin depender del documento adjunto original.

## Requirements

### Requirement: Sustituir integramente el catalogo V1 por el catalogo V2

El sistema SHALL habilitar exclusivamente los 115 logros definidos en este documento. Cada fila SHALL definir ID estable, titulo, texto, Bricks por concesion y pesos privados. Las secciones de las tablas SHALL ser organizacion documental, sin categorias de logro, filtros, bonificaciones ni grupos visibles nuevos en la app. La columna Total del PDF SHALL NOT importarse; el campo existente `total` de una respuesta de logro SHALL seguir siendo Bricks por cantidad, sin relacion con esa columna editorial. Los pesos se expresan aqui en orden **Collector / Rarity Hunter / Fan / Explorer (C/R/F/E)**, independientemente del orden interno de almacenamiento.

Los titulos y textos SHALL conservar los del PDF salvo correcciones autorizadas de erratas evidentes y normalizacion de nombres oficiales de categorias. Los IDs V1 no incluidos en estas tablas SHALL desaparecer, sin alias que concedan recompensas duplicadas. Ningun peso individual SHALL publicarse en API, DOM ni recursos del navegador. Los niveles, sus nombres y sus umbrales SHALL conservarse.

#### Scenario: Sustitucion completa
- **WHEN** termina la migracion V2 de una cuenta con logros V1
- **THEN** solo aparecen los logros de las tablas cuyos requisitos actuales cumple
- **AND** no permanecen recompensas de logros retirados ni se importan grupos o el Total editorial

### Requirement: Derivar cantidades y progresion del estado vigente

Los logros de figuras SHALL contar exclusivamente IDs canonicos distintos en estado `COLECCIÓN`, nunca `BUSCADA`, filas duplicadas ni acciones historicas de alta. Un logro repetible por figura SHALL tener cantidad igual al numero de figuras elegibles; uno repetible por categoria o serie SHALL tener una concesion por grupo elegible, no por figura adicional ni por cada cruce del umbral. Un logro no repetible SHALL tener cantidad 0 o 1. Todos SHALL ganarse, perderse y recuperarse cuando cambie su requisito vigente, ajustando sus Bricks, nivel y progreso en ambos sentidos.

Los hitos de importes, numero de amigos, regalos, agradecimientos, figuras de franquicia y progreso dentro de una serie/categoria SHALL ser acumulativos cuando se cumplen varios. Los tramos de tamano de categoria SHALL ser la unica exclusion entre tramos, conforme al requisito correspondiente. Cambios de inventario, precios, nombres completos, anios, referencias de categoria, totales o anio de serie, relaciones sociales y ledger de regalos/agradecimientos SHALL reflejarse en el siguiente estado confirmado sin duplicacion por reintentos. Las lecturas publicas ajenas SHALL seguir siendo de solo lectura.

#### Scenario: Perder y recuperar una figura
- **WHEN** una figura elegible pasa a BUSCADA, se elimina o vuelve a COLECCIÓN
- **THEN** desaparecen o reaparecen sus contribuciones actuales sin mantener recompensas historicas ni duplicar concesiones

#### Scenario: No repetir por multiples ni por reintentos
- **WHEN** un usuario tiene 20 figuras Star Wars y el recalcule se repite
- **THEN** mantiene una concesion de Youngling, Padawan y Jedi Knight, no cuatro de Youngling

### Requirement: Conceder los logros de acciones sociales y alta

El sistema SHALL aplicar las siguientes definiciones; solo Block by block es repetible, una vez por figura actual de coleccion. First contact SHALL estar vigente mientras haya al menos una solicitud propia enviada pendiente o una amistad actual originada por una solicitud propia. Una solicitud rechazada por si sola SHALL NOT mantenerlo. Handshake SHALL estar vigente mientras haya al menos una amistad actual cuyo usuario fuera receptor de la solicitud aceptada. La aceptacion SHALL NOT retirar First contact al emisor. Los hitos de amigos SHALL contar amistades aceptadas actuales una vez por pareja, no solicitudes. Estas reglas SHALL usar los datos conservados al migrar, no solo eventos posteriores a V2.

| ID | Titulo | Texto | Bricks | C/R/F/E |
| --- | --- | --- | ---: | --- |
| block-by-block | Block by block | Has añadido una minipersona | 1 | 0/0/0/0 |
| first-contact | First contact | Has enviado la primera solicitud de amistad | 2 | 0/0/0/0 |
| handshake | Handshake | Has aceptado la primera solicitud de amistad | 3 | 0/0/0/0 |
| crew | Crew | Tienes 10 amigos | 20 | 0/0/0/0 |
| brick-alliance | Brick Alliance | Tienes 20 amigos | 40 | 0/0/0/0 |
| full-house | Full House | Tienes 50 amigos | 100 | 0/0/0/0 |
| community | Community | Tienes un centenar de amigos | 300 | 0/0/0/0 |

#### Scenario: Aceptacion y ultima amistad eliminada
- **WHEN** B acepta la unica solicitud pendiente enviada por A y posteriormente se elimina esa amistad
- **THEN** al aceptar A conserva First contact y B gana Handshake
- **AND** al eliminarla ambos pierden esos logros si no queda otra relacion que los justifique

#### Scenario: Bajar del numero de amigos
- **WHEN** el numero de amistades aceptadas baja de 20 a 19
- **THEN** se retiran Brick Alliance y sus 40 Bricks, manteniendo Crew

### Requirement: Conceder hitos de valor y precio de figuras

El valor SHALL priorizar precio de mercado valido, usar precio de compra valido como fallback y cero en ausencia de ambos. El total SHALL sumar solo COLECCIÓN. Los cinco hitos de valor total SHALL ser no repetibles y concederse con **valor >= umbral**; sus textos y pesos son los siguientes. Los cinco hitos por precio individual SHALL ser repetibles por figura y usar **precio efectivo > umbral**, como indica el documento; una figura que cumple varios SHALL contribuir a todos.

| ID | Titulo | Texto | Umbral EUR | Bricks | C/R/F/E |
| --- | --- | --- | ---: | ---: | --- |
| solid-investment | Solid Investment | El valor de tu colección ha alcanzado 500€ | 500 | 250 | 80/5/10/5 |
| vault-guardian | Vault Guardian | El valor de tu colección ha alcanzado 1000€ | 1000 | 500 | 70/15/10/5 |
| crown-jewel | Crown Jewel | El valor de tu colección ha alcanzado 2000€ | 2000 | 1000 | 60/20/10/10 |
| treasure-hoard | Treasure Hoard | El valor de tu colección ha alcanzado 5000€ | 5000 | 2500 | 50/50/0/0 |
| plastic-tycoon | Plastic Tycoon | El valor de tu colección ha alcanzado 10000€ | 10000 | 7000 | 50/50/0/0 |
| sweet-find | Sweet find | Has añadido una minipersona valorada en más de 10€ | 10 | 5 | 80/5/10/5 |
| hidden-gem | Hidden gem | Has añadido una minipersona valorada en más de 50€ | 50 | 25 | 50/20/20/10 |
| epic-piece | Epic piece | Has añadido una minipersona valorada en más de 100€ | 100 | 100 | 30/40/25/5 |
| holy-grail | Holy Grail | Has añadido una minipersona valorada en más de 500€ | 500 | 700 | 10/80/10/0 |
| unicorn | Unicorn | Has añadido una minipersona valorada en más de 1000€ | 1000 | 2000 | 0/100/0/0 |

#### Scenario: Limites de valor total y precio individual
- **WHEN** el valor efectivo de una unica figura actual es exactamente 500 EUR
- **THEN** concede Solid Investment pero no Holy Grail, y concede los hitos individuales inferiores
- **AND** una bajada posterior recalcula y retira los hitos que ya no se cumplen

### Requirement: Conceder hitos de series coleccionables

Serie SHALL significar exclusivamente cada subcategoria oficial de Collectible Minifigures, incluidas Other y las de nombre compuesto. El anio de serie SHALL ser el menor anio publicado entre las figuras Brickset observadas de esa misma subcategoria; nunca SHALL derivarse del inventario del usuario ni del anio actual. Si alguna ficha de la serie carece de anio y hay otras fichas de la misma serie con anio, se SHALL usar ese minimo observado como estimacion, indicado por `anioInicioEstimado: true`. Si ninguna ficha tiene anio, la serie SHALL quedar sin clasificar. Antigua SHALL significar anio <= 2016 y moderna anio >= 2017. Cada uno de los seis logros SHALL ser repetible una vez por serie elegible y acumulativo con los otros hitos de esa serie.

Empezar SHALL requerir al menos una figura. El hito intermedio SHALL requerir **100 por cantidad / total > 80**, sin redondeo; completitud SHALL requerir cantidad >= total. Los hitos dependientes de total SHALL exigir un total conocido positivo vigente. Un anio sin ninguna observacion valida SHALL NOT inventarse ni conceder la variante antigua/moderna. Una estimacion marcada `anioInicioEstimado: true` SHALL clasificar la serie con el mismo umbral de 2016. Ninguna otra categoria o subcategoria SHALL conceder estos seis logros.

| ID | Titulo | Texto | Condicion | Bricks | C/R/F/E |
| --- | --- | --- | --- | ---: | --- |
| fresh-start | Fresh start | Has empezado una serie coleccionable posterior a 2016 | moderna iniciada | 5 | 30/0/10/60 |
| almost-there | Almost there | Has llegado al 80% de una serie coleccionable posterior a 2016 | moderna >80% | 20 | 90/0/10/0 |
| series-showcase | Series showcase | Has completado una serie coleccionable posterior a 2016 | moderna completa | 50 | 90/0/10/0 |
| retro-find | Retro find | Has empezado una serie coleccionable anterior o igual a 2016 | antigua iniciada | 15 | 30/0/10/60 |
| vault-specialist | Vault specialist | Has llegado al 80% de una serie coleccionable anterior o igual a 2016 | antigua >80% | 50 | 90/0/10/0 |
| archived-forever | Archived forever | Has completado una serie coleccionable anterior o igual a 2016 | antigua completa | 100 | 90/0/10/0 |

#### Scenario: Serie de 2016 y limite exacto
- **WHEN** una serie con anio minimo 2016 tiene total 10 y el usuario posee 8 figuras distintas
- **THEN** concede Retro find, no Vault specialist y ningun hito moderno
- **AND** con 9 figuras concede Vault specialist y con 10 tambien Archived forever

#### Scenario: Clasificacion comun independiente del usuario
- **WHEN** una serie contiene figuras de 2016 y 2017 y dos usuarios poseen solo figuras de anios diferentes
- **THEN** la serie se clasifica como antigua para ambos

### Requirement: Conceder hitos DNA sin realimentacion

Los cuatro hitos SHALL ser no repetibles, con pesos cero y condicion **porcentaje exacto >= 50**. SHALL evaluarse a partir de contribuciones de los demas logros vigentes, sin redondeo de presentacion ni realimentacion. Curiosity Driven SHALL conservar 100 Bricks pese a corregirse sus pesos. Un estado sin contribuciones SHALL tener cuatro ceros y SHALL NOT conceder ninguno de estos hitos.

| ID | Titulo | Texto | Rasgo | Bricks | C/R/F/E |
| --- | --- | --- | --- | ---: | --- |
| curator | Curator | Has alcanzado un 50% de rasgo Collector | Collector | 50 | 0/0/0/0 |
| grail-seeker | Grail Seeker | Has alcanzado un 50% de rasgo Rarity Hunter | Rarity Hunter | 500 | 0/0/0/0 |
| nerd | Nerd | Has alcanzado un 50% de rasgo Fan | Fan | 250 | 0/0/0/0 |
| curiosity-driven | Curiosity Driven | Has alcanzado un 50% de rasgo Explorer | Explorer | 100 | 0/0/0/0 |

#### Scenario: Dos rasgos al cincuenta
- **WHEN** Collector y Fan tienen exactamente 50% cada uno
- **THEN** concede Curator y Nerd sin alterar la distribucion
- **AND** al bajar uno de ellos a 49.99% pierde su logro aunque la UI redondee a 50%

### Requirement: Conceder hitos de antiguedad por decadas completas

Los tres logros SHALL ser repetibles por figura actual con anio valido y SHALL usar intervalos disjuntos completos, sin huecos en 1980 ni 1990.

| ID | Titulo | Texto | Intervalo | Bricks | C/R/F/E |
| --- | --- | --- | --- | ---: | --- |
| the-90s | The 90's | Has añadido una minipersona de los años 90 | 1990-1999 inclusive | 20 | 30/65/0/5 |
| the-80s | The 80's | Has añadido una minipersona de los años 80 | 1980-1989 inclusive | 40 | 30/65/0/5 |
| dusty-relic | Dusty Relic | Has añadido una minipersona anterior al año 1980 | menor a 1980 | 60 | 30/65/0/5 |

#### Scenario: Anios frontera
- **WHEN** la coleccion contiene figuras de 1979, 1980, 1989, 1990, 1999 y 2000
- **THEN** concede una unidad Dusty Relic, dos The 80's y dos The 90's, sin incluir la de 2000

### Requirement: Conceder hitos V2 de regalos y agradecimientos emitidos

Los cuatro hitos SHALL ser no repetibles, tipo `regalo`, sin contribucion DNA. El numero de regalos SHALL sumar regalos globales y semanales recibidos de V2 en un contador unico; los agradecimientos SHALL contar exclusivamente acciones propias emitidas y confirmadas sobre regalos V2 distintos. Los registros V1 SHALL resetearse, no migrarse como recompensas V2. Los hitos de 1 y 10 SHALL acumularse y retirarse si deja de existir su fuente valida. La contribucion directa de regalos SHALL ser adicional, exactamente 50 por global y 5 por semanal, sin materializar un logro repetible V1.

| ID | Titulo | Texto | Condicion | Bricks | C/R/F/E |
| --- | --- | --- | --- | ---: | --- |
| oh-you-shouldnt-have | Oh! you shouldn't have! | Has recibido tu primer regalo | regalos >= 1 | 20 | 0/0/0/0 |
| is-it-my-birthday-or-what | Is it my birthday or what?! | Has recibido 10 regalos | regalos >= 10 | 100 | 0/0/0/0 |
| gratitude-is-the-sign-of-noble-souls | Gratitude is the sign of noble souls | Has dado las gracias por primera vez | agradecimientos emitidos >= 1 | 5 | 0/0/0/0 |
| great-manners | Great manners | Has dado las gracias 10 veces | agradecimientos emitidos >= 10 | 30 | 0/0/0/0 |

#### Scenario: Primer regalo sin doble contabilizacion
- **WHEN** una cuenta vacia recibe su primer regalo V2 global
- **THEN** tiene 70 Bricks, correspondientes a 50 directos y 20 del primer hito
- **AND** no aparecen Your collection is top! ni otros logros repetibles V1

#### Scenario: Unificar origen y limitar hitos
- **WHEN** un usuario recibe 6 regalos globales y 4 semanales V2
- **THEN** su contador es 10 y obtiene ambos hitos una vez, con 120 Bricks de hitos y 320 directos

### Requirement: Conceder hitos generales de categorias por tramo exclusivo

Todas las categorias oficiales, incluida Collectible Minifigures, SHALL participar. The cornerstone SHALL ser repetible una vez por categoria con al menos una figura, dar 5 Bricks, pesos 10/0/0/90 y texto `Has añadido la primera minipersona de una categoría`.

Para los otros nueve hitos, el tramo SHALL seleccionarse por el total conocido vigente **T**: bajo si 50 < T <= 100, medio si 100 < T <= 500, alto si T > 500. Con T <= 50, cero o desconocido no SHALL concederse ninguno de esos nueve. Solo SHALL habilitarse el tramo mas alto aplicable; dentro de el, el 50%, 80% y 100% SHALL concederse al alcanzar o superar la fraccion exacta, sin redondear, y acumularse. Cada hito SHALL ser repetible una vez por categoria elegible, con pesos 60/0/40/0.

| ID | Titulo | Tramo | Porcentaje o condicion | Bricks |
| --- | --- | --- | ---: | ---: |
| the-cornerstone | The cornerstone | cualquiera | primera figura | 5 |
| category-halfway | Category halfway | bajo | 50 | 200 |
| theme-specialist | Theme specialist | bajo | 80 | 500 |
| category-conquest | Category Conquest | bajo | 100 | 1000 |
| major-milestone | Major milestone | medio | 50 | 500 |
| category-dominance | Category dominance | medio | 80 | 1500 |
| theme-master | Theme master | medio | 100 | 3000 |
| grand-horizon | Grand Horizon | alto | 50 | 1500 |
| mega-specialist | Mega specialist | alto | 80 | 3000 |
| grand-category-legend | Grand Category Legend | alto | 100 | 5000 |

El texto del 50/80% SHALL ser `Has alcanzado el {porcentaje}% de una categoría de más de {limite} minipersonas`; el de 100% SHALL ser `Has completado una categoría de más de {limite} minipersonas`, con limite 50, 100 o 500 segun tramo.

#### Scenario: Completar una categoria de seiscientas figuras
- **WHEN** se poseen las 600 figuras de una categoria de total 600
- **THEN** concede Grand Horizon, Mega specialist y Grand Category Legend por 9500 Bricks y The cornerstone por 5
- **AND** no concede los seis hitos de tamano inferior

#### Scenario: Fronteras y cambio de tramo
- **WHEN** los totales conocidos son 50, 100, 101, 500 y 501
- **THEN** corresponden respectivamente ningun tramo, bajo, medio, medio y alto
- **AND** un cambio de total retira hitos del tramo anterior y reevalua los del nuevo sin garantias historicas

### Requirement: Conceder logros especiales de figuras y nombre completo

Los IDs de figura SHALL compararse canonicamente, sin distinguir mayusculas. Los logros por nombre SHALL buscar la cadena indicada, sin distinguir mayusculas, en el nombre completo original de Brickset, incluida la parte separada como descripcion y cualquier sufijo no retenido en el nombre visible. No SHALL limitarse a la version abreviada. El texto `Olivia` SHALL tratarse como coincidencia de cadena, de la misma forma que Comic-Con y Toy Fair. Las filas marcadas repetibles SHALL contar figuras distintas; las demas tendran como maximo una concesion.

| ID | Titulo | Texto | Condicion | Repetible | Bricks | C/R/F/E |
| --- | --- | --- | --- | --- | ---: | --- |
| retired-police | Retired police | Has añadido al policía de 1978 | COP014S | no | 15 | 20/80/0/0 |
| retired-firefighter | Retired firefighter | Has añadido al bombero de 1978 | FIREC019 | no | 15 | 20/80/0/0 |
| retired-courier | Retired courier | Has añadido al ¿cartero? de 1978 | PLN018 | no | 15 | 20/80/0/0 |
| the-original-crew | The original crew | Has añadido las 3 minipersonas más antiguas | COP014S y FIREC019 y PLN018 | no | 50 | 50/50/0/0 |
| pure-gold-zero-leprechauns-required | Pure gold, zero leprechauns required | Has añadido a Mr Gold a tu colección | COL161 | no | 1500 | 0/100/0/0 |
| pop-culture-fan | Pop culture fan | Has añadido a tu colección un tesoro de la Comic-Con | contiene Comic-Con | si | 3000 | 0/100/0/0 |
| fairgoer | Fairgoer | Has añadido a tu colección un tesoro de la Toy Fair | contiene Toy Fair | si | 3000 | 0/100/0/0 |
| i-have-a-soft-spot-for-him | I have a soft spot for him | Has añadido a Sprinter a tu colección | COL427 | no | 10 | 25/25/25/25 |
| dear-olivusik | Dear Olivusik | Has añadido una Olivia a tu colección | contiene Olivia | si | 5 | 25/25/25/25 |
| strike-it-rich | Strike it rich! | Has añadido a C-3PO Chrome Gold a tu colección | SW0158 | no | 1500 | 0/100/0/0 |
| we-all-make-mistakes | We all make mistakes | Has añadido al auténtico Finch Dallow a tu colección | SW1005 | no | 500 | 0/100/0/0 |
| sewer-treasure | Sewer Treasure | Has añadido a Shadow Leonardo a tu colección | TNT001 | no | 400 | 0/100/0/0 |

#### Scenario: Coincidencia fuera del nombre abreviado
- **WHEN** el nombre completo incluye `Comic-Con` solo en la parte separada del nombre visible
- **THEN** la figura actual de coleccion cuenta para Pop culture fan, tambien si cambia el uso de mayusculas

#### Scenario: Requisito combinado
- **WHEN** se retira una de COP014S, FIREC019 o PLN018 de COLECCIÓN
- **THEN** pierde The original crew y el logro individual correspondiente sin retirar los otros dos

### Requirement: Conceder primeras figuras de categorias oficiales

Cada fila SHALL ser no repetible, exigir al menos una figura actual de la categoria exacta oficial y aportar pesos **10/0/0/90**. Estos hitos SHALL NOT usar automaticamente las reglas ampliadas de universo de los hitos de 5/10/20/50/100. El texto SHALL ser `Has añadido la primera minipersona de la categoría {categoria}` con el nombre oficial de la tabla. Los alias tipograficos del PDF SHALL resolverse a estos nombres, sin coincidencias parciales ni categorias inventadas.

| ID | Categoria oficial | Titulo | Bricks |
| --- | --- | --- | ---: |
| your-adventure-begins | Adventurers | Your adventure begins | 30 |
| new-sea-creature | Atlantis | New sea creature | 30 |
| old-bat | Batman I | Old bat | 50 |
| there-is-a-new-boy-in-the-castle | Castle | There is a new boy in the castle | 30 |
| dimensional | Dimensions | Dimensional | 40 |
| bricky-mouse | Disney | Bricky Mouse | 20 |
| daydreamer | DREAMZzz | Daydreamer | 15 |
| you-dropped-in-tilted-towers | Fortnite | You dropped in Tilted Towers | 20 |
| alohomora | Harry Potter | Alohomora! | 15 |
| may-the-sun-shine-upon-you | Horizon | May the Sun shine upon you | 20 |
| that-belongs-in-a-museum | Indiana Jones | That belongs in a museum! | 30 |
| clever-girl | Jurassic World | Clever girl... | 15 |
| a-new-warrior-joins-the-tribe | LEGENDS OF CHIMA | A new warrior joins the Tribe! | 30 |
| sssss-boom | Minecraft | Sssss... BOOM! | 15 |
| unlocking-the-monkie-power | Monkie Kid | Unlocking the Monkie Power! | 30 |
| upgrade-complete-new-knight-in-the-realm | NEXO KNIGHTS | Upgrade Complete: New Knight in the Realm! | 30 |
| iron-sharpens-iron-brother-sharpens-brother | NINJAGO | Iron sharpens iron, brother sharpens brother | 15 |
| im-going-to-be-the-king-of-the-pirates | One Piece | I'm going to be the King of the Pirates! | 20 |
| land-ho | Pirates | Land ho! | 30 |
| you-almost-caught-captain-jack-sparrow | Pirates of the Caribbean | You almost caught Captain Jack Sparrow! | 20 |
| i-choose-you | Pokémon | I choose you! | 20 |
| gotta-go-fast | Sonic the Hedgehog | Gotta go fast! | 20 |
| houston-weve-had-a-problem-here | Space | Houston, we've had a problem here | 15 |
| web-slinger | Spider-Man | Web-slinger | 15 |
| are-you-ready-kids | SpongeBob SquarePants | Are you ready, kids? | 20 |
| warsie | Star Wars | Warsie | 15 |
| trekkie | Star Trek | Trekkie | 30 |
| welcome-to-the-upsidedown | Stranger Things | Welcome to the Upsidedown | 40 |
| i-can-do-this-all-day | Super Heroes | I can do this all day | 10 |
| its-a-me-mario | Super Mario | It's-a me, Mario! | 20 |
| cowabunga | Teenage Mutant Ninja Turtles | Cowabunga! | 40 |
| my-precious | The Hobbit & The Lord of the Rings | My precious... | 20 |
| its-dangerous-to-go-alone-take-this | The Legend of Zelda | It's dangerous to go alone! Take this. | 30 |
| honey-where-are-my-paaannts | The LEGO Movie | Honey, where are my paaannts? | 30 |
| welcome-to-apocalypseburg | The LEGO Movie 2 | Welcome to Apocalypseburg | 30 |
| the-worst-guy-in-the-world | The LEGO NINJAGO Movie | The worst guy in the world | 30 |
| ay-caramba | The Simpsons | ¡Ay, caramba! | 30 |
| theres-a-snake-in-my-boot | Toy Story | There's a snake in my boot! | 20 |
| a-new-cowboy-in-the-wild-west | Western | A new cowboy in the Wild West | 30 |

#### Scenario: Categoria oficial frente a universo
- **WHEN** una cuenta solo posee una figura de Collectible Minifigures cuya subcategoria contiene Harry Potter
- **THEN** cuenta para el universo Harry Potter pero no concede Alohomora!, que exige la categoria Harry Potter

### Requirement: Contar universos de franquicia sin duplicar figuras

Los siguientes 20 logros SHALL ser no repetibles, con condicion cantidad >= umbral y pesos **5/0/95/0**. SHALL contar la union de figuras elegibles una sola vez por ID. Star Wars SHALL usar categoria Star Wars; Harry Potter SHALL usar categoria Harry Potter o subcategoria que contenga Harry Potter; Super Heroes SHALL usar categoria Super Heroes o Spider-Man o subcategoria que contenga Super Heroes; Disney SHALL usar categoria Disney o subcategoria que contenga Disney. Las coincidencias de subcategoria SHALL ignorar mayusculas, sin inferir por nombre de personaje, prefijo de ID ni pertenencia comercial de otras franquicias. No SHALL ampliarse Super Heroes a Batman I ni Disney a todas sus propiedades por suposicion.

| ID | Universo | Umbral | Titulo | Bricks |
| --- | --- | ---: | --- | ---: |
| youngling | Star Wars | 5 | Youngling | 5 |
| padawan | Star Wars | 10 | Padawan | 20 |
| jedi-knight | Star Wars | 20 | Jedi Knight | 50 |
| jedi-master | Star Wars | 50 | Jedi Master | 200 |
| grand-master | Star Wars | 100 | Grand Master | 1000 |
| muggle | Harry Potter | 5 | Muggle | 5 |
| first-year | Harry Potter | 10 | First-Year | 20 |
| prefect | Harry Potter | 20 | Prefect | 50 |
| head-student | Harry Potter | 50 | Head Student | 200 |
| order-of-merlin | Harry Potter | 100 | Order of Merlin | 1000 |
| sidekick | Super Heroes | 5 | Sidekick | 5 |
| hero | Super Heroes | 10 | Hero | 20 |
| superhero | Super Heroes | 20 | Superhero | 50 |
| legend | Super Heroes | 50 | Legend | 200 |
| universe-guardian | Super Heroes | 100 | Universe Guardian | 1000 |
| mouseketeer | Disney | 5 | Mouseketeer | 5 |
| dream-chaser | Disney | 10 | Dream Chaser | 20 |
| fairytale-fan | Disney | 20 | Fairytale Fan | 50 |
| magic-master | Disney | 50 | Magic Master | 200 |
| once-upon-a-legend | Disney | 100 | Once Upon a Legend | 1000 |

El texto SHALL ser `Has añadido {umbral} minipersonas del universo {universo}` salvo Super Heroes, que SHALL usar `Has añadido {umbral} Super Heroes`.

#### Scenario: Union de categoria y subcategoria
- **WHEN** un usuario tiene 4 figuras de categoria Harry Potter y una figura de Collectible Minifigures con subcategoria Harry Potter
- **THEN** obtiene Muggle con 5 figuras de universo y pesos 5 Collector, 95 Fan
- **AND** una figura que cumpla simultaneamente dos condiciones no cuenta dos veces

#### Scenario: Categorias no incluidas
- **WHEN** una figura pertenece a Batman I sin subcategoria que contenga Super Heroes
- **THEN** puede conceder Old bat pero no incrementa el contador Super Heroes
