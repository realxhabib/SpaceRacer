// Create power-up icon textures
const canvas = document.createElement('canvas');
canvas.width = 64;
canvas.height = 64;
const ctx = canvas.getContext('2d');

// Nokia (Indestructible) icon
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
saveIcon('nokia.png', nokiaIcon);

// Health icon
ctx.clearRect(0, 0, 64, 64);
ctx.fillStyle = '#00ff00';
ctx.fillRect(28, 10, 8, 44);
ctx.fillRect(10, 28, 44, 8);
const healthIcon = canvas.toDataURL();
saveIcon('health.png', healthIcon);

// Ammo icon
ctx.clearRect(0, 0, 64, 64);
ctx.fillStyle = '#ff0000';
ctx.fillRect(10, 28, 44, 8);
ctx.fillRect(20, 15, 8, 34);
ctx.fillRect(36, 15, 8, 34);
const ammoIcon = canvas.toDataURL();
saveIcon('ammo.png', ammoIcon);

// Laser icon
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
saveIcon('laser.png', laserIcon);

// Function to save icon as image file
function saveIcon(filename, dataUrl) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
