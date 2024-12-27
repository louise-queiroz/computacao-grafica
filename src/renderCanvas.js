import { parseOBJ, parseMTL, vertexShaderSource, fragmentShaderSource } from "./app.js";

document.addEventListener('DOMContentLoaded', function () {
    const modelos = document.querySelectorAll('#menu-right .box1');
    const canvas = document.getElementById("sceneCanvas");
    const gl = canvas.getContext("webgl2");

    if (!gl) {
        console.error("WebGL2 não está disponível.");
        return;
    }

    let modelosCarregados = [];  // Para armazenar os modelos carregados

    modelos.forEach(modelo => {
        modelo.addEventListener('click', () => {
            const modelPath = modelo.dataset.model.replace(/^\.\/assets/, '../assets'); // Ajuste o caminho para o modelo
            loadModel(gl, modelPath);
        });
    });

    // Função para carregar e renderizar o modelo no canvas
    function loadModel(gl, modelPath) {
        const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
        if (program) {
            gl.useProgram(program);

            // Carregar o arquivo OBJ
            fetch(modelPath)
                .then(response => response.text())
                .then(objData => {
                    const geometry = parseOBJ(objData);
                    const mtlPath = modelPath.replace('.obj', '.mtl'); // Gerar o caminho para o arquivo MTL

                    // Calcular a escala para manter o tamanho do modelo constante (ajustado para 0.2)
                    const scale = calculateScale(geometry) * 0.2; // Ajuste para tamanho menor

                    // Carregar o arquivo MTL
                    fetch(mtlPath)
                        .then(response => response.text())
                        .then(mtlData => {
                            const materials = parseMTL(mtlData);
                            const material = materials[0]; // Escolher o primeiro material

                            // Carregando buffers de vértices
                            const positionBuffer = gl.createBuffer();
                            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.data.position), gl.STATIC_DRAW);

                            const normalBuffer = gl.createBuffer();
                            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
                            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.data.normal), gl.STATIC_DRAW);

                            const positionLocation = gl.getAttribLocation(program, 'a_position');
                            gl.enableVertexAttribArray(positionLocation);
                            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                            gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

                            const normalLocation = gl.getAttribLocation(program, 'a_normal');
                            gl.enableVertexAttribArray(normalLocation);
                            gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
                            gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);

                            // Uniform locations
                            const colorLocation = gl.getUniformLocation(program, 'u_color');
                            const modelViewMatrixLocation = gl.getUniformLocation(program, 'u_modelViewMatrix');

                            // Definir cor com base no material MTL
                            gl.uniform4f(colorLocation, material.diffuse[0], material.diffuse[1], material.diffuse[2], 1.0);

                            // Adicionar o modelo à lista de modelos carregados
                            modelosCarregados.push({
                                geometry,
                                scale,
                                position: [Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1], // Posição aleatória para dispersar os objetos
                                rotationAngle: 0
                            });

                            // Função de animação para renderizar múltiplos modelos
                            function render() {
                                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  // Limpar a tela

                                // Renderizar todos os modelos carregados
                                modelosCarregados.forEach((modelo) => {
                                    modelo.rotationAngle += 0.01; // Incrementa a rotação do modelo

                                    // Criação da matriz de rotação
                                    const cos = Math.cos(modelo.rotationAngle);
                                    const sin = Math.sin(modelo.rotationAngle);
                                    const modelViewMatrix = new Float32Array([
                                        cos,  0, sin, 0,
                                        0,    1,  0, 0,
                                       -sin,  0, cos, 0,
                                        0,    0,  0, 1,
                                    ]);

                                    // Aplica a escala ao modelo
                                    const scaleMatrix = new Float32Array([
                                        modelo.scale, 0, 0, 0,
                                        0, modelo.scale, 0, 0,
                                        0, 0, modelo.scale, 0,
                                        0, 0, 0, 1
                                    ]);

                                    // Multiplicar a matriz de rotação com a matriz de escala
                                    multiplyMatrix(modelViewMatrix, scaleMatrix);

                                    // Aplica a translação para cada modelo
                                    const translationMatrix = new Float32Array([
                                        1, 0, 0, modelo.position[0],
                                        0, 1, 0, modelo.position[1],
                                        0, 0, 1, modelo.position[2],
                                        0, 0, 0, 1
                                    ]);
                                    multiplyMatrix(modelViewMatrix, translationMatrix);

                                    gl.uniformMatrix4fv(modelViewMatrixLocation, false, modelViewMatrix);
                                    gl.drawArrays(gl.TRIANGLES, 0, modelo.geometry.data.position.length / 3);
                                });

                                requestAnimationFrame(render); // Continuar animação
                            }
                            render(); // Inicia a renderização
                        })
                        .catch(error => console.error("Erro ao carregar o arquivo MTL:", error));
                })
                .catch(error => console.error("Erro ao carregar o arquivo OBJ:", error));
        }
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

    // Função para calcular a escala do modelo
    function calculateScale(geometry) {
        let maxDimension = 0;

        // Calcular a dimensão máxima do modelo
        for (let i = 0; i < geometry.data.position.length; i += 3) {
            const x = geometry.data.position[i];
            const y = geometry.data.position[i + 1];
            const z = geometry.data.position[i + 2];
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            maxDimension = Math.max(maxDimension, magnitude);
        }

        // Definir a escala com base na dimensão máxima
        const scaleFactor = 1.0 / maxDimension * 0.8; // Ajuste para manter o modelo dentro de um tamanho razoável
        return scaleFactor;
    }

    // Função para multiplicar duas matrizes 4x4
    function multiplyMatrix(a, b) {
        const result = new Float32Array(16);
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result[i * 4 + j] = 0;
                for (let k = 0; k < 4; k++) {
                    result[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
                }
            }
        }
        for (let i = 0; i < 16; i++) {
            a[i] = result[i];
        }
    }
});
