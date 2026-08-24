/* ============================================================
   gradient-wave.js
   ------------------------------------------------------------
   "GradientWave" React/TSX bileşeninin bu projeye (Flask + Jinja,
   React yok) uyarlanmış vanilla JS portu. WebGL/shader mantığı
   birebir aynı — yalnızca React sarmalayıcısı yerine
   window.GradientWave.mount(el, options) API'si var.

   Arka plan olarak kullanılıyor; hero'nun kendi opak gökyüzü
   olduğu için hero bu katmanın üzerini tamamen kapatır.
   ============================================================ */

(function () {
  "use strict";

  function normalizeColor(hexCode) {
    return [
      ((hexCode >> 16) & 255) / 255,
      ((hexCode >> 8) & 255) / 255,
      (255 & hexCode) / 255
    ];
  }

  function MiniGl(canvas) {
    this.canvas = canvas;
    var gl = this.canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;
    this.meshes = [];

    var context = this.gl;
    var _miniGl = this;

    this.Uniform = function (e) {
      this.type = "float";
      Object.assign(this, e);
      var typeMap = {
        float: "1f", int: "1i", vec2: "2fv", vec3: "3fv", vec4: "4fv", mat4: "Matrix4fv"
      };
      this.typeFn = typeMap[this.type] || "1f";
    };

    this.Uniform.prototype.update = function (location) {
      if (this.value === undefined || location === null) return;
      var isMatrix = this.typeFn.indexOf("Matrix") === 0;
      var fn = "uniform" + this.typeFn;
      if (isMatrix) {
        context[fn](location, this.transpose || false, this.value);
      } else {
        context[fn](location, this.value);
      }
    };

    this.Uniform.prototype.getDeclaration = function (name, type, length) {
      if (this.excludeFrom === type) return "";

      if (this.type === "array") {
        return (
          this.value[0].getDeclaration(name, type, this.value.length) +
          "\nconst int " + name + "_length = " + this.value.length + ";"
        );
      }

      if (this.type === "struct") {
        var nameNoPrefix = name.replace("u_", "");
        nameNoPrefix = nameNoPrefix.charAt(0).toUpperCase() + nameNoPrefix.slice(1);
        var fields = Object.entries(this.value)
          .map(function (entry) {
            return entry[1].getDeclaration(entry[0], type).replace(/^uniform/, "");
          })
          .join("");
        return "uniform struct " + nameNoPrefix + " \n{\n" + fields + "\n} " +
          name + (length ? "[" + length + "]" : "") + ";";
      }

      return "uniform " + this.type + " " + name + (length ? "[" + length + "]" : "") + ";";
    };

    this.Attribute = function (e) {
      this.type = context.FLOAT;
      this.normalized = false;
      this.buffer = context.createBuffer();
      Object.assign(this, e);
    };

    this.Attribute.prototype.update = function () {
      if (this.values) {
        context.bindBuffer(this.target, this.buffer);
        context.bufferData(this.target, this.values, context.STATIC_DRAW);
      }
    };

    this.Attribute.prototype.attach = function (e, t) {
      var n = context.getAttribLocation(t, e);
      if (this.target === context.ARRAY_BUFFER) {
        context.bindBuffer(this.target, this.buffer);
        context.enableVertexAttribArray(n);
        context.vertexAttribPointer(n, this.size, this.type, this.normalized, 0, 0);
      }
      return n;
    };

    this.Attribute.prototype.use = function (e) {
      context.bindBuffer(this.target, this.buffer);
      if (this.target === context.ARRAY_BUFFER) {
        context.enableVertexAttribArray(e);
        context.vertexAttribPointer(e, this.size, this.type, this.normalized, 0, 0);
      }
    };

    this.Material = function (vertexShaders, fragments, uniforms) {
      uniforms = uniforms || {};
      var material = this;
      this.uniformInstances = [];

      function getShader(type, source) {
        var shader = context.createShader(type);
        context.shaderSource(shader, source);
        context.compileShader(shader);
        if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
          console.error(context.getShaderInfoLog(shader));
          throw new Error("Shader compilation error");
        }
        return shader;
      }

      function getUniformDeclarations(uniforms, type) {
        return Object.entries(uniforms)
          .map(function (entry) { return entry[1].getDeclaration(entry[0], type); })
          .join("\n");
      }

      material.uniforms = uniforms;
      var prefix = "precision highp float;";

      var vertexSource = prefix +
        "\nattribute vec4 position;\nattribute vec2 uv;\nattribute vec2 uvNorm;\n" +
        getUniformDeclarations(_miniGl.commonUniforms, "vertex") + "\n" +
        getUniformDeclarations(uniforms, "vertex") + "\n" +
        vertexShaders;

      var fragmentSource = prefix + "\n" +
        getUniformDeclarations(_miniGl.commonUniforms, "fragment") + "\n" +
        getUniformDeclarations(uniforms, "fragment") + "\n" +
        fragments;

      material.program = context.createProgram();
      context.attachShader(material.program, getShader(context.VERTEX_SHADER, vertexSource));
      context.attachShader(material.program, getShader(context.FRAGMENT_SHADER, fragmentSource));
      context.linkProgram(material.program);

      if (!context.getProgramParameter(material.program, context.LINK_STATUS)) {
        console.error(context.getProgramInfoLog(material.program));
        throw new Error("Program linking error");
      }

      context.useProgram(material.program);
      material.attachUniforms(undefined, _miniGl.commonUniforms);
      material.attachUniforms(undefined, material.uniforms);
    };

    this.Material.prototype.attachUniforms = function (name, uniforms) {
      var self = this;
      if (name === undefined) {
        Object.entries(uniforms).forEach(function (entry) {
          self.attachUniforms(entry[0], entry[1]);
        });
      } else if (uniforms.type === "array") {
        uniforms.value.forEach(function (u, i) {
          self.attachUniforms(name + "[" + i + "]", u);
        });
      } else if (uniforms.type === "struct") {
        Object.entries(uniforms.value).forEach(function (entry) {
          self.attachUniforms(name + "." + entry[0], entry[1]);
        });
      } else {
        this.uniformInstances.push({
          uniform: uniforms,
          location: context.getUniformLocation(this.program, name)
        });
      }
    };

    this.PlaneGeometry = function () {
      this.width = 1;
      this.height = 1;
      this.vertexCount = 0;
      this.xSegCount = 0;
      this.ySegCount = 0;
      this.attributes = {
        position: new _miniGl.Attribute({ target: context.ARRAY_BUFFER, size: 3 }),
        uv: new _miniGl.Attribute({ target: context.ARRAY_BUFFER, size: 2 }),
        uvNorm: new _miniGl.Attribute({ target: context.ARRAY_BUFFER, size: 2 }),
        index: new _miniGl.Attribute({
          target: context.ELEMENT_ARRAY_BUFFER, size: 3, type: context.UNSIGNED_SHORT
        })
      };
    };

    this.PlaneGeometry.prototype.setTopology = function (xSegs, ySegs) {
      xSegs = xSegs || 1;
      ySegs = ySegs || 1;
      this.xSegCount = xSegs;
      this.ySegCount = ySegs;
      this.vertexCount = (this.xSegCount + 1) * (this.ySegCount + 1);
      var quadCount = this.xSegCount * this.ySegCount * 2;

      this.attributes.uv.values = new Float32Array(2 * this.vertexCount);
      this.attributes.uvNorm.values = new Float32Array(2 * this.vertexCount);
      this.attributes.index.values = new Uint16Array(3 * quadCount);

      for (var y = 0; y <= this.ySegCount; y++) {
        for (var x = 0; x <= this.xSegCount; x++) {
          var i = y * (this.xSegCount + 1) + x;
          this.attributes.uv.values[2 * i] = x / this.xSegCount;
          this.attributes.uv.values[2 * i + 1] = 1 - y / this.ySegCount;
          this.attributes.uvNorm.values[2 * i] = (x / this.xSegCount) * 2 - 1;
          this.attributes.uvNorm.values[2 * i + 1] = 1 - (y / this.ySegCount) * 2;

          if (x < this.xSegCount && y < this.ySegCount) {
            var s = y * this.xSegCount + x;
            this.attributes.index.values[6 * s] = i;
            this.attributes.index.values[6 * s + 1] = i + 1 + this.xSegCount;
            this.attributes.index.values[6 * s + 2] = i + 1;
            this.attributes.index.values[6 * s + 3] = i + 1;
            this.attributes.index.values[6 * s + 4] = i + 1 + this.xSegCount;
            this.attributes.index.values[6 * s + 5] = i + 2 + this.xSegCount;
          }
        }
      }

      this.attributes.uv.update();
      this.attributes.uvNorm.update();
      this.attributes.index.update();
    };

    this.PlaneGeometry.prototype.setSize = function (width, height) {
      width = width || 1;
      height = height || 1;
      this.width = width;
      this.height = height;
      this.attributes.position.values = new Float32Array(3 * this.vertexCount);

      var offsetX = width / -2;
      var offsetY = height / -2;
      var segWidth = width / this.xSegCount;
      var segHeight = height / this.ySegCount;

      for (var y = 0; y <= this.ySegCount; y++) {
        var posY = offsetY + y * segHeight;
        for (var x = 0; x <= this.xSegCount; x++) {
          var posX = offsetX + x * segWidth;
          var idx = y * (this.xSegCount + 1) + x;
          this.attributes.position.values[3 * idx] = posX;
          this.attributes.position.values[3 * idx + 1] = -posY;
          this.attributes.position.values[3 * idx + 2] = 0;
        }
      }

      this.attributes.position.update();
    };

    this.Mesh = function (geometry, material) {
      var self = this;
      this.geometry = geometry;
      this.material = material;
      this.attributeInstances = [];

      Object.entries(this.geometry.attributes).forEach(function (entry) {
        self.attributeInstances.push({
          attribute: entry[1],
          location: entry[1].attach(entry[0], self.material.program)
        });
      });

      _miniGl.meshes.push(this);
    };

    this.Mesh.prototype.draw = function () {
      context.useProgram(this.material.program);
      this.material.uniformInstances.forEach(function (o) {
        o.uniform.update(o.location);
      });
      this.attributeInstances.forEach(function (o) {
        o.attribute.use(o.location);
      });
      context.drawElements(
        context.TRIANGLES,
        this.geometry.attributes.index.values.length,
        context.UNSIGNED_SHORT,
        0
      );
    };

    var identityMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    this.commonUniforms = {
      projectionMatrix: new this.Uniform({ type: "mat4", value: identityMatrix }),
      modelViewMatrix: new this.Uniform({ type: "mat4", value: identityMatrix }),
      resolution: new this.Uniform({ type: "vec2", value: [1, 1] }),
      aspectRatio: new this.Uniform({ type: "float", value: 1 })
    };
  }

  MiniGl.prototype.setSize = function (w, h) {
    w = w || 640;
    h = h || 480;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this.commonUniforms.resolution.value = [w, h];
    this.commonUniforms.aspectRatio.value = w / h;
  };

  MiniGl.prototype.setOrthographicCamera = function () {
    this.commonUniforms.projectionMatrix.value = [
      2 / this.width, 0, 0, 0,
      0, 2 / this.height, 0, 0,
      0, 0, -0.001, 0,
      0, 0, 0, 1
    ];
  };

  MiniGl.prototype.render = function () {
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clearDepth(1);
    this.meshes.forEach(function (m) { m.draw(); });
  };

  /* ---------------- Shader kaynakları ---------------- */

  var VERTEX_SHADER = [
    "vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }",
    "vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }",
    "vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }",
    "vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }",
    "",
    "float snoise(vec3 v) {",
    "  const vec2 C = vec2(1.0/6.0, 1.0/3.0);",
    "  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);",
    "  vec3 i  = floor(v + dot(v, C.yyy));",
    "  vec3 x0 = v - i + dot(i, C.xxx);",
    "  vec3 g = step(x0.yzx, x0.xyz);",
    "  vec3 l = 1.0 - g;",
    "  vec3 i1 = min(g.xyz, l.zxy);",
    "  vec3 i2 = max(g.xyz, l.zxy);",
    "  vec3 x1 = x0 - i1 + C.xxx;",
    "  vec3 x2 = x0 - i2 + C.yyy;",
    "  vec3 x3 = x0 - D.yyy;",
    "  i = mod289(i);",
    "  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));",
    "  float n_ = 0.142857142857;",
    "  vec3 ns = n_ * D.wyz - D.xzx;",
    "  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);",
    "  vec4 x_ = floor(j * ns.z);",
    "  vec4 y_ = floor(j - 7.0 * x_);",
    "  vec4 x = x_ *ns.x + ns.yyyy;",
    "  vec4 y = y_ *ns.x + ns.yyyy;",
    "  vec4 h = 1.0 - abs(x) - abs(y);",
    "  vec4 b0 = vec4(x.xy, y.xy);",
    "  vec4 b1 = vec4(x.zw, y.zw);",
    "  vec4 s0 = floor(b0)*2.0 + 1.0;",
    "  vec4 s1 = floor(b1)*2.0 + 1.0;",
    "  vec4 sh = -step(h, vec4(0.0));",
    "  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;",
    "  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;",
    "  vec3 p0 = vec3(a0.xy,h.x);",
    "  vec3 p1 = vec3(a0.zw,h.y);",
    "  vec3 p2 = vec3(a1.xy,h.z);",
    "  vec3 p3 = vec3(a1.zw,h.w);",
    "  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));",
    "  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;",
    "  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);",
    "  m = m * m;",
    "  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));",
    "}",
    "",
    "vec3 blendNormal(vec3 base, vec3 blend) { return blend; }",
    "vec3 blendNormal(vec3 base, vec3 blend, float opacity) { return (blend * opacity + base * (1.0 - opacity)); }",
    "",
    "varying vec3 v_color;",
    "",
    "void main() {",
    "  float time = u_time * u_global.noiseSpeed;",
    "  vec2 noiseCoord = resolution * uvNorm * u_global.noiseFreq;",
    "  float tilt = resolution.y / 2.0 * uvNorm.y;",
    "  float incline = resolution.x * uvNorm.x / 2.0 * u_vertDeform.incline;",
    "  float offset = resolution.x / 2.0 * u_vertDeform.incline * mix(u_vertDeform.offsetBottom, u_vertDeform.offsetTop, uv.y);",
    "",
    "  float noise = snoise(vec3(",
    "    noiseCoord.x * u_vertDeform.noiseFreq.x + time * u_vertDeform.noiseFlow,",
    "    noiseCoord.y * u_vertDeform.noiseFreq.y,",
    "    time * u_vertDeform.noiseSpeed + u_vertDeform.noiseSeed",
    "  )) * u_vertDeform.noiseAmp;",
    "",
    "  noise *= 1.0 - pow(abs(uvNorm.y), 2.0);",
    "  noise = max(0.0, noise);",
    "",
    "  vec3 pos = vec3(position.x, position.y + tilt + incline + noise - offset, position.z);",
    "",
    "  v_color = u_baseColor;",
    "",
    "  for (int i = 0; i < u_waveLayers_length; i++) {",
    "    if (u_active_colors[i + 1] == 1.) {",
    "      WaveLayers layer = u_waveLayers[i];",
    "      float layerNoise = smoothstep(",
    "        layer.noiseFloor,",
    "        layer.noiseCeil,",
    "        snoise(vec3(",
    "          noiseCoord.x * layer.noiseFreq.x + time * layer.noiseFlow,",
    "          noiseCoord.y * layer.noiseFreq.y,",
    "          time * layer.noiseSpeed + layer.noiseSeed",
    "        )) / 2.0 + 0.5",
    "      );",
    "      v_color = blendNormal(v_color, layer.color, pow(layerNoise, 4.));",
    "    }",
    "  }",
    "",
    "  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);",
    "}"
  ].join("\n");

  var FRAGMENT_SHADER = [
    "varying vec3 v_color;",
    "",
    "void main() {",
    "  vec3 color = v_color;",
    "  if (u_darken_top == 1.0) {",
    "    vec2 st = gl_FragCoord.xy/resolution.xy;",
    "    color.g -= pow(st.y + sin(-12.0) * st.x, u_shadow_power) * 0.4;",
    "  }",
    "  gl_FragColor = vec4(color, 1.0);",
    "}"
  ].join("\n");

  /* ---------------- Gradient ---------------- */

  function Gradient(canvas, colors) {
    this.canvas = canvas;
    // Shader'daki u_active_colors bir vec4; taban renk + en fazla 3 dalga
    // katmanı destekler. Daha fazla renk verilirse shader vec4'ün dışını
    // indeksler (tanımsız davranış), o yüzden 4 renkte kesiyoruz.
    this.colors = colors.slice(0, 4);
    this.time = 0;
    this.last = 0;
    this.isPlaying = false;
    this.minigl = new MiniGl(canvas);
    this._onResize = this.resize.bind(this);
    this.init();
  }

  Gradient.prototype.init = function () {
    var self = this;
    var U = this.minigl.Uniform;

    var sectionColors = this.colors.map(function (hex) {
      return normalizeColor(parseInt(hex.replace("#", "0x"), 16));
    });

    var uniforms = {
      u_time: new U({ value: 0 }),
      u_shadow_power: new U({ value: 5 }),
      u_darken_top: new U({ value: 0 }),
      u_active_colors: new U({ value: [1, 1, 1, 1], type: "vec4" }),
      u_global: new U({
        value: {
          noiseFreq: new U({ value: [0.00014, 0.00029], type: "vec2" }),
          noiseSpeed: new U({ value: 0.000005 })
        },
        type: "struct"
      }),
      u_vertDeform: new U({
        value: {
          incline: new U({ value: 0 }),
          offsetTop: new U({ value: -0.5 }),
          offsetBottom: new U({ value: -0.5 }),
          noiseFreq: new U({ value: [3, 4], type: "vec2" }),
          noiseAmp: new U({ value: 320 }),
          noiseSpeed: new U({ value: 10 }),
          noiseFlow: new U({ value: 3 }),
          noiseSeed: new U({ value: 5 })
        },
        type: "struct",
        excludeFrom: "fragment"
      }),
      u_baseColor: new U({ value: sectionColors[0], type: "vec3", excludeFrom: "fragment" }),
      u_waveLayers: new U({ value: [], excludeFrom: "fragment", type: "array" })
    };

    for (var i = 1; i < sectionColors.length; i++) {
      uniforms.u_waveLayers.value.push(
        new U({
          value: {
            color: new U({ value: sectionColors[i], type: "vec3" }),
            noiseFreq: new U({
              value: [2 + i / sectionColors.length, 3 + i / sectionColors.length],
              type: "vec2"
            }),
            noiseSpeed: new U({ value: 11 + 0.3 * i }),
            noiseFlow: new U({ value: 6.5 + 0.3 * i }),
            noiseSeed: new U({ value: 5 + 10 * i }),
            noiseFloor: new U({ value: 0.1 }),
            noiseCeil: new U({ value: 0.63 + 0.07 * i })
          },
          type: "struct"
        })
      );
    }

    var material = new this.minigl.Material(VERTEX_SHADER, FRAGMENT_SHADER, uniforms);
    var geometry = new this.minigl.PlaneGeometry();
    this.mesh = new this.minigl.Mesh(geometry, material);

    this.resize();
    window.addEventListener("resize", self._onResize);
  };

  Gradient.prototype.resize = function () {
    var width = window.innerWidth;
    var height = window.innerHeight;
    this.minigl.setSize(width, height);
    this.minigl.setOrthographicCamera();

    var xSegCount = Math.ceil(width * 0.02);
    var ySegCount = Math.ceil(height * 0.05);
    this.mesh.geometry.setTopology(xSegCount, ySegCount);
    this.mesh.geometry.setSize(width, height);
    this.mesh.material.uniforms.u_shadow_power.value = width < 600 ? 5 : 6;

    // Duraklamışken bile yeniden boyutlandırmada tek kare çizilsin,
    // aksi halde canvas boş kalır.
    if (!this.isPlaying) this.renderOnce();
  };

  Gradient.prototype.renderOnce = function () {
    this.mesh.material.uniforms.u_time.value = this.time;
    this.minigl.render();
  };

  Gradient.prototype.animate = function (timestamp) {
    if (!this.isPlaying) return;
    this.time += Math.min(timestamp - this.last, 1000 / 15);
    this.last = timestamp;
    this.mesh.material.uniforms.u_time.value = this.time;
    this.minigl.render();
    this.animationId = requestAnimationFrame(this._tick);
  };

  Gradient.prototype.start = function () {
    if (this.isPlaying) return;
    var self = this;
    this._tick = this._tick || function (t) { self.animate(t); };
    this.isPlaying = true;
    this.last = performance.now();
    this.animationId = requestAnimationFrame(this._tick);
  };

  Gradient.prototype.stop = function () {
    this.isPlaying = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
  };

  Gradient.prototype.destroy = function () {
    this.stop();
    window.removeEventListener("resize", this._onResize);
  };

  /* ---------------- Mount API ----------------
     TSX bileşeninin props'larıyla aynı isimler:
     colors, isPlaying, shadowPower, darkenTop, noiseSpeed,
     noiseFrequency, deform
     ------------------------------------------- */

  function mount(container, options) {
    if (!container) return null;
    options = options || {};

    var colors = options.colors || ["#38bdf8", "#ffffff", "#38bdf8", "#ffffff"];
    var canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      display: "block"
    });
    container.appendChild(canvas);

    var gradient;
    try {
      gradient = new Gradient(canvas, colors);
    } catch (error) {
      // WebGL yoksa/başarısızsa canvas'ı kaldır; CSS'teki düz arka plan
      // rengi devreye girer, sayfa bozulmaz.
      console.error("Failed to initialize gradient:", error);
      container.removeChild(canvas);
      return null;
    }

    var u = gradient.mesh.material.uniforms;
    u.u_shadow_power.value = options.shadowPower !== undefined ? options.shadowPower : 8;
    u.u_darken_top.value = options.darkenTop ? 1 : 0;
    if (options.noiseFrequency) u.u_global.value.noiseFreq.value = options.noiseFrequency;
    if (options.noiseSpeed !== undefined) u.u_global.value.noiseSpeed.value = options.noiseSpeed;

    // deform: iç içe Uniform nesneleri olduğu için değerleri tek tek yazıyoruz
    // (Object.assign uniform'ları ham sayılarla ezerdi ve .update() kaybolurdu).
    if (options.deform) {
      Object.keys(options.deform).forEach(function (key) {
        if (u.u_vertDeform.value[key]) {
          u.u_vertDeform.value[key].value = options.deform[key];
        }
      });
    }

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var wantsPlay = options.isPlaying !== false && !reduceMotion;

    if (wantsPlay) {
      gradient.start();
    } else {
      // Hareket istenmiyorsa tek kare: gradyan durur ama görünür kalır.
      gradient.renderOnce();
    }

    // Sekme arka plandayken WebGL döngüsünü boşuna çevirme.
    document.addEventListener("visibilitychange", function () {
      if (!wantsPlay) return;
      if (document.hidden) gradient.stop();
      else gradient.start();
    });

    return gradient;
  }

  window.GradientWave = { mount: mount, Gradient: Gradient, MiniGl: MiniGl };
})();
