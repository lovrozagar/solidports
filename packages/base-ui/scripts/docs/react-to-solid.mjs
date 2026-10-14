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

const PARSER_OPTIONS = { sourceType: 'module', plugins: ['jsx', 'typescript'] };
const GENERATOR_OPTIONS = { jsescOption: { minimal: true, quotes: 'single' } };

/** Prints source through the transform's parser and printer (one formatting for comparisons). */
export function printCode(code) {
  return generate(parse(code, PARSER_OPTIONS), GENERATOR_OPTIONS).code;
}

const DOM_ATTRIBUTES = { className: 'class', htmlFor: 'for' };
// CSS properties that take a length: a number in React's `style` means pixels.
const UNITLESS = new Set([
  'animationIterationCount',
  'aspectRatio',
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'gridColumn',
  'gridRow',
  'lineHeight',
  'opacity',
  'order',
  'orphans',
  'scale',
  'tabSize',
  'widows',
  'zIndex',
  'zoom',
]);

const REACT_TYPES = {
  ReactNode: { name: 'JSX', member: 'Element' },
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
// React hooks whose result the transform reads through an accessor.
const ACCESSOR_HOOKS = new Set(['useMemo', 'useContext', 'useSyncExternalStore', 'use']);

const HOOK_NAME = /^use[A-Z0-9]/;

// Imports of these modules are corpus code (transformed with this file, or written for it as an
// adapter), so their hooks follow the corpus convention.
const CORPUS_MODULES = ['.', 'docs/', '@mui/internal-docs-infra', 'next', '@base-ui/utils/'];

const kebab = (name) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

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

  declarations() {
    const declaration = (source, names, type) => {
      const node = t.importDeclaration(
        [...names]
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
    ];
  }
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
              t.jsxExpressionContainer(
                t.memberExpression(t.identifier(propsName), t.identifier(propKey)),
              ),
            ),
          );
        }
        reference.replaceWith(t.jsxIdentifier('Dynamic'));
        continue;
      }
      if (reference.parentPath.isObjectProperty({ shorthand: true, value: reference.node })) {
        reference.parent.shorthand = false;
      }
      reference.replaceWith(t.memberExpression(t.identifier(propsName), t.identifier(propKey)));
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

