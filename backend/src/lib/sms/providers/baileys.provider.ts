import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  type WASocket,
  type ConnectionState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import { SmsOptions, SmsProvider, SmsSendResult } from '../types.js';
import { prisma } from '../../prisma.js';

export interface BaileysConfig {
  authDir?: string;
  autoConnect?: boolean;
}

export class BaileysWhatsAppProvider implements SmsProvider {
  readonly name = 'baileys';

  private sock: WASocket | null = null;
  private isConnected = false;
  private currentQr: string | null = null;
  private isInitializing = false;
  private initPromise: Promise<WASocket> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isSessionOwner = false;
  private saveCredsQueue: Promise<void> = Promise.resolve();
  private readonly authDir: string;

  constructor(config?: BaileysConfig) {
    this.authDir = config?.authDir || process.env.WHATSAPP_BAILEYS_AUTH_DIR || path.resolve(process.cwd(), '.baileys_auth');

    // Only auto-connect if explicitly requested; server.ts handles lifecycle on startup
    if (config?.autoConnect) {
      this.initialize().catch((err) => {
        console.warn('[BaileysWhatsAppProvider] Initial connection attempt deferred:', err?.message);
      });
    }
  }

  /**
   * Acquire a PostgreSQL session-level advisory lock to guarantee only a single
   * application instance actively controls the WhatsApp Baileys session.
   */
  async acquireSessionLock(): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      this.isSessionOwner = true;
      return true;
    }
    try {
      const res = await prisma.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_lock(${88299104}::bigint) AS acquired
      `;
      this.isSessionOwner = Boolean(res?.[0]?.acquired);
      return this.isSessionOwner;
    } catch (err: any) {
      console.warn('[WHATSAPP BAILEYS] Advisory lock notice, assuming single instance:', err?.message);
      this.isSessionOwner = true;
      return true;
    }
  }

  async releaseSessionLock(): Promise<void> {
    if (process.env.NODE_ENV === 'test' || !this.isSessionOwner) {
      this.isSessionOwner = false;
      return;
    }
    try {
      await prisma.$queryRaw`
        SELECT pg_advisory_unlock(${88299104}::bigint)
      `;
    } catch {}
    this.isSessionOwner = false;
  }

  /**
   * Initializes or re-establishes the Baileys WhatsApp Web socket.
   */
  async initialize(): Promise<WASocket> {
    if (this.sock && this.isConnected) {
      return this.sock;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      // 1. Single-instance ownership guard: only one backend instance can hold the session
      const hasLock = await this.acquireSessionLock();
      if (!hasLock) {
        console.warn(
          '[WHATSAPP BAILEYS] Another application instance holds the active WhatsApp session lock. Running in standby mode.'
        );
        throw new Error('WhatsApp session is active on another application instance.');
      }

      this.isInitializing = true;
      try {
        // Clean up previous socket instance before re-creating
        if (this.sock) {
          try {
            this.sock.ev.removeAllListeners('connection.update');
            this.sock.ev.removeAllListeners('creds.update');
            this.sock.end(undefined);
          } catch {}
          this.sock = null;
        }

        if (!fs.existsSync(this.authDir)) {
          fs.mkdirSync(this.authDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

        const logger = pino({
          level: (process.env.BAILEYS_LOG_LEVEL || 'silent') as any,
        });

        const sock = makeWASocket({
          auth: state,
          logger,
          printQRInTerminal: false,
          browser: Browsers.ubuntu('Chrome'),
          syncFullHistory: false,
          connectTimeoutMs: 60000,
          defaultQueryTimeoutMs: 60000,
        });

        this.sock = sock;

        // Serialize credential updates to prevent concurrent write corruption
        sock.ev.on('creds.update', () => {
          this.saveCredsQueue = this.saveCredsQueue
            .then(async () => {
              try {
                await saveCreds();
              } catch (err: any) {
                console.error('[WHATSAPP BAILEYS] Failed to persist credentials:', err?.message);
              }
            })
            .catch(() => {});
        });

        sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
          const { connection, lastDisconnect, qr } = update;

          if (qr) {
            this.currentQr = qr;
            this.printTerminalQr(qr);
          }

          if (connection === 'open') {
            this.isConnected = true;
            this.currentQr = null;
            this.isInitializing = false;
            this.reconnectAttempts = 0;
            if (this.reconnectTimer) {
              clearTimeout(this.reconnectTimer);
              this.reconnectTimer = null;
            }
            const userJid = sock.user?.id || 'Connected Phone';
            console.log(`\n======================================================================`);
            console.log(` ✅ [WHATSAPP BAILEYS ACTIVE]`);
            console.log(` 📱 WhatsApp session linked and active for user: ${userJid}`);
            console.log(` 💬 Outgoing OTPs will be sent via this WhatsApp session.`);
            console.log(`======================================================================\n`);
          }

          if (connection === 'close') {
            this.isConnected = false;
            this.isInitializing = false;

            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.warn(
              `[WHATSAPP BAILEYS] Connection closed (statusCode: ${statusCode || 'unknown'}, reconnectable: ${shouldReconnect})`
            );

            if (shouldReconnect) {
              this.scheduleReconnect();
            } else {
              console.warn('[WHATSAPP BAILEYS] WhatsApp device logged out. Clearing stored credentials to present fresh QR...');
              this.reconnectAttempts = 0;
              try {
                if (fs.existsSync(this.authDir)) {
                  fs.rmSync(this.authDir, { recursive: true, force: true });
                }
              } catch (cleanupErr) {
                console.error('[WHATSAPP BAILEYS] Failed to remove credentials directory:', cleanupErr);
              }

              this.scheduleReconnect(3000);
            }
          }
        });

        return sock;
      } finally {
        this.isInitializing = false;
      }
    })();

    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private scheduleReconnect(fixedDelay?: number): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    let delay = fixedDelay;
    if (delay === undefined) {
      this.reconnectAttempts += 1;
      const baseDelay = 2000;
      const maxDelay = 60000;
      const jitter = Math.floor(Math.random() * 1000);
      delay = Math.min(maxDelay, baseDelay * Math.pow(1.5, Math.min(this.reconnectAttempts, 8))) + jitter;
    }

    console.log(`[WHATSAPP BAILEYS] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initialize().catch((err) => {
        console.error('[WHATSAPP BAILEYS] Reconnection attempt failed:', err?.message);
      });
    }, delay);
  }

  /**
   * Dispatches an OTP verification message to the given mobile number over WhatsApp.
   */
  async sendOtp(mobileNumber: string, otpCode: string, _options?: SmsOptions): Promise<SmsSendResult> {
    const cleanNumber = mobileNumber.replace(/\D/g, '');
    const recipientDigits = cleanNumber.startsWith('91') && cleanNumber.length > 10
      ? cleanNumber
      : (cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber);
    let jid = `${recipientDigits}@s.whatsapp.net`;

    if (!this.sock || !this.isConnected) {
      if (!this.sock && !this.isInitializing && process.env.NODE_ENV !== 'test') {
        this.initialize().catch(() => {});
      }

      console.warn(`\n⚠️  [WHATSAPP BAILEYS NOT LINKED]`);
      console.warn(` 📱 Recipient : +${recipientDigits.slice(0, 4)}****${recipientDigits.slice(-2)}`);
      console.warn(` 🔑 OTP Code  : [REDACTED]`);
      console.warn(` 📌 Notice    : Please scan the QR code in the server terminal or at /api/auth/whatsapp/qr.`);
      console.warn(`──────────────────────────────────────────────────────────────────────\n`);

      return {
        success: false,
        error: 'WhatsApp Web session is not linked yet. Please scan the QR code at /api/auth/whatsapp/qr.',
        provider: this.name,
        timestamp: new Date(),
      };
    }

    // Verify recipient on WhatsApp and resolve authoritative JID
    try {
      if (this.sock.onWhatsApp) {
        const [waAccount] = (await this.sock.onWhatsApp(recipientDigits)) || [];
        if (waAccount) {
          if (!waAccount.exists) {
            console.warn(`[WHATSAPP BAILEYS] Recipient +${recipientDigits.slice(0, 4)}****${recipientDigits.slice(-2)} is not registered on WhatsApp.`);
            return {
              success: false,
              error: `Mobile number +${recipientDigits} is not registered on WhatsApp.`,
              provider: this.name,
              timestamp: new Date(),
            };
          }
          if (waAccount.jid) {
            jid = waAccount.jid;
          }
        }
      }
    } catch (checkErr: any) {
      console.warn(`[WHATSAPP BAILEYS] onWhatsApp check notice for +${recipientDigits.slice(0, 4)}****${recipientDigits.slice(-2)}:`, checkErr?.message);
    }

    const messageText = `🔒 *Kondapi Verification Code*\n\nYour OTP is: *${otpCode}*\n\nValid for 5 minutes. Do not share this code with anyone.`;

    try {
      const result = await this.sock.sendMessage(jid, { text: messageText });
      const messageId = result?.key?.id || `baileys-${Date.now()}`;
      console.log(`[WHATSAPP BAILEYS] ✅ OTP dispatched to +${recipientDigits.slice(0, 4)}****${recipientDigits.slice(-2)} (JID: ${jid}, Message ID: ${messageId})`);
      return {
        success: true,
        messageId,
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (err: any) {
      console.error(`[WHATSAPP BAILEYS] ❌ Failed to dispatch OTP to +${recipientDigits.slice(0, 4)}****${recipientDigits.slice(-2)}:`, err?.message);
      return {
        success: false,
        error: err?.message || 'Failed to send WhatsApp message',
        provider: this.name,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Dispatches transactional WhatsApp message.
   */
  async sendTransactional(mobileNumber: string, message: string, _options?: SmsOptions): Promise<SmsSendResult> {
    const cleanNumber = mobileNumber.replace(/\D/g, '');
    const recipientDigits = cleanNumber.startsWith('91') && cleanNumber.length > 10
      ? cleanNumber
      : (cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber);
    const jid = `${recipientDigits}@s.whatsapp.net`;

    if (!this.sock || !this.isConnected) {
      if (!this.sock && !this.isInitializing && process.env.NODE_ENV !== 'test') {
        this.initialize().catch(() => {});
      }

      return {
        success: false,
        error: 'WhatsApp Web session is not linked. Scan the QR code in the terminal.',
        provider: this.name,
        timestamp: new Date(),
      };
    }

    try {
      const result = await this.sock.sendMessage(jid, { text: message });
      return {
        success: true,
        messageId: result?.key?.id || `baileys-tx-${Date.now()}`,
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to send transactional message',
        provider: this.name,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Prints the QR code directly to the backend terminal for linking with WhatsApp mobile app.
   */
  private printTerminalQr(qr: string): void {
    const divider = '═'.repeat(68);
    console.log(`\n${divider}`);
    console.log(` 📲 [WHATSAPP BAILEYS QR CODE SCAN REQUIRED]`);
    console.log(` 1. Open WhatsApp on your phone.`);
    console.log(` 2. Tap Menu (⋮ on Android) or Settings (iPhone) > Linked Devices.`);
    console.log(` 3. Tap "Link a Device" and scan the QR code.`);
    console.log(`\n 💡 IF THIS TERMINAL CODE IS TOO LARGE OR DISTORTED ON YOUR SCREEN:`);
    console.log(` 👉 Open in your browser: /api/auth/whatsapp/qr`);
    console.log(`    (Includes adjustable sizes: 160px/220px/280px + phone number Pairing Code!)`);
    console.log(`${divider}\n`);
    try {
      qrcode.generate(qr, { small: true });
    } catch {}
    console.log(`\n${divider}\n`);
  }

  /**
   * Generates an 8-character pairing code for linking without camera / QR scan.
   */
  async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.sock) {
      await this.initialize();
    }
    if (this.isConnected) {
      throw new Error('WhatsApp is already connected.');
    }
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const recipientDigits = cleanNumber.startsWith('91') && cleanNumber.length > 10
      ? cleanNumber
      : (cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber);

    if (typeof (this.sock as any)?.requestPairingCode !== 'function') {
      throw new Error('Pairing code is not supported in the current socket state.');
    }

    const code = await (this.sock as any).requestPairingCode(recipientDigits);
    console.log(`\n🔑 [WHATSAPP PAIRING CODE]: ${code} for phone +${recipientDigits.slice(0, 4)}****${recipientDigits.slice(-2)}\n`);
    return code;
  }

  /**
   * Returns current connection and QR code status.
   */
  getStatus() {
    return {
      provider: this.name,
      isConnected: this.isConnected,
      hasQr: Boolean(this.currentQr),
      user: this.sock?.user?.id || null,
      isOwner: this.isSessionOwner,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Returns the raw QR code string if one is currently active, or null if connected.
   */
  getQrCode(): string | null {
    return this.currentQr;
  }

  /**
   * Graceful disconnection on server shutdown.
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.end(undefined);
      } catch {}
      this.sock = null;
      this.isConnected = false;
    }
    await this.releaseSessionLock();
  }
}
