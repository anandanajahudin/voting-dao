import React from "react";

interface Proposal {
  id: number;
  title: string;
  mode: number;
  open: boolean;
  closes: number;
  options: string[];
}

interface Props {
  proposals: Proposal[];
}

export default function ProposalList({ proposals }: Props) {
  return (
    <div>
      <h2>Proposals</h2>
      <ul>
        {proposals.map((p) => (
          <li key={p.id}>
            <b>{p.title}</b> — {p.mode === 0 ? "Yes/No" : "Multiple Choice"}<br />
            Status: {p.open ? "Open" : "Closed"}<br />
            Options: {p.options.join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}
