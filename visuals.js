'use strict';

const SolarVisuals = (() => {
  const tau = Math.PI * 2;
  const vertex = `
    attribute vec2 position;
    attribute vec4 color;
    uniform vec2 size;
    varying vec4 shade;
    void main() {
      vec2 p = position / size;
      gl_Position = vec4(2.0 * p.x - 1.0, 1.0 - 2.0 * p.y, 0.0, 1.0);
      shade = color;
    }`;
  const solid = `
    precision mediump float;
    varying vec4 shade;
    void main() { gl_FragColor = shade; }`;
  const solarFragment = `
    precision highp float;
    uniform vec2 size;
    uniform float scale;
    float hash(vec2 p) {
      return fract(43758.5453 * sin(dot(mod(p, 103.0), vec2(127.1,311.7))));
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 w = f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),w.x),mix(hash(i+vec2(0,1)),hash(i+1.0),w.x),w.y);
    }
    float cloud(vec2 p) {
      float value = 0.0, amplitude = 0.52;
      for (int i = 0; i < 5; ++i) {
        value += noise(p)*amplitude;
        p = mat2(1.72,1.10,-1.10,1.72)*p+vec2(9.3,5.1);
        amplitude *= 0.49;
      }
      return value;
    }
    void main() {
      vec2 p = (gl_FragCoord.xy / scale - size * 0.5) / (min(size.x,size.y)*0.374);
      float radius = length(p), theta = atan(p.y, p.x);
      vec2 ring = vec2(cos(theta), sin(theta));
      float edge = 1.0-smoothstep(0.992,1.006,radius);
      float depth = sqrt(max(0.0,1.0-radius*radius));
      vec2 q = p*4.9 + 0.92*vec2(cloud(p*3.4+1.8),cloud(p*3.4-3.7));
      float grain = cloud(q*2.4);
      float strands = 1.0-abs(2.0*cloud(q+vec2(4.1,7.2))-1.0);
      float surface = grain*0.54+pow(strands,8.0)*0.30+noise(q*31.0)*0.16;
      float active = pow(cloud(p*3.7+vec2(13.0,7.0)),4.0);
      float intensity = clamp(surface*(0.64+0.48*depth)+1.15*active,0.0,1.0);
      vec3 dark = vec3(0.20,0.038,0.013), hot = vec3(0.86,0.28,0.045);
      vec3 disk = mix(dark,hot,smoothstep(0.10,0.71,intensity));
      disk = mix(disk,vec3(1.0,0.78,0.38),smoothstep(0.69,0.97,intensity));
      float rim = exp(-abs(radius-1.0)*133.0);
      disk += rim*vec3(0.41,0.20,0.056);
      float stream = pow(cloud(ring*vec2(7.0,13.0)+radius*1.6),2.5);
      float ray = exp(-max(0.0,radius-1.0)*(10.0+36.0*(1.0-stream)))*stream;
      float corona = (ray*0.84+rim*0.48)*(1.0-edge);
      float angle = theta/6.2831853+0.5;
      float tickRadius = mix(1.224,1.204,step(0.94,cos(angle*24.0*6.2831853)));
      float tick = smoothstep(0.969,0.999,cos(angle*120.0*6.2831853));
      tick *= smoothstep(tickRadius,tickRadius+0.008,radius)*(1.0-smoothstep(1.274,1.282,radius));
      float guide = (1.0-smoothstep(0.001,0.006,abs(radius-1.287)))*0.20 + tick*0.39;
      vec3 halo = mix(vec3(0.29,0.22,0.16),vec3(0.89,0.42,0.12),clamp(corona*9.0,0.0,1.0));
      gl_FragColor = vec4(mix(halo,disk,edge), max(edge,max(corona,guide)));
    }`;

  function shaderProgram(gl, fragment) {
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    return program;
  }

  function color(value) {
    const numeric = Number.parseInt(value.slice(1), 16);
    return [((numeric >> 16) & 255) / 255, ((numeric >> 8) & 255) / 255, (numeric & 255) / 255, 1];
  }

  function surface(canvas, paint, {fragment=solid, fallback=true, viewport}={}) {
    let target = canvas;
    let webgl;
    let fallbackCanvas;
    let context2d;

    function initialize(tryWebGL = true) {
      try {
        const gl = tryWebGL ? canvas.getContext('webgl', {
          alpha:true, antialias:true, premultipliedAlpha:false, preserveDrawingBuffer:true
        }) : null;
        if (gl) {
          const program = shaderProgram(gl, fragment);
          const buffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          const position = gl.getAttribLocation(program, 'position');
          const shade = gl.getAttribLocation(program, 'color');
          gl.enableVertexAttribArray(position);
          gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 24, 0);
          if (shade >= 0) {
            gl.enableVertexAttribArray(shade);
            gl.vertexAttribPointer(shade, 4, gl.FLOAT, false, 24, 8);
          }
          webgl = {gl, size:gl.getUniformLocation(program,'size'), scale:gl.getUniformLocation(program,'scale')};
        }
      } catch (error) {
        console.warn('Unable to initialize a solar visual in WebGL.', error);
      }
      if (webgl) {
        target = canvas;
      } else if (fallback) {
        if (!fallbackCanvas) {
          fallbackCanvas = canvas.cloneNode();
          fallbackCanvas.removeAttribute('id');
          fallbackCanvas.classList.remove('webgl-ready','show-canvas-fallback');
          fallbackCanvas.classList.add('canvas-fallback');
          fallbackCanvas.setAttribute('aria-hidden','true');
          canvas.after(fallbackCanvas);
          context2d = fallbackCanvas.getContext('2d');
        }
        target = fallbackCanvas;
      }
      canvas.classList.toggle('webgl-ready', Boolean(webgl));
      canvas.classList.toggle('show-canvas-fallback', !webgl && Boolean(context2d));
    }

    function render() {
      if (!webgl && !context2d) return;
      const {width,height} = canvas.getBoundingClientRect();
      if (!width || !height) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pixelsWide = Math.max(1, Math.round(width*ratio));
      const pixelsHigh = Math.max(1, Math.round(height*ratio));
      if (target.width !== pixelsWide || target.height !== pixelsHigh) {
        target.width = pixelsWide;
        target.height = pixelsHigh;
      }
      const [w,h] = viewport || [width,height];
      const vertices = [];
      const useGL = Boolean(webgl);
      if (!useGL) {
        context2d.setTransform(pixelsWide/w,0,0,pixelsHigh/h,0,0);
        context2d.clearRect(0,0,w,h);
      }
      function polygon(points, fill) {
        if (points.length < 3) return;
        if (useGL) {
          const shade = color(fill);
          for (let i=1; i<points.length-1; i++) {
            vertices.push(...points[0],...shade,...points[i],...shade,...points[i+1],...shade);
          }
        } else {
          context2d.beginPath();
          points.forEach(([x,y],i)=>i ? context2d.lineTo(x,y) : context2d.moveTo(x,y));
          context2d.closePath();
          context2d.fillStyle = fill;
          context2d.fill();
        }
      }
      function line(points, width, stroke, closed=false) {
        const count = points.length;
        for (let i=0;i<(closed ? count : count-1);i++) {
          const [x,y] = points[i], [u,v] = points[(i+1)%count];
          const length = Math.hypot(u-x,v-y);
          if (!length) continue;
          const nx = (y-v)*width/(2*length), ny = (u-x)*width/(2*length);
          polygon([[x+nx,y+ny],[u+nx,v+ny],[u-nx,v-ny],[x-nx,y-ny]],stroke);
        }
      }
      function dot(x,y,r,fill,ry=r) { polygon(ellipse(x,y,r,ry),fill); }
      paint({w,h,polygon,line,dot});
      if (useGL) {
        const {gl,size,scale} = webgl;
        gl.viewport(0,0,pixelsWide,pixelsHigh);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(size,w,h);
        if (scale) gl.uniform1f(scale,pixelsWide/width);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);
      }
    }

    initialize();
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      webgl = null;
      initialize(false);
      render();
    });
    canvas.addEventListener('webglcontextrestored', () => { initialize(); render(); });
    new ResizeObserver(render).observe(canvas);
    render();
    return render;
  }

  function ellipse(x,y,rx,ry=rx,segments=20) {
    return Array.from({length:segments}, (_,i) => {
      const angle = tau*i/segments;
      return [x+rx*Math.cos(angle),y+ry*Math.sin(angle)];
    });
  }

  function chart(canvas, points, rows, state) {
    return surface(canvas, ({w,h,line,dot}) => {
      const x = value => w*(value+18)/36;
      const y = value => h*(26-value)/52;
      for (const tick of [-20,-10,0,10,20]) line([[0,y(tick)],[w,y(tick)]],1,tick?'#dfddd6':'#a29d94');
      for (const tick of [-15,-10,-5,0,5,10,15]) line([[x(tick),0],[x(tick),h]],1,tick?'#dfddd6':'#a29d94');
      const path = points.map(point => [x(point.x),y(point.y)]);
      line(path,1.2,'#8b8880');
      const {current,selectedDays} = state();
      for (const index of selectedDays) {
        const [px,py] = path[index];
        if (rows[index].spots) dot(px,py,1.8,'#292722');
        else {
          dot(px,py,2.6,'#292722');
          dot(px,py,1.45,'#f5f3ed');
        }
      }
      if (current !== null) {
        const [px,py] = path[current];
        dot(px,py,9,'#f5f3ed');
        line(ellipse(px,py,8),1.2,'#b93820',true);
        dot(px,py,4.4,'#b93820');
      }
    });
  }

  function disk(canvas, state) {
    return surface(canvas, ({w,h,line,dot}) => {
      const row = state();
      if (!row) return;
      const x=w/2, y=h/2, radius=Math.min(w,h)*0.43;
      if (!row.spots) {
        const outline = ellipse(x,y,radius,radius,28);
        for (let i=0;i<outline.length;i+=2) line([outline[i],outline[i+1]],1.5,'#b0a69d');
        return;
      }
      dot(x,y,radius,'#b55332');
      dot(x-radius*.035,y-radius*.035,radius*.91,'#d97e4f');
      dot(x-radius*.07,y-radius*.07,radius*.78,'#e99d68');
      for (const [px,py,area] of row.spots) dot(x+px*radius,y-py*radius,Math.max(1.2,Math.sqrt(area)*radius/60),'#2d201d');
    });
  }

  function portrait(canvas) {
    surface(canvas, ({w,h,polygon}) => polygon([[0,0],[w,0],[w,h],[0,h]],'#ffffff'), {fragment:solarFragment,fallback:false});
  }

  return {surface,ellipse,chart,disk,portrait};
})();

SolarVisuals.portrait(document.getElementById('sun'));
