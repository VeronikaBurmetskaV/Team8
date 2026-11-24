import { Link } from "react-router";
import type { ProfileState } from "../../api/types";
import { cabinetHomeTexts as t, messages } from "../../shared/messages.uk";
import styles from "./AddProductEntry.module.css";

type Props = {
  /** null while the profile is loading: nothing is shown yet. */
  profileState: ProfileState | null;
  /** "large" on the cabinet home page, "medium" on the product list. */
  size: "large" | "medium";
};

/**
 * «Додати товар», or a hint with the way to the profile while the brand has no name:
 * the entry is hidden for an INCOMPLETE profile (api.md §3.2 PROFILE_INCOMPLETE, US-22.1 CL).
 * The server still answers 409 if the form is opened anyway.
 */
export function AddProductEntry({ profileState, size }: Props) {
  if (profileState === null) return null;
  if (profileState === "INCOMPLETE") {
    return (
      <p className={`${styles.hint} ${styles[size]}`}>
        {messages.PROFILE_INCOMPLETE}{" "}
        <Link to="/brand/profile">{t.fillProfile}</Link>
      </p>
    );
  }
  return (
    <Link
      className={`${styles.button} ${styles[size]}`}
      to="/brand/products/new"
    >
      {t.addProduct}
    </Link>
  );
}
