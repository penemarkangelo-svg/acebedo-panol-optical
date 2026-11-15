import test from "node:test";
import assert from "node:assert/strict";
import {
  getHandEyeOverlap,
  isEyeCoveredByHand,
  updateHandCoverConfidence,
} from "./eyeCover.js";

const leftEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const rightEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];

function faceWithEyeRegions() {
  const face = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  for (const [indices, left] of [[leftEyeIndices, 0.65], [rightEyeIndices, 0.35]]) {
    indices.forEach((index, order) => {
      face[index] = {
        x: left + (order % 4) * 0.01,
        y: 0.4 + Math.floor(order / 4) * 0.01,
      };
    });
  }
  return face;
}

function rectangle(minX, minY, maxX, maxY) {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

test("recognizes a hand over the left eye without marking the right eye covered", () => {
  const face = faceWithEyeRegions();
  const hand = [rectangle(0.64, 0.39, 0.72, 0.47)];

  assert.equal(isEyeCoveredByHand(face, hand, "left"), true);
  assert.equal(isEyeCoveredByHand(face, hand, "right"), false);
});

test("recognizes a hand over the right eye without marking the left eye covered", () => {
  const face = faceWithEyeRegions();
  const hand = [rectangle(0.34, 0.39, 0.42, 0.47)];

  assert.equal(isEyeCoveredByHand(face, hand, "right"), true);
  assert.equal(isEyeCoveredByHand(face, hand, "left"), false);
});

test("does not mark an uncovered eye as covered", () => {
  const face = faceWithEyeRegions();
  const hand = [rectangle(0.5, 0.7, 0.8, 0.9)];

  assert.equal(isEyeCoveredByHand(face, hand, "left"), false);
  assert.equal(getHandEyeOverlap(face, [], "left"), 0);
});

test("accepts a partial left-eye overlap at the more tolerant threshold", () => {
  const face = faceWithEyeRegions();
  const hand = [rectangle(0.64, 0.394, 0.659, 0.411)];

  assert.equal(isEyeCoveredByHand(face, hand, "left", 0.14), true);
});

test("keeps cover confirmation through one missed hand detection", () => {
  let score = 0;
  score = updateHandCoverConfidence(score, true);
  score = updateHandCoverConfidence(score, true);
  assert.equal(score >= 1.5, true);

  score = updateHandCoverConfidence(score, false);
  assert.equal(score >= 1.5, true);

  score = updateHandCoverConfidence(score, false);
  assert.equal(score >= 1.5, false);
});
