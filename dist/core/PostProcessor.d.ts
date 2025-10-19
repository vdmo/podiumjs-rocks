import { WebGPUContext } from './WebGPUContext.js';
import { ShaderManager, ShaderSource } from '../shaders/ShaderManager.js';
import { TextureManager } from '../textures/TextureManager.js';
import { UniformManager } from './UniformManager.js';

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
export declare class PostProcessor {
    private context;
    private shaderManager;
    private textureManager;
    private uniformManager;
    private renderTarget;
    private depthTexture;
    private tempTargets;
    private passes;
    private fullscreenQuad;
    private width;
    private height;
    constructor(context: WebGPUContext, shaderManager: ShaderManager, textureManager: TextureManager, uniformManager: UniformManager);
    /**
     * Initialize post-processing system
     */
    initialize(width: number, height: number): Promise<boolean>;
    /**
     * Create render targets for post-processing
     */
    private createRenderTargets;
    /**
     * Initialize built-in post-processing effects
     */
    initializeBuiltInEffects(): Promise<void>;
    /**
     * Add a post-processing effect
     */
    addEffect(id: string, shader: ShaderSource, options?: EffectOptions): Promise<boolean>;
    /**
     * Create bind group layout for post-processing
     */
    private createPostProcessBindGroupLayout;
    /**
     * Create bind group for post-processing pass
     */
    private createPostProcessBindGroup;
    /**
     * Update effect uniform parameters
     */
    private updateEffectUniforms;
    /**
     * Enable/disable an effect
     */
    setEffectEnabled(id: string, enabled: boolean): boolean;
    /**
     * Update effect options
     */
    updateEffect(id: string, options: Partial<EffectOptions>): boolean;
    /**
     * Begin render pass to render target
     */
    beginRenderToTexture(commandEncoder: GPUCommandEncoder): GPURenderPassEncoder;
    /**
     * Apply post-processing effects
     */
    applyPostProcessing(commandEncoder: GPUCommandEncoder, finalTarget: GPUTextureView, time?: number): Promise<void>;
    /**
     * Render a single post-processing pass
     */
    private renderPostProcessPass;
    /**
     * Copy render target to final target (no post-processing)
     */
    private copyToFinalTarget;
    /**
     * Resize post-processing buffers
     */
    resize(width: number, height: number): void;
    /**
     * Get render target for scene rendering
     */
    getRenderTarget(): GPUTexture | null;
    /**
     * Get depth texture
     */
    getDepthTexture(): GPUTexture | null;
    static getCopyShader(): ShaderSource;
    static getBlurShader(): ShaderSource;
    static getBloomShader(): ShaderSource;
    static getColorCorrectionShader(): ShaderSource;
    static getVignetteShader(): ShaderSource;
    static getFilmGrainShader(): ShaderSource;
    /**
     * Get debug information about loaded passes
     */
    getDebugInfo(): {
        totalPasses: number;
        passIds: string[];
        enabledPasses: string[];
    };
    /**
     * Cleanup resources
     */
    destroy(): void;
}
