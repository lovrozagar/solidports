import { createComponent, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Slider } from '@solidports/base-ui/slider';

/*
 * Slider across hydration (D33 server batch, S.3). Plain sliders render natively on the server and
 * the hydrating client; an edge-aligned (inset) slider's last thumb renders the prehydration script,
 * which positions the thumbs and the indicator from the server markup before hydration. The guards
 * force a path through props whose shape both compiles give alike.
 */

const [renderFlag] = createSignal(false);
const thumbSpread = { 'aria-label': 'spread thumb' };
let forwardTarget: HTMLElement | undefined;
let getterTarget: HTMLElement | undefined;

function ForwardRef(props: { ref?: Slider.Thumb.Props['ref'] }) {
  return <Slider.Thumb ref={props.ref} index={0} data-testid="d-ref-forward" />;
}

const track = { width: '200px', height: '10px', position: 'relative' } as const;

export function SliderFixture() {
  return (
    <div>
      <Slider.Root data-testid="a-root" defaultValue={30} style={{ width: '200px' }}>
        <Slider.Label data-testid="a-label">Volume</Slider.Label>
        <Slider.Value data-testid="a-value" />
        <Slider.Control data-testid="a-control">
          <Slider.Track data-testid="a-track" style={track}>
            <Slider.Indicator data-testid="a-indicator" />
            <Slider.Thumb data-testid="a-thumb" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <Slider.Root
        data-testid="b-root"
        defaultValue={30}
        thumbAlignment="edge"
        style={{ width: '200px' }}
      >
        <Slider.Control data-testid="b-control">
          <Slider.Track data-testid="b-track" style={track}>
            <Slider.Indicator data-testid="b-indicator" />
            <Slider.Thumb data-testid="b-thumb" style={{ width: '10px', height: '10px' }} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <Slider.Root
        data-testid="c-root"
        defaultValue={[30, 60]}
        thumbAlignment="edge"
        style={{ width: '200px' }}
      >
        <Slider.Control data-testid="c-control">
          <Slider.Track data-testid="c-track" style={track}>
            <Slider.Indicator data-testid="c-indicator" />
            <Slider.Thumb
              index={0}
              data-testid="c-thumb-0"
              style={{ width: '10px', height: '10px' }}
            />
            <Slider.Thumb
              index={1}
              data-testid="c-thumb-1"
              style={{ width: '10px', height: '10px' }}
            />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <Slider.Root data-testid="d-root" defaultValue={[10, 20, 30, 40]} style={{ width: '200px' }}>
        <Slider.Control data-testid="d-control">
          <Slider.Track data-testid="d-track" style={track}>
            <ForwardRef
              ref={(el: HTMLElement | null) => {
                forwardTarget = el ?? undefined;
              }}
            />
            <Slider.Thumb
              index={1}
              data-testid="d-render-getter"
              render={renderFlag() ? 'span' : undefined}
            />
            <Slider.Thumb {...thumbSpread} index={2} data-testid="d-spread" />
            {
              createComponent(Slider.Thumb, {
                get ref() {
                  return (el: HTMLElement) => {
                    getterTarget = el;
                  };
                },
                index: 3,
                'data-testid': 'd-getter-ref',
              } as Slider.Thumb.Props) as unknown as JSX.Element
            }
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </div>
  );
}

export const forwardedRef = () => forwardTarget;
export const getterRef = () => getterTarget;

/** `count` plain sliders: a budget's copies. */
export function SliderBudget(props: { count: number }) {
  return (
    <div>
      {Array.from({ length: props.count }, () => (
        <Slider.Root defaultValue={30}>
          <Slider.Control>
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ))}
    </div>
  );
}

/**
 * A part as-is, or forced onto the slow path on both sides by a getter `ref` (the one shape the
 * compiles agree is dynamic): the scripted sliders' native and slow renders.
 */
function part<P extends object>(slow: boolean, component: (props: P) => JSX.Element, props: P) {
  if (!slow) {
    return createComponent(component, props);
  }
  // The descriptors, not a spread: a spread would read the `children` getter outside the root.
  const forced = Object.defineProperties({}, Object.getOwnPropertyDescriptors(props)) as P;
  Object.defineProperty(forced, 'ref', { get: () => undefined, enumerable: true });
  return createComponent(component, forced);
}

/**
 * The inset sliders the prehydration script positions, one thumb and a range, every part native
 * or every part on the slow path.
 */
export function ScriptedSliders(props: { slow: boolean }) {
  const thumbStyle = { width: '10px', height: '10px' };
  return (
    <div>
      {part(props.slow, Slider.Root, {
        'data-testid': 'b-root',
        defaultValue: 30,
        thumbAlignment: 'edge',
        style: { width: '200px' },
        get children() {
          return part(props.slow, Slider.Control, {
            get children() {
              return (
                <Slider.Track style={track}>
                  {part(props.slow, Slider.Indicator, { 'data-testid': 'b-indicator' } as Slider.Indicator.Props)}
                  {part(props.slow, Slider.Thumb, { 'data-testid': 'b-thumb', style: thumbStyle })}
                </Slider.Track>
              );
            },
          } as Slider.Control.Props);
        },
      } as Slider.Root.Props)}
      {part(props.slow, Slider.Root, {
        'data-testid': 'c-root',
        defaultValue: [30, 60],
        thumbAlignment: 'edge',
        style: { width: '200px' },
        get children() {
          return part(props.slow, Slider.Control, {
            get children() {
              return (
                <Slider.Track style={track}>
                  {part(props.slow, Slider.Indicator, { 'data-testid': 'c-indicator' } as Slider.Indicator.Props)}
                  {part(props.slow, Slider.Thumb, {
                    index: 0,
                    'data-testid': 'c-thumb-0',
                    style: thumbStyle,
                  })}
                  {part(props.slow, Slider.Thumb, {
                    index: 1,
                    'data-testid': 'c-thumb-1',
                    style: thumbStyle,
                  })}
                </Slider.Track>
              );
            },
          } as Slider.Control.Props);
        },
      } as Slider.Root.Props)}
    </div>
  );
}
