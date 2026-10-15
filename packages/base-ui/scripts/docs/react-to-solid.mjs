// Transforms React source (the docs in `docs/react` and the docs runtime in `docs/docs-infra`)
// into Solid source.
//
// The transform works on the syntax tree, with Babel's scope analysis, so a rewrite applies to the
// binding it targets and not to text that happens to look like it.
//
// Reactivity. A React component or hook runs again on every render; a Solid one runs once, and a
// value stays current only where it is read through a call inside a tracked scope. The transform
// lowers each component and hook of the corpus (the files it transforms) to that model:
// - Its body splits at the last statement that calls a hook. The statements up to there are the
//   setup and run once; the rest is the render part.
// - In the setup, a `const` that reads a reactive value becomes a memo (`createMemo`), and every
//   read of a reactive binding becomes a call. Reactive are props, state, memos, context values,
//   the parameters and results of corpus hooks, and the consts derived from them.
// - A render part that is more than `return <jsx />` becomes a memo the component renders, so its
//   control flow reruns as a render would.
// - Corpus hooks take accessors and return one: a call passes each argument as `() => value`, the
//   hook reads its parameters through calls, and returns its result as a memo. Corpus contexts
//   hold an accessor, which the provider passes and `useContext` returns.
// - An async (server) component resolves in an async memo and renders when it settles.
//
// Hooks: `useState` becomes a signal and `useMemo` a memo, `useCallback` and `useStableCallback`
// return their function, `useRef` becomes a `{ current }` object that callback refs assign, effects
// become Solid effects (a mount effect runs in `onSettled`), and `useId` becomes `createUniqueId`.
// Props: destructured parameters read from `props` (`merge` supplies defaults, `omit` the rest).
// JSX: `className` and `htmlFor`, style objects, `dangerouslySetInnerHTML`, `key`, context
// providers, and arrays rendered with `.map` (as `<For>`).
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';

const traverse = traverseModule.default ?? traverseModule;
const generate = generateModule.default ?? generateModule;

const REACT_DOM = 'react-dom';
// The docs runtime's counterparts of React APIs Solid has none of.
const REACT_ADAPTERS = 'docs/src/adapters/react';
// The head of a Next root layout (it writes the charset and Solid's hydration script).
const NEXT_DOCUMENT = 'docs/src/adapters/next/document';

const PARSER_OPTIONS = { sourceType: 'module', plugins: ['jsx', 'typescript'] };
// A `.ts` module has no JSX: `<T>value` is a type assertion there.
const parserOptions = (filename) =>
  /\.[cm]?ts$/.test(filename ?? '')
    ? { ...PARSER_OPTIONS, plugins: ['typescript'] }
    : PARSER_OPTIONS;
const GENERATOR_OPTIONS = { jsescOption: { minimal: true, quotes: 'single' } };

/** Whether a node is `element(() => <jsx />)` (see `deferElements`). */
const isElementCall = (node) =>
  t.isCallExpression(node) &&
  t.isIdentifier(node.callee, { name: 'element' }) &&
  node.arguments.length === 1;

/** Prints source through the transform's parser and printer (one formatting for comparisons). */
export function printCode(code, filename) {
  return generate(parse(code, parserOptions(filename)), GENERATOR_OPTIONS).code;
}

// The `JSX.*HTMLAttributes` interfaces Solid declares; React's others are the generic one.
const SOLID_HTML_ATTRIBUTES = new Set(
  'Anchor Audio Area Base Bdo Blockquote Body Button Canvas Caption Col Colgroup Data Embed Fieldset Form Iframe Img Input Mod Keygen Label Li Link Map Media Menu Meta Meter Quote Object Ol Optgroup Option Output Param Progress Script Select Source Style Td Template Textarea Th Time Title Track Video WebView'
    .split(' ')
    .map((name) => `${name}HTMLAttributes`),
);
const solidHtmlAttributes = (name) =>
  SOLID_HTML_ATTRIBUTES.has(name) || name === 'HTMLAttributes' ? name : 'HTMLAttributes';

const kebab = (name) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
const DOM_ATTRIBUTES = { className: 'class', htmlFor: 'for' };
// React's names for DOM attributes that Solid writes under the attribute's own name.
const REACT_ATTRIBUTE_NAMES = Object.fromEntries([
  ...[
    'accessKey',
    'autoCapitalize',
    'autoComplete',
    'autoCorrect',
    'autoFocus',
    'autoPlay',
    'autoSave',
    'cellPadding',
    'cellSpacing',
    'charSet',
    'classID',
    'colSpan',
    'contentEditable',
    'contextMenu',
    'controlsList',
    'crossOrigin',
    'dateTime',
    'encType',
    'enterKeyHint',
    'fetchPriority',
    'formAction',
    'formEncType',
    'formMethod',
    'formNoValidate',
    'formTarget',
    'frameBorder',
    'hrefLang',
    'inputMode',
    'itemID',
    'itemProp',
    'itemRef',
    'itemScope',
    'itemType',
    'marginHeight',
    'marginWidth',
    'maxLength',
    'mediaGroup',
    'minLength',
    'noModule',
    'noValidate',
    'playsInline',
    'popoverTarget',
    'popoverTargetAction',
    'radioGroup',
    'readOnly',
    'referrerPolicy',
    'rowSpan',
    'spellCheck',
    'srcDoc',
    'srcLang',
    'srcSet',
    'tabIndex',
    'useMap',
  ].map((name) => [name, name.toLowerCase()]),
  ['acceptCharset', 'accept-charset'],
  ['httpEquiv', 'http-equiv'],
  ...[
    'alignmentBaseline',
    'baselineShift',
    'clipPath',
    'clipRule',
    'colorInterpolation',
    'colorInterpolationFilters',
    'colorProfile',
    'colorRendering',
    'dominantBaseline',
    'enableBackground',
    'fillOpacity',
    'fillRule',
    'floodColor',
    'floodOpacity',
    'fontFamily',
    'fontSize',
    'fontSizeAdjust',
    'fontStretch',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'glyphOrientationHorizontal',
    'glyphOrientationVertical',
    'imageRendering',
    'letterSpacing',
    'lightingColor',
    'markerEnd',
    'markerMid',
    'markerStart',
    'paintOrder',
    'pointerEvents',
    'shapeRendering',
    'stopColor',
    'stopOpacity',
    'strokeDasharray',
    'strokeDashoffset',
    'strokeLinecap',
    'strokeLinejoin',
    'strokeMiterlimit',
    'strokeOpacity',
    'strokeWidth',
    'textAnchor',
    'textDecoration',
    'textRendering',
    'transformOrigin',
    'unicodeBidi',
    'vectorEffect',
    'wordSpacing',
    'writingMode',
  ].map((name) => [name, kebab(name)]),
  ['xlinkHref', 'xlink:href'],
  ['xmlnsXlink', 'xmlns:xlink'],
  ['xmlLang', 'xml:lang'],
  ['xmlSpace', 'xml:space'],
]);
// React events Solid names after the DOM event (React's focus events are `focusin`/`focusout`).
const REACT_EVENT_NAMES = {
  onDoubleClick: 'onDblClick',
  onFocus: 'onFocusIn',
  onBlur: 'onFocusOut',
};
// CSS properties that take a length: a number in React's `style` means pixels.
const UNITLESS = new Set([
  'animationIterationCount',
  'aspectRatio',
  'borderImageOutset',
  'borderImageSlice',
  'borderImageWidth',
  'boxFlex',
  'boxFlexGroup',
  'boxOrdinalGroup',
  'columnCount',
  'columns',
  'flex',
  'flexGrow',
  'flexPositive',
  'flexShrink',
  'flexNegative',
  'flexOrder',
  'gridArea',
  'gridRow',
  'gridRowEnd',
  'gridRowSpan',
  'gridRowStart',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnSpan',
  'gridColumnStart',
  'fontWeight',
  'lineClamp',
  'lineHeight',
  'opacity',
  'order',
  'orphans',
  'scale',
  'tabSize',
  'widows',
  'zIndex',
  'zoom',
  'fillOpacity',
  'floodOpacity',
  'stopOpacity',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeMiterlimit',
  'strokeOpacity',
  'strokeWidth',
]);

const REACT_TYPES = {
  ReactNode: { name: 'JSX', member: 'Element' },
  ReactPortal: { name: 'JSX', member: 'Element' },
  ElementType: { name: 'ValidComponent' },
  JSXElementConstructor: { name: 'ValidComponent' },
  ReactElement: { name: 'JSX', member: 'Element' },
  JSX: { name: 'JSX', member: 'Element' },
  CSSProperties: { name: 'JSX', member: 'CSSProperties' },
  ComponentProps: { name: 'ComponentProps' },
  ComponentPropsWithRef: { name: 'ComponentProps' },
  ComponentPropsWithoutRef: { name: 'ComponentProps' },
  HTMLAttributes: { name: 'JSX', member: 'HTMLAttributes' },
};

// Base UI utils hooks with a direct Solid counterpart: their imports go, and their calls are rewritten.
const BASE_UI_UTILS_HOOKS = new Set([
  '@base-ui/utils/useStableCallback',
  '@base-ui/utils/useIsoLayoutEffect',
]);

// React hooks (and hook-like APIs) by name.
const REACT_HOOKS = new Set([
  'use',
  'useActionState',
  'useCallback',
  'useContext',
  'useDebugValue',
  'useDeferredValue',
  'useEffect',
  'useId',
  'useImperativeHandle',
  'useInsertionEffect',
  'useIsoLayoutEffect',
  'useLayoutEffect',
  'useMemo',
  'useOptimistic',
  'useReducer',
  'useRef',
  'useStableCallback',
  'useState',
  'useSyncExternalStore',
  'useTransition',
]);
// React hooks whose result is a `[value, update]` pair.
const TUPLE_HOOKS = new Set([
  'useState',
  'useReducer',
  'useTransition',
  'useOptimistic',
  'useActionState',
]);
// The elements of a pair hook's result that are accessors (the others are functions).
const TUPLE_ACCESSORS = { useActionState: [0, 2] };
// React hooks whose result the transform reads through an accessor.
const ACCESSOR_HOOKS = new Set(['useMemo', 'useContext', 'useSyncExternalStore', 'use']);

const HOOK_NAME = /^use[A-Z0-9]/;

// What Solid Base UI's hooks return where React's return values: an accessor, or an object with
// accessor members.
const BASE_UI_HOOK_RESULTS = {
  useDirection: { accessor: true },
  useFilteredItems: { accessor: true },
  useMediaQuery: { accessor: true },
  useToastManager: { members: ['toasts'] },
};

// Render-function children Solid Base UI calls with accessors (the selected value, an index).
const ACCESSOR_CHILD_PARAMS = {
  'Autocomplete.List': [1],
  'Autocomplete.Value': [0],
  'Combobox.List': [1],
  'Combobox.Value': [0],
};

// Imports of these modules are corpus code (transformed with this file, or written for it as an
// adapter), so their hooks follow the corpus convention.
const CORPUS_MODULES = ['.', 'docs/', '@mui/internal-docs-infra', 'next', '@base-ui/utils/'];

class Imports {
  constructor() {
    this.values = new Map(); // source -> Map(imported -> local)
    this.types = new Map();
  }

  add(source, name, type = false, local = name) {
    const map = type ? this.types : this.values;
    if (!map.has(source)) {
      map.set(source, new Map());
    }
    map.get(source).set(name, local);
  }

  /** The import declarations, of the names in `used` (a mapping can drop a type it imported). */
  declarations(used) {
    const declaration = (source, names, type) => {
      const node = t.importDeclaration(
        [...names]
          .filter(([, local]) => used.has(local))
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([imported, local]) =>
            t.importSpecifier(t.identifier(local), t.identifier(imported)),
          ),
        t.stringLiteral(source),
      );
      if (type) {
        node.importKind = 'type';
      }
      return node;
    };
    return [
      ...[...this.values].map(([source, names]) => declaration(source, names, false)),
      ...[...this.types].map(([source, names]) => declaration(source, names, true)),
    ].filter((node) => node.specifiers.length > 0);
  }
}

/** The names a program's code refers to (not property names or attribute names). */
function usedNames(programPath) {
  const used = new Set();
  programPath.traverse({
    'Identifier|JSXIdentifier'(path) {
      const { node, parent } = path;
      const property =
        (t.isMemberExpression(parent) ||
          t.isOptionalMemberExpression(parent) ||
          t.isJSXMemberExpression(parent)) &&
        parent.property === node &&
        !parent.computed;
      const key =
        (t.isObjectProperty(parent) ||
          t.isObjectMethod(parent) ||
          t.isClassProperty(parent) ||
          t.isClassMethod(parent) ||
          t.isTSPropertySignature(parent) ||
          t.isTSMethodSignature(parent)) &&
        parent.key === node &&
        !parent.computed;
      if (
        !property &&
        !key &&
        !(t.isTSQualifiedName(parent) && parent.right === node) &&
        !t.isJSXAttribute(parent)
      ) {
        used.add(node.name);
      }
    },
  });
  return used;
}

/** The React hook or API a call expression names (`React.useState`, `useState`), or null. */
function reactApi(callee, reactNames) {
  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object) &&
    t.isIdentifier(callee.property)
  ) {
    return reactNames.namespaces.has(callee.object.name) ? callee.property.name : null;
  }
  if (t.isIdentifier(callee)) {
    return reactNames.named.get(callee.name) ?? null;
  }
  return null;
}

function calleeName(callee) {
  if (t.isIdentifier(callee)) {
    return callee.name;
  }
  if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.property)) {
    return callee.property.name;
  }
  return null;
}

/** Whether a node calls a hook: a React hook or a function named like one. */
function isHookCall(node, ctx) {
  if (!t.isCallExpression(node)) {
    return false;
  }
  const api = reactApi(node.callee, ctx.reactNames);
  if (api) {
    return REACT_HOOKS.has(api);
  }
  const name = calleeName(node.callee);
  return name != null && HOOK_NAME.test(name);
}

/** Whether a hook call goes to corpus code, which takes accessors and returns one. */
function isCorpusHook(callPath, ctx) {
  const callee = callPath.node.callee;
  const root = t.isMemberExpression(callee) ? callee.object : callee;
  if (!t.isIdentifier(root)) {
    return false;
  }
  const binding = callPath.scope.getBinding(root.name);
  if (!binding) {
    return false;
  }
  if (binding.kind === 'module') {
    return ctx.corpusImports.has(root.name);
  }
  return t.isIdentifier(callee);
}

const isJsxNode = (node) => t.isJSXElement(node) || t.isJSXFragment(node);
const isFunctionNode = (node) =>
  t.isArrowFunctionExpression(node) || t.isFunctionExpression(node) || t.isClassExpression(node);

/** Whether a function returns JSX somewhere in its own body (a component). */
function returnsJsx(path) {
  let found = false;
  path.traverse({
    Function(inner) {
      inner.skip();
    },
    ReturnStatement(ret) {
      const arg = ret.node.argument;
      if (isJsxNode(arg) || t.isConditionalExpression(arg) || t.isLogicalExpression(arg)) {
        found = true;
      }
    },
    JSXElement(inner) {
      found = true;
      inner.stop();
    },
  });
  if (t.isArrowFunctionExpression(path.node) && !t.isBlockStatement(path.node.body)) {
    found ||= isJsxNode(path.node.body);
  }
  return found;
}

const isComponentName = (name) => typeof name === 'string' && /^[A-Z]/.test(name);

function functionName(path) {
  if (path.node.id) {
    return path.node.id.name;
  }
  if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
    return path.parent.id.name;
  }
  return null;
}

/** Whether a reference sits in a type (a name there is a type parameter, not the binding). */
function inTypePosition(path) {
  return Boolean(path.findParent((parent) => parent.isTSType() || parent.isTSTypeAnnotation()));
}

const accessorType = (type, imports) => {
  imports.add('solid-js', 'Accessor', true);
  return t.tsTypeReference(t.identifier('Accessor'), t.tsTypeParameterInstantiation([type]));
};

const createMemoCall = (body, imports, typeAnnotation) => {
  imports.add('solid-js', 'createMemo');
  const call = t.callExpression(t.identifier('createMemo'), [t.arrowFunctionExpression([], body)]);
  if (typeAnnotation) {
    call.typeParameters = t.tsTypeParameterInstantiation([typeAnnotation]);
  }
  return call;
};

const constDeclaration = (id, init) =>
  t.variableDeclaration('const', [t.variableDeclarator(id, init)]);

/** The names a destructuring pattern declares. */
function patternNames(pattern) {
  return Object.keys(t.getBindingIdentifiers(pattern));
}

/** `props.key`, or `props['data-key']` for a key that is not an identifier. */
const propMember = (objectName, key) =>
  /^[A-Za-z_$][\w$]*$/.test(key)
    ? t.memberExpression(t.identifier(objectName), t.identifier(key))
    : t.memberExpression(t.identifier(objectName), t.stringLiteral(key), true);

/** Rewrites a component's destructured props parameter to `props` reads. */
function rewriteDestructuredProps(path, imports) {
  const [param] = path.node.params;
  if (!param || !t.isObjectPattern(param)) {
    return;
  }
  const typeAnnotation = param.typeAnnotation;
  const defaults = [];
  const local = [];
  let restName = null;
  for (const property of param.properties) {
    if (t.isRestElement(property)) {
      restName = property.argument.name;
      continue;
    }
    const key = property.key.name ?? property.key.value;
    let value = property.value;
    if (t.isAssignmentPattern(value)) {
      defaults.push(t.objectProperty(t.identifier(DOM_ATTRIBUTES[key] ?? key), value.right));
      value = value.left;
    }
    local.push({ key, name: value.name });
  }

  const hasDefaults = defaults.length > 0;
  const propsName = 'props';
  const paramId = t.identifier(hasDefaults ? '_props' : propsName);
  paramId.typeAnnotation = typeAnnotation;
  // Scope references of each destructured name before the parameter changes.
  const references = local.map(({ key, name }) => ({
    key,
    paths: path.scope.getBinding(name)?.referencePaths ?? [],
  }));
  const restReferences = restName ? (path.scope.getBinding(restName)?.referencePaths ?? []) : [];

  path.node.params[0] = paramId;
  const body = path.get('body');
  if (!t.isBlockStatement(body.node)) {
    body.replaceWith(t.blockStatement([t.returnStatement(body.node)]));
  }
  const statements = [];
  if (hasDefaults) {
    imports.add('solid-js', 'merge');
    const statement = constDeclaration(
      t.identifier(propsName),
      t.callExpression(t.identifier('merge'), [
        t.objectExpression(defaults),
        t.identifier('_props'),
      ]),
    );
    statement.solidProps = true;
    statements.push(statement);
  }
  if (restName) {
    imports.add('solid-js', 'omit');
    const statement = constDeclaration(
      t.identifier('rest'),
      t.callExpression(t.identifier('omit'), [
        t.identifier(propsName),
        ...local.map(({ key }) => t.stringLiteral(DOM_ATTRIBUTES[key] ?? key)),
      ]),
    );
    statement.solidProps = true;
    statements.push(statement);
  }
  path.get('body').unshiftContainer('body', statements);

  for (const { key, paths } of references) {
    const propKey = DOM_ATTRIBUTES[key] ?? key;
    for (const reference of paths.filter((ref) => !inTypePosition(ref))) {
      if (t.isJSXIdentifier(reference.node)) {
        // A prop used as a tag renders through `<Dynamic component={props.tag}>`.
        const element = reference.parentPath;
        if (element.isJSXOpeningElement()) {
          imports.add('@solidjs/web', 'Dynamic');
          element.node.attributes.unshift(
            t.jsxAttribute(
              t.jsxIdentifier('component'),
              t.jsxExpressionContainer(propMember(propsName, propKey)),
            ),
          );
        }
        reference.replaceWith(t.jsxIdentifier('Dynamic'));
        continue;
      }
      if (reference.parentPath.isObjectProperty({ shorthand: true, value: reference.node })) {
        reference.parent.shorthand = false;
      }
      reference.replaceWith(propMember(propsName, propKey));
    }
  }
  for (const reference of restReferences) {
    reference.replaceWith(t.identifier('rest'));
  }
}

/** Calls `visit` on each node of a function body, without entering nested functions. */
function walkOwn(node, visit) {
  for (const key of t.VISITOR_KEYS[node.type] ?? []) {
    const child = node[key];
    for (const item of Array.isArray(child) ? child : [child]) {
      if (!item || typeof item.type !== 'string') {
        continue;
      }
      visit(item, node);
      if (!t.isFunction(item)) {
        walkOwn(item, visit);
      }
    }
  }
}

/**
 * In code users copy (demos), a React hook without a Solid counterpart is written out where it is
 * used: `useTransition` keeps a pending flag until its callback settles, as React 19 does with an
 * async callback; `useActionState` keeps the action's latest result and its pending flag.
 */
