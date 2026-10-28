export type AppSection = 'recipes' | 'pantry' | 'planner' | 'shopping';

interface MobileNavProps {
  activeSection: AppSection;
  onChange: (section: AppSection) => void;
}

export default function MobileNav({ activeSection, onChange }: MobileNavProps) {
  return (
    <nav className="mobile-nav" aria-label="Primary navigation">
      <button
        className={activeSection === 'recipes' ? 'nav-item active' : 'nav-item'}
        aria-current={activeSection === 'recipes' ? 'page' : undefined}
        onClick={() => onChange('recipes')}
      >
        <span aria-hidden="true">▤</span>
        <span>Recipes</span>
      </button>
      <button
        className={activeSection === 'planner' ? 'nav-item active' : 'nav-item'}
        aria-current={activeSection === 'planner' ? 'page' : undefined}
        onClick={() => onChange('planner')}
      >
        <span aria-hidden="true">◫</span>
        <span>Planner</span>
      </button>
      <button
        className={activeSection === 'shopping' ? 'nav-item active' : 'nav-item'}
        aria-current={activeSection === 'shopping' ? 'page' : undefined}
        onClick={() => onChange('shopping')}
      >
        <span aria-hidden="true">🛒</span>
        <span>Shopping list</span>
      </button>
      <button
        className={activeSection === 'pantry' ? 'nav-item active' : 'nav-item'}
        aria-current={activeSection === 'pantry' ? 'page' : undefined}
        onClick={() => onChange('pantry')}
      >
        <span aria-hidden="true">▦</span>
        <span>Pantry</span>
      </button>
    </nav>
  );
}
