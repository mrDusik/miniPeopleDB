import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { startTestServer } from '../test-support/server.js';

const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

test('las flechas de ordenacion quedan rojas a la derecha del nombre sin salto de linea', () => {
  withStyles((rules) => {
    const button = rules.find(({ selectorText }) => selectorText === '.table-sort').style;
    assert.equal(button.getPropertyValue('display'), 'inline-flex');
    assert.equal(button.getPropertyValue('white-space'), 'nowrap');
    const arrow = rules.find(({ selectorText, style }) => selectorText === '.table-sort::after' && style.getPropertyValue('color')).style;
    assert.equal(arrow.getPropertyValue('color'), 'var(--accent)');
    assert.ok(arrow.getPropertyValue('content'));
  });
});

test('el avatar principal iguala las dimensiones de los accesos sin ampliacion', () => {
  withStyles((rules) => {
    const selector = '#user-menu-toggle .user-avatar:not([hidden]), #user-menu-toggle .user-avatar-fallback';
    const avatar = rules.find(({ selectorText }) => selectorText === selector).style;
    const button = rules.find(({ selectorText }) => selectorText === '.notifications-trigger').style;
    for (const property of ['width', 'height']) assert.equal(avatar.getPropertyValue(property), button.getPropertyValue(property));
    assert.equal(avatar.getPropertyValue('transform'), 'none');
    const responsive = rules.find(({ conditionText }) => conditionText?.startsWith('(max-width: 760px),'));
    const compact = [...responsive.cssRules].find(({ selectorText }) => selectorText === selector).style;
    assert.equal(compact.getPropertyValue('width'), '44px');
    assert.equal(compact.getPropertyValue('height'), '44px');
  });
});

test('preferencias ajusta el contenido sin scroll exterior y mantiene la lista desplazable', () => {
  withStyles((rules) => {
    const dialog = rules.find(({ selectorText }) => selectorText === '.user-profile-dialog').style;
    assert.equal(dialog.getPropertyValue('overflow'), 'hidden');
    const form = rules.find(({ selectorText }) => selectorText === '#user-profile-form').style;
    assert.equal(form.getPropertyValue('min-height'), '0');
    const list = rules.find(({ selectorText }) => selectorText === '.profile-favorite-categories').style;
    assert.equal(list.getPropertyValue('overflow'), 'auto');
    assert.equal(list.getPropertyValue('min-height'), '0');
    assert.equal(list.getPropertyValue('flex'), '1 1 0');
    assert.equal(list.getPropertyValue('max-height'), '');
    assert.equal(form.getPropertyValue('gap'), '12px');
    const compact = rules.find(({ conditionText }) => conditionText === '(max-height: 700px)');
    assert.ok(compact);
    assert.equal(rules.some(({ conditionText }) => conditionText === '(max-height: 1100px)'), false);
    const landscape = rules.find(({ conditionText }) => conditionText === '(max-height: 500px) and (min-width: 601px)');
    const landscapeForm = [...landscape.cssRules].find(({ selectorText }) => selectorText === '#user-profile-form').style;
    assert.equal(landscapeForm.getPropertyValue('grid-template-columns'), 'repeat(2, minmax(0, 1fr))');
  });
});

test('la lupa de accion de las tarjetas mide la mitad sin reducir el area pulsable', () => {
  withStyles((rules) => {
    const icon = rules.find(({ selectorText }) => selectorText === '.ranking-add-wanted .magnifier-icon').style;
    for (const property of ['width', 'height', 'font-size']) assert.equal(icon.getPropertyValue(property), '11px');
    const action = rules.find(({ selectorText }) => selectorText === '.ranking-add-wanted').style;
    assert.equal(action.getPropertyValue('width'), '36px');
    const mobile = rules.filter(({ cssRules }) => cssRules).flatMap(({ cssRules }) => [...cssRules]);
    for (const selector of [
      '.ranking-user-details .ranking-highlight-group .ranking-add-wanted .magnifier-icon',
      '.modal-public-profile .public-profile-figures .ranking-add-wanted .magnifier-icon',
    ]) {
      const style = mobile.find(({ selectorText }) => selectorText === selector).style;
      for (const property of ['width', 'height', 'font-size']) assert.equal(style.getPropertyValue(property), '9px');
    }
  });
});

