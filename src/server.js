import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import {
  CatalogoInvalidoError,
  CatalogoNoDisponibleError,
  IdDuplicadoError,
  MinifiguraInvalidaError,
  MinifiguraNoEncontradaError,
  MinifigurasRepository,
} from './minifiguras-repository.js';
import { GamificacionInvalidaError, GamificacionNoDisponibleError, GamificacionRepository } from './gamificacion-repository.js';
import { BricksetPriceError, BricksetScraper } from './brickset-scraper.js';
import { CategoriasInvalidosError, CategoriasNoDisponiblesError, CategoriasRepository } from './categorias-repository.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultCatalogPath = resolve(projectRoot, 'data', 'minifiguras.json');
const defaultCategoriasPath = resolve(projectRoot, 'data', 'categorias-brickset.json');
const defaultGamificacionPath = resolve(projectRoot, 'data', 'gamificacion.json');
const publicDirectory = resolve(projectRoot, 'public');

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

function normalizeEstadoFilter(value) {
  const normalized = value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'coleccion') {
    return 'COLECCIÓN';
  }
  if (normalized === 'buscada') {
    return 'BUSCADA';
  }
  return null;
}

function isCategoriasError(error) {
  return error instanceof CategoriasNoDisponiblesError || error instanceof CategoriasInvalidosError;
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

export function createServer({ catalogPath = defaultCatalogPath, themesPath = defaultCategoriasPath, gamificationPath, fetchImpl, scraper } = {}) {
  const categoriasRepository = new CategoriasRepository(themesPath);
  const resolvedGamificacionPath = gamificationPath ?? (catalogPath === defaultCatalogPath ? defaultGamificacionPath : resolve(dirname(catalogPath), 'gamificacion.json'));
  const gamificacionRepository = new GamificacionRepository(resolvedGamificacionPath, { categoriasRepository });
  const repository = new MinifigurasRepository(catalogPath, {
    categoriasRepository,
    onCatalogPersisted: async (catalogo) => gamificacionRepository.recalculate(catalogo),
  });
  const brickset = scraper ?? new BricksetScraper({ fetchImpl });
  const app = express();
  const ensureGamificacion = () => gamificacionRepository.ensure(() => repository.readCatalog());

  app.use(express.static(publicDirectory));
  app.use(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://localhost');

    if (requestUrl.pathname === '/categorias') {
      if (request.method !== 'GET') {
        response.setHeader('allow', 'GET');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }

      try {
        sendJson(response, 200, await categoriasRepository.read());
      } catch (error) {
        if (error instanceof CategoriasNoDisponiblesError || error instanceof CategoriasInvalidosError) {
          sendJson(response, 500, { error: error.code });
          return;
        }
        sendJson(response, 500, { error: 'ERROR_INTERNO' });
      }
      return;
    }

    if (requestUrl.pathname === '/minifiguras') {
      if (request.method === 'GET') {
        try {
          await ensureGamificacion();
          const filters = {};
          const categoria = requestUrl.searchParams.get('categoria');
          if (categoria !== null && categoria.trim() !== '') {
            filters.categoria = categoria.trim();
          }

          const subcategoria = requestUrl.searchParams.get('subcategoria');
          if (subcategoria !== null && subcategoria.trim() !== '') {
            filters.subcategoria = subcategoria.trim();
          }

          const id = requestUrl.searchParams.get('id');
          if (id !== null && id.trim() !== '') {
            filters.id = id.trim();
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
            const normalizedEstado = normalizeEstadoFilter(estadoColeccion);
            if (normalizedEstado === null) {
              sendJson(response, 400, { error: 'PARAMETRO_INVALIDO', parametro: 'estadoColeccion' });
              return;
            }
            filters.estadoColeccion = normalizedEstado;
          }

          const minifiguras = await repository.list(filters);
          sendJson(response, 200, minifiguras);
        } catch (error) {
          if (isCategoriasError(error)) {
            sendJson(response, 500, { error: error.code });
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
          if (error instanceof MinifiguraInvalidaError) {
            sendJson(response, 400, { error: error.code, parametro: 'categoria' });
            return;
          }
          sendJson(response, 500, { error: 'ERROR_INTERNO' });
        }
        return;
      }

      if (request.method === 'POST') {
        try {
          await ensureGamificacion();
          const payload = await readJsonBody(request);
          const minifigura = await repository.create(payload);
          const body = request.headers['x-gamificacion'] === 'true'
            ? { ...minifigura, gamificacion: repository.lastGamification }
            : minifigura;
          sendJson(response, 201, body);
        } catch (error) {
          if (isCategoriasError(error)) {
            sendJson(response, 500, { error: error.code });
            return;
          }
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

    if (requestUrl.pathname === '/gamificacion') {
      if (request.method !== 'GET') {
        response.setHeader('allow', 'GET');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }

      try {
        sendJson(response, 200, await ensureGamificacion());
      } catch (error) {
        if (error instanceof GamificacionNoDisponibleError || error instanceof GamificacionInvalidaError) {
          sendJson(response, 500, { error: error.code });
          return;
        }
        if (isCategoriasError(error) || error instanceof CatalogoNoDisponibleError || error instanceof CatalogoInvalidoError) {
          sendJson(response, 500, { error: error.code });
          return;
        }
        sendJson(response, 500, { error: 'ERROR_INTERNO' });
      }
      return;
    }

    if (requestUrl.pathname === '/valoracion' || requestUrl.pathname === '/valor-total') {
      if (request.method !== 'GET') {
        response.setHeader('allow', 'GET');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }

      try {
        const summary = await repository.valuationSummary();
        sendJson(response, 200, summary);
      } catch (error) {
        if (isCategoriasError(error)) {
          sendJson(response, 500, { error: error.code });
          return;
        }
        if (error instanceof CatalogoNoDisponibleError || error instanceof CatalogoInvalidoError) {
          sendJson(response, 500, { error: error.code });
          return;
        }
        sendJson(response, 500, { error: 'ERROR_INTERNO' });
      }
      return;
    }

    const detailsMatch = requestUrl.pathname.match(/^\/minifiguras\/(.+)\/brickset$/);
    if (detailsMatch) {
      if (request.method !== 'GET') {
        response.setHeader('allow', 'GET');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }

      let id;
      try {
        id = decodeURIComponent(detailsMatch[1]);
      } catch {
        sendJson(response, 400, { error: 'ID_INVALIDO' });
        return;
      }

      try {
        const detalles = await brickset.getDetails(id);
        const categorias = await categoriasRepository.read();
        const normalize = (value) => value.trim().normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase();
        const categoriaEncontrada = categorias.find((categoria) => normalize(categoria.categoria) === normalize(detalles.categoria));
        if (!categoriaEncontrada) {
          sendJson(response, 502, { error: 'BRICKSET_CATEGORIA_DESCONOCIDA' });
          return;
        }

        const resultado = { id, categoria: categoriaEncontrada.categoria, anio: detalles.anio, precio: detalles.precio };
        if (detalles.subcategoria) {
          const subcategoriaEncontrada = categoriaEncontrada.subcategorias.find(
            (subcategoria) => normalize(subcategoria.subcategoria) === normalize(detalles.subcategoria),
          );
          if (subcategoriaEncontrada) {
            resultado.subcategoria = subcategoriaEncontrada.subcategoria;
          }
        }
        sendJson(response, 200, resultado);
      } catch (error) {
        if (error instanceof BricksetPriceError) {
          sendJson(response, 502, { error: error.code });
          return;
        }
        if (isCategoriasError(error)) {
          sendJson(response, 500, { error: error.code });
          return;
        }
        sendJson(response, 500, { error: 'ERROR_INTERNO' });
      }
      return;
    }

    if (requestUrl.pathname === '/sincronizacion/brickset') {
      if (request.method !== 'POST') {
        response.setHeader('allow', 'POST');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }

      try {
        await ensureGamificacion();
        const catalogo = await repository.readCatalog();
        const actualizaciones = new Map();
        const fallidos = [];
        const concurrency = Math.max(1, Math.min(Number(process.env.BRICKSET_CONCURRENCY) || 4, catalogo.length || 1));
        let nextIndex = 0;
        const worker = async () => {
          while (nextIndex < catalogo.length) {
            const minifigura = catalogo[nextIndex++];
            try {
              actualizaciones.set(minifigura.id, await brickset.getPrice(minifigura.id));
            } catch (error) {
              fallidos.push({ id: minifigura.id, error: error instanceof BricksetPriceError ? error.code : 'BRICKSET_NO_DISPONIBLE' });
            }
          }
        };
        await Promise.all(Array.from({ length: concurrency }, worker));

        if (actualizaciones.size > 0) {
          await repository.updatePrices(actualizaciones);
        }
        sendJson(response, 200, {
          actualizados: [...actualizaciones.keys()],
          fallidos,
          total: catalogo.length,
        });
      } catch (error) {
        if (isCategoriasError(error)) {
          sendJson(response, 500, { error: error.code });
          return;
        }
        if (error instanceof CatalogoNoDisponibleError || error instanceof CatalogoInvalidoError) {
          sendJson(response, 500, { error: error.code });
          return;
        }
        sendJson(response, 500, { error: 'ERROR_INTERNO' });
      }
      return;
    }

    const match = requestUrl.pathname.match(/^\/minifiguras\/(.+)$/);
    if (match) {
      let id;
      try{
        id = decodeURIComponent(match[1]);
      } catch (err) {
        sendJson(response, 400, { error: 'ID_INVALIDO', mensaje: 'El ID proporcionado no tiene un formato URI válido' });
        return;
      }
    
      if (request.method === 'PUT') {
        try {
          await ensureGamificacion();
          const payload = await readJsonBody(request);
          const minifigura = await repository.replace(id, payload);
          const body = request.headers['x-gamificacion'] === 'true'
            ? { ...minifigura, gamificacion: repository.lastGamification }
            : minifigura;
          sendJson(response, 200, body);
        } catch (error) {
          if (isCategoriasError(error)) {
            sendJson(response, 500, { error: error.code });
            return;
          }
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
          await ensureGamificacion();
          await repository.delete(id);
          sendEmpty(response, 204);
        } catch (error) {
          if (isCategoriasError(error)) {
            sendJson(response, 500, { error: error.code });
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

      response.setHeader('allow', 'PUT, DELETE');
      sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
      return;
    }

    sendJson(response, 404, { error: 'RUTA_NO_ENCONTRADA' });
  });

  return createHttpServer(app);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
  });
}