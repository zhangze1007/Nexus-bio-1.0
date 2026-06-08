/**
 * Shared Recharts tooltip prop interfaces.
 *
 * Recharts does not ship its own TypeScript types for tooltip render props,
 * so every custom tooltip component needs the same shape.  Defining it once
 * here avoids `any` annotations across the codebase.
 */

/** A single entry inside the Recharts tooltip `payload` array. */
export interface ChartEntryProps {
  value?: number | string | readonly (number | string)[];
  name?: string | number;
  dataKey?: string;
  payload: Record<string, unknown>;
  color?: string;
}

/** Props passed to a custom Recharts tooltip content component. */
export interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly ChartEntryProps[];
  label?: string | number;
}
