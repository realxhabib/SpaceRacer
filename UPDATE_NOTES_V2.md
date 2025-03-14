# Space Racer - Update Notes (v2)

## New Features Added

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

## Previous Updates (v1)

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
- These changes make the ship feel more responsive and provide better visual feedback during movement
