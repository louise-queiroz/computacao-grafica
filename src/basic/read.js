export function parseOBJ(text) {
    const objPositions = [[0, 0, 0]];
    const objTexcoords = [[0, 0]];
    const objNormals = [[0, 0, 0]];
    const objColors = [[0, 0, 0]];
  
    //Array retorna os dados do objetos
    const objVertexData = [objPositions, objTexcoords, objNormals, objColors];
  
    // arrays para armazenar os dados convertidos pro webgl
    let webglVertexData = [
      [], // positions
      [], // texcoords
      [], // normals
      [], // colors
    ];
  
    const materialLibs = []; // lista de arquivos .mtl a serem carregados
    const geometries = []; // lista de geometrias
    let geometry; // verifica se a geometria já existe
    let groups = ["default"]; // verifica se o grupo já existe
    let material = "default"; // verifica se o material já existe
    let object = "default"; // verifica se o objeto já existe
  
    const noop = () => {};
  
    function newGeometry() {
      // cria uma nova geometria se a geometria atual não estiver vazia
      if (geometry && geometry.data.position.length) {
        geometry = undefined;
      }
    }
  
    // define a geometria atual se não existir.
    function setGeometry() {
      if (!geometry) {
        const position = [];
        const texcoord = [];
        const normal = [];
        const color = [];
        webglVertexData = [position, texcoord, normal, color];
        geometry = {
          object,
          groups,
          material,
          data: {
            position,
            texcoord,
            normal,
            color,
          },
        };
        geometries.push(geometry);
      }
    }
  
    // adiciona um vértice aos arrays WebGL convertidos.
    function addVertex(vert) {
      const ptn = vert.split("/");
      ptn.forEach((objIndexStr, i) => {
        if (!objIndexStr) {
          return;
        }
        const objIndex = parseInt(objIndexStr);
        const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
        webglVertexData[i].push(...objVertexData[i][index]);
        // se este é o índice da posição (índice 0) e já analisamos
        // as cores dos vértices, então copie as cores dos vértices para os dados de cor do vértice WebGL
        if (i === 0 && objColors.length > 1) {
          geometry.data.color.push(...objColors[index]);
        }
      });
    }
  
    // conjunto de palavras-chave que podem ser encontradas em um arquivo .obj
    const keywords = {
      v(parts) {
        // v = vértice
        if (parts.length > 3) {
          // há cores
          objPositions.push(parts.slice(0, 3).map(parseFloat));
          objColors.push(parts.slice(3).map(parseFloat));
        } else {
          objPositions.push(parts.map(parseFloat));
        }
      },
      vn(parts) {
        // vn = normal do vértice
        objNormals.push(parts.map(parseFloat));
      },
      vt(parts) {
        // vt = coordenada de textura
        objTexcoords.push(parts.map(parseFloat));
      },
      f(parts) {
        // f = face
        setGeometry();
        const numTriangles = parts.length - 2;
        for (let tri = 0; tri < numTriangles; ++tri) {
          addVertex(parts[0]);
          addVertex(parts[tri + 1]);
          addVertex(parts[tri + 2]);
        }
      },
      s: noop, // s = suavização
      mtllib(parts, unparsedArgs) {
        // inclusão de arquivos de material
        materialLibs.push(unparsedArgs);
      },
      usemtl(parts, unparsedArgs) {
        // uso de material
        material = unparsedArgs;
        newGeometry();
      },
      g(parts) {
        groups = parts;
        newGeometry();
      },
      o(parts, unparsedArgs) {
        object = unparsedArgs;
        newGeometry();
      },
    };
  
    const keywordRE = /(\w*)(?: )*(.*)/; // expressão regular para analisar cada linha
    const lines = text.split("\n"); // divide o texto em linhas
    for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
      const line = lines[lineNo].trim(); // remove espaços em branco
      if (line === "" || line.startsWith("#")) {
        continue;
      }
      const m = keywordRE.exec(line); // executa a expressão regular para extrair a palavra-chave e os argumentos
      if (!m) {
        continue;
      }
      const [, keyword, unparsedArgs] = m;
      const parts = line.split(/\s+/).slice(1);
      const handler = keywords[keyword];
      if (!handler) {
        console.warn("unhandled keyword:", keyword); // eslint-disable-line no-console
        continue;
      }
      handler(parts, unparsedArgs);
    }
  
    // remove quaisquer arrays que não tenham entradas.
    for (const geometry of geometries) {
      geometry.data = Object.fromEntries(
        Object.entries(geometry.data).filter(([, array]) => array.length > 0)
      );
    }
  
    return {
      geometries,
      materialLibs,
    };
  }
  
  export function parseMapArgs(unparsedArgs) {
    return unparsedArgs;
  }
  
  export function parseMTL(text) {
    const materials = {};
    let material;
  
    const keywords = {
      newmtl(parts, unparsedArgs) {
        material = {};
        materials[unparsedArgs] = material;
      },
  
      Ns(parts) {
        material.shininess = parseFloat(parts[0]);
      },
      Ka(parts) {
        material.ambient = parts.map(parseFloat);
      },
      Kd(parts) {
        material.diffuse = parts.map(parseFloat);
      },
      Ks(parts) {
        material.specular = parts.map(parseFloat);
      },
      Ke(parts) {
        material.emissive = parts.map(parseFloat);
      },
      map_Kd(parts, unparsedArgs) {
        material.diffuseMap = parseMapArgs(unparsedArgs);
      },
      map_Ns(parts, unparsedArgs) {
        material.specularMap = parseMapArgs(unparsedArgs);
      },
      map_Bump(parts, unparsedArgs) {
        material.normalMap = parseMapArgs(unparsedArgs);
      },
      Ni(parts) {
        material.opticalDensity = parseFloat(parts[0]);
      },
      d(parts) {
        material.opacity = parseFloat(parts[0]);
      },
      illum(parts) {
        material.illum = parseInt(parts[0]);
      },
    };
  
    const keywordRE = /(\w*)(?: )*(.*)/;
    const lines = text.split("\n");
    for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
      const line = lines[lineNo].trim();
      if (line === "" || line.startsWith("#")) {
        continue;
      }
      const m = keywordRE.exec(line);
      if (!m) {
        continue;
      }
      const [, keyword, unparsedArgs] = m;
      const parts = line.split(/\s+/).slice(1);
      const handler = keywords[keyword];
      if (!handler) {
        console.warn("unhandled keyword:", keyword); // eslint-disable-line no-console
        continue;
      }
      handler(parts, unparsedArgs);
    }
  
    return materials;
  }
  
  export const vs = `#version 300 es
    in vec4 a_position;
    in vec3 a_normal;
    in vec2 a_texcoord;
    in vec4 a_color;
    
    uniform mat4 u_projection;
    uniform mat4 u_view;
    uniform mat4 u_world;
    uniform vec3 u_viewWorldPosition;
    
  out vec3 v_normal;
  out vec3 v_surfaceToView;
  out vec2 v_texcoord;
  out vec4 v_color;
  
  void main() {
    vec4 worldPosition = u_world * a_position;
    gl_Position = u_projection * u_view * worldPosition;
    v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;
    v_normal = mat3(u_world) * a_normal;
    v_texcoord = a_texcoord;
    v_color = a_color;
  }
  `;
  
  export const fs = `
  #version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_surfaceToView;
in vec2 v_texcoord;
in vec4 v_color;

uniform vec3 diffuse;
uniform sampler2D diffuseMap;
uniform vec3 ambient;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
uniform vec3 u_lightDirection;
uniform vec3 u_ambientLight;

out vec4 outColor;

void main () {
  vec3 normal = normalize(v_normal);
  
  // Direção da luz e cálculo de reflexo
  vec3 surfaceToViewDirection = normalize(v_surfaceToView);
  vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);
  
  float lightIntensity = dot(u_lightDirection, normal) * 0.4 + 0.6; // Iluminação mais equilibrada
  float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);
  
  // Cor da textura aplicada
  vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
  
  // Ajustando cores para manter equilíbrio
  vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;

  // Saturação moderada
  float saturationFactor = 0.8; // Leve aumento para realçar as cores
  effectiveDiffuse *= saturationFactor;

  // Opacidade final
  float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;
  
  // Combinação de iluminação e cores
  outColor = vec4(
    emissive +
    ambient * u_ambientLight * 0.1 +               // Luz ambiente equilibrada
    effectiveDiffuse * lightIntensity +           // Luz difusa
    specular * pow(specularLight, shininess * 0.0), // Brilho especular suave
    effectiveOpacity);
}

    `;
  
  export function degToRad(deg) {
      return deg * Math.PI / 180;
  }
  
  export function getExtents(positions) {
    const min = positions.slice(0, 3);
    const max = positions.slice(0, 3);
    for (let i = 3; i < positions.length; i += 3) {
      for (let j = 0; j < 3; ++j) {
        const v = positions[i + j];
        min[j] = Math.min(v, min[j]);
        max[j] = Math.max(v, max[j]);
      }
    }
    return {min, max};
  }
  
  export function getGeometriesExtents(geometries) {
    return geometries.reduce(({min, max}, {data}) => {
      const minMax = getExtents(data.position);
      return {
        min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
        max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
      };
    }, {
      min: Array(3).fill(Number.POSITIVE_INFINITY),
      max: Array(3).fill(Number.NEGATIVE_INFINITY),
    });
  }
  