/**
 * Main PodiumJS class
 * Orchestrates WebGPU rendering, scene management, and render loop
 */

import { WebGPUContext, WebGPUContextOptions } from './WebGPUContext.js';
import { ShaderManager } from '../shaders/ShaderManager.js';
import { TextureManager, TextureOptions } from '../textures/TextureManager.js';
import { UniformManager, UniformData } from './UniformManager.js';
import { PostProcessor, EffectOptions } from './PostProcessor.js';
import { Plane, PlaneOptions } from '../geometry/Plane.js';

export interface PodiumOptions extends Partial<WebGPUContextOptions> {
  canvas: HTMLCanvasElement;
  autoResize?: boolean;
  backgroundColor?: [number, number, number, number];
  antialias?: boolean;
  enablePostProcessing?: boolean;
}

export interface RenderObject {
  id: string;
  plane: Plane;
  pipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  uniformBuffer?: GPUBuffer;
  visible: boolean;
  transform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
}

export class Podium {
  public context: WebGPUContext;
  public shaderManager: ShaderManager;
  public textureManager: TextureManager;
  public uniformManager: UniformManager;
  public postProcessor: PostProcessor | null = null;

  private options: Required<PodiumOptions>;
  private renderObjects = new Map<string, RenderObject>();
  private isInitialized = false;
  private animationFrame: number | null = null;
  private startTime = 0;
  // private lastTime = 0; // Unused for now
  private frameCount = 0;

  // Default background color
  private clearColor: GPUColorDict = { r: 0, g: 0, b: 0, a: 1 };

  constructor(options: PodiumOptions) {
    this.options = {
      powerPreference: 'high-performance',
      forceFallbackAdapter: false,
      alphaMode: 'opaque',
      colorSpace: 'srgb',
      autoResize: true,
      backgroundColor: [0, 0, 0, 1],
      antialias: false,
      enablePostProcessing: false,
      ...options,
    };

    // Set background color
    this.clearColor = {
      r: this.options.backgroundColor[0],
      g: this.options.backgroundColor[1],
      b: this.options.backgroundColor[2],
      a: this.options.backgroundColor[3],
    };

    // Initialize core systems
    this.context = new WebGPUContext({
      canvas: this.options.canvas,
      powerPreference: this.options.powerPreference,
      forceFallbackAdapter: this.options.forceFallbackAdapter,
      alphaMode: this.options.alphaMode,
      colorSpace: this.options.colorSpace,
    });

    this.shaderManager = new ShaderManager(this.context);
    this.textureManager = new TextureManager(this.context);
    this.uniformManager = new UniformManager(this.context);

    // Initialize post-processor if enabled
    if (this.options.enablePostProcessing) {
      this.postProcessor = new PostProcessor(
        this.context,
        this.shaderManager,
        this.textureManager,
        this.uniformManager
      );
    }

    // Setup auto-resize if enabled
    if (this.options.autoResize) {
      this.setupAutoResize();
    }
  }

  /**
   * Initialize PodiumJS
   */
  async initialize(): Promise<boolean> {
    console.log('🚀 Starting PodiumJS initialization...');
    
    const success = await this.context.initialize();
    if (!success) {
      console.error('❌ Failed to initialize WebGPU context');
      return false;
    }
    console.log('✅ WebGPU context initialized successfully');

    // Initialize post-processor if enabled
    if (this.postProcessor) {
      console.log('🎬 Initializing post-processor...');
      const postProcessSuccess = await this.postProcessor.initialize(
        this.context.canvas.width,
        this.context.canvas.height
      );
      if (!postProcessSuccess) {
        console.warn('⚠️ Failed to initialize post-processor, continuing without it');
        this.postProcessor = null;
      } else {
        console.log('✅ Post-processor initialized successfully');
      }
    } else {
      console.log('📝 Post-processing disabled for this instance');
    }

    this.isInitialized = true;
    this.startTime = performance.now();
    console.log('🎉 PodiumJS initialized successfully');
    return true;
  }

