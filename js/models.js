/**
 * Models loader and manager for Space Racer game
 */

class ModelsManager {
    constructor(game) {
        this.game = game;
        this.loader = new THREE.GLTFLoader();
        this.models = {};
        this.totalModels = 9; // Total number of models to load
        this.loadedModels = 0;
    }

    // Load all game models
    loadModels(onComplete) {
        this.loadModel('asteroid', 'assets/asteroid1.glb');
        this.loadModel('cruiser', 'assets/cruiser.glb');
        this.loadModel('fighter', 'assets/fighter.glb');
        this.loadModel('mystery', 'assets/mystery.glb');
        this.loadModel('nokia', 'assets/nokia.glb');
        this.loadModel('health', 'assets/health.glb');
        this.loadModel('ammo', 'assets/ammo.glb');
        this.loadModel('laser', 'assets/laser.glb');
        this.loadModel('hyperspeed', 'assets/hyperspeed_starfield.glb');
        
        this.onComplete = onComplete;
    }

    // Load individual model
    loadModel(name, path) {
        this.loader.load(
            path,
            (gltf) => {
                this.models[name] = gltf;
                this.loadedModels++;
                
                // Update loading progress
                const progress = (this.loadedModels / this.totalModels) * 100;
                updateProgressBar('loading-progress', progress);
                updateTextContent('loading-text', `Loading: ${this.loadedModels}/${this.totalModels} models`);
                
                // Check if all models are loaded
                if (this.loadedModels === this.totalModels && this.onComplete) {
                    this.onComplete();
                }
            },
            (xhr) => {
                // Loading progress for individual model
                const progress = (xhr.loaded / xhr.total) * 100;
                console.log(`${name} model: ${Math.round(progress)}% loaded`);
            },
            (error) => {
                console.error(`Error loading ${name} model:`, error);
            }
        );
    }

    // Get a clone of a model
    getModelClone(name) {
        if (!this.models[name]) {
            console.error(`Model ${name} not found`);
            return null;
        }
        
        return this.models[name].scene.clone();
    }

    // Setup ship preview for selection screen
    setupShipPreviews() {
        // Setup preview renderers
        this.setupShipPreview('cruiser', 'cruiser-preview');
        this.setupShipPreview('fighter', 'fighter-preview');
    }

    // Setup individual ship preview
    setupShipPreview(modelName, containerId) {
        const container = document.getElementById(containerId);
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Create renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);
        
        // Create scene
        const scene = new THREE.Scene();
        
        // Create camera
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        camera.position.set(0, 1, 5);
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);
        
        // Add ship model
        const model = this.getModelClone(modelName);
        if (model) {
            model.scale.set(1, 1, 1);
            scene.add(model);
            
            // Rotate model for better view
            model.rotation.y = Math.PI / 4;
            
            // Animation function
            const animate = () => {
                requestAnimationFrame(animate);
                model.rotation.y += 0.01;
                renderer.render(scene, camera);
            };
            
            animate();
        }
    }
}