function inlineStandaloneHook(declarator, api, fnPath, ctx) {
  const { imports } = ctx;
  const id = declarator.id;
  if (!t.isArrayPattern(id)) {
    return null;
  }
  const named = (index, fallback) =>
    t.isIdentifier(id.elements[index])
      ? t.identifier(id.elements[index].name)
      : fnPath.scope.generateUidIdentifier(fallback);
  const pendingSignal = (pending) => {
    const setPending = fnPath.scope.generateUidIdentifier(
      `set${pending.name[0].toUpperCase()}${pending.name.slice(1)}`,
    );
    imports.add('solid-js', 'createSignal');
    return {
      setPending,
      declaration: t.variableDeclaration('const', [
        t.variableDeclarator(
          t.arrayPattern([pending, setPending]),
          t.callExpression(t.identifier('createSignal'), [t.booleanLiteral(false)]),
        ),
      ]),
    };
  };
  const settle = (setPending, promise) =>
    t.callExpression(
      t.memberExpression(
        t.callExpression(t.memberExpression(t.identifier('Promise'), t.identifier('resolve')), [
          promise,
        ]),
        t.identifier('finally'),
      ),
      [
        t.arrowFunctionExpression(
          [],
          t.callExpression(t.identifier(setPending.name), [t.booleanLiteral(false)]),
        ),
      ],
    );
  if (api === 'useTransition') {
    const pending = named(0, 'isPending');
    const start = named(1, 'startTransition');
    const { setPending, declaration } = pendingSignal(pending);
    const callback = t.identifier('callback');
    callback.typeAnnotation = t.tsTypeAnnotation(
      t.tsFunctionType(null, [], t.tsTypeAnnotation(t.tsUnknownKeyword())),
    );
    return [
      declaration,
      constDeclaration(
        start,
        t.arrowFunctionExpression(
          [callback],
          t.blockStatement([
            t.expressionStatement(
              t.callExpression(t.identifier(setPending.name), [t.booleanLiteral(true)]),
            ),
            t.expressionStatement(
              settle(setPending, t.callExpression(t.identifier('callback'), [])),
            ),
          ]),
        ),
      ),
    ];
  }
  if (api === 'useActionState') {
    const [action, initialState] = declarator.init.arguments;
    const state = named(0, 'state');
    const dispatch = named(1, 'formAction');
    const pending = named(2, 'isPending');
    const setState = fnPath.scope.generateUidIdentifier('setState');
    const { setPending, declaration } = pendingSignal(pending);
    imports.add('solid-js', 'createSignal');
    // `useActionState<State, Payload>` types the state and the payload.
    const [stateType, payloadType] = declarator.init.typeParameters?.params ?? [];
    const payload = t.identifier('payload');
    payload.typeAnnotation = t.tsTypeAnnotation(
      payloadType ?? t.tsTypeReference(t.identifier('FormData')),
    );
    const stateSignal = t.callExpression(t.identifier('createSignal'), [initialState]);
    if (stateType) {
      stateSignal.typeParameters = t.tsTypeParameterInstantiation([stateType]);
    }
    return [
      t.variableDeclaration('const', [
        t.variableDeclarator(t.arrayPattern([state, setState]), stateSignal),
      ]),
      declaration,
      constDeclaration(
        dispatch,
        t.arrowFunctionExpression(
          [payload],
          t.blockStatement([
            t.expressionStatement(
              t.callExpression(t.identifier(setPending.name), [t.booleanLiteral(true)]),
            ),
            t.expressionStatement(
              settle(
                setPending,
                t.callExpression(
                  t.memberExpression(
                    t.callExpression(
                      t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
                      [
                        t.callExpression(action, [
                          t.callExpression(t.identifier(state.name), []),
                          t.identifier('payload'),
                        ]),
                      ],
                    ),
                    t.identifier('then'),
                  ),
                  [
                    t.arrowFunctionExpression(
                      [t.identifier('next')],
                      t.callExpression(t.identifier(setState.name), [
                        t.arrowFunctionExpression([], t.identifier('next')),
                      ]),
                    ),
                  ],
                ),
              ),
            ),
          ]),
        ),
      ),
    ];
  }
  return null;
}

/** Rewrites a React hook call (in a declaration or a statement) to Solid; returns the replacement. */
function lowerReactHook(node, api, ctx) {
  const { imports } = ctx;
  const args = node.arguments;
  switch (api) {
    case 'useState': {
      imports.add('solid-js', 'createSignal');
      const [init] = args;
      // React runs a lazy initializer once and calls an initial value that is a function; Solid's
      // `createSignal` runs a function it is passed (tracking its reads). A lazy initializer runs
      // untracked; a value that may be a function goes through the docs runtime's
      // `initialState` (React's rule, typed as React types it). A demo reads it once at setup,
      // where Solid's rule is React's.
      const untracked = (fn) => {
        imports.add('solid-js', 'untrack');
        return t.arrowFunctionExpression([], t.callExpression(t.identifier('untrack'), [fn]));
      };
      let value = init;
      if (init && (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init))) {
        const body = t.isBlockStatement(init.body) ? null : init.body;
        value = body && isNonFunctionLiteral(body) ? body : untracked(init);
      } else if (init && !isNonFunctionLiteral(init) && !ctx.standalone) {
        imports.add(REACT_ADAPTERS, 'initialState');
        value = untracked(
          t.arrowFunctionExpression([], t.callExpression(t.identifier('initialState'), [init])),
        );
      }
      const call = t.callExpression(t.identifier('createSignal'), value ? [value] : []);
      call.typeParameters = node.typeParameters;
      return call;
    }
    case 'useReducer':
    case 'useTransition':
    case 'useActionState':
    case 'useOptimistic':
    case 'use': {
      imports.add(REACT_ADAPTERS, api);
      return t.callExpression(t.identifier(api), args);
    }
    case 'useMemo': {
      imports.add('solid-js', 'createMemo');
      const call = t.callExpression(t.identifier('createMemo'), [args[0]]);
      call.typeParameters = node.typeParameters;
      return call;
    }
    case 'useCallback':
    case 'useStableCallback':
      return args[0];
    case 'useRef': {
      const typeParam = node.typeParameters?.params[0];
      let init = args[0] ?? t.identifier('undefined');
      if (typeParam && t.isNullLiteral(init)) {
        const includesNull =
          t.isTSNullKeyword(typeParam) ||
          (t.isTSUnionType(typeParam) && typeParam.types.some((type) => t.isTSNullKeyword(type)));
        init = t.tsAsExpression(
          t.nullLiteral(),
          includesNull ? typeParam : t.tsUnionType([typeParam, t.tsNullKeyword()]),
        );
      }
      return t.objectExpression([t.objectProperty(t.identifier('current'), init)]);
    }
    case 'useContext': {
      imports.add('solid-js', 'useContext');
      return t.callExpression(t.identifier('useContext'), args);
    }
    case 'useId': {
      imports.add('solid-js', 'createUniqueId');
      return t.callExpression(t.identifier('createUniqueId'), []);
    }
    case 'useSyncExternalStore': {
      imports.add(REACT_ADAPTERS, 'useSyncExternalStore');
      return t.callExpression(t.identifier('useSyncExternalStore'), args);
    }
    case 'useDeferredValue':
      return args[0];
    case 'useEffect':
    case 'useLayoutEffect':
    case 'useInsertionEffect':
    case 'useIsoLayoutEffect': {
      // A Solid effect runs the cleanup its function returns, as React does.
      const [fn, deps] = args;
      if (t.isArrayExpression(deps) && deps.elements.length === 0) {
        imports.add('solid-js', 'onSettled');
        return t.callExpression(t.identifier('onSettled'), [fn]);
      }
      if (!deps) {
        // Without dependencies the effect reruns on every change to what it reads.
        imports.add('solid-js', 'createTrackedEffect');
        return t.callExpression(t.identifier('createTrackedEffect'), [fn]);
      }
      if (api !== 'useEffect' && !ctx.standalone) {
        // React never runs a layout effect on the server; Solid's server runs a render effect.
        imports.add(REACT_ADAPTERS, 'createLayoutEffect');
        return t.callExpression(t.identifier('createLayoutEffect'), [
          t.arrowFunctionExpression([], deps),
          fn,
        ]);
      }
      imports.add('solid-js', 'createEffect');
      return t.callExpression(t.identifier('createEffect'), [
        t.arrowFunctionExpression([], deps),
        fn,
      ]);
    }
    case 'useImperativeHandle': {
      // Assigns the handle once: its methods read current values when called.
      imports.add(REACT_ADAPTERS, 'useImperativeHandle');
      return t.callExpression(t.identifier('useImperativeHandle'), args.slice(0, 2));
    }
    case 'useDebugValue':
      return null;
    default:
      throw new Error(`react-to-solid: no Solid counterpart for React.${api}`);
  }
}

// Without JSX (a `.ts` module), a component returns its render memo, which Solid inserts as it
// inserts a function child.
const renderedMemo = (id, imports) => {
  imports.add('@solidjs/web', 'JSX', true);
  return t.tsAsExpression(
    t.tsAsExpression(t.identifier(id.name), t.tsUnknownKeyword()),
    t.tsTypeReference(t.tsQualifiedName(t.identifier('JSX'), t.identifier('Element'))),
  );
};

const fragmentOf = (expression) =>
  t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
    t.jsxExpressionContainer(expression),
  ]);

/**
 * Lowers a component or a corpus hook to Solid's reactivity (see the header): splits setup from
 * render, turns derived consts into memos, and reads reactive bindings through calls.
 */
function lowerFunction(fnPath, kind, ctx) {
  const { imports } = ctx;
  const expressionBody = !t.isBlockStatement(fnPath.node.body);
  if (expressionBody) {
    fnPath.get('body').replaceWith(t.blockStatement([t.returnStatement(fnPath.node.body)]));
  }
  const uid = (name) => fnPath.scope.generateUidIdentifier(name);
  const isAsync = fnPath.node.async;
  // Whether a hook call's result is an accessor (a React hook read through one, or a corpus hook).
  const returnsAccessor = (node) => {
    if (!isHookCall(node, ctx)) {
      return false;
    }
    const api = reactApi(node.callee, ctx.reactNames);
    if (api) {
      return ACCESSOR_HOOKS.has(api);
    }
    const callPath = findPath(fnPath, node);
    return Boolean(callPath && isCorpusHook(callPath, ctx));
  };

  // Parameters. A component's props stay an object of getters; a hook's become accessors.
  const prelude = [];
  const accessorParams = new Map(); // name -> optional
  if (kind === 'hook') {
    // An optional parameter takes `undefined` too, as the value its caller's accessor returns.
    const valueType = (type, optional) =>
      optional && !t.isTSUndefinedKeyword(type)
        ? t.tsUnionType([type, t.tsUndefinedKeyword()])
        : type;
    fnPath.node.params = fnPath.node.params.map((param, index) => {
      if (t.isIdentifier(param)) {
        accessorParams.set(param.name, Boolean(param.optional));
        if (param.typeAnnotation) {
          param.typeAnnotation = t.tsTypeAnnotation(
            accessorType(valueType(param.typeAnnotation.typeAnnotation, param.optional), imports),
          );
        }
        return param;
      }
      if (t.isRestElement(param)) {
        return param;
      }
      const pattern = t.isAssignmentPattern(param) ? param.left : param;
      const fallback = t.isAssignmentPattern(param) ? param.right : null;
      const id = t.isIdentifier(pattern) ? uid(pattern.name) : uid(index === 0 ? 'params' : 'arg');
      // An unannotated parameter takes its type from its default, as TypeScript infers it.
      const annotation =
        pattern.typeAnnotation?.typeAnnotation ?? (fallback && defaultType(fallback));
      id.optional = Boolean(fallback) || Boolean(pattern.optional);
      if (annotation) {
        id.typeAnnotation = t.tsTypeAnnotation(
          accessorType(valueType(annotation, id.optional), imports),
        );
        pattern.typeAnnotation = null;
      }
      accessorParams.set(id.name, id.optional);
      // The reads of the accessor become calls with the others.
      const read = () => t.identifier(id.name);
      const value = fallback
        ? t.conditionalExpression(
            t.binaryExpression('===', read(), t.identifier('undefined')),
            fallback,
            read(),
          )
        : read();
      prelude.push(
        constDeclaration(t.isIdentifier(pattern) ? t.identifier(pattern.name) : pattern, value),
      );
      return id;
    });
  }
  fnPath.node.body.body.unshift(...prelude);

  // Normalize: one declarator per declaration, and every hook call either a statement or the
  // whole initializer of a `const` with a plain name.
  const statements = [];
  for (const statement of fnPath.node.body.body) {
    if (t.isVariableDeclaration(statement) && statement.declarations.length > 1) {
      for (const declarator of statement.declarations) {
        statements.push(t.variableDeclaration(statement.kind, [declarator]));
      }
    } else {
      statements.push(statement);
    }
  }
  fnPath.node.body.body = statements;
  fnPath.scope.crawl();

  const hoisted = new Map(); // statement node -> declarations to insert before it
  for (const statementPath of fnPath.get('body.body')) {
    const direct = new Set();
    if (statementPath.isExpressionStatement()) {
      direct.add(statementPath.node.expression);
    }
    if (statementPath.isVariableDeclaration()) {
      const [declarator] = statementPath.node.declarations;
      const api = t.isCallExpression(declarator.init)
        ? reactApi(declarator.init.callee, ctx.reactNames)
        : null;
      if (t.isIdentifier(declarator.id) || (api && TUPLE_HOOKS.has(api))) {
        direct.add(declarator.init);
      }
    }
    if (
      kind === 'hook' &&
      statementPath.isReturnStatement() &&
      returnsAccessor(statementPath.node.argument)
    ) {
      // A hook returning another hook's accessor returns it as it is.
      direct.add(statementPath.node.argument);
    }
    const calls = [];
    statementPath.traverse({
      Function(inner) {
        inner.skip();
      },
      CallExpression: {
        exit(callPath) {
          if (isHookCall(callPath.node, ctx) && !direct.has(callPath.node)) {
            calls.push(callPath);
          }
        },
      },
    });
    for (const callPath of calls) {
      const id = uid(calleeName(callPath.node.callee) ?? 'hook');
      const declarations = hoisted.get(statementPath.node) ?? [];
      declarations.push(constDeclaration(id, callPath.node));
      hoisted.set(statementPath.node, declarations);
      callPath.replaceWith(t.identifier(id.name));
    }
  }
  if (hoisted.size > 0) {
    fnPath.node.body.body = fnPath.node.body.body.flatMap((statement) => [
      ...(hoisted.get(statement) ?? []),
      statement,
    ]);
    fnPath.scope.crawl();
  }

  // The render part starts after the last statement that calls a hook.
  const statementPaths = fnPath.get('body.body');
  let split = 0;
  statementPaths.forEach((statementPath, index) => {
    let found = false;
    statementPath.traverse({
      Function(inner) {
        inner.skip();
      },
      CallExpression(callPath) {
        if (isHookCall(callPath.node, ctx)) {
          found = true;
          callPath.stop();
        }
      },
    });
    if (found) {
      split = index + 1;
    }
  });
  if (isAsync && kind === 'component') {
    // A server component awaits anywhere in its body, and calls no hooks: all of it resolves in
    // the async memo, after the props.
    split = statementPaths.findIndex((statementPath) => !statementPath.node.solidProps);
    if (split === -1) {
      split = statementPaths.length;
    }
  }
  // A hook's or a component's `return` is never setup.
  while (split > 0 && statementPaths[split - 1].isReturnStatement()) {
    split -= 1;
  }
  // Declarations that follow (before any control flow) are setup too: derived values become memos
  // instead of rerunning the render.
  while (
    !isAsync &&
    split < statementPaths.length &&
    (statementPaths[split].isFunctionDeclaration() ||
      (statementPaths[split].isVariableDeclaration({ kind: 'const' }) &&
        statementPaths[split].node.declarations.every((declarator) => declarator.init)))
  ) {
    split += 1;
  }

  // Analysis: which bindings are reactive, and how each read of one is rewritten.
  const reactive = new Map(); // declaring identifier node -> { kind, name, binding, optional, alias }
  const declare = (binding, entry) => reactive.set(binding.identifier, { ...entry, binding });
  const bindingOf = (path, name) => path.scope.getBinding(name);
  // A call of a function the component declares reads what the function's body reads.
  const visiting = new Set();
  const callReadsReactive = (binding) => {
    if (binding.scope !== fnPath.scope || visiting.has(binding)) {
      return false;
    }
    let body = null;
    if (binding.path.isFunctionDeclaration()) {
      body = binding.path.get('body');
    } else if (binding.path.isVariableDeclarator() && isFunctionNode(binding.path.node.init)) {
      body = binding.path.get('init.body');
    }
    if (!body) {
      return false;
    }
    visiting.add(binding);
    const result = readsReactive(body);
    visiting.delete(binding);
    return result;
  };
  const readsReactive = (path) => {
    let found = false;
    const visit = (refPath) => {
      const binding = bindingOf(refPath, refPath.node.name);
      if (
        binding &&
        (reactive.has(binding.identifier) ||
          (refPath.parentPath.isCallExpression() &&
            refPath.parent.callee === refPath.node &&
            callReadsReactive(binding)))
      ) {
        found = true;
        refPath.stop();
      }
    };
    if (path.isIdentifier()) {
      visit(path);
      return found;
    }
    path.traverse({
      Function(inner) {
        // A callback a call receives runs while the value is computed; a function stored in the
        // value reads when it is called.
        const parent = inner.parentPath;
        // An element (`element(() => <jsx />)`) renders when it is placed.
        if (isElementCall(parent.node)) {
          inner.skip();
          return;
        }
        if (!(
          parent.isCallExpression() ||
          parent.isOptionalCallExpression() ||
          parent.isNewExpression()
        )) {
          inner.skip();
        }
      },
      ReferencedIdentifier(refPath) {
        if (!inTypePosition(refPath)) {
          visit(refPath);
        }
      },
    });
    return found;
  };

  for (const [name, optional] of accessorParams) {
    const binding = fnPath.scope.getBinding(name);
    if (binding) {
      declare(binding, { kind: 'accessor', name, optional });
    }
  }
  if (kind === 'component') {
    const [param] = fnPath.node.params;
    if (t.isIdentifier(param)) {
      const binding = fnPath.scope.getBinding(param.name);
      if (binding) {
        declare(binding, { kind: 'source', name: param.name });
      }
    }
  }

  const plan = new Map(); // statement node -> how it is rewritten
  const accessorMembers = new Map(); // declaring identifier node -> accessor member names
  for (const statementPath of statementPaths.slice(0, split)) {
    const statement = statementPath.node;
    if (!t.isVariableDeclaration(statement)) {
      continue;
    }
    const declaratorPath = statementPath.get('declarations.0');
    const { id, init } = declaratorPath.node;
    if (!init) {
      continue;
    }
    if (statement.solidProps) {
      declare(bindingOf(declaratorPath, id.name), { kind: 'source', name: id.name });
      continue;
    }
    if (t.isCallExpression(init) && isHookCall(init, ctx)) {
      const api = reactApi(init.callee, ctx.reactNames);
      if (api && TUPLE_HOOKS.has(api)) {
        for (const index of TUPLE_ACCESSORS[api] ?? [0]) {
          const element = t.isArrayPattern(id) ? id.elements[index] : null;
          if (t.isIdentifier(element)) {
            declare(bindingOf(declaratorPath, element.name), {
              kind: 'accessor',
              name: element.name,
            });
          }
        }
        continue;
      }
      const baseUiResult = api ? null : BASE_UI_HOOK_RESULTS[calleeName(init.callee)];
      const returnsAccessor = api
        ? ACCESSOR_HOOKS.has(api)
        : isCorpusHook(declaratorPath.get('init'), ctx) || Boolean(baseUiResult?.accessor);
      if (returnsAccessor && t.isIdentifier(id)) {
        declare(bindingOf(declaratorPath, id.name), { kind: 'accessor', name: id.name });
      }
      if (baseUiResult?.members && t.isIdentifier(id)) {
        accessorMembers.set(bindingOf(declaratorPath, id.name).identifier, baseUiResult.members);
      }
      if (
        api === 'useDeferredValue' &&
        t.isIdentifier(id) &&
        readsReactive(declaratorPath.get('init.arguments.0'))
      ) {
        plan.set(statement, { type: 'memo' });
        declare(bindingOf(declaratorPath, id.name), { kind: 'accessor', name: id.name });
      }
      continue;
    }
    // `const { toasts } = toastManager`: the accessor members of a Base UI hook's result.
    const membersOf = t.isIdentifier(init)
      ? accessorMembers.get(bindingOf(declaratorPath, init.name)?.identifier)
      : null;
    if (membersOf && t.isObjectPattern(id)) {
      for (const property of id.properties) {
        if (
          t.isObjectProperty(property) &&
          t.isIdentifier(property.key) &&
          membersOf.includes(property.key.name) &&
          t.isIdentifier(property.value)
        ) {
          declare(bindingOf(declaratorPath, property.value.name), {
            kind: 'accessor',
            name: property.value.name,
          });
        }
      }
      continue;
    }
    // `omit(props, ...)` and `merge(...)` are views of the props, read as the props are.
    const propsView =
      t.isCallExpression(init) &&
      t.isIdentifier(init.callee) &&
      (init.callee.name === 'omit' || init.callee.name === 'merge') &&
      !fnPath.scope.getBinding(init.callee.name);
    if (
      statement.kind !== 'const' ||
      isFunctionNode(init) ||
      isJsxNode(init) ||
      isElementCall(init) ||
      propsView
    ) {
      continue;
    }
    if (!readsReactive(declaratorPath.get('init'))) {
      continue;
    }
    if (t.isIdentifier(id)) {
      plan.set(statement, { type: 'memo' });
      declare(bindingOf(declaratorPath, id.name), { kind: 'accessor', name: id.name });
      continue;
    }
    const initBinding = t.isIdentifier(init) ? bindingOf(declaratorPath, init.name) : null;
    const fromProps =
      t.isObjectPattern(id) &&
      initBinding &&
      reactive.get(initBinding.identifier)?.kind === 'source' &&
      id.properties.every(
        (property) =>
          t.isRestElement(property) ||
          (t.isIdentifier(property.key) && !property.computed && t.isIdentifier(property.value)),
      );
    if (fromProps) {
      // `const { a, ...rest } = props` reads `props.a`; the rest is the props without `a`.
      const keys = [];
      for (const property of id.properties) {
        if (t.isRestElement(property)) {
          continue;
        }
        const key = property.key.name;
        keys.push(key);
        declare(bindingOf(declaratorPath, property.value.name), {
          kind: 'alias',
          name: property.value.name,
          alias: () => propMember(init.name, DOM_ATTRIBUTES[key] ?? key),
        });
      }
      const rest = id.properties.find((property) => t.isRestElement(property));
      if (rest) {
        declare(bindingOf(declaratorPath, rest.argument.name), {
          kind: 'source',
          name: rest.argument.name,
        });
      }
      plan.set(statement, { type: 'props', keys, rest: rest?.argument.name, source: init.name });
      continue;
    }
    // `const { a, b } = value` becomes one memo of the destructured names.
    const memoId = uid(t.isIdentifier(init) ? init.name : 'value');
    const names = patternNames(id);
    for (const name of names) {
      declare(bindingOf(declaratorPath, name), {
        kind: 'alias',
        name,
        alias: () =>
          t.memberExpression(t.callExpression(t.identifier(memoId.name), []), t.identifier(name)),
      });
    }
    plan.set(statement, { type: 'destructure', memoId, names });
  }

  // References to rewrite, collected while the scope still describes the original code.
  const rewrites = new Map(); // reference node -> entry
  for (const [identifierNode, members] of accessorMembers) {
    const binding = fnPath.scope.getBinding(identifierNode.name);
    for (const reference of binding?.referencePaths ?? []) {
      const member = reference.parentPath;
      if (
        member?.isMemberExpression({ object: reference.node }) &&
        t.isIdentifier(member.node.property) &&
        members.includes(member.node.property.name)
      ) {
        rewrites.set(member.node, { kind: 'member-read' });
      }
    }
  }
  for (const entry of reactive.values()) {
    if (entry.kind === 'source') {
      // `props.x` reads (the source itself stays an object of getters).
      for (const reference of entry.binding.referencePaths) {
        const member = reference.parentPath;
        if (
          member?.isMemberExpression({ object: reference.node }) &&
          !(member.parentPath.isCallExpression() && member.parent.callee === member.node) &&
          !(member.parentPath.isAssignmentExpression() && member.parent.left === member.node)
        ) {
          rewrites.set(member.node, { kind: 'source-read' });
        }
      }
      continue;
    }
    for (const reference of entry.binding.referencePaths) {
      if (!inTypePosition(reference)) {
        rewrites.set(reference.node, entry);
      }
    }
  }

  // Apply: hook calls, memos, destructuring.
  const setup = [];
  for (const statement of fnPath.node.body.body.slice(0, split)) {
    if (t.isExpressionStatement(statement) && isHookCall(statement.expression, ctx)) {
      const api = reactApi(statement.expression.callee, ctx.reactNames);
      if (api === 'useImperativeHandle' && ctx.standalone) {
        // Code users copy hands the ref its handle itself.
        const [ref, create] = statement.expression.arguments;
        const handle = fnPath.scope.generateUidIdentifier('handle');
        setup.push(
          constDeclaration(handle, t.callExpression(create, [])),
          t.ifStatement(
            t.binaryExpression(
              '===',
              t.unaryExpression('typeof', ref),
              t.stringLiteral('function'),
            ),
            t.expressionStatement(t.callExpression(ref, [t.identifier(handle.name)])),
            t.ifStatement(
              ref,
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  t.memberExpression(ref, t.identifier('current')),
                  t.identifier(handle.name),
                ),
              ),
            ),
          ),
        );
        continue;
      }
      if (api) {
        const lowered = lowerReactHook(statement.expression, api, ctx);
        if (lowered) {
          setup.push(t.expressionStatement(lowered));
        }
        continue;
      }
      wrapHookArguments(statement.expression, fnPath, ctx, rewrites);
      setup.push(statement);
      continue;
    }
    if (!t.isVariableDeclaration(statement)) {
      setup.push(statement);
      continue;
    }
    const [declarator] = statement.declarations;
    const step = plan.get(statement);
    if (
      t.isCallExpression(declarator.init) &&
      isHookCall(declarator.init, ctx) &&
      step?.type !== 'memo'
    ) {
      const api = reactApi(declarator.init.callee, ctx.reactNames);
      if (api) {
        if (api === 'useRef' && t.isIdentifier(declarator.id)) {
          ctx.refs.add(declarator.id.name);
        }
        const inline = ctx.standalone ? inlineStandaloneHook(declarator, api, fnPath, ctx) : null;
        if (inline) {
          setup.push(...inline);
          continue;
        }
        const annotation = declarator.id.typeAnnotation?.typeAnnotation;
        // `const ref = useRef<T>(init)` is a `{ current: T }` that `init` initializes.
        const refType = declarator.init.typeParameters?.params[0];
        if (api === 'useRef' && refType && t.isIdentifier(declarator.id) && !annotation) {
          const [init] = declarator.init.arguments;
          // `useRef<T>()` holds `T | undefined`, `useRef<T>(null)` holds `T | null`.
          let missing = null;
          if (!init || t.isIdentifier(init, { name: 'undefined' })) {
            missing = t.tsUndefinedKeyword();
          } else if (t.isNullLiteral(init)) {
            missing = t.tsNullKeyword();
          }
          const includes = (type) =>
            t.isTSUnionType(refType)
              ? refType.types.some((member) => member.type === type.type)
              : refType.type === type.type;
          const currentType =
            missing && !includes(missing) ? t.tsUnionType([refType, missing]) : refType;
          declarator.id.typeAnnotation = t.tsTypeAnnotation(
            t.tsTypeLiteral([
              t.tsPropertySignature(t.identifier('current'), t.tsTypeAnnotation(currentType)),
            ]),
          );
          declarator.init.typeParameters = null;
        }
        // `useState<P>()` of a type parameter: Solid's setter cannot tell a `P` value from an
        // updater, so the setter is passed the value through one, which stores it.
        if (api === 'useState' && t.isArrayPattern(declarator.id)) {
          storeGenericValues(fnPath, declarator);
        }
        // `useCallback<T>(fn)` types the function as `T`.
        const callbackType = declarator.init.typeParameters?.params[0];
        if (api === 'useCallback' && callbackType && t.isIdentifier(declarator.id) && !annotation) {
          declarator.id.typeAnnotation = t.tsTypeAnnotation(callbackType);
        }
        declarator.init = lowerReactHook(declarator.init, api, ctx);
        // `const value: T = useMemo(...)` types the memo's value.
        if (api === 'useMemo' && annotation && t.isIdentifier(declarator.id)) {
          declarator.id.typeAnnotation = null;
          declarator.init.typeParameters ??= t.tsTypeParameterInstantiation([annotation]);
        }
      } else {
        wrapHookArguments(declarator.init, fnPath, ctx, rewrites);
      }
      setup.push(statement);
      continue;
    }
    if (!step) {
      setup.push(statement);
      continue;
    }
    if (step.type === 'memo') {
      const value =
        t.isCallExpression(declarator.init) &&
        reactApi(declarator.init.callee, ctx.reactNames) === 'useDeferredValue'
          ? declarator.init.arguments[0]
          : declarator.init;
      const annotation = declarator.id.typeAnnotation?.typeAnnotation;
      declarator.id.typeAnnotation = null;
      declarator.init = createMemoCall(value, imports, annotation);
      setup.push(statement);
      continue;
    }
    if (step.type === 'props') {
      if (step.rest) {
        imports.add('solid-js', 'omit');
        setup.push(
          constDeclaration(
            t.identifier(step.rest),
            t.callExpression(t.identifier('omit'), [
              t.identifier(step.source),
              ...step.keys.map((key) => t.stringLiteral(DOM_ATTRIBUTES[key] ?? key)),
            ]),
          ),
        );
      }
      continue;
    }
    // Destructure inside one memo that returns the names.
    const body = t.blockStatement([
      t.variableDeclaration('const', [declarator]),
      t.returnStatement(
        t.objectExpression(
          step.names.map((name) =>
            t.objectProperty(t.identifier(name), t.identifier(name), false, true),
          ),
        ),
      ),
    ]);
    setup.push(constDeclaration(step.memoId, createMemoCall(body, imports)));
  }

  // The render part.
  const render = fnPath.node.body.body.slice(split);
  let tail = render;
  if (isAsync && kind === 'component') {
    tail = lowerAsyncComponent(fnPath, render, uid, imports);
  } else if (kind === 'component') {
    const [only] = render;
    const simple =
      render.length === 1 &&
      t.isReturnStatement(only) &&
      (!only.argument ||
        t.isNullLiteral(only.argument) ||
        isJsxNode(only.argument) ||
        t.isLiteral(only.argument));
    if (!simple && render.length === 1 && t.isReturnStatement(only) && ctx.jsx) {
      only.argument = fragmentOf(only.argument);
    } else if (!simple && render.length === 1 && t.isReturnStatement(only)) {
      const renderId = uid('render');
      tail = [
        constDeclaration(renderId, createMemoCall(only.argument, imports)),
        t.returnStatement(renderedMemo(renderId, imports)),
      ];
    } else if (!simple && render.length > 0) {
      const renderId = uid('render');
      tail = [
        constDeclaration(renderId, createMemoCall(t.blockStatement(render), imports)),
        t.returnStatement(
          ctx.jsx
            ? fragmentOf(t.callExpression(t.identifier(renderId.name), []))
            : renderedMemo(renderId, imports),
        ),
      ];
    }
  } else if (kind === 'hook' && render.length > 0) {
    const [only] = render;
    if (render.length === 1 && t.isReturnStatement(only)) {
      if (!only.argument) {
        tail = [];
      } else if (
        t.isIdentifier(only.argument) &&
        rewrites.get(only.argument)?.kind === 'accessor'
      ) {
        // Already an accessor: return it as it is.
        rewrites.delete(only.argument);
      } else if (returnsAccessor(only.argument)) {
        const api = reactApi(only.argument.callee, ctx.reactNames);
        if (api) {
          only.argument = lowerReactHook(only.argument, api, ctx);
        } else {
          wrapHookArguments(only.argument, fnPath, ctx, rewrites);
        }
      } else {
        only.argument = createMemoCall(only.argument, imports);
      }
    } else {
      tail = [t.returnStatement(createMemoCall(t.blockStatement(render), imports))];
    }
    const returnType = fnPath.node.returnType?.typeAnnotation;
    if (returnType && tail.length > 0 && !t.isTSVoidKeyword(returnType)) {
      fnPath.node.returnType = t.tsTypeAnnotation(accessorType(returnType, imports));
    }
  }
  fnPath.node.body.body = [...setup, ...tail];

  // Reads of reactive bindings.
  rewriteReads(fnPath, rewrites, imports);
  snapshotReads(fnPath, imports);
  // A function written as an expression stays one when it is still just its return.
  const [only, ...others] = fnPath.node.body.body;
  if (expressionBody && others.length === 0 && t.isReturnStatement(only) && only.argument) {
    fnPath.node.body = only.argument;
  }
}

