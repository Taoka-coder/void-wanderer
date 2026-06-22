// Dungeon Generator for Void Wanderer
// Handles grid-based level layouts and room types

export const GRID_SIZE = 9;
export const START_X = 4;
export const START_Y = 4;

export const ROOM_TYPES = {
    START: 'start',
    EMPTY: 'empty',
    BASIC: 'basic',
    TROPHY: 'trophy',
    BOSS: 'boss',
    MYSTERY: 'mystery'
};

export class Room {
    constructor(gridX, gridY, type) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.type = type;
        this.cleared = (type === ROOM_TYPES.START || type === ROOM_TYPES.TROPHY || type === ROOM_TYPES.MYSTERY);
        this.visited = false;
        
        // Connections to adjacent rooms (true/false)
        this.doors = {
            up: false,
            down: false,
            left: false,
            right: false
        };

        this.obstacles = []; // Stones, webs, campfires, bones
        this.mobs = [];      // Spawned mobs in this room
        this.drops = [];     // Dropped hearts, mana, coins, or trophy pedestals
        this.mobsSpawned = false;

        this.generateObstacles();
    }

    generateObstacles() {
        if (this.type === ROOM_TYPES.START || this.type === ROOM_TYPES.TROPHY || this.type === ROOM_TYPES.MYSTERY || this.type === ROOM_TYPES.BOSS) {
            // Special rooms keep clean centers, boss room is empty except for boss
            return;
        }

        // We use an 11x7 grid inside the room (excluding borders)
        // Playable area is x: 64 to 736 (width 672), y: 64 to 536 (height 472)
        const cols = 9;
        const rows = 5;
        const colWidth = 672 / cols;
        const rowHeight = 472 / rows;

        // Populate empty or basic room with obstacles
        // Type 1: Empty room with obstacles. Type 2: Basic room with obstacles and mobs.
        const obstacleChance = this.type === ROOM_TYPES.EMPTY ? 0.25 : 0.12;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Keep doors clear (don't place in center rows or center columns near edges)
                if ((r === 2 && (c === 0 || c === cols - 1)) || 
                    (c === 4 && (r === 0 || r === rows - 1))) {
                    continue;
                }
                
                // Keep the exact center clear
                if (r === 2 && c === 4) {
                    continue;
                }

                if (Math.random() < obstacleChance) {
                    const x = 64 + c * colWidth + colWidth / 2;
                    const y = 64 + r * rowHeight + rowHeight / 2;
                    
                    const rand = Math.random();
                    let obsType;
                    if (rand < 0.3) obsType = 'stone'; // solid
                    else if (rand < 0.55) obsType = 'web'; // slows down
                    else if (rand < 0.8) obsType = 'bone'; // destructible
                    else obsType = 'campfire'; // damaging, destructible

                    this.obstacles.push({
                        x, y,
                        type: obsType,
                        width: 40,
                        height: 40,
                        health: 1, // for destructibles
                        extinguished: false
                    });
                }
            }
        }
    }
}

export class Dungeon {
    constructor(level) {
        this.level = level;
        this.grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
        this.roomsList = [];
        this.targetRoomCount = this.calculateRoomCount();
        this.activeRoom = null;
        
        this.generate();
    }

    calculateRoomCount() {
        if (this.level >= 1 && this.level <= 5) {
            // Level 1: 7-8, Level 2: 9-11, Level 3: 12-14, Level 4: 15-17, Level 5: 18-20
            const ranges = [
                [7, 8],
                [9, 11],
                [12, 14],
                [15, 17],
                [18, 20]
            ];
            const range = ranges[this.level - 1];
            return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
        } else {
            // Level > 5: random up to 25
            return Math.floor(Math.random() * 6) + 20; // 20 to 25
        }
    }

