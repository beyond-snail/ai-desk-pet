class VoiceManager {
  constructor() {
    this.petController = null;
    this.inputField = null;
    this.triggerButton = null;
    this.submitInput = null;
    this.onStateChange = null;
    this.recognition = null;
    this.isListening = false;
    this.replyEnabled = true;
  }

  async init(options = {}) {
    this.petController = options.petController || null;
    this.inputField = options.inputField || null;
    this.triggerButton = options.triggerButton || null;
    this.submitInput = options.submitInput || null;
    this.onStateChange = options.onStateChange || (() => {});
    this.replyEnabled = await this.getValue('voiceReplyEnabled', true);
    this.setupRecognition();
    this.bindEvents();
    this.updateTriggerState();
  }

  setupRecognition() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      return;
    }

    this.recognition = new Recognition();
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.updateTriggerState();
      this.onStateChange({ type: 'listening', supported: true });
      if (this.petController) {
        this.petController.playTemporaryAnimation('listening', 2400);
      }
    };

    this.recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join('').trim();
      if (!transcript || !this.inputField) {
        return;
      }

      this.inputField.value = transcript;
      if (event.results[event.results.length - 1].isFinal && typeof this.submitInput === 'function') {
        this.submitInput();
      }
    };

    this.recognition.onerror = (event) => {
      const err = event.error || 'unknown';
      const errorType = (err === 'not-allowed' || err === 'service-not-allowed') ? 'permission' : 'error';
      this.onStateChange({ type: errorType, error: err, supported: true });
      this.stopListening();
    };

    this.recognition.onend = () => {
      this.stopListening();
    };
  }

  bindEvents() {
    if (!this.triggerButton) {
      return;
    }

    this.triggerButton.addEventListener('click', () => {
      if (!this.recognition) {
        this.onStateChange({ type: 'unsupported', supported: false });
        return;
      }

      this.toggleListening();
    });
  }

  toggleListening() {
    if (!this.recognition) {
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
      return;
    }

    try {
      this.recognition.start();
    } catch (_error) {
      this.onStateChange({ type: 'error', error: 'restart_failed', supported: true });
      this.stopListening();
    }
  }

  startListening() {
    if (!this.recognition || this.isListening) {
      return false;
    }

    try {
      this.recognition.start();
      return true;
    } catch (_error) {
      this.onStateChange({ type: 'error', error: 'restart_failed', supported: true });
      this.stopListening();
      return false;
    }
  }

  stopListening() {
    const wasListening = this.isListening;
    this.isListening = false;
    this.updateTriggerState();
    if (wasListening) {
      this.onStateChange({ type: 'idle', supported: Boolean(this.recognition) });
    }
  }

  updateTriggerState() {
    if (!this.triggerButton) {
      return;
    }

    const supported = Boolean(this.recognition);
    this.triggerButton.disabled = !supported;
    this.triggerButton.dataset.listening = this.isListening ? 'true' : 'false';
    this.triggerButton.title = supported
      ? (this.isListening ? '停止语音输入' : '开始语音输入')
      : '当前环境不支持语音识别';
  }

  async setReplyEnabled(enabled) {
    this.replyEnabled = Boolean(enabled);
    await this.setValue('voiceReplyEnabled', this.replyEnabled);
  }

  speak(text) {
    if (!this.replyEnabled || !window.speechSynthesis || !text) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.pitch = 1.2;
    utterance.rate = 1.02;

    const zhVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang && voice.lang.toLowerCase().startsWith('zh'));
    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
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
}
