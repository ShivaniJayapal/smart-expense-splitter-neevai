const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Expense = require('../models/Expense');
const Group = require('../models/Group');
const AIService = require('../services/aiService');

// Rule-based category detection (fallback when OpenAI is unavailable)
function ruleBasedCategory(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const rules = {
    food: ['food', 'lunch', 'dinner', 'breakfast', 'restaurant', 'cafe', 'coffee', 'pizza', 'burger', 'meal', 'eat', 'snack', 'grocery', 'groceries', 'supermarket', 'biryani', 'zomato', 'swiggy'],
    travel: ['uber', 'ola', 'taxi', 'flight', 'train', 'bus', 'travel', 'petrol', 'fuel', 'toll', 'metro', 'auto', 'cab', 'transport', 'ticket', 'airport'],
    accommodation: ['hotel', 'rent', 'hostel', 'airbnb', 'room', 'stay', 'accommodation', 'pg', 'lodge'],
    entertainment: ['movie', 'cinema', 'concert', 'show', 'netflix', 'spotify', 'game', 'party', 'club', 'bar', 'event', 'theatre', 'tickets'],
    shopping: ['shop', 'amazon', 'flipkart', 'clothes', 'shoes', 'shopping', 'mall', 'purchase', 'buy'],
    utilities: ['electricity', 'water', 'internet', 'wifi', 'phone', 'bill', 'utilities', 'gas', 'maintenance', 'recharge'],
    health: ['doctor', 'medicine', 'pharmacy', 'hospital', 'medical', 'health', 'gym', 'fitness', 'yoga']
  };

  for (const [category, keywords] of Object.entries(rules)) {
    if (keywords.some(k => text.includes(k))) {
      return { category, confidence: 0.8, method: 'rule-based' };
    }
  }
  return { category: 'other', confidence: 0.5, method: 'rule-based' };
}

// AI Categorize expense
router.post('/categorize', auth, async (req, res) => {
  const { title, description } = req.body;

  // Try OpenAI first
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const prompt = `Categorize this expense into exactly one of these categories: food, travel, accommodation, entertainment, shopping, utilities, health, other.

Expense: "${title}"
Description: "${description || 'none'}"

Respond with JSON only: {"category": "...", "confidence": 0.0-1.0, "reason": "brief reason"}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3
      });

      const content = response.choices[0].message.content.trim();
      const parsed = JSON.parse(content);
      return res.json({ ...parsed, method: 'ai' });
    } catch (err) {
      console.log('OpenAI failed, using rule-based:', err.message);
    }
  }

  // Fallback to rule-based
  const result = ruleBasedCategory(title, description);
  res.json(result);
});

// AI Spending Insights
router.get('/insights/:groupId', auth, async (req, res) => {
  try {
    const expenses = await Expense.find({ group: req.params.groupId })
      .populate('paidBy', 'name')
      .sort({ date: -1 })
      .limit(50);

    if (expenses.length === 0) {
      return res.json({ insights: ['Add some expenses to get AI-powered insights!'], method: 'none' });
    }

    // Calculate stats
    const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);
    const byCategory = {};
    const byPerson = {};
    const recent30 = expenses.filter(e => new Date(e.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const prev30 = expenses.filter(e => {
      const d = new Date(e.date);
      return d < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && d > new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    });

    expenses.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      byPerson[e.paidBy.name] = (byPerson[e.paidBy.name] || 0) + e.amount;
    });

    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const topSpender = Object.entries(byPerson).sort((a, b) => b[1] - a[1])[0];
    const recent30Total = recent30.reduce((s, e) => s + e.amount, 0);
    const prev30Total = prev30.reduce((s, e) => s + e.amount, 0);

    // Try OpenAI for insights
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const statsText = `Total: ₹${totalAmount.toFixed(0)}, Expenses: ${expenses.length}, Top category: ${topCategory?.[0]} (₹${topCategory?.[1].toFixed(0)}), Top spender: ${topSpender?.[0]} (₹${topSpender?.[1].toFixed(0)}), Last 30 days: ₹${recent30Total.toFixed(0)}, Previous 30 days: ₹${prev30Total.toFixed(0)}`;

        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'user',
            content: `Based on these group expense stats, provide 3 concise, actionable insights (each max 15 words): ${statsText}. Return JSON: {"insights": ["...", "...", "..."]}`
          }],
          max_tokens: 200,
          temperature: 0.7
        });

        const parsed = JSON.parse(response.choices[0].message.content.trim());
        return res.json({ ...parsed, method: 'ai' });
      } catch (err) {
        console.log('OpenAI insights failed, using rule-based');
      }
    }

    // Fallback rule-based insights
    const insights = [];
    if (topCategory) insights.push(`💰 ${topCategory[0].charAt(0).toUpperCase() + topCategory[0].slice(1)} is your top spending category at ₹${topCategory[1].toFixed(0)}`);
    if (topSpender) insights.push(`👑 ${topSpender[0]} has paid the most — ₹${topSpender[1].toFixed(0)} so far`);
    if (prev30Total > 0) {
      const change = ((recent30Total - prev30Total) / prev30Total * 100).toFixed(0);
      const emoji = change > 0 ? '📈' : '📉';
      insights.push(`${emoji} Spending ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change)}% compared to last month`);
    } else if (recent30Total > 0) {
      insights.push(`📊 You've spent ₹${recent30Total.toFixed(0)} in the last 30 days`);
    }

    if (insights.length === 0) insights.push('🎉 Great job tracking expenses! Keep it up.');

    res.json({ insights, method: 'rule-based' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// AI Smart Split Suggestion
router.post('/suggest-split', auth, async (req, res) => {
  const { title, amount, members } = req.body;

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `For expense "${title}" of ₹${amount} among ${members.length} people, should this be split equally or would a custom split make more sense? Respond: {"suggestion": "equal" or "custom", "reason": "brief reason"}`
        }],
        max_tokens: 100
      });

      return res.json(JSON.parse(response.choices[0].message.content.trim()));
    } catch (err) {
      console.log('OpenAI suggest-split failed');
    }
  }

  res.json({ suggestion: 'equal', reason: 'Equal split is fairest for most shared expenses' });
});

