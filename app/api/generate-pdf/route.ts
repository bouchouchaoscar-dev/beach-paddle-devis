import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import path from "path";
import fs from "fs";
import { DevisDocument } from "@/components/document/DevisDocument";
import type { DevisDocumentProps } from "@/components/document/DevisDocument";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DevisDocumentProps & { fileName: string };

    // Read logo from /public and encode as base64 data URI for PDF embedding
    let logoBase64: string | null = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(logoPath)) {
        logoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
      }
    } catch {
      // Logo is not critical — continue without it
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(DevisDocument, {
      form: body.form,
      calc: body.calc,
      numero: body.numero,
      documentType: body.documentType,
      acompteVerse: body.acompteVerse,
      documentDate: body.documentDate,
      logoBase64,
    }) as unknown as React.ReactElement;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer: Buffer = await renderToBuffer(element as any);

    // Sanitise filename: strip characters not allowed in Content-Disposition
    const raw = (body.fileName || "document.pdf").replace(/\.pdf$/i, "");
    const safe = raw.replace(/[<>:"/\\|?*]/g, "").trim() || "document";
    const fileName = `${safe}.pdf`;

    // Convert Buffer → Uint8Array for NextResponse compatibility
    const body2 = new Uint8Array(pdfBuffer);

    return new NextResponse(body2, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(body2.byteLength),
      },
    });
  } catch (error) {
    console.error("[generate-pdf]", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF" },
      { status: 500 }
    );
  }
}
