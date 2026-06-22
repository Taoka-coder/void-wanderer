// Sound Synth Engine using Web Audio API for Void Wanderer
// Handles background music loops and synthesised sound effects

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.musicVolume = 0.40; // 40% default volume
        this.sfxVolume = 0.70;   // 70% default volume

        // Load volumes from local storage
        try {
            const savedMusic = localStorage.getItem('void_wanderer_vol_music');
            if (savedMusic !== null) this.musicVolume = parseFloat(savedMusic);
            
            const savedSFX = localStorage.getItem('void_wanderer_vol_sfx');
            if (savedSFX !== null) this.sfxVolume = parseFloat(savedSFX);
        } catch (e) {
            console.warn("Could not load volumes:", e);
        }

        this.musicEnabled = false;

        // Music Sequencer state
        this.tempo = 80; // 80 BPM
        this.step = 0;
        this.nextNoteTime = 0.0;
        this.schedulerTimer = null;

        // Master gain nodes
        this.musicGain = null;
        this.sfxGain = null;
    }

    init() {
        if (this.ctx) return;
        
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create gain nodes for mixing
            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
            this.musicGain.connect(this.ctx.destination);
            
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
            this.sfxGain.connect(this.ctx.destination);
        } catch (e) {
            console.warn("Failed to initialize Web Audio context:", e);
        }
    }

    setMusicVolume(vol) {
        this.musicVolume = vol;
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
        }
        try {
            localStorage.setItem('void_wanderer_vol_music', vol.toString());
        } catch (e) {}
    }

    setSFXVolume(vol) {
        this.sfxVolume = vol;
        if (this.sfxGain && this.ctx) {
            this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
        }
        try {
            localStorage.setItem('void_wanderer_vol_sfx', vol.toString());
        } catch (e) {}
    }

    startMusic() {
        this.init();
        if (this.musicEnabled || !this.ctx) return;
        this.musicEnabled = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.step = 0;

        // Loop look-ahead scheduler every 100ms
        this.schedulerTimer = setInterval(() => {
            this.scheduler();
        }, 100);
    }

    stopMusic() {
        this.musicEnabled = false;
        if (this.schedulerTimer) {
            clearInterval(this.schedulerTimer);
            this.schedulerTimer = null;
        }
    }

    scheduler() {
        if (!this.musicEnabled || !this.ctx) return;
        // Schedule notes 200ms ahead
        while (this.nextNoteTime < this.ctx.currentTime + 0.200) {
            this.scheduleNote(this.step, this.nextNoteTime);
            this.advanceNote();
        }
    }

    advanceNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        const secondsPerStep = secondsPerBeat / 2; // 8th notes (0.375s per step at 80 BPM)
        this.nextNoteTime += secondsPerStep;
        this.step = (this.step + 1) % 32; // 32-step loop
    }

    playSynthNote(freq, type, volume, duration, time, lowpassFreq = null) {
        if (!this.ctx || !this.musicEnabled) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            let targetNode = gain;

            osc.type = type;
            osc.frequency.setValueAtTime(freq, time);

            if (lowpassFreq) {
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(lowpassFreq, time);
                osc.connect(filter);
                targetNode = filter;
            } else {
                osc.connect(gain);
            }

            gain.connect(this.musicGain);

            // Envelope: fast linear attack, exponential release
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(volume, time + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

            osc.start(time);
            osc.stop(time + duration);
        } catch (e) {
            // Silence scheduler errors
        }
    }

    scheduleNote(step, time) {
        if (!this.ctx) return;

        let bassFreq = 0;
        let melodyFreq = 0;
        let playBass = false;
        let playMelody = false;

        // Haunted D minor progression (Steps 0-31)
        if (step >= 0 && step < 8) {
            // Chord 1: D minor
            if (step === 0) { bassFreq = 73.42; playBass = true; } // D2
            if (step === 4) { bassFreq = 110.00; playBass = true; } // A2

            if (step % 2 === 0) {
                playMelody = true;
                const melodyPatterns = [293.66, 349.23, 440.00, 349.23]; // D4, F4, A4, F4
                melodyFreq = melodyPatterns[(step / 2) % 4];
            }
        } else if (step >= 8 && step < 16) {
            // Chord 2: G minor
            if (step === 8) { bassFreq = 97.99; playBass = true; } // G2
            if (step === 12) { bassFreq = 146.83; playBass = true; } // D3

            if (step % 2 === 0) {
                playMelody = true;
                const melodyPatterns = [293.66, 392.00, 466.16, 392.00]; // D4, G4, Bb4, G4
                melodyFreq = melodyPatterns[((step - 8) / 2) % 4];
            }
        } else if (step >= 16 && step < 24) {
            // Chord 3: C major (Dorian feel)
            if (step === 16) { bassFreq = 65.41; playBass = true; } // C2
            if (step === 20) { bassFreq = 97.99; playBass = true; } // G2

            if (step % 2 === 0) {
                playMelody = true;
                const melodyPatterns = [329.63, 392.00, 523.25, 392.00]; // E4, G4, C5, G4
                melodyFreq = melodyPatterns[((step - 16) / 2) % 4];
            }
        } else if (step >= 24 && step < 32) {
            // Chord 4: A major (Gothic harmonic resolver)
            if (step === 24) { bassFreq = 110.00; playBass = true; } // A2
            if (step === 28) { bassFreq = 164.81; playBass = true; } // E3

            if (step % 2 === 0) {
                playMelody = true;
                const melodyPatterns = [329.63, 415.30, 440.00, 329.63]; // E4, G#4, A4, E4
                melodyFreq = melodyPatterns[((step - 24) / 2) % 4];
            }
        }

        // Add a quiet high voice backing note at the downbeat of each chord
        let droneFreq = 0;
        let playDrone = false;
        if (step === 0) { droneFreq = 587.33; playDrone = true; }   // D5
        if (step === 8) { droneFreq = 783.99; playDrone = true; }   // G5
        if (step === 16) { droneFreq = 1046.50; playDrone = true; }  // C6
        if (step === 24) { droneFreq = 880.00; playDrone = true; }   // A5

        if (playBass && bassFreq > 0) {
            this.playSynthNote(bassFreq, 'triangle', 0.12, 0.7, time); // Deep pulse
        }

        if (playMelody && melodyFreq > 0) {
            // Spooky dark organ voice
            this.playSynthNote(melodyFreq, 'sawtooth', 0.05, 0.45, time, 450);
        }

        if (playDrone && droneFreq > 0) {
            this.playSynthNote(droneFreq, 'sine', 0.02, 1.4, time);
        }
    }

    play(type) {
        this.init();
        if (!this.ctx) return;

        try {
            const now = this.ctx.currentTime;

            if (type === 'slash') {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
                
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now);
                osc.stop(now + 0.15);

            } else if (type === 'arrow') {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
                
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now);
                osc.stop(now + 0.1);

            } else if (type === 'spell') {
                const osc = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.exponentialRampToValueAtTime(450, now + 0.25);
                
                filter.type = 'peaking';
                filter.frequency.setValueAtTime(300, now);
                filter.frequency.exponentialRampToValueAtTime(1000, now + 0.25);
                
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now);
                osc.stop(now + 0.25);

            } else if (type === 'hit') {
                // Enemy standard damage hit
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, now);
                osc.frequency.exponentialRampToValueAtTime(10, now + 0.1);
                
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now);
                osc.stop(now + 0.1);

            } else if (type === 'player_hit') {
                // Gritty player damage crunch
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(130, now);
                osc.frequency.linearRampToValueAtTime(10, now + 0.35);
                
                gain.gain.setValueAtTime(0.65, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now);
                osc.stop(now + 0.35);

                // Add synthetic noise crunch
                const bufferSize = this.ctx.sampleRate * 0.12;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;
                
                const noiseFilter = this.ctx.createBiquadFilter();
                noiseFilter.type = 'bandpass';
                noiseFilter.frequency.setValueAtTime(220, now);
                
                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(0.25, now);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                
                noise.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(this.sfxGain);
                noise.start(now);

            } else if (type === 'heal') {
                // Magical ascending arpeggio chime
                const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.05);
                    gain.gain.setValueAtTime(0.12, now + idx * 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);
                    
                    osc.connect(gain);
                    gain.connect(this.sfxGain);
                    osc.start(now + idx * 0.05);
                    osc.stop(now + idx * 0.05 + 0.25);
                });

            } else if (type === 'coin_pickup') {
                // Swift bright double metal ping
                const notes = [987.77, 1318.51]; // B5, E6
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.04);
                    gain.gain.setValueAtTime(0.2, now + idx * 0.04);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.2);
                    
                    osc.connect(gain);
                    gain.connect(this.sfxGain);
                    osc.start(now + idx * 0.04);
                    osc.stop(now + idx * 0.04 + 0.2);
                });

            } else if (type === 'slime_die') {
                // Squelching pitch slide downwards
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(280, now);
                osc.frequency.linearRampToValueAtTime(20, now + 0.22);
                
                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now);
                osc.stop(now + 0.22);

            } else if (type === 'bat_die') {
                // High frequency fluttery double chirp
                const delays = [0, 0.06];
                delays.forEach((delay) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(1500, now + delay);
                    osc.frequency.exponentialRampToValueAtTime(800, now + delay + 0.06);
                    
                    gain.gain.setValueAtTime(0.18, now + delay);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);
                    
                    osc.connect(gain);
                    gain.connect(this.sfxGain);
                    osc.start(now + delay);
                    osc.stop(now + delay + 0.06);
                });

            } else if (type === 'goblin_die') {
                // Raspy dry skeleton/goblin grunt
                const osc = this.ctx.createOscillator();
                const filter = this.ctx.createBiquadFilter();
                const gain = this.ctx.createGain();
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(260, now);
                osc.frequency.linearRampToValueAtTime(60, now + 0.2);
                
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(320, now);
                
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now);
                osc.stop(now + 0.2);

            } else if (type === 'boss_die') {
                // Series of deep explosive sweeps
                for (let i = 0; i < 6; i++) {
                    const delay = i * 0.18;
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(140 - i * 16, now + delay);
                    osc.frequency.exponentialRampToValueAtTime(10, now + delay + 0.35);
                    
                    gain.gain.setValueAtTime(0.45 - i * 0.05, now + delay);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
                    
                    osc.connect(gain);
                    gain.connect(this.sfxGain);
                    osc.start(now + delay);
                    osc.stop(now + delay + 0.35);
                }

            } else if (type === 'boss_scream') {
                // Menacing modulated guttural growl
                const osc = this.ctx.createOscillator();
                const fmOsc = this.ctx.createOscillator();
                const fmGain = this.ctx.createGain();
                const gain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(110, now);
                osc.frequency.linearRampToValueAtTime(75, now + 0.65);
                
                fmOsc.frequency.setValueAtTime(20, now); // 20Hz rapid vibrato
                fmGain.gain.setValueAtTime(30, now);     // 30Hz pitch warp depth
                
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(450, now);
                filter.frequency.linearRampToValueAtTime(220, now + 0.65);
                
                gain.gain.setValueAtTime(0.55, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
                
                fmOsc.connect(fmGain);
                fmGain.connect(osc.frequency);
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.sfxGain);
                
                fmOsc.start(now);
                osc.start(now);
                fmOsc.stop(now + 0.65);
                osc.stop(now + 0.65);

            } else if (type === 'gamble_start') {
                // Ascending fate chord
                const notes = [261.6, 329.6, 392.0, 523.3];
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.1);
                    gain.gain.setValueAtTime(0.12, now + idx * 0.1);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.4);
                    
                    osc.connect(gain);
                    gain.connect(this.sfxGain);
                    osc.start(now + idx * 0.1);
                    osc.stop(now + idx * 0.1 + 0.4);
                });

            } else if (type === 'gamble_end') {
                // Success gamble chime
                const notes = [523.3, 659.3, 784.0];
                notes.forEach((freq, idx) => {
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                    gain.gain.setValueAtTime(0.15, now + idx * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.08 + 0.3);
                    osc.connect(gain);
                    gain.connect(this.sfxGain);
                    osc.start(now + idx * 0.08);
                    osc.stop(now + idx * 0.08 + 0.3);
                });

            } else if (type === 'pickup') {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(880, now + 0.08);
                
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
                
                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now);
                osc.stop(now + 0.18);
            }
        } catch (e) {
            console.warn("Audio play error:", e);
        }
    }
}

export const audio = new SoundEngine();
export default audio;
