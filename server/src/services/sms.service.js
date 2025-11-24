import twilio from 'twilio';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class SMSService {
  constructor() {
    this.provider = config.sms.provider;
    this.client = null;
    this.fromNumber = null;

    this.initializeProvider();
  }

  initializeProvider() {
    switch (this.provider) {
      case 'twilio':
        this.initializeTwilio();
        break;
      default:
        logger.warn(`Unknown SMS provider: ${this.provider}. SMS functionality will be disabled.`);
    }
  }

  initializeTwilio() {
    const { accountSid, authToken, phoneNumber } = config.twilio;

    if (!accountSid || !authToken || !phoneNumber) {
      logger.warn('Twilio credentials not configured. SMS functionality will be disabled.');
      return;
    }

    try {
      this.client = twilio(accountSid, authToken);
      this.fromNumber = phoneNumber;
      logger.info('Twilio SMS service initialized');
    } catch (error) {
      logger.error(`Failed to initialize Twilio: ${error.message}`);
    }
  }

  async sendSMS(to, message) {
    if (!this.client) {
      throw new Error('SMS service not configured');
    }

    switch (this.provider) {
      case 'twilio':
        return this.sendViaTwilio(to, message);
      default:
        throw new Error(`Unknown SMS provider: ${this.provider}`);
    }
  }

  async sendViaTwilio(to, message) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to,
      });

      logger.info(`SMS sent via Twilio to ${to}: ${result.sid}`);

      return {
        success: true,
        provider: 'twilio',
        messageId: result.sid,
        status: result.status,
      };
    } catch (error) {
      logger.error(`Twilio SMS error: ${error.message}`);
      throw new Error(error.message || 'Failed to send SMS via Twilio');
    }
  }

  isConfigured() {
    return this.client !== null;
  }

  getProvider() {
    return this.provider;
  }
}

export const smsService = new SMSService();
export default smsService;
