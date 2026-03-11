class PetManager {
  constructor() {
    this.primaryPet = null;
    this.hostElement = null;
    this.extraPets = new Map();
    this.maxExtraPets = 2;
    this.socialCheckInterval = null;
    this.managePanel = null;
    this.lastSocialAt = 0;
    this.socialCooldownMs = 30 * 1000;
    this.selectionCharacterPicker = null;
    this.chatBubble = null;
    this.growthSystem = null;
    this.weatherService = null;
  }

  async init(primaryPet, options = {}) {
    this.primaryPet = primaryPet;
    this.hostElement = options.hostElement || document.getElementById('pet-root');
    this.selectionCharacterPicker = options.characterPicker || null;
    this.chatBubble = options.chatBubble || null;
    this.growthSystem = options.growthSystem || null;
    this.weatherService = options.weatherService || null;
    this.createManagePanel();
    this.startSocialLoop();
  }

  canUseMultiPet() {
    return Boolean(this.growthSystem && this.growthSystem.hasAbility('multi_pet'));
  }

  canAddPet() {
    return this.canUseMultiPet() && this.extraPets.size < this.maxExtraPets;
  }

  async addPet(characterId, options = {}) {
    if (!this.canAddPet() || !this.hostElement) {
      return null;
    }

    const petHost = document.createElement('div');
    petHost.className = 'pet-instance-host';
    this.hostElement.appendChild(petHost);

    const pet = new PetController({
      characterId,
      hostElement: petHost,
      instanceId: `extra-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      interactive: false,
      isPrimary: false
    });

    await pet.init(characterId);

    const base = this.primaryPet.position;
    const x = options.position && typeof options.position.x === 'number'
      ? options.position.x
      : Math.max(40, Math.min(this.primaryPet.screenSize.width - 120, base.x + 90 + this.extraPets.size * 50));
    const y = options.position && typeof options.position.y === 'number'
      ? options.position.y
      : Math.max(40, Math.min(this.primaryPet.screenSize.height - 120, base.y + 40));
    pet.setPosition(x, y);

    if (this.growthSystem) {
      pet.attachGrowthSystem(this.growthSystem, characterId);
    }

    if (this.weatherService && this.weatherService.currentWeather) {
      pet.applyWeatherState({
        currentWeather: this.weatherService.currentWeather,
        visualEffect: this.weatherService.getWeatherVisualEffect(),
        moodEffect: this.weatherService.getWeatherMoodEffect(),
        dayPart: this.weatherService.getDayPart()
      });
    }

    this.extraPets.set(pet.instanceId, { pet, host: petHost });
    await this.saveState();
    return pet;
  }

  async removePet(instanceId) {
    const entry = this.extraPets.get(instanceId);
    if (!entry) {
      return;
    }

    entry.pet.destroy();
    entry.host.remove();
    this.extraPets.delete(instanceId);
    await this.saveState();
    this.renderManagePanel();
  }

  getAllPets() {
    return [this.primaryPet, ...Array.from(this.extraPets.values()).map((entry) => entry.pet)].filter(Boolean);
  }

  createManagePanel() {
    this.managePanel = document.createElement('div');
    this.managePanel.id = 'pet-manager-panel';
    this.managePanel.className = 'pet-manager-panel hidden';
    document.body.appendChild(this.managePanel);

    this.managePanel.addEventListener('click', (event) => {
      if (event.target === this.managePanel) {
        this.hideManager();
        return;
      }

      const closeButton = event.target.closest('.pet-manager-close');
      if (closeButton) {
        this.hideManager();
        return;
      }

      const removeButton = event.target.closest('[data-remove-pet]');
      if (removeButton) {
        this.removePet(removeButton.dataset.removePet);
      }
    });
  }

  renderManagePanel() {
    const items = Array.from(this.extraPets.entries());
    this.managePanel.innerHTML = `
      <div class="pet-manager-card">
        <div class="pet-manager-header">
          <div>
            <p class="pet-manager-kicker">Pet Team</p>
            <h2>管理陪伴中的伙伴</h2>
          </div>
          <button class="pet-manager-close" type="button">关闭</button>
        </div>
        <div class="pet-manager-list">
          ${items.length === 0 ? '<div class="pet-manager-empty">当前还没有额外宠物。</div>' : items.map(([id, entry]) => {
            const element = entry.pet.getElement();
            const characterId = element ? element.dataset.character : entry.pet.currentCharacterId;
            const meta = entry.pet.character ? entry.pet.character.getMeta() : { name: characterId };
            return `
              <div class="pet-manager-item">
                <div>
                  <div class="pet-manager-name">${meta.name}</div>
                  <div class="pet-manager-desc">实例 ID: ${id}</div>
                </div>
                <button type="button" data-remove-pet="${id}">移除</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  showManager() {
    this.renderManagePanel();
    this.managePanel.classList.remove('hidden');
    window.dispatchEvent(new CustomEvent('pet-manager:visibility', {
      detail: { visible: true }
    }));
  }

  hideManager() {
    this.managePanel.classList.add('hidden');
    window.dispatchEvent(new CustomEvent('pet-manager:visibility', {
      detail: { visible: false }
    }));
  }

  async requestAddPet() {
    if (!this.canUseMultiPet()) {
      if (this.chatBubble) {
        this.chatBubble.show('等级还不够，先继续陪伴我成长吧。', 3500);
      }
      return;
    }

    if (!this.canAddPet()) {
      if (this.chatBubble) {
        this.chatBubble.show('已经达到当前最多宠物数量。', 3500);
      }
      return;
    }

    if (!this.selectionCharacterPicker) {
      return;
    }

    this.selectionCharacterPicker.open({
      title: '为新伙伴选择形象',
      mode: 'add-pet',
      currentId: null,
      onSelect: async (characterId) => {
        await this.addPet(characterId);
        if (this.chatBubble) {
          this.chatBubble.show('新伙伴加入队伍了。', 3500);
        }
      }
    });
  }

  startSocialLoop() {
    if (this.socialCheckInterval) {
      clearInterval(this.socialCheckInterval);
    }

    this.socialCheckInterval = setInterval(() => {
      this.runSocialChecks();
    }, 4000);
  }

  runSocialChecks() {
    const pets = this.getAllPets();
    if (pets.length < 2) {
      return;
    }

    const now = Date.now();
    if (now - this.lastSocialAt < this.socialCooldownMs) {
      return;
    }

    for (let index = 1; index < pets.length; index += 1) {
      const primary = pets[0];
      const peer = pets[index];
      const dx = primary.position.x - peer.position.x;
      const dy = primary.position.y - peer.position.y;
      const distance = Math.sqrt(dx ** 2 + dy ** 2);

      if (distance < 120) {
        this.lastSocialAt = now;
        primary.setMood('happy', { silent: true });
        peer.setMood('happy', { silent: true });
        peer.moveToTarget({
          x: Math.max(20, primary.position.x - 70),
          y: Math.max(20, primary.position.y + 20)
        });

        if (this.chatBubble) {
          this.chatBubble.show('伙伴们靠近了，正在排队跟随。', 3000);
        }
        break;
      }
    }
  }

  async loadSavedPets() {
    const state = await this.readState();
    const pets = state && Array.isArray(state.extraPets) ? state.extraPets : [];

    for (const petConfig of pets.slice(0, this.maxExtraPets)) {
      await this.addPet(petConfig.characterId || 'caterpillar', { position: petConfig.position });
    }
  }

  async saveState() {
    const snapshot = {
      extraPets: Array.from(this.extraPets.values()).map((entry) => ({
        characterId: entry.pet.currentCharacterId,
        position: entry.pet.position
      }))
    };

    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet('petManagerState', snapshot);
      return;
    }

    localStorage.setItem('petManagerState', JSON.stringify(snapshot));
  }

  async readState() {
    if (window.electronAPI && window.electronAPI.storeGet) {
      return window.electronAPI.storeGet('petManagerState');
    }

    const saved = localStorage.getItem('petManagerState');
    return saved ? JSON.parse(saved) : null;
  }

  destroy() {
    if (this.socialCheckInterval) {
      clearInterval(this.socialCheckInterval);
      this.socialCheckInterval = null;
    }

    for (const [id, entry] of this.extraPets.entries()) {
      entry.pet.destroy();
      entry.host.remove();
      this.extraPets.delete(id);
    }

    if (this.managePanel) {
      this.managePanel.remove();
      this.managePanel = null;
    }
  }
}
