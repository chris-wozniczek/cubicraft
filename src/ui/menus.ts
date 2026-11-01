/**
 * Menus: the main screen, the pause menu, settings and the join screen.
 *
 * The whole UI follows the house glass style — dark translucent panels,
 * soft strokes and a single cyan accent.
 */

import { escapeHtml } from './hud';

export interface MenuButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost' | 'default';
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (html !== undefined) el.innerHTML = html;
  return el;
}

export class Screen {
  readonly root: HTMLDivElement;
  protected readonly panel: HTMLDivElement;

  constructor(id: string, className = '') {
    this.root = element('div', `screen ${className}`.trim());
    this.root.id = id;
    this.panel = element('div', 'panel glass');
    this.root.appendChild(this.panel);
    document.body.appendChild(this.root);
  }

  show(): void {
    this.root.classList.add('visible');
  }

  hide(): void {
    this.root.classList.remove('visible');
  }

  get visible(): boolean {
    return this.root.classList.contains('visible');
  }
}

export class MainMenuScreen extends Screen {
  private readonly buttons = element('div', 'row');

  constructor(
    onPlay: () => void,
    onJoin: () => void,
    onSettings: () => void,
    onAvatar: () => void,
    mode?: { current: string; onPick: (mode: string) => void },
  ) {
    super('main-menu');
    this.panel.append(
      element('h1', undefined, 'CUBICRAFT'),
      element('p', 'sub', 'A voxel world for the whole family. Mine, build, survive — together, over your own Wi-Fi.'),
    );

    if (mode) {
      const modeGrid = element('div', 'grid');
      const modes: [string, string][] = [
        ['survival', 'Mine, craft and stay alive'],
        ['creative', 'Fly and build anything'],
        ['hardcore', 'One life — make it count'],
        ['adventure', 'Explore without hunger'],
        ['sandbox', 'Relaxed building, no damage'],
        ['spectator', 'Float around and watch'],
      ];
      for (const [id, blurb] of modes) {
        const card = element('div', `card${mode.current === id ? ' selected' : ''}`);
        card.innerHTML = `<div class="title">${id[0].toUpperCase()}${id.slice(1)}</div><div class="meta">${blurb}</div>`;
        card.addEventListener('click', () => {
          for (const c of modeGrid.querySelectorAll('.card')) c.classList.remove('selected');
          card.classList.add('selected');
          mode.onPick(id);
        });
        modeGrid.appendChild(card);
      }
      this.panel.append(element('h2', undefined, 'Pick a mode'), modeGrid);
    }

    this.buttons.append(
      this.button('Play', onPlay, 'primary'),
      this.button('Join a World', onJoin),
      this.button('Avatar & Kit', onAvatar),
      this.button('Settings', onSettings, 'ghost'),
    );
    this.panel.appendChild(this.buttons);

    const help = element('div');
    help.innerHTML = `
      <h2>Getting started</h2>
      <p class="small">
        To play together, one laptop runs <strong>npm start</strong> and shows a web address.
        The other laptops open that address and press <strong>Join</strong>.<br>
        Every player picks a club kit before they spawn.
      </p>`;
    this.panel.appendChild(help);
  }

  private button(label: string, onClick: () => void, variant?: 'primary' | 'ghost'): HTMLButtonElement {
    const btn = element('button', `btn ${variant ?? ''}`.trim(), label);
    btn.addEventListener('click', onClick);
    return btn;
  }
}

export class PauseScreen extends Screen {
  constructor(options: {
    onResume: () => void;
    onSettings: () => void;
    onAvatar: () => void;
    onQuit: () => void;
    onExportWorld?: () => void;
  }) {
    super('pause-menu');
    this.panel.append(
      element('h1', undefined, 'Paused'),
      element('p', 'sub', 'The world keeps running for everyone else — your session stays in the world.'),
    );

    const row = element('div', 'row');
    row.append(
      this.button('Resume', options.onResume, 'primary'),
      this.button('Avatar & Kit', options.onAvatar),
      this.button('Settings', options.onSettings),
    );
    if (options.onExportWorld) {
      row.append(this.button('Save World File', options.onExportWorld));
    }
    row.append(this.button('Quit to Menu', options.onQuit, 'ghost'));
    this.panel.appendChild(row);
  }

