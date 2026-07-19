import { Request, Response } from 'express';
import axios from 'axios';

async function getRandomQuote() {
    try {
        const response = await axios.get('https://api.quotable.io/random');
        
        return {
            status: true,
            quote: response.data.content,
            author: response.data.author,
            tags: response.data.tags
        };
    } catch (error: any) {
        throw new Error(`Gagal ambil quote: ${error.message}`);
    }
}

export default async function handler(req: Request, res: Response) {
    try {
        const result = await getRandomQuote();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
}
