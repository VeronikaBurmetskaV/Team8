import { cartTexts } from "../../shared/messages.uk";
import styles from "./CartPage.module.css";

/** Placeholder: the header links here; the cart itself is a separate task. */
export function CartPage() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{cartTexts.title}</h1>
      <p className={styles.text}>{cartTexts.placeholder}</p>
    </section>
  );
}
