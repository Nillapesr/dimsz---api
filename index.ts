import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { loadRouter, initAutoLoad } from './src/autoload';

const app: Application = express();
const PORT = process.env.PORT || 2165;

app.set('trust proxy', true);

// Config path detection
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

// Database & Helpers
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
        const ignored = ['/stats', '/stats/data', '/src', '/docs', '/config', '/favicon.ico', '/', '/dimsz-ai'];
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
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/src', express.static(path.join(process.cwd(), 'src')));

// Load routers
loadRouter(app, config);

// ========== ROUTES ==========

// Stats data
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

// Stats page
app.get('/stats', (req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), 'public', 'stats.html'));
});

// Config API
app.get('/config', (req: Request, res: Response) => {
    try {
        const currentConfig = JSON.parse(JSON.stringify(config));
        currentConfig.settings.visitors = visit().toString();
        res.json({ creator: config.settings.creator, ...currentConfig });
    } catch (error) { 
        res.status(500).json({ creator: config.settings.creator, error: "Internal Server Error" }); 
    }
});

// ========== PAGE ROUTES ==========

// Landing page (Dashboard)
app.get('/', (req: Request, res: Response) => {
    incrementVisitor();
    res.sendFile(path.join(process.cwd(), 'public', 'landing.html'));
});

// Documentation
app.get('/docs', (req: Request, res: Response) => { 
    res.sendFile(path.join(process.cwd(), 'public', 'docs.html')); 
});

// ====== TAMBAHAN: Dimsz-AI Page ======
app.get('/dimsz-ai', (req: Request, res: Response) => {
    const aiPagePath = path.join(process.cwd(), 'public', 'dimsz-ai.html');
    if (fs.existsSync(aiPagePath)) {
        res.sendFile(aiPagePath);
    } else {
        // Fallback jika file belum dibuat
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Dimsz-AI</title>
                <style>
                    body {
                        background: #ece6df;
                        font-family: 'Courier New', monospace;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        padding: 1rem;
                    }
                    .container {
                        background: #f5f0eb;
                        border: 4px solid #1a1a1a;
                        box-shadow: 12px 12px 0 0 #1a1a1a;
                        padding: 2rem;
                        max-width: 500px;
                        text-align: center;
                    }
                    h1 {
                        font-size: 2rem;
                        color: #c1121f;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                    }
                    .divider {
                        height: 4px;
                        background: #1a1a1a;
                        width: 60px;
                        margin: 0.5rem auto;
                    }
                    .btn {
                        display: inline-block;
                        padding: 0.75rem 2rem;
                        background: #c1121f;
                        color: #f5f0eb;
                        border: 3px solid #1a1a1a;
                        box-shadow: 5px 5px 0 0 #1a1a1a;
                        text-decoration: none;
                        font-weight: bold;
                        text-transform: uppercase;
                        font-size: 0.85rem;
                        transition: all 0.06s linear;
                        margin-top: 1rem;
                    }
                    .btn:active {
                        transform: translate(4px, 4px);
                        box-shadow: 1px 1px 0 0 #1a1a1a;
                    }
                    .btn-back {
                        background: #f5f0eb;
                        color: #1a1a1a;
                    }
                    .status {
                        display: inline-block;
                        background: #2b9348;
                        color: white;
                        padding: 0.2rem 1rem;
                        border: 2px solid #1a1a1a;
                        font-size: 0.7rem;
                        font-weight: bold;
                        text-transform: uppercase;
                    }
                    .error-icon {
                        font-size: 4rem;
                        margin: 1rem 0;
                        color: #c1121f;
                    }
                    .note {
                        color: #8a7f75;
                        font-size: 0.75rem;
                        margin-top: 1.5rem;
                        border-top: 2px solid #1a1a1a;
                        padding-top: 1rem;
                    }
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

// ========== 404 Handler ==========
app.use((req: Request, res: Response) => {
    if (req.accepts('html')) {
        const possible404 = [
            path.join(process.cwd(), 'public', '404.html'),
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

// Init auto-load
initAutoLoad(app, config, configPath);

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`📍 Landing: http://localhost:${PORT}/`);
    console.log(`📍 Docs: http://localhost:${PORT}/docs`);
    console.log(`📍 Stats: http://localhost:${PORT}/stats`);
    console.log(`📍 Dimsz-AI: http://localhost:${PORT}/dimsz-ai`);
});

export default app;
