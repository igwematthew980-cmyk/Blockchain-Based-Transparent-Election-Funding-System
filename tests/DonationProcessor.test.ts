import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, principalCV, boolCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_CANDIDATE = 101;
const ERR_INVALID_DONOR = 102;
const ERR_NON_COMPLIANT = 103;
const ERR_INVALID_AMOUNT = 104;
const ERR_INVALID_TIMESTAMP = 105;
const ERR_DONATION_EXISTS = 106;
const ERR_VAULT_FAIL = 107;
const ERR_AUDIT_FAIL = 108;
const ERR_COUNTER_OVERFLOW = 109;
const ERR_INVALID_STATUS = 110;
const ERR_INVALID_CURRENCY = 111;
const ERR_INVALID_LOCATION = 112;
const ERR_INVALID_COMPLIANCE_PARAM = 113;
const ERR_MAX_DONATIONS_EXCEEDED = 114;
const ERR_INVALID_DONOR_ID = 115;
const ERR_INVALID_CANDIDATE_ID = 116;
const ERR_INSUFFICIENT_BALANCE = 117;
const ERR_TRANSFER_FAILED = 118;
const ERR_REGISTRY_NOT_SET = 119;
const ERR_AUTHORITY_NOT_VERIFIED = 120;

interface Donation {
  donor: string;
  candidate: string;
  amount: number;
  timestamp: number;
  status: boolean;
  currency: string;
  location: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class DonationProcessorMock {
  state: {
    donationCounter: number;
    maxDonations: number;
    minDonationAmount: number;
    maxDonationAmount: number;
    authorityContract: string | null;
    candidateRegistryContract: string | null;
    donorRegistryContract: string | null;
    complianceCheckerContract: string | null;
    fundVaultContract: string | null;
    auditTrailContract: string | null;
    processingFee: number;
    activeStatus: boolean;
    donations: Map<number, Donation>;
    donationsByDonor: Map<string, { donationIds: number[] }>;
    donationsByCandidate: Map<string, { donationIds: number[] }>;
  } = {
    donationCounter: 0,
    maxDonations: 1000000,
    minDonationAmount: 1,
    maxDonationAmount: 1000000000,
    authorityContract: null,
    candidateRegistryContract: null,
    donorRegistryContract: null,
    complianceCheckerContract: null,
    fundVaultContract: null,
    auditTrailContract: null,
    processingFee: 100,
    activeStatus: true,
    donations: new Map(),
    donationsByDonor: new Map(),
    donationsByCandidate: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];
  mockRegistries: {
    candidates: Set<string>;
    donors: Set<string>;
  } = {
    candidates: new Set(),
    donors: new Set(),
  };

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      donationCounter: 0,
      maxDonations: 1000000,
      minDonationAmount: 1,
      maxDonationAmount: 1000000000,
      authorityContract: null,
      candidateRegistryContract: null,
      donorRegistryContract: null,
      complianceCheckerContract: null,
      fundVaultContract: null,
      auditTrailContract: null,
      processingFee: 100,
      activeStatus: true,
      donations: new Map(),
      donationsByDonor: new Map(),
      donationsByCandidate: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
    this.mockRegistries = {
      candidates: new Set(),
      donors: new Set(),
    };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (this.caller !== "ST1TEST") return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.authorityContract !== null) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setCandidateRegistry(contractPrincipal: string): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.candidateRegistryContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setDonorRegistry(contractPrincipal: string): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.donorRegistryContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setComplianceChecker(contractPrincipal: string): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.complianceCheckerContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setFundVault(contractPrincipal: string): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.fundVaultContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setAuditTrail(contractPrincipal: string): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.auditTrailContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMinDonationAmount(newMin: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMin <= 0) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.minDonationAmount = newMin;
    return { ok: true, value: true };
  }

  setMaxDonationAmount(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newMax <= this.state.minDonationAmount) return { ok: false, value: ERR_INVALID_AMOUNT };
    this.state.maxDonationAmount = newMax;
    return { ok: true, value: true };
  }

  setProcessingFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.processingFee = newFee;
    return { ok: true, value: true };
  }

  setActiveStatus(newStatus: boolean): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    if (this.caller !== this.state.authorityContract) return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.activeStatus = newStatus;
    return { ok: true, value: true };
  }

  submitDonation(candidate: string, amount: number, currency: string, location: string): Result<number> {
    const donor = this.caller;
    const timestamp = this.blockHeight;
    if (!this.state.activeStatus) return { ok: false, value: ERR_INVALID_STATUS };
    if (this.state.donationCounter >= this.state.maxDonations) return { ok: false, value: ERR_MAX_DONATIONS_EXCEEDED };
    if (amount < this.state.minDonationAmount || amount > this.state.maxDonationAmount) return { ok: false, value: ERR_INVALID_AMOUNT };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!this.state.donorRegistryContract || !this.mockRegistries.donors.has(donor)) return { ok: false, value: ERR_INVALID_DONOR };
    if (!this.state.candidateRegistryContract || !this.mockRegistries.candidates.has(candidate)) return { ok: false, value: ERR_INVALID_CANDIDATE };
    if (!this.state.complianceCheckerContract) return { ok: false, value: ERR_REGISTRY_NOT_SET };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };
    this.stxTransfers.push({ amount: this.state.processingFee, from: donor, to: this.state.authorityContract });
    this.stxTransfers.push({ amount: amount, from: donor, to: this.state.fundVaultContract });
    if (!this.state.fundVaultContract) return { ok: false, value: ERR_REGISTRY_NOT_SET };
    if (!this.state.auditTrailContract) return { ok: false, value: ERR_REGISTRY_NOT_SET };
    const id = this.state.donationCounter;
    const donation: Donation = { donor, candidate, amount, timestamp, status: true, currency, location };
    this.state.donations.set(id, donation);
    const donorIds = this.state.donationsByDonor.get(donor)?.donationIds || [];
    if (donorIds.length >= 1000) return { ok: false, value: ERR_COUNTER_OVERFLOW };
    this.state.donationsByDonor.set(donor, { donationIds: [...donorIds, id] });
    const candidateIds = this.state.donationsByCandidate.get(candidate)?.donationIds || [];
    if (candidateIds.length >= 1000) return { ok: false, value: ERR_COUNTER_OVERFLOW };
    this.state.donationsByCandidate.set(candidate, { donationIds: [...candidateIds, id] });
    this.state.donationCounter++;
    return { ok: true, value: id };
  }

  cancelDonation(donationId: number): Result<boolean> {
    const donation = this.state.donations.get(donationId);
    if (!donation) return { ok: false, value: ERR_DONATION_EXISTS };
    if (donation.donor !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!donation.status) return { ok: false, value: ERR_INVALID_STATUS };
    this.state.donations.set(donationId, { ...donation, status: false });
    return { ok: true, value: true };
  }

  getDonation(id: number): Donation | undefined {
    return this.state.donations.get(id);
  }

  getDonationsByDonor(donor: string): { donationIds: number[] } {
    return this.state.donationsByDonor.get(donor) || { donationIds: [] };
  }

  getDonationsByCandidate(candidate: string): { donationIds: number[] } {
    return this.state.donationsByCandidate.get(candidate) || { donationIds: [] };
  }

  getDonationCount(): Result<number> {
    return { ok: true, value: this.state.donationCounter };
  }
}

