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
export declare class Podium {
    context: WebGPUContext;
    shaderManager: ShaderManager;
    textureManager: TextureManager;
    uniformManager: UniformManager;
    postProcessor: PostProcessor | null;
    private options;
    private renderObjects;
    private isInitialized;
    private animationFrame;
    private startTime;
    private frameCount;
    private clearColor;
    constructor(options: PodiumOptions);
    /**
     * Initialize PodiumJS
     */
    initialize(): Promise<boolean>;
    /**
     * Create a plane with texture
     */
    createPlane(id: string, imageUrl: string, planeOptions?: PlaneOptions, textureOptions?: TextureOptions): Promise<RenderObject | null>;
    /**
     * Create a plane with uniform support
     */
    createUniformPlane(id: string, imageUrl: string, planeOptions?: PlaneOptions, textureOptions?: TextureOptions): Promise<RenderObject | null>;
    /**
     * Update uniform data for a render object
     */
    updateUniforms(id: string, data: Partial<UniformData>): boolean;
    /**
     * Set transform for a render object
     */
    setTransform(id: string, transform: Partial<RenderObject['transform']>): boolean;
    /**
     * Calculate MVP matrix from transform
     */
    private calculateMVPMatrix;
    /**
     * Start the render loop
     */
    startRenderLoop(): void;
    /**
     * Stop the render loop
     */
    stopRenderLoop(): void;
    /**
     * Render a single frame
     */
    render(currentTime?: number): Promise<void>;
    /**
     * Set up automatic canvas resizing
     */
    private setupAutoResize;
    /**
     * Get render object by ID
     */
    getRenderObject(id: string): RenderObject | null;
    /**
     * Remove render object
     */
    removeRenderObject(id: string): boolean;
    /**
     * Enable/disable a post-processing effect
     */
    setEffectEnabled(effectId: string, enabled: boolean): boolean;
    /**
     * Update post-processing effect options
     */
    updateEffect(effectId: string, options: Partial<EffectOptions>): boolean;
    /**
     * Get available post-processing effects
     */
    getAvailableEffects(): string[];
    /**
     * Get performance stats
     */
    getStats(): {
        frameCount: number;
        elapsedTime: number;
        fps: number;
    };
    /**
     * Check WebGPU support
     */
    static isSupported(): boolean;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