/**
 * Drops `Component.displayName = ...` (a component's or a context's): React's developer tools
 * label, which Solid has no counterpart of. A development-only guard left empty goes with it.
 */
function dropDisplayNames(programPath) {
  const componentRoot = (node) => {
    let current = node;
    while (
      t.isMemberExpression(current) ||
      t.isTSAsExpression(current) ||
      t.isParenthesizedExpression(current)
    ) {
      current = t.isMemberExpression(current) ? current.object : current.expression;
    }
    return t.isIdentifier(current) && /^[A-Z]/.test(current.name);
  };
  programPath.traverse({
    ExpressionStatement(path) {
      const expression = path.node.expression;
      if (
        t.isAssignmentExpression(expression, { operator: '=' }) &&
        t.isMemberExpression(expression.left) &&
        t.isIdentifier(expression.left.property, { name: 'displayName' }) &&
        componentRoot(expression.left.object)
      ) {
        const block = path.parentPath;
        path.remove();
        const guard = block.parentPath;
        if (
          block.isBlockStatement() &&
          block.node.body.length === 0 &&
          guard?.isIfStatement() &&
          !guard.node.alternate
        ) {
          guard.remove();
        }
      }
    },
  });
}

/** The type TypeScript infers for a parameter from its default value, when the transform can say. */
function defaultType(value) {
  if (t.isIdentifier(value) && value.name !== 'undefined') {
    return t.tsTypeQuery(t.identifier(value.name));
  }
  if (t.isStringLiteral(value) || t.isTemplateLiteral(value)) {
    return t.tsStringKeyword();
  }
  if (t.isNumericLiteral(value)) {
    return t.tsNumberKeyword();
  }
  if (t.isBooleanLiteral(value)) {
    return t.tsBooleanKeyword();
  }
  return null;
}

/** Passes each argument of a corpus hook call as an accessor. */
function wrapHookArguments(call, fnPath, ctx, rewrites) {
  const callPath = findPath(fnPath, call);
  if (!callPath) {
    return;
  }
  if (!isCorpusHook(callPath, ctx)) {
    // Another package's hook (Base UI's `useRender`) takes props-like objects: a property it reads
    // later reads the current value, as React passes a fresh object on each render.
    for (const arg of call.arguments) {
      if (!t.isObjectExpression(arg)) {
        continue;
      }
      arg.properties = arg.properties.map((property) =>
        t.isObjectProperty(property) &&
        !property.computed &&
        !t.isLiteral(property.value) &&
        !isFunctionNode(property.value) &&
        !t.isIdentifier(property.value, { name: 'undefined' })
          ? t.objectMethod(
              'get',
              property.key,
              [],
              t.blockStatement([t.returnStatement(property.value)]),
            )
          : property,
      );
    }
    return;
  }
  call.arguments = call.arguments.map((arg) => {
    if (t.isSpreadElement(arg)) {
      return arg;
    }
    if (
      t.isIdentifier(arg) &&
      rewrites.get(arg)?.kind === 'accessor' &&
      !rewrites.get(arg).optional
    ) {
      // Already an accessor: pass it as it is.
      rewrites.delete(arg);
      return arg;
    }
    return t.arrowFunctionExpression([], arg);
  });
}

function findPath(rootPath, node) {
  let found = null;
  rootPath.traverse({
    enter(path) {
      if (path.node === node) {
        found = path;
        path.stop();
      }
    },
  });
  return found;
}

/**
 * An async component resolves in an async memo that returns its render as a function, which the
 * component renders when the memo settles (a `<Loading>` boundary shows the fallback until then).
 */
function lowerAsyncComponent(fnPath, render, uid, imports) {
  fnPath.node.async = false;
  fnPath.node.returnType = null;
  const body = t.blockStatement(render);
  walkOwn(body, (node) => {
    if (t.isReturnStatement(node)) {
      node.argument = t.arrowFunctionExpression([], node.argument ?? t.nullLiteral());
    }
  });
  const memo = createMemoCall(body, imports);
  memo.arguments[0].async = true;
  const resolvedId = uid('rendered');
  return [
    constDeclaration(resolvedId, memo),
    t.returnStatement(
      fragmentOf(t.callExpression(t.callExpression(t.identifier(resolvedId.name), []), [])),
    ),
  ];
}

/** Rewrites every collected read: accessors become calls, aliases their expression. */
/**
 * Whether a read runs once, as the component or hook sets up: not in a function it creates, nor in
 * its JSX (which Solid tracks). React reads such a value on each render; Solid reads it once.
 */
function isSetupRead(path, fnPath) {
  for (let current = path.parentPath; current && current !== fnPath; current = current.parentPath) {
    if (current.isFunction() || current.isJSXElement() || current.isJSXFragment()) {
      return false;
    }
  }
  return true;
}

/**
 * Passes a `useState<P>()` setter (where `P` is a type parameter in scope) the values it is called
 * with through an updater (`setData(() => result)`), as Solid's setter types a `P` value.
 */
function storeGenericValues(fnPath, declarator) {
  const [stateType] = declarator.init.typeParameters?.params ?? [];
  const setter = declarator.id.elements[1];
  if (!stateType || !t.isIdentifier(setter)) {
    return;
  }
  const typeParameters = new Set();
  for (let current = fnPath; current; current = current.parentPath) {
    for (const param of current.node.typeParameters?.params ?? []) {
      typeParameters.add(param.name);
    }
  }
  const mentionsTypeParameter = (node) => {
    if (!node || typeof node !== 'object') {
      return false;
    }
    if (Array.isArray(node)) {
      return node.some(mentionsTypeParameter);
    }
    if (
      t.isTSTypeReference(node) &&
      t.isIdentifier(node.typeName) &&
      typeParameters.has(node.typeName.name)
    ) {
      return true;
    }
    return t.VISITOR_KEYS[node.type]?.some((key) => mentionsTypeParameter(node[key])) ?? false;
  };
  if (!mentionsTypeParameter(stateType)) {
    return;
  }
  for (const reference of fnPath.scope.getBinding(setter.name)?.referencePaths ?? []) {
    const call = reference.parentPath;
    const [value] = call.isCallExpression({ callee: reference.node }) ? call.node.arguments : [];
    if (value && !isFunctionNode(value) && !isNonFunctionLiteral(value)) {
      call.node.arguments = [t.arrowFunctionExpression([], value)];
    }
  }
}

/** Whether an expression is a literal that cannot be a function (`0`, `''`, `[]`, `null`). */
function isNonFunctionLiteral(node) {
  return (
    t.isNumericLiteral(node) ||
    t.isStringLiteral(node) ||
    t.isBooleanLiteral(node) ||
    t.isNullLiteral(node) ||
    t.isBigIntLiteral(node) ||
    t.isTemplateLiteral(node) ||
    t.isArrayExpression(node) ||
    t.isObjectExpression(node) ||
    t.isNewExpression(node) ||
    t.isIdentifier(node, { name: 'undefined' }) ||
    (t.isUnaryExpression(node) && t.isNumericLiteral(node.argument)) ||
    ((t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node)) &&
      isNonFunctionLiteral(node.expression))
  );
}

const untrackCall = (expression, imports) => {
  imports.add('solid-js', 'untrack');
  const isRead =
    t.isCallExpression(expression) &&
    t.isIdentifier(expression.callee) &&
    expression.arguments.length === 0;
  return t.callExpression(t.identifier('untrack'), [
    isRead ? expression.callee : t.arrowFunctionExpression([], expression),
  ]);
};

/**
 * Marks a reactive read for `snapshotReads`: `key` groups reads of one value, `name` names its
 * local, and a setup read runs once (so closures after it read the live value, not a snapshot).
 */
function markRead(node, key, name, setup) {
  node.solidRead = key;
  node.solidReadName = name ?? key;
  node.solidSetup = setup;
}

function rewriteReads(fnPath, rewrites, imports) {
  if (rewrites.size === 0) {
    return;
  }
  fnPath.traverse({
    MemberExpression(path) {
      // An accessor member of a Base UI hook's result is read through a call.
      if (rewrites.get(path.node)?.kind === 'member-read') {
        const call = t.callExpression(path.node, []);
        call.solidRead = null;
        rewrites.delete(path.node);
        path.replaceWith(call);
        path.skip();
        return;
      }
      // A props read where the component sets up runs once, explicitly.
      if (rewrites.get(path.node)?.kind === 'source-read' && isSetupRead(path, fnPath)) {
        const call = untrackCall(path.node, imports);
        if (!path.node.computed && t.isIdentifier(path.node.property)) {
          markRead(call, `props.${path.node.property.name}`, path.node.property.name, true);
        }
        path.replaceWith(call);
        path.skip();
      }
    },
    'Identifier|JSXIdentifier'(path) {
      const entry = rewrites.get(path.node);
      if (!entry || entry.kind === 'source-read' || entry.kind === 'member-read') {
        return;
      }
      let replacement;
      const setupRead = !path.isJSXIdentifier() && isSetupRead(path, fnPath);
      if (entry.kind === 'alias') {
        replacement = entry.alias();
        // `_value().name` reads as one value, as the destructured `name` did.
        if (
          (t.isMemberExpression(replacement) || t.isOptionalMemberExpression(replacement)) &&
          t.isCallExpression(replacement.object) &&
          t.isIdentifier(replacement.object.callee)
        ) {
          const member = replacement.computed ? null : replacement.property.name;
          if (member) {
            markRead(
              replacement,
              `${replacement.object.callee.name}.${member}`,
              path.node.name,
              setupRead,
            );
          } else {
            markRead(replacement.object, replacement.object.callee.name, null, setupRead);
          }
        }
      } else if (entry.optional) {
        replacement = t.optionalCallExpression(t.identifier(entry.name), [], true);
        markRead(replacement, entry.name, null, false);
      } else {
        replacement = t.callExpression(t.identifier(entry.name), []);
        markRead(replacement, entry.name, null, false);
      }
      // A read where the component or hook sets up runs once, explicitly (`untrack`).
      if (setupRead) {
        if (
          entry.kind === 'alias' &&
          t.isMemberExpression(replacement) &&
          t.isCallExpression(replacement.object)
        ) {
          // `_value().name`: the memo read is untracked, the member read off it.
          replacement.object = untrackCall(replacement.object, imports);
        } else {
          replacement = untrackCall(replacement, imports);
          markRead(replacement, entry.name, null, true);
        }
      }
      if (path.isJSXIdentifier()) {
        // A reactive component (or a member of a reactive value) renders through
        // `<Dynamic component={...}>`.
        imports.add('@solidjs/web', 'Dynamic');
        let name = path;
        let component = replacement;
        while (name.parentPath.isJSXMemberExpression() && name.parent.object === name.node) {
          component = t.memberExpression(component, t.identifier(name.parent.property.name));
          name = name.parentPath;
        }
        if (name.parentPath.isJSXOpeningElement()) {
          name.parent.attributes.unshift(
            t.jsxAttribute(t.jsxIdentifier('component'), t.jsxExpressionContainer(component)),
          );
        }
        name.replaceWith(t.jsxIdentifier('Dynamic'));
        return;
      }
      if (path.parentPath.isObjectProperty({ shorthand: true, value: path.node })) {
        path.parent.shorthand = false;
      }
      path.replaceWith(replacement);
      path.skip();
    },
  });
}

