# CLAUDE.md

Panduan untuk developer dan agent AI yang mengerjakan Sparta Office. Detail fitur ada di README.md.

## Commands

- Install: `pnpm install`
- Dev: `pnpm dev:api` (http://localhost:10100) dan `pnpm dev:web` (http://localhost:5174)
- Typecheck: `pnpm typecheck`
- Lint web: `pnpm --filter @sparta-office/web lint`
- Format: `pnpm format`
- Cari komponen shadcn: `npx shadcn@latest search '@shadcn' -q "<nama>"` (di PowerShell, `'@shadcn'` wajib pakai kutip)

## Struktur web (`apps/web/src`)

```
app/                 kerangka aplikasi: App, sidebar, routing hash
components/
  ui/                hanya komponen shadcn (hasil `npx shadcn add`)
  common/            komponen global yang dipakai lebih dari satu fitur
features/<fitur>/    semua kode milik satu fitur: halaman, komponen, API client, hook
hooks/               hook umum lintas fitur (use-polling, use-hash-route, use-file-picker)
lib/                 utilitas umum: api dasar, format, files, storage, utils
```

Aturan letak file:
- Dipakai satu fitur saja: taruh di `features/<fitur>/`.
- Dipakai dua fitur atau lebih: pindahkan ke `components/common/` (komponen) atau `lib/` / `hooks/` (logika).
- `features/*` boleh mengimpor dari `components/`, `hooks/`, `lib/`, dan dari fitur lain lewat file publiknya. `components/` dan `lib/` tidak boleh mengimpor dari `features/`.
- Semua import memakai alias `@/`, tidak ada path relatif `../`.

## Komponen

1. **shadcn dulu.** Sebelum membuat markup sendiri, cari padanannya di registry shadcn. Yang sudah dipakai: Button, Badge, Item, InputGroup, Collapsible, Tabs, Sheet, Dialog, DropdownMenu, Field, Empty, Alert, Spinner, Skeleton, NativeSelect, Checkbox.
2. **Saat `npx shadcn add` bertanya "overwrite?", jawab tidak** untuk `button.tsx`, `input.tsx`, `input-group.tsx`, dan `native-select.tsx`. File itu sudah diubah untuk target sentuh 44px (ukuran `touch` dan `icon-touch`).
3. **Komponen global** di `components/common/`:
   - `ActionItem`: baris daftar yang bisa diklik (di atas Item). Pakai ini, jangan `<button>` manual untuk baris daftar.
   - `ErrorAlert`: pesan error dengan tombol Coba Lagi opsional.
   - `CollapsibleSection`: bagian buka-tutup (`variant="card"` atau `"inline"`).
   - `FileChip`, `IconTile`, `StatusDot`, `PageHeading`, `Logo`.
4. **Panggilan API** selalu lewat `apiRequest` di `lib/api.ts` (pesan error dan respons 204 sudah ditangani). Setiap fitur punya client sendiri (`features/chat/chat-api.ts`, `features/knowledge/knowledge-api.ts`); `fetch` langsung hanya untuk aliran Server-Sent Events.
5. **Logika bersama**: `useFilePicker` (pemilih file), `lib/files.ts` (base64, ukuran file, batas upload), `lib/format.ts` (angka, rupiah, waktu), `lib/storage.ts` (sessionStorage aman), `features/agents/agent-meta.ts` (ikon dan data tampilan agent), `features/agents/agent-status.ts` (warna status, satu sumber).
6. Komponen kustom baru harus reusable (menerima props, tidak menulis nilai mati) dan diberi komentar singkat kenapa ada.

## Desain (antislop)

- Satu tema gelap "ruang kontrol" untuk seluruh aplikasi (`dark ruang-kontrol` di `index.html`, token di `index.css`). Pakai token (`bg-background`, `text-muted-foreground`, `text-review`, `text-working`), bukan warna mentah.
- Teks wajib kontras AA (4,5:1). Teks merah kecil memakai `text-review`, bukan `text-primary`.
- Target sentuh minimal 44px: pakai `size="touch"` / `"icon-touch"`.
- Tidak ada em dash di teks UI maupun komentar. Label tombol Title Case (kecuali kata sambung), deskripsi sentence case.
- Animasi hanya untuk menunjukkan kejadian atau status, dan harus mati saat `prefers-reduced-motion`.
- Tidak ada angka, testimoni, atau isi palsu. Data yang belum ada ditulis jujur sebagai belum ada.
