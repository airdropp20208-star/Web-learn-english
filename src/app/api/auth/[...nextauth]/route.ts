// NextAuth removed — no auth needed
// This route is kept as a stub to avoid 404s if anything references it

export async function GET() {
  return Response.json({ authenticated: true, user: "local" });
}

export async function POST() {
  return Response.json({ authenticated: true, user: "local" });
}
