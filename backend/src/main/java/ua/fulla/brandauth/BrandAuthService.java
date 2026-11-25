package ua.fulla.brandauth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.fulla.brandprofile.BrandProfile;
import ua.fulla.brandprofile.BrandProfileService;
import ua.fulla.brandprofile.ProfileState;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;
import ua.fulla.common.PasswordLengthValidator;
import ua.fulla.common.StrictEmailValidator;
import ua.fulla.common.UnicodeText;

@Service
class BrandAuthService {

    /** The account that has just registered or logged in. */
    record AuthenticatedBrand(UUID brandId, String email, ProfileState profileState) {}

    private final BrandAccountRepository repository;
    private final BrandProfileService profiles;
    private final PasswordEncoder passwordEncoder;

    BrandAuthService(BrandAccountRepository repository, BrandProfileService profiles, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.profiles = profiles;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Account + profile with the contact name, brand name and website in one transaction (T-9,
     * US-21). Every field is
     * already checked by Bean Validation on the request record (@DisplayName, @BrandName, @WebsiteUrl,
     * @StrictEmail, @PasswordLength). The website is only stored, never requested (A-15).
     */
    @Transactional
    AuthenticatedBrand register(String rawEmail, String password, String contactName, String name,
            String websiteUrl) {
        String email = StrictEmailValidator.normalize(rawEmail);

        UUID brandId;
        try {
            brandId = repository.insert(email, passwordEncoder.encode(password));
        } catch (DuplicateKeyException e) {
            // The UNIQUE index decides, also when two registrations race (INV-08).
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.EMAIL_TAKEN_OR_INVALID,
                "email is already registered", Map.of("email", ErrorCode.EMAIL_TAKEN_OR_INVALID));
        }
        // With a name the profile is ACTIVE at once (domain-model.md §4.1).
        ProfileState state = profiles.create(brandId, contactName, name, websiteUrl).state();
        return new AuthenticatedBrand(brandId, email, state);
    }

    /**
     * Login with the brand name, email and password (US-21.1, ADR-0018). The checks run in this
     * order and the first that fails answers {@code 401} with its own code and field:
     * {@code EMAIL_NOT_FOUND} (fields.email) → {@code WRONG_PASSWORD} (fields.password) →
     * {@code BRAND_NAME_MISMATCH} (fields.brandName). The name is compared only after the
     * email and password are right, so it can't be guessed without the password. Every attempt,
     * failed or not, is counted by the AttemptLimiter before this method runs.
     */
    AuthenticatedBrand login(String brandName, String rawEmail, String password) {
        String email = StrictEmailValidator.normalize(rawEmail);
        // An email that could never be registered is unknown by definition; it may also contain
        // characters the database refuses (U+0000), so it must not reach the query.
        Optional<BrandAccount> account = StrictEmailValidator.isValid(email)
            ? repository.findByEmail(email)
            : Optional.empty();
        if (account.isEmpty()) {
            throw loginFailed(ErrorCode.EMAIL_NOT_FOUND, "email", "No brand account with this email");
        }
        BrandAccount brand = account.get();
        boolean passwordMatches = password != null && PasswordLengthValidator.fitsBcrypt(password)
            && passwordEncoder.matches(password, brand.passwordHash());
        if (!passwordMatches) {
            throw loginFailed(ErrorCode.WRONG_PASSWORD, "password", "Wrong password");
        }
        BrandProfile profile = profiles.get(brand.id());
        if (!sameBrandName(profile.name(), brandName)) {
            throw loginFailed(ErrorCode.BRAND_NAME_MISMATCH, "brandName",
                "The brand name differs from the one saved at registration");
        }
        return new AuthenticatedBrand(brand.id(), brand.email(), profile.state());
    }

    private static ApiException loginFailed(ErrorCode code, String field, String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, code, message, Map.of(field, code));
    }

    /**
     * Whether the name typed at login is the brand's saved name: compared by {@link #nameKey}, so
     * case, surrounding and repeated spaces and Unicode forms (NFKC) don't matter.
     *
     * <p>TODO(brand login name): a brand registered before names were asked has none saved yet
     * (state INCOMPLETE): then the field is not checked (login by email + password) and the
     * typed name is NOT saved. Check it always once every profile has a name.
     */
    static boolean sameBrandName(String saved, String typed) {
        if (saved == null) {
            return true;
        }
        if (typed == null) {
            return false;
        }
        return MessageDigest.isEqual(nameKey(saved).getBytes(StandardCharsets.UTF_8),
            nameKey(typed).getBytes(StandardCharsets.UTF_8));
    }

    /** NFKC, trimmed (non-breaking spaces too), runs of spaces → one, lower case. */
    static String nameKey(String name) {
        String normalized = Normalizer.normalize(name, Normalizer.Form.NFKC);
        return UnicodeText.trim(normalized).replaceAll("[\\s\\p{Z}]+", " ").toLowerCase(Locale.ROOT);
    }
}
