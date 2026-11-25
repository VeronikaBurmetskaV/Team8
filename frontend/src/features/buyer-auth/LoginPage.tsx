import { useRef, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Link, useSearchParams } from "react-router";
import { BrandLoginForm } from "../cabinet-auth/BrandLoginForm";
import { loginTexts as t } from "../../shared/messages.uk";
import auth from "../../shared/auth/AuthForm.module.css";
import { useContentHeight } from "../../shared/useContentHeight";
import { BuyerLoginForm } from "./BuyerLoginForm";
import {
  LOGIN_TABS,
  parseLoginTab,
  tabForKey,
  type LoginTab,
} from "./loginTabs";
import styles from "./LoginPage.module.css";

const TAB_LABELS: Record<LoginTab, string> = {
  buyer: t.buyerTab,
  brand: t.brandTab,
};

const tabId = (tab: LoginTab) => `login-tab-${tab}`;
const PANEL_ID = "login-panel";

function BuyerPanel() {
  return (
    <>
      <BuyerLoginForm />
      <p className={auth.footer}>
        {t.noAccount} <Link to="/register">{t.registerBuyer}</Link>
      </p>
    </>
  );
}

function BrandPanel() {
  return (
    <>
      <BrandLoginForm />
      <p className={auth.footer}>
        {t.noAccount} <Link to="/brand/register">{t.registerBrand}</Link>
      </p>
    </>
  );
}

/**
 * /login: one page for both logins. «Вхід» (buyer, the default) and «Вхід для бренду»
 * (/login?tab=brand) are WAI-ARIA tabs; the old /brand/login redirects here.
 */
export function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = parseLoginTab(searchParams);
  const tabRefs = useRef<Partial<Record<LoginTab, HTMLButtonElement | null>>>(
    {},
  );
  const reduceMotion = useReducedMotion() ?? false;
  const { ref: contentRef, height } = useContentHeight();

  function select(tab: LoginTab) {
    if (tab === active) return;
    // replace: switching tabs is not a new step in the browser history.
    setSearchParams(tab === "brand" ? { tab: "brand" } : {}, { replace: true });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = tabForKey(event.key, active);
    if (next === null) return;
    event.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  }

  const duration = reduceMotion ? 0 : 0.2;

  return (
    <div className={auth.page}>
      <h1 className={styles.visuallyHidden}>{t.title}</h1>
      <div
        className={styles.tabs}
        role="tablist"
        aria-label={t.tabsLabel}
        onKeyDown={onKeyDown}
      >
        {LOGIN_TABS.map((tab) => {
          const selected = tab === active;
          return (
            <button
              key={tab}
              ref={(element) => {
                tabRefs.current[tab] = element;
              }}
              id={tabId(tab)}
              type="button"
              role="tab"
              className={styles.tab}
              aria-selected={selected}
              aria-controls={PANEL_ID}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(tab)}
            >
              {TAB_LABELS[tab]}
              {/* One green line, shared by both tabs: motion slides it under the new tab
                  (layoutId); with prefers-reduced-motion it just moves. */}
              {selected && (
                <motion.span
                  layoutId="login-tab-line"
                  className={styles.tabLine}
                  aria-hidden="true"
                  transition={{ duration, ease: "easeOut" }}
                />
              )}
            </button>
          );
        })}
      </div>

      <motion.div
        className={styles.card}
        animate={{ height }}
        initial={false}
        transition={{ duration, ease: "easeOut" }}
      >
        <div ref={contentRef} className={styles.cardInner}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              id={PANEL_ID}
              role="tabpanel"
              aria-labelledby={tabId(active)}
              className={styles.panel}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration / 2 }}
            >
              {active === "brand" ? <BrandPanel /> : <BuyerPanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
