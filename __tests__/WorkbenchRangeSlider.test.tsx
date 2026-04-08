import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkbenchRangeSlider from '../src/components/tools/shared/WorkbenchRangeSlider';

describe('WorkbenchRangeSlider', () => {
  it('keeps the rendered value and fill in sync with prop updates', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      React.createElement(WorkbenchRangeSlider, {
        label: 'Gain',
        value: 2,
        min: 0,
        max: 10,
        step: 1,
        onChange,
      }),
    );

    let input = screen.getByLabelText('Gain') as HTMLInputElement;
    expect(input.value).toBe('2');
    expect(input.style.getPropertyValue('--val')).toBe('20%');

    rerender(
      React.createElement(WorkbenchRangeSlider, {
        label: 'Gain',
        value: 7,
        min: 0,
        max: 10,
        step: 1,
        onChange,
      }),
    );

    input = screen.getByLabelText('Gain') as HTMLInputElement;
    expect(input.value).toBe('7');
    expect(input.style.getPropertyValue('--val')).toBe('70%');

    fireEvent.change(input, { target: { value: '9' } });
    expect(onChange).toHaveBeenCalledWith(9);
  });
});
