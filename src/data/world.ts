// ============ Generator data dunia (deterministik, prosedural) ============
import type { WorldData, RoadSegment, BuildingSpec, CustomerSpec, PackageSpec, BuildingKind, AABB } from './types';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CUSTOMER_NAMES = [
  'Bu Sari', 'Pak Budi', 'Toko Amanah', 'Kantor Sejahtera', 'Bu Wati',
  'Pak Joko', 'Warung Barokah', 'CV Nusantara', 'Bu Rina', 'Pak Hendra',
  'Toko Makmur', 'Klinic Sentosa', 'Bu Dewi', 'Pak Rudi', 'Laundry Bersih',
  'Bakery Loka', 'Pak Tono', 'Toko Sembako 88',
];

const STREET_NAMES_H = ['Jl. Merdeka', 'Jl. Diponegoro', 'Jl. Sudirman', 'Jl. Kartini'];

const PKG_NAMES = [
  'Kardus Elektronik', 'Kardus Pakaian', 'Pak Dokumen', 'Kardus Makanan',
  'Tas Kain', 'Box Perlengkapan', 'Kardus Obat', 'Pak Kertas',
  'Kardus Mainan', 'Box Aksesoris', 'Kardus Buku', 'Pak Peralatan',
];

function pickBuildingColor(r: number): string {
  const palette = ['#d9bf9d', '#a9c3cc', '#d9c797', '#a9bca5', '#c2afd1', '#d8d0bf', '#9eabb5', '#d9b4a1', '#d6a879', '#92b7b0'];
  return palette[Math.floor(r * palette.length) % palette.length];
}

function pickKind(r: number, h: number, district: 'residential' | 'commercial' | 'industrial' | 'mixed'): BuildingKind {
  if (district === 'industrial') return r < 0.42 ? 'warehouse' : r < 0.75 ? 'shop' : 'office';
  if (district === 'commercial') return h > 19 || r > 0.82 ? 'office' : 'shop';
  if (district === 'residential') return r < 0.78 ? 'house' : 'shop';
  if (h > 19) return 'office';
  if (r < 0.3) return 'shop';
  if (r < 0.78) return 'house';
  return 'office';
}

