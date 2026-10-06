import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, uuidSchema } from "@/lib/api";
import { requireActiveDevice } from "@/lib/device";
import { castVote } from "@/lib/reports";

const body = z.object({ kind: z.enum(["confirm", "outdated"]) });

/** POST /api/reports/:id/vote {kind: "confirm" | "outdated"} */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const id = uuidSchema.parse((await params).id);
  const { kind } = body.parse(await req.json());
  const deviceId = await requireActiveDevice();
  return NextResponse.json(await castVote(id, deviceId, kind));
});
