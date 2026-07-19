import { Request, Response } from 'express';

function processBase64(text: string, action: string = 'encode') {
    try {
        let result: string;
        if (action === 'encode') {
            result = Buffer.from(text).toString('base64');
        } else if (action === 'decode') {
            result = Buffer.from(text, 'base64').toString('utf-8');
        } else {
            throw new Error('Action harus encode atau decode');
        }

        return {
            status: true,
            action: action,
            text: text,
            result: result
        };
    } catch (error: any) {
        throw new Error(`Gagal proses base64: ${error.message}`);
    }
}

export default async function handler(req: Request, res: Response) {
    const text = (req.query.text || req.body.text) as string;
    const action = (req.query.action || req.body.action || 'encode') as string;

    if (!text) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'text' diperlukan."
        });
    }

    try {
        const result = processBase64(text, action);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
}
