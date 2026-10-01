import { SmsProvider } from './types.js';
import { Msg91SmsProvider } from './providers/msg91.provider.js';
import { Fast2SmsProvider } from './providers/fast2sms.provider.js';
import { TwilioSmsProvider } from './providers/twilio.provider.js';
import { WhatsAppCloudProvider } from './providers/whatsapp-cloud.provider.js';

let activeProviderInstance: SmsProvider | null = null;
let activeWhatsAppInstance: SmsProvider | null = null;

export class SmsProviderFactory {
  static getProvider(channel: string = 'SMS'): SmsProvider {
    const norm = (channel || 'SMS').toUpperCase();
    if (norm === 'WHATSAPP') {
      if (activeWhatsAppInstance) {
        return activeWhatsAppInstance;
      }
      
      const preferTwilio = process.env.WHATSAPP_PROVIDER === 'twilio' || (!process.env.WHATSAPP_ACCESS_TOKEN && Boolean(process.env.TWILIO_ACCOUNT_SID));
      if (preferTwilio && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        activeWhatsAppInstance = new TwilioSmsProvider({
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          authToken: process.env.TWILIO_AUTH_TOKEN,
          whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '+17372508034',
          contentSid: process.env.TWILIO_CONTENT_SID,
          isWhatsApp: true,
        });
        return activeWhatsAppInstance;
      }

      activeWhatsAppInstance = new WhatsAppCloudProvider();
      return activeWhatsAppInstance;
    }

    if (activeProviderInstance) {
      return activeProviderInstance;
    }

    const hasValidMsg91 = Boolean(process.env.MSG91_AUTH_KEY && !process.env.MSG91_AUTH_KEY.includes('your_live'));
    if (!hasValidMsg91 && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
      activeProviderInstance = new TwilioSmsProvider({
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER,
        isWhatsApp: false,
      });
      return activeProviderInstance;
    }

    if (!hasValidMsg91 && process.env.FAST2SMS_API_KEY) {
      activeProviderInstance = new Fast2SmsProvider({
        apiKey: process.env.FAST2SMS_API_KEY,
      });
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

  static setProvider(provider: SmsProvider, channel: string = 'SMS') {
    if (channel.toUpperCase() === 'WHATSAPP') {
      activeWhatsAppInstance = provider;
    } else {
      activeProviderInstance = provider;
    }
  }

  static reset() {
    activeProviderInstance = null;
    activeWhatsAppInstance = null;
  }
}
