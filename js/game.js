/**
 * Main Game class for Space Racer
 */

class Game {
    constructor() {
        // Game state
        this.isRunning = false;
        this.gameTime = 0;
        this.distance = 0;
        this.selectedShip = 'cruiser'; // Default ship
        this.cameraZoomLevel = 10; // Default zoom level (distance behind player)
        this.minZoom = 3; // Closest zoom
        this.maxZoom = 20; // Furthest zoom
        
        // Screen shake effect properties
        this.screenShakeActive = false;
        this.screenShakeIntensity = 0;
        this.screenShakeDuration = 0;
        this.screenShakeTimer = 0;
        this.cameraOriginalPosition = new THREE.Vector3();
        
        // Setup scene
        this.setupScene();
        
        // Setup models manager
        this.modelsManager = new ModelsManager(this);
        
        // Input state
        this.keys = {
            ArrowLeft: false,
            ArrowRight: false,
            ArrowUp: false,
            ArrowDown: false,
            Space: false,
            ShiftLeft: false,
            ShiftRight: false,
            Minus: false,
            Equal: false, // This is the "+" key (without shift)
            KeyW: false,  // W key
            KeyA: false,  // A key
            KeyS: false,  // S key
            KeyD: false   // D key
        };
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start loading assets
        this.loadAssets();
    }
    
