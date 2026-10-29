import NutriPlanIcon from './NutriPlanIcon';

export type OrbitalSection = 'plan' | 'shopping' | 'pantry' | 'recipes' | 'receipts';

interface OrbitalNavProps {
  activeSection: OrbitalSection;
  onChange: (section: OrbitalSection) => void;
}

const destinations: Array<{ id: OrbitalSection; label: string }> = [
  { id: 'plan', label: 'Plan' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'pantry', label: 'Pantry' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'receipts', label: 'Receipts' },
];

export default function OrbitalNav({ activeSection, onChange }: OrbitalNavProps) {
  return (
    <nav className="top-nav" aria-label="Primary navigation">
      <div className="top-nav-row">
        {destinations.map((destination) => (
          <button
            key={destination.id}
            type="button"
            className={`top-nav-item ${activeSection === destination.id ? 'active' : ''}`}
            aria-current={activeSection === destination.id ? 'page' : undefined}
            onClick={() => onChange(destination.id)}
          >
            <NutriPlanIcon name={destination.id} active={activeSection === destination.id} size={22} className="top-nav-symbol" data-icon={destination.id} />
            <span>{destination.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
