import { Request, Response } from 'express';

// === PAKE MEMORY (GAK PAKE FILE) ===
const emails: Record<string, any> = {};

// === GENERATE EMAIL ===
function generateEmail(prefix?: string): string {
    const domains = ['tempmail.com', 'temp-mail.org', 'guerrillamail.com', 'mailinator.com'];
    const random = Math.random().toString(36).substring(2, 10);
    const name = prefix || random;
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${name}@${domain}`;
}

// === HANDLER ===
export default async function handler(req: Request, res: Response) {
    const { action, email, prefix } = req.query;

    // === GENERATE ===
    if (action === 'generate') {
        const generated = generateEmail(prefix as string);
        if (!emails[generated]) {
            emails[generated] = { messages: [], created_at: new Date().toISOString() };
        }
        return res.json({
            status: true,
            data: { email: generated, created_at: emails[generated].created_at },
            message: 'Email berhasil dibuat'
        });
    }

    // === INBOX ===
    if (action === 'inbox') {
        if (!email) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'email' diperlukan"
            });
        }
        const inbox = emails[email as string] || { messages: [], created_at: new Date().toISOString() };
        return res.json({
            status: true,
            data: {
                email,
                messages: inbox.messages || [],
                total: inbox.messages?.length || 0,
                created_at: inbox.created_at
            }
        });
    }

    // === WAIT ===
    if (action === 'wait') {
        if (!email) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'email' diperlukan"
            });
        }
        const inbox = emails[email as string] || { messages: [], created_at: new Date().toISOString() };
        return res.json({
            status: true,
            data: {
                email,
                messages: inbox.messages || [],
                total: inbox.messages?.length || 0
            },
            message: inbox.messages?.length > 0 ? 'Pesan ditemukan' : 'Belum ada pesan'
        });
    }

    return res.status(400).json({
        status: false,
        message: "Action tidak valid. Gunakan: generate, inbox, wait"
    });
}
