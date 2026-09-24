import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { BricksetCategoriasScraper } from '../src/brickset-categorias-scraper.js';
import { CategoriasRepository } from '../src/categorias-repository.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultFilePath = resolve(projectRoot, 'data', 'categorias-brickset.json');

export async function syncCategorias({ filePath = defaultFilePath, fetchImpl, scraper, repository } = {}) {
  const categoriasScraper = scraper ?? new BricksetCategoriasScraper({ fetchImpl });
  const categorias = await categoriasScraper.fetchCategorias();
  await (repository ?? new CategoriasRepository(filePath)).replace(categorias);
  return categorias;
}

function getFilePath(args) {
  const fileIndex = args.indexOf('--file');
  return fileIndex >= 0 && args[fileIndex + 1] ? args[fileIndex + 1] : process.env.CATEGORIAS_BRICKSET_PATH ?? defaultFilePath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncCategorias({ filePath: getFilePath(process.argv.slice(2)) })
    .then((categorias) => console.log(`Categorias sincronizadas: ${categorias.length}`))
    .catch((error) => {
      console.error(`[sync-brickset-categorias] ${error.code ?? 'ERROR'}: ${error.message}`);
      process.exitCode = 1;
    });
}