  /**
   * Create a plane with texture
   */
  async createPlane(
    id: string,
    imageUrl: string,
    planeOptions?: PlaneOptions,
    textureOptions?: TextureOptions
  ): Promise<RenderObject | null> {
    if (!this.isInitialized) {
      console.error('PodiumJS not initialized. Call initialize() first.');
      return null;
    }

    try {
      console.log(`Creating basic plane "${id}" with image: ${imageUrl}`);
      
      // Load texture
      const texture = await this.textureManager.loadImageTexture(imageUrl, textureOptions);
      if (!texture) {
        console.error(`Failed to load texture: ${imageUrl}`);
        return null;
      }
      console.log(`Texture loaded successfully for plane "${id}"`);

      // Create plane geometry
      const plane = new Plane(this.context, planeOptions);
      console.log(`Plane geometry created for "${id}"`);

      // Create sampler
      const sampler = this.textureManager.createSampler(`${id}_sampler`);
      if (!sampler) {
        console.error('Failed to create sampler');
        return null;
      }
      console.log(`Sampler created for plane "${id}"`);

      // Ensure default bind group layout exists
      let defaultLayout = this.shaderManager.getBindGroupLayout('default');
      if (!defaultLayout) {
        console.log('Default bind group layout not found, will be created by pipeline');
      }

      // Create shader and pipeline
      const shader = ShaderManager.getBasicTextureShader();
      console.log(`Creating pipeline for plane "${id}" with shader`);
      
      const pipeline = await this.shaderManager.createPipeline(`${id}_pipeline`, shader, {
        vertexBufferLayouts: [plane.getVertexBufferLayout()],
        bindGroupLayouts: defaultLayout ? [defaultLayout] : undefined,
        depthTest: !!this.postProcessor, // Enable depth testing when using post-processor
      });

      if (!pipeline) {
        console.error('Failed to create render pipeline');
        return null;
      }

      // Get the layout that was actually used/created by the pipeline
      const actualLayout = this.shaderManager.getBindGroupLayout('default');
      if (!actualLayout) {
        console.error('No bind group layout available after pipeline creation');
        return null;
      }

      // Create bind group
      console.log(`Creating bind group for plane "${id}"`);
      const bindGroup = this.textureManager.createTextureBindGroup(
        actualLayout,
        texture,
        sampler,
        `${id}_bindgroup`
      );

      if (!bindGroup) {
        console.error('Failed to create bind group');
        return null;
      }
      console.log(`Bind group created successfully for plane "${id}"`);

      // Create render object
      const renderObject: RenderObject = {
        id,
        plane,
        pipeline,
        bindGroup,
        visible: true,
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      };

      this.renderObjects.set(id, renderObject);
      return renderObject;
    } catch (error) {
      console.error(`Error creating plane "${id}":`, error);
      return null;
    }
  }

  /**
   * Create a plane with uniform support
   */
  async createUniformPlane(
    id: string,
    imageUrl: string,
    planeOptions?: PlaneOptions,
    textureOptions?: TextureOptions
  ): Promise<RenderObject | null> {
    if (!this.isInitialized) {
      console.error('PodiumJS not initialized. Call initialize() first.');
      return null;
    }

    try {
      // Load texture
      const texture = await this.textureManager.loadImageTexture(imageUrl, textureOptions);
      if (!texture) return null;

      // Create plane geometry
      const plane = new Plane(this.context, planeOptions);

      // Create sampler
      const sampler = this.textureManager.createSampler(`${id}_sampler`);
      if (!sampler) return null;

      // Create uniform buffer with proper alignment (96 bytes for our struct)
      const uniformBuffer = this.uniformManager.createUniformBuffer(`${id}_uniforms`, 96);
      if (!uniformBuffer) return null;

      // Initialize uniform data
      const uniformData: UniformData = {
        mvpMatrix: UniformManager.createIdentityMatrix(),
        time: 0,
      };
      this.uniformManager.updateUniformBuffer(`${id}_uniforms`, uniformData);

      // Create uniform layout and pipeline
      const uniformLayout = this.uniformManager.createStandardUniformLayout();
      if (!uniformLayout) return null;

      const shader = ShaderManager.getUniformShader();
      const pipeline = await this.shaderManager.createPipeline(`${id}_pipeline`, shader, {
        vertexBufferLayouts: [plane.getVertexBufferLayout()],
        bindGroupLayouts: [uniformLayout],
        depthTest: !!this.postProcessor, // Enable depth testing when using post-processor
      });

      if (!pipeline) return null;

      // Create bind group with uniforms
      const bindGroup = this.uniformManager.createUniformBindGroup(
        `${id}_bindgroup`,
        uniformLayout,
        uniformBuffer,
        texture,
        sampler
      );

      if (!bindGroup) return null;

      // Create render object
      const renderObject: RenderObject = {
        id,
        plane,
        pipeline,
        bindGroup,
        uniformBuffer,
        visible: true,
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      };

      this.renderObjects.set(id, renderObject);
      return renderObject;
    } catch (error) {
      console.error(`Error creating uniform plane "${id}":`, error);
      return null;
    }
  }

