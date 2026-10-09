import { FastifyReply, FastifyRequest } from 'fastify';
import { errorResponse, successResponse } from '../../common/response.js';
import { isOriginAllowed } from '../../common/origin.js';
import { AuthService } from './auth.service.js';
import { RequestOtpDto, RegisterOtpDto, VerifyRegisterOtpDto, VerifyOtpDto, DeviceSessionDto, DemoLoginDto } from './auth.schema.js';

export class AuthController {
  /**
   * Fast 1-Click Demo Authentication for reviewers, clients, and testing.
   * Authorizes the device and creates an active session for the chosen role without requiring OTP.
   */
  static async demoLogin(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as DemoLoginDto;
    try {
      const result = await AuthService.authenticateDemoRole(body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      reply.setCookie('access_token', result.token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400,
      });

      reply.setCookie('refresh_token', result.refreshToken, {
        path: '/api/auth',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 86400,
      });

      return reply.status(200).send(successResponse(result, 'Demo authentication successful.'));
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      return reply.status(statusCode).send(errorResponse(err.message, err.code || 'DEMO_LOGIN_FAILED'));
    }
  }

  /**
   * Authoritative Administrator Login verifying mobile number and security passcode.
   */
  static async adminLogin(req: FastifyRequest, reply: FastifyReply) {
    const body = (req.body || {}) as { mobileNumber: string; passcode?: string; password?: string };
    try {
      const result = await AuthService.authenticateAdminLogin(body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      reply.setCookie('access_token', result.token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400,
      });

      return reply.status(200).send(successResponse(result, 'Admin authentication successful.'));
    } catch (err: any) {
      const statusCode = err.statusCode || 401;
      return reply.status(statusCode).send(errorResponse(err.message, err.code || 'INVALID_CREDENTIALS'));
    }
  }

  /**
   * Authenticates user directly using recognized authorized device token.
   * Eliminates repeat OTP prompts on authorized devices (Zomato/Uber pattern).
   */
  static async deviceSession(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as DeviceSessionDto;
    try {
      const result = await AuthService.authenticateDeviceSession(body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      reply.setCookie('access_token', result.token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400, // 24 hours
      });

      reply.setCookie('refresh_token', result.refreshToken, {
        path: '/api/auth',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 86400, // 7 days
      });

      return reply.status(200).send(successResponse(result, 'Device session verified successfully.'));
    } catch (err: any) {
      const statusCode = err.statusCode || 401;
      const code = err.code || 'DEVICE_AUTH_FAILED';
      return reply.status(statusCode).send(errorResponse(err.message, code));
    }
  }

