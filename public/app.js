const configuredApiBaseUrl = window.MINIPEOPLEDB_API_BASE_URL ?? '';
let apiBaseUrl = '';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (configuredApiBaseUrl !== '') {
  let parsedApiBaseUrl;
  try {
    parsedApiBaseUrl = new URL(configuredApiBaseUrl);
  } catch {
    throw new Error('La URL base de la API no es válida.');
  }
  if (parsedApiBaseUrl.protocol !== 'https:' || parsedApiBaseUrl.username || parsedApiBaseUrl.password
    || parsedApiBaseUrl.pathname !== '/' || parsedApiBaseUrl.search || parsedApiBaseUrl.hash) {
    throw new Error('La URL base de la API debe ser un origen HTTPS sin credenciales ni ruta.');
  }
  apiBaseUrl = parsedApiBaseUrl.origin;
}

function apiUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    throw new Error('La ruta de la API no es válida.');
  }
  return apiBaseUrl ? new URL(path, apiBaseUrl).toString() : path;
}

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
const collectionTotalUpdated = document.querySelector('#collection-total-updated');
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
const bricksetLoading = document.querySelector('#brickset-loading');

const deleteDialog = document.querySelector('#delete-dialog');
const deleteMessage = document.querySelector('#delete-message');
const deleteConfirmButton = document.querySelector('#delete-confirm');
const deleteCancelButton = document.querySelector('#delete-cancel');

const imageModal = document.querySelector('#image-modal');
const imageModalTitle = document.querySelector('#image-modal-title');
const imageModalName = document.querySelector('#image-modal-name');
const imageModalImage = document.querySelector('#image-modal-image');
const imageModalCloseButton = document.querySelector('#image-modal-close');
const imageFallbackUrl = '/logo_images/image_fallback.png';
let imageModalImageSequence = 0;

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
const gamificationDnaPrincipal = document.querySelector('#gamification-dna-principal');
const gamificationBricks = document.querySelector('#gamification-bricks');
const gamificationDialogBricks = document.querySelector('#gamification-dialog-bricks');
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
const gamificationDialogTitle = document.querySelector('#gamification-dialog-title');
const achievementsStatus = document.querySelector('#achievements-status');
const gamificationDialogLevel = document.querySelector('#gamification-dialog-level');
const achievementsOpenButton = document.querySelector('#open-achievements');
const achievementsHeadingImage = document.querySelector('.achievements-heading-icon');
const gamificationAchievements = document.querySelector('#gamification-achievements');
const gamificationCloseButton = document.querySelector('#gamification-close');
const notificationsOpenButton = document.querySelector('#open-notifications');
const friendsOpenButton = document.querySelector('#open-friends');
const friendsDialog = document.querySelector('#friends-dialog');
const friendsCloseButton = document.querySelector('#friends-close');
const publicProfileDialog = document.querySelector('#public-profile-dialog');
const publicProfileCloseButton = document.querySelector('#public-profile-close');
const publicProfileRetryButton = document.querySelector('#public-profile-retry');
const publicProfileTitle = document.querySelector('#public-profile-title');
const publicProfileAvatar = document.querySelector('#public-profile-avatar');
const publicProfileAvatarFallback = document.querySelector('#public-profile-avatar-fallback');
const publicProfileStatus = document.querySelector('#public-profile-status');
const publicProfileContent = document.querySelector('#public-profile-content');
const friendsTabButtons = [...document.querySelectorAll('[data-friends-tab]')];
const friendsSearchInput = document.querySelector('#friends-search');
let friendsTrigger = null;
let friendsActiveTab = 'friends';
let friendsRequestSequence = 0;
let friendsCountsSequence = 0;
let friendsSearchSequence = 0;
let friendsSearchTimer = null;
let publicProfileTrigger = null;
let publicProfileRequestSequence = 0;
let publicProfileUserId = null;
let publicProfileData = null;
let publicProfileDnaInstance = null;
const friendsActionRequests = new Set();
const friendsActionErrors = new Map();
const friendsRows = { friends: new Map(), sent: new Map(), received: new Map(), search: new Map() };
const notificationsUnreadBadge = document.querySelector('#notifications-unread-badge');
const notificationsDialog = document.querySelector('#notifications-dialog');
const notificationsCloseButton = document.querySelector('#notifications-close');
const notificationsMarkAllButton = document.querySelector('#notifications-mark-all');
const notificationsStatus = document.querySelector('#notifications-status');
const notificationsList = document.querySelector('#notifications-list');
const notificationsPushControls = document.querySelector('#notifications-push-controls');
const notificationsPushEnableButton = document.querySelector('#notifications-push-enable');
const notificationsPushStatus = document.querySelector('#notifications-push-status');
const dnaDialog = document.querySelector('#dna-dialog');
const dnaDialogCloseButton = document.querySelector('#dna-close');
const dnaDialogStatus = document.querySelector('#dna-status');
const dnaChart = document.querySelector('#dna-chart');
const dnaLegend = document.querySelector('#dna-legend');
const dnaRetryButton = document.querySelector('#dna-retry');
const rankingDialog = document.querySelector('#ranking-dialog');
const rankingCloseButton = document.querySelector('#ranking-close');
const rankingOpenButton = document.querySelector('#open-global-ranking');
const weeklyRankingDialog = document.querySelector('#weekly-ranking-dialog');
const weeklyRankingCloseButton = document.querySelector('#weekly-ranking-close');
const weeklyRankingOpenButton = document.querySelector('#open-weekly-ranking');
const weeklyRankingStatus = document.querySelector('#weekly-ranking-status');
const weeklyRankingList = document.querySelector('#weekly-ranking-list');
const dnaOpenButtons = [document.querySelector('#open-dna-inline'), document.querySelector('#open-dna')];
const rankingStatus = document.querySelector('#ranking-status');
const globalRankingList = document.querySelector('#global-ranking-list');
const rankingOrderButtons = [...document.querySelectorAll('[data-ranking-criterion]')];
const rankingMainGlobe = document.querySelector('#ranking-main-globe');
const analyticsHistoryDialog = document.querySelector('#analytics-history-dialog');
const analyticsHistoryOpenButton = document.querySelector('#open-analytics-history');
const analyticsHistoryCloseButton = document.querySelector('#analytics-history-close');
const analyticsHistoryRangeButtons = [...document.querySelectorAll('[data-history-days]')];
const analyticsHistoryStatus = document.querySelector('#analytics-history-status');
const analyticsHistoryRetryButton = document.querySelector('#analytics-history-retry');
const analyticsHistoryValueCanvas = document.querySelector('#analytics-history-value-chart');
const analyticsHistoryValueTableBody = document.querySelector('#analytics-history-value-table tbody');
const analyticsHistoryDnaCanvas = document.querySelector('#analytics-history-dna-chart');
const analyticsHistoryDnaTableBody = document.querySelector('#analytics-history-dna-table tbody');
const analyticsHistoryProgressionCanvas = document.querySelector('#analytics-history-progression-chart');
const analyticsHistoryProgressionTableBody = document.querySelector('#analytics-history-progression-table tbody');

const pageShell = document.querySelector('.page-shell');
const authScreen = document.querySelector('#auth-screen');
const authMessage = document.querySelector('#auth-message');
const authRetryButton = document.querySelector('#auth-retry');
const loginButton = document.querySelector('#login-google');
const authAccessPanel = document.querySelector('#auth-access-panel');
const authModeLoginButton = document.querySelector('#auth-mode-login');
const authModeRegisterButton = document.querySelector('#auth-mode-register');
const classicAuthForm = document.querySelector('#classic-auth-form');
const authUsernameField = document.querySelector('#auth-username-field');
const authUsernameInput = document.querySelector('#auth-username');
const authEmailInput = document.querySelector('#auth-email');
const authPasswordInput = document.querySelector('#auth-password');
const authPasswordRepeatInput = document.querySelector('#auth-password-repeat');
const authShowPasswordButtons = [...document.querySelectorAll('.auth-password-visibility')];
const classicAuthSubmit = document.querySelector('#classic-auth-submit');
const openPasswordRecoveryButton = document.querySelector('#open-password-recovery');
const passwordRecoveryForm = document.querySelector('#password-recovery-form');
const recoveryEmailInput = document.querySelector('#recovery-email');
const cancelPasswordRecoveryButton = document.querySelector('#cancel-password-recovery');
const passwordUpdateForm = document.querySelector('#password-update-form');
const newPasswordInput = document.querySelector('#new-password');
const profileCheckRetryButton = document.querySelector('#profile-check-retry');
const logoutButton = document.querySelector('#logout');
const userName = document.querySelector('#user-name');
const userProfile = document.querySelector('#user-profile');
const userMenuToggle = document.querySelector('#user-menu-toggle');
const userSession = document.querySelector('.user-session');
const userAvatar = document.querySelector('#user-avatar');
const openUserSettingsButton = document.querySelector('#open-user-settings');
const profileDialog = document.querySelector('#user-profile-dialog');
const profileDialogTitle = document.querySelector('#user-profile-dialog-title');
const profileDialogCloseButton = document.querySelector('#user-profile-close');
const profileForm = document.querySelector('#user-profile-form');
const openDeleteAccountButton = document.querySelector('#open-delete-account');
const deleteAccountDialog = document.querySelector('#delete-account-dialog');
const deleteAccountConfirmButton = document.querySelector('#delete-account-confirm');
const deleteAccountCancelButton = document.querySelector('#delete-account-cancel');
const deleteAccountError = document.querySelector('#delete-account-error');
const profileUsernameInput = document.querySelector('#profile-username');
const profileAvatarInput = document.querySelector('#profile-avatar-url');
const profileAvatarFileInput = document.querySelector('#profile-avatar-file');
const profileAvatarLoadButton = document.querySelector('#profile-avatar-load');
const profileAvatarRemoveButton = document.querySelector('#profile-avatar-remove');
const profileAvatarPreview = document.querySelector('#profile-avatar-preview');
const profileAvatarPlaceholder = document.querySelector('#profile-avatar-placeholder');
const profileCurrencyInput = document.querySelector('#profile-currency');
const profileLanguageInput = document.querySelector('#profile-language');
const profileFavoriteSearch = document.querySelector('#profile-favorite-search');
const profileFavoriteCategories = document.querySelector('#profile-favorite-categories');
const profileSelectedCategories = document.querySelector('#profile-selected-categories');
const profileFavoritesCount = document.querySelector('#profile-favorites-count');
const profileFormMessage = document.querySelector('#profile-form-message');
const profileSaveButton = document.querySelector('#user-profile-save');
userAvatar.addEventListener('error', () => {
  userAvatar.hidden = true;
});
const SESSION_EXPIRED_MESSAGE = 'Tu sesión ha caducado. Inicia sesión de nuevo.';
const GAMIFICATION_UI_VERSION = 'v2';
const GAMIFICATION_UI_VERSION_KEY = 'minipeople.gamificationVersion';
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

const ERROR_MESSAGES = {
  ID_INVALIDO: 'El ID proporcionado no tiene un formato válido.',
  MINIFIGURA_INVALIDA: 'Los datos de la minifigura no son válidos.',
  ID_DUPLICADO: 'Esta minifigura ya está registrada en tu inventario.',
  MINIFIGURA_NO_ENCONTRADA: 'La minifigura ya no existe.',
  CATALOGO_NO_DISPONIBLE: 'El catálogo no está disponible en este momento.',
  CATALOGO_INVALIDO: 'El catálogo no tiene un formato válido.',
  CATEGORIAS_NO_DISPONIBLES: 'El catálogo de categorías no está disponible en este momento.',
  CATEGORIAS_INVALIDOS: 'El catálogo de categorías no tiene un formato válido.',
};

let requestSequence = 0;
let authMode = 'login';
let pendingRegistrationUsername = '';
let activeFilters = {};
let catalogCache = [];
let currentCatalog = [];
let currentEditId = null;
let currentFormMode = null;
let formSynced = false;
let imageLookupSequence = 0;
let formTrigger = null;
let formSending = false;
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
const nativeAuth = window.NativeAuth?.isNative() ? window.NativeAuth : null;
const nativePush = window.NativePush?.isNative() ? window.NativePush : null;
let nativePushRegistration = null;
let pendingPushNotificationId = null;
let nativePushListenersRegistered = false;
const receivedPushNotificationIds = new Set();
const pushRevocationAttempts = new Set();
try {
  nativePushRegistration = nativePush?.createRegistrationLifecycle() ?? null;
} catch {
  nativePushRegistration = null;
}
const nativeOAuthRedirectUrl = 'com.mrdusik.minipeopledb://auth/callback';
let pendingNativeOAuthCallbackUrl = null;
let nativeOAuthPending = false;
let nativeOAuthFinishTimer = null;
let nativeAppUrlListenerRegistered = false;
let nativeBrowserFinishedListenerRegistered = false;
let appStarted = false;
let lastCollectionTotal = null;
let profileRequestSequence = 0;
let profileReadyUserId = null;
let currentUserProfile = null;
let profileDialogMode = 'settings';
let profileDialogTrigger = null;
let accountDeletionUserId = null;
let accountDeletionInFlight = false;
let selectedProfileFavorites = new Set();
let pendingProfileAvatarFile = null;
let profileAvatarReadSequence = 0;
let syncPollTimer = null;
let syncPausedByModal = false;
let rankingEntries = [];
let defaultRankingEntries = [];
let rankingRequestId = 0;
let selectedRankingCriterion = 'nivel';
let expandedRankingUserId = null;
let weeklyRankingEntries = [];
let weeklyRankingRequestId = 0;
let expandedWeeklyRankingUserId = null;
let weeklyRankingTrigger = null;
let ownGamification = null;
let ownDnaState = null;
let dnaDialogTrigger = null;
let gamificationRequestSequence = 0;
let dnaRequestSequence = 0;
let achievementsTrigger = null;
let achievementsMode = 'own';
let achievementsViewSequence = 0;
let featuredMutationSequence = 0;
let featuredSessionSequence = 0;
let featuredSaving = false;
let notificationsTrigger = null;
let notificationsItems = [];
let notificationsNextCursor = null;
let notificationsHasMore = true;
let notificationsLoading = false;
let notificationsRequestSequence = 0;
let notificationsChannel = null;
let notificationsChannelConnected = false;
const notificationThankRequests = new Set();
const notificationThankErrors = new Map();
const notificationFriendAcceptRequests = new Set();
const notificationFriendAcceptErrors = new Map();
const notificationReadRequests = new Set();
const notificationReadErrors = new Map();
const notificationToastIds = new Set();
let pendingNotificationToasts = [];
let notificationsClock = () => new Date();
let analyticsHistoryRequestSequence = 0;
let analyticsHistoryTrigger = null;
let analyticsHistoryRange = null;
let analyticsHistoryData = null;

formAnioInput.max = String(currentYear);

function selectedStateFilters() {
  return {
    estadoColeccion: collectionFilterInput.checked === wantedFilterInput.checked
      ? ''
      : collectionFilterInput.checked ? 'COLECCIÓN' : 'BUSCADA',
    observada: observedFilterInput.checked ? 'true' : '',
  };
}

function catalogMatchingStateFilters() {
  return catalogForOptions.filter((minifigura) => matchesClientFilters(minifigura, selectedStateFilters()));
}

function formatFilterOption(nombre, count, total) {
  if (!Number.isInteger(total) || total <= 0) return `${nombre} (${count})`;
  const percentage = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(count * 100 / total);
  return `${nombre}: ${count} de ${total} (${percentage}%)`;
}

function renderSubcategoryOptions(selectElement, categoria, placeholderText) {
  const previousValue = selectElement.value;
  const matchingCatalog = catalogMatchingStateFilters().filter((minifigura) => !categoria || minifigura.categoria === categoria);
  const subcategorias = [...new Map(
    (categoria ? matchingCatalog : [])
      .filter((minifigura) => minifigura.subcategoria)
      .map((minifigura) => [minifigura.subcategoria, 0]),
  ).keys()];
  const counts = new Map(subcategorias.map((subcategoria) => [subcategoria, matchingCatalog.filter((minifigura) => minifigura.subcategoria === subcategoria).length]));
  const officialSubcategories = officialCategorias.find((item) => item.categoria === categoria)?.subcategorias ?? [];
  selectElement.replaceChildren(new Option(`${placeholderText} (${matchingCatalog.length})`, ''));
  for (const subcategoria of subcategorias.sort()) {
    const total = officialSubcategories.find((item) => item.subcategoria === subcategoria)?.total;
    selectElement.append(new Option(formatFilterOption(subcategoria, counts.get(subcategoria), total), subcategoria));
  }
  selectElement.value = subcategorias.includes(previousValue) ? previousValue : '';
  selectElement.disabled = !categoriasReady || subcategorias.length === 0;
}

function renderCategoryOptions(categorias) {
  const matchingCatalog = catalogMatchingStateFilters();
  const categoryCounts = new Map();
  for (const minifigura of matchingCatalog) {
    categoryCounts.set(minifigura.categoria, (categoryCounts.get(minifigura.categoria) ?? 0) + 1);
  }
  const categoryNames = [...categoryCounts.keys()].sort();

  const selectedCategoria = categoriaInput.value;
  categoriaInput.replaceChildren(new Option(`Todas (${matchingCatalog.length})`, ''));
  for (const categoria of categoryNames) {
    const total = categorias.find((item) => item.categoria === categoria)?.total;
    categoriaInput.append(new Option(formatFilterOption(categoria, categoryCounts.get(categoria), total), categoria));
  }
  categoriaInput.value = categoryNames.includes(selectedCategoria) ? selectedCategoria : '';
  renderSubcategoryOptions(subcategoriaInput, categoriaInput.value, 'Todas');
}

function renderYearOptions() {
  const previousValue = anioInput.value;
  const matchingCatalog = catalogMatchingStateFilters().filter((minifigura) => matchesClientFilters(minifigura, {
    categoria: categoriaInput.value,
    subcategoria: subcategoriaInput.value,
  }));
  const yearCounts = new Map();
  for (const { anio } of matchingCatalog) {
    if (Number.isInteger(anio) && anio > 0) yearCounts.set(anio, (yearCounts.get(anio) ?? 0) + 1);
  }
  anioInput.replaceChildren(new Option(`Todos (${matchingCatalog.length})`, ''));
  for (const anio of [...yearCounts.keys()].sort((left, right) => right - left)) {
    anioInput.append(new Option(`${anio} (${yearCounts.get(anio)})`, String(anio)));
  }
  anioInput.value = yearCounts.has(Number(previousValue)) ? previousValue : '';
}

function renderDynamicFilterOptions(catalog) {
  catalogForOptions = catalog;
  renderCategoryOptions(officialCategorias);
  renderYearOptions();
}

function setCategoriaControlsEnabled(enabled) {
  categoriaInput.disabled = !enabled;
  renderSubcategoryOptions(subcategoriaInput, categoriaInput.value, 'Todas');
  newMinifiguraButton.disabled = !enabled;
  syncPricesButton.disabled = !enabled || isSyncingPrices;
}

categoriaInput.addEventListener('change', () => {
  renderSubcategoryOptions(subcategoriaInput, categoriaInput.value, 'Todas');
  renderYearOptions();
});

subcategoriaInput.addEventListener('change', renderYearOptions);
[collectionFilterInput, wantedFilterInput, observedFilterInput].forEach((input) => {
  input.addEventListener('change', () => renderDynamicFilterOptions(catalogCache));
});

async function loadCategorias() {
  try {
    const response = await fetch(apiUrl('/categorias'));
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
    0: '/level_images/0_duplo.png',
    1: '/level_images/1_stud.png',
    2: '/level_images/2_plate.png',
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
    18: '/level_images/18_technic.png',
    19: '/level_images/19_majisto.png',
    20: '/level_images/20_castleknight.png',
    21: '/level_images/21_chromegold.png',
    22: '/level_images/22_woodenduck.png',
    23: '/level_images/23_billund.png',
    24: '/level_images/24_mrkirk.png',
    25: '/level_images/25_mrgold.png',
  };
  return images[levelId] || images[0];
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
  updateRankingWantedActions();
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
    setStatus('');
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
  await revalidate({ notifyAchievements: true });
  const sinPrecio = state.sinPrecio?.length ?? 0;
  showToast(`Actualización de precios terminada: ${state.actualizados.length} actualizadas, ${sinPrecio} sin precio publicado, ${state.fallidos.length} fallidas.`, 'success');
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
    showToast('No se pudieron actualizar los precios.', 'error');
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
  await loadGamificationDna();
  return catalog;
}

// Keeps the locally applied state if the catalog cannot be refreshed.
async function revalidate({ notifyAchievements = false } = {}) {
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
    loadGamification({ notifyAchievements }),
    loadGlobalRanking({ showState: false }),
  ]);
  await loadGamificationDna();
}

