# CASH OR DUEL - 3D Delivery Simulator

Game simulasi kurir pengiriman barang 3D di lingkungan kota, dibangun dengan **Babylon.js + TypeScript + Vite**.
Seluruh peta, kendaraan, dan karakter dibangun secara **prosedural melalui kode** (tanpa aset eksternal / Blender).

## Menjalankan

```bash
npm install      # sekali saja
npm run dev      # development server (http://localhost:5173)
npm run build    # build produksi ke dist/
```

## Alur permainan

Main Menu → Career/Free Mode → Pilih Karakter → Pilih Kendaraan → Briefing → Distribution Center (DC)
→ muat paket → berkendara → antar paket ke pelanggan → terima pembayaran → kembali ke DC → setor uang
→ evaluasi pekerjaan & gaji → progres karier → pekerjaan berikutnya.

Poin penting:
- Uang pelanggan adalah **uang titipan** - wajib disetor di DC sebelum pekerjaan dihitung selesai.
- Salah kirim paket, tabrakan, dan keterlambatan menghasilkan **penalti**.
- Career Mode punya level, rank, unlock kendaraan, dan save lokal (LocalStorage).
- Free Mode: semua kendaraan bisa dicoba, tanpa batas waktu, tidak mengubah progres karier.

## Kontrol

| Tombol | Fungsi |
|---|---|
| W / S | Gas / Rem |
| A / D | Kemudi kiri / kanan |
| Shift | Kopling (tahan saat pindah gigi) |
| 1-5 | Gigi maju |
| N | Netral |
| R | Gigi mundur |
| Space | Rem tangan |
| E | Interaksi (muat paket / serahkan paket / setor uang) |
| F | Masuk / keluar kendaraan (berjalan kaki di sekitar) |
| Esc | Pause |
| Scroll | Zoom kamera |

## Karakter & peran

| Karakter | Peran | Keunggulan |
|---|---|---|
| Rani Putri | Kurir Senior | Konsumsi bahan bakar -25% |
| Budi Santoso | Sopir Andal | Respons kemudi +15% |
| Agus Wijaya | Manajer Rute | Batas waktu +20%, bonus tepat waktu 1.5× |

## Kendaraan

| Kendaraan | Kapasitas | Karakter |
|---|---|---|
| City Van | 8 paket | Cepat, lincah, rute sempit |
| Cargo Van | 16 paket | Seimbang, stabil |
| Delivery Truck | 28 paket | Muat besar, butuh ruang |

Beban paket memengaruhi akselerasi & jarak pengereman. Transmisi manual (kopling + gigi 1-5/N/R) memengaruhi RPM dan tenaga mesin.

## Fitur

- **Kamera chase-cam**: selalu di belakang pemain, searah hadap - mobil & karakter SELALU terlihat, kontrol WASD relatif kamera (W = menjauh dari kamera).
- **Panah arah 3D** mengambang di atas pemain, menunjuk tujuan berikutnya.
- **NPC roleplay di DC**: 1 manajer + 3 penyortir paket (nama Indonesia), masing-masing dengan model karakter beranimasi, rompi, topi, dan name tag.
- **Sistem perhitungan penyortiran** (lembar kerja detail): kapasitas berat & volume vs kendaraan, zona pengiriman, aturan packing (berat di dasar, fragile di atas), estimasi distribusi beban poros.
- **Perhitungan kurir**: rute (jarak per pelanggan via Dijkstra), estimasi BBM, estimasi waktu, potensi pendapatan.
- **Evaluasi manajer**: rincian matematis gaji (pokok + bonus - penalti, biaya BBM) via dialog.
- Kota 3D prosedural: jalan utama + lingkungan, 12+ blok bangunan, DC dengan loading bay, trotoar, marka jalan, pohon, lampu jalan, mobil parkir.
- **Gedung bisa dimasuki**: toko & gudang DC punya celah pintu, interior (meja kasir, rak, kotak paket) - jalan kaki masuk lewat pintu, dinding tetap menghalangi.
- Siklus waktu siang → sore → senja → malam (pencahayaan, langit, lampu malam menyala).
- Minimap 2D + rute berbasis graf jalan (Dijkstra) + penanda tujuan 3D.
- Dashboard: speedometer, RPM, gigi, bahan bakar, kerusakan, rem tangan.
- **Transmisi manual**: kopling memutus tenaga mesin, kurva torsi mengikuti RPM, rasio gigi wajar, pindah gigi tanpa kopling ditolak di kecepatan tinggi.
- **Kendaraan detail**: plat nomor Indonesia, wheel arch, knalpot, grill, rib bodi, pegangan pintu, papan nama atap.
- **Dialog misi & NPC** (typewriter + pilihan): briefing manajer → penyortir → kurir → pelanggan → kasir → evaluasi.
- Tabrakan dengan konsekuensi (kerusakan → penalti gaji).
- Sistem ekonomi lengkap: pembayaran pelanggan → uang titipan → setoran → rekonsiliasi → gaji.
- Audio prosedural (WebAudio): suara mesin mengikuti RPM, tabrakan, notifikasi.
- Save/progres karier di LocalStorage dengan validasi & reset.

## Struktur kode

```
src/
  main.ts                 entry point
  app/GameApp.ts          orkestrasi alur permainan
  engine/GameEngine.ts    scene, cahaya, siklus waktu
  camera/                 kamera bird's-eye
  world/MapBuilder.ts     pembangun peta prosedural (jalan, gedung, DC, penanda)
  vehicle/Vehicle.ts      model kendaraan + transmisi manual + fisika
  character/Character.ts  model karakter + kontrol jalan kaki
  navigation/Minimap.ts   minimap + route planner (Dijkstra)
  delivery/               paket, pelanggan, evaluasi pekerjaan
  economy/                buku transaksi uang
  career/                 level, rank, unlock, save
  ui/                     menu, HUD, briefing, hasil (DOM + Canvas 2D)
  audio/                  audio prosedural WebAudio
  data/                   konfigurasi & generator dunia
```
