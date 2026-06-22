// Shopkeeper Merchant NPC system for Void Wanderer

import { spawnSmoke, spawnSparkles, spawnFloatingText } from './particles.js?v=23';

export class ShopkeeperNPC {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.interacted = false;
        this.pulseAngle = 0;
    }

    update(player) {
        this.pulseAngle += 0.05;
        
        // 1. Table Collision (Table AABB at this.y + 35, width 90, height 22)
        const rect = {
            x: this.x,
            y: this.y + 35,
            width: 90,
            height: 22
        };
        
        const closestX = Math.max(rect.x - rect.width / 2, Math.min(player.x, rect.x + rect.width / 2));
        const closestY = Math.max(rect.y - rect.height / 2, Math.min(player.y, rect.y + rect.height / 2));
        const dx = player.x - closestX;
        const dy = player.y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.radius) {
            const overlap = player.radius - distance;
            if (distance > 0) {
                player.x += (dx / distance) * overlap;
                player.y += (dy / distance) * overlap;
            } else {
                player.y += player.radius;
            }
        }
        
        // 2. Interaction check (Distance to Table center)
        const tdx = player.x - this.x;
        const tdy = player.y - (this.y + 35);
        const distToTable = Math.sqrt(tdx*tdx + tdy*tdy);
        
        // Trigger interaction when player walks up to the table
        return distToTable < player.radius + 35 && !this.interacted;
    }

    draw(ctx) {
        if (this.interacted) return;

        ctx.save();
        // Tiny breathing animation instead of floating
        const floatOffset = Math.sin(this.pulseAngle) * 1.5;

        // 1. Draw Oak Chair (sitting behind him)
        ctx.fillStyle = '#451a03'; // Dark wood
        ctx.strokeStyle = '#270e01';
        ctx.lineWidth = 1.5;
        
        // Chair backrest
        ctx.fillRect(this.x - 18, this.y - 20, 36, 6);
        ctx.strokeRect(this.x - 18, this.y - 20, 36, 6);
        
        // Chair seat base
        ctx.fillRect(this.x - 15, this.y - 14, 30, 24);
        ctx.strokeRect(this.x - 15, this.y - 14, 30, 24);
        
        // Armrests
        ctx.fillRect(this.x - 18, this.y - 14, 4, 24);
        ctx.fillRect(this.x + 14, this.y - 14, 4, 24);
        ctx.strokeRect(this.x - 18, this.y - 14, 4, 24);
        ctx.strokeRect(this.x + 14, this.y - 14, 4, 24);

        // 2. Draw Merchant shadow (green glow)
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#10b981';
        ctx.beginPath();
        ctx.arc(this.x, this.y + 8, 16, 0, Math.PI * 2);
        ctx.fill();

        // 3. Cloaked Merchant figure body (Green cloak, sitting)
        ctx.fillStyle = '#047857'; // Green cloak
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2 + floatOffset, this.radius, 0, Math.PI*2);
        ctx.fill();

        // Inner shadow hood
        ctx.fillStyle = '#022c22'; // Dark deep green inner hood
        ctx.beginPath();
        ctx.arc(this.x, this.y + floatOffset, this.radius - 4, Math.PI, Math.PI*2);
        ctx.fill();

        // Glowing gold eyes inside hood
        ctx.fillStyle = '#fbbf24'; // Glowing gold eyes
        ctx.beginPath();
        ctx.arc(this.x - 5, this.y - 2 + floatOffset, 2.5, 0, Math.PI*2);
        ctx.arc(this.x + 5, this.y - 2 + floatOffset, 2.5, 0, Math.PI*2);
        ctx.fill();

        // 4. Draw Wooden Table in front of him (at Y = this.y + 35)
        const ty = this.y + 35;
        
        // Table shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(this.x, ty + 4, 48, 12, 0, 0, Math.PI*2);
        ctx.fill();
        
        // Tabletop
        ctx.fillStyle = '#5c3a21'; // Oak table surface
        ctx.strokeStyle = '#2c1405';
        ctx.lineWidth = 2.5;
        ctx.fillRect(this.x - 45, ty - 12, 90, 22);
        ctx.strokeRect(this.x - 45, ty - 12, 90, 22);
        
        // Wares on the table
        // Red potion bottle
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(this.x - 20, ty - 2, 4, 0, Math.PI*2);
        ctx.fill();
        // Potion cork
        ctx.fillStyle = '#b45309';
        ctx.fillRect(this.x - 21, ty - 8, 2, 2);
        
        // Gold coin piles
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(this.x + 18, ty - 1, 3, 0, Math.PI*2);
        ctx.arc(this.x + 22, ty + 1, 3, 0, Math.PI*2);
        ctx.arc(this.x + 20, ty - 3, 2.5, 0, Math.PI*2);
        ctx.fill();

        // Interaction hint indicator above NPC
        ctx.font = "bold 9px 'Cinzel', serif";
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.fillText("THE MERCHANT", this.x, this.y - 32 + floatOffset);

        ctx.restore();
    }
}
