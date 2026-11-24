import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router";
import styles from "./BuyerHeader.module.css";
import {
  BurgerIcon,
  CartIcon,
  CloseIcon,
  HeartIcon,
  PinIcon,
  SwipeIcon,
  UserIcon,
} from "./icons";
import { Dropdown, type DropdownOption } from "./Dropdown";
import {
  LANGUAGES,
  readLanguage,
  saveLanguage,
  type Language,
} from "./language";
import { headerTexts as t } from "./messages.uk";
import { favoritesSeen, useNewItemsCount } from "./newItems";
import { favoriteList } from "./productLists";
import { revealDelay, useReveal } from "./reveal";

const cityOptions: readonly DropdownOption<"kyiv">[] = [
  { value: "kyiv", label: t.cityKyiv },
];

const languageOptions: readonly DropdownOption<Language>[] = LANGUAGES.map(
  (code) => ({ value: code, label: code }),
);

type IconLinkProps = {
  to: string;
  label: string;
  active: boolean;
  /** Small counter of new items on the icon; hidden at 0. */
  count?: number;
  children: ReactNode;
};

function IconLink({ to, label, active, count, children }: IconLinkProps) {
  const fullLabel = count === undefined ? label : t.withCount(label, count);
  return (
    <li>
      <Link
        to={to}
        className={styles.iconLink}
        aria-label={fullLabel}
        title={fullLabel}
        aria-current={active ? "page" : undefined}
      >
        {children}
        {count !== undefined && count > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        )}
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
  const [city, setCity] = useState<"kyiv">("kyiv");
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  // Entrance on page load, in reading order: logo, then city / language (and the burger
  // that holds them on a phone), then the icons. See shared/reveal.ts.
  const logoRef = useReveal<HTMLAnchorElement>(revealDelay.headerLogo);
  const revealBurger = useReveal<HTMLButtonElement>(revealDelay.headerPrefs);
  const setBurger = useCallback(
    (element: HTMLButtonElement | null) => {
      burgerRef.current = element;
      return revealBurger(element);
    },
    [revealBurger],
  );
  const revealPrefs = useReveal<HTMLDivElement>(revealDelay.headerPrefs);
  const setMenu = useCallback(
    (element: HTMLDivElement | null) => {
      menuRef.current = element;
      return revealPrefs(element);
    },
    [revealPrefs],
  );
  const iconsRef = useReveal<HTMLUListElement>(revealDelay.headerIcons);
  // Items added since /favorites was last opened; opening the page resets it.
  const newFavorites = useNewItemsCount(
    favoriteList,
    favoritesSeen,
    pathname === "/favorites",
  );

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

  function changeLanguage(value: Language) {
    setLanguage(value);
    saveLanguage(value);
  }

  const isProfile = pathname === "/login" || pathname === "/register";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          ref={logoRef}
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
          ref={setBurger}
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
          ref={setMenu}
          id={menuId}
          role="group"
          aria-label={t.menuLabel}
          className={
            menuOpen ? `${styles.prefs} ${styles.prefsOpen}` : styles.prefs
          }
        >
          <Dropdown
            label={t.city}
            options={cityOptions}
            value={city}
            onChange={setCity}
            icon={<PinIcon className={styles.fieldIcon} />}
            className={styles.field}
            buttonClassName={styles.select}
            listClassName={styles.list}
          />
          <Dropdown
            label={t.language}
            options={languageOptions}
            value={language}
            onChange={changeLanguage}
            className={styles.field}
            buttonClassName={styles.select}
            listClassName={styles.list}
          />
        </div>

        <nav className={styles.nav} aria-label={t.navLabel}>
          {/* One group, left to right: Свайпати, Вподобане, Кошик, Профіль. */}
          <ul ref={iconsRef} className={`${styles.group} ${styles.groupShop}`}>
            <IconLink to="/feed" label={t.swipe} active={pathname === "/feed"}>
              <SwipeIcon className={styles.icon} />
            </IconLink>
            <IconLink
              to="/favorites"
              label={t.favorites}
              active={pathname === "/favorites"}
              count={newFavorites}
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
