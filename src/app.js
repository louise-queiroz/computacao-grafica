
document.addEventListener('DOMContentLoaded', function () {
    const modelos = document.querySelectorAll('#menu-right .box1');

    modelos.forEach(modelo => {
        const canvasId = modelo.querySelector('canvas').id;
        const dataModel = modelo.dataset.model.replace(/^\.\/assets/, '../assets'); // Corrigido caminho

        // Renderizar automaticamente ao carregar a página
        loadModel(canvasId, dataModel);
    });
});

// Shaders
export const vertexShaderSource = `
    attribute vec4 a_position;
    attribute vec3 a_normal;
    attribute vec2 a_texCoord; // Coordenadas de textura
    uniform mat4 u_modelViewMatrix;
    varying vec3 v_normal;
    varying vec2 v_texCoord; // Passando coordenadas de textura
    void main() {
        gl_Position = u_modelViewMatrix * a_position;
        v_normal = mat3(u_modelViewMatrix) * a_normal;
        v_texCoord = a_texCoord; // Atribuindo coordenadas de textura
    }
`;

export const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 u_color;
    uniform sampler2D u_texture; // Uniform para a textura
    varying vec3 v_normal;
    varying vec2 v_texCoord; // Coordenadas de textura
    void main() {
        float light = dot(normalize(v_normal), vec3(0, 0, 1));
        float ambient = 0.1; // Luz ambiente
        vec4 textureColor = texture2D(u_texture, v_texCoord); // Aplica a textura
        gl_FragColor = textureColor * (light + ambient); // Luz ambiente e textura
    }
