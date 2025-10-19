import { WebGPUContext } from '../core/WebGPUContext.js';

export interface TextureOptions {
    label?: string;
    format?: GPUTextureFormat;
    usage?: GPUTextureUsageFlags;
    generateMips?: boolean;
    flipY?: boolean;
    wrapS?: GPUAddressMode;
    wrapT?: GPUAddressMode;
    magFilter?: GPUFilterMode;
    minFilter?: GPUFilterMode;
}
export interface VideoTextureOptions extends TextureOptions {
    loop?: boolean;
    muted?: boolean;
    autoplay?: boolean;
}
export declare class TextureManager {
    private context;
    private textures;
    private samplers;
    private imageCache;
    private videoCache;
    constructor(context: WebGPUContext);
    /**
     * Load texture from image URL
     */
    loadImageTexture(url: string, options?: TextureOptions): Promise<GPUTexture | null>;
    /**
     * Load texture from video element or URL
     */
    loadVideoTexture(source: HTMLVideoElement | string, options?: VideoTextureOptions): Promise<GPUTexture | null>;
    /**
     * Create texture from image data
     */
    createTextureFromImage(image: HTMLImageElement, options?: TextureOptions): GPUTexture | null;
    /**
     * Create texture from video element
     */
    createTextureFromVideo(video: HTMLVideoElement, options?: VideoTextureOptions): GPUTexture | null;
    /**
     * Update video texture (call this in your render loop for video textures)
     */
    updateVideoTexture(video: HTMLVideoElement, texture: GPUTexture): void;
    /**
     * Create a sampler
     */
    createSampler(label: string, options?: TextureOptions): GPUSampler | null;
    /**
     * Create a bind group for texture and sampler
     */
    createTextureBindGroup(layout: GPUBindGroupLayout, texture: GPUTexture, sampler?: GPUSampler, label?: string): GPUBindGroup | null;
    /**
     * Get or create default sampler
     */
    private getOrCreateDefaultSampler;
    /**
     * Generate mipmaps for a texture (simplified version)
     */
    private generateMipmaps;
    /**
     * Create a render target texture
     */
    createRenderTarget(width: number, height: number, format?: GPUTextureFormat, label?: string): GPUTexture | null;
    /**
     * Get cached texture
     */
    getTexture(key: string): GPUTexture | null;
    /**
     * Get cached sampler
     */
    getSampler(key: string): GPUSampler | null;
    /**
     * Get cached image
     */
    getImage(url: string): HTMLImageElement | null;
    /**
     * Get cached video
     */
    getVideo(url: string): HTMLVideoElement | null;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
