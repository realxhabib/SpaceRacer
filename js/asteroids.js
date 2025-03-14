/**
 * Asteroids manager for Space Racer game
 */

class AsteroidsManager {
    constructor(game) {
        this.game = game;
        this.asteroids = [];
        this.asteroidModel = null;
        this.spawnDistance = -1800;               // Increased from -1500 to spawn further ahead
        this.despawnDistance = 50;                // Keep the same
        this.spawnInterval = 0.9;                 // Decreased from 1.0 to spawn more frequently
        this.spawnTimer = 0;
        this.spawnCount = 3;                      // Increased from 2 to create more asteroids
        this.minSpawnX = -40;                     // Wider spawn area
        this.maxSpawnX = 40;                      // Wider spawn area
        this.minSpawnY = -20;                     // Wider spawn area
        this.maxSpawnY = 20;                      // Wider spawn area
        this.damageAmount = 10;                   // Keep the same
        this.gameTime = 0;                        // Keep the same
        this.maxAsteroids = 70;                   // Increased from 50 to allow more asteroids
        this.trackingAsteroidChance = 0.1;        // Keep the same
        this.directPathChance = 0.2;              // Keep the same
        this.distanceCheckpoints = [500, 1000, 2000, 3000, 5000, 7500, 10000]; // Keep the same
        this.lastDistanceCheckpoint = 0;          // Keep the same
        
        // New properties for boundary asteroids
        this.boundaryDistance = 80;               // Distance from player at which boundary asteroids spawn
        this.boundaryDensity = 0.5;               // 0-1 value for how dense the boundary asteroid field is
        this.boundarySpawnInterval = 1.5;         // Time between boundary asteroid spawns
        this.boundarySpawnTimer = 0;              // Timer for boundary asteroids
        this.boundaryAsteroids = [];              // Track boundary asteroids separately
    }

    initialize() {
        // Get asteroid model
        this.asteroidModel = this.game.modelsManager.getModelClone('asteroid');
        
        if (!this.asteroidModel) {
            console.error('Failed to load asteroid model');
            return;
        }
        
        // Hide original model
        this.asteroidModel.visible = false;
    }

    update(deltaTime) {
        // Update game time for difficulty scaling
        this.gameTime += deltaTime;
        
        // Update spawn timer
        this.spawnTimer += deltaTime;
        
        // Update boundary spawn timer
        this.boundarySpawnTimer += deltaTime;
        
        // Spawn new asteroids
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnAsteroids();
        }
        
        // Spawn boundary asteroids
        if (this.boundarySpawnTimer >= this.boundarySpawnInterval) {
            this.boundarySpawnTimer = 0;
            this.spawnBoundaryAsteroids();
        }
        
        // Update existing asteroids
        const playerPosition = this.game.player.getPosition();
        
        // Process all asteroids (regular and boundary)
        let allAsteroids = [...this.asteroids, ...this.boundaryAsteroids];
        
