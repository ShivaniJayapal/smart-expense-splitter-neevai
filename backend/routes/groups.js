const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const User = require('../models/User');

// Get all groups for current user
router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find({ 'members.user': req.user._id, isActive: true })
      .populate('members.user', 'name email')
      .populate('createdBy', 'name email')
      .sort({ updatedAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create group
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, category, currency, members } = req.body;

    // Generate unique invite code
    const generateInviteCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // Find members by email
    let memberIds = [];
    if (members && members.length > 0) {
      // Filter out empty emails and get unique emails
      const emails = [...new Set(members.filter(m => m && m.trim()))];
      const users = await User.find({ email: { $in: emails } });
      memberIds = users.map(u => ({ user: u._id, role: 'member' }));
    }

    const group = new Group({
      name,
      description,
      category,
      currency: currency || 'INR',
      createdBy: req.user._id,
      members: [{ user: req.user._id, role: 'admin' }, ...memberIds],
      inviteCode: generateInviteCode()
    });

    await group.save();
    await group.populate('members.user', 'name email');
    await group.populate('createdBy', 'name email');

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single group
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members.user', 'name email')
      .populate('createdBy', 'name email');

    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isMember = group.members.some(m => m.user._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Access denied' });

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add member to group
router.post('/:id/members', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isAdmin = group.members.some(
      m => m.user.toString() === req.user._id.toString() && m.role === 'admin'
    );
    if (!isAdmin) return res.status(403).json({ message: 'Only admin can add members' });

    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const alreadyMember = group.members.some(m => m.user.toString() === user._id.toString());
    if (alreadyMember) return res.status(400).json({ message: 'User already a member' });

    group.members.push({ user: user._id, role: 'member' });
    await group.save();
    await group.populate('members.user', 'name email');

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get group balances
router.get('/:id/balances', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate('members.user', 'name email');
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const expenses = await Expense.find({ group: req.params.id })
      .populate('paidBy', 'name email')
      .populate('splits.user', 'name email');

    const settlements = await Settlement.find({ group: req.params.id })
      .populate('payer', 'name email')
      .populate('payee', 'name email');

    // Calculate net balances
    const balances = {};
    group.members.forEach(m => {
      balances[m.user._id.toString()] = {
        user: m.user,
        paid: 0,
        owes: 0,
        net: 0
      };
    });

    expenses.forEach(exp => {
      const payerId = exp.paidBy._id.toString();
      if (balances[payerId]) {
        balances[payerId].paid += exp.amount;
      }
      exp.splits.forEach(split => {
        const uid = split.user._id.toString();
        if (balances[uid]) {
          balances[uid].owes += split.amount;
        }
      });
    });

    // Apply settlements
    settlements.forEach(s => {
      const payerId = s.payer._id.toString();
      const payeeId = s.payee._id.toString();
      if (balances[payerId]) balances[payerId].owes -= s.amount;
      if (balances[payeeId]) balances[payeeId].paid -= s.amount;
    });

    // Calculate net
    Object.keys(balances).forEach(uid => {
      balances[uid].net = balances[uid].paid - balances[uid].owes;
    });

    // Calculate who owes whom (simplified debt algorithm)
    const debts = calculateDebts(Object.values(balances));

    res.json({ balances: Object.values(balances), debts });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Helper: Calculate simplified debts
function calculateDebts(balances) {
  const creditors = balances.filter(b => b.net > 0.01).map(b => ({ ...b, net: b.net }));
  const debtors = balances.filter(b => b.net < -0.01).map(b => ({ ...b, net: Math.abs(b.net) }));

  const transactions = [];
  let i = 0, j = 0;

  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].net, debtors[j].net);
    transactions.push({
      from: debtors[j].user,
      to: creditors[i].user,
      amount: Math.round(amount * 100) / 100
    });
    creditors[i].net -= amount;
    debtors[j].net -= amount;
    if (creditors[i].net < 0.01) i++;
    if (debtors[j].net < 0.01) j++;
  }

  return transactions;
}

// Generate invite code
router.post('/:id/invite', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isAdmin = group.members.some(
      m => m.user.toString() === req.user._id.toString() && m.role === 'admin'
    );
    if (!isAdmin) return res.status(403).json({ message: 'Only admin can generate invite codes' });

    const inviteCode = group.generateInviteCode();
    await group.save();

    res.json({ 
      inviteCode,
      inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/join/${inviteCode}`
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Join group via invite code
router.post('/join/:inviteCode', auth, async (req, res) => {
  try {
    const group = await Group.findOne({ inviteCode: req.params.inviteCode });
    if (!group) return res.status(404).json({ message: 'Invalid invite code' });

    const isMember = group.members.some(m => m.user.toString() === req.user._id.toString());
    if (isMember) return res.status(400).json({ message: 'Already a member of this group' });

    group.members.push({ user: req.user._id, role: 'member' });
    await group.save();
    await group.populate('members.user', 'name email');
    await group.populate('createdBy', 'name email');

    res.json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get group by invite code
router.get('/invite/:inviteCode', async (req, res) => {
  try {
    const group = await Group.findOne({ inviteCode: req.params.inviteCode })
      .populate('createdBy', 'name email')
      .select('name description category createdBy membersCount');

    if (!group) return res.status(404).json({ message: 'Invalid invite code' });

    const memberCount = group.members ? group.members.length : 0;
    res.json({
      ...group.toObject(),
      memberCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get group stats
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const expenses = await Expense.find({ group: req.params.id });
    const settlements = await Settlement.find({ group: req.params.id });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0);

    const byCategory = {};
    expenses.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });

    const byMonth = {};
    expenses.forEach(e => {
      const month = new Date(e.date).toLocaleString('default', { month: 'short', year: 'numeric' });
      byMonth[month] = (byMonth[month] || 0) + e.amount;
    });

    res.json({
      totalExpenses,
      totalSettled,
      expenseCount: expenses.length,
      byCategory,
      byMonth,
      recentExpenses: expenses.slice(-5).reverse()
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get expenses for group
router.get('/:id/expenses', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query;
    const query = { group: req.params.id };
    if (category) query.category = category;

    const expenses = await Expense.find(query)
      .populate('paidBy', 'name email')
      .populate('splits.user', 'name email')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // For now, return just the expenses array to match frontend expectations
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Add expense to group
router.post('/:id/expenses', auth, async (req, res) => {
  try {
    const { description, amount, paidBy, splitType, participants, splits, category, date } = req.body;

    const group = await Group.findById(req.params.id).populate('members.user', 'name email');
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
      title: description,
      description,
      amount,
      category: category || 'other',
      group: req.params.id,
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

// Update expense in group
router.put('/:id/expenses/:expenseId', auth, async (req, res) => {
  try {
    const { description, amount, paidBy, splitType, participants, splits, category, date } = req.body;
    
    const expense = await Expense.findById(req.params.expenseId);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (expense.group.toString() !== req.params.id) {
      return res.status(400).json({ message: 'Expense does not belong to this group' });
    }

    const group = await Group.findById(req.params.id).populate('members.user', 'name email');
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

// Delete expense from group
router.delete('/:id/expenses/:expenseId', auth, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.expenseId);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (expense.group.toString() !== req.params.id) {
      return res.status(400).json({ message: 'Expense does not belong to this group' });
    }

    const group = await Group.findById(req.params.id);
    const isMember = group.members.some(m => m.user._id.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Access denied' });

    await Expense.findByIdAndDelete(req.params.expenseId);
    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get settlements for group
router.get('/:id/settlements', auth, async (req, res) => {
  try {
    const settlements = await Settlement.find({ group: req.params.id })
      .populate('payer', 'name email')
      .populate('payee', 'name email')
      .sort({ createdAt: -1 });

    res.json(settlements);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;