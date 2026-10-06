# SKSA · Kehadiran Bulanan IDME v0.2.0

Webapp guru kelas SK Sungai Abong dengan extension Chrome untuk mengambil laporan kehadiran daripada IDME/MOEIS. Akses webapp menggunakan IC sahaja, mengikut keperluan projek dalaman ini.

**Kod webapp dan extension siap untuk pemasangan. Belum diterbitkan ke Vercel dan belum diuji pada akaun IDME sebenar.** Tiada password sebenar, data murid sebenar atau sambungan database dimasukkan ke dalam pakej ini. Fail `CONTOH-SKSA-Laporan-Januari.pdf` menggunakan data sintetik.

## 1. Cuba extension dahulu — webapp belum perlu diterbitkan

1. Ekstrak ZIP ini. Jangan pilih ZIP terus dalam Chrome.
2. Buka `chrome://extensions`, aktifkan **Developer mode**.
3. Klik **Load unpacked**, pilih folder `extension` dalam folder projek ini.
4. Pin dan buka **SKSA — Kehadiran IDME**.
5. Masukkan IC dan password IDME sendiri. Tandakan **Simpan password pada browser ini** untuk auto login. Pautan webapp boleh dibiarkan kosong bagi ujian pertama.
6. Klik **Simpan tetapan**, pilih tahun yang sedang dipaparkan oleh IDME, kemudian **Ambil semua bulan**.
7. Extension membuka tab IDME sendiri. Klik **Buka tab IDME** jika mahu melihat kemajuan.
8. Bila selesai, klik **Muat turun data JSON**. Semak status setiap bulan. JSON ini boleh diimport ke webapp kemudian.

Aliran login mengikut tangkapan: masukkan `#ic`, hantar borang, tandakan `#check_log`, tunggu `#password` muncul, kemudian klik `#log_open_form`. Tanda pengesahan dibuat automatik seperti yang diminta. Jika sesi IDME masih aktif, ia digunakan terus. Password digunakan hanya pada borang IDME di origin HTTPS yang ditetapkan. Password tidak dihantar ke webapp atau database.

Jika halaman selepas login tidak menyediakan pautan modul yang dapat dikenal pasti, buka **Modul Murid → Kehadiran Guru Kelas** pada tab extension itu. Extension menyambung apabila halaman kehadiran muncul. Jika IDME memaparkan cabaran tambahan, selesaikan pada tab tersebut.

## 2. Jalankan webapp pada komputer untuk percubaan

Perlu Node.js 22.16 atau lebih baharu. Jalankan dalam folder projek:

```sh
npm ci
npm run build
npm run dev
```

Buka `http://localhost:3000`. Klik **Lihat contoh laporan** untuk melihat paparan tanpa data sebenar.

Untuk data sendiri, masuk dengan IC. Pada **Sambungan & simpanan**, pilih **Browser ini** secara jelas jika database belum disediakan. Laporan disimpan dalam IndexedDB browser tersebut; pilihan ini tidak menyimpan ke server atau berkongsi antara peranti. JSON daripada extension boleh diimport melalui **Import JSON**.

Masukkan `http://localhost:3000` dalam tetapan extension, **Simpan tetapan**, benarkan sambungan, kemudian refresh webapp. IC webapp mesti sama dengan IC dalam extension. Auto segerak bermula sekali setiap pembukaan/sesi login webapp; butang **Segerak IDME** tersedia untuk kemas kini seterusnya.

## 3. Sediakan database sekolah di Neon

1. Sediakan database Postgres di Neon. Ambil connection string bagi database projek ini.
2. Jalankan kandungan `database.sql` menggunakan SQL Editor Neon.
3. Skrip hanya mencipta jadual baharu `sksa_attendance_months`; tiada jadual projek sedia ada diubah atau dipadam.
4. Untuk percubaan tempatan, salin `.env.example` menjadi `.env.local`, masukkan connection string sendiri dan mulakan semula `npm run dev`.

Nama pemboleh ubah: `DATABASE_URL`. Connection string kekal pada server. Jangan masukkan ke kod `public`, extension, atau commit fail `.env.local`.

## 4. Terbitkan ke Vercel

1. Masukkan folder projek ini ke repository GitHub sendiri, tanpa `node_modules` atau `.env.local`.
2. Import repository itu dalam Vercel; gunakan folder projek ini sebagai **Root Directory**.
3. Tetapan: **Framework Preset: Other**, **Build Command: npm run build**, **Output Directory: public**. Konfigurasi disediakan dalam `vercel.json`.
4. Tetapkan `DATABASE_URL` dalam Environment Variables Vercel, kemudian deploy.
5. Buka `/api/health` pada URL deployment. Database yang tersedia menghasilkan `"database":"ready"`.
6. Masukkan URL HTTPS deployment dalam tetapan extension setiap guru. Klik **Simpan tetapan**, benarkan akses dan refresh webapp.
7. Dalam webapp, pilih **Database sekolah**. Login IC, segerak dan buka semula laporan untuk memastikan data benar-benar tersimpan.

