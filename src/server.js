import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  CatalogoInvalidoError,
  CatalogoNoDisponibleError,
  IdDuplicadoError,
  MinifiguraInvalidaError,
  MinifiguraNoEncontradaError,
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

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode, {
    'content-length': '0',
  });
  response.end();
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.trim() === '') {
    throw new MinifiguraInvalidaError();
  }

  try {
    const body = JSON.parse(raw);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw new MinifiguraInvalidaError();
    }
    return body;
  } catch {
    throw new MinifiguraInvalidaError();
  }
}

export function createServer({ catalogPath = defaultCatalogPath } = {}) {
  const repository = new MinifigurasRepository(catalogPath);

  return createHttpServer(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://localhost');

    if (requestUrl.pathname === '/minifiguras') {
      if (request.method === 'GET') {
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
        return;
      }

      if (request.method === 'POST') {
        try {
          const payload = await readJsonBody(request);
          const minifigura = await repository.create(payload);
          sendJson(response, 201, minifigura);
        } catch (error) {
          if (error instanceof MinifiguraInvalidaError) {
            sendJson(response, 400, { error: error.code });
            return;
          }
          if (error instanceof IdDuplicadoError) {
            sendJson(response, 409, { error: error.code });
            return;
          }
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
        return;
      }

      response.setHeader('allow', 'GET, POST');
      sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
      return;
    }

    const match = requestUrl.pathname.match(/^\/minifiguras\/(.+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);

      if (request.method === 'PUT') {
        try {
          const payload = await readJsonBody(request);
          const minifigura = await repository.replace(id, payload);
          sendJson(response, 200, minifigura);
        } catch (error) {
          if (error instanceof MinifiguraInvalidaError) {
            sendJson(response, 400, { error: error.code });
            return;
          }
          if (error instanceof MinifiguraNoEncontradaError) {
            sendJson(response, 404, { error: error.code });
            return;
          }
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
        return;
      }

      if (request.method === 'DELETE') {
        try {
          await repository.delete(id);
          sendEmpty(response, 204);
        } catch (error) {
          if (error instanceof MinifiguraNoEncontradaError) {
            sendJson(response, 404, { error: error.code });
            return;
          }
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
        return;
      }

      response.setHeader('allow', 'PUT, DELETE');
      sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
      return;
    }

    sendJson(response, 404, { error: 'RUTA_NO_ENCONTRADA' });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
  });
}