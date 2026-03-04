<div align="center" hidden>
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

<div align="center">
<img width="1354" height="607" alt="image" src="https://github.com/user-attachments/assets/3f43d5fd-40e7-4a4d-b9c9-6f7da7f23ea2" />
</div>

<div align="center">
<img width="1349" height="602" alt="image" src="https://github.com/user-attachments/assets/02c5ef98-b6c2-42e7-9364-5f3671237585" />
</div>

<div align="center">
<img width="1354" height="603" alt="image" src="https://github.com/user-attachments/assets/5dfc0f4a-7de5-4c93-af5e-dd01d3baab9f" />
</div>

<div align="center">
<img width="1352" height="608" alt="image" src="https://github.com/user-attachments/assets/6c242501-969d-40ce-9907-01ec59fb48c7" />
</div>

Aplikasi PS Rental Manager telah berhasil dibangun. Aplikasi ini dirancang untuk membantu pengelolaan bisnis rental PlayStation dengan fitur-fitur utama sebagai berikut:
Fitur Utama:
1.	Multi-Timer Dashboard: Kelola banyak konsol (PS3, PS4, PS5) secara bersamaan dalam satu layar. Setiap konsol memiliki indikator status (Available atau Playing).
2.	Sistem Billing Otomatis:
o	Mendukung mode Open-Ended (bayar saat selesai) dan mode Durasi Terbatas (timer hitung mundur).
o	Perhitungan biaya dilakukan secara real-time berdasarkan tarif per jam yang dikonfigurasi.
o	Indikator visual saat waktu sewa telah habis.
3.	Laporan Penggunaan (History): Mencatat setiap transaksi yang selesai, termasuk nama pelanggan, durasi total, dan total pendapatan.
4.	Pengaturan Fleksibel:
o	Ubah tarif per jam untuk masing-masing jenis konsol (PS3, PS4, PS5).
o	Tambah atau hapus konsol sesuai dengan kebutuhan inventaris Anda.
5.	Penyimpanan Data: Semua data konsol, riwayat transaksi, dan pengaturan tarif disimpan secara otomatis di browser Anda (Local Storage).
Cara Penggunaan:
•	Mulai Rental: Masukkan nama pelanggan dan durasi (opsional), lalu klik "Mulai Rental".
•	Selesai Rental: Klik "Stop & Checkout" untuk menghentikan timer. Data akan otomatis masuk ke tab Laporan.
•	Konfigurasi: Gunakan tab Pengaturan untuk menyesuaikan harga sewa per jam.
Aplikasi ini menggunakan desain modern yang responsif, sehingga nyaman digunakan baik di komputer maupun perangkat mobile.

Fitur Export PDF telah ditambahkan ke bagian Laporan.
Perubahan yang dilakukan:
1.	Integrasi Library PDF: Menambahkan jspdf dan jspdf-autotable untuk pembuatan dokumen PDF secara client-side.
2.	Tombol Export: Menambahkan tombol "Export PDF" di tab Laporan (Riwayat Transaksi).
3.	Format Laporan Profesional:
o	Judul laporan: "Laporan Rental PlayStation".
o	Informasi waktu cetak.
o	Ringkasan statistik (Total Pendapatan dan Total Sesi).
o	Tabel transaksi yang rapi dengan kolom Customer, Console, Waktu, Durasi, dan Biaya.
o	Nama file otomatis menyertakan tanggal dan waktu ekspor (contoh: Laporan_PS_Rental_20260303_2307.pdf).
Anda sekarang dapat mengunduh laporan riwayat transaksi kapan saja untuk keperluan pembukuan atau arsip fisik.

Fitur Kontrol Relay Otomatis dan Auto-Stop telah berhasil diimplementasikan.
Perubahan Utama:
1.	Integrasi Relay (HTTP API):
o	Saat rental dimulai, aplikasi akan memanggil: http://10.24.59.55/relay?r=<relay_id>&cmd=1 untuk menyalakan perangkat.
o	Saat rental berhenti (manual atau otomatis), aplikasi akan memanggil: http://10.24.59.55/relay?r=<relay_id>&cmd=0 untuk mematikan perangkat.
o	Menggunakan mode no-cors untuk memastikan perintah tetap terkirim meskipun perangkat relay tidak memiliki konfigurasi CORS.
2.	Sistem Auto-Stop:
o	Aplikasi sekarang memantau timer setiap 5 detik.
o	Jika rental memiliki durasi terbatas dan waktu telah habis, sistem akan melakukan checkout otomatis, mematikan relay, dan memasukkan data ke laporan tanpa intervensi manual.
3.	Konfigurasi Relay ID:
o	Di tab Pengaturan, Anda sekarang dapat menentukan Relay ID untuk setiap konsol secara spesifik. Secara default, Console 1 menggunakan Relay 1, dan seterusnya.
4.	Stabilitas Sistem:
o	Fungsi kontrol telah dioptimalkan menggunakan useCallback untuk mencegah stale closures dan memastikan sinkronisasi data yang akurat saat proses auto-stop berjalan.
Catatan Teknis: Pastikan perangkat relay Anda berada dalam jaringan lokal yang sama dengan perangkat yang menjalankan aplikasi ini agar alamat IP 10.24.59.55 dapat diakses.

