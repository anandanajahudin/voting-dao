// src/components/MerkleRootStatus.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import DAO_ABI from "../abis/PrivacyVotingDAOv2.json";

const DAO_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

interface Props {
  onLoaded: (root: bigint, contract: ethers.Contract) => void;
}

export default function MerkleRootStatus({ onLoaded }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMerkleRoot = async () => {
      try {
        const ethereum = (window as any).ethereum;
        if (!ethereum) throw new Error("Ethereum provider not found");

        const provider = new ethers.BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        const dao = new ethers.Contract(DAO_ADDRESS, DAO_ABI.abi, signer);

        const root: bigint = await dao.memberMerkleRoot();
        onLoaded(root, dao);
      } catch (err: any) {
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchMerkleRoot();
  }, [onLoaded]);

  if (loading) return <p>Loading Merkle root... Please wait.</p>;
  if (error) return <p style={{ color: "red" }}>❌ Error: {error}</p>;

  return <p>✅ Merkle root loaded successfully.</p>;
}
