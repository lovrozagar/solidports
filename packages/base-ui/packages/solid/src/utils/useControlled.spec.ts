import type { Accessor } from 'solid-js';
import { expectType } from './testUtils';
import { useControlled } from './useControlled';
import type { ControlledSetter } from './useControlled';

function AcceptsOptionalDefault(props: { open?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useControlled({
    controlled: () => props.open,
    default: () => props.defaultOpen,
    name: 'Popup',
  });

  expectType<Accessor<boolean | undefined>, typeof open>(open);
  expectType<ControlledSetter<boolean | undefined>, typeof setOpen>(setOpen);
}

function AcceptsDefinedDefault(props: { open?: boolean }) {
  const [open, setOpen] = useControlled({
    controlled: () => props.open,
    default: false,
    name: 'Popup',
  });

  expectType<Accessor<boolean>, typeof open>(open);
  expectType<ControlledSetter<boolean>, typeof setOpen>(setOpen);
}

function AcceptsOptionalDefaultWithExplicitType(props: { open?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useControlled<boolean>({
    controlled: () => props.open,
    default: () => props.defaultOpen,
    name: 'Popup',
  });

  expectType<Accessor<boolean | undefined>, typeof open>(open);
  expectType<ControlledSetter<boolean | undefined>, typeof setOpen>(setOpen);
}

function AcceptsDefinedDefaultWithExplicitType(props: { open?: boolean }) {
  const [open, setOpen] = useControlled<boolean>({
    controlled: () => props.open,
    default: false,
    name: 'Popup',
  });

  expectType<Accessor<boolean>, typeof open>(open);
  expectType<ControlledSetter<boolean>, typeof setOpen>(setOpen);
}

void AcceptsOptionalDefault;
void AcceptsDefinedDefault;
void AcceptsOptionalDefaultWithExplicitType;
void AcceptsDefinedDefaultWithExplicitType;
