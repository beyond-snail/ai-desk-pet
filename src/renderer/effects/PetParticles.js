class PetParticles {
  constructor() {
    this.container = null;
    this.cleanupTimers = new Set();
  }

  init() {
    if (this.container) {
      return;
    }

    this.container = document.createElement('div');
    this.container.className = 'pet-particles';
    document.body.appendChild(this.container);
  }

  burstNearPet(petElement, options = {}) {
    if (!petElement) {
      return;
    }

    this.init();

    const rect = petElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const icon = options.icon || '♥';
    const color = options.color || 'rgba(255, 116, 151, 0.95)';
    const count = options.count || 6;
    const spread = options.spread || 36;
    const rise = options.rise || 42;

    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement('span');
      const angle = ((Math.PI * 2) / count) * index + (Math.random() * 0.45 - 0.2);
      const distance = spread * (0.65 + Math.random() * 0.6);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * (distance * 0.45) - rise * (0.55 + Math.random() * 0.45);
      const duration = 700 + Math.round(Math.random() * 500);
      const delay = Math.round(Math.random() * 90);

      particle.className = 'pet-particle';
      particle.textContent = icon;
      particle.style.left = `${centerX + (Math.random() * 12 - 6)}px`;
      particle.style.top = `${centerY - rect.height * 0.15 + (Math.random() * 10 - 5)}px`;
      particle.style.color = color;
      particle.style.setProperty('--particle-x', `${dx.toFixed(2)}px`);
      particle.style.setProperty('--particle-y', `${dy.toFixed(2)}px`);
      particle.style.setProperty('--particle-duration', `${duration}ms`);
      particle.style.setProperty('--particle-delay', `${delay}ms`);
      particle.style.setProperty('--particle-rotate', `${Math.round(Math.random() * 30 - 15)}deg`);
      this.container.appendChild(particle);

      const timer = window.setTimeout(() => {
        particle.remove();
        this.cleanupTimers.delete(timer);
      }, duration + delay + 120);
      this.cleanupTimers.add(timer);
    }
  }

  destroy() {
    this.cleanupTimers.forEach((timer) => clearTimeout(timer));
    this.cleanupTimers.clear();

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
