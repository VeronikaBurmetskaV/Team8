package ua.fulla.common;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** The one place that turns exceptions into the error envelope (api.md §3, CLAUDE.md §5.2). */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private static final String INVALID_REQUEST = "Malformed or invalid request";

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> apiError(ApiException e) {
        return error(e.status(), e.code(), e.getMessage(), e.fields());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ErrorResponse> notFound(NoResourceFoundException e) {
        return error(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, "No such resource");
    }

    /**
     * Bean Validation of a {@code @Valid} request record. Our constraints carry the message
     * "ERROR_CODE: developer text" (see {@link StrictEmail}); it becomes the code of the field.
     * The top-level code is the first failing field in the order of the record (= form order).
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> invalidBody(MethodArgumentNotValidException e) {
        // The validator reports errors in no particular order, so sort them by the record.
        List<String> fieldOrder = fieldOrder(e.getBindingResult().getTarget());
        List<FieldError> errors = e.getBindingResult().getFieldErrors().stream()
            .sorted(Comparator.comparingInt((FieldError error) -> {
                int index = fieldOrder.indexOf(error.getField());
                return index < 0 ? Integer.MAX_VALUE : index;
            }))
            .toList();
        if (errors.isEmpty()) {
            return error(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, INVALID_REQUEST);
        }

        Map<String, ErrorCode> fields = new LinkedHashMap<>();
        for (FieldError error : errors) {
            fields.putIfAbsent(error.getField(), codeOf(error));
        }
        FieldError first = errors.get(0);
        return error(HttpStatus.BAD_REQUEST, codeOf(first), textOf(first), fields);
    }

    /** An upload above spring.servlet.multipart.max-file-size (5 MB), refused while the request is read (ADR-0007). */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ErrorResponse> uploadTooLarge(MaxUploadSizeExceededException e) {
        return error(HttpStatus.BAD_REQUEST, ErrorCode.IMAGE_INVALID, "image must be at most 5242880 bytes");
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        HttpRequestMethodNotSupportedException.class,
        // A wrong or missing Content-Type / Accept is the client's mistake, not a server failure.
        HttpMediaTypeNotSupportedException.class,
        HttpMediaTypeNotAcceptableException.class,
        // A path variable of the wrong type, e.g. /api/images/abc instead of a UUID.
        MethodArgumentTypeMismatchException.class,
        // A broken multipart body.
        MultipartException.class
    })
    ResponseEntity<ErrorResponse> badRequest(Exception e) {
        return error(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, INVALID_REQUEST);
    }

    @ExceptionHandler(DataAccessResourceFailureException.class)
    ResponseEntity<ErrorResponse> databaseDown(DataAccessResourceFailureException e) {
        log.error("Database unavailable", e);
        return error(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.SERVICE_UNAVAILABLE, "Database unavailable");
    }

    // The contract has no code for unexpected errors yet; SERVICE_UNAVAILABLE is the closest one.
    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception e) {
        log.error("Unexpected error", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.SERVICE_UNAVAILABLE, "Unexpected server error");
    }

    private static List<String> fieldOrder(Object requestRecord) {
        if (requestRecord == null || !requestRecord.getClass().isRecord()) {
            return List.of();
        }
        return Arrays.stream(requestRecord.getClass().getRecordComponents())
            .map(RecordComponent::getName)
            .toList();
    }

    /** "ERROR_CODE: text" → ERROR_CODE; a standard constraint without our prefix → VALIDATION_FAILED. */
    private static ErrorCode codeOf(FieldError error) {
        String prefix = String.valueOf(error.getDefaultMessage()).split(": ", 2)[0];
        try {
            return ErrorCode.valueOf(prefix);
        } catch (IllegalArgumentException e) {
            return ErrorCode.VALIDATION_FAILED;
        }
    }

    private static String textOf(FieldError error) {
        String[] parts = String.valueOf(error.getDefaultMessage()).split(": ", 2);
        return parts.length == 2 ? parts[1] : INVALID_REQUEST;
    }

    private static ResponseEntity<ErrorResponse> error(HttpStatus status, ErrorCode code, String message) {
        return error(status, code, message, Map.of());
    }

    private static ResponseEntity<ErrorResponse> error(
            HttpStatus status, ErrorCode code, String message, Map<String, ErrorCode> fields) {
        // "fields" is optional in the envelope: left out when no field is to blame
        var body = new ErrorResponse.Body(code, message, fields.isEmpty() ? null : fields);
        // The explicit type makes the envelope JSON even when the request's Accept header asks for something else.
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(new ErrorResponse(body));
    }
}
