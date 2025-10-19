/**
 * Shader and pipeline management for PodiumJS
 * Handles WGSL shader compilation and render pipeline creation
 */

import { WebGPUContext } from '../core/WebGPUContext.js';

export interface ShaderSource {
  vertex: string;
  fragment: string;
}

export interface PipelineOptions {
  label?: string;
  vertexBufferLayouts: GPUVertexBufferLayout[];
  bindGroupLayouts?: GPUBindGroupLayout[];
  topology?: GPUPrimitiveTopology;
  cullMode?: GPUCullMode;
  frontFace?: GPUFrontFace;
  blendMode?: GPUBlendState;
  depthTest?: boolean;
  depthWrite?: boolean;
  depthCompare?: GPUCompareFunction;
}

export class ShaderManager {
  private context: WebGPUContext;
  private shaderModules = new Map<string, GPUShaderModule>();
  private pipelines = new Map<string, GPURenderPipeline>();
  private bindGroupLayouts = new Map<string, GPUBindGroupLayout>();

  constructor(context: WebGPUContext) {
    this.context = context;
  }

  /**
   * Create a shader module from WGSL source
   */
  createShaderModule(label: string, source: string): GPUShaderModule | null {
    if (!this.context.device) {
      console.error('WebGPU device not available');
      return null;
    }

    try {
      const shaderModule = this.context.device.createShaderModule({
        label,
        code: source,
      });

      // Check for compilation errors
      shaderModule.getCompilationInfo().then(info => {
        if (info.messages.length > 0) {
          console.warn(`Shader compilation messages for "${label}":`);
          info.messages.forEach(message => {
            console.warn(`  ${message.type}: ${message.message}`);
            if (message.lineNum !== undefined) {
              console.warn(`    Line ${message.lineNum}: ${message.linePos}`);
            }
          });
        }
      });

      this.shaderModules.set(label, shaderModule);
      return shaderModule;
    } catch (error) {
      console.error(`Error creating shader module "${label}":`, error);
      return null;
    }
  }

  /**
   * Create a render pipeline
   */
  async createPipeline(
    label: string,
    shaderSource: ShaderSource,
    options: PipelineOptions
  ): Promise<GPURenderPipeline | null> {
    if (!this.context.device) {
      console.error('WebGPU device not available');
      return null;
    }

    try {
      // Create separate shader modules to avoid struct redeclaration
      const vertexModule = this.createShaderModule(`${label}_vertex`, shaderSource.vertex);
      const fragmentModule = this.createShaderModule(`${label}_fragment`, shaderSource.fragment);
      
      if (!vertexModule || !fragmentModule) {
        console.error(`Failed to create shader modules for pipeline "${label}"`);
        return null;
      }

      // Wait for shader compilation to complete
      const [vertexInfo, fragmentInfo] = await Promise.all([
        vertexModule.getCompilationInfo(),
        fragmentModule.getCompilationInfo()
      ]);

      // Check compilation errors
      const checkCompilation = (info: GPUCompilationInfo, type: string) => {
        if (info.messages.length > 0) {
          console.error(`${type} shader compilation issues for "${label}":`);
          info.messages.forEach(message => {
            console.error(`  ${message.type}: ${message.message}`);
            if (message.lineNum) console.error(`    Line ${message.lineNum}:${message.linePos}`);
          });
          return info.messages.some(m => m.type === 'error');
        }
        return false;
      };

      if (checkCompilation(vertexInfo, 'Vertex') || checkCompilation(fragmentInfo, 'Fragment')) {
        return null;
      }

      // Create bind group layout if not provided
      let bindGroupLayouts = options.bindGroupLayouts;
      if (!bindGroupLayouts || bindGroupLayouts.length === 0) {
        console.log(`Creating default bind group layout for pipeline "${label}"`);
        const defaultBindGroupLayout = this.createDefaultBindGroupLayout();
        if (defaultBindGroupLayout) {
          bindGroupLayouts = [defaultBindGroupLayout];
          console.log(`Default bind group layout created successfully`);
        } else {
          console.error(`Failed to create default bind group layout for pipeline "${label}"`);
          return null;
        }
      }

      // Create pipeline layout
      const pipelineLayout = this.context.device.createPipelineLayout({
        label: `${label}_layout`,
        bindGroupLayouts: bindGroupLayouts || [],
      });

      // Create render pipeline
      const pipelineDescriptor: GPURenderPipelineDescriptor = {
        label,
        layout: pipelineLayout,
        vertex: {
          module: vertexModule,
          entryPoint: 'vs_main',
          buffers: options.vertexBufferLayouts,
        },
        fragment: {
          module: fragmentModule,
          entryPoint: 'fs_main',
          targets: [
            {
              format: this.context.presentationFormat,
              blend: options.blendMode,
            },
          ],
        },
        primitive: {
          topology: options.topology || 'triangle-list',
          cullMode: options.cullMode || 'none',
          frontFace: options.frontFace || 'ccw',
        },
      };

      // Add depth/stencil state if depth testing is enabled
      if (options.depthTest) {
        pipelineDescriptor.depthStencil = {
          format: 'depth24plus',
          depthWriteEnabled: options.depthWrite ?? true,
          depthCompare: options.depthCompare || 'less',
        };
      }

      console.log(`Creating render pipeline "${label}" with descriptor:`, {
        vertex: { entryPoint: pipelineDescriptor.vertex.entryPoint, buffers: pipelineDescriptor.vertex.buffers ? Array.from(pipelineDescriptor.vertex.buffers).length : 0 },
        fragment: { entryPoint: pipelineDescriptor.fragment?.entryPoint, targets: pipelineDescriptor.fragment?.targets ? Array.from(pipelineDescriptor.fragment.targets).length : 0 },
        primitive: pipelineDescriptor.primitive
      });

      const pipeline = this.context.device.createRenderPipeline(pipelineDescriptor);
      
      if (!pipeline) {
        console.error(`Failed to create render pipeline "${label}"`);
        return null;
      }
      
      console.log(`Render pipeline "${label}" created successfully`);
      this.pipelines.set(label, pipeline);
      return pipeline;
    } catch (error) {
      console.error(`Error creating pipeline "${label}":`, error);
      return null;
    }
  }

