import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
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
import { withFilterParams } from "./filterLinks";
import { headerTexts as t } from "./messages.uk";
import { favoritesSeen, useNewItemsCount } from "./newItems";
import { favoriteList } from "./productLists";
import { revealDelay, useReveal } from "./reveal";
import {
  closesOnKey,
  headerReducer,
  INITIAL_HEADER_STATE,
  type HeaderEvent,
  type HeaderMode,
  type HeaderState,
} from "./headerState";

const cityOptions: readonly DropdownOption<"kyiv">[] = [
  { value: "kyiv", label: t.cityKyiv },
];

const languageOptions: readonly DropdownOption<Language>[] = LANGUAGES.map(
  (code) => ({ value: code, label: code }),
);

/** Height animation bar ↔ expanded header, in seconds (0 with prefers-reduced-motion). */
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
  /** The current query string: the catalogue filters travel with the links to / and /feed. */
  search?: string;
  /** Entrance animation of logo, city / language and icons: only the first time the header
   * is shown on page load, never when it comes back from the thin bar. */
  reveal: boolean;
  pathname: string;
  city: "kyiv";
  onCity: (value: "kyiv") => void;
  language: Language;
  onLanguage: (value: Language) => void;
  newFavorites: number;
  /** The first icon, focused when the header opens from the thin bar. */
  firstLinkRef?: Ref<HTMLAnchorElement>;
};

/** Logo, burger (phone, tablet), city and language, icon navigation. */
function HeaderContent({
  search = "",
  reveal,
  pathname,
  city,
  onCity,
  language,
  onLanguage,
  newFavorites,
  firstLinkRef,
}: HeaderContentProps) {
  // The menu is open only on the page where it was opened, so navigating closes it.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  // Entrance on page load, in reading order: logo, then city / language (and the burger
  // that holds them on a phone), then the icons. See shared/reveal.ts. Only on page load.
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
    <div className={`${styles.container} ${styles.inner}`}>
      <Link
        ref={reveal ? logoRef : undefined}
        to={withFilterParams("/", search)}
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
        {...{ [TOGGLE_ANCHOR_ATTR]: "" }}
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
        {...{ [TOGGLE_ANCHOR_ATTR]: "" }}
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
            to={withFilterParams("/feed", search)}
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
  /** A click on the bar itself (not on the logo) opens the header, like the arrow. */
  onToggle: () => void;
  /** The small logo: goes to / (the Link) and scrolls the page to the top. */
  onLogo: () => void;
  /** The current query string: the logo keeps the catalogue filters. */
  search?: string;
};

/** Clicks on the bar itself (not on the logo or the arrow) open and close the header too. */
export function isBarToggleClick(target: EventTarget | null): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null;
  if (typeof element?.closest !== "function") return true;
  return element.closest("a, button") === null;
}

/** The thin bar: the small FULLA in the middle. Its arrow is the shell's HeaderToggle. */
export function CompactBarView({
  onToggle,
  onLogo,
  search = "",
}: CompactBarViewProps) {
  return (
    <div
      className={styles.bar}
      onClick={(event: MouseEvent) => {
        if (isBarToggleClick(event.target)) onToggle();
      }}
    >
      <div className={`${styles.container} ${styles.barInner}`}>
        <Link
          to={withFilterParams("/", search)}
          className={styles.barLogo}
          aria-label={t.logoLabel}
          title={t.logoLabel}
          onClick={onLogo}
        >
          FULLA
        </Link>
      </div>
    </div>
  );
}

/* ---------- The arrow: one button for the bar and the expanded header ---------- */

/** The element of the expanded header's top row the arrow lines up with (burger, or city/language). */
const TOGGLE_ANCHOR_ATTR = "data-toggle-anchor";

/** Marks the arrow, so Esc does not take its aria-expanded for an open dropdown. */
const TOGGLE_ATTR = "data-header-toggle";

interface HeaderToggleProps {
  expanded: boolean;
  /** id of the shell it opens and closes (aria-controls). */
  panelId: string;
  /** `viaKeyboard`: Enter/Space (a click with `detail` 0), not a mouse or touch click. */
  onToggle: (viaKeyboard: boolean) => void;
  toggleRef?: Ref<HTMLButtonElement>;
}

/**
 * «Розгорнути меню» / «Згорнути меню»: ONE button in the compact and the expanded state, at the
 * same place in the shell, so React keeps the same DOM node — it never jumps or loses focus.
 * Absolutely positioned against the shell (same right and width in both states); only the
 * chevron turns (⌄ ↔ ⌃), and its vertical place (middle of the bar ↔ the top row).
 */
