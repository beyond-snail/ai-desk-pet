class CharacterPicker {
  constructor() {
    this.element = null;
    this.isOpen = false;
    this.petController = null;
    this.onSelect = null;
    this.mode = 'switch';
    this.title = '选择你的桌面伙伴';
    this.currentId = null;
  }

  init(petController) {
    this.petController = petController;
    this.createElement();
    this.bindGlobalEvents();
  }

  createElement() {
    this.element = document.createElement('div');
    this.element.id = 'character-picker';
    this.element.className = 'character-picker hidden';
    document.body.appendChild(this.element);
  }

  bindGlobalEvents() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    this.element.addEventListener('click', async (event) => {
      if (!this.isOpen) {
        return;
      }

      if (event.target === this.element) {
        this.close();
        return;
      }

      const closeButton = event.target.closest('.picker-close');
      if (closeButton) {
        this.close();
        return;
      }

      const item = event.target.closest('.picker-item');
      if (!item) {
        return;
      }

      const id = item.dataset.id;
      if (!id) {
        return;
      }

      if (this.onSelect) {
        await this.onSelect(id);
      } else if (this.petController && id !== this.petController.currentCharacterId) {
        await this.petController.switchCharacter(id);
      }

      this.close();
    });
  }

  open(options = {}) {
    if (this.isOpen || !this.petController) {
      return;
    }

    this.isOpen = true;
    this.onSelect = options.onSelect || null;
    this.mode = options.mode || 'switch';
    this.title = options.title || (this.mode === 'add-pet' ? '为新伙伴选择形象' : '选择你的桌面伙伴');
    this.currentId = options.currentId === undefined ? this.petController.currentCharacterId : options.currentId;

    const characters = this.petController.getCharacterOptions();
    this.element.innerHTML = `
      <div class="picker-card">
        <div class="picker-header">
          <div>
            <p class="picker-kicker">Character Library</p>
            <div class="picker-title">${this.title}</div>
          </div>
          <button class="picker-close" type="button">关闭</button>
        </div>
        <div class="picker-grid">
          ${characters.map((character) => `
            <button class="picker-item ${character.id === this.currentId ? 'active' : ''}" type="button" data-id="${character.id}">
              <div class="picker-preview" data-character="${character.id}"></div>
              <div class="picker-name">${character.name}</div>
              <div class="picker-desc">${character.description || ''}</div>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    this.element.classList.remove('hidden');
    window.dispatchEvent(new CustomEvent('character-picker:visibility', {
      detail: { visible: true }
    }));

    if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(false, { forward: true });
    }
  }

  close() {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
    this.element.classList.add('hidden');
    this.element.innerHTML = '';
    this.onSelect = null;
    this.currentId = null;
    window.dispatchEvent(new CustomEvent('character-picker:visibility', {
      detail: { visible: false }
    }));

    if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
    }
  }
}
