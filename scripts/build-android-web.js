import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(projectRoot, 'dist', 'android');
const apiBaseUrl = process.env.ANDROID_API_BASE_URL ?? 'https://minipeopledb.onrender.com';

function validateApiBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('ANDROID_API_BASE_URL debe ser una URL HTTPS absoluta.');
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('ANDROID_API_BASE_URL debe ser un origen HTTPS sin credenciales ni ruta.');
  }
  return url.origin;
}

const validatedApiBaseUrl = validateApiBaseUrl(apiBaseUrl);
await rm(outputDirectory, { recursive: true, force: true });
await cp(resolve(projectRoot, 'public'), outputDirectory, { recursive: true });

const vendorDirectory = resolve(outputDirectory, 'vendor');
await mkdir(vendorDirectory, { recursive: true });
await Promise.all([
  cp(resolve(projectRoot, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'), resolve(vendorDirectory, 'supabase.js')),
  cp(resolve(projectRoot, 'node_modules', 'chart.js', 'dist', 'chart.umd.js'), resolve(vendorDirectory, 'chart.js')),
  cp(resolve(projectRoot, 'node_modules', 'lucide-static', 'icons', 'star.svg'), resolve(vendorDirectory, 'star.svg')),
]);

await writeFile(
  resolve(outputDirectory, 'runtime-config.js'),
  `window.MINIPEOPLEDB_API_BASE_URL = ${JSON.stringify(validatedApiBaseUrl)};\n`,
);
await build({
  entryPoints: [resolve(projectRoot, 'scripts', 'android-native-bridge.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  outfile: resolve(outputDirectory, 'native-auth-bridge.js'),
});

const indexPath = resolve(outputDirectory, 'index.html');
const html = await readFile(indexPath, 'utf8');
const appScriptPattern = /(<script src="\/app\.js[^"]*" defer><\/script>)/;
if (!appScriptPattern.test(html)) {
  throw new Error('No se encontró el script principal de la aplicación en public/index.html.');
}
await writeFile(indexPath, html.replace(
  appScriptPattern,
  '<script src="/native-auth-bridge.js" defer></script>\n  $1',
));

console.log(`Recursos Android preparados en ${outputDirectory} para ${validatedApiBaseUrl}.`);
