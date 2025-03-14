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
        this.spawnInterval = 0.3;                 // Decreased from 0.9 to spawn much more frequently
        this.spawnTimer = 0;
        this.spawnCount = 10;                     // Increased from 3 to create many more asteroids at once
        this.minSpawnX = -40;                     // Wider spawn area
        this.maxSpawnX = 40;                      // Wider spawn area
        this.minSpawnY = -20;                     // Wider spawn area
        this.maxSpawnY = 20;                      // Wider spawn area
        this.damageAmount = 10;                   // Keep the same
        this.gameTime = 0;                        // Keep the same
        this.maxAsteroids = 500;                  // Drastically increased from 70 to allow hundreds of asteroids
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
        
        // Asteroid recycling properties
        this.asteroidPool = [];                   // Pool of inactive asteroids for recycling
        this.poolSize = 500;                      // Max size of the asteroid pool
        this.recycleChunkSize = 20;               // Process recycling in chunks to avoid performance issues
        this.lastRecycleTime = 0;                 // Track last recycle operation time
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
        
        // Track recycled asteroids in this update cycle
        let recycledCount = 0;
        
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
            
            // Check if asteroid is behind player and should be recycled
            if (asteroid.position.z > playerPosition.z + this.despawnDistance) {
                // Instead of removing, recycle into the pool
                this.recycleAsteroid(asteroid);
                recycledCount++;
                
                // Remove from active arrays
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
                
                // Recycle asteroid instead of just removing
                this.recycleAsteroid(asteroid);
                recycledCount++;
                
                // Remove from active arrays
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
                    
                    // Recycle asteroid instead of just removing
                    this.recycleAsteroid(asteroid);
                    recycledCount++;
                    
                    // Remove from active arrays
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
        
        // If recycled a significant number of asteroids, log for debugging
        if (recycledCount > 10) {
            console.log(`Recycled ${recycledCount} asteroids. Pool size: ${this.asteroidPool.length}`);
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
        
        // Determine how many to spawn this cycle
        const spawnTarget = Math.min(this.spawnCount, this.maxAsteroids - this.asteroids.length);
        let spawnedCount = 0;
        
        for (let i = 0; i < spawnTarget; i++) {
            let asteroid;
            
            // Try to reuse an asteroid from the pool first
            if (this.asteroidPool.length > 0) {
                // Use recycling in chunks to prevent performance issues
                // Only recycle a specific number per frame unless pool is nearly full
                const currentTime = performance.now();
                const timeSinceLastRecycle = currentTime - this.lastRecycleTime;
                const isPoolNearlyFull = this.asteroidPool.length > this.poolSize * 0.8;
                
                // Recycle if enough time has passed or pool is getting full
                if (timeSinceLastRecycle > 500 || isPoolNearlyFull || spawnedCount < this.recycleChunkSize) {
                    asteroid = this.asteroidPool.pop();
                    asteroid.visible = true;
                    this.lastRecycleTime = currentTime;
                } else {
                    // Skip recycling this frame to spread out the load
                    continue;
                }
            } else {
                // Create a new asteroid if pool is empty
                asteroid = this.asteroidModel.clone();
                asteroid.visible = true;
            }
            
            // Determine spawn position
            let x, y, z;
            const spawnType = Math.random();
            
            // Wider spawn area constants - INCREASED for better distribution
            const horizontalSpread = 100; // Increased from 60 for much greater left-right spread
            const verticalSpread = 40;   // Increased from 25 for greater up-down spread
            
            if (spawnType < this.directPathChance) {
                // Spawn directly in front of player's path, but with more variation
                x = playerPosition.x + getRandomFloat(-20, 20); // Increased from -12,12
                y = playerPosition.y + getRandomFloat(-15, 15); // Increased from -8,8
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
                    // 40% in the whole field, with much wider range
                    x = playerPosition.x + getRandomFloat(-horizontalSpread, horizontalSpread);
                }
                
                // Vertical position with less edge bias but wider spread
                y = playerPosition.y + getRandomFloat(-verticalSpread, verticalSpread);
                z = playerPosition.z + this.spawnDistance;
            } else {
                // Spawn in player area (new method) - remaining chance
                // Random position around the player within a certain radius
                const radius = getRandomFloat(30, 60); // Increased from 20-40
                const angle = getRandomFloat(0, Math.PI * 2);
                
                x = playerPosition.x + Math.cos(angle) * radius;
                y = playerPosition.y + Math.sin(angle) * radius;
                
                // Spawn slightly ahead of player to give reaction time
                z = playerPosition.z - getRandomFloat(10, 80); // Increased from 10-50
            }
            
            asteroid.position.set(x, y, z);
            
            // Random scale with more size variation for visual interest
            const scale = getRandomFloat(0.015, 0.045); // Keep the same size scale
            asteroid.scale.set(scale, scale, scale);
            
            // Random rotation speed
            asteroid.rotationSpeed = {
                x: getRandomFloat(-0.5, 0.5),
                y: getRandomFloat(-0.5, 0.5),
                z: getRandomFloat(-0.5, 0.5)
            };
            
            // Movement speed with more variation
            asteroid.speed = getRandomFloat(8, 22); // Wider speed range (was 10-20)
            
            // Add lateral movement with more sideways motion for greater spread over time
            asteroid.lateralMovement = {
                x: getRandomFloat(-10, 10), // Increased from -7,7
                y: getRandomFloat(-6, 6)    // Increased from -4,4
            };
            
            // Make asteroids brighter by increasing material brightness
            asteroid.traverse(child => {
                if (child.isMesh && child.material) {
                    // Clone to avoid affecting other asteroids
                    child.material = child.material.clone();
                    
                    // Increase brightness for better visibility
                    if (!child.material.emissive) {
                        child.material.emissive = new THREE.Color(0x333333);
                    } else {
                        child.material.emissive.set(0x333333);
                    }
                    
                    // Increase material color intensity
                    if (child.material.color) {
                        const color = child.material.color.clone();
                        // Brighten the color (multiply RGB values while keeping them in valid range)
                        color.r = Math.min(1.0, color.r * 1.3);
                        color.g = Math.min(1.0, color.g * 1.3);
                        color.b = Math.min(1.0, color.b * 1.3);
                        child.material.color = color;
                    }
                }
            });
            
            // Determine if this is a tracking asteroid (10% chance)
            asteroid.isTracking = Math.random() < this.trackingAsteroidChance;
            
            // Tracking asteroids move slightly slower for balance
            if (asteroid.isTracking) {
                asteroid.speed *= 0.8;
                asteroid.trackingStrength = 0.5; // How strongly it tracks the player (0.0 to 1.0)
                
                // Make tracking asteroids visually distinctive with a brighter reddish tint
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone(); // Clone material to avoid affecting other asteroids
                        child.material.color.setHex(0xff6666); // Brighter reddish color
                        child.material.emissive = new THREE.Color(0x331111); // Add red glow
                    }
                });
            } else {
                // Reset color for non-tracking asteroids (might be reused)
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        if (!asteroid.isTracking) {
                            child.material = child.material.clone(); 
                            child.material.color.setHex(0xffffff); // Default white color
                        }
                    }
                });
            }
            
            // Add to scene and array
            this.game.scene.add(asteroid);
            this.asteroids.push(asteroid);
            spawnedCount++;
            
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
        
        // Log when we spawn a significant number of asteroids
        if (spawnedCount > 5) {
            console.log(`Spawned ${spawnedCount} asteroids. Total active: ${this.asteroids.length}, Pool size: ${this.asteroidPool.length}`);
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
        let spawnedCount = 0;
        
        for (let i = 0; i < count; i++) {
            let asteroid;
            
            // Try to reuse an asteroid from the pool first
            if (this.asteroidPool.length > 0) {
                asteroid = this.asteroidPool.pop();
                asteroid.visible = true;
            } else {
                // Create a new asteroid if pool is empty
                asteroid = this.asteroidModel.clone();
                asteroid.visible = true;
            }
            
            // Determine which boundary to spawn on (top, bottom, left, right, or near z-axis)
            const boundaryType = Math.floor(Math.random() * 5);
            
            // Variables to set
            let x, y, z;
            let lateralX = 0, lateralY = 0;
            
            // Spawn distance for this asteroid - increased for better spread
            const dist = this.boundaryDistance * (1.0 + Math.random() * 0.5); // Increased from 0.9 + 0.3
            
            switch (boundaryType) {
                case 0: // Left boundary
                    x = playerPosition.x - dist;
                    y = playerPosition.y + getRandomFloat(-dist/1.5, dist/1.5); // Increased vertical spread
                    z = playerPosition.z + getRandomFloat(-50, 0); // Increased depth variation
                    lateralX = getRandomFloat(3, 7); // Increased from 2-5, more speed toward player
                    break;
                    
                case 1: // Right boundary
                    x = playerPosition.x + dist;
                    y = playerPosition.y + getRandomFloat(-dist/1.5, dist/1.5); // Increased vertical spread
                    z = playerPosition.z + getRandomFloat(-50, 0); // Increased depth variation
                    lateralX = getRandomFloat(-7, -3); // Increased from -5,-2, more speed toward player
                    break;
                    
                case 2: // Top boundary
                    x = playerPosition.x + getRandomFloat(-dist/1.5, dist/1.5); // Increased horizontal spread
                    y = playerPosition.y + dist;
                    z = playerPosition.z + getRandomFloat(-50, 0); // Increased depth variation
                    lateralY = getRandomFloat(-7, -3); // Increased from -5,-2, more speed toward player
                    break;
                    
                case 3: // Bottom boundary
                    x = playerPosition.x + getRandomFloat(-dist/1.5, dist/1.5); // Increased horizontal spread
                    y = playerPosition.y - dist;
                    z = playerPosition.z + getRandomFloat(-50, 0); // Increased depth variation
                    lateralY = getRandomFloat(3, 7); // Increased from 2-5, more speed toward player
                    break;
                    
                case 4: // Far ahead for extreme forward movement
                    x = playerPosition.x + getRandomFloat(-35, 35); // Increased from -20,20
                    y = playerPosition.y + getRandomFloat(-35, 35); // Increased from -20,20
                    z = playerPosition.z - this.spawnDistance * 1.5; // Increased from 1.2
                    break;
            }
            
            asteroid.position.set(x, y, z);
            
            // Scale varies by distance - further asteroids appear larger
            const distanceFactor = 1 + ((dist / this.boundaryDistance) - 1) * 0.7; // Increased from 0.5
            const scale = getRandomFloat(0.02, 0.06) * distanceFactor; // Increased max from 0.05
            asteroid.scale.set(scale, scale, scale);
            
            // Random rotation speed
            asteroid.rotationSpeed = {
                x: getRandomFloat(-0.6, 0.6), // Slightly increased from -0.5,0.5
                y: getRandomFloat(-0.6, 0.6), // Slightly increased from -0.5,0.5
                z: getRandomFloat(-0.6, 0.6)  // Slightly increased from -0.5,0.5
            };
            
            // Movement speed with slightly more variation
            asteroid.speed = getRandomFloat(10, 18); // Increased max from 15
            
            // Add lateral movement with more variation
            asteroid.lateralMovement = {
                x: lateralX,
                y: lateralY
            };
            
            // Make boundary asteroids brighter by increasing material brightness
            asteroid.traverse(child => {
                if (child.isMesh && child.material) {
                    // Clone to avoid affecting other asteroids
                    child.material = child.material.clone();
                    
                    // Add emissive property for better visibility
                    if (!child.material.emissive) {
                        child.material.emissive = new THREE.Color(0x222222);
                    } else {
                        child.material.emissive.set(0x222222);
                    }
                    
                    // Increase material color intensity
                    if (child.material.color) {
                        const color = child.material.color.clone();
                        // Brighten the color
                        color.r = Math.min(1.0, color.r * 1.3);
                        color.g = Math.min(1.0, color.g * 1.3);
                        color.b = Math.min(1.0, color.b * 1.3);
                        child.material.color = color;
                    }
                }
            });
            
            // 20% chance for boundary tracking asteroids
            asteroid.isTracking = Math.random() < 0.2;
            
            if (asteroid.isTracking) {
                asteroid.speed *= 0.7;
                asteroid.trackingStrength = 0.4;
                
                // Make tracking asteroids visually distinctive with brighter colors
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xff6666); // Brighter reddish color than before
                        child.material.emissive = new THREE.Color(0x331111); // Add red glow
                    }
                });
            }
            
            // Mark this as a boundary asteroid with a distinct color
            if (!asteroid.isTracking) {
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0x888888); // Lighter gray than before (was 0x666666)
                        child.material.emissive = new THREE.Color(0x222222); // Add slight glow
                    }
                });
            }
            
            // Add to scene
            this.game.scene.add(asteroid);
            this.boundaryAsteroids.push(asteroid);
            spawnedCount++;
            
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
        
        // Log significant boundary asteroid spawns
        if (spawnedCount > 2) {
            console.log(`Spawned ${spawnedCount} boundary asteroids. Total: ${this.boundaryAsteroids.length}`);
        }
    }

    // New method to recycle asteroids
    recycleAsteroid(asteroid) {
        // Remove from scene but keep the object
        this.game.scene.remove(asteroid);
        
        // Only store in pool if we haven't reached max pool size
        if (this.asteroidPool.length < this.poolSize) {
            // Reset any modified properties
            asteroid.visible = false;
            
            // Add to pool for later reuse
            this.asteroidPool.push(asteroid);
        }
    }
}
