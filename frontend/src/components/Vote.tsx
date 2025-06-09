import React, { useState } from "react";

interface Props {
  proposalId: number;
  options: string[];
  onVote: (proposalId: number, optionIndex: number) => void;
}

export default function Vote({ proposalId, options, onVote }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>Vote on Proposal #{proposalId}</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (selected !== null) onVote(proposalId, selected);
        }}
      >
        {options.map((option, index) => (
          <div key={index}>
            <label>
              <input
                type="radio"
                name="vote"
                value={index}
                onChange={() => setSelected(index)}
              />
              {option}
            </label>
          </div>
        ))}
        <button type="submit" disabled={selected === null}>
          Submit Vote
        </button>
      </form>
    </div>
  );
}