/** Whether a statement always leaves its block (`return`, `throw`, `break`, `continue`). */
function exits(statement) {
  if (t.isBlockStatement(statement)) {
    return statement.body.length > 0 && exits(statement.body.at(-1));
  }
  return (
    t.isReturnStatement(statement) ||
    t.isThrowStatement(statement) ||
    t.isBreakStatement(statement) ||
    t.isContinueStatement(statement)
  );
}

/**
 * The reactive reads in a node, by key: those it makes itself, and with `nested`, those of the
 * closures and the JSX it creates. A statement that tests a value re-runs (in its memo or effect)
 * when the value changes, so its closures and JSX can read the value it tested.
 */
function readsIn(path, nested) {
  const reads = new Map();
  path.traverse({
    'Function|JSXExpressionContainer'(inner) {
      if (!nested) {
        inner.skip();
      }
    },
    'CallExpression|OptionalCallExpression|MemberExpression|OptionalMemberExpression'(readPath) {
      const key = readPath.node.solidRead;
      if (!key) {
        return;
      }
      const owner = readPath.findParent(
        (parent) => parent === path || parent.isFunction() || parent.isJSXExpressionContainer(),
      );
      const entry = reads.get(key) ?? { direct: [], nested: [] };
      (owner === path ? entry.direct : entry.nested).push(readPath);
      reads.set(key, entry);
      // A read's own parts are not reads of their own (`_value()` in `_value().name`).
      readPath.skip();
    },
  });
  return reads;
}

/** Merges the reads of `more` into `reads`, for the keys `only` has (all keys without it). */
function mergeReads(reads, more, only) {
  for (const [key, entry] of more) {
    if (only && !only.has(key)) {
      continue;
    }
    const target = reads.get(key) ?? { direct: [], nested: [] };
    target.direct.push(...entry.direct);
    target.nested.push(...entry.nested);
    reads.set(key, target);
  }
  return reads;
}

/** Whether an expression tests a value it may read again (a condition or a logical operator). */
function narrows(path) {
  if (path.isConditionalExpression() || path.isLogicalExpression()) {
    return true;
  }
  let found = false;
  path.traverse({
    Function(inner) {
      inner.skip();
    },
    'ConditionalExpression|LogicalExpression'(inner) {
      found = true;
      inner.stop();
    },
  });
  return found;
}

const isNothing = (node) =>
  t.isNullLiteral(node) ||
  t.isIdentifier(node, { name: 'undefined' }) ||
  t.isBooleanLiteral(node, { value: false });

/** Whether a read is a test TypeScript narrows the value by (`value &&`, `value != null`). */
function narrowingTest(readPath) {
  const { node, parentPath } = readPath;
  const parent = parentPath.node;
  if (parentPath.isConditionalExpression() || parentPath.isIfStatement()) {
    return parent.test === node;
  }
  if (parentPath.isLogicalExpression()) {
    return parent.left === node;
  }
  if (parentPath.isUnaryExpression()) {
    return parent.operator === '!' || parent.operator === 'typeof';
  }
  if (parentPath.isBinaryExpression()) {
    const other = parent.left === node ? parent.right : parent.left;
    return (
      (['==', '!=', '===', '!=='].includes(parent.operator) && isNothing(other)) ||
      (parent.operator === 'instanceof' && parent.left === node) ||
      (parent.operator === 'in' && parent.right === node)
    );
  }
  return false;
}

/** Whether a read is used where its type matters: a member, an argument, a prop, a value. */
function typedUse(readPath) {
  const { node, parentPath } = readPath;
  const parent = parentPath.node;
  return (
    ((parentPath.isMemberExpression() || parentPath.isOptionalMemberExpression()) &&
      parent.object === node) ||
    ((parentPath.isCallExpression() ||
      parentPath.isOptionalCallExpression() ||
      parentPath.isNewExpression()) &&
      parent.arguments.includes(node)) ||
    (parentPath.isJSXExpressionContainer() && parentPath.parentPath.isJSXAttribute()) ||
    (parentPath.isObjectProperty() && parent.value === node) ||
    parentPath.isSpreadElement() ||
    parentPath.isJSXSpreadAttribute() ||
    parentPath.isReturnStatement() ||
    (parentPath.isVariableDeclarator() && parent.init === node) ||
    (parentPath.isAssignmentExpression() && parent.right === node)
  );
}

/** The test an expression starts with: `test ? a : b`, `test && rest`. */
function leadingTest(node) {
  if (t.isConditionalExpression(node)) {
    return node.test;
  }
  if (t.isLogicalExpression(node, { operator: '&&' })) {
    return t.isLogicalExpression(node.left, { operator: '&&' })
      ? leadingTest(node.left)
      : node.left;
  }
  return null;
}

/** `test && rest` without its leading `test`. */
function withoutLeadingTest(node, test) {
  return node.left === test
    ? node.right
    : t.logicalExpression('&&', withoutLeadingTest(node.left, test), node.right);
}

// Calls that run the callback they take before they return.
const SYNC_CALLBACK_METHODS = new Set([
  'every',
  'filter',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex',
  'flatMap',
  'forEach',
  'map',
  'reduce',
  'reduceRight',
  'some',
  'sort',
  'toSorted',
]);
const SIGNAL_CREATORS = new Set(['createSignal', 'createStore', 'createOptimistic']);

/** Whether a function runs before the call it is passed to returns. */
function runsInCall(fnPath) {
  const call = fnPath.parentPath;
  if (
    !(call.isCallExpression() || call.isOptionalCallExpression()) ||
    fnPath.listKey !== 'arguments'
  ) {
    return false;
  }
  const { callee } = call.node;
  if (t.isMemberExpression(callee) || t.isOptionalMemberExpression(callee)) {
    return !callee.computed && SYNC_CALLBACK_METHODS.has(callee.property.name);
  }
  if (!t.isIdentifier(callee)) {
    return false;
  }
  if (callee.name === 'untrack') {
    return true;
  }
  // A signal's setter calls an updater it is passed.
  const declarator = call.scope.getBinding(callee.name)?.path;
  return Boolean(
    declarator?.isVariableDeclarator() &&
    t.isArrayPattern(declarator.node.id) &&
    t.isCallExpression(declarator.node.init) &&
    t.isIdentifier(declarator.node.init.callee) &&
    SIGNAL_CREATORS.has(declarator.node.init.callee.name),
  );
}

/**
 * The effect callback (`createEffect`'s second function) a statement runs in, directly or in its
 * blocks, or null.
 */
function effectCallbackOf(path) {
  const fn = path.getFunctionParent();
  const call = fn?.parentPath;
  return call?.isCallExpression() &&
    t.isIdentifier(call.node.callee) &&
    ['createEffect', 'createRenderEffect'].includes(call.node.callee.name) &&
    call.node.arguments[1] === fn.node
    ? fn
    : null;
}

/**
 * A callback an effect leaves to run later (a timer's, a listener's, its cleanup) reads the values
 * the effect saw, as React's closure does: they are read when the statement runs. When they change
 * the effect reruns, and its cleanup cancels what the callback was for.
 */
function captureDeferredReads(path) {
  if (path.isIfStatement() || !effectCallbackOf(path)) {
    return;
  }
  const deferred = (readPath) => {
    for (
      let current = readPath.parentPath;
      current && current !== path;
      current = current.parentPath
    ) {
      if (current.isFunction() && !runsInCall(current)) {
        return true;
      }
    }
    return false;
  };
  const declarations = [];
  for (const entry of readsIn(path, true).values()) {
    const reads = entry.nested.filter(deferred);
    if (reads.length === 0) {
      continue;
    }
    const id = path.scope.generateUidIdentifier(reads[0].node.solidReadName);
    declarations.push(constDeclaration(id, t.cloneNode(reads[0].node, true)));
    for (const read of reads) {
      read.replaceWith(t.identifier(id.name));
    }
  }
  if (declarations.length > 0) {
    path.insertBefore(declarations);
  }
}

/**
 * React code narrows a value it reads (`if (value) value.x`); a read through a call does not narrow
 * in TypeScript. A statement (or a JSX expression) that reads an accessor more than once reads it
 * once, into a local: in Solid 2 a value read twice in one synchronous pass is the same value.
 */
function snapshotReads(fnPath, imports) {
  // A value read more than once (a test, then the read it narrows) reads once into a local. The
  // closures the statement creates read that local too, as they read the React value they close
  // over; after a setup read they read the live value instead.
  const snapshot = (reads, scope) => {
    const declarations = [];
    for (const entry of reads.values()) {
      const [first] = entry.direct;
      const closures = first && !first.node.solidSetup ? entry.nested : [];
      const paths = [...entry.direct, ...closures];
      if (!first || paths.length < 2) {
        continue;
      }
      const id = scope.generateUidIdentifier(first.node.solidReadName);
      declarations.push(constDeclaration(id, t.cloneNode(first.node, true)));
      for (const readPath of paths) {
        readPath.replaceWith(t.identifier(id.name));
      }
    }
    return declarations;
  };
  const repeats = (reads) =>
    [...reads.values()].some(
      (entry) =>
        entry.direct.length > 0 &&
        entry.direct.length + (entry.direct[0].node.solidSetup ? 0 : entry.nested.length) > 1,
    );
  fnPath.traverse({
    'IfStatement|ExpressionStatement|VariableDeclaration|ReturnStatement|ThrowStatement'(path) {
      if (!path.parentPath.isBlockStatement()) {
        return;
      }
      captureDeferredReads(path);
      // What a component or hook returns where it sets up stays reactive: its JSX expressions
      // narrow on their own (below), and a snapshot here would be read once.
      if (path.isReturnStatement() && path.getFunctionParent() === fnPath) {
        return;
      }
      const reads = readsIn(path, true);
      // A guard (`if (!value) return;`) narrows the statements after it too.
      if (path.isIfStatement() && !path.node.alternate && exits(path.node.consequent)) {
        const tested = readsIn(path.get('test'), false);
        for (const sibling of path.getAllNextSiblings()) {
          mergeReads(reads, readsIn(sibling, true), tested);
        }
      }
      // Only where a read narrows: a test that the same statement reads again after.
      if (
        (path.isExpressionStatement() ||
          path.isVariableDeclaration() ||
          path.isReturnStatement()) &&
        !narrows(path)
      ) {
        return;
      }
      if (!repeats(reads)) {
        return;
      }
      const declarations = snapshot(reads, path.scope);
      if (declarations.length > 0) {
        path.insertBefore(declarations);
      }
    },
    ArrowFunctionExpression(path) {
      // `() => value ? use(value) : null`, as a block that reads the value once.
      const body = path.get('body');
      if (
        body.isBlockStatement() ||
        body.isJSXElement() ||
        body.isJSXFragment() ||
        !narrows(body)
      ) {
        return;
      }
      const wrapper = t.blockStatement([t.returnStatement(body.node)]);
      const reads = readsIn(body, true);
      if (!repeats(reads)) {
        return;
      }
      body.replaceWith(wrapper);
      const returnPath = path.get('body.body.0');
      const declarations = snapshot(readsIn(returnPath, true), returnPath.scope);
      returnPath.insertBefore(declarations);
    },
    JSXExpressionContainer(path) {
      const expression = path.node.expression;
      if (t.isJSXEmptyExpression(expression) || isFunctionNode(expression)) {
        return;
      }
      const reads = readsIn(path, true);
      if (!repeats(reads)) {
        return;
      }
      // A value narrowed for nothing reads again: in one pass it is the same value.
      const narrowing = [...reads.values()].filter(
        (entry) =>
          [...entry.direct, ...entry.nested].some(narrowingTest) &&
          [...entry.direct, ...entry.nested].some((read) => !narrowingTest(read) && typedUse(read)),
      );
      if (narrowing.length === 0) {
        return;
      }
      // `value && use(value)`, `value ? use(value) : other`: Solid's `<Show>` narrows the value.
      const test = leadingTest(expression);
      const shown =
        narrowing.length === 1 && narrowing[0].direct.find((read) => read.node === test);
      if (shown && (path.parentPath.isJSXElement() || path.parentPath.isJSXFragment())) {
        imports.add('solid-js', 'Show');
        const value = path.scope.generateUidIdentifier(test.solidReadName);
        for (const read of [...narrowing[0].direct, ...narrowing[0].nested]) {
          if (read.node !== test) {
            read.replaceWith(t.callExpression(t.identifier(value.name), []));
          }
        }
        const current = path.node.expression;
        const conditional = t.isConditionalExpression(current);
        const fallback = conditional && !isNothing(current.alternate) ? current.alternate : null;
        path.replaceWith(
          t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('Show'), [
              t.jsxAttribute(t.jsxIdentifier('when'), t.jsxExpressionContainer(test)),
              ...(fallback
                ? [t.jsxAttribute(t.jsxIdentifier('fallback'), t.jsxExpressionContainer(fallback))]
                : []),
            ]),
            t.jsxClosingElement(t.jsxIdentifier('Show')),
            [
              t.jsxExpressionContainer(
                t.arrowFunctionExpression(
                  [value],
                  conditional ? current.consequent : withoutLeadingTest(current, test),
                ),
              ),
            ],
          ),
        );
        path.skip();
        return;
      }
      // Inside a function the insert calls, so the expression stays reactive.
      const declarations = snapshot(reads, path.scope);
      path.node.expression = t.callExpression(
        t.arrowFunctionExpression(
          [],
          t.blockStatement([...declarations, t.returnStatement(path.node.expression)]),
        ),
        [],
      );
      path.skip();
    },
  });
}

/**
 * React creates an element where it is written, so a value a condition narrows (`file.name &&
 * <Pre name={file.name} />`) is narrowed in the element. An element value here is a function
 * (`element(() => <Pre />)`), where TypeScript does not narrow a property: a property path the
 * condition tests and the element reads is read once before the statement, as React reads it.
 */
function snapshotElementPaths(programPath) {
  const isPath = (node) =>
    t.isIdentifier(node) ||
    (t.isMemberExpression(node) &&
      (!node.computed || t.isStringLiteral(node.property) || t.isNumericLiteral(node.property)) &&
      isPath(node.object));
  const rootOf = (node) => (t.isMemberExpression(node) ? rootOf(node.object) : node);
  programPath.traverse({
    CallExpression(callPath) {
      if (!isElementCall(callPath.node)) {
        return;
      }
      // The member paths the element reads, of bindings that never change.
      const reads = [];
      callPath.get('arguments.0').traverse({
        MemberExpression(memberPath) {
          if (!isPath(memberPath.node)) {
            return;
          }
          const root = rootOf(memberPath.node);
          if (callPath.scope.getBinding(root.name)?.constant) {
            reads.push(memberPath);
          }
        },
      });
      if (reads.length === 0) {
        return;
      }
      // In a function written as an expression (a memo's), the read goes in the function: its
      // body becomes a block, which the traversal visits again.
      const fn = callPath.getFunctionParent();
      const underTest = Boolean(
        callPath.findParent(
          (parent) =>
            parent === fn || parent.isConditionalExpression() || parent.isLogicalExpression(),
        ) !== fn,
      );
      if (fn?.isArrowFunctionExpression() && !fn.get('body').isBlockStatement() && underTest) {
        fn.get('body').replaceWith(t.blockStatement([t.returnStatement(fn.node.body)]));
        return;
      }
      // The tests the element is written under, up to its statement's function.
      for (let current = callPath; current && !current.isFunction(); current = current.parentPath) {
        const parent = current.parentPath;
        let test = null;
        if (parent?.isConditionalExpression() && parent.node.test !== current.node) {
          test = parent.get('test');
        } else if (
          parent?.isLogicalExpression({ operator: '&&' }) &&
          parent.node.right === current.node
        ) {
          test = parent.get('left');
        } else if (parent?.isIfStatement() && parent.node.consequent === current.node) {
          test = parent.get('test');
        }
        if (!test) {
          continue;
        }
        const statement = parent.isStatement() ? parent : parent.getStatementParent();
        for (const read of reads) {
          if (read.removed || !read.node) {
            continue;
          }
          const tested = [];
          const visit = (path) => {
            if (t.isNodesEquivalent(path.node, read.node)) {
              tested.push(path);
            }
          };
          visit(test);
          test.traverse({ MemberExpression: visit });
          if (tested.length === 0) {
            continue;
          }
          const id = statement.scope.generateUidIdentifier(
            t.isIdentifier(read.node.property) ? read.node.property.name : 'value',
          );
          statement.insertBefore(constDeclaration(id, t.cloneNode(read.node, true)));
          const same = [];
          statement.traverse({
            MemberExpression(path) {
              if (t.isNodesEquivalent(path.node, read.node)) {
                same.push(path);
              }
            },
          });
          for (const path of [...tested, ...same]) {
            if (!path.removed && path.node) {
              path.replaceWith(t.identifier(id.name));
            }
          }
        }
      }
    },
  });
}

/** Whether a function returns its `children` (a layout or a provider that renders no element). */
function returnsChildren(path) {
  const [param] = path.node.params;
  const destructured =
    t.isObjectPattern(param) &&
    param.properties.some(
      (property) =>
        t.isObjectProperty(property) && t.isIdentifier(property.key, { name: 'children' }),
    );
  let found = false;
  path.traverse({
    Function(inner) {
      inner.skip();
    },
    ReturnStatement(ret) {
      const arg = ret.node.argument;
      if (
        (destructured && t.isIdentifier(arg, { name: 'children' })) ||
        (t.isMemberExpression(arg) && t.isIdentifier(arg.property, { name: 'children' }))
      ) {
        found = true;
      }
    },
  });
  if (t.isArrowFunctionExpression(path.node) && !t.isBlockStatement(path.node.body)) {
    const body = path.node.body;
    found ||=
      (destructured && t.isIdentifier(body, { name: 'children' })) ||
      (t.isMemberExpression(body) && t.isIdentifier(body.property, { name: 'children' }));
  }
  return found;
}

/** Whether a function calls a hook in its own body. */
function callsHooks(path, ctx) {
  let found = false;
  path.traverse({
    Function(inner) {
      inner.skip();
    },
    CallExpression(callPath) {
      if (isHookCall(callPath.node, ctx)) {
        found = true;
        callPath.stop();
      }
    },
  });
  return found;
}

/** The expression a value takes its place as (through conditionals, logical operators and casts). */
function valuePosition(path) {
  let current = path;
  for (;;) {
    const parent = current.parentPath;
    if (
      (parent.isConditionalExpression() && parent.node.test !== current.node) ||
      (parent.isLogicalExpression() && parent.node.right === current.node) ||
      parent.isParenthesizedExpression() ||
      parent.isTSAsExpression() ||
      parent.isTSSatisfiesExpression() ||
      parent.isTSNonNullExpression() ||
      (parent.isSequenceExpression() && parent.node.expressions.at(-1) === current.node)
    ) {
      current = parent;
      continue;
    }
    return current;
  }
}

/** Whether a function's result is rendered where the function runs (a component, a render prop). */
function rendersWhereCalled(fnPath, ctx) {
  const name = functionName(fnPath);
  if (name && HOOK_NAME.test(name)) {
    return false;
  }
  const position = valuePosition(fnPath);
  const parent = position.parentPath;
  if (parent.isCallExpression() && position.node !== parent.node.callee) {
    const callee = parent.node.callee;
    const api = reactApi(callee, ctx.reactNames);
    // `useMemo(() => <x />)` keeps an element to render later.
    if (api === 'useMemo') {
      return false;
    }
    // `list.map((item) => <x />)` renders where its result is placed.
    if (
      t.isMemberExpression(callee) &&
      t.isIdentifier(callee.property) &&
      /^(map|flatMap)$/.test(callee.property.name)
    ) {
      return inRenderPosition(parent, ctx);
    }
  }
  return true;
}

/** Whether JSX renders where it is written (a child, a prop, a component's or render prop's result). */
function inRenderPosition(path, ctx) {
  const position = valuePosition(path);
  const parent = position.parentPath;
  // A component's prop (`icon={<GitHubIcon />}`) is a value the component reads, maybe more than
  // once (`props.icon ? <div>{props.icon}</div> : null`), as React's element is; a render element
  // becomes a render config (see `renderElementToConfig`).
  const attribute = parent.isJSXExpressionContainer() ? parent.parentPath : parent;
  if (
    attribute.isJSXAttribute() &&
    t.isJSXIdentifier(attribute.node.name) &&
    !['render', 'children'].includes(attribute.node.name.name) &&
    isComponentElement(attribute.parentPath.node)
  ) {
    return false;
  }
  if (
    parent.isJSXExpressionContainer() ||
    parent.isJSXElement() ||
    parent.isJSXFragment() ||
    parent.isJSXAttribute()
  ) {
    return true;
  }
  if (parent.isArrowFunctionExpression() && parent.node.body === position.node) {
    return rendersWhereCalled(parent, ctx);
  }
  if (parent.isReturnStatement()) {
    const fnPath = parent.getFunctionParent();
    return !fnPath || rendersWhereCalled(fnPath, ctx);
  }
  return false;
}

