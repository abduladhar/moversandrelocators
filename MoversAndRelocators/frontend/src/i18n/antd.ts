import type { Locale } from 'antd/es/locale'
import en from 'antd/locale/en_GB'
import ar from 'antd/locale/ar_EG'
import tr from 'antd/locale/tr_TR'
import es from 'antd/locale/es_ES'
import fr from 'antd/locale/fr_FR'
import pt from 'antd/locale/pt_BR'
import 'dayjs/locale/en-gb'
import 'dayjs/locale/ar'
import 'dayjs/locale/tr'
import 'dayjs/locale/es'
import 'dayjs/locale/fr'
import 'dayjs/locale/pt-br'
import type { Language } from '.'

/** Ant Design's own texts (date pickers, pagination, empty states…) in the chosen language. */
export const antdLocales: Record<Language, Locale> = { en, ar, tr, es, fr, pt }
