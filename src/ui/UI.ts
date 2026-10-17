import type { CharacterSpec, VehicleSpec } from '../data/types';
import type { Settings } from '../career/Career';
import type { JobEvaluation } from '../delivery/DeliveryManager';
import type { SortingReport } from '../delivery/SortingSystem';
import { formatRupiah } from '../data/config';

export interface HUDData { jobName: string; delivered: number; total: number; loaded: boolean; loadedCount: number; nextTarget: string; nextDistance: number; timeLeft: number; hasTimeLimit: boolean; escrow: number; speedKmh: number; rpm: number; gear: string; fuelPct: number; handbrake: boolean; damage: number; redline: boolean; onFoot: boolean; clock: number; elapsedWork: number; location: string; prompt: string; }
interface UIOptions { onCareer: () => void; onFree: () => void; onContinue: () => void; onSettings: (from: string) => void; onCredits: () => void; onResetProgress: () => void; onCharacterConfirm: () => void; onBackToMenu: () => void; onVehicleConfirm: () => void; onWorksheetConfirm: () => void; onBriefingStart: () => void; onPauseResume: () => void; onPauseRestart: () => void; onPauseMenu: () => void; onSettingsBack: () => void; onSettingsReset: () => void; onResultsNext: () => void; onResultsMenu: () => void; onConfirm: () => void; }
const el = (id: string) => document.getElementById(id)!;
const money = (n: number) => formatRupiah(n);

