import { registerIcons } from '@videojs/html/icons';

/* Unified 1.35px hairline geometric icon set */
const playIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" aria-hidden="true">
  <path d="M5.25 4L13.75 9L5.25 14V4Z"/>
</svg>`;

const pauseIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" aria-hidden="true">
  <path d="M6.25 4.25V13.75M11.75 4.25V13.75"/>
</svg>`;

const restartIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" aria-hidden="true">
  <path d="M4.2 6.8A5.25 5.25 0 1 1 3.75 9"/>
  <path d="M3.25 3.5V7H6.75"/>
</svg>`;

const seekIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" aria-hidden="true">
  <path d="M12.5 5.2L15 7.5L12.5 9.8"/>
  <path d="M14.5 7.5H8.25A4.25 4.25 0 1 0 12.2 13.3"/>
</svg>`;

const volumeHighIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 7.25H5.75L9.25 4.25V13.75L5.75 10.75H3V7.25Z"/>
  <path d="M11.75 6.75C12.55 7.4 13 8.15 13 9C13 9.85 12.55 10.6 11.75 11.25"/>
  <path d="M13.75 4.75C15 5.85 15.75 7.35 15.75 9C15.75 10.65 15 12.15 13.75 13.25"/>
</svg>`;

const volumeLowIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 7.25H5.75L9.25 4.25V13.75L5.75 10.75H3V7.25Z"/>
  <path d="M11.75 6.75C12.55 7.4 13 8.15 13 9C13 9.85 12.55 10.6 11.75 11.25"/>
</svg>`;

const volumeOffIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 7.25H5.75L9.25 4.25V13.75L5.75 10.75H3V7.25Z"/>
  <path d="M12 6.75L15.5 11.25M15.5 6.75L12 11.25"/>
</svg>`;

const captionsOffIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">
  <rect x="2.5" y="4.25" width="13" height="9.5" rx="1"/>
  <path d="M7.75 7.5H5.75V10.5H7.75M12.25 7.5H10.25V10.5H12.25" stroke-linecap="square"/>
</svg>`;

const captionsOnIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">
  <rect x="2.5" y="4.25" width="13" height="9.5" rx="1"/>
  <path d="M7.75 7.5H5.75V10.5H7.75M12.25 7.5H10.25V10.5H12.25" stroke-linecap="square"/>
  <circle cx="14.5" cy="4.5" r="1.5" fill="currentColor" stroke="none"/>
</svg>`;

const fullscreenEnterIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" aria-hidden="true">
  <path d="M3.25 6.5V3.25H6.5M11.5 3.25H14.75V6.5M14.75 11.5V14.75H11.5M6.5 14.75H3.25V11.5"/>
</svg>`;

const fullscreenExitIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" aria-hidden="true">
  <path d="M6.5 3.25V6.5H3.25M11.5 3.25V6.5H14.75M14.75 11.5H11.5V14.75M3.25 11.5H6.5V14.75"/>
</svg>`;

const pipEnterIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">
  <rect x="2.5" y="3.75" width="13" height="10.5" rx="1"/>
  <rect x="8.75" y="8.75" width="4.5" height="3.25" rx="0.5"/>
</svg>`;

const pipExitIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">
  <rect x="2.5" y="3.75" width="13" height="10.5" rx="1"/>
  <path d="M7 8.5L10.5 6.5M7 8.5H9.5M7 8.5V6" stroke-linecap="square"/>
</svg>`;

const airPlayEnterIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" aria-hidden="true">
  <path d="M4.5 12.25H2.75V4H15.25V12.25H13.5" stroke-linecap="square"/>
  <path d="M9 10.5L12.25 14.25H5.75L9 10.5Z"/>
</svg>`;

const airPlayExitIcon = airPlayEnterIcon;

const castEnterIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">
  <path d="M2.5 6.5V4H15.5V14H10.5" stroke-linecap="square"/>
  <path d="M2.5 14H3.5M2.5 11.5A2.5 2.5 0 0 1 5 14M2.5 9A5 5 0 0 1 7.5 14" stroke-linecap="square"/>
</svg>`;

const castExitIcon = castEnterIcon;

const gearIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="miter" aria-hidden="true">
  <path d="M7.36 3.64 L7.68 1.52 L10.32 1.52 L10.64 3.64 L11.63 4.06 L13.36 2.77 L15.23 4.64 L13.94 6.37 L14.36 7.36 L16.48 7.68 L16.48 10.32 L14.36 10.64 L13.94 11.63 L15.23 13.36 L13.36 15.23 L11.63 13.94 L10.64 14.36 L10.32 16.48 L7.68 16.48 L7.36 14.36 L6.37 13.94 L4.64 15.23 L2.77 13.36 L4.06 11.63 L3.64 10.64 L1.52 10.32 L1.52 7.68 L3.64 7.36 L4.06 6.37 L2.77 4.64 L4.64 2.77 L6.37 4.06 Z"/>
  <path d="M10.99 10.15 L9 11.3 L7.01 10.15 L7.01 7.85 L9 6.7 L10.99 7.85 Z"/>
</svg>`;

const speedIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">
  <path d="M3.25 12.5A6 6 0 1 1 14.75 12.5" stroke-linecap="square"/>
  <path d="M9 9.5L12.25 6.25" stroke-linecap="square"/>
  <circle cx="9" cy="10" r="1"/>
</svg>`;

const switchesIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" aria-hidden="true">
  <path d="M3 5.5H5.5M8.5 5.5H15M3 12.5H10.5M13.5 12.5H15"/>
  <rect x="5.5" y="4" width="3" height="3" rx="0.5"/>
  <rect x="10.5" y="11" width="3" height="3" rx="0.5"/>
</svg>`;

const speechIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">
  <path d="M3 4H15V12H7.5L4.5 14.5V12H3V4Z"/>
  <path d="M6 7.25H12M6 9.5H10" stroke-linecap="square"/>
</svg>`;

const checkIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" aria-hidden="true">
  <path d="M4.25 9.25L7.5 12.5L13.75 5.75"/>
</svg>`;

const chevronIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="square" aria-hidden="true">
  <path d="M6.75 4.5L11.25 9L6.75 13.5"/>
</svg>`;

const spinnerIcon = `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.35" aria-hidden="true">
  <circle cx="9" cy="9" r="6.25" stroke-opacity="0.22"/>
  <path d="M9 2.75A6.25 6.25 0 0 1 15.25 9" stroke-linecap="square"/>
</svg>`;

registerIcons('sitrep', {
  'airplay-enter': airPlayEnterIcon,
  'airplay-exit': airPlayExitIcon,
  'captions-off': captionsOffIcon,
  'captions-on': captionsOnIcon,
  'cast-enter': castEnterIcon,
  'cast-exit': castExitIcon,
  check: checkIcon,
  chevron: chevronIcon,
  'fullscreen-enter': fullscreenEnterIcon,
  'fullscreen-exit': fullscreenExitIcon,
  gear: gearIcon,
  pause: pauseIcon,
  'pip-enter': pipEnterIcon,
  'pip-exit': pipExitIcon,
  play: playIcon,
  restart: restartIcon,
  seek: seekIcon,
  speech: speechIcon,
  speed: speedIcon,
  spinner: spinnerIcon,
  switches: switchesIcon,
  'volume-high': volumeHighIcon,
  'volume-low': volumeLowIcon,
  'volume-off': volumeOffIcon,
});
