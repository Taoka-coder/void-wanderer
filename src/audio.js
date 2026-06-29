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
        this.musicState = 'normal'; // 'normal' or 'boss'
        
        // Master gain nodes
        this.musicGain = null;
        this.sfxGain = null;

        // Audio elements
        this.mainMusic = null;
        this.bossMusic = null;
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

            // Initialize music audio elements
            this.mainMusic = new Audio('audio/main.mp3');
            this.mainMusic.loop = true;
            this.mainMusic.volume = this.musicVolume;
            
            this.bossMusic = new Audio('audio/boss.mp3');
            this.bossMusic.loop = true;
            this.bossMusic.volume = this.musicVolume;
        } catch (e) {
            console.warn("Failed to initialize Web Audio context:", e);
        }
    }

    setMusicVolume(vol) {
        this.musicVolume = vol;
        if (this.musicGain && this.ctx) {
            this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
        }
        if (this.mainMusic) this.mainMusic.volume = vol;
        if (this.bossMusic) this.bossMusic.volume = vol;
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

    setMusicState(state) {
        if (this.musicState === state) return;
        this.musicState = state;
        
        if (!this.musicEnabled) return;
        this.playStateMusic();
    }

    playStateMusic() {
        if (!this.musicEnabled) return;
        this.init();

        try {
            if (this.musicState === 'boss') {
                if (this.mainMusic) this.mainMusic.pause();
                if (this.bossMusic) {
                    this.bossMusic.currentTime = 0;
                    this.bossMusic.play().catch(err => console.warn("Failed to play boss music:", err));
                }
            } else {
                if (this.bossMusic) this.bossMusic.pause();
                if (this.mainMusic) {
                    this.mainMusic.play().catch(err => console.warn("Failed to play main music:", err));
                }
            }
        } catch (e) {
            console.warn("Music transition error:", e);
        }
    }

    startMusic(reset = false) {
        this.init();
        if (reset) {
            if (this.mainMusic) this.mainMusic.currentTime = 0;
            if (this.bossMusic) this.bossMusic.currentTime = 0;
        }
        if (this.musicEnabled) return;
        this.musicEnabled = true;
        this.playStateMusic();
    }

    stopMusic() {
        this.musicEnabled = false;
        if (this.mainMusic) this.mainMusic.pause();
        if (this.bossMusic) this.bossMusic.pause();
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
