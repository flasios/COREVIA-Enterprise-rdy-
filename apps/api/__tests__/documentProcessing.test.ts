import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DocumentProcessorService } from "@domains/knowledge/infrastructure/documentProcessing";

const XLSX_FIXTURE_BASE64 = "UEsDBBQAAAAIAPEEa1x9uDbGbgAAAHoAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbB2MQQ7CIBAAv0L23i56aIwBeusL6gMIrrRRFgIbo7+XepzMZMz8SS/1ptr2zBZOowZFHPJ952jhti7DBWZn1m+hpnrKzcImUq6ILWyUfBtzIe7mkWvy0rFGLD48fSQ8az1hyCzEMsjxAGfwP3M/UEsDBBQAAAAIAPEEa1wxmEI/igAAAK8AAAAUAAAAeGwvc2hhcmVkU3RyaW5ncy54bWxFjssKwjAQRX8lZG8ndlFEkhS6EPfqB4RmbAN5lMwofr4RF11ezuFw9fhJUbyxUijZyGOnpMA8Fx/yYuTjfjmc5Gg1EYsmZjJyZd7OADSvmBx1ZcPcyLPU5LjNugBtFZ2nFZFThF6pAZILWbZMsJrtFWMs4rZbGthq+MG/ML38gix61Q87gvbBfgFQSwMEFAAAAAgA8QRrXBc1wb6fAAAA8AAAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxdjkEKwjAQRa8SZm8n7UJEkoggnkAPENLYFpukZELr8R27KMXFwPw/b/hfXT5hFLPPNKSooa4kCB9daofYaXg+7ocTXIxaUn5T730RjEfS0JcynRHJ9T5YqtLkI19eKQdbWOYOacretutTGLGR8ojBDhGMWr2bLdaonBaROZZd91uuNYiigVjPRiqcjULHw9wGNxvc7OD6D8ZdCm71zRdQSwECFAMUAAAACADxBGtcfbg2xm4AAAB6AAAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAxQAAAAIAPEEa1wxmEI/igAAAK8AAAAUAAAAAAAAAAAAAACAAZ8AAAB4bC9zaGFyZWRTdHJpbmdzLnhtbFBLAQIUAxQAAAAIAPEEa1wXNcG+nwAAAPAAAAAYAAAAAAAAAAAAAACAAVsBAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwUGAAAAAAMAAwDJAAAAMAIAAAAA";
const PPTX_FIXTURE_BASE64 = "UEsDBBQAAAAIAPEEa1x9uDbGbgAAAHoAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbB2MQQ7CIBAAv0L23i56aIwBeusL6gMIrrRRFgIbo7+XepzMZMz8SS/1ptr2zBZOowZFHPJ952jhti7DBWZn1m+hpnrKzcImUq6ILWyUfBtzIe7mkWvy0rFGLD48fSQ8az1hyCzEMsjxAGfwP3M/UEsDBBQAAAAIAPEEa1zdZIKSwgAAAGQBAAAVAAAAcHB0L3NsaWRlcy9zbGlkZTEueG1sjZDJCgIxDIZfpfSuGT2IDDMjeBCP4vIAYRp1oEtoi8vb246KCx68fLRp8uej1exitDiRD52ztRwNCynItk519lDL3XYxmMpZU3EZtBKp1YaSa3mMkUuA0B7JYBg6Jpve9s4bjOnqD8CeAtmIMcUaDeOimIDBzspHCP4Tojyek8fHfHZpN1r1Trz1RPdTZrzMnbo2FZac4TNisyStnVi9CVWQ65m+J3+PrB0qgyzWdOro/KMdXsvgvh1eOvA0hP7bmhtQSwECFAMUAAAACADxBGtcfbg2xm4AAAB6AAAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAxQAAAAIAPEEa1zdZIKSwgAAAGQBAAAVAAAAAAAAAAAAAACAAZ8AAABwcHQvc2xpZGVzL3NsaWRlMS54bWxQSwUGAAAAAAIAAgCEAAAAlAEAAAAA";

const createdPaths: string[] = [];

async function writeFixture(fileName: string, base64Content: string): Promise<string> {
  const filePath = path.join(os.tmpdir(), fileName);
  await fs.writeFile(filePath, Buffer.from(base64Content, "base64"));
  createdPaths.push(filePath);
  return filePath;
}

afterEach(async () => {
  await Promise.all(
    createdPaths.splice(0).map(async (filePath) => {
      await fs.rm(filePath, { force: true });
    }),
  );
});

describe("DocumentProcessorService", () => {
  it("extracts text and sheet metadata from xlsx files", async () => {
    const filePath = await writeFixture("document-processing-fixture.xlsx", XLSX_FIXTURE_BASE64);
    const service = new DocumentProcessorService();

    const result = await service.extractText(filePath, "xlsx");

    expect(result.extractedText).toContain("Hello Spreadsheet");
    expect(result.extractedText).toContain("Budget 2026");
    expect(result.sheetCount).toBe(1);
    expect(result.fileTypeCategory).toBe("spreadsheet");
    expect(result.wordCount).toBeGreaterThan(1);
  });

  it("extracts text and slide metadata from pptx files", async () => {
    const filePath = await writeFixture("document-processing-fixture.pptx", PPTX_FIXTURE_BASE64);
    const service = new DocumentProcessorService();

    const result = await service.extractText(filePath, "pptx");

    expect(result.extractedText).toContain("Hello Presentation");
    expect(result.extractedText).toContain("Roadmap Review");
    expect(result.slideCount).toBe(1);
    expect(result.fileTypeCategory).toBe("presentation");
    expect(result.wordCount).toBeGreaterThan(1);
  });
});