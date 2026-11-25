package ua.fulla.catalogimport;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * SSRF guard of {@link PoliteFetcher} (ADR-0017): only public unicast addresses may be
 * contacted. Refused: "this" network, loopback, private (10/8, 172.16/12, 192.168/16), CGNAT
 * (100.64/10), link-local (169.254/16, fe80::/10, incl. cloud metadata 169.254.169.254),
 * IETF/documentation/benchmark ranges, multicast, reserved and broadcast; IPv6 unspecified,
 * loopback, unique local (fc00::/7), site-local (fec0::/10), multicast, documentation
 * (2001:db8::/32), and IPv6 forms that embed an IPv4 address (mapped, compatible, NAT64
 * 64:ff9b::/96, 6to4 2002::/16) whose IPv4 address is not public.
 */
final class AddressGuard {

    private AddressGuard() {}

    static boolean isPublic(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress()) {
            return false;
        }
        if (address instanceof Inet4Address) {
            return isPublicV4(address.getAddress());
        }
        if (address instanceof Inet6Address) {
            return isPublicV6(address.getAddress());
        }
        return false;
    }

    private static boolean isPublicV4(byte[] b) {
        int a0 = b[0] & 0xFF;
        int a1 = b[1] & 0xFF;
        int a2 = b[2] & 0xFF;
        if (a0 == 0 || a0 == 10 || a0 == 127) {
            return false;                                   // this network, private, loopback
        }
        if (a0 == 100 && a1 >= 64 && a1 <= 127) {
            return false;                                   // CGNAT 100.64/10
        }
        if (a0 == 169 && a1 == 254) {
            return false;                                   // link-local, cloud metadata
        }
        if (a0 == 172 && a1 >= 16 && a1 <= 31) {
            return false;                                   // private 172.16/12
        }
        if (a0 == 192 && a1 == 168) {
            return false;                                   // private 192.168/16
        }
        if (a0 == 192 && a1 == 0 && (a2 == 0 || a2 == 2)) {
            return false;                                   // IETF 192.0.0/24, TEST-NET-1
        }
        if (a0 == 192 && a1 == 88 && a2 == 99) {
            return false;                                   // 6to4 relay anycast
        }
        if (a0 == 198 && (a1 == 18 || a1 == 19)) {
            return false;                                   // benchmarking 198.18/15
        }
        if (a0 == 198 && a1 == 51 && a2 == 100) {
            return false;                                   // TEST-NET-2
        }
        if (a0 == 203 && a1 == 0 && a2 == 113) {
            return false;                                   // TEST-NET-3
        }
        return a0 < 224;                                    // multicast 224/4, reserved 240/4, broadcast
    }

    private static boolean isPublicV6(byte[] b) {
        int first = b[0] & 0xFF;
        if ((first & 0xFE) == 0xFC) {
            return false;                                   // unique local fc00::/7
        }
        if (first == 0xFE && (b[1] & 0xC0) == 0xC0) {
            return false;                                   // site-local fec0::/10
        }
        if (first == 0x20 && b[1] == 0x01 && (b[2] & 0xFF) == 0x0D && (b[3] & 0xFF) == 0xB8) {
            return false;                                   // documentation 2001:db8::/32
        }
        if (first == 0x20 && b[1] == 0x02) {
            return embeddedV4IsPublic(b, 2);                // 6to4 2002:a.b.c.d::/48
        }
        if (first == 0x00 && b[1] == 0x64 && (b[2] & 0xFF) == 0xFF && (b[3] & 0xFF) == 0x9B && allZero(b, 4, 12)) {
            return embeddedV4IsPublic(b, 12);               // NAT64 64:ff9b::/96
        }
        if (allZero(b, 0, 10)) {
            boolean mapped = (b[10] & 0xFF) == 0xFF && (b[11] & 0xFF) == 0xFF;
            boolean compatible = b[10] == 0 && b[11] == 0;
            if (mapped || compatible) {
                return embeddedV4IsPublic(b, 12);           // ::ffff:a.b.c.d, ::a.b.c.d (incl. :: and ::1)
            }
        }
        return true;
    }

    private static boolean embeddedV4IsPublic(byte[] b, int offset) {
        byte[] v4 = {b[offset], b[offset + 1], b[offset + 2], b[offset + 3]};
        try {
            return isPublic(InetAddress.getByAddress(v4));
        } catch (UnknownHostException e) {
            return false;
        }
    }

    private static boolean allZero(byte[] b, int from, int to) {
        for (int i = from; i < to; i++) {
            if (b[i] != 0) {
                return false;
            }
        }
        return true;
    }
}
