import { createSignal, createUniqueId, type JSX } from 'solid-js';


import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import styles from './index.module.css';

const mainPermissions = ['view-dashboard', 'manage-users', 'access-reports'];
const userManagementPermissions = ['create-user', 'edit-user', 'delete-user', 'assign-roles'];

export default function PermissionsForm() {
  const id = createUniqueId();
  const [mainValue, setMainValue] = createSignal([]);
  const [managementValue, setManagementValue] = createSignal([]);

  return (
    <CheckboxGroup
      aria-labelledby={id}
      value={mainValue()}
      onValueChange={(value) => {
        if (value.includes('manage-users')) {
          setManagementValue(userManagementPermissions);
        } else if (managementValue().length === userManagementPermissions.length) {
          setManagementValue([]);
        }
        setMainValue(value);
      }}
      allValues={mainPermissions}
      class={styles.CheckboxGroup}
      style={{ marginLeft: '1rem' }}
    >
      <label class={styles.Item} id={id} style={{ marginLeft: '-1rem' }}>
        <Checkbox.Root
          class={styles.Checkbox}
          parent
          indeterminate={
            managementValue().length > 0 &&
            managementValue().length !== userManagementPermissions.length
          }
        >
          <Checkbox.Indicator
            class={styles.Indicator}
            render={(props, state) => (
              <span {...props}>{state.indeterminate ? <HorizontalRuleIcon /> : <CheckIcon />}</span>
            )}
          />
        </Checkbox.Root>
        User Permissions
      </label>

      <label class={styles.Item}>
        <Checkbox.Root value="view-dashboard" class={styles.Checkbox}>
          <Checkbox.Indicator class={styles.Indicator}>
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        View Dashboard
      </label>

      <label class={styles.Item}>
        <Checkbox.Root value="access-reports" class={styles.Checkbox}>
          <Checkbox.Indicator class={styles.Indicator}>
            <CheckIcon />
          </Checkbox.Indicator>
        </Checkbox.Root>
        Access Reports
      </label>

      <CheckboxGroup
        aria-labelledby="manage-users-caption"
        class={styles.CheckboxGroup}
        value={managementValue()}
        onValueChange={(value) => {
          if (value.length === userManagementPermissions.length) {
            setMainValue((prev) => Array.from(new Set([...prev, 'manage-users'])));
          } else {
            setMainValue((prev) => prev.filter((v) => v !== 'manage-users'));
          }
          setManagementValue(value);
        }}
        allValues={userManagementPermissions}
        style={{ marginLeft: '1rem' }}
      >
        <label class={styles.Item} id="manage-users-caption" style={{ marginLeft: '-1rem' }}>
          <Checkbox.Root class={styles.Checkbox} parent>
            <Checkbox.Indicator
              class={styles.Indicator}
              render={(props, state) => (
                <span {...props}>
                  {state.indeterminate ? <HorizontalRuleIcon /> : <CheckIcon />}
                </span>
              )}
            />
          </Checkbox.Root>
          Manage Users
        </label>

        <label class={styles.Item}>
          <Checkbox.Root value="create-user" class={styles.Checkbox}>
            <Checkbox.Indicator class={styles.Indicator}>
              <CheckIcon />
            </Checkbox.Indicator>
          </Checkbox.Root>
          Create User
        </label>

        <label class={styles.Item}>
          <Checkbox.Root value="edit-user" class={styles.Checkbox}>
            <Checkbox.Indicator class={styles.Indicator}>
              <CheckIcon />
            </Checkbox.Indicator>
          </Checkbox.Root>
          Edit User
        </label>

        <label class={styles.Item}>
          <Checkbox.Root value="delete-user" class={styles.Checkbox}>
            <Checkbox.Indicator class={styles.Indicator}>
              <CheckIcon />
            </Checkbox.Indicator>
          </Checkbox.Root>
          Delete User
        </label>

        <label class={styles.Item}>
          <Checkbox.Root value="assign-roles" class={styles.Checkbox}>
            <Checkbox.Indicator class={styles.Indicator}>
              <CheckIcon />
            </Checkbox.Indicator>
          </Checkbox.Root>
          Assign Roles
        </label>
      </CheckboxGroup>
    </CheckboxGroup>
  );
}

function CheckIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}

function HorizontalRuleIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      strokeWidth={1}
      {...props}
      style={{ display: 'block', ...props.style }}
    >
      <line
        x1="3"
        y1="12"
        x2="21"
        y2="12"
        stroke="currentColor"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
