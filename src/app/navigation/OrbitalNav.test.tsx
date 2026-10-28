import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OrbitalNav, { type OrbitalSection } from './OrbitalNav';

describe('OrbitalNav', () => {
  it('renders every destination and marks the active button', () => {
    render(<OrbitalNav activeSection="planner" onChange={vi.fn()} />);

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    expect(navigation).toBeInTheDocument();
    expect(navigation).toHaveClass('top-nav');
    expect(navigation).not.toHaveAttribute('data-orbiting');
    expect(navigation).not.toHaveAttribute('data-orbit-motion');
    expect(screen.getByRole('button', { name: 'Recipes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pantry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Plan' })).toHaveClass('top-nav-item', 'active');
    expect(screen.getByRole('button', { name: 'Shopping' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
  });

  it('changes destination when a node is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(section: OrbitalSection) => void>();
    render(<OrbitalNav activeSection="planner" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Pantry' }));

    expect(onChange).toHaveBeenCalledWith('pantry');
  });

  it('uses native button focus for keyboard access', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(section: OrbitalSection) => void>();
    render(<OrbitalNav activeSection="planner" onChange={onChange} />);

    const pantryButton = screen.getByRole('button', { name: 'Pantry' });
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(pantryButton).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('pantry');
  });
});
