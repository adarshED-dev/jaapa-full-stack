-- Attach carts and wishlists to a customer account.
--
-- Run after cart-schema.sql, wishlist-schema.sql and customer-auth-schema.sql:
--   psql -d <your-db> -f sql/account-linking.sql
--
-- Both stay usable by guests: customer_id is nullable, and an anonymous cart
-- is exactly what it was before. Signing in claims the anonymous one and
-- merges it into the account's, so a shopper who filled a cart before logging
-- in doesn't lose it.

ALTER TABLE carts ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE wishlists ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE CASCADE;

-- One active cart and one wishlist per account. Partial, so the countless
-- anonymous rows (customer_id IS NULL) are unaffected, and so a cart that has
-- been converted to an order doesn't block the next one.
CREATE UNIQUE INDEX IF NOT EXISTS carts_customer_active_key
    ON carts (customer_id) WHERE customer_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS wishlists_customer_key
    ON wishlists (customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS carts_customer_id_idx ON carts (customer_id);
CREATE INDEX IF NOT EXISTS wishlists_customer_id_idx ON wishlists (customer_id);
