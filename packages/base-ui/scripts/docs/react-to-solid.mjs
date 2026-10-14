// Transforms React component source (the docs in `docs/react`) into Solid source.
//
// The transform works on the syntax tree, with Babel's scope analysis, so a rewrite applies to the
// binding it targets and not to text that happens to look like it:
// - React imports, `'use client'` and React types become their Solid counterparts.
// - Hooks: `useState` becomes a signal and `useMemo` a memo (their reads become calls),
//   `useCallback` and `useStableCallback` return their function, `useRef` becomes a `{ current }`
//   object that callback refs assign, `useEffect` and `useLayoutEffect` become effects (a mount
//   effect runs in `onSettled`), and `useId` becomes `createUniqueId`.
// - Props: destructured parameters read from `props` (`merge` supplies defaults, `omit` the rest).
// - JSX: `className` and `htmlFor`, style objects, `dangerouslySetInnerHTML`, `key`, context
//   providers, and arrays rendered with `.map` (as `<For>`).
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';

const traverse = traverseModule.default ?? traverseModule;
const generate = generateModule.default ?? generateModule;

const REACT_DOM = 'react-dom';

const PARSER_OPTIONS = { sourceType: 'module', plugins: ['jsx', 'typescript'] };

/** Prints source through the transform's parser and printer (one formatting for comparisons). */
export function printCode(code) {
  return generate(parse(code, PARSER_OPTIONS), { jsescOption: { minimal: true, quotes: 'single' } }).code;
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
          .map(([imported, local]) => t.importSpecifier(t.identifier(local), t.identifier(imported))),
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
  if (t.isMemberExpression(callee) && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
    return reactNames.namespaces.has(callee.object.name) ? callee.property.name : null;
  }
  if (t.isIdentifier(callee)) {
    return reactNames.named.get(callee.name) ?? null;
  }
  return null;
}

/** Whether a function returns JSX somewhere in its own body (a component). */
function returnsJsx(path) {
  let found = false;
  path.traverse({
    Function(inner) {
      inner.skip();
    },
    ReturnStatement(ret) {
      const arg = ret.node.argument;
      if (
        t.isJSXElement(arg) ||
        t.isJSXFragment(arg) ||
        t.isConditionalExpression(arg) ||
        t.isLogicalExpression(arg)
      ) {
        found = true;
      }
    },
  });
  if (t.isArrowFunctionExpression(path.node) && !t.isBlockStatement(path.node.body)) {
    const body = path.node.body;
    found ||= t.isJSXElement(body) || t.isJSXFragment(body);
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
    statements.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier(propsName),
          t.callExpression(t.identifier('merge'), [t.objectExpression(defaults), t.identifier('_props')]),
        ),
      ]),
    );
  }
  if (restName) {
    imports.add('solid-js', 'omit');
    statements.push(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier('rest'),
          t.callExpression(t.identifier('omit'), [
            t.identifier(propsName),
            ...local.map(({ key }) => t.stringLiteral(DOM_ATTRIBUTES[key] ?? key)),
          ]),
        ),
      ]),
    );
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
      reference.replaceWith(t.memberExpression(t.identifier(propsName), t.identifier(propKey)));
    }
  }
  for (const reference of restReferences) {
    reference.replaceWith(t.identifier('rest'));
  }
}

/** The binding names whose reads become calls (signals, memos). */
function callReads(path, names) {
  for (const name of names) {
    const binding = path.scope.getBinding(name);
    for (const reference of binding?.referencePaths ?? []) {
      if (inTypePosition(reference)) {
        continue;
      }
      if (t.isCallExpression(reference.parent) && reference.parent.callee === reference.node) {
        continue;
      }
      reference.replaceWith(t.callExpression(t.identifier(name), []));
    }
  }
}

/** Replaces `return cleanup` in an effect body with `onCleanup(cleanup)`. */
function cleanupReturns(fnPath, imports) {
  fnPath.traverse({
    Function(inner) {
      inner.skip();
    },
    ReturnStatement(ret) {
      if (ret.node.argument) {
        imports.add('solid-js', 'onCleanup');
        ret.replaceWith(
          t.expressionStatement(t.callExpression(t.identifier('onCleanup'), [ret.node.argument])),
        );
      }
    },
  });
}

