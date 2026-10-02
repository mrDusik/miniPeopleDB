const form = document.querySelector('#filters-form');
const showAllButton = document.querySelector('#show-all');
const statusMessage = document.querySelector('#status');
const resultCount = document.querySelector('#result-count');
const catalogBody = document.querySelector('#catalog-body');
const previousPageButton = document.querySelector('#previous-page');
const nextPageButton = document.querySelector('#next-page');
const pageStatus = document.querySelector('#page-status');
const newMinifiguraButton = document.querySelector('#new-minifigura');
const syncPricesButton = document.querySelector('#sync-prices');
const collectionTotal = document.querySelector('#collection-total');
const collectionCount = document.querySelector('#collection-count');
const wantedCount = document.querySelector('#wanted-count');
const topFiveList = document.querySelector('#top-five-list');
const oldestFiveList = document.querySelector('#oldest-five-list');
const watchlistList = document.querySelector('#watchlist-list');
const watchlistTitle = document.querySelector('#watchlist-title');
const idFilterInput = document.querySelector('#id');
const nameFilterInput = document.querySelector('#nombre');
const categoriaInput = document.querySelector('#categoria');
const subcategoriaInput = document.querySelector('#subcategoria');
const anioInput = document.querySelector('#anio');
const collectionFilterInput = document.querySelector('#filter-coleccion');
const wantedFilterInput = document.querySelector('#filter-buscada');
const observedFilterInput = document.querySelector('#observada');
const currentYear = new Date().getFullYear();
const maxWatchlistItems = 10;
const sortButtons = [...document.querySelectorAll('[data-sort]')];
const controls = [...form.querySelectorAll('input, select, button'), syncPricesButton];

const formDialog = document.querySelector('#form-dialog');
const firstMinifiguraDialog = document.querySelector('#first-minifigura-dialog');
const firstMinifiguraAccept = document.querySelector('#first-minifigura-accept');
const firstMinifiguraTitle = document.querySelector('#first-minifigura-title');
const minifiguraForm = document.querySelector('#minifigura-form');
const formDialogTitle = document.querySelector('#form-dialog-title');
const formError = document.querySelector('#form-error');
const formSubmitButton = document.querySelector('#form-submit');
const formCancelButton = document.querySelector('#form-cancel');
const formIdInput = document.querySelector('#form-id');
const formNombreInput = document.querySelector('#form-nombre');
const formDescripcionInput = document.querySelector('#form-descripcion');
const formCategoriaInput = document.querySelector('#form-categoria');
const formSubcategoriaInput = document.querySelector('#form-subcategoria');
const formAnioInput = document.querySelector('#form-anio');
const formEstadoInput = document.querySelector('#form-estadoColeccion');
const formStateToggleButtons = [...document.querySelectorAll('[data-form-state]')];
const formPrecioCompraInput = document.querySelector('#form-precioCompra');
const formFechaCompraInput = document.querySelector('#form-fechaCompra');
const formPrecioInput = document.querySelector('#form-precio');
const formObservedButton = document.querySelector('#form-observada');
const formPreviewImage = document.querySelector('#form-preview-image');

const deleteDialog = document.querySelector('#delete-dialog');
const deleteMessage = document.querySelector('#delete-message');
const deleteConfirmButton = document.querySelector('#delete-confirm');
const deleteCancelButton = document.querySelector('#delete-cancel');

const imageModal = document.querySelector('#image-modal');
const imageModalTitle = document.querySelector('#image-modal-title');
const imageModalName = document.querySelector('#image-modal-name');
const imageModalImage = document.querySelector('#image-modal-image');
const imageModalCloseButton = document.querySelector('#image-modal-close');

const toastRegion = document.querySelector('#toast-region');
const gamificationLevelButton = document.querySelector('#gamification-level');
const gamificationToggleButton = document.querySelector('#gamification-toggle');
const gamificationDetails = document.querySelector('#gamification-details');
const syncProgress = document.querySelector('#sync-progress');
const syncProgressBar = document.querySelector('#sync-progress-bar');
const syncProgressLabel = document.querySelector('#sync-progress-label');
const gamificationTitle = document.querySelector('#gamification-title');
const gamificationLevelImage = document.querySelector('.gamification-level-image');
const gamificationLevelTooltip = document.createElement('div');
const gamificationLevelTooltipImage = document.createElement('img');
const gamificationLevelNumber = document.querySelector('#gamification-level-number');
const gamificationLevelName = document.querySelector('#gamification-level-name');
const gamificationBricks = document.querySelector('#gamification-bricks');
const gamificationProgress = document.querySelector('#gamification-progress');

function showLevelImageTooltip() {
  gamificationLevelTooltip.style.display = 'block';
}

function hideLevelImageTooltip() {
  gamificationLevelTooltip.style.display = 'none';
}

gamificationLevelTooltip.className = 'gamification-level-tooltip';
gamificationLevelTooltipImage.className = 'gamification-level-tooltip-image';
gamificationLevelTooltipImage.alt = 'Vista ampliada del nivel';
gamificationLevelTooltip.append(gamificationLevelTooltipImage);
gamificationTitle.append(gamificationLevelTooltip);
gamificationLevelTooltip.style.display = 'none';
gamificationLevelImage.addEventListener('mouseenter', showLevelImageTooltip);
gamificationLevelImage.addEventListener('mouseleave', hideLevelImageTooltip);
gamificationLevelImage.addEventListener('focus', showLevelImageTooltip);
gamificationLevelImage.addEventListener('blur', hideLevelImageTooltip);
const gamificationPercentage = document.querySelector('#gamification-percentage');
const gamificationNext = document.querySelector('#gamification-next');
const gamificationDialog = document.querySelector('#gamification-dialog');
const gamificationDialogLevel = document.querySelector('#gamification-dialog-level');
const achievementsOpenButton = document.querySelector('#open-achievements');
const achievementsHeadingImage = document.querySelector('.achievements-heading-icon');
const gamificationAchievements = document.querySelector('#gamification-achievements');
const gamificationCloseButton = document.querySelector('#gamification-close');
const rankingDialog = document.querySelector('#ranking-dialog');
const rankingCloseButton = document.querySelector('#ranking-close');
const rankingOpenButton = document.querySelector('#open-global-ranking');
const rankingStatus = document.querySelector('#ranking-status');
const globalRankingList = document.querySelector('#global-ranking-list');
const rankingMainGlobe = document.querySelector('#ranking-main-globe');

const pageShell = document.querySelector('.page-shell');
const authScreen = document.querySelector('#auth-screen');
const authMessage = document.querySelector('#auth-message');
const loginButton = document.querySelector('#login-google');
const logoutButton = document.querySelector('#logout');
const userName = document.querySelector('#user-name');
const userProfile = document.querySelector('#user-profile');
const userMenuToggle = document.querySelector('#user-menu-toggle');
const userSession = document.querySelector('.user-session');
const userAvatar = document.querySelector('#user-avatar');
userAvatar.addEventListener('error', () => {
  userAvatar.hidden = true;
});
const SESSION_EXPIRED_MESSAGE = 'Tu sesión ha caducado. Inicia sesión de nuevo.';

const ERROR_MESSAGES = {
  ID_INVALIDO: 'El ID proporcionado no tiene un formato válido.',
  MINIFIGURA_INVALIDA: 'Los datos de la minifigura no son válidos.',
  ID_DUPLICADO: 'Ya existe una minifigura con ese id.',
  MINIFIGURA_NO_ENCONTRADA: 'La minifigura ya no existe.',
  CATALOGO_NO_DISPONIBLE: 'El catálogo no está disponible en este momento.',
  CATALOGO_INVALIDO: 'El catálogo no tiene un formato válido.',
  CATEGORIAS_NO_DISPONIBLES: 'El catálogo de categorías no está disponible en este momento.',
  CATEGORIAS_INVALIDOS: 'El catálogo de categorías no tiene un formato válido.',
};

let requestSequence = 0;
let activeFilters = {};
let catalogCache = [];
let currentCatalog = [];
let currentEditId = null;
let currentFormMode = null;
let formSynced = false;
let imageLookupSequence = 0;
let pendingDeleteId = null;
let activeSort = { field: null, direction: 'asc' };
let isSyncingPrices = false;
let officialCategorias = [];
let subcategoriasPorCategoria = new Map();
let categoriasReady = false;
let catalogForOptions = [];
let hasLoadedFullCatalog = false;
const pageSize = 10;
let currentPage = 1;
let achievementQueue = [];
let isShowingAchievement = false;
let supabaseClient = null;
let currentSession = null;
let appStarted = false;
let syncPollTimer = null;
let syncPausedByModal = false;
let rankingEntries = [];
let expandedRankingUserId = null;

anioInput.max = String(currentYear);
formAnioInput.max = String(currentYear);

