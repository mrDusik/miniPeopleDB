import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularGamificacion, nivelesAlcanzados, nuevosLogros, OBJETIVOS, selectLevel } from '../src/gamificacion.js';

function minifigura(overrides = {}) {
  return { id: 'mf-1', nombre: 'Figura', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN', ...overrides };
}

test('los nuevos logros de categoría e ID conservan nombre, descripción, Bricks y no se repiten', () => {
  const cases = [
    ['the-legend', 'The Legend', 'The Legend of Zelda', null, 10],
    ['heh-there-is-another-one-for-you', 'Heh! There is another one for you!', 'Pokémon', null, 10],
    ['change-will-not-come-in-a-single-sunrise', 'Change will not come in a single sunrise', 'Horizon', null, 10],
    ['start-poetry', 'Start Poetry', 'Minecraft', null, 10],
    ['mental-breakdown', 'Mental Breakdown', 'Super Heroes', 'SH0129', 3000],
    ['the-dark-plastic', 'The Dark Plastic', 'Super Heroes', 'SH0002', 1000],
    ['concrete-savanna', 'Concrete Savanna', 'Super Heroes', 'SH0604', 700],
  ];
  for (const [objectiveId, nombre, categoria, figureId, bricks] of cases) {
    const figure = minifigura({ categoria, id: figureId || 'first' });
    const logro = calcularGamificacion([figure, figure]).logros.find(({ id }) => id === objectiveId);
    assert.deepEqual(logro, {
      id: objectiveId, nombre,
      descripcion: figureId ? `Añadir la minifigura ${figureId}.` : `Añadir la primera minifigura de la categoría ${categoria}.`,
      bricks, repetible: false, cantidad: 1, total: bricks,
    });
    assert.equal(calcularGamificacion([{ ...figure, estadoColeccion: 'BUSCADA' }]).logros.some(({ id }) => id === objectiveId), false);
    assert.equal(calcularGamificacion([minifigura()]).logros.some(({ id }) => id === objectiveId), false);
  }
});

test('el logro y los Bricks por agradecimiento pertenecen a quien recibe las gracias', () => {
  const thanker = calcularGamificacion([], [], 0, 0);
  const giftDonor = calcularGamificacion([], [], 0, 1);

  assert.equal(thanker.bricks, 0);
  assert.equal(thanker.logros.some(({ id }) => id === 'thanks-for-the-gift'), false);
  assert.equal(giftDonor.bricks, 10);
  assert.deepEqual(giftDonor.logros.find(({ id }) => id === 'thanks-for-the-gift'), {
    id: 'thanks-for-the-gift',
    type: 'regalo',
    nombre: 'Gratitude is the sign of noble souls',
    descripcion: 'Un coleccionista te dio las gracias por tu regalo.',
    bricks: 5,
    repetible: true,
    cantidad: 1,
    total: 5,
  });
  assert.equal(giftDonor.logros.some(({ id }) => id === 'someone-liked-your-collection'), false);
});

test('los hitos de categoría se acumulan por categoría con total conocido y se retiran al bajar del umbral', () => {
  const categorias = [
    { categoria: 'Space', total: 3, subcategorias: [{ subcategoria: 'Classic', total: 1 }] },
    { categoria: 'Castle', total: 2, subcategorias: [] },
    { categoria: 'Empty', total: 0, subcategorias: [] },
  ];
  const figures = [
    minifigura({ id: 'one', subcategoria: 'Classic' }),
    minifigura({ id: 'two' }),
    minifigura({ id: 'three' }),
    minifigura({ id: 'castle', categoria: 'Castle' }),
    minifigura({ id: 'wanted', categoria: 'Castle', estadoColeccion: 'BUSCADA' }),
    minifigura({ id: 'empty', categoria: 'Empty' }),
    minifigura({ id: 'unknown', categoria: 'Unknown' }),
  ];
  const halfId = 'youre-shooting-for-the-stars';
  assert.equal(calcularGamificacion(figures.slice(0, 1), categorias).logros.some(({ id }) => id === halfId), false);
  assert.equal(calcularGamificacion(figures.slice(0, 2), categorias).logros.find(({ id }) => id === halfId).cantidad, 1);
  const state = calcularGamificacion(figures, categorias);
  assert.equal(state.logros.find(({ id }) => id === halfId).cantidad, 2);
  assert.equal(state.logros.find(({ id }) => id === halfId).total, 1000);
  assert.equal(state.logros.find(({ id }) => id === 'strike').cantidad, 1);
  assert.equal(state.logros.find(({ id }) => id === 'strike').total, 1200);
  assert.equal(calcularGamificacion([...figures, minifigura({ id: 'extra' })], categorias).logros.find(({ id }) => id === 'strike').cantidad, 1);
  const reduced = calcularGamificacion(figures.filter(({ id }) => id !== 'three'), categorias);
  assert.equal(reduced.logros.some(({ id }) => id === 'strike'), false);
  for (const [id, nombre, percentage, bricks] of [[halfId, "You're shooting for the stars", 50, 500], ['strike', 'Strike!!', 100, 1200]]) {
    assert.deepEqual(OBJETIVOS.find((objective) => objective.id === id), {
      id, nombre, descripcion: `Añadir una minifigura que suponga el ${percentage}% del total conocido de minifiguras de una categoría.`, bricks, repetible: true,
    });
  }
});

test('los objetivos previos se pierden al salir de COLECCIÓN y se recuperan al volver, sin perder regalos', () => {
  const categoryNames = ['Harry Potter', 'Disney', 'Super Mario', 'Sonic the Hedgehog', 'Dimensions', 'Star Wars', 'The Legend of Zelda', 'Pokémon', 'Horizon', 'Minecraft'];
  const figures = [
    ...categoryNames.map((categoria, index) => minifigura({ id: `category-${index}`, categoria, subcategoria: 'A', precio: 400 })),
    ...['COL161', 'SW0465A', 'ST008', 'ST009', 'SH0129', 'SH0002', 'SH0604'].map((id) => minifigura({ id, subcategoria: 'A', precio: 400 })),
  ];
  const categorias = [...new Set(figures.map(({ categoria }) => categoria))].map((categoria) => {
    const total = figures.filter((figure) => figure.categoria === categoria).length;
    return { categoria, total, subcategorias: [{ subcategoria: 'A', total }] };
  });
  const achieved = calcularGamificacion(figures, categorias, 2);
  assert.deepEqual(
    achieved.logros.filter(({ type }) => type !== 'regalo').map(({ id }) => id).sort(),
    OBJETIVOS.filter(({ id }) => !['retired-police', 'retired-firefighter', 'retired-doctor', 'trio-of-senior-citizens', 'antiquarian', 'almost-millionaire', 'weirdo', 'hooked', 'land-ho', 'nerd'].includes(id)).map(({ id }) => id).sort(),
  );
  const lost = calcularGamificacion(figures.map((figure) => ({ ...figure, estadoColeccion: 'BUSCADA' })), categorias, 2);
  assert.deepEqual(lost, calcularGamificacion([], categorias, 2));
  assert.equal(lost.bricks, 100);
  assert.deepEqual(nuevosLogros(achieved, lost), []);
  const restored = calcularGamificacion(figures, categorias, 2);
  assert.deepEqual(restored, achieved);
  assert.equal(nuevosLogros(lost, restored).length, achieved.logros.filter(({ type }) => type !== 'regalo').length);
});

test('añade logros de jubilados, el trío y figuras anteriores al año 2000', () => {
  const catalogo = [
    minifigura({ id: 'cop014s', anio: 1999 }),
    minifigura({ id: 'FIREC019', anio: 2000 }),
    minifigura({ id: 'pln018', anio: 1998 }),
    minifigura({ id: 'old-wanted', anio: 1978, estadoColeccion: 'BUSCADA' }),
  ];
  const logros = Object.fromEntries(calcularGamificacion(catalogo).logros.map((logro) => [logro.id, logro]));
  assert.deepEqual(['retired-police', 'retired-firefighter', 'retired-doctor', 'trio-of-senior-citizens', 'antiquarian'].map((id) => logros[id]?.cantidad), [1, 1, 1, 1, 2]);
  assert.equal(logros.antiquarian.total, 120);
  assert.deepEqual(
    ['retired-police', 'retired-firefighter', 'retired-doctor', 'trio-of-senior-citizens', 'antiquarian'].map((id) => OBJETIVOS.find((objective) => objective.id === id).repetible),
    [false, false, false, false, true],
  );
});

test('desbloquea los hitos de valor usando el valor de mercado y el precio de compra como respaldo', () => {
  const exactValue = calcularGamificacion([
    minifigura({ id: 'market-price', precio: 400 }),
    minifigura({ id: 'purchase-price', precioCompra: 100 }),
  ]);
  assert.equal(exactValue.logros.find(({ id }) => id === 'to-lay-the-groundwork')?.cantidad, 1);
  assert.equal(exactValue.logros.some(({ id }) => id === 'investor'), false);

  const allMilestones = calcularGamificacion([minifigura({ precio: 10000 })]);
  assert.deepEqual(
    allMilestones.logros.filter(({ id }) => ['to-lay-the-groundwork', 'investor', 'investment-fund', 'almost-millionaire'].includes(id)).map(({ id, cantidad }) => [id, cantidad]),
    [['to-lay-the-groundwork', 1], ['investor', 1], ['investment-fund', 1], ['almost-millionaire', 1]],
  );
});

test('evalúa los logros DNA con las ponderaciones existentes y sin auto-desbloqueo', () => {
  const rarityHunter = calcularGamificacion([minifigura({ id: 'expensive', precio: 301 })]);
  assert.equal(rarityHunter.logros.find(({ id }) => id === 'weirdo')?.cantidad, 1);

  const collectorCatalog = Array.from({ length: 10 }, (_, index) => minifigura({
    id: `collector-${index}`,
    subcategoria: `Subcategory ${index}`,
  }));
  const categories = [{
    categoria: 'Space', total: 100,
    subcategorias: collectorCatalog.map(({ subcategoria }) => ({ subcategoria, total: 1 })),
  }];
  const collector = calcularGamificacion(collectorCatalog, categories);
  assert.equal(collector.logros.find(({ id }) => id === 'hooked')?.cantidad, 1);
  assert.equal(collector.logros.some(({ id }) => id === 'nerd' || id === 'land-ho'), false);
});

test('acumula todos los logros de precio que cumple una minifigura', () => {
  const state = calcularGamificacion([minifigura({ precio: 135 })]);
  assert.equal(state.bricks, 164);
  assert.deepEqual(
    state.logros.filter(({ id }) => ['new-mini-person', 'woah', 'deal-master', 'masterpiece'].includes(id)).map(({ id, total }) => [id, total]),
    [['new-mini-person', 1], ['woah', 10], ['deal-master', 50], ['masterpiece', 100]],
  );
  assert.equal(state.logros.find(({ id }) => id === 'step-by-step').total, 3);
  assert.equal(state.logros.some(({ id }) => id === 'holy-grail'), false);
  assert.equal(state.logros.find(({ id }) => id === 'masterpiece').descripcion, 'Añadir una minifigura valorada en más de 100 euros.');
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

test('evalua objetivos especiales y primera presencia sin duplicar no repetibles', () => {
  const catalogo = [
    minifigura({ id: 'COL161', categoria: 'Harry Potter', subcategoria: 'A' }),
    minifigura({ id: 'ST008', categoria: 'Disney', subcategoria: 'B' }),
    minifigura({ id: 'ST009', categoria: 'Disney', subcategoria: 'B' }),
  ];
  const categorias = [{ categoria: 'Disney', total: 3, subcategorias: [{ subcategoria: 'B', total: 2 }] }];
  const state = calcularGamificacion(catalogo, categorias);
  const byId = Object.fromEntries(state.logros.map((logro) => [logro.id, logro]));
  assert.equal(byId.omgold.cantidad, 1);
  assert.equal(byId['welcome-to-the-upsidedown'].cantidad, 1);
  assert.equal(byId['chill-nancy-im-fine'].cantidad, 1);
  assert.equal(byId['lets-go'].cantidad, 2);
  assert.equal(byId.collector.cantidad, 1);
  assert.equal(byId['bricky-potter'].cantidad, 1);
  assert.equal(byId['bricky-mouse'].cantidad, 1);
});

test('el recálculo elimina las contribuciones de figuras borradas', () => {
  const previous = calcularGamificacion([minifigura({ id: 'COL161', precio: 135 })]);
  const next = calcularGamificacion([]);
  assert.equal(next.bricks, 0);
  assert.equal(next.nivel.nombre, 'Duplo');
  assert.deepEqual(nuevosLogros(previous, next), []);
  assert.deepEqual(nuevosLogros(next, previous).find(({ id }) => id === 'omgold').bricksNuevos, 5000);
});

test('combina regalos persistidos con logros de colección', () => {
  const state = calcularGamificacion([minifigura()], [], 2);
  const gift = state.logros.find(({ type }) => type === 'regalo');
  assert.deepEqual(gift, {
    id: 'someone-liked-your-collection', type: 'regalo', nombre: 'Someone liked your collection',
    descripcion: 'Has aparecido en el ranking global y te han hecho un regalo.', bricks: 50,
    repetible: true, cantidad: 2, total: 100,
  });
  assert.equal(state.bricks, calcularGamificacion([minifigura()]).bricks + 100);
  assert.equal(state.progreso.actual, state.bricks);
});