    generate() {
        let attempts = 0;
        while (attempts < 100) {
            this.grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
            this.roomsList = [];
            
            // 1. Create Start Room
            const startRoom = new Room(START_X, START_Y, ROOM_TYPES.START);
            startRoom.visited = true;
            this.grid[START_X][START_Y] = startRoom;
            this.roomsList.push(startRoom);

            const queue = [[START_X, START_Y]];

            // 2. Expand Grid randomly
            while (queue.length > 0 && this.roomsList.length < this.targetRoomCount) {
                const [cx, cy] = queue.shift();
                
                // Shuffle directions
                const dirs = [
                    [0, -1], // up
                    [0, 1],  // down
                    [-1, 0], // left
                    [1, 0]   // right
                ].sort(() => Math.random() - 0.5);

                for (const [dx, dy] of dirs) {
                    const nx = cx + dx;
                    const ny = cy + dy;

                    // Bounds check
                    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
                    // Already occupied
                    if (this.grid[nx][ny] !== null) continue;

                    // Check neighbors to keep maze branching instead of blocky
                    let neighborCount = 0;
                    if (nx > 0 && this.grid[nx - 1][ny]) neighborCount++;
                    if (nx < GRID_SIZE - 1 && this.grid[nx + 1][ny]) neighborCount++;
                    if (ny > 0 && this.grid[nx][ny - 1]) neighborCount++;
                    if (ny < GRID_SIZE - 1 && this.grid[nx][ny + 1]) neighborCount++;

                    // Limit branching (only allow placing if it connects to 1 room)
                    if (neighborCount === 1) {
                        if (Math.random() < 0.65 || queue.length === 0) {
                            const newRoom = new Room(nx, ny, ROOM_TYPES.BASIC);
                            this.grid[nx][ny] = newRoom;
                            this.roomsList.push(newRoom);
                            queue.push([nx, ny]);

                            if (this.roomsList.length >= this.targetRoomCount) break;
                        }
                    }
                }
            }

            // If we successfully placed target rooms, proceed to assign special rooms
            if (this.roomsList.length === this.targetRoomCount) {
                this.assignSpecialRooms();
                this.connectDoors();
                this.activeRoom = startRoom;
                return;
            }
            attempts++;
        }

        console.error("Dungeon generation failed. Target count was too strict.");
        // Fallback simple line layout to prevent softlock
        this.targetRoomCount = 7;
        this.generate();
    }

    assignSpecialRooms() {
        // Find dead ends (rooms with only 1 neighbor)
        const deadEnds = [];
        const distances = []; // distance from start room (4,4)

        for (const room of this.roomsList) {
            if (room.gridX === START_X && room.gridY === START_Y) continue;

            let neighbors = 0;
            if (room.gridX > 0 && this.grid[room.gridX - 1][room.gridY]) neighbors++;
            if (room.gridX < GRID_SIZE - 1 && this.grid[room.gridX + 1][room.gridY]) neighbors++;
            if (room.gridY > 0 && this.grid[room.gridX][room.gridY - 1]) neighbors++;
            if (room.gridY < GRID_SIZE - 1 && this.grid[room.gridX][room.gridY + 1]) neighbors++;

            if (neighbors === 1) {
                deadEnds.push(room);
            }

            // Manhattan distance
            const dist = Math.abs(room.gridX - START_X) + Math.abs(room.gridY - START_Y);
            distances.push({ room, dist });
        }

        // Sort distances descending (furthest first)
        distances.sort((a, b) => b.dist - a.dist);

        // 1. Furthest room is the Boss Room
        const bossRoomObj = distances[0].room;
        bossRoomObj.type = ROOM_TYPES.BOSS;
        
        // Remove boss room from dead-ends list if it is there
        const bIndex = deadEnds.indexOf(bossRoomObj);
        if (bIndex !== -1) deadEnds.splice(bIndex, 1);

        // 2. Select Trophy Room from remaining dead-ends (or next furthest)
        let trophyRoomObj;
        if (deadEnds.length > 0) {
            // Pick a random dead-end
            const randIdx = Math.floor(Math.random() * deadEnds.length);
            trophyRoomObj = deadEnds.splice(randIdx, 1)[0];
            trophyRoomObj.type = ROOM_TYPES.TROPHY;
            trophyRoomObj.cleared = true;
        } else {
            // Pick next furthest room
            trophyRoomObj = distances[1].room;
            trophyRoomObj.type = ROOM_TYPES.TROPHY;
            trophyRoomObj.cleared = true;
        }

        // 3. Select Mystery Man Room from remaining dead-ends (or next furthest)
        let mysteryRoomObj;
        if (deadEnds.length > 0) {
            const randIdx = Math.floor(Math.random() * deadEnds.length);
            mysteryRoomObj = deadEnds.splice(randIdx, 1)[0];
            mysteryRoomObj.type = ROOM_TYPES.MYSTERY;
            mysteryRoomObj.cleared = true;
        } else {
            // Find next furthest available room
            for (let i = 2; i < distances.length; i++) {
                const r = distances[i].room;
                if (r !== bossRoomObj && r !== trophyRoomObj) {
                    mysteryRoomObj = r;
                    mysteryRoomObj.type = ROOM_TYPES.MYSTERY;
                    mysteryRoomObj.cleared = true;
                    break;
                }
            }
        }

        // 4. Remaining rooms are either basic (combat) or empty (obstacles only)
        for (const room of this.roomsList) {
            if (room.type === ROOM_TYPES.BASIC) {
                // 30% chance to be an empty room with obstacles
                if (Math.random() < 0.3) {
                    room.type = ROOM_TYPES.EMPTY;
                    room.cleared = true;
                }
            }
        }
    }

