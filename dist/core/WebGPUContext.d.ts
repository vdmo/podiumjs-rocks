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
export declare class WebGPUContext {
    canvas: HTMLCanvasElement;
    adapter: GPUAdapter | null;
    device: GPUDevice | null;
    context: GPUCanvasContext | null;
    presentationFormat: GPUTextureFormat;
    private options;
    constructor(options: WebGPUContextOptions);
    /**
     * Initialize the WebGPU context
     */
    initialize(): Promise<boolean>;
    /**
     * Resize the canvas and update the context
     */
    resize(width: number, height: number): void;
    /**
     * Get the current texture view for rendering
     */
    getCurrentTextureView(): GPUTextureView | null;
    /**
     * Check if WebGPU is supported
     */
    static isSupported(): boolean;
    /**
     * Get device information
     */
    getDeviceInfo(): {
        vendor?: string;
        architecture?: string;
        device?: string;
        description?: string;
    } | null;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
