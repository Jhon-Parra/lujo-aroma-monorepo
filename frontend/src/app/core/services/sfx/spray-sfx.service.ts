import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SpraySfxService {
  private armed = false;

  armSprayOnLoad(): void {
    if (this.armed) return;
    this.armed = true;

    if (typeof window === 'undefined') return;

    const handler = () => {
      this.disarm(handler);
      this.playSprayOnce();
    };

    // Autoplay policies: audio must start after a user gesture.
    window.addEventListener('pointerdown', handler, { once: true, passive: true });
    window.addEventListener('touchstart', handler, { once: true, passive: true });
    window.addEventListener('keydown', handler, { once: true, passive: true } as any);
  }

  // Backwards-compatible name (older callers).
  armFirstVisitSpray(): void {
    this.armSprayOnLoad();
  }

  private disarm(handler: any): void {
    if (typeof window === 'undefined') return;
    try { window.removeEventListener('pointerdown', handler); } catch { /* ignore */ }
    try { window.removeEventListener('touchstart', handler); } catch { /* ignore */ }
    try { window.removeEventListener('keydown', handler); } catch { /* ignore */ }
  }

  private playSprayOnce(): boolean {
    if (typeof window === 'undefined') return false;

    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return false;

    let ctx: AudioContext;
    try {
      ctx = new Ctx();
    } catch {
      return false;
    }

    let closing = false;
    const safeClose = () => {
      if (closing) return;
      closing = true;
      try {
        const st = (ctx as any)?.state;
        if (st === 'closed') return;
        const p = (ctx as any)?.close?.();
        if (p && typeof (p as any).catch === 'function') {
          (p as Promise<any>).catch(() => { /* ignore */ });
        }
      } catch {
        // ignore
      }
    };

    try {
      const play = () => {
        // "Spray" approximation: filtered noise burst with a soft envelope.
        const duration = 0.55;
        const sampleRate = ctx.sampleRate;
        const frames = Math.max(1, Math.floor(sampleRate * duration));

        const buffer = ctx.createBuffer(1, frames, sampleRate);
        const data = buffer.getChannelData(0);

        // White noise with slight amplitude taper to avoid clicks.
        for (let i = 0; i < frames; i++) {
          const t = i / frames;
          const env = 1 - t;
          data[i] = (Math.random() * 2 - 1) * 0.35 * env;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 1800;
        bandpass.Q.value = 0.9;

        const highpass = ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 600;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

        source.connect(bandpass);
        bandpass.connect(highpass);
        highpass.connect(gain);
        gain.connect(ctx.destination);

        source.start();
        source.stop(ctx.currentTime + duration);

        source.onended = () => {
          safeClose();
        };
      };

      // Some browsers start AudioContext in "suspended" and require resume in a gesture.
      const anyCtx: any = ctx as any;
      const resume = typeof anyCtx.resume === 'function' ? anyCtx.resume() : null;
      Promise.resolve(resume).then(play).catch(() => {
        try { play(); } catch { /* ignore */ }
      });

      return true;
    } catch {
      safeClose();
      return false;
    }
  }
}
