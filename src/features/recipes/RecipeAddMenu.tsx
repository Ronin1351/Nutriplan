import { useState } from 'react';

export type RecipeAddChoice = 'new' | 'url' | 'paste' | 'json' | 'photo';

const CHOICES: Array<{ id: RecipeAddChoice; label: string }> = [
  { id: 'new', label: 'New recipe' },
  { id: 'url', label: 'From URL' },
  { id: 'paste', label: 'Paste text' },
  { id: 'json', label: 'From JSON file' },
  { id: 'photo', label: 'From photo' },
];

export default function RecipeAddMenu({ onSelect }: { onSelect: (choice: RecipeAddChoice) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="dropdown">
    <button className="button primary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>Add</button>
    {open && <div className="dropdown-menu" role="menu">{CHOICES.map((choice) => <button key={choice.id} role="menuitem" onClick={() => { setOpen(false); onSelect(choice.id); }}>{choice.label}</button>)}</div>}
  </div>;
}
