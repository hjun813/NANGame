import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type * as THREE from 'three';

export interface CharacterModelInstance {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

const loader = new GLTFLoader();
const modelCache = new Map<string, Promise<CharacterModelInstance>>();
const loggedFailures = new Set<string>();

function loadOriginal(url: string): Promise<CharacterModelInstance> {
  const cached = modelCache.get(url);
  if (cached) return cached;
  const pending: Promise<CharacterModelInstance> = loader.loadAsync(url)
    .then((gltf) => ({ scene: gltf.scene, animations: gltf.animations }));
  modelCache.set(url, pending);
  return pending;
}

export async function loadCharacterModel(url: string): Promise<CharacterModelInstance | null> {
  try {
    const original = await loadOriginal(url);
    return {
      scene: clone(original.scene) as THREE.Group,
      animations: original.animations,
    };
  } catch (error) {
    if (!loggedFailures.has(url)) {
      loggedFailures.add(url);
      console.warn(`[character] model load failed; using fallback url=${url}`, error);
    }
    return null;
  }
}
