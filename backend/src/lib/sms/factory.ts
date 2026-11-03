import { SmsOptions, SmsProvider, SmsSendResult } from './types.js';
import { BaileysWhatsAppProvider } from './providers/baileys.provider.js';
import { Msg91SmsProvider } from './providers/msg91.provider.js';
import { env } from '../../config/env.js';

let activeProviderInstance: SmsProvider | null = null;
let msg91Instance: Msg91SmsProvider | null = null;

function getMsg91Provider(): Msg91SmsProvider {
  if (!msg91Instance) {
    msg91Instance = new Msg91SmsProvider({
      authKey: env.MSG91_AUTH_KEY || '',
      templateId: env.MSG91_TEMPLATE_ID,
      senderId: env.SMS_SENDER_ID || 'KNDTDP',
      timeoutMs: 5000,
    });
  }
  return msg91Instance;
}

export class SmsProviderFactory {
  /**
   * Returns a resilient OTP provider:
   * - If channel is SMS, routes directly to MSG91.
   * - If channel is WHATSAPP, sends via Baileys and auto-falls back to MSG91 if offline/disconnected.
   */
  static getProvider(channel: string = 'WHATSAPP'): SmsProvider {
    if (activeProviderInstance) {
      return activeProviderInstance;
    }

    const fallbackSms = getMsg91Provider();
    if (channel.toUpperCase() === 'SMS') {
      return fallbackSms;
    }

    const baileys = new BaileysWhatsAppProvider();

    // Composite provider with automatic SMS gateway fallback
    const resilientProvider: SmsProvider = {
      name: 'baileys-with-sms-fallback',
      async sendOtp(mobileNumber: string, otpCode: string, options?: SmsOptions): Promise<SmsSendResult> {
        const status = baileys.getStatus();
        if (status.isConnected) {
          try {
            const result = await baileys.sendOtp(mobileNumber, otpCode, options);
            if (result.success) {
              return result;
            }
            console.warn('[OTP Gateway] Baileys dispatch failed, triggering SMS fallback:', result.error);
          } catch (err: any) {
            console.warn('[OTP Gateway] Baileys thrown exception, triggering SMS fallback:', err.message);
          }
        } else {
          console.log('[OTP Gateway] WhatsApp socket not connected. Routing OTP via SMS gateway fallback.');
        }

        // Automatic fallback to MSG91 SMS gateway
        return fallbackSms.sendOtp(mobileNumber, otpCode, options);
      },

      async sendTransactional(mobileNumber: string, message: string, options?: SmsOptions): Promise<SmsSendResult> {
        const status = baileys.getStatus();
        if (status.isConnected) {
          try {
            const result = await baileys.sendTransactional(mobileNumber, message, options);
            if (result.success) {
              return result;
            }
          } catch (err: any) {
            console.warn('[OTP Gateway] Baileys transactional dispatch failed, falling back:', err.message);
          }
        }
        return fallbackSms.sendTransactional(mobileNumber, message, options);
      },
    };

    activeProviderInstance = resilientProvider;
    return activeProviderInstance;
  }

  static setProvider(provider: SmsProvider, _channel: string = 'WHATSAPP') {
    activeProviderInstance = provider;
  }

  static reset() {
    activeProviderInstance = null;
    msg91Instance = null;
  }
}
