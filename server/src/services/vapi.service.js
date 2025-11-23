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
    const call = await this.getCall(callId);

    if (call.status !== 'in-progress') {
      throw new Error('Call is not in progress');
    }

    // VAPI provides monitor URL for listening
    return {
      callId,
      monitorUrl: call.monitor?.listenUrl || null,
      status: call.status,
    };
  }

  // Send a message to the assistant during the call (for whisper/coaching)
  async sendMessage(callId, message, role = 'system') {
    const payload = {
      message: {
        role,
        content: message,
      },
    };

    logger.info(`Sending ${role} message to call ${callId}`);
    return this.makeRequest(`/call/${callId}/message`, 'POST', payload);
  }

  // Whisper to the AI assistant (only assistant hears)
  async whisper(callId, message) {
    return this.sendMessage(callId, message, 'system');
  }

  // Barge into the call (inject audio/message that customer hears)
  async barge(callId, message) {
    // For barge-in, we need to use add-message with user role
    // This will make the assistant respond as if the user said something
    const payload = {
      type: 'add-message',
      message: {
        role: 'user',
        content: message,
      },
    };

    logger.info(`Barging into call ${callId}`);
    return this.makeRequest(`/call/${callId}/message`, 'POST', payload);
  }

  // Transfer call to a human agent
  async transferCall(callId, destination) {
    const payload = {
      destination: {
        type: 'number',
        number: destination,
      },
    };

    logger.info(`Transferring call ${callId} to ${destination}`);
    return this.makeRequest(`/call/${callId}/transfer`, 'POST', payload);
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
