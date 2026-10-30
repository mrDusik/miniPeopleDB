import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Android usa el favicon del ladrillo rojo para launcher y notificaciones', async () => {
  const [html, manifest, launcher, roundLauncher, notification] = await Promise.all([
    read('public/index.html'),
    read('android/app/src/main/AndroidManifest.xml'),
    read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'),
    read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml'),
    readFile(new URL('android/app/src/main/res/drawable-nodpi/ic_notification.png', root))
      .then((buffer) => buffer.toString('hex', 0, 8)),
  ]);
  assert.match(html, /href="\/toast_images\/hero_2026-01-05_16-38-47-871\.webp"/);
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
  assert.match(manifest, /com\.google\.firebase\.messaging\.default_notification_icon/);
  assert.match(launcher, /@mipmap\/ic_launcher_foreground/);
  assert.match(roundLauncher, /@mipmap\/ic_launcher_foreground/);
  assert.equal(notification, '89504e470d0a1a0a');

  for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
    for (const icon of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      await access(new URL(`android/app/src/main/res/mipmap-${density}/${icon}`, root));
    }
  }
});
