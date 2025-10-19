class M {
  constructor(e) {
    this.adapter = null, this.device = null, this.context = null, this.presentationFormat = "bgra8unorm", this.canvas = e.canvas, this.options = e;
  }
  /**
   * Initialize the WebGPU context
   */
  async initialize() {
    try {
      return navigator.gpu ? (this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: this.options.powerPreference || "high-performance",
        forceFallbackAdapter: this.options.forceFallbackAdapter || !1
      }), this.adapter ? (this.device = await this.adapter.requestDevice({
        requiredFeatures: [],
        requiredLimits: {}
      }), this.device ? (this.device.addEventListener("uncapturederror", (e) => {
        console.error("WebGPU uncaptured error:", e.error);
      }), this.context = this.canvas.getContext("webgpu"), this.context ? (this.presentationFormat = navigator.gpu.getPreferredCanvasFormat(), this.context.configure({
        device: this.device,
        format: this.presentationFormat,
        alphaMode: this.options.alphaMode || "opaque",
        colorSpace: this.options.colorSpace || "srgb"
      }), console.log("WebGPU initialized successfully"), !0) : (console.error("Failed to get WebGPU canvas context"), !1)) : (console.error("Failed to get WebGPU device"), !1)) : (console.error("Failed to get WebGPU adapter"), !1)) : (console.error("WebGPU not supported in this browser"), !1);
    } catch (e) {
      return console.error("Error initializing WebGPU:", e), !1;
    }
  }
  /**
   * Resize the canvas and update the context
   */
  resize(e, t) {
    (this.canvas.width !== e || this.canvas.height !== t) && (this.canvas.width = e, this.canvas.height = t, this.context && this.device && this.context.configure({
      device: this.device,
      format: this.presentationFormat,
      alphaMode: this.options.alphaMode || "opaque",
      colorSpace: this.options.colorSpace || "srgb"
    }));
  }
  /**
   * Get the current texture view for rendering
   */
  getCurrentTextureView() {
    if (!this.context) return null;
    try {
      return this.context.getCurrentTexture().createView();
    } catch (e) {
      return console.warn("Failed to get current texture view:", e), null;
    }
  }
  /**
   * Check if WebGPU is supported
   */
  static isSupported() {
    return "gpu" in navigator;
  }
  /**
   * Get device information
   */
  getDeviceInfo() {
    var e, t, r, n;
    return this.adapter ? {
      vendor: (e = this.adapter.info) == null ? void 0 : e.vendor,
      architecture: (t = this.adapter.info) == null ? void 0 : t.architecture,
      device: (r = this.adapter.info) == null ? void 0 : r.device,
      description: (n = this.adapter.info) == null ? void 0 : n.description
    } : null;
  }
  /**
   * Cleanup resources
   */
  destroy() {
    this.device && (this.device.destroy(), this.device = null), this.adapter = null, this.context = null;
  }
}
class T {
  constructor(e) {
    this.shaderModules = /* @__PURE__ */ new Map(), this.pipelines = /* @__PURE__ */ new Map(), this.bindGroupLayouts = /* @__PURE__ */ new Map(), this.context = e;
  }
  /**
   * Create a shader module from WGSL source
   */
  createShaderModule(e, t) {
    if (!this.context.device)
      return console.error("WebGPU device not available"), null;
    try {
      const r = this.context.device.createShaderModule({
        label: e,
        code: t
      });
      return r.getCompilationInfo().then((n) => {
        n.messages.length > 0 && (console.warn(`Shader compilation messages for "${e}":`), n.messages.forEach((i) => {
          console.warn(`  ${i.type}: ${i.message}`), i.lineNum !== void 0 && console.warn(`    Line ${i.lineNum}: ${i.linePos}`);
        }));
      }), this.shaderModules.set(e, r), r;
    } catch (r) {
      return console.error(`Error creating shader module "${e}":`, r), null;
    }
  }
  /**
   * Create a render pipeline
   */
  async createPipeline(e, t, r) {
    var n, i;
    if (!this.context.device)
      return console.error("WebGPU device not available"), null;
    try {
      const o = this.createShaderModule(`${e}_vertex`, t.vertex), s = this.createShaderModule(`${e}_fragment`, t.fragment);
      if (!o || !s)
        return console.error(`Failed to create shader modules for pipeline "${e}"`), null;
      const [a, u] = await Promise.all([
        o.getCompilationInfo(),
        s.getCompilationInfo()
      ]), p = (h, d) => h.messages.length > 0 ? (console.error(`${d} shader compilation issues for "${e}":`), h.messages.forEach((f) => {
        console.error(`  ${f.type}: ${f.message}`), f.lineNum && console.error(`    Line ${f.lineNum}:${f.linePos}`);
      }), h.messages.some((f) => f.type === "error")) : !1;
      if (p(a, "Vertex") || p(u, "Fragment"))
        return null;
      let c = r.bindGroupLayouts;
      if (!c || c.length === 0) {
        console.log(`Creating default bind group layout for pipeline "${e}"`);
        const h = this.createDefaultBindGroupLayout();
        if (h)
          c = [h], console.log("Default bind group layout created successfully");
        else
          return console.error(`Failed to create default bind group layout for pipeline "${e}"`), null;
      }
      const g = this.context.device.createPipelineLayout({
        label: `${e}_layout`,
        bindGroupLayouts: c || []
      }), l = {
        label: e,
        layout: g,
        vertex: {
          module: o,
          entryPoint: "vs_main",
          buffers: r.vertexBufferLayouts
        },
        fragment: {
          module: s,
          entryPoint: "fs_main",
          targets: [
            {
              format: this.context.presentationFormat,
              blend: r.blendMode
            }
          ]
        },
        primitive: {
          topology: r.topology || "triangle-list",
          cullMode: r.cullMode || "none",
          frontFace: r.frontFace || "ccw"
        }
      };
      r.depthTest && (l.depthStencil = {
        format: "depth24plus",
        depthWriteEnabled: r.depthWrite ?? !0,
        depthCompare: r.depthCompare || "less"
      }), console.log(`Creating render pipeline "${e}" with descriptor:`, {
        vertex: { entryPoint: l.vertex.entryPoint, buffers: l.vertex.buffers ? Array.from(l.vertex.buffers).length : 0 },
        fragment: { entryPoint: (n = l.fragment) == null ? void 0 : n.entryPoint, targets: (i = l.fragment) != null && i.targets ? Array.from(l.fragment.targets).length : 0 },
        primitive: l.primitive
      });
      const m = this.context.device.createRenderPipeline(l);
      return m ? (console.log(`Render pipeline "${e}" created successfully`), this.pipelines.set(e, m), m) : (console.error(`Failed to create render pipeline "${e}"`), null);
    } catch (o) {
      return console.error(`Error creating pipeline "${e}":`, o), null;
    }
  }
  /**
   * Create a default bind group layout for basic texture + sampler
   */
  createDefaultBindGroupLayout() {
    if (!this.context.device) return null;
    const e = this.context.device.createBindGroupLayout({
      label: "default_bind_group_layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "2d"
          }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {}
        }
      ]
    });
    return this.bindGroupLayouts.set("default", e), e;
  }
  /**
   * Create a custom bind group layout
   */
  createBindGroupLayout(e, t) {
    if (!this.context.device) return null;
    try {
      const r = this.context.device.createBindGroupLayout({
        label: e,
        entries: t
      });
      return this.bindGroupLayouts.set(e, r), r;
    } catch (r) {
      return console.error(`Error creating bind group layout "${e}":`, r), null;
    }
  }
  /**
   * Get a cached pipeline
   */
  getPipeline(e) {
    return this.pipelines.get(e) || null;
  }
  /**
   * Get a cached bind group layout
   */
  getBindGroupLayout(e) {
    return this.bindGroupLayouts.get(e) || null;
  }
  /**
   * Get a cached shader module
   */
  getShaderModule(e) {
    return this.shaderModules.get(e) || null;
  }
  /**
   * Default basic shader for textured planes
   */
  static getBasicTextureShader() {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,
      fragment: `
@group(0) @binding(0) var mainTexture: texture_2d<f32>;
@group(0) @binding(1) var mainSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  return textureSample(mainTexture, mainSampler, uv);
}`
    };
  }
  /**
   * Shader with uniform support (MVP matrix, time, etc.)
   */
  static getUniformShader() {
    return {
      vertex: `
struct Uniforms {
  mvpMatrix: mat4x4<f32>,
  time: f32,
  padding: vec3<f32>,
};

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,
      fragment: `
struct Uniforms {
  mvpMatrix: mat4x4<f32>,
  time: f32,
  padding: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var mainTexture: texture_2d<f32>;
@group(0) @binding(2) var mainSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  // Simple time-based effect
  let offset = vec2<f32>(sin(uniforms.time) * 0.01, 0.0);
  return textureSample(mainTexture, mainSampler, uv + offset);
}`
    };
  }
  /**
   * Create uniform bind group layout
   */
  createUniformBindGroupLayout() {
    return this.context.device ? this.createBindGroupLayout("uniform_layout", [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {
          type: "uniform"
        }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          sampleType: "float",
          viewDimension: "2d"
        }
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {}
      }
    ]) : null;
  }
  /**
   * Cleanup resources
   */
  destroy() {
    this.shaderModules.clear(), this.pipelines.clear(), this.bindGroupLayouts.clear();
  }
}
class U {
  constructor(e) {
    this.textures = /* @__PURE__ */ new Map(), this.samplers = /* @__PURE__ */ new Map(), this.imageCache = /* @__PURE__ */ new Map(), this.videoCache = /* @__PURE__ */ new Map(), this.context = e;
  }
  /**
   * Load texture from image URL
   */
  async loadImageTexture(e, t = {}) {
    if (!this.context.device)
      return console.error("WebGPU device not available"), null;
    try {
      let r = this.imageCache.get(e);
      r || (r = new Image(), e.startsWith("data:") || (r.crossOrigin = "anonymous"), await new Promise((i, o) => {
        r.onload = () => i(), r.onerror = o, r.src = e;
      }), this.imageCache.set(e, r));
      const n = this.createTextureFromImage(r, t);
      return n && this.textures.set(e, n), n;
    } catch (r) {
      return console.error(`Error loading image texture from "${e}":`, r), null;
    }
  }
  /**
   * Load texture from video element or URL
   */
  async loadVideoTexture(e, t = {}) {
    if (!this.context.device)
      return console.error("WebGPU device not available"), null;
    try {
      let r, n;
      if (typeof e == "string") {
        n = e;
        let o = this.videoCache.get(e);
        o || (o = document.createElement("video"), o.src = e, o.crossOrigin = "anonymous", o.loop = t.loop ?? !1, o.muted = t.muted ?? !0, t.autoplay && (o.autoplay = !0), await new Promise((s, a) => {
          o.oncanplay = () => s(), o.onerror = a, o.load();
        }), this.videoCache.set(e, o)), r = o;
      } else
        r = e, n = `video_${Date.now()}`;
      const i = this.createTextureFromVideo(r, t);
      return i && this.textures.set(n, i), i;
    } catch (r) {
      return console.error("Error loading video texture:", r), null;
    }
  }
  /**
   * Create texture from image data
   */
  createTextureFromImage(e, t = {}) {
    if (!this.context.device) return null;
    try {
      const r = this.context.device.createTexture({
        label: t.label || "image_texture",
        size: [e.width, e.height, 1],
        format: t.format || "rgba8unorm",
        usage: t.usage || GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        mipLevelCount: t.generateMips ? Math.floor(Math.log2(Math.max(e.width, e.height))) + 1 : 1
      });
      return this.context.device.queue.copyExternalImageToTexture(
        {
          source: e,
          flipY: t.flipY || !1
        },
        { texture: r },
        [e.width, e.height]
      ), t.generateMips && this.generateMipmaps(r, e.width, e.height), r;
    } catch (r) {
      return console.error("Error creating texture from image:", r), null;
    }
  }
  /**
   * Create texture from video element
   */
  createTextureFromVideo(e, t = {}) {
    if (!this.context.device) return null;
    try {
      const r = this.context.device.createTexture({
        label: t.label || "video_texture",
        size: [e.videoWidth, e.videoHeight, 1],
        format: t.format || "rgba8unorm",
        usage: t.usage || GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
      });
      return this.updateVideoTexture(e, r), r;
    } catch (r) {
      return console.error("Error creating texture from video:", r), null;
    }
  }
  /**
   * Update video texture (call this in your render loop for video textures)
   */
  updateVideoTexture(e, t) {
    if (this.context.device)
      try {
        this.context.device.queue.copyExternalImageToTexture(
          { source: e },
          { texture: t },
          [e.videoWidth, e.videoHeight]
        );
      } catch (r) {
        console.error("Error updating video texture:", r);
      }
  }
  /**
   * Create a sampler
   */
  createSampler(e, t = {}) {
    if (!this.context.device) return null;
    try {
      const r = this.context.device.createSampler({
        label: e,
        addressModeU: t.wrapS || "repeat",
        addressModeV: t.wrapT || "repeat",
        magFilter: t.magFilter || "linear",
        minFilter: t.minFilter || "linear"
      });
      return this.samplers.set(e, r), r;
    } catch (r) {
      return console.error(`Error creating sampler "${e}":`, r), null;
    }
  }
  /**
   * Create a bind group for texture and sampler
   */
  createTextureBindGroup(e, t, r, n) {
    if (!this.context.device) return null;
    try {
      const i = r || this.getOrCreateDefaultSampler();
      return this.context.device.createBindGroup({
        label: n,
        layout: e,
        entries: [
          {
            binding: 0,
            resource: t.createView()
          },
          {
            binding: 1,
            resource: i
          }
        ]
      });
    } catch (i) {
      return console.error("Error creating texture bind group:", i), null;
    }
  }
  /**
   * Get or create default sampler
   */
  getOrCreateDefaultSampler() {
    let e = this.samplers.get("default");
    if (!e && (e = this.createSampler("default", {
      wrapS: "repeat",
      wrapT: "repeat",
      magFilter: "linear",
      minFilter: "linear"
    }) || void 0, !e))
      throw new Error("Failed to create default sampler");
    return e;
  }
  /**
   * Generate mipmaps for a texture (simplified version)
   */
  generateMipmaps(e, t, r) {
    console.log(`Mipmaps requested for texture ${t}x${r} (not fully implemented)`);
  }
  /**
   * Create a render target texture
   */
  createRenderTarget(e, t, r, n) {
    if (!this.context.device) return null;
    try {
      return this.context.device.createTexture({
        label: n || "render_target",
        size: [e, t, 1],
        format: r || this.context.presentationFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
    } catch (i) {
      return console.error("Error creating render target:", i), null;
    }
  }
  /**
   * Get cached texture
   */
  getTexture(e) {
    return this.textures.get(e) || null;
  }
  /**
   * Get cached sampler
   */
  getSampler(e) {
    return this.samplers.get(e) || null;
  }
  /**
   * Get cached image
   */
  getImage(e) {
    return this.imageCache.get(e) || null;
  }
  /**
   * Get cached video
   */
  getVideo(e) {
    return this.videoCache.get(e) || null;
  }
  /**
   * Cleanup resources
   */
  destroy() {
    this.textures.forEach((e) => e.destroy()), this.textures.clear(), this.samplers.clear(), this.imageCache.clear(), this.videoCache.clear();
  }
}
class v {
  constructor(e) {
    this.uniformBuffers = /* @__PURE__ */ new Map(), this.bindGroups = /* @__PURE__ */ new Map(), this.uniformLayouts = /* @__PURE__ */ new Map(), this.context = e;
  }
  /**
   * Create a uniform buffer
   */
  createUniformBuffer(e, t, r) {
    if (!this.context.device)
      return console.error("WebGPU device not available"), null;
    try {
      const n = Math.max(Math.ceil(t / 256) * 256, 256), i = this.context.device.createBuffer({
        label: e,
        size: n,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        mappedAtCreation: !!r
      });
      return r && (new Uint8Array(i.getMappedRange()).set(new Uint8Array(r)), i.unmap()), this.uniformBuffers.set(e, i), i;
    } catch (n) {
      return console.error(`Error creating uniform buffer "${e}":`, n), null;
    }
  }
  /**
   * Update uniform buffer with new data
   */
  updateUniformBuffer(e, t, r = 0) {
    const n = this.uniformBuffers.get(e);
    if (!n || !this.context.device)
      return console.error(`Uniform buffer "${e}" not found`), !1;
    try {
      const i = this.serializeUniformData(t);
      return this.context.device.queue.writeBuffer(n, r, i), !0;
    } catch (i) {
      return console.error(`Error updating uniform buffer "${e}":`, i), !1;
    }
  }
  /**
   * Serialize uniform data to buffer format
   * WebGPU has strict alignment requirements:
   * - mat4x4: 64 bytes, 16-byte aligned
   * - f32: 4 bytes, 4-byte aligned
   * - vec3: 12 bytes, 16-byte aligned (padding to vec4)
   */
  serializeUniformData(e) {
    const t = new ArrayBuffer(96), r = new Float32Array(t);
    if (e.mvpMatrix && e.mvpMatrix instanceof Float32Array)
      r.set(e.mvpMatrix, 0);
    else {
      const n = v.createIdentityMatrix();
      r.set(n, 0);
    }
    return typeof e.time == "number" && (r[16] = e.time), t;
  }
  /**
   * Create a standard uniform layout for basic rendering
   */
  createStandardUniformLayout() {
    if (!this.context.device) return null;
    const e = this.context.device.createBindGroupLayout({
      label: "standard_uniform_layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: "uniform"
          }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "2d"
          }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {}
        }
      ]
    });
    return this.uniformLayouts.set("standard", e), e;
  }
  /**
   * Create a bind group combining uniform buffer, texture, and sampler
   */
  createUniformBindGroup(e, t, r, n, i) {
    if (!this.context.device) return null;
    try {
      const o = [
        {
          binding: 0,
          resource: {
            buffer: r
          }
        }
      ];
      n && o.push({
        binding: 1,
        resource: n.createView()
      }), i && o.push({
        binding: 2,
        resource: i
      });
      const s = this.context.device.createBindGroup({
        label: e,
        layout: t,
        entries: o
      });
      return this.bindGroups.set(e, s), s;
    } catch (o) {
      return console.error(`Error creating bind group "${e}":`, o), null;
    }
  }
  /**
   * Create identity matrix
   */
  static createIdentityMatrix() {
    return new Float32Array([
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ]);
  }
  /**
   * Create orthographic projection matrix
   */
  static createOrthographicMatrix(e, t, r, n, i = -1, o = 1) {
    const s = t - e, a = n - r, u = o - i;
    return new Float32Array([
      2 / s,
      0,
      0,
      0,
      0,
      2 / a,
      0,
      0,
      0,
      0,
      -2 / u,
      0,
      -(t + e) / s,
      -(n + r) / a,
      -(o + i) / u,
      1
    ]);
  }
  /**
   * Create perspective projection matrix
   */
  static createPerspectiveMatrix(e, t, r, n) {
    const i = 1 / Math.tan(e / 2), o = 1 / (r - n);
    return new Float32Array([
      i / t,
      0,
      0,
      0,
      0,
      i,
      0,
      0,
      0,
      0,
      (n + r) * o,
      -1,
      0,
      0,
      2 * n * r * o,
      0
    ]);
  }
  /**
   * Create translation matrix
   */
  static createTranslationMatrix(e, t, r = 0) {
    return new Float32Array([
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      e,
      t,
      r,
      1
    ]);
  }
  /**
   * Create scale matrix
   */
  static createScaleMatrix(e, t, r = 1) {
    return new Float32Array([
      e,
      0,
      0,
      0,
      0,
      t,
      0,
      0,
      0,
      0,
      r,
      0,
      0,
      0,
      0,
      1
    ]);
  }
  /**
   * Multiply two 4x4 matrices
   */
  static multiplyMatrices(e, t) {
    const r = new Float32Array(16);
    for (let n = 0; n < 4; n++)
      for (let i = 0; i < 4; i++)
        r[n * 4 + i] = e[n * 4 + 0] * t[0 * 4 + i] + e[n * 4 + 1] * t[1 * 4 + i] + e[n * 4 + 2] * t[2 * 4 + i] + e[n * 4 + 3] * t[3 * 4 + i];
    return r;
  }
  /**
   * Get a cached uniform buffer
   */
  getUniformBuffer(e) {
    return this.uniformBuffers.get(e) || null;
  }
  /**
   * Get a cached bind group
   */
  getBindGroup(e) {
    return this.bindGroups.get(e) || null;
  }
  /**
   * Get a cached uniform layout
   */
  getUniformLayout(e) {
    return this.uniformLayouts.get(e) || null;
  }
  /**
   * Cleanup resources
   */
  destroy() {
    this.uniformBuffers.forEach((e) => e.destroy()), this.uniformBuffers.clear(), this.bindGroups.clear(), this.uniformLayouts.clear();
  }
}
class w {
  constructor(e, t = {}) {
    this.vertexBuffer = null, this.indexBuffer = null, this.context = e, this.options = {
      width: t.width ?? 2,
      height: t.height ?? 2,
      widthSegments: t.widthSegments ?? 1,
      heightSegments: t.heightSegments ?? 1
    }, this.geometry = this.createGeometry(), this.vertexCount = this.geometry.positions.length / 3, this.indexCount = this.geometry.indices.length, this.createBuffers();
  }
  /**
   * Create the plane geometry data
   */
  createGeometry() {
    const { width: e, height: t, widthSegments: r, heightSegments: n } = this.options, i = e / 2, o = t / 2, s = r, a = n, u = s + 1, p = a + 1, c = e / s, g = t / a, l = [], m = [], h = [];
    for (let d = 0; d < p; d++) {
      const f = d * g - o;
      for (let b = 0; b < u; b++) {
        const S = b * c - i;
        l.push(S, f, 0), m.push(b / s, 1 - d / a);
      }
    }
    for (let d = 0; d < a; d++)
      for (let f = 0; f < s; f++) {
        const b = f + u * d, S = f + u * (d + 1), G = f + 1 + u * (d + 1), P = f + 1 + u * d;
        h.push(b, S, P), h.push(S, G, P);
      }
    return {
      positions: new Float32Array(l),
      uvs: new Float32Array(m),
      indices: new Uint16Array(h)
    };
  }
  /**
   * Create WebGPU buffers for the geometry
   */
  createBuffers() {
    if (!this.context.device) {
      console.error("WebGPU device not available");
      return;
    }
    const e = new Float32Array(this.vertexCount * 5);
    for (let t = 0; t < this.vertexCount; t++) {
      const r = t * 3, n = t * 2, i = t * 5;
      e[i] = this.geometry.positions[r], e[i + 1] = this.geometry.positions[r + 1], e[i + 2] = this.geometry.positions[r + 2], e[i + 3] = this.geometry.uvs[n], e[i + 4] = this.geometry.uvs[n + 1];
    }
    this.vertexBuffer = this.context.device.createBuffer({
      size: e.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: !0
    }), new Float32Array(this.vertexBuffer.getMappedRange()).set(e), this.vertexBuffer.unmap(), this.indexBuffer = this.context.device.createBuffer({
      size: this.geometry.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: !0
    }), new Uint16Array(this.indexBuffer.getMappedRange()).set(this.geometry.indices), this.indexBuffer.unmap();
  }
  /**
   * Get vertex buffer layout for pipeline creation
   */
  getVertexBufferLayout() {
    return {
      arrayStride: 5 * 4,
      // 5 floats * 4 bytes each
      attributes: [
        {
          shaderLocation: 0,
          // position
          offset: 0,
          format: "float32x3"
        },
        {
          shaderLocation: 1,
          // uv
          offset: 3 * 4,
          format: "float32x2"
        }
      ]
    };
  }
  /**
   * Bind buffers for rendering
   */
  bind(e) {
    this.vertexBuffer && this.indexBuffer && (e.setVertexBuffer(0, this.vertexBuffer), e.setIndexBuffer(this.indexBuffer, "uint16"));
  }
  /**
   * Draw the plane
   */
  draw(e) {
    e.drawIndexed(this.indexCount);
  }
  /**
   * Update plane geometry (recreates buffers)
   */
  updateGeometry(e) {
    Object.assign(this.options, e), this.geometry = this.createGeometry(), this.vertexCount = this.geometry.positions.length / 3, this.indexCount = this.geometry.indices.length, this.destroy(), this.createBuffers();
  }
  /**
   * Cleanup resources
   */
  destroy() {
    this.vertexBuffer && (this.vertexBuffer.destroy(), this.vertexBuffer = null), this.indexBuffer && (this.indexBuffer.destroy(), this.indexBuffer = null);
  }
}
class x {
  constructor(e, t, r, n) {
    this.renderTarget = null, this.depthTexture = null, this.tempTargets = [], this.passes = /* @__PURE__ */ new Map(), this.fullscreenQuad = null, this.width = 0, this.height = 0, this.context = e, this.shaderManager = t, this.textureManager = r, this.uniformManager = n;
  }
  /**
   * Initialize post-processing system
   */
  async initialize(e, t) {
    if (!this.context.device)
      return console.error("WebGPU device not available"), !1;
    console.log(`🎬 Initializing PostProcessor with size ${e}x${t}`), this.width = e, this.height = t, console.log("📦 Creating render targets..."), this.createRenderTargets(), console.log("✅ Render targets created successfully"), console.log("🔧 Ensuring default sampler exists...");
    let r = this.textureManager.getSampler("default");
    return !r && (r = this.textureManager.createSampler("default", {
      wrapS: "repeat",
      wrapT: "repeat",
      magFilter: "linear",
      minFilter: "linear"
    }), !r) ? (console.error("❌ Failed to create default sampler"), !1) : (console.log("✅ Default sampler ready"), console.log("🔲 Creating fullscreen quad..."), this.fullscreenQuad = new w(this.context, {
      width: 2,
      height: 2,
      widthSegments: 1,
      heightSegments: 1
    }), console.log("✅ Fullscreen quad created successfully"), console.log("🎨 Initializing built-in effects..."), await this.initializeBuiltInEffects(), console.log("✅ Built-in effects initialized successfully"), !0);
  }
  /**
   * Create render targets for post-processing
   */
  createRenderTargets() {
    if (this.context.device) {
      this.renderTarget = this.context.device.createTexture({
        label: "main_render_target",
        size: [this.width, this.height, 1],
        format: this.context.presentationFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      }), this.depthTexture = this.context.device.createTexture({
        label: "depth_texture",
        size: [this.width, this.height, 1],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
      for (let e = 0; e < 2; e++) {
        const t = this.context.device.createTexture({
          label: `temp_render_target_${e}`,
          size: [this.width, this.height, 1],
          format: this.context.presentationFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.tempTargets.push(t);
      }
    }
  }
  /**
   * Initialize built-in post-processing effects
   */
  async initializeBuiltInEffects() {
    console.log("🎬 Initializing built-in post-processing effects...");
    const e = await this.addEffect("blur", x.getBlurShader(), { intensity: 1, radius: 2 });
    console.log(`🌀 Blur effect: ${e ? "SUCCESS" : "FAILED"}`);
    const t = await this.addEffect("bloom", x.getBloomShader(), { intensity: 0.8, threshold: 0.7 });
    console.log(`✨ Bloom effect: ${t ? "SUCCESS" : "FAILED"}`);
    const r = await this.addEffect("colorCorrection", x.getColorCorrectionShader(), {
      brightness: 0,
      contrast: 1,
      saturation: 1,
      hue: 0
    });
    console.log(`🎨 Color correction effect: ${r ? "SUCCESS" : "FAILED"}`);
    const n = await this.addEffect("vignette", x.getVignetteShader(), { intensity: 0.5, radius: 0.8 });
    console.log(`🕳️ Vignette effect: ${n ? "SUCCESS" : "FAILED"}`);
    const i = await this.addEffect("filmGrain", x.getFilmGrainShader(), { intensity: 0.1, time: 0 });
    console.log(`📺 Film grain effect: ${i ? "SUCCESS" : "FAILED"}`);
    const o = this.passes.size;
    console.log(`🎯 Post-processing initialization complete. ${o} effects loaded.`);
  }
  /**
   * Add a post-processing effect
   */
  async addEffect(e, t, r = {}) {
    if (!this.context.device || !this.fullscreenQuad)
      return console.error(`⚠️ Cannot add effect "${e}": missing device or fullscreen quad`), !1;
    console.log(`🔧 Adding post-processing effect "${e}"...`);
    try {
      console.log(`📊 Creating uniform buffer for "${e}"...`);
      const n = this.uniformManager.createUniformBuffer(`${e}_uniforms`, 256);
      if (!n)
        return console.error(`❌ Failed to create uniform buffer for "${e}"`), !1;
      console.log(`🔄 Updating initial uniforms for "${e}"...`), this.updateEffectUniforms(e, r), console.log(`📐 Creating bind group layout for "${e}"...`);
      const i = this.createPostProcessBindGroupLayout();
      if (!i)
        return console.error(`❌ Failed to create bind group layout for "${e}"`), !1;
      console.log(`⚙️ Creating pipeline for "${e}"...`);
      const o = await this.shaderManager.createPipeline(`${e}_postprocess`, t, {
        vertexBufferLayouts: [this.fullscreenQuad.getVertexBufferLayout()],
        bindGroupLayouts: [i]
      });
      if (!o)
        return console.error(`❌ Failed to create pipeline for "${e}"`), !1;
      console.log(`🔗 Creating bind group for "${e}"...`);
      const s = this.textureManager.getSampler("default");
      if (!s)
        return console.error(`❌ Default sampler not found for effect "${e}"`), !1;
      const a = this.createPostProcessBindGroup(
        i,
        n,
        this.renderTarget,
        // Will be updated during rendering
        s
      );
      if (!a)
        return console.error(`❌ Failed to create bind group for "${e}"`), !1;
      const u = {
        id: e,
        shader: t,
        pipeline: o,
        bindGroup: a,
        uniformBuffer: n,
        enabled: !1,
        // Disabled by default
        options: r
      };
      return this.passes.set(e, u), console.log(`✅ Successfully added effect "${e}"`), !0;
    } catch (n) {
      return console.error(`💥 Error adding post-process effect "${e}":`, n), !1;
    }
  }
  /**
   * Create bind group layout for post-processing
   */
  createPostProcessBindGroupLayout() {
    return this.context.device ? this.context.device.createBindGroupLayout({
      label: "postprocess_bind_group_layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: "uniform"
          }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "2d"
          }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {}
        }
      ]
    }) : null;
  }
  /**
   * Create bind group for post-processing pass
   */
  createPostProcessBindGroup(e, t, r, n) {
    return this.context.device ? this.context.device.createBindGroup({
      label: "postprocess_bind_group",
      layout: e,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: t
          }
        },
        {
          binding: 1,
          resource: r.createView()
        },
        {
          binding: 2,
          resource: n
        }
      ]
    }) : null;
  }
  /**
   * Update effect uniform parameters
   */
  updateEffectUniforms(e, t) {
    const r = {
      resolution: [this.width, this.height],
      time: performance.now() * 1e-3,
      ...t
    };
    return this.uniformManager.updateUniformBuffer(`${e}_uniforms`, r);
  }
  /**
   * Enable/disable an effect
   */
  setEffectEnabled(e, t) {
    const r = this.passes.get(e);
    return r ? (console.log(`${t ? "🟢" : "🔴"} ${t ? "Enabling" : "Disabling"} effect "${e}"`), r.enabled = t, !0) : (console.warn(`❌ Effect "${e}" not found for enable/disable`), !1);
  }
  /**
   * Update effect options
   */
  updateEffect(e, t) {
    const r = this.passes.get(e);
    if (!r)
      return console.warn(`❌ Effect "${e}" not found for update`), !1;
    console.log(`🔧 Updating effect "${e}" with options:`, t), Object.assign(r.options, t);
    const n = this.updateEffectUniforms(e, r.options);
    return console.log(`💫 Effect uniform update for "${e}": ${n ? "SUCCESS" : "FAILED"}`), !0;
  }
  /**
   * Begin render pass to render target
   */
  beginRenderToTexture(e) {
    const t = {
      label: "scene_render_pass",
      colorAttachments: [
        {
          view: this.renderTarget.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store"
        }
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store"
      }
    };
    return e.beginRenderPass(t);
  }
  /**
   * Apply post-processing effects
   */
  async applyPostProcessing(e, t, r = 0) {
    if (!this.fullscreenQuad) return;
    const n = Array.from(this.passes.values()).filter((s) => s.enabled);
    if (n.length === 0) {
      await this.copyToFinalTarget(e, this.renderTarget, t);
      return;
    }
    let i = this.renderTarget, o;
    for (let s = 0; s < n.length; s++) {
      const a = n[s];
      if (s === n.length - 1) {
        const p = {
          label: `postprocess_final_${a.id}`,
          colorAttachments: [
            {
              view: t,
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: "clear",
              storeOp: "store"
            }
          ]
        }, c = e.beginRenderPass(p);
        this.renderPostProcessPass(c, a, i, r), c.end();
      } else {
        o = this.tempTargets[s % this.tempTargets.length];
        const p = {
          label: `postprocess_${a.id}`,
          colorAttachments: [
            {
              view: o.createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: "clear",
              storeOp: "store"
            }
          ]
        }, c = e.beginRenderPass(p);
        this.renderPostProcessPass(c, a, i, r), c.end(), i = o;
      }
    }
  }
  /**
   * Render a single post-processing pass
   */
  renderPostProcessPass(e, t, r, n) {
    if (!this.fullscreenQuad) return;
    this.updateEffectUniforms(t.id, { ...t.options, time: n });
    const i = this.createPostProcessBindGroupLayout();
    if (!i) return;
    const o = this.textureManager.getSampler("default");
    if (!o) {
      console.error("Default sampler not found during render pass");
      return;
    }
    const s = this.createPostProcessBindGroup(
      i,
      t.uniformBuffer,
      r,
      o
    );
    s && (e.setPipeline(t.pipeline), e.setBindGroup(0, s), this.fullscreenQuad.bind(e), this.fullscreenQuad.draw(e));
  }
  /**
   * Copy render target to final target (no post-processing)
   */
  async copyToFinalTarget(e, t, r) {
    const n = {
      label: "copy_to_final",
      colorAttachments: [
        {
          view: r,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    }, i = e.beginRenderPass(n), o = x.getCopyShader(), s = this.context.device.createBindGroupLayout({
      label: "copy_bind_group_layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "2d"
          }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {}
        }
      ]
    }), a = this.shaderManager.getPipeline("copy_shader") || await this.shaderManager.createPipeline("copy_shader", o, {
      vertexBufferLayouts: [this.fullscreenQuad.getVertexBufferLayout()],
      bindGroupLayouts: [s]
    });
    if (a && this.fullscreenQuad) {
      const u = this.context.device.createBindGroup({
        label: "copy_bind_group",
        layout: s,
        entries: [
          {
            binding: 0,
            resource: t.createView()
          },
          {
            binding: 1,
            resource: this.textureManager.getSampler("default") || this.textureManager.createSampler("copy_sampler")
          }
        ]
      });
      u && (i.setPipeline(a), i.setBindGroup(0, u), this.fullscreenQuad.bind(i), this.fullscreenQuad.draw(i));
    }
    i.end();
  }
  /**
   * Resize post-processing buffers
   */
  resize(e, t) {
    var r, n;
    this.width === e && this.height === t || (this.width = e, this.height = t, (r = this.renderTarget) == null || r.destroy(), (n = this.depthTexture) == null || n.destroy(), this.tempTargets.forEach((i) => i.destroy()), this.tempTargets = [], this.createRenderTargets());
  }
  /**
   * Get render target for scene rendering
   */
  getRenderTarget() {
    return this.renderTarget;
  }
  /**
   * Get depth texture
   */
  getDepthTexture() {
    return this.depthTexture;
  }
  // Built-in shader effects
  static getCopyShader() {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,
      fragment: `
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  return textureSample(inputTexture, inputSampler, uv);
}`
    };
  }
  static getBlurShader() {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,
      fragment: `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  intensity: f32,
  radius: f32,
  padding: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let texelSize = 1.0 / uniforms.resolution;
  let blurRadius = max(0.1, uniforms.radius * uniforms.intensity);
  
  var color = vec4<f32>(0.0);
  var totalWeight = 0.0;
  
  // Use smaller kernel to avoid artifacts
  let kernelSize = 3;
  let offset = kernelSize / 2;
  
  for (var x = -offset; x <= offset; x++) {
    for (var y = -offset; y <= offset; y++) {
      let sampleOffset = vec2<f32>(f32(x), f32(y)) * texelSize * blurRadius;
      let dist = length(vec2<f32>(f32(x), f32(y)));
      let weight = exp(-dist * dist / (2.0 * blurRadius * blurRadius));
      
      let sampleColor = textureSample(inputTexture, inputSampler, uv + sampleOffset);
      color += sampleColor * weight;
      totalWeight += weight;
    }
  }
  
  // Ensure we don't divide by zero
  if (totalWeight > 0.0) {
    return color / totalWeight;
  } else {
    return textureSample(inputTexture, inputSampler, uv);
  }
}`
    };
  }
  static getBloomShader() {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,
      fragment: `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  intensity: f32,
  threshold: f32,
  padding: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let original = textureSample(inputTexture, inputSampler, uv);
  
  // Extract bright areas with more aggressive threshold
  let brightness = dot(original.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let bright = select(vec3<f32>(0.0), original.rgb, brightness > uniforms.threshold);
  
  // Create bloom with blur approximation
  let texelSize = 1.0 / uniforms.resolution;
  var bloomColor = vec3<f32>(0.0);
  let samples = 5;
  let offset = f32(samples) / 2.0;
  
  for (var x = 0; x < samples; x++) {
    for (var y = 0; y < samples; y++) {
      let sampleUV = uv + vec2<f32>(f32(x) - offset, f32(y) - offset) * texelSize * 2.0;
      let sample = textureSample(inputTexture, inputSampler, sampleUV);
      let sampleBrightness = dot(sample.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
      let sampleBright = select(vec3<f32>(0.0), sample.rgb, sampleBrightness > uniforms.threshold);
      bloomColor += sampleBright;
    }
  }
  
  bloomColor = bloomColor / f32(samples * samples);
  let bloom = bloomColor * uniforms.intensity * 2.0; // Amplify effect
  
  return vec4<f32>(original.rgb + bloom, original.a);
}`
    };
  }
  static getColorCorrectionShader() {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,
      fragment: `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  brightness: f32,
  contrast: f32,
  saturation: f32,
  hue: f32,
  padding: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let originalColor = textureSample(inputTexture, inputSampler, uv);
  var rgb = originalColor.rgb;
  
  // Clamp initial color to prevent issues
  rgb = clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));
  
  // Brightness adjustment
  rgb = rgb + vec3<f32>(uniforms.brightness);
  
  // Contrast adjustment
  rgb = (rgb - vec3<f32>(0.5)) * uniforms.contrast + vec3<f32>(0.5);
  
  // Saturation adjustment
  let luminance = dot(rgb, vec3<f32>(0.299, 0.587, 0.114));
  rgb = mix(vec3<f32>(luminance), rgb, uniforms.saturation);
  
  // Simple hue shift using HSV conversion (simplified)
  if (abs(uniforms.hue) > 0.001) {
    // Convert to HSV for hue adjustment
    let maxVal = max(max(rgb.r, rgb.g), rgb.b);
    let minVal = min(min(rgb.r, rgb.g), rgb.b);
    let delta = maxVal - minVal;
    
    if (delta > 0.001) {
      var hue = 0.0;
      if (maxVal == rgb.r) {
        hue = ((rgb.g - rgb.b) / delta) * 60.0;
      } else if (maxVal == rgb.g) {
        hue = (2.0 + (rgb.b - rgb.r) / delta) * 60.0;
      } else {
        hue = (4.0 + (rgb.r - rgb.g) / delta) * 60.0;
      }
      
      hue = (hue + uniforms.hue * 180.0) % 360.0;
      if (hue < 0.0) { hue += 360.0; }
      
      let saturation = delta / maxVal;
      let value = maxVal;
      
      // Convert back to RGB
      let c = value * saturation;
      let x = c * (1.0 - abs((hue / 60.0) % 2.0 - 1.0));
      let m = value - c;
      
      if (hue < 60.0) {
        rgb = vec3<f32>(c, x, 0.0) + vec3<f32>(m);
      } else if (hue < 120.0) {
        rgb = vec3<f32>(x, c, 0.0) + vec3<f32>(m);
      } else if (hue < 180.0) {
        rgb = vec3<f32>(0.0, c, x) + vec3<f32>(m);
      } else if (hue < 240.0) {
        rgb = vec3<f32>(0.0, x, c) + vec3<f32>(m);
      } else if (hue < 300.0) {
        rgb = vec3<f32>(x, 0.0, c) + vec3<f32>(m);
      } else {
        rgb = vec3<f32>(c, 0.0, x) + vec3<f32>(m);
      }
    }
  }
  
  // Clamp final result
  rgb = clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0));
  
  return vec4<f32>(rgb, originalColor.a);
}`
    };
  }
  static getVignetteShader() {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,
      fragment: `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  intensity: f32,
  radius: f32,
  padding: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSample(inputTexture, inputSampler, uv);
  
  // Calculate distance from center with aspect ratio correction
  let center = vec2<f32>(0.5, 0.5);
  let aspectRatio = uniforms.resolution.x / uniforms.resolution.y;
  let adjustedUV = uv - center;
  adjustedUV.x *= aspectRatio;
  let dist = length(adjustedUV);
  
  // Create more pronounced vignette with smoother falloff
  let vignetteStart = uniforms.radius * 0.3;
  let vignetteEnd = uniforms.radius;
  let vignette = 1.0 - smoothstep(vignetteStart, vignetteEnd, dist);
  
  // Apply intensity
  let vignetteIntensity = mix(1.0 - uniforms.intensity, 1.0, vignette);
  
  return vec4<f32>(color.rgb * vignetteIntensity, color.a);
}`
    };
  }
  static getFilmGrainShader() {
    return {
      vertex: `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(input.position, 1.0);
  output.uv = input.uv;
  return output;
}`,
      fragment: `
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  intensity: f32,
  padding: vec4<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

