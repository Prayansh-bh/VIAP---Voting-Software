import { FastifyReply, FastifyRequest } from 'fastify';
import QRCode from 'qrcode';
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
   * Serves an interactive, responsive HTML page displaying the WhatsApp QR code,
   * customizable sizing (compact/medium/large), raw image link, and direct Phone Pairing Code.
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
        <head>
          <title>WhatsApp Gateway - Active</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
            .card { background: white; border-radius: 20px; padding: 40px 32px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 12px 32px rgba(0,0,0,0.08); }
            .badge { display: inline-flex; align-items: center; gap: 8px; background: #e8f5e9; color: #2e7d32; font-weight: 600; padding: 6px 16px; border-radius: 20px; font-size: 14px; margin-bottom: 20px; }
            h2 { color: #111b21; font-size: 24px; margin-bottom: 12px; }
            p { color: #667781; font-size: 15px; line-height: 1.5; margin-bottom: 24px; }
            .user-tag { background: #f0f2f5; color: #111b21; padding: 12px; border-radius: 12px; font-family: monospace; font-size: 14px; word-break: break-all; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">● Online & Ready</div>
            <h2>WhatsApp is Connected!</h2>
            <p>Authentication and OTP dispatch are fully active and connected to your linked phone.</p>
            <div class="user-tag">JID: ${status.user || 'Connected Device'}</div>
            <p style="font-size: 13px; color: #8696a0;">All OTP requests will be sent instantly via WhatsApp.</p>
          </div>
        </body>
        </html>
      `);
    }

    if (!qr) {
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>WhatsApp Gateway - Initializing</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="refresh" content="3">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f0f2f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
            .card { background: white; border-radius: 20px; padding: 40px 32px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 12px 32px rgba(0,0,0,0.08); }
            .spinner { width: 44px; height: 44px; border: 4px solid #e9edef; border-top-color: #00a884; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
            @keyframes spin { to { transform: rotate(360deg); } }
            h2 { color: #111b21; font-size: 22px; margin-bottom: 10px; }
            p { color: #667781; font-size: 14px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="spinner"></div>
            <h2>Initializing WhatsApp Gateway</h2>
            <p>Generating new secure authentication token. This page will refresh automatically in 3 seconds...</p>
          </div>
        </body>
        </html>
      `);
    }

    // Generate high-resolution server-side QR data URI
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(qr, {
        margin: 2,
        scale: 8,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch {
      qrDataUrl = '';
    }

    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Link WhatsApp OTP Gateway</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #eae6df; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
          .container { background: white; border-radius: 24px; max-width: 480px; width: 100%; box-shadow: 0 16px 40px rgba(0,0,0,0.12); overflow: hidden; }
          .header { background: #00a884; color: white; padding: 24px 28px; text-align: left; }
          .header h1 { font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
          .header p { font-size: 13px; opacity: 0.9; margin-top: 6px; }
          .tabs { display: flex; border-bottom: 1px solid #e9edef; background: #f0f2f5; }
          .tab { flex: 1; padding: 14px 16px; font-size: 14px; font-weight: 600; text-align: center; color: #54656f; cursor: pointer; border: none; background: transparent; transition: all 0.2s; }
          .tab.active { background: white; color: #00a884; border-bottom: 2px solid #00a884; }
          .tab-content { padding: 28px 24px; text-align: center; display: none; }
          .tab-content.active { display: block; }
          
          /* QR Section */
          .instructions { text-align: left; background: #f0f2f5; padding: 14px 18px; border-radius: 12px; margin-bottom: 20px; font-size: 13px; color: #3b4a54; line-height: 1.6; }
          .instructions ol { padding-left: 20px; }
          .qr-wrapper { display: inline-block; padding: 12px; background: white; border: 2px solid #e9edef; border-radius: 16px; margin: 8px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
          .qr-image { display: block; border-radius: 8px; transition: width 0.2s, height 0.2s; }
          
          /* Sizing Controls */
          .size-controls { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 16px 0 12px; font-size: 13px; color: #667781; }
          .size-btn { padding: 6px 14px; border: 1px solid #d1d7db; border-radius: 20px; background: white; color: #54656f; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
          .size-btn.active { background: #00a884; color: white; border-color: #00a884; }
          .size-btn:hover:not(.active) { background: #f5f6f6; }
          
          /* Phone Pairing Section */
          .pair-form { text-align: left; }
          .form-group { margin-bottom: 16px; }
          .form-label { display: block; font-size: 13px; font-weight: 600; color: #3b4a54; margin-bottom: 6px; }
          .phone-input-wrap { display: flex; align-items: center; border: 2px solid #d1d7db; border-radius: 12px; overflow: hidden; background: white; }
          .prefix { background: #f0f2f5; padding: 12px 14px; font-size: 14px; color: #54656f; font-weight: 600; border-right: 1px solid #d1d7db; }
          .phone-input { border: none; padding: 12px 16px; font-size: 15px; width: 100%; outline: none; }
          .pair-btn { width: 100%; background: #00a884; color: white; border: none; padding: 14px; font-size: 15px; font-weight: 600; border-radius: 12px; cursor: pointer; transition: background 0.2s; margin-top: 6px; }
          .pair-btn:hover { background: #008f72; }
          .code-display { display: none; margin-top: 20px; background: #e8f5e9; border: 2px dashed #00a884; border-radius: 14px; padding: 20px; text-align: center; }
          .code-text { font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #00a884; margin: 10px 0; }
          
          .footer-note { font-size: 12px; color: #8696a0; margin-top: 18px; }
          .raw-link { color: #00a884; text-decoration: none; font-weight: 500; font-size: 12px; }
          .raw-link:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📲 Link WhatsApp OTP Gateway</h1>
            <p>Connect your phone to dispatch real SMS / WhatsApp OTPs</p>
          </div>
          
          <div class="tabs">
            <button class="tab active" onclick="switchTab('qrTab', this)">📷 Scan QR Code</button>
            <button class="tab" onclick="switchTab('pairTab', this)">🔢 Phone Pairing Code</button>
          </div>

          <!-- TAB 1: QR CODE -->
          <div id="qrTab" class="tab-content active">
            <div class="instructions">
              <ol>
                <li>Open <b>WhatsApp</b> on your phone</li>
                <li>Tap <b>Menu (⋮)</b> or <b>Settings</b> &gt; <b>Linked Devices</b></li>
                <li>Tap <b>Link a Device</b> and point camera at the barcode below</li>
              </ol>
            </div>

            <div class="size-controls">
              <span>QR Size:</span>
              <button class="size-btn" onclick="setQrSize(160, this)">Compact (160px)</button>
              <button class="size-btn active" onclick="setQrSize(220, this)">Standard (220px)</button>
              <button class="size-btn" onclick="setQrSize(280, this)">Large (280px)</button>
            </div>

            <div class="qr-wrapper">
              <img id="qrImg" class="qr-image" src="${qrDataUrl}" width="220" height="220" alt="WhatsApp Link QR" />
            </div>

            <div style="margin-top: 10px;">
              <a href="/api/auth/whatsapp/qr.png" target="_blank" class="raw-link">🔍 Open Raw Image (.png)</a>
            </div>

            <p class="footer-note">⚡ Auto-refreshes every 20 seconds. Automatically confirms when connected.</p>
          </div>

          <!-- TAB 2: PAIRING CODE -->
          <div id="pairTab" class="tab-content">
            <div class="instructions">
              <p><b>Link without scanning:</b></p>
              <ol style="margin-top: 6px;">
                <li>Open <b>WhatsApp</b> &gt; <b>Linked Devices</b> &gt; <b>Link a Device</b></li>
                <li>Tap <b>"Link with phone number instead"</b> at the bottom</li>
                <li>Enter the 8-character pairing code generated below</li>
              </ol>
            </div>

            <form class="pair-form" onsubmit="getPairingCode(event)">
              <div class="form-group">
                <label class="form-label">Enter Your WhatsApp Mobile Number</label>
                <div class="phone-input-wrap">
                  <span class="prefix">+91</span>
                  <input type="tel" id="pairPhone" class="phone-input" placeholder="e.g. 9848012345" maxlength="10" required />
                </div>
              </div>
              <button type="submit" id="pairSubmitBtn" class="pair-btn">Generate Pairing Code</button>
            </form>

            <div id="codeDisplay" class="code-display">
              <p style="font-size: 13px; color: #54656f;">Enter this code on your WhatsApp mobile screen:</p>
              <div id="pairingCodeVal" class="code-text">---- ----</div>
              <p style="font-size: 12px; color: #667781;">Valid for 60 seconds.</p>
            </div>

            <div id="pairError" style="display:none; color:#d32f2f; font-size:13px; margin-top:12px;"></div>
          </div>
        </div>

        <script>
          function switchTab(tabId, el) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
            document.getElementById(tabId).classList.add('active');
          }

          function setQrSize(px, btn) {
            const img = document.getElementById('qrImg');
            img.style.width = px + 'px';
            img.style.height = px + 'px';
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            localStorage.setItem('wa_qr_size', px);
          }

          // Restore saved size preference if any
          const savedSize = localStorage.getItem('wa_qr_size');
          if (savedSize) {
            const matchedBtn = Array.from(document.querySelectorAll('.size-btn')).find(b => b.textContent.includes(savedSize));
            if (matchedBtn) setQrSize(parseInt(savedSize, 10), matchedBtn);
          }

          async function getPairingCode(e) {
            e.preventDefault();
            const phone = document.getElementById('pairPhone').value.trim();
            const btn = document.getElementById('pairSubmitBtn');
            const errDiv = document.getElementById('pairError');
            const codeBox = document.getElementById('codeDisplay');
            const codeVal = document.getElementById('pairingCodeVal');

            errDiv.style.display = 'none';
            btn.disabled = true;
            btn.textContent = 'Requesting code...';

            try {
              const res = await fetch('/api/auth/whatsapp/pair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber: phone })
              });
              const json = await res.json();
              if (json.success && json.data?.pairingCode) {
                const raw = json.data.pairingCode;
                codeVal.textContent = raw.length === 8 ? raw.slice(0, 4) + ' - ' + raw.slice(4) : raw;
                codeBox.style.display = 'block';
              } else {
                errDiv.textContent = json.error?.message || json.message || 'Failed to generate code. Please try again.';
                errDiv.style.display = 'block';
              }
            } catch (err) {
              errDiv.textContent = 'Network error while requesting pairing code.';
              errDiv.style.display = 'block';
            } finally {
              btn.disabled = false;
              btn.textContent = 'Generate Pairing Code';
            }
          }

          // Auto-poll status every 3 seconds to transition to connected state
          setInterval(async () => {
            try {
              const res = await fetch('/api/auth/whatsapp/status');
              const json = await res.json();
              if (json.data?.isConnected) {
                location.reload();
              }
            } catch {}
          }, 3000);

          // Auto-refresh page every 20 seconds for fresh QR if not connected
          setTimeout(() => location.reload(), 20000);
        </script>
      </body>
      </html>
    `);
  }

  /**
   * Serves direct raw PNG image of the WhatsApp QR code.
   */
  static async getWhatsAppQrImage(_req: FastifyRequest, reply: FastifyReply) {
    const { SmsProviderFactory } = await import('../../lib/sms/factory.js');
    const wa = SmsProviderFactory.getProvider('WHATSAPP') as any;
    const qr = wa.getQrCode ? wa.getQrCode() : null;

    if (!qr) {
      return reply.status(404).send({ success: false, error: 'QR code not available or WhatsApp already connected.' });
    }

    try {
      const buffer = await QRCode.toBuffer(qr, {
        margin: 2,
        scale: 6,
        color: { dark: '#000000', light: '#ffffff' },
      });
      return reply.type('image/png').send(buffer);
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err?.message || 'Failed to generate QR buffer' });
    }
  }

  /**
   * Generates an 8-character pairing code for linking with a phone number.
   */
  static async requestWhatsAppPairingCode(req: FastifyRequest, reply: FastifyReply) {
    const body = req.body as { phoneNumber?: string };
    if (!body?.phoneNumber) {
      return reply.status(400).send(errorResponse('phoneNumber is required', 'VALIDATION_ERROR'));
    }

    try {
      const { SmsProviderFactory } = await import('../../lib/sms/factory.js');
      const wa = SmsProviderFactory.getProvider('WHATSAPP') as any;
      if (!wa.requestPairingCode) {
        return reply.status(400).send(errorResponse('Pairing code not supported', 'NOT_SUPPORTED'));
      }

      const pairingCode = await wa.requestPairingCode(body.phoneNumber);
      return reply.status(200).send(successResponse({ pairingCode }, 'Pairing code generated successfully.'));
    } catch (err: any) {
      return reply.status(400).send(errorResponse(err?.message || 'Failed to generate pairing code', 'PAIRING_FAILED'));
    }
  }
}
