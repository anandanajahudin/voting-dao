import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import DAO_ABI from "./abis/PrivacyVotingDAOv2.json";
import CreateProposal from "./components/CreateProposal";
import ProposalList from "./components/ProposalList";

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

  useEffect(() => {
    const init = async () => {
      if ((window as any).ethereum) {
        const p = new ethers.BrowserProvider((window as any).ethereum);
        setProvider(p);
        const signer = await p.getSigner();
        const contract = new ethers.Contract(DAO_ADDRESS, DAO_ABI.abi, signer);
        setDao(contract);
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

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>DAO Voting DApp</h1>
      <CreateProposal onCreate={handleCreateProposal} />
      <ProposalList proposals={proposals} />
    </div>
  );
}
