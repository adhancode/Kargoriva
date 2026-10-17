import * as BABYLON from 'babylonjs';
import type { WorldData, BuildingSpec } from '../data/types';
import type { GameEngine } from '../engine/GameEngine';

export interface CollisionBox { x1: number; x2: number; z1: number; z2: number; }
export interface Interior { x1: number; x2: number; z1: number; z2: number; name: string; }
export class DeliveryMarker {
  private mat: BABYLON.PBRMaterial; private ring: BABYLON.Mesh; private label: BABYLON.Mesh; private texture: BABYLON.DynamicTexture; private labelText = "";
  constructor(readonly id: string, scene: BABYLON.Scene, x: number, z: number, name: string) {
    this.mat = new BABYLON.PBRMaterial('marker_' + id, scene); this.mat.albedoColor = BABYLON.Color3.FromHexString('#a9b3bf'); this.mat.emissiveColor = BABYLON.Color3.FromHexString('#a9b3bf').scale(0.4);
    this.ring = BABYLON.MeshBuilder.CreateCylinder('target_' + id, { diameter: 1.9, height: 0.18, tessellation: 24 }, scene); this.ring.position.set(x, 0.17, z); this.ring.material = this.mat; this.ring.isPickable = false;
    this.texture = new BABYLON.DynamicTexture('tag_' + id, { width: 256, height: 64 }, scene, true); this.labelText = name; const tex = this.texture; const c = tex.getContext() as unknown as CanvasRenderingContext2D; c.fillStyle = 'rgba(18,24,32,.86)'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#fff'; c.font = 'bold 23px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name.slice(0, 22), 128, 33); tex.update();
    const lm = new BABYLON.StandardMaterial('tagmat_' + id, scene); lm.diffuseTexture = tex; lm.emissiveColor = BABYLON.Color3.White(); this.label = BABYLON.MeshBuilder.CreatePlane('tag_' + id, { width: 4.6, height: 1.15 }, scene); this.label.position.set(x, 3.0, z); this.label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; this.label.material = lm; this.label.isPickable = false;
  }
  setVisible(visible: boolean): void { this.ring.setEnabled(visible); this.label.setEnabled(visible); }
  setName(name: string): void { if (name === this.labelText) return; this.labelText = name; const c = this.texture.getContext() as unknown as CanvasRenderingContext2D; c.clearRect(0,0,256,64); c.fillStyle='rgba(18,24,32,.86)'; c.fillRect(0,0,256,64); c.fillStyle='#fff'; c.font='bold 23px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(name.slice(0,22),128,33); this.texture.update(); }
  setState(state: 'done' | 'active' | 'pending'): void {
    const color = state === 'done' ? '#42c982' : state === 'active' ? '#ff8a24' : '#a9b3bf'; this.mat.albedoColor = BABYLON.Color3.FromHexString(color); this.mat.emissiveColor = BABYLON.Color3.FromHexString(color).scale(state === 'active' ? 0.9 : 0.35); this.ring.scaling.y = state === 'active' ? 1.4 : 1;
  }
}

function pbr(scene: BABYLON.Scene, name: string, color: string, rough = 0.85): BABYLON.PBRMaterial { const m = new BABYLON.PBRMaterial(name, scene); m.albedoColor = BABYLON.Color3.FromHexString(color); m.roughness = rough; return m; }
function box(scene: BABYLON.Scene, name: string, x: number, y: number, z: number, w: number, h: number, d: number, mat: BABYLON.Material): BABYLON.Mesh { const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); m.position.set(x, y, z); m.material = mat; return m; }