  /**
   * Update uniform data for a render object
   */
  updateUniforms(id: string, data: Partial<UniformData>): boolean {
    const renderObject = this.renderObjects.get(id);
    if (!renderObject || !renderObject.uniformBuffer) {
      console.error(`Render object "${id}" not found or has no uniforms`);
      return false;
    }

    console.log(`🔄 Updating uniforms for ${id}:`, Object.keys(data));
    const success = this.uniformManager.updateUniformBuffer(`${id}_uniforms`, data as UniformData);
    if (!success) {
      console.error(`❌ Failed to update uniform buffer for ${id}`);
    }
    return success;
  }

  /**
   * Set transform for a render object
   */
  setTransform(
    id: string,
    transform: Partial<RenderObject['transform']>
  ): boolean {
    const renderObject = this.renderObjects.get(id);
    if (!renderObject) {
      console.error(`Render object "${id}" not found`);
      return false;
    }

    // Update transform
    Object.assign(renderObject.transform, transform);
    console.log(`🎯 Transform updated for ${id}:`, renderObject.transform);

    // Update MVP matrix if object has uniforms
    if (renderObject.uniformBuffer) {
      const mvpMatrix = this.calculateMVPMatrix(renderObject.transform);
      console.log(`📐 Calculated MVP matrix for ${id}:`, mvpMatrix.slice(0, 4)); // Show first row
      const success = this.updateUniforms(id, { mvpMatrix });
      console.log(`💫 Uniform update for ${id}: ${success ? 'SUCCESS' : 'FAILED'}`);
    } else {
      console.warn(`⚠️ ${id} has no uniform buffer - transform won't be applied`);
    }

    return true;
  }

  /**
   * Calculate MVP matrix from transform
   */
  private calculateMVPMatrix(transform: RenderObject['transform']): Float32Array {
    // Create transformation matrices
    const scaleMatrix = UniformManager.createScaleMatrix(
      transform.scale[0],
      transform.scale[1],
      transform.scale[2]
    );

    const translationMatrix = UniformManager.createTranslationMatrix(
      transform.position[0],
      transform.position[1],
      transform.position[2]
    );

    // Create orthographic projection for 2D rendering (-2 to 2 range)
    const projectionMatrix = UniformManager.createOrthographicMatrix(
      -2, 2,  // left, right
      -2, 2,  // bottom, top
      -1, 1   // near, far
    );

    // Correct order: Projection * Translation * Scale
    const modelMatrix = UniformManager.multiplyMatrices(translationMatrix, scaleMatrix);
    return UniformManager.multiplyMatrices(projectionMatrix, modelMatrix);
  }

  /**
   * Start the render loop
   */
  startRenderLoop(): void {
    if (!this.isInitialized) {
      console.error('PodiumJS not initialized. Call initialize() first.');
      return;
    }

    if (this.animationFrame) {
      this.stopRenderLoop();
    }

    const renderFrame = async (currentTime: number) => {
      await this.render(currentTime);
      this.animationFrame = requestAnimationFrame(renderFrame);
    };

    this.animationFrame = requestAnimationFrame(renderFrame);
  }

