import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RecipesView from './RecipesView';

function renderView() {
  render(<RecipesView recipes={[]} pantry={[]} currency="PHP" onCreate={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} onImport={vi.fn()} onImportRecipes={vi.fn()} />);
}

describe('RecipesView add menu', () => {
  it('offers the five add choices in one menu and no standalone import buttons', async () => {
    const user = userEvent.setup();
    renderView();
    expect(screen.queryByRole('button', { name: 'Import recipe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import JSON' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['New recipe', 'From URL', 'Paste text', 'From JSON file', 'From photo']);
  });

  it('New recipe opens the editor', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('menuitem', { name: 'New recipe' }));
    expect(screen.getByRole('heading', { name: 'Add recipe' })).toBeInTheDocument();
  });

  it('Paste text opens the import panel already in paste mode', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('menuitem', { name: 'Paste text' }));
    expect(screen.getByLabelText('Recipe content')).toBeInTheDocument();
  });

  it('Export JSON lives in the overflow menu', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Export JSON' })).toBeInTheDocument();
  });
});