export function HeaderToggle({
  expanded,
  panelId,
  onToggle,
  toggleRef,
}: HeaderToggleProps) {
  const label = expanded ? t.compactCollapse : t.compactExpand;
  return (
    <button
      ref={toggleRef}
      type="button"
      className={styles.toggle}
      {...{ [TOGGLE_ATTR]: "" }}
      data-expanded={expanded}
      aria-expanded={expanded}
      aria-controls={panelId}
      aria-label={label}
      title={label}
      onClick={(event) => onToggle(event.detail === 0)}
    >
      <ChevronDownIcon className={`${styles.icon} ${styles.toggleIcon}`} />
    </button>
  );
}

/* ---------- One header in every state: markup without own state (read by the tests) ---------- */

/** How the shell got into its state: CSS picks the entrance animation from it. */
export type HeaderEnter = "slide" | "expand" | "collapse" | null;

/** The animation that leads from `previous` to `mode`. */
export function headerEnter(
  previous: HeaderMode | null,
  mode: HeaderMode,
): HeaderEnter {
  if (previous === "full" && mode === "compact") return "slide";
  if (previous === "compact" && mode === "expanded") return "expand";
  if (previous === "expanded" && mode === "compact") return "collapse";
  return null;
}

type HeaderContentData = Omit<HeaderContentProps, "reveal" | "firstLinkRef">;

export type BuyerHeaderViewProps = {
  mode: HeaderMode;
  enter: HeaderEnter;
  content: HeaderContentData;
  reveal: boolean;
  panelId: string;
  /**
   * The full header's height (measured): the spacer in the page flow and the dark background
   * layer have it in EVERY state. null before the first measure: the CSS default is used.
   */
  fullHeight: number | null;
  /** The bar's height (measured), to shrink the background layer with scaleY; null = unknown. */
  barHeight: number | null;
  /** A state change is animating: will-change is set only now. */
  animating: boolean;
  reduceMotion: boolean;
  /** The arrow (viaKeyboard: Enter/Space) and the bar itself (false). */
  onToggle: (viaKeyboard: boolean) => void;
  onLogo: () => void;
  /** The background layer finished its scaleY transition. */
  onBackgroundDone?: () => void;
  headerRef?: Ref<HTMLElement>;
  shellRef?: Ref<HTMLDivElement>;
  /** Measures each contents element; its data-kind says whose height it is. */
  measureRef?: Ref<HTMLDivElement>;
  toggleRef?: Ref<HTMLButtonElement>;
  firstLinkRef?: Ref<HTMLAnchorElement>;
};

/**
 * The single <header>. Its shell is ALWAYS fixed at the top of the window and is the header in
 * every state:
 * - full: the full header (big FULLA / SWIPING, city, language, icons);
 * - compact: the thin bar (small FULLA + the arrow «Розгорнути меню»);
 * - expanded: the SAME full header; the same arrow, turned up, «Згорнути меню».
 * Under it, in the page flow, a spacer of the full header's height — the same in every state —
 * so a change of state never moves the page and can never change window.scrollY (no feedback
 * loop). Between the states only transform and opacity animate: the dark background is its own
 * layer shrunk with scaleY, the contents cross-fade.
 */
export function BuyerHeaderView({
  mode,
  enter,
  content,
  reveal,
  panelId,
  fullHeight,
  barHeight,
  animating,
  reduceMotion,
  onToggle,
  onLogo,
  onBackgroundDone,
  headerRef,
  shellRef,
  measureRef,
  toggleRef,
  firstLinkRef,
}: BuyerHeaderViewProps) {
  const scale =
    mode === "compact" && fullHeight !== null && barHeight !== null
      ? Math.min(1, barHeight / fullHeight)
      : 1;
  const fade = reduceMotion ? 0 : EXPAND_SECONDS;
  return (
    <header ref={headerRef} className={styles.header}>
      {/* The full header's place in the page: never changes with the state. */}
      <div
        className={styles.spacer}
        style={fullHeight !== null ? { height: fullHeight } : undefined}
        aria-hidden="true"
      />
      <div
        ref={shellRef}
        id={panelId}
        className={styles.shell}
        data-mode={mode}
        data-enter={enter ?? undefined}
        data-animating={animating || undefined}
      >
        <div
          className={styles.shellBg}
          style={{
            ...(fullHeight !== null ? { height: fullHeight } : {}),
            transform: `scaleY(${scale})`,
          }}
          onTransitionEnd={onBackgroundDone}
          aria-hidden="true"
        />
        {/* The leaving contents fade out fast (popLayout takes them out of the flow), the new
            ones fade in: opacity only. Full and expanded share a key, so they are one element. */}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={mode === "compact" ? "bar" : "full"}
            ref={measureRef}
            data-kind={mode === "compact" ? "bar" : "full"}
            className={styles.shellContent}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: fade } }}
            exit={{ opacity: 0, transition: { duration: fade / 2 } }}
          >
            {mode === "compact" ? (
              <CompactBarView
                onToggle={() => onToggle(false)}
                onLogo={onLogo}
                search={content.search}
              />
            ) : (
              <HeaderContent
                reveal={reveal}
                firstLinkRef={mode === "expanded" ? firstLinkRef : undefined}
                {...content}
              />
            )}
          </motion.div>
        </AnimatePresence>
        {/* After the contents in both fixed states: the same element, not remounted. */}
        {mode !== "full" && (
          <HeaderToggle
            expanded={mode === "expanded"}
            panelId={panelId}
            onToggle={onToggle}
            toggleRef={toggleRef}
          />
        )}
      </div>
    </header>
  );
}