  static async requestOtp(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as RequestOtpDto;
    try {
      const result = await AuthService.requestOtp(body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return reply.status(200).send(successResponse(result, 'OTP verification code dispatched successfully.'));
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      const code = err.code || 'OTP_REQUEST_FAILED';
      return reply.status(statusCode).send(errorResponse(err.message, code, {
        retryAfter: err.retryAfter,
      }));
    }
  }

  static async registerOtp(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as RegisterOtpDto;
    try {
      const result = await AuthService.requestRegistrationOtp(body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return reply.status(200).send(successResponse(result, 'Registration OTP dispatched successfully.'));
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      const code = err.code || 'OTP_REQUEST_FAILED';
      return reply.status(statusCode).send(errorResponse(err.message, code, {
        retryAfter: err.retryAfter,
      }));
    }
  }

  static async verifyRegisterOtp(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as VerifyRegisterOtpDto;
    try {
      const result = await AuthService.verifyRegistrationOtp(body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return reply.status(200).send(successResponse(result, 'Registration OTP verified successfully.'));
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      const code = err.code || 'VERIFICATION_FAILED';
      return reply.status(statusCode).send(errorResponse(err.message, code));
    }
  }

  static async verifyOtp(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as VerifyOtpDto;
    try {
      const result = await AuthService.verifyOtp(body, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Set httpOnly Access Token Cookie
      reply.setCookie('access_token', result.token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400, // 24 hours
      });

      // Set httpOnly Refresh Token Cookie
      reply.setCookie('refresh_token', result.refreshToken, {
        path: '/api/auth',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 86400, // 7 days
      });

      return reply.status(200).send(successResponse(result, 'OTP successfully verified and session created.'));
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      const code = err.code || 'VERIFICATION_FAILED';
      return reply.status(statusCode).send(errorResponse(err.message, code, {
        remainingAttempts: err.remainingAttempts,
      }));
    }
  }

  static async refresh(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as any;
    const cookies = (req as any).cookies || {};
    const isCookieBased = !body?.refreshToken && Boolean(cookies?.refresh_token);
    const refreshToken = body?.refreshToken || cookies?.refresh_token;

    if (!refreshToken) {
      return reply.status(401).send(errorResponse('Refresh token is required.', 'NO_REFRESH_TOKEN'));
    }

    // Cookie-based CSRF protection against unauthorized cross-origin refresh
    if (isCookieBased) {
      let requestOrigin = req.headers.origin as string | undefined;

      if (!requestOrigin && req.headers.referer) {
        try {
          const parsedUrl = new URL(req.headers.referer as string);
          requestOrigin = parsedUrl.origin;
        } catch {
          requestOrigin = undefined;
        }
      }

      if (!requestOrigin || !isOriginAllowed(requestOrigin)) {
        return reply.status(403).send(
          errorResponse('Cross-origin request blocked: CSRF validation failed.', 'FORBIDDEN_CSRF')
        );
      }
    }

    try {
      const result = await AuthService.refreshSession(refreshToken, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      reply.setCookie('access_token', result.token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400,
      });

      return reply.status(200).send(successResponse(result, 'Session refreshed successfully.'));
    } catch (err: any) {
      const statusCode = err.statusCode || 401;
      const code = err.code || 'REFRESH_FAILED';
      return reply.status(statusCode).send(errorResponse(err.message, code));
    }
  }

  static async logout(req: FastifyRequest, reply: FastifyReply) {
    const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');
    const userId = req.user?.userId;

    if (userId) {
      await AuthService.logout(userId, token, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/api/auth' });

    return reply.status(200).send(successResponse({ loggedOut: true }, 'Logged out successfully.'));
  }

  static async me(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) {
      return reply.status(401).send(errorResponse('Authentication required.', 'UNAUTHORIZED'));
    }

    try {
      const user = await AuthService.getMe(req.user.userId);
      return reply.status(200).send(successResponse(user));
    } catch (err: any) {
      const statusCode = err.statusCode || 404;
      return reply.status(statusCode).send(errorResponse(err.message, err.code || 'USER_NOT_FOUND'));
    }
  }

  static async getDevices(req: FastifyRequest, reply: FastifyReply) {
    if (!req.user) {
      return reply.status(401).send(errorResponse('Authentication required.', 'UNAUTHORIZED'));
    }

    try {
      const devices = await AuthService.listUserDevices(req.user.userId);
      return reply.status(200).send(successResponse(devices));
    } catch (err: any) {
      return reply.status(500).send(errorResponse(err.message, 'FETCH_DEVICES_FAILED'));
    }
  }

  static async revokeDevice(req: FastifyRequest, reply: FastifyReply) {
    const { deviceId } = req.params as { deviceId: string };
    const body = (req.body as any) || {};

    try {
      const result = await AuthService.revokeDevice(deviceId, req.user?.userId, body?.reason);
      return reply.status(200).send(successResponse(result, 'Device authorization revoked.'));
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      return reply.status(statusCode).send(errorResponse(err.message, err.code || 'REVOKE_FAILED'));
    }
  }

  /**
   * Returns connection status of the WhatsApp OTP Gateway.
   */
  static async getWhatsAppStatus(_req: FastifyRequest, reply: FastifyReply) {
    const { SmsProviderFactory } = await import('../../lib/sms/factory.js');
    const wa = SmsProviderFactory.getProvider('WHATSAPP') as any;
    const status = wa.getStatus ? wa.getStatus() : { provider: wa.name, isConnected: true };
    return reply.status(200).send(successResponse(status));
  }

  static async testWhatsAppSend(req: FastifyRequest, reply: FastifyReply) {
    const { phone = '9340423885' } = (req.query as { phone?: string }) || {};
    const { SmsProviderFactory } = await import('../../lib/sms/factory.js');
    const wa = SmsProviderFactory.getProvider('WHATSAPP') as any;
    const cleanNumber = phone.replace(/\D/g, '');
    const recipientDigits = cleanNumber.startsWith('91') && cleanNumber.length > 10
      ? cleanNumber
      : (cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber);

    let onWaResult = null;
    let onWaError = null;
    if (wa.sock?.onWhatsApp) {
      try {
        onWaResult = await wa.sock.onWhatsApp(recipientDigits);
      } catch (e: any) {
        onWaError = e?.message;
      }
    }

    const sendRes = await wa.sendOtp(phone, '123456');

    return reply.status(200).send(successResponse({
      phone,
      recipientDigits,
      onWhatsApp: onWaResult,
      onWhatsAppError: onWaError,
      sendResult: sendRes,
      senderUser: wa.sock?.user,
    }));
  }

  /**
   * Serves an interactive HTML page displaying the WhatsApp QR code for easy scanning via browser.
   */
  static async getWhatsAppQr(_req: FastifyRequest, reply: FastifyReply) {
    const { SmsProviderFactory } = await import('../../lib/sms/factory.js');
    const wa = SmsProviderFactory.getProvider('WHATSAPP') as any;
    const status = wa.getStatus ? wa.getStatus() : { isConnected: false };
    const qr = wa.getQrCode ? wa.getQrCode() : null;

    if (status?.isConnected) {
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head><title>WhatsApp Gateway Status</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f2f5;">
          <div style="background:#fff;padding:36px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.08);text-align:center;max-width:420px;width:90%;">
            <div style="font-size:48px;margin-bottom:12px;">✅</div>
            <h2 style="color:#0f5132;margin:0 0 8px 0;">WhatsApp is Connected!</h2>
            <p style="color:#495057;font-size:14px;line-height:1.5;">Session active for <b>${status.user || 'Linked Phone'}</b>.<br/>All OTPs for WhatsApp channel will be dispatched directly to recipients.</p>
          </div>
        </body>
        </html>
      `);
    }

    if (!qr) {
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head><title>WhatsApp Gateway Status</title><meta http-equiv="refresh" content="2"></head>
        <body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f2f5;">
          <div style="background:#fff;padding:36px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.08);text-align:center;max-width:420px;width:90%;">
            <div style="font-size:48px;margin-bottom:12px;">⏳</div>
            <h2 style="color:#212529;margin:0 0 8px 0;">Initializing WhatsApp QR...</h2>
            <p style="color:#6c757d;font-size:14px;">Generating fresh link code. Page will refresh automatically in 2 seconds.</p>
          </div>
        </body>
        </html>
      `);
    }

    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Scan WhatsApp QR Code</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      </head>
      <body style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f2f5;">
        <div style="background:#fff;padding:32px;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,0.08);text-align:center;max-width:420px;width:90%;">
          <h2 style="color:#128c7e;margin:0 0 8px 0;">📲 Link WhatsApp for OTP</h2>
          <p style="color:#495057;font-size:13px;line-height:1.5;margin:0 0 20px 0;">
            1. Open WhatsApp on your phone.<br/>
            2. Tap <b>Settings / Menu (⋮)</b> &gt; <b>Linked Devices</b>.<br/>
            3. Tap <b>Link a Device</b> and scan this code:
          </p>
          <div id="qr" style="display:inline-block;padding:12px;background:#fff;border:1px solid #dee2e6;border-radius:8px;"></div>
          <p style="color:#868e96;font-size:12px;margin:16px 0 0 0;">Auto-refreshes every 20 seconds.</p>
        </div>
        <script>
          new QRCode(document.getElementById("qr"), {
            text: ${JSON.stringify(qr)},
            width: 240,
            height: 240
          });
          setTimeout(() => location.reload(), 20000);
        </script>
      </body>
      </html>
    `);
  }
}
