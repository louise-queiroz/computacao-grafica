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
uniform float uVolume; // Volume do áudio

// Função de rotação 2D
mat2 rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

// Função de distância para um plano (chão)
float mapFloor(vec3 p) {
    return p.y + 1.0; // Plano em y = -1.0
}

// Função de distância para um plano (teto)
float mapCeiling(vec3 p) {
    return 5.0 - p.y; // Plano em y = 5.0
}

// Função de distância para uma esfera
float mapSphere(vec3 p, vec3 center, float radius) {
    return length(p - center) - radius;
}

// Criar uma trilha de bolinhas ao redor da esfera principal
float mapDotTrailPink(vec3 p) {
    float minDist = 10.0;
    float baseRadius = 1.7; // Raio base
    float speed = 1.0;      // Velocidade de rotação
    float size = 0.1;       // Raio das bolinhas
    float radiusVariation = 1.5 * uVolume; // Variação do raio com base no volume

    for (int i = 0; i < 8; i++) {
        float angle = float(i) * 0.785 + time * speed; // Ângulo de rotação
        float radius = baseRadius + radiusVariation;   // Raio ajustado pelo volume
        vec3 dotCenter = vec3(cos(angle) * radius, 1.2, sin(angle) * radius); // Posição da bolinha
        float dotDist = mapSphere(p, dotCenter, size);
        minDist = min(minDist, dotDist);
    }

    return minDist;
}

// Criar uma trilha de bolinhas azuis ao redor da esfera principal
float mapDotTrailBlue(vec3 p) {
    float minDist = 10.0;
    float speed = -1.0;  // Igual ao lightSpotsBlue
    float size = 0.2;    // Raio das bolinhas (igual ao lightSpotsBlue)
    float radius = 2.5;  // Igual ao lightSpotsBlue
    float radiusVariation = 3.5 * uVolume; // Variação do raio com base no volume

    for (int i = 0; i < 12; i++) { // 12 bolinhas, igual ao lightSpotsBlue
        float angle = float(i) * 0.785 + time * speed + 0.393; // Mesmo cálculo de ângulo
        float radius = radius + radiusVariation;   // Raio ajustado pelo volume
        vec3 dotCenter = vec3(cos(angle) * radius, 0.5, sin(angle) * radius); // Posição das bolinhas
        float dotDist = mapSphere(p, dotCenter, size); // Distância para cada bolinha
        minDist = min(minDist, dotDist); // Mantém a menor distância
    }

    return minDist;
}

// Função de distância combinada
float map(vec3 p) {
    float floorDist = mapFloor(p);
    float ceilingDist = mapCeiling(p);
    float sphereDist = mapSphere(p, vec3(0.0, 1.2, 0.0), 1.0); // Esfera principal
    float dotsPinkDist = mapDotTrailPink(p); // Trilha de bolinhas rosas
    float dotsBlueDist = mapDotTrailBlue(p); // Trilha de bolinhas azuis

    return min(min(min(min(floorDist, ceilingDist), sphereDist), dotsPinkDist), dotsBlueDist);
}

// Função para calcular a normal em um ponto
vec3 calculateNormal(vec3 p) {
    float d = map(p);
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
    ));
}

// Efeito espelhado na esfera principal
vec3 mirrorBallEffect(vec3 p, vec3 rd) {
    vec3 normal = normalize(p - vec3(0.0, 1.2, 0.0)); // Normal da esfera principal
    vec3 reflected = reflect(rd, normal);
    return vec3(0.8 + 0.2 * sin(time + reflected.x * 10.0),
                0.8 + 0.2 * sin(time + reflected.y * 10.0),
                0.8 + 0.2 * sin(time + reflected.z * 10.0));
}

float lightSpotsPink(vec3 p) {
    float intensity = 0.0;
    float baseRadius = 1.7; // Raio base (igual ao das bolinhas)
    float speed = 1.0;      // Velocidade de rotação (igual ao das bolinhas)
    float size = 0.2;       // Tamanho das luzes
    float radiusVariation = 1.5 * uVolume; // Variação do raio com base no volume (igual ao das bolinhas)

    for (int i = 0; i < 8; i++) {
        float angle = float(i) * 0.785 + time * speed; // Ângulo de rotação (igual ao das bolinhas)
        float radius = baseRadius + radiusVariation;   // Raio ajustado pelo volume (igual ao das bolinhas)
        vec3 lightCenter = vec3(cos(angle) * radius, 1.2, sin(angle) * radius); // Posição da luz (igual ao das bolinhas)
        float dist = length(p.xz - lightCenter.xz);
        intensity += smoothstep(size, 0.0, dist);
    }

    return intensity;
}

float lightSpotsBlue(vec3 p) {
    float intensity = 0.0;
    float speed = -1.0;
    float size = 0.2;
    float radius = 2.5;
    float radiusVariation = 3.5 * uVolume; // Variação do raio com base no volume (igual ao das bolinhas)

    for (int i = 0; i < 12; i++) {
        float angle = float(i) * 0.785 + time * speed + 0.393;
        float radius = radius + radiusVariation;   // Raio ajustado pelo volume (igual ao das bolinhas)
        vec2 center = vec2(cos(angle), sin(angle)) * radius;
        float dist = length(p.xz - center);
        intensity += smoothstep(size, 0.0, dist);
    }
    return intensity;
}