/** Whether an opening element is a component's (`<Item>`, `<Menu.Item>`), not a DOM element's. */
function isComponentElement(opening) {
  const { name } = opening;
  return !(t.isJSXIdentifier(name) && /^[a-z]/.test(name.name)) && !t.isJSXNamespacedName(name);
}

/**
 * A React element is a description: it renders where it is placed, in that place's context. Solid
 * JSX renders where it is written. JSX kept as a value (in a variable, an object, a hook's result)
 * becomes `element(() => <jsx />)`, which Solid renders where it is inserted.
 */
function deferElements(programPath, ctx) {
  programPath.traverse({
    'JSXElement|JSXFragment'(path) {
      if (inRenderPosition(path, ctx)) {
        return;
      }
      ctx.imports.add(REACT_ADAPTERS, 'element');
      path.replaceWith(
        t.callExpression(t.identifier('element'), [t.arrowFunctionExpression([], path.node)]),
      );
      path.skip();
    },
  });
}

/** Whether a function is a value of an MDX components map (`const c: MDXComponents = {...}`). */
function inComponentMap(path) {
  const property = path.parentPath;
  if (!property.isObjectProperty() || property.node.value !== path.node) {
    return false;
  }
  const declarator = property.parentPath.parentPath;
  const type = declarator?.isVariableDeclarator()
    ? declarator.node.id.typeAnnotation?.typeAnnotation
    : null;
  return Boolean(
    t.isTSTypeReference(type) && t.isIdentifier(type.typeName, { name: 'MDXComponents' }),
  );
}

/** Whether a function renders: it has JSX, or an element (`element(() => <jsx />)`). */
function containsJsx(path) {
  let found = false;
  path.traverse({
    'JSXElement|JSXFragment'(inner) {
      found = true;
      inner.stop();
    },
  });
  return found;
}

/**
 * Solid code names a component's props `props` (its lint reads them as reactive): another
 * function's `props` parameter is `params`, as docs-infra names the ones it declares.
 */
function renameNonComponentProps(programPath) {
  programPath.traverse({
    Function(path) {
      const [param] = path.node.params;
      const name = functionName(path);
      if (
        !t.isIdentifier(param, { name: 'props' }) ||
        isComponentName(name) ||
        (name && HOOK_NAME.test(name)) ||
        inComponentMap(path) ||
        containsJsx(path)
      ) {
        return;
      }
      path.scope.rename(
        'props',
        path.scope.hasBinding('params') ? path.scope.generateUid('params') : 'params',
      );
    },
  });
}

/**
 * React's elements are descriptions: a module declares them once (`const contents = { a: <p /> }`)
 * and every render reuses them. Solid's JSX creates the elements, under the render that runs it,
 * and an element renders in one place: a module const holding elements moves into each function
 * that uses it.
 */
function moveModuleElements(programPath) {
  for (const statement of programPath.get('body')) {
    if (
      !statement.isVariableDeclaration({ kind: 'const' }) ||
      statement.node.declarations.length !== 1
    ) {
      continue;
    }
    const declarator = statement.get('declarations.0');
    if (!declarator.get('id').isIdentifier() || !declarator.node.init) {
      continue;
    }
    let createsElements = false;
    declarator.get('init').traverse({
      Function(inner) {
        inner.skip();
      },
      'JSXElement|JSXFragment'(inner) {
        createsElements = true;
        inner.stop();
      },
    });
    const binding = statement.scope.getBinding(declarator.node.id.name);
    if (!createsElements || !binding || binding.referencePaths.length === 0) {
      continue;
    }
    // The functions of the module that use it.
    const functions = new Set();
    let moduleUse = false;
    for (const reference of binding.referencePaths) {
      const fn = reference.findParent(
        (parent) => parent.isFunction() && parent.getFunctionParent() === null,
      );
      if (fn) {
        functions.add(fn);
      } else {
        moduleUse = true;
      }
    }
    if (moduleUse) {
      continue;
    }
    for (const fn of functions) {
      if (!fn.get('body').isBlockStatement()) {
        fn.get('body').replaceWith(t.blockStatement([t.returnStatement(fn.node.body)]));
      }
      fn.get('body').unshiftContainer('body', t.cloneNode(statement.node, true));
    }
    statement.remove();
  }
  programPath.scope.crawl();
}

/**
 * React picks a hook by environment (`typeof window === 'undefined' ? useServer : useBrowser`):
 * its hooks key nothing. Solid keys hydration by the owners a render creates, so the hook runs in an
 * owner of its own (`environmentHook`), one id on both sides whatever the variant creates.
 */
function environmentHooks(programPath, imports) {
  const isServerTest = (node) =>
    t.isBinaryExpression(node, { operator: '===' }) &&
    t.isUnaryExpression(node.left, { operator: 'typeof' }) &&
    t.isIdentifier(node.left.argument, { name: 'window' }) &&
    t.isStringLiteral(node.right, { value: 'undefined' });
  const isHook = (node) => t.isIdentifier(node) && HOOK_NAME.test(node.name);
  programPath.traverse({
    ConditionalExpression(path) {
      const { test, consequent, alternate } = path.node;
      if (isServerTest(test) && isHook(consequent) && isHook(alternate)) {
        imports.add(REACT_ADAPTERS, 'environmentHook');
        path.replaceWith(
          t.callExpression(t.identifier('environmentHook'), [consequent, alternate]),
        );
      }
    },
  });
}

/** Whether a value is an element (`element(...)`), or one of several (`a ? element(...) : null`). */
function holdsElement(node) {
  if (isElementCall(node)) {
    return true;
  }
  if (t.isConditionalExpression(node)) {
    return holdsElement(node.consequent) || holdsElement(node.alternate);
  }
  if (t.isLogicalExpression(node)) {
    return holdsElement(node.left) || holdsElement(node.right);
  }
  return false;
}

/**
 * An element value is a function Solid calls where it is inserted. Inserted by name
 * (`{actions}`), the compiler takes it for a value and leaves the hole unscoped, so the server and
 * the client key its content differently; inserted through a call (`{place(actions)}`), the hole is
 * scoped and the keys agree.
 */
function placeElements(programPath, imports) {
  programPath.traverse({
    JSXExpressionContainer(path) {
      const { expression } = path.node;
      if (
        !t.isIdentifier(expression) ||
        !(path.parentPath.isJSXElement() || path.parentPath.isJSXFragment())
      ) {
        return;
      }
      const declarator = path.scope.getBinding(expression.name)?.path;
      if (declarator?.isVariableDeclarator() && holdsElement(declarator.node.init)) {
        imports.add(REACT_ADAPTERS, 'place');
        path.node.expression = t.callExpression(t.identifier('place'), [expression]);
      }
    },
  });
}

/** Lowers every component and corpus hook, innermost first. */
function lowerReactiveFunctions(programPath, ctx) {
  const found = [];
  programPath.traverse({
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression': {
      exit(path) {
        const name = functionName(path);
        if (name && HOOK_NAME.test(name)) {
          found.push({ path, kind: 'hook' });
        } else if (
          isComponentName(name) &&
          (returnsJsx(path) || callsHooks(path, ctx) || returnsChildren(path))
        ) {
          found.push({ path, kind: 'component' });
        } else if (!name && t.isExportDefaultDeclaration(path.parent) && returnsJsx(path)) {
          found.push({ path, kind: 'component' });
        } else if (inComponentMap(path)) {
          found.push({ path, kind: 'component' });
        }
      },
    },
  });
  // A hook's overload signatures take and return accessors too.
  const hookNames = new Set(
    found.filter(({ kind }) => kind === 'hook').map(({ path }) => functionName(path)),
  );
  programPath.traverse({
    TSDeclareFunction(path) {
      if (!path.node.id || !hookNames.has(path.node.id.name)) {
        return;
      }
      path.node.params = path.node.params.map((param, index) => {
        const id = t.isIdentifier(param)
          ? param
          : t.identifier(index === 0 ? 'params' : `arg${index}`);
        const annotation = param.typeAnnotation?.typeAnnotation;
        if (annotation) {
          id.typeAnnotation = t.tsTypeAnnotation(accessorType(annotation, ctx.imports));
        }
        id.optional = Boolean(param.optional);
        return id;
      });
      const returnType = path.node.returnType?.typeAnnotation;
      if (returnType && !t.isTSVoidKeyword(returnType)) {
        path.node.returnType = t.tsTypeAnnotation(accessorType(returnType, ctx.imports));
      }
    },
  });
  for (const { path, kind } of found) {
    if (kind === 'component') {
      rewriteDestructuredProps(path, ctx.imports);
      path.scope.crawl();
    }
    lowerFunction(path, kind, ctx);
    programPath.scope.crawl();
  }
}

/** React hooks outside a component or hook (in a callback, say) map one to one. */
function lowerRemainingHooks(programPath, ctx) {
  programPath.traverse({
    CallExpression: {
      exit(path) {
        const api = reactApi(path.node.callee, ctx.reactNames);
        if (!api || !REACT_HOOKS.has(api)) {
          return;
        }
        const lowered = lowerReactHook(path.node, api, ctx);
        if (lowered) {
          path.replaceWith(lowered);
        } else if (path.parentPath.isExpressionStatement()) {
          path.parentPath.remove();
        }
      },
    },
  });
}

/** Module-level React APIs: `forwardRef`, `memo`, `lazy` and `createContext`. */
function transformModuleApis(programPath, ctx) {
  const { imports, reactNames } = ctx;
  programPath.traverse({
    CallExpression: {
      exit(path) {
        const api = reactApi(path.node.callee, reactNames);
        const args = path.node.arguments;
        switch (api) {
          case 'memo': {
            path.replaceWith(args[0]);
            break;
          }
          case 'lazy': {
            imports.add('solid-js', 'lazy');
            path.node.callee = t.identifier('lazy');
            break;
          }
          case 'createContext': {
            // A corpus context holds an accessor (see the header).
            imports.add('solid-js', 'createContext');
            const [defaultValue] = args;
            const typeParam = path.node.typeParameters?.params[0];
            const call = t.callExpression(t.identifier('createContext'), [
              t.arrowFunctionExpression([], defaultValue ?? t.identifier('undefined')),
            ]);
            if (typeParam) {
              call.typeParameters = t.tsTypeParameterInstantiation([
                accessorType(typeParam, imports),
              ]);
            }
            path.replaceWith(call);
            break;
          }
          case 'forwardRef': {
            const fnPath = path.get('arguments.0');
            if (!fnPath.isFunction()) {
              break;
            }
            const [propsParam, refParam] = fnPath.node.params;
            const [refType, propsType] = path.node.typeParameters?.params ?? [];
            // React types the props as `PropsWithoutRef<P> & RefAttributes<T>`: the ref is the
            // forwarded one, typed as the ref parameter is.
            const refParamType = t.isIdentifier(refParam)
              ? refParam.typeAnnotation?.typeAnnotation
              : null;
            const refPropType =
              refParamType ||
              (refType
                ? t.tsTypeReference(t.identifier('Ref'), t.tsTypeParameterInstantiation([refType]))
                : null);
            const withRef = (annotation) => {
              const refProp = t.tsPropertySignature(
                t.identifier('ref'),
                t.tsTypeAnnotation(refPropType ?? t.tsTypeReference(t.identifier('Ref'))),
              );
              refProp.optional = true;
              // The ref parameter's own type (`React.Ref<T>`) maps with the other React types.
              if (!refParamType) {
                imports.add(ctx.standalone ? 'solid-js' : REACT_ADAPTERS, 'Ref', true);
              }
              let props = annotation;
              if (!ctx.standalone) {
                imports.add(REACT_ADAPTERS, 'PropsWithoutRef', true);
                props = t.tsTypeReference(
                  t.identifier('PropsWithoutRef'),
                  t.tsTypeParameterInstantiation([annotation]),
                );
              }
              return t.tsTypeAnnotation(t.tsIntersectionType([props, t.tsTypeLiteral([refProp])]));
            };
            if (t.isObjectPattern(propsParam) && t.isIdentifier(refParam)) {
              // `({ className, ...props }, ref)` reads the ref from the props, before their rest.
              const restAt = propsParam.properties.findIndex((property) =>
                t.isRestElement(property),
              );
              const refProperty = t.objectProperty(
                t.identifier('ref'),
                t.identifier(refParam.name),
              );
              propsParam.properties.splice(
                restAt === -1 ? propsParam.properties.length : restAt,
                0,
                refProperty,
              );
              const annotation = propsParam.typeAnnotation?.typeAnnotation ?? propsType;
              if (annotation) {
                propsParam.typeAnnotation = withRef(annotation);
              }
              fnPath.node.params = [propsParam];
              path.replaceWith(fnPath.node);
              break;
            }
            if (t.isIdentifier(propsParam)) {
              const annotation = propsParam.typeAnnotation?.typeAnnotation ?? propsType;
              if (annotation) {
                propsParam.typeAnnotation = withRef(annotation);
              }
            }
            if (t.isIdentifier(refParam) && t.isIdentifier(propsParam)) {
              // React's props have no `ref`: the function reads its props without it (a rest or a
              // spread of them does not take the ref), and the ref from all of them.
              const all = fnPath.scope.generateUidIdentifier(propsParam.name);
              const binding = fnPath.scope.getBinding(refParam.name);
              for (const reference of binding?.referencePaths ?? []) {
                reference.replaceWith(
                  t.memberExpression(t.identifier(all.name), t.identifier('ref')),
                );
              }
              if (!t.isBlockStatement(fnPath.node.body)) {
                fnPath.node.body = t.blockStatement([t.returnStatement(fnPath.node.body)]);
              }
              imports.add('solid-js', 'omit');
              const withoutRef = constDeclaration(
                t.identifier(propsParam.name),
                t.callExpression(t.identifier('omit'), [
                  t.identifier(all.name),
                  t.stringLiteral('ref'),
                ]),
              );
              // The component reads these as its props.
              withoutRef.solidProps = true;
              fnPath.node.body.body.unshift(withoutRef);
              all.typeAnnotation = propsParam.typeAnnotation;
              fnPath.node.params[0] = all;
            }
            fnPath.node.params = fnPath.node.params.slice(0, 1);
            path.replaceWith(fnPath.node);
            break;
          }
          case null: {
            if (
              ctx.tanstackUseForm &&
              t.isIdentifier(path.node.callee, { name: ctx.tanstackUseForm })
            ) {
              path.node.callee = t.identifier('createForm');
              path.node.arguments = path.node.arguments.map((arg) =>
                t.arrowFunctionExpression([], arg),
              );
              if (t.isVariableDeclarator(path.parent) && t.isIdentifier(path.parent.id)) {
                ctx.tanstackForms.add(path.parent.id.name);
              }
            }
            break;
          }
          case 'startTransition': {
            const [callback] = args;
            path.replaceWith(t.callExpression(callback, []));
            break;
          }
          case 'isValidElement':
          case 'cloneElement':
          case 'Children': {
            imports.add(REACT_ADAPTERS, api);
            path.node.callee = t.identifier(api);
            break;
          }
          default:
            break;
        }
      },
    },
    AssignmentExpression(path) {
      // A context has no `displayName` in Solid.
      const left = path.node.left;
      if (
        t.isMemberExpression(left) &&
        t.isIdentifier(left.object) &&
        t.isIdentifier(left.property, { name: 'displayName' }) &&
        path.parentPath.isExpressionStatement()
      ) {
        const binding = path.scope.getBinding(left.object.name);
        const init = binding?.path.isVariableDeclarator() ? binding.path.node.init : null;
        if (t.isCallExpression(init) && reactApi(init.callee, reactNames) === 'createContext') {
          path.parentPath.remove();
        }
      }
    },
    MemberExpression(path) {
      // A Solid handler gets the native event: React's `event.nativeEvent` is the event.
      if (t.isIdentifier(path.node.property, { name: 'nativeEvent' }) && !path.node.computed) {
        path.replaceWith(path.node.object);
        return;
      }
      // `React.Children.map(...)` and friends read from the adapter.
      const { object, property } = path.node;
      if (
        t.isMemberExpression(object) &&
        t.isIdentifier(object.object) &&
        reactNames.namespaces.has(object.object.name) &&
        t.isIdentifier(object.property, { name: 'Children' }) &&
        t.isIdentifier(property)
      ) {
        imports.add(REACT_ADAPTERS, 'Children');
        path.node.object = t.identifier('Children');
      }
    },
  });
}

/** Converts a React style object's literal keys and literal numbers to CSS (in place). */
function convertStyleObject(style) {
  for (const property of style.properties) {
    if (!t.isObjectProperty(property) || property.computed || !t.isIdentifier(property.key)) {
      continue;
    }
    const key = property.key.name;
    const value = property.value;
    const number =
      t.isNumericLiteral(value) ||
      (t.isUnaryExpression(value, { operator: '-' }) && t.isNumericLiteral(value.argument));
    if (number && !UNITLESS.has(key)) {
      const amount = t.isNumericLiteral(value) ? value.value : -value.argument.value;
      property.value = t.stringLiteral(amount === 0 ? '0' : `${amount}px`);
    }
    if (/[A-Z]/.test(key)) {
      property.key = t.stringLiteral(kebab(key));
    }
  }
}

/** A style object of literal keys and literal values (converted as written). */
const isStaticStyle = (style) =>
  t.isObjectExpression(style) &&
  style.properties.every(
    (property) =>
      t.isObjectProperty(property) &&
      !property.computed &&
      t.isIdentifier(property.key) &&
      (t.isStringLiteral(property.value) || t.isNumericLiteral(property.value)),
  );

/**
 * Whether a JSX name is a corpus context's `Provider` (`<ThemeContext.Provider>`), not a component
 * of another package named `Provider` (`<Tooltip.Provider>`).
 */
function isContextProvider(name, path, ctx) {
  if (
    !t.isJSXMemberExpression(name) ||
    name.property.name !== 'Provider' ||
    !t.isJSXIdentifier(name.object)
  ) {
    return false;
  }
  const binding = path.scope.getBinding(name.object.name);
  return !binding || binding.kind !== 'module' || ctx.corpusImports.has(name.object.name);
}

/** Whether a value may be a tag name: a string, or one of the values a fallback can take. */
function mayBeTagName(node) {
  if (t.isStringLiteral(node)) {
    return true;
  }
  if (t.isTSAsExpression(node) || t.isParenthesizedExpression(node)) {
    return mayBeTagName(node.expression);
  }
  if (t.isLogicalExpression(node)) {
    return mayBeTagName(node.left) || mayBeTagName(node.right);
  }
  if (t.isConditionalExpression(node)) {
    return mayBeTagName(node.consequent) || mayBeTagName(node.alternate);
  }
  return false;
}

/**
 * Moves React's capture-phase handlers (`onKeyDownCapture`) into the element's ref, through the
 * docs runtime's `captureRef`: Solid's JSX has no capture-phase handlers.
 */
function captureHandlersToRef(opening, imports) {
  const isCapture = (attribute) =>
    t.isJSXAttribute(attribute) &&
    t.isJSXIdentifier(attribute.name) &&
    /^on[A-Z]\w*Capture$/.test(attribute.name.name) &&
    !/PointerCapture$/.test(attribute.name.name);
  const captures = opening.attributes.filter(isCapture);
  if (captures.length === 0) {
    return;
  }
  const handlers = captures.map((attribute) => {
    const reactName = attribute.name.name.slice(0, -'Capture'.length);
    const solidName = REACT_EVENT_NAMES[reactName] ?? reactName;
    const value = t.isJSXExpressionContainer(attribute.value)
      ? attribute.value.expression
      : t.identifier('undefined');
    return t.objectProperty(t.identifier(solidName.slice(2).toLowerCase()), value);
  });
  const refAttribute = opening.attributes.find(
    (attribute) =>
      t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'ref' }),
  );
  const ref =
    refAttribute && t.isJSXExpressionContainer(refAttribute.value)
      ? refAttribute.value.expression
      : t.identifier('undefined');
  imports.add(REACT_ADAPTERS, 'captureRef');
  const call = t.callExpression(t.identifier('captureRef'), [ref, t.objectExpression(handlers)]);
  opening.attributes = opening.attributes.filter(
    (attribute) => !isCapture(attribute) && attribute !== refAttribute,
  );
  opening.attributes.push(t.jsxAttribute(t.jsxIdentifier('ref'), t.jsxExpressionContainer(call)));
}

/** The names in a JSX element name (`Slider.Thumb` is `['Slider', 'Thumb']`). */
function jsxNameParts(name) {
  if (t.isJSXMemberExpression(name)) {
    return [...jsxNameParts(name.object), name.property.name];
  }
  return t.isJSXIdentifier(name) ? [name.name] : [];
}

