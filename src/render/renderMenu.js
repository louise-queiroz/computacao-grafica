import { parseOBJ, parseMTL, vs, fs } from "../basic/read.js";
import { degToRad, getGeometriesExtents } from "../basic/read.js";

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

let objAddresses = [
  { path: "../assets/objs/barrel_3.obj"},
    { path: "../assets/objs/bed.obj" },
    { path: "../assets/objs/bookshelf_1.obj" },
    { path: "../assets/objs/bowl.obj" },
    { path: "../assets/objs/candles.obj" },
    { path: "../assets/objs/flask_2.obj" },
    { path: "../assets/objs/plate.obj" },
    { path: "../assets/objs/torch.obj" },
    { path: "../assets/objs/wine.obj" },
    { path: "../assets/objs/wood_box.obj" },
];

async function renderMenu() {
  for(let i = 0; i < Math.min(idCanvas.length, objAddresses.length); i++) {
    let canvas = document.getElementById(idCanvas[i]);
    let gl = canvas.getContext("webgl2");
    let objAddress = objAddresses[i];
    const objData = await loadObj(gl, objAddress);
    drawObj(gl, objData);
  }
}

async function loadObj(gl, objAddress) {
  const meshProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);
  twgl.setAttributePrefix("a_");

  const objHref = objAddress.path;
  const response = await fetch(objHref);
  const text = await response.text();
  const obj = parseOBJ(text);
  if (!obj || !obj.geometries) {
    console.error("Objeto não possui geometrias:", obj);
    return;
  }
  

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
    defaultRed: twgl.createTexture(gl, { src: [255, 0, 0, 255] }), // Cor vermelha
  };

    // Caminho da textura única
    const texturePath = "../assets/objs/textura.png";

    // Carregar e aplicar a mesma textura para todos os materiais
    for (const material of Object.values(materials)) {
    // Cria uma textura para a textura única
    let texture = textures[texturePath];
    
    if (!texture) {
        texture = twgl.createTexture(gl, {
        src: texturePath,
        flipY: true,
        });
        textures[texturePath] = texture;
    }

    // Aplicar a textura ao material
    material.diffuseMap = texture;
    material.specularMap = texture;  // Caso tenha esse tipo de mapa, aplique também.
    material.normalMap = texture;    // Caso tenha um mapa de normal, aplique também, se necessário.
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
    const vao = twgl.createVAOFromBufferInfo(
      gl,
      meshProgramInfo,
      bufferInfo
    );

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
  // deslocamento do objeto para o centro
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

function drawObj(gl, { parts, meshProgramInfo, objOffset, cameraPosition, cameraTarget, zNear, zFar }) {
  function render(time) {
    time *= 0.001; 

    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.clearColor(0, 0, 0, 0);

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
    function render(time) {
      if (objDataScene.length !== 0) {
          time *= 0;
          twgl.resizeCanvasToDisplaySize(gl.canvas);
          gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
          gl.enable(gl.DEPTH_TEST);
          gl.clear(gl.DEPTH_BUFFER_BIT);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.clearColor(0, 0, 0, 0);
          const fieldOfViewRadians = degToRad(60);
          const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  
          for (const objectOnScene of objDataScene) {
              console.log("Rendering object:", objectOnScene); // Debug log
  
              const projection = m4.perspective(
                  fieldOfViewRadians,
                  aspect,
                  objectOnScene.zNear,
                  objectOnScene.zFar
              );
              const up = [0, 1, 0];
              const camera = m4.lookAt(
                  objectOnScene.cameraPosition,
                  objectOnScene.cameraTarget,
                  up
              );
              const radius = m4.length(objectOnScene.range) * objectOnScene.scale;
              const view = m4.inverse(camera);
              const sharedUniforms = {
                  u_lightDirection: m4.normalize([-1, 3, 5]),
                  u_view: view,
                  u_projection: projection,
                  u_viewWorldPosition: objectOnScene.cameraPosition,
              };
              gl.useProgram(meshProgramInfo.program);
              twgl.setUniforms(meshProgramInfo, sharedUniforms);
  
              // Create a scaling matrix
              const scaleMatrix = m4.scaling([objectOnScene.scale, objectOnScene.scale, objectOnScene.scale]);
  
              // Apply transformations in the correct order: scale -> rotate -> translate
              let u_world = m4.identity(); // Start with an identity matrix
              u_world = m4.multiply(u_world, scaleMatrix); // Apply scale
              u_world = m4.multiply(u_world, m4.yRotation(objectOnScene.yrotation || time)); // Apply rotation
              u_world = m4.translate(u_world, ...objectOnScene.objOffset); // Apply translation
  
              for (const { bufferInfo, vao, material } of objectOnScene.parts) {
                  console.log("Rendering part:", bufferInfo, vao, material); // Debug log
  
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
          }
          requestAnimationFrame(render);
      } else {
          requestAnimationFrame(render);
      }
  }
    gl.useProgram(meshProgramInfo.program);
    twgl.setUniforms(meshProgramInfo, sharedUniforms);
    
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

renderMenu();
