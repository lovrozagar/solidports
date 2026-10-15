import { createEffect, createMemo, createSignal, omit, untrack } from 'solid-js';
import { reactStyle, useImperativeHandle } from 'docs/src/adapters/react';
import type { PropsWithoutRef, ReactEventHandler, ReactProps, Ref } from 'docs/src/adapters/react';
import type { JSX } from '@solidjs/web';

type Padding<T> =
  | T
  | {
      top?: T;
      right?: T;
      bottom?: T;
      left?: T;
    };
type Props = ReactProps<JSX.HTMLAttributes<HTMLDivElement>> & {
  // Props for the component
  highlight: (value: string) => string | JSX.Element;
  ignoreTabKey?: boolean;
  insertSpaces?: boolean;
  onValueChange: (value: string) => void;
  padding?: Padding<number | string>;
  style?: JSX.CSSProperties;
  tabSize?: number;
  value: string;

  // Props for the textarea
  autoFocus?: boolean;
  disabled?: boolean;
  form?: string;
  maxLength?: number;
  minLength?: number;
  name?: string;
  onBlur?: ReactEventHandler<HTMLTextAreaElement, FocusEvent>;
  onClick?: ReactEventHandler<HTMLTextAreaElement, MouseEvent>;
  onFocus?: ReactEventHandler<HTMLTextAreaElement, FocusEvent>;
  onKeyDown?: ReactEventHandler<HTMLTextAreaElement, KeyboardEvent>;
  onKeyUp?: ReactEventHandler<HTMLTextAreaElement, KeyboardEvent>;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  textareaClassName?: string;
  textareaId?: string;

  // Props for the hightlighted code’s pre element
  preClassName?: string;
};
type Record = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};
type History = {
  stack: (Record & {
    timestamp: number;
  })[];
  offset: number;
};
const KEYCODE_Y = 89;
const KEYCODE_Z = 90;
const KEYCODE_M = 77;
const KEYCODE_PARENS = 57;
const KEYCODE_BRACKETS = 219;
const KEYCODE_QUOTE = 222;
const KEYCODE_BACK_QUOTE = 192;
const HISTORY_LIMIT = 100;
const HISTORY_TIME_GAP = 3000;
const isWindows =
  typeof window !== 'undefined' && 'navigator' in window && /Win/i.test(navigator.platform);
const isMacLike =
  typeof window !== 'undefined' &&
  'navigator' in window &&
  /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
