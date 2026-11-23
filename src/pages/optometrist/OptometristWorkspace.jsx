import { BellIcon, CalendarIcon, DocumentTextIcon, EyeIcon, WidgetIcon } from "@solar-icons/react/linear";
import WorkspaceLayout from "../../components/WorkspaceLayout";
import "../../styles/OptometristWorkspace.css";

const navItems = [
  { name: "Dashboard", path: "/optometrist/dashboard", icon: WidgetIcon, group: "Workspace" },
  { name: "Appointments", path: "/optometrist/appointments", icon: CalendarIcon, group: "Eye care" },
  { name: "Vision screening", path: "/optometrist/screenings", icon: EyeIcon, group: "Clinical review" },
  { name: "Prescriptions", path: "/optometrist/prescriptions", icon: DocumentTextIcon, group: "Clinical review" },
  { name: "Review history", path: "/optometrist/review-history", icon: DocumentTextIcon, group: "Clinical review" },
  { name: "Clinical records", path: "/optometrist/clinical-records", icon: DocumentTextIcon, group: "Clinical review" },
  { name: "Notifications", icon: BellIcon, group: "Updates" },
];

export default function OptometristWorkspace() {
  return <WorkspaceLayout name="Optometrist" dashboardPath="/optometrist/dashboard" navItems={navItems} />;
}

const sections = {
  screenings: { title: "Vision screening records", description: "Review preliminary questionnaire responses and recorded test results only when the screening is linked to a confirmed or completed appointment." },
  "review-history": { title: "Prescription review history", description: "Previously reviewed documents, decisions, and notes will appear here when the review workflow is connected." },
  notifications: { title: "Notifications", description: "In-app appointment and prescription-review notifications are planned for a later release." },
};

export function OptometristSection({ section }) {
  const item = sections[section];
  return (
    <div className="apo-dashboard">
      <header className="apo-dashboard-header">
        <div className="apo-dashboard-title-row">
          <div>
            <p className="apo-dashboard-eyebrow">Clinical workspace</p>
            <h1>{item.title}</h1>
            <p className="apo-dashboard-date apo-optometrist-description">{item.description}</p>
          </div>
        </div>
      </header>
      <section className="apo-dashboard-panel apo-optometrist-note">
        <h2>This section is in development</h2>
        <p>Records and controls will appear here when the workflow is ready.</p>
      </section>
    </div>
  );
}
