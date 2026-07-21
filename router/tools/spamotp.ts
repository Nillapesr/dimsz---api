import { Request, Response } from 'express';
import axios from 'axios';

interface SpamResult {
    name: string;
    success: boolean;
}

interface SpamResponse {
    status: boolean;
    result: {
        total: number;
        success: number;
        failed: number;
        results: SpamResult[];
    };
}

export default async function handler(req: Request, res: Response) {
    // Support GET & POST
    const phone = (req.query.phone || req.body.phone || req.query.nomor || req.body.nomor) as string;

    // Validasi parameter
    if (!phone) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'phone' atau 'nomor' diperlukan. Contoh: /api/tools/spamotp?phone=628123456789"
        });
    }

    // Validasi nomor
    if (!phone.startsWith('62')) {
        return res.status(400).json({
            status: false,
            message: "Nomor harus diawali dengan '62' (bukan 08). Contoh: 628123456789"
        });
    }

    if (phone.length < 10 || phone.length > 15) {
        return res.status(400).json({
            status: false,
            message: "Nomor terlalu pendek/panjang! (min 10, max 15 digit)"
        });
    }

    if (!/^\d+$/.test(phone)) {
        return res.status(400).json({
            status: false,
            message: "Nomor hanya boleh berisi angka!"
        });
    }

    try {
        // Panggil API eksternal
        const apiUrl = `https://api-nanzz.my.id/docs/api/tools/spam.php?phone=${phone}`;
        const response = await axios.get<SpamResponse>(apiUrl, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const data = response.data;

        if (!data.status) {
            return res.status(500).json({
                status: false,
                message: 'Gagal mengirim spam. API error atau nomor tidak valid.'
            });
        }

        const { total, success, failed, results } = data.result;

        // Filter hasil
        const suksesList = results.filter(r => r.success).map(r => r.name);
        const gagalList = results.filter(r => !r.success).map(r => r.name);

        return res.json({
            status: true,
            data: {
                target: phone,
                total: total,
                success: success,
                failed: failed,
                details: {
                    success_list: suksesList,
                    failed_list: gagalList
                },
                timestamp: new Date().toISOString()
            },
            message: `Spam OTP berhasil dikirim ke ${phone}`
        });

    } catch (error: any) {
        console.error('Spam OTP Error:', error.message);
        return res.status(500).json({
            status: false,
            message: error.message || 'Terjadi kesalahan saat memproses request.'
        });
    }
}
