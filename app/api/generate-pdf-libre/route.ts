import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { FactureLibreDocument } from "@/components/document/FactureLibreDocument";
import type { ClientType, FactureLibreLigne } from "@/lib/types";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      numero: string;
      date: string;
      clientType: ClientType;
      clientName: string;
      clientAddress?: string;
      objet?: string;
      lignes: FactureLibreLigne[];
      notes?: string;
      username?: string;
      fileName?: string;
    };

    let logoBase64: string | null = null;
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
    } catch {
      logoBase64 = null;
    }

    const element = React.createElement(FactureLibreDocument, {
      numero: body.numero,
      date: body.date,
      clientType: body.clientType,
      clientName: body.clientName,
      clientAddress: body.clientAddress,
      objet: body.objet,
      lignes: body.lignes,
      notes: body.notes,
      logoBase64,
      username: body.username,
    }) as unknown as React.ReactElement;

    const pdfBuffer: Buffer = await renderToBuffer(element as never);

    const fileName = body.fileName || `Facture_${body.numero}.pdf`;
    const body2 = new Uint8Array(pdfBuffer);

    return new NextResponse(body2, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(body2.length),
      },
    });
  } catch (err) {
    console.error("[generate-pdf-libre]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