async function loadTotal() {
  try {
    const response = await apiFetch('/valoracion');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const summary = await response.json();
    const total = summary.total ?? 0;
    if (lastCollectionTotal === null || total !== lastCollectionTotal) {
      lastCollectionTotal = total;
      collectionTotalUpdated.textContent = formatCollectionTotalUpdatedAt(new Date());
    }
    collectionTotal.textContent = formatPrice(total);
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

function formatCollectionTotalUpdatedAt(date) {
  const [year, month, day] = madridDateString(date).split('-');
  const time = notificationClockTime(date).replace(':', '.');
  return `Última actualización: ${day}/${month}/${year} a las ${time}`;
}

function renderGamification(state) {
  ownGamification = { ...state, logrosDestacados: state.logrosDestacados ?? ownGamification?.logrosDestacados ?? [] };
  const level = state.nivel ?? { id: 0, nombre: 'Duplo' };
  const imagePath = levelImagePath(level.id);
  gamificationLevelImage.src = imagePath;
  gamificationLevelTooltipImage.src = imagePath;
  gamificationLevelTooltipImage.alt = `Nivel ${level.id} ${level.nombre}`;
  gamificationLevelNumber.textContent = level.id;
  gamificationLevelName.textContent = level.nombre;
  gamificationBricks.textContent = `${state.bricks ?? 0}`;
  gamificationProgress.value = state.progreso?.porcentaje ?? 0;
  gamificationPercentage.textContent = `${Math.round(gamificationProgress.value)}%`;
  gamificationPercentage.classList.toggle('on-accent', gamificationProgress.value >= 50);
  gamificationProgress.setAttribute('aria-valuetext', `${gamificationProgress.value}%`);
  gamificationNext.textContent = state.siguienteNivel
    ? `Próximo nivel: ${state.siguienteNivel.id} ${state.siguienteNivel.nombre}`
    : 'Nivel máximo alcanzado';
  if (!gamificationDialog.open || achievementsMode === 'own') {
    renderAchievements(ownGamification, 'Logros', { editable: true });
  }
}

function renderGamificationDna(state) {
  ownDnaState = state;
  const principal = state?.principal ?? 'DNA no disponible';
  gamificationDnaPrincipal.textContent = principal;
  const primaryPercentage = document.querySelector('#gamification-dna-percentage');
  const primaryTrait = DNA_TRAITS.find(({ name }) => name === principal);
  const hasPercentages = primaryTrait && state?.porcentajes;
  primaryPercentage.hidden = !hasPercentages;
  primaryPercentage.textContent = '';
  let summary = principal;
  if (hasPercentages) {
    const formatPercentage = (key) => `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(state.porcentajes[key] ?? 0)}%`;
    primaryPercentage.textContent = `${formatPercentage(primaryTrait.key)} `;
    summary = `${primaryPercentage.textContent}${principal}`;
  }
  dnaOpenButtons[0].setAttribute('aria-label', `Abrir DNA: ${summary}`);
  dnaOpenButtons[0].title = summary;
}

const DNA_TRAITS = [
  { key: 'rarityHunter', name: 'Rarity Hunter', description: 'Busca piezas raras y valiosas.', color: 'rarity' },
  { key: 'explorer', name: 'Explorer', description: 'Descubre categorías y subcategorías.', color: 'explorer' },
  { key: 'collector', name: 'Collector', description: 'Amplía y completa la colección.', color: 'collector' },
  { key: 'fan', name: 'Fan', description: 'Muestra afinidad por temáticas.', color: 'fan' },
];

let dnaChartInstance = null;

function destroyDnaChart() {
  dnaChartInstance?.destroy();
  dnaChartInstance = null;
}

function renderDnaLoading() {
  destroyDnaChart();
  dnaDialogStatus.textContent = 'Cargando DNA...';
  dnaDialogStatus.classList.add('loading-message');
  dnaChart.hidden = true;
  dnaLegend.hidden = true;
  dnaLegend.replaceChildren();
  dnaRetryButton.hidden = true;
}

function renderDnaError() {
  destroyDnaChart();
  dnaDialogStatus.classList.remove('loading-message');
  dnaDialogStatus.textContent = 'No se pudo cargar el DNA.';
  dnaChart.hidden = true;
  dnaLegend.hidden = true;
  dnaRetryButton.hidden = false;
}

function renderDnaDialog(state) {
  destroyDnaChart();
  dnaChartInstance = renderDnaView(state, {
    chart: dnaChart, status: dnaDialogStatus, legend: dnaLegend,
    canvas: document.querySelector('#dna-canvas'), centerLabel: document.querySelector('#dna-chart .dna-chart-label'),
    percentageLabel: document.querySelector('#dna-chart-percentage'), traitLabel: document.querySelector('#dna-chart-trait'),
  });
  dnaRetryButton.hidden = true;
}

function renderDnaView(state, { chart, status, legend, canvas, centerLabel, percentageLabel, traitLabel }) {
  status?.classList.remove('loading-message');
  const isNewbie = state.principal === 'Newbie';
  chart.hidden = false;
  chart.classList.toggle('dna-chart-empty', isNewbie);
  chart.setAttribute('aria-label', isNewbie
    ? 'DNA Newbie: cuatro proporciones en cero'
    : `DNA de tu colección: ${DNA_TRAITS.map(({ key, name }) => `${name} ${state.porcentajes[key]}%`).join(', ')}`);
  if (status) status.textContent = isNewbie ? 'Newbie' : '';
  if (centerLabel) centerLabel.hidden = false;
  const principal = DNA_TRAITS.find(({ name }) => name === state.principal);
  if (percentageLabel) percentageLabel.textContent = isNewbie
    ? '0%'
    : `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(state.porcentajes[principal?.key] ?? 0)}%`;
  if (traitLabel) traitLabel.textContent = state.principal;
  let instance = null;
  if (!isNewbie && typeof Chart === 'function') {
    const styles = getComputedStyle(document.documentElement);
    instance = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: DNA_TRAITS.map(({ name }) => name),
        datasets: [{
          data: DNA_TRAITS.map(({ key }) => state.porcentajes[key]),
          backgroundColor: DNA_TRAITS.map(({ color }) => styles.getPropertyValue(`--dna-${color}`).trim()),
          borderColor: '#ffffff', borderWidth: 3, hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%', animation: false,
        layout: { padding: 8 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#202124', padding: 12, cornerRadius: 6,
            external({ tooltip }) { if (centerLabel) centerLabel.hidden = tooltip.opacity > 0; },
            callbacks: { label: (item) => `${item.label}: ${formatAnalyticsHistoryPercent(item.raw)}` },
          },
        },
      },
    });
  }
  const traitsByPercentage = DNA_TRAITS
    .map((trait, index) => ({ trait, index }))
    .sort((left, right) => state.porcentajes[right.trait.key] - state.porcentajes[left.trait.key] || left.index - right.index)
    .map(({ trait }) => trait);
  legend?.replaceChildren(...traitsByPercentage.map(({ key, name, description, color }) => {
    const item = document.createElement('li');
    item.className = 'dna-legend-item';
    const swatch = document.createElement('span');
    swatch.className = `dna-swatch dna-swatch-${color}`;
    swatch.setAttribute('aria-hidden', 'true');
    const label = document.createElement('strong');
    label.textContent = name;
    const percentage = document.createElement('strong');
    percentage.className = 'dna-percentage';
    percentage.textContent = `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(state.porcentajes[key])}%`;
    const detail = document.createElement('span');
    detail.className = 'dna-description';
    detail.textContent = description;
    item.append(swatch, label, percentage, detail);
    return item;
  }));
  if (legend) legend.hidden = false;
  return instance;
}

async function loadDnaDialog() {
  if (dnaDialog.open) await loadGamificationDna(true);
}

function openDnaDialog(trigger) {
  dnaDialogTrigger = trigger;
  renderDnaLoading();
  dnaDialog.showModal();
  dnaDialogCloseButton.focus();
  void loadDnaDialog();
}

function compareAchievements(left, right) {
  return Number(right.destacado === true) - Number(left.destacado === true)
    || Number(left.type === 'regalo') - Number(right.type === 'regalo')
    || (right.total ?? 0) - (left.total ?? 0);
}

function sortedAchievements(logros, selectedIds) {
  const selected = Array.isArray(selectedIds) ? new Set(selectedIds) : null;
  return logros.map((logro) => ({ ...logro, destacado: selected ? selected.has(logro.id) : logro.destacado === true }))
    .sort(compareAchievements);
}

function renderAchievements(state, title = 'Logros', { editable = false } = {}) {
  const mode = editable ? 'own' : 'public';
  if (achievementsMode !== mode) achievementsViewSequence += 1;
  achievementsMode = mode;
  const level = state.nivel ?? { id: 0, nombre: 'Duplo' };
  gamificationDialogTitle.textContent = title;
  achievementsHeadingImage.src = levelImagePath(level.id);
  gamificationDialogLevel.textContent = `${level.id} ${level.nombre}`;
  gamificationDialogBricks.textContent = `${state.bricks ?? 0}`;
  achievementsStatus.textContent = state.logros?.length ? '' : 'No hay logros.';
  gamificationAchievements.replaceChildren();
  const achievements = sortedAchievements(state.logros ?? [], editable ? state.logrosDestacados ?? [] : undefined);
  for (const logro of achievements) {
    gamificationAchievements.append(createAchievementItem(logro, { editable }));
  }
}

async function saveFeaturedAchievement(id, destacado) {
  if (featuredSaving || achievementsMode !== 'own' || !gamificationDialog.open || !currentSession) return;
  if (destacado && (ownGamification?.logrosDestacados?.length ?? 0) >= 5) {
    achievementsStatus.textContent = 'Puedes destacar hasta 5 logros';
    return;
  }
  const userId = currentSession.user.id;
  const sessionSequence = featuredSessionSequence;
  const viewSequence = achievementsViewSequence;
  const sequence = ++featuredMutationSequence;
  gamificationRequestSequence += 1;
  featuredSaving = true;
  achievementsStatus.textContent = '';
  for (const button of gamificationAchievements.querySelectorAll('.achievement-star-toggle')) button.disabled = true;
  const isCurrent = () => sequence === featuredMutationSequence && sessionSequence === featuredSessionSequence
    && currentSession?.user?.id === userId;
  const isCurrentView = () => isCurrent() && gamificationDialog.open && achievementsMode === 'own'
    && viewSequence === achievementsViewSequence;
  try {
    const response = await apiFetch(`/gamificacion/logros/${encodeURIComponent(id)}/destacado`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ destacado }),
    });
    const result = await response.json();
    if (!isCurrent()) return;
    if (!response.ok) throw new Error(result.error === 'LIMITE_LOGROS_DESTACADOS'
      ? 'Puedes destacar hasta 5 logros' : 'No se ha podido guardar el logro destacado.');
    if (!Array.isArray(result.logrosDestacados) || result.logrosDestacados.length > 5
      || new Set(result.logrosDestacados).size !== result.logrosDestacados.length
      || result.logrosDestacados.some((value) => typeof value !== 'string')) throw new Error('No se ha podido guardar el logro destacado.');
    ownGamification = { ...ownGamification, logrosDestacados: result.logrosDestacados };
    if (isCurrentView()) {
      featuredSaving = false;
      renderAchievements(ownGamification, 'Logros', { editable: true });
      [...gamificationAchievements.querySelectorAll('.achievement-star-toggle')]
        .find((button) => button.dataset.featuredId === id)?.focus();
    }
  } catch (error) {
    if (isCurrentView()) achievementsStatus.textContent = error.message || 'No se ha podido guardar el logro destacado.';
  } finally {
    if (isCurrent()) {
      featuredSaving = false;
      gamificationRequestSequence += 1;
      if (achievementsMode === 'own') {
        for (const button of gamificationAchievements.querySelectorAll('.achievement-star-toggle')) button.disabled = false;
        if (gamificationDialog.open && viewSequence !== achievementsViewSequence) void loadGamification();
      }
    }
  }
}

function resetFeaturedAchievements() {
  featuredSessionSequence += 1;
  featuredMutationSequence += 1;
  achievementsViewSequence += 1;
  featuredSaving = false;
  achievementsMode = 'none';
}

