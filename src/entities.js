// Entities for Void Wanderer
// Handles Player, Weapons, Projectiles, Enemies, Bosses, Drops, and Collisions

import { spawnBlood, spawnSparkles, spawnExplosion, spawnFloatingText, spawnSmoke } from './particles.js?v=15';
import { ROOM_TYPES } from './dungeon.js?v=15';
import { audio } from './audio.js?v=15';


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
    }

    takeDamage(amount) {
        if (this.invulnFrames > 0) return false;
        
        this.health -= amount;
        this.invulnFrames = 60; // 1 second of invulnerability
        
        // Shake screen or spawn blood
        spawnBlood(this.x, this.y, 12);
        spawnFloatingText(this.x, this.y - 15, `-${amount} HP`, '#ef4444', 16);
        
        audio.play('player_hit');
        
        // Immediately update health bar
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

        // Attack Cooldown
        if (this.shootCooldown > 0) this.shootCooldown--;

        // Determine speed multiplier (webs slow down player by 50%)
        let speedMultiplier = 1;
        for (const obs of obstacles) {
            if (obs.type === 'web' && !obs.extinguished) {
                const dx = this.x - obs.x;
                const dy = this.y - obs.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < this.radius + obs.width / 2) {
                    speedMultiplier = 0.5;
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
            const actualSpeed = this.speed * speedMultiplier;
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
                    
                    // Normalize difference angle to (-PI, PI)
                    let diffAngle = angleToMob - this.aimAngle;
                    while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
                    while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

                    if (Math.abs(diffAngle) < swingAngle / 2) {
                        // HIT! Apply damage and knockback
                        const kForce = 6;
                        mob.takeDamage(this.damage, Math.cos(angleToMob) * kForce, Math.sin(angleToMob) * kForce);
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
                            proj.damage = this.damage * 0.75;
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
                damage: this.damage * 0.8,
                range: this.range * 1.2,
                type: 'arrow',
                owner: 'player'
            }));

        } else if (this.currentWeapon === 'magic') {
            // Spells cost 20 mana
            if (this.mana < 20) {
                spawnFloatingText(this.x, this.y - 15, "OUT OF MANA!", '#06b6d4', 12);
                return false;
            }

            this.mana -= 20;
            this.manaRegenDelay = 3600; // 1 minute cooldown (60s * 60 FPS)
            this.shootCooldown = cooldownFrames * 1.2;
            if (playAudioCallback) playAudioCallback('spell');

            const speed = 5.5;
            projectiles.push(new Projectile({
                x: this.x,
                y: this.y,
                vx: Math.cos(this.aimAngle) * speed,
                vy: Math.sin(this.aimAngle) * speed,
                damage: this.damage * 1.8, // Magic spell deals heavy splash damage
                range: this.range * 0.9,
                type: 'magic',
                owner: 'player'
            }));
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
        
        // Idle hand position (extends from shoulder towards target)
        // If swinging sword, the hand position matches the swinging arc!
        let handX, handY;
        if (this.currentWeapon === 'sword' && this.swordSlash) {
            const sweep = Math.PI * 0.75;
            const progressRatio = this.swordSlash.progress / this.swordSlash.max;
            const currentAngle = this.swordSlash.angle - sweep / 2 + (sweep * progressRatio);
            handX = this.x + Math.cos(currentAngle) * 24;
            handY = this.y + Math.sin(currentAngle) * 24;
        } else {
            handX = this.x + Math.cos(this.aimAngle) * 16;
            handY = this.y + Math.sin(this.aimAngle) * 16;
        }

        // 1. Draw Resting Arm
        const restingShoulderX = this.x + (isAimingLeft ? 8 : -8);
        const restingShoulderY = this.y + 4;
        const restingHandX = restingShoulderX;
        const restingHandY = this.y + 11;

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

        ctx.fillStyle = '#fed7aa'; // hand
        ctx.beginPath();
        ctx.arc(restingHandX, restingHandY, 2.2, 0, Math.PI*2);
        ctx.fill();

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

        ctx.fillStyle = '#fed7aa'; // active skin hand
        ctx.beginPath();
        ctx.arc(handX, handY, 2.2, 0, Math.PI*2);
        ctx.fill();

        // 3. Draw active weapon in hand
        ctx.save();
        
        if (this.currentWeapon === 'sword') {
            if (this.swordSlash) {
                const sweep = Math.PI * 0.75;
                const progressRatio = this.swordSlash.progress / this.swordSlash.max;
                const currentAngle = this.swordSlash.angle - sweep / 2 + (sweep * progressRatio);
                ctx.translate(handX, handY);
                ctx.rotate(currentAngle + Math.PI / 2);
            } else {
                ctx.translate(handX, handY);
                ctx.rotate(this.aimAngle + Math.PI / 2);
            }
            
            // Draw Vector Sword
            ctx.save();
            ctx.fillStyle = '#eab308';
            ctx.fillRect(-8, -4, 16, 3); // guard
            
            ctx.fillStyle = '#78350f';
            ctx.fillRect(-2.5, -1, 5, 10); // handle
            
            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.arc(0, 10, 2.5, 0, Math.PI * 2);
            ctx.fill();
            
            if (this.swordSlash) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#c084fc';
                ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.moveTo(0, -4);
                ctx.lineTo(0, -32);
                ctx.stroke();
            }
            
            ctx.fillStyle = '#f1f5f9';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-3, -4);
            ctx.lineTo(3, -4);
            ctx.lineTo(2, -28);
            ctx.lineTo(0, -32);
            ctx.lineTo(-2, -28);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            
        } else if (this.currentWeapon === 'bow') {
            ctx.translate(handX, handY);
            ctx.rotate(this.aimAngle + Math.PI / 2);
            
            // Draw Vector Bow
            ctx.save();
            ctx.strokeStyle = '#b45309';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(0, 0, 12, -Math.PI * 0.85, -Math.PI * 0.15);
            ctx.stroke();
            
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, 12, -Math.PI * 0.55, -Math.PI * 0.45);
            ctx.stroke();
            
            const maxCooldown = 60 / this.attackSpeed;
            const pullRatio = this.shootCooldown > 0 ? (this.shootCooldown / maxCooldown) : 0;
            const pullDist = pullRatio * 7;
            
            ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-11, -4);
            ctx.lineTo(0, pullDist);
            ctx.lineTo(11, -4);
            ctx.stroke();
            
            if (this.shootCooldown > 0) {
                ctx.strokeStyle = '#78350f';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(0, pullDist);
                ctx.lineTo(0, pullDist - 16);
                ctx.stroke();
                
                ctx.fillStyle = '#cbd5e1';
                ctx.beginPath();
                ctx.moveTo(0, pullDist - 16);
                ctx.lineTo(-2.5, pullDist - 12);
                ctx.lineTo(2.5, pullDist - 12);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
            
        } else if (this.currentWeapon === 'magic') {
            ctx.translate(handX, handY);
            ctx.rotate(this.aimAngle + Math.PI / 2);
            
            // Draw Vector Magic Staff
            ctx.save();
            ctx.fillStyle = '#5c2d91';
            ctx.fillRect(-2, -6, 4, 24);
            
            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.arc(0, -9, 5, 0, Math.PI, true);
            ctx.fill();
            
            ctx.fillRect(-4, -12, 8, 3);
            
            const pulse = Math.sin(Date.now() * 0.015) * 1.5;
            const crystalRadius = 4 + pulse;
            
            ctx.shadowBlur = 12 + pulse * 3;
            ctx.shadowColor = '#06b6d4';
            ctx.fillStyle = '#22d3ee';
            ctx.beginPath();
            ctx.arc(0, -12, crystalRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        this.x = origX;
        this.y = origY;
        ctx.restore();

        ctx.restore();

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
        this.radius = options.type === 'magic' ? 12 : (options.type === 'arrow' ? 4 : 6);
        this.type = options.type; // 'arrow', 'magic', 'bullet'
        this.owner = options.owner; // 'player', 'enemy'
        this.range = options.range;
        this.distanceTraveled = 0;
        this.angle = Math.atan2(this.vy, this.vx);
    }

    update(obstacles, currentRoom) {
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.x += this.vx;
        this.y += this.vy;
        this.distanceTraveled += speed;

        // Check if out of range or hits walls
        if (this.distanceTraveled >= this.range || 
            this.x < 64 || this.x > 736 || this.y < 64 || this.y > 536) {
            
            if (this.type === 'magic') {
                this.explode(currentRoom);
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

                    if (this.type === 'magic') {
                        this.explode(currentRoom);
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
                    if (this.type === 'magic') {
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
        spawnExplosion(this.x, this.y, 60);
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
        }
        ctx.restore();
    }
}

export class Enemy {
    constructor(x, y, type, levelMultiplier = 1) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        // Base type stats
        if (type === 'chaser') {
            this.radius = 16;
            this.maxHealth = 8 * levelMultiplier;
            this.speed = 1.6 + Math.random() * 0.4;
            this.damage = 0.5;
            this.color = '#ef4444';
            this.icon = '💀'; // Skeleton representation
        } else if (type === 'shooter') {
            this.radius = 15;
            this.maxHealth = 6 * levelMultiplier;
            this.speed = 1.0;
            this.damage = 0.5;
            this.shootCooldown = 60 + Math.random() * 60;
            this.color = '#a855f7';
            this.icon = '🦇'; // Gargoyle representation
        } else if (type === 'swarmer') {
            this.radius = 12;
            this.maxHealth = 4 * levelMultiplier;
            this.speed = 2.4;
            this.damage = 0.5;
            this.color = '#22c55e';
            this.icon = '🦠'; // Slime representation
        } else if (type === 'mini_swarmer') {
            this.radius = 7;
            this.maxHealth = 2 * levelMultiplier;
            this.speed = 2.8;
            this.damage = 0.5;
            this.color = '#4ade80';
            this.icon = '🟢';
        }


        this.health = this.maxHealth;
        this.vx = 0;
        this.vy = 0;
        this.knockbackX = 0;
        this.knockbackY = 0;
    }

    takeDamage(amount, kx = 0, ky = 0) {
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

        const currentSpeed = this.speed * speedMultiplier;

        if (this.type === 'chaser' || this.type === 'swarmer' || this.type === 'mini_swarmer') {
            // Walk directly towards player
            if (dist > 5) {
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            }
            
            // Deal touch damage
            if (dist < this.radius + player.radius) {
                player.takeDamage(this.damage);
            }

        } else if (this.type === 'shooter') {
            // Keeps a comfortable distance, orbits/paces around player, fires projectiles
            const idealDist = 200;
            if (dist > idealDist + 20) {
                // walk towards
                this.x += (dx / dist) * currentSpeed;
                this.y += (dy / dist) * currentSpeed;
            } else if (dist < idealDist - 20) {
                // walk away
                this.x -= (dx / dist) * currentSpeed;
                this.y -= (dy / dist) * currentSpeed;
            } else {
                // Orbit player (orthogonal pathing)
                this.x += (-dy / dist) * currentSpeed * 0.7;
                this.y += (dx / dist) * currentSpeed * 0.7;
            }

            // Shooting AI
            if (this.shootCooldown > 0) {
                this.shootCooldown--;
            } else {
                this.shootCooldown = 90 + Math.random() * 60; // shoot every 1.5 - 2.5s
                
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


            // Touch damage
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
            // Left Ear
            ctx.beginPath();
            ctx.moveTo(this.x - 8, this.y - 6 + wobble);
            ctx.bezierCurveTo(this.x - 18, this.y - 12 + wobble, this.x - 16, this.y - 2 + wobble, this.x - 8, this.y - 2 + wobble);
            ctx.closePath();
            ctx.fill();
            // Left Inner Ear (Peach)
            ctx.fillStyle = '#fca5a5';
            ctx.beginPath();
            ctx.moveTo(this.x - 8, this.y - 5 + wobble);
            ctx.bezierCurveTo(this.x - 14, this.y - 9 + wobble, this.x - 13, this.y - 3 + wobble, this.x - 8, this.y - 3 + wobble);
            ctx.closePath();
            ctx.fill();

            // Right Ear
            ctx.fillStyle = '#22c55e';
            ctx.beginPath();
            ctx.moveTo(this.x + 8, this.y - 6 + wobble);
            ctx.bezierCurveTo(this.x + 18, this.y - 12 + wobble, this.x + 16, this.y - 2 + wobble, this.x + 8, this.y - 2 + wobble);
            ctx.closePath();
            ctx.fill();
            // Right Inner Ear (Peach)
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

            // Dark pupil slits
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.x - 3, this.y - 6 + wobble);
            ctx.lineTo(this.x - 3, this.y - 2 + wobble);
            ctx.moveTo(this.x + 3, this.y - 6 + wobble);
            ctx.lineTo(this.x + 3, this.y - 2 + wobble);
            ctx.stroke();

            // Menacing mouth / smirk
            ctx.strokeStyle = '#14532d';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y + 1 + wobble, 3, 0.1, Math.PI - 0.1);
            ctx.stroke();

        } else if (this.type === 'shooter') {
            // BAT / GARGOYLE
            const wingFlap = Math.sin(Date.now() * 0.015) * 12;
            const hoverWobble = Math.sin(Date.now() * 0.008) * 3;

            // Wing left
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.moveTo(this.x - 2, this.y + hoverWobble);
            ctx.bezierCurveTo(this.x - 16, this.y - 12 + wingFlap + hoverWobble, this.x - 28, this.y - 4 + wingFlap + hoverWobble, this.x - 8, this.y + 8 + hoverWobble);
            ctx.bezierCurveTo(this.x - 12, this.y + 4 + hoverWobble, this.x - 6, this.y + 2 + hoverWobble, this.x - 2, this.y + hoverWobble);
            ctx.closePath();
            ctx.fill();

            // Wing right
            ctx.beginPath();
            ctx.moveTo(this.x + 2, this.y + hoverWobble);
            ctx.bezierCurveTo(this.x + 16, this.y - 12 + wingFlap + hoverWobble, this.x + 28, this.y - 4 + wingFlap + hoverWobble, this.x + 8, this.y + 8 + hoverWobble);
            ctx.bezierCurveTo(this.x + 12, this.y + 4 + hoverWobble, this.x + 6, this.y + 2 + hoverWobble, this.x + 2, this.y + hoverWobble);
            ctx.closePath();
            ctx.fill();

            // Bat Head & Body (Charcoal-black)
            ctx.fillStyle = '#1e293b';
            ctx.beginPath();
            ctx.arc(this.x, this.y + hoverWobble, 10, 0, Math.PI * 2);
            ctx.fill();

            // Pointy Bat Ears
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

            // Inner ears (pinkish/red)
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

            // Glowing crimson red eyes
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

            // Highlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(-this.radius * 0.3, -this.radius * 1.3, this.radius * 0.25, 0, Math.PI * 2);
            ctx.fill();

            // Bubbles inside
            const b1Offset = Math.sin(baseTime * 0.5) * (this.radius * 0.25);
            ctx.fillStyle = 'rgba(165, 243, 252, 0.6)';
            ctx.beginPath();
            ctx.arc(this.radius * 0.2, -this.radius * 0.8 + b1Offset, this.radius * 0.15, 0, Math.PI * 2);
            ctx.arc(-this.radius * 0.4, -this.radius * 0.5 - b1Offset, this.radius * 0.1, 0, Math.PI * 2);
            ctx.fill();

            // Eyes
            ctx.fillStyle = '#052e16';
            ctx.beginPath();
            ctx.arc(-this.radius * 0.25, -this.radius * 0.7, this.radius * 0.15, 0, Math.PI * 2);
            ctx.arc(this.radius * 0.25, -this.radius * 0.7, this.radius * 0.15, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
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

        // Custom Boss details based on level depth
        const bossesData = [
            { name: 'THE GOLEM', maxHealth: 90, speed: 1.1, icon: '🗿', color: '#64748b' },
            { name: 'SHADOW KNIGHT', maxHealth: 140, speed: 1.4, icon: '🛡️', color: '#1e1b4b' },
            { name: 'NECROMANCER', maxHealth: 190, speed: 1.2, icon: '🧙', color: '#047857' },
            { name: 'FIRE DEMON', maxHealth: 250, speed: 1.6, icon: '😈', color: '#b91c1c' },
            { name: 'THE VOID EYE', maxHealth: 350, speed: 1.3, icon: '👁️', color: '#581c87' }
        ];

        // Fallback for endless levels beyond depth V
        const data = bossesData[Math.min(level - 1, bossesData.length - 1)];
        this.name = data.name;
        this.maxHealth = data.maxHealth * (1 + (level - 1) * 0.15); // scaled slightly beyond depth V
        this.health = this.maxHealth;
        this.speed = data.speed;
        this.icon = data.icon;
        this.color = data.color;

        this.attackCooldown = 120;
        this.phase = 1;
        this.damage = 1;

        // Boss-specific behaviors
        this.jumpTimer = 0;
        this.isJumping = false;
        this.jumpTargetX = 0;
        this.jumpTargetY = 0;
        this.staffAngle = 0; // Necromancer staff rotation
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

        // Core AI logic depending on Boss type
        const bossIndex = Math.min(this.level - 1, 4);

        if (bossIndex === 0) {
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

        } else if (bossIndex === 1) {
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

        } else if (bossIndex === 2) {
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

        } else if (bossIndex === 3) {
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

        } else {
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

        } else if (bossIndex === 1) {
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

        } else if (bossIndex === 2) {
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

        } else if (bossIndex === 3) {
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

        } else if (bossIndex === 4) {
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
        this.type = type; // 'heart', 'mana', 'coin', 'trophy'
        this.radius = type === 'trophy' ? 16 : 8;
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
    }

    update(player) {
        // Drop magnet pull towards player if within 120px
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (this.type !== 'trophy' && dist < 120) {
            const pullForce = (120 - dist) * 0.05;
            this.x += (dx / dist) * pullForce;
            this.y += (dy / dist) * pullForce;
        }

        // Collision Check with Player
        if (dist < this.radius + player.radius) {
            if (this.type === 'coin') {
                player.restoreMana(5); // coins double as a tiny mana boost
                spawnSparkles(this.x, this.y, '#f59e0b', 5);
                spawnFloatingText(this.x, this.y, '+1 Coin', '#f59e0b', 12);
                this.pickedUp = true;
                audio.play('coin_pickup');
                return true;
            } else if (this.type === 'mana') {
                player.restoreMana(35);
                this.pickedUp = true;
                audio.play('pickup');
                return true;
            } else if (this.type === 'heart') {
                // Only pickup heart if damaged
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

        ctx.font = `${this.radius * 1.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

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
        }

        ctx.restore();
    }
}