/** Rewrites a React hook call (in a declaration or a statement) to Solid; returns the replacement. */
function lowerReactHook(node, api, ctx) {
  const { imports } = ctx;
  const args = node.arguments;
  switch (api) {
    case 'useState': {
      imports.add('solid-js', 'createSignal');
      const [init] = args;
      // A lazy initializer runs once, as React runs it on the first render.
      const value =
        init && (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init))
          ? t.callExpression(init, [])
          : init;
      const call = t.callExpression(t.identifier('createSignal'), value ? [value] : []);
      call.typeParameters = node.typeParameters;
      return call;
    }
    case 'useReducer':
    case 'useTransition': {
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
      const effect = api === 'useEffect' ? 'createEffect' : 'createRenderEffect';
      imports.add('solid-js', effect);
      return t.callExpression(t.identifier(effect), [t.arrowFunctionExpression([], deps), fn]);
    }
    case 'useDebugValue':
      return null;
    default:
      throw new Error(`react-to-solid: no Solid counterpart for React.${api}`);
  }
}

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
  if (!t.isBlockStatement(fnPath.node.body)) {
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
    fnPath.node.params = fnPath.node.params.map((param, index) => {
      if (t.isIdentifier(param)) {
        accessorParams.set(param.name, Boolean(param.optional));
        if (param.typeAnnotation) {
          param.typeAnnotation = t.tsTypeAnnotation(
            accessorType(param.typeAnnotation.typeAnnotation, imports),
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
      const annotation = pattern.typeAnnotation?.typeAnnotation;
      if (annotation) {
        id.typeAnnotation = t.tsTypeAnnotation(accessorType(annotation, imports));
        pattern.typeAnnotation = null;
      }
      id.optional = Boolean(fallback) || Boolean(pattern.optional);
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
  const readsReactive = (path) => {
    let found = false;
    const visit = (refPath) => {
      const binding = bindingOf(refPath, refPath.node.name);
      if (binding && reactive.has(binding.identifier)) {
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
        if (t.isArrayPattern(id) && t.isIdentifier(id.elements[0])) {
          const name = id.elements[0].name;
          declare(bindingOf(declaratorPath, name), { kind: 'accessor', name });
        }
        continue;
      }
      const returnsAccessor = api
        ? ACCESSOR_HOOKS.has(api)
        : isCorpusHook(declaratorPath.get('init'), ctx);
      if (returnsAccessor && t.isIdentifier(id)) {
        declare(bindingOf(declaratorPath, id.name), { kind: 'accessor', name: id.name });
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
    if (statement.kind !== 'const' || isFunctionNode(init) || isJsxNode(init)) {
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
          alias: () =>
            t.memberExpression(t.identifier(init.name), t.identifier(DOM_ATTRIBUTES[key] ?? key)),
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
  for (const entry of reactive.values()) {
    if (entry.kind === 'source') {
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
        declarator.init = lowerReactHook(declarator.init, api, ctx);
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
    if (!simple && render.length === 1 && t.isReturnStatement(only)) {
      only.argument = fragmentOf(only.argument);
    } else if (!simple && render.length > 0) {
      const renderId = uid('render');
      tail = [
        constDeclaration(renderId, createMemoCall(t.blockStatement(render), imports)),
        t.returnStatement(fragmentOf(t.callExpression(t.identifier(renderId.name), []))),
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
}

/** Passes each argument of a corpus hook call as an accessor. */
function wrapHookArguments(call, fnPath, ctx, rewrites) {
  const callPath = findPath(fnPath, call);
  if (!callPath || !isCorpusHook(callPath, ctx)) {
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
function rewriteReads(fnPath, rewrites, imports) {
  if (rewrites.size === 0) {
    return;
  }
  fnPath.traverse({
    'Identifier|JSXIdentifier'(path) {
      const entry = rewrites.get(path.node);
      if (!entry) {
        return;
      }
      let replacement;
      if (entry.kind === 'alias') {
        replacement = entry.alias();
      } else if (entry.optional) {
        replacement = t.optionalCallExpression(t.identifier(entry.name), [], true);
      } else {
        replacement = t.callExpression(t.identifier(entry.name), []);
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

/** Lowers every component and corpus hook, innermost first. */
function lowerReactiveFunctions(programPath, ctx) {
  const found = [];
  programPath.traverse({
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression': {
      exit(path) {
        const name = functionName(path);
        if (name && HOOK_NAME.test(name)) {
          found.push({ path, kind: 'hook' });
        } else if (isComponentName(name) && (returnsJsx(path) || callsHooks(path, ctx))) {
          found.push({ path, kind: 'component' });
        } else if (!name && t.isExportDefaultDeclaration(path.parent) && returnsJsx(path)) {
          found.push({ path, kind: 'component' });
        }
      },
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
            if (t.isIdentifier(propsParam) && !propsParam.typeAnnotation && propsType) {
              const refProp = t.tsPropertySignature(
                t.identifier('ref'),
                t.tsTypeAnnotation(
                  t.tsTypeReference(
                    t.identifier('Ref'),
                    refType ? t.tsTypeParameterInstantiation([refType]) : null,
                  ),
                ),
              );
              refProp.optional = true;
              imports.add('solid-js', 'Ref', true);
              propsParam.typeAnnotation = t.tsTypeAnnotation(
                t.tsIntersectionType([propsType, t.tsTypeLiteral([refProp])]),
              );
            }
            if (t.isIdentifier(refParam) && t.isIdentifier(propsParam)) {
              const binding = fnPath.scope.getBinding(refParam.name);
              for (const reference of binding?.referencePaths ?? []) {
                reference.replaceWith(
                  t.memberExpression(t.identifier(propsParam.name), t.identifier('ref')),
                );
              }
            }
            fnPath.node.params = fnPath.node.params.slice(0, 1);
            path.replaceWith(fnPath.node);
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
    MemberExpression(path) {
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

function transformJsx(programPath, ctx) {
  const { imports, reactNames, refs } = ctx;
  programPath.traverse({
    JSXAttribute(path) {
      const name = path.node.name;
      if (!t.isJSXIdentifier(name)) {
        return;
      }
      if (name.name === 'key') {
        path.remove();
        return;
      }
      if (DOM_ATTRIBUTES[name.name]) {
        name.name = DOM_ATTRIBUTES[name.name];
        return;
      }
      const value = path.node.value;
      if (name.name === 'dangerouslySetInnerHTML' && t.isJSXExpressionContainer(value)) {
        const html = value.expression.properties?.find(
          (property) => property.key?.name === '__html',
        );
        if (html) {
          path.replaceWith(
            t.jsxAttribute(t.jsxIdentifier('innerHTML'), t.jsxExpressionContainer(html.value)),
          );
        }
        return;
      }
      if (
        name.name === 'style' &&
        t.isJSXExpressionContainer(value) &&
        t.isObjectExpression(value.expression)
      ) {
        for (const property of value.expression.properties) {
          if (!t.isObjectProperty(property) || !t.isIdentifier(property.key)) {
            continue;
          }
          const key = property.key.name;
          if (
            t.isNumericLiteral(property.value) &&
            !UNITLESS.has(key) &&
            property.value.value !== 0
          ) {
            property.value = t.stringLiteral(`${property.value.value}px`);
          } else if (
            t.isNumericLiteral(property.value) &&
            property.value.value === 0 &&
            !UNITLESS.has(key)
          ) {
            property.value = t.stringLiteral('0');
          }
          if (/[A-Z]/.test(key)) {
            property.key = t.stringLiteral(kebab(key));
          }
        }
        return;
      }
      if (
        name.name === 'ref' &&
        t.isJSXExpressionContainer(value) &&
        t.isIdentifier(value.expression) &&
        refs.has(value.expression.name)
      ) {
        const element = t.identifier('element');
        path.node.value = t.jsxExpressionContainer(
          t.arrowFunctionExpression(
            [element],
            t.blockStatement([
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  t.memberExpression(t.identifier(value.expression.name), t.identifier('current')),
                  element,
                ),
              ),
            ]),
          ),
        );
      }
    },
    JSXOpeningElement(path) {
      // A context provider passes its value as an accessor (see the header).
      const name = path.node.name;
      if (!(t.isJSXMemberExpression(name) && name.property.name === 'Provider')) {
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
    JSXElement(path) {
      const name = path.node.openingElement.name;
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
        if (path.node.property.name === 'Provider' && t.isJSXIdentifier(path.node.object)) {
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
        t.isCallExpression(expression) &&
        t.isMemberExpression(expression.callee) &&
        t.isIdentifier(expression.callee.property, { name: 'map' }) &&
        expression.arguments.length >= 1 &&
        (t.isArrowFunctionExpression(expression.arguments[0]) ||
          t.isFunctionExpression(expression.arguments[0]))
      ) {
        imports.add('solid-js', 'For');
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
  const reactType = (typeName) =>
    t.isTSQualifiedName(typeName) &&
    t.isIdentifier(typeName.left) &&
    reactNames.namespaces.has(typeName.left.name)
      ? typeName.right.name
      : null;
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

  programPath.traverse({
    // `interface X extends React.ComponentProps<'button'>`
    TSExpressionWithTypeArguments(path) {
      const name = reactType(path.node.expression);
      if (!name) {
        return;
      }
      if (name.endsWith('HTMLAttributes')) {
        path.node.expression = jsxType(name);
      } else if (REACT_TYPES[name]) {
        const mapped = REACT_TYPES[name];
        imports.add('@solidjs/web', mapped.name, true);
        path.node.expression = mapped.member
          ? t.tsQualifiedName(t.identifier(mapped.name), t.identifier(mapped.member))
          : t.identifier(mapped.name);
      }
    },
    TSTypeReference: {
      exit(path) {
        const name = reactType(path.node.typeName);
        if (!name) {
          return;
        }
        const args = params(path.node);
        if (DOM_EVENTS.has(name)) {
          path.replaceWith(t.tsTypeReference(t.identifier(name)));
        } else if (GENERIC_EVENTS.has(name)) {
          path.replaceWith(t.tsTypeReference(t.identifier('Event')));
        } else if (name === 'PropsWithChildren') {
          path.replaceWith(reference(solidType('ParentProps'), args));
        } else if (name === 'ComponentType' || name === 'FC' || name === 'FunctionComponent') {
          path.replaceWith(reference(solidType('Component'), args));
        } else if (name === 'Dispatch' && args.length === 1) {
          const inner = args[0];
          const value =
            t.isTSTypeReference(inner) && reactType(inner.typeName) === 'SetStateAction'
              ? params(inner)
              : [inner];
          path.replaceWith(reference(solidType('Setter'), value));
        } else if (name === 'SetStateAction') {
          path.replaceWith(args[0]);
        } else if (name === 'RefObject' || name === 'MutableRefObject') {
          path.replaceWith(
            t.tsTypeLiteral([
              t.tsPropertySignature(t.identifier('current'), t.tsTypeAnnotation(args[0])),
            ]),
          );
        } else if (name === 'SVGProps') {
          path.replaceWith(reference(jsxType('SvgSVGAttributes'), args));
        } else if (name.endsWith('HTMLAttributes')) {
          path.replaceWith(reference(jsxType(name), args));
        } else if (REACT_TYPES[name]) {
          const mapped = REACT_TYPES[name];
          imports.add('@solidjs/web', mapped.name, true);
          path.replaceWith(
            reference(
              mapped.member
                ? t.tsQualifiedName(t.identifier(mapped.name), t.identifier(mapped.member))
                : t.identifier(mapped.name),
              args,
            ),
          );
        }
      },
    },
  });
}

/** Renames `props.className` and `props.htmlFor` reads. */
function renameDomPropReads(programPath) {
  programPath.traverse({
    MemberExpression(path) {
      if (
        t.isIdentifier(path.node.object, { name: 'props' }) &&
        t.isIdentifier(path.node.property) &&
        DOM_ATTRIBUTES[path.node.property.name]
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
  'lucide-react': 'lucide-solid',
};

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

export function transformReactToSolid(source, options = {}) {
  const modules = { ...MODULES, ...options.modules };
  const isCorpus = options.isCorpus ?? isCorpusModule;
  const ast = parse(source, PARSER_OPTIONS);
  const ctx = {
    imports: new Imports(),
    reactNames: { namespaces: new Set(), named: new Map() },
    corpusImports: new Set(),
    refs: new Set(),
  };

  traverse(ast, {
    Program(programPath) {
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
        if (importSource !== 'react') {
          if (isCorpus(importSource) && statement.node.importKind !== 'type') {
            for (const specifier of statement.node.specifiers) {
              ctx.corpusImports.add(specifier.local.name);
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

      transformPortals(programPath, ctx.imports);
      for (const statement of programPath.get('body')) {
        if (
          (statement.isImportDeclaration() ||
            statement.isExportNamedDeclaration() ||
            statement.isExportAllDeclaration()) &&
          statement.node.source
        ) {
          statement.node.source.value = mapModule(statement.node.source.value, modules);
        }
      }

      transformModuleApis(programPath, ctx);
      programPath.scope.crawl();
      lowerReactiveFunctions(programPath, ctx);
      lowerRemainingHooks(programPath, ctx);
      transformTypes(programPath, ctx);
      transformJsx(programPath, ctx);
      renameDomPropReads(programPath);

      const declarations = ctx.imports.declarations();
      if (declarations.length > 0) {
        programPath.unshiftContainer('body', declarations);
      }
      programPath.stop();
    },
  });

  return generate(ast, GENERATOR_OPTIONS).code;
}
