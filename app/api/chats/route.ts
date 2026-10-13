import { NextRequest, NextResponse } from "next/server";
import { SaaSError, supabaseRest, verifyFirebaseToken } from "@/lib/saas/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
type ChatRow = { id: string; title: string; messages: ChatMessage[]; created_at: string; updated_at: string };

async function identity(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw new SaaSError("Sign in to sync chat history.", 401);
  return verifyFirebaseToken(token, request.signal);
}

function fail(error: unknown) {
  const status = error instanceof SaaSError ? error.status : 500;
  const message = error instanceof SaaSError ? error.message : "Chat history service is temporarily unavailable.";
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const user = await identity(request);
    const rows = await supabaseRest<ChatRow[]>(
      `tiwat_chats?firebase_uid=eq.${encodeURIComponent(user.uid)}&select=id,title,messages,created_at,updated_at&order=updated_at.desc&limit=100`
    );
    return NextResponse.json({ chats: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await identity(request);
    const payload = await request.json().catch(() => null) as { chats?: unknown } | null;
    if (!payload || !Array.isArray(payload.chats) || payload.chats.length > 100) {
      return NextResponse.json({ error: "Invalid chat history payload." }, { status: 400 });
    }
    const chats = payload.chats.map((value) => {
      const item = value as Partial<ChatRow>;
      if (typeof item.id !== "string" || item.id.length < 1 || item.id.length > 100 ||
          typeof item.title !== "string" || item.title.length > 200 ||
          !Array.isArray(item.messages) || item.messages.length > 500) {
        throw new SaaSError("A chat in the history payload is invalid.", 400);
      }
      const messages = item.messages.map((message) => {
        const m = message as Partial<ChatMessage>;
        if (typeof m.id !== "string" || (m.role !== "user" && m.role !== "assistant") ||
            typeof m.content !== "string" || m.content.length > 200_000) {
          throw new SaaSError("A chat message is invalid.", 400);
        }
        return { id: m.id, role: m.role, content: m.content };
      });
      return {
        id: item.id,
        firebase_uid: user.uid,
        title: item.title || "New chat",
        messages,
        updated_at: typeof item.updated_at === "string" ? item.updated_at : new Date().toISOString(),
      };
    });
    if (chats.length) {
      await supabaseRest<unknown>("tiwat_chats?on_conflict=firebase_uid,id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(chats),
      });
    }
    return NextResponse.json({ ok: true, saved: chats.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await identity(request);
    const payload = await request.json().catch(() => null) as { id?: unknown } | null;
    if (typeof payload?.id !== "string" || !payload.id || payload.id.length > 100) {
      return NextResponse.json({ error: "A valid chat ID is required." }, { status: 400 });
    }
    await supabaseRest<unknown>(
      `tiwat_chats?id=eq.${encodeURIComponent(payload.id)}&firebase_uid=eq.${encodeURIComponent(user.uid)}`,
      { method: "DELETE", headers: { Prefer: "return=minimal" } }
    );
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}
