import config from '../config/index.js';
import logger from '../utils/logger.js';

const VAPI_BASE_URL = 'https://api.vapi.ai';

class VapiService {
  constructor() {
    this.apiKey = config.vapi.apiKey;
    this.assistantId = config.vapi.assistantId;
    this.phoneId = config.vapi.phoneId;
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${VAPI_BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      logger.error(`VAPI API Error: ${JSON.stringify(data)}`);
      throw new Error(data.message || 'VAPI API request failed');
    }

    return data;
  }

  // Get control URL from listen URL
  getControlUrl(listenUrl) {
    return listenUrl.replace('/listen', '/control').replace('wss://', 'https://');
  }

  // Send control command to active call
  async sendControlCommand(controlUrl, payload) {
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    logger.info(`Sending control command to ${controlUrl}: ${JSON.stringify(payload)}`);

    const response = await fetch(controlUrl, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Control command error: ${JSON.stringify(errorData)}`);
      throw new Error(errorData.message || 'Control command failed');
    }

    return { success: true };
  }

  // Create an outbound call
  async createCall(phoneNumber, customerId, metadata = {}) {
    const payload = {
      assistantId: this.assistantId,
      phoneNumberId: this.phoneId,
      customer: {
        number: phoneNumber,
      },
      metadata: {
        customerId,
        ...metadata,
      },
    };

    logger.info(`Creating VAPI call to ${phoneNumber}`);
    return this.makeRequest('/call/phone', 'POST', payload);
  }

  // Get call details
  async getCall(callId) {
    return this.makeRequest(`/call/${callId}`);
  }

  // List all calls
  async listCalls(limit = 100) {
    return this.makeRequest(`/call?limit=${limit}`);
  }

  // End a call
  async endCall(callId) {
    logger.info(`Ending VAPI call ${callId}`);
    return this.makeRequest(`/call/${callId}`, 'DELETE');
  }

  // Listen to a call (get live audio stream URL)
  async listenToCall(callId) {
    try {
      const call = await this.getCall(callId);

      // VAPI provides monitor URL for listening
      return {
        callId,
        monitorUrl: call.monitor?.listenUrl || call.monitor?.controlUrl || null,
        status: call.status,
        message: call.monitor?.listenUrl ? 'Listen URL available' : 'Listen URL not available for this call',
      };
    } catch (error) {
      logger.error(`Failed to get listen URL: ${error.message}`);
      throw new Error('Listen feature not available. Call may not support monitoring.');
    }
  }

  // Send a message to the assistant during the call (for whisper/coaching)
  async sendMessage(callId, message, type = 'add-message') {
    const payload = {
      type,
      message: {
        role: 'system',
        content: message,
      },
    };

    logger.info(`Sending message to call ${callId}: ${message}`);
    return this.makeRequest(`/call/${callId}`, 'PATCH', payload);
  }

  // Whisper to the AI assistant (only assistant hears - system message)
  async whisper(callId, message, controlUrl) {
    try {
      const payload = {
        type: 'add-message',
        message: {
          role: 'system',
          content: message,
        },
        triggerResponseEnabled: true,
      };

      logger.info(`Whisper to call ${callId}: ${message}`);

      if (controlUrl) {
        return this.sendControlCommand(controlUrl, payload);
      }

      // Fallback: get call details and derive control URL
      const call = await this.getCall(callId);
      if (call.monitor?.listenUrl) {
        const derivedControlUrl = this.getControlUrl(call.monitor.listenUrl);
        return this.sendControlCommand(derivedControlUrl, payload);
      }

      throw new Error('No control URL available for this call');
    } catch (error) {
      logger.error(`Whisper failed: ${error.message}`);
      throw new Error('Failed to send whisper. The call may have ended.');
    }
  }

  // Barge into the call - make AI say something to the customer
  async barge(callId, message, controlUrl) {
    try {
      const payload = {
        type: 'say',
        content: message,
      };

      logger.info(`Barge into call ${callId}: ${message}`);

      if (controlUrl) {
        return this.sendControlCommand(controlUrl, payload);
      }

      // Fallback: get call details and derive control URL
      const call = await this.getCall(callId);
      if (call.monitor?.listenUrl) {
        const derivedControlUrl = this.getControlUrl(call.monitor.listenUrl);
        return this.sendControlCommand(derivedControlUrl, payload);
      }

      throw new Error('No control URL available for this call');
    } catch (error) {
      logger.error(`Barge failed: ${error.message}`);
      throw new Error('Failed to barge into call. The call may have ended.');
    }
  }

  // Transfer call to a human agent
  async transferCall(callId, destination, controlUrl, transferMessage = '') {
    try {
      const payload = {
        type: 'transfer',
        destination: {
          type: 'number',
          number: destination,
        },
      };

      if (transferMessage) {
        payload.content = transferMessage;
      }

      logger.info(`Transferring call ${callId} to ${destination}`);

      if (controlUrl) {
        return this.sendControlCommand(controlUrl, payload);
      }

      // Fallback: get call details and derive control URL
      const call = await this.getCall(callId);
      if (call.monitor?.listenUrl) {
        const derivedControlUrl = this.getControlUrl(call.monitor.listenUrl);
        return this.sendControlCommand(derivedControlUrl, payload);
      }

      throw new Error('No control URL available for this call');
    } catch (error) {
      logger.error(`Transfer failed: ${error.message}`);
      throw new Error('Failed to transfer call. The call may have ended.');
    }
  }

  // End call using control URL
  async endCallViaControl(callId, controlUrl) {
    try {
      const payload = {
        type: 'end-call',
      };

      logger.info(`Ending call ${callId} via control URL`);

      if (controlUrl) {
        return this.sendControlCommand(controlUrl, payload);
      }

      // Fallback: get call details and derive control URL
      const call = await this.getCall(callId);
      if (call.monitor?.listenUrl) {
        const derivedControlUrl = this.getControlUrl(call.monitor.listenUrl);
        return this.sendControlCommand(derivedControlUrl, payload);
      }

      // Last resort: use DELETE endpoint
      return this.endCall(callId);
    } catch (error) {
      logger.error(`End call failed: ${error.message}`);
      throw new Error('Failed to end call.');
    }
  }

  // Mute/Unmute assistant
  async controlAssistant(callId, control, controlUrl) {
    try {
      const payload = {
        type: 'control',
        control: control, // 'mute-assistant', 'unmute-assistant', 'say-first-message'
      };

      logger.info(`Control assistant ${callId}: ${control}`);

      if (controlUrl) {
        return this.sendControlCommand(controlUrl, payload);
      }

      // Fallback: get call details and derive control URL
      const call = await this.getCall(callId);
      if (call.monitor?.listenUrl) {
        const derivedControlUrl = this.getControlUrl(call.monitor.listenUrl);
        return this.sendControlCommand(derivedControlUrl, payload);
      }

      throw new Error('No control URL available for this call');
    } catch (error) {
      logger.error(`Control assistant failed: ${error.message}`);
      throw new Error('Failed to control assistant. The call may have ended.');
    }
  }

  // Get call transcript
  async getTranscript(callId) {
    const call = await this.getCall(callId);
    return call.messages || [];
  }

  // Get call analytics
  async getCallAnalytics(callId) {
    const call = await this.getCall(callId);
    return {
      duration: call.endedAt ?
        (new Date(call.endedAt) - new Date(call.startedAt)) / 1000 : null,
      status: call.status,
      endedReason: call.endedReason,
      cost: call.cost,
      transcript: call.messages,
      analysis: call.analysis,
    };
  }

  // Get assistant info
  async getAssistant() {
    return this.makeRequest(`/assistant/${this.assistantId}`);
  }

  // Update assistant for this call
  async updateAssistantOverrides(callId, overrides) {
    const payload = {
      assistant: overrides,
    };

    return this.makeRequest(`/call/${callId}`, 'PATCH', payload);
  }
}

export const vapiService = new VapiService();
export default vapiService;
