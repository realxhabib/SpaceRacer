# Space Racer - Update Notes (v3)

## New Features Added

### 1. Enhanced Starfield
- Completely redesigned starfield with an endless look
- Added multiple layers of stars (regular, distant, and bright) for a parallax effect
- Increased total number of stars from 1,000 to over 8,000
- Improved star recycling logic for seamless endless appearance

### 2. Improved Asteroid System
- Better asteroid distribution with increased spawn distance
- Widened spawn area for more varied asteroid patterns
- Implemented more granular difficulty scaling:
  - Starts with fewer asteroids (2) for better spacing
  - Gradually increases to 8 asteroids with shorter spawn intervals
  - Six difficulty levels based on play time (30s, 1m, 2m, 3m, 4m, 5m)

### 3. Repositioned Mystery Box Animation
- Moved mystery box animation to the side of the screen
- Less intrusive placement improves gameplay visibility

### 4. Non-Colliding Mystery Boxes
- Mystery boxes now only collide with the player
- No longer interact with asteroids or other objects
- Improves gameplay flow and reduces frustration

### 5. Enhanced Player Movement
- Significantly wider field of motion:
  - Horizontal range doubled (from ±10 to ±20)
  - Vertical range doubled (from ±5 to ±10)
- Improved turning capabilities:
  - Increased base turn speeds for both ships
  - Cruiser: 0.05 → 0.08
  - Fighter: 0.08 → 0.12
- More responsive controls:
  - Movement strength multiplier increased from 1.5 to 1.8
  - Tilt angles increased for better visual feedback
  - Faster response to input (lerp factor increased from 0.2 to 0.25)

## Previous Updates (v2)

### 1. Mystery Box Collection Animation
- Added a visual animation that cycles through all possible power-ups when collecting a mystery box
- Animation displays for 1.5 seconds with items cycling every 150ms
- Provides visual feedback about the randomization process

### 2. Power-up Notification System
- Added text notifications that inform the player which power-up they received
- Notifications appear at the top of the screen with color-coding:
  - Indestructible Mode: Cyan
  - Health: Green
  - Ammo: Red
  - Laser: Magenta
- Notifications remain visible for 2 seconds

## Original Updates (v1)

### 1. Asteroid Size Adjustment
- Reduced asteroid scale range from 0.5-1.5 to 0.2-0.6
- This makes asteroids less overwhelming and improves gameplay balance

### 2. Ship Orientation Fix
- Rotated ships 180 degrees to face the correct forward direction
- Ships now properly face the direction of travel

### 3. Control Improvements
- Increased movement strength by 50% for more responsive controls
- Enhanced ship tilting effects:
  - More pronounced tilt angles (from 0.1-0.2 to 0.3-0.4 radians)
  - Faster response to input (lerp factor increased from 0.1 to 0.2)
  - Quicker return to neutral position when no input is detected
