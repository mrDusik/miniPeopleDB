import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { BricksetThemesScraper } from '../src/brickset-themes-scraper.js';
import { TemasRepository } from '../src/temas-repository.js';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultFilePath = resolve(projectRoot, 'data', 'temas-brickset.json');

export async function syncThemes({ filePath = defaultFilePath, fetchImpl, scraper, repository } = {}) {
  const themesScraper = scraper ?? new BricksetThemesScraper({ fetchImpl });
  const themes = await themesScraper.fetchThemes();
  await (repository ?? new TemasRepository(filePath)).replace(themes);
  return themes;
}

function getFilePath(args) {
  const fileIndex = args.indexOf('--file');
  return fileIndex >= 0 && args[fileIndex + 1] ? args[fileIndex + 1] : process.env.TEMAS_BRICKSET_PATH ?? defaultFilePath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncThemes({ filePath: getFilePath(process.argv.slice(2)) })
    .then((themes) => console.log(`Temas sincronizados: ${themes.length}`))
    .catch((error) => {
      console.error(`[sync-brickset-themes] ${error.code ?? 'ERROR'}: ${error.message}`);
      process.exitCode = 1;
    });
}