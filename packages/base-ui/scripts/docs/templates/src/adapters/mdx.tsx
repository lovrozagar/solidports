// The MDX provider of the Solid docs (`providerImportSource`): the docs' `useMDXComponents`
// (`src/mdx-components.tsx`), with every HTML tag MDX leaves as a string rendered through a
// component, since Solid does not render a tag name as a component.
import { dynamic } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { useMDXComponents as useDocsMDXComponents } from 'docs/src/mdx-components';

type MDXComponent = (props: Record<string, unknown>) => JSX.Element;
interface MDXComponents {
  [key: string]: MDXComponent | MDXComponents | string | undefined;
}

const tags = new Map<string, MDXComponent>();

function tagComponent(tag: string): MDXComponent {
  let component = tags.get(tag);
  if (!component) {
    const Tag = dynamic(() => tag, { static: true }) as MDXComponent;
    component = (props) => <Tag {...props} />;
    tags.set(tag, component);
  }
  return component;
}

function componentsOf(components: MDXComponents): MDXComponents {
  return new Proxy(components, {
    get(target, key) {
      const value = Reflect.get(target, key);
      if (typeof key !== 'string') {
        return value;
      }
      if (value === undefined && /^[a-z]/.test(key)) {
        return tagComponent(key);
      }
      return typeof value === 'string' ? tagComponent(value) : value;
    },
  });
}

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return componentsOf({ ...(useDocsMDXComponents()() as MDXComponents), ...components });
}
