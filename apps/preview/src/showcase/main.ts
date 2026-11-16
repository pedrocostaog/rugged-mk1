import '@videojs/html/i18n';
import '@videojs/html/video/player';
import '@videojs/html/media/mux-video';
import '@/video/skin';
import skinTemplate from '@/video/skin.html?raw';
import { type CameraPreset, type SceneFootage, type SceneTint, TacticalEnvironment } from './tactical-scene';
import './showcase.css';

import { FEED } from '../media';

interface Source {
  src: string;
  poster: string;
  title: string;
  loop: boolean;
  tracks: boolean;
}

const SOURCES: Record<SceneFootage, Source> = {
  film: { src: FEED.src, poster: FEED.poster, title: FEED.title, loop: false, tracks: FEED.tracks },
  bright: {
    src: './clips/bright.mp4',
    poster: './clips/bright.jpg',
    title: 'High Albedo // Bright Aerial Test',
    loop: true,
    tracks: false,
  },
  dark: {
    src: './clips/dark.mp4',
    poster: './clips/dark.jpg',
    title: 'Low Light // Night Recon Test',
    loop: true,
    tracks: false,
  },
};

const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';

interface PlayerElement extends HTMLElement {
  contentTitle?: string | null;
}

const mount = document.getElementById('player-mount')!;
const threeCanvas = document.getElementById('sc-three-canvas') as HTMLCanvasElement | null;
const linkStateEl = document.getElementById('sc-link-state');
const sectorCodeEl = document.getElementById('sc-sector-code');
const sectorCoordsEl = document.getElementById('sc-sector-coords');
const sectorAltEl = document.getElementById('sc-sector-alt');
const satSyncEl = document.getElementById('sc-sat-sync');
const bezelLedEl = document.getElementById('sc-bezel-led');
const bezelStatusEl = document.getElementById('sc-bezel-status');
const activeFeedNameEl = document.getElementById('sc-active-feed-name');
const zuluClockEl = document.getElementById('sc-zulu-clock');
const missionLogEl = document.getElementById('sc-mission-log');
const logPulseEl = document.getElementById('sc-log-pulse');

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TERM_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_-:#';

function revealTerminalElement(el: HTMLElement, force = false) {
  if (!force && el.dataset.termStarted) return;
  el.dataset.termStarted = 'true';
  delete el.dataset.termDone;

  if (REDUCED_MOTION) {
    el.dataset.termDone = 'true';
    return;
  }

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes: { node: Text; target: string }[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    const t = current as Text;
    if (t.nodeValue && t.nodeValue.trim().length > 0) {
      textNodes.push({ node: t, target: t.nodeValue });
    }
  }
  if (textNodes.length === 0) {
    el.dataset.termDone = 'true';
    return;
  }

  const totalChars = textNodes.reduce((sum, item) => sum + item.target.length, 0);
  const speed = el.dataset.termSpeed;
  const duration = speed === 'hero' ? 400 : speed === 'fast' ? 220 : Math.min(520, Math.max(240, totalChars * 5));
  const delay = force ? 0 : Number(el.dataset.termDelay || 0);

  el.setAttribute('aria-label', el.textContent?.trim() ?? '');
  el.setAttribute('data-term-active', 'true');

  for (const item of textNodes) {
    item.node.nodeValue = item.target.replace(/\S/g, '·');
  }

  const startRun = () => {
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const lockedGlobal = Math.floor(progress * totalChars);

      let offset = 0;
      for (let nIdx = 0; nIdx < textNodes.length; nIdx++) {
        const item = textNodes[nIdx]!;
        const len = item.target.length;
        let out = '';

        for (let i = 0; i < len; i++) {
          const globalIdx = offset + i;
          const ch = item.target[i]!;
          if (ch === ' ' || ch === '\n' || ch === '\t') {
            out += ch;
          } else if (globalIdx < lockedGlobal) {
            out += ch;
          } else if (globalIdx === lockedGlobal && progress < 1) {
            out += '█';
          } else if (globalIdx <= lockedGlobal + 4) {
            out += TERM_GLYPHS[Math.floor(Math.random() * TERM_GLYPHS.length)];
          } else {
            out += ' ';
          }
        }
        item.node.nodeValue = out;
        offset += len;
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        for (const item of textNodes) {
          item.node.nodeValue = item.target;
        }
        el.removeAttribute('data-term-active');
        el.dataset.termDone = 'true';
      }
    };
    requestAnimationFrame(step);
  };

  if (delay > 0) {
    window.setTimeout(startRun, delay);
  } else {
    startRun();
  }
}

