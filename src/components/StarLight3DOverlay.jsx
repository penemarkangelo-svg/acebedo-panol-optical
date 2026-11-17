import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FACE_OVAL, STARLIGHT_MODEL_PATH, starlightPose } from "../ar/starlight3DPose";

function disposeModel(root) {
  root?.traverse((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material?.dispose());
  });
}

export default function StarLight3DOverlay({ points, videoRef, onAssetStateChange }) {
  const containerRef = useRef(null);
  const latestPoints = useRef(points);
  useEffect(() => { latestPoints.current = points; }, [points]);
  useEffect(() => {
    let disposed = false, animation = 0, model = null, renderer = null, fitted = false;
    const container = containerRef.current;
    // Strict Mode can run setup/cleanup/setup on the same mounted element.
    // Each renderer must own a fresh canvas so old context-loss events cannot
    // destroy the replacement renderer's context.
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { width: "100%", height: "100%", display: "block", background: "transparent", visibility: "hidden" });
    container.appendChild(canvas);
    const report = (status) => { if (!disposed) onAssetStateChange({ path: STARLIGHT_MODEL_PATH, status }); };
    const fail = (stage, error) => {
      if (disposed) return;
      canvas.style.visibility = "hidden";
      cancelAnimationFrame(animation);
      console.warn(`StarLight 3D ${stage} failed`, error);
      report("error");
    };
    report("loading");
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
    camera.position.z = 1500;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x575754, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(-200, 300, 600); scene.add(light);
    const fill = new THREE.DirectionalLight(0xffffff, 1.5); fill.position.set(300, 0, 500); scene.add(fill);
    // A depth-only face fan masks the temples, without covering the webcam image.
    const faceGeometry = new THREE.BufferGeometry();
    const facePositions = new Float32Array((FACE_OVAL.length + 1) * 3);
    faceGeometry.setAttribute("position", new THREE.BufferAttribute(facePositions, 3));
    const indices = [];
    for (let i = 0; i < FACE_OVAL.length; i++) indices.push(0, i + 1, (i + 1) % FACE_OVAL.length + 1);
    faceGeometry.setIndex(indices);
    const faceMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
    const faceMask = new THREE.Mesh(faceGeometry, faceMaterial);
    faceMask.renderOrder = -1; faceMask.frustumCulled = false; faceMask.visible = false; scene.add(faceMask);
    const targetQuaternion = new THREE.Quaternion();
    const onContextLost = (event) => { event.preventDefault(); fail("graphics context", "WebGL context lost"); };
    canvas.addEventListener("webglcontextlost", onContextLost);

    async function start() {
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        const loaded = await new GLTFLoader().loadAsync(`${STARLIGHT_MODEL_PATH}?v=traced2`);
        if (disposed) { disposeModel(loaded.scene); return; }
        model = loaded.scene;
        const originalMaterials = new Set();
        model.traverse((object) => {
          if (!object.isMesh) return;
          const arm = object.name.startsWith("arm_");
          originalMaterials.add(object.material);
          // GLTFLoader shares a material across meshes. Clone before changing
          // depthTest, otherwise the last front mesh disables it for all arms.
          object.material = object.material.clone();
          // Only temples are occluded by the coarse face surface; front parts
          // stay visible above it, avoiding a nose fan cutting through the bridge.
          object.material.depthTest = arm;
          object.renderOrder = arm ? 0 : 2;
        });
        originalMaterials.forEach((material) => material.dispose());
        model.visible = false; scene.add(model);
        let previousWidth = 0, previousHeight = 0;
        const draw = () => {
          if (disposed) return;
          try {
            const { width, height } = container.getBoundingClientRect();
            if (!width || !height) { animation = requestAnimationFrame(draw); return; }
            if (width !== previousWidth || height !== previousHeight) {
              renderer.setSize(width, height, false);
              camera.left = -width / 2; camera.right = width / 2; camera.top = height / 2; camera.bottom = -height / 2;
              camera.updateProjectionMatrix(); previousWidth = width; previousHeight = height;
            }
            const video = videoRef.current;
            const landmarks = latestPoints.current;
            const pose = starlightPose(landmarks, video?.videoWidth, video?.videoHeight, width, height);
            model.visible = faceMask.visible = Boolean(pose);
            if (pose) {
              targetQuaternion.setFromRotationMatrix(pose.rotation);
              model.position.copy(pose.position); model.scale.setScalar(pose.scale);
              if (fitted) model.quaternion.slerp(targetQuaternion, 0.5);
              else model.quaternion.copy(targetQuaternion);
              fitted = true;
              [168, ...FACE_OVAL].forEach((index, i) => {
                const vertex = pose.project(landmarks[index]);
                facePositions.set(vertex.toArray(), i * 3);
              });
              faceGeometry.attributes.position.needsUpdate = true;
            } else fitted = false;
            renderer.render(scene, camera);
            if (canvas.style.visibility !== "visible") {
              canvas.style.visibility = "visible";
              report("ready");
            }
            animation = requestAnimationFrame(draw);
          } catch (error) { fail("render", error); }
        };
        draw();
      } catch (error) {
        fail("initialization/model load", error);
      }
    }
    start();
    return () => {
      disposed = true; cancelAnimationFrame(animation);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      disposeModel(model); faceGeometry.dispose(); faceMaterial.dispose(); renderer?.dispose(); renderer?.forceContextLoss();
      canvas.remove();
    };
  }, [videoRef, onAssetStateChange]);
  return <div ref={containerRef} role="img" aria-label="StarLight experimental 3D eyewear" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transform: "scaleX(-1)", pointerEvents: "none" }} />;
}
