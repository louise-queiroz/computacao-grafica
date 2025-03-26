const canvas = document.getElementById("webglCanvas");
const gl = canvas.getContext("webgl");
if (!gl) {
    alert("WebGL not supported");
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const vertexShaderSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const fragmentShaderSource = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float uVolume;

// Basic SDF shapes
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz)-t.x, p.y);
    return length(q)-t.y;
}

float sdCylinder(vec3 p, float h, float r) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdCone(vec3 p, vec2 c) {
    float q = length(p.xz);
    return dot(c, vec2(q, p.y));
}

// Smooth interpolation
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0-h);
}

// Music displacement effect
float music_displacement(vec3 p, float vol) {
    float pulse = 6.2 + 0.3 * sin(time * 2.0) * vol;
    float distortion = 
        sin(3.0*p.x + time) * 
        cos(2.0*p.y + time*1.3) * 
        sin(4.0*p.z + time*0.7) * 0.3 * vol * pulse;
    return distortion;
}

// Main scene SDF
float sceneSDF(vec3 p) {
    // Base red sphere with music displacement (radius 1.0)
    float baseSphere = sdSphere(p, 1.0);
    baseSphere += music_displacement(p, uVolume);
    
    // Animation factor for interpolating objects
    float anim = smoothstep(0.0, 1.0, sin(time * 0.5) * 0.5 + 0.5);
    float smoothFactor = mix(0.0, 1.0, anim) * 0.8;
    
    // Calculate screen corners (normalized)
    vec2 screenCorner = vec2(resolution.x/resolution.y, 1.0) * 2.0;
    
    // Pair 1: Top-left corner (Sphere + Box)
    vec3 corner1 = vec3(-screenCorner.x, screenCorner.y, 0.0);
    float sphere1 = sdSphere(p - corner1 - vec3(mix(-0.5, 0.5, anim), 0.0, 0.0), 0.3);
    float box1 = sdBox(p - corner1 - vec3(mix(0.5, -0.5, anim), 0.0, 0.0), vec3(0.25));
    float pair1 = smin(sphere1, box1, smoothFactor);
    
    // Pair 2: Bottom-left corner (Cylinders)
    vec3 corner3 = vec3(-screenCorner.x, -screenCorner.y, 0.0);
    float cyl3a = sdCylinder(p - corner3 - vec3(mix(-0.4, 0.4, anim), 0.0, 0.0), 0.3, 0.2);
    float cyl3b = sdCylinder(p - corner3 - vec3(mix(0.4, -0.4, anim), 0.0, 0.0), 0.2, 0.3);
    float pair3 = smin(cyl3a, cyl3b, smoothFactor);
    
    // Combine only left-side pairs with the central sphere
    return min(baseSphere, min(pair1, pair3));
}

// Calculate normal
vec3 calcNormal(vec3 p) {
    const float eps = 0.001;
    return normalize(vec3(
        sceneSDF(vec3(p.x + eps, p.y, p.z)) - sceneSDF(vec3(p.x - eps, p.y, p.z)),
        sceneSDF(vec3(p.x, p.y + eps, p.z)) - sceneSDF(vec3(p.x, p.y - eps, p.z)),
        sceneSDF(vec3(p.x, p.y, p.z + eps)) - sceneSDF(vec3(p.x, p.y, p.z - eps))
    ));
}

void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / resolution.y;
    
    vec3 ro = vec3(0.0, 0.0, -3.0); // ray origin
    vec3 rd = normalize(vec3(uv, 1.0)); // ray direction
    
    float t = 0.0;
    int hitType = 0; // 0=miss, 1=sphere, 2=top-left, 3=bottom-left
    
    // raymarching
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        float d = sceneSDF(p);
        
        if (d < 0.001) {
            // Determine what we hit
            if (length(p) < 1.2) {
                hitType = 1; // Central sphere
            } else if (p.y > 0.0) {
                hitType = 2; // Top-left pair
            } else {
                hitType = 3; // Bottom-left pair
            }
            break;
        }
        
        t += d;
        if (t > 50.0) break;
    }
    
    // coloring 
    if (hitType > 0) {
        vec3 color;
        if (hitType == 1) {
            color = vec3(1.0, 0.0, 0.0); // Red for central sphere
        } else if (hitType == 2) {
            color = vec3(0.0, 1.0, 0.0); // Green for top-left pair
        } else {
            color = vec3(1.0, 1.0, 0.0); // Yellow for bottom-left pair
        }
        gl_FragColor = vec4(color, 1.0);
    } else {
        // White background
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
}
`;

// Função para criar shaders
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Erro ao compilar shader:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Função para criar o programa WebGL
function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
        console.error("Erro ao criar shaders.");
        return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Erro ao linkar programa:", gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
gl.useProgram(program);

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1,  1,
    -1,  1,  1, -1,  1,  1
]), gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

const resolutionLocation = gl.getUniformLocation(program, "resolution");
const timeLocation = gl.getUniformLocation(program, "time");
const volumeLocation = gl.getUniformLocation(program, "uVolume");

// Configuração de áudio simplificada
const audio = document.getElementById("audio");
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
const source = audioContext.createMediaElementSource(audio);

source.connect(analyser);
analyser.connect(audioContext.destination);

analyser.fftSize = 256;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

function render(time) {
    analyser.getByteFrequencyData(dataArray);
    const averageVolume = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
    gl.uniform1f(volumeLocation, averageVolume / 255.0);

    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, time * 0.001);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}

// Inicia a reprodução de áudio com tratamento de erro
audio.play().catch(e => console.error("Erro ao reproduzir áudio:", e));
requestAnimationFrame(render);