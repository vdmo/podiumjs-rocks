/**
 * Plane geometry for PodiumJS
 * Creates and manages vertex buffers for a basic quad plane
 */

import { WebGPUContext } from '../core/WebGPUContext.js';

export interface PlaneGeometry {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
}

export interface PlaneOptions {
  width?: number;
  height?: number;
  widthSegments?: number;
  heightSegments?: number;
}

export class Plane {
  public geometry: PlaneGeometry;
  public vertexBuffer: GPUBuffer | null = null;
  public indexBuffer: GPUBuffer | null = null;
  public vertexCount: number;
  public indexCount: number;

  private context: WebGPUContext;
  private options: Required<PlaneOptions>;

  constructor(context: WebGPUContext, options: PlaneOptions = {}) {
    this.context = context;
    this.options = {
      width: options.width ?? 2.0,
      height: options.height ?? 2.0,
      widthSegments: options.widthSegments ?? 1,
      heightSegments: options.heightSegments ?? 1,
    };

    this.geometry = this.createGeometry();
    this.vertexCount = this.geometry.positions.length / 3;
    this.indexCount = this.geometry.indices.length;

    this.createBuffers();
  }

  /**
   * Create the plane geometry data
   */
  private createGeometry(): PlaneGeometry {
    const { width, height, widthSegments, heightSegments } = this.options;
    
    const widthHalf = width / 2;
    const heightHalf = height / 2;
    
    const gridX = widthSegments;
    const gridY = heightSegments;
    
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;
    
    const segmentWidth = width / gridX;
    const segmentHeight = height / gridY;

    // Create vertices
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Generate vertices
    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segmentHeight - heightHalf;
      
      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segmentWidth - widthHalf;
        
        // Position (x, y, z)
        positions.push(x, y, 0);
        
        // UV coordinates
        uvs.push(ix / gridX, 1 - (iy / gridY));
      }
    }

    // Generate indices
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = (ix + 1) + gridX1 * (iy + 1);
        const d = (ix + 1) + gridX1 * iy;
        
        // Two triangles per quad
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    return {
      positions: new Float32Array(positions),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices),
    };
  }

  /**
   * Create WebGPU buffers for the geometry
   */
  private createBuffers(): void {
    if (!this.context.device) {
      console.error('WebGPU device not available');
      return;
    }

    // Create vertex buffer (interleaved positions and UVs)
    const vertexData = new Float32Array(this.vertexCount * 5); // 3 pos + 2 uv
    
    for (let i = 0; i < this.vertexCount; i++) {
      const posOffset = i * 3;
      const uvOffset = i * 2;
      const vertexOffset = i * 5;
      
      // Position
      vertexData[vertexOffset] = this.geometry.positions[posOffset];
      vertexData[vertexOffset + 1] = this.geometry.positions[posOffset + 1];
      vertexData[vertexOffset + 2] = this.geometry.positions[posOffset + 2];
      
      // UV
      vertexData[vertexOffset + 3] = this.geometry.uvs[uvOffset];
      vertexData[vertexOffset + 4] = this.geometry.uvs[uvOffset + 1];
    }

    this.vertexBuffer = this.context.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertexData);
    this.vertexBuffer.unmap();

    // Create index buffer
    this.indexBuffer = this.context.device.createBuffer({
      size: this.geometry.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Uint16Array(this.indexBuffer.getMappedRange()).set(this.geometry.indices);
    this.indexBuffer.unmap();
  }

  /**
   * Get vertex buffer layout for pipeline creation
   */
  getVertexBufferLayout(): GPUVertexBufferLayout {
    return {
      arrayStride: 5 * 4, // 5 floats * 4 bytes each
      attributes: [
        {
          shaderLocation: 0, // position
          offset: 0,
          format: 'float32x3',
        },
        {
          shaderLocation: 1, // uv
          offset: 3 * 4,
          format: 'float32x2',
        },
      ],
    };
  }

  /**
   * Bind buffers for rendering
   */
  bind(renderPass: GPURenderPassEncoder): void {
    if (this.vertexBuffer && this.indexBuffer) {
      renderPass.setVertexBuffer(0, this.vertexBuffer);
      renderPass.setIndexBuffer(this.indexBuffer, 'uint16');
    }
  }

  /**
   * Draw the plane
   */
  draw(renderPass: GPURenderPassEncoder): void {
    renderPass.drawIndexed(this.indexCount);
  }

  /**
   * Update plane geometry (recreates buffers)
   */
  updateGeometry(options: Partial<PlaneOptions>): void {
    // Update options
    Object.assign(this.options, options);
    
    // Recreate geometry and buffers
    this.geometry = this.createGeometry();
    this.vertexCount = this.geometry.positions.length / 3;
    this.indexCount = this.geometry.indices.length;
    
    // Destroy old buffers
    this.destroy();
    
    // Create new buffers
    this.createBuffers();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
      this.vertexBuffer = null;
    }
    if (this.indexBuffer) {
      this.indexBuffer.destroy();
      this.indexBuffer = null;
    }
  }
}