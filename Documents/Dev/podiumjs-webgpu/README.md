# PodiumJS 🏆

A modern WebGPU-based alternative to Curtains.js for creating interactive planes and stunning visual effects.

## ✨ Features

- **WebGPU-powered**: Leverages the modern WebGPU API for exceptional performance
- **Easy-to-use API**: Simple, intuitive interface similar to Curtains.js
- **Texture Support**: Load images, videos, and create procedural textures
- **Uniform System**: Full support for custom shaders with uniforms
- **Auto-resize**: Automatic canvas resizing with observer support
- **TypeScript**: Full TypeScript support with comprehensive type definitions
- **Modern Architecture**: Clean, modular codebase built for extensibility

## 🚀 Quick Start

### Installation

```bash
npm install podiumjs
```

### Basic Usage

```javascript
import { Podium } from 'podiumjs';

// Create a canvas element
const canvas = document.querySelector('#canvas');

// Initialize PodiumJS
const podium = new Podium({
  canvas: canvas,
  backgroundColor: [0.1, 0.1, 0.2, 1.0],
  autoResize: true
});

// Initialize WebGPU context
await podium.initialize();

// Create a textured plane
await podium.createPlane(
  'myPlane',
  'path/to/image.jpg',
  { width: 2.0, height: 1.0 } // plane options
);

// Start rendering
podium.startRenderLoop();
```

### Advanced Usage with Uniforms

```javascript
// Create a plane with uniform support for animations
await podium.createUniformPlane(
  'animatedPlane',
  'path/to/texture.jpg'
);

// Update transform
podium.setTransform('animatedPlane', {
  position: [0.5, 0.2, 0],
  scale: [1.2, 1.2, 1],
  rotation: [0, 0, 0]
});

// Custom uniform updates (time-based animation is automatic)
podium.updateUniforms('animatedPlane', {
  customValue: 0.5,
  mousePosition: [mouseX, mouseY]
});
```

## 🏗️ API Reference

### Core Classes

#### `Podium`
Main class that orchestrates rendering and scene management.

```typescript
interface PodiumOptions {
  canvas: HTMLCanvasElement;
  powerPreference?: 'low-power' | 'high-performance';
  backgroundColor?: [number, number, number, number];
  autoResize?: boolean;
  alphaMode?: 'opaque' | 'premultiplied';
}
```

**Methods:**
- `initialize(): Promise<boolean>` - Initialize WebGPU context
- `createPlane(id, imageUrl, options?): Promise<RenderObject>` - Create basic textured plane
- `createUniformPlane(id, imageUrl, options?): Promise<RenderObject>` - Create plane with uniform support
- `setTransform(id, transform): boolean` - Update object transform
- `updateUniforms(id, data): boolean` - Update uniform values
- `startRenderLoop(): void` - Start the render loop
- `stopRenderLoop(): void` - Stop the render loop
- `destroy(): void` - Clean up resources

#### `WebGPUContext`
Manages WebGPU device and context initialization.

#### `ShaderManager`
Handles WGSL shader compilation and pipeline management.

#### `TextureManager`
Manages texture loading and GPU resource creation.

#### `UniformManager`
Handles uniform buffer management and matrix operations.

## 🎨 Shader System

PodiumJS uses WGSL (WebGPU Shading Language) for shaders:

### Basic Vertex Shader
```wgsl
struct VertexInput {
  @location(0) position: vec3f,
  @location(1) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 1.0);
  output.uv = input.uv;
  return output;
}
```

### Basic Fragment Shader
```wgsl
@group(0) @binding(0) var mainTexture: texture_2d<f32>;
@group(0) @binding(1) var mainSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return textureSample(mainTexture, mainSampler, uv);
}
```

## 🔧 Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/podiumjs/podiumjs.git
cd podiumjs

# Install dependencies
npm install

# Build the library
npm run build

# Run development server
npm run dev
```

### Project Structure

```
src/
├── core/          # Core classes (Podium, WebGPUContext, UniformManager)
├── geometry/      # Geometry classes (Plane)
├── shaders/       # Shader management
├── textures/      # Texture management
├── utils/         # Utility functions
└── index.ts       # Main entry point

examples/          # Example projects
├── basic.html     # Basic usage example
└── advanced.html  # Advanced features demo
```

## 📋 Requirements

- **WebGPU Support**: Chrome 113+, Firefox Nightly, or Safari Technology Preview
- **Modern Browser**: ES2020 support required
- **HTTPS**: Required for WebGPU in production

### Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 113+ | ✅ Stable |
| Edge | 113+ | ✅ Stable |
| Firefox | Nightly | 🧪 Experimental |
| Safari | TP | 🧪 Experimental |

## 🆚 Comparison with Curtains.js

| Feature | PodiumJS | Curtains.js |
|---------|----------|-------------|
| Graphics API | WebGPU | WebGL |
| Performance | Higher (lower overhead) | Good |
| Shader Language | WGSL | GLSL |
| Memory Management | Explicit | Implicit |
| Browser Support | Modern browsers | Wider support |
| Bundle Size | ~50KB | ~80KB |

## 🔮 Roadmap

- [ ] **Post-processing pipeline** - Built-in effects and filters
- [ ] **Video texture support** - Enhanced video handling
- [ ] **Compute shader support** - GPU computing capabilities  
- [ ] **Animation system** - Timeline-based animations
- [ ] **Physics integration** - Basic physics simulation
- [ ] **Particle system** - GPU-accelerated particles
- [ ] **3D model loading** - GLTF/OBJ support
- [ ] **VR/AR support** - WebXR integration

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Curtains.js](https://www.curtainsjs.com/) by Martin Laxenaire
- WebGPU specification by the W3C GPU for the Web Working Group
- WGSL reference implementation

## 📚 Resources

- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [WGSL Specification](https://www.w3.org/TR/WGSL/)
- [WebGPU Samples](https://webgpu.github.io/webgpu-samples/)
- [Learn WebGPU](https://eliemichel.github.io/LearnWebGPU/)

---

<div align="center">
  <p>Built with ❤️ for the modern web</p>
  <p>
    <a href="https://github.com/podiumjs/podiumjs">GitHub</a> •
    <a href="https://podiumjs.dev">Documentation</a> •
    <a href="https://discord.gg/podiumjs">Discord</a>
  </p>
</div>