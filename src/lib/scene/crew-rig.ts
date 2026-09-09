import * as THREE from 'three';

export interface Clip {
  name: string;
  frames: number;
  duration: number;
  boneMatrices: Float32Array;
}

export interface CrewRig {
  skeleton: THREE.Skeleton;
  bindMatrix: THREE.Matrix4;
  bindMatrixInverse: THREE.Matrix4;
  clips: Map<string, Clip>;
  boneCount: number;
  frameCount: number;
  headOffset: THREE.Vector3;
  chestOffset: THREE.Vector3;
  handOffsets: { left: THREE.Vector3; right: THREE.Vector3 };
}

const BONE_NAMES = [
  'hips',
  'spine',
  'spine1',
  'spine2',
  'neck',
  'head',
  'leftShoulder',
  'leftArm',
  'leftForeArm',
  'leftHand',
  'rightShoulder',
  'rightArm',
  'rightForeArm',
  'rightHand',
  'leftUpLeg',
  'leftLeg',
  'leftFoot',
  'rightUpLeg',
  'rightLeg',
  'rightFoot',
  'leftToe',
  'rightToe',
];

const CLIP_NAMES = [
  'idle',
  'walk',
  'run',
  'work',
  'wave',
  'cheer',
  'sitDown',
  'sitIdle',
  'standUp',
  'hit',
  'spawn',
  'interact',
];

function createProceduralSkeleton(): THREE.Skeleton {
  const bones: THREE.Bone[] = [];

  const hips = new THREE.Bone();
  hips.name = 'hips';
  hips.position.set(0, 1.0, 0);
  bones.push(hips);

  const spine = new THREE.Bone();
  spine.name = 'spine';
  spine.position.set(0, 0.15, 0);
  hips.add(spine);
  bones.push(spine);

  const spine1 = new THREE.Bone();
  spine1.name = 'spine1';
  spine1.position.set(0, 0.15, 0);
  spine.add(spine1);
  bones.push(spine1);

  const spine2 = new THREE.Bone();
  spine2.name = 'spine2';
  spine2.position.set(0, 0.15, 0);
  spine1.add(spine2);
  bones.push(spine2);

  const neck = new THREE.Bone();
  neck.name = 'neck';
  neck.position.set(0, 0.12, 0);
  spine2.add(neck);
  bones.push(neck);

  const head = new THREE.Bone();
  head.name = 'head';
  head.position.set(0, 0.15, 0);
  neck.add(head);
  bones.push(head);

  const leftShoulder = new THREE.Bone();
  leftShoulder.name = 'leftShoulder';
  leftShoulder.position.set(0.12, 0.1, 0);
  spine2.add(leftShoulder);
  bones.push(leftShoulder);

  const leftArm = new THREE.Bone();
  leftArm.name = 'leftArm';
  leftArm.position.set(0.25, 0, 0);
  leftShoulder.add(leftArm);
  bones.push(leftArm);

  const leftForeArm = new THREE.Bone();
  leftForeArm.name = 'leftForeArm';
  leftForeArm.position.set(0.25, 0, 0);
  leftArm.add(leftForeArm);
  bones.push(leftForeArm);

  const leftHand = new THREE.Bone();
  leftHand.name = 'leftHand';
  leftHand.position.set(0.2, 0, 0);
  leftForeArm.add(leftHand);
  bones.push(leftHand);

  const rightShoulder = new THREE.Bone();
  rightShoulder.name = 'rightShoulder';
  rightShoulder.position.set(-0.12, 0.1, 0);
  spine2.add(rightShoulder);
  bones.push(rightShoulder);

  const rightArm = new THREE.Bone();
  rightArm.name = 'rightArm';
  rightArm.position.set(-0.25, 0, 0);
  rightShoulder.add(rightArm);
  bones.push(rightArm);

  const rightForeArm = new THREE.Bone();
  rightForeArm.name = 'rightForeArm';
  rightForeArm.position.set(-0.25, 0, 0);
  rightArm.add(rightForeArm);
  bones.push(rightForeArm);

  const rightHand = new THREE.Bone();
  rightHand.name = 'rightHand';
  rightHand.position.set(-0.2, 0, 0);
  rightForeArm.add(rightHand);
  bones.push(rightHand);

  const leftUpLeg = new THREE.Bone();
  leftUpLeg.name = 'leftUpLeg';
  leftUpLeg.position.set(0.08, -0.1, 0);
  hips.add(leftUpLeg);
  bones.push(leftUpLeg);

  const leftLeg = new THREE.Bone();
  leftLeg.name = 'leftLeg';
  leftLeg.position.set(0, -0.4, 0);
  leftUpLeg.add(leftLeg);
  bones.push(leftLeg);

  const leftFoot = new THREE.Bone();
  leftFoot.name = 'leftFoot';
  leftFoot.position.set(0, -0.4, 0.05);
  leftLeg.add(leftFoot);
  bones.push(leftFoot);

  const leftToe = new THREE.Bone();
  leftToe.name = 'leftToe';
  leftToe.position.set(0, 0, 0.15);
  leftFoot.add(leftToe);
  bones.push(leftToe);

  const rightUpLeg = new THREE.Bone();
  rightUpLeg.name = 'rightUpLeg';
  rightUpLeg.position.set(-0.08, -0.1, 0);
  hips.add(rightUpLeg);
  bones.push(rightUpLeg);

  const rightLeg = new THREE.Bone();
  rightLeg.name = 'rightLeg';
  rightLeg.position.set(0, -0.4, 0);
  rightUpLeg.add(rightLeg);
  bones.push(rightLeg);

  const rightFoot = new THREE.Bone();
  rightFoot.name = 'rightFoot';
  rightFoot.position.set(0, -0.4, 0.05);
  rightLeg.add(rightFoot);
  bones.push(rightFoot);

  const rightToe = new THREE.Bone();
  rightToe.name = 'rightToe';
  rightToe.position.set(0, 0, 0.15);
  rightFoot.add(rightToe);
  bones.push(rightToe);

  hips.updateMatrixWorld(true);

  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();

  return skeleton;
}

