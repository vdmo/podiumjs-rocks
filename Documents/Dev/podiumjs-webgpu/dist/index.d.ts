/**
 * PodiumJS - A WebGPU-based alternative to Curtains.js
 * Main entry point for the library
 */
export { Podium, type PodiumOptions, type RenderObject } from './core/Podium.js';
export { WebGPUContext, type WebGPUContextOptions } from './core/WebGPUContext.js';
export { UniformManager, type UniformData } from './core/UniformManager.js';
export { PostProcessor, type EffectOptions } from './core/PostProcessor.js';
export { Plane, type PlaneOptions, type PlaneGeometry } from './geometry/Plane.js';
export { ShaderManager, type ShaderSource, type PipelineOptions } from './shaders/ShaderManager.js';
export { TextureManager, type TextureOptions, type VideoTextureOptions } from './textures/TextureManager.js';
export { Podium as default } from './core/Podium.js';
