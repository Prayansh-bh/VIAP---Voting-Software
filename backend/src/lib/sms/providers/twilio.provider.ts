import { SmsOptions, SmsProvider, SmsSendResult } from '../types.js';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  whatsappNumber?: string;
  serviceSid?: string;
  contentSid?: string;
  isWhatsApp?: boolean;
}

export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  private config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
  }

  async sendOtp(mobileNumber: string, otpCode: string, options?: SmsOptions): Promise<SmsSendResult> {
    const isWhatsApp = this.config.isWhatsApp || (options as any)?.channel?.toUpperCase() === 'WHATSAPP';
    const message = `Your Kondapi TDP Connect verification code is ${otpCode}. Valid for 5 minutes.`;
    return this.sendTransactional(mobileNumber, message, { ...(options || {}), channel: isWhatsApp ? 'WHATSAPP' : 'SMS', otpCode } as any);
  }

  async sendTransactional(mobileNumber: string, message: string, options?: SmsOptions): Promise<SmsSendResult> {
    const isWhatsApp = this.config.isWhatsApp || (options as any)?.channel?.toUpperCase() === 'WHATSAPP';
    const defaultSender = isWhatsApp ? (this.config.whatsappNumber || '+17372508034') : (this.config.fromNumber || this.config.serviceSid);
    
    if (!this.config.accountSid || !this.config.authToken || !defaultSender) {
      return {
        success: false,
        provider: this.name,
        error: 'Twilio credentials not configured (Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER or TWILIO_WHATSAPP_NUMBER)',
        timestamp: new Date(),
      };
    }

    try {
      const cleanDigits = mobileNumber.replace(/\D/g, '').slice(-10);
      const rawTo = `+91${cleanDigits}`;
      const formattedTo = isWhatsApp ? `whatsapp:${rawTo}` : rawTo;

      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');

      const paramsObj: Record<string, string> = {
        To: formattedTo,
      };

      const otpCode = (options as any)?.otpCode;
      if (isWhatsApp && this.config.contentSid) {
        paramsObj.ContentSid = this.config.contentSid;
        paramsObj.ContentVariables = JSON.stringify({ '1': otpCode || '123456' });
      } else {
        paramsObj.Body = message;
      }

      if (!isWhatsApp && this.config.serviceSid) {
        paramsObj.MessagingServiceSid = this.config.serviceSid;
      } else {
        const rawSender = isWhatsApp
          ? (this.config.whatsappNumber || '+17372508034')
          : (this.config.fromNumber || '+17372508034');
        paramsObj.From = isWhatsApp && !rawSender.startsWith('whatsapp:')
          ? `whatsapp:${rawSender}`
          : rawSender;
      }

      const params = new URLSearchParams(paramsObj);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data: any = await response.json();
      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          error: data.message || `Twilio error code ${data.code}`,
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        messageId: data.sid,
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        error: err?.message || 'Twilio network request failed',
        timestamp: new Date(),
      };
    }
  }
}
