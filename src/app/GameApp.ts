// ============ GameApp: orkestrator utama alur permainan ============
import { GameEngine } from '../engine/GameEngine';
import { BirdEyeCamera } from '../camera/BirdEyeCamera';
import { MapBuilder } from '../world/MapBuilder';
import { CharacterController } from '../character/Character';
import { VehicleController, type VehicleInput } from '../vehicle/Vehicle';
import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { Career } from '../career/Career';
import { Economy } from '../economy/Economy';
import { DeliveryManager, type CustomerRuntime } from '../delivery/DeliveryManager';
import { Minimap, RoutePlanner } from '../navigation/Minimap';
import { UI } from '../ui/UI';
import { DialogManager, type DialogStep } from '../ui/Dialog';
import { NPCManager } from '../world/NPCManager';
import { computeSorting, computeRoute, computeEvaluationMath, type SortingReport } from '../delivery/SortingSystem';
import { buildWorldData } from '../data/world';
import { CHARACTERS, ECONOMY, VEHICLES, NPCS, formatRupiah } from '../data/config';
import type { CharacterSpec } from '../data/types';
import * as BABYLON from 'babylonjs';

type GameState = 'menu' | 'select' | 'briefing' | 'playing' | 'results';

export class GameApp {
  engine: GameEngine;
  mapBuilder: MapBuilder;
  camera: BirdEyeCamera;
  input: InputManager;
  audio = new AudioManager();
  career = new Career();
  ui: UI;
  economy = new Economy();
  delivery: DeliveryManager;
  minimap: Minimap;
  fullMap: Minimap;
  router: RoutePlanner;
  dialog: DialogManager;
  npcs: NPCManager;

  state: GameState = 'menu';
  paused = false;
  mode: 'career' | 'free' | null = null;
  character: CharacterSpec | null = null;
  vehicle: VehicleController | null = null;
  backdropVan: VehicleController | null = null;
  onFoot: CharacterController | null = null;
  driving = false;
  private footCameraHeading = Math.PI;
  timeOfDay = 8.5;
  depositedTotal = 0;
  private t = 0;
  private wasDialogOpen = false;
  private lastInterior: string | null = null;
  private directionArrow: BABYLON.TransformNode | null = null;
  private pendingSorting: SortingReport | null = null;
  private jobPrepared = false;
  private fullMapOpen = false;

  constructor(canvasParent: HTMLElement) {
    const canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    canvasParent.appendChild(canvas);

    this.engine = new GameEngine(canvas);
    this.mapBuilder = new MapBuilder(this.engine.scene, buildWorldData(Math.floor(Math.random() * 0xffffffff)), this.engine);
    this.camera = new BirdEyeCamera(this.engine.scene);
    this.dialog = new DialogManager();
    this.input = new InputManager(() => (this.state === 'playing' && !this.paused && !this.fullMapOpen) || this.dialog.open);
    this.delivery = new DeliveryManager(this.mapBuilder.world.customers);
    this.router = new RoutePlanner(this.mapBuilder.world);
    this.minimap = new Minimap(document.getElementById('minimap') as HTMLCanvasElement, this.mapBuilder.world);
    this.fullMap = new Minimap(document.getElementById('full-map') as HTMLCanvasElement, this.mapBuilder.world);
    this.npcs = new NPCManager(this.engine.scene, this.engine, this.mapBuilder.world);
    this.createDirectionArrow();

    this.ui = new UI({
      onCareer: () => this.startMode('career'),
      onFree: () => this.startMode('free'),
      onContinue: () => this.startMode('career'),
      onSettings: (from) => { this.ui.fillSettings(this.career.data.settings); this.ui.openSettings(from); },
      onCredits: () => this.ui.showScreen('screen-credits'),
      onResetProgress: () => this.ui.confirm(
        'Semua progres karier (level, kendaraan, penghasilan) akan dihapus. Lanjutkan?',
        'Reset Progres',
        () => { this.career.reset(); this.refreshSaveInfo(); this.ui.toast('Progres karier direset.', 'warn'); }),
      onCharacterConfirm: () => {
        const id = this.ui.selectedCharacterId;
        this.character = CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
        this.state = 'select';
        const unlocked = this.mode === 'free'
          ? VEHICLES.map(v => v.id)
          : this.career.data.unlockedVehicles;
        this.ui.renderVehicleSelect(VEHICLES, unlocked, this.mode === 'free');
      },
      onBackToMenu: () => this.backToMenu(),
      onVehicleConfirm: () => {
        const id = this.ui.selectedVehicleId;
        if (!id) return;
        const spec = VEHICLES.find(v => v.id === id)!;
        const level = this.mode === 'career' ? this.career.data.level : 1;
        this.delivery.buildJob(level, this.mode === 'free');
        this.jobPrepared = true;
        if (this.character?.perkId === 'time') this.delivery.timeLimit = Math.round(this.delivery.timeLimit * 1.2);
        this.ui.renderBriefing(
          this.delivery.jobName, spec, this.delivery.packages,
          this.delivery.customers.length, this.delivery.timeLimit, this.delivery.totalExpectedPayments);
        this.state = 'briefing';
      },
      onWorksheetConfirm: () => this.confirmWorksheet(),
      onBriefingStart: () => this.openManagerDialog(),
      onPauseResume: () => this.togglePause(),
      onPauseRestart: () => { this.paused = false; this.ui.showScreen(null); this.ui.showHUD(true); this.beginJob(); },
      onPauseMenu: () => this.backToMenu(),
      onSettingsBack: () => {
        const s = this.ui.readSettings();
        this.career.updateSettings(s);
        this.audio.setVolumes(s.master, s.engine, s.sfx, s.music);
        this.ui.fillSettings(s);
        if (this.ui.settingsFromScreen === 'pause') this.ui.showScreen('screen-pause');
        else this.ui.showScreen('screen-menu');
      },
      onSettingsReset: () => {
        this.career.updateSettings({ master: 80, engine: 70, sfx: 80, music: 35, steerSens: 100, uiScale: 100 });
        this.ui.fillSettings(this.career.data.settings);
        this.audio.setVolumes(80, 70, 80, 35);
      },
      onResultsNext: () => this.beginJob(),
      onResultsMenu: () => this.backToMenu(),
      onConfirm: () => { /* noop */ },
    });

    this.input.on('Escape', () => {
      if (this.fullMapOpen) { this.setFullMapOpen(false); return; }
      if (this.dialog.open) { this.dialog.close(); return; }
      if (this.state === 'playing') this.togglePause();
    });

    // pilihan dialog lewat keyboard
    for (const code of ['Digit1', 'Digit2', 'Digit3', 'Enter']) {
      this.input.on(code, () => { if (this.dialog.open) this.dialog.handleKey(code); });
    }

    this.bindCameraLook();
    this.bindFullMap();

    window.addEventListener('ui-click', () => this.audio.sfxClick());

    this.audio.setVolumes(
      this.career.data.settings.master,
      this.career.data.settings.engine,
      this.career.data.settings.sfx,
      this.career.data.settings.music);

    this.spawnBackdrop();
    this.engine.setTimeOfDay(9);
    this.refreshSaveInfo();
    this.ui.showScreen('screen-menu');

    this.engine.engine.runRenderLoop(() => this.tick());
    window.addEventListener('resize', () => this.engine.resize());
  }

