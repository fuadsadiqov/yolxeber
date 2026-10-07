import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, uuidSchema } from "@/lib/api";
import { addComment, COMMENT_MAX, listComments } from "@/lib/comments";
import { getDeviceId, requireActiveDevice } from "@/lib/device";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/reports/:id/comments?cursor= — rəylər (yeni → köhnə) */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const id = uuidSchema.parse((await params).id);
  const cursor = new URL(req.url).searchParams.get("cursor");
  return NextResponse.json(await listComments(id, await getDeviceId(), cursor));
});

const body = z.object({
  body: z
    .string()
    .trim()
    .min(1)
    .max(COMMENT_MAX)
    // Ard-arda boş sətirləri azaldırıq (spam / görünüş)
    .transform((v) => v.replace(/\n{3,}/g, "\n\n")),
});

/** POST /api/reports/:id/comments {body} */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const id = uuidSchema.parse((await params).id);
  const { body: text } = body.parse(await req.json());
  const deviceId = await requireActiveDevice();
  return NextResponse.json(await addComment(id, deviceId, text), { status: 201 });
});
