CREATE TABLE IF NOT EXISTS product_variants (
    id BIGSERIAL PRIMARY KEY,
    product_id VARCHAR NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    sku VARCHAR,
    selling_price NUMERIC NOT NULL,
    compare_price NUMERIC,
    quantity INTEGER,
    available BOOLEAN NOT NULL DEFAULT TRUE,
    image VARCHAR,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS product_variants_product_id_idx ON product_variants(product_id);