const className = 'npm__react-simple-code-editor__textarea';
const cssText = /* CSS */ `
/**
 * Reset the text fill color so that placeholder is visible
 */
.${className}:empty {
  -webkit-text-fill-color: inherit !important;
}

/**
 * Hack to apply on some CSS on IE10 and IE11
 */
@media all and (-ms-high-contrast: none), (-ms-high-contrast: active) {
  /**
    * IE doesn't support '-webkit-text-fill-color'
    * So we use 'color: transparent' to make the text transparent on IE
    * Unlike other browsers, it doesn't affect caret color in IE
    */
  .${className} {
    color: transparent !important;
  }

  .${className}::selection {
    background-color: #accef7 !important;
    color: transparent !important;
  }
}
`;
const Editor = function Editor(
  _props: PropsWithoutRef<Props> & {
    ref?: Ref<null | {
      session: {
        history: History;
      };
    }>;
  },
) {
  const props = omit(_props, 'ref');
  const _props2 = createMemo(() => {
    const {
      autoFocus,
      disabled,
      form,
      highlight,
      ignoreTabKey = false,
      insertSpaces = true,
      maxLength,
      minLength,
      name,
      onBlur,
      onClick,
      onFocus,
      onKeyDown,
      onKeyUp,
      onValueChange,
      padding = 0,
      placeholder,
      preClassName,
      readOnly,
      required,
      style,
      tabSize = 2,
      textareaClassName,
      textareaId,
      value,
      ...rest
    } = props;
    return {
      autoFocus,
      disabled,
      form,
      highlight,
      maxLength,
      minLength,
      name,
      onBlur,
      onClick,
      onFocus,
      onKeyDown,
      onKeyUp,
      onValueChange,
      placeholder,
      preClassName,
      readOnly,
      required,
      style,
      textareaClassName,
      textareaId,
      value,
      rest,
      ignoreTabKey,
      insertSpaces,
      padding,
      tabSize,
    };
  });
  const historyRef: {
    current: History;
  } = {
    current: {
      stack: [],
      offset: -1,
    },
  };
  const inputRef: {
    current: HTMLTextAreaElement | null;
  } = {
    current: null,
  };
  const [capture, setCapture] = createSignal(true);
  const contentStyle = createMemo(() => {
    const _padding = _props2().padding;
    return {
      paddingTop: typeof _padding === 'object' ? _padding.top : _padding,
      paddingRight: typeof _padding === 'object' ? _padding.right : _padding,
      paddingBottom: typeof _padding === 'object' ? _padding.bottom : _padding,
      paddingLeft: typeof _padding === 'object' ? _padding.left : _padding,
    };
  });
  const highlighted = createMemo(() => _props2().highlight(_props2().value));
  const getLines = (text: string, position: number) => text.substring(0, position).split('\n');
  const recordChange = (record: Record, overwrite: boolean = false) => {
    const { stack, offset } = historyRef.current;
    if (stack.length && offset > -1) {
      // When something updates, drop the redo operations
      historyRef.current.stack = stack.slice(0, offset + 1);

      // Limit the number of operations to 100
      const count = historyRef.current.stack.length;
      if (count > HISTORY_LIMIT) {
        const extras = count - HISTORY_LIMIT;
        historyRef.current.stack = stack.slice(extras, count);
        historyRef.current.offset = Math.max(historyRef.current.offset - extras, 0);
      }
    }
    const timestamp = Date.now();
    if (overwrite) {
      const last = historyRef.current.stack[historyRef.current.offset];
      if (last && timestamp - last.timestamp < HISTORY_TIME_GAP) {
        // A previous entry exists and was in short interval

        // Match the last word in the line
        const re = /[^a-z0-9]([a-z0-9]+)$/i;

        // Get the previous line
        const previous = getLines(last.value, last.selectionStart).pop()?.match(re);

        // Get the current line
        const current = getLines(record.value, record.selectionStart).pop()?.match(re);
        if (previous?.[1] && current?.[1]?.startsWith(previous[1])) {
          // The last word of the previous line and current line match
          // Overwrite previous entry so that undo will remove whole word
          historyRef.current.stack[historyRef.current.offset] = {
            ...record,
            timestamp,
          };
          return;
        }
      }
    }

    // Add the new operation to the stack
    historyRef.current.stack.push({
      ...record,
      timestamp,
    });
    historyRef.current.offset++;
  };
  const recordCurrentState = () => {
    const input = inputRef.current;
    if (!input) return;

    // Save current state of the input
    const { value, selectionStart, selectionEnd } = input;
    recordChange({
      value,
      selectionStart,
      selectionEnd,
    });
  };
  const updateInput = (record: Record) => {
    const input = inputRef.current;
    if (!input) return;

    // Update values and selection state
    input.value = record.value;
    input.selectionStart = record.selectionStart;
    input.selectionEnd = record.selectionEnd;
    _props2().onValueChange?.(record.value);
  };
  const applyEdits = (record: Record) => {
    // Save last selection state
    const input = inputRef.current;
    const last = historyRef.current.stack[historyRef.current.offset];
    if (last && input) {
      historyRef.current.stack[historyRef.current.offset] = {
        ...last,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
      };
    }

    // Save the changes
    recordChange(record);
    updateInput(record);
  };
  const undoEdit = () => {
    const { stack, offset } = historyRef.current;

    // Get the previous edit
    const record = stack[offset - 1];
    if (record) {
      // Apply the changes and update the offset
      updateInput(record);
      historyRef.current.offset = Math.max(offset - 1, 0);
    }
  };
  const redoEdit = () => {
    const { stack, offset } = historyRef.current;

    // Get the next edit
    const record = stack[offset + 1];
    if (record) {
      // Apply the changes and update the offset
      updateInput(record);
      historyRef.current.offset = Math.min(offset + 1, stack.length - 1);
    }
  };
  const handleKeyDown = (
    e: KeyboardEvent & {
      currentTarget: HTMLTextAreaElement;
      target: Element;
    },
  ) => {
    const _onKeyDown = _props2().onKeyDown;
    if (_onKeyDown) {
      _onKeyDown(e);
      if (e.defaultPrevented) {
        return;
      }
    }
    if (e.key === 'Escape') {
      e.currentTarget.blur();
    }
    const { value, selectionStart, selectionEnd } = e.currentTarget;
    const tabCharacter = (_props2().insertSpaces ? ' ' : '\t').repeat(_props2().tabSize);
    if (e.key === 'Tab' && !_props2().ignoreTabKey && capture()) {
      // Prevent focus change
      e.preventDefault();
      if (e.shiftKey) {
        // Unindent selected lines
        const linesBeforeCaret = getLines(value, selectionStart);
        const startLine = linesBeforeCaret.length - 1;
        const endLine = getLines(value, selectionEnd).length - 1;
        const nextValue = value
          .split('\n')
          .map((line, i) => {
            if (i >= startLine && i <= endLine && line.startsWith(tabCharacter)) {
              return line.substring(tabCharacter.length);
            }
            return line;
          })
          .join('\n');
        if (value !== nextValue) {
          const startLineText = linesBeforeCaret[startLine];
          applyEdits({
            value: nextValue,
            // Move the start cursor if first line in selection was modified
            // It was modified only if it started with a tab
            selectionStart: startLineText?.startsWith(tabCharacter)
              ? selectionStart - tabCharacter.length
              : selectionStart,
            // Move the end cursor by total number of characters removed
            selectionEnd: selectionEnd - (value.length - nextValue.length),
          });
        }
      } else if (selectionStart !== selectionEnd) {
        // Indent selected lines
        const linesBeforeCaret = getLines(value, selectionStart);
        const startLine = linesBeforeCaret.length - 1;
        const endLine = getLines(value, selectionEnd).length - 1;
        const startLineText = linesBeforeCaret[startLine];
        applyEdits({
          value: value
            .split('\n')
            .map((line, i) => {
              if (i >= startLine && i <= endLine) {
                return tabCharacter + line;
              }
              return line;
            })
            .join('\n'),
          // Move the start cursor by number of characters added in first line of selection
          // Don't move it if it there was no text before cursor
          selectionStart:
            startLineText && /\S/.test(startLineText)
              ? selectionStart + tabCharacter.length
              : selectionStart,
          // Move the end cursor by total number of characters added
          selectionEnd: selectionEnd + tabCharacter.length * (endLine - startLine + 1),
        });
      } else {
        const updatedSelection = selectionStart + tabCharacter.length;
        applyEdits({
          // Insert tab character at caret
          value: value.substring(0, selectionStart) + tabCharacter + value.substring(selectionEnd),
          // Update caret position
          selectionStart: updatedSelection,
          selectionEnd: updatedSelection,
        });
      }
    } else if (e.key === 'Backspace') {
      const hasSelection = selectionStart !== selectionEnd;
      const textBeforeCaret = value.substring(0, selectionStart);
      if (textBeforeCaret.endsWith(tabCharacter) && !hasSelection) {
        // Prevent default delete behaviour
        e.preventDefault();
        const updatedSelection = selectionStart - tabCharacter.length;
        applyEdits({
          // Remove tab character at caret
          value:
            value.substring(0, selectionStart - tabCharacter.length) +
            value.substring(selectionEnd),
          // Update caret position
          selectionStart: updatedSelection,
          selectionEnd: updatedSelection,
        });
      }
    } else if (e.key === 'Enter') {
      // Ignore selections
      if (selectionStart === selectionEnd) {
        // Get the current line
        const line = getLines(value, selectionStart).pop();
        const matches = line?.match(/^\s+/);
        if (matches?.[0]) {
          e.preventDefault();

          // Preserve indentation on inserting a new line
          const indent = '\n' + matches[0];
          const updatedSelection = selectionStart + indent.length;
          applyEdits({
            // Insert indentation character at caret
            value: value.substring(0, selectionStart) + indent + value.substring(selectionEnd),
            // Update caret position
            selectionStart: updatedSelection,
            selectionEnd: updatedSelection,
          });
        }
      }
    } else if (
      e.keyCode === KEYCODE_PARENS ||
      e.keyCode === KEYCODE_BRACKETS ||
      e.keyCode === KEYCODE_QUOTE ||
      e.keyCode === KEYCODE_BACK_QUOTE
    ) {
      let chars;
      if (e.keyCode === KEYCODE_PARENS && e.shiftKey) {
        chars = ['(', ')'];
      } else if (e.keyCode === KEYCODE_BRACKETS) {
        if (e.shiftKey) {
          chars = ['{', '}'];
        } else {
          chars = ['[', ']'];
        }
      } else if (e.keyCode === KEYCODE_QUOTE) {
        if (e.shiftKey) {
          chars = ['"', '"'];
        } else {
          chars = ["'", "'"];
        }
      } else if (e.keyCode === KEYCODE_BACK_QUOTE && !e.shiftKey) {
        chars = ['`', '`'];
      }

      // If text is selected, wrap them in the characters
      if (selectionStart !== selectionEnd && chars) {
        e.preventDefault();
        applyEdits({
          value:
            value.substring(0, selectionStart) +
            chars[0] +
            value.substring(selectionStart, selectionEnd) +
            chars[1] +
            value.substring(selectionEnd),
          // Update caret position
          selectionStart,
          selectionEnd: selectionEnd + 2,
        });
      }
    } else if (
      (isMacLike
        ? // Trigger undo with ⌘+Z on Mac
          e.metaKey && e.keyCode === KEYCODE_Z
        : // Trigger undo with Ctrl+Z on other platforms
          e.ctrlKey && e.keyCode === KEYCODE_Z) &&
      !e.shiftKey &&
      !e.altKey
    ) {
      e.preventDefault();
      undoEdit();
    } else if (
      (isMacLike
        ? // Trigger redo with ⌘+Shift+Z on Mac
          e.metaKey && e.keyCode === KEYCODE_Z && e.shiftKey
        : isWindows
          ? // Trigger redo with Ctrl+Y on Windows
            e.ctrlKey && e.keyCode === KEYCODE_Y
          : // Trigger redo with Ctrl+Shift+Z on other platforms
            e.ctrlKey && e.keyCode === KEYCODE_Z && e.shiftKey) &&
      !e.altKey
    ) {
      e.preventDefault();
      redoEdit();
    } else if (e.keyCode === KEYCODE_M && e.ctrlKey && (isMacLike ? e.shiftKey : true)) {
      e.preventDefault();

      // Toggle capturing tab key so users can focus away
      setCapture((prev) => !prev);
    }
  };
  const handleChange = (
    e: Event & {
      currentTarget: HTMLTextAreaElement;
      target: HTMLTextAreaElement;
    },
  ) => {
    const { value, selectionStart, selectionEnd } = e.currentTarget;
    recordChange(
      {
        value,
        selectionStart,
        selectionEnd,
      },
      true,
    );
    _props2().onValueChange(value);
  };
  createEffect(
    () => [recordCurrentState],
    () => {
      recordCurrentState();
    },
  );
  useImperativeHandle(
    untrack(() => _props.ref),
    () => {
      return {
        get session() {
          return {
            history: historyRef.current,
          };
        },
        set session(session: { history: History }) {
          historyRef.current = session.history;
        },
      };
    },
  );
  return (
    <div
      {..._props2().rest}
      style={reactStyle({
        ...styles.container,
        ..._props2().style,
      })}
    >
      <pre
        class={_props2().preClassName}
        aria-hidden="true"
        style={reactStyle({
          ...styles.editor,
          ...styles.highlight,
          ...contentStyle(),
        })}
        {...(typeof highlighted() === 'string'
          ? {
              dangerouslySetInnerHTML: {
                __html: highlighted() + '<br />',
              },
            }
          : {
              children: highlighted(),
            })}
      />
      <textarea
        ref={(c) => (inputRef.current = c)}
        style={reactStyle({
          ...styles.editor,
          ...styles.textarea,
          ...contentStyle(),
        })}
        class={className + (_props2().textareaClassName ? ` ${_props2().textareaClassName}` : '')}
        id={_props2().textareaId}
        value={_props2().value}
        onInput={handleChange}
        onKeyDown={handleKeyDown}
        onClick={_props2().onClick}
        onKeyUp={_props2().onKeyUp}
        onFocusIn={_props2().onFocus}
        onFocusOut={_props2().onBlur}
        disabled={_props2().disabled}
        form={_props2().form}
        maxlength={_props2().maxLength}
        minlength={_props2().minLength}
        name={_props2().name}
        placeholder={_props2().placeholder}
        readonly={_props2().readOnly}
        required={_props2().required}
        autofocus={_props2().autoFocus}
        autocapitalize="off"
        autocomplete="off"
        autocorrect="off"
        spellcheck={false}
        data-gramm={false}
      />
      {/* eslint-disable-next-line solid/no-innerhtml */}
      <style innerHTML={cssText} />
    </div>
  );
};
const styles = {
  container: {
    position: 'relative',
    textAlign: 'left',
    boxSizing: 'border-box',
    padding: 0,
    overflow: 'hidden',
  },
  textarea: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    resize: 'none',
    color: 'inherit',
    overflow: 'hidden',
    MozOsxFontSmoothing: 'grayscale',
    WebkitFontSmoothing: 'antialiased',
    WebkitTextFillColor: 'transparent',
  },
  highlight: {
    position: 'relative',
    pointerEvents: 'none',
  },
  editor: {
    margin: 0,
    border: 0,
    background: 'none',
    boxSizing: 'inherit',
    display: 'inherit',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontStyle: 'inherit',
    fontVariantLigatures: 'inherit',
    fontWeight: 'inherit',
    letterSpacing: 'inherit',
    lineHeight: 'inherit',
    tabSize: 'inherit',
    textIndent: 'inherit',
    textRendering: 'inherit',
    textTransform: 'inherit',
    whiteSpace: 'pre-wrap',
    wordBreak: 'keep-all',
    overflowWrap: 'break-word',
  },
} as const;
export default Editor;
