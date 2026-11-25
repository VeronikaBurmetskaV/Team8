import { useState, type ComponentProps } from "react";
import { EyeIcon, EyeOffIcon } from "../icons";
import { buyerAuthTexts as t } from "../messages.uk";
import styles from "./AuthForm.module.css";

type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  /** Needed for aria-controls of the eye button. */
  id: string;
};

/**
 * A password input with an eye button that shows or hides the text. The button is a toggle:
 * its name stays «Показати пароль» and aria-pressed tells whether the password is shown.
 * Takes the props of react-hook-form's register() (ref included, React 19).
 */
export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.password}>
      <input {...props} type={visible ? "text" : "password"} />
      <button
        type="button"
        className={styles.eye}
        aria-label={t.showPassword}
        aria-pressed={visible}
        aria-controls={props.id}
        title={t.showPassword}
        onClick={() => setVisible((shown) => !shown)}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
