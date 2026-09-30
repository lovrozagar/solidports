/* V1 hardcoded sitemap mirroring upstream's `createSitemap` output shape.
   Keys match upstream: Overview / Handbook / Components / Utils. Prefixes use /solid/.
   V4 may regenerate from MDX module metadata exports once the MDX copy lands. */

export interface SitemapPage {
  title: string
  path: string
  tags?: string[]
  isNew?: boolean
  isPreview?: boolean
}

export interface SitemapSection {
  title?: string
  prefix?: string
  pages: SitemapPage[]
}

export interface Sitemap {
  data: Record<string, SitemapSection>
}

export const sitemap: Sitemap = {
  data: {
    Overview: {
      prefix: "/solid/overview/",
      pages: [
        { title: "Quick start", path: "/solid/overview/quick-start" },
        { title: "Accessibility", path: "/solid/overview/accessibility" },
        { title: "Releases", path: "/solid/overview/releases" },
        { title: "About Base UI", path: "/solid/overview/about" },
      ],
    },
    Handbook: {
      prefix: "/solid/handbook/",
      pages: [
        { title: "Styling", path: "/solid/handbook/styling" },
        { title: "Animation", path: "/solid/handbook/animation" },
        { title: "Composition", path: "/solid/handbook/composition" },
        { title: "Customization", path: "/solid/handbook/customization" },
        { title: "Forms", path: "/solid/handbook/forms" },
        { title: "TypeScript", path: "/solid/handbook/typescript" },
      ],
    },
    Components: {
      prefix: "/solid/components/",
      pages: [
        { title: "Accordion", path: "/solid/components/accordion" },
        { title: "Alert Dialog", path: "/solid/components/alert-dialog" },
        { title: "Autocomplete", path: "/solid/components/autocomplete" },
        { title: "Avatar", path: "/solid/components/avatar" },
        { title: "Button", path: "/solid/components/button" },
        { title: "Checkbox", path: "/solid/components/checkbox" },
        { title: "Checkbox Group", path: "/solid/components/checkbox-group" },
        { title: "Collapsible", path: "/solid/components/collapsible" },
        { title: "Combobox", path: "/solid/components/combobox" },
        { title: "Context Menu", path: "/solid/components/context-menu" },
        { title: "Dialog", path: "/solid/components/dialog" },
        { title: "Drawer", path: "/solid/components/drawer", isPreview: true, tags: ["Preview"] },
        { title: "Field", path: "/solid/components/field" },
        { title: "Fieldset", path: "/solid/components/fieldset" },
        { title: "Form", path: "/solid/components/form" },
        { title: "Input", path: "/solid/components/input" },
        { title: "Menu", path: "/solid/components/menu" },
        { title: "Menubar", path: "/solid/components/menubar" },
        { title: "Meter", path: "/solid/components/meter" },
        { title: "Navigation Menu", path: "/solid/components/navigation-menu" },
        { title: "Number Field", path: "/solid/components/number-field" },
        { title: "OTP Field", path: "/solid/components/otp-field" },
        { title: "Popover", path: "/solid/components/popover" },
        { title: "Preview Card", path: "/solid/components/preview-card" },
        { title: "Progress", path: "/solid/components/progress" },
        { title: "Radio", path: "/solid/components/radio" },
        { title: "Scroll Area", path: "/solid/components/scroll-area" },
        { title: "Select", path: "/solid/components/select" },
        { title: "Separator", path: "/solid/components/separator" },
        { title: "Slider", path: "/solid/components/slider" },
        { title: "Switch", path: "/solid/components/switch" },
        { title: "Tabs", path: "/solid/components/tabs" },
        { title: "Toast", path: "/solid/components/toast" },
        { title: "Toggle", path: "/solid/components/toggle" },
        { title: "Toggle Group", path: "/solid/components/toggle-group" },
        { title: "Toolbar", path: "/solid/components/toolbar" },
        { title: "Tooltip", path: "/solid/components/tooltip" },
      ],
    },
    Utils: {
      prefix: "/solid/utils/",
      pages: [
        { title: "CSP Provider", path: "/solid/utils/csp-provider" },
        { title: "Direction Provider", path: "/solid/utils/direction-provider" },
        { title: "mergeProps", path: "/solid/utils/merge-props" },
        { title: "useRender", path: "/solid/utils/use-render" },
      ],
    },
  },
}
