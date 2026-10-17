// ============ Karier & penyimpanan lokal (LocalStorage) ============
import { VEHICLES } from '../data/config';

export interface Settings {
  master: number;
  engine: number;
  sfx: number;
  music: number;
  steerSens: number;
  uiScale: number;
}

export interface SaveData {
  version: number;
  level: number;
  jobsDone: number;
  totalEarned: number;
  totalPlaySeconds: number;
  unlockedVehicles: string[];
  characterId: string | null;
  settings: Settings;
}

const SAVE_KEY = 'cod_hermesagent_save_v1';
const DEFAULT_SETTINGS: Settings = { master: 80, engine: 70, sfx: 80, music: 35, steerSens: 100, uiScale: 100 };

const RANKS: [number, string][] = [
  [1, 'Kurir Pemula'],
  [3, 'Kurir Junior'],
  [5, 'Kurir Senior'],
  [7, 'Sopir Andal'],
  [9, 'Manajer Rute'],
];

export function defaultSave(): SaveData {
  return {
    version: 1,
    level: 1,
    jobsDone: 0,
    totalEarned: 0,
    totalPlaySeconds: 0,
    unlockedVehicles: ['cityvan'],
    characterId: null,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export class Career {
  data: SaveData = defaultSave();

  constructor() {
    this.load();
  }

  load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { this.data = defaultSave(); return; }
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const base = defaultSave();
      this.data = {
        version: 1,
        level: Math.max(1, Math.floor(Number(parsed.level) || base.level)),
        jobsDone: Math.max(0, Math.floor(Number(parsed.jobsDone) || 0)),
        totalEarned: Math.max(0, Number(parsed.totalEarned) || 0),
        totalPlaySeconds: Math.max(0, Number(parsed.totalPlaySeconds ?? ((Number(parsed.level) - 1) * 480)) || 0),
        unlockedVehicles: Array.isArray(parsed.unlockedVehicles) && parsed.unlockedVehicles.length
          ? parsed.unlockedVehicles.filter(v => VEHICLES.some(spec => spec.id === v))
          : base.unlockedVehicles,
        characterId: typeof parsed.characterId === 'string' ? parsed.characterId : null,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      };
    } catch {
      this.data = defaultSave();
    }
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* storage penuh / diblokir - progres sesi tetap berjalan */
    }
  }

  rank(): string {
    let r = RANKS[0][1];
    for (const [lvl, name] of RANKS) if (this.data.level >= lvl) r = name;
    return r;
  }

  isUnlocked(vehicleId: string): boolean {
    return this.data.unlockedVehicles.includes(vehicleId);
  }

  /** Daftarkan hasil pekerjaan; naik level tiap 2 pekerjaan. */
  registerJob(net: number, durationSeconds = 0): { leveledUp: boolean; newLevel: number } {
    this.data.jobsDone += 1;
    this.data.totalEarned += net;
    this.data.totalPlaySeconds += Math.max(0, durationSeconds);
    const oldLevel = this.data.level;
    this.data.level = 1 + Math.floor(this.data.totalPlaySeconds / 480);
    // buka kendaraan sesuai level
    for (const v of VEHICLES) {
      if (this.data.level >= v.unlockLevel && !this.isUnlocked(v.id)) {
        this.data.unlockedVehicles.push(v.id);
      }
    }
    this.save();
    return { leveledUp: this.data.level > oldLevel, newLevel: this.data.level };
  }

  updateSettings(s: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...s };
    this.save();
  }

  reset(): void {
    this.data = defaultSave();
    this.save();
  }
}






