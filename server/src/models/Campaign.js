import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['inbound', 'outbound', 'blended'],
      default: 'outbound',
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'draft'],
      default: 'draft',
    },
    dialMode: {
      type: String,
      enum: ['preview', 'progressive', 'predictive'],
      default: 'preview',
    },
    callerId: {
      type: String,
      trim: true,
    },
    script: {
      type: String,
    },
    dispositions: [{
      name: {
        type: String,
        required: true,
      },
      isPositive: {
        type: Boolean,
        default: false,
      },
      requiresCallback: {
        type: Boolean,
        default: false,
      },
    }],
    workingHours: {
      start: {
        type: String,
        default: '09:00',
      },
      end: {
        type: String,
        default: '18:00',
      },
      timezone: {
        type: String,
        default: 'Asia/Manila',
      },
      days: [{
        type: Number, // 0-6 (Sunday-Saturday)
        default: [1, 2, 3, 4, 5], // Mon-Fri
      }],
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    retryInterval: {
      type: Number, // minutes
      default: 60,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAgents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    stats: {
      totalLeads: { type: Number, default: 0 },
      contacted: { type: Number, default: 0 },
      converted: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

const Campaign = mongoose.model('Campaign', campaignSchema);

export default Campaign;
