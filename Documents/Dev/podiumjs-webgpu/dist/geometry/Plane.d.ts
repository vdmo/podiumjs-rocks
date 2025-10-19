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
export declare class Plane {
    geometry: PlaneGeometry;
    vertexBuffer: GPUBuffer | null;
    indexBuffer: GPUBuffer | null;
    vertexCount: number;
    indexCount: number;
    private context;
    private options;
    constructor(context: WebGPUContext, options?: PlaneOptions);
    /**
     * Create the plane geometry data
     */
    private createGeometry;
    /**
     * Create WebGPU buffers for the geometry
     */
    private createBuffers;
    /**
     * Get vertex buffer layout for pipeline creation
     */
    getVertexBufferLayout(): GPUVertexBufferLayout;
    /**
     * Bind buffers for rendering
     */
    bind(renderPass: GPURenderPassEncoder): void;
    /**
     * Draw the plane
     */
    draw(renderPass: GPURenderPassEncoder): void;
    /**
     * Update plane geometry (recreates buffers)
     */
    updateGeometry(options: Partial<PlaneOptions>): void;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
