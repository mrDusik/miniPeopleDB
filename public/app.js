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
const idFilterInput = document.querySelector('#id');
const categoriaInput = document.querySelector('#categoria');
const subcategoriaInput = document.querySelector('#subcategoria');
const anioInput = document.querySelector('#anio');
const currentYear = new Date().getFullYear();
const sortButtons = [...document.querySelectorAll('[data-sort]')];
const controls = [...form.querySelectorAll('input, select, button'), syncPricesButton];

const formDialog = document.querySelector('#form-dialog');
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
const formPrecioCompraInput = document.querySelector('#form-precioCompra');
const formFechaCompraInput = document.querySelector('#form-fechaCompra');
const formPrecioInput = document.querySelector('#form-precio');
const lookupBricksetButton = document.querySelector('#lookup-brickset');

const deleteDialog = document.querySelector('#delete-dialog');
const deleteMessage = document.querySelector('#delete-message');
const deleteConfirmButton = document.querySelector('#delete-confirm');
const deleteCancelButton = document.querySelector('#delete-cancel');

const imageModal = document.querySelector('#image-modal');
const imageModalTitle = document.querySelector('#image-modal-title');
const imageModalImage = document.querySelector('#image-modal-image');
const imageModalCloseButton = document.querySelector('#image-modal-close');

const toastRegion = document.querySelector('#toast-region');
const gamificationLevelButton = document.querySelector('#gamification-level');
const gamificationTitle = document.querySelector('#gamification-title');
const gamificationBricks = document.querySelector('#gamification-bricks');
const gamificationProgress = document.querySelector('#gamification-progress');
const gamificationNext = document.querySelector('#gamification-next');
const gamificationDialog = document.querySelector('#gamification-dialog');
const gamificationAchievements = document.querySelector('#gamification-achievements');
const gamificationCloseButton = document.querySelector('#gamification-close');

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
let currentFilters = {};
let currentCatalog = [];
let currentEditId = null;
let pendingDeleteId = null;
let activeSort = { field: null, direction: 'asc' };
let isSyncingPrices = false;
let officialCategorias = [];
let subcategoriasPorCategoria = new Map();
let categoriasReady = false;
let syncButtonStates = new Map();
const pageSize = 10;
let currentPage = 1;
let achievementQueue = [];
let isShowingAchievement = false;

anioInput.max = String(currentYear);
formAnioInput.max = String(currentYear);

function renderSubcategoryOptions(selectElement, categoria, placeholderText) {
  const previousValue = selectElement.value;
  const subcategorias = subcategoriasPorCategoria.get(categoria) ?? [];
  selectElement.replaceChildren(new Option(placeholderText, ''));
  for (const subcategoria of subcategorias) {
    selectElement.append(new Option(subcategoria, subcategoria));
  }
  selectElement.value = subcategorias.includes(previousValue) ? previousValue : '';
  selectElement.disabled = !categoriasReady || subcategorias.length === 0;
}

function renderCategoryOptions(categorias) {
  const categoryNames = categorias.map(({ categoria }) => categoria);

  const selectedCategoria = categoriaInput.value;
  categoriaInput.replaceChildren(new Option('Todas', ''));
  for (const categoria of categoryNames) {
    categoriaInput.append(new Option(categoria, categoria));
  }
  categoriaInput.value = categoryNames.includes(selectedCategoria) ? selectedCategoria : '';
  renderSubcategoryOptions(subcategoriaInput, categoriaInput.value, 'Todas');
}

function setCategoriaControlsEnabled(enabled) {
  categoriaInput.disabled = !enabled;
  renderSubcategoryOptions(subcategoriaInput, categoriaInput.value, 'Todas');
  newMinifiguraButton.disabled = !enabled;
  syncPricesButton.disabled = !enabled;
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

function rankingCard(minifigura, position, detail) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'ranking-card';
  card.dataset.action = 'preview';
  card.dataset.id = minifigura.id;
  card.title = `${minifigura.id} - ${minifigura.nombre ?? ''}`;

  const image = document.createElement('img');
  image.className = 'ranking-img';
  image.alt = minifigura.nombre ?? '';
  image.addEventListener('error', () => { image.style.display = 'none'; });
  image.src = imagenUrlPara(minifigura.id);

  const caption = document.createElement('span');
  caption.className = 'ranking-caption';
  caption.textContent = `#${position} - ${detail}`;

  card.append(image, caption);
  return card;
}

