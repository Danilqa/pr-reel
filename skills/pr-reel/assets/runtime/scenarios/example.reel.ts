// Template: copy it to <slug>.reel.ts and replace the screens, data and captions with the PR's own.
// Each reel.step is one caption in the video; the last one states the payoff.
import { expect, test } from '../lib'

const invoices = [
  { id: 'inv-1', customer: 'Acme Studios', status: 'overdue', amount: '$1,250.00' },
  { id: 'inv-2', customer: 'Northwind Traders', status: 'paid', amount: '$480.00' },
  { id: 'inv-3', customer: 'Blue Fern Cafe', status: 'overdue', amount: '$96.40' },
]

test('filter invoices by status', async ({ page, reel }) => {
  reel.describe({
    title: 'Filter invoices by status',
    ticket: 'ABC-123',
    summary: 'Overdue invoices are one click away instead of a scroll through the whole list.',
  })

  // Serve the data the screen needs; a request that fails is logged as "⚠ 404 GET /api/…"
  await page.route('**/api/invoices*', (route) => {
    const status = new URL(route.request().url()).searchParams.get('status')
    return route.fulfill({ json: invoices.filter((invoice) => status === null || invoice.status === status) })
  })

  await reel.step('Open the invoices', async () => {
    await page.goto('/invoices')
    await reel.ready(page.getByRole('heading', { name: 'Invoices' }))
  })

  // The filter is new, so the before recording stops at the screen that already existed
  if (reel.isBefore) return

  await reel.step('Show only the overdue ones', async () => {
    await reel.click(page.getByRole('button', { name: 'Overdue' }))
    await expect(page.getByRole('row')).toHaveCount(3)
  })

  await reel.step(
    'Two overdue invoices, nothing else',
    async () => {
      await reel.spotlight(page.getByRole('table'), { shot: 'overdue' })
    },
    { hold: 1400 }
  )
})
