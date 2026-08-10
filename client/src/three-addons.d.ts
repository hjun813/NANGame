declare module 'three/examples/jsm/loaders/GLTFLoader.js' {
  import type { AnimationClip, Group, Loader, LoadingManager } from 'three';

  export interface GLTF {
    scene: Group;
    animations: AnimationClip[];
  }

  export class GLTFLoader extends Loader<GLTF> {
    constructor(manager?: LoadingManager);
    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<GLTF>;
  }
}

declare module 'three/examples/jsm/utils/SkeletonUtils.js' {
  import type { Object3D } from 'three';
  export function clone<T extends Object3D>(source: T): T;
}
