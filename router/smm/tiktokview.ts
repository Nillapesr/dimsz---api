import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

// === KONFIGURASI ===
const BASE_URL = 'https://clooud.my.id/api/tiktokview/?url=';
const HISTORY_FILE = path.join(process.cwd(), 'history.json');

// === FUNGSI LOAD HISTORY ===
function loadHistory(): string[] {
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// === FUNGSI SAVE HISTORY ===
function saveHistory(history: string[]): void {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// === HANDLER ===
export default async function handler(req: Request, res: Response) {
  const url = req.query.url as string;

  // Validasi parameter
  if (!url) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'url' diperlukan. Contoh: /api/smm/tiktokview?url=https://vt.tiktok.com/xxx"
    });
  }

  // Cek history (opsional)
  const history = loadHistory();
  if (history.includes(url)) {
    return res.status(400).json({
      status: false,
      message: 'Link ini sudah pernah diproses sebelumnya. Gunakan link TikTok yang berbeda.',
      url
    });
  }

  try {
    // Panggil API eksternal
    const response = await fetch(BASE_URL + encodeURIComponent(url), {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // Simpan ke history
    history.push(url);
    saveHistory(history);

    return res.json({
      status: true,
      data: result,
      message: 'Berhasil mendapatkan data view TikTok'
    });
  } catch (err: any) {
    return res.status(500).json({
      status: false,
      message: 'Gagal mengambil data dari server',
      error: err.message || 'Unknown error'
    });
  }
}
