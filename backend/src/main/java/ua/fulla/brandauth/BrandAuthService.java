package ua.fulla.brandauth;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.fulla.brandprofile.BrandProfileService;
import ua.fulla.brandprofile.ProfileState;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;
import ua.fulla.common.PasswordLengthValidator;
import ua.fulla.common.StrictEmailValidator;

@Service
class BrandAuthService {

    /** The account that has just registered or logged in. */
    record AuthenticatedBrand(UUID brandId, String email, ProfileState profileState) {}

    private final BrandAccountRepository repository;
    private final BrandProfileService profiles;
    private final PasswordEncoder passwordEncoder;
    /** Checked when the email is unknown, so that both login failures take the same time. */
    private final String dummyHash;

    BrandAuthService(BrandAccountRepository repository, BrandProfileService profiles, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.profiles = profiles;
        this.passwordEncoder = passwordEncoder;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /**
     * Account + empty profile in one transaction (T-9). The format of the email and the password
     * is already checked by Bean Validation on the request record (@StrictEmail, @PasswordLength).
     */
    @Transactional
    AuthenticatedBrand register(String rawEmail, String password) {
        String email = StrictEmailValidator.normalize(rawEmail);

        UUID brandId;
        try {
            brandId = repository.insert(email, passwordEncoder.encode(password));
        } catch (DuplicateKeyException e) {
            // The UNIQUE index decides, also when two registrations race (INV-08).
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.EMAIL_TAKEN_OR_INVALID,
                "email is already registered", Map.of("email", ErrorCode.EMAIL_TAKEN_OR_INVALID));
        }
        profiles.createEmpty(brandId);
        return new AuthenticatedBrand(brandId, email, ProfileState.INCOMPLETE);
    }

    AuthenticatedBrand login(String rawEmail, String password) {
        String email = StrictEmailValidator.normalize(rawEmail);
        // An email that could never be registered is unknown by definition; it may also contain
        // characters the database refuses (U+0000), so it must not reach the query.
        Optional<BrandAccount> account = StrictEmailValidator.isValid(email)
            ? repository.findByEmail(email)
            : Optional.empty();
        String hash = account.map(BrandAccount::passwordHash).orElse(dummyHash);
        boolean passwordUsable = password != null && PasswordLengthValidator.fitsBcrypt(password);
        boolean passwordMatches = passwordUsable && passwordEncoder.matches(password, hash);

        if (account.isEmpty() || !passwordMatches) {
            // One answer for an unknown email and a wrong password (US-21.1 CL).
            throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }
        BrandAccount brand = account.get();
        return new AuthenticatedBrand(brand.id(), brand.email(), profiles.get(brand.id()).state());
    }
}
