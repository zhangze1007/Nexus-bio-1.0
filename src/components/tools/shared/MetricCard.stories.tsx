import type { Meta, StoryObj } from '@storybook/react';
import MetricCard from './MetricCard';

const meta: Meta<typeof MetricCard> = {
  title: 'Shared/MetricCard',
  component: MetricCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof MetricCard>;

export const Default: Story = {
  args: {
    label: 'Growth Rate',
    value: '0.87 h⁻¹',
  },
};

export const WithUnit: Story = {
  args: {
    label: 'ATP Yield',
    value: '38',
    unit: 'mol/mol',
    detail: 'Per glucose molecule under aerobic conditions',
  },
};

export const TrendUp: Story = {
  args: {
    label: 'Flux',
    value: '12.4',
    unit: 'mmol/gDW/h',
    trend: 'up',
    detail: 'Increased from previous iteration',
  },
};

export const TrendDown: Story = {
  args: {
    label: 'Biomass',
    value: '0.032',
    unit: 'h⁻¹',
    trend: 'down',
  },
};

export const SmallSize: Story = {
  args: {
    label: 'pH',
    value: '7.2',
    size: 'sm',
  },
};

export const LargeSize: Story = {
  args: {
    label: 'Production Titer',
    value: '24.6',
    unit: 'g/L',
    size: 'lg',
    trend: 'up',
    detail: 'Artemisinic acid titer after 72h fermentation',
  },
};

export const WithAccent: Story = {
  args: {
    label: 'Redox Balance',
    value: '1.02',
    accent: '#DDD0E8',
    detail: 'NADH/NAD+ ratio within optimal range',
  },
};
