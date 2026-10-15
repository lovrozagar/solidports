import { createEffect, createMemo, createSignal, merge, omit, untrack } from 'solid-js';
import { Dynamic } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import type { CodeEditorProps } from './CodeEditor';
import { defaultCodeEditorLoader, loadCodeEditor, peekCodeEditor } from './codeEditorCache';
import type { CodeEditorLoader, CodeEditorModule } from './codeEditorCache';

/** Loads react-simple-code-editor only after an editable block requests it. */
export function CodeEditorLazy(
  _props: CodeEditorProps & {
    loader?: CodeEditorLoader;
    fallback: JSX.Element;
  },
) {
  const props = merge(
    {
      loader: defaultCodeEditorLoader,
    },
    _props,
  );
  const rest = omit(props, 'loader', 'fallback');
  const [module, setModule] = createSignal<CodeEditorModule | undefined>(() =>
    untrack(() => peekCodeEditor(props.loader)),
  );
  createEffect(
    () => [props.loader],
    () => {
      let active = true;
      loadCodeEditor(props.loader).then(
        (loaded) => {
          if (active) {
            setModule(loaded);
          }
        },
        () => {},
      );
      return () => {
        active = false;
      };
    },
  );
  const _render = createMemo(() => {
    const _module = module();
    if (!_module) {
      return props.fallback;
    }
    return <Dynamic component={_module.CodeEditor} {...rest} fallback={props.fallback} />;
  });
  return <>{_render()}</>;
}
