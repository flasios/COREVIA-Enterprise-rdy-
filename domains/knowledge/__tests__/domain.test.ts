import { describe, it, expect } from "vitest";
import {
  canViewDocument,
  isAllowedMimeType,
  validateUpload,
  canModifyDocument,
  nextDocumentStatus,
  computeQualityGrade,
  arePotentialDuplicates,
  isDocumentStale,
} from "../domain";

describe("knowledge domain", () => {
  describe("canViewDocument", () => {
    it("public viewable by anyone", () => {
      expect(canViewDocument("public", "public")).toBe(true);
    });

    it("sovereign requires sovereign clearance", () => {
      expect(canViewDocument("sovereign", "confidential")).toBe(false);
      expect(canViewDocument("sovereign", "sovereign")).toBe(true);
    });

    it("internal viewable by higher clearance", () => {
      expect(canViewDocument("internal", "confidential")).toBe(true);
    });
  });

  describe("isAllowedMimeType", () => {
    it("PDF is allowed", () => {
      expect(isAllowedMimeType("application/pdf")).toBe(true);
    });

    it("executable is not allowed", () => {
      expect(isAllowedMimeType("application/x-executable")).toBe(false);
    });
  });

  describe("validateUpload", () => {
    it("valid file passes", () => {
      expect(validateUpload({ size: 1024, mimeType: "application/pdf" }).valid).toBe(true);
    });

    it("too large fails", () => {
      expect(validateUpload({ size: 100 * 1024 * 1024, mimeType: "application/pdf" }).valid).toBe(false);
    });

    it("invalid mime fails", () => {
      expect(validateUpload({ size: 1024, mimeType: "application/x-exe" }).valid).toBe(false);
    });
  });

  describe("canModifyDocument", () => {
    it("admin can modify anything", () => {
      expect(canModifyDocument({ status: "approved", authorId: "u2" }, "u1", "super_admin")).toBe(true);
    });

    it("author can modify own draft", () => {
      expect(canModifyDocument({ status: "draft", authorId: "u1" }, "u1", "member")).toBe(true);
    });

    it("non-author cannot modify", () => {
      expect(canModifyDocument({ status: "draft", authorId: "u2" }, "u1", "member")).toBe(false);
    });
  });

  describe("nextDocumentStatus", () => {
    it("draft + submit → pending_review", () => {
      expect(nextDocumentStatus("draft", "submit")).toBe("pending_review");
    });

    it("pending_review + approve → approved", () => {
      expect(nextDocumentStatus("pending_review", "approve")).toBe("approved");
    });

    it("invalid transition returns null", () => {
      expect(nextDocumentStatus("approved", "approve")).toBeNull();
    });

    it("rejected can be resubmitted", () => {
      expect(nextDocumentStatus("rejected", "submit")).toBe("pending_review");
    });
  });

  describe("computeQualityGrade", () => {
    it("A for complete document", () => {
      expect(computeQualityGrade({
        hasTitle: true,
        hasDescription: true,
        hasTags: true,
        hasVersion: true,
        wordCount: 200,
        hasEvidence: true,
      })).toBe("A");
    });

    it("F for empty document", () => {
      expect(computeQualityGrade({
        hasTitle: false,
        hasDescription: false,
        hasTags: false,
        hasVersion: false,
        wordCount: 0,
        hasEvidence: false,
      })).toBe("F");
    });

    it("D for partial document", () => {
      expect(computeQualityGrade({
        hasTitle: true,
        hasDescription: true,
        hasTags: true,
        hasVersion: false,
        wordCount: 30,
        hasEvidence: false,
      })).toBe("D");
    });
  });

  describe("arePotentialDuplicates", () => {
    it("detects similar titles", () => {
      expect(arePotentialDuplicates(
        "IT Security Policy Document",
        "IT Security Policy Document v2",
      )).toBe(true);
    });

    it("rejects unrelated titles", () => {
      expect(arePotentialDuplicates("Budget Report 2024", "Security Assessment")).toBe(false);
    });

    it("handles empty strings", () => {
      expect(arePotentialDuplicates("", "")).toBe(false);
    });
  });

  describe("isDocumentStale", () => {
    it("false for recent update", () => {
      expect(isDocumentStale(new Date())).toBe(false);
    });

    it("true for old update", () => {
      const old = new Date(Date.now() - 200 * 86400000);
      expect(isDocumentStale(old)).toBe(true);
    });
  });
});
