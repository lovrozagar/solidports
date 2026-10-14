// Next's route segment `metadata` and `viewport` for the Solid docs. Each layout and page merges
// its exports with its parent's, as Next does (a key a segment sets replaces the parent's; a
// parent's `title.template` names its children's titles), and writes the result into the head
// with `useHead` (the deepest segment's tags win).
import { createContext, createMemo, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useHead } from '@solidjs/web';
import type { HeadTag } from '@solidjs/web';
import type { Icon, Metadata, TemplateString, Viewport } from 'docs/src/adapters/next';

export interface SegmentModule {
  metadata?: Metadata;
  generateMetadata?: (props: unknown, parent: Promise<Metadata>) => Metadata | Promise<Metadata>;
  viewport?: Viewport;
  generateViewport?: (props: unknown) => Viewport | Promise<Viewport>;
}

interface ResolvedSegment {
  metadata: Metadata;
  title: string | null;
  // The template this segment's children name their titles with.
  titleTemplate: string | null;
  viewport: Viewport;
}

const ROOT: ResolvedSegment = { metadata: {}, title: null, titleTemplate: null, viewport: {} };
const SegmentContext = createContext<Accessor<ResolvedSegment>>(() => ROOT);

export const SegmentProvider = SegmentContext;

function resolveTitle(title: TemplateString | null | undefined, parentTemplate: string | null) {
  if (title == null) {
    return { title: null, template: parentTemplate };
  }
  if (typeof title === 'string') {
    return {
      title: parentTemplate ? parentTemplate.replace('%s', title) : title,
      template: parentTemplate,
    };
  }
  if ('absolute' in title && title.absolute) {
    return { title: title.absolute, template: title.template ?? parentTemplate };
  }
  const base = 'default' in title ? title.default : null;
  return {
    title: base == null ? null : parentTemplate ? parentTemplate.replace('%s', base) : base,
    template: title.template ?? parentTemplate,
  };
}

/** Resolves a segment's metadata against its parent's, for its subtree. */
export function useSegment(module: SegmentModule, props: unknown): Accessor<ResolvedSegment> {
  const parent = useContext(SegmentContext);
  const own = createMemo(() =>
    module.generateMetadata
      ? module.generateMetadata(props, Promise.resolve(parent().metadata))
      : (module.metadata ?? {}),
  );
  const ownViewport = createMemo(() =>
    module.generateViewport ? module.generateViewport(props) : (module.viewport ?? {}),
  );
  const resolved = createMemo((): ResolvedSegment => {
    const metadata = own() as Metadata;
    const { title, template } = resolveTitle(
      'title' in metadata ? (metadata.title as TemplateString | null) : undefined,
      parent().titleTemplate,
    );
    return {
      metadata: { ...parent().metadata, ...metadata },
      title: 'title' in metadata ? title : parent().title,
      titleTemplate: template,
      viewport: { ...parent().viewport, ...(ownViewport() as Viewport) },
    };
  });
  const tags = createMemo(() => headTags(resolved()));
  useHead(() => tags());
  return resolved;
}

function absoluteUrl(url: string | URL | null | undefined, base: string | URL | null | undefined) {
  if (url == null) {
    return undefined;
  }
  try {
    return base ? new URL(url, base).toString() : url.toString();
  } catch {
    return url.toString();
  }
}

const meta = (props: Record<string, string>): HeadTag => ({ tag: 'meta', props });
const link = (props: Record<string, string>): HeadTag => ({ tag: 'link', props });

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function iconTags(icons: Metadata['icons']): HeadTag[] {
  if (icons == null) {
    return [];
  }
  const asIcon = (value: string | URL | Icon, rel: string): Icon =>
    typeof value === 'string' || value instanceof URL ? { url: value, rel } : { rel, ...value };
  const entries: Icon[] = [];
  if (typeof icons === 'string' || icons instanceof URL || Array.isArray(icons)) {
    entries.push(...toArray(icons as string | Icon).map((icon) => asIcon(icon, 'icon')));
  } else {
    entries.push(...toArray(icons.icon).map((icon) => asIcon(icon, 'icon')));
    entries.push(...toArray(icons.shortcut).map((icon) => asIcon(icon, 'shortcut icon')));
    entries.push(...toArray(icons.apple).map((icon) => asIcon(icon, 'apple-touch-icon')));
  }
  return entries.map((icon) => {
    const props: Record<string, string> = { rel: icon.rel ?? 'icon', href: icon.url.toString() };
    if (icon.type) {
      props.type = icon.type;
    }
    if (icon.sizes) {
      props.sizes = icon.sizes;
    }
    if (icon.media) {
      props.media = icon.media;
    }
    return { ...link(props), key: `icon:${props.rel}:${props.href}` };
  });
}

