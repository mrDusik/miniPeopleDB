import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Android usa el icono de app suministrado y conserva el ladrillo en favicon y notificaciones', async () => {
  const [html, manifest, launcher, roundLauncher, notification] = await Promise.all([
    read('public/index.html'),
    read('android/app/src/main/AndroidManifest.xml'),
    read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'),
    read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml'),
    readFile(new URL('android/app/src/main/res/drawable-nodpi/ic_notification.png', root))
      .then((buffer) => buffer.toString('hex', 0, 8)),
  ]);
  assert.match(html, /<link rel="icon" type="image\/png" href="\/toast_images\/brick\.png">/);
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
  assert.match(manifest, /android:screenOrientation="portrait"/);
  assert.match(manifest, /com\.google\.firebase\.messaging\.default_notification_icon/);
  assert.match(launcher, /@mipmap\/ic_launcher_foreground/);
  assert.match(roundLauncher, /@mipmap\/ic_launcher_foreground/);
  assert.equal(notification, '89504e470d0a1a0a');

  const brandImage = await readFile(new URL('public/toast_images/brick.png', root));
  assert.equal(brandImage.toString('hex', 0, 8), '89504e470d0a1a0a');
  assert.equal(brandImage.readUInt32BE(16), 966);
  assert.equal(brandImage.readUInt32BE(20), 631);

  const appIcon = await readFile(new URL('android/app-icon.png', root));
  assert.equal(appIcon.toString('hex', 0, 8), '89504e470d0a1a0a');
  assert.equal(appIcon.readUInt32BE(16), 768);
  assert.equal(appIcon.readUInt32BE(20), 768);

  for (const [density, legacySize, foregroundSize] of [
    ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216],
    ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
  ]) {
    for (const icon of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      const path = new URL(`android/app/src/main/res/mipmap-${density}/${icon}`, root);
      await access(path);
      const image = await readFile(path);
      const size = icon === 'ic_launcher_foreground.png' ? foregroundSize : legacySize;
      assert.equal(image.readUInt32BE(16), size, `${density}/${icon} width`);
      assert.equal(image.readUInt32BE(20), size, `${density}/${icon} height`);
    }
  }
});
