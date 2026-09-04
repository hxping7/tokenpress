import { StylePreviewPage } from '@/components/style-pack/StylePreviewPage'

export const dynamic = 'force-dynamic'

export default function StylePreviewRoute({ params }: { params: { id: string } }) {
  return <StylePreviewPage styleId={decodeURIComponent(params.id)} builtin={false} />
}
