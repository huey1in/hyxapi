export type SidebarItem = { to?: string; label?: string; divider?: boolean; admin?: boolean; root?: boolean };
type Options = { preview?: boolean; admin?: boolean; root?: boolean; isVisible?: (path: string) => boolean };
export const filterSidebarItems = <T extends SidebarItem>(items: T[], { preview, admin, root, isVisible }: Options): T[] =>
  items.filter((item) => {
    if (preview && (item.admin || item.root)) return false;
    if (item.admin && !admin) return false;
    if (item.root && !root) return false;
    if (item.to && isVisible && !isVisible(item.to)) return false;
    return true;
  });
