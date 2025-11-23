import mongoose from 'mongoose';

const callSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy'],
      default: 'queued',
    },
    callSid: {
      type: String, // Twilio/VAPI call ID
      index: true,
    },
    startTime: {
      type: Date,
    },
    answerTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number, // seconds
      default: 0,
    },
    talkTime: {
      type: Number, // seconds (answer to end)
      default: 0,
    },
    recordingUrl: {
      type: String,
    },
    recordingSid: {
      type: String,
    },
    disposition: {
      type: String,
    },
    notes: {
      type: String,
    },
    transferredTo: {
      type: String,
    },
    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    events: [{
      event: {
        type: String,
        enum: ['initiated', 'ringing', 'answered', 'hold', 'resume', 'transfer', 'hangup', 'failed'],
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      data: {
        type: mongoose.Schema.Types.Mixed,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes
callSchema.index({ agent: 1, createdAt: -1 });
callSchema.index({ campaign: 1, createdAt: -1 });
callSchema.index({ status: 1 });
callSchema.index({ createdAt: -1 });

// Calculate duration on save
callSchema.pre('save', function (next) {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000);
  }
  if (this.endTime && this.answerTime) {
    this.talkTime = Math.floor((this.endTime - this.answerTime) / 1000);
  }
  next();
});

const Call = mongoose.model('Call', callSchema);

export default Call;
