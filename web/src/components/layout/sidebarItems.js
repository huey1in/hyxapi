export const filterSidebarItems = (items, { preview, admin, root }) =>
  items.filter((item) => {
    if (preview && (item.admin || item.root)) return false;
    if (item.admin && !admin) return false;
    if (item.root && !root) return false;
    return true;
  });
