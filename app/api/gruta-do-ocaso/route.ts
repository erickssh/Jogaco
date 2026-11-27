export function POST() {
  return Response.json(
    { error: "Salas online indisponíveis neste endereço. O treino está disponível." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
