import { Request, Response } from 'express';

// === KONFIGURASI ===
const BASE_URL = 'https://clooud.my.id/api/cekstatus?id=';

// === HANDLER ===
export default async function handler(req: Request, res: Response) {
  const id = req.query.id as string;

  // Validasi parameter
  if (!id) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'id' diperlukan. Contoh: /api/smm/cekstatus?id=12345"
    });
  }

  try {
    // Panggil API eksternal
    const response = await fetch(BASE_URL + encodeURIComponent(id), {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return res.json({
      status: true,
      data: result,
      message: 'Berhasil mendapatkan status order'
    });
  } catch (err: any) {
    return res.status(500).json({
      status: false,
      message: 'Gagal mengambil data dari server',
      error: err.message || 'Unknown error'
    });
  }
}
