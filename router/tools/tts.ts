import { Request, Response } from 'express';
import axios from 'axios';

async function textToSpeech(text: string, language: string = 'id') {
    try {
        const response = await axios.post(
            'https://api.voicerss.org/',
            null,
            {
                params: {
                    key: process.env.VOICERSS_API_KEY || 'your_api_key',
                    src: text,
                    hl: language,
                    c: 'mp3',
                    f: '8khz_8bit_mono'
                },
                responseType: 'arraybuffer'
            }
        );

        const audioBase64 = Buffer.from(response.data).toString('base64');
        
        return {
            status: true,
            audio: audioBase64,
            text: text,
            language: language,
            format: 'mp3'
        };
    } catch (error: any) {
        throw new Error(`Gagal generate TTS: ${error.message}`);
    }
}

export default async function handler(req: Request, res: Response) {
    const text = (req.query.text || req.body.text) as string;
    const language = (req.query.lang || req.body.lang || 'id') as string;

    if (!text) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'text' diperlukan."
        });
    }

    try {
        const result = await textToSpeech(text, language);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
}
