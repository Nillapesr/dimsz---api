import { Request, Response } from 'express';
import Tesseract from 'tesseract.js';

async function ocrImage(imageUrl: string) {
    try {
        const result = await Tesseract.recognize(
            imageUrl,
            'ind',
            { logger: m => console.log(m) }
        );

        return {
            status: true,
            text: result.data.text,
            confidence: result.data.confidence
        };
    } catch (error: any) {
        throw new Error(`Gagal OCR: ${error.message}`);
    }
}

export default async function handler(req: Request, res: Response) {
    const url = (req.query.url || req.body.url) as string;

    if (!url) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'url' diperlukan."
        });
    }

    try {
        const result = await ocrImage(url);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
}
