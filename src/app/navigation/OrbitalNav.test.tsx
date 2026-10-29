import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OrbitalNav, { type OrbitalSection } from './OrbitalNav';

describe('OrbitalNav', () => {
  it('renders every destination and marks the active button', () => {
    render(<OrbitalNav activeSection="plan" onChange={vi.fn()} />);

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(navigation).toBeInTheDocument();
    expect(navigation).toHaveClass('top-nav');
    expect(navigation).not.toHaveAttribute('data-orbiting');
    expect(navigation).not.toHaveAttribute('data-orbit-motion');
    expect(screen.getAllByRole('button').map((button) => button.textContent?.replace(/^\W+/, ''))).toEqual(['Plan', 'Shopping', 'Pantry', 'Recipes', 'Receipts']);
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveClass('top-nav-item', 'active');
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
    expect(screen.queryByText('Choose a workspace')).not.toBeInTheDocument();
  });

  it('changes destination when a node is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(section: OrbitalSection) => void>();
    render(<OrbitalNav activeSection="plan" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Pantry' }));

    expect(onChange).toHaveBeenCalledWith('pantry');
  });

  it('uses native button focus for keyboard access', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(section: OrbitalSection) => void>();
    render(<OrbitalNav activeSection="plan" onChange={onChange} />);

    const pantryButton = screen.getByRole('button', { name: 'Pantry' });
    await user.tab();
    await user.tab();
    await user.tab();
    expect(pantryButton).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('pantry');
  });

  it('renders the duotone icon for each destination, with the active one in single-color mode', () => {
    render(<OrbitalNav activeSection="pantry" onChange={vi.fn()} />);
    const icons = screen.getByRole('navigation').querySelectorAll('svg[data-icon]');
    expect([...icons].map((icon) => icon.getAttribute('data-icon'))).toEqual(['plan', 'shopping', 'pantry', 'recipes', 'receipts']);
    const pantryIcon = screen.getByRole('button', { name: 'Pantry' }).querySelector('svg');
    const planIcon = screen.getByRole('button', { name: 'Plan' }).querySelector('svg');
    expect(pantryIcon?.innerHTML).not.toContain('--np-icon-accent');
    expect(planIcon?.innerHTML).toContain('--np-icon-accent');
    expect(screen.getByRole('navigation').textContent).not.toMatch(/[▦◈◌✦▤]/);
  });
});
