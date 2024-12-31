document.addEventListener('DOMContentLoaded', function () {
    const models = [
        { canvasId: 'canvas1', modelPath: '../assets/objs/bench.obj' },
        { canvasId: 'canvas2', modelPath: '../assets/objs/coffee_table.obj' },
        { canvasId: 'canvas3', modelPath: '../assets/objs/plant.obj' }
    ];

    models.forEach(({ canvasId, modelPath }) => {
        console.log(`Iniciando carregamento para ${canvasId} com modelo ${modelPath}`);
        loadModel(canvasId, modelPath);
    });
});

// Shaders
export const vertexShaderSource = `
attribute vec4 a_position;
attribute vec3 a_normal;
attribute vec2 a_texCoord;

uniform mat4 u_modelViewProjectionMatrix;
uniform mat4 u_normalMatrix;

varying vec3 v_normal;
varying vec2 v_texCoord;

void main() {
    gl_Position = u_modelViewProjectionMatrix * a_position;
    v_normal = mat3(u_normalMatrix) * a_normal;
    v_texCoord = a_texCoord;
}
`;

export const fragmentShaderSource = `
precision mediump float;

uniform sampler2D u_diffuseTexture;
uniform vec3 u_diffuseColor;
uniform vec3 u_ambientColor;

varying vec3 v_normal;
varying vec2 v_texCoord;

void main() {
    vec3 normal = normalize(v_normal);
    vec3 lightDirection = vec3(0.0, 0.0, 1.0);
    float diff = max(dot(normal, lightDirection), 0.0);
    vec3 diffuse = diff * u_diffuseColor;

    vec4 texColor = texture2D(u_diffuseTexture, v_texCoord);
    if (texColor.a < 0.1) discard;

    vec3 finalColor = diffuse + u_ambientColor * texColor.rgb;
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

function loadModel(canvasId, modelPath) {
    const canvas = document.getElementById(canvasId);
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        console.error(`WebGL não disponível para ${canvasId}`);
        return;
    }

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (!program) return;

    gl.useProgram(program);

    const mtlPath = modelPath.replace('.obj', '.mtl'); // Substituir .obj por .mtl
    Promise.all([
        fetch(modelPath).then(response => response.text()),
        loadMTL(mtlPath)
    ])
    .then(([objData, materials]) => {
        console.log(`Modelo ${modelPath} e materiais ${mtlPath} carregados com sucesso.`);
        const geometry = parseOBJ(objData);
        console.log(`Geometria processada:`, geometry);

        initializeBuffers(gl, program, geometry);

        // Configurar materiais
        if (materials) {
            applyMaterials(gl, program, materials);
        }

        animate(gl, program, geometry);
    })
    .catch(error => console.error(`Erro ao carregar o modelo ${modelPath}:`, error));
}

function initializeBuffers(gl, program, geometry) {
    console.log("Inicializando buffers...");

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.data.position), gl.STATIC_DRAW);

    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.data.normal), gl.STATIC_DRAW);

    console.log("Buffers de posição e normal criados.");

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    const normalLocation = gl.getAttribLocation(program, 'a_normal');
    gl.enableVertexAttribArray(normalLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);

    console.log("Atributos de vértices configurados.");
}

function animate(gl, program, geometry) {
    console.log("Iniciando renderização...");
    const modelViewMatrixLocation = gl.getUniformLocation(program, 'u_modelViewMatrix');
    let rotationAngle = 0;

    function render() {
        rotationAngle += 0.01;
        const cos = Math.cos(rotationAngle);
        const sin = Math.sin(rotationAngle);

        const modelViewMatrix = new Float32Array([
            cos, 0, sin, 0,
            0, 1, 0, 0,
            -sin, 0, cos, 0,
            0, 0, 0, 1,
        ]);

        gl.uniformMatrix4fv(modelViewMatrixLocation, false, modelViewMatrix);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, geometry.data.position.length / 3);
        requestAnimationFrame(render);
    }
    render();
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`Erro ao compilar o shader (${type}):`, gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    console.log(`Shader (${type}) compilado com sucesso.`);
    return shader;
}

function createProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Erro ao linkar programa WebGL:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    console.log("Programa WebGL criado e linkado com sucesso.");
    return program;
}

export function parseOBJ(text) {
    const positions = [];
    const normals = [];
    const vertexData = { position: [], normal: [] };

    text.split("\n").forEach(line => {
        const [type, ...data] = line.trim().split(/\s+/);
        if (type === "v") positions.push(data.map(Number));
        else if (type === "vn") normals.push(data.map(Number));
        else if (type === "f") {
            data.forEach(part => {
                const [posIndex, , normIndex] = part.split("/").map(Number);
                vertexData.position.push(...positions[posIndex - 1]);
                vertexData.normal.push(...normals[normIndex - 1]);
            });
        }
    });
    console.log("OBJ parseado com sucesso:", vertexData);
    return { data: vertexData };
}

function loadMTL(mtlPath) {
    return fetch(mtlPath)
        .then(response => response.text())
        .then(parseMTL)
        .catch(error => console.error(`Erro ao carregar o MTL ${mtlPath}:`, error));
}

export function parseMTL(text) {
    const materials = {};
    let currentMaterial = null;

    text.split("\n").forEach(line => {
        const [type, ...data] = line.trim().split(/\s+/);
        if (type === "newmtl") {
            currentMaterial = data[0];
            materials[currentMaterial] = {};
        } else if (currentMaterial) {
            switch (type) {
                case "Ns":
                    materials[currentMaterial].shininess = parseFloat(data[0]);
                    break;
                case "Ka":
                    materials[currentMaterial].ambient = data.map(parseFloat);
                    break;
                case "Kd":
                    materials[currentMaterial].diffuse = data.map(parseFloat);
                    break;
                case "Ks":
                    materials[currentMaterial].specular = data.map(parseFloat);
                    break;
                case "Ke":
                    materials[currentMaterial].emissive = data.map(parseFloat);
                    break;
                case "Ni":
                    materials[currentMaterial].opticalDensity = parseFloat(data[0]);
                    break;
                case "d":
                    materials[currentMaterial].opacity = parseFloat(data[0]);
                    break;
                case "illum":
                    materials[currentMaterial].illuminationModel = parseInt(data[0], 10);
                    break;
                case "map_Kd":
                    materials[currentMaterial].diffuseMap = data.join(" ");
                    break;
            }
        }
    });

    console.log("MTL parseado com sucesso:", materials);
    return materials;
}

function loadTexture(gl, path) {
    const texture = gl.createTexture();
    const image = new Image();

    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
    };

    image.onerror = () => {
        console.error(`Erro ao carregar a textura de ${path}`);
    };

    image.src = path;
    return texture;
}

function applyMaterials(gl, program, materials) {
    const diffuseColor = materials.diffuse || [1.0, 1.0, 1.0];
    const ambientColor = materials.ambient || [0.2, 0.2, 0.2];
    const diffuseTexture = materials.diffuseMap ? loadTexture(gl, materials.diffuseMap) : null;

    gl.uniform3fv(gl.getUniformLocation(program, 'u_diffuseColor'), new Float32Array(diffuseColor));
    gl.uniform3fv(gl.getUniformLocation(program, 'u_ambientColor'), new Float32Array(ambientColor));

    if (diffuseTexture) {
        gl.uniform1i(gl.getUniformLocation(program, 'u_diffuseTexture'), 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, diffuseTexture);
    }
}
