// Main Game Engine for Void Wanderer
// Manages loops, states, rendering, inputs, room transitions, and synth audio effects

import { Dungeon, ROOM_TYPES, START_X, START_Y } from './dungeon.js?v=20';
import { Player, Enemy, Boss, Drop } from './entities.js?v=20';
import { updateAndDrawParticles, clearParticles, spawnSmoke, spawnSparkles, spawnFloatingText, spawnEmbers } from './particles.js?v=20';
import { performMysteryGamble, MysteryManNPC } from './mysteryMan.js?v=20';
import { ShopkeeperNPC } from './shop.js?v=20';
import { audio } from './audio.js?v=20';





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
            SETTINGS: 'settings'
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
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    return;
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
                
                // Switch weapons (handle both code and key fallback)
                if (this.currentState === this.states.PLAYING) {
                    if (e.code === 'Digit1' || e.key === '1') this.selectWeapon('sword');
                    if (e.code === 'Digit2' || e.key === '2') this.selectWeapon('bow');
                    if (e.code === 'Digit3' || e.key === '3') this.selectWeapon('magic');
                    
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
        audio.startMusic();
        
        // Shift focus to the canvas for keyboard inputs
        if (this.canvas) {
            this.canvas.focus();
        }
    }

    generateLevel() {
        this.dungeon = new Dungeon(this.level);
        this.projectiles = [];
        clearParticles();
        this.mysteryManInteractedThisLevel = false;
        this.shopkeeperInteractedThisLevel = false;
        
        // Reset player positions to start room center
        this.player.x = 400;
        this.player.y = 300;
        
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
            this.shopkeeperNPC = new ShopkeeperNPC(400, 300);
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

        const maxInteractDist = clicked ? 80 : 50;
        const dx = this.player.x - this.shopkeeperNPC.x;
        const dy = this.player.y - this.shopkeeperNPC.y;
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
                    type = r < 0.65 ? 'chaser' : 'swarmer';
                } else if (this.level === 2) {
                    type = r < 0.5 ? 'chaser' : (r < 0.85 ? 'swarmer' : 'shooter');
                } else {
                    type = r < 0.35 ? 'chaser' : (r < 0.65 ? 'swarmer' : 'shooter');
                }

                room.mobs.push(new Enemy(sx, sy, type, multiplier));
                spawnSmoke(sx, sy, 5);
            }
        } else if (room.type === ROOM_TYPES.BOSS) {
            // Spawn Level Boss
            room.mobs.push(new Boss(400, 260, this.level));
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
        document.getElementById('stat-damage').textContent = this.player.damage.toFixed(1);
        document.getElementById('stat-ats').textContent = this.player.attackSpeed.toFixed(2);
        document.getElementById('stat-speed').textContent = this.player.speed.toFixed(1);
        document.getElementById('stat-range').textContent = Math.round(this.player.range);
        
        const coinsEl = document.getElementById('stat-coins');
        if (coinsEl) {
            coinsEl.textContent = this.player.coins || 0;
        }
    }

    updateLevelDisplay() {
        const numeral = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        const display = numeral[this.level - 1] || `DEPTH ${this.level}`;
        document.getElementById('level-display').textContent = `DEPTH ${display}`;
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
                        
                        if (proj.type === 'magic') {
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
                } else if (mob.type === 'swarmer' || mob.type === 'mini_swarmer') {
                    audio.play('slime_die');
                } else if (mob.type === 'shooter') {
                    audio.play('bat_die');
                } else if (mob.type === 'chaser') {
                    audio.play('goblin_die');
                } else {
                    audio.play('enemy_die');
                }
                this.mobsKilled++;

                // Swarmer splitting logic
                if (mob.type === 'swarmer') {
                    // Split into two smaller slimes
                    room.mobs.push(new Enemy(mob.x - 10, mob.y, 'mini_swarmer', 1));
                    room.mobs.push(new Enemy(mob.x + 10, mob.y, 'mini_swarmer', 1));
                    spawnSmoke(mob.x, mob.y, 4, 0.6);
                }

                // Normal drops chance on mob death
                const r = Math.random();
                if (r < 0.15) {
                    room.drops.push(new Drop(mob.x, mob.y, 'coin'));
                } else if (r < 0.22) {
                    room.drops.push(new Drop(mob.x, mob.y, 'mana'));
                } else if (r < 0.28) {
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

            // If Boss Room is cleared, spawn the Next Level Portal and Trophy
            if (room.type === ROOM_TYPES.BOSS) {
                room.drops.push(new Drop(400, 230, 'trophy'));
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

    draw() {
        // Clear Screen
        this.ctx.fillStyle = '#050507';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.dungeon) return;

        const room = this.dungeon.activeRoom;
        if (!room) return;

        this.ctx.save();
        this.ctx.translate(80, 100);
        this.ctx.scale(0.80, 0.80);


        // Render Room Floor (Dark flagstone brick dungeon tiles)
        const brickW = 80;
        const brickH = 40;
        
        if (room.type === ROOM_TYPES.MYSTERY) {
            const grad = this.ctx.createRadialGradient(400, 300, 30, 400, 300, 380);
            grad.addColorStop(0, '#1c0c30'); // warm dark purple
            grad.addColorStop(1, '#07020d'); // dark void black-purple
            this.ctx.fillStyle = grad;
        } else {
            this.ctx.fillStyle = '#050508';
        }
        this.ctx.fillRect(64, 64, 672, 472);
        
        // Draw flagstone staggered seams
        this.ctx.strokeStyle = room.type === ROOM_TYPES.MYSTERY ? 'rgba(168, 85, 247, 0.08)' : 'rgba(255, 255, 255, 0.015)';
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

        // Draw deterministic cracks and moss patches on the floor based on grid coordinates
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

        // Draw Room border walls (Cuirassier theme blocky stone)
        // Top Wall
        this.drawStoneWall(this.ctx, 0, 0, 800, 64, false);
        // Bottom Wall
        this.drawStoneWall(this.ctx, 0, 536, 800, 64, false);
        // Left Wall
        this.drawStoneWall(this.ctx, 0, 0, 64, 600, true);
        // Right Wall
        this.drawStoneWall(this.ctx, 736, 0, 64, 600, true);

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

        this.ctx.restore();

        // 12. Draw Room Transition Fade overlay
        if (this.transitioning) {

            this.ctx.save();
            const opacity = Math.abs(15 - this.transitionTimer) / 15; // fade out then fade in
            this.ctx.fillStyle = `rgba(0, 0, 0, ${1 - opacity})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
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