test('el perfil publico alinea los logros en columnas compartidas y conserva los iconos junto a sus contadores', () => {
  withStyles((rules, document) => {
    const item = rules.find(({ selectorText }) => selectorText === '#public-profile-dialog .achievement-item').style;
    assert.equal(item.getPropertyValue('grid-template-columns'), 'subgrid');
    const count = rules.find(({ selectorText }) => selectorText === '#public-profile-dialog .achievement-count').style;
    assert.equal(count.getPropertyValue('grid-column'), '3');
    const bricks = rules.find(({ selectorText }) => selectorText === '#public-profile-dialog .achievement-bricks').style;
    assert.equal(bricks.getPropertyValue('gap'), '8px');
    const icon = document.querySelector('.public-profile-stat-icon.box-icon');
    const counterSelector = rules.find(({ selectorText }) => selectorText?.includes('span:not(.public-profile-stat-icon),')).selectorText;
    assert.equal(icon.matches(counterSelector), false);
    assert.equal(document.getElementById('public-profile-collection-count').matches(counterSelector), true);
  });
});

test('las tarjetas de minifiguras no tienen marco y conservan el foco visible', () => {
  withStyles((rules) => {
    for (const selector of ['.ranking-card', '.watchlist-card']) {
      const card = rules.find(({ selectorText }) => selectorText === selector).style;
      assert.equal(card.getPropertyValue('border'), '0');
      const focus = rules.find(({ selectorText }) => selectorText === `${selector}:focus-visible`).style;
      assert.ok(focus.getPropertyValue('outline'));
    }
    const check = (entries) => {
      for (const rule of entries) {
        if (rule.cssRules) check([...rule.cssRules]);
        if (!rule.selectorText?.match(/ranking-card|watchlist-card/)) continue;
        for (const property of [...Array(rule.style.length).keys()].map((index) => rule.style[index])) {
          if (property.startsWith('border') && property !== 'border-radius') {
            assert.equal(rule.style.getPropertyValue(property), '0', rule.selectorText);
          }
        }
      }
    };
    check(rules);
  });
});

test('el emoji de coleccion cabe en su columna de ranking sin invadir el contador', () => {
  withStyles((rules) => {
    const icon = rules.find(({ selectorText }) => selectorText === '.ranking-collection-count .ranking-collection-icon').style;
    assert.equal(icon.getPropertyValue('font-size'), icon.getPropertyValue('width'));
    const brick = rules.find(({ selectorText }) => selectorText === '.ranking-bricks .gamification-brick-icon').style;
    const brickCounter = rules.find(({ selectorText }) => selectorText === '.ranking-bricks').style;
    assert.equal(brickCounter.getPropertyValue('transform'), 'translateX(19px)');
    assert.equal(brick.getPropertyValue('height'), icon.getPropertyValue('height'));
    assert.ok(parseFloat(brick.getPropertyValue('width')) > parseFloat(brick.getPropertyValue('height')));
    const desktopSpacing = rules.find(({ selectorText }) => selectorText === '.ranking-bricks, .ranking-collection-count').style;
    assert.equal(desktopSpacing.getPropertyValue('gap'), '8px');
    const mobile = rules.filter(({ cssRules }) => cssRules).flatMap(({ cssRules }) => [...cssRules]);
    const mobileIcon = mobile.filter(({ selectorText }) => selectorText === '.ranking-collection-count .ranking-collection-icon').at(-1).style;
    assert.equal(mobileIcon.getPropertyValue('font-size'), '1.2rem');
    const spacing = mobile.find(({ selectorText }) => selectorText === '.ranking-summary .ranking-bricks, .ranking-summary .ranking-collection-count').style;
    assert.equal(spacing.getPropertyValue('column-gap'), '8px');
    const mobileBrick = mobile.filter(({ selectorText }) => selectorText === '.ranking-bricks .gamification-brick-icon').at(-1).style;
    assert.equal(mobileBrick.getPropertyValue('height'), '1.1rem');
    assert.ok(parseFloat(mobileBrick.getPropertyValue('width')) > parseFloat(mobileBrick.getPropertyValue('height')));
    const mobileSummary = mobile.filter(({ selectorText }) => selectorText === '.ranking-summary .ranking-bricks').at(-1).style;
    assert.equal(mobileSummary.getPropertyValue('grid-template-columns'), '5ch 1.6rem');
  });
});

