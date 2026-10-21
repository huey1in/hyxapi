import { useEffect } from 'react';
import { getSystemName } from '../../helpers';

/**
 * Set page title with format: "PageName - SystemName"
 * @param {string | null} pageTitle - Page name, or null when another component owns the title.
 */
export function usePageTitle(pageTitle) {
  useEffect(() => {
    if (pageTitle === null) return;
    const systemName = getSystemName() || 'Hyxware';
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
