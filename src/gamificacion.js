export const NIVELES = [
  ['Duplo', 0],
  ['Stud', 20],
  ['Plate', 50],
  ['Three-Seven-Five', 100],
  ['Citizen', 200],
  ['Skeleton', 300],
  ['Pirate', 400],
  ['Captain', 500],
  ['Redbeard', 750],
  ['Forestman', 1000],
  ['Wolfpack', 1500],
  ['Wolfpack Master', 2000],
  ['Ninja', 2500],
  ['RX', 3000],
  ['Dragon Form', 5000],
  ['Space Baby', 6000],
  ['Space Man', 7000],
  ['Blacktron', 8000],
  ['Technic', 9000],
  ['Majisto', 10000],
  ['Castle Knight', 12500],
  ['Chrome Gold', 15000],
  ['Wooden Duck', 20000],
  ['De Billund', 30000],
  ['Mr. Kirk', 50000],
  ['Mr. Gold', 100000],
].map(([nombre, umbral], id) => ({ id, nombre, umbral }));

export const OBJETIVOS = [
  { id: 'new-mini-person', nombre: 'New mini person', descripcion: 'Añadir una nueva minifigura.', bricks: 1, repetible: true },
  { id: 'woah', nombre: 'WOAH!', descripcion: 'Añadir una minifigura valorada en más de 10 euros.', bricks: 10, repetible: true },
  { id: 'deal-master', nombre: 'Deal master', descripcion: 'Añadir una minifigura valorada en más de 50 euros.', bricks: 50, repetible: true },
  { id: 'masterpiece', nombre: 'Masterpiece', descripcion: 'Añadir una minifigura valorada en más de 100 euros.', bricks: 100, repetible: true },
  { id: 'holy-grail', nombre: 'Holy grail', descripcion: 'Añadir una minifigura valorada en más de 300 euros.', bricks: 500, repetible: true },
  { id: 'omgold', nombre: 'OMGold!!', descripcion: 'Añadir la minifigura COL161.', bricks: 5000, repetible: true },
  { id: 'lets-go', nombre: "Let's go!", descripcion: 'Añadir la primera minifigura de una subcategoría.', bricks: 5, repetible: true },
  { id: 'collector', nombre: 'Collector', descripcion: 'Completar el total conocido de minifiguras de una subcategoría.', bricks: 50, repetible: true },
  { id: 'step-by-step', nombre: 'Step by step', descripcion: 'Añadir la primera minifigura de una categoría.', bricks: 3, repetible: true },
  { id: 'bricky-potter', nombre: 'Bricky Potter', descripcion: 'Añadir la primera minifigura de la categoría Harry Potter.', bricks: 10, repetible: false },
  { id: 'bricky-mouse', nombre: 'Bricky Mouse', descripcion: 'Añadir la primera minifigura de la categoría Disney.', bricks: 10, repetible: false },
  { id: 'its-a-me-mario', nombre: "It's-a me, Mario!", descripcion: 'Añadir la primera minifigura de la categoría Super Mario.', bricks: 10, repetible: false },
  { id: 'green-hill-zone', nombre: 'Green Hill Zone', descripcion: 'Añadir la primera minifigura de la categoría Sonic the Hedgehog.', bricks: 10, repetible: false },
  { id: 'dimensional', nombre: 'Dimensional', descripcion: 'Añadir la primera minifigura de la categoría Dimensions.', bricks: 25, repetible: false },
  { id: 'warsie', nombre: 'Warsie', descripcion: 'Añadir la primera minifigura de la categoría Star Wars.', bricks: 10, repetible: false },
  { id: 'in-ny-i-was', nombre: 'In NY, I was', descripcion: 'Añadir la minifigura SW0465A.', bricks: 3000, repetible: false },
  { id: 'welcome-to-the-upsidedown', nombre: 'Welcome to the Upsidedown!', descripcion: 'Añadir la minifigura ST008.', bricks: 100, repetible: false },
  { id: 'chill-nancy-im-fine', nombre: "Chill, Nancy. I'm fine", descripcion: 'Añadir la minifigura ST009.', bricks: 700, repetible: false },
];

const CATEGORY_OBJECTIVES = new Map([
  ['bricky-potter', 'Harry Potter'],
  ['bricky-mouse', 'Disney'],
  ['its-a-me-mario', 'Super Mario'],
  ['green-hill-zone', 'Sonic the Hedgehog'],
  ['dimensional', 'Dimensions'],
  ['warsie', 'Star Wars'],
]);

const ID_OBJECTIVES = new Map([
  ['omgold', 'COL161'],
  ['in-ny-i-was', 'SW0465A'],
  ['welcome-to-the-upsidedown', 'ST008'],
  ['chill-nancy-im-fine', 'ST009'],
]);

