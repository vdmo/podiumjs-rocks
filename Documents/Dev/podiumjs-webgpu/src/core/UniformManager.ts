/**
 * Uniform buffer and bind group management for PodiumJS
 * Handles uniform buffer creation, updates, and bind group management
 */

import { WebGPUContext } from './WebGPUContext.js';

export interface UniformData {
  mvpMatrix?: Float32Array;
  time?: number;
  resolution?: [number, number];
  mousePosition?: [number, number];
  [key: string]: Float32Array | number | [number, number] | undefined;
}

export class UniformManager {
  private context: WebGPUContext;
  private uniformBuffers = new Map<string, GPUBuffer>();
  private bindGroups = new Map<string, GPUBindGroup>();
  private uniformLayouts = new Map<string, GPUBindGroupLayout>();

  constructor(context: WebGPUContext) {
    this.context = context;
  }

  /**
   * Create a uniform buffer
   */
  createUniformBuffer(
    label: string,
    size: number,
    initialData?: ArrayBuffer
  ): GPUBuffer | null {
    if (!this.context.device) {
      console.error('WebGPU device not available');
      return null;
    }

    try {
      // Ensure size is properly aligned to 256 bytes (WebGPU uniform buffer alignment)
      const alignedSize = Math.max(Math.ceil(size / 256) * 256, 256);
      
      const buffer = this.context.device.createBuffer({
        label,
        size: alignedSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        mappedAtCreation: !!initialData,
      });

      if (initialData) {
        new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(initialData));
        buffer.unmap();
      }

      this.uniformBuffers.set(label, buffer);
      return buffer;
    } catch (error) {
      console.error(`Error creating uniform buffer "${label}":`, error);
      return null;
    }
  }

  /**
   * Update uniform buffer with new data
   */
  updateUniformBuffer(
    bufferLabel: string,
    data: UniformData,
    offset: number = 0
  ): boolean {
    const buffer = this.uniformBuffers.get(bufferLabel);
    if (!buffer || !this.context.device) {
      console.error(`Uniform buffer "${bufferLabel}" not found`);
      return false;
    }

    try {
      const serializedData = this.serializeUniformData(data);
      this.context.device.queue.writeBuffer(buffer, offset, serializedData);
      return true;
    } catch (error) {
      console.error(`Error updating uniform buffer "${bufferLabel}":`, error);
      return false;
    }
  }

  /**
   * Serialize uniform data to buffer format
   * WebGPU has strict alignment requirements:
   * - mat4x4: 64 bytes, 16-byte aligned
   * - f32: 4 bytes, 4-byte aligned
   * - vec3: 12 bytes, 16-byte aligned (padding to vec4)
   */
  private serializeUniformData(data: UniformData): ArrayBuffer {
    // Create fixed 96-byte buffer to match WGSL Uniforms struct
    // struct Uniforms {
    //   mvpMatrix: mat4x4<f32>,  // 64 bytes at offset 0
    //   time: f32,               // 4 bytes at offset 64
    //   padding: vec3<f32>,      // 12 bytes at offset 68, but aligned to 16-byte
    // }
    const buffer = new ArrayBuffer(96); // 64 + 16 + 16 = 96 bytes
    const view = new Float32Array(buffer);
    
    // Matrix at offset 0 (16 floats)
    if (data.mvpMatrix && data.mvpMatrix instanceof Float32Array) {
      view.set(data.mvpMatrix, 0);
    } else {
      // Set identity matrix if no matrix provided
      const identity = UniformManager.createIdentityMatrix();
      view.set(identity, 0);
    }
    
    // Time at offset 16 (64 bytes / 4 bytes per float = index 16)
    if (typeof data.time === 'number') {
      view[16] = data.time;
    }
    
    // Padding starts at offset 17 (68 bytes / 4 bytes per float = index 17)
    // But we align to next 16-byte boundary which is index 20 (80 bytes)
    // Leave padding values as 0.0
    
    return buffer;
  }

  /**
   * Create a standard uniform layout for basic rendering
   */
  createStandardUniformLayout(): GPUBindGroupLayout | null {
    if (!this.context.device) return null;

    const layout = this.context.device.createBindGroupLayout({
      label: 'standard_uniform_layout',
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

    this.uniformLayouts.set('standard', layout);
    return layout;
  }

  /**
   * Create a bind group combining uniform buffer, texture, and sampler
   */
  createUniformBindGroup(
    label: string,
    layout: GPUBindGroupLayout,
    uniformBuffer: GPUBuffer,
    texture?: GPUTexture,
    sampler?: GPUSampler
  ): GPUBindGroup | null {
    if (!this.context.device) return null;

    try {
      const entries: GPUBindGroupEntry[] = [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ];

      if (texture) {
        entries.push({
          binding: 1,
          resource: texture.createView(),
        });
      }

      if (sampler) {
        entries.push({
          binding: 2,
          resource: sampler,
        });
      }

      const bindGroup = this.context.device.createBindGroup({
        label,
        layout,
        entries,
      });

      this.bindGroups.set(label, bindGroup);
      return bindGroup;
    } catch (error) {
      console.error(`Error creating bind group "${label}":`, error);
      return null;
    }
  }

  /**
   * Create identity matrix
   */
  static createIdentityMatrix(): Float32Array {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  }

  /**
   * Create orthographic projection matrix
   */
  static createOrthographicMatrix(
    left: number,
    right: number,
    bottom: number,
    top: number,
    near: number = -1,
    far: number = 1
  ): Float32Array {
    const width = right - left;
    const height = top - bottom;
    const depth = far - near;

    return new Float32Array([
      2 / width, 0, 0, 0,
      0, 2 / height, 0, 0,
      0, 0, -2 / depth, 0,
      -(right + left) / width, -(top + bottom) / height, -(far + near) / depth, 1,
    ]);
  }

  /**
   * Create perspective projection matrix
   */
  static createPerspectiveMatrix(
    fovy: number,
    aspect: number,
    near: number,
    far: number
  ): Float32Array {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);

    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  }

  /**
   * Create translation matrix
   */
  static createTranslationMatrix(x: number, y: number, z: number = 0): Float32Array {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1,
    ]);
  }

  /**
   * Create scale matrix
   */
  static createScaleMatrix(x: number, y: number, z: number = 1): Float32Array {
    return new Float32Array([
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1,
    ]);
  }

  /**
   * Multiply two 4x4 matrices
   */
  static multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(16);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] = 
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }

    return result;
  }

  /**
   * Get a cached uniform buffer
   */
  getUniformBuffer(label: string): GPUBuffer | null {
    return this.uniformBuffers.get(label) || null;
  }

  /**
   * Get a cached bind group
   */
  getBindGroup(label: string): GPUBindGroup | null {
    return this.bindGroups.get(label) || null;
  }

  /**
   * Get a cached uniform layout
   */
  getUniformLayout(label: string): GPUBindGroupLayout | null {
    return this.uniformLayouts.get(label) || null;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.uniformBuffers.forEach(buffer => buffer.destroy());
    this.uniformBuffers.clear();
    this.bindGroups.clear();
    this.uniformLayouts.clear();
  }
}