fn random(st: vec2<f32>) -> f32 {
  return fract(sin(dot(st.xy, vec2<f32>(12.9898, 78.233))) * 43758.5453123);
}

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSample(inputTexture, inputSampler, uv);
  
  // Generate multiple noise samples for better grain texture
  let pixelCoord = uv * uniforms.resolution;
  let noise1 = random(pixelCoord + uniforms.time * 1.3);
  let noise2 = random(pixelCoord * 2.1 + uniforms.time * 0.7);
  let noise3 = random(pixelCoord * 0.5 + uniforms.time * 2.1);
  
  // Combine noise samples
  let combinedNoise = (noise1 + noise2 * 0.5 + noise3 * 0.25) / 1.75;
  let grain = (combinedNoise * 2.0 - 1.0) * uniforms.intensity;
  
  // Apply grain with luminance-based modulation
  let luminance = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
  let grainModulation = 1.0 - luminance * 0.3; // More grain in darker areas
  let finalGrain = grain * grainModulation;
  
  return vec4<f32>(color.rgb + vec3<f32>(finalGrain), color.a);
}`
    };
  }
  /**
   * Get debug information about loaded passes
   */
  getDebugInfo() {
    const e = Array.from(this.passes.values()).filter((t) => t.enabled).map((t) => t.id);
    return {
      totalPasses: this.passes.size,
      passIds: Array.from(this.passes.keys()),
      enabledPasses: e
    };
  }
  /**
   * Cleanup resources
   */
  destroy() {
    var e, t, r;
    (e = this.renderTarget) == null || e.destroy(), (t = this.depthTexture) == null || t.destroy(), this.tempTargets.forEach((n) => n.destroy()), this.tempTargets = [], (r = this.fullscreenQuad) == null || r.destroy(), this.passes.clear();
  }
}
class E {
  constructor(e) {
    this.postProcessor = null, this.renderObjects = /* @__PURE__ */ new Map(), this.isInitialized = !1, this.animationFrame = null, this.startTime = 0, this.frameCount = 0, this.clearColor = { r: 0, g: 0, b: 0, a: 1 }, this.options = {
      powerPreference: "high-performance",
      forceFallbackAdapter: !1,
      alphaMode: "opaque",
      colorSpace: "srgb",
      autoResize: !0,
      backgroundColor: [0, 0, 0, 1],
      antialias: !1,
      enablePostProcessing: !1,
      ...e
    }, this.clearColor = {
      r: this.options.backgroundColor[0],
      g: this.options.backgroundColor[1],
      b: this.options.backgroundColor[2],
      a: this.options.backgroundColor[3]
    }, this.context = new M({
      canvas: this.options.canvas,
      powerPreference: this.options.powerPreference,
      forceFallbackAdapter: this.options.forceFallbackAdapter,
      alphaMode: this.options.alphaMode,
      colorSpace: this.options.colorSpace
    }), this.shaderManager = new T(this.context), this.textureManager = new U(this.context), this.uniformManager = new v(this.context), this.options.enablePostProcessing && (this.postProcessor = new x(
      this.context,
      this.shaderManager,
      this.textureManager,
      this.uniformManager
    )), this.options.autoResize && this.setupAutoResize();
  }
  /**
   * Initialize PodiumJS
   */
  async initialize() {
    return console.log("🚀 Starting PodiumJS initialization..."), await this.context.initialize() ? (console.log("✅ WebGPU context initialized successfully"), this.postProcessor ? (console.log("🎬 Initializing post-processor..."), await this.postProcessor.initialize(
      this.context.canvas.width,
      this.context.canvas.height
    ) ? console.log("✅ Post-processor initialized successfully") : (console.warn("⚠️ Failed to initialize post-processor, continuing without it"), this.postProcessor = null)) : console.log("📝 Post-processing disabled for this instance"), this.isInitialized = !0, this.startTime = performance.now(), console.log("🎉 PodiumJS initialized successfully"), !0) : (console.error("❌ Failed to initialize WebGPU context"), !1);
  }
  /**
   * Create a plane with texture
   */
  async createPlane(e, t, r, n) {
    if (!this.isInitialized)
      return console.error("PodiumJS not initialized. Call initialize() first."), null;
    try {
      console.log(`Creating basic plane "${e}" with image: ${t}`);
      const i = await this.textureManager.loadImageTexture(t, n);
      if (!i)
        return console.error(`Failed to load texture: ${t}`), null;
      console.log(`Texture loaded successfully for plane "${e}"`);
      const o = new w(this.context, r);
      console.log(`Plane geometry created for "${e}"`);
      const s = this.textureManager.createSampler(`${e}_sampler`);
      if (!s)
        return console.error("Failed to create sampler"), null;
      console.log(`Sampler created for plane "${e}"`);
      let a = this.shaderManager.getBindGroupLayout("default");
      a || console.log("Default bind group layout not found, will be created by pipeline");
      const u = T.getBasicTextureShader();
      console.log(`Creating pipeline for plane "${e}" with shader`);
      const p = await this.shaderManager.createPipeline(`${e}_pipeline`, u, {
        vertexBufferLayouts: [o.getVertexBufferLayout()],
        bindGroupLayouts: a ? [a] : void 0,
        depthTest: !!this.postProcessor
        // Enable depth testing when using post-processor
      });
      if (!p)
        return console.error("Failed to create render pipeline"), null;
      const c = this.shaderManager.getBindGroupLayout("default");
      if (!c)
        return console.error("No bind group layout available after pipeline creation"), null;
      console.log(`Creating bind group for plane "${e}"`);
      const g = this.textureManager.createTextureBindGroup(
        c,
        i,
        s,
        `${e}_bindgroup`
      );
      if (!g)
        return console.error("Failed to create bind group"), null;
      console.log(`Bind group created successfully for plane "${e}"`);
      const l = {
        id: e,
        plane: o,
        pipeline: p,
        bindGroup: g,
        visible: !0,
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      };
      return this.renderObjects.set(e, l), l;
    } catch (i) {
      return console.error(`Error creating plane "${e}":`, i), null;
    }
  }
  /**
   * Create a plane with uniform support
   */
  async createUniformPlane(e, t, r, n) {
    if (!this.isInitialized)
      return console.error("PodiumJS not initialized. Call initialize() first."), null;
    try {
      const i = await this.textureManager.loadImageTexture(t, n);
      if (!i) return null;
      const o = new w(this.context, r), s = this.textureManager.createSampler(`${e}_sampler`);
      if (!s) return null;
      const a = this.uniformManager.createUniformBuffer(`${e}_uniforms`, 96);
      if (!a) return null;
      const u = {
        mvpMatrix: v.createIdentityMatrix(),
        time: 0
      };
      this.uniformManager.updateUniformBuffer(`${e}_uniforms`, u);
      const p = this.uniformManager.createStandardUniformLayout();
      if (!p) return null;
      const c = T.getUniformShader(), g = await this.shaderManager.createPipeline(`${e}_pipeline`, c, {
        vertexBufferLayouts: [o.getVertexBufferLayout()],
        bindGroupLayouts: [p],
        depthTest: !!this.postProcessor
        // Enable depth testing when using post-processor
      });
      if (!g) return null;
      const l = this.uniformManager.createUniformBindGroup(
        `${e}_bindgroup`,
        p,
        a,
        i,
        s
      );
      if (!l) return null;
      const m = {
        id: e,
        plane: o,
        pipeline: g,
        bindGroup: l,
        uniformBuffer: a,
        visible: !0,
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      };
      return this.renderObjects.set(e, m), m;
    } catch (i) {
      return console.error(`Error creating uniform plane "${e}":`, i), null;
    }
  }
  /**
   * Update uniform data for a render object
   */
  updateUniforms(e, t) {
    const r = this.renderObjects.get(e);
    if (!r || !r.uniformBuffer)
      return console.error(`Render object "${e}" not found or has no uniforms`), !1;
    console.log(`🔄 Updating uniforms for ${e}:`, Object.keys(t));
    const n = this.uniformManager.updateUniformBuffer(`${e}_uniforms`, t);
    return n || console.error(`❌ Failed to update uniform buffer for ${e}`), n;
  }
  /**
   * Set transform for a render object
   */
  setTransform(e, t) {
    const r = this.renderObjects.get(e);
    if (!r)
      return console.error(`Render object "${e}" not found`), !1;
    if (Object.assign(r.transform, t), console.log(`🎯 Transform updated for ${e}:`, r.transform), r.uniformBuffer) {
      const n = this.calculateMVPMatrix(r.transform);
      console.log(`📐 Calculated MVP matrix for ${e}:`, n.slice(0, 4));
      const i = this.updateUniforms(e, { mvpMatrix: n });
      console.log(`💫 Uniform update for ${e}: ${i ? "SUCCESS" : "FAILED"}`);
    } else
      console.warn(`⚠️ ${e} has no uniform buffer - transform won't be applied`);
    return !0;
  }
  /**
   * Calculate MVP matrix from transform
   */
  calculateMVPMatrix(e) {
    const t = v.createScaleMatrix(
      e.scale[0],
      e.scale[1],
      e.scale[2]
    ), r = v.createTranslationMatrix(
      e.position[0],
      e.position[1],
      e.position[2]
    ), n = v.createOrthographicMatrix(
      -2,
      2,
      // left, right
      -2,
      2,
      // bottom, top
      -1,
      1
      // near, far
    ), i = v.multiplyMatrices(r, t);
    return v.multiplyMatrices(n, i);
  }
  /**
   * Start the render loop
   */
  startRenderLoop() {
    if (!this.isInitialized) {
      console.error("PodiumJS not initialized. Call initialize() first.");
      return;
    }
    this.animationFrame && this.stopRenderLoop();
    const e = async (t) => {
      await this.render(t), this.animationFrame = requestAnimationFrame(e);
    };
    this.animationFrame = requestAnimationFrame(e);
  }
  /**
   * Stop the render loop
   */
  stopRenderLoop() {
    this.animationFrame && (cancelAnimationFrame(this.animationFrame), this.animationFrame = null);
  }
  /**
   * Render a single frame
   */
  async render(e = performance.now()) {
    if (!this.isInitialized || !this.context.device) return;
    const t = (e - this.startTime) / 1e3;
    this.renderObjects.forEach((s) => {
      s.uniformBuffer && s.visible && this.updateUniforms(s.id, { time: t });
    });
    const r = this.context.device.createCommandEncoder({
      label: "render_commands"
    }), n = this.context.getCurrentTextureView();
    if (!n)
      return;
    const i = this.postProcessor ? this.postProcessor.beginRenderToTexture(r) : r.beginRenderPass({
      label: "main_render_pass",
      colorAttachments: [
        {
          view: n,
          clearValue: this.clearColor,
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    });
    let o = 0;
    this.renderObjects.forEach((s) => {
      if (s.visible)
        try {
          i.setPipeline(s.pipeline), i.setBindGroup(0, s.bindGroup), s.plane.bind(i), s.plane.draw(i), o++;
        } catch (a) {
          console.error(`❌ Error rendering object "${s.id}":`, a);
        }
    }), this.frameCount % 120 === 0 && console.log(`🎨 Render frame ${this.frameCount}: ${o}/${this.renderObjects.size} objects rendered`), o === 0 && this.renderObjects.size > 0 && console.warn("⚠️ No objects were rendered, but objects exist. Check visibility and pipeline validity."), i.end(), this.postProcessor && await this.postProcessor.applyPostProcessing(r, n, t), this.context.device.queue.submit([r.finish()]), this.frameCount++;
  }
  /**
   * Set up automatic canvas resizing
   */
  setupAutoResize() {
    new ResizeObserver((t) => {
      var r;
      for (const n of t) {
        const { width: i, height: o } = n.contentRect;
        this.context.resize(i, o), (r = this.postProcessor) == null || r.resize(i, o);
      }
    }).observe(this.options.canvas), window.addEventListener("resize", () => {
      var r;
      const t = this.options.canvas;
      this.context.resize(t.clientWidth, t.clientHeight), (r = this.postProcessor) == null || r.resize(t.clientWidth, t.clientHeight);
    });
  }
  /**
   * Get render object by ID
   */
  getRenderObject(e) {
    return this.renderObjects.get(e) || null;
  }
  /**
   * Remove render object
   */
  removeRenderObject(e) {
    const t = this.renderObjects.get(e);
    return t ? (t.plane.destroy(), t.uniformBuffer && t.uniformBuffer.destroy(), this.renderObjects.delete(e), !0) : !1;
  }
  /**
   * Enable/disable a post-processing effect
   */
  setEffectEnabled(e, t) {
    return this.postProcessor ? this.postProcessor.setEffectEnabled(e, t) : (console.warn("Post-processing not enabled"), !1);
  }
  /**
   * Update post-processing effect options
   */
  updateEffect(e, t) {
    return this.postProcessor ? this.postProcessor.updateEffect(e, t) : (console.warn("Post-processing not enabled"), !1);
  }
  /**
   * Get available post-processing effects
   */
  getAvailableEffects() {
    return this.postProcessor ? ["blur", "bloom", "colorCorrection", "vignette", "filmGrain"] : [];
  }
  /**
   * Get performance stats
   */
  getStats() {
    const e = (performance.now() - this.startTime) / 1e3, t = e > 0 ? this.frameCount / e : 0;
    return {
      frameCount: this.frameCount,
      elapsedTime: e,
      fps: t
    };
  }
  /**
   * Check WebGPU support
   */
  static isSupported() {
    return M.isSupported();
  }
  /**
   * Cleanup resources
   */
  destroy() {
    var e;
    this.stopRenderLoop(), this.renderObjects.forEach((t) => {
      t.plane.destroy(), t.uniformBuffer && t.uniformBuffer.destroy();
    }), this.renderObjects.clear(), (e = this.postProcessor) == null || e.destroy(), this.shaderManager.destroy(), this.textureManager.destroy(), this.uniformManager.destroy(), this.context.destroy(), this.isInitialized = !1;
  }
}
export {
  w as Plane,
  E as Podium,
  x as PostProcessor,
  T as ShaderManager,
  U as TextureManager,
  v as UniformManager,
  M as WebGPUContext,
  E as default
};
