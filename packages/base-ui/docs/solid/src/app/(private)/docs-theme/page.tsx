import { createMemo, For } from 'solid-js';
import { reactStyle } from 'docs/src/adapters/react';
import type { JSX } from '@solidjs/web';
import type { Metadata } from 'docs/src/adapters/next';
import 'docs/src/css/index.css';
import styles from './page.module.css';

const coreScaleSteps = ['s1', 's2', 'c1', 'c2', 'c3', 'p1', 'p2', 't1', 't2'] as const;
const coreColorRows = ['gray', 'indigo'] as const;
const accentColorRows = ['poppy', 'blue', 'green', 'orange', 'pink', 'grape', 'lime'] as const;
const alphaColorRows = ['blackA'] as const;
const alphaScaleSteps = ['1', '2', '3', '4', '5', '6'] as const;
const allCoreRows = [...coreColorRows, ...accentColorRows];
const typefaces = [
  {
    token: 'font-sans',
    sample: 'Die Grotesk A for UI copy',
  },
  {
    token: 'font-sans-b',
    sample: 'Die Grotesk B for headings',
  },
  {
    token: 'font-mono',
    sample: 'Paper Mono for code and data',
  },
  {
    token: 'font-serif',
    sample: 'Georgia for editorial accents',
  },
] as const;
const fontWeights = [
  {
    token: 'font-weight-400',
    sample: 'Regular',
  },
  {
    token: 'font-weight-700',
    sample: 'Bold',
  },
] as const;
const fontSizeScale = ['12', '14', '15', '16', '18', '21', '24', '36', '42'] as const;
const spaceScale = ['4', '8', '12', '16', '20', '24', '28', '32', '40', '48'] as const;
const radiusScale = ['2', '3', '4', '6', '8', '12', '16', 'pill', 'circle'] as const;
const shadows = ['1', '2', '3', '4', '5'] as const;
export default function ThemePage() {
  return (
    <main class={styles.page}>
      <header class={styles.hero}>
        <p class={styles.kicker}>
          <span aria-hidden="true">🔒</span> Private
        </p>
        <h1>Docs Theme</h1>
      </header>

      <section class={styles.section}>
        <div class={styles.colorMatrixSection}>
          <div class={styles.colorMatrixGrid}>
            <div class={styles.colorMatrixRow}>
              <div class={styles.colorMatrixHeaderCell} />
              <For each={coreScaleSteps}>
                {(step) => <div class={styles.colorMatrixHeaderCell}>{step}</div>}
              </For>
            </div>

            <For each={allCoreRows}>
              {(row) => {
                const _row = createMemo(() => {
                  const isAccentRow = accentColorRows.includes(
                    row as (typeof accentColorRows)[number],
                  );
                  return (
                    <div class={styles.colorMatrixRow}>
                      <div class={styles.colorMatrixRowLabel}>{row}</div>
                      <For each={coreScaleSteps}>
                        {(step) => {
                          const _row2 = createMemo(() => {
                            if (isAccentRow && step !== 't1') {
                              return <div />;
                            }
                            const token = isAccentRow ? `${row}-t1` : `${row}-${step}`;
                            const swatchStyle = {
                              backgroundColor: `var(--${token})`,
                              '--swatch-color': `var(--${token})`,
                            } as JSX.CSSProperties;
                            return (
                              <div class={styles.colorMatrixCell}>
                                <div class={styles.swatch} style={reactStyle(swatchStyle)}>
                                  <span class={styles.swatchTokenName}>--{token}</span>
                                </div>
                              </div>
                            );
                          });
                          return <>{_row2()}</>;
                        }}
                      </For>
                    </div>
                  );
                });
                return <>{_row()}</>;
              }}
            </For>
          </div>
        </div>

        <div class={styles.colorMatrixSection}>
          <div class={styles.colorMatrixGrid}>
            <div class={styles.colorMatrixRow}>
              <div class={styles.colorMatrixHeaderCell} />
              <For each={alphaScaleSteps}>
                {(step) => <div class={styles.colorMatrixHeaderCell}>{step}</div>}
              </For>
            </div>

            <For each={alphaColorRows}>
              {(row) => (
                <div class={`${styles.colorMatrixRow} ${styles.colorMatrixRowAlpha}`}>
                  <div class={styles.colorMatrixRowLabel}>{row}</div>
                  <For each={alphaScaleSteps}>
                    {(step) => {
                      const _row3 = createMemo(() => {
                        const token = `${row}-${step}`;
                        const swatchStyle = {
                          backgroundColor: `var(--${token})`,
                          '--swatch-color': `var(--${token})`,
                        } as JSX.CSSProperties;
                        return (
                          <div class={styles.colorMatrixCell}>
                            <div class={styles.swatch} style={reactStyle(swatchStyle)}>
                              <span class={styles.swatchTokenName}>--{token}</span>
                            </div>
                          </div>
                        );
                      });
                      return <>{_row3()}</>;
                    }}
                  </For>
                </div>
              )}
            </For>
          </div>
        </div>
      </section>

      <section class={styles.section}>
        <div class={styles.typeGrid}>
          <For each={typefaces}>
            {(typeface) => (
              <article class={styles.typeCard}>
                <p class={styles.tokenName}>--{typeface.token}</p>
                <p
                  class={styles.typeSample}
                  style={reactStyle({
                    fontFamily: `var(--${typeface.token})`,
                  })}
                >
                  {typeface.sample}
                </p>
              </article>
            )}
          </For>
        </div>
      </section>

      <section class={styles.section}>
        <div class={styles.typeScale}>
          <For each={fontSizeScale}>
            {(step) => (
              <article class={styles.typeScaleRow}>
                <p class={styles.tokenName}>--font-size-{step}</p>
                <p
                  style={reactStyle({
                    fontFamily: 'var(--font-sans)',
                    fontSize: `var(--font-size-${step})`,
                  })}
                >
                  The quick brown fox jumps over the lazy dog.
                </p>
              </article>
            )}
          </For>
        </div>
      </section>

      <section class={styles.section}>
        <div class={styles.typeGrid}>
          <For each={fontWeights}>
            {(weight) => (
              <article class={styles.typeCard}>
                <p class={styles.tokenName}>--{weight.token}</p>
                <p
                  class={styles.typeSample}
                  style={reactStyle({
                    fontFamily: 'var(--font-sans)',
                    fontWeight: `var(--${weight.token})`,
                  })}
                >
                  {weight.sample}
                </p>
              </article>
            )}
          </For>
        </div>
      </section>

      <section class={styles.section}>
        <div class={styles.spaceList}>
          <For each={spaceScale}>
            {(step) => (
              <article class={styles.spaceRow}>
                <p class={styles.tokenName}>--space-{step}</p>
                <div
                  class={styles.spaceBar}
                  style={reactStyle({
                    width: `var(--space-${step})`,
                  })}
                />
              </article>
            )}
          </For>
        </div>
      </section>

      <section class={styles.section}>
        <div class={styles.radiusGrid}>
          <For each={radiusScale}>
            {(step) => (
              <article class={styles.radiusCard}>
                <p class={styles.tokenName}>--radius-{step}</p>
                <div
                  class={`${styles.radiusShape} ${step === 'pill' ? styles.radiusShapePill : styles.radiusShapeSquare}`}
                  style={reactStyle({
                    borderRadius: `var(--radius-${step})`,
                  })}
                />
              </article>
            )}
          </For>
        </div>
      </section>

      <section class={styles.section}>
        <div class={styles.shadowGrid}>
          <For each={shadows}>
            {(step) => (
              <article class={styles.shadowCard}>
                <p class={styles.tokenName}>--shadow-{step}</p>
                <div
                  class={styles.shadowSurface}
                  style={reactStyle({
                    boxShadow: `var(--shadow-${step})`,
                  })}
                />
              </article>
            )}
          </For>
        </div>
      </section>
    </main>
  );
}
export const metadata: Metadata = {
  title: 'Docs Theme',
  robots: {
    index: false,
    follow: false,
  },
};