// Função de iluminação
vec3 light(vec3 p) {
    return normalize(vec3(sin(time * 0.5), cos(time * 0.5), 1.0));
}

// Função para criar um padrão xadrez
vec3 checkerboard(vec2 uv, float scale) {
    vec2 scaledUV = uv * scale; // Ajusta o tamanho do xadrez
    vec2 pattern = floor(mod(scaledUV, 2.0)); // Cria o padrão xadrez
    float checker = mod(pattern.x + pattern.y, 2.0); // Alterna entre 0 e 1
    return mix(vec3(0.949, 0.580, 0.667),  vec3(0.9608, 0.4627, 0.6078), checker); // Cores do xadrez
}

// Raymarching
vec3 rayMarching(vec3 ro, vec3 rd) {
    float t = 0.0;
    vec3 color = vec3(0.0);
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.001) {
            // Verificar se atingimos a esfera principal
            if (mapSphere(p, vec3(0.0, 1.2, 0.0), 1.0) < 0.001) {
                color = mirrorBallEffect(p, rd);
            }
            // Verificar se atingimos uma bolinha rosa
            else if (mapDotTrailPink(p) < 0.001) {
                color = vec3(0.8196, 0.0, 0.3961);
            }
            // Verificar se atingimos uma bolinha azul
            else if (mapDotTrailBlue(p) < 0.001) {
                color = vec3(0.1922, 0.3373, 0.9216); // Azul
            }
            // Caso contrário, é o chão ou outro objeto
            else {
                // Cor do chão com reflexão (mantido igual)
                vec3 l = light(p);
                vec3 floorColor = vec3(
                    mix(1.0, 0.8, 0.7 + 0.5 * cos(time + p.x)),  // Rosa vibrante
                    mix(0.2, 0.5, 0.5 + 0.5 * sin(time + p.y)),  // Verde médio
                    mix(0.8, 1.0, 0.5 + 0.5 * cos(time + p.z))   // Azul elétrico
                ) * l;

                // Calcular reflexão
                vec3 normal = vec3(0.0, 1.0, 0.0); // Normal do chão (para cima)
                vec3 reflectedRay = reflect(rd, normal); // Refletir a direção do raio
                vec3 reflectionColor = mirrorBallEffect(p, reflectedRay); // Amostrar a reflexão da esfera

                // Adicionar efeitos de luz
                float pinkSpots = lightSpotsPink(p);
                float blueSpots = lightSpotsBlue(p);

                vec3 pinkColor = vec3(1.0, 0.5, 0.9) * pinkSpots; // Luz rosa
                vec3 blueColor = vec3(0.3, 0.6, 1.0) * blueSpots; // Luz azul

                // Misturar cor do chão com reflexão e efeitos de luz
                float reflectionStrength = 0.8; // Intensidade da reflexão
                color = mix(floorColor, reflectionColor, reflectionStrength) + pinkColor + blueColor;
            }
            return color;
        }
        t += d;
        if (t > 20.0) break;
    }

    // Fundo com padrão xadrez
    vec2 uv = (gl_FragCoord.xy - 0.8 * resolution) / resolution.y;
    return checkerboard(uv, 10.0); 
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;
    vec3 ro = vec3(0.0, 0.0, 5.0); // Posição da câmera
    vec3 rd = normalize(vec3(uv, -1.0)); // Direção do raio

    vec3 color = rayMarching(ro, rd);
    gl_FragColor = vec4(color, 1.0);
}`;

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

// Cria o programa WebGL
const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
gl.useProgram(program);

// Configura o buffer de vértices
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1,  1,
    -1,  1,  1, -1,  1,  1
]), gl.STATIC_DRAW);

const positionLocation = gl.getAttribLocation(program, "position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

// Obtém as localizações dos uniforms
const resolutionLocation = gl.getUniformLocation(program, "resolution");
const timeLocation = gl.getUniformLocation(program, "time");
const volumeLocation = gl.getUniformLocation(program, "uVolume");

/// Configura o áudio e o analisador
const audio = document.getElementById("audio");
audio.play().then(() => {
    console.log("Áudio iniciado com sucesso!");
}).catch((error) => {
    console.error("Erro ao reproduzir o áudio:", error);
});

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
const source = audioContext.createMediaElementSource(audio);

// Conexão direta do áudio ao analisador (sem filtro)
source.connect(analyser);
analyser.connect(audioContext.destination);

analyser.fftSize = 256;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

// Função de renderização
function render(time) {
    // Atualiza os dados de áudio
    analyser.getByteFrequencyData(dataArray);
    const averageVolume = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
    gl.uniform1f(volumeLocation, averageVolume / 255.0); // Normaliza o volume para [0, 1]

    // Passa os dados para o fragment shader
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, time * 0.001);

    // Renderiza a cena
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Solicita o próximo frame
    requestAnimationFrame(render);
}

// Inicia a renderização
requestAnimationFrame(render);