  /**
   * Stop the render loop
   */
  stopRenderLoop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Render a single frame
   */
  async render(currentTime: number = performance.now()): Promise<void> {
    if (!this.isInitialized || !this.context.device) return;

    // const deltaTime = currentTime - this.lastTime; // Unused for now
    const elapsedTime = (currentTime - this.startTime) / 1000; // Convert to seconds

    // Update time-based uniforms
    this.renderObjects.forEach((obj) => {
      if (obj.uniformBuffer && obj.visible) {
        this.updateUniforms(obj.id, { time: elapsedTime });
      }
    });

    // Create command encoder
    const commandEncoder = this.context.device.createCommandEncoder({
      label: 'render_commands',
    });

    // Get current texture view
    const textureView = this.context.getCurrentTextureView();
    if (!textureView) {
      // Skip this frame if we can't get a texture view
      // This can happen during canvas resizing
      return;
    }

    // Choose render target based on post-processing
    const renderPass = this.postProcessor ? 
      this.postProcessor.beginRenderToTexture(commandEncoder) :
      commandEncoder.beginRenderPass({
        label: 'main_render_pass',
        colorAttachments: [
          {
            view: textureView,
            clearValue: this.clearColor,
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

    // Render all visible objects
    let renderedCount = 0;
    this.renderObjects.forEach((obj) => {
      if (obj.visible) {
        try {
          renderPass.setPipeline(obj.pipeline);
          renderPass.setBindGroup(0, obj.bindGroup);
          obj.plane.bind(renderPass);
          obj.plane.draw(renderPass);
          renderedCount++;
        } catch (error) {
          console.error(`❌ Error rendering object "${obj.id}":`, error);
        }
      }
    });
    
    // Log render stats occasionally
    if (this.frameCount % 120 === 0) { // Every 2 seconds at 60fps
      console.log(`🎨 Render frame ${this.frameCount}: ${renderedCount}/${this.renderObjects.size} objects rendered`);
    }
    
    if (renderedCount === 0 && this.renderObjects.size > 0) {
      console.warn('⚠️ No objects were rendered, but objects exist. Check visibility and pipeline validity.');
    }

    renderPass.end();

    // Apply post-processing if enabled
    if (this.postProcessor) {
      await this.postProcessor.applyPostProcessing(commandEncoder, textureView, elapsedTime);
    }

    // Submit commands
    this.context.device.queue.submit([commandEncoder.finish()]);

    // this.lastTime = currentTime; // Unused for now
    this.frameCount++;
  }

  /**
   * Set up automatic canvas resizing
   */
  private setupAutoResize(): void {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.context.resize(width, height);
        this.postProcessor?.resize(width, height);
      }
    });

    resizeObserver.observe(this.options.canvas);

    // Also handle window resize as fallback
    window.addEventListener('resize', () => {
      const canvas = this.options.canvas;
      this.context.resize(canvas.clientWidth, canvas.clientHeight);
      this.postProcessor?.resize(canvas.clientWidth, canvas.clientHeight);
    });
  }

  /**
   * Get render object by ID
   */
  getRenderObject(id: string): RenderObject | null {
    return this.renderObjects.get(id) || null;
  }

  /**
   * Remove render object
   */
  removeRenderObject(id: string): boolean {
    const obj = this.renderObjects.get(id);
    if (!obj) return false;

    // Cleanup resources
    obj.plane.destroy();
    if (obj.uniformBuffer) {
      obj.uniformBuffer.destroy();
    }

    this.renderObjects.delete(id);
    return true;
  }

  /**
   * Enable/disable a post-processing effect
   */
  setEffectEnabled(effectId: string, enabled: boolean): boolean {
    if (!this.postProcessor) {
      console.warn('Post-processing not enabled');
      return false;
    }
    return this.postProcessor.setEffectEnabled(effectId, enabled);
  }

  /**
   * Update post-processing effect options
   */
  updateEffect(effectId: string, options: Partial<EffectOptions>): boolean {
    if (!this.postProcessor) {
      console.warn('Post-processing not enabled');
      return false;
    }
    return this.postProcessor.updateEffect(effectId, options);
  }

  /**
   * Get available post-processing effects
   */
  getAvailableEffects(): string[] {
    if (!this.postProcessor) return [];
    return ['blur', 'bloom', 'colorCorrection', 'vignette', 'filmGrain'];
  }

  /**
   * Get performance stats
   */
  getStats(): { frameCount: number; elapsedTime: number; fps: number } {
    const elapsedTime = (performance.now() - this.startTime) / 1000;
    const fps = elapsedTime > 0 ? this.frameCount / elapsedTime : 0;

    return {
      frameCount: this.frameCount,
      elapsedTime,
      fps,
    };
  }

  /**
   * Check WebGPU support
   */
  static isSupported(): boolean {
    return WebGPUContext.isSupported();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopRenderLoop();
    
    // Destroy all render objects
    this.renderObjects.forEach((obj) => {
      obj.plane.destroy();
      if (obj.uniformBuffer) {
        obj.uniformBuffer.destroy();
      }
    });
    this.renderObjects.clear();

    // Destroy managers
    this.postProcessor?.destroy();
    this.shaderManager.destroy();
    this.textureManager.destroy();
    this.uniformManager.destroy();
    this.context.destroy();

    this.isInitialized = false;
  }
}