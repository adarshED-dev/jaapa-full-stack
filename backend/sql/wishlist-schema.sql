-- Anonymous wishlists, mirroring the cart tables. The browser holds the
-- wishlist id in localStorage; there's no account attached.
CREATE TABLE IF NOT EXISTS wishlists (
    id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- No quantity column: a product is either saved or it isn't. The composite
-- primary key is what makes "save" idempotent.
CREATE TABLE IF NOT EXISTS wishlist_items (
    wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (wishlist_id, product_id)
);

CREATE INDEX IF NOT EXISTS wishlist_items_product_id_idx ON wishlist_items(product_id);
