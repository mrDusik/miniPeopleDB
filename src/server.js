import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  CatalogoInvalidoError,
  CatalogoNoDisponibleError,
  IdDuplicadoError,
  LimiteObservadasError,
  MinifiguraInvalidaError,
  MinifiguraNoEncontradaError,
  MinifigurasRepository,
} from './minifiguras-repository.js';
import { GamificacionDnaNoDisponibleError, GamificacionInvalidaError, GamificacionNoDisponibleError, GamificacionRepository } from './gamificacion-repository.js';
import { BricksetPriceError, BricksetScraper } from './brickset-scraper.js';
import { createBricksetSyncJobs } from './brickset-sync-jobs.js';
import { CategoriasInvalidosError, CategoriasNoDisponiblesError, CategoriasRepository } from './categorias-repository.js';
import { getSupabaseConfig } from './services/supabase.js';
import {
  AutorregaloNoPermitidoError,
  LogrosNoDisponiblesError,
  RankingNoDisponibleError,
  RankingRepository,
  ReceptorNoEncontradoError,
  RegaloYaEnviadoError,
  UsuarioNoEncontradoError,
} from './ranking-repository.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultCategoriasPath = resolve(projectRoot, 'data', 'categorias-brickset.json');
const publicDirectory = resolve(projectRoot, 'public');
const supabaseBrowserBundle = resolve(projectRoot, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const protectedPath = /^\/(?:minifiguras(?:\/.*)?|gamificacion(?:\/dna)?|valoracion|valor-total|sincronizacion\/brickset|api\/ranking(?:\/regalar|\/[^/]+\/logros)?)$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function createServer({
  themesPath = defaultCategoriasPath,
  supabaseConfig = getSupabaseConfig(),
  createSupabaseClient = createClient,
  fetchImpl,
  scraper,
  minIntervalMs,
} = {}) {
  const categoriasRepository = new CategoriasRepository(themesPath);
  const configuredInterval = Number(process.env.BRICKSET_MIN_INTERVAL_MS);
  const effectiveInterval = Number.isFinite(minIntervalMs) ? minIntervalMs : configuredInterval;
  const brickset = scraper ?? new BricksetScraper({
    fetchImpl,
    ...(Number.isFinite(effectiveInterval) ? { minIntervalMs: effectiveInterval } : {}),
  });
  const bricksetSyncJobs = createBricksetSyncJobs({ brickset });
  const app = express();

  async function authenticate(request) {
    if (!supabaseConfig) {
      return { status: 500, error: 'CONFIGURACION_NO_DISPONIBLE' };
    }
    const unauthorized = { status: 401, error: 'NO_AUTENTICADO' };
    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '')?.[1];
    if (!token) {
      return unauthorized;
    }

    const client = createSupabaseClient(supabaseConfig.url, supabaseConfig.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let user;
    try {
      const { data, error } = await client.auth.getUser(token);
      user = error ? undefined : data?.user;
    } catch {
      user = undefined;
    }
    const userId = user?.id;
    if (!userId) {
      return unauthorized;
    }

    const rankingRepository = new RankingRepository({ client, userId });
    try {
      await rankingRepository.syncProfile(user);
    } catch {
      return { status: 500, error: 'RANKING_NO_DISPONIBLE' };
    }
    const gamificacionRepository = new GamificacionRepository({ client, userId, categoriasRepository });
    const repository = new MinifigurasRepository({
      client,
      userId,
      categoriasRepository,
      onCatalogPersisted: async (catalogo) => gamificacionRepository.recalculate(catalogo),
    });
    return {
      userId,
      repository,
      rankingRepository,
      ensureGamificacion: () => gamificacionRepository.ensure(() => repository.readCatalog()),
      readGamificationDna: () => gamificacionRepository.dna(),
    };
  }

  app.get('/vendor/supabase.js', (request, response) => {
    response.sendFile(supabaseBrowserBundle);
  });
  // Endpoint de salud para UptimeRobot / Render Keep-Alive
  app.get('/health', (request, response) => {
    response.status(200).send('OK');
  });
  app.use(express.static(publicDirectory));
  app.use(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://localhost');

    if (requestUrl.pathname === '/config/supabase') {
      if (request.method !== 'GET') {
        response.setHeader('allow', 'GET');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }
      if (!supabaseConfig) {
        sendJson(response, 500, { error: 'CONFIGURACION_NO_DISPONIBLE' });
        return;
      }
      sendJson(response, 200, { url: supabaseConfig.url, anonKey: supabaseConfig.anonKey });
      return;
    }

    let repository;
    let userId;
    let ensureGamificacion;
    let rankingRepository;
    let readGamificationDna;
    if (protectedPath.test(requestUrl.pathname)) {
      const context = await authenticate(request);
      if (context.error) {
        sendJson(response, context.status, { error: context.error });
        return;
      }
      ({ repository, userId, ensureGamificacion, rankingRepository, readGamificationDna } = context);
    }

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

    if (requestUrl.pathname === '/api/ranking') {
      if (request.method !== 'GET') {
        response.setHeader('allow', 'GET');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }
      try {
        sendJson(response, 200, await rankingRepository.list());
      } catch (error) {
        sendJson(response, 500, { error: error instanceof RankingNoDisponibleError ? error.code : 'ERROR_INTERNO' });
      }
      return;
    }

    const achievementsRoute = /^\/api\/ranking\/([^/]+)\/logros$/.exec(requestUrl.pathname);
    if (achievementsRoute) {
      if (request.method !== 'GET') {
        response.setHeader('allow', 'GET');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }
      const targetId = achievementsRoute[1];
      if (!UUID_PATTERN.test(targetId)) {
        sendJson(response, 400, { error: 'USUARIO_INVALIDO' });
        return;
      }
      try {
        sendJson(response, 200, await rankingRepository.achievements(targetId.toLowerCase()));
      } catch (error) {
        const status = error instanceof UsuarioNoEncontradoError ? 404 : 500;
        sendJson(response, status, { error: error instanceof UsuarioNoEncontradoError || error instanceof LogrosNoDisponiblesError ? error.code : 'ERROR_INTERNO' });
      }
      return;
    }

    if (requestUrl.pathname === '/api/ranking/regalar') {
      if (request.method !== 'POST') {
        response.setHeader('allow', 'POST');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }
      let payload;
      try {
        payload = await readJsonBody(request);
      } catch {
        sendJson(response, 400, { error: 'PARAMETRO_INVALIDO', parametro: 'receptorId' });
        return;
      }
      if (Object.keys(payload).length !== 1 || typeof payload.receptorId !== 'string' || !UUID_PATTERN.test(payload.receptorId)) {
        sendJson(response, 400, { error: 'PARAMETRO_INVALIDO', parametro: 'receptorId' });
        return;
      }
      try {
        sendJson(response, 200, await rankingRepository.gift(payload.receptorId));
      } catch (error) {
        if (error instanceof AutorregaloNoPermitidoError) {
          sendJson(response, 400, { error: error.code });
          return;
        }
        if (error instanceof ReceptorNoEncontradoError) {
          sendJson(response, 404, { error: error.code });
          return;
        }
        if (error instanceof RegaloYaEnviadoError) {
          sendJson(response, 409, { error: error.code });
          return;
        }
        sendJson(response, 500, { error: error instanceof RankingNoDisponibleError ? error.code : 'ERROR_INTERNO' });
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

          const nombre = requestUrl.searchParams.get('nombre');
          if (nombre !== null && nombre.trim() !== '') {
            filters.nombre = nombre.trim();
          }

          const observada = requestUrl.searchParams.get('observada');
          if (observada !== null && observada.trim() !== '') {
            if (observada !== 'true' && observada !== 'false') {
              sendJson(response, 400, { error: 'PARAMETRO_INVALIDO', parametro: 'observada' });
              return;
            }
            filters.observada = observada === 'true';
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

    if (requestUrl.pathname === '/gamificacion/dna') {
      if (request.method !== 'GET') {
        response.setHeader('allow', 'GET');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }
      try {
        sendJson(response, 200, await readGamificationDna());
      } catch (error) {
        sendJson(response, 500, { error: error instanceof GamificacionDnaNoDisponibleError ? error.code : 'DNA_NO_DISPONIBLE' });
      }
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

        const resultado = {
          id: id.trim().toUpperCase(),
          categoria: categoriaEncontrada.categoria,
          anio: Number.isInteger(detalles.anio) && detalles.anio > 0 ? detalles.anio : new Date().getFullYear(),
          precio: detalles.precio,
        };
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
      if (request.method === 'GET') {
        bricksetSyncJobs.refreshRepository(userId, repository);
        sendJson(response, 200, bricksetSyncJobs.status(userId));
        return;
      }
      if (request.method === 'PATCH') {
        let payload;
        try {
          payload = await readJsonBody(request);
        } catch {
          sendJson(response, 400, { error: 'MINIFIGURA_INVALIDA' });
          return;
        }
        if (payload.accion === 'pausar') {
          bricksetSyncJobs.pause(userId);
        } else if (payload.accion === 'reanudar') {
          bricksetSyncJobs.resume(userId);
        } else {
          sendJson(response, 400, { error: 'ACCION_INVALIDA' });
          return;
        }
        sendJson(response, 200, bricksetSyncJobs.status(userId));
        return;
      }
      if (request.method !== 'POST') {
        response.setHeader('allow', 'GET, POST, PATCH');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }

      try {
        await ensureGamificacion();
        sendJson(response, 202, await bricksetSyncJobs.start(userId, repository));
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

    const observedMatch = requestUrl.pathname.match(/^\/minifiguras\/(.+)\/observada$/);
    if (observedMatch) {
      if (request.method !== 'PUT') {
        response.setHeader('allow', 'PUT');
        sendJson(response, 405, { error: 'METODO_NO_PERMITIDO' });
        return;
      }

      let id;
      try {
        id = decodeURIComponent(observedMatch[1]);
      } catch {
        sendJson(response, 400, { error: 'ID_INVALIDO' });
        return;
      }

      try {
        const payload = await readJsonBody(request);
        if (typeof payload.observada !== 'boolean') {
          sendJson(response, 400, { error: 'MINIFIGURA_INVALIDA', parametro: 'observada' });
          return;
        }
        sendJson(response, 200, await repository.setObserved(id, payload.observada));
      } catch (error) {
        if (error instanceof LimiteObservadasError) {
          sendJson(response, 409, { error: error.code });
          return;
        }
        if (error instanceof MinifiguraNoEncontradaError) {
          sendJson(response, 404, { error: error.code });
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