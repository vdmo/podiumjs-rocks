import { WebGPUContext } from './WebGPUContext.js';

export interface UniformData {
    mvpMatrix?: Float32Array;
    time?: number;
    resolution?: [number, number];
    mousePosition?: [number, number];
    [key: string]: Float32Array | number | [number, number] | undefined;
}
export declare class UniformManager {
    private context;
    private uniformBuffers;
    private bindGroups;
    private uniformLayouts;
    constructor(context: WebGPUContext);
    /**
     * Create a uniform buffer
     */
    createUniformBuffer(label: string, size: number, initialData?: ArrayBuffer): GPUBuffer | null;
    /**
     * Update uniform buffer with new data
     */
    updateUniformBuffer(bufferLabel: string, data: UniformData, offset?: number): boolean;
    /**
     * Serialize uniform data to buffer format
     * WebGPU has strict alignment requirements:
     * - mat4x4: 64 bytes, 16-byte aligned
     * - f32: 4 bytes, 4-byte aligned
     * - vec3: 12 bytes, 16-byte aligned (padding to vec4)
     */
    private serializeUniformData;
    /**
     * Create a standard uniform layout for basic rendering
     */
    createStandardUniformLayout(): GPUBindGroupLayout | null;
    /**
     * Create a bind group combining uniform buffer, texture, and sampler
     */
    createUniformBindGroup(label: string, layout: GPUBindGroupLayout, uniformBuffer: GPUBuffer, texture?: GPUTexture, sampler?: GPUSampler): GPUBindGroup | null;
    /**
     * Create identity matrix
     */
    static createIdentityMatrix(): Float32Array;
    /**
     * Create orthographic projection matrix
     */
    static createOrthographicMatrix(left: number, right: number, bottom: number, top: number, near?: number, far?: number): Float32Array;
    /**
     * Create perspective projection matrix
     */
    static createPerspectiveMatrix(fovy: number, aspect: number, near: number, far: number): Float32Array;
    /**
     * Create translation matrix
     */
    static createTranslationMatrix(x: number, y: number, z?: number): Float32Array;
    /**
     * Create scale matrix
     */
    static createScaleMatrix(x: number, y: number, z?: number): Float32Array;
    /**
     * Multiply two 4x4 matrices
     */
    static multiplyMatrices(a: Float32Array, b: Float32Array): Float32Array;
    /**
     * Get a cached uniform buffer
     */
    getUniformBuffer(label: string): GPUBuffer | null;
    /**
     * Get a cached bind group
     */
    getBindGroup(label: string): GPUBindGroup | null;
    /**
     * Get a cached uniform layout
     */
    getUniformLayout(label: string): GPUBindGroupLayout | null;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