  private bindCameraLook(): void {
    const pointers = new Map<number, { x: number; y: number }>();
    const canLook = () => this.state === 'playing' && !this.paused && !this.dialog.open && !this.fullMapOpen;
    const center = () => {
      const values = [...pointers.values()];
      return values.reduce((point, item) => ({ x: point.x + item.x / values.length, y: point.y + item.y / values.length }), { x: 0, y: 0 });
    };

    window.addEventListener('pointerdown', event => {
      if (!canLook() || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
      if (event.target instanceof Element && event.target.closest('[data-key], .screen')) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size >= 2) event.preventDefault();
    }, { capture: true, passive: false });
    window.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId)) return;
      const previousCenter = pointers.size >= 2 ? center() : null;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (previousCenter && canLook()) {
        const nextCenter = center();
        this.camera.orbitBy(nextCenter.x - previousCenter.x, nextCenter.y - previousCenter.y);
        event.preventDefault();
      }
    }, { capture: true, passive: false });
    const endPointer = (event: PointerEvent) => { pointers.delete(event.pointerId); };
    window.addEventListener('pointerup', endPointer, true);
    window.addEventListener('pointercancel', endPointer, true);

    // Dua jari di touchpad laptop dikirim browser sebagai gerakan wheel yang halus.
    window.addEventListener('wheel', event => {
      if (!canLook()) return;
      event.preventDefault();
      this.camera.orbitBy(event.deltaX, event.deltaY);
    }, { capture: true, passive: false });
  }

  private bindFullMap(): void {
    const mini = document.getElementById('minimap') as HTMLCanvasElement;
    const overlay = document.getElementById('full-map-overlay')!;
    const close = document.getElementById('full-map-close')!;
    mini.addEventListener('click', () => this.setFullMapOpen(true));
    mini.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.setFullMapOpen(true);
      }
    });
    close.addEventListener('click', () => this.setFullMapOpen(false));
    overlay.addEventListener('click', event => {
      if (event.target === overlay) this.setFullMapOpen(false);
    });
  }

  private setFullMapOpen(open: boolean): void {
    if (this.fullMapOpen === open) return;
    this.fullMapOpen = open;
    const overlay = document.getElementById('full-map-overlay');
    overlay?.classList.toggle('hidden', !open);
    overlay?.setAttribute('aria-hidden', String(!open));
    window.dispatchEvent(new Event('ui-click'));
    if (open) this.renderMinimap();
  }

  // ---------- Alur menu ----------
  /** Panah datar berkontras tinggi untuk menunjukkan arah tujuan di permukaan jalan. */
  private createDirectionArrow(): void {
    const scene = this.engine.scene;
    const arrow = new BABYLON.TransformNode('dirArrow', scene);
    const makeArrow = (name: string, width: number, length: number, y: number, color: string, glow: number) => {
      const points: [number, number][] = [
        [-width * 0.2, -length * 0.5], [width * 0.2, -length * 0.5],
        [width * 0.2, length * 0.02], [width * 0.5, length * 0.02],
        [0, length * 0.5], [-width * 0.5, length * 0.02],
        [-width * 0.2, length * 0.02],
      ];
      const positions = points.flatMap(([x, z]) => [x, y, z]);
      positions.push(0, y, 0);
      const center = points.length;
      const indices: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const next = (i + 1) % points.length;
        indices.push(center, next, i);
      }
      const normals = Array.from({ length: positions.length / 3 }, () => [0, 1, 0]).flat();
      const mesh = new BABYLON.Mesh(name, scene);
      const data = new BABYLON.VertexData();
      data.positions = positions;
      data.indices = indices;
      data.normals = normals;
      data.applyToMesh(mesh);
      const mat = new BABYLON.PBRMaterial(name + 'Mat', scene);
      mat.albedoColor = BABYLON.Color3.FromHexString(color);
      mat.emissiveColor = BABYLON.Color3.FromHexString(color).scale(glow);
      mat.roughness = 0.55;
      mat.backFaceCulling = false;
      mesh.material = mat;
      mesh.isPickable = false;
      mesh.parent = arrow;
    };
    makeArrow('dirArrowOutline', 1.18, 1.9, 0, '#18232b', 0.35);
    makeArrow('dirArrowFill', 0.88, 1.58, 0.025, '#ffc64a', 0.8);
    arrow.setEnabled(false);
    this.directionArrow = arrow;
  }

  private startMode(mode: 'career' | 'free'): void {
    this.mode = mode;
    this.ui.renderCharacterSelect(CHARACTERS);
    this.state = 'select';
  }

  private backToMenu(): void {
    this.setFullMapOpen(false);
    this.state = 'menu';
    this.paused = false;
    this.driving = false;
    this.audio.stopEngine();
    this.ui.showHUD(false);
    this.spawnBackdrop();
    this.refreshSaveInfo();
    this.ui.showScreen('screen-menu');
  }

  private refreshSaveInfo(): void {
    if (this.career.data.jobsDone > 0) {
      this.ui.setSaveInfo(
        `Save: Level ${this.career.data.level} (${this.career.rank()}) · ${this.career.data.jobsDone} pekerjaan · total ${formatRupiah(this.career.data.totalEarned)}`);
    } else {
      this.ui.setSaveInfo('Belum ada progres tersimpan - mulai Career Mode untuk memulai karier.');
    }
  }

  private spawnBackdrop(): void {
    this.backdropVan?.dispose();
    const spec = VEHICLES.find(v => v.id === 'cargovan')!;
    this.backdropVan = new VehicleController(this.engine.scene, spec);
    this.backdropVan.spawn(this.mapBuilder.world.dc.spawn.x, this.mapBuilder.world.dc.spawn.z - 4, 0);
  }

  // ---------- Mulai / ulang pekerjaan ----------
  beginJob(): void {
    this.setFullMapOpen(false);
    if (!this.character) this.character = CHARACTERS[0];
    const level = this.mode === 'career' ? this.career.data.level : 1;
    if (!this.jobPrepared) this.delivery.buildJob(level, this.mode === 'free');
    this.jobPrepared = false;
    if (this.character.perkId === 'time') this.delivery.timeLimit = Math.round(this.delivery.timeLimit * 1.2);
    this.economy.reset();
    this.depositedTotal = 0;

    this.backdropVan?.dispose();
    this.backdropVan = null;

    const spec = VEHICLES.find(v => v.id === this.ui.selectedVehicleId) ?? VEHICLES[0];
    this.vehicle?.dispose();
    this.vehicle = new VehicleController(this.engine.scene, spec, this.character.perkId === 'fuel');
    this.vehicle.steerScale =
      (this.career.data.settings.steerSens / 100) * (this.character.perkId === 'handling' ? 1.15 : 1);
    this.vehicle.spawn(this.mapBuilder.world.dc.spawn.x, this.mapBuilder.world.dc.spawn.z, 0);

    const dc = this.mapBuilder.world.dc;
    if (!this.onFoot) {
      this.onFoot = new CharacterController(this.engine.scene, this.character, dc.spawn.x, dc.spawn.z);
    }
    this.onFoot.x = dc.spawn.x + 2.6;
    this.onFoot.z = dc.spawn.z;
    this.onFoot.heading = Math.PI;
    this.onFoot.speedKmh = 0;
    this.footCameraHeading = Math.PI;
    this.onFoot.rig.root.rotation.y = this.onFoot.heading;
    this.onFoot.setVisible(true);

    this.driving = false;
    this.state = 'playing';
    this.paused = false;
    this.ui.showHUD(true);
    this.ui.showScreen(null);
    this.ui.toast('Kamu berada di DC. Tekan F di dekat kendaraan untuk masuk, muat paket di loading bay (E), dan geser dua jari untuk melihat sekitar.', 'info');
  }

  // ---------- Loop ----------
  private tick(): void {
    const dt = Math.min(this.engine.engine.getDeltaTime() / 1000, 0.05);
    this.t += dt;

    this.dialog.update(dt);
    if (this.wasDialogOpen && !this.dialog.open) this.input.clearPressed();
    this.wasDialogOpen = this.dialog.open;

    if (!this.fullMapOpen) this.npcs.update(dt, this.t);

    if (this.state === 'playing' && this.fullMapOpen) {
      this.renderMinimap();
    } else if (this.state === 'playing' && !this.paused && !this.dialog.open) {
      this.updateGameplay(dt);
    } else if (this.state === 'menu' && this.backdropVan) {
      this.camera.orbit(dt, this.mapBuilder.world.dc.x, this.mapBuilder.world.dc.z);
      this.engine.setTimeOfDay(9);
    }

    if (this.state === 'playing') this.updateDirectionArrow();

    if (!this.fullMapOpen) this.mapBuilder.update(dt, this.t);
    this.engine.scene.render();
  }

  /** Panah di tanah saat berjalan, atau melayang tepat di atas bagian depan kendaraan. */
  private updateDirectionArrow(): void {
    const arrow = this.directionArrow;
    if (!arrow) return;
    const pos = this.activePos();
    const next = this.delivery.customers.find(c => c.status === 'pending');
    const dc = this.mapBuilder.world.dc;
    const tx = next ? next.x : dc.x;
    const tz = next ? next.z : dc.z;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    if (Math.hypot(dx, dz) < 3) {
      arrow.setEnabled(false);
      return;
    }
    const distance = Math.hypot(dx, dz);
    const dirX = dx / distance;
    const dirZ = dz / distance;
    const h = Math.atan2(dx, dz);
    let markerX: number;
    let markerZ: number;
    let markerY: number;
    if (this.driving && this.vehicle) {
      const vehicle = this.vehicle;
      const frontDistance = vehicle.spec.length * 0.56;
      markerX = vehicle.x + Math.sin(vehicle.heading) * frontDistance;
      markerZ = vehicle.z + Math.cos(vehicle.heading) * frontDistance;
      markerY = vehicle.spec.id === 'truck'
        ? vehicle.spec.height * 0.7 + 1.75
        : vehicle.spec.height * 0.54 + 2.35;
      arrow.scaling.set(1.2, 1, 1.2);
    } else {
      const lead = 1.8;
      markerX = pos.x + dirX * lead;
      markerZ = pos.z + dirZ * lead;
      const groundRay = new BABYLON.Ray(new BABYLON.Vector3(markerX, 20, markerZ), BABYLON.Vector3.Down(), 40);
      const groundHit = this.engine.scene.pickWithRay(groundRay, mesh =>
        mesh.name === 'city_ground' || mesh.name === 'road' || mesh.name === 'sidewalk' || mesh.name === 'zebra');
      markerY = (groundHit?.hit ? groundHit.pickedPoint?.y ?? 0 : 0) + 0.025;
      arrow.scaling.setAll(1);
    }
    arrow.setEnabled(true);
    arrow.position.set(markerX, markerY, markerZ);
    arrow.rotation.set(0, h, 0);
  }

  private activePos(): { x: number; z: number } {
    if (this.driving && this.vehicle) return this.vehicle.position;
    return this.onFoot?.position ?? { x: 0, z: 0 };
  }

  private updateGameplay(dt: number): void {
    const input = this.input;
    const vehicle = this.vehicle;
    const onFoot = this.onFoot;

    this.delivery.tick(dt);
    this.timeOfDay = (this.timeOfDay + dt * 0.06) % 24;
    this.engine.setTimeOfDay(this.timeOfDay);

    if (this.driving && vehicle) {
      const vin: VehicleInput = {
        throttle: input.forward(),
        brake: input.back(),
        left: input.left(),
        right: input.right(),
        handbrake: input.handbrake(),
        clutch: input.clutch(),
      };
      const ox = vehicle.x, oz = vehicle.z;
      vehicle.update(dt, vin);
      if (vehicle.applyImpact(this.mapBuilder.collisionBoxes)) {
        vehicle.x = ox;
        vehicle.mesh.root.position.set(ox, 0, oz);
        vehicle.z = oz;
        this.audio.sfxCrash(Math.abs(vehicle.speedKmh) / 10);
        if (Math.abs(vehicle.speedKmh) > 15) {
          this.ui.toast('Tabrakan! Kerusakan kendaraan bertambah.', 'error');
        }
      }
      vehicle.clampToBounds(
        this.mapBuilder.world.bounds.minX, this.mapBuilder.world.bounds.maxX,
        this.mapBuilder.world.bounds.minZ, this.mapBuilder.world.bounds.maxZ);

      // pemilihan gigi
      const gearKeys: [string, number][] = [
        ['Digit1', 1], ['Digit2', 2], ['Digit3', 3], ['Digit4', 4], ['Digit5', 5], ['KeyN', 0], ['KeyR', -1],
      ];
      for (const [code, g] of gearKeys) {
        if (input.consumePressed(code)) {
          const res = vehicle.setGear(g, input.clutch());
          if (!res.ok) {
            this.ui.toast(res.message ?? 'Gigi ditolak.', 'warn');
            this.audio.sfxDeny();
          } else {
            this.audio.sfxClick();
          }
        }
      }

      this.audio.updateEngine(vehicle.rpm, vin.throttle ? 1 : 0, true);

      if (input.consumePressed('KeyF') && Math.abs(vehicle.speed) < 0.9) {
        this.exitVehicle();
      }
    } else if (onFoot) {
      onFoot.update(dt, { f: input.forward(), b: input.back(), l: input.left(), r: input.right() }, { boxes: this.mapBuilder.collisionBoxes }, this.camera.viewHeading(this.footCameraHeading));
      if (input.consumePressed('KeyF') && vehicle) {
        const d = Math.hypot(onFoot.x - vehicle.x, onFoot.z - vehicle.z);
        if (d < 5) this.enterVehicle();
        else this.ui.toast('Terlalu jauh dari kendaraan.', 'warn');
      }
    }

    if (input.consumePressed('KeyE')) this.interact();

    this.trackInterior();
    this.updateMarkers();
    // POV saat berjalan stabil; pemain dapat menghadap ke arah geraknya tanpa mengubah sumbu kontrol.
    const camHeading = this.driving && vehicle ? vehicle.heading : this.footCameraHeading;
    this.camera.follow(dt, this.activePos().x, this.activePos().z, camHeading);
    this.renderMinimap();
    this.updateHUD();
  }

  // ---------- Masuk / keluar kendaraan ----------
  private enterVehicle(): void {
    if (!this.vehicle || !this.onFoot) return;
    this.driving = true;
    this.onFoot.setVisible(false);
    this.audio.startEngine();
    this.ui.toast('Masuk kendaraan. Shift = kopling · 1-5 gigi · N netral · R mundur · Space rem tangan.', 'info');
  }

  private exitVehicle(): void {
    if (!this.vehicle || !this.onFoot) return;
    this.driving = false;
    const h = this.vehicle.heading;
    this.onFoot.x = this.vehicle.x - Math.cos(h) * 2.6;
    this.onFoot.z = this.vehicle.z + Math.sin(h) * 2.6;
    this.onFoot.heading = h;
    this.onFoot.speedKmh = 0;
    this.footCameraHeading = h;
    this.onFoot.rig.root.rotation.y = h;
    this.onFoot.setVisible(true);
    this.audio.stopEngine();
    this.ui.toast('Keluar dari kendaraan. F untuk masuk kembali.', 'info');
  }

  // ---------- Interaksi (E) - membuka dialog ----------
  private interact(): void {
    const pos = this.activePos();
    const vehicle = this.vehicle;
    const dc = this.mapBuilder.world.dc;

    if (this.driving && vehicle && Math.abs(vehicle.speedKmh) > ECONOMY.interactMaxSpeed) {
      this.ui.toast('Hentikan kendaraan lebih dahulu (di bawah 5 km/jam).', 'warn');
      this.audio.sfxDeny();
      return;
    }

    // 1. Pelanggan terdekat → dialog penyerahan paket
    let nearestCust: CustomerRuntime | null = null;
    let bestD = Infinity;
    for (const c of this.delivery.customers) {
      if (c.status !== 'pending') continue;
      const d = Math.hypot(pos.x - c.x, pos.z - c.z);
      if (d <= ECONOMY.interactRadius && d < bestD) { bestD = d; nearestCust = c; }
    }
    if (nearestCust) { this.openDeliveryDialog(nearestCust); return; }

    // 2. Setor uang di DC → dialog kasir
    const dDep = Math.hypot(pos.x - dc.depositZone.x, pos.z - dc.depositZone.z);
    if (dDep <= ECONOMY.depositRadius && this.delivery.escrow > 0) { this.openDepositDialog(); return; }

    // 3. Muat paket di loading bay DC → dialog penyortir
    const dLoad = Math.hypot(pos.x - dc.loadZone.x, pos.z - dc.loadZone.z);
    if (dLoad <= ECONOMY.loadRadius) {
      if (!this.delivery.loaded) { this.openLoadDialog(); return; }
      this.ui.toast('Paket sudah dimuat. Berangkatlah ke pelanggan pertama!', 'info');
      return;
    }

    // 4. NPC terdekat (manajer / penyortir) → dialog roleplay
    const npc = this.npcs.nearest(pos.x, pos.z, 4.5);
    if (npc) { this.openNPCDialog(npc); return; }

    this.ui.toast('Tidak ada interaksi di sini.', 'info');
  }

  // ---------- Dialog misi ----------
  private openManagerDialog(): void {
    const manager = NPCS.find(n => n.role === 'manager')!;
    const name = this.character?.name ?? 'Kurir';
    const n = this.delivery.customers.length;
    const steps: DialogStep[] = [
      {
        speaker: manager.name, portrait: 'manager',
        text: `Selamat bekerja, ${name}! Saya ${manager.name}, ${manager.title}. Hari ini rute ${this.delivery.jobName}: ${n} pelanggan menunggu paket.`,
      },
      {
        speaker: manager.name, portrait: 'manager',
        text: 'Alurnya: tim penyortir menghitung & packing paket di gudang, lalu kamu antar ke setiap pelanggan, dan WAJIB setor semua uang titipan ke kasir sebelum laporan saya buat.',
      },
      {
        speaker: manager.name, portrait: 'manager',
        text: 'Datanglah ke loading bay di depan gudang untuk proses penyortiran. Ingat: WASD jalan, F masuk/keluar kendaraan, Shift kopling, 1-5 gigi, Space rem tangan, E interaksi.',
        choices: [{ label: 'Siap bekerja!' }],
      },
    ];
    if (this.mode === 'career' && this.career.data.jobsDone === 0) {
      steps.push({ speaker: manager.name, portrait: 'manager', text: 'Tutorial 1/3 - Di DC, dekati loading bay lalu tekan E untuk menghitung, menyortir, dan memuat paket. Ikuti petunjuk di layar sebelum berkendara.' });
      steps.push({ speaker: manager.name, portrait: 'manager', text: 'Tutorial 2/3 - Tekan F untuk masuk mobil. Tahan Shift (kopling), tekan 1 untuk gigi pertama, lalu tahan W atau tombol GAS. A/D untuk belok, S atau tombol REM untuk memperlambat, dan Space untuk rem tangan.' });
      steps.push({ speaker: manager.name, portrait: 'manager', text: 'Tutorial 3/3 - Ikuti penanda oranye ke pelanggan, berhenti dekat tujuan lalu tekan E untuk menyerahkan paket. Setelah semua terkirim, kembali ke DC dan setorkan uang. Tombol layar tersedia di HP maupun laptop.' });
    }
    this.dialog.show(steps, () => this.beginJob(), this.mode === 'career' && this.career.data.jobsDone === 0);
  }

  private openNPCDialog(npc: { spec: { name: string; role: string; title: string }; }): void {
    const spec = npc.spec;
    if (spec.role === 'manager') {
      this.dialog.show([
        {
          speaker: spec.name, portrait: 'manager',
          text: `Saya ${spec.name}, ${spec.title}. Pekerjaan hari ini: ${this.delivery.jobName}. Pastikan semua paket terkirim dan uangnya disetor di kasir.`,
        },
      ]);
    } else {
      this.dialog.show([
        {
          speaker: spec.name, portrait: 'sorter',
          text: `Saya ${spec.name}, ${spec.title}. Tugas saya menyortir paket per zona, menghitung berat & volume, serta mengatur packing sebelum dimuat ke kendaraan.`,
        },
        {
          speaker: spec.name, portrait: 'sorter',
          text: 'Aturan packing kami: barang berat di dasar bak dekat poros, barang ringan di atas, dan barang fragile selalu di lapisan paling atas.',
        },
      ]);
    }
  }

  /** Dialog penyortir di loading bay → lembar kerja perhitungan. */
  private openLoadDialog(): void {
    const sorter = NPCS.find(n => n.role === 'sorter')!;
    this.dialog.show([
      {
        speaker: sorter.name, portrait: 'sorter',
        text: `Halo ${this.character?.name ?? 'kurir'}! Saya ${sorter.name}, ${sorter.title}. Sebelum dimuat, saya hitung dulu manifest rute ${this.delivery.jobName}.`,
      },
      {
        speaker: sorter.name, portrait: 'sorter',
        text: 'Berat, volume, zona tujuan, urutan packing, dan distribusi beban poros semuanya saya olot di lembar kerja. Silakan diperiksa.',
        choices: [{ label: 'Lihat lembar kerja penyortiran' }],
      },
    ], () => this.openWorksheet());
  }

  /** Tampilkan lembar kerja perhitungan penyortiran. */
  private openWorksheet(): void {
    const vehicle = this.vehicle;
    if (!vehicle) return;
    const custPos = new Map(this.delivery.customers.map(c => [c.id, { x: c.x, z: c.z }]));
    const report = computeSorting(this.delivery.packages, vehicle.spec, this.mapBuilder.world.dc, custPos);
    this.pendingSorting = report;
    this.ui.renderWorksheet(report, vehicle.spec.name);
  }

  /** Konfirmasi worksheet: validasi kapasitas → proses packing → perhitungan rute kurir. */
  private confirmWorksheet(): void {
    const report = this.pendingSorting;
    const vehicle = this.vehicle;
    if (!report || !vehicle) { this.ui.showScreen(null); return; }

    if (!(report.weightOk && report.volumeOk && report.countOk)) {
      this.ui.toast('Muatan melebihi kapasitas kendaraan! Pilih kendaraan lebih besar.', 'error');
      this.audio.sfxDeny();
      this.ui.showScreen(null);
      return;
    }

    const res = this.delivery.loadPackages(vehicle.spec.capacity);
    if (!res.ok) {
      this.ui.toast(res.message, 'error');
      this.ui.showScreen(null);
      return;
    }
    const totalWeight = this.delivery.packages.reduce((s, p) => s + p.weight, 0);
    vehicle.loadedMass = totalWeight;
    this.audio.sfxSuccess();
    this.ui.toast(`Packing selesai: ${report.packed.length} paket dimuat (berat di dasar, fragile di atas). Total ${Math.round(totalWeight)} kg.`, 'success');
    this.ui.showScreen(null);
    this.openRouteCalculation();
  }

  /** Perhitungan rute kurir: jarak, BBM, waktu, potensi pendapatan. */
  private openRouteCalculation(): void {
    const dc = this.mapBuilder.world.dc;
    const legs: { target: string; distanceM: number }[] = [];
    let prev = { x: dc.x, z: dc.z };
    for (const c of this.delivery.customers) {
      const r = this.router.route(prev.x, prev.z, c.x, c.z);
      legs.push({ target: `${c.name} (${c.id})`, distanceM: r.distance });
      prev = { x: c.x, z: c.z };
    }
    const vehicle = this.vehicle!;
    const route = computeRoute(legs, this.delivery.customers, vehicle.spec.fuelCapacity, vehicle.spec.fuelUse, 55);
    const legLines = route.legs.map(l => `${l.target}: ${(l.distanceM / 1000).toFixed(2)} km`).join('\n');
    this.dialog.show([
      {
        speaker: 'Kamu (Kurir)', portrait: 'kurir',
        text: `Perhitungan rute sebelum berangkat:\n${legLines}`,
      },
      {
        speaker: 'Kamu (Kurir)', portrait: 'kurir',
        text: `Total ${route.totalDistanceKm.toFixed(1)} km · estimasi BBM ${route.fuelEstimateL.toFixed(1)} liter · estimasi waktu ${route.timeEstimateMin.toFixed(0)} menit · potensi pendapatan ${formatRupiah(route.potentialRevenue)}. Ikuti panah arah di atas kendaraan!`,
        choices: [{ label: 'Berangkat!' }],
      },
    ]);
  }

  private openDeliveryDialog(cust: CustomerRuntime): void {
    const carried = this.delivery.packages.filter(p => p.customerId === cust.id && p.status === 'loaded').length;
    const money = formatRupiah(cust.payment);
    const steps: DialogStep[] = [];

    if (carried > 0) {
      steps.push({
        speaker: cust.name, portrait: 'customer',
        text: `Halo! Saya ${cust.name}, di ${cust.address}. Saya tunggu ${carried} paket hari ini. Bisa diserahkan sekarang?`,
      });
      steps.push({
        speaker: cust.name, portrait: 'customer',
        text: `Paketnya sudah lengkap. Terima kasih! Ini pembayarannya ${money}.`,
        choices: [{
          label: 'Serahkan paket & terima uang',
          onPick: () => {
            const res = this.delivery.tryDeliver(cust.id);
            if (res.ok) {
              this.audio.sfxSuccess();
              this.economy.recordPayment(cust.id, cust.name, res.payment);
            } else {
              this.ui.toast(res.message, 'warn');
              this.audio.sfxDeny();
            }
          },
        }],
      });
    } else {
      steps.push({
        speaker: cust.name, portrait: 'customer',
        text: `Halo! Saya ${cust.name}, di ${cust.address}. Tetapi saya tidak melihat paket untuk saya di kendaraan Anda...`,
      });
      steps.push({
        speaker: cust.name, portrait: 'customer',
        text: 'Maaf, kalau bukan pesanan saya tidak bisa saya terima. Silakan periksa lagi manifest Anda, ya.',
        choices: [{
          label: 'Minta maaf',
          onPick: () => {
            const res = this.delivery.tryDeliver(cust.id); // mencatat kesalahan kirim
            this.ui.toast('Salah kirim - penalti dicatat di evaluasi.', 'warn');
            this.audio.sfxDeny();
            void res;
          },
        }],
      });
    }
    this.dialog.show(steps);
  }

  private openDepositDialog(): void {
    const amt = formatRupiah(this.delivery.escrow);
    this.dialog.show([
      {
        speaker: 'Bu Kasir DC', portrait: 'cashier',
        text: `Selamat siang! Mau setor uang titipan ${amt} ke buku kas DC?`,
      },
      {
        speaker: 'Bu Kasir DC', portrait: 'cashier',
        text: `Baik, setoran ${amt} sudah saya catat.`,
        choices: [{
          label: 'Setor sekarang',
          onPick: () => {
            const res = this.delivery.deposit();
            if (res.ok) {
              this.depositedTotal += res.amount;
              this.economy.recordDeposit(res.amount);
              this.audio.sfxDeposit();
              this.ui.toast(res.message, 'success');
            } else {
              this.ui.toast(res.message, 'warn');
            }
          },
        }],
      },
    ], () => {
      if (this.delivery.isComplete()) {
        this.dialog.show([
          {
            speaker: 'Bu Kasir DC', portrait: 'cashier',
            text: 'Semua paket terkirim dan uang lengkap. Kerja bagus! Laporan evaluasi sudah menunggu di meja.',
            choices: [{ label: 'Lihat laporan', onPick: () => this.endJob() }],
          },
        ]);
      } else {
        this.ui.toast('Kembali mengantar sisa paket, lalu setor lagi di sini.', 'info');
      }
    });
  }

  /** Lacak posisi pemain: di dalam gedung → tampilkan info. */
  private trackInterior(): void {
    if (!this.onFoot) return;
    const { x, z } = this.onFoot;
    const inside = this.mapBuilder.interiors.find(i => x > i.x1 && x < i.x2 && z > i.z1 && z < i.z2);
    if (inside && this.lastInterior !== inside.name) {
      this.lastInterior = inside.name;
      this.ui.toast(`🏢 Kamu masuk ke ${inside.name}`, 'info');
    } else if (!inside && this.lastInterior) {
      this.ui.toast(`🚪 Kamu keluar dari ${this.lastInterior}`, 'info');
      this.lastInterior = null;
    }
  }

  // ---------- Penanda, minimap, HUD ----------
  private updateMarkers(): void {
    const nextId = this.delivery.customers.find(c => c.status === 'pending')?.id ?? null;
    const selected = new Set(this.delivery.customers.map(c => c.id));
    for (const [id, marker] of this.mapBuilder.markers) {
      const c = this.delivery.customers.find(item => item.id === id);
      marker.setVisible(selected.has(id));
      if (!c) continue;
      marker.setName(c.name);
      if (c.status === 'delivered') marker.setState('done');
      else if (c.id === nextId) marker.setState('active');
      else marker.setState('pending');
    }
  }

  private renderMinimap(): void {
    const pos = this.activePos();
    const next = this.delivery.customers.find(c => c.status === 'pending');
    const heading = this.driving && this.vehicle ? this.vehicle.heading : this.onFoot?.heading ?? 0;
    const route = next
      ? this.router.route(pos.x, pos.z, next.x, next.z)
      : { points: [], distance: 0 };
    const mapState = {
      playerX: pos.x,
      playerZ: pos.z,
      playerHeading: heading,
      dc: this.mapBuilder.world.dc,
      targets: this.delivery.customers.map((c, i) => ({
        x: c.x, z: c.z,
        state: c.status === 'delivered' ? 'done' : (next && c.id === next.id ? 'active' : 'pending'),
        order: i + 1,
      })),
      routePoints: route.points,
    };
    this.minimap.render(mapState, 0.016);
    if (this.fullMapOpen) this.fullMap.render(mapState, 0.016, true);
    this.currentRouteDistance = route.distance;
  }

  currentRouteDistance = 0;

  private updateHUD(): void {
    const vehicle = this.vehicle;
    const next = this.delivery.customers.find(c => c.status === 'pending');
    let prompt = '';

    if (this.driving && vehicle) {
      if (vehicle.fuelPct <= 0) prompt = 'Bahan bakar habis!';
      else if (vehicle.speedKmh < 2 && vehicle.gear === 0 && !this.input.clutch()) {
        prompt = 'Tekan 1 untuk masuk gigi 1 (tahan Shift = kopling saat pindah gigi)';
      }
      if (!prompt && vehicle.speedKmh < 5 && next) {
        const d = Math.hypot(vehicle.x - next.x, vehicle.z - next.z);
        if (d <= ECONOMY.interactRadius) prompt = `Tekan E - ngobrol dengan ${next.name}`;
      }
      if (!prompt && vehicle.speedKmh < 5) {
        const pos = this.activePos();
        const dc = this.mapBuilder.world.dc;
        if (Math.hypot(pos.x - dc.depositZone.x, pos.z - dc.depositZone.z) <= ECONOMY.depositRadius && this.delivery.escrow > 0) {
          prompt = `Tekan E - setor ${formatRupiah(this.delivery.escrow)}`;
        } else if (Math.hypot(pos.x - dc.loadZone.x, pos.z - dc.loadZone.z) <= ECONOMY.loadRadius && !this.delivery.loaded) {
          prompt = 'Tekan E - muat paket di loading bay';
        }
      }
      if (!prompt && Math.abs(vehicle.speed) < 0.9) prompt = 'Tekan F - keluar kendaraan';
    } else if (this.onFoot && vehicle) {
      const d = Math.hypot(this.onFoot.x - vehicle.x, this.onFoot.z - vehicle.z);
      if (d < 5) prompt = 'Tekan F - masuk kendaraan';
      const dc = this.mapBuilder.world.dc;
      const pos = this.onFoot.position;
      if (!prompt && next) {
        const dc2 = Math.hypot(pos.x - next.x, pos.z - next.z);
        if (dc2 <= ECONOMY.interactRadius) prompt = `Tekan E - ngobrol dengan ${next.name}`;
      }
      if (!prompt) {
        const npc = this.npcs.nearest(pos.x, pos.z, 4.5);
        if (npc) prompt = `Tekan E - ngobrol dengan ${npc.spec.name} (${npc.spec.title})`;
      }
      if (!prompt && Math.hypot(pos.x - dc.loadZone.x, pos.z - dc.loadZone.z) <= ECONOMY.loadRadius && !this.delivery.loaded) {
        prompt = 'Tekan E - siapkan paket di loading bay';
      }
      if (!prompt && Math.hypot(pos.x - dc.depositZone.x, pos.z - dc.depositZone.z) <= ECONOMY.depositRadius && this.delivery.escrow > 0) {
        prompt = `Tekan E - setor ${formatRupiah(this.delivery.escrow)}`;
      }
    }

    this.ui.updateHUD({
      jobName: this.delivery.jobName,
      delivered: this.delivery.deliveredCount,
      total: this.delivery.customers.length,
      loaded: this.delivery.loaded,
      loadedCount: this.delivery.loadedPackages,
      nextTarget: next ? `${next.name} - ${next.address}` : 'Semua paket terkirim - kembali ke DC',
      nextDistance: this.currentRouteDistance,
      timeLeft: this.delivery.timeLeft,
      hasTimeLimit: this.delivery.timeLimit > 0,
      escrow: this.delivery.escrow,
      speedKmh: this.driving ? (vehicle?.speedKmh ?? 0) : (this.onFoot?.speedKmh ?? 0),
      rpm: this.driving ? (vehicle?.rpm ?? 0) : 0,
      gear: this.driving ? (vehicle?.gearLabel ?? '-') : '-',
      fuelPct: vehicle?.fuelPct ?? 0,
      handbrake: this.driving && (vehicle?.handbrakeActive ?? false),
      damage: vehicle?.damage ?? 0,
      redline: vehicle?.redline ?? false,
      onFoot: !this.driving,
      clock: this.timeOfDay,
      elapsedWork: this.delivery.elapsed,
      location: this.lastInterior ?? '',
      prompt,
    });
  }

  // ---------- Selesai ----------
  private endJob(): void {
    const ev = this.delivery.evaluate(
      this.mode === 'career' ? this.career.data.level : 1,
      this.vehicle?.damage ?? 0,
      (this.vehicle?.fuelPct ?? 0) * 100,
      this.depositedTotal,
      this.character?.perkId === 'time' ? 1.5 : 1);

    let leveledUp = false;
    if (this.mode === 'career') {
      const res = this.career.registerJob(ev.payroll.net, ev.timeUsed);
      leveledUp = res.leveledUp;
      if (leveledUp) this.audio.sfxLevelUp();
    }

    // perhitungan evaluasi manajer (rincian matematis)
    const vehicle = this.vehicle;
    const math = computeEvaluationMath({
      delivered: ev.delivered,
      total: ev.total,
      onTime: ev.onTime,
      damage: ev.damage,
      fuelLeftPct: ev.fuelLeftPct,
      fuelCapacity: vehicle?.spec.fuelCapacity ?? 45,
      level: this.mode === 'career' ? this.career.data.level : 1,
      baseSalaryPerLevel: 85000,
      receivedPayments: ev.receivedPayments,
      deposited: ev.deposited,
      discrepancy: ev.discrepancy,
      bonuses: ev.payroll.bonuses,
      penalties: ev.payroll.penalties,
    });

    const manager = NPCS.find(n => n.role === 'manager')!;
    const bonusTxt = ev.payroll.bonuses.length
      ? ev.payroll.bonuses.map(b => `+${formatRupiah(b.amount)} (${b.label})`).join(', ')
      : 'tidak ada';
    const penaltyTxt = ev.payroll.penalties.length
      ? ev.payroll.penalties.map(p => `-${formatRupiah(p.amount)} (${p.label})`).join(', ')
      : 'tidak ada';

    this.paused = true;
    this.audio.stopEngine();
    this.ui.showHUD(false);
    this.dialog.show([
      {
        speaker: manager.name, portrait: 'manager',
        text: `Laporan ${ev.jobName}: ${ev.delivered}/${ev.total} paket terkirim (${math.deliveryRate.toFixed(0)}%), waktu ${ev.onTime ? 'tepat' : 'melewati batas'}, kerusakan ${Math.round(ev.damage)} poin.`,
      },
      {
        speaker: manager.name, portrait: 'manager',
        text: `Perhitungan gaji: pokok ${formatRupiah(math.baseSalary)} + bonus [${bonusTxt}] - penalti [${penaltyTxt}].`,
      },
      {
        speaker: manager.name, portrait: 'manager',
        text: `Bahan bakar terpakai ${math.fuelUsedL.toFixed(1)} liter (±${formatRupiah(math.fuelCost)}). Gaji bersih kamu: ${formatRupiah(math.netPay)}.`,
        choices: [{ label: 'Lihat laporan lengkap', onPick: () => this.showResults(ev, leveledUp) }],
      },
    ]);
    this.state = 'results';
  }

  private showResults(ev: import('../delivery/DeliveryManager').JobEvaluation, leveledUp: boolean): void {
    this.ui.showResults(
      ev, this.career.data.level, this.career.rank(), leveledUp,
      this.career.data.totalEarned, this.mode === 'career');
    this.state = 'results';
  }

  togglePause(): void {
    if (this.state !== 'playing') return;
    this.paused = !this.paused;
    this.input.clearPressed();
    if (this.paused) {
      this.ui.showScreen('screen-pause');
    } else {
      this.ui.showScreen(null);
    }
  }
}














