import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    altPhone: {
      type: String,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'Philippines' },
    },
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'callback', 'converted', 'not_interested', 'dnc', 'invalid'],
      default: 'new',
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    priority: {
      type: Number,
      default: 0, // Higher = more priority
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastAttempt: {
      type: Date,
    },
    nextCallback: {
      type: Date,
    },
    lastDisposition: {
      type: String,
    },
    notes: [{
      text: String,
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
leadSchema.index({ campaign: 1, status: 1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ assignedAgent: 1 });
leadSchema.index({ nextCallback: 1 });

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
