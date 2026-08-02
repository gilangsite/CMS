# Deploy CMS ke Vercel Hobby

Konfigurasi cron bawaan Vercel sengaja tidak dipakai karena paket Hobby hanya menerima jadwal cron harian. Aplikasi tetap dapat di-deploy di Vercel Hobby dan endpoint scheduler tetap tersedia untuk dipanggil layanan cron eksternal.

## 1. Environment Variables di Vercel

Salin nama variabel dari `.env.example` ke **Vercel > Project Settings > Environment Variables**, lalu masukkan nilai asli dari `.env.local` secara manual. Jangan mengunggah atau commit `.env.local` ke GitHub.

Minimal agar dashboard dapat dibuka:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
DATABASE_URL
TOKEN_ENCRYPTION_KEY
BLOB_READ_WRITE_TOKEN
CRON_SECRET
```

Pastikan semua variabel diaktifkan untuk environment **Production**, kemudian lakukan redeploy. Setelah deploy, buka `https://domain-aplikasi.vercel.app/api/health`. Respons `status: ready` berarti konfigurasi utama dan koneksi database sudah bekerja.

Untuk alamat production, gunakan domain Vercel aplikasi:

```text
NEXT_PUBLIC_APP_URL=https://domain-aplikasi.vercel.app
META_REDIRECT_URI=https://domain-aplikasi.vercel.app/api/social/instagram/callback
TIKTOK_REDIRECT_URI=https://domain-aplikasi.vercel.app/api/social/tiktok/callback
NEXT_PUBLIC_MOCK_PUBLISHING=false
```

Tambahkan juga sebuah nilai acak yang panjang untuk `CRON_SECRET`. Vercel memakai nilai ini untuk menjalankan penghapusan media harian dengan aman.

## 2. Scheduler gratis untuk paket Hobby

Setelah deployment berhasil, buat dua job di layanan cron eksternal seperti cron-job.org:

| Kegunaan | URL | Jadwal |
| --- | --- | --- |
| Menerbitkan konten terjadwal | `https://domain-aplikasi.vercel.app/api/cron/publishing` | Setiap 1 menit |
| Mengambil analytics | `https://domain-aplikasi.vercel.app/api/cron/analytics` | Setiap 6 jam |

Kedua job memakai method `GET` dan header berikut:

```text
Authorization: Bearer NILAI_CRON_SECRET_YANG_SAMA_DENGAN_VERCEL
```

Tanpa job eksternal ini, tombol **Publish Now** tetap dapat bekerja, tetapi konten dengan jadwal tidak akan diterbitkan otomatis.

Cleanup Media Trash tidak memerlukan job eksternal. `vercel.json` menjalankannya satu kali sehari, sesuai batas paket Hobby. File yang melewati masa Trash 7 atau 30 hari akan dihapus dari database dan Vercel Blob.