test('el icono Bricks conserva una altura visual comparable a emojis e iconos cercanos', () => {
  withStyles((rules) => {
    const declarations = new Map(rules.filter(({ selectorText }) => selectorText).map(({ selectorText, style }) => [selectorText, style]));
    assert.equal(declarations.get('.toast-icon[src$="/brick.png"]').getPropertyValue('height'), '20px');
    assert.equal(declarations.get('.daily-summary-icon[src$="/brick.png"]').getPropertyValue('height'), '22px');
    assert.equal(declarations.get('.daily-summary-metric.has-icon:has(.daily-summary-icon[src$="/brick.png"])')
      .getPropertyValue('grid-template-columns'), '36px minmax(0, 1fr)');
    assert.equal(declarations.get('.public-profile-stat-icon[src$="/brick.png"]').getPropertyValue('height'), '24px');
    assert.equal(declarations.get('.first-minifigura-icon').getPropertyValue('width'), '84px');
  });
});

test('el acordeon de nivel centra sus botones y mantiene los rankings en una linea', () => {
  withStyles((rules) => {
    const buttons = rules.find(({ selectorText }) => selectorText === '.gamification-details .button').style;
    assert.equal(buttons.getPropertyValue('display'), 'inline-flex');
    assert.equal(buttons.getPropertyValue('align-items'), 'center');
    assert.equal(buttons.getPropertyValue('justify-content'), 'center');
    assert.equal(buttons.getPropertyValue('text-align'), 'center');
    const ranking = rules.find(({ selectorText }) => selectorText === '.summary-ranking-row .summary-ranking-link').style;
    assert.equal(ranking.getPropertyValue('white-space'), 'nowrap');
    assert.equal(ranking.getPropertyValue('min-width'), '0');
    const row = rules.find(({ selectorText }) => selectorText === '.summary-ranking-row').style;
    assert.equal(row.getPropertyValue('flex-wrap'), 'nowrap');
    const compact = rules.find(({ selectorText }) => selectorText === '.gamification-details .summary-ranking-row .summary-ranking-link').style;
    assert.equal(compact.getPropertyValue('white-space'), 'nowrap');
    assert.equal(compact.getPropertyValue('font-size'), '0.7rem');
  });
});

test('las tarjetas de seguimiento mantienen icono codigo y precio en una linea', () => {
  withStyles((rules) => {
    const row = rules.find(({ selectorText }) => selectorText === '.watchlist-row').style;
    assert.equal(row.getPropertyValue('align-items'), 'stretch');
    const caption = rules.find(({ selectorText }) => selectorText === '.watchlist-card .watchlist-caption').style;
    assert.equal(caption.getPropertyValue('display'), 'flex');
    assert.equal(caption.getPropertyValue('flex-wrap'), 'nowrap');
    assert.equal(caption.getPropertyValue('white-space'), 'nowrap');
    const mobile = rules.filter(({ cssRules }) => cssRules).flatMap(({ cssRules }) => [...cssRules]);
    const card = mobile.find(({ selectorText }) => selectorText === '.watchlist-card').style;
    assert.equal(card.getPropertyValue('height'), 'auto');
    assert.equal(card.getPropertyValue('grid-template-rows'), '48px auto');
    assert.equal(card.getPropertyValue('min-width'), 'max-content');
    const scroller = mobile.find(({ selectorText }) => selectorText === '.watchlist-row:not([hidden])').style;
    assert.equal(scroller.getPropertyValue('overflow-x'), 'auto');
  });
});

