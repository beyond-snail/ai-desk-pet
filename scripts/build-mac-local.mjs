import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const electronDist = path.join(projectRoot, 'node_modules', 'electron', 'dist');
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

const args = [
  'electron-builder',
  '--mac',
  'dmg',
  `--${arch}`,
  `-c.electronDist=${electronDist}`
];

const child = spawn('npx', args, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '',
    ELECTRON_FORCE_IS_PACKAGED: ''
  }
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
