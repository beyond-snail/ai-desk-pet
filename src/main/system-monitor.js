const os = require('os');

class SystemMonitor {
  constructor() {
    this.interval = null;
    this.previousCpuInfo = null;
    this.latestSnapshot = this.collectSnapshot();
  }

  start(onUpdate) {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.latestSnapshot = this.collectSnapshot();
    if (onUpdate) {
      onUpdate(this.latestSnapshot);
    }

    this.interval = setInterval(() => {
      this.latestSnapshot = this.collectSnapshot();
      if (onUpdate) {
        onUpdate(this.latestSnapshot);
      }
    }, 5000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getSnapshot() {
    return this.latestSnapshot;
  }

  collectSnapshot() {
    const cpus = os.cpus();
    const memoryUsage = Math.round((1 - os.freemem() / os.totalmem()) * 100);
    const cpuUsage = this.computeCpuUsage(cpus);

    return {
      cpuUsage,
      memoryUsage,
      loadAverage: os.loadavg()[0],
      timestamp: Date.now(),
      platform: process.platform,
      arch: process.arch
    };
  }

  computeCpuUsage(cpus) {
    if (!Array.isArray(cpus) || cpus.length === 0) {
      return 0;
    }

    const totals = cpus.map((cpu) => {
      const times = cpu.times;
      const total = times.user + times.nice + times.sys + times.idle + times.irq;
      return { idle: times.idle, total };
    });

    if (!this.previousCpuInfo) {
      this.previousCpuInfo = totals;
      return 0;
    }

    const percentages = totals.map((current, index) => {
      const previous = this.previousCpuInfo[index] || current;
      const totalDiff = current.total - previous.total;
      const idleDiff = current.idle - previous.idle;
      if (totalDiff <= 0) {
        return 0;
      }
      return Math.round((1 - idleDiff / totalDiff) * 100);
    });

    this.previousCpuInfo = totals;
    const sum = percentages.reduce((accumulator, value) => accumulator + value, 0);
    return Math.round(sum / percentages.length);
  }
}

module.exports = SystemMonitor;
