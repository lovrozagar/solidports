import { createContext, createEffect, createMemo, onSettled, useContext } from 'solid-js';
import { createLayoutEffect } from 'docs/src/adapters/react';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useMediaQuery } from '@solidports/base-ui/unstable-use-media-query';
import { useTimeout } from '@base-ui/utils/useTimeout';

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}
export interface GoogleAnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  params?: Record<string, string | number | boolean>;
}
export interface GoogleAnalyticsContextValue {
  trackEvent: (event: GoogleAnalyticsEvent) => void;
}
export const GoogleAnalyticsContext = createContext<Accessor<GoogleAnalyticsContextValue | null>>(
  () => null,
);
export function useGoogleAnalytics() {
  return useContext(GoogleAnalyticsContext);
}
export interface GoogleAnalyticsProviderProps {
  id: string;
  productId: string;
  productCategoryId: string;
  codeStylingVariant: string | null;
  codeLanguage: string;
  currentRoute: string;
  userLanguage: string;
  children?: JSX.Element;
}
export function GoogleAnalyticsProvider(props: GoogleAnalyticsProviderProps) {
  const timeout = useTimeout();
  createLayoutEffect(
    () => [props.id],
    () => {
      window.dataLayer = window.dataLayer || [];
      const gtag: Gtag.Gtag = function gtag() {
        // gtag expects the Arguments object
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer.push(arguments);
      };
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', props.id, {
        send_page_view: false,
      });
    },
  );
  const trackPageView = () => {
    // Remove hash as it's never sent to the server
    // https://github.com/vercel/next.js/issues/25202
    const canonicalAsServer = window.location.pathname.replace(/#(.*)$/, '');

    // https://developers.google.com/analytics/devguides/collection/ga4/views?client_type=gtag
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: canonicalAsServer,
      productId: props.productId,
      productCategoryId: props.productCategoryId,
    });
  };
  createEffect(
    () => [props.currentRoute, trackPageView, timeout()],
    () => {
      timeout().start(0, trackPageView);
      return timeout().clear;
    },
  );
  createEffect(
    () => [props.codeLanguage],
    () => {
      window.gtag('set', 'user_properties', {
        codeVariant: props.codeLanguage,
      });
    },
  );
  createEffect(
    () => [props.codeStylingVariant],
    () => {
      window.gtag('set', 'user_properties', {
        codeStylingVariant: props.codeStylingVariant,
      });
    },
  );
  createEffect(
    () => [props.userLanguage],
    () => {
      window.gtag('set', 'user_properties', {
        userLanguage: props.userLanguage,
      });
    },
  );
  onSettled(() => {
    /**
     * Based on https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio#Monitoring_screen_resolution_or_zoom_level_changes
     * Adjusted to track 3 or more different ratios
     */
    function trackDevicePixelRatio() {
      const devicePixelRatio = Math.round(window.devicePixelRatio * 10) / 10;
      window.gtag('set', 'user_properties', {
        devicePixelRatio,
      });
    }
    trackDevicePixelRatio();
    const matchMedia: MediaQueryList = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    matchMedia.addEventListener('change', trackDevicePixelRatio);
    return () => {
      matchMedia.removeEventListener('change', trackDevicePixelRatio);
    };
  });
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)', {
    noSsr: true,
  });
  const preferredColorScheme = createMemo(() => (prefersDarkMode() ? 'dark' : 'light'));
  createEffect(
    () => [preferredColorScheme()],
    () => {
      window.gtag('set', 'user_properties', {
        colorSchemeOS: preferredColorScheme(),
      });
    },
  );
  const contextValue = createMemo<GoogleAnalyticsContextValue>(() => ({
    trackEvent({ category, action, label, params }) {
      window.gtag('event', category, {
        action,
        label,
        ...params,
      });
    },
  }));
  return <GoogleAnalyticsContext value={contextValue}>{props.children}</GoogleAnalyticsContext>;
}
