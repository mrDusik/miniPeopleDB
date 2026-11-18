(() => {
  const supportedLanguages = new Set(['es', 'en', 'it', 'fr']);
  const locales = { es: 'es-ES', en: 'en-GB', it: 'it-IT', fr: 'fr-FR' };
  const unavailableMessages = {
    es: 'No se pudo mostrar este texto.',
    en: 'This text is unavailable.',
    it: 'Impossibile visualizzare questo testo.',
    fr: 'Impossible d’afficher ce texte.',
  };
  const storageKey = 'minipeople.language';
  const pendingCatalogs = new Map();
  const diagnostics = new Set();
  let language = 'es';
  let engine;
  let engineReady;

  function diagnose(code, key, requestedLanguage = language) {
    const identity = `${code}:${requestedLanguage}:${key ?? ''}`;
    if (diagnostics.has(identity)) return;
    diagnostics.add(identity);
    console.warn('[i18n]', code, requestedLanguage, key ?? '');
  }

  function validateLanguage(value) {
    if (!supportedLanguages.has(value)) throw new RangeError('IDIOMA_NO_SOPORTADO');
  }

  function getEngine() {
    if (!engineReady) {
      if (!window.i18next?.createInstance) throw new Error('TRADUCCIONES_NO_DISPONIBLES');
      engine = window.i18next.createInstance();
      engineReady = engine.init({
        lng: 'es',
        fallbackLng: 'es',
        supportedLngs: [...supportedLanguages],
        resources: {},
        showSupportNotice: false,
        keySeparator: false,
        nsSeparator: false,
        interpolation: { escapeValue: false },
        returnNull: false,
        returnEmptyString: false,
      });
    }
    return engineReady;
  }

  async function loadCatalog(requestedLanguage) {
    await getEngine();
    if (engine.hasResourceBundle(requestedLanguage, 'translation')) return;
    if (!pendingCatalogs.has(requestedLanguage)) {
      const request = (async () => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(`/locales/${requestedLanguage}.json`, { signal: controller.signal });
          if (!response.ok) throw new Error('TRADUCCIONES_NO_DISPONIBLES');
          const catalog = await response.json();
          if (!catalog || Array.isArray(catalog) || typeof catalog !== 'object'
            || Object.values(catalog).some((value) => typeof value !== 'string' || value.length === 0)) {
            throw new Error('CATALOGO_TRADUCCIONES_INVALIDO');
          }
          engine.addResourceBundle(requestedLanguage, 'translation', catalog);
        } finally {
          window.clearTimeout(timeout);
        }
      })();
      pendingCatalogs.set(requestedLanguage, request);
    }
    try {
      await pendingCatalogs.get(requestedLanguage);
    } finally {
      pendingCatalogs.delete(requestedLanguage);
    }
  }

  async function prepare(requestedLanguage) {
    validateLanguage(requestedLanguage);
    await Promise.all([...new Set(['es', requestedLanguage])].map(loadCatalog));
  }

  function t(key, parameters = {}) {
    if (typeof key !== 'string' || !key) throw new TypeError('CLAVE_TRADUCCION_INVALIDA');
    const options = { ...parameters, lng: language, fallbackLng: false };
    if (engine?.exists(key, options)) return engine.t(key, options);
    diagnose('TRADUCCION_AUSENTE', key);
    if (language !== 'es' && engine?.exists(key, { ...options, lng: 'es' })) {
      return engine.t(key, { ...options, lng: 'es' });
    }
    return unavailableMessages[language];
  }

  function applyStatic(root = document) {
    const selector = '[data-i18n],[data-i18n-title],[data-i18n-aria-label],[data-i18n-placeholder],[data-i18n-alt]';
    const elements = [...root.querySelectorAll(selector)];
    if (root.matches?.(selector)) elements.unshift(root);
    for (const element of elements) {
      if (element.hasAttribute('data-i18n')) element.textContent = t(element.getAttribute('data-i18n'));
      for (const attribute of ['title', 'aria-label', 'placeholder', 'alt']) {
        const key = element.getAttribute(`data-i18n-${attribute}`);
        if (key) element.setAttribute(attribute, t(key));
      }
    }
  }

  async function setLanguage(requestedLanguage, { remember = false, isCurrent = () => true } = {}) {
    await prepare(requestedLanguage);
    if (!isCurrent()) return false;
    const changed = language !== requestedLanguage;
    language = requestedLanguage;
    document.documentElement.lang = language;
    if (remember) {
      try {
        window.localStorage.setItem(storageKey, language);
      } catch {
        diagnose('ALMACENAMIENTO_IDIOMA_NO_DISPONIBLE');
      }
    }
    applyStatic();
    if (changed) window.dispatchEvent(new CustomEvent('minipeople:languagechange'));
    return true;
  }

  async function initialize() {
    let remembered = null;
    try {
      remembered = window.localStorage.getItem(storageKey);
    } catch {
      diagnose('ALMACENAMIENTO_IDIOMA_NO_DISPONIBLE');
    }
    if (remembered !== null && !supportedLanguages.has(remembered)) {
      diagnose('PREFERENCIA_IDIOMA_INVALIDA');
    }
    return setLanguage(supportedLanguages.has(remembered) ? remembered : 'es');
  }

  window.MiniPeopleI18n = {
    get language() { return language; },
    get locale() { return locales[language]; },
    initialize,
    prepare,
    setLanguage,
    t,
    applyStatic,
    formatNumber(value, options = {}) {
      return new Intl.NumberFormat(locales[language], options).format(value);
    },
    formatDate(value, options = {}) {
      return new Intl.DateTimeFormat(locales[language], options).format(value);
    },
  };
})();
