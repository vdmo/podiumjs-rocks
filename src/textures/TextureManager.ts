/**
 * Texture management for PodiumJS
 * Handles texture loading, creation, and binding for images and videos
 */

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

export class TextureManager {
  private context: WebGPUContext;
  private textures = new Map<string, GPUTexture>();
  private samplers = new Map<string, GPUSampler>();
  private imageCache = new Map<string, HTMLImageElement>();
  private videoCache = new Map<string, HTMLVideoElement>();

  constructor(context: WebGPUContext) {
    this.context = context;
  }

  /**
   * Load texture from image URL
   */
  async loadImageTexture(
    url: string,
    options: TextureOptions = {}
  ): Promise<GPUTexture | null> {
    if (!this.context.device) {
      console.error('WebGPU device not available');
      return null;
    }

    try {
      // Check cache first
      let image = this.imageCache.get(url);
      
      if (!image) {
        image = new Image();
        if (!url.startsWith('data:')) {
          image.crossOrigin = 'anonymous';
        }
        
        await new Promise<void>((resolve, reject) => {
          image!.onload = () => resolve();
          image!.onerror = reject;
          image!.src = url;
        });
        
        this.imageCache.set(url, image);
      }

      const texture = this.createTextureFromImage(image, options);
      if (texture) {
        this.textures.set(url, texture);
      }
      
      return texture;
    } catch (error) {
      console.error(`Error loading image texture from "${url}":`, error);
      return null;
    }
  }

  /**
   * Load texture from video element or URL
   */
  async loadVideoTexture(
    source: HTMLVideoElement | string,
    options: VideoTextureOptions = {}
  ): Promise<GPUTexture | null> {
    if (!this.context.device) {
      console.error('WebGPU device not available');
      return null;
    }

    try {
      let video: HTMLVideoElement;
      let cacheKey: string;

      if (typeof source === 'string') {
        cacheKey = source;
        let cachedVideo = this.videoCache.get(source);
        
        if (!cachedVideo) {
          cachedVideo = document.createElement('video');
          cachedVideo.src = source;
          cachedVideo.crossOrigin = 'anonymous';
          cachedVideo.loop = options.loop ?? false;
          cachedVideo.muted = options.muted ?? true;
          
          if (options.autoplay) {
            cachedVideo.autoplay = true;
          }
          
          await new Promise<void>((resolve, reject) => {
            cachedVideo!.oncanplay = () => resolve();
            cachedVideo!.onerror = reject;
            cachedVideo!.load();
          });
          
          this.videoCache.set(source, cachedVideo);
        }
        
        video = cachedVideo;
      } else {
        video = source;
        cacheKey = `video_${Date.now()}`;
      }

      const texture = this.createTextureFromVideo(video, options);
      if (texture) {
        this.textures.set(cacheKey, texture);
      }
      
      return texture;
    } catch (error) {
      console.error('Error loading video texture:', error);
      return null;
    }
  }

  /**
   * Create texture from image data
   */
  createTextureFromImage(
    image: HTMLImageElement,
    options: TextureOptions = {}
  ): GPUTexture | null {
    if (!this.context.device) return null;

    try {
      const texture = this.context.device.createTexture({
        label: options.label || 'image_texture',
        size: [image.width, image.height, 1],
        format: options.format || 'rgba8unorm',
        usage: options.usage || (
          GPUTextureUsage.TEXTURE_BINDING | 
          GPUTextureUsage.COPY_DST | 
          GPUTextureUsage.RENDER_ATTACHMENT
        ),
        mipLevelCount: options.generateMips ? 
          Math.floor(Math.log2(Math.max(image.width, image.height))) + 1 : 1,
      });

      this.context.device.queue.copyExternalImageToTexture(
        { 
          source: image,
          flipY: options.flipY || false,
        },
        { texture: texture },
        [image.width, image.height]
      );

      // Generate mipmaps if requested
      if (options.generateMips) {
        this.generateMipmaps(texture, image.width, image.height);
      }

      return texture;
    } catch (error) {
      console.error('Error creating texture from image:', error);
      return null;
    }
  }

