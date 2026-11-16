import '@videojs/html/video/player';
import '@videojs/html/media/mux-video';
import '@/video/skin';
import skinTemplate from '@/video/skin.html?raw';

import { FEED } from '../media';

// What the preview plays: shared with the laptop scene, set in src/media.ts.
const SRC = FEED.src;
const POSTER = FEED.poster;
/** Chapters for the time slider, served from `apps/preview/public`. */
const CHAPTERS = './cosmic-dawn-chapters.vtt';

const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';

export function createPlayer(): HTMLElement {
  const player = document.createElement('video-player');
  player.setAttribute('poster', POSTER);
  player.setAttribute('content-title', FEED.title);

  player.innerHTML = skinTemplate.replace(
    MEDIA_PLACEHOLDER,
    `<mux-video src="${SRC}" playsinline crossorigin>${FEED.tracks ? `<track kind="chapters" label="English" srclang="en" src="${CHAPTERS}" default>` : ''}</mux-video>`
  );

  return player;
}
