import { Request, Response } from 'express';

const BASE_URL = 'https://clooud.my.id/api/tiktokview/?url=';

export default async function handler(req: Request, res: Response) {
  const url = req.query.url as string;

  // Validasi parameter
  if (!url) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'url' diperlukan. Contoh: /api/smm/tiktokview?url=https://vt.tiktok.com/xxx"
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

    // LANGSUNG RETURN, GAK ADA HISTORY!
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
