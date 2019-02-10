"use strict";

const canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gl = canvas.getContext("webgl");

if (!gl) {
  alert("No webgl found :(");
}

const vertexShaderSource = `

// an attribute is an input (in) to a vertex shader.
// It will receive data from a buffer
attribute vec4 a_position;

// all shaders have a main function
void main() {

  // gl_Position is a special variable a vertex shader
  // is responsible for setting
  gl_Position = a_position;
}
`;

const fragmentShaderSource = `

// fragment shaders don't have a default precision so we need
// to pick one. mediump is a good default. It means "medium precision"
precision mediump float;

// varying are passed from the vertex shader
varying vec4 v_color;

// uniform is passed by js;
uniform vec2 texture_translation;
uniform vec2 global_translation;
uniform float texture_zoom;
uniform float global_zoom;
uniform sampler2D u_image;

void main() {
  vec2 global_pos = (gl_FragCoord.xy - global_translation) * global_zoom;
  float l = length(global_pos);
  float s = tan(atan(l) * 2.0) / l;
  vec2 texture_pos = mod(global_pos * s - texture_translation, texture_zoom) / texture_zoom;
  gl_FragColor = texture2D(u_image, texture_pos);
}
`;

// Compile vertex or fragment shader
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.warn("Error creating shader:");
  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

// Link vertex and fragment shaders
function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.warn("Error creating program:");
  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

const program = createProgram(gl, vertexShader, fragmentShader);

const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
const locationOfTextureTranslation = gl.getUniformLocation(program, "texture_translation");
const locationOfTextureZoom = gl.getUniformLocation(program, "texture_zoom");
const locationOfGlobalTranslation = gl.getUniformLocation(program, "global_translation");
const locationOfGlobalZoom = gl.getUniformLocation(program, "global_zoom");

const positionBuffer = gl.createBuffer();

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

const positions = [
  -1, -1,
  -1, 1,
  1, -1,
  -1, 1,
  1, 1,
  1, -1,
];

const texture_translation = {
  x: 0,
  y: 0
};

const center = {
  x: canvas.width / 2,
  y: canvas.height / 2
};

const global_translation = {
  x: center.x,
  y: center.y
};

let texture_zoom = 1.0;
let global_zoom = 3.0 / Math.min(canvas.width, canvas.height);

gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

gl.enableVertexAttribArray(positionAttributeLocation);

var size = 2; // 2 components per iteration
var type = gl.FLOAT; // the data is 32bit floats
var normalize = false; // don't normalize the data
var stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
var offset = 0; // start at the beginning of the buffer
gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);

gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
gl.clearColor(0.1, 0.5, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.useProgram(program);
let image = new Image();
const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);

// Set the parameters so we can render any size image.
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

gl.uniform2f(locationOfTextureTranslation, texture_translation.x, texture_translation.y);
gl.uniform2f(locationOfGlobalTranslation, global_translation.x, global_translation.y);
gl.uniform1f(locationOfTextureZoom, texture_zoom);
gl.uniform1f(locationOfGlobalZoom, global_zoom);
var primitiveType = gl.TRIANGLES;
var offset = 0;
var count = 6;
gl.drawArrays(primitiveType, offset, count);

let dragStart;
canvas.addEventListener('mousedown', function(event) {
  dragStart = {
    x: event.pageX,
    y: event.pageY
  };
});


canvas.addEventListener('mouseup', function(event) {
  dragStart = undefined;
});

let oldTime = 0;
canvas.addEventListener('mousemove', function(event) {
  if (dragStart && (Date.now() - oldTime > 50)) {
    oldTime = Date.now();
    const dragEnd = {
      x: event.pageX,
      y: event.pageY
    };
    if (event.buttons == 1) {
      texture_translation.x += (dragEnd.x - dragStart.x) * global_zoom;
      texture_translation.y -= (dragEnd.y - dragStart.y) * global_zoom; // y has opposite sign
      gl.uniform2f(locationOfTextureTranslation, texture_translation.x, texture_translation.y);
    } else {
      global_translation.x += dragEnd.x - dragStart.x;
      global_translation.y -= dragEnd.y - dragStart.y; // y has opposite sign
      gl.uniform2f(locationOfGlobalTranslation, global_translation.x, global_translation.y);
    }
    dragStart = dragEnd;
    gl.drawArrays(primitiveType, offset, count);
  }
});

canvas.oncontextmenu = () => false;

canvas.addEventListener('wheel', function(event) {
  const zoom_factor = 1 + (event.deltaY / 500); //TODO cross broswer thing
  const ly = canvas.height - event.pageY; // ↑ y

  if (event.shiftKey || event.ctrlKey) {
    global_zoom *= zoom_factor;
    global_translation.x = (global_translation.x - event.pageX) / zoom_factor + event.pageX;
    global_translation.y = (global_translation.y - ly) / zoom_factor + ly;
    gl.uniform1f(locationOfGlobalZoom, global_zoom);
    gl.uniform2f(locationOfGlobalTranslation, global_translation.x, global_translation.y);
    event.preventDefault();
  } else {
    texture_zoom *= zoom_factor;
    texture_translation.x *= zoom_factor;
    texture_translation.y *= zoom_factor;
    gl.uniform1f(locationOfTextureZoom, texture_zoom);
    gl.uniform2f(locationOfTextureTranslation, texture_translation.x, texture_translation.y);
  }
  gl.drawArrays(primitiveType, offset, count);
});

window.onresize = function() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.drawArrays(primitiveType, offset, count);
};

const openFile = function(file) {
  const reader = new FileReader();
  reader.onload = function() {
    image.src = reader.result;
    image.addEventListener('load', () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.drawArrays(primitiveType, offset, count);
    });
  };
  reader.readAsDataURL(file.target.files[0]);
};

image.src = "image.jpg";
image.addEventListener('load', () => {
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.drawArrays(primitiveType, offset, count);
});
