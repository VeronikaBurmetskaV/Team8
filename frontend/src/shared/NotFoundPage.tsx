import { Link } from "react-router";
import styles from "./NotFoundPage.module.css";

export function NotFoundPage() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Сторінку не знайдено</h1>
      <Link className={styles.homeLink} to="/">
        На головну
      </Link>
    </section>
  );
}
