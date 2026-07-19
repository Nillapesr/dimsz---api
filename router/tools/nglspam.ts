import { Request, Response } from 'express';
import axios from 'axios';

interface NGLResponse {
  status: boolean;
  message?: string;
  error?: string;
}

// === FUNGSI KIRIM PESAN ===
async function sendNGLMessage(username: string, message: string): Promise<NGLResponse> {
  const cleanUsername = username.replace('https://ngl.link/', '').replace('@', '');

  try {
    const response = await axios.post(
      'https://ngl.link/api/submit',
      {
        username: cleanUsername,
        question: message,
        deviceId: 'web_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10)
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://ngl.link',
          'Referer': 'https://ngl.link/'
        },
        timeout: 10000
      }
    );

    if (response.status === 200) {
      return { status: true, message: 'Pesan terkirim!' };
    } else {
      return { status: false, error: `HTTP ${response.status}` };
    }
  } catch (err: any) {
    if (err.response?.status === 429) {
      return { status: false, error: 'Rate limit! Tunggu sebentar.' };
    }
    return { status: false, error: err.message || 'Gagal mengirim pesan' };
  }
}

// === HANDLER ===
export default async function handler(req: Request, res: Response) {
  const { username, message, count } = req.query;

  // Validasi
  if (!username) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'username' diperlukan. Contoh: /api/tools/nglspam?username=nglusername&message=halo&count=5"
    });
  }

  if (!message) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'message' diperlukan."
    });
  }

  // Jumlah spam (default 1, max 50 biar aman)
  let spamCount = parseInt(count as string) || 1;
  if (spamCount > 50) spamCount = 50;
  if (spamCount < 1) spamCount = 1;

  const cleanUsername = username.replace('https://ngl.link/', '').replace('@', '');
  const startTime = Date.now();

  // Kirim dengan delay 200ms biar gak kena rate limit
  const promises = [];
  for (let i = 0; i < spamCount; i++) {
    const delay = i * 200;
    promises.push(
      new Promise<NGLResponse>((resolve) => {
        setTimeout(async () => {
          const result = await sendNGLMessage(cleanUsername, message as string);
          resolve(result);
        }, delay);
      })
    );
  }

  const results = await Promise.all(promises);

  const successCount = results.filter(r => r.status === true).length;
  const failedCount = results.filter(r => r.status === false).length;
  const errors = results.filter(r => r.status === false).map(r => r.error || 'Unknown error');
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  return res.json({
    status: successCount > 0,
    data: {
      username: cleanUsername,
      message: message,
      total_attempts: spamCount,
      success: successCount,
      failed: failedCount,
      duration: `${duration}s`,
      errors: errors.length > 0 ? errors.slice(0, 5) : null
    },
    message: `Berhasil mengirim ${successCount} dari ${spamCount} pesan`
  });
}
