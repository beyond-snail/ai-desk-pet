class WeatherService {
  constructor() {
    this.currentWeather = null;
    this.updateInterval = null;
    this.apiKey = null;
    this.city = null;
    this.onUpdate = null;
  }

  async init() {
    await this.loadSettings();
    await this.refresh();
  }

  async loadSettings() {
    if (window.electronAPI && window.electronAPI.storeGet) {
      this.apiKey = await window.electronAPI.storeGet('weatherApiKey');
      this.city = await window.electronAPI.storeGet('weatherCity');
      return;
    }

    this.apiKey = localStorage.getItem('weatherApiKey');
    this.city = localStorage.getItem('weatherCity');
  }

  async refresh() {
    await this.loadSettings();
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    await this.fetchWeather();
    this.updateInterval = setInterval(() => {
      this.fetchWeather();
    }, 15 * 60 * 1000);
  }

  async fetchWeather() {
    const dayPart = this.getDayPart();
    let fetched = false;

    if (this.apiKey && this.city) {
      fetched = await this.fetchHeWeather();
    }

    if (!fetched) {
      fetched = await this.fetchBuiltInWeather();
    }

    if (!fetched) {
      this.currentWeather = null;
    }

    const payload = {
      currentWeather: this.currentWeather,
      moodEffect: this.getWeatherMoodEffect(dayPart),
      visualEffect: this.getWeatherVisualEffect(dayPart),
      dayPart
    };

    this.emitUpdate(payload);
    return payload;
  }

  async fetchHeWeather() {
    try {
      const response = await fetch(`https://devapi.qweather.com/v7/weather/now?location=${encodeURIComponent(this.city)}&key=${encodeURIComponent(this.apiKey)}`);
      const data = await response.json();

      if (data.code === '200' && data.now) {
        this.currentWeather = {
          temp: Number.parseInt(data.now.temp, 10),
          text: data.now.text,
          icon: data.now.icon,
          humidity: Number.parseInt(data.now.humidity, 10),
          windScale: Number.parseInt(data.now.windScale, 10),
          condition: this.inferConditionFromText(data.now.text),
          city: this.city || '',
          source: 'qweather'
        };
        return true;
      }
    } catch (_error) {
    }

    return false;
  }

  async fetchBuiltInWeather() {
    try {
      const location = await this.getLocation();
      if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
        return false;
      }

      const weatherResp = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(location.lat)}` +
        `&longitude=${encodeURIComponent(location.lon)}` +
        '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m' +
        '&wind_speed_unit=ms'
      );
      const data = await weatherResp.json();
      if (!weatherResp.ok || !data || !data.current) {
        return false;
      }

      const current = data.current;
      const weatherCode = Number(current.weather_code);
      const condition = this.mapWeatherCode(weatherCode);
      this.currentWeather = {
        temp: Math.round(Number(current.temperature_2m) || 0),
        text: this.mapWeatherText(weatherCode),
        icon: String(weatherCode),
        humidity: Math.round(Number(current.relative_humidity_2m) || 0),
        windScale: this.toWindScale(Number(current.wind_speed_10m) || 0),
        condition,
        city: location.city || '',
        source: 'open-meteo'
      };
      return true;
    } catch (_error) {
      return false;
    }
  }

  async getLocation() {
    if (window.electronAPI && window.electronAPI.getWeatherLocation) {
      return window.electronAPI.getWeatherLocation();
    }

    try {
      const response = await fetch('http://ip-api.com/json/?fields=status,message,lat,lon,city,country');
      const payload = await response.json();
      if (!response.ok || payload.status !== 'success') {
        return null;
      }

      return {
        lat: payload.lat,
        lon: payload.lon,
        city: payload.city || '',
        country: payload.country || ''
      };
    } catch (_error) {
      return null;
    }
  }

  getDayPart() {
    const hour = new Date().getHours();
    if (hour >= 20 || hour < 6) {
      return 'night';
    }
    if (hour < 11) {
      return 'morning';
    }
    if (hour < 18) {
      return 'day';
    }
    return 'evening';
  }

  mapWeatherCode(code) {
    if (code === 0) {
      return 'sunny';
    }
    if (code <= 3) {
      return 'cloudy';
    }
    if (code <= 48) {
      return 'foggy';
    }
    if (code <= 67) {
      return 'rainy';
    }
    if (code <= 77) {
      return 'snowy';
    }
    if (code <= 82) {
      return 'rainy';
    }
    if (code <= 99) {
      return 'stormy';
    }
    return 'cloudy';
  }

  mapWeatherText(code) {
    const condition = this.mapWeatherCode(code);
    const textMap = {
      sunny: '晴',
      cloudy: '多云',
      foggy: '雾',
      rainy: '雨',
      snowy: '雪',
      stormy: '雷暴'
    };
    return textMap[condition] || '多云';
  }

  inferConditionFromText(text) {
    const normalized = String(text || '');
    if (normalized.includes('雨')) {
      return 'rainy';
    }
    if (normalized.includes('雪')) {
      return 'snowy';
    }
    if (normalized.includes('雾') || normalized.includes('霾')) {
      return 'foggy';
    }
    if (normalized.includes('晴')) {
      return 'sunny';
    }
    if (normalized.includes('雷')) {
      return 'stormy';
    }
    return 'cloudy';
  }

  toWindScale(ms) {
    if (ms < 0.3) {
      return 0;
    }
    if (ms < 1.6) {
      return 1;
    }
    if (ms < 3.4) {
      return 2;
    }
    if (ms < 5.5) {
      return 3;
    }
    if (ms < 8.0) {
      return 4;
    }
    if (ms < 10.8) {
      return 5;
    }
    if (ms < 13.9) {
      return 6;
    }
    if (ms < 17.2) {
      return 7;
    }
    return 8;
  }

  getWeatherMoodEffect(dayPart = this.getDayPart()) {
    if (!this.currentWeather) {
      return dayPart === 'night' ? { mood: 'sleepy', reason: '夜深了' } : null;
    }

    const condition = this.currentWeather.condition || this.inferConditionFromText(this.currentWeather.text);
    const temp = Number(this.currentWeather.temp) || 0;

    if (dayPart === 'night') {
      return { mood: 'sleepy', reason: '夜深了' };
    }

    if (condition === 'sunny' && temp >= 20 && temp <= 28) {
      return { mood: 'happy', reason: '天气真好' };
    }
    if (condition === 'rainy') {
      return { mood: 'sleepy', reason: '下雨了，想睡觉' };
    }
    if (condition === 'snowy') {
      return { mood: 'excited', reason: '下雪啦' };
    }
    if (temp > 35 || temp < 5) {
      return { mood: 'sad', reason: temp > 35 ? '好热啊' : '好冷啊' };
    }

    return null;
  }

  getWeatherVisualEffect(dayPart = this.getDayPart()) {
    if (dayPart === 'night') {
      return 'night';
    }

    if (!this.currentWeather) {
      return null;
    }

    const condition = this.currentWeather.condition || this.inferConditionFromText(this.currentWeather.text);
    if (condition === 'rainy' || condition === 'stormy') {
      return 'rain';
    }
    if (condition === 'snowy') {
      return 'snow';
    }
    if (condition === 'foggy') {
      return 'fog';
    }
    if (condition === 'sunny') {
      return 'sunny';
    }
    return 'cloudy';
  }

  emitUpdate(payload) {
    if (this.onUpdate) {
      this.onUpdate(payload);
    }

    window.dispatchEvent(new CustomEvent('weather:updated', {
      detail: payload
    }));
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}