function pushMissionLog(tag: string, message: string) {
  if (!missionLogEl) return;
  const now = new Date();
  const ts = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}Z`;
  const li = document.createElement('li');
  li.innerHTML = `<span class="sc-ts">[${ts}]</span> ${tag} · ${message}`;
  missionLogEl.prepend(li);
  revealTerminalElement(li, true);
  while (missionLogEl.children.length > 3) {
    missionLogEl.lastElementChild?.remove();
  }
}

// Terminal reveal on enter
const termEls = document.querySelectorAll<HTMLElement>('[data-term-reveal]');
if ('IntersectionObserver' in window) {
  const termIo = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          revealTerminalElement(entry.target as HTMLElement);
          termIo.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.05 },
  );
  termEls.forEach((el) => termIo.observe(el));
} else {
  termEls.forEach((el) => revealTerminalElement(el));
}

let currentFootage: SceneFootage = 'film';
let currentTint: SceneTint = 'mono';
let tacticalEnv: TacticalEnvironment | null = null;

if (threeCanvas) {
  try {
    tacticalEnv = new TacticalEnvironment(threeCanvas);
  } catch {
    // Graceful fallback if WebGL is unavailable
  }
}

function updateZuluClock() {
  if (!zuluClockEl) return;
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  zuluClockEl.textContent = `ZULU ${hh}:${mm}:${ss}`;
}
updateZuluClock();
setInterval(updateZuluClock, 1000);

function bindMediaTelemetry(root: HTMLElement) {
  const media = root.querySelector<HTMLMediaElement>('mux-video, video');
  if (!media) return;

  const syncState = () => {
    const dur = media.duration || 0;
    const cur = media.currentTime || 0;
    const ratio = dur > 0 ? Math.min(1, Math.max(0, cur / dur)) : 0;
    const isPlaying = !media.paused && !media.ended;

    tacticalEnv?.setPlaybackState(isPlaying, ratio);

    if (satSyncEl) {
      satSyncEl.textContent = `ORBIT ${Math.round(ratio * 100)}%`;
    }
    if (linkStateEl) {
      linkStateEl.textContent = isPlaying ? 'ACTIVE RECON' : media.ended ? 'COMPLETE' : 'STANDBY';
    }
    if (bezelStatusEl) {
      bezelStatusEl.textContent = isPlaying ? 'UPLINK // STREAMING' : 'FEED READY';
    }
    if (bezelLedEl) {
      bezelLedEl.setAttribute('data-state', isPlaying ? 'active' : 'standby');
    }
  };

  media.addEventListener('play', () => {
    syncState();
    if (logPulseEl) logPulseEl.textContent = 'LIVE RX';
    pushMissionLog('UPLINK', `Streaming ${SOURCES[currentFootage].title}`);
  });
  media.addEventListener('pause', () => {
    syncState();
    if (logPulseEl) logPulseEl.textContent = 'STANDBY';
    pushMissionLog('HOLD', 'Feed paused by operator');
  });
  media.addEventListener('timeupdate', syncState);
  media.addEventListener('ended', () => {
    syncState();
    pushMissionLog('EOT', 'Reconnaissance feed complete');
  });
  media.addEventListener('waiting', () => {
    if (bezelStatusEl) bezelStatusEl.textContent = 'CARRIER LOST // REACQUIRING';
    if (bezelLedEl) bezelLedEl.setAttribute('data-state', 'alert');
    if (logPulseEl) logPulseEl.textContent = 'ALERT';
  });
  media.addEventListener('playing', syncState);
}

function mountPlayer(footage: SceneFootage, autoplay = false) {
  const source = SOURCES[footage];
  mount.innerHTML = '';

  const i18n = document.createElement('media-i18n');
  const player = document.createElement('video-player') as PlayerElement;
  player.setAttribute('poster', source.poster);
  player.setAttribute('content-title', source.title);

  const tracksMarkup = source.tracks
    ? `<track kind="subtitles" label="English" srclang="en" src="./cosmic-dawn-subtitles.vtt">
       <track kind="chapters" label="Chapters" srclang="en" src="./cosmic-dawn-chapters.vtt" default>`
    : '';

  const mediaTag = footage === 'film'
    ? `<mux-video src="${source.src}" playsinline crossorigin preload="metadata">${tracksMarkup}</mux-video>`
    : `<video src="${source.src}" playsinline crossorigin="anonymous" preload="metadata" ${source.loop ? 'loop' : ''} ${autoplay ? 'autoplay muted' : ''}></video>`;

  player.innerHTML = skinTemplate.replace(MEDIA_PLACEHOLDER, mediaTag);

  const container = player.querySelector('.sr-skin');
  if (container) {
    container.setAttribute('data-hud-tint', currentTint);
  }

  i18n.append(player);
  mount.append(i18n);

  if (activeFeedNameEl) {
    activeFeedNameEl.textContent = source.title.toUpperCase();
    if (autoplay) revealTerminalElement(activeFeedNameEl, true);
  }

  const profile = tacticalEnv?.setFootage(footage);
  if (profile) {
    if (sectorCodeEl) {
      sectorCodeEl.textContent = profile.sectorCode;
      if (autoplay) revealTerminalElement(sectorCodeEl, true);
    }
    if (sectorCoordsEl) sectorCoordsEl.textContent = profile.coords;
    if (sectorAltEl) sectorAltEl.textContent = profile.elevation;
  }

  bindMediaTelemetry(player);
}

mountPlayer(currentFootage, false);

// Feed Matrix Switcher
const footageGroup = document.querySelector('[data-switch="footage"]');
footageGroup?.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.sc-feed-row');
  if (!btn) return;
  const val = btn.dataset.value as SceneFootage | undefined;
  if (!val || val === currentFootage) return;
  currentFootage = val;

  footageGroup.querySelectorAll<HTMLButtonElement>('.sc-feed-row').forEach((b) => {
    const active = b === btn;
    b.setAttribute('aria-pressed', String(active));
    const status = b.querySelector('[data-part="status"]');
    if (status) {
      status.textContent = active ? 'LIVE' : 'READY';
    }
  });

  mountPlayer(val, true);
  pushMissionLog('ROUTE', `Switched deck to ${SOURCES[val].title}`);
});

// Spectrum Switcher
const tintGroup = document.querySelector('[data-switch="tint"]');
tintGroup?.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.sc-chip-btn');
  if (!btn) return;
  const val = btn.dataset.value as SceneTint | undefined;
  if (!val || val === currentTint) return;
  currentTint = val;

  tintGroup.querySelectorAll('.sc-chip-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(b === btn));
  });

  document.body.setAttribute('data-hud-tint', val);
  tacticalEnv?.setTint(val);

  const container = mount.querySelector('.sr-skin');
  if (container) {
    container.setAttribute('data-hud-tint', val);
  }
  pushMissionLog('SHADER', `Optic mode -> ${val.toUpperCase()}`);
});

// 3D Camera Preset Switcher
const camGroup = document.querySelector('[data-switch="camera"]');
camGroup?.addEventListener('click', (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.sc-chip-btn');
  if (!btn) return;
  const cam = btn.dataset.cam as CameraPreset | undefined;
  if (!cam) return;

  camGroup.querySelectorAll('.sc-chip-btn').forEach((b) => {
    b.setAttribute('aria-pressed', String(b === btn));
  });

  tacticalEnv?.setCameraPreset(cam);
});
