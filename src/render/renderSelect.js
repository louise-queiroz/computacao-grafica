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
    0: { path: "textura1.jpg" },
    1: { path: "textura2.jpg" }
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
}

export async function loadObj(gl, objAddress) {
  twgl.setAttributePrefix("a_");
  const parts = await loadTexture(gl, objAddress, "dungeon_texture.png");

  const extents = getGeometriesExtents(parts[0].obj.geometries);
  const range = m4.subtractVectors(extents.max, extents.min);

  const objOffset = m4.scaleVector(
    m4.addVectors(extents.min, m4.scaleVector(range, 0.5)),
    -1
  );

  const cameraTarget = [0, 0, 0];

  let scale = 1.2;
  const radius = m4.length(range) * scale;
  console.log(scale)

  const cameraPosition = m4.addVectors(cameraTarget, [0, 0, radius]);
  const zNear = radius / 100;
  const zFar = radius * 3;

  let u_lightDirections = [m4.normalize([-1, 3, 5])
];

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
  };
}

export async function drawObj(gl) {
  function render(time) {
    if (objDataScene.length != 0) {
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
        let u_world = m4.yRotation(objectOnScene.yrotation ? objectOnScene.yrotation : time);
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

  let rotation = document.getElementById("rotation")
  let scalebtn = document.getElementById("scale")

  let translationX = document.getElementById("translateXButton")
  let translationY = document.getElementById("translateYButton")
  let translationZ = document.getElementById("translateZButton")

  let texture1Btn = document.getElementById("texture1Btn");
  let texture2Btn = document.getElementById("texture2Btn");

  rotation.onchange = function () {
      objDataScene[buttonIndex].yrotation = rotation.value;                                                            
  }

  scalebtn.onchange = function () {
      objDataScene[buttonIndex].scale = parseFloat(scalebtn.value)
      console.log(objDataScene[buttonIndex].scale = parseFloat(scalebtn.value))
  }

  translationX.onchange = function () {
    objDataScene[buttonIndex].objOffset[0] = parseFloat(translationX.value);
  }
  
  translationY.onchange = function () {
    objDataScene[buttonIndex].objOffset[1] = parseFloat(translationY.value);
  }
  
  translationZ.onchange = function () {
    objDataScene[buttonIndex].objOffset[2] = parseFloat(translationZ.value);
  }

  texture1Btn.onclick = async function () {
    objDataScene[buttonIndex].parts = await loadTexture(
        gl,
        objDataScene[buttonIndex].indexAdress,
        objTextures[0].path 
    );
    console.log(`Textura aplicada: ${objTextures[0].path}`);
};

  texture2Btn.onclick = async function () {
    objDataScene[buttonIndex].parts = await loadTexture(
        gl,
        objDataScene[buttonIndex].indexAdress,
        objTextures[1].path
    );
    console.log(`Textura aplicada: ${objTextures[1].path}`);
};


}   
document.getElementById("btnLimpar").addEventListener("click", () => {
  clearCanvas(gl); 
});

export async function clearCanvas(gl) {
  savedSceneState.objDataScene = [...objDataScene];
  savedSceneState.objectsOnScene = [...objectsOnScene];

  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.clearColor(0, 0, 0, 0);
  objDataScene = [];
  objectsOnScene = [];

  const buttonSelectedContainer = document.querySelector(".button-selected");
  if (buttonSelectedContainer) {
      buttonSelectedContainer.innerHTML = ""; 
      console.log("Buttons cleared from the DOM.");
  } 
}

export function restoreScene() {
  objDataScene = [...savedSceneState.objDataScene];
  objectsOnScene = [...savedSceneState.objectsOnScene];
}

document.getElementById("btnSalvar").addEventListener("click", saveSceneToJSON);
function saveSceneToJSON() {
  restoreScene()
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
  document.body.appendChild(fileInput); // Add the file input to the DOM
  fileInput.click();
  document.body.removeChild(fileInput); // Remove the file input after use
});
function loadSceneFromJSON(event) {
  const file = event.target.files[0];
  if (!file) {
      console.error("No file selected.");
      return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
      try {
          const contents = e.target.result;
          const loadedSceneState = JSON.parse(contents);

          // Validate the loaded data
          if (!Array.isArray(loadedSceneState.objDataScene)) {
              console.error("Invalid objDataScene:", loadedSceneState.objDataScene);
              return;
          }

          // Restore the scene state
          objDataScene = loadedSceneState.objDataScene;
          objectsOnScene = loadedSceneState.objectsOnScene;

          console.log("Scene loaded successfully:", loadedSceneState);

          // Re-render the scene
          drawObj(gl);
      } catch (error) {
          console.error("Error parsing JSON file:", error);
      }
  };
  reader.onerror = (e) => {
      console.error("Error reading file:", e.target.error);
  };
  reader.readAsText(file);
}

await drawObj(gl);