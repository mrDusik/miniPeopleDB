import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularGamificacion, calcularPorcentajesDna, DNA_PONDERACIONES, evaluarHitosDna, nivelesAlcanzados, nuevosLogros, OBJETIVOS, proyectarPesosDnaSql, selectLevel } from '../src/gamificacion.js';

function minifigura(overrides = {}) {
  return { id: 'mf-1', nombre: 'Figura', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN', ...overrides };
}

test('publica el catálogo V2 completo y excluye los objetivos V1 retirados', () => {
  const expectedIds = [
    'block-by-block', 'first-contact', 'handshake', 'crew', 'brick-alliance', 'full-house', 'community',
    'solid-investment', 'vault-guardian', 'crown-jewel', 'treasure-hoard', 'plastic-tycoon', 'sweet-find',
    'hidden-gem', 'epic-piece', 'holy-grail', 'unicorn', 'fresh-start', 'almost-there', 'series-showcase',
    'retro-find', 'vault-specialist', 'archived-forever', 'curator', 'grail-seeker', 'nerd', 'curiosity-driven',
    'the-90s', 'the-80s', 'dusty-relic', 'oh-you-shouldnt-have', 'is-it-my-birthday-or-what',
    'gratitude-is-the-sign-of-noble-souls', 'great-manners', 'the-cornerstone', 'category-halfway',
    'theme-specialist', 'category-conquest', 'major-milestone', 'category-dominance', 'theme-master',
    'grand-horizon', 'mega-specialist', 'grand-category-legend', 'retired-police', 'retired-firefighter',
    'retired-courier', 'the-original-crew', 'pure-gold-zero-leprechauns-required', 'pop-culture-fan', 'fairgoer',
    'i-have-a-soft-spot-for-him', 'dear-olivusik', 'strike-it-rich', 'we-all-make-mistakes', 'sewer-treasure',
    'your-adventure-begins', 'new-sea-creature', 'old-bat', 'there-is-a-new-boy-in-the-castle', 'dimensional',
    'bricky-mouse', 'daydreamer', 'you-dropped-in-tilted-towers', 'alohomora', 'may-the-sun-shine-upon-you',
    'that-belongs-in-a-museum', 'clever-girl', 'a-new-warrior-joins-the-tribe', 'sssss-boom',
    'unlocking-the-monkie-power', 'upgrade-complete-new-knight-in-the-realm',
    'iron-sharpens-iron-brother-sharpens-brother', 'im-going-to-be-the-king-of-the-pirates', 'land-ho',
    'you-almost-caught-captain-jack-sparrow', 'i-choose-you', 'gotta-go-fast', 'houston-weve-had-a-problem-here',
    'web-slinger', 'are-you-ready-kids', 'warsie', 'trekkie', 'welcome-to-the-upsidedown',
    'i-can-do-this-all-day', 'its-a-me-mario', 'cowabunga', 'my-precious', 'its-dangerous-to-go-alone-take-this',
    'honey-where-are-my-paaannts', 'welcome-to-apocalypseburg', 'the-worst-guy-in-the-world', 'ay-caramba',
    'theres-a-snake-in-my-boot', 'a-new-cowboy-in-the-wild-west', 'youngling', 'padawan', 'jedi-knight',
    'jedi-master', 'grand-master', 'muggle', 'first-year', 'prefect', 'head-student', 'order-of-merlin',
    'sidekick', 'hero', 'superhero', 'legend', 'universe-guardian', 'mouseketeer', 'dream-chaser', 'fairytale-fan',
    'magic-master', 'once-upon-a-legend',
  ];
  const retiredIds = [
    'new-mini-person', 'woah', 'deal-master', 'masterpiece', 'omgold', 'lets-go', 'collector', 'step-by-step',
    'bricky-potter', 'green-hill-zone', 'in-ny-i-was', 'chill-nancy-im-fine', 'the-legend',
    'heh-there-is-another-one-for-you', 'change-will-not-come-in-a-single-sunrise', 'start-poetry',
    'mental-breakdown', 'the-dark-plastic', 'concrete-savanna', 'youre-shooting-for-the-stars', 'strike',
    'retired-doctor', 'trio-of-senior-citizens', 'antiquarian', 'to-lay-the-groundwork', 'investor',
    'investment-fund', 'almost-millionaire', 'weirdo', 'hooked', 'someone-liked-your-collection',
    'youre-on-fire-this-week', 'thanks-for-the-gift',
  ];

  assert.equal(expectedIds.length, 115);
  assert.deepEqual(OBJETIVOS.map(({ id }) => id), expectedIds);
  assert.equal(new Set(expectedIds).size, expectedIds.length);
  assert.equal(OBJETIVOS.every(({ nombre, descripcion, bricks, repetible }) => (
    nombre.length > 0 && descripcion.length > 0 && Number.isInteger(bricks) && bricks >= 0 && typeof repetible === 'boolean'
  )), true);
  assert.equal(OBJETIVOS.some(({ id }) => retiredIds.includes(id)), false);
});

test('pondera los 115 logros V2 por rasgo y proyecta pesos SQL privados', () => {
  const projection = proyectarPesosDnaSql();

  assert.equal(DNA_PONDERACIONES.size, 115);
  assert.deepEqual(projection.map(({ logro_id }) => logro_id).sort(), OBJETIVOS.map(({ id }) => id).sort());
  for (const weights of DNA_PONDERACIONES.values()) {
    const values = Object.values(weights);
    assert.deepEqual(Object.keys(weights).sort(), ['collector', 'explorer', 'fan', 'rarityHunter'].sort());
    assert.equal(values.every((weight) => Number.isInteger(weight) && weight >= 0 && weight <= 100), true);
    assert.equal([0, 100].includes(values.reduce((sum, weight) => sum + weight, 0)), true);
  }
  assert.deepEqual(DNA_PONDERACIONES.get('youngling'), { collector: 5, rarityHunter: 0, fan: 95, explorer: 0 });
  assert.deepEqual(DNA_PONDERACIONES.get('curiosity-driven'), { collector: 0, rarityHunter: 0, fan: 0, explorer: 0 });
});

test('calcula DNA sin Bricks, excluye pesos cero y evalúa hitos exactos en una segunda pasada', () => {
  const collectionOnly = calcularGamificacion([minifigura({ categoria: '' })]);
  assert.equal(collectionOnly.logros.find(({ id }) => id === 'block-by-block')?.cantidad, 1);
  assert.deepEqual(calcularPorcentajesDna(collectionOnly.logros), {
    rarityHunter: 0, collector: 0, explorer: 0, fan: 0,
  });
  assert.deepEqual([...evaluarHitosDna(calcularPorcentajesDna(collectionOnly.logros))], [
    ['curator', 0], ['grail-seeker', 0], ['nerd', 0], ['curiosity-driven', 0],
  ]);

  const tie = calcularPorcentajesDna([
    { id: 'category-halfway', cantidad: 9, bricks: 1 },
    { id: 'youngling', cantidad: 1, bricks: 100000 },
    { id: 'muggle', cantidad: 1, bricks: 500000 },
    { id: 'curator', cantidad: 1000000 },
    { id: 'curiosity-driven', cantidad: 1000000 },
  ]);
  assert.deepEqual(tie, { rarityHunter: 0, collector: 50, explorer: 0, fan: 50 });
  assert.deepEqual([...evaluarHitosDna(tie)], [
    ['curator', 1], ['grail-seeker', 0], ['nerd', 1], ['curiosity-driven', 0],
  ]);

  const belowThreshold = calcularPorcentajesDna([
    { id: 'treasure-hoard', cantidad: 998 },
    { id: 'vault-guardian', cantidad: 1 },
    { id: 'retired-police', cantidad: 1 },
  ]);
  assert.equal(belowThreshold.collector, 49.99);
  assert.equal(evaluarHitosDna(belowThreshold).get('curator'), 0);
});

test('deduplica figuras canónicas y deriva logros por figura y categoría solo de COLECCIÓN', () => {
  const figures = [
    minifigura({ id: 'MF-1', categoria: 'Space' }),
    minifigura({ id: 'mf-1', categoria: 'Castle' }),
    minifigura({ id: 'MF-2', categoria: 'Space' }),
    minifigura({ id: 'MF-3', categoria: 'Castle' }),
    minifigura({ id: 'MF-4', categoria: 'Another', estadoColeccion: 'BUSCADA' }),
  ];
  const state = calcularGamificacion(figures);
  const byId = Object.fromEntries(state.logros.map((logro) => [logro.id, logro]));

  assert.equal(byId['block-by-block']?.cantidad, 3);
  assert.equal(byId['block-by-block']?.total, 3);
  assert.equal(byId['the-cornerstone']?.cantidad, 2);
  assert.equal(byId['the-cornerstone']?.total, 10);

  const lost = calcularGamificacion(figures.map((figure) => ({ ...figure, estadoColeccion: 'BUSCADA' })));
  assert.equal(lost.logros.some(({ id }) => id === 'block-by-block' || id === 'the-cornerstone'), false);
  assert.deepEqual(nuevosLogros(state, lost), []);
  assert.equal(nuevosLogros(lost, state).find(({ id }) => id === 'block-by-block')?.bricksNuevos, 3);

  const withoutSpace = calcularGamificacion(figures.filter(({ id }) => id !== 'MF-2'));
  assert.equal(withoutSpace.logros.find(({ id }) => id === 'block-by-block')?.cantidad, 2);
  assert.equal(withoutSpace.logros.find(({ id }) => id === 'the-cornerstone')?.cantidad, 2);
  assert.deepEqual(calcularGamificacion(figures.map((figure) => ({ ...figure, estadoColeccion: 'BUSCADA' }))).logros, []);
});

test('aplica límites V2 de valor, precio individual y décadas completas', () => {
  const priceMilestones = [
    [10, 'sweet-find'], [50, 'hidden-gem'], [100, 'epic-piece'], [500, 'holy-grail'], [1000, 'unicorn'],
  ];
  for (const [price, id] of priceMilestones) {
    assert.equal(calcularGamificacion([minifigura({ precio: price })]).logros.some((logro) => logro.id === id), false, `${id} at ${price}`);
    assert.equal(calcularGamificacion([minifigura({ precio: price + 0.01 })]).logros.some((logro) => logro.id === id), true, `${id} above ${price}`);
  }

  const totalMilestones = [
    [500, 'solid-investment'], [1000, 'vault-guardian'], [2000, 'crown-jewel'],
    [5000, 'treasure-hoard'], [10000, 'plastic-tycoon'],
  ];
  for (const [value, id] of totalMilestones) {
    assert.equal(calcularGamificacion([minifigura({ precio: value })]).logros.some((logro) => logro.id === id), true, `${id} at ${value}`);
    assert.equal(calcularGamificacion([minifigura({ precio: value - 0.01 })]).logros.some((logro) => logro.id === id), false, `${id} below ${value}`);
  }

  const fallback = calcularGamificacion([minifigura({ precio: -1, precioCompra: 51 })]);
  assert.equal(fallback.logros.some(({ id }) => id === 'hidden-gem'), true);
  assert.equal(fallback.logros.some(({ id }) => id === 'epic-piece'), false);
  const decades = calcularGamificacion([1979, 1980, 1989, 1990, 1999, 2000].map((anio) => minifigura({ id: `year-${anio}`, anio })));
  assert.equal(decades.logros.find(({ id }) => id === 'dusty-relic')?.cantidad, 1);
  assert.equal(decades.logros.find(({ id }) => id === 'the-80s')?.cantidad, 2);
  assert.equal(decades.logros.find(({ id }) => id === 'the-90s')?.cantidad, 2);
});

test('evalúa series Collectible Minifigures por año minimo, total conocido y porcentaje estricto', () => {
  const categories = [
    { categoria: 'Collectible Minifigures', total: 40, subcategorias: [
      { subcategoria: 'Modern Series', total: 10, anioInicio: 2017 },
      { subcategoria: 'Estimated Modern Series', total: 10, anioInicio: 2017, anioInicioEstimado: true },
      { subcategoria: 'Retro Series', total: 10, anioInicio: 2016 },
      { subcategoria: 'Collectible Minifigures Other', total: 10, anioInicio: 2013 },
      { subcategoria: 'Unknown Year', total: 10 },
      { subcategoria: 'Unknown Total', anioInicio: 2020 },
      { subcategoria: 'Zero Total', total: 0, anioInicio: 2020 },
    ] },
    { categoria: 'Space', total: 10, subcategorias: [{ subcategoria: 'Modern Series', total: 10, anioInicio: 2020 }] },
  ];
  const seriesFigure = (id, subcategoria) => minifigura({ id, categoria: 'Collectible Minifigures', subcategoria });
  const figures = [
    ...Array.from({ length: 8 }, (_, index) => seriesFigure(`modern-${index}`, 'Modern Series')),
    seriesFigure('estimated-modern', 'Estimated Modern Series'),
    ...Array.from({ length: 9 }, (_, index) => seriesFigure(`other-${index}`, 'Collectible Minifigures Other')),
    seriesFigure('retro', 'Retro Series'),
    seriesFigure('unknown-year', 'Unknown Year'),
    seriesFigure('unknown-total', 'Unknown Total'),
    seriesFigure('zero-total', 'Zero Total'),
    minifigura({ id: 'wrong-category', categoria: 'Space', subcategoria: 'Modern Series' }),
  ];
  const atEighty = Object.fromEntries(calcularGamificacion(figures, categories).logros.map((logro) => [logro.id, logro]));
  assert.equal(atEighty['fresh-start']?.cantidad, 4);
  assert.equal(atEighty['retro-find']?.cantidad, 2);
  assert.equal(atEighty['almost-there'], undefined);
  assert.equal(atEighty['series-showcase'], undefined);
  assert.equal(atEighty['vault-specialist']?.cantidad, 1);
  assert.equal(atEighty['archived-forever'], undefined);

  const atNinety = Object.fromEntries(calcularGamificacion([
    ...figures,
    seriesFigure('modern-8', 'Modern Series'),
    seriesFigure('other-9', 'Collectible Minifigures Other'),
  ], categories).logros.map((logro) => [logro.id, logro]));
  assert.equal(atNinety['almost-there']?.cantidad, 1);
  assert.equal(atNinety['archived-forever']?.cantidad, 1);

  const complete = Object.fromEntries(calcularGamificacion([
    ...figures,
    ...[8, 9].map((index) => seriesFigure(`modern-${index}`, 'Modern Series')),
  ], categories).logros.map((logro) => [logro.id, logro]));
  assert.equal(complete['series-showcase']?.cantidad, 1);
});

test('elige un único tramo de tamaño por categoría y acumula solo sus hitos vigentes', () => {
  const cases = [
    [50, 50, []],
    [100, 50, ['category-halfway']],
    [101, 51, ['major-milestone']],
    [500, 400, ['major-milestone', 'category-dominance']],
    [501, 401, ['grand-horizon', 'mega-specialist']],
    [600, 600, ['grand-horizon', 'mega-specialist', 'grand-category-legend']],
    [0, 1, []],
  ];

  for (const [total, owned, expectedIds] of cases) {
    const category = `Category ${total}`;
    const categories = [{ categoria: category, total, subcategorias: [] }];
    const figures = Array.from({ length: owned }, (_, index) => minifigura({ id: `${total}-${index}`, categoria: category }));
    const earnedIds = calcularGamificacion(figures, categories).logros.map(({ id }) => id);
    const progressIds = earnedIds.filter((id) => /^(category-|theme-|major-|grand-|mega-)/.test(id));
    assert.deepEqual(progressIds.sort(), [...expectedIds].sort(), `total ${total}, owned ${owned}`);
  }
});

test('evalúa primeras categorías oficiales, universos sin duplicados y logros especiales', () => {
  const categoryRows = [
    ['your-adventure-begins', 'Adventurers'], ['new-sea-creature', 'Atlantis'], ['old-bat', 'Batman I'],
    ['there-is-a-new-boy-in-the-castle', 'Castle'], ['dimensional', 'Dimensions'], ['bricky-mouse', 'Disney'],
    ['daydreamer', 'DREAMZzz'], ['you-dropped-in-tilted-towers', 'Fortnite'], ['alohomora', 'Harry Potter'],
    ['may-the-sun-shine-upon-you', 'Horizon'], ['that-belongs-in-a-museum', 'Indiana Jones'],
    ['clever-girl', 'Jurassic World'], ['a-new-warrior-joins-the-tribe', 'LEGENDS OF CHIMA'],
    ['sssss-boom', 'Minecraft'], ['unlocking-the-monkie-power', 'Monkie Kid'],
    ['upgrade-complete-new-knight-in-the-realm', 'NEXO KNIGHTS'], ['iron-sharpens-iron-brother-sharpens-brother', 'NINJAGO'],
    ['im-going-to-be-the-king-of-the-pirates', 'One Piece'], ['land-ho', 'Pirates'],
    ['you-almost-caught-captain-jack-sparrow', 'Pirates of the Caribbean'], ['i-choose-you', 'Pokémon'],
    ['gotta-go-fast', 'Sonic the Hedgehog'], ['houston-weve-had-a-problem-here', 'Space'],
    ['web-slinger', 'Spider-Man'], ['are-you-ready-kids', 'SpongeBob SquarePants'], ['warsie', 'Star Wars'],
    ['trekkie', 'Star Trek'], ['welcome-to-the-upsidedown', 'Stranger Things'],
    ['i-can-do-this-all-day', 'Super Heroes'], ['its-a-me-mario', 'Super Mario'],
    ['cowabunga', 'Teenage Mutant Ninja Turtles'], ['my-precious', 'The Hobbit & The Lord of the Rings'],
    ['its-dangerous-to-go-alone-take-this', 'The Legend of Zelda'], ['honey-where-are-my-paaannts', 'The LEGO Movie'],
    ['welcome-to-apocalypseburg', 'The LEGO Movie 2'], ['the-worst-guy-in-the-world', 'The LEGO NINJAGO Movie'],
    ['ay-caramba', 'The Simpsons'], ['theres-a-snake-in-my-boot', 'Toy Story'],
    ['a-new-cowboy-in-the-wild-west', 'Western'],
  ];
  const categoryFigures = categoryRows.map(([id], index) => minifigura({ id: `official-${index}`, categoria: categoryRows[index][1] }));
  categoryFigures.push(minifigura({ id: 'another-adventurer', categoria: 'Adventurers' }));
  const categoryState = Object.fromEntries(calcularGamificacion(categoryFigures).logros.map((logro) => [logro.id, logro]));
  for (const [id] of categoryRows) assert.equal(categoryState[id]?.cantidad, 1, id);

  const universeFigures = [
    ...Array.from({ length: 4 }, (_, index) => minifigura({ id: `hp-${index}`, categoria: 'Harry Potter' })),
    minifigura({ id: 'hp-subcategory', categoria: 'Collectible Minifigures', subcategoria: 'Harry Potter / Series 1' }),
    ...Array.from({ length: 5 }, (_, index) => minifigura({ id: `starwars-${index}`, categoria: 'Star Wars' })),
    ...Array.from({ length: 4 }, (_, index) => minifigura({ id: `heroes-${index}`, categoria: 'Super Heroes' })),
    minifigura({ id: 'spiderman', categoria: 'Spider-Man' }),
    minifigura({ id: 'heroes-subcategory', categoria: 'Collectible Minifigures', subcategoria: 'Super Heroes / Marvel' }),
    ...Array.from({ length: 3 }, (_, index) => minifigura({ id: `disney-${index}`, categoria: 'Disney' })),
    ...Array.from({ length: 2 }, (_, index) => minifigura({ id: `disney-sub-${index}`, categoria: 'Collectible Minifigures', subcategoria: 'Disney / Series 1' })),
    ...Array.from({ length: 5 }, (_, index) => minifigura({ id: `batman-${index}`, categoria: 'Batman I' })),
  ];
  const universeIds = new Set(calcularGamificacion(universeFigures).logros.map(({ id }) => id));
  for (const id of ['muggle', 'youngling', 'sidekick', 'mouseketeer', 'old-bat']) assert.equal(universeIds.has(id), true, id);
  for (const id of ['first-year', 'padawan', 'hero', 'dream-chaser', 'sidekick']) {
    if (id !== 'sidekick') assert.equal(universeIds.has(id), false, id);
  }

  const specialFigures = [
    ...['COP014S', 'FIREC019', 'PLN018', 'COL161', 'COL427', 'SW0158', 'SW1005', 'TNT001'].map((id) => minifigura({ id: id.toLowerCase() })),
    minifigura({ id: 'comic-1', nombre: 'Convention Exclusive', nombreCompleto: 'Convention Exclusive, Comic-Con 2022' }),
    minifigura({ id: 'comic-2', nombre: 'Convention Exclusive', nombreCompleto: 'Convention Exclusive, Comic-Con 2023' }),
    minifigura({ id: 'fair-1', nombre: 'Exclusive Minifigure', nombreCompleto: 'Exclusive Minifigure, Toy Fair' }),
    minifigura({ id: 'olivia-1', nombre: 'Olivia', nombreCompleto: 'Olivia' }),
    minifigura({ id: 'olivia-2', nombre: 'Olivia Variant', nombreCompleto: 'Olivia Variant, Promotional' }),
  ];
  const specialState = Object.fromEntries(calcularGamificacion(specialFigures).logros.map((logro) => [logro.id, logro]));
  assert.equal(specialState['the-original-crew']?.cantidad, 1);
  assert.equal(specialState['pure-gold-zero-leprechauns-required']?.cantidad, 1);
  assert.equal(specialState['pop-culture-fan']?.cantidad, 2);
  assert.equal(specialState.fairgoer?.cantidad, 1);
  assert.equal(specialState['dear-olivusik']?.cantidad, 2);
  assert.equal(specialState['strike-it-rich']?.cantidad, 1);
  assert.equal(specialState['we-all-make-mistakes']?.cantidad, 1);
  assert.equal(specialState['sewer-treasure']?.cantidad, 1);
});

test('el logro y los Bricks por agradecimiento pertenecen a quien recibe las gracias', () => {
  const thanker = calcularGamificacion([], [], 0, 0);
  const giftDonor = calcularGamificacion([], [], 0, 1);
  const thanked = calcularGamificacion([], [], 0, 0, 0, { thanks_sent: 1 });

  assert.equal(thanker.bricks, 0);
  assert.equal(thanker.logros.some(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls'), false);
  assert.equal(giftDonor.bricks, 5);
  assert.equal(giftDonor.logros.some(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls'), false);
  assert.equal(thanked.bricks, 5);
  assert.deepEqual(thanked.logros.find(({ id }) => id === 'gratitude-is-the-sign-of-noble-souls'), {
    id: 'gratitude-is-the-sign-of-noble-souls',
    type: 'regalo',
    nombre: 'Gratitude is the sign of noble souls',
    descripcion: 'Has dado las gracias por primera vez',
    bricks: 5,
    repetible: false,
    cantidad: 1,
    total: 5,
  });
  assert.equal(giftDonor.logros.some(({ id }) => id === 'someone-liked-your-collection'), false);
});

test('ignora por completo las minifiguras BUSCADA al calcular logros', () => {
  const state = calcularGamificacion([
    minifigura({
      id: 'COL161',
      estadoColeccion: 'BUSCADA',
      categoria: 'Harry Potter',
      subcategoria: 'A',
      precio: 400,
    }),
  ], [{ categoria: 'Harry Potter', total: 1, subcategorias: [{ subcategoria: 'A', total: 1 }] }]);

  assert.equal(state.bricks, 0);
  assert.deepEqual(state.logros, []);
});

test('selecciona nivel intermedio y progreso entre umbrales', () => {
  const state = selectLevel(820);
  assert.deepEqual(state.nivel, { id: 8, nombre: 'Redbeard', umbral: 750 });
  assert.deepEqual(state.siguienteNivel, { id: 9, nombre: 'Forestman', umbral: 1000 });
  assert.equal(state.progreso.porcentaje, 28);
});

test('el nivel maximo queda completado sin siguiente nivel', () => {
  const state = selectLevel(100000);
  assert.deepEqual(state.nivel, { id: 25, nombre: 'Mr. Gold', umbral: 100000 });
  assert.equal(state.siguienteNivel, null);
  assert.equal(state.progreso.porcentaje, 100);
});

test('devuelve todos los niveles intermedios alcanzados', () => {
  const next = { nivel: { id: 7, nombre: 'Captain', umbral: 500 } };
  assert.deepEqual(nivelesAlcanzados({ nivel: { id: 4, nombre: 'Citizen', umbral: 200 } }, next).map(({ id, nombre }) => [id, nombre]), [
    [5, 'Skeleton'],
    [6, 'Pirate'],
    [7, 'Captain'],
  ]);
  assert.deepEqual(nivelesAlcanzados(null, next), []);
});

test('el recálculo elimina las contribuciones de figuras borradas', () => {
  const previous = calcularGamificacion([minifigura({ id: 'COL161', precio: 135 })]);
  const next = calcularGamificacion([]);
  assert.equal(next.bricks, 0);
  assert.equal(next.nivel.nombre, 'Duplo');
  assert.deepEqual(nuevosLogros(previous, next), []);
  assert.deepEqual(nuevosLogros(next, previous).find(({ id }) => id === 'pure-gold-zero-leprechauns-required').bricksNuevos, 1500);
});

test('combina regalos persistidos con logros de colección', () => {
  const state = calcularGamificacion([minifigura()], [], 2);
  const gift = state.logros.find(({ type }) => type === 'regalo');
  assert.deepEqual(gift, {
    id: 'oh-you-shouldnt-have', type: 'regalo', nombre: "Oh! you shouldn't have!",
    descripcion: 'Has recibido tu primer regalo', bricks: 20,
    repetible: false, cantidad: 1, total: 20,
  });
  assert.equal(state.bricks, calcularGamificacion([minifigura()]).bricks + 120);
  assert.equal(state.progreso.actual, state.bricks);
});
