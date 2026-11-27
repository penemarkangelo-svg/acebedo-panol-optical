import { ChartIcon, SettingsIcon, ShopIcon, UsersGroupRoundedIcon, WidgetIcon } from "@solar-icons/react/linear";
import WorkspaceLayout from "../../components/WorkspaceLayout";

const navItems = [
  { name: "Overview", path: "/super-admin/overview", icon: WidgetIcon, group: "Workspace" },
  { name: "Team", path: "/super-admin/team", icon: UsersGroupRoundedIcon, group: "Workspace" },
  { name: "Reports", path: "/super-admin/reports", icon: ChartIcon, group: "Business" },
  { name: "Settings", icon: SettingsIcon, group: "Business" },
  { name: "System Admin", path: "/admin/dashboard", icon: ShopIcon, group: "Operations" },
];

export default function SuperAdminLayout() {
  return <WorkspaceLayout name="Super Admin" dashboardPath="/super-admin/overview" navItems={navItems} />;
}