function createAchievementItem(logro, { editable = false } = {}) {
    const item = document.createElement('li');
    item.className = 'achievement-item';

    const icon = document.createElement('img');
    icon.className = 'achievement-icon';
    if (logro.type === 'regalo') {
      icon.src = '/toast_images/regalo.png';
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
    count.textContent = `x${logro.cantidad ?? 0}`;

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
    if (editable || logro.destacado === true) {
      const star = document.createElement(editable ? 'button' : 'span');
      star.className = `achievement-star ${logro.destacado ? 'active' : 'inactive'}`;
      const symbol = document.createElement('span');
      symbol.className = 'achievement-star-image';
      symbol.setAttribute('aria-hidden', 'true');
      star.append(symbol);
      if (editable) {
        star.type = 'button';
        star.classList.add('achievement-star-toggle');
        star.dataset.featuredId = logro.id;
        star.title = logro.destacado ? 'Quitar destacado' : 'Destacar';
        star.setAttribute('aria-label', star.title);
        star.setAttribute('aria-pressed', String(logro.destacado === true));
        star.disabled = featuredSaving;
        star.addEventListener('click', () => { void saveFeaturedAchievement(logro.id, !logro.destacado); });
      } else {
        star.setAttribute('role', 'img');
        star.setAttribute('aria-label', 'Logro destacado');
        star.title = 'Logro destacado';
      }
      item.append(star);
    }
    return item;
}

function newGamificationAchievements(previous, next) {
  if (!previous || !Array.isArray(previous.logros) || !Array.isArray(next?.logros)) return [];
  const previousCounts = new Map(previous.logros.map((logro) => [logro.id, logro.cantidad ?? 0]));
  return next.logros.flatMap((logro) => {
    const cantidadNueva = (logro.cantidad ?? 0) - (previousCounts.get(logro.id) ?? 0);
    if (cantidadNueva <= 0) return [];
    return [{
      ...logro,
      cantidadNueva,
      bricksNuevos: cantidadNueva * (Number.isFinite(logro.bricks) ? logro.bricks : 0),
    }];
  });
}

async function loadGamification({ notifyAchievements = false } = {}) {
  if (featuredSaving) return;
  const sessionUserId = currentSession?.user?.id;
  const previousState = ownGamification;
  const sequence = ++gamificationRequestSequence;
  try {
    const response = await apiFetch('/gamificacion');
    if (!response.ok) throw new Error('GAMIFICACION_NO_DISPONIBLE');
    const state = await response.json();
    if (sequence !== gamificationRequestSequence || sessionUserId !== currentSession?.user?.id) return;
    const stateInvalidated = invalidateClientStateForGamificationVersion();
    if (notifyAchievements && previousState && !stateInvalidated) {
      showGamificationToasts({ logrosNuevos: newGamificationAchievements(previousState, state), nivelesAlcanzados: [] });
    }
    renderGamification(state);
  } catch {
    if (sequence !== gamificationRequestSequence || sessionUserId !== currentSession?.user?.id) return;
    gamificationLevelNumber.textContent = '';
    gamificationLevelName.textContent = 'Nivel no disponible';
    gamificationBricks.textContent = '0';
    if (!gamificationDialog.open || achievementsMode === 'own') {
      gamificationDialogLevel.textContent = 'Nivel no disponible';
      gamificationDialogBricks.textContent = '0';
    }
    gamificationProgress.value = 0;
    gamificationPercentage.textContent = '0%';
    gamificationPercentage.classList.remove('on-accent');
    gamificationNext.textContent = 'Progreso no disponible';
  }
}

async function loadGamificationDna(showLoading = false) {
  const sessionUserId = currentSession?.user?.id;
  const sequence = ++dnaRequestSequence;
  if (showLoading) renderDnaLoading();
  try {
    const response = await apiFetch('/gamificacion/dna');
    if (!response.ok) throw new Error('DNA_NO_DISPONIBLE');
    const state = await response.json();
    if (sequence !== dnaRequestSequence || sessionUserId !== currentSession?.user?.id) return;
    renderGamificationDna(state);
    if (dnaDialog.open) renderDnaDialog(state);
  } catch {
    if (sequence !== dnaRequestSequence || sessionUserId !== currentSession?.user?.id) return;
    if (!ownDnaState) gamificationDnaPrincipal.textContent = 'DNA no disponible';
    if (dnaDialog.open) renderDnaError();
  }
}

function refreshSocialGamification() {
  void loadGamification({ notifyAchievements: true });
  void loadGamificationDna();
}

function ownsMinifigura(id) {
  const canonicalId = String(id).trim().toUpperCase();
  return catalogCache.some((item) => String(item.id).trim().toUpperCase() === canonicalId);
}

function duplicateMinifiguraMessage(id) {
  const canonicalId = String(id).trim().toUpperCase();
  const existing = catalogCache.find((item) => String(item.id).trim().toUpperCase() === canonicalId);
  if (existing?.estadoColeccion === 'BUSCADA') return 'Ya la estás buscando';
  if (existing?.estadoColeccion === 'COLECCIÓN') return 'Ya está incluída en tu colección';
  return null;
}

function updateRankingWantedActions(list) {
  const cards = (list ? [list] : [globalRankingList, weeklyRankingList, publicProfileContent])
    .flatMap((root) => [...root.querySelectorAll('[data-ranking-id]')]);
  for (const card of cards) {
    const eligible = hasLoadedFullCatalog && currentSession && card.dataset.ownerUser !== currentSession.user.id && !ownsMinifigura(card.dataset.rankingId);
    const existing = card.querySelector('.ranking-add-wanted');
    if (!eligible) {
      existing?.remove();
      continue;
    }
    if (existing) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ranking-add-wanted';
    button.dataset.wantedId = card.dataset.rankingId;
    button.dataset.ownerUser = card.dataset.ownerUser;
    if (card.closest('#public-profile-content')) button.dataset.profileWanted = 'true';
    button.title = 'Añadir a buscadas';
    button.setAttribute('aria-label', 'Añadir a buscadas');
    const icon = document.createElement('img');
    icon.src = '/status_images/lupa.png';
    icon.alt = '';
    button.append(icon);
    card.append(button);
  }
}

function highlightGroup(title, items, mode, ownerUserId) {
  const section = document.createElement('section');
  section.className = 'ranking-highlight-group';
  const heading = document.createElement('h3');
  heading.textContent = `Top 5 ${title}`;
  const row = document.createElement('div');
  row.className = 'ranking-row';
  for (const [index, minifigura] of items.entries()) {
    const detail = mode === 'precio' ? formatPrice(minifigura.precio) : minifigura.anio;
    const card = rankingCard(minifigura, index + 1, detail, false);
    card.dataset.rankingId = minifigura.id;
    card.dataset.ownerUser = ownerUserId;
    row.append(card);
  }
  section.append(heading, row);
  return section;
}

function formatRankingDisplayName(displayName) {
  const [firstName, ...rest] = String(displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!firstName) return 'Usuario';
  return [firstName, ...rest.map((name) => `${Array.from(name)[0]}.`)].join(' ');
}

function setExpandedRankingUser(userId, list = globalRankingList) {
  const isWeekly = list === weeklyRankingList;
  const currentExpandedUserId = isWeekly ? expandedWeeklyRankingUserId : expandedRankingUserId;
  const nextExpandedUserId = currentExpandedUserId === userId ? null : userId;
  if (isWeekly) expandedWeeklyRankingUserId = nextExpandedUserId;
  else expandedRankingUserId = nextExpandedUserId;
  for (const entry of list.querySelectorAll('.global-ranking-entry')) {
    const expanded = entry.dataset.userId === nextExpandedUserId;
    entry.querySelector('.ranking-expand').setAttribute('aria-expanded', String(expanded));
    entry.querySelector('.ranking-user-details').hidden = !expanded;
  }
}

function renderGlobalRanking() {
  const currentUserId = currentSession?.user?.id;
  const currentUserIndex = defaultRankingEntries.findIndex(({ userId }) => userId === currentUserId);
  rankingMainGlobe.hidden = currentUserIndex === -1;
  rankingMainGlobe.querySelector('#ranking-main-position').textContent = currentUserIndex === -1
    ? '' : ['🥇', '🥈', '🥉'][currentUserIndex] ?? `#${currentUserIndex + 1}`;
  rankingMainGlobe.setAttribute('aria-label', currentUserIndex === -1
    ? 'En Top Global' : `En Top Global, posición ${currentUserIndex + 1}. Abrir Ranking Global`);
  renderRankingRows({
    entries: rankingEntries, list: globalRankingList, criterion: selectedRankingCriterion,
    expandedUserId: expandedRankingUserId, dialog: rankingDialog, closeButton: rankingCloseButton,
  });
}

function renderWeeklyRanking() {
  renderRankingRows({
    entries: weeklyRankingEntries, list: weeklyRankingList, criterion: 'nivel',
    expandedUserId: expandedWeeklyRankingUserId, dialog: weeklyRankingDialog,
    closeButton: weeklyRankingCloseButton, weekly: true,
  });
}

function appendRankingSummary(container, entry, positionText, criterion = 'nivel', weekly = false) {
  const position = document.createElement('strong');
  position.className = 'ranking-position';
  position.textContent = positionText;
  const avatarWrap = document.createElement('span');
  avatarWrap.className = 'ranking-avatar-wrap';
  const avatar = document.createElement('img');
  avatar.className = 'ranking-avatar';
  avatar.alt = '';
  const fallback = document.createElement('span');
  fallback.className = 'ranking-avatar-fallback';
  fallback.textContent = '👤';
  fallback.hidden = Boolean(entry.avatarUrl);
  avatar.hidden = !entry.avatarUrl;
  if (entry.avatarUrl) avatar.src = entry.avatarUrl;
  avatar.addEventListener('error', () => { avatar.hidden = true; fallback.hidden = false; });
  avatarWrap.append(avatar, fallback);
  const name = document.createElement('strong');
  name.className = 'ranking-name';
  name.textContent = formatRankingDisplayName(entry.displayName);
  const level = document.createElement('span');
  level.className = 'ranking-level-info';
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
  const dna = document.createElement('span');
  dna.className = 'ranking-dna-principal';
  dna.textContent = (entry.dnaPrincipal === 'Newbie' && ['nivel', 'coleccion'].includes(criterion)) || !entry.dnaRasgos?.length
    ? entry.dnaPrincipal ?? 'Newbie'
    : entry.dnaRasgos.slice(0, 2).map(({ nombre, porcentaje }) => (
      `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(porcentaje)}% ${nombre}`
    )).join(' / ');
  level.append(levelImage, levelNumber, levelName, dna);
  const bricks = document.createElement('span');
  bricks.className = 'gamification-bricks-value ranking-bricks';
  const bricksValue = document.createElement('strong');
  bricksValue.textContent = weekly && entry.bricksSemanales > 0 ? `+${entry.bricksSemanales}`
    : weekly ? String(entry.bricksSemanales) : entry.bricks;
  const brickIcon = document.createElement('img');
  brickIcon.className = 'gamification-brick-icon';
  brickIcon.src = '/toast_images/hero_2026-01-05_16-38-47-871.webp';
  brickIcon.alt = 'Bricks';
  bricks.append(bricksValue, brickIcon);
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
  container.append(position, avatarWrap, name, level, bricks, collection);
}

function renderRankingRows({ entries, list, criterion, expandedUserId, dialog, closeButton, weekly = false }) {
  const currentUserId = currentSession?.user?.id;
  const focused = document.activeElement;
  const focusedUserId = focused?.closest('.global-ranking-entry')?.dataset.userId;
  const focusSelector = focused?.matches('.ranking-gift') ? '.ranking-gift' : '.ranking-expand';
  const fragment = document.createDocumentFragment();
  for (const [index, entry] of entries.entries()) {
    const article = document.createElement('article');
    article.className = 'global-ranking-entry';
    article.dataset.userId = entry.userId;

    const row = document.createElement('div');
    row.className = 'global-ranking-row';
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = `ranking-expand${entry.userId === currentUserId ? ' ranking-expand-current' : ''}`;
    expand.setAttribute('aria-expanded', 'false');

    appendRankingSummary(expand, entry, `#${index + 1}`, criterion, weekly);
    const chevron = document.createElement('span');
    chevron.className = 'ranking-row-chevron';
    chevron.textContent = '▾';
    chevron.setAttribute('aria-hidden', 'true');
    expand.append(chevron);
    const summary = document.createElement('div');
    summary.className = 'ranking-summary';
    summary.append(expand);
    row.append(summary);

    if (entry.userId !== currentUserId) {
      const gift = document.createElement('button');
      gift.type = 'button';
      gift.className = 'button button-secondary ranking-gift';
      gift.dataset.giftUser = entry.userId;
      gift.disabled = entry.regaloEnviado;
      gift.setAttribute('aria-label', entry.regaloEnviado ? 'Regalo ya enviado' : `Enviar ${weekly ? 5 : 50} Bricks`);
      gift.title = entry.regaloEnviado ? 'Regalo ya enviado' : `Enviar ${weekly ? 5 : 50} Bricks`;
      const giftAmount = document.createElement('span');
      giftAmount.textContent = weekly ? '+5' : '+50';
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
      highlightGroup('por precio', (entry.top5Precio ?? []).slice(0, 5), 'precio', entry.userId),
      highlightGroup('por antigüedad', (entry.top5Antiguedad ?? []).slice(0, 5), 'antiguedad', entry.userId),
    );
    row.append(details);
    article.append(row);
    fragment.append(article);
  }
  list.replaceChildren(fragment);
  updateRankingWantedActions(list);
  for (const article of list.children) {
    const expanded = article.dataset.userId === expandedUserId;
    article.querySelector('.ranking-expand').setAttribute('aria-expanded', String(expanded));
    article.querySelector('.ranking-user-details').hidden = !expanded;
  }
  if (focusedUserId && dialog.open) {
    const entry = [...list.children].find((item) => item.dataset.userId === focusedUserId);
    (entry?.querySelector(focusSelector) ?? closeButton).focus();
  }
}

async function loadGlobalRanking({ showState = rankingDialog.open } = {}) {
  const sessionUserId = currentSession?.user?.id;
  const requestId = ++rankingRequestId;
  const criterio = selectedRankingCriterion;
  if (showState) {
    rankingStatus.textContent = 'Cargando Ranking...';
    rankingStatus.className = 'status loading-message';
    globalRankingList.replaceChildren();
  }
  try {
    const getRanking = async (url) => {
      const response = await apiFetch(url);
      if (!response.ok) throw new Error('RANKING_NO_DISPONIBLE');
      const result = await response.json();
      if (!Array.isArray(result)) throw new Error('RANKING_INVALIDO');
      return result;
    };
    const [result, defaultResult] = await Promise.all([
      getRanking(criterio === 'nivel' ? '/api/ranking' : `/api/ranking?criterio=${criterio}`),
      criterio === 'nivel' ? Promise.resolve(null) : getRanking('/api/ranking'),
    ]);
    if (sessionUserId !== currentSession?.user?.id || requestId !== rankingRequestId) return [];
    rankingEntries = result;
    defaultRankingEntries = defaultResult ?? result;
    renderGlobalRanking();
    rankingStatus.textContent = result.length ? '' : 'Todavía no hay usuarios en el ranking.';
    rankingStatus.className = 'status';
    return result;
  } catch {
    if (sessionUserId !== currentSession?.user?.id || requestId !== rankingRequestId) return [];
    if (!showState) return [];
    rankingEntries = [];
    renderGlobalRanking();
    if (showState) {
      rankingStatus.textContent = 'No se pudo cargar el ranking global.';
      rankingStatus.className = 'status error';
    }
    return [];
  }
}

async function loadWeeklyRanking({ showState = weeklyRankingDialog.open } = {}) {
  const sessionUserId = currentSession?.user?.id;
  const requestId = ++weeklyRankingRequestId;
  if (showState) {
    weeklyRankingStatus.textContent = 'Cargando Ranking...';
    weeklyRankingStatus.className = 'status loading-message';
    weeklyRankingList.replaceChildren();
  }
  try {
    const response = await apiFetch('/api/ranking/semanal');
    if (!response.ok) throw new Error('RANKING_SEMANAL_NO_DISPONIBLE');
    const result = await response.json();
    if (!result || typeof result.available !== 'boolean' || !Array.isArray(result.entries)) {
      throw new Error('RANKING_SEMANAL_INVALIDO');
    }
    if (sessionUserId !== currentSession?.user?.id || requestId !== weeklyRankingRequestId) return;
    weeklyRankingEntries = result.available ? result.entries : [];
    renderWeeklyRanking();
    weeklyRankingStatus.textContent = result.available ? '' : 'No disponible';
    weeklyRankingStatus.className = 'status';
  } catch {
    if (sessionUserId !== currentSession?.user?.id || requestId !== weeklyRankingRequestId || !showState) return;
    weeklyRankingEntries = [];
    renderWeeklyRanking();
    weeklyRankingStatus.textContent = 'No se pudo cargar el ranking semanal.';
    weeklyRankingStatus.className = 'status error';
  }
}

function showToast(message, type = 'success', iconSrc = null, iconPosition = 'after') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  if (type === 'gift') toast.classList.add('toast-task', 'toast-gift');
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const messageNode = typeof message === 'string' ? document.createTextNode(message) : message;
  if (iconSrc === null) iconSrc = '/toast_images/87X2Rz8y2ZY.png';
  iconPosition = iconPosition === 'after' && type !== 'task' && type !== 'level' ? 'before' : iconPosition;
  const icon = iconSrc ? document.createElement('img') : null;
  if (icon) {
    icon.className = 'toast-icon';
    icon.src = iconSrc;
    icon.alt = type === 'notification' ? 'Notificaciones'
      : type === 'level' ? 'Nivel alcanzado' : type === 'task' || type === 'gift' ? 'Bricks' : 'Separador de ladrillos';
  }
  if (icon && iconPosition === 'before') toast.append(icon);
  toast.append(messageNode);
  if (icon && iconPosition !== 'before') toast.append(icon);
  toastRegion.append(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function showRealtimeNotificationToast(notification) {
  if (notification?.type === 'gift_received' || notification?.type === 'gift_thanks') {
    const payload = notification.payload ?? {};
    const user = typeof payload.user === 'string' && payload.user.trim() ? payload.user : 'Coleccionista';
    const isThanks = notification.type === 'gift_thanks';
    const amount = Number.isFinite(payload.amount) ? payload.amount : isThanks ? 5 : 50;
    const message = isThanks
      ? `¡${user} te ha dado las gracias por tu regalo: +${amount} Bricks!`
      : `¡Has recibido un regalo de ${user}: +${amount} Bricks!`;
    showToast(message, 'gift', '/toast_images/regalo.png', 'before');
    return;
  }
  showToast('Tienes una nueva notificación', 'notification', '/status_images/sobre.png', 'before');
}

function showPendingNotificationToast() {
  if (document.visibilityState === 'hidden' || pendingNotificationToasts.length === 0) return;
  const pending = pendingNotificationToasts;
  pendingNotificationToasts = [];
  pending.forEach(({ userId, notification }, index) => {
    const show = () => {
      if (userId === currentSession?.user?.id) showRealtimeNotificationToast(notification);
    };
    if (index === 0) show();
    else setTimeout(show, index * 300);
  });
}

document.addEventListener('visibilitychange', showPendingNotificationToast);

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
  imageModalImageSequence += 1;
  if (imageModal.open) imageModal.close();
  imageModalImage.removeAttribute('src');
  imageModalImage.alt = '';
  imageModalName.textContent = '';
}

function mostrarImagenMinifigura(id, nombre) {
  const upperId = String(id).toUpperCase();
  const url = imagenUrlPara(id);
  const requestSequence = ++imageModalImageSequence;
  const preloader = new Image();
  imageModalImage.src = imageFallbackUrl;
  imageModalImage.alt = `Imagen de la minifigura ${upperId}`;
  imageModalTitle.textContent = upperId;
  imageModalName.textContent = nombre ?? '';
  imageModal.showModal();
  imageModalCloseButton.focus();
  preloader.onload = () => {
    if (!imageModal.open || requestSequence !== imageModalImageSequence) return;
    imageModalImage.src = url;
  };
  preloader.src = url;
}

function openFormDialog(mode, minifigura, trigger = null) {
  if (!categoriasReady) {
    showToast('No se pueden crear minifiguras sin cargar las categorías oficiales.', 'error');
    return;
  }
  pauseSyncForModal();
  currentFormMode = mode;
  formTrigger = trigger;
  formSending = false;
  imageLookupSequence += 1;
  currentEditId = mode === 'edit' ? minifigura.id : null;
  formSynced = mode !== 'create' && mode !== 'ranking-create';
  minifiguraForm.reset();
  bricksetLoading.hidden = true;
  formPreviewImage.src = imageFallbackUrl;
  formObservedButton.setAttribute('aria-pressed', 'false');
  formError.textContent = '';
  formDialogTitle.textContent = mode === 'edit' || mode === 'ranking-create' ? 'Editar minifigura' : mode === 'view' ? 'Ver minifigura' : 'Nueva minifigura';

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

  if (mode === 'ranking-create') {
    formIdInput.value = String(minifigura.id).trim().toUpperCase();
    formNombreInput.value = '';
    formDescripcionInput.value = '';
    formEstadoInput.value = 'BUSCADA';
    formPrecioCompraInput.value = '';
    formFechaCompraInput.value = '';
    formObservedButton.setAttribute('aria-pressed', 'false');
    formSynced = hasFormMetadata();
  }
  updateFormMode();
  formDialog.showModal();
  if (mode === 'ranking-create') {
    formObservedButton.focus();
    if (!formSynced) void loadFormBricksetData();
  }
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
  const isRankingCreate = currentFormMode === 'ranking-create';
  const isView = currentFormMode === 'view';
  const hasId = formIdInput.value.trim() !== '';
  const editableFields = [formEstadoInput];
  const purchaseFields = [formPrecioCompraInput, formFechaCompraInput];
  const bricksetFields = [formCategoriaInput, formSubcategoriaInput, formAnioInput, formPrecioInput];

  formDialog.classList.toggle('view-mode', isView);
  formIdInput.closest('.modal-row-identity').classList.toggle('view-mode', isView);
  formIdInput.readOnly = !isCreate;
  formIdInput.disabled = !isCreate;
  editableFields.forEach((field) => { field.disabled = isView || (isCreate && !formSynced) || (isRankingCreate && field === formEstadoInput); });
  purchaseFields.forEach((field) => {
    if (formEstadoInput.value === 'BUSCADA') field.value = '';
    field.disabled = isView || formEstadoInput.value === 'BUSCADA' || (isCreate && !formSynced);
  });
  formFechaCompraInput.type = formFechaCompraInput.disabled && !formFechaCompraInput.value ? 'text' : 'date';
  formPrecioInput.placeholder = formSynced && !formPrecioInput.value ? 'Sin precio' : '';
  formStateToggleButtons.forEach((button) => { button.disabled = isView || isRankingCreate || (isCreate && !formSynced); });
  bricksetFields.forEach((field) => {
    field.disabled = isView || (isCreate && !formSynced);
    field.readOnly = true;
  });
  [formNombreInput, formDescripcionInput].forEach((field) => {
    field.disabled = true;
    field.readOnly = true;
  });
  formObservedButton.disabled = isCreate && !formSynced;
  updateFormToggleStates();
  formDialogTitle.hidden = false;
  formSubmitButton.hidden = isView;
  formSubmitButton.disabled = isView || formSending || (isRankingCreate && !formSynced) || !isFormValid();
  formCancelButton.textContent = 'Cerrar';
  formPreviewImage.hidden = false;
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

function hasFormMetadata() {
  return formNombreInput.value.trim() !== ''
    && formCategoriaInput.value.trim() !== ''
    && officialCategorias.some(({ categoria }) => categoria === formCategoriaInput.value.trim())
    && Number.isInteger(Number(formAnioInput.value)) && Number(formAnioInput.value) > 0;
}

function isFormValid() {
  const precio = formPrecioInput.value.trim();
  return formIdInput.value.trim() !== ''
    && formNombreInput.value.trim() !== ''
    && formEstadoInput.value.trim() !== ''
    && formCategoriaInput.value.trim() !== ''
    && Number.isInteger(Number(formAnioInput.value))
    && Number(formAnioInput.value) > 0
    && (precio === '' || (Number.isFinite(Number(precio)) && Number(precio) >= 0));
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
  payload.estadoColeccion = currentFormMode === 'ranking-create' ? 'BUSCADA' : estadoColeccion || 'COLECCIÓN';

  const precioCompraRaw = formPrecioCompraInput.value.trim();
  if (precioCompraRaw !== '' && currentFormMode !== 'ranking-create') {
    payload.precioCompra = Number(precioCompraRaw);
  }
  const fechaCompra = formFechaCompraInput.value.trim();
  if (fechaCompra !== '' && currentFormMode !== 'ranking-create') {
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
  if (payload.precio !== undefined && (!Number.isFinite(payload.precio) || payload.precio < 0)) {
    return 'El precio Brickset no es válido.';
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
  renderDynamicFilterOptions(catalogCache);
  const formData = new FormData(form);
  const filterValue = (name) => String(formData.get(name) ?? '').trim();
  activeFilters = {
    id: filterValue('id'),
    nombre: filterValue('nombre'),
    categoria: filterValue('categoria'),
    subcategoria: filterValue('subcategoria'),
    anio: filterValue('anio'),
    ...selectedStateFilters(),
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

function openOwnAchievements(trigger) {
  achievementsViewSequence += 1;
  achievementsTrigger = trigger;
  renderAchievements(ownGamification ?? {}, 'Logros', { editable: true });
  gamificationDialog.showModal();
  gamificationCloseButton.focus();
  void loadGamification();
}

function setNotificationsUnreadCount(count) {
  const unreadCount = Number.isInteger(count) && count > 0 ? count : 0;
  const label = unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones';
  notificationsUnreadBadge.hidden = unreadCount === 0;
  notificationsMarkAllButton.disabled = unreadCount === 0;
  notificationsOpenButton.setAttribute('aria-label', label);
  notificationsOpenButton.title = label;
}

function notificationDateGroup(createdAt, now = notificationsClock()) {
  const timestamp = new Date(createdAt);
  if (Number.isNaN(timestamp.getTime())) return 'Hace más de dos semanas';
  const age = now.getTime() - timestamp.getTime();
  if (age >= 0 && age < 60_000) return 'Hace un instante';
  const date = madridDateString(timestamp);
  const today = madridDateString(now);
  if (date === today) return 'Hoy';
  if (date === shiftCalendarDate(today, -1)) return 'Ayer';
  const weekday = (new Date(`${today}T00:00:00.000Z`).getUTCDay() + 6) % 7;
  const thisWeekStart = shiftCalendarDate(today, -weekday);
  if (date >= thisWeekStart) return 'Esta semana';
  if (date >= shiftCalendarDate(thisWeekStart, -7)) return 'La semana pasada';
  return 'Hace más de dos semanas';
}

function exactNotificationTimestamp(createdAt) {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(createdAt));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`;
}

function notificationClockTime(createdAt) {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(createdAt));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.hour}:${values.minute}`;
}

function appendNotificationBrick(container) {
  const icon = document.createElement('img');
  icon.className = 'ranking-gift-icon notification-brick-icon';
  icon.src = '/toast_images/hero_2026-01-05_16-38-47-871.webp';
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  container.append(icon);
}

function renderNotificationMessage(notification) {
  const data = notification.data ?? {};
  const message = document.createElement('p');
  message.className = 'notification-message';
  if (notification.type === 'friend_request' || notification.type === 'friend_request_accepted') {
    const username = document.createElement('strong');
    username.textContent = data.user ?? 'Coleccionista';
    message.append(username, document.createTextNode(notification.type === 'friend_request'
      ? ' quiere ser tu amigo.' : ' ha aceptado tu solicitud de amistad.'));
    return message;
  }
  if (notification.type === 'gift_received' || notification.type === 'gift_thanks') {
    const userName = document.createElement('strong');
    userName.textContent = data.user ?? 'Coleccionista';
    const amount = document.createElement('span');
    amount.textContent = String(Number.isFinite(data.amount) ? data.amount : notification.type === 'gift_received' ? 50 : 5);
    if (notification.type === 'gift_received') {
      const rankingName = data.amount === 5 ? 'Ranking Semanal' : 'Ranking Global';
      message.append(userName, document.createTextNode(` vio tus tops en el ${rankingName} y te regaló `), amount);
      appendNotificationBrick(message);
      message.append(document.createTextNode('.'));
    } else {
      message.append(userName, document.createTextNode(' agradeció tu regalo con '), amount);
      appendNotificationBrick(message);
      message.append(document.createTextNode('.'));
    }
    return message;
  }
  if (notification.type === 'ranking_entered' || notification.type === 'ranking_exited') {
    const marker = document.createElement('span');
    marker.className = 'notification-leading-emoji';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = notification.type === 'ranking_exited'
      ? '❌' : data.ranking === 'weekly' ? '🗓️' : '🌐';
    message.append(marker, document.createTextNode(` ${data.message ?? 'Tienes una notificación de ranking.'}`));
    return message;
  }
  if (notification.type === 'weekly_ranking_available') {
    const marker = document.createElement('span');
    marker.className = 'notification-leading-emoji';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = '🗓️';
    message.append(marker, document.createTextNode(` ${data.message ?? 'El Ranking Semanal de esta semana ya está disponible.'}`));
    return message;
  }
  message.textContent = data.message ?? 'Tienes una notificación.';
  return message;
}

function renderNotifications() {
  notificationsMarkAllButton.parentElement.hidden = notificationsLoading || notificationsItems.length === 0;
  notificationsList.replaceChildren();
  const now = notificationsClock();
  let currentGroup = null;
  for (const notification of notificationsItems) {
    const group = notificationDateGroup(notification.createdAt, now);
    if (group !== currentGroup) {
      const heading = document.createElement('li');
      heading.className = 'notification-date-group';
      const label = document.createElement('h3');
      label.textContent = group;
      heading.append(label);
      notificationsList.append(heading);
      currentGroup = group;
    }
    const item = document.createElement('li');
    item.className = 'notification-item';
    item.dataset.notificationId = notification.id;
    item.tabIndex = -1;
    item.classList.toggle('is-read', notification.isRead);
    const content = document.createElement('div');
    content.className = 'notification-content';
    const time = document.createElement('time');
    time.className = 'notification-time';
    time.dateTime = notification.createdAt;
    time.title = exactNotificationTimestamp(notification.createdAt);
    time.setAttribute('aria-label', time.title);
    time.textContent = notificationClockTime(notification.createdAt);
    content.append(time);
    if (notification.type === 'daily_summary') {
      content.append(renderDailyNotification(notification));
    } else {
      content.append(renderNotificationMessage(notification));
    }
    const actions = document.createElement('div');
    actions.className = 'notification-actions';
    if (notification.type === 'weekly_ranking_available') {
      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'button button-secondary notification-open-weekly-ranking';
      openButton.setAttribute('aria-label', 'Ver Ranking Semanal');
      openButton.textContent = 'Ver Ranking Semanal';
      actions.append(openButton);
    }
    if (notification.type === 'friend_request') {
      const acceptButton = document.createElement('button');
      const isPending = notificationFriendAcceptRequests.has(notification.id);
      const isAccepted = notification.accepted === true || notification.canAccept === false;
      acceptButton.type = 'button';
      acceptButton.className = 'button button-secondary notification-accept-friend';
      acceptButton.dataset.notificationId = notification.id;
      acceptButton.setAttribute('aria-label', isAccepted ? 'Solicitud de amistad aceptada' : `Aceptar solicitud de amistad de ${notification.data?.user ?? 'Coleccionista'}`);
      acceptButton.title = acceptButton.getAttribute('aria-label');
      const plus = document.createElement('span');
      plus.className = 'notification-friend-plus';
      plus.setAttribute('aria-hidden', 'true');
      plus.textContent = isAccepted ? 'Aceptada' : '+';
      const icon = document.createElement('img');
      icon.className = 'notification-friend-icon';
      icon.src = '/status_images/friends.png';
      icon.alt = '';
      acceptButton.append(plus, icon);
      acceptButton.disabled = isPending || isAccepted;
      if (isPending) acceptButton.setAttribute('aria-busy', 'true');
      actions.append(acceptButton);
      const error = notificationFriendAcceptErrors.get(notification.id);
      if (error) {
        const errorMessage = document.createElement('p');
        errorMessage.className = 'notification-error';
        errorMessage.setAttribute('role', 'alert');
        errorMessage.textContent = error;
        actions.append(errorMessage);
      }
    }
    if (notification.type === 'gift_received') {
      const thankButton = document.createElement('button');
      const isPending = notificationThankRequests.has(notification.id);
      thankButton.type = 'button';
      thankButton.className = 'button button-secondary ranking-gift notification-thank';
      thankButton.dataset.notificationId = notification.id;
      thankButton.append(document.createTextNode('¡Gracias! +5 '));
      appendNotificationBrick(thankButton);
      thankButton.disabled = isPending || notification.canThank === false;
      if (isPending) thankButton.setAttribute('aria-busy', 'true');
      actions.append(thankButton);
      const error = notificationThankErrors.get(notification.id);
      if (error) {
        const errorMessage = document.createElement('p');
        errorMessage.className = 'notification-error';
        errorMessage.setAttribute('role', 'alert');
        errorMessage.textContent = error;
        actions.append(errorMessage);
      }
    }
    if (actions.childElementCount) content.append(actions);
    const controls = document.createElement('div');
    controls.className = 'notification-controls';
    const markReadButton = document.createElement('button');
    markReadButton.type = 'button';
    markReadButton.className = 'button button-secondary notification-mark-read';
    markReadButton.dataset.notificationId = notification.id;
    markReadButton.setAttribute('aria-label', notification.isRead ? 'Notificación leída' : 'Marcar notificación como leída');
    markReadButton.title = notification.isRead ? 'Notificación leída' : 'Marcar como leída';
    markReadButton.textContent = '✅';
    markReadButton.disabled = notification.isRead || notificationReadRequests.has(notification.id);
    const readError = notificationReadErrors.get(notification.id);
    controls.append(markReadButton);
    if (readError) {
      const errorMessage = document.createElement('p');
      errorMessage.className = 'notification-error';
      errorMessage.setAttribute('role', 'alert');
      errorMessage.textContent = readError;
      content.append(errorMessage);
    }
    item.append(content, controls);
    notificationsList.append(item);
  }
}

function formatSignedNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value}`;
}

function formatSignedCurrency(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const amount = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value));
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${amount} €`;
}

function renderDailyNotification(notification) {
  const details = document.createElement('details');
  details.className = 'daily-notification';
  const summary = document.createElement('summary');
  summary.textContent = 'Resumen diario';
  details.append(summary);
  const deltas = notification.data.deltas;
  if (!deltas) {
    const noBaseline = document.createElement('p');
    noBaseline.className = 'daily-no-baseline';
    noBaseline.textContent = 'Sin medición previa.';
    details.append(noBaseline);
    return details;
  }

  const metrics = document.createElement('div');
  metrics.className = 'daily-summary-metrics';
  const rankingMetrics = document.createElement('div');
  rankingMetrics.className = 'daily-ranking-deltas';
  const addMetric = (label, value, iconPath = null, target = metrics) => {
    const metric = document.createElement('div');
    metric.className = 'daily-summary-metric';
    if (iconPath) {
      metric.classList.add('has-icon');
      const icon = document.createElement('img');
      icon.className = 'daily-summary-icon';
      icon.src = iconPath;
      icon.alt = '';
      metric.append(icon);
    }
    const name = document.createElement('span');
    name.className = 'daily-summary-label';
    name.textContent = label;
    const amount = document.createElement('strong');
    amount.className = 'daily-summary-value';
    amount.textContent = value;
    metric.append(name, amount);
    target.append(metric);
  };
  addMetric('Colección', formatSignedNumber(deltas.figures), '/status_images/caja.png');
  addMetric('Valor', formatSignedCurrency(deltas.valueEur), '/toast_images/billete.png');
  addMetric('Bricks', formatSignedNumber(deltas.bricks), '/toast_images/hero_2026-01-05_16-38-47-871.webp');
  addMetric('Nivel', formatSignedNumber(deltas.level), '/toast_images/75206.png');
  details.append(metrics);
  if (Number.isFinite(deltas.globalPosition)) addMetric('🌐 Ranking Global', `${formatSignedNumber(deltas.globalPosition)} puestos`, null, rankingMetrics);
  if (Number.isFinite(deltas.weeklyPosition)) addMetric('🗓️ Ranking Semanal', `${formatSignedNumber(deltas.weeklyPosition)} puestos`, null, rankingMetrics);
  if (rankingMetrics.childElementCount) details.append(rankingMetrics);

  const traits = [
    ['collector', 'Collector', 'collector'],
    ['explorer', 'Explorer', 'explorer'],
    ['rarityHunter', 'Rarity Hunter', 'rarity'],
    ['fan', 'Fan', 'fan'],
  ];
  const dnaGrid = document.createElement('div');
  dnaGrid.className = 'daily-dna-grid';
  for (const [key, name, color] of traits) {
    const trait = document.createElement('div');
    trait.className = 'daily-dna-trait';
    const swatch = document.createElement('span');
    swatch.className = `dna-swatch dna-swatch-${color}`;
    swatch.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'daily-dna-name';
    label.textContent = name;
    const percentage = document.createElement('strong');
    percentage.textContent = `${formatSignedNumber(deltas.dna?.[key])}%`;
    trait.append(swatch, label, percentage);
    dnaGrid.append(trait);
  }
  details.append(dnaGrid);
  return details;
}

async function acceptFriendNotification(notificationId) {
  const notification = notificationsItems.find((item) => item.id === notificationId);
  const sessionUserId = currentSession?.user?.id;
  if (!notification || notification.type !== 'friend_request' || notification.accepted === true
    || notification.canAccept === false || notificationFriendAcceptRequests.has(notificationId) || !sessionUserId) return;
  notificationFriendAcceptRequests.add(notificationId);
  notificationFriendAcceptErrors.delete(notificationId);
  renderNotifications();
  try {
    const response = await apiFetch(`/api/notificaciones/${encodeURIComponent(notificationId)}/aceptar`, { method: 'POST' });
    const result = await response.json();
    if (sessionUserId !== currentSession?.user?.id) return;
    if (!response.ok || result.accepted !== true) throw new Error('friend request unavailable');
    notificationsItems = notificationsItems.map((item) => item.id === notificationId
      ? { ...item, accepted: true, canAccept: false }
      : item);
    refreshSocialGamification();
    void loadFriendsCounts();
    if (friendsDialog.open && friendsActiveTab !== 'search') void loadFriendsList();
  } catch {
    if (sessionUserId === currentSession?.user?.id) {
      notificationFriendAcceptErrors.set(notificationId, 'No se pudo aceptar la solicitud. Inténtalo de nuevo.');
    }
  } finally {
    notificationFriendAcceptRequests.delete(notificationId);
    if (sessionUserId === currentSession?.user?.id) renderNotifications();
  }
}

async function thankNotification(notificationId) {
  const notification = notificationsItems.find((item) => item.id === notificationId);
  const sessionUserId = currentSession?.user?.id;
  if (!notification || notification.type !== 'gift_received' || notification.canThank === false
    || notificationThankRequests.has(notificationId) || !sessionUserId) return;
  notificationThankRequests.add(notificationId);
  notificationThankErrors.delete(notificationId);
  renderNotifications();
  try {
    const response = await apiFetch(`/api/notificaciones/${encodeURIComponent(notificationId)}/agradecer`, { method: 'POST' });
    if (sessionUserId !== currentSession?.user?.id) return;
    if (response.ok || response.status === 404 || response.status === 409) {
      notificationsItems = notificationsItems.map((item) => item.id === notificationId ? { ...item, canThank: false } : item);
      refreshSocialGamification();
    } else {
      throw new Error('thanks unavailable');
    }
  } catch {
    if (sessionUserId === currentSession?.user?.id) notificationThankErrors.set(notificationId, 'No se pudo enviar el agradecimiento.');
  } finally {
    notificationThankRequests.delete(notificationId);
    if (sessionUserId === currentSession?.user?.id) renderNotifications();
  }
}

async function markNotificationRead(notificationId) {
  const notification = notificationsItems.find((item) => item.id === notificationId);
  const sessionUserId = currentSession?.user?.id;
  if (!notification || notification.isRead || notificationReadRequests.has(notificationId) || !sessionUserId) return;
  notificationReadRequests.add(notificationId);
  notificationReadErrors.delete(notificationId);
  renderNotifications();
  try {
    const response = await apiFetch(`/api/notificaciones/${encodeURIComponent(notificationId)}/leer`, { method: 'POST' });
    const result = await response.json();
    if (sessionUserId !== currentSession?.user?.id) return;
    if (!response.ok || !Number.isInteger(result.unreadCount)) throw new Error('read unavailable');
    notificationsItems = notificationsItems.map((item) => item.id === notificationId ? { ...item, isRead: true } : item);
    setNotificationsUnreadCount(result.unreadCount);
  } catch {
    if (sessionUserId === currentSession?.user?.id) notificationReadErrors.set(notificationId, 'No se pudo marcar como leída.');
  } finally {
    notificationReadRequests.delete(notificationId);
    if (sessionUserId === currentSession?.user?.id) renderNotifications();
  }
}

async function loadNotifications({ reset = false, preserveItems = false } = {}) {
  const sessionUserId = currentSession?.user?.id;
  if (!sessionUserId || (!reset && (notificationsLoading || !notificationsHasMore))) return;
  const requestId = ++notificationsRequestSequence;
  const previousCursor = notificationsNextCursor;
  const previousHasMore = notificationsHasMore;
  if (reset && !preserveItems) {
    notificationsItems = [];
    notificationsNextCursor = null;
    notificationsHasMore = true;
    renderNotifications();
  }
  notificationsLoading = true;
  notificationsMarkAllButton.parentElement.hidden = true;
  if (notificationsDialog.open) {
    notificationsStatus.textContent = 'Cargando notificaciones...';
    notificationsStatus.className = 'status loading-message';
  }
  const cursor = reset ? null : notificationsNextCursor;
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  try {
    const response = await apiFetch(`/api/notificaciones${query}`);
    const result = await response.json();
    if (requestId !== notificationsRequestSequence || sessionUserId !== currentSession?.user?.id) return;
    if (!response.ok || !Array.isArray(result.notifications) || !Number.isInteger(result.unreadCount)) {
      throw new Error('notifications unavailable');
    }
    const merged = new Map((reset && !preserveItems ? [] : notificationsItems).map((item) => [item.id, item]));
    for (const item of result.notifications) merged.set(item.id, item);
    notificationsItems = [...merged.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
    notificationsNextCursor = preserveItems && previousCursor ? previousCursor : result.nextCursor;
    notificationsHasMore = preserveItems
      ? previousHasMore || result.nextCursor !== null
      : result.nextCursor !== null;
    setNotificationsUnreadCount(result.unreadCount);
    renderNotifications();
    notificationsStatus.textContent = notificationsItems.length ? '' : 'No tienes notificaciones.';
  } catch {
    if (requestId === notificationsRequestSequence && sessionUserId === currentSession?.user?.id) {
      notificationsStatus.textContent = 'No se pudieron cargar las notificaciones.';
    }
  } finally {
    if (requestId === notificationsRequestSequence) {
      notificationsLoading = false;
      notificationsStatus.classList.remove('loading-message');
      notificationsMarkAllButton.parentElement.hidden = notificationsItems.length === 0;
    }
  }
}

async function syncNativePushPermission() {
  if (!nativePush || !nativePushRegistration || !currentSession) return;
  try {
    const permissions = await nativePush.checkPermissions();
    if (permissions.receive === 'denied') {
      await nativePushRegistration.register(currentSession, { permissionState: 'denied' });
      notificationsPushStatus.textContent = 'Los avisos están desactivados en Android. La bandeja sigue disponible.';
      return;
    }
    if (permissions.receive !== 'granted') return;
    await nativePush.createChannel();
    await nativePush.register();
    notificationsPushStatus.textContent = '';
  } catch {
    notificationsPushStatus.textContent = 'No se pudo sincronizar el permiso de avisos.';
  }
}

async function revokeNativePushSession(session) {
  const accessToken = session?.access_token;
  if (!nativePushRegistration || typeof accessToken !== 'string' || !accessToken
    || pushRevocationAttempts.has(accessToken)) return false;
  pushRevocationAttempts.add(accessToken);
  return nativePushRegistration.revoke(session);
}

async function enableNativePush() {
  if (!nativePush || !nativePushRegistration || !currentSession) return;
  notificationsPushEnableButton.disabled = true;
  notificationsPushStatus.textContent = 'Preparando los avisos…';
  try {
    const permission = await nativePush.requestPermissions();
    if (permission.receive !== 'granted') {
      await nativePushRegistration.register(currentSession, { permissionState: 'denied' });
      notificationsPushStatus.textContent = 'No activaste los avisos. Puedes consultar la bandeja cuando quieras.';
      return;
    }
    await nativePush.createChannel();
    await nativePush.register();
    notificationsPushStatus.textContent = 'Avisos activados para esta instalación.';
  } catch {
    notificationsPushStatus.textContent = 'No se pudieron activar los avisos. La bandeja sigue disponible.';
  } finally {
    notificationsPushEnableButton.disabled = false;
  }
}

async function openPushNotification(notificationId) {
  if (!currentSession?.user?.id || !UUID_PATTERN.test(notificationId)) return;
  if (!notificationsDialog.open) openNotifications(notificationsOpenButton, { load: false });
  await loadNotifications({ reset: true });
  let pages = 0;
  while (!notificationsItems.some(({ id }) => id === notificationId) && notificationsHasMore && pages < 20) {
    await loadNotifications();
    pages += 1;
  }
  const row = [...notificationsList.querySelectorAll('[data-notification-id]')]
    .find((element) => element.dataset.notificationId === notificationId);
  if (!row) {
    notificationsPushStatus.textContent = 'No se encontró esa notificación en tu bandeja.';
    return;
  }
  row.classList.add('is-push-target');
  row.focus();
  row.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
}

function resumePendingPushOpen() {
  if (!pendingPushNotificationId || !currentSession?.user?.id || !appStarted) return;
  const notificationId = pendingPushNotificationId;
  pendingPushNotificationId = null;
  void openPushNotification(notificationId);
}

async function initializeNativePushListeners() {
  if (!nativePush || nativePushListenersRegistered) return;
  nativePushListenersRegistered = true;
  notificationsPushControls.hidden = false;
  try {
    await nativePush.addListener('registration', ({ value }) => {
      const session = currentSession;
      if (!session || typeof value !== 'string' || !nativePushRegistration) return;
      void nativePushRegistration.register(session, { token: value, permissionState: 'granted' })
        .then((registered) => {
          if (currentSession?.user?.id === session.user.id && !registered) {
            notificationsPushStatus.textContent = 'No se pudo registrar esta instalación. La bandeja sigue disponible.';
          }
        });
    });
    await nativePush.addListener('registrationError', () => {
      notificationsPushStatus.textContent = 'No se pudieron preparar los avisos push.';
    });
    await nativePush.addListener('pushNotificationReceived', (notification) => {
      const action = nativePush.validateAction(notification?.data);
      if (!action || receivedPushNotificationIds.has(action.notificationId)) return;
      receivedPushNotificationIds.add(action.notificationId);
      if (receivedPushNotificationIds.size > 256) receivedPushNotificationIds.delete(receivedPushNotificationIds.values().next().value);
      if (currentSession) void loadNotifications({ reset: true, preserveItems: true });
    });
    await nativePush.addListener('pushNotificationActionPerformed', (action) => {
      const validated = nativePush.validateAction(action?.notification?.data);
      if (!validated) return;
      pendingPushNotificationId = validated.notificationId;
      resumePendingPushOpen();
    });
    await nativeAuth?.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      void syncNativePushPermission();
      if (currentSession) void loadNotifications({ reset: true, preserveItems: true });
      resumePendingPushOpen();
    });
  } catch {
    // Push remains optional; authentication and the durable inbox keep working.
  }
}

function stopNotificationsRealtime() {
  if (!notificationsChannel) return;
  try {
    const removal = supabaseClient?.removeChannel?.(notificationsChannel);
    removal?.catch?.(() => {});
    if (!supabaseClient?.removeChannel) notificationsChannel.unsubscribe?.();
  } catch {
    notificationsChannel.unsubscribe?.();
  }
  notificationsChannel = null;
  notificationsChannelConnected = false;
}

function startNotificationsRealtime() {
  const sessionUserId = currentSession?.user?.id;
  if (!sessionUserId || !supabaseClient?.channel) return;
  const channel = supabaseClient.channel(`notificaciones-${sessionUserId}`);
  notificationsChannel = channel;
  channel.on('postgres_changes', {
      event: '*', schema: 'public', table: 'notificaciones', filter: `user_id=eq.${sessionUserId}`,
    }, (payload) => {
      if (notificationsChannel !== channel || currentSession?.user?.id !== sessionUserId) return;
      const notificationId = payload?.new?.id;
      if ((!payload?.eventType || payload.eventType === 'INSERT') && notificationId && !notificationToastIds.has(notificationId)) {
        notificationToastIds.add(notificationId);
        if (document.visibilityState === 'hidden') {
          pendingNotificationToasts.push({ userId: sessionUserId, notification: payload.new });
        } else {
          showRealtimeNotificationToast(payload.new);
        }
      }
      void loadNotifications({ reset: true, preserveItems: payload?.eventType !== 'DELETE' });
      void loadFriendsCounts();
      if (friendsDialog.open && friendsActiveTab !== 'search') void loadFriendsList();
      if (['gift_received', 'gift_thanks'].includes(payload?.new?.type)) refreshSocialGamification();
    })
    .subscribe((status) => {
      if (notificationsChannel === channel && status === 'SUBSCRIBED' && currentSession?.user?.id === sessionUserId) {
        const isReconnect = notificationsChannelConnected;
        notificationsChannelConnected = true;
        if (isReconnect) void loadFriendsCounts();
        void loadNotifications({ reset: true, preserveItems: true });
        if (isReconnect) void loadGamification({ notifyAchievements: true });
      }
    });
}

function clearNotifications() {
  stopNotificationsRealtime();
  notificationsRequestSequence += 1;
  notificationsItems = [];
  notificationsNextCursor = null;
  notificationsHasMore = true;
  notificationsLoading = false;
  notificationThankRequests.clear();
  notificationThankErrors.clear();
  notificationFriendAcceptRequests.clear();
  notificationFriendAcceptErrors.clear();
  notificationReadRequests.clear();
  notificationReadErrors.clear();
  notificationToastIds.clear();
  pendingNotificationToasts = [];
  notificationsTrigger = null;
  notificationsList.replaceChildren();
  notificationsStatus.textContent = '';
  notificationsStatus.className = 'status';
  notificationsMarkAllButton.parentElement.hidden = true;
  setNotificationsUnreadCount(0);
  if (notificationsDialog.open) notificationsDialog.close();
}

function invalidateClientStateForGamificationVersion() {
  let previousVersion;
  try {
    previousVersion = window.localStorage.getItem(GAMIFICATION_UI_VERSION_KEY);
    window.localStorage.setItem(GAMIFICATION_UI_VERSION_KEY, GAMIFICATION_UI_VERSION);
  } catch {
    return false;
  }
  if (previousVersion === null || previousVersion === GAMIFICATION_UI_VERSION) return false;

  achievementQueue = [];
  isShowingAchievement = false;
  toastRegion.replaceChildren();
  ownGamification = null;
  resetFeaturedAchievements();
  ownDnaState = null;
  dnaRequestSequence += 1;
  rankingRequestId += 1;
  weeklyRankingRequestId += 1;
  rankingEntries = [];
  defaultRankingEntries = [];
  weeklyRankingEntries = [];
  expandedRankingUserId = null;
  expandedWeeklyRankingUserId = null;
  globalRankingList.replaceChildren();
  weeklyRankingList.replaceChildren();
  if (publicProfileDialog.open) publicProfileDialog.close();
  clearPublicProfile();
  publicProfileTrigger = null;
  clearNotifications();
  if (currentSession?.user?.id) {
    startNotificationsRealtime();
    void loadNotifications({ reset: true });
  }
  void loadGlobalRanking({ showState: rankingDialog.open });
  void loadWeeklyRanking({ showState: weeklyRankingDialog.open });
  void loadGamificationDna(dnaDialog.open);
  return true;
}

function renderFriendRows(rows, type) {
  const list = document.querySelector(`#friends-list-${type}`);
  list.replaceChildren();
  const uniqueRows = new Map(rows.map((row) => [row.userId, row]));
  friendsRows[type] = uniqueRows;
  for (const friend of uniqueRows.values()) {
    const item = document.createElement('li');
    item.className = 'friends-row global-ranking-row';
    item.dataset.userId = friend.userId;
    const profileButton = document.createElement('button');
    profileButton.type = 'button';
    profileButton.className = 'ranking-expand friends-user-button';
    profileButton.dataset.profileUser = friend.userId;
    profileButton.setAttribute('aria-label', `Ver perfil de ${friend.username}`);
    appendRankingSummary(profileButton, {
      displayName: friend.username, avatarUrl: friend.avatarUrl, bricks: friend.bricks ?? 0,
      nivel: friend.level?.id ?? 0, nombreNivel: friend.level?.name ?? 'Duplo',
      totalColeccion: friend.totalCollection ?? 0, dnaPrincipal: friend.dnaPrincipal ?? 'Newbie',
      dnaRasgos: (friend.dnaTraits ?? []).map(({ name, percentage }) => ({ nombre: name, porcentaje: percentage })),
    }, friend.globalPosition ? `#${friend.globalPosition}` : '-');
    profileButton.querySelector('.ranking-name').classList.add('friends-username');
    const summary = document.createElement('div');
    summary.className = 'ranking-summary friends-summary';
    summary.append(profileButton);
    item.append(summary);
    const isFriend = type === 'friends' || friend.relationshipStatus === 'friend' || (type === 'received' && friend.status === 'accepted');
    if (isFriend) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button button-secondary friends-remove';
      remove.dataset.removeFriend = friend.userId;
      remove.setAttribute('aria-label', `Eliminar amigo ${friend.username}`);
      remove.title = `Eliminar amigo ${friend.username}`;
      remove.disabled = friendsActionRequests.has(`remove:${friend.userId}`);
      const icon = document.createElement('img');
      icon.src = '/status_images/friends.png';
      icon.alt = '';
      remove.append(document.createTextNode('−'), icon);
      if (type === 'received') {
        const actions = document.createElement('div');
        actions.className = 'friends-request-actions';
        const accepted = document.createElement('button');
        accepted.type = 'button';
        accepted.className = 'button button-secondary notification-accept-friend friends-accepted-button';
        accepted.textContent = 'Aceptada';
        accepted.setAttribute('aria-label', 'Solicitud de amistad aceptada');
        accepted.title = 'Solicitud de amistad aceptada';
        const acceptedIcon = document.createElement('img');
        acceptedIcon.className = 'notification-friend-icon';
        acceptedIcon.src = '/status_images/friends.png';
        acceptedIcon.alt = '';
        accepted.append(acceptedIcon);
        accepted.disabled = true;
        actions.append(accepted, remove);
        item.append(actions);
      } else item.append(remove);
    } else if (type === 'search' && friend.relationshipStatus === 'none') {
      const sendButton = document.createElement('button');
      sendButton.type = 'button';
      sendButton.className = 'button button-secondary notification-accept-friend friends-send-request';
      sendButton.dataset.friendSend = friend.userId;
      sendButton.setAttribute('aria-label', `Solicitar amistad a ${friend.username}`);
      sendButton.title = `Solicitar amistad a ${friend.username}`;
      const plus = document.createElement('span');
      plus.className = 'notification-friend-plus';
      plus.setAttribute('aria-hidden', 'true');
      plus.textContent = '+';
      const icon = document.createElement('img');
      icon.className = 'notification-friend-icon';
      icon.src = '/status_images/friends.png';
      icon.alt = '';
      sendButton.append(plus, icon);
      sendButton.disabled = friendsActionRequests.has(`send:${friend.userId}`);
      if (sendButton.disabled) sendButton.setAttribute('aria-busy', 'true');
      item.append(sendButton);
    } else if (type === 'received' && friend.status === 'accepted') {
      const acceptedButton = document.createElement('button');
      acceptedButton.type = 'button';
      acceptedButton.className = 'button button-secondary friends-accepted-button';
      acceptedButton.textContent = 'Aceptada';
      acceptedButton.disabled = true;
      item.append(acceptedButton);
    } else if (type === 'received' && ['pending', 'rejected'].includes(friend.status)) {
      const actions = document.createElement('div');
      actions.className = 'friends-request-actions friends-request-controls';
      if (friend.status === 'rejected') {
        const state = document.createElement('span');
        state.className = 'friends-request-state state-rejected';
        state.textContent = 'Rechazada';
        actions.append(state);
      }
      const acceptButton = document.createElement('button');
      acceptButton.type = 'button';
      acceptButton.className = 'button button-secondary notification-accept-friend friends-accept-request';
      acceptButton.dataset.requestId = friend.relationshipId;
      acceptButton.dataset.requestAction = 'accept';
      acceptButton.setAttribute('aria-label', `Aceptar solicitud de amistad de ${friend.username}`);
      acceptButton.title = `Aceptar solicitud de amistad de ${friend.username}`;
      const plus = document.createElement('span');
      plus.className = 'notification-friend-plus';
      plus.setAttribute('aria-hidden', 'true');
      plus.textContent = '+';
      const acceptIcon = document.createElement('img');
      acceptIcon.className = 'notification-friend-icon';
      acceptIcon.src = '/status_images/friends.png';
      acceptIcon.alt = '';
      acceptButton.append(plus, acceptIcon);
      acceptButton.disabled = friendsActionRequests.has(`request:${friend.relationshipId}`);
      if (acceptButton.disabled) acceptButton.setAttribute('aria-busy', 'true');
      actions.append(acceptButton);
      if (friend.status === 'pending') {
        const rejectButton = document.createElement('button');
        rejectButton.type = 'button';
        rejectButton.className = 'logout-link friends-reject-request';
        rejectButton.dataset.requestId = friend.relationshipId;
        rejectButton.dataset.requestAction = 'reject';
        rejectButton.setAttribute('aria-label', `Rechazar solicitud de amistad de ${friend.username}`);
        rejectButton.title = `Rechazar solicitud de amistad de ${friend.username}`;
        rejectButton.textContent = 'Rechazar';
        rejectButton.disabled = friendsActionRequests.has(`request:${friend.relationshipId}`);
        if (rejectButton.disabled) rejectButton.setAttribute('aria-busy', 'true');
        actions.append(rejectButton);
      }
      item.append(actions);
    } else if ((type === 'search' && friend.relationshipStatus !== 'none') || type === 'received') {
      const status = document.createElement('span');
      status.className = `friends-request-state state-${friend.status}`;
      const state = type === 'search' ? friend.relationshipStatus : friend.status;
      status.className = `friends-request-state state-${state}`;
      status.textContent = ({
        rejected: 'Rechazada', request_rejected: 'Rechazada', accepted: 'Aceptada', friend: 'Amigos',
        request_sent: 'Enviada', request_received: 'Recibida', pending: 'Pendiente',
      })[state] ?? 'Pendiente';
      item.append(status);
    }
    const error = friendsActionErrors.get(isFriend ? `remove:${friend.userId}`
      : type === 'search' ? `send:${friend.userId}` : `request:${friend.relationshipId}`);
    if (error) {
      const errorMessage = document.createElement('p');
      errorMessage.className = 'friends-action-error';
      errorMessage.setAttribute('role', 'alert');
      errorMessage.textContent = error;
      item.append(errorMessage);
    }
    list.append(item);
  }
}

function setFriendsCounts(counts) {
  const badge = document.querySelector('#friends-count');
  badge.hidden = counts === null;
  badge.textContent = counts === null ? '' : String(counts.friends);
  const label = counts === null ? 'Amigos' : `Amigos: ${counts.friends}`;
  friendsOpenButton.setAttribute('aria-label', label);
  friendsOpenButton.title = label;
  for (const [type, title] of [['friends', 'Amigos'], ['sent', 'Solicitudes Enviadas'], ['received', 'Solicitudes Recibidas']]) {
    const button = document.querySelector(`#friends-tab-${type}`);
    const count = counts === null ? '?' : counts[type];
    const titleWithCount = `${title} (${count})`;
    if (type === 'friends') {
      button.textContent = titleWithCount;
      continue;
    }
    button.setAttribute('aria-label', titleWithCount);
    const fullLabel = document.createElement('span');
    fullLabel.className = 'friends-tab-label-full';
    fullLabel.textContent = titleWithCount;
    const shortLabel = document.createElement('span');
    shortLabel.className = 'friends-tab-label-short';
    shortLabel.setAttribute('aria-hidden', 'true');
    shortLabel.textContent = `${title.replace('Solicitudes', 'Sol.')} (${count})`;
    button.replaceChildren(fullLabel, shortLabel);
  }
}

async function loadFriendsCounts() {
  const sessionUserId = currentSession?.user?.id;
  if (!sessionUserId) return;
  const sequence = ++friendsCountsSequence;
  try {
    const response = await apiFetch('/api/amigos/contadores');
    const data = await response.json();
    if (!response.ok || !data || ['friends', 'sent', 'received'].some((key) => !Number.isInteger(data[key]) || data[key] < 0)) {
      throw new Error('counts unavailable');
    }
    if (sequence !== friendsCountsSequence || sessionUserId !== currentSession?.user?.id) return;
    setFriendsCounts(data);
  } catch {
    if (sequence === friendsCountsSequence && sessionUserId === currentSession?.user?.id) setFriendsCounts(null);
  }
}

async function loadFriendsList(tab = friendsActiveTab) {
  if (tab === 'search') return;
  const sessionUserId = currentSession?.user?.id;
  if (!sessionUserId) return;
  const requestId = ++friendsRequestSequence;
  const status = document.querySelector(`#friends-status-${tab}`);
  status.textContent = 'Cargando...';
  status.className = 'status loading-message';
  try {
    const response = await apiFetch(`/api/amigos?tipo=${tab}`);
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.users)) throw new Error('friends unavailable');
    if (requestId !== friendsRequestSequence || sessionUserId !== currentSession?.user?.id) return;
    renderFriendRows(result.users, tab);
    status.textContent = result.users.length ? '' : tab === 'friends' ? 'Todavía no tienes amigos.' : 'No hay solicitudes.';
    status.className = 'status';
  } catch {
    if (requestId === friendsRequestSequence && sessionUserId === currentSession?.user?.id) {
      document.querySelector(`#friends-list-${tab}`).replaceChildren();
      status.textContent = 'No se pudo cargar esta lista.';
      status.className = 'status error';
    }
  }
}

