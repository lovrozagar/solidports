import { Slider } from '@solidports/base-ui/slider';

export default function InsetSlider() {
  return (
    <Slider.Root thumbAlignment="edge" defaultValue={30}>
      <Slider.Control class="relative bg-gray-200 flex w-[120px] h-[20px] touch-none items-center select-none">
        <Slider.Thumb
          data-testid="thumb"
          class="size-[20px] rounded-full bg-red outline outline-1 outline-gray-300 select-none has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-blue-800"
        />
      </Slider.Control>
      <Slider.Value data-testid="output" />
    </Slider.Root>
  );
}
