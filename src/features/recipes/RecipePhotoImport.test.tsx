import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RecipePhotoImport from './RecipePhotoImport';
import type { ReceiptOcrController, ReceiptOcrFragment } from '../receipt/receiptOcr';

const fragment = (text: string, y: number): ReceiptOcrFragment => ({ text, confidence: 0.9, poly: [[0, y], [100, y], [100, y + 10], [0, y + 10]] });

function controller(run: ReceiptOcrController['run']): ReceiptOcrController {
  return { run, cancel: vi.fn(), dispose: vi.fn(), isDisposed: () => false };
}

describe('RecipePhotoImport', () => {
  it('runs OCR on the chosen photo and opens the editor prefilled for review', async () => {
    const user = userEvent.setup();
    const ocr = controller(vi.fn(async () => ({ engine: 'paddleocr' as const, rawText: '', fragments: [fragment('Pancakes', 0), fragment('2 cups flour', 20), fragment('1 egg', 40), fragment('Mix and fry', 60)] })));
    render(<RecipePhotoImport ocr={ocr} onSave={vi.fn()} onCancel={vi.fn()} />);
    await user.upload(screen.getByLabelText('Recipe photo'), new File(['x'], 'recipe.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByRole('heading', { name: 'Review scanned recipe' })).toBeInTheDocument();
    expect(screen.getByLabelText('Recipe name')).toHaveValue('Pancakes');
    expect(screen.getByLabelText('Ingredient name 1')).toHaveValue('flour');
    expect(screen.getByLabelText('Ingredient name 2')).toHaveValue('egg');
    expect(screen.getByLabelText('Instructions')).toHaveValue('Mix and fry');
  });

  it('shows an error when OCR fails and allows cancelling', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<RecipePhotoImport ocr={controller(vi.fn(async () => { throw new Error('Model failed to load.'); }))} onSave={vi.fn()} onCancel={onCancel} />);
    await user.upload(screen.getByLabelText('Recipe photo'), new File(['x'], 'recipe.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Model failed to load.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
