// ============ Karakter pemain: model prosedural + kontrol jalan kaki ============
import * as BABYLON from 'babylonjs';
import type { CharacterSpec } from '../data/types';

export interface CharacterRig {
  root: BABYLON.TransformNode;
  update(t: number, speed: number): void;
}

export interface RigOptions {
  vest?: string;      // warna rompi (overlay torso)
  nameTag?: string;   // teks nama di atas kepala
  capColor?: string;  // warna topi
}

function pbr(name: string, scene: BABYLON.Scene, hex: string, rough = 0.75, metallic = 0): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial(name, scene);
  m.albedoColor = BABYLON.Color3.FromHexString(hex);
  m.metallic = metallic;
  m.roughness = rough;
  return m;
}

/** Membangun humanoid dari bentuk dasar dengan proporsi & detail lebih realistis. */
export function createCharacterRig(scene: BABYLON.Scene, spec: CharacterSpec, opts: RigOptions = {}): CharacterRig {
  const root = new BABYLON.TransformNode('char_' + spec.id, scene);

  const skinMat = pbr('skin_' + spec.id, scene, spec.skin, 0.6);
  const outfitMat = pbr('outfit_' + spec.id, scene, spec.outfit, 0.8);
  const hairMat = pbr('hair_' + spec.id, scene, spec.hair, 0.9);
  const pantsMat = pbr('pants_' + spec.id, scene, spec.pants, 0.85);
  const shoeMat = pbr('shoe_' + spec.id, scene, '#22262c', 0.7);

  // ---------- kepala (proporsi lebih kecil dari badan) ----------
  const neck = BABYLON.MeshBuilder.CreateCylinder('neck', { diameter: 0.12, height: 0.1 }, scene);
  neck.position.y = 1.56;
  neck.material = skinMat;
  neck.parent = root;

  const head = BABYLON.MeshBuilder.CreateSphere('head', { diameter: 0.27, segments: 16 }, scene);
  head.position.y = 1.73;
  head.material = skinMat;
  head.parent = root;

  // mata & alis
  const eyeMat = pbr('eye_' + spec.id, scene, '#1c1f24', 0.4);
  for (const sx of [-1, 1]) {
    const eye = BABYLON.MeshBuilder.CreateSphere('eye', { diameter: 0.045 }, scene);
    eye.position.set(sx * 0.065, 1.75, 0.115);
    eye.material = eyeMat;
    eye.parent = root;
  }

  // rambut / hijab sederhana
  const hair = BABYLON.MeshBuilder.CreateSphere('hair', { diameter: 0.29, segments: 12 }, scene);
  hair.scaling.set(1, 0.68, 1);
  hair.position.set(0, 1.78, -0.02);
  hair.material = hairMat;
  hair.parent = root;
  if (spec.gender === 'female') {
    const hairBack = BABYLON.MeshBuilder.CreateBox('hairBack', { width: 0.27, height: 0.42, depth: 0.13 }, scene);
    hairBack.position.set(0, 1.58, -0.15);
    hairBack.material = hairMat;
    hairBack.parent = root;
  } else {
    // topi dengan brim
    const capColor = opts.capColor ?? '#ff8a24';
    const cap = BABYLON.MeshBuilder.CreateCylinder('cap', { diameter: 0.3, height: 0.11 }, scene);
    cap.position.set(0, 1.87, 0);
    cap.material = pbr('cap_' + spec.id, scene, capColor, 0.6);
    cap.parent = root;
    const brim = BABYLON.MeshBuilder.CreateBox('brim', { width: 0.3, height: 0.03, depth: 0.16 }, scene);
    brim.position.set(0, 1.83, 0.16);
    brim.material = pbr('brim_' + spec.id, scene, capColor, 0.6);
    brim.parent = root;
  }

  // ---------- badan: dada, pinggul, rompi ----------
  const torso = BABYLON.MeshBuilder.CreateBox('torso', { width: 0.46, height: 0.56, depth: 0.26 }, scene);
  torso.position.y = 1.26;
  torso.material = outfitMat;
  torso.parent = root;

  const hips = BABYLON.MeshBuilder.CreateBox('hips', { width: 0.4, height: 0.18, depth: 0.25 }, scene);
  hips.position.y = 0.92;
  hips.material = pantsMat;
  hips.parent = root;

  if (opts.vest) {
    const vest = BABYLON.MeshBuilder.CreateBox('vest', { width: 0.5, height: 0.4, depth: 0.3 }, scene);
    vest.position.y = 1.26;
    vest.material = pbr('vest_' + spec.id, scene, opts.vest, 0.3, 0.7);
    vest.parent = root;
    // strip reflektif
    const strip = BABYLON.MeshBuilder.CreateBox('strip', { width: 0.51, height: 0.05, depth: 0.31 }, scene);
    strip.position.y = 1.36;
    strip.material = pbr('strip_' + spec.id, scene, '#e8edf2', 0.1, 0.4);
    strip.parent = root;
  }

  // ---------- lengan: bahu + siku (2 segmen) ----------
  const arms: BABYLON.TransformNode[] = [];
  const forearms: BABYLON.TransformNode[] = [];
  for (const sx of [-1, 1]) {
    const pivot = new BABYLON.TransformNode('armPivot', scene);
    pivot.position.set(sx * 0.3, 1.5, 0);
    pivot.parent = root;
    const upper = BABYLON.MeshBuilder.CreateBox('upper', { width: 0.12, height: 0.3, depth: 0.13 }, scene);
    upper.position.y = -0.15;
    upper.material = outfitMat;
    upper.parent = pivot;
    const elbow = new BABYLON.TransformNode('elbow', scene);
    elbow.position.y = -0.3;
    elbow.parent = pivot;
    const fore = BABYLON.MeshBuilder.CreateBox('fore', { width: 0.11, height: 0.28, depth: 0.12 }, scene);
    fore.position.y = -0.14;
    fore.material = outfitMat;
    fore.parent = elbow;
    const hand = BABYLON.MeshBuilder.CreateSphere('hand', { diameter: 0.11 }, scene);
    hand.position.y = -0.3;
    hand.material = skinMat;
    hand.parent = elbow;
    arms.push(pivot);
    forearms.push(elbow);
  }

  // ---------- kaki ----------
  const legs: BABYLON.TransformNode[] = [];
  for (const sx of [-1, 1]) {
    const pivot = new BABYLON.TransformNode('legPivot', scene);
    pivot.position.set(sx * 0.12, 0.9, 0);
    pivot.parent = root;
    const leg = BABYLON.MeshBuilder.CreateBox('leg', { width: 0.15, height: 0.78, depth: 0.16 }, scene);
    leg.position.y = -0.39;
    leg.material = pantsMat;
    leg.parent = pivot;
    const shoe = BABYLON.MeshBuilder.CreateBox('shoe', { width: 0.17, height: 0.11, depth: 0.28 }, scene);
    shoe.position.set(0, -0.79, 0.04);
    shoe.material = shoeMat;
    shoe.parent = pivot;
    legs.push(pivot);
  }

  // ---------- name tag (billboard) ----------
  let nameTag: BABYLON.Mesh | null = null;
  if (opts.nameTag) {
    const tex = new BABYLON.DynamicTexture('tag_' + spec.id, { width: 256, height: 64 }, scene, true);
    const tctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    tctx.fillStyle = 'rgba(15,19,24,0.85)';
    tctx.fillRect(0, 0, 256, 64);
    tctx.fillStyle = '#ff8a24';
    tctx.font = 'bold 26px "Segoe UI", sans-serif';
    tctx.textAlign = 'center';
    tctx.textBaseline = 'middle';
    tctx.fillText(opts.nameTag, 128, 34);
    tex.update();
    const tagMat = new BABYLON.PBRMaterial('tagmat_' + spec.id, scene);
    tagMat.albedoTexture = tex;
    tagMat.metallic = 0;
    tagMat.roughness = 0.5;
    tagMat.emissiveColor = BABYLON.Color3.White().scale(0.25);
    nameTag = BABYLON.MeshBuilder.CreatePlane('tag', { width: 1.1, height: 0.28 }, scene);
    nameTag.position.y = 2.15;
    nameTag.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    nameTag.material = tagMat;
    nameTag.parent = root;
  }

  return {
    root,
    update(t: number, speed: number) {
      const moving = speed > 0.1;
      const phase = t * (3.4 + speed * 1.7);
      const amp = moving ? Math.min(0.7, 0.22 + speed * 0.11) : 0;
      legs[0].rotation.x = Math.sin(phase) * amp;
      legs[1].rotation.x = -Math.sin(phase) * amp;
      // ayunan lengan berlawanan dengan kaki, siku sedikit menekuk
      arms[0].rotation.x = -Math.sin(phase) * amp * 0.85;
      arms[1].rotation.x = Math.sin(phase) * amp * 0.85;
      forearms[0].rotation.x = -0.25 - Math.abs(Math.sin(phase)) * 0.2;
      forearms[1].rotation.x = -0.25 - Math.abs(Math.sin(phase)) * 0.2;
      const bob = moving ? Math.abs(Math.sin(phase)) * 0.028 : Math.sin(t * 1.6) * 0.01;
      torso.position.y = 1.26 + bob;
      head.position.y = 1.73 + bob * 0.7;
      neck.position.y = 1.56 + bob * 0.7;
    },
  };
}

