/**
 * Cubicraft — bootstrap.
 *
 * Wires the content registry, the game, the menus and the multiplayer
 * screens together, then hands control to the player.
 */

import './ui/styles.css';

import { Game } from './game/game';
import { initContent, validateContent } from './content';
import { registerExtrasItems } from './game/extrasItems';
import { MultiplayerSession } from './game/multiplayer';
import { QUALITY_PROFILES, saveSettings } from './core/settings';
import { log } from './core/log';
import type { AvatarSpec, GameMode } from './core/types';
import {
  DeathScreen,
  JoinScreen,
  MainMenuScreen,
  PauseScreen,
  SettingsScreen,
} from './ui/menus';
import { AvatarPicker } from './ui/avatarPicker';

const container = document.getElementById('app')!;
const loading = document.getElementById('loading')!;

const storedAvatar: AvatarSpec = (() => {
  try {
    const raw = localStorage.getItem('cubicraft.avatar');
    if (raw) return JSON.parse(raw) as AvatarSpec;
  } catch {
    /* ignore */
  }
  return {
    kit: 'rm25',
    skinTone: 2,
    hair: 0,
    hairColor: 0,
    name: 'Player',
    number: 10,
  };
})();

function currentUrl(): string {
  return window.location.origin;
}

/**
 * The optional pairing relay served by `npm run lan` (`tools/launcher.mjs
 * --pair-relay`). When it is there the join code travels by itself; when it
 * is not (dev server, plain `npm start`) everything falls back to the manual
 * copy-paste codes.
 */
const relay = {
  async poll(): Promise<{ offer: string | null; answer: string | null } | null> {
    try {
      const res = await fetch('/pair/poll');
      if (!res.ok) return null;
      const data = (await res.json()) as { offer?: string | null; answer?: string | null };
      if (typeof data !== 'object' || data === null || !('offer' in data)) return null;
      return { offer: data.offer ?? null, answer: data.answer ?? null };
    } catch {
      return null;
    }
  },
  async post(path: string, body: string): Promise<boolean> {
    try {
      const res = await fetch(path, { method: 'POST', body });
      return res.ok;
    } catch {
      return false;
    }
  },
};

