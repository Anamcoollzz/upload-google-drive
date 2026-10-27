const readline = require('readline/promises');
const path = require('path');
const { getDriveClient } = require('./auth');
const { uploadFolder } = require('./uploader');

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║       Google Drive Folder Uploader (Node.js)      ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  let targetFolder = process.argv[2];
  let parentDriveId = process.argv[3] || null;

  // Jika user tidak memasukkan argumen lewat CLI, minta input secara interaktif
  if (!targetFolder) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      targetFolder = await rl.question(' Masukkan path folder yang ingin diupload: ');
      const inputDriveId = await rl.question(' Masukkan ID Folder Google Drive tujuan (tekan Enter untuk My Drive): ');
      if (inputDriveId.trim()) {
        parentDriveId = inputDriveId.trim();
      }
    } finally {
      rl.close();
    }
  }

  // Bersihkan kutip jika ada (misal copy-paste path dengan kutip di Windows)
  targetFolder = targetFolder.trim().replace(/^["']|["']$/g, '');

  if (!targetFolder) {
    console.error(' Error: Path folder tidak boleh kosong.');
    process.exit(1);
  }

  try {
    const drive = await getDriveClient();
    await uploadFolder(drive, targetFolder, parentDriveId);
  } catch (error) {
    console.error('\n Terjadi Kesalahan:');
    console.error(error.message);
    process.exit(1);
  }
}

main();
