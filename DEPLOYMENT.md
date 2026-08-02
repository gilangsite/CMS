# Deploy CMS ke Vercel Hobby

Konfigurasi cron bawaan Vercel sengaja tidak dipakai karena paket Hobby hanya menerima jadwal cron harian. Aplikasi tetap dapat di-deploy di Vercel Hobby dan endpoint scheduler tetap tersedia untuk dipanggil layanan cron eksternal.

## 1. Environment Variables di Vercel

Salin nama variabel dari `.env.example` ke **Vercel > Project Settings > Environment Variables**, lalu masukkan nilai asli dari `.env.local` secara manual. Jangan mengunggah atau commit `.env.local` ke GitHub.

Untuk alamat production, gunakan domain Vercel aplikasi:

```text
NEXT_PUBLIC_APP_URL=https://domain-aplikasi.vercel.app
META_REDIRECT_URI=https://domain-aplikasi.vercel.app/api/social/instagram/callback
TIKTOK_REDIRECT_URI=https://domain-aplikasi.vercel.app/api/social/tiktok/callback
NEXT_PUBLIC_MOCK_PUBLISHING=false
```

Tambahkan juga sebuah nilai acak yang panjang untuk `CRON_SECRET`.

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
