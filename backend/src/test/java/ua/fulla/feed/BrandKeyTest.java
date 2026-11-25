package ua.fulla.feed;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** The same examples as brandKey in frontend/src/features/catalog/catalog.test.ts. */
class BrandKeyTest {

    @Test
    void everyApostropheGivesOneKey() {
        for (String spelling : new String[] {"CHER’17", "cher'17 ", "Cher‘17", "CHERʼ17", "CHER`17", "CHER´17",
                "CHER＇17", "​CHER'17"}) {
            assertThat(BrandKey.of(spelling)).as(spelling).isEqualTo("cher'17");
        }
    }

    @Test
    void everyKindOfSpaceGivesOneKey() {
        for (String spelling : new String[] {"One By One", "ONE BY ONE", " one  by\tone ",
                "One By One", "Ｏｎｅ Ｂｙ Ｏｎｅ"}) {
            assertThat(BrandKey.of(spelling)).as(spelling).isEqualTo("one by one");
        }
    }

    @Test
    void ukrainianLowerCase() {
        assertThat(BrandKey.of("ЇЖАК Студія")).isEqualTo("їжак студія");
    }
}
