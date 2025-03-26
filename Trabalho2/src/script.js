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
uniform vec2 canvasSize;

// ===== CONTROLE DE CENAS =====
float sceneTimer() {
    return mod(time, 50.0);
}

int currentScene() {
    float t = sceneTimer();
    if (t < 15.0) return 1; // Cena 1
    else if (t < 30.0) return 2; // Cena 2
    else return 3; // Cena 3
}

float sceneTransitionProgress() {
    float t = sceneTimer();
    if (t < 14.0) return 2.0; // Cena 3
    else if (t < 15.0) return 2.0 - (t-14.0); 
    else if (t < 29.0) return 1.0; 
    else if (t < 30.0) return 1.0 - (t-29.0); // Transição 2→3 (1s)
    else return 0.0;
}

// ================= UTILITY FUNCTIONS =================
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

// ================= SCENE 1 - MODIFIED =================
float distance_from_sphere(vec3 p, vec3 c, float r) {
    return length(p - c) - r;
}

vec3 repeat(vec3 p, float c, float density) {
    // Added density parameter to control sphere quantity
    return mod(p + 0.5*c*density, c*density) - 0.5*c*density;
}

float music_displacement(vec3 p, float vol) {
    float pulse = 6.2 + 0.3 * sin(time * 2.0) * vol;
    float distortion = 
        sin(3.0*p.x + time) * 
        cos(2.0*p.y + time*1.3) * 
        sin(4.0*p.z + time*0.7) * 0.3 * vol * pulse;
    return distortion;
}

float map_scene1(vec3 p) {
    // Increased cell size and added density control
    float cellSize = 5.0 + sin(time*0.3)*0.5;
    float density = 0.7; // Reduces quantity of spheres
    vec3 repeatedPos = repeat(p, cellSize, density);
    
    // Reduced sphere size from 1.0 to 0.6
    float sphere = distance_from_sphere(repeatedPos, vec3(0.0), 0.5);
    return sphere + music_displacement(p, uVolume) * 0.8;
}

vec3 calculate_normal_scene1(vec3 p) {
    const vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map_scene1(p + e.xyy) - map_scene1(p - e.xyy),
        map_scene1(p + e.yxy) - map_scene1(p - e.yxy),
        map_scene1(p + e.yyx) - map_scene1(p - e.yyx)
    ));
}

vec3 apply_lighting_scene1(vec3 p, vec3 normal, float vol) {
    vec3 pink_light = vec3(1.0, 0.4, 0.7);
    vec3 purple_light = vec3(0.7, 0.4, 1.0);
    
    vec3 light1_dir = normalize(vec3(sin(time*0.5), -0.7, cos(time*0.3)));
    vec3 light2_dir = normalize(vec3(cos(time*0.2), -0.5, sin(time*0.4)));
    
    float diff1 = max(0.0, dot(normal, -light1_dir));
    float diff2 = max(0.0, dot(normal, -light2_dir));
    
    // Reduced glow intensity
    float glow = 0.1 + 0.2 * (1.0 + sin(time*2.0)) * vol;
    
    vec3 col = mix(pink_light, purple_light, 0.5 + 0.5*sin(time*0.5));
    col *= (diff1 * 1.2 + diff2 * 0.8 + glow); // Reduced light intensity
    
    // More subtle bloom effect
    float bloom = smoothstep(0.4, 0.8, vol) * 0.4;
    col += bloom * pink_light;
    
    return col * (1.0 + vol*0.3); // Reduced volume impact
}

vec3 render_scene1(vec3 ro, vec3 rd) {
    const int steps = 80;
    const float min_hit = 0.001;
    const float max_dist = 100.0;
    
    float total_dist = 0.0;
    
    for (int i = 0; i < steps; i++) {
        vec3 p = ro + total_dist * rd;
        float dist = map_scene1(p);
        
        if (dist < min_hit) {
            vec3 normal = calculate_normal_scene1(p);
            vec3 color = apply_lighting_scene1(p, normal, uVolume);
            
            // Increased fog density
            float fog = exp(-0.03 * total_dist);
            return mix(vec3(0.3, 0.1, 0.4), color, fog);
        }
        
        if (total_dist > max_dist) break;
        total_dist += dist;
    }
    
    // Darker background gradient
    vec2 uv = rd.xy * 0.5 + 0.5;
    return mix(vec3(0.3, 0.1, 0.4), vec3(0.15, 0.0, 0.25), uv.y);
}

