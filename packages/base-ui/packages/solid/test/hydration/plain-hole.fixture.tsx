import { Accordion } from '@solidports/base-ui/accordion';
import { Button } from '@solidports/base-ui/button';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { Field } from '@solidports/base-ui/field';
import { Fieldset } from '@solidports/base-ui/fieldset';
import { Form } from '@solidports/base-ui/form';
import { Meter } from '@solidports/base-ui/meter';
import { NavigationMenu } from '@solidports/base-ui/navigation-menu';
import { NumberField } from '@solidports/base-ui/number-field';
import { OTPField } from '@solidports/base-ui/otp-field';
import { Progress } from '@solidports/base-ui/progress';
import { Separator } from '@solidports/base-ui/separator';
import { Slider } from '@solidports/base-ui/slider';
import { Tabs } from '@solidports/base-ui/tabs';

/*
 * Every part that renders natively on the server, each inside a plain element's JSX hole
 * (`<div>{part}</div>`), the shape a server-native Tabs.Panel failed in the docs (CI run
 * 40162124626): a part whose render returns a function there is called unscoped and takes the
 * parent's hydration ids. Conditional parts render shown and hidden.
 */
export function PlainHoleFixture() {
  return (
    <div>
      <div>
        <Button>Button</Button>
      </div>
      <div>
        <Separator />
      </div>
      <div>
        <Collapsible.Root defaultOpen>
          <div>
            <Collapsible.Trigger>Open</Collapsible.Trigger>
          </div>
          <div>
            <Collapsible.Panel>
              <p>Open panel</p>
            </Collapsible.Panel>
          </div>
        </Collapsible.Root>
        <Collapsible.Root>
          <div>
            <Collapsible.Trigger>Closed</Collapsible.Trigger>
          </div>
          <div>
            <Collapsible.Panel>
              <p>Closed panel</p>
            </Collapsible.Panel>
          </div>
        </Collapsible.Root>
      </div>
      <div>
        <Accordion.Root defaultValue={['a']}>
          <div>
            <Accordion.Item value="a">
              <div>
                <Accordion.Header>
                  <Accordion.Trigger>A</Accordion.Trigger>
                </Accordion.Header>
              </div>
              <div>
                <Accordion.Panel>
                  <p>Panel A</p>
                </Accordion.Panel>
              </div>
            </Accordion.Item>
          </div>
          <div>
            <Accordion.Item value="b">
              <div>
                <Accordion.Header>
                  <Accordion.Trigger>B</Accordion.Trigger>
                </Accordion.Header>
              </div>
              <div>
                <Accordion.Panel>
                  <p>Panel B</p>
                </Accordion.Panel>
              </div>
            </Accordion.Item>
          </div>
        </Accordion.Root>
      </div>
      <div>
        <Form>
          <div>
            <Fieldset.Root>
              <div>
                <Fieldset.Legend>Legend</Fieldset.Legend>
              </div>
              <div>
                <Field.Root name="name" invalid>
                  <div>
                    <Field.Label>Name</Field.Label>
                  </div>
                  <div>
                    <Field.Control defaultValue="Ada" />
                  </div>
                  <div>
                    <Field.Description>Description</Field.Description>
                  </div>
                  <div>
                    <Field.Error match>Shown error</Field.Error>
                  </div>
                  <div>
                    <Field.Error match="valueMissing">Hidden error</Field.Error>
                  </div>
                </Field.Root>
              </div>
            </Fieldset.Root>
          </div>
        </Form>
      </div>
      <div>
        <NumberField.Root defaultValue={3}>
          <div>
            <NumberField.Group>
              <div>
                <NumberField.Decrement>-</NumberField.Decrement>
              </div>
              <div>
                <NumberField.Input />
              </div>
              <div>
                <NumberField.Increment>+</NumberField.Increment>
              </div>
            </NumberField.Group>
          </div>
        </NumberField.Root>
      </div>
      <div>
        <OTPField.Root length={2}>
          <div>
            <OTPField.Input />
          </div>
          <div>
            <OTPField.Input />
          </div>
        </OTPField.Root>
      </div>
      <div>
        <Slider.Root defaultValue={30} thumbAlignment="edge">
          <div>
            <Slider.Label>Volume</Slider.Label>
          </div>
          <div>
            <Slider.Value />
          </div>
          <div>
            <Slider.Control>
              <div>
                <Slider.Track>
                  <div>
                    <Slider.Indicator />
                  </div>
                  <div>
                    <Slider.Thumb />
                  </div>
                </Slider.Track>
              </div>
            </Slider.Control>
          </div>
        </Slider.Root>
      </div>
      <div>
        <Meter.Root value={40}>
          <div>
            <Meter.Track>
              <div>
                <Meter.Indicator />
              </div>
            </Meter.Track>
          </div>
        </Meter.Root>
        <Progress.Root value={40}>
          <div>
            <Progress.Track>
              <div>
                <Progress.Indicator />
              </div>
            </Progress.Track>
          </div>
        </Progress.Root>
      </div>
      <div>
        <Tabs.Root defaultValue="one">
          <div>
            <Tabs.List>
              <div>
                <Tabs.Tab value="one">One</Tabs.Tab>
              </div>
              <div>
                <Tabs.Tab value="two">Two</Tabs.Tab>
              </div>
              <div>
                <Tabs.Indicator renderBeforeHydration />
              </div>
            </Tabs.List>
          </div>
          <div>
            <Tabs.Panel value="one">
              <p>Panel one</p>
            </Tabs.Panel>
          </div>
          <div>
            <Tabs.Panel value="two">
              <p>Panel two</p>
            </Tabs.Panel>
          </div>
        </Tabs.Root>
      </div>
      {/* Two conditional parts in one plain element: their ids follow each other's. */}
      <div>
        <Tabs.Root defaultValue="one">
          <Tabs.List>
            <Tabs.Tab value="one">One</Tabs.Tab>
            <Tabs.Tab value="two">Two</Tabs.Tab>
          </Tabs.List>
          <div>
            <Tabs.Panel value="one">
              <p>Shown panel</p>
            </Tabs.Panel>
            <Tabs.Panel value="two">
              <p>Hidden panel</p>
            </Tabs.Panel>
          </div>
        </Tabs.Root>
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Both</Collapsible.Trigger>
          <div>
            <Collapsible.Panel>
              <p>Open</p>
            </Collapsible.Panel>
            <p>After the panel</p>
          </div>
        </Collapsible.Root>
        <Field.Root name="pair" invalid>
          <Field.Control defaultValue="" />
          <div>
            <Field.Error match>Shown</Field.Error>
            <Field.Error match="valueMissing">Hidden</Field.Error>
            <p>After the errors</p>
          </div>
        </Field.Root>
        <Accordion.Root defaultValue={['x']}>
          <Accordion.Item value="x">
            <Accordion.Header>
              <Accordion.Trigger>X</Accordion.Trigger>
            </Accordion.Header>
            <div>
              <Accordion.Panel>
                <p>Panel X</p>
              </Accordion.Panel>
              <p>After panel X</p>
            </div>
          </Accordion.Item>
        </Accordion.Root>
      </div>
      <div>
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <div>
              <NavigationMenu.Item>
                <div>
                  <NavigationMenu.Link href="#a">Link</NavigationMenu.Link>
                </div>
              </NavigationMenu.Item>
            </div>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </div>
    </div>
  );
}
