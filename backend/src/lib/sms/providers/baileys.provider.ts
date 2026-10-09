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
  private reconnectTimer: NodeJS.Timeout | null = null;
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
   * Initializes or re-establishes the Baileys WhatsApp Web socket.
   */
  async initialize(): Promise<WASocket> {
    if (this.sock && this.isConnected) {
      return this.sock;
    }

    if (this.isInitializing && this.sock) {
      return this.sock;
    }

    this.isInitializing = true;

    try {
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

      sock.ev.on('creds.update', saveCreds);

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
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              this.initialize().catch((err) => {
                console.error('[WHATSAPP BAILEYS] Reconnection attempt failed:', err?.message);
              });
            }, 5000);
          } else {
            console.warn('[WHATSAPP BAILEYS] WhatsApp device logged out. Clearing stored credentials to present fresh QR...');
            try {
              if (fs.existsSync(this.authDir)) {
                fs.rmSync(this.authDir, { recursive: true, force: true });
              }
            } catch (cleanupErr) {
              console.error('[WHATSAPP BAILEYS] Failed to remove credentials directory:', cleanupErr);
            }

            setTimeout(() => {
              this.initialize().catch((err) => {
                console.error('[WHATSAPP BAILEYS] Fresh initialization failed:', err?.message);
              });
            }, 3000);
          }
        }
      });

      return sock;
    } catch (err: any) {
      this.isInitializing = false;
      console.error('[WHATSAPP BAILEYS] Initialization error:', err);
      throw err;
    }
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
      console.warn(` 📱 Recipient : +${recipientDigits}`);
      console.warn(` 🔑 OTP Code  : ${otpCode}`);
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
            console.warn(`[WHATSAPP BAILEYS] Recipient +${recipientDigits} is not registered on WhatsApp.`);
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
      console.warn(`[WHATSAPP BAILEYS] onWhatsApp check notice for +${recipientDigits}:`, checkErr?.message);
    }

    const messageText = `🔒 *Kondapi Verification Code*\n\nYour OTP is: *${otpCode}*\n\nValid for 5 minutes. Do not share this code with anyone.`;

    try {
      const result = await this.sock.sendMessage(jid, { text: messageText });
      const messageId = result?.key?.id || `baileys-${Date.now()}`;
      console.log(`[WHATSAPP BAILEYS] ✅ OTP dispatched to +${recipientDigits} (JID: ${jid}, Message ID: ${messageId})`);
      return {
        success: true,
        messageId,
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (err: any) {
      console.error(`[WHATSAPP BAILEYS] ❌ Failed to dispatch OTP to +${recipientDigits}:`, err?.message);
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
    console.log(` 3. Tap "Link a Device" and point your camera at this QR code:`);
    console.log(`${divider}\n`);
    qrcode.generate(qr, { small: true });
    console.log(`\n${divider}\n`);
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
        this.sock.end(undefined);
      } catch {}
      this.sock = null;
      this.isConnected = false;
    }
  }
}