async function searchFriends(query, sequence) {
  const sessionUserId = currentSession?.user?.id;
  if (!sessionUserId || sequence !== friendsSearchSequence || friendsActiveTab !== 'search') return;
  const status = document.querySelector('#friends-status-search');
  status.textContent = 'Buscando...';
  status.className = 'status loading-message';
  try {
    const response = await apiFetch(`/api/amigos/buscar?q=${encodeURIComponent(query)}`);
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.users)) throw new Error('friends search unavailable');
    if (sequence !== friendsSearchSequence || sessionUserId !== currentSession?.user?.id || !friendsDialog.open) return;
    renderFriendRows(result.users, 'search');
    status.textContent = result.users.length ? '' : 'No hay resultados.';
    status.className = 'status';
  } catch {
    if (sequence === friendsSearchSequence && sessionUserId === currentSession?.user?.id) {
      document.querySelector('#friends-list-search').replaceChildren();
      friendsRows.search.clear();
      status.textContent = 'No se pudo realizar la búsqueda.';
      status.className = 'status error';
    }
  }
}

function scheduleFriendsSearch() {
  if (friendsSearchTimer !== null) clearTimeout(friendsSearchTimer);
  friendsSearchSequence += 1;
  const sequence = friendsSearchSequence;
  const query = friendsSearchInput.value.trim();
  const status = document.querySelector('#friends-status-search');
  document.querySelector('#friends-list-search').replaceChildren();
  friendsRows.search.clear();
  if (query.length < 3) {
    status.textContent = '';
    status.className = 'status';
    return;
  }
  status.textContent = 'Preparando búsqueda...';
  status.className = 'status';
  friendsSearchTimer = setTimeout(() => {
    friendsSearchTimer = null;
    void searchFriends(query, sequence);
  }, 250);
}

