import { BagIcon, CalendarIcon, WidgetIcon } from "@solar-icons/react/linear";
import WorkspaceLayout from "../../components/WorkspaceLayout";

const navItems = [
  { name: "Dashboard", path: "/staff/dashboard", icon: WidgetIcon, group: "Workspace" },
  { name: "Orders", path: "/staff/orders", icon: BagIcon, group: "Commerce" },
  { name: "Appointments", path: "/staff/appointments", icon: CalendarIcon, group: "Eye care" },
];

export default function ClinicStaffLayout() {
  return <WorkspaceLayout name="Clinic Staff" dashboardPath="/staff/dashboard" navItems={navItems} />;
}