function renderSubcategoryOptions(selectElement, categoria, placeholderText) {
  const previousValue = selectElement.value;
  const subcategorias = [...new Map(
    (categoria ? catalogForOptions : [])
      .filter((minifigura) => minifigura.categoria === categoria)
      .filter((minifigura) => minifigura.subcategoria)
      .map((minifigura) => [minifigura.subcategoria, 0]),
  ).keys()];
  const counts = new Map(subcategorias.map((subcategoria) => [subcategoria, catalogForOptions.filter((minifigura) => (
    minifigura.subcategoria === subcategoria && (!categoria || minifigura.categoria === categoria)
  )).length]));
  selectElement.replaceChildren(new Option(`${placeholderText} (${catalogForOptions.filter((minifigura) => !categoria || minifigura.categoria === categoria).length})`, ''));
  for (const subcategoria of subcategorias.sort()) {
    selectElement.append(new Option(`${subcategoria} (${counts.get(subcategoria)})`, subcategoria));
  }
  selectElement.value = subcategorias.includes(previousValue) ? previousValue : '';
  selectElement.disabled = !categoriasReady || subcategorias.length === 0;
}

function renderCategoryOptions(categorias) {
  const categoryCounts = new Map();
  for (const minifigura of catalogForOptions) {
    categoryCounts.set(minifigura.categoria, (categoryCounts.get(minifigura.categoria) ?? 0) + 1);
  }
  const categoryNames = [...categoryCounts.keys()].sort();

  const selectedCategoria = categoriaInput.value;
  categoriaInput.replaceChildren(new Option(`Todas (${catalogForOptions.length})`, ''));
  for (const categoria of categoryNames) {
    categoriaInput.append(new Option(`${categoria} (${categoryCounts.get(categoria)})`, categoria));
  }
  categoriaInput.value = categoryNames.includes(selectedCategoria) ? selectedCategoria : '';
  renderSubcategoryOptions(subcategoriaInput, categoriaInput.value, 'Todas');
}

function renderDynamicFilterOptions(catalog) {
  catalogForOptions = catalog;
  renderCategoryOptions(officialCategorias);
}

function setCategoriaControlsEnabled(enabled) {
  categoriaInput.disabled = !enabled;
  renderSubcategoryOptions(subcategoriaInput, categoriaInput.value, 'Todas');
  newMinifiguraButton.disabled = !enabled;
  syncPricesButton.disabled = !enabled || isSyncingPrices;
}

categoriaInput.addEventListener('change', () => {
  renderSubcategoryOptions(subcategoriaInput, categoriaInput.value, 'Todas');
});

async function loadCategorias() {
  try {
    const response = await fetch('/categorias');
    if (!response.ok) {
      throw new Error('CATEGORIAS_NO_DISPONIBLES');
    }
    const categorias = await response.json();
    if (!Array.isArray(categorias) || categorias.length === 0 || categorias.some((categoria) => (
      categoria === null
      || typeof categoria !== 'object'
      || Array.isArray(categoria)
      || Object.keys(categoria).length !== 3
      || !Object.hasOwn(categoria, 'categoria')
      || !Object.hasOwn(categoria, 'total')
      || !Object.hasOwn(categoria, 'subcategorias')
      || typeof categoria.categoria !== 'string'
      || categoria.categoria !== categoria.categoria.trim()
      || categoria.categoria === ''
      || !Number.isInteger(categoria.total)
      || categoria.total < 0
      || !Array.isArray(categoria.subcategorias)
      || categoria.subcategorias.some((subcategoria) => (
        subcategoria === null
        || typeof subcategoria !== 'object'
        || Array.isArray(subcategoria)
        || typeof subcategoria.subcategoria !== 'string'
        || subcategoria.subcategoria.trim() === ''
        || (subcategoria.total !== undefined && (!Number.isInteger(subcategoria.total) || subcategoria.total < 0))
      ))
    ))) {
      throw new Error('CATEGORIAS_INVALIDOS');
    }
    const normalizedCategorias = categorias.map(({ categoria }) => categoria.trim().normalize('NFKC').toLocaleLowerCase());
    if (new Set(normalizedCategorias).size !== normalizedCategorias.length) {
      throw new Error('CATEGORIAS_INVALIDOS');
    }
    officialCategorias = categorias;
    subcategoriasPorCategoria = new Map(categorias.map(({ categoria, subcategorias }) => [categoria, subcategorias.map(({ subcategoria }) => subcategoria)]));
    renderCategoryOptions(officialCategorias);
    categoriasReady = true;
    setCategoriaControlsEnabled(true);
    return true;
  } catch (error) {
    categoriasReady = false;
    officialCategorias = [];
    subcategoriasPorCategoria = new Map();
    setCategoriaControlsEnabled(false);
    setStatus(messageForErrorCode(error.message), 'error');
    return false;
  }
}

function setStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.className = type ? `status ${type}` : 'status';
}

function cell(value) {
  const element = document.createElement('td');
  element.textContent = value ?? '';
  return element;
}

function formatPrice(value) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)
    : 'Sin precio';
}

function priceCell(value) {
  return cell(formatPrice(value));
}

function normalizedCollectionState(value) {
  return typeof value === 'string'
    ? value.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : value;
}

function collectionStateIconSource(value) {
  const state = normalizedCollectionState(value);
  return state === 'COLECCION' ? '/status_images/caja.png' : state === 'BUSCADA' ? '/status_images/lupa.png' : null;
}

function appendCollectionStateIcon(element, value) {
  const source = collectionStateIconSource(value);
  if (!source) {
    element.textContent = value ?? '';
    return;
  }

  const image = document.createElement('img');
  image.className = 'status-icon-image';
  image.src = source;
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  element.append(image);
}

function collectionStateMeaning(value) {
  const state = normalizedCollectionState(value);
  return state === 'COLECCION' ? 'Colección' : state === 'BUSCADA' ? 'Búsqueda' : String(value ?? '');
}

function differenceCell(minifigura) {
  const element = document.createElement('td');
  const difference = document.createElement('span');
  const state = normalizedCollectionState(minifigura.estadoColeccion);

  if (state === 'BUSCADA') {
    difference.textContent = 'N/A';
  } else if (!Number.isFinite(minifigura.precio) || !Number.isFinite(minifigura.precioCompra)) {
    difference.textContent = '?';
  } else {
    const value = minifigura.precio - minifigura.precioCompra;
    difference.textContent = formatPrice(value);
    difference.className = value > 0 ? 'difference-positive' : value < 0 ? 'difference-negative' : 'difference-neutral';
  }

  element.append(difference);
  return element;
}

function rankingCard(minifigura, position, detail, interactive = true) {
  const card = document.createElement(interactive ? 'button' : 'span');
  if (interactive) card.type = 'button';
  card.className = 'ranking-card';
  if (interactive) {
    card.dataset.action = 'view';
    card.dataset.id = minifigura.id;
  } else {
    card.classList.add('ranking-card-static');
  }
  card.title = `${minifigura.id} - ${minifigura.nombre ?? ''}`;

  const image = createLazyImage({ src: imagenUrlPara(minifigura.id), alt: minifigura.nombre, width: 48, height: 48, className: 'ranking-img' });

  const caption = document.createElement('span');
  caption.className = 'ranking-caption';
  caption.textContent = `#${position} - ${detail}`;

  card.append(image, caption);
  return card;
}

function levelImagePath(levelId) {
  const images = {
    3: '/level_images/3_threesevenfive.png',
    4: '/level_images/4_citizen.png',
    5: '/level_images/5_skeleton.png',
    6: '/level_images/6_pirate.png',
    7: '/level_images/7_captain.png',
    8: '/level_images/8_redbearb.png',
    9: '/level_images/9_forestman.png',
    10: '/level_images/10_wolfpack.png',
    11: '/level_images/11_wolfpackmaster.png',
    12: '/level_images/12_ninja.png',
    13: '/level_images/13_rx.png',
    14: '/level_images/14_dragonform.png',
    15: '/level_images/15_spacebaby.jpg',
    16: '/level_images/16_spaceman.jpg',
    17: '/level_images/17_blacktron.png',
  };
  return images[levelId] || '/level_images/9_forestman.png';
}

function renderTopFive(topFive) {
  const fragment = document.createDocumentFragment();
  topFive.forEach((minifigura, index) => {
    fragment.append(rankingCard(minifigura, index + 1, formatPrice(minifigura.precio)));
  });
  topFiveList.replaceChildren(fragment);
}

function renderOldestFive(oldestFive) {
  const fragment = document.createDocumentFragment();
  oldestFive.forEach((minifigura, index) => {
    fragment.append(rankingCard(minifigura, index + 1, minifigura.anio));
  });
  oldestFiveList.replaceChildren(fragment);
}

