const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const Group = require('../models/Group');

// Get dashboard stats for current user
router.get('/stats', auth, async (req, res) => {
  try {
    const groups = await Group.find({ 'members.user': req.user._id, isActive: true }).select('_id');
    const groupIds = groups.map((group) => group._id);

    if (groupIds.length === 0) {
      return res.json({
        totalExpenses: 0,
        youOwe: 0,
        youAreOwed: 0,
        net: 0
      });
    }

    const expenses = await Expense.find({ group: { $in: groupIds } });

    let totalExpenses = 0;
    let youOwe = 0;
    let youAreOwed = 0;

    expenses.forEach((expense) => {
      totalExpenses += expense.amount;

      const myShare = expense.splits.find(
        (split) => split.user.toString() === req.user._id.toString()
      );

      if (expense.paidBy.toString() === req.user._id.toString()) {
        youAreOwed += expense.amount - (myShare ? myShare.amount : 0);
      } else if (myShare) {
        youOwe += myShare.amount;
      }
    });

    res.json({
      totalExpenses,
      youOwe,
      youAreOwed,
      net: youAreOwed - youOwe
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get expenses for a group
router.get('/group/:groupId', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const query = { group: req.params.groupId };
    if (category) query.category = category;

    const expenses = await Expense.find(query)
      .populate('paidBy', 'name email')
      .populate('splits.user', 'name email')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Expense.countDocuments(query);
    res.json({ expenses, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add expense
router.post('/', auth, async (req, res) => {
  try {
    const { description, amount, paidBy, splitType, participants, splits, category, date } = req.body;

    // Find group from context or use the one passed in URL
    const groupId = req.body.groupId || req.params.groupId;
    const group = await Group.findById(groupId).populate('members.user', 'name email');
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isMember = group.members.some(m => m.user._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Access denied' });

    let expenseSplits = [];

    if (splitType === 'equal') {
      // Use selected participants for equal split
      const selectedMembers = group.members.filter(m => 
        participants && participants.includes(m.user._id.toString())
      );
      const splitAmount = Math.round((amount / selectedMembers.length) * 100) / 100;
      const remainder = Math.round((amount - splitAmount * selectedMembers.length) * 100) / 100;

      expenseSplits = selectedMembers.map((m, idx) => ({
        user: m.user._id,
        amount: idx === 0 ? splitAmount + remainder : splitAmount
      }));
    } else if (splitType === 'custom') {
      // Use custom splits provided
      expenseSplits = splits.map(s => ({ user: s.user, amount: s.amount }));
    }

    const expense = new Expense({
      description,
      amount,
      category: category || 'other',
      group: groupId,
      paidBy,
      splitType,
      splits: expenseSplits,
      date: date || Date.now(),
      currency: group.currency
    });

    await expense.save();
    await expense.populate('paidBy', 'name email');
    await expense.populate('splits.user', 'name email');

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update expense
router.put('/:expenseId', auth, async (req, res) => {
  try {
    const { description, amount, paidBy, splitType, participants, splits, category, date } = req.body;
    
    const expense = await Expense.findById(req.params.expenseId);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const group = await Group.findById(expense.group).populate('members.user', 'name email');
    const isMember = group.members.some(m => m.user._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Access denied' });

    let expenseSplits = [];

    if (splitType === 'equal') {
      const selectedMembers = group.members.filter(m => 
        participants && participants.includes(m.user._id.toString())
      );
      const splitAmount = Math.round((amount / selectedMembers.length) * 100) / 100;
      const remainder = Math.round((amount - splitAmount * selectedMembers.length) * 100) / 100;

      expenseSplits = selectedMembers.map((m, idx) => ({
        user: m.user._id,
        amount: idx === 0 ? splitAmount + remainder : splitAmount
      }));
    } else if (splitType === 'custom') {
      expenseSplits = splits.map(s => ({ user: s.user, amount: s.amount }));
    }

    expense.description = description;
    expense.amount = amount;
    expense.paidBy = paidBy;
    expense.splitType = splitType;
    expense.splits = expenseSplits;
    expense.category = category || expense.category;
    expense.date = date || expense.date;

    await expense.save();
    await expense.populate('paidBy', 'name email');
    await expense.populate('splits.user', 'name email');

    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete expense
router.delete('/:expenseId', auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.expenseId);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    const group = await Group.findById(expense.group);
    const isMember = group.members.some(m => m.user._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Access denied' });

    await Expense.findByIdAndDelete(req.params.expenseId);
    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get user's overall balance across all groups
router.get('/my-balances', auth, async (req, res) => {
  try {
    const expenses = await Expense.find({ 'splits.user': req.user._id })
      .populate('paidBy', 'name email')
      .populate('group', 'name currency');

    let totalOwed = 0;
    let totalOwing = 0;

    expenses.forEach(exp => {
      if (exp.paidBy._id.toString() === req.user._id.toString()) {
        const myShare = exp.splits.find(s => s.user.toString() === req.user._id.toString());
        totalOwed += exp.amount - (myShare ? myShare.amount : 0);
      } else {
        const myShare = exp.splits.find(s => s.user.toString() === req.user._id.toString());
        if (myShare) totalOwing += myShare.amount;
      }
    });

    res.json({ totalOwed, totalOwing, net: totalOwed - totalOwing });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
