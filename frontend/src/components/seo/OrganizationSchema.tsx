import { useEffect } from 'react';
import { organizationSchema } from '@/config/company';

/**
 * Adds the factual Organization JSON-LD to <head> while the page is shown
 * (EP13: /about and /contact). Removed again on unmount.
 */
export function OrganizationSchema() {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.schema = 'organization';
    script.textContent = JSON.stringify(organizationSchema());
    document.head.append(script);
    return () => script.remove();
  }, []);
  return null;
}
