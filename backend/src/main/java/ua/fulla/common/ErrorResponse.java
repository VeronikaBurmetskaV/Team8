package ua.fulla.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/** The single error envelope: {@code { "error": { "code", "message", "fields"? } }} (api.md §3.1). */
public record ErrorResponse(Body error) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Body(ErrorCode code, String message, Map<String, ErrorCode> fields) {}

    public static ErrorResponse of(ErrorCode code, String message) {
        return new ErrorResponse(new Body(code, message, null));
    }
}
