export class VoiceService {
  constructor() {
    this.listening = false;
    this.lastSpokenText = '';
  }

  startListening() {
    this.listening = true;
    return { listening: this.listening };
  }

  stopListening() {
    this.listening = false;
    return { listening: this.listening };
  }

  speak(text) {
    this.lastSpokenText = String(text || '');
    return { spoken: this.lastSpokenText.length > 0, length: this.lastSpokenText.length };
  }

  snapshot() {
    return {
      listening: this.listening,
      lastSpokenText: this.lastSpokenText
    };
  }
}
