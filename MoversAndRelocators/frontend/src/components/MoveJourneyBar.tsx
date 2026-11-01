import { useContext, useEffect, useState } from 'react'
import { request } from '../api'
import type { LeadJourneyStep } from '../types'
import { useT } from '../i18n'
import { OpenListContext } from '../searchHandoff'
import { StageBar, type RecordStage } from './RecordPage'

export type MoveStage = 'LEAD' | 'SURVEY' | 'QUOTATION' | 'PACKING' | 'PICKUP' | 'DELIVERY'

/** The move's stages after the lead, with the list each one opens in. */
const STAGES = [
  { stage: 'SURVEY', page: 'surveys', label: 'shell.nav.survey' },
  { stage: 'QUOTATION', page: 'quotations', label: 'shell.nav.quotation' },
  { stage: 'PACKING', page: 'packing', label: 'shell.nav.packing' },
  { stage: 'PICKUP', page: 'pickups', label: 'shell.nav.pickup' },
  { stage: 'DELIVERY', page: 'delivery', label: 'shell.nav.delivery' },
] as const

/** Stages of a move from its lead number and the records that followed; `here` is the stage being viewed. */
export function buildMoveStages(t: (key: string) => string, leadNumber: string | null, steps: LeadJourneyStep[], openList: (page: string, query: string) => void, here?: MoveStage): RecordStage[] {
  return [
    { key: 'LEAD', label: t('sales.record.stageLead'), done: true, here: here === 'LEAD', detail: leadNumber ?? undefined, onOpen: leadNumber ? () => openList('sales', leadNumber) : undefined },
    ...STAGES.map(s => {
      const records = steps.filter(j => j.stage === s.stage)
      const latest = records[records.length - 1]
      return { key: s.stage, label: t(s.label), done: records.length > 0, here: here === s.stage,
        detail: latest ? `${latest.number}${records.length > 1 ? ` +${records.length - 1}` : ''}` : t('sales.record.notStarted'),
        onOpen: latest ? () => openList(s.page, latest.number) : undefined }
    }),
  ]
}

/**
 * Stage bar for a survey, quotation, packing job, pickup or delivery page: finds the lead the record belongs to and
 * shows how far that move has got. Records that did not start from a lead (or users who cannot see it) show nothing.
 */
export function MoveJourneyBar({ stage, id }: { stage: Exclude<MoveStage, 'LEAD'>; id: string }) {
  const { t } = useT()
  const openList = useContext(OpenListContext)
  const [journey, setJourney] = useState<{ leadNumber: string | null; steps: LeadJourneyStep[] } | null>(null)
  useEffect(() => {
    let current = true
    request<{ leadId: string | null; leadNumber: string | null; steps: LeadJourneyStep[] }>(`/api/journey/${stage.toLowerCase()}/${id}`)
      .then(r => { if (current) setJourney(r.leadId ? r : null) }).catch(() => { if (current) setJourney(null) })
    return () => { current = false }
  }, [stage, id])
  if (!journey) return null
  return <StageBar stages={buildMoveStages(t, journey.leadNumber, journey.steps, openList, stage)} />
}
