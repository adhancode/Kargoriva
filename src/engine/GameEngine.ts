// ============ Engine Babylon: scene, pencahayaan, siklus waktu ============
import * as BABYLON from 'babylonjs';

export class GameEngine {
  engine: BABYLON.Engine;
  scene: BABYLON.Scene;
  sun: BABYLON.DirectionalLight;
  hemi: BABYLON.HemisphericLight;
  shadowGen: BABYLON.ShadowGenerator;
  glow: BABYLON.GlowLayer;
  lampMats: BABYLON.PBRMaterial[] = [];
  headlightMats: BABYLON.PBRMaterial[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new BABYLON.Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true }, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.56, 0.72, 0.85, 1);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0028;
    this.scene.fogColor = BABYLON.Color3.FromHexString('#a8c4d8');
    this.scene.ambientColor = BABYLON.Color3.FromHexString('#20262e');

    this.hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), this.scene);
    this.hemi.intensity = 0.55;
    this.hemi.groundColor = BABYLON.Color3.FromHexString('#3a4048');

    this.sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.45, -1, 0.35), this.scene);
    this.sun.position = new BABYLON.Vector3(140, 180, -100);
    this.sun.intensity = 1.5;
    this.sun.diffuse = BABYLON.Color3.FromHexString('#fff2df');

    this.shadowGen = new BABYLON.ShadowGenerator(2048, this.sun);
    this.shadowGen.useBlurExponentialShadowMap = true;
    this.shadowGen.blurKernel = 32;
    this.shadowGen.darkness = 0.45;

    this.glow = new BABYLON.GlowLayer('glow', this.scene);
    this.glow.intensity = 0.35;
  }

  registerShadowCaster(mesh: BABYLON.AbstractMesh): void {
    const map = this.shadowGen.getShadowMap();
    if (map && map.renderList) map.renderList.push(mesh);
  }

  registerLamp(mat: BABYLON.PBRMaterial): void {
    this.lampMats.push(mat);
  }

  registerHeadlight(mat: BABYLON.PBRMaterial): void {
    this.headlightMats.push(mat);
  }

  /** hour: 0..24 - mengatur matahari, langit, dan lampu malam */
  setTimeOfDay(hour: number): void {
    const day = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)); // 0..1 elevasi matahari
    const azimuth = ((hour - 6) / 12) * Math.PI;

    const elev = day * 1.15 + 0.06;
    this.sun.direction = new BABYLON.Vector3(
      -Math.cos(azimuth) * 0.7,
      -Math.max(0.08, elev),
      -Math.sin(azimuth) * 0.5,
    );
    this.sun.intensity = 0.15 + day * 1.45;

    // warna langit: malam -> subuh -> siang -> senja
    const night = new BABYLON.Color3(0.05, 0.07, 0.12);
    const dusk = new BABYLON.Color3(0.98, 0.55, 0.28);
    const noon = new BABYLON.Color3(0.53, 0.72, 0.88);
    let sky: BABYLON.Color3;
    if (day <= 0.02) sky = night;
    else if (day < 0.35) sky = BABYLON.Color3.Lerp(night, dusk, day / 0.35);
    else sky = BABYLON.Color3.Lerp(dusk, noon, Math.min(1, (day - 0.35) / 0.65));
    this.scene.clearColor = new BABYLON.Color4(sky.r, sky.g, sky.b, 1);
    this.scene.fogColor = sky;

    this.hemi.intensity = 0.18 + day * 0.45;

    const nightF = 1 - Math.min(1, day * 2.2);
    for (const m of this.lampMats) {
      m.emissiveColor = BABYLON.Color3.FromHexString('#ffd9a0').scale(0.05 + nightF * 0.95);
    }
    for (const m of this.headlightMats) {
      m.emissiveColor = BABYLON.Color3.White().scale(0.03 + nightF * 0.9);
    }
    this.glow.intensity = 0.08 + nightF * 0.55;
  }

  resize(): void {
    this.engine.resize();
  }
}

