// Entities for Void Wanderer
// Handles Player, Weapons, Projectiles, Enemies, Bosses, Drops, and Collisions

import { spawnBlood, spawnSparkles, spawnExplosion, spawnFloatingText, spawnSmoke, spawnLightningExplosion } from './particles.js?v=24';
import { ROOM_TYPES } from './dungeon.js?v=24';
import { audio } from './audio.js?v=24';

export const ARTIFACTS_DATABASE = [
    {
        id: 'ruby_fangs',
        name: 'Vampire Fangs',
        description: 'Heal 0.25 heart on defeating an enemy.',
        emoji: '🧛',
        color: '#ef4444'
    },
    {
        id: 'mana_crystal',
        name: 'Mana Crystal',
        description: '+30 Max Mana and +1 Mana Regen rate.',
        emoji: '💎',
        color: '#3b82f6'
    },
    {
        id: 'luck_clover',
        name: 'Emerald Clover',
        description: '+15% coin drop chance and value.',
        emoji: '🍀',
        color: '#10b981'
    },
    {
        id: 'hourglass',
        name: 'Chronos Watch',
        description: '+15% faster attack cooldown.',
        emoji: '⏳',
        color: '#f59e0b'
    },
    {
        id: 'feather',
        name: 'Pegasus Boot',
        description: '+0.5 faster movement speed.',
        emoji: '🪶',
        color: '#e2e8f0'
    },
    {
        id: 'obsidian_shield',
        name: 'Obsidian Crest',
        description: 'Reduces all incoming damage by 0.5.',
        emoji: '🛡️',
        color: '#475569'
    },
    {
        id: 'phoenix_ashes',
        name: 'Phoenix Feather',
        description: 'Saves you from death once, reviving with 2 hearts.',
        emoji: '🔥',
        color: '#f97316'
    },
    {
        id: 'tesla_coil',
        name: 'Tesla Shard',
        description: 'Zaps random surrounding enemies for 1 damage every 2 seconds.',
        emoji: '⚡',
        color: '#22d3ee'
    },
    {
        id: 'cursed_ring',
        name: 'Cursed Band',
        description: '+1.5 base weapon damage, but -1 max health.',
        emoji: '💍',
        color: '#c084fc'
    },
    {
        id: 'necro_urn',
        name: 'Lich Urn',
        description: 'Gains 1 second of shield invulnerability when taking damage.',
        emoji: '⚱️',
        color: '#84cc16'
    },
    {
        id: 'frozen_tear',
        name: 'Frozen Tear',
        description: 'Attacks freeze/slow enemies by 25% for 1.5 seconds.',
        emoji: '💧',
        color: '#a5f3fc'
    },
    {
        id: 'greed_coin',
        name: 'Greed Emblem',
        description: 'Defeated enemies have a 10% chance to drop double coins.',
        emoji: '🪙',
        color: '#eab308'
    },
    {
        id: 'demon_horn',
        name: 'Demon Horn',
        description: '+0.8 weapon damage and +10% movement speed.',
        emoji: '😈',
        color: '#dc2626'
    },
    {
        id: 'holy_grail',
        name: 'Holy Grail',
        description: 'Fully restores health at the start of each depth level.',
        emoji: '🏆',
        color: '#fbbf24'
    },
    {
        id: 'void_core',
        name: 'Void Lens',
        description: 'Player projectiles pierce 1 additional enemy.',
        emoji: '🌀',
        color: '#7c3aed'
    }
];





// Collision utility: Circle vs AABB (Rectangle)
function resolveCircleRectCollision(circle, rect) {
    // Find closest point on rect to circle center
    const closestX = Math.max(rect.x - rect.width / 2, Math.min(circle.x, rect.x + rect.width / 2));
    const closestY = Math.max(rect.y - rect.height / 2, Math.min(circle.y, rect.y + rect.height / 2));

    // Calculate distance
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < circle.radius) {
        // Collision! Push circle out
        if (distance === 0) {
            // Edge case: center is inside rectangle, push randomly
            circle.x += circle.radius;
            return true;
        }
        
        const overlap = circle.radius - distance;
        const pushX = (dx / distance) * overlap;
        const pushY = (dy / distance) * overlap;
        
        circle.x += pushX;
        circle.y += pushY;
        return true;
    }
    return false;
}

