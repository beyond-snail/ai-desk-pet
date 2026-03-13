class WeatherEffects {
  constructor() {
    this.hostElement = null;
    this.container = null;
    this.currentEffect = null;
    this.maxParticles = 8;
    this.lowPower = false;
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

  setLowPower(enabled) {
    const next = Boolean(enabled);
    if (this.lowPower === next) {
      return;
    }

    this.lowPower = next;
    if (this.container) {
      this.container.dataset.lowPower = this.lowPower ? 'true' : 'false';
    }

    if (this.currentEffect) {
      this.renderParticles(this.currentEffect);
    }
  }

  renderParticles(effect) {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = '';
    this.container.dataset.effect = effect;
    this.container.dataset.lowPower = this.lowPower ? 'true' : 'false';

    let count = effect === 'fog' ? 4 : effect === 'night' ? 5 : this.maxParticles;
    if (this.lowPower) {
      if (effect === 'fog') {
        count = 2;
      } else if (effect === 'night') {
        count = 3;
      } else if (effect === 'rain' || effect === 'snow') {
        count = 3;
      } else {
        count = 0;
      }
    }

    if (count <= 0) {
      return;
    }

    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement('span');
      particle.className = 'weather-particle';
      particle.style.left = `${(index / count) * 100}%`;
      particle.style.animationDelay = `${(index % 6) * 0.18}s`;
      particle.style.animationDuration = this.lowPower
        ? `${2.4 + (index % 3) * 0.45}s`
        : `${1.8 + (index % 4) * 0.35}s`;
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
