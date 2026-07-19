/*
  Danzz For You 💌
  Dimsz-Api - Vercel Edition
*/

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import cookieParser from 'cookie-parser';
import { loadRouter, initAutoLoad } from './src/autoload';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', true);
app.use(cookieParser());

// ============ CONFIG ============
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

let config: any = {
    settings: {
        apiName: 'Dimsz-Api',
        description: 'Brutal API Gateway',
        creator: 'Danzz',
        visitors: '0'
    },
    tags: {}
};

if (configPath) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log(`✅ Config loaded from: ${configPath}`);
} else {
    console.log('⚠️ Using default config');
}

// ============ HELPERS ============
const visitor_db = path.join('/tmp', 'visitors.json');
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

// ============ VERIFICATION - COOKIE ONLY! ============
const isVerified = (req: Request): boolean => {
    return req.cookies?.verified === 'true';
};

const setVerified = (req: Request, res: Response): void => {
    res.cookie('verified', 'true', { 
        maxAge: 3600000, // 1 jam
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });
};

// Middleware verifikasi
const requireVerification = (req: Request, res: Response, next: NextFunction) => {
    const skipRoutes = ['/verify', '/verify/confirm', '/health', '/config', '/stats/data'];
    if (skipRoutes.includes(req.path)) {
        return next();
    }
    
    if (isVerified(req)) {
        return next();
    }
    
    if (req.accepts('html')) {
        return res.redirect('/verify');
    }
    res.status(403).json({
        status: false,
        message: 'Verifikasi diperlukan',
        redirect: '/verify'
    });
};

// ============ MIDDLEWARE ============
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
        const ignored = ['/stats', '/stats/data', '/src', '/docs', '/config', '/favicon.ico', '/', '/verify', '/health', '/verify/confirm', '/dimsz-ai'];
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

// Static files
const publicPath = path.join(process.cwd(), 'public');
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    console.log(`✅ Public folder found: ${publicPath}`);
}

app.use('/src', express.static(path.join(process.cwd(), 'src')));

// Load router
try {
    loadRouter(app, config);
} catch (e) {
    console.log('⚠️ Router load skipped');
}

// ============ VERIFY ROUTES ============

// Halaman verifikasi
app.get('/verify', (req: Request, res: Response) => {
    const verifyPath = path.join(publicPath, 'verify.html');
    if (fs.existsSync(verifyPath)) {
        res.sendFile(verifyPath);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Verifikasi</title>
                <style>
                    body { background: #0a0a0a; font-family: monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
                    .card { background: #1a1a1a; border: 3px solid #2a2a2a; padding: 2rem; max-width: 400px; text-align: center; }
                    h1 { color: #c1121f; font-size: 1.8rem; }
                    .btn { display: inline-block; padding: 0.8rem 2rem; background: #c1121f; color: white; border: 3px solid #1a1a1a; cursor: pointer; font-family: monospace; font-size: 1rem; font-weight: bold; margin-top: 1rem; box-shadow: 5px 5px 0 #1a1a1a; }
                    .btn:active { transform: translate(4px, 4px); box-shadow: 1px 1px 0 #1a1a1a; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>🔒 VERIFIKASI</h1>
                    <p style="color: #8a7f75;">Klik tombol di bawah</p>
                    <button class="btn" onclick="verify()">✓ Verifikasi</button>
                    <script>
                        function verify() {
                            const btn = document.querySelector('.btn');
                            btn.disabled = true;
                            btn.textContent = '⏳ ...';
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

// Confirm verification
app.post('/verify/confirm', (req: Request, res: Response) => {
    setVerified(req, res);
    res.json({ status: true, message: 'Verifikasi berhasil' });
});

// ============ HEALTH ============
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: formatUptime(os.uptime()),
        verified: isVerified(req)
    });
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
                    model: cpus[0]?.model || 'Unknown',
                    speed: `${cpus[0]?.speed || 0} MHz`,
                    cores: cpus.length,
                    load: os.loadavg()[0]?.toFixed(2) || '0'
                }
            },
            requests: recentRequests
        });
    } catch (e) {
        res.status(500).json({ status: false });
    }
});

app.get('/stats', requireVerification, (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'stats.html'));
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

// Landing
app.get('/', requireVerification, (req: Request, res: Response) => {
    incrementVisitor();
    res.sendFile(path.join(publicPath, 'landing.html'));
});

// Docs
app.get('/docs', requireVerification, (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'docs.html'));
});

// Dimsz-AI
app.get('/dimsz-ai', requireVerification, (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'dimsz-ai.html'));
});

// ============ 404 ============
app.use((req: Request, res: Response) => {
    if (req.accepts('html')) {
        const possible404 = [
            path.join(publicPath, '404.html'),
            path.join(__dirname, 'public', '404.html')
        ];
        for (const p of possible404) { 
            if (fs.existsSync(p)) return res.status(404).sendFile(p);
        }
    }
    res.status(404).json({ 
        status: false, 
        creator: config.settings.creator, 
        message: "Route not found" 
    });
});

// ============ INIT ============
try {
    initAutoLoad(app, config, configPath);
} catch (e) {
    console.log('⚠️ AutoLoad skipped');
}

// ============ START ============
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════╗
    ║   ⚡ Dimsz-Api Server Started ⚡              ║
    ╠═══════════════════════════════════════════════╣
    ║   Port    : ${PORT}                              ║
    ║   Status  : 🟢 Online                          ║
    ║   Mode    : ${process.env.NODE_ENV || 'development'}${' '.padEnd(40 - (process.env.NODE_ENV || 'development').length)}║
    ╠═══════════════════════════════════════════════╣
    ║   📍 http://localhost:${PORT}/                  ║
    ║   📍 http://localhost:${PORT}/verify            ║
    ╚═══════════════════════════════════════════════╝
    `);
});

export default app;
