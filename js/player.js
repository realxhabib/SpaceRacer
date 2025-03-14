/**
 * Player class for Space Racer game
 */

class Player {
    constructor(game, shipType) {
        this.game = game;
        this.shipType = shipType; // 'cruiser' or 'fighter'
        
        // Ship properties based on type
        if (shipType === 'cruiser') {
            this.maxHealth = 120;
            this.turnSpeed = 0.08; // Enhanced turning capabilities
            this.verticalSpeed = 0.08; // Enhanced vertical movement
        } else { // fighter
            this.maxHealth = 80;
            this.turnSpeed = 0.12; // Enhanced turning capabilities
            this.verticalSpeed = 0.12; // Enhanced vertical movement
        }
        
        // Initialize player state
        this.health = this.maxHealth;
        this.speed = 20; // Starting speed
        this.targetSpeed = 20;
        this.maxSpeed = 200;
        this.boosting = false;
        this.boostMultiplier = 1.5;
        this.ammo = 0;
        this.laserEnabled = false;
        this.invincible = false;
        this.invincibleTimer = 0;
        
        // Initialize movement properties - Add these missing properties
        this.velocityX = 0;  // Horizontal velocity
        this.velocityY = 0;  // Vertical velocity
        this.maxVelocity = 0.8; // Maximum velocity
        this.movementDirection = { x: 0, y: 0 }; // Track current movement direction
        
        // Create ship model
        this.createShip();
        
        // Create bullet objects pool
        this.bullets = [];
        this.createBulletPool();
    }
    
    createShip() {
        // Get ship model based on selected type
        this.mesh = this.game.modelsManager.getModelClone(this.shipType);
        
        if (this.mesh) {
            // Scale and position the ship
            this.mesh.scale.set(0.5, 0.5, 0.5);
            this.mesh.position.set(0, 0, 0);
            
            // Rotate ship to face forward (fix orientation based on user feedback)
            this.mesh.rotation.y = Math.PI; // Rotate 180 degrees to face forward
            
            // Add ship to scene
            this.game.scene.add(this.mesh);
            
            // Create hitbox for collision detection
            const boundingBox = new THREE.Box3().setFromObject(this.mesh);
            const size = new THREE.Vector3();
            boundingBox.getSize(size);
            
            this.hitboxSize = {
                width: size.x * 0.8, // Slightly smaller than actual model
                height: size.y * 0.8,
                depth: size.z * 0.8
            };
        }
    }
    
