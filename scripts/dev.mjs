// Runs both Vite builds in watch mode so `dist/` always reflects `src/`.
// Load dist/ as an unpacked extension and hit reload after a rebuild.

import { spawn } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const children = [
  spawn(npx, ['vite', 'build', '--watch'], { stdio: 'inherit', shell: false }),
  spawn(npx, ['vite', 'build', '--watch', '--config', 'vite.content.config.ts'], {
    stdio: 'inherit',
    shell: false,
  }),
];

const stop = () => {
  for (const child of children) child.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => code && process.exit(code ?? 1));
