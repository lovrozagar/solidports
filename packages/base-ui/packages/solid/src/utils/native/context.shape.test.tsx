import { createContext, createOwner, createRoot, getOwner, runWithOwner, useContext } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { hydrateProviderOwners } from './context';

/*
 * GOTCHA-017: while hydrating, a native part rebuilds the owners of the server's `<Provider>`
 * (`hydrateProviderOwners`) instead of running the provider. This pins that shape against Solid's
 * own provider on the client: the owner the children render under, and the id the next sibling
 * takes, must match. A Solid release that changes the provider's owners fails here.
 */

const Label = createContext('none');

interface Ids {
  render: string | undefined;
  context: string;
  sibling: string | undefined;
}

/** Under a root with a fixed id: provides `Label` with `provide`, renders, then adds a sibling. */
function idsUnder(provide: (render: () => Ids['render'] & {}) => unknown): Ids {
  return createRoot(
    () => {
      let context = '';
      const render = () => {
        context = useContext(Label);
        return getOwner()!.id!;
      };
      let rendered = provide(render) as unknown;
      // The provider hands back its children memo; reading it renders the children.
      while (typeof rendered === 'function') {
        rendered = (rendered as () => unknown)();
      }
      return { render: rendered as string, context, sibling: createOwner().id };
    },
    { id: 't' },
  );
}

describe('hydrateProviderOwners', () => {
  it('takes the ids Solid’s provider takes, for the children and the next sibling', () => {
    const provider = idsUnder((render) =>
      (Label as unknown as (props: { value: string; children: unknown }) => unknown)({
        value: 'label',
        get children() {
          return render();
        },
      }),
    );
    const rebuilt = idsUnder((render) => runWithOwner(hydrateProviderOwners(Label, 'label'), render));
    expect(rebuilt).toEqual(provider);
    expect(provider.context).toBe('label');
  });
});