    connectDoors() {
        for (const room of this.roomsList) {
            const { gridX: x, gridY: y } = room;
            if (y > 0 && this.grid[x][y - 1]) room.doors.up = true;
            if (y < GRID_SIZE - 1 && this.grid[x][y + 1]) room.doors.down = true;
            if (x > 0 && this.grid[x - 1][y]) room.doors.left = true;
            if (x < GRID_SIZE - 1 && this.grid[x + 1][y]) room.doors.right = true;
        }
    }

    drawMinimap(ctx) {
        ctx.clearRect(0, 0, 120, 120);
        
        // 9x9 grid, drawing offset
        const roomSize = 10;
        const gap = 2;
        const totalGridSize = GRID_SIZE * (roomSize + gap) - gap; // 9 * 12 - 2 = 106
        const offsetX = 60 - totalGridSize / 2; // Centered inside 120x120 (starts at 7)
        const offsetY = 60 - totalGridSize / 2;

        for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                const room = this.grid[x][y];
                if (!room) continue;

                const rx = offsetX + x * (roomSize + gap);
                const ry = offsetY + y * (roomSize + gap);

                // Check if adjacent to a visited room
                let isAdjacentToVisited = false;
                const adjacentDirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
                for (const [dx, dy] of adjacentDirs) {
                    const ax = x + dx;
                    const ay = y + dy;
                    if (ax >= 0 && ax < GRID_SIZE && ay >= 0 && ay < GRID_SIZE) {
                        const adjRoom = this.grid[ax][ay];
                        if (adjRoom && adjRoom.visited) {
                            isAdjacentToVisited = true;
                            break;
                        }
                    }
                }

                const isBoss = room.type === ROOM_TYPES.BOSS;

                // Boss visibility logic: Hide boss room until player is 1 door away (or has visited it)
                let showBoss = false;
                if (isBoss) {
                    if (room.visited) {
                        showBoss = true;
                    } else if (this.activeRoom) {
                        const dist = Math.abs(this.activeRoom.gridX - x) + Math.abs(this.activeRoom.gridY - y);
                        if (dist === 1) {
                            showBoss = true;
                        }
                    }
                }

                if (room.visited) {
                    // Visited: Draw details
                    if (room.type === ROOM_TYPES.MYSTERY) {
                        ctx.fillStyle = '#a855f7'; // Mystery Man Room: Purple
                    } else if (room.cleared) {
                        ctx.fillStyle = '#ffffff'; // Cleared/secured room: White
                    } else {
                        ctx.fillStyle = '#000000'; // Visited but uncleared/unsecured: Black
                    }
                    ctx.fillRect(rx, ry, roomSize, roomSize);

                    // Border around visited rooms to make them clearly visible on dark backgrounds
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(rx + 0.5, ry + 0.5, roomSize - 1, roomSize - 1);

                    // Draw player indicator in active room
                    if (this.activeRoom === room) {
                        ctx.fillStyle = '#06b6d4'; // Glowing cyan dot for player
                        ctx.beginPath();
                        ctx.arc(rx + roomSize / 2, ry + roomSize / 2, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else if ((isBoss && showBoss) || (isAdjacentToVisited && !isBoss)) {
                    // Revealed adjacent room (or adjacent boss room): Draw placeholder border
                    ctx.strokeStyle = isBoss ? '#ef4444' : 'rgba(255, 255, 255, 0.4)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(rx + 0.5, ry + 0.5, roomSize - 1, roomSize - 1);
                    
                    if (isBoss) {
                        // Small red dot in center for boss icon
                        ctx.fillStyle = '#ef4444';
                        ctx.fillRect(rx + roomSize / 2 - 1, ry + roomSize / 2 - 1, 2, 2);
                    }
                }
            }
        }
    }

}
