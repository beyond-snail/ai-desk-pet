class CommandManager {
  constructor() {
    this.commandAliases = {
      '打开': 'open',
      'open': 'open',
      '关闭': 'close',
      'close': 'close',
      '搜索': 'search',
      'search': 'search',
      '提醒': 'reminder',
      'reminder': 'reminder',
      '天气': 'weather',
      'weather': 'weather',
      '时间': 'time',
      'time': 'time',
      '日期': 'date',
      'date': 'date',
      '状态': 'status',
      'status': 'status',
      '帮助': 'help',
      'help': 'help',
      '专注': 'pomodoro',
      '番茄钟': 'pomodoro',
      'pomodoro': 'pomodoro',
      'focus': 'pomodoro',
      '停止专注': 'pomodoro-stop',
      '取消番茄钟': 'pomodoro-stop',
      'stop-focus': 'pomodoro-stop',
      '专注报告': 'focus-report',
      'focus-report': 'focus-report'
    };

    this.pomodoroCommand = this.pomodoroCommand.bind(this);
    this.pomodoroStopCommand = this.pomodoroStopCommand.bind(this);
    this.focusReportCommand = this.focusReportCommand.bind(this);

    this.commands = {
      open: this.openCommand,
      close: this.closeCommand,
      search: this.searchCommand,
      reminder: this.reminderCommand,
      weather: this.weatherCommand,
      time: this.timeCommand,
      date: this.dateCommand,
      status: this.statusCommand,
      help: this.helpCommand,
      pomodoro: this.pomodoroCommand,
      'pomodoro-stop': this.pomodoroStopCommand,
      'focus-report': this.focusReportCommand
    };
  }

  init(pomodoroTimer, petController = null, growthSystem = null, weatherService = null) {
    this.pomodoroTimer = pomodoroTimer;
    this.petController = petController;
    this.growthSystem = growthSystem;
    this.weatherService = weatherService;
  }

  async processCommand(command, args) {
    if (this.commands[command]) {
      return this.commands[command].call(this, args);
    }
    return '未知命令。输入 "帮助" 查看可用命令。';
  }

  async openCommand(args) {
    if (!args || args.length === 0) {
      return '请指定要打开的应用或文件。';
    }
    return `正在打开 ${args.join(' ')}...`;
  }

  async closeCommand(args) {
    if (!args || args.length === 0) {
      return '请指定要关闭的应用。';
    }
    return `正在关闭 ${args.join(' ')}...`;
  }

  async searchCommand(args) {
    if (!args || args.length === 0) {
      return '请指定要搜索的内容。';
    }
    return `正在搜索 "${args.join(' ')}"...`;
  }

  async reminderCommand(args) {
    if (!args || args.length === 0) {
      return '请指定提醒内容和时间。';
    }
    return `已设置提醒: ${args.join(' ')}`;
  }

  async weatherCommand() {
    if (!this.weatherService || !this.weatherService.currentWeather) {
      return '还没有天气数据，去设置里填入天气 API Key 和城市后我就能感知天气了。';
    }

    const weather = this.weatherService.currentWeather;
    return `现在是 ${weather.text}，${weather.temp}°C，湿度 ${weather.humidity}% 。`;
  }

  async timeCommand() {
    return `当前时间：${new Date().toLocaleTimeString()}`;
  }

  async dateCommand() {
    return `当前日期：${new Date().toLocaleDateString()}`;
  }

  async statusCommand() {
    const parts = [];

    if (this.petController) {
      const status = this.petController.getStatusSummary();
      if (status) {
        parts.push(status);
      }
    }

    if (this.pomodoroTimer) {
      const pomodoroStatus = this.pomodoroTimer.getStatus();
      if (pomodoroStatus) {
        parts.push(pomodoroStatus);
      }

      const focusSummary = this.pomodoroTimer.getFocusStatsSummary();
      if (focusSummary) {
        parts.push(focusSummary);
      }
    }

    if (this.growthSystem) {
      const growth = this.growthSystem.getState();
      parts.push(`成长值 ${growth.growthPoints}，下一级进度 ${(growth.progress * 100).toFixed(0)}%`);
    }

    return parts.length > 0 ? parts.join('；') : '我现在状态稳定，正在陪着你。';
  }

  async helpCommand() {
    return `可用命令：
- 打开 [应用/文件]：打开指定的应用或文件
- 关闭 [应用]：关闭指定的应用
- 搜索 [内容]：搜索指定内容
- 提醒 [内容]：设置提醒
- 天气：查询当前天气
- 时间：显示当前时间
- 日期：显示当前日期
- 状态：查看宠物当前状态
- 专注 [分钟]：启动番茄钟
- 停止专注：取消番茄钟
- 专注报告：查看今日/本周专注统计
- 帮助：显示此帮助信息`;
  }

  async pomodoroCommand(args) {
    if (!this.pomodoroTimer) {
      return '专注模式暂时不可用。';
    }

    const minutes = args && args[0] ? parseInt(args[0], 10) : 25;
    if (Number.isNaN(minutes) || minutes < 1 || minutes > 120) {
      return '请输入 1-120 之间的分钟数。';
    }

    return this.pomodoroTimer.start(minutes);
  }

  async pomodoroStopCommand() {
    if (!this.pomodoroTimer) {
      return '专注模式暂时不可用。';
    }

    return this.pomodoroTimer.stop();
  }

  async focusReportCommand() {
    if (!this.pomodoroTimer) {
      return '专注模式暂时不可用。';
    }

    return this.pomodoroTimer.getFocusStatsSummary() || '还没有专注统计数据。';
  }

  parseCommand(input) {
    const parts = input.trim().split(/\s+/);
    const rawCommand = parts[0];
    const command = this.commandAliases[rawCommand.toLowerCase()] || this.commandAliases[rawCommand] || rawCommand.toLowerCase();
    const args = parts.slice(1);
    return { command, args };
  }

  isCommand(input) {
    const parts = input.trim().split(/\s+/);
    const rawCommand = parts[0];
    const command = this.commandAliases[rawCommand.toLowerCase()] || this.commandAliases[rawCommand];
    return command !== undefined && this.commands[command] !== undefined;
  }
}
