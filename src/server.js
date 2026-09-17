import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  CatalogoInvalidoError,
  CatalogoNoDisponibleError,
  MinifigurasRepository,
} from './minifiguras-repository.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultCatalogPath = resolve(projectRoot, 'data', 'minifiguras.json');

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

export function createServer({ catalogPath = defaultCatalogPath } = {}) {
  const repository = new MinifigurasRepository(catalogPath);

  return createHttpServer(async (request, response) => {
    if (request.method !== 'GET' || request.url !== '/minifiguras') {
      sendJson(response, 404, { error: 'RUTA_NO_ENCONTRADA' });
      return;
    }

    try {
      const minifiguras = await repository.list();
      sendJson(response, 200, minifiguras);
    } catch (error) {
      if (error instanceof CatalogoNoDisponibleError) {
        sendJson(response, 500, { error: error.code });
        return;
      }
      if (error instanceof CatalogoInvalidoError) {
        sendJson(response, 500, { error: error.code });
        return;
      }
      sendJson(response, 500, { error: 'ERROR_INTERNO' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
  });
}