async function removeFriend(userId, type) {
  const sessionUserId = currentSession?.user?.id;
  const key = `remove:${userId}`;
  if (!sessionUserId || friendsActionRequests.has(key)) return;
  friendsActionRequests.add(key);
  friendsActionErrors.delete(key);
  renderFriendRows([...friendsRows[type].values()], type);
  try {
    const response = await apiFetch(`/api/amigos/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error('remove unavailable');
    if (sessionUserId !== currentSession?.user?.id) return;
    friendsRows.friends.delete(userId);
    for (const [friendId, row] of friendsRows.received) {
      if (friendId === userId && row.status === 'accepted') friendsRows.received.delete(friendId);
    }
    const searchRow = friendsRows.search.get(userId);
    if (searchRow) searchRow.relationshipStatus = 'none';
    renderFriendRows([...friendsRows.friends.values()], 'friends');
    renderFriendRows([...friendsRows.search.values()], 'search');
    document.querySelector('#friends-status-friends').textContent = friendsRows.friends.size ? '' : 'Todavía no tienes amigos.';
    refreshSocialGamification();
    void loadFriendsCounts();
    void loadNotifications({ reset: true });
    friendsTabButtons.find(({ dataset }) => dataset.friendsTab === friendsActiveTab)?.focus();
  } catch {
    if (sessionUserId === currentSession?.user?.id) friendsActionErrors.set(key, 'No se pudo eliminar la amistad.');
  } finally {
    friendsActionRequests.delete(key);
    if (sessionUserId === currentSession?.user?.id) renderFriendRows([...friendsRows[type].values()], type);
  }
}

async function sendFriendRequest(userId) {
  const sessionUserId = currentSession?.user?.id;
  const key = `send:${userId}`;
  if (!sessionUserId || friendsActionRequests.has(key) || !friendsRows.search.has(userId)) return;
  friendsActionRequests.add(key);
  friendsActionErrors.delete(key);
  renderFriendRows([...friendsRows.search.values()], 'search');
  try {
    const response = await apiFetch('/api/amigos/solicitudes', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ receptorId: userId }),
    });
    if (!response.ok) throw new Error('request unavailable');
    if (sessionUserId !== currentSession?.user?.id) return;
    const friend = friendsRows.search.get(userId);
    if (friend) friend.relationshipStatus = 'request_sent';
    refreshSocialGamification();
    void loadFriendsCounts();
  } catch {
    if (sessionUserId === currentSession?.user?.id) friendsActionErrors.set(key, 'No se pudo enviar la solicitud.');
  } finally {
    friendsActionRequests.delete(key);
    if (sessionUserId === currentSession?.user?.id) renderFriendRows([...friendsRows.search.values()], 'search');
  }
}

async function changeFriendRequest(requestId, action) {
  const sessionUserId = currentSession?.user?.id;
  const key = `request:${requestId}`;
  const friend = friendsRows.received.get([...friendsRows.received.values()].find(({ relationshipId }) => relationshipId === requestId)?.userId);
  if (!sessionUserId || !friend || friendsActionRequests.has(key) || friend.status === 'accepted') return;
  friendsActionRequests.add(key);
  friendsActionErrors.delete(key);
  renderFriendRows([...friendsRows.received.values()], 'received');
  try {
    const response = await apiFetch(`/api/amigos/solicitudes/${encodeURIComponent(requestId)}/${action === 'accept' ? 'aceptar' : 'rechazar'}`, { method: 'POST' });
    if (!response.ok) throw new Error('request unavailable');
    if (sessionUserId !== currentSession?.user?.id) return;
    friend.status = action === 'accept' ? 'accepted' : 'rejected';
    refreshSocialGamification();
    void loadFriendsCounts();
    if (action === 'accept') void loadNotifications({ reset: true });
  } catch {
    if (sessionUserId === currentSession?.user?.id) friendsActionErrors.set(key, 'No se pudo actualizar la solicitud.');
  } finally {
    friendsActionRequests.delete(key);
    if (sessionUserId === currentSession?.user?.id) renderFriendRows([...friendsRows.received.values()], 'received');
  }
}

function selectFriendsTab(tab) {
  friendsRequestSequence += 1;
  if (tab !== 'search') {
    friendsSearchSequence += 1;
    if (friendsSearchTimer !== null) clearTimeout(friendsSearchTimer);
    friendsSearchTimer = null;
  }
  friendsActiveTab = tab;
  for (const button of friendsTabButtons) {
    const selected = button.dataset.friendsTab === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    document.querySelector(`#friends-panel-${button.dataset.friendsTab}`).hidden = !selected;
  }
  if (tab === 'search') {
    friendsSearchInput.focus();
    return;
  }
  void loadFriendsList(tab);
}

function openFriends(trigger) {
  friendsTrigger = trigger;
  void loadFriendsCounts();
  friendsDialog.showModal();
  friendsTabButtons.find(({ dataset }) => dataset.friendsTab === friendsActiveTab)?.focus();
  selectFriendsTab(friendsActiveTab);
}

function clearFriends() {
  friendsRequestSequence += 1;
  friendsCountsSequence += 1;
  setFriendsCounts(null);
  friendsSearchSequence += 1;
  if (friendsSearchTimer !== null) clearTimeout(friendsSearchTimer);
  friendsSearchTimer = null;
  friendsActionRequests.clear();
  friendsActionErrors.clear();
  for (const rows of Object.values(friendsRows)) rows.clear();
  friendsTrigger = null;
  friendsActiveTab = 'friends';
  friendsSearchInput.value = '';
  for (const tab of ['friends', 'sent', 'received', 'search']) {
    document.querySelector(`#friends-list-${tab}`).replaceChildren();
    document.querySelector(`#friends-status-${tab}`).textContent = '';
    document.querySelector(`#friends-status-${tab}`).className = 'status';
  }
  if (friendsDialog.open) friendsDialog.close();
}

function clearPublicProfile() {
  publicProfileRequestSequence += 1;
  publicProfileDnaInstance?.destroy();
  publicProfileDnaInstance = null;
  document.querySelector('#public-profile-dna-chart').hidden = true;
  document.querySelector('#public-profile-dna-percentage').textContent = '';
  document.querySelector('#public-profile-dna-trait').textContent = '';
  document.querySelector('#public-profile-level').removeAttribute('title');
  document.querySelector('#public-profile-level-image').removeAttribute('src');
  publicProfileUserId = null;
  publicProfileData = null;
  publicProfileTitle.textContent = '';
  publicProfileAvatar.removeAttribute('src');
  publicProfileAvatar.hidden = true;
  publicProfileAvatarFallback.hidden = false;
  publicProfileContent.hidden = true;
  publicProfileStatus.textContent = '';
  publicProfileStatus.className = 'status';
  publicProfileRetryButton.hidden = true;
  for (const selector of [
    '#public-profile-bricks', '#public-profile-level', '#public-profile-collection-count', '#public-profile-wanted-count',
  ]) document.querySelector(selector).textContent = '';
  for (const selector of [
    '#public-profile-top-price', '#public-profile-top-age',
    '#public-profile-latest-collection', '#public-profile-latest-wanted', '#public-profile-achievements',
  ]) document.querySelector(selector).replaceChildren();
}

function renderPublicProfileFigures(selector, rows, mode = 'price') {
  const list = document.querySelector(selector);
  list.replaceChildren();
  for (const [index, figure] of rows.slice(0, 5).entries()) {
    const item = document.createElement('li');
    const card = rankingCard({ id: figure.id, nombre: figure.name }, index + 1,
      mode === 'age' ? figure.year ?? '—' : formatPrice(figure.price), false);
    card.dataset.rankingId = figure.id;
    card.dataset.ownerUser = publicProfileData.userId;
    card.setAttribute('aria-label', `${figure.name}, ${figure.id}`);
    const image = card.querySelector('img');
    image.addEventListener('error', () => {
      if (image.getAttribute('src') !== imageFallbackUrl) {
        image.style.display = '';
        image.src = imageFallbackUrl;
      }
    });
    item.append(card);
    list.append(item);
  }
}

function renderPublicProfile(profile) {
  publicProfileData = profile;
  publicProfileTitle.textContent = profile.username;
  publicProfileAvatar.hidden = !profile.avatarUrl;
  publicProfileAvatarFallback.hidden = Boolean(profile.avatarUrl);
  if (profile.avatarUrl) publicProfileAvatar.src = profile.avatarUrl;
  document.querySelector('#public-profile-bricks').textContent = String(profile.bricks);
  document.querySelector('#public-profile-level').textContent = `${profile.level.id} ${profile.level.name}`;
  document.querySelector('#public-profile-level').title = `${profile.level.id} ${profile.level.name}`;
  document.querySelector('#public-profile-level-image').src = levelImagePath(profile.level.id);
  document.querySelector('#public-profile-collection-count').textContent = String(profile.collection.total);
  document.querySelector('#public-profile-wanted-count').textContent = String(profile.wanted.total);
  publicProfileContent.hidden = false;
  publicProfileDnaInstance?.destroy();
  const primaryKey = ['explorer', 'collector', 'fan', 'rarityHunter'].reduce((primary, key) => (
    profile.dna[key] > profile.dna[primary] ? key : primary
  ), 'explorer');
  const principal = Object.values(profile.dna).some((value) => value > 0)
    ? DNA_TRAITS.find(({ key }) => key === primaryKey).name : 'Newbie';
  publicProfileDnaInstance = renderDnaView({ principal, porcentajes: profile.dna }, {
    chart: document.querySelector('#public-profile-dna-chart'), canvas: document.querySelector('#public-profile-dna-canvas'),
    centerLabel: document.querySelector('#public-profile-dna-chart .dna-chart-label'),
    percentageLabel: document.querySelector('#public-profile-dna-percentage'), traitLabel: document.querySelector('#public-profile-dna-trait'),
  });
  document.querySelector('#public-profile-dna-chart').setAttribute('aria-label',
    `DNA de ${profile.username}: ${DNA_TRAITS.map(({ key, name }) => `${name} ${profile.dna[key]}%`).join(', ')}`);
  renderPublicProfileFigures('#public-profile-top-price', profile.top5Price);
  renderPublicProfileFigures('#public-profile-top-age', profile.top5Age, 'age');
  renderPublicProfileFigures('#public-profile-latest-collection', profile.collection.latest);
  renderPublicProfileFigures('#public-profile-latest-wanted', profile.wanted.latest);
  updateRankingWantedActions(publicProfileContent);
  const achievements = document.querySelector('#public-profile-achievements');
  const profileAchievements = sortedAchievements(profile.achievements.map((achievement) => ({
    id: achievement.id, type: achievement.type, nombre: achievement.name, descripcion: achievement.description,
    cantidad: achievement.quantity, total: achievement.total, bricks: achievement.bricks, destacado: achievement.featured === true,
  })));
  achievements.replaceChildren(...profileAchievements.slice(0, 5).map((achievement) => createAchievementItem(achievement)));
  if (!profile.achievements.length) {
    const empty = document.createElement('li');
    empty.className = 'public-profile-empty';
    empty.textContent = 'No hay logros.';
    achievements.append(empty);
  }
}

async function loadPublicProfile(userId, requestId) {
  const sessionUserId = currentSession?.user?.id;
  if (!sessionUserId || requestId !== publicProfileRequestSequence) return;
  publicProfileStatus.textContent = 'Cargando perfil...';
  publicProfileStatus.className = 'status loading-message';
  publicProfileRetryButton.hidden = true;
  try {
    const response = await apiFetch(`/api/amigos/${encodeURIComponent(userId)}/perfil`);
    const profile = await response.json();
    if (!response.ok || !profile || profile.userId !== userId) throw new Error('profile unavailable');
    if (requestId !== publicProfileRequestSequence || sessionUserId !== currentSession?.user?.id || !publicProfileDialog.open) return;
    renderPublicProfile(profile);
    publicProfileStatus.textContent = '';
    publicProfileStatus.className = 'status';
  } catch {
    if (requestId === publicProfileRequestSequence && sessionUserId === currentSession?.user?.id) {
      clearPublicProfile();
      publicProfileUserId = userId;
      publicProfileStatus.textContent = 'No se pudo cargar el perfil.';
      publicProfileStatus.className = 'status error';
      publicProfileRetryButton.hidden = false;
    }
  }
}

function openPublicProfile(userId, trigger) {
  if (!currentSession || !userId || userId === currentSession.user.id) return;
  publicProfileTrigger = trigger;
  publicProfileUserId = userId;
  clearPublicProfile();
  publicProfileUserId = userId;
  publicProfileDialog.showModal();
  publicProfileCloseButton.focus();
  const requestId = ++publicProfileRequestSequence;
  void loadPublicProfile(userId, requestId);
}

function openNotifications(trigger, { load = true } = {}) {
  notificationsTrigger = trigger;
  if (!notificationsDialog.open) notificationsDialog.showModal();
  notificationsCloseButton.focus();
  if (load) void loadNotifications({ reset: true });
}

function restoreRankingFocus(trigger) {
  if (!currentSession) return;
  if (trigger?.dataset.profileWanted === 'true') {
    if (publicProfileDialog.open) (trigger.isConnected ? trigger : publicProfileCloseButton).focus();
    return;
  }
  const weekly = Boolean(trigger?.closest('#weekly-ranking-list'));
  const dialog = weekly ? weeklyRankingDialog : rankingDialog;
  const list = weekly ? weeklyRankingList : globalRankingList;
  const closeButton = weekly ? weeklyRankingCloseButton : rankingCloseButton;
  if (!dialog.open) return;
  const userId = trigger?.closest('.global-ranking-entry')?.dataset.userId ?? trigger?.dataset.ownerUser;
  const entry = [...list.children].find((item) => item.dataset.userId === userId);
  const target = trigger?.isConnected ? trigger : entry?.querySelector('.ranking-expand') ?? closeButton;
  target.focus();
}

gamificationLevelButton.addEventListener('click', () => openOwnAchievements(gamificationLevelButton));
achievementsOpenButton.addEventListener('click', () => openOwnAchievements(achievementsOpenButton));
notificationsOpenButton.addEventListener('click', () => openNotifications(notificationsOpenButton));
friendsOpenButton.addEventListener('click', () => openFriends(friendsOpenButton));
friendsCloseButton.addEventListener('click', () => friendsDialog.close());
publicProfileCloseButton.addEventListener('click', () => publicProfileDialog.close());
publicProfileContent.addEventListener('click', (event) => {
  const wanted = event.target.closest('[data-wanted-id]');
  if (!wanted || !publicProfileDialog.open || wanted.dataset.ownerUser !== publicProfileData?.userId) return;
  const figure = [
    ...publicProfileData.top5Price, ...publicProfileData.top5Age,
    ...publicProfileData.collection.latest, ...publicProfileData.wanted.latest,
  ].find((item) => item.id === wanted.dataset.wantedId);
  if (figure) openWantedFigure(wanted, {
    id: figure.id, nombre: figure.name, precio: figure.price, anio: figure.year,
    categoria: figure.category, subcategoria: figure.subcategory,
  });
});
publicProfileRetryButton.addEventListener('click', () => {
  if (!publicProfileUserId) return;
  const requestId = ++publicProfileRequestSequence;
  void loadPublicProfile(publicProfileUserId, requestId);
});
publicProfileDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  publicProfileDialog.close();
});
publicProfileDialog.addEventListener('close', () => {
  publicProfileRequestSequence += 1;
  clearPublicProfile();
  const trigger = publicProfileTrigger;
  publicProfileTrigger = null;
  if (trigger?.isConnected) trigger.focus();
  else if (trigger?.closest('.global-ranking-entry')) restoreRankingFocus(trigger);
  else if (friendsDialog.open) friendsTabButtons.find(({ dataset }) => dataset.friendsTab === friendsActiveTab)?.focus();
  else if (currentSession) friendsOpenButton.focus();
});
friendsSearchInput.addEventListener('input', scheduleFriendsSearch);
for (const list of [document.querySelector('#friends-list-friends'), document.querySelector('#friends-list-search'), document.querySelector('#friends-list-sent'), document.querySelector('#friends-list-received')]) {
  list.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-friend]');
    if (remove) {
      void removeFriend(remove.dataset.removeFriend, list.id.replace('friends-list-', ''));
      return;
    }
    const profile = event.target.closest('[data-profile-user]');
    if (profile) {
      openPublicProfile(profile.dataset.profileUser, profile);
      return;
    }
    const sendButton = event.target.closest('.friends-send-request');
    if (sendButton) {
      void sendFriendRequest(sendButton.dataset.friendSend);
      return;
    }
    const actionButton = event.target.closest('[data-request-action]');
    if (actionButton) void changeFriendRequest(actionButton.dataset.requestId, actionButton.dataset.requestAction);
  });
}
for (const button of friendsTabButtons) {
  button.addEventListener('click', () => selectFriendsTab(button.dataset.friendsTab));
  button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = friendsTabButtons.indexOf(button);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? friendsTabButtons.length - 1
      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + friendsTabButtons.length) % friendsTabButtons.length;
    const next = friendsTabButtons[nextIndex];
    selectFriendsTab(next.dataset.friendsTab);
    next.focus();
  });
}
friendsDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  friendsDialog.close();
});
friendsDialog.addEventListener('close', () => {
  friendsRequestSequence += 1;
  if (currentSession && friendsTrigger?.isConnected) friendsTrigger.focus();
  friendsTrigger = null;
});

