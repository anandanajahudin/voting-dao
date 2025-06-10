import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

import DAO_ABI from "./abis/PrivacyVotingDAOv2.json";
import CreateProposal from "./components/CreateProposal";
import ProposalList from "./components/ProposalList";
import Vote from "./components/Vote";
import Register from "./components/Register"; // Pastikan path sesuai struktur foldermu

const DAO_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

interface Proposal {
  id: number;
  title: string;
  mode: number;
  open: boolean;
  closes: number;
  options: string[];
}

export default function App() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [dao, setDao] = useState<ethers.Contract | null>(null);
  const [memberMerkleRoot, setMemberMerkleRoot] = useState<bigint | null>(null);

  useEffect(() => {
    const init = async () => {
      if ((window as any).ethereum) {
        const p = new ethers.BrowserProvider((window as any).ethereum);
        setProvider(p);
        const signer = await p.getSigner();
        const contract = new ethers.Contract(DAO_ADDRESS, DAO_ABI.abi, signer);
        setDao(contract);

        const root: bigint = await contract.memberMerkleRoot();
        setMemberMerkleRoot(root);

        fetchProposals(contract);
      }
    };
    init();
  }, []);

  const fetchProposals = async (contract: ethers.Contract) => {
    const count = await contract.proposalCount();
    const list: Proposal[] = [];
    for (let i = 1; i <= count; i++) {
      const p = await contract.getProposal(i);
      list.push({
        id: i,
        title: p[0],
        mode: p[1],
        open: p[2],
        closes: p[3],
        options: p[4],
      });
    }
    setProposals(list);
  };

  const handleCreateProposal = async (
    title: string,
    description: string,
    mode: number,
    options: string[],
    duration: number
  ) => {
    if (!dao) return;
    const tx = await dao.createProposal(title, description, mode, options, duration);
    await tx.wait();
    alert("Proposal created!");
    fetchProposals(dao);
  };

  const handleVote = async (
    proposalId: number,
    optionIndex: number,
    signalHash: bigint,
    nullifierHash: bigint,
    merkleRoot: bigint,
    proof: bigint[]
  ) => {
    if (!dao) return;
    try {
      const tx = await dao.vote(
        proposalId,
        optionIndex,
        signalHash,
        nullifierHash,
        merkleRoot,
        proof
      );
      await tx.wait();
      alert("Vote successful!");
    } catch (error: any) {
      console.error("Vote failed:", error);
      alert("Vote failed: " + (error.reason || error.message || "Unknown error"));
    }
  };

  return (
    <Router>
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <nav style={{ marginBottom: "1.5rem" }}>
          <Link to="/" style={{ marginRight: "1rem" }}>🏠 Home</Link>
          <Link to="/register">📝 Register</Link>
        </nav>

        <Routes>
          <Route
            path="/"
            element={
              <>
                <h1>DAO Voting DApp</h1>
                <CreateProposal onCreate={handleCreateProposal} />
                {proposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    style={{
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      padding: "1rem",
                      marginTop: "1rem",
                    }}
                  >
                    <h2>{proposal.title}</h2>
                    <p>Mode: {proposal.mode}</p>
                    <p>Status: {proposal.open ? "Open" : "Closed"}</p>
                    <p>Closes at: {new Date(Number(proposal.closes) * 1000).toLocaleString()}</p>
                    <ul>
                      {proposal.options.map((opt, idx) => (
                        <li key={idx}>{opt}</li>
                      ))}
                    </ul>
                    {proposal.open && memberMerkleRoot && (
                    <Vote
                      proposalId={proposal.id}
                      options={proposal.options}
                      onVote={handleVote}
                      memberMerkleRoot={memberMerkleRoot}
                    />
                  )}

                  {proposal.open && !memberMerkleRoot && (
                    <p>Loading Merkle root... Please wait.</p>
                  )}

                  </div>
                ))}
              </>
            }
          />
          <Route path="/register" element={<Register />} />
        </Routes>
      </div>
    </Router>
  );
}