/** The name an attribute takes in Solid, on an intrinsic element or on a component. */
function solidAttributeName(name, element, ctx) {
  const tag = element.name;
  const intrinsic = t.isJSXIdentifier(tag) && /^[a-z]/.test(tag.name);
  // A component keeps a name its props declare (Base UI's `readOnly`, say): `<Slider.Thumb>` is
  // the `SliderThumb` component.
  if (!intrinsic) {
    const declaredBy = ctx.componentProps.get(name);
    const component = jsxNameParts(tag).join('');
    if (declaredBy?.has(component)) {
      return name;
    }
  }
  if (REACT_ATTRIBUTE_NAMES[name]) {
    return REACT_ATTRIBUTE_NAMES[name];
  }
  if (intrinsic && REACT_EVENT_NAMES[name]) {
    return REACT_EVENT_NAMES[name];
  }
  if (!intrinsic && name === 'onDoubleClick') {
    return 'onDblClick';
  }
  if (intrinsic && name === 'onChange' && (tag.name === 'textarea' || tag.name === 'input')) {
    // React's `onChange` on a text field fires on every edit: the `input` event.
    const type = element.attributes.find(
      (attribute) =>
        t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'type' }),
    )?.value;
    const committed = t.isStringLiteral(type) && ['checkbox', 'radio', 'file'].includes(type.value);
    return committed ? name : 'onInput';
  }
  return name;
}

const jsxNameToExpression = (name) =>
  t.isJSXMemberExpression(name)
    ? t.memberExpression(jsxNameToExpression(name.object), t.identifier(name.property.name))
    : t.identifier(name.name);

/**
 * `render={<X a={b} />}` → `render={{ component: X, get a() { return b; } }}`: the `{ component,
 * ...props }` config Base UI renders as React renders an element it clones (props merged).
 */
function renderElementToConfig(element, imports) {
  const name = element.openingElement.name;
  const intrinsic = t.isJSXIdentifier(name) && /^[a-z]/.test(name.name);
  const properties = [
    t.objectProperty(
      t.identifier('component'),
      intrinsic ? t.stringLiteral(name.name) : jsxNameToExpression(name),
    ),
  ];
  const key = (attributeName) =>
    /^[A-Za-z_$][\w$]*$/.test(attributeName)
      ? t.identifier(attributeName)
      : t.stringLiteral(attributeName);
  const getter = (propertyKey, expression) =>
    t.objectMethod('get', propertyKey, [], t.blockStatement([t.returnStatement(expression)]));
  for (const attribute of element.openingElement.attributes) {
    if (t.isJSXSpreadAttribute(attribute)) {
      properties.push(t.spreadElement(attribute.argument));
      continue;
    }
    const attributeName = t.isJSXNamespacedName(attribute.name)
      ? `${attribute.name.namespace.name}:${attribute.name.name.name}`
      : attribute.name.name;
    const value = attribute.value;
    if (value == null) {
      properties.push(t.objectProperty(key(attributeName), t.booleanLiteral(true)));
    } else if (t.isStringLiteral(value)) {
      properties.push(t.objectProperty(key(attributeName), t.stringLiteral(value.value)));
    } else if (t.isJSXExpressionContainer(value)) {
      const expression = value.expression;
      properties.push(
        t.isLiteral(expression) || isFunctionNode(expression) || t.isIdentifier(expression)
          ? t.objectProperty(key(attributeName), expression)
          : getter(key(attributeName), expression),
      );
    } else {
      properties.push(getter(key(attributeName), value));
    }
  }
  const children = element.children.filter(
    (child) => !(t.isJSXText(child) && child.value.trim() === ''),
  );
  if (children.length > 0) {
    const single = children.length === 1 ? children[0] : null;
    let value;
    if (single && t.isJSXExpressionContainer(single)) {
      value = single.expression;
    } else if (single && t.isJSXText(single)) {
      value = t.stringLiteral(single.value.trim());
    } else if (single) {
      value = single;
    } else {
      value = t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), element.children);
    }
    properties.push(getter(t.identifier('children'), value));
  }
  const config = t.objectExpression(properties);
  // A handler that types its event by where it is written (`onClick: (event) => ...`) takes the
  // element's attribute types, as it does as an attribute.
  const untypedHandler = properties.some(
    (property) =>
      t.isObjectProperty(property) &&
      isFunctionNode(property.value) &&
      property.value.params.some((param) => !param.typeAnnotation),
  );
  if (!intrinsic || !untypedHandler) {
    return config;
  }
  imports.add('@solidjs/web', 'JSX', true);
  return t.tsSatisfiesExpression(
    config,
    t.tsIntersectionType([
      t.tsTypeLiteral([
        t.tsPropertySignature(
          t.identifier('component'),
          t.tsTypeAnnotation(t.tsLiteralType(t.stringLiteral(name.name))),
        ),
      ]),
      t.tsIndexedAccessType(
        t.tsTypeReference(
          t.tsQualifiedName(t.identifier('JSX'), t.identifier('IntrinsicElements')),
        ),
        t.tsLiteralType(t.stringLiteral(name.name)),
      ),
    ]),
  );
}

/** `list.method(...)`, also on an optional chain (`value?.split(' ').map(...)`). */
function isMethodCall(node, method) {
  return (
    (t.isCallExpression(node) || t.isOptionalCallExpression(node)) &&
    (t.isMemberExpression(node.callee) || t.isOptionalMemberExpression(node.callee)) &&
    !node.callee.computed &&
    t.isIdentifier(node.callee.property, { name: method })
  );
}

/**
 * React's `key` on an element that is not a list's item remounts the element when the key
 * changes. A one-item keyed list does that in Solid: `<For each={[key]}>{() => <Element />}</For>`.
 * A list's items (a `.map` callback's or a render function's result) keep `For`'s own keys.
 */
function identityKeysToFor(programPath, imports) {
  const isListItem = (path) => {
    const fn = path.getFunctionParent();
    if (!fn) {
      return false;
    }
    const parent = fn.parentPath;
    const mapped = isMethodCall(parent.node, 'map') || isMethodCall(parent.node, 'flatMap');
    return mapped || parent.isJSXExpressionContainer() || parent.isJSXAttribute();
  };
  programPath.traverse({
    JSXElement: {
      exit(path) {
        const opening = path.node.openingElement;
        const key = opening.attributes.find(
          (attribute) =>
            t.isJSXAttribute(attribute) &&
            t.isJSXIdentifier(attribute.name, { name: 'key' }) &&
            t.isJSXExpressionContainer(attribute.value),
        );
        if (!key || isListItem(path)) {
          return;
        }
        opening.attributes = opening.attributes.filter((attribute) => attribute !== key);
        imports.add('solid-js', 'For');
        path.replaceWith(
          t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('For'), [
              t.jsxAttribute(
                t.jsxIdentifier('each'),
                t.jsxExpressionContainer(t.arrayExpression([key.value.expression])),
              ),
            ]),
            t.jsxClosingElement(t.jsxIdentifier('For')),
            [t.jsxExpressionContainer(t.arrowFunctionExpression([], path.node))],
          ),
        );
        path.skip();
      },
    },
  });
}

function transformJsx(programPath, ctx) {
  const { imports, reactNames, refs } = ctx;
  identityKeysToFor(programPath, imports);
  // The callbacks whose parameters a removed `key` read.
  const keyCallbacks = new Set();

  /** Rewrites one attribute to Solid's (returns false when it is removed). */
  const convertAttribute = (attributePath, element) => {
    const attribute = attributePath.node;
    if (!t.isJSXIdentifier(attribute.name)) {
      return;
    }
    const name = attribute.name.name;
    const value = attribute.value;
    // `key` is React's reconciliation hint; `suppressHydrationWarning` silences React's checks.
    if (name === 'key' || name === 'suppressHydrationWarning') {
      attributePath.traverse({
        Identifier(identifierPath) {
          const binding = identifierPath.scope.getBinding(identifierPath.node.name);
          if (binding?.kind === 'param') {
            keyCallbacks.add(binding.scope.block);
          }
        },
      });
      attributePath.remove();
      return;
    }
    if (DOM_ATTRIBUTES[name]) {
      attribute.name = t.jsxIdentifier(DOM_ATTRIBUTES[name]);
      return;
    }
    if (name === 'dangerouslySetInnerHTML' && t.isJSXExpressionContainer(value)) {
      const html = value.expression.properties?.find((property) => property.key?.name === '__html');
      if (html) {
        attributePath.replaceWith(
          t.jsxAttribute(t.jsxIdentifier('innerHTML'), t.jsxExpressionContainer(html.value)),
        );
      }
      return;
    }
    if (name === 'style' && t.isJSXExpressionContainer(value)) {
      const style = value.expression;
      if (isStaticStyle(style)) {
        // A literal style with literal values converts as React would write it: CSS property
        // names, and pixels for a number.
        for (const property of style.properties) {
          const key = property.key.name;
          if (t.isNumericLiteral(property.value) && !UNITLESS.has(key)) {
            property.value = t.stringLiteral(
              property.value.value === 0 ? '0' : `${property.value.value}px`,
            );
          }
          if (/[A-Z]/.test(key)) {
            property.key = t.stringLiteral(kebab(key));
          }
        }
      } else if (ctx.standalone && t.isObjectExpression(style)) {
        // Code users copy (a demo) converts what it can as written: literal keys, literal numbers.
        // A spread style is an object, as React types it (Solid's may be a string).
        for (const property of style.properties) {
          if (t.isSpreadElement(property)) {
            imports.add('@solidjs/web', 'JSX', true);
            property.argument = t.tsAsExpression(
              property.argument,
              t.tsTypeReference(
                t.tsQualifiedName(t.identifier('JSX'), t.identifier('CSSProperties')),
              ),
            );
          }
        }
        for (const property of style.properties) {
          if (!t.isObjectProperty(property) || property.computed || !t.isIdentifier(property.key)) {
            continue;
          }
          const key = property.key.name;
          if (t.isNumericLiteral(property.value) && !UNITLESS.has(key)) {
            property.value = t.stringLiteral(
              property.value.value === 0 ? '0' : `${property.value.value}px`,
            );
          }
          if (/[A-Z]/.test(key)) {
            property.key = t.stringLiteral(kebab(key));
          }
        }
      } else if (!ctx.standalone && !t.isStringLiteral(style) && !t.isTemplateLiteral(style)) {
        // Anything else (a variable, a spread, a value computed at runtime, a function of the
        // state) converts when it is read.
        imports.add(REACT_ADAPTERS, 'reactStyle');
        value.expression = t.callExpression(t.identifier('reactStyle'), [style]);
      }
      return;
    }
    if (
      name === 'ref' &&
      t.isJSXExpressionContainer(value) &&
      t.isIdentifier(value.expression) &&
      refs.has(value.expression.name)
    ) {
      const target = t.identifier('element');
      attribute.value = t.jsxExpressionContainer(
        t.arrowFunctionExpression(
          [target],
          t.blockStatement([
            t.expressionStatement(
              t.assignmentExpression(
                '=',
                t.memberExpression(t.identifier(value.expression.name), t.identifier('current')),
                target,
              ),
            ),
          ]),
        ),
      );
      return;
    }
    // Any other React ref may be an object (`{ current }`), which Solid's `ref` does not assign.
    if (
      name === 'ref' &&
      !ctx.standalone &&
      t.isJSXExpressionContainer(value) &&
      !t.isJSXEmptyExpression(value.expression) &&
      !isFunctionNode(value.expression) &&
      !(
        t.isCallExpression(value.expression) &&
        t.isIdentifier(value.expression.callee, { name: 'captureRef' })
      )
    ) {
      imports.add(REACT_ADAPTERS, 'reactRef');
      value.expression = t.callExpression(t.identifier('reactRef'), [value.expression]);
      return;
    }
    // React writes a boolean `aria-*` value as text; Solid writes `true` as an empty attribute.
    if (/^aria-/.test(name) && t.isJSXExpressionContainer(value)) {
      const text = (node) => {
        if (t.isBooleanLiteral(node)) {
          return t.stringLiteral(String(node.value));
        }
        if (
          t.isLogicalExpression(node, { operator: '||' }) &&
          t.isIdentifier(node.right, { name: 'undefined' })
        ) {
          return t.conditionalExpression(node.left, t.stringLiteral('true'), node.right);
        }
        if (t.isConditionalExpression(node)) {
          return t.conditionalExpression(node.test, text(node.consequent), text(node.alternate));
        }
        return node;
      };
      value.expression = text(value.expression);
    }
    // React 19 calls a form's function `action` with the form's data on submit; Solid's `action`
    // is a URL. Base UI's Form renders such a form.
    if (
      name === 'action' &&
      (t.isJSXIdentifier(element.name, { name: 'form' }) ||
        t.isJSXIdentifier(element.name, { name: 'Form' })) &&
      t.isJSXExpressionContainer(value) &&
      !t.isStringLiteral(value.expression) &&
      !t.isTemplateLiteral(value.expression)
    ) {
      const event = t.identifier('event');
      event.typeAnnotation = t.tsTypeAnnotation(
        t.tsIntersectionType([
          t.tsTypeReference(t.identifier('SubmitEvent')),
          t.tsTypeLiteral([
            t.tsPropertySignature(
              t.identifier('currentTarget'),
              t.tsTypeAnnotation(t.tsTypeReference(t.identifier('HTMLFormElement'))),
            ),
          ]),
        ]),
      );
      attribute.name = t.jsxIdentifier('onSubmit');
      attribute.value = t.jsxExpressionContainer(
        t.arrowFunctionExpression(
          [event],
          t.blockStatement([
            t.expressionStatement(
              t.callExpression(
                t.memberExpression(t.identifier('event'), t.identifier('preventDefault')),
                [],
              ),
            ),
            t.expressionStatement(
              t.callExpression(value.expression, [
                t.newExpression(t.identifier('FormData'), [
                  t.memberExpression(t.identifier('event'), t.identifier('currentTarget')),
                ]),
              ]),
            ),
          ]),
        ),
      );
      return;
    }
    const renamed = solidAttributeName(name, element, ctx);
    if (renamed !== name) {
      const [namespace, local] = renamed.split(':');
      attribute.name = local
        ? t.jsxNamespacedName(t.jsxIdentifier(namespace), t.jsxIdentifier(local))
        : t.jsxIdentifier(renamed);
    }
    // React renders a bare `aria-*` as "true"; Solid renders "", which reads as unset.
    if (value == null && /^aria-/.test(name)) {
      attribute.value = Object.assign(t.stringLiteral('true'), {
        extra: { raw: '"true"', rawValue: 'true' },
      });
    }
  };

  // A component's props: its first parameter, or the props it reads without the ref.
  const isProps = (binding) =>
    Boolean(
      binding &&
      ((binding.kind === 'param' &&
        binding.path.key === 0 &&
        isComponentName(functionName(binding.path.parentPath))) ||
        binding.path.parentPath?.node.solidProps),
    );
  // A native element binds its handler once, where React binds the current one each render: a
  // handler prop is called when the event fires, as its value then.
  const bindHandlerProp = (attributePath, element) => {
    const { name, value } = attributePath.node;
    if (
      !t.isJSXIdentifier(element.name) ||
      !/^[a-z]/.test(element.name.name) ||
      !t.isJSXIdentifier(name) ||
      !/^on[A-Z]/.test(name.name) ||
      !t.isJSXExpressionContainer(value)
    ) {
      return;
    }
    const handler = value.expression;
    if (
      t.isMemberExpression(handler) &&
      !handler.computed &&
      t.isIdentifier(handler.object) &&
      isProps(attributePath.scope.getBinding(handler.object.name))
    ) {
      value.expression = t.arrowFunctionExpression(
        [t.identifier('event')],
        t.optionalCallExpression(handler, [t.identifier('event')], true),
      );
    }
  };

  // eslint-plugin-solid takes a component's async event handler for an async tracked scope; the
  // component calls it as a handler, untracked.
  const allowAsyncHandler = (attributePath, element) => {
    const { name, value } = attributePath.node;
    if (
      ctx.linted &&
      !(t.isJSXIdentifier(element.name) && /^[a-z]/.test(element.name.name)) &&
      t.isJSXIdentifier(name) &&
      /^on[A-Z]/.test(name.name) &&
      t.isJSXExpressionContainer(value) &&
      isFunctionNode(value.expression) &&
      value.expression.async
    ) {
      t.addComment(
        attributePath.node,
        'leading',
        ' eslint-disable-next-line solid/reactivity -- an event handler (eslint-plugin-solid#168)',
        true,
      );
    }
  };

  programPath.traverse({
    JSXOpeningElement(path) {
      for (const attributePath of path.get('attributes')) {
        if (attributePath.isJSXAttribute()) {
          convertAttribute(attributePath, path.node);
          if (!attributePath.removed) {
            bindHandlerProp(attributePath, path.node);
            allowAsyncHandler(attributePath, path.node);
          }
        }
      }
      // A context provider passes its value as an accessor (see the header).
      const name = path.node.name;
      if (!isContextProvider(name, path, ctx)) {
        return;
      }
      for (const attribute of path.node.attributes) {
        if (
          t.isJSXAttribute(attribute) &&
          t.isJSXIdentifier(attribute.name, { name: 'value' }) &&
          attribute.value
        ) {
          const expression = t.isJSXExpressionContainer(attribute.value)
            ? attribute.value.expression
            : t.stringLiteral(attribute.value.value);
          const isRead =
            t.isCallExpression(expression) &&
            t.isIdentifier(expression.callee) &&
            expression.arguments.length === 0;
          attribute.value = t.jsxExpressionContainer(
            isRead ? expression.callee : t.arrowFunctionExpression([], expression),
          );
        }
      }
    },
    JSXAttribute: {
      exit(path) {
        // A render element becomes a render config, once its own attributes are Solid's.
        if (!t.isJSXIdentifier(path.node.name, { name: 'render' })) {
          return;
        }
        const value = path.node.value;
        const element = t.isJSXExpressionContainer(value) ? value.expression : value;
        // `render={cond ? <a /> : <Link />}`: each element the value can be becomes a config.
        const toConfig = (node) => {
          if (t.isJSXElement(node)) {
            return renderElementToConfig(node, imports);
          }
          if (isElementCall(node) && t.isJSXElement(node.arguments[0].body)) {
            return renderElementToConfig(node.arguments[0].body, imports);
          }
          if (t.isConditionalExpression(node)) {
            node.consequent = toConfig(node.consequent);
            node.alternate = toConfig(node.alternate);
          } else if (t.isLogicalExpression(node)) {
            if (node.operator !== '&&') {
              node.left = toConfig(node.left);
            }
            node.right = toConfig(node.right);
          } else if (t.isParenthesizedExpression(node)) {
            node.expression = toConfig(node.expression);
          }
          return node;
        };
        if (element && !t.isJSXEmptyExpression(element)) {
          path.node.value = t.jsxExpressionContainer(toConfig(element));
          // The element's lint rules have no element left to check.
          rewriteLintDirectives(
            path.node,
            (rule) => (rule.startsWith('jsx-a11y/') ? null : rule),
            programPath.node,
          );
        }
      },
    },
    JSXElement(path) {
      const name = path.node.openingElement.name;
      // React's capture-phase handlers become capture listeners given with the element's ref.
      if (!ctx.standalone) {
        captureHandlersToRef(path.node.openingElement, imports);
      }
      // A tag that may be a tag name (`const Pre = components.pre ?? 'pre'`) renders through
      // `<Dynamic>`, as React renders a string type as an element.
      if (t.isJSXIdentifier(name) && /^[A-Z]/.test(name.name)) {
        const binding = path.scope.getBinding(name.name);
        const init = binding?.path.isVariableDeclarator() ? binding.path.node.init : null;
        if (init && mayBeTagName(init)) {
          imports.add('@solidjs/web', 'Dynamic');
          path.node.openingElement.attributes.unshift(
            t.jsxAttribute(
              t.jsxIdentifier('component'),
              t.jsxExpressionContainer(t.identifier(name.name)),
            ),
          );
          path.node.openingElement.name = t.jsxIdentifier('Dynamic');
          if (path.node.closingElement) {
            path.node.closingElement.name = t.jsxIdentifier('Dynamic');
          }
        }
      }
      // A render function Solid Base UI calls with accessors reads them through calls.
      const partName =
        t.isJSXMemberExpression(name) && t.isJSXIdentifier(name.object)
          ? `${name.object.name}.${name.property.name}`
          : null;
      // TanStack Form's Solid `form.Field` and `form.Subscribe` pass accessors too.
      const formPart =
        t.isJSXMemberExpression(name) &&
        t.isJSXIdentifier(name.object) &&
        ctx.tanstackForms.has(name.object.name) &&
        (name.property.name === 'Field' || name.property.name === 'Subscribe');
      let accessorParams = partName ? ACCESSOR_CHILD_PARAMS[partName] : null;
      if (formPart) {
        accessorParams = [0];
      }
      if (accessorParams) {
        // The render function is a child or a `children` attribute.
        const childrenAttribute = path
          .get('openingElement.attributes')
          .find(
            (attribute) =>
              attribute.isJSXAttribute() &&
              t.isJSXIdentifier(attribute.node.name, { name: 'children' }),
          );
        const containers = [
          ...path.get('children'),
          ...(childrenAttribute ? [childrenAttribute.get('value')] : []),
        ];
        for (const childPath of containers) {
          const fnPath = childPath.isJSXExpressionContainer() ? childPath.get('expression') : null;
          if (!fnPath?.isFunction()) {
            continue;
          }
          for (const index of accessorParams) {
            const param = fnPath.node.params[index];
            if (!t.isIdentifier(param)) {
              continue;
            }
            const binding = fnPath.scope.getBinding(param.name);
            for (const reference of binding?.referencePaths ?? []) {
              if (!inTypePosition(reference)) {
                reference.replaceWith(t.callExpression(t.identifier(param.name), []));
              }
            }
            if (param.typeAnnotation) {
              param.typeAnnotation = t.tsTypeAnnotation(
                accessorType(param.typeAnnotation.typeAnnotation, imports),
              );
            }
          }
        }
      }
      // A Next root layout's `<head>` renders through the document adapter; one without a
      // `<head>` gets one, as Next adds it.
      if (t.isJSXIdentifier(name, { name: 'html' })) {
        const hasHead = path.node.children.some(
          (child) =>
            t.isJSXElement(child) && t.isJSXIdentifier(child.openingElement.name, { name: 'head' }),
        );
        if (!hasHead) {
          path.node.children.unshift(
            t.jsxElement(t.jsxOpeningElement(t.jsxIdentifier('head'), [], true), null, [], true),
          );
        }
      }
      if (t.isJSXIdentifier(name, { name: 'head' }) && path.parentPath.isJSXElement()) {
        imports.add(NEXT_DOCUMENT, 'Head');
        name.name = 'Head';
        if (path.node.closingElement) {
          path.node.closingElement.name = t.jsxIdentifier('Head');
        }
      }
      const isFragment =
        (t.isJSXMemberExpression(name) &&
          t.isJSXIdentifier(name.object) &&
          reactNames.namespaces.has(name.object.name) &&
          name.property.name === 'Fragment') ||
        (t.isJSXIdentifier(name) && reactNames.named.get(name.name) === 'Fragment');
      const component = (() => {
        if (
          t.isJSXMemberExpression(name) &&
          t.isJSXIdentifier(name.object) &&
          reactNames.namespaces.has(name.object.name)
        ) {
          return name.property.name;
        }
        return t.isJSXIdentifier(name) ? (reactNames.named.get(name.name) ?? null) : null;
      })();
      if (isFragment || component === 'StrictMode') {
        path.replaceWith(
          t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), path.node.children),
        );
      } else if (component === 'Suspense') {
        imports.add('solid-js', 'Loading');
        path.node.openingElement.name = t.jsxIdentifier('Loading');
        if (path.node.closingElement) {
          path.node.closingElement.name = t.jsxIdentifier('Loading');
        }
      }
    },
    JSXMemberExpression: {
      exit(path) {
        // `<Context.Provider>` renders as `<Context>`.
        if (isContextProvider(path.node, path, ctx)) {
          path.replaceWith(path.node.object);
        }
      },
    },
    JSXExpressionContainer(path) {
      const expression = path.node.expression;
      if (!t.isJSXElement(path.parent) && !t.isJSXFragment(path.parent)) {
        return;
      }
      if (
        isMethodCall(expression, 'map') &&
        expression.arguments.length >= 1 &&
        (t.isArrowFunctionExpression(expression.arguments[0]) ||
          t.isFunctionExpression(expression.arguments[0]))
      ) {
        imports.add('solid-js', 'For');
        const callbackPath = path.get('expression.arguments.0');
        // `<For>` passes no list: the callback's third argument reads the list it renders.
        const listParam = callbackPath.node.params[2];
        if (t.isIdentifier(listParam)) {
          for (const reference of callbackPath.scope.getBinding(listParam.name)?.referencePaths ??
            []) {
            const list = t.cloneNode(expression.callee.object, true);
            // The callback runs for an item of the list, so an optional chain's list is there; the
            // fallback only types it so.
            reference.replaceWith(
              t.isOptionalCallExpression(list) || t.isOptionalMemberExpression(list)
                ? t.logicalExpression('??', list, t.arrayExpression([]))
                : list,
            );
          }
          callbackPath.node.params.splice(2);
        }
        // `<For>` passes the index as an accessor.
        const indexParam = callbackPath.node.params[1];
        if (t.isIdentifier(indexParam)) {
          const binding = callbackPath.scope.getBinding(indexParam.name);
          for (const reference of binding?.referencePaths ?? []) {
            if (!inTypePosition(reference)) {
              reference.replaceWith(t.callExpression(t.identifier(indexParam.name), []));
            }
          }
          indexParam.typeAnnotation = null;
        }
        // React runs the callback on every render; `For` runs it once per item. A callback that
        // computes values before its JSX renders from a memo of its body, so they stay current.
        const callback = callbackPath.node;
        if (t.isBlockStatement(callback.body) && callback.body.body.length > 1) {
          imports.add('solid-js', 'createMemo');
          const row = callbackPath.scope.generateUidIdentifier('row');
          callback.body = t.blockStatement([
            constDeclaration(
              row,
              t.callExpression(t.identifier('createMemo'), [
                t.arrowFunctionExpression([], callback.body),
              ]),
            ),
            t.returnStatement(
              t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), [
                t.jsxExpressionContainer(t.callExpression(t.identifier(row.name), [])),
              ]),
            ),
          ]);
        }
        const forElement = t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier('For'), [
            t.jsxAttribute(
              t.jsxIdentifier('each'),
              t.jsxExpressionContainer(expression.callee.object),
            ),
          ]),
          t.jsxClosingElement(t.jsxIdentifier('For')),
          [t.jsxExpressionContainer(expression.arguments[0])],
        );
        path.replaceWith(forElement);
      }
    },
  });

  // A callback parameter only the removed `key` read is unused now; trailing ones go.
  if (keyCallbacks.size > 0) {
    programPath.scope.crawl();
    programPath.traverse({
      Function(path) {
        if (!keyCallbacks.has(path.node)) {
          return;
        }
        const { params } = path.node;
        while (
          params.length > 0 &&
          t.isIdentifier(params.at(-1)) &&
          !path.scope.getBinding(params.at(-1).name)?.referenced
        ) {
          params.pop();
        }
      },
    });
  }
}

