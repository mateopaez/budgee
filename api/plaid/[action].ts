export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    const { handleWebPlaid } = await import('../../server/plaid/vercel');
    return await handleWebPlaid(request);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, '').slice(0, 300)
        : 'Function failed';
    return Response.json({ error: message || 'Function failed' }, { status: 500 });
  }
}
