package ua.fulla.buyer;

import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;
import ua.fulla.common.StrictEmailValidator;

@Service
class BuyerAuthService {

    /** The account that has just registered. */
    record RegisteredBuyer(UUID buyerId, String email) {}

    private final BuyerAccountRepository repository;
    private final PasswordEncoder passwordEncoder;

    BuyerAuthService(BuyerAccountRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * US-02: creates the account. The format of the email and the password is already checked by
     * Bean Validation on the request record (@StrictEmail, @PasswordLength). Only the email and the
     * BCrypt hash are stored (NFR-19). The favourites move in a separate call,
     * {@code POST /api/me/favorites} (api.md §2.3, ADR-0012), not here.
     */
    RegisteredBuyer register(String rawEmail, String password) {
        String email = StrictEmailValidator.normalize(rawEmail);
        try {
            return new RegisteredBuyer(repository.insert(email, passwordEncoder.encode(password)), email);
        } catch (DuplicateKeyException e) {
            // The UNIQUE index decides, also when two registrations race (INV-08).
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.EMAIL_TAKEN_OR_INVALID,
                "email is already registered", Map.of("email", ErrorCode.EMAIL_TAKEN_OR_INVALID));
        }
    }
}
