const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['trip', 'home', 'event', 'project', 'other'],
    default: 'other'
  },
  currency: {
    type: String,
    default: 'INR'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  inviteCode: {
    type: String,
    unique: true,
    sparse: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Generate invite code
groupSchema.methods.generateInviteCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  this.inviteCode = code;
  return code;
};

// Ensure creator is always a member
groupSchema.pre('save', function(next) {
  if (this.isNew) {
    const creatorExists = this.members.some(m => m.user.toString() === this.createdBy.toString());
    if (!creatorExists) {
      this.members.push({ user: this.createdBy, role: 'admin' });
    }
    // Generate invite code for new groups
    if (!this.inviteCode) {
      this.generateInviteCode();
    }
  }
  next();
});

module.exports = mongoose.model('Group', groupSchema);