// ================= SCENE 2 (Rotating Glowing Cubes) =================
mat3 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat3(
        oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
        oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
        oc * axis.z * axis.x - axis.y * s,   oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
    );
}

float map_scene2(vec3 p) {
    float cubeSize = 0.4;
    
    // Create corridor effect by stretching z-axis
    float corridorLength = 50.0;
    p.z = mod(p.z - time*2.0, corridorLength*2.0) - corridorLength;
    
    // Spiral transformation
    float spiralRadius = 3.0 + sin(time*0.3)*0.5;
    float spiralSpeed = 0.5;
    float angle = p.z * 0.3 + time * spiralSpeed;
    
    // Position cubes in a spiral
    vec3 spiralPos = p;
    spiralPos.x += sin(angle) * spiralRadius;
    spiralPos.y += cos(angle) * spiralRadius;
    
    // Grid arrangement in the spiral
    vec3 gridPos = mod(spiralPos + 1.5, 3.0) - 1.5;
    
    // Rotate each cube
    mat3 rot = rotationMatrix(normalize(vec3(1.0, 1.0, 0.0)), time * 0.5);
    vec3 rotatedPos = rot * gridPos;
    
    // Base cube with audio-reactive size
    float size = cubeSize * (0.8 + 0.2 * uVolume);
    float cube = sdBox(rotatedPos, vec3(size));
    
    // Add glow effect
    float glow = length(gridPos) * 0.03;
    
    return cube - glow;
}

vec3 calculate_normal_scene2(vec3 p) {
    vec2 e = vec2(0.001, 0.0);
    return normalize(vec3(
        map_scene2(p + e.xyy) - map_scene2(p - e.xyy),
        map_scene2(p + e.yxy) - map_scene2(p - e.yxy),
        map_scene2(p + e.yyx) - map_scene2(p - e.yyx)
    ));
}

vec3 apply_lighting_scene2(vec3 p, vec3 normal, float vol) {
    // Tunnel color scheme
    vec3 color1 = vec3(0.1, 0.5, 0.8);
    vec3 color2 = vec3(0.8, 0.2, 0.5);
    
    // Dynamic lighting moving through tunnel
    vec3 lightDir = normalize(vec3(sin(time*0.7), cos(time*0.5), 1.0));
    
    float diff = max(0.0, dot(normal, lightDir));
    
    // Glow effect
    float glow = smoothstep(0.1, 0.0, map_scene2(p)) * 3.0 * (0.2 + 0.2 * vol);
    
    // Color variation along the tunnel
    float hue = 0.5 + 0.3 * sin(p.z * 0.1 + time * 0.5);
    vec3 baseColor = mix(color1, color2, hue);
    
    vec3 col = baseColor * (diff + 0.5);
    col += glow * baseColor;
    
    // Add pulsing highlights
    float highlight = sin(time*15.0 + p.z*0.5) * vol * 0.5;
    col += max(0.0, highlight) * vec3(1.0, 1.0, 1.0);
    
    return col;
}

vec3 render_scene2(vec3 ro, vec3 rd) {
    // Move camera back to view the corridor
    ro.z -= 12.0;
    
    const int steps = 120; // More steps for longer corridor
    const float min_hit = 0.001;
    const float max_dist = 200.0;
    
    float total_dist = 0.0;
    
    for (int i = 0; i < steps; i++) {
        vec3 p = ro + total_dist * rd;
        float dist = map_scene2(p);
        
        if (dist < min_hit) {
            vec3 normal = calculate_normal_scene2(p);
            vec3 color = apply_lighting_scene2(p, normal, uVolume);
            
            // Fog that increases with distance
            float fog = exp(-0.005 * total_dist);
            return mix(vec3(0.0), color, fog);
        }
        
        if (total_dist > max_dist) break;
        total_dist += dist;
    }
    
    // Tunnel-like background gradient
    float bgFade = smoothstep(0.0, 0.5, abs(rd.z));
    vec3 bg = mix(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 0.1), bgFade);
    
    // Add motion lines for speed effect
    float lines = smoothstep(0.95, 1.0, sin(rd.x*100.0 + time*10.0));
    bg += lines * vec3(0.5, 0.7, 1.0) * 0.3;
    
    return bg;
}

