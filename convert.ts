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

// 保存したWebPのパスを集める
const savedPaths: string[] = [];

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
        const relativeDir = path.relative(process.cwd(), dir);
        const outName = `${hash}.webp`;
        const outPath = path.join(dir, outName);

        try {
          await fs.access(outPath);
          console.log(`🔍 Skip existing: ${outPath}`);
          return;
        } catch {/* not exist */}

        const info = await sharp(fullPath)
          .webp({ quality })
          .toFile(outPath);
        console.log(`✅ ${fullPath} → ${outPath} (${info.size} bytes)`);

        // JSON に追加（相対パス）
        const jsonPath = path.join(relativeDir, outName).replace(/\\/g, '/');
        savedPaths.push(jsonPath);

      } catch (err) {
        console.error(`❌ Error processing ${fullPath}:`, err);
      }
    }
  }));
}

async function main() {
  const root = path.resolve('./photos');
  await convertFolderToWebp(root, 80);

  // paths.json に書き出し
  const json = JSON.stringify({ imagePaths: savedPaths }, null, 2);
  await fs.writeFile('paths.json', json);
  console.log('📄 paths.json を書き出したよ！');
}

if (require.main === module) {
  main().catch(err => console.error('💥 全体エラー:', err));
}
