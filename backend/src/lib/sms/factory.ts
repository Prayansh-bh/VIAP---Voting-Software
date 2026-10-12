import { SmsProvider } from './types.js';
import { BaileysWhatsAppProvider } from './providers/baileys.provider.js';

let activeProviderInstance: SmsProvider | null = null;

export class SmsProviderFactory {
  /**
   * Returns the unified Baileys WhatsApp OTP provider.
   * All authentication channels route exclusively through Baileys.
   */
  static getProvider(_channel: string = 'WHATSAPP'): SmsProvider {
    if (activeProviderInstance) {
      return activeProviderInstance;
    }

    activeProviderInstance = new BaileysWhatsAppProvider();
    return activeProviderInstance;
  }

  static setProvider(provider: SmsProvider, _channel: string = 'WHATSAPP') {
    activeProviderInstance = provider;
  }

  static reset() {
    activeProviderInstance = null;
  }
}

