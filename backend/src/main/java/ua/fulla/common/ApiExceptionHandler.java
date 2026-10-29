package ua.fulla.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** The one place that turns exceptions into the error envelope (api.md §3, CLAUDE.md §5.2). */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ErrorResponse> notFound(NoResourceFoundException e) {
        return error(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, "No such resource");
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        MethodArgumentNotValidException.class,
        HttpRequestMethodNotSupportedException.class
    })
    ResponseEntity<ErrorResponse> badRequest(Exception e) {
        return error(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Malformed or invalid request");
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

    private static ResponseEntity<ErrorResponse> error(HttpStatus status, ErrorCode code, String message) {
        return ResponseEntity.status(status).body(ErrorResponse.of(code, message));
    }
}
