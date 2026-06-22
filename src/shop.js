// Shopkeeper Merchant NPC system for Void Wanderer

import { spawnSmoke, spawnSparkles, spawnFloatingText } from './particles.js?v=20';

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
        
        // Return true if player is close enough to trigger prompt
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        return dist < this.radius + player.radius + 20 && !this.interacted;
    }

    draw(ctx) {
        if (this.interacted) return;

        ctx.save();
        const floatOffset = Math.sin(this.pulseAngle) * 5;

        // Draw green portal-like glowing shadow underneath him
        ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'; // emerald glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#10b981';
        ctx.beginPath();
        ctx.arc(this.x, this.y + 14, 18, 0, Math.PI * 2);
        ctx.fill();

        // Cloaked Merchant figure body (Green cloak)
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

        // Interaction hint indicator above NPC
        ctx.font = "bold 9px 'Cinzel', serif";
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.fillText("THE MERCHANT", this.x, this.y - 28 + floatOffset);

        ctx.restore();
    }
}