// DOM events React's synthetic events wrap; a Solid handler receives the native event.
const DOM_EVENTS = new Set([
  'AnimationEvent',
  'ClipboardEvent',
  'DragEvent',
  'FocusEvent',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'TouchEvent',
  'TransitionEvent',
  'UIEvent',
  'WheelEvent',
]);
const GENERIC_EVENTS = new Set([
  'ChangeEvent',
  'FormEvent',
  'SyntheticEvent',
  'BaseSyntheticEvent',
]);

/** A local name for an imported type that does not clash with a declaration in the file. */
function freeName(programPath, name) {
  const declared = programPath.node.body.some(
    (statement) =>
      ((t.isTSTypeAliasDeclaration(statement) || t.isTSInterfaceDeclaration(statement)) &&
        statement.id.name === name) ||
      (t.isExportNamedDeclaration(statement) &&
        (t.isTSTypeAliasDeclaration(statement.declaration) ||
          t.isTSInterfaceDeclaration(statement.declaration)) &&
        statement.declaration.id.name === name),
  );
  return declared || programPath.scope.hasBinding(name) ? `Solid${name}` : name;
}

function transformTypes(programPath, ctx) {
  const { imports, reactNames } = ctx;
  const reactType = (typeName) => {
    if (
      t.isTSQualifiedName(typeName) &&
      t.isIdentifier(typeName.left) &&
      reactNames.namespaces.has(typeName.left.name)
    ) {
      return typeName.right.name;
    }
    // `import type { ReactNode } from 'react'`
    return t.isIdentifier(typeName) ? (reactNames.named.get(typeName.name) ?? null) : null;
  };
  // A style object typed as React's (`const hidden: React.CSSProperties = { height: 1 }`) takes
  // CSS property names and pixels for a number, as React writes it.
  programPath.traverse({
    VariableDeclarator(path) {
      const annotation = path.node.id.typeAnnotation?.typeAnnotation;
      if (
        t.isTSTypeReference(annotation) &&
        reactType(annotation.typeName) === 'CSSProperties' &&
        t.isObjectExpression(path.node.init)
      ) {
        convertStyleObject(path.node.init);
      }
    },
  });
  const params = (node) => node.typeParameters?.params ?? [];
  const solidType = (name) => {
    const local = freeName(programPath, name);
    imports.add('solid-js', name, true, local);
    return t.identifier(local);
  };
  const jsxType = (member) => {
    imports.add('@solidjs/web', 'JSX', true);
    return t.tsQualifiedName(t.identifier('JSX'), t.identifier(member));
  };
  const reference = (typeName, typeParams) =>
    t.tsTypeReference(
      typeName,
      typeParams.length ? t.tsTypeParameterInstantiation(typeParams) : null,
    );

  // `ReturnType<typeof useHook>` types a corpus hook's value; the Solid hook returns an accessor.
  const isCorpusHookName = (path, name) => {
    if (!HOOK_NAME.test(name)) {
      return false;
    }
    const binding = path.scope.getBinding(name);
    if (!binding) {
      return false;
    }
    return binding.kind === 'module'
      ? ctx.corpusImports.has(name)
      : binding.path.isFunctionDeclaration() || binding.path.isVariableDeclarator();
  };
  programPath.traverse({
    // `Props['onClick']` is a function in React; Solid's handler type is also a `[handler, data]`
    // pair, which React code does not call or take `Parameters` of.
    TSIndexedAccessType(path) {
      const index = path.node.indexType;
      if (
        t.isTSLiteralType(index) &&
        t.isStringLiteral(index.literal) &&
        /^on[A-Z]/.test(index.literal.value) &&
        !(
          t.isTSTypeReference(path.parent) &&
          t.isIdentifier(path.parent.typeName, { name: 'Extract' })
        )
      ) {
        const fn = t.tsFunctionType(
          null,
          [
            Object.assign(t.restElement(t.identifier('args')), {
              typeAnnotation: t.tsTypeAnnotation(t.tsNeverKeyword()),
            }),
          ],
          t.tsTypeAnnotation(t.tsUnknownKeyword()),
        );
        // Keeps `undefined` (an optional prop), as React's type has it.
        path.replaceWith(
          reference(t.identifier('Extract'), [
            path.node,
            t.tsUnionType([fn, t.tsNullKeyword(), t.tsUndefinedKeyword()]),
          ]),
        );
        path.skip();
      }
    },
    TSTypeReference(path) {
      const [query] = params(path.node);
      if (
        t.isIdentifier(path.node.typeName, { name: 'ReturnType' }) &&
        t.isTSTypeQuery(query) &&
        t.isIdentifier(query.exprName) &&
        !query.typeParameters &&
        isCorpusHookName(path, query.exprName.name)
      ) {
        path.node.typeParameters = t.tsTypeParameterInstantiation([
          t.tsTypeReference(t.identifier('ReturnType'), t.tsTypeParameterInstantiation([query])),
        ]);
        path.skip();
      }
    },
  });

  // React types an element's event handler props as functions; Solid's also take a
  // `[handler, data]` pair. The docs runtime's `ReactProps` keeps React's.
  const isPropsType = (name) =>
    name.endsWith('HTMLAttributes') ||
    name === 'SVGProps' ||
    name === 'DOMAttributes' ||
    name.startsWith('ComponentProps');
  const reactProps = (name, typeNode) => {
    if (ctx.standalone || !isPropsType(name)) {
      return typeNode;
    }
    imports.add(REACT_ADAPTERS, 'ReactProps', true);
    return reference(t.identifier('ReactProps'), [typeNode]);
  };
  programPath.traverse({
    // `interface X extends React.ComponentProps<'button'>`
    TSExpressionWithTypeArguments(path) {
      const name = reactType(path.node.expression);
      if (!name) {
        return;
      }
      let expression = null;
      if (name.endsWith('HTMLAttributes')) {
        expression = jsxType(solidHtmlAttributes(name));
      } else if (REACT_TYPES[name]) {
        const mapped = REACT_TYPES[name];
        imports.add('@solidjs/web', mapped.name, true);
        expression = mapped.member
          ? t.tsQualifiedName(t.identifier(mapped.name), t.identifier(mapped.member))
          : t.identifier(mapped.name);
      }
      if (!expression) {
        return;
      }
      const mapped = reactProps(name, reference(expression, params(path.node)));
      if (t.isTSTypeReference(mapped) && mapped.typeName !== expression) {
        path.node.expression = mapped.typeName;
        path.node.typeParameters = mapped.typeParameters;
      } else {
        path.node.expression = expression;
      }
    },
    TSTypeReference: {
      exit(path) {
        const name = reactType(path.node.typeName);
        if (!name) {
          return;
        }
        const args = params(path.node);
        // React's `MouseEvent<T = Element>` types its `currentTarget` as `T`, as Solid's handler
        // event does.
        // Its `ChangeEvent<T>` types the `target` as `T` too.
        const withTarget = (eventType) =>
          t.tsIntersectionType([
            eventType,
            t.tsTypeLiteral([
              t.tsPropertySignature(
                t.identifier('currentTarget'),
                t.tsTypeAnnotation(args[0] ?? t.tsTypeReference(t.identifier('Element'))),
              ),
              t.tsPropertySignature(
                t.identifier('target'),
                t.tsTypeAnnotation(
                  name === 'ChangeEvent' && args[0]
                    ? t.cloneNode(args[0], true)
                    : t.tsTypeReference(t.identifier('Element')),
                ),
              ),
            ]),
          ]);
        // `MouseEventHandler<T>`: a handler of the event on `T`. React declares its handlers
        // bivariant in their event; the docs runtime's are too.
        const handlerOf = /^(\w*Event)Handler$/.exec(name);
        if (handlerOf && name !== 'EventHandler') {
          const eventName = DOM_EVENTS.has(handlerOf[1]) ? handlerOf[1] : 'Event';
          const target = args[0] ?? t.tsTypeReference(t.identifier('Element'));
          const event = t.tsTypeReference(t.identifier(eventName));
          if (ctx.standalone) {
            path.replaceWith(reference(jsxType('EventHandler'), [target, event]));
          } else {
            imports.add(REACT_ADAPTERS, 'ReactEventHandler', true);
            path.replaceWith(reference(t.identifier('ReactEventHandler'), [target, event]));
          }
          return;
        }
        if (name === 'EventHandler' && args[0]) {
          path.replaceWith(
            t.tsFunctionType(
              null,
              [
                Object.assign(t.identifier('event'), {
                  typeAnnotation: t.tsTypeAnnotation(args[0]),
                }),
              ],
              t.tsTypeAnnotation(t.tsVoidKeyword()),
            ),
          );
          return;
        }
        if (DOM_EVENTS.has(name)) {
          path.replaceWith(withTarget(t.tsTypeReference(t.identifier(name))));
        } else if (GENERIC_EVENTS.has(name)) {
          path.replaceWith(withTarget(t.tsTypeReference(t.identifier('Event'))));
        } else if (name === 'PropsWithChildren') {
          path.replaceWith(reference(solidType('ParentProps'), args));
        } else if (
          (name === 'ComponentType' || name === 'FC' || name === 'FunctionComponent') &&
          !ctx.standalone
        ) {
          // React's takes any props type; Solid's `Component` only an object type.
          imports.add(REACT_ADAPTERS, 'ComponentType', true);
          path.replaceWith(reference(t.identifier('ComponentType'), args));
        } else if (name === 'ComponentType' || name === 'FC' || name === 'FunctionComponent') {
          path.replaceWith(reference(solidType('Component'), args));
        } else if (name === 'Dispatch' && args.length === 1) {
          // React's own shapes: a function implements them, and a Solid setter is one.
          path.replaceWith(
            t.tsFunctionType(
              null,
              [
                Object.assign(t.identifier('value'), {
                  typeAnnotation: t.tsTypeAnnotation(args[0]),
                }),
              ],
              t.tsTypeAnnotation(t.tsVoidKeyword()),
            ),
          );
        } else if (name === 'EffectCallback') {
          // React's: `() => void | Destructor`.
          path.replaceWith(
            t.tsFunctionType(
              null,
              [],
              t.tsTypeAnnotation(
                t.tsUnionType([
                  t.tsVoidKeyword(),
                  t.tsParenthesizedType(
                    t.tsFunctionType(null, [], t.tsTypeAnnotation(t.tsVoidKeyword())),
                  ),
                ]),
              ),
            ),
          );
        } else if (name === 'DependencyList') {
          path.replaceWith(t.tsTypeOperator(t.tsArrayType(t.tsUnknownKeyword()), 'readonly'));
        } else if (name === 'SetStateAction' && args.length === 1) {
          path.replaceWith(
            t.tsUnionType([
              args[0],
              t.tsParenthesizedType(
                t.tsFunctionType(
                  null,
                  [
                    Object.assign(t.identifier('prev'), {
                      typeAnnotation: t.tsTypeAnnotation(t.cloneNode(args[0], true)),
                    }),
                  ],
                  t.tsTypeAnnotation(t.cloneNode(args[0], true)),
                ),
              ),
            ]),
          );
        } else if ((name === 'Ref' || name === 'ForwardedRef') && !ctx.standalone) {
          // A React ref may be an object; the docs runtime's `Ref` keeps React's shape.
          imports.add(REACT_ADAPTERS, 'Ref', true);
          path.replaceWith(reference(t.identifier('Ref'), args));
        } else if (name === 'Ref' || name === 'ForwardedRef' || name === 'RefCallback') {
          path.replaceWith(reference(solidType('Ref'), args));
        } else if (name === 'RefObject' || name === 'MutableRefObject') {
          path.replaceWith(
            t.tsTypeLiteral([
              t.tsPropertySignature(t.identifier('current'), t.tsTypeAnnotation(args[0])),
            ]),
          );
        } else if (name === 'SVGProps') {
          path.replaceWith(reactProps(name, reference(jsxType('SvgSVGAttributes'), args)));
        } else if (name.endsWith('HTMLAttributes')) {
          path.replaceWith(reactProps(name, reference(jsxType(solidHtmlAttributes(name)), args)));
        } else if (REACT_TYPES[name]) {
          const mapped = REACT_TYPES[name];
          imports.add('@solidjs/web', mapped.name, true);
          path.replaceWith(
            reactProps(
              name,
              reference(
                mapped.member
                  ? t.tsQualifiedName(t.identifier(mapped.name), t.identifier(mapped.member))
                  : t.identifier(mapped.name),
                // `ValidComponent` and `JSX.Element` take no type arguments.
                mapped.name === 'ValidComponent' || mapped.member === 'Element' ? [] : args,
              ),
            ),
          );
        }
      },
    },
  });
}

/** Renames `props.className` and `props.htmlFor` reads. */
/** Whether a binding holds a component's props (its parameter, or `merge`/`omit` of them). */
function isPropsBinding(binding) {
  if (!binding) {
    return false;
  }
  if (binding.kind === 'param') {
    const fn = binding.path.parentPath;
    return (
      binding.path.listKey === 'params' &&
      binding.path.key === 0 &&
      isComponentName(functionName(fn))
    );
  }
  const init = binding.path.isVariableDeclarator() ? binding.path.node.init : null;
  return (
    t.isCallExpression(init) &&
    t.isIdentifier(init.callee) &&
    (init.callee.name === 'omit' || init.callee.name === 'merge')
  );
}

/**
 * A component typed with an element's props (`ComponentProps<'button'>`) that spreads them onto
 * another component (a Base UI part) types them as React does: the ref a callback of the element or
 * `null` (React and Base UI parts call refs so; Solid's element ref never gets `null`), and `style`
 * an object (Solid's element style also takes a string). The docs runtime's `ReactProps` already
 * types them so.
 */
function typeSpreadElementRefs(programPath, ctx) {
  if (!ctx.standalone) {
    return;
  }
  programPath.traverse({
    Function(fnPath) {
      const [param] = fnPath.node.params;
      const annotation = t.isIdentifier(param) ? param.typeAnnotation?.typeAnnotation : null;
      const [tag] = annotation?.typeParameters?.params ?? [];
      if (
        !t.isTSTypeReference(annotation) ||
        !t.isIdentifier(annotation.typeName, { name: 'ComponentProps' }) ||
        !t.isTSLiteralType(tag) ||
        !t.isStringLiteral(tag.literal)
      ) {
        return;
      }
      let spreadOntoComponent = false;
      fnPath.traverse({
        JSXSpreadAttribute(spreadPath) {
          const name = spreadPath.parentPath.node.name;
          const component = !(t.isJSXIdentifier(name) && /^[a-z]/.test(name.name));
          const argument = spreadPath.node.argument;
          const binding = t.isIdentifier(argument)
            ? spreadPath.scope.getBinding(argument.name)
            : null;
          if (component && (argument.name === param.name || isPropsBinding(binding))) {
            spreadOntoComponent = true;
            spreadPath.stop();
          }
        },
      });
      if (!spreadOntoComponent) {
        return;
      }
      const element = t.tsIndexedAccessType(
        t.tsTypeReference(t.identifier('HTMLElementTagNameMap')),
        t.tsLiteralType(t.stringLiteral(tag.literal.value)),
      );
      const ref = t.tsPropertySignature(
        t.identifier('ref'),
        t.tsTypeAnnotation(
          t.tsFunctionType(
            null,
            [
              Object.assign(t.identifier('el'), {
                typeAnnotation: t.tsTypeAnnotation(t.tsUnionType([element, t.tsNullKeyword()])),
              }),
            ],
            t.tsTypeAnnotation(t.tsVoidKeyword()),
          ),
        ),
      );
      ref.optional = true;
      // React's `style` is an object; Solid's element style also takes a string.
      ctx.imports.add('@solidjs/web', 'JSX', true);
      const style = t.tsPropertySignature(
        t.identifier('style'),
        t.tsTypeAnnotation(
          t.tsTypeReference(t.tsQualifiedName(t.identifier('JSX'), t.identifier('CSSProperties'))),
        ),
      );
      style.optional = true;
      param.typeAnnotation = t.tsTypeAnnotation(
        t.tsIntersectionType([
          t.tsTypeReference(
            t.identifier('Omit'),
            t.tsTypeParameterInstantiation([
              annotation,
              t.tsUnionType([
                t.tsLiteralType(t.stringLiteral('ref')),
                t.tsLiteralType(t.stringLiteral('style')),
              ]),
            ]),
          ),
          t.tsTypeLiteral([ref, style]),
        ]),
      );
    },
  });
}

