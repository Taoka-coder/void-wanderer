// Mystery Man interaction system for Void Wanderer

import { spawnSmoke, spawnSparkles, spawnFloatingText } from './particles.js';

export class MysteryManNPC {
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

        // Draw dark portal-like glowing shadow underneath him
        ctx.fillStyle = 'rgba(147, 51, 234, 0.15)'; // purple glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#a855f7';
        ctx.beginPath();
        ctx.arc(this.x, this.y + 14, 18, 0, Math.PI * 2);
        ctx.fill();

        // Cloaked Mystery figure body
        ctx.fillStyle = '#0f172a'; // Deep charcoal grey cloak
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2 + floatOffset, this.radius, 0, Math.PI*2);
        ctx.fill();

        // Inner shadow hood
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(this.x, this.y + floatOffset, this.radius - 4, Math.PI, Math.PI*2);
        ctx.fill();

        // Glowing cyan/purple eyes inside hood
        ctx.fillStyle = '#c084fc'; // Light purple glow eyes
        ctx.beginPath();
        ctx.arc(this.x - 5, this.y - 2 + floatOffset, 2.5, 0, Math.PI*2);
        ctx.arc(this.x + 5, this.y - 2 + floatOffset, 2.5, 0, Math.PI*2);
        ctx.fill();

        // Interaction hint indicator above NPC
        ctx.font = "bold 9px 'Cinzel', serif";
        ctx.fillStyle = '#cbd5e1';
        ctx.textAlign = 'center';
        ctx.fillText("THE DECIPIENT", this.x, this.y - 28 + floatOffset);

        ctx.restore();
    }
}

// 50/50 Gamble Action
export function performMysteryGamble(player, onFinishCallback, playAudioCallback) {
    const isBlessing = Math.random() < 0.5; // Strictly 50/50 chances
    
    // UI selections
    const overlay = document.getElementById('mystery-overlay');
    const acceptBtn = document.getElementById('btn-accept-gamble');
    const declineBtn = document.getElementById('btn-decline-gamble');
    const coinContainer = document.getElementById('gamble-wheel-container');
    const coin = document.getElementById('gamble-coin');
    const dialogText = document.querySelector('.mystery-dialogue');

    // Hide actions, show spinning coin
    acceptBtn.style.display = 'none';
    declineBtn.style.display = 'none';
    coinContainer.classList.remove('hidden');

    // Trigger spin CSS animation
    coin.classList.remove('spin-blessing', 'spin-curse');
    void coin.offsetWidth; // Reflow reset
    
    if (playAudioCallback) playAudioCallback('gamble_start');

    if (isBlessing) {
        coin.classList.add('spin-blessing');
    } else {
        coin.classList.add('spin-curse');
    }

    // Process result after spin ends (3.5 seconds in CSS)
    setTimeout(() => {
        let resultText = "";
        let statColor = "";
        
        if (playAudioCallback) playAudioCallback('gamble_end');

        if (isBlessing) {
            // Apply Random blessing
            const option = Math.floor(Math.random() * 4);
            if (option === 0) {
                player.damage += 1.5;
                resultText = "BLESSING: DAMAGE DEALT ++ (+1.5)";
                statColor = '#f59e0b';
            } else if (option === 1) {
                player.attackSpeed += 0.45;
                resultText = "BLESSING: ATTACK SPEED ++ (+45%)";
                statColor = '#a855f7';
            } else if (option === 2) {
                player.speed += 0.7;
                resultText = "BLESSING: SPEED ++ (+0.7)";
                statColor = '#10b981';
            } else {
                player.addMaxHealth(2); // adds 2 hearts
                resultText = "BLESSING: HEARTS CONTAINER ++ (+2)";
                statColor = '#ef4444';
            }
        } else {
            // Apply Random Curse
            const option = Math.floor(Math.random() * 4);
            if (option === 0) {
                // Safeguard damage
                const reduction = 0.75;
                player.damage = Math.max(1.0, player.damage - reduction);
                resultText = `CURSE: DECAYED DAMAGE -- (-${reduction})`;
                statColor = '#ef4444';
            } else if (option === 1) {
                // Safeguard fire rate
                const reduction = 0.25;
                player.attackSpeed = Math.max(0.4, player.attackSpeed - reduction);
                resultText = "CURSE: DECAYED ATTACK SPEED -- (-25%)";
                statColor = '#a855f7';
            } else if (option === 2) {
                // Safeguard speed
                const reduction = 0.4;
                player.speed = Math.max(1.5, player.speed - reduction);
                resultText = `CURSE: DECAYED SPEED -- (-${reduction})`;
                statColor = '#cbd5e1';
            } else {
                // Safeguard hearts: can never drop below 1 max heart container
                if (player.maxHealth > 1) {
                    player.maxHealth -= 1;
                    player.health = Math.min(player.health, player.maxHealth);
                    resultText = "CURSE: WITHERED HEART -- (-1 Max Heart)";
                } else {
                    // Fallback to speed reduction if health is already at minimum
                    player.speed = Math.max(1.5, player.speed - 0.3);
                    resultText = "CURSE: WITHERED ENERGY -- (-0.3 Speed)";
                }
                statColor = '#7f1d1d';
            }
        }

        // Display results on overlay dialogue
        dialogText.innerHTML = `<span style="color: ${statColor}; font-weight: bold; font-family: 'Cinzel', serif; font-size: 1.1rem; letter-spacing: 1px;">${resultText}</span><br><br>"The scales have tipped. Fare thee well, wanderer."`;

        // Wait a little before returning to game
        setTimeout(() => {
            // Reset overlay UI states
            overlay.classList.add('hidden');
            coinContainer.classList.add('hidden');
            acceptBtn.style.display = '';
            declineBtn.style.display = '';
            dialogText.innerHTML = '"Fate is a coin floating in the void. Do you dare to flip it? Half of my deals lead to ultimate power... the other half to decay. Choose wisely."';

            // Callback to unlock game controls
            if (onFinishCallback) {
                onFinishCallback(isBlessing, resultText, statColor);
            }
        }, 2200);

    }, 3500);
}
