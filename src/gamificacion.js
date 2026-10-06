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
  { id: 'the-legend', nombre: 'The Legend.', descripcion: 'Añadir la primera minifigura de la categoría The Legend of Zelda.', bricks: 10, repetible: false },
  { id: 'heh-there-is-another-one-for-you', nombre: 'Heh! There is another one for you!', descripcion: 'Añadir la primera minifigura de la categoría Pokémon.', bricks: 10, repetible: false },
  { id: 'change-will-not-come-in-a-single-sunrise', nombre: 'Change will not come in a single sunrise.', descripcion: 'Añadir la primera minifigura de la categoría Horizon.', bricks: 10, repetible: false },
  { id: 'start-poetry', nombre: 'Start Poetry.', descripcion: 'Añadir la primera minifigura de la categoría Minecraft.', bricks: 10, repetible: false },
  { id: 'mental-breakdown', nombre: 'Mental Breakdown.', descripcion: 'Añadir la minifigura SH0129.', bricks: 3000, repetible: false },
  { id: 'the-dark-plastic', nombre: 'The Dark Plastic.', descripcion: 'Añadir la minifigura SH0002.', bricks: 1000, repetible: false },
  { id: 'concrete-savanna', nombre: 'Concrete Savanna.', descripcion: 'Añadir la minifigura SH0604.', bricks: 700, repetible: false },
  { id: 'youre-shooting-for-the-stars', nombre: "You're shooting for the stars.", descripcion: 'Añadir una minifigura que suponga el 50% del total conocido de minifiguras de una categoría.', bricks: 500, repetible: true },
  { id: 'strike', nombre: 'Strike!!', descripcion: 'Añadir una minifigura que suponga el 100% del total conocido de minifiguras de una categoría.', bricks: 1200, repetible: true },
  { id: 'retired-police', nombre: 'Retired Police', descripcion: 'Añadir la minifigura COP014S.', bricks: 50, repetible: false },
  { id: 'retired-firefighter', nombre: 'Retired Firefighter', descripcion: 'Añadir la minifigura FIREC019.', bricks: 50, repetible: false },
  { id: 'retired-doctor', nombre: 'Retired Doctor', descripcion: 'Añadir la minifigura PLN018.', bricks: 50, repetible: false },
  { id: 'trio-of-senior-citizens', nombre: 'Trio of senior citizens', descripcion: 'Tienes las minifiguras COP014S, FIREC019 y PLN018.', bricks: 300, repetible: false },
  { id: 'antiquarian', nombre: 'Antiquarian.', descripcion: 'Añadir una minifigura anterior al año 2000.', bricks: 60, repetible: true },
  { id: 'to-lay-the-groundwork', nombre: 'To lay the groundwork.', descripcion: 'Alcanzar un valor total de colección de 500€.', bricks: 500, repetible: false },
  { id: 'investor', nombre: 'Investor.', descripcion: 'Alcanzar un valor total de colección de 1000€.', bricks: 1000, repetible: false },
  { id: 'investment-fund', nombre: 'Investment fund.', descripcion: 'Alcanzar un valor total de colección de 5000€.', bricks: 5000, repetible: false },
  { id: 'almost-millionaire', nombre: 'Almost millionaire.', descripcion: 'Alcanzar un valor total de colección de 10000€.', bricks: 10000, repetible: false },
  { id: 'weirdo', nombre: 'Weirdo.', descripcion: 'Alcanza un porcentaje de Rarity Hunter superior al 50%.', bricks: 500, repetible: false },
  { id: 'hooked', nombre: 'Hooked.', descripcion: 'Alcanza un porcentaje de Collector superior al 50%.', bricks: 50, repetible: false },
  { id: 'land-ho', nombre: 'Land ho!', descripcion: 'Alcanza un porcentaje de Explorer superior al 50%.', bricks: 100, repetible: false },
  { id: 'nerd', nombre: 'Nerd.', descripcion: 'Alcanza un porcentaje de Fan superior al 50%.', bricks: 300, repetible: false },
];

export const LOGRO_REGALO = {
  id: 'someone-liked-your-collection',
  type: 'regalo',
  nombre: 'Someone liked your collection',
  descripcion: 'Has aparecido en el ranking global y te han hecho un regalo.',
  bricks: 50,
  repetible: true,
};

const CATEGORY_OBJECTIVES = new Map([
  ['bricky-potter', 'Harry Potter'],
  ['bricky-mouse', 'Disney'],
  ['its-a-me-mario', 'Super Mario'],
  ['green-hill-zone', 'Sonic the Hedgehog'],
  ['dimensional', 'Dimensions'],
  ['warsie', 'Star Wars'],
  ['the-legend', 'The Legend of Zelda'],
  ['heh-there-is-another-one-for-you', 'Pokémon'],
  ['change-will-not-come-in-a-single-sunrise', 'Horizon'],
  ['start-poetry', 'Minecraft'],
]);

const ID_OBJECTIVES = new Map([
  ['omgold', 'COL161'],
  ['in-ny-i-was', 'SW0465A'],
  ['welcome-to-the-upsidedown', 'ST008'],
  ['chill-nancy-im-fine', 'ST009'],
  ['mental-breakdown', 'SH0129'],
  ['the-dark-plastic', 'SH0002'],
  ['concrete-savanna', 'SH0604'],
  ['retired-police', 'COP014S'],
  ['retired-firefighter', 'FIREC019'],
  ['retired-doctor', 'PLN018'],
]);