async function bootstrap(): Promise<void> {
  // The extra items are registered before the content set freezes.
  registerExtrasItems();
  initContent();
  const report = validateContent();
  if (!report.ok) {
    log.warn('[content] validation issues:\n' + report.format());
  } else {
    log.info(`[content] ${report.warnings.length} warnings`);
  }

  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get('mode');
  const mode: GameMode =
    requestedMode === 'creative' ||
    requestedMode === 'survival' ||
    requestedMode === 'adventure' ||
    requestedMode === 'spectator' ||
    requestedMode === 'hardcore' ||
    requestedMode === 'sandbox'
      ? requestedMode
      : 'survival';

  const game = new Game({
    container,
    mode,
    name: storedAvatar.name,
    avatar: storedAvatar,
  });

  // `?y=120` drops the player in at a given height, which makes it easy to
  // look over the landscape while debugging.
  const startY = Number(params.get('y'));
  if (Number.isFinite(startY) && startY > 0) {
    game.player.y = startY;
    game.spawnAtHeight = false;
  }

  // --- Menus ------------------------------------------------------------
  const mainMenu = new MainMenuScreen(
    () => {
      mainMenu.hide();
      game.start();
      game.setPlaying(true);
    },
    () => {
      mainMenu.hide();
      joinScreen.show();
      joinScreen.setUrl(currentUrl());
    },
    () => {
      mainMenu.hide();
      settingsScreen.show();
    },
    () => {
      mainMenu.hide();
      openAvatarPicker(() => mainMenu.show());
    },
    { current: mode, onPick: (picked) => game.setMode(picked as GameMode) },
  );
  mainMenu.show();

  const pauseMenu = new PauseScreen({
    onResume: () => {
      pauseMenu.hide();
      game.setPlaying(true);
    },
    onSettings: () => {
      pauseMenu.hide();
      settingsScreen.show();
    },
    onAvatar: () => {
      pauseMenu.hide();
      openAvatarPicker(() => pauseMenu.show());
    },
    onQuit: () => {
      pauseMenu.hide();
      game.setPlaying(false);
      game.stop();
      mainMenu.show();
    },
  });

  const settingsScreen = new SettingsScreen(
    {
      tier: game.settings.tier,
      renderDistance: game.settings.renderDistanceOverride || QUALITY_PROFILES[game.settings.tier].renderDistance,
      fov: game.settings.fov,
      sensitivity: game.settings.mouseSensitivity,
      masterVolume: game.settings.masterVolume,
      showFps: game.settings.showFps,
      dayLength: game.settings.dayLengthSeconds,
    },
    (patch) => {
      if (patch.tier !== undefined) game.settings.tier = patch.tier as 0 | 1 | 2;
      if (patch.renderDistance !== undefined) {
        game.settings.renderDistanceOverride = patch.renderDistance;
        game.chunkManager.setRenderDistance(patch.renderDistance);
      }
      if (patch.fov !== undefined) {
        game.settings.fov = patch.fov;
        game.camera.fov = patch.fov;
        game.camera.updateProjectionMatrix();
      }
      if (patch.sensitivity !== undefined) game.settings.mouseSensitivity = patch.sensitivity;
      if (patch.masterVolume !== undefined) game.settings.masterVolume = patch.masterVolume;
      if (patch.showFps !== undefined) game.settings.showFps = patch.showFps;
      if (patch.dayLength !== undefined) game.settings.dayLengthSeconds = patch.dayLength;
      saveSettings(game.settings);
    },
    () => {
      settingsScreen.hide();
      if (game.playing) pauseMenu.show();
      else mainMenu.show();
    },
  );

  const joinScreen = new JoinScreen({
    getUrl: currentUrl,
    onBack: () => {
      joinScreen.hide();
      mainMenu.show();
    },
    onHost: async () => {
      const session = new MultiplayerSession(game, true, (state) => {
        if (state === 'connected') joinScreen.setStatus('Connected — your friend is in your world!');
        if (state === 'failed') joinScreen.setStatus(session.error ?? 'The connection failed.', true);
      });
      game.multiplayer = session;
      try {
        const pack = await session.createJoinPack();
        joinScreen.setJoinCode(pack);
        joinScreen.showAnswerEntry();
        // When the pair relay is up the code travels by itself — post the
        // offer and watch for the answer coming back.
        const relayUp = await relay.post('/pair/reset', '');
        const posted = relayUp && (await relay.post('/pair/offer', pack));
        if (posted) {
          joinScreen.setStatus(
            'Hosting — your friend just opens Join a World and presses Join with an empty box. No code needed.',
          );
          const timer = window.setInterval(() => {
            if (
              !joinScreen.visible ||
              session.peer.currentState === 'connected' ||
              session.peer.currentState === 'failed' ||
              session.peer.currentState === 'closed'
            ) {
              window.clearInterval(timer);
              return;
            }
            void (async () => {
              const data = await relay.poll();
              if (!data?.answer) return;
              window.clearInterval(timer);
              try {
                await session.acceptAnswer(data.answer);
                joinScreen.setStatus('Connected — your friend is joining!');
                await relay.post('/pair/reset', '');
              } catch (error) {
                joinScreen.setStatus(`Could not accept the answer: ${String(error)}`, true);
              }
            })();
          }, 1500);
        } else {
          joinScreen.setStatus('Hosting. Send this code to your friend, then paste their answer below.');
        }
      } catch (error) {
        joinScreen.setStatus(`Could not start hosting: ${String(error)}`, true);
      }
      game.start();
      game.setPlaying(true);
    },
    onAcceptAnswer: async (code) => {
      if (!code.trim()) {
        joinScreen.setStatus('Paste the answer code from your friend first.', true);
        return;
      }
      if (!game.multiplayer) {
        joinScreen.setStatus('Start hosting before accepting an answer.', true);
        return;
      }
      try {
        await game.multiplayer.acceptAnswer(code.trim());
        joinScreen.setStatus('Handshake complete — your friend is joining!');
      } catch (error) {
        joinScreen.setStatus(`That answer did not work: ${String(error)}`, true);
      }
    },
    onJoinWithCode: async (code) => {
      joinScreen.setStatus('Connecting…');
      const session = new MultiplayerSession(game, false, (state) => {
        if (state === 'connected') joinScreen.setStatus('Connected!');
        if (state === 'failed') joinScreen.setStatus(session.error ?? 'The connection failed.', true);
      });
      game.multiplayer = session;
      try {
        let pack = code.trim();
        let viaRelay = false;
        // An empty box asks the relay for the host's code — one click joins.
        if (!pack) {
          const data = await relay.poll();
          if (data?.offer) {
            pack = data.offer;
            viaRelay = true;
          }
        }
        if (!pack) {
          joinScreen.setStatus('Paste the join code from the other player first.', true);
          return;
        }
        const answer = await session.join(pack);
        if (viaRelay) {
          await relay.post('/pair/answer', answer);
          joinScreen.setStatus('Connected — the host picks it up automatically.');
        } else {
          // The host still has to paste this answer back.
          joinScreen.setStatus('Connected — send this answer back to the host.');
          joinScreen.setJoinCode(answer);
        }
      } catch (error) {
        joinScreen.setStatus(`Could not join: ${String(error)}`, true);
      }
      game.start();
      game.setPlaying(true);
    },
  });

  const deathScreen = new DeathScreen(
    () => {
      deathScreen.hide();
      game.survival.respawn();
      game.setPlaying(true);
    },
    () => {
      deathScreen.hide();
      game.setPlaying(false);
      game.stop();
      mainMenu.show();
    },
  );

  function openAvatarPicker(onClose: () => void): void {
    new AvatarPicker(
      storedAvatar,
      (spec) => {
        Object.assign(storedAvatar, spec);
        try {
          localStorage.setItem('cubicraft.avatar', JSON.stringify(storedAvatar));
        } catch {
          /* ignore */
        }
      },
      onClose,
    );
  }

  // Escape opens the pause menu.
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Escape') return;
    if (settingsScreen.visible) {
      settingsScreen.hide();
      if (game.playing) pauseMenu.show();
      else mainMenu.show();
      return;
    }
    if (!game.playing) return;
    game.setPlaying(false);
    pauseMenu.show();
  });

  // The death screen appears when the player's health runs out.
  let deathChecked = false;
  window.setInterval(() => {
    if (game.survival.dead && !deathChecked) {
      deathChecked = true;
      game.setPlaying(false);
      deathScreen.show();
    } else if (!game.survival.dead) {
      deathChecked = false;
    }
  }, 250);

  loading.classList.add('hidden');
  setTimeout(() => loading.remove(), 600);
}

bootstrap().catch((error) => {
  console.error('[cubicraft] failed to start', error);
  loading.innerHTML = `<div class="inner"><h1>CUBICRAFT</h1><p style="color:#ff8f8f">${String(error)}</p></div>`;
});