function renderWatchlist(observed) {
  const fragment = document.createDocumentFragment();
  watchlistTitle.textContent = `Seguimiento (${observed.length} / ${maxWatchlistItems})`;
  for (const minifigura of observed) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'watchlist-card';
    card.dataset.action = 'view';
    card.dataset.id = minifigura.id;
    card.title = `${minifigura.id} - ${minifigura.nombre ?? ''}`;
    const image = createLazyImage({ src: imagenUrlPara(minifigura.id), alt: minifigura.nombre, width: 128, height: 112 });
    const caption = document.createElement('span');
    const stateIcon = document.createElement('span');
    stateIcon.className = 'watchlist-state-icon';
    appendCollectionStateIcon(stateIcon, minifigura.estadoColeccion);
    stateIcon.title = collectionStateMeaning(minifigura.estadoColeccion);
    caption.append(stateIcon, document.createTextNode(` ${minifigura.id} ${formatPrice(minifigura.precioBrickset)}`));
    card.append(image, caption);
    fragment.append(card);
  }
  watchlistList.replaceChildren(fragment);
}

function sortCatalog(catalog) {
  if (!activeSort.field) {
    return catalog
      .map((minifigura, index) => ({ minifigura, index }))
      .sort((left, right) => {
        const leftDate = Date.parse(left.minifigura.FechaRegistro ?? '');
        const rightDate = Date.parse(right.minifigura.FechaRegistro ?? '');
        if (rightDate !== leftDate) {
          return (Number.isNaN(rightDate) ? -Infinity : rightDate) - (Number.isNaN(leftDate) ? -Infinity : leftDate);
        }
        return left.index - right.index;
      })
      .map(({ minifigura }) => minifigura);
  }

  const direction = activeSort.direction === 'asc' ? 1 : -1;
  const sortValue = (minifigura) => {
    if (activeSort.field !== 'diferencia') return minifigura[activeSort.field];
    if (normalizedCollectionState(minifigura.estadoColeccion) === 'BUSCADA'
      || !Number.isFinite(minifigura.precio)
      || !Number.isFinite(minifigura.precioCompra)) return undefined;
    return minifigura.precio - minifigura.precioCompra;
  };

  return [...catalog].sort((left, right) => {
    const leftValue = sortValue(left);
    const rightValue = sortValue(right);
    const leftMissing = !Number.isFinite(leftValue);
    const rightMissing = !Number.isFinite(rightValue);
    if (leftMissing || rightMissing) {
      return leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1;
    }
    return (leftValue - rightValue) * direction;
  });
}

function badgeClassFor(value) {
  if (value === 'COLECCIÓN') {
    return 'badge-coleccion';
  }
  return 'badge-otro';
}

function badgeCell(value) {
  const element = document.createElement('td');
  const badge = document.createElement('span');
  const state = normalizedCollectionState(value);
  badge.className = `badge ${badgeClassFor(value)}`;
  badge.title = collectionStateMeaning(value);
  badge.setAttribute('aria-label', collectionStateMeaning(value));
  appendCollectionStateIcon(badge, value);
  element.append(badge);
  return element;
}

function imagenUrlPara(id) {
  return `https://img.bricklink.com/ItemImage/MN/0/${encodeURIComponent(String(id).toLowerCase())}.png`;
}

function createLazyImage({ src, alt, width, height, className = '' }) {
  const image = document.createElement('img');
  if (className) image.className = className;
  image.alt = alt ?? '';
  // Set before src so the browser defers the request.
  image.setAttribute('loading', 'lazy');
  image.setAttribute('decoding', 'async');
  image.setAttribute('width', String(width));
  image.setAttribute('height', String(height));
  image.addEventListener('error', () => { image.style.display = 'none'; });
  image.src = src;
  return image;
}

function thumbCell(minifigura) {
  const element = document.createElement('td');
  const thumb = createLazyImage({ src: imagenUrlPara(minifigura.id), alt: minifigura.nombre, width: 40, height: 40, className: 'table-thumb' });
  thumb.dataset.action = 'preview';
  thumb.dataset.id = minifigura.id;
  element.append(thumb);
  return element;
}

function idCell(minifigura) {
  const element = document.createElement('td');
  const link = document.createElement('button');
  link.type = 'button';
  link.className = 'id-link';
  link.textContent = minifigura.id;
  link.dataset.action = 'view';
  link.dataset.id = minifigura.id;
  link.setAttribute('aria-label', `Ver ${minifigura.id}`);
  element.append(link);
  return element;
}

function observedCell(minifigura) {
  const element = document.createElement('td');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `eye-icon ${minifigura.observada ? 'active' : 'inactive'}`;
  button.textContent = '👁️';
  button.title = 'Seguimiento';
  button.setAttribute('aria-label', minifigura.observada ? 'Dejar de observar' : 'Observar');
  button.setAttribute('aria-pressed', String(Boolean(minifigura.observada)));
  button.dataset.action = 'observe';
  button.dataset.id = minifigura.id;
  element.append(button);
  return element;
}

function actionsCell(minifigura) {
  const element = document.createElement('td');
  element.className = 'actions-cell';
  const actions = document.createElement('div');
  actions.className = 'actions-buttons';

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.className = 'button button-secondary button-small button-icon';
  editButton.setAttribute('aria-label', 'Editar');
  editButton.title = 'Editar';
  editButton.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 20h4L18.5 9.5a2.121 2.121 0 0 0-3-3L5 17v3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  editButton.dataset.action = 'edit';
  editButton.dataset.id = minifigura.id;

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'button button-danger button-small button-icon';
  deleteButton.setAttribute('aria-label', 'Eliminar');
  deleteButton.title = 'Eliminar';
  deleteButton.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.id = minifigura.id;

  actions.append(editButton, deleteButton);
  element.append(actions);
  return element;
}

function normalizeClientText(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : '';
}

// Mirrors matchesFilters in src/minifiguras-repository.js.
function matchesClientFilters(minifigura, filters) {
  if (filters.categoria && normalizeClientText(minifigura.categoria) !== normalizeClientText(filters.categoria)) return false;
  if (filters.subcategoria && normalizeClientText(minifigura.subcategoria) !== normalizeClientText(filters.subcategoria)) return false;
  if (filters.nombre && !normalizeClientText(minifigura.nombre).includes(normalizeClientText(filters.nombre))) return false;
  if (filters.id && !normalizeClientText(minifigura.id).includes(normalizeClientText(filters.id))) return false;
  if (filters.anio && minifigura.anio !== Number(filters.anio)) return false;
  if (filters.estadoColeccion && normalizeClientText(minifigura.estadoColeccion) !== normalizeClientText(filters.estadoColeccion)) return false;
  if (filters.observada && Boolean(minifigura.observada) !== (filters.observada === 'true')) return false;
  return true;
}

function applyFilters({ preservePage = false } = {}) {
  currentCatalog = catalogCache.filter((minifigura) => matchesClientFilters(minifigura, activeFilters));
  if (!preservePage) currentPage = 1;
  renderCatalogPage();
}

function setCatalogCache(catalog) {
  const wasEmpty = hasLoadedFullCatalog && catalogCache.length === 0;
  hasLoadedFullCatalog = true;
  catalogCache = catalog;
  renderDynamicFilterOptions(catalog);
  for (const button of document.querySelectorAll('.rankings-panel .panel-toggle, .watchlist-panel .panel-toggle')) {
    if (catalog.length === 0) setPanelCollapsed(button, true);
    else if (wasEmpty) setPanelCollapsed(button, false);
  }
}

function upsertCached(minifigura) {
  const { gamificacion, ...stored } = minifigura;
  const exists = catalogCache.some((item) => item.id === stored.id);
  setCatalogCache(exists
    ? catalogCache.map((item) => (item.id === stored.id ? stored : item))
    : [...catalogCache, stored]);
}

function removeCached(id) {
  setCatalogCache(catalogCache.filter((item) => item.id !== id));
}

