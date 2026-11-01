/**
 * The avatar picker.
 *
 * A live 3D preview of the player's boxy model wearing the chosen club kit.
 * Kit colours, the shirt number and the player's name all update the
 * preview instantly, and the result travels to other peers as a small
 * description rather than a texture.
 */

import * as THREE from 'three';

import type { AvatarSpec } from '../core/types';
import { KITS, getKit, SKIN_TONES, HAIR_COLORS } from '../assets/kits';
import { AvatarModel } from '../assets/avatarModel';

export class AvatarPicker {
  readonly root: HTMLDivElement;
  private readonly previewCanvas = document.createElement('canvas');
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly avatar: AvatarModel;
  private readonly spec: AvatarSpec;
  private rafId = 0;
  private angle = 0;

  constructor(spec: AvatarSpec, onChange: (spec: AvatarSpec) => void, onBack: () => void) {
    this.spec = { ...spec };
    this.root = document.createElement('div');
    this.root.className = 'screen visible';
    this.root.id = 'avatar-menu';

    const panel = document.createElement('div');
    panel.className = 'panel glass';
    panel.innerHTML = `
      <h1>Your player</h1>
      <p class="sub">Pick a club kit, a number and a name. Everyone in the world sees it.</p>`;

    // --- preview ---------------------------------------------------------
    this.previewCanvas.id = 'avatar-preview';
    this.previewCanvas.style.width = '100%';
    this.previewCanvas.style.height = '320px';
    this.previewCanvas.style.display = 'block';
    panel.appendChild(this.previewCanvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.previewCanvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
    this.camera.position.set(0, 1.0, 4.4);
    this.camera.lookAt(0, 1.0, 0);

    this.avatar = new AvatarModel(this.spec);
    this.scene.add(this.avatar.group);

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.5, 4, 3);
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0xbdd7ff, 0x40382c, 1.0));

    // --- kit cards -------------------------------------------------------
    panel.appendChild(this.sectionTitle('Kit'));
    const kitGrid = document.createElement('div');
    kitGrid.className = 'grid';
    for (const kit of KITS) {
      const card = document.createElement('div');
      card.className = `card${kit.id === this.spec.kit ? ' selected' : ''}`;
      const swatch = document.createElement('div');
      swatch.className = 'swatch';
      swatch.style.background = `linear-gradient(90deg, ${kit.palette.base} 0 40%, ${kit.palette.alt} 40% 70%, ${kit.palette.accent} 70% 100%)`;
      card.append(swatch);
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = kit.name;
      card.appendChild(title);
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = kit.club;
      card.appendChild(meta);
      card.addEventListener('click', () => {
        this.spec.kit = kit.id;
        for (const c of kitGrid.querySelectorAll('.card')) c.classList.remove('selected');
        card.classList.add('selected');
        this.refresh();
        onChange({ ...this.spec });
      });
      kitGrid.appendChild(card);
    }
    panel.appendChild(kitGrid);

    // --- number ----------------------------------------------------------
    panel.appendChild(this.sectionTitle('Shirt number'));
    const numberRow = document.createElement('div');
    numberRow.className = 'field';
    const numberLabel = document.createElement('label');
    numberLabel.textContent = 'Number';
    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = '1';
    numberInput.max = '99';
    numberInput.value = String(this.spec.number);
    numberInput.addEventListener('input', () => {
      this.spec.number = Math.max(1, Math.min(99, Number(numberInput.value) || 1));
      this.refresh();
      onChange({ ...this.spec });
    });
    numberRow.append(numberLabel, numberInput);
    panel.appendChild(numberRow);

    // --- name ------------------------------------------------------------
    panel.appendChild(this.sectionTitle('Name'));
    const nameRow = document.createElement('div');
    nameRow.className = 'field';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Player name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.maxLength = 12;
    nameInput.value = this.spec.name;
    nameInput.addEventListener('input', () => {
      this.spec.name = nameInput.value.slice(0, 12);
      this.refresh();
      onChange({ ...this.spec });
    });
    nameRow.append(nameLabel, nameInput);
    panel.appendChild(nameRow);

    // --- skin tone -------------------------------------------------------
    panel.appendChild(this.sectionTitle('Skin tone'));
    const toneRow = document.createElement('div');
    toneRow.className = 'row';
    SKIN_TONES.forEach((tone, index) => {
      const swatch = document.createElement('button');
      swatch.className = 'btn';
      swatch.style.cssText = `background:${tone};width:44px;height:36px;padding:0;border-radius:9px`;
      if (index === this.spec.skinTone) swatch.style.borderColor = 'var(--accent)';
      swatch.addEventListener('click', () => {
        this.spec.skinTone = index;
        for (const b of toneRow.querySelectorAll('button')) b.style.borderColor = 'rgba(255,255,255,0.28)';
        swatch.style.borderColor = 'var(--accent)';
        this.refresh();
        onChange({ ...this.spec });
      });
      toneRow.appendChild(swatch);
    });
    panel.appendChild(toneRow);

    // --- hair colour -----------------------------------------------------
    panel.appendChild(this.sectionTitle('Hair colour'));
    const hairRow = document.createElement('div');
    hairRow.className = 'row';
    HAIR_COLORS.forEach((colour, index) => {
      const swatch = document.createElement('button');
      swatch.className = 'btn';
      swatch.style.cssText = `background:${colour};width:44px;height:36px;padding:0;border-radius:9px`;
      if (index === this.spec.hairColor) swatch.style.borderColor = 'var(--accent)';
      swatch.addEventListener('click', () => {
        this.spec.hairColor = index;
        for (const b of hairRow.querySelectorAll('button')) b.style.borderColor = 'rgba(255,255,255,0.28)';
        swatch.style.borderColor = 'var(--accent)';
        this.refresh();
        onChange({ ...this.spec });
      });
      hairRow.appendChild(swatch);
    });
    panel.appendChild(hairRow);

    // --- done ------------------------------------------------------------
    const done = document.createElement('button');
    done.className = 'btn primary';
    done.textContent = 'Done';
    done.addEventListener('click', () => {
      this.stop();
      onBack();
    });
    const row = document.createElement('div');
    row.className = 'row';
    row.appendChild(done);
    panel.appendChild(row);

    this.root.appendChild(panel);
    document.body.appendChild(this.root);
    this.start();
  }

  private sectionTitle(text: string): HTMLElement {
    const h = document.createElement('h2');
    h.textContent = text;
    return h;
  }

  /** Re-skin the model from the current spec. */
  private refresh(): void {
    this.avatar.setSpec(this.spec);
  }

  private start(): void {
    // The canvas size is only known after layout, so watch it rather than
    // trusting a single measurement.
    const observer = new ResizeObserver(() => this.resize());
    observer.observe(this.previewCanvas);
    this.resize();

    const frame = () => {
      this.rafId = requestAnimationFrame(frame);
      this.angle += 0.008;
      this.avatar.group.rotation.y = this.angle;
      this.renderer.render(this.scene, this.camera);
    };
    frame();
  }

  private resize(): void {
    const width = this.previewCanvas.clientWidth || 320;
    const height = this.previewCanvas.clientHeight || 320;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  stop(): void {
    cancelAnimationFrame(this.rafId);
    this.avatar.dispose();
    this.renderer.dispose();
    this.root.remove();
  }
}

/** A short human-readable description of a kit, used in the lobby. */
export function describeKit(kitId: string): string {
  return getKit(kitId).name;
}
