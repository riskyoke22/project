import { customType } from 'drizzle-orm/pg-core';

/**
 * Tipe data custom PostgreSQL untuk citext (case-insensitive text)
 */
export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

/**
 * Tipe data custom PostgreSQL untuk ltree (hierarki pohon path)
 */
export const ltree = customType<{ data: string }>({
  dataType() {
    return 'ltree';
  },
});

/**
 * Tipe data custom PostgreSQL untuk inet (alamat IP IPv4/IPv6)
 */
export const inet = customType<{ data: string }>({
  dataType() {
    return 'inet';
  },
});

/**
 * Tipe data custom PostgreSQL untuk bytea (data biner/enkripsi)
 */
export const bytea = customType<{ data: Buffer | Uint8Array }>({
  dataType() {
    return 'bytea';
  },
});

/**
 * Tipe data custom PostgreSQL untuk tsvector (pencarian teks penuh)
 */
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});
