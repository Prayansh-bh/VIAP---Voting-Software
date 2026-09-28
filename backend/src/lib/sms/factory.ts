import { SmsProvider } from './types.js';
import { Msg91SmsProvider } from './providers/msg91.provider.js';

let activeProviderInstance: SmsProvider | null = null;

export class SmsProviderFactory {
  static getProvider(): SmsProvider {
    if (activeProviderInstance) {
      return activeProviderInstance;
    }

    activeProviderInstance = new Msg91SmsProvider({
      authKey: process.env.MSG91_AUTH_KEY || process.env.SMS_API_KEY || '',
      templateId: process.env.MSG91_TEMPLATE_ID || process.env.SMS_TEMPLATE_ID || '',
      senderId: process.env.SMS_SENDER_ID || 'KNDTDP',
      timeoutMs: 5000,
    });

    return activeProviderInstance;
  }

  static setProvider(provider: SmsProvider) {
    activeProviderInstance = provider;
  }

  static reset() {
    activeProviderInstance = null;
  }
}
