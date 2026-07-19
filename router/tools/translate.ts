import { Request, Response } from 'express';
import axios from 'axios';

async function translateText(text: string, targetLang: string = 'id') {
    try {
        const response = await axios.post(
            'https://api.mymemory.translated.net/get',
            null,
            {
                params: {
                    q: text,
                    langpair: `en|${targetLang}`
                }
            }
        );

        if (response.data.responseData) {
            return {
                status: true,
                original: text,
                translated: response.data.responseData.translatedText,
                targetLang: targetLang
            };
        } else {
            throw new Error('Gagal menerjemahkan teks');
        }
    } catch (error: any) {
        throw new Error(`Gagal translate: ${error.message}`);
    }
}

export default async function handler(req: Request, res: Response) {
    const text = (req.query.text || req.body.text) as string;
    const target = (req.query.target || req.body.target || 'id') as string;

    if (!text) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'text' diperlukan."
        });
    }

    try {
        const result = await translateText(text, target);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
}
