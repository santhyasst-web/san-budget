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
  'Grocery': 350,
  'Outside Food': 300,
  'Skin Care': 250,
  'Hair Care': 20,
  'Home Expense': 300,
  'Misc': 400,
  'Business Expense': 100,
  'Uber': 500,
  'Books': 40,
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
  { category: 'Mortgage', budgeted: 2675.47 },
  { category: 'Utilities', budgeted: 300 },
  { category: 'Phone', budgeted: 36.16 },
  { category: 'Internet', budgeted: 62.14 },
  { category: 'YouTube Premium', budgeted: 1 },
  { category: 'IPTV', budgeted: 8.33 },
  { category: 'Property Tax', budgeted: 272.46 },
  { category: 'Home Insurance', budgeted: 86.23 },
  { category: 'Movati', budgeted: 111 },
]
