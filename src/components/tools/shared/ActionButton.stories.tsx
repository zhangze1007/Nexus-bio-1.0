import type { Meta, StoryObj } from '@storybook/react';
import ActionButton from './ActionButton';

const meta: Meta<typeof ActionButton> = {
  title: 'Shared/ActionButton',
  component: ActionButton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ActionButton>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Run FBA',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Reset',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Clear Results',
  },
};

export const Disabled: Story = {
  args: {
    variant: 'primary',
    children: 'Run FBA',
    disabled: true,
  },
};

export const SmallSize: Story = {
  args: {
    variant: 'primary',
    children: 'Submit',
    size: 'sm',
  },
};

export const LargeSize: Story = {
  args: {
    variant: 'primary',
    children: 'Calculate Pathway',
    size: 'lg',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
      <ActionButton variant="primary">Primary</ActionButton>
      <ActionButton variant="secondary">Secondary</ActionButton>
      <ActionButton variant="destructive">Destructive</ActionButton>
    </div>
  ),
};
