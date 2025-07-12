import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';

async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const rs = await fs.open(filePath, 'r');
  const stream = rs.createReadStream();
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => {
      rs.close();
      resolve(hash.digest('hex'));
    });
    stream.on('error', err => {
      rs.close();
      reject(err);
    });
  });
}

async function convertFolderToWebp(dir: string, quality = 80) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map(async entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await convertFolderToWebp(fullPath, quality);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.jpg', '.jpeg', '.png'].includes(ext)) return;

      try {
        const hash = await sha256File(fullPath);
        const outName = `${hash}.webp`;
        const outPath = path.join(dir, outName);

        // 保存済みチェック
        try {
          await fs.access(outPath);
          console.log(`🔍 スキップ済み: ${outName}`);
          return;
        } catch {
          // 存在しなければ処理続行
        }

        const info = await sharp(fullPath)
          .webp({ quality })
          .toFile(outPath);
        console.log(`✅ ${fullPath} → ${outPath} (${info.size} bytes)`);
      } catch (err) {
        console.error(`❌ 処理エラー ${fullPath}:`, err);
      }
    }
  }));
}

if (require.main === module) {
  const dir = path.resolve('./photos');
  convertFolderToWebp(dir, 80)
    .then(() => console.log('🎉 全変換完了'))
    .catch(err => console.error('💥 全体エラー:', err));
}
