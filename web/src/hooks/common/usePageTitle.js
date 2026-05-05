import { useEffect } from 'react';
import { getSystemName } from '../../helpers';

/**
 * Set page title with format: "PageName - SystemName"
 * @param {string} pageTitle - The current page title (e.g., "令牌管理", "渠道管理")
 */
export function usePageTitle(pageTitle) {
  useEffect(() => {
    const systemName = getSystemName() || 'TokenC';
    if (pageTitle) {
      document.title = `${pageTitle} - ${systemName}`;
    } else {
      document.title = systemName;
    }

    // Cleanup: restore system name on unmount
    return () => {
      document.title = systemName;
    };
  }, [pageTitle]);
}
