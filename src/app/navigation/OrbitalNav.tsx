export type OrbitalSection = 'plan' | 'shopping' | 'pantry' | 'recipes' | 'receipts';

interface OrbitalNavProps {
  activeSection: OrbitalSection;
  onChange: (section: OrbitalSection) => void;
}

const destinations: Array<{ id: OrbitalSection; label: string; symbol: string }> = [
  { id: 'plan', label: 'Plan', symbol: '▦' },
  { id: 'shopping', label: 'Shopping', symbol: '◈' },
  { id: 'pantry', label: 'Pantry', symbol: '◌' },
  { id: 'recipes', label: 'Recipes', symbol: '✦' },
  { id: 'receipts', label: 'Receipts', symbol: '▤' },
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
            <span className="top-nav-symbol" aria-hidden="true">{destination.symbol}</span>
            <span>{destination.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