/**
 * The arrow's vertical place in the expanded header: level with the top row — the burger on a
 * phone and tablet, the city / language row on a laptop. Set on the element itself (no state),
 * again when the shell changes size. In the bar, CSS centres it.
 */
function useToggleRow(
  mode: HeaderMode,
  shellRef: RefObject<HTMLDivElement | null>,
  toggleRef: RefObject<HTMLButtonElement | null>,
) {
  useLayoutEffect(() => {
    const shell = shellRef.current;
    const toggle = toggleRef.current;
    if (shell === null || toggle === null) return;
    function place() {
      if (shell === null || toggle === null) return;
      if (mode !== "expanded") {
        toggle.style.removeProperty("top");
        return;
      }
      const anchor = [
        ...shell.querySelectorAll<HTMLElement>(`[${TOGGLE_ANCHOR_ATTR}]`),
      ].find((element) => element.offsetParent !== null);
      if (anchor === undefined) return;
      const a = anchor.getBoundingClientRect();
      const top =
        a.top -
        shell.getBoundingClientRect().top +
        (a.height - toggle.offsetHeight) / 2;
      toggle.style.top = `${top}px`;
    }
    place();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(place);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [mode, shellRef, toggleRef]);
}

/**
 * Buyer pages only: the canvas around the page (rubber-band overscroll on macOS and iOS) is the
 * header's dark colour above the page and the page's light colour below it (index.css). The
 * brand cabinet keeps the browser default.
 */
function useCanvasColours() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.overscroll = "buyer-header";
    return () => {
      delete root.dataset.overscroll;
    };
  }, []);
}

/** Scrolls to the top; instantly with prefers-reduced-motion. */
function scrollToTop(reduceMotion: boolean) {
  window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
}

/**
 * A ref for the shell's contents: one ResizeObserver reports the height of every contents
 * element it is given, to the full or the bar height by the element's data-kind. React 19 ref
 * cleanup stops observing an element when it leaves.
 */
function useContentsMeasure(
  setFull: (height: number) => void,
  setBar: (height: number) => void,
) {
  const observer = useRef<ResizeObserver | null>(null);
  return useCallback(
    (element: HTMLDivElement | null) => {
      if (element === null || typeof ResizeObserver === "undefined") return;
      observer.current ??= new ResizeObserver((entries) => {
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          const height =
            Math.round(target.getBoundingClientRect().height * 10) / 10;
          if (height <= 0) continue;
          if (target.dataset.kind === "bar") setBar(height);
          else setFull(height);
        }
      });
      const current = observer.current;
      current.observe(element);
      return () => current.unobserve(element);
    },
    [setFull, setBar],
  );
}

/**
 * The state follows window.scrollY only (headerState.ts: hysteresis, clamped to [0, max]). One
 * passive scroll listener, read at most once per animation frame; it dispatches only when the
 * state really changes, so scrolling re-renders nothing on its own. Also run once on mount
 * (a page restored half-way down starts with the bar).
 */
