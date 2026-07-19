import { Request, Response } from 'express';
import axios from 'axios';

// === KONFIGURASI ===
// API dari https://api.dicoding.dev (gratis)
const API_URL = 'https://api.dicoding.dev/v1/freefire';

// === HANDLER ===
export default async function handler(req: Request, res: Response) {
    const { id, username } = req.query;
    const playerId = (id || username) as string;

    // Validasi
    if (!playerId) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'id' atau 'username' diperlukan"
        });
    }

    try {
        // Panggil API eksternal
        const response = await axios.get(`${API_URL}/profile/${playerId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        // Cek response
        if (!response.data || response.data.status === false) {
            return res.status(404).json({
                status: false,
                message: `Player dengan ID '${playerId}' tidak ditemukan`
            });
        }

        const data = response.data;

        return res.json({
            status: true,
            data: {
                id: data.id || playerId,
                name: data.name || 'Unknown',
                level: data.level || 0,
                exp: data.exp || 0,
                avatar: data.avatar || 'https://i.imgur.com/default.png',
                region: data.region || 'ID',
                rank: {
                    name: data.rank?.name || 'Unranked',
                    tier: data.rank?.tier || 'Bronze',
                    points: data.rank?.points || 0
                },
                stats: {
                    matches: data.stats?.matches || 0,
                    wins: data.stats?.wins || 0,
                    kills: data.stats?.kills || 0,
                    kd: data.stats?.kd || 0
                }
            },
            message: 'Berhasil mengambil data player Free Fire'
        });

    } catch (error: any) {
        // Handle error
        if (error.response?.status === 404) {
            return res.status(404).json({
                status: false,
                message: `Player dengan ID '${playerId}' tidak ditemukan`
            });
        }

        return res.status(500).json({
            status: false,
            message: error.message || 'Gagal mengambil data player'
        });
    }
}