for (const trigger of dnaOpenButtons) {
  trigger.addEventListener('click', () => openDnaDialog(trigger));
}

dnaDialogCloseButton.addEventListener('click', () => dnaDialog.close());
dnaRetryButton.addEventListener('click', () => { void loadDnaDialog(); });
dnaDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  dnaDialog.close();
});
dnaDialog.addEventListener('close', () => {
  dnaRequestSequence += 1;
  destroyDnaChart();
  if (dnaDialogTrigger?.isConnected) dnaDialogTrigger.focus();
  dnaDialogTrigger = null;
});

gamificationCloseButton.addEventListener('click', () => {
  achievementsViewSequence += 1;
  achievementsMode = 'none';
  gamificationDialog.close();
});

gamificationDialog.addEventListener('close', () => {
  achievementsViewSequence += 1;
  achievementsMode = 'none';
  if (rankingDialog.open) restoreRankingFocus(achievementsTrigger);
  else if (currentSession && achievementsTrigger?.isConnected) achievementsTrigger.focus();
  achievementsTrigger = null;
});

notificationsCloseButton.addEventListener('click', () => notificationsDialog.close());
notificationsPushEnableButton.addEventListener('click', () => void enableNativePush());
notificationsDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  notificationsDialog.close();
});
notificationsDialog.addEventListener('close', () => {
  if (notificationsTrigger?.isConnected) notificationsTrigger.focus();
  notificationsTrigger = null;
});

notificationsList.addEventListener('scroll', () => {
  if (notificationsList.scrollTop + notificationsList.clientHeight >= notificationsList.scrollHeight - 72) {
    void loadNotifications();
  }
});

notificationsList.addEventListener('click', (event) => {
  const openWeeklyRankingButton = event.target.closest('.notification-open-weekly-ranking');
  if (openWeeklyRankingButton) {
    weeklyRankingOpenButton.click();
    return;
  }
  const acceptFriendButton = event.target.closest('.notification-accept-friend');
  if (acceptFriendButton) {
    void acceptFriendNotification(acceptFriendButton.dataset.notificationId);
    return;
  }
  const markReadButton = event.target.closest('.notification-mark-read');
  if (markReadButton) {
    void markNotificationRead(markReadButton.dataset.notificationId);
    return;
  }
  const button = event.target.closest('.notification-thank');
  if (button) void thankNotification(button.dataset.notificationId);
});

notificationsMarkAllButton.addEventListener('click', async () => {
  notificationsMarkAllButton.disabled = true;
  try {
    const response = await apiFetch('/api/notificaciones/leer-todas', { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !Number.isInteger(result.unreadCount)) throw new Error('notifications unavailable');
    notificationsItems = notificationsItems.map((item) => ({ ...item, isRead: true }));
    setNotificationsUnreadCount(result.unreadCount);
    renderNotifications();
    notificationsStatus.textContent = '';
  } catch {
    notificationsStatus.textContent = 'No se pudieron marcar las notificaciones como leídas.';
    notificationsMarkAllButton.disabled = false;
  }
});

setNotificationsUnreadCount(0);

let rankingTrigger = rankingOpenButton;
function madridDateString(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftCalendarDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function historyRangeForDays(days) {
  const to = madridDateString(new Date());
  return { from: shiftCalendarDate(to, 1 - days), to };
}

function setAnalyticsHistoryRange(range, presetDays = null) {
  analyticsHistoryRange = range;
  for (const button of analyticsHistoryRangeButtons) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.historyDays) === presetDays));
  }
}

function clearAnalyticsHistoryData(clearStatus = true) {
  analyticsHistoryData = null;
  if (clearStatus) analyticsHistoryStatus.textContent = '';
  analyticsHistoryRetryButton.hidden = true;
  destroyAnalyticsHistoryCharts();
  analyticsHistoryValueTableBody.replaceChildren();
  analyticsHistoryDnaTableBody.replaceChildren();
  analyticsHistoryProgressionTableBody.replaceChildren();
}

const analyticsHistoryCharts = new Map();

function destroyAnalyticsHistoryCharts() {
  for (const chart of analyticsHistoryCharts.values()) chart.destroy();
  analyticsHistoryCharts.clear();
}

function formatAnalyticsHistoryDate(dateString) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(`${dateString}T12:00:00.000Z`));
}

function formatUniqueAnalyticsHistoryTick(value, index, ticks) {
  const dateForTick = (tickValue) => formatAnalyticsHistoryDate(new Date(Number(tickValue)).toISOString().slice(0, 10));
  const label = dateForTick(value);
  return index > 0 && label === dateForTick(ticks[index - 1].value) ? '' : label;
}

function formatAnalyticsHistoryPrice(value) {
  if (!Number.isFinite(value)) return 'Sin datos';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatAnalyticsHistoryPercent(value) {
  if (!Number.isFinite(value)) return 'Sin datos';
  return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(value)}%`;
}

function chartColorWithAlpha(color, alpha) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${channels.join(', ')}, ${alpha})`;
}

function analyticsHistoryValuePoints(data) {
  const byDate = new Map(data.snapshots.map((snapshot) => [snapshot.snapshotDate, snapshot]));
  const valueSeries = [];
  const deltaSeries = [];
  const deltas = new Map();
  for (let date = analyticsHistoryRange.from; date <= analyticsHistoryRange.to; date = shiftCalendarDate(date, 1)) {
    const timestamp = Date.parse(`${date}T00:00:00.000Z`);
    const snapshot = byDate.get(date);
    valueSeries.push({ x: timestamp, y: snapshot ? snapshot.totalValue : null });
    let previous = byDate.get(shiftCalendarDate(date, -1));
    if (!previous && date === analyticsHistoryRange.from
      && data.baseline?.snapshotDate === shiftCalendarDate(date, -1)) {
      previous = { totalFigures: data.baseline.totalFigures };
    }
    const delta = snapshot && previous ? snapshot.totalFigures - previous.totalFigures : null;
    if (snapshot) deltas.set(date, delta);
    deltaSeries.push({ x: timestamp, y: snapshot ? delta : null });
  }
  return { valueSeries, deltaSeries, deltas };
}

function analyticsHistoryXAxisBounds() {
  const min = Date.parse(`${analyticsHistoryRange.from}T00:00:00.000Z`);
  const max = Date.parse(`${analyticsHistoryRange.to}T00:00:00.000Z`);
  return min === max
    ? { min: min - 43200000, max: max + 43200000 }
    : { min, max };
}

function createAnalyticsChart(canvas, configuration) {
  const styles = getComputedStyle(document.documentElement);
  const ink = styles.getPropertyValue('--ink').trim();
  const muted = styles.getPropertyValue('--muted').trim();
  const options = configuration.options;
  options.animation = false;
  options.layout = { padding: { top: 8, right: 8 } };
  options.interaction = { mode: 'index', axis: 'x', intersect: false };
  options.plugins.legend = {
    display: true, position: 'bottom', onClick() {},
    labels: { color: ink, usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 20, font: { family: 'Trebuchet MS', size: 12 } },
  };
  const formatTooltipLabel = options.plugins.tooltip.callbacks.label;
  options.plugins.tooltip.callbacks.label = (item) => {
    const label = item.dataset?.label ?? configuration.data.datasets[item.datasetIndex]?.label ?? '';
    if (!Number.isFinite(item.parsed?.y)) return `${label}: Sin datos`;
    return formatTooltipLabel ? formatTooltipLabel(item)
      : `${label}: ${new Intl.NumberFormat('es-ES').format(item.parsed.y)}`;
  };
  Object.assign(options.plugins.tooltip, {
    backgroundColor: '#202124', titleColor: '#ffffff', bodyColor: '#ffffff',
    padding: 12, cornerRadius: 6, boxPadding: 5,
    titleFont: { family: 'Trebuchet MS', size: 13, weight: 'bold' },
    bodyFont: { family: 'Trebuchet MS', size: 12 },
  });
  for (const [name, scale] of Object.entries(options.scales)) {
    scale.border = { display: false };
    scale.grid = { ...scale.grid, color: '#e9edf1', drawTicks: false };
    scale.ticks = { ...scale.ticks, color: muted, padding: 10, font: { family: 'Trebuchet MS', size: 11 } };
    scale.title = { ...scale.title, color: muted, font: { family: 'Trebuchet MS', size: 11 } };
    if (name === 'x') {
      scale.offset = false;
      scale.grid.display = false;
      scale.title.display = false;
      scale.ticks.maxTicksLimit = 5;
      scale.ticks.maxRotation = 0;
      scale.ticks.callback = (value, index, ticks) => {
        const label = formatUniqueAnalyticsHistoryTick(value, index, ticks);
        return label ? label.slice(0, 5) : '';
      };
    } else {
      scale.ticks.maxTicksLimit = 5;
    }
  }
  for (const dataset of configuration.data.datasets) {
    if (dataset.type === 'bar') {
      dataset.borderRadius = 3;
      dataset.maxBarThickness = 18;
      dataset.borderWidth = 1;
      const changes = dataset.data.map(({ y }) => y ?? 0);
      options.scales.figures.suggestedMax = Math.max(1, ...changes) * 3;
      if (changes.some((change) => change < 0)) options.scales.figures.suggestedMin = Math.min(...changes) * 3;
    } else {
      dataset.borderWidth = 2;
      dataset.pointRadius = configuration.data.datasets[0].data.filter(({ y }) => y !== null).length > 30 ? 0 : 3;
      dataset.pointHoverRadius = 6;
      dataset.pointHitRadius = 12;
      dataset.tension = 0;
    }
  }
  return new Chart(canvas.getContext('2d'), configuration);
}

function renderAnalyticsHistoryValue(data) {
  analyticsHistoryValueTableBody.replaceChildren();
  destroyAnalyticsHistoryCharts();
  if (!data.snapshots.length) return;

  const { valueSeries, deltaSeries, deltas } = analyticsHistoryValuePoints(data);
  for (const snapshot of data.snapshots) {
    const row = document.createElement('tr');
    const values = [
      formatAnalyticsHistoryDate(snapshot.snapshotDate),
      formatAnalyticsHistoryPrice(snapshot.totalValue),
      String(snapshot.totalFigures),
      deltas.get(snapshot.snapshotDate) === null ? 'Sin datos'
        : deltas.get(snapshot.snapshotDate) > 0 ? `+${deltas.get(snapshot.snapshotDate)}`
          : String(deltas.get(snapshot.snapshotDate)),
    ];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    analyticsHistoryValueTableBody.append(row);
  }

  if (typeof Chart !== 'function') return;

  const styles = getComputedStyle(document.documentElement);
  const xBounds = analyticsHistoryXAxisBounds();
  const formatTick = (value) => formatAnalyticsHistoryDate(new Date(Number(value)).toISOString().slice(0, 10));
  analyticsHistoryCharts.set('value', createAnalyticsChart(analyticsHistoryValueCanvas, {
    type: 'bar',
    data: {
      datasets: [
        {
          type: 'line', label: 'Valor de colección (€)', data: valueSeries,
          yAxisID: 'value', borderColor: styles.getPropertyValue('--dna-fan').trim(),
          backgroundColor: styles.getPropertyValue('--dna-fan').trim(), pointRadius: 3,
          spanGaps: false, tension: 0.2,
        },
        {
          type: 'bar', label: 'Colección', data: deltaSeries,
          yAxisID: 'figures', backgroundColor: chartColorWithAlpha(styles.getPropertyValue('--yellow').trim(), 0.4),
          borderColor: styles.getPropertyValue('--yellow').trim(),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true },
        tooltip: {
          enabled: true,
          callbacks: {
            title(items) { return items.length ? formatTick(items[0].parsed.x) : ''; },
            label(item) {
              if (item.datasetIndex === 0) return `Valor de colección: ${formatAnalyticsHistoryPrice(item.parsed.y)}`;
              const change = item.parsed.y > 0 ? `+${item.parsed.y}` : String(item.parsed.y);
              return `Colección: ${change}`;
            },
            afterBody(items) {
              const date = items.length ? new Date(items[0].parsed.x).toISOString().slice(0, 10) : '';
              const snapshot = data.snapshots.find((entry) => entry.snapshotDate === date);
              return snapshot ? `Figuras en colecci\u00f3n: ${snapshot.totalFigures}` : '';
            },
          },
        },
      },
      scales: {
        x: { type: 'linear', ...xBounds, ticks: { maxTicksLimit: 8, callback: formatUniqueAnalyticsHistoryTick }, title: { display: true, text: 'Fecha (Europe/Madrid)' } },
        value: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Valor (€)' } },
        figures: { type: 'linear', position: 'right', beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Colección' }, grid: { drawOnChartArea: false } },
      },
    },
  }));
}

function renderAnalyticsHistoryDna(data) {
  analyticsHistoryDnaTableBody.replaceChildren();
  if (!data.snapshots.length) return;
  for (const snapshot of data.snapshots) {
    const row = document.createElement('tr');
    const values = [
      formatAnalyticsHistoryDate(snapshot.snapshotDate),
      formatAnalyticsHistoryPercent(snapshot.dna.collector),
      formatAnalyticsHistoryPercent(snapshot.dna.explorer),
      formatAnalyticsHistoryPercent(snapshot.dna.rarityHunter),
      formatAnalyticsHistoryPercent(snapshot.dna.fan),
    ];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    analyticsHistoryDnaTableBody.append(row);
  }
  if (typeof Chart !== 'function') return;

  const byDate = new Map(data.snapshots.map((snapshot) => [snapshot.snapshotDate, snapshot]));
  const dates = [];
  for (let date = analyticsHistoryRange.from; date <= analyticsHistoryRange.to; date = shiftCalendarDate(date, 1)) dates.push(date);
  const traits = [
    ['collector', 'Collector', '--dna-collector'],
    ['explorer', 'Explorer', '--dna-explorer'],
    ['rarityHunter', 'Rarity Hunter', '--dna-rarity'],
    ['fan', 'Fan', '--dna-fan'],
  ];
  const styles = getComputedStyle(document.documentElement);
  const colors = Object.fromEntries(traits.map(([key, , variable]) => [key, styles.getPropertyValue(variable).trim()]));
  const formatTick = (value) => formatAnalyticsHistoryDate(new Date(Number(value)).toISOString().slice(0, 10));
  const xBounds = analyticsHistoryXAxisBounds();
  analyticsHistoryCharts.set('dna', createAnalyticsChart(analyticsHistoryDnaCanvas, {
    type: 'line',
    data: {
      datasets: traits.map(([key, label], index) => ({
        label,
        data: dates.map((date) => ({
          x: Date.parse(`${date}T00:00:00.000Z`),
          y: byDate.get(date)?.dna[key] ?? null,
        })),
        borderColor: colors[key],
        backgroundColor: chartColorWithAlpha(colors[key], 0.65),
        fill: index === 0 ? 'origin' : '-1',
        stack: 'dna',
        spanGaps: false,
        pointRadius: 3,
        tension: 0,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true },
        tooltip: {
          enabled: true,
          callbacks: {
            title(items) { return items.length ? formatTick(items[0].parsed.x) : ''; },
            label(item) { return `${item.dataset.label}: ${formatAnalyticsHistoryPercent(item.parsed.y)}`; },
          },
        },
      },
      scales: {
        x: { type: 'linear', ...xBounds, ticks: { maxTicksLimit: 8, callback: formatUniqueAnalyticsHistoryTick }, title: { display: true, text: 'Fecha (Europe/Madrid)' } },
        y: { type: 'linear', min: 0, max: 100, stacked: true, ticks: { callback: (value) => `${value}%` }, title: { display: true, text: 'DNA (%)' } },
      },
    },
  }));
}

function renderAnalyticsHistoryProgression(data) {
  analyticsHistoryProgressionTableBody.replaceChildren();
  if (!data.snapshots.length) return;
  for (const snapshot of data.snapshots) {
    const row = document.createElement('tr');
    for (const value of [formatAnalyticsHistoryDate(snapshot.snapshotDate), String(snapshot.bricks), String(snapshot.level)]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    analyticsHistoryProgressionTableBody.append(row);
  }
  if (typeof Chart !== 'function') return;

  const byDate = new Map(data.snapshots.map((snapshot) => [snapshot.snapshotDate, snapshot]));
  const dates = [];
  for (let date = analyticsHistoryRange.from; date <= analyticsHistoryRange.to; date = shiftCalendarDate(date, 1)) dates.push(date);
  const styles = getComputedStyle(document.documentElement);
  const xBounds = analyticsHistoryXAxisBounds();
  const makeSeries = (key) => dates.map((date) => ({
    x: Date.parse(`${date}T00:00:00.000Z`),
    y: byDate.get(date)?.[key] ?? null,
  }));
  const formatTick = (value) => formatAnalyticsHistoryDate(new Date(Number(value)).toISOString().slice(0, 10));
  analyticsHistoryCharts.set('progression', createAnalyticsChart(analyticsHistoryProgressionCanvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Bricks', data: makeSeries('bricks'), yAxisID: 'bricks',
          borderColor: styles.getPropertyValue('--accent').trim(),
          backgroundColor: styles.getPropertyValue('--accent').trim(),
          pointRadius: 3, spanGaps: false, tension: 0.2,
        },
        {
          label: 'Nivel', data: makeSeries('level'), yAxisID: 'level',
          borderColor: styles.getPropertyValue('--blue').trim(),
          backgroundColor: styles.getPropertyValue('--blue').trim(),
          pointRadius: 3, spanGaps: false, stepped: 'after',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true },
        tooltip: {
          enabled: true,
          callbacks: {
            title(items) { return items.length ? formatTick(items[0].parsed.x) : ''; },
          },
        },
      },
      scales: {
        x: { type: 'linear', ...xBounds, ticks: { maxTicksLimit: 8, callback: formatUniqueAnalyticsHistoryTick }, title: { display: true, text: 'Fecha (Europe/Madrid)' } },
        bricks: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'Bricks' } },
        level: { type: 'linear', position: 'right', beginAtZero: true, ticks: { precision: 0, stepSize: 1 }, title: { display: true, text: 'Nivel' }, grid: { drawOnChartArea: false } },
      },
    },
  }));
}

async function loadAnalyticsHistory(range = analyticsHistoryRange) {
  if (!range || !currentSession) return;
  analyticsHistoryRange = { ...range };
  const sequence = ++analyticsHistoryRequestSequence;
  const userId = currentSession.user?.id;
  clearAnalyticsHistoryData(false);
  analyticsHistoryStatus.textContent = 'Cargando Progreso...';
  analyticsHistoryStatus.className = 'status loading-message';
  analyticsHistoryRetryButton.hidden = true;
  try {
    const query = new URLSearchParams({ from: range.from, to: range.to });
    const response = await apiFetch(`/api/analytics/history?${query}`);
    if (sequence !== analyticsHistoryRequestSequence || !analyticsHistoryDialog.open
      || currentSession?.user?.id !== userId) return;
    if (!response.ok) throw new Error('HISTORICO_NO_DISPONIBLE');
    const data = await response.json();
    if (sequence !== analyticsHistoryRequestSequence || !analyticsHistoryDialog.open
      || currentSession?.user?.id !== userId) return;
    analyticsHistoryData = data;
    analyticsHistoryStatus.textContent = data.snapshots.length ? '' : 'No hay datos para este período.';
    analyticsHistoryStatus.className = 'status';
    renderAnalyticsHistoryValue(data);
    renderAnalyticsHistoryDna(data);
    renderAnalyticsHistoryProgression(data);
  } catch {
    if (sequence !== analyticsHistoryRequestSequence || !analyticsHistoryDialog.open
      || currentSession?.user?.id !== userId) return;
    analyticsHistoryData = null;
    analyticsHistoryStatus.textContent = 'No se pudo cargar el histórico.';
    analyticsHistoryStatus.className = 'status error';
    analyticsHistoryRetryButton.hidden = false;
  }
}

function openAnalyticsHistory() {
  analyticsHistoryTrigger = analyticsHistoryOpenButton;
  setAnalyticsHistoryRange(historyRangeForDays(7), 7);
  analyticsHistoryDialog.showModal();
  analyticsHistoryCloseButton.focus();
  void loadAnalyticsHistory();
}

analyticsHistoryOpenButton.addEventListener('click', openAnalyticsHistory);
analyticsHistoryCloseButton.addEventListener('click', () => analyticsHistoryDialog.close());
analyticsHistoryDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  analyticsHistoryDialog.close();
});
analyticsHistoryDialog.addEventListener('close', () => {
  analyticsHistoryRequestSequence += 1;
  clearAnalyticsHistoryData();
  if (currentSession && analyticsHistoryTrigger?.isConnected) analyticsHistoryTrigger.focus();
  analyticsHistoryTrigger = null;
});
for (const button of analyticsHistoryRangeButtons) {
  button.addEventListener('click', () => {
    setAnalyticsHistoryRange(historyRangeForDays(Number(button.dataset.historyDays)), Number(button.dataset.historyDays));
    void loadAnalyticsHistory();
  });
}
analyticsHistoryRetryButton.addEventListener('click', () => { void loadAnalyticsHistory(); });