  /**
   * Create texture from video element
   */
  createTextureFromVideo(
    video: HTMLVideoElement,
    options: VideoTextureOptions = {}
  ): GPUTexture | null {
    if (!this.context.device) return null;

    try {
      const texture = this.context.device.createTexture({
        label: options.label || 'video_texture',
        size: [video.videoWidth, video.videoHeight, 1],
        format: options.format || 'rgba8unorm',
        usage: options.usage || (
          GPUTextureUsage.TEXTURE_BINDING | 
          GPUTextureUsage.COPY_DST | 
          GPUTextureUsage.RENDER_ATTACHMENT
        ),
      });

      // Initial copy
      this.updateVideoTexture(video, texture);

      return texture;
    } catch (error) {
      console.error('Error creating texture from video:', error);
      return null;
    }
  }

  /**
   * Update video texture (call this in your render loop for video textures)
   */
  updateVideoTexture(video: HTMLVideoElement, texture: GPUTexture): void {
    if (!this.context.device) return;

    try {
      this.context.device.queue.copyExternalImageToTexture(
        { source: video },
        { texture: texture },
        [video.videoWidth, video.videoHeight]
      );
    } catch (error) {
      console.error('Error updating video texture:', error);
    }
  }

  /**
   * Create a sampler
   */
  createSampler(
    label: string,
    options: TextureOptions = {}
  ): GPUSampler | null {
    if (!this.context.device) return null;

    try {
      const sampler = this.context.device.createSampler({
        label,
        addressModeU: options.wrapS || 'repeat',
        addressModeV: options.wrapT || 'repeat',
        magFilter: options.magFilter || 'linear',
        minFilter: options.minFilter || 'linear',
      });

      this.samplers.set(label, sampler);
      return sampler;
    } catch (error) {
      console.error(`Error creating sampler "${label}":`, error);
      return null;
    }
  }

  /**
   * Create a bind group for texture and sampler
   */
  createTextureBindGroup(
    layout: GPUBindGroupLayout,
    texture: GPUTexture,
    sampler?: GPUSampler,
    label?: string
  ): GPUBindGroup | null {
    if (!this.context.device) return null;

    try {
      // Use default sampler if none provided
      const textureSampler = sampler || this.getOrCreateDefaultSampler();
      
      return this.context.device.createBindGroup({
        label,
        layout,
        entries: [
          {
            binding: 0,
            resource: texture.createView(),
          },
          {
            binding: 1,
            resource: textureSampler,
          },
        ],
      });
    } catch (error) {
      console.error('Error creating texture bind group:', error);
      return null;
    }
  }

  /**
   * Get or create default sampler
   */
  private getOrCreateDefaultSampler(): GPUSampler {
    let sampler = this.samplers.get('default');
    
    if (!sampler) {
      sampler = this.createSampler('default', {
        wrapS: 'repeat',
        wrapT: 'repeat',
        magFilter: 'linear',
        minFilter: 'linear',
      }) || undefined;
      
      if (!sampler) {
        throw new Error('Failed to create default sampler');
      }
    }
    
    return sampler;
  }

  /**
   * Generate mipmaps for a texture (simplified version)
   */
  private generateMipmaps(_texture: GPUTexture, width: number, height: number): void {
    // This is a simplified mipmap generation
    // In a full implementation, you'd create a compute shader or use a render pipeline
    // For now, we'll just note that mipmaps were requested
    console.log(`Mipmaps requested for texture ${width}x${height} (not fully implemented)`);
  }

  /**
   * Create a render target texture
   */
  createRenderTarget(
    width: number,
    height: number,
    format?: GPUTextureFormat,
    label?: string
  ): GPUTexture | null {
    if (!this.context.device) return null;

    try {
      const texture = this.context.device.createTexture({
        label: label || 'render_target',
        size: [width, height, 1],
        format: format || this.context.presentationFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });

      return texture;
    } catch (error) {
      console.error('Error creating render target:', error);
      return null;
    }
  }

  /**
   * Get cached texture
   */
  getTexture(key: string): GPUTexture | null {
    return this.textures.get(key) || null;
  }

  /**
   * Get cached sampler
   */
  getSampler(key: string): GPUSampler | null {
    return this.samplers.get(key) || null;
  }

  /**
   * Get cached image
   */
  getImage(url: string): HTMLImageElement | null {
    return this.imageCache.get(url) || null;
  }

  /**
   * Get cached video
   */
  getVideo(url: string): HTMLVideoElement | null {
    return this.videoCache.get(url) || null;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Destroy textures
    this.textures.forEach(texture => texture.destroy());
    this.textures.clear();
    
    // Clear samplers
    this.samplers.clear();
    
    // Clear caches
    this.imageCache.clear();
    this.videoCache.clear();
  }
}