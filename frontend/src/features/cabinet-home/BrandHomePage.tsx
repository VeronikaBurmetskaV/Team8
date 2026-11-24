import { Link } from "react-router";
import type { BrandProfileResponse } from "../../api/types";
import { useBrandProfile } from "../../shared/brandProfile";
import { cabinetHomeTexts as t } from "../../shared/messages.uk";
import { AddProductEntry } from "../cabinet-products/AddProductEntry";
import { LoadError } from "../cabinet-products/LoadError";
import { useBrandProducts } from "../cabinet-products/queries";
import { formatConsentDate } from "../../shared/consentDate";
import { summarizeProducts } from "./cabinetHome";
import styles from "./BrandHomePage.module.css";

function ProfileDetails({ profile }: { profile: BrandProfileResponse }) {
  return (
    <dl className={styles.details}>
      <div>
        <dt>{t.brandName}</dt>
        <dd>{profile.name ?? t.noBrandName}</dd>
      </div>
      <div>
        <dt>{t.consent}</dt>
        <dd>
          {profile.consentGiven && profile.consentGivenAt !== null
            ? t.consentGiven(formatConsentDate(profile.consentGivenAt))
            : t.consentNotGiven}
        </dd>
      </div>
    </dl>
  );
}

/**
 * /brand: the cabinet home page, where a brand lands after login and registration.
 * The big «Додати товар» (or the way to the profile while the brand has no name), the
 * profile and a short summary of the products. Reads only the existing profile and product
 * list queries.
 */
export function BrandHomePage() {
  const profile = useBrandProfile();
  const products = useBrandProducts();
  const summary = products.isSuccess ? summarizeProducts(products.data) : null;

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{t.title}</h1>

      <div className={styles.hero}>
        <AddProductEntry
          profileState={profile.data?.state ?? null}
          size="large"
        />
        {summary?.total === 0 && <p className={styles.empty}>{t.noProducts}</p>}
      </div>

      <div className={styles.cards}>
        <article
          className={`${styles.card} ${styles.profileCard}`}
          aria-labelledby="home-profile"
        >
          <h2 id="home-profile" className={styles.cardTitle}>
            {t.profileTitle}
          </h2>
          {profile.isPending && <p>{t.loading}</p>}
          {profile.isError && (
            <LoadError
              error={profile.error}
              onRetry={() => void profile.refetch()}
            />
          )}
          {profile.isSuccess && <ProfileDetails profile={profile.data} />}
          <Link className={styles.cardAction} to="/brand/profile">
            {t.editProfile}
          </Link>
        </article>

        <article className={styles.card} aria-labelledby="home-products">
          <h2 id="home-products" className={styles.cardTitle}>
            {t.productsTitle}
          </h2>
          {products.isPending && <p>{t.loading}</p>}
          {products.isError && (
            <LoadError
              error={products.error}
              onRetry={() => void products.refetch()}
            />
          )}
          {summary !== null && (
            <dl className={styles.counts}>
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
          )}
          <Link className={styles.cardAction} to="/brand/products">
            {t.allProducts}
          </Link>
        </article>
      </div>
    </section>
  );
}