Pakej ini menyediakan fail deployment. Penerbitan dan sambungan database sebenar memerlukan akaun serta konfigurasi Vercel/Neon pemilik projek.

## Aliran penggunaan guru

Masuk webapp menggunakan IC → extension menggunakan sesi IDME atau auto login → semua bulan yang mempunyai pecahan sesi melebihi sifar diambil → laporan disimpan → pilih bulan → muat turun PDF atau cetak.

- Januari hingga September boleh diambil dalam satu sesi jika kesemuanya ada data. Oktober turut diambil apabila rumusan IDME mempunyai datanya.
- Buka webapp kemudian untuk kemas kini; guru tidak perlu login IDME setiap bulan jika sesi masih aktif atau password telah disimpan dalam extension.
- Password perlu dikemas kini dalam extension jika password IDME berubah. Login automatik tidak tersedia jika password belum disimpan dan sesi IDME sudah tamat.
- Extension berjalan pada browser komputer tempat ia dipasang. Webapp tidak dapat mengambil data IDME sendiri dari server.
- Tahun mestilah tahun yang sedang dipaparkan oleh rumusan IDME. Pakej ini tidak meneka mekanisme penukaran tahun yang belum dirakam.

## Ketepatan laporan

- Data diambil daripada `#rumusan`, kemudian laporan bulanan `table.compTable` dan jadual rumusan `table.calfonts`.
- Jumlah murid, tanda `/`, tanda `0`, tanda kosong, pecahan `hadir/sesi`, ketidakhadiran sebelumnya, ketidakhadiran terkumpul, rumusan harian, warna cuti dan label asal dikekalkan.
- Januari yang hanya memaparkan 11–31 haribulan dikekalkan. Hari 1–10 tidak ditambah.
- Jumlah sesi menggunakan denominator asal IDME. Murid baharu atau berpindah boleh mempunyai bilangan sesi berbeza.
- Tanda harian dibandingkan dengan jumlah setiap murid, rumusan bulanan dan rumusan harian. Bulan yang tidak sepadan ditolak dengan sebab yang boleh dilihat.
- Satu bulan yang gagal tidak menghentikan bulan lain. Rekod berjaya kekal dalam cache extension untuk eksport/import semula.
- Kunci simpanan ialah **IC + tahun + kelas + bulan**. Data lebih baharu menggantikan rekod terdahulu; data lama tidak menimpa data baharu.
- Status bulan semasa menunjukkan data ketika disegerakkan. PDF boleh merentas beberapa halaman dan mengulang tajuk jadual. Nama penuh dibalut mengikut ruang.
- PDF menggunakan font DejaVu tempatan. Jika sesuatu aksara tidak disokong, PDF dihentikan dengan mesej; **Cetak** menggunakan font browser untuk mengekalkan nama.

## Simpanan pada extension

Password yang dipilih untuk disimpan dienkripsi AES-GCM menggunakan kunci CryptoKey yang tidak boleh dieksport, dalam IndexedDB profil extension. Ini simpanan setempat pada komputer guru. **Buang password tersimpan** memadam credential yang disimpan. IC, tetapan, rekod dan status tugas disimpan setempat; password tidak dimasukkan ke JSON, PDF, mesej webapp, API atau log.

## Pengesahan dan batas ujian

```sh
npm run build
npm run check
npm test
```

Ujian menggunakan DOM dan data sintetik yang mengikuti struktur tangkapan, Chrome API simulasi, IndexedDB simulasi, PDF sebenar dan enjin Postgres setempat PGlite. Ia meliputi login dua langkah, pengesahan checkbox, pembacaan bulan, tarikh 28/29/30/31 hari, pertambahan murid, denominator berbeza, cache apabila sync gagal, import berulang, pengasingan IC/tahun, SQL atomik, paparan webapp, escaping nama dan eksport PDF.

Ujian ini tidak mengesahkan login pada akaun IDME sebenar, handler klik bulanan sebenar, peralihan SSO sebenar atau sambungan Neon/Vercel sebenar. Ujian pertama extension pada komputer guru akan menentukan jika handler halaman IDME perlu dilaraskan.

Jika bulan gagal, muat turun JSON **data dan status** daripada extension. Hantar status ralat untuk semakan; password tidak diperlukan untuk menyemak ralat. Fail pemeriksa struktur versi terdahulu tidak boleh diimport sebagai laporan murid kerana nama/data peribadinya telah dibuang.

## Fail utama

| Fail/folder | Kegunaan |
| --- | --- |
| `extension/` | Folder **Load unpacked** Chrome |
| `public/` | Webapp, paparan contoh dan eksport PDF |
| `api/`, `lib/` | API simpanan Vercel dan sambungan Neon |
| `database.sql` | Jadual laporan bulanan baharu |
| `.env.example`, `vercel.json` | Konfigurasi deployment |
| `tests/` | Ujian dan data contoh sintetik |

Aset PDF dan font dimasukkan dalam pakej; eksport PDF tidak menggunakan CDN. Lesen pihak ketiga berada dalam `public/assets`.
