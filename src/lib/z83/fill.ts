import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import {
  A,
  B,
  C,
  DECLARATION,
  D_LANGUAGE_NAME,
  D_SPEAK,
  D_WRITE,
  E_CURRENT_STUDY,
  E_ROWS,
  F_PREV_CONDITION,
  F_ROWS,
  GENDER_TICKS,
  G_ROWS,
  ID_DIGIT_BOXES,
  INITIALS,
  METHOD_TICKS,
  NO_X,
  PASSPORT_BOXES,
  RACE_TICKS,
  YESNO_ROWS,
  YES_X,
  Z83_PAGE_HEIGHT,
  type TextBox,
  type TickBox,
  type YesNoRow,
} from "./coords";
import type { Z83Data } from "./types";

const INK = rgb(0.05, 0.09, 0.19);

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph.trim()) continue;
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) {
        line = next;
      } else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function drawText(
  pages: PDFPage[],
  font: PDFFont,
  box: TextBox,
  value: string
) {
  const text = (value ?? "").trim();
  if (!text) return;
  const page = pages[box.page];
  if (!page) return;

  const maxLines = box.lines ?? 1;
  let size = box.size ?? 9;
  let lines = wrap(text, font, size, box.w);
  while (lines.length > maxLines && size > 5) {
    size -= 0.5;
    lines = wrap(text, font, size, box.w);
  }
  lines.slice(0, maxLines).forEach((line, i) => {
    const width = font.widthOfTextAtSize(line, size);
    const x =
      box.align === "center" ? box.x + (box.w - width) / 2 : box.x;
    page.drawText(line, {
      x,
      y:
        Z83_PAGE_HEIGHT -
        (box.y + i * (box.lineHeight ?? size + 2)) -
        size,
      size,
      font,
      color: INK,
    });
  });
}

function drawTick(
  pages: PDFPage[],
  font: PDFFont,
  tick: TickBox | undefined
) {
  if (!tick) return;
  pages[tick.page]?.drawText("X", {
    x: tick.x,
    y: Z83_PAGE_HEIGHT - tick.y - 9,
    size: 10,
    font,
    color: INK,
  });
}

function yesNo(
  pages: PDFPage[],
  font: PDFFont,
  row: YesNoRow,
  value: string
) {
  if (value !== "yes" && value !== "no") return;
  drawTick(pages, font, {
    page: 0,
    x: value === "yes" ? YES_X : NO_X,
    y: YESNO_ROWS[row],
  });
}

function chars(
  pages: PDFPage[],
  font: PDFFont,
  boxes: TextBox[],
  value: string
) {
  (value ?? "")
    .replace(/\s+/g, "")
    .slice(0, boxes.length)
    .split("")
    .forEach((c, i) => drawText(pages, font, boxes[i]!, c));
}

