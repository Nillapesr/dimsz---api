import { Request, Response } from 'express';
import dns from 'dns';
import { promisify } from 'util';

const resolve = promisify(dns.resolve);

async function checkDomain(domain: string) {
    try {
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        
        let available = false;
        let records: any = {};
        
        try {
            await resolve(cleanDomain);
            available = true;
            records = await resolve(cleanDomain);
        } catch (e) {
            available = false;
        }

        return {
            status: true,
            domain: cleanDomain,
            available: available,
            records: records,
            checkedAt: new Date().toISOString()
        };
    } catch (error: any) {
        throw new Error(`Gagal cek domain: ${error.message}`);
    }
}

export default async function handler(req: Request, res: Response) {
    const domain = (req.query.domain || req.body.domain) as string;

    if (!domain) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'domain' diperlukan."
        });
    }

    try {
        const result = await checkDomain(domain);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
}
