import * as THREE from "three";
import { mkdir, writeFile } from "node:fs/promises";
import { traceRim, pixelPoint } from "./trace-starlight.mjs";

// Photo-based demo dimensions in arbitrary units, not measured millimetres.
const meshes = [];
function tube(name, coords, radius, material = 0, closed = false) {
  const curve = new THREE.CatmullRomCurve3(coords.map((p) => new THREE.Vector3(...p)), closed, "centripetal");
  meshes.push({ name, geometry: new THREE.TubeGeometry(curve, closed ? 128 : 48, radius, 8, closed), material });
}
function temple(name, coords, thickness, height, material = 0) {
  const shape = new THREE.Shape(), x = thickness / 2, y = height / 2, r = thickness / 3;
  shape.moveTo(-x + r, -y); shape.lineTo(x - r, -y); shape.quadraticCurveTo(x, -y, x, -y + r);
  shape.lineTo(x, y - r); shape.quadraticCurveTo(x, y, x - r, y); shape.lineTo(-x + r, y);
  shape.quadraticCurveTo(-x, y, -x, y - r); shape.lineTo(-x, -y + r); shape.quadraticCurveTo(-x, -y, -x + r, -y);
  const curve = new THREE.CatmullRomCurve3(coords.map((p) => new THREE.Vector3(...p)));
  let geometry = new THREE.ExtrudeGeometry(shape, { steps: 64, bevelEnabled: false, extrudePath: curve, curveSegments: 4 });
  // Exporter expects indexed geometry, including the extruded side-arm meshes.
  const count = geometry.attributes.position.count;
  geometry.setIndex(Array.from({ length: count }, (_, i) => i));
  meshes.push({ name, geometry, material });
}
for (const side of [-1, 1]) {
  tube(`${side < 0 ? "left" : "right"}_rim`, traceRim(side), 0.0095, 0, true);
  temple(`hinge_${side}`, [[side * 1.12, 0.047, 0], [side * 1.20, 0.047, -0.025]], 0.04, 0.058, 2);
  // Open temples extend backwards; tips bend down behind the ears.
  temple(`arm_${side}`, [[side * 1.19, 0.047, -0.025], [side * 1.22, 0.047, -0.5], [side * 1.23, 0.03, -1.1], [side * 1.22, 0.015, -1.5]], 0.022, 0.045);
  temple(`arm_tip_${side}`, [[side * 1.22, 0.015, -1.48], [side * 1.22, 0, -1.66], [side * 1.20, -0.13, -1.78], [side * 1.17, -0.28, -1.82]], 0.03, 0.055, 2);
  tube(`pad_mount_${side}`, [[side * 0.16, -0.03, 0], [side * 0.17, -0.09, -0.055]], 0.007);
  const pad = new THREE.SphereGeometry(1, 12, 12);
  pad.scale(0.025, 0.075, 0.012); pad.rotateZ(side * -0.24); pad.translate(side * 0.17, -0.13, -0.055);
  meshes.push({ name: `nose_pad_${side}`, geometry: pad, material: 1 });
}
tube("arched_bridge", [[752,342],[805,279],[887,260],[969,279],[1022,342]].map(([x,y]) => pixelPoint(x,y,0.025)), 0.014);

// Export a standard self-contained GLB with positions, normals and triangle indices.
const buffers = [], views = [], accessors = [];
let byteLength = 0;
function accessor(array, componentType, type, target, bounds) {
  const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  const view = views.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length, target }) - 1;
  const padding = (4 - bytes.length % 4) % 4;
  buffers.push(bytes, Buffer.alloc(padding)); byteLength += bytes.length + padding;
  return accessors.push({ bufferView: view, componentType, count: array.length / (type === "VEC3" ? 3 : 1), type, ...bounds }) - 1;
}
const gltfMeshes = meshes.map(({ name, geometry, material }) => {
  geometry.computeBoundingBox(); const box = geometry.boundingBox;
  const position = accessor(geometry.attributes.position.array, 5126, "VEC3", 34962, { min: box.min.toArray(), max: box.max.toArray() });
  const normal = accessor(geometry.attributes.normal.array, 5126, "VEC3", 34962);
  const indices = accessor(geometry.index.array, geometry.index.array instanceof Uint32Array ? 5125 : 5123, "SCALAR", 34963);
  geometry.dispose();
  return { name, primitives: [{ attributes: { POSITION: position, NORMAL: normal }, indices, material }] };
});
const doc = {
  asset: { version: "2.0", generator: "Acebedo StarLight photo-based prototype" },
  scene: 0, scenes: [{ nodes: meshes.map((_, i) => i) }],
  nodes: meshes.map(({ name }, mesh) => ({ name, mesh })), meshes: gltfMeshes,
  materials: [
    { name: "black_metal", pbrMetallicRoughness: { baseColorFactor: [0.035, 0.04, 0.038, 1], metallicFactor: 0.45, roughnessFactor: 0.32 } },
    { name: "clear_nose_pads", alphaMode: "BLEND", doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.65, 0.67, 0.66, 0.22], metallicFactor: 0, roughnessFactor: 0.5 } },
    { name: "black_acetate_tips", pbrMetallicRoughness: { baseColorFactor: [0.012, 0.014, 0.013, 1], metallicFactor: 0, roughnessFactor: 0.28 } },
  ],
  buffers: [{ byteLength }], bufferViews: views, accessors,
  extras: { purpose: "Evaluation prototype; front rims traced from approved PNG, side geometry approximate", frontWidth: 2.52, pupilAnchorY: 0 },
};
const json = Buffer.from(JSON.stringify(doc)); const jsonPad = (4 - json.length % 4) % 4;
const bin = Buffer.concat(buffers); const output = Buffer.alloc(12 + 8 + json.length + jsonPad + 8 + bin.length);
output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
output.writeUInt32LE(json.length + jsonPad, 12); output.writeUInt32LE(0x4e4f534a, 16); json.copy(output, 20); output.fill(32, 20 + json.length, 20 + json.length + jsonPad);
const offset = 20 + json.length + jsonPad; output.writeUInt32LE(bin.length, offset); output.writeUInt32LE(0x004e4942, offset + 4); bin.copy(output, offset + 8);
await mkdir("public/ar", { recursive: true });
await writeFile("public/ar/starlight-black-demo.glb", output);
console.log(`Created StarLight GLB: ${meshes.length} meshes, ${output.length} bytes.`);
