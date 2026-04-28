import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { analyzeKnowledgeTranslationDocument, classifyKnowledgeTranslationDocumentIntake } from "../translationIntelligence.useCases";

const createdPaths: string[] = [];

async function writeFixture(fileName: string, content: string): Promise<string> {
  const filePath = path.join(os.tmpdir(), fileName);
  await fs.writeFile(filePath, content, "utf8");
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

describe("translationIntelligence.useCases", () => {
  it("classifies editable structured formats at intake", () => {
    const intake = classifyKnowledgeTranslationDocumentIntake({
      originalName: "board-pack.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(intake.format).toBe("docx");
    expect(intake.intakeClass).toBe("editable-structured");
    expect(intake.extractionPath).toBe("native-office");
    expect(intake.protectedElements).toContain("numbering");
  });

  it("builds a translation blueprint with protected placeholders and glossary hits", async () => {
    const filePath = await writeFixture(
      "translation-blueprint-fixture.html",
      `
        <html>
          <body>
            <h1>Statement of Work</h1>
            <p>The Supplier shall deliver within 30 days for {client_name}.</p>
            <table>
              <tr><th>Total Contract Value</th><td>500000</td></tr>
            </table>
          </body>
        </html>
      `,
    );

    const analysis = await analyzeKnowledgeTranslationDocument({
      documentId: "doc_1",
      originalName: "translation-blueprint-fixture.html",
      mimeType: "text/html",
      storagePath: filePath,
      sourceLanguage: "en",
      targetLanguage: "ar",
    });

    expect(analysis.intake.format).toBe("html");
    expect(analysis.intake.intakeClass).toBe("editable-structured");
    expect(analysis.routing.llmRefinement).toBe("targeted");
    expect(analysis.structure.segmentCount).toBeGreaterThanOrEqual(3);
    expect(analysis.structure.protectedTokenCount).toBeGreaterThan(0);
    expect(analysis.glossary.hits.some((entry) => entry.source === "Statement of Work")).toBe(true);
    expect(analysis.structure.segmentsPreview.some((segment) => /\[\[T\d+\]\]|\{\{PLACEHOLDER_1\}\}|\{\{NUMBER_1\}\}/.test(segment.protectedText))).toBe(true);
  });
});