// SPDX-License-Identifier: Public Domain
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface ISemaphoreVerifier {
    function verifyProof(
        uint256 merkleRoot,
        uint256 nullifierHash,
        uint256 signalHash,
        uint256[8] calldata proof
    ) external view returns (bool);
}

enum ProposalType {
    Binary,
    Multiple
}

contract PrivacyVotingDAO is Ownable {
    struct Proposal {
        string title;
        string description;
        ProposalType pType;
        string[] options;
        mapping(uint256 => uint256) tally;
        mapping(uint256 => bool) nullifiers;
        bool open;
        uint64 created;
    }

    uint64 public memberMerkleRoot;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) private _proposals;

    ISemaphoreVerifier public immutable verifier;

    event MemberRootUpdated(uint64 newRoot);
    event ProposalCreated(uint256 indexed id, ProposalType pType, string title);
    event VoteCast(uint256 indexed id, uint8 option, uint256 nullifier);
    event ProposalClosed(uint256 indexed id, uint8 winner);

    constructor(ISemaphoreVerifier v, uint64 root) Ownable(msg.sender) {
        verifier = v;
        memberMerkleRoot = root;
    }

    // --- OWNER ACTIONS ---

    function updateMemberRoot(uint64 newRoot) external onlyOwner {
        memberMerkleRoot = newRoot;
        emit MemberRootUpdated(newRoot);
    }

    function createProposal(
        string calldata title,
        string calldata description,
        ProposalType pType,
        string[] calldata options
    ) external onlyOwner returns (uint256 id) {
        require(options.length >= 2, "need >=2 options");
        if (pType == ProposalType.Binary)
            require(options.length == 2, "binary=2");
        id = ++proposalCount;
        Proposal storage p = _proposals[id];
        p.title = title;
        p.description = description;
        p.pType = pType;
        p.options = options;
        p.open = true;
        p.created = uint64(block.timestamp);
        emit ProposalCreated(id, pType, title);
    }

    function closeProposal(uint256 id) external onlyOwner {
        Proposal storage p = _proposals[id];
        require(p.open, "closed");
        p.open = false;
        uint8 winner = type(uint8).max;
        uint256 high = 0;
        for (uint8 i; i < p.options.length; ++i) {
            uint256 votes = p.tally[i];
            if (votes > high) {
                high = votes;
                winner = i;
            } else if (votes == high) winner = type(uint8).max; // tie
        }
        emit ProposalClosed(id, winner);
    }

    // --- VOTING ---

    function vote(
        uint256 id,
        uint8 option,
        uint256 nullifier,
        uint64 root,
        uint256[8] calldata proof
    ) external {
        Proposal storage p = _proposals[id];
        require(p.open, "voting closed");
        require(option < p.options.length, "bad option");
        require(!p.nullifiers[nullifier], "duplicate");
        uint256 signal = uint256(keccak256(abi.encodePacked(id, option))) >> 8;
        require(
            root == memberMerkleRoot &&
                verifier.verifyProof(root, nullifier, signal, proof),
            "bad proof"
        );
        p.nullifiers[nullifier] = true;
        unchecked {
            p.tally[option] += 1;
        }
        emit VoteCast(id, option, nullifier);
    }

    // --- READS ---

    function getProposal(
        uint256 id
    )
        external
        view
        returns (
            string memory title,
            ProposalType pType,
            bool open,
            string[] memory options
        )
    {
        Proposal storage p = _proposals[id];
        return (p.title, p.pType, p.open, p.options);
    }

    function tallies(
        uint256 id,
        uint16 start,
        uint16 n
    ) external view returns (uint256[] memory out) {
        Proposal storage p = _proposals[id];
        uint16 len = uint16(p.options.length);
        require(start < len, "oob");
        uint16 end = n == 0 || start + n > len ? len : start + n;
        out = new uint256[](end - start);
        for (uint16 i = start; i < end; ++i) out[i - start] = p.tally[i];
    }
}