// ===== CENA 3 - INTERPOLAÇÃO SIMPLES =====

// Funções SDF básicas
float sdSphere(vec3 p, float r) {
    return length(p) - r;
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

// Interpolação suave entre SDFs
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0-h);
}

// Função de repetição espacial
vec3 repeat(vec3 p, vec3 c) {
    return mod(p + 0.5*c, c) - 0.5*c;
}

// Cena principal com repetição
float sceneSDF(vec3 p) {
    // Animação com easing para entrada e saída suaves
    float anim = smoothstep(0.0, 1.0, sin(time * 0.5) * 0.5 + 0.5);
    
    // Fator de suavização que varia ao longo da animação
    float smoothFactor = smoothstep(0.0, 0.5, anim) * (1.0 - smoothstep(0.5, 1.0, anim));
    smoothFactor = mix(0.0, 1.0, smoothFactor) * 0.8; // Ajuste o 0.8 para controlar a intensidade
    
    // --- GRID INFINITO DE OBJETOS PEQUENOS ---
    vec3 gridPos = repeat(p, vec3(3.0, 3.0, 3.0));
    float gridSphere = sdSphere(gridPos - vec3(0.0, 0.0, 0.0), 0.2 + 0.1*sin(time));
    float gridBox = sdBox(gridPos - vec3(0.0, 0.0, 0.0), vec3(0.15 + 0.05*cos(time*0.7)));
    float grid = smin(gridSphere, gridBox, 0.3);
    
    // --- PAR CENTRAL (Esfera + Cubo) ---
    vec3 centerPos = vec3(0.0, 0.5, 0.0);
    float sphere = sdSphere(p - centerPos - vec3(mix(-2.5, 2.5, anim), 0.0, 0.0), 0.8);
    float box = sdBox(p - centerPos - vec3(mix(2.5, -2.5, anim), 0.0, 0.0), vec3(0.6));
    float center = smin(sphere, box, smoothFactor * 1.2); // Multiplicador ajustável
    
    // --- CANTO INFERIOR ESQUERDO (Torus + Cone) ---
    vec3 corner1 = vec3(-4.0, -2.0, 0.0);
    float torus = sdTorus(p - corner1 - vec3(0.0, mix(2.0, -2.0, anim), 0.0), vec2(0.7, 0.2));
    float cone = sdCone(p - corner1 - vec3(0.0, mix(-2.0, 2.0, anim), 0.0), vec2(0.4, 0.25));
    float pair1 = smin(torus, cone, smoothFactor * 0.9);
    
    // --- CANTO SUPERIOR DIREITO (Cilindros) ---
    vec3 corner2 = vec3(4.0, 3.0, 0.0);
    float cyl1 = sdCylinder(p - corner2 - vec3(mix(-1.5, 1.5, anim), 0.0, 0.0), 0.5, 0.3);
    float cyl2 = sdCylinder(p - corner2 - vec3(mix(1.5, -1.5, anim), 0.0, 0.0), 0.3, 0.5);
    float pair2 = smin(cyl1, cyl2, smoothFactor * 1.3);
    
    // --- CANTO INFERIOR DIREITO (Caixa + Esfera) ---
    vec3 corner3 = vec3(4.0, -2.0, 0.0);
    float box2 = sdBox(p - corner3 - vec3(mix(-1.5, 1.5, anim), 0.0, 0.0), vec3(0.4, 0.6, 0.4));
    float sphere2 = sdSphere(p - corner3 - vec3(mix(1.5, -1.5, anim), 0.0, 0.0), 0.5);
    float pair3 = smin(box2, sphere2, smoothFactor * 0.8);
    
    // --- CANTO SUPERIOR ESQUERDO (Torus + Caixa) ---
    vec3 corner4 = vec3(-4.0, 3.0, 0.0);
    float torus2 = sdTorus(p - corner4 - vec3(0.0, mix(1.5, -1.5, anim), 0.0), vec2(0.5, 0.1));
    float box3 = sdBox(p - corner4 - vec3(0.0, mix(-1.5, 1.5, anim), 0.0), vec3(0.3, 0.5, 0.3));
    float pair4 = smin(torus2, box3, smoothFactor * 1.1);
    
    // --- PADRÃO REPETIDO EM Z ---
    vec3 repeatedZ = p;
    repeatedZ.z = mod(p.z + 10.0, 20.0) - 10.0;
    float rings = sdTorus(repeatedZ - vec3(0.0, 0.0, 0.0), vec2(2.0 + sin(time)*0.5, 0.1));
    
    // Combina tudo
    return min(min(center, min(pair1, min(pair2, min(pair3, pair4)))), min(grid, rings));
}

