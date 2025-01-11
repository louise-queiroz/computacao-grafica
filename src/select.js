import { renderSelect } from "./renderSelect.js";

document.addEventListener("DOMContentLoaded", async function () {
  console.log("DOMContentLoaded foi disparado!");

  const canvases = document.querySelectorAll("canvas"); // Selecionando todos os canvas diretamente
  console.log("Canvases encontrados:", canvases);

  const buttonContainer = document.querySelector(".button-container");

  const clearButton = document.getElementById("btnLimpar");
  clearButton.addEventListener("click", function () {
    const gl = document.getElementById("sceneCanvas").getContext("webgl2");
    console.log("Limpar canvas clicado");
    clearCanvas(gl);
    buttonContainer.innerHTML = ""; // Limpa o container de botões
    console.log("Botões do container limpos");
  });

  canvases.forEach(function (canvas, index) {
    console.log("Canvas encontrado:", canvas);

    canvas.onclick = function () {
      console.log("Canvas clicado, índice:", index);

      const titles = [
        "Barril",
        "Cama",
        "Banco",
        "Estante",
        "Velas",
        "Carrossel",
        "Cadeira",
        "Mesa de Café",
        "Sofá",
        "Porta"
      ];

      const title = titles[index - 1];

      // pra resolver o problema de estar clicando 1 e carregando 2
      console.log("Título do modelo selecionado:", title);

      // Chama renderSelect com o índice do canvas clicado
      renderSelect(index - 1);

      // Criação de um novo botão
      const newButton = document.createElement("button");
      newButton.textContent = title;

      // Usa o índice do canvas diretamente
      const buttonIndex = index - 1;

      newButton.addEventListener("click", function () {
        console.log("Botão clicado, índice:", buttonIndex);
        transformationEditing(buttonIndex);
        newButton.classList.add("buttonContainer");
        newButton.style.display = "block";
      });

      buttonContainer.appendChild(newButton);
      console.log("Botão adicionado ao container:", title);
    };
  });
});