// Enhanced AI categorization using AIService
router.post('/categorize-enhanced', auth, async (req, res) => {
  try {
    const { description, amount, groupId } = req.body;
    
    // Get group context
    let groupContext = '';
    if (groupId) {
      const group = await Group.findById(groupId).populate('members.user', 'name');
      groupContext = `Group: ${group.name}, Members: ${group.members.length}, Category: ${group.category}`;
    }

    const category = await AIService.categorizeExpense(description, amount, groupContext);
    res.json({ category, method: 'ai-enhanced' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// AI expense description suggestions
router.post('/suggestions', auth, async (req, res) => {
  try {
    const { groupId } = req.body;
    
    // Get group context and recent expenses
    let groupContext = '';
    let recentExpenses = [];
    
    if (groupId) {
      const group = await Group.findById(groupId);
      groupContext = `Group: ${group.name}, Category: ${group.category}`;
      
      recentExpenses = await Expense.find({ group: groupId })
        .sort({ date: -1 })
        .limit(5)
        .populate('paidBy', 'name');
    }

    const suggestions = await AIService.generateExpenseSuggestions(groupContext, recentExpenses);
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Enhanced AI spending insights
router.get('/insights-enhanced/:groupId', auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { timeFrame = 'month' } = req.query;
    
    // Get expenses and group data
    const expenses = await Expense.find({ group: groupId })
      .populate('paidBy', 'name')
      .sort({ date: -1 })
      .limit(100);
    
    const group = await Group.findById(groupId).populate('members.user', 'name');
    const groupMembers = group.members.map(m => m.user.name);

    const insights = await AIService.generateSpendingInsights(expenses, groupMembers, timeFrame);
    res.json({ insights, method: 'ai-enhanced' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// AI optimization suggestions
router.get('/optimization/:groupId', auth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { budget } = req.query;
    
    // Get expenses
    const expenses = await Expense.find({ group: groupId })
      .sort({ date: -1 })
      .limit(100);
    
    const suggestions = await AIService.generateOptimizationSuggestions(expenses, budget);
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// AI chat interface
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, conversationHistory = [], groupId } = req.body;
    
    // Get group context
    let groupContext = '';
    if (groupId) {
      const group = await Group.findById(groupId);
      groupContext = `Group: ${group.name}, Category: ${group.category}, Members: ${group.members.length}`;
    }

    const response = await AIService.chatWithAI(message, conversationHistory, groupContext);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;