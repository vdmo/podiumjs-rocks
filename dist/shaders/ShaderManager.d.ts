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
export declare class ShaderManager {
    private context;
    private shaderModules;
    private pipelines;
    private bindGroupLayouts;
    constructor(context: WebGPUContext);
    /**
     * Create a shader module from WGSL source
     */
    createShaderModule(label: string, source: string): GPUShaderModule | null;
    /**
     * Create a render pipeline
     */
    createPipeline(label: string, shaderSource: ShaderSource, options: PipelineOptions): Promise<GPURenderPipeline | null>;
    /**
     * Create a default bind group layout for basic texture + sampler
     */
    private createDefaultBindGroupLayout;
    /**
     * Create a custom bind group layout
     */
    createBindGroupLayout(label: string, entries: GPUBindGroupLayoutEntry[]): GPUBindGroupLayout | null;
    /**
     * Get a cached pipeline
     */
    getPipeline(label: string): GPURenderPipeline | null;
    /**
     * Get a cached bind group layout
     */
    getBindGroupLayout(label: string): GPUBindGroupLayout | null;
    /**
     * Get a cached shader module
     */
    getShaderModule(label: string): GPUShaderModule | null;
    /**
     * Default basic shader for textured planes
     */
    static getBasicTextureShader(): ShaderSource;
    /**
     * Shader with uniform support (MVP matrix, time, etc.)
     */
    static getUniformShader(): ShaderSource;
    /**
     * Create uniform bind group layout
     */
    createUniformBindGroupLayout(): GPUBindGroupLayout | null;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