for (const button of rankingOrderButtons) {
  button.addEventListener('click', () => {
    selectedRankingCriterion = button.dataset.rankingCriterion;
    for (const criterionButton of rankingOrderButtons) {
      criterionButton.setAttribute('aria-pressed', String(criterionButton === button));
    }
    void loadGlobalRanking();
  });
}
for (const trigger of [rankingOpenButton, rankingMainGlobe]) {
  trigger.addEventListener('click', () => {
    rankingTrigger = trigger;
    userProfile.hidden = true;
    userMenuToggle.setAttribute('aria-expanded', 'false');
    rankingDialog.showModal();
    expandedRankingUserId = null;
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

weeklyRankingOpenButton.addEventListener('click', () => {
  weeklyRankingTrigger = weeklyRankingOpenButton;
  userProfile.hidden = true;
  userMenuToggle.setAttribute('aria-expanded', 'false');
  weeklyRankingDialog.showModal();
  expandedWeeklyRankingUserId = null;
  weeklyRankingCloseButton.focus();
  void loadWeeklyRanking();
});

weeklyRankingCloseButton.addEventListener('click', () => weeklyRankingDialog.close());
weeklyRankingDialog.addEventListener('close', () => {
  weeklyRankingRequestId += 1;
  if (currentSession && weeklyRankingTrigger?.isConnected) weeklyRankingTrigger.focus();
  weeklyRankingTrigger = null;
});

function openWantedFigure(wanted, figure) {
  if (!hasLoadedFullCatalog || !currentSession || wanted.dataset.ownerUser === currentSession.user.id) return;
  if (ownsMinifigura(wanted.dataset.wantedId)) {
    updateRankingWantedActions();
    showToast(duplicateMinifiguraMessage(wanted.dataset.wantedId) ?? messageForErrorCode('ID_DUPLICADO'), 'error');
    return;
  }
  if (figure) openFormDialog('ranking-create', figure, wanted);
}

async function handleRankingListClick(event) {
  const list = event.currentTarget;
  const entries = list === weeklyRankingList ? weeklyRankingEntries : rankingEntries;
  const profile = event.target.closest('[data-profile-user]');
  if (profile) {
    openPublicProfile(profile.dataset.profileUser, profile);
    return;
  }
  const wanted = event.target.closest('[data-wanted-id]');
  if (wanted) {
    const entry = entries.find(({ userId }) => userId === wanted.dataset.ownerUser);
    const figure = [...(entry?.top5Precio ?? []), ...(entry?.top5Antiguedad ?? [])].find(({ id }) => id === wanted.dataset.wantedId);
    openWantedFigure(wanted, figure);
    return;
  }
  const expand = event.target.closest('.ranking-expand');
  if (expand) {
    setExpandedRankingUser(expand.closest('.global-ranking-entry').dataset.userId, list);
    return;
  }
  const gift = event.target.closest('[data-gift-user]');
  if (!gift || gift.disabled) return;
  gift.disabled = true;
  try {
    const weekly = list === weeklyRankingList;
    const response = await apiFetch(weekly ? '/api/ranking/semanal/regalar' : '/api/ranking/regalar', {
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
    await Promise.all([
      loadGlobalRanking({ showState: rankingDialog.open }),
      loadWeeklyRanking({ showState: weeklyRankingDialog.open }),
      loadGamification(),
    ]);
    await loadGamificationDna();
    showToast(`Regalo de ${weekly ? 5 : 50} Bricks enviado.`, 'success');
  } catch {
    gift.disabled = false;
    showToast('No se pudo enviar el regalo.', 'error');
  }
}

globalRankingList.addEventListener('click', handleRankingListClick);
weeklyRankingList.addEventListener('click', handleRankingListClick);

userMenuToggle.addEventListener('click', () => {
  const expanded = userMenuToggle.getAttribute('aria-expanded') !== 'true';
  userMenuToggle.setAttribute('aria-expanded', String(expanded));
  userProfile.hidden = !expanded;
});

openUserSettingsButton.addEventListener('click', async () => {
  userProfile.hidden = true;
  userMenuToggle.setAttribute('aria-expanded', 'false');
  if (!currentUserProfile || !currentSession) return;
  if (!categoriasReady && !await loadCategorias()) {
    showToast('No se pudieron cargar las categorías favoritas.', 'error');
    return;
  }
  openProfileDialog(currentUserProfile, false);
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
    if (trigger === formObservedButton && currentFormMode === 'view' && formIdInput.value === minifigura.id) {
      formObservedButton.setAttribute('aria-pressed', String(Boolean(result.observada)));
      updateFormToggleStates();
    }
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

formPreviewImage.addEventListener('click', () => {
  if (window.matchMedia('(max-width: 600px)').matches && formIdInput.value.trim()) {
    mostrarImagenMinifigura(formIdInput.value, formNombreInput.value);
  }
});

imageModal.addEventListener('click', (event) => {
  if (event.target === imageModal) {
    closeImageModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (deleteAccountDialog.open) {
    event.preventDefault();
    if (!accountDeletionInFlight) deleteAccountDialog.close();
  } else if (profileDialog.open) {
    event.preventDefault();
    closeProfileDialog();
  } else if (imageModal.open) {
    event.preventDefault();
    closeImageModal();
  } else if (dnaDialog.open) {
    event.preventDefault();
    dnaDialog.close();
  } else if (analyticsHistoryDialog.open) {
    event.preventDefault();
    analyticsHistoryDialog.close();
  } else if (gamificationDialog.open) {
    event.preventDefault();
    gamificationDialog.close();
  } else if (formDialog.open) {
    event.preventDefault();
    closeFormDialog();
  } else if (rankingDialog.open) {
    event.preventDefault();
    rankingDialog.close();
  } else if (weeklyRankingDialog.open) {
    event.preventDefault();
    weeklyRankingDialog.close();
  }
});

formCancelButton.addEventListener('click', () => {
  closeFormDialog();
});

formDialog.addEventListener('close', () => {
  imageLookupSequence += 1;
  formSending = false;
  restoreRankingFocus(formTrigger);
  formTrigger = null;
  currentEditId = null;
  currentFormMode = null;
  formSynced = false;
  bricksetLoading.hidden = true;
  formPreviewImage.removeAttribute('src');
});

[formIdInput, formNombreInput, formCategoriaInput, formAnioInput, formPrecioInput, formEstadoInput].forEach((input) => {
  input.addEventListener('input', () => {
    if (currentFormMode === 'create' && input === formIdInput) {
      formError.textContent = '';
      formSending = false;
      imageLookupSequence += 1;
      bricksetLoading.hidden = true;
      formSynced = false;
      formNombreInput.value = '';
      formDescripcionInput.value = '';
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
  if (currentFormMode === 'view') {
    void toggleObserved({ id: formIdInput.value, observada: pressed }, formObservedButton);
    return;
  }
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
  if (!currentFormMode || currentFormMode === 'view' || formSending) return;
  formError.textContent = '';

  const isRankingCreate = currentFormMode === 'ranking-create';
  if (isRankingCreate && (!formSynced || !hasFormMetadata())) return;
  const duplicateMessage = currentEditId === null ? duplicateMinifiguraMessage(formIdInput.value) : null;
  if (duplicateMessage) {
    formError.textContent = duplicateMessage;
    updateRankingWantedActions();
    return;
  }

  const payload = buildPayloadFromForm();
  const validationError = validatePayload(payload);
  if (validationError) {
    formError.textContent = validationError;
    return;
  }

  const isEdit = currentEditId !== null;
  const sessionUserId = currentSession?.user?.id;
  const formSequence = imageLookupSequence;
  const isCurrent = () => formSequence === imageLookupSequence && sessionUserId === currentSession?.user?.id && formDialog.open;
  formSending = true;
  formSubmitButton.disabled = true;

  try {
    const url = isEdit ? `/minifiguras/${encodeURIComponent(currentEditId)}` : '/minifiguras';
    const response = await apiFetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json', 'x-gamificacion': 'true' },
      body: JSON.stringify(payload),
    });
    if (!isCurrent()) return;

    if (!response.ok) {
      let errorCode;
      try {
        errorCode = (await response.json())?.error;
      } catch {
        errorCode = undefined;
      }
      if (!isCurrent()) return;
      if (errorCode === 'LIMITE_OBSERVADAS') {
        formError.textContent = 'Límite alcanzado: Máximo 10 minifiguras en observación';
        showToast(formError.textContent, 'warning');
        return;
      }
      if (errorCode === 'ID_DUPLICADO') {
        let duplicateMessage = duplicateMinifiguraMessage(payload.id);
        try {
          const catalog = await fetchCatalog();
          if (!isCurrent()) return;
          setCatalogCache(catalog);
          applyFilters({ preservePage: true });
          duplicateMessage = duplicateMinifiguraMessage(payload.id);
        } catch {
          if (!isCurrent()) return;
        }
        formError.textContent = duplicateMessage ?? 'No se pudo comprobar el estado de la minifigura. Inténtalo de nuevo.';
        updateRankingWantedActions();
        return;
      }
      const errorMessage = messageForErrorCode(errorCode);
      formError.textContent = errorMessage;
      showToast(errorMessage, 'error');
      return;
    }

    const result = await response.json();
    if (!isCurrent()) return;
    showGamificationToasts(result.gamificacion);
    if (result.gamificacion?.state) ownGamification = {
      ...result.gamificacion.state, logrosDestacados: result.gamificacion.state.logrosDestacados ?? ownGamification?.logrosDestacados ?? [],
    };
    upsertCached(result);
    applyFilters({ preservePage: true });
    closeFormDialog();
    showToast(isEdit ? 'Minifigura actualizada correctamente.' : 'Minifigura creada correctamente.', 'success');
    void revalidate({ notifyAchievements: isEdit });
  } catch {
    if (!isCurrent()) return;
    const connError = 'No se pudo conectar con el servidor. Intentalo de nuevo.';
    formError.textContent = connError;
    showToast(connError, 'error');
  } finally {
    if (formSequence === imageLookupSequence) {
      formSending = false;
      updateFormMode();
    }
  }
});

async function loadFormBricksetData() {
  if (!formDialog.open || currentFormMode === 'view') return;
  const id = formIdInput.value.trim();
  if (!id || (id.length < 5 && currentFormMode !== 'ranking-create') || formPreviewImage.src !== imagenUrlPara(id)) return;
  const lookupSequence = imageLookupSequence;

  bricksetLoading.hidden = false;
  try {
    const response = await apiFetch(`/minifiguras/${encodeURIComponent(id)}/brickset`);
    const result = await response.json();
    if (!formDialog.open || currentFormMode === 'view' || imageLookupSequence !== lookupSequence || formIdInput.value.trim() !== id) return;
    if (!response.ok || typeof result.nombre !== 'string' || !result.nombre.trim()) {
      throw new Error(result.error ?? 'BRICKSET_NO_DISPONIBLE');
    }
    formNombreInput.value = result.nombre;
    formDescripcionInput.value = result.descripcion ?? '';
    formCategoriaInput.value = result.categoria;
    formSubcategoriaInput.value = result.subcategoria ?? '';
    formAnioInput.value = Number.isInteger(result.anio) && result.anio > 0 ? result.anio : currentYear;
    formPrecioInput.value = result.precio ?? '';
    formSynced = currentFormMode === 'ranking-create' ? hasFormMetadata() : true;
    formPreviewImage.alt = formNombreInput.value || id;
    updateFormMode();
    showToast('Datos actualizados.', 'success');
  } catch {
    if (formDialog.open && currentFormMode !== 'view' && imageLookupSequence === lookupSequence && formIdInput.value.trim() === id) {
      showToast('No se encontraron datos para el ID especificado.', 'error');
    }
  } finally {
    if (imageLookupSequence === lookupSequence) bricksetLoading.hidden = true;
  }
}

formPreviewImage.addEventListener('load', () => {
  if (currentFormMode !== 'ranking-create') void loadFormBricksetData();
});

formPreviewImage.addEventListener('error', () => {
  if (formPreviewImage.getAttribute('src') === imageFallbackUrl) return;
  if (currentFormMode !== 'ranking-create') void loadFormBricksetData();
  formPreviewImage.src = imageFallbackUrl;
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
    void revalidate({ notifyAchievements: true });
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
  const requestSession = currentSession;
  const response = await fetch(apiUrl(url), {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${requestSession?.access_token ?? ''}` },
  });
  if (response.status === 401 && currentSession && currentSession.access_token === requestSession?.access_token) {
    await endSession(SESSION_EXPIRED_MESSAGE);
  }
  return response;
}

function clearUserData() {
  profileRequestSequence += 1;
  profileReadyUserId = null;
  currentUserProfile = null;
  selectedProfileFavorites.clear();
  profileDialogTrigger = null;
  if (profileDialog.open) profileDialog.close();
  requestSequence += 1;
  gamificationRequestSequence += 1;
  achievementQueue = [];
  isShowingAchievement = false;
  toastRegion.replaceChildren();
  clearNotifications();
  clearFriends();
  clearPublicProfile();
  publicProfileTrigger = null;
  if (publicProfileDialog.open) publicProfileDialog.close();
  dnaRequestSequence += 1;
  analyticsHistoryRequestSequence += 1;
  clearAnalyticsHistoryData();
  analyticsHistoryTrigger = null;
  ownDnaState = null;
  dnaDialogTrigger = null;
  renderGamificationDna(null);
  if (dnaDialog.open) dnaDialog.close();
  achievementsTrigger = null;
  ownGamification = null;
  resetFeaturedAchievements();
  formTrigger = null;
  imageLookupSequence += 1;
  formSending = false;
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
  collectionTotalUpdated.textContent = '';
  lastCollectionTotal = null;
  collectionCount.textContent = '0';
  wantedCount.textContent = '0';
  renderTopFive([]);
  renderOldestFive([]);
  renderWatchlist([]);
  renderGamification({});
  rankingEntries = [];
  defaultRankingEntries = [];
  selectedRankingCriterion = 'nivel';
  for (const button of rankingOrderButtons) button.setAttribute('aria-pressed', String(button.dataset.rankingCriterion === 'nivel'));
  rankingRequestId += 1;
  expandedRankingUserId = null;
  weeklyRankingRequestId += 1;
  weeklyRankingEntries = [];
  expandedWeeklyRankingUserId = null;
  weeklyRankingStatus.textContent = '';
  weeklyRankingStatus.className = 'status';
  weeklyRankingList.replaceChildren();
  rankingMainGlobe.hidden = true;
  rankingMainGlobe.querySelector('#ranking-main-position').textContent = '';
  rankingMainGlobe.setAttribute('aria-label', 'En Top Global');
  globalRankingList.replaceChildren();
  rankingStatus.textContent = '';
  for (const button of document.querySelectorAll('.rankings-panel .panel-toggle, .watchlist-panel .panel-toggle')) {
    setPanelCollapsed(button, false);
  }
  for (const dialog of [deleteAccountDialog, profileDialog, firstMinifiguraDialog, formDialog, deleteDialog, gamificationDialog, notificationsDialog, dnaDialog, rankingDialog, weeklyRankingDialog, analyticsHistoryDialog]) {
    if (dialog.open) dialog.close();
  }
}

function setAuthMessage(message, { loading = false, error = false } = {}) {
  authMessage.textContent = message;
  authMessage.className = loading ? 'status loading-message' : error && message ? 'status error' : 'status';
  authMessage.setAttribute('role', loading ? 'status' : 'alert');
  authMessage.setAttribute('aria-live', loading ? 'polite' : 'assertive');
  authMessage.setAttribute('aria-busy', String(loading));
}

function showAuthScreen(message = '') {
  pageShell.hidden = true;
  authScreen.hidden = false;
  authAccessPanel.hidden = false;
  passwordRecoveryForm.hidden = true;
  passwordUpdateForm.hidden = true;
  profileCheckRetryButton.hidden = true;
  authRetryButton.hidden = true;
  if (deleteAccountDialog.open) deleteAccountDialog.close();
  if (profileDialog.open) profileDialog.close();
  currentUserProfile = null;
  setAuthMessage(message, { error: Boolean(message) });
  loginButton.disabled = supabaseClient === null;
  userName.textContent = '';
  userProfile.removeAttribute('title');
  userAvatar.hidden = true;
  userAvatar.removeAttribute('src');
  userProfile.hidden = true;
  userMenuToggle.setAttribute('aria-expanded', 'false');
}

function showProfileGate(message, canRetry = false, loading = false) {
  authScreen.hidden = false;
  pageShell.hidden = true;
  authAccessPanel.hidden = true;
  passwordRecoveryForm.hidden = true;
  passwordUpdateForm.hidden = true;
  profileCheckRetryButton.hidden = !canRetry;
  setAuthMessage(message, { loading, error: canRetry });
}

async function loadUserProfile(session, requestId) {
  try {
    const response = await apiFetch('/api/profile');
    if (requestId !== profileRequestSequence || currentSession?.user?.id !== session.user?.id) return;
    if (!response.ok) throw new Error('PERFIL_NO_DISPONIBLE');
    const profile = await response.json();
    if (requestId !== profileRequestSequence || currentSession?.user?.id !== session.user?.id) return;
    currentUserProfile = profile;
    if (profile?.onboardingCompleted !== true || !USERNAME_PATTERN.test(profile.username ?? '')) {
      profileReadyUserId = null;
      showProfileGate('Completa tu perfil para continuar a tu colección.');
      if (!categoriasReady) {
        setAuthMessage('Cargando categorías...', { loading: true });
        if (!await loadCategorias()) throw new Error('CATEGORIAS_NO_DISPONIBLES');
      }
      if (requestId !== profileRequestSequence || currentSession?.user?.id !== session.user?.id) return;
      setAuthMessage('Completa tu perfil para continuar a tu colección.');
      openProfileDialog(profile, true);
      return;
    }

    applyProfileAvatar(profile);
    startApplicationForCurrentProfile();
  } catch {
    if (requestId !== profileRequestSequence || currentSession?.user?.id !== session.user?.id) return;
    profileReadyUserId = null;
    showProfileGate('No se pudo comprobar tu perfil. Reintenta para continuar.', true);
  }
}

function startApplicationForCurrentProfile() {
  if (!currentSession?.user?.id) return;
  setAuthMessage('');
  profileReadyUserId = currentSession.user.id;
  authScreen.hidden = true;
  pageShell.hidden = false;
  profileCheckRetryButton.hidden = true;
  if (!appStarted) {
    appStarted = true;
    setFriendsCounts(null);
    void loadFriendsCounts();
    startNotificationsRealtime();
    initialize();
  }
  void syncNativePushPermission();
  resumePendingPushOpen();
}

function providerAvatarUrl(user) {
  const metadata = user?.user_metadata ?? {};
  const identity = user?.identities?.find((item) => item.provider === 'google')?.identity_data ?? {};
  for (const value of [metadata.avatar_url, metadata.picture, identity.avatar_url, identity.picture]) {
    if (typeof value !== 'string' || !value.trim()) continue;
    try {
      const avatar = new URL(value.trim());
      if (avatar.protocol === 'https:' || avatar.protocol === 'http:') return value.trim();
    } catch {
      continue;
    }
  }
  return '';
}

function applyProfileAvatar(profile) {
  userName.textContent = profile?.username || '';
  if (profile?.username) userProfile.title = profile.username;
  else userProfile.removeAttribute('title');
  const avatarUrl = profile?.avatarUrl || providerAvatarUrl(currentSession?.user);
  userAvatar.hidden = !avatarUrl;
  if (avatarUrl) userAvatar.src = avatarUrl;
  else userAvatar.removeAttribute('src');
}

function renderProfileFavoriteOptions() {
  const query = profileFavoriteSearch.value.trim().normalize('NFKC').toLocaleLowerCase();
  const visibleCategories = officialCategorias.filter(({ categoria }) => categoria.normalize('NFKC').toLocaleLowerCase().includes(query));
  profileFavoriteCategories.replaceChildren();
  for (const { categoria } of visibleCategories) {
    const label = document.createElement('label');
    label.className = 'profile-favorite-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = categoria;
    checkbox.checked = selectedProfileFavorites.has(categoria);
    checkbox.disabled = !checkbox.checked && selectedProfileFavorites.size >= 3;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (selectedProfileFavorites.size < 3) selectedProfileFavorites.add(categoria);
      } else selectedProfileFavorites.delete(categoria);
      renderProfileFavoriteOptions();
      profileFavoriteCategories.querySelectorAll('input').forEach((input) => {
        if (input.value === categoria) input.focus({ preventScroll: true });
      });
    });
    const name = document.createElement('span');
    name.textContent = categoria;
    label.append(checkbox, name);
    profileFavoriteCategories.append(label);
  }
  profileFavoritesCount.textContent = `${selectedProfileFavorites.size}/3`;
  profileSelectedCategories.replaceChildren();
  for (const category of selectedProfileFavorites) {
    const item = document.createElement('span');
    item.className = 'profile-selected-category';
    const name = document.createElement('span');
    name.textContent = category;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'profile-remove-button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Quitar ${category}`);
    remove.title = `Quitar ${category}`;
    remove.addEventListener('click', () => {
      selectedProfileFavorites.delete(category);
      renderProfileFavoriteOptions();
      profileFavoriteSearch.focus();
    });
    item.append(name, remove);
    profileSelectedCategories.append(item);
  }
}

function renderProfileAvatarPreview(source) {
  profileAvatarPreview.hidden = !source;
  profileAvatarPlaceholder.hidden = Boolean(source);
  if (source) profileAvatarPreview.src = source;
  else profileAvatarPreview.removeAttribute('src');
}

profileAvatarLoadButton.addEventListener('click', () => profileAvatarFileInput.click());
profileAvatarFileInput.addEventListener('change', () => {
  const file = profileAvatarFileInput.files?.[0];
  if (!file || profileSaveButton.disabled) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 2 * 1024 * 1024) {
    profileFormMessage.textContent = 'Elige una imagen PNG, JPEG o WebP de hasta 2 MB.';
    profileAvatarFileInput.value = '';
    return;
  }
  const requestId = ++profileAvatarReadSequence;
  const userId = currentSession?.user?.id;
  const reader = new FileReader();
  profileSaveButton.disabled = true;
  reader.onload = () => {
    if (requestId !== profileAvatarReadSequence || currentSession?.user?.id !== userId || !profileDialog.open) return;
    pendingProfileAvatarFile = file;
    renderProfileAvatarPreview(reader.result);
    profileFormMessage.textContent = '';
    profileSaveButton.disabled = false;
  };
  reader.onerror = () => {
    if (requestId !== profileAvatarReadSequence) return;
    profileFormMessage.textContent = 'No se pudo leer la imagen. Inténtalo de nuevo.';
    profileSaveButton.disabled = false;
  };
  reader.readAsDataURL(file);
});
profileAvatarRemoveButton.addEventListener('click', () => {
  profileAvatarReadSequence += 1;
  pendingProfileAvatarFile = null;
  profileAvatarFileInput.value = '';
  profileAvatarInput.value = '';
  profileSaveButton.disabled = false;
  renderProfileAvatarPreview(providerAvatarUrl(currentSession?.user));
});
profileAvatarPreview.addEventListener('error', () => {
  if (pendingProfileAvatarFile) {
    pendingProfileAvatarFile = null;
    profileFormMessage.textContent = 'No se pudo previsualizar la imagen. Elige otra.';
  }
  renderProfileAvatarPreview('');
});

function ownedProfileAvatarPath(url, userId) {
  if (!url) return null;
  try {
    const sample = supabaseClient.storage.from('profile-avatars').getPublicUrl(`${userId}/avatar.png`).data.publicUrl;
    const root = new URL('.', sample);
    const candidate = new URL(url);
    if (candidate.origin !== root.origin || !candidate.pathname.startsWith(root.pathname)) return null;
    const filename = decodeURIComponent(candidate.pathname.slice(root.pathname.length));
    return filename && !filename.includes('/') ? `${userId}/${filename}` : null;
  } catch {
    return null;
  }
}

async function removeProfileAvatar(path) {
  if (!path) return;
  try {
    await supabaseClient.storage.from('profile-avatars').remove([path]);
  } catch {
    return;
  }
}

function openProfileDialog(profile, onboarding) {
  profileDialogMode = onboarding ? 'onboarding' : 'settings';
  profileDialogTrigger = onboarding ? null : document.activeElement;
  profileDialogTitle.textContent = onboarding ? 'Completa tu perfil' : 'Preferencias';
  profileDialogCloseButton.hidden = onboarding;
  openDeleteAccountButton.hidden = onboarding;
  profileUsernameInput.disabled = !onboarding;
  profileUsernameInput.value = profile?.username || pendingRegistrationUsername || currentSession?.user?.user_metadata?.username || '';
  profileAvatarInput.value = profile?.avatarUrl || '';
  profileAvatarReadSequence += 1;
  pendingProfileAvatarFile = null;
  profileAvatarFileInput.value = '';
  renderProfileAvatarPreview(profile?.avatarUrl || providerAvatarUrl(currentSession?.user));
  profileCurrencyInput.value = profile?.currency || 'EUR';
  profileLanguageInput.value = profile?.language || 'es';
  selectedProfileFavorites = new Set((profile?.favoriteCategories ?? []).slice(0, 3));
  profileFavoriteSearch.value = '';
  profileFormMessage.textContent = '';
  profileSaveButton.textContent = onboarding ? 'Completar perfil' : 'Guardar cambios';
  renderProfileFavoriteOptions();
  if (!profileDialog.open) profileDialog.showModal();
  (onboarding ? profileUsernameInput : profileAvatarLoadButton).focus();
}

function closeProfileDialog() {
  if (profileDialogMode === 'onboarding') return;
  profileDialog.close();
}

function validProfileAvatarUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function saveUserProfile(event) {
  event.preventDefault();
  if (!currentSession || profileSaveButton.disabled) return;
  const username = profileUsernameInput.value;
  const avatarUrl = profileAvatarInput.value.trim();
  if (!USERNAME_PATTERN.test(username)) {
    profileFormMessage.textContent = 'El username debe tener entre 3 y 20 letras, números o guiones bajos.';
    profileUsernameInput.focus();
    return;
  }
  if (!validProfileAvatarUrl(avatarUrl)) {
    profileFormMessage.textContent = 'Introduce una URL de avatar HTTP o HTTPS válida.';
    profileAvatarInput.focus();
    return;
  }

  const savingUserId = currentSession.user.id;
  const avatarFile = pendingProfileAvatarFile;
  const previousAvatarUrl = currentUserProfile?.avatarUrl;
  let uploadedAvatarPath = null;
  let profileSaved = false;
  const profile = {
    username,
    avatarUrl: avatarUrl || null,
    currency: profileCurrencyInput.value,
    language: profileLanguageInput.value,
    favoriteCategories: [...selectedProfileFavorites],
  };
  profileSaveButton.disabled = true;
  profileAvatarLoadButton.disabled = true;
  profileAvatarRemoveButton.disabled = true;
  profileFormMessage.textContent = '';
  try {
    if (avatarFile) {
      const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[avatarFile.type];
      const path = `${savingUserId}/${crypto.randomUUID()}.${extension}`;
      const bucket = supabaseClient.storage.from('profile-avatars');
      const { error } = await bucket.upload(path, avatarFile, { contentType: avatarFile.type, cacheControl: '3600', upsert: false });
      if (error) throw new Error('AVATAR_NO_DISPONIBLE');
      uploadedAvatarPath = path;
      profile.avatarUrl = bucket.getPublicUrl(path).data.publicUrl;
      if (currentSession?.user?.id !== savingUserId) return;
    }
    const response = await apiFetch('/api/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(profile),
    });
    const result = await response.json();
    if (currentSession?.user?.id !== savingUserId) return;
    if (!response.ok) {
      const errors = {
        PERFIL_INVALIDO: 'Revisa los datos del perfil.',
        CATEGORIA_FAVORITA_INVALIDA: 'Una categoría seleccionada ya no está disponible.',
        USERNAME_OCUPADO: 'Ese username ya está ocupado. Elige otro.',
        USERNAME_INMUTABLE: 'El username no se puede cambiar.',
      };
      profileFormMessage.textContent = errors[result.error] ?? 'No se pudo guardar el perfil. Inténtalo de nuevo.';
      return;
    }

    profileSaved = true;
    currentUserProfile = result;
    pendingRegistrationUsername = '';
    applyProfileAvatar(result);
    profileDialog.close();
    if (profileDialogMode === 'onboarding') startApplicationForCurrentProfile();
    if (previousAvatarUrl !== result.avatarUrl) {
      await removeProfileAvatar(ownedProfileAvatarPath(previousAvatarUrl, savingUserId));
    }
  } catch {
    if (currentSession?.user?.id === savingUserId) profileFormMessage.textContent = 'No se pudo guardar el perfil. Inténtalo de nuevo.';
  } finally {
    if (uploadedAvatarPath && !profileSaved && currentSession?.user?.id === savingUserId) {
      await removeProfileAvatar(uploadedAvatarPath);
    }
    profileSaveButton.disabled = false;
    profileAvatarLoadButton.disabled = false;
    profileAvatarRemoveButton.disabled = false;
  }
}

function checkUserProfile(session) {
  const requestId = ++profileRequestSequence;
  showProfileGate('Comprobando tu perfil…', false, true);
  void loadUserProfile(session, requestId);
}

function handleSession(session, message = '') {
  if (!session && currentSession?.user?.id && nativePushRegistration) {
    void revokeNativePushSession(currentSession);
  }
  if (currentSession?.user?.id && session?.user?.id && currentSession.user.id !== session.user.id
    && nativePushRegistration) {
    void revokeNativePushSession(currentSession);
  }
  if (appStarted && currentSession?.user?.id && session?.user?.id && currentSession.user.id !== session.user.id) {
    clearUserData();
    appStarted = false;
  }
  currentSession = session;
  if (!session) {
    if (appStarted) clearUserData();
    appStarted = false;
    showAuthScreen(message);
    return;
  }

  if (profileReadyUserId === session.user?.id && appStarted) {
    authScreen.hidden = true;
    pageShell.hidden = false;
    return;
  }

  const avatarUrl = providerAvatarUrl(session.user);
  userName.textContent = '';
  userProfile.removeAttribute('title');
  userAvatar.hidden = !avatarUrl;
  userProfile.hidden = true;
  userMenuToggle.setAttribute('aria-expanded', 'false');
  if (avatarUrl) userAvatar.src = avatarUrl;
  else userAvatar.removeAttribute('src');
  checkUserProfile(session);
}

async function endSession(message = '', { skipPushRevocation = false } = {}) {
  const endingSession = currentSession;
  if (!skipPushRevocation && endingSession && nativePushRegistration) await revokeNativePushSession(endingSession);
  currentSession = null;
  try {
    await supabaseClient.auth.signOut({ scope: 'local' });
  } catch {
    // The local session is discarded below even if Supabase cannot be reached.
  }
  handleSession(null, message);
}

function authRedirectUrl() {
  return nativeAuth ? nativeOAuthRedirectUrl : `${window.location.origin}${window.location.pathname}`;
}

function showNativeOAuthError() {
  nativeOAuthPending = false;
  clearTimeout(nativeOAuthFinishTimer);
  loginButton.disabled = false;
  setAuthMessage('No se pudo completar el acceso con Google. Vuelve a intentarlo.', { error: true });
}

async function processNativeOAuthCallback(rawUrl) {
  let callbackUrl;
  try {
    callbackUrl = new URL(rawUrl);
  } catch {
    showNativeOAuthError();
    return;
  }

  const allowedParameters = new Set(['code', 'error', 'error_code', 'error_description']);
  const codes = callbackUrl.searchParams.getAll('code');
  if (callbackUrl.protocol !== 'com.mrdusik.minipeopledb:' || callbackUrl.hostname !== 'auth'
    || callbackUrl.pathname !== '/callback' || callbackUrl.port || callbackUrl.username || callbackUrl.password
    || callbackUrl.hash || [...callbackUrl.searchParams.keys()].some((key) => !allowedParameters.has(key))
    || ['error', 'error_code', 'error_description'].some((key) => callbackUrl.searchParams.has(key))
    || codes.length !== 1 || !codes[0] || !supabaseClient) {
    showNativeOAuthError();
    return;
  }

  nativeOAuthPending = false;
  clearTimeout(nativeOAuthFinishTimer);
  try {
    const { data, error } = await supabaseClient.auth.exchangeCodeForSession(codes[0]);
    if (error || !data?.session) throw new Error('OAUTH_CALLBACK_INVALIDO');
    await nativeAuth.closeBrowser();
    handleSession(data.session);
  } catch {
    showNativeOAuthError();
  }
}

async function receiveNativeOAuthCallback(rawUrl) {
  if (!supabaseClient) {
    pendingNativeOAuthCallbackUrl = rawUrl;
    return;
  }
  await processNativeOAuthCallback(rawUrl);
}

async function initializeAuth() {
  showAuthScreen();
  setAuthMessage('Preparando el acceso...', { loading: true });
  if (nativeAuth) {
    try {
      if (!nativeAppUrlListenerRegistered) {
        await nativeAuth.addListener('appUrlOpen', ({ url }) => {
          void receiveNativeOAuthCallback(url);
        });
        nativeAppUrlListenerRegistered = true;
      }
      if (!nativeBrowserFinishedListenerRegistered) {
        await nativeAuth.addBrowserFinishedListener(() => {
          if (!nativeOAuthPending) return;
          clearTimeout(nativeOAuthFinishTimer);
          nativeOAuthFinishTimer = setTimeout(() => {
            if (nativeOAuthPending) showNativeOAuthError();
          }, 500);
        });
        nativeBrowserFinishedListenerRegistered = true;
      }
    } catch {
      setAuthMessage('No se pudo preparar el acceso seguro. Inténtalo de nuevo.', { error: true });
      authRetryButton.hidden = false;
      return;
    }
  }
  try {
    const response = await fetch(apiUrl('/config/supabase'));
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
    authRetryButton.hidden = false;
    return;
  }

  // Supabase warns against calling its API inside this callback, so it only updates local state.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      showPasswordUpdate(session);
      return;
    }
    if (session || currentSession) handleSession(session);
  });
  try {
    if (nativeAuth) {
      const launch = await nativeAuth.getLaunchUrl();
      pendingNativeOAuthCallbackUrl ??= launch?.url ?? null;
      if (pendingNativeOAuthCallbackUrl) {
        const callbackUrl = pendingNativeOAuthCallbackUrl;
        pendingNativeOAuthCallbackUrl = null;
        await processNativeOAuthCallback(callbackUrl);
      }
    }
    const { data } = await supabaseClient.auth.getSession();
    handleSession(data?.session ?? null);
  } catch {
    handleSession(null, 'No se pudo recuperar la sesión.');
  }
}

authRetryButton.addEventListener('click', async () => {
  authRetryButton.disabled = true;
  try {
    await initializeAuth();
  } finally {
    authRetryButton.disabled = false;
  }
});

loginButton.addEventListener('click', async () => {
  if (!supabaseClient) return;
  setAuthMessage('Conectando con Google...', { loading: true });
  loginButton.disabled = true;
  try {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectUrl(),
        ...(nativeAuth ? { skipBrowserRedirect: true } : {}),
        // Google reutiliza la cuenta activa del navegador si no se fuerza el selector.
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) throw error;
    if (nativeAuth) {
      if (typeof data?.url !== 'string' || !data.url.startsWith('https://')) {
        throw new Error('OAUTH_URL_INVALIDA');
      }
      nativeOAuthPending = true;
      await nativeAuth.openBrowser(data.url);
    }
  } catch {
    setAuthMessage('No se pudo iniciar sesión con Google. Inténtalo de nuevo.', { error: true });
    loginButton.disabled = false;
  }
});

let passwordRepeatBlurred = false;

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === 'register';
  document.querySelector('#auth-google-label').textContent = registering ? 'Usa tu cuenta de Google' : 'Inicia sesión con Google';
  document.querySelector('#auth-divider').textContent = registering ? 'o crea una nueva cuenta en MiniPeopleDB' : 'o con tu usuario de MiniPeopleDB';
  passwordRepeatBlurred = false;
  openPasswordRecoveryButton.hidden = registering;
  authUsernameField.hidden = false;
  authUsernameInput.required = true;
  document.querySelector('#auth-email-field').hidden = !registering;
  authEmailInput.disabled = !registering;
  authEmailInput.required = registering;
  authUsernameInput.setCustomValidity('');
  document.querySelector('#auth-password-repeat-field').hidden = !registering;
  authPasswordRepeatInput.disabled = !registering;
  authPasswordRepeatInput.required = registering;
  document.querySelector('#auth-password-rules').hidden = !registering;
  setPasswordVisibility(false);
  authPasswordRepeatInput.value = '';
  authPasswordInput.autocomplete = registering ? 'new-password' : 'current-password';
  validateRegistrationPassword();
  classicAuthSubmit.textContent = registering ? 'Crear cuenta' : 'Iniciar sesión';
  authModeLoginButton.setAttribute('aria-pressed', String(!registering));
  authModeRegisterButton.setAttribute('aria-pressed', String(registering));
  setAuthMessage('');
}

function showPasswordRecovery(show) {
  authAccessPanel.hidden = show;
  passwordRecoveryForm.hidden = !show;
  passwordUpdateForm.hidden = true;
  setAuthMessage('');
  if (show) recoveryEmailInput.value = authEmailInput.value;
}

function showPasswordUpdate(session) {
  currentSession = session;
  pageShell.hidden = true;
  authScreen.hidden = false;
  authAccessPanel.hidden = true;
  passwordRecoveryForm.hidden = true;
  passwordUpdateForm.hidden = false;
  newPasswordInput.value = '';
  setAuthMessage('');
  newPasswordInput.focus();
}

authModeLoginButton.addEventListener('click', () => setAuthMode('login'));
authModeRegisterButton.addEventListener('click', () => setAuthMode('register'));

function validateRegistrationPassword() {
  const password = authPasswordInput.value;
  const rules = {
    length: password.length >= 5,
    uppercase: /\p{Lu}/u.test(password),
    lowercase: /\p{Ll}/u.test(password),
    number: /[0-9]/.test(password),
  };
  for (const [rule, met] of Object.entries(rules)) {
    document.querySelector(`[data-rule="${rule}"]`).classList.toggle('is-met', met);
  }
  authPasswordInput.setCustomValidity(authMode === 'register' && !Object.values(rules).every(Boolean)
    ? 'La contraseña debe cumplir todas las directrices de seguridad.' : '');
  authPasswordRepeatInput.setCustomValidity(authMode === 'register' && authPasswordRepeatInput.value !== password
    ? 'Las contraseñas no coinciden.' : '');
  authPasswordRepeatInput.setAttribute('aria-invalid', String(passwordRepeatBlurred && authPasswordRepeatInput.validity.customError));
}

authPasswordInput.addEventListener('input', validateRegistrationPassword);
authPasswordRepeatInput.addEventListener('input', validateRegistrationPassword);
authPasswordRepeatInput.addEventListener('blur', () => {
  passwordRepeatBlurred = true;
  validateRegistrationPassword();
});
function setPasswordVisibility(visible) {
  const type = visible ? 'text' : 'password';
  authPasswordInput.type = type;
  authPasswordRepeatInput.type = type;
  const label = visible
    ? (authMode === 'register' ? 'Ocultar contraseñas' : 'Ocultar contraseña')
    : (authMode === 'register' ? 'Mostrar contraseñas' : 'Mostrar contraseña');
  for (const button of authShowPasswordButtons) {
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', label);
    button.title = label;
    button.querySelector('use').setAttribute('href', visible ? '#auth-eye-icon' : '#auth-eye-off-icon');
  }
}

for (const button of authShowPasswordButtons) {
  button.addEventListener('click', () => setPasswordVisibility(authPasswordInput.type === 'password'));
}
authUsernameInput.addEventListener('input', () => authUsernameInput.setCustomValidity(''));

classicAuthForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  const username = authUsernameInput.value;
  setAuthMessage('');
  authUsernameInput.setCustomValidity(USERNAME_PATTERN.test(username) ? '' : 'Usa entre 3 y 20 letras, números o guiones bajos.');
  validateRegistrationPassword();
  if (!classicAuthForm.reportValidity()) return;
  classicAuthSubmit.disabled = true;
  setAuthMessage(authMode === 'register' ? 'Creando tu cuenta...' : 'Iniciando sesión...', { loading: true });
  try {
    if (authMode === 'register') {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          ...(nativeAuth ? { emailRedirectTo: nativeOAuthRedirectUrl } : {}),
        },
      });
      if (error) throw error;
      pendingRegistrationUsername = username;
      setAuthMessage(data?.session
        ? 'Cuenta creada. Completa tu perfil para continuar.'
        : 'Si el email puede registrarse, recibirás instrucciones para confirmar la cuenta.');
    } else {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error('Acceso rechazado');
      const tokens = await response.json();
      const { error } = await supabaseClient.auth.setSession(tokens);
      if (error) throw error;
    }
    authPasswordInput.value = '';
    authPasswordRepeatInput.value = '';
    setPasswordVisibility(false);
    validateRegistrationPassword();
  } catch {
    setAuthMessage(authMode === 'register'
      ? 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.'
      : 'No se pudo iniciar sesión. Revisa el username y la contraseña.', { error: true });
  } finally {
    classicAuthSubmit.disabled = false;
  }
});

