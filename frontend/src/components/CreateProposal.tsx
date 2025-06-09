import React, { useState } from "react";

interface Props {
  onCreate: (
    title: string,
    description: string,
    mode: number,
    options: string[],
    duration: number
  ) => void;
}

export default function CreateProposal({ onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState(0); // 0: Yes/No, 1: Multiple Options
  const [options, setOptions] = useState(["", ""]); // for multiple options
  const [duration, setDuration] = useState(120);

  const handleCreate = () => {
    if (mode === 1) {
        // Multiple options harus minimal 2 opsi yang tidak kosong
        const filteredOptions = options.filter((opt) => opt.trim() !== "");
        if (filteredOptions.length < 2) {
        alert("Multiple options proposal must have at least 2 options.");
        return;
        }
        onCreate(title, description, mode, filteredOptions, duration);
    } else {
        // Yes/No mode: selalu kirim ["Yes", "No"]
        onCreate(title, description, mode, ["Yes", "No"], duration);
    }
  };

  return (
    <div style={{ marginBottom: "2rem" }}>
      <h2>Create Proposal</h2>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <br />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <br />
      <label>
        Proposal Type:{" "}
        <select
          value={mode}
          onChange={(e) => setMode(Number(e.target.value))}
        >
          <option value={0}>Yes/No</option>
          <option value={1}>Multiple Options</option>
        </select>
      </label>
      <br />
      {/* Tampilkan input opsi hanya jika mode Multiple Options */}
      {mode === 1 && (
        <>
          {options.map((opt, idx) => (
            <input
              key={idx}
              type="text"
              placeholder={`Option #${idx + 1}`}
              value={opt}
              onChange={(e) => {
                const newOpts = [...options];
                newOpts[idx] = e.target.value;
                setOptions(newOpts);
              }}
            />
          ))}
          <br />
          <button
            onClick={() => setOptions([...options, ""])}
            type="button"
          >
            + Add Option
          </button>
          <br />
        </>
      )}
      <label>
        Duration (seconds):
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
      </label>
      <br />
      <button onClick={handleCreate}>Create</button>
    </div>
  );
}
