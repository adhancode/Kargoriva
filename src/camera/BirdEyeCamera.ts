// ============ Kamera third-person mengikuti pemain ============
import * as BABYLON from 'babylonjs';

export class BirdEyeCamera {
  camera: BABYLON.TargetCamera;
  readonly distance = 5.2; // POV orang ketiga yang lebih rendah
  readonly offset = 8.5;   // jarak tetap di belakang entitas
  readonly lookAhead = 1.8;
  private smoothHeading = Math.PI;
  private orbitAngle = 0;
  private lookYaw = 0;
  private lookPitch = Math.atan2(this.distance - 1.35, this.offset + this.lookAhead);

  constructor(scene: BABYLON.Scene) {
    this.camera = new BABYLON.TargetCamera('bird', new BABYLON.Vector3(0, 40, 20), scene);
    this.camera.setTarget(BABYLON.Vector3.Zero());
    scene.activeCamera = this.camera;
  }

  /** Geser dua jari: kiri/kanan memutar kamera, atas/bawah mengubah sudut pandang. */
  orbitBy(dx: number, dy: number): void {
    const horizontal = Math.max(-100, Math.min(100, dx));
    const vertical = Math.max(-100, Math.min(100, dy));
    this.lookYaw -= horizontal * 0.008;
    this.lookPitch = Math.max(0.12, Math.min(0.78, this.lookPitch + vertical * 0.008));
  }

  viewHeading(baseHeading: number): number {
    return baseHeading + this.lookYaw;
  }

  /** POV tetap dari belakang entitas, dengan sudut rendah dan fokus dekat pemain. */
  follow(dt: number, tx: number, tz: number, heading: number): void {
    const k = Math.min(1, dt * 6);

    // haluskan perubahan heading agar kamera tidak berputar kaku
    let diff = heading - this.smoothHeading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.smoothHeading += diff * k;

    const viewHeading = this.smoothHeading + this.lookYaw;
    const fx = Math.sin(viewHeading);
    const fz = Math.cos(viewHeading);

    const desiredX = tx - fx * this.offset;
    const desiredZ = tz - fz * this.offset;
    this.camera.position.x += (desiredX - this.camera.position.x) * k;
    this.camera.position.z += (desiredZ - this.camera.position.z) * k;
    this.camera.position.y = 1.35 + Math.tan(this.lookPitch) * (this.offset + this.lookAhead);

    // target: entitas + sedikit ke depan agar jalan di depan terlihat
    this.camera.setTarget(new BABYLON.Vector3(tx + fx * this.lookAhead, 1.35, tz + fz * this.lookAhead));
  }

  /** kamera orbit lambat untuk backdrop menu utama */
  orbit(dt: number, cx: number, cz: number): void {
    this.orbitAngle += dt * 0.08;
    const r = 42;
    this.camera.position.x = cx + Math.sin(this.orbitAngle) * r;
    this.camera.position.z = cz + Math.cos(this.orbitAngle) * r;
    this.camera.position.y = 30;
    this.camera.setTarget(new BABYLON.Vector3(cx, 2, cz));
  }
}

