import { SmsOptions, SmsProvider, SmsSendResult } from '../types.js';

export interface Fast2SmsConfig {
  apiKey: string;
  senderId?: string;
}

export class Fast2SmsProvider implements SmsProvider {
  readonly name = 'fast2sms';
  private config: Fast2SmsConfig;

  constructor(config: Fast2SmsConfig) {
    this.config = config;
  }

  async sendOtp(mobileNumber: string, otpCode: string, _options?: SmsOptions): Promise<SmsSendResult> {
    if (!this.config.apiKey) {
      return {
        success: false,
        provider: this.name,
        error: 'FAST2SMS_API_KEY is not configured',
        timestamp: new Date(),
      };
    }

    try {
      const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: this.config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variables_values: otpCode,
          route: 'otp',
          numbers: cleanMobile,
        }),
      });

      const data: any = await response.json();
      if (!response.ok || !data.return) {
        return {
          success: false,
          provider: this.name,
          error: data.message?.[0] || data.message || 'Fast2SMS dispatch failed',
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        messageId: data.request_id || `f2s-${Date.now()}`,
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        error: err?.message || 'Fast2SMS network error',
        timestamp: new Date(),
      };
    }
  }

  async sendTransactional(mobileNumber: string, message: string, options?: SmsOptions): Promise<SmsSendResult> {
    if (!this.config.apiKey) {
      return {
        success: false,
        provider: this.name,
        error: 'FAST2SMS_API_KEY is not configured',
        timestamp: new Date(),
      };
    }

    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          authorization: this.config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sender_id: options?.senderId || this.config.senderId || 'TXTIND',
          language: 'english',
          route: 'v3',
          numbers: mobileNumber,
        }),
      });

      const data: any = await response.json();
      if (!response.ok || !data.return) {
        return {
          success: false,
          provider: this.name,
          error: data.message?.[0] || data.message || 'Fast2SMS dispatch failed',
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        messageId: data.request_id || `f2s-${Date.now()}`,
        provider: this.name,
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        error: err?.message || 'Fast2SMS network error',
        timestamp: new Date(),
      };
    }
  }
}
