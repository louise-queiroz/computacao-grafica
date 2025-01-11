import { renderSelect } from "../render/renderSelect.js";
import { transformationOptions } from "../transformations/transformation.js";

document.addEventListener("DOMContentLoaded", async function () {
  
  const canvases = document.querySelectorAll(".box-models"); 
  console.log("box selecionada", canvases)
  const buttonSelectedContainer = document.querySelector(".button-selected");
  
  let buttonIndex = 0;

  canvases.forEach(function (canvas, index) {
    canvas.onclick = function () {
      const titles = [
        "Barril",
        "Cama",
        "Estante",
        "Tigela",
        "Vela",
        "Frasco",
        "Prato",
        "Tocha",
        "Vinho",
        "Caixa"
      ];
      
      const title = titles[index];
      
      renderSelect(index);
      
      const newButton = document.createElement("button");
      newButton.textContent = title;
      
      const actualButton = buttonIndex;
      buttonIndex++;

      newButton.addEventListener("click", function () {
        console.log("Botão clicado, índice:", actualButton);
        transformationOptions(actualButton);

        console.log("botao selecionado", buttonSelectedContainer)
        newButton.classList.add("button-selected")
        newButton.style.display = "block";
      });

      buttonSelectedContainer.appendChild(newButton);
      console.log("Botão adicionado ao container:", title);
      
    };
  });
});
