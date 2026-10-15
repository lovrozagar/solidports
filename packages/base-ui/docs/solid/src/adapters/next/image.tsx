// `next/image` for the Solid docs: an `<img>` with Next's sizing and loading props (the docs
// export statically, so images are served as they are).
import { createMemo, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';

export interface StaticImageData {
  src: string;
  height: number;
  width: number;
  blurDataURL?: string;
}

export interface ImageProps extends Omit<
  JSX.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'width' | 'height' | 'loading'
> {
  src: string | StaticImageData | { default: StaticImageData };
  alt: string;
  width?: number | `${number}`;
  height?: number | `${number}`;
  fill?: boolean;
  priority?: boolean;
  quality?: number | `${number}`;
  placeholder?: string;
  blurDataURL?: string;
  unoptimized?: boolean;
  loading?: 'eager' | 'lazy';
  sizes?: string;
}

export default function Image(props: ImageProps) {
  const rest = omit(
    props,
    'alt',
    'src',
    'width',
    'height',
    'fill',
    'priority',
    'quality',
    'placeholder',
    'blurDataURL',
    'unoptimized',
    'loading',
    'style',
  );
  const data = createMemo(() => {
    const src = props.src;
    if (typeof src === 'string') {
      return { src };
    }
    return 'default' in src ? src.default : src;
  });
  const style = createMemo((): JSX.CSSProperties => ({
    ...(props.fill
      ? { position: 'absolute', inset: '0', width: '100%', height: '100%' }
      : undefined),
    ...(typeof props.style === 'object' ? props.style : undefined),
  }));
  return (
    <img
      {...rest}
      alt={props.alt}
      src={data().src}
      width={props.fill ? undefined : (props.width ?? (data() as StaticImageData).width)}
      height={props.fill ? undefined : (props.height ?? (data() as StaticImageData).height)}
      loading={props.loading ?? (props.priority ? 'eager' : 'lazy')}
      fetchpriority={props.priority ? 'high' : undefined}
      decoding="async"
      style={style()}
    />
  );
}
