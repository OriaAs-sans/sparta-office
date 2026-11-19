# Sparta Office

Kantor virtual untuk agent AI divisi Building & Maintenance. Denah kantor menampilkan meja tiap agent beserta statusnya. Klik meja untuk memberi tugas, lalu semua hasil agent masuk ke Inbox Review dan baru berlaku setelah disetujui orang.

| Package | Path | Isi |
| --- | --- | --- |
| `@sparta-office/web` | `apps/web` | React 19 + Vite + Tailwind v4 + shadcn, tema portal Sparta |
| `@sparta-office/api` | `apps/api` | Express 5, SQLite bawaan Node, Claude API |

## Menjalankan

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # lalu isi ANTHROPIC_API_KEY
pnpm dev:api   # http://localhost:10100
pnpm dev:web   # http://localhost:5174
```

## Chat Otak Sparta (tab kedua di web)

Satu otak yang membaca basis pengetahuan, lalu membagi pekerjaan ke agent spesialis. Tab Kantor Agent tetap ada seperti sebelumnya.

- **Mesin**: Claude Code di laptop ini (langganan Pro), dijalankan server tanpa layar (`claude -p`). Server mencari perintah `claude` di PATH, atau memakai `CLAUDE_CODE_PATH` di `apps/api/.env`. Path Claude Code bawaan aplikasi desktop berubah tiap update, jadi lebih awet memasang Claude Code CLI sendiri.
- **Basis pengetahuan**: `knowledge/`. Otak mencari di sini dulu dan menyebut file sumbernya. Dokumen bisa ditambah dari panel di tab Chat.
- **Sebut file**: ketik `@` di kotak chat untuk mencari file di `C:\ALfa`.
- **Lampirkan file dari komputer**: tombol Lampirkan atau seret file ke kotak chat (PDF, TXT, MD, CSV, DXF, PNG, JPG, WEBP, JSON, maksimal 6 MB, 10 file sekaligus). File disimpan di `workspace/lampiran/<id percakapan>/` dan ikut terhapus saat percakapan dihapus. Excel perlu diekspor ke CSV atau PDF dulu.
- **Izin otak dibatasi** (mode `dontAsk`, diuji): baca file di `C:\ALfa` (kecuali `.env`), cari, panggil subagent, tulis hanya ke `workspace/outbox`, dan jalankan hanya CLI denah. Selain itu ditolak.
- **Prompt otak**: `apps/api/src/chat/otak.md`.
- Percakapan disimpan di database, dan sesi Claude Code dilanjutkan (`--resume`) supaya otak ingat konteks.
- Sesi chat juga tercatat di riwayat Claude Code untuk folder `C:\ALfa`.
- Untuk dipakai tim, ganti mesin ke Claude API (akun perusahaan). Titik sambungnya ada di `apps/api/src/chat/engine.ts` (`runBrain`).

## Kantor Agent dan Percakapan Kantor

- Panggung 3D: 6 ruang agent dan Ruang Kendali (robot Otak). Mata robot menunjukkan status: redup (siaga), amber (bekerja), merah (perlu review), mati (belum aktif).
- Bilah perintah di bawah panggung: kirim ke Otak (dibagi otomatis) atau langsung ke Studio Denah, Triase, atau Pre-Approval (`claude --agent`, tanpa Otak). Memakai mesin dan riwayat yang sama dengan Chat Otak.
- Percakapan Kantor (`GET /api/kantor/events`, aliran langsung `GET /api/kantor/stream`): perintah, tugas dari Otak ke agent, laporan agent, dan jawaban akhir. Isinya diambil dari kejadian asli di Claude Code, tidak ada obrolan karangan. Saat ada kejadian, bola cahaya berjalan dari pengirim ke penerima dan gelembung bicara muncul di atas robot.
- Di Claude Code, agent spesialis tidak saling memanggil langsung; pembagian tugas selalu lewat Otak.

## Agent di Claude Code (cara utama)

Agent AI dijalankan lewat Claude Code dengan langganan Pro, bukan lewat API. Subagent ada di `C:\ALfa\.claudegents\`:

| Subagent | Contoh prompt (Claude Code dibuka di `C:\ALfa`) |
| --- | --- |
| `triase-maintenance` | `Pakai triase-maintenance: cek laporan toko TZ01, AC kasir mati. Foto: @foto.jpg` |
| `pre-approval` | `Pakai pre-approval: cek pengajuan dari @RAB.pdf dan @penawaran.pdf` |
| `studio-denah` | `Pakai studio-denah: buat model 3D dari @"sparta-energy/Kalkulator files/Uji Tebedak Ngabang.dxf"` |

Agent membaca file yang di-mention, lalu menulis hasil ke `workspace/outbox/`. API memeriksa folder itu tiap 2 detik dan memasukkan hasilnya ke Inbox Review. File yang formatnya salah muncul sebagai tugas Gagal yang menyebut field mana yang salah. File yang sudah diambil dipindah ke `workspace/outbox/sudah-diambil/`. API harus sedang jalan supaya hasil masuk ke web.

### Studio Denah

- Converter (`apps/api/src/denah/convert.ts`) membaca LINE, POLYLINE, ARC, CIRCLE, TEXT, dan isi block (INSERT). Satuan diambil dari `$INSUNITS`, atau ditebak kalau hasilnya tidak masuk akal untuk ukuran toko.
- Dinding diangkat seragam 3 m dengan tebal 15 cm. Ini model visual, bukan BIM.
- Alat untuk agent: `pnpm --dir apps/api denah analisa "<file.dxf>"` dan `pnpm --dir apps/api denah kirim "<file.dxf>" --judul "..." --dinding "LAYER"`.
- Di web, DXF juga bisa di-upload langsung. Layer dinding ditebak dari nama layer (DINDING, WALL, TEMBOK), dan kalau tidak ada, semua garis diangkat.
- File DWG harus disimpan ulang sebagai DXF dulu.

## Mode demo

Form di web memanggil Claude API. Tanpa API key, form di web otomatis berjalan dalam **mode demo**. Alur kerjanya sama persis (kirim tugas, agent bekerja, review, setujui atau tolak), tapi agent memakai aturan sederhana, bukan AI:

- Triase: kategori dan urgensi dari pencocokan kata kunci. Foto tidak dianalisis.
- Pre-Approval: dokumen wajib, vendor kosong, dan penjumlahan rincian (volume x harga satuan) dihitung sungguhan. Kewajaran item tidak diperiksa.

Semua hasil demo diberi awalan `[DEMO]`, badge Demo di daftar tugas, dan peringatan di detail tugas. Isi `ANTHROPIC_API_KEY` untuk beralih ke AI, atau isi `AGENT_MODE=demo` untuk memaksa demo walau key ada.

## Agent

| Agent | Status | Cara kerja |
| --- | --- | --- |
| Triase Maintenance | Aktif | Laporan + foto opsional, keluar kategori, urgensi, tindakan awal, jenis vendor |
| Pre-Approval Checker | Aktif | Cek kelengkapan dokumen dan hitungan rincian. Tidak menilai harga dan tidak menyetujui apa pun |
| Denah ke Bangunan, RAB & Vendor, Dokumen SPK & BAST, Frontend, Backend, QA | Belum aktif | Panel meja menampilkan apa yang perlu disiapkan |

Model: `claude-opus-5-5` dengan structured output (Zod) dan fallback server-side kalau permintaan ditolak filter keamanan. Definisi agent ada di `apps/api/src/agents/`.

## Alur tugas

`antri` → `berjalan` → `menunggu_review` → `disetujui` / `ditolak` (alasan wajib), atau `gagal` dengan pesan penyebab.

## Catatan untuk digabung ke Sparta

- Database: SQLite di `apps/api/data/` hanya untuk prototipe. Pindahkan tabel `tasks` ke Prisma + Postgres seperti login-sparta.
- Login: belum ada. Siapa pun yang membuka halaman bisa menyetujui. Sebelum dipakai tim, sambungkan ke SSO login-sparta dan batasi tombol Setujui/Tolak ke role approver.
- Tema: satu tema gelap "ruang kontrol" untuk seluruh aplikasi (class `dark ruang-kontrol` di `apps/web/index.html`, token di `apps/web/src/index.css`). Latar biru malam `#0F1922`, aksen merah Sparta. Teks merah kecil memakai `--review` (`#FF6B73`) supaya lolos AA di latar gelap.
