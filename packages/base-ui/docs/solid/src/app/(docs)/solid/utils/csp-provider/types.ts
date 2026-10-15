import { CSPProvider } from '@solidports/base-ui/csp-provider';
import { createTypes } from 'docs/src/utils/createTypes';

export const TypesCSPProvider = createTypes(import.meta.url, CSPProvider);
