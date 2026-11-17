import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import styles from "./BuyerHeader.module.css";
import {
  BurgerIcon,
  CartIcon,
  ChevronDownIcon,
  CloseIcon,
  HeartIcon,
  PinIcon,
  SwipeHeartIcon,
  SwipeIcon,
  UserIcon,
} from "./icons";
import {
  isLanguage,
  LANGUAGES,
  readLanguage,
  saveLanguage,
  type Language,
} from "./language";
import { headerTexts as t } from "./messages.uk";

type IconLinkProps = {
  to: string;
  label: string;
  active: boolean;
  children: ReactNode;
};

function IconLink({ to, label, active, children }: IconLinkProps) {
  return (
    <li>
      <Link
        to={to}
        className={styles.iconLink}
        aria-label={label}
        title={label}
        aria-current={active ? "page" : undefined}
      >
        {children}
      </Link>
    </li>
  );
}

/**
 * Header of the buyer pages: dark bar, centred FULLA / SWIPING logo, icon navigation,
 * city and language. On a phone and tablet the city and language sit in a burger menu.
 * The brand cabinet keeps its own header (Layout.tsx).
 */
export function BuyerHeader() {
  const { pathname } = useLocation();
  const [language, setLanguage] = useState<Language>(() => readLanguage());
  // The menu is open only on the page where it was opened, so navigating closes it.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const menuId = useId();
  const cityId = useId();
  const languageId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !burgerRef.current?.contains(target)
      ) {
        setMenuPath(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuPath(null);
        burgerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function changeLanguage(value: string) {
    if (!isLanguage(value)) return;
    setLanguage(value);
    saveLanguage(value);
  }

  const isProfile = pathname === "/login" || pathname === "/register";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          to="/"
          className={styles.logo}
          aria-label={t.logoLabel}
          title={t.logoLabel}
        >
          <span className={styles.logoName}>FULLA</span>
          <span className={styles.logoLine} aria-hidden="true" />
          <span className={styles.logoTagline}>{t.tagline}</span>
        </Link>

        <button
          ref={burgerRef}
          type="button"
          className={styles.burger}
          aria-label={menuOpen ? t.menuClose : t.menuOpen}
          title={menuOpen ? t.menuClose : t.menuOpen}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuPath(menuOpen ? null : pathname)}
        >
          {menuOpen ? (
            <CloseIcon className={styles.icon} />
          ) : (
            <BurgerIcon className={styles.icon} />
          )}
        </button>

        <div
          ref={menuRef}
          id={menuId}
          role="group"
          aria-label={t.menuLabel}
          className={
            menuOpen ? `${styles.prefs} ${styles.prefsOpen}` : styles.prefs
          }
        >
          <div className={styles.field}>
            <label htmlFor={cityId} className={styles.visuallyHidden}>
              {t.city}
            </label>
            <PinIcon className={styles.fieldIcon} />
            <select
              id={cityId}
              className={styles.select}
              title={t.city}
              defaultValue="kyiv"
            >
              <option value="kyiv">{t.cityKyiv}</option>
            </select>
            <ChevronDownIcon className={styles.chevron} />
          </div>
          <div className={styles.field}>
            <label htmlFor={languageId} className={styles.visuallyHidden}>
              {t.language}
            </label>
            <select
              id={languageId}
              className={styles.select}
              title={t.language}
              value={language}
              onChange={(event) => changeLanguage(event.target.value)}
            >
              {LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <ChevronDownIcon className={styles.chevron} />
          </div>
        </div>

        <nav className={styles.nav} aria-label={t.navLabel}>
          <ul className={`${styles.group} ${styles.groupSwipe}`}>
            <IconLink to="/feed" label={t.swipe} active={pathname === "/feed"}>
              <SwipeIcon className={styles.icon} />
            </IconLink>
            <li>
              {/* Placeholder: no page yet. aria-disabled keeps it focusable for the hint. */}
              <button
                type="button"
                className={`${styles.iconLink} ${styles.soon}`}
                aria-disabled="true"
                aria-label={`${t.swipeFavorites} — ${t.soon}`}
                title={`${t.swipeFavorites} — ${t.soon}`}
              >
                <SwipeHeartIcon className={styles.icon} />
                <span className={styles.tooltip} aria-hidden="true">
                  {t.soon}
                </span>
              </button>
            </li>
          </ul>
          <ul className={`${styles.group} ${styles.groupShop}`}>
            <IconLink
              to="/favorites"
              label={t.favorites}
              active={pathname === "/favorites"}
            >
              <HeartIcon className={styles.icon} />
            </IconLink>
            <IconLink to="/cart" label={t.cart} active={pathname === "/cart"}>
              <CartIcon className={styles.icon} />
            </IconLink>
            <IconLink to="/login" label={t.profile} active={isProfile}>
              <UserIcon className={styles.icon} />
            </IconLink>
          </ul>
        </nav>
      </div>
    </header>
  );
}
