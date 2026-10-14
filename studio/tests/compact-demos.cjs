// Optional delivery encoding. Requires ffmpeg on PATH; npm run demo:poc does not.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const names = process.argv.slice(2);
const ids = names.length ? names : ['iglass', 'olympic', 'cartier', 'morpho', 'aevion', 'teatika', 'shapes'];
fs.mkdirSync('test-results/poc/raw-demos', { recursive: true });
for (const id of ids) {
  if (!/^[a-z]+$/.test(id)) throw Error('Invalid demo id');
  const file = `docs/poc/${id}.webm`;
  const raw = `test-results/poc/raw-demos/${id}.webm`;
  fs.copyFileSync(file, raw);
  const output = path.resolve(`test-results/poc/${id}-compact.webm`);
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw,
    '-vf', 'mpdecimate,setpts=N/(15*TB),scale=1200:-2', '-r', '15', '-an',
    '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-threads', '2', output], { stdio: 'inherit' });
  if (result.error || result.status !== 0) throw result.error || Error('ffmpeg failed');
  fs.copyFileSync(output, file);
  console.log(`${id}: ${fs.statSync(raw).size} → ${fs.statSync(file).size} bytes (idle frames removed, condensed playback)`);
}
