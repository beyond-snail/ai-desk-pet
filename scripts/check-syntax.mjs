import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import vm from 'node:vm';

function collectFiles(dir) {
  const entries = readdirSync(dir);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (extname(fullPath) === '.js') {
      files.push(fullPath);
    }
  }

  return files;
}

const targets = ['src/main', 'src/renderer'];
let hasError = false;

for (const target of targets) {
  for (const file of collectFiles(target)) {
    try {
      new vm.Script(readFileSync(file, 'utf8'), { filename: file });
    } catch (error) {
      hasError = true;
      console.error(`Syntax error in ${file}`);
      console.error(error.message);
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log('syntax ok');
