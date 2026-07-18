import { Request, Response } from 'express';
import axios from 'axios';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const BACKGROUND_URL = 'https://clooud.my.id/uploder/uploads/Icqgsk.png';

const CANVAS_W = 941;
const CANVAS_H = 1672;

const PP_BOX = {
  x: 337.5,
  y: 694,
  w: 264,
  h: 270.1,
};

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  return Buffer.from(res.data);
}

async function generateAfml(ppurl: string): Promise<Buffer> {
  const [bgBuffer, ppBuffer] = await Promise.all([
    fetchBuffer(BACKGROUND_URL),
    fetchBuffer(ppurl),
  ]);

  const bg = await loadImage(bgBuffer);
  const pp = await loadImage(ppBuffer);

  const canvas = createCanvas(CANVAS_W, CANVAS_H);
  const ctx = canvas.getContext('2d');

  // Gambar PP dulu (biar di belakang)
  ctx.drawImage(pp, PP_BOX.x, PP_BOX.y, PP_BOX.w, PP_BOX.h);
  // Gambar background di atas
  ctx.drawImage(bg, 0, 0, CANVAS_W, CANVAS_H);

  return canvas.toBuffer('image/png');
}

export default async function handler(req: Request, res: Response) {
  // Support GET & POST
  const ppurl = (req.query.ppurl || req.body.ppurl) as string;

  if (!ppurl) {
    return res.status(400).json({ 
      status: false,
      error: '"ppurl" wajib diisi' 
    });
  }

  try {
    const imgBuffer = await generateAfml(ppurl);
    res.setHeader('Content-Type', 'image/png');
    res.send(imgBuffer);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ 
      status: false,
      error: err.message 
    });
  }
}
