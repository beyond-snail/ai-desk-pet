export class GodotWindowController {
  constructor() {
    this.visible = false;
    this.clickThrough = true;
    this.interactiveRegions = [];
    this.lastAction = 'none';
  }

  show() {
    this.visible = true;
    this.lastAction = 'show';
  }

  hide() {
    this.visible = false;
    this.lastAction = 'hide';
  }

  setInteractiveRegions(regions) {
    this.interactiveRegions = Array.isArray(regions) ? regions : [];
    this.clickThrough = this.interactiveRegions.length === 0;
    this.lastAction = 'set_regions';
  }

  snapshot() {
    return {
      visible: this.visible,
      clickThrough: this.clickThrough,
      interactiveRegions: this.interactiveRegions,
      lastAction: this.lastAction
    };
  }
}