vec3 calcNormal(vec3 p) {
    const float eps = 0.001;
    return normalize(vec3(
        sceneSDF(vec3(p.x + eps, p.y, p.z)) - sceneSDF(vec3(p.x - eps, p.y, p.z)),
        sceneSDF(vec3(p.x, p.y + eps, p.z)) - sceneSDF(vec3(p.x, p.y - eps, p.z)),
        sceneSDF(vec3(p.x, p.y, p.z + eps)) - sceneSDF(vec3(p.x, p.y, p.z - eps))
    ));
}

// Configuração da câmera com movimento
mat3 setCamera(vec3 ro, vec3 ta, float cr) {
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(sin(cr), cos(cr), 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = normalize(cross(cu, cw));
    return mat3(cu, cv, cw);
}

// Renderização com iluminação e cores atualizadas
vec3 render_scene3(vec3 ro, vec3 rd) {
    float d, t = 0.0;
    for(int i = 0; i < 80; i++) {
        vec3 p = ro + rd * t;
        d = sceneSDF(p);
        if(d < 0.001 || t > 50.0) break;
        t += d;
    }
    
    // Fundo preto (sem pulsação)
    if(t > 50.0) return vec3(0.0);
    
    float anim = sin(time * 0.5) * 0.5 + 0.5;
    vec3 p = ro + rd * t;
    vec3 normal = calcNormal(p);
    
    // Fonte de luz direcional
    vec3 lightDir = normalize(vec3(0.5, 1.0, -0.5));
    
    // Iluminação
    float diff = max(0.0, dot(normal, lightDir));
    float ambient = 0.3;
    float lighting = ambient + diff * 0.7;
    
    // Cores padronizadas
    vec3 baseColor;
    
    // Objetos do fundo (grid) - Cinza que pisca com a música
    if(length(repeat(p, vec3(3.0, 3.0, 3.0))) < 0.5) {
        float gridPulse = pow(uVolume, 4.0) * 5.0;
        baseColor = vec3(0.6) * (0.7 + gridPulse * abs(sin(time * 15.0)));
    }
    // Objetos interpolados - Cores quentes
    else if(distance(p, vec3(0.0, 0.5, 0.0)) < 3.0) {        // Par central
        baseColor = mix(vec3(1.0, 0.2, 0.1),   // Vermelho
                      vec3(1.0, 0.6, 0.0),    // Laranja
                      smoothstep(0.0, 1.0, anim));
    } 
    else if(distance(p, vec3(-4.0, -2.0, 0.0)) < 2.0) {     // Canto inferior esquerdo
        baseColor = mix(vec3(1.0, 0.0, 0.5),   // Rosa
                      vec3(0.8, 0.1, 0.3),    // Vinho
                      smoothstep(0.0, 1.0, anim));
    }
    else if(distance(p, vec3(4.0, 3.0, 0.0)) < 2.0) {       // Canto superior direito
        baseColor = mix(vec3(1.0, 0.8, 0.0),   // Amarelo
                      vec3(1.0, 0.4, 0.0),    // Laranja
                      smoothstep(0.0, 1.0, anim));
    }
    else if(distance(p, vec3(4.0, -2.0, 0.0)) < 2.0) {      // Canto inferior direito
        baseColor = mix(vec3(1.0, 0.3, 0.1),   // Vermelho
                      vec3(0.7, 0.1, 0.2),    // Vinho
                      smoothstep(0.0, 1.0, anim));
    }
    else if(distance(p, vec3(-4.0, 3.0, 0.0)) < 2.0) {      // Canto superior esquerdo
        baseColor = mix(vec3(1.0, 0.5, 0.0),   // Laranja
                      vec3(1.0, 0.9, 0.1),    // Amarelo
                      smoothstep(0.0, 1.0, anim));
    }
    else {
        baseColor = vec3(0.6); // Cinza para objetos não identificados
    }
    
    // Aplicar iluminação
    vec3 color = baseColor * lighting;
    
    // Efeito de borda especial para os objetos do grid
    float rim = pow(1.0 - max(0.0, dot(normal, -rd)), 3.0);
    if(length(repeat(p, vec3(3.0, 3.0, 3.0))) < 0.5) {
        color += vec3(0.8) * rim * (1.0 + uVolume * 3.0); // Borda branca para o grid
    } else {
        // Borda mais suave para objetos interpolados
        color += baseColor * rim * 0.3;
    }
    
    return color;
}

// ================= MAIN RENDERER COM DOWNSAMPLING =================
void main() {
    // Fator de redução (2.0 = metade da resolução)
    const float reductionFactor = 2.0;
    
    // Coordenadas do pixel atual
    vec2 fragCoord = gl_FragCoord.xy;
    
    // Calcula coordenadas do pixel de referência (amostra central do bloco)
    vec2 sampleCoord = floor(fragCoord / reductionFactor) * reductionFactor + reductionFactor * 0.5;
    
    // Apenas calcula para o pixel central de cada bloco NxN
    if (fragCoord.x >= sampleCoord.x || fragCoord.y >= sampleCoord.y) {
        // Coordenadas UV normalizadas
        vec2 uv = (sampleCoord - 0.5 * resolution) / resolution.y;

        // Configuração da câmera
        vec3 ro, lookat;
        if (currentScene() == 3) {
            float cam_dist = 10.0 + sin(time*0.1)*2.0;
            ro = vec3(sin(time*0.2)*cam_dist, cos(time*0.1)*2.0, cos(time*0.2)*cam_dist);
            lookat = vec3(0.0);
        } else {
            float cam_dist = 10.0 + sin(time*0.1)*2.0;
            ro = vec3(sin(time*0.2)*cam_dist, cos(time*0.1)*2.0, cos(time*0.2)*cam_dist);
            lookat = vec3(0.0);
        }
        
        vec3 f = normalize(lookat - ro);
        vec3 r = cross(vec3(0.0, 1.0, 0.0), f);
        vec3 u = cross(f, r);
        vec3 rd = normalize(f + uv.x*r + uv.y*u);
        
        // Renderização das cenas
        vec3 color1 = render_scene1(ro, rd);
        vec3 color2 = render_scene2(ro, rd);
        vec3 color3 = render_scene3(ro, rd);
        
        // Transição entre cenas
        float transition = sceneTransitionProgress();
        vec3 finalColor;
        
        if (transition < 1.0) {
            finalColor = mix(color3, color2, transition);
        } else if (transition < 2.0) {
            finalColor = mix(color2, color1, transition-1.0);
        } else {
            finalColor = color1;
        }
        
        // Armazena o resultado para todos os pixels do bloco
        gl_FragColor = vec4(finalColor, 1.0);
        return;
    }
    
    // Para outros pixels, descarta (serão preenchidos pelo interpolation do framebuffer)
    discard;
}

`;

