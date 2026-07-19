/*
  Danzz For You 💌
  Dimsz-Api Server
  Version: 2.0.0
*/

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { loadRouter, initAutoLoad } from './src/autoload';

const app: Application = express();
const PORT = process.env.PORT || 2165;

// ============ KONFIGURASI DASAR ============
app.set('trust proxy', true);
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============ RATE LIMITING ============
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 500, // max 500 request per window
    message: {
        status: false,
        creator: 'Dimsz-Api',
        message: '⚠️ Terlalu banyak request. Coba lagi nanti.'
    },
    headers: true,
    skip: (req) => req.path === '/health' || req.path === '/verify'
});

app.use('/api/', limiter);

// ============ KONFIGURASI PATH ============
const configNya = [
    path.join(__dirname, 'src', 'config.json'),
    path.join(__dirname, '..', 'src', 'config.json'),
    path.join(process.cwd(), 'src', 'config.json'),
    path.join('/var/task/src/config.json')
];

let configPath = '';
for (const p of configNya) {
    if (fs.existsSync(p)) {
        configPath = p;
        break;
    }
}

if (!configPath) {
    console.error('[✗] Config file not found');
    process.exit(1);
}

let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// ============ DATABASE HELPERS ============
const visitor_db = path.join('/tmp', 'visitors.json');
const verified_db = path.join('/tmp', 'verified.json');
const recentRequests: string[] = [];

const visit = (): number => {
    try {
        if (fs.existsSync(visitor_db)) {
            const data = fs.readFileSync(visitor_db, 'utf-8');
            return JSON.parse(data).count;
        }
        return parseInt(config.settings.visitors || "0");
    } catch (error) { 
        return 0; 
    }
};

const incrementVisitor = (): void => {
    try {
        let count = visit();
        count++;
        fs.writeFileSync(visitor_db, JSON.stringify({ count }));
    } catch (error) {}
};

const isVerified = (req: Request): boolean => {
    try {
        // Cek cookie
        if (req.cookies?.verified === 'true') return true;
        
        // Cek header
        if (req.headers['x-verified'] === 'true') return true;
        
        // Cek session di file
        if (fs.existsSync(verified_db)) {
            const data = fs.readFileSync(verified_db, 'utf-8');
            const verified = JSON.parse(data);
            const ip = req.ip || req.connection.remoteAddress || '';
            return verified[ip] === true;
        }
        return false;
    } catch (error) {
        return false;
    }
};

const setVerified = (req: Request): void => {
    try {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        let verified = {};
        if (fs.existsSync(verified_db)) {
            const data = fs.readFileSync(verified_db, 'utf-8');
            verified = JSON.parse(data);
        }
        verified[ip] = true;
        fs.writeFileSync(verified_db, JSON.stringify(verified));
        
        // Set cookie
        res.cookie('verified', 'true', { 
            maxAge: 3600000, // 1 jam
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
    } catch (error) {}
};

// ============ FORMATTERS ============
const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
};

// ============ MIDDLEWARE ============
// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
        const ignored = [
            '/stats', '/stats/data', '/src', '/docs', '/config', 
            '/favicon.ico', '/', '/dimsz-ai', '/verify', '/health'
        ];
        const isIgnored = ignored.some(p => req.path.startsWith(p) || req.path === '/');
        if (!isIgnored) {
            const method = req.method;
            const status = res.statusCode;
            const host = req.get('host');
            const protocol = req.protocol; 
            let cleanUrl = req.originalUrl.replace(/(=)[^&]+/g, '$1');
            const fullUrl = `${protocol}://${host}${cleanUrl}`;
            const logLine = `[${method}] [${status}] ${fullUrl}`;
            recentRequests.push(logLine);
            if (recentRequests.length > 50) recentRequests.shift();
        }
    });
    next();
});

// Verify middleware untuk protected routes
const requireVerification = (req: Request, res: Response, next: NextFunction) => {
    if (isVerified(req)) {
        return next();
    }
    // Redirect ke halaman verify
    if (req.accepts('html')) {
        return res.redirect('/verify');
    }
    res.status(403).json({
        status: false,
        message: 'Verifikasi diperlukan',
        redirect: '/verify'
    });
};

// ============ STATIC FILES ============
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/src', express.static(path.join(process.cwd(), 'src')));

// ============ ROUTES ============

// Health Check
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: formatUptime(os.uptime()),
        memory: {
            used: formatBytes(process.memoryUsage().heapUsed),
            total: formatBytes(process.memoryUsage().heapTotal)
        }
    });
});

