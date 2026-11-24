import {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { Link, useLocation } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./BuyerHeader.module.css";
import {
  BurgerIcon,
  CartIcon,
  ChevronDownIcon,
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
import {
  closesOnKey,
  headerReducer,
  INITIAL_HEADER_STATE,
  markerEvent,
  type HeaderEvent,
} from "./headerState";

const cityOptions: readonly DropdownOption<"kyiv">[] = [
  { value: "kyiv", label: t.cityKyiv },
];

const languageOptions: readonly DropdownOption<Language>[] = LANGUAGES.map(
  (code) => ({ value: code, label: code }),
);

/** Height animation of the expanded header, in seconds (0 with prefers-reduced-motion). */
const EXPAND_SECONDS = 0.25;

type IconLinkProps = {
  to: string;
  label: string;
  active: boolean;
  /** Small counter of new items on the icon; hidden at 0. */
  count?: number;
  linkRef?: Ref<HTMLAnchorElement>;
  children: ReactNode;
};

function IconLink({
  to,
  label,
  active,
  count,
  linkRef,
  children,
}: IconLinkProps) {
  const fullLabel = count === undefined ? label : t.withCount(label, count);
  return (
    <li>
      <Link
        ref={linkRef}
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

type HeaderContentProps = {
  /** "page" — the header in the page flow (with the entrance animation);
   * "overlay" — the copy opened from the thin bar. */
  variant: "page" | "overlay";
  pathname: string;
  city: "kyiv";
  onCity: (value: "kyiv") => void;
  language: Language;
  onLanguage: (value: Language) => void;
  newFavorites: number;
  /** The first icon, focused when the overlay opens. */
  firstLinkRef?: Ref<HTMLAnchorElement>;
};

/** Logo, burger (phone, tablet), city and language, icon navigation. */
function HeaderContent({
  variant,
  pathname,
  city,
  onCity,
  language,
  onLanguage,
  newFavorites,
  firstLinkRef,
}: HeaderContentProps) {
  const reveal = variant === "page";
  // The menu is open only on the page where it was opened, so navigating closes it.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  // Entrance on page load, in reading order: logo, then city / language (and the burger
  // that holds them on a phone), then the icons. See shared/reveal.ts. Not in the overlay.
  const logoRef = useReveal<HTMLAnchorElement>(revealDelay.headerLogo);
  const revealBurger = useReveal<HTMLButtonElement>(revealDelay.headerPrefs);
  const setBurger = useCallback(
    (element: HTMLButtonElement | null) => {
      burgerRef.current = element;
      return reveal ? revealBurger(element) : undefined;
    },
    [reveal, revealBurger],
  );
  const revealPrefs = useReveal<HTMLDivElement>(revealDelay.headerPrefs);
  const setMenu = useCallback(
    (element: HTMLDivElement | null) => {
      menuRef.current = element;
      return reveal ? revealPrefs(element) : undefined;
    },
    [reveal, revealPrefs],
  );
  const iconsRef = useReveal<HTMLUListElement>(revealDelay.headerIcons);

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

  const isProfile = pathname === "/login" || pathname === "/register";

  return (
    <div className={styles.inner}>
      <Link
        ref={reveal ? logoRef : undefined}
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
          onChange={onCity}
          icon={<PinIcon className={styles.fieldIcon} />}
          className={styles.field}
          buttonClassName={styles.select}
          listClassName={styles.list}
        />
        <Dropdown
          label={t.language}
          options={languageOptions}
          value={language}
          onChange={onLanguage}
          className={styles.field}
          buttonClassName={styles.select}
          listClassName={styles.list}
        />
      </div>

      <nav className={styles.nav} aria-label={t.navLabel}>
        {/* One group, left to right: Свайпати, Вподобане, Кошик, Профіль. */}
        <ul
          ref={reveal ? iconsRef : undefined}
          className={`${styles.group} ${styles.groupShop}`}
        >
          <IconLink
            to="/feed"
            label={t.swipe}
            active={pathname === "/feed"}
            linkRef={firstLinkRef}
          >
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
  );
}

/* ---------- The thin bar: markup without hooks (read by the tests in node) ---------- */

type CompactBarViewProps = {
  expanded: boolean;
  /** id of the element the expanded header opens in (aria-controls). */
  panelId: string;
  onToggle: () => void;
  /** The small logo: goes to / (the Link) and scrolls the page to the top. */
  onLogo: () => void;
  arrowRef?: Ref<HTMLButtonElement>;
};

/** Clicks on the bar itself (not on the logo or the arrow) open and close the header too. */
export function isBarToggleClick(target: EventTarget | null): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null;
  if (typeof element?.closest !== "function") return true;
  return element.closest("a, button") === null;
}

export function CompactBarView({
  expanded,
  panelId,
  onToggle,
  onLogo,
  arrowRef,
}: CompactBarViewProps) {
  const label = expanded ? t.compactCollapse : t.compactExpand;
  return (
    <div
      className={styles.bar}
      data-expanded={expanded}
      onClick={(event: MouseEvent) => {
        if (isBarToggleClick(event.target)) onToggle();
      }}
    >
      <div className={styles.barInner}>
        <Link
          to="/"
          className={styles.barLogo}
          aria-label={t.logoLabel}
          title={t.logoLabel}
          onClick={onLogo}
        >
          FULLA
        </Link>
        <button
          ref={arrowRef}
          type="button"
          className={styles.barArrow}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={label}
          title={label}
          onClick={onToggle}
        >
          <ChevronDownIcon className={`${styles.icon} ${styles.chevron}`} />
        </button>
      </div>
    </div>
  );
}

/* ---------- The expanded header under the bar ---------- */

type ExpandedPanelProps = Omit<
  HeaderContentProps,
  "variant" | "firstLinkRef"
> & {
  reduceMotion: boolean;
};

function ExpandedPanel({ reduceMotion, ...content }: ExpandedPanelProps) {
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  // Clipped while the height animates; afterwards visible, so the city / language lists and
  // the phone burger menu can hang below the panel.
  const [settled, setSettled] = useState(reduceMotion);

  // After opening the focus goes to the first icon (without scrolling the page).
  useEffect(() => {
    firstLinkRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <motion.div
      className={styles.panel}
      style={{ overflow: settled ? "visible" : "hidden" }}
      initial={reduceMotion ? false : { height: 0 }}
      animate={{ height: "auto" }}
      exit={{ height: 0 }}
      transition={{
        duration: reduceMotion ? 0 : EXPAND_SECONDS,
        ease: "easeOut",
      }}
      onAnimationStart={() => setSettled(false)}
      onAnimationComplete={(definition) => {
        if (
          typeof definition === "object" &&
          "height" in definition &&
          definition.height === "auto"
        ) {
          setSettled(true);
        }
      }}
    >
      <HeaderContent
        variant="overlay"
        firstLinkRef={firstLinkRef}
        {...content}
      />
    </motion.div>
  );
}

/** Scrolls to the top; instantly with prefers-reduced-motion. */
function scrollToTop(reduceMotion: boolean) {
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

/**
 * While `active`, reports window.scrollY to the reducer at most once per animation frame
 * (only the expanded header listens to scroll; the rest is the IntersectionObserver).
 */
function useFrameScroll(
  active: boolean,
  dispatch: (event: HeaderEvent) => void,
) {
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    function onScroll() {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        dispatch({ type: "scroll", y: window.scrollY });
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [active, dispatch]);
}

/** Watches the marker under the full header: scrolled past it or back at the top. */
function useMarker(
  markerRef: RefObject<HTMLDivElement | null>,
  dispatch: (event: HeaderEvent) => void,
) {
  useEffect(() => {
    const marker = markerRef.current;
    if (marker === null || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      const event = last ? markerEvent(last) : null;
      if (event) dispatch(event);
    });
    observer.observe(marker);
    return () => observer.disconnect();
  }, [markerRef, dispatch]);
}

/**
 * Header of the buyer pages: dark bar, centred FULLA / SWIPING logo, icon navigation,
 * city and language. On a phone and tablet the city and language sit in a burger menu.
 * After scrolling past it, a thin fixed bar (small FULLA + arrow) takes its place at the top
 * of the window; the arrow opens the full header over the content (shared/headerState.ts).
 * The brand cabinet keeps its own header (Layout.tsx).
 */
export function BuyerHeader() {
  const { pathname } = useLocation();
  const [state, dispatch] = useReducer(headerReducer, INITIAL_HEADER_STATE);
  const reduceMotion = useReducedMotion() ?? false;
  const [language, setLanguage] = useState<Language>(() => readLanguage());
  const [city, setCity] = useState<"kyiv">("kyiv");
  const panelId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLButtonElement>(null);
  // Items added since /favorites was last opened; opening the page resets it.
  const newFavorites = useNewItemsCount(
    favoriteList,
    favoritesSeen,
    pathname === "/favorites",
  );
  const expanded = state.mode === "expanded";

  // Another page closes the expanded header (state adjusted during render, no effect).
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    dispatch({ type: "collapse" });
  }

  useMarker(markerRef, dispatch);
  useFrameScroll(expanded, dispatch);

  // Esc (returns the focus to the arrow) and a click outside close the expanded header.
  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(event: KeyboardEvent) {
      const nestedOpen =
        panelRef.current?.querySelector('[aria-expanded="true"]') != null;
      if (closesOnKey("expanded", event.key, nestedOpen)) {
        dispatch({ type: "collapse" });
        arrowRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && headerRef.current?.contains(target)) return;
      dispatch({ type: "collapse" });
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [expanded]);

  function changeLanguage(value: Language) {
    setLanguage(value);
    saveLanguage(value);
  }

  const content = {
    pathname,
    city,
    onCity: setCity,
    language,
    onLanguage: changeLanguage,
    newFavorites,
  };

  return (
    <header ref={headerRef} className={styles.header}>
      {/* First in the DOM: Shift+Tab from the page reaches the bar before the hidden copy. */}
      <AnimatePresence initial={false}>
        {state.mode !== "full" && (
          <motion.div
            key="bar"
            className={styles.barHost}
            initial={reduceMotion ? false : { y: "-100%" }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { y: 0, opacity: 0 } : { y: "-100%" }}
            transition={{
              duration: reduceMotion ? 0 : 0.2,
              ease: "easeOut",
            }}
          >
            <CompactBarView
              expanded={expanded}
              panelId={panelId}
              arrowRef={arrowRef}
              onToggle={() => dispatch({ type: "toggle", y: window.scrollY })}
              onLogo={() => {
                dispatch({ type: "collapse" });
                scrollToTop(reduceMotion);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={panelRef} id={panelId} className={styles.panelHost}>
        <AnimatePresence>
          {expanded && (
            <ExpandedPanel
              key="panel"
              reduceMotion={reduceMotion}
              {...content}
            />
          )}
        </AnimatePresence>
      </div>

      {/* The full header stays in the page flow, so the page never jumps. While the bar is
          shown it is off-screen and inert: the bar and its panel are the header then. */}
      <div inert={state.mode !== "full"}>
        <HeaderContent variant="page" {...content} />
      </div>
      <div ref={markerRef} className={styles.marker} aria-hidden="true" />
    </header>
  );
}
