import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen, within } from '@/test/utils';
import { makeStatus } from '@/test/factories';
import { StatusBadge, StatusSelect } from './StatusSelect';

const statuses = [
  makeStatus({ id: 's_new', name: 'New', color: 'slate', isDefault: true }),
  makeStatus({ id: 's_prog', name: 'In progress', color: 'blue' }),
  makeStatus({ id: 's_done', name: 'Completed', color: 'green', isCompleted: true }),
];

describe('StatusSelect', () => {
  it('lists every project status as an option', () => {
    render(<StatusSelect statuses={statuses} value="s_new" onChange={() => {}} />);
    const select = screen.getByRole('combobox', { name: 'Status' });
    const options = within(select).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['New', 'In progress', 'Completed ✓']);
    expect((select as HTMLSelectElement).value).toBe('s_new');
  });

  it('calls onChange with the selected status id', async () => {
    const onChange = vi.fn();
    const { user } = render(<StatusSelect statuses={statuses} value="s_new" onChange={onChange} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 's_prog');
    expect(onChange).toHaveBeenCalledWith('s_prog');
  });

  it('StatusBadge shows the name and a colored dot', () => {
    render(<StatusBadge status={{ name: 'In progress', color: 'blue' }} />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByTestId('status-dot')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<StatusSelect statuses={statuses} value="s_new" onChange={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
