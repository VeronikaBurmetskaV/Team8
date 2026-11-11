package ua.fulla.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Walking-skeleton liveness check. Not in api.md yet: to be added to the contract. */
@RestController
public class HealthController {

    public record HealthResponse(String status) {}

    @GetMapping("/api/health")
    public HealthResponse health() {
        return new HealthResponse("UP");
    }
}
