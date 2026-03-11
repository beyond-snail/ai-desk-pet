class WeatherEffects {
  constructor() {
    this.hostElement = null;
    this.container = null;
    this.currentEffect = null;
    this.maxParticles = 8;
  }

  attachTo(hostElement) {
    this.hostElement = hostElement;
    this.ensureContainer();
    if (this.currentEffect) {
      this.renderParticles(this.currentEffect);
    }
  }

  ensureContainer() {
    if (!this.hostElement) {
      return;
    }

    if (this.container && this.container.parentElement !== this.hostElement) {
      this.container.remove();
      this.container = null;
    }

    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'weather-effects';
      this.hostElement.appendChild(this.container);
    }
  }

  setEffect(effect) {
    this.currentEffect = effect;
    if (!effect) {
      this.clear();
      return;
    }

    this.ensureContainer();
    this.renderParticles(effect);
  }

  renderParticles(effect) {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = '';
    this.container.dataset.effect = effect;

    const count = effect === 'fog' ? 4 : effect === 'night' ? 5 : this.maxParticles;
    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement('span');
      particle.className = 'weather-particle';
      particle.style.left = `${(index / count) * 100}%`;
      particle.style.animationDelay = `${(index % 6) * 0.18}s`;
      particle.style.animationDuration = `${1.8 + (index % 4) * 0.35}s`;
      this.container.appendChild(particle);
    }
  }

  clear() {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = '';
    delete this.container.dataset.effect;
  }

  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
