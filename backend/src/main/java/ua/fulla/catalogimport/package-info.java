/**
 * Fetching products from brand and shop sites, through one hardened {@link ua.fulla.catalogimport.PoliteFetcher}.
 *
 * <ul>
 *   <li><b>Brand site import</b> (ADR-0017, every profile): a brand verifies the ownership of its
 *   website and imports its products as Draft cards; one generic importer (brand feed → Shopify
 *   {@code products.json} → sitemap + JSON-LD); daily refresh for brands with imported cards.</li>
 *   <li><b>Dev-only demo import</b> (ADR-0014, Proposed): three fixed sources (Всі. Свої XML feed,
 *   One By One, Cher'17), robots.txt, ≥ 2 s between requests, ≤ 1 run per source per
 *   {@code fulla.import.min-run-interval} (default 6 h, never below 10 min), ≤ 50 products and
 *   ≤ 100 requests per source per run, images never copied. Its network part exists only with
 *   profile {@code dev} and {@code fulla.import.enabled=true}.</li>
 * </ul>
 * Cards are written only through {@link ua.fulla.products.ProductService}.
 */
package ua.fulla.catalogimport;
