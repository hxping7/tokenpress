const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4000'
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET || 'token00-revalidate'

export async function revalidateTag(tag: string): Promise<void> {
  try {
    const res = await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: REVALIDATE_SECRET, tag }),
    })
    if (!res.ok) {
      console.warn(`Revalidate tag "${tag}" failed: ${res.status}`)
    }
  } catch (err) {
    console.warn(`Revalidate tag "${tag}" error:`, err)
  }
}

export async function revalidatePath(path: string): Promise<void> {
  try {
    const res = await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: REVALIDATE_SECRET, path }),
    })
    if (!res.ok) {
      console.warn(`Revalidate path "${path}" failed: ${res.status}`)
    }
  } catch (err) {
    console.warn(`Revalidate path "${path}" error:`, err)
  }
}
