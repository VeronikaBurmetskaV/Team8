package ua.fulla.feed;

import java.text.Collator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import ua.fulla.feed.BrandListRepository.BrandRow;

/**
 * The brands of the catalogue with their logos (ADR-0015). A logo is shown only when the brand
 * may be shown with its materials:
 * <ul>
 *   <li>a registered brand: only with consent (state CONSENTED, US-22.2) — without it null; the
 *       logo of its profile, else (only with {@code fulla.brands.source-logos}, i.e. dev) the
 *       logo of its own site found by the brand site import (ADR-0017);</li>
 *   <li>an imported brand (ADR-0014): the source site's logo, only for a single-brand source and
 *       only when {@code fulla.brands.source-logos} is on — set in {@code application-dev.yml}
 *       only, so {@code prod} and {@code ops} always get null.</li>
 * </ul>
 * Owners whose names give the same {@link BrandKey} are one brand: counts are added up, the
 * name of the owner with the most cards wins, a registered brand's logo before a source logo.
 */
@Service
class BrandListService {

    private static final Comparator<Object> UKRAINIAN = Collator.getInstance(Locale.forLanguageTag("uk"));

    private final BrandListRepository repository;
    private final boolean sourceLogos;

    BrandListService(BrandListRepository repository,
            @Value("${fulla.brands.source-logos:false}") boolean sourceLogos) {
        this.repository = repository;
        this.sourceLogos = sourceLogos;
    }

    List<BrandSummary> brands() {
        Map<String, List<BrandRow>> byKey = new LinkedHashMap<>();
        for (BrandRow row : repository.listWithPublishedCards()) {
            byKey.computeIfAbsent(BrandKey.of(row.name()), key -> new ArrayList<>()).add(row);
        }
        List<BrandSummary> brands = new ArrayList<>();
        byKey.forEach((key, rows) -> brands.add(merge(key, rows)));
        brands.sort(Comparator.comparing(BrandSummary::name, UKRAINIAN));
        return brands;
    }

    private BrandSummary merge(String key, List<BrandRow> rows) {
        BrandRow main = rows.stream().max(Comparator.comparingInt(BrandRow::productCount)).orElseThrow();
        int count = rows.stream().mapToInt(BrandRow::productCount).sum();
        String logo = rows.stream().filter(row -> !row.imported()).map(this::logoUrl)
            .filter(url -> url != null).findFirst()
            .orElseGet(() -> rows.stream().map(this::logoUrl).filter(url -> url != null).findFirst().orElse(null));
        return new BrandSummary(key, main.name().strip(), logo, count);
    }

    /** The logo this owner may show, as {@code logoDisplayUrl} of the profile does it; or null. */
    String logoUrl(BrandRow row) {
        if (row.imported()) {
            return sourceLogos && row.singleBrandSource() ? row.sourceLogoUrl() : null;
        }
        if (!row.consented()) {
            return null;
        }
        if (row.logoImageId() != null) {
            return "/api/images/" + row.logoImageId();
        }
        if (row.logoUrl() != null) {
            return row.logoUrl();
        }
        return sourceLogos ? row.siteLogoUrl() : null;
    }
}
