// The self-contained browser distribution avoids Metro's tslib ESM interop error.
// Native continues to use the package's standard entry point.
import type * as PdfLib from "pdf-lib";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-lib/dist/pdf-lib.js") as typeof PdfLib;
export const { PDFDocument, StandardFonts, rgb } = pdf;
export type { PDFFont, PDFPage } from "pdf-lib";
