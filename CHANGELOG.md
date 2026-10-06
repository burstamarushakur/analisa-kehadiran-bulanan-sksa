# Perubahan

## 0.2.0 — 6 Oktober 2026

- Webapp akses IC dengan laporan 12 bulan, pemilihan kelas/tahun, status segerak, import JSON, salinan data dan eksport PDF/cetakan.
- Extension sebenar menggantikan pemeriksa struktur: aliran login IC, checkbox dan password; pembacaan rumusan serta laporan semua bulan; status berasingan bagi setiap bulan.
- Cache laporan pada extension kekal selepas tugas baharu gagal. Penyegerakan menggunakan tab sendiri dan meneruskan bulan seterusnya jika satu bulan gagal.
- API Vercel/Neon dengan jadual baharu dan upsert berdasarkan IC/tahun/kelas/bulan. Pilihan simpanan browser yang dinyatakan secara jelas untuk percubaan.
- Tarikh sumber, denominator asal, tanda kosong dan pertambahan murid dikekalkan. Semakan jumlah harian/bulanan sebelum import.
- Ujian automatik menggunakan struktur tangkapan, data sintetik, DOM, API Chrome simulasi, IndexedDB, Postgres PGlite dan PDF.

Belum diterbitkan dan belum diuji pada IDME sebenar.
