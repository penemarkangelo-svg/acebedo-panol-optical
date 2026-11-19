import { Matrix4, Vector3 } from "three";
import { framePlacement } from "./framePlacement.js";

export const STARLIGHT_MODEL_PATH = "/ar/starlight-black-demo.glb";
export const STARLIGHT_OVERLAY_PATH = "/ar/starlight-aviator-black-demo.png";
export const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];

export function starlightPose(points, videoWidth, videoHeight, width, height) {
  if (!points?.[473] || !points[10] || !points[152] || !videoWidth || !videoHeight || !width || !height) return null;
  const cover = Math.max(width / videoWidth, height / videoHeight);
  const offsetX = (width - videoWidth * cover) / 2, offsetY = (height - videoHeight * cover) / 2;
  const eyeZ = (points[468].z + points[473].z) / 2;
  const map = (p) => ({ x: p.x * videoWidth * cover + offsetX, y: p.y * videoHeight * cover + offsetY });
  const project = (p) => {
    const screen = map(p);
    return new Vector3(screen.x - width / 2, height / 2 - screen.y, -(p.z - eyeZ) * videoWidth * cover);
  };
  const eyes = [points[468], points[473]].sort((a, b) => a.x - b.x).map(project);
  const right = eyes[1].clone().sub(eyes[0]);
  if (right.length() < 1) return null;
  right.normalize();
  const up = project(points[10]).sub(project(points[152])).normalize();
  const forward = new Vector3().crossVectors(right, up);
  if (forward.length() < 0.1) return null;
  forward.normalize(); up.crossVectors(forward, right).normalize();
  const fit = framePlacement({ path: STARLIGHT_OVERLAY_PATH, points, map, imageWidth: 1774, imageHeight: 887 });
  if (!fit) return null;
  // Correct foreshortening: a turn changes projection, not the physical model width.
  const eyeVector = eyes[1].clone().sub(eyes[0]);
  const foreshortening = Math.max(0.55, Math.hypot(eyeVector.x, eyeVector.y) / eyeVector.length());
  const scale = fit.width / 2.52 / foreshortening;
  const center = eyes[0].clone().add(eyes[1]).multiplyScalar(0.5);
  // The traced model origin is the approved PNG's eye-level anchor already.
  const position = center.addScaledVector(forward, 0.06 * scale);
  return { project, scale, position, rotation: new Matrix4().makeBasis(right, up, forward) };
}