        for (let i = allAsteroids.length - 1; i >= 0; i--) {
            const asteroid = allAsteroids[i];
            const isRegularAsteroid = i < this.asteroids.length;
            
            // Move asteroid towards player
            asteroid.position.z += asteroid.speed * deltaTime;
            
            // Apply lateral movement
            if (asteroid.lateralMovement) {
                asteroid.position.x += asteroid.lateralMovement.x * deltaTime;
                asteroid.position.y += asteroid.lateralMovement.y * deltaTime;
            }
            
            // Handle tracking asteroids
            if (asteroid.isTracking) {
                // Calculate direction to player
                const directionToPlayer = {
                    x: playerPosition.x - asteroid.position.x,
                    y: playerPosition.y - asteroid.position.y
                };
                
                // Normalize direction
                const distance = Math.sqrt(directionToPlayer.x * directionToPlayer.x + directionToPlayer.y * directionToPlayer.y);
                
                if (distance > 0) {
                    directionToPlayer.x /= distance;
                    directionToPlayer.y /= distance;
                    
                    // Move asteroid towards player with tracking strength
                    asteroid.position.x += directionToPlayer.x * asteroid.trackingStrength * deltaTime * 10;
                    asteroid.position.y += directionToPlayer.y * asteroid.trackingStrength * deltaTime * 10;
                }
            }
            
            // Check if asteroid is behind player and should be removed
            if (asteroid.position.z > playerPosition.z + this.despawnDistance) {
                this.game.scene.remove(asteroid);
                if (isRegularAsteroid) {
                    this.asteroids.splice(i, 1);
                } else {
                    this.boundaryAsteroids.splice(i - this.asteroids.length, 1);
                }
                continue;
            }
            
            // For boundary asteroids: check if they've moved too close to the player
            if (!isRegularAsteroid) {
                const horizontalDistSq = 
                    Math.pow(asteroid.position.x - playerPosition.x, 2) + 
                    Math.pow(asteroid.position.y - playerPosition.y, 2);
                
                // If the boundary asteroid is now closer than half the boundary distance, 
                // increase its speed to make it more challenging to bypass the boundary
                if (horizontalDistSq < Math.pow(this.boundaryDistance * 0.5, 2)) {
                    asteroid.speed = Math.min(asteroid.speed * 1.02, 30); // Gradually increase speed up to a limit
                }
            }
            
            // Update rotation
            asteroid.rotation.x += asteroid.rotationSpeed.x * deltaTime;
            asteroid.rotation.y += asteroid.rotationSpeed.y * deltaTime;
            asteroid.rotation.z += asteroid.rotationSpeed.z * deltaTime;
            
            // Check for collision with player
            if (this.checkCollision(asteroid, this.game.player)) {
                // Player takes damage
                this.game.player.takeDamage(this.damageAmount);
                
                // Remove asteroid
                this.game.scene.remove(asteroid);
                if (isRegularAsteroid) {
                    this.asteroids.splice(i, 1);
                } else {
                    this.boundaryAsteroids.splice(i - this.asteroids.length, 1);
                }
                
                // Create explosion effect
                this.createExplosion(asteroid.position);
                continue;
            }
            
            // Check for collision with bullets
            let hitByBullet = false;
            for (const bullet of this.game.player.bullets) {
                if (bullet.active && this.checkBulletCollision(bullet.mesh, asteroid)) {
                    // Deactivate bullet
                    bullet.active = false;
                    bullet.mesh.visible = false;
                    
                    // Remove asteroid
                    this.game.scene.remove(asteroid);
                    if (isRegularAsteroid) {
                        this.asteroids.splice(i, 1);
                    } else {
                        this.boundaryAsteroids.splice(i - this.asteroids.length, 1);
                    }
                    
                    // Create explosion effect with flag indicating it's from a bullet hit
                    this.createExplosion(asteroid.position, true);
                    
                    hitByBullet = true;
                    break;
                }
            }
            
            if (hitByBullet) {
                continue;
            }
        }
        
