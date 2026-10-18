import {
  Bookmark,
  Compass,
  Home,
  Mail,
  Rss,
  Settings,
  SlidersHorizontal,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/articles", label: "Explore", icon: Compass },
  { href: "/newsletter", label: "Newsletter", icon: Mail },
  { href: "/saved", label: "Saved Articles", icon: Bookmark },
  { href: "/sources", label: "Sources", icon: Rss },
  { href: "/workflow", label: "Workflow", icon: Workflow },
  { href: "/preferences", label: "Preferences", icon: SlidersHorizontal },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/newsletter", label: "Digest", icon: Mail },
  { href: "/sources", label: "Sources", icon: Rss },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
