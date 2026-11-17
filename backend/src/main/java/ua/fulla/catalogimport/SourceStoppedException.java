package ua.fulla.catalogimport;

/** The source said stop (403, 429, a bot challenge) or robots.txt can't be read: no more requests this run. */
class SourceStoppedException extends RuntimeException {

    SourceStoppedException(String message) {
        super(message);
    }

    SourceStoppedException(String message, Throwable cause) {
        super(message, cause);
    }
}
