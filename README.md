# Game Vault Web

Web vault lokal untuk menyimpan document, script, dan file game. File upload disimpan oleh backend Node.js ke folder kategori, lalu metadata masuk ke `data/items.json`.

## Struktur

- `documents/` untuk file dokumen.
- `scripts/` untuk file script.
- `games/` untuk file game.
- `data/items.json` untuk daftar file yang tampil di halaman utama.
- `server.js` untuk backend upload dan API daftar file.
- `admin.html` untuk upload file lewat backend lokal.

## Cara jalan lokal

1. Pastikan Node.js sudah terpasang.
2. Buka terminal di folder project.
3. Jalankan:

```bash
npm start
```

4. Buka `http://localhost:3000`.

## Cara pakai admin

1. Jalankan backend dengan `npm start`.
2. Buka `http://localhost:3000/admin.html`.
3. Pilih kategori, isi nama, deskripsi, detail tambahan, dan pilih file.
4. Klik `Upload ke Vault`.

Catatan: upload lokal tidak bisa berjalan kalau file HTML dibuka langsung dengan `file://`. Pakai `npm start` supaya API backend aktif.

## GitHub Pages

Web utama bisa dibuka dari GitHub Pages karena halaman utama membaca `data/items.json` sebagai file statis.

Admin juga bisa dipakai dari GitHub Pages, tetapi upload dilakukan lewat GitHub API. Saat membuka `admin.html` dari GitHub Pages, isi token GitHub dengan akses `Contents: Read and write` untuk repo ini, lalu upload file seperti biasa.
