package ua.fulla.catalogimport;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.parser.Parser;
import ua.fulla.products.ProductColor;

/** Cleaning rules shared by the importers (data-model.md §5.3): names, prices, colours, plain text. */
final class ImportText {

    static final int NAME_MAX = 100;
    static final int MATERIAL_MAX = 500;
    static final int DESCRIPTION_MAX = 5000;
    static final int EXTERNAL_ID_MAX = 100;
    static final int PRICE_MAX = 1_000_000;

    /** Fixed name → hex table; a name that isn't here gets {@code hex = null}. */
    private static final Map<String, String> COLOR_HEX = Map.ofEntries(
        Map.entry("чорний", "#1A1A1A"),
        Map.entry("білий", "#FFFFFF"),
        Map.entry("бежевий", "#D9C4A5"),
        Map.entry("коричневий", "#6F4E37"),
        Map.entry("темно-коричневий", "#4A3426"),
        Map.entry("світло-коричневий", "#A67B5B"),
        Map.entry("сірий", "#9E9E9E"),
        Map.entry("темно-сірий", "#555555"),
        Map.entry("світло-сірий", "#D3D3D3"),
        Map.entry("графіт", "#3A3A38"),
        Map.entry("графітовий", "#3A3A38"),
        Map.entry("блакитний", "#9CC9E8"),
        Map.entry("синій", "#2850A8"),
        Map.entry("темно-синій", "#1F2F5C"),
        Map.entry("зелений", "#3C8D4F"),
        Map.entry("темно-зелений", "#2E4D33"),
        Map.entry("світло-зелений", "#A8D5A2"),
        Map.entry("оливковий", "#708238"),
        Map.entry("хакі", "#78866B"),
        Map.entry("рожевий", "#F2B8C6"),
        Map.entry("пудровий", "#E8C4C0"),
        Map.entry("червоний", "#C62828"),
        Map.entry("бордовий", "#7B1E2B"),
        Map.entry("жовтий", "#F2D04B"),
        Map.entry("помаранчевий", "#F08A2C"),
        Map.entry("молочний", "#F3EEE2"),
        Map.entry("бузковий", "#C8A2C8"),
        Map.entry("фіолетовий", "#6A4C93"),
        Map.entry("срібний", "#C0C0C0"),
        Map.entry("золотий", "#D4AF37"),
        Map.entry("капучино", "#A88B74"));

    /** Placeholder colour names that say nothing about the product. */
    private static final Set<String> NOT_A_COLOR = Set.of("one color", "one colour", "");

    private static final Pattern NUMBER = Pattern.compile("\\d[\\d\\s\\u00A0]*(?:[.,]\\d+)?");
    private static final Pattern CURRENCY = Pattern.compile("\\b[A-Z]{3}\\b");
    private static final Pattern SPACES =Pattern.compile("[\\s\\u00A0]+");
    private static final Pattern BLOCK_END = Pattern.compile("(?i)<br\\s*/?>|</p>|</li>|</div>|</h\\d>|</tr>");

    private ImportText() {}

    /** Collapses whitespace (also non-breaking spaces); null for null or blank. */
    static String clean(String text) {
        if (text == null) {
            return null;
        }
        String result = SPACES.matcher(text).replaceAll(" ").strip();
        return result.isEmpty() ? null : result;
    }

    /**
     * A card name: HTML entities decoded («дов&#039;язом» → «дов'язом»), cleaned and cut to
     * 100 chars at a word boundary; null if nothing is left.
     */
    static String cardName(String raw) {
        return cutAtWord(clean(raw == null ? null : Parser.unescapeEntities(raw, false)), NAME_MAX);
    }

    static String cutAtWord(String text, int max) {
        if (text == null || text.length() <= max) {
            return text;
        }
        int cut = text.lastIndexOf(' ', max);
        String result = (cut > max / 2 ? text.substring(0, cut) : text.substring(0, max)).strip();
        return result.isEmpty() ? null : result;
    }

    /** Text cut to {@code max} chars (no word boundary needed); null for blank. */
    static String limit(String text, int max) {
        String cleaned = text == null ? null : text.strip();
        if (cleaned == null || cleaned.isEmpty()) {
            return null;
        }
        return cleaned.length() <= max ? cleaned : cleaned.substring(0, max).strip();
    }

    /**
     * Whole UAH from "1500 UAH", "1 500,50 грн", "7599" or "650.00", rounded half-up. Null when
     * there is no number or it is outside 1…1 000 000 (such an item is skipped).
     */
    static Integer priceUah(String raw) {
        if (raw == null) {
            return null;
        }
        Matcher m = NUMBER.matcher(raw);
        if (!m.find()) {
            return null;
        }
        String digits = SPACES.matcher(m.group()).replaceAll("").replace(',', '.');
        BigDecimal value;
        try {
            value = new BigDecimal(digits).setScale(0, RoundingMode.HALF_UP);
        } catch (NumberFormatException e) {
            return null;
        }
        if (value.signum() <= 0 || value.compareTo(BigDecimal.valueOf(PRICE_MAX)) > 0) {
            return null;
        }
        return value.intValueExact();
    }

    /**
     * False when the price names another currency ("49.00 USD", "45 EUR"); true for UAH, «грн»
     * or no currency at all. FULLA shows prices in UAH only (ADR-0017).
     */
    static boolean isUahPrice(String raw) {
        if (raw == null) {
            return true;
        }
        Matcher m = CURRENCY.matcher(raw);
        while (m.find()) {
            if (!m.group().equals("UAH")) {
                return false;
            }
        }
        return true;
    }

    /** "білий, чорний" → two colours, in order, without duplicates and placeholders like "One color". */
    static List<ProductColor> colors(String commaSeparated) {
        List<ProductColor> result = new ArrayList<>();
        if (commaSeparated == null) {
            return result;
        }
        Set<String> seen = new LinkedHashSet<>();
        for (String part : commaSeparated.split("[,/;]")) {
            String name = clean(part);
            if (name == null || NOT_A_COLOR.contains(name.toLowerCase(Locale.ROOT))) {
                continue;
            }
            if (seen.add(name.toLowerCase(Locale.ROOT))) {
                result.add(new ProductColor(name, COLOR_HEX.get(name.toLowerCase(Locale.ROOT))));
            }
        }
        return result;
    }

    /**
     * HTML → plain text: one line per paragraph, list item or {@code <br>}, entities decoded,
     * no tags left (nothing from the source's HTML reaches the client). Null for blank.
     */
    static String plainText(String html, int max) {
        if (html == null || html.isBlank()) {
            return null;
        }
        String marked = BLOCK_END.matcher(html).replaceAll("$0\n");
        String text = Jsoup.parse(marked).wholeText();
        List<String> lines = new ArrayList<>();
        for (String line : text.split("\\R")) {
            String cleaned = clean(line);
            if (cleaned != null) {
                lines.add(cleaned);
            }
        }
        return limit(String.join("\n", lines), max);
    }

    /** True for an absolute {@code https://} URL with a host (photo URLs, ADR-0007). */
    static boolean isHttps(String url) {
        URI uri = parse(url);
        return uri != null && "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null;
    }

    /** True for an absolute {@code http://} or {@code https://} URL with a host (product URLs). */
    static boolean isHttpUrl(String url) {
        URI uri = parse(url);
        return uri != null && uri.getHost() != null
            && ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()));
    }

    static URI parse(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            return new URI(url.strip());
        } catch (URISyntaxException e) {
            return null;
        }
    }
}
