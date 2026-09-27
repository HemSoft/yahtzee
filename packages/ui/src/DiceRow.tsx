import React from "react";

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

export function PipFace({ value }: { value: number }) {
  return <span className="pip-face" aria-hidden="true">
    {PIPS[value] ? Array.from({ length: 9 }, (_, index) => <span key={index} className={PIPS[value].includes(index) ? "pip is-visible" : "pip"} />) : <span className="die-empty">?</span>}
  </span>;
}

interface DieProps {
  value: number;
  held: boolean;
  onToggleHold: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function Die({ value, held, onToggleHold, disabled, compact = false }: DieProps) {
  return <button type="button" onClick={onToggleHold} disabled={disabled}
    className={`die${held ? " is-held" : ""}${compact ? " is-compact" : ""}`}
    aria-pressed={held} aria-label={`Die showing ${value}${held ? ", held" : ""}`}>
    <PipFace value={value} />
  </button>;
}

interface DiceRowProps {
  dice: number[];
  held: Set<number>;
  onToggleHold: (index: number) => void;
  disabled?: boolean;
  compact?: boolean;
  rolling?: boolean;
  rollKey?: number;
}

export function DiceRow({ dice, held, onToggleHold, disabled, compact = false, rolling = false, rollKey = 0 }: DiceRowProps) {
  return <div className={`dice-row dice-count-${dice.length}${dice.length > 10 ? " many-dice" : ""}${rolling ? " is-rolling" : ""}`}>
    {dice.map((value, index) => <div className="die-slot" key={index}>
      <div className={!held.has(index) && rollKey > 0 ? "die-arrival" : undefined} key={held.has(index) ? "held" : rollKey}>
        <Die value={value} held={held.has(index)} onToggleHold={() => onToggleHold(index)} disabled={disabled} compact={compact} />
      </div>
      <span className={`hold-label${held.has(index) ? " is-held" : ""}`} aria-hidden="true">{held.has(index) ? "Held" : "Hold"}</span>
    </div>)}
  </div>;
}
