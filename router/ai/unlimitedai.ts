import { Request, Response } from 'express';
import https from 'https';
import crypto from 'crypto';

interface UnlimitedAIScraperOptions {
  locale?: string;
  deviceId?: string;
  chatId?: string;
  sessionCookie?: string | null;
  userAgent?: string;
  model?: string;
}

interface MessagePart {
  type: 'text';
  text: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parts: MessagePart[];
  createdAt: string;
}

interface RequestBody {
  chatId: string;
  messages: Message[];
  selectedChatModel: string;
  selectedCharacter: null;
  selectedStory: null;
  deviceId: string;
  locale: string;
}

interface StreamResponse {
  type: string;
  delta?: string;
  [key: string]: any;
}

class UnlimitedAIScraper {
  private baseUrl: string = 'app.unlimitedai.chat';
  private apiPath: string = '/api/chat';
  private locale: string;
  private deviceId: string;
  private chatId: string;
  private sessionCookie: string | null;
  private userAgent: string;
  private selectedModel: string;

  constructor(options: UnlimitedAIScraperOptions = {}) {
    this.locale = options.locale || 'id';
    this.deviceId = options.deviceId || crypto.randomUUID();
    this.chatId = options.chatId || crypto.randomUUID();
    this.sessionCookie = options.sessionCookie || null;
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Android 14; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0';
    this.selectedModel = options.model || 'chat-model-reasoning';
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-next-intl-locale': this.locale,
      'User-Agent': this.userAgent,
      'Referer': `https://app.unlimitedai.chat/${this.locale}`,
      'Accept': 'application/json',
      'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Origin': 'https://app.unlimitedai.chat',
      'Connection': 'keep-alive',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
      'DNT': '1'
    };

    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    }

    return headers;
  }

  private buildRequestBody(prompt: string): RequestBody {
    const timestamp = new Date().toISOString();

    return {
      chatId: this.chatId,
      messages: [
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: prompt,
          parts: [{ type: 'text', text: prompt }],
          createdAt: timestamp
        },
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          parts: [{ type: 'text', text: '' }],
          createdAt: timestamp
        }
      ],
      selectedChatModel: this.selectedModel,
      selectedCharacter: null,
      selectedStory: null,
      deviceId: this.deviceId,
      locale: this.locale
    };
  }

  private parseCookies(responseHeaders: Record<string, string | string[] | undefined>): string | null {
    const setCookieHeaders = responseHeaders['set-cookie'];
    if (!setCookieHeaders) return null;
    if (Array.isArray(setCookieHeaders)) {
      return setCookieHeaders.map(c => c.split(';')[0]).join('; ');
    }
    return setCookieHeaders.split(';')[0];
  }

  private parseStreamResponse(rawData: string): StreamResponse[] {
    return rawData
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line) as StreamResponse; } 
        catch { return null; }
      })
      .filter((item): item is StreamResponse => item !== null);
  }

  private extractText(data: StreamResponse[]): string {
    return data
      .filter(item => item.type === 'delta' && item.delta)
      .map(item => item.delta || '')
      .join('');
  }

  public async sendRequest(prompt: string): Promise<{
    success: boolean;
    statusCode: number;
    data: StreamResponse[] | any;
  }> {
    const body = JSON.stringify(this.buildRequestBody(prompt));
    const headers = this.buildHeaders();

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: this.baseUrl,
          port: 443,
          path: this.apiPath,
          method: 'POST',
          headers,
          timeout: 30000
        },
        (res) => {
          let raw = '';

          const cookies = this.parseCookies(res.headers);
          if (cookies) this.sessionCookie = cookies;

          res.on('data', (chunk: Buffer) => { 
            raw += chunk.toString(); 
          });

          res.on('end', () => {
            const parsed = this.parseStreamResponse(raw);
            const isDelta = parsed.length > 0 && parsed[0].type === 'delta';

            if (isDelta) {
              resolve({
                success: res.statusCode === 200,
                statusCode: res.statusCode || 200,
                data: parsed
              });
            } else {
              try {
                resolve({
                  success: res.statusCode === 200,
                  statusCode: res.statusCode || 200,
                  data: JSON.parse(raw)
                });
              } catch {
                resolve({
                  success: false,
                  statusCode: res.statusCode || 500,
                  data: null
                });
              }
            }
          });
        }
      );

      req.on('error', (error: Error) => { 
        reject({ success: false, error: error.message }); 
      });
      
      req.on('timeout', () => { 
        req.destroy(); 
        reject({ success: false, error: 'Request timeout' }); 
      });

      req.write(body);
      req.end();
    });
  }

  public getChatId(): string {
    return this.chatId;
  }
}

export default async function handler(req: Request, res: Response) {
  const { q, session } = req.query;

  if (!q) {
    return res.status(400).json({
      status: false,
      message: "Parameter 'q' (pertanyaan) diperlukan"
    });
  }

  try {
    const scraper = new UnlimitedAIScraper({
      locale: 'id',
      model: 'chat-model-reasoning',
      chatId: session as string || crypto.randomUUID()
    });

    const response = await scraper.sendRequest(q as string);
    const text = scraper.extractText(response.data);

    res.json({
      status: true,
      chatId: scraper.getChatId(),
      prompt: q,
      result: text || response.data.message || 'Tidak ada respons',
      source: 'UnlimitedAI'
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      message: error.message || 'Gagal mendapatkan respons dari AI'
    });
  }
}
