// Web Audio API synthesizer for clean, zero-dependency notification chimes

class SoundNotifier {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playEntry() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Rising pleasant two-tone chime
      this.tone(587.33, now, 0.12, 0.15); // D5
      this.tone(880.0, now + 0.12, 0.25, 0.2); // A5
    } catch {
      // Audio autoplay might be blocked until user gesture
    }
  }

  playWin() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Celebratory chord: C5 -> E5 -> G5
      this.tone(523.25, now, 0.1, 0.15);
      this.tone(659.25, now + 0.1, 0.1, 0.18);
      this.tone(783.99, now + 0.2, 0.35, 0.22);
    } catch {
      // Ignore
    }
  }

  playLoss() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Soft gentle descending tone
      this.tone(440.0, now, 0.15, 0.15);
      this.tone(349.23, now + 0.15, 0.3, 0.15);
    } catch {
      // Ignore
    }
  }

  private tone(freq: number, start: number, duration: number, maxGain: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(maxGain, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(start);
    osc.stop(start + duration);
  }
}

export const sound = new SoundNotifier();
export const soundNotifier = sound;
