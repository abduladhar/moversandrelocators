import { Button } from 'antd'
import { EnvironmentOutlined } from '@ant-design/icons'

type Props = { address?: string; latitude?: number | null; longitude?: number | null }

export function SurveyMapLink({ address, latitude, longitude }: Props) {
  const hasCoordinates = typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180
  const query = hasCoordinates ? `${latitude},${longitude}` : address?.trim()
  if (!query) return null
  return <Button size="small" icon={<EnvironmentOutlined />} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer">Open in Google Maps</Button>
}
