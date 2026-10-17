// ============ Input keyboard dengan state & event sekali tekan ============

export const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space',
  'ShiftLeft', 'ShiftRight',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
  'KeyN', 'KeyR', 'KeyE', 'KeyF', 'Escape', 'Enter',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export class InputManager {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private handlers = new Map<string, Array<() => void>>();
  private active: () => boolean;

  constructor(active: () => boolean) {
    this.active = active;
    window.addEventListener('keydown', (e) => {
      const isEscape = e.code === 'Escape';
      if (!this.active() && !isEscape) return;
      if (GAME_KEYS.has(e.code)) {
        if (!this.down.has(e.code)) {
          this.pressed.add(e.code);
          this.handlers.get(e.code)?.forEach(fn => fn());
        }
        this.down.add(e.code);
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  consumePressed(code: string): boolean {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  on(code: string, fn: () => void): void {
    const arr = this.handlers.get(code) ?? [];
    arr.push(fn);
    this.handlers.set(code, arr);
  }

  clearPressed(): void {
    this.pressed.clear();
  }

  forward(): boolean { return this.isDown('KeyW') || this.isDown('ArrowUp'); }
  back(): boolean { return this.isDown('KeyS') || this.isDown('ArrowDown'); }
  left(): boolean { return this.isDown('KeyA') || this.isDown('ArrowLeft'); }
  right(): boolean { return this.isDown('KeyD') || this.isDown('ArrowRight'); }
  clutch(): boolean { return this.isDown('ShiftLeft') || this.isDown('ShiftRight'); }
  handbrake(): boolean { return this.isDown('Space'); }
}

