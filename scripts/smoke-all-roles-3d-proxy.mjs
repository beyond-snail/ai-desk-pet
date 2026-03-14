import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const roleChecks = [
  {
    id: 'caterpillar',
    stylePath: 'src/renderer/characters/caterpillar/style.css',
    templatePath: 'src/renderer/characters/caterpillar/template.html',
    stylePatterns: ['perspective:', "data-character='caterpillar'"],
    templatePatterns: ["data-character=\"caterpillar\""]
  },
  {
    id: 'cyber-bot',
    stylePath: 'src/renderer/characters/cyber-bot/style.css',
    templatePath: 'src/renderer/characters/cyber-bot/template.html',
    stylePatterns: ['perspective:', '--cb-rotate-y', '--cb-depth', "data-character='cyber-bot'"],
    templatePatterns: ["data-character=\"cyber-bot\""]
  },
  {
    id: 'pixel-pet',
    stylePath: 'src/renderer/characters/pixel-pet/style.css',
    templatePath: 'src/renderer/characters/pixel-pet/template.html',
    stylePatterns: ['perspective:', '--pp-rotate-y', '--pp-depth', "data-character='pixel-pet'"],
    templatePatterns: ["data-character=\"pixel-pet\""]
  },
  {
    id: 'rainbow-bot',
    stylePath: 'src/renderer/characters/rainbow-bot/style.css',
    templatePath: 'src/renderer/characters/rainbow-bot/template.html',
    stylePatterns: ['perspective:', '--rb-proxy-rotate-y', '--rb-depth-main', "data-character='rainbow-bot'"],
    templatePatterns: ['rb-stage', "data-character=\"rainbow-bot\""]
  }
];

for (const role of roleChecks) {
  const style = readFileSync(resolve(role.stylePath), 'utf8');
  const template = readFileSync(resolve(role.templatePath), 'utf8');

  for (const pattern of role.stylePatterns) {
    if (!style.includes(pattern)) {
      throw new Error(`3d proxy smoke failed: ${role.id} missing style pattern "${pattern}"`);
    }
  }
  for (const pattern of role.templatePatterns) {
    if (!template.includes(pattern)) {
      throw new Error(`3d proxy smoke failed: ${role.id} missing template pattern "${pattern}"`);
    }
  }
}

console.log('all role 3d proxy smoke ok');
