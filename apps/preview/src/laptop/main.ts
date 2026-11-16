import '@videojs/html/i18n';
import '@videojs/html/video/player';
import '@videojs/html/media/mux-video';
import '@/video/skin';
import skinTemplate from '@/video/skin.html?raw';
import { LaptopScene, type ScreenRect } from './laptop-scene';
import './laptop.css';

import { FEED } from '../media';

type Feed = 'film' | 'bright' | 'dark';

const SOURCES: Record<Feed, { src: string; poster: string; title: string; loop: boolean; tracks: boolean }> = {
  film: { src: FEED.src, poster: FEED.poster, title: FEED.title, loop: false, tracks: FEED.tracks },
  bright: { src: './clips/bright.mp4', poster: './clips/bright.jpg', title: 'High Albedo // Bright Test', loop: true, tracks: false },
  dark: { src: './clips/dark.mp4', poster: './clips/dark.jpg', title: 'Night Recon // Dark Test', loop: true, tracks: false },
};

const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOW_POWER = (navigator.hardwareConcurrency ?? 8) <= 4 || window.matchMedia('(pointer: coarse)').matches;

const screenEl = document.getElementById('lt-screen')!;
const mount = document.getElementById('player-mount')!;
const canvas = document.getElementById('lt-canvas') as HTMLCanvasElement;

let scene: LaptopScene | null = null;

function placeEl(el: HTMLElement, r: ScreenRect, snap = true) {
  const f = snap ? Math.round : (v: number) => v;
  el.style.left = `${f(r.x)}px`;
  el.style.top = `${f(r.y)}px`;
  el.style.width = `${f(r.width)}px`;
  el.style.height = `${f(r.height)}px`;
}

function layout() {
  if (!scene) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const footer = document.querySelector<HTMLElement>('.lt-footer')?.offsetHeight ?? 80;
  const avail = vh - footer;
  const portrait = vw / avail < 1.1;
  // Screen-dominant framing. In screen widths (S): the screen is 0.5625 S
  // tall, and below it the bezel, hinge and first key rows take ~0.42 S.
  // The lid top and chassis front may crop; the screen never does.
  // Short viewports (phone landscape) give the screen almost everything.
  const short = avail < 520;
  const below = portrait ? 0.62 : short ? 0.14 : 0.47; // portrait has room for more keyboard
  const above = short ? 0.03 : 0.1; // keep a strip of the top bezel in frame
  const block = above + 0.5625 + below;
  const byWidth = portrait ? vw - 16 : vw * 0.74;
  const byHeight = (avail - (short ? 8 : 24)) / block;
  const screenPx = Math.max(240, Math.min(byWidth, byHeight, 1280));
  // Centre the screen+keyboard block in the space above the footer, nudged up.
  const topPad = above * screenPx + Math.max(0, (avail - block * screenPx) * (portrait ? 0.42 : 0.45));
  const centerPx = topPad + 0.28125 * screenPx;
  // The player always sits at the final (fully dollied-in) rect; the boot
  // screen follows the live rect while the camera moves.
  const h = screenPx * 0.5625;
  finalRect = { x: (vw - screenPx) / 2, y: centerPx - h / 2, width: screenPx, height: h };
  placeEl(screenEl, finalRect);
  onSceneRect(scene.layout(vw, vh, { screenPx, centerY: centerPx / vh }));
}

let finalRect: ScreenRect = { x: 0, y: 0, width: 1, height: 1 };
let zooming = false;

/** Live rect of the 3D screen. Boot text rides it; the player follows it while zooming. */
function onSceneRect(r: ScreenRect) {
  placeEl(bootEl, r, false);
  if (!zooming) return;
  const s = r.width / finalRect.width;
  const tx = r.x + r.width / 2 - (finalRect.x + finalRect.width / 2);
  const ty = r.y + r.height / 2 - (finalRect.y + finalRect.height / 2);
  screenEl.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
}

// ---------- Fullscreen: zoom into the screen, and back out of it ----------
let fsActive = false;

