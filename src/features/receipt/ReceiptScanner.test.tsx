import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import userEvent from '@testing-library/user-event';
import ReceiptScanner from './ReceiptScanner';
import type { ReceiptOcrController, ReceiptOcrResult } from './receiptOcr';
import type { ReceiptDraft } from './receiptParser';

function controller(result: ReceiptOcrResult = { engine: 'paddleocr', rawText: 'RICE ₱85.50', fragments: [] }): ReceiptOcrController {
  return { run: vi.fn(async () => result), cancel: vi.fn(), dispose: vi.fn(), isDisposed: () => false };
}

describe('ReceiptScanner', () => {
  it('reads a receipt and requires review before saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async (_draft: ReceiptDraft) => undefined);
    const inputController = controller();
    render(<ReceiptScanner ocr={inputController} onSave={onSave} onCancel={vi.fn()} />);

    await user.upload(screen.getByLabelText('Receipt image'), new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByRole('heading', { name: 'Review receipt' })).toBeInTheDocument();
    expect(screen.getByLabelText('OCR text')).toHaveValue('RICE ₱85.50');
    expect(onSave).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save receipt' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('lets the user assign a category before saving', async () => {
    const user = userEvent.setup();
    let savedDraft: ReceiptDraft | null = null;
    const onSave = vi.fn(async (draft: ReceiptDraft) => { savedDraft = draft; });
    const inputController = controller({ engine: 'paddleocr', rawText: '', fragments: [{ text: 'MYSTERY ITEM 90.00', confidence: 0.9, poly: [[0, 0], [100, 0], [100, 20], [0, 20]] }] });
    render(<ReceiptScanner ocr={inputController} categoryRules={[]} onSave={onSave} onCancel={vi.fn()} />);

    await user.upload(screen.getByLabelText('Receipt image'), new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }));
    const category = await screen.findByLabelText('Category 1');
    expect(category).toHaveValue('Uncategorized');
    await user.selectOptions(category, 'Produce');
    await user.click(screen.getByRole('button', { name: 'Save receipt' }));
    expect(savedDraft).not.toBeNull();
    expect(savedDraft!.items[0].category).toBe('Produce');
  });

  it('removes an unwanted OCR line before saving', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async (_draft: ReceiptDraft) => undefined);
    const inputController = controller({ engine: 'paddleocr', rawText: '', fragments: [
      { text: 'RICE 90.00', confidence: 0.9, poly: [[0, 0], [100, 0], [100, 20], [0, 20]] },
      { text: 'MILK 80.00', confidence: 0.9, poly: [[0, 30], [100, 30], [100, 50], [0, 50]] },
    ] });
    render(<ReceiptScanner ocr={inputController} onSave={onSave} onCancel={vi.fn()} />);

    await user.upload(screen.getByLabelText('Receipt image'), new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByLabelText('Item 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove item 2' }));
    expect(screen.queryByLabelText('Item 2')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save receipt' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ name: 'RICE' })] }));
  });

  it('highlights a detected subtotal when captured item totals do not match', async () => {
    const user = userEvent.setup();
    const inputController = controller({ engine: 'paddleocr', rawText: '', fragments: [
      { text: 'RICE 90.00', confidence: 0.9, poly: [[0, 0], [100, 0], [100, 20], [0, 20]] },
      { text: 'SUBTOTAL 100.00', confidence: 0.9, poly: [[0, 30], [100, 30], [100, 50], [0, 50]] },
    ] });
    render(<ReceiptScanner ocr={inputController} onSave={vi.fn()} onCancel={vi.fn()} />);

    await user.upload(screen.getByLabelText('Receipt image'), new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }));
    const subtotal = await screen.findByLabelText('Receipt subtotal');
    expect(subtotal.closest('label')).toHaveClass('receipt-total-mismatch');
    expect(screen.getByText('Check subtotal against captured items')).toBeInTheDocument();
  });

  it('shows a failure and allows cancellation without saving', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const inputController = controller();
    vi.mocked(inputController.run).mockRejectedValue(new Error('OCR unavailable'));
    render(<ReceiptScanner ocr={inputController} onSave={vi.fn()} onCancel={onCancel} />);

    await user.upload(screen.getByLabelText('Receipt image'), new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('OCR unavailable');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(inputController.cancel).toHaveBeenCalled();
  });

  it('does not dispose a caller-owned controller during Strict Mode effect checks', () => {
    const inputController = controller();
    render(<StrictMode><ReceiptScanner ocr={inputController} onSave={vi.fn()} onCancel={vi.fn()} /></StrictMode>);
    expect(inputController.dispose).not.toHaveBeenCalled();
  });

  it('shows elapsed progress and a cancel action while OCR is running', async () => {
    const user = userEvent.setup();
    let resolveRun!: () => void;
    const inputController = controller();
    vi.mocked(inputController.run).mockImplementation(() => new Promise((resolve) => {
      resolveRun = () => resolve({ engine: 'paddleocr', rawText: '', fragments: [] });
    }));
    const onCancel = vi.fn();
    render(<ReceiptScanner ocr={inputController} onSave={vi.fn()} onCancel={onCancel} />);

    await user.upload(screen.getByLabelText('Receipt image'), new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Elapsed: 0s');
    await user.click(screen.getByRole('button', { name: 'Cancel scan' }));
    expect(inputController.cancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    resolveRun();
  });

  it('mode camera shows only the camera input and opens it on mount', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    render(<ReceiptScanner ocr={controller()} mode="camera" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Take receipt photo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Receipt image')).not.toBeInTheDocument();
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('mode upload shows only the upload input', () => {
    render(<ReceiptScanner ocr={controller()} mode="upload" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText('Receipt image')).toBeInTheDocument();
    expect(screen.queryByLabelText('Take receipt photo')).not.toBeInTheDocument();
  });
});
