# 🏨 CARA BOOKING HOTEL VIA WHATSAPP BOT

## Cara Memulai Pencarian Hotel

Bot akan otomatis mendeteksi request hotel jika pesan Anda mengandung kata kunci berikut:

### Kata Kunci Hotel:

- hotel
- menginap / nginep / inap
- booking / pesan hotel
- cari hotel
- penginapan
- akomodasi
- resort / villa
- staycation / stay
- check in / checkin
- bermalam
- guesthouse / homestay
- apartemen / apartment

### Contoh Pesan untuk Memulai:

**✅ BENAR:**

```
Saya ingin menginap di Bali
Cari hotel di Jakarta
Mau booking hotel Bandung
Penginapan di Surabaya
Saya mau nginep di Yogyakarta
Hotel murah di Malang
```

**❌ SALAH (tidak akan terdeteksi):**

```
Saya mau ke Bali (tidak ada kata kunci hotel)
Rekomendasi tempat di Jakarta (terlalu umum)
```

## Flow Percakapan

Setelah bot mendeteksi request hotel, bot akan memandu Anda melalui langkah-langkah berikut:

### 1️⃣ Konfirmasi Lokasi

```
Bot: Baik, saya menemukan wilayah: Jakarta 📍
     Apakah lokasi ini sudah benar? (Ya/Tidak)
You: Ya
```

### 2️⃣ Tanggal Check-In

```
Bot: Kapan Anda ingin check-in? 📅
     Format: DD-MM-YYYY atau ketik "besok"
You: 16-11-2025
atau: besok
atau: 16 november
```

### 3️⃣ Tanggal Check-Out

```
Bot: Kapan Anda ingin check-out? 📅
You: 17-11-2025
```

### 4️⃣ Jumlah Tamu

```
Bot: Berapa jumlah tamu? 👥
     Format: Dewasa-Anak-Bayi
You: 2-0-0
atau: 2 (hanya dewasa)
```

### 5️⃣ Jumlah Kamar

```
Bot: Berapa jumlah kamar yang dibutuhkan? 🛏️
You: 1
```

### 6️⃣ Hasil Pencarian

Bot akan menampilkan daftar hotel dengan:

- ⭐ Rating bintang
- 💰 Harga (dengan promo jika ada)
- 📍 Alamat
- 🗺️ Link Google Maps
- 📞 Kontak CS untuk booking

## Tips

✅ **DO:**

- Gunakan kata kunci hotel yang jelas
- Ikuti format tanggal yang diminta
- Jawab pertanyaan bot dengan singkat dan jelas
- Hubungi CS untuk booking final

❌ **DON'T:**

- Mengirim pesan panjang atau bertele-tele
- Mengganti topik di tengah proses
- Menunggu lebih dari 5 menit (session timeout)

## Contoh Lengkap

```
You: Saya ingin menginap di Bali

Bot: Baik, saya menemukan wilayah: Bali 📍
     Apakah lokasi ini sudah benar? (Ya/Tidak)

You: Ya

Bot: Kapan Anda ingin check-in? 📅
     Format: DD-MM-YYYY atau ketik "besok"

You: besok

Bot: Check-in: 16 Nov 2025 ✅
     Kapan Anda ingin check-out? 📅

You: 18-11-2025

Bot: Check-out: 18 Nov 2025 ✅
     Berapa jumlah tamu? 👥

You: 2

Bot: Tamu: 2 dewasa ✅
     Berapa jumlah kamar yang dibutuhkan? 🛏️

You: 1

Bot: [Menampilkan daftar 5 hotel terbaik dengan harga dan lokasi]
```

## Troubleshooting

**Q: Bot tidak mendeteksi request hotel saya?**
A: Pastikan pesan Anda mengandung kata kunci hotel (menginap, hotel, booking, dll)

**Q: Bot tidak merespons di tengah proses?**
A: Session timeout 5 menit. Mulai ulang dengan mengirim request hotel baru.

**Q: Bagaimana cara booking?**
A: Hubungi CS di WhatsApp 0822 5500 3535 atau telepon (021) 27811300

**Q: Bisa ubah kriteria pencarian?**
A: Ya, mulai ulang dengan kirim request hotel baru dengan kriteria yang berbeda.

## Kontak Customer Service

Untuk booking dan informasi lebih lanjut:

- 📞 WhatsApp: **0822 5500 3535**
- ☎️ Telepon: **(021) 27811300**
- 📧 Email: **cs@masterdiskon.com**

---

_Masterdiskon - Travel, Live, Discover_ ✈️🏨
