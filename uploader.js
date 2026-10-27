const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Daftar folder & file yang biasanya diabaikan saat upload
const DEFAULT_IGNORES = [
  'node_modules',
  '.git',
  '.svn',
  '.env',
  'vendor',
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
];

/**
 * Format ukuran byte menjadi format yang mudah dibaca (KB, MB, GB).
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Scan seluruh file dan folder secara rekursif terlebih dahulu untuk estimasi total.
 */
function scanLocalDirectory(dirPath, ignores = DEFAULT_IGNORES) {
  let fileList = [];
  let folderList = [];
  let totalBytes = 0;

  function traverse(currentPath, relativePath = '') {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (ignores.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentPath, entry.name);
      const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        folderList.push({ fullPath, relPath, name: entry.name });
        traverse(fullPath, relPath);
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        totalBytes += stats.size;
        fileList.push({
          fullPath,
          relPath,
          name: entry.name,
          size: stats.size,
          dirRelative: relativePath,
        });
      }
    }
  }

  traverse(dirPath);
  return { fileList, folderList, totalBytes };
}

/**
 * Membuat folder di Google Drive (atau mengembalikan ID jika sudah ada di cache).
 */
async function createDriveFolder(drive, folderName, parentId = null) {
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const response = await drive.files.create({
    resource: fileMetadata,
    fields: 'id, name, webViewLink',
  });

  return response.data;
}

/**
 * Mengunggah satu file ke Google Drive dengan streaming.
 */
async function uploadSingleFile(drive, fileInfo, parentId = null) {
  const mimeType = mime.lookup(fileInfo.fullPath) || 'application/octet-stream';

  const fileMetadata = {
    name: fileInfo.name,
  };

  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const media = {
    mimeType,
    body: fs.createReadStream(fileInfo.fullPath),
  };

  const response = await drive.files.create({
    resource: fileMetadata,
    media,
    fields: 'id, name, webViewLink',
  });

  return response.data;
}

/**
 * Mengunggah folder secara rekursif ke Google Drive.
 */
async function uploadFolder(drive, localFolderPath, targetParentId = null, options = {}) {
  const resolvedPath = path.resolve(localFolderPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Folder lokal "${resolvedPath}" tidak ditemukan.`);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path "${resolvedPath}" bukan sebuah direktori/folder.`);
  }

  const folderBaseName = path.basename(resolvedPath);

  console.log(`\n🔍 Memindai isi folder: ${resolvedPath}...`);
  const { fileList, folderList, totalBytes } = scanLocalDirectory(resolvedPath, options.ignores || DEFAULT_IGNORES);

  console.log(` Ditemukan: ${fileList.length} file, ${folderList.length} subfolder (${formatBytes(totalBytes)})\n`);

  if (fileList.length === 0 && folderList.length === 0) {
    console.log('⚠️ Folder kosong. Tidak ada yang perlu diunggah.');
    return;
  }

  const startTime = Date.now();

  // 1. Buat root folder di Google Drive
  console.log(`📁 Membuat folder utama di Google Drive: "${folderBaseName}"...`);
  const rootDriveFolder = await createDriveFolder(drive, folderBaseName, targetParentId);
  console.log(` Folder utama siap (ID: ${rootDriveFolder.id})\n`);

  // Map untuk menyimpan relPath lokal -> Drive Folder ID
  // Contoh: "" -> rootDriveFolder.id, "subfolder" -> "123abcId"
  const folderIdMap = new Map();
  folderIdMap.set('', rootDriveFolder.id);

  // 2. Buat semua struktur subfolder di Google Drive
  for (let i = 0; i < folderList.length; i++) {
    const folder = folderList[i];
    const parentRelPath = path.dirname(folder.relPath);
    const parentDriveId = folderIdMap.get(parentRelPath === '.' ? '' : parentRelPath) || rootDriveFolder.id;

    console.log(`  [Folder ${i + 1}/${folderList.length}] Membuat: ${folder.relPath}`);
    const createdFolder = await createDriveFolder(drive, folder.name, parentDriveId);
    folderIdMap.set(folder.relPath, createdFolder.id);
  }

  // 3. Upload seluruh file satu per satu
  console.log('\n Mengunggah file...');
  let uploadedBytes = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const targetFolderId = folderIdMap.get(file.dirRelative) || rootDriveFolder.id;
    const progressPercent = Math.round(((i + 1) / fileList.length) * 100);

    process.stdout.write(
      `  [${i + 1}/${fileList.length} - ${progressPercent}%] Uploading: ${file.relPath} (${formatBytes(file.size)})... `
    );

    try {
      await uploadSingleFile(drive, file, targetFolderId);
      uploadedBytes += file.size;
      successCount++;
      process.stdout.write('✓ OK\n');
    } catch (err) {
      failCount++;
      process.stdout.write(`✗ GAGAL (${err.message})\n`);
    }
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);

  console.log('\n======================================================');
  console.log(' RINGKASAN UPLOAD SELESAI');
  console.log('======================================================');
  console.log(` Folder Target Drive : ${folderBaseName}`);
  console.log(` Link Folder Drive   : https://drive.google.com/drive/folders/${rootDriveFolder.id}`);
  console.log(` Sukses diupload     : ${successCount} file`);
  if (failCount > 0) {
    console.log(` Gagal diupload      : ${failCount} file`);
  }
  console.log(` Total ukuran file   : ${formatBytes(uploadedBytes)}`);
  console.log(` Waktu pengerjaan    : ${durationSec} detik`);
  console.log('======================================================\n');

  return rootDriveFolder;
}

module.exports = {
  uploadFolder,
  scanLocalDirectory,
  formatBytes,
};
