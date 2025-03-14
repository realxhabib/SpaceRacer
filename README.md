# Space Racer Game Documentation

## Overview
Space Racer is a Mario Kart-like racing game set in space where players control spaceships, avoid asteroids, and collect power-ups. The game features automatic forward movement with increasing speed, boost mode, and various power-ups to enhance gameplay.

## Game Features
- Two selectable spaceships: Cruiser and Fighter
- Automatic forward movement with speed progression (20 to 200, then +1/second)
- Boost mode that increases speed by 50%
- Asteroid obstacles that reduce health by 10 when hit
- Mystery boxes with four different power-ups:
  - Indestructible mode (7 seconds)
  - Health boost (+10 health)
  - Ammo (+10 rounds)
  - Laser (second bullet)
- Starfield background with hyperspeed effect during boost

## Controls
- Arrow Keys: Move ship (left, right, up, down)
- Shift: Activate boost mode
- Space: Fire bullet (when ammo is available)

## Ship Types
1. **Cruiser**
   - Higher health (120)
   - Slower turning speed
   - Better for beginners

2. **Fighter**
   - Lower health (80)
   - Faster turning speed
   - Better for experienced players

## Power-ups
1. **Indestructible Mode (Nokia)**
   - Makes the player invincible for 7 seconds
   - Player can pass through asteroids without taking damage

2. **Health (Health Pack)**
   - Adds 10 health points to the player
   - Cannot exceed maximum health

3. **Ammo (Ammo Box)**
   - Grants 10 rounds of ammunition
   - Allows player to shoot bullets to destroy asteroids

4. **Laser (Laser Upgrade)**
   - Gives the player a second bullet when shooting
   - Doubles firepower for a limited time

## Game Mechanics
- Players automatically move forward
- Speed starts at 20 and quickly increases to 200
- After reaching 200, speed increases by 1 every second
- Each asteroid hit costs 10 health points
- Game ends when health reaches 0
- Score is based on distance traveled and time survived

## Technical Implementation
The game is built using:
- HTML5 for structure
- CSS3 for styling
- JavaScript for game logic
- Three.js for 3D rendering
- GLTFLoader for loading 3D models

## File Structure
- `index.html`: Main HTML file
- `css/style.css`: CSS styling
- `js/`: JavaScript files
  - `main.js`: Entry point
  - `game.js`: Main game logic
  - `player.js`: Player ship controls and mechanics
  - `asteroids.js`: Asteroid generation and collision
  - `powerups.js`: Power-up system
  - `models.js`: 3D model loading and management
  - `textures.js`: Texture generation
  - `utils.js`: Utility functions
- `assets/`: 3D models and textures

## How to Run
1. Open the `index.html` file in a modern web browser
2. Select your preferred ship (Cruiser or Fighter)
3. Click "Start Race" to begin the game
4. Use the controls to navigate and survive as long as possible

## Development Notes
- The game uses procedural generation for asteroids and power-ups
- Difficulty increases over time with more asteroids spawning
- Visual effects are created using particle systems and texture generation
- The game is optimized for performance with object pooling for bullets and asteroids
