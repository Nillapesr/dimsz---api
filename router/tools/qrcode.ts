import { Request, Response } from 'express';
import QRCode from 'qrcode';

async function generateQR(text: string, size: number = 300) {
    try {
        const qrImage = await QRCode.toDataURL(text, {
            width: size,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        return {
            status: true,
            qr: qrImage,
            text: text,
            size: size
        };
    } catch (error: any) {
        throw new Error(`Gagal generate QR: ${error.message}`);
    }
}

export default async function handler(req: Request, res: Response) {
    const text = (req.query.text || req.body.text) as string;
    const size = parseInt((req.query.size || req.body.size || '300') as string);

    if (!text) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'text' diperlukan."
        });
    }

    try {
        const result = await generateQR(text, size);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
}