/** Membangun lingkungan kota: jalan, trotoar, rumah, pohon, lampu, lampu lalu lintas, dan kendaraan. */
export class MapBuilder {
  readonly world: WorldData; readonly collisionBoxes: CollisionBox[] = []; readonly markers = new Map<string, DeliveryMarker>(); readonly interiors: Interior[] = [];
  private scene: BABYLON.Scene; private engine: GameEngine; private moving: { root: BABYLON.TransformNode; phase: number; speed: number; axis: 'x' | 'z'; fixed: number; from: number; to: number; collision: CollisionBox }[] = [];
  private signals: BABYLON.PBRMaterial[] = []; private lastSignalPhase = -1;
  constructor(scene: BABYLON.Scene, world: WorldData, engine: GameEngine) { this.scene = scene; this.world = world; this.engine = engine; this.buildGround(); this.buildBuildings(); this.buildGreenery(); this.buildCars(); this.buildDC(); this.buildMarkers(); }
  private buildGround(): void {
    const m = pbr(this.scene, 'ground', '#819277'); const ground = BABYLON.MeshBuilder.CreateGround('city_ground', { width: this.world.bounds.maxX - this.world.bounds.minX + 35, height: this.world.bounds.maxZ - this.world.bounds.minZ + 35 }, this.scene); ground.position.set((this.world.bounds.maxX + this.world.bounds.minX) / 2, -0.06, (this.world.bounds.maxZ + this.world.bounds.minZ) / 2); ground.material = m;
    const sidewalk = pbr(this.scene, 'sidewalk', '#b7b6ad'); const asphalt = pbr(this.scene, 'asphalt', '#333a40', 0.97); const line = pbr(this.scene, 'road_lines', '#e6dfc6', 0.7);
    const junctions = new Map<string, { x: number; z: number; vertical: number; horizontal: number }>();
    const key = (x: number, z: number) => `${x.toFixed(3)},${z.toFixed(3)}`;
    // Build junctions from actual perpendicular road geometry, not just shared
    // segment endpoints. This also catches T-junctions and connector endpoints.
    const verticalRoads = this.world.roads.filter(r => Math.abs(r.x2 - r.x1) < 0.1);
    const horizontalRoads = this.world.roads.filter(r => Math.abs(r.x2 - r.x1) >= 0.1);
    for (const v of verticalRoads) for (const h of horizontalRoads) {
      const x = v.x1, z = h.z1;
      const hMin = Math.min(h.x1, h.x2), hMax = Math.max(h.x1, h.x2);
      const vMin = Math.min(v.z1, v.z2), vMax = Math.max(v.z1, v.z2);
      if (x < hMin - 0.01 || x > hMax + 0.01 || z < vMin - 0.01 || z > vMax + 0.01) continue;
      const id = key(x, z), node = junctions.get(id) ?? { x, z, vertical: 0, horizontal: 0 };
      node.vertical = Math.max(node.vertical, v.width);
      node.horizontal = Math.max(node.horizontal, h.width);
      junctions.set(id, node);
    }

    // Lay all asphalt first so later sidewalks cannot cover the road surface.
    for (const r of this.world.roads) {
      const vertical = Math.abs(r.x2 - r.x1) < 0.1; const len = Math.hypot(r.x2 - r.x1, r.z2 - r.z1); const x = (r.x1 + r.x2) / 2, z = (r.z1 + r.z2) / 2;
      const road = box(this.scene, 'road', x, 0.015, z, vertical ? r.width : len, 0.12, vertical ? len : r.width, asphalt); road.isPickable = false;
    }

    // A small asphalt cap removes z-fighting where perpendicular roads meet.
    for (const node of junctions.values()) {
      if (!node.vertical || !node.horizontal) continue;
      box(this.scene, 'road_junction', node.x, 0.022, node.z, node.vertical + 0.02, 0.12, node.horizontal + 0.02, asphalt).isPickable = false;
    }

    const sw = 2.3;
    // Cut sidewalk strips around every crossing, then fill the four curb corners.
    for (const r of this.world.roads) {
      const vertical = Math.abs(r.x2 - r.x1) < 0.1; const x = (r.x1 + r.x2) / 2, z = (r.z1 + r.z2) / 2;
      const axisStart = vertical ? Math.min(r.z1, r.z2) : Math.min(r.x1, r.x2);
      const axisEnd = vertical ? Math.max(r.z1, r.z2) : Math.max(r.x1, r.x2);
      const crossingCuts = [...junctions.values()]
        .filter(node => vertical ? Math.abs(node.x - r.x1) < 0.01 && node.z >= axisStart - 0.01 && node.z <= axisEnd + 0.01 : Math.abs(node.z - r.z1) < 0.01 && node.x >= axisStart - 0.01 && node.x <= axisEnd + 0.01)
        .map(node => {
          const center = vertical ? node.z : node.x;
          const width = vertical ? node.horizontal : node.vertical;
          return [Math.max(axisStart, center - width / 2 - sw), Math.min(axisEnd, center + width / 2 + sw)] as [number, number];
        })
        .sort((a, b) => a[0] - b[0]);
      const mergedCuts: [number, number][] = [];
      for (const cut of crossingCuts) {
        const last = mergedCuts[mergedCuts.length - 1];
        if (last && cut[0] <= last[1] + 0.01) last[1] = Math.max(last[1], cut[1]);
        else mergedCuts.push([...cut]);
      }
      const openRuns: [number, number][] = [];
      let cursor = axisStart;
      for (const [cutStart, cutEnd] of mergedCuts) {
        if (cutStart > cursor + 0.05) openRuns.push([cursor, cutStart]);
        cursor = Math.max(cursor, cutEnd);
      }
      if (axisEnd > cursor + 0.05) openRuns.push([cursor, axisEnd]);
      for (const [a, b] of openRuns) {
        const runLen = b - a, along = (a + b) / 2;
        if (vertical) {
          for (const side of [-1, 1]) box(this.scene, 'sidewalk', x + side * (r.width / 2 + sw / 2), 0.12, along, sw, 0.24, runLen, sidewalk);
        } else {
          for (const side of [-1, 1]) box(this.scene, 'sidewalk', along, 0.12, z + side * (r.width / 2 + sw / 2), runLen, 0.24, sw, sidewalk);
        }
        // Lane marks share the same clear zones, so they do not run under crossings.
        const count = Math.floor(runLen / 8);
        for (let i = 0; i < count; i++) {
          const markAt = a + (i + 0.5) * runLen / count;
          box(this.scene, 'dash', vertical ? x : markAt, 0.09, vertical ? markAt : z, vertical ? 0.14 : 3.2, 0.025, vertical ? 3.2 : 0.14, line);
        }
      }
    }
    for (const node of junctions.values()) {
      if (!node.vertical || !node.horizontal) continue;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        box(this.scene, 'sidewalk_corner', node.x + sx * (node.vertical / 2 + sw / 2), 0.12, node.z + sz * (node.horizontal / 2 + sw / 2), sw, 0.24, sw, sidewalk);
      }
    }
    // Crosswalks + traffic signals at every ordinary intersection.
    const xs = this.world.grid.xs, zs = this.world.grid.zs;
    for (const x of xs) for (const z of zs) this.buildIntersection(x, z);
  }
  private buildIntersection(x: number, z: number): void {
    const zebra = pbr(this.scene, 'crosswalk', '#f0eee5', 0.8); const poleMat = pbr(this.scene, 'signal_pole', '#343c43', 0.38); const housing = pbr(this.scene, 'signal_case', '#20252a', 0.35);
    for (const side of [-1, 1]) for (let stripe = 0; stripe < 5; stripe++) box(this.scene, 'zebra', x + (stripe - 2) * 1.2, 0.09, z + side * 11.3, 0.55, 0.035, 4.8, zebra);
    // Dua tiang di tiap sisi jalan utama, masing-masing dengan lampu tiga warna.
    const offsets: [number, number][] = [[-10, -10], [10, -10], [-10, 10], [10, 10]];
    for (const [ox, oz] of offsets) {
      const px = x + ox, pz = z + oz; const pole = BABYLON.MeshBuilder.CreateCylinder('traffic_pole', { diameter: 0.14, height: 4.8 }, this.scene); pole.position.set(px, 2.4, pz); pole.material = poleMat;
      box(this.scene, 'signal_arm', px + (ox < 0 ? 0.8 : -0.8), 4.55, pz, 1.8, 0.12, 0.12, poleMat);
      box(this.scene, 'signal_box', px + (ox < 0 ? 1.5 : -1.5), 4.0, pz, 0.45, 1.25, 0.42, housing);
      for (let i = 0; i < 3; i++) { const c = ['#e7443c', '#ffc542', '#39c46a'][i]; const mat = new BABYLON.PBRMaterial('signal_' + c + '_' + x + '_' + z + '_' + px + '_' + i, this.scene); mat.albedoColor = BABYLON.Color3.FromHexString(c); mat.emissiveColor = BABYLON.Color3.FromHexString(c).scale(i === 0 ? 0.8 : 0.15); mat.roughness = 0.28; const lamp = BABYLON.MeshBuilder.CreateSphere('signal_lamp', { diameter: 0.26 }, this.scene); lamp.position.set(px + (ox < 0 ? 1.5 : -1.5), 4.4 - i * 0.38, pz + 0.23); lamp.material = mat; this.signals.push(mat); }
    }
  }
  private buildBuildings(): void {
    const windowMat = pbr(this.scene, 'window', '#6f99a8', 0.3); const doorMat = pbr(this.scene, 'door', '#493c32', 0.65);
    this.world.buildings.forEach((b, i) => this.addBuilding(b, i, windowMat, doorMat));
  }
  private addBuilding(b: BuildingSpec, i: number, windowMat: BABYLON.Material, doorMat: BABYLON.Material): void {
    const wall = pbr(this.scene, 'building_' + i, b.color); const roofMat = pbr(this.scene, 'roof_' + i, b.kind === 'house' ? ['#76584a','#6b6260','#8b624a'][i % 3] : '#55555a');
    box(this.scene, 'building', b.x, b.h / 2 + 0.25, b.z, b.w, b.h, b.d, wall);
    if (b.kind === 'house') {
      // Two pitched roof planes break up the flat box silhouettes in residential blocks.
      for (const side of [-1, 1]) {
        const plane = box(this.scene, 'house_roof', b.x, b.h + 0.78, b.z + side * b.d * 0.19, b.w + 0.8, 0.38, b.d * 0.62, roofMat);
        plane.rotation.x = side * 0.48;
      }
      if (i % 4 === 0) box(this.scene, 'chimney', b.x + b.w * 0.28, b.h + 1.15, b.z, 0.75, 1.1, 0.75, roofMat);
    } else {
      box(this.scene, 'flat_roof', b.x, b.h + 0.5, b.z, b.w + 0.35, 0.5, b.d + 0.35, roofMat);
      if (b.kind === 'office' || b.kind === 'warehouse') {
        const equipmentMat = pbr(this.scene, 'roof_equipment_' + i, '#78838a');
        const count = b.kind === 'office' ? 2 : 3;
        for (let unit = 0; unit < count; unit++) {
          const ew = b.kind === 'office' ? 1.8 : 2.4;
          box(this.scene, 'roof_unit', b.x - b.w * 0.25 + unit * Math.min(ew + 0.6, b.w / count), b.h + 0.95, b.z, ew, 0.8, 1.6, equipmentMat);
        }
      }
    }
    const cols = Math.max(1, Math.floor(b.w / 5)), rows = Math.max(1, Math.floor((b.h - 1) / 3.6));
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) for (const side of [-1, 1]) {
      const wx = b.x + (col - (cols - 1) / 2) * Math.min(4.5, b.w / (cols + 0.3));
      const wz = b.z + side * (b.d / 2 + 0.02); box(this.scene, 'window', wx, 2.4 + row * 3.6, wz, 1.35, 1.45, 0.06, windowMat);
    }
    const sideCols = Math.max(1, Math.floor(b.d / 5));
    for (let row = 0; row < rows; row++) for (let col = 0; col < sideCols; col++) for (const side of [-1, 1]) {
      const wz = b.z + (col - (sideCols - 1) / 2) * Math.min(4.2, b.d / (sideCols + 0.3));
      box(this.scene, 'side_window', b.x + side * (b.w / 2 + 0.02), 2.4 + row * 3.6, wz, 0.06, 1.35, 1.15, windowMat);
    }
    if (b.kind === 'shop') {
      const awningMat = pbr(this.scene, 'shop_awning_' + i, ['#e18b4b','#cf6d62','#5a9a87','#d2b24f'][i % 4]);
      box(this.scene, 'shop_sign', b.x, Math.min(4.5, b.h - 0.5), b.z + b.d / 2 + 0.12, b.w * 0.82, 0.55, 0.3, awningMat);
      box(this.scene, 'shop_awning', b.x, 2.95, b.z + b.d / 2 + 0.55, b.w * 0.9, 0.22, 0.95, awningMat);
    }
    if (b.kind === 'warehouse') {
      const shutterMat = pbr(this.scene, 'warehouse_shutter_' + i, '#626d72', 0.65);
      box(this.scene, 'warehouse_door', b.x, 2.1, b.z + b.d / 2 + 0.07, Math.min(b.w * 0.58, 7), 3.7, 0.12, shutterMat);
    } else {
      box(this.scene, 'door', b.x, 1.15, b.z + b.d / 2 + 0.04, 1.1, 2.3, 0.1, doorMat);
    }
    const x1=b.x-b.w/2, x2=b.x+b.w/2, z1=b.z-b.d/2, z2=b.z+b.d/2;
    if (b.kind === 'shop' || b.kind === 'warehouse') {
      const thick=0.45, gap=1.45;
      this.collisionBoxes.push({x1,x2:x1+thick,z1,z2},{x1:x2-thick,x2,z1,z2},{x1:x1+thick,x2:x2-thick,z1,z2:z1+thick},{x1,z1:z2-thick,x2:b.x-gap,z2},{x1:b.x+gap,x2,z1:z2-thick,z2});
      this.interiors.push({x1:x1+1.5,x2:x2-1.5,z1:z1+1.5,z2:z2-1.5,name:b.kind==='shop'?'Toko sekitar':'Gudang distribusi'});
    } else this.collisionBoxes.push({x1,x2,z1,z2});
  }
  private buildGreenery(): void {
    const trunk = pbr(this.scene, 'tree_trunk', '#6e5036'); const leaves = pbr(this.scene, 'tree_leaves', '#477d50');
    for (const t of this.world.trees) { const h = 3.1 * t.s; const a = BABYLON.MeshBuilder.CreateCylinder('tree_trunk', { diameter: 0.32 * t.s, height: h }, this.scene); a.position.set(t.x, h / 2, t.z); a.material = trunk; const b = BABYLON.MeshBuilder.CreateSphere('tree_crown', { diameter: 2.4 * t.s, segments: 8 }, this.scene); b.position.set(t.x, h + 0.4 * t.s, t.z); b.material = leaves; }
    const poleMat = pbr(this.scene, 'streetlamp_pole', '#414950', 0.35); const lightMat = new BABYLON.PBRMaterial('streetlamp_lens', this.scene); lightMat.albedoColor = BABYLON.Color3.FromHexString('#ffdca0'); lightMat.emissiveColor = BABYLON.Color3.FromHexString('#ffdca0').scale(0.05); this.engine.registerLamp(lightMat);
    for (const l of this.world.lamps) { const pole = BABYLON.MeshBuilder.CreateCylinder('streetlamp', { diameter: 0.18, height: 6.7 }, this.scene); pole.position.set(l.x, 3.35, l.z); pole.material = poleMat; const arm = box(this.scene, 'lamp_arm', l.x, 6.5, l.z, 1.2, 0.12, 0.12, poleMat); arm.rotation.y = l.rot; const bulb = BABYLON.MeshBuilder.CreateSphere('lamp_glow', { diameter: 0.45 }, this.scene); bulb.position.set(l.x, 6.35, l.z); bulb.material = lightMat; }
  }
  private makeCar(color: string, x: number, z: number, heading: number, name: string): BABYLON.TransformNode {
    const root = new BABYLON.TransformNode(name, this.scene); const body = pbr(this.scene, name + '_paint', color, 0.28); const glass = pbr(this.scene, name + '_glass', '#608291', 0.3); const tire = pbr(this.scene, name + '_tire', '#22252a');
    const b = box(this.scene, name + '_body', 0, 0.72, 0, 2.0, 1.15, 4.1, body); b.parent = root; const c = box(this.scene, name + '_cabin', 0, 1.45, -0.2, 1.55, 0.65, 2.0, body); c.parent = root; const g = box(this.scene, name + '_glass', 0, 1.47, 0.03, 1.48, 0.45, 0.06, glass); g.parent = root;
    for (const sx of [-1, 1]) for (const zz of [-1.3, 1.3]) { const w = BABYLON.MeshBuilder.CreateCylinder('traffic_tire', { diameter: 0.75, height: 0.22, tessellation: 12 }, this.scene); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.95, 0.38, zz); w.material = tire; w.parent = root; }
    root.position.set(x, 0, z); root.rotation.y = heading; return root;
  }
  private buildCars(): void {
    for (const [i, c] of this.world.parkedCars.entries()) { this.makeCar(c.color, c.x, c.z, c.rot, 'parked_' + i); this.collisionBoxes.push({ x1: c.x - 2.5, x2: c.x + 2.5, z1: c.z - 2.5, z2: c.z + 2.5 }); }
    const palette = ['#c94f4f', '#4f7dc9', '#4fc97a', '#d1ad42', '#e8edf2', '#694d9b'];
    const localRoads = this.world.roads.filter(r => r.type !== 'main');
    const trafficRoads = [
      ...this.world.roads.filter(r => r.type === 'main'),
      ...Array.from({ length: Math.min(6, localRoads.length) }, (_, i) => localRoads[Math.floor(i * (localRoads.length - 1) / 5)]),
    ];
    trafficRoads.forEach((r, i) => { const vertical = Math.abs(r.x2 - r.x1) < 0.1; const from = vertical ? Math.min(r.z1, r.z2) : Math.min(r.x1, r.x2); const to = vertical ? Math.max(r.z1, r.z2) : Math.max(r.x1, r.x2); const fixed = vertical ? r.x1 : r.z1; const phase = (i % 4) / 4; const root = this.makeCar(palette[i % palette.length], 0, 0, vertical ? 0 : Math.PI / 2, 'traffic_' + i); const collision = { x1: -2, x2: 2, z1: -2, z2: 2 }; this.collisionBoxes.push(collision); this.moving.push({ root, phase, speed: 0.015 + (i % 3) * 0.004, axis: vertical ? 'z' : 'x', fixed: fixed + (i % 2 ? 2.3 : -2.3), from, to, collision }); });
  }
  private buildDC(): void {
    const dc = this.world.dc; const wall = pbr(this.scene, 'dc_wall', '#d3c6ac'); const roof = pbr(this.scene, 'dc_roof', '#394553');
    box(this.scene, 'distribution_center', dc.x - 28, 5, dc.z - 20, 34, 10, 25, wall); box(this.scene, 'dc_roof', dc.x - 28, 10.2, dc.z - 20, 35, 0.7, 26, roof);
    for (let i = 0; i < 4; i++) { const bay = pbr(this.scene, 'dc_bay_' + i, '#26323a'); box(this.scene, 'loading_bay', dc.x - 40 + i * 8, 2.6, dc.z - 7.35, 4.8, 4.7, 0.2, bay); }
    const sign = pbr(this.scene, 'dc_sign', '#ff8a24'); sign.emissiveColor = BABYLON.Color3.FromHexString('#ff8a24').scale(0.45); box(this.scene, 'dc_signboard', dc.x - 28, 8.4, dc.z - 7.0, 13, 1.1, 0.25, sign);
    // Tanda muat dan setoran di halaman DC.
    for (const [label, pos, color] of [['LOAD', dc.loadZone, '#4cce91'], ['Setor', dc.depositZone, '#ffb54c']] as const) { const m = pbr(this.scene, 'zone_' + label, color); m.emissiveColor = BABYLON.Color3.FromHexString(color).scale(0.45); const z = BABYLON.MeshBuilder.CreateCylinder('zone_' + label, { diameter: 6, height: 0.09 }, this.scene); z.position.set(pos.x, 0.11, pos.z); z.material = m; }
  }
  private buildMarkers(): void { for (const c of this.world.customers) this.markers.set(c.id, new DeliveryMarker(c.id, this.scene, c.x, c.z, c.name)); }
  update(dt: number, t: number): void { for (const c of this.moving) { c.phase += c.speed * dt; const u = c.phase % 1; if (c.axis === 'z') c.root.position.set(c.fixed, 0, c.from + u * (c.to - c.from)); else c.root.position.set(c.from + u * (c.to - c.from), 0, c.fixed); c.collision.x1 = c.root.position.x - 2.2; c.collision.x2 = c.root.position.x + 2.2; c.collision.z1 = c.root.position.z - 2.2; c.collision.z2 = c.root.position.z + 2.2; }
    const phase = Math.floor(t / 7) % 3; if (phase !== this.lastSignalPhase) { this.lastSignalPhase = phase; const cycle = Math.floor(t / 7) % 3; for (let i = 0; i < this.signals.length; i++) { const colorIndex = i % 3; const active = cycle === 0 ? colorIndex === 0 : cycle === 1 ? colorIndex === 1 : colorIndex === 2; const color = colorIndex === 0 ? '#e7443c' : colorIndex === 1 ? '#ffc542' : '#39c46a'; this.signals[i].emissiveColor = BABYLON.Color3.FromHexString(color).scale(active ? 1.5 : 0.08); } }
  }
}








