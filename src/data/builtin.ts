import type { Platform } from './types'

export const BUILTIN_PLATFORMS: Pick<Platform, 'id' | 'name' | 'color'>[] = [
  { id: 'ibkr', name: 'IBKR', color: '#d81222' },
  { id: 'trading212', name: 'Trading 212', color: '#0b8fd6' },
  { id: 'robinhood', name: 'Robinhood', color: '#0f9d58' },
  { id: 'binance', name: 'Binance', color: '#c99400' },
  { id: 'okx', name: 'OKX', color: '#222222' },
  { id: 'coinbase', name: 'Coinbase', color: '#1652f0' },
  { id: 'kraken', name: 'Kraken', color: '#5741d9' },
  { id: 'gthtzq', name: '国泰海通', color: '#c8102e' },
]