/** Whether a type member is in a props type: one named `...Props`, or a component's parameter's. */
function isPropsType(path) {
  for (let current = path.parentPath; current; current = current.parentPath) {
    if (current.isTSInterfaceDeclaration() || current.isTSTypeAliasDeclaration()) {
      return /Props$/.test(current.node.id.name);
    }
    if (current.isFunction()) {
      return false;
    }
    if (current.parentPath?.isFunction() && current.listKey === 'params') {
      return current.key === 0 && isComponentName(functionName(current.parentPath));
    }
  }
  return false;
}

/**
 * Whether an object literal is element props: an argument of `mergeProps`, a value typed with a
 * props type (`useRender.ElementProps<'button'>`), or the `props` `useRender` is given.
 */
function isPropsObject(path) {
  const parent = path.parentPath;
  if (parent.isCallExpression() && t.isIdentifier(parent.node.callee, { name: 'mergeProps' })) {
    return path.listKey === 'arguments';
  }
  const isPropsType = (annotation) => {
    const typeName = t.isTSTypeReference(annotation) ? annotation.typeName : null;
    const last = t.isTSQualifiedName(typeName) ? typeName.right : typeName;
    return t.isIdentifier(last) && /Props$/.test(last.name);
  };
  if (parent.isVariableDeclarator() && path.key === 'init') {
    return isPropsType(parent.node.id.typeAnnotation?.typeAnnotation);
  }
  // The same value as a memo (`createMemo<useRender.ElementProps<'button'>>(() => ({ ... }))`).
  if (parent.isArrowFunctionExpression() && path.key === 'body') {
    const call = parent.parentPath;
    return Boolean(
      call.isCallExpression() &&
      t.isIdentifier(call.node.callee, { name: 'createMemo' }) &&
      isPropsType(call.node.typeParameters?.params[0]),
    );
  }
  if (
    parent.isObjectProperty() &&
    t.isIdentifier(parent.node.key, { name: 'props' }) &&
    parent.parentPath.parentPath?.isCallExpression() &&
    t.isIdentifier(parent.parentPath.parentPath.node.callee, { name: 'useRender' })
  ) {
    return true;
  }
  return false;
}

function renameDomPropReads(programPath) {
  programPath.traverse({
    // Element props written as an object take Solid's names, as JSX attributes do.
    ObjectExpression(path) {
      if (!isPropsObject(path)) {
        return;
      }
      for (const property of path.node.properties) {
        if (!t.isObjectProperty(property) && !t.isObjectMethod(property)) {
          continue;
        }
        if (property.computed || !t.isIdentifier(property.key)) {
          continue;
        }
        const solidName =
          DOM_ATTRIBUTES[property.key.name] ?? REACT_ATTRIBUTE_NAMES[property.key.name];
        if (solidName) {
          property.key = /^[A-Za-z_$][\w$]*$/.test(solidName)
            ? t.identifier(solidName)
            : t.stringLiteral(solidName);
          if (t.isObjectProperty(property)) {
            property.shorthand = false;
          }
        }
      }
    },
    // Props types declare the names the props are read by (other types keep theirs: a HAST
    // node's `className`, say).
    TSPropertySignature(path) {
      const key = path.node.key;
      let name = null;
      if (t.isIdentifier(key)) {
        name = key.name;
      } else if (t.isStringLiteral(key)) {
        name = key.value;
      }
      if (name && DOM_ATTRIBUTES[name] && isPropsType(path)) {
        path.node.key = t.identifier(DOM_ATTRIBUTES[name]);
      }
    },
    MemberExpression(path) {
      if (
        t.isIdentifier(path.node.object) &&
        t.isIdentifier(path.node.property) &&
        !path.node.computed &&
        DOM_ATTRIBUTES[path.node.property.name] &&
        (path.node.object.name === 'props' ||
          isPropsBinding(path.scope.getBinding(path.node.object.name)))
      ) {
        path.node.property = t.identifier(DOM_ATTRIBUTES[path.node.property.name]);
      }
    },
  });
}

// Module renames that hold for every docs file.
const MODULES = {
  '@base-ui/react': '@solidports/base-ui',
  '@base-ui/react/*': '@solidports/base-ui/*',
  'lucide-react': '@lucide/solid',
  '@tanstack/react-form': '@tanstack/solid-form',
};

/** Whether the transform imports `source` from another module (with the extra `modules`). */
export function mapsModule(source, modules = {}) {
  const all = { ...MODULES, ...modules };
  return mapModule(source, all) !== source;
}

/** The module an import resolves to under the renames (exact names, then `prefix/*` patterns). */
function mapModule(source, modules) {
  if (Object.hasOwn(modules, source)) {
    return modules[source];
  }
  for (const [pattern, target] of Object.entries(modules)) {
    if (pattern.endsWith('/*') && source.startsWith(pattern.slice(0, -1))) {
      return target.replace('*', source.slice(pattern.length - 1));
    }
  }
  return source;
}

const isCorpusModule = (source) =>
  CORPUS_MODULES.some(
    (prefix) =>
      source === prefix ||
      source.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`) ||
      (prefix === '.' && source.startsWith('.')),
  );

/** Rewrites the text of string literals, template parts and JSX text (not module specifiers). */
function rewriteStrings(programPath, rewrite) {
  const isModuleSource = (path) =>
    path.parentPath.isImportDeclaration() ||
    path.parentPath.isExportDeclaration() ||
    path.parentPath.isTSExternalModuleReference() ||
    (path.parentPath.isCallExpression() && t.isImport(path.parent.callee)) ||
    path.parentPath.isTSImportType();
  programPath.traverse({
    StringLiteral(path) {
      if (isModuleSource(path)) {
        return;
      }
      const value = rewrite(path.node.value);
      if (value === path.node.value) {
        return;
      }
      if (path.parentPath.isJSXAttribute()) {
        // JSX attribute strings keep their double quotes.
        path.node.value = value;
        path.node.extra = { raw: JSON.stringify(value), rawValue: value };
        return;
      }
      path.replaceWith(t.stringLiteral(value));
      path.skip();
    },
    TemplateElement(path) {
      const raw = rewrite(path.node.value.raw);
      if (raw !== path.node.value.raw) {
        path.node.value = { raw, cooked: rewrite(path.node.value.cooked ?? raw) };
      }
    },
    JSXText(path) {
      const value = rewrite(path.node.value);
      if (value !== path.node.value) {
        path.node.value = value;
        path.node.extra = { raw: value, rawValue: value };
      }
    },
  });
}

/** Renders `createPortal(children, container)` from the React DOM package as a `<Portal>`. */
function transformPortals(programPath, imports) {
  const portalNames = new Set();
  for (const statement of programPath.get('body')) {
    if (!statement.isImportDeclaration() || statement.node.source.value !== REACT_DOM) {
      continue;
    }
    const isPortal = (specifier) =>
      t.isImportSpecifier(specifier) && specifier.imported.name === 'createPortal';
    for (const specifier of statement.node.specifiers) {
      if (isPortal(specifier)) {
        portalNames.add(specifier.local.name);
      }
    }
    statement.node.specifiers = statement.node.specifiers.filter(
      (specifier) => !isPortal(specifier),
    );
    if (statement.node.specifiers.length === 0) {
      statement.remove();
    }
  }
  if (portalNames.size === 0) {
    return;
  }
  programPath.traverse({
    CallExpression(path) {
      if (!t.isIdentifier(path.node.callee) || !portalNames.has(path.node.callee.name)) {
        return;
      }
      imports.add('@solidjs/web', 'Portal');
      const [children, container] = path.node.arguments;
      const child = isJsxNode(children) ? children : t.jsxExpressionContainer(children);
      path.replaceWith(
        t.jsxElement(
          t.jsxOpeningElement(
            t.jsxIdentifier('Portal'),
            container
              ? [t.jsxAttribute(t.jsxIdentifier('mount'), t.jsxExpressionContainer(container))]
              : [],
          ),
          t.jsxClosingElement(t.jsxIdentifier('Portal')),
          [child],
        ),
      );
    },
  });
}

// Identifiers that start a TypeScript declaration where they start a statement.
const DECLARATION_KEYWORDS = new Set([
  'abstract',
  'declare',
  'enum',
  'interface',
  'module',
  'namespace',
  'type',
]);

/**
 * React Testing Library's `rerender(<Component {...next} />)` gives the rendered element new props
 * and keeps its state. Here the rendered element reads its props from a signal, and a rerender of
 * the same component sets it.
 */
function rerendersToSignals(programPath, ctx) {
  const toProps = (element) =>
    t.objectExpression(
      element.openingElement.attributes.map((attribute) => {
        if (t.isJSXSpreadAttribute(attribute)) {
          return t.spreadElement(attribute.argument);
        }
        const name = attribute.name.name;
        const key = /^[A-Za-z_$][\w$]*$/.test(name) ? t.identifier(name) : t.stringLiteral(name);
        let value = t.booleanLiteral(true);
        if (t.isStringLiteral(attribute.value)) {
          value = t.stringLiteral(attribute.value.value);
        } else if (t.isJSXExpressionContainer(attribute.value)) {
          value = attribute.value.expression;
        }
        return t.objectProperty(key, value);
      }),
    );
  programPath.traverse({
    VariableDeclarator(path) {
      const { id } = path.node;
      const call = t.isAwaitExpression(path.node.init) ? path.node.init.argument : path.node.init;
      if (!t.isObjectPattern(id) || !t.isCallExpression(call)) {
        return;
      }
      const property = id.properties.find(
        (candidate) =>
          t.isObjectProperty(candidate) &&
          t.isIdentifier(candidate.key, { name: 'rerender' }) &&
          t.isIdentifier(candidate.value),
      );
      const [rendered] = call.arguments;
      if (!property || !t.isJSXElement(rendered)) {
        return;
      }
      const sameComponent = (element) =>
        t.isJSXElement(element) &&
        t.isNodesEquivalent(element.openingElement.name, rendered.openingElement.name);
      const rerenders = (path.scope.getBinding(property.value.name)?.referencePaths ?? []).map(
        (reference) => reference.parentPath,
      );
      if (
        rerenders.some(
          (callPath) =>
            !callPath.isCallExpression() ||
            callPath.node.arguments.length !== 1 ||
            !sameComponent(callPath.node.arguments[0]),
        )
      ) {
        return;
      }
      ctx.imports.add('solid-js', 'createSignal');
      const props = path.scope.generateUidIdentifier('props');
      const setProps = path.scope.generateUidIdentifier('setProps');
      path.parentPath.insertBefore(
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.arrayPattern([props, setProps]),
            t.callExpression(t.identifier('createSignal'), [toProps(rendered)]),
          ),
        ]),
      );
      for (const callPath of rerenders) {
        callPath.replaceWith(
          t.callExpression(t.identifier(setProps.name), [toProps(callPath.node.arguments[0])]),
        );
      }
      rendered.openingElement.attributes = [
        t.jsxSpreadAttribute(t.callExpression(t.identifier(props.name), [])),
      ];
      id.properties = id.properties.filter((candidate) => candidate !== property);
      if (id.properties.length === 0) {
        path.parentPath.replaceWith(t.expressionStatement(path.node.init));
      }
    },
  });
}

// React lint rules and the Solid rules that check the same thing. Other React rules have no
// counterpart for Solid code.
const SOLID_LINT_RULES = { 'react/no-danger': 'solid/no-innerhtml' };
const REACT_LINT_RULE = /^(react|react-hooks|react-compiler|@next\/next)\//;
const LINT_DIRECTIVE =
  /^(\s*eslint-(?:disable|enable)(?:-next-line|-line)?\s+)(.*?)(\s+--.*?)?(\s*)$/s;

/**
 * Renames the rules of the ESLint directives in `root`'s comments with `rename` (null drops a
 * rule), and removes a directive left with none from `tree` (a comment can sit on several nodes).
 */
function rewriteLintDirectives(root, rename, tree = root) {
  const removed = new Set();
  t.traverseFast(root, (node) => {
    for (const key of ['leadingComments', 'trailingComments', 'innerComments']) {
      for (const comment of node[key] ?? []) {
        const match = LINT_DIRECTIVE.exec(comment.value);
        if (!match || removed.has(comment)) {
          continue;
        }
        const rules = match[2]
          .split(',')
          .map((rule) => rule.trim())
          .filter(Boolean);
        const renamed = rules.map(rename).filter(Boolean);
        if (rules.length > 0 && renamed.length === 0) {
          removed.add(comment);
        } else if (rules.length > 0) {
          comment.value = `${match[1]}${renamed.join(', ')}${match[3] ?? ''}${match[4]}`;
        }
      }
    }
  });
  if (removed.size > 0) {
    t.traverseFast(tree, (node) => {
      for (const key of ['leadingComments', 'trailingComments', 'innerComments']) {
        if (node[key]) {
          node[key] = node[key].filter((comment) => !removed.has(comment));
        }
      }
    });
  }
}

/** Writes `{ name: name }`, which the rewrites build, as `{ name }`, as the source writes it. */
function shorthandProperties(programPath) {
  programPath.traverse({
    ObjectProperty(path) {
      const { node } = path;
      if (
        !node.computed &&
        t.isIdentifier(node.key) &&
        t.isIdentifier(node.value) &&
        node.key.name === node.value.name &&
        !t.isObjectPattern(path.parent)
      ) {
        node.shorthand = true;
      }
    },
  });
}

/** Moves the file's header comments back above its first statement (imports go above them). */
function keepHeaderComments(programPath, header) {
  const [first] = programPath.node.body;
  if (header.length === 0 || !first) {
    return;
  }
  const comments = new Set(header);
  t.traverseFast(programPath.node, (node) => {
    for (const key of ['leadingComments', 'trailingComments', 'innerComments']) {
      if (node[key]) {
        node[key] = node[key].filter((comment) => !comments.has(comment));
      }
    }
  });
  first.leadingComments = [...header, ...(first.leadingComments ?? [])];
}

/**
 * Parenthesizes an expression statement that starts with a TypeScript declaration keyword
 * (`(type satisfies Node);`), as the source did: the printer drops the parentheses, and without
 * them the statement parses as a declaration.
 */
function keepStatementParentheses(programPath) {
  programPath.traverse({
    ExpressionStatement(path) {
      let first = path.node.expression;
      for (;;) {
        if (t.isMemberExpression(first) || t.isOptionalMemberExpression(first)) {
          first = first.object;
        } else if (t.isCallExpression(first) || t.isOptionalCallExpression(first)) {
          first = first.callee;
        } else if (
          t.isTSSatisfiesExpression(first) ||
          t.isTSAsExpression(first) ||
          t.isTSNonNullExpression(first)
        ) {
          first = first.expression;
        } else if (t.isBinaryExpression(first) || t.isLogicalExpression(first)) {
          first = first.left;
        } else {
          break;
        }
      }
      if (t.isIdentifier(first) && DECLARATION_KEYWORDS.has(first.name)) {
        path.node.expression = t.parenthesizedExpression(path.node.expression);
      }
    },
  });
}

export function transformReactToSolid(source, options = {}) {
  const modules = { ...MODULES, ...options.modules };
  const isCorpus = options.isCorpus ?? isCorpusModule;
  const rewriteModule = options.rewriteModule ?? ((source) => source);
  const ast = parse(source, parserOptions(options.filename));
  const ctx = {
    imports: new Imports(),
    reactNames: { namespaces: new Set(), named: new Map() },
    corpusImports: new Set(),
    refs: new Set(),
    // TanStack Form's `useForm` (local name), and the forms it creates.
    tanstackUseForm: null,
    tanstackForms: new Set(),
    // A `.ts` module has no JSX to render with.
    jsx: !options.filename?.endsWith('.ts'),
    // Code users copy (demos, samples): no imports of the docs' adapters.
    standalone: Boolean(options.standalone),
    // Code the Solid docs lint.
    linted: Boolean(options.linted),
    // Prop names components declare under React's attribute names (kept on components).
    componentProps: new Map(
      Object.entries(options.componentProps ?? {}).map(([prop, components]) => [
        prop,
        new Set(components),
      ]),
    ),
    baseUiHookAliases: new Set(options.baseUiHookAliases ?? []),
  };

  traverse(ast, {
    Program(programPath) {
      // The file's header comments (a `@vitest-environment` pragma, say) stay at its top.
      const header = [...(programPath.node.body[0]?.leadingComments ?? [])];
      programPath.node.directives = programPath.node.directives.filter(
        (directive) =>
          directive.value.value !== 'use client' && directive.value.value !== 'use server',
      );
      for (const statement of programPath.get('body')) {
        if (!statement.isImportDeclaration()) {
          continue;
        }
        const importSource = statement.node.source.value;
        if (BASE_UI_UTILS_HOOKS.has(importSource)) {
          for (const specifier of statement.node.specifiers) {
            if (t.isImportSpecifier(specifier)) {
              ctx.reactNames.named.set(specifier.local.name, specifier.imported.name);
            }
          }
          statement.remove();
          continue;
        }
        if (importSource === '@tanstack/react-form') {
          // Solid's adapter creates the form from a function of the options: `createForm`.
          for (const specifier of statement.node.specifiers) {
            if (t.isImportSpecifier(specifier) && specifier.imported.name === 'useForm') {
              ctx.tanstackUseForm = specifier.local.name;
              specifier.imported = t.identifier('createForm');
              specifier.local = t.identifier('createForm');
            }
          }
        }
        if (importSource !== 'react') {
          if (isCorpus(importSource) && statement.node.importKind !== 'type') {
            for (const specifier of statement.node.specifiers) {
              // A docs module's alias of a Base UI hook returns what the Base UI hook does.
              const imported = t.isImportSpecifier(specifier) ? specifier.imported.name : null;
              if (!ctx.baseUiHookAliases.has(imported)) {
                ctx.corpusImports.add(specifier.local.name);
              }
            }
          }
          continue;
        }
        for (const specifier of statement.node.specifiers) {
          if (t.isImportNamespaceSpecifier(specifier) || t.isImportDefaultSpecifier(specifier)) {
            ctx.reactNames.namespaces.add(specifier.local.name);
          } else if (t.isImportSpecifier(specifier)) {
            ctx.reactNames.named.set(specifier.local.name, specifier.imported.name);
          }
        }
        statement.remove();
      }

      // React's types are global in a React project: `React.ReactNode` without an import.
      if (!programPath.scope.hasBinding('React')) {
        ctx.reactNames.namespaces.add('React');
      }
      transformPortals(programPath, ctx.imports);
      for (const statement of programPath.get('body')) {
        if (
          (statement.isImportDeclaration() ||
            statement.isExportNamedDeclaration() ||
            statement.isExportAllDeclaration()) &&
          statement.node.source
        ) {
          statement.node.source.value = rewriteModule(
            mapModule(statement.node.source.value, modules),
          );
        }
      }

      transformModuleApis(programPath, ctx);
      dropDisplayNames(programPath);
      programPath.scope.crawl();
      moveModuleElements(programPath);
      rerendersToSignals(programPath, ctx);
      if (!ctx.standalone) {
        deferElements(programPath, ctx);
      }
      programPath.scope.crawl();
      lowerReactiveFunctions(programPath, ctx);
      renameNonComponentProps(programPath);
      snapshotElementPaths(programPath);
      lowerRemainingHooks(programPath, ctx);
      transformTypes(programPath, ctx);
      transformJsx(programPath, ctx);
      placeElements(programPath, ctx.imports);
      environmentHooks(programPath, ctx.imports);
      renameDomPropReads(programPath);
      typeSpreadElementRefs(programPath, ctx);
      if (options.rewriteString) {
        rewriteStrings(programPath, options.rewriteString);
      }

      const declarations = ctx.imports.declarations(usedNames(programPath));
      if (declarations.length > 0) {
        // After the leading stylesheet imports, which come first for the CSS order.
        const body = programPath.get('body');
        const stylesheets = body.findIndex(
          (statement) => !statement.isImportDeclaration() || statement.node.specifiers.length > 0,
        );
        const count = stylesheets === -1 ? body.length : stylesheets;
        if (count === 0) {
          programPath.unshiftContainer('body', declarations);
        } else {
          body[count - 1].insertAfter(declarations);
        }
      }
      shorthandProperties(programPath);
      rewriteLintDirectives(
        programPath.node,
        (rule) => SOLID_LINT_RULES[rule] ?? (REACT_LINT_RULE.test(rule) ? null : rule),
      );
      keepHeaderComments(programPath, header);
      keepStatementParentheses(programPath);
      programPath.stop();
    },
  });

  return separateImports(generate(ast, GENERATOR_OPTIONS).code, options.filename);
}

/**
 * Puts a blank line between the imports and the code after them, as the source has: the printer
 * keeps a source's blank lines only between the statements it did not replace.
 */
function separateImports(code, filename) {
  const { body } = parse(code, parserOptions(filename)).program;
  const index = body.findLastIndex((statement) => statement.type === 'ImportDeclaration');
  const next = body[index + 1];
  if (index === -1 || !next) {
    return code;
  }
  const lineEnd = code.indexOf('\n', body[index].end);
  const nextStart = next.leadingComments?.[0]?.start ?? next.start;
  if (lineEnd === -1 || /\n[ \t]*\n/.test(code.slice(body[index].end, nextStart))) {
    return code;
  }
  return `${code.slice(0, lineEnd)}\n${code.slice(lineEnd)}`;
}
