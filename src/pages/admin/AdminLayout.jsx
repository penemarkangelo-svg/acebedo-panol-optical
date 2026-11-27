import WorkspaceLayout from "../../components/WorkspaceLayout";
import {
  BagIcon,
  BoxIcon,
  CalendarIcon,
  CardIcon,
  ChartIcon,
  DocumentTextIcon,
  DollarIcon,
  EyeIcon,
  GalleryIcon,
  ShopIcon,
  WidgetIcon,
} from "@solar-icons/react/linear";

const navItems = [
  { name: "Dashboard", path: "/admin/dashboard", icon: WidgetIcon, group: "Workspace" },
  { name: "Products", path: "/admin/products", icon: BoxIcon, group: "Commerce" },
  { name: "Product media", path: "/admin/product-media", icon: GalleryIcon, group: "Commerce" },
  { name: "Inventory", path: "/admin/inventory", icon: BoxIcon, group: "Commerce" },
  { name: "Orders", path: "/admin/orders", icon: BagIcon, group: "Commerce" },
  { name: "Payments", path: "/admin/payments", icon: CardIcon, group: "Commerce" },
  { name: "Lens pricing", path: "/admin/lens-pricing", icon: DollarIcon, group: "Commerce" },
  { name: "Brands", path: "/admin/brands", icon: ShopIcon, group: "Commerce" },
  { name: "Appointments", path: "/admin/appointments", icon: CalendarIcon, group: "Eye care" },
  { name: "Prescriptions", path: "/admin/prescriptions", icon: DocumentTextIcon, group: "Eye care" },
  { name: "Vision screening", path: "/admin/screenings", icon: EyeIcon, group: "Eye care" },
];

export default function AdminLayout({ canManageAdmins }) {
  const links = canManageAdmins
    ? [...navItems, { name: "Super Admin", path: "/super-admin/overview", icon: ChartIcon, group: "Workspace" }]
    : navItems;
  return <WorkspaceLayout name="System Admin" dashboardPath="/admin/dashboard" navItems={links} />;
}
