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
    const requestUrl = new URL(request.url, 'http://localhost');

    if (requestUrl.pathname !== '/minifiguras') {
      sendJson(response, 404, { error: 'RUTA_NO_ENCONTRADA' });
      return;
    }

    if (request.method !== 'GET') {
      response.setHeader('allow', 'GET');
      sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
      return;
    }

    try {
      const filters = {};
      const tema = requestUrl.searchParams.get('tema');
      if (tema !== null && tema.trim() !== '') {
        filters.tema = tema.trim();
      }

      const anio = requestUrl.searchParams.get('anio');
      if (anio !== null && anio.trim() !== '') {
        const parsedAnio = Number(anio);
        if (!Number.isInteger(parsedAnio)) {
          sendJson(response, 400, { error: 'PARAMETRO_INVALIDO', parametro: 'anio' });
          return;
        }
        filters.anio = parsedAnio;
      }

      const estadoColeccion = requestUrl.searchParams.get('estadoColeccion');
      if (estadoColeccion !== null && estadoColeccion.trim() !== '') {
        filters.estadoColeccion = estadoColeccion.trim();
      }

      const minifiguras = await repository.list(filters);
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