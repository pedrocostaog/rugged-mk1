# Rugged MK-1

A field-terminal skin for the [Video.js v10](https://videojs.org) player, built to hold up over any footage, on any screen, for anyone.

The player is presented on a 3D rugged laptop in the field: the lid opens, the screen boots, and the real Video.js player takes over the screen.

## The skin

- **Tick-tape seek bar.** A framed tape with minor and major ticks, a caret playhead, lit played ticks and a timecode riding above the playhead.
- **Thermal optics.** An optic switch cycles the footage between standard, white-hot and black-hot views, with sensor noise and scanlines.
- **Targeting-display readouts.** Unboxed corner data: REC / HOLD / NO SIGNAL state, `T+` timecode, rendition and playback rate, active optic.
- **Field-tested accessibility.** Text and icons hold contrast over bright and dark frames, every control is a real button with a visible focus ring, touch targets are 44px on phones, captions lift above the controls instead of hiding behind them, menus close with Escape and return focus, and motion calms down under reduced motion.

Keyboard: Space / K play, J / L or arrows seek, Up / Down volume, M mute, F fullscreen, C captions.

## Run it

```sh
npm install
npm run dev
```

- `/` is the 3D laptop presentation.
- `/workbench.html` is the Video.js skin workbench: width, aspect ratio, language, direction and playback options.
- `/console.html` is an alternate console layout.

```sh
npm run typecheck
npm run build
```

## Where things live

- `src/`: the skin itself, framework-agnostic HTML + CSS. Start at `src/video/skin.html`, `src/video/skin.css` and `src/video/hud-elements.ts`.
- `apps/preview/src/laptop/`: the Three.js laptop scene (procedural model, textures, intro, fullscreen transitions).
- `apps/preview/src/media.ts`: the Mux playback ID every page plays.
- `apps/preview/`: the workbench and presentation pages.

## Stack

Video.js v10 (`@videojs/html`), Mux Video, Three.js, Vite, TypeScript.

## Credits

Design and development: [Pedro Costa](https://pedrocosta.design).
Footage: NASA. Use does not imply NASA endorsement.

## License

[Apache License 2.0](LICENSE).
