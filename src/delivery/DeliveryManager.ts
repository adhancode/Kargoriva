// ============ Sistem pengiriman: manifest, paket, pelanggan, evaluasi ============
import type { CustomerSpec, PackageSpec, PackageStatus } from '../data/types';
import { ECONOMY } from '../data/config';

export interface PackageRuntime extends PackageSpec {
  status: PackageStatus;
}

export interface CustomerRuntime {
  id: string;
  name: string;
  address: string;
  x: number;
  z: number;
  payment: number;
  packageIds: string[];
  status: 'pending' | 'delivered';
}

export interface PayrollLine { label: string; amount: number; }
export interface Payroll {
  base: number;
  bonuses: PayrollLine[];
  penalties: PayrollLine[];
  net: number;
}

export interface JobEvaluation {
  jobName: string;
  delivered: number;
  total: number;
  failed: number;
  timeUsed: number;
  timeLimit: number;
  onTime: boolean;
  damage: number;
  fuelLeftPct: number;
  expectedPayments: number;
  receivedPayments: number;
  deposited: number;
  discrepancy: number;
  payroll: Payroll;
  success: boolean;
  points: number;
}

export class DeliveryManager {
  customers: CustomerRuntime[] = [];
  packages: PackageRuntime[] = [];
  escrow = 0;
  loaded = false;
  deliveredCount = 0;
  points = 100;
  wrongAttempts = 0;
  elapsed = 0;
  timeLimit = 0;
  freeMode = false;
  jobName = '';
  private wrongCooldown = 0;
  private customerSpecs: CustomerSpec[];

  constructor(customerSpecs: CustomerSpec[]) {
    this.customerSpecs = customerSpecs;
  }

  buildJob(level: number, freeMode: boolean): void {
    this.freeMode = freeMode;
    const n = freeMode ? Math.min(6 + Math.floor(Math.random() * 4), this.customerSpecs.length) : Math.min(3 + Math.floor((level - 1) * 1.5), this.customerSpecs.length);
    const picked = [...this.customerSpecs].sort(() => Math.random() - 0.5).slice(0, n).sort(() => Math.random() - 0.5);

    const names = ['Bu Sari','Pak Budi','Toko Amanah','Kantor Sejahtera','Bu Wati','Pak Joko','Warung Barokah','CV Nusantara','Bu Rina','Pak Hendra','Toko Makmur','Klinik Sentosa','Bu Dewi','Pak Rudi','Laundry Bersih','Bakery Loka','Pak Tono','Toko Sembako 88','Bu Maya','Pak Arif'];
    const namePool = [...names].sort(() => Math.random() - 0.5);
    this.customers = picked.map((c, i) => ({
      id: c.id, name: namePool[i % namePool.length], address: c.address, x: c.x, z: c.z,
      payment: c.payment,
      packageIds: c.packages.map(p => p.id),
      status: 'pending' as const,
    }));
    this.packages = picked.flatMap(c => c.packages.map(p => ({ ...p, status: 'waiting' as PackageStatus })));
    this.escrow = 0;
    this.loaded = false;
    this.deliveredCount = 0;
    this.points = 100;
    this.wrongAttempts = 0;
    this.wrongCooldown = 0;
    this.elapsed = 0;
    this.timeLimit = freeMode ? 0 : 260 + level * 70;
    const events = ['Rute Pagi','Kiriman Kota','Antaran Cepat','Rute Perumahan','Kiriman Toko','Rute Prioritas','Ekspres Distrik','Antaran Khusus'];
    this.jobName = (freeMode ? 'Free · ' : '') + events[Math.floor(Math.random() * events.length)] + ' ' + String(level).padStart(2, '0');
  }

  get totalPackages(): number { return this.packages.length; }

  get loadedPackages(): number { return this.packages.filter(p => p.status === 'loaded').length; }

  get remainingCustomers(): number { return this.customers.filter(c => c.status === 'pending').length; }

  get totalExpectedPayments(): number {
    return this.customers.reduce((s, c) => s + c.payment, 0);
  }

  get timeLeft(): number {
    return this.timeLimit > 0 ? Math.max(0, this.timeLimit - this.elapsed) : 0;
  }

  get isOverTime(): boolean {
    return this.timeLimit > 0 && this.elapsed > this.timeLimit;
  }

  tick(dt: number): void {
    this.elapsed += dt;
    if (this.wrongCooldown > 0) this.wrongCooldown -= dt;
  }

  loadPackages(capacity: number): { ok: boolean; message: string } {
    if (this.loaded) return { ok: false, message: 'Paket sudah dimuat ke kendaraan.' };
    if (this.totalPackages > capacity) {
      return { ok: false, message: `Kapasitas tidak cukup: perlu ${this.totalPackages} paket, kendaraan muat ${capacity}.` };
    }
    for (const p of this.packages) p.status = 'loaded';
    this.loaded = true;
    return { ok: true, message: `${this.totalPackages} paket dimuat. Selamat bekerja!` };
  }