  private button(label: string, onClick: () => void, variant?: 'primary' | 'ghost'): HTMLButtonElement {
    const btn = element('button', `btn ${variant ?? ''}`.trim(), label);
    btn.addEventListener('click', onClick);
    return btn;
  }
}

export interface SettingsModel {
  tier: number;
  renderDistance: number;
  fov: number;
  sensitivity: number;
  masterVolume: number;
  showFps: boolean;
  dayLength: number;
}

export class SettingsScreen extends Screen {
  constructor(model: SettingsModel, onChange: (patch: Partial<SettingsModel>) => void, onBack: () => void) {
    super('settings-menu');
    this.panel.append(element('h1', undefined, 'Settings'));

    const tierRow = element('div', 'grid');
    const tiers: [string, number][] = [
      ['Lite', 0],
      ['Standard', 1],
      ['High', 2],
    ];
    for (const [label, value] of tiers) {
      const card = element('div', `card${model.tier === value ? ' selected' : ''}`);
      card.innerHTML = `<div class="title">${label}</div><div class="meta">${
        value === 0 ? 'Lightest — for older laptops' : value === 1 ? 'Balanced — recommended' : 'Best looking — needs a good GPU'
      }</div>`;
      card.addEventListener('click', () => {
        for (const c of tierRow.querySelectorAll('.card')) c.classList.remove('selected');
        card.classList.add('selected');
        onChange({ tier: value });
      });
      tierRow.appendChild(card);
    }
    this.panel.append(element('h2', undefined, 'Graphics quality'), tierRow);

    this.panel.append(
      this.slider('Field of view', model.fov, 50, 110, 1, (v) => onChange({ fov: v })),
      this.slider('Mouse sensitivity', model.sensitivity, 0.0005, 0.006, 0.0001, (v) =>
        onChange({ sensitivity: v }),
      ),
      this.slider('Render distance', model.renderDistance, 3, 16, 1, (v) => onChange({ renderDistance: v })),
      this.slider('Day length (seconds)', model.dayLength, 60, 1800, 10, (v) => onChange({ dayLength: v })),
      this.slider('Master volume', model.masterVolume, 0, 1, 0.05, (v) => onChange({ masterVolume: v })),
      this.checkbox('Show performance readout', model.showFps, (v) => onChange({ showFps: v })),
    );

    const back = element('button', 'btn primary', 'Back');
    back.addEventListener('click', onBack);
    const row = element('div', 'row');
    row.appendChild(back);
    this.panel.appendChild(row);
  }

  private slider(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void,
  ): HTMLDivElement {
    const field = element('div', 'field');
    const name = element('label', undefined, label);
    const input = element('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    const readout = element('span', 'small', String(value));
    input.addEventListener('input', () => {
      const v = Number(input.value);
      readout.textContent = step < 1 ? v.toFixed(4) : String(v);
      onChange(v);
    });
    field.append(name, input, readout);
    return field;
  }

  private checkbox(label: string, value: boolean, onChange: (value: boolean) => void): HTMLDivElement {
    const field = element('div', 'field');
    const name = element('label', undefined, label);
    const input = element('input');
    input.type = 'checkbox';
    input.checked = value;
    input.addEventListener('change', () => onChange(input.checked));
    field.append(name, input);
    return field;
  }
}

export class JoinScreen extends Screen {
  readonly urlLabel = element('div', '', '—');
  readonly codeBox: HTMLTextAreaElement;
  readonly answerBox: HTMLTextAreaElement;
  readonly status = element('div', 'small', '');
  readonly qrCanvas = element('canvas');
  private readonly answerSection: HTMLDivElement;

