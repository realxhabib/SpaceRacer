/**
 * PowerUps manager for Space Racer game
 */

class PowerUpsManager {
    constructor(game) {
        this.game = game;
        this.powerUps = [];
        this.powerUpTypes = ['indestructible', 'health', 'ammo', 'laser', 'gravityShift'];
        this.spawnDistance = -800; // Distance ahead of player to spawn power-ups
        this.despawnDistance = 50; // Distance behind player to despawn power-ups
        this.spawnInterval = 5; // Time between power-up spawns
        this.spawnTimer = 0;
        this.minSpawnX = -8;
        this.maxSpawnX = 8;
        this.minSpawnY = -3;
        this.maxSpawnY = 3;
        
        // Power-up effects duration
        this.indestructibleDuration = 7; // seconds
        this.laserDuration = 15; // seconds
        this.gravityShiftDuration = 7; // seconds
        
        // Active power-up timers
        this.activePowerUps = {
            laser: 0,
            gravityShift: 0
        };
    }

    initialize() {
        // Get mystery box model
        this.mysteryBoxModel = this.game.modelsManager.getModelClone('mystery');
        
        if (!this.mysteryBoxModel) {
            console.error('Failed to load mystery box model');
            return;
        }
        
        // Hide original model
        this.mysteryBoxModel.visible = false;
    }

    update(deltaTime) {
        // Update spawn timer
        this.spawnTimer += deltaTime;
        
        // Spawn new power-up
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnPowerUp();
        }
        
        // Update existing power-ups
        const playerPosition = this.game.player.getPosition();
        const currentTime = performance.now() / 1000; // Current time in seconds
        
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            
            // Apply custom rotation and motion based on userData
            if (powerUp.userData) {
                // Rotate power-up with custom speed
                powerUp.rotation.y += powerUp.userData.rotationSpeed * deltaTime;
                
                // Apply bobbing motion - sine wave based on time
                if (powerUp.userData.originalY !== undefined) {
                    const age = currentTime - powerUp.userData.spawnTime;
                    const bobHeight = 0.5; // Maximum bob height
                    const bobFrequency = 1.5; // Speed of bobbing motion
                    
                    // Calculate new Y position with bobbing motion
                    powerUp.position.y = powerUp.userData.originalY + 
                        Math.sin(age * bobFrequency * Math.PI) * bobHeight;
                    
                    // Add a subtle pulsing glow effect
                    powerUp.traverse(child => {
                        if (child.isMesh && child.material) {
                            const material = Array.isArray(child.material) ? child.material[0] : child.material;
                            if (material.emissiveIntensity !== undefined) {
                                // Pulsing glow intensity
                                material.emissiveIntensity = 0.7 + Math.sin(age * 3 * Math.PI) * 0.3;
                            }
                        }
                    });
                }
            } else {
                // Fallback for power-ups without userData
                powerUp.rotation.y += 1 * deltaTime;
            }
            
            // Check if power-up is behind player and should be removed
            if (powerUp.position.z > playerPosition.z + this.despawnDistance) {
                this.game.scene.remove(powerUp);
                this.powerUps.splice(i, 1);
            }
            
