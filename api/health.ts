interface HealthRequest {
  method?: string
}

interface HealthResponse {
  status(code: number): HealthResponse
  setHeader(nombre: string, valor: string): void
  json(body: unknown): void
}

/**
 * Healthcheck. Es idempotente por definicion: solo lee estado y no muta nada,
 * asi que llamarlo una o mil veces da el mismo resultado y es seguro
 * reintentarlo. Por eso se aceptan unicamente GET y HEAD; cualquier otro
 * metodo se rechaza con 405 en vez de simular que hizo algo.
 */
export default function handler(req: HealthRequest, res: HealthResponse) {
  const metodo = (req.method ?? 'GET').toUpperCase()

  if (metodo !== 'GET' && metodo !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    res.status(405).json({
      status: 'method_not_allowed',
      message: `El metodo ${metodo} no esta permitido en este endpoint.`,
    })
    return
  }

  res.status(200).json({
    status: 'ok',
    service: 'pulpe-analisis',
    timestamp: new Date().toISOString(),
  })
}
