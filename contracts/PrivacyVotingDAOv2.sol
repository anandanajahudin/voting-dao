// SPDX-License-Identifier: Public Domain
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./SemaphoreVerifier.sol";

interface IERC20Votes {
    function getVotes(address account) external view returns (uint256);
}

enum CountingMode {
    Simple,
    Quadratic
}

contract PrivacyVotingDAOv2 is Ownable {
    /* ---------- Constructor ---------- */
    constructor(
        SemaphoreVerifier _verifier,
        uint256 _root,
        IERC20Votes _govToken
    ) Ownable(msg.sender) {
        verifier = _verifier;
        memberMerkleRoot = _root;
        govToken = _govToken;
    }

    /* ---------- Data Types ---------- */
    struct Proposal {
        string title;
        string description;
        CountingMode mode;
        string[] options;
        mapping(uint256 => uint256) tally;
        mapping(uint256 => bool) nullifiers;
        uint64 closes;
        bool closed;
    }

    /* ---------- Storage ---------- */
    uint256 public memberMerkleRoot;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) private _proposals;
    SemaphoreVerifier public immutable verifier;
    IERC20Votes public immutable govToken;

    /* ---------- Events ---------- */
    event MemberRootUpdated(uint256 newRoot);
    event ProposalCreated(
        uint256 indexed id,
        CountingMode mode,
        string title,
        uint64 closes
    );
    event ProofVerified(
        uint256 indexed id,
        uint256 merkleRoot,
        uint256 nullifierHash,
        uint256 signalHash
    );
    event VoteCast(
        uint256 indexed id,
        uint8 option,
        uint256 nullifierHash,
        uint256 weight
    );
    event ProposalClosed(uint256 indexed id, uint8 winner);

    /* ---------- Owner-only ---------- */
    function updateMemberRoot(uint256 newRoot) external onlyOwner {
        memberMerkleRoot = newRoot;
        emit MemberRootUpdated(newRoot);
    }

    function createProposal(
        string calldata title,
        string calldata description,
        CountingMode mode,
        string[] calldata options,
        uint32 duration
    ) external onlyOwner returns (uint256 id) {
        require(options.length >= 2, "need 2+ opts");
        id = ++proposalCount;
        Proposal storage p = _proposals[id];
        p.title = title;
        p.description = description;
        p.mode = mode;

        delete p.options;
        for (uint i = 0; i < options.length; i++) {
            p.options.push(options[i]);
        }

        p.closes = uint64(block.timestamp) + duration;
        emit ProposalCreated(id, mode, title, p.closes);
    }

    function closeProposal(uint256 id) public {
        Proposal storage p = _proposals[id];
        require(!p.closed, "already closed");
        require(block.timestamp >= p.closes, "not expired");
        p.closed = true;
        uint8 winner = type(uint8).max;
        uint256 high = 0;
        for (uint8 i = 0; i < p.options.length; ++i) {
            uint256 v = p.tally[i];
            if (v > high) {
                high = v;
                winner = i;
            } else if (v == high) {
                winner = type(uint8).max;
            }
        }
        emit ProposalClosed(id, winner);
    }

    /* ---------- Voting ---------- */
    function vote(
        uint256 id,
        uint8 option,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256 merkleRoot,
        uint256[8] calldata proof
    ) external {
        Proposal storage p = _proposals[id];
        require(block.timestamp < p.closes, "voting is closed");
        require(option < p.options.length, "invalid option");
        require(!p.nullifiers[nullifierHash], "vote already cast");
        require(merkleRoot == memberMerkleRoot, "invalid merkle root");

        // Validasi signalHash sesuai opsi voting
        bytes32 expectedSignalHash = keccak256(
            abi.encodePacked("VOTE_", _toString(option))
        );
        require(
            signalHash == uint256(expectedSignalHash),
            "signal-option mismatch"
        );

        // Verifikasi proof zk-SNARK dengan SemaphoreVerifier
        uint256[4] memory publicSignals = [
            merkleRoot,
            nullifierHash,
            signalHash,
            id // externalNullifier = proposal id
        ];

        bool ok = verifier.verifyProof(proof, publicSignals);
        require(ok, "invalid proof");

        // Emit event ProofVerified setelah proof valid
        emit ProofVerified(id, merkleRoot, nullifierHash, signalHash);

        // Catat nullifier supaya voting tidak bisa diulang
        p.nullifiers[nullifierHash] = true;

        uint256 weight = 1;
        if (
            p.mode == CountingMode.Quadratic && address(govToken) != address(0)
        ) {
            uint256 rawVotes = govToken.getVotes(msg.sender);
            weight = sqrt(rawVotes);
        }

        unchecked {
            p.tally[option] += weight;
        }

        emit VoteCast(id, option, nullifierHash, weight);

        if (block.timestamp >= p.closes && !p.closed) {
            closeProposal(id);
        }
    }

    /* ---------- Reads ---------- */
    function getProposal(
        uint256 id
    )
        external
        view
        returns (
            string memory title,
            CountingMode mode,
            bool open,
            uint64 closes,
            string[] memory options
        )
    {
        Proposal storage p = _proposals[id];
        return (
            p.title,
            p.mode,
            !p.closed && block.timestamp < p.closes,
            p.closes,
            p.options
        );
    }

    function tallies(
        uint256 id,
        uint16 start,
        uint16 n
    ) external view returns (uint256[] memory out) {
        Proposal storage p = _proposals[id];
        uint16 len = uint16(p.options.length);
        require(start < len, "oob");
        uint16 end = (n == 0 || start + n > len || start + n < start)
            ? len
            : start + n;
        if (start >= end && len > 0) {
            out = new uint256[](0); // <-- perbaikan di sini
            return out;
        }
        out = new uint256[](end - start);
        for (uint16 i = start; i < end; ++i) {
            out[i - start] = p.tally[i];
        }
    }

    /* ---------- Internal ---------- */
    function sqrt(uint256 x) private pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