function createClipKeyframes(clipName: string, frameCount: number, boneCount: number): Float32Array {
  const matrices = new Float32Array(frameCount * boneCount * 16);
  const bones = BONE_NAMES;

  for (let f = 0; f < frameCount; f++) {
    const t = f / (frameCount - 1);
    const phase = t * Math.PI * 2;

    for (let b = 0; b < boneCount; b++) {
      const boneName = bones[b];
      const mat = new THREE.Matrix4();

      switch (clipName) {
        case 'idle':
          mat.identity();
          if (boneName === 'spine') mat.multiply(new THREE.Matrix4().makeRotationX(Math.sin(phase * 0.5) * 0.02));
          if (boneName === 'head') mat.multiply(new THREE.Matrix4().makeRotationY(Math.sin(phase * 0.7) * 0.1));
          if (boneName.includes('Arm')) {
            const side = boneName.startsWith('left') ? 1 : -1;
            mat.multiply(new THREE.Matrix4().makeRotationZ(side * Math.sin(phase) * 0.15));
          }
          if (boneName.includes('Leg')) {
            const side = boneName.startsWith('left') ? 1 : -1;
            mat.multiply(new THREE.Matrix4().makeRotationX(side * Math.sin(phase) * 0.05));
          }
          break;

        case 'walk':
          if (boneName.includes('UpLeg') || boneName.includes('Leg') || boneName.includes('Foot')) {
            const side = boneName.startsWith('left') ? 1 : -1;
            const legPhase = phase + (boneName.startsWith('left') ? 0 : Math.PI);
            if (boneName.includes('UpLeg')) {
              mat.multiply(new THREE.Matrix4().makeRotationX(Math.sin(legPhase) * 0.6));
            } else if (boneName.includes('Leg') && !boneName.includes('UpLeg')) {
              mat.multiply(new THREE.Matrix4().makeRotationX(Math.max(0, Math.sin(legPhase)) * 0.8));
            } else if (boneName.includes('Foot')) {
              mat.multiply(new THREE.Matrix4().makeRotationX(-Math.max(0, Math.sin(legPhase)) * 0.3));
            }
          }
          if (boneName.includes('Arm') || boneName.includes('ForeArm')) {
            const side = boneName.startsWith('left') ? 1 : -1;
            const armPhase = phase + (boneName.startsWith('left') ? Math.PI : 0);
            if (boneName.includes('Arm')) {
              mat.multiply(new THREE.Matrix4().makeRotationX(Math.sin(armPhase) * 0.5));
            } else {
              mat.multiply(new THREE.Matrix4().makeRotationX(-Math.sin(armPhase) * 0.3));
            }
          }
          if (boneName === 'spine') mat.multiply(new THREE.Matrix4().makeRotationX(Math.sin(phase * 2) * 0.05));
          if (boneName === 'head') mat.multiply(new THREE.Matrix4().makeRotationY(Math.sin(phase * 2) * 0.1));
          break;

        case 'run':
          if (boneName.includes('UpLeg') || boneName.includes('Leg') || boneName.includes('Foot')) {
            const side = boneName.startsWith('left') ? 1 : -1;
            const legPhase = phase + (boneName.startsWith('left') ? 0 : Math.PI);
            if (boneName.includes('UpLeg')) {
              mat.multiply(new THREE.Matrix4().makeRotationX(Math.sin(legPhase) * 1.0));
            } else if (boneName.includes('Leg') && !boneName.includes('UpLeg')) {
              mat.multiply(new THREE.Matrix4().makeRotationX(Math.max(0, Math.sin(legPhase)) * 1.2));
            } else if (boneName.includes('Foot')) {
              mat.multiply(new THREE.Matrix4().makeRotationX(-Math.max(0, Math.sin(legPhase)) * 0.5));
            }
          }
          if (boneName.includes('Arm') || boneName.includes('ForeArm')) {
            const side = boneName.startsWith('left') ? 1 : -1;
            const armPhase = phase + (boneName.startsWith('left') ? Math.PI : 0);
            if (boneName.includes('Arm')) {
              mat.multiply(new THREE.Matrix4().makeRotationX(Math.sin(armPhase) * 0.8));
            } else {
              mat.multiply(new THREE.Matrix4().makeRotationX(-Math.sin(armPhase) * 0.5));
            }
          }
          if (boneName === 'spine') mat.multiply(new THREE.Matrix4().makeRotationX(Math.sin(phase * 2) * 0.1));
          if (boneName === 'spine1') mat.multiply(new THREE.Matrix4().makeRotationX(Math.sin(phase * 2) * 0.05));
          if (boneName === 'head') mat.multiply(new THREE.Matrix4().makeRotationY(Math.sin(phase * 2) * 0.15));
          break;

        case 'work':
          if (boneName === 'spine') mat.multiply(new THREE.Matrix4().makeRotationX(-0.3));
          if (boneName === 'spine1') mat.multiply(new THREE.Matrix4().makeRotationX(-0.15));
          if (boneName === 'rightArm') mat.multiply(new THREE.Matrix4().makeRotationX(-0.5)).multiply(new THREE.Matrix4().makeRotationZ(-0.3));
          if (boneName === 'rightForeArm') mat.multiply(new THREE.Matrix4().makeRotationX(-0.8));
          if (boneName === 'leftArm') mat.multiply(new THREE.Matrix4().makeRotationX(0.3)).multiply(new THREE.Matrix4().makeRotationZ(0.2));
          if (boneName === 'leftForeArm') mat.multiply(new THREE.Matrix4().makeRotationX(0.5));
          break;

        case 'wave':
          if (boneName === 'rightArm') mat.multiply(new THREE.Matrix4().makeRotationX(-0.2)).multiply(new THREE.Matrix4().makeRotationZ(-1.0));
          if (boneName === 'rightForeArm') {
            mat.multiply(new THREE.Matrix4().makeRotationX(Math.sin(phase * 4) * 0.8));
            mat.multiply(new THREE.Matrix4().makeRotationY(Math.sin(phase * 4) * 0.3));
          }
          break;

        case 'cheer':
          if (boneName === 'leftArm') mat.multiply(new THREE.Matrix4().makeRotationX(-1.2)).multiply(new THREE.Matrix4().makeRotationZ(0.5));
          if (boneName === 'rightArm') mat.multiply(new THREE.Matrix4().makeRotationX(-1.2)).multiply(new THREE.Matrix4().makeRotationZ(-0.5));
          if (boneName === 'spine') mat.multiply(new THREE.Matrix4().makeRotationX(-0.2));
          break;

        case 'sitDown':
          const sitProgress = Math.min(1, t * 2);
          if (boneName.includes('UpLeg')) {
            const side = boneName.startsWith('left') ? 1 : -1;
            mat.multiply(new THREE.Matrix4().makeRotationX(sitProgress * -1.5));
          }
          if (boneName.includes('Leg') && !boneName.includes('UpLeg')) {
            mat.multiply(new THREE.Matrix4().makeRotationX(sitProgress * 1.5));
          }
          if (boneName.includes('Foot')) {
            mat.multiply(new THREE.Matrix4().makeRotationX(sitProgress * -0.3));
          }
          if (boneName === 'spine') mat.multiply(new THREE.Matrix4().makeRotationX(sitProgress * -0.3));
          break;

        case 'sitIdle':
          if (boneName.includes('UpLeg')) {
            const side = boneName.startsWith('left') ? 1 : -1;
            mat.multiply(new THREE.Matrix4().makeRotationX(-1.5));
          }
          if (boneName.includes('Leg') && !boneName.includes('UpLeg')) {
            mat.multiply(new THREE.Matrix4().makeRotationX(1.5));
          }
          if (boneName.includes('Foot')) {
            mat.multiply(new THREE.Matrix4().makeRotationX(-0.3));
          }
          if (boneName === 'spine') mat.multiply(new THREE.Matrix4().makeRotationX(-0.3));
          if (boneName === 'head') mat.multiply(new THREE.Matrix4().makeRotationY(Math.sin(phase * 0.5) * 0.2));
          if (boneName.includes('Arm')) {
            const side = boneName.startsWith('left') ? 1 : -1;
            mat.multiply(new THREE.Matrix4().makeRotationZ(side * 0.3));
          }
          break;

        case 'standUp':
          const standProgress = Math.min(1, t * 2);
          if (boneName.includes('UpLeg')) {
            const side = boneName.startsWith('left') ? 1 : -1;
            mat.multiply(new THREE.Matrix4().makeRotationX((1 - standProgress) * -1.5));
          }
          if (boneName.includes('Leg') && !boneName.includes('UpLeg')) {
            mat.multiply(new THREE.Matrix4().makeRotationX((1 - standProgress) * 1.5));
          }
          if (boneName.includes('Foot')) {
            mat.multiply(new THREE.Matrix4().makeRotationX((1 - standProgress) * -0.3));
          }
          if (boneName === 'spine') mat.multiply(new THREE.Matrix4().makeRotationX((1 - standProgress) * -0.3));
          break;

        case 'hit':
          if (boneName === 'spine') mat.multiply(new THREE.Matrix4().makeRotationX(0.3)).multiply(new THREE.Matrix4().makeRotationZ(0.2));
          if (boneName === 'head') mat.multiply(new THREE.Matrix4().makeRotationX(-0.2)).multiply(new THREE.Matrix4().makeRotationY(0.3));
          if (boneName === 'leftArm') mat.multiply(new THREE.Matrix4().makeRotationX(0.5));
          if (boneName === 'rightArm') mat.multiply(new THREE.Matrix4().makeRotationX(-0.5)).multiply(new THREE.Matrix4().makeRotationZ(-0.5));
          break;

        case 'spawn':
          if (boneName === 'hips') mat.multiply(new THREE.Matrix4().makeTranslation(0, (1 - t) * 2, 0));
          if (boneName === 'spine') mat.multiply(new THREE.Matrix4().makeRotationX((1 - t) * 0.5));
          if (boneName.includes('UpLeg')) mat.multiply(new THREE.Matrix4().makeRotationX((1 - t) * -1.0));
          if (boneName.includes('Leg') && !boneName.includes('UpLeg')) mat.multiply(new THREE.Matrix4().makeRotationX((1 - t) * 1.0));
          break;

        case 'interact':
          if (boneName === 'spine') mat.multiply(new THREE.Matrix4().makeRotationX(-0.2));
          if (boneName === 'rightArm') mat.multiply(new THREE.Matrix4().makeRotationX(-0.3)).multiply(new THREE.Matrix4().makeRotationZ(-0.4));
          if (boneName === 'rightForeArm') mat.multiply(new THREE.Matrix4().makeRotationX(-0.6));
          if (boneName === 'head') mat.multiply(new THREE.Matrix4().makeRotationY(-0.3));
          break;

        default:
          mat.identity();
      }

      const idx = (f * boneCount + b) * 16;
      matrices.set(mat.elements, idx);
    }
  }

  return matrices;
}