function valueOf(minifigura) {
  return Number.isFinite(minifigura.precio)
    ? minifigura.precio
    : Number.isFinite(minifigura.precioCompra) ? minifigura.precioCompra : 0;
}

function countBy(catalogo, predicate) {
  return catalogo.reduce((count, item) => count + (predicate(item) ? 1 : 0), 0);
}

function categoryTotal(categorias, categoria, subcategoria) {
  const category = categorias.find((item) => item.categoria === categoria);
  if (!category) return 0;
  if (subcategoria !== undefined) {
    return category.subcategorias.find((item) => item.subcategoria === subcategoria)?.total || 0;
  }
  return category.total || 0;
}

function achievementCount(objective, catalogo, categorias) {
  switch (objective.id) {
    case 'new-mini-person':
      return catalogo.length;
    case 'woah':
      return countBy(catalogo, (item) => valueOf(item) > 10);
    case 'deal-master':
      return countBy(catalogo, (item) => valueOf(item) > 50);
    case 'masterpiece':
      return countBy(catalogo, (item) => valueOf(item) > 100);
    case 'holy-grail':
      return countBy(catalogo, (item) => valueOf(item) > 300);
    case 'omgold':
    case 'in-ny-i-was':
    case 'welcome-to-the-upsidedown':
    case 'chill-nancy-im-fine':
      return countBy(catalogo, (item) => item.id === ID_OBJECTIVES.get(objective.id));
    case 'lets-go':
      return new Set(catalogo.filter((item) => item.subcategoria !== undefined).map((item) => `${item.categoria}\u0000${item.subcategoria}`)).size;
    case 'collector': {
      const groups = new Map();
      for (const item of catalogo) {
        if (item.subcategoria === undefined) continue;
        const key = `${item.categoria}\u0000${item.subcategoria}`;
        groups.set(key, (groups.get(key) || 0) + 1);
      }
      return [...groups.entries()].filter(([key, count]) => {
        const [categoria, subcategoria] = key.split('\u0000');
        const total = categoryTotal(categorias, categoria, subcategoria);
        return total > 0 && count >= total;
      }).length;
    }
    case 'step-by-step':
      return new Set(catalogo.map((item) => item.categoria)).size;
    default: {
      const categoria = CATEGORY_OBJECTIVES.get(objective.id);
      if (!categoria) return 0;
      return catalogo.some((item) => item.categoria === categoria) ? 1 : 0;
    }
  }
}

export function selectLevel(bricks) {
  let currentIndex = 0;
  for (let index = 0; index < NIVELES.length; index += 1) {
    if (NIVELES[index].umbral <= bricks) currentIndex = index;
  }

  const nivel = NIVELES[currentIndex];
  const siguienteNivel = NIVELES[currentIndex + 1] || null;
  const intervalo = siguienteNivel ? siguienteNivel.umbral - nivel.umbral : 0;
  const porcentaje = siguienteNivel
    ? Math.round(Math.min(100, Math.max(0, ((bricks - nivel.umbral) / intervalo) * 100)))
    : 100;

  return {
    nivel,
    siguienteNivel,
    progreso: {
      actual: bricks,
      desde: nivel.umbral,
      hasta: siguienteNivel?.umbral ?? nivel.umbral,
      porcentaje,
    },
  };
}

export function calcularGamificacion(catalogo, categorias = []) {
  const catalogoColeccion = catalogo.filter((minifigura) => minifigura.estadoColeccion === 'COLECCIÓN');
  const logros = OBJETIVOS.map((objective) => {
    const cantidad = achievementCount(objective, catalogoColeccion, categorias);
    return {
      id: objective.id,
      nombre: objective.nombre,
      descripcion: objective.descripcion,
      bricks: objective.bricks,
      repetible: objective.repetible,
      cantidad,
      total: cantidad * objective.bricks,
    };
  }).filter((logro) => logro.cantidad > 0);
  const bricks = logros.reduce((total, logro) => total + logro.total, 0);
  return { bricks, ...selectLevel(bricks), logros };
}

export function nivelesAlcanzados(previous, next) {
  if (!previous || next.nivel.id <= previous.nivel.id) return [];
  return NIVELES.slice(previous.nivel.id + 1, next.nivel.id + 1);
}

export function nuevosLogros(previous, next) {
  const previousById = new Map((previous?.logros || []).map((logro) => [logro.id, logro]));
  return next.logros
    .filter((logro) => logro.cantidad > (previousById.get(logro.id)?.cantidad || 0))
    .map((logro) => ({ ...logro, cantidadNueva: logro.cantidad - (previousById.get(logro.id)?.cantidad || 0), bricksNuevos: (logro.cantidad - (previousById.get(logro.id)?.cantidad || 0)) * logro.bricks }));
}