export const DNA_PONDERACIONES = new Map(Object.entries({
  'new-mini-person': [0, 80, 10, 10],
  woah: [50, 20, 10, 20],
  'deal-master': [80, 10, 0, 10],
  masterpiece: [90, 5, 0, 5],
  'holy-grail': [80, 10, 0, 10],
  omgold: [95, 5, 0, 0],
  'lets-go': [0, 5, 90, 5],
  collector: [5, 90, 0, 5],
  'step-by-step': [5, 45, 50, 0],
  'bricky-potter': [0, 10, 20, 70],
  'bricky-mouse': [0, 10, 20, 70],
  'its-a-me-mario': [0, 10, 20, 70],
  'green-hill-zone': [0, 10, 20, 70],
  dimensional: [60, 10, 20, 10],
  warsie: [0, 10, 20, 70],
  'in-ny-i-was': [80, 10, 0, 10],
  'welcome-to-the-upsidedown': [60, 30, 0, 10],
  'chill-nancy-im-fine': [80, 10, 0, 10],
  'the-legend': [0, 10, 20, 70],
  'heh-there-is-another-one-for-you': [0, 10, 20, 70],
  'change-will-not-come-in-a-single-sunrise': [0, 10, 20, 70],
  'start-poetry': [0, 10, 20, 70],
  'mental-breakdown': [90, 5, 0, 5],
  'the-dark-plastic': [90, 5, 0, 5],
  'concrete-savanna': [90, 5, 0, 5],
  'youre-shooting-for-the-stars': [20, 40, 0, 40],
  strike: [20, 40, 0, 40],
  'retired-police': [90, 5, 5, 0],
  'retired-firefighter': [90, 5, 5, 0],
  'retired-doctor': [90, 5, 5, 0],
  'trio-of-senior-citizens': [90, 5, 0, 5],
  antiquarian: [80, 10, 0, 10],
  'to-lay-the-groundwork': [50, 50, 0, 0],
  investor: [50, 50, 0, 0],
  'investment-fund': [50, 50, 0, 0],
  'almost-millionaire': [50, 50, 0, 0],
  weirdo: [100, 0, 0, 0],
  hooked: [0, 100, 0, 0],
  'land-ho': [0, 0, 100, 0],
  nerd: [0, 0, 0, 100],
  'someone-liked-your-collection': [0, 0, 0, 0],
}));

const DNA_THRESHOLD_OBJECTIVES = new Map([
  ['weirdo', 'rarityHunter'],
  ['hooked', 'collector'],
  ['land-ho', 'explorer'],
  ['nerd', 'fan'],
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

function dnaPercentages(catalogo, categorias) {
  const scores = { rarityHunter: 0, collector: 0, explorer: 0, fan: 0 };
  let total = 0;
  for (const objective of OBJETIVOS) {
    if (DNA_THRESHOLD_OBJECTIVES.has(objective.id)) continue;
    const count = achievementCount(objective, catalogo, categorias);
    const [rarityHunter, collector, explorer, fan] = DNA_PONDERACIONES.get(objective.id);
    scores.rarityHunter += count * rarityHunter;
    scores.collector += count * collector;
    scores.explorer += count * explorer;
    scores.fan += count * fan;
    total += count * (rarityHunter + collector + explorer + fan);
  }
  return Object.fromEntries(Object.entries(scores).map(([trait, score]) => [trait, total === 0 ? 0 : score * 100 / total]));
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
    case 'mental-breakdown':
    case 'the-dark-plastic':
    case 'concrete-savanna':
      return catalogo.some((item) => item.id === ID_OBJECTIVES.get(objective.id)) ? 1 : 0;
    case 'retired-police':
    case 'retired-firefighter':
    case 'retired-doctor':
      return catalogo.some((item) => item.id.toUpperCase() === ID_OBJECTIVES.get(objective.id)) ? 1 : 0;
    case 'trio-of-senior-citizens': {
      const seniorCitizens = new Set(['COP014S', 'FIREC019', 'PLN018']);
      return seniorCitizens.size === new Set(catalogo.map((item) => item.id.toUpperCase()).filter((id) => seniorCitizens.has(id))).size ? 1 : 0;
    }
    case 'antiquarian':
      return countBy(catalogo, (item) => Number.isInteger(item.anio) && item.anio < 2000);
    case 'to-lay-the-groundwork':
    case 'investor':
    case 'investment-fund':
    case 'almost-millionaire': {
      const threshold = {
        'to-lay-the-groundwork': 500,
        investor: 1000,
        'investment-fund': 5000,
        'almost-millionaire': 10000,
      }[objective.id];
      return catalogo.reduce((total, item) => total + valueOf(item), 0) >= threshold ? 1 : 0;
    }
    case 'weirdo':
    case 'hooked':
    case 'land-ho':
    case 'nerd':
      return dnaPercentages(catalogo, categorias)[DNA_THRESHOLD_OBJECTIVES.get(objective.id)] > 50 ? 1 : 0;
    case 'youre-shooting-for-the-stars':
    case 'strike': {
      const groups = new Map();
      for (const item of catalogo) {
        groups.set(item.categoria, (groups.get(item.categoria) || 0) + 1);
      }
      const fraction = objective.id === 'strike' ? 1 : 0.5;
      return [...groups.entries()].filter(([categoria, count]) => {
        const total = categoryTotal(categorias, categoria);
        return total > 0 && count >= total * fraction;
      }).length;
    }
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

export function calcularGamificacion(catalogo, categorias = [], regalosRecibidos = 0) {
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
  if (Number.isInteger(regalosRecibidos) && regalosRecibidos > 0) {
    logros.push({ ...LOGRO_REGALO, cantidad: regalosRecibidos, total: regalosRecibidos * LOGRO_REGALO.bricks });
  }
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
