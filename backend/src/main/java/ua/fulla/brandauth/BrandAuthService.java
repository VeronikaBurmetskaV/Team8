package ua.fulla.brandauth;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.fulla.brandprofile.BrandProfileService;
import ua.fulla.brandprofile.ProfileState;
import ua.fulla.common.ApiException;
import ua.fulla.common.ErrorCode;

@Service
class BrandAuthService {

    /** The account that has just registered or logged in. */
    record AuthenticatedBrand(UUID brandId, String email, ProfileState profileState) {}

    /** {@code name@domain.tld}: one @, no spaces, at least one dot in the domain (US-21 CL). */
    static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s.]+(\\.[^@\\s.]+)+$");
    static final int EMAIL_MAX = 254;
    static final int PASSWORD_MIN = 8;
    /** BCrypt reads only the first 72 bytes; Spring's encoder refuses longer passwords (Q-11). */
    static final int PASSWORD_MAX_BYTES = 72;

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

    /** Account + empty profile in one transaction (T-9). */
    @Transactional
    public AuthenticatedBrand register(String rawEmail, String password) {
        String email = normalize(rawEmail);

        // LinkedHashMap keeps the form order: the top-level code is the first failing field.
        Map<String, ErrorCode> fields = new LinkedHashMap<>();
        if (email.length() > EMAIL_MAX || !EMAIL.matcher(email).matches()) {
            fields.put("email", ErrorCode.EMAIL_TAKEN_OR_INVALID);
        }
        if (password == null || password.length() < PASSWORD_MIN || utf8Length(password) > PASSWORD_MAX_BYTES) {
            fields.put("password", ErrorCode.PASSWORD_TOO_SHORT);
        }
        if (!fields.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, fields.values().iterator().next(),
                "email must look like name@domain.tld; password must be 8-72 characters", fields);
        }

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
        Optional<BrandAccount> account = repository.findByEmail(normalize(rawEmail));
        String hash = account.map(BrandAccount::passwordHash).orElse(dummyHash);
        boolean passwordUsable = password != null && utf8Length(password) <= PASSWORD_MAX_BYTES;
        boolean passwordMatches = passwordUsable && passwordEncoder.matches(password, hash);

        if (account.isEmpty() || !passwordMatches) {
            // One answer for an unknown email and a wrong password (US-21.1 CL).
            throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }
        BrandAccount brand = account.get();
        return new AuthenticatedBrand(brand.id(), brand.email(), profiles.get(brand.id()).state());
    }

    /** T-10: the same normalization before every insert and lookup. */
    private static String normalize(String rawEmail) {
        return rawEmail == null ? "" : rawEmail.strip().toLowerCase(Locale.ROOT);
    }

    private static int utf8Length(String value) {
        return value.getBytes(StandardCharsets.UTF_8).length;
    }
}
