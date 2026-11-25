package ua.fulla.feed;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code GET /api/brands} (api.md §2.2, ADR-0015): public, no session needed. */
@RestController
class BrandListController {

    private final BrandListService service;

    BrandListController(BrandListService service) {
        this.service = service;
    }

    /** Brands that have Published cards, by name; an empty list is valid. */
    @GetMapping("/api/brands")
    List<BrandSummary> brands() {
        return service.brands();
    }
}
