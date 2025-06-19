import path from "path";
import { templatesDir } from "./dir";
import { TemplateDataSource } from "./types";

export const EXAMPLE_FILE: TemplateDataSource = {
  type: "file",
  config: {
    path: path.join(templatesDir, "components", "data", "101.pdf"),
  },
};

export const EXAMPLE_10K_SEC_FILES: TemplateDataSource[] = [
  {
    type: "file",
    config: {
      url: new URL(
        "https://s2.q4cdn.com/470004039/files/doc_earnings/2023/q4/filing/_10-K-Q4-2023-As-Filed.pdf",
      ),
      filename: "apple_10k_report.pdf",
    },
  },
  {
    type: "file",
    config: {
      url: new URL(
        "https://ir.tesla.com/_flysystem/s3/sec/000162828024002390/tsla-20231231-gen.pdf",
      ),
      filename: "tesla_10k_report.pdf",
    },
  },
];

export const EXAMPLE_GDPR: TemplateDataSource = {
  type: "file",
  config: {
    url: new URL(
      "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32016R0679",
    ),
    filename: "gdpr.pdf",
  },
};

export const AI_REPORTS: TemplateDataSource = {
  type: "file",
  config: {
    url: new URL(
      "https://www.europarl.europa.eu/RegData/etudes/ATAG/2024/760392/EPRS_ATA(2024)760392_EN.pdf",
    ),
    filename: "EPRS_ATA_2024_760392_EN.pdf",
  },
};
