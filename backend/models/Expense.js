const mongoose = require('mongoose');

const splitSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paidAt: Date
});

const expenseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  category: {
    type: String,
    enum: ['food', 'travel', 'accommodation', 'entertainment', 'shopping', 'utilities', 'health', 'other'],
    default: 'other'
  },
  // AI-generated category confidence
  aiCategory: {
    type: String,
    default: null
  },
  aiCategoryConfidence: {
    type: Number,
    default: null
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  splitType: {
    type: String,
    enum: ['equal', 'custom', 'percentage'],
    default: 'equal'
  },
  splits: [splitSchema],
  date: {
    type: Date,
    default: Date.now
  },
  receipt: {
    type: String,
    default: null
  },
  isSettled: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);