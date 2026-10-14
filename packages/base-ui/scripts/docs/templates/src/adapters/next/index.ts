// The `next` types the docs use: the route segment `metadata` and `viewport` exports, which the
// app router (`framework/metadata.ts`) renders into the document head.

type Url = string | URL;

export type TemplateString =
  | string
  | { default: string; template?: string; absolute?: string }
  | { absolute: string; template?: string };

export interface Icon {
  url: Url;
  rel?: string;
  type?: string;
  sizes?: string;
  media?: string;
}

export interface Metadata {
  metadataBase?: Url | null;
  title?: TemplateString | null;
  description?: string | null;
  applicationName?: string | null;
  keywords?: string | string[] | null;
  authors?: Array<{ name?: string; url?: Url }> | { name?: string; url?: Url } | null;
  robots?: string | { index?: boolean; follow?: boolean } | null;
  alternates?: {
    canonical?: Url | null;
    types?: Record<string, Url | Array<{ url: Url; title?: string }>>;
  } | null;
  icons?:
    | Url
    | Icon[]
    | { icon?: Url | Icon | Icon[]; apple?: Url | Icon | Icon[]; shortcut?: Url | Icon | Icon[] }
    | null;
  openGraph?: {
    type?: string;
    locale?: string;
    url?: Url;
    title?: TemplateString;
    description?: string;
    siteName?: string;
    images?:
      | Url
      | { url: Url; width?: number; height?: number; alt?: string }
      | Array<Url | { url: Url; width?: number; height?: number; alt?: string }>;
    authors?: string | string[];
    ttl?: number;
    [key: string]: unknown;
  } | null;
  twitter?: {
    card?: string;
    site?: string;
    creator?: string;
    title?: TemplateString;
    description?: string;
    images?: Url | Url[];
    [key: string]: unknown;
  } | null;
  verification?: Record<string, string | string[]> | null;
  other?: Record<string, string | number | Array<string | number>>;
  [key: string]: unknown;
}

export interface ThemeColorDescriptor {
  color: string;
  media?: string;
}

export interface Viewport {
  width?: string | number;
  height?: string | number;
  initialScale?: number;
  minimumScale?: number;
  maximumScale?: number;
  userScalable?: boolean;
  viewportFit?: 'auto' | 'cover' | 'contain';
  interactiveWidget?: 'resizes-visual' | 'resizes-content' | 'overlays-content';
  themeColor?: string | ThemeColorDescriptor | ThemeColorDescriptor[] | null;
  colorScheme?: string | null;
}

export interface ResolvingMetadata extends Promise<Metadata> {}

export namespace MetadataRoute {
  export interface Robots {
    rules:
      | { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] }
      | Array<{
          userAgent: string | string[];
          allow?: string | string[];
          disallow?: string | string[];
        }>;
    sitemap?: string | string[];
    host?: string;
  }
}
