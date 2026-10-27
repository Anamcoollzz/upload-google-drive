# Google Drive Folder Uploader (Node.js)

Aplikasi Node.js CLI untuk mengunggah seluruh folder beserta subfolder dan file di dalamnya ke Google Drive secara rekursif dengan struktur direktori yang identik.

---

##  Fitur Unggulan

- **Upload Folder Rekursif**: Menjaga seluruh hierarki subfolder dan file di Google Drive persis seperti di komputer lokal.
- **Efisiensi Memori (Streaming)**: Menggunakan Node.js `fs.createReadStream` sehingga aman untuk file berukuran besar.
- **Login Otomatis Sekali Klik**: Otomatis membuka tab browser saat pertama kali dijalankan untuk otorisasi Google, lalu menyimpan token di `token.json` (auto-refresh saat expired).
- **Deteksi MIME Type Otomatis**: Mengenali tipe file gambar, video, dokumen, zip, audio, dan binary lainnya.
- **Smart Ignore Filter**: Secara otomatis mengabaikan file/folder yang tidak perlu seperti `node_modules`, `.git`, `.env`, `.DS_Store`, dll.
- **Progress Tracking Real-time**: Menampilkan persentase, ukuran file yang terupload, dan link langsung ke folder Google Drive setelah selesai.
- **Mendukung 2 Metode Autentikasi**:
  - **OAuth 2.0 (Akun Pribadi)**: Menggunakan kuota akun Google Drive pribadi Anda.
  - **Service Account**: Cocok untuk server atau shared drive (cukup letakkan `service-account.json`).

---

## 🛠️ Langkah Persiapan (Setup Google Drive API)

Agar script dapat mengakses Google Drive Anda, ikuti langkah mudah berikut (hanya perlu dilakukan sekali):

### 1. Buat Project di Google Cloud Console
1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat project baru (misal: `Upload-Drive-Tool`).

### 2. Aktifkan Google Drive API
1. Buka menu **APIs & Services** > **Library**.
2. Cari **"Google Drive API"**.
3. Klik **Enable**.

### 3. Konfigurasi OAuth Consent Screen
1. Buka menu **APIs & Services** > **OAuth consent screen**.
2. Pilih User Type **External**, lalu klik **Create**.
3. Isi kolom wajib:
   - **App name**: misal `Drive Uploader`
   - **User support email**: pilih email Anda
   - **Developer contact information**: isi email Anda
4. Klik **Save and Continue** sampai selesai.
5. Pada tab **Test Users**, klik **Add Users** lalu masukkan alamat email Google Anda yang akan digunakan untuk upload.

### 4. Buat OAuth Client ID
1. Buka menu **APIs & Services** > **Credentials**.
2. Klik **+ CREATE CREDENTIALS** > **OAuth client ID**.
3. Pada *Application type*, pilih **Desktop app**.
4. Beri nama (misal: `Desktop Client`), lalu klik **Create**.
5. Klik tombol **Download JSON** pada kredensial yang baru dibuat.
6. Ganti nama file yang diunduh menjadi **`credentials.json`** dan letakkan di root folder proyek ini (`c:\PROJEK\ME\upload-google-drive\credentials.json`).

---

## 🚀 Cara Menjalankan

### Cara 1: Mode Interaktif (Paling Praktis)
Jalankan perintah berikut di terminal:
```bash
npm start
```
Aplikasi akan menanyakan:
1. Path folder lokal yang ingin diunggah.
2. ID folder tujuan di Google Drive (opsional, tekan **Enter** jika ingin ditaruh di halaman utama *My Drive*).

---

### Cara 2: Langsung via Command Line Argument
Anda bisa langsung memberikan path folder yang ingin diupload:

```bash
# Upload ke Root Google Drive (My Drive) dengan default 6 thread paralel
node index.js "C:\Users\NamaAnda\Documents\Laporan-2026"

# Upload ke folder Google Drive tertentu dengan paralel 8 thread sekaligus
node index.js "C:\Users\NamaAnda\Documents\Laporan-2026" "ID_FOLDER_GDRIVE" 8
```

> **Tips Menemukan ID Folder Google Drive:**  
> Buka folder tujuan di browser, lihat URL-nya:  
> `https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9...`  
> ID foldernya adalah teks acak setelah `/folders/`.

---

## 🔐 Keamanan Data
- File `credentials.json`, `token.json`, dan `.env` sudah dimasukkan ke `.gitignore` agar tidak sengaja ter-commit ke Git.
- Script ini hanya mengakses Google Drive Anda dan tidak mengirim data ke server luar mana pun.