export function createCrewRig(): CrewRig {
  const skeleton = createProceduralSkeleton();
  const boneCount = skeleton.bones.length;
  const frameCount = 30;

  const clips = new Map<string, Clip>();

  for (const clipName of CLIP_NAMES) {
    const frames = clipName === 'idle' ? 60 : clipName === 'walk' ? 30 : clipName === 'run' ? 20 : 30;
    const duration = frames / 30;

    clips.set(clipName, {
      name: clipName,
      frames,
      duration,
      boneMatrices: createClipKeyframes(clipName, frames, boneCount),
    });
  }

  const headBone = skeleton.getBoneByName('head')!;
  const chestBone = skeleton.getBoneByName('spine2')!;
  const leftHandBone = skeleton.getBoneByName('leftHand')!;
  const rightHandBone = skeleton.getBoneByName('rightHand')!;

  headBone.updateMatrixWorld(true);
  chestBone.updateMatrixWorld(true);
  leftHandBone.updateMatrixWorld(true);
  rightHandBone.updateMatrixWorld(true);

  const headOffset = new THREE.Vector3().setFromMatrixPosition(headBone.matrixWorld);
  const chestOffset = new THREE.Vector3().setFromMatrixPosition(chestBone.matrixWorld);
  const leftHandOffset = new THREE.Vector3().setFromMatrixPosition(leftHandBone.matrixWorld);
  const rightHandOffset = new THREE.Vector3().setFromMatrixPosition(rightHandBone.matrixWorld);

  return {
    skeleton,
    bindMatrix: skeleton.bones[0].matrixWorld.clone(),
    bindMatrixInverse: new THREE.Matrix4().copy(skeleton.bones[0].matrixWorld).invert(),
    clips,
    boneCount,
    frameCount,
    headOffset,
    chestOffset,
    handOffsets: { left: leftHandOffset, right: rightHandOffset },
  };
}

export function createBoneTexture(rig: CrewRig): THREE.DataTexture {
  const { clips, boneCount } = rig;
  const clip = clips.get('idle')!;
  const frameCount = clip.frames;

  const data = new Float32Array(boneCount * frameCount * 16);
  data.set(clip.boneMatrices);

  const texture = new THREE.DataTexture(data, boneCount * 4, frameCount, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  return texture;
}

export function getClipFrame(rig: CrewRig, clipName: string, time: number): number {
  const clip = rig.clips.get(clipName);
  if (!clip) return 0;
  const frame = Math.floor((time / clip.duration) * clip.frames) % clip.frames;
  return frame;
}

export function getBoneMatrix(rig: CrewRig, clipName: string, frame: number, boneIndex: number): THREE.Matrix4 {
  const clip = rig.clips.get(clipName);
  if (!clip) return new THREE.Matrix4();

  const frameIdx = frame % clip.frames;
  const idx = (frameIdx * rig.boneCount + boneIndex) * 16;
  const mat = new THREE.Matrix4();
  mat.fromArray(clip.boneMatrices, idx);
  return mat;
}