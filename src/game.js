// Main Game Engine for Void Wanderer
// Manages loops, states, rendering, inputs, room transitions, and synth audio effects

import { Dungeon, ROOM_TYPES, START_X, START_Y } from './dungeon.js?v=47';
import { Player, Enemy, Boss, Drop, ARTIFACTS_DATABASE } from './entities.js?v=47';
import { updateAndDrawParticles, clearParticles, spawnSmoke, spawnSparkles, spawnFloatingText, spawnEmbers } from './particles.js?v=47';
import { performMysteryGamble, MysteryManNPC } from './mysteryMan.js?v=47';
import { ShopkeeperNPC } from './shop.js?v=47';
import { audio } from './audio.js?v=47';

const BOSS_DIALOGUES = {
    'THE GOLEM': {
        avatar: '🗿',
        name: 'THE GOLEM',
        dialogue: [
            { speaker: 'boss', text: "Intruder... You disturb the sanctuary of the stone root." },
            { speaker: 'player', text: "I only seek passage. Step aside, stone guardian." },
            { speaker: 'boss', text: "None pass. The forest demands your dust." }
        ]
    },
    'GIANT SPIDER': {
        avatar: '🕸️',
        name: 'GIANT SPIDER',
        dialogue: [
            { speaker: 'boss', text: "Ssss... Fresh warmth crawls into my web." },
            { speaker: 'player', text: "Keep your fangs to yourself, beast." },
            { speaker: 'boss', text: "You will hang silent in my cocoon forever." }
        ]
    },
    'ANCIENT TREANT': {
        avatar: '🌳',
        name: 'ANCIENT TREANT',
        dialogue: [
            { speaker: 'boss', text: "The wood remembers your kind. Axe-bearers. Fire-bringers." },
            { speaker: 'player', text: "I bring no fire, only steel for those who block my way." },
            { speaker: 'boss', text: "Then let my roots bury your steel." }
        ]
    },
    'SHADOW KNIGHT': {
        avatar: '🛡️',
        name: 'SHADOW KNIGHT',
        dialogue: [
            { speaker: 'boss', text: "Yield, mortal. You tread upon the shadow realm of the fallen." },
            { speaker: 'player', text: "A knight without a master is just a hollow shell." },
            { speaker: 'boss', text: "My blade shall teach you respect for the dark!" }
        ]
    },
    'PHANTOM WITCH': {
        avatar: '🔮',
        name: 'PHANTOM WITCH',
        dialogue: [
            { speaker: 'boss', text: "Hehehe... another lamb straying into the twilight." },
            { speaker: 'player', text: "Your illusions won't save you, witch." },
            { speaker: 'boss', text: "Illusions? No, dear child... shadow is my absolute truth." }
        ]
    },
    'DARK GARGOYLE': {
        avatar: '🦇',
        name: 'DARK GARGOYLE',
        dialogue: [
            { speaker: 'boss', text: "Krrr... From stone I awaken to crush your bones." },
            { speaker: 'player', text: "Go back to sleep, flying pest." },
            { speaker: 'boss', text: "My wings shall carry your remnants to the peaks!" }
        ]
    },
    'NECROMANCER': {
        avatar: '💀',
        name: 'NECROMANCER',
        dialogue: [
            { speaker: 'boss', text: "Ah, a fine addition to my army of the dead." },
            { speaker: 'player', text: "You'll have to die first to make me one." },
            { speaker: 'boss', text: "Death is but a transition... one I shall grant you now!" }
        ]
    },
    'BONE COLOSSUS': {
        avatar: '☠️',
        name: 'BONE COLOSSUS',
        dialogue: [
            { speaker: 'boss', text: "THE GRAVE CALLS FOR YOU." },
            { speaker: 'player', text: "I'm not ready to be buried yet." },
            { speaker: 'boss', text: "ALL SHALL BE CRUSHED." }
        ]
    },
    'PLAGUE DOCTOR': {
        avatar: '🎭',
        name: 'PLAGUE DOCTOR',
        dialogue: [
            { speaker: 'boss', text: "Your soul is infected. I must purge the sickness." },
            { speaker: 'player', text: "You look more like the disease than the cure." },
            { speaker: 'boss', text: "A painful cure is still a cure... hold still!" }
        ]
    },
    'FIRE DEMON': {
        avatar: '😈',
        name: 'FIRE DEMON',
        dialogue: [
            { speaker: 'boss', text: "Mortal flesh burns so easily. Welcome to your pyre." },
            { speaker: 'player', text: "I've faced worse heat than this." },
            { speaker: 'boss', text: "Then let the inferno consume your arrogance!" }
        ]
    },
    'INFERNAL DRAKE': {
        avatar: '🐉',
        name: 'INFERNAL DRAKE',
        dialogue: [
            { speaker: 'boss', text: "Gyaaaaar! You dare enter the dragon's hearth?" },
            { speaker: 'player', text: "Your fire is bright, but my focus is sharper." },
            { speaker: 'boss', text: "Ash and soot shall be all that remains of you!" }
        ]
    },
    'MAGMA TITAN': {
        avatar: '🌋',
        name: 'MAGMA TITAN',
        dialogue: [
            { speaker: 'boss', text: "THE CORE AWAKENS. CRUSH THE FLESH." },
            { speaker: 'player', text: "You're just walking rock. I've broken stone before." },
            { speaker: 'boss', text: "MELT IN THE FIRES OF THE EARTH!" }
        ]
    },
    'THE VOID EYE': {
        avatar: '👁️',
        name: 'THE VOID EYE',
        dialogue: [
            { speaker: 'boss', text: "We see you. We know your past. We know your doom." },
            { speaker: 'player', text: "Stare all you want. I came here to win." },
            { speaker: 'boss', text: "You cannot defeat what has already observed your end." }
        ]
    },
    'COSMIC HORROR': {
        avatar: '🦑',
        name: 'COSMIC HORROR',
        dialogue: [
            { speaker: 'boss', text: "Your mind is fragile. Peer into the infinite madness." },
            { speaker: 'player', text: "I've seen the depths of the void. You don't scare me." },
            { speaker: 'boss', text: "Let the stars weep as your sanity shatters..." }
        ]
    },
    'SHADOW OVERLORD': {
        avatar: '👑',
        name: 'SHADOW OVERLORD',
        dialogue: [
            { speaker: 'boss', text: "So, the wanderer finally reaches the throne of the void." },
            { speaker: 'player', text: "Your reign ends here, Overlord." },
            { speaker: 'boss', text: "This is not an end. It is the void's eternal embrace." }
        ]
    }
};

class Game {
    constructor() {
        window.game = this;
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        
        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        // State Machine
        this.states = {
            START: 'start',
            PLAYING: 'playing',
            GAMBLE: 'gamble',
            SHOP: 'shop',
            GAMEOVER: 'gameover',
            VICTORY: 'victory',
            SETTINGS: 'settings',
            DIALOGUE: 'dialogue'
        };
        this.currentState = this.states.START;
        this.previousState = this.states.START;

        // Key bindings default mapping
        this.keyBinds = {
            moveUp: 'w',
            moveDown: 's',
            moveLeft: 'a',
            moveRight: 'd',
            aimUp: 'arrowup',
            aimDown: 'arrowdown',
            aimLeft: 'arrowleft',
            aimRight: 'arrowright',
            interact: 'e'
        };
        this.rebindingAction = null; // Used to track which action is being rebound

        // Load custom keybinds
        try {
            const savedBinds = localStorage.getItem('void_wanderer_keybinds');
            if (savedBinds) {
                Object.assign(this.keyBinds, JSON.parse(savedBinds));
            }
        } catch (e) {
            console.warn("Could not load key binds:", e);
        }

        // Player & Level
        this.level = 1;
        this.dungeon = null;
        this.player = null;
        this.projectiles = [];
        this.mysteryManNPC = null;
        this.mysteryManInteractedThisLevel = false;
        this.shopkeeperNPC = null;
        this.shopkeeperBannedLevel = -1;
        this.shopkeeperInteractedThisLevel = false;

        // Stat tracking for summary screen
        this.mobsKilled = 0;
        this.roomsCleared = 0;

        // Input buffers
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.mouseClicked = false;

        // Transition trackers
        this.transitioning = false;
        this.transitionTimer = 0;
        this.transitionDir = ''; // 'up', 'down', 'left', 'right'
        this.targetRoomX = 0;
        this.targetRoomY = 0;

        this.setupInputListeners();
        this.setupUIListeners();
        this.checkSaveExists();
    }

