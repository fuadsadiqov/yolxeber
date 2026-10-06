import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, optionalLatLng } from "@/lib/api";
import { feed } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** GET /api/feed?sort=new|near|top&lat=&lng=&cursor= */
export const GET = handle(async (req: Request) => {
  const sp = new URL(req.url).searchParams;
  const sort = z.enum(["new", "near", "top"]).catch("new").parse(sp.get("sort"));
  const page = await feed({ sort, at: optionalLatLng(sp), cursor: sp.get("cursor") });
  return NextResponse.json(page);
});
