import { parseOBJ, parseMTL, vs, fs, degToRad, getGeometriesExtents } from "../basic/read.js";
import { objDataScene, drawObj, loadObj } from "../render/renderSelect.js"

export function transformationOptions(buttonIndex) {

    let rotation = document.getElementById("rotation")
    let scale = document.getElementById("scale")

    let translationX = document.getElementById("translateXButton")
    let translationY = document.getElementById("translateYButton")
    let translationZ = document.getElementById("translateZButton")

    rotation.onchange = function () {
        objDataScene[buttonIndex].yrotation = rotation.value;
    }

    scale.onchange = function () {
        objDataScene[buttonIndex].escala = parseFloat(scale.value)
    }

    translationX.onchange = function () {
        objDataScene[buttonIndex].objOffSet[0] = parseFloat(
            translationX.value
        )
    }

    translationY.onchange = function () {
        objDataScene[buttonIndex].objOffSet[1] = parseFloat(
            translationY.value
        )
    }

    translationZ.onchange = function () {
        objDataScene[buttonIndex].objOffSet[2] = parseFloat(
            translationZ.value
        )
    }

}   