export function buildWorldData(seed = 20261010): WorldData {
  const rng = mulberry32(seed);
  // Slightly irregular blocks and road spacing make the city feel less like a grid.
  const VX = [-170, -75, 18, 105, 170];
  const VZ = [-128, -42, 46, 120];

  // ---------- Jalan ----------
  const roads: RoadSegment[] = [];
  const isMainX = (i: number) => VX[i] === -75;
  const isMainZ = (j: number) => VZ[j] === 46;
  for (let i = 0; i < VX.length; i++) {
    for (let j = 0; j + 1 < VZ.length; j++) {
      const main = isMainX(i);
      roads.push({ x1: VX[i], z1: VZ[j], x2: VX[i], z2: VZ[j + 1], width: main ? 15 : 8.5 + rng() * 2.5, type: main ? 'main' : 'street' });
    }
  }
  for (let j = 0; j < VZ.length; j++) {
    for (let i = 0; i + 1 < VX.length; i++) {
      const main = isMainZ(j);
      roads.push({ x1: VX[i], z1: VZ[j], x2: VX[i + 1], z2: VZ[j], width: main ? 15 : 8.5 + rng() * 2.5, type: main ? 'main' : 'street' });
    }
  }

  // Short neighborhood connectors form alleys and local cut-throughs in a
  // selection of blocks instead of repeating the same four-way grid everywhere.
  const connectors: { i: number; j: number; axis: 'vertical' | 'horizontal'; at: number; width: number }[] = [];
  for (let i = 0; i < VX.length - 1; i++) for (let j = 0; j < VZ.length - 1; j++) {
    if (i === 0 && j === 0) continue; // keep the distribution center yard open
    const pattern = (i * 3 + j * 2) % 5;
    if (pattern !== 0 && pattern !== 3) continue;
    const axis = pattern === 0 ? 'vertical' : 'horizontal';
    const at = axis === 'vertical'
      ? (VX[i] + VX[i + 1]) / 2 + (rng() - 0.5) * 18
      : (VZ[j] + VZ[j + 1]) / 2 + (rng() - 0.5) * 14;
    const width = 6.5 + rng() * 1.5;
    connectors.push({ i, j, axis, at, width });
    roads.push(axis === 'vertical'
      ? { x1: at, z1: VZ[j], x2: at, z2: VZ[j + 1], width, type: 'street' }
      : { x1: VX[i], z1: at, x2: VX[i + 1], z2: at, width, type: 'street' });
  }

  // Split through-roads where a neighborhood connector meets them so junction
  // geometry can trim sidewalks and lane marks at the exact T-intersection.
  const unsplitRoads = [...roads];
  roads.length = 0;
  for (const road of unsplitRoads) {
    const vertical = Math.abs(road.x2 - road.x1) < 0.1;
    const cuts: number[] = [];
    for (const other of unsplitRoads) {
      if (vertical && Math.abs(other.x2 - other.x1) >= 0.1) {
        const crossZ = other.z1;
        const crossX1 = Math.min(other.x1, other.x2), crossX2 = Math.max(other.x1, other.x2);
        if (crossX1 <= road.x1 && road.x1 <= crossX2 && crossZ > road.z1 + 0.01 && crossZ < road.z2 - 0.01) cuts.push(crossZ);
      } else if (!vertical && Math.abs(other.x2 - other.x1) < 0.1) {
        const crossX = other.x1;
        const otherZ1 = Math.min(other.z1, other.z2), otherZ2 = Math.max(other.z1, other.z2);
        if (otherZ1 <= road.z1 && road.z1 <= otherZ2 && crossX > road.x1 + 0.01 && crossX < road.x2 - 0.01) cuts.push(crossX);
      }
    }
    const points = [...new Set([vertical ? road.z1 : road.x1, ...cuts, vertical ? road.z2 : road.x2])].sort((a, b) => a - b);
    for (let i = 0; i + 1 < points.length; i++) {
      roads.push(vertical
        ? { ...road, z1: points[i], z2: points[i + 1] }
        : { ...road, x1: points[i], x2: points[i + 1] });
    }
  }

  // ---------- Bangunan per blok (blok 0,0 = DC) ----------
  const buildings: BuildingSpec[] = [];
  const blockMargin = 12;
  for (let i = 0; i + 1 < VX.length; i++) {
    for (let j = 0; j + 1 < VZ.length; j++) {
      if (i === 0 && j === 0) continue; // area DC
      const x0 = VX[i] + blockMargin, x1 = VX[i + 1] - blockMargin;
      const z0 = VZ[j] + blockMargin, z1 = VZ[j + 1] - blockMargin;
      const district: 'residential' | 'commercial' | 'industrial' | 'mixed' =
        i === 0 && j > 0 ? 'residential' :
        i === 3 || (j === 2 && i >= 2) ? 'commercial' :
        j === 0 && i >= 1 ? 'industrial' : 'mixed';
      const n = 4 + Math.floor(rng() * 3);
      const placed: AABB[] = [];
      for (let k = 0; k < n; k++) {
        const w = 8 + rng() * 13;
        const d = 7 + rng() * 11;
        const h = district === 'commercial' ? 11 + rng() * 20 :
          district === 'industrial' ? 6 + rng() * 10 :
          district === 'residential' ? 5 + rng() * 9 : 6 + rng() * 16;
        let px = -1, pz = -1;
        for (let tries = 0; tries < 30; tries++) {
          const cx = x0 + rng() * Math.max(0.01, x1 - x0 - w);
          const cz = z0 + rng() * Math.max(0.01, z1 - z0 - d);
          const box: AABB = { x1: cx, z1: cz, x2: cx + w, z2: cz + d };
          const clearOfBuildings = placed.every(p =>
            box.x2 + 4 < p.x1 || box.x1 - 4 > p.x2 || box.z2 + 4 < p.z1 || box.z1 - 4 > p.z2);
          const clearOfRoad = connectors.filter(r => r.i === i && r.j === j).every(r => r.axis === 'vertical'
            ? box.x2 + 4 < r.at - r.width / 2 || box.x1 - 4 > r.at + r.width / 2
            : box.z2 + 4 < r.at - r.width / 2 || box.z1 - 4 > r.at + r.width / 2);
          const clear = clearOfBuildings && clearOfRoad;
          if (clear) { px = cx; pz = cz; break; }
        }
        if (px < 0) continue;
        placed.push({ x1: px, z1: pz, x2: px + w, z2: pz + d });
        buildings.push({
          x: px + w / 2, z: pz + d / 2, w, d, h,
          color: pickBuildingColor(rng()),
          kind: pickKind(rng(), h, district),
        });
      }
    }
  }

  // ---------- Pelanggan ----------
  const customers: CustomerSpec[] = [];
  const custBlocks: [number, number, number][] = [
    [1, 0, 1], [2, 0, 1], [3, 0, 1],
    [1, 1, 1], [2, 1, 2], [3, 1, 1],
    [1, 2, 1], [2, 2, 1], [3, 2, 1],
    [0, 1, 1], [0, 2, 1], [2, 1, 1],
  ];
  let cIdx = 0;
  for (const [bi, bj] of custBlocks) {
    const count = custBlocks.filter(b => b[0] === bi && b[1] === bj).length;
    const x0 = VX[bi], x1 = VX[bi + 1], z0 = VZ[bj], z1 = VZ[bj + 1];
    const side = rng() < 0.5 ? 0 : 1; // 0 = selatan, 1 = utara
    for (let k = 0; k < count; k++) {
      const hw = (side === 0 ? (isMainZ(bj + 1) ? 8 : 5) : (isMainZ(bj) ? 8 : 5));
      const x = x0 + 10 + rng() * Math.max(1, x1 - x0 - 20);
      const z = side === 0 ? z1 - hw - 5 : z0 + hw + 5;
      const streetName = (side === 0 ? STREET_NAMES_H[bj + 1] : STREET_NAMES_H[bj]) ?? 'Jl. Kota';
      const pkgCount = 1 + Math.floor(rng() * 3);
      const packages: PackageSpec[] = [];
      for (let p = 0; p < pkgCount; p++) {
        const size = (rng() < 0.4 ? 'S' : rng() < 0.75 ? 'M' : 'L') as 'S' | 'M' | 'L';
        const weight = size === 'S' ? 2 + rng() * 5 : size === 'M' ? 7 + rng() * 8 : 15 + rng() * 20;
        const name = PKG_NAMES[Math.floor(rng() * PKG_NAMES.length)];
        packages.push({
          id: `PKG-${String(cIdx + 1).padStart(2, '0')}-${p + 1}`,
          customerId: `C-${String(cIdx + 1).padStart(2, '0')}`,
          name,
          weight: Math.round(weight * 10) / 10,
          size,
          payment: 0,
          fragile: name.includes('Dokumen') || name.includes('Obat') || name.includes('Aksesoris'),
        });
      }
      const payment = Math.round((45000 + rng() * 55000) / 5000) * 5000;
      const perPkg = Math.round(payment / pkgCount / 1000) * 1000;
      packages.forEach(p => (p.payment = perPkg));
      customers.push({
        id: `C-${String(cIdx + 1).padStart(2, '0')}`,
        name: CUSTOMER_NAMES[cIdx % CUSTOMER_NAMES.length],
        address: `${streetName} No. ${10 + Math.floor(rng() * 90)}`,
        x, z,
        packages,
        payment,
      });
      cIdx++;
    }
  }

  // ---------- Pohon, lampu jalan, mobil parkir ----------
  const trees: { x: number; z: number; s: number }[] = [];
  for (let t = 0; t < 90; t++) {
    const bi = Math.floor(rng() * 4), bj = Math.floor(rng() * 3);
    if (bi === 0 && bj === 0) continue;
    const x = VX[bi] + 6 + rng() * (VX[bi + 1] - VX[bi] - 12);
    const z = VZ[bj] + 6 + rng() * (VZ[bj + 1] - VZ[bj] - 12);
    const insideBuilding = buildings.some(b =>
      x > b.x - b.w / 2 - 2 && x < b.x + b.w / 2 + 2 && z > b.z - b.d / 2 - 2 && z < b.z + b.d / 2 + 2);
    if (insideBuilding) continue;
    trees.push({ x, z, s: 0.8 + rng() * 0.7 });
  }

  const lamps: { x: number; z: number; rot: number }[] = [];
  for (let i = 0; i < VX.length; i++) {
    if (!isMainX(i)) continue;
    for (let j = 0; j + 1 < VZ.length; j++) {
      const len = VZ[j + 1] - VZ[j];
      const nLamp = Math.floor(len / 40);
      for (let k = 0; k < nLamp; k++) {
        const z = VZ[j] + (len / (nLamp + 1)) * (k + 1);
        const side = k % 2 === 0 ? 1 : -1;
        lamps.push({ x: VX[i] + side * 10, z, rot: side > 0 ? Math.PI : 0 });
      }
    }
  }
  for (let j = 0; j < VZ.length; j++) {
    if (!isMainZ(j)) continue;
    for (let i = 0; i + 1 < VX.length; i++) {
      const len = VX[i + 1] - VX[i];
      const nLamp = Math.floor(len / 40);
      for (let k = 0; k < nLamp; k++) {
        const x = VX[i] + (len / (nLamp + 1)) * (k + 1);
        const side = k % 2 === 0 ? 1 : -1;
        lamps.push({ x, z: VZ[j] + side * 10, rot: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
      }
    }
  }

  const carColors = ['#c94f4f', '#4f7dc9', '#4fc97a', '#c9b24f', '#8a8f96', '#7a4fc9', '#c94f9d'];
  const parkedCars: { x: number; z: number; rot: number; color: string }[] = [];
  for (let attempt = 0; attempt < 180 && parkedCars.length < 26; attempt++) {
    const road = roads[Math.floor(rng() * roads.length)];
    const vertical = Math.abs(road.x2 - road.x1) < 0.1;
    const from = vertical ? Math.min(road.z1, road.z2) : Math.min(road.x1, road.x2);
    const to = vertical ? Math.max(road.z1, road.z2) : Math.max(road.x1, road.x2);
    if (to - from < 28) continue;
    const along = from + 12 + rng() * (to - from - 24);
    const side = rng() < 0.5 ? -1 : 1;
    const offset = road.width / 2 + 4.3;
    const x = vertical ? road.x1 + side * offset : along;
    const z = vertical ? along : road.z1 + side * offset;
    const rot = vertical ? 0 : Math.PI / 2;
    const carBox = vertical
      ? { x1: x - 1.2, x2: x + 1.2, z1: z - 2.6, z2: z + 2.6 }
      : { x1: x - 2.6, x2: x + 2.6, z1: z - 1.2, z2: z + 1.2 };
    const blockedByBuilding = buildings.some(b =>
      carBox.x2 + 1.2 > b.x - b.w / 2 && carBox.x1 - 1.2 < b.x + b.w / 2 &&
      carBox.z2 + 1.2 > b.z - b.d / 2 && carBox.z1 - 1.2 < b.z + b.d / 2);
    const blockedByCar = parkedCars.some(c => Math.hypot(c.x - x, c.z - z) < 7);
    const blockedByCustomer = customers.some(c => Math.hypot(c.x - x, c.z - z) < 6);
    if (blockedByBuilding || blockedByCar || blockedByCustomer) continue;
    parkedCars.push({ x, z, rot, color: carColors[Math.floor(rng() * carColors.length)] });
  }

  return {
    roads,
    buildings,
    trees,
    lamps,
    parkedCars,
    customers,
    dc: {
      x: -120, z: -80,
      loadZone: { x: -120, z: -57 },
      depositZone: { x: -151, z: -80 },
      spawn: { x: -120, z: -63 },
    },
    bounds: { minX: -185, maxX: 185, minZ: -145, maxZ: 145 },
    grid: { xs: VX, zs: VZ },
  };
}



