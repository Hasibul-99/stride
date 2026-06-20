import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen } from '@/test/utils';
import { TimeEstimateInput } from './TimeEstimateInput';

describe('TimeEstimateInput', () => {
  it('parses "1h 30m" to 90 minutes on blur', async () => {
    const onCommit = vi.fn();
    const { user } = render(<TimeEstimateInput minutes={null} onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Time estimate' });
    await user.type(input, '1h 30m');
    await user.tab(); // blur
    expect(onCommit).toHaveBeenCalledWith(90);
    expect(input).toHaveValue('1h 30m'); // normalized display
  });

  it('shows the error state for unparseable input and does not commit', async () => {
    const onCommit = vi.fn();
    const { user } = render(<TimeEstimateInput minutes={null} onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Time estimate' });
    await user.type(input, 'soon-ish');
    await user.tab();
    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('commits null when cleared', async () => {
    const onCommit = vi.fn();
    const { user } = render(<TimeEstimateInput minutes={60} onCommit={onCommit} />);
    const input = screen.getByRole('textbox', { name: 'Time estimate' });
    await user.clear(input);
    await user.tab();
    expect(onCommit).toHaveBeenCalledWith(null);
  });

  it('seeds its display from the minutes prop', () => {
    render(<TimeEstimateInput minutes={90} onCommit={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Time estimate' })).toHaveValue('1h 30m');
  });

  it('has no a11y violations', async () => {
    const { container } = render(<TimeEstimateInput minutes={90} onCommit={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