  /** Mencoba menyerahkan semua paket milik satu pelanggan. */
  tryDeliver(customerId: string): { ok: boolean; message: string; payment: number } {
    if (this.wrongCooldown > 0) return { ok: false, message: 'Tunggu sebentar sebelum mencoba lagi.', payment: 0 };
    const cust = this.customers.find(c => c.id === customerId);
    if (!cust) return { ok: false, message: 'Pelanggan tidak ada dalam daftar pekerjaan ini.', payment: 0 };
    if (cust.status === 'delivered') return { ok: false, message: `Paket untuk ${cust.name} sudah diserahkan.`, payment: 0 };

    const carried = this.packages.filter(p => p.customerId === customerId && p.status === 'loaded');
    if (carried.length === 0) {
      this.wrongCooldown = 2.5;
      this.wrongAttempts++;
      this.points = Math.max(0, this.points - 1);
      return { ok: false, message: `Tidak ada paket untuk ${cust.name} di kendaraan! (penalti salah kirim)`, payment: 0 };
    }
    for (const p of carried) p.status = 'delivered';
    cust.status = 'delivered';
    this.deliveredCount++;
    this.escrow += cust.payment;
    return {
      ok: true,
      message: `Paket diterima ${cust.name}. Pembayaran Rp ${cust.payment.toLocaleString('id-ID')} diterima.`,
      payment: cust.payment,
    };
  }

  deposit(): { ok: boolean; amount: number; message: string } {
    if (this.escrow <= 0) return { ok: false, amount: 0, message: 'Tidak ada uang titipan untuk disetor.' };
    const amt = this.escrow;
    this.escrow = 0;
    return { ok: true, amount: amt, message: `Setoran Rp ${amt.toLocaleString('id-ID')} berhasil dicatat.` };
  }

  isComplete(): boolean {
    return this.loaded && this.customers.every(c => c.status === 'delivered');
  }

  /** Evaluasi akhir pekerjaan. */
  evaluate(level: number, damage: number, fuelLeftPct: number, depositedTotal: number, timeBonusMult = 1): JobEvaluation {
    const received = this.totalExpectedPayments - (this.customers.filter(c => c.status === 'pending').reduce((s, c) => s + c.payment, 0));
    const discrepancy = depositedTotal - received;
    const onTime = !this.isOverTime;
    const noDamage = damage < 5;
    const fuelEfficient = fuelLeftPct >= 35;

    const bonuses: PayrollLine[] = [];
    const penalties: PayrollLine[] = [];

    if (this.deliveredCount === this.customers.length && this.deliveredCount > 0) {
      bonuses.push({ label: 'Semua pengiriman selesai', amount: ECONOMY.bonusAllDelivered });
    }
    if (onTime && this.timeLimit > 0) {
      bonuses.push({ label: 'Tepat waktu', amount: Math.round(ECONOMY.bonusOnTime * timeBonusMult) });
    }
    if (noDamage) bonuses.push({ label: 'Tanpa kerusakan', amount: ECONOMY.bonusNoDamage });
    if (fuelEfficient) bonuses.push({ label: 'Bahan bakar efisien', amount: ECONOMY.bonusFuelEfficient });

    if (this.wrongAttempts > 0) {
      penalties.push({ label: `Salah kirim x${this.wrongAttempts}`, amount: this.wrongAttempts * ECONOMY.penaltyWrongPackage });
    }
    if (damage >= 5) {
      penalties.push({ label: `Kerusakan kendaraan (${Math.round(damage)} poin)`, amount: Math.round(damage) * ECONOMY.penaltyDamagePerPoint });
    }
    if (!onTime && this.timeLimit > 0) {
      penalties.push({ label: 'Melewati batas waktu', amount: ECONOMY.penaltyLate });
    }
    if (Math.abs(discrepancy) > 1000) {
      penalties.push({ label: 'Selisih setoran', amount: Math.round(Math.abs(discrepancy) * ECONOMY.penaltyDiscrepancyMultiplier) });
    }

    const base = ECONOMY.baseSalaryPerLevel * Math.max(1, level);
    const net = Math.max(0, base + bonuses.reduce((s, b) => s + b.amount, 0) - penalties.reduce((s, p) => s + p.amount, 0));

    return {
      jobName: this.jobName,
      delivered: this.deliveredCount,
      total: this.customers.length,
      failed: this.customers.length - this.deliveredCount,
      timeUsed: this.elapsed,
      timeLimit: this.timeLimit,
      onTime,
      damage,
      fuelLeftPct,
      expectedPayments: this.totalExpectedPayments,
      receivedPayments: received,
      deposited: depositedTotal,
      discrepancy,
      payroll: { base, bonuses, penalties, net },
      success: this.deliveredCount === this.customers.length && this.deliveredCount > 0,
      points: this.points,
    };
  }
}





