process.env.NODE_ENV = 'test';
process.env.WHATSAPP_PROVIDER = 'baileys';

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BaileysWhatsAppProvider } from '../lib/sms/providers/baileys.provider.js';
import { SmsProviderFactory } from '../lib/sms/factory.js';

describe('Baileys WhatsApp Provider Suite', () => {
  it('1. Initializes BaileysWhatsAppProvider with correct interface properties', () => {
    const provider = new BaileysWhatsAppProvider({ autoConnect: false });
    assert.equal(provider.name, 'baileys');
    
    const status = provider.getStatus();
    assert.equal(status.provider, 'baileys');
    assert.equal(status.isConnected, false);
    assert.equal(status.hasQr, false);
  });

  it('2. SmsProviderFactory resolves BaileysWhatsAppProvider for WHATSAPP channel', async () => {
    SmsProviderFactory.reset();
    const waProvider = SmsProviderFactory.getProvider('WHATSAPP') as BaileysWhatsAppProvider;
    assert.equal(waProvider.name, 'baileys');
    await waProvider.disconnect();
  });

  it('3. sendOtp safely handles unlinked state with clear user-friendly guidance', async () => {
    const provider = new BaileysWhatsAppProvider({ autoConnect: false });
    const result = await provider.sendOtp('9848012345', '654321');

    assert.equal(result.success, false);
    assert.equal(result.provider, 'baileys');
    assert.ok(result.error?.includes('WhatsApp Web session is not linked'));
    await provider.disconnect();
  });

  it('4. sendTransactional safely handles unlinked state', async () => {
    const provider = new BaileysWhatsAppProvider({ autoConnect: false });
    const result = await provider.sendTransactional('9848012345', 'Test Transactional Message');

    assert.equal(result.success, false);
    assert.equal(result.provider, 'baileys');
    assert.ok(result.error?.includes('WhatsApp Web session is not linked'));
    await provider.disconnect();
  });

  it('5. Clean disconnect terminates socket timers safely', async () => {
    const provider = new BaileysWhatsAppProvider({ autoConnect: false });
    await provider.disconnect();
    assert.equal(provider.getStatus().isConnected, false);
  });
});

