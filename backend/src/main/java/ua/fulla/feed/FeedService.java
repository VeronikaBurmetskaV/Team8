package ua.fulla.feed;

import java.util.List;
import org.springframework.stereotype.Service;

/** The public swipe feed (US-08.1, US-08.2). */
@Service
class FeedService {

    private final FeedRepository repository;

    FeedService(FeedRepository repository) {
        this.repository = repository;
    }

    List<FeedCard> publishedCards() {
        return repository.listPublished();
    }
}