test('los emojis de seguimiento tienen el mismo tamano que los filtros de consulta', () => {
  withStyles((rules) => {
    const mobile = rules.filter(({ cssRules }) => cssRules);
    const desktopFilter = rules.find(({ selectorText }) => selectorText === '.filter-toggle .filter-symbol, .filter-toggle .eye-symbol').style;
    const desktopWatchlist = rules.find(({ selectorText }) => selectorText === '.watchlist-state-icon .status-icon-image').style;
    const mobileFilter = mobile.flatMap(({ cssRules }) => [...cssRules]).find(({ selectorText }) => selectorText === '#filters-form .filter-toggle .filter-symbol, #filters-form .filter-toggle .eye-symbol').style;
    const mobileWatchlist = mobile.flatMap(({ cssRules }) => [...cssRules]).find(({ selectorText }) => selectorText === '.watchlist-state-icon .status-icon-image').style;
    for (const property of ['width', 'height', 'font-size']) {
      assert.equal(desktopWatchlist.getPropertyValue(property), desktopFilter.getPropertyValue(property));
      assert.equal(mobileWatchlist.getPropertyValue(property), mobileFilter.getPropertyValue(property));
    }
  });
});

test('el modal de minifigura comparte borde entre campos automaticos y editables', () => {
  withStyles((rules, document) => {
    for (const rule of rules.filter(({ selectorText }) => selectorText?.startsWith('#form-dialog') && selectorText.includes(':disabled') && selectorText.includes('input'))) {
      assert.equal(rule.style.getPropertyValue('border-color'), 'var(--line)');
    }
    document.querySelector('style').textContent = css.replaceAll('var(--line)', '#333333');
    const expected = document.defaultView.getComputedStyle(document.getElementById('form-id')).border;
    for (const id of ['form-nombre', 'form-descripcion', 'form-categoria', 'form-subcategoria', 'form-anio', 'form-precio', 'form-fechaCompra', 'form-precioCompra']) {
      const field = document.getElementById(id);
      for (const disabled of [false, true]) {
        field.disabled = disabled;
        assert.equal(document.defaultView.getComputedStyle(field).border, expected, `${id}, disabled=${disabled}`);
      }
    }
  });
});

test('los campos de consulta no muestran ejemplos de relleno', () => {
  const dom = new JSDOM(html);
  try {
    const inputs = dom.window.document.querySelectorAll('#filters-form input[type="text"], #filters-form input:not([type])');
    assert.equal(inputs.length, 2);
    for (const input of inputs) {
      assert.equal(input.hasAttribute('placeholder'), false);
      assert.equal(input.value, '');
    }
  } finally {
    dom.window.close();
  }
});

test('la interfaz no vuelve a usar la imagen retirada del trofeo', async () => {
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(`${html}\n${css}\n${script}`, /75206\.png/);
});

test('la lupa usa emoji en todas las superficies sin cargar la imagen retirada', async () => {
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(`${html}\n${css}\n${script}`, /lupa\.png/);
  withStyles((_rules, document) => {
    for (const selector of [
      '.filter-symbol.magnifier-icon', '.count-icon.magnifier-icon',
      '[data-form-state="BUSCADA"] .magnifier-icon', '.public-profile-stat-icon.magnifier-icon',
    ]) {
      assert.equal(document.querySelector(selector).textContent, '🔍');
    }
    assert.equal(document.querySelector('[data-form-state="BUSCADA"]').getAttribute('aria-pressed'), 'false');
  });

});

test('coleccion usa el emoji caja sin referencias a la imagen anterior', async () => {
  const script = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(`${html}\n${css}\n${script}`, /caja\.png/);
  withStyles((_rules, document) => {
    for (const icon of document.querySelectorAll('.box-icon')) assert.equal(icon.textContent, '📦');
    assert.equal(document.querySelector('[data-form-state="COLECCIÓN"]').getAttribute('aria-pressed'), 'true');
  });
});

function withStyles(callback) {
  const dom = new JSDOM(html);
  try {
    const style = dom.window.document.createElement('style');
    style.textContent = css;
    dom.window.document.head.append(style);
    callback([...style.sheet.cssRules], dom.window.document);
  } finally {
    dom.window.close();
  }
}