  constructor(options: {
    onBack: () => void;
    onJoinWithCode: (code: string) => void;
    onHost: () => void;
    onAcceptAnswer: (code: string) => void;
    getUrl: () => string;
  }) {
    super('join-menu');
    this.panel.append(
      element('h1', undefined, 'Play together'),
      element('p', 'sub', 'Everyone on the same Wi-Fi can join the same world.'),
    );

    const urlBox = element('div');
    urlBox.append(element('h2', undefined, 'This laptop’s address'), this.urlLabel);
    this.urlLabel.id = 'lan-url';
    this.panel.appendChild(urlBox);

    const qrRow = element('div', 'row');
    this.qrCanvas.width = 128;
    this.qrCanvas.height = 128;
    this.qrCanvas.style.cssText = 'background:#fff;border-radius:12px;padding:8px';
    qrRow.append(this.qrCanvas, element('div', 'small', 'Scan with a phone camera, or type the address into any browser on the Wi-Fi.'));
    this.panel.appendChild(qrRow);

    const codeSection = element('div');
    codeSection.append(element('h2', undefined, 'Join code (no server needed)'));
    this.codeBox = element('textarea');
    this.codeBox.id = 'join-code';
    this.codeBox.placeholder = 'Paste the join code here — or leave it empty to auto-join a host on this Wi-Fi';
    codeSection.appendChild(this.codeBox);
    const codeRow = element('div', 'row');
    const joinBtn = element('button', 'btn primary', 'Join with code');
    joinBtn.addEventListener('click', () => options.onJoinWithCode(this.codeBox.value));
    const hostBtn = element('button', 'btn', 'Host a new world');
    hostBtn.addEventListener('click', () => options.onHost());
    codeRow.append(joinBtn, hostBtn);
    codeSection.appendChild(codeRow);
    codeSection.appendChild(this.status);
    this.panel.appendChild(codeSection);

    // Hosts finish the handshake here: they send their code out, then paste
    // the friend's answer back. Hidden until this session is hosting.
    const answerSection = element('div');
    answerSection.append(
      element('h2', undefined, 'Hosting? Finish the handshake'),
      element('p', 'small', 'Send your code to your friend. When they reply with an answer code, paste it below.'),
    );
    this.answerBox = element('textarea');
    this.answerBox.placeholder = 'Paste your friend’s answer code here';
    answerSection.appendChild(this.answerBox);
    const answerRow = element('div', 'row');
    const acceptBtn = element('button', 'btn primary', 'Accept answer');
    acceptBtn.addEventListener('click', () => options.onAcceptAnswer(this.answerBox.value));
    answerRow.appendChild(acceptBtn);
    answerSection.appendChild(answerRow);
    answerSection.style.display = 'none';
    this.answerSection = answerSection;
    this.panel.appendChild(answerSection);

    const back = element('button', 'btn ghost', 'Back');
    back.addEventListener('click', options.onBack);
    const row = element('div', 'row');
    row.appendChild(back);
    this.panel.appendChild(row);
  }

  setUrl(url: string): void {
    this.urlLabel.textContent = url;
  }

  setStatus(text: string, danger = false): void {
    this.status.textContent = text;
    this.status.style.color = danger ? 'var(--danger)' : 'var(--muted)';
  }

  /** Show a join code for the player to copy. */
  setJoinCode(code: string): void {
    this.codeBox.value = code;
    this.codeBox.select();
  }

  /** Reveal the answer field — only the host completes the handshake. */
  showAnswerEntry(): void {
    this.answerSection.style.display = '';
  }
}

export class DeathScreen extends Screen {
  constructor(onRespawn: () => void, onQuit: () => void) {
    super('death-menu');
    this.panel.append(
      element('h1', undefined, 'You died'),
      element('p', 'sub', 'The world keeps its changes — pick up where you left off.'),
    );
    const row = element('div', 'row');
    const respawn = element('button', 'btn primary', 'Respawn');
    respawn.addEventListener('click', onRespawn);
    const quit = element('button', 'btn ghost', 'Quit to Menu');
    quit.addEventListener('click', onQuit);
    row.append(respawn, quit);
    this.panel.appendChild(row);
  }
}

export function showBanner(parent: HTMLElement, text: string, danger = false): HTMLDivElement {
  const banner = element('div', `banner${danger ? ' danger' : ''}`);
  banner.innerHTML = escapeHtml(text);
  parent.prepend(banner);
  return banner;
}