  /**
   * Create a default bind group layout for basic texture + sampler
   */
  private createDefaultBindGroupLayout(): GPUBindGroupLayout | null {
    if (!this.context.device) return null;

    const layout = this.context.device.createBindGroupLayout({
      label: 'default_bind_group_layout',
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

    this.bindGroupLayouts.set('default', layout);
    return layout;
  }

  /**
   * Create a custom bind group layout
   */
  createBindGroupLayout(
    label: string,
    entries: GPUBindGroupLayoutEntry[]
  ): GPUBindGroupLayout | null {
    if (!this.context.device) return null;

    try {
      const layout = this.context.device.createBindGroupLayout({
        label,
        entries,
      });

      this.bindGroupLayouts.set(label, layout);
      return layout;
    } catch (error) {
      console.error(`Error creating bind group layout "${label}":`, error);
      return null;
    }
  }

  /**
   * Get a cached pipeline
   */
  getPipeline(label: string): GPURenderPipeline | null {
    return this.pipelines.get(label) || null;
  }

  /**
   * Get a cached bind group layout
   */
  getBindGroupLayout(label: string): GPUBindGroupLayout | null {
    return this.bindGroupLayouts.get(label) || null;
  }

  /**
   * Get a cached shader module
   */
  getShaderModule(label: string): GPUShaderModule | null {
    return this.shaderModules.get(label) || null;
  }

  /**
   * Default basic shader for textured planes
   */
  static getBasicTextureShader(): ShaderSource {
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
@group(0) @binding(0) var mainTexture: texture_2d<f32>;
@group(0) @binding(1) var mainSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  return textureSample(mainTexture, mainSampler, uv);
}`
    };
  }

  /**
   * Shader with uniform support (MVP matrix, time, etc.)
   */
  static getUniformShader(): ShaderSource {
    return {
      vertex: `
struct Uniforms {
  mvpMatrix: mat4x4<f32>,
  time: f32,
  padding: vec3<f32>,
};

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,

      fragment: `
struct Uniforms {
  mvpMatrix: mat4x4<f32>,
  time: f32,
  padding: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var mainTexture: texture_2d<f32>;
@group(0) @binding(2) var mainSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  // Simple time-based effect
  let offset = vec2<f32>(sin(uniforms.time) * 0.01, 0.0);
  return textureSample(mainTexture, mainSampler, uv + offset);
}`
    };
  }

  /**
   * Create uniform bind group layout
   */
  createUniformBindGroupLayout(): GPUBindGroupLayout | null {
    if (!this.context.device) return null;

    return this.createBindGroupLayout('uniform_layout', [
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
    ]);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.shaderModules.clear();
    this.pipelines.clear();
    this.bindGroupLayouts.clear();
  }
}