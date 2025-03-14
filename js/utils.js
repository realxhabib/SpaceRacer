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
function createParticleSystem(color, size, count) {
    try {
        // Validate and sanitize input parameters
        color = color || 0xffffff;
        size = isNaN(size) ? 1.0 : Math.max(0.1, Math.min(10, size)); // Limit size to reasonable values
        count = isNaN(count) ? 100 : Math.max(1, Math.min(10000, count));
        
        const particles = new THREE.BufferGeometry();
        const positions = [];
        
        // Create position array with safe values
        for (let i = 0; i < count; i++) {
            positions.push(
                getRandomFloat(-50, 50),
                getRandomFloat(-50, 50),
                getRandomFloat(-1000, 0)
            );
        }
        
        // Check if we've created valid positions
        if (positions.length === 0) {
            positions.push(0, 0, 0); // Add at least one particle at origin
        }
        
        // Set the position attribute
        particles.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        particles.computeBoundingSphere(); // Ensure bounding sphere is calculated
        
        // Create a safe material with defaults and explicit uniform values
        const material = new THREE.PointsMaterial({
            color: new THREE.Color(color),
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
                material.uniforms.color = { value: new THREE.Color(color) };
            }
        }
        
        // Create the particle system
        const system = new THREE.Points(particles, material);
        
        // Set additional properties for better rendering stability
        system.frustumCulled = false; // Prevent particles from disappearing at edges
        system.renderOrder = 1000; // Ensure particles render last
        system.matrixAutoUpdate = true;
        system.visible = true; // Ensure it's initially visible
        
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
