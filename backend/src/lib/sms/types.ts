export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
  timestamp: Date;
}

export interface SmsOptions {
  senderId?: string;
  templateId?: string;
  entityId?: string;
  customParams?: Record<string, string>;
}

export interface SmsProvider {
  readonly name: string;
  sendOtp(mobileNumber: string, otpCode: string, options?: SmsOptions): Promise<SmsSendResult>;
  sendTransactional(mobileNumber: string, message: string, options?: SmsOptions): Promise<SmsSendResult>;
}
