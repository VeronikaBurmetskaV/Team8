import { useId, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import type { BrandProfileResponse } from "../../api/types";
import { useBrandProfile } from "../../shared/brandProfile";
import { formatConsentDate } from "../../shared/consentDate";
import { cabinetHomeTexts as t } from "../../shared/messages.uk";
import { brandKey } from "../catalog/catalog";
import { monogram, monogramStyle } from "../catalog/brandGrid";
import { SiteImportCard } from "../cabinet-import/SiteImportCard";
import { LoadError } from "../cabinet-products/LoadError";
import { useBrandProducts } from "../cabinet-products/queries";
import {
  homeNotices,
  summarizeProducts,
  websiteLink,
  type ProductSummary,
} from "./cabinetHome";
import styles from "./BrandHomePage.module.css";

/** The round logo, or the brand's monogram in its catalogue colour (also when the image fails). */
function BrandAvatar({ profile }: { profile: BrandProfileResponse }) {
  const [failed, setFailed] = useState(false);
  const name = profile.name ?? "";
  if (profile.logoDisplayUrl !== null && !failed) {
    return (
      <img
        className={styles.avatar}
        src={profile.logoDisplayUrl}
        alt={t.logoAlt(name)}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className={`${styles.avatar} ${styles.monogram}`}
      style={monogramStyle(brandKey(name)) as CSSProperties}
      aria-hidden="true"
    >
      {monogram(name) || "?"}
    </span>
  );
}

/** Top of /brand: logo, the brand name, the website, the consent status, «Редагувати профіль». */
function ProfileHeader({ profile }: { profile: BrandProfileResponse }) {
  const nameId = useId();
  const site = websiteLink(profile.websiteUrl);
  const consented = profile.consentGiven && profile.consentGivenAt !== null;
  return (
    <section className={styles.profile} aria-labelledby={nameId}>
      <BrandAvatar profile={profile} />
      <div className={styles.profileText}>
        <h2
          id={nameId}
          className={profile.name === null ? styles.nameMissing : styles.name}
        >
          {profile.name ?? t.noName}
        </h2>
        {site !== null && (
          <a
            className={styles.website}
            href={site.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t.websiteLabel(site.text)}
          >
            {site.text}
          </a>
        )}
        <p className={styles.consentLine} data-consent={consented}>
          <span className={styles.dot} aria-hidden="true" />
          {consented && profile.consentGivenAt !== null
            ? t.consentGivenOn(formatConsentDate(profile.consentGivenAt))
            : t.consentMissing}
        </p>
      </div>
      <Link className={styles.editProfile} to="/brand/profile">
        {t.editProfile}
      </Link>
    </section>
  );
}

/** A calm notice under the profile header (role="status"): no name, or no consent yet. */
function Notice({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: { to: string; label: string };
}) {
  return (
    <div className={styles.notice} role="status">
      <div>
        <p className={styles.noticeTitle}>{title}</p>
        <p className={styles.noticeText}>{text}</p>
      </div>
      <Link className={styles.noticeAction} to={action.to}>
        {action.label}
      </Link>
    </div>
  );
}

function Stats({ summary }: { summary: ProductSummary }) {
  return (
    <dl className={styles.stats}>
      <div>
        <dt>{t.total}</dt>
        <dd>{summary.total}</dd>
      </div>
      <div>
        <dt>{t.published}</dt>
        <dd>{summary.published}</dd>
      </div>
      <div>
        <dt>{t.drafts}</dt>
        <dd>{summary.drafts}</dd>
      </div>
    </dl>
  );
}

/**
 * /brand: the cabinet home page, where a brand lands after login and registration. The profile
 * header, the notices (no name / no consent) and the «Товари» card with the counts and the big
 * «Додати товар». Reads only the existing profile and product list queries.
 */
export function BrandHomePage() {
  const profile = useBrandProfile();
  const products = useBrandProducts();
  const summary = products.isSuccess ? summarizeProducts(products.data) : null;
  const notices = profile.isSuccess ? homeNotices(profile.data) : null;
  const canAdd = profile.isSuccess && profile.data.name !== null;
  const hintId = useId();

  return (
    <div className={styles.page}>
      <h1 className={styles.visuallyHidden}>{t.title}</h1>

      {profile.isPending && (
        <div
          className={`${styles.profile} ${styles.skeletonProfile}`}
          aria-hidden="true"
        >
          <span className={`${styles.avatar} ${styles.skeleton}`} />
          <span className={`${styles.skeletonLine} ${styles.skeleton}`} />
        </div>
      )}
      {profile.isError && (
        <LoadError
          error={profile.error}
          onRetry={() => void profile.refetch()}
        />
      )}
      {profile.isSuccess && <ProfileHeader profile={profile.data} />}

      {notices?.needsName && (
        <Notice
          title={t.nameNoticeTitle}
          text={t.nameNoticeText}
          action={{ to: "/brand/profile", label: t.addName }}
        />
      )}
      {notices?.needsConsent && (
        <Notice
          title={t.consentNoticeTitle}
          text={t.consentNoticeText}
          action={{ to: "/brand/profile#consent", label: t.confirmConsent }}
        />
      )}

      {/* Brand site import (ADR-0017): needs a saved name, like every card. */}
      {profile.isSuccess && profile.data.name !== null && (
        <SiteImportCard profile={profile.data} />
      )}

      <section className={styles.products} aria-labelledby="home-products">
        <h2 id="home-products" className={styles.productsTitle}>
          {t.productsTitle}
        </h2>
        {products.isPending && (
          <div className={styles.stats} aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={`${styles.skeletonStat} ${styles.skeleton}`}
              />
            ))}
          </div>
        )}
        {products.isPending && (
          <p className={styles.visuallyHidden}>{t.loading}</p>
        )}
        {products.isError && (
          <LoadError
            error={products.error}
            onRetry={() => void products.refetch()}
          />
        )}
        {summary !== null && <Stats summary={summary} />}
        {summary?.total === 0 && (
          <p className={styles.empty}>{t.emptyProducts}</p>
        )}

        {canAdd ? (
          <Link className={styles.addProduct} to="/brand/products/new">
            {t.addProduct}
          </Link>
        ) : (
          <>
            {/* Off until the name is saved: a card needs it (409 PROFILE_INCOMPLETE). */}
            <button
              type="button"
              className={styles.addProduct}
              disabled
              aria-describedby={profile.isSuccess ? hintId : undefined}
            >
              {t.addProduct}
            </button>
            {profile.isSuccess && (
              <p id={hintId} className={styles.addHint}>
                {t.addProductNeedsName}
              </p>
            )}
          </>
        )}
        <Link className={styles.allProducts} to="/brand/products">
          {t.allProducts}
        </Link>
      </section>
    </div>
  );
}
