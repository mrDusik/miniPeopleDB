import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createServer } from '../src/server.js';

async function withServer(callback) {
  const directory = await mkdtemp(join(tmpdir(), 'minifiguras-web-'));
  const catalogPath = join(directory, 'minifiguras.json');
  await writeFile(catalogPath, JSON.stringify([
    {
      id: 'mf-web',
      nombre: 'Figura web',
      descripcion: 'Figura para probar la interfaz',
      tematica: 'Espacio',
      anio: 2023,
      estadoColeccion: 'coleccion',
    },
  ]));

  const server = createServer({ catalogPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}

test('sirve la interfaz estatica y conserva la API del catalogo', async () => {
  await withServer(async (baseUrl) => {
    const page = await fetch(`${baseUrl}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /^text\/html/);
    assert.match(await page.text(), /id="filters-form"/);

    const styles = await fetch(`${baseUrl}/styles.css`);
    assert.equal(styles.status, 200);
    assert.match(styles.headers.get('content-type'), /^text\/css/);

    const script = await fetch(`${baseUrl}/app.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /^text\/javascript/);

    const catalog = await fetch(`${baseUrl}/minifiguras`);
    assert.equal(catalog.status, 200);
    assert.deepEqual(await catalog.json(), [{
      id: 'mf-web',
      nombre: 'Figura web',
      descripcion: 'Figura para probar la interfaz',
      tematica: 'Espacio',
      anio: 2023,
      estadoColeccion: 'coleccion',
    }]);
  });
});

test('la pagina referencia controles y estados necesarios para la consulta', async () => {
  await withServer(async (baseUrl) => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    const script = await (await fetch(`${baseUrl}/app.js`)).text();

    for (const expected of ['name="tema"', 'name="anio"', 'name="estadoColeccion"', 'Buscar', 'Mostrar todo', 'id="catalog-body"']) {
      assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(script, /URLSearchParams/);
    assert.match(script, /replaceChildren/);
    assert.match(script, /No se pudo cargar el catalogo/);
  });
});

test('la pagina referencia los modales, las acciones por fila y el contenedor de toasts', async () => {
  await withServer(async (baseUrl) => {
    const html = await (await fetch(`${baseUrl}/`)).text();

    for (const expected of [
      'id="new-minifigura"',
      'id="form-dialog"',
      'id="minifigura-form"',
      'name="id"',
      'name="nombre"',
      'name="descripcion"',
      'name="tematica"',
      'name="anio"',
      'name="estadoColeccion"',
      'id="delete-dialog"',
      'id="delete-confirm"',
      'id="delete-cancel"',
      'id="toast-region"',
    ]) {
      assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});

test('app.js gestiona alta, edicion y eliminacion mediante POST, PUT y DELETE', async () => {
  await withServer(async (baseUrl) => {
    const script = await (await fetch(`${baseUrl}/app.js`)).text();

    assert.match(script, /method:\s*isEdit \? 'PUT' : 'POST'/);
    assert.match(script, /method:\s*'DELETE'/);
    assert.match(script, /\/minifiguras\/\$\{encodeURIComponent\(/);
    assert.match(script, /showToast/);
    assert.match(script, /badgeClassFor/);
    assert.match(script, /openDeleteDialog/);
  });
});

test('El servidor expone correctamente los elementos del formulario y la integracion de la API web', async () => {
  await withServer(async (baseUrl) => {
    const htmlResponse = await fetch(`${baseUrl}/`);
    assert.equal(htmlResponse.status, 200);
    const html = await htmlResponse.text();

    assert.match(html, /id="minifigura-form"/, 'El HTML servido debe incluir el formulario minifigura-form');
    assert.match(html, /id="form-dialog"/, 'El HTML servido debe incluir el modal form-dialog');
    assert.match(html, /id="toast-region"/, 'El HTML servido debe incluir el contenedor de toasts');

    const appJsResponse = await fetch(`${baseUrl}/app.js`);
    assert.equal(appJsResponse.status, 200);
    const script = await appJsResponse.text();

    assert.match(script, /fetch\((['"`])\/minifiguras/, 'El script del cliente debe invocar el endpoint de la API');  });
});