test('la geometria recta cubre elementos, pseudo-elementos y controles nativos', () => {
  withStyles((rules) => {
    const invariant = rules.find(({ selectorText }) => selectorText === '*, *::before, *::after, ::backdrop');
    assert.equal(invariant.style.getPropertyValue('border-radius'), '0');
    assert.equal(invariant.style.getPropertyPriority('border-radius'), 'important');
    for (const selector of [
      'progress::-webkit-progress-bar', 'progress::-webkit-progress-value',
      'progress::-moz-progress-bar', '::file-selector-button',
    ]) {
      const native = rules.find(({ selectorText }) => selectorText === selector);
      assert.equal(native.style.getPropertyValue('border-radius'), '0');
      assert.equal(native.style.getPropertyPriority('border-radius'), 'important');
    }
    const checkbox = rules.find(({ selectorText }) => selectorText?.includes('input[type="radio"]')
      && !selectorText.includes(':checked'));
    assert.equal(checkbox.style.getPropertyValue('appearance'), 'none');
    assert.equal(checkbox.style.getPropertyValue('border'), '2px solid var(--ink)');
  });
});

test('la paleta y las sombras duras excluyen degradados y desenfoques', () => {
  withStyles((rules) => {
    const tokens = rules.find(({ selectorText }) => selectorText === ':root').style;
    for (const [name, value] of Object.entries({
      '--accent': '#e3000b', '--yellow': '#ffd500', '--blue': '#006cb7',
      '--success': '#009639', '--ink': '#222222', '--line': '#333333',
      '--paper': '#fffdf8', '--surface': '#ffffff',
    })) {
      assert.equal(tokens.getPropertyValue(name), value);
    }
    assert.equal(tokens.getPropertyValue('--shadow'), '3px 3px 0 var(--ink)');
    assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient|(?:backdrop-)?filter:\s*blur/);
    const checkShadows = (entries) => {
      for (const rule of entries) {
        if (rule.cssRules) checkShadows([...rule.cssRules]);
        const shadow = rule.style?.getPropertyValue('box-shadow');
        if (!shadow || ['none', 'var(--shadow)'].includes(shadow)) continue;
        const lengths = shadow.match(/-?\d+(?:px)?/g);
        assert.equal(Number.parseInt(lengths[2], 10), 0, shadow);
      }
    };
    checkShadows(rules);
  });
});

test('toasts con fondo de color mantienen texto blanco y los neutros conservan contraste', () => {
  withStyles((rules) => {
    const colored = rules.find(({ selectorText }) => selectorText === '.toast-task:not(.toast-gift), .toast-level');
    assert.equal(colored.style.getPropertyValue('color'), '#fff');
    const children = rules.find(({ selectorText }) => selectorText === '.toast-task:not(.toast-gift) *, .toast-level *');
    assert.equal(children.style.getPropertyValue('color'), 'inherit');
    const neutral = rules.filter(({ selectorText }) => selectorText === '.toast-notification, .toast-gift').at(-1);
    assert.equal(neutral.style.getPropertyValue('color'), 'var(--ink)');
    assert.equal(neutral.style.getPropertyValue('background'), 'var(--surface)');
  });
});

test('botones, referencias y cabeceras reutilizan el sistema visual', () => {
  withStyles((rules, document) => {
    const buttons = rules.filter(({ selectorText }) => selectorText === '.button').at(-1).style;
    assert.equal(buttons.getPropertyValue('border'), '2px solid var(--ink)');
    assert.equal(buttons.getPropertyValue('box-shadow'), '0 3px 0 var(--ink)');
    const codes = rules.find(({ selectorText }) => selectorText?.startsWith('.id-link, .watchlist-card > span')).style;
    assert.equal(codes.getPropertyValue('font-family'), 'var(--font-code)');
    const headings = rules.find(({ selectorText }) => selectorText?.startsWith('h1, h2, h3')).style;
    assert.equal(headings.getPropertyValue('font-weight'), '900');
    assert.equal(rules.some(({ selectorText }) => selectorText === '.auth-card::before'), false);
    assert.equal(document.querySelector('#classic-auth-submit').classList.contains('button-primary'), true);
    const hidden = rules.find(({ selectorText }) => selectorText === '.rankings[hidden], .watchlist-row[hidden]');
    assert.equal(hidden.style.getPropertyValue('display'), 'none');
  });
});

