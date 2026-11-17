package ua.fulla.catalogimport;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * The rules of one robots.txt for our User-Agent (ADR-0014): the group for our product token,
 * else the {@code *} group; the longest matching {@code Allow}/{@code Disallow} wins (a tie goes
 * to {@code Allow}); {@code *} matches any characters and a final {@code $} anchors the end.
 */
final class RobotsRules {

    private record Rule(boolean allow, Pattern pattern, int length) {}

    private record Group(List<String> agents, List<Rule> rules) {}

    private final List<Rule> rules;

    private RobotsRules(List<Rule> rules) {
        this.rules = List.copyOf(rules);
    }

    /** robots.txt answered 404: everything is allowed. */
    static RobotsRules allowAll() {
        return new RobotsRules(List.of());
    }

    static RobotsRules parse(String robotsTxt, String agentToken) {
        List<Group> groups = new ArrayList<>();
        Group current = null;
        boolean lastWasAgent = false;
        for (String rawLine : robotsTxt.split("\\R")) {
            String line = rawLine.replaceFirst("#.*", "").strip();
            int colon = line.indexOf(':');
            if (colon < 0) {
                continue;
            }
            String key = line.substring(0, colon).strip().toLowerCase(Locale.ROOT);
            String value = line.substring(colon + 1).strip();
            switch (key) {
                case "user-agent" -> {
                    if (current == null || !lastWasAgent) {
                        current = new Group(new ArrayList<>(), new ArrayList<>());
                        groups.add(current);
                    }
                    current.agents().add(value.toLowerCase(Locale.ROOT));
                    lastWasAgent = true;
                }
                case "allow", "disallow" -> {
                    lastWasAgent = false;
                    // An empty Disallow allows everything: no rule needed.
                    if (current != null && !value.isEmpty()) {
                        current.rules().add(new Rule(key.equals("allow"), toPattern(value), value.length()));
                    }
                }
                default -> lastWasAgent = false;
            }
        }

        // Our own group(s) if any exist, otherwise the * group(s).
        String token = agentToken.toLowerCase(Locale.ROOT);
        boolean hasOwnGroup = groups.stream().anyMatch(group -> group.agents().contains(token));
        String chosen = hasOwnGroup ? token : "*";
        List<Rule> rules = new ArrayList<>();
        for (Group group : groups) {
            if (group.agents().contains(chosen)) {
                rules.addAll(group.rules());
            }
        }
        return new RobotsRules(rules);
    }

    /** {@code pathAndQuery} is the URL's raw path plus {@code ?query}, e.g. {@code /store/a?x=1}. */
    boolean isAllowed(String pathAndQuery) {
        if (pathAndQuery.equals("/robots.txt")) {
            return true;
        }
        Rule best = null;
        for (Rule rule : rules) {
            if (rule.pattern().matcher(pathAndQuery).lookingAt()
                    && (best == null || rule.length() > best.length() || (rule.length() == best.length() && rule.allow()))) {
                best = rule;
            }
        }
        return best == null || best.allow();
    }

    private static Pattern toPattern(String value) {
        boolean anchored = value.endsWith("$");
        String body = anchored ? value.substring(0, value.length() - 1) : value;
        String[] parts = body.split("\\*", -1);
        StringBuilder regex = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) {
                regex.append(".*");
            }
            if (!parts[i].isEmpty()) {
                regex.append(Pattern.quote(parts[i]));
            }
        }
        if (anchored) {
            regex.append('$');
        }
        return Pattern.compile(regex.toString());
    }
}
