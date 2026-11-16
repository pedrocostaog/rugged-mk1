import {
  UIElement,
  PlayerController,
  playerContext,
  selectControls,
  selectError,
  selectMetadata,
  selectPlayback,
  selectPlaybackRate,
  selectQuality,
  selectTextTrack,
  selectTime,
  selectVolume,
  type PropertyValues,
} from '@videojs/html';

function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}.${tenths}`;
}

/**
 * Top-left HUD status chips driven by real Video.js v10 player state.
 */
export class SitrepTelemetryElement extends UIElement {
  #playback = new PlayerController(this, playerContext, selectPlayback);
  #time = new PlayerController(this, playerContext, selectTime);
  #quality = new PlayerController(this, playerContext, selectQuality);
  #rate = new PlayerController(this, playerContext, selectPlaybackRate);
  #error = new PlayerController(this, playerContext, selectError);

  #built = false;
  #stateChip!: HTMLElement;
  #stateLabel!: HTMLElement;
  #timeValue!: HTMLElement;
  #qualityValue!: HTMLElement;
  #rateValue!: HTMLElement;

  connectedCallback() {
    super.connectedCallback();
    if (!this.#built) {
      this.#built = true;
      const callsign = this.getAttribute('callsign') || 'PLAYER-01';
      this.innerHTML = `
        <div class="sr-telemetry-strip" data-part="state-chip">
          <span class="sr-chip-seg sr-chip-state">
            <span class="sr-live-dot" aria-hidden="true"></span>
            <span class="sr-chip-callsign">${callsign}</span>
            <span class="sr-chip-sep" aria-hidden="true">/</span>
            <span class="sr-chip-status" data-part="status">STANDBY</span>
          </span>
          <span class="sr-strip-div" aria-hidden="true"></span>
          <span class="sr-chip-seg sr-chip-time">
            <span class="sr-chip-v" data-part="time">00:00.0</span>
          </span>
          <span class="sr-strip-div sr-hide-mobile" aria-hidden="true"></span>
          <span class="sr-chip-seg sr-chip-quality">
            <span class="sr-chip-v" data-part="quality">AUTO</span>
          </span>
          <span class="sr-strip-div sr-hide-mobile" aria-hidden="true"></span>
          <span class="sr-chip-seg sr-chip-rate">
            <span class="sr-chip-v" data-part="rate">1.0X</span>
          </span>
        </div>
      `;
      this.#stateChip = this.querySelector('[data-part="state-chip"]')!;
      this.#stateLabel = this.querySelector('[data-part="status"]')!;
      this.#timeValue = this.querySelector('[data-part="time"]')!;
      this.#qualityValue = this.querySelector('[data-part="quality"]')!;
      this.#rateValue = this.querySelector('[data-part="rate"]')!;
    }
  }

  update(changed: PropertyValues) {
    super.update(changed);
    if (!this.#built) return;

    const playback = this.#playback.value;
    const time = this.#time.value;
    const quality = this.#quality.value;
    const rate = this.#rate.value;
    const err = this.#error.value;

    let state = 'standby';
    let label = 'STANDBY';

    if (err?.error) {
      state = 'error';
      label = 'LINK ERROR';
    } else if (playback?.waiting) {
      state = 'waiting';
      label = 'SIGNAL LOST';
    } else if (playback?.ended) {
      state = 'ended';
      label = 'END OF FEED';
    } else if (playback && !playback.paused) {
      state = 'playing';
      label = 'RECON';
    }

    this.setAttribute('data-state', state);
    this.#stateChip.setAttribute('data-state', state);
    this.#stateLabel.textContent = label;

    const current = time?.currentTime ?? 0;
    this.#timeValue.textContent = formatTimecode(current);

    const active = quality?.activeVideoRendition;
    if (active?.height && active.height > 0) {
      this.#qualityValue.textContent = `${active.height}P`;
    } else {
      this.#qualityValue.textContent = 'AUTO';
    }

    const spd = rate?.playbackRate ?? 1;
    this.#rateValue.textContent = `${spd % 1 === 0 ? spd.toFixed(1) : spd.toFixed(2).replace(/0$/, '')}X`;
  }
}

/**
 * Top-right briefing card: displays current chapter phase & title, or video title.
 */
export class SitrepBriefingElement extends UIElement {
  #time = new PlayerController(this, playerContext, selectTime);
  #textTrack = new PlayerController(this, playerContext, selectTextTrack);
  #metadata = new PlayerController(this, playerContext, selectMetadata);

  #built = false;
  #kicker!: HTMLElement;
  #title!: HTMLElement;

  connectedCallback() {
    super.connectedCallback();
    if (!this.#built) {
      this.#built = true;
      this.innerHTML = `
        <div class="sr-briefing-card">
          <span class="sr-briefing-kicker" data-part="kicker">01/01</span>
          <span class="sr-strip-div" aria-hidden="true"></span>
          <span class="sr-briefing-title" data-part="title">RECON FEED</span>
        </div>
      `;
      this.#kicker = this.querySelector('[data-part="kicker"]')!;
      this.#title = this.querySelector('[data-part="title"]')!;
    }
  }

  update(changed: PropertyValues) {
    super.update(changed);
    if (!this.#built) return;

    const cues = this.#textTrack.value?.chaptersCues ?? [];
    const current = this.#time.value?.currentTime ?? 0;
    const metaTitle = this.#metadata.value?.title?.trim();

    if (cues.length > 0) {
      let idx = cues.findIndex((c) => current >= c.startTime && current < c.endTime);
      if (idx === -1 && current >= cues[cues.length - 1]!.startTime) {
        idx = cues.length - 1;
      }
      if (idx === -1) idx = 0;

      const activeCue = cues[idx]!;
      const phaseNum = String(idx + 1).padStart(2, '0');
      const totalNum = String(cues.length).padStart(2, '0');
      this.#kicker.textContent = `S${phaseNum}/${totalNum}`;
      this.#title.textContent = activeCue.text || metaTitle || 'RECON FEED';
    } else {
      this.#kicker.textContent = 'FEED';
      this.#title.textContent = metaTitle || 'AERIAL RECON FEED';
    }
  }
}

/**
 * Minimalist top-center tactical compass strip driven by real playback progress.
 */
export class SitrepCompassElement extends UIElement {
  #time = new PlayerController(this, playerContext, selectTime);
  #built = false;
  #pctEl!: HTMLElement;
  #trackEl!: HTMLElement;

  connectedCallback() {
    super.connectedCallback();
    if (!this.#built) {
      this.#built = true;
      this.setAttribute('aria-hidden', 'true');
      this.innerHTML = `
        <div class="sr-compass-pill">
          <div class="sr-compass-viewport">
            <div class="sr-compass-track" data-part="track">
              <span>N</span><span>·</span><span>E</span><span>·</span><span>S</span><span>·</span><span>W</span><span>·</span><span>N</span>
            </div>
            <span class="sr-compass-caret"></span>
          </div>
          <span class="sr-compass-deg" data-part="pct">0%</span>
        </div>
      `;
      this.#pctEl = this.querySelector('[data-part="pct"]')!;
      this.#trackEl = this.querySelector('[data-part="track"]')!;
    }
  }

  update(changed: PropertyValues) {
    super.update(changed);
    if (!this.#built) return;
    const current = this.#time.value?.currentTime ?? 0;
    const duration = this.#time.value?.duration ?? 0;
    const ratio = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
    this.#pctEl.textContent = `${Math.round(ratio * 100)}%`;
    this.#trackEl.style.transform = `translate3d(${(-ratio * 50).toFixed(2)}%, 0, 0)`;
  }
}

/**
 * Percentage playhead readout positioned on the ruler seek bar.
 */
export class SitrepSeekReadoutElement extends UIElement {
  #time = new PlayerController(this, playerContext, selectTime);
  #built = false;
  #label!: HTMLElement;

  connectedCallback() {
    super.connectedCallback();
    if (!this.#built) {
      this.#built = true;
      this.setAttribute('aria-hidden', 'true');
      this.innerHTML = `<span class="sr-seek-readout-pill" data-part="pill">0%</span>`;
      this.#label = this.querySelector('[data-part="pill"]')!;
    }
  }

  update(changed: PropertyValues) {
    super.update(changed);
    if (!this.#built) return;

    const current = this.#time.value?.currentTime ?? 0;
    const duration = this.#time.value?.duration ?? 0;
    const ratio = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
    const pct = ratio * 100;

    // Shared with the tick tape so already-played ticks light up.
    (this.parentElement ?? this).style.setProperty('--sr-seek-pct', `${pct.toFixed(3)}%`);
    this.#label.textContent = formatTimecode(current);
  }
}

/**
 * Segmented volume level meter (8 bars).
 * Shows the real set volume; optionally samples live Web Audio level when CORS allows.
 */
export class SitrepVolumeMeterElement extends UIElement {
  #volume = new PlayerController(this, playerContext, selectVolume);
  #playback = new PlayerController(this, playerContext, selectPlayback);
  #controls = new PlayerController(this, playerContext, selectControls);

  #built = false;
  #bars: HTMLElement[] = [];
  #rafId = 0;
  #analyser: AnalyserNode | null = null;
  #dataArray: Uint8Array<ArrayBuffer> | null = null;
  #audioFailed = false;
  #smoothLevel = 0;

  connectedCallback() {
    super.connectedCallback();
    if (!this.#built) {
      this.#built = true;
      this.setAttribute('aria-hidden', 'true');
      const barsHtml = Array.from({ length: 8 }, (_, i) => `<span class="sr-vol-bar" data-idx="${i}"></span>`).join('');
      this.innerHTML = `<div class="sr-vol-meter">${barsHtml}</div>`;
      this.#bars = Array.from(this.querySelectorAll('.sr-vol-bar'));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#stopRaf();
  }

  update(changed: PropertyValues) {
    super.update(changed);
    if (!this.#built) return;

    const vol = this.#volume.value;
    const playback = this.#playback.value;
    const controls = this.#controls.value;
    const muted = vol?.muted ?? false;
    const level = muted ? 0 : (vol?.volume ?? 1);

    this.toggleAttribute('data-muted', muted || level === 0);
    const activeCount = muted ? 0 : Math.max(level > 0 ? 1 : 0, Math.round(level * this.#bars.length));
    this.#updateBars(activeCount, level);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const shouldAnimate = !reducedMotion && !muted && level > 0 && playback && !playback.paused && (controls?.controlsVisible ?? true);

    if (shouldAnimate && !this.#audioFailed) {
      this.#tryInitWebAudio();
      if (this.#analyser && !this.#rafId) {
        this.#tick();
      }
    } else {
      this.#stopRaf();
    }
  }

  #updateBars(activeCount: number, _level: number) {
    for (let i = 0; i < this.#bars.length; i++) {
      const bar = this.#bars[i]!;
      bar.toggleAttribute('data-active', i < activeCount);
      bar.toggleAttribute('data-peak', i >= 6 && i < activeCount);
    }
  }

  #tryInitWebAudio() {
    if (this.#analyser || this.#audioFailed) return;
    const container = this.closest('media-container');
    const media = container?.querySelector('video, mux-video') as HTMLMediaElement | null;
    if (!media || !media.crossOrigin) {
      this.#audioFailed = true;
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        this.#audioFailed = true;
        return;
      }
      // Only attach once per media element
      const key = '__sitrepAudioAnalyser';
      const existing = (media as unknown as Record<string, AnalyserNode | undefined>)[key];
      if (existing) {
        this.#analyser = existing;
      } else {
        const ctx = new AudioCtx();
        const src = ctx.createMediaElementSource(media);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 32;
        src.connect(analyser);
        analyser.connect(ctx.destination);
        (media as unknown as Record<string, AnalyserNode>)[key] = analyser;
        this.#analyser = analyser;
      }
      this.#dataArray = new Uint8Array(new ArrayBuffer(this.#analyser.frequencyBinCount));
    } catch {
      this.#audioFailed = true;
    }
  }

  #tick = () => {
    if (!this.#analyser || !this.#dataArray) return;
    this.#analyser.getByteFrequencyData(this.#dataArray);
    let sum = 0;
    for (let i = 0; i < this.#dataArray.length; i++) {
      sum += this.#dataArray[i]!;
    }
    const avg = sum / (this.#dataArray.length * 255);
    const vol = this.#volume.value;
    const setLevel = vol?.muted ? 0 : (vol?.volume ?? 1);
    const target = Math.min(1, avg * 1.8) * setLevel;
    this.#smoothLevel += (target - this.#smoothLevel) * 0.18;
    const activeCount = setLevel > 0 ? Math.max(1, Math.round(this.#smoothLevel * this.#bars.length)) : 0;
    this.#updateBars(activeCount, this.#smoothLevel);
    this.#rafId = requestAnimationFrame(this.#tick);
  };

  #stopRaf() {
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = 0;
    }
  }
}

/**
 * Compact timecode badge that stays visible during idle collapse.
 */
export class SitrepIdleTimeElement extends UIElement {
  #time = new PlayerController(this, playerContext, selectTime);
  #playback = new PlayerController(this, playerContext, selectPlayback);
  #built = false;
  #tc!: HTMLElement;

  connectedCallback() {
    super.connectedCallback();
    if (!this.#built) {
      this.#built = true;
      this.setAttribute('aria-hidden', 'true');
      this.innerHTML = `<span class="sr-idle-dot"></span><b class="sr-idle-rec">REC</b><span class="sr-idle-tc">00:00.0</span>`;
      this.#tc = this.querySelector('.sr-idle-tc')!;
    }
  }

  update(changed: PropertyValues) {
    super.update(changed);
    if (!this.#built) return;
    const current = this.#time.value?.currentTime ?? 0;
    this.#tc.textContent = formatTimecode(current);
    const playing = Boolean(this.#playback.value && !this.#playback.value.paused && !this.#playback.value.ended);
    this.toggleAttribute('data-playing', playing);
  }
}

/**
 * Tactical Crosshair Cursor with Magnetic Target-Lock on player controls
 * and Top-Layer Volume Reticle delegation + precision 0-100% volume control.
 */
export class SitrepCursorElement extends UIElement {
  #volume = new PlayerController(this, playerContext, selectVolume);
  #built = false;
  #skin: HTMLElement | null = null;
  #lastLock: Element | null = null;
  #lastPointerEvent: PointerEvent | null = null;
  #popoverObserver: MutationObserver | null = null;
  #volDragging = false;
  #muteDragStartY = 0;
  #muteDragStartVol = 1;
  #muteDragged = false;
  #volRampRaf = 0;
  #volRampTarget = 1;

  connectedCallback() {
    super.connectedCallback();
    if (!this.#built) {
      this.#built = true;
      this.setAttribute('aria-hidden', 'true');
      this.innerHTML = `
        <div class="sr-cursor-box" data-part="box">
          <span class="sr-cursor-corner sr-cc-tl"></span>
          <span class="sr-cursor-corner sr-cc-tr"></span>
          <span class="sr-cursor-corner sr-cc-bl"></span>
          <span class="sr-cursor-corner sr-cc-br"></span>
          <span class="sr-cursor-tick sr-ct-t"></span>
          <span class="sr-cursor-tick sr-ct-r"></span>
          <span class="sr-cursor-tick sr-ct-b"></span>
          <span class="sr-cursor-tick sr-ct-l"></span>
          <span class="sr-cursor-dot"></span>
        </div>
      `;
    }

    this.#skin = this.closest<HTMLElement>('.sr-skin');
    if (this.#skin) {
      this.#skin.addEventListener('pointermove', this.#onPointerMove, { capture: true, passive: true });
      this.#skin.addEventListener('pointerdown', this.#onPointerDown, { capture: true, passive: true });
      this.#skin.addEventListener('pointerup', this.#onPointerUp, { capture: true, passive: true });
      this.#skin.addEventListener('pointerleave', this.#onPointerLeave, { passive: true });
      this.#skin.addEventListener('wheel', this.#onClusterWheel, { passive: false });
      this.#skin.addEventListener('keydown', this.#onClusterKeyDown);

      const muteBtn = this.#skin.querySelector<HTMLElement>('#sr-bottom-mute');
      if (muteBtn) {
        muteBtn.addEventListener('pointerleave', this.#onMutePointerLeave, { capture: true });
        muteBtn.addEventListener('pointerdown', this.#onMutePointerDown, { capture: true });
        muteBtn.addEventListener('pointermove', this.#onMutePointerMove, { capture: true });
        muteBtn.addEventListener('pointerup', this.#onMutePointerUp, { capture: true });
        muteBtn.addEventListener('click', this.#onMuteClick, { capture: true });
      }

      const volSliderEl = this.#skin.querySelector<
        HTMLElement & {
          orientation?: string;
          step?: number;
          largeStep?: number;
          wheelStep?: number;
        }
      >('.sr-vol-slider');
      if (volSliderEl) {
        volSliderEl.orientation = 'vertical';
        volSliderEl.step = 1;
        volSliderEl.largeStep = 10;
        volSliderEl.wheelStep = 5;
      }

      const volPopover = this.#skin.querySelector<HTMLElement>('.sr-vol-popover');
      if (volPopover) {
        volPopover.addEventListener('pointerdown', this.#onVolPointerDown, { capture: true });
        volPopover.addEventListener('pointermove', this.#onVolPointerMove, { capture: true });
        volPopover.addEventListener('pointerup', this.#onVolPointerUp, { capture: true });
        volPopover.addEventListener('pointercancel', this.#onVolPointerUp, { capture: true });

        this.#popoverObserver = new MutationObserver(() => {
          this.#syncVolumeUI();
          if (this.#lastPointerEvent) {
            this.#onPointerMove(this.#lastPointerEvent);
          }
        });
        this.#popoverObserver.observe(volPopover, {
          attributes: true,
          attributeFilter: ['data-open', 'data-starting-style', 'data-ending-style'],
        });
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#volRampRaf) {
      cancelAnimationFrame(this.#volRampRaf);
      this.#volRampRaf = 0;
    }
    this.#popoverObserver?.disconnect();
    this.#popoverObserver = null;
    if (this.#skin) {
      const muteBtn = this.#skin.querySelector<HTMLElement>('#sr-bottom-mute');
      if (muteBtn) {
        muteBtn.removeEventListener('pointerleave', this.#onMutePointerLeave, { capture: true });
        muteBtn.removeEventListener('pointerdown', this.#onMutePointerDown, { capture: true });
        muteBtn.removeEventListener('pointermove', this.#onMutePointerMove, { capture: true });
        muteBtn.removeEventListener('pointerup', this.#onMutePointerUp, { capture: true });
        muteBtn.removeEventListener('click', this.#onMuteClick, { capture: true });
      }
      const volPopover = this.#skin.querySelector<HTMLElement>('.sr-vol-popover');
      if (volPopover) {
        volPopover.removeEventListener('pointerdown', this.#onVolPointerDown, { capture: true });
        volPopover.removeEventListener('pointermove', this.#onVolPointerMove, { capture: true });
        volPopover.removeEventListener('pointerup', this.#onVolPointerUp, { capture: true });
        volPopover.removeEventListener('pointercancel', this.#onVolPointerUp, { capture: true });
      }
      this.#skin.removeEventListener('pointermove', this.#onPointerMove, { capture: true });
      this.#skin.removeEventListener('pointerdown', this.#onPointerDown, { capture: true });
      this.#skin.removeEventListener('pointerup', this.#onPointerUp, { capture: true });
      this.#skin.removeEventListener('pointerleave', this.#onPointerLeave);
      this.#skin.removeEventListener('wheel', this.#onClusterWheel);
      this.#skin.removeEventListener('keydown', this.#onClusterKeyDown);
      this.#skin = null;
    }
  }

  update(changed: PropertyValues) {
    super.update(changed);
    this.#syncVolumeUI();
  }

  #cancelVolumeRamp() {
    if (this.#volRampRaf) {
      cancelAnimationFrame(this.#volRampRaf);
      this.#volRampRaf = 0;
    }
  }

  #setExactVolume(ratio: number, cancelRamp = true) {
    if (cancelRamp) this.#cancelVolumeRamp();
    const vol = this.#volume.value;
    if (!vol) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    this.#volRampTarget = clamped;
    vol.setVolume(clamped);
    if (clamped > 0.001 && vol.muted) {
      vol.setMuted(false);
    } else if (clamped <= 0.001 && !vol.muted) {
      vol.setMuted(true);
    }
    this.#syncVolumeUI(clamped);
  }

  #rampVolumeTo(targetRatio: number, durationMs = 110) {
    const vol = this.#volume.value;
    if (!vol) return;
    const target = Math.max(0, Math.min(1, targetRatio));
    const start = vol.muted ? 0 : (vol.volume ?? 1);
    this.#volRampTarget = target;
    this.#cancelVolumeRamp();

    if (Math.abs(target - start) < 0.005 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.#setExactVolume(target, false);
      return;
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - (1 - p) * (1 - p) * (1 - p);
      const val = start + (target - start) * eased;
      this.#setExactVolume(val, false);
      if (p < 1) {
        this.#volRampRaf = requestAnimationFrame(tick);
      } else {
        this.#volRampRaf = 0;
      }
    };
    this.#volRampRaf = requestAnimationFrame(tick);
  }

  #syncVolumeUI(overrideLevel?: number) {
    if (!this.#skin) return;
    const vol = this.#volume.value;
    const muted = overrideLevel !== undefined ? overrideLevel <= 0.001 : (vol?.muted ?? false);
    const level = overrideLevel !== undefined ? overrideLevel : muted ? 0 : (vol?.volume ?? 1);
    const pctFloat = Math.max(0, Math.min(100, level * 100));
    const pct = Math.round(pctFloat);

    const readout = this.#skin.querySelector<HTMLElement>('[data-part="vol-readout"]');
    if (readout) {
      readout.textContent = muted || pct === 0 ? 'MUTE' : `${pct}%`;
      readout.toggleAttribute('data-muted', muted || pct === 0);
    }

    const volSlider = this.#skin.querySelector<HTMLElement>('.sr-vol-slider');
    if (volSlider) {
      volSlider.style.setProperty('--sr-vol-pct', `${pctFloat.toFixed(2)}%`);
    }
  }

  #applyVolPointer(e: PointerEvent, slider: HTMLElement) {
    const rect = slider.getBoundingClientRect();
    if (rect.height <= 0) return;
    const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const ratio = 1 - relY / rect.height;
    this.#queueVolume(ratio);
  }

  #pendingVol: number | null = null;
  #pendingRaf = 0;

  /** Paint the UI immediately, but write to the media store at most once per frame. */
  #queueVolume(ratio: number) {
    this.#cancelVolumeRamp();
    const r = Math.max(0, Math.min(1, ratio));
    this.#syncVolumeUI(r);
    this.#pendingVol = r;
    if (this.#pendingRaf) return;
    this.#pendingRaf = requestAnimationFrame(() => {
      this.#pendingRaf = 0;
      const v = this.#pendingVol;
      this.#pendingVol = null;
      if (v !== null) this.#setExactVolume(v);
    });
  }

  #onMutePointerLeave = (e: PointerEvent) => {
    const volPopover = this.#skin?.querySelector<HTMLElement>('.sr-vol-popover');
    if (!volPopover || !volPopover.hasAttribute('data-open')) return;
    const pRect = volPopover.getBoundingClientRect();
    if (
      e.clientX >= pRect.left - 10 &&
      e.clientX <= pRect.right + 10 &&
      e.clientY >= pRect.top - 10 &&
      e.clientY <= pRect.bottom + 10
    ) {
      e.stopImmediatePropagation();
    }
  };

  #onMutePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const muteBtn = e.currentTarget as HTMLElement | null;
    if (!muteBtn) return;
    const vol = this.#volume.value;
    this.#muteDragStartY = e.clientY;
    this.#muteDragStartVol = vol?.muted ? 0 : (vol?.volume ?? 1);
    this.#muteDragged = false;
    try {
      muteBtn.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  #onMutePointerMove = (e: PointerEvent) => {
    const muteBtn = e.currentTarget as HTMLElement | null;
    if (!muteBtn || !muteBtn.hasPointerCapture(e.pointerId)) return;
    const dy = this.#muteDragStartY - e.clientY;
    if (Math.abs(dy) > 3) {
      this.#muteDragged = true;
    }
    if (this.#muteDragged) {
      const nextRatio = Math.max(0, Math.min(1, this.#muteDragStartVol + dy / 96));
      this.#queueVolume(nextRatio);
    }
  };

  #onMutePointerUp = (e: PointerEvent) => {
    const muteBtn = e.currentTarget as HTMLElement | null;
    if (!muteBtn || !muteBtn.hasPointerCapture(e.pointerId)) return;
    try {
      muteBtn.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  #onMuteClick = (e: MouseEvent) => {
    e.stopImmediatePropagation();
    e.preventDefault();
    if (this.#muteDragged) {
      this.#muteDragged = false;
      return;
    }
    const vol = this.#volume.value;
    if (!vol) return;
    if (vol.muted || vol.volume === 0) {
      vol.setMuted(false);
      if (vol.volume === 0) vol.setVolume(0.75);
    } else {
      vol.setMuted(true);
    }
    this.#syncVolumeUI();
  };

  #onVolPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    const popover = e.currentTarget as HTMLElement | null;
    if (!popover) return;

    e.stopImmediatePropagation();
    e.preventDefault();

    if (target?.closest('[data-part="vol-readout"]')) {
      const vol = this.#volume.value;
      if (vol) {
        if (vol.muted || vol.volume === 0) {
          vol.setMuted(false);
          if (vol.volume === 0) vol.setVolume(0.75);
        } else {
          vol.setMuted(true);
        }
        this.#syncVolumeUI();
      }
      return;
    }

    const slider = popover.querySelector<HTMLElement>('.sr-vol-slider');
    if (!slider) return;
    // Ignore presses on the popover padding / hover bridge: only the slider's
    // own height sets volume, so a stray click can never zero it.
    const sRect = slider.getBoundingClientRect();
    if (e.clientY < sRect.top - 6 || e.clientY > sRect.bottom + 6) return;
    this.#volDragging = true;
    slider.setAttribute('data-dragging', '');
    try {
      popover.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    this.#applyVolPointer(e, slider);
  };

  #onVolPointerMove = (e: PointerEvent) => {
    const popover = e.currentTarget as HTMLElement | null;
    const slider = popover?.querySelector<HTMLElement>('.sr-vol-slider') ?? null;
    if (!popover || !slider) return;

    e.stopImmediatePropagation();

    if (this.#volDragging && (e.buttons !== 0 || e.pointerType === 'touch')) {
      this.#applyVolPointer(e, slider);
    }
  };

  #onVolPointerUp = (e: PointerEvent) => {
    const popover = e.currentTarget as HTMLElement | null;
    const slider = popover?.querySelector<HTMLElement>('.sr-vol-slider') ?? null;
    if (!popover) return;
    e.stopImmediatePropagation();
    if (popover.hasPointerCapture(e.pointerId)) {
      try {
        popover.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
    if (this.#volDragging && slider) {
      this.#volDragging = false;
      slider.removeAttribute('data-dragging');
      this.#applyVolPointer(e, slider);
    }
  };

  #onClusterWheel = (e: WheelEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.sr-volume-cluster, .sr-vol-popover')) return;
    e.preventDefault();
    e.stopPropagation();
    const vol = this.#volume.value;
    if (!vol) return;
    const base = this.#volRampRaf ? this.#volRampTarget : (vol.muted ? 0 : (vol.volume ?? 1));
    const dir = e.deltaY < 0 ? 1 : -1;
    const absDelta = Math.abs(e.deltaY);
    const step = e.altKey
      ? 0.01
      : e.shiftKey
        ? 0.1
        : Math.max(0.01, Math.min(0.05, (absDelta / 100) * 0.05));
    this.#rampVolumeTo(base + dir * step, 85);
  };

  #onClusterKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.sr-volume-cluster, .sr-vol-popover')) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    e.stopPropagation();
    const vol = this.#volume.value;
    if (!vol) return;
    const base = this.#volRampRaf ? this.#volRampTarget : (vol.muted ? 0 : (vol.volume ?? 1));
    const step = e.altKey ? 0.01 : e.shiftKey ? 0.1 : 0.05;
    const dir = e.key === 'ArrowUp' ? 1 : -1;
    this.#rampVolumeTo(base + dir * step, 100);
  };

  #moveRaf = 0;
  #moveEvent: PointerEvent | null = null;

  /** Coalesce pointermove to one layout/style pass per frame. */
  #onPointerMove = (e: PointerEvent) => {
    this.#moveEvent = e;
    if (this.#moveRaf) return;
    this.#moveRaf = requestAnimationFrame(() => {
      this.#moveRaf = 0;
      const ev = this.#moveEvent;
      this.#moveEvent = null;
      if (ev) this.#processPointerMove(ev);
    });
  };

  #processPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch' || !this.#skin) return;
    this.#lastPointerEvent = e;
    const skinRect = this.#skin.getBoundingClientRect();
    const px = e.clientX - skinRect.left;
    const py = e.clientY - skinRect.top;

    this.setAttribute('data-visible', '');

    const target = e.target as HTMLElement | null;
    // Delegate the reticle to the volume slider only while the pointer is
    // actually over the popover (or dragging). Over the mute button the
    // reticle must lock to the button itself: otherwise it showed the slider
    // at 0% while a click would really hit mute.
    const inVolPopover = Boolean(target?.closest('.sr-vol-popover'));
    const volPopover = this.#skin.querySelector<HTMLElement>('.sr-vol-popover');
    const volSlider = volPopover?.querySelector<HTMLElement>('.sr-vol-slider') ?? null;
    const isVolOpen = Boolean(volPopover?.hasAttribute('data-open'));

    if ((inVolPopover || this.#volDragging) && isVolOpen && volSlider && this.#skin.contains(volSlider)) {
      const vRect = volSlider.getBoundingClientRect();
      const cx = vRect.left - skinRect.left + vRect.width / 2;
      const minY = vRect.top - skinRect.top;
      const maxY = vRect.bottom - skinRect.top;

      const relY = Math.max(0, Math.min(vRect.height, e.clientY - vRect.top));
      const cy = minY + relY;

      volSlider.setAttribute('data-reticle-locked', '');

      this.style.setProperty('--sr-cur-x', `${cx.toFixed(1)}px`);
      this.style.setProperty('--sr-cur-y', `${Math.max(minY, Math.min(maxY, cy)).toFixed(1)}px`);
      this.style.setProperty('--sr-cur-w', `${Math.max(30, vRect.width + 4).toFixed(1)}px`);
      this.style.setProperty('--sr-cur-h', '22px');
      this.setAttribute('data-locked', '');
      this.setAttribute('data-vol-delegated', '');

      if (this.#lastLock !== volSlider) {
        this.#lastLock = volSlider;
        this.removeAttribute('data-lock-snap');
        void this.offsetWidth;
        this.setAttribute('data-lock-snap', '');
      }
      return;
    }

    this.removeAttribute('data-vol-delegated');
    if (volSlider) {
      volSlider.removeAttribute('data-reticle-locked');
      volSlider.removeAttribute('data-pointer-inside');
    }

    const timeSlider = target?.closest<HTMLElement>('.sr-time-slider');
    const lockEl = timeSlider
      ? null
      : target?.closest<HTMLElement>(
          '.sr-btn, .sr-reticle-btn, .sr-menu-item, .sr-menu-back, .sr-menu-radio-item, .sr-dialog-close',
        );

    if (timeSlider && this.#skin.contains(timeSlider)) {
      const sRect = timeSlider.getBoundingClientRect();
      const minX = sRect.left - skinRect.left;
      const maxX = sRect.right - skinRect.left;
      const cx = Math.max(minX, Math.min(maxX, px));
      const cy = sRect.top - skinRect.top + sRect.height / 2;

      this.style.setProperty('--sr-cur-x', `${cx.toFixed(1)}px`);
      this.style.setProperty('--sr-cur-y', `${cy.toFixed(1)}px`);
      this.style.setProperty('--sr-cur-w', '20px');
      this.style.setProperty('--sr-cur-h', `${Math.max(20, sRect.height + 6).toFixed(1)}px`);
      this.setAttribute('data-locked', '');

      if (this.#lastLock !== timeSlider) {
        this.#lastLock = timeSlider;
        this.removeAttribute('data-lock-snap');
        void this.offsetWidth;
        this.setAttribute('data-lock-snap', '');
      }
    } else if (lockEl && this.#skin.contains(lockEl)) {
      const btnRect = lockEl.getBoundingClientRect();
      const bx = btnRect.left - skinRect.left + btnRect.width / 2;
      const by = btnRect.top - skinRect.top + btnRect.height / 2;
      // Slight 10% magnetic pull toward pointer while locked onto target center
      const cx = bx + (px - bx) * 0.1;
      const cy = by + (py - by) * 0.1;
      const pad = lockEl.classList.contains('sr-reticle-btn') ? 10 : 6;

      this.style.setProperty('--sr-cur-x', `${cx.toFixed(1)}px`);
      this.style.setProperty('--sr-cur-y', `${cy.toFixed(1)}px`);
      this.style.setProperty('--sr-cur-w', `${(btnRect.width + pad).toFixed(1)}px`);
      this.style.setProperty('--sr-cur-h', `${(btnRect.height + pad).toFixed(1)}px`);
      this.setAttribute('data-locked', '');

      if (this.#lastLock !== lockEl) {
        this.#lastLock = lockEl;
        this.removeAttribute('data-lock-snap');
        void this.offsetWidth;
        this.setAttribute('data-lock-snap', '');
      }
    } else {
      this.#lastLock = null;
      this.removeAttribute('data-locked');
      this.removeAttribute('data-lock-snap');
      this.style.setProperty('--sr-cur-x', `${px.toFixed(1)}px`);
      this.style.setProperty('--sr-cur-y', `${py.toFixed(1)}px`);
      this.style.setProperty('--sr-cur-w', '24px');
      this.style.setProperty('--sr-cur-h', '24px');
    }
  };

  #onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.setAttribute('data-pressed', '');
    const volSlider = this.#skin?.querySelector<HTMLElement>('.sr-vol-slider');
    volSlider?.setAttribute('data-reticle-pressed', '');
  };

  #onPointerUp = () => {
    this.removeAttribute('data-pressed');
    const volSlider = this.#skin?.querySelector<HTMLElement>('.sr-vol-slider');
    volSlider?.removeAttribute('data-reticle-pressed');
  };

  #onPointerLeave = () => {
    this.#lastLock = null;
    this.removeAttribute('data-visible');
    this.removeAttribute('data-locked');
    this.removeAttribute('data-pressed');
    this.removeAttribute('data-vol-delegated');
    const volSlider = this.#skin?.querySelector<HTMLElement>('.sr-vol-slider');
    volSlider?.removeAttribute('data-reticle-locked');
    volSlider?.removeAttribute('data-reticle-pressed');
    volSlider?.removeAttribute('data-pointer-inside');
  };
}

if (!customElements.get('sitrep-telemetry')) {
  customElements.define('sitrep-telemetry', SitrepTelemetryElement);
}
if (!customElements.get('sitrep-briefing')) {
  customElements.define('sitrep-briefing', SitrepBriefingElement);
}
if (!customElements.get('sitrep-compass')) {
  customElements.define('sitrep-compass', SitrepCompassElement);
}
if (!customElements.get('sitrep-seek-readout')) {
  customElements.define('sitrep-seek-readout', SitrepSeekReadoutElement);
}
if (!customElements.get('sitrep-volume-meter')) {
  customElements.define('sitrep-volume-meter', SitrepVolumeMeterElement);
}
if (!customElements.get('sitrep-idle-time')) {
  customElements.define('sitrep-idle-time', SitrepIdleTimeElement);
}
if (!customElements.get('sitrep-cursor')) {
  customElements.define('sitrep-cursor', SitrepCursorElement);
}

// ---------------------------------------------------------------------------
// Field-terminal additions: optic modes + corner readouts
// ---------------------------------------------------------------------------

export type OpticMode = 'std' | 'white-hot' | 'black-hot';

const OPTICS: { mode: OpticMode; short: string; label: string }[] = [
  { mode: 'std', short: 'STD', label: 'Standard' },
  { mode: 'white-hot', short: 'WHT', label: 'White-hot thermal' },
  { mode: 'black-hot', short: 'BHT', label: 'Black-hot thermal' },
];

export const OPTIC_EVENT = 'sitrep-optic-change';

function opticOf(skin: Element | null): OpticMode {
  const v = skin?.getAttribute('data-optic');
  return v === 'white-hot' || v === 'black-hot' ? v : 'std';
}

/**
 * Cycles the optic: standard → white-hot → black-hot. Sets `data-optic` on
 * the skin root; CSS does the filtering. A real <button>, so it is keyboard
 * operable and announces its state.
 */
export class SitrepOpticButtonElement extends HTMLElement {
  #btn: HTMLButtonElement | null = null;

  connectedCallback() {
    if (this.#btn) return;
    this.innerHTML = `
      <button type="button" class="sr-btn sr-optic-btn">
        <span class="sr-optic-glyph" aria-hidden="true"></span>
        <span class="sr-optic-short" aria-hidden="true">STD</span>
      </button>`;
    this.#btn = this.querySelector('button');
    this.#btn!.addEventListener('click', () => this.#cycle());
    this.#render();
  }

  #skin() {
    return this.closest('.sr-skin');
  }

  #cycle() {
    const skin = this.#skin();
    if (!skin) return;
    const i = OPTICS.findIndex((o) => o.mode === opticOf(skin));
    const next = OPTICS[(i + 1) % OPTICS.length]!;
    skin.setAttribute('data-optic', next.mode);
    skin.dispatchEvent(new CustomEvent(OPTIC_EVENT, { bubbles: true, detail: next.mode }));
    this.#render();
  }

  #render() {
    const mode = opticOf(this.#skin());
    const o = OPTICS.find((x) => x.mode === mode)!;
    const next = OPTICS[(OPTICS.indexOf(o) + 1) % OPTICS.length]!;
    this.#btn!.setAttribute('aria-label', `Optic: ${o.label}. Switch to ${next.label}`);
    this.#btn!.setAttribute('aria-pressed', String(mode !== 'std'));
    this.#btn!.title = `Optic: ${o.label}`;
    this.#btn!.dataset.optic = mode;
    this.querySelector('.sr-optic-short')!.textContent = o.short;
  }
}

/**
 * Unboxed corner data, in the manner of a targeting display. Shown with the
 * controls; decorative (aria-hidden) because every value is also exposed by
 * a real control or the status announcer.
 */
export class SitrepCornersElement extends UIElement {
  #playback = new PlayerController(this, playerContext, selectPlayback);
  #time = new PlayerController(this, playerContext, selectTime);
  #quality = new PlayerController(this, playerContext, selectQuality);
  #rate = new PlayerController(this, playerContext, selectPlaybackRate);
  #metadata = new PlayerController(this, playerContext, selectMetadata);
  #error = new PlayerController(this, playerContext, selectError);
  #built = false;
  #rec!: HTMLElement;
  #tc!: HTMLElement;
  #pq!: HTMLElement;
  #optic!: HTMLElement;
  #title!: HTMLElement;
  #onOptic = () => this.#renderOptic();

  connectedCallback() {
    super.connectedCallback();
    if (!this.#built) {
      this.#built = true;
      this.setAttribute('aria-hidden', 'true');
      this.innerHTML = `
        <div class="sr-corner sr-corner-tl">
          <span class="sr-corner-line"><i class="sr-rec-dot"></i><b data-part="rec">HOLD</b><span class="sr-corner-dim" data-part="tc">T+00:00.0</span></span>
          <span class="sr-corner-line sr-corner-dim sr-corner-sub" data-part="title">MK-1</span>
        </div>
        <div class="sr-corner sr-corner-tr">
          <span class="sr-corner-line" data-part="pq">PQ-AUTO · 1.0X</span>
          <span class="sr-corner-line sr-corner-sub">OPTIC <b class="sr-optic-tag" data-part="optic">STD</b></span>
        </div>`;
      this.#rec = this.querySelector('[data-part="rec"]')!;
      this.#tc = this.querySelector('[data-part="tc"]')!;
      this.#pq = this.querySelector('[data-part="pq"]')!;
      this.#optic = this.querySelector('[data-part="optic"]')!;
      this.#title = this.querySelector('[data-part="title"]')!;
    }
    this.closest('.sr-skin')?.addEventListener(OPTIC_EVENT, this.#onOptic);
    this.#renderOptic();
  }

  disconnectedCallback() {
    this.closest('.sr-skin')?.removeEventListener(OPTIC_EVENT, this.#onOptic);
    super.disconnectedCallback();
  }

  #renderOptic() {
    if (!this.#built) return;
    const mode = opticOf(this.closest('.sr-skin'));
    this.#optic.textContent = OPTICS.find((o) => o.mode === mode)!.short;
    this.#optic.toggleAttribute('data-active', mode !== 'std');
  }

  update(changed: PropertyValues) {
    super.update(changed);
    if (!this.#built) return;
    const pb = this.#playback.value;
    let state = 'hold';
    let label = 'HOLD';
    if (this.#error.value?.error) {
      state = 'error';
      label = 'NO LINK';
    } else if (pb?.waiting) {
      state = 'waiting';
      label = 'NO SIGNAL';
    } else if (pb?.ended) {
      state = 'ended';
      label = 'END';
    } else if (pb && !pb.paused) {
      state = 'rec';
      label = 'REC';
    }
    this.setAttribute('data-state', state);
    this.#rec.textContent = label;
    this.#tc.textContent = `T+${formatTimecode(this.#time.value?.currentTime ?? 0)}`;

    const h = this.#quality.value?.activeVideoRendition?.height;
    const spd = this.#rate.value?.playbackRate ?? 1;
    const rate = `${spd % 1 === 0 ? spd.toFixed(1) : spd.toFixed(2).replace(/0$/, '')}X`;
    this.#pq.textContent = `PQ-${h && h > 0 ? h : 'AUTO'} · ${rate}`;

    const title = this.#metadata.value?.title?.trim();
    this.#title.textContent = title ? `MK-1 // ${title}` : 'RUGGED MK-1';
  }
}

