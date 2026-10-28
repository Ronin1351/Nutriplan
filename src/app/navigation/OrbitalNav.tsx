export type OrbitalSection = 'recipes' | 'pantry' | 'planner' | 'shopping' | 'import';

interface OrbitalNavProps {
  activeSection: OrbitalSection;
  onChange: (section: OrbitalSection) => void;
}

const destinations: Array<{ id: OrbitalSection; label: string; symbol: string }> = [
  { id: 'recipes', label: 'Recipes', symbol: '✦' },
  { id: 'planner', label: 'Plan', symbol: '▦' },
  { id: 'import', label: 'Import', symbol: '↓' },
  { id: 'shopping', label: 'Shopping', symbol: '◈' },
  { id: 'pantry', label: 'Pantry', symbol: '◌' },
];

export default function OrbitalNav({ activeSection, onChange }: OrbitalNavProps) {
  return (
    <nav className="top-nav" aria-label="Primary navigation">
      <div className="top-nav-heading">
        <span className="top-nav-kicker">Your kitchen, organized</span>
        <span className="top-nav-help">Choose a workspace</span>
      </div>
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
