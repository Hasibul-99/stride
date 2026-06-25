import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils';
import { OtpInput } from './OtpInput';

describe('OtpInput', () => {
  it('types digits, auto-advances, and fires onComplete', async () => {
    const onComplete = vi.fn();
    const onChange = vi.fn();
    const { user } = render(<OtpInput onChange={onChange} onComplete={onComplete} />);

    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(boxes).toHaveLength(4);

    await user.type(boxes[0], '1');
    await user.type(boxes[1], '2');
    await user.type(boxes[2], '3');
    await user.type(boxes[3], '4');

    expect(onComplete).toHaveBeenCalledWith('1234');
    expect(onChange).toHaveBeenLastCalledWith('1234');
  });

  it('ignores non-numeric input', async () => {
    const onChange = vi.fn();
    const { user } = render(<OtpInput onChange={onChange} autoFocus={false} />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];

    await user.type(boxes[0], 'a');
    expect(boxes[0].value).toBe('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('backspace clears and moves to the previous box', async () => {
    const onChange = vi.fn();
    const { user } = render(<OtpInput onChange={onChange} />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];

    await user.type(boxes[0], '1');
    await user.type(boxes[1], '2');
    expect(boxes[1].value).toBe('2');

    await user.keyboard('{Backspace}'); // clears box 1
    expect(boxes[1].value).toBe('');
    await user.keyboard('{Backspace}'); // moves to + clears box 0
    expect(boxes[0].value).toBe('');
  });

  it('pastes a full code across the boxes', async () => {
    const onComplete = vi.fn();
    const { user } = render(<OtpInput onChange={() => {}} onComplete={onComplete} />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];

    boxes[0].focus();
    await user.paste('5678');

    expect(boxes.map((b) => b.value).join('')).toBe('5678');
    expect(onComplete).toHaveBeenCalledWith('5678');
  });
});
