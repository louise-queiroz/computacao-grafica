const canvas = document.getElementById("webglCanvas");
const gl = canvas.getContext("webgl");
if (!gl) {
    alert("WebGL not supported");
}

// Adjust canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Vertex Shader
const vertexShaderSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

// Fragment Shader
const fragmentShaderSource = `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;

    // Sphere SDF
    float sphere(vec3 p, float r) {
        return length(p) - r;
    }

    // Box SDF
    float box(vec3 p, vec3 b) {
        vec3 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
    }

    // Torus SDF
    float torus(vec3 p, vec2 t) {
        vec2 q = vec2(length(p.xz) - t.x, p.y);
        return length(q) - t.y;
    }

    // Rotate function
    mat2 rotate(float angle) {
        return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    }

    // Scene SDF
    float map(vec3 p) {
        // Rotate the scene over time
        p.xy *= rotate(time * 0.2);
        p.xz *= rotate(time * 0.1);

        // Add multiple shapes
        float sphereDist = sphere(p - vec3(sin(time), 0.0, cos(time)), 1.0);
        float boxDist = box(p - vec3(1.0, 1.0, 0.0), vec3(0.5, 0.5, 0.5));
        float torusDist = torus(p - vec3(-1.0, -1.0, 0.0), vec2(1.0, 0.3));

        // Combine shapes
        return min(min(sphereDist, boxDist), torusDist);
    }

    // Dynamic lighting
    vec3 light(vec3 p) {
        return normalize(vec3(sin(time * 0.5), cos(time * 0.5), 1.0));
    }

    // Raymarching
    vec3 rayMarching(vec3 ro, vec3 rd) {
        float t = 0.0;
        vec3 color = vec3(0.0);
        for (int i = 0; i < 100; i++) {
            vec3 p = ro + rd * t;
            float d = map(p);
            if (d < 0.001) {
                // Dynamic lighting and psychedelic colors
                vec3 l = light(p);
                color = vec3(
                    0.5 + 0.5 * cos(time + p.x),
                    0.5 + 0.5 * sin(time + p.y),
                    0.5 + 0.5 * cos(time + p.z)
                );
                return color * l;
            }
            t += d;
            if (t > 20.0) break;
        }
        return vec3(0.0); // Background color
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy - resolution * 0.5) / resolution.y;
        vec3 ro = vec3(sin(time) * 6.0, cos(time) * 2.0, cos(time) * 6.0); // Camera path
        vec3 rd = normalize(vec3(uv, 1.0));
        vec3 color = rayMarching(ro, rd);
        gl_FragColor = vec4(color, 1.0);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
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

function render(time) {
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, time * 0.001);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    requestAnimationFrame(render);
}
requestAnimationFrame(render);