    setupInputListeners() {
        const debugKeysEl = document.getElementById('debug-keys');
        
        const handleKeyDown = (e) => {
            try {
                // If in dialogue mode, intercept space/enter/arrow keys to advance text
                if (this.currentState === this.states.DIALOGUE) {
                    if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter' || e.code === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        this.advanceBossDialogue();
                    }
                    return;
                }

                // If rebinding, intercept and record key
                if (this.rebindingAction) {
                    e.preventDefault();
                    e.stopPropagation();
                    const newKey = e.key ? e.key.toLowerCase() : e.code.toLowerCase();
                    this.completeRebind(this.rebindingAction, newKey);
                    return;
                }

                // Pause Settings menu toggle
                if (e.key === 'Escape' || e.code === 'Escape') {
                    if (this.currentState === this.states.PLAYING || this.currentState === this.states.START) {
                        this.openSettingsMenu();
                    } else if (this.currentState === this.states.SETTINGS) {
                        this.closeSettingsMenu();
                    } else if (this.currentState === this.states.GAMBLE) {
                        // Only allow exit if the coin is not currently spinning
                        const coinContainer = document.getElementById('gamble-wheel-container');
                        if (coinContainer && coinContainer.classList.contains('hidden')) {
                            this.closeGambleOverlay();
                        }
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                if (this.currentState === this.states.GAMBLE) {
                    if (e.code === 'Space' || e.key === ' ') {
                        // Only allow flipping if the coin is not already spinning
                        const coinContainer = document.getElementById('gamble-wheel-container');
                        if (coinContainer && coinContainer.classList.contains('hidden')) {
                            this.gambleFate();
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                }

                if (e.code) {
                    const codeLower = e.code.toLowerCase();
                    this.keys[codeLower] = true;
                    
                    // Map physical KeyW/A/S/D/E to simple letters
                    if (e.code.startsWith('Key')) {
                        const char = e.code.substring(3).toLowerCase();
                        this.keys[char] = true;
                    }
                    // Map physical Digit1/2/3 to numbers
                    if (e.code.startsWith('Digit')) {
                        const num = e.code.substring(5);
                        this.keys[num] = true;
                    }
                }
                
                if (e.key) {
                    const keyLower = e.key.toLowerCase();
                    this.keys[keyLower] = true;
                }
                
                // Developer debug kill key on "K"
                if (e.key === 'k' || e.key === 'K' || e.code === 'KeyK') {
                    const room = this.dungeon ? this.dungeon.activeRoom : null;
                    if (this.currentState === this.states.PLAYING && room && room.mobs) {
                        room.mobs = [];
                        spawnSparkles(this.player.x, this.player.y, '#ef4444', 20);
                        spawnFloatingText(this.player.x, this.player.y - 30, "DEBUG: ENEMIES BANISHED", '#ef4444', 12);
                    }
                }

                // Switch weapons (handle both code and key fallback)
                if (this.currentState === this.states.PLAYING) {
                    if (e.code === 'Digit1' || e.key === '1') this.selectWeapon('sword');
                    if (e.code === 'Digit2' || e.key === '2') this.selectWeapon('bow');
                    if (e.code === 'Digit3' || e.key === '3') this.selectWeapon('magic');
                    
                    // Special Spell charge trigger on "F"
                    if (e.key === 'f' || e.key === 'F' || e.code === 'KeyF') {
                        if (this.player.currentWeapon === 'magic') {
                            if (!this.player.specialSpellCharged) {
                                if (this.player.mana >= 50) {
                                    this.player.mana -= 50;
                                    this.player.manaRegenDelay = 3600; // Delay mana regeneration
                                    this.player.specialSpellCharged = true;
                                    
                                    audio.play('spell');
                                    spawnSparkles(this.player.x, this.player.y, '#22d3ee', 25);
                                    spawnFloatingText(this.player.x, this.player.y - 30, "LIGHTNING CHARGED!", '#22d3ee', 14);
                                    
                                    this.updateHUDHealth();
                                    this.updateHUDStats();
                                } else {
                                    spawnFloatingText(this.player.x, this.player.y - 30, "OUT OF MANA (Need 50)!", '#06b6d4', 12);
                                }
                            } else {
                                spawnFloatingText(this.player.x, this.player.y - 30, "ALREADY CHARGED!", '#22d3ee', 12);
                            }
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                        }
                    }
                    
                    // Interact check using rebindable key
                    const interactKey = this.keyBinds.interact.toLowerCase();
                    const isInteractPressed = (e.key && e.key.toLowerCase() === interactKey) || 
                                              (e.code && e.code.toLowerCase() === interactKey) ||
                                              (e.code && e.code.toLowerCase() === 'key' + interactKey);
                    if (isInteractPressed) {
                        this.checkMysteryManInteraction();
                        this.checkShopkeeperInteraction();
                    }
                }
            } catch (err) {
                console.error("Error in keydown handler:", err);
            }
        };

        const handleKeyUp = (e) => {
            try {
                if (this.rebindingAction) return;

                if (e.code) {
                    const codeLower = e.code.toLowerCase();
                    this.keys[codeLower] = false;
                    
                    if (e.code.startsWith('Key')) {
                        const char = e.code.substring(3).toLowerCase();
                        this.keys[char] = false;
                    }
                    if (e.code.startsWith('Digit')) {
                        const num = e.code.substring(5);
                        this.keys[num] = false;
                    }
                }
                
                if (e.key) {
                    const keyLower = e.key.toLowerCase();
                    this.keys[keyLower] = false;
                }
            } catch (err) {
                console.error("Error in keyup handler:", err);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Mouse aiming inside Canvas bounds
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Scale mouse coordinates relative to actual 800x600 canvas resolution
            this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left Click
                this.mouseClicked = true;
                
                // Custom click interaction with Mystery Man if within click distance
                if (this.currentState === this.states.PLAYING) {
                    this.checkMysteryManInteraction(true);
                    this.checkShopkeeperInteraction(true);
                }
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouseClicked = false;
        });

        // Mouse scroll wheel weapon select
        this.canvas.addEventListener('wheel', (e) => {
            if (this.currentState !== this.states.PLAYING) return;
            e.preventDefault();
            const weapons = ['sword', 'bow', 'magic'];
            let idx = weapons.indexOf(this.player.currentWeapon);
            if (e.deltaY > 0) {
                idx = (idx + 1) % weapons.length;
            } else {
                idx = (idx - 1 + weapons.length) % weapons.length;
            }
            this.selectWeapon(weapons[idx]);
        }, { passive: false });
    }

    setupUIListeners() {
        document.getElementById('btn-start').addEventListener('click', () => {
            audio.init();
            this.startGame();
        });

        const btnSettingsStart = document.getElementById('btn-settings-start');
        if (btnSettingsStart) {
            btnSettingsStart.addEventListener('click', () => {
                this.openSettingsMenu();
            });
        }

        const btnHudSettings = document.getElementById('btn-hud-settings');
        if (btnHudSettings) {
            btnHudSettings.addEventListener('click', () => {
                if (this.currentState === this.states.PLAYING) {
                    this.openSettingsMenu();
                }
            });
        }

        const btnContinue = document.getElementById('btn-continue');
        if (btnContinue) {
            btnContinue.addEventListener('click', () => {
                audio.init();
                this.loadGame();
            });
        }

        const sliderMusic = document.getElementById('slider-music');
        if (sliderMusic) {
            sliderMusic.addEventListener('input', (e) => {
                const vol = parseFloat(e.target.value) / 100;
                audio.setMusicVolume(vol);
                document.getElementById('label-music-val').textContent = `${e.target.value}%`;
                audio.startMusic();
            });
        }

        const sliderSFX = document.getElementById('slider-sfx');
        if (sliderSFX) {
            sliderSFX.addEventListener('input', (e) => {
                const vol = parseFloat(e.target.value) / 100;
                audio.setSFXVolume(vol);
                document.getElementById('label-sfx-val').textContent = `${e.target.value}%`;
                audio.play('coin_pickup');
            });
        }

        const actions = ['moveUp', 'moveDown', 'moveLeft', 'moveRight', 'aimUp', 'aimDown', 'aimLeft', 'aimRight', 'interact'];
        actions.forEach(action => {
            const btn = document.getElementById(`btn-rebind-${action}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.startRebind(action);
                });
            }
        });

        const btnSettingsSave = document.getElementById('btn-settings-save');
        if (btnSettingsSave) {
            btnSettingsSave.addEventListener('click', () => {
                this.saveGame();
            });
        }

        const btnSettingsMenu = document.getElementById('btn-settings-menu');
        if (btnSettingsMenu) {
            btnSettingsMenu.addEventListener('click', () => {
                this.exitToMainMenu();
            });
        }

        const btnSettingsClose = document.getElementById('btn-settings-close');
        if (btnSettingsClose) {
            btnSettingsClose.addEventListener('click', () => {
                this.closeSettingsMenu();
            });
        }

        document.getElementById('btn-restart').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('btn-victory-restart').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('btn-accept-gamble').addEventListener('click', () => {
            this.gambleFate();
        });

        document.getElementById('btn-decline-gamble').addEventListener('click', () => {
            this.closeGambleOverlay();
        });

        // Shop listeners
        document.getElementById('btn-shop-buy-stat').addEventListener('click', () => {
            this.buyShopStatUp();
        });
        document.getElementById('btn-shop-buy-heal').addEventListener('click', () => {
            this.buyShopHeal();
        });
        document.getElementById('btn-shop-rob').addEventListener('click', () => {
            this.robShopkeeper();
        });
        document.getElementById('btn-shop-close').addEventListener('click', () => {
            this.closeShopOverlay();
        });

        // Weapon HUD clicks
        document.getElementById('slot-sword').addEventListener('click', () => this.selectWeapon('sword'));
        document.getElementById('slot-bow').addEventListener('click', () => this.selectWeapon('bow'));
        document.getElementById('slot-magic').addEventListener('click', () => this.selectWeapon('magic'));

        // Boss Dialogue UI click listener
        document.getElementById('btn-boss-dialogue-next').addEventListener('click', () => {
            this.advanceBossDialogue();
        });
    }

    startGame() {
        // Reset counters
        this.level = 1;
        this.mobsKilled = 0;
        this.roomsCleared = 0;
        
        // Hide start / death / win overlays
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('victory-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');

        // Initialize Player & Procedural Generation
        this.player = new Player(400, 300);
        this.selectWeapon('sword');
        this.generateLevel();

        this.currentState = this.states.PLAYING;
        audio.startMusic(true);
        
        // Shift focus to the canvas for keyboard inputs
        if (this.canvas) {
            this.canvas.focus();
        }
    }

    generateLevel() {
        audio.setMusicState('normal');
        this.dungeon = new Dungeon(this.level);
        this.projectiles = [];
        clearParticles();
        this.mysteryManInteractedThisLevel = false;
        this.shopkeeperInteractedThisLevel = false;
        this.artifactFoundThisLevel = false;
        
        // Reset player positions to start room center
        this.player.x = 400;
        this.player.y = 300;

        if (this.player.hasArtifact('holy_grail')) {
            this.player.health = this.player.maxHealth;
            spawnSparkles(400, 300, '#fbbf24', 20);
            spawnFloatingText(400, 270, "GRAIL RESTORATION!", '#fbbf24', 16, true);
        }
        
        this.dungeon.activeRoom.visited = true;
        this.setupMysteryManNPC();
        this.setupShopkeeperNPC();

        // Refresh HTML stats HUD
        this.updateHUDStats();
        this.updateHUDHealth();
        this.updateLevelDisplay();
        
        // Render minimap initial state
        this.dungeon.drawMinimap(this.minimapCtx);
    }

    setupMysteryManNPC() {
        if (this.dungeon.activeRoom.type === ROOM_TYPES.MYSTERY && !this.mysteryManInteractedThisLevel) {
            this.mysteryManNPC = new MysteryManNPC(400, 300);
        } else {
            this.mysteryManNPC = null;
        }
    }

    setupShopkeeperNPC() {
        if (this.dungeon.activeRoom.type === ROOM_TYPES.SHOP && 
            !this.shopkeeperInteractedThisLevel && 
            this.level !== this.shopkeeperBannedLevel) {
            this.shopkeeperNPC = new ShopkeeperNPC(400, 230); // Spawn higher up to fit chair and table
        } else {
            this.shopkeeperNPC = null;
        }
    }

    selectWeapon(weaponType) {
        if (!this.player) return;
        this.player.currentWeapon = weaponType;
        
        // Update HUD slot indicators
        const slots = ['sword', 'bow', 'magic'];
        slots.forEach(slot => {
            const el = document.getElementById(`slot-${slot}`);
            if (slot === weaponType) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });
    }

    checkMysteryManInteraction(clicked = false) {
        if (!this.mysteryManNPC || this.mysteryManNPC.interacted) return;

        const maxInteractDist = clicked ? 80 : 50;
        const dx = this.player.x - this.mysteryManNPC.x;
        const dy = this.player.y - this.mysteryManNPC.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist <= maxInteractDist) {
            // Open interaction UI
            this.currentState = this.states.GAMBLE;
            document.getElementById('mystery-overlay').classList.remove('hidden');
        }
    }

    checkShopkeeperInteraction(clicked = false) {
        if (!this.shopkeeperNPC || this.shopkeeperNPC.interacted) return;

        const maxInteractDist = clicked ? 75 : 55;
        const dx = this.player.x - this.shopkeeperNPC.x;
        const dy = this.player.y - (this.shopkeeperNPC.y + 35); // measure distance from table center
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist <= maxInteractDist) {
            // Open interaction UI
            this.currentState = this.states.SHOP;
            
            // Set initial state of shop buttons (reset sold out classes)
            document.getElementById('shop-item-stat').classList.remove('sold-out');
            document.getElementById('shop-item-heal').classList.remove('sold-out');
            document.getElementById('btn-shop-buy-stat').disabled = false;
            document.getElementById('btn-shop-buy-heal').disabled = false;
            document.getElementById('btn-shop-rob').disabled = false;
            
            // Update coins display
            document.getElementById('shop-coins-display').textContent = this.player.coins || 0;
            document.getElementById('shop-overlay').classList.remove('hidden');
        }
    }

    buyShopStatUp() {
        if (this.player.coins < 15) {
            audio.play('player_hit'); // Buzz error sound
            spawnFloatingText(this.player.x, this.player.y - 30, "NOT ENOUGH COINS", '#ef4444', 12);
            return;
        }

        this.player.coins -= 15;
        document.getElementById('shop-coins-display').textContent = this.player.coins;
        this.updateHUDStats();
        audio.play('gamble_end'); // Magical positive chime

        // Apply a random stat up: Damage, Attack Speed, Speed, or Max HP
        const statType = Math.floor(Math.random() * 4);
        let text = "";
        let color = "";
        
        if (statType === 0) {
            this.player.damage += 1.0;
            text = "+1.0 Damage!";
            color = '#f59e0b';
        } else if (statType === 1) {
            this.player.attackSpeed += 0.35;
            text = "+35% Attack Speed!";
            color = '#a855f7';
        } else if (statType === 2) {
            this.player.speed += 0.5;
            text = "+0.5 Speed!";
            color = '#10b981';
        } else {
            this.player.addMaxHealth(1);
            this.player.heal(1);
            text = "+1 Max Heart!";
            color = '#ef4444';
        }

        // Float text above player
        spawnFloatingText(this.player.x, this.player.y - 30, text, color, 14);
        spawnSparkles(this.player.x, this.player.y, color, 15);

        // Mark item as sold out
        document.getElementById('shop-item-stat').classList.add('sold-out');
        document.getElementById('btn-shop-buy-stat').disabled = true;

        this.updateHUDHealth();
    }

    buyShopHeal() {
        if (this.player.coins < 5) {
            audio.play('player_hit'); // Buzz sound
            spawnFloatingText(this.player.x, this.player.y - 30, "NOT ENOUGH COINS", '#ef4444', 12);
            return;
        }
        if (this.player.health >= this.player.maxHealth) {
            audio.play('player_hit'); // Buzz sound
            spawnFloatingText(this.player.x, this.player.y - 30, "HEALTH ALREADY FULL", '#cbd5e1', 12);
            return;
        }

        this.player.coins -= 5;
        document.getElementById('shop-coins-display').textContent = this.player.coins;
        
        this.player.heal(2); // Heals 2 full hearts
        this.updateHUDHealth();
        audio.play('heal');

        spawnFloatingText(this.player.x, this.player.y - 30, "+2 Hearts Healed!", '#ef4444', 14);
        spawnSparkles(this.player.x, this.player.y, '#ef4444', 10);

        // Mark item as sold out
        document.getElementById('shop-item-heal').classList.add('sold-out');
        document.getElementById('btn-shop-buy-heal').disabled = true;
    }

    robShopkeeper() {
        this.shopkeeperNPC.interacted = true;
        
        const success = Math.random() < 0.3;
        
        if (success) {
            // Robbery success: free random stat up and full heal
            audio.play('gamble_end');
            
            // Full heal
            this.player.health = this.player.maxHealth;
            this.updateHUDHealth();

            // Random stat up
            const statType = Math.floor(Math.random() * 4);
            let text = "";
            let color = "";
            
            if (statType === 0) {
                this.player.damage += 1.0;
                text = "+1.0 Damage!";
                color = '#f59e0b';
            } else if (statType === 1) {
                this.player.attackSpeed += 0.35;
                text = "+35% Attack Speed!";
                color = '#a855f7';
            } else if (statType === 2) {
                this.player.speed += 0.5;
                text = "+0.5 Speed!";
                color = '#10b981';
            } else {
                this.player.addMaxHealth(1);
                this.player.heal(1);
                text = "+1 Max Heart!";
                color = '#ef4444';
            }
            
            spawnFloatingText(this.player.x, this.player.y - 30, "ROBBERY SUCCESS! " + text, '#10b981', 14);
            spawnSparkles(this.player.x, this.player.y, '#10b981', 20);

            // Merchant leaves
            spawnSmoke(this.shopkeeperNPC.x, this.shopkeeperNPC.y, 15);
            this.shopkeeperNPC = null;
            this.shopkeeperInteractedThisLevel = true;
            
            this.closeShopOverlay();
        } else {
            // Robbery failure: NPC disappears, banned next level
            audio.play('boss_die'); // dramatic fail sound
            
            this.shopkeeperBannedLevel = this.level + 1;
            
            spawnFloatingText(this.player.x, this.player.y - 30, "ROBBERY FAILED! MERCHANT VANISHED", '#ef4444', 14);
            
            // Merchant vanishes in smoke
            spawnSmoke(this.shopkeeperNPC.x, this.shopkeeperNPC.y, 35);
            this.shopkeeperNPC = null;
            this.shopkeeperInteractedThisLevel = true;

            this.closeShopOverlay();
        }
    }

    closeShopOverlay() {
        document.getElementById('shop-overlay').classList.add('hidden');
        this.currentState = this.states.PLAYING;
        if (this.canvas) {
            this.canvas.focus();
        }
    }

    gambleFate() {
        performMysteryGamble(this.player, (isBlessing, resultText, color) => {
            // Set Mystery Man as interacted (he vanishes)
            this.mysteryManNPC.interacted = true;
            spawnSmoke(this.mysteryManNPC.x, this.mysteryManNPC.y, 25);
            this.mysteryManNPC = null;
            this.mysteryManInteractedThisLevel = true;
            
            // Apply text floating indicators in-game
            spawnFloatingText(this.player.x, this.player.y - 30, resultText, color, 14);
            
            // Resume Playing State
            this.currentState = this.states.PLAYING;
            this.updateHUDStats();
            this.updateHUDHealth();
            if (this.canvas) {
                this.canvas.focus();
            }
        }, (sound) => {
            audio.play(sound);
        });
    }

    closeGambleOverlay() {
        document.getElementById('mystery-overlay').classList.add('hidden');
        this.currentState = this.states.PLAYING;
        if (this.canvas) {
            this.canvas.focus();
        }
    }

    spawnRoomMobs() {
        const room = this.dungeon.activeRoom;
        if (room.mobsSpawned || room.cleared) return;

        room.mobsSpawned = true;
        
        // Locks doors
        room.cleared = false;

        const count = this.calculateEnemyCount();
        const types = ['chaser', 'shooter', 'swarmer'];
        
        // Spawn basic mobs
        if (room.type === ROOM_TYPES.BASIC) {
            for (let i = 0; i < count; i++) {
                // Ensure mobs don't spawn right on top of player
                let sx, sy, dist;
                do {
                    sx = 120 + Math.random() * 560;
                    sy = 120 + Math.random() * 360;
                    const dx = sx - this.player.x;
                    const dy = sy - this.player.y;
                    dist = Math.sqrt(dx*dx + dy*dy);
                } while (dist < 100);

                // Level scaling multipliers
                const multiplier = 1 + (this.level - 1) * 0.12;
                
                // Distribute enemy types based on depth
                let type;
                const r = Math.random();
                if (this.level === 1) {
                    type = r < 0.45 ? 'forest_swarmer' : (r < 0.8 ? 'forest_shooter' : 'forest_sprout');
                } else if (this.level === 2) {
                    type = r < 0.45 ? 'shadow_swarmer' : (r < 0.8 ? 'shadow_shooter' : 'shadow_chaser');
                } else if (this.level === 3) {
                    type = r < 0.45 ? 'death_swarmer' : (r < 0.8 ? 'death_shooter' : 'death_chaser');
                } else if (this.level === 4) {
                    type = r < 0.45 ? 'fire_swarmer' : (r < 0.8 ? 'fire_shooter' : 'fire_chaser');
                } else {
                    type = r < 0.45 ? 'void_swarmer' : (r < 0.8 ? 'void_shooter' : 'void_chaser');
                }

                room.mobs.push(new Enemy(sx, sy, type, multiplier));
                spawnSmoke(sx, sy, 5);
            }
        } else if (room.type === ROOM_TYPES.BOSS) {
            // Spawn Level Boss
            const boss = new Boss(400, 260, this.level);
            room.bossVariant = boss.bossVariant;
            room.mobs.push(boss);
            spawnSmoke(400, 260, 15);
        }
    }

    calculateEnemyCount() {
        // Level 1: 1-3, Level 2: 2-4, Level 3: 3-5, Level 4: 4-6, Level 5+: 4-8
        if (this.level === 1) return Math.floor(Math.random() * 3) + 1;
        if (this.level === 2) return Math.floor(Math.random() * 3) + 2;
        if (this.level === 3) return Math.floor(Math.random() * 3) + 3;
        if (this.level === 4) return Math.floor(Math.random() * 3) + 4;
        return Math.floor(Math.random() * 5) + 4;
    }

    // Room Transition Trigger
    triggerRoomTransition(dx, dy, direction) {
        if (this.transitioning) return;
        
        this.transitioning = true;
        this.transitionTimer = 30; // 0.5s transition
        this.transitionDir = direction;
        this.targetRoomX = this.dungeon.activeRoom.gridX + dx;
        this.targetRoomY = this.dungeon.activeRoom.gridY + dy;
    }

    completeRoomTransition() {
        this.transitioning = false;
        
        // Update active room
        const targetRoom = this.dungeon.grid[this.targetRoomX][this.targetRoomY];
        this.dungeon.activeRoom = targetRoom;
        
        // Set room as visited
        targetRoom.visited = true;
        this.setupMysteryManNPC();
        this.setupShopkeeperNPC();

        // Reposition player to opposite wall
        if (this.transitionDir === 'up') {
            this.player.y = 500;
        } else if (this.transitionDir === 'down') {
            this.player.y = 100;
        } else if (this.transitionDir === 'left') {
            this.player.x = 700;
        } else if (this.transitionDir === 'right') {
            this.player.x = 100;
        }

        // Clear particles and projectiles from previous room
        this.projectiles = [];
        clearParticles();

        // Spawn mobs
        this.spawnRoomMobs();

        // Re-render minimap
        this.dungeon.drawMinimap(this.minimapCtx);

        // Transition background music based on room type
        if (targetRoom.type === ROOM_TYPES.BOSS && !targetRoom.cleared) {
            audio.setMusicState('boss');
            const boss = targetRoom.mobs.find(m => m instanceof Boss);
            if (boss) {
                this.startBossDialogue(boss.name);
            }
        } else {
            audio.setMusicState('normal');
        }
    }

    updateHUDHealth() {
        const containers = document.getElementById('health-containers');
        containers.innerHTML = '';
        
        for (let i = 0; i < this.player.maxHealth; i++) {
            const heart = document.createElement('span');
            heart.className = 'heart-icon';
            
            if (i < Math.floor(this.player.health)) {
                // Full heart
                heart.innerHTML = '❤️';
            } else if (i < this.player.health) {
                // Half heart
                heart.className += ' half';
                heart.style.position = 'relative';
                heart.style.display = 'inline-block';
                
                const bgHeart = document.createElement('span');
                bgHeart.className = 'heart-bg empty';
                bgHeart.innerHTML = '🖤';
                bgHeart.style.opacity = '0.25';
                bgHeart.style.filter = 'grayscale(1)';
                
                const fgHeart = document.createElement('span');
                fgHeart.className = 'heart-fg';
                fgHeart.innerHTML = '❤️';
                fgHeart.style.position = 'absolute';
                fgHeart.style.top = '0';
                fgHeart.style.left = '0';
                fgHeart.style.width = '100%';
                fgHeart.style.height = '100%';
                fgHeart.style.clipPath = 'polygon(0 0, 50% 0, 50% 100%, 0 100%)';
                
                heart.appendChild(bgHeart);
                heart.appendChild(fgHeart);
            } else {
                // Empty heart
                heart.className += ' empty';
                heart.innerHTML = '🖤';
            }
            containers.appendChild(heart);
        }
    }


    updateHUDStats() {
        document.getElementById('stat-damage').textContent = this.player.getDamage().toFixed(1);
        document.getElementById('stat-ats').textContent = this.player.attackSpeed.toFixed(2);
        document.getElementById('stat-speed').textContent = this.player.speed.toFixed(1);
        document.getElementById('stat-range').textContent = Math.round(this.player.range);
        
        const coinsEl = document.getElementById('stat-coins');
        if (coinsEl) {
            coinsEl.textContent = this.player.coins || 0;
        }
        
        this.updateHUDArtifacts();
    }

    updateHUDArtifacts() {
        const shelf = document.getElementById('artifacts-shelf');
        if (!shelf) return;
        shelf.innerHTML = '';
        
        if (this.player && this.player.artifacts) {
            this.player.artifacts.forEach(artId => {
                const art = ARTIFACTS_DATABASE.find(a => a.id === artId);
                if (art) {
                    const badge = document.createElement('div');
                    badge.className = 'artifact-badge';
                    badge.style.borderColor = art.color || '#a855f7';
                    badge.style.boxShadow = `0 0 10px ${art.color || '#a855f7'}33`;
                    badge.innerHTML = art.emoji;

                    const tooltip = document.createElement('div');
                    tooltip.className = 'artifact-tooltip';
                    tooltip.innerHTML = `<strong>${art.name}</strong><br><p>${art.description}</p>`;
                    badge.appendChild(tooltip);

                    shelf.appendChild(badge);
                }
            });
        }
    }

    updateLevelDisplay() {
        const numeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        const display = numeral[this.level - 1] || `DEPTH ${this.level}`;
        document.getElementById('level-display').textContent = `DEPTH ${display}`;
    }

    startBossDialogue(bossName) {
        const dialogData = BOSS_DIALOGUES[bossName];
        if (!dialogData) return;

        this.activeDialogue = dialogData;
        this.dialogueIndex = 0;

        this.previousState = this.currentState;
        this.currentState = this.states.DIALOGUE;

        audio.stopMusic();

        this.renderDialogueLine();

        document.getElementById('boss-dialogue-overlay').classList.remove('hidden');
    }

    renderDialogueLine() {
        if (!this.activeDialogue) return;
        const line = this.activeDialogue.dialogue[this.dialogueIndex];
        
        const rowEl = document.getElementById('dialogue-row');
        const leftAvatarEl = document.getElementById('dialogue-left-avatar');
        const rightAvatarEl = document.getElementById('dialogue-right-avatar');
        const nameEl = document.getElementById('dialogue-speaker-name');
        const textEl = document.getElementById('dialogue-text');

        if (line.speaker === 'boss') {
            rowEl.className = 'dialogue-row speaker-boss';
            
            leftAvatarEl.textContent = this.activeDialogue.avatar;
            leftAvatarEl.classList.remove('hidden');
            rightAvatarEl.classList.add('hidden');
            
            nameEl.textContent = this.activeDialogue.name;
            textEl.textContent = `"${line.text}"`;
        } else {
            rowEl.className = 'dialogue-row speaker-player';
            
            rightAvatarEl.textContent = '👤'; // Player emoji
            rightAvatarEl.classList.remove('hidden');
            leftAvatarEl.classList.add('hidden');
            
            nameEl.textContent = 'WANDERER';
            textEl.textContent = `"${line.text}"`;
        }
        
        audio.play('pickup');
    }

    advanceBossDialogue() {
        if (!this.activeDialogue) return;

        this.dialogueIndex++;
        if (this.dialogueIndex < this.activeDialogue.dialogue.length) {
            this.renderDialogueLine();
        } else {
            this.closeBossDialogue();
        }
    }

    closeBossDialogue() {
        this.activeDialogue = null;
        this.dialogueIndex = 0;

        document.getElementById('boss-dialogue-overlay').classList.add('hidden');

        this.currentState = this.states.PLAYING;
        audio.startMusic();

        if (this.canvas) {
            this.canvas.focus();
        }
    }

     handleGameOver() {
        this.currentState = this.states.GAMEOVER;
        audio.stopMusic();
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('game-over-screen').classList.remove('hidden');

        // Populate run summary stats
        document.getElementById('stats-rooms-cleared').textContent = this.roomsCleared;
        document.getElementById('stats-mobs-killed').textContent = this.mobsKilled;
        
        const numeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        document.getElementById('stats-depth').textContent = numeral[this.level - 1] || `DEPTH ${this.level}`;
    }

    handleVictory() {
        this.currentState = this.states.VICTORY;
        audio.stopMusic();
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('victory-screen').classList.remove('hidden');

        document.getElementById('win-rooms-cleared').textContent = this.roomsCleared;
        document.getElementById('win-mobs-killed').textContent = this.mobsKilled;
        document.getElementById('win-depth').textContent = "V (THE FINALITY)";
    }

    update() {
        if (this.currentState !== this.states.PLAYING) return;

        // 1. Check Level Transitioning
        if (this.transitioning) {
            this.transitionTimer--;
            if (this.transitionTimer <= 0) {
                this.completeRoomTransition();
            }
            return;
        }

        const room = this.dungeon.activeRoom;

        // 2. Spawn mobs on entry
        if (!room.mobsSpawned) {
            this.spawnRoomMobs();
        }

        // Artifact room safety spawn helper (in case drops were blocked by other loot on clear)
        if (room.type === ROOM_TYPES.ARTIFACT && room.cleared && !this.artifactFoundThisLevel) {
            const hasArtifactDrop = room.drops.some(d => d.type === 'artifact');
            if (!hasArtifactDrop) {
                const unowned = ARTIFACTS_DATABASE.filter(art => !this.player.hasArtifact(art.id));
                const pool = unowned.length > 0 ? unowned : ARTIFACTS_DATABASE;
                const chosenArt = pool[Math.floor(Math.random() * pool.length)];
                room.drops.push(new Drop(400, 300, 'artifact', chosenArt));
                spawnSparkles(400, 300, chosenArt.color || '#a855f7', 15);
            }
        }

        // Initialize room puzzle if it exists and is idle
        if (room.hasPuzzle && room.puzzleState === 'idle') {
            room.puzzleState = 'showing_sequence';
            room.puzzleShowTimer = 50; // brief delay before flashing sequence
            room.puzzleFlashStep = -1;
            room.puzzleInput = [];
            room.puzzlePlates.forEach(p => { p.active = false; p.flashTimer = 0; p.playerInside = false; });
        }

        // 3. Update Player
        this.player.update(this.keys, this.mouse, room.obstacles, room, this.keyBinds);
        
        // Update NPCs
        if (this.mysteryManNPC) {
            this.mysteryManNPC.update(this.player);
        }
        if (this.shopkeeperNPC) {
            this.shopkeeperNPC.update(this.player);
        }

        // Update Liquid Drops for Mystery Man Room
        if (room.type === ROOM_TYPES.MYSTERY) {
            if (!room.liquidDrops) {
                room.liquidDrops = [];
                for (let i = 0; i < 40; i++) {
                    room.liquidDrops.push({
                        x: 70 + Math.random() * 660,
                        y: 70 + Math.random() * 460,
                        speed: 2.0 + Math.random() * 3.5,
                        length: 8 + Math.random() * 15,
                        opacity: 0.15 + Math.random() * 0.55
                    });
                }
            }
            for (const drop of room.liquidDrops) {
                drop.y += drop.speed;
                if (drop.y > 520) {
                    drop.y = 80;
                    drop.x = 70 + Math.random() * 660;
                    drop.speed = 2.0 + Math.random() * 3.5;
                    drop.length = 8 + Math.random() * 15;
                    drop.opacity = 0.15 + Math.random() * 0.55;
                }
            }
        }
        
        // Update Boss Room Custom Particles
        if (room.type === ROOM_TYPES.BOSS) {
            const bossIndex = Math.min(this.level - 1, 4);
            const bossVariant = room.bossVariant !== undefined ? room.bossVariant : 0;
            
            if (bossIndex === 0) {
                if (bossVariant === 0) {
                    // Golem: Butterflies
                    if (!room.butterflies) {
                        room.butterflies = [];
                        const colors = ['#f59e0b', '#3b82f6', '#ec4899', '#10b981', '#a855f7', '#14b8a6'];
                        for (let i = 0; i < 15; i++) {
                            room.butterflies.push({
                                x: 100 + Math.random() * 600,
                                y: 100 + Math.random() * 400,
                                vx: (Math.random() - 0.5) * 1.2,
                                vy: (Math.random() - 0.5) * 1.2,
                                color: colors[Math.floor(Math.random() * colors.length)],
                                size: 3 + Math.random() * 3,
                                flapOffset: Math.random() * Math.PI * 2,
                                targetX: 100 + Math.random() * 600,
                                targetY: 100 + Math.random() * 400
                            });
                        }
                    }
                    for (const b of room.butterflies) {
                        if (Math.random() < 0.015) {
                            b.targetX = 100 + Math.random() * 600;
                            b.targetY = 100 + Math.random() * 400;
                        }
                        const dx = b.targetX - b.x;
                        const dy = b.targetY - b.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 10) {
                            b.vx += (dx / dist) * 0.04;
                            b.vy += (dy / dist) * 0.04;
                        }
                        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                        const maxSpeed = 1.6;
                        if (speed > maxSpeed) {
                            b.vx = (b.vx / speed) * maxSpeed;
                            b.vy = (b.vy / speed) * maxSpeed;
                        }
                        b.vx += (Math.random() - 0.5) * 0.15;
                        b.vy += (Math.random() - 0.5) * 0.15;
                        
                        b.x += b.vx;
                        b.y += b.vy;
                        
                        if (b.x < 80) { b.x = 80; b.vx *= -1; }
                        if (b.x > 720) { b.x = 720; b.vx *= -1; }
                        if (b.y < 80) { b.y = 80; b.vy *= -1; }
                        if (b.y > 520) { b.y = 520; b.vy *= -1; }
                    }
                } else if (bossVariant === 1) {
                    // Giant Spider: Spore puffs
                    if (!room.sporePuffs) {
                        room.sporePuffs = [];
                        for (let i = 0; i < 20; i++) {
                            room.sporePuffs.push({
                                x: 80 + Math.random() * 640,
                                y: 80 + Math.random() * 440,
                                vx: (Math.random() - 0.5) * 0.4,
                                vy: -(0.3 + Math.random() * 0.6),
                                size: 2 + Math.random() * 3,
                                opacity: 0.3 + Math.random() * 0.4
                            });
                        }
                    }
                    for (const p of room.sporePuffs) {
                        p.y += p.vy;
                        p.x += p.vx + Math.sin(Date.now() * 0.003 + p.y) * 0.15;
                        if (p.y < 80) {
                            p.y = 520;
                            p.x = 80 + Math.random() * 640;
                        }
                    }
                } else {
                    // Ancient Treant: Swirling leaves
                    if (!room.swirlingLeaves) {
                        room.swirlingLeaves = [];
                        for (let i = 0; i < 20; i++) {
                            room.swirlingLeaves.push({
                                x: 80 + Math.random() * 640,
                                y: 80 + Math.random() * 440,
                                vy: 0.5 + Math.random() * 0.8,
                                vx: -(0.5 + Math.random() * 0.5),
                                size: 3 + Math.random() * 4,
                                angle: Math.random() * Math.PI,
                                rotSpeed: 0.01 + Math.random() * 0.02,
                                color: Math.random() < 0.5 ? '#b45309' : '#ea580c'
                            });
                        }
                    }
                    for (const l of room.swirlingLeaves) {
                        l.y += l.vy;
                        l.x += l.vx + Math.sin(Date.now() * 0.005 + l.y) * 0.3;
                        l.angle += l.rotSpeed;
                        if (l.y > 520 || l.x < 80) {
                            l.y = 80;
                            l.x = 120 + Math.random() * 600;
                        }
                    }
                }
            } else if (bossIndex === 1) {
                if (bossVariant === 0) {
                    // Shadow Knight: Fog wisps
                    if (!room.shadowFog) {
                        room.shadowFog = [];
                        for (let i = 0; i < 20; i++) {
                            room.shadowFog.push({
                                x: 70 + Math.random() * 660,
                                y: 70 + Math.random() * 460,
                                vx: (Math.random() - 0.5) * 0.5,
                                vy: (Math.random() - 0.5) * 0.5,
                                radius: 30 + Math.random() * 40,
                                opacity: 0.04 + Math.random() * 0.08
                            });
                        }
                    }
                    for (const f of room.shadowFog) {
                        f.x += f.vx;
                        f.y += f.vy;
                        if (f.x < 64 || f.x > 736) f.vx *= -1;
                        if (f.y < 64 || f.y > 536) f.vy *= -1;
                    }
                } else if (bossVariant === 1) {
                    // Phantom Witch: Arcane glyphs
                    if (!room.arcaneGlyphs) {
                        room.arcaneGlyphs = [];
                        for (let i = 0; i < 15; i++) {
                            room.arcaneGlyphs.push({
                                x: 80 + Math.random() * 640,
                                y: 80 + Math.random() * 440,
                                vy: -(0.2 + Math.random() * 0.4),
                                size: 4 + Math.random() * 4,
                                text: ['✳', '✡', '★', '❈', '✦'][Math.floor(Math.random() * 5)],
                                opacity: 0.2 + Math.random() * 0.5
                            });
                        }
                    }
                    for (const g of room.arcaneGlyphs) {
                        g.y += g.vy;
                        if (g.y < 80) {
                            g.y = 520;
                            g.x = 80 + Math.random() * 640;
                        }
                    }
                } else {
                    // Dark Gargoyle: Crumble dust / gray fog
                    if (!room.stoneFog) {
                        room.stoneFog = [];
                        for (let i = 0; i < 15; i++) {
                            room.stoneFog.push({
                                x: 70 + Math.random() * 660,
                                y: 70 + Math.random() * 460,
                                vx: (Math.random() - 0.5) * 0.4,
                                vy: (Math.random() - 0.5) * 0.4,
                                radius: 20 + Math.random() * 25,
                                opacity: 0.05 + Math.random() * 0.06
                            });
                        }
                    }
                    for (const f of room.stoneFog) {
                        f.x += f.vx;
                        f.y += f.vy;
                        if (f.x < 64 || f.x > 736) f.vx *= -1;
                        if (f.y < 64 || f.y > 536) f.vy *= -1;
                    }
                }
            } else if (bossIndex === 2) {
                if (bossVariant === 0) {
                    // Necromancer: Cyan/green soul wisps
                    if (!room.necroSouls) {
                        room.necroSouls = [];
                        for (let i = 0; i < 25; i++) {
                            room.necroSouls.push({
                                x: 80 + Math.random() * 640,
                                y: 80 + Math.random() * 440,
                                vy: -(0.4 + Math.random() * 0.8),
                                vx: (Math.random() - 0.5) * 0.2,
                                size: 2 + Math.random() * 3,
                                pulseSpeed: 0.03 + Math.random() * 0.04,
                                pulseOffset: Math.random() * Math.PI,
                                opacity: 0.25 + Math.random() * 0.5
                            });
                        }
                    }
                    for (const s of room.necroSouls) {
                        s.y += s.vy;
                        s.x += s.vx + Math.sin(Date.now() * 0.002 + s.pulseOffset) * 0.15;
                        if (s.y < 80) {
                            s.y = 520;
                            s.x = 80 + Math.random() * 640;
                        }
                    }
                } else if (bossVariant === 1) {
                    // Bone Colossus: Bone ash
                    if (!room.boneAsh) {
                        room.boneAsh = [];
                        for (let i = 0; i < 25; i++) {
                            room.boneAsh.push({
                                x: 80 + Math.random() * 640,
                                y: 80 + Math.random() * 440,
                                vy: 0.6 + Math.random() * 0.6,
                                size: 1.5 + Math.random() * 2,
                                opacity: 0.3 + Math.random() * 0.5
                            });
                        }
                    }
                    for (const a of room.boneAsh) {
                        a.y += a.vy;
                        a.x += Math.sin(Date.now() * 0.003 + a.y) * 0.1;
                        if (a.y > 520) {
                            a.y = 80;
                            a.x = 80 + Math.random() * 640;
                        }
                    }
                } else {
                    // Plague Doctor: Green miasma bubbles
                    if (!room.miasmaBubbles) {
                        room.miasmaBubbles = [];
                        for (let i = 0; i < 20; i++) {
                            room.miasmaBubbles.push({
                                x: 80 + Math.random() * 640,
                                y: 520,
                                vy: -(0.5 + Math.random() * 0.8),
                                size: 2 + Math.random() * 4,
                                wobbleOffset: Math.random() * Math.PI * 2,
                                opacity: 0.4 + Math.random() * 0.4
                            });
                        }
                    }
                    for (const b of room.miasmaBubbles) {
                        b.y += b.vy;
                        b.x += Math.sin(Date.now() * 0.01 + b.wobbleOffset) * 0.3;
                        if (b.y < 80) {
                            b.y = 520;
                            b.x = 80 + Math.random() * 640;
                        }
                    }
                }
            } else if (bossIndex === 3) {
                if (bossVariant === 0) {
                    // Fire Demon: Lava embers
                    if (!room.lavaEmbers) {
                        room.lavaEmbers = [];
                        for (let i = 0; i < 30; i++) {
                            room.lavaEmbers.push({
                                x: 80 + Math.random() * 640,
                                y: 80 + Math.random() * 440,
                                vy: -(0.6 + Math.random() * 1.2),
                                vx: (Math.random() - 0.5) * 0.4,
                                size: 1.5 + Math.random() * 2,
                                opacity: 0.35 + Math.random() * 0.55
                            });
                        }
                    }
                    for (const e of room.lavaEmbers) {
                        e.y += e.vy;
                        e.x += e.vx;
                        if (e.y < 80) {
                            e.y = 520;
                            e.x = 80 + Math.random() * 640;
                        }
                    }
                } else if (bossVariant === 1) {
                    // Infernal Drake: Ember sparks
                    if (!room.emberSparks) {
                        room.emberSparks = [];
                        for (let i = 0; i < 30; i++) {
                            room.emberSparks.push({
                                x: 80 + Math.random() * 640,
                                y: 80 + Math.random() * 440,
                                vy: -(1.0 + Math.random() * 1.5),
                                vx: (Math.random() - 0.5) * 0.3,
                                size: 1 + Math.random() * 2,
                                opacity: 0.4 + Math.random() * 0.5
                            });
                        }
                    }
                    for (const s of room.emberSparks) {
                        s.y += s.vy;
                        s.x += s.vx;
                        if (s.y < 80) {
                            s.y = 520;
                            s.x = 80 + Math.random() * 640;
                        }
                    }
                } else {
                    // Magma Titan: Lava drops
                    if (!room.lavaDrops) {
                        room.lavaDrops = [];
                        for (let i = 0; i < 20; i++) {
                            room.lavaDrops.push({
                                x: 80 + Math.random() * 640,
                                y: 80 + Math.random() * 440,
                                vy: -(0.3 + Math.random() * 0.5),
                                size: 2.5 + Math.random() * 3,
                                opacity: 0.3 + Math.random() * 0.4
                            });
                        }
                    }
                    for (const d of room.lavaDrops) {
                        d.y += d.vy;
                        if (d.y < 80) {
                            d.y = 520;
                            d.x = 80 + Math.random() * 640;
                        }
                    }
                }
            } else if (bossIndex === 4) {
                if (bossVariant === 0) {
                    // Void Eye: Cosmic stars
                    if (!room.voidStars) {
                        room.voidStars = [];
                        for (let i = 0; i < 40; i++) {
                            room.voidStars.push({
                                x: 80 + Math.random() * 640,
                                y: 80 + Math.random() * 440,
                                vx: (Math.random() - 0.5) * 0.15,
                                vy: (Math.random() - 0.5) * 0.15,
                                size: 1 + Math.random() * 2,
                                color: Math.random() < 0.6 ? '#a855f7' : '#6366f1',
                                opacity: 0.3 + Math.random() * 0.6
                            });
                        }
                    }
                    for (const s of room.voidStars) {
                        s.x += s.vx;
                        s.y += s.vy;
                        if (s.x < 70 || s.x > 730 || s.y < 70 || s.y > 530) {
                            s.x = 80 + Math.random() * 640;
                            s.y = 80 + Math.random() * 440;
                        }
                    }
                } else if (bossVariant === 1) {
                    // Cosmic Horror: Stardust
                    if (!room.stardust) {
                        room.stardust = [];
                        for (let i = 0; i < 30; i++) {
                            room.stardust.push({
                                x: 400 + (Math.random() - 0.5) * 400,
                                y: 300 + (Math.random() - 0.5) * 300,
                                angle: Math.random() * Math.PI * 2,
                                radius: 50 + Math.random() * 200,
                                rotSpeed: 0.005 + Math.random() * 0.01,
                                size: 1 + Math.random() * 2,
                                opacity: 0.4 + Math.random() * 0.5
                            });
                        }
                    }
                    for (const s of room.stardust) {
                        s.angle += s.rotSpeed;
                        s.x = 400 + Math.cos(s.angle) * s.radius;
                        s.y = 300 + Math.sin(s.angle) * s.radius;
                    }
                } else {
                    // Shadow Overlord: Shadow wisps
                    if (!room.shadowWisps) {
                        room.shadowWisps = [];
                        for (let i = 0; i < 25; i++) {
                            room.shadowWisps.push({
                                x: 400 + (Math.random() - 0.5) * 400,
                                y: 300 + (Math.random() - 0.5) * 300,
                                angle: Math.random() * Math.PI * 2,
                                radius: 40 + Math.random() * 180,
                                speed: 0.01 + Math.random() * 0.015,
                                size: 2 + Math.random() * 2.5,
                                opacity: 0.3 + Math.random() * 0.4
                            });
                        }
                    }
                    for (const w of room.shadowWisps) {
                        w.angle += w.speed;
                        w.x = 400 + Math.cos(w.angle) * w.radius;
                        w.y = 300 + Math.sin(w.angle) * w.radius;
                    }
                }
            }
        }

        // Sync Player stats to HUD elements
        document.getElementById('mana-bar').style.width = `${(this.player.mana / this.player.maxMana) * 100}%`;
        document.getElementById('mana-text').textContent = `${Math.floor(this.player.mana)}/${this.player.maxMana}`;
        
        // Attack trigger (activated by arrow keys)
        const isAttacking = (this.keys['arrowup'] || this.keys['arrowdown'] || this.keys['arrowleft'] || this.keys['arrowright']);
        if (isAttacking) {
            this.player.attack(null, this.projectiles, room, (sound) => audio.play(sound));
        }

        // 4. Update Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            
            // Pass player reference for enemy splash calculations
            room.playerRef = this.player;

            const alive = p.update(room.obstacles, room);
            if (!alive) {
                this.projectiles.splice(i, 1);
            }
        }

        // 5. Update Enemies
        let activeBoss = null;
        for (let i = room.mobs.length - 1; i >= 0; i--) {
            const mob = room.mobs[i];
            
            if (mob instanceof Boss) activeBoss = mob;

            mob.update(this.player, room.obstacles, this.projectiles, room);

            // Check collision with player projectiles
            for (let j = this.projectiles.length - 1; j >= 0; j--) {
                const proj = this.projectiles[j];
                if (proj.owner === 'player') {
                    const dx = mob.x - proj.x;
                    const dy = mob.y - proj.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist < mob.radius + proj.radius) {
                        // Projectile Hit!
                        audio.play('hit');
                        const angle = Math.atan2(dy, dx);
                        const kbForce = proj.type === 'arrow' ? 2.5 : 1; // arrows have some knockback
                        
                        mob.takeDamage(proj.damage, Math.cos(angle) * kbForce, Math.sin(angle) * kbForce);
                        if (this.player.hasArtifact('frozen_tear')) {
                            mob.slowTimer = 90;
                        }
                        
                        if (proj.type === 'magic' || proj.type === 'lightning') {
                            proj.explode(room);
                        } else {
                            spawnSparkles(proj.x, proj.y, '#f1f5f9', 4);
                        }
                        
                        this.projectiles.splice(j, 1);
                    }
                }
            }

            // Enemy death triggers
            if (mob.health <= 0) {
                if (mob instanceof Boss) {
                    audio.play('boss_die');
                } else if (
                    mob.type === 'swarmer' || mob.type === 'mini_swarmer' ||
                    mob.type === 'forest_swarmer' || mob.type === 'forest_mini_swarmer' ||
                    mob.type === 'fire_swarmer' || mob.type === 'fire_mini_swarmer'
                ) {
                    audio.play('slime_die');
                } else if (
                    mob.type === 'shooter' || mob.type === 'forest_shooter' ||
                    mob.type === 'shadow_shooter' || mob.type === 'death_shooter' ||
                    mob.type === 'fire_imp' || mob.type === 'fire_shooter' ||
                    mob.type === 'void_shooter'
                ) {
                    audio.play('bat_die');
                } else if (
                    mob.type === 'chaser' || mob.type === 'shadow_chaser' ||
                    mob.type === 'death_chaser' || mob.type === 'fire_chaser' ||
                    mob.type === 'void_chaser'
                ) {
                    audio.play('goblin_die');
                } else {
                    audio.play('enemy_die');
                }
                this.mobsKilled++;

                // Vampire Fangs heal
                if (this.player.hasArtifact('ruby_fangs')) {
                    this.player.health = Math.min(this.player.maxHealth, this.player.health + 0.25);
                    this.updateHUDHealth();
                    spawnSparkles(this.player.x, this.player.y, '#ef4444', 5);
                }

                // Swarmer splitting logic
                if (mob.type === 'swarmer') {
                    room.mobs.push(new Enemy(mob.x - 10, mob.y, 'mini_swarmer', 1));
                    room.mobs.push(new Enemy(mob.x + 10, mob.y, 'mini_swarmer', 1));
                    spawnSmoke(mob.x, mob.y, 4, 0.6);
                } else if (mob.type === 'forest_swarmer') {
                    room.mobs.push(new Enemy(mob.x - 10, mob.y, 'forest_mini_swarmer', 1));
                    room.mobs.push(new Enemy(mob.x + 10, mob.y, 'forest_mini_swarmer', 1));
                    spawnSmoke(mob.x, mob.y, 4, 0.6);
                } else if (mob.type === 'fire_swarmer') {
                    room.mobs.push(new Enemy(mob.x - 10, mob.y, 'fire_mini_swarmer', 1));
                    room.mobs.push(new Enemy(mob.x + 10, mob.y, 'fire_mini_swarmer', 1));
                    spawnSmoke(mob.x, mob.y, 4, 0.6);
                }

                // Normal drops chance on mob death
                let coinChance = 0.15;
                if (this.player.hasArtifact('luck_clover')) coinChance += 0.15;

                const r = Math.random();
                if (r < coinChance) {
                    room.drops.push(new Drop(mob.x, mob.y, 'coin'));
                    if (this.player.hasArtifact('greed_coin') && Math.random() < 0.10) {
                        room.drops.push(new Drop(mob.x + 12, mob.y, 'coin'));
                    }
                } else if (r < coinChance + 0.07) {
                    room.drops.push(new Drop(mob.x, mob.y, 'mana'));
                } else if (r < coinChance + 0.13) {
                    room.drops.push(new Drop(mob.x, mob.y, 'heart'));
                }

                room.mobs.splice(i, 1);
            }
        }

        // Track Boss Info for HUD representation
        this.activeBossRef = activeBoss;

        // 6. Check Room Cleared status
        if (room.mobs.length === 0 && !room.cleared) {
            room.cleared = true;
            this.roomsCleared++;
            spawnSparkles(400, 300, '#22c55e', 20);
            spawnFloatingText(400, 270, "ROOM SECURED", '#22c55e', 14);
            audio.play('pickup');

            // Immediately update minimap when room is secured
            this.dungeon.drawMinimap(this.minimapCtx);

            // If Trophy room is cleared (just in case), spawn pedestal
            if (room.type === ROOM_TYPES.TROPHY && room.drops.length === 0) {
                room.drops.push(new Drop(400, 260, 'trophy'));
                spawnSparkles(400, 260, '#f59e0b', 12);
            }

            // If Boss Room is cleared, spawn the Next Level Portal and Trophy, and transition music
            if (room.type === ROOM_TYPES.BOSS) {
                audio.setMusicState('normal');
                room.drops.push(new Drop(400, 230, 'trophy'));
            }

            // If Artifact Room is cleared, spawn a random unowned artifact pedestal in the center
            if (room.type === ROOM_TYPES.ARTIFACT) {
                const hasArtifactDrop = room.drops.some(d => d.type === 'artifact');
                if (!hasArtifactDrop) {
                    const unowned = ARTIFACTS_DATABASE.filter(art => !this.player.hasArtifact(art.id));
                    const pool = unowned.length > 0 ? unowned : ARTIFACTS_DATABASE;
                    const chosenArt = pool[Math.floor(Math.random() * pool.length)];
                    room.drops.push(new Drop(400, 300, 'artifact', chosenArt));
                    spawnSparkles(400, 300, chosenArt.color || '#a855f7', 15);
                }
            }

        }

        // Room Status HUD updater
        const roomStatusEl = document.getElementById('room-status');
        if (room.cleared) {
            roomStatusEl.textContent = "ROOM SECURED";
            roomStatusEl.classList.remove('active');
        } else {
            roomStatusEl.textContent = "HOSTILE AREA LOCKDOWN";
            roomStatusEl.classList.add('active');
        }

        // Description popup helper when standing near artifact
        let nearArtifact = null;
        for (const drop of room.drops) {
            if (drop.type === 'artifact') {
                const dx = this.player.x - drop.x;
                const dy = this.player.y - drop.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 80) {
                    nearArtifact = drop.artifactData;
                    break;
                }
            }
        }

        const popupEl = document.getElementById('artifact-popup');
        if (popupEl) {
            if (nearArtifact) {
                document.getElementById('popup-name').textContent = nearArtifact.name;
                document.getElementById('popup-desc').textContent = nearArtifact.description;
                const iconEl = popupEl.querySelector('.popup-icon');
                if (iconEl) iconEl.textContent = nearArtifact.emoji;
                popupEl.classList.remove('hidden');
            } else {
                popupEl.classList.add('hidden');
            }
        }

        // Update Puzzle logic in empty rooms
        if (room.hasPuzzle && !room.puzzleSolved) {
            this.updateRoomPuzzle(room);
        }

        // 7. Update Drops (Loot Pickups)
        for (let i = room.drops.length - 1; i >= 0; i--) {
            const drop = room.drops[i];
            const picked = drop.update(this.player);
            if (picked) {
                room.drops.splice(i, 1);
                this.updateHUDHealth();
                this.updateHUDStats();
            }
        }

        // 8. Player Death trigger
        if (this.player.health <= 0) {
            this.handleGameOver();
        }

        // 9. Portal Overlap detection (If Boss dead)
        if (room.type === ROOM_TYPES.BOSS && room.cleared) {
            const tdx = this.player.x - 400;
            const tdy = this.player.y - 300;
            const tdist = Math.sqrt(tdx*tdx + tdy*tdy);

            if (tdist < this.player.radius + 15) {
                // Portal transition!

                if (this.level >= 5) {
                    this.handleVictory();
                } else {
                    this.level++;
                    audio.play('gamble_start');
                    this.generateLevel();
                }
            }
        }

        // 10. Door Transition Checks
        if (room.cleared) {
            const transitionLimit = 50;
            // UP
            if (room.doors.up && this.player.y < 58 && Math.abs(this.player.x - 400) < 40) {
                this.triggerRoomTransition(0, -1, 'up');
            }
            // DOWN
            if (room.doors.down && this.player.y > 542 && Math.abs(this.player.x - 400) < 40) {
                this.triggerRoomTransition(0, 1, 'down');
            }
            // LEFT
            if (room.doors.left && this.player.x < 58 && Math.abs(this.player.y - 300) < 40) {
                this.triggerRoomTransition(-1, 0, 'left');
            }
            // RIGHT
            if (room.doors.right && this.player.x > 742 && Math.abs(this.player.y - 300) < 40) {
                this.triggerRoomTransition(1, 0, 'right');
            }
        }

        // 11. Obstacles logic (Campfire damage timer, sparks)
        for (const obs of room.obstacles) {
            if (obs.type === 'campfire' && !obs.extinguished) {
                if (Math.random() < 0.15) {
                    spawnEmbers(obs.x, obs.y, 16, 1);
                }
            }
        }
    }

    drawStoneWall(ctx, rx, ry, rw, rh, isVertical) {
        ctx.save();
        ctx.fillStyle = '#0a0a0f'; // Mortar background
        ctx.fillRect(rx, ry, rw, rh);
        
        const brickW = isVertical ? 16 : 32;
        const brickH = isVertical ? 32 : 16;
        
        ctx.strokeStyle = '#020205';
        ctx.lineWidth = 2;
        
        if (!isVertical) {
            // Horizontal Wall (Top/Bottom)
            for (let y = ry; y < ry + rh; y += brickH) {
                const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                for (let x = rx; x < rx + rw; x += brickW) {
                    const offset = isEvenRow ? 0 : (brickW / 2);
                    const bx = x + offset;
                    if (bx >= rx && bx < rx + rw) {
                        const hash = Math.abs(Math.sin(bx * 17.3 + y * 29.7));
                        ctx.fillStyle = hash < 0.35 ? '#1e293b' : (hash < 0.7 ? '#334155' : '#475569');
                        ctx.fillRect(bx, y, brickW - 2, brickH - 2);
                        
                        // Top Highlight Edge
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                        ctx.beginPath();
                        ctx.moveTo(bx, y + 1);
                        ctx.lineTo(bx + brickW - 2, y + 1);
                        ctx.stroke();
                    }
                }
            }
        } else {
            // Vertical Wall (Left/Right)
            for (let x = rx; x < rx + rw; x += brickW) {
                const isEvenCol = Math.floor(x / brickW) % 2 === 0;
                for (let y = ry; y < ry + rh; y += brickH) {
                    const offset = isEvenCol ? 0 : (brickH / 2);
                    const by = y + offset;
                    if (by >= ry && by < ry + rh) {
                        const hash = Math.abs(Math.sin(x * 23.9 + by * 11.7));
                        ctx.fillStyle = hash < 0.35 ? '#1e293b' : (hash < 0.7 ? '#334155' : '#475569');
                        ctx.fillRect(x, by, brickW - 2, brickH - 2);
                        
                        // Left Highlight Edge
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                        ctx.beginPath();
                        ctx.moveTo(x + 1, by);
                        ctx.lineTo(x + 1, by + brickH - 2);
                        ctx.stroke();
                    }
                }
            }
        }
        ctx.restore();
    }

    drawWallTorch(ctx, tx, ty) {
        ctx.save();
        
        const isArtifactRoom = this.dungeon && this.dungeon.activeRoom && this.dungeon.activeRoom.type === ROOM_TYPES.ARTIFACT;

        // Draw light source radial glow behind the torch
        const pulse = Math.sin(Date.now() * 0.008 + tx * 0.05) * 4 + 18;
        const glowGrad = ctx.createRadialGradient(tx, ty, 2, tx, ty, pulse);
        if (isArtifactRoom) {
            glowGrad.addColorStop(0, 'rgba(168, 85, 247, 0.25)'); // soft purple
            glowGrad.addColorStop(0.5, 'rgba(124, 58, 237, 0.1)'); // violet
        } else {
            glowGrad.addColorStop(0, 'rgba(249, 115, 22, 0.25)'); // soft orange
            glowGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.1)'); // soft red
        }
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(tx, ty, pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw steel/wood torch bracket
        ctx.fillStyle = '#451a03'; // dark brown handle
        ctx.fillRect(tx - 2, ty, 4, 12);
        ctx.fillStyle = '#1e293b'; // steel bracket holding the flame
        ctx.fillRect(tx - 4, ty - 2, 8, 3);
        
        // Draw fire flame animated tear shape
        const flameH = 8 + Math.sin(Date.now() * 0.015 + tx) * 3;
        const flameW = 4 + Math.cos(Date.now() * 0.012 + tx) * 1;
        
        const flameGrad = ctx.createLinearGradient(tx, ty, tx, ty - flameH);
        if (isArtifactRoom) {
            flameGrad.addColorStop(0, '#c084fc'); // bright light purple
            flameGrad.addColorStop(0.5, '#a855f7'); // purple
            flameGrad.addColorStop(1, 'rgba(124, 58, 237, 0)'); // violet fade
        } else {
            flameGrad.addColorStop(0, '#f97316'); // bright orange
            flameGrad.addColorStop(0.5, '#eab308'); // yellow
            flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)'); // fade
        }
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = isArtifactRoom ? '#a855f7' : '#f97316';
        ctx.fillStyle = flameGrad;
        
        ctx.beginPath();
        ctx.moveTo(tx - flameW, ty - 2);
        ctx.quadraticCurveTo(tx - flameW, ty - 2 - flameH * 0.4, tx, ty - 2 - flameH);
        ctx.quadraticCurveTo(tx + flameW, ty - 2 - flameH * 0.4, tx + flameW, ty - 2);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }

    drawWallChain(ctx, cx, cy, length = 35) {
        ctx.save();
        ctx.strokeStyle = '#475569'; // slate grey metal
        ctx.lineWidth = 2.2;
        
        // Draw overlapping vertical links
        for (let y = cy; y < cy + length; y += 7) {
            ctx.beginPath();
            ctx.arc(cx, y, 3, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    draw() {
        // Clear Screen
        this.ctx.fillStyle = '#050507';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.dungeon) return;

        const room = this.dungeon.activeRoom;
        if (!room) return;

        this.ctx.save();
        this.ctx.translate(100, 140);
        this.ctx.scale(0.75, 0.75);


        // Render Room Floor (Dark flagstone brick dungeon tiles)
        const brickW = 80;
        const brickH = 40;
        
        if (room.type === ROOM_TYPES.MYSTERY) {
            const grad = this.ctx.createRadialGradient(400, 300, 30, 400, 300, 380);
            grad.addColorStop(0, '#1c0c30'); // warm dark purple
            grad.addColorStop(1, '#07020d'); // dark void black-purple
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(64, 64, 672, 472);
            
            // Draw flagstone staggered seams
            this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.08)';
            this.ctx.lineWidth = 1;
            for (let y = 64; y < 536; y += brickH) {
                this.ctx.beginPath();
                this.ctx.moveTo(64, y);
                this.ctx.lineTo(736, y);
                this.ctx.stroke();
                
                const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                const offset = isEvenRow ? 0 : (brickW / 2);
                for (let x = 64 + offset; x < 736; x += brickW) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, y);
                    this.ctx.lineTo(x, y + brickH);
                    this.ctx.stroke();
                }
            }
        } else if (room.type === ROOM_TYPES.SHOP) {
            // Draw wooden floor planks
            this.ctx.fillStyle = '#3a200d'; // Warm oak wood floor base
            this.ctx.fillRect(64, 64, 672, 472);
            
            // Draw wood grain lines
            this.ctx.strokeStyle = '#221105'; // dark plank borders
            this.ctx.lineWidth = 2.5;
            
            const plankH = 28;
            const plankW = 120;
            
            for (let y = 64; y < 536; y += plankH) {
                // Horizontal plank line
                this.ctx.beginPath();
                this.ctx.moveTo(64, y);
                this.ctx.lineTo(736, y);
                this.ctx.stroke();
                
                // Segment vertical lines
                const isEven = Math.floor(y / plankH) % 2 === 0;
                const offset = isEven ? 0 : (plankW / 2);
                for (let x = 64 + offset; x < 736; x += plankW) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, y);
                    this.ctx.lineTo(x, y + plankH);
                    this.ctx.stroke();
                    
                    // Draw a little nail head circle near the joints
                    this.ctx.fillStyle = '#110802';
                    this.ctx.beginPath();
                    this.ctx.arc(x + 3, y + 3, 1, 0, Math.PI*2);
                    this.ctx.arc(x - 3, y + 3, 1, 0, Math.PI*2);
                    this.ctx.fill();
                }
            }
        } else if (room.type === ROOM_TYPES.BOSS) {
            const bossIndex = Math.min(this.level - 1, 4);
            const bossVariant = room.bossVariant !== undefined ? room.bossVariant : 0;
            
            if (bossIndex === 0) {
                if (bossVariant === 0) {
                    // Forest Golem floor: earthy dark green mossy floor
                    this.ctx.fillStyle = '#091c0e';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    // Mossy stone brick boundaries
                    this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.04)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                    
                    // Draw lush grass blades that character can walk through
                    const grassSeed = room.gridX * 29 + room.gridY * 41;
                    const grassRandom = (s) => {
                        let val = Math.sin(s) * 12345;
                        return val - Math.floor(val);
                    };
                    
                    this.ctx.save();
                    for (let i = 0; i < 45; i++) {
                        const gx = 80 + grassRandom(grassSeed + i * 13) * 620;
                        const gy = 80 + grassRandom(grassSeed + i * 19) * 420;
                        
                        const blades = 3 + Math.floor(grassRandom(grassSeed + i * 5) * 3);
                        this.ctx.strokeStyle = i % 2 === 0 ? '#16a34a' : '#22c55e';
                        this.ctx.lineWidth = 1.0 + grassRandom(grassSeed + i * 9) * 0.8;
                        for (let b = 0; b < blades; b++) {
                            const bh = 8 + grassRandom(grassSeed + i * 7 + b) * 8;
                            const angle = (grassRandom(grassSeed + i * 11 + b) - 0.5) * 0.5;
                            this.ctx.beginPath();
                            this.ctx.moveTo(gx, gy);
                            this.ctx.quadraticCurveTo(gx - angle * 5, gy - bh * 0.6, gx - angle * 8, gy - bh);
                            this.ctx.stroke();
                        }
                        
                        // Faint shadow at the base
                        this.ctx.fillStyle = '#051307';
                        this.ctx.beginPath();
                        this.ctx.arc(gx, gy, 1.8, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                    this.ctx.restore();
                } else if (bossVariant === 1) {
                    // Giant Spider floor: dark greenish black floor
                    this.ctx.fillStyle = '#040804';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    this.ctx.strokeStyle = 'rgba(34, 197, 94, 0.03)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                    
                    // Draw cobwebs on the floor
                    this.ctx.save();
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                    this.ctx.lineWidth = 1.5;
                    const drawFloorWeb = (cx, cy, r) => {
                        this.ctx.beginPath();
                        for (let a = 0; a < 8; a++) {
                            const angle = (Math.PI / 4) * a;
                            this.ctx.moveTo(cx, cy);
                            this.ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
                        }
                        this.ctx.stroke();
                        // Connect rings
                        for (let step = 1; step <= 3; step++) {
                            this.ctx.beginPath();
                            this.ctx.arc(cx, cy, (r / 3) * step, 0, Math.PI * 2);
                            this.ctx.stroke();
                        }
                    };
                    drawFloorWeb(200, 200, 60);
                    drawFloorWeb(600, 380, 50);
                    drawFloorWeb(550, 160, 40);
                    this.ctx.restore();
                } else {
                    // Ancient Treant floor: earthy bark brown floor
                    this.ctx.fillStyle = '#1c120c';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    this.ctx.strokeStyle = 'rgba(133, 77, 14, 0.05)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                    
                    // Draw wooden rings/roots on the ground
                    this.ctx.save();
                    this.ctx.strokeStyle = 'rgba(69, 26, 3, 0.08)';
                    this.ctx.lineWidth = 2.5;
                    const drawFloorRoot = (rx, ry, radius) => {
                        this.ctx.beginPath();
                        this.ctx.arc(rx, ry, radius, 0, Math.PI * 2);
                        this.ctx.stroke();
                        this.ctx.beginPath();
                        this.ctx.arc(rx, ry, radius * 0.75, 0, Math.PI * 2);
                        this.ctx.stroke();
                        this.ctx.beginPath();
                        this.ctx.arc(rx, ry, radius * 0.5, 0, Math.PI * 2);
                        this.ctx.stroke();
                    };
                    drawFloorRoot(300, 320, 80);
                    drawFloorRoot(500, 220, 60);
                    this.ctx.restore();
                }
            } else if (bossIndex === 1) {
                if (bossVariant === 0) {
                    // Shadow Knight floor: midnight dark shadow blue
                    this.ctx.fillStyle = '#040510';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    // Spectral brick boundaries
                    this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.03)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                } else if (bossVariant === 1) {
                    // Phantom Witch floor: deep purple void tiles
                    this.ctx.fillStyle = '#0c0214';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.04)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                    // Glowing witch glyphs
                    this.ctx.save();
                    this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.06)';
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.arc(400, 300, 90, 0, Math.PI*2);
                    this.ctx.stroke();
                    this.ctx.beginPath();
                    this.ctx.arc(400, 300, 60, 0, Math.PI*2);
                    this.ctx.stroke();
                    this.ctx.restore();
                } else {
                    // Dark Gargoyle floor: heavy grey stone
                    this.ctx.fillStyle = '#18181a';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    this.ctx.strokeStyle = 'rgba(75, 85, 99, 0.05)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                }
            } else if (bossIndex === 2) {
                if (bossVariant === 0) {
                    // Necromancer floor: tombstone gray
                    this.ctx.fillStyle = '#101012';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                    
                    // Faint glowing runes
                    const runeSeed = room.gridX * 17 + room.gridY * 43;
                    const runeRandom = (s) => {
                        let val = Math.sin(s) * 9876;
                        return val - Math.floor(val);
                    };
                    
                    this.ctx.save();
                    this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.06)';
                    this.ctx.shadowBlur = 4;
                    this.ctx.shadowColor = '#10b981';
                    this.ctx.lineWidth = 1.5;
                    for (let i = 0; i < 6; i++) {
                        const cx = 150 + runeRandom(runeSeed + i * 3) * 500;
                        const cy = 150 + runeRandom(runeSeed + i * 7) * 300;
                        this.ctx.beginPath();
                        this.ctx.arc(cx, cy, 15 + runeRandom(runeSeed + i * 11) * 20, 0, Math.PI * 2);
                        this.ctx.stroke();
                        
                        // Simple runic lines crossing the circle
                        this.ctx.beginPath();
                        this.ctx.moveTo(cx - 10, cy);
                        this.ctx.lineTo(cx + 10, cy);
                        this.ctx.moveTo(cx, cy - 10);
                        this.ctx.lineTo(cx, cy + 10);
                        this.ctx.stroke();
                    }
                    this.ctx.restore();
                } else if (bossVariant === 1) {
                    // Bone Colossus floor: bone-white cracked floor
                    this.ctx.fillStyle = '#262422';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    this.ctx.strokeStyle = 'rgba(214, 211, 209, 0.04)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                    
                    // Draw bone-cracks
                    this.ctx.save();
                    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
                    this.ctx.lineWidth = 1.2;
                    for (let i = 0; i < 5; i++) {
                        const cx = 100 + i * 120 + Math.random() * 50;
                        const cy = 100 + i * 80 + Math.random() * 50;
                        this.ctx.beginPath();
                        this.ctx.moveTo(cx, cy);
                        this.ctx.lineTo(cx + 25, cy + 20);
                        this.ctx.lineTo(cx + 40, cy + 10);
                        this.ctx.stroke();
                    }
                    this.ctx.restore();
                } else {
                    // Plague Doctor floor: sickly yellow-green
                    this.ctx.fillStyle = '#121a08';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    this.ctx.strokeStyle = 'rgba(132, 204, 22, 0.04)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                }
            } else if (bossIndex === 3) {
                if (bossVariant === 0) {
                    // Fire Demon floor: obsidian tiles with flowing lava cracks
                    this.ctx.fillStyle = '#0a0402';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    const pulse = Math.sin(Date.now() * 0.002) * 0.15 + 0.85;
                    const lavaColor = `rgba(${220 + Math.floor(pulse * 35)}, ${60 + Math.floor(pulse * 80)}, 20, 0.35)`;
                    
                    this.ctx.save();
                    this.ctx.shadowBlur = 8;
                    this.ctx.shadowColor = '#ea580c';
                    this.ctx.strokeStyle = lavaColor;
                    this.ctx.lineWidth = 2.5;
                    
                    const lavaSeed = room.gridX * 31 + room.gridY * 47;
                    const lavaRandom = (s) => {
                        let val = Math.sin(s) * 14725;
                        return val - Math.floor(val);
                    };
                    
                    for (let i = 0; i < 8; i++) {
                        const lx = 100 + lavaRandom(lavaSeed + i * 7) * 580;
                        const ly = 100 + lavaRandom(lavaSeed + i * 9) * 380;
                        this.ctx.beginPath();
                        this.ctx.moveTo(lx, ly);
                        const lx2 = lx + (lavaRandom(lavaSeed + i * 11) - 0.5) * 80;
                        const ly2 = ly + (lavaRandom(lavaSeed + i * 13) - 0.5) * 80;
                        this.ctx.lineTo(lx2, ly2);
                        const lx3 = lx2 + (lavaRandom(lavaSeed + i * 15) - 0.5) * 80;
                        const ly3 = ly2 + (lavaRandom(lavaSeed + i * 17) - 0.5) * 80;
                        this.ctx.lineTo(lx3, ly3);
                        this.ctx.stroke();
                    }
                    this.ctx.restore();
                    
                    // Dark red brick boundaries
                    this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.03)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                } else if (bossVariant === 1) {
                    // Infernal Drake floor: scorched orange-black
                    this.ctx.fillStyle = '#140902';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    this.ctx.strokeStyle = 'rgba(249, 115, 22, 0.03)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                } else {
                    // Magma Titan floor: cracked lava tiles glowing
                    this.ctx.fillStyle = '#1f0b02';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    const pulse = Math.sin(Date.now() * 0.0035) * 0.2 + 0.8;
                    this.ctx.fillStyle = `rgba(239, 68, 68, ${pulse * 0.08})`;
                    // glowing grid patches
                    for (let i = 0; i < 4; i++) {
                        this.ctx.fillRect(150 + i*130, 150 + i*60, 100, 100);
                    }
                    
                    this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.04)';
                    this.ctx.lineWidth = 1;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                        const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                        const offset = isEvenRow ? 0 : (brickW / 2);
                        for (let x = 64 + offset; x < 736; x += brickW) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, y);
                            this.ctx.lineTo(x, y + brickH);
                            this.ctx.stroke();
                        }
                    }
                }
            } else if (bossIndex === 4) {
                if (bossVariant === 0) {
                    // Void Eye floor: cosmic starry nebula void
                    const voidGrad = this.ctx.createRadialGradient(400, 300, 30, 400, 300, 380);
                    voidGrad.addColorStop(0, '#04010b');
                    voidGrad.addColorStop(0.5, '#010004');
                    voidGrad.addColorStop(1, '#000000');
                    this.ctx.fillStyle = voidGrad;
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    // Draw a faint nebular grid lines
                    this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.015)';
                    this.ctx.lineWidth = 0.5;
                    for (let y = 64; y < 536; y += brickH) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(64, y);
                        this.ctx.lineTo(736, y);
                        this.ctx.stroke();
                    }
                    for (let x = 64; x < 736; x += brickW) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(x, 64);
                        this.ctx.lineTo(x, 536);
                        this.ctx.stroke();
                    }
                } else if (bossVariant === 1) {
                    // Cosmic Horror floor: deep space + tentacle shadows
                    const voidGrad = this.ctx.createRadialGradient(400, 300, 30, 400, 300, 380);
                    voidGrad.addColorStop(0, '#02030f');
                    voidGrad.addColorStop(1, '#000000');
                    this.ctx.fillStyle = voidGrad;
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    // Shadow patches
                    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
                    this.ctx.beginPath();
                    this.ctx.arc(300, 200, 100, 0, Math.PI*2);
                    this.ctx.arc(500, 400, 80, 0, Math.PI*2);
                    this.ctx.fill();
                } else {
                    // Shadow Overlord floor: absolute void black
                    this.ctx.fillStyle = '#000000';
                    this.ctx.fillRect(64, 64, 672, 472);
                    
                    // Shadow ripples
                    this.ctx.strokeStyle = 'rgba(30, 27, 75, 0.2)';
                    this.ctx.lineWidth = 2;
                    const rip = Math.sin(Date.now() * 0.002) * 20;
                    this.ctx.beginPath();
                    this.ctx.arc(400, 300, 120 + rip, 0, Math.PI*2);
                    this.ctx.stroke();
                }
            }
        } else if (room.type === ROOM_TYPES.ARTIFACT) {
            // Elegant dark indigo flagstone base
            const grad = this.ctx.createRadialGradient(400, 300, 30, 400, 300, 380);
            grad.addColorStop(0, '#1e1b4b'); // deep indigo-violet
            grad.addColorStop(1, '#0c0a25'); // darker indigo-black
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(64, 64, 672, 472);

            // Flagstone seams with glowing purple/teal highlights
            this.ctx.strokeStyle = 'rgba(139, 92, 246, 0.08)'; // Purple seams
            this.ctx.lineWidth = 1;
            for (let y = 64; y < 536; y += brickH) {
                this.ctx.beginPath();
                this.ctx.moveTo(64, y);
                this.ctx.lineTo(736, y);
                this.ctx.stroke();

                const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                const offset = isEvenRow ? 0 : (brickW / 2);
                for (let x = 64 + offset; x < 736; x += brickW) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, y);
                    this.ctx.lineTo(x, y + brickH);
                    this.ctx.stroke();
                }
            }

            // Draw glowing runic circle in the center of the room
            this.ctx.save();
            this.ctx.strokeStyle = '#a855f7'; // purple rune glow
            this.ctx.lineWidth = 2.5;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#c084fc';
            
            // Outer runic ring
            this.ctx.beginPath();
            this.ctx.arc(400, 300, 55, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Inner runic ring
            this.ctx.strokeStyle = '#22d3ee'; // cyan/teal inner glow
            this.ctx.shadowColor = '#22d3ee';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.arc(400, 300, 38, 0, Math.PI * 2);
            this.ctx.stroke();

            // Runic cross beams
            this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
            this.ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const angle = (Math.PI / 2) * i;
                this.ctx.moveTo(400 + Math.cos(angle) * 15, 300 + Math.sin(angle) * 15);
                this.ctx.lineTo(400 + Math.cos(angle) * 38, 300 + Math.sin(angle) * 38);
            }
            this.ctx.stroke();
            this.ctx.restore();
        } else {
            // Cool looking dark blue stone tiled floor
            const floorGrad = this.ctx.createRadialGradient(400, 300, 50, 400, 300, 420);
            floorGrad.addColorStop(0, '#0f172a'); // Slate blue stone
            floorGrad.addColorStop(1, '#020617'); // Deep dark navy
            this.ctx.fillStyle = floorGrad;
            this.ctx.fillRect(64, 64, 672, 472);
            
            // Draw flagstone staggered seams with bevel shadows & sky blue highlights
            for (let y = 64; y < 536; y += brickH) {
                // Horizontal crack shadow
                this.ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
                this.ctx.lineWidth = 1.8;
                this.ctx.beginPath();
                this.ctx.moveTo(64, y);
                this.ctx.lineTo(736, y);
                this.ctx.stroke();

                // Highlight line below shadow to create bevel depth
                this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
                this.ctx.lineWidth = 1.0;
                this.ctx.beginPath();
                this.ctx.moveTo(64, y + 1.2);
                this.ctx.lineTo(736, y + 1.2);
                this.ctx.stroke();
                
                const isEvenRow = Math.floor(y / brickH) % 2 === 0;
                const offset = isEvenRow ? 0 : (brickW / 2);
                for (let x = 64 + offset; x < 736; x += brickW) {
                    // Vertical crack shadow
                    this.ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
                    this.ctx.lineWidth = 1.8;
                    this.ctx.beginPath();
                    this.ctx.moveTo(x, y);
                    this.ctx.lineTo(x, y + brickH);
                    this.ctx.stroke();

                    // Vertical Highlight line
                    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
                    this.ctx.lineWidth = 1.0;
                    this.ctx.beginPath();
                    this.ctx.moveTo(x + 1.2, y);
                    this.ctx.lineTo(x + 1.2, y + brickH);
                    this.ctx.stroke();
                }
            }
        }

        // Draw deterministic cracks and moss patches on the floor based on grid coordinates (bypassed for boss rooms)
        if (room.type !== ROOM_TYPES.BOSS && room.type !== ROOM_TYPES.SHOP) {
            const seed = room.gridX * 13 + room.gridY * 37;
            const pseudoRandom = (s) => {
                let val = Math.sin(s) * 10000;
                return val - Math.floor(val);
            };

            for (let i = 0; i < 8; i++) {
                const px = 100 + pseudoRandom(seed + i * 7) * 580;
                const py = 100 + pseudoRandom(seed + i * 11) * 380;
                
                if (pseudoRandom(seed + i * 3) < 0.45) {
                    // Moss patch
                    this.ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
                    this.ctx.beginPath();
                    this.ctx.arc(px, py, 20 + pseudoRandom(seed + i * 5) * 30, 0, Math.PI * 2);
                    this.ctx.fill();
                } else {
                    // Dungeon floor crack
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
                    this.ctx.lineWidth = 1.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(px, py);
                    const cx1 = px + (pseudoRandom(seed + i * 4) - 0.5) * 20;
                    const cy1 = py + (pseudoRandom(seed + i * 6) - 0.5) * 20;
                    const cx2 = cx1 + (pseudoRandom(seed + i * 8) - 0.5) * 20;
                    const cy2 = cy1 + (pseudoRandom(seed + i * 10) - 0.5) * 20;
                    this.ctx.lineTo(cx1, cy1);
                    this.ctx.lineTo(cx2, cy2);
                    this.ctx.stroke();
                }
            }
        }

        // Draw Liquid drops in Mystery room
        if (room.type === ROOM_TYPES.MYSTERY && room.liquidDrops) {
            this.ctx.save();
            this.ctx.shadowBlur = 4;
            this.ctx.shadowColor = '#c084fc';
            for (const drop of room.liquidDrops) {
                this.ctx.strokeStyle = `rgba(168, 85, 247, ${drop.opacity})`;
                this.ctx.lineWidth = 1.5;
                this.ctx.beginPath();
                this.ctx.moveTo(drop.x, drop.y);
                this.ctx.lineTo(drop.x, drop.y + drop.length);
                this.ctx.stroke();

                this.ctx.fillStyle = `rgba(232, 121, 249, ${drop.opacity * 1.5})`;
                this.ctx.beginPath();
                this.ctx.arc(drop.x, drop.y + drop.length, 1.2, 0, Math.PI * 2);
                this.ctx.fill();
            }
            this.ctx.restore();
        }

        // Draw Puzzle Plates if room has puzzle
        if (room.hasPuzzle) {
            this.ctx.save();
            for (const plate of room.puzzlePlates) {
                const drawColor = plate.tempColor || (plate.active ? plate.color : 'rgba(255, 255, 255, 0.12)');
                const ringColor = plate.tempColor || plate.color;

                this.ctx.shadowBlur = plate.active ? 15 : 4;
                this.ctx.shadowColor = ringColor;

                // Draw outer stone rim
                this.ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
                this.ctx.strokeStyle = ringColor;
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.arc(plate.x, plate.y, plate.radius, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();

                // Draw inner active glow circle
                if (plate.active) {
                    this.ctx.fillStyle = drawColor;
                    this.ctx.beginPath();
                    this.ctx.arc(plate.x, plate.y, plate.radius - 6, 0, Math.PI * 2);
                    this.ctx.fill();
                }

                // Draw glyph/emoji symbol in center
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = '14px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(plate.emoji || '🔮', plate.x, plate.y);

                // Reset temporary colors if any
                if (plate.tempColor && plate.flashTimer <= 0) {
                    plate.tempColor = null;
                }
            }
            
            // Draw puzzle status overlay in the center top (small subtle banner)
            if (!room.puzzleSolved) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.roundRect(300, 75, 200, 24, 6);
                this.ctx.fill();
                this.ctx.stroke();

                this.ctx.fillStyle = '#c084fc';
                this.ctx.font = '9px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                let bannerText = "STEP ON PLATES IN SEQUENCE";
                if (room.puzzleState === 'showing_sequence') bannerText = "WATCH THE GLOW SEQUENCE";
                else if (room.puzzleState === 'waiting_input') bannerText = `REPEAT SEQUENCE: ${room.puzzleInput.length}/3`;
                this.ctx.fillText(bannerText, 400, 87);
            } else {
                // If solved, show a green solved text briefly
                this.ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
                this.ctx.strokeStyle = '#10b981';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.roundRect(340, 75, 120, 24, 6);
                this.ctx.fill();
                this.ctx.stroke();

                this.ctx.fillStyle = '#34d399';
                this.ctx.font = '9px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText("PUZZLE SOLVED", 400, 87);
            }
            this.ctx.restore();
        }

        // Draw Room border walls (Cuirassier theme blocky stone)
        // Top Wall
        this.drawStoneWall(this.ctx, 0, 0, 800, 64, false);
        // Bottom Wall
        this.drawStoneWall(this.ctx, 0, 536, 800, 64, false);
        // Left Wall
        this.drawStoneWall(this.ctx, 0, 0, 64, 600, true);
        // Right Wall
        this.drawStoneWall(this.ctx, 736, 0, 64, 600, true);

        // Draw Wall Decorations (torches and chains)
        // Top wall torches
        this.drawWallTorch(this.ctx, 240, 48);
        this.drawWallTorch(this.ctx, 560, 48);
        // Bottom wall torches
        this.drawWallTorch(this.ctx, 240, 552);
        this.drawWallTorch(this.ctx, 560, 552);
        // Left wall chains
        this.drawWallChain(this.ctx, 32, 160, 40);
        this.drawWallChain(this.ctx, 32, 380, 45);
        // Right wall chains
        this.drawWallChain(this.ctx, 768, 160, 45);
        this.drawWallChain(this.ctx, 768, 380, 40);


        // Draw room inner borders with a nice glowing color representing Room Type
        this.ctx.save();
        this.ctx.lineWidth = 3;
        if (room.type === ROOM_TYPES.BOSS) {
            this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; // glowing red walls
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#ef4444';
        } else if (room.type === ROOM_TYPES.TROPHY) {
            this.ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)'; // golden walls
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#f59e0b';
        } else if (room.type === ROOM_TYPES.MYSTERY) {
            this.ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)'; // purple walls
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#a855f7';
        } else {
            this.ctx.strokeStyle = '#1f2937';
        }
        this.ctx.strokeRect(64, 64, 672, 472);
        this.ctx.restore();

        // Draw Doors
        const doorDraw = (x, y, w, h, connected, locked) => {
            if (!connected) return;
            
            this.ctx.save();
            if (locked) {
                this.ctx.fillStyle = '#ef4444'; // Red locked doorway
                this.ctx.strokeStyle = '#7f1d1d';
            } else {
                this.ctx.fillStyle = '#09090b'; // Fading black entryway
                this.ctx.strokeStyle = '#3f3f46';
            }
            this.ctx.lineWidth = 2;
            this.ctx.fillRect(x, y, w, h);
            this.ctx.strokeRect(x, y, w, h);
            
            // Draw cross beams if locked
            if (locked) {
                this.ctx.strokeStyle = '#000';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + w, y + h);
                this.ctx.moveTo(x + w, y);
                this.ctx.lineTo(x, y + h);
                this.ctx.stroke();
            }
            this.ctx.restore();
        };

        const doorsLocked = !room.cleared;

        // Top Door
        doorDraw(360, 48, 80, 16, room.doors.up, doorsLocked);
        // Bottom Door
        doorDraw(360, 536, 80, 16, room.doors.down, doorsLocked);
        // Left Door
        doorDraw(48, 260, 16, 80, room.doors.left, doorsLocked);
        // Right Door
        doorDraw(736, 260, 16, 80, room.doors.right, doorsLocked);

        // Draw Portal for Next Level (Boss room center)
        if (room.type === ROOM_TYPES.BOSS && room.cleared) {
            this.ctx.save();
            this.ctx.translate(400, 300);
            
            // Outer portal glow
            const time = Date.now() * 0.003;
            const pulse = Math.sin(Date.now() * 0.005) * 3;
            const radius = 22 + pulse;
            
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#c084fc';
            
            // Draw deep purple portal disk
            const grad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            grad.addColorStop(0, '#0f0717');
            grad.addColorStop(0.5, '#581c87');
            grad.addColorStop(1, '#a855f7');
            
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw spinning spiral layers for swirling portal effect
            this.ctx.shadowBlur = 0; // turn off shadow blur for internal speed
            this.ctx.strokeStyle = '#c084fc';
            this.ctx.lineWidth = 2;
            
            // Layer 1: Spin clockwise
            this.ctx.save();
            this.ctx.rotate(time);
            for (let i = 0; i < 3; i++) {
                this.ctx.beginPath();
                this.ctx.rotate((Math.PI * 2) / 3);
                this.ctx.ellipse(0, 0, radius * 0.8, radius * 0.3, 0.2, 0, Math.PI * 1.5);
                this.ctx.stroke();
            }
            this.ctx.restore();
            
            // Layer 2: Spin counter-clockwise (faster)
            this.ctx.save();
            this.ctx.rotate(-time * 1.5);
            this.ctx.strokeStyle = '#e9d5ff';
            this.ctx.lineWidth = 1.5;
            for (let i = 0; i < 2; i++) {
                this.ctx.beginPath();
                this.ctx.rotate(Math.PI);
                this.ctx.ellipse(0, 0, radius * 0.9, radius * 0.2, -0.2, 0, Math.PI * 1.7);
                this.ctx.stroke();
            }
            this.ctx.restore();
            
            // Bright core
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 5 + pulse * 0.5, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.restore();
            
            // Text Label
            this.ctx.save();
            this.ctx.font = "bold 9px 'Cinzel', serif";
            this.ctx.fillStyle = '#c084fc';
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = '#a855f7';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("VOID PORTAL", 400, 335);
            this.ctx.restore();
            
            // Spawn swirling purple sparkles in the room
            if (Math.random() < 0.15) {
                const angle = Math.random() * Math.PI * 2;
                const dist = radius + 5 + Math.random() * 10;
                const px = 400 + Math.cos(angle) * dist;
                const py = 300 + Math.sin(angle) * dist;
                spawnSparkles(px, py, '#c084fc', 1);
            }
        }


        // Draw Obstacles (Stones, webs, campfires, bones)
        for (const obs of room.obstacles) {
            if (obs.type === 'web' && !obs.extinguished) {
                // Draw white web lines
                this.ctx.save();
                this.ctx.strokeStyle = 'rgba(241, 245, 249, 0.25)';
                this.ctx.lineWidth = 1.5;
                const ox = obs.x;
                const oy = obs.y;
                const size = 18;
                
                this.ctx.beginPath();
                this.ctx.moveTo(ox - size, oy - size);
                this.ctx.lineTo(ox + size, oy + size);
                this.ctx.moveTo(ox - size, oy + size);
                this.ctx.lineTo(ox + size, oy - size);
                this.ctx.moveTo(ox, oy - size);
                this.ctx.lineTo(ox, oy + size);
                this.ctx.moveTo(ox - size, oy);
                this.ctx.lineTo(ox + size, oy);
                // Connect lines
                this.ctx.strokeRect(ox - size/2, oy - size/2, size, size);
                this.ctx.stroke();
                this.ctx.restore();

            } else if (obs.type === 'stone') {
                // Stone boulders
                this.ctx.save();
                this.ctx.fillStyle = '#4b5563'; // Slate
                this.ctx.strokeStyle = '#1f2937';
                this.ctx.lineWidth = 2;
                
                this.ctx.beginPath();
                this.ctx.arc(obs.x, obs.y, 16, 0, Math.PI*2);
                this.ctx.fill();
                this.ctx.stroke();

                // Texture highlights
                this.ctx.fillStyle = '#6b7280';
                this.ctx.beginPath();
                this.ctx.arc(obs.x - 5, obs.y - 5, 5, 0, Math.PI*2);
                this.ctx.fill();
                this.ctx.restore();

            } else if (obs.type === 'bone' && obs.health > 0) {
                // Piles of white bones
                this.ctx.save();
                this.ctx.fillStyle = '#e2e8f0';
                this.ctx.strokeStyle = '#94a3b8';
                this.ctx.lineWidth = 1;
                
                // Cross bone 1
                this.ctx.translate(obs.x, obs.y);
                this.ctx.rotate(0.5);
                this.ctx.fillRect(-12, -3, 24, 6);
                this.ctx.beginPath();
                this.ctx.arc(-12, -3, 3, 0, Math.PI*2);
                this.ctx.arc(-12, 3, 3, 0, Math.PI*2);
                this.ctx.arc(12, -3, 3, 0, Math.PI*2);
                this.ctx.arc(12, 3, 3, 0, Math.PI*2);
                this.ctx.fill();

                // Cross bone 2
                this.ctx.rotate(1.2);
                this.ctx.fillRect(-12, -3, 24, 6);
                this.ctx.beginPath();
                this.ctx.arc(-12, -3, 3, 0, Math.PI*2);
                this.ctx.arc(-12, 3, 3, 0, Math.PI*2);
                this.ctx.arc(12, -3, 3, 0, Math.PI*2);
                this.ctx.arc(12, 3, 3, 0, Math.PI*2);
                this.ctx.fill();

                this.ctx.restore();

            } else if (obs.type === 'campfire') {
                this.ctx.save();

                if (!obs.extinguished) {
                    // Base wood sticks (Brown)
                    this.ctx.strokeStyle = '#78350f';
                    this.ctx.lineWidth = 4;
                    this.ctx.beginPath();
                    this.ctx.moveTo(obs.x - 10, obs.y + 10);
                    this.ctx.lineTo(obs.x + 10, obs.y - 6);
                    this.ctx.moveTo(obs.x + 10, obs.y + 10);
                    this.ctx.lineTo(obs.x - 10, obs.y - 6);
                    this.ctx.stroke();

                    // Animating fiery flames
                    const firePulse = Math.sin(Date.now() * 0.01) * 3;
                    
                    this.ctx.shadowBlur = 15;
                    this.ctx.shadowColor = '#f97316';
                    this.ctx.fillStyle = '#f97316'; // outer fire
                    this.ctx.beginPath();
                    this.ctx.moveTo(obs.x - 12, obs.y + 8);
                    this.ctx.quadraticCurveTo(obs.x - 12, obs.y - 12 + firePulse, obs.x, obs.y - 18 + firePulse);
                    this.ctx.quadraticCurveTo(obs.x + 12, obs.y - 12 + firePulse, obs.x + 12, obs.y + 8);
                    this.ctx.closePath();
                    this.ctx.fill();

                    this.ctx.fillStyle = '#f59e0b'; // inner core
                    this.ctx.beginPath();
                    this.ctx.moveTo(obs.x - 7, obs.y + 8);
                    this.ctx.quadraticCurveTo(obs.x - 7, obs.y - 6, obs.x, obs.y - 10);
                    this.ctx.quadraticCurveTo(obs.x + 7, obs.y - 6, obs.x + 7, obs.y + 8);
                    this.ctx.closePath();
                    this.ctx.fill();
                } else {
                    // Extinguished ash pile (Dark grey)
                    this.ctx.fillStyle = '#3f3f46';
                    this.ctx.beginPath();
                    this.ctx.arc(obs.x, obs.y + 4, 12, 0, Math.PI*2);
                    this.ctx.fill();

                    // Charred scattered logs (Charcoal black)
                    this.ctx.strokeStyle = '#18181b';
                    this.ctx.lineWidth = 4;
                    
                    // Charred log 1 (lying flat)
                    this.ctx.beginPath();
                    this.ctx.moveTo(obs.x - 12, obs.y + 8);
                    this.ctx.lineTo(obs.x + 2, obs.y + 3);
                    this.ctx.stroke();

                    // Charred log 2 (criss-cross broken)
                    this.ctx.beginPath();
                    this.ctx.moveTo(obs.x - 4, obs.y - 4);
                    this.ctx.lineTo(obs.x + 10, obs.y + 6);
                    this.ctx.stroke();

                    // Charred log 3 (small broken branch)
                    this.ctx.beginPath();
                    this.ctx.moveTo(obs.x - 8, obs.y + 2);
                    this.ctx.lineTo(obs.x + 6, obs.y - 2);
                    this.ctx.stroke();
                }
                this.ctx.restore();
            }
        }

        // Draw Drops
        for (const drop of room.drops) {
            drop.draw(this.ctx);
        }

        // Draw Mystery Man NPC
        if (this.mysteryManNPC) {
            this.mysteryManNPC.draw(this.ctx);
        }

        // Draw Shopkeeper NPC
        if (this.shopkeeperNPC) {
            this.shopkeeperNPC.draw(this.ctx);
        }

        // Draw Enemies
        for (const mob of room.mobs) {
            mob.draw(this.ctx);
        }

        // Draw Boss Health Bar Overlay if active
        if (this.activeBossRef && this.activeBossRef.health > 0) {
            this.activeBossRef.drawBossHealthBar(this.ctx);
        }

        // Draw Projectiles
        for (const p of this.projectiles) {
            p.draw(this.ctx);
        }

        // Draw Player
        this.player.draw(this.ctx);

        // Draw Particles
        updateAndDrawParticles(this.ctx);
        
        // Draw Boss Room Custom Particles
        if (room.type === ROOM_TYPES.BOSS) {
            const bossIndex = Math.min(this.level - 1, 4);
            const bossVariant = room.bossVariant !== undefined ? room.bossVariant : 0;
            
            if (bossIndex === 0) {
                if (bossVariant === 0 && room.butterflies) {
                    for (const b of room.butterflies) {
                        this.ctx.save();
                        this.ctx.translate(b.x, b.y);
                        const flap = Math.sin(Date.now() * 0.015 + b.flapOffset);
                        const wingWidth = b.size * Math.max(0.15, Math.abs(flap));
                        this.ctx.fillStyle = b.color;
                        // Left wing
                        this.ctx.beginPath();
                        this.ctx.ellipse(-b.size * 0.5, -b.size * 0.2, wingWidth, b.size * 0.7, -0.25, 0, Math.PI * 2);
                        this.ctx.fill();
                        // Right wing
                        this.ctx.beginPath();
                        this.ctx.ellipse(b.size * 0.5, -b.size * 0.2, wingWidth, b.size * 0.7, 0.25, 0, Math.PI * 2);
                        this.ctx.fill();
                        // Body
                        this.ctx.fillStyle = '#1c1917';
                        this.ctx.fillRect(-0.8, -b.size * 0.7, 1.6, b.size * 1.4);
                        this.ctx.restore();
                    }
                } else if (bossVariant === 1 && room.sporePuffs) {
                    this.ctx.save();
                    for (const p of room.sporePuffs) {
                        this.ctx.fillStyle = `rgba(74, 222, 128, ${p.opacity})`;
                        this.ctx.beginPath();
                        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
                        this.ctx.fill();
                    }
                    this.ctx.restore();
                } else if (bossVariant === 2 && room.swirlingLeaves) {
                    this.ctx.save();
                    for (const l of room.swirlingLeaves) {
                        this.ctx.fillStyle = l.color;
                        this.ctx.save();
                        this.ctx.translate(l.x, l.y);
                        this.ctx.rotate(l.angle);
                        // Draw simple leaf shape
                        this.ctx.beginPath();
                        this.ctx.ellipse(0, 0, l.size, l.size * 0.5, 0, 0, Math.PI*2);
                        this.ctx.fill();
                        this.ctx.restore();
                    }
                    this.ctx.restore();
                }
            } else if (bossIndex === 1) {
                if (bossVariant === 0 && room.shadowFog) {
                    this.ctx.save();
                    for (const f of room.shadowFog) {
                        this.ctx.fillStyle = `rgba(18, 12, 38, ${f.opacity})`;
                        this.ctx.beginPath();
                        this.ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                    this.ctx.restore();
                } else if (bossVariant === 1 && room.arcaneGlyphs) {
                    this.ctx.save();
                    this.ctx.font = '10px Arial';
                    for (const g of room.arcaneGlyphs) {
                        this.ctx.fillStyle = `rgba(168, 85, 247, ${g.opacity})`;
                        this.ctx.fillText(g.text, g.x, g.y);
                    }
                    this.ctx.restore();
                } else if (bossVariant === 2 && room.stoneFog) {
                    this.ctx.save();
                    for (const f of room.stoneFog) {
                        this.ctx.fillStyle = `rgba(82, 82, 91, ${f.opacity})`;
                        this.ctx.beginPath();
                        this.ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                    this.ctx.restore();
                }
            } else if (bossIndex === 2) {
                if (bossVariant === 0 && room.necroSouls) {
                    this.ctx.save();
                    this.ctx.shadowBlur = 6;
                    this.ctx.shadowColor = '#10b981';
                    for (const s of room.necroSouls) {
                        const alpha = s.opacity * (0.6 + Math.sin(Date.now() * s.pulseSpeed + s.pulseOffset) * 0.4);
                        this.ctx.fillStyle = `rgba(16, 185, 129, ${alpha})`;
                        this.ctx.beginPath();
                        this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                    this.ctx.restore();
                } else if (bossVariant === 1 && room.boneAsh) {
                    this.ctx.save();
                    for (const a of room.boneAsh) {
                        this.ctx.fillStyle = `rgba(229, 229, 229, ${a.opacity})`;
                        this.ctx.beginPath();
                        this.ctx.arc(a.x, a.y, a.size, 0, Math.PI*2);
                        this.ctx.fill();
                    }
                    this.ctx.restore();
                } else if (bossVariant === 2 && room.miasmaBubbles) {
                    this.ctx.save();
                    for (const b of room.miasmaBubbles) {
                        this.ctx.strokeStyle = `rgba(132, 204, 22, ${b.opacity})`;
                        this.ctx.fillStyle = `rgba(132, 204, 22, ${b.opacity * 0.3})`;
                        this.ctx.lineWidth = 1;
                        this.ctx.beginPath();
                        this.ctx.arc(b.x, b.y, b.size, 0, Math.PI*2);
                        this.ctx.fill();
                        this.ctx.stroke();
                    }
                    this.ctx.restore();
                }
            } else if (bossIndex === 3) {
                if (bossVariant === 0 && room.lavaEmbers) {
                    this.ctx.save();
                    this.ctx.shadowBlur = 8;
                    this.ctx.shadowColor = '#f97316';
                    for (const e of room.lavaEmbers) {
                        const heatColor = Math.random() < 0.4 ? '#facc15' : '#f97316';
                        this.ctx.fillStyle = heatColor;
                        this.ctx.globalAlpha = e.opacity;
                        this.ctx.fillRect(e.x - e.size/2, e.y - e.size/2, e.size, e.size);
                    }
                    this.ctx.restore();
                } else if (bossVariant === 1 && room.emberSparks) {
                    this.ctx.save();
                    this.ctx.shadowBlur = 10;
                    this.ctx.shadowColor = '#ea580c';
                    for (const s of room.emberSparks) {
                        this.ctx.fillStyle = '#f97316';
                        this.ctx.globalAlpha = s.opacity;
                        this.ctx.fillRect(s.x, s.y, s.size, s.size * 2);
                    }
                    this.ctx.restore();
                } else if (bossVariant === 2 && room.lavaDrops) {
                    this.ctx.save();
                    this.ctx.shadowBlur = 6;
                    this.ctx.shadowColor = '#ef4444';
                    for (const d of room.lavaDrops) {
                        this.ctx.fillStyle = `rgba(239, 68, 68, ${d.opacity})`;
                        this.ctx.beginPath();
                        this.ctx.arc(d.x, d.y, d.size, 0, Math.PI*2);
                        this.ctx.fill();
                    }
                    this.ctx.restore();
                }
            } else if (bossIndex === 4) {
                if (bossVariant === 0 && room.voidStars) {
                    this.ctx.save();
                    this.ctx.shadowBlur = 4;
                    this.ctx.shadowColor = '#c084fc';
                    for (const s of room.voidStars) {
                        const flicker = s.opacity * (0.7 + Math.sin(Date.now() * 0.005 + s.x) * 0.3);
                        this.ctx.fillStyle = s.color;
                        this.ctx.globalAlpha = flicker;
                        this.ctx.beginPath();
                        this.ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                        this.ctx.fill();
                    }
                    this.ctx.restore();
                } else if (bossVariant === 1 && room.stardust) {
                    this.ctx.save();
                    this.ctx.shadowBlur = 8;
                    this.ctx.shadowColor = '#38bdf8';
                    for (const s of room.stardust) {
                        this.ctx.fillStyle = '#e0f2fe';
                        this.ctx.globalAlpha = s.opacity;
                        this.ctx.beginPath();
                        this.ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
                        this.ctx.fill();
                    }
                    this.ctx.restore();
                } else if (bossVariant === 2 && room.shadowWisps) {
                    this.ctx.save();
                    this.ctx.shadowBlur = 6;
                    this.ctx.shadowColor = '#4f46e5';
                    for (const w of room.shadowWisps) {
                        this.ctx.fillStyle = '#1e1b4b';
                        this.ctx.globalAlpha = w.opacity;
                        this.ctx.beginPath();
                        this.ctx.arc(w.x, w.y, w.size, 0, Math.PI*2);
                        this.ctx.fill();
                    }
                    this.ctx.restore();
                }
            }
        }

        this.ctx.restore();

        // 12. Draw Room Transition Fade overlay
        if (this.transitioning) {

            this.ctx.save();
            const opacity = Math.abs(15 - this.transitionTimer) / 15; // fade out then fade in
            this.ctx.fillStyle = `rgba(0, 0, 0, ${1 - opacity})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }

        // Redraw minimap every frame so the pulsing player dot animates
        if (this.dungeon && this.currentState === this.states.PLAYING) {
            this.dungeon.drawMinimap(this.minimapCtx);
        }
    }

    openSettingsMenu() {
        this.previousState = this.currentState;
        this.currentState = this.states.SETTINGS;
        document.getElementById('settings-overlay').classList.remove('hidden');
        
        const saveBtn = document.getElementById('btn-settings-save');
        const menuBtn = document.getElementById('btn-settings-menu');
        if (this.previousState === this.states.PLAYING || this.previousState === this.states.GAMBLE) {
            if (saveBtn) saveBtn.classList.remove('hidden');
            if (menuBtn) menuBtn.classList.remove('hidden');
        } else {
            if (saveBtn) saveBtn.classList.add('hidden');
            if (menuBtn) menuBtn.classList.add('hidden');
        }

        document.getElementById('slider-music').value = Math.round(audio.musicVolume * 100);
        document.getElementById('label-music-val').textContent = `${Math.round(audio.musicVolume * 100)}%`;
        document.getElementById('slider-sfx').value = Math.round(audio.sfxVolume * 100);
        document.getElementById('label-sfx-val').textContent = `${Math.round(audio.sfxVolume * 100)}%`;

        this.updateKeybindButtons();
    }

    closeSettingsMenu() {
        document.getElementById('settings-overlay').classList.add('hidden');
        this.currentState = this.previousState;
        if (this.currentState === this.states.PLAYING && this.canvas) {
            this.canvas.focus();
        }
    }

    startRebind(action) {
        this.rebindingAction = action;
        const btn = document.getElementById(`btn-rebind-${action}`);
        if (btn) {
            btn.textContent = "...";
            btn.classList.add('waiting');
        }
    }

    completeRebind(action, newKey) {
        this.rebindingAction = null;
        const btn = document.getElementById(`btn-rebind-${action}`);
        if (btn) {
            btn.classList.remove('waiting');
        }

        this.keyBinds[action] = newKey;
        
        try {
            localStorage.setItem('void_wanderer_keybinds', JSON.stringify(this.keyBinds));
        } catch (e) {
            console.warn("Could not save key binds:", e);
        }

        this.updateKeybindButtons();
    }

    updateKeybindButtons() {
        const actions = ['moveUp', 'moveDown', 'moveLeft', 'moveRight', 'aimUp', 'aimDown', 'aimLeft', 'aimRight', 'interact'];
        actions.forEach(action => {
            const btn = document.getElementById(`btn-rebind-${action}`);
            if (btn) {
                const key = this.keyBinds[action];
                let displayKey = key.toUpperCase();
                if (key === ' ') displayKey = 'SPACE';
                if (key === 'arrowup') displayKey = '▲';
                if (key === 'arrowdown') displayKey = '▼';
                if (key === 'arrowleft') displayKey = '◀';
                if (key === 'arrowright') displayKey = '▶';
                btn.textContent = displayKey;
            }
        });
    }

    saveGame() {
        if (!this.player) return;
        
        try {
            const saveData = {
                level: this.level,
                mobsKilled: this.mobsKilled,
                roomsCleared: this.roomsCleared,
                mysteryManInteractedThisLevel: this.mysteryManInteractedThisLevel,
                shopkeeperBannedLevel: this.shopkeeperBannedLevel,
                player: {
                    maxHealth: this.player.maxHealth,
                    health: this.player.health,
                    mana: this.player.mana,
                    maxMana: this.player.maxMana,
                    damage: this.player.damage,
                    attackSpeed: this.player.attackSpeed,
                    speed: this.player.speed,
                    range: this.player.range,
                    currentWeapon: this.player.currentWeapon,
                    coins: this.player.coins || 0
                }
            };
            
            localStorage.setItem('void_wanderer_save', JSON.stringify(saveData));
            spawnFloatingText(this.player.x, this.player.y - 40, "PROGRESS SAVED", '#10b981', 14);
            audio.play('gamble_end');
            this.checkSaveExists();
        } catch (e) {
            console.warn("Save failed:", e);
            spawnFloatingText(this.player.x, this.player.y - 40, "SAVE FAILED", '#ef4444', 14);
        }
    }

    loadGame() {
        try {
            const save = localStorage.getItem('void_wanderer_save');
            if (!save) return;
            
            const saveData = JSON.parse(save);
            
            this.level = saveData.level;
            this.mobsKilled = saveData.mobsKilled;
            this.roomsCleared = saveData.roomsCleared;

            document.getElementById('start-screen').classList.add('hidden');
            document.getElementById('game-over-screen').classList.add('hidden');
            document.getElementById('victory-screen').classList.add('hidden');
            document.getElementById('hud').classList.remove('hidden');

            this.player = new Player(400, 300);
            
            const p = saveData.player;
            this.player.maxHealth = p.maxHealth;
            this.player.health = p.health;
            this.player.mana = p.mana;
            this.player.maxMana = p.maxMana;
            this.player.damage = p.damage;
            this.player.attackSpeed = p.attackSpeed;
            this.player.speed = p.speed;
            this.player.range = p.range;
            this.player.coins = p.coins || 0;
            
            this.selectWeapon(p.currentWeapon);
            this.shopkeeperBannedLevel = saveData.shopkeeperBannedLevel || -1;
            this.generateLevel();
            this.mysteryManInteractedThisLevel = saveData.mysteryManInteractedThisLevel || false;
            this.setupMysteryManNPC();
            this.setupShopkeeperNPC();

            this.currentState = this.states.PLAYING;
            audio.startMusic();

            if (this.canvas) {
                this.canvas.focus();
            }
        } catch (e) {
            console.warn("Load failed:", e);
        }
    }

    checkSaveExists() {
        try {
            const save = localStorage.getItem('void_wanderer_save');
            const continueBtn = document.getElementById('btn-continue');
            if (save && continueBtn) {
                continueBtn.classList.remove('hidden');
            } else if (continueBtn) {
                continueBtn.classList.add('hidden');
            }
        } catch (e) {
            console.warn("Could not check save file:", e);
        }
    }

    exitToMainMenu() {
        audio.stopMusic();
        document.getElementById('settings-overlay').classList.add('hidden');
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
        
        this.currentState = this.states.START;
        this.checkSaveExists();
    }

    updateRoomPuzzle(room) {
        // Handle flashing sequence state
        if (room.puzzleState === 'showing_sequence') {
            room.puzzleShowTimer--;
            if (room.puzzleShowTimer <= 0) {
                room.puzzleFlashStep++;
                if (room.puzzleFlashStep < room.puzzleSequence.length) {
                    const plateId = room.puzzleSequence[room.puzzleFlashStep];
                    const plate = room.puzzlePlates.find(p => p.id === plateId);
                    if (plate) {
                        plate.active = true;
                        plate.flashTimer = 25; // stays lit for 25 frames
                        const sfxPitch = [300, 450, 600][plateId];
                        audio.playSynthNote(sfxPitch, 'sine', 0.15, 0.35, audio.ctx.currentTime);
                        spawnSparkles(plate.x, plate.y, plate.color, 8);
                    }
                    room.puzzleShowTimer = 45; // wait 45 frames before next flash
                } else {
                    // Finished showing sequence, wait for player input
                    room.puzzleState = 'waiting_input';
                    room.puzzleInput = [];
                }
            }
        }

        // Update individual plate flashing timer
        for (const plate of room.puzzlePlates) {
            if (plate.flashTimer > 0 && plate.flashTimer < 99999) {
                plate.flashTimer--;
                if (plate.flashTimer <= 0) {
                    plate.active = false;
                }
            }
        }

        // Check if player steps on any plate (only when waiting for input)
        if (room.puzzleState === 'waiting_input') {
            for (const plate of room.puzzlePlates) {
                const px = this.player.x;
                const py = this.player.y;
                const dx = px - plate.x;
                const dy = py - plate.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < plate.radius + 15) {
                    if (!plate.active && !plate.playerInside) {
                        plate.playerInside = true;
                        plate.active = true;
                        plate.flashTimer = 20;

                        // Add to input sequence
                        room.puzzleInput.push(plate.id);

                        const stepIndex = room.puzzleInput.length - 1;
                        const expectedId = room.puzzleSequence[stepIndex];

                        if (plate.id === expectedId) {
                            // Correct step!
                            const sfxPitch = [300, 450, 600][plate.id];
                            audio.playSynthNote(sfxPitch, 'sine', 0.2, 0.4, audio.ctx.currentTime);
                            spawnSparkles(plate.x, plate.y, plate.color, 12);
                            spawnFloatingText(plate.x, plate.y - 30, "✔️", '#10b981');

                            // If sequence complete
                            if (room.puzzleInput.length === room.puzzleSequence.length) {
                                room.puzzleSolved = true;
                                room.puzzleState = 'solved';
                                
                                audio.play('gamble_end');
                                spawnSparkles(400, 300, '#10b981', 30);
                                
                                room.puzzlePlates.forEach(p => {
                                    p.color = '#10b981';
                                    p.active = true;
                                    p.flashTimer = 999999;
                                    p.tempColor = '#10b981';
                                });

                                this.spawnPuzzleReward(room);
                            }
                        } else {
                            // Incorrect step!
                            audio.playSynthNote(120, 'sawtooth', 0.3, 0.5, audio.ctx.currentTime);
                            spawnFloatingText(plate.x, plate.y - 30, "❌", '#ef4444');
                            
                            room.puzzlePlates.forEach(p => {
                                p.active = true;
                                p.flashTimer = 35;
                                p.tempColor = '#ef4444';
                            });

                            room.puzzleState = 'showing_sequence';
                            room.puzzleShowTimer = 55;
                            room.puzzleFlashStep = -1;
                            room.puzzleInput = [];
                        }
                    }
                } else {
                    plate.playerInside = false;
                }
            }
        }
    }

    spawnPuzzleReward(room) {
        const isCoin = Math.random() < 0.5;
        if (isCoin) {
            const coinRoll = Math.random();
            let amount = 1;
            if (coinRoll > 0.85) amount = 10;
            else if (coinRoll > 0.5) amount = 5;

            for (let i = 0; i < amount; i++) {
                const rx = 400 + (Math.random() * 40 - 20);
                const ry = 300 + (Math.random() * 40 - 20);
                room.drops.push(new Drop(rx, ry, 'coin'));
            }
            spawnFloatingText(400, 240, `+${amount} COINS REWARD!`, '#eab308');
        } else {
            const heartRoll = Math.random();
            let amount = 1;
            if (heartRoll > 0.85) amount = 3;
            else if (heartRoll > 0.5) amount = 2;

            for (let i = 0; i < amount; i++) {
                const rx = 400 + (Math.random() * 40 - 20);
                const ry = 300 + (Math.random() * 40 - 20);
                room.drops.push(new Drop(rx, ry, 'heart'));
            }
            spawnFloatingText(400, 240, `+${amount} HEARTS REWARD!`, '#ef4444');
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

// Initialise engine on window load
window.addEventListener('load', () => {
    const game = new Game();
    game.loop();
});