if (!customElements.get('sitrep-optic-button')) {
  customElements.define('sitrep-optic-button', SitrepOpticButtonElement);
}
if (!customElements.get('sitrep-corners')) {
  customElements.define('sitrep-corners', SitrepCornersElement);
}

/**
 * Keeps captions clear of the control panel. The native caption box can't be
 * styled inside mux-video's shadow root, so while controls are visible the
 * active cues are lifted (via the VTTCue line API) to sit just above the
 * bottom panel, measured live so it holds at every player size; they drop
 * back to their authored position when controls hide.
 */
export class SitrepCaptionLiftElement extends HTMLElement {
  #skin: HTMLElement | null = null;
  #media: HTMLMediaElement | null = null;
  #observer: MutationObserver | null = null;
  #bound = new WeakSet<TextTrack>();
  #raf = 0;

  connectedCallback() {
    this.hidden = true;
    this.#skin = this.closest<HTMLElement>('.sr-skin');
    if (!this.#skin) return;
    this.#observer = new MutationObserver(() => {
      this.#schedule();
      // The panel slides in; measure again once it has settled.
      setTimeout(() => this.#schedule(), 280);
    });
    this.#observer.observe(this.#skin, { attributes: true, attributeFilter: ['data-controls-visible'] });
    // Media is slotted into the skin by the host page; wait for it.
    queueMicrotask(() => this.#attach());
  }

  disconnectedCallback() {
    this.#observer?.disconnect();
    clearTimeout(this.#raf);
  }

  #attach() {
    this.#media = this.#skin?.querySelector<HTMLMediaElement>('mux-video, video') ?? null;
    const tracks = this.#media?.textTracks;
    if (!tracks) return;
    const bind = (t: TextTrack) => {
      if (this.#bound.has(t)) return;
      this.#bound.add(t);
      t.addEventListener('cuechange', () => this.#schedule());
    };
    for (const t of Array.from(tracks)) bind(t);
    tracks.addEventListener('addtrack', (e) => {
      const t = (e as TrackEvent).track as TextTrack | null;
      if (t) bind(t);
    });
    tracks.addEventListener('change', () => this.#schedule());
  }

  #schedule() {
    clearTimeout(this.#raf);
    this.#raf = window.setTimeout(() => this.#apply(), 0);
  }

  #apply() {
    const skin = this.#skin;
    const tracks = this.#media?.textTracks;
    if (!skin || !tracks) return;
    const lift = skin.hasAttribute('data-controls-visible');
    let line = 0;
    if (lift) {
      const panel = skin.querySelector<HTMLElement>('.sr-bottom-panel');
      const h = skin.clientHeight;
      if (!panel || h <= 0) return;
      // Layout position (offsetTop ignores the panel's slide-in transform).
      let top = 0;
      for (let el: HTMLElement | null = panel; el && el !== skin; el = el.offsetParent as HTMLElement | null) {
        top += el.offsetTop;
      }
      // Panel top as a % of player height, minus a small gap.
      line = ((top - 8) / h) * 100;
    }
    for (const t of Array.from(tracks)) {
      if (t.mode !== 'showing' || (t.kind !== 'subtitles' && t.kind !== 'captions')) continue;
      for (const cue of Array.from(t.activeCues ?? []) as VTTCue[]) {
        if (!('line' in cue)) continue;
        if (lift) {
          // Browsers place the cue's top edge at `line` (lineAlign is not
          // honoured everywhere), so subtract the cue's own height: native
          // caption text is ~5% of the video height per line, plus padding.
          const rows = cue.text.split('\n').length;
          cue.snapToLines = false;
          cue.lineAlign = 'start';
          cue.line = Math.max(4, Math.round((line - rows * 6.2) * 10) / 10);
        } else {
          cue.snapToLines = true;
          cue.lineAlign = 'start';
          cue.line = 'auto';
        }
      }
    }
  }
}

if (!customElements.get('sitrep-caption-lift')) {
  customElements.define('sitrep-caption-lift', SitrepCaptionLiftElement);
}
