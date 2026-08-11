import type { Role } from "@/lib/types";
import {
  LayoutDashboard,
  BedDouble,
  UserPlus,
  Users,
  ClipboardList,
  QrCode,
  TrendingUp,
  CalendarDays,
  MonitorSmartphone,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Shown in the mobile bottom tab bar (max 5 recommended). */
  mobile?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["STAFF", "MANAGER", "OWNER"], mobile: true },
  { href: "/rooms", label: "Rooms", icon: BedDouble, roles: ["STAFF", "MANAGER", "OWNER"], mobile: true },
  { href: "/checkin", label: "Check-In", icon: UserPlus, roles: ["STAFF", "MANAGER", "OWNER"], mobile: true },
  { href: "/bookings", label: "Bookings Calendar", icon: CalendarDays, roles: ["STAFF", "MANAGER", "OWNER"] },
  { href: "/requests", label: "Requests", icon: ClipboardList, roles: ["STAFF", "MANAGER", "OWNER"], mobile: true },
  { href: "/guests", label: "Guests", icon: Users, roles: ["STAFF", "MANAGER", "OWNER"], mobile: true },
  { href: "/qr-codes", label: "QR Codes", icon: QrCode, roles: ["MANAGER", "OWNER"] },
  { href: "/owner", label: "Profit Dashboard", icon: TrendingUp, roles: ["OWNER"] },
  { href: "/devices", label: "Signed-in Devices", icon: MonitorSmartphone, roles: ["OWNER"] },
];

export function getNavForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
