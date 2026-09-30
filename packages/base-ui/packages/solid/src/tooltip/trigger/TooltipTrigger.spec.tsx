import { Tooltip } from '@solidports/base-ui/tooltip';

// `props: any` will error
<Tooltip.Trigger render={{ component: 'button', type: 'button' }} />;
<Tooltip.Trigger render="input" />;