function transformHooks(programPath, reactNames, imports) {
  const signals = [];
  const memos = [];
  const refs = new Set();

  programPath.traverse({
    CallExpression(path) {
      const api = reactApi(path.node.callee, reactNames);
      if (!api) {
        return;
      }
      const args = path.node.arguments;
      switch (api) {
        case 'useState': {
          imports.add('solid-js', 'createSignal');
          path.node.callee = t.identifier('createSignal');
          if (t.isArrayPattern(path.parent.id) && t.isIdentifier(path.parent.id.elements[0])) {
            signals.push({ scope: path.scope, name: path.parent.id.elements[0].name });
          }
          break;
        }
        case 'useMemo': {
          imports.add('solid-js', 'createMemo');
          path.replaceWith(t.callExpression(t.identifier('createMemo'), [args[0]]));
          if (t.isIdentifier(path.parent.id)) {
            memos.push({ scope: path.scope, name: path.parent.id.name });
          }
          break;
        }
        case 'useCallback':
        case 'useStableCallback': {
          path.replaceWith(args[0]);
          break;
        }
        case 'useRef': {
          const typeParam = path.node.typeParameters?.params[0];
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
          path.replaceWith(t.objectExpression([t.objectProperty(t.identifier('current'), init)]));
          if (t.isIdentifier(path.parent.id)) {
            refs.add(path.parent.id.name);
          }
          break;
        }
        case 'useEffect':
        case 'useLayoutEffect':
        case 'useIsoLayoutEffect': {
          const [fn, deps] = args;
          const fnPath = path.get('arguments.0');
          cleanupReturns(fnPath, imports);
          if (t.isArrayExpression(deps) && deps.elements.length === 0) {
            imports.add('solid-js', 'onSettled');
            path.replaceWith(t.callExpression(t.identifier('onSettled'), [fn]));
          } else if (t.isArrayExpression(deps)) {
            const effect = api === 'useEffect' ? 'createEffect' : 'createRenderEffect';
            imports.add('solid-js', effect);
            path.replaceWith(
              t.callExpression(t.identifier(effect), [
                t.arrowFunctionExpression([], deps),
                fn,
              ]),
            );
          } else {
            const effect = api === 'useEffect' ? 'createEffect' : 'createRenderEffect';
            imports.add('solid-js', effect);
            path.replaceWith(
              t.callExpression(t.identifier(effect), [
                t.arrowFunctionExpression([], t.identifier('undefined')),
                fn,
              ]),
            );
          }
          break;
        }
        case 'useContext':
        case 'createContext': {
          imports.add('solid-js', api);
          path.node.callee = t.identifier(api);
          break;
        }
        case 'useId': {
          imports.add('solid-js', 'createUniqueId');
          path.node.callee = t.identifier('createUniqueId');
          break;
        }
        default:
          break;
      }
    },
  });

  // Reads of signals and memos become calls once every hook is rewritten.
  programPath.scope.crawl();
  for (const { scope, name } of [...signals, ...memos]) {
    const binding = scope.getBinding(name);
    if (binding) {
      callReads(binding.path.parentPath ?? binding.path, [name]);
    }
  }
  return refs;
}