export async function fillZ83(
  data: Z83Data,
  templateBytes: ArrayBuffer | Uint8Array
) {
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  drawText(pages, font, A.position, data.position);
  drawText(pages, font, A.department, data.department);
  drawText(pages, font, A.reference, data.reference);
  drawText(pages, font, A.availability, data.availability);

  drawText(pages, font, B.surnameAndNames, data.surnameAndNames);
  drawText(pages, font, B.dateOfBirth, data.dateOfBirth);
  chars(pages, font, ID_DIGIT_BOXES, data.idNumber);
  chars(pages, font, PASSPORT_BOXES, data.passportNumber);
  drawTick(pages, bold, RACE_TICKS[data.race]);
  drawTick(pages, bold, GENDER_TICKS[data.gender]);
  yesNo(pages, bold, "disability", data.disability);
  yesNo(pages, bold, "saCitizen", data.saCitizen);
  drawText(pages, font, B.nationality, data.nationality);
  yesNo(pages, bold, "workPermit", data.workPermit);
  yesNo(
    pages,
    bold,
    "criminalConviction",
    data.criminalConviction
  );
  drawText(pages, font, B.criminalDetail, data.criminalDetail);
  yesNo(pages, bold, "pendingCriminal", data.pendingCriminal);
  drawText(
    pages,
    font,
    B.pendingCriminalDetail,
    data.pendingCriminalDetail
  );
  yesNo(
    pages,
    bold,
    "dismissedForMisconduct",
    data.dismissedForMisconduct
  );
  drawText(pages, font, B.dismissedDetail, data.dismissedDetail);
  yesNo(
    pages,
    bold,
    "pendingDisciplinary",
    data.pendingDisciplinary
  );
  drawText(
    pages,
    font,
    B.pendingDisciplinaryDetail,
    data.pendingDisciplinaryDetail
  );
  yesNo(
    pages,
    bold,
    "resignedPendingDisciplinary",
    data.resignedPendingDisciplinary
  );
  drawText(pages, font, B.resignedDetail, data.resignedDetail);
  yesNo(
    pages,
    bold,
    "dischargedIllHealth",
    data.dischargedIllHealth
  );
  yesNo(
    pages,
    bold,
    "businessWithState",
    data.businessWithState
  );
  yesNo(
    pages,
    bold,
    "relinquishBusiness",
    data.relinquishBusiness
  );
  drawText(pages, font, B.yearsPrivate, data.yearsPrivate);
  drawText(pages, font, B.yearsPublic, data.yearsPublic);
  drawText(
    pages,
    font,
    B.registrationDate,
    data.registrationDate
  );
  drawText(
    pages,
    font,
    B.registrationNumber,
    data.registrationNumber
  );

  drawText(
    pages,
    font,
    C.preferredLanguage,
    data.preferredLanguage
  );
  drawTick(pages, bold, METHOD_TICKS[data.method]);
  drawText(pages, font, C.contactDetails, data.contactDetails);

  data.languages.slice(0, 5).forEach((l, i) => {
    drawText(pages, font, D_LANGUAGE_NAME[i]!, l.name);
    drawText(pages, font, D_SPEAK[i]!, l.speak);
    drawText(pages, font, D_WRITE[i]!, l.write);
  });

  data.qualifications.slice(0, 4).forEach((q, i) => {
    const row = E_ROWS[i]!;
    drawText(pages, font, row.institution, q.institution);
    drawText(pages, font, row.qualification, q.qualification);
    drawText(pages, font, row.year, q.year);
  });
  drawText(pages, font, E_CURRENT_STUDY, data.currentStudy);

  data.jobs.slice(0, 3).forEach((j, i) => {
    const row = F_ROWS[i]!;
    drawText(pages, font, row.employer, j.employer);
    drawText(pages, font, row.post, j.post);
    drawText(pages, font, row.fromMonth, j.fromMonth);
    drawText(pages, font, row.fromYear, j.fromYear);
    drawText(pages, font, row.toMonth, j.toMonth);
    drawText(pages, font, row.toYear, j.toYear);
    drawText(pages, font, row.reason, j.reason);
  });
  if (data.prevPublicServiceCondition === "yes")
    drawTick(pages, bold, F_PREV_CONDITION.yes);
  if (data.prevPublicServiceCondition === "no")
    drawTick(pages, bold, F_PREV_CONDITION.no);
  drawText(
    pages,
    font,
    F_PREV_CONDITION.detail,
    data.prevPublicServiceDetail
  );

  data.references.slice(0, 3).forEach((r, i) => {
    const row = G_ROWS[i]!;
    drawText(pages, font, row.name, r.name);
    drawText(pages, font, row.relationship, r.relationship);
    drawText(pages, font, row.phone, r.phone);
  });

  if (
    data.signMode === "digital" &&
    data.signature.startsWith("data:image")
  ) {
    const png = await pdf.embedPng(data.signature);
    const slot = DECLARATION.signatureImage;
    const scale = Math.min(slot.w / png.width, slot.h / png.height);
    const width = png.width * scale;
    const height = png.height * scale;
    pages[slot.page]!.drawImage(png, {
      x: slot.x,
      y: Z83_PAGE_HEIGHT - slot.y - height,
      width,
      height,
    });
  } else if (data.signMode === "print") {
    drawText(
      pages,
      font,
      DECLARATION.signaturePrintNote,
      "(sign by hand after printing)"
    );
  }

  drawText(pages, font, DECLARATION.date, data.declarationDate);
  if (data.initials.trim()) {
    INITIALS.forEach((box) =>
      drawText(pages, font, box, data.initials)
    );
  }

  return pdf.save();
}
