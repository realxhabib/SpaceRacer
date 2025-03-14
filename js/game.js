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
        // Empty starfield containers - will be filled in setupModelStarfield later
        this.starfieldChunks = [];
        this.distantStarfieldChunks = [];
        this.brightStarfieldChunks = [];
        
        // Constants used for the infinite starfield
        this.CHUNK_SIZE = 2000; // Size of each starfield chunk
        this.GRID_SIZE = 4; // Increased from 3 for better coverage and smoother transitions (4x4x4 grid)
        this.STARMAP_DEPTH = 5000;
        
        // Parameters for smooth transitions
        this.TRANSITION_DISTANCE = 0.5; // Distance threshold to begin transition (as fraction of CHUNK_SIZE)
        this.chunkTransitions = {}; // Track chunks in transition
        this.lastPlayerGridPos = { x: 0, y: 0, z: 0 }; // Last player grid position for direction calculation
        
        console.log("Skipping particle-based starfield, will set up enhanced infinite starfield with smooth transitions");
    }
    
    updateStarfield(deltaTime) {
        try {
            // Update time value for shader animations
            this.starfieldTime = (this.starfieldTime || 0) + deltaTime;
            
            // Rotate all starfield chunks
            if (this.starfieldChunks && this.starfieldChunks.length > 0) {
                for (const chunk of this.starfieldChunks) {
                    // Rotate the chunk container slowly
                    chunk.rotation.y += deltaTime * 0.005;
                    chunk.rotation.z += deltaTime * 0.002;
                    
                    // If the chunk has child layers (enhanced starfield), rotate each layer differently
                    if (chunk.children && chunk.children.length > 0) {
                        // Apply different rotation speeds to each layer for a parallax effect
                        for (let i = 0; i < chunk.children.length; i++) {
                            const layer = chunk.children[i];
                            
                            // Different rotation speed for each layer: distant stars rotate slower, closer stars faster
                            const layerIndex = i % 3; // Handle both the star layers and potential nebula
                            const rotationMultiplier = layerIndex === 0 ? 0.3 : (layerIndex === 1 ? 0.6 : 1.0);
                            
                            // Apply subtle, varied rotation
                            layer.rotation.x += deltaTime * 0.002 * rotationMultiplier;
                            layer.rotation.y += deltaTime * 0.005 * rotationMultiplier;
                            layer.rotation.z += deltaTime * 0.003 * rotationMultiplier;
                            
                            // Update time uniform for shaders
                            if (layer.material && layer.material.uniforms && layer.material.uniforms.time !== undefined) {
                                layer.material.uniforms.time.value = this.starfieldTime;
                            }
                        }
                    }
                }
            }
            
            // Check if player exists and update infinite starfield based on player position
            if (this.player && this.player.mesh) {
                this.updateInfiniteStarfield();
            }
        } catch (error) {
            console.error("Error updating starfield:", error);
        }
    }
    
    // New method to handle the infinite starfield repositioning
    updateInfiniteStarfield() {
        if (!this.player || !this.player.mesh || this.starfieldChunks.length === 0) return;
        
        const playerPos = this.player.mesh.position;
        
        // Calculate which grid cell the player is in
        const centerX = Math.floor(playerPos.x / this.CHUNK_SIZE);
        const centerY = Math.floor(playerPos.y / this.CHUNK_SIZE);
        const centerZ = Math.floor(playerPos.z / this.CHUNK_SIZE);
        
        // Calculate current position within the cell (0.0 to 1.0 in each axis)
        const cellPositionX = (playerPos.x / this.CHUNK_SIZE) - centerX;
        const cellPositionY = (playerPos.y / this.CHUNK_SIZE) - centerY;
        const cellPositionZ = (playerPos.z / this.CHUNK_SIZE) - centerZ;
        
        // Determine player movement direction for predictive loading
        const playerDirection = {
            x: centerX - this.lastPlayerGridPos.x,
            y: centerY - this.lastPlayerGridPos.y,
            z: centerZ - this.lastPlayerGridPos.z
        };
        
        // Update last player grid position
        this.lastPlayerGridPos = { x: centerX, y: centerY, z: centerZ };
        
        // Predict next chunks to load based on player position within cell and velocity
        const predictNextCell = (pos, dir) => {
            if (dir !== 0) return dir; // If already moving in a direction, continue that way
            // If close to edge, predict movement in that direction
            if (pos > (1.0 - this.TRANSITION_DISTANCE)) return 1;
            if (pos < this.TRANSITION_DISTANCE) return -1;
            return 0;
        };
        
        // Calculate predicted next cell
        const predictedNextX = predictNextCell(cellPositionX, playerDirection.x);
        const predictedNextY = predictNextCell(cellPositionY, playerDirection.y);
        const predictedNextZ = predictNextCell(cellPositionZ, playerDirection.z);
        
        // Store active transitions to track fading chunks
        const activeTransitions = new Set();
        
        // Check each chunk to see if it needs repositioning
        for (const chunk of this.starfieldChunks) {
            const chunkGridPos = chunk.userData.gridPos;
            const chunkId = `${chunkGridPos.x},${chunkGridPos.y},${chunkGridPos.z}`;
            
            // Calculate desired grid position relative to player
            const desiredX = centerX + chunkGridPos.relX;
            const desiredY = centerY + chunkGridPos.relY;
            const desiredZ = centerZ + chunkGridPos.relZ;
            
            // Calculate if this chunk is in transition zone - approaching boundary
            const inTransitionX = Math.abs(cellPositionX - 0.5) > (0.5 - this.TRANSITION_DISTANCE);
            const inTransitionY = Math.abs(cellPositionY - 0.5) > (0.5 - this.TRANSITION_DISTANCE);
            const inTransitionZ = Math.abs(cellPositionZ - 0.5) > (0.5 - this.TRANSITION_DISTANCE);
            
            // If chunk is too far from where it should be, reposition it
            if (Math.abs(chunkGridPos.x - desiredX) > 1 || 
                Math.abs(chunkGridPos.y - desiredY) > 1 || 
                Math.abs(chunkGridPos.z - desiredZ) > 1) {
                
                // Prepare transition - start fading out
        //        if (!this.chunkTransitions[chunkId]) {
                    this.chunkTransitions[chunkId] = {
                   //     fadeState: 'out',
                        opacity: 1.0,
                        targetPosition: {
                            x: desiredX * this.CHUNK_SIZE,
                            y: desiredY * this.CHUNK_SIZE,
                            z: desiredZ * this.CHUNK_SIZE
                        }
                    };
        //        }
                
                // Only actually reposition when fully faded out
       //         if (this.chunkTransitions[chunkId].opacity <= 0.01) {
                // Update grid position
                chunkGridPos.x = desiredX;
                chunkGridPos.y = desiredY;
                chunkGridPos.z = desiredZ;
                
                // Update world position
                chunk.position.set(
                    desiredX * this.CHUNK_SIZE,
                    desiredY * this.CHUNK_SIZE,
                    desiredZ * this.CHUNK_SIZE
                );
                    
                    // Switch to fade in
                //    this.chunkTransitions[chunkId].fadeState = 'in';
                
        //        console.log(`Repositioned starfield chunk to grid (${desiredX}, ${desiredY}, ${desiredZ})`);
   //         }
                
                // Mark as active transition
        //        activeTransitions.add(chunkId);
            }
            
            // Handle chunk transitions (fading in/out)
          /*  if (this.chunkTransitions[chunkId]) {
                const transition = this.chunkTransitions[chunkId];
                
                // For chunks fading out
                if (transition.fadeState === 'out') {
                    transition.opacity = Math.max(0, transition.opacity - 0.05);
                    // Apply opacity to all child layers
                    applyOpacityToChunk(chunk, transition.opacity);
                } 
                // For chunks fading in
                else if (transition.fadeState === 'in') {
                    transition.opacity = Math.min(1.0, transition.opacity + 0.05);
                    applyOpacityToChunk(chunk, transition.opacity);
                    
                    // If fully faded in, remove from transitions
                    if (transition.opacity >= 1.0) {
                        delete this.chunkTransitions[chunkId];
                    } else {
                        // Otherwise mark as active
                        activeTransitions.add(chunkId);
                    }
                }
            }
            */
        }
        
        // Clean up completed transitions
        for (const key in this.chunkTransitions) {
            if (!activeTransitions.has(key)) {
                delete this.chunkTransitions[key];
            }
        }
        
        // Helper function to apply opacity to all layers in a chunk
        function applyOpacityToChunk(chunk, opacity) {
            if (chunk.children && chunk.children.length > 0) {
                for (const child of chunk.children) {
                    if (child.material && child.material.uniforms) {
                        // For shader materials with opacity
                        if (child.material.uniforms.opacity) {
                            child.material.uniforms.opacity.value = opacity;
                        } else {
                            // Add opacity uniform if doesn't exist
                            child.material.uniforms.opacity = { value: opacity };
                            
                            // Update fragment shader to use opacity uniform
                            const fragmentShader = child.material.fragmentShader;
                            if (fragmentShader && !fragmentShader.includes('uniform float opacity')) {
                                // Add uniform declaration
                                let newShader = 'uniform float opacity;\n' + fragmentShader;
                                
                                // Modify gl_FragColor to include opacity
                                newShader = newShader.replace(
                                    /gl_FragColor\s*=\s*vec4\s*\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\s*\)\s*;/,
                                    'gl_FragColor = vec4($1, $2, $3, $4 * opacity);'
                                );
                                
                                child.material.fragmentShader = newShader;
                                child.material.needsUpdate = true;
                            }
                        }
                    } else if (child.material) {
                        // For standard materials
                        child.material.opacity = opacity;
                    }
                }
            }
        }
    }
    
    activateHyperspeed() {
        // Modify the starfield for boost effect - increased rotation for all chunks
        if (this.starfieldChunks.length > 0) {
            // Animation for boost: increase rotation speed
            if (this.boostAnimation) clearInterval(this.boostAnimation);
            
            // Store original rotation speeds and sizes
            this.originalStarState = {
                rotationSpeed: 0.01,
                chunkRotationY: 0.005,
                chunkRotationZ: 0.002
            };
            
            // Accelerate star rotation to create hyperspeed effect
            this.boostAnimation = setInterval(() => {
                for (const chunk of this.starfieldChunks) {
                    // Increase main chunk rotation
                    chunk.rotation.y += 0.01;
                    chunk.rotation.z += 0.005;
                    
                    // If using enhanced starfield with layers
                    if (chunk.children && chunk.children.length > 0) {
                        for (let i = 0; i < chunk.children.length; i++) {
                            const layer = chunk.children[i];
                            
                            // Different speed modifiers based on layer
                            const layerIndex = i % 3;
                            const speedMultiplier = layerIndex === 0 ? 0.5 : (layerIndex === 1 ? 1.0 : 1.5);
                            
                            // Increase rotation for hyperspeed effect
                            layer.rotation.x += 0.002 * speedMultiplier;
                            layer.rotation.y += 0.01 * speedMultiplier;
                            layer.rotation.z += 0.005 * speedMultiplier;
                            
                            // If this is a point-based layer (stars or nebula), stretch them
                            if (layer.isPoints && layer.material && layer.material.uniforms) {
                                // Create stretching effect by increasing point size
                                // Only if material has uniforms (shader material)
                                if (!layer.userData.originalPointSize) {
                                    layer.userData.originalPointSize = layer.material.uniforms.pointSize.value;
                                }
                                
                                // Increase the point size for streaking effect
                                layer.material.uniforms.pointSize.value = 
                                    layer.userData.originalPointSize * (1.5 + speedMultiplier);
                            }
                        }
                    }
                }
            }, 20);
        }
    }
    
    deactivateHyperspeed() {
        // Clear boost animation if it exists
        if (this.boostAnimation) {
            clearInterval(this.boostAnimation);
            this.boostAnimation = null;
            
            // Reset any modified point sizes
            if (this.starfieldChunks && this.starfieldChunks.length > 0) {
                for (const chunk of this.starfieldChunks) {
                    if (chunk.children && chunk.children.length > 0) {
                        for (const layer of chunk.children) {
                            if (layer.isPoints && layer.material && layer.material.uniforms && 
                                layer.userData.originalPointSize) {
                                // Reset to original size
                                layer.material.uniforms.pointSize.value = layer.userData.originalPointSize;
                            }
                        }
                    }
                }
            }
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
        
        // Mouse down event - activate dev mode
        document.addEventListener('mousedown', (event) => {
            // Mouse events for gameplay (e.g., shooting) could be added here if needed
        });
        
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
            
            // Setup model-based starfield now that models are loaded
            this.setupModelStarfield();
            
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
            // Calculate distance based on player speed and apply a scaling factor
            // This ensures faster players cover more distance in the UI
            const baseSpeed = 20; // Reference speed
            const speedFactor = this.player.speed / baseSpeed;
            
            // Apply a non-linear scaling to make distance increase more with higher speeds
            // This creates a more rewarding feeling for players who maintain high speeds
            const distanceMultiplier = Math.pow(speedFactor, 1.2);
            
            // Calculate distance traveled this frame
            const distanceThisFrame = this.player.speed * deltaTime * distanceMultiplier;
            
            // Add to total distance
            this.distance += distanceThisFrame;
            
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
        
        // Standard camera behavior
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
        
        // Look at player ship
        this.camera.lookAt(shipPosition);
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
    
    // New method to set up the model-based starfield after loading
    setupModelStarfield() {
        // Only call this after models have been loaded
        console.log("Setting up infinite starfield");
        
        // Use our enhanced starfield implementation
        this.createFallbackInfiniteStarfield();
        
        // Note: Original model-based implementation is preserved but skipped
        // Uncomment the following code if you want to revert to model-based starfield
        /*
        if (this.modelsManager && this.modelsManager.models && this.modelsManager.models.hyperspeed) {
            console.log("Starfield model found, creating infinite starfield grid");
            
            // Get the raw model
            const rawModel = this.modelsManager.models.hyperspeed;
            
            // Log detailed info about the model's structure
            if (rawModel.scene) {
                console.log("Model scene structure:");
                this.logModelStructure(rawModel.scene, 0);
            } else {
                console.warn("Model has no scene property");
                this.createFallbackInfiniteStarfield();
                return;
            }
            
            // First create a prototype starfield chunk from the model
            const prototypeChunk = this.createStarfieldChunk(rawModel);
            
            if (!prototypeChunk) {
                console.warn("Could not create prototype chunk from model, using fallback");
                this.createFallbackInfiniteStarfield();
                return;
            }
            
            // Clear any existing chunks
            for (const chunk of this.starfieldChunks) {
                this.scene.remove(chunk);
            }
            this.starfieldChunks = [];
            
            // Create grid of starfield chunks
            const halfGrid = Math.floor(this.GRID_SIZE / 2);
            
            for (let x = -halfGrid; x <= halfGrid; x++) {
                for (let y = -halfGrid; y <= halfGrid; y++) {
                    for (let z = -halfGrid; z <= halfGrid; z++) {
                        // Clone the prototype chunk
                        const chunk = prototypeChunk.clone();
                        
                        // Position in 3D grid
                        chunk.position.set(
                            x * this.CHUNK_SIZE,
                            y * this.CHUNK_SIZE,
                            z * this.CHUNK_SIZE
                        );
                        
                        // Store grid position for infinite scrolling
                        chunk.userData.gridPos = {
                            x: x,
                            y: y,
                            z: z,
                            relX: x, // Relative position in the grid (always stays the same)
                            relY: y,
                            relZ: z
                        };
                        
                        // Slightly randomize rotation for variety
                        chunk.rotation.x = Math.random() * Math.PI;
                        chunk.rotation.y = Math.random() * Math.PI;
                        chunk.rotation.z = Math.random() * Math.PI;
                        
                        // Add to scene and track
                        this.scene.add(chunk);
                        this.starfieldChunks.push(chunk);
                        
                        console.log(`Added starfield chunk at (${x}, ${y}, ${z})`);
                    }
                }
            }
            
            console.log(`Created ${this.starfieldChunks.length} starfield chunks in a ${this.GRID_SIZE}x${this.GRID_SIZE}x${this.GRID_SIZE} grid`);
        }
        else {
            console.error("CRITICAL: Starfield model not found in models manager");
            console.log("Available models:", this.modelsManager ? 
                (this.modelsManager.models ? Object.keys(this.modelsManager.models) : "No models property") : 
                "No modelsManager");
            
            // Create fallback if model not found
            this.createFallbackInfiniteStarfield();
        }
        */
    }
    
    // Helper method to create a single starfield chunk from the model
    createStarfieldChunk(rawModel) {
        // Create a container for all extracted meshes
        const chunk = new THREE.Group();
        let extracted = false;
        
        if (rawModel.scene) {
            rawModel.scene.traverse(child => {
                if (child.isMesh) {
                    console.log("Found mesh in model:", child.name);
                    
                    // Clone the mesh
                    const mesh = child.clone();
                    
                    // Ensure the material is visible with varied colors
                    if (mesh.material) {
                        // Create a new material with subtle colors based on position in scene
                        let newMaterial;
                        
                        // Generate a varied, more natural starfield color
                        // Use a mix of white, yellow, and light blue stars
                        const starColors = [
                            new THREE.Color(0xffffff), // White
                            new THREE.Color(0xffffcc), // Warm white
                            new THREE.Color(0xaaddff), // Light blue
                            new THREE.Color(0xffcc88), // Warm orange
                            new THREE.Color(0xeeeeff)  // Pale blue
                        ];
                        
                        const randomColor = starColors[Math.floor(Math.random() * starColors.length)];
                        
                        if (mesh.material.map) {
                            // If it has a texture, use it with a varied color
                            newMaterial = new THREE.MeshBasicMaterial({ 
                                map: mesh.material.map,
                                color: randomColor,
                                opacity: 0.7 + Math.random() * 0.3, // Varied opacity
                                transparent: true,
                                side: THREE.DoubleSide,
                            });
                        } else {
                            // No texture, use varied colors
                            newMaterial = new THREE.MeshBasicMaterial({ 
                                color: randomColor,
                                opacity: 0.7 + Math.random() * 0.3, // Varied opacity
                                transparent: true,
                                side: THREE.DoubleSide,
                            });
                        }
                        
                        mesh.material = newMaterial;
                    }
                    
                    // Add to our container
                    chunk.add(mesh);
                    extracted = true;
                }
                
                // Also check for points (might be a particle system)
                if (child.isPoints) {
                    console.log("Found points in model:", child.name);
                    
                    // Clone the points object
                    const points = child.clone();
                    
                    // Enhance the material with varied colors
                    if (points.material) {
                        // Less bright material with subtle colors
                        points.material = new THREE.PointsMaterial({
                            color: new THREE.Color(0xf8f8ff), // Off-white color
                            size: child.material.size || 3.0, // Smaller points
                            transparent: true,
                            opacity: 0.7, // Less intense
                            sizeAttenuation: true
                        });
                    }
                    
                    // Add to our container
                    chunk.add(points);
                    extracted = true;
                }
            });
        }
        
        if (!extracted) {
            console.warn("Could not extract any meshes from the model");
            return null;
        }
        
        // Add subtle ambient light for the chunk
        const starAmbient = new THREE.AmbientLight(0xffffff, 0.5); // Reduced intensity
        chunk.add(starAmbient);
        
        // Scale appropriately 
        chunk.scale.set(500, 500, 500);
        
        // Ensure it's visible
        chunk.visible = true;
        
        // Set frustumCulled to false to prevent it from being culled when outside the frustum
        chunk.frustumCulled = false;
        
        return chunk;
    }
    
    // Helper method to create a fallback infinite starfield if the model fails
    createFallbackInfiniteStarfield() {
        console.log("Creating enhanced infinite star field");
        
        // Clear any existing chunks
        for (const chunk of this.starfieldChunks) {
            this.scene.remove(chunk);
        }
        this.starfieldChunks = [];
        
        // Create grid of starfield chunks 
        const halfGrid = Math.floor(this.GRID_SIZE / 2);
        
        // Star field parameters for visual variety
        const LAYERS = 3; // Three layers: distant, medium, close
        
        for (let x = -halfGrid; x <= halfGrid; x++) {
            for (let y = -halfGrid; y <= halfGrid; y++) {
                for (let z = -halfGrid; z <= halfGrid; z++) {
                    // Create a chunk to hold multiple star layers
                    const chunkContainer = new THREE.Group();
                    
                    // Position the chunk container in the 3D grid
                    chunkContainer.position.set(
                        x * this.CHUNK_SIZE,
                        y * this.CHUNK_SIZE,
                        z * this.CHUNK_SIZE
                    );
                    
                    // Store grid position for infinite scrolling
                    chunkContainer.userData.gridPos = {
                        x: x,
                        y: y,
                        z: z,
                        relX: x, // Relative position in the grid
                        relY: y,
                        relZ: z
                    };
                    
                    // Create multiple layers of stars in each chunk for depth effect
                    for (let layer = 0; layer < LAYERS; layer++) {
                        // Create a custom star field layer using geometry
                    const starGeometry = new THREE.BufferGeometry();
                    const starVertices = [];
                    const starColors = [];
                        const starSizes = [];
                        
                        // Adjust star count and size based on layer
                        let starCount, sizeBase, sizeVariation;
                        
                        if (layer === 0) { // Distant background layer - many tiny stars
                            starCount = 1000 + Math.floor(Math.random() * 300);
                            sizeBase = 0.8; // Reduced from 1.0 to make stars smaller
                            sizeVariation = 0.6; // Reduced from 0.5
                        } else if (layer === 1) { // Medium layer - moderate number, medium size
                            starCount = 300 + Math.floor(Math.random() * 150);
                            sizeBase = 1.3; // Reduced from 2.0
                            sizeVariation = 0.7; // Reduced from 1.0
                        } else { // Close layer - fewer, larger stars
                            starCount = 50 + Math.floor(Math.random() * 50);
                            sizeBase = 2; // Reduced from 3.5
                            sizeVariation = .8; // Reduced from 1.5
                        }
                    
                    for (let i = 0; i < starCount; i++) {
                            // Position within chunk bounds with some buffer to prevent gaps
                            const bufferZone = 200;
                        const halfSize = this.CHUNK_SIZE / 2 + bufferZone;
                        
                            // Use a more natural star distribution instead of pure random
                            // Stars tend to cluster in some areas and create voids in others
                            let px, py, pz;
                            
                            if (Math.random() < 0.7) { // 70% of stars follow natural clustering
                                // Create cluster-based distribution
                                // First determine a cluster center point
                                const clusterIndex = Math.floor(Math.random() * 8); // Up to 8 clusters per layer
                                const clusterCenterX = (Math.random() * this.CHUNK_SIZE - halfSize) * 0.5;
                                const clusterCenterY = (Math.random() * this.CHUNK_SIZE - halfSize) * 0.5;
                                const clusterCenterZ = (Math.random() * this.CHUNK_SIZE - halfSize) * 0.5;
                                
                                // Determine cluster size - closer layers have smaller, denser clusters
                                const clusterSize = 200 + Math.random() * 600 * (layer === 0 ? 1.5 : (layer === 1 ? 1.0 : 0.6));
                                
                                // Distribute around cluster center using gaussian-like distribution
                                // Use Box-Muller transform for normal distribution
                                const theta = Math.random() * Math.PI * 2;
                                const rho = Math.sqrt(-2 * Math.log(1 - Math.random())); // Avoiding log(0)
                                const scale = clusterSize * (0.2 + Math.random() * 0.8); // Varied cluster density
                                
                                px = clusterCenterX + scale * rho * Math.cos(theta);
                                py = clusterCenterY + scale * rho * Math.sin(theta);
                                pz = clusterCenterZ + scale * rho * Math.cos(theta + Math.PI/2);
                                
                                // Ensure within bounds
                                px = Math.max(-halfSize, Math.min(halfSize, px));
                                py = Math.max(-halfSize, Math.min(halfSize, py));
                                pz = Math.max(-halfSize, Math.min(halfSize, pz));
                            } else {
                                // Remaining 30% stars are randomly positioned to fill gaps
                                px = (Math.random() * this.CHUNK_SIZE) - halfSize;
                                py = (Math.random() * this.CHUNK_SIZE) - halfSize;
                                pz = (Math.random() * this.CHUNK_SIZE) - halfSize;
                            }
                        
                        starVertices.push(px, py, pz);
                            
                            // Individual star size variation
                            starSizes.push(sizeBase + Math.random() * sizeVariation);
                        
                        // Add varied star colors with more natural distribution
                            // Real stars have diverse colors based on temperature
                        let r, g, b;
                        
                        // Different star types with various colors
                        const starType = Math.random();
                        if (starType < 0.6) {
                            // White to blue-white stars (most common)
                            r = 0.8 + Math.random() * 0.2; // 0.8-1.0
                            g = 0.8 + Math.random() * 0.2; // 0.8-1.0
                            b = 0.9 + Math.random() * 0.1; // 0.9-1.0
                        } else if (starType < 0.8) {
                            // Yellow stars
                            r = 0.9 + Math.random() * 0.1; // 0.9-1.0
                            g = 0.8 + Math.random() * 0.2; // 0.8-1.0
                            b = 0.4 + Math.random() * 0.3; // 0.4-0.7
                        } else if (starType < 0.95) {
                            // Orange/red stars
                            r = 0.8 + Math.random() * 0.2; // 0.8-1.0
                            g = 0.4 + Math.random() * 0.4; // 0.4-0.8
                            b = 0.3 + Math.random() * 0.3; // 0.3-0.6
                        } else {
                            // Blue stars (rare)
                            r = 0.5 + Math.random() * 0.3; // 0.5-0.8
                            g = 0.6 + Math.random() * 0.3; // 0.6-0.9
                            b = 0.9 + Math.random() * 0.1; // 0.9-1.0
                        }
                            
                            // Occasional bright star/nebula
                           /* if (Math.random() < 0.01) {
                                // Intensify colors for bright stars
                                r = Math.min(1.0, r * 1.5);
                                g = Math.min(1.0, g * 1.5);
                                b = Math.min(1.0, b * 1.5);
                            }
                            */
                        
                        starColors.push(r, g, b);
                    }
                    
                    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
                    starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
                    
                        // Create a custom shader material for the stars
                        const starMaterial = new THREE.ShaderMaterial({
                            uniforms: {
                                pointSize: { value: 1.0 },
                                time: { value: 0.0 },
                                opacity: { value: 1.0 }
                            },
                            vertexShader: `
                                attribute vec3 color;
                                attribute float size;
                                varying vec3 vColor;
                                varying float vSize;
                                uniform float time;
                                
                                // Pseudo-random function
                                float rand(vec2 co) {
                                    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
                                }
                                
                                void main() {
                                    // Pass color and size to fragment shader
                                    vColor = color;
                                    vSize = size;
                                    
                                    // Generate a unique seed for each star based on position
                                    vec2 seed = position.xy + position.zz;
                                    
                                    // Calculate twinkling effect - subtle variation in size over time
                                    // Each star twinkles at a slightly different rate
                                    float twinkleSpeed = 0.5 + rand(seed) * 1.5;
                                    float twinkleAmount = rand(seed + vec2(123.0, 456.0)) * 0.3;
                                    float twinkle = 1.0 + twinkleAmount * sin(time * twinkleSpeed);
                                    
                                    // Apply position and calculate size with twinkling
                                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                                    gl_Position = projectionMatrix * mvPosition;
                                    gl_PointSize = size * 1.5 * twinkle; // Size with twinkling effect
                                }
                            `,
                            fragmentShader: `
                                varying vec3 vColor;
                                varying float vSize;
                                uniform float opacity;
                                uniform float time;
                                
                                void main() {
                                    // Create circular stars with soft edges and realistic glow
                                    vec2 coord = gl_PointCoord - vec2(0.5);
                                    float dist = length(coord);
                                    
                                    // Discard pixels outside the main circle
                                    if (dist > 0.5) discard;
                                    
                                    // Create a more realistic star shape with diffraction spikes
                                    float spike = 1.0;
                                    
                                    // Create subtle light spikes in 4 directions
                                    // More pronounced for brighter/larger stars
                                    if (vSize > 2.0) {
                                        float angle = atan(coord.y, coord.x);
                                        float spikeCount = 4.0;
                                        
                                        // Stronger spikes for brighter stars
                                        float spikeFactor = 0.15 + min((vSize - 2.0) * 0.05, 0.2);
                                        float spikeWidth = 0.3 + vSize * 0.05;
                                        
                                        // Subtle rotation over time for the spikes
                                        angle += time * 0.03;
                                        
                                        // Create the spike pattern
                                        spike += spikeFactor * pow(abs(cos(angle * spikeCount * 0.5)), 10.0 / spikeWidth);
                                    }
                                    
                                    // Main star with glow
                                    float core = smoothstep(0.5, 0.0, dist);
                                    float glow = pow(1.0 - dist * 2.0, 2.0) * spike;
                                    
                                    // Final color: combine core brightness with glow and apply color
                                    // Reduce brightness by multiplying color values
                                    vec3 finalColor = vColor * (core + glow) * 0.7; // Reduced brightness by 30%
                                    
                                    // Apply atmospheric scintillation (subtle color shift)
                                    if (vSize > 1.5) {
                                        // Subtle color shift more visible on larger stars
                                        float timeShift = sin(time + dist * 8.0) * 0.03;
                                        finalColor.r += timeShift;
                                        finalColor.b -= timeShift;
                                        
                                        // Ensure colors stay in valid range
                                        finalColor = clamp(finalColor, 0.0, 1.0);
                                    }
                                    
                                    // Intensity varies with size (larger stars are brighter)
                                    // Further reduce intensity for better game element focus
                                    float intensity = (core * 0.7 + glow * 0.3) * opacity * 0.7; // Reduced intensity by 30%
                                    
                                    gl_FragColor = vec4(finalColor, intensity);
                                }
                            `,
                        transparent: true,
                            depthWrite: false, // Prevents z-fighting between stars
                            blending: THREE.AdditiveBlending // Additive blending for light-like appearance
                        });
                        
                        // Create a buffer attribute for the sizes
                        starGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1));
                        
                        const starPoints = new THREE.Points(starGeometry, starMaterial);
                        
                        // Add slight rotation specific to each layer
                        starPoints.rotation.x = Math.random() * Math.PI;
                        starPoints.rotation.y = Math.random() * Math.PI;
                        starPoints.rotation.z = Math.random() * Math.PI;
                        
                        // Add layer to chunk container
                        chunkContainer.add(starPoints);
                    }
                    
                    // Add occasional nebula/gas cloud for visual interest
                  /*  if (Math.random() < 0.2) { // 20% chance of a nebula in each chunk
                        const nebulaGeometry = new THREE.BufferGeometry();
                        const nebulaPositions = [];
                        const nebulaColors = [];
                        const nebulaSizes = [];
                        
                        // Nebulas have many small, densely packed particles
                        const particleCount = 100 + Math.floor(Math.random() * 150);
                        
                        // Choose random nebula color - usually blueish, reddish, or purplish
                        const nebulaType = Math.floor(Math.random() * 3);
                        let baseColor;
                        
                        if (nebulaType === 0) { // Blue nebula
                            baseColor = { r: 0.3, g: 0.5, b: 0.9 };
                        } else if (nebulaType === 1) { // Red nebula
                            baseColor = { r: 0.9, g: 0.3, b: 0.3 };
                        } else { // Purple nebula
                            baseColor = { r: 0.7, g: 0.3, b: 0.9 };
                        }
                        
                        // Random position for nebula center within the chunk
                        const nebulaX = (Math.random() * this.CHUNK_SIZE/2) - this.CHUNK_SIZE/4;
                        const nebulaY = (Math.random() * this.CHUNK_SIZE/2) - this.CHUNK_SIZE/4;
                        const nebulaZ = (Math.random() * this.CHUNK_SIZE/2) - this.CHUNK_SIZE/4;
                        
                        // Size of the nebula cloud
                        const nebulaRadius = 200 + Math.random() * 300;
                        
                        for (let i = 0; i < particleCount; i++) {
                            // Distribute particles in a cloud-like formation
                            // Use gaussian-like distribution for more natural cloud shape
                            const theta = Math.random() * Math.PI * 2;
                            const phi = Math.random() * Math.PI;
                            const r = nebulaRadius * Math.pow(Math.random(), 0.3); // Power for concentration in center
                            
                            const px = nebulaX + r * Math.sin(phi) * Math.cos(theta);
                            const py = nebulaY + r * Math.sin(phi) * Math.sin(theta);
                            const pz = nebulaZ + r * Math.cos(phi);
                            
                            nebulaPositions.push(px, py, pz);
                            
                            // Vary the nebula color slightly for each particle
                            const colorVariation = 0.2;
                            const rValue = baseColor.r * (1 - colorVariation/2 + Math.random() * colorVariation);
                            const gValue = baseColor.g * (1 - colorVariation/2 + Math.random() * colorVariation);
                            const bValue = baseColor.b * (1 - colorVariation/2 + Math.random() * colorVariation);
                            
                            nebulaColors.push(rValue, gValue, bValue);
                            
                            // Vary the particle size
                            nebulaSizes.push(3 + Math.random() * 4);
                        }
                        
                        nebulaGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nebulaPositions, 3));
                        nebulaGeometry.setAttribute('color', new THREE.Float32BufferAttribute(nebulaColors, 3));
                        nebulaGeometry.setAttribute('size', new THREE.Float32BufferAttribute(nebulaSizes, 1));
                        
                        const nebulaMaterial = new THREE.ShaderMaterial({
                            uniforms: {
                                pointSize: { value: 1.0 },
                                time: { value: 0.0 },
                                opacity: { value: 1.0 }
                            },
                            vertexShader: `
                                attribute vec3 color;
                                attribute float size;
                                varying vec3 vColor;
                                varying float vSize;
                                varying vec3 vPosition;
                                uniform float time;
                                
                                // Simple noise function
                                float hash(vec3 p) {
                                    p = fract(p * vec3(443.897, 441.423, 437.195));
                                    p += dot(p, p.yzx + 19.19);
                                    return fract((p.x + p.y) * p.z);
                                }
                                
                                void main() {
                                    // Pass data to fragment shader
                                    vColor = color;
                                    vSize = size;
                                    vPosition = position;
                                    
                                    // Calculate motion - slow swirl effect
                                    vec3 offset = position;
                                    float noise = hash(position * 0.01);
                                    
                                    // Create a subtle swirling motion
                                    float displacement = time * 0.05 * (0.8 + 0.4 * noise);
                                    
                                    // Apply different movement based on position for varied effect
                                    float xMod = sin(time * 0.1 + position.z * 0.01);
                                    float yMod = cos(time * 0.12 + position.x * 0.01);
                                    float zMod = sin(time * 0.09 + position.y * 0.01);
                                    
                                    // Very subtle movement - don't want to move too far from original position
                                    offset.x += sin(displacement) * noise * 2.0 * xMod;
                                    offset.y += cos(displacement) * noise * 2.0 * yMod;
                                    offset.z += sin(displacement * 1.2) * noise * 2.0 * zMod;
                                    
                                    // Compute position with very subtle motion
                                    vec4 mvPosition = modelViewMatrix * vec4(offset, 1.0);
                                    gl_Position = projectionMatrix * mvPosition;
                                    
                                    // Size varies slightly with time
                                    gl_PointSize = size * (0.9 + 0.2 * sin(time * 0.2 + noise * 5.0));
                                }
                            `,
                            fragmentShader: `
                                varying vec3 vColor;
                                varying float vSize;
                                varying vec3 vPosition;
                                uniform float time;
                                uniform float opacity;
                                
                                // Random vector generation
                                vec3 rand3(vec3 p) {
                                    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
                                             dot(p, vec3(269.5, 183.3, 246.1)),
                                             dot(p, vec3(113.5, 271.9, 124.6)));
                                    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
                                }
                                
                                // Simple fbm noise approximation
                                float noise(vec3 p) {
                                    vec3 i = floor(p);
                                    vec3 f = fract(p);
                                    f = f*f*(3.0-2.0*f);
                                    
                                    vec2 off = vec2(0.0, 1.0);
                                    float n = mix(
                                        mix(
                                            mix(dot(rand3(i + off.xxx), f - off.xxx),
                                                dot(rand3(i + off.yxx), f - off.yxx), 
                                                f.x),
                                            mix(dot(rand3(i + off.xyx), f - off.xyx),
                                                dot(rand3(i + off.yyx), f - off.yyx), 
                                                f.x), 
                                            f.y),
                                        mix(
                                            mix(dot(rand3(i + off.xxy), f - off.xxy),
                                                dot(rand3(i + off.yxy), f - off.yxy), 
                                                f.x),
                                            mix(dot(rand3(i + off.xyy), f - off.xyy),
                                                dot(rand3(i + off.yyy), f - off.yyy), 
                                                f.x), 
                                            f.y), 
                                        f.z);
                                    return 0.5 + 0.5 * n;
                                }
                                
                                void main() {
                                    // Soft nebula particle with internal structure
                                    vec2 coord = gl_PointCoord - vec2(0.5);
                                    float dist = length(coord);
                                    
                                    // More interesting edge falloff
                                    if (dist > 0.5) discard;
                                    
                                    // Create internal nebula structure using noise
                                    vec3 noiseCoord = vPosition * 0.01 + vec3(time * 0.01, 0.0, 0.0);
                                    float cloudNoise = noise(noiseCoord + dist * 5.0);
                                    
                                    // More dynamic alpha based on noise pattern
                                    float alpha = opacity * 0.5 * smoothstep(0.5, 0.2, dist) * (0.8 + 0.4 * cloudNoise);
                                    
                                    // Color variation based on noise
                                    vec3 finalColor = vColor;
                                    finalColor *= 0.8 + 0.4 * cloudNoise;
                                    
                                    // Add subtle color variations for more visually interesting nebulas
                                    float colorShift = sin(time * 0.1 + vPosition.z * 0.01) * 0.1;
                                    finalColor.r += colorShift * (finalColor.b < 0.5 ? 0.2 : -0.1); // Red shift for blue nebulas
                                    finalColor.b += colorShift * (finalColor.r < 0.5 ? 0.2 : -0.1); // Blue shift for red nebulas
                                    
                                    // Ensure colors stay in valid range
                                    finalColor = clamp(finalColor, 0.0, 1.0);
                                    
                                    gl_FragColor = vec4(finalColor, alpha);
                                }
                            `,
                            transparent: true,
                            depthWrite: false,
                            blending: THREE.AdditiveBlending
                        });
                        
                        const nebula = new THREE.Points(nebulaGeometry, nebulaMaterial);
                        chunkContainer.add(nebula);
                    }
                    */
                    
                    // Ensure the chunk is visible and not frustum-culled
                    chunkContainer.visible = true;
                    chunkContainer.frustumCulled = false;
                    
                    // Add to scene and track
                    this.scene.add(chunkContainer);
                    this.starfieldChunks.push(chunkContainer);
                }
            }
        }
        
        console.log(`Created enhanced starfield with ${this.starfieldChunks.length} chunks in a ${this.GRID_SIZE}x${this.GRID_SIZE}x${this.GRID_SIZE} grid`);
    }
    
    // Add debug check for starfield visibility
    setupStarfieldDebugCheck() {
        // Logs initial state and sets up periodic checks
        // Will automatically fix issues like the starfield becoming invisible
    }
    
    // Helper method to log model structure for debugging
    logModelStructure(object, indent) {
        const spaces = ' '.repeat(indent * 2);
        const type = object.type || 'Unknown';
        const name = object.name || 'Unnamed';
        const hasGeometry = object.geometry ? 'Has Geometry' : 'No Geometry';
        const hasMaterial = object.material ? 'Has Material' : 'No Material';
        
        console.log(`${spaces}${type}: "${name}" ${hasGeometry} ${hasMaterial}`);
        
        // Log material details if present
        if (object.material) {
            console.log(`${spaces}  Material: ${object.material.type}, Color: ${object.material.color ? object.material.color.getHexString() : 'None'}`);
        }
        
        // Log geometry details if present
        if (object.geometry) {
            console.log(`${spaces}  Geometry: Vertices: ${object.geometry.attributes && object.geometry.attributes.position ? object.geometry.attributes.position.count : 'Unknown'}`);
        }
        
        // Recursively log children
        if (object.children && object.children.length > 0) {
            console.log(`${spaces}Children (${object.children.length}):`);
            object.children.forEach(child => this.logModelStructure(child, indent + 1));
        }
    }
    
    // Replace toggleDevMode with separate enable/disable methods
    enableDevMode() {}
    
    disableDevMode() {}
    
    // Show an on-screen indicator for dev mode
    showDevModeIndicator() {
        // Remove existing indicator if present
        const existingIndicator = document.getElementById('dev-mode-indicator');
        if (existingIndicator) {
            document.body.removeChild(existingIndicator);
        }
    }
}
