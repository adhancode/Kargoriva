import * as BABYLON from 'babylonjs';
import type { VehicleSpec } from '../data/types';

export interface VehicleInput { throttle: boolean; brake: boolean; left: boolean; right: boolean; handbrake: boolean; clutch: boolean; }

function material(scene: BABYLON.Scene, name: string, color: string, metal = 0.05): BABYLON.PBRMaterial {
  const m = new BABYLON.PBRMaterial(name, scene); m.albedoColor = BABYLON.Color3.FromHexString(color); m.metallic = metal; m.roughness = 0.45; return m;
}

/** Model kendaraan prosedural dengan transmisi manual sederhana. */
export class VehicleController {
  readonly spec: VehicleSpec;
  readonly mesh: { root: BABYLON.TransformNode };
  x = 0; z = 0; heading = 0; speed = 0; speedKmh = 0; rpm = 0; gear = 0;
  fuelPct = 1; damage = 0; redline = false; loadedMass = 0; steerScale = 1;
  private wheels: BABYLON.Mesh[] = []; private bodyMat: BABYLON.PBRMaterial; private engineStarted = false;
  constructor(scene: BABYLON.Scene, spec: VehicleSpec, _fuelPerk = false) {
    this.spec = spec; this.mesh = { root: new BABYLON.TransformNode('vehicle_' + spec.id, scene) };
    this.bodyMat = material(scene, 'body_' + spec.id, spec.color, 0.25);
    const glass = material(scene, 'glass_' + spec.id, '#7da6b8', 0.45); glass.alpha = 0.78;
    const trim = material(scene, 'trim_' + spec.id, '#252a30', 0.45); const tire = material(scene, 'tire_' + spec.id, '#17191d', 0.05);
    const metal = material(scene, 'metal_' + spec.id, '#b6c2ca', 0.82);
    const box = (name: string, w: number, h: number, d: number, y: number, mat: BABYLON.Material, z = 0) => {
      const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); m.position.set(0, y, z); m.material = mat; m.parent = this.mesh.root; return m;
    };
    const L = spec.length, W = spec.width, H = spec.height;
    const bodyTopY = 1.25 + H * 0.54 / 2;
    const bodyRearZ = -L * 0.035 - L * 0.69 / 2;
    const cabinTopY = 1.78 + H * 0.46 / 2;
    const roofTopY = cabinTopY + 0.12;
    box('chassis', W * 0.94, 0.42, L * 0.9, 0.78, trim);
    box('body', W, H * 0.54, L * 0.69, 1.25, this.bodyMat, -L * 0.035);
    box('hood', W * 0.95, H * 0.32, L * 0.29, 1.18, this.bodyMat, L * 0.34);
    box('cabin', W * 0.84, H * 0.46, L * 0.35, 1.78, this.bodyMat, L * 0.16);
    box('windscreen', W * 0.78, H * 0.31, 0.045, 1.83, glass, L * 0.342);
    box('rearwindow', W * 0.75, H * 0.29, 0.045, 1.81, glass, -L * 0.015);
    box('roof', W * 0.86, 0.12, L * 0.31, cabinTopY + 0.06, this.bodyMat, L * 0.14);
    // Kaca samping, garis bodi, gagang, bumper, lampu, dan emblem.
    for (const side of [-1, 1]) {
      box('sideglass', 0.035, H * 0.28, L * 0.25, 1.83, glass, L * 0.14).position.x = side * W * 0.425;
      box('sill', 0.06, 0.1, L * 0.55, 0.95, metal, 0).position.x = side * W * 0.51;
      box('doorhandle', 0.045, 0.035, 0.24, 1.35, metal, -L * 0.02).position.x = side * W * 0.515;
      const mirror = box('mirror', 0.13, 0.1, 0.18, 1.78, trim, L * 0.34); mirror.position.x = side * W * 0.55;
      const wheelX = side * W * 0.49;
      for (const wz of [-L * 0.31, L * 0.31]) {
        const w = BABYLON.MeshBuilder.CreateCylinder('wheel', { diameter: spec.wheelRadius * 2, height: 0.2, tessellation: 20 }, scene);
        w.rotation.z = Math.PI / 2; w.position.set(wheelX, spec.wheelRadius + 0.075, wz); w.material = tire; w.parent = this.mesh.root; this.wheels.push(w);
        const rim = BABYLON.MeshBuilder.CreateCylinder('rim', { diameter: spec.wheelRadius * 1.1, height: 0.215, tessellation: 12 }, scene);
        rim.rotation.z = Math.PI / 2; rim.position.set(wheelX * 1.012, spec.wheelRadius + 0.075, wz); rim.material = metal; rim.parent = this.mesh.root;
      }
    }
    const decalMat = material(scene, 'decal_' + spec.id, spec.id === 'cityvan' ? '#f6a943' : spec.id === 'cargovan' ? '#ed6c35' : '#f1bd45', 0.2);
    for (const side of [-1, 1]) { const stripe = box('fleet_livery', 0.045, 0.19, L * 0.46, 1.15, decalMat, -L * 0.03); stripe.position.x = side * (W * 0.51); }
    if (spec.id === 'cityvan') { box('rear_spoiler', W * 0.75, 0.08, 0.18, bodyTopY + 0.04, trim, -L * 0.35); }
    if (spec.id === 'cargovan') { box('roof_beacon', 0.7, 0.17, 0.32, roofTopY + 0.085, decalMat, L * 0.14); }
    box('frontbumper', W * 1.05, 0.16, 0.18, 0.68, trim, L * 0.49);
    box('rearbumper', W * 1.05, 0.16, 0.18, 0.68, trim, bodyRearZ - 0.09);
    const headMat = new BABYLON.PBRMaterial('headlights_' + spec.id, scene); headMat.albedoColor = BABYLON.Color3.FromHexString('#fff2c6'); headMat.emissiveColor = BABYLON.Color3.FromHexString('#fff2c6');
    const tailMat = new BABYLON.PBRMaterial('taillights_' + spec.id, scene); tailMat.albedoColor = BABYLON.Color3.FromHexString('#ef3333'); tailMat.emissiveColor = BABYLON.Color3.FromHexString('#d92020');
    for (const sx of [-1, 1]) {
      const hl = BABYLON.MeshBuilder.CreateBox('headlight', { width: 0.32, height: 0.16, depth: 0.06 }, scene); hl.position.set(sx * W * 0.36, 1.15, L * 0.495); hl.material = headMat; hl.parent = this.mesh.root;
      const tl = BABYLON.MeshBuilder.CreateBox('taillight', { width: 0.22, height: 0.3, depth: 0.06 }, scene); tl.position.set(sx * W * 0.4, 1.18, bodyRearZ - 0.03); tl.material = tailMat; tl.parent = this.mesh.root;
    }
    const driverSkin = material(scene, 'driver_skin_' + spec.id, '#c68b59'); const driverShirt = material(scene, 'driver_shirt_' + spec.id, '#303f4d');
    const driverHead = BABYLON.MeshBuilder.CreateSphere('driver_head', { diameter: 0.25, segments: 10 }, scene); driverHead.position.set(W * 0.18, 1.86, L * 0.15); driverHead.material = driverSkin; driverHead.parent = this.mesh.root;
    box('driver_body', 0.38, 0.44, 0.23, 1.51, driverShirt, L * 0.15).position.x = W * 0.18;
    if (spec.id === 'truck') { box('cargoTop', W * 0.88, 0.1, L * 0.52, bodyTopY + 0.05, trim, -L * 0.16); box('cargoStripe', 0.035, 0.45, L * 0.45, 1.3, metal, -L * 0.13).position.x = W * 0.51; }
    if (spec.id === 'cityvan') { box('roofRack', W * 0.55, 0.08, L * 0.24, roofTopY + 0.04, metal, L * 0.14); }
    this.mesh.root.setEnabled(false);
  }
  get position(): { x: number; z: number } { return { x: this.x, z: this.z }; }
  get gearLabel(): string { return this.gear === -1 ? 'R' : this.gear === 0 ? 'N' : String(this.gear); }
  get handbrakeActive(): boolean { return this._handbrake; }
  private _handbrake = false;
  spawn(x: number, z: number, heading: number): void { this.x = x; this.z = z; this.heading = heading; this.speed = 0; this.speedKmh = 0; this.rpm = 0; this.engineStarted = false; this.mesh.root.position.set(x, 0, z); this.mesh.root.rotation.y = heading; this.mesh.root.setEnabled(true); }
  update(dt: number, input: VehicleInput): void {
    const loaded = Math.min(1, this.loadedMass / Math.max(1, this.spec.cargoWeight));
    const ratio = this.gear === 0 ? 0 : this.gear === -1 ? -0.34 : [0, 0.33, 0.5, 0.68, 0.84, 1][this.gear];
    this._handbrake = input.handbrake;
    if (this.fuelPct <= 0) this.engineStarted = false;
    else if (input.throttle) this.engineStarted = true;
    const power = input.throttle && !input.clutch && this.fuelPct > 0 ? 1 : 0;
    if (power && this.gear !== 0) this.speed += this.spec.accel * ratio * (1 - loaded * 0.35) * dt;
    if (input.brake || input.handbrake) {
      const force = input.handbrake ? this.spec.brakeForce * 1.65 : this.spec.brakeForce;
      this.speed = Math.abs(this.speed) < force * dt ? 0 : this.speed - Math.sign(this.speed) * force * dt;
    }
    const max = this.spec.maxSpeedKmh / 3.6 * (this.gear === 0 ? 0 : this.gear === -1 ? 0.28 : 0.28 + this.gear * 0.15);
    this.speed = Math.max(-this.spec.maxSpeedKmh / 3.6 * 0.3, Math.min(max, this.speed));
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const steerFactor = Math.max(0.23, Math.min(1, Math.abs(this.speed) / 7));
    this.heading += steer * this.spec.steerRate * this.steerScale * steerFactor * dt * (this.speed < 0 ? -1 : 1);
    this.x += Math.sin(this.heading) * this.speed * dt; this.z += Math.cos(this.heading) * this.speed * dt;
    this.speedKmh = this.speed * 3.6;
    const speedRpm = Math.abs(this.speedKmh) * 50;
    const rpmTarget = !this.engineStarted ? 0 : input.throttle && this.fuelPct > 0
      ? Math.min(6800, (this.gear === 0 ? 1500 : 650) + speedRpm)
      : Math.min(6800, speedRpm);
    const rpmRate = rpmTarget > this.rpm ? 1500 : 2400;
    this.rpm += Math.sign(rpmTarget - this.rpm) * Math.min(Math.abs(rpmTarget - this.rpm), rpmRate * dt);
    this.redline = this.rpm > 5900; this.fuelPct = Math.max(0, this.fuelPct - (power ? this.spec.fuelUse * dt * 0.006 : 0));
    for (const w of this.wheels) w.rotation.x += this.speed * dt / Math.max(0.1, this.spec.wheelRadius);
    this.mesh.root.position.set(this.x, 0, this.z); this.mesh.root.rotation.y = this.heading;
  }
  setGear(gear: number, clutch: boolean): { ok: boolean; message?: string } {
    if (gear < -1 || gear > 5) return { ok: false, message: 'Gigi tidak tersedia.' };
    if (!clutch && Math.abs(this.speedKmh) > 7 && gear !== this.gear) return { ok: false, message: 'Tahan Shift untuk menginjak kopling sebelum pindah gigi.' };
    if (!clutch && Math.abs(this.speedKmh) > 2 && gear * this.speed < -0.1) return { ok: false, message: 'Hentikan kendaraan sebelum memilih gigi arah berlawanan.' };
    this.gear = gear; return { ok: true };
  }
  applyImpact(boxes: { x1: number; z1: number; x2: number; z2: number }[]): boolean {
    const r = Math.max(this.spec.width, this.spec.length) * 0.36;
    const hit = boxes.some(b => this.x + r > b.x1 && this.x - r < b.x2 && this.z + r > b.z1 && this.z - r < b.z2);
    if (hit && Math.abs(this.speedKmh) > 4) { this.damage = Math.min(100, this.damage + Math.max(1, Math.abs(this.speedKmh) * 0.08)); this.speed *= -0.16; return true; }
    return false;
  }
  clampToBounds(minX: number, maxX: number, minZ: number, maxZ: number): void {
    const ox = this.x, oz = this.z; this.x = Math.max(minX, Math.min(maxX, this.x)); this.z = Math.max(minZ, Math.min(maxZ, this.z)); if (ox !== this.x || oz !== this.z) this.speed *= -0.18; this.mesh.root.position.set(this.x, 0, this.z);
  }
  dispose(): void { this.mesh.root.dispose(false, true); }
}