function onFullscreenChange() {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  const fsEl = (document.fullscreenElement ?? doc.webkitFullscreenElement ?? null) as HTMLElement | null;

  if (fsEl && screenEl.contains(fsEl)) {
    fsActive = true;
    if (REDUCED_MOTION) return;
    // FLIP: start the fullscreen player where the laptop screen was. Started
    // synchronously so no frame of the full-size player flashes first; the
    // fullscreen viewport is the screen, so size from that.
    {
      const vw = window.screen.width || window.innerWidth;
      const vh = window.screen.height || window.innerHeight;
      const r = finalRect;
      const videoW = Math.min(vw, (vh * 16) / 9); // contained 16:9 picture
      const s = r.width / videoW;
      const dx = r.x + r.width / 2 - vw / 2;
      const dy = r.y + r.height / 2 - vh / 2;
      // Browsers force `transform: none !important` on :fullscreen elements,
      // which silently cancels a transform animation. The individual
      // `translate` / `scale` properties are not locked, so animate those.
      fsEl.animate(
        [
          { translate: `${dx}px ${dy}px`, scale: `${s}`, filter: 'brightness(1.6)' },
          { translate: '0px 0px', scale: '1', filter: 'none' },
        ],
        { duration: 360, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    }
  } else if (!fsEl && fsActive) {
    fsActive = false;
    if (!scene || REDUCED_MOTION) return;
    // Start with the screen filling the viewport, then pull back to the laptop.
    requestAnimationFrame(() => {
      if (!scene) return;
      layout();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const s = Math.min(vw / finalRect.width, vh / finalRect.height);
      zooming = true;
      scene.zoomFrom(1 / s, 0.5, 560, () => {
        zooming = false;
        screenEl.style.transform = '';
      });
    });
  }
}
if (import.meta.env.DEV) {
  // Dev-only: replay the exit zoom without real fullscreen (some previews block it).
  (window as unknown as { __ltExitZoom: () => void }).__ltExitZoom = () => {
    fsActive = true;
    onFullscreenChange();
  };
}
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

let resizeRaf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(layout);
});

function bindMedia(root: HTMLElement) {
  const media = root.querySelector<HTMLMediaElement>('mux-video, video');
  if (!media) return;
  const sync = () => scene?.setPlaying(!media.paused && !media.ended);
  for (const ev of ['play', 'pause', 'ended', 'playing', 'waiting']) media.addEventListener(ev, sync);
}

function mountPlayer(feed: Feed, autoplay = false) {
  const s = SOURCES[feed];
  mount.innerHTML = '';
  const i18n = document.createElement('media-i18n');
  const player = document.createElement('video-player');
  player.setAttribute('poster', s.poster);
  player.setAttribute('content-title', s.title);
  const tracks = s.tracks
    ? `<track kind="subtitles" label="English" srclang="en" src="./cosmic-dawn-subtitles.vtt">
       <track kind="chapters" label="Chapters" srclang="en" src="./cosmic-dawn-chapters.vtt" default>`
    : '';
  const media =
    feed === 'film'
      ? `<mux-video src="${s.src}" playsinline crossorigin preload="metadata">${tracks}</mux-video>`
      : `<video src="${s.src}" playsinline crossorigin="anonymous" preload="metadata" ${s.loop ? 'loop' : ''} ${autoplay ? 'autoplay muted' : ''}></video>`;
  player.innerHTML = skinTemplate.replace(MEDIA_PLACEHOLDER, media);
  i18n.append(player);
  mount.append(i18n);
  scene?.setPlaying(false);
  bindMedia(player);
}

mountPlayer('film');

// Feed switcher: bright/dark footage shows the controls stay legible over both.
const feedGroup = document.querySelector<HTMLElement>('[data-switch="feed"]');
feedGroup?.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-value]');
  if (!btn || btn.getAttribute('aria-pressed') === 'true') return;
  feedGroup.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  mountPlayer(btn.dataset.value as Feed, true);
});

const bootEl = document.getElementById('lt-boot')!;
const skipBtn = document.getElementById('lt-skip') as HTMLButtonElement;

function reveal() {
  screenEl.removeAttribute('inert');
  screenEl.dataset.state = 'on';
  bootEl.dataset.state = 'off';
  document.body.dataset.intro = 'done';
  skipBtn.hidden = true;
  removeSkipListeners();
}

// Any key, click or tap skips the intro.
const skip = () => scene?.skip();
const skipEvents = ['keydown', 'pointerdown', 'wheel'] as const;
function removeSkipListeners() {
  for (const ev of skipEvents) window.removeEventListener(ev, skip);
}
skipBtn.addEventListener('click', skip);

async function boot() {
  // The brand plate is drawn into a canvas, so its fonts must be ready first.
  await Promise.race([
    Promise.all([
      document.fonts.load('700 58px "Big Shoulders Display"'),
      document.fonts.load('500 26px "JetBrains Mono"'),
    ]),
    new Promise((r) => setTimeout(r, 1200)),
  ]).catch(() => {});
  try {
    scene = new LaptopScene(canvas, { reducedMotion: REDUCED_MOTION, lowPower: LOW_POWER });
  } catch {
    document.documentElement.classList.add('lt-no-webgl');
    reveal();
    return;
  }
  layout();
  for (const ev of skipEvents) window.addEventListener(ev, skip, { passive: true });
  scene.start();
  scene.powerOn({
    onRect: onSceneRect,
    onScreenOn: () => {
      bootEl.dataset.state = 'on';
    },
    onDone: reveal,
  });
}

boot();
