const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class AIService {
  // Categorize expense using AI
  static async categorizeExpense(description, amount, groupContext = '') {
    try {
      const prompt = `As an expense categorization expert, categorize this expense:
      
      Description: "${description}"
      Amount: $${amount}
      Group Context: ${groupContext}
      
      Available categories: food, transportation, entertainment, shopping, bills, healthcare, education, travel, other
      
      Return only the category name (lowercase) that best fits this expense.`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expense categorization expert. Always respond with just the category name in lowercase."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 10,
        temperature: 0.3,
      });

      const category = response.choices[0]?.message?.content?.trim().toLowerCase();
      return category || 'other';
    } catch (error) {
      console.error('AI categorization error:', error);
      return 'other';
    }
  }

  // Generate expense description suggestions
  static async generateExpenseSuggestions(groupContext, recentExpenses = []) {
    try {
      const expensesText = recentExpenses.slice(0, 5).map(exp => 
        `- ${exp.description} ($${exp.amount})`
      ).join('\n');

      const prompt = `Generate 3 creative expense description suggestions for a group expense tracking app.
      
      Group Context: ${groupContext}
      Recent expenses in this group:
      ${expensesText}
      
      Return only a JSON array of 3 short, descriptive expense suggestions (max 30 characters each).
      Example: ["Coffee meeting", "Team lunch", "Office supplies"]`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expense tracking assistant. Always respond with valid JSON array containing 3 short expense descriptions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      const suggestions = response.choices[0]?.message?.content?.trim();
      return JSON.parse(suggestions) || [];
    } catch (error) {
      console.error('AI suggestions error:', error);
      return [];
    }
  }

  // Generate spending insights
  static async generateSpendingInsights(expenses, groupMembers, timeFrame = 'month') {
    try {
      const expensesData = expenses.map(exp => ({
        description: exp.description,
        amount: exp.amount,
        category: exp.category,
        date: exp.date,
        paidBy: exp.paidBy?.name || 'Unknown'
      }));

      const prompt = `Analyze these group expenses and provide 3 key insights about spending patterns.
      
      Time Frame: ${timeFrame}
      Group Members: ${groupMembers.length}
      Total Expenses: $${expenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)}
      
      Expense Data:
      ${JSON.stringify(expensesData, null, 2)}
      
      Return only a JSON array with 3 insights, each containing:
      - "type": "trend" | "anomaly" | "recommendation"
      - "title": short title (max 50 chars)
      - "description": detailed explanation (max 150 chars)
      - "impact": "high" | "medium" | "low"`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a financial analyst. Always respond with valid JSON array containing 3 insights with the specified structure."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.5,
      });

      const insights = response.choices[0]?.message?.content?.trim();
      return JSON.parse(insights) || [];
    } catch (error) {
      console.error('AI insights error:', error);
      return [];
    }
  }

  // Generate optimization suggestions
  static async generateOptimizationSuggestions(expenses, groupBudget = null) {
    try {
      const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const categoryBreakdown = expenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
        return acc;
      }, {});

      const prompt = `Analyze group spending and provide 3 optimization suggestions.
      
      Total Spent: $${totalSpent.toFixed(2)}
      Budget: ${groupBudget ? `$${groupBudget}` : 'Not specified'}
      Category Breakdown:
      ${Object.entries(categoryBreakdown).map(([cat, amount]) => 
        `- ${cat}: $${amount.toFixed(2)}`
      ).join('\n')}
      
      Return only a JSON array with 3 suggestions, each containing:
      - "category": the expense category to optimize
      - "suggestion": actionable advice (max 100 chars)
      - "potentialSavings": estimated monthly savings in dollars
      - "difficulty": "easy" | "medium" | "hard"`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a cost optimization expert. Always respond with valid JSON array containing 3 suggestions with the specified structure."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 250,
        temperature: 0.4,
      });

      const suggestions = response.choices[0]?.message?.content?.trim();
      return JSON.parse(suggestions) || [];
    } catch (error) {
      console.error('AI optimization error:', error);
      return [];
    }
  }

  // AI Chat for expense assistance
  static async chatWithAI(message, conversationHistory = [], groupContext = '') {
    try {
      const systemPrompt = `You are a helpful expense management assistant for a group expense tracking app. 
      Group Context: ${groupContext}
      
      Help users with:
      - Expense categorization questions
      - Budget advice and tips
      - Expense tracking best practices
      - Understanding spending patterns
      - General financial guidance for groups
      
      Be concise, helpful, and friendly. If you don't know something, admit it and suggest alternatives.`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.slice(-10), // Keep last 10 messages for context
        { role: "user", content: message }
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 150,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content?.trim() || "I'm sorry, I couldn't process that request.";
    } catch (error) {
      console.error('AI chat error:', error);
      return "I'm experiencing some technical difficulties. Please try again later.";
    }
  }
}

module.exports = AIService;
