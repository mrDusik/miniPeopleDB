import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularGamificacion, nivelesAlcanzados, nuevosLogros, selectLevel } from '../src/gamificacion.js';

function minifigura(overrides = {}) {
  return { id: 'mf-1', nombre: 'Figura', categoria: 'Space', anio: 2024, estadoColeccion: 'COLECCIÓN', ...overrides };
}

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
