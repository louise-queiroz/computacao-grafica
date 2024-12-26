import { parseOBJ, parseMTL, vs, fs } from "./read.js";
import { degToRad, getGeometriesExtents } from "./read.js";

canvas.width = 500;
canvas.height = 500;

// IDs dos canvases no menu
let idCanvas = [
  "canvas1",
  "canvas2",
  "canvas3",
  "canvas4",
  "canvas5",
  "canvas6",
  "canvas7",
  "canvas8",
  "canvas9",
  "canvas10"
];

// Caminhos dos arquivos OBJ
let objAddresses = [
  { path: "./assets/objs/carpet.obj" },
  { path: "./assets/objs/curtains.obj" },
  { path: "./assets/objs/floor_tiles.obj" },
  { path: "./assets/objs/picture_frames.obj" },
  { path: "./assets/objs/sofa.obj" },
  { path: "./assets/objs/TV.obj" },
  { path: "./assets/objs/window.obj" },
  { path: "./assets/objs/table.obj" },
  { path: "./assets/objs/tall_flower.obj" },
  { path: "./assets/objs/wall_lamp.obj" }
];

// Função para renderizar o menu
async function renderMenu() {
  for (let i = 0; i < Math.min(idCanvas.length, objAddresses.length); i++) {
    let canvas = document.getElementById(idCanvas[i]);
    let gl = canvas.getContext("webgl2");

    if (!gl) {
      console.error("WebGL2 não está disponível.");
      return;
    }

    // Definindo tamanho do canvas
    canvas.width = 800;
    canvas.height = 600;
    
    let objAddress = objAddresses[i];
    try {
      const objData = await loadObj(gl, objAddress);
      drawObj(gl, objData);
    } catch (error) {
      console.error(`Erro ao carregar e desenhar o modelo: ${objAddress.path}`, error);
    }
  }
}

// Função para carregar o modelo OBJ
async function loadObj(gl, objAddress) {
  const meshProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);
  twgl.setAttributePrefix("a_");

  const objHref = objAddress.path;
  const response = await fetch(objHref);
  const text = await response.text();
  const obj = parseOBJ(text);

  const baseHref = new URL(objHref, window.location.href);
  const matTexts = await Promise.all(
    obj.materialLibs.map(async (filename) => {
      const matHref = new URL(filename, baseHref).href;
      const response = await fetch(matHref);
      return await response.text();
    })
  );

  const materials = parseMTL(matTexts.join("\n"));

  const textures = {
    defaultWhite: twgl.createTexture(gl, { src: [255, 255, 255, 255] }),
  };

  // Carregar textura para os materiais
  for (const material of Object.values(materials)) {
    Object.entries(material)
      .filter(([key]) => key.endsWith("Map"))
      .forEach(([key, filename]) => {
        let texture = textures[filename];
        if (!texture) {
          const textureHref = new URL(filename, baseHref).href;
          texture = twgl.createTexture(gl, {
            src: textureHref,
            flipY: true,
          });
          textures[filename] = texture;
        }
        material[key] = texture;
      });
  }

  const defaultMaterial = {
    diffuse: [1, 1, 1],
    diffuseMap: textures.defaultWhite,
    ambient: [0, 0, 0],
    specular: [1, 1, 1],
    shininess: 400,
    opacity: 1,
  };

  const parts = obj.geometries.map(({ material, data }) => {
    if (data.color) {
      if (data.position.length === data.color.length) {
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      data.color = { value: [1, 1, 1, 1] };
    }

    const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
    const vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, bufferInfo);

    return {
      material: {
        ...defaultMaterial,
        ...materials[material],
      },
      bufferInfo,
      vao,
      obj,
    };
  });

  const extents = getGeometriesExtents(parts[0].obj.geometries);
  const range = m4.subtractVectors(extents.max, extents.min);
  // Deslocamento do objeto para o centro
  const objOffset = m4.scaleVector(
    m4.addVectors(extents.min, m4.scaleVector(range, 0.5)),
    -1
  );
  const cameraTarget = [0, 0, 0];
  const radius = m4.length(range) * 1.2;
  const cameraPosition = m4.addVectors(cameraTarget, [0, 0, radius]);
  const zNear = radius / 100;
  const zFar = radius * 3;

  return { parts, meshProgramInfo, objOffset, cameraPosition, cameraTarget, zNear, zFar };
}

// Função para desenhar o objeto no canvas
function drawObj(gl, { parts, meshProgramInfo, objOffset, cameraPosition, cameraTarget, zNear, zFar }) {
  function render(time) {
    time *= 0.001;

    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.clearColor(0.9, 0.9, 0.9, 1); // Fundo claro para contraste (quase branco)

    const fieldOfViewRadians = degToRad(60);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(
      fieldOfViewRadians,
      aspect,
      zNear,
      zFar
    );

    const up = [0, 1, 0];
    const camera = m4.lookAt(cameraPosition, cameraTarget, up);
    const view = m4.inverse(camera);

    const sharedUniforms = {
      u_lightDirections: m4.normalize([-1, 3, 5]),
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraPosition,
      u_lightStates: [1],
    };

    gl.useProgram(meshProgramInfo.program);
    twgl.setUniforms(meshProgramInfo, sharedUniforms);

    // Rotação contínua do objeto
    let u_world = m4.yRotation(time);
    u_world = m4.translate(u_world, ...objOffset);

    for (const { bufferInfo, vao, material } of parts) {
      gl.bindVertexArray(vao);
      twgl.setUniforms(
        meshProgramInfo,
        {
          u_world,
        },
        material
      );
      twgl.drawBufferInfo(gl, bufferInfo);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

// Iniciar o renderizador do menu
renderMenu();
