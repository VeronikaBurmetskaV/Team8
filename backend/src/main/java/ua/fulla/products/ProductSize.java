package ua.fulla.products;

/** One size of an imported card, in site order: {@code {"label":"M","available":true}} (data-model.md §5.3). */
public record ProductSize(String label, boolean available) {}
