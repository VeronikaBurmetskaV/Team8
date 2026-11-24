/**
 * Dev-only demo catalogue import (ADR-0014, Proposed): three fixed sources (Всі. Свої XML feed,
 * One By One, Cher'17), robots.txt, ≥ 2 s between requests, ≤ 1 run per source per
 * {@code fulla.import.min-run-interval} (default 6 h, never below 10 min), ≤ 50 products and
 * ≤ 100 requests per source per run, images never copied. The network part
 * (fetcher, importers, scheduler) exists only with profile {@code dev} and
 * {@code fulla.import.enabled=true}; cards are written only through
 * {@link ua.fulla.products.ProductService}.
 */
package ua.fulla.catalogimport;
