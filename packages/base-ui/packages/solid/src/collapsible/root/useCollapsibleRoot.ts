import { createSignal, getObserver, getOwner, untrack } from 'solid-js';
import type { Accessor, Owner, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { access } from '../../solid-helpers';
import type { MaybeAccessor } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { createControlledDevChecks } from '../../utils/useControlled';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { useTransitionStatus } from '../../utils/useTransitionStatus';
import type { CollapsibleRoot, CollapsibleRootState } from './CollapsibleRoot';
import { runInLazyScope } from '../../utils/runInLazyScope';
import { createIdRegistry } from '../../utils/native/registration';

/** How the root's `open` is read, fixed by the first render as in React. */
type OpenMode = 'always' | 'controlled' | 'uncontrolled';

/**
 * A root's state keys as prototype getters, for the parts' precompiled attribute writers: creating
 * one costs far less than an object literal with own getters (`createRootState`).
 */
export class CollapsibleStateView {
  declare private readonly root: CollapsibleRootModel;

  constructor(root: CollapsibleRootModel) {
    this.root = root;
  }

  get open() {
    return this.root.open();
  }

  get disabled() {
    return this.root.disabled();
  }

  get transitionStatus() {
    return this.root.transitionStatus();
  }
}

/**
 * A collapsible root's state and actions, shared with its parts as `CollapsibleRootContext`.
 * Solid: the members are prototype methods, so a root allocates one object rather than a closure
 * per member. Call them on the object (`root.open()`); a callback that escapes is a field
 * (`handleTrigger`, `setPanelIdState`) or an arrow at the call site.
 */
export class CollapsibleRootModel {
  /** Solid: the root's owner (a part skips its unmount registration write while the root is disposed). */
  declare readonly owner: Owner | null;
  /** The panel's generated id, used until a panel registers its own. */
  declare readonly defaultPanelId: Accessor<JSX.HTMLAttributes<Element>['id']>;
  /** `undefined` uses the generated fallback; `null` means the panel unmounted. */
  declare readonly setPanelIdState: Setter<string | null | undefined>;
  /** Event handler called when the panel is opened or closed. */
  declare readonly onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /** What the parts' attribute writers read: `state`'s keys, live (see `CollapsibleStateView`). */
  declare readonly stateView: CollapsibleStateView;
  /** Toggles the panel from a trigger's press. A field: triggers pass it on as a callback. */
  declare readonly handleTrigger: (event: MouseEvent | KeyboardEvent) => void;

  declare private readonly parameters: UseCollapsibleRootParameters;
  declare private readonly mode: OpenMode;
  /** The initial default: the value of a controlled root whose `open` becomes `undefined`. */
  declare private readonly fallback: boolean;
  declare private readonly readOpen: Accessor<boolean> | undefined;
  declare private readonly writeOpen: Setter<boolean> | undefined;
  /** Untracked reads (event handlers, effect callbacks) see the latest write at once. */
  declare private latestWrite: boolean | undefined;
  declare private transition: ReturnType<typeof useTransitionStatus> | undefined;
  declare private readonly registeredPanelId: Accessor<string | null | undefined>;
  declare private publicState: CollapsibleRootState | undefined;

  constructor(parameters: UseCollapsibleRootParameters, staticOpen: boolean) {
    this.parameters = parameters;
    // Solid: a handler reading the latest parameter is React's stable callback.
    this.onOpenChange = (open, eventDetails) => parameters.onOpenChange?.(open, eventDetails);
    // Every member is assigned in the same order on every root, so roots share one shape.
    this.readOpen = undefined;
    this.writeOpen = undefined;
    this.latestWrite = undefined;
    this.transition = undefined;
    if (parameters.alwaysControlled) {
      this.mode = 'always';
      this.fallback = false;
    } else {
      // A controlled root reads `open` directly (no memo: reading a prop is as cheap); an
      // uncontrolled one keeps its value in a signal.
      const controlled = untrack(() => access(parameters.open));
      const initial = Boolean(untrack(() => access(parameters.defaultOpen)));
      this.fallback = initial;
      if (controlled !== undefined) {
        this.mode = 'controlled';
      } else {
        this.mode = 'uncontrolled';
        [this.readOpen, this.writeOpen] = createSignal(initial);
      }
      if (process.env.NODE_ENV !== 'production' && !staticOpen) {
        createControlledDevChecks(
          () => access(parameters.open),
          () => access(parameters.defaultOpen),
          this.mode === 'controlled',
          'Collapsible',
          () => 'open',
        );
      }
    }

    // A root that starts closed has no transition until it first opens: its status machinery
    // (two computed signals) is created then, owned by the root, and reads before that return the
    // closed values (`mounted` false, status `undefined`). Every reader also reads `open`, so it
    // re-runs on the first open and creates the machinery; `animateInitialOpen` makes that open
    // enter `'starting'`, as an eagerly created instance does when it goes from closed to open.
    this.owner = getOwner();
    if (untrack(() => this.open())) {
      this.transition = useTransitionStatus(() => this.open(), true, true);
    }

    this.defaultPanelId = useBaseUiId();
    [this.registeredPanelId, this.setPanelIdState] = createIdRegistry();

    this.publicState = undefined;
    this.stateView = new CollapsibleStateView(this);
    this.handleTrigger = (event) => this.toggle(event);
  }

  /**
   * The state the parts render (`open`, `disabled`, `transitionStatus`, read live), as consumer
   * functions and render props receive it. Created on first read.
   */
  get state(): CollapsibleRootState {
    this.publicState ??= createRootState(this);
    return this.publicState;
  }

  /** Whether the collapsible panel is currently open. */
  open(): boolean {
    if (this.mode === 'uncontrolled') {
      if (getObserver() !== null) {
        return this.readOpen!();
      }
      return this.latestWrite ?? untrack(this.readOpen!);
    }
    const open = access(this.parameters.open);
    if (this.mode === 'always') {
      return Boolean(open);
    }
    return open !== undefined ? open : this.fallback;
  }

  /** Sets the open state of an uncontrolled root; a controlled root ignores it. */
  setOpen(open: boolean) {
    if (this.mode === 'uncontrolled') {
      this.latestWrite = open;
      this.writeOpen!(open);
    }
  }

  /** Whether the component should ignore user interaction. */
  disabled(): boolean {
    return Boolean(access(this.parameters.disabled));
  }

  /**
   * Whether the collapsible panel is mounted for transition and hidden-state purposes. This can
   * be `false` while the element remains in the DOM when `keepMounted` or `hiddenUntilFound` is
   * enabled.
   */
  mounted(): boolean {
    return this.ensureTransition()?.mounted() ?? false;
  }

  transitionStatus(): TransitionStatus {
    return this.ensureTransition()?.transitionStatus();
  }

  setMounted(mounted: boolean) {
    if (this.transition === undefined) {
      if (!mounted) {
        return;
      }
      this.createTransition();
    }
    this.transition!.setMounted(mounted);
  }

  /** The panel's id: the registered one, or the generated fallback. */
  panelId(): JSX.HTMLAttributes<Element>['id'] {
    const registered = this.registeredPanelId();
    return registered === null ? undefined : (registered ?? this.defaultPanelId());
  }

  private toggle(event: MouseEvent | KeyboardEvent) {
    const nextOpen = !this.open();
    const eventDetails = createChangeEventDetails(REASONS.triggerPress, event);

    this.onOpenChange(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    this.setOpen(nextOpen);
  }

  private createTransition() {
    this.transition ??= runInLazyScope(this.owner, () =>
      untrack(() => useTransitionStatus(() => this.open(), true, true, true)),
    )!;
    return this.transition;
  }

  private ensureTransition() {
    if (this.transition === undefined && this.open()) {
      this.createTransition();
    }
    return this.transition;
  }
}

export interface UseCollapsibleRootParameters {
  /**
   * Solid: `open` is always a defined accessor (the root never switches mode), so the value is
   * read directly and `setOpen` is a no-op, as a controlled root behaves.
   */
  alwaysControlled?: boolean | undefined;
  /**
   * Whether the collapsible panel is currently open.
   *
   * To render an uncontrolled collapsible, use the `defaultOpen` prop instead.
   */
  open?: MaybeAccessor<boolean | undefined> | undefined;
  /**
   * Whether the collapsible panel is initially open.
   *
   * To render a controlled collapsible, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: MaybeAccessor<boolean | undefined> | undefined;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange?:
    | ((open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: MaybeAccessor<boolean | undefined> | undefined;
}

/**
 * `staticOpen`: `open` and `defaultOpen` read static props, so the dev change checks are skipped
 * (they report changes only).
 */
export function useCollapsibleRoot(
  parameters: UseCollapsibleRootParameters,
  staticOpen = false,
): CollapsibleRootModel {
  return new CollapsibleRootModel(parameters, staticOpen);
}

/** A root's state: own getters, so a consumer can spread or compare it like a plain object. */
function createRootState(root: CollapsibleRootModel): CollapsibleRootState {
  return {
    get open() {
      return root.open();
    },
    get disabled() {
      return root.disabled();
    },
    get transitionStatus() {
      return root.transitionStatus();
    },
  };
}

export type UseCollapsibleRootReturnValue = CollapsibleRootModel;

/**
 * The root members `useCollapsiblePanel` takes, bound to `root`. Created when a panel renders, so
 * a closed panel pays for none of them.
 */
export function panelRootParameters(root: CollapsibleRootModel) {
  return {
    mounted: () => root.mounted(),
    onOpenChange: root.onOpenChange,
    open: () => root.open(),
    setMounted: (mounted: boolean) => root.setMounted(mounted),
    setOpen: (open: boolean) => root.setOpen(open),
    transitionStatus: () => root.transitionStatus(),
  };
}

export interface UseCollapsibleRootState {}

export namespace useCollapsibleRoot {
  export type Parameters = UseCollapsibleRootParameters;
  export type ReturnValue = UseCollapsibleRootReturnValue;
}
