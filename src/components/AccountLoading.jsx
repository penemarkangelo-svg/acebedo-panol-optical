import "../styles/catalog-skeleton.css";
import "../styles/AccountLoading.css";

const RECORD_LISTS = {
  appointments: { label: "Loading your appointments…", className: "appointment-list", Card: AppointmentPlaceholder },
  prescriptions: { label: "Loading your prescriptions…", className: "account-record-list", Card: PrescriptionPlaceholder },
  orders: { label: "Loading your orders…", className: "order-history__list", Card: OrderPlaceholder },
};

export function AccountSkeleton({ className = "", width }) {
  return <span className={`catalog-skeleton account-skeleton ${className}`} style={{ width }} aria-hidden="true" />;
}

function AppointmentPlaceholder() {
  return (
    <div className="appointment-list-card">
      <AccountSkeleton className="account-skeleton-date" />
      <div className="account-skeleton-lines">
        <AccountSkeleton width="9rem" />
        <AccountSkeleton width="13rem" />
        <AccountSkeleton width="5rem" />
      </div>
      <div className="appointment-list-actions">
        <AccountSkeleton className="account-skeleton-pill" width="5rem" />
        <AccountSkeleton width="4rem" />
      </div>
    </div>
  );
}

function PrescriptionPlaceholder() {
  return (
    <div className="account-record-card">
      <div className="account-record-card-heading">
        <AccountSkeleton width="10rem" />
        <AccountSkeleton width="5rem" />
      </div>
      <div className="account-prescription-grid">
        <div>
          {Array.from({ length: 12 }, (_, index) => <AccountSkeleton key={index} width="60%" />)}
        </div>
      </div>
    </div>
  );
}

function OrderPlaceholder() {
  return (
    <div className="order-history__card">
      <div className="order-history__card-header">
        <div className="account-skeleton-lines">
          <AccountSkeleton width="6rem" />
          <AccountSkeleton width="8rem" />
        </div>
        <AccountSkeleton className="order-history__status account-skeleton-pill" width="5rem" />
        <AccountSkeleton className="order-history__total" width="4rem" />
      </div>
      <div className="order-history__items">
        <div className="order-history__item">
          <AccountSkeleton className="account-skeleton-thumbnail" />
          <div className="account-skeleton-lines">
            <AccountSkeleton width="9rem" />
            <AccountSkeleton width="6rem" />
          </div>
          <AccountSkeleton width="3rem" />
        </div>
      </div>
    </div>
  );
}

export default function AccountLoading({ section }) {
  const { label, className, Card } = RECORD_LISTS[section];

  return (
    <>
      <p className="sr-only" role="status">{label}</p>
      <div className={className} aria-hidden="true">
        <Card />
        <Card />
      </div>
    </>
  );
}
