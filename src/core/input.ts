/**
 * Keyboard + mouse input.
 *
 * Laptops only (per the brief), so this is keyboard + pointer-lock mouse with
 * no touch handling.
 */

export interface PointerState {
  dx: number;
  dy: number;
  wheel: number;
  left: boolean;
  right: boolean;
}

export class InputManager {
  private keys = new Set<string>();
  private pressedThisTick = new Set<string>();
  private releasedThisTick = new Set<string>();
  private mouseButtons = new Set<number>();

  readonly pointer: PointerState = { dx: 0, dy: 0, wheel: 0, left: false, right: false };
  /** True while the pointer is locked to the canvas. */
  pointerLocked = false;
  /** Called when a hotbar slot is selected via number keys. */
  onHotbar: (slot: number) => void = () => {};
  /** Called on any key press (for chat/menus). */
  onKey: (code: string, event: KeyboardEvent) => void = () => {};
  /** When true, gameplay keys are ignored (menu open). */
  suspended = false;

  private readonly target: HTMLElement;

  constructor(target: HTMLElement) {
    this.target = target;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    target.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    target.addEventListener('wheel', this.handleWheel, { passive: false });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', this.handlePointerLock);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.keys.add(e.code);
    this.pressedThisTick.add(e.code);
    this.onKey(e.code, e);
    if (!this.suspended && /^Digit[1-9]$/.test(e.code)) {
      this.onHotbar(Number(e.code.slice(5)) - 1);
    }
    // Stop the browser scrolling / quick-finding while playing.
    if (!this.suspended && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Slash'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    this.releasedThisTick.add(e.code);
  };

  private handleBlur = () => {
    this.keys.clear();
    this.mouseButtons.clear();
    this.pointer.left = false;
    this.pointer.right = false;
  };

  private handleMouseDown = (e: MouseEvent) => {
    this.mouseButtons.add(e.button);
    if (e.button === 0) this.pointer.left = true;
    if (e.button === 2) this.pointer.right = true;
  };

  private handleMouseUp = (e: MouseEvent) => {
    this.mouseButtons.delete(e.button);
    if (e.button === 0) this.pointer.left = false;
    if (e.button === 2) this.pointer.right = false;
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.pointerLocked) {
      this.pointer.dx += e.movementX;
      this.pointer.dy += e.movementY;
      return;
    }
    // Fallback when pointer lock is unavailable (iframes, remote sessions):
    // holding the left button drags the view around.
    if (this.pointer.left && !this.suspended) {
      this.pointer.dx += e.movementX;
      this.pointer.dy += e.movementY;
    }
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.suspended) return;
    e.preventDefault();
    this.pointer.wheel += Math.sign(e.deltaY);
  };

  private handlePointerLock = () => {
    this.pointerLocked = document.pointerLockElement === this.target;
    if (!this.pointerLocked) {
      this.pointer.left = false;
      this.pointer.right = false;
    }
  };

  requestPointerLock(): void {
    if (!this.pointerLocked) {
      const result = this.target.requestPointerLock() as unknown as Promise<void> | undefined;
      if (result && typeof result.catch === 'function') result.catch(() => {});
    }
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressedThisTick.has(code);
  }

  wasReleased(code: string): boolean {
    return this.releasedThisTick.has(code);
  }

  isMouseDown(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  /** Consume per-frame edge state and pointer deltas. */
  endFrame(): void {
    this.pressedThisTick.clear();
    this.releasedThisTick.clear();
    this.pointer.dx = 0;
    this.pointer.dy = 0;
    this.pointer.wheel = 0;
  }
}