`;

function loadModel(canvasId, modelPath) {
    const canvas = document.getElementById(canvasId);
    const gl = canvas.getContext('webgl2');

    if (!gl) {
        console.error("WebGL não está disponível.");
        alert("WebGL não está disponível. Atualize seu navegador.");
        return;
    }

    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    if (program) {
        gl.useProgram(program);

        // Carregando o arquivo OBJ
        fetch(modelPath)
            .then(response => response.text())
            .then(objData => {
                const geometry = parseOBJ(objData); // Carregar OBJ como antes
                const mtlPath = modelPath.replace('.obj', '.mtl'); // Gerar o caminho para o arquivo MTL
                
                // Carregar o arquivo MTL
                fetch(mtlPath)
                    .then(response => response.text())
                    .then(mtlData => {
                        const materials = parseMTL(mtlData); // Obter materiais do MTL
                        const material = materials[0]; // Escolher o primeiro material (você pode ajustar isso)

                        // Carregando buffers de vértices
                        const positionBuffer = gl.createBuffer();
                        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.data.position), gl.STATIC_DRAW);

                        const normalBuffer = gl.createBuffer();
                        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
                        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.data.normal), gl.STATIC_DRAW);

                        // Coordenadas de textura (adicionando coordenadas de textura fixas para todos os vértices)
                        const texCoordBuffer = gl.createBuffer();
                        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
                        const texCoords = new Float32Array(geometry.data.position.length / 3 * 2);
                        for (let i = 0; i < texCoords.length; i += 2) {
                            texCoords[i] = (i / 2) % 2; // Repetindo a textura para todos os objetos
                            texCoords[i + 1] = Math.floor(i / 2) % 2;
                        }
                        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

                        // Atribuindo os buffers aos atributos do shader
                        const positionLocation = gl.getAttribLocation(program, 'a_position');
                        gl.enableVertexAttribArray(positionLocation);
                        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

                        const normalLocation = gl.getAttribLocation(program, 'a_normal');
                        gl.enableVertexAttribArray(normalLocation);
                        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
                        gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);

                        const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
                        gl.enableVertexAttribArray(texCoordLocation);
                        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
                        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

                        // Uniform locations
                        const colorLocation = gl.getUniformLocation(program, 'u_color');
                        const textureLocation = gl.getUniformLocation(program, 'u_texture');
                        const modelViewMatrixLocation = gl.getUniformLocation(program, 'u_modelViewMatrix');
                        
                        // Define cor com base no material MTL
                        gl.uniform4f(colorLocation, material.diffuse[0], material.diffuse[1], material.diffuse[2], 1.0);

                        // Configuração inicial do WebGL
                        gl.clearColor(0.5, 0.5, 0.5, 1.0); // Fundo cinza claro
                        gl.enable(gl.DEPTH_TEST);

                        // Carregar a textura
                        const texture = loadTexture(gl, '../assets/objs/texture.png'); // Altere o caminho para o correto

                        // Função de animação
                        let rotationAngle = 0;
                        function render() {
                            rotationAngle += 0.01; // Ajuste a velocidade de rotação

                            // Criação da matriz de rotação
                            const cos = Math.cos(rotationAngle);
                            const sin = Math.sin(rotationAngle);
                            const modelViewMatrix = new Float32Array([
                                cos,  0, sin, 0,
                                0,    1,  0,  0,
                               -sin,  0, cos, 0,
                                0,    0,  0,  1,
                            ]);

                            gl.uniformMatrix4fv(modelViewMatrixLocation, false, modelViewMatrix);
                            gl.uniform1i(textureLocation, 0); // Bind texture to texture unit 0

                            // Limpar e desenhar
                            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                            gl.drawArrays(gl.TRIANGLES, 0, geometry.data.position.length / 3);

                            requestAnimationFrame(render); // Continuar animação
                        }
                        render(); // Inicia a renderização
                    })
                    .catch(error => console.error("Erro ao carregar o arquivo MTL:", error));
            })
            .catch(error => console.error("Erro ao carregar o arquivo OBJ:", error));
    }
}

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Preencher com uma cor temporária até a textura ser carregada
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    
    const image = new Image();
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
    };
    image.src = url;

    return texture;
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Erro ao compilar o shader:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
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
        console.error("Erro ao criar o programa WebGL:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

export function parseOBJ(text) {
    const objPositions = [[0, 0, 0]];
    const objNormals = [[0, 0, 0]];
    const objIndices = [];

    let webglVertexData = [[], []]; // [positions, normals]
    const geometry = {
        data: {
            position: webglVertexData[0],
            normal: webglVertexData[1],
            index: objIndices, // Armazenar índices
        },
    };

    const keywords = {
        v(parts) {
            objPositions.push(parts.map(parseFloat));
        },
        vn(parts) {
            objNormals.push(parts.map(parseFloat));
        },
        f(parts) {
            const ptn = parts.map(part => part.split("/"));
            const idx = [];
            ptn.forEach(vertex => {
                const [posIdx, , normIdx] = vertex.map(Number);
                idx.push(webglVertexData[0].length / 3);
                webglVertexData[0].push(...objPositions[posIdx]);
                webglVertexData[1].push(...objNormals[normIdx]);
            });
            objIndices.push(...idx);
        }
    };

    const lines = text.split("\n");
    for (let line of lines) {
        line = line.trim();
        if (line === "" || line.startsWith("#")) continue;
        const [keyword, ...parts] = line.split(/\s+/);
        if (keywords[keyword]) keywords[keyword](parts);
    }

    // Geração de normais suavizadas (se necessário)
    if (webglVertexData[1].length === 0) {
        const normals = new Array(webglVertexData[0].length / 3).fill([0, 0, 1]);
        webglVertexData[1] = [].concat(...normals);
    }

    return geometry;
}

export function parseMTL(text) {
    const materials = [];
    const lines = text.split("\n");
    let currentMaterial = null;

    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith("newmtl ")) {
            if (currentMaterial) materials.push(currentMaterial);
            currentMaterial = { name: line.split(" ")[1] };
        } else if (currentMaterial) {
            if (line.startsWith("Kd ")) {
                currentMaterial.diffuse = line.split(" ").slice(1).map(parseFloat);
            }
        }
    });

    if (currentMaterial) materials.push(currentMaterial); // Adiciona o último material
    return materials;
}
