package ua.fulla.buyer;

import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;
import ua.fulla.common.DisplayName;
import ua.fulla.common.LoginId;

@Service
class BuyerAuthService {

    /** The account that has just registered: an email or a phone, and the optional name. */
    record RegisteredBuyer(UUID buyerId, String email, String phone, String name) {

        /** The login the person typed, normalized: the email or the phone. */
        String login() {
            return email != null ? email : phone;
        }
    }

    private final BuyerAccountRepository repository;
    private final PasswordEncoder passwordEncoder;

    BuyerAuthService(BuyerAccountRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * US-02: creates the account by email OR phone, with a name (ADR-0016). The formats
     * are already checked by Bean Validation on the request record (@BuyerLogin, @PasswordLength,
     * @DisplayName). Only the login, the BCrypt hash and the name are stored (NFR-19). The phone
     * is not verified by SMS. The favourites move in a separate call,
     * {@code POST /api/me/favorites} (api.md §2.3, ADR-0012), not here.
     */
    RegisteredBuyer register(String rawLogin, String password, String rawName) {
        LoginId login = LoginId.parse(rawLogin);
        if (login == null) {
            // Bean Validation already refused it; kept for direct callers.
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.LOGIN_INVALID,
                "login must be an email or a phone number", Map.of("login", ErrorCode.LOGIN_INVALID));
        }
        String email = login.kind() == LoginId.Kind.EMAIL ? login.value() : null;
        String phone = login.kind() == LoginId.Kind.PHONE ? login.value() : null;
        String name = DisplayName.Validator.normalize(rawName);
        try {
            UUID id = repository.insert(email, phone, passwordEncoder.encode(password), name);
            return new RegisteredBuyer(id, email, phone, name);
        } catch (DuplicateKeyException e) {
            // The UNIQUE indexes decide, also when two registrations race (INV-08). One neutral
            // answer for a taken email and a taken phone: it never tells which accounts exist.
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.EMAIL_TAKEN_OR_INVALID,
                "login is already registered", Map.of("login", ErrorCode.EMAIL_TAKEN_OR_INVALID));
        }
    }
}
