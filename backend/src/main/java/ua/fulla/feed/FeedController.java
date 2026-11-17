package ua.fulla.feed;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code GET /api/feed} (api.md §2.2): public, no session needed. */
@RestController
class FeedController {

    /** {@code { items: FeedCard[] }}; an empty list is valid (US-08.1 CL). */
    record FeedResponse(List<FeedCard> items) {}

    private final FeedService service;

    FeedController(FeedService service) {
        this.service = service;
    }

    @GetMapping("/api/feed")
    FeedResponse feed() {
        return new FeedResponse(service.publishedCards());
    }
}
