package ua.fulla.catalogimport;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Decides whether an imported product is a piece of clothing. FULLA shows clothing only, so this
 * is a white list: a product is imported only when one of its texts names a clothing type and
 * none of them names something excluded (underwear, shoes, bags, jewellery, tattoos, dishes,
 * décor, cosmetics, certificates, …). When in doubt the product is NOT imported.
 *
 * <p>Texts are split into words; a keyword is a word stem that matches a word when the rest of
 * the word is a usual ending ({@link #ENDINGS}): «сукн» matches «сукня», «сукні», «сукнею», but
 * «крем» does not match «кремова» and «декор» does not match «декоративна». To support a new
 * type, add its stem to {@link #CLOTHING} or {@link #EXCLUDED}.
 */
final class ClothingFilter {

    /** Clothing types (Ukrainian stems and English words). */
    static final Set<String> CLOTHING = Set.of(
        // сукні
        "сукн", "сукенк", "сарафан", "dress",
        // верх
        "топ", "блуз", "блузк", "сорочк", "вишиванк", "футболк", "поло", "лонгслів", "тунік",
        "top", "blouse", "shirt", "tee", "longsleeve", "polo",
        // светри та худі
        "светр", "джемпер", "кофт", "гольф", "водолазк", "кардиган", "худі", "світшот",
        "sweater", "jumper", "cardigan", "hoodie", "sweatshirt",
        // жакети та верхній одяг
        "жакет", "піджак", "куртк", "бомбер", "вітровк", "пуховик", "парк", "пальт", "тренч", "плащ",
        "шуб", "жилет", "jacket", "blazer", "coat", "trench", "parka", "puffer", "vest", "waistcoat",
        // низ
        "штан", "брюк", "джинс", "кюлот", "шорт", "спідниц",
        "trousers", "pants", "jeans", "shorts", "skirt",
        // комплекти
        "комбінезон", "костюм", "jumpsuit", "overalls", "suit");

    /** Never imported, even when a clothing word is also present (e.g. «піжамний костюм»). */
    static final Set<String> EXCLUDED = Set.of(
        // білизна, піжами, купальники, домашній одяг
        "білизн", "бюстгальтер", "бра", "бралет", "ліфчик", "трус", "стрінг", "сліп", "боксер",
        "піжам", "піжамн", "нічн", "халат", "домашн", "купальн", "бікіні", "плавк",
        "underwear", "lingerie", "bra", "bralette", "panties", "briefs", "thong", "pajama", "pyjama",
        "nightgown", "robe", "swimsuit", "swimwear", "bikini",
        // шкарпетки, колготки
        "шкарпетк", "колготк", "панчох", "панчішн", "гетр", "sock", "tights", "stockings",
        // взуття
        "взутт", "черевик", "чобот", "туфл", "кросівк", "кед", "мокасин", "сандал", "босоніжк",
        "капц", "лофер", "сліпон", "балетк", "шльопанц", "мюл", "shoe", "boot", "sneaker", "sandal",
        // сумки, рюкзаки, гаманці
        "сумк", "сумочк", "рюкзак", "шопер", "гаман", "клатч", "валіз", "косметичк", "портмоне",
        "органайзер", "холдер", "bag", "backpack", "wallet",
        // прикраси, біжутерія
        "прикрас", "біжутер", "намист", "сережк", "каблучк", "кільц", "браслет", "кулон", "підвіск",
        "брош", "брошк", "брелок", "брелк", "значк", "значок", "запонк",
        "jewelry", "jewellery", "earring", "necklace", "bracelet", "ring", "pendant",
        // тату
        "тату", "татуюванн", "tattoo",
        // аксесуари
        "аксесуар", "ремін", "ремен", "шарф", "снуд", "хустк", "хустинк", "шапк", "шапочк", "кепк",
        "кашкет", "капелюх", "панам", "берет", "бейсболк", "балаклав", "рукавичк", "рукавиц",
        "мітенк", "окуляр", "парасол", "чохл", "чохол", "волосс", "заколк", "краватк", "гребін",
        "гребінц", "belt", "scarf", "hat", "cap", "beanie", "glove", "accessory", "accessories",
        // посуд, декор, текстиль для дому
        "посуд", "чашк", "горнятк", "кружк", "тарілк", "келих", "склянк", "миск", "ваз", "декор",
        "свічк", "свічник", "підсвічник", "аромасвічк", "аромадифузор", "дифузор", "віск",
        "постер", "картин", "листівк", "наліпк", "стікер", "блокнот", "іграшк",
        "плед", "ковдр", "подушк", "простирадл", "підковдр", "наволочк", "постільн", "рушник",
        "скатертин", "серветк", "текстил", "килим", "кошик", "гірлянд", "світильник", "скульптур",
        "скриньк", "підставк", "mug", "cup", "plate", "candle", "decor",
        // косметика
        "косметик", "крем", "парфум", "парфумован", "гел", "скраб", "бальзам", "сироватк", "мило",
        "шампун", "лосьйон", "помад", "cosmetics",
        // сертифікати, їжа, інше
        "сертифікат", "подарунков", "скретч", "шоколад", "цукерк", "кав", "чай", "набір",
        "certificate", "gift");

    /** Endings a word may have after a stem (Ukrainian cases and plurals, English plurals). */
    private static final Set<String> ENDINGS = Set.of(
        "", "а", "я", "и", "і", "ї", "у", "ю", "о", "е", "є", "ь",
        "ем", "єм", "ом", "ою", "ею", "єю", "ам", "ям", "ах", "ях", "ами", "ями",
        "ів", "їв", "ей", "ій", "ий", "ої", "ок", "ка", "ки", "ку", "ці", "ик", "ики", "ків",
        "ія", "ії", "ію", "ець", "s", "es");

    /** The words of a category path that say the product is clothing at all. */
    private static final List<String> CLOTHING_CATEGORY = List.of("одяг", "clothing", "apparel");

    private static final Pattern NOT_A_LETTER = Pattern.compile("[^\\p{L}'’ʼ]+");

    private ClothingFilter() {}

    /**
     * True only for clothing.
     *
     * @param name        the product name (required)
     * @param productType the shop's own type, e.g. {@code g:product_type} «Жіночі сукні»; may be null
     * @param category    a category path, e.g. {@code g:google_product_category}
     *                    «Товари для жінок > Одяг > Сукні та спідниці > Сукні»; may be null
     */
    static boolean isClothing(String name, String productType, String category) {
        if (name == null || name.isBlank()) {
            return false;
        }
        if (containsAny(name, EXCLUDED) || containsAny(productType, EXCLUDED) || containsAny(category, EXCLUDED)) {
            return false;
        }
        if (category != null && !category.isBlank() && !isClothingCategory(category)) {
            return false; // «Дім та декор > …», «Товари для жінок > Взуття > …»
        }
        return containsAny(name, CLOTHING) || containsAny(productType, CLOTHING)
            || containsAny(lastSegment(category), CLOTHING);
    }

    private static boolean isClothingCategory(String category) {
        String lower = category.toLowerCase(Locale.ROOT);
        return CLOTHING_CATEGORY.stream().anyMatch(lower::contains);
    }

    /**
     * «… > Костюми та комбінезони > Боді» → «Боді»: only the most specific level names the type;
     * the parent levels group unlike things together.
     */
    private static String lastSegment(String category) {
        if (category == null) {
            return null;
        }
        int gt = category.lastIndexOf('>');
        return gt < 0 ? category : category.substring(gt + 1);
    }

    private static boolean containsAny(String text, Set<String> stems) {
        if (text == null) {
            return false;
        }
        for (String word : NOT_A_LETTER.split(text.toLowerCase(Locale.ROOT))) {
            if (!word.isEmpty() && matchesAny(word, stems)) {
                return true;
            }
        }
        return false;
    }

    private static boolean matchesAny(String word, Set<String> stems) {
        for (int end = word.length(); end > 0; end--) {
            if (stems.contains(word.substring(0, end)) && ENDINGS.contains(word.substring(end))) {
                return true;
            }
        }
        return false;
    }
}
