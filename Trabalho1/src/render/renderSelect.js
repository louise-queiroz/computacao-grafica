import { parseOBJ, parseMTL, vs, fs, degToRad, getGeometriesExtents } from "../basic/read.js";

let canvas = document.getElementById("sceneCanvas");
let gl = canvas.getContext("webgl2");

const meshProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);

export let objDataScene = [];
let objectsOnScene = [];
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
    { path: "../assets/objs/wood_box.obj" }
  ];


  let objTextures = {
    0: { path: "../assets/objs/texture.png" },
    1: { path: "../assets/objs/textura2.jpg" },
    2: { path: "../assets/objs/textura3.jpg" }
};


  let savedSceneState = {
    objDataScene: [],
    objectsOnScene: []
  };

  export async function renderSelect(index) {
    objectsOnScene.push({ objAddress: objAddresses[index] });
    const objData = await loadObj(
      gl,
      objectsOnScene[objectsOnScene.length - 1].objAddress
    );
    objectsOnScene[objectsOnScene.length - 1].objData = objData;
    callObjData();
  }
  
  async function callObjData() {
    objDataScene = objectsOnScene.map((obj) => {
      return obj.objData;
    });
  }
  
  async function loadTexture(gl, objAddress, urlTexture) {
    try {
      const objHref = objAddress.path;
      const response = await fetch(objHref);
      if (!response.ok) throw new Error(`Failed to fetch ${objHref}`);
      const text = await response.text();
      const obj = parseOBJ(text);
  
      const baseHref = new URL(objHref, window.location.href);
      const matTexts = await Promise.all(
        obj.materialLibs.map(async (filename) => {
          const matHref = new URL(filename, baseHref).href;
          const response = await fetch(matHref);
          if (!response.ok) throw new Error(`Failed to fetch ${matHref}`);
          return await response.text();
        })
      );
  
      const materials = parseMTL(matTexts.join("\n"));
  
      const texture = twgl.createTexture(gl, {
        src: urlTexture,
        flipY: true,
      });
  
      for (const material of Object.values(materials)) {
        material.diffuseMap = texture;
        material.specularMap = texture;
        material.normalMap = texture;
      }
  
      const defaultMaterial = {
        diffuse: [1, 1, 1],
        diffuseMap: texture,
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
  
      return parts;
    } catch (error) {
      console.error("Error loading texture:", error);
      return null;
    }
  }
  
  export async function loadObj(gl, objAddress, options = {}) {
    twgl.setAttributePrefix("a_");
    const parts = await loadTexture(gl, objAddress, "../assets/objs/texture.png");
  
    const extents = getGeometriesExtents(parts[0].obj.geometries);
    const range = m4.subtractVectors(extents.max, extents.min);
  
    // Use the saved position if provided, otherwise center the object
    const objOffset = options.objOffset || m4.scaleVector(
      m4.addVectors(extents.min, m4.scaleVector(range, 0.5)),
      -1
    );
  
    const cameraTarget = [0, 0, 0];
  
    let scale = options.scale || 1.2; // Use the saved scale if provided
  
    const radius = m4.length(range) * scale;
    console.log(scale);
  
    const cameraPosition = m4.addVectors(cameraTarget, [0, 0, radius]);
    const zNear = radius / 100;
    const zFar = radius * 3;
  
    let u_lightDirections = [m4.normalize([-1, 3, 5])];
  
    return {
      parts,
      meshProgramInfo,
      objOffset,
      cameraPosition,
      cameraTarget,
      zNear,
      zFar,
      range,
      radius,
      scale,
      extents,
      texturesAddresses: objAddress.textures,
      indexAdress: objAddress,
      u_lightDirections,
      yrotation: options.yrotation || 0, // Use the saved rotation if provided
    };
  }

export async function drawObj(gl) {
  function render(time) {
    if (objDataScene.length !== 0) {
      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
      gl.clearColor(0, 0, 0, 0);
      const fieldOfViewRadians = degToRad(60);
      const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

      for (const objectOnScene of objDataScene) {
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

        let u_world = m4.yRotation(objectOnScene.yrotation || 0);
        u_world = m4.scale(u_world, objectOnScene.scale, objectOnScene.scale, objectOnScene.scale);
        u_world = m4.translate(u_world, ...objectOnScene.objOffset);
        for (const { bufferInfo, vao, material } of objectOnScene.parts) {
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
  requestAnimationFrame(render);
}

export async function transformationOptions(buttonIndex) {
  if (buttonIndex < 0 || buttonIndex >= objDataScene.length) {
    console.error("Invalid buttonIndex:", buttonIndex);
    return;
  }

  let rotation = document.getElementById("rotation");
  let scalebtn = document.getElementById("scale");

  let translationX = document.getElementById("translateXButton");
  let translationY = document.getElementById("translateYButton");
  let translationZ = document.getElementById("translateZButton");

  let texture1Btn = document.getElementById("texture1Btn");
  let texture2Btn = document.getElementById("texture2Btn");

  objDataScene[buttonIndex].buttonData = {
    rotation: rotation.value,
    scale: parseFloat(scalebtn.value),
    translation: [
      parseFloat(translationX.value),
      parseFloat(translationY.value),
      parseFloat(translationZ.value),
    ],
    texture: objTextures[0].path,
  };

  rotation.onchange = function () {
    objDataScene[buttonIndex].yrotation = rotation.value;
    objDataScene[buttonIndex].buttonData.rotation = rotation.value;
  };

  scalebtn.onchange = function () {
    objDataScene[buttonIndex].scale = parseFloat(scalebtn.value);
    console.log("Scale updated to:", objDataScene[buttonIndex].scale);
    objDataScene[buttonIndex].buttonData.scale = parseFloat(scalebtn.value);
  };

  translationX.onchange = function () {
    objDataScene[buttonIndex].objOffset[0] = parseFloat(translationX.value);
    objDataScene[buttonIndex].buttonData.translation[0] = parseFloat(translationX.value);
  };

  translationY.onchange = function () {
    objDataScene[buttonIndex].objOffset[1] = parseFloat(translationY.value);
    objDataScene[buttonIndex].buttonData.translation[1] = parseFloat(translationY.value);
  };

  translationZ.onchange = function () {
    objDataScene[buttonIndex].objOffset[2] = parseFloat(translationZ.value);
    objDataScene[buttonIndex].buttonData.translation[2] = parseFloat(translationZ.value);
  };
  
  texturedefaultBtn.onclick = async function () {
    const newParts = await loadTexture(
      gl,
      objDataScene[buttonIndex].indexAdress,
      objTextures[0].path
    );
    if (newParts) {
      objDataScene[buttonIndex].parts = newParts;
      objDataScene[buttonIndex].buttonData.texture = objTextures[0].path;
    }
  };
  

  texture1Btn.onclick = async function () {
    const newParts = await loadTexture(
      gl,
      objDataScene[buttonIndex].indexAdress,
      objTextures[1].path
    );
    if (newParts) {
      objDataScene[buttonIndex].parts = newParts;
      objDataScene[buttonIndex].buttonData.texture = objTextures[1].path;
    }
  };
  
  texture2Btn.onclick = async function () {
    const newParts = await loadTexture(
      gl,
      objDataScene[buttonIndex].indexAdress,
      objTextures[2].path
    );
    if (newParts) {
      objDataScene[buttonIndex].parts = newParts;
      objDataScene[buttonIndex].buttonData.texture = objTextures[2].path;
    }
  };
}

document.getElementById("btnLimpar").addEventListener("click", () => {
  clearCanvas(gl); 
});

function updateSavedScene() {
  savedSceneState.objDataScene = [...objDataScene];
  savedSceneState.objectsOnScene = [...objectsOnScene];

  console.log("Scene state updated:", savedSceneState);
}

export async function clearCanvas(gl) {
  savedSceneState.objDataScene = [...objDataScene];
  savedSceneState.objectsOnScene = [...objectsOnScene];
  objDataScene.forEach(obj => {
    obj.parts.forEach(part => {
      gl.deleteBuffer(part.bufferInfo.attribs.a_position.buffer);
      gl.deleteVertexArray(part.vao);
    });
  });

  gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
  gl.clearColor(0, 0, 0, 0);
  objDataScene = [];
  objectsOnScene = [];

  const buttonSelectedContainer = document.querySelector(".button-selected");
  if (buttonSelectedContainer) {
    buttonSelectedContainer.innerHTML = "";
    console.log("Buttons cleared from the DOM.");
  }
}

document.getElementById("btnSalvar").addEventListener("click", saveSceneToJSON);

function saveSceneToJSON() {
  savedSceneState.objDataScene = objDataScene.map(obj => ({
    ...obj,
    yrotation: obj.yrotation || 0,
    scale: obj.scale || 1,
    objOffset: obj.objOffset || [0, 0, 0],
  }));
  savedSceneState.objectsOnScene = objectsOnScene;

  console.log("Saved Scene State:", savedSceneState);

  const sceneData = JSON.stringify(savedSceneState, null, 2);
  const blob = new Blob([sceneData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "saved_scene.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
document.getElementById("btnCarregar").addEventListener("click", () => {
  console.log("btnCarregar clicked");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json";
  fileInput.addEventListener("change", loadSceneFromJSON);
  document.body.appendChild(fileInput); 
  fileInput.click();
  document.body.removeChild(fileInput); 
});


function loadButtonsFromJSON(loadedSceneState) {
  const buttonSelectedContainer = document.querySelector(".button-selected");
  
  if (!Array.isArray(loadedSceneState.objDataScene)) {
      console.error(" Erro: objDataScene não é um array válido.");
      return;
  }

  buttonSelectedContainer.innerHTML = "";

  loadedSceneState.objDataScene.forEach((obj, index) => {
      const titles = [
          "Barril", "Cama", "Estante", "Tigela", "Vela",
          "Frasco", "Prato", "Tocha", "Vinho", "Caixa"
      ];
      const title = titles[index] || `Objeto ${index}`;

      const newButton = document.createElement("button");
      newButton.textContent = title;
      
      newButton.addEventListener("click", function () {
          console.log("🔘 Botão clicado, índice:", index);
          transformationOptions(index);
          document.querySelectorAll(".button-selected button").forEach(btn => btn.classList.remove("button-selected"));
          newButton.classList.add("button-selected");
      });

      buttonSelectedContainer.appendChild(newButton);
      console.log("Botão recriado:", title);
  });

  console.log(" Todos os botões foram carregados!");
}

async function loadSceneFromJSON(event) {
  const file = event.target.files[0];
  if (!file) {
    console.error("Nenhum arquivo selecionado.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const contents = e.target.result;
      const loadedSceneState = JSON.parse(contents);

      console.log("Dados carregados do JSON:", loadedSceneState);

      if (!Array.isArray(loadedSceneState.objDataScene)) {
        console.error("Erro: Estrutura do JSON inválida.");
        return;
      }

      await clearCanvas(gl);
      objDataScene = [];
      objectsOnScene = [];

      for (const obj of loadedSceneState.objectsOnScene) {
        const objData = await loadObj(gl, obj.objAddress, {
          objOffset: obj.objOffset,
          scale: obj.scale,
          yrotation: obj.yrotation,
        });

        if (!objData) {
          console.error("Erro ao carregar o objeto:", obj.objAddress);
          continue;
        }

        objDataScene.push({
          ...objData,
          yrotation: obj.yrotation !== undefined ? obj.yrotation : objData.yrotation,
          scale: obj.scale !== undefined ? obj.scale : objData.scale,
          objOffset: Array.isArray(obj.objOffset) 
            ? obj.objOffset.map(parseFloat) 
            : Array.from(objData.objOffset)
        });

        objectsOnScene.push({ objAddress: obj.objAddress, objData });
      }

      console.log("🎉 Cena carregada com sucesso!");

      loadButtonsFromJSON(loadedSceneState);
      drawObj(gl);
    } catch (error) {
      console.error("Erro ao processar o arquivo JSON:", error);
    }
  };

  reader.onerror = (e) => {
    console.error("Erro ao ler o arquivo:", e.target.error);
  };

  reader.readAsText(file);
}


await drawObj(gl);