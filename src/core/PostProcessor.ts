/**
 * Post-processing system for PodiumJS
 * Handles render-to-texture, multi-pass rendering, and built-in effects
 */

import { WebGPUContext } from './WebGPUContext.js';
import { ShaderManager, ShaderSource } from '../shaders/ShaderManager.js';
import { TextureManager } from '../textures/TextureManager.js';
import { UniformManager, UniformData } from './UniformManager.js';
import { Plane } from '../geometry/Plane.js';

export interface EffectOptions {
  intensity?: number;
  [key: string]: any;
}

export interface PostProcessPass {
  id: string;
  shader: ShaderSource;
  pipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  uniformBuffer?: GPUBuffer;
  enabled: boolean;
  options: EffectOptions;
}

export class PostProcessor {
  private context: WebGPUContext;
  private shaderManager: ShaderManager;
  private textureManager: TextureManager;
  private uniformManager: UniformManager;

  // Render targets
  private renderTarget: GPUTexture | null = null;
  private depthTexture: GPUTexture | null = null;
  private tempTargets: GPUTexture[] = [];

  // Post-processing chain
  private passes: Map<string, PostProcessPass> = new Map();
  private fullscreenQuad: Plane | null = null;

  // Current dimensions
  private width = 0;
  private height = 0;

  constructor(
    context: WebGPUContext,
    shaderManager: ShaderManager,
    textureManager: TextureManager,
    uniformManager: UniformManager
  ) {
    this.context = context;
    this.shaderManager = shaderManager;
    this.textureManager = textureManager;
    this.uniformManager = uniformManager;
  }

  /**
   * Initialize post-processing system
   */
  async initialize(width: number, height: number): Promise<boolean> {
    if (!this.context.device) {
      console.error('WebGPU device not available');
      return false;
    }

    console.log(`🎬 Initializing PostProcessor with size ${width}x${height}`);
    this.width = width;
    this.height = height;

    // Create render targets
    console.log('📦 Creating render targets...');
    this.createRenderTargets();
    console.log('✅ Render targets created successfully');

    // Ensure default sampler exists
    console.log('🔧 Ensuring default sampler exists...');
    let defaultSampler = this.textureManager.getSampler('default');
    if (!defaultSampler) {
      defaultSampler = this.textureManager.createSampler('default', {
        wrapS: 'repeat',
        wrapT: 'repeat',
        magFilter: 'linear',
        minFilter: 'linear',
      });
      if (!defaultSampler) {
        console.error('❌ Failed to create default sampler');
        return false;
      }
    }
    console.log('✅ Default sampler ready');

    // Create fullscreen quad for post-processing
    console.log('🔲 Creating fullscreen quad...');
    this.fullscreenQuad = new Plane(this.context, {
      width: 2.0,
      height: 2.0,
      widthSegments: 1,
      heightSegments: 1,
    });
    console.log('✅ Fullscreen quad created successfully');

    // Initialize built-in effects
    console.log('🎨 Initializing built-in effects...');
    await this.initializeBuiltInEffects();
    console.log('✅ Built-in effects initialized successfully');

    return true;
  }

