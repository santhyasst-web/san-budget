-- Sub-categories per user per category
CREATE TABLE IF NOT EXISTS subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  UNIQUE(user_id, category, name)
);
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subcategories" ON subcategories
  FOR ALL USING (auth.uid() = user_id);

-- Add sub_label to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sub_label text NOT NULL DEFAULT '';
