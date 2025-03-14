/**
 * Utility functions for the Space Racer game
 */

// Random number generator within a range
function getRandomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Calculate distance between two 3D points
function distance(obj1, obj2) {
    return Math.sqrt(
        Math.pow(obj1.position.x - obj2.position.x, 2) +
        Math.pow(obj1.position.y - obj2.position.y, 2) +
        Math.pow(obj1.position.z - obj2.position.z, 2)
    );
}

// Clamp a value between min and max
function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

// Format time in MM:SS format
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Format distance in km
function formatDistance(distance) {
    return `${Math.floor(distance / 100)} km`;
}

// Lerp (Linear interpolation)
function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

// Ease in-out function
function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Show element
function showElement(elementId) {
    document.getElementById(elementId).style.display = 'flex';
}

// Hide element
function hideElement(elementId) {
    document.getElementById(elementId).style.display = 'none';
}

// Update progress bar
function updateProgressBar(elementId, percentage) {
    document.getElementById(elementId).style.width = `${percentage}%`;
}

// Update text content
function updateTextContent(elementId, text) {
    document.getElementById(elementId).textContent = text;
}

// Create a particle system
function createParticleSystem(color, size, count, options = {}) {
    try {
        // Validate and sanitize input parameters
        color = color || 0xffffff;
        size = isNaN(size) ? 1.0 : Math.max(0.1, Math.min(10, size)); // Limit size to reasonable values
        count = isNaN(count) ? 100 : Math.max(1, Math.min(10000, count));
        
        // Extract optional parameters
        const isExplosion = options.isExplosion || false;
        const isFastAsteroid = options.isFastAsteroid || false;
        const velocityFactor = options.velocityFactor || 1.0;
        
        const particles = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];
        const colors = [];
        
        // Create a main color and secondary color for variation
        const mainColor = new THREE.Color(color);
        const secondaryColor = new THREE.Color(color).offsetHSL(0.05, 0, 0.2); // Slight hue shift and brighter
        
        // Create position array with safe values
        for (let i = 0; i < count; i++) {
            // For explosions, use spherical distribution
            if (isExplosion) {
                // Use spherical coordinates for better explosion effect
                const phi = Math.random() * Math.PI * 2;
                const theta = Math.random() * Math.PI;
                const r = Math.random() * (isFastAsteroid ? 8 : 5); // Bigger radius for fast asteroids
                
                // Convert to Cartesian coordinates
                const x = r * Math.sin(theta) * Math.cos(phi);
                const y = r * Math.sin(theta) * Math.sin(phi);
                const z = r * Math.cos(theta);
                
                positions.push(x, y, z);
                
                // Add velocity data for animation
                const speed = (0.5 + Math.random() * 0.5) * velocityFactor;
                velocities.push(
                    x / r * speed,
                    y / r * speed,
                    z / r * speed
                );
                
                // Color variation
                const ratio = Math.random();
                const particleColor = new THREE.Color(
                    mainColor.r * ratio + secondaryColor.r * (1 - ratio),
                    mainColor.g * ratio + secondaryColor.g * (1 - ratio),
                    mainColor.b * ratio + secondaryColor.b * (1 - ratio)
                );
                
                colors.push(particleColor.r, particleColor.g, particleColor.b);
            } else {
                // Default random distribution
                positions.push(
                    getRandomFloat(-50, 50),
                    getRandomFloat(-50, 50),
                    getRandomFloat(-1000, 0)
                );
                
                // Add default velocity and color
                velocities.push(0, 0, 0);
                colors.push(mainColor.r, mainColor.g, mainColor.b);
            }
        }
        
        // Check if we've created valid positions
        if (positions.length === 0) {
            positions.push(0, 0, 0); // Add at least one particle at origin
            velocities.push(0, 0, 0);
            colors.push(mainColor.r, mainColor.g, mainColor.b);
        }
        
        // Set attributes
        particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        particles.computeBoundingSphere(); // Ensure bounding sphere is calculated
        
        // Store velocity data for animation
        particles.userData = {
            velocities: velocities,
            isExplosion: isExplosion,
            age: 0
        };
        
        // Create a safe material with defaults and explicit uniform values
        const material = new THREE.PointsMaterial({
            color: new THREE.Color(0xffffff), // Use white base color
            vertexColors: true, // Use vertex colors
            size: size,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            depthWrite: false, // Improve rendering performance
            fog: false // Disable fog for performance
        });
        
        // Explicitly set critical uniforms that Three.js might look for
        if (material.uniforms) {
            // Ensure any shader uniforms have proper values
            if (material.uniforms.size && material.uniforms.size.value === undefined) {
                material.uniforms.size = { value: size };
            }
            if (material.uniforms.color && material.uniforms.color.value === undefined) {
                material.uniforms.color = { value: new THREE.Color(0xffffff) };
            }
        }
        
        // Create the particle system
        const system = new THREE.Points(particles, material);
        
        // Set additional properties for better rendering stability
        system.frustumCulled = false; // Prevent particles from disappearing at edges
        system.renderOrder = 1000; // Ensure particles render last
        system.matrixAutoUpdate = true;
        system.visible = true; // Ensure it's initially visible
        
        // Add animation function for explosions
        if (isExplosion) {
            system.update = function(deltaTime) {
                const positions = this.geometry.attributes.position.array;
                const velocities = this.geometry.userData.velocities;
                
                // Update age
                this.geometry.userData.age += deltaTime;
                
                // Fade based on age
                const normalizedAge = Math.min(this.geometry.userData.age / 1.0, 1.0);
                this.material.opacity = 0.8 * (1.0 - normalizedAge);
                
                // Update positions based on velocities
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i] += velocities[i] * deltaTime * 30;     // x
                    positions[i+1] += velocities[i+1] * deltaTime * 30; // y
                    positions[i+2] += velocities[i+2] * deltaTime * 30; // z
                    
                    // Add slight gravity effect
                    velocities[i+1] -= 0.05 * deltaTime; // y velocity decreases over time
                }
                
                // Mark position attribute as needing update
                this.geometry.attributes.position.needsUpdate = true;
                
                return normalizedAge < 1.0; // Return true while animation should continue
            };
        }
        
        return system;
    } catch (error) {
        console.error("Error creating particle system:", error);
        
        // Create a fallback minimal particle system that's guaranteed to work
        const fallbackGeometry = new THREE.BufferGeometry();
        fallbackGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
        
        const fallbackMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.0,
            transparent: true,
            opacity: 0.5,
            sizeAttenuation: false
        });
        
        const fallbackSystem = new THREE.Points(fallbackGeometry, fallbackMaterial);
        fallbackSystem.frustumCulled = false;
        
        return fallbackSystem;
    }
}
