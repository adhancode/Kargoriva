// ============ Shared types untuk seluruh sistem CASH OR DUEL ============

export interface VehicleSpec {
  id: string;
  name: string;
  klass: string;
  capacity: number;        // jumlah paket
  mass: number;            // kg (kosong)
  maxSpeedKmh: number;
  accel: number;           // m/s^2 pada gigi 1 (tanpa beban)
  brakeForce: number;      // m/s^2
  steerRate: number;       // rad/s dasar
  fuelCapacity: number;    // liter
  fuelUse: number;         // liter/detik full throttle
  unlockLevel: number;
  length: number;
  width: number;
  height: number;
  wheelRadius: number;
  color: string;
  cargoVolume: number;     // kapasitas volume bak (m^3)
  cargoWeight: number;     // kapasitas berat bak (kg)
}

/** Dimensi kemasan per ukuran (cm) - dipakai perhitungan penyortiran. */
export const PACKAGE_DIMS: Record<PackageSize, { l: number; w: number; h: number }> = {
  S: { l: 30, w: 20, h: 15 },
  M: { l: 40, w: 30, h: 25 },
  L: { l: 60, w: 40, h: 35 },
};

export interface NPCSpec {
  id: string;
  name: string;
  role: 'manager' | 'sorter';
  title: string;
  outfit: string;
  pants: string;
  skin: string;
  hair: string;
  gender: 'female' | 'male';
  x: number;
  z: number;
  heading: number;
}

export interface CharacterSpec {
  id: string;
  name: string;
  gender: 'female' | 'male';
  role: string;
  perkId: 'fuel' | 'handling' | 'time';
  perkName: string;
  perkDesc: string;
  outfit: string;
  skin: string;
  hair: string;
  pants: string;
  startLevel: number;
}

export type PackageStatus = 'waiting' | 'loaded' | 'delivered' | 'failed';
export type PackageSize = 'S' | 'M' | 'L';

export interface PackageSpec {
  id: string;
  customerId: string;
  name: string;
  weight: number;
  size: PackageSize;
  payment: number;
  fragile?: boolean;
}

export interface CustomerSpec {
  id: string;
  name: string;
  address: string;
  x: number;
  z: number;
  packages: PackageSpec[];
  payment: number;
}

export type RoadType = 'main' | 'street';

export interface RoadSegment {
  x1: number; z1: number; x2: number; z2: number;
  width: number;
  type: RoadType;
}

export type BuildingKind = 'house' | 'shop' | 'office' | 'warehouse';

export interface BuildingSpec {
  x: number; z: number;      // pusat
  w: number; d: number; h: number;
  color: string;
  kind: BuildingKind;
}

export interface AABB { x1: number; z1: number; x2: number; z2: number; }

export interface WorldData {
  roads: RoadSegment[];
  buildings: BuildingSpec[];
  trees: { x: number; z: number; s: number }[];
  lamps: { x: number; z: number; rot: number }[];
  parkedCars: { x: number; z: number; rot: number; color: string }[];
  customers: CustomerSpec[];
  dc: {
    x: number; z: number;
    loadZone: { x: number; z: number };
    depositZone: { x: number; z: number };
    spawn: { x: number; z: number };
  };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  grid: { xs: number[]; zs: number[] };
}