// ============ VERIFY PAGE ============
app.get('/verify', (req: Request, res: Response) => {
    const verifyPath = path.join(process.cwd(), 'public', 'verify.html');
    if (fs.existsSync(verifyPath)) {
        res.sendFile(verifyPath);
    } else {
        // Fallback sederhana
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Verifikasi</title>
                <style>
                    body { background: #0a0a0a; font-family: monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                    .card { background: #1a1a1a; border: 3px solid #2a2a2a; padding: 2rem; max-width: 400px; text-align: center; }
                    h1 { color: #c1121f; font-size: 1.5rem; }
                    .btn { display: inline-block; padding: 0.8rem 2rem; background: #c1121f; color: white; border: none; cursor: pointer; font-family: monospace; font-size: 1rem; margin-top: 1rem; }
                    .btn:hover { background: #a00f1a; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>🔒 VERIFIKASI</h1>
                    <p style="color: #8a7f75;">Klik tombol di bawah untuk verifikasi</p>
                    <button class="btn" onclick="verify()">✓ Verifikasi</button>
                    <script>
                        function verify() {
                            fetch('/verify/confirm', { method: 'POST' })
                                .then(() => { window.location.href = '/'; })
                                .catch(() => { window.location.href = '/'; });
                        }
                    </script>
                </div>
            </body>
            </html>
        `);
    }
});

// Verify confirmation endpoint
app.post('/verify/confirm', (req: Request, res: Response) => {
    setVerified(req);
    res.json({ status: true, message: 'Verifikasi berhasil' });
});

// ============ STATS ============
app.get('/stats/data', (req: Request, res: Response) => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const cpus = os.cpus();    
        res.json({
            status: true,
            server: {
                platform: os.platform(),
                arch: os.arch(),
                hostname: os.hostname(),
                uptime: formatUptime(os.uptime()),
                node_version: process.version,
                memory: {
                    total: formatBytes(totalMem),
                    used: formatBytes(usedMem),
                    free: formatBytes(freeMem),
                    percent: Math.round((usedMem / totalMem) * 100)
                },
                cpu: {
                    model: cpus[0].model,
                    speed: `${cpus[0].speed} MHz`,
                    cores: cpus.length,
                    load: os.loadavg()[0].toFixed(2)
                }
            },
            requests: recentRequests
        });
    } catch (e) {
        res.status(500).json({ status: false });
    }
});

app.get('/stats', (req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), 'public', 'stats.html'));
});

// ============ CONFIG ============
app.get('/config', (req: Request, res: Response) => {
    try {
        const currentConfig = JSON.parse(JSON.stringify(config));
        currentConfig.settings.visitors = visit().toString();
        res.json({ creator: config.settings.creator, ...currentConfig });
    } catch (error) { 
        res.status(500).json({ creator: config.settings.creator, error: "Internal Server Error" }); 
    }
});

// ============ PAGE ROUTES ============

// Landing page (Dashboard) - dengan verifikasi
app.get('/', requireVerification, (req: Request, res: Response) => {
    incrementVisitor();
    const landingPath = path.join(process.cwd(), 'public', 'landing.html');
    if (fs.existsSync(landingPath)) {
        res.sendFile(landingPath);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>Dimsz-Api</title></head>
            <body style="background:#ece6df;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;">
                <div style="background:#f5f0eb;border:4px solid #1a1a1a;padding:2rem;text-align:center;box-shadow:12px 12px 0 #1a1a1a;">
                    <h1 style="color:#c1121f;">⚡ DIMSZ-API</h1>
                    <p>Selamat datang di dashboard brutal!</p>
                    <a href="/docs" style="display:inline-block;padding:0.8rem 2rem;background:#c1121f;color:white;border:3px solid #1a1a1a;text-decoration:none;margin-top:1rem;">Docs</a>
                    <a href="/stats" style="display:inline-block;padding:0.8rem 2rem;background:#f5f0eb;color:#1a1a1a;border:3px solid #1a1a1a;text-decoration:none;margin-top:1rem;">Stats</a>
                    <a href="/dimsz-ai" style="display:inline-block;padding:0.8rem 2rem;background:#2a6f97;color:white;border:3px solid #1a1a1a;text-decoration:none;margin-top:1rem;">AI</a>
                </div>
            </body>
            </html>
        `);
    }
});

// Documentation - dengan verifikasi
app.get('/docs', requireVerification, (req: Request, res: Response) => { 
    const docsPath = path.join(process.cwd(), 'public', 'docs.html');
    if (fs.existsSync(docsPath)) {
        res.sendFile(docsPath);
    } else {
        res.status(404).send('Docs page not found');
    }
});

// Dimsz-AI - dengan verifikasi
app.get('/dimsz-ai', requireVerification, (req: Request, res: Response) => {
    const aiPagePath = path.join(process.cwd(), 'public', 'dimsz-ai.html');
    if (fs.existsSync(aiPagePath)) {
        res.sendFile(aiPagePath);
    } else {
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Dimsz-AI</title>
                <style>
                    body { background: #ece6df; font-family: 'Courier New', monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
                    .container { background: #f5f0eb; border: 4px solid #1a1a1a; box-shadow: 12px 12px 0 0 #1a1a1a; padding: 2rem; max-width: 500px; text-align: center; }
                    h1 { font-size: 2rem; color: #c1121f; text-transform: uppercase; letter-spacing: 2px; }
                    .divider { height: 4px; background: #1a1a1a; width: 60px; margin: 0.5rem auto; }
                    .btn { display: inline-block; padding: 0.75rem 2rem; background: #c1121f; color: #f5f0eb; border: 3px solid #1a1a1a; box-shadow: 5px 5px 0 0 #1a1a1a; text-decoration: none; font-weight: bold; text-transform: uppercase; font-size: 0.85rem; transition: all 0.06s linear; margin-top: 1rem; }
                    .btn:active { transform: translate(4px, 4px); box-shadow: 1px 1px 0 0 #1a1a1a; }
                    .btn-back { background: #f5f0eb; color: #1a1a1a; }
                    .status { display: inline-block; background: #2b9348; color: white; padding: 0.2rem 1rem; border: 2px solid #1a1a1a; font-size: 0.7rem; font-weight: bold; text-transform: uppercase; }
                    .error-icon { font-size: 4rem; margin: 1rem 0; color: #c1121f; }
                    .note { color: #8a7f75; font-size: 0.75rem; margin-top: 1.5rem; border-top: 2px solid #1a1a1a; padding-top: 1rem; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="status">🚀 COMING SOON</div>
                    <div class="error-icon">⚡</div>
                    <h1>Dimsz-AI</h1>
                    <div class="divider"></div>
                    <p style="color: #1a1a1a; font-size: 0.9rem;">
                        Halaman AI sedang dalam pengembangan.
                        <br>Kembali ke dashboard untuk melanjutkan.
                    </p>
                    <a href="/" class="btn btn-back">← Back to Dashboard</a>
                    <div class="note">
                        <span style="color: #c1121f;">◼</span> Danzz For You 💌
                    </div>
                </div>
            </body>
            </html>
        `);
    }
});

// ============ LOAD ROUTER ============
loadRouter(app, config);

// ============ 404 HANDLER ============
app.use((req: Request, res: Response) => {
    if (req.accepts('html')) {
        const possible404 = [
            path.join(process.cwd(), 'public', '404.html'),
            path.join(__dirname, 'public', '404.html')
        ];
        for (const p of possible404) { 
            if (fs.existsSync(p)) return res.status(404).sendFile(p);
        }
        // Fallback 404
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>404 - Halaman Tidak Ditemukan</title>
                <style>
                    body { background: #ece6df; font-family: monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                    .box { background: #f5f0eb; border: 4px solid #1a1a1a; padding: 2rem; text-align: center; box-shadow: 12px 12px 0 #1a1a1a; }
                    h1 { font-size: 4rem; color: #c1121f; margin: 0; }
                    .btn { display: inline-block; padding: 0.8rem 2rem; background: #c1121f; color: white; border: 3px solid #1a1a1a; text-decoration: none; font-weight: bold; margin-top: 1rem; }
                    .btn:active { transform: translate(4px, 4px); box-shadow: 1px 1px 0 #1a1a1a; }
                </style>
            </head>
            <body>
                <div class="box">
                    <h1>404</h1>
                    <p>Halaman tidak ditemukan</p>
                    <a href="/" class="btn">← Kembali</a>
                </div>
            </body>
            </html>
        `);
    } else {
        res.status(404).json({ 
            status: false, 
            creator: config.settings.creator, 
            message: "Route not found" 
        });
    }
});

// ============ INIT AUTO-LOAD ============
initAutoLoad(app, config, configPath);

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════╗
    ║   ⚡ Dimsz-Api Server Started ⚡              ║
    ╠═══════════════════════════════════════════════╣
    ║   Port    : ${PORT.padEnd(40)}║
    ║   Status  : 🟢 Online${' '.padEnd(37)}║
    ║   Mode    : ${(process.env.NODE_ENV || 'development').padEnd(40)}║
    ╠═══════════════════════════════════════════════╣
    ║   📍 Landing  : http://localhost:${PORT}/     ║
    ║   📍 Docs     : http://localhost:${PORT}/docs  ║
    ║   📍 Stats    : http://localhost:${PORT}/stats ║
    ║   📍 Dimsz-AI : http://localhost:${PORT}/dimsz-ai ║
    ║   📍 Verify   : http://localhost:${PORT}/verify ║
    ║   📍 Health   : http://localhost:${PORT}/health ║
    ╚═══════════════════════════════════════════════╝
    `);
    console.log(`💌 Danzz For You!`);
});

export default app;