function renderTopFive(topFive) {
  topFiveList.replaceChildren();
  topFive.forEach((minifigura, index) => {
    topFiveList.append(rankingCard(minifigura, index + 1, formatPrice(minifigura.precio)));
  });
  trackButtonsDuringSync(topFiveList);
}

function renderOldestFive(oldestFive) {
  oldestFiveList.replaceChildren();
  oldestFive.forEach((minifigura, index) => {
    oldestFiveList.append(rankingCard(minifigura, index + 1, minifigura.anio));
  });
  trackButtonsDuringSync(oldestFiveList);
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
  return [...catalog].sort((left, right) => {
    const leftValue = left[activeSort.field];
    const rightValue = right[activeSort.field];
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
  badge.className = `badge ${badgeClassFor(value)}`;
  badge.textContent = value ?? '';
  element.append(badge);
  return element;
}

function imagenUrlPara(id) {
  return `https://img.bricklink.com/ItemImage/MN/0/${encodeURIComponent(String(id).toLowerCase())}.png`;
}

function thumbCell(minifigura) {
  const element = document.createElement('td');
  const thumb = document.createElement('img');
  thumb.className = 'table-thumb';
  thumb.alt = minifigura.nombre ?? '';
  thumb.dataset.action = 'preview';
  thumb.dataset.id = minifigura.id;
  thumb.addEventListener('error', () => { thumb.style.display = 'none'; });
  thumb.src = imagenUrlPara(minifigura.id);
  element.append(thumb);
  return element;
}

function idCell(minifigura) {
  return cell(minifigura.id);
}

function actionsCell(minifigura) {
  const element = document.createElement('td');
  element.className = 'actions-cell';

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

  element.append(editButton, deleteButton);
  return element;
}

function renderCatalog(catalog) {
  currentCatalog = catalog;
  currentPage = 1;
  renderCatalogPage();
}

function renderCatalogPage() {
  catalogBody.replaceChildren();
  resultCount.textContent = `${currentCatalog.length} ${currentCatalog.length === 1 ? 'figura' : 'figuras'}`;
  const sortedCatalog = sortCatalog(currentCatalog);
  const totalPages = Math.max(1, Math.ceil(sortedCatalog.length / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;

  for (const minifigura of sortedCatalog.slice(pageStart, pageStart + pageSize)) {
    const row = document.createElement('tr');
    row.append(
      thumbCell(minifigura),
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
    catalogBody.append(row);
  }
  trackButtonsDuringSync(catalogBody);
  pageStatus.textContent = `Página ${currentPage} de ${totalPages}`;
  previousPageButton.disabled = currentPage === 1 || isSyncingPrices;
  nextPageButton.disabled = currentPage === totalPages || isSyncingPrices;

  if (currentCatalog.length === 0) {
    setStatus('No hay minifiguras que coincidan con la consulta.');
  } else {
    setStatus('Catálogo actualizado.');
  }
}

function trackButtonsDuringSync(container) {
  if (!isSyncingPrices) {
    return;
  }
  container.querySelectorAll('button').forEach((button) => {
    if (!syncButtonStates.has(button)) {
      syncButtonStates.set(button, button.disabled);
    }
    button.disabled = true;
  });
}

function setLoading(isLoading) {
  controls.forEach((control) => { control.disabled = isLoading || isSyncingPrices; });
  previousPageButton.disabled = isLoading || isSyncingPrices;
  nextPageButton.disabled = isLoading || isSyncingPrices;
  if (isLoading) {
    setStatus('Cargando catálogo...');
  } else if (currentCatalog.length > 0) {
    renderCatalogPage();
  }
}

function setSyncLoading(isLoading) {
  isSyncingPrices = isLoading;
  if (isLoading) {
    syncButtonStates = new Map(
      [...document.querySelectorAll('button')].map((button) => [button, button.disabled]),
    );
    syncButtonStates.forEach((wasDisabled, button) => {
      button.disabled = true;
    });
    return;
  }

  syncButtonStates.forEach((wasDisabled, button) => {
    button.disabled = wasDisabled;
  });
  syncButtonStates.clear();
  setCategoriaControlsEnabled(categoriasReady);
}

async function loadCatalog(filters = {}) {
  currentFilters = filters;
  const currentRequest = ++requestSequence;
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
  const query = params.toString();
  setLoading(true);

  try {
    const response = await fetch(`/minifiguras${query ? `?${query}` : ''}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const catalog = await response.json();
    if (!Array.isArray(catalog)) {
      throw new Error('Respuesta invalida');
    }
    if (currentRequest === requestSequence) {
      renderCatalog(catalog);
      await loadTotal();
      await loadGamification();
    }
  } catch {
    if (currentRequest === requestSequence) {
      catalogBody.replaceChildren();
      resultCount.textContent = '';
      categoriasReady = false;
      officialCategorias = [];
      setCategoriaControlsEnabled(false);
      setStatus('No se pudo cargar el catálogo. Inténtalo de nuevo.', 'error');
    }
  } finally {
    if (currentRequest === requestSequence) {
      setLoading(false);
      setCategoriaControlsEnabled(!isSyncingPrices && categoriasReady);
    }
  }
}

async function loadTotal() {
  try {
    const response = await fetch('/valoracion');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const summary = await response.json();
    collectionTotal.textContent = formatPrice(summary.total ?? 0);
    collectionCount.textContent = `${summary.enColeccion ?? 0} minifiguras`;
    wantedCount.textContent = `Total de figuras buscadas: ${summary.buscadas ?? 0}`;
    renderTopFive(Array.isArray(summary.top5) ? summary.top5 : []);
    renderOldestFive(Array.isArray(summary.top5Antiguas) ? summary.top5Antiguas : []);
  } catch {
    collectionTotal.textContent = 'No disponible';
    collectionCount.textContent = '0 minifiguras';
    wantedCount.textContent = 'Total de figuras buscadas: 0';
    renderTopFive([]);
    renderOldestFive([]);
  }
}

function renderGamification(state) {
  const level = state.nivel ?? { id: 0, nombre: 'Duplo' };
  gamificationTitle.textContent = `${level.id} ${level.nombre}`;
  gamificationBricks.textContent = `${state.bricks ?? 0} Bricks`;
  gamificationProgress.value = state.progreso?.porcentaje ?? 0;
  gamificationProgress.setAttribute('aria-valuetext', `${gamificationProgress.value}%`);
  gamificationNext.textContent = state.siguienteNivel
    ? `Próximo nivel: ${state.siguienteNivel.id} ${state.siguienteNivel.nombre}`
    : 'Nivel máximo alcanzado';
  gamificationAchievements.replaceChildren();
  for (const logro of state.logros ?? []) {
    const item = document.createElement('li');
    item.title = logro.descripcion ?? '';
    item.textContent = `${logro.nombre} (x${logro.cantidad}) - ${logro.total} Bricks`;
    gamificationAchievements.append(item);
  }
}

async function loadGamification() {
  try {
    const response = await fetch('/gamificacion');
    if (!response.ok) throw new Error('GAMIFICACION_NO_DISPONIBLE');
    renderGamification(await response.json());
  } catch {
    gamificationTitle.textContent = 'Nivel no disponible';
    gamificationBricks.textContent = '0 Bricks';
    gamificationNext.textContent = 'Progreso no disponible';
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.textContent = message;
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
      showToast(`Has alcanzado el nivel ${logro.id} ${logro.nombre}`, 'level');
    } else {
      showToast(`${logro.nombre} +${logro.bricksNuevos} Bricks`, 'success');
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
}

function mostrarImagenMinifigura(id) {
  const upperId = String(id).toUpperCase();
  const url = imagenUrlPara(id);
  const preloader = new Image();
  preloader.onload = () => {
    imageModalImage.src = url;
    imageModalImage.alt = `Imagen de la minifigura ${upperId}`;
    imageModalTitle.textContent = `Minifigura: ${upperId}`;
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
  currentEditId = mode === 'edit' ? minifigura.id : null;
  minifiguraForm.reset();
  formError.textContent = '';
  formIdInput.readOnly = mode === 'edit';
  formDialogTitle.textContent = mode === 'edit' ? 'Editar minifigura' : 'Nueva minifigura';

  if (mode === 'edit') {
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
  }

  formDialog.showModal();
}

function closeFormDialog() {
  if (formDialog.open) {
    formDialog.close();
  }
}

function buildPayloadFromForm() {
  const formData = new FormData(minifiguraForm);
  const anioRaw = formData.get('anio')?.toString().trim() ?? '';
  const payload = {
    id: formData.get('id')?.toString().trim() ?? '',
    nombre: formData.get('nombre')?.toString().trim() ?? '',
    descripcion: formData.get('descripcion')?.toString().trim() ?? '',
    categoria: formData.get('categoria')?.toString().trim() ?? '',
  };

  const subcategoria = formData.get('subcategoria')?.toString().trim() ?? '';
  if (subcategoria !== '') {
    payload.subcategoria = subcategoria;
  }

  if (anioRaw !== '' && Number.isInteger(Number(anioRaw))) {
    payload.anio = Number(anioRaw);
  }

  const estadoColeccion = formData.get('estadoColeccion')?.toString().trim() ?? '';
  payload.estadoColeccion = estadoColeccion || 'COLECCIÓN';

  const precioCompraRaw = formData.get('precioCompra')?.toString().trim() ?? '';
  if (precioCompraRaw !== '') {
    payload.precioCompra = Number(precioCompraRaw);
  }
  const fechaCompra = formData.get('fechaCompra')?.toString().trim() ?? '';
  if (fechaCompra !== '') {
    payload.fechaCompra = fechaCompra;
  }
  const precioRaw = formData.get('precio')?.toString().trim() ?? '';
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
  deleteMessage.textContent = `Se eliminara la minifigura "${minifigura.nombre}" (${minifigura.id}). Esta accion no se puede deshacer.`;
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
  loadCatalog({
    id: filterValue('id'),
    categoria: filterValue('categoria'),
    subcategoria: filterValue('subcategoria'),
    anio: filterValue('anio'),
    estadoColeccion: filterValue('estadoColeccion'),
  });
});

showAllButton.addEventListener('click', () => {
  form.reset();
  loadCatalog();
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

syncPricesButton.addEventListener('click', async () => {
  setSyncLoading(true);
  showToast('Actualizando precios desde Brickset...', 'success');

  try {
    const response = await fetch('/sincronizacion/brickset', { method: 'POST' });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? 'BRICKSET_NO_DISPONIBLE');
    }

    await loadCatalog(currentFilters);
    if (result.fallidos?.length) {
      showToast(`Precios actualizados: ${result.actualizados.length}. Fallidos: ${result.fallidos.length}.`, 'error');
    } else {
      showToast(`Precios actualizados: ${result.actualizados.length}.`, 'success');
    }
  } catch {
    showToast('No se pudieron actualizar los precios desde Brickset.', 'error');
  } finally {
    setSyncLoading(false);
  }
});

newMinifiguraButton.addEventListener('click', () => {
  openFormDialog('create');
});

gamificationLevelButton.addEventListener('click', () => {
  gamificationDialog.showModal();
});

gamificationCloseButton.addEventListener('click', () => {
  gamificationDialog.close();
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
  } else if (trigger.dataset.action === 'delete') {
    openDeleteDialog(minifigura);
  } else if (trigger.dataset.action === 'preview') {
    mostrarImagenMinifigura(minifigura.id);
  }
});

[topFiveList, oldestFiveList].forEach((list) => {
  list.addEventListener('click', (event) => {
    const card = event.target.closest('[data-action="preview"]');
    if (card) {
      mostrarImagenMinifigura(card.dataset.id);
    }
  });
});

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
  currentEditId = null;
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
    const response = await fetch(url, {
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
    await loadCatalog(currentFilters);
    showToast(isEdit ? 'Minifigura actualizada correctamente.' : 'Minifigura creada correctamente.', 'success');
  } catch {
    const connError = 'No se pudo conectar con el servidor. Intentalo de nuevo.';
    formError.textContent = connError;
    showToast(connError, 'error');
  } finally {
    formSubmitButton.disabled = false;
  }
});

lookupBricksetButton.addEventListener('click', async () => {
  const id = formIdInput.value.trim();
  if (!id) {
    formError.textContent = 'El id es obligatorio para consultar los datos de Brickset.';
    return;
  }

  lookupBricksetButton.disabled = true;
  showToast('Consultando datos en Brickset...', 'success');
  try {
    const response = await fetch(`/minifiguras/${encodeURIComponent(id)}/brickset`);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? 'BRICKSET_NO_DISPONIBLE');
    }
    formCategoriaInput.value = result.categoria;
    formSubcategoriaInput.value = result.subcategoria ?? '';
    formAnioInput.value = result.anio;
    formPrecioInput.value = result.precio;
    showToast('Datos de Brickset actualizados.', 'success');
  } catch {
    showToast('No se pudieron consultar los datos en Brickset.', 'error');
  } finally {
    lookupBricksetButton.disabled = false;
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
    const response = await fetch(`/minifiguras/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
    await loadCatalog(currentFilters);
    showToast('Minifigura eliminada correctamente.', 'success');
  } catch {
    showToast('No se pudo conectar con el servidor. Intentalo de nuevo.', 'error');
  } finally {
    deleteConfirmButton.disabled = false;
  }
});

async function initialize() {
  if (await loadCategorias()) {
    await loadCatalog();
  }
}

setCategoriaControlsEnabled(false);
initialize();
