package ua.fulla.products;

/**
 * One colour of an imported card: {@code {"name":"бежевий","hex":"#D9C4A5"}} (data-model.md §5.3).
 * {@code hex} is null when the name is not in the importer's fixed name → hex table.
 */
public record ProductColor(String name, String hex) {}
