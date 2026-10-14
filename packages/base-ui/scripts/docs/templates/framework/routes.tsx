// Next's app router for the Solid docs: the route tree from the file conventions under `src/app`
// (route groups, layouts, `page.tsx`/`page.mdx`, dynamic and catch-all segments, private `_`
// folders, `global-not-found.tsx`), on the Solid router.
import { Errored, createComponent, lazy } from 'solid-js';
import type { Component } from 'solid-js';
import type { RouteDefinition } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { isNotFoundError } from 'docs/src/adapters/next/navigation';
import { SegmentProvider, useSegment } from './metadata';
import type { SegmentModule } from './metadata';

interface RouteModule extends SegmentModule {
  default: Component<any>;
}

// Layouts render the document (`<html>`), so they load with the app; pages load on demand.
const layouts = import.meta.glob<RouteModule>('/src/app/**/layout.tsx', { eager: true });
const pages = import.meta.glob<RouteModule>(['/src/app/**/page.tsx', '/src/app/**/page.mdx']);
const notFoundModules = import.meta.glob<RouteModule>('/src/app/global-not-found.tsx', {
  eager: true,
});

const APP = '/src/app/';

interface RouteProps {
  params: Record<string, string | undefined>;
  location: { search: string };
  children?: JSX.Element;
}

/** Next's props for a segment: `params` and `searchParams` as promises, and a layout's `children`. */
function nextProps(props: RouteProps, withChildren: boolean) {
  const params = Promise.resolve(
    Object.fromEntries(
      Object.entries(props.params).map(([key, value]) => [
        key,
        // A catch-all segment is an array of its parts.
        value != null && catchAllNames.has(key) ? value.split('/') : value,
      ]),
    ),
  );
  const searchParams = Promise.resolve(
    Object.fromEntries(new URLSearchParams(props.location.search)),
  );
  return withChildren
    ? {
        params,
        get children() {
          return props.children;
        },
      }
    : { params, searchParams };
}

const catchAllNames = new Set<string>();

function NotFoundPage() {
  const module = Object.values(notFoundModules)[0];
  return module ? createComponent(module.default, {}) : null;
}

/** A layout or page with its metadata, rendering the not-found page when it calls `notFound()`. */
function segment(module: RouteModule, withChildren: boolean): Component<RouteProps> {
  return (props) => {
    const segmentProps = nextProps(props, withChildren);
    const resolved = useSegment(module, segmentProps);
    return (
      <SegmentProvider value={resolved}>
        <Errored
          fallback={(error) => {
            const value = typeof error === 'function' ? error() : error;
            if (isNotFoundError(value)) {
              return <NotFoundPage />;
            }
            throw value;
          }}
        >
          {createComponent(module.default, segmentProps)}
        </Errored>
      </SegmentProvider>
    );
  };
}

function lazySegment(load: () => Promise<RouteModule>): Component<RouteProps> {
  return lazy(async () => {
    const module = await load();
    // The page module's client manifest key, which a server-side `lazy()` reads to preload the
    // page's assets for hydration.
    return {
      default: segment(module, false),
      $$moduleUrl: (module as { $$moduleUrl?: string }).$$moduleUrl,
    };
  });
}

function segmentPath(name: string) {
  if (/^\(.*\)$/.test(name)) {
    return '';
  }
  const catchAll = /^\[{1,2}\.\.\.(\w+)\]{1,2}$/.exec(name);
  if (catchAll) {
    catchAllNames.add(catchAll[1]);
    return `*${catchAll[1]}`;
  }
  const dynamic = /^\[(\w+)\]$/.exec(name);
  return dynamic ? `:${dynamic[1]}` : name;
}

interface Folder {
  layout?: RouteModule;
  page?: () => Promise<RouteModule>;
  children: Map<string, Folder>;
}

function folderAt(root: Folder, segments: string[]) {
  let folder = root;
  for (const name of segments) {
    let child = folder.children.get(name);
    if (!child) {
      child = { children: new Map() };
      folder.children.set(name, child);
    }
    folder = child;
  }
  return folder;
}

const isPrivate = (file: string) =>
  file
    .slice(APP.length)
    .split('/')
    .some((part) => part.startsWith('_'));

const root: Folder = { children: new Map() };
for (const [file, module] of Object.entries(layouts)) {
  if (!isPrivate(file)) {
    folderAt(root, file.slice(APP.length).split('/').slice(0, -1)).layout = module;
  }
}
for (const [file, load] of Object.entries(pages)) {
  if (!isPrivate(file)) {
    folderAt(root, file.slice(APP.length).split('/').slice(0, -1)).page = load;
  }
}

function routesOf(folder: Folder, name: string | null): RouteDefinition {
  const children: RouteDefinition[] = [];
  if (folder.page) {
    children.push({ path: '/', component: lazySegment(folder.page) });
  }
  for (const [childName, child] of folder.children) {
    children.push(routesOf(child, childName));
  }
  const path = name == null ? '' : segmentPath(name);
  return {
    path: path ? `/${path}` : '/',
    ...(folder.layout ? { component: segment(folder.layout, true) } : {}),
    children,
  } as RouteDefinition;
}

export const routes: RouteDefinition[] = [
  routesOf(root, null),
  ...(Object.keys(notFoundModules).length > 0 ? [{ path: '*404', component: NotFoundPage }] : []),
];