Saya telah memperbaiki kesalahan "Failed to fetch" dengan menerapkan strategi Beacon Fallback.
Apa yang telah diperbaiki:
1.	Metode Trigger Ganda: Kesalahan "Failed to fetch" biasanya terjadi karena batasan keamanan browser (Mixed Content) saat mencoba mengakses IP lokal HTTP dari situs HTTPS. Sekarang, jika fetch gagal, aplikasi akan otomatis menggunakan metode Image Beacon (memuat URL sebagai gambar) yang lebih diizinkan oleh browser untuk memicu perangkat di jaringan lokal.
2.	Konfigurasi IP di UI: Saya telah menambahkan bagian Konfigurasi Relay di tab Pengaturan. Anda sekarang dapat mengubah alamat IP relay (contoh: http://10.24.59.55) langsung dari aplikasi tanpa harus mengubah kode.
3.	Logging yang Lebih Baik: Aplikasi sekarang mencetak URL yang dipicu ke konsol browser untuk memudahkan pelacakan jika perangkat tidak merespons.
Cara Memastikan Ini Bekerja:
1.	Buka tab Pengaturan.
2.	Pastikan Relay Base URL sudah benar (termasuk http://).
3.	Coba tekan tombol Mulai Rental. Jika relay tetap tidak menyala, pastikan perangkat Anda (HP/Laptop) terhubung ke jaringan WiFi yang sama dengan perangkat relay tersebut.
Aplikasi sekarang jauh lebih tangguh dalam menangani komunikasi dengan perangkat keras di jaringan lokal Anda.

Aplikasi telah dikonfigurasi agar dapat di-build menjadi single HTML file.
Perubahan yang dilakukan:
1.	Instalasi Plugin: Menambahkan vite-plugin-singlefile ke dalam sistem build.
2.	Konfigurasi Vite: Memperbarui vite.config.ts untuk menggunakan plugin tersebut. Sekarang, setiap kali proses build dijalankan (npm run build), semua kode JavaScript, CSS, dan aset lainnya akan dibundel langsung ke dalam satu file index.html di folder dist/.
3.	Portabilitas: Dengan konfigurasi ini, aplikasi menjadi sangat portabel. Anda cukup mengambil satu file HTML tersebut dan menjalankannya di browser mana pun tanpa memerlukan folder aset tambahan (assets/).
Semua fitur sebelumnya (Multi-timer, Laporan PDF, Kontrol Relay, dan Auto-stop) tetap berfungsi sepenuhnya dalam format satu file ini.

Fitur Login dan Manajemen User telah berhasil ditambahkan ke aplikasi PS Rental Manager.
Detail Implementasi:
1.	Halaman Login:
o	Sistem sekarang dilindungi oleh halaman login yang aman.
o	Pengguna harus memasukkan username dan password untuk mengakses dashboard.
o	Data sesi disimpan di sessionStorage (otomatis keluar saat tab ditutup).
2.	Sistem Role (Hak Akses):
o	Admin: Memiliki akses penuh ke seluruh sistem, termasuk menambah/menghapus konsol, mengubah tarif per jam, menghapus riwayat transaksi, dan mengelola pengguna lain.
o	Staff: Hanya dapat mengelola operasional harian (mulai/berhenti rental) dan melihat laporan. Staff tidak dapat mengubah pengaturan sistem atau menghapus data.
3.	Manajemen User (Khusus Admin):
o	Terdapat bagian baru di tab Pengaturan untuk mengelola daftar pengguna.
o	Admin dapat menambah pengguna baru, mengubah username/password, dan menentukan role (Admin atau Staff).
4.	Akun Default (Silakan diubah setelah masuk):
o	Admin: Username: admin | Password: admin123
o	Staff: Username: staff | Password: staff123
Keamanan:
•	Semua data pengguna disimpan secara lokal di browser Anda menggunakan localStorage.
•	Tombol Keluar (Logout) tersedia di sidebar (desktop) dan navigasi bawah (mobile).
Aplikasi kini lebih aman dan siap digunakan untuk operasional tim dengan pembagian tugas yang jelas.

Saya telah memperbaiki kesalahan "uncontrolled input to be controlled" yang Anda temukan.
Perbaikan yang dilakukan:
1.	Fallback Value pada Input: Saya menambahkan nilai default (|| '' atau || 0) pada semua elemen <input> yang terikat langsung ke data objek (seperti nama konsol, Relay ID, username, dan password).
2.	Penyebab Masalah: Kesalahan ini terjadi ketika React mendeteksi sebuah input yang awalnya memiliki nilai undefined (karena properti objek belum dimuat atau kosong) kemudian berubah menjadi string. Dengan memberikan fallback, input akan selalu memiliki nilai awal yang terdefinisi (string kosong atau angka 0), sehingga status "controlled" tetap konsisten.
3.	Area yang Diperbaiki:
o	Input Nama Konsol & Relay ID di tab Pengaturan.
o	Input Tarif per jam.
o	Input Manajemen User (Username & Password).
o	Input Relay Base URL.
Aplikasi sekarang seharusnya tidak lagi memunculkan peringatan tersebut di konsol browser, yang juga meningkatkan stabilitas UI saat melakukan pengeditan data.

Sistem timer telah diperbarui untuk menampilkan sisa waktu dan waktu berjalan dalam format hh:mm:ss (jam:menit:detik) untuk presisi yang lebih baik.
Perubahan yang dilakukan:
1.	Format Waktu Presisi: Mengubah tampilan "Elapsed" dan "Remaining" dari format jam/menit menjadi format lengkap 00:00:00.
2.	Perhitungan Detik: Memperbarui logika internal untuk menghitung selisih waktu dalam detik menggunakan differenceInSeconds agar timer berdetak secara real-time setiap detik.
3.	UI Tabular Nums: Memastikan angka tetap sejajar saat berdetak menggunakan font tabular agar tidak terjadi pergeseran layout yang mengganggu.
Sekarang Anda dapat memantau sisa waktu rental dengan jauh lebih akurat hingga ke satuan detik.


# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8a6c8c2b-3c4d-4bc7-a101-ab939df9af1e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
