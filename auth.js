const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');
const open = require('open');

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'service-account.json');

/**
 * Mendapatkan client Google Drive yang terotentikasi.
 * Mendukung OAuth2 (akun pribadi) dan Service Account.
 */
async function getDriveClient() {
  // 1. Cek apakah menggunakan Service Account
  if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.log(' Menggunakan autentikasi Service Account (service-account.json)...');
    const auth = new google.auth.GoogleAuth({
      keyFile: SERVICE_ACCOUNT_PATH,
      scopes: SCOPES,
    });
    return google.drive({ version: 'v3', auth });
  }

  // 2. Menggunakan OAuth 2.0 (Desktop App)
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `File "credentials.json" tidak ditemukan di:\n${CREDENTIALS_PATH}\n\n` +
      `Silakan unduh OAuth Client ID (Desktop App) dari Google Cloud Console dan simpan sebagai "credentials.json".\n` +
      `Baca petunjuk lengkap di README.md.`
    );
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const config = credentials.installed || credentials.web;

  if (!config) {
    throw new Error('Format credentials.json tidak valid. Pastikan tipe OAuth Client adalah "Desktop App".');
  }

  const { client_id, client_secret } = config;
  const redirectUri = 'http://localhost:3000/oauth2callback';

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  // Jika token.json sudah ada, gunakan token tersebut
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oAuth2Client.setCredentials(token);

    // Auto-refresh token jika expired
    oAuth2Client.on('tokens', (tokens) => {
      const currentToken = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      const updatedToken = { ...currentToken, ...tokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(updatedToken, null, 2));
    });

    return google.drive({ version: 'v3', auth: oAuth2Client });
  }

  // Jika belum ada token, buka browser untuk login
  const authorizedClient = await authorizeInBrowser(oAuth2Client);
  return google.drive({ version: 'v3', auth: authorizedClient });
}

/**
 * Menjalankan server lokal sementara untuk menangkap kode callback OAuth dari browser.
 */
function authorizeInBrowser(oAuth2Client) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = new URL(req.url, 'http://localhost:3000');
        if (parsedUrl.pathname === '/oauth2callback') {
          const code = parsedUrl.searchParams.get('code');
          const error = parsedUrl.searchParams.get('error');
          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #10b981;"> Autentikasi Berhasil!</h1>
                <p>Token telah disimpan. Anda dapat menutup tab browser ini dan kembali ke terminal.</p>
              </div>
            `);

            server.close();

            const { tokens } = await oAuth2Client.getToken(code);
            oAuth2Client.setCredentials(tokens);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
            console.log(' Token berhasil dibuat dan disimpan di token.json!\n');

            resolve(oAuth2Client);
          } else if (error) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end(`Gagal autentikasi: ${error}`);
            server.close();
            reject(new Error(`Login dibatalkan atau ditolak: ${error}`));
          }
        }
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    const PORT = 3000;
    server.listen(PORT, async () => {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
      });

      console.log('\n======================================================');
      console.log(' AUTENTIKASI GOOGLE DRIVE DIBUTUHKAN');
      console.log('======================================================');
      console.log('Membuka browser otomatis untuk login akun Google...');
      console.log(`Jika browser tidak terbuka otomatis, salin link berikut:\n${authUrl}\n`);

      try {
        await open(authUrl);
      } catch (e) {
        console.log('Gagal membuka browser secara otomatis. Silakan buka link di atas secara manual.');
      }
    });

    server.on('error', (err) => {
      reject(new Error(`Gagal membuka port ${PORT} untuk callback OAuth: ${err.message}`));
    });
  });
}

module.exports = {
  getDriveClient,
};
