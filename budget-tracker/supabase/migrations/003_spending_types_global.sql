-- Make spending types global (remove category scoping)
ALTER TABLE subcategories DROP COLUMN IF EXISTS category;
ALTER TABLE subcategories ADD CONSTRAINT subcategories_user_name_unique UNIQUE (user_id, name);