test('toda la tipografia usa tokens compartidos sin fuentes legacy por componente', () => {
  withStyles((rules) => {
    const tokens = rules.find(({ selectorText }) => selectorText === ':root').style;
    assert.equal(tokens.getPropertyValue('--font-body'), 'Montserrat, Arial, sans-serif');
    assert.equal(tokens.getPropertyValue('--font-display'), 'var(--font-body)');
    assert.equal(tokens.getPropertyValue('font-family'), 'var(--font-body)');
    const checkFonts = (entries) => {
      for (const rule of entries) {
        if (rule.cssRules) checkFonts([...rule.cssRules]);
        if (!rule.selectorText || rule.selectorText === ':root') continue;
        const family = rule.style.getPropertyValue('font-family');
        const shorthand = rule.style.getPropertyValue('font');
        if (family) assert.match(family, /^(?:inherit|var\(--font-(?:body|display|code)\))$/, rule.selectorText);
        if (shorthand) assert.match(shorthand, /^(?:inherit|.*var\(--font-(?:body|display|code)\))$/, rule.selectorText);
      }
    };
    checkFonts(rules);
    const controls = rules.find(({ selectorText }) => selectorText === 'button, input, select, textarea, optgroup, option');
    assert.equal(controls.style.getPropertyValue('font-family'), 'inherit');
    const fileButton = rules.find(({ selectorText, style }) =>
      selectorText === '::file-selector-button' && style.getPropertyValue('font-family'));
    assert.equal(fileButton.style.getPropertyValue('font-family'), 'inherit');
    assert.doesNotMatch(css, /Arial Rounded|Trebuchet MS|Arial Black/);
    const codes = rules.find(({ selectorText }) => selectorText?.startsWith('.id-link, .watchlist-card > span'));
    assert.equal(codes.selectorText.includes('.ranking-caption'), false);
  });
});

test('el ojo del filtro de consulta se centra sin depender de la linea tipografica', () => {
  withStyles((rules, document) => {
    const eye = rules.find(({ selectorText }) => selectorText === '.filter-toggle .eye-symbol').style;
    assert.equal(eye.getPropertyValue('display'), 'grid');
    assert.equal(eye.getPropertyValue('place-items'), 'center');
    assert.equal(eye.getPropertyValue('line-height'), '1');
    const toggle = rules.find(({ selectorText }) => selectorText === '.filter-toggle').style;
    assert.equal(toggle.getPropertyValue('align-items'), 'center');
    assert.equal(toggle.getPropertyValue('justify-content'), 'center');
    const icon = document.querySelector('.eye-symbol svg');
    assert.ok(icon, 'El ojo debe ser vectorial para evitar los margenes asimetricos del emoji');
    assert.equal(icon.getAttribute('viewBox'), '0 0 24 24');
    assert.equal(icon.querySelector('use').getAttribute('href'), '#observation-eye-icon');
    assert.equal(document.querySelector('#observation-eye-icon circle').getAttribute('cx'), '12');
    assert.equal(document.querySelector('#form-observada use').getAttribute('href'), '#observation-eye-icon');
    assert.doesNotMatch(html, /👁/u);
  });
});

test('los iconos de notificaciones y amigos caben en la celda centrada del boton', () => {
  withStyles((rules) => {
    const image = rules.find(({ selectorText }) => selectorText === '.notifications-trigger img').style;
    assert.equal(image.getPropertyValue('width'), '100%');
    assert.equal(image.getPropertyValue('max-width'), '36px');
    const button = rules.filter(({ selectorText }) => selectorText === '.notifications-trigger').at(-1).style;
    assert.equal(button.getPropertyValue('grid-template-columns'), 'minmax(0, 1fr)');
  });
});

