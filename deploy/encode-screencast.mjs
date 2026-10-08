import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const folder = resolve(process.argv[2]);
const ffmpeg = process.argv[3];
const frames = JSON.parse(readFileSync(resolve(folder, 'frames.json'), 'utf8'));
const lines = ['ffconcat version 1.0'];
for (let i = 0; i < frames.length; i++) {
  lines.push(`file '${frames[i].name}'`);
  if (i + 1 < frames.length) lines.push(`duration ${Math.max(0.04, frames[i + 1].time - frames[i].time)}`);
}
writeFileSync(resolve(folder, 'timeline.txt'), lines.join('\n'));
const result = spawnSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', resolve(folder, 'timeline.txt'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-r', '10', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(folder, 'nogotochki-demo.mp4')], {stdio: 'inherit'});
process.exit(result.status ?? 1);
