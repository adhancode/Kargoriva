// ============ Konfigurasi terpusat: kendaraan, karakter, ekonomi ============
import type { VehicleSpec, CharacterSpec, NPCSpec } from './types';

export const VEHICLES: VehicleSpec[] = [
  {
    id: 'cityvan', name: 'City Van', klass: 'City Van',
    capacity: 8, mass: 1600, maxSpeedKmh: 130,
    accel: 7.4, brakeForce: 11.5, steerRate: 2.0,
    fuelCapacity: 45, fuelUse: 0.0018, unlockLevel: 1,
    length: 4.6, width: 1.95, height: 2.15, wheelRadius: 0.36,
    color: '#f2c14e', cargoVolume: 2.2, cargoWeight: 700,
  },
  {
    id: 'cargovan', name: 'Cargo Van', klass: 'Cargo Van',
    capacity: 16, mass: 2300, maxSpeedKmh: 115,
    accel: 5.8, brakeForce: 9.5, steerRate: 1.6,
    fuelCapacity: 65, fuelUse: 0.0024, unlockLevel: 2,
    length: 5.8, width: 2.15, height: 2.7, wheelRadius: 0.38,
    color: '#e8edf2', cargoVolume: 5.0, cargoWeight: 1400,
  },
  {
    id: 'truck', name: 'Delivery Truck', klass: 'Delivery Truck',
    capacity: 28, mass: 3600, maxSpeedKmh: 95,
    accel: 4.3, brakeForce: 8.0, steerRate: 1.2,
    fuelCapacity: 110, fuelUse: 0.0034, unlockLevel: 4,
    length: 8.6, width: 2.45, height: 3.3, wheelRadius: 0.45,
    color: '#3e7cb1', cargoVolume: 12, cargoWeight: 3200,
  },
];

/** Staf DC: 1 manajer + 3 penyortir paket (nama Indonesia). */
export const NPCS: NPCSpec[] = [
  {
    id: 'manager', name: 'Bapak Hendra Gunawan', role: 'manager', title: 'Manajer DC',
    outfit: '#2f3a4a', pants: '#1e2630', skin: '#c68b59', hair: '#171412', gender: 'male',
    x: -147, z: -78, heading: -Math.PI / 2,
  },
  {
    id: 'sorter1', name: 'Bu Sri Wahyuni', role: 'sorter', title: 'Penyortir Zona A',
    outfit: '#e0761f', pants: '#3a3f45', skin: '#d9a06b', hair: '#241f1c', gender: 'female',
    x: -131, z: -90, heading: Math.PI,
  },
  {
    id: 'sorter2', name: 'Pak Agus Salim', role: 'sorter', title: 'Penyortir Zona B',
    outfit: '#38b878', pants: '#2f3a4a', skin: '#8c5a3b', hair: '#101010', gender: 'male',
    x: -120, z: -90, heading: Math.PI,
  },
  {
    id: 'sorter3', name: 'Bu Rina Marlina', role: 'sorter', title: 'Penyortir Zona C',
    outfit: '#4da3ff', pants: '#37424e', skin: '#e8b98a', hair: '#241f1c', gender: 'female',
    x: -109, z: -90, heading: Math.PI,
  },
];

export const CHARACTERS: CharacterSpec[] = [
  {
    id: 'rani', name: 'Rani Putri', gender: 'female',
    role: 'Kurir Senior', perkId: 'fuel', perkName: 'Efisiensi Bahan Bakar',
    perkDesc: 'Konsumsi bahan bakar -25% di setiap rute.',
    outfit: '#e65353', skin: '#d9a06b', hair: '#241f1c', pants: '#2f3a4a',
    startLevel: 1,
  },
  {
    id: 'budi', name: 'Budi Santoso', gender: 'male',
    role: 'Sopir Andal', perkId: 'handling', perkName: 'Handling Ekstra',
    perkDesc: 'Respons kemudi +15% untuk manuver di gang sempit.',
    outfit: '#ff8a24', skin: '#c68b59', hair: '#171412', pants: '#37424e',
    startLevel: 1,
  },
  {
    id: 'agus', name: 'Agus Wijaya', gender: 'male',
    role: 'Manajer Rute', perkId: 'time', perkName: 'Manajemen Waktu',
    perkDesc: 'Batas waktu +20% dan bonus tepat waktu 1.5x.',
    outfit: '#38b878', skin: '#8c5a3b', hair: '#101010', pants: '#222b36',
    startLevel: 2,
  },
];

export const ECONOMY = {
  baseSalaryPerLevel: 85000,   // gaji dasar = nilai * level
  bonusAllDelivered: 120000,
  bonusOnTime: 90000,
  bonusNoDamage: 75000,
  bonusFuelEfficient: 60000,   // sisa bahan bakar >= 35%
  penaltyWrongPackage: 40000,  // per usaha serah paket salah
  penaltyDamagePerPoint: 6000, // per poin kerusakan
  penaltyLate: 50000,
  penaltyDiscrepancyMultiplier: 2,
  depositRadius: 9,            // meter
  loadRadius: 10,
  interactRadius: 11,
  interactMaxSpeed: 5,         // km/jam
};

export const JOB_NAMES = [
  'Rute Pagi', 'Rute Siang', 'Kiriman Kota', 'Ekspres Senja',
  'Antaran Malam', 'Rute Utara', 'Rute Timur', 'Kiriman Kilat',
  'Lintas Distrik', 'Rute Prioritas', 'Antaran Khusus', 'Kiriman Express',
];

export function jobNameFor(level: number): string {
  const base = JOB_NAMES[(level - 1) % JOB_NAMES.length];
  return `${base} ${String(level).padStart(2, '0')}`;
}

export const PHASES = [
  { from: 4, to: 6, name: 'Subuh' },
  { from: 6, to: 10, name: 'Pagi' },
  { from: 10, to: 14, name: 'Siang' },
  { from: 14, to: 17, name: 'Sore' },
  { from: 17, to: 19, name: 'Senja' },
  { from: 19, to: 4, name: 'Malam' },
];

export function phaseForHour(hour: number): string {
  for (const p of PHASES) {
    if (p.from < p.to) { if (hour >= p.from && hour < p.to) return p.name; }
    else { if (hour >= p.from || hour < p.to) return p.name; }
  }
  return 'Malam';
}

export function formatRupiah(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

export function formatTime(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

