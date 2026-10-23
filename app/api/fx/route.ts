import { getRubRates } from '@/lib/fx-rates'

export async function GET() {
  const rates = await getRubRates()
  if (!rates) {
    return Response.json({ error: 'Курсы валют временно недоступны.' }, { status: 503 })
  }
  return Response.json(rates, {
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
  })
}