describe("DonationProcessor", () => {
  let contract: DonationProcessorMock;

  beforeEach(() => {
    contract = new DonationProcessorMock();
    contract.reset();
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2AUTH");
    expect(result.ok).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2AUTH");
  });

  it("sets candidate registry successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setCandidateRegistry("ST3CAND");
    expect(result.ok).toBe(true);
    expect(contract.state.candidateRegistryContract).toBe("ST3CAND");
  });

  it("sets donor registry successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setDonorRegistry("ST4DONOR");
    expect(result.ok).toBe(true);
    expect(contract.state.donorRegistryContract).toBe("ST4DONOR");
  });

  it("sets compliance checker successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setComplianceChecker("ST5COMP");
    expect(result.ok).toBe(true);
    expect(contract.state.complianceCheckerContract).toBe("ST5COMP");
  });

  it("sets fund vault successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setFundVault("ST6VAULT");
    expect(result.ok).toBe(true);
    expect(contract.state.fundVaultContract).toBe("ST6VAULT");
  });

  it("sets audit trail successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setAuditTrail("ST7AUDIT");
    expect(result.ok).toBe(true);
    expect(contract.state.auditTrailContract).toBe("ST7AUDIT");
  });

  it("sets min donation amount successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setMinDonationAmount(10);
    expect(result.ok).toBe(true);
    expect(contract.state.minDonationAmount).toBe(10);
  });

  it("sets max donation amount successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setMaxDonationAmount(100000);
    expect(result.ok).toBe(true);
    expect(contract.state.maxDonationAmount).toBe(100000);
  });

  it("sets processing fee successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setProcessingFee(50);
    expect(result.ok).toBe(true);
    expect(contract.state.processingFee).toBe(50);
  });

  it("sets active status successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    const result = contract.setActiveStatus(false);
    expect(result.ok).toBe(true);
    expect(contract.state.activeStatus).toBe(false);
  });

  it("submits donation successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setCandidateRegistry("ST3CAND");
    contract.setDonorRegistry("ST4DONOR");
    contract.setComplianceChecker("ST5COMP");
    contract.setFundVault("ST6VAULT");
    contract.setAuditTrail("ST7AUDIT");
    contract.caller = "ST1TEST";
    contract.mockRegistries.donors.add("ST1TEST");
    contract.mockRegistries.candidates.add("ST8CAND");
    const result = contract.submitDonation("ST8CAND", 1000, "STX", "LocationX");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const donation = contract.getDonation(0);
    expect(donation?.donor).toBe("ST1TEST");
    expect(donation?.candidate).toBe("ST8CAND");
    expect(donation?.amount).toBe(1000);
    expect(donation?.currency).toBe("STX");
    expect(donation?.location).toBe("LocationX");
    expect(contract.stxTransfers).toEqual([
      { amount: 100, from: "ST1TEST", to: "ST2AUTH" },
      { amount: 1000, from: "ST1TEST", to: "ST6VAULT" },
    ]);
  });

  it("rejects donation if inactive", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setActiveStatus(false);
    contract.caller = "ST1TEST";
    const result = contract.submitDonation("ST8CAND", 1000, "STX", "LocationX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_STATUS);
  });

  it("rejects invalid amount", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setCandidateRegistry("ST3CAND");
    contract.setDonorRegistry("ST4DONOR");
    contract.setComplianceChecker("ST5COMP");
    contract.setFundVault("ST6VAULT");
    contract.setAuditTrail("ST7AUDIT");
    contract.caller = "ST1TEST";
    contract.mockRegistries.donors.add("ST1TEST");
    contract.mockRegistries.candidates.add("ST8CAND");
    const result = contract.submitDonation("ST8CAND", 0, "STX", "LocationX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_AMOUNT);
  });

  it("rejects invalid currency", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setCandidateRegistry("ST3CAND");
    contract.setDonorRegistry("ST4DONOR");
    contract.setComplianceChecker("ST5COMP");
    contract.setFundVault("ST6VAULT");
    contract.setAuditTrail("ST7AUDIT");
    contract.caller = "ST1TEST";
    contract.mockRegistries.donors.add("ST1TEST");
    contract.mockRegistries.candidates.add("ST8CAND");
    const result = contract.submitDonation("ST8CAND", 1000, "INVALID", "LocationX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CURRENCY);
  });

  it("rejects invalid donor", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setCandidateRegistry("ST3CAND");
    contract.setDonorRegistry("ST4DONOR");
    contract.setComplianceChecker("ST5COMP");
    contract.setFundVault("ST6VAULT");
    contract.setAuditTrail("ST7AUDIT");
    contract.caller = "ST1TEST";
    contract.mockRegistries.candidates.add("ST8CAND");
    const result = contract.submitDonation("ST8CAND", 1000, "STX", "LocationX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DONOR);
  });

  it("rejects invalid candidate", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setCandidateRegistry("ST3CAND");
    contract.setDonorRegistry("ST4DONOR");
    contract.setComplianceChecker("ST5COMP");
    contract.setFundVault("ST6VAULT");
    contract.setAuditTrail("ST7AUDIT");
    contract.caller = "ST1TEST";
    contract.mockRegistries.donors.add("ST1TEST");
    const result = contract.submitDonation("ST8CAND", 1000, "STX", "LocationX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CANDIDATE);
  });

  it("cancels donation successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setCandidateRegistry("ST3CAND");
    contract.setDonorRegistry("ST4DONOR");
    contract.setComplianceChecker("ST5COMP");
    contract.setFundVault("ST6VAULT");
    contract.setAuditTrail("ST7AUDIT");
    contract.caller = "ST1TEST";
    contract.mockRegistries.donors.add("ST1TEST");
    contract.mockRegistries.candidates.add("ST8CAND");
    contract.submitDonation("ST8CAND", 1000, "STX", "LocationX");
    const result = contract.cancelDonation(0);
    expect(result.ok).toBe(true);
    const donation = contract.getDonation(0);
    expect(donation?.status).toBe(false);
  });

  it("rejects cancel by non-donor", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setCandidateRegistry("ST3CAND");
    contract.setDonorRegistry("ST4DONOR");
    contract.setComplianceChecker("ST5COMP");
    contract.setFundVault("ST6VAULT");
    contract.setAuditTrail("ST7AUDIT");
    contract.caller = "ST1TEST";
    contract.mockRegistries.donors.add("ST1TEST");
    contract.mockRegistries.candidates.add("ST8CAND");
    contract.submitDonation("ST8CAND", 1000, "STX", "LocationX");
    contract.caller = "ST9FAKE";
    const result = contract.cancelDonation(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("gets donation count correctly", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setCandidateRegistry("ST3CAND");
    contract.setDonorRegistry("ST4DONOR");
    contract.setComplianceChecker("ST5COMP");
    contract.setFundVault("ST6VAULT");
    contract.setAuditTrail("ST7AUDIT");
    contract.caller = "ST1TEST";
    contract.mockRegistries.donors.add("ST1TEST");
    contract.mockRegistries.candidates.add("ST8CAND");
    contract.submitDonation("ST8CAND", 1000, "STX", "LocationX");
    const result = contract.getDonationCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);
  });

  it("gets donations by donor correctly", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setCandidateRegistry("ST3CAND");
    contract.setDonorRegistry("ST4DONOR");
    contract.setComplianceChecker("ST5COMP");
    contract.setFundVault("ST6VAULT");
    contract.setAuditTrail("ST7AUDIT");
    contract.caller = "ST1TEST";
    contract.mockRegistries.donors.add("ST1TEST");
    contract.mockRegistries.candidates.add("ST8CAND");
    contract.submitDonation("ST8CAND", 1000, "STX", "LocationX");
    const result = contract.getDonationsByDonor("ST1TEST");
    expect(result.donationIds).toEqual([0]);
  });

  it("gets donations by candidate correctly", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setCandidateRegistry("ST3CAND");
    contract.setDonorRegistry("ST4DONOR");
    contract.setComplianceChecker("ST5COMP");
    contract.setFundVault("ST6VAULT");
    contract.setAuditTrail("ST7AUDIT");
    contract.caller = "ST1TEST";
    contract.mockRegistries.donors.add("ST1TEST");
    contract.mockRegistries.candidates.add("ST8CAND");
    contract.submitDonation("ST8CAND", 1000, "STX", "LocationX");
    const result = contract.getDonationsByCandidate("ST8CAND");
    expect(result.donationIds).toEqual([0]);
  });

  it("rejects submission with max donations exceeded", () => {
    contract.setAuthorityContract("ST2AUTH");
    contract.caller = "ST2AUTH";
    contract.setCandidateRegistry("ST3CAND");
    contract.setDonorRegistry("ST4DONOR");
    contract.setComplianceChecker("ST5COMP");
    contract.setFundVault("ST6VAULT");
    contract.setAuditTrail("ST7AUDIT");
    contract.caller = "ST1TEST";
    contract.mockRegistries.donors.add("ST1TEST");
    contract.mockRegistries.candidates.add("ST8CAND");
    contract.state.donationCounter = 1000000;
    const result = contract.submitDonation("ST8CAND", 1000, "STX", "LocationX");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_DONATIONS_EXCEEDED);
  });
});