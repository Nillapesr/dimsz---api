import { Request, Response } from 'express';
import crypto from 'crypto';

function generateHash(text: string, algorithm: string = 'md5') {
    try {
        const hash = crypto.createHash(algorithm);
        hash.update(text);
        const result = hash.digest('hex');

        return {
            status: true,
            text: text,
            algorithm: algorithm,
            hash: result
        };
    } catch (error: any) {
        throw new Error(`Gagal generate hash: ${error.message}`);
    }
}

export default async function handler(req: Request, res: Response) {
    const text = (req.query.text || req.body.text) as string;
    const algorithm = (req.query.algorithm || req.body.algorithm || 'md5') as string;

    if (!text) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'text' diperlukan."
        });
    }

    const validAlgorithms = ['md5', 'sha1', 'sha256', 'sha512'];
    if (!validAlgorithms.includes(algorithm)) {
        return res.status(400).json({
            status: false,
            message: "Algorithm harus salah satu dari: md5, sha1, sha256, sha512"
        });
    }

    try {
        const result = generateHash(text, algorithm);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
}
