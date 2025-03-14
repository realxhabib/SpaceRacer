/**
 * Texture generator for Space Racer game
 */

// Create power-up icon textures using canvas
function generatePowerUpIcons() {
    // Create canvas for icon generation
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    // Generate Nokia (Indestructible) icon
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(10, 10, 44, 44);
    ctx.fillStyle = '#000000';
    ctx.fillRect(15, 15, 34, 34);
    ctx.fillStyle = '#00ffff';
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            ctx.fillRect(20 + i * 10, 20 + j * 10, 5, 5);
        }
    }
    const nokiaIcon = canvas.toDataURL();
    
    // Generate Health icon
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(28, 10, 8, 44);
    ctx.fillRect(10, 28, 44, 8);
    const healthIcon = canvas.toDataURL();
    
    // Generate Ammo icon
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(10, 28, 44, 8);
    ctx.fillRect(20, 15, 8, 34);
    ctx.fillRect(36, 15, 8, 34);
    const ammoIcon = canvas.toDataURL();
    
    // Generate Laser icon
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#ff00ff';
    ctx.beginPath();
    ctx.moveTo(32, 10);
    ctx.lineTo(42, 54);
    ctx.lineTo(32, 48);
    ctx.lineTo(22, 54);
    ctx.closePath();
    ctx.fill();
    const laserIcon = canvas.toDataURL();
    
    // Return all icons
    return {
        nokia: nokiaIcon,
        health: healthIcon,
        ammo: ammoIcon,
        laser: laserIcon
    };
}

// Create explosion texture
function createExplosionTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Create radial gradient for explosion
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 0, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 100, 0, 1)');
    gradient.addColorStop(0.7, 'rgba(255, 0, 0, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    
    return canvas.toDataURL();
}

// Create shield texture
function createShieldTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Create radial gradient for shield
    const gradient = ctx.createRadialGradient(64, 64, 50, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
    gradient.addColorStop(0.7, 'rgba(0, 255, 255, 0.2)');
    gradient.addColorStop(0.9, 'rgba(0, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0.2)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    
    return canvas.toDataURL();
}

// Create bullet texture
function createBulletTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Create radial gradient for bullet
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 0, 0, 1)');
    gradient.addColorStop(0.7, 'rgba(255, 0, 0, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    return canvas.toDataURL();
}

// Create laser texture
function createLaserTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Create radial gradient for laser
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 0, 255, 1)');
    gradient.addColorStop(0.7, 'rgba(255, 0, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    return canvas.toDataURL();
}

// Export texture generation functions
window.GameTextures = {
    generatePowerUpIcons,
    createExplosionTexture,
    createShieldTexture,
    createBulletTexture,
    createLaserTexture
};
