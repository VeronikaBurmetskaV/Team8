package ua.fulla.common;

import java.util.Map;
import org.springframework.http.HttpStatus;

/**
 * Thrown by services to answer with a specific contract code (api.md §3.2).
 * {@link ApiExceptionHandler} turns it into the single error envelope.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final ErrorCode code;
    private final Map<String, ErrorCode> fields;

    /** @param fields request field → code, in form order; empty when no field is to blame */
    public ApiException(HttpStatus status, ErrorCode code, String message, Map<String, ErrorCode> fields) {
        super(message);
        this.status = status;
        this.code = code;
        this.fields = fields;
    }

    public ApiException(HttpStatus status, ErrorCode code, String message) {
        this(status, code, message, Map.of());
    }

    public HttpStatus status() {
        return status;
    }

    public ErrorCode code() {
        return code;
    }

    public Map<String, ErrorCode> fields() {
        return fields;
    }
}
