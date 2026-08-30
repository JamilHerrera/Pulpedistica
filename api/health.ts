interface HealthRequest {
  method?: string
}

interface HealthResponse {
  status(code: number): HealthResponse
  json(body: unknown): void
}

export default function handler(_req: HealthRequest, res: HealthResponse) {
  res.status(200).json({
    status: 'ok',
    service: 'pulpe-analisis',
    timestamp: new Date().toISOString(),
  })
}