/** Menus, HUD, dashboard, and visible keyboard/touch control panel. */
export class UI {
  selectedCharacterId = 'rani'; selectedVehicleId = 'cityvan'; settingsFromScreen = 'menu'; private opts: UIOptions; private toastTimers = new Map<HTMLElement, number>();
  constructor(opts: UIOptions) { this.opts = opts; this.bindButtons(); this.createControls(); this.showScreen('screen-menu'); }
  private bind(id: string, fn: () => void): void { const node = document.getElementById(id); if (node) node.addEventListener('click', () => { window.dispatchEvent(new Event('ui-click')); fn(); }); }
  private bindButtons(): void {
    this.bind('btn-career', this.opts.onCareer); this.bind('btn-free', this.opts.onFree); this.bind('btn-continue', this.opts.onContinue); this.bind('btn-settings', () => this.opts.onSettings('menu')); this.bind('btn-credits', this.opts.onCredits); this.bind('btn-reset', this.opts.onResetProgress);
    this.bind('char-back', this.opts.onBackToMenu); this.bind('char-confirm', this.opts.onCharacterConfirm); this.bind('veh-back', () => this.showScreen('screen-character')); this.bind('veh-confirm', this.opts.onVehicleConfirm); this.bind('brief-back', () => this.showScreen('screen-vehicle')); this.bind('brief-start', this.opts.onBriefingStart);
    this.bind('worksheet-confirm', this.opts.onWorksheetConfirm); this.bind('pause-resume', this.opts.onPauseResume); this.bind('pause-restart', this.opts.onPauseRestart); this.bind('pause-menu', this.opts.onPauseMenu); this.bind('pause-settings', () => this.opts.onSettings('pause')); this.bind('set-back', this.opts.onSettingsBack); this.bind('set-reset', this.opts.onSettingsReset); this.bind('res-next', this.opts.onResultsNext); this.bind('res-menu', this.opts.onResultsMenu); this.bind('credits-back', () => this.showScreen('screen-menu'));
    this.bind('confirm-no', () => this.showScreen(null)); this.bind('confirm-yes', () => { const fn = (this as unknown as { confirmAction?: () => void }).confirmAction; this.showScreen(null); fn?.(); });
  }
  renderCharacterSelect(chars: CharacterSpec[]): void {
    const cards = el('char-cards'); cards.innerHTML = '';
    chars.forEach(c => { const b = document.createElement('button'); b.className = 'select-card' + (c.id === this.selectedCharacterId ? ' selected' : ''); b.innerHTML = '<strong>' + c.name + '</strong><span>' + c.role + '</span><small>' + c.perkName + '</small>'; b.addEventListener('click', () => { this.selectedCharacterId = c.id; this.renderCharacterSelect(chars); el('char-detail').textContent = c.perkDesc; }); cards.appendChild(b); });
    const chosen = chars.find(c => c.id === this.selectedCharacterId) ?? chars[0]; el('char-detail').textContent = chosen.name + ' · ' + chosen.perkDesc; this.showScreen('screen-character');
  }
  renderVehicleSelect(vehicles: VehicleSpec[], unlocked: string[], free: boolean): void {
    const cards = el('vehicle-cards'); cards.innerHTML = ''; const sub = el('veh-sub'); sub.textContent = free ? 'Mode bebas: semua kendaraan tersedia, tanpa batas waktu.' : 'Kendaraan terbuka seiring progres karier.';
    vehicles.forEach(v => { const locked = !free && !unlocked.includes(v.id); const b = document.createElement('button'); b.className = 'select-card vehicle-card' + (v.id === this.selectedVehicleId ? ' selected' : '') + (locked ? ' locked' : ''); b.disabled = locked; b.innerHTML = '<strong>' + v.name + '</strong><span>' + v.capacity + ' paket · ' + v.maxSpeedKmh + ' km/jam</span><small>Akselerasi ' + v.accel.toFixed(1) + ' · kapasitas ' + v.cargoWeight + ' kg</small><div class="vehicle-swatch" style="background:' + v.color + '"></div>' + (locked ? '<small>Terbuka level ' + v.unlockLevel + '</small>' : ''); b.addEventListener('click', () => { this.selectedVehicleId = v.id; this.renderVehicleSelect(vehicles, unlocked, free); }); cards.appendChild(b); }); this.showScreen('screen-vehicle');
  }
  renderBriefing(name: string, vehicle: VehicleSpec, packages: { name: string; size: string; weight: number; customerId: string }[], count: number, limit: number, payment: number): void {
    el('brief-title').textContent = name;
    el('brief-stats').innerHTML = '<div class="stat-card">Tujuan<strong>' + count + ' pelanggan</strong></div>' +
      '<div class="stat-card">Kendaraan<strong>' + vehicle.name + '</strong></div>' +
      '<div class="stat-card">Batas waktu<strong>' + (limit ? Math.ceil(limit / 60) + ' menit' : 'Tanpa batas') + '</strong></div>' +
      '<div class="stat-card">Potensi pembayaran<strong>' + money(payment) + '</strong></div>';
    el('brief-packages').innerHTML = packages.map(p => '<div class="package-row"><span>' + p.name + ' · ' + p.size + '</span><small>' + p.customerId + ' · ' + p.weight.toFixed(1) + ' kg</small></div>').join(''); this.showScreen('screen-briefing');
  }
  renderWorksheet(report: SortingReport, vehicleName: string): void {
    el('worksheet-sub').textContent = 'Pemeriksaan muatan untuk ' + vehicleName + ' sebelum berangkat.';
    el('worksheet-capacity').innerHTML = '<h3>Kapasitas</h3><p>' + report.packed.length + ' paket · ' + report.totalWeight.toFixed(1) + ' kg / ' + report.weightCapacity + ' kg</p><b>' + (report.countOk && report.weightOk ? '✓ Muatan sesuai' : '⚠ Muatan tidak sesuai') + '</b>';
    el('worksheet-zones').innerHTML = '<h3>Zona tujuan</h3><p>' + report.zoneCount + ' zona pengiriman terdaftar</p>';
    el('worksheet-packing').innerHTML = '<h3>Urutan packing</h3><p>Barang berat di dasar; barang rapuh di lapisan atas.</p>';
    el('worksheet-axle').innerHTML = '<h3>Volume</h3><p>' + report.totalVolume.toFixed(2) + ' / ' + report.volumeCapacity.toFixed(2) + ' m³</p><b>' + (report.volumeOk ? '✓ Volume sesuai' : '⚠ Volume berlebih') + '</b>';
    el('worksheet-verdict').textContent = report.weightOk && report.volumeOk && report.countOk ? 'Manifest siap diproses.' : 'Pilih kendaraan dengan kapasitas lebih besar.'; this.showScreen('screen-worksheet');
  }
  showScreen(id: string | null): void { document.querySelectorAll('.screen').forEach(n => n.classList.remove('active')); if (id) document.getElementById(id)?.classList.add('active'); }
  showHUD(show: boolean): void { const hud = el('hud'); hud.classList.toggle('hidden', !show); }
  setSaveInfo(text: string): void { el('save-info').textContent = text; }
  toast(text: string, kind = 'info'): void {
    const box = el('hud-toasts');
    const duplicate = Array.from(box.children).find(node => (node as HTMLElement).textContent === text && (node as HTMLElement).className === 'toast ' + kind) as HTMLElement | undefined;
    const item = duplicate ?? document.createElement('div');
    if (!duplicate) { item.className = 'toast ' + kind; item.textContent = text; box.appendChild(item); }
    const oldTimer = this.toastTimers.get(item); if (oldTimer) window.clearTimeout(oldTimer);
    this.toastTimers.set(item, window.setTimeout(() => { item.remove(); this.toastTimers.delete(item); }, 3800));
    while (box.children.length > 3) { const oldest = box.firstElementChild as HTMLElement; const timer = this.toastTimers.get(oldest); if (timer) window.clearTimeout(timer); this.toastTimers.delete(oldest); oldest.remove(); }
  }
  updateHUD(d: HUDData): void {
    el('hud-job').textContent = d.jobName + (d.location ? ' · ' + d.location : ''); el('hud-packages').textContent = d.delivered + ' / ' + d.total + ' paket'; el('hud-target').textContent = 'Tujuan: ' + d.nextTarget + (d.nextDistance ? ' · ' + Math.round(d.nextDistance) + ' m' : ''); el('hud-time').textContent = d.hasTimeLimit ? 'Waktu tersisa ' + Math.ceil(d.timeLeft) + ' dtk' : 'Mode bebas · ' + Math.floor(d.elapsedWork / 60) + ' menit'; el('hud-escrow').textContent = 'Uang titipan: ' + money(d.escrow); const prompt = el('hud-prompt'); prompt.textContent = d.prompt; prompt.classList.toggle('hidden', !d.prompt.trim()); el('hud-clock').textContent = String(Math.floor(d.clock)).padStart(2, '0') + ':' + String(Math.floor((d.clock % 1) * 60)).padStart(2, '0');
    this.drawDashboard(d);
  }
  private drawDashboard(d: HUDData): void {
    const canvas = document.getElementById('dashboard') as HTMLCanvasElement; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h); ctx.fillStyle = 'rgba(13,20,28,.92)'; ctx.fillRect(0,0,w,h);
    const x = 82, y = 94, r = 64; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.strokeStyle = '#34404a'; ctx.beginPath(); ctx.arc(x,y,r,Math.PI,Math.PI*2); ctx.stroke(); const speed = Math.max(0, Math.min(180, Math.round(d.speedKmh))); ctx.strokeStyle = speed > 120 ? '#ff654f' : '#ffad47'; ctx.beginPath(); ctx.arc(x,y,r,Math.PI,Math.PI + Math.PI * speed / 180); ctx.stroke();
    ctx.fillStyle = '#f3f5f7'; ctx.textAlign = 'center'; ctx.font = 'bold 40px system-ui'; ctx.fillText(String(speed),x,y-3); ctx.font = '12px system-ui'; ctx.fillStyle = '#aebac5'; ctx.fillText('KM/JAM',x,y+18); ctx.font = 'bold 16px system-ui'; ctx.fillStyle = '#ffbd62'; ctx.fillText(d.gear,x,y+41);
    const fuel = Math.max(0,Math.min(1,d.fuelPct)); ctx.textAlign='left'; ctx.fillStyle='#aebac5'; ctx.font='12px system-ui'; ctx.fillText('BBM',174,23); ctx.fillStyle='#313b44'; ctx.fillRect(174,31,195,9); ctx.fillStyle=fuel<0.2?'#f06a58':'#54cf91'; ctx.fillRect(174,31,195*fuel,9); ctx.fillStyle='#e8edf2'; ctx.font='bold 13px system-ui'; ctx.fillText('RPM ' + Math.round(d.rpm),174,66); ctx.fillText('Kerusakan ' + Math.round(d.damage) + '%',174,89); ctx.fillText(d.onFoot ? 'Jalan kaki' : d.handbrake ? 'REM TANGAN AKTIF' : 'Transmisi manual',174,112); ctx.fillStyle='#aebac5'; ctx.font='10px system-ui'; ctx.fillText('WASD / layar · Shift · E aksi',174,135,195);
  }
  showResults(ev: JobEvaluation, level: number, rank: string, leveledUp: boolean, totalEarned: number, career: boolean): void {
    el('results-left').innerHTML = '<h2>' + ev.jobName + '</h2><p>' + ev.delivered + ' dari ' + ev.total + ' paket terkirim</p><p>Durasi ' + Math.floor(ev.timeUsed / 60) + ' menit ' + Math.floor(ev.timeUsed % 60) + ' detik</p><p>Pembayaran pelanggan ' + money(ev.receivedPayments) + '</p><p>Setoran DC ' + money(ev.deposited) + '</p>';
    el('results-right').innerHTML = '<h3>Gaji bersih</h3><strong class="result-pay">' + money(ev.payroll.net) + '</strong><p>Bonus: ' + money(ev.payroll.bonuses.reduce((s,b)=>s+b.amount,0)) + '</p><p>Potongan: ' + money(ev.payroll.penalties.reduce((s,b)=>s+b.amount,0)) + '</p><p>' + (career ? 'Level ' + level + ' · ' + rank + (leveledUp ? ' · LEVEL BARU!' : '') + '<br>Total pendapatan karier ' + money(totalEarned) : 'Free Mode · progres karier tidak berubah') + '</p>';
    el('res-next').classList.toggle('hidden', !career); this.showScreen('screen-results');
  }
  fillSettings(s: Settings): void { (el('set-master') as HTMLInputElement).value = String(s.master); (el('set-engine') as HTMLInputElement).value = String(s.engine); (el('set-sfx') as HTMLInputElement).value = String(s.sfx); (el('set-music') as HTMLInputElement).value = String(s.music); (el('set-steer') as HTMLInputElement).value = String(s.steerSens); (el('set-uiscale') as HTMLInputElement).value = String(s.uiScale); }
  readSettings(): Settings { return { master:+(el('set-master') as HTMLInputElement).value, engine:+(el('set-engine') as HTMLInputElement).value, sfx:+(el('set-sfx') as HTMLInputElement).value, music:+(el('set-music') as HTMLInputElement).value, steerSens:+(el('set-steer') as HTMLInputElement).value, uiScale:+(el('set-uiscale') as HTMLInputElement).value }; }
  openSettings(from: string): void { this.settingsFromScreen = from; this.showScreen('screen-settings'); }
  confirm(message: string, title: string, yes: () => void): void { el('confirm-text').textContent = message; el('confirm-title').textContent = title; (this as unknown as { confirmAction?: () => void }).confirmAction = yes; this.showScreen('screen-confirm'); }
  private createControls(): void {
    let panel = document.getElementById('touch-controls'); if (panel) return; panel = document.createElement('div'); panel.id = 'touch-controls'; panel.innerHTML = '<div class="control-cluster steering"><button data-key="KeyW" class="control-btn up">▲</button><button data-key="KeyA" class="control-btn">◀</button><button data-key="KeyS" class="control-btn">▼</button><button data-key="KeyD" class="control-btn">▶</button></div><div class="control-cluster pedals"><button data-key="ShiftLeft" class="control-btn">KOPLING</button><button data-key="Space" class="control-btn">REM TANGAN</button><button data-key="KeyS" class="control-btn pedal">REM</button><button data-key="KeyW" class="control-btn pedal accent">GAS</button></div><div class="control-cluster actions"><div class="action-gears"><button data-key="Digit1" class="control-btn">1</button><button data-key="Digit2" class="control-btn">2</button><button data-key="Digit3" class="control-btn">3</button><button data-key="Digit4" class="control-btn">4</button><button data-key="Digit5" class="control-btn">5</button><button data-key="KeyN" class="control-btn">N</button><button data-key="KeyR" class="control-btn">R</button></div><div class="action-aux"><button data-key="KeyE" class="control-btn">E · AKSI</button><button data-key="KeyF" class="control-btn">F · MASUK</button><button data-key="Escape" class="control-btn">PAUSE</button></div></div>';
    const hud = document.getElementById('hud'); hud?.appendChild(panel);
    const held = new Map<string, number>();
    const down = (code: string) => { const count = held.get(code) ?? 0; held.set(code, count + 1); if (!count) window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })); };
    const up = (code: string) => { const count = held.get(code) ?? 0; if (count <= 1) { held.delete(code); window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); } else held.set(code, count - 1); };
    panel.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b => { const code = b.dataset.key!; b.addEventListener('pointerdown',e=>{e.preventDefault(); b.classList.add('pressed'); down(code); }); const stop=()=>{b.classList.remove('pressed');up(code);}; b.addEventListener('pointerup',stop); b.addEventListener('pointercancel',stop); b.addEventListener('pointerleave',stop); });
  }
}








