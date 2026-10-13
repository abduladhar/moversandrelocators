import { useBusinessMasters } from './businessMasters'

/** One template per screen that sends a customer link; the code ties the two together. */
export type MessageTemplateCode =
  | 'SURVEY_CONFIRM' | 'QUOTATION' | 'LEAD_UPLOAD' | 'LEAD_INVENTORY'
  | 'PICKUP_CONFIRM' | 'PICKUP_PACKING_LIST'
  | 'PACKING_DATE' | 'PACKING_LOCATION' | 'PACKING_ITEMS'
  | 'DELIVERY_DATE' | 'DELIVERY_LOCATION'

/**
 * The same wording the server seeds. Kept here as well so a share dialog still produces a sensible message when the
 * masters have not loaded yet, or the template was made inactive — a customer link is never sent with an empty body.
 */
const FALLBACK: Record<MessageTemplateCode, string> = {
  SURVEY_CONFIRM: 'Hello {{customer}}, please confirm your moving survey {{reference}}, scheduled for {{date}}: {{link}}',
  QUOTATION: 'Hello {{customer}}, please review quotation {{reference}} for your move from {{origin}} to {{destination}}, valued at {{amount}}, and approve or reject it here: {{link}}',
  LEAD_UPLOAD: 'Hello {{customer}}, please upload your moving documents, photos, videos or audio: {{link}}',
  LEAD_INVENTORY: 'Hello {{customer}}, please check your moving list and mark anything you do not need moved: {{link}}',
  PICKUP_CONFIRM: 'Hello {{customer}}, please confirm your pickup {{reference}}: {{link}}',
  PICKUP_PACKING_LIST: 'Hello {{customer}}, please check and confirm your packing list for {{reference}}: {{link}}',
  PACKING_DATE: 'Hello {{customer}}, please confirm your packing date and time ({{reference}}): {{link}}',
  PACKING_LOCATION: 'Hello {{customer}}, please share your location for packing ({{reference}}): {{link}}',
  PACKING_ITEMS: 'Hello {{customer}}, please review and confirm your packed items ({{reference}}): {{link}}',
  DELIVERY_DATE: 'Hello {{customer}}, please confirm your delivery date and time (delivery {{reference}}): {{link}}',
  DELIVERY_LOCATION: 'Hello {{customer}}, please share your delivery location (delivery {{reference}}): {{link}}',
}

/** Values a template may refer to; those a screen cannot supply are left out rather than filled with a blank. */
export type MessageValues = Partial<Record<'customer' | 'reference' | 'link' | 'date' | 'amount' | 'origin' | 'destination' | 'company', string>>

/**
 * Fills a template. A placeholder with no value keeps its braces, so the gap is obvious in the draft the staff member
 * is about to send, rather than arriving at the customer as a hole in the sentence.
 */
export const fillTemplate = (body: string, values: MessageValues) =>
  body.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => {
    const value = values[key as keyof MessageValues]
    return value === undefined || value === '' ? whole : value
  // Runs of spaces collapse, line breaks do not: a template written over two lines must arrive that way.
  }).replace(/[^\S\n]+/g, ' ').trim()

/**
 * The message for one share dialog, from the tenant's templates. Call it with the values this screen knows; the
 * result is ready to send by WhatsApp, text message, email or LinkedIn.
 */
export function useMessageTemplate(code: MessageTemplateCode) {
  const { rows } = useBusinessMasters('message-template')
  const row = rows.find(x => x.code === code && x.isActive)
  const body = row?.notes?.trim() || FALLBACK[code]
  return { body, name: row?.name, message: (values: MessageValues) => fillTemplate(body, values) }
}
