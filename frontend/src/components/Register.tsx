import React, { useState } from "react";
import { Identity } from "@semaphore-protocol/identity";

export default function Register() {
  const [registered, setRegistered] = useState<boolean>(false);
  const [identityCommitment, setIdentityCommitment] = useState<string | null>(null);

  const handleRegister = () => {
    const identity = new Identity();
    const identityStr = identity.toString(); // serialisasi

    // Simpan ke localStorage
    localStorage.setItem("semaphore-identity", identityStr);
    setIdentityCommitment(identity.commitment.toString());
    setRegistered(true);
  };

  return (
    <div style={{ marginBottom: "1rem", padding: "1rem", border: "1px solid #ccc" }}>
      <h3>Anonymous Identity Registration</h3>
      <button onClick={handleRegister} disabled={registered}>
        {registered ? "Registered!" : "Generate Identity"}
      </button>
      {identityCommitment && (
        <p style={{ marginTop: "0.5rem" }}>
          Identity Commitment: <code>{identityCommitment}</code>
        </p>
      )}
    </div>
  );
}
