import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

// === KONFIGURASI ===
const DATA_DIR = path.join(process.cwd(), 'data');
const EMAILS_FILE = path.join(DATA_DIR, 'tempmail.json');

// === FUNGSI BACA/TULIS ===
function readEmails() {
    try {
        return JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf8'));
    } catch { return {}; }
}

function writeEmails(data: any) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(data, null, 2));
}

// === FUNGSI GENERATE EMAIL ===
function generateEmail(prefix?: string): string {
    const domains = [
        'tempmail.com', 'temp-mail.org', 'guerrillamail.com',
        '10minutemail.com', 'mailinator.com', 'throwaway.email',
        'dispostable.com', 'mailnator.com', 'tempinbox.com'
    ];
    
    const randomString = Math.random().toString(36).substring(2, 10);
    const prefixPart = prefix || randomString;
    const domain = domains[Math.floor(Math.random() * domains.length)];
    
    return `${prefixPart}@${domain}`;
}

// === FUNGSI GET MESSAGES ===
async function getMessages(email: string): Promise<any[]> {
    const emails = readEmails();
    return emails[email]?.messages || [];
}

// === FUNGSI GET INBOX ===
async function getInbox(email: string): Promise<any> {
    const emails = readEmails();
    return emails[email] || { messages: [], created_at: new Date().toISOString() };
}

// === FUNGSI WAIT FOR MESSAGE ===
async function waitForMessage(email: string, timeout: number = 30000): Promise<any> {
    const startTime = Date.now();
    const emails = readEmails();
    
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            const updated = readEmails();
            const messages = updated[email]?.messages || [];
            
            // Cek kalo ada pesan baru (dibandingin sama sebelumnya)
            const oldMessages = emails[email]?.messages || [];
            if (messages.length > oldMessages.length) {
                clearInterval(checkInterval);
                resolve(messages[messages.length - 1]);
            }
            
            if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                resolve(null);
            }
        }, 2000);
    });
}

// === FUNGSI DELETE EMAIL ===
function deleteEmail(email: string): boolean {
    const emails = readEmails();
    if (!emails[email]) return false;
    delete emails[email];
    writeEmails(emails);
    return true;
}

// === HANDLER ===
export default async function handler(req: Request, res: Response) {
    const { action, email, prefix, timeout } = req.query;

    // === GENERATE EMAIL ===
    if (action === 'generate') {
        const generatedEmail = generateEmail(prefix as string);
        const emails = readEmails();
        
        if (!emails[generatedEmail]) {
            emails[generatedEmail] = { messages: [], created_at: new Date().toISOString() };
            writeEmails(emails);
        }
        
        return res.json({
            status: true,
            data: {
                email: generatedEmail,
                created_at: emails[generatedEmail].created_at,
                expires_in: '1 hour'
            },
            message: 'Email berhasil dibuat'
        });
    }

    // === GET INBOX ===
    if (action === 'inbox') {
        if (!email) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'email' diperlukan"
            });
        }
        
        const inbox = await getInbox(email as string);
        return res.json({
            status: true,
            data: {
                email,
                messages: inbox.messages || [],
                total: inbox.messages?.length || 0,
                created_at: inbox.created_at
            },
            message: 'Berhasil mengambil inbox'
        });
    }

    // === WAIT FOR MESSAGE ===
    if (action === 'wait') {
        if (!email) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'email' diperlukan"
            });
        }
        
        const waitTimeout = parseInt(timeout as string) || 30000;
        const message = await waitForMessage(email as string, waitTimeout);
        
        if (message) {
            return res.json({
                status: true,
                data: message,
                message: 'Pesan baru diterima'
            });
        } else {
            return res.status(404).json({
                status: false,
                message: `Tidak ada pesan baru dalam ${waitTimeout}ms`
            });
        }
    }

    // === DELETE EMAIL ===
    if (action === 'delete') {
        if (!email) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'email' diperlukan"
            });
        }
        
        const deleted = deleteEmail(email as string);
        return res.json({
            status: deleted,
            message: deleted ? 'Email berhasil dihapus' : 'Email tidak ditemukan'
        });
    }

    // === SIMULASI RECEIVE MESSAGE (buat testing) ===
    if (action === 'receive') {
        const { from, subject, body } = req.body;
        
        if (!email || !from || !subject || !body) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'email', 'from', 'subject', 'body' diperlukan"
            });
        }
        
        const emails = readEmails();
        if (!emails[email as string]) {
            emails[email as string] = { messages: [], created_at: new Date().toISOString() };
        }
        
        const newMessage = {
            id: Date.now().toString(36),
            from,
            subject,
            body,
            received_at: new Date().toISOString()
        };
        
        emails[email as string].messages.push(newMessage);
        writeEmails(emails);
        
        return res.json({
            status: true,
            data: newMessage,
            message: 'Pesan berhasil diterima (simulasi)'
        });
    }

    // === DEFAULT ===
    return res.status(400).json({
        status: false,
        message: "Action tidak valid. Gunakan: generate, inbox, wait, delete, receive"
    });
}
