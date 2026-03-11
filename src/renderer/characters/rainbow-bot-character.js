class RainbowBotCharacter extends BaseCharacter {
  constructor(config) {
    super(config);
    this._currentMood = 'idle';
  }

  _eyeHTML(mood, cx, cy) {
    const isLeft = cx === 43;
    const glowId = isLeft ? 'rb-eyeGlowL' : 'rb-eyeGlowR';
    const glowClass = isLeft ? 'rb-eye-glow-l' : 'rb-eye-glow-r';

    switch (mood) {
      case 'happy':
      case 'excited':
        return `
          <circle cx="${cx}" cy="${cy}" r="8" fill="url(#${glowId})"/>
          <path d="M ${cx - 6} ${cy + 1} Q ${cx} ${cy - 7} ${cx + 6} ${cy + 1}" fill="#38bdf8" stroke="#7ee8ff" stroke-width="1"/>
          <path d="M ${cx - 4} ${cy} Q ${cx} ${cy - 4} ${cx + 4} ${cy}" fill="#7ee8ff"/>
          <circle cx="${cx + 2}" cy="${cy - 2}" r="1.2" fill="white" opacity="0.9"/>`;

      case 'confused':
        if (isLeft) {
          return `
            <circle cx="${cx}" cy="${cy}" r="6" fill="url(#${glowId})"/>
            <circle cx="${cx}" cy="${cy}" r="5" fill="#38bdf8"/>
            <circle cx="${cx}" cy="${cy}" r="3" fill="#7ee8ff"/>
            <circle cx="${cx}" cy="${cy}" r="1.5" fill="white" opacity="0.95"/>
            <circle cx="${cx + 1.5}" cy="${cy - 1.5}" r="0.8" fill="white" opacity="0.8"/>`;
        }

        return `
          <circle cx="${cx}" cy="${cy}" r="6" fill="url(#${glowId})"/>
          <ellipse cx="${cx}" cy="${cy}" rx="5.5" ry="2.5" fill="#38bdf8"/>
          <ellipse cx="${cx}" cy="${cy}" rx="3.5" ry="1.5" fill="#7ee8ff"/>
          <circle cx="${cx + 1.5}" cy="${cy - 0.5}" r="0.8" fill="white" opacity="0.8"/>
          <path d="M ${cx - 5.5} ${cy - 2.5} Q ${cx} ${cy - 5} ${cx + 5.5} ${cy - 2.5}" fill="none" stroke="#8ab4c8" stroke-width="1.5" stroke-linecap="round"/>`;

      case 'sleepy':
        return `
          <ellipse cx="${cx}" cy="${cy + 1}" rx="6" ry="1.8" fill="#5a8aa0" opacity="0.6"/>
          <path d="M ${cx - 6} ${cy + 1} Q ${cx} ${cy - 3} ${cx + 6} ${cy + 1}" fill="#6090a8" opacity="0.8"/>
          <path d="M ${cx - 5} ${cy + 1} L ${cx + 5} ${cy + 1}" stroke="#8ab4c8" stroke-width="2.5" stroke-linecap="round"/>`;

      case 'talking':
        return `
          <circle cx="${cx}" cy="${cy}" r="9" fill="url(#${glowId})" opacity="0.8"/>
          <circle cx="${cx}" cy="${cy}" r="7" fill="#0ea5e9" opacity="0.2"/>
          <circle cx="${cx}" cy="${cy}" r="6" fill="#38bdf8"/>
          <circle cx="${cx}" cy="${cy}" r="4" fill="#7ee8ff"/>
          <circle cx="${cx}" cy="${cy}" r="2.5" fill="white" opacity="0.95"/>
          <circle cx="${cx + 2}" cy="${cy - 2}" r="1.2" fill="white" opacity="0.9"/>`;

      case 'dizzy': {
        const cls = isLeft ? 'rb-dizzy-eye-l' : 'rb-dizzy-eye-r';
        return `
          <circle cx="${cx}" cy="${cy}" r="7" fill="#1a2a38" opacity="0.85"/>
          <g class="${cls}">
            <circle cx="${cx}" cy="${cy}" r="6.5" fill="none" stroke="#8ab4c8" stroke-width="1.2" opacity="0.3"/>
            <path d="M ${cx} ${cy} m 0 -5.5 a 5.5 5.5 0 0 1 5.5 5.5 a 4 4 0 0 1 -4 4 a 2.5 2.5 0 0 1 -2.5 -2.5 a 1.2 1.2 0 0 1 1.2 -1.2"
              fill="none" stroke="#a0c8e0" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="${cx}" cy="${cy}" r="1.5" fill="#c8e4f0"/>
          </g>`;
      }

      case 'sad':
        return `
          <circle class="${glowClass}" cx="${cx}" cy="${cy}" r="8" fill="url(#${glowId})"/>
          <circle cx="${cx}" cy="${cy}" r="5.5" fill="#38bdf8" opacity="0.6"/>
          <circle cx="${cx}" cy="${cy}" r="3.5" fill="#7ee8ff" opacity="0.7"/>
          <circle cx="${cx}" cy="${cy}" r="2" fill="white" opacity="0.7"/>`;

      default:
        return `
          <circle class="${glowClass}" cx="${cx}" cy="${cy}" r="8" fill="url(#${glowId})"/>
          <circle cx="${cx}" cy="${cy}" r="7" fill="#0ea5e9" opacity="0.15"/>
          <circle cx="${cx}" cy="${cy}" r="5.5" fill="#38bdf8"/>
          <circle cx="${cx}" cy="${cy}" r="3.5" fill="#7ee8ff"/>
          <circle cx="${cx}" cy="${cy}" r="2" fill="white" opacity="0.95"/>
          <circle cx="${cx + 2}" cy="${cy - 2}" r="1" fill="white" opacity="0.8"/>`;
    }
  }

  _mouthPath(mood) {
    switch (mood) {
      case 'happy':
      case 'excited':
        return 'M 44 74 Q 60 86 76 74';
      case 'confused':
        return 'M 46 78 Q 60 76 74 80';
      case 'sleepy':
        return 'M 50 76 Q 60 74 70 76';
      case 'dizzy':
        return 'M 48 78 Q 60 82 72 78';
      case 'talking':
        return 'M 48 76 Q 60 80 72 76';
      case 'sad':
        return 'M 46 80 Q 60 76 74 80';
      default:
        return 'M 46 74 Q 60 80 74 74';
    }
  }

  _updateEyes(mood) {
    if (!this.rootElement) {
      return;
    }

    const eyeL = this.rootElement.querySelector('.rb-eye-l');
    const eyeR = this.rootElement.querySelector('.rb-eye-r');
    if (!eyeL || !eyeR) {
      return;
    }

    eyeL.innerHTML = this._eyeHTML(mood, 43, 62);
    eyeR.innerHTML = this._eyeHTML(mood, 77, 62);

    const blinkMoods = ['idle', 'hungry'];
    if (blinkMoods.includes(mood)) {
      eyeL.style.animation = '';
      eyeR.style.animation = '';
      return;
    }

    eyeL.style.animation = 'none';
    eyeR.style.animation = 'none';
  }

  _updateMouth(mood) {
    if (!this.rootElement) {
      return;
    }

    const mouth = this.rootElement.querySelector('#rb-mouthPath');
    if (mouth) {
      mouth.setAttribute('d', this._mouthPath(mood));
    }
  }

  applyMood(payload) {
    super.applyMood(payload);

    const mood = (typeof payload === 'object' && payload !== null)
      ? (payload.mood || 'idle')
      : (payload || 'idle');

    this._currentMood = mood;
    this._updateEyes(mood);
    this._updateMouth(mood);
  }
}
