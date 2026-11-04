import { SmsProvider } from './types.js';
import { BaileysWhatsAppProvider } from './providers/baileys.provider.js';
import { Msg91SmsProvider } from './providers/msg91.provider.js';
import { env } from '../../config/env.js';

let activeProviderInstance: SmsProvider | null = null;
let msg91Instance: Msg91SmsProvider | null = null;
let baileysInstance: BaileysWhatsAppProvider | null = null;

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

function getBaileysProvider(): BaileysWhatsAppProvider {
  if (!baileysInstance) {
    baileysInstance = new BaileysWhatsAppProvider({
      authDir: env.WHATSAPP_BAILEYS_AUTH_DIR,
      autoConnect: env.NODE_ENV !== 'test',
    });
  }
  return baileysInstance;
}

export class SmsProviderFactory {
  /**
   * Authoritative OTP provider resolver.
   * Primary provider is WhatsApp via Baileys.
   */
  static getProvider(channel: string = 'WHATSAPP'): SmsProvider {
    if (activeProviderInstance) {
      return activeProviderInstance;
    }

    // Only route to MSG91 if explicitly requested as SMS AND MSG91 is configured
    if (channel.toUpperCase() === 'SMS' && env.MSG91_AUTH_KEY && env.MSG91_AUTH_KEY.trim()) {
      return getMsg91Provider();
    }

    // Default primary provider is direct WhatsApp Baileys
    return getBaileysProvider();
  }

  static setProvider(provider: SmsProvider, _channel: string = 'WHATSAPP') {
    activeProviderInstance = provider;
  }

  static reset() {
    activeProviderInstance = null;
    msg91Instance = null;
    if (baileysInstance) {
      baileysInstance.disconnect().catch(() => {});
      baileysInstance = null;
    }
  }
}