  /**
   * Create render targets for post-processing
   */
  private createRenderTargets(): void {
    if (!this.context.device) return;

    // Main render target
    this.renderTarget = this.context.device.createTexture({
      label: 'main_render_target',
      size: [this.width, this.height, 1],
      format: this.context.presentationFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    // Depth buffer
    this.depthTexture = this.context.device.createTexture({
      label: 'depth_texture',
      size: [this.width, this.height, 1],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Create additional render targets for multi-pass effects
    for (let i = 0; i < 2; i++) {
      const tempTarget = this.context.device.createTexture({
        label: `temp_render_target_${i}`,
        size: [this.width, this.height, 1],
        format: this.context.presentationFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      this.tempTargets.push(tempTarget);
    }
  }

  /**
   * Initialize built-in post-processing effects
   */
  async initializeBuiltInEffects(): Promise<void> {
    console.log('🎬 Initializing built-in post-processing effects...');
    
    // Blur effect
    const blurSuccess = await this.addEffect('blur', PostProcessor.getBlurShader(), { intensity: 1.0, radius: 2.0 });
    console.log(`🌀 Blur effect: ${blurSuccess ? 'SUCCESS' : 'FAILED'}`);
    
    // Bloom effect
    const bloomSuccess = await this.addEffect('bloom', PostProcessor.getBloomShader(), { intensity: 0.8, threshold: 0.7 });
    console.log(`✨ Bloom effect: ${bloomSuccess ? 'SUCCESS' : 'FAILED'}`);
    
    // Color correction
    const colorSuccess = await this.addEffect('colorCorrection', PostProcessor.getColorCorrectionShader(), {
      brightness: 0.0,
      contrast: 1.0,
      saturation: 1.0,
      hue: 0.0,
    });
    console.log(`🎨 Color correction effect: ${colorSuccess ? 'SUCCESS' : 'FAILED'}`);

    // Vignette effect
    const vignetteSuccess = await this.addEffect('vignette', PostProcessor.getVignetteShader(), { intensity: 0.5, radius: 0.8 });
    console.log(`🕳️ Vignette effect: ${vignetteSuccess ? 'SUCCESS' : 'FAILED'}`);

    // Film grain
    const grainSuccess = await this.addEffect('filmGrain', PostProcessor.getFilmGrainShader(), { intensity: 0.1, time: 0.0 });
    console.log(`📺 Film grain effect: ${grainSuccess ? 'SUCCESS' : 'FAILED'}`);
    
    const totalEffects = this.passes.size;
    console.log(`🎯 Post-processing initialization complete. ${totalEffects} effects loaded.`);
  }

  /**
   * Add a post-processing effect
   */
  async addEffect(id: string, shader: ShaderSource, options: EffectOptions = {}): Promise<boolean> {
    if (!this.context.device || !this.fullscreenQuad) {
      console.error(`⚠️ Cannot add effect "${id}": missing device or fullscreen quad`);
      return false;
    }

    console.log(`🔧 Adding post-processing effect "${id}"...`);
    try {
      // Create uniform buffer for effect parameters
      console.log(`📊 Creating uniform buffer for "${id}"...`);
      const uniformBuffer = this.uniformManager.createUniformBuffer(`${id}_uniforms`, 256);
      if (!uniformBuffer) {
        console.error(`❌ Failed to create uniform buffer for "${id}"`);
        return false;
      }

      // Update uniforms with initial options
      console.log(`🔄 Updating initial uniforms for "${id}"...`);
      this.updateEffectUniforms(id, options);

      // Create bind group layout for post-processing
      console.log(`📐 Creating bind group layout for "${id}"...`);
      const bindGroupLayout = this.createPostProcessBindGroupLayout();
      if (!bindGroupLayout) {
        console.error(`❌ Failed to create bind group layout for "${id}"`);
        return false;
      }

      // Create pipeline
      console.log(`⚙️ Creating pipeline for "${id}"...`);
      const pipeline = await this.shaderManager.createPipeline(`${id}_postprocess`, shader, {
        vertexBufferLayouts: [this.fullscreenQuad.getVertexBufferLayout()],
        bindGroupLayouts: [bindGroupLayout],
      });

      if (!pipeline) {
        console.error(`❌ Failed to create pipeline for "${id}"`);
        return false;
      }

      // Create bind group (will be updated when rendering)
      console.log(`🔗 Creating bind group for "${id}"...`);
      const defaultSampler = this.textureManager.getSampler('default');
      if (!defaultSampler) {
        console.error(`❌ Default sampler not found for effect "${id}"`);
        return false;
      }
      
      const bindGroup = this.createPostProcessBindGroup(
        bindGroupLayout,
        uniformBuffer,
        this.renderTarget!, // Will be updated during rendering
        defaultSampler
      );

      if (!bindGroup) {
        console.error(`❌ Failed to create bind group for "${id}"`);
        return false;
      }

      // Create pass
      const pass: PostProcessPass = {
        id,
        shader,
        pipeline,
        bindGroup,
        uniformBuffer,
        enabled: false, // Disabled by default
        options,
      };

      this.passes.set(id, pass);
      console.log(`✅ Successfully added effect "${id}"`);
      return true;
    } catch (error) {
      console.error(`💥 Error adding post-process effect "${id}":`, error);
      return false;
    }
  }

  /**
   * Create bind group layout for post-processing
   */
  private createPostProcessBindGroupLayout(): GPUBindGroupLayout | null {
    if (!this.context.device) return null;

    return this.context.device.createBindGroupLayout({
      label: 'postprocess_bind_group_layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: 'uniform',
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: 'float',
            viewDimension: '2d',
          },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
      ],
    });
  }

  /**
   * Create bind group for post-processing pass
   */
  private createPostProcessBindGroup(
    layout: GPUBindGroupLayout,
    uniformBuffer: GPUBuffer,
    texture: GPUTexture,
    sampler: GPUSampler
  ): GPUBindGroup | null {
    if (!this.context.device) return null;

    return this.context.device.createBindGroup({
      label: 'postprocess_bind_group',
      layout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
        {
          binding: 1,
          resource: texture.createView(),
        },
        {
          binding: 2,
          resource: sampler,
        },
      ],
    });
  }

  /**
   * Update effect uniform parameters
   */
  private updateEffectUniforms(effectId: string, options: EffectOptions): boolean {
    const uniformData: UniformData = {
      resolution: [this.width, this.height],
      time: performance.now() * 0.001,
      ...options,
    };

    return this.uniformManager.updateUniformBuffer(`${effectId}_uniforms`, uniformData);
  }

  /**
   * Enable/disable an effect
   */
  setEffectEnabled(id: string, enabled: boolean): boolean {
    const pass = this.passes.get(id);
    if (!pass) {
      console.warn(`❌ Effect "${id}" not found for enable/disable`);
      return false;
    }
    
    console.log(`${enabled ? '🟢' : '🔴'} ${enabled ? 'Enabling' : 'Disabling'} effect "${id}"`);
    pass.enabled = enabled;
    return true;
  }

  /**
   * Update effect options
   */
  updateEffect(id: string, options: Partial<EffectOptions>): boolean {
    const pass = this.passes.get(id);
    if (!pass) {
      console.warn(`❌ Effect "${id}" not found for update`);
      return false;
    }

    console.log(`🔧 Updating effect "${id}" with options:`, options);
    Object.assign(pass.options, options);
    const success = this.updateEffectUniforms(id, pass.options);
    console.log(`💫 Effect uniform update for "${id}": ${success ? 'SUCCESS' : 'FAILED'}`);
    return true;
  }

  /**
   * Begin render pass to render target
   */
  beginRenderToTexture(commandEncoder: GPUCommandEncoder): GPURenderPassEncoder {
    const renderPassDescriptor: GPURenderPassDescriptor = {
      label: 'scene_render_pass',
      colorAttachments: [
        {
          view: this.renderTarget!.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture!.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    };

    return commandEncoder.beginRenderPass(renderPassDescriptor);
  }

  /**
   * Apply post-processing effects
   */
  async applyPostProcessing(
    commandEncoder: GPUCommandEncoder,
    finalTarget: GPUTextureView,
    time: number = 0
  ): Promise<void> {
    if (!this.fullscreenQuad) return;

    const enabledPasses = Array.from(this.passes.values()).filter(pass => pass.enabled);
    
    if (enabledPasses.length === 0) {
      // No post-processing, just copy to final target
      await this.copyToFinalTarget(commandEncoder, this.renderTarget!, finalTarget);
      return;
    }

    let currentInput = this.renderTarget!;
    let currentOutput: GPUTexture;

    // Apply each enabled effect
    for (let i = 0; i < enabledPasses.length; i++) {
      const pass = enabledPasses[i];
      const isLastPass = i === enabledPasses.length - 1;

      // Determine output target
      if (isLastPass) {
        // Last pass renders directly to canvas
        const renderPassDescriptor: GPURenderPassDescriptor = {
          label: `postprocess_final_${pass.id}`,
          colorAttachments: [
            {
              view: finalTarget,
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        };

        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        this.renderPostProcessPass(renderPass, pass, currentInput, time);
        renderPass.end();
      } else {
        // Intermediate pass
        currentOutput = this.tempTargets[i % this.tempTargets.length];
        
        const renderPassDescriptor: GPURenderPassDescriptor = {
          label: `postprocess_${pass.id}`,
          colorAttachments: [
            {
              view: currentOutput.createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        };

        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        this.renderPostProcessPass(renderPass, pass, currentInput, time);
        renderPass.end();

        currentInput = currentOutput;
      }
    }
  }

  /**
   * Render a single post-processing pass
   */
  private renderPostProcessPass(
    renderPass: GPURenderPassEncoder,
    pass: PostProcessPass,
    inputTexture: GPUTexture,
    time: number
  ): void {
    if (!this.fullscreenQuad) return;

    // Update time-based uniforms
    this.updateEffectUniforms(pass.id, { ...pass.options, time });

    // Create temporary bind group with current input texture
    const layout = this.createPostProcessBindGroupLayout();
    if (!layout) return;

    const defaultSampler = this.textureManager.getSampler('default');
    if (!defaultSampler) {
      console.error('Default sampler not found during render pass');
      return;
    }
    
    const bindGroup = this.createPostProcessBindGroup(
      layout,
      pass.uniformBuffer!,
      inputTexture,
      defaultSampler
    );

    if (!bindGroup) return;

    renderPass.setPipeline(pass.pipeline);
    renderPass.setBindGroup(0, bindGroup);
    this.fullscreenQuad.bind(renderPass);
    this.fullscreenQuad.draw(renderPass);
  }

  /**
   * Copy render target to final target (no post-processing)
   */
  private async copyToFinalTarget(
    commandEncoder: GPUCommandEncoder,
    source: GPUTexture,
    target: GPUTextureView
  ): Promise<void> {
    const renderPassDescriptor: GPURenderPassDescriptor = {
      label: 'copy_to_final',
      colorAttachments: [
        {
          view: target,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    };

    const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
    
    // Use a simple copy shader
    const copyShader = PostProcessor.getCopyShader();
    
    // Create a simple bind group layout for copy operation
    const copyLayout = this.context.device!.createBindGroupLayout({
      label: 'copy_bind_group_layout',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: 'float',
            viewDimension: '2d',
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
      ],
    });
    
    const pipeline = this.shaderManager.getPipeline('copy_shader') || 
      await this.shaderManager.createPipeline('copy_shader', copyShader, {
        vertexBufferLayouts: [this.fullscreenQuad!.getVertexBufferLayout()],
        bindGroupLayouts: [copyLayout],
      });

    if (pipeline && this.fullscreenQuad) {
      const bindGroup = this.context.device!.createBindGroup({
        label: 'copy_bind_group',
        layout: copyLayout,
        entries: [
          {
            binding: 0,
            resource: source.createView(),
          },
          {
            binding: 1,
            resource: this.textureManager.getSampler('default') || this.textureManager.createSampler('copy_sampler')!,
          },
        ],
      });

      if (bindGroup) {
        renderPass.setPipeline(pipeline);
        renderPass.setBindGroup(0, bindGroup);
        this.fullscreenQuad.bind(renderPass);
        this.fullscreenQuad.draw(renderPass);
      }
    }

    renderPass.end();
  }

  /**
   * Resize post-processing buffers
   */
  resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;

    this.width = width;
    this.height = height;

    // Destroy old render targets
    this.renderTarget?.destroy();
    this.depthTexture?.destroy();
    this.tempTargets.forEach(target => target.destroy());
    this.tempTargets = [];

    // Create new render targets
    this.createRenderTargets();
  }

  /**
   * Get render target for scene rendering
   */
  getRenderTarget(): GPUTexture | null {
    return this.renderTarget;
  }

  /**
   * Get depth texture
   */
  getDepthTexture(): GPUTexture | null {
    return this.depthTexture;
  }

  // Built-in shader effects
  static getCopyShader(): ShaderSource {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,

      fragment: `
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  return textureSample(inputTexture, inputSampler, uv);
}`
    };
  }

  static getBlurShader(): ShaderSource {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,

      fragment: `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  intensity: f32,
  radius: f32,
  padding: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let texelSize = 1.0 / uniforms.resolution;
  let blurRadius = max(0.1, uniforms.radius * uniforms.intensity);
  
  var color = vec4<f32>(0.0);
  var totalWeight = 0.0;
  
  // Use smaller kernel to avoid artifacts
  let kernelSize = 3;
  let offset = kernelSize / 2;
  
  for (var x = -offset; x <= offset; x++) {
    for (var y = -offset; y <= offset; y++) {
      let sampleOffset = vec2<f32>(f32(x), f32(y)) * texelSize * blurRadius;
      let dist = length(vec2<f32>(f32(x), f32(y)));
      let weight = exp(-dist * dist / (2.0 * blurRadius * blurRadius));
      
      let sampleColor = textureSample(inputTexture, inputSampler, uv + sampleOffset);
      color += sampleColor * weight;
      totalWeight += weight;
    }
  }
  
  // Ensure we don't divide by zero
  if (totalWeight > 0.0) {
    return color / totalWeight;
  } else {
    return textureSample(inputTexture, inputSampler, uv);
  }
}`
    };
  }

  static getBloomShader(): ShaderSource {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,

      fragment: `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  intensity: f32,
  threshold: f32,
  padding: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let original = textureSample(inputTexture, inputSampler, uv);
  
  // Extract bright areas with more aggressive threshold
  let brightness = dot(original.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let bright = select(vec3<f32>(0.0), original.rgb, brightness > uniforms.threshold);
  
  // Create bloom with blur approximation
  let texelSize = 1.0 / uniforms.resolution;
  var bloomColor = vec3<f32>(0.0);
  let samples = 5;
  let offset = f32(samples) / 2.0;
  
  for (var x = 0; x < samples; x++) {
    for (var y = 0; y < samples; y++) {
      let sampleUV = uv + vec2<f32>(f32(x) - offset, f32(y) - offset) * texelSize * 2.0;
      let sample = textureSample(inputTexture, inputSampler, sampleUV);
      let sampleBrightness = dot(sample.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
      let sampleBright = select(vec3<f32>(0.0), sample.rgb, sampleBrightness > uniforms.threshold);
      bloomColor += sampleBright;
    }
  }
  
  bloomColor = bloomColor / f32(samples * samples);
  let bloom = bloomColor * uniforms.intensity * 2.0; // Amplify effect
  
  return vec4<f32>(original.rgb + bloom, original.a);
}`
    };
  }

  static getColorCorrectionShader(): ShaderSource {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,

      fragment: `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  brightness: f32,
  contrast: f32,
  saturation: f32,
  hue: f32,
  padding: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let originalColor = textureSample(inputTexture, inputSampler, uv);
  var rgb = originalColor.rgb;
  
  // Clamp initial color to prevent issues
  rgb = clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));
  
  // Brightness adjustment
  rgb = rgb + vec3<f32>(uniforms.brightness);
  
  // Contrast adjustment
  rgb = (rgb - vec3<f32>(0.5)) * uniforms.contrast + vec3<f32>(0.5);
  
  // Saturation adjustment
  let luminance = dot(rgb, vec3<f32>(0.299, 0.587, 0.114));
  rgb = mix(vec3<f32>(luminance), rgb, uniforms.saturation);
  
  // Simple hue shift using HSV conversion (simplified)
  if (abs(uniforms.hue) > 0.001) {
    // Convert to HSV for hue adjustment
    let maxVal = max(max(rgb.r, rgb.g), rgb.b);
    let minVal = min(min(rgb.r, rgb.g), rgb.b);
    let delta = maxVal - minVal;
    
    if (delta > 0.001) {
      var hue = 0.0;
      if (maxVal == rgb.r) {
        hue = ((rgb.g - rgb.b) / delta) * 60.0;
      } else if (maxVal == rgb.g) {
        hue = (2.0 + (rgb.b - rgb.r) / delta) * 60.0;
      } else {
        hue = (4.0 + (rgb.r - rgb.g) / delta) * 60.0;
      }
      
      hue = (hue + uniforms.hue * 180.0) % 360.0;
      if (hue < 0.0) { hue += 360.0; }
      
      let saturation = delta / maxVal;
      let value = maxVal;
      
      // Convert back to RGB
      let c = value * saturation;
      let x = c * (1.0 - abs((hue / 60.0) % 2.0 - 1.0));
      let m = value - c;
      
      if (hue < 60.0) {
        rgb = vec3<f32>(c, x, 0.0) + vec3<f32>(m);
      } else if (hue < 120.0) {
        rgb = vec3<f32>(x, c, 0.0) + vec3<f32>(m);
      } else if (hue < 180.0) {
        rgb = vec3<f32>(0.0, c, x) + vec3<f32>(m);
      } else if (hue < 240.0) {
        rgb = vec3<f32>(0.0, x, c) + vec3<f32>(m);
      } else if (hue < 300.0) {
        rgb = vec3<f32>(x, 0.0, c) + vec3<f32>(m);
      } else {
        rgb = vec3<f32>(c, 0.0, x) + vec3<f32>(m);
      }
    }
  }
  
  // Clamp final result
  rgb = clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));
  
  return vec4<f32>(rgb, originalColor.a);
}`
    };
  }

  static getVignetteShader(): ShaderSource {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,

      fragment: `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  intensity: f32,
  radius: f32,
  padding: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSample(inputTexture, inputSampler, uv);
  
  // Calculate distance from center with aspect ratio correction
  let center = vec2<f32>(0.5, 0.5);
  let aspectRatio = uniforms.resolution.x / uniforms.resolution.y;
  let adjustedUV = uv - center;
  adjustedUV.x *= aspectRatio;
  let dist = length(adjustedUV);
  
  // Create more pronounced vignette with smoother falloff
  let vignetteStart = uniforms.radius * 0.3;
  let vignetteEnd = uniforms.radius;
  let vignette = 1.0 - smoothstep(vignetteStart, vignetteEnd, dist);
  
  // Apply intensity
  let vignetteIntensity = mix(1.0 - uniforms.intensity, 1.0, vignette);
  
  return vec4<f32>(color.rgb * vignetteIntensity, color.a);
}`
    };
  }

  static getFilmGrainShader(): ShaderSource {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,

      fragment: `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  intensity: f32,
  padding: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

fn random(st: vec2<f32>) -> f32 {
  return fract(sin(dot(st.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453123);
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSample(inputTexture, inputSampler, uv);
  
  // Generate multiple noise samples for better grain texture
  let pixelCoord = uv * uniforms.resolution;
  let noise1 = random(pixelCoord + uniforms.time * 1.3);
  let noise2 = random(pixelCoord * 2.1 + uniforms.time * 0.7);
  let noise3 = random(pixelCoord * 0.5 + uniforms.time * 2.1);
  
  // Combine noise samples
  let combinedNoise = (noise1 + noise2 * 0.5 + noise3 * 0.25) / 1.75;
  let grain = (combinedNoise * 2.0 - 1.0) * uniforms.intensity;
  
  // Apply grain with luminance-based modulation
  let luminance = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
  let grainModulation = 1.0 - luminance * 0.3; // More grain in darker areas
  let finalGrain = grain * grainModulation;
  
  return vec4<f32>(color.rgb + vec3<f32>(finalGrain), color.a);
}`
    };
  }

  /**
   * Get debug information about loaded passes
   */
  getDebugInfo(): { totalPasses: number; passIds: string[]; enabledPasses: string[] } {
    const enabledPasses = Array.from(this.passes.values())
      .filter(pass => pass.enabled)
      .map(pass => pass.id);
    
    return {
      totalPasses: this.passes.size,
      passIds: Array.from(this.passes.keys()),
      enabledPasses
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.renderTarget?.destroy();
    this.depthTexture?.destroy();
    this.tempTargets.forEach(target => target.destroy());
    this.tempTargets = [];
    
    this.fullscreenQuad?.destroy();
    this.passes.clear();
  }
}
