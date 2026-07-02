// Particles System for Void Wanderer

export const particles = [];

class Particle {
    constructor(options) {
        this.x = options.x;
        this.y = options.y;
        this.vx = options.vx || 0;
        this.vy = options.vy || 0;
        this.size = options.size || 3;
        this.color = options.color || '#fff';
        this.alpha = options.alpha !== undefined ? options.alpha : 1;
        this.life = options.life || 30; // in frames
        this.maxLife = this.life;
        this.gravity = options.gravity || 0;
        this.drag = options.drag || 0.98;
        this.type = options.type || 'circle'; // 'circle', 'text', 'smoke', 'slash', 'ember'
        this.text = options.text || '';
        this.fontSize = options.fontSize || 12;
        this.glow = options.glow || false;
        this.angle = options.angle || 0;
        this.rotSpeed = options.rotSpeed || 0;
        this.startX = options.startX || 0;
        this.startY = options.startY || 0;
        this.endX = options.endX || 0;
        this.endY = options.endY || 0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.drag;
        this.vy *= this.drag;
        this.vy += this.gravity;
        if (this.rotSpeed) {
            this.angle = (this.angle || 0) + this.rotSpeed;
        }
        this.life--;
        this.alpha = Math.max(0, this.life / this.maxLife);
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;

        if (this.glow) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
        }

        if (this.type === 'circle') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'bone_shard') {
            ctx.fillStyle = this.color;
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1;
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.beginPath();
            // Draw small irregular triangular splinter
            ctx.moveTo(-this.size, -this.size / 2);
            ctx.lineTo(this.size, 0);
            ctx.lineTo(-this.size, this.size / 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (this.type === 'lightning_bolt') {
            ctx.save();
            
            const dx = this.endX - this.startX;
            const dy = this.endY - this.startY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 5) {
                const segments = Math.max(3, Math.floor(dist / 16));
                const px = -dy / dist;
                const py = dx / dist;
                
                const points = [{ x: this.startX, y: this.startY }];
                for (let i = 1; i < segments; i++) {
                    const ratio = i / segments;
                    const tx = this.startX + dx * ratio;
                    const ty = this.startY + dy * ratio;
                    const offset = (Math.random() - 0.5) * 14 * (1 - Math.abs(ratio - 0.5) * 0.5);
                    points.push({ x: tx + px * offset, y: ty + py * offset });
                }
                points.push({ x: this.endX, y: this.endY });
                
                // 1. Draw outer cyan glow
                ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#06b6d4';
                
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.stroke();
                
                // 2. Draw inner white core
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2.0;
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.stroke();
            }
            
            ctx.restore();
        } else if (this.type === 'smoke') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * (2 - this.alpha), 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'ember') {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        } else if (this.type === 'text') {
            ctx.font = `bold ${this.fontSize}px 'Outfit', sans-serif`;
            ctx.fillStyle = this.color;
            ctx.textAlign = 'center';
            ctx.fillText(this.text, this.x, this.y);
        }

        ctx.restore();
    }
}

// Particle spawning utilities

export function spawnBlood(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        particles.push(new Particle({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 2 + Math.random() * 4,
            color: Math.random() > 0.3 ? '#b91c1c' : '#7f1d1d', // blood red colors
            life: 20 + Math.random() * 20,
            drag: 0.95,
            gravity: 0.15
        }));
    }
}

export function spawnSparkles(x, y, color = '#a855f7', count = 12) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2.5;
        particles.push(new Particle({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 1.5 + Math.random() * 3,
            color: color,
            life: 30 + Math.random() * 20,
            drag: 0.97,
            glow: true
        }));
    }
}

export function spawnEmbers(x, y, width = 20, count = 1) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle({
            x: x + (Math.random() - 0.5) * width,
            y: y - 5,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -0.5 - Math.random() * 1.2,
            size: 1.5 + Math.random() * 2.5,
            color: Math.random() > 0.4 ? '#f97316' : '#ef4444', // Orange/Red embers
            life: 30 + Math.random() * 20,
            drag: 0.99,
            gravity: -0.02 // drift upwards
        }));
    }
}

export function spawnSmoke(x, y, count = 8, sizeMultiplier = 1) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.2 + Math.random() * 1.2;
        particles.push(new Particle({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: (6 + Math.random() * 8) * sizeMultiplier,
            color: 'rgba(75, 75, 90, 0.4)',
            life: 40 + Math.random() * 20,
            drag: 0.96,
            type: 'smoke'
        }));
    }
}

export function spawnFloatingText(x, y, text, color = '#ef4444', fontSize = 14) {
    particles.push(new Particle({
        x: x,
        y: y - 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -1 - Math.random() * 1.5,
        size: 0,
        color: color,
        life: 45,
        drag: 0.98,
        type: 'text',
        text: text,
        fontSize: fontSize,
        glow: true
    }));
}

export function spawnExplosion(x, y, radius = 40) {
    // Spawn smoke rings and fire sparkles
    spawnSmoke(x, y, 15, radius / 30);
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        particles.push(new Particle({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 3 + Math.random() * 4,
            color: Math.random() > 0.4 ? '#f59e0b' : '#ef4444', // yellow/red
            life: 15 + Math.random() * 15,
            drag: 0.9,
            glow: true
        }));
    }
}

export function spawnLightningExplosion(x, y, radius = 40) {
    // Spawn smoke rings and cyan/white sparks
    spawnSmoke(x, y, 8, radius / 30);
    for (let i = 0; i < 22; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5.5;
        particles.push(new Particle({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 2.5 + Math.random() * 3.5,
            color: Math.random() > 0.35 ? '#22d3ee' : '#ffffff', // cyan or white
            life: 15 + Math.random() * 15,
            drag: 0.91,
            glow: true
        }));
    }
}

export function spawnLightningBolt(startX, startY, endX, endY, color = '#22d3ee', size = 2.2, life = 6) {
    particles.push(new Particle({
        x: startX,
        y: startY,
        startX: startX,
        startY: startY,
        endX: endX,
        endY: endY,
        color: color,
        size: size,
        life: life,
        type: 'lightning_bolt'
    }));
}

export function spawnBoneShards(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3.0;
        particles.push(new Particle({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 3 + Math.random() * 4,
            color: '#e2e8f0', // bone-white
            life: 20 + Math.random() * 20,
            drag: 0.94,
            gravity: 0.12, // slight fall
            type: 'bone_shard',
            angle: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.2
        }));
    }
}

export function updateAndDrawParticles(ctx) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.life <= 0) {
            particles.splice(i, 1);
        } else {
            p.draw(ctx);
        }
    }
}

export function clearParticles() {
    particles.length = 0;
}
