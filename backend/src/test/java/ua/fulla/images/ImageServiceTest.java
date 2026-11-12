package ua.fulla.images;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

/** T-13: the type is decided by the first bytes only. */
class ImageServiceTest {

    @Test
    void pngJpegAndWebpAreRecognized() {
        assertThat(ImageService.detectContentType(bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)))
            .contains("image/png");
        assertThat(ImageService.detectContentType(bytes(0xFF, 0xD8, 0xFF, 0xE0, 0x00))).contains("image/jpeg");
        assertThat(ImageService.detectContentType(
                bytes('R', 'I', 'F', 'F', 0x24, 0x00, 0x00, 0x00, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' ')))
            .contains("image/webp");
    }

    @Test
    void everythingElseIsRefused() {
        assertThat(ImageService.detectContentType(new byte[0])).isEmpty();
        // shorter than the signature
        assertThat(ImageService.detectContentType(bytes(0x89, 'P', 'N'))).isEmpty();
        assertThat(ImageService.detectContentType(bytes(0xFF, 0xD8))).isEmpty();
        assertThat(ImageService.detectContentType(bytes('R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B'))).isEmpty();
        // RIFF, but audio
        assertThat(ImageService.detectContentType(bytes('R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'A', 'V', 'E')))
            .isEmpty();
        assertThat(ImageService.detectContentType(text("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"))).isEmpty();
        assertThat(ImageService.detectContentType(text("<?xml version=\"1.0\"?><svg/>"))).isEmpty();
        assertThat(ImageService.detectContentType(text("GIF89a...."))).isEmpty();
        assertThat(ImageService.detectContentType(text("%PDF-1.7"))).isEmpty();
        assertThat(ImageService.detectContentType(text("MZ executable"))).isEmpty();
        assertThat(ImageService.detectContentType(text("PNG without the first byte"))).isEmpty();
    }

    static byte[] bytes(int... values) {
        byte[] result = new byte[values.length];
        for (int i = 0; i < values.length; i++) {
            result[i] = (byte) values[i];
        }
        return result;
    }

    private static byte[] text(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }
}