    createBulletPool() {
        // Create bullet geometry and material
        const bulletGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        
        // Create a more robust bullet material with all necessary properties initialized
        const bulletMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false // Improve rendering performance and avoid z-fighting
        });
        
        // Initialize material properties to prevent shader compilation errors
        bulletMaterial.userData = bulletMaterial.userData || {};
        bulletMaterial.userData.__sanitized = true; // Mark as sanitized to prevent re-processing
        
        // Create bullet pool
        for (let i = 0; i < 20; i++) {
            const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial.clone()); // Use clone to avoid shared material issues
            bullet.visible = false;
            
            // Add bullet to scene
            this.game.scene.add(bullet);
            
            this.bullets.push({
                mesh: bullet,
                active: false,
                speed: 2,
                direction: new THREE.Vector3(0, 0, -1), // Ensure direction is always forward
                position: new THREE.Vector3() // Store last valid position
            });
        }
    }
    
    update(deltaTime) {
        // Update speed
        if (this.speed < this.maxSpeed) {
            // Quick acceleration to 200
            this.speed = lerp(this.speed, this.maxSpeed, 0.05);
        } else {
            // Slow increase by 1 per second after reaching max
            this.speed += deltaTime;
        }
        
        // Apply boost if active
        const currentSpeed = this.boosting ? this.speed * this.boostMultiplier : this.speed;
        
        // Move forward
        this.mesh.position.z -= currentSpeed * deltaTime;
        
        // Apply velocities to position for lateral movement
        if (this.mesh) {
            this.mesh.position.x += this.velocityX;
            this.mesh.position.y += this.velocityY;
            
            // Apply damping to velocity - less damping for more responsive feel
            const dampingFactor = 0.93; // Changed from 0.95 to retain more momentum
            this.velocityX *= dampingFactor;
            this.velocityY *= dampingFactor;
            
            // Update ship orientation based on movement
            this.updateShipOrientation();
        }
        
        // Update invincibility timer
        if (this.invincible) {
            this.invincibleTimer -= deltaTime;
            
            // Flash effect for invincibility
            // Only flash visibility if timer is above 0.8 (powerup invincibility)
            // For damage invincibility (0.8s or less), we maintain visibility after the red flash
            if (this.invincibleTimer > 0.8) {
                this.mesh.visible = Math.floor(this.invincibleTimer * 10) % 2 === 0;
            } else {
                // For damage invincibility, ensure mesh is visible but apply a subtle opacity effect
                if (this.mesh && this.mesh.visible === false) {
                    this.mesh.visible = true;
                }
                
                // Apply a pulsing opacity effect for damage invincibility
                const pulseOpacity = 0.4 + 0.6 * Math.sin(this.invincibleTimer * 20);
                this.mesh.traverse(child => {
                    if (child.isMesh && child.material) {
                        if (!child.material.transparent) {
                            child.material = child.material.clone();
                            child.material.transparent = true;
                            child.material.needsUpdate = true;
                        }
                        child.material.opacity = pulseOpacity;
                    }
                });
            }
            
            // End invincibility
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
                this.mesh.visible = true;
                
                // Ensure any flash timer is cleared
                if (this.flashTimer) {
                    clearInterval(this.flashTimer);
                    this.flashTimer = null;
                }
                
                // Restore materials to full opacity
                this.mesh.traverse(child => {
                    if (child.isMesh && child.material) {
                        if (child.material.transparent) {
                            child.material.opacity = 1.0;
                        }
                        
                        // Ensure we restore the original material if necessary
                        if (child.userData.originalMaterial) {
                            child.material = child.userData.originalMaterial;
                        }
                    }
                });
            }
        }
        
        // Update bullets
        this.updateBullets(deltaTime);
        
        // Update UI
        this.updateUI();
    }
    
    updateBullets(deltaTime) {
        for (const bullet of this.bullets) {
            if (bullet.active && bullet.mesh) {
                try {
                    // Move bullet forward
                    bullet.mesh.position.z -= bullet.speed;
                    
                    // Store position for reference
                    bullet.position.copy(bullet.mesh.position);
                    
                    // Ensure bullet material is properly initialized
                    if (bullet.mesh.material && !bullet.mesh.material.userData.__sanitized) {
                        // Apply safety properties to the material to prevent shader errors
                        bullet.mesh.material.transparent = true;
                        bullet.mesh.material.opacity = 0.8;
                        bullet.mesh.material.depthWrite = false;
                        bullet.mesh.material.needsUpdate = true;
                        bullet.mesh.material.userData = bullet.mesh.material.userData || {};
                        bullet.mesh.material.userData.__sanitized = true;
                    }
                    
                    // Check if bullet is out of range
                    if (bullet.mesh.position.z < this.mesh.position.z - 100) {
                        // Reset bullet
                        this.resetBullet(bullet);
                    }
                } catch (error) {
                    console.warn("Error updating bullet:", error);
                    // Reset the bullet on error to prevent further issues
                    this.resetBullet(bullet);
                }
            }
        }
    }
    
    // Helper method to safely reset a bullet
    resetBullet(bullet) {
        if (!bullet) return;
        
        bullet.active = false;
        
        if (bullet.mesh) {
            bullet.mesh.visible = false;
            
            // Position it far away to prevent unintended collisions
            bullet.mesh.position.set(0, 0, -10000);
        }
    }
    
    updateUI() {
        // Update health bar
        const healthPercentage = (this.health / this.maxHealth) * 100;
        updateProgressBar('health-fill', healthPercentage);
        updateTextContent('health-value', this.health);
        
        // Update speed display
        updateTextContent('speed-value', Math.floor(this.boosting ? this.speed * this.boostMultiplier : this.speed));
        
        // Update ammo display
        updateTextContent('ammo-value', this.ammo);
    }
    
    moveLeft(deltaTime) {
        if (this.mesh) {
            // Apply acceleration for movement with subtle tilt effects
            // Increase acceleration multiplier for more responsive controls
            const acceleration = this.turnSpeed * this.speed * deltaTime * 0.3; // Increased from 0.15
            this.velocityX = Math.max(this.velocityX - acceleration, -this.maxVelocity * 1.8); // Increased max velocity
            
            // Set direction for visual tilting
            this.movementDirection.x = -1;
            
            // Apply more subtle tilt effect with reduced angle
            // *** Keep the same tilt amount as before (-0.4) ***
            if (this.mesh) {
                const targetRoll = -0.4; // Keep the same tilt angle as requested
                this.mesh.rotation.z = lerp(this.mesh.rotation.z, targetRoll, 0.15);
            }
        }
    }
    
    moveRight(deltaTime) {
        if (this.mesh) {
            // Apply acceleration for movement with subtle tilt effects
            // Increase acceleration multiplier for more responsive controls
            const acceleration = this.turnSpeed * this.speed * deltaTime * 0.3; // Increased from 0.15
            this.velocityX = Math.min(this.velocityX + acceleration, this.maxVelocity * 1.8); // Increased max velocity
            
            // Set direction for visual tilting
            this.movementDirection.x = 1;
            
            // Apply more subtle tilt effect with reduced angle
            // *** Keep the same tilt amount as before (0.4) ***
            if (this.mesh) {
                const targetRoll = 0.4; // Keep the same tilt angle as requested
                this.mesh.rotation.z = lerp(this.mesh.rotation.z, targetRoll, 0.15);
            }
        }
    }
    
    moveUp(deltaTime) {
        if (this.mesh) {
            // Apply acceleration for movement with subtle tilt effects
            // Increase acceleration multiplier for more responsive controls
            const acceleration = this.verticalSpeed * this.speed * deltaTime * 0.3; // Increased from 0.15
            this.velocityY = Math.min(this.velocityY + acceleration, this.maxVelocity * 1.8); // Increased max velocity
            
            // Set direction for visual tilting
            this.movementDirection.y = 1;
            
            // Apply more subtle tilt effect with reduced angle
            // *** Keep the same tilt amount as before (0.35) ***
            if (this.mesh) {
                const targetPitch = 0.35; // Keep the same tilt angle as requested
                this.mesh.rotation.x = lerp(this.mesh.rotation.x, targetPitch, 0.15);
            }
        }
    }
    
    moveDown(deltaTime) {
        if (this.mesh) {
            // Apply acceleration for movement with subtle tilt effects
            // Increase acceleration multiplier for more responsive controls
            const acceleration = this.verticalSpeed * this.speed * deltaTime * 0.3; // Increased from 0.15
            this.velocityY = Math.max(this.velocityY - acceleration, -this.maxVelocity * 1.8); // Increased max velocity
            
            // Set direction for visual tilting
            this.movementDirection.y = -1;
            
            // Apply more subtle tilt effect with reduced angle
            // *** Keep the same tilt amount as before (-0.35) ***
            if (this.mesh) {
                const targetPitch = -0.35; // Keep the same tilt angle as requested
                this.mesh.rotation.x = lerp(this.mesh.rotation.x, targetPitch, 0.15);
            }
        }
    }
    
    resetRotation() {
        if (this.mesh) {
            // Smoother reset rotation with more gradual transition
            this.mesh.rotation.z = lerp(this.mesh.rotation.z, 0, 0.1); // Reduced lerp factor for smoother transition
            this.mesh.rotation.x = lerp(this.mesh.rotation.x, 0, 0.1); // Reduced lerp factor for smoother transition
        }
    }
    
    activateBoost() {
        this.boosting = true;
        this.game.activateHyperspeed();
        
        // No longer applying the spin effect when boosting
        // Original code called: this.performBoostSpinEffect();
    }
    
    performBoostSpinEffect() {
        // Store original rotation
        const originalRotation = {
            x: this.mesh.rotation.x,
            y: this.mesh.rotation.y,
            z: this.mesh.rotation.z
        };
        
        // Animation variables
        const spinDuration = 0.5; // seconds
        const totalRotation = Math.PI * 2; // 360 degrees
        let elapsedTime = 0;
        let spinning = true;
        
        // Create spin animation
        const spinInterval = setInterval(() => {
            if (!spinning) {
                clearInterval(spinInterval);
                return;
            }
            
            // Update elapsed time (assuming 60fps)
            elapsedTime += 1/60;
            
            // Calculate rotation progress (0 to 1)
            const progress = Math.min(elapsedTime / spinDuration, 1);
            
            // Apply rotation around z-axis (roll)
            this.mesh.rotation.z = originalRotation.z + (totalRotation * progress);
            
            // If animation complete, restore original rotation except for z
            if (progress >= 1) {
                spinning = false;
                this.mesh.rotation.x = originalRotation.x;
                this.mesh.rotation.y = originalRotation.y;
                // Keep final z rotation as is (completed 360 spin)
            }
        }, 1000/60); // 60fps
    }
    
    deactivateBoost() {
        this.boosting = false;
        this.game.deactivateHyperspeed();
    }
    
    fireBullet() {
        if (this.ammo <= 0) return;
        
        // Find inactive bullet
        const bullet = this.bullets.find(b => !b.active);
        if (!bullet) return;
        
        // Ensure ship mesh exists
        if (!this.mesh) return;
        
        try {
            // Activate bullet
            bullet.active = true;
            bullet.mesh.visible = true;
            
            // Position the bullet at the front of the ship
            bullet.mesh.position.copy(this.mesh.position);
            bullet.mesh.position.z -= 2; // Start bullet in front of ship
            
            // Store this position as the bullet's reference position
            bullet.position.copy(bullet.mesh.position);
            
            // Scale bullet speed with vehicle speed
            const currentSpeed = this.boosting ? this.speed * this.boostMultiplier : this.speed;
            bullet.speed = 2 + (currentSpeed / 50); // Base speed + scaling factor
            
            // Decrease ammo
            this.ammo--;
            updateTextContent('ammo-value', this.ammo);
            
            // Fire second bullet if laser powerup is active
            if (this.laserEnabled && this.ammo > 0) {
                setTimeout(() => {
                    const secondBullet = this.bullets.find(b => !b.active);
                    if (!secondBullet || !this.mesh) return;
                    
                    // Activate second bullet
                    secondBullet.active = true;
                    secondBullet.mesh.visible = true;
                    
                    // Position the second bullet at the front of the ship with offset
                    secondBullet.mesh.position.copy(this.mesh.position);
                    secondBullet.mesh.position.z -= 2; // Forward of ship
                    secondBullet.mesh.position.x += 0.5; // Offset to the right
                    
                    // Store this position
                    secondBullet.position.copy(secondBullet.mesh.position);
                    
                    // Scale bullet speed
                    secondBullet.speed = 2 + (currentSpeed / 50);
                    
                    this.ammo--;
                    updateTextContent('ammo-value', this.ammo);
                }, 100);
            }
        } catch (error) {
            console.warn("Error firing bullet:", error);
        }
    }
    
    takeDamage(amount) {
        if (this.invincible) return;
        
        this.health -= amount;
        
        // Update health UI
        const healthPercentage = (this.health / this.maxHealth) * 100;
        updateProgressBar('health-fill', healthPercentage);
        updateTextContent('health-value', this.health);
        
        // Clear any existing flash timer
        if (this.flashTimer) {
            clearInterval(this.flashTimer);
            this.flashTimer = null;
        }
        
        // Apply hit feedback effect (red flash)
        this.applyHitEffect();
        
        // Brief invincibility after being hit (1 second to match the flashing duration)
        this.activateInvincibility(1.0);
        
        // Check if player is dead
        if (this.health <= 0) {
            this.health = 0;
            this.game.gameOver();
        }
    }
    
    // Add a new method to handle the red flash effect when hit
    applyHitEffect() {
        if (!this.mesh) return;
        
        try {
            // Store original materials if not already stored
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    // Store original material if not already stored
                    if (!child.userData.originalMaterial) {
                        // Deep clone to avoid reference issues
                        if (Array.isArray(child.material)) {
                            // Handle multi-material objects
                            const originalMaterials = [];
                            child.material.forEach(mat => {
                                originalMaterials.push(mat.clone());
                            });
                            child.userData.originalMaterial = originalMaterials;
                        } else {
                            child.userData.originalMaterial = child.material.clone();
                        }
                    }
                }
            });
            
            // Set up variables for the flashing effect
            let flashCount = 0;
            const totalFlashes = 4; // Flash 4 times (red-normal-red-normal-red-normal-red-normal)
            const flashInterval = 1000 / (totalFlashes * 2); // Divide 1 second by number of total color changes
            
            // Create the flashing effect
            this.flashTimer = setInterval(() => {
                flashCount++;
                
                // Toggle between red and original materials
                if (flashCount % 2 === 1) {
                    // Apply red materials
                    this.applyRedMaterials();
                } else {
                    // Restore original materials
                    this.restoreOriginalMaterials();
                }
                
                // End the flashing effect after completing the cycles
                if (flashCount >= totalFlashes * 2) {
                    clearInterval(this.flashTimer);
                    this.restoreOriginalMaterials();
                }
            }, flashInterval);
        } catch (error) {
            console.warn("Error applying hit effect:", error);
            // Ensure we don't leave the ship red
            this.restoreOriginalMaterials();
        }
    }
    
    // Apply red materials to the ship
    applyRedMaterials() {
        if (!this.mesh) return;
        
        try {
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    // Create a new red material to avoid affecting original
                    let redMaterial;
                    
                    if (Array.isArray(child.material)) {
                        // Handle multi-material objects
                        redMaterial = [];
                        child.material.forEach(mat => {
                            const newMat = mat.clone();
                            this.applyRedColorToMaterial(newMat);
                            redMaterial.push(newMat);
                        });
                    } else {
                        // Single material
                        redMaterial = child.material.clone();
                        this.applyRedColorToMaterial(redMaterial);
                    }
                    
                    // Apply the red material
                    child.material = redMaterial;
                }
            });
        } catch (error) {
            console.warn("Error applying red materials:", error);
        }
    }
    
    // Helper method to apply red color to a material
    applyRedColorToMaterial(material) {
        try {
            // Ensure material has the necessary properties
            material.needsUpdate = true;
            
            // For common material types that have color
            if (material.color) {
                material.color.setHex(0xff0000);
            }
            
            // For materials with emissive property
            if (material.emissive !== undefined) {
                material.emissive = new THREE.Color(0xff0000);
                material.emissiveIntensity = 0.8;
            }
            
            // Make sure transparency is enabled for opacity effects
            material.transparent = true;
            material.opacity = 1.0;
        } catch (error) {
            console.warn("Error applying red color to material:", error);
        }
    }
    
    // Add method to restore original materials
    restoreOriginalMaterials() {
        if (!this.mesh) return;
        
        try {
            this.mesh.traverse(child => {
                if (child.isMesh && child.userData.originalMaterial) {
                    // Restore the original material
                    child.material = child.userData.originalMaterial;
                    
                    // Reset original material in userData to avoid memory leaks
                    // but keep a reference for future hits
                    // child.userData.originalMaterial = null;
                }
            });
        } catch (error) {
            console.warn("Error restoring original materials:", error);
            
            // Fallback: ensure the ship is at least visible
            if (this.mesh) {
                this.mesh.visible = true;
            }
        }
    }
    
    activateInvincibility(duration) {
        this.invincible = true;
        this.invincibleTimer = duration;
    }
    
    addHealth(amount) {
        this.health = Math.min(this.health + amount, this.maxHealth);
        
        // Update health UI
        const healthPercentage = (this.health / this.maxHealth) * 100;
        updateProgressBar('health-fill', healthPercentage);
        updateTextContent('health-value', this.health);
    }
    
    addAmmo(amount) {
        this.ammo += amount;
        updateTextContent('ammo-value', this.ammo);
    }
    
    enableLaser() {
        this.laserEnabled = true;
    }
    
    disableLaser() {
        this.laserEnabled = false;
    }
    
    getPosition() {
        return this.mesh.position.clone();
    }
    
    // New method for enhanced ship orientation based on movement with more subtle tilting
    updateShipOrientation() {
        if (!this.mesh) return;
        
        try {
            // Calculate movement direction with more emphasis on input
            const movementMagnitude = Math.sqrt(this.velocityX * this.velocityX + this.velocityY * this.velocityY);
            
            if (movementMagnitude > 0.01) {
                // Only update direction if there's actual movement
                this.movementDirection.x = this.velocityX / movementMagnitude;
                this.movementDirection.y = this.velocityY / movementMagnitude;
            }
            
            // Check if any movement keys are pressed
            const horizontalKeyPressed = this.game.keys.ArrowLeft || this.game.keys.ArrowRight || 
                                        this.game.keys.KeyA || this.game.keys.KeyD;
            const verticalKeyPressed = this.game.keys.ArrowUp || this.game.keys.ArrowDown || 
                                      this.game.keys.KeyW || this.game.keys.KeyS;
            const noKeysPressed = !horizontalKeyPressed && !verticalKeyPressed;
            
            // REDUCED TILT AMOUNTS for more subtle effect
            // Calculate target angles based on velocity and input direction
            let targetRollAngle = 0;
            let targetPitchAngle = 0;
            
            if (horizontalKeyPressed) {
                // Roll based on horizontal input (left/right) - with reduced tilt
                if (this.game.keys.ArrowLeft || this.game.keys.KeyA) {
                    targetRollAngle = -0.4; // Reduced from -0.8
                } else if (this.game.keys.ArrowRight || this.game.keys.KeyD) {
                    targetRollAngle = 0.4; // Reduced from 0.8
                }
            } else {
                // When no horizontal keys are pressed, use velocity with damping
                targetRollAngle = this.velocityX * 0.5; // Reduced from 1.0
            }
            
            if (verticalKeyPressed) {
                // Pitch based on vertical input (up/down) - with reduced tilt
                if (this.game.keys.ArrowUp || this.game.keys.KeyW) {
                    targetPitchAngle = 0.35; // Reduced from 0.65
                } else if (this.game.keys.ArrowDown || this.game.keys.KeyS) {
                    targetPitchAngle = -0.35; // Reduced from -0.65
                }
            } else {
                // When no vertical keys are pressed, use velocity with damping
                targetPitchAngle = this.velocityY * 0.5; // Reduced from 0.9
            }
            
            // More gradual response time for smoother, less aggressive feel
            // Apply roll (z rotation) with gentler response
            const rollLerpFactor = noKeysPressed ? 0.15 : 0.2; // Reduced from 0.25/0.3
            this.mesh.rotation.z = lerp(this.mesh.rotation.z, targetRollAngle, rollLerpFactor);
            
            // Apply pitch (x rotation) with gentler response
            const pitchLerpFactor = noKeysPressed ? 0.15 : 0.2; // Reduced from 0.25/0.3
            this.mesh.rotation.x = lerp(this.mesh.rotation.x, targetPitchAngle, pitchLerpFactor);
            
            // Add a slight yaw effect for more subtle feel during turns
            let targetYawAngle = Math.PI;
            if (horizontalKeyPressed) {
                // Add slight yaw twist during turns - reduced amount
                targetYawAngle = Math.PI + (this.movementDirection.x * 0.1); // Reduced from 0.2
            }
            
            const yawLerpFactor = 0.1; // Reduced from 0.15 for more gradual response
            this.mesh.rotation.y = lerp(this.mesh.rotation.y, targetYawAngle, yawLerpFactor);
            
            // Apply the smooth reset if no keys are pressed
            if (noKeysPressed) {
                this.applyTiltReset();
            }
        } catch (error) {
            console.warn("Error in updateShipOrientation:", error);
        }
    }
    
    // Add the missing applyTiltReset method
    applyTiltReset() {
        if (!this.mesh) return;
        
        try {
            // Gentle base reset speed
            const baseResetSpeed = 0.1;
            
            // Calculate rotation magnitudes
            const rotZMagnitude = Math.abs(this.mesh.rotation.z);
            const rotXMagnitude = Math.abs(this.mesh.rotation.x);
            
            // Apply resets with gentle speed for natural feel
            if (this.mesh.rotation.z !== 0) {
                this.mesh.rotation.z = lerp(this.mesh.rotation.z, 0, baseResetSpeed);
            }
            
            if (this.mesh.rotation.x !== 0) {
                this.mesh.rotation.x = lerp(this.mesh.rotation.x, 0, baseResetSpeed);
            }
            
            // Reset velocity
            if (this.velocityX !== 0) {
                this.velocityX = lerp(this.velocityX, 0, baseResetSpeed);
            }
            
            if (this.velocityY !== 0) {
                this.velocityY = lerp(this.velocityY, 0, baseResetSpeed);
            }
            
            // Also reset movement direction
            if (this.movementDirection.x !== 0) {
                this.movementDirection.x = lerp(this.movementDirection.x, 0, baseResetSpeed);
            }
            
            if (this.movementDirection.y !== 0) {
                this.movementDirection.y = lerp(this.movementDirection.y, 0, baseResetSpeed);
            }
            
            // Ensure the ship is facing forward
            this.mesh.rotation.y = lerp(this.mesh.rotation.y, Math.PI, baseResetSpeed);
        } catch (error) {
            console.warn("Error in applyTiltReset:", error);
            
            // Simple fallback if something goes wrong
            if (this.mesh) {
                this.mesh.rotation.z = lerp(this.mesh.rotation.z, 0, 0.1);
                this.mesh.rotation.x = lerp(this.mesh.rotation.x, 0, 0.1);
                this.mesh.rotation.y = Math.PI;
                this.velocityX = 0;
                this.velocityY = 0;
            }
        }
    }
}