openPasswordRecoveryButton.addEventListener('click', () => showPasswordRecovery(true));
cancelPasswordRecoveryButton.addEventListener('click', () => showPasswordRecovery(false));

passwordRecoveryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const submitButton = passwordRecoveryForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setAuthMessage('Enviando enlace de recuperación...', { loading: true });
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(recoveryEmailInput.value.trim(), {
      redirectTo: authRedirectUrl(),
    });
    if (error) throw error;
    setAuthMessage('Si el email puede recuperarse, recibirás un enlace para cambiar la contraseña.');
  } catch {
    setAuthMessage('No se pudo solicitar la recuperación. Inténtalo de nuevo.', { error: true });
  } finally {
    submitButton.disabled = false;
  }
});

passwordUpdateForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const submitButton = passwordUpdateForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setAuthMessage('Actualizando contraseña...', { loading: true });
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPasswordInput.value });
    if (error) throw error;
    newPasswordInput.value = '';
    passwordUpdateForm.hidden = true;
    handleSession(currentSession, 'La contraseña se actualizó correctamente.');
  } catch {
    setAuthMessage('No se pudo cambiar la contraseña. Inténtalo de nuevo.', { error: true });
  } finally {
    submitButton.disabled = false;
  }
});

profileCheckRetryButton.addEventListener('click', () => {
  if (currentSession) checkUserProfile(currentSession);
});

profileFavoriteSearch.addEventListener('input', renderProfileFavoriteOptions);
openDeleteAccountButton.addEventListener('click', () => {
  if (!currentSession || profileDialogMode !== 'settings' || !currentUserProfile?.onboardingCompleted
    || profileSaveButton.disabled || accountDeletionInFlight) return;
  accountDeletionUserId = currentSession.user.id;
  deleteAccountError.textContent = '';
  deleteAccountDialog.showModal();
  deleteAccountCancelButton.focus();
});

deleteAccountCancelButton.addEventListener('click', () => {
  if (!accountDeletionInFlight) deleteAccountDialog.close();
});
deleteAccountDialog.addEventListener('cancel', (event) => {
  if (accountDeletionInFlight) event.preventDefault();
});
deleteAccountDialog.addEventListener('close', () => {
  accountDeletionUserId = null;
  if (profileDialog.open && currentSession) openDeleteAccountButton.focus();
});
deleteAccountConfirmButton.addEventListener('click', async () => {
  if (accountDeletionInFlight || !accountDeletionUserId || currentSession?.user?.id !== accountDeletionUserId) return;
  const deletingUserId = accountDeletionUserId;
  accountDeletionInFlight = true;
  deleteAccountConfirmButton.disabled = true;
  deleteAccountCancelButton.disabled = true;
  openDeleteAccountButton.disabled = true;
  deleteAccountError.textContent = '';
  try {
    const response = await apiFetch('/api/profile', { method: 'DELETE' });
    if (currentSession?.user?.id !== deletingUserId) return;
    if (response.status !== 204) throw new Error('CUENTA_NO_ELIMINADA');
    nativePushRegistration?.accountDeleted(deletingUserId);
    await endSession('Tu cuenta se ha eliminado correctamente.', { skipPushRevocation: true });
  } catch {
    if (currentSession?.user?.id === deletingUserId) {
      deleteAccountError.textContent = 'No se pudo eliminar la cuenta. Inténtalo de nuevo.';
    }
  } finally {
    accountDeletionInFlight = false;
    deleteAccountConfirmButton.disabled = false;
    deleteAccountCancelButton.disabled = false;
    openDeleteAccountButton.disabled = false;
  }
});

profileForm.addEventListener('submit', saveUserProfile);
profileDialogCloseButton.addEventListener('click', closeProfileDialog);
profileDialog.addEventListener('cancel', (event) => {
  if (profileDialogMode === 'onboarding') event.preventDefault();
});
profileDialog.addEventListener('close', () => {
  profileAvatarReadSequence += 1;
  pendingProfileAvatarFile = null;
  profileAvatarFileInput.value = '';
  if (!profileAvatarLoadButton.disabled) profileSaveButton.disabled = false;
  if (profileDialogMode !== 'onboarding' && profileDialogTrigger?.isConnected) profileDialogTrigger.focus();
  profileDialogTrigger = null;
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  if (currentSession && nativePushRegistration) await revokeNativePushSession(currentSession);
  try {
    await supabaseClient.auth.signOut();
  } catch {
    // Fall through to discard the local session.
  }
  logoutButton.disabled = false;
  handleSession(null);
});

setCategoriaControlsEnabled(false);
if (nativePush) {
  void initializeNativePushListeners().finally(() => initializeAuth());
} else {
  void initializeAuth();
}