function useScrollState(
  stateRef: RefObject<HeaderState>,
  fullHeightRef: RefObject<number>,
  dispatch: (event: HeaderEvent) => void,
) {
  useEffect(() => {
    let frame = 0;
    function read() {
      frame = 0;
      const root = document.documentElement;
      const event: HeaderEvent = {
        type: "scroll",
        y: window.scrollY,
        maxY: root.scrollHeight - window.innerHeight,
        fullHeight: fullHeightRef.current,
      };
      if (headerReducer(stateRef.current, event) !== stateRef.current) {
        dispatch(event);
      }
    }
    function onScroll() {
      if (frame === 0) frame = requestAnimationFrame(read);
    }
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [stateRef, fullHeightRef, dispatch]);
}

/**
 * Header of the buyer pages: dark bar, centred FULLA / SWIPING logo, icon navigation,
 * city and language. On a phone and tablet the city and language sit in a burger menu.
 * After scrolling past it, the header turns into a thin fixed bar (small FULLA + arrow); the
 * arrow turns the bar back into the full header, fixed over the content
 * (shared/headerState.ts). Always one <header> and one logo.
 * The brand cabinet keeps its own header (Layout.tsx).
 */
export function BuyerHeader() {
  const { pathname, search } = useLocation();
  const [state, dispatch] = useReducer(headerReducer, INITIAL_HEADER_STATE);
  const reduceMotion = useReducedMotion() ?? false;
  const [language, setLanguage] = useState<Language>(() => readLanguage());
  const [city, setCity] = useState<"kyiv">("kyiv");
  const panelId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  // After Esc the focus goes back to the arrow (the element inside the header that had it is gone).
  const focusArrow = useRef(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const [animating, setAnimating] = useState(false);
  // Safety net: will-change never stays on if no transitionend comes (reduced motion).
  useEffect(() => {
    if (!animating) return;
    const timer = setTimeout(
      () => setAnimating(false),
      EXPAND_SECONDS * 1000 + 100,
    );
    return () => clearTimeout(timer);
  }, [animating]);
  // Items added since /favorites was last opened; opening the page resets it.
  const newFavorites = useNewItemsCount(
    favoriteList,
    favoritesSeen,
    pathname === "/favorites",
  );
  const mode = state.mode;
  const expanded = mode === "expanded";

  // State adjusted during render (no effect): the previous mode picks the animation, the
  // full header's height is kept for the page flow, and the entrance animation runs once.
  const [modes, setModes] = useState<{
    current: HeaderMode;
    previous: HeaderMode | null;
  }>({ current: mode, previous: null });
  if (modes.current !== mode) {
    setModes({ current: mode, previous: modes.current });
    setAnimating(true);
  }
  // Each contents element reports its own height, labelled by data-kind, so a measure can
  // never be taken for the other state's (a stale shell height once made the spacer 48px).
  // The spacer keeps the last full height in every state; it changes only on a resize.
  const [fullHeight, setFullHeight] = useState<number | null>(null);
  const [barHeight, setBarHeight] = useState<number | null>(null);
  const measureRef = useContentsMeasure(setFullHeight, setBarHeight);
  const [revealed, setRevealed] = useState(false);
  if (mode !== "full" && !revealed) setRevealed(true);

  // Another page closes the expanded header.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    dispatch({ type: "collapse" });
  }

  // The scroll handler reads the latest state and height through refs (no re-subscribing).
  const stateRef = useRef(state);
  const fullHeightRef = useRef(fullHeight ?? 0);
  useEffect(() => {
    stateRef.current = state;
    fullHeightRef.current = fullHeight ?? headerRef.current?.offsetHeight ?? 0;
  });
  useScrollState(stateRef, fullHeightRef, dispatch);
  useToggleRow(mode, shellRef, toggleRef);
  useCanvasColours();

  // Opened: the focus goes to the first icon (without scrolling the page).
  // Closed with Esc or the arrow: back to the bar's arrow.
  useEffect(() => {
    if (mode === "expanded") {
      firstLinkRef.current?.focus({ preventScroll: true });
    } else if (mode === "compact" && focusArrow.current) {
      toggleRef.current?.focus({ preventScroll: true });
    }
    focusArrow.current = false;
  }, [mode]);

  // Esc and a click outside close the expanded header.
  useEffect(() => {
    if (!expanded) return;
    function onKeyDown(event: KeyboardEvent) {
      const nestedOpen =
        shellRef.current?.querySelector(
          `[aria-expanded="true"]:not([${TOGGLE_ATTR}])`,
        ) != null;
      if (closesOnKey("expanded", event.key, nestedOpen)) {
        focusArrow.current = true;
        dispatch({ type: "collapse" });
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
  }, [expanded, shellRef]);

  function changeLanguage(value: Language) {
    setLanguage(value);
    saveLanguage(value);
  }

  return (
    <BuyerHeaderView
      mode={mode}
      enter={headerEnter(modes.previous, mode)}
      content={{
        pathname,
        search,
        city,
        onCity: setCity,
        language,
        onLanguage: changeLanguage,
        newFavorites,
      }}
      reveal={!revealed}
      panelId={panelId}
      fullHeight={fullHeight}
      barHeight={barHeight}
      animating={animating}
      reduceMotion={reduceMotion}
      onToggle={() => {
        // The arrow stays the same element: a keyboard user keeps the focus on it, a mouse
        // click gets no programmatic focus (no ring, also in Safari).
        dispatch({ type: "toggle", y: window.scrollY });
      }}
      onLogo={() => {
        dispatch({ type: "collapse" });
        scrollToTop(reduceMotion);
      }}
      onBackgroundDone={() => setAnimating(false)}
      headerRef={headerRef}
      shellRef={shellRef}
      measureRef={measureRef}
      toggleRef={toggleRef}
      firstLinkRef={firstLinkRef}
    />
  );
}