            // Check for collision with player
            if (this.checkCollision(powerUp, this.game.player)) {
                // Activate power-up
                this.activatePowerUp(powerUp.powerUpType);
                
                // Remove power-up
                this.game.scene.remove(powerUp);
                this.powerUps.splice(i, 1);
            }
        }
        
        // Update active power-up timers
        this.updateActivePowerUps(deltaTime);
    }

    spawnPowerUp() {
        const playerPosition = this.game.player.getPosition();
        
        // Get player movement data for predictive spawning
        const playerMovementDirection = this.game.player.movementDirection || { x: 0, y: 0 };
        const playerVelocity = {
            x: this.game.player.velocityX || 0,
            y: this.game.player.velocityY || 0
        };
        
        // Get player speed to better position power-ups
        const playerSpeed = this.game.player.speed || 20;
        const speedFactor = playerSpeed / 20; // Normalize to base speed
        
        // Track player position history if not already tracked in AsteroidsManager
        if (!this.game.asteroidsManager.playerPositionHistory) {
            // Initialize our own player history if asteroids manager doesn't have one
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
        }
        
        // Calculate movement trend - either use our tracking or the asteroid manager's
        let movementTrend = { x: 0, y: 0 };
        let positionHistory = this.game.asteroidsManager.playerPositionHistory || this.playerPositionHistory;
        
        if (positionHistory && positionHistory.length >= 3) {
            const newest = positionHistory[positionHistory.length - 1];
            const oldest = positionHistory[0];
            
            // Calculate average movement direction over time
            const timeDiff = (newest.time - oldest.time) / 1000; // in seconds
            if (timeDiff > 0) {
                movementTrend.x = (newest.x - oldest.x) / timeDiff;
                movementTrend.y = (newest.y - oldest.y) / timeDiff;
            }
        }
        
        // Clone mystery box model
        const powerUp = this.mysteryBoxModel.clone();
        powerUp.visible = true;
        
        // Determine spawn strategy based on player speed and movement
        const spawnStrategy = Math.random();
        
        // Predictive spawning - use player velocity and direction to anticipate their path
        const predictionFactor = 1.5; // How far ahead to predict (lower than asteroids for better accessibility)
        const predictedX = playerPosition.x + (movementTrend.x * predictionFactor);
        const predictedY = playerPosition.y + (movementTrend.y * predictionFactor);
        
        // Adjusted spawn distance based on player speed
        const adjustedSpawnDistance = this.spawnDistance * Math.max(1.0, speedFactor * 0.6);
        
        // Determine position based on different strategies
        let x, y, z;
        
        if (spawnStrategy < 0.35) {
            // 35% chance: Spawn in player's predicted path for easier acquisition
            // Use a narrower range to ensure it's not too hard to reach
            x = predictedX + getRandomFloat(-3, 3);
            y = predictedY + getRandomFloat(-2, 2);
            z = playerPosition.z + adjustedSpawnDistance * 0.8; // Closer to player
        } else if (spawnStrategy < 0.70) {
            // 35% chance: Spawn slightly off the player's predicted movement path
            // This rewards players for movement and exploration
            
            // Use player's movement to determine offset direction, placing power-ups 
            // in areas the player is trending toward but not directly in path
            const offsetMagnitude = getRandomFloat(4, 8);
            const offsetAngle = Math.atan2(movementTrend.y, movementTrend.x) + getRandomFloat(-Math.PI/3, Math.PI/3);
            
            // Calculate offset position
            x = predictedX + Math.cos(offsetAngle) * offsetMagnitude;
            y = predictedY + Math.sin(offsetAngle) * offsetMagnitude;
            z = playerPosition.z + adjustedSpawnDistance * 0.9;
        } else {
            // 30% chance: Random position within a wider play area
            // For more exploratory players who move around a lot
            x = getRandomFloat(this.minSpawnX * 1.5, this.maxSpawnX * 1.5);
            y = getRandomFloat(this.minSpawnY * 1.5, this.maxSpawnY * 1.5);
            z = playerPosition.z + adjustedSpawnDistance;
            
            // If player is moving significantly, add a slight bias in that direction
            const movementMagnitude = Math.sqrt(movementTrend.x * movementTrend.x + movementTrend.y * movementTrend.y);
            if (movementMagnitude > 1.0) {
                // Add slight bias toward movement direction
                x += movementTrend.x * getRandomFloat(0.5, 1.5);
                y += movementTrend.y * getRandomFloat(0.5, 1.5);
            }
        }
        
        // Position the power-up
        powerUp.position.set(x, y, z);
        
        // Set scale - increased from 5.0 to 8.0 to make the box bigger
        powerUp.scale.set(8.0, 8.0, 8.0);
        
        // Make the mystery box partially transparent
        powerUp.traverse(child => {
            if (child.isMesh && child.material) {
                // If material is an array, process each material
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        material.transparent = true;
                        material.opacity = 0.7; // 70% opaque
                    });
                } else {
                    // Single material
                    child.material.transparent = true;
                    child.material.opacity = 0.7; // 70% opaque
                }
            }
        });
        
        // Add subtle glow effect to make power-ups more visible
        powerUp.traverse(child => {
            if (child.isMesh && child.material) {
                const material = Array.isArray(child.material) ? child.material[0] : child.material;
                material.emissive = new THREE.Color(0x333399); // Blue-ish glow
                material.emissiveIntensity = 0.7;
            }
        });
        
        // Assign random power-up type
        powerUp.powerUpType = this.powerUpTypes[getRandomInt(0, this.powerUpTypes.length - 1)];
        
        // Add to scene and array
        this.game.scene.add(powerUp);
        this.powerUps.push(powerUp);
        
        // Create hitbox for collision detection
        const boundingBox = new THREE.Box3().setFromObject(powerUp);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        
        powerUp.hitboxSize = {
            width: size.x,
            height: size.y,
            depth: size.z
        };
        
        // Add special motion to power-ups to make them more noticeable
        powerUp.userData = {
            spawnTime: performance.now() / 1000, // Store spawn time in seconds
            originalY: powerUp.position.y, // Store original Y position for bobbing motion
            rotationSpeed: getRandomFloat(0.8, 1.2) // Randomize rotation speed for visual variety
        };
    }

    checkCollision(powerUp, player) {
        if (!player.mesh) return false;
        
        const powerUpPos = powerUp.position;
        const playerPos = player.mesh.position;
        
        // Simple distance-based collision detection - only with player, not other objects
        const dx = Math.abs(powerUpPos.x - playerPos.x);
        const dy = Math.abs(powerUpPos.y - playerPos.y);
        const dz = Math.abs(powerUpPos.z - playerPos.z);
        
        return (
            dx < (powerUp.hitboxSize.width + player.hitboxSize.width) / 2 &&
            dy < (powerUp.hitboxSize.height + player.hitboxSize.height) / 2 &&
            dz < (powerUp.hitboxSize.depth + player.hitboxSize.depth) / 2
        );
    }
    
    // Mystery boxes don't collide with asteroids or other objects
    // This is implemented by not checking for those collisions

    activatePowerUp(type) {
        // First show cycling animation through all power-ups
        this.showPowerUpCyclingAnimation(() => {
            // After animation completes, show which power-up was received
            this.showPowerUpNotification(type);
            
            // Show power-up effect
            this.showPowerUpEffect(type);
            
            // Activate the power-up
            switch (type) {
                case 'indestructible':
                    this.activateIndestructible();
                    break;
                case 'health':
                    this.activateHealth();
                    break;
                case 'ammo':
                    this.activateAmmo();
                    break;
                case 'laser':
                    this.activateLaser();
                    break;
                case 'gravityShift':
                    this.activateGravityShift();
                    break;
            }
        });
    }
    
    showPowerUpCyclingAnimation(callback) {
        // Create cycling animation container if it doesn't exist
        if (!document.getElementById('powerup-cycling-container')) {
            const container = document.createElement('div');
            container.id = 'powerup-cycling-container';
            container.style.position = 'absolute';
            container.style.top = '30%';
            container.style.right = '50px'; // Moved to the side as requested
            container.style.width = '150px';
            container.style.height = '150px';
            container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            container.style.borderRadius = '10px';
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'center';
            container.style.zIndex = '100';
            container.style.display = 'none';
            
            const powerupImage = document.createElement('div');
            powerupImage.id = 'powerup-cycling-image';
            powerupImage.style.width = '100px';
            powerupImage.style.height = '100px';
            powerupImage.style.backgroundSize = 'contain';
            powerupImage.style.backgroundPosition = 'center';
            powerupImage.style.backgroundRepeat = 'no-repeat';
            
            container.appendChild(powerupImage);
            document.body.appendChild(container);
        }
        
        // Get container and image elements
        const container = document.getElementById('powerup-cycling-container');
        const powerupImage = document.getElementById('powerup-cycling-image');
        
        // Show container
        container.style.display = 'flex';
        
        // Define power-up types to cycle through
        const powerupTypes = ['indestructible', 'health', 'ammo', 'laser', 'gravityShift'];
        let currentIndex = 0;
        
        // Set up cycling interval
        const cyclingInterval = setInterval(() => {
            // Update image based on current power-up type
            const currentType = powerupTypes[currentIndex];
            switch (currentType) {
                case 'indestructible':
                    powerupImage.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect x='10' y='10' width='80' height='80' fill='%2300ffff' rx='5' /></svg>")`;
                    break;
                case 'health':
                    powerupImage.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect x='40' y='10' width='20' height='80' fill='%2300ff00' /><rect x='10' y='40' width='80' height='20' fill='%2300ff00' /></svg>")`;
                    break;
                case 'ammo':
                    powerupImage.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect x='20' y='30' width='60' height='40' fill='%23ff0000' /><rect x='30' y='20' width='10' height='60' fill='%23ff0000' /><rect x='60' y='20' width='10' height='60' fill='%23ff0000' /></svg>")`;
                    break;
                case 'laser':
                    powerupImage.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><polygon points='50,10 65,80 50,70 35,80' fill='%23ff00ff' /></svg>")`;
                    break;
                case 'gravityShift':
                    powerupImage.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><circle cx='50' cy='50' r='35' fill='none' stroke='%2300ffff' stroke-width='5'/><path d='M30,40 L50,25 L70,40 M30,60 L50,75 L70,60' stroke='%2300ffff' stroke-width='5' fill='none'/><circle cx='50' cy='50' r='15' fill='%2300ffff' opacity='0.7'/></svg>")`;
                    break;
            }
            
            // Increment index and wrap around if needed
            currentIndex = (currentIndex + 1) % powerupTypes.length;
        }, 150); // Cycle every 150ms
        
        // Stop cycling after 1.5 seconds
        setTimeout(() => {
            clearInterval(cyclingInterval);
            container.style.display = 'none';
            
            // Call callback function
            if (callback) callback();
        }, 1500);
    }
    
    showPowerUpNotification(type) {
        // Create notification container if it doesn't exist
        if (!document.getElementById('powerup-notification')) {
            const notification = document.createElement('div');
            notification.id = 'powerup-notification';
            notification.style.position = 'absolute';
            notification.style.top = '30%';
            notification.style.left = '50%';
            notification.style.transform = 'translate(-50%, -50%)';
            notification.style.padding = '15px 30px';
            notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            notification.style.color = '#fff';
            notification.style.borderRadius = '10px';
            notification.style.fontFamily = 'Arial, sans-serif';
            notification.style.fontSize = '24px';
            notification.style.fontWeight = 'bold';
            notification.style.textAlign = 'center';
            notification.style.zIndex = '100';
            notification.style.display = 'none';
            document.body.appendChild(notification);
        }
        
        // Get notification element
        const notification = document.getElementById('powerup-notification');
        
        // Set notification text and color based on power-up type
        let text = '';
        let color = '';
        
        switch (type) {
            case 'indestructible':
                text = 'INDESTRUCTIBLE MODE ACTIVATED!';
                color = '#00ffff';
                break;
            case 'health':
                text = '+10 HEALTH';
                color = '#00ff00';
                break;
            case 'ammo':
                text = '+10 AMMO';
                color = '#ff0000';
                break;
            case 'laser':
                text = 'LASER UPGRADE ACTIVATED!';
                color = '#ff00ff';
                break;
            case 'gravityShift':
                text = 'GRAVITY SHIFT ACTIVATED!';
                color = '#00ffff';
                break;
        }
        
        notification.textContent = text;
        notification.style.color = color;
        notification.style.display = 'block';
        
        // Hide notification after 2 seconds
        setTimeout(() => {
            notification.style.display = 'none';
        }, 2000);
    }

    activateIndestructible() {
        // Make player invincible for a duration
        this.game.player.activateInvincibility(this.indestructibleDuration);
        
        // Show power-up icon
        this.updatePowerUpIcon('nokia');
        
        // Start timer display
        this.startPowerUpTimer(this.indestructibleDuration);
    }

    activateHealth() {
        // Add health to player
        this.game.player.addHealth(10);
        
        // Show power-up icon briefly
        this.updatePowerUpIcon('health');
        setTimeout(() => {
            document.getElementById('powerup-icon').style.backgroundImage = '';
        }, 2000);
    }

    activateAmmo() {
        // Add ammo to player
        this.game.player.addAmmo(10);
        
        // Show power-up icon briefly
        this.updatePowerUpIcon('ammo');
        setTimeout(() => {
            document.getElementById('powerup-icon').style.backgroundImage = '';
        }, 2000);
    }

    activateLaser() {
         // Enable laser for player
        this.game.player.enableLaser();
        
        // Create persistent laser beam that breaks anything in its path
        this.createPersistentLaserBeam();
        
        // Set timer to 7 seconds as requested
        this.activePowerUps.laser = 7;
        
        // Show power-up icon
        this.updatePowerUpIcon('laser');
        
        // Set timer to disable persistent laser after 7 seconds
        setTimeout(() => {
            this.removePersistentLaserBeam();
        }, 7000);
        
        // Start timer display
        this.startPowerUpTimer(this.laserDuration);
    }
    
    // Create a visual laser beam effect that extends from the player's ship
    createPersistentLaserBeam() {
        try {
            // Create a cylinder geometry for the laser beam - modify to only point forward
            // We'll position the geometry differently so it only extends forward
            const laserLength = 1000;
            const laserGeometry = new THREE.CylinderGeometry(0.2, 0.1, laserLength, 12);
            
            // Rotate to point forward - this puts the cylinder on its side
            // Important: Match the ship's default rotation (y = Math.PI)
            laserGeometry.rotateX(Math.PI / 2);
            
            // Translate the geometry forward so one end is at the origin
            // This ensures the beam only extends forward from its attachment point
            laserGeometry.translate(0, 0, -laserLength/2);
            
            // Create a simpler, more reliable material for the laser beam
            // Avoiding ShaderMaterial or MeshStandardMaterial which can cause uniform issues
            const laserMaterial = new THREE.MeshBasicMaterial({
                color: 0xff00ff,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending, // Glowing effect
                depthWrite: false, // Improve rendering performance
                fog: false // Disable fog interactions
            });
            
            // Initialize userData to prevent re-processing by sanitizeMaterial
            laserMaterial.userData = laserMaterial.userData || {};
            laserMaterial.userData.__sanitized = true;
            
            // Create the laser beam mesh
            this.laserBeam = new THREE.Mesh(laserGeometry, laserMaterial);
            
            // The ship is facing backwards (rotation.y = Math.PI)
            // Set the default rotation to match the ship's forward direction
            this.laserBeam.rotation.y = Math.PI;
            
            // Position it at the front of the player's ship
            const playerPos = this.game.player.mesh.position.clone();
            this.laserBeam.position.set(playerPos.x, playerPos.y, playerPos.z - 2);
            
            // Add to scene
            this.game.scene.add(this.laserBeam);
            
            // Create particle system for the laser beam tip - use a safe implementation
            this.laserParticles = createParticleSystem(0xff00ff, 0.3, 30);
            if (this.laserParticles) {
                this.laserParticles.position.set(playerPos.x, playerPos.y, playerPos.z - 1000);
                this.game.scene.add(this.laserParticles);
            }
            
            // Create a point light to enhance the effect - with safety check
            try {
                this.laserLight = new THREE.PointLight(0xff00ff, 2, 50);
                this.laserLight.position.copy(playerPos);
                this.game.scene.add(this.laserLight);
                
                // Add a secondary light at the beam's end
                this.laserEndLight = new THREE.PointLight(0xff00ff, 1, 30);
                this.laserEndLight.position.set(playerPos.x, playerPos.y, playerPos.z - 1000);
                this.game.scene.add(this.laserEndLight);
            } catch (lightError) {
                console.warn("Error creating laser lights:", lightError);
                // Continue without lights if they cause issues
            }
            
            // Time tracking for animation effects
            this.laserAnimationTime = 0;
            
            // Set up animation
            this.laserUpdateInterval = setInterval(() => {
                if (!this.game.player || !this.game.player.mesh || !this.laserBeam) {
                    // Safety check - clear interval if objects don't exist
                    this.removePersistentLaserBeam();
                    return;
                }
                
                try {
                    const playerMesh = this.game.player.mesh;
                    const newPlayerPos = playerMesh.position.clone();
                    
                    // Update laser position to follow player, keeping it at the front of the ship
                    this.laserBeam.position.x = newPlayerPos.x;
                    this.laserBeam.position.y = newPlayerPos.y;
                    this.laserBeam.position.z = newPlayerPos.z - 2; // Position at the front of the ship
                    
                    // Create a direction vector pointing forward based on the ship's rotation
                    // This uses the quaternion to ensure proper orientation
                    const forwardDirection = new THREE.Vector3(0, 0, -1);
                    forwardDirection.applyQuaternion(playerMesh.quaternion);
                    
                    // Calculate endpoint for the laser beam
                    const endPosition = newPlayerPos.clone().add(forwardDirection.multiplyScalar(1000));
                    
                    // Make the laser beam look at the endpoint
                    // This ensures it's pointing in the exact direction of the ship
                    const tempMatrix = new THREE.Matrix4();
                    tempMatrix.lookAt(this.laserBeam.position, endPosition, new THREE.Vector3(0, 1, 0));
                    this.laserBeam.quaternion.setFromRotationMatrix(tempMatrix);
                    
                    // Apply specific adjustments to maintain alignment with ship's tilt
                    this.laserBeam.rotation.x = playerMesh.rotation.x;
                    this.laserBeam.rotation.z = playerMesh.rotation.z;
                    
                    // Update light position
                    if (this.laserLight) {
                        this.laserLight.position.copy(newPlayerPos);
                    }
                    
                    // Update end light and particles
                    if (this.laserEndLight) {
                        this.laserEndLight.position.copy(endPosition);
                    }
                    
                    if (this.laserParticles) {
                        this.laserParticles.position.copy(endPosition);
                    }
                    
                    // Animation effect
                    this.laserAnimationTime += 0.1;
                    // Pulsating effect
                    const pulseScale = 1.0 + 0.1 * Math.sin(this.laserAnimationTime * 5);
                    this.laserBeam.scale.set(pulseScale, 1, pulseScale);
                    
                    // Opacity fluctuation
                    const opacityFluctuation = 0.7 + 0.3 * Math.sin(this.laserAnimationTime * 3);
                    if (this.laserBeam.material) {
                        this.laserBeam.material.opacity = opacityFluctuation;
                    }
                    
                    // Check if the laser is hitting any asteroids using the updated beam direction
                    this.checkLaserCollisions(newPlayerPos, endPosition);
                } catch (error) {
                    console.warn("Error in laser beam update:", error);
                }
            }, 16); // Update at ~60fps
        } catch (error) {
            console.error("Error creating laser beam:", error);
        }
    }
    
    // Check if the laser beam is hitting any asteroids
    checkLaserCollisions(playerPos, endPos) {
        // Skip if the asteroid manager isn't initialized
        if (!this.game.asteroidsManager || !this.game.asteroidsManager.asteroids) return;
        
        // Use the provided end position that accounts for ship tilt
        const laserStart = playerPos.clone();
        const laserEnd = endPos || new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z - 1000);
        
        // Check each asteroid
        for (let i = this.game.asteroidsManager.asteroids.length - 1; i >= 0; i--) {
            const asteroid = this.game.asteroidsManager.asteroids[i];
            
            // Skip if asteroid is behind player
            if (asteroid.position.z > playerPos.z) continue;
            
            // Check if the asteroid is close enough to the laser beam
            // Using a simplified line-sphere intersection test
            const asteroidPos = asteroid.position;
            
            // Vector from laser start to asteroid center
            const laserToAsteroid = new THREE.Vector3();
            laserToAsteroid.subVectors(asteroidPos, laserStart);
            
            // Project this vector onto the laser direction
            const laserDirection = new THREE.Vector3();
            laserDirection.subVectors(laserEnd, laserStart).normalize();
            const projectionLength = laserToAsteroid.dot(laserDirection);
            
            // Find the closest point on the laser to the asteroid
            const closestPoint = new THREE.Vector3();
            closestPoint.copy(laserStart).addScaledVector(laserDirection, projectionLength);
            
            // Distance from this point to the asteroid center
            const distance = closestPoint.distanceTo(asteroidPos);
            
            // If the distance is less than the asteroid's radius, it's a hit
            // Using a generous collision radius to make it feel powerful
            if (distance < asteroid.hitboxSize.width * 1.5) {
                // Create explosion effect where the laser hits the asteroid
                if (this.game.asteroidsManager.createExplosion) {
                    this.game.asteroidsManager.createExplosion(asteroid.position, true);
                }
                
                // Remove the asteroid
                this.game.scene.remove(asteroid);
                this.game.asteroidsManager.asteroids.splice(i, 1);
                
                // Add score if score tracking is implemented
                if (this.game.addScore) {
                    this.game.addScore(50); // Less than direct hits (100) as it's easier
                }
            }
        }
    }
    
    // Remove the persistent laser beam effect
    removePersistentLaserBeam() {
        // Clear the update interval
        if (this.laserUpdateInterval) {
            clearInterval(this.laserUpdateInterval);
            this.laserUpdateInterval = null;
        }
        
        // Remove laser beam from scene
        if (this.laserBeam) {
            this.game.scene.remove(this.laserBeam);
            this.laserBeam = null;
        }
        
        // Remove light from scene
        if (this.laserLight) {
            this.game.scene.remove(this.laserLight);
            this.laserLight = null;
        }
        
        // Remove end light
        if (this.laserEndLight) {
            this.game.scene.remove(this.laserEndLight);
            this.laserEndLight = null;
        }
        
        // Remove particles
        if (this.laserParticles) {
            this.game.scene.remove(this.laserParticles);
            this.laserParticles = null;
        }
    }

    updateActivePowerUps(deltaTime) {
        // Update laser timer
        if (this.activePowerUps.laser > 0) {
            this.activePowerUps.laser -= deltaTime;
            
            // Update timer display
            this.updatePowerUpTimer(this.activePowerUps.laser, this.laserDuration);
            
            if (this.activePowerUps.laser <= 0) {
                this.game.player.disableLaser();
                document.getElementById('powerup-icon').style.backgroundImage = '';
                document.getElementById('powerup-timer').style.display = 'none';
            }
        }
        
        // Update gravity shift timer
        if (this.activePowerUps.gravityShift > 0) {
            this.activePowerUps.gravityShift -= deltaTime;
            
            // Update timer display
            this.updatePowerUpTimer(this.activePowerUps.gravityShift, this.gravityShiftDuration);
            
            // Apply gravity shift effect to push asteroids away
            this.applyGravityShiftEffect();
            
            // If gravity shift is ending
            if (this.activePowerUps.gravityShift <= 0) {
                // Clear icon and timer
                document.getElementById('powerup-icon').style.backgroundImage = '';
                document.getElementById('powerup-timer').style.display = 'none';
                
                // Show deactivation effect
                this.showGravityShiftDeactivation();
            }
        }
    }

    showPowerUpEffect(type) {
        // Create particle effect based on power-up type
        let color;
        
        switch (type) {
            case 'indestructible':
                color = 0x00ffff;
                break;
            case 'health':
                color = 0x00ff00;
                break;
            case 'ammo':
                color = 0xff0000;
                break;
            case 'laser':
                color = 0xff00ff;
                break;
            case 'gravityShift':
                color = 0xff00ff;
                break;
        }
        
        const particles = createParticleSystem(color, 0.3, 30);
        particles.position.copy(this.game.player.mesh.position);
        
        this.game.scene.add(particles);
        
        // Remove particles after animation
        setTimeout(() => {
            this.game.scene.remove(particles);
        }, 1000);
    }

    updatePowerUpIcon(modelName) {
        const iconElement = document.getElementById('powerup-icon');
        iconElement.style.backgroundImage = `url('assets/${modelName}.png')`;
        iconElement.style.backgroundSize = 'contain';
        iconElement.style.backgroundPosition = 'center';
        iconElement.style.backgroundRepeat = 'no-repeat';
    }

    startPowerUpTimer(duration) {
        const timerElement = document.getElementById('powerup-timer');
        timerElement.style.display = 'block';
        this.updatePowerUpTimer(duration);
    }

    updatePowerUpTimer(timeLeft, totalDuration) {
        const timerElement = document.getElementById('powerup-timer');
        const percentage = (timeLeft / totalDuration) * 100;
        
        // Create circular progress indicator
        timerElement.style.background = `conic-gradient(#0af ${percentage}%, transparent ${percentage}%)`;
    }

    activateGravityShift() {
        // Set gravity shift timer
        this.activePowerUps.gravityShift = this.gravityShiftDuration;
        
        // Show initial pulse effect
        this.showGravityShiftActivation();
        
        // Create visible gravity field sphere around player
        this.createGravityFieldSphere();
        
        // Show power-up icon
        this.updatePowerUpIcon('gravityShift');
        
        // Start timer display
        this.startPowerUpTimer(this.gravityShiftDuration);
        
        console.log("Gravity Shift activated!");
    }
    
    showGravityShiftActivation() {
        // Create expanding wave effect
        this.createGravityPulseWave(this.game.player.getPosition());
        
        // Add screen shake for impact
        this.game.applyScreenShake(0.3, 0.5);
        
        // Play activation sound if available
        if (this.game.soundManager && this.game.soundManager.playSound) {
            this.game.soundManager.playSound('powerup', 0.7);
        }
    }
    
    createGravityFieldSphere() {
        const fieldRadius = 150;
        
        // ---- MAIN SHIELD SPHERE ----
        // Add a wireframe sphere for 3D visual depth
        const shieldGeometry = new THREE.SphereGeometry(fieldRadius, 24, 24);
        const shieldMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });
        
        this.gravityFieldSphere = new THREE.Mesh(shieldGeometry, shieldMaterial);
        this.gravityFieldSphere.position.copy(this.game.player.getPosition());
        this.game.scene.add(this.gravityFieldSphere);
        
        // Set consistent rotation speed
        this.shieldRotationSpeed = 0.01;
        
        // ---- MAIN ENERGY RING ----
        // A single prominent ring for visual clarity and asteroid repulsion
        const ringGeometry = new THREE.RingGeometry(fieldRadius * 0.8, fieldRadius * 0.9, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        
        this.horizontalRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.horizontalRing.rotation.x = Math.PI / 2; // Horizontal orientation
        this.horizontalRing.position.copy(this.game.player.getPosition());
        this.game.scene.add(this.horizontalRing);
        
        // ---- ENERGY CORE ----
        // Simple energy core in the center
        const coreGeometry = new THREE.SphereGeometry(8, 12, 12);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        
        this.energyCore = new THREE.Mesh(coreGeometry, coreMaterial);
        this.energyCore.position.copy(this.game.player.getPosition());
        this.game.scene.add(this.energyCore);
        
        // ---- LIGHTING ----
        // Just one light for the effect
        this.gravityFieldLight = new THREE.PointLight(0x00ffff, 3, fieldRadius * 2);
        this.gravityFieldLight.position.copy(this.game.player.getPosition());
        this.game.scene.add(this.gravityFieldLight);
        
        // Initialize animation properties
        this.animationTime = 0;
    }
    
    applyGravityShiftEffect() {
        // Get all asteroids from the asteroids manager
        if (!this.game.asteroidsManager) return;
        
        const playerPosition = this.game.player.getPosition();
        const allAsteroids = [
            ...this.game.asteroidsManager.asteroids, 
            ...this.game.asteroidsManager.boundaryAsteroids
        ];
        
        // Set the radius of effect
        const effectRadius = 150;
        const baseForce = 20;
        
        // Update animation time
        this.animationTime = (this.animationTime || 0) + 0.016;
        const time = this.animationTime;
        
        // ---- ANIMATE WIREFRAME SPHERE ----
        if (this.gravityFieldSphere) {
            // Simplified pulsing effect
            const pulseScale = 1.0 + 0.05 * Math.sin(time * 1.2);
            this.gravityFieldSphere.scale.set(pulseScale, pulseScale, pulseScale);
            
            // Consistent rotation for cleaner look
            this.gravityFieldSphere.rotation.y += this.shieldRotationSpeed;
            
            // Update position to follow player
            this.gravityFieldSphere.position.copy(playerPosition);
        }
        
        // ---- ANIMATE MAIN RING ----
        if (this.horizontalRing) {
            // Consistent rotation
            this.horizontalRing.rotation.z += 0.02;
            this.horizontalRing.position.copy(playerPosition);
            
            // Pulse animation
            const ringPulse = 1.0 + 0.1 * Math.sin(time * 1.2);
            this.horizontalRing.scale.set(ringPulse, ringPulse, ringPulse);
        }
        
        // ---- ANIMATE ENERGY CORE ----
        if (this.energyCore) {
            // Core always follows player
            this.energyCore.position.copy(playerPosition);
            
            // Simple pulse animation
            const corePulse = 1.0 + 0.25 * Math.sin(time * 1.5);
            this.energyCore.scale.set(corePulse, corePulse, corePulse);
        }
        
        // ---- ANIMATE LIGHT ----
        if (this.gravityFieldLight) {
            this.gravityFieldLight.position.copy(playerPosition);
            // Simple pulsing intensity
            this.gravityFieldLight.intensity = 2.2 + 0.8 * Math.sin(time * 1.5);
        }
        
        // Create occasional simple pulse for visual feedback
        if (Math.random() < 0.02) {
            this.createSimplePulseRing(playerPosition);
        }
        
        // ---- ASTEROID REPULSION EFFECTS ----
        // Apply force to each asteroid
        for (const asteroid of allAsteroids) {
            // Calculate direction vector from player to asteroid
            const direction = {
                x: asteroid.position.x - playerPosition.x,
                y: asteroid.position.y - playerPosition.y,
                z: asteroid.position.z - playerPosition.z
            };
            
            // Calculate distance
            const distanceSquared = 
                direction.x * direction.x + 
                direction.y * direction.y + 
                direction.z * direction.z;
            
            // Only affect asteroids within radius
            if (distanceSquared < effectRadius * effectRadius) {
                // Calculate force (stronger when closer)
                const distance = Math.sqrt(distanceSquared);
                
                // More dramatic close-range effect for gameplay clarity
                let forceMagnitude;
                if (distance < effectRadius * 0.4) {
                    // Strong force for close asteroids
                    forceMagnitude = baseForce * 1.8 * (1 - Math.pow(distance / (effectRadius * 0.4), 0.6));
                } else {
                    // Normal force with clear falloff
                    forceMagnitude = baseForce * (1 - Math.min(1, distance / effectRadius));
                }
                
                // Normalize direction
                if (distance > 0) {
                    direction.x /= distance;
                    direction.y /= distance;
                    direction.z /= distance;
                    
                    // Apply force by adjusting asteroid position
                    asteroid.position.x += direction.x * forceMagnitude;
                    asteroid.position.y += direction.y * forceMagnitude;
                    asteroid.position.z += direction.z * forceMagnitude;
                    
                    // Push approaching asteroids away more aggressively
                    if (asteroid.speed > 0 && asteroid.position.z < playerPosition.z) {
                        asteroid.position.z -= forceMagnitude * 0.8;
                    }
                }
            }
        }
    }
    
    // Simple visual pulse ring for asteroid repulsion feedback
    createSimplePulseRing(position) {
        // Create ring geometry
        const ringGeometry = new THREE.RingGeometry(1, 3, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        
        // Create mesh
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        
        // Position at player
        ring.position.copy(position);
        
        // Orient toward camera
        ring.lookAt(this.game.camera.position);
        
        // Add to scene
        this.game.scene.add(ring);
        
        // Animate expanding ring
        const duration = 0.8;
        let time = 0;
        const expandSpeed = 170;
        
        const animate = () => {
            time += 0.016;
            
            // Expand ring
            const scale = time * expandSpeed;
            ring.scale.set(scale, scale, scale);
            
            // Simple fade out
            const progress = time / duration;
            ring.material.opacity = 0.5 * (1.0 - progress);
            
            // Keep ring oriented toward camera
            ring.lookAt(this.game.camera.position);
            
            // Continue animation until complete
            if (time < duration) {
                requestAnimationFrame(animate);
            } else {
                // Clean up
                this.game.scene.remove(ring);
                ring.material.dispose();
                ring.geometry.dispose();
            }
        };
        
        animate();
    }

    showGravityShiftDeactivation() {
        const playerPosition = this.game.player.getPosition();
        
        // Create simple implosion effect
        this.createSimpleImplosion(playerPosition);
        
        // Remove the gravity field elements with animation
        this.removeGravityFieldWithAnimation();
        
        // Add screen shake for impact
        this.game.applyScreenShake(0.2, 0.5);
        
        // Play deactivation sound if available
        if (this.game.soundManager && this.game.soundManager.playSound) {
            this.game.soundManager.playSound('powerdown', 0.5);
        }
    }
    
    createSimpleImplosion(position) {
        // Create flash effect
        const flashGeometry = new THREE.SphereGeometry(5, 16, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        this.game.scene.add(flash);
        
        // Animate implosion
        const duration = 0.5;
        let time = 0;
        
        const animate = () => {
            time += 0.016;
            const progress = time / duration;
            
            // Shrink flash
            const scale = 20 * (1 - progress);
            flash.scale.set(scale, scale, scale);
            
            // Fade out
            flash.material.opacity = 0.7 * (1 - progress);
            
            if (time < duration) {
                requestAnimationFrame(animate);
            } else {
                // Clean up
                this.game.scene.remove(flash);
                flash.material.dispose();
                flash.geometry.dispose();
            }
        };
        
        animate();
    }

    removeGravityFieldWithAnimation() {
        // Duration for animation
        const duration = 0.8;
        let time = 0;
        
        // Store references to all objects we need to remove
        const objectsToRemove = [];
        
        // Add all field-related objects to the removal list
        if (this.gravityFieldSphere) objectsToRemove.push(this.gravityFieldSphere);
        if (this.horizontalRing) objectsToRemove.push(this.horizontalRing);
        if (this.energyCore) objectsToRemove.push(this.energyCore);
        
        // Lights need special handling
        const lightsToRemove = [];
        if (this.gravityFieldLight) lightsToRemove.push(this.gravityFieldLight);
        
        // Animate the removal
        const animate = () => {
            time += 0.016;
            const progress = time / duration;
            
            // Scale down objects
            objectsToRemove.forEach(obj => {
                const scale = 1.0 - progress;
                obj.scale.set(scale, scale, scale);
                
                // Fade material opacity if it has one
                if (obj.material && obj.material.opacity !== undefined) {
                    obj.material.opacity *= (1.0 - progress * 0.5);
                }
            });
            
            // Fade out lights
            lightsToRemove.forEach(light => {
                light.intensity *= (1.0 - progress * 0.7);
            });
            
            if (time < duration) {
                requestAnimationFrame(animate);
            } else {
                // When animation completes, remove all objects from scene
                objectsToRemove.forEach(obj => {
                    this.game.scene.remove(obj);
                    if (obj.material) obj.material.dispose();
                    if (obj.geometry) obj.geometry.dispose();
                });
                
                lightsToRemove.forEach(light => {
                    this.game.scene.remove(light);
                });
                
                // Clear references
                this.gravityFieldSphere = null;
                this.horizontalRing = null;
                this.energyCore = null;
                this.gravityFieldLight = null;
            }
        };
        
        animate();
    }
    
    createGravityPulseWave(position) {
        // Create ring geometry
        const ringGeometry = new THREE.RingGeometry(1, 3, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        
        // Create mesh
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        
        // Position at player
        ring.position.copy(position);
        
        // Orient toward camera
        ring.lookAt(this.game.camera.position);
        
        // Add to scene
        this.game.scene.add(ring);
        
        // Animate expanding ring
        const duration = 0.8;
        let time = 0;
        const expandSpeed = 170; // Faster expansion
        
        const animate = () => {
            time += 0.016;
            
            // Expand ring
            const scale = time * expandSpeed;
            ring.scale.set(scale, scale, scale);
            
            // Simple fade out
            const progress = time / duration;
            ring.material.opacity = 0.5 * (1.0 - progress);
            
            // Keep ring oriented toward camera
            ring.lookAt(this.game.camera.position);
            
            // Continue animation until complete
            if (time < duration) {
                requestAnimationFrame(animate);
            } else {
                // Clean up
                this.game.scene.remove(ring);
                ring.material.dispose();
                ring.geometry.dispose();
            }
        };
        
        animate();
    }
}
