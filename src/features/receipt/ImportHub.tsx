import { useState } from 'react';
import RecipeImportPanel from '../recipes/RecipeImportPanel';
import ReceiptScanner from './ReceiptScanner';
import type { NewRecipe } from '../../types/domain';
import type { ReceiptDraft } from './receiptParser';
import type { CategoryRule } from '../categories/categoryClassifier';

interface ImportHubProps {
  onSaveRecipe: (recipe: NewRecipe) => Promise<void>;
  onSaveReceipt: (draft: ReceiptDraft) => Promise<void>;
  categoryRules?: CategoryRule[];
  onCancel: () => void;
}

export default function ImportHub({ onSaveRecipe, onSaveReceipt, categoryRules = [], onCancel }: ImportHubProps) {
  const [mode, setMode] = useState<'recipe' | 'receipt'>('recipe');
  return <section className="import-hub">
    <div className="import-tabs"><button className={mode === 'recipe' ? 'button primary' : 'button secondary'} onClick={() => setMode('recipe')}>Online recipe</button><button className={mode === 'receipt' ? 'button primary' : 'button secondary'} onClick={() => setMode('receipt')}>Receipt photo</button></div>
    {mode === 'recipe' ? <RecipeImportPanel onSave={onSaveRecipe} onCancel={onCancel} /> : <ReceiptScanner categoryRules={categoryRules} onSave={onSaveReceipt} onCancel={onCancel} />}
  </section>;
}
