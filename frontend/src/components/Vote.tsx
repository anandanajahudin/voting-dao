import React, { useState } from "react"
import { Identity } from "@semaphore-protocol/identity"
import { Group } from "@semaphore-protocol/group"
import { generateProof } from "@semaphore-protocol/proof"
// 🔧 Import workaround untuk utils
import { packToSolidityProof } from "../utils/packToSolidityProof"

interface VoteProps {
    proposalId: number
    options: string[]
    memberMerkleRoot: bigint | null
    onVote: (
        proposalId: number,
        optionIndex: number,
        signalHash: bigint,
        nullifierHash: bigint,
        merkleRoot: bigint,
        proof: bigint[]
    ) => void
}

const Vote: React.FC<VoteProps> = ({
    proposalId,
    options,
    memberMerkleRoot,
    onVote
}) => {
    const [identity, setIdentity] = useState<Identity | null>(null)
    const [selectedOption, setSelectedOption] = useState<number>(0)
    const [identityCommitment, setIdentityCommitment] = useState<string>("")
    const [voting, setVoting] = useState(false)

    const handleGenerateIdentity = () => {
        const newIdentity = new Identity()
        setIdentity(newIdentity)
        alert("Identity generated!")
    }

    const handleVote = async () => {
        if (!memberMerkleRoot) {
            alert("Merkle root not loaded.")
            return
        }

        try {
            setVoting(true)

            // Membuat identitas pengguna dari string input
            const identity = new Identity(identityCommitment)

            // Membuat group dummy (bisa diganti dengan daftar member asli jika tersedia)
            const group = new Group()
            group.addMember(identity.commitment)

            // Signal adalah hash dari format 'VOTE_<option>'
            const signal = `VOTE_${options[selectedOption]}`
            const externalNullifier = proposalId

            const fullProof = await generateProof(
                identity,
                group,
                memberMerkleRoot.toString(),
                signal,
                externalNullifier
            ) as any

            const { proof, publicSignals } = fullProof
            const solidityProof = packToSolidityProof(proof)

            await onVote(
                proposalId,
                selectedOption,
                BigInt(publicSignals.signalHash),
                BigInt(publicSignals.nullifierHash),
                BigInt(publicSignals.merkleRoot),
                solidityProof.map((x: any) => BigInt(x))
            )

            alert("Vote sent!")
        } catch (err: any) {
            console.error("Vote error:", err)
            alert("Voting failed: " + (err.message || err))
        } finally {
            setVoting(false)
        }
    }

    // return (
    //     <div>
    //         <h4>Anonymous Vote</h4>
    //         <label>
    //             Identity String (Private):
    //             <input
    //                 type="text"
    //                 value={identityCommitment}
    //                 onChange={(e) => setIdentityCommitment(e.target.value)}
    //                 style={{ width: "100%", padding: "0.5rem", margin: "0.5rem 0" }}
    //             />
    //         </label>
    //         <div>
    //             {options.map((option, index) => (
    //                 <label key={index} style={{ display: "block" }}>
    //                     <input
    //                         type="radio"
    //                         name="vote-option"
    //                         checked={selectedOption === index}
    //                         onChange={() => setSelectedOption(index)}
    //                     />
    //                     {option}
    //                 </label>
    //             ))}
    //         </div>
    //         <button
    //             onClick={handleVote}
    //             disabled={voting}
    //             style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}
    //         >
    //             {voting ? "Submitting..." : "Submit Anonymous Vote"}
    //         </button>
    //     </div>
    // )
    return (
        <div>
            <p><strong>Select option to vote:</strong></p>
            <select
                value={selectedOption}
                onChange={(e) => setSelectedOption(Number(e.target.value))}
            >
                {options.map((opt, idx) => (
                    <option key={idx} value={idx}>
                        {opt}
                    </option>
                ))}
            </select>

            <div style={{ marginTop: "1rem" }}>
                <button onClick={handleGenerateIdentity}>
                    Generate Identity
                </button>

                <button
                    onClick={handleVote}
                    style={{ marginLeft: "1rem" }}
                    disabled={!memberMerkleRoot}
                    title={!memberMerkleRoot ? "Waiting for Merkle root..." : ""}
                >
                    Vote Anonymously
                </button>
            </div>

            {!memberMerkleRoot && (
                <p style={{ color: "orange", marginTop: "1rem" }}>
                    Merkle root is not loaded yet. Please wait...
                </p>
            )}
        </div>
    )
}

export default Vote
