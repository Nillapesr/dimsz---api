import { Request, Response } from 'express';
import axios from 'axios';

const BASE_URL = 'https://clooud.my.id/stalker-yt/';

export default async function handler(req: Request, res: Response) {
  const username = req.query.username as string;

  // Validasi parameter
  if (!username) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'username' diperlukan. Contoh: /api/stalker/ytstalker?username=FadzzMc32"
    });
  }

  try {
    // Panggil API eksternal
    const response = await axios.get(BASE_URL, {
      params: { 
        username, 
        baseurl: 'cloud.my.id' 
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
        'Accept': 'application/json, */*',
        'Referer': 'https://clooud.my.id/'
      },
      timeout: 15000
    });

    // Cek response dari API
    if (response.data.status === false) {
      return res.status(404).json({
        status: false,
        message: response.data.message || 'User tidak ditemukan',
        data: null
      });
    }

    return res.json({
      status: true,
      data: response.data,
      message: 'Berhasil mendapatkan data YouTube'
    });

  } catch (err: any) {
    if (err.response) {
      return res.status(err.response.status || 500).json({
        status: false,
        message: `HTTP Error: ${err.response.status}`,
        error: err.response.data || err.message
      });
    }

    return res.status(500).json({
      status: false,
      message: 'Gagal mengambil data dari server',
      error: err.message || 'Unknown error'
    });
  }
}