export interface FootInput { f: boolean; b: boolean; l: boolean; r: boolean; }

export interface CollisionBoxes { boxes: { x1: number; z1: number; x2: number; z2: number }[]; }

/** Kontrol karakter di luar kendaraan. */
export class CharacterController {
  x = 0;
  z = 0;
  heading = Math.PI;
  speed = 3.6;
  speedKmh = 0;
  rig: CharacterRig;
  private t = 0;

  constructor(scene: BABYLON.Scene, spec: CharacterSpec, x: number, z: number) {
    this.rig = createCharacterRig(scene, spec);
    this.x = x;
    this.z = z;
    this.rig.root.position.set(x, 0, z);
    this.rig.root.rotation.y = this.heading;
  }

  get position(): { x: number; z: number } {
    return { x: this.x, z: this.z };
  }

  update(dt: number, input: FootInput, collision: CollisionBoxes, camHeading = this.heading): void {
    this.t += dt;
    const previousX = this.x, previousZ = this.z;
    // Movement stays relative to the camera's facing direction. Keep facing separate
    // from the movement vector so holding S/A/D does not rotate the camera under input.
    const fx = Math.sin(camHeading);
    const fz = Math.cos(camHeading);
    // Left/right are strafes relative to the steady camera; the body turns toward travel.
    let dx = 0, dz = 0;
    if (input.f) { dx += fx; dz += fz; }
    if (input.b) { dx -= fx; dz -= fz; }
    if (input.l) { dx += -fz; dz += fx; }
    if (input.r) { dx += fz; dz += -fx; }
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      dx /= len; dz /= len;
      const desiredHeading = Math.atan2(dx, dz);
      let turn = desiredHeading - this.heading;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      this.heading += turn * Math.min(1, dt * 10);
      const nx = this.x + dx * this.speed * dt;
      const nz = this.z + dz * this.speed * dt;
      if (!hitsBoxes(nx, nz, 0.45, collision.boxes)) {
        this.x = nx;
        this.z = nz;
      }
    }
    this.rig.root.position.set(this.x, 0, this.z);
    this.rig.root.rotation.y = this.heading;
    const elapsed = Math.max(dt, 0.001);
    const actualSpeed = Math.hypot(this.x - previousX, this.z - previousZ) / elapsed;
    this.speedKmh = actualSpeed * 3.6;
    this.rig.update(this.t, actualSpeed);
  }

  setVisible(v: boolean): void {
    this.rig.root.setEnabled(v);
  }
}

/** Cek lingkaran radius r vs daftar AABB (dipakai karakter & kendaraan). */
export function hitsBoxes(x: number, z: number, r: number, boxes: { x1: number; z1: number; x2: number; z2: number }[]): boolean {
  for (const b of boxes) {
    const cx = Math.max(b.x1, Math.min(x, b.x2));
    const cz = Math.max(b.z1, Math.min(z, b.z2));
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

