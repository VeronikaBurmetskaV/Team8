package ua.fulla.common;

import java.util.regex.Pattern;

/**
 * The buyer's «Email або номер телефону» (US-02): with «@» it is an email (StrictEmail rules,
 * normalized), otherwise a phone normalized to E.164. The same rules as parseLoginId in
 * frontend/src/shared/loginId.ts; both sides test validation.examples.json («loginId»).
 *
 * <p>Phone: only digits, spaces, brackets, hyphens and a leading «+». Ukrainian numbers in the
 * forms 0XXXXXXXXX, 380XXXXXXXXX or +380XXXXXXXXX become +380XXXXXXXXX; other countries need a
 * leading «+» and 8–15 digits (the first not 0). The number is not verified by SMS (ADR-0016).
 */
public record LoginId(Kind kind, String value) {

    public enum Kind { EMAIL, PHONE }

    private static final Pattern PHONE_CHARS = Pattern.compile("^\\+?[0-9 ()\\-]+$");
    private static final Pattern SEPARATORS = Pattern.compile("[ ()\\-]");
    /** E.164: «+», a non-zero first digit, 8–15 digits in all (the DB CHECK is the same). */
    public static final Pattern E164 = Pattern.compile("^\\+[1-9][0-9]{7,14}$");

    /** The login, or null when it is neither a valid email nor a valid phone number. */
    public static LoginId parse(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = UnicodeText.trim(raw);
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.contains("@")) {
            String email = StrictEmailValidator.normalize(trimmed);
            return StrictEmailValidator.isValid(email) ? new LoginId(Kind.EMAIL, email) : null;
        }
        String phone = normalizePhone(trimmed);
        return phone == null ? null : new LoginId(Kind.PHONE, phone);
    }

    private static String normalizePhone(String text) {
        if (!PHONE_CHARS.matcher(text).matches()) {
            return null;
        }
        boolean plus = text.startsWith("+");
        String digits = SEPARATORS.matcher(plus ? text.substring(1) : text).replaceAll("");
        String e164;
        if (plus) {
            if (digits.startsWith("380") && digits.length() != 12) {
                return null; // a Ukrainian number has exactly 9 digits after 380
            }
            e164 = "+" + digits;
        } else if (digits.length() == 10 && digits.startsWith("0")) {
            e164 = "+380" + digits.substring(1);
        } else if (digits.length() == 12 && digits.startsWith("380")) {
            e164 = "+" + digits;
        } else {
            return null;
        }
        return E164.matcher(e164).matches() ? e164 : null;
    }
}