function renderCatalogPage() {
  resultCount.textContent = `${currentCatalog.length} ${currentCatalog.length === 1 ? 'figura' : 'figuras'}`;
  const sortedCatalog = sortCatalog(currentCatalog);
  const totalPages = Math.max(1, Math.ceil(sortedCatalog.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const fragment = document.createDocumentFragment();

  for (const minifigura of sortedCatalog.slice(pageStart, pageStart + pageSize)) {
    const row = document.createElement('tr');
    row.append(
      thumbCell(minifigura),
      observedCell(minifigura),
      idCell(minifigura),
      cell(minifigura.nombre),
      cell(minifigura.categoria),
      cell(minifigura.subcategoria),
      cell(minifigura.anio),
      badgeCell(minifigura.estadoColeccion),
      priceCell(minifigura.precio),
      differenceCell(minifigura),
      actionsCell(minifigura),
    );
    fragment.append(row);
  }
  catalogBody.replaceChildren(fragment);
  pageStatus.textContent = `Página ${currentPage} de ${totalPages}`;
  previousPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage === totalPages;

  if (currentCatalog.length === 0) {
    setStatus(hasLoadedFullCatalog && catalogForOptions.length === 0
      ? 'No hay ninguna minifigura registrada en tu cuenta.'
      : 'No hay minifiguras que coincidan con la consulta.');
  } else {
    setStatus('Catálogo actualizado.');
  }
}

function setLoading(isLoading) {
  controls.forEach((control) => { control.disabled = isLoading; });
  previousPageButton.disabled = isLoading;
  nextPageButton.disabled = isLoading;
  if (isLoading) {
    setStatus('Cargando catálogo...');
  } else if (currentCatalog.length > 0) {
    renderCatalogPage();
  }
}

function showSyncProgress(state) {
  isSyncingPrices = state.estado === 'en_curso';
  syncPricesButton.disabled = isSyncingPrices || !categoriasReady;
  syncProgress.hidden = !isSyncingPrices;
  if (isSyncingPrices) {
    syncProgressBar.max = state.total;
    syncProgressBar.value = state.procesados;
    syncProgressLabel.textContent = `Actualizando precios: ${state.procesados} / ${state.total}`;
  }
}

async function finishSync(state) {
  if (syncPollTimer !== null) {
    clearTimeout(syncPollTimer);
    syncPollTimer = null;
  }
  isSyncingPrices = false;
  syncProgress.hidden = true;
  syncPricesButton.disabled = !categoriasReady;
  await revalidate();
  showToast(`Actualización de precios terminada: ${state.actualizados.length} actualizadas, ${state.fallidos.length} fallidas.`, 'success');
}

function scheduleSyncPoll() {
  if (syncPollTimer === null) {
    syncPollTimer = setTimeout(pollSync, 2000);
  }
}

async function pollSync() {
  syncPollTimer = null;
  try {
    const response = await apiFetch('/sincronizacion/brickset');
    if (!response.ok) throw new Error('SYNC_STATUS_ERROR');
    const state = await response.json();
    if (state.estado === 'en_curso') {
      showSyncProgress(state);
      scheduleSyncPoll();
    } else if (state.estado === 'completada') {
      await finishSync(state);
    }
  } catch {
    if (isSyncingPrices) scheduleSyncPoll();
  }
}

async function startSync() {
  syncPricesButton.disabled = true;
  try {
    const response = await apiFetch('/sincronizacion/brickset', { method: 'POST' });
    const state = await response.json();
    if (!response.ok) throw new Error(state.error ?? 'BRICKSET_NO_DISPONIBLE');
    if (state.estado === 'en_curso') {
      showSyncProgress(state);
      scheduleSyncPoll();
    } else {
      await finishSync(state);
    }
  } catch {
    isSyncingPrices = false;
    syncProgress.hidden = true;
    syncPricesButton.disabled = !categoriasReady;
    showToast('No se pudieron actualizar los precios desde Brickset.', 'error');
  }
}

async function fetchCatalog() {
  const response = await apiFetch('/minifiguras');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const catalog = await response.json();
  if (!Array.isArray(catalog)) {
    throw new Error('Respuesta invalida');
  }
  return catalog;
}

async function loadCatalog() {
  const currentRequest = ++requestSequence;
  setLoading(true);
  let catalog;
  try {
    catalog = await fetchCatalog();
  } catch {
    if (currentRequest === requestSequence) {
      catalogBody.replaceChildren();
      resultCount.textContent = '';
      categoriasReady = false;
      officialCategorias = [];
      setStatus('No se pudo cargar el catálogo. Inténtalo de nuevo.', 'error');
      setLoading(false);
      setCategoriaControlsEnabled(false);
    }
    return undefined;
  }
  if (currentRequest !== requestSequence) return undefined;
  setCatalogCache(catalog);
  applyFilters();
  setLoading(false);
  setCategoriaControlsEnabled(!isSyncingPrices && categoriasReady);
  await Promise.all([loadTotal(), loadGamification(), loadGlobalRanking({ showState: false })]);
  return catalog;
}

// Keeps the locally applied state if the catalog cannot be refreshed.
async function revalidate() {
  const currentRequest = ++requestSequence;
  await Promise.all([
    fetchCatalog()
      .then((catalog) => {
        if (currentRequest !== requestSequence) return;
        setCatalogCache(catalog);
        applyFilters({ preservePage: true });
      })
      .catch(() => {}),
    loadTotal(),
    loadGamification(),
    loadGlobalRanking({ showState: false }),
  ]);
}

async function loadTotal() {
  try {
    const response = await apiFetch('/valoracion');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const summary = await response.json();
    collectionTotal.textContent = formatPrice(summary.total ?? 0);
    collectionCount.textContent = `${summary.enColeccion ?? 0}`;
    wantedCount.textContent = `${summary.buscadas ?? 0}`;
    renderTopFive(Array.isArray(summary.top5) ? summary.top5 : []);
    renderOldestFive(Array.isArray(summary.top5Antiguas) ? summary.top5Antiguas : []);
    renderWatchlist(Array.isArray(summary.observadas) ? summary.observadas : []);
  } catch {
    collectionTotal.textContent = 'No disponible';
    collectionCount.textContent = '0';
    wantedCount.textContent = '0';
    renderTopFive([]);
    renderOldestFive([]);
    renderWatchlist([]);
  }
}

function renderGamification(state) {
  const level = state.nivel ?? { id: 0, nombre: 'Duplo' };
  const imagePath = levelImagePath(level.id);
  gamificationLevelImage.src = imagePath;
  gamificationLevelTooltipImage.src = imagePath;
  achievementsHeadingImage.src = imagePath;
  gamificationLevelTooltipImage.alt = `Nivel ${level.id} ${level.nombre}`;
  gamificationLevelNumber.textContent = level.id;
  gamificationLevelName.textContent = level.nombre;
  gamificationDialogLevel.textContent = `${level.id} ${level.nombre}`;
  gamificationBricks.textContent = `${state.bricks ?? 0} Bricks`;
  gamificationProgress.value = state.progreso?.porcentaje ?? 0;
  gamificationPercentage.textContent = `${Math.round(gamificationProgress.value)}%`;
  gamificationPercentage.classList.toggle('on-accent', gamificationProgress.value >= 50);
  gamificationProgress.setAttribute('aria-valuetext', `${gamificationProgress.value}%`);
  gamificationNext.textContent = state.siguienteNivel
    ? `Próximo nivel: ${state.siguienteNivel.id} ${state.siguienteNivel.nombre}`
    : 'Nivel máximo alcanzado';
  gamificationAchievements.replaceChildren();
  for (const logro of state.logros ?? []) {
    const item = document.createElement('li');
    item.className = 'achievement-item';

    const icon = document.createElement('img');
    icon.className = 'achievement-icon';
    if (logro.type === 'regalo') {
      icon.src = '/toast_images/regalo.jpg';
      icon.alt = 'Regalo';
    } else {
      icon.src = '/toast_images/75206.png';
      icon.alt = '';
    }

    const info = document.createElement('div');
    info.className = 'achievement-info';
    const name = document.createElement('span');
    name.className = 'achievement-name';
    name.textContent = logro.nombre;
    const description = document.createElement('span');
    description.className = 'achievement-description';
    description.textContent = logro.descripcion ?? '';
    info.append(name, description);

    const count = document.createElement('span');
    count.className = 'achievement-count';
    count.textContent = `x${logro.cantidad}`;

    const bricks = document.createElement('span');
    bricks.className = 'achievement-bricks';
    const bricksValue = document.createElement('strong');
    bricksValue.textContent = logro.total;
    const brickIcon = document.createElement('img');
    brickIcon.className = 'achievement-brick-icon';
    brickIcon.src = '/toast_images/hero_2026-01-05_16-38-47-871.webp';
    brickIcon.alt = 'Bricks';
    bricks.append(bricksValue, brickIcon);

    item.append(icon, info, count, bricks);
    gamificationAchievements.append(item);
  }
}

async function loadGamification() {
  try {
    const response = await apiFetch('/gamificacion');
    if (!response.ok) throw new Error('GAMIFICACION_NO_DISPONIBLE');
    renderGamification(await response.json());
  } catch {
    gamificationLevelNumber.textContent = '';
    gamificationLevelName.textContent = 'Nivel no disponible';
    gamificationDialogLevel.textContent = 'Nivel no disponible';
    gamificationBricks.textContent = '0 Bricks';
    gamificationProgress.value = 0;
    gamificationPercentage.textContent = '0%';
    gamificationPercentage.classList.remove('on-accent');
    gamificationNext.textContent = 'Progreso no disponible';
  }
}

function highlightGroup(title, items, mode) {
  const section = document.createElement('section');
  section.className = 'ranking-highlight-group';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const row = document.createElement('div');
  row.className = 'ranking-row';
  for (const [index, minifigura] of items.entries()) {
    const detail = mode === 'precio' ? formatPrice(minifigura.precio) : minifigura.anio;
    row.append(rankingCard(minifigura, index + 1, detail, false));
  }
  section.append(heading, row);
  return section;
}

function formatRankingDisplayName(displayName) {
  const [firstName, ...rest] = String(displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!firstName) return 'Usuario';
  return [firstName, ...rest.map((name) => `${Array.from(name)[0]}.`)].join(' ');
}

function setExpandedRankingUser(userId) {
  expandedRankingUserId = expandedRankingUserId === userId ? null : userId;
  for (const entry of globalRankingList.querySelectorAll('.global-ranking-entry')) {
    const expanded = entry.dataset.userId === expandedRankingUserId;
    entry.querySelector('.ranking-expand').setAttribute('aria-expanded', String(expanded));
    entry.querySelector('.ranking-user-details').hidden = !expanded;
  }
}

function renderGlobalRanking() {
  const fragment = document.createDocumentFragment();
  const currentUserId = currentSession?.user?.id;
  const currentUserIndex = rankingEntries.findIndex(({ userId }) => userId === currentUserId);
  rankingMainGlobe.hidden = currentUserIndex === -1;
  rankingMainGlobe.querySelector('#ranking-main-position').textContent = currentUserIndex === -1
    ? '' : ['🥇', '🥈', '🥉'][currentUserIndex] ?? `#${currentUserIndex + 1}`;
  rankingMainGlobe.setAttribute('aria-label', currentUserIndex === -1
    ? 'En Top Global' : `En Top Global, posición ${currentUserIndex + 1}. Abrir Ranking Global`);

  for (const [index, entry] of rankingEntries.entries()) {
    const article = document.createElement('article');
    article.className = 'global-ranking-entry';
    article.dataset.userId = entry.userId;

    const row = document.createElement('div');
    row.className = 'global-ranking-row';
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = `ranking-expand${entry.userId === currentUserId ? ' ranking-expand-current' : ''}`;
    expand.setAttribute('aria-expanded', 'false');

    const position = document.createElement('strong');
    position.className = 'ranking-position';
    position.textContent = `#${index + 1}`;
    const avatarWrap = document.createElement('span');
    avatarWrap.className = 'ranking-avatar-wrap';
    const avatar = document.createElement('img');
    avatar.className = 'ranking-avatar';
    avatar.alt = '';
    const avatarFallback = document.createElement('span');
    avatarFallback.className = 'ranking-avatar-fallback';
    avatarFallback.textContent = '👤';
    avatarFallback.hidden = Boolean(entry.avatarUrl);
    if (entry.avatarUrl) avatar.src = entry.avatarUrl;
    else avatar.hidden = true;
    avatar.addEventListener('error', () => { avatar.hidden = true; avatarFallback.hidden = false; });
    avatarWrap.append(avatar, avatarFallback);

    const name = document.createElement('strong');
    name.className = 'ranking-name';
    name.textContent = formatRankingDisplayName(entry.displayName);
    const bricks = document.createElement('span');
    bricks.className = 'gamification-bricks-value ranking-bricks';
    const bricksValue = document.createElement('strong');
    bricksValue.textContent = entry.bricks;
    const brickIcon = document.createElement('img');
    brickIcon.className = 'gamification-brick-icon';
    brickIcon.src = '/toast_images/hero_2026-01-05_16-38-47-871.webp';
    brickIcon.alt = 'Bricks';
    bricks.append(bricksValue, brickIcon);

    const levelInfo = document.createElement('span');
    levelInfo.className = 'ranking-level-info';
    const levelImage = document.createElement('img');
    levelImage.className = 'gamification-level-image';
    levelImage.src = levelImagePath(entry.nivel);
    levelImage.alt = '';
    const levelNumber = document.createElement('strong');
    levelNumber.className = 'ranking-level-number';
    levelNumber.textContent = entry.nivel;
    const levelName = document.createElement('span');
    levelName.className = 'ranking-level-name';
    levelName.textContent = entry.nombreNivel;
    levelInfo.append(levelImage, levelNumber, levelName);
    const collection = document.createElement('span');
    collection.className = 'ranking-collection-count';
    collection.setAttribute('aria-label', `${entry.totalColeccion} en colección`);
    collection.title = `${entry.totalColeccion} en colección`;
    const collectionIcon = document.createElement('img');
    collectionIcon.className = 'count-icon status-icon-image ranking-collection-icon';
    collectionIcon.src = '/status_images/caja.png';
    collectionIcon.alt = '';
    collectionIcon.setAttribute('aria-hidden', 'true');
    const collectionCount = document.createElement('strong');
    collectionCount.textContent = entry.totalColeccion;
    collection.append(collectionIcon, collectionCount);
    const chevron = document.createElement('span');
    chevron.className = 'ranking-row-chevron';
    chevron.textContent = '▾';
    chevron.setAttribute('aria-hidden', 'true');
    expand.append(position, avatarWrap, name, levelInfo, bricks, collection, chevron);
    row.append(expand);

    if (entry.userId !== currentUserId) {
      const gift = document.createElement('button');
      gift.type = 'button';
      gift.className = 'button button-secondary ranking-gift';
      gift.dataset.giftUser = entry.userId;
      gift.disabled = entry.regaloEnviado;
      gift.setAttribute('aria-label', entry.regaloEnviado ? 'Regalo ya enviado' : 'Enviar 50 Bricks');
      gift.title = entry.regaloEnviado ? 'Regalo ya enviado' : 'Enviar 50 Bricks';
      const giftAmount = document.createElement('span');
      giftAmount.textContent = '+50';
      const giftIcon = document.createElement('img');
      giftIcon.className = 'ranking-gift-icon';
      giftIcon.src = '/toast_images/hero_2026-01-05_16-38-47-871.webp';
      giftIcon.alt = '';
      giftIcon.setAttribute('aria-hidden', 'true');
      gift.append(giftAmount, giftIcon);
      row.append(gift);
    } else {
      const giftSpace = document.createElement('span');
      giftSpace.className = 'ranking-gift-space';
      giftSpace.setAttribute('aria-hidden', 'true');
      row.append(giftSpace);
    }

    const details = document.createElement('div');
    details.className = 'ranking-user-details';
    details.hidden = true;
    details.append(
      highlightGroup('Top 5 por precio', entry.top5Precio ?? [], 'precio'),
      highlightGroup('Top 5 por antigüedad', entry.top5Antiguedad ?? [], 'antiguedad'),
    );
    article.append(row, details);
    fragment.append(article);
  }
  globalRankingList.replaceChildren(fragment);
  expandedRankingUserId = null;
}

async function loadGlobalRanking({ showState = rankingDialog.open } = {}) {
  if (showState) {
    rankingStatus.textContent = 'Cargando ranking...';
    rankingStatus.className = 'status';
    globalRankingList.replaceChildren();
  }
  try {
    const response = await apiFetch('/api/ranking');
    if (!response.ok) throw new Error('RANKING_NO_DISPONIBLE');
    const result = await response.json();
    if (!Array.isArray(result)) throw new Error('RANKING_INVALIDO');
    rankingEntries = result;
    renderGlobalRanking();
    rankingStatus.textContent = result.length ? '' : 'Todavía no hay usuarios en el ranking.';
    rankingStatus.className = 'status';
    return result;
  } catch {
    rankingEntries = [];
    renderGlobalRanking();
    if (showState) {
      rankingStatus.textContent = 'No se pudo cargar el ranking global.';
      rankingStatus.className = 'status error';
    }
    return [];
  }
}

function showToast(message, type = 'success', iconSrc = null, iconPosition = 'after') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const messageNode = document.createTextNode(message);
  if (iconSrc === null) iconSrc = '/toast_images/87X2Rz8y2ZY.png';
  iconPosition = iconPosition === 'after' && type !== 'task' && type !== 'level' ? 'before' : iconPosition;
  const icon = iconSrc ? document.createElement('img') : null;
  if (icon) {
    icon.className = 'toast-icon';
    icon.src = iconSrc;
    icon.alt = type === 'level' ? 'Nivel alcanzado' : type === 'task' ? 'Bricks' : 'Separador de ladrillos';
  }
  if (icon && iconPosition === 'before') toast.append(icon);
  toast.append(messageNode);
  if (icon && iconPosition !== 'before') toast.append(icon);
  toastRegion.append(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function showGamificationToasts(gamification) {
  const achievements = (gamification?.logrosNuevos ?? [])
    .sort((left, right) => left.bricksNuevos - right.bricksNuevos)
    .map((logro) => ({ kind: 'achievement', ...logro }));
  const levels = (gamification?.nivelesAlcanzados ?? [])
    .map((nivel) => ({ kind: 'level', ...nivel }));
  achievementQueue.push(...achievements, ...levels);
  if (isShowingAchievement) return;
  isShowingAchievement = true;
  const showNext = () => {
    const logro = achievementQueue.shift();
    if (!logro) {
      isShowingAchievement = false;
      return;
    }
    if (logro.kind === 'level') {
      showToast(`NIVEL ${logro.id} ${logro.nombre}`, 'level', '/toast_images/75206.png', 'before');
    } else {
      showToast(`${logro.nombre} +${logro.bricksNuevos} Bricks`, 'task', '/toast_images/hero_2026-01-05_16-38-47-871.webp', 'before');
    }
    setTimeout(showNext, 300);
  };
  showNext();
}

function messageForErrorCode(code) {
  return ERROR_MESSAGES[code] ?? 'Ocurrio un error inesperado. Intentalo de nuevo.';
}

function closeImageModal() {
  imageModal.hidden = true;
  imageModalImage.removeAttribute('src');
  imageModalImage.alt = '';
  imageModalName.textContent = '';
}

function mostrarImagenMinifigura(id, nombre) {
  const upperId = String(id).toUpperCase();
  const url = imagenUrlPara(id);
  const preloader = new Image();
  preloader.onload = () => {
    imageModalImage.src = url;
    imageModalImage.alt = `Imagen de la minifigura ${upperId}`;
    imageModalTitle.textContent = upperId;
    imageModalName.textContent = nombre ?? '';
    imageModal.hidden = false;
    imageModalCloseButton.focus();
  };
  preloader.onerror = () => {
    showToast(`No se pudo cargar la imagen de la minifigura ${upperId}.`, 'error');
  };
  preloader.src = url;
}

function openFormDialog(mode, minifigura) {
  if (!categoriasReady) {
    showToast('No se pueden crear minifiguras sin cargar las categorías oficiales.', 'error');
    return;
  }
  pauseSyncForModal();
  currentFormMode = mode;
  imageLookupSequence += 1;
  currentEditId = mode === 'edit' ? minifigura.id : null;
  formSynced = mode !== 'create';
  minifiguraForm.reset();
  formObservedButton.setAttribute('aria-pressed', 'false');
  formError.textContent = '';
  formDialogTitle.textContent = mode === 'edit' ? 'Editar minifigura' : mode === 'view' ? 'Ver minifigura' : 'Nueva minifigura';

  if (mode !== 'create') {
    formIdInput.value = minifigura.id ?? '';
    formNombreInput.value = minifigura.nombre ?? '';
    formDescripcionInput.value = minifigura.descripcion ?? '';
    formCategoriaInput.value = minifigura.categoria ?? '';
    formSubcategoriaInput.value = minifigura.subcategoria ?? '';
    formAnioInput.value = minifigura.anio ?? '';
    formEstadoInput.value = minifigura.estadoColeccion ?? '';
    formPrecioCompraInput.value = minifigura.precioCompra ?? '';
    formFechaCompraInput.value = minifigura.fechaCompra ?? '';
    formPrecioInput.value = minifigura.precio ?? '';
    formObservedButton.setAttribute('aria-pressed', String(Boolean(minifigura.observada)));
    formPreviewImage.src = imagenUrlPara(minifigura.id);
    formPreviewImage.alt = minifigura.nombre ?? '';
  }

  updateFormMode();
  formDialog.showModal();
}

async function openMinifiguraView(id) {
  const normalizedId = String(id).trim().toUpperCase();
  let minifigura = catalogCache.find((item) => item.id === normalizedId);
  if (!minifigura) {
    try {
      const response = await apiFetch(`/minifiguras?id=${encodeURIComponent(id)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const matches = await response.json();
      minifigura = Array.isArray(matches) ? matches.find((item) => item.id === id) : null;
    } catch {
      showToast('No se pudo cargar la minifigura.', 'error');
      return;
    }
  }
  if (minifigura) {
    openFormDialog('view', minifigura);
  } else {
    showToast('No se pudo cargar la minifigura.', 'error');
  }
}

function updateFormMode() {
  const isCreate = currentFormMode === 'create';
  const isView = currentFormMode === 'view';
  const hasId = formIdInput.value.trim() !== '';
  const editableFields = [formNombreInput, formDescripcionInput, formEstadoInput];
  const purchaseFields = [formPrecioCompraInput, formFechaCompraInput];
  const bricksetFields = [formCategoriaInput, formSubcategoriaInput, formAnioInput, formPrecioInput];

  formDialog.classList.toggle('view-mode', isView);
  formIdInput.closest('.modal-row-identity').classList.toggle('view-mode', isView);
  formIdInput.readOnly = !isCreate;
  formIdInput.disabled = isView;
  editableFields.forEach((field) => { field.disabled = isView || (isCreate && !formSynced); });
  purchaseFields.forEach((field) => {
    if (formEstadoInput.value === 'BUSCADA') field.value = '';
    field.disabled = isView || formEstadoInput.value === 'BUSCADA' || (isCreate && !formSynced);
  });
  formStateToggleButtons.forEach((button) => { button.disabled = isView || (isCreate && !formSynced); });
  bricksetFields.forEach((field) => {
    field.disabled = isView || (isCreate && !formSynced);
    field.readOnly = true;
  });
  formObservedButton.disabled = isView || isCreate && !formSynced;
  updateFormToggleStates();
  formDialogTitle.hidden = isView;
  formSubmitButton.hidden = isView;
  formSubmitButton.disabled = isView || !isFormValid();
  formCancelButton.textContent = isView ? 'Cerrar' : 'Cancelar';
  formPreviewImage.hidden = !formIdInput.value.trim();
}

function updateFormToggleStates() {
  const selectedState = formEstadoInput.value;
  for (const button of formStateToggleButtons) {
    const isActive = button.dataset.formState === selectedState;
    button.classList.toggle('active', isActive);
    button.classList.toggle('inactive', !isActive);
    button.setAttribute('aria-pressed', String(isActive));
  }

  const isObserved = formObservedButton.getAttribute('aria-pressed') === 'true';
  formObservedButton.classList.toggle('active', isObserved);
  formObservedButton.classList.toggle('inactive', !isObserved);
  formObservedButton.setAttribute('aria-label', isObserved ? 'Dejar de seguir' : 'Seguir');
  formObservedButton.title = 'Seguimiento';
}

function isFormValid() {
  return formIdInput.value.trim() !== ''
    && formNombreInput.value.trim() !== ''
    && formEstadoInput.value.trim() !== ''
    && formCategoriaInput.value.trim() !== ''
    && Number.isInteger(Number(formAnioInput.value))
    && Number(formAnioInput.value) > 0
    && Number.isFinite(Number(formPrecioInput.value));
}

function closeFormDialog() {
  if (formDialog.open) {
    formDialog.close();
  }
  resumeSyncForModal();
}

async function pauseSyncForModal() {
  if (!isSyncingPrices) return;
  syncPausedByModal = true;
  try {
    await apiFetch('/sincronizacion/brickset', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'pausar' }),
    });
  } catch {
    // Transparente para el usuario: si la pausa falla, la sincronización sigue en segundo plano.
  }
}

async function resumeSyncForModal() {
  if (!syncPausedByModal) return;
  syncPausedByModal = false;
  try {
    await apiFetch('/sincronizacion/brickset', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'reanudar' }),
    });
  } catch {
    // Transparente para el usuario: el servidor reanudará en el próximo sondeo.
  }
}

function buildPayloadFromForm() {
  const anioRaw = formAnioInput.value.trim();
  const payload = {
    id: formIdInput.value.trim(),
    nombre: formNombreInput.value.trim(),
    descripcion: formDescripcionInput.value.trim(),
    categoria: formCategoriaInput.value.trim(),
    observada: formObservedButton.getAttribute('aria-pressed') === 'true',
  };

  const subcategoria = formSubcategoriaInput.value.trim();
  if (subcategoria !== '') {
    payload.subcategoria = subcategoria;
  }

  if (anioRaw !== '' && Number.isInteger(Number(anioRaw))) {
    payload.anio = Number(anioRaw);
  }

  const estadoColeccion = formEstadoInput.value.trim();
  payload.estadoColeccion = estadoColeccion || 'COLECCIÓN';

  const precioCompraRaw = formPrecioCompraInput.value.trim();
  if (precioCompraRaw !== '') {
    payload.precioCompra = Number(precioCompraRaw);
  }
  const fechaCompra = formFechaCompraInput.value.trim();
  if (fechaCompra !== '') {
    payload.fechaCompra = fechaCompra;
  }
  const precioRaw = formPrecioInput.value.trim();
  if (precioRaw !== '') {
    payload.precio = Number(precioRaw);
  }

  return payload;
}

function validatePayload(payload) {
  if (!payload.id) {
    return 'El id es obligatorio.';
  }
  if (!payload.nombre) {
    return 'El nombre es obligatorio.';
  }
  if (!payload.categoria) {
    return 'La categoría es obligatoria.';
  }
  if (payload.anio === undefined || payload.anio <= 0) {
    return 'El año es obligatorio.';
  }
  if (payload.precio === undefined || !Number.isFinite(payload.precio)) {
    return 'El precio Brickset es obligatorio.';
  }
  if (!officialCategorias.some(({ categoria }) => categoria === payload.categoria)) {
    return 'La categoría debe ser una categoría oficial de Brickset.';
  }
  if (payload.subcategoria && !(subcategoriasPorCategoria.get(payload.categoria) ?? []).includes(payload.subcategoria)) {
    return 'La subcategoría debe pertenecer a la categoría seleccionada.';
  }
  if (payload.anio !== undefined && (!Number.isInteger(payload.anio) || payload.anio < 1978 || payload.anio > currentYear)) {
    return `El año debe ser un número entero entre 1978 y ${currentYear}.`;
  }
  return null;
}

function openDeleteDialog(minifigura) {
  pendingDeleteId = minifigura.id;
  deleteMessage.textContent = `Se eliminará la minifigura "${minifigura.nombre}" (${minifigura.id}).\n\nEsta acción no se puede deshacer.`;
  deleteDialog.showModal();
}

function closeDeleteDialog() {
  if (deleteDialog.open) {
    deleteDialog.close();
  }
  pendingDeleteId = null;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const filterValue = (name) => String(formData.get(name) ?? '').trim();
  const collectionState = collectionFilterInput.checked && !wantedFilterInput.checked
    ? 'COLECCIÓN'
    : wantedFilterInput.checked && !collectionFilterInput.checked
      ? 'BUSCADA'
      : '';
  activeFilters = {
    id: filterValue('id'),
    nombre: filterValue('nombre'),
    categoria: filterValue('categoria'),
    subcategoria: filterValue('subcategoria'),
    anio: filterValue('anio'),
    estadoColeccion: collectionState,
    observada: observedFilterInput.checked ? 'true' : '',
  };
  applyFilters();
});

showAllButton.addEventListener('click', () => {
  form.reset();
  activeFilters = {};
  activeSort = { field: null, direction: 'asc' };
  sortButtons.forEach((button) => { button.dataset.direction = ''; });
  renderDynamicFilterOptions(catalogCache);
  applyFilters();
});

sortButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const field = button.dataset.sort;
    activeSort = activeSort.field === field
      ? { field, direction: activeSort.direction === 'asc' ? 'desc' : 'asc' }
      : { field, direction: 'asc' };
    sortButtons.forEach((sortButton) => {
      sortButton.dataset.direction = sortButton === button ? activeSort.direction : '';
    });
    renderCatalogPage();
  });
});

previousPageButton.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage -= 1;
    renderCatalogPage();
  }
});

nextPageButton.addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(currentCatalog.length / pageSize));
  if (currentPage < totalPages) {
    currentPage += 1;
    renderCatalogPage();
  }
});

syncPricesButton.addEventListener('click', startSync);

newMinifiguraButton.addEventListener('click', () => {
  openFormDialog('create');
});

firstMinifiguraAccept.addEventListener('click', () => {
  firstMinifiguraDialog.close();
  openFormDialog('create');
});

gamificationLevelButton.addEventListener('click', () => {
  gamificationDialog.showModal();
});

achievementsOpenButton.addEventListener('click', () => {
  gamificationDialog.showModal();
  gamificationCloseButton.focus();
});

gamificationCloseButton.addEventListener('click', () => {
  gamificationDialog.close();
});

let rankingTrigger = rankingOpenButton;
for (const trigger of [rankingOpenButton, rankingMainGlobe]) {
  trigger.addEventListener('click', () => {
    rankingTrigger = trigger;
    userProfile.hidden = true;
    userMenuToggle.setAttribute('aria-expanded', 'false');
    rankingDialog.showModal();
    rankingCloseButton.focus();
    void loadGlobalRanking();
  });
}

rankingCloseButton.addEventListener('click', () => {
  rankingDialog.close();
});

rankingDialog.addEventListener('close', () => {
  if (currentSession) (rankingTrigger.hidden ? rankingOpenButton : rankingTrigger).focus();
});

globalRankingList.addEventListener('click', async (event) => {
  const expand = event.target.closest('.ranking-expand');
  if (expand) {
    setExpandedRankingUser(expand.closest('.global-ranking-entry').dataset.userId);
    return;
  }
  const gift = event.target.closest('[data-gift-user]');
  if (!gift || gift.disabled) return;
  gift.disabled = true;
  try {
    const response = await apiFetch('/api/ranking/regalar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ receptorId: gift.dataset.giftUser }),
    });
    const result = await response.json();
    if (!response.ok) {
      if (result.error === 'REGALO_YA_ENVIADO') {
        gift.textContent = 'Regalo enviado';
        return;
      }
      throw new Error(result.error);
    }
    await Promise.all([loadGlobalRanking(), loadGamification()]);
    showToast('Regalo de 50 Bricks enviado.', 'success');
  } catch {
    gift.disabled = false;
    showToast('No se pudo enviar el regalo.', 'error');
  }
});

userMenuToggle.addEventListener('click', () => {
  const expanded = userMenuToggle.getAttribute('aria-expanded') !== 'true';
  userMenuToggle.setAttribute('aria-expanded', String(expanded));
  userProfile.hidden = !expanded;
});

document.addEventListener('click', (event) => {
  if (!userSession.contains(event.target)) {
    userProfile.hidden = true;
    userMenuToggle.setAttribute('aria-expanded', 'false');
  }
});

userSession.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !userProfile.hidden) {
    userProfile.hidden = true;
    userMenuToggle.setAttribute('aria-expanded', 'false');
    userMenuToggle.focus();
  }
});

gamificationToggleButton.addEventListener('click', () => {
  const expanded = gamificationToggleButton.getAttribute('aria-expanded') !== 'true';
  gamificationToggleButton.setAttribute('aria-expanded', String(expanded));
  gamificationDetails.hidden = !expanded;
  const label = expanded ? 'Ocultar resumen de colección' : 'Mostrar resumen de colección';
  gamificationToggleButton.setAttribute('aria-label', label);
  gamificationToggleButton.title = label;
});

function setPanelCollapsed(button, collapsed) {
  button.setAttribute('aria-expanded', String(!collapsed));
  document.getElementById(button.getAttribute('aria-controls')).hidden = collapsed;
  button.closest('section').classList.toggle('panel-collapsed', collapsed);
  const label = collapsed ? 'Mostrar panel' : 'Ocultar panel';
  button.setAttribute('aria-label', label);
  button.title = label;
}

document.querySelectorAll('.panel-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    setPanelCollapsed(button, button.getAttribute('aria-expanded') === 'true');
  });
});

catalogBody.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) {
    return;
  }

  const minifigura = currentCatalog.find((item) => item.id === trigger.dataset.id);
  if (!minifigura) {
    return;
  }

  if (trigger.dataset.action === 'edit') {
    openFormDialog('edit', minifigura);
  } else if (trigger.dataset.action === 'view') {
    openFormDialog('view', minifigura);
  } else if (trigger.dataset.action === 'delete') {
    openDeleteDialog(minifigura);
  } else if (trigger.dataset.action === 'preview') {
    mostrarImagenMinifigura(minifigura.id, minifigura.nombre);
  } else if (trigger.dataset.action === 'observe') {
    toggleObserved(minifigura, trigger);
  }
});

[topFiveList, oldestFiveList, watchlistList].forEach((list) => {
  list.addEventListener('click', (event) => {
    const card = event.target.closest('[data-action="view"]');
    if (card) {
      void openMinifiguraView(card.dataset.id);
    }
  });
});

async function toggleObserved(minifigura, trigger) {
  const nextObserved = !minifigura.observada;
  trigger.disabled = true;
  try {
    const response = await apiFetch(`/minifiguras/${encodeURIComponent(minifigura.id)}/observada`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ observada: nextObserved }),
    });
    const result = await response.json();
    if (!response.ok) {
      if (result.error === 'LIMITE_OBSERVADAS') {
        showToast('Límite alcanzado: Máximo 10 minifiguras en observación', 'warning');
      } else {
        showToast(messageForErrorCode(result.error), 'error');
      }
      return;
    }
    upsertCached(result);
    applyFilters({ preservePage: true });
    void revalidate();
  } catch {
    showToast('No se pudo actualizar la observación.', 'error');
  } finally {
    trigger.disabled = false;
  }
}

imageModalCloseButton.addEventListener('click', () => {
  closeImageModal();
});

imageModal.addEventListener('click', (event) => {
  if (event.target === imageModal) {
    closeImageModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !imageModal.hidden) {
    closeImageModal();
  }
});

formCancelButton.addEventListener('click', () => {
  closeFormDialog();
});

formDialog.addEventListener('close', () => {
  imageLookupSequence += 1;
  currentEditId = null;
  currentFormMode = null;
  formSynced = false;
  formPreviewImage.removeAttribute('src');
});

[formIdInput, formNombreInput, formCategoriaInput, formAnioInput, formPrecioInput, formEstadoInput].forEach((input) => {
  input.addEventListener('input', () => {
    if (currentFormMode === 'create' && input === formIdInput) {
      imageLookupSequence += 1;
      formSynced = false;
      formCategoriaInput.value = '';
      formSubcategoriaInput.value = '';
      formAnioInput.value = '';
      formPrecioInput.value = '';
      formPreviewImage.src = input.value.trim() ? imagenUrlPara(input.value) : '';
    }
    if (currentFormMode) {
      updateFormMode();
    }
  });
});

formObservedButton.addEventListener('click', () => {
  const pressed = formObservedButton.getAttribute('aria-pressed') === 'true';
  formObservedButton.setAttribute('aria-pressed', String(!pressed));
  updateFormToggleStates();
});

formStateToggleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    formEstadoInput.value = button.dataset.formState;
    updateFormMode();
  });
});

minifiguraForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';

  const payload = buildPayloadFromForm();
  const validationError = validatePayload(payload);
  if (validationError) {
    formError.textContent = validationError;
    return;
  }

  const isEdit = currentEditId !== null;
  formSubmitButton.disabled = true;

  try {
    const url = isEdit ? `/minifiguras/${encodeURIComponent(currentEditId)}` : '/minifiguras';
    const response = await apiFetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json', 'x-gamificacion': 'true' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorCode;
      try {
        errorCode = (await response.json())?.error;
      } catch {
        errorCode = undefined;
      }
      const errorMessage = messageForErrorCode(errorCode);
      formError.textContent = errorMessage;
      showToast(errorMessage, 'error');
      return;
    }

    const result = await response.json();
    showGamificationToasts(result.gamificacion);
    closeFormDialog();
    upsertCached(result);
    applyFilters({ preservePage: true });
    showToast(isEdit ? 'Minifigura actualizada correctamente.' : 'Minifigura creada correctamente.', 'success');
    void revalidate();
  } catch {
    const connError = 'No se pudo conectar con el servidor. Intentalo de nuevo.';
    formError.textContent = connError;
    showToast(connError, 'error');
  } finally {
    formSubmitButton.disabled = false;
    updateFormMode();
  }
});

formPreviewImage.addEventListener('load', async () => {
  if (!formDialog.open || currentFormMode === 'view') return;
  const id = formIdInput.value.trim();
  if (!id || formPreviewImage.src !== imagenUrlPara(id)) return;
  const lookupSequence = imageLookupSequence;

  showToast('Consultando datos en Brickset...', 'success');
  try {
    const response = await apiFetch(`/minifiguras/${encodeURIComponent(id)}/brickset`);
    const result = await response.json();
    if (!formDialog.open || currentFormMode === 'view' || imageLookupSequence !== lookupSequence || formIdInput.value.trim() !== id) return;
    if (!response.ok) {
      throw new Error(result.error ?? 'BRICKSET_NO_DISPONIBLE');
    }
    formCategoriaInput.value = result.categoria;
    formSubcategoriaInput.value = result.subcategoria ?? '';
    formAnioInput.value = Number.isInteger(result.anio) && result.anio > 0 ? result.anio : currentYear;
    formPrecioInput.value = result.precio;
    formSynced = true;
    formPreviewImage.alt = formNombreInput.value || id;
    updateFormMode();
    showToast('Datos de Brickset actualizados.', 'success');
  } catch {
    if (formDialog.open && currentFormMode !== 'view' && imageLookupSequence === lookupSequence && formIdInput.value.trim() === id) {
      showToast('No se encontraron datos en Brickset para el ID especificado', 'error');
    }
  }
});

deleteCancelButton.addEventListener('click', () => {
  closeDeleteDialog();
});

deleteDialog.addEventListener('close', () => {
  pendingDeleteId = null;
});

deleteConfirmButton.addEventListener('click', async () => {
  if (!pendingDeleteId) {
    return;
  }

  const id = pendingDeleteId;
  deleteConfirmButton.disabled = true;

  try {
    const response = await apiFetch(`/minifiguras/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 204) {
      let errorCode;
      try {
        errorCode = (await response.json())?.error;
      } catch {
        errorCode = undefined;
      }
      showToast(messageForErrorCode(errorCode), 'error');
      return;
    }

    closeDeleteDialog();
    removeCached(id);
    applyFilters({ preservePage: true });
    showToast('Minifigura eliminada correctamente.', 'success');
    void revalidate();
  } catch {
    showToast('No se pudo conectar con el servidor. Intentalo de nuevo.', 'error');
  } finally {
    deleteConfirmButton.disabled = false;
  }
});

async function initialize() {
  if (await loadCategorias()) {
    const catalog = await loadCatalog();
    if (catalog?.length === 0 && currentSession) {
      firstMinifiguraDialog.showModal();
      firstMinifiguraTitle.focus();
    }
    if (currentSession) {
      try {
        const response = await apiFetch('/sincronizacion/brickset');
        if (response.ok) {
          const state = await response.json();
          if (state.estado === 'en_curso') {
            showSyncProgress(state);
            scheduleSyncPoll();
          }
        }
      } catch {
        // Sync status is optional during initial catalog loading.
      }
    }
  }
}

async function apiFetch(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${currentSession?.access_token ?? ''}` },
  });
  if (response.status === 401 && currentSession) {
    await endSession(SESSION_EXPIRED_MESSAGE);
  }
  return response;
}

function clearUserData() {
  requestSequence += 1;
  if (syncPollTimer !== null) {
    clearTimeout(syncPollTimer);
    syncPollTimer = null;
  }
  isSyncingPrices = false;
  syncProgress.hidden = true;
  syncPricesButton.disabled = true;
  syncPausedByModal = false;
  activeFilters = {};
  catalogCache = [];
  catalogForOptions = [];
  hasLoadedFullCatalog = false;
  applyFilters();
  collectionTotal.textContent = formatPrice(0);
  collectionCount.textContent = '0';
  wantedCount.textContent = '0';
  renderTopFive([]);
  renderOldestFive([]);
  renderWatchlist([]);
  renderGamification({});
  rankingEntries = [];
  expandedRankingUserId = null;
  rankingMainGlobe.hidden = true;
  rankingMainGlobe.querySelector('#ranking-main-position').textContent = '';
  rankingMainGlobe.setAttribute('aria-label', 'En Top Global');
  globalRankingList.replaceChildren();
  rankingStatus.textContent = '';
  for (const button of document.querySelectorAll('.rankings-panel .panel-toggle, .watchlist-panel .panel-toggle')) {
    setPanelCollapsed(button, false);
  }
  for (const dialog of [firstMinifiguraDialog, formDialog, deleteDialog, gamificationDialog, rankingDialog]) {
    if (dialog.open) dialog.close();
  }
}

function showAuthScreen(message = '') {
  pageShell.hidden = true;
  authScreen.hidden = false;
  authMessage.textContent = message;
  loginButton.disabled = supabaseClient === null;
  userName.textContent = '';
  userProfile.removeAttribute('title');
  userAvatar.hidden = true;
  userAvatar.removeAttribute('src');
  userProfile.hidden = true;
  userMenuToggle.setAttribute('aria-expanded', 'false');
}

function handleSession(session, message = '') {
  currentSession = session;
  if (!session) {
    if (appStarted) clearUserData();
    appStarted = false;
    showAuthScreen(message);
    return;
  }

  const name = session.user?.user_metadata?.full_name || session.user?.email || '';
  const avatarUrl = session.user?.user_metadata?.avatar_url;
  userName.textContent = name;
  userProfile.title = name;
  userAvatar.hidden = !avatarUrl;
  userProfile.hidden = true;
  userMenuToggle.setAttribute('aria-expanded', 'false');
  if (avatarUrl) userAvatar.src = avatarUrl;
  else userAvatar.removeAttribute('src');
  authScreen.hidden = true;
  pageShell.hidden = false;
  if (!appStarted) {
    appStarted = true;
    initialize();
  }
}

async function endSession(message = '') {
  currentSession = null;
  try {
    await supabaseClient.auth.signOut({ scope: 'local' });
  } catch {
    // The local session is discarded below even if Supabase cannot be reached.
  }
  handleSession(null, message);
}

async function initializeAuth() {
  showAuthScreen();
  try {
    const response = await fetch('/config/supabase');
    if (!response.ok) {
      throw new Error('CONFIGURACION_NO_DISPONIBLE');
    }
    const config = await response.json();
    supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  } catch {
    supabaseClient = null;
    showAuthScreen('No se pudo iniciar el servicio de autenticación.');
    return;
  }

  // Supabase warns against calling its API inside this callback, so it only updates local state.
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session || currentSession) handleSession(session);
  });
  try {
    const { data } = await supabaseClient.auth.getSession();
    handleSession(data?.session ?? null);
  } catch {
    handleSession(null, 'No se pudo recuperar la sesión.');
  }
}

loginButton.addEventListener('click', async () => {
  if (!supabaseClient) return;
  authMessage.textContent = '';
  loginButton.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
        // Google reutiliza la cuenta activa del navegador si no se fuerza el selector.
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
  } catch {
    authMessage.textContent = 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.';
    loginButton.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await supabaseClient.auth.signOut();
  } catch {
    // Fall through to discard the local session.
  }
  logoutButton.disabled = false;
  handleSession(null);
});

setCategoriaControlsEnabled(false);
initializeAuth();
