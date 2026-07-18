import { Request, Response } from 'express';
import axios from 'axios';

// Konfigurasi ChatGPT
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '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'; // Taruh di .env
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const systemPrompt = `Nama kamu adalah Dimsz-Api, kamu adalah asisten AI yang friendly dan baik hati. 
Gaya bicara kamu seperti chat di WhatsApp — santai, pendek, dan gaul. 
Kamu bukan AI formal, tapi teman ngobrol yang asik.`;

async function chatWithGPT(
    message: string, 
    instruction: string = systemPrompt, 
    sessionId: string | null = null
) {
    try {
        // Coba ambil history dari session
        let messages: any[] = [];
        let savedInstruction = instruction;

        if (sessionId) {
            try {
                const sessionData = JSON.parse(Buffer.from(sessionId, 'base64').toString());
                messages = sessionData.messages || [];
                savedInstruction = instruction !== systemPrompt ? instruction : (sessionData.instruction || systemPrompt);
            } catch (e) {
                // Session invalid — mulai baru
            }
        }

        // Kalau belum ada history, init dengan system prompt
        if (messages.length === 0) {
            messages = [
                { role: 'system', content: savedInstruction }
            ];
        }

        // Tambah pesan user
        messages.push({ role: 'user', content: message });

        // Panggil API OpenAI
        const response = await axios.post(
            OPENAI_URL,
            {
                model: 'gpt-4o-mini', // atau 'gpt-3.5-turbo'
                messages: messages,
                temperature: 0.7,
                max_tokens: 500,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                }
            }
        );

        const aiMessage = response.data.choices[0]?.message?.content || 'Maaf, aku gak bisa jawab sekarang 😅';

        // Update history
        messages.push({ role: 'assistant', content: aiMessage });

        // Simpan session baru (max 10 pesan terakhir biar gak kegedean)
        const MAX_HISTORY = 10;
        const historyToSave = messages.slice(-MAX_HISTORY);

        const newSessionId = Buffer.from(JSON.stringify({
            messages: historyToSave,
            instruction: savedInstruction
        })).toString('base64');

        return {
            status: true,
            response: aiMessage,
            session: newSessionId
        };

    } catch (error: any) {
        const errorMessage = error?.response?.data?.error?.message || error?.message || 'Unknown error';
        throw new Error(`Gagal ambil respon dari ChatGPT: ${errorMessage}`);
    }
}

export default async function handler(req: Request, res: Response) {
    // Support GET & POST
    const q = (req.query.q || req.body.q || req.query.message || req.body.message) as string;
    const session = (req.query.session || req.body.session) as string;

    if (!q) {
        return res.status(400).json({
            status: false,
            message: "Parameter 'q' (pertanyaan) diperlukan."
        });
    }

    try {
        const result = await chatWithGPT(q, undefined, session);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({
            status: false,
            message: error.message || 'Internal server error'
        });
    }
}
