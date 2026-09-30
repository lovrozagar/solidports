interface NavigatorUAData {
  brands: Array<{ brand: string; version: string }>;
  mobile: boolean;
  platform: string;
}

const hasNavigator = typeof navigator !== 'undefined';

const nav = getNavigatorData();
const platform = getPlatform();
const userAgent = getUserAgent();

export const isWebKit =
  typeof CSS === 'undefined' || !CSS.supports
    ? false
    : CSS.supports('-webkit-backdrop-filter:none');

export const isIOS =
  nav.platform === 'MacIntel' && nav.maxTouchPoints > 1
    ? true
    : /iP(hone|ad|od)|iOS/.test(nav.platform);

export const isFirefox = hasNavigator && /firefox/i.test(userAgent);
export const isSafari = hasNavigator && /apple/i.test(navigator.vendor);
export const isEdge = hasNavigator && /Edg/i.test(userAgent);
export const isAndroid = (hasNavigator && /android/i.test(platform)) || /android/i.test(userAgent);
export const isMac =
  hasNavigator && platform.toLowerCase().startsWith('mac') && !navigator.maxTouchPoints;
export const isJSDOM = userAgent.includes('jsdom/');

function getNavigatorData(): { platform: string; maxTouchPoints: number } {
  if (!hasNavigator) {
    return { maxTouchPoints: -1, platform: '' };
  }

  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;

  if (uaData?.platform) {
    return {
      maxTouchPoints: navigator.maxTouchPoints,
      platform: uaData.platform,
    };
  }

  return {
    maxTouchPoints: navigator.maxTouchPoints ?? -1,
    platform: navigator.platform ?? '',
  };
}

function getUserAgent(): string {
  if (!hasNavigator) {
    return '';
  }

  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;

  if (uaData && Array.isArray(uaData.brands)) {
    return uaData.brands.map(({ brand, version }) => `${brand}/${version}`).join(' ');
  }

  return navigator.userAgent;
}

function getPlatform(): string {
  if (!hasNavigator) {
    return '';
  }

  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;

  if (uaData?.platform) {
    return uaData.platform;
  }

  return navigator.platform ?? '';
}
