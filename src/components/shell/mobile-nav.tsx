import { MobileLinks } from "./nav-links";

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <MobileLinks />
    </nav>
  );
}
