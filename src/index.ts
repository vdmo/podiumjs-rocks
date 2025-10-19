/**
 * PodiumJS - A WebGPU-based alternative to Curtains.js
 * Main entry point for the library
 */

// Core classes
export { Podium, type PodiumOptions, type RenderObject } from './core/Podium.js';
export { WebGPUContext, type WebGPUContextOptions } from './core/WebGPUContext.js';
export { UniformManager, type UniformData } from './core/UniformManager.js';
export { PostProcessor, type EffectOptions } from './core/PostProcessor.js';

// Geometry
export { Plane, type PlaneOptions, type PlaneGeometry } from './geometry/Plane.js';

// Shaders
export { 
  ShaderManager, 
  type ShaderSource, 
  type PipelineOptions 
} from './shaders/ShaderManager.js';

// Textures
export { 
  TextureManager, 
  type TextureOptions, 
  type VideoTextureOptions 
} from './textures/TextureManager.js';

// Default export
export { Podium as default } from './core/Podium.js';