test('los filtros de consulta no tienen recuadro y distinguen la seleccion por opacidad', () => {
  withStyles((rules, document) => {
    for (const selector of ['.filter-toggle', '.filter-toggle:has(input:checked)']) {
      const entries = rules.filter(({ selectorText }) => selectorText === selector);
      assert.ok(entries.length > 0);
      for (const { style } of entries) {
        assert.equal(style.getPropertyValue('border'), '0');
        assert.equal(style.getPropertyValue('background'), 'transparent');
        assert.equal(style.getPropertyValue('border-color'), '');
      }
    }
    const inactive = rules.find(({ selectorText }) => selectorText === '.filter-toggle .filter-symbol, .filter-toggle .eye-symbol').style;
    const active = rules.find(({ selectorText }) => selectorText === '.filter-toggle input:checked + .filter-symbol, .filter-toggle input:checked + .eye-symbol').style;
    assert.equal(inactive.getPropertyValue('opacity'), '0.4');
    assert.equal(active.getPropertyValue('opacity'), '1');
    assert.ok(rules.some(({ selectorText }) => selectorText?.includes('.filter-toggle input:focus-visible + .filter-symbol')));
    for (const id of ['filter-coleccion', 'filter-buscada']) {
      const input = document.getElementById(id);
      assert.equal(input.type, 'checkbox');
      assert.ok(input.getAttribute('aria-label'));
    }
  });
});

test('el seguimiento distingue visualmente el estado pulsado de aria-pressed', () => {
  withStyles((rules) => {
    const active = rules.find(({ selectorText }) => selectorText === '.eye-icon[aria-pressed="true"]').style;
    const inactive = rules.find(({ selectorText }) => selectorText === '.eye-icon[aria-pressed="false"]').style;
    assert.equal(active.getPropertyValue('color'), '#000000');
    assert.equal(active.getPropertyValue('background'), 'transparent');
    assert.equal(active.getPropertyValue('box-shadow'), 'none');
    assert.equal(inactive.getPropertyValue('color'), '#777777');
    assert.equal(inactive.getPropertyValue('background'), 'transparent');
    assert.equal(inactive.getPropertyValue('box-shadow'), 'none');
    const button = rules.find(({ selectorText }) => selectorText === '.eye-icon').style;
    assert.equal(button.getPropertyValue('border'), '0');
    const filter = rules.find(({ selectorText }) => selectorText === '.filter-toggle:has(.eye-symbol)').style;
    assert.equal(filter.getPropertyValue('border'), '0');
    assert.equal(filter.getPropertyValue('background'), 'transparent');
    const activeFilter = rules.find(({ selectorText }) => selectorText === '.filter-toggle:has(input:checked):has(.eye-symbol)').style;
    assert.equal(activeFilter.getPropertyValue('border'), '0');
    assert.equal(activeFilter.getPropertyValue('background'), 'transparent');
    const checked = rules.find(({ selectorText }) => selectorText === '.filter-toggle:has(input:checked) .eye-symbol').style;
    assert.equal(checked.getPropertyValue('color'), '#000000');
  });
});

test('la cabecera principal no tiene cuadro, fondo amarillo ni franja decorativa', () => {
  withStyles((rules) => {
    const checkHeader = (entries) => {
      for (const rule of entries) {
        if (rule.cssRules) checkHeader([...rule.cssRules]);
        if (rule.selectorText?.split(', ').includes('.page-header')) {
          assert.equal(rule.style.getPropertyValue('border'), '');
          assert.equal(rule.style.getPropertyValue('background'), '');
          assert.equal(rule.style.getPropertyValue('background-color'), '');
        }
        assert.equal(rule.selectorText?.includes('.page-header::before') ?? false, false);
      }
    };
    checkHeader(rules);
  });
});

test('los filtros de Smartphone mantienen dos columnas y campos de 44px', () => {
  withStyles((rules) => {
    const mobile = rules.find(({ conditionText }) => conditionText === '(max-width: 600px)');
    const fields = [...mobile.cssRules].find(({ selectorText }) => selectorText?.includes('#filters-form input'));
    assert.equal(fields.style.getPropertyValue('min-height'), '44px');
    assert.equal(fields.style.getPropertyValue('font-size'), '1rem');
    assert.equal([...mobile.cssRules].some(({ selectorText }) => selectorText === '#filters-form'), false);
    const reducedMotion = rules.filter(({ conditionText }) => conditionText === '(prefers-reduced-motion: reduce)').at(-1);
    assert.equal(reducedMotion.cssRules[0].style.getPropertyValue('transform'), 'none');
  });
});