    setupScene() {
        // Create scene
        this.scene = new THREE.Scene();
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 2, 10);
        this.camera.lookAt(0, 0, 0);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000);
        document.getElementById('game-canvas').appendChild(this.renderer.domElement);
        
        // Apply safety patch for Three.js material handling
        this.patchMaterialHandling();
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        
        // Create starfield
        this.createStarfield();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    // Patch Three.js material handling to prevent "cannot read properties of undefined" errors
    patchMaterialHandling() {
        // Safety wrapper for the render function
        const originalRender = this.renderer.render.bind(this.renderer);
        
        this.renderer.render = (scene, camera) => {
            try {
                // Before rendering, traverse the scene and check for problematic materials
                scene.traverse(object => {
                    if (object.material) {
                        this.sanitizeMaterial(object.material);
                    }
                    
                    // Special handling for Points objects (particle systems like stars)
                    if (object.isPoints || object.type === 'Points') {
                        this.sanitizeParticleSystem(object);
                    }
                });
                
                // Call the original render with additional try/catch
                try {
                    originalRender(scene, camera);
                } catch (error) {
                    console.warn("Inner render error caught:", error);
                    
                    // Emergency cleanup of problematic materials
                    this.emergencyMaterialCleanup(scene);
                    
                    // Try one more time with simplified materials
                    try {
                        originalRender(scene, camera);
                    } catch (innerError) {
                        console.error("Critical render failure, could not recover:", innerError);
                    }
                }
            } catch (error) {
                console.warn("Outer render preparation error caught:", error);
            }
        };
    }
    
    // Sanitize material to prevent errors
    sanitizeMaterial(material) {
        if (!material) return;
        
        // Skip if material has already been sanitized
        if (material.userData && material.userData.__sanitized) {
            return;
        }
        
        // Handle arrays of materials
        if (Array.isArray(material)) {
            material.forEach(m => this.sanitizeMaterial(m));
            return;
        }
        
        try {
            // Special handling for bullets and laser materials
            if (material.type === 'MeshBasicMaterial' && 
                ((material.color && material.color.r > 0.9 && material.color.g < 0.3 && material.color.b < 0.3) || // Red bullet
                 (material.color && material.color.r > 0.9 && material.color.g < 0.3 && material.color.b > 0.9))) { // Purple laser
                
                // Make sure bullets use the simplest material possible
                material.fog = false;
                material.needsUpdate = true;
                material.transparent = true;
                material.depthWrite = false;
                material.blending = THREE.AdditiveBlending;
                
                // Skip further processing for bullet materials
                material.userData = material.userData || {};
                material.userData.__sanitized = true;
                return;
            }
            
            // Check for emissive properties
            if (material.emissive !== undefined) {
                // Make sure emissive is a valid color
                if (!(material.emissive instanceof THREE.Color)) {
                    material.emissive = new THREE.Color(0x000000);
                }
            }
            
            // Check for map textures
            if (material.map && (material.map.image === undefined || material.map.image === null)) {
                // Replace with a 1x1 empty texture
                material.map = null;
            }
            
            // Validate uniforms if they exist
            if (material.uniforms) {
                for (const key in material.uniforms) {
                    const uniform = material.uniforms[key];
                    
                    // Check if uniform value is missing or undefined
                    if (!uniform || uniform.value === undefined) {
                        // Provide safe default values based on type
                        switch (key) {
                            case 'color':
                                material.uniforms[key] = { value: new THREE.Color(0xffffff) };
                                break;
                            case 'emissive':
                                material.uniforms[key] = { value: new THREE.Color(0x000000) };
                                break;
                            case 'opacity':
                                material.uniforms[key] = { value: 1.0 };
                                break;
                            case 'map':
                                material.uniforms[key] = { value: null };
                                break;
                            case 'size':
                                material.uniforms[key] = { value: 1.0 };
                                break;
                            // Add other common uniform types as needed
                            default:
                                // For unknown types, set a default numeric value
                                material.uniforms[key] = { value: 0 };
                        }
                    }
                }
            }
            
            // Ensure all other critical properties have defaults
            if (material.opacity === undefined) material.opacity = 1.0;
            if (material.transparent === undefined) material.transparent = false;
            if (material.vertexColors === undefined) material.vertexColors = false;
            
            // Mark as sanitized
            material.userData = material.userData || {};
            material.userData.__sanitized = true;
            
        } catch (error) {
            console.warn("Error while sanitizing material:", error);
            // If all else fails, replace with a basic material
            if (material.type && material.type.includes('Points')) {
                return new THREE.PointsMaterial({ color: 0xffffff, size: 1.0 });
            } else {
                return new THREE.MeshBasicMaterial({ color: 0xcccccc });
            }
        }
    }
    
    // Special handling for particle systems
    sanitizeParticleSystem(points) {
        if (!points || !points.material) return;
        
        try {
            const material = points.material;
            
            // Make sure size is valid
            if (material.size === undefined || isNaN(material.size)) {
                material.size = 1.0;
            }
            
            // Make sure color is valid
            if (!material.color || !(material.color instanceof THREE.Color)) {
                material.color = new THREE.Color(0xffffff);
            }
            
            // Fix shader uniforms directly - this addresses the 'value' property error
            if (material.uniforms) {
                // Direct uniform fixes - ensuring all required uniforms exist and have valid values
                const requiredUniforms = ['size', 'color', 'map', 'opacity', 'scale'];
                
                for (const key of requiredUniforms) {
                    // If uniform exists but has no value property, fix it
                    if (material.uniforms[key] && material.uniforms[key].value === undefined) {
                        // Provide default values based on uniform type
                        switch(key) {
                            case 'size':
                                material.uniforms[key].value = material.size || 1.0;
                                break;
                            case 'color':
                                material.uniforms[key].value = material.color ? material.color.clone() : new THREE.Color(0xffffff);
                                break;
                            case 'map':
                                material.uniforms[key].value = null;
                                break;
                            case 'opacity':
                                material.uniforms[key].value = material.opacity !== undefined ? material.opacity : 1.0;
                                break;
                            case 'scale':
                                material.uniforms[key].value = 1.0;
                                break;
                            default:
                                material.uniforms[key].value = 0;
                        }
                    }
                    // If uniform doesn't exist but should, create it
                    else if (!material.uniforms[key]) {
                        // Same default values as above
                        switch(key) {
                            case 'size':
                                material.uniforms[key] = { value: material.size || 1.0 };
                                break;
                            case 'color':
                                material.uniforms[key] = { value: material.color ? material.color.clone() : new THREE.Color(0xffffff) };
                                break;
                            case 'map':
                                material.uniforms[key] = { value: null };
                                break;
                            case 'opacity':
                                material.uniforms[key] = { value: material.opacity !== undefined ? material.opacity : 1.0 };
                                break;
                            case 'scale':
                                material.uniforms[key] = { value: 1.0 };
                                break;
                            default:
                                material.uniforms[key] = { value: 0 };
                        }
                    }
                }
            }
            
            // Ensure geometry is valid
            if (points.geometry) {
                const position = points.geometry.attributes.position;
                if (position && position.count === 0) {
                    // If geometry has no points, hide it
                    points.visible = false;
                }
                
                // Set needsUpdate flags explicitly
                if (position && position.array && position.array.length > 0) {
                    position.needsUpdate = true;
                    
                    // Validate and fix any NaN values in positions
                    for (let i = 0; i < position.array.length; i++) {
                        if (isNaN(position.array[i])) {
                            position.array[i] = 0;
                        }
                    }
                }
                
                // Make sure the bounding sphere exists
                if (!points.geometry.boundingSphere) {
                    points.geometry.computeBoundingSphere();
                }
            }
            
            // For PointsMaterial specifically
            if (material.type === 'PointsMaterial' || material instanceof THREE.PointsMaterial) {
                // Ensure valid defaults
                material.sizeAttenuation = material.sizeAttenuation !== undefined ? material.sizeAttenuation : true;
                material.alphaTest = material.alphaTest || 0.0;
                material.transparent = material.transparent !== undefined ? material.transparent : true;
                material.depthWrite = false; // Improve performance
                material.fog = false; // Prevent fog interactions that can cause issues
                
                // Fix any THREE.js shader quirks by directly setting shader-related properties
                if (material.defines === undefined) {
                    material.defines = {};
                }
                
                // If Three.js is looking for a 'value' property on any of these, ensure they exist
                if (material.uniforms) {
                    // Explicitly handle the main uniforms that THREE.js shader might need
                    const uniformsToCheck = ['size', 'scale', 'map', 'uvTransform'];
                    for (const key of uniformsToCheck) {
                        if (material.uniforms[key] && material.uniforms[key].value === undefined) {
                            if (key === 'size') {
                                material.uniforms[key].value = material.size || 1.0;
                            } 
                            else if (key === 'scale') {
                                material.uniforms[key].value = 1.0;
                            }
                            else if (key === 'map') {
                                material.uniforms[key].value = null;
                            }
                            else if (key === 'uvTransform') {
                                material.uniforms[key].value = new THREE.Matrix3().identity();
                            }
                        }
                    }
                }
            }
            
            // Add a version flag to prevent re-sanitizing if possible
            material.__sanitized = true;
        } catch (error) {
            console.warn("Error sanitizing particle system:", error);
            
            // For critical errors, replace with a simpler material
            try {
                points.material = new THREE.PointsMaterial({ 
                    color: 0xffffff, 
                    size: 1.0,
                    transparent: true,
                    opacity: 0.8,
                    depthWrite: false,
                    fog: false
                });
                points.material.__sanitized = true;
            } catch (fallbackError) {
                console.error("Critical error in particle system sanitization:", fallbackError);
                points.visible = false; // Last resort: hide the problematic particle system
            }
        }
    }
    
    // Emergency cleanup for critical rendering failures
    emergencyMaterialCleanup(scene) {
        scene.traverse(object => {
            // For critical errors, simplify all materials
            if (object.material) {
                if (object.isPoints || object.type === 'Points') {
                    object.material = new THREE.PointsMaterial({ 
                        color: 0xffffff, 
                        size: 1.0,
                        transparent: true,
                        opacity: 0.8
                    });
                } else if (object.isMesh) {
                    object.material = new THREE.MeshBasicMaterial({ color: 0xcccccc });
                }
            }
        });
    }
    
    createStarfield() {
        // Create enhanced endless starfield with more stars and better distribution
        this.starfield = createParticleSystem(0xffffff, 0.5, 4000);         // Increased from 3000
        this.scene.add(this.starfield);
        
        // Create distant stars (smaller, more numerous)
        this.distantStarfield = createParticleSystem(0xccccff, 0.2, 6000);  // Increased from 5000
        this.scene.add(this.distantStarfield);
        
        // Create bright stars (larger, fewer)
        this.brightStarfield = createParticleSystem(0xffffff, 1.0, 300);    // Increased from 200
        this.scene.add(this.brightStarfield);
        
        // Position stars in multiple layers for parallax effect and endless appearance
        // Increased all radii for more spread apart stars
        this.positionStarfieldStars(this.starfield.geometry.attributes.position.array, 200, 600, 5000);        // Wider radius and deeper
        this.positionStarfieldStars(this.distantStarfield.geometry.attributes.position.array, 400, 1000, 8000); // Much wider radius and deeper
        this.positionStarfieldStars(this.brightStarfield.geometry.attributes.position.array, 150, 350, 3000);  // Wider radius and deeper
        
        this.starfield.geometry.attributes.position.needsUpdate = true;
        this.distantStarfield.geometry.attributes.position.needsUpdate = true;
        this.brightStarfield.geometry.attributes.position.needsUpdate = true;
    }
    
    positionStarfieldStars(positions, minRadius, maxRadius, depth) {
        for (let i = 0; i < positions.length; i += 3) {
            // Use improved distribution method for better star spread
            // 1. Select distribution type
            const distributionType = Math.random();
            
            if (distributionType < 0.7) {
                // 70% of stars use cylindrical coordinates for uniform spread
                const radius = minRadius + Math.random() * (maxRadius - minRadius);
                const theta = Math.random() * Math.PI * 2;
                const y = Math.random() * 600 - 300; // Wider vertical distribution
                
                positions[i] = radius * Math.cos(theta);
                positions[i + 1] = y;
            } else {
                // 30% of stars are more randomly placed for natural look
                positions[i] = (Math.random() - 0.5) * maxRadius * 2;
                positions[i + 1] = (Math.random() - 0.5) * 600;
            }
            
            // Distribute along z-axis with exponential falloff for depth perception
            // More stars closer to the player, fewer far away
            const zDistribution = Math.pow(Math.random(), 1.5); // Exponential distribution
            positions[i + 2] = -depth + (zDistribution * depth * 2);
        }
    }
    
    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (event) => {
            if (this.keys.hasOwnProperty(event.code)) {
                this.keys[event.code] = true;
                
                // Handle zoom out (minus key)
                if (event.code === 'Minus') {
                    this.zoomOut();
                }
                
                // Handle zoom in (plus/equal key)
                if (event.code === 'Equal') {
                    this.zoomIn();
                }
                
                // Prevent default for game keys
                event.preventDefault();
            }
        });
        
        // Add mouse wheel event for zooming
        document.addEventListener('wheel', (event) => {
            if (this.isRunning) {
                // Zoom in or out based on scroll direction
                if (event.deltaY < 0) {
                    this.zoomIn();
                } else {
                    this.zoomOut();
                }
                event.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('keyup', (event) => {
            if (this.keys.hasOwnProperty(event.code)) {
                this.keys[event.code] = false;
                
                // Fire bullet on space key up
                if (event.code === 'Space') {
                    this.player.fireBullet();
                }
                
                // Prevent default for game keys
                event.preventDefault();
            }
        });
        
        // Add specific event listener for Shift key to fix boost functionality
        document.addEventListener('keydown', (event) => {
            if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
                if (this.player) {
                    this.player.activateBoost();
                }
                event.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (event) => {
            if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
                if (this.player) {
                    this.player.deactivateBoost();
                }
                event.preventDefault();
            }
        });
        
        // Ship selection
        document.getElementById('cruiser-option').addEventListener('click', () => {
            this.selectShip('cruiser');
        });
        
        document.getElementById('fighter-option').addEventListener('click', () => {
            this.selectShip('fighter');
        });
        
        // Start game button
        document.getElementById('start-game').addEventListener('click', () => {
            this.startGame();
        });
        
        // Restart game button
        document.getElementById('restart-game').addEventListener('click', () => {
            this.restartGame();
        });
    }
    
    loadAssets() {
        // Show loading screen
        showElement('loading-screen');
        
        // Load all models
        this.modelsManager.loadModels(() => {
            // All models loaded
            console.log('All models loaded');
            
            // Setup ship previews
            this.modelsManager.setupShipPreviews();
            
            // Hide loading screen and show start screen
            hideElement('loading-screen');
            showElement('start-screen');
        });
    }
    
    selectShip(shipType) {
        this.selectedShip = shipType;
        
        // Update UI
        document.querySelectorAll('.ship-option').forEach(element => {
            element.classList.remove('selected');
        });
        
        document.getElementById(`${shipType}-option`).classList.add('selected');
    }
    
    startGame() {
        // Hide start screen
        hideElement('start-screen');
        
        // Show game UI
        document.getElementById('game-ui').style.display = 'block';
        
        // Create player with selected ship
        this.player = new Player(this, this.selectedShip);
        
        // Create asteroids manager
        this.asteroidsManager = new AsteroidsManager(this);
        this.asteroidsManager.initialize();
        
        // Create power-ups manager
        this.powerUpsManager = new PowerUpsManager(this);
        this.powerUpsManager.initialize();
        
        // Set game state
        this.isRunning = true;
        this.gameTime = 0;
        this.distance = 0;
        
        // Start game loop
        this.lastTime = performance.now();
        this.gameLoop();
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;
        
        // Update game time
        this.gameTime += deltaTime;
        
        // Update distance
        if (this.player && this.player.speed) {
            this.distance += this.player.speed * deltaTime;
            
            // Update distance display in UI
            updateTextContent('distance-value', formatDistance(this.distance));
        }
        
        try {
            // Handle input
            this.handleInput(deltaTime);
            
            // Update player
            if (this.player) {
                this.player.update(deltaTime);
            }
            
            // Update camera position to follow player
            this.updateCamera();
            
            // Update asteroids
            if (this.asteroidsManager) {
                this.asteroidsManager.update(deltaTime);
            }
            
            // Update power-ups
            if (this.powerUpsManager) {
                this.powerUpsManager.update(deltaTime);
            }
            
            // Update starfield with safety check
            try {
                this.updateStarfield(deltaTime);
            } catch (starfieldError) {
                console.warn("Starfield update error:", starfieldError);
            }
            
            // Pre-render safety check - validate all particle systems before rendering
            this.scene.traverse(object => {
                if (object.isPoints || object.type === 'Points') {
                    this.sanitizeParticleSystem(object);
                }
            });
            
            // Render scene
            try {
                this.renderer.render(this.scene, this.camera);
            } catch (error) {
                console.warn("Render error caught in game loop:", error);
                
                // Emergency cleanup before trying again
                this.emergencyMaterialCleanup(this.scene);
                
                // Try a last-resort render with simplified materials
                try {
                    this.renderer.render(this.scene, this.camera);
                } catch (criticalError) {
                    console.error("Critical rendering failure:", criticalError);
                    // Game can continue even if a frame fails to render
                }
            }
        } catch (gameLoopError) {
            console.error("Game loop error:", gameLoopError);
            // Continue execution to prevent complete game lockup
        }
        
        // Continue game loop
        requestAnimationFrame(() => this.gameLoop());
    }
    
    handleInput(deltaTime) {
        try {
            if (!this.player || !this.player.mesh) return;
            
            // Handle movement - process all inputs separately instead of else-if
            // This allows diagonal movement and smooth transitions
            
            // Left movement - Arrow Left or A
            if (this.keys.ArrowLeft || this.keys.KeyA) {
                this.player.moveLeft(deltaTime);
            }
            
            // Right movement - Arrow Right or D
            if (this.keys.ArrowRight || this.keys.KeyD) {
                this.player.moveRight(deltaTime);
            }
            
            // Up movement - Arrow Up or W
            if (this.keys.ArrowUp || this.keys.KeyW) {
                this.player.moveUp(deltaTime);
            }
            
            // Down movement - Arrow Down or S
            if (this.keys.ArrowDown || this.keys.KeyS) {
                this.player.moveDown(deltaTime);
            }
            
            // Always gradually reset rotation for smooth transitions
            // Only if the player object and resetRotation method exist
            if (this.player && typeof this.player.resetRotation === 'function') {
                this.player.resetRotation();
            }
            
            // Handle boost
            if (this.keys.ShiftLeft || this.keys.ShiftRight) {
                if (this.player && typeof this.player.activateBoost === 'function') {
                    this.player.activateBoost();
                }
            } else {
                if (this.player && typeof this.player.deactivateBoost === 'function') {
                    this.player.deactivateBoost();
                }
            }
        } catch (error) {
            console.error("Error in handleInput:", error);
        }
    }
    
    updateCamera() {
        if (!this.player || !this.player.mesh) return;
        
        // Get the ship's position
        const shipPosition = this.player.mesh.position.clone();
        
        // Calculate tilt based on ship's direction
        const movementDirection = this.player.movementDirection || { x: 0, y: 0 };
        
        // Position camera directly behind ship, keeping the ship perfectly centered
        // Do NOT apply horizontal or vertical offsets based on movement - this ensures the ship stays centered
        this.camera.position.x = shipPosition.x; // Keep camera directly behind ship on X axis
        this.camera.position.y = shipPosition.y + 1.5; // Slight Y offset for better view
        this.camera.position.z = shipPosition.z + this.cameraZoomLevel;
        
        // Store original camera position for screen shake effect
        this.cameraOriginalPosition.copy(this.camera.position);
        
        // Apply screen shake if active
        if (this.screenShakeActive) {
            this.updateScreenShake();
        }
        
        // Keep the camera tilt effects for visual feedback
        const tiltX = movementDirection.y * 0.035; // Slight tilt up/down
        const tiltZ = -movementDirection.x * 0.05; // Slight roll during turns
        
        // Apply the camera rotation with smooth transitions
        this.camera.rotation.x = lerp(this.camera.rotation.x, tiltX, 0.1);
        this.camera.rotation.z = lerp(this.camera.rotation.z, tiltZ, 0.1);
        
        // Look directly at a point in front of the ship
        const lookAtPoint = new THREE.Vector3(
            shipPosition.x,
            shipPosition.y,
            shipPosition.z - 30 // Looking slightly ahead of the ship
        );
        this.camera.lookAt(lookAtPoint);
    }
    
    updateStarfield(deltaTime) {
        try {
            // Safety check for player
            if (!this.player) return;
            
            // Get player speed with bounds checking
            const playerSpeed = this.player.boosting && this.player.boostMultiplier ? 
                this.player.speed * this.player.boostMultiplier : 
                this.player.speed;
                
            // Constrain the base speed to prevent extremely large jumps
            const baseSpeed = Math.min(playerSpeed * deltaTime * 0.5, 5.0);
            
            // Process starfields in order of importance
            // Main starfield (most visible)
            if (this.starfield && this.starfield.geometry && this.starfield.geometry.attributes.position) {
                this.updateStarfieldLayer(
                    this.starfield.geometry.attributes.position.array, 
                    baseSpeed, 
                    5000
                );
                this.starfield.geometry.attributes.position.needsUpdate = true;
            }
            
            // Distant starfield (background layer)
            if (this.distantStarfield && this.distantStarfield.geometry && this.distantStarfield.geometry.attributes.position) {
                this.updateStarfieldLayer(
                    this.distantStarfield.geometry.attributes.position.array, 
                    baseSpeed * 0.3, 
                    8000
                );
                this.distantStarfield.geometry.attributes.position.needsUpdate = true;
            }
            
            // Bright starfield (highlight layer)
            if (this.brightStarfield && this.brightStarfield.geometry && this.brightStarfield.geometry.attributes.position) {
                this.updateStarfieldLayer(
                    this.brightStarfield.geometry.attributes.position.array, 
                    baseSpeed * 0.7, 
                    3000
                );
                this.brightStarfield.geometry.attributes.position.needsUpdate = true;
            }
        } catch (error) {
            console.error("Error updating starfield:", error);
        }
    }
    
    updateStarfieldLayer(positions, speed, depth) {
        try {
            // Safety checks for parameters
            if (!positions || !positions.length) return;
            
            // Constrain speed to prevent extreme movements
            speed = isNaN(speed) ? 0.1 : Math.min(Math.max(speed, -10), 10);
            depth = isNaN(depth) ? 5000 : Math.max(1000, depth);
        
            // Get camera and player positions with safety checks
            if (!this.camera || !this.player || !this.player.mesh) return;
            
            const cameraPos = this.camera.position;
            const playerPos = this.player.mesh.position.clone();
            
            // Calculate proper view thresholds - expanded for better star persistence
            const behindThreshold = playerPos.z + 100;       // Increased from 30 - stars stay visible longer behind
            const aheadThreshold = playerPos.z - depth * 1.5;  // Reduced from 2x to prevent too much recycling
            const viewWidth = 800;                          // Reduced from 1000 - more contained field
            const viewHeight = 400;                         // Reduced from 500 - more contained field
            
            // Get player's movement for better star distribution
            // Use a stabilized version that changes more gradually
            if (!this._prevPlayerDirection) {
                this._prevPlayerDirection = { x: 0, y: 0 };
            }
            
            // Get current direction, defaulting to {0,0} if undefined
            const currentDirection = this.player.movementDirection || { x: 0, y: 0 };
            
            // Smooth movement direction for more stable starfield response
            const smoothFactor = 0.05; // Only take 5% of the new direction each frame
            const playerDirection = {
                x: this._prevPlayerDirection.x * (1 - smoothFactor) + currentDirection.x * smoothFactor,
                y: this._prevPlayerDirection.y * (1 - smoothFactor) + currentDirection.y * smoothFactor
            };
            
            // Save for next frame
            this._prevPlayerDirection = playerDirection;
            
            // Process stars in smaller batches to prevent long frames
            // This helps prevent the stars from appearing to jump erratically
            const batchSize = 1000;
            const startIdx = 0;
            const endIdx = Math.min(positions.length, startIdx + batchSize);
            
            for (let i = startIdx; i < endIdx; i += 3) {
                // Safety check for valid array indices
                if (i + 2 >= positions.length) break;
                
                try {
                    // Move stars towards player based on speed - more consistent movement
                    positions[i + 2] += speed;
                    
                    // Get current star position
                    const starX = positions[i];
                    const starY = positions[i + 1];
                    const starZ = positions[i + 2];
                    
                    // Check for NaN values and fix them
                    if (isNaN(starX) || isNaN(starY) || isNaN(starZ)) {
                        positions[i] = 0;
                        positions[i + 1] = 0;
                        positions[i + 2] = playerPos.z - Math.random() * depth * 0.5;
                        continue;
                    }
                    
                    // Check if the star needs to be recycled with more stable thresholds
                    const isBehindPlayer = starZ > behindThreshold;
                    const isTooFarSide = Math.abs(starX - playerPos.x) > viewWidth;
                    const isTooFarVertical = Math.abs(starY - playerPos.y) > viewHeight;
                    const isTooFarAhead = starZ < aheadThreshold;
                    
                    if (isBehindPlayer || isTooFarSide || isTooFarVertical || isTooFarAhead) {
                        // RECYCLING: Always reposition the star ahead of the player with more stable values
                        
                        // Calculate respawn distance with more consistent values
                        // Use fewer random variations for more stable appearance
                        let respawnDepth;
                        const depthVariation = Math.random();
                        
                        if (depthVariation < 0.4) {
                            // 40% of stars respawn at medium distance
                            respawnDepth = depth * 0.6;
                        } else if (depthVariation < 0.8) {
                            // 40% of stars respawn at far distance
                            respawnDepth = depth * 0.9;
                        } else {
                            // 20% of stars respawn at very far distance
                            respawnDepth = depth * 1.2;
                        }
                        
                        // Add a small random variation for natural appearance
                        respawnDepth += (Math.random() - 0.5) * depth * 0.1;
                        
                        // Always place Z position ahead of player based on respawn depth
                        positions[i + 2] = playerPos.z - respawnDepth;
                        
                        // Use smaller bias for more subtle effects
                        const directionBiasX = -playerDirection.x * 20; // Reduced from 50
                        const directionBiasY = -playerDirection.y * 20; // Reduced from 50
                        
                        // More consistent distribution zones for stable starfield
                        const spawnZone = Math.random();
                        
                        // Central stars - more concentrated for better appearance
                        if (spawnZone < 0.3) {
                            // 30% chance for central sight line
                            positions[i] = playerPos.x + directionBiasX * 0.2 + getRandomFloat(-viewWidth * 0.2, viewWidth * 0.2);
                            positions[i + 1] = playerPos.y + directionBiasY * 0.2 + getRandomFloat(-viewHeight * 0.2, viewHeight * 0.2);
                        } 
                        // Medium field - good spread but not too sparse
                        else if (spawnZone < 0.7) {
                            // 40% chance for medium field
                            positions[i] = playerPos.x + directionBiasX * 0.5 + getRandomFloat(-viewWidth * 0.6, viewWidth * 0.6);
                            positions[i + 1] = playerPos.y + directionBiasY * 0.5 + getRandomFloat(-viewHeight * 0.6, viewHeight * 0.6);
                        } 
                        // Outer field - fewer stars to reduce visual noise
                        else {
                            // 30% chance for far field
                            positions[i] = playerPos.x + directionBiasX * 0.8 + getRandomFloat(-viewWidth * 0.9, viewWidth * 0.9);
                            positions[i + 1] = playerPos.y + directionBiasY * 0.8 + getRandomFloat(-viewHeight * 0.9, viewHeight * 0.9);
                        }
                        
                        // CRITICAL: Final validation to prevent invalid values from sneaking in
                        positions[i] = isNaN(positions[i]) ? 0 : positions[i];
                        positions[i+1] = isNaN(positions[i+1]) ? 0 : positions[i+1];
                        positions[i+2] = isNaN(positions[i+2]) ? playerPos.z - depth : positions[i+2];
                        
                        // Ensure positions are within reasonable bounds to prevent stars "going crazy"
                        positions[i] = Math.max(-viewWidth * 2, Math.min(viewWidth * 2, positions[i]));
                        positions[i+1] = Math.max(-viewHeight * 2, Math.min(viewHeight * 2, positions[i+1]));
                        positions[i+2] = Math.max(playerPos.z - depth * 2, Math.min(playerPos.z + 200, positions[i+2]));
                    }
                } catch (error) {
                    console.warn("Error updating star position:", error);
                    // Fix this star position with stable values
                    positions[i] = 0;
                    positions[i+1] = 0;
                    positions[i+2] = -depth / 2;
                }
            }
        } catch (error) {
            console.error("Error in updateStarfieldLayer:", error);
        }
    }
    
    activateHyperspeed() {
        // Make starfield persistent but create streaking effect during boost
        
        // Apply streaking effect to all star layers
        this.applyStarStreakingEffect(this.starfield.geometry.attributes.position.array, 5.0);
        this.applyStarStreakingEffect(this.distantStarfield.geometry.attributes.position.array, 3.0);
        this.applyStarStreakingEffect(this.brightStarfield.geometry.attributes.position.array, 7.0);
        
        // Update geometry
        this.starfield.geometry.attributes.position.needsUpdate = true;
        this.distantStarfield.geometry.attributes.position.needsUpdate = true;
        this.brightStarfield.geometry.attributes.position.needsUpdate = true;
        
        // Check if hyperspeed model is loaded
        if (!this.hyperspeedStarfield && this.modelsManager.models.hyperspeed) {
            // Create hyperspeed starfield
            this.hyperspeedStarfield = this.modelsManager.getModelClone('hyperspeed');
            this.hyperspeedStarfield.visible = false;
            this.scene.add(this.hyperspeedStarfield);
        }
        
        // Show hyperspeed effect
        if (this.hyperspeedStarfield) {
            this.hyperspeedStarfield.visible = true;
            this.hyperspeedStarfield.position.copy(this.camera.position);
            this.hyperspeedStarfield.position.z -= 10;
        }
    }
    
    deactivateHyperspeed() {
        // Return stars to normal (non-streaked) state
        this.resetStarStreakingEffect(this.starfield.geometry.attributes.position.array);
        this.resetStarStreakingEffect(this.distantStarfield.geometry.attributes.position.array);
        this.resetStarStreakingEffect(this.brightStarfield.geometry.attributes.position.array);
        
        // Update geometry
        this.starfield.geometry.attributes.position.needsUpdate = true;
        this.distantStarfield.geometry.attributes.position.needsUpdate = true;
        this.brightStarfield.geometry.attributes.position.needsUpdate = true;
        
        // Hide hyperspeed effect
        if (this.hyperspeedStarfield) {
            this.hyperspeedStarfield.visible = false;
        }
    }
    
    // Apply streaking effect to stars during hyperspeed/boost
    applyStarStreakingEffect(positions, streakFactor) {
        try {
            if (!positions || positions.length === 0) return;
            
            // Constrain streak factor to reasonable values
            streakFactor = Math.min(Math.max(streakFactor, 0), 10);
            
            // Initialize storage for original positions if not already created
            if (!this._originalStarPositions) {
                this._originalStarPositions = {};
            }
            
            for (let i = 0; i < positions.length; i += 3) {
                // Safety check for valid array index
                if (i + 2 >= positions.length) break;
                
                // Generate a stable key for this star
                const key = `${Math.floor(i/3)}`;
                
                // Store original z position if not already stored
                if (!this._originalStarPositions[key]) {
                    // Make sure the value being stored is a valid number
                    const zPos = positions[i+2];
                    this._originalStarPositions[key] = isNaN(zPos) ? -1000 : zPos;
                }
                
                // Make sure stored position is valid
                if (isNaN(this._originalStarPositions[key])) {
                    this._originalStarPositions[key] = positions[i+2];
                }
                
                // Calculate distance from center with upper limit
                const x = positions[i];
                const y = positions[i+1];
                const distanceFromCenter = Math.min(
                    Math.sqrt(x * x + y * y),
                    300 // Cap maximum distance used in calculation
                );
                
                // More stable streak calculation
                const distanceFactor = Math.max(0, 1 - distanceFromCenter / 150);
                const streakAmount = distanceFactor * streakFactor;
                
                // Apply streak with bounds checking
                const streakDistance = Math.min(streakAmount * 15, 100); // Limit maximum streak
                const newZPos = this._originalStarPositions[key] + streakDistance;
                
                // Verify the new position is valid before assigning
                positions[i+2] = isNaN(newZPos) ? this._originalStarPositions[key] : newZPos;
            }
        } catch (error) {
            console.warn("Error applying star streaking effect:", error);
        }
    }
    
    // Reset stars to original positions after hyperspeed/boost
    resetStarStreakingEffect(positions) {
        try {
            if (!this._originalStarPositions || !positions || positions.length === 0) return;
            
            for (let i = 0; i < positions.length; i += 3) {
                // Safety check for valid array index
                if (i + 2 >= positions.length) break;
                
                const key = `${Math.floor(i/3)}`;
                if (this._originalStarPositions[key] !== undefined) {
                    // Verify the stored position is valid
                    const originalZ = this._originalStarPositions[key];
                    positions[i+2] = isNaN(originalZ) ? -1000 : originalZ;
                }
            }
            
            // Ensure position attribute is updated
            return true; // Return success flag
        } catch (error) {
            console.warn("Error resetting star streaking effect:", error);
            return false;
        }
    }
    
    gameOver() {
        // Set game state
        this.isRunning = false;
        
        // Update final score
        updateTextContent('final-distance', formatDistance(this.distance));
        updateTextContent('final-time', formatTime(this.gameTime));
        
        // Show game over screen
        showElement('game-over');
    }
    
    restartGame() {
        // Hide game over screen
        hideElement('game-over');
        
        // Clear scene
        while (this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }
        
        // Reset scene
        this.setupScene();
        
        // Show start screen
        showElement('start-screen');
    }
    
    zoomIn() {
        // Zoom in by decreasing distance to player
        this.cameraZoomLevel = Math.max(this.minZoom, this.cameraZoomLevel - 1);
    }
    
    zoomOut() {
        // Zoom out by increasing distance to player
        this.cameraZoomLevel = Math.min(this.maxZoom, this.cameraZoomLevel + 1);
    }
    
    // Apply screen shake effect
    applyScreenShake(intensity, duration) {
        this.screenShakeActive = true;
        this.screenShakeIntensity = intensity;
        this.screenShakeDuration = duration;
        this.screenShakeTimer = duration;
    }
    
    // Update screen shake effect
    updateScreenShake() {
        if (this.screenShakeActive) {
            // Calculate shake amount based on remaining time
            const shakeAmount = this.screenShakeIntensity * (this.screenShakeTimer / this.screenShakeDuration);
            
            // Apply random offset to camera position
            this.camera.position.x = this.cameraOriginalPosition.x + (Math.random() - 0.5) * shakeAmount;
            this.camera.position.y = this.cameraOriginalPosition.y + (Math.random() - 0.5) * shakeAmount;
            this.camera.position.z = this.cameraOriginalPosition.z + (Math.random() - 0.5) * shakeAmount * 0.5;
            
            // Update timer
            this.screenShakeTimer -= 1/60; // Assuming 60fps
            
            // Deactivate shake when timer expires
            if (this.screenShakeTimer <= 0) {
                this.screenShakeActive = false;
                this.camera.position.copy(this.cameraOriginalPosition);
            }
        }
    }
}
