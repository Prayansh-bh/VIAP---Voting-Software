import { SmsOptions, SmsProvider, SmsSendResult } from '../types.js';

export interface Msg91Config {
  authKey: string;
  templateId?: string;
  senderId?: string;
  timeoutMs?: number;
}

export class Msg91SmsProvider implements SmsProvider {
  readonly name = 'msg91';
  private config: Msg91Config;

  constructor(config: Msg91Config) {
    this.config = config;
  }

  async sendOtp(mobileNumber: string, otpCode: string, options?: SmsOptions): Promise<SmsSendResult> {
    const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
    if (!this.config.authKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`\n══════════════════════════════════════════════════════════════`);
        console.log(`📱 [MSG91 DEV SIMULATION] OTP Dispatched to +91 ${cleanMobile}`);
        console.log(`🔑 Verification Code: ${otpCode}`);
        console.log(`⚡ (Set MSG91_AUTH_KEY in backend/.env to dispatch real SMS / WhatsApp)`);
        console.log(`══════════════════════════════════════════════════════════════\n`);
        return {
          success: true,
          messageId: `dev-sim-${Date.now()}`,
          provider: this.name,
          timestamp: new Date(),
        };
      }
      return {
        success: false,
        provider: this.name,
        error: 'MSG91_AUTH_KEY is not configured',
        timestamp: new Date(),
      };
    }

    try {
      const templateId = options?.templateId || this.config.templateId;
      const formattedMobile = `91${cleanMobile}`;
      const timeoutMs = this.config.timeoutMs || 5000;

      // Official MSG91 API v5: template_id and mobile in query params, authkey in header, OTP in JSON body
      const url = new URL('https://control.msg91.com/api/v5/otp');
      if (templateId) {
        url.searchParams.set('template_id', templateId);
      }
      url.searchParams.set('mobile', formattedMobile);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          authkey: this.config.authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          OTP: otpCode,
          otp: otpCode,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const data: any = await response.json().catch(() => ({}));
      if (!response.ok || data.type === 'error') {
        return {
          success: false,
          provider: this.name,
          error: data.message || 'MSG91 OTP dispatch failed',
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        messageId: data.message || `msg91-${Date.now()}`,
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      return {
        success: false,
        provider: this.name,
        error: isTimeout ? 'MSG91 request timed out' : (err?.message || 'MSG91 network request error'),
        timestamp: new Date(),
      };
    }
  }

  async sendTransactional(mobileNumber: string, message: string, options?: SmsOptions): Promise<SmsSendResult> {
    if (!this.config.authKey) {
      return {
        success: false,
        provider: this.name,
        error: 'MSG91_AUTH_KEY is not configured',
        timestamp: new Date(),
      };
    }

    try {
      const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
      const formattedMobile = `91${cleanMobile}`;
      const sender = options?.senderId || this.config.senderId || 'KNDTDP';
      const timeoutMs = this.config.timeoutMs || 5000;

      const response = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          authkey: this.config.authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: options?.templateId || this.config.templateId,
          sender,
          short_url: '0',
          recipients: [
            {
              mobiles: formattedMobile,
              message,
            },
          ],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const data: any = await response.json().catch(() => ({}));
      if (!response.ok || data.type === 'error') {
        return {
          success: false,
          provider: this.name,
          error: data.message || 'MSG91 flow message failed',
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        messageId: data.message || `msg91-${Date.now()}`,
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (err: any) {
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      return {
        success: false,
        provider: this.name,
        error: isTimeout ? 'MSG91 request timed out' : (err?.message || 'MSG91 network request error'),
        timestamp: new Date(),
      };
    }
  }
}
