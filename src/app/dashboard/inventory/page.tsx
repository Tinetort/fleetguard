import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getInventoryItems, getInventoryTransactions, getInventoryEnabled } from '../../actions'
import InventoryClient from './inventory-client'

export default async function InventoryPage() {
  const session = await getSession()
  if (!session || session.role !== 'director') {
    redirect('/dashboard')
  }

  const [items, transactions, enabled] = await Promise.all([
    getInventoryItems(),
    getInventoryTransactions(50),
    getInventoryEnabled(),
  ])

  return (
    <InventoryClient
      initialItems={items}
      initialTransactions={transactions}
      inventoryEnabled={enabled}
    />
  )
}
