// src/utils/packToSolidityProof.ts

export function packToSolidityProof(proof: any): bigint[] {
    const { pi_a, pi_b, pi_c } = proof

    return [
        BigInt(pi_a[0]),
        BigInt(pi_a[1]),
        BigInt(pi_b[0][1]),
        BigInt(pi_b[0][0]),
        BigInt(pi_b[1][1]),
        BigInt(pi_b[1][0]),
        BigInt(pi_c[0]),
        BigInt(pi_c[1])
    ]
}
