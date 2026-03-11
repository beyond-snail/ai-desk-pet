class Settings {
  constructor() {
    this.panel = null;
    this.providerField = null;
    this.characterField = null;
    this.characterBrowseButton = null;
    this.apiKeyField = null;
    this.modelField = null;
    this.baseUrlField = null;
    this.baseUrlRow = null;
    this.weatherApiKeyField = null;
    this.weatherCityField = null;
    this.autoLaunchField = null;
    this.voiceReplyField = null;
    this.closeButton = null;
    this.saveButton = null;
    this.feedbackElement = null;
    this.petController = null;
    this.characterPicker = null;
  }

  async init(options = {}) {
    this.petController = options.petController || null;
    this.characterPicker = options.characterPicker || null;
    this.createPanel();
    this.bindEvents();
    await this.loadSettings();
  }

  createPanel() {
    this.panel = document.createElement('div');
    this.panel.id = 'settings-panel';
    this.panel.className = 'settings-panel hidden';
    this.panel.innerHTML = `
      <div class="settings-card">
        <div class="settings-header">
          <div>
            <p class="settings-kicker">Desk Pet Control</p>
            <h2>伙伴与系统设置</h2>
            <p class="settings-subtitle">设置项较多时，内容区域可滚动，底部保存按钮会始终保留在视口内。</p>
          </div>
          <button id="settings-close" type="button">关闭</button>
        </div>
        <div class="settings-scroll">
          <div class="settings-section">
            <div class="settings-section-title">伙伴外观</div>
            <label>
              <span>当前角色</span>
              <div class="settings-character-row">
                <select id="settings-character"></select>
                <button id="settings-character-picker" type="button">角色库</button>
              </div>
            </label>
          </div>
          <div class="settings-section">
            <div class="settings-section-title">LLM 接入</div>
            <p class="settings-note">已内置 AI 服务，无需配置即可聊天。填写自己的 Key 可获得更好的体验。</p>
            <label>
              <span>提供商</span>
              <select id="settings-provider">
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="custom">自定义兼容接口</option>
              </select>
            </label>
            <label>
              <span>API Key</span>
              <input id="settings-api-key" type="password" placeholder="输入 API Key，可留空">
            </label>
            <label>
              <span>模型</span>
              <input id="settings-model" type="text" placeholder="例如 deepseek-chat">
            </label>
            <label id="settings-base-url-row">
              <span>Base URL</span>
              <input id="settings-base-url" type="text" placeholder="https://api.example.com/v1">
            </label>
          </div>
          <div class="settings-section">
            <div class="settings-section-title">语音交互</div>
            <p class="settings-note">点击输入框旁的麦克风可以说话，宠物回复后也可以自动朗读。</p>
            <label class="settings-toggle-row">
              <span>语音朗读回复</span>
              <input id="settings-voice-reply" type="checkbox">
            </label>
          </div>
          <div class="settings-section">
            <div class="settings-section-title">天气联动</div>
            <p class="settings-note">已内置免费天气服务，自动定位城市，无需配置。填写和风天气 Key 可获得更精准的中国城市数据。</p>
            <label>
              <span>天气 API Key</span>
              <input id="settings-weather-api-key" type="password" placeholder="和风天气 API Key，可留空">
            </label>
            <label>
              <span>城市/Location ID</span>
              <input id="settings-weather-city" type="text" placeholder="例如 101010100 或 城市 ID">
            </label>
          </div>
          <div class="settings-section">
            <div class="settings-section-title">桌面集成</div>
            <label class="settings-toggle-row">
              <span>开机自启动</span>
              <input id="settings-auto-launch" type="checkbox">
            </label>
            <label class="settings-readonly-row">
              <span>唤醒热键</span>
              <span class="settings-hotkey-display">⌘⇧P / Ctrl+Shift+P</span>
            </label>
          </div>
        </div>
        <div class="settings-actions">
          <span id="settings-feedback" class="settings-feedback"></span>
          <button id="settings-save" type="button">保存设置</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.panel);

    this.providerField = this.panel.querySelector('#settings-provider');
    this.characterField = this.panel.querySelector('#settings-character');
    this.characterBrowseButton = this.panel.querySelector('#settings-character-picker');
    this.apiKeyField = this.panel.querySelector('#settings-api-key');
    this.modelField = this.panel.querySelector('#settings-model');
    this.baseUrlField = this.panel.querySelector('#settings-base-url');
    this.baseUrlRow = this.panel.querySelector('#settings-base-url-row');
    this.weatherApiKeyField = this.panel.querySelector('#settings-weather-api-key');
    this.weatherCityField = this.panel.querySelector('#settings-weather-city');
    this.autoLaunchField = this.panel.querySelector('#settings-auto-launch');
    this.voiceReplyField = this.panel.querySelector('#settings-voice-reply');
    this.closeButton = this.panel.querySelector('#settings-close');
    this.saveButton = this.panel.querySelector('#settings-save');
    this.feedbackElement = this.panel.querySelector('#settings-feedback');

    this.renderCharacterOptions();
  }

  bindEvents() {
    this.providerField.addEventListener('change', () => {
      this.applyProviderDefaults(this.providerField.value, false);
      this.updateBaseUrlVisibility();
    });

    this.characterBrowseButton.addEventListener('click', () => {
      this.hide();
      if (this.characterPicker) {
        this.characterPicker.open();
      }
    });

    this.closeButton.addEventListener('click', () => {
      this.hide();
    });

    this.panel.addEventListener('click', (event) => {
      if (event.target === this.panel) {
        this.hide();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isVisible()) {
        this.hide();
      }
    });

    window.addEventListener('pet:character-switched', (event) => {
      if (event.detail && event.detail.characterId) {
        this.characterField.value = event.detail.characterId;
      }
    });

    this.saveButton.addEventListener('click', async () => {
      await this.saveSettings();
    });
  }

  async loadSettings() {
    const characterId = await this.getValue('characterId', 'caterpillar');
    const provider = await this.getValue('llmProvider', 'deepseek');
    const apiKey = await this.getValue('llmApiKey', '');
    const model = await this.getValue('llmModel', 'deepseek-chat');
    const baseUrl = await this.getValue('llmBaseUrl', 'https://api.deepseek.com/v1');
    const weatherApiKey = await this.getValue('weatherApiKey', '');
    const weatherCity = await this.getValue('weatherCity', '');
    const autoLaunch = await this.getAutoLaunchValue();
    const voiceReplyEnabled = await this.getValue('voiceReplyEnabled', true);

    this.renderCharacterOptions();
    this.characterField.value = characterId;
    this.providerField.value = provider;
    this.apiKeyField.value = apiKey;
    this.modelField.value = model;
    this.baseUrlField.value = baseUrl;
    this.weatherApiKeyField.value = weatherApiKey;
    this.weatherCityField.value = weatherCity;
    this.autoLaunchField.checked = Boolean(autoLaunch);
    this.voiceReplyField.checked = Boolean(voiceReplyEnabled);
    this.applyProviderDefaults(provider, true);
    this.updateBaseUrlVisibility();
  }

  async saveSettings() {
    const validationError = this.validateSettings();
    if (validationError) {
      this.setFeedback(validationError, true);
      return;
    }

    const nextCharacterId = this.characterField.value;
    const characterChanged = Boolean(this.petController && nextCharacterId !== this.petController.currentCharacterId);

    await this.setValue('llmProvider', this.providerField.value);
    await this.setValue('characterId', nextCharacterId);
    await this.setValue('llmApiKey', this.apiKeyField.value.trim());
    await this.setValue('llmModel', this.modelField.value.trim());
    await this.setValue('llmBaseUrl', this.baseUrlField.value.trim());
    await this.setValue('weatherApiKey', this.weatherApiKeyField.value.trim());
    await this.setValue('weatherCity', this.weatherCityField.value.trim());
    await this.setValue('voiceReplyEnabled', this.voiceReplyField.checked);
    await this.setAutoLaunchValue(this.autoLaunchField.checked);

    if (characterChanged) {
      await this.petController.switchCharacter(nextCharacterId);
    }

    this.setFeedback('设置已保存。', false);

    window.dispatchEvent(new CustomEvent('settings:saved', {
      detail: {
        provider: this.providerField.value,
        characterId: nextCharacterId,
        characterChanged,
        weatherChanged: true,
        autoLaunch: this.autoLaunchField.checked,
        voiceReplyEnabled: this.voiceReplyField.checked
      }
    }));

    this.hide();
  }

  show() {
    this.renderCharacterOptions();
    if (this.petController && this.petController.currentCharacterId) {
      this.characterField.value = this.petController.currentCharacterId;
    }

    this.panel.classList.remove('hidden');
    this.updateBaseUrlVisibility();
    this.setFeedback('', false);
    this.characterField.focus();
    window.dispatchEvent(new CustomEvent('settings:visibility', {
      detail: { visible: true }
    }));
  }

  hide() {
    if (this.panel.classList.contains('hidden')) {
      return;
    }

    this.panel.classList.add('hidden');
    window.dispatchEvent(new CustomEvent('settings:visibility', {
      detail: { visible: false }
    }));
  }

  isVisible() {
    return !this.panel.classList.contains('hidden');
  }

  updateBaseUrlVisibility() {
    const shouldShow = this.providerField.value !== 'anthropic';
    this.baseUrlRow.classList.toggle('hidden', !shouldShow);
  }

  validateSettings() {
    const baseUrl = this.baseUrlField.value.trim();
    if (this.providerField.value !== 'anthropic' && baseUrl) {
      try {
        new URL(baseUrl);
      } catch (_error) {
        return 'Base URL 格式不正确';
      }
    }

    return '';
  }

  setFeedback(message, isError) {
    this.feedbackElement.textContent = message;
    this.feedbackElement.dataset.error = isError ? 'true' : 'false';
  }

  applyProviderDefaults(provider, preserveExistingValues) {
    const defaults = {
      deepseek: {
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com/v1'
      },
      openai: {
        model: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1'
      },
      anthropic: {
        model: 'claude-3-5-sonnet-latest',
        baseUrl: ''
      },
      custom: {
        model: this.modelField.value || 'custom-model',
        baseUrl: this.baseUrlField.value || 'https://api.example.com/v1'
      }
    };

    const next = defaults[provider] || defaults.deepseek;

    if (!preserveExistingValues || !this.modelField.value.trim()) {
      this.modelField.value = next.model;
    }

    if (provider === 'anthropic') {
      this.baseUrlField.value = '';
      return;
    }

    if (!preserveExistingValues || !this.baseUrlField.value.trim()) {
      this.baseUrlField.value = next.baseUrl;
    }
  }

  renderCharacterOptions() {
    const characters = this.petController ? this.petController.getCharacterOptions() : CharacterRegistry.list();
    this.characterField.innerHTML = characters.map((character) => {
      return `<option value="${character.id}">${character.name}</option>`;
    }).join('');
  }

  async getValue(key, fallback) {
    if (window.electronAPI && window.electronAPI.storeGet) {
      const value = await window.electronAPI.storeGet(key);
      return value === undefined || value === null ? fallback : value;
    }

    const value = localStorage.getItem(key);
    if (value === null) {
      return fallback;
    }

    return value === 'true' ? true : value === 'false' ? false : value;
  }

  async setValue(key, value) {
    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet(key, value);
      return;
    }

    localStorage.setItem(key, String(value));
  }

  async getAutoLaunchValue() {
    if (window.electronAPI && window.electronAPI.getAutoLaunch) {
      return window.electronAPI.getAutoLaunch();
    }

    const stored = localStorage.getItem('autoLaunch');
    return stored === 'true';
  }

  async setAutoLaunchValue(enabled) {
    if (window.electronAPI && window.electronAPI.setAutoLaunch) {
      window.electronAPI.setAutoLaunch(enabled);
      return;
    }

    localStorage.setItem('autoLaunch', String(enabled));
  }
}
