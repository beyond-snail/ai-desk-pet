class ChatManager {
  constructor() {
    this.messages = [];
    this.context = [];
    this.maxContextLength = 10;
    this.careSystem = null;
    this.growthSystem = null;
    this.memoryManager = null;
    this.streamCounter = 0;
    this.streamListenerBound = false;
    this.pendingStreams = new Map();
  }

  init(careSystem, growthSystem = null, memoryManager = null) {
    this.careSystem = careSystem;
    this.growthSystem = growthSystem;
    this.memoryManager = memoryManager;

    if (!this.streamListenerBound && window.electronAPI && window.electronAPI.onLlmStreamEvent) {
      this.streamListenerBound = true;
      window.electronAPI.onLlmStreamEvent((payload) => {
        const pending = this.pendingStreams.get(payload.requestId);
        if (!pending) {
          return;
        }

        if (payload.type === 'chunk') {
          pending.content += payload.chunk;
          pending.onChunk(payload.chunk);
          return;
        }

        if (payload.type === 'done') {
          this.pendingStreams.delete(payload.requestId);
          pending.resolve(pending.content);
          return;
        }

        if (payload.type === 'error') {
          this.pendingStreams.delete(payload.requestId);
          pending.reject(payload);
        }
      });
    }
  }

  buildSystemPrompt() {
    const longerChat = this.growthSystem && this.growthSystem.hasAbility('longer_chat');
    let prompt = `你是一只可爱的桌面宠物。回复要简短、温暖、可爱，不超过${longerChat ? '90' : '50'}个字。`;

    if (!this.careSystem) {
      return prompt;
    }

    const state = this.careSystem.getState();

    if (state.hunger <= 0) {
      prompt += '你现在很饿，会委婉表达想吃东西。';
    } else if (state.hunger > 80) {
      prompt += '你刚吃饱，心情很好。';
    }

    if (state.affection >= 60) {
      prompt += '你和主人很亲密，说话会撒娇一点。';
    } else if (state.affection < 20) {
      prompt += '你和主人还不太熟，说话比较礼貌。';
    }

    if (state.cleanliness < 30) {
      prompt += '你有点脏，偶尔会提到想洗澡。';
    }

    if (this.growthSystem) {
      const growthState = this.growthSystem.getState();
      prompt += `你当前等级 ${growthState.level}，成长阶段是“${growthState.stageLabel}”。`;
    }

    if (this.memoryManager && typeof this.memoryManager.getPromptContext === 'function') {
      prompt += this.memoryManager.getPromptContext();
    }

    return prompt;
  }

  async processInput(input) {
    this.addMessage('user', input);
    this.recordMemory('chat:user', { text: input.slice(0, 120) });
    const response = await this.generateResponse(input);
    this.addMessage('assistant', response);
    this.recordMemory('chat:assistant', { text: response.slice(0, 160) });

    if (this.growthSystem) {
      this.growthSystem.addInteraction('chat');
    }

    return response;
  }

  async processInputStream(input, handlers = {}) {
    this.addMessage('user', input);
    this.recordMemory('chat:user', { text: input.slice(0, 120) });

    const onStart = handlers.onStart || (() => {});
    const onChunk = handlers.onChunk || (() => {});
    const onDone = handlers.onDone || (() => {});
    const onError = handlers.onError || (() => {});

    if (!window.electronAPI || !window.electronAPI.startLlmStream) {
      const fallback = this.getMockResponse(input);
      onStart();
      onChunk(fallback);
      this.addMessage('assistant', fallback);
      if (this.growthSystem) {
        this.growthSystem.addInteraction('chat');
      }
      onDone(fallback);
      return fallback;
    }

    const requestId = `stream-${Date.now()}-${this.streamCounter++}`;
    onStart();

    try {
      const response = await new Promise((resolve, reject) => {
        this.pendingStreams.set(requestId, {
          content: '',
          onChunk,
          resolve,
          reject
        });

        window.electronAPI.startLlmStream(requestId, this.messages, {
          systemPrompt: this.buildSystemPrompt()
        });
      });

      const content = response || this.getMockResponse(input);
      this.addMessage('assistant', content);
      this.recordMemory('chat:assistant', { text: content.slice(0, 160) });
      if (this.growthSystem) {
        this.growthSystem.addInteraction('chat');
      }
      onDone(content);
      return content;
    } catch (error) {
      onError(error);

      let fallback;
      if (error.error === 'daily_limit') {
        fallback = '今天聊得够多啦，明天再来找我玩吧～';
      } else {
        fallback = this.getMockResponse(input);
      }

      onChunk(fallback);
      this.addMessage('assistant', fallback);
      this.recordMemory('chat:assistant', { text: fallback.slice(0, 160), fallback: true });
      if (this.growthSystem) {
        this.growthSystem.addInteraction('chat');
      }
      onDone(fallback);
      return fallback;
    }
  }

  addMessage(role, content) {
    this.messages.push({ role, content });
    if (this.messages.length > this.maxContextLength) {
      this.messages.shift();
    }
  }

  recordMemory(type, payload = {}) {
    if (!this.memoryManager || typeof this.memoryManager.record !== 'function') {
      return;
    }

    this.memoryManager.record(type, payload);
  }

  async generateResponse(input) {
    if (!window.electronAPI || !window.electronAPI.llmChat) {
      return this.getMockResponse(input);
    }

    try {
      const result = await window.electronAPI.llmChat(this.messages, {
        systemPrompt: this.buildSystemPrompt()
      });

      if (result.error === 'daily_limit') {
        return '今天聊得够多啦，明天再来找我玩吧～';
      }

      if (result.error) {
        console.error('LLM error:', result.message);
        return this.getMockResponse(input);
      }

      return result.content || this.getMockResponse(input);
    } catch (error) {
      console.error('Error generating response:', error);
      return this.getMockResponse(input);
    }
  }

  getMockResponse(input) {
    const responses = {
      '你好': '你好，我会一直在桌面上陪着你。',
      '你是谁': '我是你的 AI 桌面伙伴，会慢慢成长，也会照顾你的节奏。',
      '天气': '如果你配置了天气 API，我就能感知外面的天气。',
      '时间': `现在的时间是 ${new Date().toLocaleTimeString()}`,
      '日期': `今天是 ${new Date().toLocaleDateString()}`,
      '帮助': '你可以问我状态、天气、时间，也可以直接聊天。',
      '再见': '我会继续留在这里，等你回来。'
    };

    for (const [key, value] of Object.entries(responses)) {
      if (input.includes(key)) {
        return value;
      }
    }

    return '我在认真听。你也可以问我天气、时间，或者继续和我聊。';
  }

  clearContext() {
    this.messages = [];
    this.context = [];
  }

  getChatHistory() {
    return this.messages;
  }

  saveChatHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(this.messages));
  }

  loadChatHistory() {
    const history = localStorage.getItem('chatHistory');
    if (history) {
      this.messages = JSON.parse(history);
    }
  }
}