function transformJsx(programPath, refs, imports, reactNames) {
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
        const html = value.expression.properties?.find((property) => property.key?.name === '__html');
        if (html) {
          path.replaceWith(t.jsxAttribute(t.jsxIdentifier('innerHTML'), t.jsxExpressionContainer(html.value)));
        }
        return;
      }
      if (name.name === 'style' && t.isJSXExpressionContainer(value) && t.isObjectExpression(value.expression)) {
        for (const property of value.expression.properties) {
          if (!t.isObjectProperty(property) || !t.isIdentifier(property.key)) {
            continue;
          }
          const key = property.key.name;
          if (t.isNumericLiteral(property.value) && !UNITLESS.has(key) && property.value.value !== 0) {
            property.value = t.stringLiteral(`${property.value.value}px`);
          } else if (t.isNumericLiteral(property.value) && property.value.value === 0 && !UNITLESS.has(key)) {
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
    JSXElement(path) {
      const name = path.node.openingElement.name;
      const isFragment =
        (t.isJSXMemberExpression(name) &&
          t.isJSXIdentifier(name.object) &&
          reactNames.namespaces.has(name.object.name) &&
          name.property.name === 'Fragment') ||
        (t.isJSXIdentifier(name) && reactNames.named.get(name.name) === 'Fragment');
      if (isFragment) {
        path.replaceWith(
          t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), path.node.children),
        );
      }
    },
    JSXMemberExpression(path) {
      // `<Context.Provider>` renders as `<Context>`.
      if (path.node.property.name === 'Provider' && t.isJSXIdentifier(path.node.object)) {
        path.replaceWith(path.node.object);
      }
    },
    JSXExpressionContainer(path) {
      const expression = path.node.expression;
      if (
        !t.isJSXElement(path.parent) &&
        !t.isJSXFragment(path.parent)
      ) {
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
            t.jsxAttribute(t.jsxIdentifier('each'), t.jsxExpressionContainer(expression.callee.object)),
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
const GENERIC_EVENTS = new Set(['ChangeEvent', 'FormEvent', 'SyntheticEvent', 'BaseSyntheticEvent']);

/** A local name for an imported type that does not clash with a declaration in the file. */
function freeName(programPath, name) {
  const declared = programPath.node.body.some(
    (statement) =>
      ((t.isTSTypeAliasDeclaration(statement) || t.isTSInterfaceDeclaration(statement)) &&
        statement.id.name === name) ||
      ((t.isExportNamedDeclaration(statement) &&
        (t.isTSTypeAliasDeclaration(statement.declaration) ||
          t.isTSInterfaceDeclaration(statement.declaration)) &&
        statement.declaration.id.name === name)),
  );
  return declared || programPath.scope.hasBinding(name) ? `Solid${name}` : name;
}

function transformTypes(programPath, reactNames, imports) {
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

/** Rewrites every function component's destructured props. */
function transformComponents(programPath, imports) {
  programPath.traverse({
    'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression'(path) {
      if (!isComponentName(functionName(path)) || !returnsJsx(path)) {
        return;
      }
      rewriteDestructuredProps(path, imports);
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
    statement.node.specifiers = statement.node.specifiers.filter((specifier) => !isPortal(specifier));
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
      const child =
        t.isJSXElement(children) || t.isJSXFragment(children)
          ? children
          : t.jsxExpressionContainer(children);
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
  const ast = parse(source, PARSER_OPTIONS);
  const imports = new Imports();
  const reactNames = { namespaces: new Set(), named: new Map() };

  traverse(ast, {
    Program(programPath) {
      programPath.node.directives = programPath.node.directives.filter(
        (directive) => directive.value.value !== 'use client',
      );
      for (const statement of programPath.get('body')) {
        if (!statement.isImportDeclaration()) {
          continue;
        }
        const source = statement.node.source.value;
        if (BASE_UI_UTILS_HOOKS.has(source)) {
          for (const specifier of statement.node.specifiers) {
            if (t.isImportSpecifier(specifier)) {
              reactNames.named.set(specifier.local.name, specifier.imported.name);
            }
          }
          statement.remove();
          continue;
        }
        if (source !== 'react') {
          continue;
        }
        for (const specifier of statement.node.specifiers) {
          if (t.isImportNamespaceSpecifier(specifier) || t.isImportDefaultSpecifier(specifier)) {
            reactNames.namespaces.add(specifier.local.name);
          } else if (t.isImportSpecifier(specifier)) {
            reactNames.named.set(specifier.local.name, specifier.imported.name);
          }
        }
        statement.remove();
      }

      transformPortals(programPath, imports);
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

      transformComponents(programPath, imports);
      programPath.scope.crawl();
      const refs = transformHooks(programPath, reactNames, imports);
      transformTypes(programPath, reactNames, imports);
      transformJsx(programPath, refs, imports, reactNames);
      renameDomPropReads(programPath);

      const declarations = imports.declarations();
      if (declarations.length > 0) {
        programPath.unshiftContainer('body', declarations);
      }
      programPath.stop();
    },
  });

  return generate(ast, { jsescOption: { minimal: true, quotes: 'single' } }).code;
}