test('en pantallas estrechas el logo no compite con los cuatro controles de navegacion', () => {
  withStyles((rules) => {
    const narrow = rules.filter(({ conditionText }) => conditionText === '(max-width: 360px)').at(-1);
    const declarations = new Map([...narrow.cssRules].map(({ selectorText, style }) => [selectorText, style]));
    assert.equal(declarations.get('.page-header .header-top').getPropertyValue('flex-direction'), 'column');
    assert.equal(declarations.get('.page-header .header-top > .brand-heading').getPropertyValue('width'), '160px');
    assert.equal(declarations.get('.header-top > .notifications-entry-row').getPropertyValue('grid-template-columns'), '44px 44px 64px');
  });
});

test('Montserrat variable y su licencia OFL se sirven localmente', async () => {
  const font = await readFile(new URL('../public/fonts/Montserrat-Variable.ttf', import.meta.url));
  assert.equal(font.readUInt32BE(0), 0x00010000);
  const license = await readFile(new URL('../public/fonts/Montserrat-OFL.txt', import.meta.url), 'utf8');
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(css, /font-weight: 100 900/);
  assert.match(css, /font-display: swap/);
  assert.doesNotMatch(`${html}\n${css}`, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  const server = await startTestServer();
  try {
    for (const [path, contentType] of [
      ['/fonts/Montserrat-Variable.ttf', /font\/ttf/],
      ['/fonts/Montserrat-OFL.txt', /text\/plain/],
    ]) {
      const response = await fetch(`${server.baseUrl}${path}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), contentType);
      assert.ok((await response.arrayBuffer()).byteLength > 0);
    }
  } finally {
    await server.close();
  }
});

test('el modal de logros comparte columnas para alinear multiplicadores con o sin estrella', () => {
  withStyles((rules) => {
    const list = rules.find(({ selectorText }) => selectorText === '#gamification-dialog .achievements-list').style;
    assert.equal(list.getPropertyValue('grid-template-columns'), 'calc(2rem + 18px) minmax(0, 1fr) max-content max-content 36px');
    assert.equal(list.getPropertyValue('column-gap'), '18px');
    const row = rules.find(({ selectorText }) => selectorText === '#gamification-dialog .achievement-item').style;
    assert.equal(row.getPropertyValue('grid-column'), '1 / -1');
    assert.equal(row.getPropertyValue('grid-template-columns'), 'subgrid');
    const count = rules.find(({ selectorText }) => selectorText === '#gamification-dialog .achievement-count').style;
    assert.equal(count.getPropertyValue('grid-column'), '3');
    assert.equal(count.getPropertyValue('font-variant-numeric'), 'tabular-nums');
    const bricks = rules.find(({ selectorText }) => selectorText === '#gamification-dialog .achievement-bricks').style;
    assert.equal(bricks.getPropertyValue('display'), 'grid');
    assert.equal(bricks.getPropertyValue('grid-template-columns'), 'minmax(0, 1fr) 2.25rem');
    assert.equal(bricks.getPropertyValue('justify-self'), 'stretch');
    const amount = rules.find(({ selectorText }) => selectorText === '#gamification-dialog .achievement-bricks strong').style;
    assert.equal(amount.getPropertyValue('text-align'), 'right');
    const mobile = rules.filter(({ conditionText }) => conditionText === '(max-width: 600px), (max-width: 900px) and (max-height: 500px) and (pointer: coarse)').at(-1);
    const mobileCount = [...mobile.cssRules].find(({ selectorText }) => selectorText === '#gamification-dialog .achievement-count').style;
    assert.equal(mobileCount.getPropertyValue('grid-column'), '1 / span 2');
    assert.equal(mobileCount.getPropertyValue('grid-row'), '2');
    assert.equal(mobileCount.getPropertyValue('justify-self'), 'start');
    const mobileList = [...mobile.cssRules].find(({ selectorText }) => selectorText === '#gamification-dialog .achievements-list').style;
    assert.equal(mobileList.getPropertyValue('column-gap'), '12px');
    const mobileBricks = [...mobile.cssRules].find(({ selectorText }) => selectorText === '#gamification-dialog .achievement-bricks').style;
    assert.equal(mobileBricks.getPropertyValue('justify-self'), 'stretch');
  });
});
