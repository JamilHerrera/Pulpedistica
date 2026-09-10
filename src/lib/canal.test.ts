import { describe, it, expect } from 'vitest'
import { nombreDeCanal } from './canal'

describe('nombreDeCanal', () => {
  it('antepone el prefijo que se le pasa', () => {
    expect(nombreDeCanal('dashboard')).toMatch(/^dashboard-/)
  })

  it('no repite el nombre entre dos pestañas abiertas a la vez', () => {
    expect(nombreDeCanal('fiados')).not.toBe(nombreDeCanal('fiados'))
  })
})