function headTags(segment: ResolvedSegment): HeadTag[] {
  const { metadata, viewport } = segment;
  const base = metadata.metadataBase;
  const tags: HeadTag[] = [];
  if (segment.title != null) {
    tags.push({ tag: 'title', props: { children: segment.title } });
  }
  if (metadata.description) {
    tags.push(meta({ name: 'description', content: metadata.description }));
  }
  if (metadata.applicationName) {
    tags.push(meta({ name: 'application-name', content: metadata.applicationName }));
  }
  const keywords = toArray(metadata.keywords);
  if (keywords.length > 0) {
    tags.push(meta({ name: 'keywords', content: keywords.join(',') }));
  }
  const canonical = absoluteUrl(metadata.alternates?.canonical, base);
  if (canonical) {
    tags.push(link({ rel: 'canonical', href: canonical }));
  }
  for (const [type, value] of Object.entries(metadata.alternates?.types ?? {})) {
    for (const entry of toArray(value as string | { url: string; title?: string })) {
      const href = typeof entry === 'string' ? entry : entry.url.toString();
      tags.push({
        ...link({ rel: 'alternate', type, href: absoluteUrl(href, base) ?? href }),
        key: `alternate:${type}:${href}`,
      });
    }
  }
  tags.push(...iconTags(metadata.icons));
  const openGraph = metadata.openGraph;
  if (openGraph) {
    const ogTitle = openGraph.title ?? segment.title;
    const property = (name: string, content: unknown) => {
      if (content != null && content !== '') {
        tags.push(meta({ property: name, content: String(content) }));
      }
    };
    property(
      'og:title',
      typeof ogTitle === 'object' && ogTitle ? (ogTitle as { default?: string }).default : ogTitle,
    );
    property('og:description', openGraph.description ?? metadata.description);
    property('og:url', absoluteUrl(openGraph.url as string | undefined, base));
    property('og:site_name', openGraph.siteName);
    property('og:locale', openGraph.locale);
    for (const image of toArray(openGraph.images)) {
      const entry = typeof image === 'string' || image instanceof URL ? { url: image } : image;
      property('og:image', absoluteUrl(entry.url, base));
      property('og:image:width', entry.width);
      property('og:image:height', entry.height);
      property('og:image:alt', entry.alt);
    }
    property('og:type', openGraph.type);
    property('og:ttl', openGraph.ttl);
    for (const author of toArray(openGraph.authors)) {
      property('article:author', author);
    }
  }
  const twitter = metadata.twitter;
  if (twitter) {
    const name = (key: string, content: unknown) => {
      if (content != null && content !== '') {
        tags.push(meta({ name: key, content: String(content) }));
      }
    };
    name('twitter:card', twitter.card);
    name('twitter:site', twitter.site);
    name('twitter:creator', twitter.creator);
    const twitterTitle = twitter.title ?? segment.title;
    name(
      'twitter:title',
      typeof twitterTitle === 'object' && twitterTitle
        ? (twitterTitle as { default?: string }).default
        : twitterTitle,
    );
    name('twitter:description', twitter.description ?? metadata.description);
    for (const image of toArray(twitter.images)) {
      name('twitter:image', absoluteUrl(image, base));
    }
  }
  for (const [key, value] of Object.entries(metadata.other ?? {})) {
    for (const content of toArray(value)) {
      tags.push({
        ...meta({ name: key, content: String(content) }),
        key: `other:${key}:${content}`,
      });
    }
  }
  const viewportContent = [
    viewport.width != null ? `width=${viewport.width}` : null,
    viewport.height != null ? `height=${viewport.height}` : null,
    viewport.initialScale != null ? `initial-scale=${viewport.initialScale}` : null,
    viewport.minimumScale != null ? `minimum-scale=${viewport.minimumScale}` : null,
    viewport.maximumScale != null ? `maximum-scale=${viewport.maximumScale}` : null,
    viewport.userScalable != null ? `user-scalable=${viewport.userScalable ? 'yes' : 'no'}` : null,
    viewport.viewportFit ? `viewport-fit=${viewport.viewportFit}` : null,
    viewport.interactiveWidget ? `interactive-widget=${viewport.interactiveWidget}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  // Next writes the default viewport when no segment sets one.
  tags.push(
    meta({ name: 'viewport', content: viewportContent || 'width=device-width, initial-scale=1' }),
  );
  for (const color of toArray(viewport.themeColor)) {
    const entry = typeof color === 'string' ? { color } : color;
    const props: Record<string, string> = { name: 'theme-color', content: entry.color };
    if (entry.media) {
      props.media = entry.media;
    }
    tags.push({ ...meta(props), key: `theme-color:${entry.media ?? ''}` });
  }
  if (viewport.colorScheme) {
    tags.push(meta({ name: 'color-scheme', content: viewport.colorScheme }));
  }
  return tags;
}
