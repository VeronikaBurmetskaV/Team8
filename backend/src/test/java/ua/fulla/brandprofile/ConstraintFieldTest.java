package ua.fulla.brandprofile;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;
import org.junit.jupiter.api.Test;
import org.postgresql.util.PSQLException;
import org.postgresql.util.ServerErrorMessage;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Regression for the bug found on Windows with the OS locale {@code Ukrainian_Ukraine.1251}: the
 * embedded PostgreSQL answered in Ukrainian («порушує перевірне обмеження»), the old regex looked
 * for the English word «constraint», and {@code PUT /api/brand/profile} answered
 * {@code 400 PROFILE_INVALID} with {@code fields: {}} instead of {@code fields.websiteUrl}.
 * The field must not depend on the language of the server messages (lc_messages).
 */
class ConstraintFieldTest {

    private static final String UK_CHECK =
        "новий рядок для відношення \"brand_profiles\" порушує перевірне обмеження перевірку "
            + "\"brand_profiles_website_url_https\"";
    private static final String EN_CHECK =
        "new row for relation \"brand_profiles\" violates check constraint "
            + "\"brand_profiles_website_url_https\"";

    /** A PSQLException as the driver builds it from the server's error fields (\0-separated). */
    private static DataIntegrityViolationException fromServer(String severity, String sqlState,
            String message, String constraint) {
        String fields = "S" + severity + "\0V" + "ERROR" + "\0C" + sqlState + "\0M" + message
            + "\0t" + "brand_profiles" + (constraint == null ? "" : "\0n" + constraint) + "\0";
        PSQLException psql = new PSQLException(new ServerErrorMessage(fields));
        return new DataIntegrityViolationException("PreparedStatementCallback; " + message, psql);
    }

    /** No structured fields (another driver path, a wrapped message): only the text is left. */
    private static DataIntegrityViolationException fromText(String message) {
        return new DataIntegrityViolationException("update failed", new SQLException(message, "23514"));
    }

    @Test
    void ukrainianCheckViolationBlamesWebsiteUrlFromTheConstraintField() {
        assertThat(BrandProfileService.blamedField(
            fromServer("ПОМИЛКА", "23514", UK_CHECK, "brand_profiles_website_url_https")))
            .isEqualTo("websiteUrl");
    }

    @Test
    void ukrainianMessageWithoutTheStructuredFieldStillBlamesWebsiteUrl() {
        assertThat(BrandProfileService.blamedField(fromText("ПОМИЛКА: " + UK_CHECK))).isEqualTo("websiteUrl");
    }

    @Test
    void englishMessageKeepsWorking() {
        assertThat(BrandProfileService.blamedField(
            fromServer("ERROR", "23514", EN_CHECK, "brand_profiles_website_url_https")))
            .isEqualTo("websiteUrl");
        assertThat(BrandProfileService.blamedField(fromText("ERROR: " + EN_CHECK))).isEqualTo("websiteUrl");
    }

    @Test
    void theStructuredConstraintWinsOverNamesInTheText() {
        // The table name and a user value in quotes are not constraints; the server field decides.
        String message = "новий рядок для відношення \"brand_profiles\" порушує перевірне обмеження "
            + "перевірку \"brand_profiles_name_length\"";
        assertThat(BrandProfileService.blamedField(
            fromServer("ПОМИЛКА", "23514", message, "brand_profiles_name_length")))
            .isEqualTo("name");
    }

    @Test
    void ukrainianValueTooLongBlamesTheFieldByItsVarcharSize() {
        // The type name is never translated, only the words around it.
        assertThat(BrandProfileService.blamedField(fromServer("ПОМИЛКА", "22001",
            "значення занадто довге для типу character varying(50)", null))).isEqualTo("name");
        assertThat(BrandProfileService.blamedField(fromServer("ПОМИЛКА", "22001",
            "значення занадто довге для типу character varying(2048)", null))).isEqualTo("websiteUrl");
    }

    @Test
    void anUnknownConstraintBlamesNoField() {
        assertThat(BrandProfileService.blamedField(fromServer("ПОМИЛКА", "23514",
            "порушує перевірне обмеження перевірку \"some_other_rule\"", "some_other_rule"))).isNull();
        assertThat(BrandProfileService.blamedField(
            fromText("новий рядок для відношення \"brand_profiles\" щось інше"))).isNull();
    }
}
