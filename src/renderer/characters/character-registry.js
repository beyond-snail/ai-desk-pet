class CharacterRegistry {
  static BUILTIN_IDS = ['caterpillar', 'cyber-bot', 'pixel-pet', 'rainbow-bot'];

  static FALLBACK_OPTIONS = [
    { id: 'caterpillar', name: '毛毛虫', description: '可爱的绿色小毛毛虫' },
    { id: 'cyber-bot', name: '赛博小机器人', description: '方形金属身体，蓝色 LED 眼睛与履带底盘' },
    { id: 'pixel-pet', name: '像素宠物', description: '8-bit 风格的复古像素宠物' },
    { id: 'rainbow-bot', name: '彩虹机器人', description: '大眼睛会随情绪变化的可爱机器人' }
  ];

  static cachedOptions = null;

  static list() {
    return CharacterRegistry.cachedOptions || CharacterRegistry.FALLBACK_OPTIONS;
  }

  constructor() {
    this.characters = new Map();
    this.basePath = 'characters';
    this.initialized = false;
  }

  register(id, config) {
    this.characters.set(id, config);
    CharacterRegistry.cachedOptions = this.getAll();
  }

  has(id) {
    return this.characters.has(id);
  }

  get(id) {
    return this.characters.get(id) || null;
  }

  getAll() {
    return Array.from(this.characters.entries()).map(([id, config]) => ({ id, ...config }));
  }

  getDefaultId() {
    if (this.characters.has('rainbow-bot')) {
      return 'rainbow-bot';
    }

    if (this.characters.has('caterpillar')) {
      return 'caterpillar';
    }

    return (this.getAll()[0] || {}).id || 'caterpillar';
  }

  async load(id) {
    const targetId = this.has(id) ? id : this.getDefaultId();
    const config = this.characters.get(targetId);

    if (!config) {
      throw new Error(`Character "${id}" not found`);
    }

    const CharClass = targetId === 'rainbow-bot' ? RainbowBotCharacter : BaseCharacter;
    const character = new CharClass(config);
    await character.load(`${this.basePath}/${targetId}`);
    return character;
  }

  async init() {
    if (this.initialized) {
      return;
    }

    await Promise.all(CharacterRegistry.BUILTIN_IDS.map(async (id) => {
      try {
        const response = await fetch(`${this.basePath}/${id}/config.json`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const config = await response.json();
        this.register(id, config);
      } catch (error) {
        console.warn(`Failed to load character ${id}:`, error);
      }
    }));

    this.initialized = true;
    if (!CharacterRegistry.cachedOptions || CharacterRegistry.cachedOptions.length === 0) {
      CharacterRegistry.cachedOptions = CharacterRegistry.FALLBACK_OPTIONS;
    }
  }
}
