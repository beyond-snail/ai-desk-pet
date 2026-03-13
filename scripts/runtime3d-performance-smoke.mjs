import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DefaultRobotController } from '../runtime/godot/default-robot-controller.mjs';
import { GameplaySystem } from '../runtime/godot/gameplay-system.mjs';

function parseReportPath() {
  const argv = process.argv.slice(2);
  const index = argv.indexOf('--report');
  if (index >= 0 && argv[index + 1]) {
    return resolve(argv[index + 1]);
  }
  if (process.env.RUNTIME3D_PERF_REPORT_PATH) {
    return resolve(process.env.RUNTIME3D_PERF_REPORT_PATH);
  }
  return null;
}

const robot = new DefaultRobotController({
  width: 1440,
  height: 900,
  offscreenProbability: 0.45
});
const gameplay = new GameplaySystem();

const rssStart = process.memoryUsage().rss;
const start = process.hrtime.bigint();
const frameCount = 4800;

for (let i = 0; i < frameCount; i += 1) {
  if (i % 700 === 0) {
    gameplay.applyAction('feed');
  }
  if (i % 930 === 0) {
    gameplay.applyAction('clean');
  }
  if (i % 520 === 0) {
    gameplay.applyAction('pet');
  }
  if (i % 350 === 0) {
    gameplay.setFocusActive(!gameplay.snapshot().focus.active);
  }
  robot.update(16);
  gameplay.tick(16);
}

const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
const rssEnd = process.memoryUsage().rss;
const rssDeltaMb = (rssEnd - rssStart) / (1024 * 1024);
const frameMs = elapsedMs / frameCount;
const fps = 1000 / Math.max(frameMs, 0.0001);

const report = {
  generatedAt: new Date().toISOString(),
  frameCount,
  elapsedMs: Number(elapsedMs.toFixed(2)),
  frameMs: Number(frameMs.toFixed(4)),
  simulatedFps: Number(fps.toFixed(2)),
  rssDeltaMb: Number(rssDeltaMb.toFixed(2)),
  thresholds: {
    maxElapsedMs: 4000,
    maxRssDeltaMb: 120,
    minSimulatedFps: 800
  }
};

if (report.elapsedMs > report.thresholds.maxElapsedMs) {
  throw new Error(`performance elapsed too high: ${report.elapsedMs}ms`);
}
if (report.rssDeltaMb > report.thresholds.maxRssDeltaMb) {
  throw new Error(`performance rss delta too high: ${report.rssDeltaMb}MB`);
}
if (report.simulatedFps < report.thresholds.minSimulatedFps) {
  throw new Error(`performance simulated fps too low: ${report.simulatedFps}`);
}

const reportPath = parseReportPath();
if (reportPath) {
  mkdirSync(resolve(reportPath, '..'), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

console.log('runtime3d performance smoke ok');
console.log(JSON.stringify(report, null, 2));
