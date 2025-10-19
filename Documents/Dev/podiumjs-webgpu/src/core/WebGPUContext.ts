/**
 * WebGPU context management for PodiumJS
 * Handles device initialization, context configuration, and error handling
 */

export interface WebGPUContextOptions {
  canvas: HTMLCanvasElement;
  powerPreference?: GPUPowerPreference;
  forceFallbackAdapter?: boolean;
  alphaMode?: GPUCanvasAlphaMode;
  colorSpace?: PredefinedColorSpace;
}

export class WebGPUContext {
  public canvas: HTMLCanvasElement;
  public adapter: GPUAdapter | null = null;
  public device: GPUDevice | null = null;
  public context: GPUCanvasContext | null = null;
  public presentationFormat: GPUTextureFormat = 'bgra8unorm';
  
  private options: WebGPUContextOptions;

  constructor(options: WebGPUContextOptions) {
    this.canvas = options.canvas;
    this.options = options;
  }

  /**
   * Initialize the WebGPU context
   */
  async initialize(): Promise<boolean> {
    try {
      if (!navigator.gpu) {
        console.error('WebGPU not supported in this browser');
        return false;
      }

      // Request adapter
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: this.options.powerPreference || 'high-performance',
        forceFallbackAdapter: this.options.forceFallbackAdapter || false,
      });

      if (!this.adapter) {
        console.error('Failed to get WebGPU adapter');
        return false;
      }

      // Request device
      this.device = await this.adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {},
      });

      if (!this.device) {
        console.error('Failed to get WebGPU device');
        return false;
      }

      // Set up error handling
      this.device.addEventListener('uncapturederror', (event) => {
        console.error('WebGPU uncaptured error:', event.error);
      });

      // Get canvas context
      this.context = this.canvas.getContext('webgpu');
      if (!this.context) {
        console.error('Failed to get WebGPU canvas context');
        return false;
      }

      // Get preferred format
      this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

      // Configure canvas context
      this.context.configure({
        device: this.device,
        format: this.presentationFormat,
        alphaMode: this.options.alphaMode || 'opaque',
        colorSpace: this.options.colorSpace || 'srgb',
      });

      console.log('WebGPU initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing WebGPU:', error);
      return false;
    }
  }

  /**
   * Resize the canvas and update the context
   */
  resize(width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      
      // Reconfigure context if needed
      if (this.context && this.device) {
        this.context.configure({
          device: this.device,
          format: this.presentationFormat,
          alphaMode: this.options.alphaMode || 'opaque',
          colorSpace: this.options.colorSpace || 'srgb',
        });
      }
    }
  }

  /**
   * Get the current texture view for rendering
   */
  getCurrentTextureView(): GPUTextureView | null {
    if (!this.context) return null;
    
    try {
      const currentTexture = this.context.getCurrentTexture();
      return currentTexture.createView();
    } catch (error) {
      console.warn('Failed to get current texture view:', error);
      return null;
    }
  }

  /**
   * Check if WebGPU is supported
   */
  static isSupported(): boolean {
    return 'gpu' in navigator;
  }

  /**
   * Get device information
   */
  getDeviceInfo(): {
    vendor?: string;
    architecture?: string;
    device?: string;
    description?: string;
  } | null {
    if (!this.adapter) return null;
    
    return {
      vendor: this.adapter.info?.vendor,
      architecture: this.adapter.info?.architecture,
      device: this.adapter.info?.device,
      description: this.adapter.info?.description,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.adapter = null;
    this.context = null;
  }
}