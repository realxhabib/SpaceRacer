/**
 * Asteroids manager for Space Racer game
 */

class AsteroidsManager {
    constructor(game) {
        this.game = game;
        this.asteroids = [];
        this.asteroidModel = null;
        this.spawnDistance = -1600;               // CHANGED: Doubled from -800 to make asteroids appear much further away
        this.despawnDistance = 50;                // Keep the same
        this.spawnInterval = 0.5;                 // Keep the same
        this.spawnTimer = 0;
        this.spawnCount = 5;                      // Keep the same 
        this.minSpawnX = -40;                     // Keep the same
        this.maxSpawnX = 40;                      // Keep the same
        this.minSpawnY = -20;                     // Keep the same
        this.maxSpawnY = 20;                      // Keep the same
        this.damageAmount = 10;                   // Keep the same
        this.gameTime = 0;                        // Keep the same
        this.maxAsteroids = 300;                  // Keep the same
        this.trackingAsteroidChance = 0.1;        // Keep the same
        this.directPathChance = 0.2;              // Keep the same
        this.distanceCheckpoints = [500, 1000, 2000, 3000, 5000, 7500, 10000]; // Keep the same
        this.lastDistanceCheckpoint = 0;          // Keep the same
        
        // New properties for distance-based scaling
        this.minScaleFactor = 0.2;                // Minimum scale for very distant asteroids
        this.maxScaleFactor = 1.0;                // Maximum scale for close asteroids
        this.scalingStartDistance = 1500;         // Distance at which scaling begins
        this.scalingEndDistance = 200;            // Distance at which asteroids reach full size
        
        // New properties for boundary asteroids
        this.boundaryDistance = 100;               // Distance from player at which boundary asteroids spawn
        this.boundaryDensity = 1.0;               // 0-1 value for how dense the boundary asteroid field is
        this.boundarySpawnInterval = 1.0;         // Time between boundary asteroid spawns
        this.boundarySpawnTimer = 0;              // Timer for boundary asteroids
        this.boundaryAsteroids = [];              // Track boundary asteroids separately
        
        // Asteroid recycling properties
        this.asteroidPool = [];                   // Pool of inactive asteroids for recycling
        this.poolSize = 100;                      // Max size of the asteroid pool
        this.recycleChunkSize = 5;               // Process recycling in chunks to avoid performance issues
        this.lastRecycleTime = 0;                 // Track last recycle operation time
        
        // Add path asteroids timer
        this.pathAsteroidsInterval = 0.3; // Spawn path asteroids every 0.3 seconds
        this.pathAsteroidsTimer = 0;
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
        
        // Update path asteroids timer
        this.pathAsteroidsTimer += deltaTime;
        
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
        
        // Spawn path asteroids
        if (this.pathAsteroidsTimer >= this.pathAsteroidsInterval) {
            this.pathAsteroidsTimer = 0;
            this.spawnPathAsteroids();
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
            
            // NEW: Update asteroid scale based on distance to player
            this.updateAsteroidScale(asteroid, playerPosition);
            
            // Apply special movement patterns based on speed
            if (asteroid.speed > 35) {
                // Ultra-fast asteroids can have slight homing behavior and erratic movements
                // Apply slight oscillation to create a more erratic path
                if (!asteroid.oscillation) {
                    asteroid.oscillation = {
                        xFreq: 0.5 + Math.random() * 1.5,
                        yFreq: 0.5 + Math.random() * 1.5,
                        xAmp: 0.1 + Math.random() * 0.3,
                        yAmp: 0.1 + Math.random() * 0.3,
                        offset: Math.random() * Math.PI * 2
                    };
                }
                
                // Oscillation effect for erratic movement
                const xOsc = Math.sin(this.gameTime * asteroid.oscillation.xFreq + asteroid.oscillation.offset) * asteroid.oscillation.xAmp;
                const yOsc = Math.cos(this.gameTime * asteroid.oscillation.yFreq + asteroid.oscillation.offset) * asteroid.oscillation.yAmp;
                
                asteroid.position.x += xOsc;
                asteroid.position.y += yOsc;
                
                // Slight homing effect toward player's position
                if (Math.random() < 0.05) { // Only apply occasionally for performance
                    const dirToPlayer = {
                        x: playerPosition.x - asteroid.position.x,
                        y: playerPosition.y - asteroid.position.y
                    };
                    
                    const dist = Math.sqrt(dirToPlayer.x * dirToPlayer.x + dirToPlayer.y * dirToPlayer.y);
                    if (dist > 0) {
                        // Very subtle homing effect
                        asteroid.position.x += (dirToPlayer.x / dist) * 0.2;
                        asteroid.position.y += (dirToPlayer.y / dist) * 0.2;
                    }
                }
                
                // Add trail effects for very fast asteroids
                this.createSpeedTrail(asteroid, deltaTime);
            } 
            else if (asteroid.speed > 25) {
                // Fast asteroids have smoother but still slightly unpredictable movement
                if (!asteroid.oscillation) {
                    asteroid.oscillation = {
                        xFreq: 0.3 + Math.random() * 0.7,
                        yFreq: 0.3 + Math.random() * 0.7,
                        xAmp: 0.05 + Math.random() * 0.15, // Smaller amplitude
                        yAmp: 0.05 + Math.random() * 0.15,
                        offset: Math.random() * Math.PI * 2
                    };
                }
                
                // Gentler oscillation
                const xOsc = Math.sin(this.gameTime * asteroid.oscillation.xFreq + asteroid.oscillation.offset) * asteroid.oscillation.xAmp;
                const yOsc = Math.cos(this.gameTime * asteroid.oscillation.yFreq + asteroid.oscillation.offset) * asteroid.oscillation.yAmp;
                
                asteroid.position.x += xOsc;
                asteroid.position.y += yOsc;
                
                // Add trail effects for fast asteroids
                if (Math.random() < 0.4) { // Less frequent trails than ultra-fast
                    this.createSpeedTrail(asteroid, deltaTime);
                }
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
            
            // Update rotation - faster asteroids rotate more quickly
            const rotationMultiplier = asteroid.speed > 25 ? 3.0 : (asteroid.speed > 18 ? 2.0 : 1.0);
            asteroid.rotation.x += asteroid.rotationSpeed.x * deltaTime * rotationMultiplier;
            asteroid.rotation.y += asteroid.rotationSpeed.y * deltaTime * rotationMultiplier;
            asteroid.rotation.z += asteroid.rotationSpeed.z * deltaTime * rotationMultiplier;
            
            // Check for collision with player
            if (this.checkCollision(asteroid, this.game.player)) {
                // Player takes damage - faster asteroids deal more damage
                const damageMultiplier = asteroid.speed > 35 ? 2.0 : (asteroid.speed > 25 ? 1.5 : 1.0);
                this.game.player.takeDamage(Math.ceil(this.damageAmount * damageMultiplier));
                
                // Stronger screen shake for faster asteroids
                const shakeIntensity = 0.2 * damageMultiplier;
                const shakeDuration = 0.2 * damageMultiplier;
                this.game.applyScreenShake(shakeIntensity, shakeDuration);
                
                // Recycle asteroid instead of just removing
                this.recycleAsteroid(asteroid);
                recycledCount++;
                
                // Remove from active arrays
                if (isRegularAsteroid) {
                    this.asteroids.splice(i, 1);
                } else {
                    this.boundaryAsteroids.splice(i - this.asteroids.length, 1);
                }
                
                // Create explosion effect - bigger for faster asteroids
                this.createExplosion(asteroid.position, false, damageMultiplier);
                continue;
            }
            
            // Check for collision with bullets
            let hitByBullet = false;
            for (const bullet of this.game.player.bullets) {
                if (bullet.active && this.checkBulletCollision(bullet.mesh, asteroid)) {
                    // Deactivate bullet
                    bullet.active = false;
                    bullet.mesh.visible = false;
                    
                    // Very fast asteroids might not be destroyed by a single bullet
                    if (asteroid.speed > 35 && !asteroid.hitPoints) {
                        asteroid.hitPoints = 2; // Ultra-fast asteroids take 3 hits
                    } else if (asteroid.speed > 25 && !asteroid.hitPoints) {
                        asteroid.hitPoints = 1; // Fast asteroids take 2 hits
                    }
                    
                    // Check if asteroid should be destroyed or just damaged
                    if (asteroid.hitPoints && asteroid.hitPoints > 0) {
                        asteroid.hitPoints--;
                        
                        // Create hit effect but don't destroy
                        this.createExplosion(asteroid.position, true, 0.5);
                        
                        // Visual feedback for damaged asteroid
                        asteroid.traverse(child => {
                            if (child.isMesh && child.material) {
                                // Add damage glow
                                child.material.emissive = new THREE.Color(0x553333);
                            }
                        });
                        continue; // Skip recycling, just proceed to next asteroid
                    }
                    
                    // Recycle asteroid instead of just removing
                    this.recycleAsteroid(asteroid);
                    recycledCount++;
                    
                    // Remove from active arrays
                    if (isRegularAsteroid) {
                        this.asteroids.splice(i, 1);
                    } else {
                        this.boundaryAsteroids.splice(i - this.asteroids.length, 1);
                    }
                    
                    // Create explosion effect - bigger for faster asteroids
                    const explosionMultiplier = asteroid.speed > 25 ? 1.5 : 1.0;
                    this.createExplosion(asteroid.position, true, explosionMultiplier);
                    
                    hitByBullet = true;
                    break;
                }
            }
            
            if (hitByBullet) {
                continue;
            }
        }
        
        // Update animated particle effects
        this.updateAnimatedParticles(deltaTime);
        
        // If recycled a significant number of asteroids, log for debugging
        if (recycledCount > 10) {
            console.log(`Recycled ${recycledCount} asteroids. Pool size: ${this.asteroidPool.length}`);
        }
        
        // Increase difficulty based on time AND distance
        this.updateDifficulty();
    }

    spawnAsteroids() {
        const playerPosition = this.game.player.getPosition();
        
        // Get player movement direction and velocity for predictive spawning
        const playerMovementDirection = this.game.player.movementDirection || { x: 0, y: 0 };
        const playerVelocity = {
            x: this.game.player.velocityX || 0,
            y: this.game.player.velocityY || 0
        };
        
        // Get player speed to adjust spawn distance - faster players need asteroids to spawn further ahead
        const playerSpeed = this.game.player.speed || 20;
        const speedFactor = playerSpeed / 20; // Normalize to base speed
        
        // Adjust spawn distance based on player speed
        const adjustedSpawnDistance = this.spawnDistance * Math.max(1.0, speedFactor * 0.8);
        
        // Track last recorded player positions to determine trajectory
        if (!this.playerPositionHistory) {
            this.playerPositionHistory = [];
        }
        
        // Add current position to history, keep last 10 positions
        this.playerPositionHistory.push({
            x: playerPosition.x,
            y: playerPosition.y,
            z: playerPosition.z,
            time: performance.now()
        });
        
        // Limit history size
        if (this.playerPositionHistory.length > 10) {
            this.playerPositionHistory.shift();
        }
        
        // Calculate movement trend if we have enough history
        let movementTrend = { x: 0, y: 0 };
        if (this.playerPositionHistory.length >= 3) {
            const newest = this.playerPositionHistory[this.playerPositionHistory.length - 1];
            const oldest = this.playerPositionHistory[0];
            
            // Calculate average movement direction over time
            const timeDiff = (newest.time - oldest.time) / 1000; // in seconds
            if (timeDiff > 0) {
                movementTrend.x = (newest.x - oldest.x) / timeDiff;
                movementTrend.y = (newest.y - oldest.y) / timeDiff;
            }
        }
        
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
            
            // SIGNIFICANTLY increased spawn area constants for much wider distribution
            const horizontalSpread = 200; // Increased from 120 to 200 for much greater left-right spread
            const verticalSpread = 120;   // Increased from 60 to 120 for much greater up-down spread
            
            // Predictive spawning - use player velocity and direction to anticipate their path
            // Higher prediction factor to spawn further ahead based on player speed
            const predictionFactor = 3.0 * speedFactor; // Scale with player speed
            
            // Calculate predicted future position
            const predictedX = playerPosition.x + (movementTrend.x * predictionFactor);
            const predictedY = playerPosition.y + (movementTrend.y * predictionFactor);
            
            if (spawnType < this.directPathChance) {
                // Spawn directly in front of player's predicted path
                x = predictedX + getRandomFloat(-35, 35); // Widened from -25,25
                y = predictedY + getRandomFloat(-35, 35); // Widened from -25,25
                z = playerPosition.z + adjustedSpawnDistance * 0.7; // Use speed-adjusted spawn distance
            } else if (spawnType < this.directPathChance + 0.3) {
                // 30% chance: Spawn in the direction player is moving
                // Stronger bias along movement trend
                x = predictedX + (playerMovementDirection.x * horizontalSpread * 0.7) + getRandomFloat(-30, 30);
                y = predictedY + (playerMovementDirection.y * verticalSpread * 0.7) + getRandomFloat(-30, 30);
                z = playerPosition.z + adjustedSpawnDistance;
            } else if (spawnType < this.directPathChance + 0.7) {
                // 40% chance: Wide distribution biased toward edges but covering full area
                // This creates more asteroids on the sides rather than center
                
                // Improved distribution with wider spread
                // Create a grid-like distribution with more density and further reaching edges
                const gridColumns = 6; // Increased from 5
                const gridRows = 4;    // Increased from 3
                
                // Choose a cell in the grid with strong edge bias
                let cellX, cellY;
                
                if (Math.random() < 0.7) { // Increased edge bias from 0.6 to 0.7
                    // 70% favor edges (first/last column/row)
                    cellX = Math.random() < 0.5 ? 0 : gridColumns - 1;
                    cellY = Math.floor(Math.random() * gridRows);
                } else {
                    // 30% any cell
                    cellX = Math.floor(Math.random() * gridColumns);
                    cellY = Math.floor(Math.random() * gridRows);
                }
                
                // Convert cell to position with some randomness within the cell
                const cellWidth = horizontalSpread * 2 / gridColumns;
                const cellHeight = verticalSpread * 2 / gridRows;
                
                x = predictedX - horizontalSpread + (cellX * cellWidth) + getRandomFloat(0, cellWidth);
                y = predictedY - verticalSpread + (cellY * cellHeight) + getRandomFloat(0, cellHeight);
                z = playerPosition.z + adjustedSpawnDistance;
            } else {
                // Remaining ~30%: Spawn in full 360° radius around predicted position with wider radius
                const radius = getRandomFloat(40, 100); // Increased from 30-70 for wider coverage
                const angle = getRandomFloat(0, Math.PI * 2);
                
                x = predictedX + Math.cos(angle) * radius;
                y = predictedY + Math.sin(angle) * radius;
                
                // Spawn slightly ahead of player to give reaction time
                z = playerPosition.z - getRandomFloat(40, 120); // Increased from 20-100
            }
            
            asteroid.position.set(x, y, z);
            
            // Random scale with more size variation for visual interest
            const scale = getRandomFloat(0.015, 0.055); // Keep original scale range
            asteroid.scale.set(scale, scale, scale);
            
            // NEW: Store base scale for distance-based scaling
            asteroid.baseScale = {
                x: scale,
                y: scale,
                z: scale
            };
            
            // Random rotation speed
            asteroid.rotationSpeed = {
                x: getRandomFloat(-0.5, 0.5),
                y: getRandomFloat(-0.5, 0.5),
                z: getRandomFloat(-0.5, 0.5)
            };
            
            // Apply more varied movement speeds with some being much faster
            // Use a bimodal distribution rather than uniform distribution
            let speed;
            
            // Determine if this will be a special "fast" asteroid (15% chance)
            const speedType = Math.random();
            
            if (speedType < 0.15) {
                // Fast asteroid - much higher speeds
                speed = getRandomFloat(25, 45) * Math.max(1.0, speedFactor * 0.3); // Scale with player speed
                
                // Make fast asteroids visually distinctive with a yellow/orange tint
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xffbb44); // Bright yellow-orange
                        child.material.emissive = new THREE.Color(0x332211); // Yellow glow
                    }
                });
                
                // Fast asteroids should be slightly smaller for balance
                const currentScale = asteroid.scale.x;
                asteroid.scale.set(currentScale * 0.9, currentScale * 0.9, currentScale * 0.9);
            } else if (speedType < 0.35) {
                // Medium-fast asteroid (20% chance)
                speed = getRandomFloat(18, 26) * Math.max(1.0, speedFactor * 0.2); // Scale with player speed
            } else if (speedType < 0.65) {
                // Normal asteroid (30% chance)
                speed = getRandomFloat(12, 18) * Math.max(1.0, speedFactor * 0.1); // Scale with player speed
            } else {
                // Slow asteroid (35% chance)
                speed = getRandomFloat(6, 12);
                
                // Slow asteroids should be slightly larger
                const currentScale = asteroid.scale.x;
                asteroid.scale.set(currentScale * 1.15, currentScale * 1.15, currentScale * 1.15);
            }
            
            // Set the asteroid's speed
            asteroid.speed = speed;
            
            // Add lateral movement with patterns based on spawn position
            // Asteroids at extreme edges tend to move inward for better coverage
            let lateralX = getRandomFloat(-12, 12); // Increased from -10,10
            let lateralY = getRandomFloat(-8, 8);   // Increased from -6,6
            
            // If asteroid is far from center, add stronger inward bias
            const distanceFromCenterX = Math.abs(x - predictedX);
            const distanceFromCenterY = Math.abs(y - predictedY);
            
            if (distanceFromCenterX > horizontalSpread * 0.6) {
                // Add inward bias for extreme edge asteroids
                lateralX = x > predictedX ? 
                    getRandomFloat(-15, -5) : // Right side, move left (stronger bias)
                    getRandomFloat(5, 15);    // Left side, move right (stronger bias)
            }
            
            if (distanceFromCenterY > verticalSpread * 0.6) {
                // Add inward bias for extreme edge asteroids
                lateralY = y > predictedY ? 
                    getRandomFloat(-10, -4) : // Top side, move down (stronger bias)
                    getRandomFloat(4, 10);    // Bottom side, move up (stronger bias)
            }
            
            asteroid.lateralMovement = {
                x: lateralX,
                y: lateralY
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
                width: size.x * 0.8,
                height: size.y * 0.8,
                depth: size.z * 0.8
            };
            
            // NEW: Store base hitbox size for distance-based scaling
            asteroid.baseHitboxSize = {
                width: asteroid.hitboxSize.width,
                height: asteroid.hitboxSize.height,
                depth: asteroid.hitboxSize.depth
            };
            
            // NEW: Apply initial scale based on distance
            this.updateAsteroidScale(asteroid, playerPosition);
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

    // Enhanced explosion effect with size parameter and animation
    createExplosion(position, isFromBullet = false, sizeMultiplier = 1.0) {
        // Create particle system for explosion
        // Different colors based on whether it was hit by a bullet or player collision
        const color = isFromBullet ? 0xffff00 : 0xff5500; // Yellow for bullet hits, orange for collisions
        const particleCount = Math.floor((isFromBullet ? 70 : 50) * sizeMultiplier); // More particles for bigger explosions
        const particleSize = (isFromBullet ? 0.6 : 0.5) * sizeMultiplier; // Larger particles for bigger explosions
        
        // Determine if this is a fast asteroid explosion
        const isFastAsteroid = sizeMultiplier > 1.2;
        
        // Create options for explosion type
        const explosionOptions = {
            isExplosion: true, 
            isFastAsteroid: isFastAsteroid,
            velocityFactor: sizeMultiplier // Faster asteroids create more energetic explosions
        };
        
        // Create main explosion particles
        const particles = createParticleSystem(color, particleSize, particleCount, explosionOptions);
        particles.position.copy(position);
        this.game.scene.add(particles);
        
        // Add main particles to animation list if they have an update method
        if (typeof particles.update === 'function') {
            if (!this.animatedParticles) this.animatedParticles = [];
            this.animatedParticles.push(particles);
        }
        
        // Add a secondary burst effect for bullet hits or fast asteroids
        if (isFromBullet || isFastAsteroid) {
            // Create a secondary shockwave effect
            const shockwaveColor = isFromBullet ? 0xffffff : 0xff8800;
            const shockwave = createParticleSystem(
                shockwaveColor, 
                0.3 * sizeMultiplier, 
                20 * sizeMultiplier,
                { isExplosion: true, velocityFactor: sizeMultiplier * 0.7 }
            );
            shockwave.position.copy(position);
            this.game.scene.add(shockwave);
            
            // Add shockwave to animation list
            if (typeof shockwave.update === 'function') {
                if (!this.animatedParticles) this.animatedParticles = [];
                this.animatedParticles.push(shockwave);
            }
            
            // Apply screen shake for feedback - stronger for fast asteroids
            const shakeMultiplier = isFastAsteroid ? 1.5 : 1.0;
            this.game.applyScreenShake(
                0.2 * sizeMultiplier * shakeMultiplier, 
                0.15 * sizeMultiplier * shakeMultiplier
            );
            
            // For ultra-fast asteroids, add a special effect
            if (sizeMultiplier >= 1.8) {
                // Add a blast ring effect
                const ring = this.createBlastRing(position, 0xff3300, sizeMultiplier);
                this.game.scene.add(ring);
                
                // Remove ring after animation
                setTimeout(() => {
                    this.game.scene.remove(ring);
                }, 800);
            }
            
            // Add score notification (if score tracking is implemented)
            if (this.game.addScore) {
                // More points for faster asteroids
                const scoreValue = isFastAsteroid ? 200 : 100;
                this.game.addScore(scoreValue);
            }
            
            // Remove secondary effect after animation completes
            setTimeout(() => {
                this.game.scene.remove(shockwave);
                
                // Remove from animation list
                if (this.animatedParticles) {
                    const index = this.animatedParticles.indexOf(shockwave);
                    if (index !== -1) this.animatedParticles.splice(index, 1);
                }
            }, 1000);
        }
        
        // Remove main particles after animation completes
        setTimeout(() => {
            this.game.scene.remove(particles);
            
            // Remove from animation list
            if (this.animatedParticles) {
                const index = this.animatedParticles.indexOf(particles);
                if (index !== -1) this.animatedParticles.splice(index, 1);
            }
        }, 1200);
    }
    
    // Create a blast ring effect for ultra-fast asteroid explosions
    createBlastRing(position, color, sizeMultiplier) {
        // Create a ring geometry
        const ringGeometry = new THREE.RingGeometry(0.5, 2.0, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        // Create mesh
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        
        // Position at explosion center
        ring.position.copy(position);
        
        // Orient toward camera
        ring.lookAt(this.game.camera.position);
        
        // Scale based on size multiplier
        ring.scale.set(2 * sizeMultiplier, 2 * sizeMultiplier, 2 * sizeMultiplier);
        
        // Setup animation
        ring.userData = {
            age: 0,
            initialScale: 2 * sizeMultiplier,
            update: function(deltaTime) {
                this.userData.age += deltaTime;
                const normalizedAge = Math.min(this.userData.age / 0.8, 1.0);
                
                // Expand ring
                const scale = this.userData.initialScale * (1.0 + normalizedAge * 4.0);
                this.scale.set(scale, scale, scale);
                
                // Fade out
                this.material.opacity = 0.8 * (1.0 - normalizedAge);
                
                // Orient toward camera
                if (this.game && this.game.camera) {
                    this.lookAt(this.game.camera.position);
                }
                
                return normalizedAge < 1.0; // Continue until faded out
            }
        };
        
        // Store reference to game for camera updates
        ring.game = this.game;
        
        // Add to animation system
        if (!this.animatedParticles) this.animatedParticles = [];
        this.animatedParticles.push(ring);
        
        return ring;
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
            this.boundaryDistance = 30; // Tighten boundary
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
        
        // Get player movement data for adaptive spawning
        const playerMovementDirection = this.game.player.movementDirection || { x: 0, y: 0 };
        const playerVelocity = {
            x: this.game.player.velocityX || 0,
            y: this.game.player.velocityY || 0
        };
        
        // Get player speed to adjust spawn parameters
        const playerSpeed = this.game.player.speed || 20;
        const speedFactor = playerSpeed / 20; // Normalize to base speed
        
        // Use the movement history we track in spawnAsteroids for consistency
        let movementTrend = { x: 0, y: 0 };
        if (this.playerPositionHistory && this.playerPositionHistory.length >= 3) {
            const newest = this.playerPositionHistory[this.playerPositionHistory.length - 1];
            const oldest = this.playerPositionHistory[0];
            
            // Calculate average movement direction over time
            const timeDiff = (newest.time - oldest.time) / 1000; // in seconds
            if (timeDiff > 0) {
                movementTrend.x = (newest.x - oldest.x) / timeDiff;
                movementTrend.y = (newest.y - oldest.y) / timeDiff;
            }
        }
        
        // Limit the total number of boundary asteroids
        if (this.boundaryAsteroids.length >= this.maxAsteroids * 0.5) {
            return;
        }
        
        // Calculate number to spawn based on density, more if player is moving quickly
        const velocityMagnitude = Math.sqrt(
            Math.pow(playerVelocity.x, 2) + 
            Math.pow(playerVelocity.y, 2)
        );
        
        // Increase count when player moves faster
        const speedFactor2 = Math.min(2.0, 1.0 + velocityMagnitude * 2.5); 
        const count = Math.ceil(4 * this.boundaryDensity * speedFactor2); // Increased base from 3 to 4
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
            
            // Weight the boundary types based on player movement
            // This makes more asteroids spawn in the direction the player is moving
            let boundaryWeights = [0.25, 0.25, 0.25, 0.25, 0]; // Default equal weights for left, right, top, bottom
            
            // Adjust weights based on player's movement trend
            if (Math.abs(movementTrend.x) > 0.2 || Math.abs(movementTrend.y) > 0.2) {
                // Calculate normalized weight adjustments
                const trendMagnitude = Math.sqrt(
                    Math.pow(movementTrend.x, 2) + 
                    Math.pow(movementTrend.y, 2)
                );
                
                if (trendMagnitude > 0) {
                    const normX = movementTrend.x / trendMagnitude;
                    const normY = movementTrend.y / trendMagnitude;
                    
                    // Apply weight adjustments - stronger bias based on movement
                    if (normX < -0.3) {
                        // Moving left, increase left boundary weight
                        boundaryWeights[0] += 0.4; // Increased from 0.3
                    } else if (normX > 0.3) {
                        // Moving right, increase right boundary weight
                        boundaryWeights[1] += 0.4; // Increased from 0.3
                    }
                    
                    if (normY > 0.3) {
                        // Moving up, increase top boundary weight
                        boundaryWeights[2] += 0.4; // Increased from 0.3
                    } else if (normY < -0.3) {
                        // Moving down, increase bottom boundary weight
                        boundaryWeights[3] += 0.4; // Increased from 0.3
                    }
                    
                    // Add weight for far ahead based on forward speed
                    boundaryWeights[4] = 0.3 * speedFactor; // Scale with player speed, increased from 0.2
                }
                
                // Normalize weights to sum to 1.0
                const totalWeight = boundaryWeights.reduce((sum, w) => sum + w, 0);
                boundaryWeights = boundaryWeights.map(w => w / totalWeight);
            }
            
            // Use weighted random selection for boundary type
            const random = Math.random();
            let cumulativeWeight = 0;
            let boundaryType = 0;
            
            for (let w = 0; w < boundaryWeights.length; w++) {
                cumulativeWeight += boundaryWeights[w];
                if (random < cumulativeWeight) {
                    boundaryType = w;
                    break;
                }
            }
            
            // Variables to set
            let x, y, z;
            let lateralX = 0, lateralY = 0;
            
            // Prediction for spawn position
            const predictionFactor = 2.5 * speedFactor; // Increased from 2.0 and scales with player speed
            const predictedX = playerPosition.x + (movementTrend.x * predictionFactor);
            const predictedY = playerPosition.y + (movementTrend.y * predictionFactor);
            
            // Spawn distance for this asteroid - INCREASED to make boundary asteroids visible from farther away
            const distBase = this.boundaryDistance * (1.5 + speedFactor * 0.5); // Increased from 1.0 to 1.5 base multiplier
            const dist = distBase * (1.0 + Math.random() * 0.8);
            
            switch (boundaryType) {
                case 0: // Left boundary
                    x = predictedX - dist;
                    // More variety on vertical position, and bias toward predicted path
                    y = predictedY + getRandomFloat(-dist/1.0, dist/1.0);
                    // Vary depth with more in front for faster players
                    z = playerPosition.z + getRandomFloat(-220 * speedFactor, 20); // Increased from -150 to -220 to make visible from farther
                    // Strong inward lateral movement, scaled with player speed
                    lateralX = getRandomFloat(5, 12) * Math.max(1.0, speedFactor * 0.5);
                    break;
                    
                case 1: // Right boundary
                    x = predictedX + dist;
                    // More variety on vertical position, and bias toward predicted path
                    y = predictedY + getRandomFloat(-dist/1.0, dist/1.0);
                    // Vary depth with more in front for faster players
                    z = playerPosition.z + getRandomFloat(-220 * speedFactor, 20); // Increased from -150 to -220
                    // Strong inward lateral movement, scaled with player speed
                    lateralX = getRandomFloat(-12, -5) * Math.max(1.0, speedFactor * 0.5);
                    break;
                    
                case 2: // Top boundary
                    // More variety on horizontal position, and bias toward predicted path
                    x = predictedX + getRandomFloat(-dist/1.0, dist/1.0);
                    y = predictedY + dist;
                    // Vary depth with more in front for faster players
                    z = playerPosition.z + getRandomFloat(-220 * speedFactor, 20); // Increased from -150 to -220
                    // Strong inward lateral movement, scaled with player speed
                    lateralY = getRandomFloat(-12, -5) * Math.max(1.0, speedFactor * 0.5);
                    break;
                    
                case 3: // Bottom boundary
                    // More variety on horizontal position, and bias toward predicted path
                    x = predictedX + getRandomFloat(-dist/1.0, dist/1.0);
                    y = predictedY - dist;
                    // Vary depth with more in front for faster players
                    z = playerPosition.z + getRandomFloat(-220 * speedFactor, 20); // Increased from -150 to -220
                    // Strong inward lateral movement, scaled with player speed
                    lateralY = getRandomFloat(5, 12) * Math.max(1.0, speedFactor * 0.5);
                    break;
                    
                case 4: // Far ahead for extreme forward movement
                    // Use much wider spread to ensure coverage of future path
                    x = predictedX + getRandomFloat(-80, 80);
                    y = predictedY + getRandomFloat(-80, 80);
                    // Much farther ahead, scaled with player speed - increased to be visible from farther away
                    z = playerPosition.z - this.spawnDistance * (2.2 + speedFactor * 0.6); // Increased from 1.8 to 2.2
                    
                    // Add stronger movement toward predicted player position
                    const dirToPredicted = {
                        x: predictedX - x,
                        y: predictedY - y
                    };
                    
                    // Normalize and scale with player speed
                    const dirMagnitude = Math.sqrt(dirToPredicted.x * dirToPredicted.x + dirToPredicted.y * dirToPredicted.y);
                    if (dirMagnitude > 0) {
                        const moveFactor = Math.max(1.0, speedFactor * 0.6);
                        lateralX = (dirToPredicted.x / dirMagnitude) * getRandomFloat(3, 6) * moveFactor;
                        lateralY = (dirToPredicted.y / dirMagnitude) * getRandomFloat(3, 6) * moveFactor;
                    }
                    break;
            }
            
            asteroid.position.set(x, y, z);
            
            // Scale varies by distance - further asteroids appear larger
            const distanceFactor = 1 + ((dist / this.boundaryDistance) - 1) * 0.7;
            const scale = getRandomFloat(0.02, 0.06) * distanceFactor;
            asteroid.scale.set(scale, scale, scale);
            
            // NEW: Store base scale for distance-based scaling
            asteroid.baseScale = {
                x: scale,
                y: scale,
                z: scale
            };
            
            // Random rotation speed
            asteroid.rotationSpeed = {
                x: getRandomFloat(-0.6, 0.6),
                y: getRandomFloat(-0.6, 0.6),
                z: getRandomFloat(-0.6, 0.6)
            };
            
            // Movement speed with much more variation - some very fast, some slower
            // Determine if player is targeting this boundary
            const targetingPlayerPath = (
                (boundaryType === 0 && playerVelocity.x < -0.3) || // Left boundary with player moving left
                (boundaryType === 1 && playerVelocity.x > 0.3) ||  // Right boundary with player moving right
                (boundaryType === 2 && playerVelocity.y > 0.3) ||  // Top boundary with player moving up
                (boundaryType === 3 && playerVelocity.y < -0.3)    // Bottom boundary with player moving down
            );
            
            // Use a more varied speed distribution
            const speedRoll = Math.random();
            let speed;
            
            if (speedRoll < 0.12) {
                // Ultra-fast missile-like asteroids (12% chance)
                speed = getRandomFloat(35, 60) * Math.max(1.0, speedFactor * 0.4); // Scale with player speed
                
                // Make ultra-fast asteroids visually distinctive with a red-orange glow
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xff4400); // Bright orange-red
                        child.material.emissive = new THREE.Color(0x331100); // Orange glow
                    }
                });
                
                // Faster asteroids are smaller and more elongated
                const currentScale = asteroid.scale.x;
                asteroid.scale.set(
                    currentScale * 0.8, 
                    currentScale * 0.8, 
                    currentScale * 1.2  // More elongated in movement direction
                );
                
                // Apply a streak effect for fast asteroids by adjusting rotation
                asteroid.rotation.x = Math.atan2(lateralY, Math.abs(lateralX) + 0.001);
                asteroid.rotation.y = Math.atan2(lateralX, 1);
            } else if (speedRoll < 0.35) {
                // Fast asteroids (23% chance)
                speed = getRandomFloat(22, 32) * Math.max(1.0, speedFactor * 0.3); // Scale with player speed
                
                // Make fast asteroids visually distinctive with a yellow tint
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xddbb33); // Yellow
                        child.material.emissive = new THREE.Color(0x222211); // Subtle glow
                    }
                });
                
                // Fast asteroids are slightly smaller
                const currentScale = asteroid.scale.x;
                asteroid.scale.set(currentScale * 0.9, currentScale * 0.9, currentScale * 0.9);
            } else if (speedRoll < 0.70) {
                // Normal asteroids (35% chance)
                speed = targetingPlayerPath ? 
                    getRandomFloat(14, 22) * Math.max(1.0, speedFactor * 0.2) : // Scale with player speed if targeting path
                    getRandomFloat(12, 18) * Math.max(1.0, speedFactor * 0.1);  // Scale less if not targeting
            } else {
                // Slow but larger asteroids (30% chance)
                speed = getRandomFloat(7, 14) * Math.max(1.0, speedFactor * 0.05); // Minimal scaling with player speed
                
                // Slow asteroids are larger
                const currentScale = asteroid.scale.x;
                asteroid.scale.set(currentScale * 1.2, currentScale * 1.2, currentScale * 1.2);
            }
            
            // Set asteroid speed
            asteroid.speed = speed;
            
            // Add lateral movement
            asteroid.lateralMovement = {
                x: lateralX,
                y: lateralY
            };
            
            // Make boundary asteroids visually distinct with a bluish tint
            // Only apply this to asteroids that haven't already been given a special color
            if (speedRoll >= 0.35) {
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        // Clone to avoid affecting other asteroids
                        child.material = child.material.clone();
                        
                        // Add emissive property for better visibility
                        if (!child.material.emissive) {
                            child.material.emissive = new THREE.Color(0x222233);
                        } else {
                            child.material.emissive.set(0x222233);
                        }
                        
                        // Increase material color intensity
                        if (child.material.color) {
                            const color = child.material.color.clone();
                            // Brighten the color with a slight blue tint
                            color.r = Math.min(1.0, color.r * 1.2);
                            color.g = Math.min(1.0, color.g * 1.2);
                            color.b = Math.min(1.0, color.b * 1.4); // More blue
                            child.material.color = color;
                        }
                    }
                });
            }
            
            // Add to scene and array
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
            
            // NEW: Store base hitbox size for distance-based scaling
            asteroid.baseHitboxSize = {
                width: asteroid.hitboxSize.width,
                height: asteroid.hitboxSize.height,
                depth: asteroid.hitboxSize.depth
            };
            
            // NEW: Apply initial scale based on distance
            this.updateAsteroidScale(asteroid, playerPosition);
        }
        
        // Log when we spawn a significant number of boundary asteroids
        if (spawnedCount > 3) {
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

    // Create a trail effect for fast-moving asteroids
    createSpeedTrail(asteroid, deltaTime) {
        // Only create trails when asteroid is in view
        if (asteroid.position.z > this.game.player.mesh.position.z - 300) {
            // Create a trail particle
            const trailGeometry = new THREE.SphereGeometry(0.15, 4, 4);
            let trailMaterial;
            
            // Color based on asteroid speed
            if (asteroid.speed > 35) {
                trailMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff3300,
                    transparent: true,
                    opacity: 0.7,
                    blending: THREE.AdditiveBlending
                });
            } else {
                trailMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffaa00,
                    transparent: true,
                    opacity: 0.5,
                    blending: THREE.AdditiveBlending
                });
            }
            
            const trail = new THREE.Mesh(trailGeometry, trailMaterial);
            
            // Position slightly behind the asteroid
            trail.position.copy(asteroid.position);
            trail.position.z += 0.2 + Math.random() * 0.3;
            
            // Add small random offset
            trail.position.x += (Math.random() - 0.5) * 0.3;
            trail.position.y += (Math.random() - 0.5) * 0.3;
            
            // Add to scene
            this.game.scene.add(trail);
            
            // Set up fade out and removal
            setTimeout(() => {
                // Fade out
                const fadeInterval = setInterval(() => {
                    if (trail.material.opacity > 0.05) {
                        trail.material.opacity -= 0.05;
                    } else {
                        clearInterval(fadeInterval);
                        this.game.scene.remove(trail);
                    }
                }, 50);
            }, 100);
        }
    }

    // Update animated particle effects
    updateAnimatedParticles(deltaTime) {
        if (!this.animatedParticles || this.animatedParticles.length === 0) return;
        
        // Update all animated particles and remove completed ones
        for (let i = this.animatedParticles.length - 1; i >= 0; i--) {
            const particle = this.animatedParticles[i];
            
            // Skip invalid particles
            if (!particle || !particle.userData || typeof particle.update !== 'function') {
                this.animatedParticles.splice(i, 1);
                continue;
            }
            
            // Call update method and check if animation is complete
            const continueAnimation = particle.update(deltaTime);
            
            if (!continueAnimation) {
                // Animation complete, remove from scene
                if (particle.parent) {
                    particle.parent.remove(particle);
                } else {
                    this.game.scene.remove(particle);
                }
                
                // Remove from list
                this.animatedParticles.splice(i, 1);
            }
        }
    }

    spawnPathAsteroids() {
        const playerPosition = this.game.player.getPosition();
        const playerSpeed = this.game.player.speed || 20;
        const speedFactor = playerSpeed / 20;

        // Limit the total number of asteroids to prevent performance issues
        if (this.asteroids.length >= this.maxAsteroids) {
            return;
        }

        // Adjust spawn count based on player speed
        const spawnCount = Math.min(
            Math.ceil(2 * speedFactor), 
            this.maxAsteroids - this.asteroids.length
        );
        
        // Only spawn if we're below a certain threshold to prevent too many asteroids
        if (spawnCount <= 0) {
            return;
        }

        // Adjust spawn distance based on player speed
        const spawnDistance = this.spawnDistance * Math.max(1.0, speedFactor * 0.5);

        // Get player movement direction for better path prediction
        const playerMovementDirection = this.game.player.movementDirection || { x: 0, y: 0 };
        
        for (let i = 0; i < spawnCount; i++) {
            let asteroid;

            if (this.asteroidPool.length > 0) {
                asteroid = this.asteroidPool.pop();
                asteroid.visible = true;
            } else {
                asteroid = this.asteroidModel.clone();
                asteroid.visible = true;
            }

            // Position directly in player's path with WIDER spread (increased from -10,10 to -18,18 for x and -5,5 to -12,12 for y)
            const directionBias = 0.7; // How much to bias toward player's movement direction
            const x = playerPosition.x + 
                      (playerMovementDirection.x * directionBias * 20) + 
                      getRandomFloat(-350, 350); // Much wider spread: from -35,35 to -45,45
            const y = playerPosition.y + 
                      (playerMovementDirection.y * directionBias * 10) + 
                      getRandomFloat(-350, 350); // Much wider spread: from -25,25 to -35,35
            const z = playerPosition.z + spawnDistance;

            asteroid.position.set(x, y, z);

            // Slightly smaller scale for path asteroids
            const scale = getRandomFloat(0.05, 0.2);
            asteroid.scale.set(scale, scale, scale);
            
            // NEW: Store base scale for distance-based scaling
            asteroid.baseScale = {
                x: scale,
                y: scale,
                z: scale
            };

            // Speed scales with player speed
            asteroid.speed = getRandomFloat(15, 25) * speedFactor;

            asteroid.rotationSpeed = {
                x: getRandomFloat(-0.3, 0.3),
                y: getRandomFloat(-0.3, 0.3),
                z: getRandomFloat(-0.3, 0.3)
            };

            // Minimal lateral movement to keep them in player's path
            asteroid.lateralMovement = {
                x: getRandomFloat(-2, 2),
                y: getRandomFloat(-1, 1)
            };

            // Add tracking capability to some path asteroids (variable rate from 25-35%)
            // The chance increases slightly with player speed to add challenge
            const trackingChance = 0.25 + (speedFactor * 0.05);
            asteroid.isTracking = Math.random() < trackingChance;
            
            if (asteroid.isTracking) {
                // Variable tracking strength between 0.2 and 0.5
                asteroid.trackingStrength = 0.2 + Math.random() * 0.3;
                
                // Give tracking path asteroids a slight purple tint to distinguish them
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        // Mix blue and slight purple for a distinctive look
                        child.material.color.setHex(0xb3b9ff);
                        child.material.emissive = new THREE.Color(0x221133);
                    }
                });
            } else {
                // Make non-tracking path asteroids visually distinct with a light blue tint
                asteroid.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0xaaccff); // Light blue tint
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
            
            // NEW: Store base hitbox size for distance-based scaling
            asteroid.baseHitboxSize = {
                width: asteroid.hitboxSize.width,
                height: asteroid.hitboxSize.height,
                depth: asteroid.hitboxSize.depth
            };
            
            // NEW: Apply initial scale based on distance
            this.updateAsteroidScale(asteroid, playerPosition);
        }
    }

    // NEW: Add method to update asteroid scale based on distance to player
    updateAsteroidScale(asteroid, playerPosition) {
        // Calculate distance to player
        const distanceToPlayer = playerPosition.z - asteroid.position.z;
        
        // Skip if asteroid is behind player
        if (distanceToPlayer < 0) return;
        
        // Skip if the asteroid doesn't have a base scale set
        if (!asteroid.baseScale) return;
        
        // Calculate scale factor based on distance
        let scaleFactor = 1.0;
        
        if (distanceToPlayer > this.scalingStartDistance) {
            // Very far - use minimum scale
            scaleFactor = this.minScaleFactor;
        } else if (distanceToPlayer < this.scalingEndDistance) {
            // Very close - use maximum scale
            scaleFactor = this.maxScaleFactor;
        } else {
            // In between - linear interpolation
            const t = 1.0 - (distanceToPlayer - this.scalingEndDistance) / 
                           (this.scalingStartDistance - this.scalingEndDistance);
            scaleFactor = this.minScaleFactor + t * (this.maxScaleFactor - this.minScaleFactor);
        }
        
        // Apply scale factor to base scale
        asteroid.scale.set(
            asteroid.baseScale.x * scaleFactor,
            asteroid.baseScale.y * scaleFactor,
            asteroid.baseScale.z * scaleFactor
        );
        
        // Update hitbox size to match current scale
        if (asteroid.baseHitboxSize) {
            asteroid.hitboxSize = {
                width: asteroid.baseHitboxSize.width * scaleFactor,
                height: asteroid.baseHitboxSize.height * scaleFactor,
                depth: asteroid.baseHitboxSize.depth * scaleFactor
            };
        }
    }
}
