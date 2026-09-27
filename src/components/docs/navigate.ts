import { createContext } from 'react';

/** Opens another docs page without a full page load (`DocsPage` provides it). */
export const DocsNavigate = createContext<(page: string, section?: string) => void>(() => {});
