export const VARIABLE_CATEGORIES = [
  'Grocery',
  'Outside Food',
  'Skin Care',
  'Hair Care',
  'Home Expense',
  'Misc',
  'Business Expense',
  'Uber',
  'Books',
] as const

export type VariableCategory = typeof VARIABLE_CATEGORIES[number]

export const DEFAULT_VARIABLE_BUDGETS: Record<string, number> = {
  'Grocery': 0,
  'Outside Food': 0,
  'Skin Care': 0,
  'Hair Care': 0,
  'Home Expense': 0,
  'Misc': 0,
  'Business Expense': 0,
  'Uber': 0,
  'Books': 0,
}

export const VENDOR_SUGGESTIONS: Record<string, string[]> = {
  'Grocery': ['Walmart', 'Onkar', 'No Frills', 'FoodBasics'],
  'Outside Food': ['UberEats', 'Madras', 'Bar Burrito', 'Malabar', 'Raja Biriyani', 'DQ', 'Simply South', 'D Spot'],
  'Skin Care': ['Niacinamide', 'Oceania', 'Moisturizer', 'Anita skin care'],
  'Hair Care': ['Hair cut'],
  'Home Expense': ['Basement shelf', 'Bug Clean'],
  'Misc': ['Bowling', 'Keyboard', 'Yoga mat', 'Shein', 'Temu', 'Eye brows', 'Wardrobe'],
  'Business Expense': ['Vapi', 'Twilio', 'Anthropic', 'Amazon'],
  'Uber': ['Movati', 'GRT Card', 'Oceania'],
  'Books': ['Bhagavad Gita', 'Mahabarat', 'Kling'],
}

export const DEFAULT_FIXED_EXPENSES: Array<{ category: string; budgeted: number }> = [
  { category: 'Mortgage', budgeted: 0 },
  { category: 'Utilities', budgeted: 0 },
  { category: 'Phone', budgeted: 0 },
  { category: 'Internet', budgeted: 0 },
  { category: 'YouTube Premium', budgeted: 0 },
  { category: 'IPTV', budgeted: 0 },
  { category: 'Property Tax', budgeted: 0 },
  { category: 'Home Insurance', budgeted: 0 },
  { category: 'Movati', budgeted: 0 },
]