        // Increase difficulty based on time AND distance
        this.updateDifficulty();
    }

    spawnAsteroids() {
        const playerPosition = this.game.player.getPosition();
        
        // Limit the total number of asteroids
        if (this.asteroids.length >= this.maxAsteroids) {
            return;
        }
        
        for (let i = 0; i < this.spawnCount; i++) {
            // Clone asteroid model
            const asteroid = this.asteroidModel.clone();
            asteroid.visible = true;
            
            // Determine spawn position
            let x, y, z;
            const spawnType = Math.random();
            
            // Wider spawn area constant
            const horizontalSpread = 60; // Increased from 30 for greater left-right spread
            const verticalSpread = 25;  // Increased from 15 for greater up-down spread
            
            if (spawnType < this.directPathChance) {
                // Spawn directly in front of player's path, but with more variation
                x = playerPosition.x + getRandomFloat(-12, 12); // Increased variation (was -3 to 3)
                y = playerPosition.y + getRandomFloat(-8, 8);   // Increased variation (was -3 to 3)
                z = playerPosition.z + this.spawnDistance * 0.7; // Closer than regular asteroids
            } else if (spawnType < this.directPathChance + 0.7) {
                // Spawn ahead of player with MUCH wider distribution - 70% chance
                
                // Use an improved distribution that emphasizes the edges more
                // This creates more asteroids on the sides rather than center
                if (Math.random() < 0.6) {
                    // 60% bias toward edges of the playfield
                    // Create a stronger left-right bias by using a different distribution
                    const edgeBias = Math.random() < 0.5 ? -1 : 1; // Left or right edge
                    const edgeStrength = 0.4 + (Math.random() * 0.6); // How close to the edge
                    
                    // Calculate position with bias toward edges
                    x = playerPosition.x + (edgeBias * horizontalSpread * edgeStrength);
                    
                    // Offset from pure edge for some variety
                    x += getRandomFloat(-horizontalSpread * 0.2, horizontalSpread * 0.2);
                } else {
                    // 40% in the whole field, still with much wider range
                    x = getRandomFloat(-horizontalSpread, horizontalSpread);
                }
                
                // Vertical position with less edge bias
                y = getRandomFloat(-verticalSpread, verticalSpread);
                z = playerPosition.z + this.spawnDistance;
            } else {
                // Spawn in player area (new method) - remaining chance
                // Random position around the player within a certain radius
                const radius = getRandomFloat(20, 40); // Increased from 15-30
                const angle = getRandomFloat(0, Math.PI * 2);
                
                x = playerPosition.x + Math.cos(angle) * radius;
                y = playerPosition.y + Math.sin(angle) * radius;
                
                // Spawn slightly ahead of player to give reaction time
                z = playerPosition.z - getRandomFloat(10, 50);
            }
            
            asteroid.position.set(x, y, z);
            
            // Random scale with more size variation for visual interest
            const scale = getRandomFloat(0.015, 0.045); // Wider range (was 0.02-0.035)
            asteroid.scale.set(scale, scale, scale);
            
            // Random rotation speed
            asteroid.rotationSpeed = {
                x: getRandomFloat(-0.5, 0.5),
                y: getRandomFloat(-0.5, 0.5),
                z: getRandomFloat(-0.5, 0.5)
            };
            
            // Movement speed with more variation
            asteroid.speed = getRandomFloat(8, 22); // Wider speed range (was 10-20)
            
            // Add lateral movement with more sideways motion
            asteroid.lateralMovement = {
                x: getRandomFloat(-7, 7), // Increased from -5 to 5
                y: getRandomFloat(-4, 4)  // Increased from -3 to 3
            };
            
            // Determine if this is a tracking asteroid (10% chance)
            asteroid.isTracking = Math.random() < this.trackingAsteroidChance;
            
            // Tracking asteroids move slightly slower for balance
            if (asteroid.isTracking) {
                asteroid.speed *= 0.8;
                asteroid.trackingStrength = 0.5; // How strongly it tracks the player (0.0 to 1.0)
                
                // Make tracking asteroids visually distinctive with a reddish tint
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone(); // Clone material to avoid affecting other asteroids
                        child.material.color.setHex(0xff4444); // Reddish color
                    }
                });
            }
            
            // Add to scene and array
            this.game.scene.add(asteroid);
            this.asteroids.push(asteroid);
            
            // Create hitbox for collision detection
            const boundingBox = new THREE.Box3().setFromObject(asteroid);
            const size = new THREE.Vector3();
            boundingBox.getSize(size);
            
            asteroid.hitboxSize = {
                width: size.x * 0.8, // Slightly smaller than actual model
                height: size.y * 0.8,
                depth: size.z * 0.8
            };
        }
    }

    checkCollision(asteroid, player) {
        if (!player.mesh || player.invincible) return false;
        
        const asteroidPos = asteroid.position;
        const playerPos = player.mesh.position;
        
        // Simple distance-based collision detection
        const dx = Math.abs(asteroidPos.x - playerPos.x);
        const dy = Math.abs(asteroidPos.y - playerPos.y);
        const dz = Math.abs(asteroidPos.z - playerPos.z);
        
        return (
            dx < (asteroid.hitboxSize.width + player.hitboxSize.width) / 2 &&
            dy < (asteroid.hitboxSize.height + player.hitboxSize.height) / 2 &&
            dz < (asteroid.hitboxSize.depth + player.hitboxSize.depth) / 2
        );
    }

    checkBulletCollision(bullet, asteroid) {
        const bulletPos = bullet.position;
        const asteroidPos = asteroid.position;
        
        // Improved distance-based collision detection with larger hit area
        // This makes it easier for players to shoot down asteroids
        const distance = Math.sqrt(
            Math.pow(bulletPos.x - asteroidPos.x, 2) +
            Math.pow(bulletPos.y - asteroidPos.y, 2) +
            Math.pow(bulletPos.z - asteroidPos.z, 2)
        );
        
        // Increased collision radius by 20% to make hitting asteroids easier
        return distance < (asteroid.hitboxSize.width * 0.6);
    }

    createExplosion(position, isFromBullet = false) {
        // Create particle system for explosion
        // Different colors based on whether it was hit by a bullet or player collision
        const color = isFromBullet ? 0xffff00 : 0xff5500; // Yellow for bullet hits, orange for collisions
        const particleCount = isFromBullet ? 70 : 50; // More particles for bullet hits
        const particleSize = isFromBullet ? 0.6 : 0.5; // Larger particles for bullet hits
        
        // Create main explosion particles
        const particles = createParticleSystem(color, particleSize, particleCount);
        particles.position.copy(position);
        this.game.scene.add(particles);
        
        // Add a secondary burst effect for bullet hits
        if (isFromBullet) {
            // Create a secondary shockwave effect
            const shockwave = createParticleSystem(0xffffff, 0.3, 20);
            shockwave.position.copy(position);
            this.game.scene.add(shockwave);
            
            // Apply a small camera shake for feedback
            this.game.applyScreenShake(0.2, 0.15);
            
            // Add score notification (if score tracking is implemented)
            if (this.game.addScore) {
                this.game.addScore(100);
            }
            
            // Remove secondary effect
            setTimeout(() => {
                this.game.scene.remove(shockwave);
            }, 400);
        }
        
        // Remove main particles after animation
        setTimeout(() => {
            this.game.scene.remove(particles);
        }, 1000);
    }

    updateDifficulty() {
        // Enhanced difficulty scaling based on game time AND player distance
        const playerDistance = this.game.distance;
        
        // Time-based difficulty scaling
        if (this.gameTime > 30) { // After 30 seconds
            this.spawnCount = 3;
            this.trackingAsteroidChance = 0.12; // Slight increase in tracking asteroids
            this.boundaryDensity = 0.6;
        }
        
        if (this.gameTime > 60) { // After 1 minute
            this.spawnCount = 4;
            this.spawnInterval = 0.9;
            this.trackingAsteroidChance = 0.15;
            this.directPathChance = 0.25; // More asteroids in player's path
            this.boundaryDensity = 0.7;
        }
        
        if (this.gameTime > 120) { // After 2 minutes
            this.spawnCount = 5;
            this.spawnInterval = 0.8;
            this.trackingAsteroidChance = 0.17;
            this.boundaryDensity = 0.8;
        }
        
        if (this.gameTime > 180) { // After 3 minutes
            this.spawnCount = 6;
            this.spawnInterval = 0.7;
            this.boundaryDensity = 0.9;
            this.boundaryDistance = 70; // Tighten boundary
        }
        
        // Distance-based difficulty scaling (overrides time-based if higher)
        // Check if player reached new checkpoint
        for (let i = 0; i < this.distanceCheckpoints.length; i++) {
            const checkpoint = this.distanceCheckpoints[i];
            
            if (playerDistance >= checkpoint && this.lastDistanceCheckpoint < checkpoint) {
                // Player reached a new checkpoint, update difficulty
                this.lastDistanceCheckpoint = checkpoint;
                
                // Increase difficulty based on checkpoint level
                switch (i) {
                    case 0: // 500 distance
                        this.spawnCount = Math.max(this.spawnCount, 3);
                        this.trackingAsteroidChance = Math.max(this.trackingAsteroidChance, 0.15);
                        this.boundaryDensity = Math.max(this.boundaryDensity, 0.6);
                        console.log("Distance checkpoint 500 reached: Increasing difficulty!");
                        break;
                    case 1: // 1000 distance
                        this.spawnCount = Math.max(this.spawnCount, 4);
                        this.spawnInterval = Math.min(this.spawnInterval, 0.85);
                        this.trackingAsteroidChance = Math.max(this.trackingAsteroidChance, 0.18);
                        this.directPathChance = Math.max(this.directPathChance, 0.25);
                        this.maxAsteroids = Math.max(this.maxAsteroids, 60);
                        this.boundaryDensity = Math.max(this.boundaryDensity, 0.7);
                        console.log("Distance checkpoint 1000 reached: Increasing difficulty!");
                        break;
                    case 2: // 2000 distance
                        this.spawnCount = Math.max(this.spawnCount, 5);
                        this.spawnInterval = Math.min(this.spawnInterval, 0.8);
                        this.trackingAsteroidChance = Math.max(this.trackingAsteroidChance, 0.2);
                        this.directPathChance = Math.max(this.directPathChance, 0.28);
                        this.maxAsteroids = Math.max(this.maxAsteroids, 70);
                        this.boundaryDensity = Math.max(this.boundaryDensity, 0.8);
                        console.log("Distance checkpoint 2000 reached: Increasing difficulty!");
                        break;
                    case 3: // 3000 distance
                        this.spawnCount = Math.max(this.spawnCount, 6);
                        this.spawnInterval = Math.min(this.spawnInterval, 0.7);
                        this.trackingAsteroidChance = Math.max(this.trackingAsteroidChance, 0.22);
                        this.directPathChance = Math.max(this.directPathChance, 0.3);
                        this.maxAsteroids = Math.max(this.maxAsteroids, 80);
                        this.boundaryDensity = Math.max(this.boundaryDensity, 0.9);
                        console.log("Distance checkpoint 3000 reached: Increasing difficulty!");
                        break;
                    case 4: // 5000 distance
                        this.spawnCount = Math.max(this.spawnCount, 7);
                        this.spawnInterval = Math.min(this.spawnInterval, 0.6);
                        this.trackingAsteroidChance = Math.max(this.trackingAsteroidChance, 0.25);
                        this.directPathChance = Math.max(this.directPathChance, 0.32);
                        this.maxAsteroids = Math.max(this.maxAsteroids, 90);
                        this.boundaryDensity = Math.max(this.boundaryDensity, 1.0);
                        console.log("Distance checkpoint 5000 reached: Increasing difficulty!");
                        break;
                    case 5: // 7500 distance
                        this.spawnCount = Math.max(this.spawnCount, 8);
                        this.spawnInterval = Math.min(this.spawnInterval, 0.5);
                        this.trackingAsteroidChance = Math.max(this.trackingAsteroidChance, 0.28);
                        this.directPathChance = Math.max(this.directPathChance, 0.35);
                        this.maxAsteroids = Math.max(this.maxAsteroids, 100);
                        this.boundaryDensity = Math.max(this.boundaryDensity, 1.0);
                        console.log("Distance checkpoint 7500 reached: Increasing difficulty!");
                        break;
                    case 6: // 10000 distance
                        this.spawnCount = Math.max(this.spawnCount, 10);
                        this.spawnInterval = Math.min(this.spawnInterval, 0.4);
                        this.trackingAsteroidChance = Math.max(this.trackingAsteroidChance, 0.3);
                        this.directPathChance = Math.max(this.directPathChance, 0.4);
                        this.maxAsteroids = Math.max(this.maxAsteroids, 110);
                        this.boundaryDensity = Math.max(this.boundaryDensity, 1.0);
                        console.log("Distance checkpoint 10000 reached: Maximum difficulty!");
                        break;
                }
            }
        }
    }

    // New method to spawn boundary asteroids that create barriers when player moves too far
    spawnBoundaryAsteroids() {
        const playerPosition = this.game.player.getPosition();
        
        // Limit the total number of boundary asteroids
        if (this.boundaryAsteroids.length >= this.maxAsteroids * 0.5) {
            return;
        }
        
        // Calculate number to spawn based on density
        const count = Math.ceil(3 * this.boundaryDensity);
        
        for (let i = 0; i < count; i++) {
            // Clone asteroid model
            const asteroid = this.asteroidModel.clone();
            asteroid.visible = true;
            
            // Determine which boundary to spawn on (top, bottom, left, right, or near z-axis)
            const boundaryType = Math.floor(Math.random() * 5);
            
            // Variables to set
            let x, y, z;
            let lateralX = 0, lateralY = 0;
            
            // Spawn distance for this asteroid
            const dist = this.boundaryDistance * (0.9 + Math.random() * 0.3);
            
            switch (boundaryType) {
                case 0: // Left boundary
                    x = playerPosition.x - dist;
                    y = playerPosition.y + getRandomFloat(-dist/2, dist/2);
                    z = playerPosition.z + getRandomFloat(-30, 0);
                    lateralX = getRandomFloat(2, 5); // Move right (toward player)
                    break;
                    
                case 1: // Right boundary
                    x = playerPosition.x + dist;
                    y = playerPosition.y + getRandomFloat(-dist/2, dist/2);
                    z = playerPosition.z + getRandomFloat(-30, 0);
                    lateralX = getRandomFloat(-5, -2); // Move left (toward player)
                    break;
                    
                case 2: // Top boundary
                    x = playerPosition.x + getRandomFloat(-dist/2, dist/2);
                    y = playerPosition.y + dist;
                    z = playerPosition.z + getRandomFloat(-30, 0);
                    lateralY = getRandomFloat(-5, -2); // Move down (toward player)
                    break;
                    
                case 3: // Bottom boundary
                    x = playerPosition.x + getRandomFloat(-dist/2, dist/2);
                    y = playerPosition.y - dist;
                    z = playerPosition.z + getRandomFloat(-30, 0);
                    lateralY = getRandomFloat(2, 5); // Move up (toward player)
                    break;
                    
                case 4: // Far ahead for extreme forward movement
                    x = playerPosition.x + getRandomFloat(-20, 20);
                    y = playerPosition.y + getRandomFloat(-20, 20);
                    z = playerPosition.z - this.spawnDistance * 1.2;
                    break;
            }
            
            asteroid.position.set(x, y, z);
            
            // Scale varies by distance - further asteroids appear larger
            const distanceFactor = 1 + ((dist / this.boundaryDistance) - 1) * 0.5;
            const scale = getRandomFloat(0.02, 0.05) * distanceFactor;
            asteroid.scale.set(scale, scale, scale);
            
            // Random rotation speed
            asteroid.rotationSpeed = {
                x: getRandomFloat(-0.5, 0.5),
                y: getRandomFloat(-0.5, 0.5),
                z: getRandomFloat(-0.5, 0.5)
            };
            
            // Movement speed
            asteroid.speed = getRandomFloat(10, 15);
            
            // Add lateral movement
            asteroid.lateralMovement = {
                x: lateralX,
                y: lateralY
            };
            
            // 20% chance for boundary tracking asteroids
            asteroid.isTracking = Math.random() < 0.2;
            
            if (asteroid.isTracking) {
                asteroid.speed *= 0.7;
                asteroid.trackingStrength = 0.4;
                
                // Make tracking asteroids visually distinctive
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xff4444); // Reddish color
                    }
                });
            }
            
            // Mark this as a boundary asteroid with a distinct color
            if (!asteroid.isTracking) {
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0x666666); // Darker gray color for boundary asteroids
                    }
                });
            }
            
            // Add to scene
            this.game.scene.add(asteroid);
            this.boundaryAsteroids.push(asteroid);
            
            // Create hitbox for collision detection
            const boundingBox = new THREE.Box3().setFromObject(asteroid);
            const size = new THREE.Vector3();
            boundingBox.getSize(size);
            
            asteroid.hitboxSize = {
                width: size.x * 0.8,
                height: size.y * 0.8,
                depth: size.z * 0.8
            };
        }
    }
}