export class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 22;
        
        // Stats
        this.maxHealth = 3; // Heart containers
        this.health = 3;    // Current hearts
        this.mana = 100;
        this.maxMana = 100;
        this.manaRegen = 0.25; // per frame
        this.manaRegenDelay = 0; // cooldown in frames before mana starts regenerating
        
        this.damage = 3.5;
        this.attackSpeed = 1.0; // attacks per second
        this.speed = 3.0;
        this.range = 350; // projectile lifespan in pixels
        
        // Combat tracking
        this.currentWeapon = 'sword'; // 'sword', 'bow', 'magic'
        this.shootCooldown = 0;
        this.invulnFrames = 0;
        
        // Animation
        this.aimAngle = 0;
        this.moving = false;
        this.walkCycle = 0;
        this.moveDx = 0;
        this.moveDy = 0;
        
        // Sword Slash Visual Track
        this.swordSlash = null; // { angle, progress, max }
        this.coins = 0;
        this.specialSpellCharged = false;
        this.artifacts = [];
    }

    hasArtifact(id) {
        return this.artifacts && this.artifacts.includes(id);
    }

    addArtifact(art) {
        if (!this.artifacts) this.artifacts = [];
        // Prevent duplicates
        if (this.artifacts.includes(art.id)) return;
        this.artifacts.push(art.id);
        
        // Immediate adjustments on pickup
        if (art.id === 'mana_crystal') {
            this.maxMana = 130;
            this.manaRegen = 0.45; // significantly faster mana regen (was 0.25)
            this.mana = Math.min(this.maxMana, this.mana + 30);
        }
        if (art.id === 'cursed_ring') {
            this.maxHealth = Math.max(1, this.maxHealth - 1);
            this.health = Math.min(this.maxHealth, this.health);
        }
        
        if (window.game && typeof window.game.updateHUDStats === 'function') {
            window.game.updateHUDStats();
        }
    }

    removeArtifact(id) {
        if (!this.artifacts) return;
        const idx = this.artifacts.indexOf(id);
        if (idx !== -1) {
            this.artifacts.splice(idx, 1);
            // Revert changes if necessary
            if (id === 'cursed_ring') {
                this.maxHealth += 1;
                this.health = Math.min(this.maxHealth, this.health + 1);
            }
            if (id === 'mana_crystal') {
                this.maxMana = 100;
                this.manaRegen = 0.25;
                this.mana = Math.min(this.maxMana, this.mana);
            }
        }
        if (window.game && typeof window.game.updateHUDStats === 'function') {
            window.game.updateHUDStats();
        }
    }

    getDamage() {
        let baseDmg = this.damage;
        if (this.hasArtifact('cursed_ring')) baseDmg += 1.5;
        if (this.hasArtifact('demon_horn')) baseDmg += 0.8;
        return baseDmg;
    }

    takeDamage(amount) {
        if (this.invulnFrames > 0) return false;

        // Apply Obsidian Shield damage reduction
        let actualAmount = amount;
        if (this.hasArtifact('obsidian_shield')) {
            actualAmount = Math.max(0.25, actualAmount - 0.5);
        }

        // Phoenix ashes checks
        if (this.health - actualAmount <= 0) {
            if (this.hasArtifact('phoenix_ashes')) {
                this.removeArtifact('phoenix_ashes');
                this.health = 2; // Revived with 2 hearts!
                this.invulnFrames = 180; // 3 seconds invuln
                spawnSparkles(this.x, this.y, '#f97316', 30);
                spawnFloatingText(this.x, this.y - 20, "REBORN!", '#f97316', 20, true);
                audio.play('gamble_end');
                if (window.game && typeof window.game.updateHUDHealth === 'function') {
                    window.game.updateHUDHealth();
                }
                return false; // Prevent death
            }
        }

        this.health -= actualAmount;
        // Necro Urn gives double invincibility frames (120 frames instead of 60)
        this.invulnFrames = this.hasArtifact('necro_urn') ? 120 : 60;

        spawnBlood(this.x, this.y, 12);
        spawnFloatingText(this.x, this.y - 15, `-${actualAmount} HP`, '#ef4444', 16);

        audio.play('player_hit');

        if (window.game && typeof window.game.updateHUDHealth === 'function') {
            window.game.updateHUDHealth();
        }
        return true;
    }

    heal(amount) {
        const prev = this.health;
        this.health = Math.min(this.maxHealth, this.health + amount);
        if (this.health > prev) {
            spawnSparkles(this.x, this.y, '#10b981', 10);
            spawnFloatingText(this.x, this.y - 15, `+${amount} Health`, '#10b981', 14);
            audio.play('heal');
            
            // Immediately update health bar
            if (window.game && typeof window.game.updateHUDHealth === 'function') {
                window.game.updateHUDHealth();
            }
            return true;
        }
        return false;
    }

    addMaxHealth(amount) {
        this.maxHealth += amount;
        this.health += amount; // heal for the increase
        spawnSparkles(this.x, this.y, '#10b981', 15);
        spawnFloatingText(this.x, this.y - 15, `+${amount} Max Hearts`, '#10b981', 15);
        
        // Immediately update health bar
        if (window.game && typeof window.game.updateHUDHealth === 'function') {
            window.game.updateHUDHealth();
        }
    }


    restoreMana(amount) {
        const prev = this.mana;
        this.mana = Math.min(this.maxMana, this.mana + amount);
        if (this.mana > prev) {
            spawnSparkles(this.x, this.y, '#06b6d4', 8);
            spawnFloatingText(this.x, this.y - 15, `+${Math.floor(amount)} Mana`, '#06b6d4', 12);
        }
    }

    update(keys, mouse, obstacles, currentRoom, keyBinds) {
        // Invuln blink
        if (this.invulnFrames > 0) this.invulnFrames--;
        
        // Sword swing fade
        if (this.swordSlash) {
            this.swordSlash.progress++;
            if (this.swordSlash.progress >= this.swordSlash.max) {
                this.swordSlash = null;
            }
        }

        // Mana Regeneration
        if (this.manaRegenDelay > 0) {
            this.manaRegenDelay--;
        } else {
            this.mana = Math.min(this.maxMana, this.mana + this.manaRegen);
        }
        // Attack Cooldown (Chronos Watch reduces cooldowns by 15%)
        if (this.shootCooldown > 0) {
            this.shootCooldown -= this.hasArtifact('hourglass') ? 1.25 : 1.0;
            if (this.shootCooldown < 0) this.shootCooldown = 0;
        }

        // Tesla Coil zapping logic (every 2 seconds / 120 frames)
        if (this.hasArtifact('tesla_coil')) {
            this.teslaTimer = (this.teslaTimer || 0) + 1;
            if (this.teslaTimer >= 120) {
                this.teslaTimer = 0;
                if (currentRoom && currentRoom.mobs && currentRoom.mobs.length > 0) {
                    const nearbyMobs = currentRoom.mobs.filter(m => {
                        const dx = m.x - this.x;
                        const dy = m.y - this.y;
                        return Math.sqrt(dx*dx + dy*dy) < 180;
                    });
                    if (nearbyMobs.length > 0) {
                        // Pick random mob and zap
                        const target = nearbyMobs[Math.floor(Math.random() * nearbyMobs.length)];
                        target.takeDamage(1.5, 0, 0); // deal 1.5 damage
                        spawnSparkles(target.x, target.y, '#22d3ee', 8);
                        audio.play('hit');
                    }
                }
            }
        }

        // Determine speed multiplier (webs slow down player by 50%, roots by 75%)
        let speedMultiplier = 1;
        for (const obs of obstacles) {
            if ((obs.type === 'web' || obs.type === 'root') && !obs.extinguished) {
                const dx = this.x - obs.x;
                const dy = this.y - obs.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < this.radius + obs.width / 2) {
                    speedMultiplier = obs.type === 'root' ? 0.25 : 0.5;
                    break;
                }
            }
        }

        // Handle Movement (strictly based on keyBinds)
        const binds = keyBinds || {
            moveUp: 'w',
            moveDown: 's',
            moveLeft: 'a',
            moveRight: 'd',
            aimUp: 'arrowup',
            aimDown: 'arrowdown',
            aimLeft: 'arrowleft',
            aimRight: 'arrowright'
        };

        let dx = 0;
        let dy = 0;
        
        if (keys[binds.moveUp]) dy -= 1;
        if (keys[binds.moveDown]) dy += 1;
        if (keys[binds.moveLeft]) dx -= 1;
        if (keys[binds.moveRight]) dx += 1;

        this.moving = (dx !== 0 || dy !== 0);

        if (this.moving) {
            // Normalize movement vector
            const length = Math.sqrt(dx * dx + dy * dy);
            this.moveDx = dx / length;
            this.moveDy = dy / length;
            let baseSpeed = this.speed;
            if (this.hasArtifact('feather')) baseSpeed += 0.5;
            if (this.hasArtifact('demon_horn')) baseSpeed += 0.3;
            const actualSpeed = baseSpeed * speedMultiplier;
            this.x += this.moveDx * actualSpeed;
            this.y += this.moveDy * actualSpeed;
            this.walkCycle += 0.15;
        } else {
            this.moveDx = 0;
            this.moveDy = 0;
        }

        // Bounding Room Collisions (Excluding doors if cleared)
        const wallMinX = 64 + this.radius;
        const wallMaxX = 736 - this.radius;
        const wallMinY = 64 + this.radius;
        const wallMaxY = 536 - this.radius;

        // Collision logic with outer walls, allowing doorways
        const inDoorwayX = this.x >= 360 && this.x <= 440;
        const inDoorwayY = this.y >= 260 && this.y <= 340;

        if (currentRoom.cleared) {
            // If room cleared, allow passing through the doorways to trigger transitions
            // Up door transition
            if (currentRoom.doors.up && inDoorwayX) {
                if (this.y < 48) this.y = 48;
            } else if (this.y < wallMinY) {
                this.y = wallMinY;
            }

            // Down door
            if (currentRoom.doors.down && inDoorwayX) {
                if (this.y > 552) this.y = 552;
            } else if (this.y > wallMaxY) {
                this.y = wallMaxY;
            }

            // Left door
            if (currentRoom.doors.left && inDoorwayY) {
                if (this.x < 48) this.x = 48;
            } else if (this.x < wallMinX) {
                this.x = wallMinX;
            }

            // Right door
            if (currentRoom.doors.right && inDoorwayY) {
                if (this.x > 752) this.x = 752;
            } else if (this.x > wallMaxX) {
                this.x = wallMaxX;
            }
        } else {
            // Locked doors, keep inside walls strictly
            this.x = Math.max(wallMinX, Math.min(wallMaxX, this.x));
            this.y = Math.max(wallMinY, Math.min(wallMaxY, this.y));
        }

        // Obstacles Collisions (Stones & Bones are solid)
        for (const obs of obstacles) {
            if (obs.type === 'stone' || (obs.type === 'bone' && obs.health > 0)) {
                resolveCircleRectCollision(this, obs);
            }
            // Campfire deals damage if touched
            if (obs.type === 'campfire' && !obs.extinguished) {
                const dist = Math.sqrt((this.x - obs.x)**2 + (this.y - obs.y)**2);
                if (dist < this.radius + 15) {
                    this.takeDamage(1);
                }
            }
        }

        // Aiming angle from arrow keys or movement direction
        let shootDx = 0;
        let shootDy = 0;
        if (keys[binds.aimUp]) shootDy -= 1;
        if (keys[binds.aimDown]) shootDy += 1;
        if (keys[binds.aimLeft]) shootDx -= 1;
        if (keys[binds.aimRight]) shootDx += 1;

        const isShooting = (shootDx !== 0 || shootDy !== 0);
        if (isShooting) {
            this.aimAngle = Math.atan2(shootDy, shootDx);
        } else if (this.moving) {
            this.aimAngle = Math.atan2(dy, dx);
        }
    }

    attack(mouse, projectiles, currentRoom, playAudioCallback) {
        if (this.shootCooldown > 0) return false;

        const cooldownFrames = 60 / this.attackSpeed;

        if (this.currentWeapon === 'sword') {
            this.shootCooldown = cooldownFrames;
            this.swordSlash = {
                angle: this.aimAngle,
                progress: 0,
                max: 12
            };
            
            // Sweep damage in cone
            const swingRadius = 90;
            const swingAngle = Math.PI * 0.65; // ~120 degrees arc

            if (playAudioCallback) playAudioCallback('slash');

            // Hit Mobs in current room
            for (const mob of currentRoom.mobs) {
                const dx = mob.x - this.x;
                const dy = mob.y - this.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist < swingRadius + mob.radius) {
                    let angleToMob = Math.atan2(dy, dx);
                    let diffAngle = angleToMob - this.aimAngle;
                    while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
                    while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

                    if (Math.abs(diffAngle) < swingAngle / 2) {
                        const kForce = 6;
                        mob.takeDamage(this.getDamage(), Math.cos(angleToMob) * kForce, Math.sin(angleToMob) * kForce);
                        if (this.hasArtifact('frozen_tear')) {
                            mob.slowTimer = 90;
                        }
                    }
                }
            }

            // Deflect/Destroy enemy projectiles in swing arc
            for (let i = projectiles.length - 1; i >= 0; i--) {
                const proj = projectiles[i];
                if (proj.owner === 'enemy') {
                    const dx = proj.x - this.x;
                    const dy = proj.y - this.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    if (dist < swingRadius) {
                        let angleToProj = Math.atan2(dy, dx);
                        let diffAngle = angleToProj - this.aimAngle;
                        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
                        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

                        if (Math.abs(diffAngle) < swingAngle / 2) {
                            // Deflect it: change ownership and redirect
                            proj.owner = 'player';
                            proj.vx = Math.cos(this.aimAngle) * 8;
                            proj.vy = Math.sin(this.aimAngle) * 8;
                            proj.damage = this.getDamage() * 0.75;
                            spawnSparkles(proj.x, proj.y, '#e9d5ff', 5);
                        }
                    }
                }
            }

            // Damage destructibles
            for (const obs of currentRoom.obstacles) {
                if ((obs.type === 'bone' && obs.health > 0) || (obs.type === 'campfire' && !obs.extinguished)) {
                    const dx = obs.x - this.x;
                    const dy = obs.y - this.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    if (dist < swingRadius + 15) {
                        let angleToObs = Math.atan2(dy, dx);
                        let diffAngle = angleToObs - this.aimAngle;
                        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
                        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

                        if (Math.abs(diffAngle) < swingAngle / 2) {
                            if (obs.type === 'bone') {
                                obs.health = 0;
                                spawnSparkles(obs.x, obs.y, '#f8fafc', 8);
                                this.dropLoot(obs.x, obs.y, currentRoom);
                            } else {
                                obs.extinguished = true;
                                spawnSmoke(obs.x, obs.y, 4);
                            }
                        }
                    }
                }
            }

        } else if (this.currentWeapon === 'bow') {
            this.shootCooldown = cooldownFrames;
            if (playAudioCallback) playAudioCallback('arrow');

            const speed = 9;
            projectiles.push(new Projectile({
                x: this.x,
                y: this.y,
                vx: Math.cos(this.aimAngle) * speed,
                vy: Math.sin(this.aimAngle) * speed,
                damage: this.getDamage() * 0.8,
                range: this.range * 1.2,
                type: 'arrow',
                owner: 'player'
            }));

        } else if (this.currentWeapon === 'magic') {
            const speed = 18; // high-speed lightning bolt

            if (this.specialSpellCharged) {
                // Shoot the strong lightning combo (paid on prep, so no extra mana taken here)
                const spreadAngle = 0.22;
                const angles = [this.aimAngle - spreadAngle, this.aimAngle, this.aimAngle + spreadAngle];

                angles.forEach(angle => {
                    projectiles.push(new Projectile({
                        x: this.x,
                        y: this.y,
                        startX: this.x,
                        startY: this.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        damage: this.getDamage() * 2.2, // stronger lightning combo damage
                        range: this.range * 1.2,
                        type: 'lightning',
                        owner: 'player'
                    }));
                });

                this.specialSpellCharged = false; // consume charge
                this.shootCooldown = cooldownFrames * 1.5; // slightly longer cooldown for the combo
                if (playAudioCallback) {
                    playAudioCallback('spell');
                    playAudioCallback('slash'); // double sound effect for punchiness
                }
                
                // Spawn a visual combo shockwave of particles around the player
                for (let i = 0; i < 15; i++) {
                    const rAngle = Math.random() * Math.PI * 2;
                    const rDist = 15 + Math.random() * 25;
                    spawnSparkles(this.x + Math.cos(rAngle) * rDist, this.y + Math.sin(rAngle) * rDist, '#22d3ee', 2);
                }
            } else {
                // Normal lightning shot - consumes 20 mana
                if (this.mana < 20) {
                    spawnFloatingText(this.x, this.y - 15, "OUT OF MANA!", '#06b6d4', 12);
                    return false;
                }

                this.mana -= 20;
                this.manaRegenDelay = 3600; // delay regen
                this.shootCooldown = cooldownFrames * 1.0;
                if (playAudioCallback) playAudioCallback('spell');

                projectiles.push(new Projectile({
                    x: this.x,
                    y: this.y,
                    startX: this.x,
                    startY: this.y,
                    vx: Math.cos(this.aimAngle) * speed,
                    vy: Math.sin(this.aimAngle) * speed,
                    damage: this.getDamage() * 1.4, // balanced normal lightning damage
                    range: this.range * 1.0,
                    type: 'lightning',
                    owner: 'player'
                }));
            }
        }
        return true;
    }

    dropLoot(x, y, room) {
        // Bones break loot chance
        const r = Math.random();
        if (r < 0.2) {
            room.drops.push(new Drop(x, y, 'coin'));
        } else if (r < 0.3) {
            room.drops.push(new Drop(x, y, 'mana'));
        } else if (r < 0.37) {
            room.drops.push(new Drop(x, y, 'heart'));
        }
    }

    draw(ctx) {
        ctx.save();

        // Invuln frames blink effect
        if (this.invulnFrames > 0 && Math.floor(this.invulnFrames / 4) % 2 === 0) {
            ctx.restore();
            return;
        }

        // Draw active sword slash arc
        if (this.swordSlash) {
            ctx.save();
            ctx.strokeStyle = 'rgba(245, 245, 250, 0.7)';
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#a855f7';
            ctx.lineWidth = 5;
            ctx.beginPath();
            
            // Draw sweeping line
            const sweep = Math.PI * 0.65;
            const progressRatio = this.swordSlash.progress / this.swordSlash.max;
            const startAngle = this.swordSlash.angle - sweep / 2 + (sweep * progressRatio);
            
            ctx.arc(this.x, this.y, 80, startAngle, startAngle + 0.1);
            ctx.stroke();
            ctx.restore();
        }

        // Draw shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.arc(this.x, this.y + 17, 15, 0, Math.PI * 2);
        ctx.fill();

        // Save context and scale for the character body drawing
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(1.22, 1.22);

        // Store original x/y and set to 0 for drawing relative coordinates
        const origX = this.x;
        const origY = this.y;
        this.x = 0;
        this.y = 0;

        // Draw Special Spell Aura if charged
        if (this.specialSpellCharged && this.currentWeapon === 'magic') {
            ctx.save();
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 1.8;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#06b6d4';
            
            // Rotating circle
            const rot = (Date.now() * 0.004) % (Math.PI * 2);
            ctx.rotate(rot);
            
            // Draw a neat electric magic circle pattern
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
            ctx.stroke();
            
            // Swirling sparks / spikes
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const spAngle = (Math.PI / 2) * i;
                ctx.moveTo(Math.cos(spAngle) * (this.radius + 1), Math.sin(spAngle) * (this.radius + 1));
                ctx.lineTo(Math.cos(spAngle) * (this.radius + 10), Math.sin(spAngle) * (this.radius + 10));
            }
            ctx.stroke();
            ctx.restore();
        }

        // Draw Player body
        // Custom procedurally styled human character in black-metal 18th century cuirassier armour
        const wobble = 0; // Glide without body bobbing for realistic movement
        
        // Determine looking direction
        let dir = 'down';
        const angle = this.aimAngle;
        if (angle >= -Math.PI / 4 && angle < Math.PI / 4) {
            dir = 'right';
        } else if (angle >= Math.PI / 4 && angle < 3 * Math.PI / 4) {
            dir = 'down';
        } else if (angle >= -3 * Math.PI / 4 && angle < -Math.PI / 4) {
            dir = 'up';
        } else {
            dir = 'left';
        }

        // Draw Legs (White breeches, tall black boots) swinging in movement direction
        const swing = this.moving ? Math.sin(this.walkCycle) * 3.5 : 0;
        const swingX = swing * this.moveDx;
        const swingY = swing * this.moveDy;

        ctx.fillStyle = '#f8fafc'; // White breeches
        ctx.fillRect(this.x - 7 + swingX, this.y + 13, 5, 6 + swingY);
        ctx.fillRect(this.x + 2 - swingX, this.y + 13, 5, 6 - swingY);
        // Black Boots
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(this.x - 8 + swingX, this.y + 18 + swingY, 6, 4);
        ctx.fillRect(this.x + 2 - swingX, this.y + 18 - swingY, 6, 4);

        // Draw Torso (Black frock coat under cuirass)
        ctx.fillStyle = '#090d16'; // Deep black frock coat
        ctx.beginPath();
        ctx.roundRect(this.x - 10, this.y + 2, 20, 13, 3);
        ctx.fill();
        // Red lapels / collar
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(this.x - 9, this.y + 2, 2, 10);
        ctx.fillRect(this.x + 7, this.y + 2, 2, 10);

        // Steel Breastplate (Cuirass in polished black steel)
        const pGrad = ctx.createLinearGradient(this.x - 8, this.y + 2, this.x + 8, this.y + 2);
        pGrad.addColorStop(0, '#1e293b');  // dark slate steel
        pGrad.addColorStop(0.5, '#475569'); // polished highlights
        pGrad.addColorStop(1, '#0f172a');  // dark back edge
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.roundRect(this.x - 8, this.y + 1, 16, 12, 4);
        ctx.fill();
        ctx.strokeStyle = '#eab308'; // Gold trim
        ctx.lineWidth = 1;
        ctx.stroke();

        // Gold rivets on breastplate
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(this.x - 6, this.y + 3, 0.8, 0, Math.PI*2);
        ctx.arc(this.x + 6, this.y + 3, 0.8, 0, Math.PI*2);
        ctx.arc(this.x - 6, this.y + 9, 0.8, 0, Math.PI*2);
        ctx.arc(this.x + 6, this.y + 9, 0.8, 0, Math.PI*2);
        ctx.fill();

        // Head (Skin tone)
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 6, 7.5, 0, Math.PI * 2);
        ctx.fill();

        if (dir !== 'up') {
            // Visor eyes (Blue)
            ctx.fillStyle = '#0284c7';
            ctx.beginPath();
            if (dir === 'down') {
                ctx.arc(this.x - 3, this.y - 6, 1.5, 0, Math.PI * 2);
                ctx.arc(this.x + 3, this.y - 6, 1.5, 0, Math.PI * 2);
            } else if (dir === 'left') {
                ctx.arc(this.x - 6, this.y - 6, 1.5, 0, Math.PI * 2);
            } else if (dir === 'right') {
                ctx.arc(this.x + 6, this.y - 6, 1.5, 0, Math.PI * 2);
            }
            ctx.fill();
        }

        // Helmet (Cuirassier helmet in polished black metal)
        const hGrad = ctx.createLinearGradient(this.x - 8, this.y - 15, this.x + 8, this.y - 15);
        hGrad.addColorStop(0, '#1e293b');
        hGrad.addColorStop(0.5, '#475569');
        hGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = hGrad;
        ctx.strokeStyle = '#eab308'; // Gold trim
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 7, 7.5, -Math.PI, 0);
        ctx.lineTo(this.x + 7.5, this.y - 4);
        ctx.lineTo(this.x - 7.5, this.y - 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Gold helmet crest ridge
        ctx.fillStyle = '#eab308';
        ctx.fillRect(this.x - 1.5, this.y - 18, 3, 11);

        // Majestic Crimson plume waving from top of helmet
        const plumeWarp = Math.sin(Date.now() * 0.01) * 3;
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 18);
        if (dir === 'left') {
            ctx.bezierCurveTo(this.x + 8 + plumeWarp, this.y - 24, this.x + 6 + plumeWarp, this.y - 10, this.x + 2, this.y - 12);
        } else if (dir === 'right') {
            ctx.bezierCurveTo(this.x - 8 + plumeWarp, this.y - 24, this.x - 6 + plumeWarp, this.y - 10, this.x - 2, this.y - 12);
        } else {
            ctx.bezierCurveTo(this.x - 8 + plumeWarp, this.y - 26, this.x - 4 + plumeWarp, this.y - 14, this.x - 1, this.y - 13);
        }
        ctx.fill();

        // --- DYNAMIC ARMS & HAND-HELD WEAPON SYSTEMS ---
        const isAimingLeft = Math.cos(this.aimAngle) < 0;
        
        // Active Hand and Shoulder calculation
        const shoulderX = this.x + (isAimingLeft ? -8 : 8);
        const shoulderY = this.y + 4;
        
        let handX, handY;
        if (this.currentWeapon === 'sword' && this.swordSlash) {
            const sweep = Math.PI * 0.75;
            const progressRatio = this.swordSlash.progress / this.swordSlash.max;
            const currentAngle = this.swordSlash.angle - sweep / 2 + (sweep * progressRatio);
            // Fully extend arm during slash sweep (36px outwards)
            handX = this.x + Math.cos(currentAngle) * 36;
            handY = this.y + Math.sin(currentAngle) * 36;
        } else {
            // Extend arms further outwards (28-30px) so the fists clearly clear the shoulders!
            const bob = Math.sin(Date.now() * 0.005) * 1.2;
            const dist = this.currentWeapon === 'bow' ? 28 : 30;
            handX = this.x + Math.cos(this.aimAngle) * dist + Math.sin(this.aimAngle + Math.PI/2) * bob;
            handY = this.y + Math.sin(this.aimAngle) * dist - Math.cos(this.aimAngle + Math.PI/2) * bob;
        }

        // Calculate resting arm/hand details based on weapon type
        const restingShoulderX = this.x + (isAimingLeft ? 8 : -8);
        const restingShoulderY = this.y + 4;
        
        let restingHandX, restingHandY;
        let drawShield = false;
        let drawMagicCharge = false;

        const maxCooldown = 60 / this.attackSpeed;
        const cooldownRatio = this.shootCooldown > 0 ? (this.shootCooldown / maxCooldown) : 0;

        if (this.currentWeapon === 'bow') {
            // Resting hand draws the string nock back!
            const pullDist = cooldownRatio * 9;
            restingHandX = handX - Math.cos(this.aimAngle) * pullDist;
            restingHandY = handY - Math.sin(this.aimAngle) * pullDist;
        } else if (this.currentWeapon === 'magic') {
            // Resting hand is raised channeling energy
            restingHandX = restingShoulderX + (isAimingLeft ? 5 : -5);
            restingHandY = this.y - 4;
            drawMagicCharge = true;
        } else {
            // Sword: holding a round buckler shield in the off hand
            restingHandX = restingShoulderX + (isAimingLeft ? 4 : -4);
            restingHandY = this.y + 11;
            drawShield = true;
        }

        // 1. Draw Resting Arm
        ctx.strokeStyle = '#090d16'; // black sleeve
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(restingShoulderX, restingShoulderY);
        ctx.lineTo(restingHandX, restingHandY);
        ctx.stroke();

        ctx.fillStyle = '#475569'; // steel pauldron
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(restingShoulderX, restingShoulderY, 3.5, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();

        // If not bow, draw resting hand fist/accessories under shield/orb
        if (this.currentWeapon !== 'bow') {
            ctx.fillStyle = '#fed7aa'; // skin fist
            ctx.strokeStyle = '#090d16';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(restingHandX, restingHandY, 2.8, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();

            if (drawShield) {
                // Steel buckler shield
                ctx.save();
                ctx.fillStyle = '#334155';
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(restingHandX, restingHandY, 7.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Shield boss center
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(restingHandX, restingHandY, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            if (drawMagicCharge) {
                // Glowing magical energy orb near the channeling hand
                const mPulse = Math.sin(Date.now() * 0.02) * 2;
                ctx.save();
                ctx.shadowBlur = 8 + mPulse * 2;
                ctx.shadowColor = '#a855f7';
                ctx.fillStyle = 'rgba(232, 121, 249, 0.85)';
                ctx.beginPath();
                ctx.arc(restingHandX, restingHandY - 2, 3.5 + mPulse * 0.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // 2. Draw Active Arm (Extending to hold the weapon)
        ctx.strokeStyle = '#090d16'; // black sleeve
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(handX, handY);
        ctx.stroke();

        ctx.fillStyle = '#475569'; // steel pauldron
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(shoulderX, shoulderY, 3.5, 0, Math.PI*2);
        ctx.fill();
        ctx.stroke();

        // 3. Draw active weapon in hand
        ctx.save();
        
        if (this.currentWeapon === 'sword') {
            let swordAngle;
            if (this.swordSlash) {
                const sweep = Math.PI * 0.75;
                const progressRatio = this.swordSlash.progress / this.swordSlash.max;
                swordAngle = this.swordSlash.angle - sweep / 2 + (sweep * progressRatio);
            } else {
                swordAngle = this.aimAngle;
            }

            ctx.translate(handX, handY);
            ctx.rotate(swordAngle + Math.PI / 2);
            
            // Draw Vector Sword
            // Hand at (0,0) is at the POMMEL. Handle goes forward so pommel doesn't clip shoulder.
            ctx.save();
            
            // Pommel (centered at 0, 0)
            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Handle (goes forward from 0 to -8)
            ctx.fillStyle = '#78350f';
            ctx.fillRect(-2, -8, 4, 8);
            
            // Guard (at -9)
            ctx.fillStyle = '#eab308';
            ctx.fillRect(-8, -10.5, 16, 2.5);
            
            // Glow overlay for sword swings
            if (this.swordSlash) {
                ctx.shadowBlur = 18;
                ctx.shadowColor = '#c084fc';
                ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
                ctx.lineWidth = 7;
                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.lineTo(0, -38);
                ctx.stroke();
            }
            
            // Blade (goes forward from -10 to -38)
            ctx.fillStyle = '#f1f5f9';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-3, -10.5);
            ctx.lineTo(3, -10.5);
            ctx.lineTo(2, -34);
            ctx.lineTo(0, -38);
            ctx.lineTo(-2, -34);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            
        } else if (this.currentWeapon === 'bow') {
            const pullDist = cooldownRatio * 9;
            
            // Tiny recoil pushback after release
            const recoilX = (this.shootCooldown > 0 && this.shootCooldown < 10) ? Math.sin((this.shootCooldown / 10) * Math.PI) * 4 : 0;

            ctx.translate(handX - Math.cos(this.aimAngle) * recoilX, handY - Math.sin(this.aimAngle) * recoilX);
            ctx.rotate(this.aimAngle + Math.PI / 2);
            
            // Draw Bow limbs with bezier curves so they look bent under tension!
            ctx.save();
            ctx.strokeStyle = '#b45309'; // wood color
            ctx.lineWidth = 3.5;
            ctx.lineCap = 'round';
            
            // Bend variables based on string pull
            const flexX = Math.sin(-cooldownRatio * 0.15) * 8;
            const flexY = cooldownRatio * 2;

            const tipUpperX = flexX;
            const tipUpperY = -14 + flexY;
            const tipLowerX = flexX;
            const tipLowerY = 14 - flexY;

            // Draw upper bent arm
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-6 - cooldownRatio * 2, -6, -6 - cooldownRatio * 2, -10, tipUpperX, tipUpperY);
            ctx.stroke();

            // Draw lower bent arm
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-6 - cooldownRatio * 2, 6, -6 - cooldownRatio * 2, 10, tipLowerX, tipLowerY);
            ctx.stroke();

            // Draw golden grip bindings
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(-2, -2, 4, 4);

            // Draw string
            ctx.strokeStyle = 'rgba(241, 245, 249, 0.9)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tipUpperX, tipUpperY);
            ctx.lineTo(-pullDist, 0); // string pulled back
            ctx.lineTo(tipLowerX, tipLowerY);
            ctx.stroke();
            
            // Draw nocked arrow if cooldown/charge is active
            if (this.shootCooldown > 0) {
                // Arrow shaft
                ctx.strokeStyle = '#78350f';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(-pullDist, 0);
                ctx.lineTo(-pullDist + 18, 0);
                ctx.stroke();
                
                // Slate arrow head
                ctx.fillStyle = '#94a3b8';
                ctx.beginPath();
                ctx.moveTo(-pullDist + 18, 0);
                ctx.lineTo(-pullDist + 14, -2.5);
                ctx.lineTo(-pullDist + 14, 2.5);
                ctx.closePath();
                ctx.fill();

                // Fletchings
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(-pullDist - 1.5, -2, 2.5, 4);
            }
            ctx.restore();
            
        } else if (this.currentWeapon === 'magic') {
            // Apply slight cast tilt forward during cooldown
            const castTilt = cooldownRatio > 0 ? Math.sin(cooldownRatio * Math.PI) * 0.4 : 0;
            ctx.translate(handX, handY);
            ctx.rotate(this.aimAngle + Math.PI / 2 - castTilt);
            
            // Draw Magic Staff
            // Staff shaft shifted forward (goes from -18 to +4) so bottom doesn't hit shoulder
            ctx.save();
            ctx.fillStyle = '#5c2d91'; // purple wood
            ctx.fillRect(-2.2, -18, 4.4, 22);
            
            // Golden wings holding crystal
            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.arc(0, -21, 5, 0, Math.PI, true);
            ctx.fill();
            ctx.fillRect(-4, -24, 8, 3.5);
            
            const pulse = Math.sin(Date.now() * 0.015) * 1.5;
            const crystalRadius = 4.2 + (cooldownRatio > 0 ? 1.5 : pulse * 0.4);
            
            // Draw expanding mana shockwaves if cast cooldown active
            if (cooldownRatio > 0) {
                ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(0, -24, 8 + (1 - cooldownRatio) * 14, 0, Math.PI * 2);
                ctx.stroke();
            }

            ctx.shadowBlur = (cooldownRatio > 0 ? 20 : 12) + pulse * 2;
            ctx.shadowColor = '#06b6d4';
            ctx.fillStyle = '#22d3ee'; // bright cyan crystal core
            ctx.beginPath();
            ctx.arc(0, -24, crystalRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
        ctx.restore();

        // 4. DRAW FISTS ON TOP OF WEAPON HANDLES (makes it look like they are gripping them in fists!)
        // Active Hand Fist
        ctx.fillStyle = '#fed7aa'; // active skin fist
        ctx.strokeStyle = '#090d16'; // dark outline for definition
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(handX, handY, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // If bow, draw resting hand fist on top of string/arrow nock
        if (this.currentWeapon === 'bow') {
            ctx.fillStyle = '#fed7aa';
            ctx.strokeStyle = '#090d16';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.arc(restingHandX, restingHandY, 3.0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        this.x = origX;
        this.y = origY;
        ctx.restore();
    }
}

export class Projectile {
    constructor(options) {
        this.x = options.x;
        this.y = options.y;
        this.vx = options.vx;
        this.vy = options.vy;
        this.damage = options.damage;
        this.radius = options.type === 'magic' ? 12 : 
                      (options.type === 'lightning' ? 10 : 
                      (options.type === 'arrow' ? 4 : 
                      (options.type === 'webball' ? 10 : 
                      (options.type === 'homing_orb' ? 8 : 
                      (options.type === 'fireball' ? 7 : 
                      (options.type === 'wood_shard' ? 4 : 
                      (options.type === 'bone_shard' ? 4 : 
                      (options.type === 'shadow_bolt' ? 6 : 6))))))));
        this.type = options.type; // 'arrow', 'magic', 'lightning', etc.
        this.owner = options.owner; // 'player', 'enemy'
        this.range = options.range;
        this.distanceTraveled = 0;
        this.angle = Math.atan2(this.vy, this.vx);
        
        // Track start position for drawing lightning arcs
        this.startX = options.startX !== undefined ? options.startX : this.x;
        this.startY = options.startY !== undefined ? options.startY : this.y;
    }

    update(obstacles, currentRoom) {
        // Homing behavior
        if (this.type === 'homing_orb') {
            const player = currentRoom ? currentRoom.playerRef : null;
            if (player) {
                const pdx = player.x - this.x;
                const pdy = player.y - this.y;
                const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
                if (pdist > 0) {
                    const targetVx = (pdx / pdist) * 4.5;
                    const targetVy = (pdy / pdist) * 4.5;
                    this.vx = this.vx * 0.94 + targetVx * 0.06;
                    this.vy = this.vy * 0.94 + targetVy * 0.06;
                    this.angle = Math.atan2(this.vy, this.vx);
                }
            }
        }

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.x += this.vx;
        this.y += this.vy;
        this.distanceTraveled += speed;

        // Check if out of range or hits walls
        if (this.distanceTraveled >= this.range || 
            this.x < 64 || this.x > 736 || this.y < 64 || this.y > 536) {
            
            if (this.type === 'magic' || this.type === 'lightning') {
                this.explode(currentRoom);
            }
            if (this.type === 'webball' && currentRoom) {
                currentRoom.obstacles.push({
                    x: this.x,
                    y: this.y,
                    type: 'web',
                    width: 40,
                    height: 40,
                    health: 1,
                    extinguished: false
                });
            }
            return false;
        }

        // Check Solid Obstacles (Stones, Bones)
        for (const obs of obstacles) {
            if (obs.type === 'stone' || (obs.type === 'bone' && obs.health > 0)) {
                // Projectile AABB overlap
                const left = obs.x - obs.width / 2;
                const right = obs.x + obs.width / 2;
                const top = obs.y - obs.height / 2;
                const bottom = obs.y + obs.height / 2;

                if (this.x >= left && this.x <= right && this.y >= top && this.y <= bottom) {
                    if (obs.type === 'bone') {
                        obs.health -= 1;
                        if (obs.health <= 0) {
                            spawnSparkles(obs.x, obs.y, '#f8fafc', 8);
                            // Drop loot
                            const r = Math.random();
                            if (r < 0.2) currentRoom.drops.push(new Drop(obs.x, obs.y, 'coin'));
                            else if (r < 0.3) currentRoom.drops.push(new Drop(obs.x, obs.y, 'mana'));
                            else if (r < 0.37) currentRoom.drops.push(new Drop(obs.x, obs.y, 'heart'));
                        }
                    }

                    if (this.type === 'magic' || this.type === 'lightning') {
                        this.explode(currentRoom);
                    } else if (this.type === 'webball' && currentRoom) {
                        currentRoom.obstacles.push({
                            x: this.x,
                            y: this.y,
                            type: 'web',
                            width: 40,
                            height: 40,
                            health: 1,
                            extinguished: false
                        });
                    } else {
                        spawnSparkles(this.x, this.y, '#cbd5e1', 3);
                    }
                    return false;
                }
            }
            // Campfires extinguishable
            if (obs.type === 'campfire' && !obs.extinguished) {
                const dist = Math.sqrt((this.x - obs.x)**2 + (this.y - obs.y)**2);
                if (dist < this.radius + 15) {
                    obs.extinguished = true;
                    spawnSmoke(obs.x, obs.y, 4);
                    if (this.type === 'magic' || this.type === 'lightning') {
                        this.explode(currentRoom);
                    }
                    return false;
                }
            }
        }

        // Check collision with player if owner is enemy
        if (this.owner === 'enemy') {
            const player = currentRoom ? currentRoom.playerRef : null;
            if (player) {
                const dx = this.x - player.x;
                const dy = this.y - player.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < this.radius + player.radius) {
                    player.takeDamage(this.damage);
                    if (this.type === 'magic') {
                        this.explode(currentRoom);
                    } else if (this.type === 'webball' && currentRoom) {
                        currentRoom.obstacles.push({
                            x: this.x,
                            y: this.y,
                            type: 'web',
                            width: 40,
                            height: 40,
                            health: 1,
                            extinguished: false
                        });
                    } else {
                        spawnSparkles(this.x, this.y, '#ef4444', 4);
                    }
                    return false; // destroy projectile
                }
            }
        }

        return true;
    }

    explode(currentRoom) {
        if (this.type === 'lightning') {
            spawnLightningExplosion(this.x, this.y, 65);
        } else {
            spawnExplosion(this.x, this.y, 60);
        }
        const radius = 70;
        
        if (!currentRoom) return;
        
        // Splash damage to enemies
        if (this.owner === 'player') {
            if (currentRoom.mobs) {
                for (const mob of currentRoom.mobs) {
                    const dx = mob.x - this.x;
                    const dy = mob.y - this.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < radius + mob.radius) {
                        // Deal falloff damage
                        const multiplier = 1 - (dist / (radius + mob.radius));
                        const dmg = this.damage * (0.4 + multiplier * 0.6);
                        const kx = dist > 0 ? (dx / dist) * 4 : 0;
                        const ky = dist > 0 ? (dy / dist) * 4 : 0;
                        mob.takeDamage(dmg, kx, ky);
                    }
                }
            }
        } else {
            // Splash damage to player
            const p = currentRoom.playerRef; // pass down player ref
            if (p) {
                const dx = p.x - this.x;
                const dy = p.y - this.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < radius + p.radius) {
                    p.takeDamage(this.damage);
                }
            }
        }

    }

    draw(ctx) {
        ctx.save();
        if (this.type === 'arrow') {
            // Draw wooden vector arrow
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.strokeStyle = '#854d0e'; // Brown shaft
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(8, 0);
            ctx.stroke();

            // Arrow head
            ctx.fillStyle = '#94a3b8'; // Iron
            ctx.beginPath();
            ctx.moveTo(8, 0);
            ctx.lineTo(4, -3);
            ctx.lineTo(4, 3);
            ctx.closePath();
            ctx.fill();

            // Arrow fletching
            ctx.fillStyle = '#f8fafc'; // White feathers
            ctx.fillRect(-8, -2, 3, 1);
            ctx.fillRect(-8, 1, 3, 1);

        } else if (this.type === 'magic') {
            // Cosmic glowing energy orb
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#06b6d4';
            ctx.fillStyle = '#e0f2fe';
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();

            // Core sparkle details
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(this.x - 3, this.y - 3, 3, 0, Math.PI*2);
            ctx.fill();

        } else if (this.type === 'lightning') {
            ctx.save();
            const x1 = this.startX;
            const y1 = this.startY;
            const x2 = this.x;
            const y2 = this.y;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 5) {
                ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#06b6d4';
                
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                
                const steps = Math.max(2, Math.floor(dist / 22));
                const points = [];
                points.push({ x: x1, y: y1 });
                
                for (let i = 1; i < steps; i++) {
                    const t = i / steps;
                    let px = x1 + dx * t;
                    let py = y1 + dy * t;
                    
                    const nx = -dy / dist;
                    const ny = dx / dist;
                    const offset = (Math.random() - 0.5) * 14;
                    
                    px += nx * offset;
                    py += ny * offset;
                    
                    points.push({ x: px, y: py });
                    ctx.lineTo(px, py);
                }
                points.push({ x: x2, y: y2 });
                ctx.lineTo(x2, y2);
                ctx.stroke();
                
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.stroke();
            }
            
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#22d3ee';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

        } else if (this.type === 'bullet') {
            // Red fireballs fired by mobs
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ef4444';
            ctx.fillStyle = '#fca5a5';
            ctx.strokeStyle = '#b91c1c';
            ctx.lineWidth = 1.5;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        } else if (this.type === 'webball') {
             // Draw a sticky white web ball
             ctx.shadowBlur = 8;
             ctx.shadowColor = '#f1f5f9';
             ctx.fillStyle = '#f1f5f9';
             ctx.strokeStyle = '#cbd5e1';
             ctx.lineWidth = 1.5;
             ctx.beginPath();
             ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
             ctx.fill();
             ctx.stroke();
             // Draw cross details inside
             ctx.strokeStyle = '#94a3b8';
             ctx.lineWidth = 1;
             ctx.beginPath();
             ctx.moveTo(this.x - 4, this.y);
             ctx.lineTo(this.x + 4, this.y);
             ctx.moveTo(this.x, this.y - 4);
             ctx.lineTo(this.x, this.y + 4);
             ctx.stroke();
        } else if (this.type === 'homing_orb') {
             // Draw a glowing purple homing orb
             ctx.shadowBlur = 12;
             ctx.shadowColor = '#d8b4fe';
             ctx.fillStyle = '#f5f3ff';
             ctx.strokeStyle = '#a855f7';
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
             ctx.fill();
             ctx.stroke();
             // Outer ring
             ctx.strokeStyle = '#d8b4fe';
             ctx.lineWidth = 1;
             ctx.beginPath();
             ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI*2);
             ctx.stroke();
        } else if (this.type === 'wood_shard') {
             // Wooden splinter pointy shape
             ctx.translate(this.x, this.y);
             ctx.rotate(this.angle);
             ctx.fillStyle = '#854d0e';
             ctx.strokeStyle = '#451a03';
             ctx.lineWidth = 1;
             ctx.beginPath();
             ctx.moveTo(-8, 0);
             ctx.lineTo(-4, -3);
             ctx.lineTo(8, 0);
             ctx.lineTo(-4, 3);
             ctx.closePath();
             ctx.fill();
             ctx.stroke();
        } else if (this.type === 'bone_shard') {
             // Bone-white jagged splinter
             ctx.translate(this.x, this.y);
             ctx.rotate(this.angle);
             ctx.fillStyle = '#f1f5f9';
             ctx.strokeStyle = '#94a3b8';
             ctx.lineWidth = 1;
             ctx.beginPath();
             ctx.moveTo(-6, -2);
             ctx.lineTo(6, 0);
             ctx.lineTo(-6, 2);
             ctx.lineTo(-2, 0);
             ctx.closePath();
             ctx.fill();
             ctx.stroke();
        } else if (this.type === 'fireball') {
             // Flaming comet/fireball projectile
             ctx.shadowBlur = 12;
             ctx.shadowColor = '#ef4444';
             ctx.fillStyle = '#f97316';
             ctx.strokeStyle = '#b91c1c';
             ctx.lineWidth = 1.5;
             ctx.beginPath();
             ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
             ctx.fill();
             ctx.stroke();

             // Flame tail pointing backwards
             ctx.save();
             ctx.translate(this.x, this.y);
             ctx.rotate(this.angle + Math.PI); // rotate opposite to velocity
             const grad = ctx.createLinearGradient(0, 0, 14, 0);
             grad.addColorStop(0, '#f97316');
             grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
             ctx.fillStyle = grad;
             ctx.beginPath();
             ctx.moveTo(0, -this.radius * 0.7);
             ctx.quadraticCurveTo(8, -this.radius * 0.4, 14, 0);
             ctx.quadraticCurveTo(8, this.radius * 0.4, 0, this.radius * 0.7);
             ctx.closePath();
             ctx.fill();
             ctx.restore();

             // Inner core highlight
             ctx.fillStyle = '#fef08a';
             ctx.beginPath();
             ctx.arc(this.x - this.vx * 0.5, this.y - this.vy * 0.5, this.radius * 0.5, 0, Math.PI*2);
             ctx.fill();
        } else if (this.type === 'shadow_bolt') {
             // Dark energy shadow bolt
             ctx.shadowBlur = 12;
             ctx.shadowColor = '#a855f7';
             ctx.fillStyle = '#1e1b4b';
             ctx.strokeStyle = '#c084fc';
             ctx.lineWidth = 1.5;
             ctx.beginPath();
             ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
             ctx.fill();
             ctx.stroke();

             // Purple wispy tail pointing backwards
             ctx.save();
             ctx.translate(this.x, this.y);
             ctx.rotate(this.angle + Math.PI);
             const grad = ctx.createLinearGradient(0, 0, 12, 0);
             grad.addColorStop(0, '#c084fc');
             grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
             ctx.fillStyle = grad;
             ctx.beginPath();
             ctx.moveTo(0, -this.radius * 0.6);
             ctx.quadraticCurveTo(6, -this.radius * 0.3, 12, 0);
             ctx.quadraticCurveTo(6, this.radius * 0.3, 0, this.radius * 0.6);
             ctx.closePath();
             ctx.fill();
             ctx.restore();

             // Core highlight
             ctx.fillStyle = '#faf5ff';
             ctx.beginPath();
             ctx.arc(this.x - this.vx * 0.3, this.y - this.vy * 0.3, this.radius * 0.4, 0, Math.PI*2);
             ctx.fill();
        }
        ctx.restore();
    }
}

export class Enemy {
    constructor(x, y, type, levelMultiplier = 1) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        // Base stats mapping for the 15 level-specific mobs + original mobs
        if (type === 'chaser') {
            this.radius = 16;
            this.maxHealth = 8 * levelMultiplier;
            this.speed = 1.6 + Math.random() * 0.4;
            this.damage = 0.5;
            this.color = '#ef4444';
            this.icon = '💀';
        } else if (type === 'shooter') {
            this.radius = 15;
            this.maxHealth = 6 * levelMultiplier;
            this.speed = 1.0;
            this.damage = 0.5;
            this.shootCooldown = 60 + Math.random() * 60;
            this.color = '#a855f7';
            this.icon = '🦇';
        } else if (type === 'swarmer') {
            this.radius = 12;
            this.maxHealth = 4 * levelMultiplier;
            this.speed = 2.4;
            this.damage = 0.5;
            this.color = '#22c55e';
            this.icon = '🦠';
        } else if (type === 'mini_swarmer') {
            this.radius = 7;
            this.maxHealth = 2 * levelMultiplier;
            this.speed = 2.8;
            this.damage = 0.5;
            this.color = '#4ade80';
            this.icon = '🟢';
        }
        // LEVEL 1: FOREST
        else if (type === 'forest_swarmer') {
            this.radius = 14;
            this.maxHealth = 7 * levelMultiplier;
            this.speed = 1.8;
            this.damage = 0.5;
            this.color = '#22c55e';
            this.icon = '🦠';
        } else if (type === 'forest_mini_swarmer') {
            this.radius = 8;
            this.maxHealth = 3 * levelMultiplier;
            this.speed = 2.2;
            this.damage = 0.25;
            this.color = '#4ade80';
            this.icon = '🟢';
        } else if (type === 'forest_shooter') {
            this.radius = 15;
            this.maxHealth = 8 * levelMultiplier;
            this.speed = 1.1;
            this.damage = 0.5;
            this.shootCooldown = 60 + Math.random() * 50;
            this.color = '#16a34a';
            this.icon = '🌱';
        } else if (type === 'forest_sprout') {
            this.radius = 18;
            this.maxHealth = 15 * levelMultiplier;
            this.speed = 0.5;
            this.damage = 0.5;
            this.shootCooldown = 90 + Math.random() * 40;
            this.color = '#854d0e';
            this.icon = '🌹';
        }
        // LEVEL 2: SHADOW
        else if (type === 'shadow_swarmer') {
            this.radius = 14;
            this.maxHealth = 8 * levelMultiplier;
            this.speed = 1.4;
            this.damage = 0.5;
            this.color = '#6b21a8';
            this.icon = '👻';
        } else if (type === 'shadow_shooter') {
            this.radius = 15;
            this.maxHealth = 8 * levelMultiplier;
            this.speed = 1.2;
            this.damage = 0.5;
            this.shootCooldown = 70 + Math.random() * 50;
            this.color = '#3b0764';
            this.icon = '🦇';
        } else if (type === 'shadow_chaser') {
            this.radius = 16;
            this.maxHealth = 10 * levelMultiplier;
            this.speed = 1.5;
            this.damage = 0.5;
            this.color = '#a855f7';
            this.icon = '💀';
        }
        // LEVEL 3: DEATH
        else if (type === 'death_swarmer') {
            this.radius = 10;
            this.maxHealth = 6 * levelMultiplier;
            this.speed = 2.4;
            this.damage = 0.5;
            this.color = '#65a30d';
            this.icon = '🐀';
        } else if (type === 'death_shooter') {
            this.radius = 15;
            this.maxHealth = 10 * levelMultiplier;
            this.speed = 1.0;
            this.damage = 0.5;
            this.shootCooldown = 80 + Math.random() * 40;
            this.color = '#047857';
            this.icon = '🧙';
        } else if (type === 'death_chaser') {
            this.radius = 16;
            this.maxHealth = 15 * levelMultiplier;
            this.speed = 1.2;
            this.damage = 0.5;
            this.color = '#d6d3d1';
            this.icon = '💀';
        }
        // LEVEL 4: FIRE
        else if (type === 'fire_swarmer') {
            this.radius = 14;
            this.maxHealth = 9 * levelMultiplier;
            this.speed = 1.5;
            this.damage = 0.5;
            this.color = '#ea580c';
            this.icon = '🔥';
        } else if (type === 'fire_mini_swarmer') {
            this.radius = 8;
            this.maxHealth = 4 * levelMultiplier;
            this.speed = 1.9;
            this.damage = 0.25;
            this.color = '#f97316';
            this.icon = '🔸';
        } else if (type === 'fire_shooter') {
            this.radius = 13;
            this.maxHealth = 9 * levelMultiplier;
            this.speed = 1.3;
            this.damage = 0.5;
            this.shootCooldown = 65 + Math.random() * 45;
            this.color = '#ef4444';
            this.icon = '😈';
        } else if (type === 'fire_chaser') {
            this.radius = 16;
            this.maxHealth = 13 * levelMultiplier;
            this.speed = 1.4;
            this.damage = 0.5;
            this.color = '#b91c1c';
            this.icon = '🐺';
        }
        // LEVEL 5: VOID
        else if (type === 'void_swarmer') {
            this.radius = 14;
            this.maxHealth = 12 * levelMultiplier;
            this.speed = 1.7;
            this.damage = 0.5;
            this.color = '#c084fc';
            this.icon = '✨';
        } else if (type === 'void_shooter') {
            this.radius = 15;
            this.maxHealth = 13 * levelMultiplier;
            this.speed = 1.2;
            this.damage = 0.5;
            this.shootCooldown = 75 + Math.random() * 50;
            this.color = '#581c87';
            this.icon = '👁️';
        } else if (type === 'void_chaser') {
            this.radius = 17;
            this.maxHealth = 18 * levelMultiplier;
            this.speed = 1.0;
            this.damage = 0.5;
            this.color = '#312e81';
            this.icon = '🌀';
        }

        this.health = this.maxHealth;
        this.vx = 0;
        this.vy = 0;
        this.knockbackX = 0;
        this.knockbackY = 0;

        // Custom AI state variables
        this.aiTimer = 0;
        this.aiState = 0; 
        this.chargeTimer = 0;
        this.chargeVx = 0;
        this.chargeVy = 0;
        this.teleportCooldown = 0;
        this.stealthActive = false;
        this.shieldActive = false;
    }

    takeDamage(amount, kx = 0, ky = 0) {
        // Skeleton Warrior front block check
        if (this.type === 'death_chaser' && Math.random() < 0.35) {
            spawnFloatingText(this.x, this.y - 12, "BLOCKED!", '#94a3b8', 12);
            audio.play('deflect');
            return;
        }

        this.health -= amount;
        this.knockbackX = kx;
        this.knockbackY = ky;
        
        // Blood particles
        spawnBlood(this.x, this.y, 6);
        spawnFloatingText(this.x, this.y - 12, `${amount.toFixed(1)}`, '#f1f5f9', 11);
        
        if (this.health <= 0) {
            spawnBlood(this.x, this.y, 16);
            spawnSparkles(this.x, this.y, this.color, 8);
        }
    }

    update(player, obstacles, projectiles, currentRoom) {
        // Apply Knockback decay
        this.x += this.knockbackX;
        this.y += this.knockbackY;
        this.knockbackX *= 0.85;
        this.knockbackY *= 0.85;

        // Pathing vector
        let dx = player.x - this.x;
        let dy = player.y - this.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist === 0) {
            dx = 1;
            dy = 0;
            dist = 0.001;
        }

        // Web slowing checks
        let speedMultiplier = 1;
        for (const obs of obstacles) {
            if (obs.type === 'web' && !obs.extinguished) {
                const odx = this.x - obs.x;
                const ody = this.y - obs.y;
                const odist = Math.sqrt(odx*odx + ody*ody);
                if (odist < this.radius + obs.width / 2) {
                    speedMultiplier = 0.5;
                    break;
                }
            }
        }

        if (this.slowTimer > 0) {
            this.slowTimer--;
            speedMultiplier *= 0.75;
        }

        const currentSpeed = this.speed * speedMultiplier;

        // -------------------------------------------------------------
        // Level 1: Forest AI logic
        // -------------------------------------------------------------
        if (this.type === 'forest_swarmer' || this.type === 'forest_mini_swarmer') {
            if (dist > 5) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        } 
        else if (this.type === 'forest_shooter') {
            const idealDist = 220;
            if (dist > idealDist + 20) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            } else if (dist < idealDist - 20) {
                this.x -= (dx / dist) * currentSpeed;
                this.y -= (dy / dist) * currentSpeed;
            } else {
                this.x += (-dy / dist) * currentSpeed * 0.7;
                this.y += (dx / dist) * currentSpeed * 0.7;
            }

            if (this.shootCooldown > 0) {
                this.shootCooldown--;
            } else {
                this.shootCooldown = 70 + Math.random() * 50;
                projectiles.push(new Projectile({
                    x: this.x,
                    y: this.y,
                    vx: (dx / dist) * 4.0,
                    vy: (dy / dist) * 4.0,
                    damage: this.damage,
                    range: 380,
                    type: 'wood_shard',
                    owner: 'enemy'
                }));
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        } 
        else if (this.type === 'forest_sprout') {
            if (dist > 120) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            }
            if (this.shootCooldown > 0) {
                this.shootCooldown--;
            } else {
                this.shootCooldown = 100 + Math.random() * 40;
                for (let i = 0; i < 5; i++) {
                    const angle = (Math.PI * 2 / 5) * i + Math.random() * 0.2;
                    projectiles.push(new Projectile({
                        x: this.x,
                        y: this.y,
                        vx: Math.cos(angle) * 3.0,
                        vy: Math.sin(angle) * 3.0,
                        damage: this.damage,
                        range: 250,
                        type: 'wood_shard',
                        owner: 'enemy'
                    }));
                }
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        }
        // -------------------------------------------------------------
        // Level 2: Shadow AI logic
        // -------------------------------------------------------------
        else if (this.type === 'shadow_swarmer') {
            this.aiTimer++;
            if (this.aiTimer >= 110) {
                this.aiTimer = 0;
                this.stealthActive = true;
                this.aiState = 35; 
            }
            
            let lurkSpeed = currentSpeed;
            if (this.stealthActive) {
                lurkSpeed = currentSpeed * 2.2;
                this.aiState--;
                if (this.aiState <= 0) {
                    this.stealthActive = false;
                }
            }

            if (dist > 5) {
                this.x += (dx / dist) * lurkSpeed;
                this.y += (dy / dist) * lurkSpeed;
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
                if (this.stealthActive) {
                    this.stealthActive = false;
                }
            }
        } 
        else if (this.type === 'shadow_shooter') {
            const idealDist = 240;
            if (dist > idealDist + 20) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            } else if (dist < idealDist - 20) {
                this.x -= (dx / dist) * currentSpeed;
                this.y -= (dy / dist) * currentSpeed;
            } else {
                this.x += (-dy / dist) * currentSpeed * 0.7;
                this.y += (dx / dist) * currentSpeed * 0.7;
            }

            if (this.shootCooldown > 0) {
                this.shootCooldown--;
            } else {
                this.shootCooldown = 85 + Math.random() * 40;
                projectiles.push(new Projectile({
                    x: this.x,
                    y: this.y,
                    vx: (dx / dist) * 3.2,
                    vy: (dy / dist) * 3.2,
                    damage: this.damage,
                    range: 420,
                    type: 'shadow_bolt',
                    owner: 'enemy'
                }));
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        } 
        else if (this.type === 'shadow_chaser') {
            this.aiTimer++;
            if (this.chargeTimer > 0) {
                this.x += this.chargeVx * currentSpeed * 2.5;
                this.y += this.chargeVy * currentSpeed * 2.5;
                this.chargeTimer--;
            } else {
                if (dist > 5) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                }
                if (dist < 140 && this.aiTimer > 95) {
                    this.aiTimer = 0;
                    this.chargeTimer = 25; 
                    this.chargeVx = dx / dist;
                    this.chargeVy = dy / dist;
                    spawnFloatingText(this.x, this.y - 15, "SCREECH!", '#c084fc', 12);
                    audio.play('boss_scream');
                }
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage * (this.chargeTimer > 0 ? 1.5 : 1.0));
            }
        }
        // -------------------------------------------------------------
        // Level 3: Death AI logic
        // -------------------------------------------------------------
        else if (this.type === 'death_swarmer') {
            if (dist > 5) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
                if (Math.random() < 0.2) { 
                    player.takeDamage(0.25);
                    spawnFloatingText(player.x, player.y - 18, "POISONED!", '#84cc16', 11);
                }
            }
        } 
        else if (this.type === 'death_shooter') {
            const idealDist = 210;
            if (dist > idealDist + 20) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            } else if (dist < idealDist - 20) {
                this.x -= (dx / dist) * currentSpeed;
                this.y -= (dy / dist) * currentSpeed;
            } else {
                this.x += (-dy / dist) * currentSpeed * 0.7;
                this.y += (dx / dist) * currentSpeed * 0.7;
            }

            if (this.shootCooldown > 0) {
                this.shootCooldown--;
            } else {
                this.shootCooldown = 95 + Math.random() * 45;
                const baseAngle = Math.atan2(dy, dx);
                for (let i = -1; i <= 1; i++) {
                    const angle = baseAngle + i * 0.25;
                    projectiles.push(new Projectile({
                        x: this.x,
                        y: this.y,
                        vx: Math.cos(angle) * 3.8,
                        vy: Math.sin(angle) * 3.8,
                        damage: this.damage,
                        range: 350,
                        type: 'bone_shard',
                        owner: 'enemy'
                    }));
                }
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        } 
        else if (this.type === 'death_chaser') {
            if (dist > 5) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        }
        // -------------------------------------------------------------
        // Level 4: Fire AI logic
        // -------------------------------------------------------------
        else if (this.type === 'fire_swarmer' || this.type === 'fire_mini_swarmer') {
            if (dist > 5) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }

            if (this.type === 'fire_swarmer' && Math.random() < 0.008) {
                obstacles.push({
                    x: this.x,
                    y: this.y,
                    type: 'fire_puddle',
                    width: 34,
                    height: 34,
                    timer: 160,
                    extinguished: false
                });
            }

            for (let i = obstacles.length - 1; i >= 0; i--) {
                const obs = obstacles[i];
                if (obs.type === 'fire_puddle') {
                    obs.timer--;
                    if (obs.timer <= 0) {
                        obstacles.splice(i, 1);
                    } else {
                        const pdx = player.x - obs.x;
                        const pdy = player.y - obs.y;
                        const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
                        if (pdist < 17 + player.radius) {
                            player.takeDamage(0.15); 
                            if (Math.random() < 0.05) {
                                spawnFloatingText(player.x, player.y - 15, "BURNING!", '#f97316', 11);
                            }
                        }
                    }
                }
            }
        } 
        else if (this.type === 'fire_shooter') {
            const idealDist = 220;
            if (dist > idealDist + 20) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            } else if (dist < idealDist - 20) {
                this.x -= (dx / dist) * currentSpeed;
                this.y -= (dy / dist) * currentSpeed;
            } else {
                this.x += (-dy / dist) * currentSpeed * 0.8;
                this.y += (dx / dist) * currentSpeed * 0.8;
            }

            if (this.shootCooldown > 0) {
                this.shootCooldown--;
            } else {
                this.shootCooldown = 75 + Math.random() * 40;
                projectiles.push(new Projectile({
                    x: this.x,
                    y: this.y,
                    vx: (dx / dist) * 4.2,
                    vy: (dy / dist) * 4.2,
                    damage: this.damage,
                    range: 380,
                    type: 'fireball',
                    owner: 'enemy'
                }));
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        } 
        else if (this.type === 'fire_chaser') {
            this.aiTimer++;
            if (this.chargeTimer > 0) {
                this.x += this.chargeVx * currentSpeed * 2.8;
                this.y += this.chargeVy * currentSpeed * 2.8;
                this.chargeTimer--;
            } else {
                if (this.aiState === 1) {
                    this.aiTimer--;
                    if (this.aiTimer <= 0) {
                        this.aiState = 0;
                        this.chargeTimer = 22;
                        this.chargeVx = dx / dist;
                        this.chargeVy = dy / dist;
                    }
                } else {
                    if (dist > 5) {
                        this.x += (dx / dist) * currentSpeed;
                        this.y += (dy / dist) * currentSpeed;
                    }
                    if (dist < 130 && this.aiTimer > 90) {
                        this.aiState = 1;
                        this.aiTimer = 15; 
                    }
                }
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage * (this.chargeTimer > 0 ? 1.5 : 1.0));
            }
        }
        // -------------------------------------------------------------
        // Level 5: Void AI logic
        // -------------------------------------------------------------
        else if (this.type === 'void_swarmer') {
            this.aiTimer++;
            if (this.aiTimer > 85) {
                this.aiTimer = 0;
                spawnSmoke(this.x, this.y, 6);
                const angle = Math.random() * Math.PI * 2;
                const radius = 60 + Math.random() * 60;
                this.x = player.x + Math.cos(angle) * radius;
                this.y = player.y + Math.sin(angle) * radius;
                spawnSmoke(this.x, this.y, 6);
                
                for (let d = 0; d < 4; d++) {
                    const bAngle = (Math.PI / 2) * d;
                    projectiles.push(new Projectile({
                        x: this.x,
                        y: this.y,
                        vx: Math.cos(bAngle) * 3.5,
                        vy: Math.sin(bAngle) * 3.5,
                        damage: this.damage,
                        range: 150,
                        type: 'bullet',
                        owner: 'enemy'
                    }));
                }
            }

            if (dist > 5) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        } 
        else if (this.type === 'void_shooter') {
            const idealDist = 200;
            if (dist > idealDist + 20) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            } else if (dist < idealDist - 20) {
                this.x -= (dx / dist) * currentSpeed;
                this.y -= (dy / dist) * currentSpeed;
            } else {
                this.x += (-dy / dist) * currentSpeed * 0.7;
                this.y += (dx / dist) * currentSpeed * 0.7;
            }

            if (this.shootCooldown > 0) {
                this.shootCooldown--;
            } else {
                this.shootCooldown = 110 + Math.random() * 50;
                projectiles.push(new Projectile({
                    x: this.x,
                    y: this.y,
                    vx: (dx / dist) * 2.8,
                    vy: (dy / dist) * 2.8,
                    damage: this.damage,
                    range: 400,
                    type: 'homing_orb',
                    owner: 'enemy'
                }));
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        } 
        else if (this.type === 'void_chaser') {
            if (dist > 5) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            }
            
            if (dist < 260 && dist > 10) {
                const pullForce = (260 - dist) * 0.0065;
                player.x -= (dx / dist) * pullForce;
                player.y -= (dy / dist) * pullForce;
                
                if (Math.random() < 0.1) {
                    spawnSparkles(player.x, player.y, '#c084fc', 1);
                }
            }

            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        }
        // -------------------------------------------------------------
        // Generic Fallbacks
        // -------------------------------------------------------------
        else if (this.type === 'chaser' || this.type === 'swarmer' || this.type === 'mini_swarmer') {
            if (dist > 5) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            }
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        } else if (this.type === 'shooter') {
            const idealDist = 200;
            if (dist > idealDist + 20) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            } else if (dist < idealDist - 20) {
                this.x -= (dx / dist) * currentSpeed;
                this.y -= (dy / dist) * currentSpeed;
            } else {
                this.x += (-dy / dist) * currentSpeed * 0.7;
                this.y += (dx / dist) * currentSpeed * 0.7;
            }

            if (this.shootCooldown > 0) {
                this.shootCooldown--;
            } else {
                this.shootCooldown = 90 + Math.random() * 60;
                const speed = 3.5;
                projectiles.push(new Projectile({
                    x: this.x,
                    y: this.y,
                    vx: (dx / dist) * speed,
                    vy: (dy / dist) * speed,
                    damage: this.damage,
                    range: 400,
                    type: 'bullet',
                    owner: 'enemy'
                }));
            }

            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }
        }

        // Bounding Room Collisions (Strict inside walls)
        const wallMinX = 64 + this.radius;
        const wallMaxX = 736 - this.radius;
        const wallMinY = 64 + this.radius;
        const wallMaxY = 536 - this.radius;

        this.x = Math.max(wallMinX, Math.min(wallMaxX, this.x));
        this.y = Math.max(wallMinY, Math.min(wallMaxY, this.y));

        // Obstacles Collisions (Stones & Bones)
        for (const obs of obstacles) {
            if (obs.type === 'stone' || (obs.type === 'bone' && obs.health > 0)) {
                resolveCircleRectCollision(this, obs);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        
        // Base shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.radius - 2, this.radius * 0.8, 0, Math.PI*2);
        ctx.fill();

        // Custom Vector drawings based on enemy type
        if (this.type === 'chaser') {
            // GOBLIN
            const wobble = Math.sin(Date.now() * 0.012) * 2;
            const legSwing = Math.sin(Date.now() * 0.015) * 4;

            // Legs (dark green stubby feet)
            ctx.fillStyle = '#14532d';
            ctx.fillRect(this.x - 6, this.y + 10, 4, 6 + legSwing);
            ctx.fillRect(this.x + 2, this.y + 10, 4, 6 - legSwing);

            // Brown tattered tunic
            ctx.fillStyle = '#78350f'; // Leather brown
            ctx.beginPath();
            ctx.moveTo(this.x - 10, this.y + 2);
            ctx.lineTo(this.x + 10, this.y + 2);
            ctx.lineTo(this.x + 8, this.y + 11);
            ctx.lineTo(this.x - 8, this.y + 11);
            ctx.closePath();
            ctx.fill();

            // Belt
            ctx.fillStyle = '#451a03';
            ctx.fillRect(this.x - 9, this.y + 5, 18, 2);

            // Head (Goblin light green)
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(this.x, this.y - 4 + wobble, 10, 0, Math.PI * 2);
            ctx.fill();

            // Pointy ears (drawn with bezier curves)
            ctx.beginPath();
            ctx.moveTo(this.x - 8, this.y - 6 + wobble);
            ctx.bezierCurveTo(this.x - 18, this.y - 12 + wobble, this.x - 16, this.y - 2 + wobble, this.x - 8, this.y - 2 + wobble);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.moveTo(this.x - 8, this.y - 5 + wobble);
            ctx.bezierCurveTo(this.x - 14, this.y - 9 + wobble, this.x - 13, this.y - 3 + wobble, this.x - 8, this.y - 3 + wobble);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.moveTo(this.x + 8, this.y - 6 + wobble);
            ctx.bezierCurveTo(this.x + 18, this.y - 12 + wobble, this.x + 16, this.y - 2 + wobble, this.x + 8, this.y - 2 + wobble);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.moveTo(this.x + 8, this.y - 5 + wobble);
            ctx.bezierCurveTo(this.x + 14, this.y - 9 + wobble, this.x + 13, this.y - 3 + wobble, this.x + 8, this.y - 3 + wobble);
            ctx.closePath();
            ctx.fill();

            // Glowing slitted yellow eyes
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(this.x - 3, this.y - 4 + wobble, 2, 0, Math.PI*2);
            ctx.arc(this.x + 3, this.y - 4 + wobble, 2, 0, Math.PI*2);
            ctx.fill();

            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.x - 3, this.y - 6 + wobble);
            ctx.lineTo(this.x - 3, this.y - 2 + wobble);
            ctx.moveTo(this.x + 3, this.y - 6 + wobble);
            ctx.lineTo(this.x + 3, this.y - 2 + wobble);
            ctx.stroke();

            ctx.strokeStyle = '#14532d';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y + 1 + wobble, 3, 0.1, Math.PI - 0.1);
            ctx.stroke();

        } else if (this.type === 'shooter') {
            // BAT / GARGOYLE
            const wingFlap = Math.sin(Date.now() * 0.015) * 12;
            const hoverWobble = Math.sin(Date.now() * 0.008) * 3;

            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.moveTo(this.x - 2, this.y + hoverWobble);
            ctx.bezierCurveTo(this.x - 16, this.y - 12 + wingFlap + hoverWobble, this.x - 28, this.y - 4 + wingFlap + hoverWobble, this.x - 8, this.y + 8 + hoverWobble);
            ctx.bezierCurveTo(this.x - 12, this.y + 4 + hoverWobble, this.x - 6, this.y + 2 + hoverWobble, this.x - 2, this.y + hoverWobble);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(this.x + 2, this.y + hoverWobble);
            ctx.bezierCurveTo(this.x + 16, this.y - 12 + wingFlap + hoverWobble, this.x + 28, this.y - 4 + wingFlap + hoverWobble, this.x + 8, this.y + 8 + hoverWobble);
            ctx.bezierCurveTo(this.x + 12, this.y + 4 + hoverWobble, this.x + 6, this.y + 2 + hoverWobble, this.x + 2, this.y + hoverWobble);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(this.x, this.y + hoverWobble, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(this.x - 7, this.y - 7 + hoverWobble);
            ctx.lineTo(this.x - 12, this.y - 17 + hoverWobble);
            ctx.lineTo(this.x - 2, this.y - 9 + hoverWobble);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(this.x + 7, this.y - 7 + hoverWobble);
            ctx.lineTo(this.x + 12, this.y - 17 + hoverWobble);
            ctx.lineTo(this.x + 2, this.y - 9 + hoverWobble);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(this.x - 6, this.y - 8 + hoverWobble);
            ctx.lineTo(this.x - 9, this.y - 14 + hoverWobble);
            ctx.lineTo(this.x - 3, this.y - 9 + hoverWobble);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(this.x + 6, this.y - 8 + hoverWobble);
            ctx.lineTo(this.x + 9, this.y - 14 + hoverWobble);
            ctx.lineTo(this.x + 3, this.y - 9 + hoverWobble);
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 6;
            ctx.shadowColor = '#ef4444';
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.arc(this.x - 3, this.y - 2 + hoverWobble, 2, 0, Math.PI*2);
            ctx.arc(this.x + 3, this.y - 2 + hoverWobble, 2, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;

        } else if (this.type === 'swarmer' || this.type === 'mini_swarmer') {
            // SLIME
            const baseTime = Date.now() * 0.015;
            const squash = Math.sin(baseTime) * 0.18;
            
            ctx.save();
            ctx.translate(this.x, this.y + this.radius);
            ctx.scale(1 + squash, 1 - squash);
            
            const grad = ctx.createRadialGradient(0, -this.radius * 0.6, 2, 0, -this.radius * 0.6, this.radius);
            if (this.type === 'swarmer') {
                grad.addColorStop(0, 'rgba(34, 197, 94, 0.85)');
                grad.addColorStop(0.7, 'rgba(21, 128, 61, 0.95)');
                grad.addColorStop(1, 'rgba(22, 101, 52, 0.95)');
            } else {
                grad.addColorStop(0, 'rgba(74, 222, 128, 0.85)');
                grad.addColorStop(0.7, 'rgba(34, 197, 94, 0.95)');
                grad.addColorStop(1, 'rgba(21, 128, 61, 0.95)');
            }
            ctx.fillStyle = grad;

            ctx.beginPath();
            ctx.arc(0, -this.radius, this.radius, 0, Math.PI, true);
            ctx.lineTo(-this.radius, 0);
            ctx.quadraticCurveTo(0, this.radius * 0.2, this.radius, 0);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(-this.radius * 0.3, -this.radius * 1.3, this.radius * 0.25, 0, Math.PI * 2);
            ctx.fill();

            const b1Offset = Math.sin(baseTime * 0.5) * (this.radius * 0.25);
            ctx.fillStyle = 'rgba(165, 243, 252, 0.6)';
            ctx.beginPath();
            ctx.arc(this.radius * 0.2, -this.radius * 0.8 + b1Offset, this.radius * 0.15, 0, Math.PI * 2);
            ctx.arc(-this.radius * 0.4, -this.radius * 0.5 - b1Offset, this.radius * 0.1, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#052e16';
            ctx.beginPath();
            ctx.arc(-this.radius * 0.25, -this.radius * 0.7, this.radius * 0.15, 0, Math.PI * 2);
            ctx.arc(this.radius * 0.25, -this.radius * 0.7, this.radius * 0.15, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
        // -------------------------------------------------------------
        // LEVEL 1: FOREST
        // -------------------------------------------------------------
        else if (this.type === 'forest_swarmer' || this.type === 'forest_mini_swarmer') {
            const baseTime = Date.now() * 0.015;
            const squash = Math.sin(baseTime) * 0.16;
            ctx.save();
            ctx.translate(this.x, this.y + this.radius);
            ctx.scale(1 + squash, 1 - squash);
            
            const grad = ctx.createRadialGradient(0, -this.radius * 0.6, 2, 0, -this.radius * 0.6, this.radius);
            grad.addColorStop(0, '#86efac'); 
            grad.addColorStop(0.7, '#22c55e'); 
            grad.addColorStop(1, '#15803d');
            ctx.fillStyle = grad;

            ctx.beginPath();
            ctx.arc(0, -this.radius, this.radius, 0, Math.PI, true);
            ctx.lineTo(-this.radius, 0);
            ctx.quadraticCurveTo(0, this.radius * 0.2, this.radius, 0);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#15803d';
            ctx.strokeStyle = '#14532d';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-this.radius * 0.5, -this.radius * 0.9);
            ctx.quadraticCurveTo(-this.radius * 1.1, -this.radius * 1.5, -this.radius * 0.8, -this.radius * 1.8);
            ctx.quadraticCurveTo(-this.radius * 0.3, -this.radius * 1.3, -this.radius * 0.3, -this.radius * 0.9);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(this.radius * 0.5, -this.radius * 0.9);
            ctx.quadraticCurveTo(this.radius * 1.1, -this.radius * 1.5, this.radius * 0.8, -this.radius * 1.8);
            ctx.quadraticCurveTo(this.radius * 0.3, -this.radius * 1.3, this.radius * 0.3, -this.radius * 0.9);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(-this.radius * 0.3, -this.radius * 1.1, this.radius * 0.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#064e3b';
            ctx.beginPath();
            ctx.arc(-this.radius * 0.25, -this.radius * 0.6, this.radius * 0.15, 0, Math.PI * 2);
            ctx.arc(this.radius * 0.25, -this.radius * 0.6, this.radius * 0.15, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        } 
        else if (this.type === 'forest_shooter') {
            const wobble = Math.sin(Date.now() * 0.007) * 1.5;
            ctx.save();
            ctx.translate(this.x, this.y);

            ctx.fillStyle = '#78350f';
            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(-this.radius, -this.radius + 3, this.radius * 2, this.radius * 2 - 3, 5);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#b45309';
            ctx.beginPath();
            ctx.ellipse(0, -this.radius + 3, this.radius, 4, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.ellipse(-this.radius * 0.8, wobble, 5, 2.5, -0.4, 0, Math.PI*2);
            ctx.ellipse(this.radius * 0.8, -wobble, 5, 2.5, 0.4, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#022c22';
            ctx.beginPath();
            ctx.ellipse(0, 3 + wobble, this.radius * 0.5, 6, 0, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#4ade80';
            ctx.beginPath();
            ctx.arc(-3, 3 + wobble, 1.8, 0, Math.PI*2);
            ctx.arc(3, 3 + wobble, 1.8, 0, Math.PI*2);
            ctx.fill();

            ctx.restore();
        } 
        else if (this.type === 'forest_sprout') {
            const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.08;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.scale(pulse, pulse);

            ctx.fillStyle = '#14532d';
            ctx.fillRect(-4, 6, 8, 14);

            ctx.fillStyle = '#dc2626';
            ctx.strokeStyle = '#991b1b';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, -2, 12, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.ellipse(0, -2, 8, 10, 0.3, 0, Math.PI*2);
            ctx.fill();

            ctx.strokeStyle = '#451a03';
            ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 / 6) * i;
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * 12, Math.sin(angle) * 12);
                ctx.lineTo(Math.cos(angle) * 18, Math.sin(angle) * 18);
                ctx.stroke();
            }

            ctx.restore();
        }
        // -------------------------------------------------------------
        // LEVEL 2: SHADOW
        // -------------------------------------------------------------
        else if (this.type === 'shadow_swarmer') {
            ctx.save();
            if (this.stealthActive) {
                ctx.globalAlpha = 0.15;
            }
            
            const wobble = Math.sin(Date.now() * 0.01) * 3;
            ctx.translate(this.x, this.y + wobble);

            ctx.fillStyle = '#3b0764';
            ctx.strokeStyle = '#1e1b4b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-12, 12);
            ctx.lineTo(0, -18);
            ctx.lineTo(12, 12);
            ctx.quadraticCurveTo(0, 7, -12, 12);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#030712';
            ctx.beginPath();
            ctx.arc(0, -6, 6, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#c084fc';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#c084fc';
            ctx.beginPath();
            ctx.arc(-2.2, -6, 1.2, 0, Math.PI*2);
            ctx.arc(2.2, -6, 1.2, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.restore();
        } 
        else if (this.type === 'shadow_shooter') {
            const wingFlap = Math.sin(Date.now() * 0.016) * 10;
            const hover = Math.sin(Date.now() * 0.009) * 3.5;
            ctx.save();
            ctx.translate(this.x, this.y + hover);

            ctx.fillStyle = '#4b5563';
            ctx.strokeStyle = '#1f2937';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-2, 0);
            ctx.bezierCurveTo(-14, -10 + wingFlap, -26, -2 + wingFlap, -8, 10);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(2, 0);
            ctx.bezierCurveTo(14, -10 + wingFlap, 26, -2 + wingFlap, 8, 10);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#374151';
            ctx.beginPath();
            ctx.arc(0, 0, 11, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#1f2937';
            ctx.beginPath();
            ctx.moveTo(-6, -8); ctx.lineTo(-9, -15); ctx.lineTo(-2, -9); ctx.fill();
            ctx.moveTo(6, -8); ctx.lineTo(9, -15); ctx.lineTo(2, -9); ctx.fill();

            ctx.fillStyle = '#d8b4fe';
            ctx.beginPath();
            ctx.arc(-3, -2, 1.8, 0, Math.PI*2);
            ctx.arc(3, -2, 1.8, 0, Math.PI*2);
            ctx.fill();

            ctx.restore();
        } 
        else if (this.type === 'shadow_chaser') {
            const wobble = Math.sin(Date.now() * 0.013) * 3;
            ctx.save();
            ctx.translate(this.x, this.y + wobble);

            ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
            ctx.beginPath();
            ctx.arc(0, -3, 16, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#faf5ff';
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -3, 12, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();

            ctx.fillRect(-6, 6, 12, 6);
            ctx.strokeRect(-6, 6, 12, 6);

            ctx.fillStyle = '#1e1b4b';
            ctx.beginPath();
            ctx.arc(-4, -3, 3, 0, Math.PI*2);
            ctx.arc(4, -3, 3, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(-4, -3, 0.8, 0, Math.PI*2);
            ctx.arc(4, -3, 0.8, 0, Math.PI*2);
            ctx.fill();

            ctx.restore();
        }
        // -------------------------------------------------------------
        // LEVEL 3: DEATH
        // -------------------------------------------------------------
        else if (this.type === 'death_swarmer') {
            const run = Math.sin(Date.now() * 0.024) * 3.5;
            ctx.save();
            ctx.translate(this.x, this.y);

            ctx.strokeStyle = '#fca5a5';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-10, 2);
            ctx.quadraticCurveTo(-18, 5 + run, -22, 1 + run);
            ctx.stroke();

            ctx.fillStyle = '#4b5563';
            ctx.strokeStyle = '#374151';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(0, 0, 11, 7, 0.1, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(5, -3);
            ctx.lineTo(13, 1);
            ctx.lineTo(4, 4);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.arc(2, -5, 3.5, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(7, -1, 1.2, 0, Math.PI*2);
            ctx.fill();

            ctx.restore();
        } 
        else if (this.type === 'death_shooter') {
            const sway = Math.sin(Date.now() * 0.006) * 0.05;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(sway);

            ctx.fillStyle = '#064e3b';
            ctx.strokeStyle = '#022c22';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(-11, 12);
            ctx.lineTo(-4, -18);
            ctx.lineTo(4, -18);
            ctx.lineTo(11, 12);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#022c22';
            ctx.beginPath();
            ctx.ellipse(0, -9, 6, 8, 0, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#f1f5f9';
            ctx.beginPath();
            ctx.arc(0, -8, 4.2, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.arc(-1.5, -9, 0.9, 0, Math.PI*2);
            ctx.arc(1.5, -9, 0.9, 0, Math.PI*2);
            ctx.fill();

            ctx.restore();
        } 
        else if (this.type === 'death_chaser') {
            const legWobble = Math.sin(Date.now() * 0.015) * 3;
            ctx.save();
            ctx.translate(this.x, this.y);

            ctx.fillStyle = '#e2e8f0';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5;
            
            ctx.fillRect(-5, 7, 2, 7 + legWobble);
            ctx.fillRect(3, 7, 2, 7 - legWobble);

            ctx.fillRect(-1, -6, 2, 13);
            ctx.fillRect(-8, -4, 16, 1.8);
            ctx.fillRect(-6, -1, 12, 1.8);
            ctx.fillRect(-5, 2, 10, 1.8);

            ctx.beginPath();
            ctx.arc(0, -11, 6, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(-2, -11, 1.5, 0, Math.PI*2);
            ctx.arc(2, -11, 1.5, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#78350f'; 
            ctx.strokeStyle = '#475569'; 
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(5, -6);
            ctx.lineTo(13, -6);
            ctx.lineTo(11, 8);
            ctx.lineTo(5, 12);
            ctx.lineTo(-1, 8);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.restore();
        }
        // -------------------------------------------------------------
        // LEVEL 4: FIRE
        // -------------------------------------------------------------
        else if (this.type === 'fire_swarmer' || this.type === 'fire_mini_swarmer') {
            const baseTime = Date.now() * 0.015;
            const squash = Math.sin(baseTime) * 0.16;
            ctx.save();
            ctx.translate(this.x, this.y + this.radius);
            ctx.scale(1 + squash, 1 - squash);
            
            const grad = ctx.createRadialGradient(0, -this.radius * 0.6, 2, 0, -this.radius * 0.6, this.radius);
            grad.addColorStop(0, '#fde047'); 
            grad.addColorStop(0.5, '#ea580c'); 
            grad.addColorStop(1, '#7c2d12'); 
            ctx.fillStyle = grad;

            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ea580c';

            ctx.beginPath();
            ctx.arc(0, -this.radius, this.radius, 0, Math.PI, true);
            ctx.lineTo(-this.radius, 0);
            ctx.quadraticCurveTo(0, this.radius * 0.2, this.radius, 0);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(-this.radius * 0.3, -this.radius * 0.8, this.radius * 0.16, 0, Math.PI*2);
            ctx.arc(this.radius * 0.4, -this.radius * 0.5, this.radius * 0.12, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#450a0a';
            ctx.beginPath();
            ctx.arc(-this.radius * 0.25, -this.radius * 0.6, this.radius * 0.14, 0, Math.PI * 2);
            ctx.arc(this.radius * 0.25, -this.radius * 0.6, this.radius * 0.14, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        } 
        else if (this.type === 'fire_shooter') {
            const flap = Math.sin(Date.now() * 0.02) * 8;
            const wobble = Math.sin(Date.now() * 0.009) * 3;
            ctx.save();
            ctx.translate(this.x, this.y + wobble);

            ctx.fillStyle = '#b91c1c';
            ctx.beginPath();
            ctx.moveTo(-2, 0); ctx.lineTo(-14, -10 + flap); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(2, 0); ctx.lineTo(14, -10 + flap); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#ef4444';
            ctx.strokeStyle = '#7c2d12';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#450a0a';
            ctx.beginPath();
            ctx.moveTo(-5, -8); ctx.lineTo(-7, -13); ctx.lineTo(-2, -9); ctx.closePath(); ctx.fill();
            ctx.moveTo(5, -8); ctx.lineTo(7, -13); ctx.lineTo(2, -9); ctx.closePath(); ctx.fill();

            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(-3, -2, 1.8, 0, Math.PI*2);
            ctx.arc(3, -2, 1.8, 0, Math.PI*2);
            ctx.fill();

            ctx.restore();
        } 
        else if (this.type === 'fire_chaser') {
            ctx.save();
            ctx.translate(this.x, this.y);

            ctx.shadowBlur = 6;
            ctx.shadowColor = '#f97316';

            ctx.fillStyle = '#292524';
            ctx.strokeStyle = '#ea580c';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.ellipse(0, 2, 13, 8, 0.15, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();

            ctx.strokeStyle = '#ea580c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-6, -1); ctx.lineTo(-3, 5);
            ctx.moveTo(2, -2); ctx.lineTo(5, 4);
            ctx.stroke();

            ctx.fillStyle = '#292524';
            ctx.beginPath();
            ctx.moveTo(6, -2);
            ctx.lineTo(16, 2);
            ctx.lineTo(4, 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(9, 0, 1.5, 0, Math.PI*2);
            ctx.fill();

            ctx.restore();
        }
        // -------------------------------------------------------------
        // LEVEL 5: VOID
        // -------------------------------------------------------------
        else if (this.type === 'void_swarmer') {
            const rot = (Date.now() * 0.003) % (Math.PI * 2);
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(rot);

            const voidGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 12);
            voidGrad.addColorStop(0, '#e0f2fe');
            voidGrad.addColorStop(0.5, '#c084fc');
            voidGrad.addColorStop(1, 'rgba(88, 28, 135, 0)');
            ctx.fillStyle = voidGrad;
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI*2);
            ctx.fill();

            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(0, -11);
            ctx.lineTo(10, 0);
            ctx.lineTo(0, 11);
            ctx.lineTo(-10, 0);
            ctx.closePath();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#38bdf8';
            ctx.beginPath();
            ctx.arc(0, -11, 2.5, 0, Math.PI*2);
            ctx.arc(10, 0, 2.5, 0, Math.PI*2);
            ctx.arc(0, 11, 2.5, 0, Math.PI*2);
            ctx.arc(-10, 0, 2.5, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.restore();
        } 
        else if (this.type === 'void_shooter') {
            const hover = Math.sin(Date.now() * 0.007) * 3;
            ctx.save();
            ctx.translate(this.x, this.y + hover);

            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 1.5;
            ctx.save();
            ctx.rotate(Date.now() * 0.002);
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius + 3, 5, 0, 0, Math.PI*2);
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = '#1e1b4b';
            ctx.strokeStyle = '#581c87';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#06b6d4';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#020617';
            ctx.beginPath();
            ctx.arc(0, 0, 2.2, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-1.2, -1.2, 1, 0, Math.PI*2);
            ctx.fill();

            ctx.restore();
        } 
        else if (this.type === 'void_chaser') {
            const rot = Date.now() * 0.005;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(rot);

            ctx.fillStyle = '#030712';
            ctx.strokeStyle = '#4c1d95';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#6d28d9';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius - 2, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const angle = (Math.PI * 2 / 3) * i;
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(Math.cos(angle + 0.5) * 12, Math.sin(angle + 0.5) * 12, Math.cos(angle + 1.2) * 20, Math.sin(angle + 1.2) * 20);
            }
            ctx.stroke();

            ctx.restore();
        }

        // Draw frost slow overlay
        if (this.slowTimer > 0) {
            ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Tiny ice shards/sparkles
            ctx.fillStyle = '#cffafe';
            for (let i = 0; i < 3; i++) {
                const angle = (Date.now() * 0.005 + i * Math.PI * 0.6) % (Math.PI * 2);
                const rx = this.x + Math.cos(angle) * (this.radius * 0.6);
                const ry = this.y + Math.sin(angle) * (this.radius * 0.6);
                ctx.fillRect(rx - 1, ry - 1, 2, 2);
            }
        }

        // Draw health bar above if damaged
        if (this.health < this.maxHealth) {
            const barW = this.radius * 1.6;
            const barH = 3;
            const bx = this.x - barW / 2;
            const by = this.y - this.radius - 8;

            ctx.fillStyle = '#ef4444';
            ctx.fillRect(bx, by, barW, barH);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(bx, by, barW * (this.health / this.maxHealth), barH);
        }

        ctx.restore();
    }
}

// Bosses representing Level Guardians
export class Boss {
    constructor(x, y, level) {
        this.x = x;
        this.y = y;
        this.level = level;
        this.radius = 35;
        this.knockbackX = 0;
        this.knockbackY = 0;

        // 3 boss variants per level: [level][variant]
        const bossesData = [
            // Level 1 – Forest
            [
                { name: 'THE GOLEM',       maxHealth: 90,  speed: 1.1, color: '#64748b' },
                { name: 'GIANT SPIDER',    maxHealth: 80,  speed: 1.3, color: '#166534' },
                { name: 'ANCIENT TREANT',  maxHealth: 100, speed: 0.9, color: '#854d0e' },
            ],
            // Level 2 – Shadow
            [
                { name: 'SHADOW KNIGHT',   maxHealth: 140, speed: 1.4, color: '#1e1b4b' },
                { name: 'PHANTOM WITCH',   maxHealth: 120, speed: 1.5, color: '#6b21a8' },
                { name: 'DARK GARGOYLE',   maxHealth: 160, speed: 1.6, color: '#374151' },
            ],
            // Level 3 – Death
            [
                { name: 'NECROMANCER',     maxHealth: 190, speed: 1.2, color: '#047857' },
                { name: 'BONE COLOSSUS',   maxHealth: 220, speed: 0.9, color: '#d6d3d1' },
                { name: 'PLAGUE DOCTOR',   maxHealth: 170, speed: 1.3, color: '#65a30d' },
            ],
            // Level 4 – Fire
            [
                { name: 'FIRE DEMON',      maxHealth: 250, speed: 1.6, color: '#b91c1c' },
                { name: 'INFERNAL DRAKE',  maxHealth: 280, speed: 1.4, color: '#c2410c' },
                { name: 'MAGMA TITAN',     maxHealth: 300, speed: 0.9, color: '#92400e' },
            ],
            // Level 5 – Void
            [
                { name: 'THE VOID EYE',    maxHealth: 350, speed: 1.3, color: '#581c87' },
                { name: 'COSMIC HORROR',   maxHealth: 380, speed: 1.1, color: '#0f172a' },
                { name: 'SHADOW OVERLORD', maxHealth: 400, speed: 1.5, color: '#1e1b4b' },
            ],
        ];

        // Choose random variant 0/1/2 for this boss encounter
        this.bossVariant = Math.floor(Math.random() * 3);

        // Fallback for endless levels beyond depth V
        const levelIdx = Math.min(level - 1, bossesData.length - 1);
        const data = bossesData[levelIdx][this.bossVariant];
        this.name = data.name;
        this.maxHealth = data.maxHealth * (1 + (level - 1) * 0.15);
        this.health = this.maxHealth;
        this.speed = data.speed;
        this.color = data.color;

        this.attackCooldown = 120;
        this.phase = 1;
        this.damage = 1;

        // Boss-specific state
        this.jumpTimer = 0;
        this.isJumping = false;
        this.jumpTargetX = 0;
        this.jumpTargetY = 0;
        this.staffAngle = 0;      // Necromancer
        this.webTimer = 0;        // Giant Spider web charge
        this.tentacleAngle = 0;   // Cosmic Horror
        this.orbAngle = 0;        // Phantom Witch
    }

    takeDamage(amount, kx = 0, ky = 0) {
        // Boss has heavy knockback resistance (multiply incoming knockback by 15%)
        this.health -= amount;
        this.knockbackX = kx * 0.15;
        this.knockbackY = ky * 0.15;

        spawnBlood(this.x, this.y, 8);
        spawnFloatingText(this.x, this.y - 30, `${amount.toFixed(1)}`, '#ef4444', 14);

        if (this.health <= 0) {
            spawnExplosion(this.x, this.y, 90);
            spawnSparkles(this.x, this.y, '#f59e0b', 30);
        }
    }

    update(player, obstacles, projectiles, currentRoom) {
        // Knocback physics
        this.x += this.knockbackX;
        this.y += this.knockbackY;
        this.knockbackX *= 0.85;
        this.knockbackY *= 0.85;

        // Player tracking
        let dx = player.x - this.x;
        let dy = player.y - this.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist === 0) {
            dx = 1;
            dy = 0;
            dist = 0.001;
        }

        // Update phase
        if (this.health < this.maxHealth * 0.4) {
            this.phase = 2; // Desperation phase: faster, aggressive
        }

        const currentSpeed = this.speed * (this.phase === 2 ? 1.35 : 1.0);

        // Core AI logic depending on level + variant
        const bossIndex = Math.min(this.level - 1, 4);

        if (bossIndex === 0) {
            if (this.bossVariant === 0) {
                // THE GOLEM: Smash and Jump mechanics
                if (this.isJumping) {
                    this.jumpTimer--;
                    
                    // Move towards jump target
                    const jdx = this.jumpTargetX - this.x;
                    const jdy = this.jumpTargetY - this.y;
                    const jdist = Math.sqrt(jdx*jdx + jdy*jdy);

                    if (jdist > 2) {
                        this.x += jdx / (this.jumpTimer + 1);
                        this.y += jdy / (this.jumpTimer + 1);
                    }

                    if (this.jumpTimer <= 0) {
                        // LAND! Deal shockwave
                        this.isJumping = false;
                        this.x = this.jumpTargetX;
                        this.y = this.jumpTargetY;
                        spawnExplosion(this.x, this.y, 80);
                        
                        // Landing shockwave damage to player
                        const pdx = player.x - this.x;
                        const pdy = player.y - this.y;
                        const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
                        if (pdist < 60) {
                            player.takeDamage(this.damage);
                        }

                        // Radial bullet shockwave
                        for (let i = 0; i < 12; i++) {
                            const angle = (Math.PI * 2 / 12) * i;
                            projectiles.push(new Projectile({
                                x: this.x,
                                y: this.y,
                                vx: Math.cos(angle) * 4.5,
                                vy: Math.sin(angle) * 4.5,
                                damage: 1,
                                range: 200,
                                type: 'bullet',
                                owner: 'enemy'
                            }));
                        }
                        
                        this.attackCooldown = 100 - (this.phase === 2 ? 30 : 0);
                    }
                } else {
                    // Chase slowly
                    if (dist > 10) {
                        this.x += (dx / dist) * currentSpeed;
                        this.y += (dy / dist) * currentSpeed;
                    }

                    this.attackCooldown--;
                    if (this.attackCooldown <= 0) {
                        // Trigger Jump attack
                        this.isJumping = true;
                        this.jumpTimer = 45; // 0.75 seconds airborne
                        this.jumpTargetX = player.x + (Math.random() - 0.5) * 40;
                        this.jumpTargetY = player.y + (Math.random() - 0.5) * 40;
                        spawnSmoke(this.x, this.y, 10);
                        audio.play('boss_scream');
                    }
                }
            } else if (this.bossVariant === 1) {
                // GIANT SPIDER: Web Spit and Poison Bite
                if (dist > 120) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                } else if (dist < 80) {
                    this.x -= (dx / dist) * currentSpeed * 0.5;
                    this.y -= (dy / dist) * currentSpeed * 0.5;
                }
                
                this.attackCooldown--;
                if (this.attackCooldown <= 0) {
                    audio.play('boss_scream');
                    // Spit 3 webballs
                    const baseAngle = Math.atan2(dy, dx);
                    for (let i = -1; i <= 1; i++) {
                        const angle = baseAngle + i * 0.25;
                        projectiles.push(new Projectile({
                            x: this.x,
                            y: this.y,
                            vx: Math.cos(angle) * 5,
                            vy: Math.sin(angle) * 5,
                            damage: 0.5,
                            range: 300,
                            type: 'webball',
                            owner: 'enemy'
                        }));
                    }
                    this.attackCooldown = 90 - (this.phase === 2 ? 25 : 0);
                }
                
                // Close poison bite
                if (dist < 55) {
                    if (Math.random() < 0.04) {
                        player.takeDamage(0.5);
                        spawnFloatingText(player.x, player.y - 20, "POISONED!", '#22c55e', 13);
                    }
                }
            } else {
                // ANCIENT TREANT: Root Trap and Thorn Burst
                if (dist > 150) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                }
                
                this.attackCooldown--;
                if (this.attackCooldown <= 0) {
                    const r = Math.random();
                    if (r < 0.5) {
                        // Thorn Burst
                        audio.play('boss_scream');
                        for (let i = 0; i < 8; i++) {
                            const angle = (Math.PI * 2 / 8) * i + Math.random() * 0.2;
                            projectiles.push(new Projectile({
                                x: this.x,
                                y: this.y,
                                vx: Math.cos(angle) * 5,
                                vy: Math.sin(angle) * 5,
                                damage: 1,
                                range: 350,
                                type: 'bullet',
                                owner: 'enemy'
                            }));
                        }
                    } else {
                        // Root Trap under player
                        spawnSparkles(player.x, player.y, '#854d0e', 15);
                        spawnFloatingText(this.x, this.y - 30, "ROOTS!", '#854d0e', 14);
                        obstacles.push({
                            x: player.x,
                            y: player.y,
                            type: 'root',
                            width: 50,
                            height: 50,
                            timer: 120,
                            extinguished: false
                        });
                    }
                    this.attackCooldown = 110 - (this.phase === 2 ? 30 : 0);
                }
                
                // Clean up root obstacles
                for (let i = obstacles.length - 1; i >= 0; i--) {
                    const obs = obstacles[i];
                    if (obs.type === 'root') {
                        obs.timer--;
                        if (obs.timer <= 0) {
                            obstacles.splice(i, 1);
                        }
                    }
                }
            }

        } else if (bossIndex === 1) {
            if (this.bossVariant === 0) {
                // SHADOW KNIGHT: Dash attack & circular blades
                this.attackCooldown--;

                if (this.isJumping) {
                    // Dash charging
                    this.x += this.jumpTargetX * currentSpeed * 2.8;
                    this.y += this.jumpTargetY * currentSpeed * 2.8;
                    
                    spawnSmoke(this.x, this.y, 1, 0.4);

                    this.jumpTimer--;
                    if (this.jumpTimer <= 0) {
                        this.isJumping = false;
                        this.attackCooldown = 80;
                    }
                } else {
                    // Chase
                    if (dist > 100) {
                        this.x += (dx / dist) * currentSpeed;
                        this.y += (dy / dist) * currentSpeed;
                    }

                    if (this.attackCooldown <= 0) {
                        const r = Math.random();
                        if (r < 0.6) {
                            // Dash attack
                            this.isJumping = true;
                            this.jumpTimer = 25; // dash duration
                            this.jumpTargetX = dx / dist; // Normalized direction to dash
                            this.jumpTargetY = dy / dist;
                            audio.play('boss_scream');
                        } else {
                            // Shoot radial blades
                            const count = this.phase === 2 ? 12 : 8;
                            for (let i = 0; i < count; i++) {
                                const angle = (Math.PI * 2 / count) * i;
                                projectiles.push(new Projectile({
                                    x: this.x,
                                    y: this.y,
                                    vx: Math.cos(angle) * 5,
                                    vy: Math.sin(angle) * 5,
                                    damage: 1,
                                    range: 350,
                                    type: 'bullet',
                                    owner: 'enemy'
                                }));
                            }
                            this.attackCooldown = 90;
                        }
                    }
                }
            } else if (this.bossVariant === 1) {
                // PHANTOM WITCH: Homing Orbs and Blink
                this.attackCooldown--;
                
                if (dist > 220) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                } else if (dist < 120) {
                    // Blink away
                    spawnSmoke(this.x, this.y, 8);
                    this.x = 100 + Math.random() * 600;
                    this.y = 100 + Math.random() * 400;
                    spawnSmoke(this.x, this.y, 8);
                    spawnFloatingText(this.x, this.y - 30, "BLINK!", '#c084fc', 14);
                    
                    // Shoot 4 simple spread bullets
                    for (let i = 0; i < 4; i++) {
                        const angle = (Math.PI / 2) * i;
                        projectiles.push(new Projectile({
                            x: this.x,
                            y: this.y,
                            vx: Math.cos(angle) * 4,
                            vy: Math.sin(angle) * 4,
                            damage: 0.5,
                            range: 250,
                            type: 'bullet',
                            owner: 'enemy'
                        }));
                    }
                    this.attackCooldown = Math.max(this.attackCooldown, 40);
                }
                
                if (this.attackCooldown <= 0) {
                    audio.play('boss_scream');
                    // Shoot 2 homing purple orbs
                    const angle = Math.atan2(dy, dx);
                    projectiles.push(new Projectile({
                        x: this.x - 15,
                        y: this.y,
                        vx: Math.cos(angle - 0.2) * 3.5,
                        vy: Math.sin(angle - 0.2) * 3.5,
                        damage: 1,
                        range: 400,
                        type: 'homing_orb',
                        owner: 'enemy'
                    }));
                    projectiles.push(new Projectile({
                        x: this.x + 15,
                        y: this.y,
                        vx: Math.cos(angle + 0.2) * 3.5,
                        vy: Math.sin(angle + 0.2) * 3.5,
                        damage: 1,
                        range: 400,
                        type: 'homing_orb',
                        owner: 'enemy'
                    }));
                    this.attackCooldown = 110 - (this.phase === 2 ? 35 : 0);
                }
            } else {
                // DARK GARGOYLE: Swoop and Stone Shards
                this.attackCooldown--;
                
                if (this.isJumping) {
                    // Swooping!
                    this.x += this.jumpTargetX * currentSpeed * 2.5;
                    this.y += this.jumpTargetY * currentSpeed * 2.5;
                    spawnSmoke(this.x, this.y, 1, 0.3);
                    this.jumpTimer--;
                    if (this.jumpTimer <= 0) {
                        this.isJumping = false;
                        this.attackCooldown = 50;
                    }
                } else {
                    if (dist > 130) {
                        this.x += (dx / dist) * currentSpeed;
                        this.y += (dy / dist) * currentSpeed;
                    }
                    if (this.attackCooldown <= 0) {
                        const r = Math.random();
                        if (r < 0.5) {
                            // Swoop
                            this.isJumping = true;
                            this.jumpTimer = 30;
                            this.jumpTargetX = dx / dist;
                            this.jumpTargetY = dy / dist;
                            audio.play('boss_scream');
                        } else {
                            // Stone Shards fan of 5
                            audio.play('boss_scream');
                            const baseAngle = Math.atan2(dy, dx);
                            for (let i = -2; i <= 2; i++) {
                                const angle = baseAngle + i * 0.18;
                                projectiles.push(new Projectile({
                                    x: this.x,
                                    y: this.y,
                                    vx: Math.cos(angle) * 5,
                                    vy: Math.sin(angle) * 5,
                                    damage: 1,
                                    range: 350,
                                    type: 'bullet',
                                    owner: 'enemy'
                                }));
                            }
                            this.attackCooldown = 85;
                        }
                    }
                }
            }

        } else if (bossIndex === 2) {
            if (this.bossVariant === 0) {
                // NECROMANCER: Spawn minions, homing missiles, teleport
                this.attackCooldown--;

                if (dist > 180) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                } else if (dist < 100) {
                    this.x -= (dx / dist) * currentSpeed;
                    this.y -= (dy / dist) * currentSpeed;
                }

                if (this.attackCooldown <= 0) {
                    const rand = Math.random();
                    if (rand < 0.45 && currentRoom.mobs.length < 5) {
                        // Spawn skeleton chaser minion
                        spawnSparkles(this.x, this.y, '#22c55e', 10);
                        currentRoom.mobs.push(new Enemy(this.x + (Math.random()-0.5)*100, this.y + (Math.random()-0.5)*100, 'chaser', this.level * 0.7));
                        spawnFloatingText(this.x, this.y - 30, "ARISE!", '#22c55e', 14);
                        audio.play('boss_scream');
                    } else if (rand < 0.8) {
                        // Shoot spread spells
                        for (let i = -1; i <= 1; i++) {
                            const angle = Math.atan2(dy, dx) + i * 0.25;
                            projectiles.push(new Projectile({
                                x: this.x,
                                y: this.y,
                                vx: Math.cos(angle) * 4,
                                vy: Math.sin(angle) * 4,
                                damage: 1,
                                range: 350,
                                type: 'bullet',
                                owner: 'enemy'
                            }));
                        }
                    } else {
                        // Teleport away
                        spawnSmoke(this.x, this.y, 8);
                        this.x = 100 + Math.random() * 600;
                        this.y = 100 + Math.random() * 400;
                        spawnSmoke(this.x, this.y, 8);
                        spawnFloatingText(this.x, this.y - 30, "VANISH!", '#a855f7', 14);
                    }
                    this.attackCooldown = 110 - (this.phase === 2 ? 30 : 0);
                }
            } else if (this.bossVariant === 1) {
                // BONE COLOSSUS: Stomp and Bone Fan
                if (dist > 80) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                }
                
                this.attackCooldown--;
                if (this.attackCooldown <= 0) {
                    const r = Math.random();
                    if (r < 0.5) {
                        // Ground Stomp
                        audio.play('boss_scream');
                        spawnExplosion(this.x, this.y, 70);
                        if (dist < 100) {
                            player.takeDamage(1);
                        }
                        // Circular bone shards
                        for (let i = 0; i < 8; i++) {
                            const angle = (Math.PI * 2 / 8) * i;
                            projectiles.push(new Projectile({
                                x: this.x,
                                y: this.y,
                                vx: Math.cos(angle) * 4.5,
                                vy: Math.sin(angle) * 4.5,
                                damage: 0.5,
                                range: 220,
                                type: 'bullet',
                                owner: 'enemy'
                            }));
                        }
                        this.attackCooldown = 90;
                    } else {
                        // Bone Fan
                        audio.play('boss_scream');
                        const baseAngle = Math.atan2(dy, dx);
                        for (let i = -2; i <= 3; i++) {
                            const angle = baseAngle + (i - 0.5) * 0.15;
                            projectiles.push(new Projectile({
                                x: this.x,
                                y: this.y,
                                vx: Math.cos(angle) * 5,
                                vy: Math.sin(angle) * 5,
                                damage: 1,
                                range: 350,
                                type: 'bullet',
                                owner: 'enemy'
                            }));
                        }
                        this.attackCooldown = 100;
                    }
                }
            } else {
                // PLAGUE DOCTOR: Toxic Flasks and miasma clouds
                if (dist > 160) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                } else if (dist < 110) {
                    this.x -= (dx / dist) * currentSpeed * 0.8;
                    this.y -= (dy / dist) * currentSpeed * 0.8;
                }
                
                this.attackCooldown--;
                if (this.attackCooldown <= 0) {
                    audio.play('boss_scream');
                    // Throw poison flask at player
                    spawnSparkles(player.x, player.y, '#22c55e', 10);
                    spawnFloatingText(this.x, this.y - 30, "TOXIC FLASK!", '#84cc16', 14);
                    obstacles.push({
                        x: player.x + (Math.random() - 0.5) * 20,
                        y: player.y + (Math.random() - 0.5) * 20,
                        type: 'poison_cloud',
                        width: 60,
                        height: 60,
                        timer: 150,
                        extinguished: false
                    });
                    this.attackCooldown = 90 - (this.phase === 2 ? 25 : 0);
                }
                
                // Tick damage for poison clouds
                for (let i = obstacles.length - 1; i >= 0; i--) {
                    const obs = obstacles[i];
                    if (obs.type === 'poison_cloud') {
                        obs.timer--;
                        if (obs.timer <= 0) {
                            obstacles.splice(i, 1);
                        } else {
                            const pdx = player.x - obs.x;
                            const pdy = player.y - obs.y;
                            const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
                            if (pdist < 30 + player.radius) {
                                player.takeDamage(0.5);
                            }
                        }
                    }
                }
            }

        } else if (bossIndex === 3) {
            if (this.bossVariant === 0) {
                // FIRE DEMON: Fast fire rings, charging laser beams
                this.attackCooldown--;

                // Fast close chase
                if (dist > 40) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                }

                if (this.attackCooldown <= 0) {
                    audio.play('boss_scream');
                    // Fire ring bullets expanding outwards
                    const bulletCount = this.phase === 2 ? 18 : 12;
                    for (let i = 0; i < bulletCount; i++) {
                        const angle = (Math.PI * 2 / bulletCount) * i;
                        projectiles.push(new Projectile({
                            x: this.x,
                            y: this.y,
                            vx: Math.cos(angle) * 5.5,
                            vy: Math.sin(angle) * 5.5,
                            damage: 1,
                            range: 400,
                            type: 'bullet',
                            owner: 'enemy'
                        }));
                    }
                    this.attackCooldown = 70;
                }
            } else if (this.bossVariant === 1) {
                // INFERNAL DRAKE: Fire Breath Cone and Tail Sweep
                if (dist > 130) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                }
                
                this.attackCooldown--;
                if (this.attackCooldown <= 0) {
                    const r = Math.random();
                    if (r < 0.5) {
                        // Fire Breath Cone over time
                        audio.play('boss_scream');
                        const baseAngle = Math.atan2(dy, dx);
                        for (let s = 0; s < 6; s++) {
                            setTimeout(() => {
                                if (this.health <= 0) return;
                                const spreadAngle = baseAngle + (Math.random() - 0.5) * 0.45;
                                projectiles.push(new Projectile({
                                    x: this.x,
                                    y: this.y,
                                    vx: Math.cos(spreadAngle) * 6,
                                    vy: Math.sin(spreadAngle) * 6,
                                    damage: 0.5,
                                    range: 350,
                                    type: 'bullet',
                                    owner: 'enemy'
                                }));
                            }, s * 80);
                        }
                        this.attackCooldown = 110;
                    } else {
                        // Tail Sweep
                        audio.play('boss_scream');
                        spawnExplosion(this.x, this.y, 60);
                        if (dist < 90) {
                            player.takeDamage(1);
                            // Push back
                            player.x += (dx / dist) * 25;
                            player.y += (dy / dist) * 25;
                        }
                        for (let i = 0; i < 10; i++) {
                            const angle = (Math.PI * 2 / 10) * i;
                            projectiles.push(new Projectile({
                                x: this.x,
                                y: this.y,
                                vx: Math.cos(angle) * 5,
                                vy: Math.sin(angle) * 5,
                                damage: 0.5,
                                range: 300,
                                type: 'bullet',
                                owner: 'enemy'
                            }));
                        }
                        this.attackCooldown = 80;
                    }
                }
            } else {
                // MAGMA TITAN: Magma Slam and Lava Burst
                if (dist > 90) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                }
                
                this.attackCooldown--;
                if (this.attackCooldown <= 0) {
                    const r = Math.random();
                    if (r < 0.5) {
                        // Magma Slam
                        audio.play('boss_scream');
                        spawnExplosion(this.x, this.y, 90);
                        if (dist < 110) {
                            player.takeDamage(1);
                        }
                        // Fire shockwaves in 3 random angles
                        for (let i = 0; i < 3; i++) {
                            const baseAngle = Math.random() * Math.PI * 2;
                            for (let j = -1; j <= 1; j++) {
                                const angle = baseAngle + j * 0.2;
                                projectiles.push(new Projectile({
                                    x: this.x,
                                    y: this.y,
                                    vx: Math.cos(angle) * 4.5,
                                    vy: Math.sin(angle) * 4.5,
                                    damage: 0.5,
                                    range: 250,
                                    type: 'bullet',
                                    owner: 'enemy'
                                }));
                            }
                        }
                        this.attackCooldown = 110;
                    } else {
                        // Large Exploding Lava Burst
                        audio.play('boss_scream');
                        const angle = Math.atan2(dy, dx);
                        projectiles.push(new Projectile({
                            x: this.x,
                            y: this.y,
                            vx: Math.cos(angle) * 3.5,
                            vy: Math.sin(angle) * 3.5,
                            damage: 1.5,
                            range: 400,
                            type: 'magic', // Magic has splash explosion!
                            owner: 'enemy'
                        }));
                        this.attackCooldown = 90;
                    }
                }
            }

        } else {
            if (this.bossVariant === 0) {
                // THE VOID EYE: Ultimate spiral bullet hell
                this.attackCooldown--;

                // Float slowly in center mostly
                const cx = 400;
                const cy = 300;
                const cdx = cx - this.x;
                const cdy = cy - this.y;
                const cdist = Math.sqrt(cdx*cdx + cdy*cdy);
                if (cdist > 30) {
                    this.x += (cdx / cdist) * currentSpeed * 0.5;
                    this.y += (cdy / cdist) * currentSpeed * 0.5;
                }

                if (this.attackCooldown <= 0) {
                    audio.play('boss_scream');
                    // Spiral patterns: fire streams of bullets spinning
                    const steps = this.phase === 2 ? 30 : 20;
                    for (let s = 0; s < steps; s++) {
                        setTimeout(() => {
                            if (this.health <= 0) return;
                            const baseAngle = (s * 0.25) + (this.phase === 2 ? s * 0.1 : 0);
                            
                            // Fire 4-way cross rotating
                            for (let d = 0; d < 4; d++) {
                                const angle = baseAngle + (Math.PI / 2) * d;
                                projectiles.push(new Projectile({
                                    x: this.x,
                                    y: this.y,
                                    vx: Math.cos(angle) * 4.5,
                                    vy: Math.sin(angle) * 4.5,
                                    damage: 1,
                                    range: 450,
                                    type: 'bullet',
                                    owner: 'enemy'
                                }));
                            }
                        }, s * 60);
                    }
                    this.attackCooldown = this.phase === 2 ? 220 : 300;
                }
            } else if (this.bossVariant === 1) {
                // COSMIC HORROR: Tentacle Slams and Void Ring
                if (dist > 150) {
                    this.x += (dx / dist) * currentSpeed * 0.8;
                    this.y += (dy / dist) * currentSpeed * 0.8;
                }
                
                this.attackCooldown--;
                if (this.attackCooldown <= 0) {
                    const r = Math.random();
                    if (r < 0.55) {
                        // Tentacle Slam series near player
                        audio.play('boss_scream');
                        for (let i = 0; i < 4; i++) {
                            const tx = player.x + (Math.random() - 0.5) * 80;
                            const ty = player.y + (Math.random() - 0.5) * 80;
                            setTimeout(() => {
                                if (this.health <= 0) return;
                                spawnExplosion(tx, ty, 50);
                                const pdx = player.x - tx;
                                const pdy = player.y - ty;
                                const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
                                if (pdist < 40) {
                                    player.takeDamage(1);
                                }
                            }, i * 150);
                        }
                        this.attackCooldown = 130;
                    } else {
                        // Void Ring of 16 bullets
                        audio.play('boss_scream');
                        const count = 16;
                        for (let i = 0; i < count; i++) {
                            const angle = (Math.PI * 2 / count) * i;
                            projectiles.push(new Projectile({
                                x: this.x,
                                y: this.y,
                                vx: Math.cos(angle) * 4,
                                vy: Math.sin(angle) * 4,
                                damage: 1,
                                range: 400,
                                type: 'bullet',
                                owner: 'enemy'
                            }));
                        }
                        this.attackCooldown = 120;
                    }
                }
            } else {
                // SHADOW OVERLORD: Shadow Blast and Clones
                if (dist > 180) {
                    this.x += (dx / dist) * currentSpeed;
                    this.y += (dy / dist) * currentSpeed;
                } else if (dist < 120) {
                    this.x -= (dx / dist) * currentSpeed;
                    this.y -= (dy / dist) * currentSpeed;
                }
                
                this.attackCooldown--;
                if (this.attackCooldown <= 0) {
                    const r = Math.random();
                    if (r < 0.6 && currentRoom.mobs.length < 4) {
                        // Spawn shadow shooter clones
                        audio.play('boss_scream');
                        spawnSmoke(this.x - 40, this.y, 8);
                        spawnSmoke(this.x + 40, this.y, 8);
                        spawnFloatingText(this.x, this.y - 30, "CLONES!", '#581c87', 14);
                        currentRoom.mobs.push(new Enemy(this.x - 40, this.y, 'shooter', this.level * 0.5));
                        currentRoom.mobs.push(new Enemy(this.x + 40, this.y, 'shooter', this.level * 0.5));
                        this.attackCooldown = 180;
                    } else {
                        // Shadow Blast rapid stream of 6 bullets
                        audio.play('boss_scream');
                        for (let s = 0; s < 6; s++) {
                            setTimeout(() => {
                                if (this.health <= 0) return;
                                const adx = player.x - this.x;
                                const ady = player.y - this.y;
                                const adist = Math.sqrt(adx*adx + ady*ady);
                                if (adist > 0) {
                                    projectiles.push(new Projectile({
                                        x: this.x,
                                        y: this.y,
                                        vx: (adx / adist) * 6,
                                        vy: (ady / adist) * 6,
                                        damage: 0.5,
                                        range: 450,
                                        type: 'bullet',
                                        owner: 'enemy'
                                    }));
                                }
                            }, s * 100);
                        }
                        this.attackCooldown = 140;
                    }
                }
            }
        }

        // Keep inside bounds strictly
        const wallMinX = 64 + this.radius;
        const wallMaxX = 736 - this.radius;
        const wallMinY = 64 + this.radius;
        const wallMaxY = 536 - this.radius;

        this.x = Math.max(wallMinX, Math.min(wallMaxX, this.x));
        this.y = Math.max(wallMinY, Math.min(wallMaxY, this.y));

        // Touch damage to player (only if not jumping)
        if (!this.isJumping && dist < this.radius + player.radius) {
            player.takeDamage(this.damage);
        }
    }

    draw(ctx) {
        ctx.save();

        const wobble = Math.sin(Date.now() * 0.005) * 4;
        const bossIndex = Math.min(this.level - 1, 4);
        let yOffset = wobble;

        if (this.isJumping && bossIndex === 0) {
            const airScale = 1 - (this.jumpTimer / 45); // 0 to 1 back to 0
            yOffset = -Math.sin(airScale * Math.PI) * 40;

            // Draw shadow larger/smaller depending on air status
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.beginPath();
            ctx.arc(this.x, this.y + this.radius - 2, this.radius * (1.2 - airScale * 0.4), 0, Math.PI*2);
            ctx.fill();
        } else {
            // Regular boss shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(this.x, this.y + this.radius - 2, this.radius * 0.9, 0, Math.PI*2);
            ctx.fill();
        }

        // Draw Boss Vector Body
        if (bossIndex === 0) {
            if (this.bossVariant === 0) {
                // THE GOLEM
                // Shoulders
                ctx.fillStyle = '#334155';
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x - 30, this.y + yOffset + 5, 14, 0, Math.PI * 2);
                ctx.arc(this.x + 30, this.y + yOffset + 5, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Main body (Rocky plate)
                ctx.fillStyle = '#475569';
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.roundRect(this.x - 26, this.y + yOffset - 25, 52, 50, 12);
                ctx.fill();
                ctx.stroke();

                // Glowing cracks
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = 2.5;
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#06b6d4';
                ctx.beginPath();
                ctx.moveTo(this.x - 12, this.y + yOffset - 10);
                ctx.lineTo(this.x - 4, this.y + yOffset + 2);
                ctx.lineTo(this.x - 14, this.y + yOffset + 14);
                ctx.moveTo(this.x + 15, this.y + yOffset - 15);
                ctx.lineTo(this.x + 8, this.y + yOffset - 2);
                ctx.lineTo(this.x + 12, this.y + yOffset + 10);
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Glowing Blue Eyes
                ctx.fillStyle = '#22d3ee';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#22d3ee';
                ctx.beginPath();
                ctx.arc(this.x - 9, this.y + yOffset - 8, 3.5, 0, Math.PI*2);
                ctx.arc(this.x + 9, this.y + yOffset - 8, 3.5, 0, Math.PI*2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Rocky brow
                ctx.fillStyle = '#334155';
                ctx.fillRect(this.x - 14, this.y + yOffset - 15, 28, 4);

                // Fists
                const fistSwing = Math.sin(Date.now() * 0.007) * 5;
                ctx.fillStyle = '#334155';
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(this.x - 32, this.y + yOffset + 20 + fistSwing, 10, 0, Math.PI * 2);
                ctx.arc(this.x + 32, this.y + yOffset + 20 - fistSwing, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else if (this.bossVariant === 1) {
                // GIANT SPIDER
                const legOsc = Math.sin(Date.now() * 0.012) * 5;
                ctx.strokeStyle = '#052e16';
                ctx.lineWidth = 3;
                
                // Draw 8 jointed spider legs
                for (let i = 0; i < 4; i++) {
                    // Left legs
                    ctx.beginPath();
                    ctx.moveTo(this.x - 10, this.y + yOffset);
                    const lX1 = this.x - 35 - i * 5;
                    const lY1 = this.y + yOffset - 20 + i * 15 + legOsc * (i % 2 === 0 ? 1 : -1);
                    ctx.lineTo(lX1, lY1);
                    ctx.lineTo(lX1 - 15, lY1 + 25);
                    ctx.stroke();

                    // Right legs
                    ctx.beginPath();
                    ctx.moveTo(this.x + 10, this.y + yOffset);
                    const rX1 = this.x + 35 + i * 5;
                    const rY1 = this.y + yOffset - 20 + i * 15 - legOsc * (i % 2 === 0 ? 1 : -1);
                    ctx.lineTo(rX1, rY1);
                    ctx.lineTo(rX1 + 15, rY1 + 25);
                    ctx.stroke();
                }

                // Abdomen (Large rear bulb)
                ctx.fillStyle = '#166534';
                ctx.strokeStyle = '#14532d';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset + 18, 22, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();

                // Thorax (Middle section)
                ctx.fillStyle = '#14532d';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset - 2, 14, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();

                // Pincers / Chelicerae
                ctx.fillStyle = '#166534';
                ctx.beginPath();
                ctx.moveTo(this.x - 6, this.y + yOffset - 12);
                ctx.quadraticCurveTo(this.x - 10, this.y + yOffset - 24, this.x - 4, this.y + yOffset - 28);
                ctx.quadraticCurveTo(this.x - 2, this.y + yOffset - 22, this.x - 2, this.y + yOffset - 12);
                ctx.moveTo(this.x + 6, this.y + yOffset - 12);
                ctx.quadraticCurveTo(this.x + 10, this.y + yOffset - 24, this.x + 4, this.y + yOffset - 28);
                ctx.quadraticCurveTo(this.x + 2, this.y + yOffset - 22, this.x + 2, this.y + yOffset - 12);
                ctx.fill();

                // Eyes (8 glowing red dots)
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                for (let e = 0; e < 4; e++) {
                    ctx.arc(this.x - 6 + e * 4, this.y + yOffset - 14, 1.8, 0, Math.PI*2);
                    ctx.arc(this.x - 4 + e * 3, this.y + yOffset - 10, 1.2, 0, Math.PI*2);
                }
                ctx.fill();
            } else {
                // ANCIENT TREANT
                const sway = Math.sin(Date.now() * 0.003) * 0.05;
                ctx.save();
                ctx.translate(this.x, this.y + yOffset);
                ctx.rotate(sway);

                // Roots
                ctx.fillStyle = '#451a03';
                ctx.fillRect(-22, 20, 44, 8);
                ctx.beginPath();
                ctx.arc(-16, 24, 6, 0, Math.PI, false);
                ctx.arc(16, 24, 6, 0, Math.PI, false);
                ctx.fill();

                // Trunk
                ctx.fillStyle = '#854d0e';
                ctx.strokeStyle = '#451a03';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.roundRect(-18, -30, 36, 52, 6);
                ctx.fill();
                ctx.stroke();

                // Hollow chest with glowing orange eyes
                ctx.fillStyle = '#451a03';
                ctx.beginPath();
                ctx.ellipse(0, -6, 8, 12, 0, 0, Math.PI*2);
                ctx.fill();
                
                ctx.fillStyle = '#ea580c';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#ea580c';
                ctx.beginPath();
                ctx.arc(-3, -6, 2, 0, Math.PI*2);
                ctx.arc(3, -6, 2, 0, Math.PI*2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Canopy (Leaves)
                ctx.fillStyle = '#15803d';
                ctx.strokeStyle = '#166534';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(-14, -36, 16, 0, Math.PI*2);
                ctx.arc(14, -36, 16, 0, Math.PI*2);
                ctx.arc(0, -45, 20, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();

                // Gold flowers
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(-10, -18, 3, 0, Math.PI*2);
                ctx.arc(12, -10, 3, 0, Math.PI*2);
                ctx.fill();

                ctx.restore();
            }

        } else if (bossIndex === 1) {
            if (this.bossVariant === 0) {
                // SHADOW KNIGHT
                const capeWarp = Math.sin(Date.now() * 0.01) * 6;
                ctx.fillStyle = '#6b21a8';
                ctx.beginPath();
                ctx.moveTo(this.x - 15, this.y + yOffset + 10);
                ctx.bezierCurveTo(this.x - 45 + capeWarp, this.y + yOffset + 35, this.x - 30 + capeWarp, this.y + yOffset + 50, this.x - 5, this.y + yOffset + 25);
                ctx.moveTo(this.x + 15, this.y + yOffset + 10);
                ctx.bezierCurveTo(this.x + 45 + capeWarp, this.y + yOffset + 35, this.x + 30 + capeWarp, this.y + yOffset + 50, this.x + 5, this.y + yOffset + 25);
                ctx.fill();

                // Shoulders
                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(this.x - 22, this.y + yOffset - 12);
                ctx.lineTo(this.x - 35, this.y + yOffset - 28);
                ctx.lineTo(this.x - 14, this.y + yOffset - 8);
                ctx.closePath();
                ctx.moveTo(this.x + 22, this.y + yOffset - 12);
                ctx.lineTo(this.x + 35, this.y + yOffset - 28);
                ctx.lineTo(this.x + 14, this.y + yOffset - 8);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Helmet
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset - 6, 20, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Gold trim crest
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset - 6, 20, -Math.PI * 0.75, -Math.PI * 0.25);
                ctx.stroke();

                // Glowing red visor slit
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 4;
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#ef4444';
                ctx.beginPath();
                ctx.moveTo(this.x - 12, this.y + yOffset - 4);
                ctx.lineTo(this.x + 12, this.y + yOffset - 4);
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Horn detail
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.moveTo(this.x - 6, this.y + yOffset - 26);
                ctx.lineTo(this.x, this.y + yOffset - 38);
                ctx.lineTo(this.x + 6, this.y + yOffset - 26);
                ctx.closePath();
                ctx.fill();
            } else if (this.bossVariant === 1) {
                // PHANTOM WITCH
                const hatOsc = Math.sin(Date.now() * 0.006) * 3;
                
                // Long purple cape/dress
                ctx.fillStyle = '#6b21a8';
                ctx.beginPath();
                ctx.moveTo(this.x - 16, this.y + yOffset);
                ctx.lineTo(this.x - 28, this.y + yOffset + 38);
                ctx.lineTo(this.x + 28, this.y + yOffset + 38);
                ctx.lineTo(this.x + 16, this.y + yOffset);
                ctx.closePath();
                ctx.fill();

                // Gold star symbols on robe
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.arc(this.x - 10, this.y + yOffset + 24, 2, 0, Math.PI*2);
                ctx.arc(this.x + 12, this.y + yOffset + 18, 2, 0, Math.PI*2);
                ctx.arc(this.x, this.y + yOffset + 28, 2, 0, Math.PI*2);
                ctx.fill();

                // Pale Face mask
                ctx.fillStyle = '#faf5ff';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset - 6, 14, 0, Math.PI*2);
                ctx.fill();

                // Glowing yellow witch eyes
                ctx.fillStyle = '#eab308';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#fbbf24';
                ctx.beginPath();
                ctx.arc(this.x - 4, this.y + yOffset - 7, 2, 0, Math.PI*2);
                ctx.arc(this.x + 4, this.y + yOffset - 7, 2, 0, Math.PI*2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Pointy Witch Hat
                ctx.fillStyle = '#4c1d95';
                ctx.strokeStyle = '#2e1065';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(this.x - 22, this.y + yOffset - 12 + hatOsc * 0.5);
                ctx.lineTo(this.x + 22, this.y + yOffset - 12 + hatOsc * 0.5);
                ctx.lineTo(this.x + 2, this.y + yOffset - 36 + hatOsc);
                ctx.lineTo(this.x - 6, this.y + yOffset - 30 + hatOsc);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Hat brim
                ctx.fillRect(this.x - 26, this.y + yOffset - 15 + hatOsc * 0.5, 52, 4);

                // Orbiting Arcane Runes
                const runeTime = Date.now() * 0.003;
                ctx.fillStyle = '#c084fc';
                ctx.shadowBlur = 6;
                ctx.shadowColor = '#c084fc';
                for (let i = 0; i < 3; i++) {
                    const angle = runeTime + (Math.PI * 2 / 3) * i;
                    const rx = this.x + Math.cos(angle) * 26;
                    const ry = this.y + yOffset - 5 + Math.sin(angle) * 10;
                    ctx.beginPath();
                    ctx.arc(rx, ry, 2.5, 0, Math.PI*2);
                    ctx.fill();
                }
                ctx.shadowBlur = 0;
            } else {
                // DARK GARGOYLE
                const wingScale = 1.0 + Math.sin(Date.now() * 0.016) * 0.15;
                ctx.fillStyle = '#374151'; // Charcoal stone grey
                ctx.strokeStyle = '#1f2937';
                ctx.lineWidth = 2.5;

                // Left wing (slow flapping)
                ctx.beginPath();
                ctx.moveTo(this.x - 8, this.y + yOffset - 4);
                ctx.bezierCurveTo(this.x - 45 * wingScale, this.y + yOffset - 28, this.x - 50 * wingScale, this.y + yOffset + 10, this.x - 14, this.y + yOffset + 18);
                ctx.fill();
                ctx.stroke();

                // Right wing (slow flapping)
                ctx.beginPath();
                ctx.moveTo(this.x + 8, this.y + yOffset - 4);
                ctx.bezierCurveTo(this.x + 45 * wingScale, this.y + yOffset - 28, this.x + 50 * wingScale, this.y + yOffset + 10, this.x + 14, this.y + yOffset + 18);
                ctx.fill();
                ctx.stroke();

                // Gargoyle head & stone spikes
                ctx.fillStyle = '#4b5563';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset - 6, 18, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();

                // Stone horns
                ctx.fillStyle = '#1f2937';
                ctx.beginPath();
                ctx.moveTo(this.x - 14, this.y + yOffset - 16);
                ctx.lineTo(this.x - 22, this.y + yOffset - 32);
                ctx.lineTo(this.x - 6, this.y + yOffset - 20);
                ctx.closePath();
                ctx.moveTo(this.x + 14, this.y + yOffset - 16);
                ctx.lineTo(this.x + 22, this.y + yOffset - 32);
                ctx.lineTo(this.x + 6, this.y + yOffset - 20);
                ctx.closePath();
                ctx.fill();

                // Glowing ruby red eyes
                ctx.fillStyle = '#dc2626';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ef4444';
                ctx.beginPath();
                ctx.arc(this.x - 5, this.y + yOffset - 6, 2.5, 0, Math.PI*2);
                ctx.arc(this.x + 5, this.y + yOffset - 6, 2.5, 0, Math.PI*2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

        } else if (bossIndex === 2) {
            if (this.bossVariant === 0) {
                // NECROMANCER
                const robeWave = Math.sin(Date.now() * 0.007) * 4;
                ctx.fillStyle = '#064e3b';
                ctx.beginPath();
                ctx.moveTo(this.x - 22, this.y + yOffset + 5);
                ctx.quadraticCurveTo(this.x - 30, this.y + yOffset + 25, this.x - 20, this.y + yOffset + 35);
                ctx.lineTo(this.x - 10 + robeWave, this.y + yOffset + 28);
                ctx.lineTo(this.x + robeWave, this.y + yOffset + 35);
                ctx.lineTo(this.x + 10 - robeWave, this.y + yOffset + 28);
                ctx.lineTo(this.x + 20, this.y + yOffset + 35);
                ctx.quadraticCurveTo(this.x + 30, this.y + yOffset + 25, this.x + 22, this.y + yOffset + 5);
                ctx.closePath();
                ctx.fill();

                // Skull Hood inside
                ctx.fillStyle = '#022c22';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset - 8, 16, 0, Math.PI * 2);
                ctx.fill();

                // Skull Mask
                ctx.fillStyle = '#f1f5f9';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset - 8, 12, 0, Math.PI * 2);
                ctx.fill();

                // Sockets
                ctx.fillStyle = '#022c22';
                ctx.beginPath();
                ctx.arc(this.x - 4, this.y + yOffset - 9, 3, 0, Math.PI * 2);
                ctx.arc(this.x + 4, this.y + yOffset - 9, 3, 0, Math.PI * 2);
                ctx.fill();

                // Glowing green eyes
                ctx.fillStyle = '#22c55e';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#22c55e';
                ctx.beginPath();
                ctx.arc(this.x - 4, this.y + yOffset - 9, 1.5, 0, Math.PI * 2);
                ctx.arc(this.x + 4, this.y + yOffset - 9, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Nose
                ctx.fillStyle = '#022c22';
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + yOffset - 6);
                ctx.lineTo(this.x - 1.5, this.y + yOffset - 3);
                ctx.lineTo(this.x + 1.5, this.y + yOffset - 3);
                ctx.closePath();
                ctx.fill();
                
                // Teeth
                ctx.strokeStyle = '#022c22';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(this.x - 4, this.y + yOffset - 1);
                ctx.lineTo(this.x + 4, this.y + yOffset - 1);
                ctx.moveTo(this.x - 3, this.y + yOffset - 3);
                ctx.lineTo(this.x - 3, this.y + yOffset);
                ctx.moveTo(this.x, this.y + yOffset - 3);
                ctx.lineTo(this.x, this.y + yOffset);
                ctx.moveTo(this.x + 3, this.y + yOffset - 3);
                ctx.lineTo(this.x + 3, this.y + yOffset);
                ctx.stroke();

                // Staff
                const staffOsc = Math.sin(Date.now() * 0.005) * 6;
                ctx.fillStyle = '#451a03';
                ctx.fillRect(this.x + 24, this.y + yOffset - 25 + staffOsc, 4, 60);

                // Staff ornament
                ctx.fillStyle = '#eab308';
                ctx.beginPath();
                ctx.arc(this.x + 26, this.y + yOffset - 27 + staffOsc, 7, 0, Math.PI, true);
                ctx.fill();

                // Green flame
                ctx.fillStyle = '#22c55e';
                ctx.shadowBlur = 12;
                ctx.shadowColor = '#22c55e';
                ctx.beginPath();
                ctx.arc(this.x + 26, this.y + yOffset - 34 + staffOsc, 5 + Math.sin(Date.now() * 0.02) * 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Skeletal Hands
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(this.x - 22, this.y + yOffset + 8, 5, 8);
                ctx.fillRect(this.x + 18, this.y + yOffset + 8 + staffOsc, 5, 8);
            } else if (this.bossVariant === 1) {
                // BONE COLOSSUS
                const bOsc = Math.sin(Date.now() * 0.008) * 3;
                
                // Giant Ribcage torso
                ctx.fillStyle = '#d6d3d1';
                ctx.strokeStyle = '#78716c';
                ctx.lineWidth = 2.5;

                ctx.beginPath();
                ctx.roundRect(this.x - 24, this.y + yOffset - 8, 48, 16, 6);
                ctx.fill();
                ctx.stroke();

                // Ribs lines
                ctx.strokeStyle = '#57534e';
                ctx.lineWidth = 2;
                for (let r = 0; r < 3; r++) {
                    ctx.beginPath();
                    ctx.moveTo(this.x - 20, this.y + yOffset - 4 + r * 6);
                    ctx.lineTo(this.x + 20, this.y + yOffset - 4 + r * 6);
                    ctx.stroke();
                }

                // Broad shoulder plates
                ctx.fillStyle = '#a8a29e';
                ctx.fillRect(this.x - 32, this.y + yOffset - 16, 12, 10);
                ctx.fillRect(this.x + 20, this.y + yOffset - 16, 12, 10);

                // Giant cracked skull
                ctx.fillStyle = '#d6d3d1';
                ctx.strokeStyle = '#78716c';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset - 24, 16, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();

                // Crack line
                ctx.strokeStyle = '#78716c';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(this.x - 4, this.y + yOffset - 38);
                ctx.lineTo(this.x - 2, this.y + yOffset - 28);
                ctx.lineTo(this.x + 6, this.y + yOffset - 24);
                ctx.stroke();

                // Glowing yellow eye hollows
                ctx.fillStyle = '#ca8a04';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#facc15';
                ctx.beginPath();
                ctx.arc(this.x - 5, this.y + yOffset - 24, 3, 0, Math.PI*2);
                ctx.arc(this.x + 5, this.y + yOffset - 24, 3, 0, Math.PI*2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Giant Bone Club
                ctx.save();
                ctx.translate(this.x + 28, this.y + yOffset + 4 + bOsc);
                ctx.rotate(0.2);
                ctx.fillStyle = '#e7e5e4';
                ctx.strokeStyle = '#a8a29e';
                ctx.lineWidth = 1.5;
                ctx.fillRect(-5, -35, 10, 42); // club handle
                ctx.beginPath();
                ctx.arc(0, -35, 10, 0, Math.PI*2); // club head
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            } else {
                // PLAGUE DOCTOR
                const bob = Math.sin(Date.now() * 0.007) * 3;
                
                // Dark coat
                ctx.fillStyle = '#1e3a1e';
                ctx.strokeStyle = '#052e16';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.roundRect(this.x - 20, this.y + yOffset - 6, 40, 42, 8);
                ctx.fill();
                ctx.stroke();

                // White bird beak plague mask
                ctx.fillStyle = '#faf5ff';
                ctx.strokeStyle = '#d8b4fe';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset - 16, 12, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();

                // Beak
                ctx.fillStyle = '#e9d5ff';
                ctx.beginPath();
                ctx.moveTo(this.x - 2, this.y + yOffset - 12);
                ctx.lineTo(this.x, this.y + yOffset + 2); // tip
                ctx.lineTo(this.x + 6, this.y + yOffset - 12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Goggles (red lens)
                ctx.fillStyle = '#ef4444';
                ctx.shadowBlur = 6;
                ctx.shadowColor = '#ef4444';
                ctx.beginPath();
                ctx.arc(this.x - 4, this.y + yOffset - 18, 3, 0, Math.PI*2);
                ctx.arc(this.x + 4, this.y + yOffset - 18, 3, 0, Math.PI*2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Wide doctor hat
                ctx.fillStyle = '#111827';
                ctx.fillRect(this.x - 25, this.y + yOffset - 28, 50, 4); // brim
                ctx.fillRect(this.x - 15, this.y + yOffset - 38, 30, 10); // cap

                // Toxic flask on belt
                ctx.fillStyle = '#22c55e';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#22c55e';
                ctx.beginPath();
                ctx.roundRect(this.x - 14, this.y + yOffset + 12 + bob, 6, 10, 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

        } else if (bossIndex === 3) {
            if (this.bossVariant === 0) {
                // FIRE DEMON
                const wingScale = 1.0 + Math.sin(Date.now() * 0.015) * 0.12;

                // Left wing
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.moveTo(this.x - 10, this.y + yOffset + 5);
                ctx.bezierCurveTo(this.x - 45 * wingScale, this.y + yOffset - 25, this.x - 55 * wingScale, this.y + yOffset + 15, this.x - 15, this.y + yOffset + 20);
                ctx.fill();
                ctx.fillStyle = '#f97316';
                ctx.beginPath();
                ctx.moveTo(this.x - 10, this.y + yOffset + 5);
                ctx.bezierCurveTo(this.x - 35 * wingScale, this.y + yOffset - 15, this.x - 45 * wingScale, this.y + yOffset + 10, this.x - 15, this.y + yOffset + 15);
                ctx.fill();

                // Right wing
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.moveTo(this.x + 10, this.y + yOffset + 5);
                ctx.bezierCurveTo(this.x + 45 * wingScale, this.y + yOffset - 25, this.x + 55 * wingScale, this.y + yOffset + 15, this.x + 15, this.y + yOffset + 20);
                ctx.fill();
                ctx.fillStyle = '#f97316';
                ctx.beginPath();
                ctx.moveTo(this.x + 10, this.y + yOffset + 5);
                ctx.bezierCurveTo(this.x + 35 * wingScale, this.y + yOffset - 15, this.x + 45 * wingScale, this.y + yOffset + 10, this.x + 15, this.y + yOffset + 15);
                ctx.fill();

                // Body
                ctx.fillStyle = '#b91c1c';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset, 24, 0, Math.PI * 2);
                ctx.fill();

                // Horns
                ctx.fillStyle = '#450a0a';
                ctx.beginPath();
                ctx.moveTo(this.x - 16, this.y + yOffset - 14);
                ctx.quadraticCurveTo(this.x - 30, this.y + yOffset - 32, this.x - 22, this.y + yOffset - 42);
                ctx.quadraticCurveTo(this.x - 18, this.y + yOffset - 30, this.x - 8, this.y + yOffset - 22);
                ctx.closePath();
                ctx.moveTo(this.x + 16, this.y + yOffset - 14);
                ctx.quadraticCurveTo(this.x + 30, this.y + yOffset - 32, this.x + 22, this.y + yOffset - 42);
                ctx.quadraticCurveTo(this.x + 18, this.y + yOffset - 30, this.x + 8, this.y + yOffset - 22);
                ctx.closePath();
                ctx.fill();

                // Glowing yellow eyes
                ctx.fillStyle = '#f59e0b';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#f59e0b';
                ctx.beginPath();
                ctx.moveTo(this.x - 12, this.y + yOffset - 8);
                ctx.lineTo(this.x - 2, this.y + yOffset - 5);
                ctx.lineTo(this.x - 10, this.y + yOffset - 2);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(this.x + 12, this.y + yOffset - 8);
                ctx.lineTo(this.x + 2, this.y + yOffset - 5);
                ctx.lineTo(this.x + 10, this.y + yOffset - 2);
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;

                // Mouth
                ctx.strokeStyle = '#450a0a';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(this.x - 8, this.y + yOffset + 6);
                ctx.lineTo(this.x + 8, this.y + yOffset + 6);
                ctx.stroke();
                // Fangs
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(this.x - 5, this.y + yOffset + 6);
                ctx.lineTo(this.x - 3, this.y + yOffset + 11);
                ctx.lineTo(this.x - 1, this.y + yOffset + 6);
                ctx.moveTo(this.x + 1, this.y + yOffset + 6);
                ctx.lineTo(this.x + 3, this.y + yOffset + 11);
                ctx.lineTo(this.x + 5, this.y + yOffset + 6);
                ctx.fill();
            } else if (this.bossVariant === 1) {
                // INFERNAL DRAKE
                const tOsc = Math.sin(Date.now() * 0.015) * 8;
                ctx.fillStyle = '#ea580c'; // Bright magma orange scales
                ctx.strokeStyle = '#7c2d12';
                ctx.lineWidth = 2.5;

                // Wing left
                ctx.beginPath();
                ctx.moveTo(this.x - 12, this.y + yOffset);
                ctx.lineTo(this.x - 45, this.y + yOffset - 22);
                ctx.lineTo(this.x - 35, this.y + yOffset + 14);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Wing right
                ctx.beginPath();
                ctx.moveTo(this.x + 12, this.y + yOffset);
                ctx.lineTo(this.x + 45, this.y + yOffset - 22);
                ctx.lineTo(this.x + 35, this.y + yOffset + 14);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Dragon Tail (behind body)
                ctx.strokeStyle = '#ea580c';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + yOffset + 15);
                ctx.quadraticCurveTo(this.x - 22, this.y + yOffset + 35, this.x - 18 + tOsc, this.y + yOffset + 48);
                ctx.stroke();
                
                // Flame tip on tail
                ctx.fillStyle = '#f59e0b';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ea580c';
                ctx.beginPath();
                ctx.arc(this.x - 18 + tOsc, this.y + yOffset + 48, 6, 0, Math.PI*2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Reptilian Head
                ctx.fillStyle = '#ea580c';
                ctx.beginPath();
                ctx.ellipse(this.x, this.y + yOffset - 6, 18, 14, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();

                // Glowing orange eyes
                ctx.fillStyle = '#fef08a';
                ctx.beginPath();
                ctx.arc(this.x - 6, this.y + yOffset - 8, 2.5, 0, Math.PI*2);
                ctx.arc(this.x + 6, this.y + yOffset - 8, 2.5, 0, Math.PI*2);
                ctx.fill();
            } else {
                // MAGMA TITAN
                const crackWobble = Math.sin(Date.now() * 0.008) * 1.5;
                ctx.fillStyle = '#1c1917'; // Scorched obsidian black stone chunks
                ctx.strokeStyle = '#ca8a04'; // glowing lava crack borders
                ctx.lineWidth = 2.5;

                // Titan heavy rocky body
                ctx.beginPath();
                ctx.roundRect(this.x - 30, this.y + yOffset - 30, 60, 60, 10);
                ctx.fill();
                ctx.stroke();

                // Glowing veins of molten lava running across body
                ctx.strokeStyle = '#ea580c';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#ef4444';
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.moveTo(this.x - 20, this.y + yOffset - 15);
                ctx.lineTo(this.x - 10 + crackWobble, this.y + yOffset + 5);
                ctx.lineTo(this.x - 25, this.y + yOffset + 20);
                
                ctx.moveTo(this.x + 20, this.y + yOffset - 20);
                ctx.lineTo(this.x + 12 - crackWobble, this.y + yOffset);
                ctx.lineTo(this.x + 24, this.y + yOffset + 15);
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Head stone chunk
                ctx.fillStyle = '#292524';
                ctx.strokeStyle = '#ea580c';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(this.x - 14, this.y + yOffset - 36, 28, 22, 4);
                ctx.fill();
                ctx.stroke();

                // Molten fire eyes
                ctx.fillStyle = '#fef08a';
                ctx.shadowBlur = 8;
                ctx.shadowColor = '#ea580c';
                ctx.beginPath();
                ctx.arc(this.x - 5, this.y + yOffset - 25, 3, 0, Math.PI*2);
                ctx.arc(this.x + 5, this.y + yOffset - 25, 3, 0, Math.PI*2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }

        } else if (bossIndex === 4) {
            if (this.bossVariant === 0) {
                // THE VOID EYE
                // Orbiting particles
                const orbitTime = Date.now() * 0.002;
                ctx.fillStyle = '#a855f7';
                for (let i = 0; i < 6; i++) {
                    const angle = orbitTime + (Math.PI * 2 / 6) * i;
                    const px = this.x + Math.cos(angle) * (this.radius + 15 + Math.sin(Date.now()*0.005 + i)*5);
                    const py = this.y + yOffset + Math.sin(angle) * (this.radius + 15 + Math.sin(Date.now()*0.005 + i)*5);
                    ctx.beginPath();
                    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Concentric rings
                ctx.strokeStyle = '#6b21a8';
                ctx.lineWidth = 3;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#a855f7';
                const pulse = Math.sin(Date.now() * 0.008) * 4;

                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset, this.radius + pulse, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = '#7e22ce';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset, this.radius - 8 - pulse, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Eyeball
                ctx.fillStyle = '#faf5ff';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset, this.radius - 12, 0, Math.PI * 2);
                ctx.fill();

                // Iris
                ctx.fillStyle = '#a855f7';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset, 14, 0, Math.PI * 2);
                ctx.fill();

                // Pupil
                const dilation = 4.5 + Math.sin(Date.now() * 0.012) * 2;
                ctx.fillStyle = '#22d3ee';
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#22d3ee';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset, dilation, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Highlight
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(this.x - 2, this.y + yOffset - 2, 2.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (this.bossVariant === 1) {
                // COSMIC HORROR
                const horrorTime = Date.now() * 0.0025;
                ctx.fillStyle = '#0f172a'; // Deep space black-purple
                ctx.strokeStyle = '#c084fc'; // neon purple borders
                ctx.lineWidth = 2.5;

                // 6 swaying void tentacles
                for (let i = 0; i < 6; i++) {
                    const baseAngle = (Math.PI * 2 / 6) * i;
                    const swayAngle = baseAngle + Math.sin(horrorTime + i * 1.5) * 0.35;
                    ctx.save();
                    ctx.translate(this.x, this.y + yOffset);
                    ctx.rotate(swayAngle);
                    
                    ctx.fillStyle = '#0f172a';
                    ctx.strokeStyle = '#a855f7';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.quadraticCurveTo(15, -25, 10, -50);
                    ctx.quadraticCurveTo(0, -25, 0, 0);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                }

                // Dark core vortex
                ctx.fillStyle = '#030712';
                ctx.strokeStyle = '#581c87';
                ctx.lineWidth = 4;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#a855f7';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset, 20, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Central Cosmic eye
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset, 8, 0, Math.PI*2);
                ctx.fill();
            } else {
                // SHADOW OVERLORD
                const rip = Math.sin(Date.now() * 0.01) * 5;
                
                // Shadow cape flowing
                ctx.fillStyle = '#1e1b4b'; // ultra dark shadow blue
                ctx.beginPath();
                ctx.moveTo(this.x - 14, this.y + yOffset + 5);
                ctx.quadraticCurveTo(this.x - 40 + rip, this.y + yOffset + 24, this.x - 20, this.y + yOffset + 42);
                ctx.lineTo(this.x + 20, this.y + yOffset + 42);
                ctx.quadraticCurveTo(this.x + 40 - rip, this.y + yOffset + 24, this.x + 14, this.y + yOffset + 5);
                ctx.closePath();
                ctx.fill();

                // Dark Void Robe
                ctx.fillStyle = '#030712';
                ctx.strokeStyle = '#4c1d95';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.roundRect(this.x - 18, this.y + yOffset - 5, 36, 44, 6);
                ctx.fill();
                ctx.stroke();

                // Dark hollow face under crown
                ctx.fillStyle = '#030712';
                ctx.beginPath();
                ctx.arc(this.x, this.y + yOffset - 15, 14, 0, Math.PI*2);
                ctx.fill();

                // Crown of Dark Void Shards
                ctx.fillStyle = '#4c1d95';
                ctx.strokeStyle = '#6d28d9';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(this.x - 16, this.y + yOffset - 24);
                ctx.lineTo(this.x - 12, this.y + yOffset - 36);
                ctx.lineTo(this.x - 6, this.y + yOffset - 28);
                ctx.lineTo(this.x, this.y + yOffset - 44); // central peak
                ctx.lineTo(this.x + 6, this.y + yOffset - 28);
                ctx.lineTo(this.x + 12, this.y + yOffset - 36);
                ctx.lineTo(this.x + 16, this.y + yOffset - 24);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Glowing void cyan eyes
                ctx.fillStyle = '#22d3ee';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#22d3ee';
                ctx.beginPath();
                ctx.arc(this.x - 5, this.y + yOffset - 16, 2.5, 0, Math.PI*2);
                ctx.arc(this.x + 5, this.y + yOffset - 16, 2.5, 0, Math.PI*2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        ctx.restore();
    }

    drawBossHealthBar(ctx) {
        const barW = 400;
        const barH = 14;
        const bx = 400 - barW / 2;
        const by = 560;

        ctx.save();
        // Glass container
        ctx.fillStyle = 'rgba(15, 15, 20, 0.85)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx - 4, by - 4, barW + 8, barH + 8, 6);
        ctx.fill();
        ctx.stroke();

        // Fill background
        ctx.fillStyle = '#450a0a';
        ctx.fillRect(bx, by, barW, barH);

        // Fill current health
        const ratio = Math.max(0, this.health / this.maxHealth);
        const gradient = ctx.createLinearGradient(bx, by, bx + barW, by);
        gradient.addColorStop(0, '#b91c1c');
        gradient.addColorStop(1, '#ef4444');
        ctx.fillStyle = gradient;
        ctx.fillRect(bx, by, barW * ratio, barH);

        // Boss Name Text
        ctx.font = "bold 11px 'Cinzel', serif";
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, 400, by - 8);

        ctx.restore();
    }
}

// Loot and Stat pedestals drops
export class Drop {
    constructor(x, y, type, statType = null) {
        this.x = x;
        this.y = y;
        this.type = type; // 'heart', 'mana', 'coin', 'trophy', 'artifact'
        this.radius = (type === 'trophy' || type === 'artifact') ? 16 : 8;
        this.pickedUp = false;

        // If it's a trophy, assign stat upgrade
        if (type === 'trophy') {
            const stats = [
                { id: 'damage', name: '⚡ POWER STONE', desc: '++ Damage Upgrade', value: 1.0, icon: '💥' },
                { id: 'ats', name: '⌛ COSMIC SAND', desc: '++ Fire Rate Upgrade', value: 0.35, icon: '☄️' },
                { id: 'speed', name: '🥾 WIND BOOTS', desc: '++ Speed Upgrade', value: 0.5, icon: '💨' },
                { id: 'maxHealth', name: '❤️ HEART CONTAINER', desc: '++ Max Health Upgrade', value: 1, icon: '🩸' }
            ];
            
            // Choose random stat boost
            this.trophyData = stats[Math.floor(Math.random() * stats.length)];
        }

        // If it's an artifact, assign the specific artifact data
        if (type === 'artifact') {
            this.artifactData = statType;
        }
    }

    update(player) {
        // If it's a heart and player is at max health, do not pull or pick up
        if (this.type === 'heart' && player.health >= player.maxHealth) {
            return false;
        }

        // Drop magnet pull towards player if within 120px
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (this.type !== 'trophy' && this.type !== 'artifact' && dist < 120) {
            const pullForce = (120 - dist) * 0.05;
            this.x += (dx / dist) * pullForce;
            this.y += (dy / dist) * pullForce;
        }

        // Collision Check with Player
        if (dist < this.radius + player.radius) {
            if (this.type === 'coin') {
                let coinVal = 1;
                if (player.hasArtifact('luck_clover') && Math.random() < 0.15) {
                    coinVal = 2;
                }
                player.coins = (player.coins || 0) + coinVal;
                player.restoreMana(5); // coins double as a tiny mana boost
                spawnSparkles(this.x, this.y, '#f59e0b', 5);
                spawnFloatingText(this.x, this.y, `+${coinVal} Coin`, '#f59e0b', 12);
                this.pickedUp = true;
                audio.play('coin_pickup');
                
                // Immediately update HUD stats panel to reflect coin changes
                if (window.game && typeof window.game.updateHUDStats === 'function') {
                    window.game.updateHUDStats();
                }
                return true;
            } else if (this.type === 'mana') {
                player.restoreMana(35);
                this.pickedUp = true;
                audio.play('pickup');
                return true;
            } else if (this.type === 'heart') {
                // Only pickup heart if damaged (extra safety check)
                if (player.health < player.maxHealth) {
                    player.heal(1);
                    this.pickedUp = true;
                    return true;
                }
            } else if (this.type === 'trophy') {
                // Apply trophy upgrade permanently
                const d = this.trophyData;
                if (d.id === 'maxHealth') {
                    player.addMaxHealth(d.value);
                } else if (d.id === 'damage') {
                    player.damage += d.value;
                    spawnSparkles(player.x, player.y, '#f59e0b', 15);
                    spawnFloatingText(player.x, player.y - 15, `Damage Up! (+${d.value})`, '#f59e0b', 14);
                } else if (d.id === 'ats') {
                    player.attackSpeed += d.value;
                    spawnSparkles(player.x, player.y, '#a855f7', 15);
                    spawnFloatingText(player.x, player.y - 15, `Attack Speed Up! (+35%)`, '#a855f7', 14);
                } else if (d.id === 'speed') {
                    player.speed += d.value;
                    spawnSparkles(player.x, player.y, '#10b981', 15);
                    spawnFloatingText(player.x, player.y - 15, `Speed Up! (+${d.value})`, '#10b981', 14);
                }
                this.pickedUp = true;
                audio.play('gamble_end');
                return true;
            } else if (this.type === 'artifact') {
                player.addArtifact(this.artifactData);
                this.pickedUp = true;
                if (window.game) {
                    window.game.artifactFoundThisLevel = true;
                }
                audio.play('gamble_end');
                spawnSparkles(player.x, player.y, this.artifactData.color || '#a855f7', 20);
                spawnFloatingText(player.x, player.y - 25, `${this.artifactData.name} FOUND!`, this.artifactData.color || '#a855f7', 16, true);
                return true;
            }
        }
        return false;
    }

    draw(ctx) {
        ctx.save();
        const bounce = Math.sin(Date.now() * 0.006) * 3;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.radius - 2, this.radius * 0.8, 0, Math.PI*2);
        ctx.fill();

        ctx.font = `bold ${this.radius * 1.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw thick glowing colored outline to make them notice more easily
        ctx.save();
        ctx.lineWidth = 4;
        if (this.type === 'coin') {
            ctx.strokeStyle = '#fbbf24'; // Golden yellow outline
            ctx.strokeText('🪙', this.x, this.y + bounce);
        } else if (this.type === 'mana') {
            ctx.strokeStyle = '#06b6d4'; // Cyan potion outline
            ctx.strokeText('🧪', this.x, this.y + bounce);
        } else if (this.type === 'heart') {
            ctx.strokeStyle = '#ef4444'; // Red heart outline
            ctx.strokeText('❤️', this.x, this.y + bounce);
        } else if (this.type === 'trophy') {
            ctx.strokeStyle = '#f59e0b'; // Gold trophy outline
            ctx.lineWidth = 5;
            ctx.strokeText(this.trophyData.icon, this.x, this.y - 14 + bounce);
        } else if (this.type === 'artifact') {
            ctx.strokeStyle = '#8b5cf6'; // Violet/purple outline
            ctx.lineWidth = 5;
            ctx.strokeText(this.artifactData.emoji, this.x, this.y - 14 + bounce);
        }
        ctx.restore();

        // Draw main emojis on top of outline
        if (this.type === 'coin') {
            ctx.fillText('🪙', this.x, this.y + bounce);
        } else if (this.type === 'mana') {
            ctx.fillText('🧪', this.x, this.y + bounce);
        } else if (this.type === 'heart') {
            ctx.fillText('❤️', this.x, this.y + bounce);
        } else if (this.type === 'trophy') {
            // Trophy draws an elegant floating golden pedestal with the item above it
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(this.x - 12, this.y + 10, 24, 6); // pedestal base
            ctx.fillRect(this.x - 4, this.y, 8, 10);      // stem
            
            // Draw floating item icon above pedestal
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#f59e0b';
            ctx.fillText(this.trophyData.icon, this.x, this.y - 14 + bounce);
            
            // Floating text indicator
            ctx.font = "9px 'Cinzel', serif";
            ctx.fillStyle = '#f1f5f9';
            ctx.fillText("TROPHY", this.x, this.y + 22);
        } else if (this.type === 'artifact') {
            // Pedestal
            ctx.fillStyle = '#6d28d9';
            ctx.fillRect(this.x - 14, this.y + 10, 28, 6); // pedestal base
            ctx.fillStyle = '#4c1d95';
            ctx.fillRect(this.x - 6, this.y, 12, 10);      // stem
            
            // Draw floating artifact emoji above pedestal
            ctx.shadowBlur = 12;
            ctx.shadowColor = this.artifactData.color || '#a855f7';
            ctx.fillText(this.artifactData.emoji, this.x, this.y - 14 + bounce);
            
            // Floating text indicator
            ctx.font = "9px 'Cinzel', serif";
            ctx.fillStyle = '#e9d5ff';
            ctx.fillText("ARTIFACT", this.x, this.y + 22);
        }

        ctx.restore();
    }
}
